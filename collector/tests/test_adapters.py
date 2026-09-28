import json
from datetime import datetime, timezone
from pathlib import Path

from collector.adapters import devpost, unstop

FIX = Path(__file__).parent / "fixtures"


def load(name):
    return json.loads((FIX / name).read_text(encoding="utf-8"))


def test_devpost_period_formats():
    assert devpost.split_period("Jul 31 - Oct 01, 2026") == ("Jul 31, 2026", "Oct 01, 2026")
    assert devpost.split_period("Sep 18 - 29, 2026") == ("Sep 18, 2026", "Sep 29, 2026")
    assert devpost.split_period("Dec 15, 2026 - Jan 10, 2027") == ("Dec 15, 2026", "Jan 10, 2027")


def test_devpost_online_fixture():
    events = [devpost.parse(r) for r in load("devpost_page1.json")["hackathons"]]
    assert len(events) == 9
    e = events[0]
    assert e.title == "RevenueCat Shipaton 2026"
    assert e.mode == "online" and e.city is None
    assert e.registration_url.startswith("https://")
    assert e.registration_deadline == datetime(2026, 10, 1, 18, 29, tzinfo=timezone.utc)
    assert e.prize_approximate and e.prize_amount_inr == 740_000 * 88
    assert "mobile" in e.themes


def test_devpost_in_person_india_detection():
    events = {e.title: e for e in (devpost.parse(r) for r in load("devpost_inperson.json")["hackathons"])}
    blr = next(e for e in events.values() if e.city == "Bengaluru")
    assert blr.mode == "offline" and blr.in_india and blr.prize_amount_inr == 50_000 and not blr.prize_approximate
    sg = next(e for e in events.values() if "Singapore" in (e.venue_address or ""))
    assert not sg.in_india and not devpost.is_relevant(sg)


def test_unstop_fixture():
    raws = load("unstop_page1.json")["data"]["data"]
    events = [unstop.parse(r) for r in raws]
    assert len(events) == 15
    e = events[0]
    assert e.title == "ICC CodeClash 2026"
    assert e.organizer == "Chandigarh University uttar pradesh"
    assert e.mode == "online" and e.city == "Unnao" and e.in_india
    assert e.registration_deadline == datetime(2026, 10, 4, 14, 29, tzinfo=timezone.utc)
    assert e.team_min == 1 and e.solo_allowed and e.fee_amount == 0
    assert e.registration_url.startswith("https://unstop.com/")
    paid = next(x for x in events if x.title == "National Young Programmers Olympiad")
    assert paid.fee_amount == 499 and paid.prize_amount_inr == 1_000_000


def test_rows_fit_table():
    """to_row keys must be real events columns (schema in supabase/migrations/0001_init.sql)."""
    schema = (Path(__file__).parents[2] / "supabase/migrations/0001_init.sql").read_text()
    table = schema.split("create table events (")[1].split(");")[0]
    cols = {line.split()[0] for line in table.strip().splitlines() if line.strip()}
    row = unstop.parse(load("unstop_page1.json")["data"]["data"][0]).to_row()
    assert set(row) <= cols
