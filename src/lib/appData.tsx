import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { CatalogFile, CatalogSet, Photo, UserSet } from '../types'
import { loadCatalog, photosForSet } from './catalog'
import { allUserSets, deleteUserSetRow, imageIdSet, ownedIdSet, putUserSet, replaceAllUserSets, setManyOwned, setOwned } from './db'
import type { OwnedRow } from './db'
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
  toggle: (photoId: string) => void
  setMany: (photoIds: string[], value: boolean) => void
  photosOf: (set: CatalogSet) => Photo[]
  statOf: (setId: string) => SetStat
  setById: Map<string, CatalogSet>
  userSetById: Map<string, UserSet>
  addUserSet: (row: UserSet) => Promise<void>
  updateUserSet: (row: UserSet, removedPhotoIds: string[]) => Promise<void>
  deleteUserSet: (id: string) => Promise<void>
  restoreAll: (owned: OwnedRow[], userSets: UserSet[]) => Promise<void>
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
  const [imageIds, setImageIds] = useState<Set<string>>(new Set())
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    void (async () => {
      try {
        const [cat, ids, users, imgs] = await Promise.all([loadCatalog(), ownedIdSet(), allUserSets(), imageIdSet()])
        setCatalog(cat)
        setOwnedState(ids)
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

  const toggle = (photoId: string) => {
    const next = !owned.has(photoId)
    void setOwned(photoId, next)
    setOwnedState((prev) => {
      const s = new Set(prev)
      if (next) s.add(photoId)
      else s.delete(photoId)
      return s
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
  }

  const data: AppData = {
    catalog,
    allSets,
    userSets,
    owned,
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
      if (removedPhotoIds.length > 0) setMany(removedPhotoIds, false)
      setUserSets((prev) => prev.map((u) => (u.id === row.id ? row : u)))
    },
    deleteUserSet: async (id) => {
      const photoIds = (photosMap.get(id) ?? []).map((p) => p.id)
      await deleteUserSetRow(id, photoIds)
      setUserSets((prev) => prev.filter((u) => u.id !== id))
      setOwnedState((prev) => {
        const s = new Set(prev)
        for (const pid of photoIds) s.delete(pid)
        return s
      })
      setImageIds((prev) => {
        const s = new Set(prev)
        for (const pid of photoIds) {
          s.delete(pid)
          invalidateImageURLs(pid)
        }
        return s
      })
    },
    restoreAll: async (ownedRows, users) => {
      await replaceAllOwned(ownedRows)
      await replaceAllUserSets(users)
      setOwnedState(await ownedIdSet())
      setUserSets(await allUserSets())
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
