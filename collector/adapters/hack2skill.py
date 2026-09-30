"""Hack2Skill: public event list (GET hack2skill.com/api/v1/innovator/public/event/public-list).
robots.txt allows it; Terms of Service (hack2skill.com/legacy/tnc) have no clause against automated access
(checked 30 Sep 2026).

The list has no city, venue or organizer, and no amount for paid events, and there is no public detail API
(404), so none of those are filled in. In-person events are kept only when the title names an Indian city:
their location is otherwise unknown and could be abroad ("GCC Edition").
"""
import re
from datetime import datetime, timedelta, timezone

from .. import config
from ..models import Event
from ..normalize import classify_themes, find_indian_city, parse_date, strip_html

name = "hack2skill"
URL = "https://hack2skill.com/api/v1/innovator/public/event/public-list"
MODES = {"VIRTUAL": "online", "ONLINE": "online", "IN_PERSON": "offline", "OFFLINE": "offline", "HYBRID": "hybrid"}


def fetch(client) -> list[dict]:
    now = datetime.now(timezone.utc)
    window = {"start": (now - timedelta(days=30)).strftime("%Y-%m-%dT%H:%M:%S.000Z"),
              "end": (now + timedelta(days=365)).strftime("%Y-%m-%dT%H:%M:%S.000Z")}
    out = []
    for page in range(1, config.MAX_PAGES + 1):
        data = client.get_json(URL, params={"page": page, "records": 50, "search": "", **window})
        docs = data.get("data") if isinstance(data.get("data"), list) else (data.get("data") or {}).get("docs") or []
        out += docs
        if not docs or page >= (data.get("pages") or 1):
            break
    # homepage promos carry a "link" instead of eventUrl; drop the ones pointing back at a listed event
    slugs = {r["eventUrl"] for r in out if r.get("eventUrl")}
    return [r for r in out if r.get("eventUrl") or _link_slug(r) not in slugs]


def _link_slug(raw):
    m = re.match(r"https://hack2skill\.com/event/([^/?#]+)", raw.get("link") or "")
    return m and m.group(1)


def _url(raw):
    if raw.get("eventUrl"):
        return f"https://hack2skill.com/event/{raw['eventUrl']}/"
    return (raw.get("link") or "").split("?")[0] or None


def parse(raw: dict) -> Event:
    url = _url(raw)
    title = strip_html(raw["title"], 200)
    city = find_indian_city(title)
    individual = (raw.get("participation") or "").lower() == "individual"
    return Event(
        source=name,
        source_event_id=raw["_id"],
        source_url=url,
        title=title,
        registration_url=url,
        event_url=url,
        mode=MODES.get((raw.get("mode") or "").upper()),
        city=city,
        in_india=True if city else None,
        is_open=True,
        registration_deadline=parse_date(raw.get("registrationEnd"), deadline=True),
        start_date=parse_date(raw.get("submissionStart")),
        end_date=parse_date(raw.get("submissionEnd")),
        posted_at=parse_date(raw.get("registrationStart")),
        themes=classify_themes(title, []),
        team_max=1 if individual else None,
        team_min=1 if individual else None,
        solo_allowed=True if individual else None,
        fee_amount=0 if raw.get("ticket") == "FREE" else None,   # PAID: amount unknown, never guessed
        is_paid={"FREE": False, "PAID": True}.get(raw.get("ticket")),
        source_verified=raw.get("flag") == "FLAGSHIP",   # run by Hack2Skill itself; COMMUNITY = third party
    )


def is_relevant(e: Event) -> bool:
    still_open = e.registration_deadline is None or e.registration_deadline > datetime.now(timezone.utc)
    # hybrid can be joined online; in-person only with a known Indian city
    return bool(e.source_url) and e.is_open and still_open and (e.mode in ("online", "hybrid") or bool(e.in_india))
