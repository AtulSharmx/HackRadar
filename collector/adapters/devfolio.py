"""Devfolio: public search API (POST api.devfolio.co/api/search/hackathons). robots.txt allows all on
both devfolio.co and api.devfolio.co; the Terms of Use have no clause against automated access (checked
29 Sep 2026). Indian college hackathons, with Devfolio's own "verified" flag.

The search API has no organizer name and no prize amounts, so neither is invented: organizer stays
empty (the "verified" flag carries the trust instead) and prizes are left unknown.
"""
from datetime import datetime, timezone

from .. import config
from ..models import Event
from ..normalize import classify_themes, clean_city, find_indian_city, parse_date, strip_html

name = "devfolio"
URL = "https://api.devfolio.co/api/search/hackathons"
PAGE = 50


def fetch(client) -> list[dict]:
    out = []
    for page in range(config.MAX_PAGES):
        data = client.post_json(URL, {"type": "application_open", "from": page * PAGE, "size": PAGE})
        hits = [h["_source"] for h in (data.get("hits") or {}).get("hits") or []]
        out += hits
        total = ((data.get("hits") or {}).get("total") or {}).get("value", 0)
        if not hits or len(out) >= total:
            break
    return out


def parse(raw: dict) -> Event:
    setting = raw.get("hackathon_setting") or {}
    page = f"https://{raw['slug']}.devfolio.co/"
    external = setting.get("external_apply_url")
    online = bool(raw.get("is_online"))
    location = strip_html(raw.get("location"), 300)
    country = raw.get("country")
    team_min, team_max = raw.get("team_min"), raw.get("team_size")
    return Event(
        source=name,
        source_event_id=raw.get("uuid") or raw["slug"],
        source_url=page,
        title=strip_html(raw["name"], 200),
        registration_url=external if external and external.startswith("https://") else page,
        event_url=page,
        description_short=strip_html(raw.get("tagline"), 300),
        mode="online" if online else "offline",
        venue_address=None if online else location,
        city=None if online else (clean_city(raw.get("city")) or find_indian_city(location)),
        state=None if online else clean_city(raw.get("state")),
        in_india=country == "India" or (country is None and bool(find_indian_city(location or ""))),
        is_open=raw.get("status") == "publish",
        registration_deadline=parse_date(setting.get("reg_ends_at"), deadline=True),
        start_date=parse_date(raw.get("starts_at")),
        end_date=parse_date(raw.get("ends_at")),
        themes=classify_themes(raw["name"], [t.get("name", "") if isinstance(t, dict) else str(t) for t in raw.get("themes") or []],
                               " ".join(x for x in (raw.get("tagline"), strip_html(raw.get("desc"))) if x)),
        team_min=team_min,
        team_max=team_max if team_max and team_min and team_max >= team_min else None,
        solo_allowed=(team_min == 1) if team_min else None,
        source_verified=bool(raw.get("verified")),
        posted_at=parse_date(setting.get("reg_starts_at")),   # applications opened; the list has no publish date
    )


def is_relevant(e: Event) -> bool:
    still_open = e.registration_deadline is None or e.registration_deadline > datetime.now(timezone.utc)
    return e.is_open and still_open and (e.mode == "online" or bool(e.in_india))
