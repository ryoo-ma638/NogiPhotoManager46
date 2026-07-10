import { useMemo, useState } from 'react'
import { SheetShell } from './UserSetSheets'
import { SearchIcon } from './icons'
import { normalizeForSearch } from '../lib/match'
import type { Binder, CatalogSet } from '../types'

/** 取込でセットを選ぶシート。年度/バインダーのチップ＋日英・空白無視の部分一致検索。 */
export function SetPicker({
  allSets,
  binders,
  candidates,
  onPick,
  onClose,
}: {
  allSets: CatalogSet[]
  binders: Binder[]
  candidates: CatalogSet[]
  onPick: (s: CatalogSet) => void
  onClose: () => void
}) {
  const [q, setQ] = useState('')
  // フィルタ: number=年 / string=バインダーID(封入・その他) / 'candidates'=印字の候補 / null=未選択
  const [filter, setFilter] = useState<number | string | null>(candidates.length > 0 ? 'candidates' : null)
  const norm = (s: string) => s.normalize('NFKC').toLowerCase()
  const t = norm(q.trim())

  const years = useMemo(
    () => [...new Set(allSets.map((s) => s.year).filter((y): y is number => y != null))].sort((a, b) => b - a),
    [allSets],
  )
  const flatBinders = binders.filter((b) => b.sealed) // 封入・その他（年なし）

  // 表示対象のプール（フィルタ適用）。年度を選ぶと、その中で検索が効く
  let pool: CatalogSet[]
  if (filter === 'candidates') pool = candidates
  else if (typeof filter === 'number') pool = allSets.filter((s) => s.year === filter)
  else if (typeof filter === 'string') pool = allSets.filter((s) => s.binderId === filter)
  else pool = t ? allSets : [] // 未選択なら検索したときだけ全体から

  // 検索: 日英シノニム統一（「バースデーライブ」でも「BIRTHDAY LIVE」でも）＋空白/記号を無視して
  // 部分一致（AND）。まずクエリ全体をシノニム変換（"4th members"→"4期"等の連語も効かせる）→語で分割→
  // 各語から空白記号を落として、同じく空白記号を落としたセット名に含まれるか見る。
  const stripSP = (s: string) => s.replace(/[\s._\-–—・、。,!！?？/｜|©'’]+/g, '')
  const tokens = normalizeForSearch(q.trim()).split(/\s+/).map(stripSP).filter(Boolean)
  const nameMatches = (s: CatalogSet) => {
    const n = stripSP(normalizeForSearch(s.name))
    return tokens.every((tok) => n.includes(tok))
  }
  const scoped = tokens.length > 0 ? pool.filter(nameMatches) : pool
  // 検索語があるのに今の絞り込み内で0件 → 全セットから部分一致で自動的に広げる
  const broadened = tokens.length > 0 && scoped.length === 0 ? allSets.filter(nameMatches) : null
  const results = (broadened ?? scoped).slice(0, 200)

  const Chip = ({ label, active, onTap }: { label: string; active: boolean; onTap: () => void }) => (
    <button
      onClick={onTap}
      className={`shrink-0 h-8 px-3 rounded-full text-[12px] font-medium whitespace-nowrap transition-colors ${
        active ? 'bg-violet-600 text-white' : 'bg-white border border-slate-200 text-slate-500'
      }`}
    >
      {label}
    </button>
  )

  return (
    <SheetShell title="セットを選ぶ" onClose={onClose}>
      <div className="sticky top-[52px] z-10 bg-slate-50 pb-2 -mt-1 pt-1 space-y-2">
        <div className="relative">
          <SearchIcon className="w-5 h-5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={typeof filter === 'number' ? `${filter}年の中を検索` : 'セット名で検索'}
            className="w-full h-11 rounded-xl bg-white border border-slate-200 pl-10 pr-3 text-[15px] outline-none focus:border-violet-400"
          />
        </div>
        {/* 年度・バインダーのチップ（最初から年度で選べる） */}
        <div className="flex gap-1.5 overflow-x-auto pb-0.5 [-webkit-overflow-scrolling:touch]">
          {candidates.length > 0 && <Chip label={`候補${candidates.length}`} active={filter === 'candidates'} onTap={() => setFilter('candidates')} />}
          {years.map((y) => (
            <Chip key={y} label={`${y}`} active={filter === y} onTap={() => setFilter(y)} />
          ))}
          {flatBinders.map((b) => (
            <Chip key={b.id} label={b.name.replace('弓木', '')} active={filter === b.id} onTap={() => setFilter(b.id)} />
          ))}
        </div>
      </div>
      {broadened && (
        <p className="pb-1.5 text-[12px] text-violet-600">絞り込みに該当なし。全セットから「{q.trim()}」を表示中</p>
      )}
      <div className="divide-y divide-slate-100 pb-2">
        {results.map((s) => (
          <button key={s.id} onClick={() => onPick(s)} className="w-full text-left px-1 py-2.5 text-[14px] text-slate-700 active:bg-slate-50">
            {s.name}
            <span className="block text-[11px] text-slate-400">{s.year ? `${s.year}年` : (binders.find((b) => b.id === s.binderId)?.name ?? '')}</span>
          </button>
        ))}
        {results.length === 0 && (
          <p className="py-8 text-center text-[13px] text-slate-400">{filter === null && !t ? '年度を選ぶか、セット名で検索' : '見つかりません'}</p>
        )}
      </div>
    </SheetShell>
  )
}
