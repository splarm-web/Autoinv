from datetime import datetime
from typing import Optional

from pydantic import BaseModel, EmailStr


class UserCreate(BaseModel):
    email: EmailStr
    password: str
    legal_name: Optional[str] = None


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class UserOut(BaseModel):
    model_config = {"from_attributes": True}

    id: int
    email: str
    legal_name: Optional[str] = None
    nif: Optional[str] = None
    address: Optional[str] = None
    default_vat: float
    irpf_rate: float
    invoice_number_format: str
    created_at: datetime


class UserUpdate(BaseModel):
    legal_name: Optional[str] = None
    nif: Optional[str] = None
    address: Optional[str] = None
    default_vat: Optional[float] = None
    irpf_rate: Optional[float] = None
    invoice_number_format: Optional[str] = None


class TokenOut(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut
