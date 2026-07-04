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

// オブジェクトURLのキャッシュ（スクロールのたびにIndexedDBを叩かない）
const urlCache = new Map<string, string>()

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

/** 表示用URL（無ければnull）。取得結果はセッション中キャッシュされる */
export async function imageURL(photoId: string, kind: 'thumb' | 'full'): Promise<string | null> {
  const key = `${photoId}:${kind}`
  const hit = urlCache.get(key)
  if (hit) return hit
  const row = await getImageRow(photoId)
  if (!row) return null
  const url = URL.createObjectURL(kind === 'thumb' ? row.thumb : row.full)
  urlCache.set(key, url)
  return url
}

export async function attachImageFile(photoId: string, file: Blob): Promise<void> {
  const { full, thumb } = await processImage(file)
  await putImage({ photoId, full, thumb, updatedAt: new Date().toISOString() })
  invalidateImageURLs(photoId)
}

export async function removeImageFile(photoId: string): Promise<void> {
  await deleteImageRow(photoId)
  invalidateImageURLs(photoId)
}
