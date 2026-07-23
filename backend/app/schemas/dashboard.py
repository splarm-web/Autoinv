from datetime import date
from typing import List, Optional

from pydantic import BaseModel


class ChartBar(BaseModel):
    label: str
    ingreso: float          # total facturado (con impuestos)
    ingreso_neto: float     # ingreso − IVA (lo que queda tras apartar el IVA)
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
    iva_repercutido: float  # IVA cobrado en facturas del trimestre
    iva_soportado: float    # IVA de gastos del trimestre
    iva_liquidar: float     # repercutido − soportado = lo que ingresas (303)
    irpf_retenido: float    # IRPF ya adelantado por clientes (informativo)


class DashboardOut(BaseModel):
    ingresos: float
    gastos: float
    resultado: float             # caja real: ingresos − gastos − IVA a liquidar
    ingreso_neto: float          # ingresos − IVA (tras apartar el IVA)
    iva_rep: float
    iva_sop: float
    iva_liquidar: float
    irpf_ret: float
    proxima_declaracion: ProximaDeclaracion
    periodo: str
    periodo_label: str
    movimientos: List[MovementItem]
