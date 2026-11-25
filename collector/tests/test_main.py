"""main(): each step after saving runs on its own, so a Telegram outage or one broken step never skips
the users' pushes or fails the run."""
from datetime import datetime, timezone
from types import SimpleNamespace

import httpx

from collector import main
from collector.tests.test_notify import CTF, DEV

USER_STEPS = {"geocode": (main.geocode, "run"), "receipts": (main.push, "check_receipts"),
              "new-match pushes": (main.notify, "push_new_matches"), "change pushes": (main.notify, "saved_changes")}
ADMIN_STEPS = {"admin queue": (main.community, "admin_queue"), "health": (main.health, "check_and_alert"),
               "daily report": (main.daily, "send_if_due")}
PENDING = {"id": "s1", "title": "HackSGT 2026", "organizer": "SGT University", "mode": "offline", "city": "Gurugram",
           "registration_url": "https://forms.gle/abc", "registration_deadline": "2026-10-20T18:29:00+00:00"}


class Source:   # one platform that answered but had nothing open
    name = "unstop"

    @staticmethod
    def fetch(client):
        return []


class FakeDb:
    """Every read finds something to tell: a matching event, a submission to review, a source that is down."""
    end = {"closed_count": 0, "stale_count": 0}   # end_of_run's answer, as before migration 0022
    calls = []   # what the run wrote or called, reset by run_main

    def select_all(self, table, **p):
        if table == "devices":
            return [DEV]                                         # the owner's Telegram-marked row
        if table == "events":
            return [{**CTF, "registration_deadline": None,       # matches whatever today's date is
                     "sources": ["unstop"], "first_seen_at": "2026-11-24T06:00:00+00:00", "updated_at": "2026-11-24T06:00:00+00:00"}]
        if table == "submissions":
            return [PENDING] if p.get("status") == "eq.pending" else []
        if table == "source_runs" and p["source"] == "eq.unstop" and "events_found" not in p:
            return [{"run_at": "2026-09-29T06:00:00+00:00", "events_found": 0, "error_text": "HTTP 403"}]
        return []

    def log_run(self, *args):
        self.calls.append(("log_run", args[0]))

    def rpc(self, fn, **args):
        self.calls.append((fn, args))
        return [self.end]

    def post(self, table, rows):
        self.calls.append((table, rows))


def run_main(monkeypatch, steps, fail=(), adapters=(Source,)):
    """main() on fakes. The given steps only record that they ran, and raise when named in fail."""
    ran = []

    def stand_in(name):
        def step(*args):
            ran.append(name)
            if name in fail:
                raise RuntimeError(f"{name} broke")
            return 0
        return step

    for name, (module, attr) in steps.items():
        monkeypatch.setattr(module, attr, stand_in(name))
    monkeypatch.setattr(main, "Db", FakeDb)
    monkeypatch.setattr(FakeDb, "calls", [])
    monkeypatch.setattr(main, "Client", lambda: None)
    monkeypatch.setattr(main, "ADAPTERS", list(adapters))
    monkeypatch.setattr(main, "sync", lambda db, events, down: FakeDb.calls.append(("sync", down)) or ({}, 0, ["e1"]))
    assert main.main() == 0
    return ran


def test_a_telegram_outage_never_stops_the_users_pushes(monkeypatch):
    monkeypatch.setenv("TELEGRAM_BOT_TOKEN", "test")   # configured, so every message really tries to go out
    monkeypatch.setenv("TELEGRAM_CHAT_ID", "1")
    tried = []

    def down(url, **kwargs):
        tried.append(url)
        raise httpx.ConnectError("Telegram is down")

    class Clock(datetime):   # 09:17 IST, so the daily report tries to go out too
        @classmethod
        def now(cls, tz=None):
            return at(3, 47)

    monkeypatch.setattr(httpx, "post", down)
    monkeypatch.setattr(main, "datetime", Clock)
    assert run_main(monkeypatch, USER_STEPS) == list(USER_STEPS)
    assert len(tried) == 3   # the admin queue, the health alert and the daily report; nothing about users' matches


def test_one_broken_step_never_skips_another(monkeypatch):
    steps = USER_STEPS | ADMIN_STEPS
    for broken in steps:
        assert run_main(monkeypatch, steps, fail={broken}) == list(steps)


def at(hour, minute):
    return datetime(2026, 11, 25, hour, minute, tzinfo=timezone.utc)


def test_hourly_runs_fetch_the_heavy_sources_only_every_6_hours():
    every = [SimpleNamespace(name=n) for n in ("unstop", "ethglobal", "devfolio", "devevents")]
    light, everything = ["unstop", "devfolio"], ["unstop", "ethglobal", "devfolio", "devevents"]

    def fetched(now, event="schedule"):
        return [a.name for a in main.due(every, now, event)]

    assert fetched(at(0, 47)) == everything
    assert fetched(at(1, 47)) == light
    assert fetched(at(5, 47)) == light
    assert fetched(at(6, 47)) == everything
    assert fetched(at(7, 30)) == everything   # the 06:47 run that GitHub started 43 min late is still the 6-hourly one
    assert fetched(at(7, 47)) == light
    assert fetched(at(18, 50)) == everything
    assert fetched(at(1, 47), "workflow_dispatch") == everything   # "Run workflow" by hand: every source
    assert fetched(at(1, 47), None) == everything                  # a local run: every source


class Heavy:   # ETHGlobal answered with one record (that doesn't parse, which doesn't matter here)
    name = "ethglobal"
    fetches = []

    @classmethod
    def fetch(cls, client):
        cls.fetches.append(client)
        return [{}]

    @staticmethod
    def parse(raw):
        raise ValueError("no fields")


def test_a_heavy_source_skipped_this_hour_is_not_counted_as_missing(monkeypatch):
    class Clock(datetime):
        run_hour = 1

        @classmethod
        def now(cls, tz=None):
            return at(cls.run_hour, 47)

    monkeypatch.setattr(main, "datetime", Clock)
    monkeypatch.setattr(Heavy, "fetches", [])
    monkeypatch.setenv("GITHUB_EVENT_NAME", "schedule")
    run_main(monkeypatch, USER_STEPS | ADMIN_STEPS, adapters=(Source, Heavy))
    assert Heavy.fetches == [] and ("log_run", "ethglobal") not in FakeDb.calls
    assert ("end_of_run", {"ok_sources": [], "run_started": at(1, 47).isoformat()}) in FakeDb.calls
    # and sync leaves its events as stored, so an event also on Unstop doesn't flip between the two every hour
    assert ("sync", {"unstop", "ethglobal"}) in FakeDb.calls   # (this Unstop answered with nothing: down too)

    Clock.run_hour = 6   # the 6-hourly run fetches it, and its successful fetch counts
    run_main(monkeypatch, USER_STEPS | ADMIN_STEPS, adapters=(Source, Heavy))
    assert len(Heavy.fetches) == 1 and ("log_run", "ethglobal") in FakeDb.calls
    assert ("end_of_run", {"ok_sources": ["ethglobal"], "run_started": at(6, 47).isoformat()}) in FakeDb.calls
    assert ("sync", {"unstop"}) in FakeDb.calls


BRAKE = {"closed_count": 2, "stale_count": 0, "stale_blocked": 57}   # migration 0022: the 30% brake kept 57 open


def test_the_stale_brake_sends_one_data_blowup_alert(monkeypatch):
    sent = []
    monkeypatch.setattr(main.health, "send", lambda text: sent.append(text) or True)
    monkeypatch.setattr(FakeDb, "end", BRAKE)
    assert run_main(monkeypatch, USER_STEPS | ADMIN_STEPS) == list(USER_STEPS | ADMIN_STEPS)
    assert len(sent) == 1 and "Data blow-up" in sent[0] and "57 open hackathons" in sent[0]
    assert [rows[0]["source"] for table, rows in FakeDb.calls if table == "source_runs"] == ["health:blowup"]


def test_no_blowup_alert_when_the_brake_did_not_fire(monkeypatch):
    sent = []
    monkeypatch.setattr(main.health, "send", lambda text: sent.append(text) or True)
    for end in ({"closed_count": 0, "stale_count": 3, "stale_blocked": 0},
                {"closed_count": 0, "stale_count": 3}):   # end_of_run before migration 0022 is applied
        monkeypatch.setattr(FakeDb, "end", end)
        run_main(monkeypatch, USER_STEPS | ADMIN_STEPS)
    assert sent == []


def test_a_blowup_alert_telegram_cannot_take_never_stops_the_run(monkeypatch):
    def down(text):
        raise httpx.ConnectError("Telegram is down")

    monkeypatch.setattr(main.health, "send", down)
    monkeypatch.setattr(FakeDb, "end", BRAKE)
    assert run_main(monkeypatch, USER_STEPS | ADMIN_STEPS) == list(USER_STEPS | ADMIN_STEPS)
