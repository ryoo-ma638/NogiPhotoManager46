import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  DAILY_LIMIT,
  canAnalyze,
  consumeAnalysis,
  isOwner,
  lockOwner,
  remainingToday,
  unlockOwner,
  usedToday,
} from './limit'

function makeStorage() {
  const m = new Map<string, string>()
  return {
    getItem: (k: string) => (m.has(k) ? m.get(k)! : null),
    setItem: (k: string, v: string) => void m.set(k, String(v)),
    removeItem: (k: string) => void m.delete(k),
    clear: () => m.clear(),
    key: (i: number) => [...m.keys()][i] ?? null,
    get length() {
      return m.size
    },
  }
}

beforeEach(() => {
  vi.stubGlobal('localStorage', makeStorage())
  vi.useFakeTimers()
  vi.setSystemTime(new Date(2026, 6, 10, 10, 0, 0)) // 2026-07-10 10:00
})
afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe('非オーナーの回数制限', () => {
  it('初期状態は 0回・残りDAILY_LIMIT・判定可', () => {
    expect(isOwner()).toBe(false)
    expect(usedToday()).toBe(0)
    expect(remainingToday()).toBe(DAILY_LIMIT)
    expect(canAnalyze()).toBe(true)
  })

  it('消費するたびに増え、残りが減る', () => {
    consumeAnalysis()
    consumeAnalysis()
    expect(usedToday()).toBe(2)
    expect(remainingToday()).toBe(DAILY_LIMIT - 2)
  })

  it('上限に達すると判定不可・残り0', () => {
    for (let i = 0; i < DAILY_LIMIT; i++) consumeAnalysis()
    expect(usedToday()).toBe(DAILY_LIMIT)
    expect(remainingToday()).toBe(0)
    expect(canAnalyze()).toBe(false)
  })
})

describe('日付またぎでリセット', () => {
  it('翌日になるとカウントが0に戻る', () => {
    for (let i = 0; i < 5; i++) consumeAnalysis()
    expect(usedToday()).toBe(5)

    vi.setSystemTime(new Date(2026, 6, 11, 9, 0, 0)) // 翌日
    expect(usedToday()).toBe(0)
    expect(remainingToday()).toBe(DAILY_LIMIT)
    expect(canAnalyze()).toBe(true)
  })
})

describe('オーナーは使い放題', () => {
  beforeEach(() => localStorage.setItem('nogi_owner', '1'))

  it('オーナーなら残りInfinity・消費してもカウントされない', () => {
    expect(isOwner()).toBe(true)
    expect(remainingToday()).toBe(Infinity)
    for (let i = 0; i < DAILY_LIMIT + 5; i++) consumeAnalysis()
    expect(usedToday()).toBe(0)
    expect(canAnalyze()).toBe(true)
  })
})

describe('オーナー解除（サーバ照合）', () => {
  it('ok:true でオーナーになる', async () => {
    vi.stubGlobal('localStorage', makeStorage())
    vi.stubGlobal('fetch', vi.fn(async () => ({ json: async () => ({ ok: true }) })))
    expect(await unlockOwner('right')).toBe(true)
    expect(isOwner()).toBe(true)
  })

  it('ok:false ではオーナーにならない', async () => {
    vi.stubGlobal('localStorage', makeStorage())
    vi.stubGlobal('fetch', vi.fn(async () => ({ json: async () => ({ ok: false }) })))
    expect(await unlockOwner('wrong')).toBe(false)
    expect(isOwner()).toBe(false)
  })

  it('通信エラーでも例外を投げず false', async () => {
    vi.stubGlobal('localStorage', makeStorage())
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new Error('offline')
      }),
    )
    expect(await unlockOwner('x')).toBe(false)
    expect(isOwner()).toBe(false)
  })

  it('lockOwner で解除できる', () => {
    localStorage.setItem('nogi_owner', '1')
    expect(isOwner()).toBe(true)
    lockOwner()
    expect(isOwner()).toBe(false)
  })
})
