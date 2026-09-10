import logging
from datetime import datetime, timezone

from app.database import get_supabase
from app.blogs.service import slugify
from app.storage import ftp_service

logger = logging.getLogger(__name__)


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
    product = get_by_id(product_id)
    result = db.table("products").delete().eq("id", product_id).execute()

    if product:
        urls = []
        if product.get("cover_image"):
            urls.append(product["cover_image"])
        urls.extend(product.get("gallery") or [])
        urls.extend(doc.get("url") for doc in (product.get("documents") or []) if doc.get("url"))
        for url in urls:
            remote_path = ftp_service.remote_path_from_url(url)
            if remote_path and not ftp_service.delete_file(remote_path):
                logger.warning("Failed to delete file %s for product %s", url, product_id)

    return bool(result.data)
