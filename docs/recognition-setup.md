# 自動判定（Gemini）のセットアップ

一括取込の自動判定は Gemini API（無料枠）を使う。キーはVercelの環境変数に置き、コードには含めない。

## 手順（1回だけ・5分）
1. https://aistudio.google.com/apikey を開き、Googleアカウントでログイン →「APIキーを作成」
2. https://vercel.com/ → プロジェクト `nogi-photo-manager46` → **Settings → Environment Variables**
3. 次を追加して Save:
   - Name: `GEMINI_API_KEY` ／ Value: 作成したキー ／ Environment: Production にチェック
4. **Deployments** タブ → 最新のデプロイの「…」→ **Redeploy**（環境変数を反映させるため）
5. アプリの「一括取込」で写真を選ぶと自動判定が動く

## 仕組み
- クライアント → `/api/analyze`（Vercel Function）→ Gemini。キーはサーバー側のみ
- 判定内容: 写真下部の印字（例 `2022.May-Ⅱ`）読取 → カタログと照合／ポーズ（ヨリ/チュウ/ヒキ/座り）判定
- 確信度が低い・照合できない場合は「要確認」になり手動で選ぶ（自動で間違った場所に入れない方針）
- ①〜⑤系のセット（5種セット/MV等）は枠の自動割当をせず、セットのみ自動・枠は手動
- モデルは環境変数 `GEMINI_MODEL` で変更可（既定: gemini-2.5-flash）

## 無料枠の目安
Gemini Flash系の無料枠は1日あたり数百リクエスト規模。1枚=1リクエストなので通常利用では収まる。超えた場合はその日のうちは「要確認」扱いになるだけで、手動振り分けは常に可能。
