"""Shared request guards: one rate limiter keyed on the real visitor, a body
size ceiling, safe headers on every response and a catch-all error handler
that never sends a traceback or a database message to the browser."""
import logging
import re
import threading
import time

from fastapi import Request
from fastapi.responses import JSONResponse
from slowapi import Limiter

logger = logging.getLogger(__name__)

MAX_BODY_BYTES = 32 * 1024 * 1024


def client_ip(request: Request) -> str:
    # Render sits behind a proxy, so request.client is the proxy and every
    # visitor would share one bucket. The forwarded headers carry the visitor.
    for header in ("cf-connecting-ip", "true-client-ip"):
        value = request.headers.get(header, "").strip()
        if value:
            return value
    forwarded = request.headers.get("x-forwarded-for", "")
    if forwarded:
        first = forwarded.split(",")[0].strip()
        if first:
            return first
    return request.client.host if request.client else "unknown"


def global_key() -> str:
    return "global"


limiter = Limiter(key_func=client_ip)


class FailedLogins:
    """Counts failed logins per email so one account can't be brute forced
    from many addresses. Lives in memory, which is enough for one instance."""

    def __init__(self, limit: int = 8, window: int = 15 * 60):
        self.limit = limit
        self.window = window
        self._hits: dict[str, list[float]] = {}
        self._lock = threading.Lock()

    def _recent(self, key: str, now: float) -> list[float]:
        hits = [t for t in self._hits.get(key, []) if now - t < self.window]
        self._hits[key] = hits
        return hits

    def blocked(self, email: str) -> bool:
        with self._lock:
            return len(self._recent(email.lower(), time.time())) >= self.limit

    def fail(self, email: str):
        with self._lock:
            now = time.time()
            self._recent(email.lower(), now).append(now)

    def clear(self, email: str):
        with self._lock:
            self._hits.pop(email.lower(), None)


failed_logins = FailedLogins()

_CONTROL = re.compile(r"[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]")


def clean_text(value: str) -> str:
    return _CONTROL.sub("", value or "").strip()


def single_line(value: str) -> str:
    return re.sub(r"[\r\n\t]+", " ", clean_text(value))


async def body_size_guard(request: Request, call_next):
    length = request.headers.get("content-length")
    if length and length.isdigit() and int(length) > MAX_BODY_BYTES:
        return JSONResponse(status_code=413, content={"success": False, "detail": "Request is too large"})
    return await call_next(request)


async def security_headers(request: Request, call_next):
    response = await call_next(request)
    response.headers.setdefault("X-Content-Type-Options", "nosniff")
    response.headers.setdefault("X-Frame-Options", "DENY")
    response.headers.setdefault("Referrer-Policy", "strict-origin-when-cross-origin")
    response.headers.setdefault("Strict-Transport-Security", "max-age=31536000; includeSubDomains")
    if request.url.path.startswith("/api/auth") or "/admin" in request.url.path:
        response.headers["Cache-Control"] = "no-store"
    return response


async def unhandled_error(request: Request, exc: Exception):
    logger.exception("Unhandled error on %s %s", request.method, request.url.path)
    return JSONResponse(status_code=500, content={"success": False, "detail": "Something went wrong. Please try again."})
