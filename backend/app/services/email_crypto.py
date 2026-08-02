"""Cifrado/descifrado de contraseñas de email con Fernet (AES-128-CBC).

La clave se deriva de la SECRET_KEY de la app (SHA-256 → base64url 32 bytes),
por lo que no hay que configurar ninguna clave adicional.
"""

import base64
import hashlib

from cryptography.fernet import Fernet, InvalidToken

from ..core.config import settings

_fernet: Fernet | None = None


def _get_fernet() -> Fernet:
    """Inicializa el cifrador Fernet una sola vez (lazy)."""
    global _fernet
    if _fernet is None:
        # Derivar clave Fernet de 32 bytes a partir de SECRET_KEY
        key_bytes = hashlib.sha256(settings.secret_key.encode()).digest()
        fernet_key = base64.urlsafe_b64encode(key_bytes)
        _fernet = Fernet(fernet_key)
    return _fernet


def normalize_app_password(raw: str) -> str:
    """Quita los espacios de una contraseña de aplicación de Google.

    Google la muestra en cuatro grupos de cuatro ("abcd efgh ijkl mnop") y al
    copiarla se pegan los espacios. La contraseña real son las 16 letras
    seguidas: dejarlos provoca un fallo de autenticación genérico, imposible
    de diagnosticar desde la pantalla de configuración.
    """
    return "".join((raw or "").split())


def encrypt_password(plain: str) -> str:
    """Cifra una contraseña en texto plano → string base64 almacenable."""
    return _get_fernet().encrypt(plain.encode()).decode()


def decrypt_password(cipher: str) -> str:
    """Descifra una contraseña almacenada → texto plano.

    Lanza ValueError si el token es inválido o la clave ha cambiado.
    """
    try:
        return _get_fernet().decrypt(cipher.encode()).decode()
    except InvalidToken as e:
        raise ValueError("No se pudo descifrar la contraseña de email. "
                         "¿Ha cambiado la SECRET_KEY?") from e
