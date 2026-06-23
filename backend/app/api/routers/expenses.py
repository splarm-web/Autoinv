import json
from datetime import date
from pathlib import Path
from typing import List, Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile
from sqlalchemy.orm import Session

from ...api.deps import get_current_user, require_feature
from ...core.database import get_db
from ...models.expense import Expense
from ...models.user import User
from ...schemas.expense import ExpenseCreate, ExpenseOut, ExpenseUpdate, OcrResult
from ...services import ocr_claude, storage

router = APIRouter(
    prefix="/expenses",
    tags=["expenses"],
    dependencies=[Depends(require_feature("gastos"))],
)

CATEGORIES = [
    "Software / Servicios digitales",
    "Oficina / Coworking",
    "Transporte",
    "Formación",
    "Marketing / Publicidad",
    "Material / Equipamiento",
    "Consultoría / Asesoría",
    "Seguros",
    "Suministros",
    "Otros",
]


@router.get("", response_model=List[ExpenseOut])
def list_expenses(
    from_date: Optional[date] = None,
    to_date: Optional[date] = None,
    category: Optional[str] = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    q = db.query(Expense).filter(Expense.user_id == current_user.id)
    if from_date:
        q = q.filter(Expense.date >= from_date)
    if to_date:
        q = q.filter(Expense.date <= to_date)
    if category:
        q = q.filter(Expense.category == category)
    return q.order_by(Expense.date.desc()).offset(skip).limit(limit).all()


@router.post("", response_model=ExpenseOut, status_code=201)
def create_expense(
    data: ExpenseCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    expense = Expense(**data.model_dump(), user_id=current_user.id)
    if expense.vat_amount is None and expense.vat_rate:
        base = expense.amount / (1 + expense.vat_rate / 100)
        expense.vat_amount = round(expense.amount - base, 2)
    db.add(expense)
    db.commit()
    db.refresh(expense)
    return expense


@router.post("/upload", response_model=OcrResult)
async def upload_and_extract(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
):
    """Sube un fichero (foto/PDF) y extrae datos con Claude Vision.
    Devuelve un OcrResult para que el frontend muestre el formulario editable.
    El fichero se guarda temporalmente; se conserva al confirmar el gasto.
    """
    allowed = {"image/jpeg", "image/png", "image/webp", "application/pdf"}
    if file.content_type not in allowed:
        raise HTTPException(status_code=400, detail="Tipo de fichero no soportado")

    content = await file.read()
    file_path = await storage.save_temp(content, file.filename, current_user.id)
    result = await ocr_claude.extract(content, file.content_type, file_path)
    return result


@router.post("/confirm", response_model=ExpenseOut, status_code=201)
async def confirm_upload(
    data: str = Form(...),        # JSON de ExpenseCreate
    temp_path: str = Form(...),   # ruta temporal devuelta por /upload
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Confirma un gasto capturado: mueve el fichero de temp a definitivo y guarda."""
    expense_data = ExpenseCreate(**json.loads(data))
    final_path = await storage.promote(temp_path, current_user.id)
    expense = Expense(
        **expense_data.model_dump(),
        user_id=current_user.id,
        file_path=str(final_path),
    )
    if expense.vat_amount is None and expense.vat_rate:
        base = expense.amount / (1 + expense.vat_rate / 100)
        expense.vat_amount = round(expense.amount - base, 2)
    db.add(expense)
    db.commit()
    db.refresh(expense)
    return expense


@router.get("/categories")
def get_categories():
    return CATEGORIES


@router.get("/{expense_id}", response_model=ExpenseOut)
def get_expense(
    expense_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    exp = db.query(Expense).filter(
        Expense.id == expense_id, Expense.user_id == current_user.id
    ).first()
    if not exp:
        raise HTTPException(status_code=404, detail="Gasto no encontrado")
    return exp


@router.patch("/{expense_id}", response_model=ExpenseOut)
def update_expense(
    expense_id: int,
    data: ExpenseUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    exp = db.query(Expense).filter(
        Expense.id == expense_id, Expense.user_id == current_user.id
    ).first()
    if not exp:
        raise HTTPException(status_code=404, detail="Gasto no encontrado")
    for field, value in data.model_dump(exclude_none=True).items():
        setattr(exp, field, value)
    db.commit()
    db.refresh(exp)
    return exp


@router.delete("/{expense_id}", status_code=204)
def delete_expense(
    expense_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    exp = db.query(Expense).filter(
        Expense.id == expense_id, Expense.user_id == current_user.id
    ).first()
    if not exp:
        raise HTTPException(status_code=404, detail="Gasto no encontrado")
    db.delete(exp)
    db.commit()
