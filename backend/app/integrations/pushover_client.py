import json
from urllib import parse, request

from app.config import SETTINGS


def send_pushover(
    *,
    title: str,
    message: str,
    url: str | None = None,
    url_title: str | None = None,
    priority: int = 0,
) -> bool:
    if not SETTINGS.PUSHOVER_ENABLED:
      return False
    if not SETTINGS.PUSHOVER_TOKEN or not SETTINGS.PUSHOVER_USER_KEY:
      return False

    payload = {
        "token": SETTINGS.PUSHOVER_TOKEN,
        "user": SETTINGS.PUSHOVER_USER_KEY,
        "title": title,
        "message": message,
        "priority": str(priority),
    }

    if url:
        payload["url"] = url
    if url_title:
        payload["url_title"] = url_title

    data = parse.urlencode(payload).encode("utf-8")
    req = request.Request(
        "https://api.pushover.net/1/messages.json",
        data=data,
        method="POST",
    )

    try:
        with request.urlopen(req, timeout=10) as resp:
            return 200 <= resp.status < 300
    except Exception:
        return False