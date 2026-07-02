import type { ReactNode } from 'react'
import { BackIcon } from './icons'
import { goBack } from '../lib/router'

export function pct(owned: number, total: number): number {
  return total > 0 ? Math.round((owned / total) * 100) : 0
}

/** 細い進捗バー */
export function ProgressBar({ value, className = '' }: { value: number; className?: string }) {
  return (
    <div className={`h-1.5 rounded-full bg-slate-200/80 overflow-hidden ${className}`}>
      <div
        className="h-full rounded-full bg-gradient-to-r from-violet-500 to-fuchsia-500 transition-[width] duration-500"
        style={{ width: `${value}%` }}
      />
    </div>
  )
}

/** 円形ゲージ（SVG） */
export function Gauge({
  value,
  size = 96,
  stroke = 9,
  trackClass = 'text-white/25',
  barClass = 'text-white',
  children,
}: {
  value: number
  size?: number
  stroke?: number
  trackClass?: string
  barClass?: string
  children?: ReactNode
}) {
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} strokeWidth={stroke} fill="none" stroke="currentColor" className={trackClass} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          strokeWidth={stroke}
          fill="none"
          stroke="currentColor"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - value / 100)}
          className={`${barClass} transition-[stroke-dashoffset] duration-700`}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">{children}</div>
    </div>
  )
}

/** 画面ヘッダー（sticky・戻るボタン付き） */
export function Header({ title, subtitle, back = false, right }: { title: string; subtitle?: string; back?: boolean; right?: ReactNode }) {
  return (
    <header className="sticky top-0 z-20 bg-slate-50/85 backdrop-blur border-b border-slate-200/70">
      <div className="mx-auto max-w-lg px-4 h-14 flex items-center gap-2">
        {back && (
          <button onClick={goBack} aria-label="戻る" className="-ml-2 p-2 rounded-full text-slate-600 active:bg-slate-200/70 transition-colors">
            <BackIcon />
          </button>
        )}
        <div className="min-w-0 flex-1">
          <h1 className="font-bold text-[17px] leading-tight truncate">{title}</h1>
          {subtitle && <p className="text-[11px] text-slate-400 truncate">{subtitle}</p>}
        </div>
        {right}
      </div>
    </header>
  )
}

/** 確認ダイアログ（破壊的な一括操作用） */
export function ConfirmSheet({
  message,
  confirmLabel,
  danger = false,
  onConfirm,
  onCancel,
}: {
  message: string
  confirmLabel: string
  danger?: boolean
  onConfirm: () => void
  onCancel: () => void
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 animate-fade" onClick={onCancel}>
      <div
        className="w-full max-w-lg m-3 mb-[calc(0.75rem+env(safe-area-inset-bottom))] rounded-2xl bg-white p-4 shadow-xl animate-pop"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="text-[15px] text-slate-700 text-center py-2 whitespace-pre-line">{message}</p>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <button onClick={onCancel} className="h-12 rounded-xl bg-slate-100 font-medium text-slate-600 active:scale-[0.98] transition-transform">
            キャンセル
          </button>
          <button
            onClick={onConfirm}
            className={`h-12 rounded-xl font-bold text-white active:scale-[0.98] transition-transform ${danger ? 'bg-red-500' : 'bg-violet-600'}`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
