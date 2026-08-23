"""Redis cache helpers with graceful PostgreSQL fallback.

Usage:
    from app.cache import cache_get, cache_set, cache_delete

If Redis is unavailable the functions are no-ops (get returns None).
This ensures Redis is never a single point of failure.
"""
import os
import json
import logging
from typing import Any, Optional

logger = logging.getLogger(__name__)

_redis_client = None


def _get_client():
    global _redis_client
    if _redis_client is not None:
        return _redis_client
    redis_url = os.getenv("REDIS_URL", "")
    if not redis_url:
        return None
    try:
        import redis as redis_lib
        _redis_client = redis_lib.from_url(redis_url, decode_responses=True, socket_connect_timeout=2)
        _redis_client.ping()
        logger.info("Redis connected: %s", redis_url)
    except Exception as exc:
        logger.warning("Redis unavailable (%s) — falling back to database.", exc)
        _redis_client = None
    return _redis_client


def cache_get(key: str) -> Optional[Any]:
    client = _get_client()
    if not client:
        return None
    try:
        value = client.get(key)
        return json.loads(value) if value else None
    except Exception:
        return None


def cache_set(key: str, value: Any, ttl: int = 300) -> None:
    client = _get_client()
    if not client:
        return
    try:
        client.setex(key, ttl, json.dumps(value, default=str))
    except Exception:
        pass


def cache_delete(key: str) -> None:
    client = _get_client()
    if not client:
        return
    try:
        client.delete(key)
    except Exception:
        pass
