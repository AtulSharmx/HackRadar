"""Daily report v1 (plan 7.2): built from what the database records, sent once from the 9 o'clock IST run."""
import re
from datetime import datetime, timedelta, timezone

from collector import daily

NOW = datetime(2026, 11, 25, 3, 47, tzinfo=timezone.utc)   # 09:17 IST, the hourly run's 9 o'clock slot
LATER = (NOW + timedelta(minutes=2)).isoformat()            # written by this run itself: tomorrow's report counts it


def ago(hours):
    return (NOW - timedelta(hours=hours)).isoformat()


def _keep(value, cond):
    op, arg = cond.split(".", 1)
    if op == "eq":
        return str(value) == arg
    if op == "gte":
        return datetime.fromisoformat(value) >= datetime.fromisoformat(arg)
    assert op == "not" and arg.startswith("like.") and arg.endswith("*")
    return not value.startswith(arg[5:-1])


class FakeDb:
    """Just enough PostgREST: eq / gte / not.like filters on in-memory tables. select is ignored, so every row
    carries the personal fields a careless report could leak."""

    def __init__(self, **tables):
        self.tables = tables

    def select_all(self, table, select, **filters):
        return [r for r in self.tables.get(table, []) if all(_keep(r.get(k), v) for k, v in filters.items())]

    def post(self, table, rows):
        self.tables.setdefault(table, []).extend(rows)


def runs(source, n, found=5, errors=0):
    """n hourly runs of one source in the 24 h before NOW; the newest `errors` of them failed."""
    return [{"source": source, "run_at": ago(i + 0.5), "events_found": 0 if i < errors else found,
             "error_text": "HTTP 500" if i < errors else None} for i in range(n)]


def ev(status, sources, seen=72, updated=72):
    return {"status": status, "sources": sources, "first_seen_at": ago(seen), "updated_at": ago(updated),
            "title": "Rahul Sharma Private Hack", "organizer": "rahul@example.com"}


PERSON = {"user_id": "5f0c-user", "name": "Rahul Sharma", "email": "rahul@example.com", "phone": "+91 9876543210"}


def busy_day():
    return FakeDb(
        source_runs=runs("unstop", 24) + runs("devfolio", 24, errors=1) + runs("ethglobal", 4)
        + runs("hackerearth", 24, found=0)                                                       # small list: 0 is normal
        + [{"source": "unstop", "run_at": ago(25), "events_found": 0, "error_text": "HTTP 500"},   # before the window
           {"source": "unstop", "run_at": LATER, "events_found": 0, "error_text": "HTTP 500"},     # this run's own row
           {"source": "health:unstop", "run_at": ago(3)}],                                         # an alert, not a run
        events=[ev("open", ["unstop"], seen=2)] * 2 + [ev("open", ["unstop"])] * 3 + [ev("open", ["devfolio"])] * 2
        + [ev("open", ["devfolio", "unstop"])] + [ev("open", ["hack2skill"])] * 2
        + [ev("closed", ["unstop"], updated=5), ev("closed", ["unstop"], updated=30), ev("stale", ["devfolio"], updated=1),
           ev("stale", ["devfolio"], updated=-0.1)],                                               # staled by this run
        push_tickets=[{"sent_at": t, "kind": "new_match", "token": "ExponentPushToken[rahul]", **PERSON}
                      for t in (ago(1), ago(20), ago(23), ago(26), LATER)],
        devices=[{"alerts_enabled": on, "city": "Gurugram", "prefs": {"name": "Rahul"}, **PERSON}
                 for on in (True, True, False, False)],
        submissions=[{"status": s, "title": "Rahul's College Fest", "organizer": "Rahul Sharma", **PERSON}
                     for s in ("pending", "pending", "approved", "rejected")],
        reports=[{"created_at": t, "note": "call me on 9876543210", **PERSON} for t in (ago(3), ago(40))],
    )


def test_the_report_has_the_right_numbers_and_wording():
    assert daily.build(busy_day(), NOW, excluded=7) == (
        "📊 <b>HackRadar: daily report</b> (25 Nov)\n\n"
        "Runs (pichhle 24 ghante): 24, source runs 75 ok, 1 error\n"
        "Open hackathons: 10\n"
        "• unstop: 6 (60%)\n"
        "• devfolio: 3 (30%)\n"
        "• hack2skill: 2 (20%)\n"
        "Pichhle 24 ghante mein: 2 naye, 1 closed, 1 stale\n"
        "Not-hackathons is run mein rok diye: 7\n"
        "Push bheje (24 ghante): 3\n"
        "Devices: 4, alerts on: 2\n"
        "Queue: 2 submissions review ke liye, 1 report (24 ghante)\n\n"
        "⚠️ Dekhna hai:\n"
        "• devfolio: 24 mein se 1 runs mein error")


def test_a_good_day_ends_with_sab_theek():
    db = busy_day()
    db.tables["source_runs"] = runs("unstop", 24) + runs("hackerearth", 24, found=0)
    assert daily.build(db, NOW, excluded=0).endswith("\n\n✅ Sab theek")


def test_a_source_with_no_hackathons_all_day_is_an_issue_unless_its_list_is_small():
    db = busy_day()
    db.tables["source_runs"] = runs("unstop", 24) + runs("hack2skill", 24, found=0) + runs("hackerearth", 24, found=0)
    msg = daily.build(db, NOW, excluded=0)
    assert msg.endswith("⚠️ Dekhna hai:\n• hack2skill: 24 runs mein ek bhi hackathon nahi")


def test_empty_tables_do_not_crash_the_report():
    msg = daily.build(FakeDb(), NOW, excluded=0)
    assert "Runs (pichhle 24 ghante): 0, source runs 0 ok, 0 error\nOpen hackathons: 0\nPichhle 24 ghante mein: 0 naye" in msg
    assert "Devices: 0, alerts on: 0" in msg and msg.endswith("⚠️ Dekhna hai:\n• Ek bhi open hackathon nahi")


def test_the_report_carries_no_personal_data():
    msg = daily.build(busy_day(), NOW, excluded=7)
    for value in ("Rahul", "rahul@", "example.com", "9876543210", "5f0c", "Gurugram", "ExponentPushToken", "College"):
        assert value not in msg
    assert not re.search(r"@|\+91|\d{10}", msg)


def test_sent_only_from_the_9_oclock_ist_hour_and_only_once_a_day(monkeypatch):
    sent, delivered = [], [True]
    monkeypatch.setattr(daily, "send", lambda text: sent.append(text) or delivered[0])
    db = busy_day()
    ist = lambda h, m, day=25: datetime(2026, 11, day, h, m, tzinfo=daily.IST)

    assert not daily.send_if_due(db, ist(8, 59), 0)            # 8 am IST run
    assert not daily.send_if_due(db, ist(10, 0), 0)            # 10 am IST run
    assert not daily.send_if_due(db, ist(0, 17, 26), 0) and sent == []
    delivered[0] = False                                        # Telegram didn't take it: nothing remembered
    assert not daily.send_if_due(db, ist(9, 17), 0) and len(sent) == 1
    delivered[0] = True
    assert daily.send_if_due(db, ist(9, 40), 0)                 # so a later run in the hour still sends it
    assert not daily.send_if_due(db, ist(9, 55), 0)             # a run started by hand: no second report
    assert daily.send_if_due(db, ist(9, 17, 26), 0)             # next morning
    assert len(sent) == 3 and all(s.startswith("📊 <b>HackRadar: daily report</b>") for s in sent)
    assert [r["source"] for r in db.tables["source_runs"] if r["source"] == "health:daily"] == ["health:daily"] * 2
