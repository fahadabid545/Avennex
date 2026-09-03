import logging

from fastapi import APIRouter, Request, status
from pydantic import BaseModel, EmailStr
from slowapi import Limiter
from slowapi.util import get_remote_address

from app.email.service import send_email, is_email_enabled
from app.config import get_settings

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api", tags=["contact"])
limiter = Limiter(key_func=get_remote_address)


class ContactRequest(BaseModel):
    name: str
    email: EmailStr
    message: str


@router.post("/contact", status_code=status.HTTP_201_CREATED)
@limiter.limit("3/hour")
def contact(body: ContactRequest, request: Request):
    if not is_email_enabled():
        return {"success": False, "message": "Email notifications are currently disabled"}

    settings = get_settings()
    html = f"""
    <h2>New contact form submission</h2>
    <p><strong>Name:</strong> {body.name}</p>
    <p><strong>Email:</strong> {body.email}</p>
    <h3>Message</h3>
    <p>{body.message}</p>
    """
    try:
        sent = send_email(settings.smtp_from_email, f"Contact: {body.name}", html)
        if sent:
            return {"success": True, "message": "Message sent"}
        return {"success": False, "message": "Email service not configured"}
    except Exception as e:
        logger.error("Contact email failed: %s", e)
        return {"success": False, "message": "Failed to send message. Please try again later."}
