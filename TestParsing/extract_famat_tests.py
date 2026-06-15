#!/usr/bin/env python3
"""Extract FAMAT tests for any division level and resolve /docs/ URLs."""

from __future__ import annotations

import argparse
import json
import re
import sys
import urllib.parse
import urllib.request
from pathlib import Path

BASE_URL = "https://tests.famat.org/"
DOCS_BASE = "https://tests.famat.org/docs/"
DOWNLOAD_BASE = "https://tests.famat.org/scripts/download.php?tid="

LEVEL_TO_DIVISION = {
    "Algebra I": "Alg1",
    "Algebra II": "Alg2",
    "Geometry": "Geo",
    "Theta": "Theta",
    "Calculus/Mu": "Mu",
    "Precalculus/Alpha": "Alpha",
    "Statistics": "Stats",
}

TABLE_RE = re.compile(
    r'<table class="table table-bordered"[^>]*>(.*?)</table>',
    re.DOTALL | re.IGNORECASE,
)
TEST_ID_RE = re.compile(r"Test ID:\s*(\d+)", re.IGNORECASE)
YEAR_RE = re.compile(r"<i>(\d{4}|0)</i>")
DOWNLOAD_RE = re.compile(
    r"<a href='scripts/download\.php\?tid=(\d+)'[^>]*>([^<]+)</a>",
    re.IGNORECASE,
)
FIELD_RE = re.compile(
    r"<td><b>(Level|Style|Calculator|Host)</b></td>\s*<td>([^<]+)</td>",
    re.IGNORECASE,
)
CATEGORY_RE = re.compile(
    r"<thead><tr>\s*<th>.*?</th>\s*<th><i>([^<]+)</i></th>",
    re.DOTALL | re.IGNORECASE,
)
DOCS_HREF_RE = re.compile(r'href="/docs/([^"]+)"', re.IGNORECASE)
DISPOSITION_RE = re.compile(
    r'filename\*?=(?:UTF-8\'\')?"?([^";]+)"?',
    re.IGNORECASE,
)


def normalize_famat_document_filename(filename: str) -> str:
    """FAMAT indexes some Word files with a fake .doc.pdf / .docx.pdf suffix."""
    lower = filename.lower()
    if lower.endswith(".doc.pdf") or lower.endswith(".docx.pdf"):
        return filename[:-4]
    return filename


def document_entry(filename: str, **extra: str) -> dict[str, str]:
    filename = normalize_famat_document_filename(filename)
    entry = {
        "filename": filename,
        "name": f"/docs/{filename}",
        "url": DOCS_BASE + urllib.parse.quote(filename),
    }
    entry.update(extra)
    return entry


def fetch_url(url: str, method: str = "GET") -> tuple[int, dict[str, str], bytes]:
    req = urllib.request.Request(
        url, method=method, headers={"User-Agent": "MuPractice/1.0"}
    )
    with urllib.request.urlopen(req, timeout=120) as resp:
        headers = {k.lower(): v for k, v in resp.headers.items()}
        body = b"" if method == "HEAD" else resp.read()
        return resp.status, headers, body


def fetch_search_results(
    level: str,
    style: str | None = None,
    category: str | None = None,
    year: int | None = None,
) -> str:
    params: dict[str, str] = {"level": level, "submit": "Search"}
    if style:
        params["style"] = style
    if category:
        params["category"] = category
    if year is not None:
        params["year"] = str(year)

    url = BASE_URL + "?" + urllib.parse.urlencode(params)
    _, _, body = fetch_url(url)
    return body.decode("utf-8", errors="replace")


def fetch_docs_index() -> dict[int, dict[str, str]]:
    print("Fetching /docs/ index...", file=sys.stderr)
    _, _, body = fetch_url(f"{BASE_URL}docs/")
    html = body.decode("utf-8", errors="replace")
    index: dict[int, dict[str, str]] = {}

    for encoded_path in DOCS_HREF_RE.findall(html):
        filename = urllib.parse.unquote(encoded_path)
        if not filename.lower().endswith(".pdf"):
            continue
        tid_match = re.match(r"^(\d+)\s", filename)
        if not tid_match:
            continue
        tid = int(tid_match.group(1))
        index[tid] = document_entry(filename, resolved_via="docs_index")
    print(f"Indexed {len(index)} PDFs by document id", file=sys.stderr)
    return index


def resolve_tid_via_download(tid: int) -> dict[str, str] | None:
    try:
        status, headers, _ = fetch_url(f"{DOWNLOAD_BASE}{tid}", method="HEAD")
    except Exception:
        return None
    if status != 200:
        return None

    disposition = headers.get("content-disposition", "")
    match = DISPOSITION_RE.search(disposition)
    if not match:
        return None

    filename = normalize_famat_document_filename(match.group(1).strip())
    if not filename.lower().endswith(".pdf") and not re.search(
        r"\.docx?$", filename, re.I
    ):
        filename += ".pdf"

    return document_entry(filename, resolved_via="download.php")


def resolve_tid(tid: int, docs_index: dict[int, dict[str, str]]) -> dict[str, str] | None:
    if tid in docs_index:
        result = dict(docs_index[tid])
        result["resolved_via"] = "docs_index"
        return result
    return resolve_tid_via_download(tid)


def parse_table(table_html: str) -> dict | None:
    test_id_match = TEST_ID_RE.search(table_html)
    year_match = YEAR_RE.search(table_html)
    category_match = CATEGORY_RE.search(table_html)

    if not test_id_match:
        return None

    record: dict = {
        "test_id": int(test_id_match.group(1)),
        "year": int(year_match.group(1)) if year_match else None,
        "category": category_match.group(1).strip() if category_match else None,
        "level": None,
        "style": None,
        "calculator": None,
        "host": None,
        "downloads": {},
    }

    for field, value in FIELD_RE.findall(table_html):
        record[field.lower()] = value.strip()

    for tid, label in DOWNLOAD_RE.findall(table_html):
        record["downloads"][label.strip()] = int(tid)

    return record


def parse_results(html: str, level: str) -> list[dict]:
    results = []
    for block in TABLE_RE.findall(html):
        parsed = parse_table(block)
        if parsed and parsed.get("level") == level:
            results.append(parsed)
    return results


def normalize_category(category: str) -> tuple[str, str | None]:
    if category.startswith("Regionals - "):
        return "Regional", category.replace("Regionals - ", "")
    if category.startswith("Invitationals - "):
        return "Invitational", category.replace("Invitationals - ", "")
    if category == "States":
        return "States", None
    if category == "Nationals":
        return "Nationals", None
    if category == "Mail-in":
        return "Mail-in", None
    return category, None


def infer_document_type(label: str, filename: str) -> str:
    label_l = label.lower()
    name_l = filename.lower()
    if label_l == "test" or re.search(r"\bt[_\s]", name_l) or " test" in name_l:
        return "Test"
    if label_l in {"solutions", "answers"} or name_l.startswith("s_") or name_l.startswith("a_"):
        return "Solution"
    if "condensed" in label_l or name_l.startswith("c_"):
        return "Test"
    return "Test" if "test" in label_l else "Solution"


def infer_format(style: str | None, label: str, filename: str) -> str:
    if style == "(Individual)":
        return "Individual"
    if style == "(Team)":
        return "Team"
    name_l = filename.lower()
    if "individual" in name_l or "indiv" in name_l:
        return "Individual"
    if "team" in name_l or "condensed" in name_l:
        return "Team"
    if "condensed" in label.lower():
        return "Team"
    return style or "Individual"


def to_famat_entry(
    meta: dict,
    label: str,
    tid: int,
    doc: dict[str, str],
    division: str,
) -> dict:
    test_type, month = normalize_category(meta.get("category") or "?")
    year = meta.get("year") if meta.get("year") not in (None, 0) else None

    return {
        "name": doc["name"],
        "url": doc["url"],
        "document_type": infer_document_type(label, doc["filename"]),
        "year": year,
        "month": month,
        "test_type": test_type,
        "division": division,
        "format": infer_format(meta.get("style"), label, doc["filename"]),
    }


def extract_level(level: str, out_dir: Path, docs_index: dict[int, dict[str, str]]) -> int:
    division = LEVEL_TO_DIVISION[level]
    slug = division.lower().replace(" ", "_")

    print(f"Fetching {level} ({division}) tests...", file=sys.stderr)
    all_tests = parse_results(fetch_search_results(level=level), level)
    individual_tests = parse_results(
        fetch_search_results(level=level, style="(Individual)"), level
    )

    seen: set[int] = set()
    unique: list[dict] = []
    for t in all_tests:
        tid = t["test_id"]
        if tid not in seen:
            seen.add(tid)
            unique.append(t)

    individual_ids = {t["test_id"] for t in individual_tests}
    all_tids: set[int] = set()
    for t in unique:
        all_tids.update(t.get("downloads", {}).values())

    tid_cache: dict[int, dict[str, str] | None] = {}
    for i, tid in enumerate(sorted(all_tids)):
        if i and i % 100 == 0:
            print(f"  Resolved {i}/{len(all_tids)} document tids...", file=sys.stderr)
        tid_cache[tid] = resolve_tid(tid, docs_index)

    famat_import = []
    unresolved = 0
    for t in unique:
        downloads = t.get("downloads") or {}
        for label, tid in downloads.items():
            doc = tid_cache.get(tid)
            if not doc:
                unresolved += 1
                continue
            famat_import.append(
                to_famat_entry(
                    {
                        **t,
                        "category": t.get("category"),
                        "year": t.get("year"),
                        "style": t.get("style"),
                    },
                    label,
                    tid,
                    doc,
                    division,
                )
            )

    famat_import.sort(
        key=lambda e: (
            e.get("year") or 9999,
            e.get("month") or "",
            e.get("test_type") or "",
            e.get("document_type") or "",
            e.get("name") or "",
        )
    )

    imports_dir = out_dir / "imports"
    imports_dir.mkdir(exist_ok=True)
    import_path = imports_dir / f"{slug}_famat_import.json"
    import_path.write_text(json.dumps(famat_import, indent=2) + "\n", encoding="utf-8")

    tests = [e for e in famat_import if e["document_type"] == "Test" and e["format"] == "Individual"]
    solutions = [e for e in famat_import if e["document_type"] == "Solution" and e["format"] == "Individual"]
    print(
        f"  Wrote {len(famat_import)} entries ({len(tests)} individual tests, "
        f"{len(solutions)} solutions) to {import_path.name}",
        file=sys.stderr,
    )
    if unresolved:
        print(f"  WARNING: {unresolved} downloads unresolved", file=sys.stderr)
    return len(famat_import)


def main() -> int:
    parser = argparse.ArgumentParser(description="Extract FAMAT tests for a division level")
    parser.add_argument(
        "--level",
        action="append",
        dest="levels",
        choices=list(LEVEL_TO_DIVISION),
        help="FAMAT level to extract (repeatable)",
    )
    parser.add_argument(
        "--all-new",
        action="store_true",
        help="Extract Algebra I, Algebra II, Geometry, and Theta",
    )
    args = parser.parse_args()

    if args.all_new:
        levels = ["Algebra I", "Algebra II", "Geometry", "Theta"]
    elif args.levels:
        levels = args.levels
    else:
        parser.error("Specify --level or --all-new")

    out_dir = Path(__file__).resolve().parent
    docs_index = fetch_docs_index()
    total = 0
    for level in levels:
        total += extract_level(level, out_dir, docs_index)
    print(f"Done. {total} total entries across {len(levels)} level(s).", file=sys.stderr)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
