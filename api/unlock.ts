// オーナー解除のパスワード照合（Vercel Serverless Function）。
// パスワードは Vercel の環境変数 OWNER_PASSWORD に置く（クライアント／リポジトリには埋め込まない）。
export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'POSTのみ対応' })

  const owner = process.env.OWNER_PASSWORD
  if (!owner) return res.status(503).json({ ok: false, error: 'OWNER_PASSWORD が未設定です' })

  const { password } = req.body ?? {}
  const ok = typeof password === 'string' && password === owner
  return res.status(200).json({ ok })
}
