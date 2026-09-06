from pydantic_settings import BaseSettings
from typing import Optional

class Settings(BaseSettings):
    PROJECT_NAME: str = "ContextVault API"
    API_V1_STR: str = "/api"
    SECRET_KEY: str = "contextvault_super_secret_jwt_key_2026"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7  # 7 days
    REFRESH_TOKEN_EXPIRE_DAYS: int = 30

    # SQL Server Database Connection
    DB_SERVER: str = "localhost"
    DB_NAME: str = "AIScreenshotOrganizerDb"
    DB_USER: Optional[str] = None
    DB_PASSWORD: Optional[str] = None
    DB_DRIVER: str = "ODBC Driver 18 for SQL Server"
    DB_TRUST_SERVER_CERTIFICATE: bool = True

    class Config:
        env_file = ".env"
        case_sensitive = True

settings = Settings()
