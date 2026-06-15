#!/usr/bin/env python3
"""Merge calculus Individual tests into src/data/famat_tests.json."""

from __future__ import annotations

import csv
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
FAMAT_PATH = ROOT / "src" / "data" / "famat_tests.json"
IMPORT_PATH = Path(__file__).resolve().parent / "calculus_famat_import.json"
CSV_PATH = Path(__file__).resolve().parent / "Calc Reg Season - Sheet1.csv"

MONTH_MAP = {"Jan": "January", "Feb": "February", "Mar": "March"}
COL_RE = re.compile(r"^(Jan|Feb|Mar)(\d{2})(I|R|i)$", re.IGNORECASE)


def parse_csv_column(col: str) -> tuple[str, int, str, str] | None:
    if col in {"CALC", "Joey16"}:
        return None
    match = COL_RE.match(col)
    if not match:
        return None
    month = MONTH_MAP[match.group(1).title()[:3]]
    if match.group(1).lower() == "jan":
        month = "January"
    elif match.group(1).lower() == "feb":
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


def load_csv_answers() -> dict[str, list[str | list[str] | None]]:
    answers_by_source: dict[str, list[str | list[str] | None]] = {}
    with CSV_PATH.open(newline="", encoding="utf-8") as f:
        rows = list(csv.reader(f))
    if not rows:
        return answers_by_source

    headers = rows[0]
    for col_idx, header in enumerate(headers):
        meta = parse_csv_column(header)
        if not meta:
            continue
        _, _, _, csv_source = meta
        key_answers: list[str | list[str] | None] = []
        for row in rows[1:]:
            if col_idx >= len(row):
                key_answers.append(None)
                continue
            key_answers.append(parse_answer_cell(row[col_idx]))
        if any(a is not None for a in key_answers):
            answers_by_source[csv_source] = key_answers
    return answers_by_source


def entry_key(entry: dict) -> str:
    return "|".join(
        [
            str(entry.get("document_type")),
            str(entry.get("year")),
            str(entry.get("month")),
            str(entry.get("division")),
            str(entry.get("test_type")),
            str(entry.get("format")),
            str(entry.get("url")),
        ]
    )


def test_match_key(entry: dict) -> str:
    return "|".join(
        [
            str(entry.get("year")),
            str(entry.get("month")),
            str(entry.get("division")),
            str(entry.get("test_type")),
            str(entry.get("format")),
        ]
    )


def attach_csv_answers(solution: dict, csv_answers: dict[str, list]) -> dict:
    for csv_source, answers in csv_answers.items():
        meta = parse_csv_column(csv_source)
        if not meta:
            continue
        month, year, test_type, _ = meta
        if (
            solution.get("document_type") == "Solution"
            and solution.get("division") == "Mu"
            and solution.get("format") == "Individual"
            and solution.get("year") == year
            and solution.get("month") == month
            and solution.get("test_type") == test_type
        ):
            solution = dict(solution)
            solution["answers"] = answers
            solution["csv_validated"] = True
            solution["csv_source"] = csv_source
            return solution
    return solution


def main() -> None:
    existing = json.loads(FAMAT_PATH.read_text(encoding="utf-8"))
    imported = json.loads(IMPORT_PATH.read_text(encoding="utf-8"))
    csv_answers = load_csv_answers()

    individual = [e for e in imported if e.get("format") == "Individual"]
    existing_urls = {e.get("url") for e in existing if e.get("url")}
    existing_keys = {entry_key(e) for e in existing}

    to_add = []
    for entry in individual:
        if entry.get("url") in existing_urls:
            continue
        if entry_key(entry) in existing_keys:
            continue
        if entry.get("document_type") == "Solution":
            entry = attach_csv_answers(entry, csv_answers)
        to_add.append(entry)

    merged = existing + to_add
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

    FAMAT_PATH.write_text(json.dumps(merged, indent=4) + "\n", encoding="utf-8")

    tests = [e for e in to_add if e.get("document_type") == "Test"]
    solutions = [e for e in to_add if e.get("document_type") == "Solution"]
    with_answers = [e for e in solutions if e.get("answers")]

    print(f"Existing entries: {len(existing)}")
    print(f"Added entries: {len(to_add)} ({len(tests)} tests, {len(solutions)} solutions)")
    print(f"Solutions with CSV answers: {len(with_answers)}")
    print(f"Total entries: {len(merged)}")

    # Warn about tests missing a solution partner
    solution_keys = {
        test_match_key(e) for e in merged if e.get("document_type") == "Solution"
    }
    missing = [
        e
        for e in merged
        if e.get("document_type") == "Test"
        and e.get("division") == "Mu"
        and e.get("format") == "Individual"
        and test_match_key(e) not in solution_keys
    ]
    if missing:
        print(f"WARNING: {len(missing)} Mu Individual tests still lack a solution entry")


if __name__ == "__main__":
    main()
