"""One collector run: every adapter fetches, parses, filters, saves, and logs a source_runs row.

Run with:  python -m collector.main
"""
import re
import sys
import time
import traceback

from .adapters import ADAPTERS
from .db import Db
from .http_client import Client


def valid(e) -> bool:
    return bool(e.title and len(e.title) >= 3 and re.match(r"^https?://", e.registration_url or ""))


def run_source(adapter, client, db) -> str:
    t0 = time.monotonic()
    found = new = 0
    error = None
    try:
        raws = adapter.fetch(client)
        events, bad = [], 0
        for raw in raws:
            try:
                e = adapter.parse(raw)
            except Exception:
                bad += 1
                continue
            if valid(e) and adapter.is_relevant(e):
                events.append(e)
        found = len(events)
        new = db.save(adapter.name, events)
        if bad:
            error = f"{bad} of {len(raws)} records failed to parse"
        summary = f"{adapter.name}: fetched {len(raws)}, kept {found}, new {new}" + (f", {error}" if error else "")
    except Exception as exc:   # one broken source never stops the others
        error = f"{type(exc).__name__}: {exc}"[:1000]
        traceback.print_exc()
        summary = f"{adapter.name}: FAILED - {error}"
    db.log_run(adapter.name, found, new, int((time.monotonic() - t0) * 1000), error)
    return summary


def main() -> int:
    db, client = Db(), Client()
    results = [run_source(a, client, db) for a in ADAPTERS]
    print("\n".join(results))
    return 1 if all("FAILED" in r for r in results) else 0


if __name__ == "__main__":
    sys.exit(main())
