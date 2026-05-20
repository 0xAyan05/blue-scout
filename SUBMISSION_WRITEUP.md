# BlueTree Domain Selector - Submission Write-Up

## Stack Choice

I chose Next.js 14 with the App Router, TypeScript, Tailwind CSS, shadcn/ui, Supabase, and SheetJS.

The main reason for this stack was reliability and handoff simplicity. Next.js gave me a clear split between UI routes and server-side API routes, which was a good fit for inventory uploads, scoring, and XLSX generation. Supabase gave me a fast way to persist vendor inventory, campaigns, results, exports, and versioned reasoning config without introducing unnecessary infrastructure. Tailwind and shadcn/ui let me move quickly while still producing an interface that feels intentional and consistent for an internal operations tool.

Most importantly, this stack keeps the reasoning system externalized. The scoring framework lives in the database as versioned config rather than being buried directly in the UI, which makes it easier for BlueTree to change how domains are evaluated over time.

## UX Decisions I Am Proudest Of

The first decision was making the campaign results page feel trustworthy instead of just data-heavy. The sticky top bar, live stats bar, visible config version, and inventory trust signal help the user understand what dataset and scoring logic they are looking at before they make shortlist decisions.

The second was separating shortlist and disqualified domains clearly. That keeps the main workflow focused on the domains a user can actually choose from, while still making it easy to audit why other domains were excluded.

The third was showing score reasoning without overloading the main table. The table stays readable, but the user can expand rows for breakdown details and hover for more context when needed.

The fourth was treating config versioning as part of the product, not an afterthought. Since the reasoning layer is the part most likely to evolve, giving BlueTree a way to save new versions and restore older ones directly in the app felt especially important.

## What I Cut

I intentionally did not implement the Anthropic/LLM niche-scoring layer in this version. The current build uses deterministic scoring only. That was a deliberate scope decision to keep the tool stable and submission-ready.

I also did not build a separate job orchestration system for scoring. Scoring recovery is handled from persisted database state and retry/finalization logic rather than an external queue or worker dashboard.

Finally, the export is structured to match the required workbook layout, but I would still want one last validation pass against BlueTree's exact final template file before calling that portion perfect.

## What I Would Change With More Time

With more time, I would strengthen the export fidelity layer so it is driven directly from BlueTree's exact workbook template rather than a code-defined sheet structure. That would reduce the risk of layout drift if the template changes.

I would also improve recovery and observability around scoring jobs by adding clearer job-state tracking, timestamps for progress phases, and an admin-friendly recovery trail for interrupted runs.

On the UX side, I would keep refining the results table interactions for speed at scale, especially when working with larger inventories. I would likely add stronger saved-filter behavior, better bulk include/exclude controls, and more explicit status cues around export history.

Overall, the goal of this build was to produce a small, solid, repeatable internal tool that feels reliable on a Monday morning. That guided both the technical choices and the product decisions throughout the implementation.
