from datetime import date
from typing import List, Optional

from pydantic import BaseModel


class ChartBar(BaseModel):
    label: str
    ingreso: float          # total facturado (con impuestos)
    ingreso_neto: float     # ingreso − IVA − IRPF
    gasto: float
    quarter: Optional[int] = None   # 1-4, para agrupar visualmente (vista meses)


class MovementItem(BaseModel):
    id: int
    tipo: str          # "ingreso" | "gasto"
    concepto: str
    meta: str          # "12 jun · Ingreso"
    importe: float     # positivo siempre; tipo indica el signo


class ProximaDeclaracion(BaseModel):
    trimestre: str          # "T2 2026"
    fecha_limite: date
    iva_liquidar: float     # IVA repercutido − soportado del trimestre
    irpf_retenido: float    # IRPF retenido en facturas del trimestre


class DashboardOut(BaseModel):
    ingresos: float
    gastos: float
    neto: float                  # ingresos − gastos (resultado del periodo)
    ingreso_neto: float          # ingresos − IVA − IRPF
    iva_rep: float
    iva_sop: float
    iva_liquidar: float
    irpf_ret: float
    proxima_declaracion: ProximaDeclaracion
    periodo: str
    periodo_label: str
    movimientos: List[MovementItem]
