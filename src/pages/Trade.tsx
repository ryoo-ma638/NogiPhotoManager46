import { useMemo } from 'react'
import { useAppData } from '../lib/appData'
import { Header } from '../components/ui'

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

export default function TradePage() {
  const { allSets, photosOf, countOf, wanted } = useAppData()

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

  return (
    <>
      <Header title="トレード" subtitle="譲れるダブりと、特に欲しいもの" back />
      <div className="mx-auto max-w-lg px-4 pt-4 pb-28 space-y-5">
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
