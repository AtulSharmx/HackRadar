"""Supabase reads/writes through PostgREST with the service key (bypasses RLS). Collector only."""
import httpx

from . import config

PAGE = 1000  # Supabase's default max rows per request


class Db:
    def __init__(self):
        if not (config.SUPABASE_URL and config.SUPABASE_SERVICE_ROLE_KEY):
            raise RuntimeError("SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY missing in .env")
        key = config.SUPABASE_SERVICE_ROLE_KEY
        self.http = httpx.Client(base_url=config.SUPABASE_URL.rstrip("/") + "/rest/v1", timeout=30,
                                 headers={"apikey": key, "Authorization": f"Bearer {key}"})

    def select_all(self, table: str, **params) -> list[dict]:
        rows, start = [], 0
        while True:
            r = self.http.get(f"/{table}", params=params,
                              headers={"Range-Unit": "items", "Range": f"{start}-{start + PAGE - 1}"})
            r.raise_for_status()
            batch = r.json()
            rows += batch
            if len(batch) < PAGE:
                return rows
            start += PAGE

    def post(self, table: str, rows: list[dict], on_conflict: str | None = None):
        if not rows:
            return
        prefer = "return=minimal" + (",resolution=merge-duplicates" if on_conflict else "")
        params = {"on_conflict": on_conflict} if on_conflict else None
        r = self.http.post(f"/{table}", params=params, json=rows, headers={"Prefer": prefer})
        if r.status_code >= 300:
            raise RuntimeError(f"{table} write failed: {r.status_code} {r.text[:300]}")

    def rpc(self, fn: str, **args):
        r = self.http.post(f"/rpc/{fn}", json=args)
        if r.status_code >= 300:
            raise RuntimeError(f"rpc {fn} failed: {r.status_code} {r.text[:300]}")
        return r.json()

    def log_run(self, source: str, found: int, new: int, duration_ms: int, error: str | None):
        self.post("source_runs", [{"source": source, "events_found": found, "new_events": new,
                                   "duration_ms": duration_ms, "error_text": error}])
