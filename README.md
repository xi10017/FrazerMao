# MuPractice

MuPractice is a web app for practicing Florida Mu Alpha Theta (FAMAT) tests.
It provides a searchable test library, timed practice sessions, answer review,
retakes, progress tracking, leaderboards, study groups, and answer-key reports.

Live site: [xi10017.github.io/FrazerMao](https://xi10017.github.io/FrazerMao/)

## Tech stack

- Next.js 15 with static export
- React 19, TypeScript, and Tailwind CSS
- Supabase Auth and Postgres with row-level security
- GitHub Pages for static hosting
- Static test catalog in `src/data/famat_tests.json`

Firebase code and migration utilities remain in the repository as a rollback
and data-migration reference. The active migration branch uses Supabase for
authentication and application data.

## Local development

### Requirements

- Node.js 20 or newer
- npm
- A Supabase project with the application schema applied

### Setup

Install dependencies:

```bash
npm ci
```

Create `.env.local` in the project root. Do not commit this file.

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-public-anon-key
NEXT_PUBLIC_BASE_PATH=
NEXT_PUBLIC_SITE_URL=http://localhost:9002/
```

Start the development server:

```bash
npm run dev
```

Open [http://localhost:9002](http://localhost:9002).

## Useful commands

```bash
npm run dev       # Start the local development server
npm run typecheck # Run TypeScript checks
npm run build     # Create the production static export
npm run start     # Serve a Next.js production build locally
```

The production GitHub Pages build uses these values instead:

```env
NEXT_PUBLIC_BASE_PATH=/FrazerMao
NEXT_PUBLIC_SITE_URL=https://xi10017.github.io/FrazerMao/
```

## Supabase setup

1. Apply the migration in `supabase/migrations/` to the Supabase project.
2. Enable Google under Supabase **Authentication → Providers**.
3. Set the Supabase Auth site URL and redirect URL to:
   `https://xi10017.github.io/FrazerMao/`
4. Configure the Google OAuth web client with this authorized JavaScript origin:
   `https://xi10017.github.io`
5. Use this authorized redirect URI for Supabase Auth:
   `https://qggpflpsptfdhnlsmxfw.supabase.co/auth/v1/callback`

The public Supabase URL and anon key are safe to use in the browser. Never put
a Supabase service-role key or other private credentials in `.env.local` for a
static client application.

## Deployment

The `supabase-migration` branch is the active deployment branch. Pushing to it
runs `.github/workflows/deploy-pages.yml`, which builds the static `out/`
directory and publishes it to GitHub Pages.

The workflow expects these GitHub Actions secrets:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

The daily Supabase connectivity check is defined in
`.github/workflows/supabase-heartbeat.yml`.

## Project structure

- `src/app/` — Next.js routes and pages
- `src/components/` — reusable UI and practice components
- `src/data/famat_tests.json` — test catalog
- `src/supabase/` — Supabase client and provider setup
- `supabase/migrations/` — database schema and security policies
- `scripts/` — Firebase export and Supabase import utilities
- `TestParsing/` — catalog and answer-key processing tools
- `DEVLOG.md` — detailed project history and migration notes

## License and content

This repository contains project code and test-catalog data used by MuPractice.
Check the source documents and repository history before redistributing test
materials.
