# カタログJSONスキーマ

生写真カタログのデータ形式。詳細な設計理由は `開発メモ.md` を参照。

## ファイルの役割
| ファイル | 公開 | 内容 |
|---|---|---|
| `catalog/<member>.json` | ✅公開 | 衣装カタログ（存在する衣装の一覧）。**所有情報を含めない** |
| `<member>.ownership.json` | ❌非公開(gitignore) | 所有している写真IDの一覧（個人データ） |
| `catalog-source.txt` | ❌非公開(gitignore) | 変換元の原文（✓/◦付き） |

生成: `python3 scripts/convert_catalog.py` → 検証: `python3 scripts/validate_catalog.py`

## catalog JSON
```jsonc
{
  "schemaVersion": 1,          // 形式の版（アプリの互換判定用）
  "catalogVersion": 1,         // 内容の版（単調増加。増えた時だけ同期）
  "member": { "id": "yumiki_nao", "name": "弓木奈於" },
  "binders": [
    { "id": "b2020-2021", "name": "弓木2020＆2021", "sortIndex": 0, "sealed": false }
    // sealed:true = 封入バインダー（年なし）
  ],
  "sets": [
    {
      "id": "s0001",           // メンバー内で不変・不透明なID（凍結。変更/再利用禁止）
      "binderId": "b2020-2021",
      "year": 2020,            // 封入(sealed)セットは null
      "name": "4期生スペシャル衣装",
      "template": "standard3", // 下記テンプレのいずれか
      "sortIndex": 10,
      "note": null,            // 「〜〜〜」由来メモや末尾注記
      "pageBreakAfter": false  // 物理ページ区切り
    }
  ]
}
```
アプリ内の完全ID: 写真 = `<member>:<setId>:<slot>`（例 `yumiki_nao:s0001:yori`）。

## テンプレート（写真枠の初期生成）
| template | 種類 | slot |
|---|---|---|
| standard3 | 3 | yori/chu/hiki |
| five5 | 5 | + suwari-yori/suwari-hiki |
| rareSet8 | 8 | + r1 + sr1〜sr4 |
| event6 | 6 | p1〜p6 |
| single1 | 1 | p1 |

## 原文→所有の変換ルール
- `✓` = 全枚所有 ／ `◦`(注記なし) = 全未所有
- `◦` + 末尾注記 = **注記の通常ポーズが「欠け」（未所有）、残りの通常ポーズは所有**。R/SR等のレア枠は`✓`(コンプ)セット以外は所有としない（別途手動管理）
- 解釈できない注記・矛盾（✓なのに注記あり等）は変換時に「要確認」として出力し、人が裁定する
