// カタログとアプリ内データの型

export type Rarity = 'normal' | 'R' | 'SR'
export type Template = 'standard3' | 'four4' | 'five5' | 'rareSet8' | 'event6' | 'single1'

export interface Binder {
  id: string
  name: string
  sortIndex: number
  sealed: boolean // 封入バインダー（年層なし）
}

export interface CatalogSet {
  id: string
  binderId: string
  year: number | null // 封入は null
  name: string
  template: Template
  sortIndex: number
  note: string | null
  pageBreakAfter?: boolean
}

export interface CatalogFile {
  schemaVersion: number
  catalogVersion: number
  member: { id: string; name: string }
  binders: Binder[]
  sets: CatalogSet[]
}

// テンプレから展開した1枚の写真枠
export interface Photo {
  id: string // `${memberId}:${setId}:${slot}`
  slot: string
  label: string
  rarity: Rarity
}
