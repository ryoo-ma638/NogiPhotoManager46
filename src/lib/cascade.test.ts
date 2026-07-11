import { describe, expect, it } from 'vitest'
import { cascadeDecision } from './cascade'

describe('連番オートフィルの判定', () => {
  it('完全に空欄（候補なし）は連番で埋める', () => {
    expect(cascadeDecision({ status: 'done', setId: null, candidates: null }, 's1')).toBe('fill')
    expect(cascadeDecision({ status: 'done', setId: null, candidates: [] }, 's1')).toBe('fill')
  })

  it('候補を持つ未確定は巻き込まず止める', () => {
    expect(cascadeDecision({ status: 'done', setId: null, candidates: ['s2'] }, 's1')).toBe('stop')
  })

  it('同一セットは埋める・別セット割当済みは止める', () => {
    expect(cascadeDecision({ status: 'done', setId: 's1', candidates: null }, 's1')).toBe('fill')
    expect(cascadeDecision({ status: 'done', setId: 's2', candidates: null }, 's1')).toBe('stop')
  })

  it('保存済みは飛ばす', () => {
    expect(cascadeDecision({ status: 'saved', setId: null, candidates: null }, 's1')).toBe('skip')
  })
})
