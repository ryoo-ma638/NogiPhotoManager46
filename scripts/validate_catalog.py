#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""公開カタログJSONの検証。使い方: python3 scripts/validate_catalog.py
チェック: schema必須キー / setID重複 / binderId参照整合 / template既知 / 封入以外はyear必須。
公開JSONに owned が混入していないか（個人データ漏洩防止）も検査する。
"""
import json, sys, pathlib

ROOT = pathlib.Path(__file__).resolve().parent.parent
TEMPLATES = {"standard3": 3, "four4": 4, "five5": 5, "rareSet8": 8, "event6": 6, "single1": 1}

def main():
    path = ROOT / "public" / "catalog" / "yumiki_nao.json"
    data = json.loads(path.read_text(encoding="utf-8"))
    errs = []
    for k in ("schemaVersion", "catalogVersion", "member", "binders", "sets"):
        if k not in data:
            errs.append(f"必須キー欠落: {k}")
    binder_ids = {b["id"] for b in data.get("binders", [])}
    sealed = {b["id"] for b in data.get("binders", []) if b.get("sealed")}
    seen = set()
    photo_slots = 0
    for s in data.get("sets", []):
        sid = s.get("id")
        if sid in seen:
            errs.append(f"setID重複: {sid}")
        seen.add(sid)
        if s.get("binderId") not in binder_ids:
            errs.append(f"binderId不明: {sid} → {s.get('binderId')}")
        if s.get("template") not in TEMPLATES:
            errs.append(f"template不明: {sid} → {s.get('template')}")
        else:
            photo_slots += TEMPLATES[s["template"]]
        if s.get("binderId") not in sealed and s.get("year") is None:
            errs.append(f"year欠落(封入以外): {sid}")
        # 公開JSONに所有情報が混入していないか
        for leak in ("owned", "isOwned", "ownership"):
            if leak in s:
                errs.append(f"★所有情報が公開JSONに混入: {sid}.{leak}")

    print(f"検証: セット{len(data.get('sets', []))} / 写真枠{photo_slots} / バインダー{len(binder_ids)}")
    if errs:
        print(f"NG: {len(errs)}件")
        for e in errs:
            print("  ", e)
        sys.exit(1)
    print("OK ✓ 問題なし")

if __name__ == "__main__":
    main()
