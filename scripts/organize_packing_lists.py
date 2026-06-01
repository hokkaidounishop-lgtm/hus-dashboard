"""
GOT Packing List 整理スクリプト

依頼: 小池(5代目HQ司令塔) — 2026-05-26
設計書: scripts/ORGANIZE_PACKING_LISTS_DESIGN.md

3 phase:
    classify   PDF/画像を Claude API で分類 → packing_manifest.csv 生成 (dry-run)
    apply      packing_manifest.csv を読んで Drive 上で move + rename を実行
    rollback   packing_manifest.csv の old_* を使って元に戻す

Usage:
    .venv-drive/bin/python3 scripts/organize_packing_lists.py classify --root-id <ID> --output scripts/packing_manifest.csv
    .venv-drive/bin/python3 scripts/organize_packing_lists.py apply    --manifest scripts/packing_manifest.csv
    .venv-drive/bin/python3 scripts/organize_packing_lists.py rollback --manifest scripts/packing_manifest.csv

Auth:
    scripts/token.json (hokkaidounishop@gmail.com) で Drive API 操作。
    ANTHROPIC_API_KEY 環境変数で Claude API 操作。
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
MIME_PDF = "application/pdf"
MIME_XLSX = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
MIME_DOCX = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
MIME_IMAGES = {"image/jpeg", "image/jpg", "image/png"}
SUPPORTED_MIME = {MIME_PDF, MIME_XLSX, MIME_DOCX} | MIME_IMAGES

CLAUDE_MODEL = "claude-haiku-4-5"
MAX_FILE_BYTES = 30 * 1024 * 1024
RATE_LIMIT_SLEEP = 0.5

VALID_ORIGINS = {"New_York", "North_Carolina", "San_Jose", "Seattle", "Tampa", "LAX"}

AIRPORT_TO_ORIGIN = {
    "LAX": "LAX",
    "JFK": "New_York", "LGA": "New_York", "EWR": "New_York", "NY": "New_York",
    "TPA": "Tampa",
    "CLT": "North_Carolina", "RDU": "North_Carolina",
    "SEA": "Seattle", "SEATAC": "Seattle",
    "SJC": "San_Jose", "SFO": "San_Jose",
}

CLASSIFICATION_PROMPT = """\
あなたは Hokkaido Uni Shop (HUS, Uni Shop LLC) の調達 (Procurement) 整理担当です。
このファイルは Packing List / Bill of Lading / Shipping Label のいずれかです。
内容を読んで、以下の JSON のみを返してください。他のテキスト、解説、markdownは一切含めない。

{
  "origin": "New_York" | "North_Carolina" | "San_Jose" | "Seattle" | "Tampa" | "unknown",
  "vendor_name": "<出荷業者名(正規化)>",
  "ship_date": "YYYYMMDD" | null,
  "total_amount": <整数、小数点なし> | null,
  "currency": "USD" | "JPY" | "BOX" | "LBS" | null,
  "product_summary": "<主要商品名を簡潔に。例: Uni, Salmon, Hotate, 混載>",
  "doc_type": "packing_list" | "bill_of_lading" | "shipping_label" | "other",
  "confidence": <0.0-1.0>,
  "notes": "<判断根拠を簡潔に。罠やリスクがあれば明記>"
}

判定ルール:
- origin (最重要):
  - 必ず "Ship From" / "Origin" / "Pickup Location" / "FOB" / "shipping origin" を最優先で参照する。
  - "Bill To" / "Ship To" は受取人 (HUS) なので origin 判定に **使わない**。
  - 都市・州・空港コードを下記 5 産地にマップ:
    * "New_York": New York, NY, JFK, LGA, Newark NJ, Brooklyn, Queens
    * "North_Carolina": North Carolina, NC, Charlotte, Raleigh, Wilmington, RDU
    * "San_Jose": San Jose, CA San Jose, SJC, Silicon Valley
    * "Seattle": Seattle, WA, SEA, Tacoma, Pike Place, SeaTac
    * "Tampa": Tampa, FL Tampa, TPA, St. Petersburg
  - 上記 5 都市にマップできない or 複数候補 or 抽出不能 → "unknown" (confidence < 0.5)
  - 複数 origin が記載されている場合 → notes に詳細記録、confidence を下げる

- vendor_name: 正規化辞書を優先:
  - "True World Foods" / "TWF" → "TWF"
  - "Global Ocean Trading" / "Global Ocean" → "Global_Ocean_Trading"
  - "Ocean Providence" → "Ocean_Providence"
  - "FICI Japan" → "FICI"
  - "Blue America" → "Blue_America"
  - "ルフルーヴ" / "Lefleuv" → "Lefleuv"
  - その他は会社名をスネークケースで正規化 (空白→_、特殊文字除去)
  - 判定不能なら "Unknown"

- total_amount / currency:
  - USD金額を最優先 (例: 3450 / "USD")
  - USD金額が読み取れない場合は箱数 (例: 120 / "BOX") や lbs (例: 45 / "LBS") を採用
  - 全て不明なら null / null

- ship_date: YYYYMMDD 形式。"Ship Date" / "Date" / "Pickup Date" の優先順。なければ null。

- product_summary: Uni, Salmon, Hotate, Wagyu, 混載 など主要商品を簡潔に。

- confidence: 0.7未満は manual review 候補。
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
        sys.exit(f"ERROR: {FOLDER_IDS_PATH} not found. Run setup_hus_drive.py first.")
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


_b2b_vendor_norm = {
    "hestia rooftop": "Hestia_Rooftop",
    "omakase by primefish": "Omakase_By_Primefish",
    "kappo en": "Kappo_En",
}


def normalize_b2b_vendor(raw):
    s = raw.strip().lower()
    if s in _b2b_vendor_norm:
        return _b2b_vendor_norm[s]
    return _safe_chars.sub("_", raw.strip()).strip("_") or "Unknown"


def classify_by_filename(file_name, mime_type, created_time):
    """Try to classify purely from filename. Returns classification dict or None."""
    name = file_name

    # Pattern: docx 'YYYYMMDD_Packing List <vendor>.docx' → B2B customer order
    if mime_type == MIME_DOCX:
        m = re.match(r"^(\d{8})_Packing\s+List\s+(.+?)\.docx$", name, re.IGNORECASE)
        if m:
            date, vendor_raw = m.group(1), m.group(2)
            return {
                "origin": "B2B_CUSTOMER",
                "vendor_name": normalize_b2b_vendor(vendor_raw),
                "ship_date": date,
                "total_amount": None,
                "currency": None,
                "product_summary": "",
                "doc_type": "packing_list",
                "confidence": 0.95,
                "notes": f"B2B customer packing list (docx filename parse). raw_vendor='{vendor_raw}'",
            }

    # Pattern: 'YYYY MM DD Uni Shop <L|N> Packing Sheet.xlsx' (L=LAX, N=New_York)
    m = re.search(
        r"(\d{4})\s+(\d{1,2})\s+(\d{1,2})\s+Uni\s*shop\s+([LN])\s+Packing\s+Sheet",
        name, re.IGNORECASE,
    )
    if m:
        year, month, day, code = m.groups()
        origin = "LAX" if code.upper() == "L" else "New_York"
        return {
            "origin": origin,
            "vendor_name": "Unishop_LLC",
            "ship_date": f"{year}{int(month):02d}{int(day):02d}",
            "total_amount": None,
            "currency": None,
            "product_summary": "",
            "doc_type": "packing_list",
            "confidence": 0.95,
            "notes": f"xlsx filename parse: '{code}' → {origin}",
        }

    # Pattern: 'Uni Shop LAX Packing sheet M.D.YY.xlsx' or 'Unishop LAX Packing sheet M.D.YY.xlsx'
    m = re.search(
        r"Uni\s*shop\s+(LAX|JFK|TPA|SEA|SJC|CLT|RDU|NY|LGA|EWR)\s+Packing\s+sheet\s+(\d{1,2})\.(\d{1,2})\.(\d{2,4})",
        name, re.IGNORECASE,
    )
    if m:
        code, month, day, year = m.groups()
        origin = AIRPORT_TO_ORIGIN.get(code.upper(), "unknown")
        full_year = f"20{year}" if len(year) == 2 else year
        return {
            "origin": origin,
            "vendor_name": "Unishop_LLC",
            "ship_date": f"{full_year}{int(month):02d}{int(day):02d}",
            "total_amount": None,
            "currency": None,
            "product_summary": "",
            "doc_type": "packing_list",
            "confidence": 0.95,
            "notes": f"xlsx filename parse: code={code}",
        }

    # Pattern: 'Uni Shop LAX 5.2.26 (1).xlsx' — no "Packing sheet" word
    m = re.search(
        r"Uni\s*shop\s+(LAX|JFK|TPA|SEA|SJC|CLT|RDU|NY|LGA|EWR)\s+(\d{1,2})\.(\d{1,2})\.(\d{2,4})",
        name, re.IGNORECASE,
    )
    if m:
        code, month, day, year = m.groups()
        origin = AIRPORT_TO_ORIGIN.get(code.upper(), "unknown")
        full_year = f"20{year}" if len(year) == 2 else year
        return {
            "origin": origin,
            "vendor_name": "Unishop_LLC",
            "ship_date": f"{full_year}{int(month):02d}{int(day):02d}",
            "total_amount": None,
            "currency": None,
            "product_summary": "",
            "doc_type": "packing_list",
            "confidence": 0.9,
            "notes": f"xlsx filename parse (no 'Packing sheet' word): code={code}",
        }

    # Pattern: PDF AWB (Air Way Bill) — 'MMDD AWB CLT(GOT).pdf' or 'AWB GOT CLT MMDD.pdf'
    if mime_type == MIME_PDF:
        m_air = re.search(r"AWB[^\w]*(?:[A-Z]{3}[^\w]+)?(CLT|TPA|JFK|SEA|LAX|SJC|RDU|LGA|EWR)", name, re.IGNORECASE)
        if m_air:
            code = m_air.group(1).upper()
            origin = AIRPORT_TO_ORIGIN.get(code, "unknown")
            # Date extraction: prefer MMDD at start, fallback to MMDD in name
            date = None
            m_d1 = re.match(r"^(\d{4})\s+AWB", name)
            m_d2 = re.search(r"AWB\s+[A-Z]+\s+[A-Z]+\s+(\d{4})", name)
            mmdd = (m_d1 or m_d2)
            if mmdd:
                year = (created_time or "0000")[:4]
                date = f"{year}{mmdd.group(1)}"
            # Vendor: (GOT) → Global_Ocean_Trading
            vendor = "Global_Ocean_Trading" if "GOT" in name.upper() else "Unknown"
            # Customer in parens (if not GOT)
            m_cust = re.search(r"\(([^)]+)\)", name)
            customer = ""
            if m_cust and m_cust.group(1).upper() != "GOT":
                customer = m_cust.group(1)
            return {
                "origin": origin,
                "vendor_name": vendor,
                "ship_date": date,
                "total_amount": None,
                "currency": None,
                "product_summary": (customer[:80] if customer else ""),
                "doc_type": "bill_of_lading",
                "confidence": 0.88,
                "notes": f"AWB filename parse: airport={code}" + (f", customer={customer}" if customer else ""),
            }

    return None


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
    origin = classification.get("origin") or "unknown"
    vendor = classification.get("vendor_name") or "Unknown"

    if origin == "B2B_CUSTOMER":
        section = folder_ids.get("HUS/03_B2B/Customer_orders", {}).get("id")
        return section, f"HUS/03_B2B/Customer_orders/{vendor}"

    if origin in VALID_ORIGINS:
        path_key = f"HUS/05_Procurement/Packing_List/{origin}"
        section = folder_ids.get(path_key, {}).get("id")
        return section, path_key

    section = folder_ids.get("HUS/05_Procurement/Packing_List/_Manual_Review", {}).get("id")
    return section, "HUS/05_Procurement/Packing_List/_Manual_Review"


_safe_chars = re.compile(r"[^A-Za-z0-9_\-]+")


def safe_name_part(s, max_len=40):
    if not s:
        return "X"
    s = _safe_chars.sub("_", s)
    s = s.strip("_")
    return (s[:max_len] or "X")


def build_new_filename(classification, original_name):
    ext = Path(original_name).suffix.lower() or ".pdf"
    date = classification.get("ship_date") or "00000000"
    vendor = safe_name_part(classification.get("vendor_name") or "Unknown", 30)
    origin_raw = classification.get("origin") or "unknown"
    amount = classification.get("total_amount")
    currency = classification.get("currency") or ""
    amount_part = f"{int(amount)}{currency}" if amount else ""

    if origin_raw == "B2B_CUSTOMER":
        # B2B: YYYYMMDD_<customer>_packing_list.docx
        parts = [date, vendor, "packing_list"]
    else:
        origin = safe_name_part(origin_raw, 20)
        parts = [date, vendor, origin]
    if amount_part:
        parts.append(amount_part)
    return "_".join(parts) + ext


CSV_FIELDS = [
    "file_id", "old_parent_id", "old_parent_path", "old_name",
    "new_parent_id", "new_parent_path", "new_name",
    "origin", "vendor_name", "ship_date", "total_amount", "currency",
    "product_summary", "doc_type", "mime_type", "confidence",
    "classify_method", "notes", "apply_status",
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
            # Try filename parse first (no API cost, no download)
            classification = classify_by_filename(file["name"], mime, file.get("createdTime"))
            classify_method = "filename"

            if classification is None:
                if mime == MIME_PDF or mime in MIME_IMAGES:
                    # Fallback to Claude API for PDFs / images
                    data = download_file(service, file["id"])
                    if data is None:
                        rows.append(make_skip_row(file, path, mime, reason="download exceeded max bytes"))
                        processed += 1
                        print("SKIP (too large)")
                        continue
                    classification = classify_with_claude(client, data, mime, file["name"])
                    classify_method = "claude"
                else:
                    # xlsx/docx without filename pattern → Manual Review
                    classification = {
                        "origin": "unknown",
                        "vendor_name": "Unknown",
                        "ship_date": None,
                        "total_amount": None,
                        "currency": None,
                        "product_summary": "",
                        "doc_type": "other",
                        "confidence": 0.3,
                        "notes": "xlsx/docx with no recognizable filename pattern",
                    }
                    classify_method = "fallback"

            new_parent_id, new_parent_path = resolve_new_parent(folder_ids, classification)
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
                "origin": classification.get("origin", "unknown"),
                "vendor_name": classification.get("vendor_name", ""),
                "ship_date": classification.get("ship_date") or "",
                "total_amount": classification.get("total_amount") or "",
                "currency": classification.get("currency") or "",
                "product_summary": (classification.get("product_summary") or "")[:100],
                "doc_type": classification.get("doc_type", ""),
                "mime_type": mime,
                "confidence": classification.get("confidence", ""),
                "classify_method": classify_method,
                "notes": (classification.get("notes") or "")[:200],
                "apply_status": "pending",
            }
            rows.append(row)
            processed += 1
            print(f"OK [{classify_method}] ({row['origin']}/{row['vendor_name']}, conf={row['confidence']})")
        except Exception as e:
            errors += 1
            row = make_skip_row(file, path, mime, reason=f"classify error: {e}")
            rows.append(row)
            processed += 1
            print(f"ERROR: {e}")

        if processed % 10 == 0:
            write_manifest(output_path, rows)
        # Only sleep when we hit the Claude API to be polite to rate limits.
        if classify_method == "claude":
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
        "origin": "unknown",
        "vendor_name": "",
        "ship_date": "",
        "total_amount": "",
        "currency": "",
        "product_summary": "",
        "doc_type": "",
        "mime_type": mime,
        "confidence": "",
        "classify_method": "skip",
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

        # B2B Customer_orders requires per-vendor subfolder
        target_parent_id = row["new_parent_id"]
        if row.get("origin") == "B2B_CUSTOMER" and row.get("vendor_name"):
            cache_key = ("b2b", row["new_parent_id"], row["vendor_name"])
            if cache_key not in folder_cache:
                folder_cache[cache_key] = ensure_subfolder(service, row["new_parent_id"], row["vendor_name"])
            target_parent_id = folder_cache[cache_key]

        try:
            service.files().update(
                fileId=row["file_id"],
                addParents=target_parent_id,
                removeParents=row["old_parent_id"],
                body={"name": row["new_name"]},
                fields="id, parents, name",
            ).execute()
            row["apply_status"] = "done"
            row["new_parent_id"] = target_parent_id
            print(f"  [{i+1}/{len(rows)}] DONE: {row['new_parent_path']}/{row['new_name']}")
        except HttpError as e:
            row["apply_status"] = "error"
            row["notes"] = (row.get("notes", "") + f" | apply err: {e}")[:200]
            print(f"  [{i+1}/{len(rows)}] ERROR: {e}")

        if (i + 1) % 20 == 0:
            write_manifest(manifest_path, rows)

    write_manifest(manifest_path, rows)
    print("Apply complete.")


def ensure_subfolder(service, parent_id, name):
    safe = (name or "Unknown").strip() or "Unknown"
    q = (
        f"'{parent_id}' in parents and name = '{safe.replace(chr(39), chr(92)+chr(39))}' "
        f"and mimeType = '{FOLDER_MIME}' and trashed = false"
    )
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
    parser = argparse.ArgumentParser(description="HUS GOT Packing List organizer")
    sub = parser.add_subparsers(dest="cmd", required=True)

    p_class = sub.add_parser("classify", help="Scan & classify, produce packing_manifest.csv")
    p_class.add_argument("--root-id", required=True, help="Drive folder ID to scan recursively")
    p_class.add_argument("--root-path", default="", help="Human-readable root path prefix")
    p_class.add_argument("--output", default=str(SCRIPT_DIR / "packing_manifest.csv"))
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
