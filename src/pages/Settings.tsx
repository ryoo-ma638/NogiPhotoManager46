import { useEffect, useRef, useState } from 'react'
import { useAppData } from '../lib/appData'
import { ConfirmSheet, Header } from '../components/ui'
import { allOwnedRows, replaceAllOwned } from '../lib/db'
import { backupFilename, buildBackup, downloadJSON, parseOwnedFile } from '../lib/backup'
import type { OwnedRow } from '../lib/db'

export default function SettingsPage() {
  const { catalog, owned, reloadOwned } = useAppData()
  const [persisted, setPersisted] = useState<boolean | null>(null)
  const [pending, setPending] = useState<OwnedRow[] | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    void navigator.storage?.persisted?.().then(setPersisted)
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
    downloadJSON(backupFilename(catalog.member.id), buildBackup(catalog.member.id, rows))
    showToast(`${rows.length}枚を書き出しました`)
  }

  const onFilePicked = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = '' // 同じファイルを再選択できるように
    if (!file) return
    try {
      const rows = parseOwnedFile(await file.text())
      // カタログに存在する写真IDだけ取り込む（member:setId の prefix で判定）
      const setIds = new Set(catalog.sets.map((s) => `${catalog.member.id}:${s.id}`))
      const filtered = rows.filter((r) => {
        const idx = r.photoId.lastIndexOf(':')
        return idx > 0 && setIds.has(r.photoId.slice(0, idx))
      })
      setPending(filtered)
    } catch (err) {
      showToast(`読み込み失敗: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  const applyImport = async () => {
    if (!pending) return
    await replaceAllOwned(pending)
    await reloadOwned()
    showToast(`${pending.length}枚を取り込みました`)
    setPending(null)
  }

  return (
    <>
      <Header title="設定" />
      <div className="mx-auto max-w-lg px-4 pt-4 pb-6 space-y-4">
        <Section title="データ">
          <Row label="カタログ" value={`${catalog.member.name}（v${catalog.catalogVersion}）`} />
          <Row label="セット数" value={`${catalog.sets.length} 件`} />
          <Row label="所有記録" value={`${owned.size} 枚`} />
        </Section>

        <Section
          title="バックアップ"
          footer="所有データはこの端末の中にだけ保存されます。ホーム画面からアプリを削除するとデータも消えるため、ときどき書き出して保存しておくと安心です。"
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

        <p className="text-center text-[11px] text-slate-300 pt-2">NogiPhotoManager46 v0.1</p>
      </div>

      {pending && (
        <ConfirmSheet
          message={`バックアップから ${pending.length}枚 を復元します。\n現在の所有記録（${owned.size}枚）は置き換わります。`}
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
