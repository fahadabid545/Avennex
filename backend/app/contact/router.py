import logging
from html import escape as html_escape

from fastapi import APIRouter, Request, status
from pydantic import BaseModel, EmailStr, Field, field_validator

from app.email.service import send_email, is_email_enabled
from app.config import get_settings
from app.security import limiter, clean_text, single_line

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api", tags=["contact"])


class ContactRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    email: EmailStr
    message: str = Field(..., min_length=1, max_length=5000)

    @field_validator("name")
    @classmethod
    def _one_line(cls, v):
        return single_line(v)

    @field_validator("message")
    @classmethod
    def _text(cls, v):
        v = clean_text(v)
        if not v:
            raise ValueError("Message can't be empty")
        return v


@router.post("/contact", status_code=status.HTTP_201_CREATED)
@limiter.limit("3/hour")
def contact(body: ContactRequest, request: Request):
    if not is_email_enabled():
        return {"success": False, "message": "Email notifications are currently disabled"}

    settings = get_settings()
    html = f"""
    <h2>New contact form submission</h2>
    <p><strong>Name:</strong> {html_escape(body.name)}</p>
    <p><strong>Email:</strong> {html_escape(body.email)}</p>
    <h3>Message</h3>
    <p>{html_escape(body.message)}</p>
    """
    try:
        sent = send_email(settings.notification_recipient, f"Contact: {body.name}", html)
        if sent:
            return {"success": True, "message": "Message sent"}
        return {"success": False, "message": "Email service not configured"}
    except Exception as e:
        logger.error("Contact email failed: %s", e)
        return {"success": False, "message": "Failed to send message. Please try again later."}
