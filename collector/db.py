"""Supabase writes through PostgREST with the service key (bypasses RLS). Collector only."""
import hashlib
import json
import uuid
from datetime import datetime, timezone

import httpx

from . import config
from .models import Event


class Db:
    def __init__(self):
        if not (config.SUPABASE_URL and config.SUPABASE_SERVICE_ROLE_KEY):
            raise RuntimeError("SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY missing in .env")
        key = config.SUPABASE_SERVICE_ROLE_KEY
        self.http = httpx.Client(base_url=config.SUPABASE_URL.rstrip("/") + "/rest/v1", timeout=30,
                                 headers={"apikey": key, "Authorization": f"Bearer {key}"})

    def _post(self, table: str, rows: list[dict], on_conflict: str | None = None):
        if not rows:
            return
        prefer = "return=minimal" + (",resolution=merge-duplicates" if on_conflict else "")
        params = {"on_conflict": on_conflict} if on_conflict else None
        r = self.http.post(f"/{table}", params=params, json=rows, headers={"Prefer": prefer})
        if r.status_code >= 300:
            raise RuntimeError(f"{table} write failed: {r.status_code} {r.text[:300]}")

    def known(self, source: str) -> dict[str, tuple[str, str]]:
        """source_event_id -> (event_id, raw_hash) for everything already stored from this source."""
        # ponytail: one page of up to 1000 rows (Supabase default cap); page with Range headers past that
        r = self.http.get("/event_sources", params={"select": "source_event_id,event_id,raw_hash",
                                                    "source": f"eq.{source}"})
        r.raise_for_status()
        return {x["source_event_id"]: (x["event_id"], x["raw_hash"]) for x in r.json()}

    def save(self, source: str, events: list[Event]) -> int:
        """Insert new events, update changed ones, mark every seen source link fresh. Returns new count."""
        known = self.known(source)
        now = datetime.now(timezone.utc).isoformat()
        event_rows, source_rows, new = [], [], 0
        for e in {e.source_event_id: e for e in events}.values():   # one row per id even if a page repeats
            row = e.to_row()
            h = hashlib.sha256(json.dumps(row, sort_keys=True, default=str).encode()).hexdigest()
            event_id, old_hash = known.get(e.source_event_id, (None, None))
            if event_id is None:
                event_id, new = str(uuid.uuid4()), new + 1
            if h != old_hash:   # unchanged rows are skipped so updated_at only moves on real changes
                event_rows.append({"id": event_id, **row, "last_checked_at": now})
            source_rows.append({"source": source, "source_event_id": e.source_event_id, "event_id": event_id,
                                "source_url": e.source_url, "raw_hash": h, "missing_runs": 0,
                                "last_seen_at": now})
        # ponytail: two requests, not one transaction; a crash between them leaves an event with no
        # source link, which the next run re-inserts. Move to an RPC if that ever shows up.
        self._post("events", event_rows, on_conflict="id")
        self._post("event_sources", source_rows, on_conflict="source,source_event_id")
        return new

    def log_run(self, source: str, found: int, new: int, duration_ms: int, error: str | None):
        self._post("source_runs", [{"source": source, "events_found": found, "new_events": new,
                                    "duration_ms": duration_ms, "error_text": error}])
