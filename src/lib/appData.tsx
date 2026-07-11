import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { CatalogFile, CatalogSet, Photo, UserSet } from '../types'
import { loadCatalog, photosForSet } from './catalog'
import { allOwnedRows, allUserSets, deletePhotosData, deleteUserSetRow, imageIdSet, putUserSet, replaceAllUserSets, setCount as dbSetCount, setManyOwned, setOwned } from './db'
import { replaceAllWanted, setWanted as dbSetWanted, wantedIdSet } from './db'
import type { OwnedRow, WantedRow } from './db'
import { replaceAllOwned } from './db'
import { attachImageFile, invalidateImageURLs, removeImageFile } from './images'

export interface SetStat {
  owned: number
  total: number
}

interface AppData {
  catalog: CatalogFile
  /** カタログ＋手動追加を合わせた全セット */
  allSets: CatalogSet[]
  userSets: UserSet[]
  owned: Set<string>
  /** 所持枚数（トレードのダブり用）。owned=count≥1 */
  countOf: (photoId: string) => number
  setCount: (photoId: string, count: number) => void
  /** 「特に欲しい」（求）にマークした写真 */
  wanted: Set<string>
  toggleWanted: (photoId: string) => void
  toggle: (photoId: string) => void
  setMany: (photoIds: string[], value: boolean) => void
  photosOf: (set: CatalogSet) => Photo[]
  statOf: (setId: string) => SetStat
  setById: Map<string, CatalogSet>
  userSetById: Map<string, UserSet>
  addUserSet: (row: UserSet) => Promise<void>
  updateUserSet: (row: UserSet, removedPhotoIds: string[]) => Promise<void>
  deleteUserSet: (id: string) => Promise<void>
  restoreAll: (owned: OwnedRow[], userSets: UserSet[], wanted: WantedRow[]) => Promise<void>
  /** 画像が付いている写真ID */
  imageIds: Set<string>
  attachImage: (photoId: string, file: Blob) => Promise<void>
  removeImage: (photoId: string) => Promise<void>
}

const Ctx = createContext<AppData | null>(null)

export function useAppData(): AppData {
  const v = useContext(Ctx)
  if (!v) throw new Error('AppDataProvider の外で useAppData が呼ばれました')
  return v
}

export function AppDataProvider({ children }: { children: ReactNode }) {
  const [catalog, setCatalog] = useState<CatalogFile | null>(null)
  const [userSets, setUserSets] = useState<UserSet[]>([])
  const [owned, setOwnedState] = useState<Set<string>>(new Set())
  const [counts, setCountsState] = useState<Map<string, number>>(new Map())
  const [wanted, setWantedState] = useState<Set<string>>(new Set())
  const [imageIds, setImageIds] = useState<Set<string>>(new Set())
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    void (async () => {
      try {
        const [cat, rows, users, imgs, wants] = await Promise.all([
          loadCatalog(),
          allOwnedRows(),
          allUserSets(),
          imageIdSet(),
          wantedIdSet(),
        ])
        setCatalog(cat)
        setOwnedState(new Set(rows.map((r) => r.photoId)))
        setCountsState(new Map(rows.map((r) => [r.photoId, r.count ?? 1])))
        setWantedState(wants)
        setUserSets(users)
        setImageIds(imgs)
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e))
      }
    })()
  }, [])

  // カタログ＋手動追加の統合ビュー
  const allSets = useMemo<CatalogSet[]>(() => {
    if (!catalog) return []
    const users: CatalogSet[] = userSets.map((u) => ({
      id: u.id,
      binderId: u.binderId,
      year: u.year,
      name: u.name,
      template: u.template,
      sortIndex: u.sortIndex,
      note: u.note,
      user: true,
    }))
    return [...catalog.sets, ...users]
  }, [catalog, userSets])

  // セットごとの写真枠（手動セットは保存済みphotosが正）
  const photosMap = useMemo(() => {
    const m = new Map<string, Photo[]>()
    if (!catalog) return m
    const memberId = catalog.member.id
    for (const s of catalog.sets) m.set(s.id, photosForSet(memberId, s))
    for (const u of userSets) {
      m.set(
        u.id,
        u.photos.map((p) => ({ id: `${memberId}:${u.id}:${p.slot}`, slot: p.slot, label: p.label, rarity: p.rarity })),
      )
    }
    return m
  }, [catalog, userSets])

  const statMap = useMemo(() => {
    const m = new Map<string, SetStat>()
    for (const [id, photos] of photosMap) {
      m.set(id, { owned: photos.filter((p) => owned.has(p.id)).length, total: photos.length })
    }
    return m
  }, [photosMap, owned])

  const setById = useMemo(() => {
    const m = new Map<string, CatalogSet>()
    for (const s of allSets) m.set(s.id, s)
    return m
  }, [allSets])

  const userSetById = useMemo(() => {
    const m = new Map<string, UserSet>()
    for (const u of userSets) m.set(u.id, u)
    return m
  }, [userSets])

  if (error) {
    return (
      <main className="min-h-dvh flex flex-col items-center justify-center gap-2 p-6 text-center">
        <p className="text-red-600 font-medium">読み込みエラー</p>
        <p className="text-sm text-slate-500">{error}</p>
      </main>
    )
  }
  if (!catalog) {
    return (
      <main className="min-h-dvh flex items-center justify-center">
        <p className="text-slate-400 animate-pulse">読み込み中…</p>
      </main>
    )
  }

  const countOf = (photoId: string) => counts.get(photoId) ?? (owned.has(photoId) ? 1 : 0)

  const setCount = (photoId: string, n: number) => {
    const c = Math.max(0, Math.floor(n))
    void dbSetCount(photoId, c)
    setOwnedState((prev) => {
      const s = new Set(prev)
      if (c > 0) s.add(photoId)
      else s.delete(photoId)
      return s
    })
    setCountsState((prev) => {
      const m = new Map(prev)
      if (c > 0) m.set(photoId, c)
      else m.delete(photoId)
      return m
    })
  }

  const toggleWanted = (photoId: string) => {
    const next = !wanted.has(photoId)
    void dbSetWanted(photoId, next)
    setWantedState((prev) => {
      const s = new Set(prev)
      if (next) s.add(photoId)
      else s.delete(photoId)
      return s
    })
  }

  const toggle = (photoId: string) => {
    const next = !owned.has(photoId)
    void setOwned(photoId, next)
    setOwnedState((prev) => {
      const s = new Set(prev)
      if (next) s.add(photoId)
      else s.delete(photoId)
      return s
    })
    setCountsState((prev) => {
      const m = new Map(prev)
      if (next) m.set(photoId, 1)
      else m.delete(photoId)
      return m
    })
  }

  const setMany = (photoIds: string[], value: boolean) => {
    void setManyOwned(photoIds, value)
    setOwnedState((prev) => {
      const s = new Set(prev)
      for (const id of photoIds) {
        if (value) s.add(id)
        else s.delete(id)
      }
      return s
    })
    setCountsState((prev) => {
      const m = new Map(prev)
      for (const id of photoIds) {
        if (value) m.set(id, 1)
        else m.delete(id)
      }
      return m
    })
  }

  // 枠が消えるときの後始末（所有・枚数・画像・♡の記録とURLキャッシュをまとめて掃除）。
  // 枠削除（updateUserSet）とセット削除（deleteUserSet）で共通に使う。
  const purgePhotoState = (photoIds: string[]) => {
    if (photoIds.length === 0) return
    const ids = new Set(photoIds)
    setOwnedState((prev) => {
      const s = new Set(prev)
      for (const id of ids) s.delete(id)
      return s
    })
    setCountsState((prev) => {
      const m = new Map(prev)
      for (const id of ids) m.delete(id)
      return m
    })
    setWantedState((prev) => {
      const s = new Set(prev)
      for (const id of ids) s.delete(id)
      return s
    })
    setImageIds((prev) => {
      const s = new Set(prev)
      for (const id of ids) {
        s.delete(id)
        invalidateImageURLs(id)
      }
      return s
    })
  }

  const data: AppData = {
    catalog,
    allSets,
    userSets,
    owned,
    countOf,
    setCount,
    wanted,
    toggleWanted,
    toggle,
    setMany,
    photosOf: (set) => photosMap.get(set.id) ?? [],
    statOf: (id) => statMap.get(id) ?? { owned: 0, total: 0 },
    setById,
    userSetById,
    addUserSet: async (row) => {
      await putUserSet(row)
      setUserSets((prev) => [...prev, row])
    },
    updateUserSet: async (row, removedPhotoIds) => {
      await putUserSet(row)
      // 消えた枠は所有だけでなく画像・♡も残さず掃除する（セット削除と同じ後始末）
      if (removedPhotoIds.length > 0) {
        await deletePhotosData(removedPhotoIds)
        purgePhotoState(removedPhotoIds)
      }
      setUserSets((prev) => prev.map((u) => (u.id === row.id ? row : u)))
    },
    deleteUserSet: async (id) => {
      const photoIds = (photosMap.get(id) ?? []).map((p) => p.id)
      await deleteUserSetRow(id, photoIds)
      setUserSets((prev) => prev.filter((u) => u.id !== id))
      purgePhotoState(photoIds)
    },
    restoreAll: async (ownedRows, users, wantedRows) => {
      await replaceAllOwned(ownedRows)
      await replaceAllUserSets(users)
      await replaceAllWanted(wantedRows)
      const rows = await allOwnedRows()
      setOwnedState(new Set(rows.map((r) => r.photoId)))
      setCountsState(new Map(rows.map((r) => [r.photoId, r.count ?? 1])))
      setWantedState(await wantedIdSet())
      setUserSets(await allUserSets())
      // 復元でセット構成が変わると画像の対応も変わりうるので、実DBから取り直して合わせる
      setImageIds(await imageIdSet())
    },
    imageIds,
    attachImage: async (photoId, file) => {
      await attachImageFile(photoId, file)
      setImageIds((prev) => new Set(prev).add(photoId))
    },
    removeImage: async (photoId) => {
      await removeImageFile(photoId)
      setImageIds((prev) => {
        const s = new Set(prev)
        s.delete(photoId)
        return s
      })
    },
  }

  return <Ctx.Provider value={data}>{children}</Ctx.Provider>
}
