import os
from pathlib import Path

from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parent.parent
load_dotenv(ROOT / ".env")  # local runs; GitHub Actions sets real env vars

SUPABASE_URL = os.environ.get("SUPABASE_URL", "")
SUPABASE_SERVICE_ROLE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")

_contact = os.environ.get("HACKRADAR_CONTACT", "")
USER_AGENT = "HackRadar/0.1 (personal hackathon finder" + (f"; {_contact}" if _contact else "") + ")"

REQUEST_DELAY_S = 2.0   # min gap between requests to the same host
MAX_PAGES = 20          # per source per run
USD_TO_INR = 88.0       # fixed rate; converted prizes are marked approximate
