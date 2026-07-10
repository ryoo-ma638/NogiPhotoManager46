import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { getNickname, setNickname, safeName, getSearchPrefs, setSearchPrefs } from './prefs'

// node環境なので localStorage を最小の擬似実装で差し込む（jsdomは入れない）
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

beforeEach(() => vi.stubGlobal('localStorage', makeStorage()))
afterEach(() => vi.unstubAllGlobals())

describe('nickname', () => {
  it('未設定なら空文字', () => {
    expect(getNickname()).toBe('')
  })

  it('設定した名前を読み戻せる', () => {
    setNickname('りょうま')
    expect(getNickname()).toBe('りょうま')
  })

  it('前後の空白は落として保存する', () => {
    setNickname('  なお  ')
    expect(getNickname()).toBe('なお')
  })

  it('localStorageが使えなくても例外を投げない', () => {
    vi.stubGlobal('localStorage', {
      getItem: () => {
        throw new Error('blocked')
      },
      setItem: () => {
        throw new Error('blocked')
      },
    })
    expect(() => setNickname('x')).not.toThrow()
    expect(getNickname()).toBe('')
  })
})

describe('safeName', () => {
  it('ファイル名に使えない記号・空白を除去する', () => {
    expect(safeName('a/b:c*d?e"f<g>h|i')).toBe('abcdefghi')
    expect(safeName('な お')).toBe('なお')
  })

  it('空や記号だけなら me にフォールバック', () => {
    expect(safeName('')).toBe('me')
    expect(safeName('   ')).toBe('me')
    expect(safeName('/// ')).toBe('me')
  })

  it('通常の名前はそのまま残す', () => {
    expect(safeName('りょうま')).toBe('りょうま')
  })
})

describe('searchPrefs', () => {
  it('未設定なら既定値', () => {
    expect(getSearchPrefs()).toEqual({ unownedOnly: false, dupOnly: false, wantOnly: false, kindFilter: null, sortBy: 'catalog' })
  })

  it('保存した内容を読み戻せる', () => {
    const p = { unownedOnly: true, dupOnly: false, wantOnly: true, kindFilter: 'yori', sortBy: 'owned' as const }
    setSearchPrefs(p)
    expect(getSearchPrefs()).toEqual(p)
  })

  it('欠けたキーは既定で補う（前方互換）', () => {
    localStorage.setItem('nogi_search_prefs', JSON.stringify({ dupOnly: true }))
    const p = getSearchPrefs()
    expect(p.dupOnly).toBe(true)
    expect(p.unownedOnly).toBe(false)
    expect(p.sortBy).toBe('catalog')
    expect(p.kindFilter).toBeNull()
  })

  it('未知の並び替え値は catalog に丸める', () => {
    localStorage.setItem('nogi_search_prefs', JSON.stringify({ sortBy: 'bogus' }))
    expect(getSearchPrefs().sortBy).toBe('catalog')
  })

  it('壊れたJSONでも既定値を返す', () => {
    localStorage.setItem('nogi_search_prefs', '{ not json')
    expect(getSearchPrefs().sortBy).toBe('catalog')
  })
})
