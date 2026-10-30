"""Reskilll: Indian hackathon platform, public list at reskilll.com/allhacks (one server-rendered page).
robots.txt allows it (only /api/ and account pages are off limits); the site publishes no Terms of Use
(checked 30 Oct 2026). Each card has a name, link, registration start and end, and an open/closed label.

The list has no organizer, fee, prize or mode, so those stay unknown and the trust label says to check details.
"""
import html
import re
from datetime import datetime, timezone

from ..models import Event
from ..normalize import classify_themes, find_indian_city, parse_date, strip_html

name = "reskilll"
URL = "https://reskilll.com/allhacks"
_CARD = re.compile(r'(?=<div class="col-12 col-lg-3 col-md-6 py-3 hackathonCard">)')
_LINK = re.compile(r'allhackname[^>]*href="(https://[^"]+)"[^>]*>([^<]+)')
_DATES = re.compile(r'hackresgiterdate">([^<]+)')
_ABOUT = re.compile(r'eventDescription">([\s\S]*?)</div>')


def cards_in(page: str) -> list[dict]:
    out = []
    for card in _CARD.split(page)[1:]:
        link = _LINK.search(card)
        if link:
            about = _ABOUT.search(card)
            out.append({"url": link.group(1), "title": link.group(2), "dates": _DATES.findall(card),
                        "closed": "Registration Closed" in card, "about": html.unescape(about.group(1)) if about else ""})
    return out


def fetch(client) -> list[dict]:
    return cards_in(client.get_text(URL))


def parse(raw: dict) -> Event:
    title = strip_html(html.unescape(raw["title"]), 200)
    about = strip_html(raw.get("about"), 300)
    dates = raw.get("dates") or []
    city = find_indian_city(title)
    host_or_path = raw["url"].rstrip("/").removeprefix("https://").removesuffix(".reskilll.com")
    return Event(
        source=name,
        source_event_id=host_or_path.rsplit("/", 1)[-1],
        source_url=raw["url"],
        title=title,
        registration_url=raw["url"],
        event_url=raw["url"],
        description_short=about,
        city=city,
        in_india=True,
        is_open=not raw.get("closed"),
        posted_at=parse_date(dates[0]) if dates else None,
        registration_deadline=parse_date(dates[1], deadline=True) if len(dates) > 1 else None,
        themes=classify_themes(title, [], about),
    )


def is_relevant(e: Event) -> bool:
    return e.is_open and (e.registration_deadline is None or e.registration_deadline > datetime.now(timezone.utc))
