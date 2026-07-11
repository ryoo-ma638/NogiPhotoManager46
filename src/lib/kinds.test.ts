import { describe, expect, it } from 'vitest'
import { kindOf } from './kinds'
import type { CatalogSet } from '../types'

const base = (name: string, template: CatalogSet['template'] = 'standard3'): CatalogSet => ({
  id: 's0001', binderId: 'b', year: 2025, name, template, sortIndex: 10, note: null,
})

describe('kindOf', () => {
  it('カタログのkindフィールドを最優先する', () => {
    expect(kindOf({ ...base('何か'), kind: 'mv' }, false)).toBe('mv')
  })
  it('名前・テンプレから導出できる（手動セット用）', () => {
    expect(kindOf(base('チートデイMV', 'five5'), false)).toBe('mv')
    expect(kindOf(base('好きというのはロックだぜ！選抜ver.', 'five5'), false)).toBe('mv')
    expect(kindOf(base('2025.July-Ⅱ-浴衣', 'five5'), false)).toBe('suwari')
    expect(kindOf(base('13周年記念', 'five5'), false)).toBe('suwari')
    expect(kindOf(base('ハロウィン2025', 'five5'), false)).toBe('five')
    expect(kindOf(base('クリスマス2024', 'five5'), false)).toBe('five')
    expect(kindOf(base('ライブTシャツ'), false)).toBe('tshirt')
    expect(kindOf(base('ミニ生写真テスト'), false)).toBe('mini')
    expect(kindOf(base('紅白衣装', 'rareSet8'), false)).toBe('rare8')
    expect(kindOf(base('コーデ'), false)).toBe('normal')
    expect(kindOf(base('スキッツ特典2種', 'pair2'), false)).toBe('normal')
    expect(kindOf(base('何か'), true)).toBe('sealed')
  })
})
