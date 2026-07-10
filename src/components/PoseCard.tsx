import { ThumbImg } from './images'
import { CameraIcon, CheckCircle, HeartIcon, PhotoIcon } from './icons'
import type { Photo, Rarity } from '../types'

const RARITY_STYLE: Record<Rarity, { tile: string; badge?: string; badgeLabel?: string }> = {
  normal: { tile: 'bg-slate-100 text-slate-300' },
  R: { tile: 'bg-gradient-to-br from-sky-100 to-sky-200 text-sky-300', badge: 'bg-sky-500 text-white', badgeLabel: 'R' },
  SR: { tile: 'bg-gradient-to-br from-amber-100 to-amber-200 text-amber-300', badge: 'bg-gradient-to-r from-amber-500 to-yellow-500 text-white', badgeLabel: 'SR' },
  other: { tile: 'bg-gradient-to-br from-fuchsia-100 to-violet-200 text-fuchsia-300', badge: 'bg-fuchsia-500 text-white', badgeLabel: '他' },
}

/** セット詳細のポーズ1枠。所有トグル・枚数−/＋・♡（特に欲しい）・画像添付/拡大をまとめた表示カード。 */
export function PoseCard({
  photo,
  isOwned,
  count,
  onSetCount,
  isWanted,
  onToggleWanted,
  hasImage,
  imgVersion,
  onToggle,
  onOpen,
  onAttach,
}: {
  photo: Photo
  isOwned: boolean
  count: number
  onSetCount: (n: number) => void
  isWanted: boolean
  onToggleWanted: () => void
  hasImage: boolean
  imgVersion: number
  onToggle: () => void
  onOpen: () => void
  onAttach: () => void
}) {
  const style = RARITY_STYLE[photo.rarity]
  const dup = count >= 2 // ダブり（譲れる）
  return (
    <div
      role="button"
      tabIndex={0}
      // カード本体タップ: 画像があれば拡大、なければ所有トグル
      onClick={hasImage ? onOpen : onToggle}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') (hasImage ? onOpen : onToggle)()
      }}
      aria-label={photo.label}
      className={`relative rounded-2xl p-1.5 text-left transition-all active:scale-95 border-2 cursor-pointer select-none ${
        isOwned ? 'bg-white border-emerald-400 shadow-sm' : 'bg-white/70 border-transparent'
      }`}
    >
      {/* 写真エリア（生写真比率 89:127） */}
      <div
        className={`relative aspect-[89/127] rounded-xl overflow-hidden flex items-center justify-center ${style.tile} ${
          isOwned ? '' : 'grayscale opacity-70'
        }`}
      >
        {hasImage ? <ThumbImg photoId={photo.id} version={imgVersion} className="absolute inset-0 w-full h-full object-cover" /> : <PhotoIcon className="w-8 h-8" />}
        {/* ダブり（2枚以上＝譲れる）バッジ */}
        {dup && (
          <span className="absolute top-1 left-1 rounded bg-amber-400 text-white text-[9px] font-extrabold px-1 py-px shadow">ダブり</span>
        )}
        {/* 特に欲しい（求）: 未所有のときだけ。ハートで印を付ける */}
        {!isOwned && (
          <button
            onClick={(e) => {
              e.stopPropagation()
              onToggleWanted()
            }}
            aria-label={`${photo.label}を特に欲しい${isWanted ? 'から外す' : 'にする'}`}
            className="absolute top-1 left-1 p-1 active:scale-90 transition-transform"
          >
            <HeartIcon className={`w-5 h-5 drop-shadow ${isWanted ? 'text-pink-500' : 'text-white/80'}`} filled={isWanted} />
          </button>
        )}
        {/* 所持枚数の −/+（所有時のみ）。2枚以上＝ダブり（譲れる） */}
        {isOwned && (
          <div
            className="absolute inset-x-0 bottom-0 flex items-center justify-between px-1 py-0.5 bg-black/45 backdrop-blur-[1px]"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={(e) => {
                e.stopPropagation()
                onSetCount(count - 1)
              }}
              aria-label={`${photo.label}の枚数を減らす`}
              className="w-6 h-6 rounded-md text-white text-[15px] leading-none active:bg-white/20"
            >
              −
            </button>
            <span className={`text-[12px] font-bold tabular-nums whitespace-nowrap ${dup ? 'text-amber-300' : 'text-white'}`}>
              {count}枚
            </span>
            <button
              onClick={(e) => {
                e.stopPropagation()
                onSetCount(count + 1)
              }}
              aria-label={`${photo.label}の枚数を増やす`}
              className="w-6 h-6 rounded-md text-white text-[15px] leading-none active:bg-white/20"
            >
              ＋
            </button>
          </div>
        )}
      </div>
      {/* 所有チェック（常にトグル専用の独立ボタン） */}
      <button
        onClick={(e) => {
          e.stopPropagation()
          onToggle()
        }}
        aria-label={`${photo.label}を${isOwned ? '未所有' : '所有'}にする`}
        className="absolute top-1.5 right-1.5 p-1.5 active:scale-90 transition-transform"
      >
        <CheckCircle className={`w-6 h-6 drop-shadow-sm ${isOwned ? 'text-emerald-500' : 'text-slate-300'}`} filled={isOwned} />
      </button>
      <div className="mt-1.5 px-0.5 pb-0.5 flex items-center justify-between gap-1">
        <span className={`text-[12px] font-bold truncate ${isOwned ? 'text-slate-700' : 'text-slate-400'}`}>{photo.label}</span>
        <span className="flex items-center gap-1 shrink-0">
          {style.badge && <span className={`rounded px-1 py-px text-[9px] font-extrabold ${style.badge}`}>{style.badgeLabel}</span>}
          {/* 画像添付ボタン */}
          <button
            onClick={(e) => {
              e.stopPropagation()
              onAttach()
            }}
            aria-label={`${photo.label}に画像を添付`}
            className={`p-1 -m-0.5 rounded-md active:bg-slate-200/70 transition-colors ${hasImage ? 'text-slate-300' : 'text-violet-400'}`}
          >
            <CameraIcon className="w-4 h-4" />
          </button>
        </span>
      </div>
    </div>
  )
}
