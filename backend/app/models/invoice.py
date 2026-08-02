from sqlalchemy import Column, Date, DateTime, Float, ForeignKey, Integer, String, func
from sqlalchemy.orm import relationship
from ..core.database import Base


class Invoice(Base):
    __tablename__ = "invoices"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    client_id = Column(Integer, ForeignKey("clients.id"), nullable=True, index=True)

    number = Column(String, nullable=False)
    date = Column(Date, nullable=False)
    due_date = Column(Date)

    client_name = Column(String, nullable=False)
    client_tax_id = Column(String)
    client_address = Column(String)
    payment_method = Column(String, default="Transferencia · 30 días")

    subtotal = Column(Float, nullable=False)
    vat_total = Column(Float, nullable=False)
    irpf_total = Column(Float, default=0.0)      # retención (positivo, se resta)
    total = Column(Float, nullable=False)         # subtotal + vat - irpf

    # Tipo de factura: "standard" (diseño minimal) o "transporte" (diseño alfredo)
    kind = Column(String, default="standard", nullable=False)
    # Datos específicos del tipo (p.ej. viajes/cabeza/cisterna en transporte), JSON
    extra_json = Column(String, default="{}")

    pdf_path = Column(String)

    # Constancia del envío por email: a quién y cuándo se mandó, o por qué
    # falló. Vive en la factura y no solo en la pendiente de automatización
    # porque es información fiscalmente relevante que hay que poder consultar
    # mucho después, desde el listado de facturas.
    sent_at = Column(DateTime(timezone=True))
    sent_to = Column(String)
    send_error = Column(String)

    created_at = Column(DateTime(timezone=True), server_default=func.now())

    lines = relationship(
        "InvoiceLine", back_populates="invoice", cascade="all, delete-orphan"
    )


class InvoiceLine(Base):
    __tablename__ = "invoice_lines"

    id = Column(Integer, primary_key=True, index=True)
    invoice_id = Column(Integer, ForeignKey("invoices.id"), nullable=False, index=True)

    description = Column(String, nullable=False)
    quantity = Column(Float, default=1.0)
    unit_price = Column(Float, nullable=False)
    vat_rate = Column(Float, default=21.0)
    line_total = Column(Float, nullable=False)   # quantity * unit_price

    invoice = relationship("Invoice", back_populates="lines")
