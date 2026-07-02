import type { OwnedRow } from './db'

export interface BackupFile {
  app: string
  version: number
  member: string
  exportedAt: string
  owned: OwnedRow[]
}

export function buildBackup(member: string, owned: OwnedRow[]): BackupFile {
  return {
    app: 'NogiPhotoManager46',
    version: 1,
    member,
    exportedAt: new Date().toISOString(),
    owned,
  }
}

/** JSONをファイルとしてダウンロードさせる */
export function downloadJSON(filename: string, data: unknown): void {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

/**
 * バックアップファイル or 変換スクリプトの所有ファイル(owned:[id...])の
 * どちらも受け付けて OwnedRow[] に正規化する。
 */
export function parseOwnedFile(text: string): OwnedRow[] {
  const data: unknown = JSON.parse(text)
  const owned = (data as { owned?: unknown })?.owned
  if (!Array.isArray(owned)) throw new Error('所有データ（owned 配列）が見つかりません')
  return owned.map((item: unknown): OwnedRow => {
    if (typeof item === 'string') return { photoId: item, ownedDate: null }
    if (item && typeof item === 'object' && 'photoId' in item) {
      const o = item as { photoId: unknown; ownedDate?: unknown }
      if (typeof o.photoId !== 'string') throw new Error('photoId が不正です')
      return { photoId: o.photoId, ownedDate: typeof o.ownedDate === 'string' ? o.ownedDate : null }
    }
    throw new Error('所有データの形式が不正です')
  })
}

export function backupFilename(member: string): string {
  const d = new Date()
  const p = (n: number) => String(n).padStart(2, '0')
  return `nogi-backup-${member}-${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}.json`
}
