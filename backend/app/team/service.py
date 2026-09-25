from datetime import datetime, timezone

from app.database import get_supabase

MAX_MEMBERS = 5


def list_all():
    db = get_supabase()
    result = (
        db.table("team_members")
        .select("*")
        .order("display_order")
        .order("created_at")
        .limit(MAX_MEMBERS)
        .execute()
    )
    return result.data


def count():
    db = get_supabase()
    result = db.table("team_members").select("id", count="exact").execute()
    return result.count or 0


def get_by_id(member_id: str):
    db = get_supabase()
    result = db.table("team_members").select("*").eq("id", member_id).execute()
    return result.data[0] if result.data else None


def next_order():
    db = get_supabase()
    result = (
        db.table("team_members")
        .select("display_order")
        .order("display_order", desc=True)
        .limit(1)
        .execute()
    )
    return (result.data[0]["display_order"] + 1) if result.data else 0


def create(data: dict):
    db = get_supabase()
    result = db.table("team_members").insert(data).execute()
    return result.data[0] if result.data else None


def update(member_id: str, data: dict):
    db = get_supabase()
    data["updated_at"] = datetime.now(timezone.utc).isoformat()
    result = db.table("team_members").update(data).eq("id", member_id).execute()
    return result.data[0] if result.data else None


def delete(member_id: str):
    db = get_supabase()
    result = db.table("team_members").delete().eq("id", member_id).execute()
    return bool(result.data)
