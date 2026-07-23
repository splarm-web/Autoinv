from sqlalchemy import Column, DateTime, Float, Integer, String, func
from ..core.database import Base

# Funciones disponibles. Cada usuario tiene una lista (CSV en `features`).
# Funciones siempre disponibles (no se filtran): dashboard, settings.
DEFAULT_FEATURES = "gastos,facturas,clientes,export"

# Catálogo de features asignables (clave + etiqueta para el panel admin)
FEATURE_CATALOG = [
    {"key": "gastos", "label": "Gastos"},
    {"key": "facturas", "label": "Facturas estándar"},
    {"key": "transporte", "label": "Facturas de transporte"},
    {"key": "clientes", "label": "Clientes"},
    {"key": "export", "label": "Exportar"},
    {"key": "admin", "label": "Administración"},
]


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True, nullable=False)
    password_hash = Column(String, nullable=False)

    # Datos fiscales
    legal_name = Column(String)
    nif = Column(String)
    address = Column(String)
    default_vat = Column(Float, default=21.0)
    irpf_rate = Column(Float, default=15.0)
    invoice_number_format = Column(String, default="YYYY-NNN")
    # Prefijo del nº de factura de transporte (Alfredo): p.ej. "A" → "A2" en febrero
    transporte_invoice_prefix = Column(String, default="A")

    # Funcionalidades activadas por usuario (CSV: "gastos,facturas,transporte,…")
    features = Column(String, default=DEFAULT_FEATURES, nullable=False)

    # Extensible sin migraciones
    settings_json = Column(String, default="{}")

    created_at = Column(DateTime(timezone=True), server_default=func.now())
