import { useState, type ReactNode } from 'react'

// 初回起動で1回出す使い方ガイド（設定からも見返せる）。画面中央・イラスト付き・1画面1メッセージで短く。

// --- 各ステップのイラスト（依存なしのインラインSVG） ---
const IlloWelcome = (
  <svg viewBox="0 0 140 80" fill="none" className="h-20">
    <rect x="33" y="26" width="22" height="30" rx="3.5" fill="white" stroke="#c4b5fd" strokeWidth="2" />
    <rect x="86" y="26" width="22" height="30" rx="3.5" fill="white" stroke="#c4b5fd" strokeWidth="2" />
    <rect x="58" y="20" width="24" height="38" rx="4" fill="white" stroke="#8b5cf6" strokeWidth="2.5" />
    <circle cx="70" cy="32" r="5" fill="#ddd6fe" />
    <rect x="63" y="41" width="14" height="3" rx="1.5" fill="#ede9fe" />
  </svg>
)
const IlloRecord = (
  <svg viewBox="0 0 140 80" fill="none" className="h-20">
    <rect x="46" y="18" width="34" height="44" rx="5" fill="white" stroke="#6ee7b7" strokeWidth="2.5" />
    <circle cx="63" cy="34" r="7" fill="#d1fae5" />
    <rect x="52" y="47" width="22" height="4" rx="2" fill="#ecfdf5" />
    <circle cx="84" cy="24" r="11" fill="#10b981" />
    <path d="M79 24.5l3.2 3.2 6-6.5" stroke="white" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
)
const IlloImport = (
  <svg viewBox="0 0 140 80" fill="none" className="h-20">
    <rect x="22" y="30" width="34" height="26" rx="5" fill="white" stroke="#7dd3fc" strokeWidth="2.5" />
    <rect x="32" y="25" width="14" height="7" rx="2.5" fill="#e0f2fe" stroke="#7dd3fc" strokeWidth="1.5" />
    <circle cx="39" cy="43" r="7" fill="#e0f2fe" stroke="#38bdf8" strokeWidth="2" />
    <path d="M66 43h16m0 0l-4.5-4M82 43l-4.5 4" stroke="#0ea5e9" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
    <rect x="92" y="31" width="16" height="24" rx="3" fill="white" stroke="#7dd3fc" strokeWidth="2" />
    <rect x="110" y="31" width="16" height="24" rx="3" fill="white" stroke="#7dd3fc" strokeWidth="2" />
  </svg>
)
const IlloTrade = (
  <svg viewBox="0 0 140 80" fill="none" className="h-20">
    <rect x="26" y="23" width="26" height="34" rx="4" fill="white" stroke="#f9a8d4" strokeWidth="2.5" />
    <rect x="88" y="23" width="26" height="34" rx="4" fill="white" stroke="#6ee7b7" strokeWidth="2.5" />
    <path d="M60 33h20m0 0l-4.5-3.5M80 33l-4.5 3.5" stroke="#ec4899" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M80 47H60m0 0l4.5-3.5M60 47l4.5 3.5" stroke="#10b981" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
)
const IlloBackup = (
  <svg viewBox="0 0 140 80" fill="none" className="h-20">
    <rect x="55" y="12" width="30" height="26" rx="4" fill="white" stroke="#fcd34d" strokeWidth="2.5" />
    <circle cx="70" cy="23" r="4" fill="#fef3c7" />
    <path d="M70 42v12m0 0l-5.5-5.5M70 54l5.5-5.5" stroke="#f59e0b" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M50 58h40v7a2 2 0 01-2 2H52a2 2 0 01-2-2v-7z" fill="#fef3c7" stroke="#fcd34d" strokeWidth="2" />
  </svg>
)

const STEPS: { illo: ReactNode; bg: string; title: string; body: string }[] = [
  { illo: IlloWelcome, bg: 'from-violet-100 to-fuchsia-100', title: 'ようこそ', body: '弓木奈於の生写真を、持ってる・持ってないで記録するアプリです。' },
  { illo: IlloRecord, bg: 'from-emerald-100 to-teal-100', title: '写真をタップで○', body: '持っている写真をタップで○に。下の −/＋ で枚数も数えられます。' },
  { illo: IlloImport, bg: 'from-sky-100 to-blue-100', title: 'まとめて取り込む', body: 'カメラで撮るか写真から選ぶと、AIが自動でセットに振り分けます。' },
  { illo: IlloTrade, bg: 'from-pink-100 to-rose-100', title: 'トレード', body: '余り（ダブり）と♡（特に欲しい）を記録して、求/譲リストを作れます。' },
  { illo: IlloBackup, bg: 'from-amber-100 to-orange-100', title: 'バックアップ', body: 'データは端末の中だけ。設定→書き出しでときどき保存を。' },
]

export function Tutorial({ onClose }: { onClose: () => void }) {
  const [i, setI] = useState(0)
  const step = STEPS[i]!
  const last = i === STEPS.length - 1

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 animate-fade p-5" onClick={onClose}>
      <div className="w-full max-w-xs rounded-3xl bg-white p-5 shadow-2xl animate-pop" onClick={(e) => e.stopPropagation()}>
        <div className={`flex h-28 items-center justify-center rounded-2xl bg-gradient-to-br ${step.bg}`}>{step.illo}</div>

        <h2 className="mt-4 text-center text-[17px] font-bold text-slate-800">{step.title}</h2>
        <p className="mt-1.5 text-center text-[13px] text-slate-500 leading-relaxed">{step.body}</p>

        {/* 進捗ドット */}
        <div className="mt-4 flex justify-center gap-1.5">
          {STEPS.map((_, k) => (
            <span key={k} className={`h-1.5 rounded-full transition-all ${k === i ? 'w-5 bg-violet-500' : 'w-1.5 bg-slate-200'}`} />
          ))}
        </div>

        {/* 操作 */}
        <div className="mt-4 flex items-center gap-2">
          {last ? (
            <button onClick={onClose} className="flex-1 h-11 rounded-xl bg-violet-600 text-white font-bold active:scale-[0.98] transition-transform">
              はじめる
            </button>
          ) : (
            <>
              <button onClick={onClose} className="h-11 px-3 rounded-xl text-slate-400 font-medium text-[13px]">
                スキップ
              </button>
              <button
                onClick={() => setI((n) => n + 1)}
                className="flex-1 h-11 rounded-xl bg-violet-600 text-white font-bold active:scale-[0.98] transition-transform"
              >
                次へ
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
