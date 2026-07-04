import { describe, expect, it } from 'vitest'
import { matchCaption, parseDateCode, slotForPose } from './match'
import { lookupSRCL, parseSRCL } from './srcl'
import type { CatalogSet } from '../types'

const set = (id: string, name: string, binderId = 'b'): CatalogSet => ({
  id, binderId, year: 2022, name, template: 'standard3', sortIndex: 10, note: null,
})

const NO_SEALED = new Set<string>()

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

describe('matchCaption', () => {
  const sets = [
    set('a', '2022.May-ビタミンカラー'),
    set('b', '2022.May-Ⅱ-フェイクファー'),
    set('c', '2022.May-Ⅲ-フロントボタントップス'),
    set('d', 'ハロウィン2022'),
    set('e', '12周年記念'),
    set('f', '12周年記念 2shot ver.'),
  ]
  it('Ⅱ と Ⅲ を取り違えない（前方一致の罠）', () => {
    expect(matchCaption('2022.May-Ⅱ', sets, NO_SEALED).sets.map((s) => s.id)).toEqual(['b'])
    expect(matchCaption('2022.May-Ⅲ', sets, NO_SEALED).sets.map((s) => s.id)).toEqual(['c'])
    expect(matchCaption('乃木坂46 2022. May', sets, NO_SEALED).sets.map((s) => s.id)).toEqual(['a'])
  })
  it('日付が無い印字は名前の部分一致で探す', () => {
    expect(matchCaption('ハロウィン2022', sets, NO_SEALED).sets.map((s) => s.id)).toEqual(['d'])
  })
  it('周年記念（Anniversary印字）は完全一致を優先', () => {
    const m = matchCaption('乃木坂46 12th Anniversary 弓木奈於', sets, NO_SEALED)
    expect(m.sets.map((s) => s.id)).toEqual(['e'])
    expect(m.via).toBe('anniversary')
  })
  it('該当なしは空', () => {
    expect(matchCaption('2029.May', sets, NO_SEALED).sets).toEqual([])
  })
})

describe('SRCL品番（封入）', () => {
  it('印字から品番を抜き出せる', () => {
    expect(parseSRCL('NOT FOR SALE SRCL 12620-21')).toBe(12620)
    expect(parseSRCL('© Sony Music Labels Inc. / SRCL-13070')).toBe(13070)
    expect(parseSRCL('印字なし')).toBeNull()
  })
  it('品番からシングルと盤を特定できる', () => {
    expect(lookupSRCL(12620)).toEqual({ setName: 'おひとりさま天国', slot: 'A' })
    expect(lookupSRCL(12627)).toEqual({ setName: 'おひとりさま天国', slot: 'D' })
    expect(lookupSRCL(12628)).toEqual({ setName: 'おひとりさま天国', slot: null }) // 通常盤は手動
    expect(lookupSRCL(13073)).toEqual({ setName: '歩道橋', slot: 'B' })
    expect(lookupSRCL(12022)).toEqual({ setName: 'Time flies', slot: null })
    expect(lookupSRCL(13513)).toEqual({ setName: 'マイリスペクトアルバム特別版', slot: 'C' })
    expect(lookupSRCL(12650)).toBeNull() // 未知の品番
  })
  it('matchCaptionでSRCL→封入セット＋盤まで届く', () => {
    const sealed = [set('s1', 'おひとりさま天国', 'b-sealed'), set('s2', '歩道橋', 'b-sealed')]
    const m = matchCaption('NOT FOR SALE SRCL 12622-3', [...sealed, set('x', 'おひとりさま天国')], new Set(['b-sealed']))
    expect(m.sets.map((s) => s.id)).toEqual(['s1']) // 封入バインダー側だけに一致
    expect(m.slot).toBe('B')
    expect(m.via).toBe('srcl')
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
