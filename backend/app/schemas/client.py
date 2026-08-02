from datetime import datetime
from typing import Optional
from pydantic import BaseModel


class ClientCreate(BaseModel):
    nombre: str
    cif: Optional[str] = None
    direccion: Optional[str] = None
    ciudad: Optional[str] = None
    email: Optional[str] = None
    notas: Optional[str] = None
    is_default: bool = False


class ClientUpdate(BaseModel):
    nombre: Optional[str] = None
    cif: Optional[str] = None
    direccion: Optional[str] = None
    ciudad: Optional[str] = None
    email: Optional[str] = None
    notas: Optional[str] = None
    is_default: Optional[bool] = None


class ClientOut(BaseModel):
    model_config = {"from_attributes": True}

    id: int
    nombre: str
    cif: Optional[str] = None
    direccion: Optional[str] = None
    ciudad: Optional[str] = None
    email: Optional[str] = None
    notas: Optional[str] = None
    is_default: bool
    created_at: datetime
