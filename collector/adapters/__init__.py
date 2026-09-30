import os

from . import devfolio, devpost, hack2skill, unstop

_ALL = {"unstop": unstop, "devfolio": devfolio, "hack2skill": hack2skill, "devpost": devpost}

# Public app: Devpost stays off until Devpost gives permission (their ToS forbids scraping;
# see docs/outreach.md). Devnovate is not built: its terms say "must not copy the materials" (30 Sep 2026),
# so it waits for permission too.
ADAPTERS = [_ALL[n.strip()] for n in os.environ.get("SOURCES", "unstop,devfolio,hack2skill").split(",") if n.strip() in _ALL]
