import urllib.parse
from typing import Optional
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra="allow",
    )

    # API Settings
    PROJECT_NAME: str = "ContextVault API"
    VERSION: str = "1.0.0"
    DESCRIPTION: str = (
        "ContextVault Privacy-First AI Screenshot Organization Backend API"
    )
    API_V1_STR: str = "/api"
    ENVIRONMENT: str = "development"

    # Local Vision AI Server Gateway (RTX 4050 Laptop GPU)
    VISION_SERVER_URL: str = "http://127.0.0.1:9000"
    VISION_TIMEOUT: int = 120
    VISION_HEALTH_TIMEOUT: int = 5

    # SQL Server Database Configuration
    DB_SERVER: str = "localhost"
    DB_DATABASE: str = "ContextVault"
    DB_USERNAME: Optional[str] = None
    DB_PASSWORD: Optional[str] = None
    DB_DRIVER: str = "ODBC Driver 18 for SQL Server"
    DB_TRUST_SERVER_CERTIFICATE: bool = True
    DB_TIMEOUT: int = 30

    # JWT Authentication
    JWT_SECRET: str = "contextvault_super_secret_jwt_key_2026_dev_only"
    JWT_ALGORITHM: str = "HS256"
    JWT_EXPIRE_MINUTES: int = 60
    REFRESH_TOKEN_EXPIRE_DAYS: int = 30

    # Logging
    LOG_LEVEL: str = "INFO"
    LOG_FILE: str = "logs/contextvault.log"

    @property
    def sqlalchemy_database_uri(self) -> str:
        """Construct standard SQLAlchemy connection string using pyodbc for SQL Server."""
        params = [
            f"DRIVER={{{self.DB_DRIVER}}}",
            f"SERVER={self.DB_SERVER}",
            f"DATABASE={self.DB_DATABASE}",
        ]

        if self.DB_USERNAME and self.DB_PASSWORD:
            params.append(f"UID={self.DB_USERNAME}")
            params.append(f"PWD={self.DB_PASSWORD}")
        else:
            params.append("Trusted_Connection=yes")

        if self.DB_TRUST_SERVER_CERTIFICATE:
            params.append("TrustServerCertificate=yes")

        odbc_str = ";".join(params) + ";"
        encoded = urllib.parse.quote_plus(odbc_str)
        return f"mssql+pyodbc:///?odbc_connect={encoded}"


settings = Settings()
