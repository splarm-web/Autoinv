"""Modelos para la automatización de email.

EmailAutomation — configuración de la conexión Gmail por usuario.
PendingInvoice — facturas generadas automáticamente pendientes de validación.
"""

from sqlalchemy import (
    Boolean, Column, DateTime, ForeignKey, Integer, String, Text, func,
)
from sqlalchemy.orm import relationship
from ..core.database import Base


class EmailAutomation(Base):
    """Configuración de la automatización de email (1 por usuario)."""
    __tablename__ = "email_automations"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, unique=True, index=True)

    enabled = Column(Boolean, default=False, nullable=False)

    # ── Conexión IMAP (lectura de Gmail) ──
    imap_email = Column(String, nullable=True)
    imap_app_password_enc = Column(String, nullable=True)  # cifrada con Fernet

    # ── Filtros de entrada (todos opcionales, se combinan con Y) ──
    # Además de estos, siempre se exige que el adjunto sea Excel y que al
    # parsearlo salga al menos un viaje: ese es el filtro realmente fiable.
    sender_filter = Column(String, nullable=True)      # el remitente contiene…
    subject_filter = Column(String, nullable=True)     # el asunto contiene…
    attachment_filter = Column(String, nullable=True)  # el nombre del adjunto contiene…

    # ── Datos que el Excel no trae y hay que fijar en la configuración ──
    invoice_kind = Column(String, default="transporte", nullable=False)
    client_id = Column(Integer, ForeignKey("clients.id"), nullable=True)
    # "fin_de_mes" (último día del mes de los viajes) | "recepcion" (fecha del correo)
    fecha_origen = Column(String, default="fin_de_mes", nullable=False)
    default_cabeza = Column(String, nullable=True)
    default_cisterna = Column(String, nullable=True)

    # ── Qué pasa cuando entra una factura ──
    # Si es False, la factura se aprueba sola (salvo que haya avisos: número
    # duplicado o datos obligatorios incompletos, que siempre caen a pendiente).
    require_validation = Column(Boolean, default=True, nullable=False)
    notify_push = Column(Boolean, default=True, nullable=False)

    # ── Envío de la factura ──
    send_on_approve = Column(Boolean, default=False, nullable=False)
    # Vacío ⇒ se usa el email del cliente seleccionado
    reply_to_email = Column(String, nullable=True)
    reply_cc_email = Column(String, nullable=True)
    reply_subject = Column(
        String, nullable=True,
        default="Factura {numero} — {fecha}",
    )
    reply_body = Column(
        Text, nullable=True,
        default="Adjunto la factura {numero} por importe de {total} €.\n\nUn saludo.",
    )

    # ── Polling ──
    poll_interval_minutes = Column(Integer, default=5, nullable=False)
    last_poll_at = Column(DateTime(timezone=True), nullable=True)
    last_error = Column(Text, nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    # Relaciones
    client = relationship("Client")
    pending_invoices = relationship(
        "PendingInvoice", back_populates="automation", cascade="all, delete-orphan",
    )


class PendingInvoice(Base):
    """Factura generada automáticamente, pendiente de validación del usuario."""
    __tablename__ = "pending_invoices"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    automation_id = Column(Integer, ForeignKey("email_automations.id"), nullable=False, index=True)

    # Origen del email
    email_from = Column(String, nullable=True)
    email_subject = Column(String, nullable=True)
    email_date = Column(DateTime(timezone=True), nullable=True)
    email_uid = Column(String, nullable=True)  # UID del mensaje IMAP (evita reprocesar)
    attachment_name = Column(String, nullable=True)

    # Datos generados. `invoice_data_json` guarda el payload COMPLETO ya
    # compuesto (emisor + cliente + número + viajes), no solo lo del Excel:
    # así el PDF que ve el usuario es exactamente el que se guardará, y que
    # luego cambie la configuración no altera lo que ya está pendiente.
    invoice_kind = Column(String, default="transporte", nullable=False)
    invoice_data_json = Column(Text, nullable=False)
    numero_factura = Column(String, nullable=True)
    total = Column(String, nullable=True)   # texto formateado, solo para el listado
    pdf_path = Column(String, nullable=True)
    excel_path = Column(String, nullable=True)

    # Avisos que impiden la aprobación automática (JSON con lista de textos)
    warnings_json = Column(Text, nullable=True)

    # Estado del flujo: pending → approved/rejected
    status = Column(String, default="pending", nullable=False, index=True)
    invoice_id = Column(Integer, ForeignKey("invoices.id"), nullable=True)

    approved_at = Column(DateTime(timezone=True), nullable=True)
    sent_at = Column(DateTime(timezone=True), nullable=True)
    send_error = Column(Text, nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # Relaciones
    automation = relationship("EmailAutomation", back_populates="pending_invoices")


class PushSubscription(Base):
    """Suscripción Web Push de un navegador/dispositivo concreto."""
    __tablename__ = "push_subscriptions"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)

    endpoint = Column(String, nullable=False, unique=True)
    p256dh = Column(String, nullable=False)
    auth = Column(String, nullable=False)
    user_agent = Column(String, nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
