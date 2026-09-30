import os

from . import devfolio, devpost, unstop

_ALL = {"unstop": unstop, "devfolio": devfolio, "devpost": devpost}

# Public app: Devpost stays off until Devpost gives permission (their ToS forbids scraping;
# see docs/outreach.md). Turn it back on with SOURCES=unstop,devpost.
ADAPTERS = [_ALL[n.strip()] for n in os.environ.get("SOURCES", "unstop,devfolio").split(",") if n.strip() in _ALL]
