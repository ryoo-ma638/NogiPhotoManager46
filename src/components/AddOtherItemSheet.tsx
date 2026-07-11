import { useRef, useState } from 'react'
import { SheetShell } from './UserSetSheets'
import { CameraIcon } from './icons'

/**
 * 「その他」へ未分類の写真を1枚追加するシート。写真は必須・名前は任意。
 * カタログにまだ無い新作などの仮置き場。名前を付けておくと後で本セットへ移しやすい。
 */
export function AddOtherItemSheet({
  onAdd,
  checkDuplicate,
  onClose,
}: {
  onAdd: (file: Blob, name: string) => Promise<void>
  checkDuplicate: (name: string) => string | null // 同名があればその名前を返す
  onClose: () => void
}) {
  const [file, setFile] = useState<Blob | null>(null)
  const [url, setUrl] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const [warnedName, setWarnedName] = useState<string | null>(null) // 重複警告を出した相手の名前
  const inputRef = useRef<HTMLInputElement>(null)
  const submittingRef = useRef(false) // 連打での二重追加を同期的に止める

  const dup = name.trim() ? checkDuplicate(name.trim()) : null
  const needConfirm = dup !== null && warnedName !== dup

  const pick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    e.target.value = ''
    if (!f) return
    if (url) URL.revokeObjectURL(url)
    setFile(f)
    setUrl(URL.createObjectURL(f))
  }

  const submit = async () => {
    if (!file || submittingRef.current) return
    if (needConfirm) {
      setWarnedName(dup) // 初回は警告のみ。もう一度押すと追加
      return
    }
    submittingRef.current = true
    setBusy(true)
    try {
      await onAdd(file, name)
      if (url) URL.revokeObjectURL(url)
      onClose()
    } finally {
      submittingRef.current = false
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
            className={`w-full h-11 rounded-xl bg-white border px-3 text-[15px] outline-none ${
              dup ? 'border-amber-400 focus:border-amber-500' : 'border-slate-200 focus:border-fuchsia-400'
            }`}
          />
          {dup && <p className="pt-1.5 text-[12px] text-amber-600">「{dup}」が既にあります。重複して追加しますか？</p>}
        </div>

        <button
          disabled={!file || busy}
          onClick={submit}
          className={`w-full h-12 rounded-xl text-white font-bold text-[15px] disabled:opacity-40 transition-colors ${
            needConfirm ? 'bg-amber-500 active:bg-amber-600' : 'bg-fuchsia-500 active:bg-fuchsia-600'
          }`}
        >
          {busy ? '追加中…' : needConfirm ? '重複を承知で追加' : 'その他に追加'}
        </button>
      </div>
    </SheetShell>
  )
}
