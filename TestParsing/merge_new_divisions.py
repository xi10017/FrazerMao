#!/usr/bin/env python3
"""Merge new division tests (Alg1, Alg2, Geo, Theta) that have PDF pairs + answer keys."""

from __future__ import annotations

import json
import re
from pathlib import Path

from apply_folder_answer_keys import (
    AnswerKey,
    get_test_id,
    load_all_answer_keys,
    pick_best,
    solution_key,
)

ROOT = Path(__file__).resolve().parents[1]
FAMAT_PATH = ROOT / "src" / "data" / "famat_tests.json"
IMPORTS_DIR = Path(__file__).resolve().parent / "imports"

NEW_DIVISIONS = ["Alg1", "Alg2", "Geo", "Theta"]
IMPORT_SLUGS = {
    "Alg1": "alg1_famat_import.json",
    "Alg2": "alg2_famat_import.json",
    "Geo": "geo_famat_import.json",
    "Theta": "theta_famat_import.json",
}
# Theta has no regular-season answer key sheet; include States/Nationals for it.
DIVISION_TEST_TYPES = {
    "Alg1": {"Regional", "Invitational"},
    "Alg2": {"Regional", "Invitational"},
    "Geo": {"Regional", "Invitational"},
    "Theta": {"Regional", "Invitational", "States", "Nationals"},
}


def merge_division(
    data: list[dict],
    division: str,
    imported: list[dict],
    lookup: dict[tuple, AnswerKey],
) -> tuple[list[dict], int]:
    existing_ids = {get_test_id(e) for e in data if e.get("document_type") == "Test"}
    existing_keys = {solution_key(e) for e in data}

    by_key: dict[tuple, dict[str, list[dict]]] = {}
    for entry in imported:
        if entry.get("division") != division:
            continue
        if entry.get("format") != "Individual":
            continue
        if entry.get("test_type") not in DIVISION_TEST_TYPES.get(division, {"Regional", "Invitational"}):
            continue
        key = solution_key(entry)
        if key not in lookup:
            continue
        by_key.setdefault(key, {"Test": [], "Solution": []})
        by_key[key][entry["document_type"]].append(entry)

    additions: list[dict] = []
    for key in sorted(by_key):
        if key in existing_keys:
            continue
        groups = by_key[key]
        if not groups["Test"] or not groups["Solution"]:
            continue

        test = pick_best(groups["Test"])
        solution = dict(pick_best(groups["Solution"]))
        answer = lookup[key]
        solution["answers"] = answer.answers
        solution["csv_validated"] = True
        solution["csv_source"] = answer.source
        solution["answer_key_file"] = answer.file

        tid = get_test_id(test)
        if tid in existing_ids:
            continue
        existing_ids.add(tid)
        existing_keys.add(key)
        additions.extend([test, solution])

    return data + additions, len(additions) // 2


def main() -> None:
    lookup = load_all_answer_keys()
    data = json.loads(FAMAT_PATH.read_text(encoding="utf-8"))

    total_added = 0
    for division in NEW_DIVISIONS:
        import_path = IMPORTS_DIR / IMPORT_SLUGS[division]
        if not import_path.exists():
            print(f"SKIP {division}: missing {import_path.name} (run extract_famat_tests.py --all-new)")
            continue
        imported = json.loads(import_path.read_text(encoding="utf-8"))
        data, added = merge_division(data, division, imported, lookup)
        print(f"{division}: added {added} tests")
        total_added += added

    data.sort(
        key=lambda e: (
            e.get("division") or "",
            -(e.get("year") or 0),
            e.get("month") or "",
            e.get("test_type") or "",
            e.get("document_type") or "",
            e.get("name") or "",
        )
    )

    tests = [e for e in data if e.get("document_type") == "Test"]
    ids = [get_test_id(t) for t in tests]
    dupes = sorted({i for i in ids if ids.count(i) > 1})
    if dupes:
        raise SystemExit(f"Duplicate test IDs: {dupes[:10]} ... ({len(dupes)} total)")

    FAMAT_PATH.write_text(json.dumps(data, indent=4) + "\n", encoding="utf-8")
    print(f"Total: {len(tests)} tests, {total_added} new from {NEW_DIVISIONS}")


if __name__ == "__main__":
    main()
