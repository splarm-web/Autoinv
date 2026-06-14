from datetime import date

from fastapi import APIRouter, Depends, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from ...api.deps import get_current_user
from ...core.database import get_db
from ...models.user import User
from ...services.export_zip import build_export_zip

router = APIRouter(prefix="/export", tags=["export"])


@router.get("")
def export(
    from_date: date = Query(...),
    to_date: date = Query(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Genera y descarga un ZIP con justificantes + PDFs + CSV del periodo."""
    zip_buffer = build_export_zip(db, current_user, from_date, to_date)
    filename = f"autoinv_{from_date}_{to_date}.zip"
    return StreamingResponse(
        zip_buffer,
        media_type="application/zip",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
