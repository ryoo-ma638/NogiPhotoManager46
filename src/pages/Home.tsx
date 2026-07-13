import { useState } from 'react'
import { useAppData } from '../lib/appData'
import { CameraIcon, ChevronRight, SealCheck, SearchIcon, SwapIcon } from '../components/icons'
import { Gauge, Header, ProgressBar, pct } from '../components/ui'
import { ScreenGuide } from '../components/ScreenGuide'
import { navigate, useScrollRestore } from '../lib/router'
import { daysSinceBackup, shouldRemindBackup, snoozeBackupReminder } from '../lib/prefs'

/** 初回チュートリアルを見終えたか。ホームガイドはこの後に出す（初回起動の二重表示を避ける） */
function tutorialSeen(): boolean {
  try {
    return !!localStorage.getItem('nogi_tutorial_v1')
  } catch {
    return true
  }
}

/** バインダーIDから年ラベル（'20–'21 / 封入）を作る */
function yearChip(binderId: string): string {
  const m = binderId.match(/b(\d{4})-(\d{4})/)
  if (m) return `'${m[1]!.slice(2)}–'${m[2]!.slice(2)}`
  return binderId === 'b-other' ? '他' : '封入'
}

export default function Home() {
  const { catalog, allSets, statOf, userSets, imageIds } = useAppData()
  useScrollRestore('home')

  // バインダー別・全体の集計
  const perBinder = catalog.binders.map((b) => {
    const sets = allSets.filter((s) => s.binderId === b.id)
    let owned = 0
    let total = 0
    let completeSets = 0
    for (const s of sets) {
      const st = statOf(s.id)
      owned += st.owned
      total += st.total
      if (st.total > 0 && st.owned === st.total) completeSets++
    }
    return { binder: b, owned, total, sets: sets.length, completeSets }
  })
  const owned = perBinder.reduce((n, b) => n + b.owned, 0)
  const total = perBinder.reduce((n, b) => n + b.total, 0)
  const completeSets = perBinder.reduce((n, b) => n + b.completeSets, 0)
  const percent = pct(owned, total)

  // バックアップ催促（しばらく書き出していないとき）。閉じると数日は出さない。
  // owned は非同期で埋まるので毎レンダー導出（localStorage参照は軽い）。
  const [backupDismissed, setBackupDismissed] = useState(false)
  const remindBackup = !backupDismissed && shouldRemindBackup(owned)
  const backupDays = daysSinceBackup()

  return (
    <>
      <Header
        title={`${catalog.member.name} 生写真`}
        subtitle="コレクション"
        right={
          <span className="flex items-center">
            <button
              onClick={() => navigate('/import')}
              aria-label="一括取込"
              className="p-2 rounded-full text-slate-500 active:bg-slate-200/70 transition-colors"
            >
              <CameraIcon className="w-6 h-6" />
            </button>
            <button
              onClick={() => navigate('/trade')}
              aria-label="トレード"
              className="p-2 rounded-full text-slate-500 active:bg-slate-200/70 transition-colors"
            >
              <SwapIcon className="w-6 h-6" />
            </button>
            <button
              onClick={() => navigate('/search')}
              aria-label="検索"
              className="p-2 -mr-2 rounded-full text-slate-500 active:bg-slate-200/70 transition-colors"
            >
              <SearchIcon />
            </button>
          </span>
        }
      />
      <ScreenGuide
        guideKey="home"
        title="ホーム画面の使い方"
        enabled={tutorialSeen()}
        points={[
          { icon: '📷', label: '取込', desc: '写真からまとめて登録。' },
          { icon: '🔁', label: 'トレード', desc: 'ダブりと欲しいを交換。' },
          { icon: '🔍', label: '検索', desc: 'セットを名前や条件で探す。' },
          { icon: '📚', label: 'タブ', desc: '下からコレクション・統計・設定へ。' },
        ]}
      />
      <div className="mx-auto max-w-lg px-4 pt-4 space-y-4">
        {/* まだ何も無いとき: 前の端末からの復元を案内（所有0なら催促バナーは元々出ない＝排他） */}
        {owned === 0 && userSets.length === 0 && (
          <div className="rounded-2xl bg-sky-50 border border-sky-200 px-3.5 py-3 flex items-center gap-3">
            <div className="min-w-0 flex-1">
              <p className="text-[13px] font-bold text-sky-800">まだデータがありません</p>
              <p className="text-[11px] text-sky-600 leading-relaxed">前のデータがあるなら、設定→読み込み（復元）で戻せます。</p>
            </div>
            <button
              onClick={() => navigate('/settings')}
              className="shrink-0 h-8 px-3 rounded-lg bg-sky-500 text-white text-[12px] font-bold active:bg-sky-600 transition-colors"
            >
              設定へ
            </button>
          </div>
        )}
        {/* バックアップ催促（データは端末内だけ＝消える前に書き出しを促す） */}
        {remindBackup && (
          <div className="rounded-2xl bg-amber-50 border border-amber-200 px-3.5 py-3 flex items-center gap-3">
            <div className="min-w-0 flex-1">
              <p className="text-[13px] font-bold text-amber-800">
                {backupDays === null ? 'バックアップがまだです' : `前回のバックアップから${backupDays}日`}
              </p>
              <p className="text-[11px] text-amber-600 leading-relaxed">
                データは端末内だけ。書き出しておくと安心です。{imageIds.size > 0 && `添付画像（${imageIds.size}枚）は別ZIPでの書き出しが必要です。`}
              </p>
            </div>
            <button
              onClick={() => navigate('/settings')}
              className="shrink-0 h-8 px-3 rounded-lg bg-amber-500 text-white text-[12px] font-bold active:bg-amber-600 transition-colors"
            >
              書き出す
            </button>
            <button
              onClick={() => {
                snoozeBackupReminder()
                setBackupDismissed(true)
              }}
              aria-label="あとで"
              className="shrink-0 w-8 h-8 rounded-lg text-amber-400 text-lg active:bg-amber-100"
            >
              ✕
            </button>
          </div>
        )}
        {/* ヒーロー：総コンプ率 */}
        <section className="rounded-3xl bg-gradient-to-br from-violet-600 via-violet-600 to-fuchsia-500 text-white p-5 shadow-lg shadow-violet-200">
          <div className="flex items-center gap-5">
            <Gauge value={percent} size={104}>
              <div className="text-center">
                <div className="text-2xl font-extrabold leading-none">{percent}%</div>
                <div className="text-[10px] text-white/70 mt-1">コンプ率</div>
              </div>
            </Gauge>
            <div className="flex-1 space-y-2">
              <div>
                <div className="text-[11px] text-white/70">所有枚数</div>
                <div className="text-xl font-bold leading-tight">
                  {owned.toLocaleString()} <span className="text-sm font-normal text-white/70">/ {total.toLocaleString()} 枚</span>
                </div>
              </div>
              <div>
                <div className="text-[11px] text-white/70">コンプ済みセット</div>
                <div className="text-xl font-bold leading-tight">
                  {completeSets} <span className="text-sm font-normal text-white/70">/ {allSets.length} セット</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* バインダー一覧 */}
        <section className="space-y-3 pb-4">
          {perBinder.map(({ binder, owned: o, total: t, sets, completeSets: cs }) => {
            const p = pct(o, t)
            const complete = t > 0 && o === t
            return (
              <button
                key={binder.id}
                onClick={() => navigate(`/b/${binder.id}`)}
                className="w-full rounded-2xl bg-white p-4 shadow-sm border border-slate-100 flex items-center gap-4 text-left active:scale-[0.98] transition-transform"
              >
                {/* 年タイル */}
                <div
                  className={`w-14 h-14 shrink-0 rounded-xl flex items-center justify-center text-white font-bold text-[13px] ${
                    binder.sealed ? 'bg-gradient-to-br from-slate-500 to-slate-700' : 'bg-gradient-to-br from-violet-500 to-fuchsia-500'
                  }`}
                >
                  {yearChip(binder.id)}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="font-bold text-[15px] truncate">{binder.name}</span>
                    {complete && <SealCheck className="w-4 h-4 text-emerald-500 shrink-0" />}
                  </div>
                  <ProgressBar value={p} className="mt-2" />
                  <div className="mt-1.5 flex items-center justify-between text-[11px] text-slate-400">
                    <span>
                      {o}/{t}枚（{p}%）
                    </span>
                    <span>
                      コンプ {cs}/{sets}
                    </span>
                  </div>
                </div>
                <ChevronRight className="w-5 h-5 text-slate-300 shrink-0" />
              </button>
            )
          })}
        </section>
      </div>
    </>
  )
}
