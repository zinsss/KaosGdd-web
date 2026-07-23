import json
import logging
from urllib import request
from urllib.error import HTTPError, URLError

from app.config import SETTINGS

logger = logging.getLogger(__name__)


def capture_supply(raw_text: str, *, timezone_name: str | None = None) -> dict:
    base_url = SETTINGS.SUPPLIES_API_BASE.rstrip("/")
    if not base_url:
        return {"attempted": False, "ok": False, "error": "supplies api is not configured"}

    payload: dict[str, str] = {"raw": raw_text}
    if timezone_name:
        payload["timezone"] = timezone_name

    data = json.dumps(payload).encode("utf-8")
    req = request.Request(
        f"{base_url}/capture",
        data=data,
        method="POST",
        headers={"Content-Type": "application/json"},
    )

    try:
        with request.urlopen(req, timeout=10) as resp:
            body = resp.read().decode("utf-8")
            parsed = json.loads(body) if body else {}
            if 200 <= resp.status < 300:
                return {"attempted": True, **parsed}
            return {"attempted": True, "ok": False, "error": parsed.get("error") or f"http {resp.status}"}
    except HTTPError as exc:
        body = exc.read().decode("utf-8") if hasattr(exc, "read") else ""
        try:
            parsed = json.loads(body) if body else {}
        except json.JSONDecodeError:
            parsed = {}
        return {"attempted": True, "ok": False, "error": parsed.get("error") or f"http {exc.code}"}
    except (URLError, TimeoutError) as exc:
        logger.warning("KaosSupplies capture request failed: %s", exc)
        return {"attempted": True, "ok": False, "error": "supplies service unavailable"}
    except Exception as exc:
        logger.warning("KaosSupplies capture request failed unexpectedly: %s", exc)
        return {"attempted": True, "ok": False, "error": "supplies service unavailable"}
