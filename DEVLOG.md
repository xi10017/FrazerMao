# MuPractice — Devlog

**Project:** MuPractice (μ Practice) — a FAMAT test practice web app  
**Author:** Xi Chen  
**Repo:** MuPractice · **232 commits** · **Dec 2025 → Jun 2026** (active development)  
**Live:** https://studio--studio-3139608084-d67c5.us-central1.hosted.app  
**Firebase project:** `studio-3139608084-d67c5`

**Current migration branch:** `supabase-migration` (Aug 2026)

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

### Phase 5 — Supabase Migration (Aug 8–9, 2026)

The backend was migrated from Firebase Auth/Firestore toward Supabase while
keeping Firebase intact as a rollback and data-safety baseline.

#### Migration work completed

- Created the `supabase-migration` branch and checkpointed the Firebase baseline
  on `main`.
- Added a Postgres schema and row-level security policies for profiles,
  submissions, progress, retakes, groups, memberships, leaderboards, aggregate
  statistics, answer-key reports/overrides, and admins.
- Replaced the active client-side auth and data access path with Supabase.
- Configured Google sign-in through Supabase Auth and Google OAuth.
- Exported the existing Firebase data without deleting or modifying Firebase:
  - 40 Firebase Auth accounts
  - 319 Firestore documents
  - 213 test submissions
  - 17 in-progress sessions
  - 2 retake sessions
  - 24 aggregate-stat records
  - 20 leaderboard records
  - 4 answer-key overrides
- Imported the data into Supabase, mapping Firebase users to Supabase Auth users
  by verified email and retaining the original Firebase UID in
  `profiles.firebase_uid`.
- Added repeatable migration utilities:
  - `scripts/export-firebase-firestore.cjs`
  - `scripts/import-firebase-to-supabase.cjs`
- Verified Supabase row counts against the Firebase export.
- `npm run typecheck` and `npm run build` pass successfully.

#### Current migration boundary

The active application on this branch uses Supabase for authentication and
application data. Firebase is not yet removed from the repository or hosting
workflow: `firebase.json`, `apphosting.yaml`, Firebase Cloud Functions, legacy
Firebase client modules, and Firebase dependencies remain available for
rollback. The site is not fully independent of Firebase until hosting is moved
and those legacy services are intentionally retired.

No study-group or answer-key-report documents were present in the Firebase
export at migration time.

### Phase 6 — Static GitHub Pages Export (Aug 8, 2026)

- Configured Next.js with `output: 'export'` and trailing-slash routes.
- Added static parameter generation for both practice and history routes.
- Moved query-string parsing for practice into a client component so the route
  can be prerendered without a Next.js server.
- Added GitHub Pages project-path support through `NEXT_PUBLIC_BASE_PATH`.
- Updated Supabase Google OAuth redirects to include the `/FrazerMao/` project
  path when deployed at `https://xi10017.github.io/FrazerMao/`.
- Added `.github/workflows/deploy-pages.yml`; it builds the `out/` directory and
  deploys it through GitHub Pages when the migration branch is pushed.
- Verified both the normal static build and the `/FrazerMao` project-site build:
  all 677 pages export successfully, and `npm run typecheck` passes.

### Phase 7 — Custom Domain and Supabase Heartbeat (Aug 9, 2026)

- Updated the Pages build for the root custom domain
  `https://frazermao.online/` instead of the repository-path URL.
- Added a daily GitHub Actions Supabase REST read using only the public anon key.
  The service-role key is not used by the deployment or heartbeat workflows.
- The heartbeat is intended to provide regular database activity for the
  Supabase Free Plan; it does not replace backups or guarantee that Supabase
  will never pause an inactive project.
- Because GitHub scheduled workflows run from the repository's default branch,
  the heartbeat must be merged into or selected as the default branch before
  its daily schedule is active. It also runs on pushes to `supabase-migration`
  for an immediate connectivity check.

### Phase 8 — GitHub Pages URL as Canonical Site (Aug 19, 2026)

- Switched the deployment build back to the project URL
  `https://xi10017.github.io/FrazerMao/`.
- The custom domain is being removed so the site no longer depends on
  `frazermao.online` ownership, DNS, or renewal.
- Supabase Auth redirect settings must use the GitHub Pages project URL after
  the Pages custom domain is removed.

---

## Architecture & Stack

| Layer | Choice |
|-------|--------|
| Frontend | Next.js 15.5, React 19, TypeScript, Tailwind, Radix UI |
| Backend / DB | Firebase Auth, Firestore |
| Hosting | Firebase App Hosting (`backendId: studio`) |
| Functions | Firebase Cloud Functions (`functions/src/index.ts`) |
| Data | Static JSON catalog + Firestore for user/completion/group data |

### Migration-branch architecture

| Layer | Choice |
|-------|--------|
| Frontend | Next.js 15.5, React 19, TypeScript, Tailwind, Radix UI |
| Authentication | Supabase Auth with Google OAuth |
| Backend / DB | Supabase Postgres with Row Level Security |
| Hosting | GitHub Pages static export at `https://xi10017.github.io/FrazerMao/` |
| Functions | Legacy Firebase Cloud Function retained for rollback |
| Data | Static JSON catalog + Supabase tables for user/completion/group data |

**Routes:**

- `/` — Test library (home)
- `/practice/[testId]` — Practice arena (static paths generated from the catalog)
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

The Supabase migration branch passes `npm run typecheck` and `npm run build`.
The active build no longer requires Firebase client initialization. Firebase
warnings may still appear only when working with the retained legacy Firebase
modules or deploying through the old App Hosting configuration.

---

## Possible Next Steps

- Push `supabase-migration`, enable GitHub Pages with **GitHub Actions** as the
  source, and add `NEXT_PUBLIC_SUPABASE_URL` plus
  `NEXT_PUBLIC_SUPABASE_ANON_KEY` as repository Actions secrets.
- Add `https://xi10017.github.io/FrazerMao/` to Supabase Auth redirect URLs and
  keep the Google OAuth client callback pointed at Supabase's Auth callback.
- Remove the legacy Firebase client, functions, config, and dependency after a
  full production cutover and backup verification.
- Expand catalog for 2026 season tests as they become available
