"""Unstop: public JSON at /api/public/opportunity/search-result (allowed by robots.txt)."""
from datetime import datetime, timedelta, timezone

from .. import config
from ..models import Event
from ..normalize import classify_themes, clean_city, parse_date, strip_html

name = "unstop"
URL = "https://unstop.com/api/public/opportunity/search-result"


def fetch(client) -> list[dict]:
    out = []
    for page in range(1, config.MAX_PAGES + 1):
        data = client.get_json(URL, params={"opportunity": "hackathons", "oppstatus": "open",
                                            "page": page, "per_page": 50})["data"]
        out += data.get("data") or []
        if page >= (data.get("last_page") or 1):
            break
    return out


def _prize(prizes) -> tuple[int | None, str | None]:
    cash = sum(p["cash"] for p in prizes or [] if isinstance(p.get("cash"), (int, float))
               and p.get("currency") == "fa-rupee")
    if cash:
        return int(cash), f"₹{cash:,} in prizes"
    other = next((p.get("others") for p in prizes or [] if p.get("others")), None)
    return None, strip_html(other, 200)


def _fee(raw) -> int | None:
    if raw.get("isPaid") is False:
        return 0
    amounts = [s["amount"] for s in raw.get("payment_services") or [] if isinstance(s.get("amount"), (int, float))]
    return int(min(amounts)) if amounts else None


def parse(raw: dict) -> Event:
    addr = raw.get("address_with_country_logo") or {}
    regn = raw.get("regnRequirements") or {}
    country = (addr.get("country") or {}).get("name")
    url = raw.get("seo_url") or f"https://unstop.com/{raw['public_url']}"
    prize, prize_text = _prize(raw.get("prizes"))
    tmin, tmax = regn.get("min_team_size"), regn.get("max_team_size")
    skills = [s.get("skill_name") or s.get("skill") for s in raw.get("required_skills") or []]
    return Event(
        source=name,
        source_event_id=str(raw["id"]),
        source_url=url,
        title=strip_html(raw["title"], 200),
        registration_url=url,
        event_url=url,
        organizer=strip_html((raw.get("organisation") or {}).get("name"), 150),
        description_short=strip_html(raw.get("details"), 300),
        mode=raw.get("region") if raw.get("region") in ("online", "offline", "hybrid") else None,
        venue_address=strip_html(addr.get("address"), 300),
        city=clean_city(addr.get("city")),
        state=clean_city(addr.get("state")),
        in_india=country in (None, "India"),
        is_open=raw.get("regn_open") == 1,
        registration_deadline=parse_date(regn.get("end_regn_dt"), deadline=True),
        end_date=parse_date(raw.get("end_date")),
        themes=classify_themes(raw["title"], [*skills, *(w.get("name") for w in raw.get("workfunction") or [])],
                               strip_html(raw.get("details"))),
        team_min=tmin,
        team_max=tmax if tmax and tmin and tmax >= tmin else None,
        solo_allowed=(tmin == 1) if tmin else None,
        fee_amount=_fee(raw),
        is_paid=raw["isPaid"] if isinstance(raw.get("isPaid"), bool) else None,
        prize_text=prize_text,
        prize_amount_inr=prize,
        eligibility_text=strip_html(", ".join(f["name"] for f in raw.get("filters") or []
                                              if f.get("type") == "eligible"), 300),
        posted_at=parse_date(raw.get("approved_date")),   # when Unstop published it; their own list is newest-first by it
        listing_updated_at=raw.get("updated_at"),
    )


# ---------- details (A1): real event dates from the round list ----------

DETAIL_URL = "https://unstop.com/api/public/competition/{}"


def parse_rounds(competition: dict) -> list[dict]:
    """[{title, start, end}] in UTC, sorted by start. Registration windows are not rounds of the event.
    Note: Unstop's top-level start_date is when registration opens, so it is never used as the event start."""
    out = []
    for r in sorted(competition.get("rounds") or [], key=lambda r: r.get("round_order") or 0):
        if r.get("is_hidden") or r.get("is_inactive"):
            continue
        for d in r.get("details") or []:
            title = strip_html(d.get("title"), 80) or "Round"
            start, end = parse_date(d.get("start_date")), parse_date(d.get("end_date"))
            if "registration" in title.lower() or not (start or end):
                continue
            out.append({"title": title, "start": start.isoformat() if start else None,
                        "end": end.isoformat() if end else None})
    return sorted(out, key=lambda x: x["start"] or x["end"])


def enrich(client, events: list[Event], known: dict[str, str | None], limit: int) -> dict:
    """Fill rounds + start_date from the detail API for events that are new or changed on Unstop.
    known: source_event_id -> updated_at stored when we last read details. Returns counts."""
    todo = []
    for e in events:
        if e.listing_updated_at and known.get(e.source_event_id) == e.listing_updated_at:
            e.detail_updated_at = e.listing_updated_at   # details still current; keep the stored ones
        else:
            todo.append(e)
    done = 0
    for e in todo[:limit]:
        comp = (client.get_json(DETAIL_URL.format(int(e.source_event_id))).get("data") or {}).get("competition") or {}
        e.rounds = parse_rounds(comp)
        if e.end_date:   # organizers sometimes add notices as "rounds" dated after the event (seen 29 Sep)
            last = (e.end_date + timedelta(days=1)).isoformat()
            e.rounds = [r for r in e.rounds if not r["start"] or r["start"] <= last]
        starts = [datetime.fromisoformat(r["start"]) for r in e.rounds if r["start"]]
        e.start_date = min(starts) if starts else None
        e.detail_updated_at = e.listing_updated_at
        done += 1
    return {"details_fetched": done, "details_waiting": max(0, len(todo) - limit)}


def is_relevant(e: Event) -> bool:
    still_open = e.registration_deadline is None or e.registration_deadline > datetime.now(timezone.utc)
    return e.is_open and still_open and (e.mode == "online" or bool(e.in_india))
