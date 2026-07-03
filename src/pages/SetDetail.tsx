import { useState } from 'react'
import { useAppData } from '../lib/appData'
import { CheckCircle, PhotoIcon, SealCheck } from '../components/icons'
import { ConfirmSheet, Header, ProgressBar, pct } from '../components/ui'
import { EditSetSheet } from '../components/UserSetSheets'
import { goBack } from '../lib/router'
import type { Photo, Rarity } from '../types'

const RARITY_STYLE: Record<Rarity, { tile: string; badge?: string; badgeLabel?: string }> = {
  normal: { tile: 'bg-slate-100 text-slate-300' },
  R: { tile: 'bg-gradient-to-br from-sky-100 to-sky-200 text-sky-300', badge: 'bg-sky-500 text-white', badgeLabel: 'R' },
  SR: { tile: 'bg-gradient-to-br from-amber-100 to-amber-200 text-amber-300', badge: 'bg-gradient-to-r from-amber-500 to-yellow-500 text-white', badgeLabel: 'SR' },
}

export default function SetDetailPage({ setId }: { setId: string }) {
  const { catalog, setById, userSetById, photosOf, owned, toggle, setMany, updateUserSet, deleteUserSet } = useAppData()
  const [confirm, setConfirm] = useState<'own-all' | 'disown-all' | null>(null)
  const [showEdit, setShowEdit] = useState(false)

  const set = setById.get(setId)
  if (!set) return <Header title="セットが見つかりません" back />

  const binder = catalog.binders.find((b) => b.id === set.binderId)
  const userSet = set.user ? userSetById.get(set.id) : undefined
  const photos = photosOf(set)
  const ownedCount = photos.filter((p) => owned.has(p.id)).length
  const complete = photos.length > 0 && ownedCount === photos.length
  const crumb = [binder?.name, set.year ? `${set.year}年` : null].filter(Boolean).join('・')

  return (
    <>
      <Header
        title={set.name}
        subtitle={crumb}
        back
        right={
          userSet ? (
            <button
              onClick={() => setShowEdit(true)}
              className="text-[14px] font-medium text-violet-600 p-2 -mr-2 active:opacity-60 transition-opacity"
            >
              編集
            </button>
          ) : undefined
        }
      />
      <div className="mx-auto max-w-lg px-4 pt-4 pb-36">
        {/* 進捗ヘッダー */}
        <section className="rounded-2xl bg-white border border-slate-100 shadow-sm p-4">
          <div className="flex items-center justify-between">
            <div className="text-[15px] font-bold text-slate-700">
              {ownedCount}
              <span className="text-slate-400 font-normal"> / {photos.length} 所有</span>
            </div>
            {complete && (
              <span className="animate-pop inline-flex items-center gap-1 rounded-full bg-emerald-500 text-white text-[12px] font-bold px-2.5 py-1">
                <SealCheck className="w-3.5 h-3.5" />
                コンプリート
              </span>
            )}
          </div>
          <ProgressBar value={pct(ownedCount, photos.length)} className="mt-2.5" />
          {set.note && <p className="mt-2.5 text-[12px] text-slate-400">メモ: {set.note}</p>}
        </section>

        {/* ポーズグリッド */}
        <section className="mt-4 grid grid-cols-3 gap-3">
          {photos.map((p) => (
            <PoseCard key={p.id} photo={p} isOwned={owned.has(p.id)} onTap={() => toggle(p.id)} />
          ))}
        </section>
      </div>

      {/* 下部アクション（親指到達圏） */}
      <div className="fixed inset-x-0 bottom-[calc(4.25rem+env(safe-area-inset-bottom))] z-10 pointer-events-none">
        <div className="mx-auto max-w-lg px-4">
          {!complete ? (
            <button
              onClick={() => setConfirm('own-all')}
              className="pointer-events-auto w-full h-12 rounded-2xl bg-violet-600 text-white font-bold shadow-lg shadow-violet-200 active:scale-[0.98] transition-transform"
            >
              すべて所有にする
            </button>
          ) : (
            <button
              onClick={() => setConfirm('disown-all')}
              className="pointer-events-auto w-full h-10 rounded-2xl bg-white/90 backdrop-blur border border-slate-200 text-slate-500 text-[13px] font-medium active:scale-[0.98] transition-transform"
            >
              すべて未所有に戻す
            </button>
          )}
        </div>
      </div>

      {showEdit && userSet && (
        <EditSetSheet
          userSet={userSet}
          onSave={(row) => {
            // 消えた枠の所有記録を掃除してから保存
            const kept = new Set(row.photos.map((p) => p.slot))
            const removedIds = userSet.photos
              .filter((p) => !kept.has(p.slot))
              .map((p) => `${catalog.member.id}:${userSet.id}:${p.slot}`)
            void updateUserSet(row, removedIds).then(() => setShowEdit(false))
          }}
          onDelete={() => {
            void deleteUserSet(userSet.id).then(() => {
              setShowEdit(false)
              goBack()
            })
          }}
          onClose={() => setShowEdit(false)}
        />
      )}

      {confirm && (
        <ConfirmSheet
          message={
            confirm === 'own-all'
              ? `「${set.name}」の${photos.length}枚すべてを\n所有にしますか？`
              : `「${set.name}」の${photos.length}枚すべてを\n未所有に戻しますか？`
          }
          confirmLabel={confirm === 'own-all' ? 'すべて所有' : 'すべて未所有'}
          danger={confirm === 'disown-all'}
          onConfirm={() => {
            setMany(
              photos.map((p) => p.id),
              confirm === 'own-all',
            )
            setConfirm(null)
          }}
          onCancel={() => setConfirm(null)}
        />
      )}
    </>
  )
}

function PoseCard({ photo, isOwned, onTap }: { photo: Photo; isOwned: boolean; onTap: () => void }) {
  const style = RARITY_STYLE[photo.rarity]
  return (
    <button
      onClick={onTap}
      aria-label={`${photo.label}を${isOwned ? '未所有' : '所有'}にする`}
      className={`relative rounded-2xl p-1.5 text-left transition-all active:scale-95 border-2 ${
        isOwned ? 'bg-white border-emerald-400 shadow-sm' : 'bg-white/70 border-transparent'
      }`}
    >
      {/* 写真エリア（生写真比率 89:127。P1.5でサムネに差し替え） */}
      <div className={`aspect-[89/127] rounded-xl flex items-center justify-center ${style.tile} ${isOwned ? '' : 'grayscale opacity-70'}`}>
        <PhotoIcon className="w-8 h-8" />
      </div>
      {/* 所有チェック（独立した意味を持つ領域） */}
      <div className="absolute top-3 right-3">
        <CheckCircle
          className={`w-6 h-6 drop-shadow-sm ${isOwned ? 'text-emerald-500' : 'text-slate-300'}`}
          filled={isOwned}
        />
      </div>
      <div className="mt-1.5 px-0.5 pb-0.5 flex items-center justify-between gap-1">
        <span className={`text-[12px] font-bold truncate ${isOwned ? 'text-slate-700' : 'text-slate-400'}`}>{photo.label}</span>
        {style.badge && <span className={`shrink-0 rounded px-1 py-px text-[9px] font-extrabold ${style.badge}`}>{style.badgeLabel}</span>}
      </div>
    </button>
  )
}
