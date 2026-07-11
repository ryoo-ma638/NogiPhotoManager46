import { describe, expect, it } from 'vitest'
import { zipImagesStream, unzipImagesStream } from './imageBackup'

// 配列を AsyncIterable にする小道具（exportImagesZip が db から流すのと同じ形）
async function* toAsync<T>(arr: T[]): AsyncIterable<T> {
  for (const x of arr) yield x
}

function bytes(...ns: number[]): Uint8Array {
  return new Uint8Array(ns)
}

// Uint8Array から Blob（TS5.7の BlobPart 型対策で本体コードと同じく as BlobPart）
function blobOf(u: Uint8Array): Blob {
  return new Blob([u as BlobPart])
}

// ZIPを全部読み込み、photoId→バイト列 のマップにする
async function readAll(file: Blob): Promise<Map<string, Uint8Array>> {
  const out = new Map<string, Uint8Array>()
  await unzipImagesStream(file, async (photoId, data) => {
    out.set(photoId, new Uint8Array(await data.arrayBuffer()))
  })
  return out
}

describe('zipImagesStream / unzipImagesStream', () => {
  it('合成バイト列をzip→unzipでphotoId・内容ともに往復できる', async () => {
    const entries = [
      { photoId: 'yumiki_nao:s0001:yori', data: blobOf(bytes(1, 2, 3)) },
      { photoId: 'yumiki_nao:s0001:chu', data: blobOf(bytes(9, 8, 7, 6, 5)) },
      { photoId: 'yumiki_nao:2022-03a:hiki', data: blobOf(bytes(0, 255, 128, 64)) },
      { photoId: 'yumiki_nao:user-abc12345:c1', data: blobOf(new Uint8Array(1000).fill(42)) },
    ]
    const zipped = await zipImagesStream(toAsync(entries), {
      app: 'NogiPhotoManager46',
      kind: 'images',
      count: entries.length,
    })
    const back = await readAll(zipped)
    // コロン入りphotoIdがファイル名エンコードを経ても全件そのまま戻る
    expect([...back.keys()].sort()).toEqual(entries.map((e) => e.photoId).sort())
    for (const e of entries) {
      expect(back.get(e.photoId)).toEqual(new Uint8Array(await e.data.arrayBuffer()))
    }
  })

  it('manifest.json は読み込み時に無視される（画像エントリだけ渡る）', async () => {
    const entries = [
      { photoId: 'yumiki_nao:s0001:yori', data: blobOf(bytes(1)) },
      { photoId: 'yumiki_nao:s0001:chu', data: blobOf(bytes(2)) },
    ]
    const zipped = await zipImagesStream(toAsync(entries), { app: 'NogiPhotoManager46', kind: 'images', foo: 'bar' })
    const seen: string[] = []
    await unzipImagesStream(zipped, async (photoId) => {
      seen.push(photoId)
    })
    expect(seen.sort()).toEqual(['yumiki_nao:s0001:chu', 'yumiki_nao:s0001:yori'])
    expect(seen).not.toContain('manifest.json')
  })

  it('0バイトのエントリもコアはそのまま往復する（除外は呼び出し側の判定）', async () => {
    const entries = [
      { photoId: 'yumiki_nao:s0001:yori', data: blobOf(bytes(1, 2)) },
      { photoId: 'yumiki_nao:s0001:empty', data: new Blob([]) },
    ]
    const zipped = await zipImagesStream(toAsync(entries), { kind: 'images' })
    const back = await readAll(zipped)
    expect(back.get('yumiki_nao:s0001:yori')).toEqual(bytes(1, 2))
    expect(back.get('yumiki_nao:s0001:empty')).toEqual(new Uint8Array(0))
  })

  it('画像が無くても（manifestのみ）読み込みは空で完了する', async () => {
    const zipped = await zipImagesStream(toAsync([] as { photoId: string; data: Blob }[]), { kind: 'images', count: 0 })
    const back = await readAll(zipped)
    expect(back.size).toBe(0)
  })
})
