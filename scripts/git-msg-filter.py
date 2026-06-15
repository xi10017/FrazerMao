#!/usr/bin/env python3
"""Rewrite commit messages: strip Cursor co-author and improve prompt-style titles."""

import re
import sys

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
    "Initialized ",
    "Initial ",
)

EXACT_TITLES = {
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

TOPIC_PATTERNS = (
    (r"briefly scan|senior developer", "Review codebase and apply fixes"),
    (r"answers are now successfully locked|first load", "Fix checked-answer lock on practice load"),
    (r"main menu.*test again|selecting to take a test again", "Fix retake entry from test library menu"),
    (r"other direction", "Fix sort direction in test library filters"),
    (r"solutions tab slide|solutions panel", "Add slide-out solutions panel in practice"),
    (r"peak at answer|pick at answer", "Fix peak-at answer button in test mode"),
    (r"check button|dont see the check", "Improve check-answer button visibility"),
    (r"lock in answer|checking your answer will lock", "Lock answers when checking during practice"),
    (r"ti-84|ti84|NOT a ti84", "Add TI-84 calculator for statistics tests"),
    (r"progress grid.*score", "Show scores on progress grid cells"),
    (r"green ones.*pixel|1 mixel", "Fix progress grid cell alignment"),
    (r"inspire|apostrophe around folders", "Clean up UI copy and folder labels"),
    (r"why choose|landing", "Improve landing page copy"),
    (r"signed in.*display", "Show features on home tab for signed-out users"),
    (r"timer.*10 seconds|timer.*pausable|timer up", "Add pausable practice timer"),
    (r"are you sure.*check", "Add confirmation before checking an answer"),
    (r"flags are properly saved|reentering revi", "Persist review flags across sessions"),
    (r"calculaator|calculator.*pop|calculator.*squish|calculator.*reset|calculator tab", "Improve calculator panel layout"),
    (r"zoom.*button|zoom in|zoom out", "Improve test PDF zoom controls"),
    (r"left panel.*pushed|clunky", "Fix practice panel layout when opening tools"),
    (r"toggal|toggle.*tab.*stats", "Add toggleable solutions tab for statistics tests"),
    (r"marking for review|mark.*review", "Improve mark-for-review feature"),
    (r"working before|isnt it working", "Fix regression in practice mode"),
    (r"submit.*doesnt let me review", "Fix post-submit review flow"),
    (r"year range|year slider", "Improve year range filter slider UI"),
    (r"firebase.*permission|insufficient p", "Fix Firestore permission rules"),
    (r"app isn't starting", "Fix app startup failure"),
    (r"this error occurs because your firestore", "Fix Firestore security rules blocking reads"),
    (r"nextjs.*please fix", "Fix Next.js runtime error reported in dev"),
    (r"json.*10013|link should be in the format", "Fix FAMAT test PDF URL format in catalog"),
    (r"0 test available|no preview", "Fix test library availability and PDF preview"),
    (r"review page.*incorrect", "Show correct answers for missed questions in review"),
    (r"practice mode thing.*review mod", "Extend review mode for reattempts"),
    (r"clear filter", "Add clear-filters control to test library"),
    (r"calculus to Mu|precalculus\(alpha\)", "Update FAMAT test catalog divisions"),
)


def looks_informal(subject: str) -> bool:
    lower = subject.lower()
    markers = (
        " like ",
        " please ",
        " however",
        " dont ",
        " doesn't ",
        " cant ",
        " ur ",
        " ppl ",
        " teh ",
        " idk ",
        " definiet",
        " hmm",
        " sorry",
        " maybe ",
        " whenever ",
        " even doable",
        " also ",
        " nevermind",
        " oops ",
        " tripping",
        " wasnt ",
        " havent ",
        " isnt ",
        " doesnt ",
    )
    return any(m in lower for m in markers) or (
        len(subject) > 65 and not subject.startswith(GOOD_PREFIXES)
    )


def topic_title(subject: str) -> str | None:
    lower = subject.lower()
    for pattern, title in TOPIC_PATTERNS:
        if re.search(pattern, lower):
            return title
    return None


def strip_cursor_trailer(message: str) -> str:
    lines = []
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


def improve_error_subject(subject: str):
    if not subject.lower().startswith("try fixing this error:"):
        return None
    err = subject.split("`", 1)[1] if "`" in subject else re.sub(
        r"^Try fixing this error:\s*", "", subject, flags=re.I
    )
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
    if "auth/" in err.lower():
        return "Fix Firebase Auth configuration error"
    if "Parsing ecmascript" in err or "Build Error" in err:
        return "Fix build parse error in practice UI"
    if "was not properly" in err:
        return "Fix Firebase initialization error"
    if "Firebase" in err:
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

    topic = topic_title(original)
    if topic:
        return topic

    s = original
    s = re.sub(
        r"^(please|ok\.?|oh|hmm|awesome!|perfect!\.?|yes sorry[^,]*,?\s*|wait[^,]*,?\s*|and then|also like|also hmm|and also|and please|and like|no the|same issue|maybe im[^,]*,?\s*|hello,?\s*|i know[^,]*,?\s*|i believe|i have just|i have|great!)\s*",
        "",
        s,
        flags=re.I,
    )
    s = re.sub(r"^(can you|could you)\s+", "", s, flags=re.I)

    if s.lower().startswith("the issue is still present"):
        return "Fix persistent retake answer display bug"
    if s.lower().startswith("same issue is present"):
        return "Fix persistent practice panel layout issue"
    if s.lower().startswith("why does the year range"):
        return "Improve year range filter slider UI"
    for keyword, title in (
        ("retake", "Improve retake mode and answer handling"),
        ("history", "Improve test history page"),
        ("timer", "Improve practice timer behavior"),
        ("calculator", "Improve calculator panel layout"),
        ("zoom", "Improve test PDF zoom controls"),
        ("check answer", "Improve check-answer flow in practice mode"),
        ("check button", "Improve check-answer flow in practice mode"),
        ("review", "Improve review mode UI"),
        ("leaderboard", "Improve leaderboard display"),
        ("progress", "Improve progress grid and stats display"),
        ("firestore", "Fix Firebase/Firestore integration"),
        ("firebase", "Fix Firebase/Firestore integration"),
        ("pdf", "Improve test PDF viewing"),
        ("famat_tests", "Update FAMAT test catalog data"),
        ("precalculus", "Update FAMAT test catalog data"),
        ("calculus", "Update FAMAT test catalog data"),
        ("settings", "Improve settings page"),
        ("submit", "Fix test submission and review flow"),
        ("flag", "Improve mark-for-review feature"),
        ("mark", "Improve mark-for-review feature"),
    ):
        if keyword in s.lower():
            return title

    if len(s) > 72:
        s = s[:69].rsplit(" ", 1)[0] + "…"
    if s:
        s = s[0].upper() + s[1:]
    result = s.rstrip("?.! ") or original
    if looks_informal(result) and not result.startswith(GOOD_PREFIXES):
        fallback = topic_title(result)
        if fallback:
            return fallback
        return "Improve practice UI and fix bugs"
    return result


def main() -> None:
    raw = sys.stdin.read()
    cleaned = strip_cursor_trailer(raw)
    if not cleaned.strip():
        sys.stdout.write(raw)
        return

    lines = cleaned.splitlines()
    subject = lines[0].strip()
    body_lines = lines[1:]
    new_subject = improve_subject(subject)
    out = [new_subject]
    if body_lines:
        new_body = "\n".join(body_lines).strip()
        if new_body and new_body != subject:
            out.extend(["", new_body])
    sys.stdout.write("\n".join(out) + "\n")


if __name__ == "__main__":
    main()
