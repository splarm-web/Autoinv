"""Genera un ZIP con los documentos del periodo: PDFs de facturas y/o los
justificantes de gastos subidos por el usuario.

Acepta una lista de rangos de fechas (p.ej. varios trimestres); incluye los
movimientos cuya fecha caiga en CUALQUIERA de ellos. Los PDF de facturas se
generan al vuelo (no dependen de que se hayan descargado antes).
"""

import io
import re
import unicodedata
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


def _slug(text: str, max_len: int = 40) -> str:
    """Texto apto para nombre de fichero: sin acentos ni caracteres raros."""
    text = unicodedata.normalize("NFKD", text or "")
    text = text.encode("ascii", "ignore").decode("ascii")
    text = re.sub(r"[^A-Za-z0-9]+", "-", text).strip("-")
    return text[:max_len]


def _expense_filename(exp: Expense, suffix: str) -> str:
    """Nombre legible para el justificante.

    En disco se guardan con nombre UUID (ver services/storage.py) y el nombre
    original no se conserva, así que lo reconstruimos con los datos del gasto:
    `2026-07-24_Repsol_gasolina_12.pdf`. El id final garantiza unicidad.
    """
    partes = [str(exp.date)]
    etiqueta = _slug(exp.supplier or "") or _slug(exp.concept or "")
    if etiqueta:
        partes.append(etiqueta)
    partes.append(str(exp.id))
    return f"gastos/{'_'.join(partes)}{suffix}"


def build_export_zip(
    db: Session, user: User, ranges: List[Range], scope: str = "todo"
) -> Tuple[io.BytesIO, int]:
    """Arma el ZIP del periodo y devuelve (buffer, nº de documentos incluidos).

    `scope` acota qué se incluye:
      - "facturas": solo PDFs de facturas
      - "gastos":   solo los justificantes originales subidos
      - "todo":     ambos
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

    added = 0
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
        # Justificantes de gastos (los ficheros originales subidos)
        for exp in expenses:
            if not exp.file_path:
                continue
            src = settings.files_root / exp.file_path
            if src.exists():
                zf.write(src, _expense_filename(exp, src.suffix))
                added += 1

        # PDFs de facturas (generados al vuelo)
        for inv in invoices:
            try:
                pdf_path = invoice_pdf.render_invoice_pdf(inv, user)
            except Exception:
                # No abortar el export por una factura problemática
                continue
            safe_number = _slug(inv.number) or str(inv.id)
            zf.write(pdf_path, f"facturas/Factura-{safe_number}.pdf")
            added += 1

    buf.seek(0)
    return buf, added
