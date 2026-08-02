"""Envío de emails con factura PDF adjunta vía SMTP (Gmail).

Usa las mismas credenciales que el reader (IMAP) para enviar por SMTP.
"""

import logging
import smtplib
from email.mime.application import MIMEApplication
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from pathlib import Path

logger = logging.getLogger(__name__)


def _render_template(template: str, variables: dict) -> str:
    """Reemplaza variables {nombre} en un template de texto.

    Variables soportadas: {numero}, {fecha}, {total}
    No falla si una variable no existe — la deja tal cual.
    """
    result = template
    for key, value in variables.items():
        result = result.replace(f"{{{key}}}", str(value))
    return result


def send_invoice_email(
    smtp_email: str,
    smtp_app_password: str,
    to_email: str,
    subject_template: str,
    body_template: str,
    pdf_path: str | Path,
    invoice_vars: dict,
    cc_email: str | None = None,
) -> dict:
    """Envía un email con el PDF de la factura adjunto.

    Args:
        smtp_email: email de Gmail del emisor (mismo que IMAP)
        smtp_app_password: App Password descifrada
        to_email: destinatario
        subject_template: asunto con variables {numero}, {fecha}, {total}
        body_template: cuerpo con variables
        pdf_path: ruta al fichero PDF a adjuntar
        invoice_vars: dict con claves {numero, fecha, total} para los templates

    Returns:
        {"ok": True/False, "message": str}
    """
    subject = _render_template(subject_template, invoice_vars)
    body = _render_template(body_template, invoice_vars)
    pdf_path = Path(pdf_path)

    if not pdf_path.exists():
        return {"ok": False, "message": f"PDF no encontrado: {pdf_path}"}

    try:
        # Construir el mensaje
        msg = MIMEMultipart()
        msg["From"] = smtp_email
        msg["To"] = to_email
        if cc_email:
            msg["Cc"] = cc_email
        msg["Subject"] = subject

        # Cuerpo del mensaje
        msg.attach(MIMEText(body, "plain", "utf-8"))

        # Adjuntar PDF
        with open(pdf_path, "rb") as f:
            pdf_data = f.read()
        pdf_part = MIMEApplication(pdf_data, _subtype="pdf")
        pdf_filename = pdf_path.name
        pdf_part.add_header(
            "Content-Disposition", "attachment", filename=pdf_filename,
        )
        msg.attach(pdf_part)

        # Enviar vía SMTP de Gmail
        with smtplib.SMTP("smtp.gmail.com", 587) as server:
            server.ehlo()
            server.starttls()
            server.ehlo()
            server.login(smtp_email, smtp_app_password)
            server.send_message(msg)

        logger.info(f"email_sender: factura enviada a {to_email}")
        return {"ok": True, "message": f"Email enviado a {to_email}"}

    except smtplib.SMTPAuthenticationError as e:
        msg_err = f"Error de autenticación SMTP: {e}"
        logger.error(f"email_sender: {msg_err}")
        return {"ok": False, "message": msg_err}
    except Exception as e:
        msg_err = f"Error al enviar email: {e}"
        logger.error(f"email_sender: {msg_err}")
        return {"ok": False, "message": msg_err}
