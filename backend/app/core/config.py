from pathlib import Path
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")

    database_url: str = "sqlite:///./data/app.db"
    secret_key: str = "dev-secret-change-me-in-production"
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 10080  # 7 días

    files_root: Path = Path("./data/files")
    anthropic_api_key: str = ""
    registration_enabled: bool = True
    allowed_origins: str = "*"

    # Envío de facturas por email.
    # Con `brevo_api_key` se manda por HTTPS a la API de Brevo; sin ella, por
    # SMTP directo. Hace falta porque el plan gratuito de Render bloquea el
    # tráfico saliente a los puertos SMTP (25, 465 y 587) desde 2025-09-26:
    # por SMTP el envío falla con "Network is unreachable" y no hay arreglo
    # posible en el código. El 443 de HTTPS nunca está bloqueado.
    brevo_api_key: str = ""

    # Web Push (VAPID). Sin claves, las notificaciones quedan desactivadas
    # silenciosamente: el resto de la automatización sigue funcionando.
    vapid_public_key: str = ""
    vapid_private_key: str = ""
    vapid_subject: str = "mailto:splar.work@gmail.com"

    # Worker de automatización de email. Desactivable por si se despliega en un
    # entorno donde no interesa que arranque el scheduler (p. ej. un segundo
    # proceso que duplicaría los polls).
    automation_worker_enabled: bool = True


settings = Settings()
