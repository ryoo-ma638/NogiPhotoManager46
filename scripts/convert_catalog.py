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
    "single1": [("p1", "封入", "normal")],
}
# 種類数 → テンプレ（8はrareフラグで判定）
COUNT_TO_TEMPLATE = {3: "standard3", 5: "five5", 6: "event6", 1: "single1"}
# 末尾注記の語 → slot（長い語を先に）
NOTE_TOKENS = [("座りヨリ", "suwari-yori"), ("座りヒキ", "suwari-hiki"), ("ヨリ", "yori"), ("チュウ", "chu"), ("ヒキ", "hiki")]

KIND_RE = re.compile(r"（(\d+)種類?）")

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
            binders.append({"id": bid, "name": bname, "sortIndex": len(binders), "sealed": False})
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

        m = KIND_RE.search(content)
        if not m:
            review.append(f"[種類数なし] {content}")
            continue
        count = int(m.group(1))
        name = content[:m.start()].strip()
        rest = content[m.end():].strip()

        # rareSet8: 直後の（通常…）を消費
        is_rare = rest.startswith("（通常") or "通常3種" in rest
        if is_rare:
            rest = re.sub(r"^（[^）]*）", "", rest).strip()
        notes = rest or None

        if is_rare and count == 8:
            template = "rareSet8"
        else:
            template = COUNT_TO_TEMPLATE.get(count)
        if template is None:
            template = "standard3"
            review.append(f"[種類数{count}=未対応テンプレ→standard3で仮置き] {name}")

        seq += 1
        set_id = f"s{seq:04d}"
        slots = TEMPLATES[template]
        sets.append({
            "id": set_id, "binderId": cur_binder, "year": cur_year,
            "name": name, "template": template,
            "sortIndex": seq * 10, "note": notes, "pageBreakAfter": False,
        })

        # ---- 所有判定 ----
        all_slot_ids = [s[0] for s in slots]
        pid = lambda slot: f"{MEMBER_ID}:{set_id}:{slot}"
        if mark == "✓":
            for s in all_slot_ids:
                owned_ids.append(pid(s))
            if notes:
                review.append(f"[✓なのに注記あり→全所有で仮置き] {name}（注記: {notes}）")
        else:  # ◦
            if not notes:
                pass  # 全て未所有
            else:
                missing, leftover = parse_note_to_slots(notes)
                unknown_slot = [s for s in missing if s not in all_slot_ids]
                if leftover or unknown_slot:
                    review.append(f"[◦注記を解釈できず→全未所有で仮置き] {name}（注記: {notes} / 未解釈: {leftover or unknown_slot}）")
                else:
                    owned = [s for s in all_slot_ids if s not in missing]
                    for s in owned:
                        owned_ids.append(pid(s))
                    partial_notes.append((name, notes, list(missing), owned))

    catalog = {
        "schemaVersion": 1, "catalogVersion": 1,
        "member": {"id": MEMBER_ID, "name": MEMBER_NAME},
        "binders": binders, "sets": sets,
    }
    (ROOT / "catalog").mkdir(exist_ok=True)
    (ROOT / "catalog" / f"{MEMBER_ID}.json").write_text(
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
    for y in sorted(by_year):
        d = by_year[y]
        print(f"  {y}: セット{d['sets']}  完所有{d['full']}  一部所有{d['partial']}  未所有{d['none']}")
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
