from datetime import date, datetime
from typing import List, Optional

from pydantic import BaseModel


class InvoiceLineCreate(BaseModel):
    description: str
    quantity: float = 1.0
    unit_price: float
    vat_rate: float = 21.0


class InvoiceLineOut(BaseModel):
    model_config = {"from_attributes": True}

    id: int
    description: str
    quantity: float
    unit_price: float
    vat_rate: float
    line_total: float


class InvoiceCreate(BaseModel):
    number: Optional[str] = None   # auto-generado si None
    date: date
    due_date: Optional[date] = None
    client_name: str
    client_tax_id: Optional[str] = None
    client_address: Optional[str] = None
    payment_method: str = "Transferencia · 30 días"
    irpf_rate: float = 15.0
    lines: List[InvoiceLineCreate]


class InvoiceOut(BaseModel):
    model_config = {"from_attributes": True}

    id: int
    user_id: int
    number: str
    date: date
    due_date: Optional[date] = None
    client_name: str
    client_tax_id: Optional[str] = None
    client_address: Optional[str] = None
    payment_method: str
    subtotal: float
    vat_total: float
    irpf_total: float
    total: float
    pdf_path: Optional[str] = None
    created_at: datetime
    lines: List[InvoiceLineOut] = []
