"""Quality gate (Plan A2): keep hackathons out of non-hackathon noise, and flag dates that can't be right.

Built from the 232 open Unstop events on 29 Sep 2026:
- Unstop's own category is useless (231 of 232 are "online_coding_challenge") and organizer tags are
  unreliable ("Quizzes & Treasure Hunt" sits on NASA Space Apps and a CTF), so both are ignored.
- Hackathon names vary too much to require a keyword (Vibeathon, Code Yudh, Startupathon).
So an event stays unless its title clearly names something that isn't a hackathon.
"""
import re
from datetime import datetime, timedelta, timezone

# (reason, pattern) checked against the title. Word boundaries keep "Game Jam" and "Pokerbots" in.
NOT_HACKATHON = [
    ("esports", r"\b(valorant|bgmi|free ?fire|pubg|call of duty|cod mobile|e-?sports?|gaming tournament|chess)\b"),
    ("quiz", r"\b(quiz|trivia|treasure hunt|olympiad)\b"),
    ("presentation", r"\b(poster (exhibition|presentation|making|competition)|paper presentation|debate|essay|elocution|photography|dance|singing)\b"),
    ("business", r"\b(business plan|b-?plan|case study|marketing (challenge|competition))\b"),
    ("robot race", r"\b(robo[ -]?(race|sumo|soccer|war|wars|maze)|line follower|drone race|uav competition)\b"),
    ("esports", r"\btournament\b(?!.*\bhack)"),   # "... Tournament" unless it's a hacking tournament
]
_NOT = [(reason, re.compile(p, re.I)) for reason, p in NOT_HACKATHON]


def not_hackathon_reason(title: str) -> str | None:
    """The reason this title is not a hackathon, or None when it may be one (the default)."""
    for reason, rx in _NOT:
        if rx.search(title or ""):
            return reason
    return None


def date_flags(row: dict, now: datetime | None = None) -> list[dict]:
    """Warnings for dates that can't be right. The dates are kept (never guessed), the event is flagged."""
    now = now or datetime.now(timezone.utc)
    d = {k: datetime.fromisoformat(row[k]) if isinstance(row.get(k), str) else row.get(k)
         for k in ("registration_deadline", "start_date", "end_date")}
    flags = []
    if d["registration_deadline"] and d["end_date"] and d["registration_deadline"] > d["end_date"] + timedelta(days=1):
        flags.append({"code": "date_conflict", "text": "Registration closes after the event ends; check the dates on the event page"})
    if d["registration_deadline"] and d["registration_deadline"] > now + timedelta(days=400):
        flags.append({"code": "date_conflict", "text": "The deadline is more than a year away; it may be a typo"})
    return flags
