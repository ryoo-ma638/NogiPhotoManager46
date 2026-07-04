import type { CatalogSet } from '../types'
import type { Kind } from './kinds'

// 写真の印字（例: "2022.May-Ⅱ"）とカタログのセット名を照合する

export interface DateCode {
  year: number
  month: string // 'january'〜'december'
  suffix: string // ローマ数字（小文字）。無印は ''
}

const MONTHS = [
  'january', 'february', 'march', 'april', 'may', 'june',
  'july', 'august', 'september', 'october', 'november', 'december',
]
const ROMANS = new Set(['', 'i', 'ii', 'iii', 'iv', 'v', 'vi', 'vii', 'viii', 'ix', 'x'])

function norm(s: string): string {
  // NFKCで全角→半角・ローマ数字Ⅱ→"II"等を吸収
  return s.normalize('NFKC').toLowerCase()
}

/** テキストから日付コード（年.月-ローマ数字）を取り出す。無ければnull */
export function parseDateCode(text: string): DateCode | null {
  const t = norm(text)
  const m = /(\d{4})\s*[.,]?\s*([a-z]{3,12})(?:\s*[-–.\s]\s*([ivx]{1,4}))?/.exec(t)
  if (!m) return null
  const raw = m[2]!
  let month = MONTHS.find((mo) => mo === raw)
  let suffix = m[3] ?? ''
  if (!month) {
    // "mayii" のように月とローマ数字がくっついた場合
    month = MONTHS.find((mo) => raw.startsWith(mo) && ROMANS.has(raw.slice(mo.length)))
    if (month) suffix = raw.slice(month.length) || suffix
  }
  if (!month || !ROMANS.has(suffix)) return null
  return { year: Number(m[1]), month, suffix }
}

/** 印字テキストからセット候補を探す（日付コード完全一致 → 名前の部分一致） */
export function matchByCaption(caption: string, sets: CatalogSet[]): CatalogSet[] {
  const code = parseDateCode(caption)
  if (code) {
    const hits = sets.filter((s) => {
      const c = parseDateCode(s.name)
      return c && c.year === code.year && c.month === code.month && c.suffix === code.suffix
    })
    if (hits.length > 0) return hits
  }
  // フォールバック: 正規化した名前の部分一致
  const t = norm(caption).replace(/[\s._-]+/g, '')
  if (t.length >= 3) {
    return sets.filter((s) => {
      const n = norm(s.name).replace(/[\s._-]+/g, '')
      return n.includes(t) || t.includes(n)
    })
  }
  return []
}

/**
 * ポーズ判定結果を枠(slot)に割り当てる。
 * ①〜⑤系（5種セット/MV/6種/封入）はポーズと枠が対応しないため手動（null）
 */
export function slotForPose(pose: string, kind: Kind, availableSlots: string[]): string | null {
  if (!['normal', 'suwari', 'rare8', 'tshirt', 'mini'].includes(kind)) return null
  return availableSlots.includes(pose) ? pose : null
}
