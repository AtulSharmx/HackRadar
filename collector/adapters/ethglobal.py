"""ETHGlobal: the best-known web3 hackathon series. Public page ethglobal.com/events, event data embedded in it.
No robots.txt (404, so nothing is off limits); the Terms have no clause against automated access (30 Oct 2026).

Most editions are in person abroad, so only those in India and the online ones are kept. No fee or prize in
the list, so both stay unknown.
"""
import re
from datetime import datetime, timezone

from ..models import Event
from ..normalize import classify_themes, clean_city, parse_date, strip_html

name = "ethglobal"
URL = "https://ethglobal.com/events"
_EVENT = re.compile(r'"name":"([^"]+)","slug":"([a-z0-9-]+)","type":"hackathon","medium":"(\w+)",'
                    r'"startTime":"([^"]+)","endTime":"([^"]+)","status":"(\w+)","signupDeadline":(?:"([^"]*)"|null)')
_CITY = re.compile(r'"city":\{"id":\d+,"name":"([^"]+)","country":\{"id":\d+,"name":"([^"]+)"')


def events_in(text: str) -> list[dict]:
    blob = text.replace('\\"', '"')   # the data sits JSON-escaped inside a script
    found = {}
    matches = list(_EVENT.finditer(blob))
    for i, m in enumerate(matches):
        stop = matches[i + 1].start() if i + 1 < len(matches) else len(blob)
        city = _CITY.search(blob, m.end(), stop)
        found.setdefault(m.group(2), {
            "name": m.group(1), "slug": m.group(2), "medium": m.group(3), "start": m.group(4), "end": m.group(5),
            "status": m.group(6), "deadline": m.group(7), "city": city and city.group(1), "country": city and city.group(2),
        })
    return list(found.values())


def fetch(client) -> list[dict]:
    return events_in(client.get_text(URL))


def parse(raw: dict) -> Event:
    url = f"https://ethglobal.com/events/{raw['slug']}"
    online = raw["medium"] != "physical"
    title = strip_html(raw["name"], 200)
    return Event(
        source=name,
        source_event_id=raw["slug"],
        source_url=url,
        title=title,
        registration_url=url,
        event_url=url,
        organizer="ETHGlobal",
        mode="online" if online else "offline",
        city=None if online else clean_city(raw.get("city")),
        in_india=raw.get("country") == "India",
        is_open=raw.get("status") == "future",
        registration_deadline=parse_date(raw.get("deadline")),
        start_date=parse_date(raw.get("start")),
        end_date=parse_date(raw.get("end")),
        themes=classify_themes(title, ["web3"]),
    )


def is_relevant(e: Event) -> bool:
    still_open = e.registration_deadline is None or e.registration_deadline > datetime.now(timezone.utc)
    return e.is_open and still_open and (e.mode == "online" or e.in_india)
