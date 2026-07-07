import { useEffect, useState } from 'react'
import { imageURL } from '../lib/images'
import { ConfirmSheet } from './ui'
import type { Photo } from '../types'

/** 添付画像のサムネイル（IndexedDBから遅延読み込み） */
export function ThumbImg({ photoId, version = 0, className = '' }: { photoId: string; version?: number; className?: string }) {
  const [url, setUrl] = useState<string | null>(null)
  useEffect(() => {
    let live = true
    void imageURL(photoId, 'thumb').then((u) => {
      if (live) setUrl(u)
    })
    return () => {
      live = false
    }
  }, [photoId, version])
  if (!url) return null
  return <img src={url} alt="" className={className} draggable={false} />
}

/** フルスクリーンの画像ビューア（差し替え・削除つき） */
export function PhotoViewer({
  photo,
  version = 0,
  onClose,
  onReplace,
  onRotate,
  onDelete,
}: {
  photo: Photo
  version?: number
  onClose: () => void
  onReplace: () => void
  onRotate: () => void
  onDelete: () => void
}) {
  const [url, setUrl] = useState<string | null>(null)
  const [confirmDel, setConfirmDel] = useState(false)

  useEffect(() => {
    let live = true
    void imageURL(photo.id, 'full').then((u) => {
      if (live) setUrl(u)
    })
    return () => {
      live = false
    }
  }, [photo.id, version])

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col animate-fade">
      <div className="flex items-center justify-between px-4 pt-[calc(0.75rem+env(safe-area-inset-top))] pb-2 text-white">
        <span className="font-bold text-[15px]">{photo.label}</span>
        <button onClick={onClose} aria-label="閉じる" className="p-2 -m-2 text-white/80 text-xl leading-none">
          ✕
        </button>
      </div>
      <div className="flex-1 min-h-0 flex items-center justify-center p-3" onClick={onClose}>
        {url ? (
          <img src={url} alt={photo.label} className="max-h-full max-w-full object-contain rounded-lg" onClick={(e) => e.stopPropagation()} />
        ) : (
          <p className="text-white/50 text-sm">読み込み中…</p>
        )}
      </div>
      <div className="px-4 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-2 grid grid-cols-3 gap-2">
        <button onClick={onReplace} className="h-11 rounded-xl bg-white/15 text-white font-medium text-[14px] active:bg-white/25 transition-colors">
          差し替え
        </button>
        <button onClick={onRotate} className="h-11 rounded-xl bg-white/15 text-white font-medium text-[14px] active:bg-white/25 transition-colors">
回転（90°）
        </button>
        <button onClick={() => setConfirmDel(true)} className="h-11 rounded-xl bg-red-500/85 text-white font-bold text-[14px] active:bg-red-500 transition-colors">
          画像を削除
        </button>
      </div>

      {confirmDel && (
        <ConfirmSheet
          message={`「${photo.label}」の画像を削除しますか？\n（所有の○×は変わりません）`}
          confirmLabel="削除する"
          danger
          onConfirm={() => {
            setConfirmDel(false)
            onDelete()
          }}
          onCancel={() => setConfirmDel(false)}
        />
      )}
    </div>
  )
}
