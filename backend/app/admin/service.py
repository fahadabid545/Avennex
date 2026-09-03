import logging
from datetime import datetime, timezone, timedelta

from app.database import get_supabase

logger = logging.getLogger(__name__)


def log_activity(admin_email: str, action: str, entity_type: str, entity_id: str, entity_title: str):
    db = get_supabase()
    db.table("activity_log").insert({
        "admin_email": admin_email,
        "action": action,
        "entity_type": entity_type,
        "entity_id": entity_id,
        "entity_title": entity_title,
    }).execute()


def list_activity(page: int, limit: int):
    db = get_supabase()
    offset = (page - 1) * limit
    result = (
        db.table("activity_log")
        .select("*")
        .order("created_at", desc=True)
        .range(offset, offset + limit - 1)
        .execute()
    )
    return result.data


def list_admins():
    db = get_supabase()
    result = db.table("admins").select("id, email, name, created_at").order("created_at").execute()
    return result.data


def create_admin(email: str, password: str, name: str):
    from app.auth.service import hash_password
    db = get_supabase()

    existing = db.table("admins").select("id").eq("email", email).execute()
    if existing.data:
        return None

    password_hash = hash_password(password)
    result = db.table("admins").insert({
        "email": email,
        "password_hash": password_hash,
        "name": name or "Admin",
    }).execute()
    return result.data[0] if result.data else None


def delete_admin(admin_id: str):
    db = get_supabase()
    result = db.table("admins").delete().eq("id", admin_id).execute()
    return bool(result.data)


def get_stats():
    db = get_supabase()
    stats = {}

    def safe_count(table, filters=None):
        try:
            q = db.table(table).select("id", count="exact")
            if filters:
                for k, v in filters.items():
                    q = q.eq(k, v)
            result = q.execute()
            return result.count or 0
        except Exception:
            return 0

    stats["blogs_published"] = safe_count("blogs", {"status": "published"})
    stats["blogs_draft"] = safe_count("blogs", {"status": "draft"})
    stats["jobs_open"] = safe_count("jobs", {"status": "open"})
    stats["jobs_closed"] = safe_count("jobs", {"status": "closed"})
    stats["products"] = safe_count("products")
    stats["applications"] = safe_count("job_applications")
    stats["faqs_active"] = safe_count("faqs", {"active": True})
    stats["faqs_inactive"] = safe_count("faqs", {"active": False})
    stats["playlists"] = safe_count("academy_playlists")
    stats["videos"] = safe_count("academy_videos")

    try:
        chat_result = db.table("chat_messages").select("id", count="exact").is_("parent_id", "null").execute()
        total_threads = chat_result.count or 0
        replied_result = (
            db.table("chat_messages")
            .select("parent_id", count="exact")
            .not_.is_("parent_id", "null")
            .execute()
        )
        replied_count = replied_result.count or 0
        stats["chat_total"] = total_threads
        stats["chat_unreplied"] = max(0, total_threads - replied_count)
    except Exception:
        stats["chat_total"] = 0
        stats["chat_unreplied"] = 0

    try:
        lp = db.table("launchpad_entries").select("stage").execute()
        stage_counts = {}
        for entry in (lp.data or []):
            s = entry.get("stage", "concept")
            stage_counts[s] = stage_counts.get(s, 0) + 1
        stats["launchpad"] = stage_counts
        stats["launchpad_total"] = sum(stage_counts.values())
    except Exception:
        stats["launchpad"] = {}
        stats["launchpad_total"] = 0

    try:
        all_settings = db.table("settings").select("key, value").execute()
        settings_map = {s["key"]: s["value"] for s in (all_settings.data or [])}
        stats["chatbot_visible"] = settings_map.get("chatbot_visible") == "true"
        stats["emails_enabled"] = settings_map.get("emails_enabled", "true") == "true"
        stats["chat_show_details"] = settings_map.get("chat_show_details", "true") == "true"
    except Exception:
        stats["chatbot_visible"] = False
        stats["emails_enabled"] = True
        stats["chat_show_details"] = True

    return stats


def get_charts():
    db = get_supabase()
    now = datetime.now(timezone.utc)
    thirty_days_ago = (now - timedelta(days=30)).isoformat()
    charts = {}

    def daily_counts(table, date_col="created_at"):
        try:
            result = db.table(table).select(date_col).gte(date_col, thirty_days_ago).execute()
            counts = {}
            for row in (result.data or []):
                day = row[date_col][:10]
                counts[day] = counts.get(day, 0) + 1
            return counts
        except Exception:
            return {}

    charts["applications"] = daily_counts("job_applications")
    charts["chat_messages"] = daily_counts("chat_messages")
    charts["activity"] = daily_counts("activity_log")

    return charts
