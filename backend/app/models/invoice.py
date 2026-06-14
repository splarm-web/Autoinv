from sqlalchemy import Column, Date, DateTime, Float, ForeignKey, Integer, String, func
from sqlalchemy.orm import relationship
from ..core.database import Base


class Invoice(Base):
    __tablename__ = "invoices"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)

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

    pdf_path = Column(String)
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
