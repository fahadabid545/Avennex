from fastapi import APIRouter, Depends, HTTPException, status

from app.auth.dependencies import get_current_user
from app.chat import service
from app.chat.schemas import ChatMessageCreate, ChatReply, ChatMessageUpdate
from app.email.service import send_email
from app.admin.service import log_activity

router = APIRouter(prefix="/api/chat", tags=["chat"])


@router.post("/send", status_code=status.HTTP_201_CREATED)
def send_message(body: ChatMessageCreate):
    result = service.create_message({
        "author_name": body.author_name,
        "author_email": body.author_email,
        "author_profession": body.author_profession,
        "author_company": body.author_company,
        "message": body.message,
    })
    return {"message": "Message sent"}


@router.get("/messages")
def list_messages():
    return service.list_public()


@router.get("/admin/messages")
def list_admin_messages(_user: dict = Depends(get_current_user)):
    return service.list_admin()


@router.post("/{id}/reply", status_code=status.HTTP_201_CREATED)
def reply_to_message(id: str, body: ChatReply, _user: dict = Depends(get_current_user)):
    original = service.get_by_id(id)
    if not original:
        raise HTTPException(status_code=404, detail="Message not found")

    result = service.create_reply(id, body.message)

    if original.get("author_email"):
        html = f"""
        <h2>Avennex replied to your message</h2>
        <p><strong>Your message:</strong></p>
        <blockquote>{original['message']}</blockquote>
        <p><strong>Reply:</strong></p>
        <p>{body.message}</p>
        <p><a href="https://avennex.com/#chat">View the conversation</a></p>
        """
        send_email(original["author_email"], "Avennex replied to your message", html)
        service.clear_personal_data(id)

    log_activity(_user["email"], "reply", "chat", id, original.get("author_name", "message"))
    return result


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
    if not msg.get("is_admin"):
        raise HTTPException(status_code=403, detail="Can only edit admin messages")
    data = body.model_dump(exclude_none=True)
    if not data:
        raise HTTPException(status_code=400, detail="No fields to update")
    result = service.update_message(id, data)
    log_activity(_user["email"], "update", "chat", id, "admin reply")
    return result
