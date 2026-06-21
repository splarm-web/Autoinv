"""Renderer del diseño 'minimal' con fpdf2 (Python puro, sin dependencias de sistema).

Reproduce el diseño de InvoicePreview.jsx: monograma verde, cabecera con
número de factura, fila de metadatos, bloques De/Para, tabla de líneas y
totales con el total a percibir destacado en verde.

Paleta (la del frontend):
  ink    #15171c   green  #0f9b6b   muted #6b7280
  faint  #9ca3af   coral  #c0563a   line  #e6e7ea
"""

from pathlib import Path

from fpdf import FPDF
from fpdf.enums import Align, XPos, YPos

from ...base import InvoiceData, InvoiceRenderer

# Colores RGB
INK = (21, 23, 28)
GREEN = (15, 155, 107)
MUTED = (107, 114, 128)
FAINT = (156, 163, 175)
CORAL = (192, 86, 58)
LINE = (230, 231, 234)
WHITE = (255, 255, 255)

# Layout (mm) sobre A4 (210 x 297)
MARGIN = 18
CONTENT_W = 210 - 2 * MARGIN  # 174

_MESES = [
    "ene", "feb", "mar", "abr", "may", "jun",
    "jul", "ago", "sep", "oct", "nov", "dic",
]


def _eur(value: float) -> str:
    """Formato español: 1.234,56 €"""
    s = f"{value:,.2f}"  # 1,234.56
    s = s.replace(",", "\x00").replace(".", ",").replace("\x00", ".")
    return f"{s} €"


def _fmt_date(d) -> str:
    if not d:
        return "—"
    if isinstance(d, str):
        return d
    return f"{d.day} {_MESES[d.month - 1]} {d.year}"


def _num(value: float) -> str:
    """Número limpio: 1 si es entero, 1,5 si no."""
    if value == int(value):
        return str(int(value))
    return f"{value:.2f}".replace(".", ",")


class MinimalRenderer(InvoiceRenderer):
    def render_pdf(self, data: InvoiceData, output_path: Path) -> Path:
        output_path.parent.mkdir(parents=True, exist_ok=True)

        pdf = FPDF(format="A4", unit="mm")
        # cp1252 (Windows-1252) incluye el símbolo € — latin-1 (default) no
        pdf.core_fonts_encoding = "cp1252"
        pdf.set_auto_page_break(auto=True, margin=18)
        pdf.set_margins(MARGIN, MARGIN, MARGIN)
        pdf.add_page()
        pdf.set_font("helvetica", size=10)

        self._header(pdf, data)
        self._meta(pdf, data)
        self._parties(pdf, data)
        self._table(pdf, data)
        self._totals(pdf, data)
        self._footer(pdf, data)

        pdf.output(str(output_path))
        return output_path

    # ---- secciones -------------------------------------------------------

    def _header(self, pdf: FPDF, data: InvoiceData):
        top = MARGIN
        # Monograma verde
        initials = "".join(
            w[0] for w in (data.issuer.legal_name or "A").split()[:2]
        ).upper() or "A"
        pdf.set_fill_color(*GREEN)
        pdf.rect(MARGIN, top, 13, 13, style="F", round_corners=True, corner_radius=3)
        pdf.set_text_color(*WHITE)
        pdf.set_font("helvetica", "B", 15)
        pdf.set_xy(MARGIN, top + 1)
        pdf.cell(13, 11, initials, align=Align.C)

        # Nombre + profesión
        pdf.set_text_color(*INK)
        pdf.set_font("helvetica", "B", 13)
        pdf.set_xy(MARGIN + 17, top + 1)
        pdf.cell(90, 6, data.issuer.legal_name or "—",
                 new_x=XPos.LMARGIN, new_y=YPos.NEXT)
        pdf.set_text_color(*MUTED)
        pdf.set_font("helvetica", "", 9)
        pdf.set_xy(MARGIN + 17, top + 7)
        pdf.cell(90, 5, "Autónomo/a")

        # "Factura" + número (derecha)
        pdf.set_text_color(*INK)
        pdf.set_font("helvetica", "B", 24)
        pdf.set_xy(MARGIN, top - 1)
        pdf.cell(CONTENT_W, 10, "Factura", align=Align.R)
        pdf.set_text_color(*MUTED)
        pdf.set_font("helvetica", "", 10)
        pdf.set_xy(MARGIN, top + 10)
        pdf.cell(CONTENT_W, 5, f"Nº {data.number}", align=Align.R)

        pdf.set_y(top + 22)

    def _meta(self, pdf: FPDF, data: InvoiceData):
        y = pdf.get_y()
        pdf.set_draw_color(*LINE)
        pdf.line(MARGIN, y, MARGIN + CONTENT_W, y)

        cells = [
            ("EMISIÓN", _fmt_date(data.date)),
            ("VENCIMIENTO", _fmt_date(data.due_date) if data.due_date else "30 días"),
            ("FORMA DE PAGO", data.payment_method or "Transferencia"),
        ]
        col_w = CONTENT_W / 3
        pad = 5
        for i, (label, value) in enumerate(cells):
            x = MARGIN + i * col_w
            pdf.set_xy(x, y + pad)
            pdf.set_text_color(*FAINT)
            pdf.set_font("helvetica", "B", 7.5)
            pdf.cell(col_w, 4, label, new_x=XPos.LEFT, new_y=YPos.NEXT)
            pdf.set_xy(x, y + pad + 4.5)
            pdf.set_text_color(*INK)
            pdf.set_font("helvetica", "", 10)
            pdf.cell(col_w, 5, value)

        bottom = y + pad + 11
        pdf.line(MARGIN, bottom, MARGIN + CONTENT_W, bottom)
        pdf.set_y(bottom + 10)

    def _parties(self, pdf: FPDF, data: InvoiceData):
        y = pdf.get_y()
        col_w = CONTENT_W / 2

        def block(x, label, name, tax_id, address):
            pdf.set_xy(x, y)
            pdf.set_text_color(*FAINT)
            pdf.set_font("helvetica", "B", 7.5)
            pdf.cell(col_w, 4, label, new_x=XPos.LEFT, new_y=YPos.NEXT)
            pdf.set_xy(x, y + 5.5)
            pdf.set_text_color(*INK)
            pdf.set_font("helvetica", "B", 11)
            pdf.cell(col_w, 5, name or "—")
            # Cuerpo
            pdf.set_text_color(*MUTED)
            pdf.set_font("helvetica", "", 9.5)
            line_y = y + 11.5
            body_lines = []
            if tax_id:
                body_lines.append(tax_id)
            if address:
                body_lines.extend(address.split("\n"))
            for ln in body_lines:
                pdf.set_xy(x, line_y)
                pdf.cell(col_w - 4, 4.5, ln)
                line_y += 4.5
            return line_y

        end_left = block(MARGIN, "DE", data.issuer.legal_name,
                         data.issuer.nif, data.issuer.address)
        end_right = block(MARGIN + col_w, "PARA", data.client.name,
                          data.client.tax_id, data.client.address)
        pdf.set_y(max(end_left, end_right) + 10)

    def _table(self, pdf: FPDF, data: InvoiceData):
        # Anchos de columna
        w_desc = 90
        w_qty = 22
        w_price = 31
        w_total = CONTENT_W - w_desc - w_qty - w_price  # 31
        y = pdf.get_y()

        # Cabecera
        pdf.set_text_color(*FAINT)
        pdf.set_font("helvetica", "B", 7.5)
        pdf.set_xy(MARGIN, y)
        pdf.cell(w_desc, 5, "CONCEPTO")
        pdf.cell(w_qty, 5, "CANT.", align=Align.R)
        pdf.cell(w_price, 5, "PRECIO", align=Align.R)
        pdf.cell(w_total, 5, "IMPORTE", align=Align.R)
        y += 7
        pdf.set_draw_color(*LINE)
        pdf.line(MARGIN, y, MARGIN + CONTENT_W, y)

        # Filas
        for line in data.lines:
            y += 2
            pdf.set_xy(MARGIN, y)
            pdf.set_text_color(*INK)
            pdf.set_font("helvetica", "", 10)
            pdf.cell(w_desc, 6, line.description)
            pdf.set_text_color(*MUTED)
            pdf.cell(w_qty, 6, _num(line.quantity), align=Align.R)
            pdf.cell(w_price, 6, _eur(line.unit_price), align=Align.R)
            pdf.set_text_color(*INK)
            pdf.set_font("helvetica", "B", 10)
            pdf.cell(w_total, 6, _eur(line.line_total), align=Align.R)
            y += 8
            pdf.set_draw_color(*LINE)
            pdf.line(MARGIN, y, MARGIN + CONTENT_W, y)

        pdf.set_y(y + 8)

    def _totals(self, pdf: FPDF, data: InvoiceData):
        block_w = 75
        x = MARGIN + CONTENT_W - block_w
        y = pdf.get_y()

        def row(label, value, value_color=INK, bold=False):
            nonlocal y
            pdf.set_xy(x, y)
            pdf.set_text_color(*MUTED)
            pdf.set_font("helvetica", "", 9.5)
            pdf.cell(block_w * 0.55, 6, label)
            pdf.set_text_color(*value_color)
            pdf.set_font("helvetica", "B" if bold else "", 9.5)
            pdf.cell(block_w * 0.45, 6, value, align=Align.R)
            y += 7

        row("Base imponible", _eur(data.subtotal))
        row(f"IVA ({_num(data.vat_rate)}%)", _eur(data.vat_total))
        row(f"Retención IRPF ({_num(data.irpf_rate)}%)",
            f"-{_eur(data.irpf_total)}", value_color=CORAL)

        # Línea + total destacado
        pdf.set_draw_color(*LINE)
        pdf.line(x, y + 1, x + block_w, y + 1)
        y += 4
        pdf.set_xy(x, y)
        pdf.set_text_color(*INK)
        pdf.set_font("helvetica", "B", 11)
        pdf.cell(block_w * 0.5, 9, "Total a percibir")
        pdf.set_text_color(*GREEN)
        pdf.set_font("helvetica", "B", 18)
        pdf.cell(block_w * 0.5, 9, _eur(data.total), align=Align.R)
        pdf.set_y(y + 16)

    def _footer(self, pdf: FPDF, data: InvoiceData):
        # Anclar cerca del pie de página
        y = max(pdf.get_y(), 268)
        pdf.set_draw_color(*LINE)
        pdf.line(MARGIN, y, MARGIN + CONTENT_W, y)
        y += 5
        pdf.set_xy(MARGIN, y)
        pdf.set_text_color(*FAINT)
        pdf.set_font("helvetica", "B", 7.5)
        pdf.cell(CONTENT_W, 4, "PAGO POR TRANSFERENCIA",
                 new_x=XPos.LMARGIN, new_y=YPos.NEXT)
        pdf.set_xy(MARGIN, y + 4.5)
        pdf.set_text_color(*INK)
        pdf.set_font("helvetica", "", 9.5)
        pdf.cell(CONTENT_W, 5, data.payment_method or "Indica tu IBAN en ajustes")

        pdf.set_xy(MARGIN, y + 12)
        pdf.set_text_color(*FAINT)
        pdf.set_font("helvetica", "", 8)
        pdf.multi_cell(
            CONTENT_W, 4,
            "Operación sujeta a retención de IRPF según art. 95 RIRPF. "
            "Gracias por tu confianza.",
        )
