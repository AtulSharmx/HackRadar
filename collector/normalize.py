"""Turn messy source text into clean values: dates, money, mode, city, themes, text."""
import html
import re
from datetime import datetime, timedelta, timezone

from dateutil import parser as dateparser

from . import config

IST = timezone(timedelta(hours=5, minutes=30))  # India has no DST

# ---------- dates ----------

def parse_date(value, deadline: bool = False) -> datetime | None:
    """Any date string -> aware UTC datetime. No time given: 23:59 IST for deadlines, 00:00 IST otherwise."""
    if not value:
        return None
    default = datetime(2000, 1, 1, 23, 59) if deadline else datetime(2000, 1, 1)
    try:
        dt = dateparser.parse(str(value), default=default)
    except (ValueError, OverflowError):
        return None
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=IST)
    return dt.astimezone(timezone.utc)

# ---------- money ----------

_UNITS = {"lakh": 100_000, "lakhs": 100_000, "lac": 100_000, "lacs": 100_000,
          "crore": 10_000_000, "crores": 10_000_000, "cr": 10_000_000, "k": 1_000}
_MONEY = re.compile(r"(\d[\d,]*(?:\.\d+)?)\s*(lakhs?|lacs?|crores?|cr|k)?\b", re.I)


def parse_money(text) -> tuple[int | None, bool]:
    """'₹1,00,000' / '1 lakh' / '$5,000' -> (rupees, approximate). (None, False) if no amount."""
    s = strip_html(text) or ""
    m = _MONEY.search(s)
    if not m:
        return None, False
    amount = float(m.group(1).replace(",", ""))
    if m.group(2):
        amount *= _UNITS[m.group(2).lower()]
    if "$" in s or "usd" in s.lower():
        return round(amount * config.USD_TO_INR), True
    return round(amount), False

# ---------- mode ----------

_MODES = [("hybrid", "hybrid"),
          ("online", "online"), ("virtual", "online"), ("remote", "online"),
          ("in-person", "offline"), ("in person", "offline"), ("on-site", "offline"),
          ("onsite", "offline"), ("offline", "offline")]


def parse_mode(text) -> str | None:
    s = (text or "").lower()
    for word, mode in _MODES:
        if word in s:
            return mode
    return None

# ---------- city ----------

CITY_ALIASES = {
    "bangalore": "Bengaluru", "bengaluru": "Bengaluru",
    "gurgaon": "Gurugram", "gurugram": "Gurugram",
    "bombay": "Mumbai", "mumbai": "Mumbai", "navi mumbai": "Navi Mumbai",
    "delhi ncr": "Delhi", "new delhi": "Delhi", "delhi": "Delhi",
    "madras": "Chennai", "chennai": "Chennai",
    "calcutta": "Kolkata", "kolkata": "Kolkata",
    "poona": "Pune", "pune": "Pune",
    "noida": "Noida", "greater noida": "Greater Noida", "ghaziabad": "Ghaziabad", "faridabad": "Faridabad",
    "hyderabad": "Hyderabad", "secunderabad": "Hyderabad",
    "ahmedabad": "Ahmedabad", "gandhinagar": "Gandhinagar", "surat": "Surat", "vadodara": "Vadodara",
    "jaipur": "Jaipur", "lucknow": "Lucknow", "kanpur": "Kanpur", "indore": "Indore", "bhopal": "Bhopal",
    "gwalior": "Gwalior", "nagpur": "Nagpur", "nashik": "Nashik", "chandigarh": "Chandigarh", "mohali": "Mohali",
    "dehradun": "Dehradun", "coimbatore": "Coimbatore", "kochi": "Kochi", "cochin": "Kochi",
    "trivandrum": "Thiruvananthapuram", "thiruvananthapuram": "Thiruvananthapuram",
    "vizag": "Visakhapatnam", "visakhapatnam": "Visakhapatnam", "vijayawada": "Vijayawada",
    "bhubaneswar": "Bhubaneswar", "patna": "Patna", "ranchi": "Ranchi", "guwahati": "Guwahati",
    "srinagar": "Srinagar", "jammu": "Jammu", "amritsar": "Amritsar", "ludhiana": "Ludhiana",
    "varanasi": "Varanasi", "prayagraj": "Prayagraj", "allahabad": "Prayagraj",
    "mysore": "Mysuru", "mysuru": "Mysuru", "mangalore": "Mangaluru", "mangaluru": "Mangaluru",
    "manipal": "Manipal", "vellore": "Vellore", "madurai": "Madurai", "raipur": "Raipur",
    "goa": "Goa", "panaji": "Goa",
}
_CITY_RE = re.compile(r"\b(" + "|".join(sorted(map(re.escape, CITY_ALIASES), key=len, reverse=True)) + r")\b", re.I)
_INDIA_HINTS = re.compile(r"\b(india|iit|nit|iiit|bits pilani)\b", re.I)


def clean_city(name) -> str | None:
    s = re.sub(r"\s+", " ", name or "").strip(" ,.")
    if not s:
        return None
    return CITY_ALIASES.get(s.lower(), s.title())


def find_indian_city(text) -> str | None:
    m = _CITY_RE.search(text or "")
    return CITY_ALIASES[m.group(1).lower()] if m else None


def looks_indian(text) -> bool:
    # ponytail: keyword list misses venues like "Lovely Professional University"; log misses in docs/misses.md
    return bool(find_indian_city(text) or _INDIA_HINTS.search(text or ""))

# ---------- themes ----------

_THEME_WORDS = {
    "ai_ml": r"ai|artificial intelligence|machine learning|ml|genai|gen ai|llms?|deep learning|computer vision|nlp",
    "cybersecurity": r"cyber\s?security|cyber|security|ctf|infosec",
    "web": r"web|web dev|full ?stack|frontend|backend",
    "mobile": r"mobile|android|ios|app development|flutter",
    "data_science": r"data science|data analytics|analytics|big data|data analysis",
    "blockchain": r"blockchain|web3|crypto|defi|nft",
    "iot_hardware": r"iot|internet of things|hardware|robotics|embedded|arduino",
    "open_innovation": r"open ended|open innovation|open theme|any theme",
}
_THEME_RES = {k: re.compile(rf"\b({v})\b", re.I) for k, v in _THEME_WORDS.items()}


def map_themes(*texts) -> list[str]:
    blob = " | ".join(t for t in texts if t)
    found = [k for k, rx in _THEME_RES.items() if rx.search(blob)]
    return found or ["other"]

# ---------- text ----------

def strip_html(text, limit: int | None = None) -> str | None:
    if not text:
        return None
    s = re.sub(r"<[^>]+>", " ", str(text))
    s = re.sub(r"\s+", " ", html.unescape(s)).strip()
    if limit and len(s) > limit:
        s = s[: limit - 1].rstrip() + "…"
    return s or None
