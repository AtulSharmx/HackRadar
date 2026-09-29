"""Change detection: fingerprint the fields that matter, and describe what changed between two versions."""
import hashlib
import json
from datetime import datetime, timezone

from .config import ROOT

TRACKED = json.loads((ROOT / "shared/constants.json").read_text())["change_fields"]


def canon(v):
    """Same value, same form: DB timestamps and our isoformat strings compare equal."""
    if isinstance(v, str) and "T" in v:
        try:
            return datetime.fromisoformat(v).astimezone(timezone.utc).isoformat()
        except ValueError:
            pass
    return v


def same(a, b) -> bool:
    return canon(a) == canon(b)


def fingerprint(row: dict) -> str:
    """SHA-256 of the tracked fields, in the fixed order from shared/constants.json."""
    parts = [json.dumps(canon(row.get(k)), default=str) for k in TRACKED]
    return hashlib.sha256("|".join(parts).encode()).hexdigest()


def diff(old: dict, new: dict) -> dict | None:
    """event_changes payload for the tracked fields that differ, or None."""
    # a value appearing for the first time (unknown -> known) is new information, not a change
    fields = [k for k in TRACKED if old.get(k) is not None and not same(old.get(k), new.get(k))]
    if not fields:
        return None
    return {"changed_fields": fields,
            "old_values": {k: old.get(k) for k in fields},
            "new_values": {k: new.get(k) for k in fields}}
