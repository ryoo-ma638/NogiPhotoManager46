import { useAppData } from '../lib/appData'
import { Gauge, Header, ProgressBar, pct } from '../components/ui'
import { ScreenGuide } from '../components/ScreenGuide'
import { useScrollRestore } from '../lib/router'
import type { Rarity } from '../types'

export default function StatsPage() {
  const { catalog, allSets, statOf, photosOf, owned, countOf, wanted } = useAppData()
  useScrollRestore('stats')

  let ownedTotal = 0
  let total = 0
  let completeSets = 0
  let spareTotal = 0 // 譲れる枚数（各写真の count-1 の合計）
  const byBinder = catalog.binders.map((b) => ({ binder: b, owned: 0, total: 0 }))
  const byYear = new Map<number | null, { owned: number; total: number }>()
  const byRarity: Record<Rarity, { owned: number; total: number }> = {
    normal: { owned: 0, total: 0 },
    R: { owned: 0, total: 0 },
    SR: { owned: 0, total: 0 },
    other: { owned: 0, total: 0 },
  }

  for (const s of allSets) {
    const st = statOf(s.id)
    ownedTotal += st.owned
    total += st.total
    if (st.total > 0 && st.owned === st.total) completeSets++
    const bb = byBinder.find((x) => x.binder.id === s.binderId)
    if (bb) {
      bb.owned += st.owned
      bb.total += st.total
    }
    const y = byYear.get(s.year) ?? { owned: 0, total: 0 }
    y.owned += st.owned
    y.total += st.total
    byYear.set(s.year, y)
    for (const p of photosOf(s)) {
      byRarity[p.rarity].total++
      if (owned.has(p.id)) byRarity[p.rarity].owned++
      const c = countOf(p.id)
      if (c >= 2) spareTotal += c - 1
    }
  }

  const years = [...byYear.entries()].sort((a, b) => (a[0] ?? 9999) - (b[0] ?? 9999))

  return (
    <>
      <Header title="統計" subtitle={catalog.member.name} />
      <ScreenGuide
        guideKey="stats"
        title="統計でわかること"
        points={[
          { icon: '📊', label: '全体', desc: '総コンプ率と所有・コンプ数。' },
          { icon: '🔁', label: 'トレード', desc: '譲れるダブりと欲しい件数。' },
          { icon: '⭐', label: 'レア別', desc: '通常・R・SR別の集め具合。' },
          { icon: '📅', label: '年別', desc: '年ごとの所有ぐあい。' },
        ]}
      />
      <div className="mx-auto max-w-lg px-4 pt-4 pb-6 space-y-4">
        {/* 全体 */}
        <section className="rounded-2xl bg-white border border-slate-100 shadow-sm p-5 flex items-center gap-5">
          <Gauge value={pct(ownedTotal, total)} size={96} trackClass="text-slate-100" barClass="text-violet-500">
            <div className="text-center">
              <div className="text-xl font-extrabold text-slate-800 leading-none">{pct(ownedTotal, total)}%</div>
            </div>
          </Gauge>
          <div className="space-y-1.5 text-[13px]">
            <p>
              <span className="text-slate-400">所有</span>{' '}
              <b className="text-slate-800 text-base">{ownedTotal.toLocaleString()}</b>
              <span className="text-slate-400"> / {total.toLocaleString()} 枚</span>
            </p>
            <p>
              <span className="text-slate-400">コンプ</span> <b className="text-slate-800 text-base">{completeSets}</b>
              <span className="text-slate-400"> / {allSets.length} セット</span>
            </p>
          </div>
        </section>

        {/* トレード */}
        <section className="rounded-2xl bg-white border border-slate-100 shadow-sm p-4">
          <h2 className="text-[13px] font-bold text-slate-500 mb-2.5">トレード</h2>
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl bg-emerald-50 p-3 text-center">
              <div className="text-2xl font-extrabold text-emerald-600 leading-none tabular-nums">{spareTotal}</div>
              <div className="text-[11px] text-emerald-700 mt-1">譲れるダブり（枚）</div>
            </div>
            <div className="rounded-xl bg-pink-50 p-3 text-center">
              <div className="text-2xl font-extrabold text-pink-600 leading-none tabular-nums">{wanted.size}</div>
              <div className="text-[11px] text-pink-700 mt-1">特に欲しい（件）</div>
            </div>
          </div>
        </section>

        {/* レアリティ別 */}
        <section className="rounded-2xl bg-white border border-slate-100 shadow-sm p-4 space-y-3">
          <h2 className="text-[13px] font-bold text-slate-500">レアリティ別</h2>
          {(
            [
              ['normal', '通常', 'text-slate-600'],
              ['R', 'レア（R）', 'text-sky-600'],
              ['SR', 'スペシャルレア（SR）', 'text-amber-600'],
              ['other', 'その他（配信限定など）', 'text-fuchsia-600'],
            ] as [Rarity, string, string][]
          ).map(([key, label, cls]) => (
            <div key={key}>
              <div className="flex justify-between text-[13px] mb-1">
                <span className={`font-medium ${cls}`}>{label}</span>
                <span className="text-slate-400 tabular-nums">
                  {byRarity[key].owned}/{byRarity[key].total}（{pct(byRarity[key].owned, byRarity[key].total)}%）
                </span>
              </div>
              <ProgressBar value={pct(byRarity[key].owned, byRarity[key].total)} />
            </div>
          ))}
        </section>

        {/* 年別 */}
        <section className="rounded-2xl bg-white border border-slate-100 shadow-sm p-4 space-y-3">
          <h2 className="text-[13px] font-bold text-slate-500">年別</h2>
          {years.map(([year, v]) => (
            <div key={year ?? 'sealed'}>
              <div className="flex justify-between text-[13px] mb-1">
                <span className="font-medium text-slate-600">{year === null ? '封入' : `${year}年`}</span>
                <span className="text-slate-400 tabular-nums">
                  {v.owned}/{v.total}（{pct(v.owned, v.total)}%）
                </span>
              </div>
              <ProgressBar value={pct(v.owned, v.total)} />
            </div>
          ))}
        </section>
      </div>
    </>
  )
}
