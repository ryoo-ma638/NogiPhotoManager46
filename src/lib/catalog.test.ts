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
