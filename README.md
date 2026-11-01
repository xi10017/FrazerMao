# MuPractice

A web application for practicing Florida Mu Alpha Theta (FAMAT) and national Mu Alpha Theta competition tests.

**[Open the application](https://xi10017.github.io/FrazerMao/)** · [Development log](DEVLOG.md) · [Season scoring](docs/season-activity.md) · [Answer-key corrections](docs/answer-key-history.md)

MuPractice brings past tests, answer sheets, grading, and saved practice into one interface. Students can work through a test, review the solutions, and return to previous attempts without keeping a separate record of their answers.

Developed by **Xi Chen**. The project began with a Firebase Studio starter and has since undergone changes to its practice workflow, data pipeline, authentication, database, and deployment.

## Features

### Test library

- **880 practice tests** from **2006–2025**, covering Algebra I, Geometry, Algebra II, Precalculus/Alpha, Calculus/Mu, Statistics, and Theta.
- Regional, Invitational, States, and Nationals tests, including individual and topic events.
- Filters for year, division, month, competition, and format/topic, with saved filter preferences.
- Bookmarks and document viewing for PDF and Word sources.
- Test cards loaded in batches to limit the number rendered at once.

### Practice and review

- An answer sheet alongside the test document, automatic grading, and solution viewing.
- An adjustable countdown timer with pause and reset controls and saved session state.
- Saved answers and review flags, with resume and cancel controls for unfinished attempts.
- Submission history, retakes, question-level review, and a progress grid.
- A TI-84 calculator for Statistics and shareable result images.
- Attempt timing metadata retained for review; timing does not determine activity points.

### Season activity award

- One point per completed attempt, including retakes, capped at six points per day in Eastern time.
- Explicit enrollment each season; attempts completed earlier in that season count toward the total.
- A public homepage preview showing the top five places, including ties, and excluding zero-point entries.
- Signed-in standings, private personal totals, daily activity, and past-season results.
- Full name and school collected separately for award administration. Public standings use the account display name; the signed-in leaderboard also includes the profile picture.
- Admin-configurable annual season boundaries, with April 1 as the default. A separate award-cutoff control is not yet implemented.

### Answer-key reports and administration

- Reports for disputed answers, including multiple accepted answers and thrown-out questions.
- Admin review, approved corrections, and an archive with a restore-original action.
- Results evaluated against the effective answer key without rewriting every stored submission in bulk.
- An admin section for answer-key reports, season settings, and private award participant details.
- Settings for theme, participation, feedback, and practice-history deletion. Deleting cloud practice history preserves season award records.

## Architecture

| Layer | Implementation |
| --- | --- |
| Interface | Next.js 15, React 19, TypeScript, Tailwind CSS, Radix UI |
| Authentication | Supabase Auth with Google sign-in |
| Application data | Supabase Postgres, row-level security, and database functions |
| Test catalog | Static JSON generated and maintained with Python import tools |
| Hosting | Next.js static export deployed to GitHub Pages through GitHub Actions |
| Documents | Externally hosted source documents displayed through document viewers |

The browser reads the static catalog and uses Supabase for account and practice data. Practice and history routes are generated from the catalog during the build, so deployment does not require a running Next.js server.

Season points are recorded by a database trigger when a submission is saved. The public preview uses a separate database function that returns only display names, ranks, and points for enrolled participants. Admin operations are checked on the server.

Legacy Firebase modules, configuration, migration scripts, and study-group modules remain in the repository. They are not all part of the current user interface; the active deployment uses Supabase and GitHub Pages.

## Catalog and validation

| Competition | Tests |
| --- | ---: |
| Regional | 219 |
| Invitational | 149 |
| States | 265 |
| Nationals | 247 |
| **Total** | **880** |

The October 2026 import added 545 tests to the existing 335. The importer matched spreadsheet keys with official document metadata, required complete 30-question keys, and excluded unresolved document pairs. Original catalog entries were preserved.

Validation included spreadsheet comparisons, document-link checks, and manual inspection of five official answer pages. This is not a claim that every solution has been independently checked. The sample found two questions marked thrown out in the spreadsheet but assigned letter answers in the linked PDF; the spreadsheet scoring rules were retained and the discrepancy documented.

See the [import report](TestParsing/reports/keyed-catalog-import.md) and [manual sample results](TestParsing/reports/manual-sample-check.json) for scope and limitations.

## Local development

Requires **Node.js 20 or newer**, npm, and a Supabase project with the application schema.

```sh
npm ci
```

Create `.env.local` in the repository root:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-public-anon-key
NEXT_PUBLIC_BASE_PATH=
NEXT_PUBLIC_SITE_URL=http://localhost:9002/
```

Apply the SQL files in `supabase/migrations/` in filename order. Enable Google sign-in in Supabase, configure its Google OAuth callback, and allow the local and production redirect URLs. Database migrations are applied separately from the static-site deployment.

```sh
npm run dev
```

Open [localhost:9002](http://localhost:9002).

Only the public Supabase URL and anon/publishable key belong in the browser configuration. Keep service-role keys and other private credentials out of client code and version control.

### Validation and static builds

```sh
npm run typecheck
npm run build
```

Run typecheck separately: the current Next.js configuration skips type and lint checks during the production build. The build writes a static site to `out/`. To inspect that output, serve `out/` with a static-file server; `next start` is not the serving method for this export.

For a GitHub Pages project-path build, set:

```env
NEXT_PUBLIC_BASE_PATH=/FrazerMao
NEXT_PUBLIC_SITE_URL=https://xi10017.github.io/FrazerMao/
```

## Deployment

Pushing to `supabase-migration` runs [the Pages workflow](.github/workflows/deploy-pages.yml), which installs dependencies, builds the export, and publishes `out/`. It requires the repository Actions secrets `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`.

A separate [connectivity workflow](.github/workflows/supabase-heartbeat.yml) makes a scheduled public-key database request. It is not a backup service or an uptime guarantee.

## Repository guide

| Path | Contents |
| --- | --- |
| `src/app/` | Routes, settings, and admin pages |
| `src/components/pages/` | Library, landing page, practice, review, and admin interfaces |
| `src/lib/` | Grading, persistence, reports, and supporting application logic |
| `src/supabase/` | Active authentication provider and database client |
| `src/data/famat_tests.json` | Test and solution catalog |
| `supabase/migrations/` | Database schema, access policies, triggers, and functions |
| `TestParsing/` | Source keys, import tools, metadata, and validation reports |
| `scripts/` | Migration and repository maintenance utilities |
| `DEVLOG.md` | Development history, decisions, and remaining work |

## Source materials

Competition tests and solutions come from their respective source organizations and authors. This repository does not assert ownership of those materials. Review the original sources and applicable permissions before redistributing them.
