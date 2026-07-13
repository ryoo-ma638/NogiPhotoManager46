// 連番オートフィル（先頭セットを確定→続く写真へA/B/C/Dやヨリ/チュウ/ヒキを割当）の1項目ごとの判定。
// 4枚コンプ・5種を上から順に続けて撮る前提。基本は積極的に巻き込む（候補ありの未確定も埋める）。
// 誤って巻き込んだときは取込画面の「元に戻す」で戻せる。止めるのは別セットが確定済みの所だけ。

/** 連番割当の対象になりうる項目の最小形（取込画面 ImportItem の一部）。 */
export interface CascadeItem {
  status: string // 'saved' は保存済み＝割当対象外
  setId: string | null
}

export type CascadeDecision = 'fill' | 'skip' | 'stop'

/**
 * 連番で後続の1項目をどう扱うか。
 * - skip: 飛ばして次へ（保存済み。枠は消費しない）
 * - fill: 連番を割当（空欄＝候補ありの未確定も含む／同一セットの枠未定）
 * - stop: 別セットが確定済み＝連番が途切れるのでそこで止める
 */
export function cascadeDecision(item: CascadeItem, targetSetId: string): CascadeDecision {
  if (item.status === 'saved') return 'skip'
  if (item.setId != null && item.setId !== targetSetId) return 'stop'
  return 'fill'
}
