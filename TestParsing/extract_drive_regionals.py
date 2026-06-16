#!/usr/bin/env python3
"""Extract 2022+ regional individual tests from the FAMAT Google Drive test bank."""

from __future__ import annotations

import argparse
import json
import re
import sys
from collections import defaultdict
from pathlib import Path

try:
    import gdown
except ImportError as exc:
    raise SystemExit("Install gdown: pip install gdown") from exc

from apply_folder_answer_keys import (
    get_test_id,
    load_all_answer_keys,
    pick_best,
    solution_key,
)

ROOT = Path(__file__).resolve().parents[1]
FAMAT_PATH = ROOT / "src" / "data" / "famat_tests.json"
IMPORTS_DIR = Path(__file__).resolve().parent / "imports"
MANIFEST_PATH = IMPORTS_DIR / "drive_regionals_manifest.json"
IMPORT_PATH = IMPORTS_DIR / "drive_regionals_import.json"

DRIVE_FOLDER_ID = "1XZ5ONbA2er3-THNmHVK7MIPxEx36lBbv"
DRIVE_FILE_URL = "https://drive.google.com/file/d/{file_id}/view?usp=drive_link"

MONTH_MAP = {
    "jan": "January",
    "january": "January",
    "feb": "February",
    "february": "February",
    "mar": "March",
    "march": "March",
}

DIVISION_PATTERNS: list[tuple[re.Pattern[str], str]] = [
    (re.compile(r"\b(?:algebra\s*1|alg\s*1)\b", re.I), "Alg1"),
    (re.compile(r"\b(?:algebra\s*2|alg\s*2)\b", re.I), "Alg2"),
    (re.compile(r"\b(?:geometry|geo)\b", re.I), "Geo"),
    (re.compile(r"\b(?:calculus|calc)\b", re.I), "Mu"),
    (re.compile(r"\b(?:precalculus|precalc|prec)\b", re.I), "Alpha"),
    (re.compile(r"\b(?:statistics|stats)\b", re.I), "Stats"),
    (re.compile(r"\btheta\b", re.I), "Theta"),
]

YEAR_RE = re.compile(r"(20(?:2[2-9]|3\d))")
MONTH_RE = re.compile(r"\b(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?)\b", re.I)
SKIP_PATH_RE = re.compile(
    r"(invitational|interschool|statewide|\bsw\b|open tests|dostal|hiller|nunn)",
    re.I,
)


def drive_url(file_id: str) -> str:
    return DRIVE_FILE_URL.format(file_id=file_id)


def entry_name(file_id: str, filename: str, document_type: str) -> str:
    prefix = "T" if document_type == "Test" else "S"
    return f"/docs/{file_id} {prefix}_ {filename}"


def parse_division(text: str) -> str | None:
    for pattern, division in DIVISION_PATTERNS:
        if pattern.search(text):
            return division
    return None


def parse_month(text: str) -> str | None:
    match = MONTH_RE.search(text)
    if not match:
        return None
    return MONTH_MAP[match.group(1).lower()[:3]]


def parse_year(text: str) -> int | None:
    match = YEAR_RE.search(text)
    return int(match.group(1)) if match else None


def parse_document_type(filename: str) -> str | None:
    lower = filename.lower()
    if "team" in lower:
        return None
    if re.search(r"(ans(\s*and\s*)?sols|answers?\s+and\s+sol)", lower):
        return "Solution"
    if re.search(r"\bsolutions?\b", lower) and "test" not in lower:
        return "Solution"
    if re.search(r"\btest\b", lower):
        return "Test"
    return None


def is_regional_individual_path(path: str) -> bool:
    lower = path.lower()
    name = lower.split("/")[-1]
    if not name.endswith(".pdf"):
        return False
    if "team" in name:
        return False
    if "indiv" not in name and "individual" not in name:
        return False
    if "reg" not in lower and "regional" not in lower:
        return False
    if SKIP_PATH_RE.search(lower):
        return False
    return True


def list_drive_files(refresh: bool) -> list[dict]:
    if MANIFEST_PATH.exists() and not refresh:
        return json.loads(MANIFEST_PATH.read_text(encoding="utf-8"))

    print("Listing Google Drive folder (may take ~1 min)...", file=sys.stderr)
    files = gdown.download_folder(id=DRIVE_FOLDER_ID, skip_download=True, quiet=True)
    manifest = [{"id": f.id, "path": f.path} for f in files]
    IMPORTS_DIR.mkdir(parents=True, exist_ok=True)
    MANIFEST_PATH.write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
    print(f"Cached {len(manifest)} files to {MANIFEST_PATH.name}", file=sys.stderr)
    return manifest


def build_entries(manifest: list[dict], min_year: int) -> list[dict]:
    entries: list[dict] = []
    for item in manifest:
        path = item["path"]
        if not is_regional_individual_path(path):
            continue

        filename = path.split("/")[-1]
        doc_type = parse_document_type(filename)
        if not doc_type:
            continue

        meta_text = f"{path} {filename}"
        year = parse_year(meta_text)
        month = parse_month(meta_text)
        division = parse_division(meta_text)
        if year is None or month is None or division is None:
            continue
        if year < min_year:
            continue

        file_id = item["id"]
        entries.append(
            {
                "name": entry_name(file_id, filename, doc_type),
                "url": drive_url(file_id),
                "document_type": doc_type,
                "year": year,
                "month": month,
                "test_type": "Regional",
                "division": division,
                "format": "Individual",
                "drive_path": path,
                "drive_file_id": file_id,
            }
        )
    return entries


def merge_into_famat(
    entries: list[dict],
    lookup: dict,
    include_without_keys: bool,
) -> tuple[list[dict], int, list[str]]:
    data = json.loads(FAMAT_PATH.read_text(encoding="utf-8"))
    existing_ids = {get_test_id(e) for e in data if e.get("document_type") == "Test"}
    existing_keys = {solution_key(e) for e in data}

    by_key: dict[tuple, dict[str, list[dict]]] = defaultdict(
        lambda: {"Test": [], "Solution": []}
    )
    for entry in entries:
        key = solution_key(entry)
        by_key[key][entry["document_type"]].append(entry)

    additions: list[dict] = []
    skipped: list[str] = []

    for key in sorted(by_key):
        if key in existing_keys:
            continue
        groups = by_key[key]
        if not groups["Test"] or not groups["Solution"]:
            skipped.append(f"missing pair: {key}")
            continue

        answer = lookup.get(key)
        if not answer:
            if include_without_keys:
                skipped.append(f"no answer key (included anyway): {key}")
            else:
                skipped.append(f"no answer key: {key}")
                continue

        test = dict(pick_best(groups["Test"]))
        solution = dict(pick_best(groups["Solution"]))
        if answer:
            solution["answers"] = answer.answers
            solution["csv_validated"] = True
            solution["csv_source"] = answer.source
            solution["answer_key_file"] = answer.file

        tid = get_test_id(test)
        if tid in existing_ids:
            continue

        for doc in (test, solution):
            doc.pop("drive_path", None)
            doc.pop("drive_file_id", None)

        existing_ids.add(tid)
        existing_keys.add(key)
        additions.extend([test, solution])

    if additions:
        data.extend(additions)
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
            raise SystemExit(f"Duplicate test IDs: {dupes[:10]}")

        FAMAT_PATH.write_text(json.dumps(data, indent=4) + "\n", encoding="utf-8")

    return data, len(additions) // 2, skipped


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--refresh",
        action="store_true",
        help="Re-list Google Drive folder instead of using cached manifest",
    )
    parser.add_argument(
        "--min-year",
        type=int,
        default=2022,
        help="Earliest competition year to include (default: 2022)",
    )
    parser.add_argument(
        "--merge",
        action="store_true",
        help="Merge paired entries with answer keys into famat_tests.json",
    )
    parser.add_argument(
        "--include-without-keys",
        action="store_true",
        help="When merging, include tests even if no spreadsheet answer key exists",
    )
    args = parser.parse_args()

    manifest = list_drive_files(args.refresh)
    entries = build_entries(manifest, args.min_year)
    IMPORTS_DIR.mkdir(parents=True, exist_ok=True)
    IMPORT_PATH.write_text(json.dumps(entries, indent=2) + "\n", encoding="utf-8")
    print(f"Wrote {len(entries)} drive entries to {IMPORT_PATH.name}")

    tests = sum(1 for e in entries if e["document_type"] == "Test")
    solutions = len(entries) - tests
    print(f"Parsed {tests} regional individual tests, {solutions} solution PDFs")

    if args.merge:
        lookup = load_all_answer_keys()
        _, added, skipped = merge_into_famat(
            entries, lookup, args.include_without_keys
        )
        print(f"Merged {added} new regional tests into famat_tests.json")
        if skipped:
            print(f"Skipped {len(skipped)} keys (showing up to 15):")
            for line in skipped[:15]:
                print(f"  - {line}")


if __name__ == "__main__":
    main()
