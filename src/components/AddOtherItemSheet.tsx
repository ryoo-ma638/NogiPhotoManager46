import { useRef, useState } from 'react'
import { SheetShell } from './UserSetSheets'
import { CameraIcon } from './icons'

/**
 * 「その他」へ未分類の写真を1枚追加するシート。写真は必須・名前は任意。
 * カタログにまだ無い新作などの仮置き場。名前を付けておくと後で本セットへ移しやすい。
 */
export function AddOtherItemSheet({
  onAdd,
  onClose,
}: {
  onAdd: (file: Blob, name: string) => Promise<void>
  onClose: () => void
}) {
  const [file, setFile] = useState<Blob | null>(null)
  const [url, setUrl] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const pick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    e.target.value = ''
    if (!f) return
    if (url) URL.revokeObjectURL(url)
    setFile(f)
    setUrl(URL.createObjectURL(f))
  }

  const submit = async () => {
    if (!file || busy) return
    setBusy(true)
    try {
      await onAdd(file, name)
      if (url) URL.revokeObjectURL(url)
      onClose()
    } finally {
      setBusy(false)
    }
  }

  return (
    <SheetShell title="未分類の写真を追加" onClose={onClose}>
      <div className="space-y-4 pb-2">
        <p className="text-[12px] text-slate-400 leading-relaxed">
          カタログにまだ無い写真を「その他」に仮置きします。名前を付けておくと、今後カタログに追加されたとき見つけやすくなります。
        </p>

        {/* 写真ピッカー（iPhoneでは撮影/ライブラリを選べる） */}
        <button
          onClick={() => inputRef.current?.click()}
          className="w-full h-48 rounded-2xl border-2 border-dashed border-slate-200 flex flex-col items-center justify-center gap-2 text-slate-400 active:bg-slate-50 overflow-hidden bg-slate-50/50"
        >
          {url ? (
            <img src={url} alt="" className="w-full h-full object-contain" />
          ) : (
            <>
              <CameraIcon className="w-8 h-8" />
              <span className="text-[13px] font-medium">写真を選ぶ／撮る</span>
            </>
          )}
        </button>
        <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={pick} />

        {/* 名前（任意） */}
        <div>
          <p className="text-[13px] font-bold text-slate-500 pb-1.5">名前（任意）</p>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="例: 2026.June-制服"
            className="w-full h-11 rounded-xl bg-white border border-slate-200 px-3 text-[15px] outline-none focus:border-fuchsia-400"
          />
        </div>

        <button
          disabled={!file || busy}
          onClick={submit}
          className="w-full h-12 rounded-xl bg-fuchsia-500 text-white font-bold text-[15px] disabled:opacity-40 active:bg-fuchsia-600 transition-colors"
        >
          {busy ? '追加中…' : 'その他に追加'}
        </button>
      </div>
    </SheetShell>
  )
}
