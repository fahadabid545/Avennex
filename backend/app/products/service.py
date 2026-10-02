import logging
from datetime import datetime, timezone

from app.database import get_supabase
from app.slugs import free_slug, slug_taken, slugify
from app.progress_history import stamp as stamp_progress
from app.storage import ftp_service
from app.uploads import documents

logger = logging.getLogger(__name__)


def list_all(page: int, limit: int):
    db = get_supabase()
    offset = (page - 1) * limit
    result = (
        db.table("products")
        .select("*")
        .order("display_order")
        .order("created_at")
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
    data["slug"] = free_slug("products", data.get("slug") or data["name"], "product")
    stamp_progress(data)
    try:
        result = db.table("products").insert(data).execute()
    except Exception as e:
        logger.error("Failed to create product %s: %s", data.get("slug"), e)
        raise
    return result.data[0] if result.data else None


class SlugTaken(Exception):
    pass


def update(product_id: str, data: dict):
    db = get_supabase()
    data["updated_at"] = datetime.now(timezone.utc).isoformat()
    current = None
    try:
        current = get_by_id(product_id)
        stamp_progress(data, current)
    except Exception as e:
        logger.warning("Progress history lookup failed for product %s: %s", product_id, e)
    if "slug" in data:
        if not data["slug"]:
            name = data.get("name") or (current or {}).get("name") or ""
            data["slug"] = free_slug("products", name, "product", exclude_id=product_id)
        else:
            data["slug"] = slugify(data["slug"]) or "product"
            if slug_taken("products", data["slug"], product_id):
                raise SlugTaken(data["slug"])
    try:
        result = db.table("products").update(data).eq("id", product_id).execute()
    except Exception as e:
        logger.error("Failed to update product %s: %s", product_id, e)
        raise
    return result.data[0] if result.data else None


def delete(product_id: str):
    db = get_supabase()
    product = get_by_id(product_id)
    result = db.table("products").delete().eq("id", product_id).execute()

    # the cover and gallery are media library images that a copy of this
    # product, or a post, may still show, so only its own documents go
    if product:
        for url in documents.file_urls(product.get("documents")):
            remote_path = ftp_service.remote_path_from_url(url)
            if remote_path and not ftp_service.delete_file(remote_path):
                logger.warning("Failed to delete file %s for product %s", url, product_id)

    return bool(result.data)
