import logging
from html import escape as html_escape

from fastapi import APIRouter, Depends, HTTPException, Request, status
from slowapi import Limiter
from slowapi.util import get_remote_address

from app.auth.dependencies import get_current_user
from app.chat import service
from app.chat.schemas import ChatMessageCreate, ChatReply, ChatMessageUpdate
from app.email.service import send_email, is_email_enabled
from app.admin.service import log_activity

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/chat", tags=["chat"])
limiter = Limiter(key_func=get_remote_address)


@router.post("/send", status_code=status.HTTP_201_CREATED)
@limiter.limit("5/minute")
def send_message(body: ChatMessageCreate, request: Request):
    try:
        service.create_message({
            "author_name": body.author_name,
            "author_email": body.author_email,
            "author_profession": body.author_profession,
            "author_company": body.author_company,
            "message": body.message,
        })
        return {"success": True, "message": "Message sent"}
    except Exception as e:
        logger.error("Failed to save chat message: %s", e)
        raise HTTPException(status_code=500, detail="Failed to send message")


@router.get("/messages")
def list_messages():
    try:
        return service.list_public()
    except Exception as e:
        logger.error("Failed to list messages: %s", e)
        return []


@router.get("/admin/messages")
def list_admin_messages(_user: dict = Depends(get_current_user)):
    try:
        return service.list_admin()
    except Exception as e:
        logger.error("Failed to list admin messages: %s", e)
        return []


@router.post("/{id}/reply", status_code=status.HTTP_201_CREATED)
def reply_to_message(id: str, body: ChatReply, _user: dict = Depends(get_current_user)):
    original = service.get_by_id(id)
    if not original:
        raise HTTPException(status_code=404, detail="Message not found")

    result = service.create_reply(id, body.message)
    warnings = []

    email_status = "skipped"
    if original.get("author_email"):
        if not is_email_enabled():
            email_status = "disabled"
        else:
            try:
                html = f"""
                <h2>Avennex replied to your message</h2>
                <p><strong>Your message:</strong></p>
                <blockquote>{html_escape(original['message'])}</blockquote>
                <p><strong>Reply:</strong></p>
                <p>{html_escape(body.message)}</p>
                <p><a href="https://avennex.com/#chat">View the conversation</a></p>
                """
                sent = send_email(original["author_email"], "Avennex replied to your message", html)
                email_status = "sent" if sent else "failed"
            except Exception as e:
                logger.error("Failed to send reply email: %s", e)
                email_status = "failed"
                warnings.append(f"Email notification failed: {e}")
        service.clear_personal_data(id)

    try:
        from app.database import get_supabase
        db = get_supabase()
        db.table("chat_messages").update({"email_status": email_status}).eq("id", result["id"]).execute()
    except Exception:
        pass

    log_activity(_user["email"], "reply", "chat", id, original.get("author_name", "message"))

    response = {"success": True, "data": result}
    if warnings:
        response["warnings"] = warnings
    return response


@router.delete("/{id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_message(id: str, _user: dict = Depends(get_current_user)):
    msg = service.get_by_id(id)
    if not service.delete_message(id):
        raise HTTPException(status_code=404, detail="Message not found")
    log_activity(_user["email"], "delete", "chat", id, msg.get("author_name", "message") if msg else id)


@router.put("/{id}")
def update_message(id: str, body: ChatMessageUpdate, _user: dict = Depends(get_current_user)):
    msg = service.get_by_id(id)
    if not msg:
        raise HTTPException(status_code=404, detail="Message not found")
    data = body.model_dump(exclude_none=True)
    if not data:
        raise HTTPException(status_code=400, detail="No fields to update")
    result = service.update_message(id, data)
    log_activity(_user["email"], "update", "chat", id, msg.get("author_name", "admin reply"))
    return result
