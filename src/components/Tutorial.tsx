import { useState } from 'react'

// 初回起動で1回出す使い方ガイド（設定からも見返せる）。1画面1メッセージで短く。
const STEPS = [
  {
    emoji: '🌸',
    title: 'ようこそ',
    body: 'このアプリは、弓木奈於の生写真を「持ってる／持ってない」で記録するコレクション管理アプリです。',
  },
  {
    emoji: '✅',
    title: '記録する',
    body: 'コレクション → バインダー → 年 → セットと開いて、持っている写真をタップで○にするだけ。セット下部の「すべて所有にする」も便利です。',
  },
  {
    emoji: '📷',
    title: 'まとめて取り込む',
    body: '「取込」から、カメラで連続撮影 or 写真アプリから選ぶと、印字やポーズをAIが読んで自動で振り分け。まとめて保存できます。',
  },
  {
    emoji: '💾',
    title: 'バックアップだけは忘れずに',
    body: '○×のデータはこの端末の中だけに保存されます。設定 →「書き出し」でときどき保存を。アプリを消すと戻せません。',
  },
]

export function Tutorial({ onClose }: { onClose: () => void }) {
  const [i, setI] = useState(0)
  const step = STEPS[i]!
  const last = i === STEPS.length - 1

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/40 animate-fade" onClick={onClose}>
      <div
        className="w-full max-w-lg m-3 mb-[calc(0.75rem+env(safe-area-inset-bottom))] rounded-2xl bg-white p-5 shadow-xl animate-pop"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="text-center px-2">
          <div className="text-5xl mb-3" aria-hidden>
            {step.emoji}
          </div>
          <h2 className="text-[17px] font-bold text-slate-800">{step.title}</h2>
          <p className="mt-2 text-[14px] text-slate-500 leading-relaxed">{step.body}</p>
        </div>

        {/* 進捗ドット */}
        <div className="flex justify-center gap-1.5 mt-5">
          {STEPS.map((_, k) => (
            <span key={k} className={`h-1.5 rounded-full transition-all ${k === i ? 'w-5 bg-violet-500' : 'w-1.5 bg-slate-200'}`} />
          ))}
        </div>

        {/* 操作 */}
        <div className="mt-5 flex items-center gap-2">
          {last ? (
            <button
              onClick={onClose}
              className="flex-1 h-11 rounded-xl bg-violet-600 text-white font-bold active:scale-[0.98] transition-transform"
            >
              はじめる
            </button>
          ) : (
            <>
              <button onClick={onClose} className="h-11 px-4 rounded-xl text-slate-400 font-medium text-[14px]">
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
