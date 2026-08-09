# MuPractice — Devlog

**Project:** MuPractice (μ Practice) — a FAMAT test practice web app  
**Author:** Xi Chen  
**Repo:** MuPractice · **232 commits** · **Dec 2025 → Jun 2026** (active development)  
**Live:** https://studio--studio-3139608084-d67c5.us-central1.hosted.app  
**Firebase project:** `studio-3139608084-d67c5`

---

## What MuPractice Is

MuPractice is a Next.js app for practicing Florida Mu Alpha Theta (FAMAT) competition tests. Users browse a test library, take timed practice sessions with embedded PDF/Word documents and a scantron-style answer sheet, review results, track progress, compete on leaderboards, join study groups, and report answer-key disputes.

The test catalog lives in `src/data/famat_tests.json` and is maintained partly by Python tooling under `TestParsing/`.

**Current catalog size (committed):**

- **670** total entries (tests + solutions)
- **335** practice tests
- **Years:** 2008–2025
- **Divisions:** Alg1, Alg2, Alpha, Geo, Mu, Stats, Theta

---

## Timeline

### Phase 0 — Foundation (Dec 10–21, 2025)

Started from a **Firebase Studio** Next.js starter and exported to local development (Antigravity) on **Mar 19, 2026**.

Early work was mostly infrastructure and core loop:

- Firebase Auth + Firestore integration (many iterative fixes)
- Initial MuPractice prototype
- FAMAT test catalog wired up with Google Drive PDF links
- Test library filters, PDF preview, zoom controls
- Practice submission and review flow
- Test completion history and progress tracking
- Solution PDF viewer

**~201 commits in December 2025 alone** — rapid prototyping and stabilization.

---

### Phase 1 — Practice UX Polish (Dec 24–30, 2025)

Focused on making the core experience feel production-ready:

- **Branding** settled on **MuPractice** (after brief MuAlphaPractice / θ experiments)
- Landing page copy and signed-out home experience
- Practice **timer** behavior (multiple rounds of fixes)
- **Review mode** UI improvements
- **Slide-out solutions panel** during practice
- **Mark-for-review** feature
- Sort direction fix in library filters
- Pre-publication refactor: removed Inspire font dependency, UI copy cleanup

---

### Phase 2 — Retake Mode (Jan–Feb 2026)

A major product feature: letting users redo tests without losing history.

- Retake from test history and library menu
- Fixed persistent retake answer display bugs
- Improved retake submit/omit handling
- **Session locking** so practice and retake sessions don't collide
- Cancel buttons for in-progress practice/retake
- Fixed checked-answer lock on practice load
- Timer dependency, race condition, and error handling fixes
- Reduced redundant Firestore reads in retake sync

---

### Phase 3 — Cloud Features & Social (May 24, 2026)

Big batch of user-facing features tied to Firebase:

| Feature | What it does |
|--------|----------------|
| **Bookmarks** | Save tests for later, synced to user profile |
| **Cloud history deletion** | Settings page with typed confirmation |
| **Share results** | Generate/share result images after a test |
| **Aggregate score stats** | Cross-test performance analytics |
| **Study groups** | Create/join groups via invite codes |
| **Leaderboard updates** | Division and overall rankings |
| **Home sections** | In-progress cards, resume UX, cancel buttons |

Also in this phase:

- Removed unused **Genkit AI / Gemini** integration (chat flow, genkit deps)
- Configured **Firebase App Hosting** for deployment
- Removed `GEMINI_API_KEY` from `apphosting.yaml` (no longer needed)

---

### Phase 4 — Answer Key System & Data Pipeline (Jun 14–22, 2026)

The largest engineering push — both **data** and **product**:

#### Answer key disputes & admin tooling

- Users can **report wrong answer keys** from practice (`ReportAnswerKeyDialog`)
- **Lazy regrade** when overrides are approved
- **Admin page** at `/admin/answer-keys` to review disputes
- `AnswerKeyOverridesContext` for client-side override application
- Cloud Function + Firestore rules/indexes for the workflow
- **Multi-select dispute** support (questions with multiple correct answers)

#### Test catalog expansion

- Python scripts to extract/merge tests from spreadsheets and Drive:
  - `extract_famat_tests.py`, `extract_calculus_tests.py`, `extract_drive_regionals.py`
  - `apply_folder_answer_keys.py`, `merge_calculus_into_famat.py`, etc.
- Imported **2022–2025 Drive regionals** (+2,162 entries in import JSON)
- Added calculus and other division imports from folder answer keys
- Massive updates to `famat_tests.json` (catalog grew from hundreds to **670 entries**)

#### Document viewing

- **Word (.docx) tests** routed through **Microsoft Office Online** embed (equations render correctly vs Google gview)
- `DocumentViewerFrame`, `WordDocumentViewer`, `document-url.ts` helpers

**Latest committed change (Jun 22, 2026):** Office Online for Word documents.

---

## Architecture & Stack

| Layer | Choice |
|-------|--------|
| Frontend | Next.js 15.5, React 19, TypeScript, Tailwind, Radix UI |
| Backend / DB | Firebase Auth, Firestore |
| Hosting | Firebase App Hosting (`backendId: studio`) |
| Functions | Firebase Cloud Functions (`functions/src/index.ts`) |
| Data | Static JSON catalog + Firestore for user/completion/group data |

**Routes:**

- `/` — Test library (home)
- `/practice/[testId]` — Practice arena (107 static paths at last build)
- `/history/[testId]` — Review past attempts / retake
- `/settings` — Account, bookmarks, history deletion
- `/admin/answer-keys` — Admin dispute review

---

## Commit Activity by Month

| Month | Commits | Focus |
|-------|---------|-------|
| Dec 2025 | 201 | Prototype, core practice, Firebase setup |
| Jan 2026 | 7 | Mark-for-review, retake fixes |
| Feb 2026 | 6 | Retake mode, codebase review |
| Mar 2026 | 2 | Progress grid, catalog update |
| May 2026 | 12 | Social features, App Hosting, AI removal |
| Jun 2026 | 4 | Answer keys, catalog pipeline, Office Online |

---

## Recent Session (Aug 6, 2026)

Work from the Aug 6 session:

1. **Fixed 2024 Stats Unplugged solutions link** — solutions entry points to [States_2024_Stats_Unplugged_Solutions.pdf](https://drive.google.com/file/d/1o_0GabTw6TnCT9tUfiDTOQhYFtdFJlwt/view?usp=sharing); test entry kept on the original Drive link.
2. **Published the app** via `firebase deploy --only apphosting` — rollout completed successfully to the live URL above.

---

## Known Build Notes

Local `npm run build` succeeds but logs Firebase init warnings during static generation (`app/no-options`) — the app falls back to explicit Firebase config. This did not block deploy; worth monitoring if any Firebase client features misbehave in production.

---

## Possible Next Steps

- Commit/push any remaining local-only changes (`.agents/`, `TestParsing` manifests, etc. are currently untracked)
- Wire CI so `git push` auto-deploys via App Hosting GitHub integration
- Expand catalog for 2026 season tests as they become available
- Address Firebase init warnings for cleaner production builds
