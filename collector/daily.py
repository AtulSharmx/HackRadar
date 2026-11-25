"""Daily report v1 (plan 7.2): one Telegram message from the 9 o'clock IST run, sent even when all is fine, so a
report that doesn't arrive is itself the alarm. Counts and platform names only: no names, emails, phones or titles.
Left out because the database doesn't record them: pushes that failed, and devices active in the last 7 days."""
from collections import Counter, defaultdict
from datetime import datetime, timedelta

from .health import ZERO_OK
from .normalize import IST
from .telegram import esc, send


def build(db, now: datetime, excluded: int) -> str:
    """The 24 h before this run started: its own rows count in tomorrow's report, so each run is in exactly one.
    excluded: titles this run's quality gate kept out (the database doesn't store them)."""
    since = now - timedelta(hours=24)

    def day(ts: str) -> bool:
        return since <= datetime.fromisoformat(ts) < now

    per = defaultdict(list)   # source -> its runs; "health:*" rows are what alerts were sent, not runs
    for r in db.select_all("source_runs", select="source,run_at,events_found,error_text",
                           source="not.like.health:*", run_at=f"gte.{since.isoformat()}"):
        if day(r["run_at"]):
            per[r["source"]].append(r)
    issues = []
    for src, rs in sorted(per.items()):
        err = sum(1 for r in rs if r["error_text"])
        if err:
            issues.append(f"{esc(src)}: {len(rs)} mein se {err} runs mein error")
        elif src not in ZERO_OK and not any(r["events_found"] for r in rs):
            issues.append(f"{esc(src)}: {len(rs)} runs mein ek bhi hackathon nahi")
    failed = sum(1 for rs in per.values() for r in rs if r["error_text"])
    total_runs = sum(len(rs) for rs in per.values())

    events = db.select_all("events", select="status,sources,first_seen_at,updated_at")
    open_ = [e for e in events if e["status"] == "open"]
    if not open_:
        issues.append("Ek bhi open hackathon nahi")
    # status changes move updated_at (trigger), and closed/stale rows aren't written again until they reopen
    gone = Counter(e["status"] for e in events if e["status"] != "open" and day(e["updated_at"]))
    pushes = [t for t in db.select_all("push_tickets", select="sent_at", sent_at=f"gte.{since.isoformat()}") if day(t["sent_at"])]
    devices = db.select_all("devices", select="alerts_enabled")
    pending = db.select_all("submissions", select="id", status="eq.pending")
    reports = [r for r in db.select_all("reports", select="created_at", created_at=f"gte.{since.isoformat()}") if day(r["created_at"])]

    ist = now.astimezone(IST)
    lines = [f"📊 <b>HackRadar: daily report</b> ({ist.day} {ist:%b})", "",
             # a light source runs every hour, so its count is the number of collector runs that got to saving
             f"Runs (pichhle 24 ghante): {max(map(len, per.values()), default=0)}, "
             f"source runs {total_runs - failed} ok, {failed} error",
             f"Open hackathons: {len(open_)}"]
    # an event listed on two platforms counts for both, so the shares can add up to more than 100%
    for src, n in sorted(Counter(s for e in open_ for s in e["sources"]).items(), key=lambda x: (-x[1], x[0])):
        lines.append(f"• {esc(src)}: {n} ({round(100 * n / len(open_))}%)")
    lines += [f"Pichhle 24 ghante mein: {sum(1 for e in events if day(e['first_seen_at']))} naye, "
              f"{gone['closed']} closed, {gone['stale']} stale",
              f"Not-hackathons is run mein rok diye: {excluded}",
              f"Push bheje (24 ghante): {len(pushes)}",
              f"Devices: {len(devices)}, alerts on: {sum(1 for d in devices if d['alerts_enabled'])}",
              # reports have no "handled" state, so the new ones are what can be counted
              f"Queue: {len(pending)} submissions review ke liye, {len(reports)} report (24 ghante)", ""]
    lines += (["⚠️ Dekhna hai:"] + [f"• {i}" for i in issues]) if issues else ["✅ Sab theek"]
    return "\n".join(lines)


def send_if_due(db, now: datetime, excluded: int) -> bool:
    """Only from a run that starts in the 9 o'clock IST hour, and once a day: like health's alerts, a delivered
    report leaves a "health:daily" row in source_runs, so a run started by hand in that hour sends no second one.
    shortcut: a 09:17 run that GitHub starts after 10:00 sends no report that day (which is the alarm); if that
    happens often, send from the first run at or after 9 that finds no row for today."""
    ist = now.astimezone(IST)
    if ist.hour != 9:
        return False
    today = ist.replace(hour=0, minute=0, second=0, microsecond=0)
    if db.select_all("source_runs", select="run_at", source="eq.health:daily", run_at=f"gte.{today.isoformat()}"):
        return False
    if not send(build(db, now, excluded)):
        return False
    db.post("source_runs", [{"source": "health:daily", "run_at": now.isoformat()}])
    return True
