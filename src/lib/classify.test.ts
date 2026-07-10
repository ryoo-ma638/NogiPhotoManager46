import { describe, expect, it } from 'vitest'
import { classifyPhoto } from './classify'
import type { CatalogSet } from '../types'
import type { RecognizedPhoto } from './recognize'

const set = (id: string, name: string, binderId = 'b'): CatalogSet => ({
  id,
  binderId,
  year: 2022,
  name,
  template: 'standard3',
  sortIndex: 10,
  note: null,
})

const rec = (over: Partial<RecognizedPhoto>): RecognizedPhoto => ({
  box: null,
  rotation: 0,
  caption: null,
  captionConfidence: 0.9,
  pose: 'unknown',
  poseConfidence: 0.9,
  ...over,
})

const NO_SEALED = new Set<string>()
const allSets = [set('a', '2022.May-Ⅱ-フェイクファー'), set('c', '2022.May-Ⅲ-フロントボタントップス')]

describe('classifyPhoto', () => {
  it('印字が無ければ全て未確定（poseは素通し）', () => {
    const c = classifyPhoto(rec({ caption: null, pose: 'yori' }), {
      allSets,
      sealedBinders: NO_SEALED,
      photosOf: () => [{ slot: 'only' }],
    })
    expect(c).toMatchObject({ setId: null, slot: null, candidates: null, auto: false, caption: null, pose: 'yori' })
  })

  it('日付コードで一意に当たり、1枚セットなら枠まで自動確定', () => {
    const c = classifyPhoto(rec({ caption: '2022.May-Ⅱ' }), {
      allSets,
      sealedBinders: NO_SEALED,
      photosOf: () => [{ slot: 'only' }],
    })
    expect(c.setId).toBe('a')
    expect(c.slot).toBe('only')
    expect(c.auto).toBe(true)
  })

  it('確信度が低ければ自動確定せず候補提示にとどめる', () => {
    const c = classifyPhoto(rec({ caption: '2022.May-Ⅱ', captionConfidence: 0.3 }), {
      allSets,
      sealedBinders: NO_SEALED,
      photosOf: () => [{ slot: 'only' }],
    })
    expect(c.setId).toBeNull()
    expect(c.auto).toBe(false)
    expect(c.candidates).toEqual(['a'])
  })

  it('複数枠セットでポーズ不明なら枠は自動で埋めない（誤登録回避）', () => {
    const c = classifyPhoto(rec({ caption: '2022.May-Ⅱ', pose: 'unknown' }), {
      allSets,
      sealedBinders: NO_SEALED,
      photosOf: () => [{ slot: 'A' }, { slot: 'B' }, { slot: 'C' }],
    })
    expect(c.setId).toBe('a')
    expect(c.slot).toBeNull()
    expect(c.auto).toBe(false)
  })
})
