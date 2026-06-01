"""
HUS Drive Cleanup — APPLY (merge 4組 + rename 1件)

依頼: 小池 → ナランチャ  2026-05-31
04_Logistics の重複folder 4組を merge、05_Procurement の typo 1件を rename。

安全設計:
  - default は DRY-RUN（一切書き込まない）。--apply で初めて実行。
  - source/dest/typo は「名前」で実行時に再解決（IDのstale化を防ぐ）。
    既知の実IDと不一致なら EXPECTED_IDS assert で停止。
  - 空folderは「ゴミ箱へ移動 (trash)」。完全削除ではないので30日間復元可能。
  - 全操作を manifest CSV に記録 → rollback 可能。

token.json (hokkaidounishop, scope=drive)。

Usage:
    .venv-drive/bin/python3 scripts/cleanup_drive_apply.py            # dry-run
    .venv-drive/bin/python3 scripts/cleanup_drive_apply.py --apply    # 実行
    .venv-drive/bin/python3 scripts/cleanup_drive_apply.py --rollback --manifest scripts/cleanup_manifest.csv
"""

import argparse
import csv
import sys
from datetime import datetime, timezone
from pathlib import Path

from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build

SCOPES = ["https://www.googleapis.com/auth/drive"]
SCRIPT_DIR = Path(__file__).parent
TOKEN_PATH = SCRIPT_DIR / "token.json"
MANIFEST_PATH = SCRIPT_DIR / "cleanup_manifest.csv"
FOLDER_MIME = "application/vnd.google-apps.folder"

LOGISTICS_ID = "1A4pNgMvlNiIVdXfWLQVYbpSLF7DHAePQ"   # HUS/04_Logistics
PROCUREMENT_ID = "1DlKyN-cK_trtFy_NxfTJkef0zMhDq4sM"  # HUS/05_Procurement

# 重複folder merge: source名 → dest名（いずれも 04_Logistics 直下）
MERGES = [
    ("JAPAN AIRLINES INTERNATIONAL CO.,LTD.", "Japan_Airlines_International"),
    ("MSJAPAN_INC",                            "MSJapan"),
    ("YUGA_INTERNATIONAL_LLC",                 "YUGA_International"),
    ("Connect Lab",                            "Connect_Lab"),
]
RENAME = (PROCUREMENT_ID, "Pakcing_List", "Packing_List")  # parent, old, new

# 2026-05-31 verify時点の実ID。再解決結果がこれと食い違えば停止（取り違え防止）。
EXPECTED_IDS = {
    "JAPAN AIRLINES INTERNATIONAL CO.,LTD.": "1sAAjIGv5NjhLH6QanywovrFaOMBRFHt9",
    "Japan_Airlines_International":          "1ktE5nycZBPdePzHr-krqdiLQTfaiJvGX",
    "MSJAPAN_INC":                           "1xGYyJQH6-FlUhQHsuoptZPBEJemRMxKr",
    "MSJapan":                               "15OT1QncwvvZ1aKCmQcQnWLx2xAEGtZXI",
    "YUGA_INTERNATIONAL_LLC":                "1wA0yggbzXtvYxKgUkan_mUY1c0vac7N0",
    "YUGA_International":                     "1CXRBAsHgAO7w95DUoti14gD-YANva8lZ",
    "Connect Lab":                           "1qlC-6Tp71Ts42mLPlOL2hHYUYMRe26Pr",
    "Connect_Lab":                           "19Fg5fr17ceuD3RiLqIVSYRyYXYg1lQHy",
    "Pakcing_List":                          "1IjLJzqJ-B420uveSkbTQUfP5mowpdEJ8",
}


def now():
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def authenticate():
    if not TOKEN_PATH.exists():
        sys.exit(f"ERROR: {TOKEN_PATH} not found.")
    creds = Credentials.from_authorized_user_file(str(TOKEN_PATH), SCOPES)
    if creds.expired and creds.refresh_token:
        from google.auth.transport.requests import Request
        try:
            creds.refresh(Request())
            TOKEN_PATH.write_text(creds.to_json())
        except Exception as e:
            sys.exit(
                f"ERROR: token refresh failed ({e}).\n"
                "→ token.json が失効。再認証が必要:\n"
                "   bash scripts/setup_hus_drive.sh   (ブラウザでOAuth同意)\n"
                "   もしくは hokkaidounishop アカウントで再ログイン。"
            )
    return creds


def list_children(service, folder_id):
    files, page_token = [], None
    while True:
        resp = service.files().list(
            q=f"'{folder_id}' in parents and trashed = false",
            fields="nextPageToken, files(id, name, mimeType)",
            pageSize=200, pageToken=page_token,
        ).execute()
        files.extend(resp.get("files", []))
        page_token = resp.get("nextPageToken")
        if not page_token:
            break
    return files


def find_child_folder(service, parent_id, name):
    """parent直下で name に完全一致する folder を返す（無ければ None、複数なら例外）。"""
    matches = [c for c in list_children(service, parent_id)
               if c["mimeType"] == FOLDER_MIME and c["name"] == name]
    if len(matches) > 1:
        raise RuntimeError(f"AMBIGUOUS: {name!r} が {len(matches)} 個存在")
    return matches[0] if matches else None


def assert_id(name, fid):
    exp = EXPECTED_IDS.get(name)
    if exp and exp != fid:
        sys.exit(f"ABORT: {name!r} の実ID {fid} が verify時点 {exp} と不一致。"
                 "Drive構造が変化した可能性 → 再verify要。")


def cmd_run(args):
    apply = args.apply
    mode = "APPLY" if apply else "DRY-RUN"
    creds = authenticate()
    service = build("drive", "v3", credentials=creds)
    me = service.about().get(fields="user(emailAddress)").execute()["user"]["emailAddress"]
    print(f"[{now()}] mode={mode}  account={me}\n")

    log_rows = []  # manifest rows

    # ---- 4組 merge ----
    for src_name, dst_name in MERGES:
        src = find_child_folder(service, LOGISTICS_ID, src_name)
        dst = find_child_folder(service, LOGISTICS_ID, dst_name)
        if src is None:
            print(f"  SKIP merge: source {src_name!r} 不在（既に処理済み？）")
            continue
        if dst is None:
            print(f"  ABORT merge: dest {dst_name!r} 不在。手動確認要。")
            continue
        assert_id(src_name, src["id"]); assert_id(dst_name, dst["id"])
        kids = list_children(service, src["id"])
        print(f"  MERGE {src_name!r} ({len(kids)} item) → {dst_name!r}")
        for k in kids:
            print(f"      move: {k['name']!r}  ({k['id']})")
            if apply:
                service.files().update(
                    fileId=k["id"], addParents=dst["id"],
                    removeParents=src["id"], fields="id, parents",
                ).execute()
            log_rows.append(["move", k["id"], k["name"], src["id"], dst["id"]])
        # source が空になったら trash
        remaining = list_children(service, src["id"]) if apply else []
        if apply and remaining:
            print(f"      WARN: source なお {len(remaining)} item 残存 → trashせず")
        else:
            print(f"      trash empty folder: {src_name!r} ({src['id']})")
            if apply:
                service.files().update(fileId=src["id"], body={"trashed": True}).execute()
            log_rows.append(["trash_folder", src["id"], src_name, dst["id"], ""])

    # ---- typo rename ----
    parent_id, old_name, new_name = RENAME
    typo = find_child_folder(service, parent_id, old_name)
    collide = find_child_folder(service, parent_id, new_name)
    if typo is None:
        print(f"  SKIP rename: {old_name!r} 不在（既にrename済み？）")
    elif collide is not None:
        print(f"  ABORT rename: {new_name!r} が既に同階層に存在（衝突）。手動マージ要。")
    else:
        assert_id(old_name, typo["id"])
        print(f"  RENAME {old_name!r} → {new_name!r}  ({typo['id']})")
        if apply:
            service.files().update(fileId=typo["id"], body={"name": new_name}).execute()
        log_rows.append(["rename", typo["id"], f"{old_name}→{new_name}", parent_id, ""])

    if apply and log_rows:
        with open(MANIFEST_PATH, "w", newline="") as f:
            w = csv.writer(f)
            w.writerow(["action", "id", "name", "param1", "param2"])
            w.writerows(log_rows)
        print(f"\n[{now()}] manifest 書出: {MANIFEST_PATH}  ({len(log_rows)} 行)")
    print(f"\n[{now()}] {mode} 完了。" + ("" if apply else "  → 実行するには --apply"))


def cmd_rollback(args):
    creds = authenticate()
    service = build("drive", "v3", credentials=creds)
    rows = list(csv.DictReader(open(args.manifest)))
    for r in reversed(rows):
        a = r["action"]
        if a == "move":
            print(f"  rollback move: {r['name']!r} → 元 {r['param1']}")
            service.files().update(fileId=r["id"], addParents=r["param1"],
                                   removeParents=r["param2"], fields="id").execute()
        elif a == "trash_folder":
            print(f"  rollback trash: {r['name']!r} を復元")
            service.files().update(fileId=r["id"], body={"trashed": False}).execute()
        elif a == "rename":
            old = r["name"].split("→")[0]
            print(f"  rollback rename: → {old!r}")
            service.files().update(fileId=r["id"], body={"name": old}).execute()
    print(f"[{now()}] rollback 完了")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--apply", action="store_true", help="実行（既定は dry-run）")
    ap.add_argument("--rollback", action="store_true")
    ap.add_argument("--manifest", default=str(MANIFEST_PATH))
    args = ap.parse_args()
    if args.rollback:
        cmd_rollback(args)
    else:
        cmd_run(args)


if __name__ == "__main__":
    main()
