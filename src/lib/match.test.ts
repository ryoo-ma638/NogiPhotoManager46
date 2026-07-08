import { describe, expect, it } from 'vitest'
import { matchCaption, normalizeForSearch, parseDateCode, slotForPose } from './match'
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
  it('タイトルの一部だけ読めても、それを含むセットを候補に出す', () => {
    const arr = [
      set('m1', '真夏の全国ツアー2022 Tシャツ 愛知ver'),
      set('m2', '真夏の全国ツアー2022 Tシャツ 東京ver'),
      set('m3', 'バレンタイン2026'),
      set('m4', '好きというのはロックだぜ！'),
    ]
    const m1 = matchCaption('真夏の全国ツアー', arr, NO_SEALED)
    expect(m1.via).toBe('name')
    expect(m1.sets.map((s) => s.id)).toEqual(expect.arrayContaining(['m1', 'm2']))
    expect(m1.sets.map((s) => s.id)).not.toContain('m3')
    // ロゴタイトルの一部でも拾える
    expect(matchCaption('ロックだぜ', arr, NO_SEALED).sets.map((s) => s.id)).toEqual(['m4'])
  })
  it('季節イベントは日英どちらの印字でも一致し、共通語(乃木坂46)で誤って別セットを拾わない', () => {
    const arr = [
      set('h', 'ハロウィン2022'),
      set('v', '2022.Valentine'),
      set('tv', '乃木坂46時間TV Tシャツ'),
    ]
    // 英語印字 "Halloween" → 日本語名「ハロウィン2022」を候補に。時間TV(共通語=乃木坂46)は拾わない
    const mh = matchCaption('乃木坂46 2022.Halloween', arr, NO_SEALED)
    expect(mh.sets.map((s) => s.id)).toContain('h')
    expect(mh.sets.map((s) => s.id)).not.toContain('tv')
    // 英語印字 "Valentine" → 英語名「2022.Valentine」も当たる
    expect(matchCaption('乃木坂46 2022.Valentine', arr, NO_SEALED).sets.map((s) => s.id)).toContain('v')
  })
  it('normalizeForSearch は日英を共通化する（検索でどちらでもヒット）', () => {
    expect(normalizeForSearch('ハロウィン')).toBe(normalizeForSearch('Halloween'))
    expect(normalizeForSearch('クリスマス')).toBe(normalizeForSearch('christmas'))
    expect(normalizeForSearch("X'mas")).toContain('christmas')
    expect(normalizeForSearch('バレンタイン')).toContain('valentine')
  })
  it('周年は "11th BD" でも "11周年" でも同じセットに一致（TH/周年両対応）', () => {
    const arr = [set('a', '11周年記念'), set('b', '12周年記念')]
    expect(matchCaption('乃木坂46 11th BD 弓木奈於', arr, NO_SEALED).sets.map((s) => s.id)).toEqual(['a'])
    expect(matchCaption('乃木坂46 11th BIRTHDAY LIVE', arr, NO_SEALED).sets.map((s) => s.id)).toEqual(['a'])
    expect(matchCaption('11周年', arr, NO_SEALED).sets.map((s) => s.id)).toEqual(['a'])
    expect(matchCaption('乃木坂46 12th Anniversary', arr, NO_SEALED).sets.map((s) => s.id)).toEqual(['b'])
  })
  it('英語印字の誕生日ライブ+世代（FOURTH MEMBERS）で正しい期別セットを候補化', () => {
    const arr = [
      set('g4', '2023.June-Ⅱ-11thBDライブ期別衣装'),
      set('t4', '11thBDライブ 4期Tシャツ'),
      set('g9', '9th YEAR BIRTHDAY LIVE 3期生・4期生ライブ'),
      set('other', 'おひとりさま天国'),
    ]
    // 英語のまま読めた印字 → 11周年・4期の誕生日ライブ系が候補、無関係セットは出ない
    const m = matchCaption('乃木坂46 11TH YEAR BIRTHDAY LIVE FOURTH MEMBERS', arr, NO_SEALED)
    const ids = m.sets.map((s) => s.id)
    expect(ids).toContain('t4')
    expect(ids).not.toContain('other')
    expect(ids[0]).toBe('t4') // 11周年・4期が最上位（9周年より上）
  })
  it('年"2022"だけの偶然一致では候補にしない（誤読対策）', () => {
    const arr = [set('v1', 'バレンタイン2026'), set('v2', 'ハロウィン2022')]
    // 「真夏の全国ツアー2022 愛知」は v2 と "2022"(4文字)しか共有しない → 候補にしない
    expect(matchCaption('真夏の全国ツアー2022 愛知', arr, NO_SEALED).sets).toEqual([])
  })
  it('SRCLの無いNOT FOR SALE印字は「その他」の候補になる（自動確定はしない）', () => {
    const withOther = [...sets, set('o1', '乃木坂配信中限定！MV衣装生写真（Same numbers）', 'b-other')]
    const m = matchCaption('乃木坂46 弓木 奈於 NAO YUMIKI © Sony Music Labels Inc. / NOT FOR SALE', withOther, NO_SEALED)
    expect(m.via).toBe('other')
    expect(m.sets.map((s) => s.id)).toEqual(['o1'])
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
