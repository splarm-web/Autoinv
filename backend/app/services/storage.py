"""Almacenamiento de ficheros — local por ahora, fácil de cambiar a S3/GCS.

Estructura:  FILES_ROOT/<user_id>/temp/<filename>
                                  uploads/<filename>
"""

import uuid
from pathlib import Path

import aiofiles

from ..core.config import settings


def _user_dir(user_id: int) -> Path:
    d = settings.files_root / str(user_id)
    d.mkdir(parents=True, exist_ok=True)
    return d


async def save_temp(content: bytes, filename: str, user_id: int) -> Path:
    suffix = Path(filename).suffix
    dest = _user_dir(user_id) / "temp" / f"{uuid.uuid4().hex}{suffix}"
    dest.parent.mkdir(parents=True, exist_ok=True)
    async with aiofiles.open(dest, "wb") as f:
        await f.write(content)
    return dest


async def promote(temp_path_str: str, user_id: int) -> Path:
    """Mueve un fichero de temp a uploads/<user_id>/."""
    src = Path(temp_path_str)
    dest = _user_dir(user_id) / "uploads" / src.name
    dest.parent.mkdir(parents=True, exist_ok=True)
    src.rename(dest)
    return dest


def get_absolute(relative_path: str) -> Path:
    return settings.files_root / relative_path
