import type { CatalogSet } from '../types'
import type { RecognizedPhoto } from './recognize'
import { matchCaption, slotForPose } from './match'
import { kindOf } from './kinds'

// 自動確定に必要な最低確信度
export const MIN_CONFIDENCE = 0.6

/** classifyPhoto の戻り値（ImportItem のうち判定で決まるフィールド）。 */
export type Classification = {
  caption: string | null
  pose: string
  setId: string | null
  slot: string | null
  auto: boolean
  candidates: string[] | null
  rarity: 'normal' | 'R' | 'SR'
}

/**
 * 認識結果1枚を取込項目のフィールドへ変換する純関数（副作用なし）。
 * 自動確定は「正確な照合（品番・日付コード・周年）＋高確信度＋1件」に限る。
 * あいまいな名前一致・確信度不足・複数該当は、誤登録を避けて画面に候補として出す。
 */
export function classifyPhoto(
  rec: RecognizedPhoto,
  ctx: {
    allSets: CatalogSet[]
    sealedBinders: Set<string>
    photosOf: (s: CatalogSet) => { slot: string }[]
  },
): Classification {
  const { allSets, sealedBinders, photosOf } = ctx
  let setId: string | null = null
  let slot: string | null = null
  let candidates: string[] | null = null
  let auto = false
  if (rec.caption) {
    const m = matchCaption(rec.caption, allSets, sealedBinders)
    const precise = m.via === 'srcl' || m.via === 'date' || m.via === 'anniversary'
    if (precise && m.sets.length === 1 && rec.captionConfidence >= MIN_CONFIDENCE) {
      const hit = m.sets[0]!
      setId = hit.id
      const photos = photosOf(hit)
      const slots = photos.map((p) => p.slot)
      // レア写真は R/SR 枠を推測（R→r1・SR→sr1）。ただし白/虹色の見分けは曖昧なので自動確定はしない＝要確認。
      const rareSlot = rec.rarity === 'R' ? 'r1' : rec.rarity === 'SR' ? 'sr1' : null
      // ※封入のSRCL品番→盤(A/B/C/D)の自動割当は行わない:
      //   印字の品番が盤共通のシングルがあり誤登録の危険があるため（m.slotは使わない）
      if (photos.length === 1) {
        slot = photos[0]!.slot // 1種セット（配信限定等）は枠も確定
        auto = true
      } else if (rareSlot && slots.includes(rareSlot)) {
        slot = rareSlot // レア枠を先入れ（候補）。auto=false のまま＝ユーザーが R/SR を確認
      } else if (rec.pose !== 'unknown' && rec.poseConfidence >= MIN_CONFIDENCE) {
        slot = slotForPose(rec.pose, kindOf(hit, sealedBinders.has(hit.binderId)), slots)
        auto = !!slot
      }
    } else if (m.sets.length >= 1) {
      candidates = m.sets.slice(0, 20).map((s) => s.id) // 印字から絞った候補を「セットを選ぶ」の初期表示に
    }
  }
  return { caption: rec.caption, pose: rec.pose, setId, slot, auto, candidates, rarity: rec.rarity }
}
