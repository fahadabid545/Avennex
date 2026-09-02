from fastapi import APIRouter, Depends, HTTPException, status

from app.auth.dependencies import get_current_user
from app.faqs import service
from app.faqs.schemas import FaqCreate, FaqUpdate, FaqResponse
from app.admin.service import log_activity

router = APIRouter(prefix="/api/faqs", tags=["faqs"])


@router.get("", response_model=list[FaqResponse])
def list_faqs():
    return service.list_active()


@router.get("/admin/all", response_model=list[FaqResponse])
def list_all_faqs(_user: dict = Depends(get_current_user)):
    return service.list_all()


@router.post("", response_model=FaqResponse, status_code=status.HTTP_201_CREATED)
def create_faq(body: FaqCreate, _user: dict = Depends(get_current_user)):
    result = service.create(body.model_dump(exclude_none=True))
    log_activity(_user["email"], "create", "faq", result["id"], result["question"][:50])
    return result


@router.put("/{id}", response_model=FaqResponse)
def update_faq(id: str, body: FaqUpdate, _user: dict = Depends(get_current_user)):
    data = body.model_dump(exclude_none=True)
    if not data:
        raise HTTPException(status_code=400, detail="No fields to update")
    result = service.update(id, data)
    if not result:
        raise HTTPException(status_code=404, detail="FAQ not found")
    log_activity(_user["email"], "update", "faq", result["id"], result["question"][:50])
    return result


@router.delete("/{id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_faq(id: str, _user: dict = Depends(get_current_user)):
    faq = service.get_by_id(id)
    if not service.delete(id):
        raise HTTPException(status_code=404, detail="FAQ not found")
    log_activity(_user["email"], "delete", "faq", id, faq["question"][:50] if faq else id)
