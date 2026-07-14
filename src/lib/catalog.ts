import type { CatalogFile, CatalogSet, Photo } from '../types'
import { TEMPLATES } from './templates'
import { frameSortKey } from './frames'

/** セットの写真枠を展開する（明示photosがあればそれを優先、なければテンプレから） */
export function photosForSet(memberId: string, set: CatalogSet): Photo[] {
  // Partial 経由で引くと、カタログが未知テンプレを使った場合に undefined を拾える
  const slots = set.photos ?? (TEMPLATES as Partial<typeof TEMPLATES>)[set.template]
  if (!slots) {
    // 未知のテンプレ（新テンプレがカタログ先行で入った等）。全画面クラッシュを防ぐため空枠にする
    console.warn(`未知のテンプレート「${set.template}」（セット ${set.id}）`)
    return []
  }
  const photos = slots.map((s) => ({
    id: `${memberId}:${set.id}:${s.slot}`,
    slot: s.slot,
    label: s.label,
    rarity: s.rarity,
  }))
  // 手動セット（その他）は枠を後から自由に足すので、保存順でなく既定の枠順で並べ直す。
  // カタログセットの枠順（物理バインダー順）は変えない。
  return set.user ? [...photos].sort((a, b) => frameSortKey(a.slot) - frameSortKey(b.slot)) : photos
}

/** 公開カタログを取得（アプリと同一オリジンの /catalog/ から） */
export async function loadCatalog(): Promise<CatalogFile> {
  const res = await fetch('/catalog/yumiki_nao.json', { cache: 'no-cache' })
  if (!res.ok) throw new Error(`カタログ取得に失敗しました (${res.status})`)
  return (await res.json()) as CatalogFile
}
