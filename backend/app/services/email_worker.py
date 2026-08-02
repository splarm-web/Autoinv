"""Worker de polling de email.

Revisa periódicamente los buzones de los usuarios con la automatización
activada, y por cada correo que pase los filtros compone una factura completa
y la deja pendiente de validación (o la aprueba sola, si así está configurado).
"""

import json
import logging
from datetime import date, datetime, timedelta, timezone

from apscheduler.schedulers.background import BackgroundScheduler
from sqlalchemy.orm import Session

from ..core.config import settings
from ..core.database import SessionLocal
from ..invoicing.designs.alfredo.render import render_transporte_pdf
from ..models.client import Client
from ..models.email_automation import EmailAutomation, PendingInvoice
from ..models.invoice import Invoice
from ..models.user import User
from . import email_crypto, email_reader, push_sender, transporte_compose, transporte_excel

logger = logging.getLogger(__name__)

_scheduler: BackgroundScheduler | None = None


# ── Polling ──


def _process_automation(automation_id: int) -> int:
    """Procesa una automatización: lee el buzón y crea las facturas pendientes.

    Devuelve cuántas se han creado.
    """
    db: Session = SessionLocal()
    try:
        config = db.query(EmailAutomation).filter(
            EmailAutomation.id == automation_id,
            EmailAutomation.enabled == True,  # noqa: E712
        ).first()
        if not config:
            return 0

        if not config.imap_email or not config.imap_app_password_enc:
            config.last_error = "Faltan las credenciales de email"
            db.commit()
            return 0

        try:
            app_password = email_crypto.decrypt_password(config.imap_app_password_enc)
        except ValueError as e:
            config.last_error = str(e)
            db.commit()
            return 0

        # UIDs ya procesados: el lector los salta sin tocar su estado de leído
        ya_vistos = {
            uid for (uid,) in db.query(PendingInvoice.email_uid).filter(
                PendingInvoice.automation_id == config.id,
                PendingInvoice.email_uid.isnot(None),
            ).all()
        }

        try:
            emails = email_reader.fetch_excel_emails(
                imap_email=config.imap_email,
                app_password=app_password,
                sender_filter=config.sender_filter,
                subject_filter=config.subject_filter,
                attachment_filter=config.attachment_filter,
                skip_uids=ya_vistos,
            )
        except Exception as e:
            config.last_error = f"Error al leer el correo: {e}"
            config.last_poll_at = datetime.now(timezone.utc)
            db.commit()
            return 0

        creadas = []
        for correo in emails:
            for filename, excel_bytes in correo["attachments"]:
                try:
                    pending = _create_pending_invoice(
                        db=db, config=config, correo=correo,
                        filename=filename, excel_bytes=excel_bytes,
                    )
                    if pending:
                        creadas.append(pending)
                        # Solo se marca leído si se procesó bien: si falla, el
                        # correo sigue sin leer y se reintenta en el próximo poll.
                        email_reader.mark_seen(
                            imap_email=config.imap_email,
                            app_password=app_password,
                            uid=correo["uid"],
                        )
                except Exception as e:
                    logger.error(
                        "email_worker: fallo procesando '%s' de %s — %s",
                        filename, correo.get("from"), e,
                    )

        config.last_poll_at = datetime.now(timezone.utc)
        config.last_error = None
        db.commit()

        if creadas and config.notify_push:
            _notify(db, config.user_id, creadas)

        return len(creadas)

    except Exception as e:
        logger.error("email_worker: error fatal en automatización %s — %s", automation_id, e)
        try:
            db.rollback()
        except Exception:
            pass
        return 0
    finally:
        db.close()


def _create_pending_invoice(
    db: Session,
    config: EmailAutomation,
    correo: dict,
    filename: str,
    excel_bytes: bytes,
) -> PendingInvoice | None:
    """Parsea el Excel, compone la factura completa y la deja pendiente."""
    parsed = transporte_excel.parse(excel_bytes)
    if not parsed.get("viajes"):
        # Excel sin tabla de viajes: no es el fichero que buscamos
        logger.info("email_worker: '%s' no contiene viajes, se ignora", filename)
        return None

    user = db.query(User).filter(User.id == config.user_id).first()
    client = None
    if config.client_id:
        client = db.query(Client).filter(
            Client.id == config.client_id,
            Client.user_id == config.user_id,
        ).first()

    fecha_correo = correo.get("date")
    payload = transporte_compose.compose(
        parsed=parsed, user=user, client=client, config=config,
        fecha_recepcion=fecha_correo.date() if fecha_correo else None,
    )

    # Avisos que bloquean la aprobación automática
    warnings = transporte_compose.validate(payload)
    numero = payload["numero_factura"]
    if _numero_ya_usado(db, config.user_id, numero):
        warnings.append(f"Ya existe una factura con el número {numero}")

    # Guardar Excel original y generar el PDF definitivo
    carpeta = settings.files_root / str(config.user_id) / "automation"
    carpeta.mkdir(parents=True, exist_ok=True)
    marca = datetime.now().strftime("%Y%m%d_%H%M%S")
    nombre_seguro = filename.replace("/", "_").replace("\\", "_")

    excel_path = carpeta / f"{marca}_{nombre_seguro}"
    excel_path.write_bytes(excel_bytes)

    pdf_path = carpeta / f"{marca}_{numero.replace('/', '-')}.pdf"
    render_transporte_pdf(payload, pdf_path)

    pending = PendingInvoice(
        user_id=config.user_id,
        automation_id=config.id,
        email_from=correo.get("from", ""),
        email_subject=correo.get("subject", ""),
        email_date=fecha_correo,
        email_uid=correo["uid"],
        attachment_name=filename,
        invoice_kind=config.invoice_kind or "transporte",
        invoice_data_json=json.dumps(payload, ensure_ascii=False, default=str),
        numero_factura=numero,
        total=f"{payload.get('total', 0):.2f}",
        pdf_path=str(pdf_path.relative_to(settings.files_root)),
        excel_path=str(excel_path.relative_to(settings.files_root)),
        warnings_json=json.dumps(warnings, ensure_ascii=False) if warnings else None,
        status="pending",
    )
    db.add(pending)
    db.commit()
    db.refresh(pending)

    # Aprobación automática: solo si el usuario la pidió Y no hay ningún aviso.
    # El automatismo se salta el trámite, nunca las comprobaciones.
    if not config.require_validation and not warnings:
        from ..services import automation_approve
        try:
            automation_approve.approve(db, pending, config, user)
        except Exception as e:
            logger.error("email_worker: fallo aprobando automáticamente %s — %s", pending.id, e)

    return pending


def _numero_ya_usado(db: Session, user_id: int, numero: str) -> bool:
    """¿Hay ya una factura (guardada o pendiente) con ese número?"""
    if db.query(Invoice).filter(
        Invoice.user_id == user_id, Invoice.number == numero,
    ).first():
        return True
    return db.query(PendingInvoice).filter(
        PendingInvoice.user_id == user_id,
        PendingInvoice.numero_factura == numero,
        PendingInvoice.status == "pending",
    ).first() is not None


def _notify(db: Session, user_id: int, creadas: list[PendingInvoice]):
    """Notificación push al usuario por las facturas recién llegadas."""
    n = len(creadas)
    if n == 1:
        p = creadas[0]
        titulo = "Nueva factura por validar"
        cuerpo = f"{p.numero_factura} · {p.total} € — {p.email_from or 'correo recibido'}"
    else:
        titulo = f"{n} facturas por validar"
        cuerpo = "Se han recibido nuevos Excel de viajes."
    try:
        push_sender.send_to_user(db, user_id, titulo, cuerpo, url="/automation")
    except Exception as e:
        logger.error("email_worker: no se pudo notificar a %s — %s", user_id, e)


# ── Scheduler ──


def _poll_all():
    """Job maestro: recorre las automatizaciones activas que toca revisar."""
    db = SessionLocal()
    try:
        configs = db.query(EmailAutomation).filter(
            EmailAutomation.enabled == True,  # noqa: E712
        ).all()
        pendientes = []
        for config in configs:
            if config.last_poll_at:
                proximo = config.last_poll_at + timedelta(minutes=config.poll_interval_minutes)
                if datetime.now(timezone.utc) < proximo:
                    continue
            pendientes.append(config.id)
    finally:
        db.close()

    for config_id in pendientes:
        try:
            _process_automation(config_id)
        except Exception as e:
            logger.error("email_worker: error en automatización %s — %s", config_id, e)


def start_scheduler():
    """Arranca el polling. Se llama desde el startup de FastAPI."""
    global _scheduler
    if _scheduler is not None:
        return

    _scheduler = BackgroundScheduler(daemon=True, timezone="UTC")
    _scheduler.add_job(
        _poll_all, "interval", minutes=1,
        id="email_poll_master", replace_existing=True,
        max_instances=1, coalesce=True,
        # Arranca a los 30s para no competir con el startup del servidor
        next_run_time=datetime.now(timezone.utc) + timedelta(seconds=30),
    )
    _scheduler.start()
    logger.info("email_worker: scheduler arrancado")


def stop_scheduler():
    global _scheduler
    if _scheduler:
        _scheduler.shutdown(wait=False)
        _scheduler = None
        logger.info("email_worker: scheduler detenido")


def trigger_poll(automation_id: int) -> int:
    """Fuerza un poll inmediato (botón "Revisar ahora" de la UI)."""
    return _process_automation(automation_id)
