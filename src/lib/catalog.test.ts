import { describe, expect, it } from 'vitest'
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
})
