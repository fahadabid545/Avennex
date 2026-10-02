"""Every email the site sends, built on one layout.

Each builder returns (subject, html, text). The plain text part matters as
much as the HTML: mail filters score an HTML-only message as more likely to
be spam, and some readers only ever see the text."""
from datetime import datetime, timezone
from html import escape
from urllib.parse import quote



def _site() -> str:
    from app.config import get_settings
    return get_settings().site_base


def _domain() -> str:
    return _site().split("://", 1)[-1]
INK = "#14111f"
MUTED = "#5f5a70"
LINE = "#e7e4ee"
ROYAL = "#6d28d9"
WASH = "#f6f4fb"


def _e(value) -> str:
    return escape(str(value or ""))


def _first_name(name: str) -> str:
    return (name or "").strip().split(" ")[0] or "there"


def _paragraphs(text: str) -> str:
    blocks = [b.strip() for b in str(text or "").split("\n\n") if b.strip()]
    return "".join(
        f'<p style="margin:0 0 12px;font-size:15px;line-height:1.6;color:{INK};">{_e(b).replace(chr(10), "<br>")}</p>'
        for b in blocks
    ) or f'<p style="margin:0;color:{MUTED};font-size:15px;">Not provided</p>'


def _today() -> str:
    return datetime.now(timezone.utc).strftime("%d %B %Y").lstrip("0")


def _button(href: str, label: str) -> str:
    return (
        f'<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:24px 0 8px;">'
        f'<tr><td style="border-radius:8px;background:{ROYAL};">'
        f'<a href="{_e(href)}" style="display:inline-block;padding:13px 22px;font-size:15px;font-weight:600;'
        f'color:#ffffff;text-decoration:none;border-radius:8px;">{_e(label)}</a>'
        f'</td></tr></table>'
    )


def _details(rows) -> str:
    cells = "".join(
        f'<tr><td style="padding:10px 0;border-bottom:1px solid {LINE};font-size:13px;color:{MUTED};width:38%;vertical-align:top;">{_e(k)}</td>'
        f'<td style="padding:10px 0;border-bottom:1px solid {LINE};font-size:14px;color:{INK};vertical-align:top;">{v}</td></tr>'
        for k, v in rows
    )
    return f'<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:20px 0;">{cells}</table>'


def _section(title: str, inner: str) -> str:
    return (
        f'<h2 style="margin:28px 0 10px;font-size:13px;letter-spacing:0.08em;text-transform:uppercase;color:{MUTED};font-weight:700;">{_e(title)}</h2>'
        f'<div style="padding:16px 18px;background:{WASH};border-radius:8px;">{inner}</div>'
    )


def _layout(preheader: str, body: str, note: str) -> str:
    return f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light">
<title>Avennex</title>
</head>
<body style="margin:0;padding:0;background:#f1eff6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">{_e(preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f1eff6;">
<tr><td align="center" style="padding:32px 16px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;">
<tr><td style="padding:0 4px 18px;font-size:22px;font-weight:700;letter-spacing:-0.02em;color:{INK};">aven<span style="color:{ROYAL};">nex</span></td></tr>
<tr><td style="background:#ffffff;border-radius:12px;padding:36px 36px 30px;border:1px solid {LINE};">
{body}
</td></tr>
<tr><td style="padding:20px 6px 0;font-size:12px;line-height:1.6;color:{MUTED};">
{_e(note)}<br>
Avennex &middot; Custom software, AI and automation &middot; <a href="{_site()}" style="color:{MUTED};">{_domain()}</a>
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>"""


def _text(*parts) -> str:
    lines = [p for p in parts if p is not None]
    lines += ["", "--", "Avennex | Custom software, AI and automation", _site()]
    return "\n".join(lines)


def _h1(text: str) -> str:
    return f'<h1 style="margin:0 0 18px;font-size:22px;line-height:1.3;color:{INK};font-weight:700;">{_e(text)}</h1>'


def _p(html: str) -> str:
    return f'<p style="margin:0 0 14px;font-size:15px;line-height:1.65;color:{INK};">{html}</p>'


# ---------- careers ----------

def application_received(name: str, job_title: str, resume_attached: bool):
    subject = f"We've received your application for {job_title}"
    body = (
        _h1(f"Thanks for applying, {_first_name(name)}")
        + _p(f"Your application for the <strong>{_e(job_title)}</strong> role at Avennex has reached our hiring team. "
             "A person reads every application, not a filter.")
        + _details([
            ("Role", _e(job_title)),
            ("Submitted", _e(_today())),
            ("Resume", "Attached" if resume_attached else "Not attached"),
        ])
        + f'<h2 style="margin:24px 0 8px;font-size:16px;color:{INK};">What happens next</h2>'
        + _p("We'll look at your experience against what the role needs. If there's a fit, we'll email you to set up "
             "a short first conversation with the team.")
        + _p("Want to add something, like a portfolio link? Just reply to this email.")
        + _p("Best,<br>The Avennex team")
    )
    html = _layout(
        "Your application is in. Here's what happens next.",
        body,
        f"You're receiving this because you applied for {job_title} on {_domain()}.",
    )
    text = _text(
        f"Hi {_first_name(name)},",
        "",
        f"Thanks for applying. Your application for the {job_title} role at Avennex has reached our hiring team. "
        "A person reads every application, not a filter.",
        "",
        f"Role: {job_title}",
        f"Submitted: {_today()}",
        f"Resume: {'Attached' if resume_attached else 'Not attached'}",
        "",
        "What happens next",
        "We'll look at your experience against what the role needs. If there's a fit, we'll email you to set up "
        "a short first conversation with the team.",
        "",
        "Want to add something, like a portfolio link? Just reply to this email.",
        "",
        "Best,",
        "The Avennex team",
    )
    return subject, html, text


def application_alert(job_title: str, name: str, email: str, experience: str, cover_letter: str,
                      answers: dict | None, resume_attached: bool):
    subject = f"New application: {job_title}, from {name}"
    answers = answers or {}
    body = (
        _h1(f"New application for {job_title}")
        + _details([
            ("Applicant", _e(name)),
            ("Email", f'<a href="mailto:{_e(email)}" style="color:{ROYAL};">{_e(email)}</a>'),
            ("Role", _e(job_title)),
            ("Received", _e(_today())),
            ("Resume", "Attached, open it in the admin panel" if resume_attached else "No file uploaded"),
        ])
        + _section("Experience", _paragraphs(experience))
        + (_section("Cover letter", _paragraphs(cover_letter)) if cover_letter else "")
        + "".join(_section(q, _paragraphs(a)) for q, a in answers.items())
        + _button(f"{_site()}/admin/dashboard.html#/jobs", "Open in the admin panel")
        + f'<p style="margin:10px 0 0;font-size:13px;color:{MUTED};">Replying to this email writes to the applicant.</p>'
    )
    html = _layout(f"{name} applied for {job_title}.", body, "Sent to the Avennex hiring team.")
    text = _text(
        f"New application for {job_title}",
        "",
        f"Applicant: {name}",
        f"Email: {email}",
        f"Received: {_today()}",
        f"Resume: {'Attached, open it in the admin panel' if resume_attached else 'No file uploaded'}",
        "",
        "Experience:",
        experience or "Not provided",
        "",
        *(["Cover letter:", cover_letter, ""] if cover_letter else []),
        *[line for q, a in answers.items() for line in (f"{q}:", str(a), "")],
        f"Open in the admin panel: {_site()}/admin/dashboard.html#/jobs",
    )
    return subject, html, text


# ---------- contact ----------

def contact_alert(name: str, email: str, message: str):
    subject = f"New enquiry from {name}"
    body = (
        _h1("New message from the website")
        + _details([
            ("From", _e(name)),
            ("Email", f'<a href="mailto:{_e(email)}" style="color:{ROYAL};">{_e(email)}</a>'),
            ("Received", _e(_today())),
        ])
        + _section("Message", _paragraphs(message))
        + _button(f"mailto:{email}", f"Reply to {_first_name(name)}")
        + f'<p style="margin:10px 0 0;font-size:13px;color:{MUTED};">Replying to this email writes straight to {_e(name)}.</p>'
    )
    html = _layout(f"{name} wrote in through the contact form.", body, f"Sent from the contact form on {_domain()}.")
    text = _text(
        "New message from the website",
        "",
        f"From: {name}",
        f"Email: {email}",
        f"Received: {_today()}",
        "",
        message,
    )
    return subject, html, text


# ---------- replies to visitors ----------

def _reply(name: str, where: str, link: str, link_label: str, original: str, reply: str, preheader: str, note: str):
    body = (
        _h1(f"Hi {_first_name(name)}, we've replied")
        + _p(f"Thanks for your message {where}. Here's our reply.")
        + f'<div style="margin:22px 0 0;padding:16px 18px;border-left:3px solid {LINE};">'
          f'<div style="font-size:12px;letter-spacing:0.06em;text-transform:uppercase;color:{MUTED};margin-bottom:8px;">You wrote</div>'
          f'{_paragraphs(original)}</div>'
        + f'<div style="margin:14px 0 0;padding:16px 18px;border-left:3px solid {ROYAL};background:{WASH};border-radius:0 8px 8px 0;">'
          f'<div style="font-size:12px;letter-spacing:0.06em;text-transform:uppercase;color:{ROYAL};margin-bottom:8px;">Avennex replied</div>'
          f'{_paragraphs(reply)}</div>'
        + _button(link, link_label)
        + _p("Prefer email? Reply here and it reaches the same team.")
    )
    html = _layout(preheader, body, note)
    text = _text(
        f"Hi {_first_name(name)},",
        "",
        f"Thanks for your message {where}. Here's our reply.",
        "",
        "You wrote:",
        original,
        "",
        "Avennex replied:",
        reply,
        "",
        f"{link_label}: {link}",
        "",
        "Prefer email? Reply here and it reaches the same team.",
    )
    return html, text


def chat_reply(name: str, original: str, reply: str):
    subject = f"We've replied to your message on {_domain()}"
    html, text = _reply(
        name, "on the Avennex website", f"{_site()}/#chat", "See the conversation", original, reply,
        "Our team answered your message.",
        f"You're receiving this because you left a message on {_domain()} with this email address.",
    )
    return subject, html, text


def product_chat_reply(name: str, product_name: str, slug: str, original: str, reply: str):
    subject = f"We've replied to your message about {product_name}"
    html, text = _reply(
        name, f"about {product_name}", f"{_site()}/product-detail.html?slug={quote(str(slug or ''))}", f"Open {product_name}",
        original, reply,
        f"Our team answered your question about {product_name}.",
        f"You're receiving this because you asked about {product_name} on {_domain()}.",
    )
    return subject, html, text


# ---------- admin ----------

def password_reset(email: str, link: str):
    subject = "Reset your Avennex admin password"
    body = (
        _h1("Reset your password")
        + _p(f"We received a request to reset the password for the admin account <strong>{_e(email)}</strong>.")
        + _button(link, "Choose a new password")
        + _p(f'<span style="color:{MUTED};font-size:14px;">The link works once and expires in 1 hour.</span>')
        + _p(f'<span style="color:{MUTED};font-size:14px;">Didn\'t ask for this? You can ignore this email. '
             'Your password stays the same.</span>')
    )
    html = _layout("Use this link within the hour to choose a new password.", body,
                   "Sent because a password reset was requested for this admin account.")
    text = _text(
        "Reset your password",
        "",
        f"We received a request to reset the password for the admin account {email}.",
        "",
        f"Choose a new password: {link}",
        "",
        "The link works once and expires in 1 hour.",
        "Didn't ask for this? You can ignore this email. Your password stays the same.",
    )
    return subject, html, text


def test_message(admin_email: str, email_type: str):
    label = "careers" if email_type == "careers" else "general"
    subject = f"Test email from the Avennex panel ({label})"
    body = (
        _h1("This is a test")
        + _p(f"<strong>{_e(admin_email)}</strong> sent this from Settings in the Avennex admin panel to check that "
             f"{label} emails arrive.")
        + _p("If you're reading it, sending works. Nothing else needs doing.")
    )
    html = _layout("Checking that site emails arrive.", body, "Sent from Settings in the Avennex admin panel.")
    text = _text(
        "This is a test",
        "",
        f"{admin_email} sent this from Settings in the Avennex admin panel to check that {label} emails arrive.",
        "",
        "If you're reading it, sending works. Nothing else needs doing.",
    )
    return subject, html, text
