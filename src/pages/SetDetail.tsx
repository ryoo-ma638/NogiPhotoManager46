import { useRef, useState } from 'react'
import { useAppData } from '../lib/appData'
import { SealCheck } from '../components/icons'
import { ConfirmSheet, Header, ProgressBar, pct } from '../components/ui'
import { EditSetSheet } from '../components/UserSetSheets'
import { PoseCard } from '../components/PoseCard'
import { PhotoViewer } from '../components/images'
import { getImageRow } from '../lib/db'
import { rotateImage } from '../lib/images'
import { goBack, navigate } from '../lib/router'
import type { Photo } from '../types'

export default function SetDetailPage({ setId }: { setId: string }) {
  const { catalog, setById, userSetById, photosOf, owned, countOf, setCount, wanted, toggleWanted, toggle, setMany, updateUserSet, deleteUserSet, imageIds, attachImage, removeImage } =
    useAppData()
  const [confirm, setConfirm] = useState<'own-all' | 'disown-all' | null>(null)
  const [showEdit, setShowEdit] = useState(false)
  const [viewer, setViewer] = useState<Photo | null>(null)
  const [imgVersion, setImgVersion] = useState(0)
  const [toast, setToast] = useState<string | null>(null)
  const [showWantHelp, setShowWantHelp] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const attachTarget = useRef<string | null>(null)

  const set = setById.get(setId)
  if (!set) return <Header title="セットが見つかりません" back />

  const binder = catalog.binders.find((b) => b.id === set.binderId)
  const userSet = set.user ? userSetById.get(set.id) : undefined
  const photos = photosOf(set)
  const ownedCount = photos.filter((p) => owned.has(p.id)).length
  const complete = photos.length > 0 && ownedCount === photos.length
  const crumb = [binder?.name, set.year ? `${set.year}年` : null].filter(Boolean).join('・')

  const showToast = (msg: string) => {
    setToast(msg)
    window.setTimeout(() => setToast(null), 2400)
  }

  // ♡（特に欲しい）: 設定/解除でトーストを出し、初回だけ機能を説明する
  const onHeart = (photoId: string) => {
    const wasWanted = wanted.has(photoId)
    toggleWanted(photoId)
    if (!wasWanted) {
      showToast('「特に欲しい」に設定しました')
      try {
        if (!localStorage.getItem('nogi_want_explained')) {
          localStorage.setItem('nogi_want_explained', '1')
          setShowWantHelp(true)
        }
      } catch {
        /* localStorage不可でも続行 */
      }
    } else {
      showToast('「特に欲しい」を外しました')
    }
  }

  const pickImageFor = (photoId: string) => {
    attachTarget.current = photoId
    fileRef.current?.click()
  }

  const onFilePicked = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    const target = attachTarget.current
    attachTarget.current = null
    if (!file || !target) return
    try {
      await attachImage(target, file)
      setImgVersion((v) => v + 1)
      if (!owned.has(target)) {
        toggle(target)
        showToast('画像を添付し、所有にしました')
      } else {
        showToast('画像を添付しました')
      }
    } catch (err) {
      showToast(`添付に失敗: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

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
            <PoseCard
              key={p.id}
              photo={p}
              isOwned={owned.has(p.id)}
              count={countOf(p.id)}
              onSetCount={(n) => setCount(p.id, n)}
              isWanted={wanted.has(p.id)}
              onToggleWanted={() => onHeart(p.id)}
              hasImage={imageIds.has(p.id)}
              imgVersion={imgVersion}
              onToggle={() => toggle(p.id)}
              onOpen={() => setViewer(p)}
              onAttach={() => pickImageFor(p.id)}
            />
          ))}
        </section>
      </div>

      {/* 画像選択（カメラ/ライブラリ） */}
      <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => void onFilePicked(e)} />

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

      {viewer && (
        <PhotoViewer
          photo={viewer}
          version={imgVersion}
          onClose={() => setViewer(null)}
          onReplace={() => pickImageFor(viewer.id)}
          onRotate={() => {
            void (async () => {
              const row = await getImageRow(viewer.id)
              if (!row) return
              const rotated = await rotateImage(row.full, 90)
              await attachImage(viewer.id, rotated)
              setImgVersion((v) => v + 1)
            })()
          }}
          onDelete={() => {
            void removeImage(viewer.id).then(() => {
              setViewer(null)
              setImgVersion((v) => v + 1)
              showToast('画像を削除しました（○×は変わっていません）')
            })
          }}
        />
      )}

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

      {/* 初回ハート時: 「特に欲しい」の説明 */}
      {showWantHelp && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 animate-fade p-5" onClick={() => setShowWantHelp(false)}>
          <div className="w-full max-w-xs rounded-3xl bg-white p-5 shadow-2xl animate-pop" onClick={(e) => e.stopPropagation()}>
            <div className="flex h-24 items-center justify-center rounded-2xl bg-gradient-to-br from-pink-100 to-rose-100">
              <span className="text-[52px] leading-none" aria-hidden>💗</span>
            </div>
            <h2 className="mt-4 text-center text-[16px] font-bold text-slate-800">「特に欲しい」に設定しました</h2>
            <p className="mt-1.5 text-center text-[13px] text-slate-500 leading-relaxed">
              ♡は「求（特に欲しい）」の印。トレードの求リストにまとまります。
            </p>
            <div className="mt-4 flex items-center gap-2">
              <button onClick={() => setShowWantHelp(false)} className="h-11 px-3 rounded-xl text-slate-400 font-medium text-[13px]">
                閉じる
              </button>
              <button
                onClick={() => {
                  setShowWantHelp(false)
                  navigate('/trade')
                }}
                className="flex-1 h-11 rounded-xl bg-violet-600 text-white font-bold active:scale-[0.98] transition-transform"
              >
                トレードを見る
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div className="fixed inset-x-0 bottom-[calc(8rem+env(safe-area-inset-bottom))] z-[70] flex justify-center px-4 pointer-events-none">
          <div className="animate-pop rounded-full bg-slate-900/90 text-white text-[13px] font-medium px-4 py-2 shadow-lg">{toast}</div>
        </div>
      )}
    </>
  )
}

