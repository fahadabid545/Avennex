import re
from datetime import datetime, timezone

from app.database import get_supabase
from app.blogs.service import slugify


def extract_youtube_id(url: str) -> str:
    patterns = [
        r'(?:youtube\.com/watch\?v=|youtu\.be/|youtube\.com/embed/)([a-zA-Z0-9_-]{11})',
        r'youtube\.com/shorts/([a-zA-Z0-9_-]{11})',
    ]
    for pattern in patterns:
        match = re.search(pattern, url)
        if match:
            return match.group(1)
    return ""


def get_thumbnail(youtube_url: str) -> str:
    vid = extract_youtube_id(youtube_url)
    if vid:
        return f"https://img.youtube.com/vi/{vid}/hqdefault.jpg"
    return ""


def list_playlists():
    db = get_supabase()
    result = (
        db.table("academy_playlists")
        .select("*")
        .order("display_order")
        .execute()
    )
    playlists = result.data or []
    if not playlists:
        return []

    playlist_ids = [p["id"] for p in playlists]
    videos = (
        db.table("academy_videos")
        .select("id, playlist_id, youtube_url, display_order")
        .in_("playlist_id", playlist_ids)
        .order("display_order")
        .execute()
    )

    counts = {}
    first_thumbs = {}
    for v in (videos.data or []):
        pid = v["playlist_id"]
        counts[pid] = counts.get(pid, 0) + 1
        if pid not in first_thumbs:
            first_thumbs[pid] = get_thumbnail(v["youtube_url"])

    for p in playlists:
        p["video_count"] = counts.get(p["id"], 0)
        p["thumbnail"] = first_thumbs.get(p["id"], "")

    return playlists


def list_playlists_admin():
    db = get_supabase()
    result = (
        db.table("academy_playlists")
        .select("*")
        .order("display_order")
        .execute()
    )
    playlists = result.data or []
    if not playlists:
        return []

    playlist_ids = [p["id"] for p in playlists]
    videos = (
        db.table("academy_videos")
        .select("id, playlist_id")
        .in_("playlist_id", playlist_ids)
        .execute()
    )

    counts = {}
    for v in (videos.data or []):
        pid = v["playlist_id"]
        counts[pid] = counts.get(pid, 0) + 1

    for p in playlists:
        p["video_count"] = counts.get(p["id"], 0)

    return playlists


def get_playlist_by_slug(slug: str):
    db = get_supabase()
    result = (
        db.table("academy_playlists")
        .select("*")
        .eq("slug", slug)
        .execute()
    )
    if not result.data:
        return None

    playlist = result.data[0]
    videos = (
        db.table("academy_videos")
        .select("*")
        .eq("playlist_id", playlist["id"])
        .order("display_order")
        .execute()
    )
    for v in (videos.data or []):
        v["thumbnail_url"] = get_thumbnail(v["youtube_url"])

    playlist["videos"] = videos.data or []
    playlist["video_count"] = len(playlist["videos"])
    return playlist


def get_playlist_by_id(playlist_id: str):
    db = get_supabase()
    result = db.table("academy_playlists").select("*").eq("id", playlist_id).execute()
    return result.data[0] if result.data else None


def create_playlist(data: dict):
    db = get_supabase()
    if not data.get("slug"):
        data["slug"] = slugify(data["title"])
    result = db.table("academy_playlists").insert(data).execute()
    return result.data[0] if result.data else None


def update_playlist(playlist_id: str, data: dict):
    db = get_supabase()
    data["updated_at"] = datetime.now(timezone.utc).isoformat()
    result = db.table("academy_playlists").update(data).eq("id", playlist_id).execute()
    return result.data[0] if result.data else None


def delete_playlist(playlist_id: str):
    db = get_supabase()
    db.table("academy_videos").delete().eq("playlist_id", playlist_id).execute()
    result = db.table("academy_playlists").delete().eq("id", playlist_id).execute()
    return bool(result.data)


def create_video(data: dict):
    db = get_supabase()
    data["thumbnail_url"] = get_thumbnail(data.get("youtube_url", ""))
    result = db.table("academy_videos").insert(data).execute()
    return result.data[0] if result.data else None


def update_video(video_id: str, data: dict):
    db = get_supabase()
    data["updated_at"] = datetime.now(timezone.utc).isoformat()
    if "youtube_url" in data:
        data["thumbnail_url"] = get_thumbnail(data["youtube_url"])
    result = db.table("academy_videos").update(data).eq("id", video_id).execute()
    return result.data[0] if result.data else None


def delete_video(video_id: str):
    db = get_supabase()
    result = db.table("academy_videos").delete().eq("id", video_id).execute()
    return bool(result.data)


def get_video_by_id(video_id: str):
    db = get_supabase()
    result = db.table("academy_videos").select("*").eq("id", video_id).execute()
    return result.data[0] if result.data else None
