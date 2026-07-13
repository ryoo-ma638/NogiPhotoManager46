import { useEffect, useState } from 'react'

// 画面ごとの初回ガイド。初めてその画面を開いたとき「ここで何ができるか」を1回だけ出す。
// 見たかどうかは localStorage nogi_guide_<key> に記録。設定からまとめてリセットできる。
const KEY_PREFIX = 'nogi_guide_'

function seen(key: string): boolean {
  try {
    return localStorage.getItem(KEY_PREFIX + key) === '1'
  } catch {
    return true // localStorage不可なら出さない
  }
}
function markSeen(key: string): void {
  try {
    localStorage.setItem(KEY_PREFIX + key, '1')
  } catch {
    /* ignore */
  }
}

/** 画面ガイドのフラグを全消去（設定の「もう一度見る」用）。 */
export function resetScreenGuides(): void {
  try {
    const keys: string[] = []
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i)
      if (k && k.startsWith(KEY_PREFIX)) keys.push(k)
    }
    keys.forEach((k) => localStorage.removeItem(k))
  } catch {
    /* ignore */
  }
}

export type GuidePoint = { icon: string; label: string; desc: string }

/** 初回だけ自動表示する画面ガイド。各画面の本文先頭に置く。 */
export function ScreenGuide({
  guideKey,
  title,
  intro,
  points,
  enabled = true,
}: {
  guideKey: string
  title: string
  intro?: string
  points: GuidePoint[]
  /** false の間は出さない。後から true になったら1回だけ開く（ホームは初回チュートリアルの後に出す用） */
  enabled?: boolean
}) {
  const [open, setOpen] = useState(() => enabled && !seen(guideKey))
  // enabled が後から true になったとき（チュートリアルを見終えた後など）に1回だけ開く
  useEffect(() => {
    if (enabled && !seen(guideKey)) setOpen(true)
  }, [enabled, guideKey])
  if (!open) return null
  const close = () => {
    markSeen(guideKey)
    setOpen(false)
  }
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-5 animate-fade" onClick={close}>
      <div className="w-full max-w-sm rounded-3xl bg-white p-5 shadow-xl max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-[17px] font-bold text-slate-800">{title}</h2>
        {intro && <p className="mt-1 text-[13px] text-slate-500 leading-relaxed">{intro}</p>}
        <ul className="mt-3.5 space-y-3">
          {points.map((p, i) => (
            <li key={i} className="flex gap-3">
              <span className="shrink-0 w-8 h-8 rounded-lg bg-violet-50 text-[16px] flex items-center justify-center">{p.icon}</span>
              <div className="min-w-0">
                <p className="text-[13px] font-bold text-slate-700">{p.label}</p>
                <p className="text-[12px] text-slate-500 leading-relaxed">{p.desc}</p>
              </div>
            </li>
          ))}
        </ul>
        <button onClick={close} className="mt-4 w-full h-11 rounded-xl bg-violet-600 text-white font-bold text-[14px] active:scale-[0.99] transition">
          分かった
        </button>
      </div>
    </div>
  )
}
