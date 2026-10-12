from datetime import datetime, timezone

from collector import community, trust

NOW = datetime(2026, 10, 12, 6, 0, tzinfo=timezone.utc)
SUB = {"id": "s1", "title": "HackSGT 2026", "registration_url": "https://forms.gle/abc", "organizer": "SGT University",
       "mode": "offline", "city": "gurgaon", "registration_deadline": "2026-10-20T18:29:00+00:00",
       "start_date": "2026-10-25T03:30:00+00:00", "end_date": None, "fee_amount": 0,
       "prize_text": "₹50,000 in prizes", "eligibility_text": "BTech, BCA", "themes": ["ai_ml"]}
OK = type("R", (), {"raise_for_status": lambda s: None})()


def test_an_approved_submission_becomes_a_trusted_event():
    e = community.to_event(SUB)
    assert (e.source, e.source_event_id, e.city, e.mode) == ("community", "s1", "Gurugram", "offline")
    assert e.prize_amount_inr == 50000 and e.fee_amount == 0 and e.is_paid is False
    assert e.themes == ["ai_ml"] and e.source_verified
    row = {**e.to_row(), "status": "open"}
    assert trust.label(row, [], {"community"}, NOW) == "trusted_source"


def test_no_themes_given_are_worked_out_from_the_title():
    assert community.to_event({**SUB, "title": "GenAI Buildathon", "themes": []}).themes == ["ai_ml"]


class FakeDb:
    def __init__(self, subs, reps, events=()):
        self.subs, self.reps, self.events, self.patched = subs, reps, list(events), []
        self.http = self

    def select_all(self, table, **p):
        if table == "submissions":
            if p.get("status") == "eq.approved":
                return [s for s in self.subs if s["status"] == "approved" and s["registration_deadline"] > p["registration_deadline"][3:]]
            return [s for s in self.subs if s["status"] == "pending" and not s.get("notified")]
        if table == "reports":
            return [r for r in self.reps if not r.get("notified")]
        return self.events

    def patch(self, path, params, json):
        self.patched.append((path, params["id"]))
        return OK


def test_only_approved_and_still_open_submissions_are_published():
    subs = [{**SUB, "status": "approved"}, {**SUB, "id": "s2", "status": "pending"},
            {**SUB, "id": "s3", "status": "approved", "registration_deadline": "2026-10-01T00:00:00+00:00"}]
    assert [e.source_event_id for e in community.events(FakeDb(subs, []), NOW)] == ["s1"]


def test_admin_hears_about_new_submissions_and_reports_once(monkeypatch):
    sent = []
    monkeypatch.setattr(community, "send", lambda text: sent.append(text) or True)
    db = FakeDb([{**SUB, "status": "pending"}], [{"id": 7, "reason": "fake", "note": "asks Rs 999", "event_id": "e1"}],
                events=[{"id": "e1", "title": "Shady Hack"}])
    assert community.admin_queue(db) == 2
    assert "1 hackathon submission to review" in sent[0] and "HackSGT 2026" in sent[0]
    assert "Shady Hack" in sent[0] and "fake / scam: asks Rs 999" in sent[0]
    assert db.patched == [("/submissions", 'in.("s1")'), ("/reports", "in.(7)")]
    assert community.admin_queue(FakeDb([], [])) == 0


def test_nothing_is_marked_when_telegram_did_not_take_it(monkeypatch):
    monkeypatch.setattr(community, "send", lambda text: False)
    db = FakeDb([{**SUB, "status": "pending"}], [])
    assert community.admin_queue(db) == 0 and db.patched == []   # tried again next run, review never skipped


def test_a_quote_in_a_link_cannot_break_out_of_href(monkeypatch):
    sent = []
    monkeypatch.setattr(community, "send", lambda text: sent.append(text) or True)
    community.admin_queue(FakeDb([{**SUB, "status": "pending", "registration_url": 'https://a.io/x"><b>y'}], []))
    assert 'href="https://a.io/x&quot;&gt;&lt;b&gt;y"' in sent[0]
