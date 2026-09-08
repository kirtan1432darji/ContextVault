from app.core.config import settings


def get_database_url() -> str:
    """Retrieve database connection URI from application settings."""
    return settings.sqlalchemy_database_uri
