// 生写真画像の解析（Vercel Serverless Function）
// 1枚の画像に写る「複数の生写真」を検出し、それぞれの印字・ポーズを Gemini（無料枠）で読む。
// APIキーは Vercel の環境変数 GEMINI_API_KEY に設定する（クライアントに埋め込まない）。

const POSES = ['yori', 'chu', 'hiki', 'suwari-yori', 'suwari-hiki', 'unknown']

const PROMPT = `あなたはアイドル公式「生写真」（ブロマイド写真）の整理係です。
この画像には、生写真が1枚だけ写っている場合と、コレクションバインダーのページや机の上などに複数枚写っている場合があります。
写っている生写真「それぞれ」について解析し、次のJSONだけを返してください。

{"photos":[{"box_2d":[ymin,xmin,ymax,xmax],"caption":string|null,"caption_confidence":number,"pose":string,"pose_confidence":number}]}

- box_2d: その生写真1枚が占める範囲。画像全体を0〜1000に正規化した [ymin, xmin, ymax, xmax]
- caption: その生写真の余白（多くは下端）に印字されている小さな文字列を「そのまま」書き写す。例: "2022.May-Ⅱ" "乃木坂46 2021.July" "NOT FOR SALE SRCL 12620-21" "乃木坂46 12th Anniversary"。読めない・無い場合は null
- caption_confidence: 読み取りの確信度 0〜1
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

  const photos = rawPhotos.slice(0, 12).map((p: any) => ({
    box: normBox(p?.box_2d),
    caption: typeof p?.caption === 'string' && p.caption.trim() ? p.caption.trim() : null,
    captionConfidence: clamp01(p?.caption_confidence),
    pose: POSES.includes(p?.pose) ? p.pose : 'unknown',
    poseConfidence: clamp01(p?.pose_confidence),
  }))

  return res.status(200).json({ photos })
}
