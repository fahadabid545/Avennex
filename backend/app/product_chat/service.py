from datetime import datetime, timezone

from app.database import get_supabase


def create_message(data: dict):
    db = get_supabase()
    result = db.table("product_chat_messages").insert(data).execute()
    return result.data[0] if result.data else None


def list_public(product_id: str):
    db = get_supabase()
    result = (
        db.table("product_chat_messages")
        .select("id, author_name, message, is_admin, parent_id, created_at")
        .eq("product_id", product_id)
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


def list_admin(product_id: str):
    db = get_supabase()
    result = (
        db.table("product_chat_messages")
        .select("*")
        .eq("product_id", product_id)
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
    result = db.table("product_chat_messages").select("*").eq("id", message_id).execute()
    return result.data[0] if result.data else None


def create_reply(parent_id: str, product_id: str, message: str):
    db = get_supabase()
    result = db.table("product_chat_messages").insert({
        "message": message,
        "is_admin": True,
        "parent_id": parent_id,
        "product_id": product_id,
    }).execute()
    return result.data[0] if result.data else None


def delete_message(message_id: str):
    db = get_supabase()
    db.table("product_chat_messages").delete().eq("parent_id", message_id).execute()
    result = db.table("product_chat_messages").delete().eq("id", message_id).execute()
    return bool(result.data)


def count_by_product(product_id: str) -> int:
    db = get_supabase()
    result = (
        db.table("product_chat_messages")
        .select("id")
        .eq("product_id", product_id)
        .eq("is_admin", False)
        .execute()
    )
    return len(result.data) if result.data else 0


def count_by_products(product_ids: list[str]):
    db = get_supabase()
    result = (
        db.table("product_chat_messages")
        .select("product_id")
        .in_("product_id", product_ids)
        .eq("is_admin", False)
        .execute()
    )
    counts = {}
    for row in (result.data or []):
        pid = row["product_id"]
        counts[pid] = counts.get(pid, 0) + 1
    return counts


def count_by_product_daily(product_id: str):
    db = get_supabase()
    cutoff = (datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0))
    from datetime import timedelta
    start = (cutoff - timedelta(days=29)).isoformat()
    result = (
        db.table("product_chat_messages")
        .select("created_at")
        .eq("product_id", product_id)
        .gte("created_at", start)
        .execute()
    )
    counts = {}
    for row in (result.data or []):
        day = row["created_at"][:10]
        counts[day] = counts.get(day, 0) + 1
    return counts
