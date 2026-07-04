// 生写真1枚の解析（Vercel Serverless Function）
// 印字の日付コード読取とポーズ判定を Gemini（無料枠）で行う。
// APIキーは Vercel の環境変数 GEMINI_API_KEY に設定する（クライアントに埋め込まない）。

const POSES = ['yori', 'chu', 'hiki', 'suwari-yori', 'suwari-hiki', 'unknown']

const PROMPT = `あなたはアイドル公式「生写真」の整理係です。この画像は生写真1枚を撮影したものです。以下のJSONだけを返してください。
{"caption": string|null, "caption_confidence": number, "pose": string, "pose_confidence": number}
- caption: 写真の余白（多くは下端）に印字されている小さな文字列を「そのまま」書き写す。特に日付コード（例: "2022.May-Ⅱ" "2023.July"）を優先。印字が無い・読めない場合は null
- caption_confidence: captionの読み取りの確信度 0〜1（読めなければ0）
- pose: 被写体の写り方。次のいずれか:
  "yori"=顔〜胸から上のアップ / "chu"=だいたい腰〜膝上まで / "hiki"=立った状態の全身 / "suwari-yori"=座っていて上半身中心 / "suwari-hiki"=座っていて全身 / "unknown"=判別できない
- pose_confidence: poseの確信度 0〜1`

function clamp01(v: unknown): number {
  const n = typeof v === 'number' ? v : Number(v)
  return Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : 0
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
      generationConfig: { response_mime_type: 'application/json', temperature: 0 },
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
  if (!parsed || typeof parsed !== 'object') {
    return res.status(502).json({ error: '解析結果を読み取れませんでした' })
  }

  return res.status(200).json({
    caption: typeof parsed.caption === 'string' && parsed.caption.trim() ? parsed.caption.trim() : null,
    captionConfidence: clamp01(parsed.caption_confidence),
    pose: POSES.includes(parsed.pose) ? parsed.pose : 'unknown',
    poseConfidence: clamp01(parsed.pose_confidence),
  })
}
