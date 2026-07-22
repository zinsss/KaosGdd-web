import base64
import json
import logging
from urllib import parse, request
from urllib.error import HTTPError, URLError

from app.config import SETTINGS

logger = logging.getLogger(__name__)


def _topic_path(base_url: str, topic: str) -> str:
    base = base_url.rstrip("/")
    safe_topic = parse.quote(str(topic or ""), safe="")
    if not base:
        return f"/{safe_topic}"
    return f"{base}/{safe_topic}"


def send_ntfy(
    *,
    title: str,
    message: str,
    topic: str,
    url: str | None = None,
) -> dict:
    if not SETTINGS.NTFY_ENABLED:
        return {
            "attempted": False,
            "succeeded": False,
            "reason": "disabled",
        }

    if not topic:
        return {
            "attempted": False,
            "succeeded": False,
            "reason": "missing topic",
        }

    if not SETTINGS.NTFY_BASE_URL:
        return {
            "attempted": False,
            "succeeded": False,
            "reason": "missing base url",
        }

    payload = {
        "topic": topic,
        "title": title,
        "message": message,
    }
    if url:
        payload["click"] = url

    data = (json.dumps(payload) + "\n").encode("utf-8")
    endpoint = _topic_path(SETTINGS.NTFY_BASE_URL, topic)
    req = request.Request(endpoint, data=data, method="POST")
    req.add_header("Content-Type", "application/json")

    if SETTINGS.NTFY_TOKEN:
        req.add_header("Authorization", f"Bearer {SETTINGS.NTFY_TOKEN}")
    elif SETTINGS.NTFY_USERNAME and SETTINGS.NTFY_PASSWORD:
        credentials = f"{SETTINGS.NTFY_USERNAME}:{SETTINGS.NTFY_PASSWORD}".encode("utf-8")
        req.add_header("Authorization", f"Basic {base64.b64encode(credentials).decode()}")

    try:
        with request.urlopen(req, timeout=10) as resp:
            body = resp.read().decode("utf-8")
            if 200 <= resp.status < 300:
                return {
                    "attempted": True,
                    "succeeded": True,
                    "reason": None,
                    "status": resp.status,
                    "response": body,
                }
            logger.warning("ntfy api error: status=%s response=%s", resp.status, body)
            return {
                "attempted": True,
                "succeeded": False,
                "reason": f"http {resp.status}",
                "status": resp.status,
                "response": body,
            }
    except HTTPError as exc:
        body = exc.read().decode("utf-8") if hasattr(exc, "read") else ""
        logger.warning("ntfy api http error: status=%s response=%s", exc.code, body)
        return {
            "attempted": True,
            "succeeded": False,
            "reason": f"http {exc.code}",
            "status": exc.code,
            "response": body,
        }
    except URLError as exc:
        logger.warning("ntfy network error: reason=%s", exc.reason)
        return {
            "attempted": True,
            "succeeded": False,
            "reason": f"network error: {exc.reason}",
        }
    except Exception as exc:  # defensive: do not break reminder fire flow
        logger.warning("ntfy send exception: %s", exc)
        return {
            "attempted": True,
            "succeeded": False,
            "reason": f"exception: {exc}",
        }

