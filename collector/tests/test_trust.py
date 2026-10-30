from datetime import datetime, timezone

from collector import trust

NOW = datetime(2026, 9, 29, tzinfo=timezone.utc)
GOOD = {"title": "HackX", "organizer": "IIT Delhi", "registration_url": "https://unstop.com/hackathons/x",
        "event_url": "https://unstop.com/hackathons/x", "registration_deadline": "2026-10-10T18:29:00+00:00",
        "mode": "offline", "city": "Delhi", "fee_amount": 0, "prize_amount_inr": 50000, "prize_text": "₹50,000",
        "status": "open"}


def codes(row, by_source=None):
    return [f["code"] for f in trust.red_flags(row, by_source or {"unstop": row})]


# ---------- red flags ----------

def test_high_fee_without_prize():
    row = {**GOOD, "fee_amount": 800, "prize_amount_inr": None, "prize_text": None}
    flags = trust.red_flags(row, {"unstop": row})
    assert flags == [{"code": "high_fee", "text": "Fee is ₹800 per team and no prize is listed"}]
    assert codes({**GOOD, "fee_amount": 800}) == []          # a prize makes the fee fair
    assert codes({**GOOD, "fee_amount": 500, "prize_amount_inr": None, "prize_text": None}) == []   # at the limit


def test_no_organizer():
    assert codes({**GOOD, "organizer": "  "}) == ["no_organizer"]


def test_date_conflict_between_sources():
    dp = {**GOOD, "registration_deadline": "2026-10-12T18:29:00+00:00"}
    us = {**GOOD, "registration_deadline": "2026-10-14T18:29:00+00:00"}
    flags = trust.red_flags(GOOD, {"devpost": dp, "unstop": us})
    assert flags[0]["code"] == "date_conflict"
    assert flags[0]["text"] == "Devpost says the deadline is 12 Oct, Unstop says 14 Oct"
    same_day = {**us, "registration_deadline": "2026-10-13T06:00:00+00:00"}
    assert codes(GOOD, {"devpost": dp, "unstop": same_day}) == []


def test_domain_mismatch():
    row = {**GOOD, "event_url": "https://hackx.in", "registration_url": "https://random-payments.xyz/pay"}
    assert codes(row) == ["domain_mismatch"]
    assert codes({**row, "registration_url": "https://forms.gle/abc"}) == []          # known form host
    assert codes({**row, "registration_url": "https://register.hackx.in/"}) == []     # own subdomain


def test_social_only():
    row = {**GOOD, "registration_url": "https://www.instagram.com/p/xyz", "event_url": None}
    assert codes(row, {"manual": row}) == ["social_only"]
    assert codes(row, {"unstop": row}) == []   # a real listing exists


# ---------- labels, in TRD order ----------

def test_label_stale():
    assert trust.label({**GOOD, "status": "closed"}, [], {"unstop"}, NOW) == "stale"
    assert trust.label({**GOOD, "registration_deadline": "2026-09-01T00:00:00+00:00"}, [], {"unstop"}, NOW) == "stale"


def test_label_warning_beats_everything_but_stale():
    assert trust.label(GOOD, [{"code": "no_organizer"}], {"unstop"}, NOW) == "warning"


def test_label_check_details_when_key_facts_missing():
    for missing in ({"registration_deadline": None}, {"mode": None}, {"fee_amount": None}, {"city": None}):
        assert trust.label({**GOOD, **missing}, [], {"unstop"}, NOW) == "check_details", missing
    assert trust.label({**GOOD, "mode": "online", "city": None}, [], {"unstop"}, NOW) == "trusted_source"


def test_label_trusted_source():
    assert trust.label(GOOD, [], {"unstop"}, NOW) == "trusted_source"
    assert trust.label(GOOD, [], {"manual"}, NOW) == "check_details"   # not a known platform


def test_a_list_with_no_organizer_field_gets_check_details_not_a_warning():
    from datetime import datetime, timezone
    row = {"title": "PromptWars", "organizer": None, "registration_url": "https://hack2skill.com/event/x", "mode": "online",
           "fee_amount": 0, "registration_deadline": "2099-01-01T00:00:00+00:00", "status": "open"}
    now = datetime(2026, 10, 30, tzinfo=timezone.utc)
    assert not [f for f in trust.red_flags(row, {"hack2skill": row}) if f["code"] == "no_organizer"]
    assert trust.label(row, [], {"hack2skill"}, now) == "check_details"
    assert [f for f in trust.red_flags(row, {"unstop": row}) if f["code"] == "no_organizer"]   # Unstop has the field: a gap there means something


def test_a_source_whose_deadline_is_only_the_end_date_is_no_date_conflict():
    from datetime import datetime, timedelta, timezone
    now = datetime.now(timezone.utc)
    base = {"title": "Homingo", "organizer": "X", "registration_url": "https://x.io", "mode": "online", "fee_amount": 0}
    a = {**base, "registration_deadline": (now + timedelta(days=15)).isoformat()}
    b = {**base, "registration_deadline": (now + timedelta(days=50)).isoformat()}
    assert not [f for f in trust.red_flags(a, {"unstop": a, "devevents": b}) if f["code"] == "date_conflict"]
    assert [f for f in trust.red_flags(a, {"unstop": a, "devfolio": b}) if f["code"] == "date_conflict"]
