import type { CatalogSet } from '../types'

// セットの種類タグ（scripts/convert_catalog.py の detect_kind と同じ規則）
export type Kind = 'normal' | 'five' | 'suwari' | 'mv' | 'rare8' | 'event' | 'tshirt' | 'mini' | 'sealed'

export const KIND_LABELS: { id: Kind; label: string }[] = [
  { id: 'normal', label: '通常' },
  { id: 'five', label: '5種セット' },
  { id: 'suwari', label: '座りあり5種' },
  { id: 'mv', label: 'MV・ver.' },
  { id: 'rare8', label: '8種' },
  { id: 'event', label: '6種' },
  { id: 'tshirt', label: 'Tシャツ' },
  { id: 'mini', label: 'ミニ' },
  { id: 'sealed', label: '封入' },
]

/** カタログにkindがあればそれを、無ければ（手動セット等）名前とテンプレから導出 */
export function kindOf(set: CatalogSet, sealed: boolean): Kind {
  if (set.kind) return set.kind as Kind
  if (sealed) return 'sealed'
  if (set.name.includes('ミニ生写真')) return 'mini'
  if (set.name.includes('Tシャツ')) return 'tshirt'
  if (set.name.includes('MV') || set.name.includes('選抜ver') || set.name.includes('アンダーver')) return 'mv'
  if (set.template === 'rareSet8') return 'rare8'
  if (set.template === 'five5') {
    // 座りヨリ/座りヒキがあるのは浴衣とバスラ（周年記念）だけ
    if (set.name.includes('浴衣') || set.name.includes('周年記念')) return 'suwari'
    return 'five'
  }
  if (set.template === 'event6') return 'event'
  return 'normal'
}
