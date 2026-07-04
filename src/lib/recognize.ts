// クライアント側から解析APIを呼ぶ薄いラッパー

export interface RecognizedPhoto {
  box: [number, number, number, number] | null // [ymin,xmin,ymax,xmax] 0〜1000正規化
  caption: string | null
  captionConfidence: number
  pose: string // 'yori' | 'chu' | 'hiki' | 'suwari-yori' | 'suwari-hiki' | 'unknown'
  poseConfidence: number
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => {
      const s = String(r.result)
      resolve(s.slice(s.indexOf(',') + 1)) // data:...;base64, を剥がす
    }
    r.onerror = () => reject(new Error('画像の読み込みに失敗しました'))
    r.readAsDataURL(blob)
  })
}

/** 1枚の画像を解析し、写っている生写真の一覧を返す */
export async function recognizeImage(blob: Blob): Promise<RecognizedPhoto[]> {
  const image = await blobToBase64(blob)
  const res = await fetch('/api/analyze', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ image, mime: 'image/jpeg' }),
  })
  let body: unknown = null
  try {
    body = await res.json()
  } catch {
    /* HTMLエラーページ等 */
  }
  if (!res.ok) {
    const msg = (body as { error?: string })?.error ?? `解析に失敗しました (${res.status})`
    throw new Error(msg)
  }
  const photos = (body as { photos?: RecognizedPhoto[] })?.photos
  return Array.isArray(photos) ? photos : []
}
