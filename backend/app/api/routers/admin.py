"""Panel de administración: gestión de las features de cada usuario.

Protegido con require_feature("admin"): solo usuarios con la función 'admin'
pueden listar usuarios y cambiar sus permisos.
"""

from typing import List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ...api.deps import get_current_user, require_feature
from ...core.database import get_db
from ...core.security import hash_password
from ...models.client import Client
from ...models.email_automation import EmailAutomation, PendingInvoice, PushSubscription
from ...models.expense import Expense
from ...models.invoice import Invoice, InvoiceLine
from ...models.user import FEATURE_CATALOG, User
from ...schemas.user import FeaturesUpdate, PasswordReset, UserOut

router = APIRouter(
    prefix="/admin",
    tags=["admin"],
    dependencies=[Depends(require_feature("admin"))],
)

MIN_PASSWORD = 6


@router.get("/features")
def list_features():
    """Catálogo de features asignables (clave + etiqueta)."""
    return FEATURE_CATALOG


@router.get("/users", response_model=List[UserOut])
def list_users(db: Session = Depends(get_db)):
    return db.query(User).order_by(User.id).all()


@router.patch("/users/{user_id}", response_model=UserOut)
def set_user_features(
    user_id: int,
    body: FeaturesUpdate,
    db: Session = Depends(get_db),
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    valid_keys = {f["key"] for f in FEATURE_CATALOG}
    feats = [f for f in body.features if f in valid_keys]
    user.features = ",".join(feats)
    db.commit()
    db.refresh(user)
    return user


@router.patch("/users/{user_id}/password", status_code=204)
def reset_user_password(
    user_id: int,
    body: PasswordReset,
    db: Session = Depends(get_db),
):
    """Restablece la contraseña de un usuario (para cuando la olvida)."""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    if len(body.new_password) < MIN_PASSWORD:
        raise HTTPException(
            status_code=400,
            detail=f"La contraseña debe tener al menos {MIN_PASSWORD} caracteres",
        )
    user.password_hash = hash_password(body.new_password)
    db.commit()


@router.delete("/users/{user_id}", status_code=204)
def delete_user(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Elimina un usuario y todo lo suyo.

    Existe sobre todo para poder limpiar cuentas creadas por error mientras el
    registro estuvo abierto: sin esto habría que entrar a la BD a mano.

    El borrado es en cascada explícita porque los modelos no declaran
    `ondelete`: dejar facturas o gastos apuntando a un usuario inexistente
    rompería el dashboard y la exportación.
    """
    if user_id == current_user.id:
        raise HTTPException(
            status_code=400, detail="No puedes eliminar tu propia cuenta",
        )

    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")

    # Las líneas cuelgan de la factura, no del usuario: van primero
    ids_facturas = [i for (i,) in db.query(Invoice.id).filter(Invoice.user_id == user_id).all()]
    if ids_facturas:
        db.query(InvoiceLine).filter(InvoiceLine.invoice_id.in_(ids_facturas)).delete(
            synchronize_session=False,
        )

    for modelo in (PendingInvoice, PushSubscription, EmailAutomation,
                   Invoice, Expense, Client):
        db.query(modelo).filter(modelo.user_id == user_id).delete(
            synchronize_session=False,
        )

    db.delete(user)
    db.commit()
