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
    """to_row keys must be real events columns (created in 0001, added by later migrations)."""
    import re
    migrations = Path(__file__).parents[2] / "supabase/migrations"
    schema = (migrations / "0001_init.sql").read_text()
    table = schema.split("create table events (")[1].split(");")[0]
    cols = {line.split()[0] for line in table.strip().splitlines() if line.strip()}
    for f in sorted(migrations.glob("*.sql")):
        cols |= set(re.findall(r"alter table (?:public\.)?events add column (?:if not exists )?(\w+)", f.read_text()))
    row = unstop.parse(load("unstop_page1.json")["data"]["data"][0]).to_row()
    assert set(row) <= cols


# ---------- A1: Unstop details ----------

def test_unstop_rounds_from_real_detail():
    comp = load("unstop_detail_1762222.json")["data"]["competition"]
    rounds = unstop.parse_rounds(comp)
    assert [r["title"] for r in rounds] == ["Virtual Coding Round", "Offline Final Round"]   # registration window left out
    assert rounds[1]["start"] == "2026-10-09T04:00:00+00:00"   # 9 Oct, 9:30 am IST
    # Unstop's top-level start_date is when registration opens (27 Sep), never the event start
    assert comp["start_date"].startswith("2026-09-27") and rounds[0]["start"].startswith("2026-09-27")


class FakeClient:
    def __init__(self, detail):
        self.detail, self.calls = detail, []

    def get_json(self, url, params=None):
        self.calls.append(url)
        return self.detail


def test_enrich_only_new_or_changed_and_respects_the_limit():
    detail = load("unstop_detail_1762222.json")
    events = [unstop.parse(r) for r in load("unstop_page1.json")["data"]["data"][:5]]
    known = {events[0].source_event_id: events[0].listing_updated_at}   # this one's details are current
    client = FakeClient(detail)
    counts = unstop.enrich(client, events, known, limit=2)
    assert counts == {"details_fetched": 2, "details_waiting": 2}
    assert len(client.calls) == 2 and client.calls[0].endswith(f"/{events[1].source_event_id}")
    assert events[0].detail_updated_at == events[0].listing_updated_at and events[0].rounds == []   # untouched
    assert events[1].rounds and events[1].start_date is not None
    assert events[3].detail_updated_at is None   # over the limit: fetched on a later run


def test_enrich_drops_rounds_dated_after_the_event_ends():
    # real case (29 Sep): an organizer's "MUST READ: Guidelines" notice was a round dated 2027
    detail = {"data": {"competition": {"rounds": [{"round_order": 1, "details": [
        {"title": "Idea Round", "start_date": "2026-10-10T10:00:00+05:30", "end_date": "2026-10-12T10:00:00+05:30"},
        {"title": "MUST READ: Guidelines", "start_date": "2027-03-10T22:08:52+05:30", "end_date": "2027-03-26T10:08:52+05:30"}]}]}}}
    e = unstop.parse(load("unstop_page1.json")["data"]["data"][0])
    e.end_date = datetime(2026, 10, 30, 18, 29, tzinfo=timezone.utc)
    unstop.enrich(FakeClient(detail), [e], {}, limit=5)
    assert [r["title"] for r in e.rounds] == ["Idea Round"]
    assert e.start_date == datetime(2026, 10, 10, 4, 30, tzinfo=timezone.utc)


# ---------- A4: Devfolio ----------

def test_devfolio_fixture():
    from collector.adapters import devfolio
    raws = [h["_source"] for h in load("devfolio_search.json")["hits"]["hits"]]
    events = {e.title: e for e in (devfolio.parse(r) for r in raws)}
    kol = events["HackInverse 1.0"]
    assert kol.mode == "offline" and kol.city == "Kolkata" and kol.in_india and kol.source_verified
    assert kol.registration_url.startswith("https://") and kol.organizer is None   # never invented
    assert kol.registration_deadline is not None and kol.start_date is not None
    assert all(e.themes for e in events.values())
    abroad = [e for e in events.values() if e.mode == "offline" and not e.in_india]
    assert abroad and not any(devfolio.is_relevant(e) for e in abroad)   # the German one stays out


def test_verified_listing_without_organizer_is_not_a_warning():
    from collector import trust
    row = {"organizer": None, "source_verified": True, "registration_url": "https://x.devfolio.co/",
           "registration_deadline": "2026-10-20T18:29:00+00:00", "mode": "online", "fee_amount": 0, "status": "open"}
    assert "no_organizer" not in [f["code"] for f in trust.red_flags(row, {"devfolio": row})]
    unverified = {**row, "source_verified": False}
    assert "no_organizer" in [f["code"] for f in trust.red_flags(unverified, {"devfolio": unverified})]
