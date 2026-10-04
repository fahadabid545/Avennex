import logging
from datetime import datetime, timezone
from urllib.parse import quote
from xml.sax.saxutils import escape

from fastapi import APIRouter
from fastapi.responses import Response

from app.config import get_settings
from app.database import get_supabase

logger = logging.getLogger(__name__)

router = APIRouter(tags=["sitemap"])

# real pages only. the detail pages are templates that show nothing without
# a slug, so they appear further down once per published item, never bare
STATIC_PAGES = [
    {"path": "/", "priority": "1.0", "changefreq": "weekly"},
    {"path": "/services.html", "priority": "0.9", "changefreq": "monthly"},
    {"path": "/products.html", "priority": "0.8", "changefreq": "weekly"},
    {"path": "/blog.html", "priority": "0.8", "changefreq": "daily"},
    {"path": "/careers.html", "priority": "0.8", "changefreq": "weekly"},
    {"path": "/launchpad.html", "priority": "0.7", "changefreq": "weekly"},
    {"path": "/academy.html", "priority": "0.7", "changefreq": "weekly"},
    {"path": "/about.html", "priority": "0.6", "changefreq": "monthly"},
    {"path": "/contact.html", "priority": "0.5", "changefreq": "monthly"},
    {"path": "/privacy.html", "priority": "0.3", "changefreq": "yearly"},
]

STATIC_LASTMOD = "2026-09-26"


def _entry(loc: str, lastmod: str, changefreq: str, priority: str) -> str:
    return (
        f"  <url>\n"
        f"    <loc>{escape(loc)}</loc>\n"
        f"    <lastmod>{escape(lastmod)}</lastmod>\n"
        f"    <changefreq>{changefreq}</changefreq>\n"
        f"    <priority>{priority}</priority>\n"
        f"  </url>"
    )


def _detail_entries(site: str, rows, page: str, today: str, changefreq: str, priority: str) -> list[str]:
    out = []
    for row in rows or []:
        slug = str(row.get("slug") or "").strip()
        if not slug:
            continue
        lastmod = str(row.get("updated_at") or row.get("published_at") or row.get("created_at") or today)[:10]
        out.append(_entry(f"{site}/{page}?slug={quote(slug, safe='')}", lastmod, changefreq, priority))
    return out


@router.get("/api/sitemap.xml")
def dynamic_sitemap():
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    # SITE_URL on the server, so the staging backend lists staging addresses
    site = get_settings().site_base
    urls = [
        _entry(f"{site}{page['path']}", STATIC_LASTMOD, page["changefreq"], page["priority"])
        for page in STATIC_PAGES
    ]

    db = get_supabase()

    try:
        blogs = (
            db.table("blogs")
            .select("slug, published_at, updated_at")
            .eq("status", "published")
            .order("published_at", desc=True)
            .execute()
        )
        urls += _detail_entries(site, blogs.data, "blog-post.html", today, "monthly", "0.7")
    except Exception as e:
        logger.warning("sitemap: failed to fetch blogs: %s", e)

    try:
        now = datetime.now(timezone.utc).isoformat()
        jobs = (
            db.table("jobs")
            .select("slug, created_at, updated_at")
            .eq("status", "open")
            .or_(f"expires_at.is.null,expires_at.gt.{now}")
            .order("created_at", desc=True)
            .execute()
        )
        urls += _detail_entries(site, jobs.data, "job-post.html", today, "weekly", "0.6")
    except Exception as e:
        logger.warning("sitemap: failed to fetch jobs: %s", e)

    try:
        products = (
            db.table("products")
            .select("slug, created_at, updated_at")
            .order("display_order")
            .order("created_at")
            .execute()
        )
        urls += _detail_entries(site, products.data, "product-detail.html", today, "weekly", "0.8")
    except Exception as e:
        logger.warning("sitemap: failed to fetch products: %s", e)

    try:
        entries = (
            db.table("launchpad_entries")
            .select("slug, created_at, updated_at")
            .eq("status", "active")
            .order("created_at", desc=True)
            .execute()
        )
        urls += _detail_entries(site, entries.data, "launchpad-detail.html", today, "weekly", "0.6")
    except Exception as e:
        logger.warning("sitemap: failed to fetch launchpad entries: %s", e)

    xml = (
        '<?xml version="1.0" encoding="UTF-8"?>\n'
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
        + "\n".join(urls)
        + "\n</urlset>"
    )

    return Response(content=xml, media_type="application/xml")
