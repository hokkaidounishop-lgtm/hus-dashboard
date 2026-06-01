"""
All_Invoice_Legacy 整理スクリプト

依頼: 小池(5代目HQ司令塔) — 2026-05-25
設計書: scripts/ORGANIZE_INVOICES_DESIGN.md

3 phase:
    classify   PDF/画像を Claude API で分類 → manifest.csv 生成 (dry-run)
    apply      manifest.csv を読んで Drive 上で move + rename を実行
    rollback   manifest.csv の old_* を使って元に戻す

Usage:
    .venv-drive/bin/python3 scripts/organize_invoices.py classify --root-id <ID> --output scripts/manifest.csv
    .venv-drive/bin/python3 scripts/organize_invoices.py apply    --manifest scripts/manifest.csv
    .venv-drive/bin/python3 scripts/organize_invoices.py rollback --manifest scripts/manifest.csv

Auth:
    scripts/token.json (hokkaidounishop@gmail.com) で Drive API 操作。
    ANTHROPIC_API_KEY 環境変数で Claude API 操作。

Requires (venv):
    pip install -q google-api-python-client google-auth-oauthlib anthropic
"""

import argparse
import base64
import csv
import io
import json
import os
import re
import sys
import time
from pathlib import Path

from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError
from googleapiclient.http import MediaIoBaseDownload

SCOPES = ["https://www.googleapis.com/auth/drive"]
SCRIPT_DIR = Path(__file__).parent
TOKEN_PATH = SCRIPT_DIR / "token.json"
FOLDER_IDS_PATH = SCRIPT_DIR / "hus_drive_folder_ids.json"

FOLDER_MIME = "application/vnd.google-apps.folder"
SUPPORTED_MIME = {"application/pdf", "image/jpeg", "image/jpg", "image/png"}

CLAUDE_MODEL = "claude-haiku-4-5"
MAX_FILE_BYTES = 30 * 1024 * 1024
RATE_LIMIT_SLEEP = 0.5

CLASSIFICATION_PROMPT = """\
あなたは Hokkaido Uni Shop (HUS, Uni Shop LLC) の経理整理担当です。
このファイル(invoice/order/契約書類のいずれか)を読んで、以下の JSON のみを返してください。
他のテキスト、解説、markdownは一切含めない。

{
  "direction": "AR" | "B2C-order" | "AP" | "unknown",
  "vendor_normalized": "<会社名(正規化)>",
  "customer_name": "<AR/B2C-orderの場合の顧客名、それ以外は null>",
  "ap_category": "Marketing" | "資材" | "Legal" | "Food_supplier" | "Goods_supplier" | "Other" | "Logistics" | null,
  "invoice_date": "YYYYMMDD" | null,
  "total_amount": <整数、小数点なし> | null,
  "currency": "USD" | "JPY" | "EUR" | null,
  "status": "Paid" | "Unpaid" | "Pending" | "unknown",
  "doc_type": "invoice" | "credit_application" | "purchase_order" | "receipt" | "other",
  "confidence": <0.0-1.0>,
  "notes": "<判断根拠を簡潔に。罠やリスクがあれば明記>"
}

判定ルール:
- direction:
  - "AR": Bill To が法人顧客(Mikado/Towa等の業務先)、From が HUS。B2B 売上請求。
  - "B2C-order": Hokkaido Uni Shop 発行の Shopify/Stripe order PDF。Bill To が個人/小売(Chef Tony, Old Florida Fish House等)。
  - "AP": Bill To が HUS / Uni Shop / Hokkaido Uni / Uni Shop LLC、From が業者(supplier)。HUS が支払う側。
  - "unknown": 判定不能。

- vendor_normalized: 正規化辞書を優先:
  - "True World Foods" / "TWF" → "TWF"
  - "Fedelity Paper" / "Fidelity Paper" → "Fidelity_Paper"
  - "まどろむ酒器販売" / "相場真紀子" / "Aiba" → "Madoromu_Shuki"
  - "ルフルーヴ" / "川端恵子" / "Kawabata" → "Lefleuv"
  - "econoshift" / "マイク根上" / "Mike Negami" → "econoshift"
  - "Global Ocean Trading" / "Global Ocean" → "Global_Ocean_Trading"
  - "Ocean Providence" → "Ocean_Providence"
  - "FICI Japan" → "FICI"
  - "HappinessTrade" / "ハピネストレード" → "HappinessTrade"
  - "Blue America" → "Blue_America"
  - "UPS" → "UPS"
  - "Nittsu" / "日通" → "Nittsu"
  - direction=AR/B2C-order の場合は vendor_normalized = "HUS" (発行元)

- ap_category:
  - direction=AP の場合のみ設定。AR/B2C-order/unknown は null。
  - 物流(UPS/Nittsu/FedEx等) → "Logistics" (これは category ではなく行き先振り分けのフラグ)
  - 食材・水産・冷凍 → "Food_supplier"
  - 酒器・食器・木製品・周辺販売商品 → "Goods_supplier"
  - 包装・保冷BOX・段ボール・吸水シート → "資材"
  - 弁護士・税理士・登記・法務 → "Legal"
  - 広告・SNS・印刷・PR → "Marketing"
  - IT開発・コンサル・家賃・その他 → "Other"

- confidence: 0.7未満は manual review 候補。

- 罠の注意:
  - ファイル名が "AR_Invoice_XXXX.pdf" でも、本文の Bill To が "Uni Shop" なら direction=AP。
  - 月別フォルダ(202604等)内のファイルは vendor の混在。フォルダ名でなく **本文を見て判定** すること。
"""


def authenticate():
    if not TOKEN_PATH.exists():
        sys.exit(f"ERROR: {TOKEN_PATH} not found. Run setup_hus_drive.sh first.")
    creds = Credentials.from_authorized_user_file(str(TOKEN_PATH), SCOPES)
    if creds.expired and creds.refresh_token:
        from google.auth.transport.requests import Request
        creds.refresh(Request())
        TOKEN_PATH.write_text(creds.to_json())
    return creds


def get_anthropic_client():
    try:
        import anthropic
    except ImportError:
        sys.exit("ERROR: anthropic SDK not installed. Run: pip install anthropic")
    api_key = os.environ.get("ANTHROPIC_API_KEY")
    if not api_key:
        sys.exit("ERROR: ANTHROPIC_API_KEY env var not set.")
    return anthropic.Anthropic(api_key=api_key)


def load_folder_ids():
    if not FOLDER_IDS_PATH.exists():
        sys.exit(f"ERROR: {FOLDER_IDS_PATH} not found. Run setup_hus_drive.sh first.")
    return json.loads(FOLDER_IDS_PATH.read_text())


def list_children(service, folder_id, page_size=200):
    files = []
    page_token = None
    while True:
        resp = service.files().list(
            q=f"'{folder_id}' in parents and trashed = false",
            fields="nextPageToken, files(id, name, mimeType, parents, size, createdTime, modifiedTime)",
            pageSize=page_size,
            pageToken=page_token,
        ).execute()
        files.extend(resp.get("files", []))
        page_token = resp.get("nextPageToken")
        if not page_token:
            break
    return files


def scan_recursive(service, root_id, root_path=""):
    """Walk Drive folder tree. Yields (file_dict, path_str)."""
    children = list_children(service, root_id)
    for child in children:
        path = f"{root_path}/{child['name']}" if root_path else child["name"]
        if child["mimeType"] == FOLDER_MIME:
            yield from scan_recursive(service, child["id"], path)
        else:
            yield child, path


def download_file(service, file_id, max_bytes=MAX_FILE_BYTES):
    request = service.files().get_media(fileId=file_id)
    buf = io.BytesIO()
    downloader = MediaIoBaseDownload(buf, request)
    done = False
    while not done:
        _, done = downloader.next_chunk()
        if buf.tell() > max_bytes:
            return None
    return buf.getvalue()


def classify_with_claude(client, file_bytes, mime_type, file_name):
    if mime_type == "image/jpg":
        mime_type = "image/jpeg"

    if mime_type == "application/pdf":
        content_block = {
            "type": "document",
            "source": {
                "type": "base64",
                "media_type": "application/pdf",
                "data": base64.standard_b64encode(file_bytes).decode(),
            },
        }
    else:
        content_block = {
            "type": "image",
            "source": {
                "type": "base64",
                "media_type": mime_type,
                "data": base64.standard_b64encode(file_bytes).decode(),
            },
        }

    resp = client.messages.create(
        model=CLAUDE_MODEL,
        max_tokens=1024,
        messages=[
            {
                "role": "user",
                "content": [
                    content_block,
                    {"type": "text", "text": CLASSIFICATION_PROMPT + f"\n\nfilename hint: {file_name}"},
                ],
            }
        ],
    )

    text = resp.content[0].text.strip()
    match = re.search(r"\{.*\}", text, re.DOTALL)
    if not match:
        raise ValueError(f"No JSON in response: {text[:200]}")
    return json.loads(match.group(0))


def resolve_new_parent(folder_ids, classification):
    direction = classification.get("direction")
    ap_category = classification.get("ap_category")
    vendor = classification.get("vendor_normalized") or "Unknown"
    customer = classification.get("customer_name")

    if direction == "AR":
        section = folder_ids.get("HUS/03_B2B/Freshline_invoices", {}).get("id")
        leaf_name = customer or "Unknown"
        return section, f"HUS/03_B2B/Freshline_invoices/{leaf_name}", leaf_name
    if direction == "B2C-order":
        section = folder_ids.get("HUS/02_B2C/Shopify_orders", {}).get("id")
        leaf_name = customer or "Unknown"
        return section, f"HUS/02_B2C/Shopify_orders/{leaf_name}", leaf_name
    if direction == "AP":
        if ap_category == "Logistics":
            section = folder_ids.get("HUS/04_Logistics", {}).get("id")
            return section, f"HUS/04_Logistics/{vendor}", vendor
        if ap_category in ("Marketing", "資材", "Legal", "Food_supplier", "Goods_supplier", "Other"):
            section = folder_ids.get(f"HUS/01_Finance/AR_AP/{ap_category}", {}).get("id")
            return section, f"HUS/01_Finance/AR_AP/{ap_category}/{vendor}", vendor

    section = folder_ids.get("HUS/01_Finance/AR_AP/_Manual_Review", {}).get("id")
    return section, "HUS/01_Finance/AR_AP/_Manual_Review", vendor


_safe_chars = re.compile(r"[^A-Za-z0-9_\-]+")


def safe_name_part(s, max_len=40):
    if not s:
        return "X"
    s = _safe_chars.sub("_", s)
    s = s.strip("_")
    return (s[:max_len] or "X")


def build_new_filename(classification, original_name):
    ext = Path(original_name).suffix.lower() or ".pdf"
    date = classification.get("invoice_date") or "00000000"
    vendor = safe_name_part(classification.get("vendor_normalized") or "Unknown", 30)
    doc_type = safe_name_part(classification.get("doc_type") or "doc", 20)
    amount = classification.get("total_amount")
    currency = classification.get("currency") or ""
    amount_part = f"{int(amount)}{currency}" if amount else ""
    parts = [date, vendor, doc_type]
    if amount_part:
        parts.append(amount_part)
    return "_".join(parts) + ext


CSV_FIELDS = [
    "file_id", "old_parent_id", "old_parent_path", "old_name",
    "new_parent_id", "new_parent_path", "new_name",
    "direction", "vendor_normalized", "customer_name", "ap_category",
    "invoice_date", "total_amount", "currency", "status",
    "doc_type", "mime_type", "confidence", "notes", "apply_status",
]


def cmd_classify(args):
    creds = authenticate()
    service = build("drive", "v3", credentials=creds)
    client = get_anthropic_client()
    folder_ids = load_folder_ids()

    root_id = args.root_id
    output_path = Path(args.output)
    skip_unknown_mime = not args.include_unknown_mime
    limit = args.limit

    existing_rows = {}
    if output_path.exists() and args.resume:
        with output_path.open() as f:
            for row in csv.DictReader(f):
                existing_rows[row["file_id"]] = row
        print(f"Resume: {len(existing_rows)} rows already in {output_path}")

    rows = list(existing_rows.values())
    processed = len(rows)
    errors = 0

    print(f"Scanning root: {root_id}")
    files_iter = scan_recursive(service, root_id, root_path=args.root_path or "")
    for file, path in files_iter:
        if limit and processed >= limit:
            print(f"Limit {limit} reached, stopping.")
            break
        if file["id"] in existing_rows:
            continue
        mime = file.get("mimeType", "")
        if mime not in SUPPORTED_MIME:
            if skip_unknown_mime:
                continue

        size = int(file.get("size", 0) or 0)
        if size > MAX_FILE_BYTES:
            rows.append(make_skip_row(file, path, mime, reason=f"file too large: {size} bytes"))
            processed += 1
            continue

        print(f"  [{processed+1}] {path}/{file['name']}", end=" ... ", flush=True)
        try:
            data = download_file(service, file["id"])
            if data is None:
                rows.append(make_skip_row(file, path, mime, reason="download exceeded max bytes"))
                processed += 1
                print("SKIP (too large)")
                continue
            classification = classify_with_claude(client, data, mime, file["name"])
            new_parent_id, new_parent_path, _ = resolve_new_parent(folder_ids, classification)
            new_name = build_new_filename(classification, file["name"])
            parent_id = file.get("parents", [None])[0]
            row = {
                "file_id": file["id"],
                "old_parent_id": parent_id,
                "old_parent_path": path,
                "old_name": file["name"],
                "new_parent_id": new_parent_id or "",
                "new_parent_path": new_parent_path,
                "new_name": new_name,
                "direction": classification.get("direction", ""),
                "vendor_normalized": classification.get("vendor_normalized", ""),
                "customer_name": classification.get("customer_name") or "",
                "ap_category": classification.get("ap_category") or "",
                "invoice_date": classification.get("invoice_date") or "",
                "total_amount": classification.get("total_amount") or "",
                "currency": classification.get("currency") or "",
                "status": classification.get("status", "unknown"),
                "doc_type": classification.get("doc_type", ""),
                "mime_type": mime,
                "confidence": classification.get("confidence", ""),
                "notes": (classification.get("notes") or "")[:200],
                "apply_status": "pending",
            }
            rows.append(row)
            processed += 1
            print(f"OK ({row['direction']}/{row['vendor_normalized']}, conf={row['confidence']})")
        except Exception as e:
            errors += 1
            row = make_skip_row(file, path, mime, reason=f"classify error: {e}")
            rows.append(row)
            processed += 1
            print(f"ERROR: {e}")

        if processed % 10 == 0:
            write_manifest(output_path, rows)
        time.sleep(RATE_LIMIT_SLEEP)

    write_manifest(output_path, rows)
    print(f"\nDone. Processed: {processed}, Errors: {errors}, Output: {output_path}")


def make_skip_row(file, path, mime, reason):
    return {
        "file_id": file["id"],
        "old_parent_id": (file.get("parents") or [""])[0],
        "old_parent_path": path,
        "old_name": file["name"],
        "new_parent_id": "",
        "new_parent_path": "",
        "new_name": "",
        "direction": "unknown",
        "vendor_normalized": "",
        "customer_name": "",
        "ap_category": "",
        "invoice_date": "",
        "total_amount": "",
        "currency": "",
        "status": "unknown",
        "doc_type": "",
        "mime_type": mime,
        "confidence": "",
        "notes": reason[:200],
        "apply_status": "skipped",
    }


def write_manifest(path, rows):
    with path.open("w", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=CSV_FIELDS)
        writer.writeheader()
        for row in rows:
            writer.writerow({k: row.get(k, "") for k in CSV_FIELDS})


def cmd_apply(args):
    creds = authenticate()
    service = build("drive", "v3", credentials=creds)
    manifest_path = Path(args.manifest)
    if not manifest_path.exists():
        sys.exit(f"ERROR: {manifest_path} not found")

    rows = []
    with manifest_path.open() as f:
        for row in csv.DictReader(f):
            rows.append(row)

    pending = [r for r in rows if r.get("apply_status") in ("", "pending")]
    print(f"Total rows: {len(rows)}, pending: {len(pending)}")
    if args.dry_run:
        for r in pending[:20]:
            print(f"  WOULD MOVE: {r['old_parent_path']}/{r['old_name']} -> {r['new_parent_path']}/{r['new_name']}")
        print("Dry-run only. Re-run without --dry-run to apply.")
        return

    folder_cache = {}
    for i, row in enumerate(rows):
        if row.get("apply_status") not in ("", "pending"):
            continue
        if not row.get("new_parent_id"):
            row["apply_status"] = "skipped"
            continue

        parent_key = (row["new_parent_id"], row["vendor_normalized"] or row["customer_name"] or "Unknown")
        leaf_name = parent_key[1] or "Unknown"
        final_parent_id = folder_cache.get(parent_key)
        if final_parent_id is None:
            final_parent_id = ensure_subfolder(service, row["new_parent_id"], leaf_name)
            folder_cache[parent_key] = final_parent_id

        try:
            service.files().update(
                fileId=row["file_id"],
                addParents=final_parent_id,
                removeParents=row["old_parent_id"],
                body={"name": row["new_name"]},
                fields="id, parents, name",
            ).execute()
            row["apply_status"] = "done"
            row["new_parent_id"] = final_parent_id
            print(f"  [{i+1}/{len(rows)}] DONE: {row['new_parent_path']}/{leaf_name}/{row['new_name']}")
        except HttpError as e:
            row["apply_status"] = "error"
            row["notes"] = (row.get("notes", "") + f" | apply err: {e}")[:200]
            print(f"  [{i+1}/{len(rows)}] ERROR: {e}")

        if (i + 1) % 20 == 0:
            write_manifest(manifest_path, rows)

    write_manifest(manifest_path, rows)
    print("Apply complete.")


def ensure_subfolder(service, parent_id, name):
    safe = name.strip() or "Unknown"
    q = f"'{parent_id}' in parents and name = '{safe.replace(chr(39), chr(92)+chr(39))}' and mimeType = '{FOLDER_MIME}' and trashed = false"
    resp = service.files().list(q=q, fields="files(id, name)", pageSize=5).execute()
    files = resp.get("files", [])
    if files:
        return files[0]["id"]
    body = {"name": safe, "mimeType": FOLDER_MIME, "parents": [parent_id]}
    folder = service.files().create(body=body, fields="id").execute()
    return folder["id"]


def cmd_rollback(args):
    creds = authenticate()
    service = build("drive", "v3", credentials=creds)
    manifest_path = Path(args.manifest)
    rows = []
    with manifest_path.open() as f:
        for row in csv.DictReader(f):
            rows.append(row)

    done = [r for r in rows if r.get("apply_status") == "done"]
    print(f"Rollback target: {len(done)} files")
    if not args.confirm:
        for r in done[:20]:
            print(f"  WOULD REVERT: {r['file_id']} -> {r['old_parent_path']}/{r['old_name']}")
        print("Re-run with --confirm to actually rollback.")
        return

    for i, row in enumerate(done):
        try:
            service.files().update(
                fileId=row["file_id"],
                addParents=row["old_parent_id"],
                removeParents=row["new_parent_id"],
                body={"name": row["old_name"]},
                fields="id, parents, name",
            ).execute()
            row["apply_status"] = "rolled_back"
            print(f"  [{i+1}/{len(done)}] REVERTED: {row['old_parent_path']}/{row['old_name']}")
        except HttpError as e:
            print(f"  [{i+1}/{len(done)}] ERROR: {e}")

    write_manifest(manifest_path, rows)
    print("Rollback complete.")


def main():
    parser = argparse.ArgumentParser(description="HUS All_Invoice_Legacy organizer")
    sub = parser.add_subparsers(dest="cmd", required=True)

    p_class = sub.add_parser("classify", help="Scan & classify, produce manifest.csv")
    p_class.add_argument("--root-id", required=True, help="Drive folder ID to scan recursively")
    p_class.add_argument("--root-path", default="", help="Human-readable root path prefix")
    p_class.add_argument("--output", default=str(SCRIPT_DIR / "manifest.csv"))
    p_class.add_argument("--limit", type=int, default=0, help="Max files to process (0 = unlimited)")
    p_class.add_argument("--resume", action="store_true", help="Resume from existing manifest.csv")
    p_class.add_argument("--include-unknown-mime", action="store_true")
    p_class.set_defaults(func=cmd_classify)

    p_apply = sub.add_parser("apply", help="Execute moves/renames per manifest.csv")
    p_apply.add_argument("--manifest", required=True)
    p_apply.add_argument("--dry-run", action="store_true")
    p_apply.set_defaults(func=cmd_apply)

    p_rb = sub.add_parser("rollback", help="Revert moves/renames per manifest.csv")
    p_rb.add_argument("--manifest", required=True)
    p_rb.add_argument("--confirm", action="store_true")
    p_rb.set_defaults(func=cmd_rollback)

    args = parser.parse_args()
    args.func(args)


if __name__ == "__main__":
    main()
