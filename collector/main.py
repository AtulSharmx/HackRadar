"""One collector run: every adapter fetches + parses (isolated), then everything is deduped and saved together.

Run with:  python -m collector.main
"""
import re
import sys
import time
import traceback
from datetime import datetime, timezone

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
        all_events += events
    new, n_changes = sync(db, all_events)
    for name, s in stats.items():
        db.log_run(name, s["found"], new.get(name, 0), s["ms"], s["error"])
        print(f"{name}: fetched {s['fetched']}, kept {s['found']}, new {new.get(name, 0)}"
              + (f", ERROR {s['error']}" if s["error"] else ""))
    ok = [name for name, s in stats.items() if s["ok"]]
    end = db.rpc("end_of_run", ok_sources=ok, run_started=run_started)[0]
    print(f"changes recorded: {n_changes}, closed: {end['closed_count']}, stale: {end['stale_count']}")
    return 1 if all(s["found"] == 0 and s["error"] for s in stats.values()) else 0


if __name__ == "__main__":
    sys.exit(main())
