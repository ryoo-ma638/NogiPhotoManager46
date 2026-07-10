// 1日あたりのAI自動判定の回数制限（他の人にも体験してもらう用の軽い制限）。
// オーナーはパスワードで解除すると使い放題。※端末ローカルの緩い制限で、厳密な防御ではない。
export const DAILY_LIMIT = 30
export const RECOMMENDED_PER_IMAGE = 6 // 1枚の画像に並べる推奨枚数

const OWNER_KEY = 'nogi_owner'
const USAGE_KEY = 'nogi_ai_usage'

function today(): string {
  const d = new Date()
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`
}

export function isOwner(): boolean {
  try {
    return localStorage.getItem(OWNER_KEY) === '1'
  } catch {
    return false
  }
}

function readUsage(): { date: string; count: number } {
  try {
    const raw = localStorage.getItem(USAGE_KEY)
    if (raw) {
      const u = JSON.parse(raw) as { date?: unknown; count?: unknown }
      if (u && u.date === today() && typeof u.count === 'number') return { date: today(), count: u.count }
    }
  } catch {
    /* ignore */
  }
  return { date: today(), count: 0 }
}

export function usedToday(): number {
  return readUsage().count
}

export function remainingToday(): number {
  return isOwner() ? Infinity : Math.max(0, DAILY_LIMIT - usedToday())
}

export function canAnalyze(): boolean {
  return isOwner() || usedToday() < DAILY_LIMIT
}

/** AI判定を1回消費（オーナーはカウントしない） */
export function consumeAnalysis(): void {
  if (isOwner()) return
  const u = readUsage()
  try {
    localStorage.setItem(USAGE_KEY, JSON.stringify({ date: u.date, count: u.count + 1 }))
  } catch {
    /* ignore */
  }
}

/** パスワードをサーバで照合し、合っていればオーナー解除（端末に記憶） */
export async function unlockOwner(password: string): Promise<boolean> {
  try {
    const res = await fetch('/api/unlock', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ password }),
    })
    const data = (await res.json().catch(() => null)) as { ok?: boolean } | null
    if (data?.ok) {
      try {
        localStorage.setItem(OWNER_KEY, '1')
      } catch {
        /* ignore */
      }
      return true
    }
  } catch {
    /* ネットワーク不通など */
  }
  return false
}

export function lockOwner(): void {
  try {
    localStorage.removeItem(OWNER_KEY)
  } catch {
    /* ignore */
  }
}
