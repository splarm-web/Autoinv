import json
from datetime import date, datetime

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from typing import List

from ...api.deps import get_current_user, require_feature
from ...core.config import settings
from ...core.database import get_db
from ...invoicing.designs.alfredo.render import render_transporte_pdf
from ...models.invoice import Invoice, InvoiceLine
from ...models.user import User
from ...schemas.invoice import InvoiceCreate, InvoiceOut
from ...schemas.transporte import TransporteInvoiceIn
from ...services import invoice_pdf, transporte_excel

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
        client_id=data.client_id,
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


@router.post("/transporte/parse-excel")
async def parse_transporte_excel(
    file: UploadFile = File(...),
    current_user: User = Depends(require_feature("transporte")),
):
    """Lee un Excel de transporte y devuelve líneas + extras + totales calculados."""
    name = (file.filename or "").lower()
    if not name.endswith((".xlsx", ".xlsm", ".xls")):
        raise HTTPException(status_code=400, detail="Sube un fichero Excel (.xlsx)")
    content = await file.read()
    try:
        return transporte_excel.parse(content)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"No se pudo leer el Excel: {e}")


def _build_transporte_payload(data: TransporteInvoiceIn) -> dict:
    """Calcula viajes + totales (IRPF 1%, IVA 21%) y arma el dict del renderer.

    total línea = (kilos / 1000) * precio · base = suma · total = base - irpf + iva.
    """
    viajes = []
    base = 0.0
    for v in data.viajes:
        total = round((v.kilos / 1000) * v.precio, 2)
        base += total
        viajes.append({
            "fecha": v.fecha, "viaje": v.viaje,
            "kilos": v.kilos, "precio": v.precio, "total": total,
        })
    base = round(base, 2)
    irpf = round(base * 0.01, 2)
    iva = round(base * 0.21, 2)
    total = round(base - irpf + iva, 2)
    return {
        "emisor": data.emisor.model_dump(),
        "cliente": data.cliente.model_dump(),
        "numero_factura": data.numero_factura,
        "fecha_factura": data.fecha_factura,
        "concepto_mes": data.concepto_mes,
        "cabeza": data.cabeza,
        "cisterna": data.cisterna,
        "viajes": viajes,
        "base": base, "irpf": irpf, "iva": iva, "total": total,
    }


def _ddmmyyyy_to_date(s: str) -> date:
    for fmt in ("%d/%m/%Y", "%Y-%m-%d"):
        try:
            return datetime.strptime(s, fmt).date()
        except (ValueError, TypeError):
            continue
    return date.today()


def _render_transporte_to(payload: dict, user_id: int) -> "object":
    """Renderiza el payload a un PDF bajo la carpeta del usuario y devuelve la ruta."""
    out_dir = settings.files_root / str(user_id) / "invoices"
    safe_number = (payload.get("numero_factura") or "transporte").replace("/", "-").replace("\\", "-")
    out_path = out_dir / f"transporte-{safe_number}.pdf"
    return render_transporte_pdf(payload, out_path)


@router.post("/transporte/pdf")
def generate_transporte_pdf(
    data: TransporteInvoiceIn,
    current_user: User = Depends(require_feature("transporte")),
):
    """Genera y descarga el PDF de transporte SIN guardarlo (vista previa rápida)."""
    payload = _build_transporte_payload(data)
    out_path = _render_transporte_to(payload, current_user.id)
    safe_number = (data.numero_factura or "transporte").replace("/", "-").replace("\\", "-")
    return FileResponse(
        out_path, media_type="application/pdf", filename=f"Factura-{safe_number}.pdf",
    )


@router.post("/transporte", response_model=InvoiceOut, status_code=201)
def save_transporte_invoice(
    data: TransporteInvoiceIn,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_feature("transporte")),
):
    """Guarda la factura de transporte en el listado (kind='transporte').

    Persiste el payload completo en extra_json para poder re-generar el PDF
    fielmente más tarde desde el listado.
    """
    payload = _build_transporte_payload(data)
    invoice = Invoice(
        user_id=current_user.id,
        number=data.numero_factura or "A-1",
        date=_ddmmyyyy_to_date(data.fecha_factura),
        client_name=data.cliente.nombre or "—",
        client_tax_id=data.cliente.cif,
        client_address=", ".join(
            p for p in [data.cliente.direccion, data.cliente.ciudad] if p
        ),
        payment_method="Transferencia",
        subtotal=payload["base"],
        vat_total=payload["iva"],
        irpf_total=payload["irpf"],
        total=payload["total"],
        kind="transporte",
        extra_json=json.dumps(payload, ensure_ascii=False),
    )
    db.add(invoice)
    db.commit()
    db.refresh(invoice)
    return invoice


@router.get("/{invoice_id}/pdf")
def download_invoice_pdf(
    invoice_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    inv = db.query(Invoice).filter(
        Invoice.id == invoice_id, Invoice.user_id == current_user.id
    ).first()
    if not inv:
        raise HTTPException(status_code=404, detail="Factura no encontrada")

    out_path = invoice_pdf.render_invoice_pdf(inv, current_user)
    inv.pdf_path = str(out_path.relative_to(settings.files_root))
    db.commit()

    safe_number = inv.number.replace("/", "-").replace("\\", "-")
    return FileResponse(
        out_path,
        media_type="application/pdf",
        filename=f"Factura-{safe_number}.pdf",
    )


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
