import os

from . import devpost, unstop

_ALL = {"unstop": unstop, "devpost": devpost}

# Public app: Devpost stays off until Devpost gives permission (their ToS forbids scraping;
# see docs/outreach.md). Turn it back on with SOURCES=unstop,devpost.
ADAPTERS = [_ALL[n.strip()] for n in os.environ.get("SOURCES", "unstop").split(",") if n.strip() in _ALL]
