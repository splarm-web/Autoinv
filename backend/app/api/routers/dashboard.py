from calendar import monthrange
from datetime import date
from typing import List, Tuple

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func
from sqlalchemy.orm import Session

from ...api.deps import get_current_user
from ...core.database import get_db
from ...models.expense import Expense
from ...models.invoice import Invoice
from ...models.user import User
from ...schemas.dashboard import (
    ChartBar,
    DashboardOut,
    MovementItem,
    ProximaDeclaracion,
)

router = APIRouter(prefix="/dashboard", tags=["dashboard"])

_MONTH_NAMES = [
    "", "Ene", "Feb", "Mar", "Abr", "May", "Jun",
    "Jul", "Ago", "Sep", "Oct", "Nov", "Dic",
]


def _month_range(year: int, month: int) -> Tuple[date, date]:
    last = monthrange(year, month)[1]
    return date(year, month, 1), date(year, month, last)


def _quarter_of(d: date) -> int:
    return (d.month - 1) // 3 + 1


def _quarter_range(year: int, q: int) -> Tuple[date, date]:
    first_month = (q - 1) * 3 + 1
    last_month = first_month + 2
    return date(year, first_month, 1), _month_range(year, last_month)[1]


def _quarter_deadline(year: int, q: int) -> date:
    """Fecha límite del trimestral (modelo 303/130)."""
    return {
        1: date(year, 4, 20),
        2: date(year, 7, 20),
        3: date(year, 10, 20),
        4: date(year + 1, 1, 30),
    }[q]


def _sum(db, model, col, uid, start, end):
    return float(
        db.query(func.coalesce(func.sum(col), 0))
        .filter(model.user_id == uid, model.date >= start, model.date <= end)
        .scalar()
    )


def _kpis(db: Session, uid: int, start: date, end: date):
    """(ingresos=Σ totales, gastos, iva_rep, iva_sop, irpf_ret) del rango."""
    ingresos = _sum(db, Invoice, Invoice.total, uid, start, end)
    iva_rep = _sum(db, Invoice, Invoice.vat_total, uid, start, end)
    irpf_ret = _sum(db, Invoice, Invoice.irpf_total, uid, start, end)
    gastos = _sum(db, Expense, Expense.amount, uid, start, end)
    iva_sop = float(
        db.query(func.coalesce(func.sum(Expense.vat_amount), 0))
        .filter(
            Expense.user_id == uid,
            Expense.date >= start,
            Expense.date <= end,
            Expense.vat_amount.isnot(None),
        )
        .scalar()
    )
    return ingresos, gastos, iva_rep, iva_sop, irpf_ret


def _chart_bar(db: Session, uid: int, start: date, end: date, label: str, quarter=None) -> ChartBar:
    ingresos, gastos, iva_rep, _, irpf_ret = _kpis(db, uid, start, end)
    return ChartBar(
        label=label,
        ingreso=round(ingresos, 2),
        ingreso_neto=round(ingresos - iva_rep - irpf_ret, 2),
        gasto=round(gastos, 2),
        quarter=quarter,
    )


def _fmt_day(d: date) -> str:
    return f"{d.day} {_MONTH_NAMES[d.month].lower()}"


def _recent_movements(db: Session, uid: int, limit: int = 10) -> List[MovementItem]:
    invoices = (
        db.query(Invoice).filter(Invoice.user_id == uid)
        .order_by(Invoice.date.desc()).limit(limit).all()
    )
    expenses = (
        db.query(Expense).filter(Expense.user_id == uid)
        .order_by(Expense.date.desc()).limit(limit).all()
    )
    items: List[Tuple[date, MovementItem]] = []
    for inv in invoices:
        concepto = f"Factura {inv.number}"
        if inv.client_name:
            concepto += f" · {inv.client_name}"
        items.append((inv.date, MovementItem(
            id=inv.id, tipo="ingreso", concepto=concepto,
            meta=f"{_fmt_day(inv.date)} · Ingreso", importe=inv.total,
        )))
    for exp in expenses:
        concepto = exp.concept or exp.supplier or "Gasto"
        cat = exp.category or "Gasto"
        items.append((exp.date, MovementItem(
            id=exp.id, tipo="gasto", concepto=concepto,
            meta=f"{_fmt_day(exp.date)} · {cat}", importe=exp.amount,
        )))
    items.sort(key=lambda t: t[0], reverse=True)
    return [m for _, m in items[:limit]]


@router.get("", response_model=DashboardOut)
def dashboard(
    periodo: str = Query("trimestre", pattern="^(mes|trimestre|anio)$"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    today = date.today()
    uid = current_user.id

    if periodo == "mes":
        start, end = _month_range(today.year, today.month)
        label = today.strftime("%B %Y").capitalize()
    elif periodo == "trimestre":
        q = _quarter_of(today)
        start, end = _quarter_range(today.year, q)
        first_m = (q - 1) * 3 + 1
        label = f"T{q} {today.year} · {_MONTH_NAMES[first_m].lower()}–{_MONTH_NAMES[first_m + 2].lower()}"
    else:  # anio
        start, end = date(today.year, 1, 1), date(today.year, 12, 31)
        label = f"Año {today.year}"

    ingresos, gastos, iva_rep, iva_sop, irpf_ret = _kpis(db, uid, start, end)

    # Próxima declaración: trimestre natural en curso (independiente del periodo)
    cq = _quarter_of(today)
    qs, qe = _quarter_range(today.year, cq)
    _, _, q_iva_rep, q_iva_sop, q_irpf = _kpis(db, uid, qs, qe)
    proxima = ProximaDeclaracion(
        trimestre=f"T{cq} {today.year}",
        fecha_limite=_quarter_deadline(today.year, cq),
        iva_liquidar=round(q_iva_rep - q_iva_sop, 2),
        irpf_retenido=round(q_irpf, 2),
    )

    return DashboardOut(
        ingresos=ingresos,
        gastos=gastos,
        neto=round(ingresos - gastos, 2),
        ingreso_neto=round(ingresos - iva_rep - irpf_ret, 2),
        iva_rep=iva_rep,
        iva_sop=iva_sop,
        iva_liquidar=round(iva_rep - iva_sop, 2),
        irpf_ret=irpf_ret,
        proxima_declaracion=proxima,
        periodo=periodo,
        periodo_label=label,
        movimientos=_recent_movements(db, uid),
    )


@router.get("/chart", response_model=List[ChartBar])
def chart(
    view: str = Query("meses", pattern="^(meses|anios)$"),
    year: int = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Datos del gráfico, independiente del periodo de los KPIs.

    - meses: 12 barras (ene-dic) del año dado, con `quarter` para agrupar.
    - anios: últimos 5 años, una barra por año.
    """
    uid = current_user.id
    today = date.today()

    if view == "anios":
        bars = []
        for y in range(today.year - 4, today.year + 1):
            s, e = date(y, 1, 1), date(y, 12, 31)
            bars.append(_chart_bar(db, uid, s, e, str(y)))
        return bars

    # meses
    y = year or today.year
    bars = []
    for m in range(1, 13):
        s, e = _month_range(y, m)
        bars.append(_chart_bar(db, uid, s, e, _MONTH_NAMES[m], quarter=(m - 1) // 3 + 1))
    return bars
