from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from ...api.deps import get_current_user
from ...core.config import settings
from ...core.database import get_db
from ...core.security import create_access_token, hash_password, verify_password
from ...models.user import DEFAULT_FEATURES, User
from ...schemas.user import (
    PasswordChange,
    TokenOut,
    UserCreate,
    UserLogin,
    UserOut,
    UserUpdate,
)

MIN_PASSWORD = 6

router = APIRouter(prefix="/auth", tags=["auth"])

# Bootstrap: mientras no exista ningún admin en el sistema, el que se registra
# se vuelve admin con todas las funciones, para configurar al resto desde el
# panel sin tocar la BD. En cuanto haya un admin, los nuevos usan el set default.
_BOOTSTRAP_ADMIN_FEATURES = "gastos,facturas,transporte,clientes,export,admin"


@router.post("/register", response_model=TokenOut, status_code=201)
def register(data: UserCreate, db: Session = Depends(get_db)):
    if not settings.registration_enabled:
        raise HTTPException(status_code=403, detail="El registro está desactivado")
    if db.query(User).filter(User.email == data.email).first():
        raise HTTPException(status_code=400, detail="El email ya está registrado")
    no_admin_yet = db.query(User).filter(User.features.contains("admin")).first() is None
    user = User(
        email=data.email,
        password_hash=hash_password(data.password),
        legal_name=data.legal_name,
        features=_BOOTSTRAP_ADMIN_FEATURES if no_admin_yet else DEFAULT_FEATURES,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return {"access_token": create_access_token(str(user.id)), "user": user}


@router.post("/login", response_model=TokenOut)
def login(data: UserLogin, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == data.email).first()
    if not user or not verify_password(data.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Email o contraseña incorrectos")
    # Bootstrap: si aún no hay ningún admin, el primero que inicia sesión lo es.
    # Cubre el caso de usuarios registrados antes de existir el sistema de admin.
    no_admin_yet = db.query(User).filter(User.features.contains("admin")).first() is None
    if no_admin_yet:
        user.features = _BOOTSTRAP_ADMIN_FEATURES
        db.commit()
        db.refresh(user)
    return {"access_token": create_access_token(str(user.id)), "user": user}


@router.get("/me", response_model=UserOut)
def me(current_user: User = Depends(get_current_user)):
    return current_user


@router.patch("/me", response_model=UserOut)
def update_me(
    data: UserUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    for field, value in data.model_dump(exclude_none=True).items():
        setattr(current_user, field, value)
    db.commit()
    db.refresh(current_user)
    return current_user


@router.post("/change-password", status_code=204)
def change_password(
    data: PasswordChange,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Cambia la contraseña del propio usuario (exige la actual)."""
    if not verify_password(data.current_password, current_user.password_hash):
        raise HTTPException(status_code=400, detail="La contraseña actual no es correcta")
    if len(data.new_password) < MIN_PASSWORD:
        raise HTTPException(
            status_code=400,
            detail=f"La nueva contraseña debe tener al menos {MIN_PASSWORD} caracteres",
        )
    current_user.password_hash = hash_password(data.new_password)
    db.commit()
