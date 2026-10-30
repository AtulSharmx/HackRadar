import os

from . import devfolio, devpost, ethglobal, hack2skill, hackerearth, hackster, knowafest, unstop

_ALL = {"unstop": unstop, "devfolio": devfolio, "hack2skill": hack2skill, "hackerearth": hackerearth,
        "ethglobal": ethglobal, "hackster": hackster, "devpost": devpost, "knowafest": knowafest}

# Public app: Devpost stays off until Devpost gives permission (their ToS forbids scraping;
# see docs/outreach.md). Devnovate is not built: its terms say "must not copy the materials" (30 Sep 2026),
# so it waits for permission too. KnowAFest is allowed but off: the owner wants well-known platforms only (30 Oct).
ADAPTERS = [_ALL[n.strip()] for n in os.environ.get("SOURCES", "unstop,devfolio,hack2skill,hackerearth,ethglobal,hackster").split(",") if n.strip() in _ALL]
