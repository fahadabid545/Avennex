import logging
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

from app.config import get_settings

logger = logging.getLogger(__name__)


def is_email_enabled() -> bool:
    try:
        from app.database import get_supabase
        db = get_supabase()
        result = db.table("settings").select("value").eq("key", "emails_enabled").execute()
        if result.data:
            return result.data[0]["value"] == "true"
    except Exception:
        pass
    return True


def send_email(to: str, subject: str, body_html: str, email_type: str = "general") -> bool:
    settings = get_settings()
    if not settings.smtp_host:
        return False

    if email_type == "careers":
        user = settings.smtp_careers_user or settings.smtp_general_user or settings.smtp_user
        password = settings.smtp_careers_password or settings.smtp_general_password or settings.smtp_password
        from_addr = settings.smtp_from_careers or settings.smtp_from_general or settings.smtp_from_email
    else:
        user = settings.smtp_general_user or settings.smtp_user
        password = settings.smtp_general_password or settings.smtp_password
        from_addr = settings.smtp_from_general or settings.smtp_from_email

    if not user or not password:
        return False

    try:
        msg = MIMEMultipart("alternative")
        msg["Subject"] = subject
        msg["From"] = from_addr
        msg["To"] = to
        msg.attach(MIMEText(body_html, "html"))

        with smtplib.SMTP(settings.smtp_host, settings.smtp_port) as server:
            server.starttls()
            server.login(user, password)
            server.send_message(msg)

        return True
    except Exception as e:
        logger.error("Email send failed to %s: %s", to, e)
        return False
