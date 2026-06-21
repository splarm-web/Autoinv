from typing import List

from pydantic import BaseModel


class BarData(BaseModel):
    label: str
    ingreso: float
    gasto: float


class MovementItem(BaseModel):
    id: int
    tipo: str          # "ingreso" | "gasto"
    concepto: str
    meta: str          # "12 jun · Ingreso"
    importe: float     # positivo siempre; tipo indica el signo


class DashboardOut(BaseModel):
    ingresos: float
    gastos: float
    neto: float
    iva_rep: float
    iva_sop: float
    iva_liquidar: float
    irpf_ret: float          # IRPF retenido en facturas del periodo
    ingreso_neto: float      # ingresos (base) − IRPF retenido
    bars: List[BarData]
    periodo: str
    periodo_label: str
    movimientos: List[MovementItem]
