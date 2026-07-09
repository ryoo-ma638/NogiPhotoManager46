import Dexie, { type Table } from 'dexie'
import type { UserSet } from '../types'

// 所有データ（この端末にのみ保存。カタログとは完全分離）
// 行の存在＝所有。count=所持枚数（省略時は1枚として扱う＝旧データ互換）。
export interface OwnedRow {
  photoId: string
  ownedDate: string | null
  count?: number
}

// 添付画像（縮小済みJPEG。フル画像とサムネの2サイズ）
export interface ImageRow {
  photoId: string
  full: Blob
  thumb: Blob
  updatedAt: string
}

class NogiDB extends Dexie {
  owned!: Table<OwnedRow, string>
  userSets!: Table<UserSet, string>
  images!: Table<ImageRow, string>
  constructor() {
    super('NogiPhotoManager')
    this.version(1).stores({ owned: 'photoId' })
    this.version(2).stores({ owned: 'photoId', userSets: 'id' })
    this.version(3).stores({ owned: 'photoId', userSets: 'id', images: 'photoId' })
  }
}

export const db = new NogiDB()

export async function setOwned(photoId: string, owned: boolean): Promise<void> {
  if (owned) await db.owned.put({ photoId, ownedDate: new Date().toISOString() })
  else await db.owned.delete(photoId)
}

/** 所持枚数を設定（0以下は未所有＝行削除）。トレードのダブり管理用。ownedDateは既存を保つ */
export async function setCount(photoId: string, count: number): Promise<void> {
  const c = Math.max(0, Math.floor(count))
  if (c <= 0) {
    await db.owned.delete(photoId)
  } else {
    const existing = await db.owned.get(photoId)
    await db.owned.put({ photoId, ownedDate: existing?.ownedDate ?? new Date().toISOString(), count: c })
  }
}

/** 複数枚を一括で所有/未所有にする（「すべて所有」用） */
export async function setManyOwned(photoIds: string[], owned: boolean): Promise<void> {
  if (owned) {
    const now = new Date().toISOString()
    await db.owned.bulkPut(photoIds.map((photoId) => ({ photoId, ownedDate: now })))
  } else {
    await db.owned.bulkDelete(photoIds)
  }
}

/** 所有している写真IDの集合を取得（進捗計算・一覧表示用） */
export async function ownedIdSet(): Promise<Set<string>> {
  const rows = await db.owned.toArray()
  return new Set(rows.map((r) => r.photoId))
}

export async function ownedCount(): Promise<number> {
  return db.owned.count()
}

/** バックアップ用に全所有行を取得 */
export async function allOwnedRows(): Promise<OwnedRow[]> {
  return db.owned.toArray()
}

/** 所有記録を丸ごと置き換える（復元・初回インポート用） */
export async function replaceAllOwned(rows: OwnedRow[]): Promise<void> {
  await db.transaction('rw', db.owned, async () => {
    await db.owned.clear()
    if (rows.length > 0) await db.owned.bulkPut(rows)
  })
}

// ---- 手動追加セット ----

export async function allUserSets(): Promise<UserSet[]> {
  return db.userSets.toArray()
}

export async function putUserSet(row: UserSet): Promise<void> {
  await db.userSets.put(row)
}

/** セット削除（所有記録・画像も一緒に消す） */
export async function deleteUserSetRow(id: string, photoIds: string[]): Promise<void> {
  await db.transaction('rw', db.userSets, db.owned, db.images, async () => {
    await db.userSets.delete(id)
    if (photoIds.length > 0) {
      await db.owned.bulkDelete(photoIds)
      await db.images.bulkDelete(photoIds)
    }
  })
}

// ---- 添付画像 ----

export async function putImage(row: ImageRow): Promise<void> {
  await db.images.put(row)
}

export async function getImageRow(photoId: string): Promise<ImageRow | undefined> {
  return db.images.get(photoId)
}

export async function deleteImageRow(photoId: string): Promise<void> {
  await db.images.delete(photoId)
}

/** 画像が付いている写真IDの集合（一覧でのサムネ有無判定用） */
export async function imageIdSet(): Promise<Set<string>> {
  const keys = await db.images.toCollection().primaryKeys()
  return new Set(keys)
}

/** 手動セットを丸ごと置き換える（復元用） */
export async function replaceAllUserSets(rows: UserSet[]): Promise<void> {
  await db.transaction('rw', db.userSets, async () => {
    await db.userSets.clear()
    if (rows.length > 0) await db.userSets.bulkPut(rows)
  })
}
