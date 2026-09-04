from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from starlette.middleware.trustedhost import TrustedHostMiddleware

from app.config import get_settings
from app.auth.router import router as auth_router
from app.blogs.router import router as blogs_router
from app.jobs.router import router as jobs_router
from app.products.router import router as products_router
from app.launchpad.router import router as launchpad_router
from app.contact.router import router as contact_router
from app.admin.router import router as admin_router
from app.academy.router import router as academy_router
from app.chat.router import router as chat_router
from app.faqs.router import router as faqs_router
from app.settings.router import router as settings_router
from app.sitemap import router as sitemap_router

settings = get_settings()

limiter = Limiter(key_func=get_remote_address)

app = FastAPI(title="Avennex API", docs_url="/api/docs", redoc_url=None)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router)
app.include_router(blogs_router)
app.include_router(jobs_router)
app.include_router(products_router)
app.include_router(launchpad_router)
app.include_router(contact_router)
app.include_router(admin_router)
app.include_router(academy_router)
app.include_router(chat_router)
app.include_router(faqs_router)
app.include_router(settings_router)
app.include_router(sitemap_router)


@app.get("/api/health")
def health():
    return {"status": "ok"}
