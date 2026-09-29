"""Alert filter matching + best-match score (TRD "Trust labels and match score").

The app will implement the same rules in JS; both must pass shared/match_cases.json.

Rules not spelled out in the TRD, decided here:
- Unknown data never excludes an event (unknown fee passes fee_max), EXCEPT for filters the user
  made narrow on purpose: solo_only and closing_within_days need a known value.
- Hybrid events can be joined online, so the distance filter doesn't apply to them.
- Offline event with no coordinates (or no device location) fails max_km: we can't claim it's near.
"""
import math
from datetime import datetime, timezone

from . import config
from .geocode import haversine_km

W_THEME, W_DISTANCE, W_FEE, W_URGENCY, W_TRUST = 35, 25, 15, 15, 10
FEE_PARTIAL = 8
URGENT_DAYS = (2, 10)      # 15 points inside this window
SOON_DAYS = 30             # 8 points from URGENT_DAYS[1] up to here
TRUST_POINTS = {"trusted_source": W_TRUST, "check_details": 5, "warning": 0}


def _dt(v):
    return datetime.fromisoformat(v) if isinstance(v, str) else v


def filter_of(device: dict) -> dict:
    """alert_filter if set, else the same keys from prefs (hide_warnings -> exclude_warnings)."""
    if device.get("alert_filter"):
        return device["alert_filter"]
    p = device.get("prefs") or {}
    return {"themes": p.get("themes"), "modes": p.get("modes"), "fee_max": p.get("fee_max"),
            "max_km": p.get("max_km"), "exclude_warnings": p.get("hide_warnings", False)}


def distance_km(event: dict, device: dict) -> float | None:
    if event.get("lat") is None or device.get("lat_rounded") is None:
        return None
    return haversine_km(float(device["lat_rounded"]), float(device["lng_rounded"]), event["lat"], event["lng"])


def days_left(event: dict, now: datetime) -> float | None:
    d = _dt(event.get("registration_deadline"))
    return (d - now).total_seconds() / 86400 if d else None


def matches(event: dict, device: dict, now: datetime | None = None) -> bool:
    now = now or datetime.now(timezone.utc)
    f = filter_of(device)
    left = days_left(event, now)
    if event.get("status", "open") != "open" or (left is not None and left < 0):
        return False
    if f.get("themes") and not set(f["themes"]) & set(event.get("themes") or []):
        return False
    if f.get("modes") and event.get("mode") and event["mode"] not in f["modes"]:
        return False
    fee = event.get("fee_amount")
    if f.get("fee_max") is not None and fee is not None and fee > f["fee_max"]:
        return False
    if f.get("max_km") is not None and event.get("mode") == "offline":
        km = distance_km(event, device)
        if km is None or km > f["max_km"]:
            return False
    if f.get("closing_within_days") is not None and (left is None or left > f["closing_within_days"]):
        return False
    if f.get("solo_only") and event.get("solo_allowed") is not True:
        return False
    if f.get("exclude_warnings") and event.get("trust_label") == "warning":
        return False
    return True


def score(event: dict, device: dict, now: datetime | None = None) -> tuple[int, dict]:
    """(0-100 total, points per part). Uses prefs, not the alert filter: this ranks the whole feed."""
    now = now or datetime.now(timezone.utc)
    prefs = device.get("prefs") or {}
    parts = {}

    parts["theme"] = W_THEME if set(prefs.get("themes") or []) & set(event.get("themes") or []) else 0

    max_km = prefs.get("max_km") or 50
    if event.get("mode") in ("online", "hybrid"):
        parts["distance"] = W_DISTANCE
    else:
        km = distance_km(event, device)
        if km is None or km >= 2 * max_km:
            parts["distance"] = 0
        elif km <= max_km:
            parts["distance"] = W_DISTANCE
        else:   # linear from 25 at max_km down to 0 at 2 x max_km
            parts["distance"] = W_DISTANCE * (2 * max_km - km) / max_km

    fee = event.get("fee_amount")
    parts["fee"] = W_FEE if fee == 0 else FEE_PARTIAL if fee is not None and fee <= config.FEE_LIMIT else 0

    left = days_left(event, now)
    if left is not None and URGENT_DAYS[0] <= left <= URGENT_DAYS[1]:
        parts["urgency"] = W_URGENCY
    elif left is not None and URGENT_DAYS[1] < left <= SOON_DAYS:
        parts["urgency"] = 8
    else:
        parts["urgency"] = 0

    parts["trust"] = TRUST_POINTS.get(event.get("trust_label"), 0)
    # half rounds up, same as JS Math.round (Python round() would give 44 for 44.5)
    return math.floor(sum(parts.values()) + 0.5), parts


THEME_NAMES = {"ai_ml": "AI/ML", "cybersecurity": "Cybersecurity", "web": "Web", "mobile": "Mobile",
               "data_science": "Data science", "blockchain": "Blockchain", "iot_hardware": "IoT/Hardware",
               "open_innovation": "Open innovation", "coding_contest": "Coding contests", "other": "Other"}


def reasons(event: dict, device: dict, parts: dict, now: datetime | None = None) -> list[str]:
    """Top two human reasons, e.g. ["Matches AI/ML", "12 km away"]."""
    out = []
    order = (("theme", W_THEME), ("distance", W_DISTANCE), ("fee", W_FEE), ("urgency", W_URGENCY))
    # best share first; ties keep this order, so "Matches AI/ML" comes before "Closes in 3 days"
    ranked = sorted(((parts[k] / w, i, k) for i, (k, w) in enumerate(order)), key=lambda x: (-x[0], x[1]))
    for share, _, part in ranked:
        if share <= 0 or len(out) == 2:
            break
        if part == "theme":
            hit = sorted(set((device.get("prefs") or {}).get("themes") or []) & set(event.get("themes") or []))
            out.append("Matches " + ", ".join(THEME_NAMES.get(t, t) for t in hit[:2]))
        elif part == "distance":
            km = distance_km(event, device)
            out.append("Online" if event.get("mode") == "online" else
                       "Hybrid, can join online" if event.get("mode") == "hybrid" else
                       f"about {round(km)} km away" + (" (approx.)" if event.get("location_approximate") else ""))
        elif part == "fee":
            out.append("Free" if event.get("fee_amount") == 0 else f"Fee ₹{event['fee_amount']:,}")
        elif part == "urgency":
            out.append(f"Closes in {int(days_left(event, now or datetime.now(timezone.utc)) or 0)} days")
    return out
