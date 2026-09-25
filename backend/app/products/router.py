import logging
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File, status

from app.auth.dependencies import get_current_user, require_manager
from app.products import service
from app.products.schemas import ProductCreate, ProductUpdate, ProductResponse
from app.admin.service import log_activity
from app.revisions import service as revisions
from app.uploads import documents

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/products", tags=["products"])


@router.get("", response_model=list[ProductResponse])
def list_products(page: int = Query(1, ge=1), limit: int = Query(10, ge=1, le=50)):
    return service.list_all(page, limit)


@router.get("/admin/all", response_model=list[ProductResponse])
def list_all_products(
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=100),
    _user: dict = Depends(get_current_user),
):
    return service.list_all(page, limit)


@router.get("/{slug}", response_model=ProductResponse)
def get_product(slug: str):
    product = service.get_by_slug(slug)
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    return product


@router.post("", response_model=ProductResponse, status_code=status.HTTP_201_CREATED)
def create_product(body: ProductCreate, _user: dict = Depends(get_current_user)):
    data = body.model_dump(exclude_none=True)
    data["last_edited_by"] = _user["email"]
    data["last_edited_at"] = datetime.now(timezone.utc).isoformat()
    try:
        result = service.create(data)
    except Exception:
        raise HTTPException(status_code=500, detail="The product could not be saved. The reason is in the server log.")
    if not result:
        logger.error("Product insert for %s reported no row", data.get("slug"))
        raise HTTPException(status_code=500, detail="The product could not be saved. The reason is in the server log.")
    log_activity(_user["email"], "create", "product", result["id"], result["name"])
    return result


@router.put("/{id}", response_model=ProductResponse)
def update_product(id: str, body: ProductUpdate, _user: dict = Depends(get_current_user)):
    data = body.model_dump(exclude_unset=True)
    if not data:
        raise HTTPException(status_code=400, detail="No fields to update")
    data["last_edited_by"] = _user["email"]
    data["last_edited_at"] = datetime.now(timezone.utc).isoformat()
    revisions.record_before("product", id, service.get_by_id, _user["email"], data)
    # a raised error is the database refusing the write, an empty result is
    # simply no row with that id, and the two deserve different answers
    try:
        result = service.update(id, data)
    except Exception:
        raise HTTPException(status_code=500, detail="The changes could not be saved. The reason is in the server log.")
    if not result:
        raise HTTPException(status_code=404, detail="Product not found")
    log_activity(_user["email"], "update", "product", result["id"], result["name"])
    return result


@router.get("/admin/chat-stats")
def product_chat_stats(_user: dict = Depends(get_current_user)):
    from app.product_chat import service as chat_service
    products = service.list_all(1, 50)
    if not products:
        return []
    ids = [p["id"] for p in products]
    counts = chat_service.count_by_products(ids)
    stats = []
    for p in products:
        daily = {}
        try:
            daily = chat_service.count_by_product_daily(p["id"])
        except Exception:
            pass
        stats.append({
            "product_id": p["id"],
            "name": p["name"],
            "slug": p["slug"],
            "status": p["status"],
            "progress": p["progress"],
            "chat_count": counts.get(p["id"], 0),
            "chat_daily": daily,
        })
    return stats


@router.post("/{id}/upload-document")
async def upload_document(
    id: str,
    file: UploadFile = File(...),
    preview: UploadFile | None = File(None),
    _user: dict = Depends(get_current_user),
):
    content = await file.read()
    preview_bytes = await preview.read() if preview else None
    return documents.store("product", id, file.filename, content, preview_bytes, _user["email"])


@router.delete("/{id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_product(id: str, _user: dict = Depends(require_manager)):
    product = service.get_by_id(id)
    if not service.delete(id):
        raise HTTPException(status_code=404, detail="Product not found")
    log_activity(_user["email"], "delete", "product", id, product["name"] if product else id)
