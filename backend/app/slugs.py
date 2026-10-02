import re

from app.database import get_supabase


def slugify(text: str) -> str:
    slug = (text or "").lower().strip()
    slug = re.sub(r"[^\w\s-]", "", slug)
    slug = re.sub(r"[\s_]+", "-", slug)
    return re.sub(r"-+", "-", slug).strip("-")


def free_slug(table: str, base: str, fallback: str = "item", exclude_id: str | None = None) -> str:
    """Every slug column is unique, so a second post with the same title
    gets base-2, base-3 and so on instead of a failed insert."""
    base = slugify(base) or fallback
    rows = get_supabase().table(table).select("id, slug").like("slug", f"{base}%").execute().data or []
    taken = {r["slug"] for r in rows if r.get("id") != exclude_id}
    if base not in taken:
        return base
    n = 2
    while f"{base}-{n}" in taken:
        n += 1
    return f"{base}-{n}"


def slug_taken(table: str, slug: str, exclude_id: str | None = None) -> bool:
    rows = get_supabase().table(table).select("id").eq("slug", slug).execute().data or []
    return any(r.get("id") != exclude_id for r in rows)
