"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

const GEOS = ["Global", "US", "GB", "AU", "CA", "IE", "NZ", "DE", "FR", "ES", "IT", "NL", "SE", "DK", "NO", "FI"];

export default function NewCampaignPage() {
  const router = useRouter();
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

  const toggleGeo = (geo: string) => {
    if (geo === "Global") {
      setGeos(["Global"]);
      return;
    }
    setGeos((current) => {
      const withoutGlobal = current.filter((item) => item !== "Global");
      return withoutGlobal.includes(geo)
        ? withoutGlobal.filter((item) => item !== geo)
        : [...withoutGlobal, geo];
    });
  };

  const valid =
    clientName.trim() &&
    clientNiche.trim() &&
    pages.every((page) => page.url.trim() && page.keyword.trim()) &&
    budget > 0 &&
    goal > 0 &&
    geos.length > 0;

  const submit = async () => {
    if (!valid) return;
    setSubmitting(true);
    try {
      const response = await fetch("/api/campaigns/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
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
        }),
      });

      const payload = (await response.json()) as { id?: string; error?: string };
      if (!response.ok || !payload.id) {
        toast.error(payload.error ?? "Failed to create campaign");
        setSubmitting(false);
        return;
      }

      router.push(`/campaigns/${payload.id}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to create campaign");
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl p-6">
      <h1 className="page-title">New Campaign</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Create a scoring brief, rank the full inventory, and build a ready-to-export shortlist.
      </p>

      <Section title="Client Details">
        <Field label="Client Name">
          <Input value={clientName} onChange={(event) => setClientName(event.target.value)} />
        </Field>
        <Field label="Client Niche" hint="Comma-separated — e.g. SaaS, project management, productivity">
          <Input value={clientNiche} onChange={(event) => setClientNiche(event.target.value)} />
        </Field>
      </Section>

      <Section title="Target Pages">
        <div className="space-y-2">
          {pages.map((page, index) => (
            <div key={index} className="flex gap-2">
              <Input
                placeholder="https://example.com/page"
                value={page.url}
                onChange={(event) =>
                  setPages((current) =>
                    current.map((item, itemIndex) =>
                      itemIndex === index ? { ...item, url: event.target.value } : item,
                    ),
                  )
                }
              />
              <Input
                placeholder="project management software"
                value={page.keyword}
                onChange={(event) =>
                  setPages((current) =>
                    current.map((item, itemIndex) =>
                      itemIndex === index ? { ...item, keyword: event.target.value } : item,
                    ),
                  )
                }
              />
              {pages.length > 1 && (
                <Button variant="ghost" size="icon" onClick={() => setPages((current) => current.filter((_, i) => i !== index))}>
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
          ))}
          <Button variant="outline" size="sm" onClick={() => setPages((current) => [...current, { url: "", keyword: "" }])}>
            <Plus className="mr-1 h-4 w-4" /> Add page
          </Button>
        </div>
      </Section>

      <Section title="Campaign Parameters">
        <div className="grid grid-cols-2 gap-4">
          <Field label="Budget Per Link (USD)">
            <Input type="number" min={1} value={budget} onChange={(event) => setBudget(Number(event.target.value))} />
          </Field>
          <Field label="Link Count Goal">
            <Input type="number" min={1} value={goal} onChange={(event) => setGoal(Number(event.target.value))} />
          </Field>
          <Field label="Minimum DR">
            <Input type="number" min={0} max={100} value={minDr} onChange={(event) => setMinDr(Number(event.target.value))} />
          </Field>
          <Field label="Minimum Traffic">
            <Input type="number" min={0} value={minTraffic} onChange={(event) => setMinTraffic(Number(event.target.value))} />
          </Field>
        </div>
      </Section>

      <Section title="Targeting">
        <Field label="Geo Focus">
          <div className="flex flex-wrap gap-2">
            {GEOS.map((geo) => (
              <button
                key={geo}
                type="button"
                onClick={() => toggleGeo(geo)}
                disabled={geo !== "Global" && geos.includes("Global")}
                className={`rounded-full border px-3 py-1 text-xs transition ${
                  geos.includes(geo) ? "border-primary bg-primary text-primary-foreground" : "border-input bg-background hover:bg-accent"
                } disabled:opacity-40`}
              >
                {geo}
              </button>
            ))}
          </div>
        </Field>
        <Field label="Follow Link">
          <div className="flex gap-4">
            {(["dofollow", "either"] as const).map((value) => (
              <label key={value} className="flex items-center gap-2 text-sm">
                <input type="radio" checked={linkPref === value} onChange={() => setLinkPref(value)} />
                {value === "dofollow" ? "Dofollow only" : "Either"}
              </label>
            ))}
          </div>
        </Field>
      </Section>

      <Section title="Shortlist">
        <div className="inline-flex overflow-hidden rounded-md border">
          {[25, 50, 100].map((size) => (
            <button
              key={size}
              type="button"
              onClick={() => setShortlist(size as 25 | 50 | 100)}
              className={`px-4 py-2 text-sm ${shortlist === size ? "bg-primary text-primary-foreground" : "bg-background hover:bg-accent"}`}
            >
              Top {size}
            </button>
          ))}
        </div>
      </Section>

      <div className="mt-8 flex justify-end gap-2">
        <Button variant="outline" onClick={() => router.push("/campaigns")}>Cancel</Button>
        <Button onClick={submit} disabled={!valid || submitting}>
          {submitting ? "Starting..." : "Start Scoring →"}
        </Button>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="surface-card mt-6 p-5">
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
