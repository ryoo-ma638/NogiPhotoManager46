import { describe, expect, it } from 'vitest'
import { buildTradeExport, computeOverlap, parseTradeExport } from './trade'

describe('trade 共有ファイル', () => {
  it('書き出し→読み込みで持ち主(ニックネーム)・譲(枚数)・求を保持する', () => {
    const exp = buildTradeExport('yumiki_nao', 'りょうま', [{ photoId: 'yumiki_nao:s0043:yori', qty: 2 }], ['yumiki_nao:s0043:chu'])
    const parsed = parseTradeExport(JSON.stringify(exp))
    expect(parsed.ownerName).toBe('りょうま')
    expect(parsed.give.get('yumiki_nao:s0043:yori')).toBe(2)
    expect(parsed.want.has('yumiki_nao:s0043:chu')).toBe(true)
  })

  it('旧形式(memberName)の持ち主も読める', () => {
    const old = { app: 'NogiPhotoManager46', kind: 'trade', member: 'yumiki_nao', memberName: '旧太郎', exportedAt: '', give: [], want: [] }
    expect(parseTradeExport(JSON.stringify(old)).ownerName).toBe('旧太郎')
  })

  it('トレード形式でないファイルは拒否する', () => {
    expect(() => parseTradeExport(JSON.stringify({ owned: [] }))).toThrow()
  })

  it('重なり計算: もらえる(相手の譲∩自分の求)・渡せる(自分の譲∩相手の求)', () => {
    const myGive = new Set(['A', 'B']) // 自分のダブり
    const myWant = new Set(['X', 'Y']) // 自分の求
    const theirGive = new Map([
      ['X', 1], // 相手のダブり（自分が欲しいX）
      ['Z', 2],
    ])
    const theirWant = new Set(['B', 'W']) // 相手の求（自分が持つB）
    const o = computeOverlap(myGive, myWant, theirGive, theirWant)
    expect(o.canGet).toEqual([{ photoId: 'X', qty: 1 }]) // Xをもらえる
    expect(o.canGive).toEqual(['B']) // Bを渡せる
  })

  it('重なりが無ければ空', () => {
    const o = computeOverlap(new Set(['A']), new Set(['X']), new Map([['Z', 1]]), new Set(['W']))
    expect(o.canGet).toEqual([])
    expect(o.canGive).toEqual([])
  })
})
