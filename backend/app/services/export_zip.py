"""Genera un ZIP con justificantes + PDFs de facturas + CSV resumen del periodo."""

import csv
import io
import zipfile
from datetime import date
from pathlib import Path

from sqlalchemy.orm import Session

from ..core.config import settings
from ..models.expense import Expense
from ..models.invoice import Invoice
from ..models.user import User


def build_export_zip(
    db: Session, user: User, from_date: date, to_date: date
) -> io.BytesIO:
    expenses = (
        db.query(Expense)
        .filter(
            Expense.user_id == user.id,
            Expense.date >= from_date,
            Expense.date <= to_date,
        )
        .order_by(Expense.date)
        .all()
    )
    invoices = (
        db.query(Invoice)
        .filter(
            Invoice.user_id == user.id,
            Invoice.date >= from_date,
            Invoice.date <= to_date,
        )
        .order_by(Invoice.date)
        .all()
    )

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
        zf.writestr("resumen.csv", csv_buf.getvalue())

        # Adjuntos de gastos
        for exp in expenses:
            if exp.file_path:
                src = settings.files_root / exp.file_path
                if src.exists():
                    zf.write(src, f"gastos/{src.name}")

        # PDFs de facturas
        for inv in invoices:
            if inv.pdf_path:
                src = settings.files_root / inv.pdf_path
                if src.exists():
                    zf.write(src, f"facturas/{src.name}")

    buf.seek(0)
    return buf
