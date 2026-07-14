import { useEffect, useState } from 'react'
import { AppDataProvider } from './lib/appData'
import { useHashRoute } from './lib/router'
import { Tour, type TourStep } from './components/Tour'
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

const TOUR_KEY = 'nogi_tour_v1'

// スポットライト式の使い方ツアーの案内順。実際のボタンを1つずつ光らせて画面を回る。
// nav ステップ = 光ったボタンを押すと次の画面へ進む（ヘッダー📷🔁とフッターのタブで巡る）。
const TOUR_STEPS: TourStep[] = [
  { route: '#/', target: 'home-gauge', title: 'いまの集め具合', body: '全体の集め具合。円が総コンプ率です。' },
  { route: '#/', target: 'home-import', title: 'まとめて登録', body: '写真からまとめて登録。ここが主役です。', nav: true },
  { route: '#/import', target: 'import-camera', title: 'カメラで撮る', body: 'カメラで連続撮影→撮った端から自動で判定します。' },
  { route: '#/import', target: 'import-select', title: '写真から選ぶ', body: '保存済みの写真もまとめて取り込めます。' },
  { route: '#/import', target: 'nav-home', title: 'ホームへ戻る', body: '下の「コレクション」でいつでもホームに戻れます。', nav: true },
  { route: '#/', target: 'home-trade', title: 'トレード', body: 'ダブりと欲しいの交換に使います。', nav: true },
  { route: '#/trade', target: 'trade-list', title: 'トレードの準備', body: '求/譲リストや、相手との突き合わせができます。' },
  { route: '#/trade', target: 'nav-stats', title: '統計へ', body: '下の「統計」を押してみましょう。', nav: true },
  { route: '#/stats', target: 'stats-main', title: '統計', body: 'コンプ率やレア別の集め具合が見られます。' },
  { route: '#/stats', target: 'nav-settings', title: '設定へ', body: '下の「設定」を押してみましょう。', nav: true },
  { route: '#/settings', target: 'settings-backup', title: 'バックアップ', body: 'データは端末内だけ。ときどき書き出しを。' },
  { route: '#/settings', target: 'nav-home', title: 'ホームへ', body: '「コレクション」でホームに戻ります。', nav: true },
  { route: '#/', target: '', title: '準備OK', body: '以上です。設定からいつでも見返せます。' },
]

function Shell() {
  const route = useHashRoute()
  const seg = route.split('/').filter(Boolean)

  // 初回起動はこのツアーだけ。設定の「使い方ツアーをもう一度見る」からも再生できる。
  const [tourOn, setTourOn] = useState(() => {
    try {
      return !localStorage.getItem(TOUR_KEY)
    } catch {
      return false
    }
  })
  useEffect(() => {
    const replay = () => {
      try {
        localStorage.removeItem(TOUR_KEY)
      } catch {
        /* localStorage不可でも続行 */
      }
      window.location.hash = '#/' // ホームから始める
      setTourOn(true)
    }
    window.addEventListener('open-tour', replay)
    return () => window.removeEventListener('open-tour', replay)
  }, [])
  const finishTour = () => {
    try {
      localStorage.setItem(TOUR_KEY, '1')
    } catch {
      /* localStorage不可でも続行 */
    }
    setTourOn(false)
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
      {tourOn && <Tour steps={TOUR_STEPS} onDone={finishTour} />}
    </div>
  )
}

function TabBar({ active }: { active: 'collection' | 'stats' | 'settings' }) {
  const tabs = [
    { key: 'collection', href: '#/', label: 'コレクション', icon: BooksIcon, tour: 'nav-home' },
    { key: 'stats', href: '#/stats', label: '統計', icon: ChartIcon, tour: 'nav-stats' },
    { key: 'settings', href: '#/settings', label: '設定', icon: GearIcon, tour: 'nav-settings' },
  ] as const

  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 bg-white/92 backdrop-blur border-t border-slate-200">
      <div className="mx-auto max-w-lg grid grid-cols-3">
        {tabs.map(({ key, href, label, icon: Icon, tour }) => {
          const isActive = active === key
          return (
            <a
              key={key}
              href={href}
              data-tour={tour}
              className="flex flex-col items-center gap-0.5 pt-2 pb-1.5"
              aria-current={isActive ? 'page' : undefined}
            >
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
