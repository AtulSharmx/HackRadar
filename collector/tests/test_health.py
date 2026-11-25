from datetime import datetime, timedelta, timezone

from collector import health

T0 = datetime(2026, 9, 29, 6, 30, tzinfo=timezone.utc)


class FakeDb:
    def __init__(self, runs):
        self.runs = runs   # {source: [rows newest first]}
        self.alerts = []   # the "health:<source>" rows check_and_alert writes to source_runs

    def select_all(self, table, **p):
        if p["source"] == "like.health:*":
            since = datetime.fromisoformat(p["run_at"].removeprefix("gt."))
            return [a for a in self.alerts if datetime.fromisoformat(a["run_at"]) > since]
        rows = self.runs.get(p["source"].removeprefix("eq."), [])
        if p.get("events_found") == "gt.0":
            return [r for r in rows if r["events_found"] > 0][:1]
        return rows

    def post(self, table, rows):
        assert table == "source_runs"
        self.alerts += rows


def run(found, err=None, at="2026-09-29T06:00:00+00:00"):
    return {"run_at": at, "events_found": found, "error_text": err}


def test_healthy_source_no_alert():
    db = FakeDb({"unstop": [run(0, "HTTP 500"), run(217)]})   # one bad run inside the window is fine
    assert health.problems(db, ["unstop"]) == []


def test_zero_events_whole_window_alerts_with_real_details():
    db = FakeDb({"unstop": [run(0, "Blocked: HTTP 403 from unstop.com"), run(0, "Blocked: HTTP 403 from unstop.com")],
                 "devpost": [run(69)]})
    msgs = health.problems(db, ["devpost", "unstop"])
    assert len(msgs) == 1
    assert "Unstop" in msgs[0] and "koi hackathon nahi aaya" in msgs[0]
    assert "HTTP 403" in msgs[0] and "Runs is window mein: 2" in msgs[0]


def test_errors_every_run_alerts_even_with_events():
    db = FakeDb({"devpost": [run(60, "3 of 175 records failed to parse"), run(61, "2 of 175 records failed to parse")]})
    assert "har run mein error aaya" in health.problems(db, ["devpost"])[0]


def test_error_text_is_html_escaped():
    db = FakeDb({"unstop": [run(0, "<script>x</script>")]})
    assert "<script>" not in health.problems(db, ["unstop"])[0]


def test_hackerearth_without_hackathons_is_normal_but_its_errors_alert():
    assert health.problems(FakeDb({"hackerearth": [run(0), run(0)]}), ["hackerearth"]) == []
    assert len(health.problems(FakeDb({"hackerearth": [run(0, "Blocked: HTTP 403")]}), ["hackerearth"])) == 1


def test_an_alert_goes_once_then_at_most_every_6_hours_while_it_lasts(monkeypatch):
    sent = []
    monkeypatch.setattr(health, "send", lambda text: sent.append(text) or True)
    db = FakeDb({"unstop": [run(0, "Blocked: HTTP 403")], "devpost": [run(69)]})
    assert health.check_and_alert(db, ["unstop", "devpost"], T0) == 1                        # the problem starts
    assert health.check_and_alert(db, ["unstop", "devpost"], T0 + timedelta(hours=1)) == 0   # next hourly run: quiet
    db.runs["devpost"] = [run(0, "HTTP 500")]
    assert health.check_and_alert(db, ["unstop", "devpost"], T0 + timedelta(hours=2)) == 1   # another source: at once
    assert "Devpost" in sent[-1]
    assert health.check_and_alert(db, ["unstop"], T0 + timedelta(hours=5, minutes=59)) == 0
    assert health.check_and_alert(db, ["unstop"], T0 + timedelta(hours=6)) == 1              # still broken: again
    assert len(sent) == 3 and "Unstop" in sent[-1] and "har 6 ghante" in sent[-1]


def test_an_alert_telegram_did_not_take_is_tried_again_next_run(monkeypatch):
    monkeypatch.setattr(health, "send", lambda text: False)
    db = FakeDb({"unstop": [run(0, "Blocked: HTTP 403")]})
    assert health.check_and_alert(db, ["unstop"], T0) == 0 and db.alerts == []


def test_a_data_blowup_alert_goes_once_then_at_most_every_6_hours(monkeypatch):
    sent = []
    monkeypatch.setattr(health, "send", lambda text: sent.append(text) or True)
    db = FakeDb({"unstop": [run(0, "Blocked: HTTP 403")]})
    assert health.check_and_alert(db, ["unstop"], T0) == 1
    assert health.blowup_alert(db, 57, T0)                                # a source alert doesn't hold it back
    assert not health.blowup_alert(db, 58, T0 + timedelta(hours=1))       # brake still on next hour: quiet
    assert health.blowup_alert(db, 61, T0 + timedelta(hours=6))
    assert len(sent) == 3 and "61 open hackathons" in sent[-1] and "30%" in sent[-1]


def test_a_blowup_alert_telegram_did_not_take_is_tried_again_next_run(monkeypatch):
    monkeypatch.setattr(health, "send", lambda text: False)
    db = FakeDb({})
    assert not health.blowup_alert(db, 57, T0) and db.alerts == []
