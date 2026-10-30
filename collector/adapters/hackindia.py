"""HackIndia: calls itself India's largest hackathon platform. Public list at hackindia.org/hackathons, with every
event's dates, fee, tracks and prize embedded in the page. robots.txt allows it (only /api/ and admin pages are off
limits) and the Terms of Service have no clause against automated access or reuse (checked 30 Oct 2026).

Event pages have no id in the list, so the link comes from the title the way HackIndia builds it, and only when
the page really links there; otherwise the list page is used.
"""
import json
import re
from datetime import datetime, timezone

from ..models import Event
from ..normalize import classify_themes, find_indian_city, parse_date, parse_money, strip_html

name = "hackindia"
BASE = "https://hackindia.org"
URL = f"{BASE}/hackathons"
_CHUNK = re.compile(r'self\.__next_f\.push\(\[1,"((?:[^"\\]|\\.)*)"\]\)')


def events_in(page: str) -> list[dict]:
    text = "".join(json.loads(f'"{chunk}"') for chunk in _CHUNK.findall(page))
    at = text.find('"initialEvents":')
    if at < 0:
        raise ValueError("HackIndia page changed: no initialEvents")
    events, _ = json.JSONDecoder().raw_decode(text, text.find("[", at))
    paths = set(re.findall(r'/20\d\d/[a-z0-9-]+', page))
    for e in events:
        slug = re.sub(r"[^a-z0-9]+", "-", e["title"].lower()).strip("-")
        path = f"/{(e.get('start_date') or '')[:4]}/{slug}"
        e["url"] = BASE + path if path in paths else URL
    return events


def fetch(client) -> list[dict]:
    return events_in(client.get_text(URL))


def parse(raw: dict) -> Event:
    title = strip_html(raw["title"], 200)
    online = bool(raw.get("is_online"))
    place = strip_html(raw.get("location"), 300)
    tracks = [str(t) for t in raw.get("tracks") or []]
    description = strip_html(raw.get("description"), 300)
    fee = None
    if raw.get("registration_fee") is not None and raw.get("registration_fee_currency") == "INR":
        fee = round(float(raw["registration_fee"]))
    prize_text = strip_html((raw.get("prize_pool") or "").replace("$$", "$"), 200) or None
    prize, approx = parse_money(prize_text)
    team_min, team_max = raw.get("team_size_min"), raw.get("team_size_max")
    return Event(
        source=name,
        source_event_id=str(raw["id"]),
        source_url=raw["url"],
        title=title,
        registration_url=raw["url"],
        event_url=raw["url"],
        description_short=description,
        organizer="HackIndia",
        mode="online" if online else "offline",
        venue_address=None if online else place,
        city=None if online else find_indian_city(f"{title} {place or ''}"),
        in_india=True,
        is_open=raw.get("status") == "registration_open" and not raw.get("is_cancelled"),
        registration_deadline=parse_date(raw.get("registration_end_date")),
        start_date=parse_date(raw.get("start_date")),
        end_date=parse_date(raw.get("end_date")),
        posted_at=parse_date(raw.get("published_at") or raw.get("registration_start_date")),
        themes=classify_themes(title, tracks, description),
        team_min=team_min,
        team_max=team_max,
        fee_amount=fee,
        is_paid=(fee > 0) if fee is not None else None,
        prize_text=prize_text,
        prize_amount_inr=prize,
        prize_approximate=approx,
    )


def is_relevant(e: Event) -> bool:
    return e.is_open and (e.registration_deadline is None or e.registration_deadline > datetime.now(timezone.utc))
