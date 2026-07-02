import type { Rarity, Template } from '../types'

interface SlotDef {
  slot: string
  label: string
  rarity: Rarity
}

const STD3: SlotDef[] = [
  { slot: 'yori', label: 'ヨリ', rarity: 'normal' },
  { slot: 'chu', label: 'チュウ', rarity: 'normal' },
  { slot: 'hiki', label: 'ヒキ', rarity: 'normal' },
]

// 変換スクリプト(scripts/convert_catalog.py)のテンプレ定義とslotコードを一致させること
export const TEMPLATES: Record<Template, SlotDef[]> = {
  standard3: STD3,
  four4: ['A', 'B', 'C', 'D'].map((l) => ({ slot: l.toLowerCase(), label: l, rarity: 'normal' as Rarity })),
  five5: [
    ...STD3,
    { slot: 'suwari-yori', label: '座りヨリ', rarity: 'normal' },
    { slot: 'suwari-hiki', label: '座りヒキ', rarity: 'normal' },
  ],
  rareSet8: [
    ...STD3,
    { slot: 'r1', label: 'R', rarity: 'R' },
    { slot: 'sr1', label: 'SR①', rarity: 'SR' },
    { slot: 'sr2', label: 'SR②', rarity: 'SR' },
    { slot: 'sr3', label: 'SR③', rarity: 'SR' },
    { slot: 'sr4', label: 'SR④', rarity: 'SR' },
  ],
  event6: ['①', '②', '③', '④', '⑤', '⑥'].map((l, i) => ({ slot: `p${i + 1}`, label: l, rarity: 'normal' as Rarity })),
  single1: [{ slot: 'p1', label: '封入', rarity: 'normal' }],
}
