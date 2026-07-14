// 「その他」ユーザーセットに足す枠（番号・定番ポーズ・自由入力）。カタログ枠は固定なので対象外。
import type { UserSetPhoto } from '../types'
import { circled } from './labels'

/** 次の未使用の連番枠（c{n}）。ラベルは現在の枠数+1の丸数字（既存の採番と揃える）。 */
export function nextNumberFrame(photos: UserSetPhoto[]): UserSetPhoto {
  const used = new Set(photos.map((p) => p.slot))
  let n = 1
  while (used.has(`c${n}`)) n++
  return { slot: `c${n}`, label: circled(photos.length + 1), rarity: 'other' }
}

/** 次の未使用の自由枠のslot（free{n}）。既存 free{n} の最大+1＝追加順で下に並ぶ。 */
export function nextFreeSlot(photos: UserSetPhoto[]): string {
  let max = 0
  for (const p of photos) {
    const m = /^free(\d+)$/.exec(p.slot)
    if (m) max = Math.max(max, Number(m[1]))
  }
  return `free${max + 1}`
}

// その他セットに足せる定番ポーズ（slotコードはテンプレに合わせる）
export const POSE_FRAMES: UserSetPhoto[] = [
  { slot: 'yori', label: 'ヨリ', rarity: 'other' },
  { slot: 'chu', label: 'チュウ', rarity: 'other' },
  { slot: 'hiki', label: 'ヒキ', rarity: 'other' },
  { slot: 'suwari-yori', label: '座りヨリ', rarity: 'other' },
  { slot: 'suwari-hiki', label: '座りヒキ', rarity: 'other' },
]

// 枠の並び順（ポーズ既定順）。番号・自由はこの後ろに続く。
const POSE_ORDER: Record<string, number> = {
  yori: 0,
  chu: 1,
  hiki: 2,
  'suwari-yori': 3,
  'suwari-hiki': 4,
}

/**
 * その他セットの枠の並び順キー（小さいほど先頭）。
 * ポーズ → 旧①/テンプレ由来(p{n}) → 番号(c{n}) → 自由(free{n}) → その他 の順。
 * 追加順に関わらず常に同じ見え方にするため photosForSet の手動セット整列で使う。
 */
export function frameSortKey(slot: string): number {
  const pose = POSE_ORDER[slot]
  if (pose !== undefined) return pose
  const p = /^p(\d+)$/.exec(slot)
  if (p) return 100 + Number(p[1])
  const c = /^c(\d+)$/.exec(slot)
  if (c) return 1000 + Number(c[1])
  const f = /^free(\d+)$/.exec(slot)
  if (f) return 2000 + Number(f[1])
  return 3000
}
