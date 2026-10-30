"""KnowAFest: Indian college fests and hackathons. Its hackathon category page and public RSS feed list the
events; every event page carries schema.org Event data (dates, venue, organizer, fee).
robots.txt allows everything; the Terms of Use have no clause against automated access or reuse (checked
30 Oct 2026). Registration happens on the organizer's own link, which is what we send people to.

The deadline is only free text under "Registration deadline / Important dates", so it is read only when a
date comes right after that heading; otherwise it stays unknown. Prizes are free text too and are left out.
"""
import html
import json
import re
from datetime import datetime, timezone

from ..models import Event
from ..normalize import classify_themes, clean_city, parse_date, strip_html

name = "knowafest"
BASE = "https://www.knowafest.com"
LIST = f"{BASE}/explore/category/Hackathon"
FEED = f"{BASE}/feed.xml"
MAX_EVENTS = 40
HACK_TITLE = re.compile(r"hack|ideathon|buildathon|codeathon|datathon|makeathon", re.I)
MODES = {"OnlineEventAttendanceMode": "online", "OfflineEventAttendanceMode": "offline", "MixedEventAttendanceMode": "hybrid"}
_DMY = re.compile(r"\b(\d{1,2})[./-](\d{1,2})[./-](\d{4})\b")
_WORDY = re.compile(r"\b\d{1,2}(?:st|nd|rd|th)?\s+[A-Za-z]{3,9},?\s+\d{4}\b|\b[A-Za-z]{3,9}\s+\d{1,2}(?:st|nd|rd|th)?,?\s+\d{4}\b")
_REGISTER_LINK = re.compile(r'href="(https://(?!www\.knowafest)[^"]+)"[^>]*>\s*(?:Register|Apply|Official)', re.I)


def slugs_from(listing: str, feed: str) -> list[str]:
    """The category page, plus feed items filed as hackathons or named like one."""
    found = re.findall(rf"{re.escape(BASE)}/event/([a-z0-9-]+)", listing)
    for item in re.findall(r"<item>([\s\S]*?)</item>", feed):
        title = re.search(r"<title>([^<]*)", item)
        category = re.search(r"<category>([^<]*)", item)
        link = re.search(rf"<link>{re.escape(BASE)}/event/([a-z0-9-]+)", item)
        if link and ((category and category.group(1) == "Hackathons") or (title and HACK_TITLE.search(title.group(1)))):
            found.append(link.group(1))
    return list(dict.fromkeys(found))[:MAX_EVENTS]


def event_data(page: str) -> dict | None:
    for block in re.findall(r'<script[^>]*application/ld\+json[^>]*>([\s\S]*?)</script>', page):
        try:
            data = json.loads(block)
        except ValueError:
            continue
        if isinstance(data, dict) and data.get("@type") == "Event":
            return data
    return None


def deadline_from(page: str) -> datetime | None:
    text = strip_html(page) or ""
    at = text.find("Registration deadline / Important dates")
    if at < 0:
        return None
    # only a date right after the heading: further down they are round dates, not the deadline
    near = text[at + len("Registration deadline / Important dates"): at + 75]
    if m := _DMY.search(near):
        day, month, year = m.groups()   # 05.11.2026 is 5 November here; never let a parser read it as May
        return parse_date(f"{year}-{int(month):02d}-{int(day):02d}", deadline=True)
    if m := _WORDY.search(near):
        return parse_date(m.group(0), deadline=True)
    return None


def fetch(client) -> list[dict]:
    out = []
    for slug in slugs_from(client.get_text(LIST), client.get_text(FEED)):
        page = client.get_text(f"{BASE}/event/{slug}")
        data = event_data(page)
        if data:
            out.append({"slug": slug, "data": data, "deadline": deadline_from(page), "link": (_REGISTER_LINK.search(page) or [None, None])[1]})
    return out


def parse(raw: dict) -> Event:
    d = raw["data"]
    page = f"{BASE}/event/{raw['slug']}"
    place = d.get("location") if isinstance(d.get("location"), dict) else {}
    address = place.get("address") if isinstance(place.get("address"), dict) else {}
    offer = d.get("offers") if isinstance(d.get("offers"), dict) else {}
    title = strip_html(html.unescape(d["name"]), 200)
    description = strip_html(html.unescape(d.get("description") or ""), 300)
    mode = MODES.get((d.get("eventAttendanceMode") or "").rsplit("/", 1)[-1])
    fee = None
    if offer.get("price") is not None and offer.get("priceCurrency") == "INR":
        fee = round(float(offer["price"]))
    link = offer.get("url") if str(offer.get("url") or "").startswith("https://") else raw.get("link")
    return Event(
        source=name,
        source_event_id=raw["slug"],
        source_url=page,
        title=title,
        registration_url=link if link and "knowafest.com" not in link else page,
        event_url=page,
        description_short=description,
        organizer=strip_html((d.get("organizer") or {}).get("name"), 200),
        mode=mode,
        venue_address=None if mode == "online" else strip_html(place.get("name"), 300),
        city=None if mode == "online" else clean_city(address.get("addressLocality")),
        state=None if mode == "online" else clean_city(address.get("addressRegion")),
        in_india=address.get("addressCountry") == "India" or mode == "online",
        is_open=True,
        registration_deadline=raw.get("deadline"),
        start_date=parse_date(d.get("startDate")),
        end_date=parse_date(d.get("endDate")),
        themes=classify_themes(title, [], description),
        fee_amount=fee,
        is_paid=(fee > 0) if fee is not None else None,
    )


def is_relevant(e: Event) -> bool:
    now = datetime.now(timezone.utc)
    still_open = e.registration_deadline is None or e.registration_deadline > now
    not_over = (e.end_date or e.start_date or now) >= now
    return still_open and not_over and bool(e.in_india)
