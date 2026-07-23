from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from ...api.deps import get_current_user
from ...core.config import settings
from ...core.database import get_db
from ...core.security import create_access_token, hash_password, verify_password
from ...models.user import DEFAULT_FEATURES, User
from ...schemas.user import TokenOut, UserCreate, UserLogin, UserOut, UserUpdate

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
