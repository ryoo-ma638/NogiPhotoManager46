import { describe, expect, it } from 'vitest'
import { matchByCaption, parseDateCode, slotForPose } from './match'
import type { CatalogSet } from '../types'

const set = (id: string, name: string): CatalogSet => ({
  id, binderId: 'b', year: 2022, name, template: 'standard3', sortIndex: 10, note: null,
})

describe('parseDateCode', () => {
  it('ローマ数字（Ⅱ全角）を含むコードを読める', () => {
    expect(parseDateCode('2022.May-Ⅱ')).toEqual({ year: 2022, month: 'may', suffix: 'ii' })
  })
  it('無印・区切りゆれ・くっつきも読める', () => {
    expect(parseDateCode('2023.July')).toEqual({ year: 2023, month: 'july', suffix: '' })
    expect(parseDateCode('2022 may II')).toEqual({ year: 2022, month: 'may', suffix: 'ii' })
    expect(parseDateCode('2022mayii')).toEqual({ year: 2022, month: 'may', suffix: 'ii' })
  })
  it('日付が無ければnull', () => {
    expect(parseDateCode('ハロウィン2022')).toBeNull()
  })
})

describe('matchByCaption', () => {
  const sets = [
    set('a', '2022.May-ビタミンカラー'),
    set('b', '2022.May-Ⅱ-フェイクファー'),
    set('c', '2022.May-Ⅲ-フロントボタントップス'),
    set('d', 'ハロウィン2022'),
  ]
  it('Ⅱ と Ⅲ を取り違えない（前方一致の罠）', () => {
    expect(matchByCaption('2022.May-Ⅱ', sets).map((s) => s.id)).toEqual(['b'])
    expect(matchByCaption('2022.May-Ⅲ', sets).map((s) => s.id)).toEqual(['c'])
    expect(matchByCaption('2022.May', sets).map((s) => s.id)).toEqual(['a'])
  })
  it('日付が無い印字は名前の部分一致で探す', () => {
    expect(matchByCaption('ハロウィン2022', sets).map((s) => s.id)).toEqual(['d'])
  })
  it('該当なしは空配列', () => {
    expect(matchByCaption('2029.May', sets)).toEqual([])
  })
})

describe('slotForPose', () => {
  const slots = ['yori', 'chu', 'hiki']
  it('通常系はポーズ→枠に対応', () => {
    expect(slotForPose('yori', 'normal', slots)).toBe('yori')
    expect(slotForPose('hiki', 'rare8', [...slots, 'r1'])).toBe('hiki')
  })
  it('①〜⑤系（5種セット/MV等）は手動', () => {
    expect(slotForPose('yori', 'five', slots)).toBeNull()
    expect(slotForPose('yori', 'mv', slots)).toBeNull()
  })
  it('存在しない枠には割り当てない', () => {
    expect(slotForPose('suwari-yori', 'normal', slots)).toBeNull()
  })
})
