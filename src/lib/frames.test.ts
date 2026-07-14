import { describe, expect, it } from 'vitest'
import { frameSortKey, nextFreeSlot, nextNumberFrame, POSE_FRAMES } from './frames'
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

describe('nextFreeSlot（自由入力の枠のslot採番）', () => {
  it('自由枠がなければ free1', () => {
    expect(nextFreeSlot([])).toBe('free1')
    expect(nextFreeSlot([{ slot: 'yori', label: 'ヨリ', rarity: 'other' }])).toBe('free1')
  })

  it('既存 free の最大+1（追加順で下に並ぶ）', () => {
    const photos: UserSetPhoto[] = [
      { slot: 'free1', label: '制服', rarity: 'other' },
      { slot: 'free3', label: '私服', rarity: 'other' },
    ]
    expect(nextFreeSlot(photos)).toBe('free4')
  })
})

describe('POSE_FRAMES', () => {
  it('ヨリ/チュウ/ヒキ/座りヨリ/座りヒキ の5つ（走りは廃止）', () => {
    expect(POSE_FRAMES.map((p) => p.slot)).toEqual(['yori', 'chu', 'hiki', 'suwari-yori', 'suwari-hiki'])
    expect(POSE_FRAMES.some((p) => p.slot === 'hashiri')).toBe(false)
  })

  it('slotが重複しない・すべて rarity other', () => {
    const slots = POSE_FRAMES.map((p) => p.slot)
    expect(new Set(slots).size).toBe(slots.length)
    expect(POSE_FRAMES.every((p) => p.rarity === 'other')).toBe(true)
  })
})

describe('frameSortKey（枠の並び順）', () => {
  const sort = (slots: string[]) => [...slots].sort((a, b) => frameSortKey(a) - frameSortKey(b))

  it('ポーズ → 番号 → 自由 の順に並ぶ（追加順に依らない）', () => {
    // 追加順はバラバラ
    const slots = ['free1', 'c2', 'hiki', 'c1', 'yori', 'free2', 'suwari-yori']
    expect(sort(slots)).toEqual(['yori', 'hiki', 'suwari-yori', 'c1', 'c2', 'free1', 'free2'])
  })

  it('ポーズ内はヨリ→チュウ→ヒキ→座りヨリ→座りヒキ', () => {
    const slots = ['suwari-hiki', 'chu', 'suwari-yori', 'hiki', 'yori']
    expect(sort(slots)).toEqual(['yori', 'chu', 'hiki', 'suwari-yori', 'suwari-hiki'])
  })

  it('番号 c{n} は数値昇順（c2 と c10 を辞書順で誤らない）', () => {
    expect(sort(['c10', 'c2', 'c1'])).toEqual(['c1', 'c2', 'c10'])
  })

  it('旧①(p1)はポーズと番号の間・c より前（既存その他セットの並びを保つ）', () => {
    // 旧createOtherSetの [p1=①, c1=②, c2=③] は①②③のまま
    expect(sort(['c2', 'c1', 'p1'])).toEqual(['p1', 'c1', 'c2'])
    expect(frameSortKey('p1')).toBeLessThan(frameSortKey('c1'))
    expect(frameSortKey('yori')).toBeLessThan(frameSortKey('p1'))
  })

  it('自由 free{n} は追加順（数値昇順）で末尾側', () => {
    expect(sort(['free2', 'free1', 'free10'])).toEqual(['free1', 'free2', 'free10'])
    expect(frameSortKey('free1')).toBeGreaterThan(frameSortKey('c99'))
  })
})
