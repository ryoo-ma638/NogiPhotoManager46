// 端末の共有シート（navigator.share）を使えるときは使い、だめなら呼び出し側が従来手段（コピー/ダウンロード）へ落とす。
// iPhoneでは共有シートから「ファイルに保存」やアプリへの直接共有ができる。
// キャンセル（AbortError）と非対応を呼び出し側で見分けられるよう、can〜 の判定関数も出す。

/** テキスト共有に対応しているか（iPhone等）。 */
export function canShareText(): boolean {
  return typeof navigator !== 'undefined' && typeof navigator.share === 'function'
}

/** テキストを共有シートで送る。送れたら true、非対応・キャンセル・失敗は false。 */
export async function shareText(text: string): Promise<boolean> {
  if (!canShareText()) return false
  try {
    await navigator.share({ text })
    return true
  } catch {
    return false // ユーザーキャンセル（AbortError）を含む。呼び出し側は何もしない
  }
}

/** このBlobをファイルとして共有できるか（環境が files 共有に対応しているか）。 */
export function canShareFile(filename: string, blob: Blob): boolean {
  if (typeof navigator === 'undefined' || typeof navigator.share !== 'function' || typeof navigator.canShare !== 'function') return false
  try {
    return navigator.canShare({ files: [toFile(filename, blob)] })
  } catch {
    return false
  }
}

/** ファイルを共有シートで送る。送れたら true、非対応・キャンセル・失敗は false。 */
export async function shareFile(filename: string, blob: Blob): Promise<boolean> {
  if (!canShareFile(filename, blob)) return false
  try {
    await navigator.share({ files: [toFile(filename, blob)] })
    return true
  } catch {
    return false // ユーザーキャンセル（AbortError）を含む
  }
}

function toFile(filename: string, blob: Blob): File {
  return new File([blob], filename, { type: blob.type || 'application/octet-stream' })
}
