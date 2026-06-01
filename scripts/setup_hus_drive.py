"""
HUS Google Drive folder structure setup — Tad AI System Phase 0

Usage:
    python3 scripts/setup_hus_drive.py

Requires:
    - credentials.json (OAuth 2.0 Client ID, type=Desktop) placed in scripts/
    - pip install google-api-python-client google-auth-oauthlib

Idempotent: re-running skips existing folders, only creates missing ones.
Outputs: scripts/hus_drive_folder_ids.json (folder name -> Drive ID map)
"""

import json
import os
import sys
from pathlib import Path

from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import InstalledAppFlow
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError

SCOPES = ["https://www.googleapis.com/auth/drive"]
SCRIPT_DIR = Path(__file__).parent
CREDENTIALS_PATH = SCRIPT_DIR / "credentials.json"
TOKEN_PATH = SCRIPT_DIR / "token.json"
OUTPUT_PATH = SCRIPT_DIR / "hus_drive_folder_ids.json"

STRUCTURE = {
    "HUS": {
        "01_Finance": ["PL_BS", "AR_AP", "Reconciliation"],
        "02_B2C": ["Shopify_orders", "Customer_data", "Mailchimp_export"],
        "03_B2B": ["Freshline_invoices", "Customer_orders", "AR_pipeline"],
        "04_Logistics": ["ShipFare", "UPS", "Shopify_shipping"],
        "05_Procurement": ["Takeda", "FICI", "GOT", "Other"],
        "06_Strategy": ["Business_plan", "KPI_reports", "Investor_materials"],
        "07_Legal": ["Contracts", "Regulations", "Tax"],
        "08_AI_System": ["Onboarding_docs", "Methodology", "Vision"],
    }
}

AR_AP_SUBFOLDERS = [
    "Marketing",
    "資材",
    "Legal",
    "Food_supplier",
    "Goods_supplier",
    "Other",
    "_Manual_Review",
]

LOGISTICS_SUBFOLDERS = ["Nittsu"]

PACKING_LIST_ORIGINS = [
    "New_York",
    "North_Carolina",
    "San_Jose",
    "Seattle",
    "Tampa",
    "LAX",
]

FOLDER_MIME = "application/vnd.google-apps.folder"


def authenticate():
    creds = None
    if TOKEN_PATH.exists():
        creds = Credentials.from_authorized_user_file(str(TOKEN_PATH), SCOPES)
    if not creds or not creds.valid:
        if creds and creds.expired and creds.refresh_token:
            creds.refresh(Request())
        else:
            if not CREDENTIALS_PATH.exists():
                sys.exit(
                    f"ERROR: {CREDENTIALS_PATH} not found.\n"
                    "Create OAuth 2.0 Client ID (Desktop app) at "
                    "https://console.cloud.google.com/apis/credentials\n"
                    "Download JSON, save as scripts/credentials.json"
                )
            flow = InstalledAppFlow.from_client_secrets_file(str(CREDENTIALS_PATH), SCOPES)
            creds = flow.run_local_server(port=0)
        TOKEN_PATH.write_text(creds.to_json())
    return creds


def find_folder(service, name, parent_id):
    parent_clause = f"'{parent_id}' in parents" if parent_id else "'root' in parents"
    query = (
        f"name = '{name}' and mimeType = '{FOLDER_MIME}' "
        f"and trashed = false and {parent_clause}"
    )
    resp = service.files().list(q=query, fields="files(id, name)", pageSize=10).execute()
    files = resp.get("files", [])
    return files[0]["id"] if files else None


def create_folder(service, name, parent_id):
    metadata = {"name": name, "mimeType": FOLDER_MIME}
    if parent_id:
        metadata["parents"] = [parent_id]
    folder = service.files().create(body=metadata, fields="id").execute()
    return folder["id"]


def ensure_folder(service, name, parent_id, path_label, results):
    existing_id = find_folder(service, name, parent_id)
    if existing_id:
        print(f"  [skip] {path_label} (exists: {existing_id})")
        results[path_label] = {"id": existing_id, "created": False}
        return existing_id
    new_id = create_folder(service, name, parent_id)
    print(f"  [new ] {path_label} (created: {new_id})")
    results[path_label] = {"id": new_id, "created": True}
    return new_id


def main():
    print("Authenticating with Google Drive...")
    creds = authenticate()
    service = build("drive", "v3", credentials=creds)

    print("Building HUS folder structure...\n")
    results = {}

    for root_name, children in STRUCTURE.items():
        root_id = ensure_folder(service, root_name, None, root_name, results)
        for section_name, leaves in children.items():
            section_path = f"{root_name}/{section_name}"
            section_id = ensure_folder(service, section_name, root_id, section_path, results)
            for leaf in leaves:
                leaf_path = f"{section_path}/{leaf}"
                ensure_folder(service, leaf, section_id, leaf_path, results)

    ar_ap_id = results.get("HUS/01_Finance/AR_AP", {}).get("id")
    if ar_ap_id:
        for sub in AR_AP_SUBFOLDERS:
            sub_path = f"HUS/01_Finance/AR_AP/{sub}"
            ensure_folder(service, sub, ar_ap_id, sub_path, results)

    logistics_id = results.get("HUS/04_Logistics", {}).get("id")
    if logistics_id:
        for sub in LOGISTICS_SUBFOLDERS:
            sub_path = f"HUS/04_Logistics/{sub}"
            ensure_folder(service, sub, logistics_id, sub_path, results)

    procurement_id = results.get("HUS/05_Procurement", {}).get("id")
    if procurement_id:
        packing_path = "HUS/05_Procurement/Packing_List"
        packing_id = ensure_folder(service, "Packing_List", procurement_id, packing_path, results)
        for origin in PACKING_LIST_ORIGINS:
            origin_path = f"{packing_path}/{origin}"
            ensure_folder(service, origin, packing_id, origin_path, results)

    OUTPUT_PATH.write_text(json.dumps(results, indent=2, ensure_ascii=False))
    created = sum(1 for r in results.values() if r["created"])
    skipped = len(results) - created
    print(f"\nDone. Created: {created}, Skipped (already existed): {skipped}")
    print(f"Folder ID map written to: {OUTPUT_PATH}")


if __name__ == "__main__":
    try:
        main()
    except HttpError as e:
        sys.exit(f"Drive API error: {e}")
