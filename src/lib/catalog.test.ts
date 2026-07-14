import { describe, expect, it, vi } from 'vitest'
import { photosForSet } from './catalog'
import { TEMPLATES } from './templates'
import type { CatalogSet, Template } from '../types'

const makeSet = (template: Template): CatalogSet => ({
  id: 's0001',
  binderId: 'b2020-2021',
  year: 2020,
  name: 'テスト',
  template,
  sortIndex: 10,
  note: null,
})

describe('photosForSet', () => {
  it('テンプレごとの枚数が正しい', () => {
    const counts: Record<Template, number> = {
      standard3: 3,
      four4: 4,
      five5: 5,
      rareSet8: 8,
      event6: 6,
      single1: 1,
      pair2: 2,
    }
    for (const [template, count] of Object.entries(counts) as [Template, number][]) {
      expect(photosForSet('yumiki_nao', makeSet(template))).toHaveLength(count)
    }
  })

  it('写真IDは member:set:slot 形式（変換スクリプトと一致）', () => {
    const photos = photosForSet('yumiki_nao', makeSet('standard3'))
    expect(photos.map((p) => p.id)).toEqual(['yumiki_nao:s0001:yori', 'yumiki_nao:s0001:chu', 'yumiki_nao:s0001:hiki'])
  })

  it('rareSet8 は R×1 + SR×4 を含む', () => {
    const photos = photosForSet('yumiki_nao', makeSet('rareSet8'))
    expect(photos.filter((p) => p.rarity === 'R')).toHaveLength(1)
    expect(photos.filter((p) => p.rarity === 'SR')).toHaveLength(4)
  })

  it('全テンプレのslotが一意', () => {
    for (const slots of Object.values(TEMPLATES)) {
      const ids = slots.map((s) => s.slot)
      expect(new Set(ids).size).toBe(ids.length)
    }
  })

  it('pair2 は①②の2枚', () => {
    const photos = photosForSet('yumiki_nao', makeSet('pair2'))
    expect(photos.map((p) => p.label)).toEqual(['①', '②'])
  })

  it('未知テンプレはクラッシュせず空配列（フォールバック）', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const set = { ...makeSet('standard3'), template: 'unknownTmpl' as Template }
    expect(photosForSet('yumiki_nao', set)).toEqual([])
    expect(warn).toHaveBeenCalled()
    warn.mockRestore()
  })
})

describe('明示photos（MV系5種など）', () => {
  it('photosがあればテンプレより優先され、slotは維持される', () => {
    const set = { ...makeSet('five5'), photos: [
      { slot: 'yori', label: '①', rarity: 'normal' as const },
      { slot: 'chu', label: '②', rarity: 'normal' as const },
    ] }
    const photos = photosForSet('yumiki_nao', set)
    expect(photos.map((p) => p.label)).toEqual(['①', '②'])
    expect(photos[0]!.id).toBe('yumiki_nao:s0001:yori')
  })
})

describe('手動セット（その他）の枠整列', () => {
  const other = (photos: { slot: string; label: string }[]): CatalogSet => ({
    ...makeSet('single1'),
    id: 'user-abc',
    binderId: 'b-other',
    photos: photos.map((p) => ({ ...p, rarity: 'other' as const })),
    user: true,
  })

  it('user=true は保存順に関わらず ポーズ→番号→自由 に整列する', () => {
    const set = other([
      { slot: 'free1', label: '制服' },
      { slot: 'c1', label: '②' },
      { slot: 'hiki', label: 'ヒキ' },
      { slot: 'yori', label: 'ヨリ' },
    ])
    expect(photosForSet('yumiki_nao', set).map((p) => p.slot)).toEqual(['yori', 'hiki', 'c1', 'free1'])
  })

  it('整列してもslotは重複しない・全枠が残る', () => {
    const set = other([
      { slot: 'c2', label: '③' },
      { slot: 'p1', label: '①' },
      { slot: 'c1', label: '②' },
    ])
    const slots = photosForSet('yumiki_nao', set).map((p) => p.slot)
    expect(slots).toEqual(['p1', 'c1', 'c2']) // 旧①(p1)先頭のまま①②③
    expect(new Set(slots).size).toBe(slots.length)
  })

  it('user でないカタログセットは並べ替えない（明示photos順を保持）', () => {
    const set = { ...makeSet('five5'), photos: [
      { slot: 'c1', label: '②', rarity: 'other' as const },
      { slot: 'yori', label: 'ヨリ', rarity: 'other' as const },
    ] }
    // user フラグ無し → 与えた順のまま
    expect(photosForSet('yumiki_nao', set).map((p) => p.slot)).toEqual(['c1', 'yori'])
  })
})
