"""Envío de la factura por email, con el PDF adjunto.

Dos transportes, se elige solo:

  · **Brevo (HTTPS)** si hay `BREVO_API_KEY`. Es el que funciona en Render:
    su plan gratuito bloquea el tráfico saliente a los puertos SMTP (25, 465
    y 587) desde el 26/09/2025, así que por SMTP el envío falla siempre con
    "Network is unreachable" y no hay nada que arreglar en el código. El 443
    de HTTPS no está bloqueado.
  · **SMTP directo** si no hay clave. Sirve en local y en cualquier host que
    no bloquee esos puertos.

El contrato es el mismo en ambos: devuelven {"ok": bool, "message": str} y
nunca lanzan, porque un fallo de envío no debe tumbar la aprobación.
"""

import base64
import logging
import smtplib
from email.mime.application import MIMEApplication
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from pathlib import Path

from ..core.config import settings

logger = logging.getLogger(__name__)

_BREVO_URL = "https://api.brevo.com/v3/smtp/email"
_TIMEOUT = 30


def _render_template(template: str, variables: dict) -> str:
    """Sustituye {variables} en un texto. Deja intactas las que no conozca."""
    result = template
    for key, value in variables.items():
        result = result.replace(f"{{{key}}}", str(value))
    return result


def transporte_en_uso() -> str:
    return "brevo" if settings.brevo_api_key else "smtp"


def send_invoice_email(
    smtp_email: str,
    smtp_app_password: str,
    to_email: str,
    subject_template: str,
    body_template: str,
    pdf_path: str | Path,
    invoice_vars: dict,
    cc_email: str | None = None,
    sender_name: str | None = None,
) -> dict:
    """Manda la factura al destinatario. Devuelve {"ok", "message"}."""
    subject = _render_template(subject_template, invoice_vars)
    body = _render_template(body_template, invoice_vars)
    pdf_path = Path(pdf_path)

    if not pdf_path.exists():
        return {"ok": False, "message": f"PDF no encontrado: {pdf_path}"}
    if not to_email:
        return {"ok": False, "message": "No hay destinatario"}

    if settings.brevo_api_key:
        return _enviar_por_brevo(
            remitente=smtp_email, nombre_remitente=sender_name,
            destinatario=to_email, copia=cc_email,
            asunto=subject, cuerpo=body, pdf_path=pdf_path,
        )
    return _enviar_por_smtp(
        smtp_email=smtp_email, password=smtp_app_password,
        destinatario=to_email, copia=cc_email,
        asunto=subject, cuerpo=body, pdf_path=pdf_path,
    )


# ── Brevo (HTTPS) ──


def _enviar_por_brevo(remitente, nombre_remitente, destinatario, copia,
                      asunto, cuerpo, pdf_path: Path) -> dict:
    import requests

    payload = {
        "sender": {"email": remitente},
        "to": [{"email": destinatario}],
        "subject": asunto,
        "textContent": cuerpo,
        "attachment": [{
            "name": pdf_path.name,
            "content": base64.b64encode(pdf_path.read_bytes()).decode(),
        }],
    }
    if nombre_remitente:
        payload["sender"]["name"] = nombre_remitente
    if copia:
        payload["cc"] = [{"email": copia}]

    try:
        r = requests.post(
            _BREVO_URL,
            headers={"api-key": settings.brevo_api_key,
                     "content-type": "application/json",
                     "accept": "application/json"},
            json=payload,
            timeout=_TIMEOUT,
        )
    except Exception as e:
        error = f"No se pudo contactar con el servicio de envío: {e}"
        logger.error("email_sender: %s", error)
        return {"ok": False, "message": error}

    if r.status_code in (200, 201, 202):
        logger.info("email_sender: factura enviada a %s vía Brevo", destinatario)
        return {"ok": True, "message": f"Email enviado a {destinatario}"}

    return {"ok": False, "message": _error_brevo(r, remitente)}


def _error_brevo(r, remitente: str) -> str:
    """Traduce el error de Brevo a algo accionable.

    Los dos fallos de configuración habituales tienen mensajes crípticos, y
    sin explicarlos el usuario no tiene forma de saber qué le falta.
    """
    try:
        detalle = r.json()
        codigo = detalle.get("code", "")
        mensaje = detalle.get("message", r.text[:200])
    except Exception:
        codigo, mensaje = "", r.text[:200]

    if r.status_code == 401:
        return ("La clave del servicio de envío no es válida "
                "(revisa BREVO_API_KEY en el servidor)")
    if codigo == "unauthorized" or "sender" in mensaje.lower():
        return (f"El remitente {remitente} no está verificado en Brevo: "
                "añádelo y confírmalo en Remitentes antes de enviar")
    error = f"El servicio de envío rechazó el correo ({r.status_code}): {mensaje}"
    logger.error("email_sender: %s", error)
    return error


# ── SMTP directo ──


def _enviar_por_smtp(smtp_email, password, destinatario, copia,
                     asunto, cuerpo, pdf_path: Path) -> dict:
    try:
        msg = MIMEMultipart()
        msg["From"] = smtp_email
        msg["To"] = destinatario
        if copia:
            msg["Cc"] = copia
        msg["Subject"] = asunto
        msg.attach(MIMEText(cuerpo, "plain", "utf-8"))

        adjunto = MIMEApplication(pdf_path.read_bytes(), _subtype="pdf")
        adjunto.add_header("Content-Disposition", "attachment", filename=pdf_path.name)
        msg.attach(adjunto)

        with smtplib.SMTP("smtp.gmail.com", 587, timeout=_TIMEOUT) as server:
            server.ehlo()
            server.starttls()
            server.ehlo()
            server.login(smtp_email, password)
            server.send_message(msg)

        logger.info("email_sender: factura enviada a %s vía SMTP", destinatario)
        return {"ok": True, "message": f"Email enviado a {destinatario}"}

    except smtplib.SMTPAuthenticationError as e:
        error = f"Error de autenticación SMTP: {e}"
        logger.error("email_sender: %s", error)
        return {"ok": False, "message": error}
    except OSError as e:
        # Errno 101 en Render: el plan gratuito bloquea los puertos SMTP.
        # Sin esta explicación, "Network is unreachable" no dice nada.
        error = (f"No se pudo conectar con el servidor de correo ({e}). "
                 "Si el servidor bloquea los puertos SMTP, configura "
                 "BREVO_API_KEY para enviar por HTTPS.")
        logger.error("email_sender: %s", error)
        return {"ok": False, "message": error}
    except Exception as e:
        error = f"Error al enviar email: {e}"
        logger.error("email_sender: %s", error)
        return {"ok": False, "message": error}
