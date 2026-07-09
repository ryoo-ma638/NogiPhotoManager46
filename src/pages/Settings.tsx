import { useEffect, useRef, useState } from 'react'
import { useAppData } from '../lib/appData'
import { ConfirmSheet, Header } from '../components/ui'
import { allOwnedRows } from '../lib/db'
import { backupFilename, buildBackup, downloadJSON, parseBackup, type ParsedBackup } from '../lib/backup'

export default function SettingsPage() {
  const { catalog, owned, userSets, imageIds, restoreAll } = useAppData()
  const [persisted, setPersisted] = useState<boolean | null>(null)
  const [storage, setStorage] = useState<{ usage: number; quota: number } | null>(null)
  const [pending, setPending] = useState<ParsedBackup | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    void navigator.storage?.persisted?.().then(setPersisted)
    void navigator.storage?.estimate?.().then((e) => {
      if (e && typeof e.usage === 'number' && typeof e.quota === 'number') setStorage({ usage: e.usage, quota: e.quota })
    })
  }, [])

  const showToast = (msg: string) => {
    setToast(msg)
    window.setTimeout(() => setToast(null), 2600)
  }

  const requestPersist = async () => {
    const ok = await navigator.storage?.persist?.()
    setPersisted(ok ?? false)
  }

  const exportBackup = async () => {
    const rows = await allOwnedRows()
    downloadJSON(backupFilename(catalog.member.id), buildBackup(catalog.member.id, rows, userSets))
    showToast(`所有${rows.length}枚・手動セット${userSets.length}件を書き出しました`)
  }

  const onFilePicked = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = '' // 同じファイルを再選択できるように
    if (!file) return
    try {
      const parsed = parseBackup(await file.text())
      // カタログ or 復元される手動セットに存在する写真IDだけ取り込む
      const setIds = new Set(catalog.sets.map((s) => `${catalog.member.id}:${s.id}`))
      for (const u of parsed.userSets) setIds.add(`${catalog.member.id}:${u.id}`)
      const filtered = parsed.owned.filter((r) => {
        const idx = r.photoId.lastIndexOf(':')
        return idx > 0 && setIds.has(r.photoId.slice(0, idx))
      })
      setPending({ owned: filtered, userSets: parsed.userSets })
    } catch (err) {
      showToast(`読み込み失敗: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  const applyImport = async () => {
    if (!pending) return
    await restoreAll(pending.owned, pending.userSets)
    showToast(`${pending.owned.length}枚を取り込みました`)
    setPending(null)
  }

  return (
    <>
      <Header title="設定" />
      <div className="mx-auto max-w-lg px-4 pt-4 pb-6 space-y-4">
        <Section title="データ">
          <Row label="カタログ" value={`${catalog.member.name}（v${catalog.catalogVersion}）`} />
          <Row label="セット数" value={`${catalog.sets.length} 件${userSets.length > 0 ? ` ＋手動${userSets.length}` : ''}`} />
          <Row label="所有記録" value={`${owned.size} 枚`} />
          <Row label="添付画像" value={`${imageIds.size} 枚`} />
          {storage && (
            <Row label="使用容量" value={`${fmtBytes(storage.usage)}${storage.quota > 0 ? ` ／ 上限 ${fmtBytes(storage.quota)}` : ''}`} />
          )}
        </Section>

        <Section
          title="バックアップ"
          footer="所有データはこの端末の中にだけ保存されます。ホーム画面からアプリを削除するとデータも消えるため、ときどき書き出して保存しておくと安心です。※添付画像は容量が大きいためバックアップJSONには含まれません。"
        >
          <div className="px-4 py-3 space-y-2">
            <button
              onClick={() => void exportBackup()}
              className="w-full h-11 rounded-xl bg-violet-600 text-white font-bold text-[14px] active:scale-[0.98] transition-transform"
            >
              書き出し（バックアップ）
            </button>
            <button
              onClick={() => fileRef.current?.click()}
              className="w-full h-11 rounded-xl bg-white border border-slate-200 text-slate-700 font-medium text-[14px] active:scale-[0.98] transition-transform"
            >
              読み込み（復元）
            </button>
            <input ref={fileRef} type="file" accept="application/json,.json" className="hidden" onChange={(e) => void onFilePicked(e)} />
          </div>
        </Section>

        <Section
          title="データ保護"
          footer={
            persisted
              ? 'ブラウザによる自動削除から保護されています。'
              : '端末の空き容量が減った際にブラウザがデータを消さないよう、保護を有効にできます。'
          }
        >
          <div className="px-4 py-3">
            {persisted ? (
              <p className="text-[14px] font-medium text-emerald-600">✓ 保護は有効です</p>
            ) : (
              <button
                onClick={() => void requestPersist()}
                className="w-full h-11 rounded-xl bg-violet-600 text-white font-bold text-[14px] active:scale-[0.98] transition-transform"
              >
                データ保護を有効にする
              </button>
            )}
          </div>
        </Section>

        <Section title="ヘルプ">
          <button
            onClick={() => window.dispatchEvent(new Event('open-tutorial'))}
            className="w-full px-4 py-3.5 text-left text-[14px] font-medium text-violet-600 active:bg-slate-50 transition-colors"
          >
            使い方を見る
          </button>
        </Section>

        <p className="text-center text-[11px] text-slate-300 pt-2">NogiPhotoManager46 v0.1</p>
      </div>

      {pending && (
        <ConfirmSheet
          message={`バックアップから 所有${pending.owned.length}枚${pending.userSets.length > 0 ? `・手動セット${pending.userSets.length}件` : ''} を復元します。\n現在の所有記録（${owned.size}枚）は置き換わります。`}
          confirmLabel="復元する"
          onConfirm={() => void applyImport()}
          onCancel={() => setPending(null)}
        />
      )}

      {toast && (
        <div className="fixed inset-x-0 bottom-[calc(5rem+env(safe-area-inset-bottom))] z-50 flex justify-center px-4 pointer-events-none">
          <div className="animate-pop rounded-full bg-slate-900/90 text-white text-[13px] font-medium px-4 py-2 shadow-lg">{toast}</div>
        </div>
      )}
    </>
  )
}

function fmtBytes(b: number): string {
  if (b >= 1024 * 1024 * 1024) return `${(b / 1024 / 1024 / 1024).toFixed(1)} GB`
  return `${Math.round(b / 1024 / 1024)} MB`
}

function Section({ title, footer, children }: { title: string; footer?: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="px-1 pb-1.5 text-[13px] font-bold text-slate-500">{title}</h2>
      <div className="rounded-2xl bg-white border border-slate-100 shadow-sm divide-y divide-slate-100 overflow-hidden">{children}</div>
      {footer && <p className="px-1 pt-1.5 text-[11px] text-slate-400 leading-relaxed">{footer}</p>}
    </section>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between px-4 py-3">
      <span className="text-[14px] text-slate-600">{label}</span>
      <span className="text-[14px] font-medium text-slate-800">{value}</span>
    </div>
  )
}
