import { useState } from 'react'
import { SheetShell } from './UserSetSheets'
import type { CatalogSet } from '../types'

/** 「その他」への登録シート: 既存のその他セットに追加 or 新規作成（種類なし＝連番枠） */
export function OtherRegisterSheet({
  otherSets,
  photosOf,
  onPickExisting,
  onCreate,
  onClose,
}: {
  otherSets: CatalogSet[]
  photosOf: (s: CatalogSet) => { id: string }[]
  onPickExisting: (s: CatalogSet) => void
  onCreate: (name: string) => void
  onClose: () => void
}) {
  const [name, setName] = useState('')
  return (
    <SheetShell title="「その他」として登録" onClose={onClose}>
      <div className="space-y-4 pb-2">
        <p className="text-[12px] text-slate-400 leading-relaxed">
          年度別・封入以外（ミニ生写真、スタ誕など）はここへ。既存のセットに足すか、新しく作って枠を選べます。
        </p>

        {otherSets.length > 0 && (
          <div>
            <p className="text-[13px] font-bold text-slate-500 pb-1.5">既存のセットに追加</p>
            <div className="rounded-xl bg-white border border-slate-200 divide-y divide-slate-100 overflow-hidden">
              {otherSets.map((s) => (
                <button key={s.id} onClick={() => onPickExisting(s)} className="w-full text-left px-3 py-2.5 text-[14px] text-slate-700 active:bg-fuchsia-50">
                  {s.name}
                  <span className="block text-[11px] text-slate-400">
                    現在{photosOf(s).length}枚{s.user ? '・枠を1つ増やして追加します' : ''}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        <div>
          <p className="text-[13px] font-bold text-slate-500 pb-1.5">新しいセットを作る</p>
          <div className="flex gap-2">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="例: 乃木坂スター誕生！"
              className="flex-1 h-11 rounded-xl bg-white border border-slate-200 px-3 text-[15px] outline-none focus:border-fuchsia-400"
            />
            <button
              disabled={!name.trim()}
              onClick={() => onCreate(name)}
              className="shrink-0 h-11 px-4 rounded-xl bg-fuchsia-500 text-white font-bold text-[14px] disabled:opacity-40"
            >
              作成
            </button>
          </div>
        </div>
      </div>
    </SheetShell>
  )
}
