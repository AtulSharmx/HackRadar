import json
from datetime import datetime, timezone
from pathlib import Path

from collector.adapters import devpost, hack2skill, unstop

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
    # rewards come from the detail API (enrich), never guessed from the list's winner-prize flag
    assert e.perks == []
    paid = next(x for x in events if x.title == "National Young Programmers Olympiad")
    assert paid.fee_amount == 499 and paid.prize_amount_inr == 1_000_000
    assert e.to_row()["is_paid"] is False and paid.to_row()["is_paid"] is True
    # "Newest" uses Unstop's publish time ("2026-09-28 22:35:36 GMT+0530" is India time)
    assert e.posted_at == datetime(2026, 9, 28, 17, 5, 36, tzinfo=timezone.utc)


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

def test_unstop_detail_perks():
    comp = load("unstop_detail_1762222.json")["data"]["competition"]
    assert unstop._detail_perks(comp) == ["certificate", "goodies"]
    # participation_certificate is the real event-level flag; winner prizes must not override it
    assert unstop._detail_perks({"participation_certificate": 1, "prizes": [{"certificate": 0}]}) == ["certificate"]
    assert unstop._detail_perks({"participation_certificate": 0, "prizes": [{"certificate": 1, "others": "Winner certificate"}]}) == ["no_certificate"]
    assert unstop._detail_perks({"participation_certificate": 0, "details": "Participation certificate for everyone"}) == ["certificate"]
    assert unstop._detail_perks({"participation_certificate": 0, "overall_prizes": "₹50,000 in prizes"}) == ["no_certificate"]
    assert unstop._detail_perks({"participation_certificate": 0, "overall_prizes": "Goodies for winners"}) == ["no_certificate", "goodies"]
    assert unstop._detail_perks({}) == []


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
    assert kol.posted_at is not None and kol.posted_at < kol.registration_deadline   # applications opened
    assert kol.fee_amount is None and kol.to_row()["is_paid"] is None   # Devfolio lists no fee either way
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


def test_hack2skill_fixture():
    rows = load("hack2skill_list.json")["data"]
    events = {r.get("eventUrl") or r["link"]: hack2skill.parse(r) for r in rows}
    assert len(events) == 18
    # the "Builders' Pitch Fest" promo row links back to bitsom-pitchfest2026, which is already listed
    assert [r["title"] for r in rows if r.get("link") and hack2skill._link_slug(r) in
            {x["eventUrl"] for x in rows if x.get("eventUrl")}] == ["Builders' Pitch Fest 2026"]
    assert events["https://aibuildercup.com/"].source_url == "https://aibuildercup.com/"
    events = {e.title: e for k, e in events.items() if "hack2skill.com/event/" in e.source_url}
    e = events["Virtual: PromptWars"]
    assert e.mode == "online" and e.fee_amount == 0 and e.solo_allowed and e.team_max == 1
    assert e.registration_url == e.source_url and e.source_url.startswith("https://hack2skill.com/event/")
    assert e.organizer is None and e.city is None   # the list has neither; never invented
    assert events["ImpactX'26"].fee_amount is None      # PAID without an amount
    assert events["ImpactX'26"].to_row()["is_paid"] is True and e.to_row()["is_paid"] is False
    assert e.posted_at == datetime(2026, 4, 1, 8, 30, tzinfo=timezone.utc)   # registrationStart
    assert e.source_verified and not events["ImpactX'26"].source_verified   # FLAGSHIP vs COMMUNITY
    assert events["IBM Z Datathon 2026"].mode == "hybrid" and events["IBM Z Datathon 2026"].team_max is None
    # in person with no city: location unknown, but kept (Hack2Skill is India-first); the trust label flags it
    assert hack2skill.is_relevant(events["Build with AI: PromptWars"].__class__(
        **{**events["Build with AI: PromptWars"].__dict__, "registration_deadline": None}))


def test_hackerearth_keeps_only_hackathons():
    from dataclasses import replace

    from collector.adapters import hackerearth
    events = [hackerearth.parse(r) for r in load("hackerearth_upcoming.json")["response"]]
    assert len(events) == 3
    e = events[0]
    assert (e.title, e.source_event_id, e.mode) == ("Agentic Banking Hackathon", "agentic-banking-hackathon-2", "online")
    assert e.registration_deadline == e.end_date == datetime(2026, 11, 13, 18, 29, tzinfo=timezone.utc)
    assert e.start_date == datetime(2026, 10, 5, 14, 30, tzinfo=timezone.utc)
    assert e.organizer is None and e.fee_amount is None and e.prize_amount_inr is None   # not in the list, never guessed
    assert not any(x.source_verified for x in events)   # is_hackerearth is on every listing: not a trust signal
    later = datetime(2099, 1, 1, tzinfo=timezone.utc)   # the fixture's dates pass; the hackathon check must not
    kept = {x.title for x in events if hackerearth.is_relevant(replace(x, registration_deadline=later))}
    assert kept == {"Agentic Banking Hackathon", "GoDaddy Inclusive Innovation Hackathon 2026"}   # hiring challenge dropped


def test_goodies_are_whole_words_only():
    assert unstop._detail_perks({"participation_certificate": 1, "details": "real-world bottlenecks and merchant payments, see Swagger"}) == ["certificate"]
    assert unstop._detail_perks({"participation_certificate": 1, "details": "Swags and a water bottle"}) == ["certificate", "goodies"]


def test_hack2skill_keeps_in_person_events_with_no_city_unless_abroad():
    later = datetime(2099, 1, 1, tzinfo=timezone.utc)
    def event(title):
        return hack2skill.parse({"_id": "1", "title": title, "eventUrl": "x", "mode": "OFFLINE", "registrationEnd": later.isoformat()})
    assert hack2skill.is_relevant(event("Startup Buildathon India 2026"))
    assert not hack2skill.is_relevant(event("Build with AI - GCC Edition"))


KNOWAFEST_PAGE = """<script type="application/ld+json">{"@type":"BreadcrumbList"}</script>
<script type="application/ld+json">{"@type":"Event","name":"SDG Hackathon &amp; Expo","description":"Machine learning for good",
"startDate":"2099-11-04T09:00:00+05:30","endDate":"2099-12-02T17:00:00+05:30",
"eventAttendanceMode":"https://schema.org/OfflineEventAttendanceMode",
"location":{"@type":"Place","name":"SRM Campus","address":{"addressLocality":"Chennai","addressRegion":"Tamil Nadu","addressCountry":"India"}},
"organizer":{"name":"SRM Institute"},"offers":{"price":"399.00","priceCurrency":"INR","url":"https://forms.gle/abc"}}</script>
<p>Registration deadline / Important dates</p><p>05.11.2099</p><p>Registration Fees</p>"""


def test_knowafest_reads_the_event_page_and_a_day_first_deadline():
    from collector.adapters import knowafest
    raw = {"slug": "sdg-hackathon", "data": knowafest.event_data(KNOWAFEST_PAGE), "deadline": knowafest.deadline_from(KNOWAFEST_PAGE), "link": None}
    e = knowafest.parse(raw)
    assert (e.title, e.organizer, e.mode, e.city, e.fee_amount) == ("SDG Hackathon & Expo", "SRM Institute", "offline", "Chennai", 399)
    assert e.registration_url == "https://forms.gle/abc" and e.event_url.endswith("/event/sdg-hackathon")
    assert e.registration_deadline == datetime(2099, 11, 5, 18, 29, tzinfo=timezone.utc)   # 5 November, not 11 May
    assert knowafest.is_relevant(e) and "ai_ml" in e.themes
    feed = "<item><title>Med Fest</title><link>https://www.knowafest.com/event/med</link><category>Conferences</category></item>" \
           "<item><title>Code Fest</title><link>https://www.knowafest.com/event/code</link><category>Hackathons</category></item>"
    assert knowafest.slugs_from('href="https://www.knowafest.com/event/a"', feed) == ["a", "code"]


def test_ethglobal_keeps_only_india_and_online():
    from collector.adapters import ethglobal
    page = (r'{\"id\":527,\"name\":\"ETHGlobal Mumbai\",\"slug\":\"mumbai\",\"type\":\"hackathon\",\"medium\":\"physical\",'
            r'\"startTime\":\"2099-11-05T00:00:00.000Z\",\"endTime\":\"2099-11-07T00:00:00.000Z\",\"status\":\"future\",'
            r'\"signupDeadline\":\"2099-11-03T18:29:00.000Z\",\"city\":{\"id\":1,\"name\":\"Mumbai\",\"country\":{\"id\":105,\"name\":\"India\"}}},'
            r'{\"id\":528,\"name\":\"ETHGlobal Tokyo\",\"slug\":\"tokyo\",\"type\":\"hackathon\",\"medium\":\"physical\",'
            r'\"startTime\":\"2099-12-05T00:00:00.000Z\",\"endTime\":\"2099-12-07T00:00:00.000Z\",\"status\":\"future\",'
            r'\"signupDeadline\":null,\"city\":{\"id\":2,\"name\":\"Tokyo\",\"country\":{\"id\":9,\"name\":\"Japan\"}}},'
            r'{\"id\":529,\"name\":\"ETHOnline\",\"slug\":\"ethonline\",\"type\":\"hackathon\",\"medium\":\"virtual\",'
            r'\"startTime\":\"2099-12-05T00:00:00.000Z\",\"endTime\":\"2099-12-07T00:00:00.000Z\",\"status\":\"future\",\"signupDeadline\":null}')
    events = {e.title: e for e in map(ethglobal.parse, ethglobal.events_in(page))}
    mumbai = events["ETHGlobal Mumbai"]
    assert (mumbai.city, mumbai.mode, mumbai.organizer) == ("Mumbai", "offline", "ETHGlobal")
    assert mumbai.registration_deadline == datetime(2099, 11, 3, 18, 29, tzinfo=timezone.utc) and "blockchain" in mumbai.themes
    assert ethglobal.is_relevant(mumbai) and ethglobal.is_relevant(events["ETHOnline"]) and not ethglobal.is_relevant(events["ETHGlobal Tokyo"])


def test_hackster_contest_cards():
    from collector.adapters import hackster
    card = ('<a class="hckui__typography__link" href="/contests/infineon-boss-battle"><h4 class="x">Infineon Boss Battle</h4></a>'
            '<span>With </span><a class="hckui__typography__linkBlue" href="https://www.hackster.io/infineon">Infineon</a>'
            '<p class="y">Participation open until:</p><p class="z">Jan 04, 2099</p>')
    raws = hackster.contests_in(card + card)   # the page repeats each card for mobile
    assert len(raws) == 1
    e = hackster.parse(raws[0])
    assert (e.title, e.organizer, e.mode, e.themes) == ("Infineon Boss Battle", "Infineon", "online", ["iot_hardware"])
    assert e.registration_url == "https://www.hackster.io/contests/infineon-boss-battle" and hackster.is_relevant(e)
    assert e.registration_deadline == datetime(2099, 1, 4, 18, 29, tzinfo=timezone.utc)
