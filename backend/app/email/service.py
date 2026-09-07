import logging
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

import requests

from app.config import get_settings

logger = logging.getLogger(__name__)

RESEND_API_URL = "https://api.resend.com/emails"


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


def _from_address(settings, email_type: str) -> str:
    if email_type == "careers":
        return settings.smtp_from_careers or "careers@avennex.com"
    return settings.smtp_from_general or "hello@avennex.com"


def _send_via_resend(settings, to: str, subject: str, body_html: str, email_type: str) -> bool:
    from_addr = _from_address(settings, email_type)
    try:
        response = requests.post(
            RESEND_API_URL,
            headers={
                "Authorization": f"Bearer {settings.resend_api_key}",
                "Content-Type": "application/json",
            },
            json={
                "from": from_addr,
                "to": [to],
                "subject": subject,
                "html": body_html,
            },
            timeout=10,
        )
        if response.ok:
            logger.info("Email sent to %s via Resend (%s)", to, subject)
            return True
        logger.error("Resend API rejected email to %s: %s %s", to, response.status_code, response.text)
        return False
    except requests.exceptions.RequestException as e:
        logger.error("Resend API request failed for email to %s: %s", to, e)
        return False


def _send_via_smtp(settings, to: str, subject: str, body_html: str, email_type: str) -> bool:
    if not settings.smtp_host:
        logger.warning("Email to %s not sent: SMTP_HOST is not configured", to)
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
        logger.warning(
            "Email to %s not sent: SMTP credentials missing for type '%s' (need SMTP_GENERAL_USER/SMTP_GENERAL_PASSWORD or SMTP_USER/SMTP_PASSWORD)",
            to, email_type,
        )
        return False

    try:
        msg = MIMEMultipart("alternative")
        msg["Subject"] = subject
        msg["From"] = from_addr
        msg["To"] = to
        msg.attach(MIMEText(body_html, "html"))

        if settings.smtp_port == 465:
            with smtplib.SMTP_SSL(settings.smtp_host, settings.smtp_port) as server:
                server.login(user, password)
                server.send_message(msg)
        else:
            with smtplib.SMTP(settings.smtp_host, settings.smtp_port) as server:
                server.starttls()
                server.login(user, password)
                server.send_message(msg)

        logger.info("Email sent to %s via SMTP (%s)", to, subject)
        return True
    except smtplib.SMTPAuthenticationError as e:
        logger.error("Email send failed to %s: SMTP authentication rejected: %s", to, e)
        return False
    except (smtplib.SMTPConnectError, smtplib.SMTPServerDisconnected, OSError) as e:
        logger.error("Email send failed to %s: could not connect to SMTP server %s:%s: %s", to, settings.smtp_host, settings.smtp_port, e)
        return False
    except Exception as e:
        logger.error("Email send failed to %s: %s", to, e)
        return False


def send_email(to: str, subject: str, body_html: str, email_type: str = "general") -> bool:
    settings = get_settings()
    if settings.resend_api_key:
        return _send_via_resend(settings, to, subject, body_html, email_type)
    return _send_via_smtp(settings, to, subject, body_html, email_type)
