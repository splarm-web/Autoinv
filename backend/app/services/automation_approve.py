"""Aprobación de una factura pendiente: pasa a factura real y, si procede, se envía.

Vive en un servicio propio porque hay dos caminos que llegan aquí: el usuario
pulsando "Aprobar" en la UI, y el worker cuando la validación manual está
desactivada. Ambos deben producir exactamente el mismo resultado.
"""

import json
import logging
from datetime import datetime, timezone

from sqlalchemy.orm import Session

from ..core.config import settings
from ..invoicing.designs.alfredo.render import render_transporte_pdf
from ..models.client import Client
from ..models.email_automation import EmailAutomation, PendingInvoice
from ..models.invoice import Invoice
from ..services import email_crypto, email_sender, transporte_compose

logger = logging.getLogger(__name__)


def _fecha_de(payload: dict):
    iso = payload.get("fecha_iso")
    if iso:
        try:
            return datetime.strptime(iso, "%Y-%m-%d").date()
        except ValueError:
            pass
    for fmt in ("%d/%m/%Y", "%Y-%m-%d"):
        try:
            return datetime.strptime(payload.get("fecha_factura", ""), fmt).date()
        except (ValueError, TypeError):
            continue
    return datetime.now(timezone.utc).date()


def approve(db: Session, pending: PendingInvoice,
            config: EmailAutomation | None, user) -> PendingInvoice:
    """Convierte la pendiente en factura guardada. Envía el email si toca.

    El payload ya venía compuesto y validado desde el worker, así que aquí no
    se recalcula nada: el PDF que el usuario vio en la previsualización es
    literalmente el que se guarda.
    """
    payload = json.loads(pending.invoice_data_json or "{}")

    # Los avisos (nº duplicado, datos incompletos) bloquean aquí y no solo en
    # la UI: si el botón deshabilitado fuese la única defensa, cualquier
    # llamada directa a la API podría duplicar un número de factura.
    try:
        avisos = json.loads(pending.warnings_json) if pending.warnings_json else []
    except Exception:
        avisos = []
    if avisos:
        raise ValueError(
            "Esta factura necesita revisión antes de aprobarse: " + " · ".join(avisos)
        )

    faltan = transporte_compose.validate(payload)
    if faltan:
        raise ValueError("Faltan campos obligatorios: " + " · ".join(faltan))

    numero = payload.get("numero_factura", "")
    cliente = payload.get("cliente", {})
    fecha = _fecha_de(payload)

    invoice = Invoice(
        user_id=pending.user_id,
        client_id=config.client_id if config else None,
        number=numero,
        date=fecha,
        client_name=cliente.get("nombre", ""),
        client_tax_id=cliente.get("cif", ""),
        client_address=" ".join(
            x for x in [cliente.get("direccion", ""), cliente.get("ciudad", "")] if x
        ),
        payment_method="Transferencia",
        subtotal=float(payload.get("base", 0)),
        vat_total=float(payload.get("iva", 0)),
        irpf_total=float(payload.get("irpf", 0)),
        total=float(payload.get("total", 0)),
        kind="transporte",
        extra_json=pending.invoice_data_json,
    )
    db.add(invoice)
    db.flush()

    # PDF definitivo en la carpeta de facturas (el de la pendiente era temporal)
    carpeta = settings.files_root / str(pending.user_id) / "invoices"
    numero_seguro = numero.replace("/", "-").replace("\\", "-")
    pdf_path = carpeta / f"transporte-{numero_seguro}.pdf"
    render_transporte_pdf(payload, pdf_path)
    invoice.pdf_path = str(pdf_path.relative_to(settings.files_root))

    pending.status = "approved"
    pending.invoice_id = invoice.id
    pending.approved_at = datetime.now(timezone.utc)
    pending.pdf_path = invoice.pdf_path

    if config and config.send_on_approve:
        enviar(db, invoice, config, payload, pdf_path)
        # La pendiente refleja lo mismo que la factura, para el historial
        pending.sent_at = invoice.sent_at
        pending.send_error = invoice.send_error

    db.commit()
    db.refresh(pending)
    return pending


def destinatario(db: Session, config: EmailAutomation) -> str:
    """A quién se envía: lo de la configuración manda; si no, el email del cliente."""
    if config.reply_to_email:
        return config.reply_to_email
    if config.client_id:
        client = db.query(Client).filter(Client.id == config.client_id).first()
        if client and client.email:
            return client.email
    return ""


def enviar(db: Session, invoice: Invoice, config: EmailAutomation,
           payload: dict, pdf_path, to_email: str | None = None) -> dict:
    """Envía la factura por email y deja constancia en la propia factura.

    Nunca lanza: un fallo de envío no debe tumbar la aprobación (la factura ya
    es válida y está guardada). El motivo queda en `invoice.send_error` para
    poder verlo después desde el listado — antes se perdía en cuanto se cerraba
    el aviso de la pantalla.
    """
    para = (to_email or "").strip() or destinatario(db, config)
    if not para:
        invoice.send_error = "No hay destinatario: ni en la configuración ni en la ficha del cliente"
        return {"ok": False, "message": invoice.send_error}
    if not config or not config.imap_app_password_enc:
        invoice.send_error = "No hay credenciales de email configuradas"
        return {"ok": False, "message": invoice.send_error}

    try:
        password = email_crypto.decrypt_password(config.imap_app_password_enc)
        resultado = email_sender.send_invoice_email(
            smtp_email=config.imap_email,
            smtp_app_password=password,
            to_email=para,
            cc_email=config.reply_cc_email,
            subject_template=config.reply_subject or "Factura {numero}",
            body_template=config.reply_body or "Adjunto la factura {numero}.",
            pdf_path=pdf_path,
            invoice_vars={
                "numero": payload.get("numero_factura", "") or invoice.number,
                "fecha": payload.get("fecha_factura", "") or invoice.date.strftime("%d/%m/%Y"),
                "total": f"{float(payload.get('total', invoice.total) or 0):.2f}",
                "cliente": payload.get("cliente", {}).get("nombre", "") or invoice.client_name,
                "concepto": payload.get("concepto_mes", ""),
            },
        )
    except Exception as e:
        logger.error("automation_approve: fallo enviando la factura %s — %s", invoice.id, e)
        invoice.send_error = str(e)
        return {"ok": False, "message": str(e)}

    if resultado["ok"]:
        invoice.sent_at = datetime.now(timezone.utc)
        invoice.sent_to = para
        invoice.send_error = None
    else:
        invoice.send_error = resultado["message"]
    return resultado
