import { useEffect, useState } from 'react'
import { AppDataProvider } from './lib/appData'
import { useHashRoute } from './lib/router'
import { Tutorial } from './components/Tutorial'
import { BooksIcon, ChartIcon, GearIcon } from './components/icons'
import Home from './pages/Home'
import BinderPage from './pages/Binder'
import SetDetailPage from './pages/SetDetail'
import StatsPage from './pages/Stats'
import SettingsPage from './pages/Settings'
import SearchPage from './pages/Search'
import ImportPage from './pages/Import'
import TradePage from './pages/Trade'

export default function App() {
  return (
    <AppDataProvider>
      <Shell />
    </AppDataProvider>
  )
}

const TUTORIAL_KEY = 'nogi_tutorial_v1'

function Shell() {
  const route = useHashRoute()
  const seg = route.split('/').filter(Boolean)

  // 初回起動で1回だけ使い方を出す。設定の「使い方を見る」からも open-tutorial で再表示
  const [showTutorial, setShowTutorial] = useState(() => {
    try {
      return !localStorage.getItem(TUTORIAL_KEY)
    } catch {
      return false
    }
  })
  useEffect(() => {
    const open = () => setShowTutorial(true)
    window.addEventListener('open-tutorial', open)
    return () => window.removeEventListener('open-tutorial', open)
  }, [])
  const closeTutorial = () => {
    try {
      localStorage.setItem(TUTORIAL_KEY, '1')
    } catch {
      /* localStorage不可でも続行 */
    }
    setShowTutorial(false)
  }

  let page: React.ReactNode
  let tab: 'collection' | 'stats' | 'settings' = 'collection'
  if (seg[0] === 'b') page = <BinderPage binderId={seg[1] ?? ''} />
  else if (seg[0] === 's') page = <SetDetailPage setId={seg[1] ?? ''} />
  else if (seg[0] === 'search') page = <SearchPage />
  else if (seg[0] === 'import') page = <ImportPage />
  else if (seg[0] === 'trade') page = <TradePage />
  else if (seg[0] === 'stats') {
    page = <StatsPage />
    tab = 'stats'
  } else if (seg[0] === 'settings') {
    page = <SettingsPage />
    tab = 'settings'
  } else page = <Home />

  return (
    <div className="min-h-dvh bg-slate-50 text-slate-900 pb-[calc(4.5rem+env(safe-area-inset-bottom))]">
      {page}
      <TabBar active={tab} />
      {showTutorial && <Tutorial onClose={closeTutorial} />}
    </div>
  )
}

function TabBar({ active }: { active: 'collection' | 'stats' | 'settings' }) {
  const tabs = [
    { key: 'collection', href: '#/', label: 'コレクション', icon: BooksIcon },
    { key: 'stats', href: '#/stats', label: '統計', icon: ChartIcon },
    { key: 'settings', href: '#/settings', label: '設定', icon: GearIcon },
  ] as const

  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 bg-white/92 backdrop-blur border-t border-slate-200">
      <div className="mx-auto max-w-lg grid grid-cols-3">
        {tabs.map(({ key, href, label, icon: Icon }) => {
          const isActive = active === key
          return (
            <a key={key} href={href} className="flex flex-col items-center gap-0.5 pt-2 pb-1.5" aria-current={isActive ? 'page' : undefined}>
              <Icon className={`w-6 h-6 ${isActive ? 'text-violet-600' : 'text-slate-400'}`} />
              <span className={`text-[10px] font-medium ${isActive ? 'text-violet-600' : 'text-slate-400'}`}>{label}</span>
            </a>
          )
        })}
      </div>
      <div className="h-[env(safe-area-inset-bottom)]" />
    </nav>
  )
}
