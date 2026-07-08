import { useEffect, useMemo, useRef, useState } from 'react'
import { useAppData } from '../lib/appData'
import { Header } from '../components/ui'
import { SheetShell } from '../components/UserSetSheets'
import { CameraCapture } from '../components/CameraCapture'
import { CameraIcon, CheckCircle, SearchIcon } from '../components/icons'
import { cropImage, ensurePortrait, processImage, rotateImage } from '../lib/images'
import { recognizeImage, type RecognizedPhoto } from '../lib/recognize'
import { matchCaption, slotForPose, normalizeForSearch } from '../lib/match'
import { kindOf } from '../lib/kinds'
import type { Binder, CatalogSet } from '../types'

// 自動確定に必要な最低確信度
const MIN_CONFIDENCE = 0.6

interface ImportItem {
  id: string
  file: Blob // 保存する画像（バインダーページから切り出した場合は切り出し後）
  url: string // プレビュー用オブジェクトURL
  status: 'waiting' | 'analyzing' | 'done' | 'saved'
  caption: string | null
  pose: string | null
  setId: string | null
  slot: string | null
  auto: boolean // 自動判定できたか
  sequenced: boolean // 一番上のセット選択から連番(ABCD/ヨリチュウヒキ)で自動割当された
  candidates: string[] | null // セット候補（複数該当時。「セットを選ぶ」の初期リスト）
  error: string | null
}

// 「その他」の枠ラベル（種類なし＝連番）
const CIRCLED = '①②③④⑤⑥⑦⑧⑨⑩⑪⑫⑬⑭⑮⑯⑰⑱⑲⑳'
const circled = (n: number) => CIRCLED[n - 1] ?? `${n}`

/** 検出枠が「生写真1枚」らしい大きさ・比率か（端の切れ端・極端に細い/小さい検出を除外） */
function isCardLikeBox(box: [number, number, number, number]): boolean {
  const [ymin, xmin, ymax, xmax] = box
  const w = xmax - xmin
  const h = ymax - ymin
  const area = (w * h) / 1e6 // 画像全体に対する面積比
  const aspect = w / Math.max(1, h)
  return area >= 0.02 && aspect >= 0.3 && aspect <= 3.2
}

export default function ImportPage() {
  const { catalog, allSets, setById, userSetById, photosOf, owned, toggle, imageIds, attachImage, addUserSet, updateUserSet } = useAppData()
  const [items, setItems] = useState<ImportItem[]>([])
  const [busy, setBusy] = useState(false)
  const [pickerFor, setPickerFor] = useState<{ itemId: string; mode: 'set' | 'slot' } | null>(null)
  const [otherFor, setOtherFor] = useState<string | null>(null) // 「その他として登録」対象のitemId
  const [preview, setPreview] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const [showCamera, setShowCamera] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const sealedBinders = useMemo(() => new Set(catalog.binders.filter((b) => b.sealed).map((b) => b.id)), [catalog])

  // ページを離れるときにプレビューURLを解放
  useEffect(() => {
    return () => {
      for (const it of items) URL.revokeObjectURL(it.url)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const showToast = (msg: string) => {
    setToast(msg)
    window.setTimeout(() => setToast(null), 3000)
  }

  const update = (id: string, patch: Partial<ImportItem>) => {
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, ...patch } : it)))
  }

  const makeItem = (file: Blob, id: string = crypto.randomUUID()): ImportItem => ({
    id,
    file,
    url: URL.createObjectURL(file),
    status: 'waiting',
    caption: null,
    pose: null,
    setId: null,
    slot: null,
    auto: false,
    sequenced: false,
    candidates: null,
    error: null,
  })

  // 解析キュー: 撮った端から1枚ずつ順に解析する（撮影と並行して走る）
  const queueRef = useRef<ImportItem[]>([])
  const removedRef = useRef<Set<string>>(new Set())
  const pumpingRef = useRef(false)

  const pump = async () => {
    if (pumpingRef.current) return
    pumpingRef.current = true
    setBusy(true)
    while (queueRef.current.length > 0) {
      const it = queueRef.current.shift()!
      if (removedRef.current.has(it.id)) continue // 取消済みはAPIを使わずスキップ
      await analyze(it)
    }
    pumpingRef.current = false
    setBusy(false)
  }

  const enqueue = (newItems: ImportItem[]) => {
    if (newItems.length === 0) return
    setItems((prev) => [...prev, ...newItems])
    queueRef.current.push(...newItems)
    void pump()
  }

  // ファイル選択（複数）→ まとめてキューへ
  const onFiles = (files: FileList | null) => {
    if (!files || files.length === 0) return
    enqueue([...files].slice(0, 30).map((f) => makeItem(f)))
  }

  // カメラの1枚撮影 → 即キューへ（解析開始）
  const onCameraShot = (id: string, blob: Blob) => enqueue([makeItem(blob, id)])

  // カメラの「1枚戻す」→ その1枚を取消（解析中なら結果は破棄される）
  const onCameraUndo = (id: string) => {
    removedRef.current.add(id)
    setItems((prev) => {
      const target = prev.find((x) => x.id === id)
      if (target) URL.revokeObjectURL(target.url)
      return prev.filter((x) => x.id !== id)
    })
  }

  /** 1枚の認識結果 → セット/枠の推定 */
  const classify = (rec: RecognizedPhoto): Pick<ImportItem, 'caption' | 'pose' | 'setId' | 'slot' | 'auto' | 'candidates'> => {
    let setId: string | null = null
    let slot: string | null = null
    let candidates: string[] | null = null
    if (rec.caption) {
      const m = matchCaption(rec.caption, allSets, sealedBinders)
      // 自動確定は「正確な照合（品番・日付コード・周年）＋高確信度＋1件」に限る。
      // あいまいな名前一致・確信度不足・複数該当は、誤登録を避けて画面に候補として出す。
      const precise = m.via === 'srcl' || m.via === 'date' || m.via === 'anniversary'
      if (precise && m.sets.length === 1 && rec.captionConfidence >= MIN_CONFIDENCE) {
        const hit = m.sets[0]!
        setId = hit.id
        const photos = photosOf(hit)
        // ※封入のSRCL品番→盤(A/B/C/D)の自動割当は行わない:
        //   印字の品番が盤共通のシングルがあり誤登録の危険があるため（m.slotは使わない）
        if (photos.length === 1) {
          slot = photos[0]!.slot // 1種セット（配信限定等）は枠も確定
        } else if (rec.pose !== 'unknown' && rec.poseConfidence >= MIN_CONFIDENCE) {
          slot = slotForPose(rec.pose, kindOf(hit, sealedBinders.has(hit.binderId)), photos.map((p) => p.slot))
        }
      } else if (m.sets.length >= 1) {
        candidates = m.sets.slice(0, 20).map((s) => s.id) // 印字から絞った候補を「セットを選ぶ」の初期表示に
      }
    }
    return { caption: rec.caption, pose: rec.pose, setId, slot, auto: !!(setId && slot), candidates }
  }

  const analyze = async (it: ImportItem) => {
    update(it.id, { status: 'analyzing' })
    try {
      const { full } = await processImage(it.file)
      let photos: RecognizedPhoto[]
      try {
        photos = await recognizeImage(full)
      } catch {
        // 一時的な失敗（時間切れ・混雑等）は5秒待って1回だけ再試行
        await new Promise((r) => setTimeout(r, 5000))
        photos = await recognizeImage(full)
      }

      // 複数検出のとき、端で見切れた小片・生写真の比率でない検出を除外
      // （隣の写真の切れ端が別カードとして混ざるのを防ぐ）。実カードが残る場合だけ適用。
      if (photos.length > 1) {
        const kept = photos.filter((p) => p.box && isCardLikeBox(p.box))
        if (kept.length > 0 && kept.length < photos.length) photos = kept
      }

      // 切り出し後、AIの回転判定（顔と印字の向き）で正しい向きに直す。判定が無ければ横→縦の保険のみ
      const orient = async (blob: Blob, rotation: number): Promise<Blob> => {
        let f = blob
        if (rotation === 90 || rotation === 180 || rotation === 270) f = await rotateImage(f, rotation)
        return ensurePortrait(f)
      }

      if (photos.length <= 1) {
        // 1枚だけ（または検出なし）→ この項目をそのまま更新（検出枠があれば切り出し）
        const rec = photos[0]
        let file: Blob = rec?.box ? await cropImage(full, rec.box) : it.file
        file = await orient(file, rec?.rotation ?? 0)
        let url = it.url
        if (file !== it.file) {
          URL.revokeObjectURL(it.url)
          url = URL.createObjectURL(file)
        }
        update(it.id, {
          status: 'done',
          file,
          url,
          error: rec ? null : '生写真を検出できませんでした',
          ...(rec ? classify(rec) : {}),
        })
        return
      }

      // 複数枚検出（バインダーページ等）→ 1枚ずつ切り出して項目を分割
      const subItems: ImportItem[] = []
      for (const rec of photos) {
        if (!rec.box) continue
        const cropped = await orient(await cropImage(full, rec.box), rec.rotation)
        subItems.push({
          id: crypto.randomUUID(),
          file: cropped,
          url: URL.createObjectURL(cropped),
          status: 'done',
          sequenced: false,
          error: null,
          ...classify(rec),
        })
      }
      URL.revokeObjectURL(it.url)
      setItems((prev) => prev.flatMap((x) => (x.id === it.id ? subItems : [x])))
    } catch (e) {
      update(it.id, { status: 'done', error: e instanceof Error ? e.message : String(e) })
    }
  }

  const pending = items.filter((it) => it.status !== 'saved')
  const ready = pending.filter((it) => it.setId && it.slot)
  const apiMissing = pending.some((it) => it.error?.includes('未設定'))

  const saveAll = async () => {
    setBusy(true)
    let n = 0
    for (const it of ready) {
      const photoId = `${catalog.member.id}:${it.setId}:${it.slot}`
      try {
        await attachImage(photoId, it.file)
        if (!owned.has(photoId)) toggle(photoId)
        update(it.id, { status: 'saved' })
        n++
      } catch (e) {
        update(it.id, { error: e instanceof Error ? e.message : String(e) })
      }
    }
    setBusy(false)
    showToast(`${n}枚を保存しました（画像＋所有○）`)
  }

  const pickerItem = pickerFor ? items.find((i) => i.id === pickerFor.itemId) : null
  const pickerSet = pickerItem?.setId ? setById.get(pickerItem.setId) : null

  /**
   * 一番上のセット選択から、続く未割当の写真へ同じセットを連番で自動割当する。
   * 例: 封入4枚 → A/B/C/D、年度別3種 → ヨリ/チュウ/ヒキ。
   * 連番分は「そのまま押さなければ確定、押せば変更可」（sequenced=true）。
   */
  const cascadeAssign = (itemId: string, set: CatalogSet) => {
    const slots = photosOf(set).map((p) => p.slot)
    setItems((prev) => {
      const idx = prev.findIndex((i) => i.id === itemId)
      if (idx < 0) return prev
      const next = [...prev]
      next[idx] = { ...next[idx]!, setId: set.id, slot: slots[0] ?? null, auto: false, sequenced: false, candidates: null }
      let s = 1
      for (let j = idx + 1; j < next.length && s < slots.length; j++) {
        const item = next[j]!
        if (item.status === 'saved') continue
        if (item.setId && item.setId !== set.id) break // 別セットが割当済み＝連番が途切れるので止める
        next[j] = { ...item, setId: set.id, slot: slots[s]!, auto: false, sequenced: true, candidates: null }
        s++
      }
      return next
    })
  }

  // ---- 「その他」への登録（判別不能な写真の受け皿） ----
  const otherSets = allSets.filter((s) => s.binderId === 'b-other').sort((a, b) => a.sortIndex - b.sortIndex)

  /** 既存のその他セットに割り当て（手動セットなら「種類なし」の枠を1つ追加して入れる） */
  const assignToOther = async (itemId: string, s: CatalogSet) => {
    if (s.user) {
      const u = userSetById.get(s.id)
      if (!u) return
      const used = new Set(u.photos.map((p) => p.slot))
      let n = 1
      while (used.has(`c${n}`)) n++
      const slot = `c${n}`
      await updateUserSet({ ...u, photos: [...u.photos, { slot, label: circled(u.photos.length + 1), rarity: 'other' }] }, [])
      update(itemId, { setId: s.id, slot, auto: false })
    } else {
      // カタログ由来（枠固定）は最初の枠に割り当て
      const ph = photosOf(s)
      update(itemId, { setId: s.id, slot: ph[0]?.slot ?? null, auto: false })
    }
    setOtherFor(null)
  }

  /** 新しいその他セットを作って割り当て（種類なし＝①の1枠から始まり、追加のたびに枠が増える） */
  const createOtherSet = async (itemId: string, name: string) => {
    const row = {
      id: `user-${crypto.randomUUID().slice(0, 8)}`,
      binderId: 'b-other',
      year: null,
      name: name.trim(),
      template: 'single1' as const,
      note: null,
      sortIndex: (otherSets.length > 0 ? Math.max(...otherSets.map((s) => s.sortIndex)) : 0) + 10,
      photos: [{ slot: 'p1', label: '①', rarity: 'other' as const }],
      createdAt: new Date().toISOString(),
    }
    await addUserSet(row)
    update(itemId, { setId: row.id, slot: 'p1', auto: false })
    setOtherFor(null)
  }

  return (
    <>
      <Header title="一括取込" subtitle="写真から自動判定して振り分け" back />
      <div className="mx-auto max-w-lg px-4 pt-4 pb-28 space-y-3">
        {apiMissing && (
          <div className="rounded-xl bg-amber-50 border border-amber-200 px-3 py-2.5 text-[12px] text-amber-700 leading-relaxed">
            自動判定は準備中です（認識APIキー未設定）。今は手動で「セット」と「枠」を選んで保存できます。
          </div>
        )}

        <button
          onClick={() => setShowCamera(true)}
          className="w-full h-24 rounded-2xl bg-violet-600 text-white font-bold shadow-lg shadow-violet-200 flex flex-col items-center justify-center gap-1 active:scale-[0.99] transition"
        >
          <CameraIcon className="w-6 h-6" />
          カメラで撮る（連続）
        </button>
        <button
          onClick={() => fileRef.current?.click()}
          disabled={busy}
          className="w-full h-11 rounded-xl border border-slate-200 bg-white text-slate-600 font-medium text-[14px] disabled:opacity-50 active:scale-[0.99] transition"
        >
          写真から選ぶ（複数OK・最大30枚）
        </button>
        <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={(e) => onFiles(e.target.files)} />

        {pending.length > 0 && (
          <p className="text-[12px] text-slate-400">
            {pending.length}枚中 自動判定 {pending.filter((i) => i.auto).length} ／ 保存可能 {ready.length}
            {busy && ' ・解析中…'}
          </p>
        )}

        {pending.map((it) => {
          const set = it.setId ? setById.get(it.setId) : null
          const photo = set && it.slot ? photosOf(set).find((p) => p.slot === it.slot) : null
          const photoId = it.setId && it.slot ? `${catalog.member.id}:${it.setId}:${it.slot}` : null
          const overwrite = photoId ? imageIds.has(photoId) : false
          return (
            <div key={it.id} className="rounded-2xl bg-white border border-slate-100 shadow-sm p-3 flex gap-3">
              <button onClick={() => setPreview(it.url)} aria-label="画像を拡大" className="shrink-0 active:opacity-70 transition-opacity">
                <img src={it.url} alt="" className="w-16 h-[91px] rounded-lg object-cover bg-slate-100" />
              </button>
              <div className="min-w-0 flex-1 space-y-1.5">
                {/* 状態 */}
                <div className="flex items-center gap-1.5 text-[11px]">
                  {it.status === 'analyzing' && <span className="text-violet-500 animate-pulse">解析中…</span>}
                  {it.status === 'done' && it.auto && (
                    <span className="inline-flex items-center gap-1 text-emerald-600 font-bold">
                      <CheckCircle className="w-3.5 h-3.5" filled /> 自動判定
                    </span>
                  )}
                  {it.status === 'done' && !it.auto && it.sequenced && <span className="text-violet-600 font-bold">連番で割当（変更可）</span>}
                  {it.status === 'done' && !it.setId && !it.error && <span className="text-amber-600 font-bold">⚠ 要確認</span>}
                  {it.error && <span className="text-red-500 font-medium truncate">⚠ {it.error}</span>}
                  {it.caption && <span className="text-slate-400 line-clamp-2 break-all">印字: {it.caption}</span>}
                </div>
                {/* セット選択（候補が1件ならタップで即確定・複数ならピッカー） */}
                {(() => {
                  const only = !set && it.candidates?.length === 1 ? setById.get(it.candidates[0]!) ?? null : null
                  return (
                    <button
                      onClick={() => (only ? cascadeAssign(it.id, only) : setPickerFor({ itemId: it.id, mode: 'set' }))}
                      className={`w-full h-9 rounded-lg px-2.5 text-left text-[13px] font-medium truncate border ${
                        set ? 'bg-violet-50 border-violet-200 text-violet-700' : it.candidates?.length ? 'bg-amber-50 border-amber-300 text-amber-700' : 'bg-slate-50 border-slate-200 text-slate-400'
                      }`}
                    >
                      {set ? set.name : only ? `${only.name}（タップで確定）` : it.candidates?.length ? `候補から選ぶ（${it.candidates.length}件）` : 'セットを選ぶ'}
                    </button>
                  )
                })()}
                {/* 枠選択 */}
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => it.setId && setPickerFor({ itemId: it.id, mode: 'slot' })}
                    disabled={!it.setId}
                    className={`flex-1 h-9 rounded-lg px-2.5 text-left text-[13px] font-medium border disabled:opacity-40 ${
                      photo ? 'bg-violet-50 border-violet-200 text-violet-700' : 'bg-slate-50 border-slate-200 text-slate-400'
                    }`}
                  >
                    {photo ? `枠: ${photo.label}` : '枠を選ぶ'}
                  </button>
                  <button
                    onClick={() => {
                      void rotateImage(it.file, 90).then((rotated) => {
                        URL.revokeObjectURL(it.url)
                        update(it.id, { file: rotated, url: URL.createObjectURL(rotated) })
                      })
                    }}
                    aria-label="90度回転"
                    className="shrink-0 w-9 h-9 rounded-lg bg-slate-100 text-slate-500 text-lg"
                  >
                    ↻
                  </button>
                  <button
                    onClick={() => {
                      URL.revokeObjectURL(it.url)
                      setItems((prev) => prev.filter((x) => x.id !== it.id))
                    }}
                    aria-label="この写真を取り込まない"
                    className="shrink-0 w-9 h-9 rounded-lg bg-red-50 text-red-500 font-bold"
                  >
                    −
                  </button>
                </div>
                {overwrite && <p className="text-[11px] text-amber-600">※この枠の既存画像を上書きします</p>}
                {/* 判別できない写真の受け皿: ミニ生写真・スタ誕など年度別/封入でないもの */}
                {it.status === 'done' && !it.setId && (
                  <button
                    onClick={() => setOtherFor(it.id)}
                    className="w-full h-8 rounded-lg text-[12px] font-medium bg-fuchsia-50 border border-fuchsia-200 text-fuchsia-600 active:bg-fuchsia-100 transition-colors"
                  >
                    「その他」として登録（ミニ生写真・スタ誕など）
                  </button>
                )}
              </div>
            </div>
          )
        })}

        {items.some((i) => i.status === 'saved') && (
          <p className="text-[12px] text-emerald-600 font-medium">✓ 保存済み {items.filter((i) => i.status === 'saved').length}枚</p>
        )}
      </div>

      {/* 保存バー */}
      {ready.length > 0 && (
        <div className="fixed inset-x-0 bottom-[calc(4.25rem+env(safe-area-inset-bottom))] z-10">
          <div className="mx-auto max-w-lg px-4">
            <button
              onClick={() => void saveAll()}
              disabled={busy}
              className="w-full h-12 rounded-2xl bg-violet-600 text-white font-bold shadow-lg shadow-violet-200 disabled:opacity-50 active:scale-[0.98] transition"
            >
              {ready.length}枚を保存（画像＋所有○）
            </button>
          </div>
        </div>
      )}

      {/* セット/枠ピッカー */}
      {pickerFor && pickerItem && pickerFor.mode === 'set' && (
        <SetPicker
          allSets={allSets}
          binders={catalog.binders}
          candidates={(pickerItem.candidates ?? []).map((id) => setById.get(id)).filter((s): s is CatalogSet => !!s)}
          onPick={(s) => {
            // 選んだ写真に先頭枠、続く写真に連番で自動割当（あとで各枠は変更可）
            cascadeAssign(pickerFor.itemId, s)
            setPickerFor(null)
          }}
          onClose={() => setPickerFor(null)}
        />
      )}
      {pickerFor && pickerItem && pickerFor.mode === 'slot' && pickerSet && (
        <SheetShell title={`枠を選ぶ — ${pickerSet.name}`} onClose={() => setPickerFor(null)}>
          <div className="grid grid-cols-3 gap-2 pb-2">
            {photosOf(pickerSet).map((p) => {
              const has = imageIds.has(p.id)
              const own = owned.has(p.id)
              return (
                <button
                  key={p.id}
                  onClick={() => {
                    update(pickerFor.itemId, { slot: p.slot, auto: false, sequenced: false })
                    setPickerFor(null)
                  }}
                  className="h-14 rounded-xl border border-slate-200 bg-white text-[13px] font-bold text-slate-700 flex flex-col items-center justify-center gap-0.5 active:bg-violet-50"
                >
                  {p.label}
                  <span className="text-[10px] font-normal text-slate-400">
                    {own ? '所有' : '未所有'}
                    {has ? '・画像あり' : ''}
                  </span>
                </button>
              )
            })}
          </div>
        </SheetShell>
      )}

      {otherFor && (
        <OtherRegisterSheet
          otherSets={otherSets}
          photosOf={photosOf}
          onPickExisting={(s) => void assignToOther(otherFor, s)}
          onCreate={(name) => void createOtherSet(otherFor, name)}
          onClose={() => setOtherFor(null)}
        />
      )}

      {showCamera && (
        <CameraCapture
          onShot={onCameraShot}
          onUndo={onCameraUndo}
          onClose={() => setShowCamera(false)}
        />
      )}

      {preview && (
        <div className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center animate-fade" onClick={() => setPreview(null)}>
          <img src={preview} alt="" className="max-h-[92dvh] max-w-[94vw] object-contain rounded-lg" />
          <button className="absolute top-[calc(0.75rem+env(safe-area-inset-top))] right-4 text-white/80 text-2xl p-2" aria-label="閉じる">✕</button>
        </div>
      )}

      {toast && (
        <div className="fixed inset-x-0 bottom-[calc(8rem+env(safe-area-inset-bottom))] z-50 flex justify-center px-4 pointer-events-none">
          <div className="animate-pop rounded-full bg-slate-900/90 text-white text-[13px] font-medium px-4 py-2 shadow-lg">{toast}</div>
        </div>
      )}
    </>
  )
}

/** 「その他」への登録シート: 既存のその他セットに追加 or 新規作成（種類なし＝連番枠） */
function OtherRegisterSheet({
  otherSets,
  photosOf,
  onPickExisting,
  onCreate,
  onClose,
}: {
  otherSets: CatalogSet[]
  photosOf: (s: CatalogSet) => { id: string }[]
  onPickExisting: (s: CatalogSet) => void
  onCreate: (name: string) => void
  onClose: () => void
}) {
  const [name, setName] = useState('')
  return (
    <SheetShell title="「その他」として登録" onClose={onClose}>
      <div className="space-y-4 pb-2">
        <p className="text-[12px] text-slate-400 leading-relaxed">
          年度別・封入以外の写真（ライブBOXのミニ生写真、乃木坂スター誕生！など）は「その他」に入れます。ポーズの区別なし（①②③…の連番）で登録されます。
        </p>

        {otherSets.length > 0 && (
          <div>
            <p className="text-[13px] font-bold text-slate-500 pb-1.5">既存のセットに追加</p>
            <div className="rounded-xl bg-white border border-slate-200 divide-y divide-slate-100 overflow-hidden">
              {otherSets.map((s) => (
                <button key={s.id} onClick={() => onPickExisting(s)} className="w-full text-left px-3 py-2.5 text-[14px] text-slate-700 active:bg-fuchsia-50">
                  {s.name}
                  <span className="block text-[11px] text-slate-400">
                    現在{photosOf(s).length}枚{s.user ? '・枠を1つ増やして追加します' : ''}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        <div>
          <p className="text-[13px] font-bold text-slate-500 pb-1.5">新しいセットを作る</p>
          <div className="flex gap-2">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="例: 乃木坂スター誕生！"
              className="flex-1 h-11 rounded-xl bg-white border border-slate-200 px-3 text-[15px] outline-none focus:border-fuchsia-400"
            />
            <button
              disabled={!name.trim()}
              onClick={() => onCreate(name)}
              className="shrink-0 h-11 px-4 rounded-xl bg-fuchsia-500 text-white font-bold text-[14px] disabled:opacity-40"
            >
              作成
            </button>
          </div>
        </div>
      </div>
    </SheetShell>
  )
}

function SetPicker({
  allSets,
  binders,
  candidates,
  onPick,
  onClose,
}: {
  allSets: CatalogSet[]
  binders: Binder[]
  candidates: CatalogSet[]
  onPick: (s: CatalogSet) => void
  onClose: () => void
}) {
  const [q, setQ] = useState('')
  // フィルタ: number=年 / string=バインダーID(封入・その他) / 'candidates'=印字の候補 / null=未選択
  const [filter, setFilter] = useState<number | string | null>(candidates.length > 0 ? 'candidates' : null)
  const norm = (s: string) => s.normalize('NFKC').toLowerCase()
  const t = norm(q.trim())

  const years = useMemo(
    () => [...new Set(allSets.map((s) => s.year).filter((y): y is number => y != null))].sort((a, b) => b - a),
    [allSets],
  )
  const flatBinders = binders.filter((b) => b.sealed) // 封入・その他（年なし）

  // 表示対象のプール（フィルタ適用）。年度を選ぶと、その中で検索が効く
  let pool: CatalogSet[]
  if (filter === 'candidates') pool = candidates
  else if (typeof filter === 'number') pool = allSets.filter((s) => s.year === filter)
  else if (typeof filter === 'string') pool = allSets.filter((s) => s.binderId === filter)
  else pool = t ? allSets : [] // 未選択なら検索したときだけ全体から

  // 検索: 日英シノニム統一（「バースデーライブ」でも「BIRTHDAY LIVE」でも）＋空白/記号を無視して
  // 部分一致（AND）。まずクエリ全体をシノニム変換（"4th members"→"4期"等の連語も効かせる）→語で分割→
  // 各語から空白記号を落として、同じく空白記号を落としたセット名に含まれるか見る。
  const stripSP = (s: string) => s.replace(/[\s._\-–—・、。,!！?？/｜|©'’]+/g, '')
  const tokens = normalizeForSearch(q.trim()).split(/\s+/).map(stripSP).filter(Boolean)
  const nameMatches = (s: CatalogSet) => {
    const n = stripSP(normalizeForSearch(s.name))
    return tokens.every((tok) => n.includes(tok))
  }
  const scoped = tokens.length > 0 ? pool.filter(nameMatches) : pool
  // 検索語があるのに今の絞り込み内で0件 → 全セットから部分一致で自動的に広げる
  const broadened = tokens.length > 0 && scoped.length === 0 ? allSets.filter(nameMatches) : null
  const results = (broadened ?? scoped).slice(0, 200)

  const Chip = ({ label, active, onTap }: { label: string; active: boolean; onTap: () => void }) => (
    <button
      onClick={onTap}
      className={`shrink-0 h-8 px-3 rounded-full text-[12px] font-medium whitespace-nowrap transition-colors ${
        active ? 'bg-violet-600 text-white' : 'bg-white border border-slate-200 text-slate-500'
      }`}
    >
      {label}
    </button>
  )

  return (
    <SheetShell title="セットを選ぶ" onClose={onClose}>
      <div className="sticky top-[52px] z-10 bg-slate-50 pb-2 -mt-1 pt-1 space-y-2">
        <div className="relative">
          <SearchIcon className="w-5 h-5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={typeof filter === 'number' ? `${filter}年の中を検索` : 'セット名で検索'}
            className="w-full h-11 rounded-xl bg-white border border-slate-200 pl-10 pr-3 text-[15px] outline-none focus:border-violet-400"
          />
        </div>
        {/* 年度・バインダーのチップ（最初から年度で選べる） */}
        <div className="flex gap-1.5 overflow-x-auto pb-0.5 [-webkit-overflow-scrolling:touch]">
          {candidates.length > 0 && <Chip label={`候補${candidates.length}`} active={filter === 'candidates'} onTap={() => setFilter('candidates')} />}
          {years.map((y) => (
            <Chip key={y} label={`${y}`} active={filter === y} onTap={() => setFilter(y)} />
          ))}
          {flatBinders.map((b) => (
            <Chip key={b.id} label={b.name.replace('弓木', '')} active={filter === b.id} onTap={() => setFilter(b.id)} />
          ))}
        </div>
      </div>
      {broadened && (
        <p className="pb-1.5 text-[12px] text-violet-600">この絞り込みに無いので、全セットから「{q.trim()}」を含むものを表示中</p>
      )}
      <div className="divide-y divide-slate-100 pb-2">
        {results.map((s) => (
          <button key={s.id} onClick={() => onPick(s)} className="w-full text-left px-1 py-2.5 text-[14px] text-slate-700 active:bg-slate-50">
            {s.name}
            <span className="block text-[11px] text-slate-400">{s.year ? `${s.year}年` : (binders.find((b) => b.id === s.binderId)?.name ?? '')}</span>
          </button>
        ))}
        {results.length === 0 && (
          <p className="py-8 text-center text-[13px] text-slate-400">{filter === null && !t ? '年度を選ぶか、セット名で検索' : '見つかりません'}</p>
        )}
      </div>
    </SheetShell>
  )
}
