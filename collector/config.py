import os
from pathlib import Path

from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parent.parent
load_dotenv(ROOT / ".env")  # local runs; GitHub Actions sets real env vars

SUPABASE_URL = os.environ.get("SUPABASE_URL", "")
SUPABASE_SERVICE_ROLE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")

_contact = os.environ.get("HACKRADAR_CONTACT", "")
USER_AGENT = "HackRadar/1.0 (hackathon finder for students in India" + (f"; {_contact}" if _contact else "") + ")"

REQUEST_DELAY_S = 2.0   # min gap between requests to the same host
MAX_PAGES = 20          # per source per run
MAX_DETAILS_PER_RUN = int(os.environ.get("MAX_DETAILS_PER_RUN", "60"))  # detail pages per source per run
USD_TO_INR = 88.0       # fixed rate; converted prizes are marked approximate

# trust rules (TRD "Trust labels"); tune here, not in trust.py
FEE_LIMIT = 500                 # ₹ per team; above this with no prize/perk = high_fee
DATE_CONFLICT_DAYS = 1          # sources disagreeing on the deadline by more than this = date_conflict
PLATFORM_HOSTS = ("devpost.com", "unstop.com", "devfolio.co", "forms.gle", "docs.google.com",
                  "forms.office.com", "lu.ma", "luma.com", "typeform.com", "tally.so")
SOCIAL_HOSTS = ("instagram.com", "wa.me", "chat.whatsapp.com", "whatsapp.com", "t.me", "linktr.ee",
                "bit.ly", "tinyurl.com", "rb.gy", "shorturl.at", "cutt.ly")
NO_ORGANIZER_FIELD = ("devfolio", "hack2skill", "hackerearth", "reskilll", "devevents")   # their lists never name one
TRUSTED_SOURCES = ("devpost", "unstop", "devfolio", "hack2skill", "hackerearth", "ethglobal", "hackster", "hackindia", "reskilll", "devevents", "community")  # community: admin-reviewed
