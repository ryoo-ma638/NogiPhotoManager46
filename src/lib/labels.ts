// 連番の丸数字ラベル（「その他」の種類なし枠＝①②③…に使う）
const CIRCLED = '①②③④⑤⑥⑦⑧⑨⑩⑪⑫⑬⑭⑮⑯⑰⑱⑲⑳'

/** 1始まりの通し番号を丸数字に。21以上はそのまま数字。 */
export const circled = (n: number): string => CIRCLED[n - 1] ?? `${n}`
