from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.auth.dependencies import get_current_user
from app.blogs import service
from app.blogs.schemas import BlogCreate, BlogUpdate, BlogResponse

router = APIRouter(prefix="/api/blogs", tags=["blogs"])


@router.get("", response_model=list[BlogResponse])
def list_blogs(page: int = Query(1, ge=1), limit: int = Query(10, ge=1, le=50)):
    return service.list_published(page, limit)


@router.get("/admin/all", response_model=list[BlogResponse])
def list_all_blogs(
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=100),
    _user: dict = Depends(get_current_user),
):
    return service.list_all(page, limit)


@router.get("/{slug}", response_model=BlogResponse)
def get_blog(slug: str):
    blog = service.get_by_slug(slug)
    if not blog:
        raise HTTPException(status_code=404, detail="Blog not found")
    return blog


@router.post("", response_model=BlogResponse, status_code=status.HTTP_201_CREATED)
def create_blog(body: BlogCreate, _user: dict = Depends(get_current_user)):
    return service.create(body.model_dump(exclude_none=True))


@router.put("/{id}", response_model=BlogResponse)
def update_blog(id: str, body: BlogUpdate, _user: dict = Depends(get_current_user)):
    data = body.model_dump(exclude_none=True)
    if not data:
        raise HTTPException(status_code=400, detail="No fields to update")
    result = service.update(id, data)
    if not result:
        raise HTTPException(status_code=404, detail="Blog not found")
    return result


@router.delete("/{id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_blog(id: str, _user: dict = Depends(get_current_user)):
    if not service.delete(id):
        raise HTTPException(status_code=404, detail="Blog not found")
