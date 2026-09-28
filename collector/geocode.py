"""Venue coordinates: cache first, then Nominatim (OpenStreetMap), then the city centre (approximate).

Nominatim usage policy (API use, not crawling): max 1 request/second, identifying User-Agent,
cache results, show "© OpenStreetMap contributors". Its robots.txt is for crawlers, so this uses
its own slow client instead of the robots-checking scraper client.
"""
import math
import os
import re
import time
from datetime import datetime, timedelta, timezone

import httpx

from . import config
from .normalize import CITIES, clean_city

NOMINATIM = "https://nominatim.openstreetmap.org/search"
MAX_NEW_PER_RUN = 50
MAX_KM_FROM_CITY = 60     # a hit further than this from the stated city is a wrong place with the same name
EXACT_RANK = 22           # Nominatim place_rank: 16 city, ~20 suburb, 24+ campus/building
RETRY_APPROX_DAYS = float(os.environ.get("GEOCODE_RETRY_DAYS", "7"))   # OSM keeps improving; retry weekly
_PLACEHOLDER = re.compile(r"^(tba|tbd|to be (announced|decided)|online|venue|n/?a|-)?$", re.I)
_CENTRE = {c["name"]: (c["lat"], c["lng"]) for c in CITIES}


def haversine_km(lat1, lng1, lat2, lng2) -> float:
    p1, p2 = math.radians(lat1), math.radians(lat2)
    a = (math.sin((p2 - p1) / 2) ** 2
         + math.cos(p1) * math.cos(p2) * math.sin(math.radians(lng2 - lng1) / 2) ** 2)
    return 2 * 6371 * math.asin(math.sqrt(a))


def address_key(venue, city, state) -> str:
    return re.sub(r"\s+", " ", f"{venue or ''}|{city or ''}|{state or ''}".lower()).strip()


class Nominatim:
    def __init__(self):
        self.http = httpx.Client(headers={"User-Agent": config.USER_AGENT}, timeout=20)
        self._last = 0.0
        self.calls = 0

    def search(self, q: str) -> list[dict]:
        wait = 1.1 - (time.monotonic() - self._last)
        if wait > 0:
            time.sleep(wait)
        self._last = time.monotonic()
        self.calls += 1
        r = self.http.get(NOMINATIM, params={"q": q, "countrycodes": "in", "format": "jsonv2", "limit": 3})
        r.raise_for_status()
        return r.json()


def locate(nom: Nominatim, venue, city, state) -> tuple[float | None, float | None, bool]:
    """(lat, lng, approximate) for one venue."""
    centre = _CENTRE.get(clean_city(city) or "")

    def plausible(hit) -> bool:
        lat, lng = float(hit["lat"]), float(hit["lon"])
        if centre:
            return haversine_km(lat, lng, *centre) <= MAX_KM_FROM_CITY
        return bool(state) and state.lower() in hit.get("display_name", "").lower()

    venue = re.sub(r"\s*\([^)]*\)", "", (venue or "")).strip()   # "(DTU)" makes Nominatim miss
    queries = []
    if not _PLACEHOLDER.match(venue):
        name = venue.split(",")[0].strip()
        for q in (", ".join(x for x in (venue, city, state) if x),
                  ", ".join(x for x in (name, city) if x),
                  name if len(name) > 12 else ""):          # short bare names match random places
            if q and q not in queries:
                queries.append(q)
    for q in queries:
        hit = next((h for h in nom.search(q) if plausible(h)), None)
        if hit:
            return float(hit["lat"]), float(hit["lon"]), int(hit.get("place_rank") or 0) < EXACT_RANK
    if centre:
        return centre[0], centre[1], True
    if city:   # a town not in cities.json: its own centre, still approximate
        hit = next((h for h in nom.search(", ".join(x for x in (city, state) if x)) if plausible(h)), None)
        if hit:
            return float(hit["lat"]), float(hit["lon"]), True
    return None, None, True


def run(db) -> dict:
    """Fill lat/lng on open offline/hybrid events that have none yet."""
    todo = db.select_all("events", select="id,venue_address,city,state,lat,location_approximate",
                         status="eq.open", mode="in.(offline,hybrid)",
                         **{"or": "(lat.is.null,location_approximate.is.true)"})
    if not todo:
        return {"events": 0, "nominatim_calls": 0}
    cache = {r["address_key"]: r for r in db.select_all("geocode_cache", select="*")}
    retry_before = datetime.now(timezone.utc) - timedelta(days=RETRY_APPROX_DAYS)
    nom, new_rows, done, skipped = Nominatim(), [], 0, 0
    for e in todo:
        key = address_key(e["venue_address"], e["city"], e["state"])
        c = cache.get(key)
        stale = c and c["approximate"] and "created_at" in c and datetime.fromisoformat(c["created_at"]) < retry_before
        if e["lat"] is not None and not stale:
            continue   # approximate but retried recently: leave it
        if c is None or stale:
            if len(new_rows) >= MAX_NEW_PER_RUN:
                skipped += 1
                continue
            lat, lng, approx = locate(nom, e["venue_address"], e["city"], e["state"])
            cache[key] = {"address_key": key, "lat": lat, "lng": lng, "approximate": approx,
                          "created_at": datetime.now(timezone.utc).isoformat()}
            new_rows.append(cache[key])
        c = cache[key]
        if c["lat"] is None:
            continue
        r = db.http.patch("/events", params={"id": f"eq.{e['id']}"},
                          json={"lat": c["lat"], "lng": c["lng"], "location_approximate": c["approximate"]})
        r.raise_for_status()
        done += 1
    db.post("geocode_cache", new_rows, on_conflict="address_key")
    return {"events": done, "new_lookups": len(new_rows), "nominatim_calls": nom.calls, "waiting": skipped}
