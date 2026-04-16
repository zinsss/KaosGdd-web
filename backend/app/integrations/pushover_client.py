import json
import logging
from urllib import parse, request
from urllib.error import HTTPError, URLError

from app.config import SETTINGS

logger = logging.getLogger(__name__)


PUSHOVER_ENDPOINT = "https://api.pushover.net/1/messages.json"


def send_pushover(
    *,
    title: str,
    message: str,
    url: str | None = None,
    url_title: str | None = None,
    priority: int | None = None,
) -> dict:
    if not SETTINGS.PUSHOVER_ENABLED:
        return {
            "attempted": False,
            "succeeded": False,
            "reason": "disabled",
        }

    if not SETTINGS.PUSHOVER_APP_TOKEN or not SETTINGS.PUSHOVER_USER_KEY:
        return {
            "attempted": False,
            "succeeded": False,
            "reason": "missing credentials",
        }

    selected_priority = priority if priority is not None else SETTINGS.PUSHOVER_PRIORITY_DEFAULT

    payload = {
        "token": SETTINGS.PUSHOVER_APP_TOKEN,
        "user": SETTINGS.PUSHOVER_USER_KEY,
        "title": title,
        "message": message,
        "priority": str(selected_priority),
    }

    if SETTINGS.PUSHOVER_DEVICE:
        payload["device"] = SETTINGS.PUSHOVER_DEVICE
    if url:
        payload["url"] = url
    if url_title:
        payload["url_title"] = url_title

    data = parse.urlencode(payload).encode("utf-8")
    req = request.Request(PUSHOVER_ENDPOINT, data=data, method="POST")

    try:
        with request.urlopen(req, timeout=10) as resp:
            body = resp.read().decode("utf-8")
            parsed = _decode_json(body)
            if 200 <= resp.status < 300:
                return {
                    "attempted": True,
                    "succeeded": True,
                    "reason": None,
                    "status": resp.status,
                    "response": parsed,
                }
            return {
                "attempted": True,
                "succeeded": False,
                "reason": f"http {resp.status}",
                "status": resp.status,
                "response": parsed,
            }
    except HTTPError as exc:
        detail = exc.read().decode("utf-8") if hasattr(exc, "read") else ""
        parsed = _decode_json(detail)
        reason = _extract_error_reason(parsed) or f"http {exc.code}"
        logger.warning("pushover api error: status=%s reason=%s", exc.code, reason)
        return {
            "attempted": True,
            "succeeded": False,
            "reason": reason,
            "status": exc.code,
            "response": parsed,
        }
    except URLError as exc:
        return {
            "attempted": True,
            "succeeded": False,
            "reason": f"network error: {exc.reason}",
        }
    except Exception as exc:  # defensive: do not break reminder fire flow
        return {
            "attempted": True,
            "succeeded": False,
            "reason": f"exception: {exc}",
        }


def _decode_json(raw: str) -> dict | None:
    if not raw:
        return None
    try:
        parsed = json.loads(raw)
        if isinstance(parsed, dict):
            return parsed
    except json.JSONDecodeError:
        return None
    return None


def _extract_error_reason(parsed: dict | None) -> str | None:
    if not parsed:
        return None
    errors = parsed.get("errors")
    if isinstance(errors, list) and errors:
        return str(errors[0])
    return None
