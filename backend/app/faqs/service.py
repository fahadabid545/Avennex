from datetime import datetime, timezone

from app.database import get_supabase


def list_active():
    db = get_supabase()
    result = (
        db.table("faqs")
        .select("*")
        .eq("active", True)
        .order("display_order")
        .execute()
    )
    return result.data


def list_all():
    db = get_supabase()
    result = (
        db.table("faqs")
        .select("*")
        .order("display_order")
        .execute()
    )
    return result.data


def get_by_id(faq_id: str):
    db = get_supabase()
    result = db.table("faqs").select("*").eq("id", faq_id).execute()
    return result.data[0] if result.data else None


def create(data: dict):
    db = get_supabase()
    result = db.table("faqs").insert(data).execute()
    return result.data[0] if result.data else None


def update(faq_id: str, data: dict):
    db = get_supabase()
    data["updated_at"] = datetime.now(timezone.utc).isoformat()
    result = db.table("faqs").update(data).eq("id", faq_id).execute()
    return result.data[0] if result.data else None


def delete(faq_id: str):
    db = get_supabase()
    result = db.table("faqs").delete().eq("id", faq_id).execute()
    return bool(result.data)
