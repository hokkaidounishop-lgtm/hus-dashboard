#!/usr/bin/env python3
"""
cleanup_hus_drive.py
HUS Google Drive cleanup: 重複folder 4組 merge + typo 1件 rename

操作 (依頼書直訳):
  [1] HUS/04_Logistics/ 内 重複folder 4組 merge
    ① JAPAN AIRLINES INTERNATIONAL CO.,LTD./ → Japan_Airlines_International/
    ② MSJAPAN_INC/ → MSJapan/
    ③ YUGA_INTERNATIONAL_LLC/ → YUGA_International/
    ④ Connect Lab/ (空白) → Connect_Lab/ (アンダースコア)
  [2] HUS/05_Procurement/ 内 typo修正
    ⑤ Pakcing_List/ → Packing_List/ rename

操作の意味:
  merge  = source内の全fileをdestへ move (parent変更)
           → source空確認 → source folderをtrashへ送る
  rename = source folderのtitleを新名称に変更

冪等性:
  - source既に存在しない → skip
  - dest既に存在しない → HALT (依頼と状態乖離・人間判断必須)
  - dest内に同名file既存 → "_dup" suffix付けてmove + WARN
  - rename: 既に新名称になっている → skip

安全策:
  - delete = trash (trashed=True)。30日間Drive UI上で復元可能
  - rollback_<timestamp>.json に各move前の親IDを記録
  - dry-run modeで事前計画確認必須

使い方:
  # 0. 事前状態確認 (read-only)
  python cleanup_hus_drive.py inventory --root-id <HUS_ROOT_FOLDER_ID>

  # 1. dry-run (計画のみ、実操作なし)
  python cleanup_hus_drive.py execute --root-id <ID> --dry-run

  # 2. 本実行 (操作あり)
  python cleanup_hus_drive.py execute --root-id <ID>

  # 3. rollback (前回executeの逆操作)
  python cleanup_hus_drive.py rollback --rollback-file rollback_<ts>.json

前提:
  - credentials.json (OAuth2 or Service Account)、scope=drive (full access)
  - HUS Drive root folder への編集権限
  - 既存folder configuration (依頼書記載通り) が実際のDriveと一致

ロールバック制限:
  - 本scriptで trash送りされたfolderは別途UI/API復元が必要 (rollbackで自動復元しない)
  - rollbackはfileのparent戻しのみ実装
"""

import argparse
import json
import logging
import os
import sys
from dataclasses import dataclass, field, asdict
from datetime import datetime, timezone
from typing import Optional

try:
    from google.oauth2.credentials import Credentials
    from google.oauth2.service_account import Credentials as SACredentials
    from google_auth_oauthlib.flow import InstalledAppFlow
    from google.auth.transport.requests import Request
    from googleapiclient.discovery import build
    from googleapiclient.errors import HttpError
except ImportError:
    print(
        "[ERROR] Google API libraries未インストール:\n"
        "  pip install google-api-python-client google-auth-httplib2 "
        "google-auth-oauthlib",
        file=sys.stderr,
    )
    sys.exit(1)


SCOPES = ["https://www.googleapis.com/auth/drive"]
MIME_FOLDER = "application/vnd.google-apps.folder"


# ============================================================
# 操作定義 (依頼書直訳)
# ============================================================
OPERATIONS = [
    {
        "id": "01",
        "type": "merge",
        "parent_path": "04_Logistics",
        "source_name": "JAPAN AIRLINES INTERNATIONAL CO.,LTD.",
        "dest_name": "Japan_Airlines_International",
        "note": "1 file → 7+ file merge target",
    },
    {
        "id": "02",
        "type": "merge",
        "parent_path": "04_Logistics",
        "source_name": "MSJAPAN_INC",
        "dest_name": "MSJapan",
        "note": "1 file → merge target",
    },
    {
        "id": "03",
        "type": "merge",
        "parent_path": "04_Logistics",
        "source_name": "YUGA_INTERNATIONAL_LLC",
        "dest_name": "YUGA_International",
        "note": "2 file → 6+ file merge target",
    },
    {
        "id": "04",
        "type": "merge",
        "parent_path": "04_Logistics",
        "source_name": "Connect Lab",
        "dest_name": "Connect_Lab",
        "note": "1 file (空白含む) → 10+ file (アンダースコア) merge target",
    },
    {
        "id": "05",
        "type": "rename",
        "parent_path": "05_Procurement",
        "source_name": "Pakcing_List",
        "dest_name": "Packing_List",
        "note": "typo修正",
    },
]


# ============================================================
# Logger setup
# ============================================================
def setup_logger(log_file: Optional[str] = None) -> logging.Logger:
    logger = logging.getLogger("hus_cleanup")
    logger.setLevel(logging.INFO)
    fmt = logging.Formatter(
        "%(asctime)s [%(levelname)s] %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S",
    )

    # stdout
    stream = logging.StreamHandler(sys.stdout)
    stream.setFormatter(fmt)
    logger.addHandler(stream)

    # file
    if log_file:
        fh = logging.FileHandler(log_file, encoding="utf-8")
        fh.setFormatter(fmt)
        logger.addHandler(fh)

    return logger


# ============================================================
# Drive API wrapper
# ============================================================
class DriveClient:
    def __init__(self, credentials_path: str, logger: logging.Logger):
        self.logger = logger
        self.service = self._authenticate(credentials_path)

    def _authenticate(self, credentials_path: str):
        if not os.path.exists(credentials_path):
            raise FileNotFoundError(f"credentials not found: {credentials_path}")

        # Service Account → OAuth2 fallback
        try:
            creds = SACredentials.from_service_account_file(
                credentials_path, scopes=SCOPES
            )
            self.logger.info("AUTH: Service Account 認証成功")
            return build("drive", "v3", credentials=creds, cache_discovery=False)
        except (ValueError, KeyError):
            pass

        token_path = os.path.join(os.path.dirname(credentials_path) or ".", "token.json")
        creds = None
        if os.path.exists(token_path):
            creds = Credentials.from_authorized_user_file(token_path, SCOPES)
        if not creds or not creds.valid:
            if creds and creds.expired and creds.refresh_token:
                creds.refresh(Request())
            else:
                flow = InstalledAppFlow.from_client_secrets_file(credentials_path, SCOPES)
                creds = flow.run_local_server(port=0)
            with open(token_path, "w") as f:
                f.write(creds.to_json())
        self.logger.info("AUTH: OAuth2 認証成功")
        return build("drive", "v3", credentials=creds, cache_discovery=False)

    def find_child_folder(self, name: str, parent_id: str) -> Optional[str]:
        """親folder内で名前完全一致する子folderを検索。"""
        escaped = name.replace("\\", "\\\\").replace("'", "\\'")
        query = (
            f"name = '{escaped}' "
            f"and '{parent_id}' in parents "
            f"and mimeType = '{MIME_FOLDER}' "
            f"and trashed = false"
        )
        resp = self.service.files().list(
            q=query,
            spaces="drive",
            fields="files(id, name)",
            pageSize=10,
            supportsAllDrives=True,
            includeItemsFromAllDrives=True,
        ).execute()
        files = resp.get("files", [])
        if not files:
            return None
        if len(files) > 1:
            self.logger.warning(
                f"同名folder複数該当: name='{name}' parent={parent_id} count={len(files)} "
                f"→ 最初のID使用: {files[0]['id']}"
            )
        return files[0]["id"]

    def resolve_path(self, root_id: str, rel_path: str) -> Optional[str]:
        """HUS root基準の相対pathをfolder IDに解決。途中欠落でNone。"""
        parts = [p for p in rel_path.split("/") if p]
        current = root_id
        for part in parts:
            child = self.find_child_folder(part, current)
            if not child:
                return None
            current = child
        return current

    def list_children(self, folder_id: str) -> list:
        """folder内の全item (file + sub-folder)、trashed除く"""
        items = []
        page_token = None
        while True:
            resp = self.service.files().list(
                q=f"'{folder_id}' in parents and trashed = false",
                spaces="drive",
                fields="nextPageToken, files(id, name, mimeType, parents)",
                pageSize=100,
                pageToken=page_token,
                supportsAllDrives=True,
                includeItemsFromAllDrives=True,
            ).execute()
            items.extend(resp.get("files", []))
            page_token = resp.get("nextPageToken")
            if not page_token:
                break
        return items

    def move_file(self, file_id: str, src_parent: str, dest_parent: str, dry_run: bool):
        """fileのparent差し替え"""
        if dry_run:
            return
        self.service.files().update(
            fileId=file_id,
            addParents=dest_parent,
            removeParents=src_parent,
            fields="id, parents",
            supportsAllDrives=True,
        ).execute()

    def rename_folder(self, folder_id: str, new_name: str, dry_run: bool):
        if dry_run:
            return
        self.service.files().update(
            fileId=folder_id,
            body={"name": new_name},
            fields="id, name",
            supportsAllDrives=True,
        ).execute()

    def trash_folder(self, folder_id: str, dry_run: bool):
        """空folderをtrashへ送る (完全削除はしない)"""
        if dry_run:
            return
        self.service.files().update(
            fileId=folder_id,
            body={"trashed": True},
            fields="id, trashed",
            supportsAllDrives=True,
        ).execute()


# ============================================================
# Operation result
# ============================================================
@dataclass
class OpResult:
    op_id: str
    op_type: str
    status: str  # "success" / "skipped" / "halted" / "error"
    detail: str = ""
    moved_files: list = field(default_factory=list)  # for rollback
    # moved_files item: {"file_id": str, "name": str, "src_parent": str, "dest_parent": str}
    renamed: dict = field(default_factory=dict)
    # renamed: {"folder_id": str, "old_name": str, "new_name": str}


# ============================================================
# Operation executors
# ============================================================
class CleanupRunner:
    def __init__(
        self,
        drive: DriveClient,
        root_id: str,
        logger: logging.Logger,
        dry_run: bool = True,
    ):
        self.drive = drive
        self.root_id = root_id
        self.logger = logger
        self.dry_run = dry_run

    def execute_all(self, operations: list) -> list:
        results = []
        mode = "DRY-RUN" if self.dry_run else "EXECUTE"
        self.logger.info(f"========== {mode} mode 開始 ==========")
        for op in operations:
            self.logger.info(
                f"--- Operation {op['id']} ({op['type']}): "
                f"{op['source_name']} → {op['dest_name']} ({op['note']}) ---"
            )
            try:
                if op["type"] == "merge":
                    r = self.exec_merge(op)
                elif op["type"] == "rename":
                    r = self.exec_rename(op)
                else:
                    r = OpResult(op["id"], op["type"], "error", f"unknown type: {op['type']}")
            except HttpError as e:
                r = OpResult(op["id"], op["type"], "error", f"HttpError: {e}")
                self.logger.error(f"Op {op['id']} HttpError: {e}")
            except Exception as e:
                r = OpResult(op["id"], op["type"], "error", f"Exception: {e}")
                self.logger.error(f"Op {op['id']} Exception: {e}")
            results.append(r)
            self.logger.info(f"--- Op {op['id']} 結果: {r.status} ({r.detail}) ---\n")
        return results

    def exec_merge(self, op: dict) -> OpResult:
        parent_id = self.drive.resolve_path(self.root_id, op["parent_path"])
        if not parent_id:
            return OpResult(op["id"], "merge", "halted", f"parent_path未解決: {op['parent_path']}")

        src_id = self.drive.find_child_folder(op["source_name"], parent_id)
        dest_id = self.drive.find_child_folder(op["dest_name"], parent_id)

        # source不在 = 既にclean済 → skip
        if not src_id:
            return OpResult(op["id"], "merge", "skipped", f"source不在 (既にclean済の可能性): {op['source_name']}")

        # dest不在 = 依頼と状態乖離 → HALT
        if not dest_id:
            return OpResult(op["id"], "merge", "halted", f"dest不在・人間判断必須: {op['dest_name']}")

        if src_id == dest_id:
            return OpResult(op["id"], "merge", "halted", "src == dest (同一folder)")

        # source内のfile列挙
        src_children = self.drive.list_children(src_id)
        self.logger.info(f"  source内 item数: {len(src_children)}")

        if not src_children:
            # 空 → folderだけtrash
            self.logger.info(f"  source空 → そのままtrash送り: src_id={src_id}")
            self.drive.trash_folder(src_id, self.dry_run)
            return OpResult(op["id"], "merge", "success", "source既に空、trashのみ実施")

        # dest内のfile名一覧 (重複検出用)
        dest_children = self.drive.list_children(dest_id)
        dest_names = {c["name"] for c in dest_children}

        result = OpResult(op["id"], "merge", "success", "")
        for child in src_children:
            name = child["name"]
            file_id = child["id"]
            new_name = name
            if name in dest_names:
                base, ext = os.path.splitext(name)
                new_name = f"{base}_dup{ext}"
                self.logger.warning(
                    f"  dest内に同名既存・suffix付与: '{name}' → '{new_name}'"
                )
                # rename file before move
                if not self.dry_run:
                    self.drive.service.files().update(
                        fileId=file_id, body={"name": new_name}, fields="id, name",
                        supportsAllDrives=True,
                    ).execute()

            self.logger.info(f"  MOVE: '{name}' ({file_id})  {src_id} → {dest_id}")
            self.drive.move_file(file_id, src_id, dest_id, self.dry_run)
            result.moved_files.append({
                "file_id": file_id,
                "name": new_name,
                "original_name": name,
                "src_parent": src_id,
                "dest_parent": dest_id,
            })

        # 空確認 (dry-runではsource内fileが残っているように見えるためskip)
        if not self.dry_run:
            remaining = self.drive.list_children(src_id)
            if remaining:
                result.status = "halted"
                result.detail = f"merge後source非空 ({len(remaining)} items残存)、削除中止"
                self.logger.error(f"  HALT: {result.detail}")
                return result

        self.logger.info(f"  TRASH: source folder '{op['source_name']}' (id={src_id})")
        self.drive.trash_folder(src_id, self.dry_run)
        result.detail = f"{len(src_children)} files merged, source trashed"
        return result

    def exec_rename(self, op: dict) -> OpResult:
        parent_id = self.drive.resolve_path(self.root_id, op["parent_path"])
        if not parent_id:
            return OpResult(op["id"], "rename", "halted", f"parent_path未解決: {op['parent_path']}")

        # 既にrename済 (新名称が存在)
        new_id = self.drive.find_child_folder(op["dest_name"], parent_id)
        old_id = self.drive.find_child_folder(op["source_name"], parent_id)

        if new_id and not old_id:
            return OpResult(op["id"], "rename", "skipped", "既に新名称・rename済")
        if new_id and old_id:
            return OpResult(
                op["id"], "rename", "halted",
                f"両名称存在: old={old_id}, new={new_id} → 手動判断必須"
            )
        if not old_id:
            return OpResult(op["id"], "rename", "halted", f"source不在: {op['source_name']}")

        self.logger.info(f"  RENAME: '{op['source_name']}' (id={old_id}) → '{op['dest_name']}'")
        self.drive.rename_folder(old_id, op["dest_name"], self.dry_run)
        return OpResult(
            op["id"], "rename", "success",
            f"rename完了: {op['source_name']} → {op['dest_name']}",
            renamed={"folder_id": old_id, "old_name": op["source_name"], "new_name": op["dest_name"]},
        )


# ============================================================
# Inventory (read-only事前確認)
# ============================================================
def run_inventory(drive: DriveClient, root_id: str, logger: logging.Logger):
    logger.info("========== INVENTORY (read-only) ==========")
    for op in OPERATIONS:
        parent_id = drive.resolve_path(root_id, op["parent_path"])
        if not parent_id:
            logger.error(f"Op {op['id']}: parent_path未解決 {op['parent_path']}")
            continue
        src_id = drive.find_child_folder(op["source_name"], parent_id)
        dest_id = drive.find_child_folder(op["dest_name"], parent_id)
        src_count = len(drive.list_children(src_id)) if src_id else "N/A"
        dest_count = len(drive.list_children(dest_id)) if dest_id else "N/A"
        logger.info(
            f"Op {op['id']} ({op['type']}) "
            f"src='{op['source_name']}' (id={src_id or 'NOT_FOUND'}, files={src_count}) "
            f"dest='{op['dest_name']}' (id={dest_id or 'NOT_FOUND'}, files={dest_count})"
        )


# ============================================================
# Rollback
# ============================================================
def run_rollback(drive: DriveClient, rollback_file: str, logger: logging.Logger, dry_run: bool):
    with open(rollback_file) as f:
        data = json.load(f)
    logger.info(f"========== ROLLBACK ({'DRY-RUN' if dry_run else 'EXECUTE'}) ==========")
    logger.info(f"rollback対象: {rollback_file}")

    for result in data.get("results", []):
        if result["op_type"] != "merge":
            continue  # rename rollbackは別途実装
        for mf in result.get("moved_files", []):
            logger.info(
                f"REVERT MOVE: file_id={mf['file_id']} "
                f"{mf['dest_parent']} → {mf['src_parent']}"
            )
            try:
                drive.move_file(mf["file_id"], mf["dest_parent"], mf["src_parent"], dry_run)
            except HttpError as e:
                logger.error(f"  REVERT失敗: {e}")
    logger.warning("注意: source folder自体のtrash復元は本scriptでは未対応。Drive UIで手動復元。")


# ============================================================
# main
# ============================================================
def main():
    ts = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")

    parser = argparse.ArgumentParser(description="HUS Drive cleanup (冪等)")
    sub = parser.add_subparsers(dest="command", required=True)

    p_inv = sub.add_parser("inventory", help="read-only事前確認")
    p_inv.add_argument("--root-id", default=os.environ.get("HUS_ROOT_FOLDER_ID"), required=False)
    p_inv.add_argument("--credentials", default=os.environ.get("HUS_CREDENTIALS_PATH", "credentials.json"))

    p_exec = sub.add_parser("execute", help="cleanup実行")
    p_exec.add_argument("--root-id", default=os.environ.get("HUS_ROOT_FOLDER_ID"), required=False)
    p_exec.add_argument("--credentials", default=os.environ.get("HUS_CREDENTIALS_PATH", "credentials.json"))
    p_exec.add_argument("--dry-run", action="store_true", help="計画のみ表示、操作なし")

    p_rb = sub.add_parser("rollback", help="前回executeの逆操作")
    p_rb.add_argument("--rollback-file", required=True)
    p_rb.add_argument("--credentials", default=os.environ.get("HUS_CREDENTIALS_PATH", "credentials.json"))
    p_rb.add_argument("--dry-run", action="store_true")

    args = parser.parse_args()

    log_file = f"cleanup_hus_drive_{args.command}_{ts}.log"
    logger = setup_logger(log_file)
    logger.info(f"log file: {log_file}")

    try:
        drive = DriveClient(args.credentials, logger)
    except FileNotFoundError as e:
        logger.error(str(e))
        sys.exit(3)

    if args.command == "inventory":
        if not args.root_id:
            logger.error("--root-id or env HUS_ROOT_FOLDER_ID 必須")
            sys.exit(2)
        run_inventory(drive, args.root_id, logger)
        sys.exit(0)

    if args.command == "execute":
        if not args.root_id:
            logger.error("--root-id or env HUS_ROOT_FOLDER_ID 必須")
            sys.exit(2)
        runner = CleanupRunner(drive, args.root_id, logger, dry_run=args.dry_run)
        results = runner.execute_all(OPERATIONS)

        # rollback情報出力 (本実行のみ)
        if not args.dry_run:
            rb_file = f"rollback_{ts}.json"
            with open(rb_file, "w", encoding="utf-8") as f:
                json.dump({
                    "timestamp": ts,
                    "root_id": args.root_id,
                    "results": [asdict(r) for r in results],
                }, f, ensure_ascii=False, indent=2)
            logger.info(f"rollback情報出力: {rb_file}")

        # summary
        success = sum(1 for r in results if r.status == "success")
        skipped = sum(1 for r in results if r.status == "skipped")
        halted = sum(1 for r in results if r.status == "halted")
        errors = sum(1 for r in results if r.status == "error")
        logger.info("========== 実行サマリ ==========")
        logger.info(f"  成功:  {success}")
        logger.info(f"  skip:  {skipped}")
        logger.info(f"  halt:  {halted}")
        logger.info(f"  error: {errors}")
        for r in results:
            logger.info(f"  Op {r.op_id} ({r.op_type}): {r.status} - {r.detail}")

        sys.exit(0 if (halted == 0 and errors == 0) else 5)

    if args.command == "rollback":
        run_rollback(drive, args.rollback_file, logger, dry_run=args.dry_run)
        sys.exit(0)


if __name__ == "__main__":
    main()
