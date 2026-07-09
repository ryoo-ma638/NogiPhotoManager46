import { useState } from 'react'

// 初回起動で1回出す使い方ガイド（設定からも見返せる）。画面中央・イラスト付き・1画面1メッセージで短く。
const STEPS = [
  { emoji: '🌸', bg: 'from-violet-100 to-fuchsia-100', title: 'ようこそ', body: '弓木奈於の生写真を「持ってる・持ってない」で記録するアプリです。' },
  { emoji: '✅', bg: 'from-emerald-100 to-teal-100', title: '記録する', body: 'セットを開いて、持っている写真をタップで○。下の −/＋ で枚数も。' },
  { emoji: '📷', bg: 'from-sky-100 to-blue-100', title: 'まとめて取り込む', body: '「取込」でカメラや写真から、AIが自動で振り分けます。' },
  { emoji: '🔁', bg: 'from-pink-100 to-rose-100', title: 'トレード', body: 'ダブりと「特に欲しい」を管理。求/譲リストも作れます。' },
  { emoji: '💾', bg: 'from-amber-100 to-orange-100', title: 'バックアップ', body: 'データは端末の中だけ。設定→書き出しでときどき保存を。' },
]

export function Tutorial({ onClose }: { onClose: () => void }) {
  const [i, setI] = useState(0)
  const step = STEPS[i]!
  const last = i === STEPS.length - 1

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 animate-fade p-5" onClick={onClose}>
      <div className="w-full max-w-xs rounded-3xl bg-white p-5 shadow-2xl animate-pop" onClick={(e) => e.stopPropagation()}>
        {/* イラスト */}
        <div className={`flex h-28 items-center justify-center rounded-2xl bg-gradient-to-br ${step.bg}`}>
          <span className="text-[56px] leading-none" aria-hidden>
            {step.emoji}
          </span>
        </div>

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
            <button
              onClick={onClose}
              className="flex-1 h-11 rounded-xl bg-violet-600 text-white font-bold active:scale-[0.98] transition-transform"
            >
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
