// 「その他」ユーザーセットに足す枠（番号・定番ポーズ）。カタログ枠は固定なので対象外。
import type { UserSetPhoto } from '../types'
import { circled } from './labels'

/** 次の未使用の連番枠（c{n}）。ラベルは現在の枠数+1の丸数字（既存の採番と揃える）。 */
export function nextNumberFrame(photos: UserSetPhoto[]): UserSetPhoto {
  const used = new Set(photos.map((p) => p.slot))
  let n = 1
  while (used.has(`c${n}`)) n++
  return { slot: `c${n}`, label: circled(photos.length + 1), rarity: 'other' }
}

// その他セットに足せる定番ポーズ（slotコードはテンプレに合わせる。走りはその他専用）
export const POSE_FRAMES: UserSetPhoto[] = [
  { slot: 'yori', label: 'ヨリ', rarity: 'other' },
  { slot: 'chu', label: 'チュウ', rarity: 'other' },
  { slot: 'hiki', label: 'ヒキ', rarity: 'other' },
  { slot: 'suwari-yori', label: '座りヨリ', rarity: 'other' },
  { slot: 'suwari-hiki', label: '座りヒキ', rarity: 'other' },
  { slot: 'hashiri', label: '走り', rarity: 'other' },
]
