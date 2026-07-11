// 添付画像だけをまとめてZIPで書き出し／読み込みする（○×データの軽いJSONバックアップとは別建て）。
// full画像をphotoId名で格納。復元時はサムネを再生成する。
// 画像は数百枚になるので、全Blobを一度にメモリ展開せず fflate のストリーミングで1枚ずつ流す。
import { Zip, ZipPassThrough, Unzip, UnzipInflate } from 'fflate'
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

/**
 * 画像エントリを1件ずつストリーミングでZIP化する（純関数コア＝dbに触れない）。
 * 出力チャンクは一定量ごとに Blob へ束ねてチャンク配列を解放する（Blobはブラウザが
 * ディスクへ退避できる＝メモリのピークを抑える）。エントリ名・manifest.json は現行形式のまま。
 */
export async function zipImagesStream(
  entries: AsyncIterable<{ photoId: string; data: Blob }>,
  manifest: object,
): Promise<Blob> {
  const COALESCE = 8 * 1024 * 1024 // これだけ貯まったらBlobへ統合し、素のチャンク配列を手放す
  const parts: BlobPart[] = [] // 確定した出力（統合済みBlobと素のチャンクが混在）
  let buf: Uint8Array[] = [] // 未統合の出力チャンク
  let bufBytes = 0
  const flush = () => {
    if (buf.length === 0) return
    parts.push(new Blob(buf as BlobPart[]))
    buf = []
    bufBytes = 0
  }
  let settle!: () => void
  let fail!: (e: unknown) => void
  const done = new Promise<void>((res, rej) => {
    settle = res
    fail = rej
  })
  const zip = new Zip((err, chunk, final) => {
    if (err) return fail(err)
    buf.push(chunk)
    bufBytes += chunk.length
    if (bufBytes >= COALESCE) flush()
    if (final) {
      flush()
      settle()
    }
  })
  // manifest.json を先頭に置く（過去に書き出したZIPと同じ並び・形式）
  const mf = new ZipPassThrough('manifest.json')
  zip.add(mf)
  mf.push(new TextEncoder().encode(JSON.stringify(manifest, null, 2)), true)
  // JPEGは圧縮済みなので ZipPassThrough（無圧縮＝level 0相当）で通す。1枚ずつ追加。
  for await (const { photoId, data } of entries) {
    const f = new ZipPassThrough(toName(photoId))
    zip.add(f)
    f.push(await bytesOf(data), true)
  }
  zip.end()
  await done
  return new Blob(parts, { type: 'application/zip' })
}

/**
 * 画像ZIPを1エントリずつ取り出す（純関数コア＝dbに触れない）。
 * エントリが1件完了するたび onEntry を await し、終わるまで次の push へ進めない
 * （＝同時にメモリへ持つのは1エントリ分）。manifest.json や不正名はスキップする。
 */
export async function unzipImagesStream(
  file: Blob,
  onEntry: (photoId: string, data: Blob) => Promise<void>,
): Promise<void> {
  const ready: { photoId: string; data: Blob }[] = [] // 完了したが未処理のエントリ
  let failure: unknown = null
  const unzip = new Unzip()
  unzip.register(UnzipInflate) // deflate圧縮エントリも読めるように（無圧縮エントリは登録不要だが保険）
  unzip.onfile = (entry) => {
    const photoId = fromName(entry.name)
    if (!photoId) {
      // manifest.json や不正名は中身を読み飛ばす（貯めない）
      entry.ondata = () => {}
      entry.start()
      return
    }
    let chunks: Uint8Array[] = []
    entry.ondata = (err, chunk, final) => {
      if (err) {
        failure = err
        return
      }
      if (chunk.length) chunks.push(chunk)
      if (final) {
        // このエントリ分だけ Blob 化（素の配列は解放）。Blobはディスクへ退避可
        ready.push({ photoId, data: new Blob(chunks as BlobPart[], { type: 'image/jpeg' }) })
        chunks = []
      }
    }
    entry.start()
  }
  const drain = async () => {
    while (ready.length) {
      const e = ready.shift()!
      await onEntry(e.photoId, e.data)
    }
  }
  const feed = async (chunk: Uint8Array, last: boolean) => {
    unzip.push(chunk, last)
    if (failure) throw failure
    await drain() // このpushで完了した分を処理し切ってから次へ（＝1エントリ分の背圧）
  }
  const CHUNK = 4 * 1024 * 1024
  // stream() があればリーダーで、無ければ slice() を4MB刻みで push
  if (typeof file.stream === 'function') {
    const reader = file.stream().getReader()
    for (;;) {
      const { done: rdDone, value } = await reader.read()
      if (rdDone || value === undefined) break
      await feed(value, false)
    }
    await feed(new Uint8Array(0), true) // 入力終端を通知
  } else {
    const size = file.size
    if (size === 0) {
      await feed(new Uint8Array(0), true)
    } else {
      for (let off = 0; off < size; ) {
        const end = Math.min(off + CHUNK, size)
        const buf = new Uint8Array(await file.slice(off, end).arrayBuffer())
        off = end
        await feed(buf, off >= size)
      }
    }
  }
  if (failure) throw failure
  await drain()
}

/** 添付画像(full)をまとめてZIP化。戻り値のcountは含めた枚数。 */
export async function exportImagesZip(member: string): Promise<{ blob: Blob; count: number }> {
  // toArrayで全Blobを一度に展開しない。キーだけ取り、1件ずつfullを読んでコアへ流す
  const keys = await db.images.toCollection().primaryKeys()
  const manifest = {
    app: 'NogiPhotoManager46',
    kind: 'images',
    version: 1,
    member,
    count: keys.length,
    exportedAt: new Date().toISOString(),
  }
  async function* rows(): AsyncIterable<{ photoId: string; data: Blob }> {
    for (const key of keys) {
      const row = await db.images.get(key)
      if (!row) continue
      yield { photoId: row.photoId, data: row.full } // fullだけ読む。thumbは読まない
    }
  }
  const blob = await zipImagesStream(rows(), manifest)
  return { blob, count: keys.length }
}

/**
 * 画像ZIPを読み込み、各fullを再添付する。attach は appData.attachImage を渡す想定
 * （processImageでサムネ再生成＋imageIds更新まで面倒を見る）。
 * validIds を渡すと、そこに無いphotoId（消えた枠等）は孤児画像として飛ばす。
 * 戻り値: restored=復元枚数, skipped=該当枠なしで飛ばした枚数。
 */
export async function importImagesZip(
  file: Blob,
  attach: (photoId: string, blob: Blob) => Promise<void>,
  validIds?: Set<string>,
): Promise<{ restored: number; skipped: number }> {
  let restored = 0
  let skipped = 0
  await unzipImagesStream(file, async (photoId, data) => {
    if (data.size === 0) return // 空データ（壊れた枠）は復元しない
    if (validIds && !validIds.has(photoId)) {
      skipped++ // カタログにも手動セットにも無い枠＝孤児画像。復元しない
      return
    }
    await attach(photoId, data) // コアが image/jpeg のBlobで渡す
    restored++
  })
  return { restored, skipped }
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
