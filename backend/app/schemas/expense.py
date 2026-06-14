from datetime import date, datetime
from typing import Optional

from pydantic import BaseModel


class ExpenseCreate(BaseModel):
    date: date
    amount: float
    vat_rate: float = 21.0
    vat_amount: Optional[float] = None
    supplier: Optional[str] = None
    concept: Optional[str] = None
    category: Optional[str] = None
    source: str = "manual"


class ExpenseUpdate(BaseModel):
    date: Optional[date] = None
    amount: Optional[float] = None
    vat_rate: Optional[float] = None
    vat_amount: Optional[float] = None
    supplier: Optional[str] = None
    concept: Optional[str] = None
    category: Optional[str] = None


class ExpenseOut(BaseModel):
    model_config = {"from_attributes": True}

    id: int
    user_id: int
    date: date
    amount: float
    vat_rate: float
    vat_amount: Optional[float] = None
    supplier: Optional[str] = None
    concept: Optional[str] = None
    category: Optional[str] = None
    source: str
    file_path: Optional[str] = None
    created_at: datetime


class OcrResult(BaseModel):
    """Datos extraídos por Claude Vision de un ticket/factura."""

    date: Optional[date] = None
    amount: Optional[float] = None
    vat_rate: Optional[float] = None
    vat_amount: Optional[float] = None
    supplier: Optional[str] = None
    concept: Optional[str] = None
    category: Optional[str] = None
