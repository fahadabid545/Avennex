from datetime import datetime, timezone

from app.database import get_supabase
from app.blogs.service import slugify


def list_all(page: int, limit: int):
    db = get_supabase()
    offset = (page - 1) * limit
    result = (
        db.table("products")
        .select("*")
        .order("display_order")
        .range(offset, offset + limit - 1)
        .execute()
    )
    return result.data


def get_by_slug(slug: str):
    db = get_supabase()
    result = db.table("products").select("*").eq("slug", slug).execute()
    return result.data[0] if result.data else None


def get_by_id(product_id: str):
    db = get_supabase()
    result = db.table("products").select("*").eq("id", product_id).execute()
    return result.data[0] if result.data else None


def create(data: dict):
    db = get_supabase()
    if not data.get("slug"):
        data["slug"] = slugify(data["name"])
    result = db.table("products").insert(data).execute()
    return result.data[0] if result.data else None


def update(product_id: str, data: dict):
    db = get_supabase()
    data["updated_at"] = datetime.now(timezone.utc).isoformat()
    result = db.table("products").update(data).eq("id", product_id).execute()
    return result.data[0] if result.data else None


def delete(product_id: str):
    db = get_supabase()
    result = db.table("products").delete().eq("id", product_id).execute()
    return bool(result.data)
