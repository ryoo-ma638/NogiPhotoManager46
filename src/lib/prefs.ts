// 端末ローカルの小さな設定（localStorage）。ニックネーム＝書き出しファイルの持ち主表示に使う。
const NICK_KEY = 'nogi_nickname'

export function getNickname(): string {
  try {
    return (localStorage.getItem(NICK_KEY) ?? '').trim()
  } catch {
    return ''
  }
}

export function setNickname(name: string): void {
  try {
    localStorage.setItem(NICK_KEY, name.trim())
  } catch {
    /* localStorage不可でも続行 */
  }
}

/** ファイル名に使える形に整える（記号・空白を除去。空なら 'me'） */
export function safeName(name: string): string {
  const s = name.trim().replace(/[\\/:*?"<>|\s]+/g, '')
  return s || 'me'
}

// 検索画面の絞り込み・並び替えを覚えておく（画面を離れても保持）。
const SEARCH_KEY = 'nogi_search_prefs'
export type SortBy = 'catalog' | 'owned' | 'name' | 'year'
const SORT_VALUES: SortBy[] = ['catalog', 'owned', 'name', 'year']
export type SearchPrefs = {
  unownedOnly: boolean
  dupOnly: boolean
  wantOnly: boolean
  kindFilter: string | null // Kindのユニオンだが、prefsは種類定義に依存しないので文字列で持つ
  sortBy: SortBy
}
const DEFAULT_SEARCH: SearchPrefs = { unownedOnly: false, dupOnly: false, wantOnly: false, kindFilter: null, sortBy: 'catalog' }

export function getSearchPrefs(): SearchPrefs {
  try {
    const raw = localStorage.getItem(SEARCH_KEY)
    if (raw) {
      const p = JSON.parse(raw) as Partial<SearchPrefs>
      // 前方互換: 欠けたキーは既定で補い、sortByは既知の値だけ採用
      return {
        unownedOnly: !!p.unownedOnly,
        dupOnly: !!p.dupOnly,
        wantOnly: !!p.wantOnly,
        kindFilter: typeof p.kindFilter === 'string' ? p.kindFilter : null,
        sortBy: SORT_VALUES.includes(p.sortBy as SortBy) ? (p.sortBy as SortBy) : 'catalog',
      }
    }
  } catch {
    /* ignore */
  }
  return { ...DEFAULT_SEARCH }
}

export function setSearchPrefs(p: SearchPrefs): void {
  try {
    localStorage.setItem(SEARCH_KEY, JSON.stringify(p))
  } catch {
    /* ignore */
  }
}
