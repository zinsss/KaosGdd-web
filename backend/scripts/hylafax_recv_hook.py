#!/usr/bin/env python3
"""HylaFAX recvq hook for KaosGdd Fax v0.

Install this from HylaFAX's FaxDispatch/recvq workflow after a received raw
fax file exists. Example:

    /srv/KaosGdd-web/backend/scripts/hylafax_recv_hook.py "$FILE" "$SENDER" "$DEVICE"

The default path mode preserves the original same-host integration. Set
KAOSGDD_FAX_TRANSFER_MODE=upload when HylaFAX and KaosGdd run on different
hosts; upload mode transfers the TIFF bytes to the backend before conversion.
This script does not delete the raw source file.
"""

from __future__ import annotations

import json
import os
import sys
import urllib.error
import urllib.request
from urllib.parse import quote


def build_request(source_file_path: str, remote_number: str, local_device: str) -> urllib.request.Request:
    api_base = os.environ.get("KAOSGDD_API_BASE", "http://127.0.0.1:8000").rstrip("/")
    transfer_mode = os.environ.get("KAOSGDD_FAX_TRANSFER_MODE", "path").strip().lower()
    original_filename = os.path.basename(source_file_path)

    if transfer_mode == "upload":
        with open(source_file_path, "rb") as source_file:
            content = source_file.read()
        return urllib.request.Request(
            f"{api_base}/fax/incoming-upload",
            data=content,
            headers={
                "Content-Type": "image/tiff",
                "X-File-Name-Url": quote(original_filename, safe=""),
                "X-Fax-Remote-Number": remote_number,
                "X-Fax-Local-Device": local_device,
            },
            method="POST",
        )

    payload = {
        "source_file_path": source_file_path,
        "remote_number": remote_number,
        "local_device": local_device,
        "original_filename": original_filename,
        "original_mime_type": "image/tiff",
    }
    return urllib.request.Request(
        f"{api_base}/fax/incoming",
        data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json"},
        method="POST",
    )


def main(argv: list[str]) -> int:
    if len(argv) < 2:
        print("usage: hylafax_recv_hook.py RAW_FAX_PATH [REMOTE_NUMBER] [LOCAL_DEVICE]", file=sys.stderr)
        return 2

    source_file_path = argv[1]
    remote_number = argv[2] if len(argv) > 2 else ""
    local_device = argv[3] if len(argv) > 3 else ""
    try:
        request = build_request(source_file_path, remote_number, local_device)
    except OSError as exc:
        print(f"KaosGdd incoming fax hook could not read source file: {exc}", file=sys.stderr)
        return 1

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
