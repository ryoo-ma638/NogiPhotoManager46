import { describe, expect, it } from 'vitest'
import { nextNumberFrame, POSE_FRAMES } from './frames'
import type { UserSetPhoto } from '../types'

describe('nextNumberFrame（その他セットの番号採番）', () => {
  it('空の枠なら c1・①', () => {
    expect(nextNumberFrame([])).toEqual({ slot: 'c1', label: '①', rarity: 'other' })
  })

  it('c1 があれば次は c2・②', () => {
    const photos: UserSetPhoto[] = [{ slot: 'c1', label: '①', rarity: 'other' }]
    expect(nextNumberFrame(photos)).toEqual({ slot: 'c2', label: '②', rarity: 'other' })
  })

  it('slotの抜けは最小の未使用で埋める・ラベルは枠数+1（既存採番と同じ）', () => {
    const photos: UserSetPhoto[] = [
      { slot: 'c1', label: '①', rarity: 'other' },
      { slot: 'c3', label: '③', rarity: 'other' },
    ]
    // 未使用の最小 c2 を採用。ラベルは photos.length+1 = 3 → ③
    expect(nextNumberFrame(photos)).toEqual({ slot: 'c2', label: '③', rarity: 'other' })
  })
})

describe('POSE_FRAMES', () => {
  it('slotが重複しない・すべて rarity other', () => {
    const slots = POSE_FRAMES.map((p) => p.slot)
    expect(new Set(slots).size).toBe(slots.length)
    expect(POSE_FRAMES.every((p) => p.rarity === 'other')).toBe(true)
  })
})
