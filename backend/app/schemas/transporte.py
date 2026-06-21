from typing import List, Optional

from pydantic import BaseModel


class EmisorIn(BaseModel):
    nombre: str = ""
    nif: str = ""
    direccion: str = ""
    ciudad: str = ""
    telefono: str = ""


class ClienteIn(BaseModel):
    nombre: str = ""
    cif: str = ""
    direccion: str = ""
    ciudad: str = ""


class ViajeIn(BaseModel):
    fecha: Optional[str] = None   # ISO o texto
    viaje: str = ""
    kilos: float = 0.0            # en kg
    precio: float = 0.0


class TransporteInvoiceIn(BaseModel):
    emisor: EmisorIn
    cliente: ClienteIn
    numero_factura: str = "A-1"
    fecha_factura: str = ""       # dd/mm/YYYY
    concepto_mes: str = ""        # "SEPTIEMBRE 2025"
    cabeza: str = ""
    cisterna: str = ""
    viajes: List[ViajeIn] = []
