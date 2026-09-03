from app.database import get_supabase


def get_setting(key: str):
    db = get_supabase()
    result = db.table("settings").select("key, value").eq("key", key).execute()
    return result.data[0] if result.data else None


def upsert_setting(key: str, value: str):
    db = get_supabase()
    result = (
        db.table("settings")
        .upsert({"key": key, "value": value}, on_conflict="key")
        .execute()
    )
    return result.data[0] if result.data else None
