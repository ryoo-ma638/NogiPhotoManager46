// 連番オートフィル（先頭セットを確定→続く写真へA/B/C/Dやヨリ/チュウ/ヒキを割当）の1項目ごとの判定。
// 4枚コンプ等を上から順に送る前提。巻き込んでよいのは「完全に空欄（未確定で候補もない）」と
// 「同一セット」だけ。候補を持つ未確定・別セット割当済みは上書きせず、そこで連番を止める。

/** 連番割当の対象になりうる項目の最小形（取込画面 ImportItem の一部）。 */
export interface CascadeItem {
  status: string // 'saved' は保存済み＝割当対象外
  setId: string | null
  candidates?: string[] | null
}

export type CascadeDecision = 'fill' | 'skip' | 'stop'

/**
 * 連番で後続の1項目をどう扱うか。
 * - skip: 飛ばして次へ（保存済み。枠は消費しない）
 * - fill: 連番を割当（同一セット、または完全に空欄）
 * - stop: 巻き込まず止める（別セット割当済み、または候補ありの未確定）
 */
export function cascadeDecision(item: CascadeItem, targetSetId: string): CascadeDecision {
  if (item.status === 'saved') return 'skip'
  if (item.setId === targetSetId) return 'fill' // 同一セット（枠を連番で埋める）
  if (item.setId === null && (item.candidates == null || item.candidates.length === 0)) return 'fill' // 完全に空欄
  return 'stop' // 別セット割当済み or 候補ありの未確定＝連番を止める
}
