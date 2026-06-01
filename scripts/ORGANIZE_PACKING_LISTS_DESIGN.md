# GOT Packing List 整理 — 設計書

依頼: 小池(5代目HQ司令塔) — 2026-05-26 19:10
実装: ナランチャ(Claude)
対象: `HUS/05_Procurement/GOT/` (Drive ID: `1lcXkV3TQRQdydNiCxo1UKzMXpXmLzIGV`)
目的: GOT folder 内の Packing List 群を産地別 (New_York / North_Carolina / San_Jose / Seattle / Tampa) に分類、ファイル名規則化、metadata 抽出。仕入れ産地別の数量・コスト分析の数字根拠を作る。

---

## 1. 認証構造

`organize_invoices.py` と同一:

| 認証主体 | 用途 | 権限 |
|---|---|---|
| `tadahisaster@gmail.com` (MCP Drive tool) | 調査・確認のみ | read only |
| `hokkaidounishop@gmail.com` (`scripts/token.json`) | **本実装の Drive 操作** | フル write 権 |

→ MCP は読み専用、move/rename/folder作成は **必ず `scripts/token.json` 経由の Python script** で実行。

---

## 2. 整理後のディレクトリ構造

```
HUS/05_Procurement/Packing_List/
├── New_York/
├── North_Carolina/
├── San_Jose/
├── Seattle/
├── Tampa/
└── _Manual_Review/      (自動判別不能ファイル)
```

**Phase 0 で folder 作成済み。folder ID は `scripts/hus_drive_folder_ids.json` 参照。**

各産地配下は **vendor 別 subfolder を作らない** (= フラット展開)。理由: invoice と違い 1 ship per file の独立性が高く、産地軸での集計が主用途のため。

---

## 3. 産地分類ルール

ファイル内の "Ship From" / "Origin" / "Pickup Location" / "FOB" / "shipping origin" を最優先で抽出。
都市名・州名から下記 5 産地へマップ:

| origin | マップキー (都市・州・空港コード) |
|---|---|
| `New_York` | New York, NY, JFK, LGA, Newark (NJ Newark Liberty も含む), Brooklyn, Queens |
| `North_Carolina` | North Carolina, NC, Charlotte, Raleigh, Wilmington, RDU |
| `San_Jose` | San Jose, CA San Jose, SJC, Silicon Valley, Bay Area (San Francisco/SFO は要判断、本拠地が San Jose なら NJ) |
| `Seattle` | Seattle, WA, SEA, Tacoma, Pike Place, SeaTac |
| `Tampa` | Tampa, FL Tampa, TPA, Tampa Bay, St. Petersburg |
| `unknown` → `_Manual_Review/` | マップ不能、複数候補、抽出失敗、Bill of Lading 形式で origin 不明確 |

**判定の罠:**
- 通常 "Bill To" / "Ship To" は **HUS / Uni Shop** (受取人) なので、origin 判定には **使わない**。"Ship From" / "Pickup" が origin の真の指標。
- vendor 住所 ≠ shipping origin の場合あり (vendor が複数拠点持ち)。荷物の出発地を優先。
- 単一 packing list 内に複数 origin が記載されている場合 → confidence を下げて `_Manual_Review/` 行き、notes に詳細記録。

---

## 4. ファイル名規則 (rename)

新形式: `YYYYMMDD_<業者名>_<産地>_<amount><currency>.<ext>`

- `YYYYMMDD`: Packing List の ship_date (PDF内の date field 優先、なければ Drive `createdTime`)
- `<業者名>`: vendor で正規化 (GOT, TWF, Lefleuv, Ocean_Providence 等)
- `<産地>`: New_York / North_Carolina / San_Jose / Seattle / Tampa / unknown
- `<amount>`: USD金額優先 (整数、小数点なし)。USD金額不明なら箱数 `_120BOX` か lbs `_45LBS`。両方不明なら省略。
- `<currency>`: USD (基本)、JPY (国内国際便があれば)、BOX, LBS
- `<ext>`: 元拡張子保持 (pdf/jpg/png)

例:
- `20260520_GOT_New_York_3450USD.pdf`
- `20260518_TWF_Seattle_120BOX.pdf`
- `20260515_OceanProvidence_Tampa_45LBS.jpg`

---

## 5. vendor 名正規化辞書

invoice 版 (`organize_invoices.py` line 80-92) と同一辞書を流用:

| 旧フォルダ名・別名 | 正規化された業者名 |
|---|---|
| `True World Foods` / `TWF` | `TWF` |
| `Global Ocean Trading` / `Global Ocean` | `Global_Ocean_Trading` |
| `Ocean Providence` | `Ocean_Providence` |
| `FICI Japan` | `FICI` |
| `Blue America` | `Blue_America` |
| `ルフルーヴ` / `Lefleuv` | `Lefleuv` |

GOT folder 内に独自 vendor が登場する可能性あり (Phase 1 サンプリングで判明予定)。

---

## 6. 処理フロー (3 Phase)

### Phase 0 ✅ 完了 (2026-05-26)
- `Packing_List/<5産地>/_Manual_Review/` を Drive 上に作成
- folder ID マップ更新済み

### Phase 1: classify (dry-run, AI 判別)
1. GOT folder を再帰的にスキャン
2. 各 PDF/画像について Claude Haiku 4.5 で classification
3. `scripts/packing_manifest.csv` 出力 (下記 schema 参照)
4. **最初は `--limit 10` で 10 件サンプリング → 小池レビュー後にフル実行**

### Phase 2: 小池レビュー
- `packing_manifest.csv` を確認
- `origin` 誤判定行を修正
- `_Manual_Review` 行の判断
- `confidence < 0.7` 集中レビュー

### Phase 3: apply
- manifest 通り Drive 上で move + rename 実行
- 失敗時は `apply_status=error` 記録、続行

### Phase 4: rollback (必要時)
- manifest の `old_*` 使って逆操作

---

## 7. manifest.csv schema

| 列名 | 型 | 説明 |
|---|---|---|
| `file_id` | string | Drive file ID (不変) |
| `old_parent_id` | string | 移動前の parent folder ID |
| `old_parent_path` | string | 移動前 path (人間用) |
| `old_name` | string | 移動前 name |
| `new_parent_id` | string | 移動後の parent folder ID |
| `new_parent_path` | string | 移動後 path (人間用) |
| `new_name` | string | rename 後の name |
| `origin` | enum | New_York / North_Carolina / San_Jose / Seattle / Tampa / unknown |
| `vendor_name` | string | 正規化された業者名 |
| `ship_date` | YYYYMMDD | PDF 内の出荷日 |
| `total_amount` | number | USD金額 (整数) |
| `currency` | enum | USD / JPY / BOX / LBS |
| `product_summary` | string | 主要商品 (Uni/Salmon/Hotate 等、検索用) |
| `doc_type` | enum | packing_list / bill_of_lading / shipping_label / other |
| `mime_type` | string | application/pdf, image/jpeg, etc. |
| `confidence` | 0.0-1.0 | Claude API の判定信頼度 |
| `notes` | string | 抽出時の注意事項・罠の記録 |
| `apply_status` | enum | pending / done / error / skipped |

---

## 8. 実行手順

```bash
# Phase 0: 完了済み

# Phase 1: classify サンプリング (10件)
.venv-drive/bin/python3 scripts/organize_packing_lists.py classify \
    --root-id 1lcXkV3TQRQdydNiCxo1UKzMXpXmLzIGV \
    --root-path "HUS/05_Procurement/GOT" \
    --output scripts/packing_manifest.csv \
    --limit 10

# Phase 2: 小池レビュー (CSV 確認)

# Phase 1b: フル classify (--limit 外す)
.venv-drive/bin/python3 scripts/organize_packing_lists.py classify \
    --root-id 1lcXkV3TQRQdydNiCxo1UKzMXpXmLzIGV \
    --root-path "HUS/05_Procurement/GOT" \
    --output scripts/packing_manifest.csv \
    --resume

# Phase 3: apply (dry-run 確認後)
.venv-drive/bin/python3 scripts/organize_packing_lists.py apply \
    --manifest scripts/packing_manifest.csv \
    --dry-run

.venv-drive/bin/python3 scripts/organize_packing_lists.py apply \
    --manifest scripts/packing_manifest.csv

# Phase 4 (必要なら): rollback
.venv-drive/bin/python3 scripts/organize_packing_lists.py rollback \
    --manifest scripts/packing_manifest.csv \
    --confirm
```

---

## 9. 制約と注意

- **Python 3.9** — 動作確認済み (invoice 版で実績)
- **画像 PDF (jpg/png)** — Claude Vision で対応
- **API 料金** — Claude Haiku 4.5 × 想定 50-200 件 ≈ $1-5
- **進捗保存** — manifest.csv を 10 件毎に逐次更新、`--resume` で中断再開可
- **rollback 可** — manifest の old_* が残るので原状復帰可能
- **vendor subfolder なし** — invoice と違い flat 展開、産地軸で完結

---

## 10. invoice 版との差分まとめ

| 項目 | invoice 版 | packing list 版 |
|---|---|---|
| 軸 | direction (AR/AP/B2C) × category | origin (5 産地) のみ |
| vendor subfolder | あり (`<category>/<vendor>/`) | **なし** (flat) |
| ファイル名 amount | `_<int><USD/JPY>` | 同じ + 箱数/lbs fallback |
| Claude prompt | "Bill To" を最優先 | "Ship From / Pickup" を最優先 |
| 対象 root | All_Invoice_Legacy/ | GOT/ |
| 想定件数 | 500+ | 50-200 (推定) |
