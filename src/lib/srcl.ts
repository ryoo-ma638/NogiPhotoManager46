// 封入生写真の印字「NOT FOR SALE SRCL-xxxxx」から、どのCD（＝封入セット）の
// どの盤（A/B/C/D）かを特定する品番テーブル。
// 出典: 各シングルのWikipedia・ソニーミュージック公式の規格品番（2026-07調査）
// シングルの規則: Type-A=base/base+1, B=+2/+3, C=+4/+5, D=+6/+7, 通常盤=+8

interface SingleEntry {
  base: number
  setName: string // カタログの封入セット名と一致させること
}

const SINGLES: SingleEntry[] = [
  { base: 11680, setName: '僕は僕を好きになる' },
  { base: 11836, setName: 'ごめんねfingers crossed' },
  { base: 11880, setName: '君に叱られた' },
  { base: 12100, setName: 'Actually…' },
  { base: 12210, setName: '好きというのはロックだぜ！' },
  { base: 12330, setName: 'ここにはないもの' },
  { base: 12480, setName: '人は夢を二度見る' },
  { base: 12620, setName: 'おひとりさま天国' },
  { base: 12730, setName: 'Monopoly' },
  { base: 12850, setName: 'チャンスは平等' },
  { base: 12950, setName: 'チートデイ' },
  { base: 13070, setName: '歩道橋' },
  { base: 13220, setName: 'ネーブルオレンジ' },
  { base: 13370, setName: 'セームナンバーズ' }, // Same numbers
  { base: 13460, setName: 'ビリヤニ' },
]

// 変則的な品番（アルバム等）
const SPECIALS: { min: number; max: number; setName: string; slot: string | null }[] = [
  // Time flies: 完全生産限定 12020-4 / 初回仕様 12025-8（3種の対応が品番から確定できないため枠は手動）
  { min: 12020, max: 12028, setName: 'Time flies', slot: null },
  // My respect: TYPE-A/B/C(各2CD+BD=3番) + 通常盤初回仕様
  { min: 13506, max: 13508, setName: 'マイリスペクトアルバム特別版', slot: 'A' },
  { min: 13509, max: 13511, setName: 'マイリスペクトアルバム特別版', slot: 'B' },
  { min: 13512, max: 13514, setName: 'マイリスペクトアルバム特別版', slot: 'C' },
  { min: 13515, max: 13516, setName: 'マイリスペクトアルバム特別版', slot: 'D' },
]

const OFFSET_TO_SLOT: (string | null)[] = ['A', 'A', 'B', 'B', 'C', 'C', 'D', 'D', null] // +8=通常盤→手動

/** テキストからSRCL品番（5桁）を取り出す。例 "NOT FOR SALE SRCL 12620-1" → 12620 */
export function parseSRCL(text: string): number | null {
  const m = /srcl[\s\-:：]*0*(\d{5})/i.exec(text.normalize('NFKC'))
  return m ? Number(m[1]) : null
}

/** 品番 → 封入セット名と盤（slot）。不明ならnull */
export function lookupSRCL(n: number): { setName: string; slot: string | null } | null {
  for (const sp of SPECIALS) {
    if (n >= sp.min && n <= sp.max) return { setName: sp.setName, slot: sp.slot }
  }
  for (const s of SINGLES) {
    const offset = n - s.base
    if (offset >= 0 && offset <= 8) return { setName: s.setName, slot: OFFSET_TO_SLOT[offset] ?? null }
  }
  return null
}
