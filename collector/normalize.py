"""Turn messy source text into clean values: dates, money, mode, city, themes, text."""
import html
import json
import re
from datetime import datetime, timedelta, timezone

from dateutil import parser as dateparser

from . import config
from .config import ROOT

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

CITIES = json.loads((ROOT / "shared/cities.json").read_text(encoding="utf-8"))["cities"]
CITY_ALIASES = {n.lower(): c["name"] for c in CITIES for n in [c["name"], *c["aliases"]]}
# names that also exist abroad ("Salem, Oregon") or as common words: never used alone as proof of India
_AMBIGUOUS = {"salem", "mandi", "gaya", "kota", "goa"}
_CITY_RE = re.compile(r"\b(" + "|".join(sorted((re.escape(k) for k in CITY_ALIASES if k not in _AMBIGUOUS),
                                                 key=len, reverse=True)) + r")\b", re.I)
_INDIA_HINTS = re.compile(r"\b(india|iit|nit|iiit|bits pilani)\b", re.I)


def clean_city(name) -> str | None:
    s = re.sub(r"\s+", " ", name or "").strip(" ,.")
    if not s:
        return None
    key = s.lower()
    # "Bangalore Urban", "Pune District" -> the city itself
    return CITY_ALIASES.get(key) or CITY_ALIASES.get(re.sub(r"\s+(urban|rural|district|city)$", "", key)) or s.title()


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


# Themes v2 (Plan A3), tuned on 212 open Unstop events on 30 Sep 2026 where 41% were "other".
_CONTEST = re.compile(r"\b(coding contest|programming (contest|league)|competitive programming|code ?clash|cp contest|coding league|"
                      r"battle of codes|code yudh|dsa|codesprint|coderumble|code ?rush|algo\w*)\b", re.I)
_CONTEST_SKILLS = re.compile(r"\b(data structures|algorithms|competitive programming)\b", re.I)
# description text is noisy ("AI-powered future" everywhere), so only unambiguous phrases count there
_DESC_WORDS = {
    "ai_ml": r"artificial intelligence|machine learning|deep learning|generative ai|large language models?|llms?|computer vision",
    "cybersecurity": r"cyber ?security|capture the flag|ethical hacking|penetration testing",
    "web": r"web development|full[ -]?stack|web app(lication)?s?",
    "mobile": r"mobile app(lication)?s?|android app|flutter",
    "data_science": r"data science|data analytics|big data",
    "blockchain": r"blockchain|web3|smart contracts?",
    "iot_hardware": r"internet of things|\biot\b|embedded systems|hardware prototype",
}
_DESC_RES = {k: re.compile(rf"\b({v})\b", re.I) for k, v in _DESC_WORDS.items()}
_GENERAL_EVENT = re.compile(r"hack|thon\b|challenge|innovat|idea|build", re.I)


def classify_themes(title: str, tags: list[str], description: str | None = None) -> list[str]:
    """Themes from title + source tags, then contest signals, then strong description phrases.
    A hackathon with no specific theme is open innovation; "other" only when nothing fits."""
    found = [t for t in map_themes(title, *tags) if t != "other"]
    # skills alone mark a contest only when the title doesn't say hackathon ("HackForge" lists DSA but isn't a contest)
    skill_contest = not found and not _GENERAL_EVENT.search(title or "") and any(_CONTEST_SKILLS.search(t or "") for t in tags)
    if _CONTEST.search(title or "") or skill_contest:
        found.append("coding_contest")
    if not found and description:
        found = [k for k, rx in _DESC_RES.items() if rx.search(description)]
    if not found and _GENERAL_EVENT.search(title or ""):
        found = ["open_innovation"]
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
