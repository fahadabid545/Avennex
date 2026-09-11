import logging
from datetime import datetime, timezone

logger = logging.getLogger(__name__)

MAX_POINTS = 240


def _clean(history) -> list:
    if not isinstance(history, list):
        return []
    return [
        {"at": h["at"], "value": int(h["value"])}
        for h in history
        if isinstance(h, dict) and h.get("at") and str(h.get("value", "")).lstrip("-").isdigit()
    ]


def stamp(data: dict, existing: dict | None = None) -> dict:
    """Append a timestamped point whenever the admin moves the progress value.

    The history is what the velocity chart is drawn from, so it has to be
    recorded here rather than guessed on the way out. A failure to record a
    point never blocks the row from being saved.
    """
    if "progress" not in data:
        return data
    try:
        value = int(data["progress"])
    except (TypeError, ValueError):
        return data

    try:
        history = _clean((existing or {}).get("progress_history"))
        if history and history[-1]["value"] == value:
            return data
        history.append({"at": datetime.now(timezone.utc).isoformat(), "value": value})
        data["progress_history"] = history[-MAX_POINTS:]
    except Exception as e:
        logger.warning("Could not record progress history: %s", e)
    return data
