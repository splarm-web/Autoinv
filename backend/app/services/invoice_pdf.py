"""Render de PDF de una factura ya guardada, según su tipo (kind).

Compartido por el endpoint de descarga (GET /invoices/{id}/pdf) y por el
export ZIP, para no duplicar la lógica y poder generar el PDF al vuelo.
"""

import json
from pathlib import Path

from ..core.config import settings
from ..invoicing.base import (
    ClientData,
    InvoiceData,
    InvoiceLineData,
    IssuerData,
    get_renderer,
)
from ..invoicing.designs.alfredo.render import render_transporte_pdf
from ..models.invoice import Invoice
from ..models.user import User


def to_invoice_data(inv: Invoice, user: User) -> InvoiceData:
    """Convierte una factura estándar (kind='standard') al contrato del renderer."""
    vat_rate = inv.lines[0].vat_rate if inv.lines else (user.default_vat or 21.0)
    irpf_rate = (
        round(inv.irpf_total / inv.subtotal * 100, 2)
        if inv.subtotal else (user.irpf_rate or 15.0)
    )
    return InvoiceData(
        number=inv.number,
        date=inv.date,
        due_date=inv.due_date,
        payment_method=inv.payment_method,
        issuer=IssuerData(
            legal_name=user.legal_name or user.email,
            nif=user.nif or "",
            address=user.address or "",
        ),
        client=ClientData(
            name=inv.client_name,
            tax_id=inv.client_tax_id,
            address=inv.client_address,
        ),
        lines=[
            InvoiceLineData(
                description=ln.description,
                quantity=ln.quantity,
                unit_price=ln.unit_price,
                vat_rate=ln.vat_rate,
                line_total=ln.line_total,
            )
            for ln in inv.lines
        ],
        subtotal=inv.subtotal,
        vat_total=inv.vat_total,
        irpf_total=inv.irpf_total,
        total=inv.total,
        irpf_rate=irpf_rate,
        vat_rate=vat_rate,
    )


def render_invoice_pdf(inv: Invoice, user: User) -> Path:
    """Genera el PDF de la factura (diseño según kind) y devuelve la ruta."""
    safe_number = inv.number.replace("/", "-").replace("\\", "-")
    out_dir = settings.files_root / str(user.id) / "invoices"

    if inv.kind == "transporte":
        payload = json.loads(inv.extra_json or "{}")
        out_path = out_dir / f"transporte-{safe_number}.pdf"
        return render_transporte_pdf(payload, out_path)

    out_path = out_dir / f"{safe_number}.pdf"
    get_renderer("minimal").render_pdf(to_invoice_data(inv, user), out_path)
    return out_path
