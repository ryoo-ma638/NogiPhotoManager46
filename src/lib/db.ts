import Dexie, { type Table } from 'dexie'

// 所有データ（この端末にのみ保存。カタログとは完全分離）
export interface OwnedRow {
  photoId: string
  ownedDate: string | null
}

class NogiDB extends Dexie {
  owned!: Table<OwnedRow, string>
  constructor() {
    super('NogiPhotoManager')
    this.version(1).stores({ owned: 'photoId' })
  }
}

export const db = new NogiDB()

export async function setOwned(photoId: string, owned: boolean): Promise<void> {
  if (owned) await db.owned.put({ photoId, ownedDate: new Date().toISOString() })
  else await db.owned.delete(photoId)
}

/** 所有している写真IDの集合を取得（進捗計算・一覧表示用） */
export async function ownedIdSet(): Promise<Set<string>> {
  const rows = await db.owned.toArray()
  return new Set(rows.map((r) => r.photoId))
}

export async function ownedCount(): Promise<number> {
  return db.owned.count()
}
