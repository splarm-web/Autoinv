from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, String, func
from ..core.database import Base


class Client(Base):
    __tablename__ = "clients"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)

    nombre = Column(String, nullable=False)
    cif = Column(String)
    direccion = Column(String)
    ciudad = Column(String)
    # Destinatario por defecto al enviar facturas por email (automatización)
    email = Column(String)
    notas = Column(String)
    is_default = Column(Boolean, default=False, nullable=False)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
