from calendar import monthrange
from datetime import date, timedelta
from typing import List, Tuple

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func
from sqlalchemy.orm import Session

from ...api.deps import get_current_user
from ...core.database import get_db
from ...models.expense import Expense
from ...models.invoice import Invoice
from ...models.user import User
from ...schemas.dashboard import BarData, DashboardOut, MovementItem

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


def _kpis(
    db: Session, user_id: int, start: date, end: date
) -> Tuple[float, float, float, float]:
    """Returns (ingresos, gastos, iva_rep, iva_sop) for the date range.

    ingresos = suma de los TOTALES de las facturas (con impuestos).
    """
    ingresos = (
        db.query(func.coalesce(func.sum(Invoice.total), 0))
        .filter(Invoice.user_id == user_id, Invoice.date >= start, Invoice.date <= end)
        .scalar()
    )
    iva_rep = (
        db.query(func.coalesce(func.sum(Invoice.vat_total), 0))
        .filter(Invoice.user_id == user_id, Invoice.date >= start, Invoice.date <= end)
        .scalar()
    )
    gastos = (
        db.query(func.coalesce(func.sum(Expense.amount), 0))
        .filter(Expense.user_id == user_id, Expense.date >= start, Expense.date <= end)
        .scalar()
    )
    iva_sop = (
        db.query(func.coalesce(func.sum(Expense.vat_amount), 0))
        .filter(
            Expense.user_id == user_id,
            Expense.date >= start,
            Expense.date <= end,
            Expense.vat_amount.isnot(None),
        )
        .scalar()
    )
    return float(ingresos), float(gastos), float(iva_rep), float(iva_sop)


def _bars_mes(db: Session, user_id: int, year: int, month: int) -> List[BarData]:
    """4 semanas dentro del mes."""
    start, end = _month_range(year, month)
    bars = []
    cursor = start
    week = 1
    while cursor <= end:
        w_end = min(cursor + timedelta(days=6), end)
        ing, gas, _, _ = _kpis(db, user_id, cursor, w_end)
        bars.append(BarData(label=f"Sem {week}", ingreso=ing, gasto=gas))
        cursor = w_end + timedelta(days=1)
        week += 1
        if week > 4:
            # absorb remainder into sem 4
            if cursor <= end:
                ing2, gas2, _, _ = _kpis(db, user_id, cursor, end)
                bars[-1].ingreso += ing2
                bars[-1].gasto += gas2
            break
    return bars


def _bars_trimestre(db: Session, user_id: int, year: int, q: int) -> List[BarData]:
    first_month = (q - 1) * 3 + 1
    bars = []
    for m in range(first_month, first_month + 3):
        s, e = _month_range(year, m)
        ing, gas, _, _ = _kpis(db, user_id, s, e)
        bars.append(BarData(label=_MONTH_NAMES[m], ingreso=ing, gasto=gas))
    return bars


def _bars_anio(db: Session, user_id: int, year: int) -> List[BarData]:
    bars = []
    for q in range(1, 5):
        s, e = _quarter_range(year, q)
        ing, gas, _, _ = _kpis(db, user_id, s, e)
        bars.append(BarData(label=f"T{q}", ingreso=ing, gasto=gas))
    return bars


def _fmt_day(d: date) -> str:
    """Día + mes abreviado, cross-platform (strftime('%-d') no existe en Windows)."""
    return f"{d.day} {_MONTH_NAMES[d.month].lower()}"


def _recent_movements(db: Session, user_id: int, limit: int = 10) -> List[MovementItem]:
    invoices = (
        db.query(Invoice)
        .filter(Invoice.user_id == user_id)
        .order_by(Invoice.date.desc())
        .limit(limit)
        .all()
    )
    expenses = (
        db.query(Expense)
        .filter(Expense.user_id == user_id)
        .order_by(Expense.date.desc())
        .limit(limit)
        .all()
    )
    items: List[Tuple[date, MovementItem]] = []
    for inv in invoices:
        concepto = f"Factura {inv.number}"
        if inv.client_name:
            concepto += f" · {inv.client_name}"
        items.append((
            inv.date,
            MovementItem(
                id=inv.id,
                tipo="ingreso",
                concepto=concepto,
                meta=f"{_fmt_day(inv.date)} · Ingreso",
                importe=inv.total,
            ),
        ))
    for exp in expenses:
        concepto = exp.concept or exp.supplier or "Gasto"
        cat = exp.category or "Gasto"
        items.append((
            exp.date,
            MovementItem(
                id=exp.id,
                tipo="gasto",
                concepto=concepto,
                meta=f"{_fmt_day(exp.date)} · {cat}",
                importe=exp.amount,
            ),
        ))
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
        bars = _bars_mes(db, uid, today.year, today.month)

    elif periodo == "trimestre":
        q = _quarter_of(today)
        start, end = _quarter_range(today.year, q)
        first_m = (q - 1) * 3 + 1
        last_m = first_m + 2
        label = f"T{q} {today.year} · {_MONTH_NAMES[first_m].lower()}–{_MONTH_NAMES[last_m].lower()}"
        bars = _bars_trimestre(db, uid, today.year, q)

    else:  # anio
        start = date(today.year, 1, 1)
        end = date(today.year, 12, 31)
        label = f"Año {today.year}"
        bars = _bars_anio(db, uid, today.year)

    ingresos, gastos, iva_rep, iva_sop = _kpis(db, uid, start, end)

    irpf_ret = float(
        db.query(func.coalesce(func.sum(Invoice.irpf_total), 0))
        .filter(Invoice.user_id == uid, Invoice.date >= start, Invoice.date <= end)
        .scalar()
    )

    return DashboardOut(
        ingresos=ingresos,
        gastos=gastos,
        neto=ingresos - gastos,
        iva_rep=iva_rep,
        iva_sop=iva_sop,
        iva_liquidar=iva_rep - iva_sop,
        irpf_ret=irpf_ret,
        ingreso_neto=ingresos - iva_rep - irpf_ret,
        bars=bars,
        periodo=periodo,
        periodo_label=label,
        movimientos=_recent_movements(db, uid),
    )
