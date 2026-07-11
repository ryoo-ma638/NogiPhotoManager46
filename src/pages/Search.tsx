import { useEffect, useMemo, useState } from 'react'
import { useAppData } from '../lib/appData'
import { ChevronRight, SealCheck, SearchIcon } from '../components/icons'
import { Header, ProgressBar, pct } from '../components/ui'
import { navigate } from '../lib/router'
import { KIND_LABELS, kindOf, type Kind } from '../lib/kinds'
import { getSearchPrefs, setSearchPrefs, type SortBy } from '../lib/prefs'
import { ScreenGuide } from '../components/ScreenGuide'

// カナ/かな・全角半角・大文字小文字をある程度吸収して比較
function norm(s: string): string {
  return s.normalize('NFKC').toLowerCase()
}

function ToggleChip({ label, on, onClick }: { label: string; on: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 h-9 px-3 rounded-full text-[13px] font-medium transition-colors ${
        on ? 'bg-violet-600 text-white' : 'bg-slate-100 text-slate-500'
      }`}
    >
      <span className={`w-2 h-2 rounded-full ${on ? 'bg-white' : 'bg-slate-300'}`} />
      {label}
    </button>
  )
}

/** 種類の単一選択チップ（カード内でトグルと同じ配色に統一） */
function KindChip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`shrink-0 h-8 px-3 rounded-full text-[12px] font-medium whitespace-nowrap transition-colors ${
        active ? 'bg-violet-600 text-white' : 'bg-slate-100 text-slate-500'
      }`}
    >
      {label}
    </button>
  )
}

export default function SearchPage() {
  const { catalog, allSets, statOf, photosOf, imageIds, countOf, wanted } = useAppData()
  const [q, setQ] = useState('') // 検索文字は毎回まっさらでよいので保存しない
  const saved = useMemo(() => getSearchPrefs(), []) // 起動時に一度だけ読む
  const [unownedOnly, setUnownedOnly] = useState(saved.unownedOnly)
  const [dupOnly, setDupOnly] = useState(saved.dupOnly)
  const [wantOnly, setWantOnly] = useState(saved.wantOnly)
  const [kindFilter, setKindFilter] = useState<Kind | null>(saved.kindFilter as Kind | null)
  const [sortBy, setSortBy] = useState<SortBy>(saved.sortBy)

  // 絞り込み・並び替えは変えるたびに保存（検索文字は含めない）
  useEffect(() => {
    setSearchPrefs({ unownedOnly, dupOnly, wantOnly, kindFilter, sortBy })
  }, [unownedOnly, dupOnly, wantOnly, kindFilter, sortBy])

  const binderName = useMemo(() => {
    const m = new Map<string, string>()
    for (const b of catalog.binders) m.set(b.id, b.name)
    return m
  }, [catalog])

  const sealedBinders = useMemo(() => new Set(catalog.binders.filter((b) => b.sealed).map((b) => b.id)), [catalog])

  const query = norm(q.trim())
  const active = query.length > 0 || unownedOnly || dupOnly || wantOnly || kindFilter !== null
  // 絞り込み（検索文字を除く）が1つでもONか。ONのときだけ「すべて解除」を出す。並びは維持。
  const anyFilter = unownedOnly || dupOnly || wantOnly || kindFilter !== null
  const clearFilters = () => {
    setUnownedOnly(false)
    setDupOnly(false)
    setWantOnly(false)
    setKindFilter(null)
  }

  const results = useMemo(() => {
    if (!active) return []
    const filtered = allSets.filter((s) => {
      if (query && !norm(`${s.name} ${s.note ?? ''}`).includes(query)) return false
      if (kindFilter && kindOf(s, sealedBinders.has(s.binderId)) !== kindFilter) return false
      if (unownedOnly) {
        const st = statOf(s.id)
        if (st.total > 0 && st.owned === st.total) return false
      }
      if (dupOnly && !photosOf(s).some((p) => countOf(p.id) >= 2)) return false
      if (wantOnly && !photosOf(s).some((p) => wanted.has(p.id))) return false
      return true
    })
    const rate = (s: (typeof allSets)[number]) => {
      const st = statOf(s.id)
      return st.total > 0 ? st.owned / st.total : 0
    }
    return filtered.sort((a, b) => {
      if (sortBy === 'name') return a.name.localeCompare(b.name, 'ja')
      if (sortBy === 'year') return (b.year ?? 0) - (a.year ?? 0) || a.sortIndex - b.sortIndex
      if (sortBy === 'owned') return rate(b) - rate(a) || a.sortIndex - b.sortIndex
      return a.sortIndex - b.sortIndex
    })
  }, [active, query, unownedOnly, dupOnly, wantOnly, kindFilter, sortBy, allSets, statOf, photosOf, countOf, wanted, sealedBinders])

  return (
    <>
      <Header title="検索" back />
      <ScreenGuide
        guideKey="search"
        title="検索の使い方"
        points={[
          { icon: '🔍', label: '名前で探す', desc: 'セット名やメモで検索できます。' },
          { icon: '🎯', label: '絞り込み', desc: '未所有・ダブり・特に欲しい・種類で絞れます。' },
          { icon: '↕️', label: '並び替え', desc: 'カタログ順・所有率・名前・年で並べ替え。設定は次も残ります。' },
        ]}
      />
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

        {/* 絞り込み・種類・並び替えを1カードに集約 */}
        <div className="mt-3 rounded-2xl bg-white border border-slate-200 shadow-sm p-3 space-y-2.5">
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-bold text-slate-400">絞り込み</p>
            {anyFilter && (
              <button onClick={clearFilters} className="text-[11px] font-medium text-violet-600 active:opacity-60 transition-opacity">
                すべて解除
              </button>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            <ToggleChip label="未所有" on={unownedOnly} onClick={() => setUnownedOnly((v) => !v)} />
            <ToggleChip label="ダブり" on={dupOnly} onClick={() => setDupOnly((v) => !v)} />
            <ToggleChip label="特に欲しい" on={wantOnly} onClick={() => setWantOnly((v) => !v)} />
          </div>
          <div className="flex items-center gap-2">
            <span className="shrink-0 text-[11px] font-bold text-slate-400">種類</span>
            <div className="min-w-0 flex-1 flex gap-1.5 overflow-x-auto pb-0.5 [-webkit-overflow-scrolling:touch]">
              <KindChip label="すべて" active={kindFilter === null} onClick={() => setKindFilter(null)} />
              {KIND_LABELS.map((k) => (
                <KindChip key={k.id} label={k.label} active={kindFilter === k.id} onClick={() => setKindFilter(kindFilter === k.id ? null : k.id)} />
              ))}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="shrink-0 text-[11px] font-bold text-slate-400">並び</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
              className="flex-1 h-9 rounded-lg bg-slate-50 border border-slate-200 px-2.5 text-[13px] text-slate-600 outline-none focus:border-violet-400"
              aria-label="並び替え"
            >
              <option value="catalog">カタログ順</option>
              <option value="owned">所有率が高い順</option>
              <option value="name">名前順</option>
              <option value="year">新しい年順</option>
            </select>
          </div>
        </div>

        {/* 結果 */}
        <div className="mt-4">
          {!active && (
            <div className="py-20 text-center text-slate-400 space-y-2">
              <SearchIcon className="w-10 h-10 mx-auto text-slate-300" />
              <p className="text-[13px]">セット名で検索、または絞り込みで探す</p>
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
                  const crumb = [s.year ? `${s.year}年` : null, binderName.get(s.binderId)].filter(Boolean).join('・')
                  return (
                    <button
                      key={s.id}
                      onClick={() => navigate(`/s/${s.id}`)}
                      className="w-full flex items-center gap-3 px-4 py-3 text-left active:bg-slate-50 transition-colors"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[15px] font-medium text-slate-700 truncate">{s.name}</span>
                          {photosOf(s).some((p) => imageIds.has(p.id)) && (
                            <span className="shrink-0 px-1.5 py-0.5 rounded-md text-[10px] font-bold bg-emerald-50 text-emerald-600">画像あり</span>
                          )}
                        </div>
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
