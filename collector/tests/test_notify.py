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


OK = type("R", (), {"raise_for_status": lambda s: None})()


class FakeDb:
    """Just enough PostgREST for notify/push. devices: the rows select_all("devices") returns."""

    def __init__(self, events, changes=(), saved=(), devices=(DEV,), tokens=(), pending=(), tickets=()):
        self.events, self.changes, self.saved, self.patched = events, list(changes), list(saved), []
        self.devices, self.tokens, self.pending, self.tickets = list(devices), list(tokens), list(pending), list(tickets)
        self.deleted = []
        self.http = self

    def select_all(self, table, **p):
        if table == "devices":
            return self.devices
        if table == "events":
            ids = p["id"][4:-1].split(",")
            return [e for e in self.events if e["id"] in ids]
        if table == "event_changes":
            return [c for c in self.changes if not c.get("notified")]
        if table == "saved_events":
            return self.saved
        if table == "push_tokens":
            return self.tokens
        if table == "pending_digest":
            return self.pending
        if table == "push_tickets":   # the 4 h guard asks for recent new_match tickets
            since = datetime.fromisoformat(p["sent_at"][4:])
            return [t for t in self.tickets if t["kind"] == "new_match" and datetime.fromisoformat(t["sent_at"]) >= since]

    def post(self, table, rows, on_conflict=None):
        if table == "pending_digest":
            self.pending += [r for r in rows if r not in self.pending]
        elif table == "push_tickets":
            self.tickets += [{**r, "sent_at": NOW.isoformat()} for r in rows]

    def delete(self, path, params):
        self.deleted.append((path, params))
        if path == "/pending_digest":
            self.pending = [r for r in self.pending if f"eq.{r['device_id']}" != params["device_id"]]
        return OK

    def patch(self, path, params, json):   # stands in for db.http.patch
        self.patched.append(params["id"])
        for c in self.changes:
            c["notified"] = True
        return OK


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
    assert notify.saved_changes(db, NOW) == 1
    assert "Deadline: 20 Oct, 11:59 PM → 5 Oct, 6:29 PM" in sent[0]
    assert notify.saved_changes(db, NOW) == 0 and len(sent) == 1           # marked notified, no repeat


def test_change_to_unsaved_event_is_marked_handled_silently(monkeypatch):
    sent = capture(monkeypatch)
    change = {"id": 16, "event_id": "e1", "changed_fields": ["registration_deadline"], "notified": False,
              "old_values": {}, "new_values": {}}
    db = FakeDb([CTF], [change], saved=[])
    assert notify.saved_changes(db, NOW) == 0 and sent == [] and db.patched == ["in.(16)"]


# ---- push (B3) ----
PUSH_DEV = {**DEV, "id": "p1", "quiet_start_min": 1380, "quiet_end_min": 480}
TOKEN = {"expo_push_token": "ExponentPushToken[abc]", "user_id": "p1"}
NIGHT = datetime(2026, 9, 29, 20, 0, tzinfo=timezone.utc)   # 1:30 am IST


def capture_push(monkeypatch):
    out = []
    monkeypatch.setattr(notify.push, "deliver", lambda db, outgoing: out.extend(outgoing) or len(outgoing))
    return out


def ev(i, title, **kw):
    return {**CTF, "id": i, "title": title, **kw}


def test_one_new_match_push_reads_like_a_card(monkeypatch):
    out = capture_push(monkeypatch)
    db = FakeDb([CTF, FAR], devices=[PUSH_DEV], tokens=[TOKEN])
    assert notify.push_new_matches(db, ["e1", "e2"], NOW) == 1                 # Mumbai is > 50 km
    dev_id, kind, msg = out[0]
    assert (dev_id, kind, msg["to"]) == ("p1", "new_match", "ExponentPushToken[abc]")
    assert msg["title"] == "New hackathon for you: ReConCTF'26"
    assert msg["body"] == "Closes Sun 4 Oct · Online · Free"
    assert msg["data"] == {"kind": "new_match", "ids": ["e1"]} and msg["channelId"] == "new_hackathons"


def test_many_matches_are_one_grouped_push_per_phone(monkeypatch):
    out = capture_push(monkeypatch)
    evs = [ev(f"m{i}", f"Hack {i}") for i in range(4)]
    phones = [TOKEN, {**TOKEN, "expo_push_token": "ExponentPushToken[second]"}]   # one account, two phones
    db = FakeDb(evs, devices=[PUSH_DEV], tokens=phones)
    assert notify.push_new_matches(db, [e["id"] for e in evs], NOW) == 2
    assert {m["to"] for _, _, m in out} == {"ExponentPushToken[abc]", "ExponentPushToken[second]"}
    msg = out[0][2]
    assert msg["title"] == "4 new hackathons match"
    assert msg["body"].endswith(" and 1 more") and msg["body"].count(",") == 2
    assert sorted(msg["data"]["ids"]) == ["m0", "m1", "m2", "m3"]


def test_night_matches_wait_and_go_with_the_next_daytime_push(monkeypatch):
    out = capture_push(monkeypatch)
    db = FakeDb([CTF], devices=[PUSH_DEV], tokens=[TOKEN])
    assert notify.push_new_matches(db, ["e1"], NIGHT) == 0 and out == []
    assert db.pending == [{"device_id": "p1", "event_id": "e1"}]
    assert notify.push_new_matches(db, [], NOW) == 1                           # nothing new, the held one goes
    assert out[0][2]["data"]["ids"] == ["e1"] and db.pending == []


def test_no_second_new_match_push_within_4_hours(monkeypatch):
    out = capture_push(monkeypatch)
    two_h_ago = {"ticket_id": "t0", "device_id": "p1", "kind": "new_match", "sent_at": "2026-09-29T04:30:00+00:00"}
    db = FakeDb([CTF], devices=[PUSH_DEV], tokens=[TOKEN], tickets=[two_h_ago])
    assert notify.push_new_matches(db, ["e1"], NOW) == 0 and out == []
    assert db.pending == [{"device_id": "p1", "event_id": "e1"}]


def test_a_device_that_never_finished_setup_gets_no_pushes(monkeypatch):
    out = capture_push(monkeypatch)
    blank = {**PUSH_DEV, "prefs": {}, "alert_filter": None}                      # an empty filter matches everything
    assert notify.push_new_matches(FakeDb([CTF], devices=[blank], tokens=[TOKEN]), ["e1"], NOW) == 0 and out == []


def test_saved_deadline_change_push(monkeypatch):
    out = capture_push(monkeypatch)
    capture(monkeypatch)   # the fake ignores the Telegram row filter; keep that message out of the way
    change = {"id": 21, "event_id": "e1", "changed_fields": ["registration_deadline", "prize_text"], "notified": False,
              "old_values": {"registration_deadline": "2026-10-20T18:29:00+00:00"},
              "new_values": {"registration_deadline": "2026-10-05T12:59:00+00:00"}}
    db = FakeDb([CTF], [change], [{"device_id": "p1", "event_id": "e1"}], devices=[PUSH_DEV], tokens=[TOKEN])
    notify.saved_changes(db, NOW)
    msg = out[0][2]
    assert msg["title"] == "Deadline changed: ReConCTF'26"
    assert msg["body"] == "Now closes Mon 5 Oct (was Tue 20 Oct)."
    assert msg["data"] == {"kind": "change", "eventId": "e1"} and msg["channelId"] == "deadlines"
    assert change["notified"]


def test_same_day_deadline_move_shows_the_time():
    c = {"changed_fields": ["registration_deadline"],
         "old_values": {"registration_deadline": "2026-10-05T18:29:00+00:00"},
         "new_values": {"registration_deadline": "2026-10-05T12:59:00+00:00"}}
    assert notify.change_message([(CTF, c)])["body"] == "Now closes 5 Oct, 6:29 PM (was 5 Oct, 11:59 PM)."


def test_changes_wait_until_morning(monkeypatch):
    capture_push(monkeypatch)
    change = {"id": 22, "event_id": "e1", "changed_fields": ["city"], "notified": False,
              "old_values": {"city": "Delhi"}, "new_values": {"city": "Noida"}}
    db = FakeDb([CTF], [change], [{"device_id": "p1", "event_id": "e1"}], devices=[PUSH_DEV], tokens=[TOKEN])
    assert notify.saved_changes(db, NIGHT) == 0 and db.patched == [] and not change["notified"]


def test_quiet_window_crosses_midnight():
    dev = {"quiet_start_min": 1380, "quiet_end_min": 480}
    def at(h, m):
        return datetime(2026, 9, 29, h, m, tzinfo=notify.IST)
    assert notify.in_quiet(at(23, 30), dev) and notify.in_quiet(at(7, 59), dev)
    assert not notify.in_quiet(at(8, 0), dev) and not notify.in_quiet(at(12, 0), dev)


def test_a_set_up_device_with_no_themes_still_gets_pushes(monkeypatch):
    out = capture_push(monkeypatch)
    no_themes = {**PUSH_DEV, "prefs": {"modes": ["online", "offline", "hybrid"]}, "alert_filter": {"modes": ["online", "offline", "hybrid"]}}
    assert notify.push_new_matches(FakeDb([CTF], devices=[no_themes], tokens=[TOKEN]), ["e1"], NOW) == 1 and len(out) == 1
