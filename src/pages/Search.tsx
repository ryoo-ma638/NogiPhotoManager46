import { useMemo, useState } from 'react'
import { useAppData } from '../lib/appData'
import { ChevronRight, SealCheck, SearchIcon } from '../components/icons'
import { Header, ProgressBar, pct } from '../components/ui'
import { navigate } from '../lib/router'
import { KIND_LABELS, kindOf, type Kind } from '../lib/kinds'

// カナ/かな・全角半角・大文字小文字をある程度吸収して比較
function norm(s: string): string {
  return s.normalize('NFKC').toLowerCase()
}

export default function SearchPage() {
  const { catalog, allSets, statOf } = useAppData()
  const [q, setQ] = useState('')
  const [unownedOnly, setUnownedOnly] = useState(false)
  const [kindFilter, setKindFilter] = useState<Kind | null>(null)

  const binderName = useMemo(() => {
    const m = new Map<string, string>()
    for (const b of catalog.binders) m.set(b.id, b.name)
    return m
  }, [catalog])

  const sealedBinders = useMemo(() => new Set(catalog.binders.filter((b) => b.sealed).map((b) => b.id)), [catalog])

  const query = norm(q.trim())
  const active = query.length > 0 || unownedOnly || kindFilter !== null

  const results = useMemo(() => {
    if (!active) return []
    return allSets
      .filter((s) => {
        if (query && !norm(`${s.name} ${s.note ?? ''}`).includes(query)) return false
        if (kindFilter && kindOf(s, sealedBinders.has(s.binderId)) !== kindFilter) return false
        if (unownedOnly) {
          const st = statOf(s.id)
          if (st.total > 0 && st.owned === st.total) return false
        }
        return true
      })
      .sort((a, b) => a.sortIndex - b.sortIndex)
  }, [active, query, unownedOnly, kindFilter, allSets, statOf, sealedBinders])

  return (
    <>
      <Header title="検索" back />
      <div className="mx-auto max-w-lg px-4 pt-3 pb-6">
        {/* 検索入力 */}
        <div className="relative">
          <SearchIcon className="w-5 h-5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            autoFocus
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="セット名・メモで検索"
            className="w-full h-11 rounded-xl bg-white border border-slate-200 pl-10 pr-4 text-[15px] outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100 transition"
          />
        </div>

        {/* 未所有だけ */}
        <button
          onClick={() => setUnownedOnly((v) => !v)}
          className={`mt-3 inline-flex items-center gap-2 h-9 px-3 rounded-full text-[13px] font-medium transition-colors ${
            unownedOnly ? 'bg-violet-600 text-white' : 'bg-slate-100 text-slate-500'
          }`}
        >
          <span className={`w-2 h-2 rounded-full ${unownedOnly ? 'bg-white' : 'bg-slate-300'}`} />
          未所有だけ
        </button>

        {/* 種類で絞り込み */}
        <div className="mt-2 flex gap-1.5 overflow-x-auto pb-1 -mx-4 px-4 [-webkit-overflow-scrolling:touch]">
          {KIND_LABELS.map((k) => (
            <button
              key={k.id}
              onClick={() => setKindFilter(kindFilter === k.id ? null : k.id)}
              className={`shrink-0 h-8 px-3 rounded-full text-[12px] font-medium whitespace-nowrap transition-colors ${
                kindFilter === k.id ? 'bg-violet-600 text-white' : 'bg-white border border-slate-200 text-slate-500'
              }`}
            >
              {k.label}
            </button>
          ))}
        </div>

        {/* 結果 */}
        <div className="mt-4">
          {!active && (
            <div className="py-20 text-center text-slate-400 space-y-2">
              <SearchIcon className="w-10 h-10 mx-auto text-slate-300" />
              <p className="text-[13px]">セット名を入力するか「未所有だけ」で絞り込み</p>
            </div>
          )}

          {active && results.length === 0 && (
            <div className="py-20 text-center text-slate-400">
              <p className="text-[14px] font-medium text-slate-500">一致するセットがありません</p>
              {query && <p className="text-[12px] mt-1">「{q.trim()}」</p>}
            </div>
          )}

          {results.length > 0 && (
            <>
              <p className="text-[12px] text-slate-400 mb-2">{results.length}件</p>
              <div className="rounded-2xl bg-white border border-slate-100 shadow-sm divide-y divide-slate-100 overflow-hidden">
                {results.map((s) => {
                  const st = statOf(s.id)
                  const complete = st.total > 0 && st.owned === st.total
                  const crumb = [s.year ? `${s.year}年` : '封入', binderName.get(s.binderId)].filter(Boolean).join('・')
                  return (
                    <button
                      key={s.id}
                      onClick={() => navigate(`/s/${s.id}`)}
                      className="w-full flex items-center gap-3 px-4 py-3 text-left active:bg-slate-50 transition-colors"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="text-[15px] font-medium text-slate-700 truncate">{s.name}</div>
                        <div className="text-[11px] text-slate-400 truncate">{crumb}</div>
                        <div className="mt-1.5 flex items-center gap-2">
                          <ProgressBar value={pct(st.owned, st.total)} className="flex-1" />
                          <span className="text-[11px] text-slate-400 tabular-nums shrink-0">
                            {st.owned}/{st.total}
                          </span>
                        </div>
                      </div>
                      {complete ? (
                        <SealCheck className="w-5 h-5 text-emerald-500 shrink-0" />
                      ) : (
                        <ChevronRight className="w-5 h-5 text-slate-300 shrink-0" />
                      )}
                    </button>
                  )
                })}
              </div>
            </>
          )}
        </div>
      </div>
    </>
  )
}
