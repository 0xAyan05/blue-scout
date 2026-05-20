# BlueTree Domain Selector - Spec Status

This repository has been cleaned for handoff around the active `Next.js 14` app in `app/` and the shared source in `src/`.

## Status Key

- `[x]` Done
- `[~]` Implemented with an equivalent pragmatic approach
- `[ ]` Not implemented

## Build And Deployment

- [x] Next.js 14 with App Router
- [x] Tailwind CSS + shadcn/ui components
- [x] Supabase access through `@supabase/supabase-js`
- [x] Server logic in `app/api/...`
- [x] SheetJS (`xlsx`) used server-side for CSV ingestion and XLSX export
- [x] Ready for Vercel deployment shape
- [ ] Anthropic niche scoring
  - Intentionally omitted per project direction

## Environment

- [x] `NEXT_PUBLIC_SUPABASE_URL`
- [x] `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- [x] `SUPABASE_URL`
- [x] `SUPABASE_SERVICE_ROLE_KEY`
- [~] `SUPABASE_ANON_KEY`
  - Not required by the current implementation, but compatible if provided
- [ ] `ANTHROPIC_API_KEY`
  - Intentionally unused

## Database

- [x] `vendors`
- [x] `scoring_config`
- [x] `campaigns`
- [x] `campaign_results`
- [x] `campaign_exports`
- [x] Default active scoring config seed expected by the app

## Routing

- [x] `/` redirects to `/campaigns`
- [x] `/campaigns`
- [x] `/campaigns/new`
- [x] `/campaigns/[id]`
- [x] `/inventory`
- [x] `/config`

## Campaign Dashboard

- [x] Empty state
- [x] Disabled `New Campaign` action when inventory is empty
- [x] Inventory-first guidance in empty state
- [x] Populated campaign table
- [x] Sorted by `updated_at` descending
- [x] Links selected vs goal
- [x] Budget per link
- [x] Status badges
- [x] Delete confirmation dialog

## New Campaign

- [x] Client details section
- [x] Dynamic target pages
- [x] Campaign parameters section
- [x] Geo targeting controls
- [x] Follow-link preference
- [x] Shortlist size controls
- [x] Validation before submit
- [x] Vendor inventory guard before creation
- [x] Create campaign through `/api/campaigns/create`
- [x] Immediate navigation to campaign detail after create
- [x] Scoring begins automatically

## Campaign Results

- [x] Sticky top bar
- [x] Sticky stats bar
- [x] Config trust signal
- [x] Inventory trust signal
- [x] Live totals
- [x] Scoring progress banner
- [x] Polling status endpoint
- [x] Resume / restart recovery controls
- [x] Shortlist tab
- [x] Disqualified tab
- [x] Client-side shortlist filters
- [x] Expandable score breakdown rows
- [x] Include/exclude toggles persisted to the API
- [x] Disqualified table sorted alphabetically
- [~] Interrupted scoring detection is heuristic
  - The UI restores from persisted status/results reliably, but there is no separate job queue to inspect

## Inventory

- [x] Upload status card
- [x] CSV file upload via `FormData`
- [x] Required column validation
- [x] Missing-row skip counting
- [x] Replace-all inventory flow
- [~] Literal SQL `TRUNCATE`
  - Implemented as a full delete-and-replace flow through Supabase admin access

## Config

- [x] Active config card
- [x] Editable weights
- [x] Live total validation
- [x] Read-only disqualifier guidance
- [x] Optional niche prompt field
- [x] Save as new version
- [x] Restore older version with confirmation
- [x] Version history table

## Export

- [x] `/api/campaigns/[id]/export`
- [x] Client Info tab
- [x] Target Pages tab
- [x] Campaign Management tab
- [x] Referring Domains tab
- [x] Profit formulas in Campaign Management
- [x] Save generated XLSX in `campaign_exports`
- [x] Mark campaign as `exported`
- [x] Download with generated filename

## Error Handling

- [x] Structured JSON error shape `{ error, code }`
- [x] Server-side logging through `console.error`
- [x] No raw SQL or stack traces exposed to the UI
- [x] Frontend handling for inventory/config/export/scoring failure states

## UI And Product Constraints

- [x] Sidebar-only shell
- [x] No login/auth in user flow
- [x] No public marketing pages
- [x] No localStorage/sessionStorage for campaign state
- [x] Desktop-oriented internal tool experience
- [x] Modernized visual polish for handoff

## Repo Cleanup

- [x] Active app code centered on `app/` and shared `src/`
- [x] Legacy TanStack/Vite route layer removed
- [x] Legacy Cloudflare deployment files removed
- [x] Legacy unused server helpers removed
