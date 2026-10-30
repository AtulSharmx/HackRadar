"""Source health: alert when a source gave 0 events, or only errors, for the whole window (default 2 days)."""
import os
from datetime import datetime, timedelta, timezone

from .normalize import IST
from .telegram import esc, send

WINDOW_HOURS = float(os.environ.get("HEALTH_WINDOW_HOURS", "48"))
# Small lists: days with no open event for us are normal, only errors alert
ZERO_OK = {"hackerearth", "ethglobal", "hackster"}


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
        msg += "\n\nBaaki sources chal rahe hain. Theek hone tak har run pe ye yaad dilaunga."
        out.append(msg)
    return out


def check_and_alert(db, sources: list[str]) -> int:
    msgs = problems(db, sources)
    run_url = os.environ.get("GITHUB_RUN_URL")
    for m in msgs:
        send(m + (f'\n<a href="{esc(run_url)}">GitHub run dekho</a>' if run_url else ""))
    return len(msgs)
