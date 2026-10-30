"""dev.events: a developer events directory with a hackathon section (dev.events/hackathons), many of them big online
ones (PayPal, Mozilla, NVIDIA). Every entry is schema.org data in the page, and the entry's own page links to the
official site. robots.txt allows all; no Terms of Use are published (checked 30 Oct 2026). We read dev.events only;
people then go to the official page, which may be on Devpost.

Only online editions and those in India are kept. The fee is not listed, so it stays unknown. The closing date
shown is the submission date, the last moment to take part, so it is used as the deadline. The organizer is named
only when the official page is on a known hackathon platform; otherwise the trust label says none is mentioned.
"""
import json
import re
from datetime import datetime, timezone
from urllib.parse import urlsplit

from .. import config
from ..models import Event
from ..normalize import classify_themes, parse_date, strip_html

name = "devevents"
BASE = "https://dev.events"
URL = f"{BASE}/hackathons"
MAX_PAGES = 5
HOSTS = {"devpost.com": "Devpost", "devfolio.co": "Devfolio", "lablab.ai": "lablab.ai", "dorahacks.io": "DoraHacks",
         "hackerearth.com": "HackerEarth", "hack2skill.com": "Hack2Skill", "unstop.com": "Unstop"}
_ELSEWHERE = re.compile(r"(north america|latin america|latam|europe|africa|usa|canada)", re.I)   # regional, not for India
_LD = re.compile(r'<script[^>]*application/ld\+json[^>]*>([\s\S]*?)</script>')
_OFFICIAL = re.compile(r'<a [^>]*href="(https://[^"]+)"')
_NOT_OFFICIAL = ("dev.events", "principal.dev")   # the directory itself, and the course it advertises on every page


def entries_in(page: str) -> list[dict]:
    """Hackathon entries only: the same blocks also carry the directory's paid course ads."""
    out = []
    for block in _LD.findall(page):
        try:
            data = json.loads(block)
        except ValueError:
            continue
        if isinstance(data, dict) and " hackathon" in f" {data.get('description') or ''}".lower():
            out.append(data)
    return out


def official_link(page: str) -> str | None:
    return next((u for u in _OFFICIAL.findall(page) if not any(x in u for x in _NOT_OFFICIAL)), None)


def _wanted(entry: dict) -> bool:
    online = entry.get("eventAttendanceMode", "").endswith("OnlineEventAttendanceMode")
    return online or "india" in (entry.get("description") or "").lower()


def fetch(client) -> list[dict]:
    entries = {}
    for page in range(1, min(MAX_PAGES, config.MAX_PAGES) + 1):
        found = entries_in(client.get_text(URL if page == 1 else f"{URL}?page={page}"))
        new = {e["url"]: e for e in found if e.get("url") and e["url"] not in entries}
        if not new:
            break
        entries.update(new)
    today = datetime.now(timezone.utc).date().isoformat()
    out = []
    for entry in entries.values():
        if _wanted(entry) and (entry.get("endDate") or "")[:10] >= today:   # details only for ones we would show
            entry["official"] = official_link(client.get_text(entry["url"]))
        out.append(entry)
    return out


def _host_name(url: str | None) -> str | None:
    host = urlsplit(url or "").netloc.lower()
    return next((label for known, label in HOSTS.items() if host == known or host.endswith(f".{known}")), None)


def parse(raw: dict) -> Event:
    page = raw["url"]
    official = raw.get("official")
    online = raw.get("eventAttendanceMode", "").endswith("OnlineEventAttendanceMode")
    title = strip_html(raw["name"], 200)
    about = strip_html(raw.get("description"), 300) or ""
    topic = re.split(r"\s+hackathon\b", about, flags=re.I)[0]
    return Event(
        source=name,
        source_event_id=page.rstrip("/").rsplit("/", 1)[-1],
        source_url=page,
        title=title,
        registration_url=official or page,
        event_url=official or page,
        organizer=_host_name(official),
        mode="online" if online else "offline",
        in_india=online or "india" in about.lower(),
        is_open=True,
        registration_deadline=parse_date((raw.get("endDate") or "")[:10], deadline=True),
        start_date=parse_date(raw.get("startDate")),
        themes=classify_themes(title, [topic]),
    )


def is_relevant(e: Event) -> bool:
    still_open = e.registration_deadline is None or e.registration_deadline > datetime.now(timezone.utc)
    return e.is_open and still_open and bool(e.in_india) and not _ELSEWHERE.search(e.title)
