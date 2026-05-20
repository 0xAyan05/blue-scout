# BlueTree Domain Selector

BlueTree Domain Selector is an internal campaign planning tool for selecting the best publisher domains from a vendor inventory. It helps the delivery or account team upload inventory, create a client brief, score domains against that brief, review shortlist and disqualified results, and export a campaign workbook.

## Stack

- Next.js 14 with App Router
- TypeScript
- Tailwind CSS
- shadcn/ui components
- Supabase PostgreSQL via `@supabase/supabase-js`
- SheetJS (`xlsx`) for CSV parsing and XLSX export
- React Query for client-side data fetching

## Core Features

- Upload and replace vendor inventory from CSV
- Create new campaigns from a client brief
- Score the full inventory against the active reasoning config
- Show shortlist and disqualified results with score breakdowns
- Include or exclude domains and track live budget totals
- Version scoring config in the database
- Export selected results to a multi-sheet XLSX workbook
- Persist campaign exports in `campaign_exports`

## Local Setup

## Requirements

- Node.js 18 or newer
- npm
- A Supabase project with the required schema and seed data applied

## Install

```bash
npm install
```

## Environment Variables

Create a `.env` file in the project root with:

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
```

Optional compatibility variable:

```env
SUPABASE_ANON_KEY=your_supabase_anon_key
```

## Run Locally

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Production Build

```bash
npm run build
npm run start
```

## Database Setup

Apply the migration in:

- [supabase/migrations/20260520112016_d661b31d-7b3c-4698-9987-5e14d821d709.sql](C:/Users/acer/OneDrive/Desktop/test/blue-scout/supabase/migrations/20260520112016_d661b31d-7b3c-4698-9987-5e14d821d709.sql)

This migration creates:

- `vendors`
- `scoring_config`
- `campaigns`
- `campaign_results`
- `campaign_exports`

It also seeds a default active scoring config.

## CSV Inventory Requirements

Required CSV columns:

- `domain`
- `main_niche`
- `complementary_niche`
- `indirect_niche`
- `dr`
- `traffic`
- `price`
- `geo`
- `link_type`
- `tat`
- `ranking`
- `red_flags`
- `contact_email`

Rows are skipped when `domain`, `dr`, or `traffic` is missing.

## Deployment

## Vercel

1. Push the repository to GitHub.
2. Import the repo into Vercel.
3. Set the environment variables in the Vercel project:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`
4. Deploy.

The app is a standard Next.js 14 App Router project and builds with:

```bash
npm run build
```

## How To Update The Reasoning Config

Reasoning is externalized in the `scoring_config` table and exposed in the app under `/config`.

To update the active scoring logic:

1. Open the `Config` page in the app.
2. Edit the scoring weights.
3. Optionally update the niche prompt field.
4. Add a label describing the new version.
5. Click `Save as New Version`.

This inserts a new config row and makes it active for future scoring jobs. Existing scored campaigns keep their stored results.

## How To Roll Back A Config Change

To roll back:

1. Open the `Config` page.
2. Find the earlier version in `Version history`.
3. Click `Restore`.
4. Confirm the restore action.

This marks the selected row as active and deactivates the others. Future campaigns will use that restored config.

## Operational Notes

- This is a single-user internal tool.
- There is no login or public-facing surface.
- Campaign state is persisted in Supabase, not browser storage.
- Exported workbooks are also saved in the database.

## Known Scope Decisions

- Anthropic/LLM niche scoring is intentionally not enabled in this version.
- Inventory replacement is implemented as a full delete-and-replace flow through Supabase admin access.
- Interrupted scoring recovery is handled through persisted status/results rather than an external job queue.

## Handoff Files

- [SPEC_STATUS.md](C:/Users/acer/OneDrive/Desktop/test/blue-scout/SPEC_STATUS.md)
- [SUBMISSION_WRITEUP.md](C:/Users/acer/OneDrive/Desktop/test/blue-scout/SUBMISSION_WRITEUP.md)
