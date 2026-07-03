import type { CatalogFile, CatalogSet, Photo } from '../types'
import { TEMPLATES } from './templates'

/** セットの写真枠を展開する（明示photosがあればそれを優先、なければテンプレから） */
export function photosForSet(memberId: string, set: CatalogSet): Photo[] {
  const slots = set.photos ?? TEMPLATES[set.template]
  return slots.map((s) => ({
    id: `${memberId}:${set.id}:${s.slot}`,
    slot: s.slot,
    label: s.label,
    rarity: s.rarity,
  }))
}

/** 公開カタログを取得（アプリと同一オリジンの /catalog/ から） */
export async function loadCatalog(): Promise<CatalogFile> {
  const res = await fetch('/catalog/yumiki_nao.json', { cache: 'no-cache' })
  if (!res.ok) throw new Error(`カタログ取得に失敗しました (${res.status})`)
  return (await res.json()) as CatalogFile
}
