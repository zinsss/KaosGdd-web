#!/usr/bin/env python3
"""HylaFAX recvq hook for KaosGdd Fax v0.

Install this from HylaFAX's FaxDispatch/recvq workflow after a received raw
fax file exists. Example:

    /srv/KaosGdd-web/backend/scripts/hylafax_recv_hook.py "$FILE" "$SENDER" "$DEVICE"

The hook calls the KaosGdd incoming fax API. The backend converts the raw fax to
PDF first, then creates the Fax item and sends the alert. This script does not
delete the raw source file.
"""

from __future__ import annotations

import json
import os
import sys
import urllib.error
import urllib.request


def main(argv: list[str]) -> int:
    if len(argv) < 2:
        print("usage: hylafax_recv_hook.py RAW_FAX_PATH [REMOTE_NUMBER] [LOCAL_DEVICE]", file=sys.stderr)
        return 2

    source_file_path = argv[1]
    payload = {
        "source_file_path": source_file_path,
        "remote_number": argv[2] if len(argv) > 2 else "",
        "local_device": argv[3] if len(argv) > 3 else "",
        "original_filename": os.path.basename(source_file_path),
        "original_mime_type": "image/tiff",
    }
    api_base = os.environ.get("KAOSGDD_API_BASE", "http://127.0.0.1:8000").rstrip("/")
    request = urllib.request.Request(
        f"{api_base}/fax/incoming",
        data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json"},
        method="POST",
    )

    try:
        with urllib.request.urlopen(request, timeout=30) as response:
            body = response.read().decode("utf-8", errors="replace")
    except urllib.error.URLError as exc:
        print(f"KaosGdd incoming fax hook failed: {exc}", file=sys.stderr)
        return 1

    try:
        parsed = json.loads(body)
    except json.JSONDecodeError:
        print(f"KaosGdd incoming fax hook returned non-JSON: {body[:200]}", file=sys.stderr)
        return 1

    if not parsed.get("ok"):
        print(f"KaosGdd incoming fax hook failed: {parsed.get('status') or parsed.get('error')}", file=sys.stderr)
        return 1

    print(f"KaosGdd incoming fax created: {parsed.get('id')}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv))
