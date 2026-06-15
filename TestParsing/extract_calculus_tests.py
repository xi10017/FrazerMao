#!/usr/bin/env python3
"""Extract calculus tests from tests.famat.org and resolve /docs/ URLs for famat_tests.json."""

from __future__ import annotations

import json
import re
import sys
import urllib.parse
import urllib.request
from pathlib import Path

BASE_URL = "https://tests.famat.org/"
DOCS_BASE = "https://tests.famat.org/docs/"
DOWNLOAD_BASE = "https://tests.famat.org/scripts/download.php?tid="

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


def fetch_url(url: str, method: str = "GET") -> tuple[int, dict[str, str], bytes]:
    req = urllib.request.Request(
        url, method=method, headers={"User-Agent": "MuPractice/1.0"}
    )
    with urllib.request.urlopen(req, timeout=120) as resp:
        headers = {k.lower(): v for k, v in resp.headers.items()}
        body = b"" if method == "HEAD" else resp.read()
        return resp.status, headers, body


def fetch_search_results(
    level: str = "Calculus/Mu",
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
        index[tid] = {
            "filename": filename,
            "name": f"/docs/{filename}",
            "url": DOCS_BASE + urllib.parse.quote(filename),
        }
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

    filename = match.group(1).strip()
    if not filename.lower().endswith(".pdf"):
        filename += ".pdf"

    return {
        "filename": filename,
        "name": f"/docs/{filename}",
        "url": DOCS_BASE + urllib.parse.quote(filename),
        "resolved_via": "download.php",
    }


def resolve_tid(tid: int, docs_index: dict[int, dict[str, str]]) -> dict[str, str] | None:
    if tid in docs_index:
        result = dict(docs_index[tid])
        result["resolved_via"] = "docs_index"
        return result

    return resolve_tid_via_download(tid)


def verify_docs_url(url: str) -> bool:
    try:
        status, headers, _ = fetch_url(url, method="HEAD")
    except Exception:
        return False
    if status != 200:
        return False
    content_type = headers.get("content-type", "")
    return "pdf" in content_type or "octet-stream" in content_type


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


def parse_results(html: str) -> list[dict]:
    results = []
    for block in TABLE_RE.findall(html):
        parsed = parse_table(block)
        if parsed and parsed.get("level") == "Calculus/Mu":
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
    *,
    verify: bool,
) -> dict:
    test_type, month = normalize_category(meta.get("category") or "?")
    year = meta.get("year") if meta.get("year") not in (None, 0) else None

    entry = {
        "name": doc["name"],
        "url": doc["url"],
        "document_type": infer_document_type(label, doc["filename"]),
        "year": year,
        "month": month,
        "test_type": test_type,
        "division": "Mu",
        "format": infer_format(meta.get("style"), label, doc["filename"]),
        "famat_test_id": meta["test_id"],
        "document_tid": tid,
        "download_label": label,
        "resolved_via": doc.get("resolved_via"),
    }

    if verify:
        entry["url_verified"] = verify_docs_url(doc["url"])

    return entry


def main() -> int:
    out_dir = Path(__file__).resolve().parent
    verify_urls = "--verify" in sys.argv

    print("Fetching Calculus/Mu tests from tests.famat.org...", file=sys.stderr)
    docs_index = fetch_docs_index()

    all_tests = parse_results(fetch_search_results(level="Calculus/Mu"))
    individual_tests = parse_results(
        fetch_search_results(level="Calculus/Mu", style="(Individual)")
    )

    seen: set[int] = set()
    unique: list[dict] = []
    for t in all_tests:
        tid = t["test_id"]
        if tid not in seen:
            seen.add(tid)
            unique.append(t)

    unique.sort(
        key=lambda x: (
            x.get("year") if x.get("year") else 9999,
            x.get("category") or "",
            x.get("style") or "",
        )
    )

    individual_ids = {t["test_id"] for t in individual_tests}

    records = []
    famat_entries = []
    unresolved: list[dict] = []
    lines = []
    lines.append(f"Calculus/Mu tests from tests.famat.org ({len(unique)} total)\n")
    lines.append("=" * 80 + "\n\n")

    all_tids: set[int] = set()
    for t in unique:
        all_tids.update(t.get("downloads", {}).values())

    tid_cache: dict[int, dict[str, str] | None] = {}
    for i, tid in enumerate(sorted(all_tids)):
        if i and i % 100 == 0:
            print(f"Resolved {i}/{len(all_tids)} document tids...", file=sys.stderr)
        tid_cache[tid] = resolve_tid(tid, docs_index)

    for t in unique:
        test_type, month = normalize_category(t.get("category") or "?")
        downloads = t.get("downloads") or {}
        resolved_downloads: dict[str, dict] = {}

        for label, tid in downloads.items():
            doc = tid_cache.get(tid)
            if doc:
                resolved_downloads[label] = {
                    "tid": tid,
                    "download_url": f"{DOWNLOAD_BASE}{tid}",
                    "docs_name": doc["name"],
                    "docs_url": doc["url"],
                    "resolved_via": doc.get("resolved_via"),
                }
                famat_entries.append(
                    to_famat_entry(
                        {
                            **t,
                            "category": t.get("category"),
                            "year": t.get("year"),
                            "style": t.get("style"),
                            "test_id": t["test_id"],
                        },
                        label,
                        tid,
                        doc,
                        verify=verify_urls,
                    )
                )
            else:
                unresolved.append(
                    {
                        "famat_test_id": t["test_id"],
                        "label": label,
                        "tid": tid,
                    }
                )
                resolved_downloads[label] = {
                    "tid": tid,
                    "download_url": f"{DOWNLOAD_BASE}{tid}",
                    "docs_url": None,
                    "error": "could not resolve /docs/ path",
                }

        record = {
            "test_id": t["test_id"],
            "year": t.get("year") if t.get("year") != 0 else None,
            "category": t.get("category"),
            "test_type": test_type,
            "month": month,
            "level": t.get("level"),
            "style": t.get("style"),
            "calculator": t.get("calculator"),
            "host": t.get("host"),
            "is_individual": t["test_id"] in individual_ids,
            "downloads": resolved_downloads,
        }
        records.append(record)

        year_display = record["year"] if record["year"] else "?"
        dl_parts = []
        for label, info in resolved_downloads.items():
            if info.get("docs_url"):
                dl_parts.append(f"{label}: {info['docs_url']}")
            else:
                dl_parts.append(f"{label}: UNRESOLVED (tid={info['tid']})")
        lines.append(
            f"{year_display} | {t.get('category')} | {t.get('style')} | "
            f"host={t.get('host')} | test_id={t['test_id']}\n"
            + "\n".join(f"  {p}" for p in dl_parts)
            + "\n\n"
        )

    famat_entries.sort(
        key=lambda e: (
            e.get("year") or 9999,
            e.get("month") or "",
            e.get("test_type") or "",
            e.get("document_type") or "",
            e.get("name") or "",
        )
    )

    regional_individual_tests = [
        e
        for e in famat_entries
        if e["document_type"] == "Test"
        and e["format"] == "Individual"
        and e["test_type"] == "Regional"
    ]
    regional_individual_solutions = [
        e
        for e in famat_entries
        if e["document_type"] == "Solution"
        and e["format"] == "Individual"
        and e["test_type"] == "Regional"
    ]

    # famat_tests.json shape (omit internal metadata fields)
    famat_import = []
    for e in famat_entries:
        item = {
            "name": e["name"],
            "url": e["url"],
            "document_type": e["document_type"],
            "year": e["year"],
            "month": e["month"],
            "test_type": e["test_type"],
            "division": e["division"],
            "format": e["format"],
        }
        famat_import.append(item)

    txt_path = out_dir / "calctests.txt"
    json_path = out_dir / "calctests.json"
    individual_path = out_dir / "calctests_individual.json"
    regional_path = out_dir / "calctests_regional_individual.json"
    famat_path = out_dir / "calculus_famat_entries.json"
    famat_import_path = out_dir / "calculus_famat_import.json"
    unresolved_path = out_dir / "calctests_unresolved.json"

    txt_path.write_text("".join(lines), encoding="utf-8")
    json_path.write_text(json.dumps(records, indent=2), encoding="utf-8")
    individual_path.write_text(
        json.dumps([r for r in records if r["is_individual"]], indent=2),
        encoding="utf-8",
    )
    regional_path.write_text(
        json.dumps(
            [r for r in records if r["is_individual"] and r["test_type"] == "Regional"],
            indent=2,
        ),
        encoding="utf-8",
    )
    famat_path.write_text(json.dumps(famat_entries, indent=2), encoding="utf-8")
    famat_import_path.write_text(json.dumps(famat_import, indent=2), encoding="utf-8")
    unresolved_path.write_text(json.dumps(unresolved, indent=2), encoding="utf-8")

    resolved_doc_count = sum(1 for v in tid_cache.values() if v)
    verified_count = sum(1 for e in famat_entries if e.get("url_verified"))

    print(f"Wrote {len(records)} catalog entries to {json_path}", file=sys.stderr)
    print(
        f"Resolved {resolved_doc_count}/{len(all_tids)} document tids to /docs/ URLs",
        file=sys.stderr,
    )
    print(
        f"Wrote {len(famat_import)} famat_tests.json-ready entries to {famat_import_path}",
        file=sys.stderr,
    )
    print(
        f"Regional Individual: {len(regional_individual_tests)} tests, "
        f"{len(regional_individual_solutions)} solutions",
        file=sys.stderr,
    )
    if unresolved:
        print(f"WARNING: {len(unresolved)} downloads could not be resolved", file=sys.stderr)
    if verify_urls:
        print(f"Verified {verified_count}/{len(famat_entries)} URLs return PDF", file=sys.stderr)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
