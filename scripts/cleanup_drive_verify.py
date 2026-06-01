"""
HUS Drive Cleanup — 現状 VERIFY (read-only)

依頼: 小池 → ナランチャ  2026-05-31
04_Logistics の重複folder 4組 + 05_Procurement の typo 1件 を
破壊系操作の前に「実Drive現状」として正確に把握する。

token.json (hokkaidounishop, scope=drive) で list のみ実行。一切書き込まない。

Usage:
    .venv-drive/bin/python3 scripts/cleanup_drive_verify.py
"""

import json
import sys
from pathlib import Path

from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build

SCOPES = ["https://www.googleapis.com/auth/drive"]
SCRIPT_DIR = Path(__file__).parent
TOKEN_PATH = SCRIPT_DIR / "token.json"
FOLDER_MIME = "application/vnd.google-apps.folder"

LOGISTICS_ID = "1A4pNgMvlNiIVdXfWLQVYbpSLF7DHAePQ"   # HUS/04_Logistics
PROCUREMENT_ID = "1DlKyN-cK_trtFy_NxfTJkef0zMhDq4sM"  # HUS/05_Procurement


def authenticate():
    creds = Credentials.from_authorized_user_file(str(TOKEN_PATH), SCOPES)
    if creds.expired and creds.refresh_token:
        from google.auth.transport.requests import Request
        creds.refresh(Request())
        TOKEN_PATH.write_text(creds.to_json())
    return creds


def list_children(service, folder_id):
    files, page_token = [], None
    while True:
        resp = service.files().list(
            q=f"'{folder_id}' in parents and trashed = false",
            fields="nextPageToken, files(id, name, mimeType, size)",
            pageSize=200, pageToken=page_token,
        ).execute()
        files.extend(resp.get("files", []))
        page_token = resp.get("nextPageToken")
        if not page_token:
            break
    return files


def describe_folder(service, f):
    kids = list_children(service, f["id"])
    n_files = sum(1 for k in kids if k["mimeType"] != FOLDER_MIME)
    n_dirs = sum(1 for k in kids if k["mimeType"] == FOLDER_MIME)
    return n_files, n_dirs, kids


def dump(service, name, root_id):
    print(f"\n{'='*70}\n{name}  (id={root_id})\n{'='*70}")
    children = list_children(service, root_id)
    folders = sorted([c for c in children if c["mimeType"] == FOLDER_MIME],
                     key=lambda c: c["name"].lower())
    loose = [c for c in children if c["mimeType"] != FOLDER_MIME]
    for f in folders:
        n_files, n_dirs, kids = describe_folder(service, f)
        # repr exposes leading/trailing whitespace & hidden chars
        print(f"  [DIR] {f['name']!r:50}  id={f['id']}  files={n_files} subdirs={n_dirs}")
        for k in kids:
            tag = "DIR" if k["mimeType"] == FOLDER_MIME else "file"
            print(f"          - ({tag}) {k['name']!r}  id={k['id']}")
    if loose:
        print(f"  -- loose files directly under {name}: {len(loose)}")
        for c in loose:
            print(f"     ({c['name']!r})  id={c['id']}")


def main():
    creds = authenticate()
    service = build("drive", "v3", credentials=creds)
    me = service.about().get(fields="user(emailAddress)").execute()
    print(f"Authenticated as: {me['user']['emailAddress']}")
    dump(service, "04_Logistics", LOGISTICS_ID)
    dump(service, "05_Procurement", PROCUREMENT_ID)


if __name__ == "__main__":
    main()
