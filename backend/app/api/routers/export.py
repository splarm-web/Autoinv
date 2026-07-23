from calendar import monthrange
from datetime import date
from typing import List, Optional, Tuple

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from ...api.deps import get_current_user, require_feature
from ...core.database import get_db
from ...models.user import User
from ...services.export_zip import build_export_zip

router = APIRouter(
    prefix="/export",
    tags=["export"],
    dependencies=[Depends(require_feature("export"))],
)


def _quarter_range(year: int, q: int) -> Tuple[date, date]:
    first_month = (q - 1) * 3 + 1
    last_month = first_month + 2
    last_day = monthrange(year, last_month)[1]
    return date(year, first_month, 1), date(year, last_month, last_day)


@router.get("")
def export(
    from_date: Optional[date] = Query(None),
    to_date: Optional[date] = Query(None),
    years: List[int] = Query(default=[]),
    quarters: List[int] = Query(default=[]),
    scope: str = Query("todo", pattern="^(facturas|gastos|todo)$"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Genera y descarga un ZIP con justificantes + PDFs + CSV.

    Dos modos de periodo:
    - Por trimestres: `years` + `quarters` (multi). Exporta el producto de
      año × trimestre (puede ser no contiguo).
    - Por rango: `from_date` + `to_date`.

    `scope` acota el contenido: "facturas" (PDFs de facturas), "gastos"
    (justificantes subidos) o "todo" (ambos).
    """
    prefix = "autoinv" if scope == "todo" else f"autoinv_{scope}"

    if years and quarters:
        bad = [q for q in quarters if q not in (1, 2, 3, 4)]
        if bad:
            raise HTTPException(status_code=400, detail="Trimestre inválido (usa 1-4)")
        ranges = [_quarter_range(y, q) for y in sorted(set(years)) for q in sorted(set(quarters))]
        starts = [r[0] for r in ranges]
        ends = [r[1] for r in ranges]
        fname = f"{prefix}_{min(starts)}_{max(ends)}.zip"
    elif from_date and to_date:
        ranges = [(from_date, to_date)]
        fname = f"{prefix}_{from_date}_{to_date}.zip"
    else:
        raise HTTPException(
            status_code=400,
            detail="Indica years+quarters o from_date+to_date",
        )

    zip_buffer = build_export_zip(db, current_user, ranges, scope)
    return StreamingResponse(
        zip_buffer,
        media_type="application/zip",
        headers={"Content-Disposition": f'attachment; filename="{fname}"'},
    )
