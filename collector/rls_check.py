"""Live RLS checklist from the Backend Schema doc, run with the app's anon key.

Run with:  python -m collector.rls_check
Signs in two throwaway anonymous users, tries every forbidden action, then deletes both users.
"""
import os
import sys
import uuid

import httpx

from . import config

URL = config.SUPABASE_URL.rstrip("/")
ANON = os.environ["SUPABASE_ANON_KEY"]
SERVICE = config.SUPABASE_SERVICE_ROLE_KEY


def sign_in() -> tuple[str, str]:
    r = httpx.post(f"{URL}/auth/v1/signup", headers={"apikey": ANON}, json={})
    r.raise_for_status()
    j = r.json()
    return j["access_token"], j["user"]["id"]


REAL = []   # throwaway non-guest users made by sign_in_real, deleted at the end


def sign_in_real() -> tuple[str, str]:
    """A confirmed email+password user made with the service key (guests can't submit hackathons)."""
    email, pw = f"rls-check-{uuid.uuid4().hex[:12]}@example.com", uuid.uuid4().hex
    admin = {"apikey": SERVICE, "Authorization": f"Bearer {SERVICE}"}
    r = httpx.post(f"{URL}/auth/v1/admin/users", headers=admin, json={"email": email, "password": pw, "email_confirm": True})
    r.raise_for_status()
    REAL.append(r.json()["id"])
    t = httpx.post(f"{URL}/auth/v1/token", params={"grant_type": "password"}, headers={"apikey": ANON},
                   json={"email": email, "password": pw})
    t.raise_for_status()
    return t.json()["access_token"], REAL[-1]


def rest(token: str | None):
    h = {"apikey": ANON, "Authorization": f"Bearer {token or ANON}", "Prefer": "return=representation"}
    return httpx.Client(base_url=f"{URL}/rest/v1", headers=h, timeout=20)


def blocked(r: httpx.Response) -> bool:
    """Forbidden = error status, or success that touched/returned no rows."""
    return r.status_code >= 400 or r.json() == []


def main() -> int:
    tok_a, id_a = sign_in()
    tok_b, id_b = sign_in()
    a, b, plain = rest(tok_a), rest(tok_b), rest(None)
    results = []

    def check(name, ok):
        results.append(ok)
        print(("PASS " if ok else "FAIL ") + name)

    try:
        any_event = a.get("/events", params={"select": "id", "limit": 1}).json()
        check("signed-in app can read events (sanity)", len(any_event) == 1)
        eid = any_event[0]["id"]

        check("update a row in events", blocked(a.patch("/events", params={"id": f"eq.{eid}"}, json={"title": "hacked"})))
        check("insert into events", blocked(a.post("/events", json={"title": "fake event", "registration_url": "https://x.io"})))
        for t in ("source_runs", "geocode_cache", "push_tickets", "review_queue", "event_sources", "manual_events"):
            check(f"select from {t}", blocked(a.get(f"/{t}", params={"limit": 1})))

        check("insert own device row (sanity)", a.post("/devices", json={"id": id_a}).status_code == 201)
        b.post("/devices", json={"id": id_b}).raise_for_status()
        check("select another device's row", blocked(a.get("/devices", params={"id": f"eq.{id_b}"})))
        check("update another device's row", blocked(a.patch("/devices", params={"id": f"eq.{id_b}"}, json={"city": "x"})))
        check("insert saved_events with someone else's device_id",
              blocked(a.post("/saved_events", json={"device_id": id_b, "event_id": eid})))
        check("select events without signing in (plain anon)", blocked(plain.get("/events", params={"limit": 1})))

        # push tokens (0014): only register_push_token writes them; nobody reads them
        token = "ExponentPushToken[rls-check-" + id_a[:8] + "]"
        check("register own push token (sanity)",
              a.post("/rpc/register_push_token", json={"p_token": token}).status_code in (200, 204))
        check("select from push_tokens", blocked(a.get("/push_tokens", params={"limit": 1})))
        check("insert into push_tokens directly",
              blocked(b.post("/push_tokens", json={"expo_push_token": token + "x", "user_id": id_b})))
        check("register a malformed token", a.post("/rpc/register_push_token", json={"p_token": "not a token"}).status_code >= 400)
        check("register a token without signing in (plain anon)",
              plain.post("/rpc/register_push_token", json={"p_token": token}).status_code >= 400)

        # reports (0016): insert own, never as someone else, never read others'
        check("report wrong info on an event (sanity)",
              a.post("/reports", json={"event_id": eid, "reason": "wrong_dates", "note": "rls check"}).status_code == 201)
        check("report as someone else", blocked(b.post("/reports", json={"event_id": eid, "reason": "fake", "user_id": id_a})))
        check("read another person's reports", blocked(b.get("/reports", params={"select": "id"})))
        check("same report twice", a.post("/reports", json={"event_id": eid, "reason": "wrong_dates"}).status_code >= 400)

        # submissions (0016): guests can't submit; a real account can, 5 a day, only as pending
        sub = {"title": "RLS check hack", "registration_url": "https://example.org/rls", "organizer": "RLS check",
               "mode": "online", "registration_deadline": "2099-01-01T00:00:00Z"}
        check("guest submits a hackathon", blocked(a.post("/submissions", json=sub)))
        tok_c, id_c = sign_in_real()
        c = rest(tok_c)
        check("signed-in account submits (sanity)", c.post("/submissions", json=sub).status_code == 201)
        check("submit as already approved", blocked(c.post("/submissions", json={**sub, "status": "approved"})))
        for _ in range(4):
            c.post("/submissions", json=sub)
        check("6th submission in a day", blocked(c.post("/submissions", json=sub)))
        check("read another person's submissions", blocked(a.get("/submissions", params={"select": "id"})))

        # delete my account (0016): the user and every row hanging off it go
        check("delete my account (sanity)", b.post("/rpc/delete_my_account", json={}).status_code in (200, 204))
        gone = httpx.get(f"{URL}/rest/v1/devices", params={"id": f"eq.{id_b}"},
                         headers={"apikey": SERVICE, "Authorization": f"Bearer {SERVICE}"}).json()
        check("deleted account leaves no device row", gone == [])
        check("delete without signing in", plain.post("/rpc/delete_my_account", json={}).status_code >= 400)
    finally:
        svc = {"apikey": SERVICE, "Authorization": f"Bearer {SERVICE}"}   # rows that outlive their user
        httpx.delete(f"{URL}/rest/v1/reports", params={"note": "eq.rls check"}, headers=svc)
        httpx.delete(f"{URL}/rest/v1/submissions", params={"title": "eq.RLS check hack"}, headers=svc)
        for uid in (id_a, id_b, *REAL):   # device rows cascade from auth.users (b may already be gone)
            httpx.delete(f"{URL}/auth/v1/admin/users/{uid}",
                         headers={"apikey": SERVICE, "Authorization": f"Bearer {SERVICE}"})

    print(f"\n{sum(results)}/{len(results)} passed")
    return 0 if all(results) else 1


if __name__ == "__main__":
    sys.exit(main())
