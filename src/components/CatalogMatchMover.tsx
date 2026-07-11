import { useRef, useState } from 'react'
import { useAppData } from '../lib/appData'
import { SheetShell } from './UserSetSheets'
import { ConfirmSheet } from './ui'
import { getImageRow } from '../lib/db'
import { navigate } from '../lib/router'
import { normName } from '../lib/labels'
import type { CatalogSet, Photo } from '../types'

/**
 * 「その他」の仮置き項目を、同名のカタログ本セットへ移すバナー（案②＝自動移送）。
 * その他の手動セットを開いたとき、枠ラベルがカタログ（非ユーザー）セット名と一致すれば表示。
 * 「本セットへ移動」で画像と所有を本セットへ移し（target-first＝無損失）、この枠を消す。
 */
export function CatalogMatchMover({ set }: { set: CatalogSet }) {
  const { allSets, photosOf, userSetById, attachImage, removeImage, updateUserSet, countOf, setCount, imageIds } = useAppData()
  const [moveFor, setMoveFor] = useState<{ source: Photo; target: CatalogSet } | null>(null)
  const [confirmMove, setConfirmMove] = useState<{ source: Photo; target: CatalogSet; targetPhoto: Photo } | null>(null)
  const [busy, setBusy] = useState(false)
  const busyRef = useRef(false) // 連打での二重移送を同期的に止める

  // その他の手動セットだけが対象
  if (!set.user || set.binderId !== 'b-other') return null

  const matches = photosOf(set)
    .map((p) => {
      const target = allSets.find((s) => !s.user && normName(s.name) === normName(p.label))
      return target ? { source: p, target } : null
    })
    .filter((m): m is { source: Photo; target: CatalogSet } => m !== null)
  if (matches.length === 0) return null

  // 画像と所有を本セットへ移してから、その他の枠を消す（target-first で途中失敗しても無損失）
  const doMove = async (source: Photo, target: CatalogSet, targetPhoto: Photo) => {
    if (busyRef.current) return
    busyRef.current = true
    setBusy(true)
    try {
      const img = await getImageRow(source.id)
      if (img?.full) await attachImage(targetPhoto.id, img.full)
      // 枚数は加算（万一ターゲットに既存があっても消えないように）
      setCount(targetPhoto.id, countOf(targetPhoto.id) + Math.max(1, countOf(source.id)))
      // ここまででターゲットは確保済み。ソースを掃除
      if (img) await removeImage(source.id)
      setCount(source.id, 0)
      const u = userSetById.get(set.id)
      // ソース枠を消す＝所有・画像・♡もまとめて掃除される（target は所有済になるので♡の付け替えは不要）
      if (u) await updateUserSet({ ...u, photos: u.photos.filter((p) => p.slot !== source.slot) }, [source.id])
      setMoveFor(null)
      navigate(`/s/${target.id}`)
    } finally {
      busyRef.current = false
      setBusy(false)
    }
  }

  // ターゲット枠に既に画像があれば上書き確認を挟む（無ければそのまま移す）
  const requestMove = (source: Photo, target: CatalogSet, targetPhoto: Photo) => {
    if (imageIds.has(targetPhoto.id)) {
      setConfirmMove({ source, target, targetPhoto })
      setMoveFor(null)
    } else {
      void doMove(source, target, targetPhoto)
    }
  }

  const onMove = (source: Photo, target: CatalogSet) => {
    const tps = photosOf(target)
    if (tps.length === 1) requestMove(source, target, tps[0]!)
    else setMoveFor({ source, target }) // 複数ポーズはどの枠か選ぶ
  }

  return (
    <>
      <div className="mb-3 rounded-2xl bg-sky-50 border border-sky-200 p-3 space-y-2">
        <div>
          <p className="text-[13px] font-bold text-sky-800">カタログに見つかりました</p>
          <p className="text-[11px] text-sky-600 leading-relaxed">同名のセットがカタログにあります。本セットへ移すと画像と所有が移り、この枠は消えます。</p>
        </div>
        {matches.map((m) => (
          <div key={m.source.slot} className="flex items-center gap-2 bg-white rounded-xl px-3 py-2">
            <div className="min-w-0 flex-1">
              <p className="text-[13px] font-medium text-slate-700 truncate">{m.source.label}</p>
              <p className="text-[11px] text-slate-400 truncate">→ {m.target.name}</p>
            </div>
            <button
              onClick={() => onMove(m.source, m.target)}
              disabled={busy}
              className="shrink-0 h-8 px-3 rounded-lg bg-sky-500 text-white text-[12px] font-bold disabled:opacity-40 active:bg-sky-600"
            >
              本セットへ移動
            </button>
          </div>
        ))}
      </div>

      {moveFor && (
        <SheetShell title={`枠を選ぶ — ${moveFor.target.name}`} onClose={() => setMoveFor(null)}>
          <p className="pb-2 text-[12px] text-slate-400">「{moveFor.source.label}」をどの枠に入れますか？</p>
          <div className="divide-y divide-slate-100 pb-2">
            {photosOf(moveFor.target).map((tp) => (
              <button
                key={tp.slot}
                onClick={() => requestMove(moveFor.source, moveFor.target, tp)}
                disabled={busy}
                className="w-full text-left px-1 py-3 text-[14px] text-slate-700 active:bg-slate-50 disabled:opacity-40 flex items-center justify-between"
              >
                <span>{tp.label}</span>
                {imageIds.has(tp.id) && <span className="text-[11px] text-amber-600">画像あり</span>}
              </button>
            ))}
          </div>
        </SheetShell>
      )}

      {confirmMove && (
        <ConfirmSheet
          message={`「${confirmMove.target.name}」の枠「${confirmMove.targetPhoto.label}」には既に画像があります。\nこの画像に置き換えますか？（枚数は合算されます）`}
          confirmLabel="置き換えて移動"
          danger
          onConfirm={() => {
            const m = confirmMove
            setConfirmMove(null)
            void doMove(m.source, m.target, m.targetPhoto)
          }}
          onCancel={() => setConfirmMove(null)}
        />
      )}
    </>
  )
}
