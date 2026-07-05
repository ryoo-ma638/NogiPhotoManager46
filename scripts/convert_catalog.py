#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""カタログ原文(catalog-source.txt) → 公開カタログJSON + 非公開所有JSON + 要確認レポート。
使い方: python3 scripts/convert_catalog.py
出力:
  catalog/yumiki_nao.json          … 公開（所有を含まない）
  yumiki_nao.ownership.json        … 非公開（gitignore）。所有している写真IDの一覧
  標準出力に集計と「要確認」項目
"""
import re, json, sys, pathlib

MEMBER_ID = "yumiki_nao"
MEMBER_NAME = "弓木奈於"
ROOT = pathlib.Path(__file__).resolve().parent.parent
SRC = ROOT / "catalog-source.txt"

# テンプレ定義: slotコード, 表示ラベル, レアリティ
STD3 = [("yori", "ヨリ", "normal"), ("chu", "チュウ", "normal"), ("hiki", "ヒキ", "normal")]
TEMPLATES = {
    "standard3": STD3,
    "five5": STD3 + [("suwari-yori", "座りヨリ", "normal"), ("suwari-hiki", "座りヒキ", "normal")],
    "rareSet8": STD3 + [("r1", "R", "R"), ("sr1", "SR①", "SR"), ("sr2", "SR②", "SR"), ("sr3", "SR③", "SR"), ("sr4", "SR④", "SR")],
    "event6": [(f"p{i}", "①②③④⑤⑥"[i - 1], "normal") for i in range(1, 7)],
    "four4": [("A", "A", "normal"), ("B", "B", "normal"), ("C", "C", "normal"), ("D", "D", "normal")],
    "single1": [("p1", "①", "normal")],
}
# 種類数 → テンプレ（8はrareフラグで判定）。4種は封入(A/B/C/D)
COUNT_TO_TEMPLATE = {3: "standard3", 4: "four4", 5: "five5", 6: "event6", 1: "single1"}
# 末尾注記の語 → slot（長い語を先に）
NOTE_TOKENS = [("座りヨリ", "suwari-yori"), ("座りヒキ", "suwari-hiki"), ("ヨリ", "yori"), ("チュウ", "chu"), ("ヒキ", "hiki")]

KIND_RE = re.compile(r"（(\d+)種類?）")

def detect_kind(name, template, sealed):
    """セットの種類タグ。アプリの絞り込みに使う（src/lib/kinds.ts と同じ規則にすること）"""
    if sealed:
        return "sealed"       # 封入
    if "ミニ生写真" in name:
        return "mini"         # ミニ生写真
    if "Tシャツ" in name:
        return "tshirt"       # ライブT等
    if ("MV" in name) or ("選抜ver" in name) or ("アンダーver" in name):
        return "mv"           # MV・楽曲ver.系
    if template == "rareSet8":
        return "rare8"        # 8種（R/SR入り）
    if template == "five5":
        # 座りヨリ/座りヒキがあるのは浴衣とバスラ（周年記念）だけ。
        # それ以外の5種（クリスマス/ハロウィン/バレンタイン等）は①〜⑤の5枚セット
        if ("浴衣" in name) or ("周年記念" in name):
            return "suwari"   # 座りあり5種
        return "five"         # 5種セット（①〜⑤）
    if template == "event6":
        return "event"        # 6種イベント
    return "normal"           # 通常（3種コーデ等）

# MV系5種のポーズ表示名（slotは変えない＝所有IDを壊さない）
MV5_LABELS = ["①", "②", "③", "④", "⑤"]

# 既存セットのバインダー移動（※行の位置=IDなので原文の行は絶対に動かさない。ここで移す）
BINDER_OVERRIDES = {
    "乃木坂配信中限定！MV衣装生写真（Same numbers）": "b-other",  # 配信限定系は「その他」へ
}

def parse_note_to_slots(note):
    """注記 → (欠けslot集合, 未解釈の残り文字列)。残りが空なら綺麗に解釈できた。"""
    slots, rest = [], note
    for word, slot in NOTE_TOKENS:
        if word in rest:
            slots.append(slot)
            rest = rest.replace(word, "")
    rest = re.sub(r"[、,\s・]+", "", rest)
    return slots, rest

def main():
    lines = SRC.read_text(encoding="utf-8").splitlines()
    binders, sets = [], []
    cur_binder = None
    cur_year = None
    review = []          # 要確認メッセージ
    partial_notes = []   # ◦+注記の解釈一覧（ユーザー確認用）
    owned_ids = []       # 所有している写真ID
    seq = 0

    for raw in lines:
        line = raw.rstrip()
        if not line or line.startswith("#"):
            continue
        if line.startswith("BINDER"):
            _, bid, bname = line.split(" ", 2)
            cur_binder = bid
            cur_year = None  # バインダーが変わったら年をリセット（封入は年なし）
            # sealed=年層なしのフラット表示（封入・その他）
            binders.append({"id": bid, "name": bname, "sortIndex": len(binders), "sealed": ("封入" in bname) or ("その他" in bname)})
            continue
        if line.startswith("YEAR"):
            cur_year = int(line.split(" ", 1)[1])
            continue
        if line.startswith("PAGE"):
            if sets:
                sets[-1]["pageBreakAfter"] = True
            continue
        mark = line[0]
        if mark not in ("✓", "◦"):
            review.append(f"[書式不明] {line}")
            continue
        content = line[1:].strip()

        is_rare = "通常3種" in content  # （通常3種+R1種+SR4種）系＝8種
        m = KIND_RE.search(content)
        if m:
            count = int(m.group(1))
            name = content[:m.start()].strip()
            rest = content[m.end():].strip()
        elif is_rare:
            # （8種類）表記が無く（通常3種+R1種+SR4種）だけのケース（例: 落とし物）
            rm = re.search(r"（通常[^）]*）", content)
            count = 8
            name = content[:rm.start()].strip()
            rest = content[rm.end():].strip()
        else:
            # 種類数が抜けている行（例: バルーンスカート）→ standard3で仮置き
            review.append(f"[種類数なし→standard3で仮置き] {content}")
            count = 3
            name = content
            rest = ""
        if rest.startswith("（通常"):
            rest = re.sub(r"^（[^）]*）", "", rest).strip()
        notes = rest or None

        if is_rare:
            template = "rareSet8"
        else:
            template = COUNT_TO_TEMPLATE.get(count)
            if template is None:
                template = "standard3"
                review.append(f"[種類数{count}=未対応テンプレ→standard3で仮置き] {name}")

        seq += 1
        set_id = f"s{seq:04d}"
        slots = TEMPLATES[template]
        binder_id = BINDER_OVERRIDES.get(name, cur_binder)
        is_flat = any(b["id"] == binder_id and b.get("sealed") for b in binders)
        # kind=sealed は本当の封入だけ（「その他」の配信限定MV等は名前からmv等に）
        kind = detect_kind(name, template, binder_id == "b-sealed")
        entry = {
            "id": set_id, "binderId": binder_id, "year": None if is_flat else cur_year,
            "name": name, "template": template, "kind": kind,
            "sortIndex": seq * 10, "note": notes, "pageBreakAfter": False,
        }
        # 「その他」バインダー（配信限定等）はレアリティ「その他」
        if binder_id == "b-other":
            entry["photos"] = [
                {"slot": s[0], "label": s[1], "rarity": "other"} for s in slots
            ]
        # 座りあり以外の5種は表示名を①〜⑤に（slot/所有IDは不変）
        elif template == "five5" and kind != "suwari":
            entry["photos"] = [
                {"slot": s[0], "label": MV5_LABELS[i], "rarity": s[2]}
                for i, s in enumerate(slots)
            ]
        sets.append(entry)

        # ---- 所有判定 ----
        all_slot_ids = [s[0] for s in slots]
        pid = lambda slot: f"{MEMBER_ID}:{set_id}:{slot}"
        if mark == "✓":
            # ✓ = 通常ポーズを所有。8種のR/SRは✓でも所有としない（別管理→オーバーライドで付与）
            normal_ids = [s[0] for s in slots if s[2] == "normal"]
            for s in normal_ids:
                owned_ids.append(pid(s))
            if notes:
                review.append(f"[✓なのに注記あり→通常ポーズのみ所有で仮置き] {name}（注記: {notes}）")
        else:  # ◦
            if not notes:
                pass  # 全て未所有
            else:
                missing, leftover = parse_note_to_slots(notes)
                unknown_slot = [s for s in missing if s not in all_slot_ids]
                if leftover or unknown_slot:
                    review.append(f"[◦注記を解釈できず→全未所有で仮置き] {name}（注記: {notes} / 未解釈: {leftover or unknown_slot}）")
                else:
                    # 注記=通常ポーズの「欠け」。所有=通常ポーズのうち注記に無いもの。
                    # R/SR等のレア枠は✓(コンプ)以外は所有としない（別途手動管理）。
                    normal_ids = [s[0] for s in slots if s[2] == "normal"]
                    rare_ids = [s[0] for s in slots if s[2] != "normal"]
                    owned = [s for s in normal_ids if s not in missing]
                    for s in owned:
                        owned_ids.append(pid(s))
                    partial_notes.append((name, notes, list(missing) + rare_ids, owned))

    # ---- 所有オーバーライド（R/SR等の個別指定。非公開ファイル、ルール判定より優先） ----
    LABEL2SLOT = {"ヨリ": "yori", "チュウ": "chu", "ヒキ": "hiki", "座りヨリ": "suwari-yori",
                  "座りヒキ": "suwari-hiki", "R": "r1", "SR": "sr1", "SR①": "sr1", "SR②": "sr2",
                  "SR③": "sr3", "SR④": "sr4", "A": "A", "B": "B", "C": "C", "D": "D"}
    ov_path = ROOT / "ownership-overrides.txt"
    owned_set = set(owned_ids)
    ov_applied = ov_skipped = 0
    if ov_path.exists():
        for line in ov_path.read_text(encoding="utf-8").splitlines():
            line = line.split("#", 1)[0].strip()  # 行内コメントも除去
            if not line:
                continue
            key, _, rhs = line.partition("=")
            key = key.strip()
            labels = [x.strip() for x in rhs.split(",") if x.strip()]
            if re.fullmatch(r"s\d+", key):  # setID直接指定（同名セットの区別用）
                matches = [s for s in sets if s["id"] == key]
            else:
                matches = [s for s in sets if s["name"] == key] or [s for s in sets if key in s["name"]]
            if len(matches) == 0:
                ov_skipped += 1  # まだ生成していないバインダーのセット→後で適用
                continue
            if len(matches) > 1:
                review.append(f"[override照合が複数] {key} → {len(matches)}件。名前を具体化してください")
                continue
            s = matches[0]
            prefix = f"{MEMBER_ID}:{s['id']}:"
            owned_set = {o for o in owned_set if not o.startswith(prefix)}
            for lb in labels:
                slot = LABEL2SLOT.get(lb)
                if slot:
                    owned_set.add(prefix + slot)
                else:
                    review.append(f"[override未知ラベル] {key}: {lb}")
            ov_applied += 1
    owned_ids = sorted(owned_set)

    catalog = {
        "schemaVersion": 1, "catalogVersion": 1,
        "member": {"id": MEMBER_ID, "name": MEMBER_NAME},
        "binders": binders, "sets": sets,
    }
    (ROOT / "public" / "catalog").mkdir(parents=True, exist_ok=True)
    (ROOT / "public" / "catalog" / f"{MEMBER_ID}.json").write_text(
        json.dumps(catalog, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    ownership = {"member": MEMBER_ID, "generatedFrom": "catalog-source.txt", "ownedDate": None, "owned": owned_ids}
    (ROOT / f"{MEMBER_ID}.ownership.json").write_text(
        json.dumps(ownership, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    # ---- 集計出力 ----
    total_slots = sum(len(TEMPLATES[s["template"]]) for s in sets)
    by_year = {}
    for s in sets:
        y = s["year"]
        d = by_year.setdefault(y, {"sets": 0, "full": 0, "partial": 0, "none": 0})
        d["sets"] += 1
    # full/partial/none は写真所有から再計算
    owned_set = set(owned_ids)
    for s in sets:
        y = s["year"]
        ids = [f"{MEMBER_ID}:{s['id']}:{sl[0]}" for sl in TEMPLATES[s["template"]]]
        n = sum(1 for i in ids if i in owned_set)
        d = by_year[y]
        if n == 0:
            d["none"] += 1
        elif n == len(ids):
            d["full"] += 1
        else:
            d["partial"] += 1

    print(f"=== 変換結果 ===")
    print(f"バインダー: {len(binders)} / セット: {len(sets)} / 写真枠: {total_slots} / 所有: {len(owned_ids)}")
    print(f"オーバーライド: 適用{ov_applied} / 未生成セットのためスキップ{ov_skipped}")
    for y in sorted(by_year, key=lambda k: (k is None, k or 0)):
        d = by_year[y]
        label = "封入" if y is None else f"{y}"
        print(f"  {label}: セット{d['sets']}  完所有{d['full']}  一部所有{d['partial']}  未所有{d['none']}")
    print(f"\n=== ◦+注記（欠け）の解釈 {len(partial_notes)}件（要確認） ===")
    for name, notes, missing, owned in partial_notes:
        print(f"  ・{name}（注記:{notes}）→ 欠け={missing} / 所有={owned}")
    print(f"\n=== 要確認レポート {len(review)}件 ===")
    for r in review:
        print("  ", r)
    if not review:
        print("  なし")

if __name__ == "__main__":
    main()
