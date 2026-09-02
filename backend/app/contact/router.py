from fastapi import APIRouter, Request, status
from pydantic import BaseModel, EmailStr
from slowapi import Limiter
from slowapi.util import get_remote_address

from app.email.service import send_email
from app.config import get_settings

router = APIRouter(prefix="/api", tags=["contact"])
limiter = Limiter(key_func=get_remote_address)


class ContactRequest(BaseModel):
    name: str
    email: EmailStr
    message: str


@router.post("/contact", status_code=status.HTTP_201_CREATED)
@limiter.limit("3/hour")
def contact(body: ContactRequest, request: Request):
    settings = get_settings()
    html = f"""
    <h2>New contact form submission</h2>
    <p><strong>Name:</strong> {body.name}</p>
    <p><strong>Email:</strong> {body.email}</p>
    <h3>Message</h3>
    <p>{body.message}</p>
    """
    send_email(settings.smtp_from_email, f"Contact: {body.name}", html)
    return {"message": "Message sent"}
