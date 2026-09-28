"""Devpost: public listing JSON at devpost.com/api/hackathons (9 per page, format undocumented)."""
import re
from datetime import datetime, timezone

from .. import config
from ..models import Event
from ..normalize import (clean_city, find_indian_city, looks_indian, map_themes, parse_date,
                         parse_money, strip_html)

name = "devpost"
URL = "https://devpost.com/api/hackathons"


def fetch(client) -> list[dict]:
    out = []
    for page in range(1, config.MAX_PAGES + 1):
        data = client.get_json(URL, params=[("page", page), ("status[]", "upcoming"), ("status[]", "open")])
        items = data.get("hackathons") or []
        out += items
        if not items or len(out) >= data.get("meta", {}).get("total_count", 0):
            break
    return out


def split_period(text: str) -> tuple[str | None, str | None]:
    """'Sep 18 - 29, 2026' / 'Jul 31 - Oct 01, 2026' / 'Dec 15, 2026 - Jan 10, 2027' -> (start, end) strings."""
    if not text or " - " not in text:
        return None, None
    left, right = (s.strip() for s in text.split(" - ", 1))
    year = re.search(r"\d{4}", right)
    if not re.match(r"[A-Za-z]", right):           # 'Sep 18 - 29, 2026': month only on the left
        right = left.split()[0] + " " + right
    if year and not re.search(r"\d{4}", left):
        left = f"{left}, {year.group()}"
    return left, right


def parse(raw: dict) -> Event:
    loc = (raw.get("displayed_location") or {}).get("location") or ""
    online = (raw.get("displayed_location") or {}).get("icon") == "globe" or loc.strip().lower() == "online"
    start, end = split_period(raw.get("submission_period_dates"))
    prize_raw = raw.get("prize_amount")
    prize, approx = parse_money(prize_raw)
    city = None if online else (find_indian_city(loc) or clean_city(loc.split(",")[-1]))
    url = raw["url"]
    return Event(
        source=name,
        source_event_id=str(raw["id"]),
        source_url=url,
        title=strip_html(raw["title"], 200),
        registration_url=url,
        event_url=url,
        organizer=strip_html(raw.get("organization_name"), 150),
        mode="online" if online else "offline",
        venue_address=None if online else strip_html(loc, 300),
        city=city,
        in_india=None if online else (looks_indian(loc) or "₹" in (prize_raw or "")),
        is_open=raw.get("open_state") in ("open", "upcoming") and not raw.get("invite_only"),
        registration_deadline=parse_date(end, deadline=True),
        start_date=parse_date(start),
        end_date=parse_date(end, deadline=True),
        themes=map_themes(*(t.get("name") for t in raw.get("themes") or []), raw["title"]),
        prize_text=strip_html(prize_raw, 200) if prize else None,
        prize_amount_inr=prize or None,
        prize_approximate=approx,
    )


def is_relevant(e: Event) -> bool:
    still_open = e.registration_deadline is None or e.registration_deadline > datetime.now(timezone.utc)
    return e.is_open and still_open and (e.mode == "online" or bool(e.in_india))
