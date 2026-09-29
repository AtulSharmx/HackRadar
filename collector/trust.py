"""Trust label + red flags (TRD "Trust labels"). Plain rules, so every label is explainable in one line."""
from datetime import datetime, timezone
from urllib.parse import urlsplit

from . import config
from .normalize import IST


def _host(url) -> str:
    return urlsplit(url or "").netloc.lower().removeprefix("www.")


def _on(host: str, domains) -> bool:
    return any(host == d or host.endswith("." + d) for d in domains)


def _dt(v):
    return datetime.fromisoformat(v) if isinstance(v, str) else v


def _day(v) -> str:
    return _dt(v).astimezone(IST).strftime("%d %b")


def red_flags(row: dict, by_source: dict[str, dict]) -> list[dict]:
    """row: merged event. by_source: {source: that source's own row} for date conflicts."""
    flags = []
    fee = row.get("fee_amount")
    has_reward = row.get("prize_amount_inr") or row.get("prize_text") or row.get("perks")
    if fee is not None and fee > config.FEE_LIMIT and not has_reward:
        flags.append({"code": "high_fee", "text": f"Fee is ₹{fee:,} per team and no prize is listed"})

    if not (row.get("organizer") or "").strip():
        flags.append({"code": "no_organizer", "text": "Organizer is not mentioned"})

    deadlines = {s: _dt(r["registration_deadline"]) for s, r in by_source.items() if r.get("registration_deadline")}
    if len(deadlines) > 1:
        (s1, d1), (s2, d2) = min(deadlines.items(), key=lambda x: x[1]), max(deadlines.items(), key=lambda x: x[1])
        if (d2 - d1).total_seconds() > config.DATE_CONFLICT_DAYS * 86400:
            flags.append({"code": "date_conflict",
                          "text": f"{s1.title()} says the deadline is {_day(d1)}, {s2.title()} says {_day(d2)}"})

    reg, page = _host(row.get("registration_url")), _host(row.get("event_url"))
    if reg and page and reg != page and not _on(reg, config.PLATFORM_HOSTS) and not _on(reg, (page,)):
        flags.append({"code": "domain_mismatch",
                      "text": f"Registration goes to {reg}, not the event's own site {page}"})

    if set(by_source) == {"manual"} and _on(reg, config.SOCIAL_HOSTS):
        flags.append({"code": "social_only", "text": f"Only known from a {reg} link, no official page"})
    return flags


def label(row: dict, flags: list[dict], sources, now: datetime | None = None) -> str:
    now = now or datetime.now(timezone.utc)
    deadline = _dt(row.get("registration_deadline"))
    if row.get("status", "open") != "open" or (deadline and deadline < now):
        return "stale"
    if flags:
        return "warning"
    offline = row.get("mode") in ("offline", "hybrid")
    if (not deadline or not row.get("mode") or row.get("fee_amount") is None
            or (offline and not row.get("city"))):
        return "check_details"
    if set(sources) & set(config.TRUSTED_SOURCES) and row.get("organizer") and row.get("registration_url"):
        return "trusted_source"
    return "check_details"
