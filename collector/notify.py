"""Telegram alerts for the Telegram-only phase (Stage 4): new matching events + changes to saved events.

Goes to devices with alerts on and no Expo push token. Once the app registers a push token for a
device, that device gets push instead (step 34) and these Telegram match alerts stop (step 37).
Every line is built from the stored event, never from fixed placeholder text.
"""
from datetime import datetime, timezone

from . import match
from .normalize import IST
from .telegram import esc, send

CHANGE_PUSH_FIELDS = {"registration_deadline", "venue_address", "city"}   # TRD: other changes don't alert
LIMIT = 3900   # Telegram max is 4096 chars per message


def _when(v) -> str:
    d = datetime.fromisoformat(v).astimezone(IST)
    return f"{d.day} {d:%b}, {d.hour % 12 or 12}:{d:%M %p}"   # "5 Oct, 6:29 PM", no zero padding


def _fee(e) -> str:
    fee = e.get("fee_amount")
    return "Free" if fee == 0 else "Fee not listed" if fee is None else f"Fee ₹{fee:,}"


def _where(e, dev) -> str:
    if e.get("mode") == "online":
        return "Online"
    km = match.distance_km(e, dev)
    place = e.get("city") or "venue not listed"
    far = f", about {round(km)} km" + (" (approx.)" if e.get("location_approximate") else "") if km is not None else ""
    return ("Hybrid · " if e.get("mode") == "hybrid" else "") + place + far


def event_block(e: dict, dev: dict, now: datetime) -> str:
    left = match.days_left(e, now)
    closes = (f"Closes {_when(e['registration_deadline'])}"
              + (f" ({int(left)} days left)" if left and left >= 1 else " (today)" if left is not None else "")
              if e.get("registration_deadline") else "Deadline not listed")
    lines = [f"<b>{esc(e['title'])}</b>",
             esc(" · ".join(x for x in (_where(e, dev), _fee(e), e.get("prize_text")) if x)),
             esc(closes)]
    if e.get("organizer"):
        lines.append(esc(f"By {e['organizer']}"))
    _, parts = match.score(e, dev, now)
    why = match.reasons(e, dev, parts, now)
    if why:
        lines.append("<i>" + esc(" · ".join(why)) + "</i>")
    lines.append(f'<a href="{esc(e["registration_url"])}">Open and register</a>')
    return "\n".join(lines)


def _send_chunked(header: str, blocks: list[str]):
    msg = header
    for b in blocks:
        if len(msg) + len(b) + 2 > LIMIT:
            send(msg)
            msg = header.split("\n")[0] + " (contd.)"
        msg += "\n\n" + b
    send(msg)


def telegram_devices(db) -> list[dict]:
    return db.select_all("devices", select="*", alerts_enabled="is.true", expo_push_token="is.null")


def new_matches(db, new_ids: list[str], now: datetime | None = None) -> int:
    now = now or datetime.now(timezone.utc)
    devices = telegram_devices(db)
    if not new_ids or not devices:
        return 0
    events = []
    for i in range(0, len(new_ids), 100):   # keep the URL short
        events += db.select_all("events", select="*", id=f"in.({','.join(new_ids[i:i + 100])})")
    sent = 0
    for dev in devices:
        hits = sorted((e for e in events if match.matches(e, dev, now)),
                      key=lambda e: (-match.score(e, dev, now)[0], e.get("registration_deadline") or "9999"))
        if hits:
            n = len(hits)
            _send_chunked(f"🆕 <b>{n} new hackathon{'s' if n > 1 else ''} for you</b>",
                          [event_block(e, dev, now) for e in hits])
            sent += n
    return sent


def saved_changes(db) -> int:
    """Alert about deadline/venue changes on saved events, then mark every pending change as handled."""
    pending = db.select_all("event_changes", select="*", notified="is.false", order="changed_at")
    if not pending:
        return 0
    devices = {d["id"]: d for d in telegram_devices(db)}
    sent = 0
    if devices:
        ids = ",".join({c["event_id"] for c in pending})
        saved = db.select_all("saved_events", select="device_id,event_id", event_id=f"in.({ids})")
        events = {e["id"]: e for e in db.select_all("events", select="*", id=f"in.({ids})")}
        for dev_id, dev in devices.items():
            mine = {s["event_id"] for s in saved if s["device_id"] == dev_id}
            blocks = []
            for c in pending:
                fields = CHANGE_PUSH_FIELDS & set(c["changed_fields"])
                if c["event_id"] not in mine or not fields or c["event_id"] not in events:
                    continue
                e = events[c["event_id"]]
                lines = [f"<b>{esc(e['title'])}</b>"]
                for f in sorted(fields):
                    old, new = c["old_values"].get(f), c["new_values"].get(f)
                    if f == "registration_deadline":
                        lines.append(esc(f"Deadline: {_when(old) if old else 'not listed'} → "
                                         f"{_when(new) if new else 'not listed'}"))
                    else:
                        label = "Venue" if f == "venue_address" else "City"
                        lines.append(esc(f"{label}: {old or 'not listed'} → {new or 'not listed'}"))
                lines.append(f'<a href="{esc(e["registration_url"])}">Check the event page</a>')
                blocks.append("\n".join(lines))
            if blocks:
                _send_chunked("📅 <b>A saved hackathon changed</b>", blocks)
                sent += len(blocks)
    r = db.http.patch("/event_changes", params={"id": f"in.({','.join(str(c['id']) for c in pending)})"},
                      json={"notified": True})
    r.raise_for_status()
    return sent
