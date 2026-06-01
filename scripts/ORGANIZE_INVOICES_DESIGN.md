# All_Invoice_Legacy 整理 — 設計書

依頼: 小池(5代目HQ司令塔) — 2026-05-25
実装: ナランチャ(Claude)
対象: `HUS/01_Finance/All_Invoice_Legacy/` (Drive ID: `1ClBIMTCv2PN9PQMp8-TBpiJI6tiAHT0m`)
目的: 50+ vendor folder の混在 invoice を AR/AP/物流に分類、ファイル名規則化、metadata 抽出。月次PL照合と margin 分析の数字根拠を作る。

---

## 1. 認証構造(重要)

| 認証主体 | 用途 | 権限 |
|---|---|---|
| `tadahisaster@gmail.com` (MCP Drive tool) | パイロット時の調査・確認 | All_Invoice_Legacy 配下は **全件 `canAddChildren: false`** (read only) |
| `hokkaidounishop@gmail.com` (`scripts/token.json`) | **本実装の Drive 操作** | フル write 権(HUS tree を実際に作ったアカウント。5TB契約, 26GB使用) |

→ MCP は読み(分類)専用、move/rename/folder作成は **必ず `scripts/token.json` 経由の Python script** で実行。

---

## 2. 整理後のディレクトリ構造

```
HUS/
├── 01_Finance/
│   ├── PL_BS/
│   ├── AR_AP/                        ← AP系の集約場所
│   │   ├── Marketing/<業者名>/
│   │   ├── 資材/<業者名>/              (Fidelity Paper, packaging材 等)
│   │   ├── Legal/<業者名>/
│   │   ├── Food_supplier/<業者名>/    (TWF, KS Seafood, Global Ocean, Ocean Providence 等)
│   │   ├── Goods_supplier/<業者名>/   (酒器・木製品・周辺商品仕入)
│   │   ├── Other/<業者名>/            (econoshift IT開発費等)
│   │   └── _Manual_Review/             (分類不能、Tad/小池レビュー要)
│   ├── Reconciliation/
│   └── All_Invoice_Legacy/            ← 整理後は空 or 残置(履歴保存)
├── 02_B2C/
│   └── Shopify_orders/<顧客名>/        (Old Florida Fish House, Chef Tony Huynh 等 B2C)
├── 03_B2B/
│   └── Freshline_invoices/<顧客名>/    (Mikado, Towa 等 B2B AR)
└── 04_Logistics/
    ├── UPS/
    ├── Nittsu/                         (新規追加)
    └── ShipFare/
```

---

## 3. 分類ルール(AR/AP/B2C-order)

ファイル内 "Bill To" / "From" の方向で判定:

| direction | 条件 | 行き先 |
|---|---|---|
| **AR (B2B)** | Bill To: 法人顧客、From: HUS、定期取引 | `03_B2B/Freshline_invoices/<顧客名>/` |
| **B2C-order** | Bill To: 個人/小売 (Shopify/Stripe order PDF) | `02_B2C/Shopify_orders/<顧客名>/` |
| **AP** | Bill To: HUS / Uni Shop / Hokkaido Uni 等、From: 業者 | `01_Finance/AR_AP/<category>/<業者名>/` |
| **物流 AP** | From: UPS, Nittsu, ShipFare, FedEx 等 | `04_Logistics/<運輸業者名>/` |

**判定の罠:**
- Fidelity Paper はファイル名が `AR_Invoice_XXXX.pdf` だが、これは Fidelity 視点。HUS視点では AP → `01_Finance/AR_AP/資材/Fidelity_Paper/`
- ファイル名でなく、PDF/画像内の "Bill To" を必ず参照

---

## 4. AP category 自動分類ルール

| category | キーワード/特徴 | 例 |
|---|---|---|
| `Marketing/` | 広告・SNS・PR・印刷物 | Mailchimp, Meta Ads, 印刷会社 |
| `資材/` | 包装・保冷・段ボール・容器 | Fidelity Paper(保冷BOX), 包装材 |
| `Legal/` | 弁護士・会計士・税理士・登記 | 法律事務所、CPA |
| `Food_supplier/` | 生鮮・冷凍・加工食品 | TWF, KS Seafood, Global Ocean, Ocean Providence, ルフルーヴ(マルコ水産), FICI, Blue America(WAGYU) |
| `Goods_supplier/` | 酒器・食器・周辺販売商品 | まどろむ酒器販売(相場真紀子), 木製品 |
| `Other/` | 上記以外 | econoshift(IT開発), 家賃, etc. |
| `_Manual_Review/` | 自動分類不能 | Credit Application のような契約・申請書類、OCR失敗ファイル |

---

## 5. ファイル名規則(rename)

新形式: `YYYYMMDD_<業者名>_<内容>_<amount><currency>.<ext>`

- `YYYYMMDD`: Invoice 発行日(PDF内の date field 優先、抽出不能時は Drive `createdTime`)
- `<業者名>`: 会社名で正規化(人名フォルダ → 会社名へ移行: Aiba→Madoromu_Shuki, Kawabata→Lefleuv, Mike Negami→econoshift)
- `<内容>`: invoice/credit_application/purchase_order/receipt 等の文書種別
- `<amount>`: 小数点なし整数。範囲: `_3500USD` `_322960JPY`
- `<currency>`: USD/JPY/EUR 等
- `<ext>`: 元拡張子保持 (pdf/jpg/png)

例:
- `20260424_TWF_invoice_76USD.jpg`
- `20260501_Lefleuv_invoice_322960JPY.pdf`
- `20230702_econoshift_invoice_1850USD.pdf`

---

## 6. vendor 名正規化辞書

人名フォルダ・別名フォルダ → 正規化された会社名へ:

| 旧フォルダ名 | 正規化された業者名 |
|---|---|
| `Aiba` | `Madoromu_Shuki` (まどろむ酒器販売 / 相場真紀子) |
| `Kawabata` | `Lefleuv` (ルフルーヴ合同会社 / 川端恵子) |
| `Mike Negami` | **ファイル単位分類** (econoshift / Towa向けHUS発行AR の混在) |
| `TWF` ∪ `True World Foods` | `TWF` に統合 (True World Foods/Credit_Application/ をサブフォルダ化) |
| `Fedelity Paper Supply Corp` | `Fidelity_Paper` (typo修正) |
| `Freshline` | (実態は Stripe Invoice for B2B AR — vendor名は Bill To 先) |
| `202604` `202605` 等 | **月別フォルダ → 完全展開して vendor 別に再配分** |

---

## 7. 月別フォルダ(202604/202605 等)の扱い

月別フォルダは混在ダンプ。中身を全部ファイル単位で classify → vendor folder へ振り分け。

月別フォルダ自体は処理後に **空のまま残置**(履歴保存のため)。

---

## 8. 処理フロー (3 Phase)

### Phase 1: classify (dry-run)
1. `All_Invoice_Legacy/` を再帰的にスキャン(入れ子フォルダ含む)
2. 各ファイルについて:
   - PDF: `pdfplumber` でテキスト抽出
   - 画像(jpg/png): MCP read_file_content の Vision OCR を利用するため、**この phase は ナランチャ(Claude code) が担当して JSON manifest を作る方が現実的**(後述の代替案参照)
3. Claude API で classification:
   - `direction`: AR / AP / B2C-order / unknown
   - `vendor_normalized`: 会社名(正規化)
   - `invoice_date`, `total_amount`, `currency`, `status`
   - `ap_category` (AP の場合のみ)
   - `customer_name` (AR/B2C-order の場合のみ)
4. `manifest.csv` 出力(下記 schema 参照)

### Phase 2: apply
1. `manifest.csv` を読む(小池レビュー済み版)
2. 各行について Drive API で:
   - `files().update(addParents=新parent, removeParents=旧parent, name=新ファイル名)`
3. 失敗時は manifest の status 列を `error` に更新、続行

### Phase 3: rollback
- `manifest.csv` の `旧parent`/`旧name` を使って逆操作

---

## 9. manifest.csv schema

| 列名 | 型 | 説明 |
|---|---|---|
| `file_id` | string | Drive file ID(不変) |
| `old_parent_id` | string | 移動前の parent folder ID |
| `old_parent_path` | string | 移動前 path (人間用) |
| `old_name` | string | 移動前 name |
| `new_parent_id` | string | 移動後の parent folder ID |
| `new_parent_path` | string | 移動後 path (人間用) |
| `new_name` | string | rename 後の name |
| `direction` | enum | AR / B2C-order / AP / unknown |
| `vendor_normalized` | string | 正規化された業者名 |
| `customer_name` | string | (AR/B2C のみ) 顧客名 |
| `ap_category` | enum | (AP のみ) Marketing/資材/Legal/Food_supplier/Goods_supplier/Other |
| `invoice_date` | YYYYMMDD | PDF内の日付 |
| `total_amount` | number | 整数(小数点なし) |
| `currency` | enum | USD / JPY / EUR / etc. |
| `status` | enum | Paid / Unpaid / Pending / unknown |
| `mime_type` | string | application/pdf, image/jpeg, etc. |
| `confidence` | 0.0-1.0 | Claude API の判定信頼度 |
| `notes` | string | 抽出時の注意事項 |
| `apply_status` | enum | pending / done / error / skipped |

---

## 10. 実行手順

```bash
# 0. 初回のみ: AR_AP subfolders と Logistics/Nittsu を作成
bash scripts/setup_hus_drive.sh

# 1. classify (dry-run) — manifest.csv 生成
.venv-drive/bin/python3 scripts/organize_invoices.py classify \
    --root-id 1ClBIMTCv2PN9PQMp8-TBpiJI6tiAHT0m \
    --output scripts/manifest.csv

# 2. 小池が manifest.csv をレビュー
#    - direction が間違ってる行を修正
#    - _Manual_Review 行を確認、判断
#    - confidence < 0.7 の行を集中レビュー

# 3. apply 実行
.venv-drive/bin/python3 scripts/organize_invoices.py apply \
    --manifest scripts/manifest.csv

# 4. (必要なら) rollback
.venv-drive/bin/python3 scripts/organize_invoices.py rollback \
    --manifest scripts/manifest.csv
```

---

## 11. 制約と注意

- **Python 3.9** (古い、google-auth が EOL警告出す)。動作はする。
- **入れ子フォルダ** あり: Nittsu/20210705/, True World Foods/Credit Application/ 等を再帰探索
- **重複ファイル**: 例 `AR_Invoice_196321.pdf` と `... (1).pdf` が同内容 → manifest で検出して片方を `_Duplicates/` 行きに
- **画像 OCR**: pdfplumber は画像非対応。jpg 多数(TWF, UPS等)あるため、**Google Drive 内蔵 OCR** または **Claude Vision API** または **MCP read_file_content** のいずれかを使う必要
  - 推奨: Phase 1 で画像は MCP read_file_content の結果を別途キャッシュ JSON にナランチャが事前に作っておく → Python script がそれを参照
- **API 料金**: Claude classify × 500 ファイル ≈ $5-10 程度
- **進捗保存**: 長時間実行で中断しても再開可能なよう、`manifest.csv` を逐次更新

