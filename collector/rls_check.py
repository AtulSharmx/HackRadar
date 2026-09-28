"""Live RLS checklist from the Backend Schema doc, run with the app's anon key.

Run with:  python -m collector.rls_check
Signs in two throwaway anonymous users, tries every forbidden action, then deletes both users.
"""
import os
import sys

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
    finally:
        for uid in (id_a, id_b):   # device rows cascade from auth.users
            httpx.delete(f"{URL}/auth/v1/admin/users/{uid}",
                         headers={"apikey": SERVICE, "Authorization": f"Bearer {SERVICE}"})

    print(f"\n{sum(results)}/{len(results)} passed")
    return 0 if all(results) else 1


if __name__ == "__main__":
    sys.exit(main())
