"""Checks on the project report a product or launchpad idea carries.

The report is shaped and read by the admin panel and the public page, so the
server only makes sure it is an object with known sections and a sane size.
"""
import json

MAX_REPORT_BYTES = 200 * 1024

SECTIONS = {
    "status", "roadmap", "burnup", "pace", "quality", "speed",
    "security", "basics", "team", "feedback", "changelog", "pilots",
}


def validate_report(value):
    if value is None:
        return value
    if not isinstance(value, dict):
        raise ValueError("report must be an object")
    unknown = set(value) - SECTIONS
    if unknown:
        raise ValueError(f"Unknown report sections: {', '.join(sorted(unknown))}")
    if len(json.dumps(value)) > MAX_REPORT_BYTES:
        raise ValueError("The report is too large. Trim the longest lists and try again.")
    return value
