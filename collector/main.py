"""One collector run: every adapter fetches + parses (isolated), then everything is deduped and saved together.

Run with:  python -m collector.main
"""
import re
import sys
import time
import traceback
from datetime import datetime, timezone

from . import config, geocode, health, notify
from .adapters import ADAPTERS
from .db import Db
from .http_client import Client
from .sync import sync


def valid(e) -> bool:
    return bool(e.title and len(e.title) >= 3 and re.match(r"^https?://", e.registration_url or ""))


def collect(adapter, client) -> tuple[list, dict]:
    """Fetch + parse one source. Never raises: a broken source must not stop the others."""
    t0 = time.monotonic()
    stat = {"found": 0, "error": None, "fetched": 0, "ok": False}
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


def main() -> int:
    run_started = datetime.now(timezone.utc).isoformat()
    db, client = Db(), Client()
    all_events, stats = [], {}
    for a in ADAPTERS:
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
    new, n_changes, new_ids = sync(db, all_events, down={n for n, s in stats.items() if not s['ok']})
    for name, s in stats.items():
        db.log_run(name, s["found"], new.get(name, 0), s["ms"], s["error"])
        print(f"{name}: fetched {s['fetched']}, kept {s['found']}, new {new.get(name, 0)}"
              + (f", details {s['enrich']}" if s.get("enrich") else "")
              + (f", ERROR {s['error']}" if s["error"] else ""))
    ok = [name for name, s in stats.items() if s["ok"]]
    end = db.rpc("end_of_run", ok_sources=ok, run_started=run_started)[0]
    print(f"changes recorded: {n_changes}, closed: {end['closed_count']}, stale: {end['stale_count']}")
    try:   # geocoding is best effort: Nominatim being down must not fail the run
        print(f"geocode: {geocode.run(db)}")
    except Exception:
        traceback.print_exc()
    try:   # after geocoding, so new offline events already have a distance
        print(f"telegram: {notify.new_matches(db, new_ids)} new matches, {notify.saved_changes(db)} saved-event changes")
    except Exception:
        traceback.print_exc()
    try:   # a broken health check must not fail an otherwise good run
        print(f"health alerts sent: {health.check_and_alert(db, [a.name for a in ADAPTERS])}")
    except Exception:
        traceback.print_exc()
    return 1 if all(s["found"] == 0 and s["error"] for s in stats.values()) else 0


if __name__ == "__main__":
    sys.exit(main())
