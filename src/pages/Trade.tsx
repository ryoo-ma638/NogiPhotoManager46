import { useMemo, useState } from 'react'
import { useAppData } from '../lib/appData'
import { Header } from '../components/ui'
import { SheetShell } from '../components/UserSetSheets'

interface TradeItem {
  photoId: string
  setName: string
  label: string
  qty: number // 譲れる枚数（求は1）
}

function group(items: TradeItem[]): [string, TradeItem[]][] {
  const m = new Map<string, TradeItem[]>()
  for (const it of items) {
    const arr = m.get(it.setName) ?? []
    arr.push(it)
    m.set(it.setName, arr)
  }
  return [...m.entries()]
}

/** X等に貼り付けるための求/譲テキストを作る。求は「特に欲しい」だけ（全所有はさらけ出さない） */
function buildTradeText(member: string, give: TradeItem[], want: TradeItem[]): string {
  const fmt = (items: TradeItem[]) =>
    group(items)
      .map(([set, arr]) => `・${set}: ${arr.map((it) => (it.qty > 1 ? `${it.label}×${it.qty}` : it.label)).join('、')}`)
      .join('\n')
  return [
    `${member} 生写真 【譲/求】`,
    '',
    '▼譲（お譲りできます）',
    give.length ? fmt(give) : '（なし）',
    '',
    '▼求（探しています）',
    want.length ? fmt(want) : '（なし）',
  ].join('\n')
}

export default function TradePage() {
  const { catalog, allSets, photosOf, countOf, wanted } = useAppData()
  const [sheet, setSheet] = useState(false)
  const [toast, setToast] = useState<string | null>(null)

  const { give, want } = useMemo(() => {
    const give: TradeItem[] = []
    const want: TradeItem[] = []
    for (const s of allSets) {
      for (const p of photosOf(s)) {
        const c = countOf(p.id)
        if (c >= 2) give.push({ photoId: p.id, setName: s.name, label: p.label, qty: c - 1 })
        if (wanted.has(p.id)) want.push({ photoId: p.id, setName: s.name, label: p.label, qty: 1 })
      }
    }
    return { give, want }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allSets, photosOf, countOf, wanted])

  const text = buildTradeText(catalog.member.name, give, want)
  const showToast = (m: string) => {
    setToast(m)
    window.setTimeout(() => setToast(null), 2600)
  }
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text)
      showToast('コピーしました')
    } catch {
      showToast('コピーできませんでした。下の文を長押しで選んでコピーしてください')
    }
  }

  return (
    <>
      <Header title="トレード" subtitle="譲れるダブりと、特に欲しいもの" back />
      <div className="mx-auto max-w-lg px-4 pt-4 pb-28 space-y-5">
        <button
          onClick={() => setSheet(true)}
          disabled={give.length === 0 && want.length === 0}
          className="w-full h-12 rounded-2xl bg-violet-600 text-white font-bold shadow-lg shadow-violet-200 disabled:opacity-40 active:scale-[0.99] transition"
        >
          求/譲リストを作る（X貼り付け用）
        </button>
        <TradeSection
          title="譲れる（ダブり）"
          n={give.length}
          chipClass="bg-emerald-50 text-emerald-700"
          empty="ダブり（2枚以上持っている写真）はまだありません。セット詳細で写真の枚数を ＋ してください。"
          groups={group(give)}
        />
        <TradeSection
          title="求（特に欲しい）"
          n={want.length}
          chipClass="bg-pink-50 text-pink-600"
          empty="「特に欲しい」はまだありません。未所有の写真の♡で印を付けられます。"
          groups={group(want)}
        />
      </div>

      {sheet && (
        <SheetShell title="求/譲リスト" onClose={() => setSheet(false)}>
          <div className="space-y-3 pb-2">
            <p className="text-[12px] text-slate-400 leading-relaxed">
              このままXなどに貼り付けられます。求は「特に欲しい」だけ載せています（全所有は出しません）。
            </p>
            <textarea
              readOnly
              value={text}
              onFocus={(e) => e.currentTarget.select()}
              className="w-full h-64 rounded-xl bg-slate-50 border border-slate-200 p-3 text-[13px] leading-relaxed text-slate-700 outline-none"
            />
            <button
              onClick={() => void copy()}
              className="w-full h-12 rounded-2xl bg-violet-600 text-white font-bold active:scale-[0.98] transition-transform"
            >
              コピー
            </button>
          </div>
        </SheetShell>
      )}

      {toast && (
        <div className="fixed inset-x-0 bottom-[calc(8rem+env(safe-area-inset-bottom))] z-[70] flex justify-center px-4 pointer-events-none">
          <div className="animate-pop rounded-full bg-slate-900/90 text-white text-[13px] font-medium px-4 py-2 shadow-lg">{toast}</div>
        </div>
      )}
    </>
  )
}

function TradeSection({
  title,
  n,
  chipClass,
  empty,
  groups,
}: {
  title: string
  n: number
  chipClass: string
  empty: string
  groups: [string, TradeItem[]][]
}) {
  return (
    <section>
      <h2 className="px-1 pb-2 text-[14px] font-bold text-slate-600">
        {title} <span className="text-slate-400 font-normal">{n}件</span>
      </h2>
      {groups.length === 0 ? (
        <p className="rounded-xl bg-white border border-slate-100 px-3 py-4 text-[12px] text-slate-400 leading-relaxed">{empty}</p>
      ) : (
        <div className="space-y-2">
          {groups.map(([setName, items]) => (
            <div key={setName} className="rounded-xl bg-white border border-slate-100 shadow-sm p-3">
              <p className="text-[13px] font-bold text-slate-700 truncate">{setName}</p>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {items.map((it) => (
                  <span key={it.photoId} className={`text-[12px] rounded-full px-2 py-0.5 ${chipClass}`}>
                    {it.label}
                    {it.qty > 1 ? ` ×${it.qty}` : ''}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
