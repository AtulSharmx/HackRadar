import os

from . import devevents, devfolio, devpost, ethglobal, hack2skill, hackerearth, hackindia, hackster, knowafest, reskilll, unstop

_ALL = {"unstop": unstop, "devfolio": devfolio, "hack2skill": hack2skill, "hackerearth": hackerearth,
        "ethglobal": ethglobal, "hackster": hackster, "hackindia": hackindia, "reskilll": reskilll, "devevents": devevents,
        "devpost": devpost, "knowafest": knowafest}

# Public app: Devpost stays off until Devpost gives permission (their ToS forbids scraping;
# see docs/outreach.md). Devnovate is not built: its terms say "must not copy the materials" (30 Sep 2026),
# so it waits for permission too. KnowAFest is allowed but off: the owner wants well-known platforms only (30 Oct).
# Reskilll is off: 0 open of 173 cards, 540 KB every run for nothing (24 Nov); its old rows still render.
ADAPTERS = [_ALL[n.strip()] for n in os.environ.get("SOURCES", "unstop,devfolio,hack2skill,hackerearth,ethglobal,hackster,hackindia,devevents").split(",") if n.strip() in _ALL]
# Every 6 h, not hourly: ETHGlobal's page is 1.9 MB, and dev.events opens ~45 detail pages inside its fetch
HEAVY = {"ethglobal", "devevents"}
