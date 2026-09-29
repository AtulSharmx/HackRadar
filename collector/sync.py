"""Write one run's parsed events to Supabase: match known links, dedupe new ones, merge, upsert."""
import hashlib
import json
import uuid
from collections import defaultdict
from datetime import datetime, timezone

from . import changes, dedupe, trust
from .db import Db
from .models import Event


def sync(db: Db, events: list[Event], down: set[str] = frozenset()) -> tuple[dict[str, int], int, list[str]]:
    """Returns (new-event counts per source, number of tracked changes recorded, new event ids).
    down: sources that failed this run. Events linked to them are left as stored, because merging
    only the surviving source's values would record fake changes (and flip back next run)."""
    stored = {r["id"]: r for r in db.select_all("events", select="*")}
    links = db.select_all("event_sources", select="source,source_event_id,event_id")
    link_of = {(l["source"], l["source_event_id"]): l["event_id"] for l in links}
    sources_of = defaultdict(set)
    for l in links:
        sources_of[l["event_id"]].add(l["source"])

    now = datetime.now(timezone.utc).isoformat()
    incoming = defaultdict(dict)     # event_id -> {source: row}
    new_ids, new_count, reviews = set(), defaultdict(int), []
    source_rows = []
    pool = [dict(r) for r in stored.values()]   # match candidates, grows as new events are created

    for e in {(e.source, e.source_event_id): e for e in events}.values():
        row = e.to_row()
        event_id = link_of.get((e.source, e.source_event_id))
        if event_id is None:
            # never merge two records of the same source: each source's own id is authoritative
            cands = [c for c in pool if e.source not in sources_of[c["id"]]]
            match, s = dedupe.best_match(row, cands)
            if match and s >= dedupe.MERGE_AT:
                event_id = match["id"]
            else:
                event_id = str(uuid.uuid4())
                new_ids.add(event_id)
                new_count[e.source] += 1
                pool.append({"id": event_id, **row})
                if match and s >= dedupe.REVIEW_AT:
                    reviews.append({"reason": "possible_duplicate", "event_a": event_id,
                                    "event_b": match["id"], "score": min(s, 32767)})
            sources_of[event_id].add(e.source)
        incoming[event_id][e.source] = row
        source_rows.append({
            "source": e.source, "source_event_id": e.source_event_id, "event_id": event_id,
            "source_url": e.source_url, "missing_runs": 0, "last_seen_at": now,
            "raw_hash": hashlib.sha256(json.dumps(row, sort_keys=True, default=str).encode()).hexdigest(),
        })

    event_rows, change_rows = [], []
    for event_id, by_source in incoming.items():
        old = stored.get(event_id)
        if old and sources_of[event_id] & down:
            continue
        merged = dedupe.merge(list(by_source.values()), old)
        # seen on a source this run and passed is_relevant (still open): reopen if it was closed/stale
        merged["status"] = "open"
        merged["warnings"] = trust.red_flags(merged, by_source)
        merged["trust_label"] = trust.label(merged, merged["warnings"], sources_of[event_id])
        merged["fingerprint"] = changes.fingerprint(merged)
        # old fingerprint missing = first run with change tracking: set it, don't report a change
        if old and old.get("fingerprint") and old["fingerprint"] != merged["fingerprint"]:
            change = changes.diff(old, merged)
            if change:
                change_rows.append({"event_id": event_id, **change})
        # only write real changes, so updated_at (what the app syncs on) moves only then
        if old is None or any(not changes.same(merged[k], old.get(k)) for k in merged):
            event_rows.append({"id": event_id, **merged, "last_checked_at": now})

    # ponytail: separate requests, not one transaction; an interrupted run is repaired by the next one
    db.post("events", event_rows, on_conflict="id")
    db.post("event_sources", source_rows, on_conflict="source,source_event_id")
    db.post("review_queue", reviews)
    db.post("event_changes", change_rows)
    moved = [c["event_id"] for c in change_rows if {"venue_address", "city"} & set(c["changed_fields"])]
    if moved:   # venue changed: old coordinates are wrong now, geocode again
        r = db.http.patch("/events", params={"id": f"in.({','.join(moved)})"},
                          json={"lat": None, "lng": None, "location_approximate": False})
        r.raise_for_status()
    return dict(new_count), len(change_rows), sorted(new_ids)
