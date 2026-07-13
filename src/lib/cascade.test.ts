import { describe, expect, it } from 'vitest'
import { cascadeDecision } from './cascade'

describe('連番オートフィルの判定', () => {
  it('空欄は連番で埋める（候補ありの未確定も積極的に巻き込む）', () => {
    expect(cascadeDecision({ status: 'done', setId: null }, 's1')).toBe('fill')
    // 候補を持つ未確定でも埋める（4枚コンプ・5種を続けて撮る前提。誤りは「元に戻す」で戻せる）
    expect(cascadeDecision({ status: 'done', setId: null }, 's1')).toBe('fill')
  })

  it('同一セットは埋める・別セットが確定済みは止める', () => {
    expect(cascadeDecision({ status: 'done', setId: 's1' }, 's1')).toBe('fill')
    expect(cascadeDecision({ status: 'done', setId: 's2' }, 's1')).toBe('stop')
  })

  it('保存済みは飛ばす', () => {
    expect(cascadeDecision({ status: 'saved', setId: null }, 's1')).toBe('skip')
  })
})
