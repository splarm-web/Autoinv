"""Router de automatización de email.

Configuración, prueba de conexión y de filtros, bandeja de facturas
pendientes, aprobación/rechazo, y suscripción a notificaciones push.
"""

import json
import logging
from datetime import datetime, timezone
from typing import List

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from ...api.deps import require_feature
from ...core.config import settings
from ...core.database import get_db
from ...models.email_automation import EmailAutomation, PendingInvoice, PushSubscription
from ...models.user import User
from ...schemas.automation import (
    AutomationConfigIn,
    AutomationConfigOut,
    AutomationStatusOut,
    AutomationTestIn,
    AutomationTestResult,
    AutomationToggle,
    FilterPreviewIn,
    FilterPreviewItem,
    PendingInvoiceDetail,
    PendingInvoiceOut,
    PushSubscriptionIn,
)
from ...services import (
    automation_approve, email_crypto, email_reader, email_worker, push_sender,
)

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/automation",
    tags=["automation"],
    dependencies=[Depends(require_feature("automatizacion"))],
)


# ── Helpers ──


def _get_config(db: Session, user_id: int) -> EmailAutomation | None:
    return db.query(EmailAutomation).filter(
        EmailAutomation.user_id == user_id,
    ).first()


def _config_out(db: Session, config: EmailAutomation) -> AutomationConfigOut:
    return AutomationConfigOut(
        id=config.id,
        enabled=config.enabled,
        imap_email=config.imap_email,
        has_password=bool(config.imap_app_password_enc),
        sender_filter=config.sender_filter,
        subject_filter=config.subject_filter,
        attachment_filter=config.attachment_filter,
        invoice_kind=config.invoice_kind,
        client_id=config.client_id,
        fecha_origen=config.fecha_origen or "fin_de_mes",
        default_cabeza=config.default_cabeza,
        default_cisterna=config.default_cisterna,
        require_validation=config.require_validation,
        notify_push=config.notify_push,
        send_on_approve=config.send_on_approve,
        reply_to_email=config.reply_to_email,
        reply_cc_email=config.reply_cc_email,
        reply_subject=config.reply_subject,
        reply_body=config.reply_body,
        destinatario_efectivo=automation_approve.destinatario(db, config) or None,
        poll_interval_minutes=config.poll_interval_minutes,
        last_poll_at=config.last_poll_at,
        last_error=config.last_error,
        created_at=config.created_at,
        updated_at=config.updated_at,
    )


def _warnings_de(p: PendingInvoice) -> List[str]:
    try:
        return json.loads(p.warnings_json) if p.warnings_json else []
    except Exception:
        return []


def _num_viajes(p: PendingInvoice) -> int:
    try:
        return len(json.loads(p.invoice_data_json or "{}").get("viajes", []))
    except Exception:
        return 0


def _total_de(p: PendingInvoice) -> float | None:
    try:
        return float(p.total) if p.total is not None else None
    except (TypeError, ValueError):
        return None


def _pending_out(p: PendingInvoice) -> PendingInvoiceOut:
    return PendingInvoiceOut(
        id=p.id,
        email_from=p.email_from,
        email_subject=p.email_subject,
        email_date=p.email_date,
        attachment_name=p.attachment_name,
        invoice_kind=p.invoice_kind,
        numero_factura=p.numero_factura,
        total=_total_de(p),
        status=p.status,
        warnings=_warnings_de(p),
        created_at=p.created_at,
        num_viajes=_num_viajes(p),
    )


def _pending_detail(p: PendingInvoice) -> PendingInvoiceDetail:
    try:
        datos = json.loads(p.invoice_data_json or "{}")
    except Exception:
        datos = None
    return PendingInvoiceDetail(
        **_pending_out(p).model_dump(),
        invoice_data=datos,
        invoice_id=p.invoice_id,
        approved_at=p.approved_at,
        sent_at=p.sent_at,
        send_error=p.send_error,
    )


def _password_de(config: EmailAutomation) -> str:
    if not config or not config.imap_app_password_enc:
        raise HTTPException(status_code=400, detail="No hay credenciales de email guardadas")
    try:
        return email_crypto.decrypt_password(config.imap_app_password_enc)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


# ── Configuración ──


@router.get("/config", response_model=AutomationConfigOut)
def get_config(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_feature("automatizacion")),
):
    config = _get_config(db, current_user.id)
    if not config:
        return AutomationConfigOut(id=0, enabled=False, has_password=False)
    return _config_out(db, config)


@router.put("/config", response_model=AutomationConfigOut)
def save_config(
    data: AutomationConfigIn,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_feature("automatizacion")),
):
    config = _get_config(db, current_user.id)
    if not config:
        config = EmailAutomation(user_id=current_user.id)
        db.add(config)

    config.imap_email = data.imap_email
    config.sender_filter = data.sender_filter or None
    config.subject_filter = data.subject_filter or None
    config.attachment_filter = data.attachment_filter or None
    config.invoice_kind = data.invoice_kind
    config.client_id = data.client_id
    config.fecha_origen = data.fecha_origen if data.fecha_origen in ("fin_de_mes", "recepcion") else "fin_de_mes"
    config.default_cabeza = data.default_cabeza or None
    config.default_cisterna = data.default_cisterna or None
    config.require_validation = data.require_validation
    config.notify_push = data.notify_push
    config.send_on_approve = data.send_on_approve
    config.reply_to_email = data.reply_to_email or None
    config.reply_cc_email = data.reply_cc_email or None
    config.reply_subject = data.reply_subject
    config.reply_body = data.reply_body
    config.poll_interval_minutes = max(1, min(60, data.poll_interval_minutes))

    # La contraseña solo se toca si mandan una nueva
    nueva = email_crypto.normalize_app_password(data.imap_app_password)
    if nueva:
        config.imap_app_password_enc = email_crypto.encrypt_password(nueva)

    db.commit()
    db.refresh(config)
    return _config_out(db, config)


@router.post("/test-connection", response_model=AutomationTestResult)
def test_connection(
    data: AutomationTestIn,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_feature("automatizacion")),
):
    """Prueba la conexión IMAP. Sin contraseña en la petición, usa la guardada."""
    config = _get_config(db, current_user.id)
    correo = data.imap_email or (config.imap_email if config else None)
    if not correo:
        raise HTTPException(status_code=400, detail="Falta el email")
    # Mismo trato que al guardarla: sin esto, probar la conexión con la
    # contraseña recién pegada (con espacios) fallaría aunque sea correcta
    password = email_crypto.normalize_app_password(data.imap_app_password) or _password_de(config)
    return AutomationTestResult(**email_reader.test_imap_connection(correo, password))


@router.post("/test-filters", response_model=List[FilterPreviewItem])
def test_filters(
    data: FilterPreviewIn,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_feature("automatizacion")),
):
    """Enseña qué correos recientes entrarían con los filtros indicados."""
    config = _get_config(db, current_user.id)
    if not config or not config.imap_email:
        raise HTTPException(status_code=400, detail="Configura primero la conexión de email")
    password = _password_de(config)
    try:
        resultados = email_reader.preview_filters(
            imap_email=config.imap_email,
            app_password=password,
            sender_filter=data.sender_filter,
            subject_filter=data.subject_filter,
            attachment_filter=data.attachment_filter,
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"No se pudo leer el buzón: {e}")
    return [
        FilterPreviewItem(
            from_=r["from"], subject=r["subject"], date=r["date"],
            matches=r["matches"], reason=r["reason"],
        )
        for r in resultados
    ]


@router.patch("/toggle", response_model=AutomationConfigOut)
def toggle_automation(
    data: AutomationToggle,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_feature("automatizacion")),
):
    config = _get_config(db, current_user.id)
    if not config:
        raise HTTPException(status_code=400, detail="Configura primero la automatización")
    if data.enabled:
        if not config.imap_email or not config.imap_app_password_enc:
            raise HTTPException(
                status_code=400,
                detail="Configura las credenciales de email antes de activar",
            )
        if not config.client_id:
            raise HTTPException(
                status_code=400,
                detail="Elige el cliente al que se facturarán los viajes antes de activar",
            )
    config.enabled = data.enabled
    config.last_error = None
    db.commit()
    db.refresh(config)
    return _config_out(db, config)


# ── Facturas pendientes ──


@router.get("/pending", response_model=List[PendingInvoiceOut])
def list_pending(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_feature("automatizacion")),
):
    pendientes = (
        db.query(PendingInvoice)
        .filter(
            PendingInvoice.user_id == current_user.id,
            PendingInvoice.status == "pending",
        )
        .order_by(PendingInvoice.created_at.desc())
        .all()
    )
    return [_pending_out(p) for p in pendientes]


@router.get("/history", response_model=List[PendingInvoiceOut])
def get_history(
    skip: int = 0,
    limit: int = 50,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_feature("automatizacion")),
):
    items = (
        db.query(PendingInvoice)
        .filter(
            PendingInvoice.user_id == current_user.id,
            PendingInvoice.status.in_(["approved", "rejected"]),
        )
        .order_by(PendingInvoice.created_at.desc())
        .offset(skip).limit(limit).all()
    )
    return [_pending_out(p) for p in items]


def _buscar_pendiente(db: Session, pending_id: int, user_id: int) -> PendingInvoice:
    p = db.query(PendingInvoice).filter(
        PendingInvoice.id == pending_id,
        PendingInvoice.user_id == user_id,
    ).first()
    if not p:
        raise HTTPException(status_code=404, detail="Factura pendiente no encontrada")
    return p


@router.get("/pending/{pending_id}", response_model=PendingInvoiceDetail)
def get_pending(
    pending_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_feature("automatizacion")),
):
    return _pending_detail(_buscar_pendiente(db, pending_id, current_user.id))


@router.get("/pending/{pending_id}/pdf")
def get_pending_pdf(
    pending_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_feature("automatizacion")),
):
    """PDF de la factura pendiente — es ya el definitivo, no un borrador."""
    p = _buscar_pendiente(db, pending_id, current_user.id)
    if not p.pdf_path:
        raise HTTPException(status_code=404, detail="PDF no encontrado")
    ruta = settings.files_root / p.pdf_path
    if not ruta.exists():
        raise HTTPException(status_code=404, detail="El fichero PDF ya no existe")
    return FileResponse(
        ruta, media_type="application/pdf",
        filename=f"{p.numero_factura or 'factura'}.pdf",
    )


@router.get("/pending/{pending_id}/excel")
def get_pending_excel(
    pending_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_feature("automatizacion")),
):
    """Excel original que llegó por correo, por si hay que comprobar algo."""
    p = _buscar_pendiente(db, pending_id, current_user.id)
    if not p.excel_path:
        raise HTTPException(status_code=404, detail="Excel no encontrado")
    ruta = settings.files_root / p.excel_path
    if not ruta.exists():
        raise HTTPException(status_code=404, detail="El fichero ya no existe")
    return FileResponse(ruta, filename=p.attachment_name or ruta.name)


@router.post("/pending/{pending_id}/approve", response_model=PendingInvoiceDetail)
def approve_pending(
    pending_id: int,
    background: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_feature("automatizacion")),
):
    """Aprueba la pendiente: la guarda como factura y encola el envío.

    El correo se manda en segundo plano para poder responder al instante: el
    diálogo con Gmail son varios segundos y no hay motivo para que el usuario
    los espere mirando un botón, la factura ya está guardada y es válida.
    """
    p = _buscar_pendiente(db, pending_id, current_user.id)
    if p.status != "pending":
        raise HTTPException(status_code=400, detail=f"La factura ya está en estado '{p.status}'")

    config = _get_config(db, current_user.id)
    try:
        automation_approve.approve(db, p, config, current_user)
        if config and config.send_on_approve and p.invoice_id:
            background.add_task(automation_approve.enviar_en_segundo_plano, p.invoice_id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error("automation: fallo aprobando %s — %s", pending_id, e)
        db.rollback()
        raise HTTPException(status_code=500, detail=f"No se pudo aprobar: {e}")
    return _pending_detail(p)


@router.post("/pending/{pending_id}/resolve", response_model=PendingInvoiceDetail)
def resolve_pending(
    pending_id: int,
    invoice_id: int | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_feature("automatizacion")),
):
    """Marca la pendiente como resuelta porque el usuario la guardó a mano.

    Es el cierre del camino "Editar": la factura se crea por el alta normal de
    transporte, y sin esto la pendiente se quedaría para siempre en la bandeja.
    """
    p = _buscar_pendiente(db, pending_id, current_user.id)
    if p.status != "pending":
        return _pending_detail(p)
    p.status = "approved"
    p.approved_at = datetime.now(timezone.utc)
    if invoice_id:
        p.invoice_id = invoice_id
    db.commit()
    db.refresh(p)
    return _pending_detail(p)


@router.post("/pending/{pending_id}/reject", response_model=PendingInvoiceDetail)
def reject_pending(
    pending_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_feature("automatizacion")),
):
    p = _buscar_pendiente(db, pending_id, current_user.id)
    if p.status != "pending":
        raise HTTPException(status_code=400, detail=f"La factura ya está en estado '{p.status}'")
    p.status = "rejected"
    db.commit()
    db.refresh(p)
    return _pending_detail(p)


# ── Estado y acciones ──


@router.get("/status", response_model=AutomationStatusOut)
def get_status(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_feature("automatizacion")),
):
    config = _get_config(db, current_user.id)
    pendientes = db.query(PendingInvoice).filter(
        PendingInvoice.user_id == current_user.id,
        PendingInvoice.status == "pending",
    ).count()
    disponible = push_sender.push_disponible()
    return AutomationStatusOut(
        configured=config is not None,
        enabled=config.enabled if config else False,
        last_poll_at=config.last_poll_at if config else None,
        last_error=config.last_error if config else None,
        pending_count=pendientes,
        push_available=disponible,
        vapid_public_key=settings.vapid_public_key if disponible else None,
    )


@router.post("/poll-now")
def poll_now(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_feature("automatizacion")),
):
    """Revisa el buzón ahora mismo, sin esperar al siguiente ciclo."""
    config = _get_config(db, current_user.id)
    if not config or not config.enabled:
        raise HTTPException(status_code=400, detail="La automatización no está activada")
    try:
        creadas = email_worker.trigger_poll(config.id)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error al revisar el correo: {e}")
    db.refresh(config)
    return {
        "ok": True,
        "created": creadas,
        "message": (
            f"{creadas} factura(s) nueva(s)" if creadas
            else (config.last_error or "Sin correos nuevos")
        ),
    }


# ── Notificaciones push ──


@router.post("/push/subscribe")
def push_subscribe(
    data: PushSubscriptionIn,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_feature("automatizacion")),
):
    """Registra este navegador para recibir notificaciones."""
    existente = db.query(PushSubscription).filter(
        PushSubscription.endpoint == data.endpoint,
    ).first()
    if existente:
        existente.user_id = current_user.id
        existente.p256dh = data.p256dh
        existente.auth = data.auth
        existente.user_agent = data.user_agent
    else:
        db.add(PushSubscription(
            user_id=current_user.id,
            endpoint=data.endpoint,
            p256dh=data.p256dh,
            auth=data.auth,
            user_agent=data.user_agent,
        ))
    db.commit()
    return {"ok": True}


@router.post("/push/unsubscribe")
def push_unsubscribe(
    data: PushSubscriptionIn,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_feature("automatizacion")),
):
    db.query(PushSubscription).filter(
        PushSubscription.endpoint == data.endpoint,
        PushSubscription.user_id == current_user.id,
    ).delete()
    db.commit()
    return {"ok": True}


@router.post("/push/test")
def push_test(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_feature("automatizacion")),
):
    """Manda una notificación de prueba a los dispositivos registrados."""
    if not push_sender.push_disponible():
        raise HTTPException(status_code=400, detail="El servidor no tiene claves VAPID configuradas")
    entregadas = push_sender.send_to_user(
        db, current_user.id,
        "autoinv — prueba",
        "Si ves esto, las notificaciones funcionan.",
        url="/automation",
    )
    if entregadas == 0:
        raise HTTPException(
            status_code=400,
            detail="Ningún dispositivo registrado. Activa las notificaciones en este dispositivo primero.",
        )
    return {"ok": True, "delivered": entregadas}
