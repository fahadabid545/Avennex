from datetime import datetime, timezone

from app.database import get_supabase


def create_message(data: dict):
    db = get_supabase()
    result = db.table("chat_messages").insert(data).execute()
    return result.data[0] if result.data else None


def list_public():
    db = get_supabase()
    result = (
        db.table("chat_messages")
        .select("id, author_name, message, is_admin, parent_id, created_at")
        .order("created_at", desc=True)
        .execute()
    )
    messages = result.data or []

    roots = []
    children = {}
    for m in messages:
        if m.get("parent_id"):
            pid = m["parent_id"]
            if pid not in children:
                children[pid] = []
            children[pid].append(m)
        else:
            roots.append(m)

    for r in roots:
        r["replies"] = sorted(children.get(r["id"], []), key=lambda x: x["created_at"])

    return roots


def list_admin():
    db = get_supabase()
    result = (
        db.table("chat_messages")
        .select("*")
        .order("created_at", desc=True)
        .execute()
    )
    messages = result.data or []

    roots = []
    children = {}
    for m in messages:
        if m.get("parent_id"):
            pid = m["parent_id"]
            if pid not in children:
                children[pid] = []
            children[pid].append(m)
        else:
            roots.append(m)

    for r in roots:
        r["replies"] = sorted(children.get(r["id"], []), key=lambda x: x["created_at"])
        r["has_reply"] = len(r["replies"]) > 0

    return roots


def get_by_id(message_id: str):
    db = get_supabase()
    result = db.table("chat_messages").select("*").eq("id", message_id).execute()
    return result.data[0] if result.data else None


def create_reply(parent_id: str, message: str):
    db = get_supabase()
    result = db.table("chat_messages").insert({
        "message": message,
        "is_admin": True,
        "parent_id": parent_id,
    }).execute()
    return result.data[0] if result.data else None


def clear_personal_data(message_id: str):
    db = get_supabase()
    db.table("chat_messages").update({
        "author_email": None,
        "author_profession": None,
        "author_company": None,
    }).eq("id", message_id).execute()


def delete_message(message_id: str):
    db = get_supabase()
    db.table("chat_messages").delete().eq("parent_id", message_id).execute()
    result = db.table("chat_messages").delete().eq("id", message_id).execute()
    return bool(result.data)


def update_message(message_id: str, data: dict):
    db = get_supabase()
    data["updated_at"] = datetime.now(timezone.utc).isoformat()
    result = db.table("chat_messages").update(data).eq("id", message_id).execute()
    return result.data[0] if result.data else None
