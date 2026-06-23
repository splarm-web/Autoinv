"""Panel de administración: gestión de las features de cada usuario.

Protegido con require_feature("admin"): solo usuarios con la función 'admin'
pueden listar usuarios y cambiar sus permisos.
"""

from typing import List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ...api.deps import require_feature
from ...core.database import get_db
from ...models.user import FEATURE_CATALOG, User
from ...schemas.user import FeaturesUpdate, UserOut

router = APIRouter(
    prefix="/admin",
    tags=["admin"],
    dependencies=[Depends(require_feature("admin"))],
)


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
