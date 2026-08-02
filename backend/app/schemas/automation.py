"""Schemas Pydantic del módulo de automatización de email."""

from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel


# ── Configuración ──


class AutomationConfigIn(BaseModel):
    """Datos del formulario de configuración."""
    imap_email: Optional[str] = None
    # Solo se manda al crearla o al cambiarla; vacío = conservar la guardada
    imap_app_password: Optional[str] = None

    sender_filter: Optional[str] = None
    subject_filter: Optional[str] = None
    attachment_filter: Optional[str] = None

    invoice_kind: str = "transporte"
    client_id: Optional[int] = None
    fecha_origen: str = "fin_de_mes"
    default_cabeza: Optional[str] = None
    default_cisterna: Optional[str] = None

    require_validation: bool = True
    notify_push: bool = True

    send_on_approve: bool = False
    reply_to_email: Optional[str] = None
    reply_cc_email: Optional[str] = None
    reply_subject: str = "Factura {numero} — {fecha}"
    reply_body: str = "Adjunto la factura {numero} por importe de {total} €.\n\nUn saludo."

    poll_interval_minutes: int = 5


class AutomationConfigOut(BaseModel):
    """Configuración tal como la ve el frontend (nunca incluye la contraseña)."""
    model_config = {"from_attributes": True}

    id: int
    enabled: bool

    imap_email: Optional[str] = None
    has_password: bool = False

    sender_filter: Optional[str] = None
    subject_filter: Optional[str] = None
    attachment_filter: Optional[str] = None

    invoice_kind: str = "transporte"
    client_id: Optional[int] = None
    fecha_origen: str = "fin_de_mes"
    default_cabeza: Optional[str] = None
    default_cisterna: Optional[str] = None

    require_validation: bool = True
    notify_push: bool = True

    send_on_approve: bool = False
    reply_to_email: Optional[str] = None
    reply_cc_email: Optional[str] = None
    reply_subject: Optional[str] = None
    reply_body: Optional[str] = None
    # Destinatario que se usaría ahora mismo (config o email del cliente)
    destinatario_efectivo: Optional[str] = None

    poll_interval_minutes: int = 5
    last_poll_at: Optional[datetime] = None
    last_error: Optional[str] = None

    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None


class AutomationToggle(BaseModel):
    enabled: bool


class AutomationTestIn(BaseModel):
    """Prueba de conexión. Si no se manda contraseña, se usa la guardada."""
    imap_email: Optional[str] = None
    imap_app_password: Optional[str] = None


class AutomationTestResult(BaseModel):
    ok: bool
    message: str
    mailbox_count: int = 0


class FilterPreviewIn(BaseModel):
    """Prueba de filtros sobre los últimos correos del buzón."""
    sender_filter: Optional[str] = None
    subject_filter: Optional[str] = None
    attachment_filter: Optional[str] = None


class FilterPreviewItem(BaseModel):
    from_: Optional[str] = None
    subject: Optional[str] = None
    date: Optional[datetime] = None
    matches: bool
    reason: str


# ── Facturas pendientes ──


class PendingInvoiceOut(BaseModel):
    """Factura pendiente en el listado."""
    model_config = {"from_attributes": True}

    id: int
    email_from: Optional[str] = None
    email_subject: Optional[str] = None
    email_date: Optional[datetime] = None
    attachment_name: Optional[str] = None
    invoice_kind: str
    numero_factura: Optional[str] = None
    # Numérico: el formato con separadores (1.039,20 €) lo pone el frontend,
    # que ya tiene el helper de moneda en español
    total: Optional[float] = None
    status: str
    warnings: List[str] = []
    created_at: Optional[datetime] = None
    num_viajes: int = 0


class PendingInvoiceDetail(PendingInvoiceOut):
    """Detalle: añade el payload completo ya compuesto."""
    invoice_data: Optional[dict] = None
    invoice_id: Optional[int] = None
    approved_at: Optional[datetime] = None
    sent_at: Optional[datetime] = None
    send_error: Optional[str] = None


# ── Estado ──


class AutomationStatusOut(BaseModel):
    configured: bool
    enabled: bool
    last_poll_at: Optional[datetime] = None
    last_error: Optional[str] = None
    pending_count: int = 0
    # Minutos desde la última revisión y si eso ya es demasiado. Se calcula en
    # el servidor: el reloj del móvil puede ir desviado y daría falsos avisos.
    minutes_since_poll: Optional[int] = None
    poll_stale: bool = False
    push_available: bool = False
    vapid_public_key: Optional[str] = None


# ── Diagnóstico ──


class ChequeoOut(BaseModel):
    """Un eslabón de la cadena, con qué hacer si está roto."""
    clave: str
    titulo: str
    estado: str          # "ok" | "aviso" | "error"
    detalle: str
    ayuda: Optional[str] = None


class DiagnosticoOut(BaseModel):
    chequeos: List[ChequeoOut]
    todo_ok: bool


# ── Push ──


class PushSubscriptionIn(BaseModel):
    endpoint: str
    p256dh: str
    auth: str
    user_agent: Optional[str] = None
