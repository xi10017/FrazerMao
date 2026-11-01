# MuPractice development log

**Developer:** Xi Chen
**Application:** [xi10017.github.io/FrazerMao](https://xi10017.github.io/FrazerMao/)
**Documentation updated:** November 1, 2026

This log describes the project's development and the decisions behind the current application. Dates identify development periods represented in the repository; historical features are distinguished from the current deployment. The [README](README.md) is the current feature and setup reference.

## December 2025 — Initial application

The project began with a Firebase Studio Next.js starter. Early development established the core workflow: find a past test, view the document, enter answers, submit, and review results.

Work included:

- A static test catalog and library filters.
- Embedded test and solution documents, with viewing and zoom controls.
- A scantron-style answer sheet, scoring, submission history, and a progress grid.
- Firebase Authentication and Firestore persistence.
- Timers, review flags, and the signed-out landing page.

Much of this period involved correcting state, rendering, and permissions problems as the prototype became usable. The history includes experiments and reversals rather than a single implementation of each feature.

## January–March 2026 — Practice and retakes

Practice and review were refined so users could repeat tests while retaining earlier results. Changes addressed retake entry, answer display, omitted answers, checked-answer locking, and review behavior.

Saved session handling, cancellation, and session locking reduced conflicts between unfinished practice and retakes. Persistence work also removed redundant Firestore reads and addressed stale responses and timer dependencies.

## May 2026 — Saved tests, results, and social features

Added bookmarks, result-image sharing, aggregate score statistics, and account-scoped cloud-history deletion with typed confirmation. Study-group creation, membership, invite codes, and member statistics were also implemented during this period; those modules remain in the repository but are not exposed as a tab in the current library interface.

Earlier AI tutor and question-explanation experiments were removed from the active product. AI tutoring is not a current feature.

Firebase App Hosting was used during this stage. It has since been replaced by GitHub Pages for the active deployment.

## June 2026 — Answer-key corrections and document imports

### Correction workflow

Added a student reporting workflow for disputed answer keys and an admin interface for reviewing reports. Approved overrides became the effective grading key. Review displays could use corrected keys without a bulk rewrite of historical submissions.

The reporting workflow was extended to represent multiple accepted answers and thrown-out questions. Later October work added a durable correction audit and a restore-original action.

### Catalog maintenance

Python utilities matched spreadsheet answer keys with FAMAT and Google Drive document metadata. By this stage, the application catalog contained 335 practice tests and their corresponding solution records. Metadata import inventories were larger than the set of tests actually published in the application.

Word documents were routed through Microsoft Office Online to improve equation rendering. Document compatibility remained dependent on the external source and viewer.

## August 2026 — Supabase migration and static hosting

### Authentication and data migration

Moved the active authentication and application data path from Firebase to Supabase. Added Postgres tables, row-level security policies, and database functions for profiles, submissions, saved sessions, reports, corrections, and administration.

Migration utilities exported Firebase accounts and documents and imported them into Supabase, preserving legacy identifiers for reference. Firebase files were retained rather than removed during the cutover. They remain historical and migration support code, not the active backend.

### GitHub Pages deployment

Configured Next.js static export and generated practice/history routes from the catalog. Client-side query parsing allowed practice pages to be prerendered without a Next.js server.

Added GitHub Actions deployment and project-path configuration for `/FrazerMao/`. A custom domain was briefly configured; the GitHub Pages project URL became canonical in August.

A scheduled Supabase connectivity request was added separately. It does not provide backups or guarantee service availability.

## October 2026 — Season awards, timers, and administration

### Season activity scoring

Introduced the season activity award, with 2026–2027 as the first official season:

- Each completed attempt, including a retake, earns one point, capped at six per Eastern calendar day.
- Database triggers record completion receipts as submissions are saved. Clients cannot directly edit those receipts.
- Enrollment is explicit and season-specific. Earlier attempts in the same season count when a student joins.
- Full name and school are stored separately for award administration; public standings use the account display name and points.
- Personal daily totals and a private rank preview are available before enrollment.
- Equal totals share a rank. Past-season participation records remain separate from current-season enrollment.
- Deleting cloud practice history preserves award receipts and participation records.

Annual rollover settings became configurable by admins. Changes apply to eligible future boundaries, avoiding retrospective changes to completed seasons. April 1 is the default rollover date. An independent award cutoff/finalization control remains unimplemented; season rollover and award cutoff should not be treated as interchangeable.

### Timer and resume behavior

Added adjustable timer controls and persisted timer state with practice sessions. Resume handling was refined to prevent remaining time from resetting when leaving a running session. Attempt start and completion metadata were retained separately from the visible practice timer for review; elapsed time is not an activity-scoring rule.

### Unified administration

Grouped answer-key reports, season settings, and participant details under the admin section. Admin authorization is enforced by the database as well as reflected in the interface.

Approved answer-key report cards gained a restore-original action. Restoration removes the active override while preserving the approval and correction audit. Concurrent changes are checked before a restore is applied.

### Catalog expansion: 335 to 880 tests

A new importer processed the regular-season, States, and Nationals answer-key workbooks and matched them with official archive and public-folder metadata.

| Competition | Added in this import | Current total |
| --- | ---: | ---: |
| Regional | 25 | 219 |
| Invitational | 36 | 149 |
| States | 243 | 265 |
| Nationals | 241 | 247 |
| **Total** | **545** | **880** |

The catalog now covers 2006–2025. Import requirements included complete 30-question keys and matching test/solution documents. Explicitly combined test-and-solution files could serve both document roles. Existing catalog records were preserved.

Validation and limits:

- All 545 imported keys were compared with the source spreadsheets, accounting for one documented repair from an official solution.
- Non-Drive document checks examined file signatures from downloaded byte ranges. Drive document IDs were checked against official public-folder inventories.
- Eighty candidates lacked matching document pairs, and one further pair had an unavailable solution. Thirteen unrecognized spreadsheet headers were left unresolved.
- Five official answer pages were visually inspected and all 150 answer positions compared with the imported keys.
- The sample matched except for two 2025 Alpha States questions: the spreadsheet marks Q15 and Q25 thrown out, while the linked PDF lists A and D. Spreadsheet scoring rules were retained and the discrepancy recorded.
- This work did not independently solve every question or manually inspect every imported document.

A format/topic filter and batches of 24 test cards were added to support the expanded library.

[Import report](TestParsing/reports/keyed-catalog-import.md) · [Manual sample results](TestParsing/reports/manual-sample-check.json)

### Public leaderboard and interface text

Added a signed-out homepage preview of the top five rank positions, including all ties at the boundary. Zero-point entries are excluded. A separate public database function returns only display names, ranks, and points for enrolled students; it does not return award identity details.

The preview was checked without authentication. A read-only ranking fixture confirmed ranks of 1, 2, 2, 4, 5, 5 at the cutoff. Homepage and enrollment copy was revised to use direct labels and explain participation and privacy.

## November 2026 — Repository documentation and history

Reviewed the commit history and replaced 44 conversational, incomplete, or pasted-error messages with descriptions based on their diffs. Commit file snapshots, author metadata, dates, and ordering were preserved. Rewritten branches were pushed with explicit leases after creating an external backup.

Replaced stale README and devlog information with the current feature set, deployment architecture, catalog counts, validation scope, and known limitations. Commit counts are omitted from the project introduction because they are not a measure of product quality and become outdated with routine maintenance.

## Current architecture and validation

The application uses Next.js static export on GitHub Pages, Supabase Auth, and Supabase Postgres. Catalog data remains in the repository; account and practice data are stored in Supabase.

The October application changes passed standalone TypeScript checking and production static export, generating 1,770 pages. The public leaderboard was also exercised anonymously. Build success is not a substitute for typecheck: the current Next.js configuration skips type and lint validation during builds.

## Remaining work

- Implement an independent award cutoff/finalization control before relying on it for final award standings.
- Resolve the recorded spreadsheet/PDF discrepancies and continue manual catalog checks.
- Improve automated coverage for scoring, saved-session behavior, and database authorization.
- Review retained Firebase and unused social modules before removing them.
- Consider editable public display names. Currently the profile name comes from sign-in account metadata, with an email-prefix fallback; a custom nickname setting is not implemented.

Season points measure completed submissions, not verified effort or time spent. Test files and embedded viewers are hosted externally and may become unavailable. These constraints remain part of the current design.
