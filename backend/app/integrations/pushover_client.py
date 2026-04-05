from urllib import parse, request
import logging

from app.config import SETTINGS

logger = logging.getLogger(__name__)


def send_pushover(
    *,
    title: str,
    message: str,
    url: str | None = None,
    url_title: str | None = None,
    priority: int = 0,
    sound: str | None = None,
) -> bool:
    if not SETTINGS.PUSHOVER_ENABLED:
        logger.info("pushover skipped: disabled")
        return False
    if not SETTINGS.PUSHOVER_TOKEN or not SETTINGS.PUSHOVER_USER_KEY:
        logger.warning("pushover skipped: missing token or user key")
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
    if sound:
        payload["sound"] = sound

    data = parse.urlencode(payload).encode("utf-8")
    req = request.Request(
        "https://api.pushover.net/1/messages.json",
        data=data,
        method="POST",
    )

    try:
        with request.urlopen(req, timeout=10) as resp:
            ok = 200 <= resp.status < 300
            if ok:
                logger.info("pushover sent: title=%s priority=%s sound=%s", title, priority, sound or "")
            else:
                logger.warning("pushover failed: status=%s title=%s", resp.status, title)
            return ok
    except Exception as exc:
        logger.exception("pushover exception: %s", exc)
        return False