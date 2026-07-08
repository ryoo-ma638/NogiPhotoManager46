import { useEffect, useRef, useState } from 'react'

const MAX_SHOTS = 30 // 一度の撮影で扱う上限（取込側と同じ）

function cameraErrorMessage(e: unknown): string {
  const name = (e as { name?: string })?.name
  if (name === 'NotAllowedError' || name === 'SecurityError') return 'カメラの使用が許可されていません。設定でこのサイト（アプリ）のカメラを許可してください。'
  if (name === 'NotFoundError' || name === 'OverconstrainedError') return 'カメラが見つかりませんでした。'
  return 'カメラを起動できませんでした。'
}

/**
 * アプリ内ライブカメラ。連続でシャッターを切り、撮った分をまとめて渡す。
 * 撮った各コマは呼び出し側の既存AI判別に流れる（1枚でも複数枚並べても自動で処理される）。
 */
export function CameraCapture({ onDone, onClose }: { onDone: (blobs: Blob[]) => void; onClose: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const [shots, setShots] = useState<{ blob: Blob; url: string }[]>([])
  const shotsRef = useRef<{ blob: Blob; url: string }[]>([])
  shotsRef.current = shots
  const [error, setError] = useState<string | null>(null)
  const [ready, setReady] = useState(false)
  const [flash, setFlash] = useState(false)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      if (!navigator.mediaDevices?.getUserMedia) {
        setError('この端末・ブラウザではカメラを使えません。「写真から選ぶ」をお使いください。')
        return
      }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1920 } },
          audio: false,
        })
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop())
          return
        }
        streamRef.current = stream
        if (videoRef.current) {
          videoRef.current.srcObject = stream
          await videoRef.current.play().catch(() => {})
        }
        setReady(true)
      } catch (e) {
        if (!cancelled) setError(cameraErrorMessage(e))
      }
    })()
    return () => {
      cancelled = true
      streamRef.current?.getTracks().forEach((t) => t.stop())
      for (const s of shotsRef.current) URL.revokeObjectURL(s.url)
    }
  }, [])

  const capture = () => {
    const video = videoRef.current
    if (!video || !video.videoWidth || shots.length >= MAX_SHOTS) return
    const canvas = document.createElement('canvas')
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.drawImage(video, 0, 0)
    canvas.toBlob(
      (b) => {
        if (b) setShots((prev) => [...prev, { blob: b, url: URL.createObjectURL(b) }])
      },
      'image/jpeg',
      0.92,
    )
    setFlash(true)
    window.setTimeout(() => setFlash(false), 120)
  }

  const undo = () => {
    setShots((prev) => {
      const last = prev[prev.length - 1]
      if (last) URL.revokeObjectURL(last.url)
      return prev.slice(0, -1)
    })
  }

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col animate-fade">
      {/* 上部バー */}
      <div className="flex items-center justify-between px-4 pt-[calc(0.75rem+env(safe-area-inset-top))] pb-2 text-white">
        <button onClick={onClose} aria-label="閉じる" className="p-2 -m-2 text-white/80 text-xl leading-none">
          ✕
        </button>
        <span className="font-bold text-[14px]">連続撮影</span>
        <span className="text-[13px] tabular-nums text-white/70 w-10 text-right">{shots.length}/{MAX_SHOTS}</span>
      </div>

      {/* プレビュー */}
      <div className="flex-1 min-h-0 relative flex items-center justify-center">
        <video ref={videoRef} playsInline muted autoPlay className="max-h-full max-w-full object-contain" />
        {flash && <div className="absolute inset-0 bg-white/80 pointer-events-none" />}
        {!ready && !error && <p className="absolute text-white/60 text-sm">カメラを起動中…</p>}
        {error && (
          <div className="absolute inset-x-0 px-8 text-center">
            <p className="text-white/85 text-[14px] leading-relaxed">{error}</p>
            <button onClick={onClose} className="mt-4 h-10 px-6 rounded-xl bg-white/15 text-white text-[14px] font-medium">
              閉じる
            </button>
          </div>
        )}
      </div>

      {/* 撮影サムネの帯 */}
      {shots.length > 0 && (
        <div className="flex gap-2 overflow-x-auto px-4 py-2 [-webkit-overflow-scrolling:touch]">
          {shots.map((s, i) => (
            <img key={i} src={s.url} alt="" className="h-16 w-12 shrink-0 rounded-md object-cover border border-white/20" />
          ))}
        </div>
      )}

      {/* 操作バー */}
      <div className="grid grid-cols-3 items-center px-6 pb-[calc(1.25rem+env(safe-area-inset-bottom))] pt-2">
        <button
          onClick={undo}
          disabled={shots.length === 0}
          className="justify-self-start text-white/80 text-[14px] font-medium disabled:opacity-30"
        >
          1枚戻す
        </button>
        <button
          onClick={capture}
          disabled={!ready || shots.length >= MAX_SHOTS}
          aria-label="シャッター"
          className="justify-self-center w-[74px] h-[74px] rounded-full bg-white/95 ring-4 ring-white/40 active:scale-90 transition-transform disabled:opacity-40"
        >
          <span className="block w-full h-full rounded-full border-[3px] border-black/10" />
        </button>
        <button
          onClick={() => onDone(shots.map((s) => s.blob))}
          disabled={shots.length === 0}
          className="justify-self-end h-11 px-4 rounded-xl bg-violet-600 text-white font-bold text-[14px] disabled:opacity-30 active:scale-95 transition-transform"
        >
          取り込む{shots.length > 0 ? `(${shots.length})` : ''}
        </button>
      </div>
    </div>
  )
}
