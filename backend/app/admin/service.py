from datetime import datetime, timezone

from app.database import get_supabase


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
