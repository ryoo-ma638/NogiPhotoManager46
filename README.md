# NogiPhotoManager46

乃木坂46・弓木奈於さんの生写真コレクションの所有状況を管理する、個人用のWebアプリ（PWA）です。日本語UI。
本番URL: https://nogi-photo-manager46.vercel.app

使う人向けの操作説明は `使い方.md`、設計の決定内容と理由は `開発メモ.md` を参照してください。

## 主な機能

- **所有トラッカー**: 写真1枚ごとに○×を記録。枚数（count）も持ち、2枚以上はダブりとして扱う。バインダー > 年 > セット > ポーズ枠の階層でコンプ率を表示。カタログ（読み取り専用の静的JSON）と所有データ（IndexedDB）は完全に分離。
- **画像添付**: ポーズ枠ごとに実物写真を添付でき（添付すると自動で所有になる）、一覧にはサムネイルを表示。
- **一括取込・AI自動判別**: アプリ内カメラで連続撮影（撮った端から並行して解析）、または端末の写真から選択（最大30枚）。Gemini APIが印字・ポーズ・レア度を認識し、確信があればセットとポーズ枠を自動で割り当て、あいまいなときは候補を提示。日英シノニム・SRCL品番（封入）・日付コード・周年に対応。
- **レア（R/SR）の扱い**: 手書き風の文字とキラキラ（ホログラム）から判定（下余白が白＝R／虹色＝SR）。R/SR枠は要確認として先入れするだけで、自動確定はしない。
- **「その他」バインダー**: まだカタログに無い写真の仮置き場。未分類の写真を連番枠で追加でき（名前は任意）、同名は重複警告を出す。名前がカタログのセット名と一致すると、本セットへ画像と所有をまとめて移せる。
- **トレード**: 枚数・♡（特に欲しい）・求／譲リスト（X貼り付け用のテキスト）を管理。共有ファイル（JSON）を相手と交換して、もらえる／渡せるを突き合わせ。
- **検索**: 名前検索に加えて絞り込み（未所有／ダブり／特に欲しい／種類）と並び替え。状態は記憶される。
- **統計**: コンプ率、譲れるダブり枚数、特に欲しい件数など。
- **バックアップ**: 所有データはJSON（新規保存／上書き保存を選択）、添付画像はZIP（fflate）で別建て。最終書き出しから14日でホーム画面に催促を表示。
- **AI判定の使用制限**: 非オーナーは1日30回まで。オーナーはパスワードで無制限に解除。
- **その他**: 初回チュートリアル（5画面）、ニックネーム設定、PWA（オフライン動作・ホーム画面インストール）。

## 技術構成

- Vite + React 19 + TypeScript（strict） + Tailwind CSS v4
- IndexedDB（Dexie）＝所有データ／静的JSON＝カタログ（完全分離）
- vite-plugin-pwa（オフライン動作・ホーム画面インストール）
- ホスティング＝Vercel。Serverless Functions で `api/analyze.ts`（Gemini 画像認識）と `api/unlock.ts`（オーナー解除のパスワード照合）を実行
- テスト＝Vitest
- 画像ZIPの圧縮／展開に fflate

## セットアップ

```bash
npm install
npm run dev      # 開発サーバ（フロントのみ）
npm run build    # 本番ビルド（tsc --noEmit で型チェックしてから vite build）
npm run test     # Vitest（catalog系ロジックを変更したときは必須）
```

`npm run dev` はフロントだけを起動します。AI認識とオーナー解除（Serverless Functions）は本番（Vercel）で動きます。ローカルで関数も動かしたいときは Vercel CLI の `vercel dev` を使い、後述の `.env` を用意してください。

## 環境変数

見本は `.env.example` にあります（値は書かず、名前と用途だけを記載）。本番の値は Vercel のプロジェクト設定 → Environment Variables に登録します。ローカルで `vercel dev` を使うときだけ `.env.example` を `.env` にコピーして値を入れてください。`.env` は `.gitignore` 済みで、**実際の値（APIキー・パスワード）は絶対にコミットしません**。

| 変数名 | 用途 |
|---|---|
| `GEMINI_API_KEY` | Gemini APIキー。画像のAI認識に使用。 |
| `GEMINI_MODEL` | 使用するGeminiモデル。未設定なら `gemini-2.5-flash`。 |
| `OWNER_PASSWORD` | オーナー解除パスワード。合致するとAI判定の1日30回制限を解除。 |

## カタログの更新手順（新作の追加）

カタログは変換スクリプト経由で再生成します。手でJSONを直接大量編集しません。

1. 設定 → 書き出しで所有データのバックアップを取る。
2. 非公開の `catalog-source.txt`（`.gitignore` 済み）の**末尾に**、対象バインダーを追記する。
3. `python3 scripts/convert_catalog.py` を実行。公開カタログ `public/catalog/yumiki_nao.json` と、非公開の `yumiki_nao.ownership.json` を生成する。
4. `python3 scripts/validate_catalog.py` で検証（ID重複・参照整合・template既知・枠数などをチェック）。
5. 旧カタログと差分を取り、**既存IDが1件も変わっていないこと**を確認してから確定。内容を変えたら `catalogVersion` を増やす。

**重要ルール（所有データを壊さないため）**

- IDは行順の位置ベースで機械採番されます（`s0001`, `s0002`…）。所有データは `member:setId:slot` 形式のID（例 `yumiki_nao:s0001:yori`）で紐づくため、**`catalog-source.txt` は末尾追記のみ**。途中に挿入すると以降の既存IDがずれて所有が壊れます。既存行は動かさない。
- stableID（`yumiki_nao:s0001:yori` 形式）は変更・再利用しない。改名は name／label フィールドのみ。
- カタログから消えたセットをローカルから自動削除しない（追加・更新のみ）。

## デプロイ

`main` ブランチに push すると Vercel が本番へ自動デプロイします（ソロ運用のためPRは不要）。

## ディレクトリ構成

| パス | 内容 |
|---|---|
| `src/pages/` | 画面（Home / Binder / SetDetail / Search / Import / Trade / Stats / Settings） |
| `src/lib/` | ロジックの純関数（照合 match.ts・認識 recognize.ts・レア判定 classify.ts・バックアップ backup.ts／imageBackup.ts・トレード trade.ts・使用制限 limit.ts など） |
| `src/components/` | UI部品（カメラ・ポーズカード・各シート・チュートリアルなど） |
| `api/` | Vercel Serverless Functions（`analyze.ts`＝Gemini認識、`unlock.ts`＝パスワード照合） |
| `public/catalog/` | 公開カタログJSON（`yumiki_nao.json`） |
| `scripts/` | カタログ変換 `convert_catalog.py`・検証 `validate_catalog.py`（Python） |
| `legacy-ios/` | 中止したiOS（SwiftUI）版のアーカイブ。参照・流用・ビルドはしない。 |

## データの安全性

- 所有データ（○×・枚数・添付画像）は端末内（IndexedDB）にのみ保存され、外部サーバには送信されません。AI認識のときだけ、選んだ画像をVercelの関数経由でGeminiへ送ります（所有データは送りません）。
- 非公開ファイルは `.gitignore` 済みです: `*.ownership.json`（所有データ）、`catalog-source*.txt`（カタログ原文）、`ownership-overrides.txt`（所有の個別指定）、`.env`（秘密の値）。リポジトリはPublicのため、公開カタログJSONには所有（`owned`）を含めません。

## 関連ドキュメント

- `使い方.md` — 使う人向けの操作ガイド（初期セットアップ・日常操作・バックアップ・PC同期・新作反映）
- `開発メモ.md` — 設計の決定内容と理由（ADR・スキーマ・画面構成）
