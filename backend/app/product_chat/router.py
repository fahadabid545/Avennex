import logging
from html import escape as html_escape

from fastapi import APIRouter, Depends, HTTPException, Request, status
from slowapi import Limiter
from slowapi.util import get_remote_address

from app.auth.dependencies import get_current_user
from app.product_chat import service
from app.product_chat.schemas import ProductChatMessageCreate, ProductChatReply
from app.products.service import get_by_slug
from app.email.service import send_email, is_email_enabled
from app.settings.service import get_setting
from app.admin.service import log_activity

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/products", tags=["product-chat"])
limiter = Limiter(key_func=get_remote_address)


def _check_chat_enabled(product):
    global_setting = get_setting("product_chat_enabled")
    if not global_setting or global_setting.get("value") != "true":
        raise HTTPException(status_code=403, detail="Product chat is disabled")
    if not product.get("chat_enabled"):
        raise HTTPException(status_code=403, detail="Chat is disabled for this product")


@router.post("/{slug}/chat/send", status_code=status.HTTP_201_CREATED)
@limiter.limit("5/minute")
def send_message(slug: str, body: ProductChatMessageCreate, request: Request):
    product = get_by_slug(slug)
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    _check_chat_enabled(product)

    try:
        service.create_message({
            "product_id": product["id"],
            "author_name": body.author_name,
            "author_email": body.author_email,
            "message": body.message,
        })
        return {"success": True, "message": "Message sent"}
    except Exception as e:
        logger.error("Failed to save product chat message: %s", e)
        raise HTTPException(status_code=500, detail="Failed to send message")


@router.get("/{slug}/chat/activity")
def chat_activity(slug: str, days: int = 90):
    product = get_by_slug(slug)
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    window = max(7, min(365, days))
    try:
        series = service.daily_activity(product["id"], window)
        total = sum(point["count"] for point in series)
        return {"success": True, "daily": series, "total": total, "days": window, "warnings": []}
    except Exception as e:
        logger.error("Failed to read chat activity for %s: %s", slug, e)
        return {
            "success": False,
            "daily": [],
            "total": 0,
            "days": window,
            "warnings": [f"discussion activity unavailable: {e}"],
        }


@router.get("/{slug}/chat/messages")
def list_messages(slug: str):
    product = get_by_slug(slug)
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    try:
        return service.list_public(product["id"])
    except Exception as e:
        logger.error("Failed to list product chat messages: %s", e)
        return []


@router.get("/{slug}/chat/admin/messages")
def list_admin_messages(slug: str, _user: dict = Depends(get_current_user)):
    product = get_by_slug(slug)
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    try:
        return service.list_admin(product["id"])
    except Exception as e:
        logger.error("Failed to list admin product chat messages: %s", e)
        return []


@router.post("/{slug}/chat/{id}/reply", status_code=status.HTTP_201_CREATED)
def reply_to_message(slug: str, id: str, body: ProductChatReply, _user: dict = Depends(get_current_user)):
    product = get_by_slug(slug)
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    original = service.get_by_id(id)
    if not original:
        raise HTTPException(status_code=404, detail="Message not found")

    result = service.create_reply(id, product["id"], body.message)
    warnings = []

    email_status = "skipped"
    if original.get("author_email"):
        if not is_email_enabled():
            email_status = "disabled"
        else:
            try:
                html = f"""
                <h2>Avennex replied to your message on {html_escape(product['name'])}</h2>
                <p><strong>Your message:</strong></p>
                <blockquote>{html_escape(original['message'])}</blockquote>
                <p><strong>Reply:</strong></p>
                <p>{html_escape(body.message)}</p>
                <p><a href="https://avennex.com/product-detail.html?slug={html_escape(product['slug'])}">View the conversation</a></p>
                """
                sent = send_email(original["author_email"], f"Avennex replied on {product['name']}", html)
                email_status = "sent" if sent else "failed"
            except Exception as e:
                logger.error("Failed to send product chat reply email: %s", e)
                email_status = "failed"
                warnings.append(f"Email notification failed: {e}")

    try:
        from app.database import get_supabase
        db = get_supabase()
        db.table("product_chat_messages").update({"email_status": email_status}).eq("id", result["id"]).execute()
    except Exception:
        pass

    log_activity(_user["email"], "reply", "product-chat", id, f"{product['name']}: {original.get('author_name', 'message')}")

    response = {"success": True, "data": result}
    if warnings:
        response["warnings"] = warnings
    return response


@router.delete("/{slug}/chat/{id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_message(slug: str, id: str, _user: dict = Depends(get_current_user)):
    product = get_by_slug(slug)
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    msg = service.get_by_id(id)
    if not service.delete_message(id):
        raise HTTPException(status_code=404, detail="Message not found")
    log_activity(_user["email"], "delete", "product-chat", id, msg.get("author_name", "message") if msg else id)
