import { useEffect, useState } from 'react'
import { useAppData } from '../lib/appData'
import { Header } from '../components/ui'

export default function SettingsPage() {
  const { catalog, owned } = useAppData()
  const [persisted, setPersisted] = useState<boolean | null>(null)

  useEffect(() => {
    void navigator.storage?.persisted?.().then(setPersisted)
  }, [])

  const requestPersist = async () => {
    const ok = await navigator.storage?.persist?.()
    setPersisted(ok ?? false)
  }

  const totalSlots = catalog.sets.length

  return (
    <>
      <Header title="設定" />
      <div className="mx-auto max-w-lg px-4 pt-4 pb-6 space-y-4">
        <Section title="データ">
          <Row label="カタログ" value={`${catalog.member.name}（v${catalog.catalogVersion}）`} />
          <Row label="セット数" value={`${totalSlots} 件`} />
          <Row label="所有記録" value={`${owned.size} 枚`} />
        </Section>

        <Section title="バックアップ" footer="所有データはこの端末の中にだけ保存されます。ホーム画面からアプリを削除するとデータも消えるため、定期的なバックアップをおすすめします。">
          <div className="px-4 py-3 space-y-2">
            <button disabled className="w-full h-11 rounded-xl bg-slate-100 text-slate-400 font-medium text-[14px]">
              書き出し（次回アップデートで追加）
            </button>
            <button disabled className="w-full h-11 rounded-xl bg-slate-100 text-slate-400 font-medium text-[14px]">
              読み込み（次回アップデートで追加）
            </button>
          </div>
        </Section>

        <Section
          title="データ保護"
          footer={persisted ? 'ブラウザによる自動削除から保護されています。' : '端末の空き容量が減った際にブラウザがデータを消さないよう、保護を有効にできます。'}
        >
          <div className="px-4 py-3">
            {persisted ? (
              <p className="text-[14px] font-medium text-emerald-600">✓ 保護は有効です</p>
            ) : (
              <button onClick={() => void requestPersist()} className="w-full h-11 rounded-xl bg-violet-600 text-white font-bold text-[14px] active:scale-[0.98] transition-transform">
                データ保護を有効にする
              </button>
            )}
          </div>
        </Section>

        <p className="text-center text-[11px] text-slate-300 pt-2">NogiPhotoManager46 v0.1</p>
      </div>
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
