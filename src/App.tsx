import { useEffect, useState, type ReactNode } from 'react'
import { loadCatalog, photosForSet } from './lib/catalog'
import { ownedCount } from './lib/db'
import type { CatalogFile } from './types'

export default function App() {
  const [catalog, setCatalog] = useState<CatalogFile | null>(null)
  const [owned, setOwned] = useState(0)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    void (async () => {
      try {
        setCatalog(await loadCatalog())
        setOwned(await ownedCount())
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e))
      }
    })()
  }, [])

  if (error) return <Center><p className="text-red-600">読み込みエラー: {error}</p></Center>
  if (!catalog) return <Center><p className="text-slate-500">読み込み中…</p></Center>

  const totalSlots = catalog.sets.reduce((n, s) => n + photosForSet(catalog.member.id, s).length, 0)

  return (
    <Center>
      <h1 className="text-2xl font-bold">{catalog.member.name} 生写真</h1>
      <div className="text-slate-600 text-center leading-relaxed">
        <p>バインダー {catalog.binders.length} ／ セット {catalog.sets.length}</p>
        <p>写真枠 {totalSlots} ／ 所有 {owned} 枚</p>
      </div>
      <p className="text-xs text-slate-400">データ層 稼働中（P1-1）</p>
    </Center>
  )
}

function Center({ children }: { children: ReactNode }) {
  return (
    <main className="min-h-dvh bg-slate-50 text-slate-900 flex flex-col items-center justify-center gap-3 p-6">
      {children}
    </main>
  )
}
