import { useEffect, useLayoutEffect, useRef, useState } from 'react'

// 実際のボタンを1つずつスポットライトで光らせ、吹き出しで説明する使い方ツアー。
// App直下で描画し、画面を移動しながらアプリ全体を案内する（ページ内には置かない）。
// nav ステップは「光ったボタンを実際に押して」次の画面へ進む＝ヘッダー/フッターで巡る。

export type TourStep = {
  route: string // この吹き出しを出す画面のハッシュ（'#/'・'#/import'等）
  target: string // 光らせる要素の data-tour 値。空なら画面中央に吹き出し
  title: string
  body: string
  nav?: boolean // true: 光ったボタンを押して次画面へ進む（次へは出さない）。false: 「次へ」で進む
}

type Rect = { top: number; left: number; width: number; height: number }

const HOLE_PAD = 8
const HOLE_RX = 14
const GAP = 12
const EDGE = 12

let cachedInsets: { top: number; bottom: number } | null = null
function safeInsets(): { top: number; bottom: number } {
  if (cachedInsets) return cachedInsets
  try {
    const probe = document.createElement('div')
    probe.style.cssText =
      'position:fixed;visibility:hidden;padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)'
    document.body.appendChild(probe)
    const cs = getComputedStyle(probe)
    cachedInsets = { top: parseFloat(cs.paddingTop) || 0, bottom: parseFloat(cs.paddingBottom) || 0 }
    probe.remove()
  } catch {
    cachedInsets = { top: 0, bottom: 0 }
  }
  return cachedInsets
}

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))
const normHash = (h: string) => (h === '' || h === '#' ? '#/' : h)

export function Tour({ steps, onDone }: { steps: TourStep[]; onDone: () => void }) {
  const [i, setI] = useState(0)
  const [rect, setRect] = useState<Rect | null>(null)
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null)
  const [nonce, setNonce] = useState(0)
  const bubbleRef = useRef<HTMLDivElement>(null)
  const step = steps[i]

  const advance = () => {
    if (i >= steps.length - 1) return onDone()
    setRect(null)
    setPos(null)
    setI((n) => n + 1)
  }

  // ステップが変わるたび: 必要なら画面を合わせ → 描画待ち → 対象を測る
  useEffect(() => {
    if (!step) return
    let cancelled = false
    setRect(null)
    if (normHash(window.location.hash) !== normHash(step.route)) window.location.hash = step.route

    let tries = 0
    const tick = () => {
      if (cancelled || !step) return
      if (!step.target) {
        setRect(null)
        return
      }
      const el = document.querySelector<HTMLElement>(`[data-tour="${step.target}"]`)
      if (el) {
        el.scrollIntoView({ block: 'center', inline: 'nearest' })
        requestAnimationFrame(() => {
          if (cancelled) return
          const r = el.getBoundingClientRect()
          setRect({ top: r.top, left: r.left, width: r.width, height: r.height })
        })
        return
      }
      if (tries++ < 12) {
        window.setTimeout(tick, 60)
        return
      }
      setRect(null)
    }
    requestAnimationFrame(() => requestAnimationFrame(tick))
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [i])

  // nav ステップ: 光ったボタンを押して「次のステップの画面」へ移ったら自動で進む
  useEffect(() => {
    if (!step?.nav) return
    const nextRoute = steps[i + 1]?.route
    if (!nextRoute) return
    const onHash = () => {
      if (normHash(window.location.hash) === normHash(nextRoute)) advance()
    }
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [i])

  // スクロール/リサイズで矩形を測り直す
  useEffect(() => {
    const remeasure = () => {
      setNonce((n) => n + 1)
      if (!step?.target) return
      const el = document.querySelector<HTMLElement>(`[data-tour="${step.target}"]`)
      if (el) {
        const r = el.getBoundingClientRect()
        setRect({ top: r.top, left: r.left, width: r.width, height: r.height })
      }
    }
    window.addEventListener('resize', remeasure)
    window.addEventListener('scroll', remeasure, true)
    return () => {
      window.removeEventListener('resize', remeasure)
      window.removeEventListener('scroll', remeasure, true)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [i])

  // 吹き出しの位置決め（対象の下、無ければ上。画面内へクランプ）
  useLayoutEffect(() => {
    const el = bubbleRef.current
    if (!el) return
    const vw = window.innerWidth
    const vh = window.innerHeight
    const inset = safeInsets()
    const bw = el.offsetWidth
    const bh = el.offsetHeight
    const topLimit = inset.top + EDGE
    const botLimit = vh - inset.bottom - EDGE
    if (rect) {
      const below = rect.top + rect.height + GAP
      const above = rect.top - GAP - bh
      let top = below + bh <= botLimit ? below : above
      top = clamp(top, topLimit, botLimit - bh)
      const left = clamp(rect.left + rect.width / 2 - bw / 2, EDGE, vw - EDGE - bw)
      setPos({ top, left })
    } else if (!step?.target) {
      setPos({ top: clamp((vh - bh) / 2, topLimit, botLimit - bh), left: clamp((vw - bw) / 2, EDGE, vw - EDGE - bw) })
    } else {
      setPos(null)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [i, rect, nonce])

  if (!step) return null
  const last = i === steps.length - 1
  const maxW = Math.min(320, window.innerWidth - 24)

  // nav ステップは暗幕を貫通させ、光ったボタンを実際に押せるようにする（吹き出しだけは操作可）
  return (
    <div className="fixed inset-0 z-[80] animate-fade" style={{ pointerEvents: step.nav ? 'none' : 'auto' }}>
      <svg className="absolute inset-0 w-full h-full pointer-events-none" width="100%" height="100%">
        <defs>
          <mask id="tour-hole">
            <rect x="0" y="0" width="100%" height="100%" fill="white" />
            {rect && (
              <rect
                x={rect.left - HOLE_PAD}
                y={rect.top - HOLE_PAD}
                width={rect.width + HOLE_PAD * 2}
                height={rect.height + HOLE_PAD * 2}
                rx={HOLE_RX}
                fill="black"
              />
            )}
          </mask>
        </defs>
        <rect x="0" y="0" width="100%" height="100%" fill="black" fillOpacity="0.6" mask="url(#tour-hole)" />
        {rect && (
          <rect
            x={rect.left - HOLE_PAD}
            y={rect.top - HOLE_PAD}
            width={rect.width + HOLE_PAD * 2}
            height={rect.height + HOLE_PAD * 2}
            rx={HOLE_RX}
            fill="none"
            stroke="#8b5cf6"
            strokeWidth="2.5"
            className="animate-pulse"
          />
        )}
      </svg>

      <div
        ref={bubbleRef}
        style={{ top: pos?.top ?? -9999, left: pos?.left ?? -9999, maxWidth: maxW, visibility: pos ? 'visible' : 'hidden', pointerEvents: 'auto' }}
        className="absolute w-[86vw] rounded-2xl bg-white p-4 shadow-2xl animate-pop"
      >
        <h2 className="text-[15px] font-bold text-slate-800">{step.title}</h2>
        <p className="mt-1 text-[13px] text-slate-500 leading-relaxed">{step.body}</p>
        {step.nav && <p className="mt-1.5 text-[12px] font-bold text-violet-500">👆 光っているボタンを押して進みます</p>}
        <div className="mt-3.5 flex items-center justify-between">
          <button onClick={onDone} className="text-[13px] font-medium text-slate-400 active:opacity-60 transition-opacity">
            スキップ
          </button>
          <span className="text-[12px] font-medium text-slate-400 tabular-nums">
            {i + 1} / {steps.length}
          </span>
          {step.nav ? (
            <span className="w-9" /> // nav は「押して進む」ので次へは出さない（レイアウト維持のための空き）
          ) : (
            <button
              onClick={advance}
              className="h-9 px-4 rounded-xl bg-violet-600 text-white text-[13px] font-bold active:scale-[0.98] transition-transform"
            >
              {last ? '完了' : '次へ'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
