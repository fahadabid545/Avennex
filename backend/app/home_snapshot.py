import json
import logging
import threading
from datetime import datetime, timezone

from app.config import get_settings
from app.database import get_supabase

logger = logging.getLogger(__name__)

# The home page reads this file from cPanel before the API answers, so FAQs
# and chat messages show at once even while the Render instance wakes up.
# Production only. Staging keeps reading the API directly.
PROD_SITE = "https://avennex.com"
REMOTE_DIR = "public_html/data"
FILENAME = "home.json"
SETTING_KEYS = ("ai_brain_enabled", "home_chat_enabled", "faq_enabled", "chat_show_details")
WATCHED_PREFIXES = ("/api/faqs", "/api/chat", "/api/settings", "/api/revisions")
WRITE_METHODS = ("POST", "PUT", "PATCH", "DELETE")
DELAY_SECONDS = 5

_timer = None
_lock = threading.Lock()


def enabled() -> bool:
    return get_settings().site_base == PROD_SITE


def build() -> dict:
    from app.chat import service as chat_service
    from app.faqs import service as faqs_service

    rows = (
        get_supabase().table("settings").select("key, value")
        .in_("key", list(SETTING_KEYS)).execute().data or []
    )
    faqs = [
        {"id": f["id"], "question": f["question"], "answer": f["answer"]}
        for f in faqs_service.list_active() or []
    ]
    return {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "settings": {r["key"]: r["value"] for r in rows},
        "faqs": faqs,
        "messages": chat_service.list_public(),
    }


def write():
    from app.storage import ftp_service

    try:
        body = json.dumps(build(), default=str, separators=(",", ":")).encode()
    except Exception as e:
        logger.warning("home snapshot: could not read the data: %s", e)
        return
    _, error = ftp_service.store_file(body, REMOTE_DIR, FILENAME)
    if error:
        logger.warning("home snapshot: upload failed: %s", error)


def schedule():
    """Rewrites the file a few seconds after the last change, so a burst of
    edits costs one upload."""
    global _timer
    if not enabled():
        return
    with _lock:
        if _timer:
            _timer.cancel()
        _timer = threading.Timer(DELAY_SECONDS, write)
        _timer.daemon = True
        _timer.start()


async def refresh_after_writes(request, call_next):
    response = await call_next(request)
    if (
        request.method in WRITE_METHODS
        and response.status_code < 400
        and request.url.path.startswith(WATCHED_PREFIXES)
    ):
        schedule()
    return response
