import { useMemo, useState } from 'react'
import { useAppData } from '../lib/appData'
import { CheckCircle, ChevronRight, SealCheck } from '../components/icons'
import { Header, ProgressBar, pct } from '../components/ui'
import { navigate, useScrollRestore } from '../lib/router'
import { AddSetSheet } from '../components/UserSetSheets'
import { AddOtherItemSheet } from '../components/AddOtherItemSheet'
import { KIND_LABELS, kindOf, type Kind } from '../lib/kinds'
import { circled, normName } from '../lib/labels'
import type { CatalogSet, Template, UserSet } from '../types'

type Filter = 'all' | 'incomplete' | 'complete'

const TEMPLATE_BADGE: Partial<Record<Template, { label: string; cls: string }>> = {
  four4: { label: '4種', cls: 'bg-slate-100 text-slate-500' },
  five5: { label: '5種', cls: 'bg-violet-100 text-violet-600' },
  event6: { label: '6種', cls: 'bg-sky-100 text-sky-600' },
  rareSet8: { label: '8種', cls: 'bg-amber-100 text-amber-600' },
}

export default function BinderPage({ binderId }: { binderId: string }) {
  const { catalog, allSets, statOf, photosOf, owned, toggle, addUserSet, updateUserSet, attachImage, userSetById, imageIds } = useAppData()
  const [filter, setFilter] = useState<Filter>('all')
  const [kindFilter, setKindFilter] = useState<Kind | null>(null)
  const [showAdd, setShowAdd] = useState(false)
  const [showAddOther, setShowAddOther] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const showToast = (m: string) => {
    setToast(m)
    window.setTimeout(() => setToast(null), 2000)
  }
  useScrollRestore(`binder:${binderId}`)

  const binder = catalog.binders.find((b) => b.id === binderId)
  const sets = useMemo(
    () => allSets.filter((s) => s.binderId === binderId).sort((a, b) => a.sortIndex - b.sortIndex),
    [allSets, binderId],
  )

  // 追加シート用: このバインダーで選べる年（IDの年範囲を優先）
  const years = useMemo(() => {
    const m = binderId.match(/b(\d{4})-(\d{4})/)
    if (m) return [Number(m[1]), Number(m[2])]
    return [...new Set(sets.map((s) => s.year).filter((y): y is number => y !== null))].sort()
  }, [binderId, sets])

  if (!binder) {
    return (
      <>
        <Header title="バインダーが見つかりません" back />
      </>
    )
  }

  // このバインダーに存在する種類だけチップを出す（封入バインダーは全部sealedなので非表示）
  const presentKinds = new Set(sets.map((s) => kindOf(s, binder?.sealed ?? false)))
  const availableKinds = binder?.sealed ? [] : KIND_LABELS.filter((k) => presentKinds.has(k.id))

  const filtered = sets.filter((s) => {
    if (kindFilter && kindOf(s, binder?.sealed ?? false) !== kindFilter) return false
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

  // 同名の項目（既存セット名 or その他の枠ラベル）があればその名前を返す（重複防止の警告用）
  const findDuplicateName = (name: string): string | null => {
    const n = normName(name)
    if (!n) return null
    for (const s of allSets) if (normName(s.name) === n) return s.name
    for (const s of allSets) {
      if (s.binderId !== 'b-other' || !s.user) continue
      for (const p of photosOf(s)) if (normName(p.label) === n) return p.label
    }
    return null
  }

  // 「その他」へ未分類の写真を1枚追加: 既定セット「未分類」に連番枠(①②③)で足し、画像添付＋所有化。
  const HOLDING_NAME = '未分類'
  const addOtherItem = async (file: Blob, name: string) => {
    const label = name.trim()
    try {
      const holding = allSets.find((s) => s.binderId === 'b-other' && s.user && s.name === HOLDING_NAME)
      let setId: string
      let slot: string
      if (holding) {
        const u = userSetById.get(holding.id)
        if (!u) return
        const used = new Set(u.photos.map((p) => p.slot))
        let n = 1
        while (used.has(`c${n}`)) n++
        slot = `c${n}`
        await updateUserSet({ ...u, photos: [...u.photos, { slot, label: label || circled(u.photos.length + 1), rarity: 'other' }] }, [])
        setId = holding.id
      } else {
        setId = `user-${crypto.randomUUID().slice(0, 8)}`
        slot = 'c1'
        const row: UserSet = {
          id: setId,
          binderId: 'b-other',
          year: null,
          name: HOLDING_NAME,
          template: 'single1',
          note: null,
          sortIndex: (sets.length > 0 ? Math.max(...sets.map((s) => s.sortIndex)) : 0) + 10,
          photos: [{ slot, label: label || circled(1), rarity: 'other' }],
          createdAt: new Date().toISOString(),
        }
        await addUserSet(row)
      }
      const photoId = `${catalog.member.id}:${setId}:${slot}`
      await attachImage(photoId, file)
      if (!owned.has(photoId)) toggle(photoId)
      showToast(label ? `「${label}」をその他に追加しました` : 'その他に追加しました')
    } catch (err) {
      showToast(`追加に失敗: ${err instanceof Error ? err.message : String(err)}`)
      throw err // シートを開いたまま（やり直せる）
    }
  }

  return (
    <>
      <Header
        title={binder.name}
        subtitle={`${o}/${t}枚（${pct(o, t)}%）`}
        back
        right={
          <button
            onClick={() => setShowAdd(true)}
            aria-label="セットを追加"
            className="p-2 -mr-2 rounded-full text-violet-600 text-2xl leading-none font-light active:bg-slate-200/70 transition-colors"
          >
            ＋
          </button>
        }
      />
      <div className="mx-auto max-w-lg px-4 pt-3 pb-4">
        {/* その他: 未分類の写真をすぐ追加できる目立つ入口 */}
        {binder.id === 'b-other' && (
          <button
            onClick={() => setShowAddOther(true)}
            className="w-full mb-3 h-12 rounded-2xl bg-fuchsia-500 text-white font-bold text-[15px] shadow-sm shadow-fuchsia-200 flex items-center justify-center gap-1.5 active:scale-[0.99] transition"
          >
            <span className="text-xl leading-none">＋</span> 未分類の写真を追加
          </button>
        )}
        {/* 種類チップ */}
        {availableKinds.length > 1 && (
          <div className="flex gap-1.5 overflow-x-auto pb-2 -mx-4 px-4 [-webkit-overflow-scrolling:touch]">
            <KindChip label="すべて" active={kindFilter === null} onTap={() => setKindFilter(null)} />
            {availableKinds.map((k) => (
              <KindChip key={k.id} label={k.label} active={kindFilter === k.id} onTap={() => setKindFilter(kindFilter === k.id ? null : k.id)} />
            ))}
          </div>
        )}

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

        {showAdd && (
          <AddSetSheet
            binder={binder}
            years={years}
            defaultSortIndex={(year) => {
              const same = sets.filter((s) => s.year === year)
              return (same.length > 0 ? Math.max(...same.map((s) => s.sortIndex)) : 0) + 10
            }}
            onSave={(row) => {
              void addUserSet(row).then(() => {
                setShowAdd(false)
                navigate(`/s/${row.id}`)
              })
            }}
            onClose={() => setShowAdd(false)}
          />
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
                <SetRow key={s.id} set={s} statOf={statOf} photosOf={photosOf} owned={owned} toggle={toggle} imageIds={imageIds} />
              ))}
            </div>
          </section>
        ))}
      </div>

      {showAddOther && (
        <AddOtherItemSheet onAdd={addOtherItem} checkDuplicate={findDuplicateName} onClose={() => setShowAddOther(false)} />
      )}
      {toast && (
        <div className="fixed inset-x-0 bottom-[calc(5rem+env(safe-area-inset-bottom))] z-50 flex justify-center px-4 pointer-events-none">
          <div className="rounded-full bg-slate-900/90 text-white text-[13px] font-medium px-4 py-2 shadow-lg">{toast}</div>
        </div>
      )}
    </>
  )
}

function KindChip({ label, active, onTap }: { label: string; active: boolean; onTap: () => void }) {
  return (
    <button
      onClick={onTap}
      className={`shrink-0 h-8 px-3 rounded-full text-[12px] font-medium whitespace-nowrap transition-colors ${
        active ? 'bg-violet-600 text-white' : 'bg-white border border-slate-200 text-slate-500'
      }`}
    >
      {label}
    </button>
  )
}

function SetRow({
  set,
  statOf,
  photosOf,
  owned,
  toggle,
  imageIds,
}: {
  set: CatalogSet
  statOf: (id: string) => { owned: number; total: number }
  photosOf: (s: CatalogSet) => { id: string }[]
  owned: Set<string>
  toggle: (id: string) => void
  imageIds: Set<string>
}) {
  const st = statOf(set.id)
  const complete = st.total > 0 && st.owned === st.total
  const hasImg = photosOf(set).some((p) => imageIds.has(p.id))
  const badge = set.user ? { label: '追加', cls: 'bg-fuchsia-100 text-fuchsia-600' } : TEMPLATE_BADGE[set.template]

  // 1枚だけのセット: 行タップで詳細（画像閲覧）へ、右端の○は直接トグル
  if (st.total === 1 && !set.user) {
    const photo = photosOf(set)[0]
    const isOwned = photo ? owned.has(photo.id) : false
    return (
      <div
        role="button"
        tabIndex={0}
        onClick={() => navigate(`/s/${set.id}`)}
        className="flex items-center gap-3 px-4 py-3 cursor-pointer active:bg-slate-50 transition-colors"
      >
        <div className="min-w-0 flex-1">
          <span className="flex items-center gap-1.5">
            <span className={`text-[15px] font-medium truncate ${isOwned ? '' : 'text-slate-500'}`}>{set.name}</span>
            {hasImg && <span className="shrink-0 px-1.5 py-0.5 rounded-md text-[10px] font-bold bg-emerald-50 text-emerald-600">画像あり</span>}
          </span>
          {set.note && <p className="text-[11px] text-slate-400 truncate">{set.note}</p>}
        </div>
        <button
          onClick={(e) => {
            e.stopPropagation()
            if (photo) toggle(photo.id)
          }}
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
          {hasImg && <span className="shrink-0 px-1.5 py-0.5 rounded-md text-[10px] font-bold bg-emerald-50 text-emerald-600">画像あり</span>}
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
