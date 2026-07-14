import { useState } from 'react'
import type { Binder, Rarity, Template, UserSet, UserSetPhoto } from '../types'
import { TEMPLATES } from '../lib/templates'
import { POSE_FRAMES, frameSortKey, nextFreeSlot, nextNumberFrame } from '../lib/frames'
import { ConfirmSheet } from './ui'

const TEMPLATE_OPTIONS: { value: Template; label: string }[] = [
  { value: 'standard3', label: '3種（ヨリ/チュウ/ヒキ）' },
  { value: 'five5', label: '5種（＋座りヨリ/座りヒキ）' },
  { value: 'rareSet8', label: '8種（＋R/SR①〜④）' },
  { value: 'event6', label: '6種（①〜⑥）' },
  { value: 'four4', label: '4種（A/B/C/D）' },
  { value: 'single1', label: '1種（種類なし・その他向け）' },
]

const RARITY_CYCLE: Rarity[] = ['normal', 'R', 'SR', 'other']
const RARITY_CHIP: Record<Rarity, { label: string; cls: string }> = {
  normal: { label: '通常', cls: 'bg-slate-100 text-slate-500' },
  R: { label: 'R', cls: 'bg-sky-100 text-sky-600' },
  SR: { label: 'SR', cls: 'bg-amber-100 text-amber-600' },
  other: { label: '他', cls: 'bg-fuchsia-100 text-fuchsia-600' },
}

// 注意: パネルは「画面上部」から出す。下から出すとiOSでキーボードに隠れて操作不能になる
export function SheetShell({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-40 flex items-start justify-center bg-black/40 animate-fade" onClick={onClose}>
      <div
        className="w-full max-w-lg max-h-[62dvh] overflow-y-auto rounded-b-3xl bg-slate-50 shadow-xl animate-pop"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-slate-50/95 backdrop-blur px-5 pt-[calc(0.75rem+env(safe-area-inset-top))] pb-2 flex items-center justify-between z-10">
          <h2 className="font-bold text-[16px]">{title}</h2>
          <button onClick={onClose} className="text-[14px] font-medium text-violet-600 p-1">
            閉じる
          </button>
        </div>
        <div className="px-5 pb-6">{children}</div>
      </div>
    </div>
  )
}

const inputCls =
  'w-full h-11 rounded-xl bg-white border border-slate-200 px-3 text-[15px] outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100 transition'

/** セット追加シート */
export function AddSetSheet({
  binder,
  years,
  defaultSortIndex,
  onSave,
  onClose,
}: {
  binder: Binder
  years: number[]
  defaultSortIndex: (year: number | null) => number
  onSave: (row: UserSet) => void
  onClose: () => void
}) {
  const [name, setName] = useState('')
  const [year, setYear] = useState<number | null>(binder.sealed ? null : (years[years.length - 1] ?? null))
  const [template, setTemplate] = useState<Template>(binder.id === 'b-other' ? 'single1' : binder.sealed ? 'four4' : 'standard3')
  const [note, setNote] = useState('')

  const preview = TEMPLATES[template].map((s) => s.label).join('・')

  const save = () => {
    const row: UserSet = {
      id: `user-${crypto.randomUUID().slice(0, 8)}`,
      binderId: binder.id,
      year,
      name: name.trim(),
      template,
      note: note.trim() || null,
      sortIndex: defaultSortIndex(year),
      // 「その他」バインダーの写真はレアリティ「その他」
      photos: TEMPLATES[template].map((s) => ({ slot: s.slot, label: s.label, rarity: binder.id === 'b-other' ? 'other' : s.rarity })),
      createdAt: new Date().toISOString(),
    }
    onSave(row)
  }

  return (
    <SheetShell title="セットを追加" onClose={onClose}>
      <div className="space-y-4">
        <Field label="セット名">
          <input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} placeholder="例: 会場限定生写真" />
        </Field>

        {!binder.sealed && years.length > 0 && (
          <Field label="年">
            <div className="grid grid-flow-col auto-cols-fr gap-1 rounded-xl bg-slate-200/60 p-1">
              {years.map((y) => (
                <button
                  key={y}
                  onClick={() => setYear(y)}
                  className={`h-9 rounded-lg text-[14px] font-medium transition-colors ${year === y ? 'bg-white shadow-sm text-slate-800' : 'text-slate-500'}`}
                >
                  {y}
                </button>
              ))}
            </div>
          </Field>
        )}

        <Field label="種類" hint={`作成される枠: ${preview}`}>
          <div className="space-y-1.5">
            {TEMPLATE_OPTIONS.map((t) => (
              <button
                key={t.value}
                onClick={() => setTemplate(t.value)}
                className={`w-full h-10 rounded-xl px-3 text-left text-[14px] font-medium border transition-colors ${
                  template === t.value ? 'bg-violet-50 border-violet-400 text-violet-700' : 'bg-white border-slate-200 text-slate-600'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </Field>

        <Field label="メモ（任意）">
          <input className={inputCls} value={note} onChange={(e) => setNote(e.target.value)} placeholder="例: ○○で購入" />
        </Field>

        <p className="text-[11px] text-slate-400">追加したセットはカタログ更新の影響を受けません。枠は後から増減・改名できます。</p>

        <button
          disabled={!name.trim()}
          onClick={save}
          className="w-full h-12 rounded-2xl bg-violet-600 text-white font-bold disabled:opacity-40 active:scale-[0.98] transition"
        >
          追加する
        </button>
      </div>
    </SheetShell>
  )
}

/** セット編集シート（手動セット専用） */
export function EditSetSheet({
  userSet,
  onSave,
  onDelete,
  onClose,
}: {
  userSet: UserSet
  onSave: (row: UserSet) => void
  onDelete: () => void
  onClose: () => void
}) {
  const [name, setName] = useState(userSet.name)
  const [note, setNote] = useState(userSet.note ?? '')
  // 詳細グリッドと同じ既定順（ポーズ→番号→自由）で開く。追加した枠は末尾に付く
  const [photos, setPhotos] = useState<UserSetPhoto[]>(() => [...userSet.photos].sort((a, b) => frameSortKey(a.slot) - frameSortKey(b.slot)))
  const [confirmDelete, setConfirmDelete] = useState(false)

  const addNumber = () => setPhotos([...photos, nextNumberFrame(photos)])
  const addPose = (pose: UserSetPhoto) => {
    if (photos.some((p) => p.slot === pose.slot)) return // 同じポーズは二重に足さない
    setPhotos([...photos, { ...pose }])
  }
  const addFree = (label: string) => setPhotos([...photos, { slot: nextFreeSlot(photos), label, rarity: 'other' }])

  const cycleRarity = (i: number) => {
    setPhotos(photos.map((p, j) => (j === i ? { ...p, rarity: RARITY_CYCLE[(RARITY_CYCLE.indexOf(p.rarity) + 1) % RARITY_CYCLE.length]! } : p)))
  }

  const save = () => {
    onSave({ ...userSet, name: name.trim() || userSet.name, note: note.trim() || null, photos })
  }

  return (
    <SheetShell title="セットを編集" onClose={onClose}>
      <div className="space-y-4">
        <Field label="セット名">
          <input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} />
        </Field>

        <Field label="ポーズ枠" hint="ラベルをタップして編集。バッジでレアリティ切替">
          <div className="space-y-1.5">
            {photos.map((p, i) => {
              const chip = RARITY_CHIP[p.rarity]
              return (
                <div key={p.slot} className="flex items-center gap-2">
                  <input
                    className={`${inputCls} flex-1`}
                    value={p.label}
                    onChange={(e) => setPhotos(photos.map((q, j) => (j === i ? { ...q, label: e.target.value } : q)))}
                  />
                  <button onClick={() => cycleRarity(i)} className={`shrink-0 w-12 h-8 rounded-lg text-[11px] font-bold ${chip.cls}`}>
                    {chip.label}
                  </button>
                  <button
                    onClick={() => photos.length > 1 && setPhotos(photos.filter((_, j) => j !== i))}
                    disabled={photos.length <= 1}
                    aria-label="この枠を削除"
                    className="shrink-0 w-8 h-8 rounded-lg bg-red-50 text-red-500 font-bold disabled:opacity-30"
                  >
                    −
                  </button>
                </div>
              )
            })}
          </div>
          <div className="pt-3">
            <FrameAddControls
              poseDisabled={(slot) => photos.some((p) => p.slot === slot)}
              onAddNumber={addNumber}
              onAddPose={addPose}
              onAddFree={addFree}
            />
          </div>
        </Field>

        <Field label="メモ（任意）">
          <input className={inputCls} value={note} onChange={(e) => setNote(e.target.value)} />
        </Field>

        <button onClick={save} className="w-full h-12 rounded-2xl bg-violet-600 text-white font-bold active:scale-[0.98] transition">
          保存する
        </button>
        <button onClick={() => setConfirmDelete(true)} className="w-full h-10 rounded-2xl text-red-500 text-[13px] font-medium">
          このセットを削除
        </button>
      </div>

      {confirmDelete && (
        <ConfirmSheet
          message={`「${userSet.name}」を削除しますか？\n所有記録も一緒に消えます。`}
          confirmLabel="削除する"
          danger
          onConfirm={onDelete}
          onCancel={() => setConfirmDelete(false)}
        />
      )}
    </SheetShell>
  )
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-[13px] font-bold text-slate-500 pb-1.5">{label}</label>
      {children}
      {hint && <p className="pt-1 text-[11px] text-slate-400">{hint}</p>}
    </div>
  )
}

/**
 * その他セットに枠を足すUI（番号／定番ポーズ／自由入力）。取込の枠選択シートと編集シートで共用。
 * 追加のされ方（即保存して割当 or ローカル編集）は呼び出し側のコールバックが決める。
 */
export function FrameAddControls({
  poseDisabled,
  onAddNumber,
  onAddPose,
  onAddFree,
}: {
  poseDisabled: (slot: string) => boolean
  onAddNumber: () => void
  onAddPose: (pose: UserSetPhoto) => void
  onAddFree: (label: string) => void
}) {
  const [free, setFree] = useState('')
  const submitFree = () => {
    const t = free.trim()
    if (!t) return
    onAddFree(t)
    setFree('')
  }
  return (
    <div className="space-y-2">
      <p className="text-[12px] font-bold text-slate-500">枠を追加</p>
      <button
        onClick={onAddNumber}
        className="w-full h-10 rounded-xl border border-dashed border-slate-300 bg-white text-slate-600 text-[13px] font-medium active:bg-slate-50"
      >
        ＋ 番号
      </button>
      <div className="flex flex-wrap gap-1.5">
        {POSE_FRAMES.map((pose) => {
          const taken = poseDisabled(pose.slot)
          return (
            <button
              key={pose.slot}
              disabled={taken}
              onClick={() => onAddPose(pose)}
              className={`h-9 px-3 rounded-full border text-[12px] font-medium ${
                taken ? 'border-slate-200 bg-slate-100 text-slate-300' : 'border-slate-200 bg-white text-slate-600 active:bg-violet-50'
              }`}
            >
              ＋ {pose.label}
            </button>
          )
        })}
      </div>
      <div className="flex items-center gap-1.5">
        <input
          className={`${inputCls} flex-1`}
          value={free}
          onChange={(e) => setFree(e.target.value)}
          placeholder="自由入力（例: 制服カット）"
          onKeyDown={(e) => e.key === 'Enter' && submitFree()}
        />
        <button
          onClick={submitFree}
          disabled={!free.trim()}
          className="shrink-0 h-11 px-4 rounded-xl bg-violet-600 text-white text-[13px] font-bold disabled:opacity-40 active:scale-[0.98] transition"
        >
          追加
        </button>
      </div>
    </div>
  )
}
