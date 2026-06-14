from datetime import date
from typing import List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ...api.deps import get_current_user
from ...core.database import get_db
from ...models.invoice import Invoice, InvoiceLine
from ...models.user import User
from ...schemas.invoice import InvoiceCreate, InvoiceOut

router = APIRouter(prefix="/invoices", tags=["invoices"])


def _next_number(db: Session, user: User) -> str:
    """Auto-genera el siguiente número de factura según el formato del usuario."""
    year = date.today().year
    fmt = user.invoice_number_format or "YYYY-NNN"
    count = (
        db.query(Invoice)
        .filter(Invoice.user_id == user.id, Invoice.date >= date(year, 1, 1))
        .count()
    ) + 1
    return fmt.replace("YYYY", str(year)).replace("NNN", str(count).zfill(3))


@router.get("", response_model=List[InvoiceOut])
def list_invoices(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return (
        db.query(Invoice)
        .filter(Invoice.user_id == current_user.id)
        .order_by(Invoice.date.desc())
        .offset(skip)
        .limit(limit)
        .all()
    )


@router.post("", response_model=InvoiceOut, status_code=201)
def create_invoice(
    data: InvoiceCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    number = data.number or _next_number(db, current_user)

    # Calcular totales
    subtotal = sum(line.quantity * line.unit_price for line in data.lines)
    vat_total = sum(
        line.quantity * line.unit_price * line.vat_rate / 100 for line in data.lines
    )
    irpf_total = round(subtotal * data.irpf_rate / 100, 2)
    total = round(subtotal + vat_total - irpf_total, 2)

    invoice = Invoice(
        user_id=current_user.id,
        number=number,
        date=data.date,
        due_date=data.due_date,
        client_name=data.client_name,
        client_tax_id=data.client_tax_id,
        client_address=data.client_address,
        payment_method=data.payment_method,
        subtotal=round(subtotal, 2),
        vat_total=round(vat_total, 2),
        irpf_total=irpf_total,
        total=total,
    )
    db.add(invoice)
    db.flush()  # para obtener invoice.id

    for line_data in data.lines:
        line = InvoiceLine(
            invoice_id=invoice.id,
            description=line_data.description,
            quantity=line_data.quantity,
            unit_price=line_data.unit_price,
            vat_rate=line_data.vat_rate,
            line_total=round(line_data.quantity * line_data.unit_price, 2),
        )
        db.add(line)

    db.commit()
    db.refresh(invoice)
    return invoice


@router.get("/{invoice_id}", response_model=InvoiceOut)
def get_invoice(
    invoice_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    inv = db.query(Invoice).filter(
        Invoice.id == invoice_id, Invoice.user_id == current_user.id
    ).first()
    if not inv:
        raise HTTPException(status_code=404, detail="Factura no encontrada")
    return inv


@router.delete("/{invoice_id}", status_code=204)
def delete_invoice(
    invoice_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    inv = db.query(Invoice).filter(
        Invoice.id == invoice_id, Invoice.user_id == current_user.id
    ).first()
    if not inv:
        raise HTTPException(status_code=404, detail="Factura no encontrada")
    db.delete(inv)
    db.commit()
