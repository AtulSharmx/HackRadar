"""Expo push service: send, keep the tickets, read the receipts on the next run.

Follows https://docs.expo.dev/push-notifications/sending-notifications/: up to 100 messages a request,
retry 429/5xx with backoff, check receipts 15 min to 24 h after sending, stop using a token that
comes back DeviceNotRegistered. The API needs no key (enhanced push security is off).
"""
import time
from datetime import datetime, timedelta, timezone

import httpx

SEND = "https://exp.host/--/api/v2/push/send"
RECEIPTS = "https://exp.host/--/api/v2/push/getReceipts"
HEADERS = {"Accept": "application/json", "Accept-Encoding": "gzip, deflate", "Content-Type": "application/json"}
DEAD = "DeviceNotRegistered"


def _post(url: str, body, tries: int = 3) -> dict:
    status = "network error"
    for i in range(tries):
        try:
            r = httpx.post(url, json=body, headers=HEADERS, timeout=30)
            status = r.status_code
            if r.status_code != 429 and r.status_code < 500:
                r.raise_for_status()   # a 4xx here is our bug (bad payload): fail loudly
                return r.json()
        except httpx.TransportError:
            pass
        if i < tries - 1:
            time.sleep(2 ** (i + 1))
    raise RuntimeError(f"Expo push API unavailable ({status})")


def _in(values) -> str:
    """PostgREST in.() list; tokens contain [ ] so every value is quoted."""
    return "in.(" + ",".join(f'"{v}"' for v in values) + ")"


def _drop_tokens(db, tokens):
    if tokens:
        db.http.delete("/push_tokens", params={"expo_push_token": _in(sorted(set(tokens)))}).raise_for_status()


def deliver(db, outgoing: list[tuple[str, str, dict]]) -> int:
    """outgoing: (device_id, kind, message with one token in "to"). Returns how many Expo accepted.
    Accepted ones are stored in push_tickets; a token Expo already knows is dead is deleted."""
    accepted, dead, tickets = 0, [], []
    for i in range(0, len(outgoing), 100):
        batch = outgoing[i:i + 100]
        for (device_id, kind, msg), t in zip(batch, _post(SEND, [m for _, _, m in batch])["data"]):
            if t.get("status") == "ok":
                accepted += 1
                tickets.append({"ticket_id": t["id"], "device_id": device_id, "kind": kind, "token": msg["to"]})
            elif (t.get("details") or {}).get("error") == DEAD:
                dead.append(msg["to"])
            else:
                print(f"push refused for one device: {t.get('message', t)}"[:200])
    db.post("push_tickets", tickets)
    _drop_tokens(db, dead)
    return accepted


def check_receipts(db, now: datetime | None = None) -> dict:
    """Read receipts for tickets sent 15 min to 24 h ago; older ones have no receipt any more.
    Every looked-up ticket is marked checked; DeviceNotRegistered deletes the token."""
    now = now or datetime.now(timezone.utc)
    open_ = db.select_all("push_tickets", select="ticket_id,token,sent_at", checked="is.false",
                          sent_at=f"lt.{(now - timedelta(minutes=15)).isoformat()}")
    if not open_:
        return {"checked": 0, "dead": 0, "errors": 0}
    receipts, dead, errors = {}, [], 0
    for i in range(0, len(open_), 1000):
        receipts.update(_post(RECEIPTS, {"ids": [t["ticket_id"] for t in open_[i:i + 1000]]}).get("data") or {})
    for t in open_:
        r = receipts.get(t["ticket_id"])
        if r and r.get("status") == "error":
            errors += 1
            if (r.get("details") or {}).get("error") == DEAD and t.get("token"):
                dead.append(t["token"])
            else:
                print(f"push receipt error: {r.get('message', r)}"[:200])
    old = now - timedelta(hours=24)
    done = [t["ticket_id"] for t in open_
            if t["ticket_id"] in receipts or datetime.fromisoformat(t["sent_at"]) < old]
    if done:
        db.http.patch("/push_tickets", params={"ticket_id": _in(done)}, json={"checked": True}).raise_for_status()
    _drop_tokens(db, dead)
    return {"checked": len(done), "dead": len(set(dead)), "errors": errors}
