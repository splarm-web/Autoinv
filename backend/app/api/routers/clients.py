from typing import List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ...api.deps import get_current_user, require_feature
from ...core.database import get_db
from ...models.client import Client
from ...models.user import User
from ...schemas.client import ClientCreate, ClientOut, ClientUpdate

router = APIRouter(
    prefix="/clients",
    tags=["clients"],
    dependencies=[Depends(require_feature("clientes"))],
)


def _unset_defaults(db: Session, user_id: int):
    db.query(Client).filter(
        Client.user_id == user_id, Client.is_default == True
    ).update({"is_default": False})


@router.get("", response_model=List[ClientOut])
def list_clients(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return (
        db.query(Client)
        .filter(Client.user_id == current_user.id)
        .order_by(Client.is_default.desc(), Client.nombre)
        .all()
    )


@router.post("", response_model=ClientOut, status_code=201)
def create_client(
    data: ClientCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if data.is_default:
        _unset_defaults(db, current_user.id)
    client = Client(**data.model_dump(), user_id=current_user.id)
    db.add(client)
    db.commit()
    db.refresh(client)
    return client


@router.patch("/{client_id}", response_model=ClientOut)
def update_client(
    client_id: int,
    data: ClientUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    client = db.query(Client).filter(
        Client.id == client_id, Client.user_id == current_user.id
    ).first()
    if not client:
        raise HTTPException(status_code=404, detail="Cliente no encontrado")
    if data.is_default:
        _unset_defaults(db, current_user.id)
    for field, value in data.model_dump(exclude_none=True).items():
        setattr(client, field, value)
    db.commit()
    db.refresh(client)
    return client


@router.post("/{client_id}/set-default", response_model=ClientOut)
def set_default(
    client_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    client = db.query(Client).filter(
        Client.id == client_id, Client.user_id == current_user.id
    ).first()
    if not client:
        raise HTTPException(status_code=404, detail="Cliente no encontrado")
    _unset_defaults(db, current_user.id)
    client.is_default = True
    db.commit()
    db.refresh(client)
    return client


@router.delete("/{client_id}", status_code=204)
def delete_client(
    client_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    client = db.query(Client).filter(
        Client.id == client_id, Client.user_id == current_user.id
    ).first()
    if not client:
        raise HTTPException(status_code=404, detail="Cliente no encontrado")
    db.delete(client)
    db.commit()
