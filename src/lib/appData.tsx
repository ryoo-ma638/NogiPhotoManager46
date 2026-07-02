import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { CatalogFile, CatalogSet, Photo } from '../types'
import { loadCatalog, photosForSet } from './catalog'
import { ownedIdSet, setManyOwned, setOwned } from './db'

export interface SetStat {
  owned: number
  total: number
}

interface AppData {
  catalog: CatalogFile
  owned: Set<string>
  toggle: (photoId: string) => void
  setMany: (photoIds: string[], value: boolean) => void
  photosOf: (set: CatalogSet) => Photo[]
  statOf: (setId: string) => SetStat
  setById: Map<string, CatalogSet>
}

const Ctx = createContext<AppData | null>(null)

export function useAppData(): AppData {
  const v = useContext(Ctx)
  if (!v) throw new Error('AppDataProvider の外で useAppData が呼ばれました')
  return v
}

export function AppDataProvider({ children }: { children: ReactNode }) {
  const [catalog, setCatalog] = useState<CatalogFile | null>(null)
  const [owned, setOwnedState] = useState<Set<string>>(new Set())
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    void (async () => {
      try {
        const [cat, ids] = await Promise.all([loadCatalog(), ownedIdSet()])
        setCatalog(cat)
        setOwnedState(ids)
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e))
      }
    })()
  }, [])

  // セットごとの写真枠（カタログが変わらない限り固定）
  const photosMap = useMemo(() => {
    const m = new Map<string, Photo[]>()
    if (catalog) for (const s of catalog.sets) m.set(s.id, photosForSet(catalog.member.id, s))
    return m
  }, [catalog])

  // セットごとの所有数（トグルのたびに再計算。1367枚なら一瞬）
  const statMap = useMemo(() => {
    const m = new Map<string, SetStat>()
    for (const [id, photos] of photosMap) {
      m.set(id, { owned: photos.filter((p) => owned.has(p.id)).length, total: photos.length })
    }
    return m
  }, [photosMap, owned])

  const setById = useMemo(() => {
    const m = new Map<string, CatalogSet>()
    if (catalog) for (const s of catalog.sets) m.set(s.id, s)
    return m
  }, [catalog])

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
    owned,
    toggle,
    setMany,
    photosOf: (set) => photosMap.get(set.id) ?? [],
    statOf: (id) => statMap.get(id) ?? { owned: 0, total: 0 },
    setById,
  }

  return <Ctx.Provider value={data}>{children}</Ctx.Provider>
}
