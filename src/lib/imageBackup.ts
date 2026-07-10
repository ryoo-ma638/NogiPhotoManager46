// 添付画像だけをまとめてZIPで書き出し／読み込みする（○×データの軽いJSONバックアップとは別建て）。
// full画像をphotoId名で格納。復元時はサムネを再生成する。
import { zip, unzip, type Zippable } from 'fflate'
import { db } from './db'

const IMG_DIR = 'images/'

// photoId（`member:setId:slot`）はコロンを含むのでファイル名用にエンコード
function toName(photoId: string): string {
  return IMG_DIR + encodeURIComponent(photoId) + '.jpg'
}
function fromName(name: string): string | null {
  if (!name.startsWith(IMG_DIR) || !name.endsWith('.jpg')) return null
  try {
    return decodeURIComponent(name.slice(IMG_DIR.length, -4))
  } catch {
    return null
  }
}

async function bytesOf(b: Blob): Promise<Uint8Array> {
  return new Uint8Array(await b.arrayBuffer())
}

/** 添付画像(full)をまとめてZIP化。戻り値のcountは含めた枚数。 */
export async function exportImagesZip(member: string): Promise<{ blob: Blob; count: number }> {
  const rows = await db.images.toArray()
  const files: Zippable = {}
  for (const r of rows) files[toName(r.photoId)] = await bytesOf(r.full)
  const manifest = {
    app: 'NogiPhotoManager46',
    kind: 'images',
    version: 1,
    member,
    count: rows.length,
    exportedAt: new Date().toISOString(),
  }
  files['manifest.json'] = new TextEncoder().encode(JSON.stringify(manifest, null, 2))
  // JPEGは既に圧縮済みなので無圧縮(level 0)で速く軽く
  const zipped = await new Promise<Uint8Array>((resolve, reject) => {
    zip(files, { level: 0 }, (err, data) => (err ? reject(err) : resolve(data)))
  })
  return { blob: new Blob([zipped as BlobPart], { type: 'application/zip' }), count: rows.length }
}

/**
 * 画像ZIPを読み込み、各fullを再添付する。attach は appData.attachImage を渡す想定
 * （processImageでサムネ再生成＋imageIds更新まで面倒を見る）。戻り値=復元枚数。
 */
export async function importImagesZip(file: Blob, attach: (photoId: string, blob: Blob) => Promise<void>): Promise<number> {
  const bytes = new Uint8Array(await file.arrayBuffer())
  const entries = await new Promise<Record<string, Uint8Array>>((resolve, reject) => {
    unzip(bytes, (err, data) => (err ? reject(err) : resolve(data)))
  })
  let restored = 0
  for (const [name, data] of Object.entries(entries)) {
    const photoId = fromName(name)
    if (!photoId || data.length === 0) continue
    await attach(photoId, new Blob([data as BlobPart], { type: 'image/jpeg' }))
    restored++
  }
  return restored
}

/** Blobを名前付きでダウンロード保存。 */
export function downloadBlob(filename: string, blob: Blob): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}
