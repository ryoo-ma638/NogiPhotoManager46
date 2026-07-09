import { describe, expect, it } from 'vitest'
import { buildBackup, parseBackup } from './backup'
import type { UserSet } from '../types'

const userSet: UserSet = {
  id: 'user-abc12345',
  binderId: 'b2026-2027',
  year: 2026,
  name: '会場限定',
  template: 'standard3',
  note: null,
  sortIndex: 1000,
  photos: [
    { slot: 'yori', label: 'ヨリ', rarity: 'normal' },
    { slot: 'c1', label: '限定', rarity: 'SR' },
  ],
  createdAt: '2026-07-03T00:00:00.000Z',
}

describe('parseBackup', () => {
  it('変換スクリプトの所有ファイル（ID文字列の配列）を読める', () => {
    const text = JSON.stringify({ member: 'yumiki_nao', owned: ['yumiki_nao:s0001:yori', 'yumiki_nao:s0001:chu'] })
    const parsed = parseBackup(text)
    expect(parsed.owned).toHaveLength(2)
    expect(parsed.owned[0]).toEqual({ photoId: 'yumiki_nao:s0001:yori', ownedDate: null })
    expect(parsed.userSets).toHaveLength(0)
  })

  it('バックアップv1（owned行のみ）を読める', () => {
    const text = JSON.stringify({ owned: [{ photoId: 'yumiki_nao:s0001:yori', ownedDate: '2026-07-03T00:00:00Z' }] })
    const parsed = parseBackup(text)
    expect(parsed.owned[0]!.ownedDate).toBe('2026-07-03T00:00:00Z')
  })

  it('バックアップv2は書き出し→読み込みで往復できる', () => {
    const backup = buildBackup('yumiki_nao', [{ photoId: 'yumiki_nao:user-abc12345:yori', ownedDate: null }], [userSet])
    const parsed = parseBackup(JSON.stringify(backup))
    expect(parsed.owned).toHaveLength(1)
    expect(parsed.userSets).toHaveLength(1)
    expect(parsed.userSets[0]).toEqual(userSet)
  })

  it('所持枚数(count)を書き出し→読み込みで保持する（トレードのダブり）', () => {
    const backup = buildBackup(
      'yumiki_nao',
      [
        { photoId: 'yumiki_nao:s0001:yori', ownedDate: null, count: 3 },
        { photoId: 'yumiki_nao:s0001:chu', ownedDate: null },
      ],
      [],
    )
    const parsed = parseBackup(JSON.stringify(backup))
    expect(parsed.owned.find((o) => o.photoId.endsWith(':yori'))!.count).toBe(3)
    // count省略は1枚扱い（復元後にcountを持たない＝アプリ側で1として解釈）
    expect(parsed.owned.find((o) => o.photoId.endsWith(':chu'))!.count).toBeUndefined()
  })

  it('「特に欲しい」(wanted)を書き出し→読み込みで保持する（求）', () => {
    const backup = buildBackup('yumiki_nao', [], [], [{ photoId: 'yumiki_nao:s0001:chu' }])
    const parsed = parseBackup(JSON.stringify(backup))
    expect(parsed.wanted).toEqual([{ photoId: 'yumiki_nao:s0001:chu' }])
  })

  it('wantedが無い旧バックアップは空の求として読む', () => {
    const parsed = parseBackup(JSON.stringify({ owned: ['yumiki_nao:s0001:yori'] }))
    expect(parsed.wanted).toEqual([])
  })

  it('owned配列が無いファイルは拒否する', () => {
    expect(() => parseBackup(JSON.stringify({ foo: 1 }))).toThrow()
  })

  it('不正な手動セット（user-以外のID）は拒否する', () => {
    const bad = { owned: [], userSets: [{ ...userSet, id: 's0001' }] }
    expect(() => parseBackup(JSON.stringify(bad))).toThrow()
  })
})
