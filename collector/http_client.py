"""Shared polite HTTP client: one User-Agent, per-host delay, retries, robots.txt, stop on blocks."""
import json
import os
import time
from urllib.parse import urlsplit
from urllib.robotparser import RobotFileParser

import httpx

from . import config

RETRY_WAITS = (2, 4, 8)


class Blocked(Exception):
    """Source refused us (403, login wall, captcha, robots). Stop this source for the run."""


class _Resp:
    """The small part of an httpx response the client uses, so both fetch paths look the same."""
    def __init__(self, status_code: int, content_type: str, text: str):
        self.status_code, self.text = status_code, text
        self.headers = {"content-type": content_type or ""}

    def json(self):
        return json.loads(self.text)

    def raise_for_status(self):
        if self.status_code >= 400:
            raise httpx.HTTPStatusError(f"HTTP {self.status_code}", request=None, response=None)


class Client:
    def __init__(self, delay: float = config.REQUEST_DELAY_S):
        self.delay = delay
        self.http = httpx.Client(timeout=20, follow_redirects=True,
                                 headers={"User-Agent": config.USER_AGENT})
        self._last: dict[str, float] = {}
        self._robots: dict[str, RobotFileParser] = {}
        # GitHub's IPs are blocked by the sources; FETCH_VIA=supabase fetches through the database's
        # fetch_url() (migration 0006). Same User-Agent, same robots check, same delays.
        self.via_supabase = os.environ.get("FETCH_VIA") == "supabase"

    def _get(self, url: str, params=None):
        if not self.via_supabase:
            return self.http.get(url, params=params)
        full = str(httpx.URL(url, params=params))
        key = config.SUPABASE_SERVICE_ROLE_KEY
        r = httpx.post(f"{config.SUPABASE_URL.rstrip('/')}/rest/v1/rpc/fetch_url", timeout=40,
                       headers={"apikey": key, "Authorization": f"Bearer {key}"},
                       json={"url": full, "user_agent": config.USER_AGENT})
        r.raise_for_status()
        row = r.json()[0]
        return _Resp(row["status"], row["content_type"], row["body"] or "")

    def _wait(self, host: str):
        gap = time.monotonic() - self._last.get(host, 0)
        if gap < self.delay:
            time.sleep(self.delay - gap)
        self._last[host] = time.monotonic()

    def _allowed(self, url: str) -> bool:
        parts = urlsplit(url)
        host = parts.netloc
        if host not in self._robots:
            rp = RobotFileParser()
            self._wait(host)
            r = self._get(f"{parts.scheme}://{host}/robots.txt")
            if r.status_code in (401, 403):
                rp.disallow_all = True
            elif r.status_code < 400:
                rp.parse(r.text.splitlines())
            else:
                rp.allow_all = True
            self._robots[host] = rp
        # ponytail: urllib's parser ignores "*" wildcards inside paths; fine for our two sources
        return self._robots[host].can_fetch(config.USER_AGENT, url)

    def get_json(self, url: str, params=None):
        if not self._allowed(url):
            raise Blocked(f"robots.txt disallows {url}")
        host = urlsplit(url).netloc
        for attempt in range(len(RETRY_WAITS) + 1):
            self._wait(host)
            try:
                r = self._get(url, params=params)
            except httpx.TransportError:
                if attempt == len(RETRY_WAITS):
                    raise
                time.sleep(RETRY_WAITS[attempt])
                continue
            if r.status_code in (401, 403):
                raise Blocked(f"HTTP {r.status_code} from {host}")
            if r.status_code == 429 or r.status_code >= 500:
                if attempt == len(RETRY_WAITS):
                    r.raise_for_status()
                time.sleep(RETRY_WAITS[attempt])
                continue
            r.raise_for_status()
            if "json" not in r.headers.get("content-type", ""):
                raise Blocked(f"non-JSON reply from {host} (login page or captcha?)")
            return r.json()
