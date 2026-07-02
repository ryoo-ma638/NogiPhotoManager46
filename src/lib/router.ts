import { useEffect, useState } from 'react'

/** ハッシュベースの極小ルータ（#/b/xxx 等）。ブラウザバック対応 */
export function useHashRoute(): string {
  const [hash, setHash] = useState(window.location.hash)
  useEffect(() => {
    const onChange = () => setHash(window.location.hash)
    window.addEventListener('hashchange', onChange)
    return () => window.removeEventListener('hashchange', onChange)
  }, [])
  return hash.replace(/^#/, '') || '/'
}

export function navigate(to: string): void {
  window.location.hash = to
}

export function goBack(): void {
  window.history.back()
}

// 一覧→詳細→戻る、でスクロール位置を保つ
const positions = new Map<string, number>()
export function useScrollRestore(key: string): void {
  useEffect(() => {
    window.scrollTo(0, positions.get(key) ?? 0)
    return () => {
      positions.set(key, window.scrollY)
    }
  }, [key])
}
