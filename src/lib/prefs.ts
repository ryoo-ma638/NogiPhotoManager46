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

// バックアップ催促: データは端末内だけなので、しばらく書き出していなければホームで促す。
const BACKUP_KEY = 'nogi_last_backup' // 最終書き出しの時刻(ms)
const BACKUP_SNOOZE_KEY = 'nogi_backup_snooze' // 催促を後回しにした時刻(ms)
const REMIND_AFTER_DAYS = 14
const SNOOZE_DAYS = 7
const DAY_MS = 86400000

function readMs(key: string): number | null {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return null
    const t = Number(raw)
    return Number.isFinite(t) ? t : null
  } catch {
    return null
  }
}

/** 書き出しが済んだ時刻を記録（催促のリセット） */
export function markBackupDone(): void {
  try {
    localStorage.setItem(BACKUP_KEY, String(Date.now()))
    localStorage.removeItem(BACKUP_SNOOZE_KEY)
  } catch {
    /* ignore */
  }
}

/** 最終書き出しからの経過日数。一度も書き出していなければ null。 */
export function daysSinceBackup(): number | null {
  const t = readMs(BACKUP_KEY)
  return t === null ? null : Math.floor((Date.now() - t) / DAY_MS)
}

/** 催促を後回し（数日は出さない） */
export function snoozeBackupReminder(): void {
  try {
    localStorage.setItem(BACKUP_SNOOZE_KEY, String(Date.now()))
  } catch {
    /* ignore */
  }
}

/** 今バックアップを促すべきか。守るデータが無い・最近後回しにした場合は促さない。 */
export function shouldRemindBackup(ownedCount: number): boolean {
  if (ownedCount <= 0) return false
  const snooze = readMs(BACKUP_SNOOZE_KEY)
  if (snooze !== null && Date.now() - snooze < SNOOZE_DAYS * DAY_MS) return false
  const d = daysSinceBackup()
  if (d === null) return true // 一度も書き出していない
  return d >= REMIND_AFTER_DAYS
}
