"""One collector run: every adapter fetches + parses (isolated), then everything is deduped and saved together.

Run with:  python -m collector.main
"""
import os
import re
import sys
import time
import traceback
from datetime import datetime, timedelta, timezone

from . import community, config, daily, geocode, health, notify, push, quality
from .adapters import ADAPTERS, HEAVY
from .db import Db
from .http_client import Client
from .sync import sync


def due(adapters, now: datetime, event: str | None) -> list:
    """Scheduled runs fetch the heavy sources only every 6 h; a run started by hand fetches everything.
    A skipped source isn't in ok_sources, so end_of_run doesn't count its events as missing."""
    # the hour the run was scheduled for: collect.yml fires at :47 UTC and GitHub often starts it late
    if event != "schedule" or (now - timedelta(minutes=47)).hour % 6 == 0:
        return list(adapters)
    return [a for a in adapters if a.name not in HEAVY]


def valid(e) -> bool:
    return bool(e.title and len(e.title) >= 3 and re.match(r"^https?://", e.registration_url or ""))


def collect(adapter, client) -> tuple[list, dict]:
    """Fetch + parse one source. Never raises: a broken source must not stop the others."""
    t0 = time.monotonic()
    stat = {"found": 0, "error": None, "fetched": 0, "ok": False, "excluded": {}, "excluded_ids": []}
    events = []
    try:
        raws = adapter.fetch(client)
        stat["fetched"] = len(raws)
        bad = 0
        for raw in raws:
            try:
                e = adapter.parse(raw)
            except Exception:
                bad += 1
                continue
            if valid(e) and adapter.is_relevant(e):
                reason = quality.not_hackathon_reason(e.title)
                if reason:   # quality gate (Plan A2): esports, quizzes, robot races... never reach the feed
                    stat["excluded"][reason] = stat["excluded"].get(reason, 0) + 1
                    stat["excluded_ids"].append(e.source_event_id)
                    continue
                events.append(e)
        if bad:
            stat["error"] = f"{bad} of {len(raws)} records failed to parse"
        stat["ok"] = len(raws) > 0   # fetched fine; parse errors on a few records don't count as down
    except Exception as exc:
        traceback.print_exc()
        stat["error"] = f"{type(exc).__name__}: {exc}"[:1000]
    stat["found"] = len(events)
    stat["ms"] = int((time.monotonic() - t0) * 1000)
    return events, stat


def hide_excluded(db, stats):
    """Events stored before the quality gate existed disappear now, not after 3 missed runs."""
    for name, s in stats.items():
        ids = s.get("excluded_ids") or []
        for i in range(0, len(ids), 100):
            links = db.select_all("event_sources", select="event_id", source=f"eq.{name}",
                                  source_event_id=f"in.({','.join(ids[i:i + 100])})")
            if links:
                r = db.http.patch("/events", params={"id": f"in.({','.join(l['event_id'] for l in links)})", "status": "eq.open"},
                                  json={"status": "stale", "trust_label": "stale"})
                r.raise_for_status()


def main() -> int:
    now = datetime.now(timezone.utc)
    run_started = now.isoformat()
    db, client = Db(), Client()
    all_events, stats = [], {}
    adapters = due(ADAPTERS, now, os.environ.get("GITHUB_EVENT_NAME"))   # GitHub Actions sets it: schedule / workflow_dispatch
    skipped = {a.name for a in ADAPTERS if a not in adapters}
    if skipped:
        print(f"skipped this hour (every 6 h): {', '.join(sorted(skipped))}")
    for a in adapters:
        events, stats[a.name] = collect(a, client)
        if events and hasattr(a, "enrich"):
            try:   # details are extra: a failure here must not drop the source's events
                known = {r["source_event_id"]: r["source_updated_at"] for r in
                         db.select_all("event_sources", select="source_event_id,source_updated_at", source=f"eq.{a.name}")}
                stats[a.name]["enrich"] = a.enrich(client, events, known, config.MAX_DETAILS_PER_RUN)
            except Exception as exc:
                traceback.print_exc()
                stats[a.name]["enrich"] = {"error": f"{type(exc).__name__}: {exc}"[:200]}
        all_events += events
    try:   # approved submissions go through the same sync as every platform (dedupe, trust, alerts)
        submitted = community.events(db)
        all_events += submitted
        print(f"community: {len(submitted)} approved submissions open")
    except Exception:
        traceback.print_exc()
    # a skipped source counts as down: merging an event's other sources alone would flip its values every hour
    new, n_changes, new_ids = sync(db, all_events, down=skipped | {n for n, s in stats.items() if not s['ok']})
    for name, s in stats.items():
        db.log_run(name, s["found"], new.get(name, 0), s["ms"], s["error"])
        print(f"{name}: fetched {s['fetched']}, kept {s['found']}, new {new.get(name, 0)}"
              + (f", details {s['enrich']}" if s.get("enrich") else "")
              + (f", not hackathons {s['excluded']}" if s.get("excluded") else "")
              + (f", ERROR {s['error']}" if s["error"] else ""))
    hide_excluded(db, stats)
    ok = [name for name, s in stats.items() if s["ok"]]
    end = db.rpc("end_of_run", ok_sources=ok, run_started=run_started)[0]
    blocked = end.get("stale_blocked") or 0   # migration 0022's safety brake; the key is missing before it
    print(f"changes recorded: {n_changes}, closed: {end['closed_count']}, stale: {end['stale_count']}"
          + (f", kept open by the 30% brake: {blocked}" if blocked else ""))
    try:   # geocoding is best effort: Nominatim being down must not fail the run
        print(f"geocode: {geocode.run(db)}")
    except Exception:
        traceback.print_exc()
    try:   # last run's push receipts first: a dead token is dropped before anything is sent to it
        print(f"push receipts: {push.check_receipts(db)}")
    except Exception:
        traceback.print_exc()
    try:   # after geocoding, so new offline events already have a distance
        print(f"push: {notify.push_new_matches(db, new_ids)} new-match pushes")
    except Exception:
        traceback.print_exc()
    try:   # its own try: a failure above must not stop the saved-event change pushes
        print(f"saved-event change pushes: {notify.saved_changes(db)}")
    except Exception:
        traceback.print_exc()
    try:   # new submissions and reports to the admin's Telegram
        print(f"admin queue: {community.admin_queue(db)} items")
    except Exception:
        traceback.print_exc()
    try:   # A10: the brake already kept the events open, so a failed alert must not fail the run
        if blocked:
            print(f"data blow-up alert sent: {health.blowup_alert(db, blocked)}")
    except Exception:
        traceback.print_exc()
    try:   # a broken health check must not fail an otherwise good run
        print(f"health alerts sent: {health.check_and_alert(db, [a.name for a in ADAPTERS])}")
    except Exception:
        traceback.print_exc()
    try:   # last, on its own: the 9 am report must not touch the steps above, nor fail the run
        print(f"daily report sent: {daily.send_if_due(db, now, sum(sum(s['excluded'].values()) for s in stats.values()))}")
    except Exception:
        traceback.print_exc()
    return 1 if all(s["found"] == 0 and s["error"] for s in stats.values()) else 0


if __name__ == "__main__":
    sys.exit(main())
