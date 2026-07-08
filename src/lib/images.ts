import { deleteImageRow, getImageRow, putImage } from './db'

// 保存前に必ず縮小する（元の数MB写真をそのまま入れない）
const MAX_FULL = 1280 // 閲覧用
const MAX_THUMB = 320 // 一覧サムネ用（カード幅の2倍程度）

function scaleToBlob(img: HTMLImageElement, maxDim: number, quality: number): Promise<Blob> {
  const scale = Math.min(1, maxDim / Math.max(img.naturalWidth, img.naturalHeight))
  const w = Math.max(1, Math.round(img.naturalWidth * scale))
  const h = Math.max(1, Math.round(img.naturalHeight * scale))
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  if (!ctx) return Promise.reject(new Error('canvasが使えません'))
  ctx.drawImage(img, 0, 0, w, h)
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('画像の変換に失敗しました'))), 'image/jpeg', quality),
  )
}

/** 画像ファイルを（縮小フル, サムネ）の2つのJPEGにする */
export async function processImage(file: Blob): Promise<{ full: Blob; thumb: Blob }> {
  const url = URL.createObjectURL(file)
  try {
    const img = new Image()
    img.src = url
    await img.decode()
    const full = await scaleToBlob(img, MAX_FULL, 0.82)
    const thumb = await scaleToBlob(img, MAX_THUMB, 0.72)
    return { full, thumb }
  } finally {
    URL.revokeObjectURL(url)
  }
}

/**
 * 検出枠（[ymin,xmin,ymax,xmax] 0〜1000正規化）で画像を切り出す。
 * 枠は少しだけ外側に広げる（検出の誤差で写真の端が切れないように）
 */
export async function cropImage(file: Blob, box: [number, number, number, number]): Promise<Blob> {
  const url = URL.createObjectURL(file)
  try {
    const img = new Image()
    img.src = url
    await img.decode()
    const W = img.naturalWidth
    const H = img.naturalHeight
    const pad = 12 // /1000
    const ymin = Math.max(0, (box[0] - pad) / 1000) * H
    const xmin = Math.max(0, (box[1] - pad) / 1000) * W
    const ymax = Math.min(1000, box[2] + pad) / 1000 * H
    const xmax = Math.min(1000, box[3] + pad) / 1000 * W
    const w = Math.max(1, Math.round(xmax - xmin))
    const h = Math.max(1, Math.round(ymax - ymin))
    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('canvasが使えません')
    ctx.drawImage(img, xmin, ymin, w, h, 0, 0, w, h)
    return await new Promise((resolve, reject) =>
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('切り出しに失敗しました'))), 'image/jpeg', 0.85),
    )
  } finally {
    URL.revokeObjectURL(url)
  }
}

/** 画像を時計回りに回転する（90/180/270度） */
export async function rotateImage(file: Blob, deg: 90 | 180 | 270): Promise<Blob> {
  const url = URL.createObjectURL(file)
  try {
    const img = new Image()
    img.src = url
    await img.decode()
    const W = img.naturalWidth
    const H = img.naturalHeight
    const canvas = document.createElement('canvas')
    canvas.width = deg === 180 ? W : H
    canvas.height = deg === 180 ? H : W
    const ctx = canvas.getContext('2d')
    if (!ctx) return file
    if (deg === 90) {
      ctx.translate(H, 0)
      ctx.rotate(Math.PI / 2)
    } else if (deg === 180) {
      ctx.translate(W, H)
      ctx.rotate(Math.PI)
    } else {
      ctx.translate(0, W)
      ctx.rotate(-Math.PI / 2)
    }
    ctx.drawImage(img, 0, 0)
    return await new Promise((resolve, reject) =>
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('回転に失敗しました'))), 'image/jpeg', 0.88),
    )
  } finally {
    URL.revokeObjectURL(url)
  }
}

/** 横長なら時計回りに90°回転して縦にする（AI判定が無い場合の保険） */
export async function ensurePortrait(file: Blob): Promise<Blob> {
  const url = URL.createObjectURL(file)
  let landscape = false
  try {
    const img = new Image()
    img.src = url
    await img.decode()
    landscape = img.naturalWidth > img.naturalHeight
  } finally {
    URL.revokeObjectURL(url)
  }
  return landscape ? rotateImage(file, 90) : file
}

// オブジェクトURLのLRUキャッシュ（スクロールのたびにIndexedDBを叩かない／上限で古いものを解放）。
// 画面に一度に出る画像は少数なので、上限を超えた＝画面外のURLだけを解放する（再訪時に作り直す）。
const MAX_URL_CACHE = 120
const urlCache = new Map<string, string>() // Mapは挿入順を保つので先頭＝最も古い

function cacheTouch(key: string): string | undefined {
  const url = urlCache.get(key)
  if (url !== undefined) {
    urlCache.delete(key) // 最近使ったものを末尾へ（LRU）
    urlCache.set(key, url)
  }
  return url
}

function cachePut(key: string, url: string): void {
  urlCache.set(key, url)
  while (urlCache.size > MAX_URL_CACHE) {
    const oldest = urlCache.keys().next().value as string
    const old = urlCache.get(oldest)
    if (old) URL.revokeObjectURL(old)
    urlCache.delete(oldest)
  }
}

export function invalidateImageURLs(photoId: string): void {
  for (const kind of ['thumb', 'full'] as const) {
    const key = `${photoId}:${kind}`
    const url = urlCache.get(key)
    if (url) {
      URL.revokeObjectURL(url)
      urlCache.delete(key)
    }
  }
}

/** 表示用URL（無ければnull）。取得結果はLRUでキャッシュされる */
export async function imageURL(photoId: string, kind: 'thumb' | 'full'): Promise<string | null> {
  const key = `${photoId}:${kind}`
  const hit = cacheTouch(key)
  if (hit) return hit
  const row = await getImageRow(photoId)
  if (!row) return null
  const url = URL.createObjectURL(kind === 'thumb' ? row.thumb : row.full)
  cachePut(key, url)
  return url
}

export async function attachImageFile(photoId: string, file: Blob): Promise<void> {
  // 縦補正はしない（取込時のAI向き補正＋手動90度回転で向きを決める。ここで縦強制すると手動回転が打ち消される）
  const { full, thumb } = await processImage(file)
  await putImage({ photoId, full, thumb, updatedAt: new Date().toISOString() })
  invalidateImageURLs(photoId)
}

export async function removeImageFile(photoId: string): Promise<void> {
  await deleteImageRow(photoId)
  invalidateImageURLs(photoId)
}
