#!/usr/bin/env python3
"""Keep only Mu Individual tests that have CSV answer keys; dedupe test IDs.

Deprecated: prefer TestParsing/apply_folder_answer_keys.py, which reads
TestParsing/Folder Answer Keys and updates all divisions.
"""

from __future__ import annotations

import csv
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
FAMAT_PATH = ROOT / "src" / "data" / "famat_tests.json"
CSV_PATH = Path(__file__).resolve().parent / "Calc Reg Season - Sheet1.csv"

MONTH_MAP = {"Jan": "January", "Feb": "February", "Mar": "March"}
COL_RE = re.compile(r"^(Jan|Feb|Mar)(\d{2})(I|R|i)$", re.IGNORECASE)


def parse_csv_column(col: str) -> tuple[str, int, str, str] | None:
    if col in {"CALC", "Joey16"}:
        return None
    match = COL_RE.match(col)
    if not match:
        return None
    month_key = match.group(1).lower()
    month = MONTH_MAP[month_key[:3].title()[:3]]
    if month_key == "jan":
        month = "January"
    elif month_key == "feb":
        month = "February"
    else:
        month = "March"
    year = 2000 + int(match.group(2))
    test_type = "Invitational" if match.group(3).upper() == "I" else "Regional"
    csv_source = col if match.group(3) != "i" else col[:-1] + "i"
    return month, year, test_type, csv_source


ALL_ACCEPTED_ANSWERS = ["A", "B", "C", "D", "E"]


def parse_answer_cell(raw: str) -> str | list[str] | None:
    value = raw.strip()
    value = re.sub(r"\s*\([^)]*\)", "", value).strip()
    if not value:
        return None
    if value.lower() in {"throw", "x"}:
        return list(ALL_ACCEPTED_ANSWERS)
    if value.startswith("*"):
        return list(ALL_ACCEPTED_ANSWERS)
    if "/" in value:
        parts = [p.strip().upper() for p in value.split("/") if p.strip()]
        if len(parts) > 1:
            return parts
        value = parts[0] if parts else ""
    elif len(value) > 1 and value.isalpha():
        return [c.upper() for c in value]
    else:
        value = value.upper()
    if value in {"A", "B", "C", "D", "E"}:
        return value
    return None


def load_csv_answers() -> dict[tuple[str, int, str], tuple[list, str]]:
    lookup: dict[tuple[str, int, str], tuple[list, str]] = {}
    with CSV_PATH.open(newline="", encoding="utf-8") as f:
        rows = list(csv.reader(f))
    headers = rows[0]
    for col_idx, header in enumerate(headers):
        meta = parse_csv_column(header)
        if not meta:
            continue
        month, year, test_type, csv_source = meta
        answers: list = []
        for row in rows[1:]:
            cell = row[col_idx] if col_idx < len(row) else ""
            answers.append(parse_answer_cell(cell))
        if any(a is not None for a in answers):
            lookup[(year, month, test_type)] = (answers, csv_source)
    return lookup


def match_key(entry: dict) -> tuple:
    return (
        entry.get("year"),
        entry.get("month"),
        entry.get("test_type"),
        entry.get("format"),
    )


def get_test_id(entry: dict) -> str:
    month_part = f"-{entry['month']}" if entry.get("month") else ""
    return (
        f"{entry['year']}{month_part}-{entry['division']}-{entry['test_type']}-{entry['format']}"
        .lower()
        .replace(" ", "-")
        .replace("(", "")
        .replace(")", "")
    )


def score_entry(entry: dict) -> int:
    name = entry.get("name", "").lower()
    score = 0
    if re.search(r"\d+\s+t_", entry.get("name", ""), re.I):
        score += 100
    if re.search(r"\d+\s+s_", entry.get("name", ""), re.I):
        score += 100
    if "calculus individual" in name or "calc indiv" in name:
        score += 50
    if "mu open" in name:
        score -= 80
    if any(x in name for x in ("errata", " err", "coverpage", "err.doc")):
        score -= 100
    if entry.get("document_type") == "Test" and "answer" in name:
        score -= 40
    if entry.get("csv_validated"):
        score += 20
    if entry.get("answers"):
        score += 30
    return score


def pick_best(entries: list[dict]) -> dict:
    return max(entries, key=score_entry)


def main() -> None:
    data = json.loads(FAMAT_PATH.read_text(encoding="utf-8"))
    csv_lookup = load_csv_answers()
    allowed_keys = {(y, m, t, "Individual") for (y, m, t) in csv_lookup}

    non_mu = [e for e in data if e.get("division") != "Mu"]
    mu = [e for e in data if e.get("division") == "Mu" and match_key(e) in allowed_keys]

    solutions_by_key: dict[tuple, list[dict]] = {}
    tests_by_key: dict[tuple, list[dict]] = {}

    for entry in mu:
        key = match_key(entry)
        if entry.get("document_type") == "Solution":
            solutions_by_key.setdefault(key, []).append(entry)
        elif entry.get("document_type") == "Test":
            tests_by_key.setdefault(key, []).append(entry)

    kept_mu: list[dict] = []
    for key in sorted(allowed_keys):
        if key not in solutions_by_key or key not in tests_by_key:
            continue

        meta = csv_lookup[(key[0], key[1], key[2])]
        answers, csv_source = meta

        solution = pick_best(solutions_by_key[key])
        solution = dict(solution)
        solution["answers"] = answers
        solution["csv_validated"] = True
        solution["csv_source"] = csv_source

        test = pick_best(tests_by_key[key])
        kept_mu.extend([test, solution])

    merged = non_mu + kept_mu
    merged.sort(
        key=lambda e: (
            e.get("division") or "",
            -(e.get("year") or 0),
            e.get("month") or "",
            e.get("test_type") or "",
            e.get("document_type") or "",
            e.get("name") or "",
        )
    )

    # Verify unique test IDs
    tests = [e for e in merged if e.get("document_type") == "Test"]
    ids = [get_test_id(t) for t in tests]
    dupes = {i for i in ids if ids.count(i) > 1}
    if dupes:
        raise SystemExit(f"Still have duplicate test IDs: {sorted(dupes)}")

    FAMAT_PATH.write_text(json.dumps(merged, indent=4) + "\n", encoding="utf-8")

    mu_tests = [e for e in kept_mu if e["document_type"] == "Test"]
    print(f"Kept {len(non_mu)} non-Mu entries")
    print(f"Kept {len(mu_tests)} Mu Individual tests with CSV answer keys")
    print(f"Kept {len(kept_mu) - len(mu_tests)} matching solutions")
    print(f"Total entries: {len(merged)}")


if __name__ == "__main__":
    main()
