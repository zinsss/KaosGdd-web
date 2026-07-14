import json
import logging
from urllib import request
from urllib.error import HTTPError, URLError

from app.config import SETTINGS

logger = logging.getLogger(__name__)


def send_ntfy(
    *,
    topic: str,
    title: str,
    message: str,
    url: str | None = None,
    priority: int | None = None,
) -> dict:
    if not SETTINGS.NTFY_ENABLED:
        return {
            "attempted": False,
            "succeeded": False,
            "reason": "disabled",
        }

    base_url = str(SETTINGS.NTFY_BASE_URL or "").strip().rstrip("/")
    clean_topic = str(topic or "").strip().strip("/")
    if not base_url or not clean_topic:
        return {
            "attempted": False,
            "succeeded": False,
            "reason": "missing url or topic",
        }

    endpoint = f"{base_url}/{clean_topic}"
    data = str(message or "").encode("utf-8")
    headers = {
        "Title": str(title or "KaosGdd"),
        "Priority": str(priority if priority is not None else 3),
        "User-Agent": "KaosGdd/ntfy",
    }
    token = str(SETTINGS.NTFY_TOKEN or "").strip()
    if token:
        headers["Authorization"] = f"Bearer {token}"
    if url:
        headers["Click"] = str(url)

    req = request.Request(endpoint, data=data, headers=headers, method="POST")
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
            logger.warning("ntfy api error: status=%s response=%s", resp.status, parsed)
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
        logger.warning("ntfy api error: status=%s reason=%s", exc.code, reason)
        return {
            "attempted": True,
            "succeeded": False,
            "reason": reason,
            "status": exc.code,
            "response": parsed,
        }
    except URLError as exc:
        logger.warning("ntfy network error: reason=%s", exc.reason)
        return {
            "attempted": True,
            "succeeded": False,
            "reason": f"network error: {exc.reason}",
        }
    except Exception as exc:
        logger.warning("ntfy send exception: %s", exc)
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
    error = parsed.get("error")
    if error:
        return str(error)
    return None
