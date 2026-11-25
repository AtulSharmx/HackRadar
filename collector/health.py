"""Source health: alert when a source gave 0 events, or only errors, for the whole window (default 2 days)."""
import os
from datetime import datetime, timedelta, timezone

from .normalize import IST
from .telegram import esc, send

WINDOW_HOURS = float(os.environ.get("HEALTH_WINDOW_HOURS", "48"))
REPEAT = timedelta(hours=6)   # plan 7.2: an alert repeats at most this often while the problem lasts
# Small lists: days with no open event for us are normal, only errors alert
ZERO_OK = {"hackerearth", "ethglobal", "hackster", "hackindia", "reskilll"}


def _ist(ts: str | None) -> str:
    if not ts:
        return "kabhi nahi"
    return datetime.fromisoformat(ts).astimezone(IST).strftime("%d %b, %I:%M %p IST")


def problems(db, sources: list[str], now: datetime | None = None) -> list[str]:
    """One HTML message per unhealthy source, built from real source_runs rows."""
    now = now or datetime.now(timezone.utc)
    since = (now - timedelta(hours=WINDOW_HOURS)).isoformat()
    out = []
    for src in sources:
        runs = db.select_all("source_runs", select="run_at,events_found,error_text",
                             source=f"eq.{src}", run_at=f"gte.{since}", order="run_at.desc")
        zero = runs and src not in ZERO_OK and all(r["events_found"] == 0 for r in runs)
        erroring = runs and all(r["error_text"] for r in runs)
        if not (zero or erroring):
            continue
        last_ok = db.select_all("source_runs", select="run_at", source=f"eq.{src}",
                                events_found="gt.0", order="run_at.desc", limit=1)
        last_err = next((r["error_text"] for r in runs if r["error_text"]), None)
        hours = int(WINDOW_HOURS)
        what = "koi hackathon nahi aaya" if zero else "har run mein error aaya"
        msg = (f"⚠️ <b>HackRadar: {esc(src.title())}</b> se pichhle {hours} ghante mein {what}\n\n"
               f"Runs is window mein: {len(runs)}\n"
               f"Aakhri successful run: {_ist(last_ok[0]['run_at'] if last_ok else None)}")
        if last_err:
            msg += f"\nAakhri error: <code>{esc(last_err[:300])}</code>"
        msg += "\n\nBaaki sources chal rahe hain. Theek hone tak har 6 ghante mein ye yaad dilaunga."
        out.append(msg)
    return out


def check_and_alert(db, sources: list[str], now: datetime | None = None) -> int:
    """A problem goes out once when it starts, then at most every REPEAT while it lasts (hourly runs must not
    spam). Health keeps no state of its own, so the last-sent time is a "health:<source>" row in source_runs,
    the table it already reads: no new table or migration. Only a delivered alert is recorded."""
    now = now or datetime.now(timezone.utc)
    recent = _recent(db, now)
    sent = 0
    for src in sources:
        if f"health:{src}" in recent:
            continue
        for m in problems(db, [src], now):
            sent += _send(db, src, m, now)
    return sent


def blowup_alert(db, blocked: int, now: datetime | None = None) -> bool:
    """A10 "Data blow-up": end_of_run's safety brake refused to mark `blocked` open events stale in one run.
    Same once-then-every-REPEAT rule as a source alert, kept as a "health:blowup" row."""
    now = now or datetime.now(timezone.utc)
    if "health:blowup" in _recent(db, now):
        return False
    msg = ("🚨 <b>HackRadar: Data blow-up</b>\n\n"
           f"Is run mein {blocked} open hackathons ek saath stale ho jaate (open ka 30% se zyada), "
           "isliye ek bhi stale nahi kiya.\n"
           "Shayad koi source aadha hi load hua ya uska format badal gaya. Logs dekho.\n\n"
           "Theek hone tak har 6 ghante mein ye yaad dilaunga.")
    return _send(db, "blowup", msg, now)


def _recent(db, now: datetime) -> set[str]:
    return {r["source"] for r in db.select_all("source_runs", select="source", source="like.health:*",
                                               run_at=f"gt.{(now - REPEAT).isoformat()}")}


def _send(db, what: str, msg: str, now: datetime) -> bool:
    run_url = os.environ.get("GITHUB_RUN_URL")
    if not send(msg + (f'\n<a href="{esc(run_url)}">GitHub run dekho</a>' if run_url else "")):
        return False
    db.post("source_runs", [{"source": f"health:{what}", "run_at": now.isoformat()}])
    return True
