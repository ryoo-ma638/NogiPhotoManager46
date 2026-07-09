import { useMemo, useRef, useState } from 'react'
import { useAppData } from '../lib/appData'
import { Header } from '../components/ui'
import { SheetShell } from '../components/UserSetSheets'
import { buildTradeExport, computeOverlap, parseTradeExport, type Overlap } from '../lib/trade'
import { downloadJSON } from '../lib/backup'
import { getNickname, safeName } from '../lib/prefs'

interface TradeItem {
  photoId: string
  setName: string
  label: string
  qty: number // 譲れる枚数（求は1）
}

function group(items: TradeItem[]): [string, TradeItem[]][] {
  const m = new Map<string, TradeItem[]>()
  for (const it of items) {
    const arr = m.get(it.setName) ?? []
    arr.push(it)
    m.set(it.setName, arr)
  }
  return [...m.entries()]
}

/** X等に貼り付けるための求/譲テキストを作る。求は「特に欲しい」だけ（全所有はさらけ出さない） */
function buildTradeText(member: string, give: TradeItem[], want: TradeItem[]): string {
  const fmt = (items: TradeItem[]) =>
    group(items)
      .map(([set, arr]) => `・${set}: ${arr.map((it) => (it.qty > 1 ? `${it.label}×${it.qty}` : it.label)).join('、')}`)
      .join('\n')
  return [
    `${member} 生写真 【譲/求】`,
    '',
    '▼譲（お譲りできます）',
    give.length ? fmt(give) : '（なし）',
    '',
    '▼求（探しています）',
    want.length ? fmt(want) : '（なし）',
  ].join('\n')
}

export default function TradePage() {
  const { catalog, allSets, photosOf, countOf, wanted } = useAppData()
  const [sheet, setSheet] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const [match, setMatch] = useState<{ name: string; overlap: Overlap } | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const { give, want, info, giveSet } = useMemo(() => {
    const give: TradeItem[] = []
    const want: TradeItem[] = []
    const info = new Map<string, { setName: string; label: string }>()
    for (const s of allSets) {
      for (const p of photosOf(s)) {
        info.set(p.id, { setName: s.name, label: p.label })
        const c = countOf(p.id)
        if (c >= 2) give.push({ photoId: p.id, setName: s.name, label: p.label, qty: c - 1 })
        if (wanted.has(p.id)) want.push({ photoId: p.id, setName: s.name, label: p.label, qty: 1 })
      }
    }
    return { give, want, info, giveSet: new Set(give.map((g) => g.photoId)) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allSets, photosOf, countOf, wanted])

  const text = buildTradeText(catalog.member.name, give, want)
  const showToast = (m: string) => {
    setToast(m)
    window.setTimeout(() => setToast(null), 2600)
  }
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text)
      showToast('コピーしました')
    } catch {
      showToast('コピーできませんでした。下の文を長押しで選んでコピーしてください')
    }
  }

  // ---- 相手との突き合わせ（ローカルなファイル交換・サーバ不要） ----
  const exportFile = () => {
    const nick = getNickname() || '名無し'
    const exp = buildTradeExport(
      catalog.member.id,
      nick,
      give.map((g) => ({ photoId: g.photoId, qty: g.qty })),
      want.map((w) => w.photoId),
    )
    const d = new Date()
    const p = (n: number) => String(n).padStart(2, '0')
    const date = `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}`
    downloadJSON(`nogi-trade-${safeName(nick)}-${date}.json`, exp)
    showToast(getNickname() ? '共有ファイルを書き出しました' : '設定でニックネームを付けると相手に名前が伝わります')
  }
  const onImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    try {
      const parsed = parseTradeExport(await file.text())
      const overlap = computeOverlap(giveSet, wanted, parsed.give, parsed.want)
      setMatch({ name: parsed.ownerName, overlap })
      if (overlap.canGet.length === 0 && overlap.canGive.length === 0) showToast('重なりはありませんでした')
    } catch (err) {
      showToast(`読み込み失敗: ${err instanceof Error ? err.message : String(err)}`)
    }
  }
  const nameOf = (photoId: string) => {
    const i = info.get(photoId)
    return i ? `${i.setName}／${i.label}` : photoId
  }

  return (
    <>
      <Header title="トレード" subtitle="譲れるダブりと、特に欲しいもの" back />
      <div className="mx-auto max-w-lg px-4 pt-4 pb-28 space-y-5">
        <button
          onClick={() => setSheet(true)}
          disabled={give.length === 0 && want.length === 0}
          className="w-full h-12 rounded-2xl bg-violet-600 text-white font-bold shadow-lg shadow-violet-200 disabled:opacity-40 active:scale-[0.99] transition"
        >
          求/譲リストを作る（X貼り付け用）
        </button>

        {/* 相手との突き合わせ（ファイル交換） */}
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={exportFile}
            disabled={give.length === 0 && want.length === 0}
            className="h-10 rounded-xl border border-slate-200 bg-white text-slate-600 font-medium text-[13px] disabled:opacity-40 active:scale-[0.99] transition"
          >
            共有ファイルを書き出す
          </button>
          <button
            onClick={() => fileRef.current?.click()}
            className="h-10 rounded-xl border border-slate-200 bg-white text-slate-600 font-medium text-[13px] active:scale-[0.99] transition"
          >
            相手のファイルを取り込む
          </button>
        </div>
        <input ref={fileRef} type="file" accept="application/json,.json" className="hidden" onChange={(e) => void onImportFile(e)} />

        {/* 突き合わせ結果 */}
        {match && (
          <section className="rounded-2xl bg-violet-50 border border-violet-200 p-3 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-[14px] font-bold text-violet-700">{match.name} さんとのトレード</p>
              <button onClick={() => setMatch(null)} aria-label="閉じる" className="text-violet-400 text-lg leading-none p-1 -m-1">
                ✕
              </button>
            </div>
            <div>
              <p className="text-[12px] font-bold text-emerald-600 pb-1">もらえる（相手が譲・自分が求）{match.overlap.canGet.length}件</p>
              {match.overlap.canGet.length === 0 ? (
                <p className="text-[12px] text-slate-400">なし</p>
              ) : (
                <ul className="space-y-0.5">
                  {match.overlap.canGet.map((it) => (
                    <li key={it.photoId} className="text-[12px] text-slate-700">
                      ・{nameOf(it.photoId)}
                      {it.qty > 1 ? `（相手は${it.qty}枚譲れる）` : ''}
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div>
              <p className="text-[12px] font-bold text-pink-600 pb-1">渡せる（相手が求・自分が譲）{match.overlap.canGive.length}件</p>
              {match.overlap.canGive.length === 0 ? (
                <p className="text-[12px] text-slate-400">なし</p>
              ) : (
                <ul className="space-y-0.5">
                  {match.overlap.canGive.map((id) => (
                    <li key={id} className="text-[12px] text-slate-700">
                      ・{nameOf(id)}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>
        )}

        <TradeSection
          title="譲れる（ダブり）"
          n={give.length}
          chipClass="bg-emerald-50 text-emerald-700"
          empty="ダブり（2枚以上持っている写真）はまだありません。セット詳細で写真の枚数を ＋ してください。"
          groups={group(give)}
        />
        <TradeSection
          title="求（特に欲しい）"
          n={want.length}
          chipClass="bg-pink-50 text-pink-600"
          empty="「特に欲しい」はまだありません。未所有の写真の♡で印を付けられます。"
          groups={group(want)}
        />
      </div>

      {sheet && (
        <SheetShell title="求/譲リスト" onClose={() => setSheet(false)}>
          <div className="space-y-3 pb-2">
            <p className="text-[12px] text-slate-400 leading-relaxed">
              このままXなどに貼り付けられます。求は「特に欲しい」だけ載せています（全所有は出しません）。
            </p>
            <textarea
              readOnly
              value={text}
              onFocus={(e) => e.currentTarget.select()}
              className="w-full h-64 rounded-xl bg-slate-50 border border-slate-200 p-3 text-[13px] leading-relaxed text-slate-700 outline-none"
            />
            <button
              onClick={() => void copy()}
              className="w-full h-12 rounded-2xl bg-violet-600 text-white font-bold active:scale-[0.98] transition-transform"
            >
              コピー
            </button>
          </div>
        </SheetShell>
      )}

      {toast && (
        <div className="fixed inset-x-0 bottom-[calc(8rem+env(safe-area-inset-bottom))] z-[70] flex justify-center px-4 pointer-events-none">
          <div className="animate-pop rounded-full bg-slate-900/90 text-white text-[13px] font-medium px-4 py-2 shadow-lg">{toast}</div>
        </div>
      )}
    </>
  )
}

function TradeSection({
  title,
  n,
  chipClass,
  empty,
  groups,
}: {
  title: string
  n: number
  chipClass: string
  empty: string
  groups: [string, TradeItem[]][]
}) {
  return (
    <section>
      <h2 className="px-1 pb-2 text-[14px] font-bold text-slate-600">
        {title} <span className="text-slate-400 font-normal">{n}件</span>
      </h2>
      {groups.length === 0 ? (
        <p className="rounded-xl bg-white border border-slate-100 px-3 py-4 text-[12px] text-slate-400 leading-relaxed">{empty}</p>
      ) : (
        <div className="space-y-2">
          {groups.map(([setName, items]) => (
            <div key={setName} className="rounded-xl bg-white border border-slate-100 shadow-sm p-3">
              <p className="text-[13px] font-bold text-slate-700 truncate">{setName}</p>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {items.map((it) => (
                  <span key={it.photoId} className={`text-[12px] rounded-full px-2 py-0.5 ${chipClass}`}>
                    {it.label}
                    {it.qty > 1 ? ` ×${it.qty}` : ''}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
