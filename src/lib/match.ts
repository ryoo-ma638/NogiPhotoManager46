import type { CatalogSet } from '../types'
import type { Kind } from './kinds'
import { lookupSRCL, parseSRCL } from './srcl'

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

// 生写真の印字はほぼ英語、カタログ名は英日混在。共通の綴りに寄せて噛み合わせる。
// （順番が大事: 世代→周年 の順。"4th members"は世代、残った"11th"は周年）
const SYNONYMS: Array<[RegExp, string]> = [
  [/ハロウィン|halloween/g, 'halloween'],
  [/クリスマス|christmas|x'?mas/g, 'christmas'],
  [/バレンタイン|valentine'?s?/g, 'valentine'],
  // 誕生日ライブ（BIRTHDAY / BD / バースデー、LIVE / ライブ）
  [/バースデー|birthday|bd/g, 'birthday'],
  [/ライブ/g, 'live'],
  // 期生（世代）: 英単語序数・カタカナ・「N期生」→「N期」。"fourth members"／"4th members"／"フォース"→4期
  [/(?:1st|first|ファースト)\s*(?:members?|メンバーズ?)?/g, '1期'],
  [/(?:2nd|second|セカンド)\s*(?:members?|メンバーズ?)?/g, '2期'],
  [/(?:3rd|third|サード)\s*(?:members?|メンバーズ?)?/g, '3期'],
  [/(?:4th|fourth|フォース)\s*(?:members?|メンバーズ?)?/g, '4期'],
  [/(?:5th|fifth|フィフス)\s*(?:members?|メンバーズ?)?/g, '5期'],
  [/([1-9])期生/g, '$1期'],
  // 周年（アニバーサリー）: 残った数字序数 "11th" → "11周年"（検索でも共通化）
  [/(\d{1,2})(?:st|nd|rd|th)/g, '$1周年'],
]

/** 周年の番号を取り出す。"11周年" / "11th BD" / "11th Anniversary" / "11th Birthday" 等に対応 */
function anniversaryNumber(text: string): number | null {
  const t = text.normalize('NFKC').toLowerCase()
  const m = /(\d{1,2})\s*(?:周年|(?:st|nd|rd|th)\s*(?:b\.?d\.?|birthday|anniversary))/.exec(t)
  return m ? Number(m[1]) : null
}
// 印字にもセット名にも出る一般語（誤一致の元・つなぎ語）は照合から除く
const STOPWORDS = /乃木坂46|乃木坂|year/g

/** 検索・照合の共通正規化: NFKC＋小文字＋日英シノニム統一（記号は残す） */
export function normalizeForSearch(s: string): string {
  let t = norm(s)
  for (const [re, rep] of SYNONYMS) t = t.replace(re, rep)
  return t
}

/** 名前照合用: シノニム統一＋一般語(乃木坂46)除去＋空白/記号除去 */
function canon(s: string): string {
  return normalizeForSearch(s)
    .replace(STOPWORDS, '')
    .replace(/[\s._\-–—・、。,!！?？/｜|©]+/g, '')
}

/** a と b の最長共通部分文字列の長さ（部分一致の強さの指標） */
function commonRunLen(a: string, b: string): number {
  if (!a || !b) return 0
  const n = b.length
  let prev = new Array<number>(n + 1).fill(0)
  let best = 0
  for (let i = 1; i <= a.length; i++) {
    const cur = new Array<number>(n + 1).fill(0)
    for (let j = 1; j <= n; j++) {
      if (a[i - 1] === b[j - 1]) {
        cur[j] = prev[j - 1]! + 1
        if (cur[j]! > best) best = cur[j]!
      }
    }
    prev = cur
  }
  return best
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

export interface CaptionMatch {
  sets: CatalogSet[]
  slot: string | null // SRCL品番から盤が特定できた場合（'A'等）※現在は自動割当に使わない
  via: 'srcl' | 'date' | 'anniversary' | 'other' | 'name' | null
}

/**
 * 印字テキストからセット候補を探す。
 * 優先順: SRCL品番(封入) → 日付コード → 周年記念 → 名前の部分一致
 */
export function matchCaption(caption: string, sets: CatalogSet[], sealedBinderIds: Set<string>): CaptionMatch {
  // 1) SRCL品番 → 封入セット＋盤(A/B/C/D)
  const srcl = parseSRCL(caption)
  if (srcl !== null) {
    const hit = lookupSRCL(srcl)
    if (hit) {
      const found = sets.filter((s) => sealedBinderIds.has(s.binderId) && norm(s.name) === norm(hit.setName))
      if (found.length > 0) return { sets: found, slot: hit.slot, via: 'srcl' }
    }
    // SRCLはあるが表に無い → 封入のどれか（手動選択）
    return { sets: sets.filter((s) => sealedBinderIds.has(s.binderId)), slot: null, via: null }
  }

  // 2) 日付コード（年.月-ローマ数字）
  const code = parseDateCode(caption)
  if (code) {
    const hits = sets.filter((s) => {
      const c = parseDateCode(s.name)
      return c && c.year === code.year && c.month === code.month && c.suffix === code.suffix
    })
    if (hits.length > 0) return { sets: hits, slot: null, via: 'date' }
  }

  // 3) 周年記念（"12th Anniversary" / "11th BD" / "11th Birthday" / "11周年" → N周年記念）
  const anniv = anniversaryNumber(caption)
  if (anniv != null) {
    const exact = sets.filter((s) => s.name === `${anniv}周年記念`)
    if (exact.length > 0) return { sets: exact, slot: null, via: 'anniversary' }
    const partial = sets.filter((s) => s.name.includes(`${anniv}周年記念`))
    if (partial.length > 0) return { sets: partial, slot: null, via: 'anniversary' }
  }

  // 4) 「NOT FOR SALE / Sony Music」系の印字なのにSRCL品番が無い → 配信限定など「その他」の候補
  //    ※実物確認済み: 配信中限定MV衣装生写真の印字は「©Sony Music Labels Inc. / NOT FOR SALE」のみ（SRCLなし）。
  //    　封入は同じ文言＋SRCLあり。品番が読めなかった封入の可能性も残るため、自動確定はせず候補提示に留める
  if (/not\s*for\s*sale|sony\s*music/.test(norm(caption))) {
    const others = sets.filter((s) => s.binderId === 'b-other')
    if (others.length > 0) return { sets: others, slot: null, via: 'other' }
  }

  // 5) フォールバック: 名前の部分一致。印字とセット名の「共通する文字の並び」が長い順に候補化。
  //    タイトルの一部（例:「真夏の全国ツアー」）しか読めなくても、それを含むセットを候補として出せる。
  //    日英シノニム統一済み（Halloween↔ハロウィン等）・「乃木坂46」等の一般語は除外済み。
  const cap = canon(caption)
  if (cap.length >= 3) {
    const scored = sets
      .map((s) => ({ s, score: commonRunLen(cap, canon(s.name)) }))
      .filter((x) => x.score >= 5) // 5文字以上一致（年"2022"だけの偶然一致は拾わない）
      .sort((a, b) => b.score - a.score)
    if (scored.length > 0) return { sets: scored.slice(0, 20).map((x) => x.s), slot: null, via: 'name' }
  }
  return { sets: [], slot: null, via: null }
}

/**
 * ポーズ判定結果を枠(slot)に割り当てる。
 * ①〜⑤系（5種セット/MV/6種/封入）はポーズと枠が対応しないため手動（null）
 */
export function slotForPose(pose: string, kind: Kind, availableSlots: string[]): string | null {
  if (!['normal', 'suwari', 'rare8', 'tshirt', 'mini'].includes(kind)) return null
  return availableSlots.includes(pose) ? pose : null
}
