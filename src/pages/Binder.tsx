import { useMemo, useState } from 'react'
import { useAppData } from '../lib/appData'
import { CheckCircle, ChevronRight, SealCheck } from '../components/icons'
import { Header, ProgressBar, pct } from '../components/ui'
import { navigate, useScrollRestore } from '../lib/router'
import type { CatalogSet, Template } from '../types'

type Filter = 'all' | 'incomplete' | 'complete'

const TEMPLATE_BADGE: Partial<Record<Template, { label: string; cls: string }>> = {
  four4: { label: '4種', cls: 'bg-slate-100 text-slate-500' },
  five5: { label: '5種', cls: 'bg-violet-100 text-violet-600' },
  event6: { label: '6種', cls: 'bg-sky-100 text-sky-600' },
  rareSet8: { label: '8種', cls: 'bg-amber-100 text-amber-600' },
}

export default function BinderPage({ binderId }: { binderId: string }) {
  const { catalog, statOf, photosOf, owned, toggle } = useAppData()
  const [filter, setFilter] = useState<Filter>('all')
  useScrollRestore(`binder:${binderId}`)

  const binder = catalog.binders.find((b) => b.id === binderId)
  const sets = useMemo(
    () => catalog.sets.filter((s) => s.binderId === binderId).sort((a, b) => a.sortIndex - b.sortIndex),
    [catalog, binderId],
  )

  if (!binder) {
    return (
      <>
        <Header title="バインダーが見つかりません" back />
      </>
    )
  }

  const filtered = sets.filter((s) => {
    const st = statOf(s.id)
    const complete = st.total > 0 && st.owned === st.total
    if (filter === 'complete') return complete
    if (filter === 'incomplete') return !complete
    return true
  })

  // 年ごとにグループ化（封入は year=null で1グループ）
  const groups: { year: number | null; sets: CatalogSet[] }[] = []
  for (const s of filtered) {
    const last = groups[groups.length - 1]
    if (last && last.year === s.year) last.sets.push(s)
    else groups.push({ year: s.year, sets: [s] })
  }

  const o = sets.reduce((n, s) => n + statOf(s.id).owned, 0)
  const t = sets.reduce((n, s) => n + statOf(s.id).total, 0)

  return (
    <>
      <Header title={binder.name} subtitle={`${o}/${t}枚（${pct(o, t)}%）`} back />
      <div className="mx-auto max-w-lg px-4 pt-3 pb-4">
        {/* フィルタ */}
        <div className="grid grid-cols-3 gap-1 rounded-xl bg-slate-200/60 p-1 mb-3">
          {(
            [
              ['all', 'すべて'],
              ['incomplete', '未コンプ'],
              ['complete', 'コンプ'],
            ] as [Filter, string][]
          ).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setFilter(key)}
              className={`h-8 rounded-lg text-[13px] font-medium transition-colors ${
                filter === key ? 'bg-white shadow-sm text-slate-800' : 'text-slate-500'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {filtered.length === 0 && (
          <div className="py-16 text-center space-y-2">
            <SealCheck className="w-10 h-10 text-emerald-400 mx-auto" />
            <p className="font-bold text-slate-600">{filter === 'incomplete' ? 'すべてコンプ済み！' : '該当なし'}</p>
            {filter === 'incomplete' && <p className="text-xs text-slate-400">このバインダーに未所有はありません</p>}
          </div>
        )}

        {groups.map((g, gi) => (
          <section key={`${g.year ?? 'sealed'}-${gi}`} className="mb-4">
            {g.year !== null && (
              <h2 className="sticky top-14 z-10 -mx-4 px-4 py-1.5 bg-slate-50/90 backdrop-blur text-[13px] font-bold text-slate-500">
                {g.year}年
              </h2>
            )}
            <div className="rounded-2xl bg-white border border-slate-100 shadow-sm divide-y divide-slate-100 overflow-hidden">
              {g.sets.map((s) => (
                <SetRow key={s.id} set={s} statOf={statOf} photosOf={photosOf} owned={owned} toggle={toggle} />
              ))}
            </div>
          </section>
        ))}
      </div>
    </>
  )
}

function SetRow({
  set,
  statOf,
  photosOf,
  owned,
  toggle,
}: {
  set: CatalogSet
  statOf: (id: string) => { owned: number; total: number }
  photosOf: (s: CatalogSet) => { id: string }[]
  owned: Set<string>
  toggle: (id: string) => void
}) {
  const st = statOf(set.id)
  const complete = st.total > 0 && st.owned === st.total
  const badge = TEMPLATE_BADGE[set.template]

  // 封入(1種)は行から直接トグル
  if (set.template === 'single1') {
    const photo = photosOf(set)[0]
    const isOwned = photo ? owned.has(photo.id) : false
    return (
      <div className="flex items-center gap-3 px-4 py-3">
        <div className="min-w-0 flex-1">
          <span className={`text-[15px] font-medium ${isOwned ? '' : 'text-slate-500'}`}>{set.name}</span>
          {set.note && <p className="text-[11px] text-slate-400 truncate">{set.note}</p>}
        </div>
        <button
          onClick={() => photo && toggle(photo.id)}
          aria-label={isOwned ? '未所有にする' : '所有にする'}
          className="p-1.5 -m-1 active:scale-90 transition-transform"
        >
          <CheckCircle className={`w-7 h-7 ${isOwned ? 'text-emerald-500' : 'text-slate-300'}`} filled={isOwned} />
        </button>
      </div>
    )
  }

  return (
    <button
      onClick={() => navigate(`/s/${set.id}`)}
      className="w-full flex items-center gap-3 px-4 py-3 text-left active:bg-slate-50 transition-colors"
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className={`text-[15px] font-medium truncate ${complete ? '' : 'text-slate-600'}`}>{set.name}</span>
          {badge && <span className={`shrink-0 px-1.5 py-0.5 rounded-md text-[10px] font-bold ${badge.cls}`}>{badge.label}</span>}
        </div>
        <div className="mt-1.5 flex items-center gap-2">
          <ProgressBar value={pct(st.owned, st.total)} className="flex-1" />
          <span className="text-[11px] text-slate-400 tabular-nums shrink-0">
            {st.owned}/{st.total}
          </span>
        </div>
        {set.note && <p className="mt-1 text-[11px] text-slate-400 truncate">{set.note}</p>}
      </div>
      {complete ? <SealCheck className="w-5 h-5 text-emerald-500 shrink-0" /> : <ChevronRight className="w-5 h-5 text-slate-300 shrink-0" />}
    </button>
  )
}
