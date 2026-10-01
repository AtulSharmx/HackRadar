from datetime import datetime, timedelta, timezone

from collector import push

NOW = datetime(2026, 9, 29, 12, 0, tzinfo=timezone.utc)
OK = type("R", (), {"raise_for_status": lambda s: None})()


class FakeDb:
    def __init__(self, tickets=()):
        self.tickets, self.posted, self.deleted, self.patched = list(tickets), [], [], []
        self.http = self

    def post(self, table, rows, on_conflict=None):
        self.posted += rows

    def select_all(self, table, **p):
        before = datetime.fromisoformat(p["sent_at"][3:])
        return [t for t in self.tickets if not t.get("checked") and datetime.fromisoformat(t["sent_at"]) < before]

    def delete(self, path, params):
        self.deleted.append(params["expo_push_token"])
        return OK

    def patch(self, path, params, json):
        self.patched.append(params["ticket_id"])
        return OK


def test_deliver_keeps_tickets_and_drops_a_known_dead_token(monkeypatch):
    monkeypatch.setattr(push, "_post", lambda url, body: {"data": [
        {"status": "ok", "id": "t1"},
        {"status": "error", "message": "not registered", "details": {"error": "DeviceNotRegistered"}}]})
    db = FakeDb()
    out = [("d1", "new_match", {"to": "ExponentPushToken[a]", "title": "x"}),
           ("d2", "new_match", {"to": "ExponentPushToken[b]", "title": "x"})]
    assert push.deliver(db, out) == 1
    assert db.posted == [{"ticket_id": "t1", "device_id": "d1", "kind": "new_match", "token": "ExponentPushToken[a]"}]
    assert db.deleted == ['in.("ExponentPushToken[b]")']


def test_receipts_drop_dead_tokens_and_close_old_tickets(monkeypatch):
    def ago(**kw):
        return (NOW - timedelta(**kw)).isoformat()
    tickets = [{"ticket_id": "ok1", "token": "ExponentPushToken[a]", "sent_at": ago(hours=1)},
               {"ticket_id": "dead", "token": "ExponentPushToken[b]", "sent_at": ago(hours=1)},
               {"ticket_id": "gone", "token": "ExponentPushToken[c]", "sent_at": ago(hours=25)},   # receipt expired
               {"ticket_id": "later", "token": "ExponentPushToken[d]", "sent_at": ago(hours=2)},   # no receipt yet
               {"ticket_id": "fresh", "token": "ExponentPushToken[e]", "sent_at": ago(minutes=5)}]  # too new to ask
    asked = []
    monkeypatch.setattr(push, "_post", lambda url, body: asked.extend(body["ids"]) or {"data": {
        "ok1": {"status": "ok"},
        "dead": {"status": "error", "details": {"error": "DeviceNotRegistered"}}}})
    db = FakeDb(tickets)
    assert push.check_receipts(db, NOW) == {"checked": 3, "dead": 1, "errors": 1}
    assert "fresh" not in asked
    assert db.patched == ['in.("ok1","dead","gone")']
    assert db.deleted == ['in.("ExponentPushToken[b]")']


def test_server_errors_are_retried_then_reported(monkeypatch):
    calls = []

    class R:
        status_code = 503

    monkeypatch.setattr(push.httpx, "post", lambda *a, **k: calls.append(1) or R())
    monkeypatch.setattr(push.time, "sleep", lambda s: None)
    try:
        push._post(push.SEND, [])
        raise AssertionError("should have failed")
    except RuntimeError as e:
        assert "503" in str(e) and len(calls) == 3
