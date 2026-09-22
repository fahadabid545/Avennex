import logging

from app.database import get_supabase

logger = logging.getLogger(__name__)

KEEP_PER_ENTITY = 20

# every editable module keeps its own history, and restoring writes back
# through the module's own table
ENTITY_TABLES = {
    "blog": "blogs",
    "job": "jobs",
    "product": "products",
    "launchpad": "launchpad_entries",
    "faq": "faqs",
}

# what identifies a row or is written by the database itself never comes
# back from a snapshot
SKIP_ON_RESTORE = ("id", "created_at", "updated_at", "last_edited_by", "last_edited_at")

TITLE_FIELDS = ("title", "name", "question")

# dragging rows into a new order is not an edit worth keeping a copy of
MINOR_FIELDS = {"display_order", "last_edited_by", "last_edited_at", "updated_at"}


def is_minor(data: dict) -> bool:
    return not (set(data or {}) - MINOR_FIELDS)


def record_before(entity_type: str, entity_id: str, loader, admin_email: str, data: dict = None):
    if data is not None and is_minor(data):
        return None
    try:
        snapshot = loader(entity_id)
    except Exception as e:
        logger.warning("Could not read %s %s before an edit: %s", entity_type, entity_id, e)
        return None
    return record(entity_type, entity_id, snapshot, admin_email)


def title_of(snapshot: dict) -> str:
    for field in TITLE_FIELDS:
        if snapshot.get(field):
            return str(snapshot[field])
    return ""


def record(entity_type: str, entity_id: str, snapshot: dict, admin_email: str):
    """Keep a copy of a row as it stood before an edit. A history that fails
    to save must never stop the edit itself."""
    if entity_type not in ENTITY_TABLES or not snapshot:
        return None
    try:
        db = get_supabase()
        saved = db.table("content_revisions").insert({
            "entity_type": entity_type,
            "entity_id": entity_id,
            "snapshot": snapshot,
            "admin_email": admin_email,
        }).execute()
        _prune(entity_type, entity_id)
        return saved.data[0] if saved.data else None
    except Exception as e:
        logger.warning("Revision not stored for %s %s: %s", entity_type, entity_id, e)
        return None


def _prune(entity_type: str, entity_id: str):
    db = get_supabase()
    rows = (
        db.table("content_revisions")
        .select("id")
        .eq("entity_type", entity_type)
        .eq("entity_id", entity_id)
        .order("created_at", desc=True)
        .execute()
    )
    extra = (rows.data or [])[KEEP_PER_ENTITY:]
    for row in extra:
        db.table("content_revisions").delete().eq("id", row["id"]).execute()


def _changed_fields(newer: dict, older: dict) -> list:
    keys = set(newer or {}) | set(older or {})
    return sorted(k for k in keys if (newer or {}).get(k) != (older or {}).get(k))


def list_for(entity_type: str, entity_id: str, current: dict = None):
    """Newest first. Each entry names the fields it differs by, measured
    against the state that replaced it."""
    db = get_supabase()
    rows = (
        db.table("content_revisions")
        .select("*")
        .eq("entity_type", entity_type)
        .eq("entity_id", entity_id)
        .order("created_at", desc=True)
        .execute()
    ).data or []

    out = []
    for index, row in enumerate(rows):
        replaced_by = current if index == 0 else rows[index - 1].get("snapshot")
        out.append({
            "id": row["id"],
            "admin_email": row.get("admin_email"),
            "created_at": row.get("created_at"),
            "title": title_of(row.get("snapshot") or {}),
            "changed": [
                f for f in _changed_fields(replaced_by or {}, row.get("snapshot") or {})
                if f not in SKIP_ON_RESTORE
            ],
        })
    return out


def get(revision_id: str):
    db = get_supabase()
    result = db.table("content_revisions").select("*").eq("id", revision_id).execute()
    return result.data[0] if result.data else None


def restore(revision_id: str, admin_email: str):
    """Put a row back the way a revision found it, after keeping a copy of
    what is there now so the restore itself can be undone."""
    revision = get(revision_id)
    if not revision:
        return None, "Revision not found"

    entity_type = revision["entity_type"]
    table = ENTITY_TABLES.get(entity_type)
    if not table:
        return None, "Unknown content type"

    db = get_supabase()
    live = db.table(table).select("*").eq("id", revision["entity_id"]).execute()
    if not live.data:
        return None, "That record no longer exists"

    record(entity_type, revision["entity_id"], live.data[0], admin_email)

    patch = {k: v for k, v in (revision.get("snapshot") or {}).items() if k not in SKIP_ON_RESTORE}
    patch["last_edited_by"] = admin_email
    from datetime import datetime, timezone
    patch["last_edited_at"] = datetime.now(timezone.utc).isoformat()

    result = db.table(table).update(patch).eq("id", revision["entity_id"]).execute()
    if not result.data:
        return None, "Could not write the restored version"
    return result.data[0], None
