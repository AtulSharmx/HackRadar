"""Admin messages to my Telegram chat. Missing token/chat id = print instead (local runs, tests)."""
import html
import os

import httpx


def esc(text) -> str:
    return html.escape(str(text), quote=False)


def send(text_html: str) -> bool:
    token, chat = os.environ.get("TELEGRAM_BOT_TOKEN"), os.environ.get("TELEGRAM_CHAT_ID")
    if not (token and chat):
        print("[telegram not configured]\n" + text_html)
        return False
    r = httpx.post(f"https://api.telegram.org/bot{token}/sendMessage", timeout=20,
                   json={"chat_id": chat, "text": text_html, "parse_mode": "HTML",
                         "disable_web_page_preview": True})
    if r.status_code != 200:
        print(f"telegram send failed: {r.status_code} {r.text[:200]}")
    return r.status_code == 200
