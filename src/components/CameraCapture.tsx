import { useEffect, useRef, useState } from 'react'

const MAX_SHOTS = 30 // 一度の撮影で扱う上限（取込側と同じ）

function cameraErrorMessage(e: unknown): string {
  const name = (e as { name?: string })?.name
  if (name === 'NotAllowedError' || name === 'SecurityError') return 'カメラが許可されていません。設定で許可してください。'
  if (name === 'NotFoundError' || name === 'OverconstrainedError') return 'カメラが見つかりませんでした。'
  return 'カメラを起動できませんでした。'
}

/**
 * アプリ内ライブカメラ。連続でシャッターを切る。
 * 撮った1枚ごとに onShot(id, blob) を呼び、撮影と並行して親側が解析を始める。
 * 「1枚戻す」は onUndo(id) でその1枚を取り消す。
 */
export function CameraCapture({
  onShot,
  onUndo,
  onClose,
}: {
  onShot: (id: string, blob: Blob) => void
  onUndo: (id: string) => void
  onClose: () => void
}) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const [shots, setShots] = useState<{ id: string; url: string }[]>([])
  const shotsRef = useRef<{ id: string; url: string }[]>([])
  shotsRef.current = shots
  const [error, setError] = useState<string | null>(null)
  const [ready, setReady] = useState(false)
  const [flash, setFlash] = useState(false)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      if (!navigator.mediaDevices?.getUserMedia) {
        setError('カメラを使えません。「写真から選ぶ」をお使いください。')
        return
      }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1080 } },
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
    // プレビューは object-cover（画面いっぱい・はみ出しは切り取り表示）。撮影も「画面に見えている範囲」だけを
    // 切り出す。全フレームを撮ると、縦持ちのとき映像が横長のまま入って余白だらけになるため（見た通りに撮る）。
    const vw = video.videoWidth
    const vh = video.videoHeight
    const cw = video.clientWidth || window.innerWidth
    const ch = video.clientHeight || window.innerHeight
    const scale = Math.max(cw / vw, ch / vh) // object-cover の拡大率
    const sw = Math.min(vw, cw / scale) // 見えているソース幅
    const sh = Math.min(vh, ch / scale) // 見えているソース高
    const sx = (vw - sw) / 2
    const sy = (vh - sh) / 2
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(sw)
    canvas.height = Math.round(sh)
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.drawImage(video, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height)
    canvas.toBlob(
      (b) => {
        if (!b) return
        const id = crypto.randomUUID()
        setShots((prev) => [...prev, { id, url: URL.createObjectURL(b) }])
        onShot(id, b) // 親が即・解析キューへ
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
      if (last) {
        URL.revokeObjectURL(last.url)
        onUndo(last.id)
      }
      return prev.slice(0, -1)
    })
  }

  return (
    <div className="fixed inset-0 z-50 bg-black animate-fade">
      {/* ライブ映像を画面いっぱいに（純正カメラのように全面表示。横持ちなら横長で大きく） */}
      <video ref={videoRef} playsInline muted autoPlay className="absolute inset-0 w-full h-full object-cover" />
      {flash && <div className="absolute inset-0 bg-white/80 pointer-events-none" />}
      {!ready && !error && <p className="absolute inset-0 flex items-center justify-center text-white/60 text-sm">カメラを起動中…</p>}
      {error && (
        <div className="absolute inset-0 flex flex-col items-center justify-center px-8 text-center">
          <p className="text-white/85 text-[14px] leading-relaxed">{error}</p>
          <button onClick={onClose} className="mt-4 h-10 px-6 rounded-xl bg-white/15 text-white text-[14px] font-medium">
            閉じる
          </button>
        </div>
      )}

      {/* 上部バー（映像に重ねる） */}
      <div className="absolute top-0 inset-x-0 flex items-center justify-between px-4 pt-[calc(0.75rem+env(safe-area-inset-top))] pb-5 text-white bg-gradient-to-b from-black/55 to-transparent">
        <button onClick={onClose} aria-label="閉じる" className="p-2 -m-2 text-white/90 text-xl leading-none">
          ✕
        </button>
        <span className="font-bold text-[14px]">連続撮影</span>
        <span className="text-[13px] tabular-nums text-white/80 w-10 text-right">{shots.length}/{MAX_SHOTS}</span>
      </div>

      {/* 撮影サムネ: 縦持ち=下（操作の上）／横持ち=左端の縦並び。生写真比率の縦箱で余白なく表示 */}
      {shots.length > 0 && (
        <div
          className="absolute z-10 flex gap-2 [-webkit-overflow-scrolling:touch]
            portrait:inset-x-0 portrait:bottom-[calc(7.5rem+env(safe-area-inset-bottom))] portrait:flex-row portrait:overflow-x-auto portrait:px-4
            landscape:inset-y-0 landscape:left-0 landscape:w-32 landscape:flex-col landscape:items-center landscape:justify-center landscape:overflow-y-auto landscape:py-4 landscape:pl-[calc(0.5rem+env(safe-area-inset-left))]"
        >
          {shots.map((s) => (
            <img key={s.id} src={s.url} alt="" className="h-24 w-[70px] shrink-0 rounded-md object-cover border border-white/25" />
          ))}
        </div>
      )}

      {/* 操作: 縦持ち=下に横並び（シャッター中央）／横持ち=右に縦並び（シャッター縦中央＝右手の親指圏） */}
      <div
        className="absolute z-10
          portrait:inset-x-0 portrait:bottom-0 portrait:grid portrait:grid-cols-3 portrait:items-center portrait:px-6 portrait:pt-8 portrait:pb-[calc(1.25rem+env(safe-area-inset-bottom))] portrait:bg-gradient-to-t portrait:from-black/60 portrait:to-transparent
          landscape:inset-y-0 landscape:right-0 landscape:flex landscape:flex-col landscape:items-center landscape:justify-center landscape:gap-6 landscape:py-6 landscape:pl-10 landscape:pr-[calc(0.75rem+env(safe-area-inset-right))] landscape:bg-gradient-to-l landscape:from-black/65 landscape:to-transparent"
      >
        <button
          onClick={undo}
          disabled={shots.length === 0}
          className="portrait:justify-self-start text-white/90 text-[13px] font-medium disabled:opacity-30 whitespace-nowrap"
        >
          1枚戻す
        </button>
        <button
          onClick={capture}
          disabled={!ready || shots.length >= MAX_SHOTS}
          aria-label="シャッター"
          className="portrait:justify-self-center w-[74px] h-[74px] shrink-0 rounded-full bg-white/95 ring-4 ring-white/40 active:scale-90 transition-transform disabled:opacity-40"
        >
          <span className="block w-full h-full rounded-full border-[3px] border-black/10" />
        </button>
        <button
          onClick={onClose}
          className="portrait:justify-self-end h-11 px-4 rounded-xl bg-violet-600 text-white font-bold text-[14px] active:scale-95 transition-transform whitespace-nowrap"
        >
          完了{shots.length > 0 ? `(${shots.length})` : ''}
        </button>
      </div>
    </div>
  )
}
