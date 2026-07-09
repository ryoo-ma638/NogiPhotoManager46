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
