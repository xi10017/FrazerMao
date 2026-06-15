"""git-filter-repo commit callback: strip Cursor co-author, normalize author, fix titles."""

from __future__ import annotations

import re

AUTHOR_NAME = b"Xi Chen"
AUTHOR_EMAIL = b"100172638xi@gmail.com"

GOOD_PREFIXES = (
    "Add ",
    "Fix ",
    "Update ",
    "Remove ",
    "Implement ",
    "Refactor ",
    "Improve ",
    "Enable ",
    "Disable ",
    "Sync ",
    "Snapshot ",
    "Deploy ",
    "Revert ",
    "Introduce ",
    "Support ",
    "Allow ",
    "Prevent ",
    "Clean ",
    "Set up ",
    "Set up a ",
    "Initialized ",
    "Initial ",
)

# Hand-tuned subjects for very common or unclear originals (full subject line match).
EXACT_TITLES: dict[str, str] = {
    "Initialized workspace with Firebase Studio": "Initialize project with Firebase Studio",
    "Initial prototype": "Add initial MuPractice prototype",
    "Set up a Firebase backend": "Set up Firebase backend",
    "Set up a Firebase project": "Set up Firebase project",
    "please proceed. the undefined should be replaced with like \"Regional\" or": "Fix undefined division labels in test metadata",
    "and then when you complete a test mark it as done and then have a histor": "Add test completion history and progress tracking",
    "wait also can you give them the option to view the solutions as a pdf as": "Add PDF solution viewer option",
    "can you embed the pdfs with google docs": "Embed test PDFs with Google Docs viewer",
    "now it says 0 test available": "Fix test library showing zero available tests",
    "why does it say no preview available": "Fix missing PDF preview for tests",
    "please refactor all code and cleanup.": "Refactor and clean up codebase",
    "and please do a final refactoring before publication": "Final pre-publication refactor",
    "can you make it like this ΜΑΘPractice": "Update branding to MuPractice styling",
    "ok nevermind just revert it to mupractice": "Revert branding to MuPractice",
    "can you make the O a theta": "Use theta character in Mu branding",
    "can you change the name of the website to maopractice as in like mu alph": "Rename site to MuAlphaPractice branding",
    "please update the history feature to where you are able to retake a test": "Add retake from test history",
    "can you mark the test as a retake test if it is on the history page": "Show retake badge on history entries",
    "https://ti84calc.com/ti84calc": "Add TI-84 calculator embed for statistics tests",
    "alpha = precalculus": "Map Alpha division to precalculus in test data",
    "months should be jan feb march in that order": "Sort test months chronologically in filters",
    "oh reset the timer back to 60 min": "Reset practice timer to 60 minutes",
    "make it sorry, no Inspire": "Remove Inspire font dependency",
}


def strip_cursor_trailer(message: str) -> str:
    lines: list[str] = []
    for line in message.splitlines():
        if "cursoragent@cursor.com" in line:
            continue
        lines.append(line)
    while lines and not lines[-1].strip():
        lines.pop()
    return "\n".join(lines)


def looks_conventional(subject: str) -> bool:
    if len(subject) > 100:
        return False
    lower = subject.lower()
    if any(
        p in lower[:35]
        for p in (
            "please ",
            "can you",
            "could you",
            "try fixing",
            "hmm ",
            "ok ",
            "oh ",
            "wait ",
            "awesome!",
            "great!",
            "same issue",
            "why does",
            "why now",
            "why once",
            "why sometimes",
            "i know",
            "i believe",
            "i have",
            "are you sure",
            "this error occurs",
            "the app isn't",
            "i see this error",
            "[     {",
            "http",
        )
    ):
        return False
    return subject.startswith(GOOD_PREFIXES)


def improve_error_subject(subject: str) -> str | None:
    if not subject.lower().startswith("try fixing this error:"):
        return None
    err = subject
    if "`" in subject:
        err = subject.split("`", 1)[1]
    else:
        err = re.sub(r"^Try fixing this error:\s*", "", subject, flags=re.I)
    err = err.strip("` ").strip()
    if "AlertDialogTrigger" in err:
        return "Fix missing AlertDialogTrigger import"
    if "ReferenceError" in err:
        name = re.search(r"(\w+) is not defined", err)
        return f"Fix ReferenceError: {name.group(1) if name else 'symbol'}"
    if "Each child in a list should have" in err:
        return "Fix React list key warning"
    if "hydrated but some attribut" in err:
        return "Fix React hydration mismatch"
    if "Cannot update a component" in err:
        return "Fix React setState during render in practice mode"
    if "Missing or insufficient permissions" in err:
        return "Fix Firestore permission rules"
    if "auth/configuration-not-found" in err.lower() or "auth/" in err.lower():
        return "Fix Firebase Auth configuration error"
    if "Parsing ecmascript" in err or "Build Error" in err:
        return "Fix build parse error in practice UI"
    if "was not properly" in err:
        return "Fix Firebase initialization error"
    if "Firebase: Error" in err or "FirebaseError" in err:
        return "Fix Firebase client error"
    return "Fix runtime error in practice app"


def improve_subject(subject: str) -> str:
    original = subject.strip()
    if original in EXACT_TITLES:
        return EXACT_TITLES[original]

    if looks_conventional(original):
        return original

    err_title = improve_error_subject(original)
    if err_title:
        return err_title

    s = original
    s = re.sub(
        r"^(please|ok\.?|oh|hmm|awesome!|perfect!\.?|yes sorry[^,]*,?\s*|wait[^,]*,?\s*|and then|also like|also hmm|and also|and please|and like|no the|same issue|maybe im[^,]*,?\s*|hello,?\s*|i know[^,]*,?\s*|i believe|i have just|i have|great!)\s*",
        "",
        s,
        flags=re.I,
    )
    s = re.sub(r"^(can you|could you)\s+", "", s, flags=re.I)
    s = re.sub(r"^try fixing this error:\s*", "Fix ", s, flags=re.I)

    if s.lower().startswith("the issue is still present"):
        return "Fix persistent retake answer display bug"
    if s.lower().startswith("same issue is present"):
        return "Fix persistent practice panel layout issue"
    if s.lower().startswith("why does the year range"):
        return "Improve year range filter slider UI"
    if "retake" in s.lower():
        return "Improve retake mode and answer handling"
    if "history" in s.lower():
        return "Improve test history page"
    if "timer" in s.lower():
        return "Improve practice timer behavior"
    if "calculator" in s.lower():
        return "Improve calculator panel layout"
    if "zoom" in s.lower():
        return "Improve test PDF zoom controls"
    if "check answer" in s.lower() or "check button" in s.lower():
        return "Improve check-answer flow in practice mode"
    if "review" in s.lower():
        return "Improve review mode UI"
    if "leaderboard" in s.lower():
        return "Improve leaderboard display"
    if "progress" in s.lower():
        return "Improve progress grid and stats display"
    if "firestore" in s.lower() or "firebase" in s.lower():
        return "Fix Firebase/Firestore integration"
    if "pdf" in s.lower():
        return "Improve test PDF viewing"
    if "famat_tests" in s.lower() or "precalculus" in s.lower() or "calculus" in s.lower():
        return "Update FAMAT test catalog data"
    if "settings" in s.lower():
        return "Improve settings page"
    if "submit" in s.lower():
        return "Fix test submission and review flow"
    if "flag" in s.lower() or "mark" in s.lower():
        return "Improve mark-for-review feature"

    if len(s) > 72:
        s = s[:69].rsplit(" ", 1)[0] + "…"

    if s:
        s = s[0].upper() + s[1:]

    return s.rstrip("?.! ") or original


def commit_callback(commit, metadata):  # noqa: ARG001
    commit.author_name = AUTHOR_NAME
    commit.author_email = AUTHOR_EMAIL
    commit.committer_name = AUTHOR_NAME
    commit.committer_email = AUTHOR_EMAIL

    try:
        raw = commit.message.decode("utf-8")
    except UnicodeDecodeError:
        return

    cleaned = strip_cursor_trailer(raw)
    if not cleaned.strip():
        return

    lines = cleaned.splitlines()
    subject = lines[0].strip()
    body_lines = lines[1:]

    new_subject = improve_subject(subject)
    new_lines = [new_subject]
    if body_lines:
        new_body = "\n".join(body_lines).strip()
        if new_body and new_body != subject:
            new_lines.append("")
            new_lines.append(new_body)

    commit.message = "\n".join(new_lines).encode("utf-8") + b"\n"
