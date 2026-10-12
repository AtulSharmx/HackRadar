"""Community supply (launch audit, 10 Oct 2026): hackathons people submit in the app, and reports of wrong info.

- admin_queue(): new reports and new pending submissions go to the admin's Telegram, once each.
- events(): approved submissions become events of source "community" and go through the same sync as
  every platform (dedupe, trust label, geocoding, alerts). Approve or reject in the Supabase table editor
  (submissions.status). A submission stops being published once its deadline passes.
"""
from datetime import datetime, timezone

from .models import Event
from .normalize import classify_themes, clean_city, parse_money
from .telegram import esc, esc_attr, send

name = "community"
EDITOR = "https://supabase.com/dashboard/project/vbsgcjfrlmouzaocyfts/editor"
REASONS = {"wrong_dates": "wrong dates", "wrong_place": "wrong venue/mode", "closed": "already closed",
           "fake": "fake / scam", "duplicate": "duplicate", "other": "other"}


def _dt(v):
    return datetime.fromisoformat(v) if v else None


def to_event(s: dict) -> Event:
    prize, approx = parse_money(s.get("prize_text"))
    fee = s.get("fee_amount")
    city = clean_city(s.get("city"))
    return Event(
        source=name,
        source_event_id=s["id"],
        source_url=s["registration_url"],
        title=s["title"],
        registration_url=s["registration_url"],
        event_url=s["registration_url"],
        organizer=s.get("organizer"),
        mode=s["mode"],
        city=city,
        in_india=True,
        is_open=True,
        registration_deadline=_dt(s["registration_deadline"]),
        start_date=_dt(s.get("start_date")),
        end_date=_dt(s.get("end_date")),
        themes=[t for t in s.get("themes") or [] if t] or classify_themes(s["title"], []),
        fee_amount=fee,
        is_paid=(fee > 0) if fee is not None else None,
        prize_text=s.get("prize_text"),
        prize_amount_inr=prize,
        prize_approximate=approx,
        eligibility_text=s.get("eligibility_text"),
        source_verified=True,   # the admin checked it before approving
    )


def events(db, now: datetime | None = None) -> list[Event]:
    now = now or datetime.now(timezone.utc)
    rows = db.select_all("submissions", select="*", status="eq.approved",
                         registration_deadline=f"gt.{now.isoformat()}")
    return [to_event(r) for r in rows]


LIMIT = 3900   # Telegram allows 4096 characters per message


def _mark(db, table, ids):
    if ids:
        quoted = ",".join(f'"{i}"' if table == "submissions" else str(i) for i in ids)
        db.http.patch(f"/{table}", params={"id": f"in.({quoted})"}, json={"notified": True}).raise_for_status()


def admin_queue(db) -> int:
    """What needs a look goes to the admin's Telegram, marked only once delivered. Items are never cut:
    they are packed whole into as many messages as needed (each item is short, every field length-capped
    in the database and escaped), so no message can carry broken HTML that Telegram would refuse forever."""
    subs = db.select_all("submissions", select="id,title,organizer,mode,city,registration_url,registration_deadline",
                         status="eq.pending", notified="is.false", order="created_at")
    reps = db.select_all("reports", select="id,reason,note,event_id", notified="is.false", order="created_at")
    if not subs and not reps:
        return 0
    titles = {}
    if reps:
        ids = ",".join(sorted({r["event_id"] for r in reps}))
        titles = {e["id"]: e["title"] for e in db.select_all("events", select="id,title", id=f"in.({ids})")}
    items = []   # (table, id, html line)
    for s in subs:
        where = "Online" if s["mode"] == "online" else s.get("city") or s["mode"]
        items.append(("submissions", s["id"],
                      f'• {esc(s["title"])} ({esc(s["organizer"])}, {esc(where)}, closes {esc(s["registration_deadline"][:10])})\n'
                      f'  <a href="{esc_attr(s["registration_url"])}">link</a>'))
    for r in reps:
        note = f": {esc(r['note'])}" if r.get("note") else ""
        items.append(("reports", r["id"],
                      f"• Report: {esc(titles.get(r['event_id'], 'removed event'))} — {esc(REASONS.get(r['reason'], r['reason']))}{note}"))
    head = (f"<b>HackRadar: {len(subs)} submission(s) to review, {len(reps)} report(s)</b>\n"
            f'Approve a submission: set status to approved in <a href="{EDITOR}">submissions</a>.')
    done = 0
    while items:
        msg, batch = head, []
        while items and len(msg) + len(items[0][2]) + 1 <= LIMIT:
            msg += "\n" + items[0][2]
            batch.append(items.pop(0))
        if not batch:   # one item longer than a message (the database's length caps prevent it): say so, never cut HTML
            batch.append(items.pop(0))
            msg = head + f"\n• One {batch[0][0][:-1]} is too long to show here; open the table."
        if not send(msg):
            break                  # not delivered: the rest stay unmarked and are tried again next run
        for table in ("submissions", "reports"):
            _mark(db, table, [i for t, i, _ in batch if t == table])
        done += len(batch)
    return done
