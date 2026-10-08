"""Check the Fast2SMS API key (FAST2SMS_API_KEY in .env).

  python scripts/fast2sms_check.py                  # wallet balance only: no SMS, nothing charged
  python scripts/fast2sms_check.py --send 98XXXXXXXX  # also sends one test OTP to that number (uses 1 SMS)

The OTP route sends Fast2SMS's fixed OTP template; only the number (the OTP) is ours.
"""
import argparse
import os
import random
import re
import sys
from pathlib import Path

import httpx

WALLET = "https://www.fast2sms.com/dev/wallet"
BULK = "https://www.fast2sms.com/dev/bulkV2"
# https://docs.fast2sms.com/reference/error-code-list
KNOWN = {
    412: "Invalid API key. Copy it again from Fast2SMS > Dev API.",
    413: "This API key is disabled. Enable it (or make a new one) in Fast2SMS > Dev API.",
    415: "Fast2SMS account disabled.",
    416: "Not enough wallet balance.",
    999: "Recharge at least Rs 100 once in the Fast2SMS wallet before the API works.",
    996: "Complete KYC in Fast2SMS before using the OTP route.",
    997: "The OTP route only accepts digits in variables_values.",
    995: "Fast2SMS blocked repeat SMS to the same number for now (spam guard). Wait and retry.",
    411: "Invalid mobile number. Use 10 digits, no +91.",
    414: "This IP is blacklisted for the Dev API.",
}


def load_key() -> str:
    for line in (Path(__file__).resolve().parent.parent / ".env").read_text(encoding="utf-8").splitlines():
        if line.startswith("FAST2SMS_API_KEY="):
            return line.split("=", 1)[1].strip().strip('"')
    return os.environ.get("FAST2SMS_API_KEY", "")


def explain(body: dict) -> str:
    code = body.get("status_code")
    msg = body.get("message")
    msg = " ".join(msg) if isinstance(msg, list) else msg
    return f"{code}: {KNOWN.get(code, msg)}"


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--send", metavar="MOBILE", help="10-digit Indian number for one test OTP SMS")
    args = ap.parse_args()

    key = load_key()
    if not key:
        print("FAST2SMS_API_KEY is missing in .env")
        return 1
    headers = {"authorization": key}

    r = httpx.post(WALLET, headers=headers, timeout=20)
    body = r.json() if r.headers.get("content-type", "").startswith("application/json") else {}
    if str(body.get("return")).lower() != "true":
        print("Key check FAILED ->", explain(body) if body else f"HTTP {r.status_code}")
        return 1
    print(f"Key works. Wallet: Rs {body.get('wallet')} (about {body.get('sms_count')} SMS)")

    if not args.send:
        return 0
    mobile = re.sub(r"\D", "", args.send)[-10:]
    if not re.fullmatch(r"[6-9]\d{9}", mobile):
        print("Give a 10-digit Indian mobile number, e.g. --send 98XXXXXXXX")
        return 1
    otp = f"{random.randint(0, 999999):06d}"
    r = httpx.post(BULK, headers=headers, timeout=20,
                   data={"route": "otp", "variables_values": otp, "numbers": mobile, "flash": "0"})
    body = r.json()
    if body.get("return") is True:
        print(f"Test OTP sent to {mobile[:2]}******{mobile[-2:]}: it should read {otp}. request_id {body.get('request_id')}")
        return 0
    print("Send FAILED ->", explain(body))
    return 1


if __name__ == "__main__":
    sys.exit(main())
