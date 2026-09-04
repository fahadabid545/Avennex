import logging
from datetime import datetime, timezone
from xml.sax.saxutils import escape

from fastapi import APIRouter
from fastapi.responses import Response

from app.database import get_supabase

logger = logging.getLogger(__name__)

router = APIRouter(tags=["sitemap"])

STATIC_PAGES = [
    {"loc": "https://avennex.com/", "priority": "1.0", "changefreq": "weekly"},
    {"loc": "https://avennex.com/products.html", "priority": "0.9", "changefreq": "weekly"},
    {"loc": "https://avennex.com/blog.html", "priority": "0.8", "changefreq": "daily"},
    {"loc": "https://avennex.com/careers.html", "priority": "0.8", "changefreq": "weekly"},
    {"loc": "https://avennex.com/launchpad.html", "priority": "0.7", "changefreq": "weekly"},
    {"loc": "https://avennex.com/academy.html", "priority": "0.7", "changefreq": "weekly"},
    {"loc": "https://avennex.com/about.html", "priority": "0.6", "changefreq": "monthly"},
    {"loc": "https://avennex.com/contact.html", "priority": "0.5", "changefreq": "monthly"},
    {"loc": "https://avennex.com/privacy.html", "priority": "0.3", "changefreq": "yearly"},
]


STATIC_LASTMOD = "2026-09-04"


@router.get("/api/sitemap.xml")
def dynamic_sitemap():
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    urls = []

    for page in STATIC_PAGES:
        urls.append(
            f"  <url>\n"
            f"    <loc>{page['loc']}</loc>\n"
            f"    <lastmod>{STATIC_LASTMOD}</lastmod>\n"
            f"    <changefreq>{page['changefreq']}</changefreq>\n"
            f"    <priority>{page['priority']}</priority>\n"
            f"  </url>"
        )

    db = get_supabase()

    try:
        blogs = (
            db.table("blogs")
            .select("slug, published_at, updated_at")
            .eq("status", "published")
            .order("published_at", desc=True)
            .execute()
        )
        for blog in blogs.data:
            lastmod = str(blog.get("updated_at") or blog.get("published_at") or today)[:10]
            slug = escape(str(blog.get("slug", "")))
            urls.append(
                f"  <url>\n"
                f"    <loc>https://avennex.com/blog-post.html?slug={slug}</loc>\n"
                f"    <lastmod>{lastmod}</lastmod>\n"
                f"    <changefreq>monthly</changefreq>\n"
                f"    <priority>0.7</priority>\n"
                f"  </url>"
            )
    except Exception as e:
        logger.warning(f"sitemap: failed to fetch blogs: {e}")

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
        for job in jobs.data:
            lastmod = str(job.get("updated_at") or job.get("created_at") or today)[:10]
            slug = escape(str(job.get("slug", "")))
            urls.append(
                f"  <url>\n"
                f"    <loc>https://avennex.com/job-post.html?slug={slug}</loc>\n"
                f"    <lastmod>{lastmod}</lastmod>\n"
                f"    <changefreq>weekly</changefreq>\n"
                f"    <priority>0.6</priority>\n"
                f"  </url>"
            )
    except Exception as e:
        logger.warning(f"sitemap: failed to fetch jobs: {e}")

    xml = (
        '<?xml version="1.0" encoding="UTF-8"?>\n'
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
        + "\n".join(urls)
        + "\n</urlset>"
    )

    return Response(content=xml, media_type="application/xml")
