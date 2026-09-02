from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.auth.dependencies import get_current_user
from app.products import service
from app.products.schemas import ProductCreate, ProductUpdate, ProductResponse
from app.admin.service import log_activity

router = APIRouter(prefix="/api/products", tags=["products"])


@router.get("", response_model=list[ProductResponse])
def list_products(page: int = Query(1, ge=1), limit: int = Query(10, ge=1, le=50)):
    return service.list_all(page, limit)


@router.get("/{slug}", response_model=ProductResponse)
def get_product(slug: str):
    product = service.get_by_slug(slug)
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    return product


@router.post("", response_model=ProductResponse, status_code=status.HTTP_201_CREATED)
def create_product(body: ProductCreate, _user: dict = Depends(get_current_user)):
    result = service.create(body.model_dump(exclude_none=True))
    log_activity(_user["email"], "create", "product", result["id"], result["name"])
    return result


@router.put("/{id}", response_model=ProductResponse)
def update_product(id: str, body: ProductUpdate, _user: dict = Depends(get_current_user)):
    data = body.model_dump(exclude_none=True)
    if not data:
        raise HTTPException(status_code=400, detail="No fields to update")
    result = service.update(id, data)
    if not result:
        raise HTTPException(status_code=404, detail="Product not found")
    log_activity(_user["email"], "update", "product", result["id"], result["name"])
    return result


@router.delete("/{id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_product(id: str, _user: dict = Depends(get_current_user)):
    product = service.get_by_id(id)
    if not service.delete(id):
        raise HTTPException(status_code=404, detail="Product not found")
    log_activity(_user["email"], "delete", "product", id, product["name"] if product else id)
