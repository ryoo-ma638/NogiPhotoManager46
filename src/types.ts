// カタログとアプリ内データの型

export type Rarity = 'normal' | 'R' | 'SR' | 'other'
export type Template = 'standard3' | 'four4' | 'five5' | 'rareSet8' | 'event6' | 'single1' | 'pair2'

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
  kind?: string // 種類タグ（normal/five/mv/rare8/event/tshirt/mini/sealed）。絞り込み用
  sortIndex: number
  note: string | null
  pageBreakAfter?: boolean
  photos?: UserSetPhoto[] // 明示的なポーズ枠（テンプレ展開より優先。MV系5種の①〜⑤等）
  user?: boolean // アプリ内で手動追加したセット（カタログJSONには存在しない）
}

// 手動追加セット（IndexedDBに保存。ポーズ枠は自由に増減・改名可）
export interface UserSetPhoto {
  slot: string
  label: string
  rarity: Rarity
}

export interface UserSet {
  id: string // "user-xxxxxxxx"
  binderId: string
  year: number | null
  name: string
  template: Template // 作成時のテンプレ（以後はphotosが正）
  note: string | null
  sortIndex: number
  photos: UserSetPhoto[]
  createdAt: string
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
