"""Panel de administración: gestión de las features de cada usuario.

Protegido con require_feature("admin"): solo usuarios con la función 'admin'
pueden listar usuarios y cambiar sus permisos.
"""

from typing import List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ...api.deps import require_feature
from ...core.database import get_db
from ...core.security import hash_password
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
