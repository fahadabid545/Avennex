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


SENDER_NAMES = {"careers": "Avennex Careers", "general": "Avennex"}


def _with_name(address: str, email_type: str) -> str:
    # a bare address shows up as "careers" in the inbox and scores worse
    # with spam filters than a named sender
    if not address or "<" in address:
        return address
    return f"{SENDER_NAMES.get(email_type, 'Avennex')} <{address}>"


def _from_address(settings, email_type: str) -> str:
    if email_type == "careers":
        return _with_name(settings.smtp_from_careers or "careers@avennex.com", email_type)
    return _with_name(settings.smtp_from_general or "hello@avennex.com", email_type)


def _plain(html: str) -> str:
    import re
    text = re.sub(r"(?is)<(style|script|title)[^>]*>.*?</\1>", "", html)
    text = re.sub(r"(?i)<br\s*/?>|</p>|</div>|</tr>|</h[1-6]>", "\n", text)
    text = re.sub(r"<[^>]+>", "", text)
    from html import unescape
    return re.sub(r"\n{3,}", "\n\n", unescape(text)).strip()


def _send_via_resend(settings, to: str, subject: str, body_html: str, email_type: str,
                     text: str, reply_to: str | None) -> bool:
    from_addr = _from_address(settings, email_type)
    payload = {
        "from": from_addr,
        "to": [to],
        "subject": subject,
        "html": body_html,
        "text": text,
    }
    if reply_to:
        payload["reply_to"] = [reply_to]
    try:
        response = requests.post(
            RESEND_API_URL,
            headers={
                "Authorization": f"Bearer {settings.resend_api_key}",
                "Content-Type": "application/json",
            },
            json=payload,
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


def _send_via_smtp(settings, to: str, subject: str, body_html: str, email_type: str,
                   text: str, reply_to: str | None) -> bool:
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
    from_addr = _with_name(from_addr, email_type)

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
        if reply_to:
            msg["Reply-To"] = reply_to
        msg.attach(MIMEText(text, "plain", "utf-8"))
        msg.attach(MIMEText(body_html, "html", "utf-8"))

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


def send_email(to: str, subject: str, body_html: str, email_type: str = "general",
               text: str | None = None, reply_to: str | None = None) -> bool:
    settings = get_settings()
    text = text or _plain(body_html)
    subject = " ".join(str(subject or "").split())
    if settings.resend_api_key:
        return _send_via_resend(settings, to, subject, body_html, email_type, text, reply_to)
    return _send_via_smtp(settings, to, subject, body_html, email_type, text, reply_to)
