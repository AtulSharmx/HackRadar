"""Hackster.io: well-known hardware contests, run online with brands like Arduino and Infineon.
Public page hackster.io/contests. robots.txt allows it; the Terms have no clause against automated access
(checked 30 Oct 2026).

The page gives the name, sponsors and closing date. Prizes are hardware and vary by round, and the fee is
not stated, so neither is filled in.
"""
import re
from datetime import datetime, timezone

from ..models import Event
from ..normalize import parse_date, strip_html

name = "hackster"
BASE = "https://www.hackster.io"
URL = f"{BASE}/contests"
_CARD = re.compile(r'href="(/contests/[A-Za-z0-9_-]+)"><h4[^>]*>([^<]+)</h4></a>([\s\S]*?)'
                   r'Participation open until:</p><p[^>]*>([A-Z][a-z]{2} \d{1,2}, \d{4})')
_SPONSOR = re.compile(r'typography__linkBlue"[^>]*>([^<]+)</a>')


def contests_in(page: str) -> list[dict]:
    found = {}
    for path, title, rest, closes in _CARD.findall(page):
        sponsors = list(dict.fromkeys(_SPONSOR.findall(rest)))
        found.setdefault(path, {"path": path, "title": title, "sponsors": sponsors, "closes": closes})
    return list(found.values())


def fetch(client) -> list[dict]:
    return contests_in(client.get_text(URL))


def parse(raw: dict) -> Event:
    url = BASE + raw["path"]
    return Event(
        source=name,
        source_event_id=raw["path"].rsplit("/", 1)[-1],
        source_url=url,
        title=strip_html(raw["title"], 200),
        registration_url=url,
        event_url=url,
        organizer=strip_html(", ".join(raw.get("sponsors") or []), 200) or "Hackster",
        mode="online",
        is_open=True,
        registration_deadline=parse_date(raw["closes"], deadline=True),
        themes=["iot_hardware"],   # every Hackster contest is a hardware build
    )


def is_relevant(e: Event) -> bool:
    return e.registration_deadline is None or e.registration_deadline > datetime.now(timezone.utc)
