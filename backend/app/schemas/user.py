from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, EmailStr, field_validator


class UserCreate(BaseModel):
    email: EmailStr
    password: str
    legal_name: Optional[str] = None


class UserLogin(BaseModel):
    email: str  # admite usuario plano ("sergio") o email
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
    features: List[str] = []
    created_at: datetime

    @field_validator("features", mode="before")
    @classmethod
    def _split_features(cls, v):
        if isinstance(v, str):
            return [f for f in v.split(",") if f]
        return v or []


class UserUpdate(BaseModel):
    legal_name: Optional[str] = None
    nif: Optional[str] = None
    address: Optional[str] = None
    default_vat: Optional[float] = None
    irpf_rate: Optional[float] = None
    invoice_number_format: Optional[str] = None


class FeaturesUpdate(BaseModel):
    features: List[str]


class TokenOut(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut
