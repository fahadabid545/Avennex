import logging
from datetime import datetime, timezone, timedelta

from app.database import get_supabase

logger = logging.getLogger(__name__)


def log_activity(admin_email: str, action: str, entity_type: str, entity_id: str, entity_title: str):
    try:
        db = get_supabase()
        db.table("activity_log").insert({
            "admin_email": admin_email,
            "action": action,
            "entity_type": entity_type,
            "entity_id": entity_id,
            "entity_title": entity_title,
        }).execute()
    except Exception as e:
        logger.warning("Failed to log activity (%s %s %s): %s", action, entity_type, entity_id, e)


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
    result = db.table("admins").select("id, email, name, created_at, last_login_at").order("created_at").execute()
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


def update_admin(admin_id: str, name: str):
    db = get_supabase()
    result = db.table("admins").update({"name": name}).eq("id", admin_id).execute()
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
    stats["playlists"] = safe_count("playlists")
    stats["videos"] = safe_count("videos")

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

    total_messages = stats.get("chat_total", 0)
    replied_messages = total_messages - stats.get("chat_unreplied", 0)
    stats["engagement_rate"] = round((replied_messages / total_messages) * 100, 1) if total_messages else 0

    stats["chatbot_docs_ready"] = safe_count("chatbot_documents", {"status": "ready"})
    stats["chatbot_docs_failed"] = safe_count("chatbot_documents", {"status": "failed"})

    try:
        now = datetime.now(timezone.utc)
        month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0).isoformat()
        result = (
            db.table("job_applications")
            .select("id", count="exact")
            .gte("created_at", month_start)
            .execute()
        )
        stats["applications_this_month"] = result.count or 0
    except Exception:
        stats["applications_this_month"] = 0

    return stats


def get_charts(days: int = 7):
    db = get_supabase()
    now = datetime.now(timezone.utc)
    since = (now - timedelta(days=days)).isoformat()
    charts = {}

    def daily_counts(table, date_col="created_at", filters=None):
        try:
            q = db.table(table).select(date_col).gte(date_col, since)
            if filters:
                for k, v in filters.items():
                    q = q.eq(k, v)
            result = q.execute()
            counts = {}
            for row in (result.data or []):
                day = row[date_col][:10]
                counts[day] = counts.get(day, 0) + 1
            return counts
        except Exception:
            return {}

    charts["user_chats"] = daily_counts("chat_messages", filters={"is_admin": False})
    charts["applications"] = daily_counts("job_applications")
    charts["launchpad_comments"] = daily_counts("launchpad_comments")
    charts["activity"] = daily_counts("activity_log")
    charts["chatbot_usage"] = daily_counts("chatbot_requests")
    charts["academy_growth"] = daily_counts("videos")

    try:
        blogs_data = daily_counts("blogs", filters={"status": "published"})
        products_data = daily_counts("products")
        launchpad_data = daily_counts("launchpad_entries")
        jobs_data = daily_counts("jobs")
        all_days = sorted(set(
            list(blogs_data.keys()) + list(products_data.keys())
            + list(launchpad_data.keys()) + list(jobs_data.keys())
        ))
        charts["content_published"] = {
            "blogs": blogs_data,
            "products": products_data,
            "launchpad": launchpad_data,
            "jobs": jobs_data,
            "days": all_days,
        }

        day_labels = [(now - timedelta(days=i)).strftime("%Y-%m-%d") for i in range(days - 1, -1, -1)]
        running_total = 0
        growth_trend = {}
        for day in day_labels:
            running_total += (
                blogs_data.get(day, 0) + products_data.get(day, 0)
                + launchpad_data.get(day, 0) + jobs_data.get(day, 0)
            )
            growth_trend[day] = running_total
        charts["growth_trend"] = growth_trend
    except Exception:
        charts["content_published"] = {"blogs": {}, "products": {}, "launchpad": {}, "jobs": {}, "days": []}
        charts["growth_trend"] = {}

    charts["product_chats"] = daily_counts("product_chat_messages")

    try:
        jobs_result = db.table("jobs").select("id, title").eq("status", "open").execute()
        job_map = {j["id"]: j["title"] for j in (jobs_result.data or [])}
        apps_result = (
            db.table("job_applications")
            .select("job_id")
            .in_("job_id", list(job_map.keys()))
            .execute()
        ) if job_map else None
        counts = {}
        for row in (apps_result.data if apps_result else []):
            counts[row["job_id"]] = counts.get(row["job_id"], 0) + 1
        charts["applications_by_job"] = [
            {"job": title, "count": counts.get(job_id, 0)}
            for job_id, title in job_map.items()
        ]
    except Exception:
        charts["applications_by_job"] = []

    try:
        playlists_result = db.table("playlists").select("id, title").execute()
        playlist_map = {p["id"]: p["title"] for p in (playlists_result.data or [])}
        videos_result = db.table("videos").select("playlist_id").execute()
        counts = {}
        for row in (videos_result.data or []):
            pid = row.get("playlist_id")
            counts[pid] = counts.get(pid, 0) + 1
        ranked = sorted(
            ({"playlist": playlist_map.get(pid, "Unknown"), "count": count} for pid, count in counts.items()),
            key=lambda x: x["count"],
            reverse=True,
        )
        charts["popular_playlists"] = ranked[:10]
    except Exception:
        charts["popular_playlists"] = []

    try:
        hour_counts = [0] * 24

        def add_hours(table, date_col="created_at", filters=None):
            q = db.table(table).select(date_col).gte(date_col, since)
            if filters:
                for k, v in filters.items():
                    q = q.eq(k, v)
            for row in (q.execute().data or []):
                hour = int(row[date_col][11:13])
                hour_counts[hour] += 1

        add_hours("chat_messages")
        add_hours("activity_log")
        add_hours("job_applications")
        charts["peak_hours"] = hour_counts
    except Exception:
        charts["peak_hours"] = [0] * 24

    try:
        result = (
            db.table("activity_log")
            .select("entity_type")
            .gte("created_at", since)
            .execute()
        )
        counts = {}
        for row in (result.data or []):
            et = row.get("entity_type", "other")
            counts[et] = counts.get(et, 0) + 1
        charts["admin_actions_by_module"] = counts
    except Exception:
        charts["admin_actions_by_module"] = {}

    return charts
