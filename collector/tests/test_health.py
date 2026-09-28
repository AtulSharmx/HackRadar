from collector import health


class FakeDb:
    def __init__(self, runs):
        self.runs = runs   # {source: [rows newest first]}

    def select_all(self, table, **p):
        rows = self.runs.get(p["source"].removeprefix("eq."), [])
        if p.get("events_found") == "gt.0":
            return [r for r in rows if r["events_found"] > 0][:1]
        return rows


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
