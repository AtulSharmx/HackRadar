"""Alerts: new matching events + changes to saved events.

Push (B3, docs/superpowers/specs/2026-10-01-b3-push-design.md): devices with alerts on and a token in
push_tokens. New matches go out grouped, never in the device's quiet hours and never within 4 h of the
last one (they wait in pending_digest), so the 6-hourly run gives at most 2 a day.
Telegram: only the admin's own row marked prefs.telegram = true (B5 removes these match alerts).
Every line is built from the stored event, never from fixed placeholder text.
"""
from datetime import datetime, timedelta, timezone

from . import match, push
from .normalize import IST
from .telegram import esc, esc_attr, send

CHANGE_PUSH_FIELDS = {"registration_deadline", "venue_address", "city"}   # TRD: other changes don't alert
LIMIT = 3900   # Telegram max is 4096 chars per message
NEW_CHANNEL, CHANGE_CHANNEL = "new_hackathons", "deadlines"   # Android channels the app creates
GAP = timedelta(hours=4)   # at most one new-match push per device in this window
DEFAULT_QUIET = (23 * 60, 8 * 60)   # IST minutes, same defaults as devices.quiet_start_min / quiet_end_min


def _when(v) -> str:
    d = datetime.fromisoformat(v).astimezone(IST)
    return f"{d.day} {d:%b}, {d.hour % 12 or 12}:{d:%M %p}"   # "5 Oct, 6:29 PM", no zero padding


def _fee(e) -> str:
    fee = e.get("fee_amount")
    if fee is None:
        return "Paid, fee amount not listed" if e.get("is_paid") else "Fee not listed"
    return "Free" if fee == 0 else f"Fee ₹{fee:,}"


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
    lines.append(f'<a href="{esc_attr(e["registration_url"])}">Open and register</a>')
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
    """Only devices explicitly marked for Telegram. App installs create their own device rows
    (no push token yet, empty prefs); without this marker they would get every new event."""
    return db.select_all("devices", select="*", alerts_enabled="is.true", expo_push_token="is.null",
                         **{"prefs->>telegram": "eq.true"})


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


def in_quiet(now: datetime, dev: dict) -> bool:
    t = now.astimezone(IST)
    m = t.hour * 60 + t.minute
    s = dev.get("quiet_start_min", DEFAULT_QUIET[0])
    e = dev.get("quiet_end_min", DEFAULT_QUIET[1])
    if s == e:
        return False
    return s <= m or m < e if s > e else s <= m < e   # s > e: the window crosses midnight


def _day(v) -> str:
    d = datetime.fromisoformat(v).astimezone(IST)
    return f"{d:%a} {d.day} {d:%b}"   # "Fri 3 Oct"


def _short(text: str, n: int = 60) -> str:
    return text if len(text) <= n else text[:n - 1].rstrip() + "…"


def match_message(events: list[dict], dev: dict) -> dict:
    """One grouped push for a device's new matches (already sorted best first)."""
    if len(events) == 1:
        e = events[0]
        closes = f"Closes {_day(e['registration_deadline'])}" if e.get("registration_deadline") else "Deadline not listed"
        return {"title": f"New hackathon for you: {_short(e['title'])}",
                "body": " · ".join((closes, _where(e, dev), _fee(e))),
                "data": {"kind": "new_match", "ids": [e["id"]]}, "channelId": NEW_CHANNEL}
    more = len(events) - 3
    return {"title": f"{len(events)} new hackathons match",
            "body": ", ".join(_short(e["title"], 40) for e in events[:3]) + (f" and {more} more" if more > 0 else ""),
            "data": {"kind": "new_match", "ids": [e["id"] for e in events[:30]]},   # 30 ids stay far under 4 KB
            "channelId": NEW_CHANNEL}


def change_message(items: list[tuple[dict, dict]]) -> dict:
    """items: (event, change) for one device's saved events that changed in this run."""
    if len(items) > 1:
        return {"title": f"{len(items)} saved hackathons changed",
                "body": ", ".join(_short(e["title"], 40) for e, _ in items[:3]),
                "data": {"kind": "change", "saved": True}, "channelId": CHANGE_CHANNEL, "priority": "high"}
    e, c = items[0]
    fields = CHANGE_PUSH_FIELDS & set(c["changed_fields"])
    f = next(x for x in ("registration_deadline", "venue_address", "city") if x in fields)
    old, new = c["old_values"].get(f), c["new_values"].get(f)
    if f == "registration_deadline":
        show = _when if old and new and _day(old) == _day(new) else _day   # same day: the time is what moved
        title = f"Deadline changed: {_short(e['title'])}"
        body = (f"Now closes {show(new)}" if new else "The deadline is no longer listed") + (f" (was {show(old)})." if old else ".")
    else:
        title = f"Venue changed: {_short(e['title'])}"
        body = f"Now at {new or 'a venue not listed yet'}" + (f" (was {old})." if old else ".")
    return {"title": title, "body": body, "data": {"kind": "change", "eventId": e["id"]},
            "channelId": CHANGE_CHANNEL, "priority": "high"}


def _events(db, ids) -> dict:
    ids, out = sorted(set(ids)), {}
    for i in range(0, len(ids), 100):   # keep the URL short
        out.update({e["id"]: e for e in db.select_all("events", select="*", id=f"in.({','.join(ids[i:i + 100])})")})
    return out


def push_devices(db) -> list[tuple[dict, list[str]]]:
    """(device, its tokens) for devices with alerts on and at least one phone registered. A device with
    no themes in its filter is skipped: an empty filter would match every event."""
    tokens: dict[str, list[str]] = {}
    for t in db.select_all("push_tokens", select="expo_push_token,user_id"):
        tokens.setdefault(t["user_id"], []).append(t["expo_push_token"])
    if not tokens:
        return []
    return [(d, tokens[d["id"]]) for d in db.select_all("devices", select="*", alerts_enabled="is.true")
            if d["id"] in tokens and match.filter_of(d).get("themes")]


def push_new_matches(db, new_ids: list[str], now: datetime | None = None) -> int:
    """One grouped push per device: this run's matches plus the ones held back earlier."""
    now = now or datetime.now(timezone.utc)
    devices = push_devices(db)
    if not devices:
        return 0
    held: dict[str, list[str]] = {}
    for p in db.select_all("pending_digest", select="device_id,event_id"):
        held.setdefault(p["device_id"], []).append(p["event_id"])
    events = _events(db, list(new_ids) + [i for ids in held.values() for i in ids])
    recent = {t["device_id"] for t in db.select_all("push_tickets", select="device_id", kind="eq.new_match",
                                                     sent_at=f"gte.{(now - GAP).isoformat()}")}
    outgoing, queue, flushed = [], [], []
    for dev, tokens in devices:
        hits = [events[i] for i in new_ids if i in events and match.matches(events[i], dev, now)]
        if in_quiet(now, dev) or dev["id"] in recent:
            queue += [{"device_id": dev["id"], "event_id": e["id"]} for e in hits]
            continue
        waiting = [events[i] for i in held.get(dev["id"], []) if i in events and match.matches(events[i], dev, now)]
        if dev["id"] in held:
            flushed.append(dev["id"])   # sent now, or closed / no longer matching: either way done
        both = list({e["id"]: e for e in waiting + hits}.values())
        if not both:
            continue
        both.sort(key=lambda e: (-match.score(e, dev, now)[0], e.get("registration_deadline") or "9999"))
        msg = match_message(both, dev)
        outgoing += [(dev["id"], "new_match", {**msg, "to": t}) for t in tokens]
    db.post("pending_digest", queue, on_conflict="device_id,event_id")
    for dev_id in flushed:
        db.http.delete("/pending_digest", params={"device_id": f"eq.{dev_id}"}).raise_for_status()
    return push.deliver(db, outgoing) if outgoing else 0


def _push_changes(db, pending: list[dict]) -> int:
    devices = push_devices(db)
    if not devices:
        return 0
    ids = {c["event_id"] for c in pending if CHANGE_PUSH_FIELDS & set(c["changed_fields"])}
    if not ids:
        return 0
    events = _events(db, ids)
    saved = db.select_all("saved_events", select="device_id,event_id", event_id=f"in.({','.join(sorted(ids))})")
    outgoing = []
    for dev, tokens in devices:
        mine = {s["event_id"] for s in saved if s["device_id"] == dev["id"]}
        latest = {}   # one line per event: its latest change in this batch
        for c in pending:
            if c["event_id"] in mine and c["event_id"] in events and CHANGE_PUSH_FIELDS & set(c["changed_fields"]):
                latest[c["event_id"]] = (events[c["event_id"]], c)
        if latest:
            msg = change_message(list(latest.values()))
            outgoing += [(dev["id"], "change", {**msg, "to": t}) for t in tokens]
    return push.deliver(db, outgoing) if outgoing else 0


def saved_changes(db, now: datetime | None = None) -> int:
    """Alert about deadline/venue changes on saved events, then mark every pending change as handled.
    Between 11 pm and 8 am IST nothing is sent and nothing is marked: the next run handles them.
    ponytail: one quiet window for every device; per-device quiet hours for changes come with B4."""
    now = now or datetime.now(timezone.utc)
    if in_quiet(now, {}):
        return 0
    pending = db.select_all("event_changes", select="*", notified="is.false", order="changed_at")
    if not pending:
        return 0
    devices = {d["id"]: d for d in telegram_devices(db)}
    sent = _push_changes(db, pending)
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
                lines.append(f'<a href="{esc_attr(e["registration_url"])}">Check the event page</a>')
                blocks.append("\n".join(lines))
            if blocks:
                _send_chunked("📅 <b>A saved hackathon changed</b>", blocks)
                sent += len(blocks)
    r = db.http.patch("/event_changes", params={"id": f"in.({','.join(str(c['id']) for c in pending)})"},
                      json={"notified": True})
    r.raise_for_status()
    return sent
