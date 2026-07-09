// トレードの共有ファイル（相手と譲/求を突き合わせるためのローカルなファイル交換。サーバ不要）。
// 将来この形式をそのままサーバ版（マッチング）にも使えるよう、計算しやすい構造にしておく。

export interface TradeGive {
  photoId: string
  qty: number // 譲れる枚数
}

export interface TradeExport {
  app: 'NogiPhotoManager46'
  kind: 'trade'
  member: string // どのメンバー（写真IDの互換確認用）
  ownerName: string // 持ち主（ニックネーム）＝相手表示に使う
  exportedAt: string
  give: TradeGive[] // 譲れる（ダブり）
  want: string[] // 求（特に欲しい写真ID）
}

export function buildTradeExport(member: string, ownerName: string, give: TradeGive[], want: string[]): TradeExport {
  return {
    app: 'NogiPhotoManager46',
    kind: 'trade',
    member,
    ownerName,
    exportedAt: new Date().toISOString(),
    give,
    want,
  }
}

export interface ParsedTrade {
  ownerName: string
  give: Map<string, number> // photoId -> 譲れる枚数
  want: Set<string>
}

export function parseTradeExport(text: string): ParsedTrade {
  const d = JSON.parse(text) as Partial<TradeExport> & { memberName?: string }
  if (d?.kind !== 'trade' || !Array.isArray(d.give) || !Array.isArray(d.want)) {
    throw new Error('トレードの共有ファイルではありません')
  }
  const give = new Map<string, number>()
  for (const g of d.give) {
    if (g && typeof g.photoId === 'string') {
      give.set(g.photoId, typeof g.qty === 'number' && g.qty > 0 ? Math.floor(g.qty) : 1)
    }
  }
  const want = new Set<string>(d.want.filter((x): x is string => typeof x === 'string'))
  const owner = d.ownerName ?? d.memberName // 旧形式(memberName)も読む
  return { ownerName: typeof owner === 'string' && owner ? owner : '相手', give, want }
}

export interface Overlap {
  canGet: { photoId: string; qty: number }[] // 相手が譲＆自分が求＝もらえる
  canGive: string[] // 自分が譲＆相手が求＝渡せる
}

/** 自分と相手の譲/求を突き合わせて、もらえる・渡せるを出す */
export function computeOverlap(
  myGive: Set<string>,
  myWant: Set<string>,
  theirGive: Map<string, number>,
  theirWant: Set<string>,
): Overlap {
  const canGet = [...theirGive.entries()].filter(([id]) => myWant.has(id)).map(([photoId, qty]) => ({ photoId, qty }))
  const canGive = [...myGive].filter((id) => theirWant.has(id))
  return { canGet, canGive }
}
