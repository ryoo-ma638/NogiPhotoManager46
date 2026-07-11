import { useEffect, useRef, useState } from 'react'
import { useAppData } from '../lib/appData'
import { ConfirmSheet, Header } from '../components/ui'
import { ScreenGuide, resetScreenGuides } from '../components/ScreenGuide'
import { allOwnedRows, allWanted } from '../lib/db'
import { backupFilename, buildBackup, downloadJSON, parseBackup, type ParsedBackup } from '../lib/backup'
import { exportImagesZip, importImagesZip, downloadBlob } from '../lib/imageBackup'
import { getNickname, setNickname, safeName, markBackupDone } from '../lib/prefs'
import { isOwner, lockOwner, unlockOwner } from '../lib/limit'

export default function SettingsPage() {
  const { catalog, owned, userSets, imageIds, restoreAll, attachImage } = useAppData()
  const [persisted, setPersisted] = useState<boolean | null>(null)
  const [storage, setStorage] = useState<{ usage: number; quota: number } | null>(null)
  const [pending, setPending] = useState<ParsedBackup | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const [nick, setNick] = useState(() => getNickname())
  const [exportChoice, setExportChoice] = useState(false)
  const [owner, setOwner] = useState(() => isOwner())
  const [pw, setPw] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)
  const imgZipRef = useRef<HTMLInputElement>(null)
  const [imgBusy, setImgBusy] = useState<'export' | 'import' | null>(null)

  const unlock = async () => {
    if (!pw.trim()) return
    const ok = await unlockOwner(pw.trim())
    if (ok) {
      setOwner(true)
      setPw('')
      showToast('解除しました（使い放題）')
    } else {
      showToast('パスワードが違います')
    }
  }

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

  const doExport = async (unique: boolean) => {
    const [rows, wants] = await Promise.all([allOwnedRows(), allWanted()])
    downloadJSON(backupFilename(nick, unique), buildBackup(catalog.member.id, rows, userSets, wants, nick))
    markBackupDone() // 催促のリセット
    setExportChoice(false)
    showToast(`${rows.length}枚を書き出しました`)
  }

  // 添付画像だけをZIPで書き出し／読み込み（○×のJSONとは別建て・大きいので任意）
  const imagesZipName = () => {
    const d = new Date()
    const p = (n: number) => String(n).padStart(2, '0')
    return `nogi-images-${safeName(nick)}-${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}.zip`
  }
  const doExportImages = async () => {
    if (imgBusy) return
    setImgBusy('export')
    try {
      const { blob, count } = await exportImagesZip(catalog.member.id)
      if (count === 0) return showToast('書き出す画像がありません')
      downloadBlob(imagesZipName(), blob)
      showToast(`画像${count}枚を書き出しました`)
    } catch (err) {
      showToast(`画像の書き出しに失敗: ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setImgBusy(null)
    }
  }
  const onImageZipPicked = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file || imgBusy) return
    setImgBusy('import')
    try {
      const n = await importImagesZip(file, attachImage)
      showToast(`画像${n}枚を復元しました`)
    } catch (err) {
      showToast(`画像の読み込みに失敗: ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setImgBusy(null)
    }
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
      setPending({ owned: filtered, userSets: parsed.userSets, wanted: parsed.wanted })
    } catch (err) {
      showToast(`読み込み失敗: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  const applyImport = async () => {
    if (!pending) return
    await restoreAll(pending.owned, pending.userSets, pending.wanted)
    showToast(`${pending.owned.length}枚を取り込みました`)
    setPending(null)
  }

  return (
    <>
      <Header title="設定" />
      <ScreenGuide
        guideKey="settings"
        title="設定でできること"
        points={[
          { icon: '💾', label: 'バックアップ', desc: '所有データ（JSON）と画像（ZIP）を書き出し/復元。ときどき保存を。' },
          { icon: '🛡️', label: 'データ保護', desc: 'ブラウザの自動削除から守ります（有効化がおすすめ）。' },
          { icon: '🔑', label: 'オーナー解除', desc: 'パスワードでAI判定を無制限にできます。' },
          { icon: '❓', label: '使い方', desc: '「使い方を見る」で最初の説明を、下のボタンで各画面のガイドを再表示できます。' },
        ]}
      />
      <div className="mx-auto max-w-lg px-4 pt-4 pb-6 space-y-4">
        <Section title="あなた" footer="書き出したファイルに名前が入り、トレード相手にも伝わります。">
          <div className="px-4 py-3">
            <input
              value={nick}
              onChange={(e) => {
                setNick(e.target.value)
                setNickname(e.target.value)
              }}
              placeholder="ニックネーム（例: りょうま）"
              className="w-full h-11 rounded-xl bg-white border border-slate-200 px-3 text-[15px] outline-none focus:border-violet-400"
            />
          </div>
        </Section>

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
          footer="端末内だけに保存されるので、ときどき書き出しを。○×データは軽いJSON、添付画像は大きいので別のZIPに分けています。"
        >
          <div className="px-4 py-3 space-y-2">
            <button
              onClick={() => setExportChoice(true)}
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

            <div className="pt-2 mt-1 border-t border-slate-100">
              <p className="text-[11px] text-slate-400 pb-1.5">添付画像（{imageIds.size}枚・別ファイル）。復元は先にJSONを読み込んでから。</p>
              <div className="space-y-2">
                <button
                  onClick={() => void doExportImages()}
                  disabled={imgBusy !== null}
                  className="w-full h-11 rounded-xl bg-white border border-slate-200 text-slate-700 font-medium text-[14px] disabled:opacity-50 active:scale-[0.98] transition-transform"
                >
                  {imgBusy === 'export' ? '書き出し中…' : '画像をまとめて書き出す（ZIP）'}
                </button>
                <button
                  onClick={() => imgZipRef.current?.click()}
                  disabled={imgBusy !== null}
                  className="w-full h-11 rounded-xl bg-white border border-slate-200 text-slate-700 font-medium text-[14px] disabled:opacity-50 active:scale-[0.98] transition-transform"
                >
                  {imgBusy === 'import' ? '読み込み中…' : '画像ZIPを読み込む'}
                </button>
                <input ref={imgZipRef} type="file" accept=".zip,application/zip" className="hidden" onChange={(e) => void onImageZipPicked(e)} />
              </div>
            </div>
          </div>
        </Section>

        <Section
          title="データ保護"
          footer={
            persisted
              ? 'ブラウザによる自動削除から保護されています。'
              : '空き容量が減ったときの自動削除を防ぎます。'
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

        <Section
          title="オーナー"
          footer={owner ? undefined : `他の人は1日${30}回まで自動判定できます。オーナーはパスワードで使い放題に。`}
        >
          {owner ? (
            <div className="px-4 py-3 flex items-center justify-between">
              <span className="text-[14px] font-medium text-emerald-600">✓ 解除済み（使い放題）</span>
              <button
                onClick={() => {
                  lockOwner()
                  setOwner(false)
                  showToast('制限を戻しました')
                }}
                className="text-[13px] text-slate-400 font-medium"
              >
                戻す
              </button>
            </div>
          ) : (
            <div className="px-4 py-3 flex gap-2">
              <input
                type="password"
                value={pw}
                onChange={(e) => setPw(e.target.value)}
                placeholder="パスワード"
                className="flex-1 h-11 rounded-xl bg-white border border-slate-200 px-3 text-[15px] outline-none focus:border-violet-400"
              />
              <button
                onClick={() => void unlock()}
                disabled={!pw.trim()}
                className="shrink-0 h-11 px-4 rounded-xl bg-violet-600 text-white font-bold text-[14px] disabled:opacity-40"
              >
                解除
              </button>
            </div>
          )}
        </Section>

        <Section title="ヘルプ">
          <button
            onClick={() => window.dispatchEvent(new Event('open-tutorial'))}
            className="w-full px-4 py-3.5 text-left text-[14px] font-medium text-violet-600 active:bg-slate-50 transition-colors border-b border-slate-100"
          >
            使い方を見る
          </button>
          <button
            onClick={() => {
              resetScreenGuides()
              showToast('各画面のガイドを次に開いたとき、もう一度表示します')
            }}
            className="w-full px-4 py-3.5 text-left text-[14px] font-medium text-violet-600 active:bg-slate-50 transition-colors"
          >
            各画面のガイドをもう一度見る
          </button>
        </Section>

        <p className="text-center text-[11px] text-slate-300 pt-2">NogiPhotoManager46 v0.1</p>
      </div>

      {exportChoice && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 animate-fade" onClick={() => setExportChoice(false)}>
          <div
            className="w-full max-w-lg m-3 mb-[calc(0.75rem+env(safe-area-inset-bottom))] rounded-2xl bg-white p-4 shadow-xl animate-pop"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="text-[15px] font-bold text-slate-700 text-center">バックアップを保存</p>
            <p className="mt-1 text-[12px] text-slate-400 text-center leading-relaxed">
              「上書き保存」は同じ名前で保存。iPhoneでは確認後に上書きできます。
            </p>
            <div className="mt-3 space-y-2">
              <button
                onClick={() => void doExport(true)}
                className="w-full h-12 rounded-xl bg-violet-600 text-white font-bold active:scale-[0.98] transition-transform"
              >
                新規保存（日時つき）
              </button>
              <button
                onClick={() => void doExport(false)}
                className="w-full h-12 rounded-xl bg-white border border-slate-200 text-slate-700 font-medium active:scale-[0.98] transition-transform"
              >
                上書き保存
              </button>
              <button onClick={() => setExportChoice(false)} className="w-full h-10 text-slate-400 text-[13px] font-medium">
                キャンセル
              </button>
            </div>
          </div>
        </div>
      )}

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
