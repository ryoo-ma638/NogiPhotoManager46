import type { OwnedRow } from './db'
import type { Rarity, UserSet } from '../types'

export interface BackupFile {
  app: string
  version: number
  member: string
  exportedAt: string
  owned: OwnedRow[]
  userSets?: UserSet[]
}

export interface ParsedBackup {
  owned: OwnedRow[]
  userSets: UserSet[]
}

export function buildBackup(member: string, owned: OwnedRow[], userSets: UserSet[]): BackupFile {
  return {
    app: 'NogiPhotoManager46',
    version: 3,
    member,
    exportedAt: new Date().toISOString(),
    owned,
    userSets,
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

const RARITIES: Rarity[] = ['normal', 'R', 'SR', 'other']

/**
 * 次の3形式をすべて受け付けて正規化する:
 * - バックアップv2（owned行 + userSets）
 * - バックアップv1（owned行のみ）
 * - 変換スクリプトの所有ファイル（owned: [photoId, ...]）
 */
export function parseBackup(text: string): ParsedBackup {
  const data: unknown = JSON.parse(text)
  const obj = data as { owned?: unknown; userSets?: unknown }
  if (!Array.isArray(obj?.owned)) throw new Error('所有データ（owned 配列）が見つかりません')

  const owned = obj.owned.map((item: unknown): OwnedRow => {
    if (typeof item === 'string') return { photoId: item, ownedDate: null }
    if (item && typeof item === 'object' && 'photoId' in item) {
      const o = item as { photoId: unknown; ownedDate?: unknown; count?: unknown }
      if (typeof o.photoId !== 'string') throw new Error('photoId が不正です')
      const count = typeof o.count === 'number' && o.count > 0 ? Math.floor(o.count) : undefined
      return { photoId: o.photoId, ownedDate: typeof o.ownedDate === 'string' ? o.ownedDate : null, ...(count ? { count } : {}) }
    }
    throw new Error('所有データの形式が不正です')
  })

  const userSets: UserSet[] = []
  if (Array.isArray(obj.userSets)) {
    for (const raw of obj.userSets) {
      const u = raw as Partial<UserSet>
      if (
        typeof u?.id !== 'string' ||
        !u.id.startsWith('user-') ||
        typeof u.binderId !== 'string' ||
        typeof u.name !== 'string' ||
        !Array.isArray(u.photos)
      ) {
        throw new Error('手動セットの形式が不正です')
      }
      userSets.push({
        id: u.id,
        binderId: u.binderId,
        year: typeof u.year === 'number' ? u.year : null,
        name: u.name,
        template: (u.template as UserSet['template']) ?? 'standard3',
        note: typeof u.note === 'string' ? u.note : null,
        sortIndex: typeof u.sortIndex === 'number' ? u.sortIndex : 999999,
        photos: u.photos.map((p) => {
          const q = p as { slot?: unknown; label?: unknown; rarity?: unknown }
          if (typeof q?.slot !== 'string' || typeof q?.label !== 'string') throw new Error('ポーズ枠の形式が不正です')
          const rarity = RARITIES.includes(q.rarity as Rarity) ? (q.rarity as Rarity) : 'normal'
          return { slot: q.slot, label: q.label, rarity }
        }),
        createdAt: typeof u.createdAt === 'string' ? u.createdAt : new Date().toISOString(),
      })
    }
  }

  return { owned, userSets }
}

export function backupFilename(member: string): string {
  const d = new Date()
  const p = (n: number) => String(n).padStart(2, '0')
  return `nogi-backup-${member}-${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}.json`
}
