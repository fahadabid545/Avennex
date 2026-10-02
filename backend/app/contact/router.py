import logging

from fastapi import APIRouter, Request, status
from pydantic import BaseModel, EmailStr, Field, field_validator

from app.email.service import send_email, is_email_enabled
from app.email import templates
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
    subject, html, text = templates.contact_alert(body.name, body.email, body.message)
    try:
        sent = send_email(settings.notification_recipient, subject, html, "general", text, body.email)
        if sent:
            return {"success": True, "message": "Message sent"}
        return {"success": False, "message": "Email service not configured"}
    except Exception as e:
        logger.error("Contact email failed: %s", e)
        return {"success": False, "message": "Failed to send message. Please try again later."}
