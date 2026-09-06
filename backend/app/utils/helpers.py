from datetime import datetime, timezone
from typing import Any, Dict


def get_utc_now() -> datetime:
    """Return current timezone-aware UTC datetime."""
    return datetime.now(timezone.utc)


def format_iso_timestamp(dt: datetime) -> str:
    """Format datetime object into standard ISO 8601 string."""
    return dt.isoformat()
