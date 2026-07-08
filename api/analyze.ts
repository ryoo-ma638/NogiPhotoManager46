// 生写真画像の解析（Vercel Serverless Function）
// 1枚の画像に写る「複数の生写真」を検出し、それぞれの印字・ポーズを Gemini（無料枠）で読む。
// APIキーは Vercel の環境変数 GEMINI_API_KEY に設定する（クライアントに埋め込まない）。

const POSES = ['yori', 'chu', 'hiki', 'suwari-yori', 'suwari-hiki', 'unknown']

const PROMPT = `あなたはアイドル公式「生写真」（ブロマイド写真）の整理係です。
この画像には、生写真が1枚だけ写っている場合と、コレクションバインダーのページや机の上などに複数枚写っている場合があります。
写っている生写真「それぞれ」について解析し、次のJSONだけを返してください。

{"photos":[{"box_2d":[ymin,xmin,ymax,xmax],"caption_edge":string|null,"caption":string|null,"caption_confidence":number,"pose":string,"pose_confidence":number}]}

- box_2d: その生写真1枚が占める範囲。画像全体を0〜1000に正規化した [ymin, xmin, ymax, xmax]
    ・画像の端で見切れている・ごく一部しか写っていない生写真（隣の写真の切れ端など）は含めない。全体（またはほぼ全体）が写っている生写真だけを対象にする。
- caption_edge: この画像を見たとき、その生写真の「印字（小さな文字）がある辺」が写真枠のどちら側に見えるか。"bottom"=写真の下辺 / "top"=上辺 / "left"=左辺 / "right"=右辺 / 印字が見えなければ null。（正しい向きの生写真では印字は下辺にある。つまり bottom 以外なら写真が回転して写っているということ）
- caption: その生写真に印刷されている文字を、見えるものは「すべて」書き写す。
    ・下端など余白の小さな文字（日付コード・"NOT FOR SALE"・"SRCL 12620-21"・"©Sony Music"・メンバー名など）。例: "2022.May-Ⅱ" "乃木坂46 2021.July" "NOT FOR SALE SRCL 12620-21" "乃木坂46 11th BIRTHDAY LIVE"
    ・加えて、写真の中のタイトルやイベント名のロゴ・デザイン文字（例:「真夏の全国ツアー2022」「好きというのはロックだぜ！」）も、装飾されていても英語でも、読める範囲でそのまま書き写す。
    ・長いタイトルも途中で省略せず、読める文字は最後まで書き写す。
    ・【最重要】印字が英語のときは英語のまま書き写す。カタカナや日本語に翻訳・変換しない（乃木坂46の生写真は英語表記が多い。例:"BIRTHDAY LIVE"を「バースデーライブ」に、"FOURTH MEMBERS"を「フォースメンバーズ」に変換しない。そのまま英字で）。
    ・レア/SR等の写真は、下の余白が白く、メンバー名・日付・"乃木坂46"などが手書き風（スケッチ風）の文字で書かれていたり、表面がキラキラ（ホログラム）していることがある。その手書き風の文字も、読める範囲でそのまま書き写す。
    ・【厳守】実際に印刷されている文字だけを書き写す。推測で補ったり、似た別のタイトル・別の年・別のイベント名に置き換えたりは絶対にしない。一部しか読めないときは、読めた部分だけを書き、読めない部分は書かない。
    ・文字が1つも読めなければ null。
- caption_confidence: captionの読み取りの確信度 0〜1。曖昧・一部しか読めなかったときは低くする。自信のない読み取りを高い確信度で返さない
- pose: その写真の被写体の写り方。"yori"=顔〜胸から上のアップ / "chu"=だいたい腰〜膝上まで / "hiki"=立った状態の全身 / "suwari-yori"=座っていて上半身中心 / "suwari-hiki"=座っていて全身 / "unknown"=判別できない
- pose_confidence: 確信度 0〜1
- 生写真が1枚も写っていなければ {"photos":[]}`

function clamp01(v: unknown): number {
  const n = typeof v === 'number' ? v : Number(v)
  return Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : 0
}

function normBox(v: unknown): [number, number, number, number] | null {
  if (!Array.isArray(v) || v.length !== 4) return null
  const b = v.map((x) => Math.min(1000, Math.max(0, Number(x))))
  if (b.some((x) => !Number.isFinite(x))) return null
  const [ymin, xmin, ymax, xmax] = b as [number, number, number, number]
  if (ymax <= ymin || xmax <= xmin) return null
  return [ymin, xmin, ymax, xmax]
}

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POSTのみ対応' })

  const key = process.env.GEMINI_API_KEY
  if (!key) return res.status(503).json({ error: '認識APIが未設定です（GEMINI_API_KEY）' })

  const { image, mime } = req.body ?? {}
  if (typeof image !== 'string' || image.length < 100) {
    return res.status(400).json({ error: '画像データがありません' })
  }

  const model = process.env.GEMINI_MODEL || 'gemini-2.5-flash'
  const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-goog-api-key': key },
    body: JSON.stringify({
      contents: [
        {
          parts: [
            { inline_data: { mime_type: typeof mime === 'string' ? mime : 'image/jpeg', data: image } },
            { text: PROMPT },
          ],
        },
      ],
      generationConfig: {
        response_mime_type: 'application/json',
        temperature: 0,
        // 2.5系の「考える」モードを止めて高速化（10秒台→数秒。制限時間対策）
        thinkingConfig: { thinkingBudget: 0 },
      },
    }),
  })

  if (!r.ok) {
    const detail = (await r.text()).slice(0, 300)
    return res.status(502).json({ error: `Gemini APIエラー (${r.status})`, detail })
  }

  const data = await r.json()
  const text: string =
    data?.candidates?.[0]?.content?.parts?.map((p: any) => p.text ?? '').join('') ?? ''

  let parsed: any = null
  try {
    parsed = JSON.parse(text)
  } catch {
    const m = text.match(/\{[\s\S]*\}/)
    if (m) {
      try {
        parsed = JSON.parse(m[0])
      } catch {
        /* fallthrough */
      }
    }
  }
  const rawPhotos = Array.isArray(parsed?.photos) ? parsed.photos : Array.isArray(parsed) ? parsed : null
  if (!rawPhotos) return res.status(502).json({ error: '解析結果を読み取れませんでした' })

  // 印字の位置 → 正しい向きにするための時計回り回転角（印字は本来「下辺」にある）
  const EDGE_TO_ROTATION: Record<string, number> = { bottom: 0, right: 90, top: 180, left: 270 }

  const photos = rawPhotos.slice(0, 12).map((p: any) => ({
    box: normBox(p?.box_2d),
    rotation: EDGE_TO_ROTATION[p?.caption_edge] ?? 0,
    caption: typeof p?.caption === 'string' && p.caption.trim() ? p.caption.trim() : null,
    captionConfidence: clamp01(p?.caption_confidence),
    pose: POSES.includes(p?.pose) ? p.pose : 'unknown',
    poseConfidence: clamp01(p?.pose_confidence),
  }))

  return res.status(200).json({ photos })
}
