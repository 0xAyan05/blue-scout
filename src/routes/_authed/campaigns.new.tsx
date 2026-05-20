import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { createCampaign } from "@/lib/campaigns.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, X } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authed/campaigns/new")({
  component: NewCampaignPage,
});

const GEOS = ["Global", "US", "GB", "AU", "CA", "IE", "NZ", "DE", "FR", "ES", "IT", "NL", "SE", "DK", "NO", "FI"];

function NewCampaignPage() {
  const navigate = useNavigate();
  const create = useServerFn(createCampaign);

  const [clientName, setClientName] = useState("");
  const [clientNiche, setClientNiche] = useState("");
  const [pages, setPages] = useState([{ url: "", keyword: "" }]);
  const [budget, setBudget] = useState(150);
  const [goal, setGoal] = useState(50);
  const [minDr, setMinDr] = useState(50);
  const [minTraffic, setMinTraffic] = useState(3000);
  const [geos, setGeos] = useState<string[]>(["Global"]);
  const [linkPref, setLinkPref] = useState<"dofollow" | "either">("either");
  const [shortlist, setShortlist] = useState<25 | 50 | 100>(50);
  const [submitting, setSubmitting] = useState(false);

  const toggleGeo = (g: string) => {
    if (g === "Global") {
      setGeos(["Global"]);
      return;
    }
    setGeos((cur) => {
      const without = cur.filter((x) => x !== "Global");
      return without.includes(g) ? without.filter((x) => x !== g) : [...without, g];
    });
  };

  const valid =
    clientName.trim() &&
    clientNiche.trim() &&
    pages.every((p) => p.url.trim() && p.keyword.trim()) &&
    budget > 0 &&
    goal > 0 &&
    geos.length > 0;

  const submit = async () => {
    if (!valid) return;
    setSubmitting(true);
    try {
      const res = await create({
        data: {
          client_name: clientName,
          client_niche: clientNiche,
          target_pages: pages,
          budget_per_link: budget,
          link_count_goal: goal,
          min_dr: minDr,
          min_traffic: minTraffic,
          geo_focus: geos,
          link_preference: linkPref,
          shortlist_size: shortlist,
        },
      });
      if (!res.ok) {
        toast.error(res.error);
        setSubmitting(false);
        return;
      }
      navigate({ to: "/campaigns/$id", params: { id: res.id } });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to create campaign");
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl p-6">
      <h1 className="text-2xl font-semibold">New Campaign</h1>

      <Section title="Client Details">
        <Field label="Client Name"><Input value={clientName} onChange={(e) => setClientName(e.target.value)} /></Field>
        <Field label="Client Niche" hint="Comma-separated — e.g. SaaS, project management, productivity">
          <Input value={clientNiche} onChange={(e) => setClientNiche(e.target.value)} />
        </Field>
      </Section>

      <Section title="Target Pages">
        <div className="space-y-2">
          {pages.map((p, i) => (
            <div key={i} className="flex gap-2">
              <Input placeholder="https://example.com/page" value={p.url} onChange={(e) => setPages((s) => s.map((x, j) => (j === i ? { ...x, url: e.target.value } : x)))} />
              <Input placeholder="primary keyword" value={p.keyword} onChange={(e) => setPages((s) => s.map((x, j) => (j === i ? { ...x, keyword: e.target.value } : x)))} />
              {pages.length > 1 && (
                <Button variant="ghost" size="icon" onClick={() => setPages((s) => s.filter((_, j) => j !== i))}>
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
          ))}
          <Button variant="outline" size="sm" onClick={() => setPages((s) => [...s, { url: "", keyword: "" }])}>
            <Plus className="mr-1 h-4 w-4" /> Add page
          </Button>
        </div>
      </Section>

      <Section title="Campaign Parameters">
        <div className="grid grid-cols-2 gap-4">
          <Field label="Budget Per Link (USD)"><Input type="number" min={1} value={budget} onChange={(e) => setBudget(Number(e.target.value))} /></Field>
          <Field label="Link Count Goal"><Input type="number" min={1} value={goal} onChange={(e) => setGoal(Number(e.target.value))} /></Field>
          <Field label="Minimum DR"><Input type="number" min={0} max={100} value={minDr} onChange={(e) => setMinDr(Number(e.target.value))} /></Field>
          <Field label="Minimum Traffic"><Input type="number" min={0} value={minTraffic} onChange={(e) => setMinTraffic(Number(e.target.value))} /></Field>
        </div>
      </Section>

      <Section title="Targeting">
        <Field label="Geo Focus">
          <div className="flex flex-wrap gap-2">
            {GEOS.map((g) => (
              <button
                key={g}
                type="button"
                onClick={() => toggleGeo(g)}
                disabled={g !== "Global" && geos.includes("Global")}
                className={`rounded-full border px-3 py-1 text-xs transition ${
                  geos.includes(g) ? "border-primary bg-primary text-primary-foreground" : "border-input bg-background hover:bg-accent"
                } disabled:opacity-40`}
              >
                {g}
              </button>
            ))}
          </div>
        </Field>
        <Field label="Follow Link">
          <div className="flex gap-4">
            {(["dofollow", "either"] as const).map((v) => (
              <label key={v} className="flex items-center gap-2 text-sm">
                <input type="radio" checked={linkPref === v} onChange={() => setLinkPref(v)} />
                {v === "dofollow" ? "Dofollow only" : "Either"}
              </label>
            ))}
          </div>
        </Field>
      </Section>

      <Section title="Shortlist">
        <div className="inline-flex overflow-hidden rounded-md border">
          {[25, 50, 100].map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => setShortlist(n as 25 | 50 | 100)}
              className={`px-4 py-2 text-sm ${shortlist === n ? "bg-primary text-primary-foreground" : "bg-background hover:bg-accent"}`}
            >
              Top {n}
            </button>
          ))}
        </div>
      </Section>

      <div className="mt-8 flex justify-end gap-2">
        <Button variant="outline" onClick={() => navigate({ to: "/campaigns" })}>Cancel</Button>
        <Button onClick={submit} disabled={!valid || submitting}>{submitting ? "Starting…" : "Start Scoring →"}</Button>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-6 rounded-lg border bg-card p-5">
      <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-muted-foreground">{title}</h2>
      <div className="space-y-4">{children}</div>
    </section>
  );
}
function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}
