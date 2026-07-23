"""Genera un ZIP con justificantes + PDFs de facturas + CSV resumen del periodo.

Acepta una lista de rangos de fechas (p.ej. varios trimestres); incluye los
movimientos cuya fecha caiga en CUALQUIERA de ellos. Los PDF de facturas se
generan al vuelo (no dependen de que se hayan descargado antes).
"""

import csv
import io
import zipfile
from datetime import date
from typing import List, Tuple

from sqlalchemy import and_, or_
from sqlalchemy.orm import Session

from ..core.config import settings
from ..models.expense import Expense
from ..models.invoice import Invoice
from ..models.user import User
from . import invoice_pdf

Range = Tuple[date, date]


def _date_in_ranges(model, ranges: List[Range]):
    """Condición SQL: model.date dentro de alguno de los rangos."""
    return or_(*[and_(model.date >= s, model.date <= e) for s, e in ranges])


def build_export_zip(
    db: Session, user: User, ranges: List[Range], scope: str = "todo"
) -> io.BytesIO:
    """Arma el ZIP del periodo.

    `scope` acota qué se incluye:
      - "facturas": solo PDFs de facturas
      - "gastos":   solo los justificantes originales subidos
      - "todo":     ambos
    El resumen.csv se filtra al mismo ámbito.
    """
    want_gastos = scope in ("gastos", "todo")
    want_facturas = scope in ("facturas", "todo")

    expenses = (
        db.query(Expense)
        .filter(Expense.user_id == user.id, _date_in_ranges(Expense, ranges))
        .order_by(Expense.date)
        .all()
    ) if want_gastos else []
    invoices = (
        db.query(Invoice)
        .filter(Invoice.user_id == user.id, _date_in_ranges(Invoice, ranges))
        .order_by(Invoice.date)
        .all()
    ) if want_facturas else []

    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
        # CSV resumen
        csv_buf = io.StringIO()
        writer = csv.writer(csv_buf)
        writer.writerow(["Tipo", "Fecha", "Concepto", "Proveedor/Cliente", "Importe", "IVA", "Categoría"])
        for exp in expenses:
            writer.writerow([
                "Gasto", exp.date, exp.concept or "", exp.supplier or "",
                exp.amount, exp.vat_amount or "", exp.category or "",
            ])
        for inv in invoices:
            writer.writerow([
                "Ingreso", inv.date, f"Factura {inv.number}", inv.client_name,
                inv.total, inv.vat_total, "",
            ])
        # utf-8-sig (con BOM): sin él, Excel en Windows abre el CSV como ANSI
        # y los acentos salen mal ("CategorÃ­a").
        zf.writestr("resumen.csv", csv_buf.getvalue().encode("utf-8-sig"))

        # Adjuntos de gastos
        for exp in expenses:
            if exp.file_path:
                src = settings.files_root / exp.file_path
                if src.exists():
                    zf.write(src, f"gastos/{src.name}")

        # PDFs de facturas (generados al vuelo)
        for inv in invoices:
            try:
                pdf_path = invoice_pdf.render_invoice_pdf(inv, user)
                safe_number = inv.number.replace("/", "-").replace("\\", "-")
                zf.write(pdf_path, f"facturas/Factura-{safe_number}.pdf")
            except Exception:
                # No abortar el export por una factura problemática
                continue

    buf.seek(0)
    return buf
