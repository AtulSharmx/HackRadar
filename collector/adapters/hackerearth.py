"""HackerEarth: public upcoming-events JSON (GET hackerearth.com/api/events/upcoming/).
robots.txt allows it; Terms of Service have no clause against automated access (checked 12 Oct 2026).

The list mixes hackathons with hiring and coding challenges; only hackathons are kept (URL under
/challenges/hackathon/ or "hackathon" in the title). It has no organizer, fee, prize, city or separate
registration deadline: everything runs online on HackerEarth and you can register until the challenge ends,
so the end time is the deadline. Nothing else is filled in.
"""
import re
from datetime import datetime, timezone

from ..models import Event
from ..normalize import classify_themes, parse_date, strip_html

name = "hackerearth"
URL = "https://www.hackerearth.com/api/events/upcoming/"


def fetch(client) -> list[dict]:
    return client.get_json(URL).get("response") or []


def parse(raw: dict) -> Event:
    url = raw["url"].split("?")[0]
    title = strip_html(raw["title"], 200)
    end = parse_date(raw.get("end_utc_tz"))
    return Event(
        source=name,
        source_event_id=url.rstrip("/").rsplit("/", 1)[-1],
        source_url=url,
        title=title,
        registration_url=url,
        event_url=url,
        mode="online",
        is_open=raw.get("status") in ("ONGOING", "UPCOMING"),
        registration_deadline=end,
        start_date=parse_date(raw.get("start_utc_tz")),
        end_date=end,
        themes=classify_themes(title, [], raw.get("description")),
    )


def is_relevant(e: Event) -> bool:
    hackathon = "/challenges/hackathon/" in e.source_url or bool(re.search(r"hackathon", e.title, re.I))
    still_open = e.registration_deadline is None or e.registration_deadline > datetime.now(timezone.utc)
    return hackathon and e.is_open and still_open
