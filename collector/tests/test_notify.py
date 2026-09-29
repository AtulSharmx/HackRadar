from datetime import datetime, timezone

from collector import notify

NOW = datetime(2026, 9, 29, 6, 30, tzinfo=timezone.utc)
DEV = {"id": "d1", "lat_rounded": 28.46, "lng_rounded": 77.03, "alerts_enabled": True, "expo_push_token": None,
       "prefs": {"themes": ["ai_ml", "cybersecurity"], "modes": ["online", "offline", "hybrid"],
                 "fee_max": 500, "max_km": 50, "hide_warnings": True}}
CTF = {"id": "e1", "title": "ReConCTF'26", "mode": "online", "themes": ["cybersecurity"], "fee_amount": 0,
       "prize_text": "₹50,000 in prizes", "organizer": "IIT Delhi", "status": "open", "trust_label": "trusted_source",
       "registration_deadline": "2026-10-04T18:29:00+00:00", "registration_url": "https://unstop.com/x?a=1&b=2"}
FAR = {**CTF, "id": "e2", "title": "Mumbai AI Meetup", "mode": "offline", "themes": ["ai_ml"],
       "city": "Mumbai", "lat": 19.05, "lng": 72.87}


class FakeDb:
    def __init__(self, events, changes=(), saved=()):
        self.events, self.changes, self.saved, self.patched = events, list(changes), list(saved), []
        self.http = self

    def select_all(self, table, **p):
        if table == "devices":
            return [DEV]
        if table == "events":
            ids = p["id"][4:-1].split(",")
            return [e for e in self.events if e["id"] in ids]
        if table == "event_changes":
            return [c for c in self.changes if not c.get("notified")]
        if table == "saved_events":
            return self.saved

    def patch(self, path, params, json):   # stands in for db.http.patch
        self.patched.append(params["id"])
        for c in self.changes:
            c["notified"] = True
        return type("R", (), {"raise_for_status": lambda s: None})()


def capture(monkeypatch):
    sent = []
    monkeypatch.setattr(notify, "send", lambda text: sent.append(text) or True)
    return sent


def test_new_match_message_is_built_from_the_event(monkeypatch):
    sent = capture(monkeypatch)
    assert notify.new_matches(FakeDb([CTF, FAR]), ["e1", "e2"], NOW) == 1   # Mumbai is > 50 km
    msg = sent[0]
    assert msg.startswith("🆕 <b>1 new hackathon for you</b>")
    assert "<b>ReConCTF'26</b>" in msg and "Online · Free · ₹50,000 in prizes" in msg
    assert "Closes 4 Oct, 11:59 PM (5 days left)" in msg and "By IIT Delhi" in msg
    assert "Matches Cybersecurity" in msg
    assert 'href="https://unstop.com/x?a=1&amp;b=2"' in msg        # URL is HTML-escaped
    assert "Mumbai" not in msg


def test_nothing_new_sends_nothing(monkeypatch):
    sent = capture(monkeypatch)
    assert notify.new_matches(FakeDb([CTF]), [], NOW) == 0 and sent == []


def test_saved_deadline_change_alert_then_never_again(monkeypatch):
    sent = capture(monkeypatch)
    change = {"id": 15, "event_id": "e1", "changed_fields": ["registration_deadline"], "notified": False,
              "old_values": {"registration_deadline": "2026-10-20T18:29:00+00:00"},
              "new_values": {"registration_deadline": "2026-10-05T12:59:00+00:00"}}
    db = FakeDb([CTF], [change], [{"device_id": "d1", "event_id": "e1"}])
    assert notify.saved_changes(db) == 1
    assert "Deadline: 20 Oct, 11:59 PM → 5 Oct, 6:29 PM" in sent[0]
    assert notify.saved_changes(db) == 0 and len(sent) == 1           # marked notified, no repeat


def test_change_to_unsaved_event_is_marked_handled_silently(monkeypatch):
    sent = capture(monkeypatch)
    change = {"id": 16, "event_id": "e1", "changed_fields": ["registration_deadline"], "notified": False,
              "old_values": {}, "new_values": {}}
    db = FakeDb([CTF], [change], saved=[])
    assert notify.saved_changes(db) == 0 and sent == [] and db.patched == ["in.(16)"]
