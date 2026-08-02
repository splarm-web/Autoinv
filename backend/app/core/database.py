from sqlalchemy import create_engine, inspect, text
from sqlalchemy.orm import declarative_base, sessionmaker
from .config import settings

# Railway/Heroku entregan la URL como `postgres://`, pero SQLAlchemy
# requiere `postgresql://`. Normalizamos para evitar fallo al arrancar.
database_url = settings.database_url
if database_url.startswith("postgres://"):
    database_url = database_url.replace("postgres://", "postgresql://", 1)

_connect_args = {"check_same_thread": False} if "sqlite" in database_url else {}

engine = create_engine(database_url, connect_args=_connect_args)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def create_tables():
    # Importar los modelos aquí y no arriba evita el import circular
    # (models importa Base de este módulo) y, sobre todo, garantiza que
    # TODAS las tablas estén registradas en el metadata: si se depende de que
    # algún router los haya importado antes, una tabla nueva puede no crearse.
    from .. import models  # noqa: F401
    Base.metadata.create_all(bind=engine)


# Columnas añadidas tras la creación inicial de las tablas. Como no usamos
# Alembic, este migrador ligero las añade si faltan (idempotente, seguro en
# SQLite y PostgreSQL). Se ejecuta en cada arranque tras create_tables().
_COLUMN_MIGRATIONS = [
    ("users", "features", "VARCHAR DEFAULT 'gastos,facturas,clientes,export'"),
    ("users", "transporte_invoice_prefix", "VARCHAR DEFAULT 'A'"),
    ("invoices", "client_id", "INTEGER"),
    ("invoices", "kind", "VARCHAR DEFAULT 'standard'"),
    ("invoices", "extra_json", "VARCHAR DEFAULT '{}'"),
    ("clients", "email", "VARCHAR"),
    # Constancia del envío por email de una factura
    ("invoices", "sent_at", "TIMESTAMP"),
    ("invoices", "sent_to", "VARCHAR"),
    ("invoices", "send_error", "VARCHAR"),
    # Automatización de email: campos añadidos tras la primera versión del modelo
    ("email_automations", "attachment_filter", "VARCHAR"),
    ("email_automations", "client_id", "INTEGER"),
    ("email_automations", "fecha_origen", "VARCHAR DEFAULT 'fin_de_mes'"),
    ("email_automations", "default_cabeza", "VARCHAR"),
    ("email_automations", "default_cisterna", "VARCHAR"),
    ("email_automations", "require_validation", "BOOLEAN DEFAULT TRUE"),
    ("email_automations", "notify_push", "BOOLEAN DEFAULT TRUE"),
    ("email_automations", "send_on_approve", "BOOLEAN DEFAULT FALSE"),
    ("email_automations", "reply_cc_email", "VARCHAR"),
    ("pending_invoices", "attachment_name", "VARCHAR"),
    ("pending_invoices", "numero_factura", "VARCHAR"),
    ("pending_invoices", "total", "VARCHAR"),
    ("pending_invoices", "warnings_json", "VARCHAR"),
]


def ensure_schema(target_engine=None):
    """Añade columnas que falten en tablas existentes (mini-migración)."""
    eng = target_engine or engine
    insp = inspect(eng)
    tables = set(insp.get_table_names())
    with eng.begin() as conn:
        for table, column, ddl in _COLUMN_MIGRATIONS:
            if table not in tables:
                continue
            existing = {c["name"] for c in insp.get_columns(table)}
            if column not in existing:
                conn.execute(text(f"ALTER TABLE {table} ADD COLUMN {column} {ddl}"))
