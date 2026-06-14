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


settings = Settings()
