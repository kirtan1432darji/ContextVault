from sqlalchemy import text
from app.database.base import Base
from app.database.session import engine, SessionLocal, get_db
from app.core.logging import logger


def check_database_connection() -> bool:
    """Validate database connectivity by executing a lightweight query."""
    try:
        with engine.connect() as connection:
            connection.execute(text("SELECT 1"))
            return True
    except Exception as exc:
        logger.error(f"Database connection check failed: {exc}")
        return False


__all__ = ["Base", "engine", "SessionLocal", "get_db", "check_database_connection"]
