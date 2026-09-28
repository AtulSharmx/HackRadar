"""Duplicate detection and merging across sources. Works on event row dicts (Event.to_row() / DB rows)."""
import re
from datetime import datetime, timedelta
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit

from rapidfuzz import fuzz

MERGE_AT = 90
REVIEW_AT = 75
DATE_WINDOW = timedelta(days=2)
DATE_KEYS = ("start_date", "registration_deadline", "end_date")

_TRACKING = re.compile(r"^(utm_.*|ref|ref_src|source|fbclid|gclid|lb|trk)$", re.I)
_TITLE_NOISE = re.compile(r"\b(hackathon|hackathons|hack|edition|season|20\d\d|2k\d\d)\b")
_STOP = {"the", "by", "at", "for", "of", "and", "in", "on", "with", "an", "to", "x", "v"}


def clean_url(url) -> str | None:
    """Lowercase host, no www, no tracking params, no fragment, no trailing slash."""
    if not url:
        return None
    p = urlsplit(url.strip())
    host = p.netloc.lower().removeprefix("www.")
    query = urlencode([(k, v) for k, v in parse_qsl(p.query) if not _TRACKING.match(k)])
    return urlunsplit(("https", host, p.path.rstrip("/"), query, ""))


def norm_title(title) -> str:
    s = re.sub(r"[^\w\s]", " ", (title or "").lower())
    words = _TITLE_NOISE.sub(" ", s).split()
    return " ".join(w for w in words if w not in _STOP and len(w) > 1 and not re.fullmatch(r"v?\d+", w))


def title_similarity(a: str, b: str) -> float:
    """token_set_ratio treats 'junior' as a perfect match for 'junior robo sumo'.
    Only trust it when the shorter title's words are (almost) all shared; else use the stricter sort ratio."""
    wa, wb = set(a.split()), set(b.split())
    small = min(len(wa), len(wb))
    if small == 1:
        return 100.0 if wa == wb else fuzz.token_sort_ratio(a, b)
    if len(wa & wb) / small >= 0.8:
        return fuzz.token_set_ratio(a, b)
    return fuzz.token_sort_ratio(a, b)


def _dates(row) -> list[datetime]:
    out = []
    for k in DATE_KEYS:
        v = row.get(k)
        if isinstance(v, str):
            v = datetime.fromisoformat(v)
        if v:
            out.append(v)
    return out


def dates_close(a, b) -> bool:
    """True if any date of a is within 2 days of any date of b, or either side has no dates."""
    da, db = _dates(a), _dates(b)
    if not da or not db:
        return True
    return any(abs(x - y) <= DATE_WINDOW for x in da for y in db)


def score(a: dict, b: dict) -> int:
    """0-120. Title similarity, +10 same city or both online, +10 same organizer."""
    ta, tb = norm_title(a.get("title")), norm_title(b.get("title"))
    if not ta or not tb or not dates_close(a, b):
        return 0
    s = title_similarity(ta, tb)
    ca, cb = (a.get("city") or "").lower(), (b.get("city") or "").lower()
    if (a.get("mode") == b.get("mode") == "online") or (ca and ca == cb):
        s += 10
    elif ca and cb:   # both venues known and different: almost always two separate events
        s -= 20
    if a.get("organizer") and b.get("organizer") and fuzz.token_set_ratio(
            a["organizer"].lower(), b["organizer"].lower()) >= 85:
        s += 10
    return round(s)


def best_match(row: dict, candidates: list[dict]) -> tuple[dict | None, int]:
    """candidates: rows with an 'id'. Same registration URL wins outright; else the top score."""
    url = clean_url(row.get("registration_url"))
    for c in candidates:
        if url and url in (clean_url(c.get("registration_url")), clean_url(c.get("event_url"))):
            return c, 120
    best, top = None, 0
    for c in candidates:
        s = score(row, c)
        if s > top:
            best, top = c, s
    return best, top


def detail(row: dict) -> int:
    return sum(v not in (None, [], "") for v in row.values())


def merge(rows: list[dict], existing: dict | None = None) -> dict:
    """Per field: value from the most detailed incoming row that has one, else the stored value.
    Themes are unioned."""
    ordered = sorted(rows, key=detail, reverse=True) + ([existing] if existing else [])
    out = {}
    for k in rows[0]:
        out[k] = next((r[k] for r in ordered if r.get(k) not in (None, [], "")), rows[0][k])
    themes = sorted({t for r in rows for t in r.get("themes") or []})
    out["themes"] = [t for t in themes if t != "other"] or themes or ["other"]
    return out
