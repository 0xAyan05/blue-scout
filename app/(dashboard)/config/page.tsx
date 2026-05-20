"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { fetchJson } from "@/lib/client-fetch";
import { toast } from "sonner";

const FIELDS = [
  ["niche_match", "Niche Match"],
  ["domain_rating", "Domain Rating"],
  ["traffic", "Traffic"],
  ["price_efficiency", "Price Efficiency"],
  ["ranking_bonus", "Ranking Bonus"],
  ["geo_match", "Geo Match"],
  ["no_red_flags", "No Red Flags"],
] as const;

type ConfigRow = {
  id: string;
  version: number;
  created_at: string | null;
  label: string | null;
  weights: Record<string, number>;
  disqualifiers: { ranking_excluded?: string[] };
  niche_prompt: string | null;
  is_active: boolean;
};

export default function ConfigPage() {
  const queryClient = useQueryClient();
  const [weights, setWeights] = useState<Record<string, number>>({});
  const [label, setLabel] = useState("");
  const [prompt, setPrompt] = useState("");
  const [restoreTarget, setRestoreTarget] = useState<{ id: string; version: number } | null>(null);

  const { data } = useQuery({
    queryKey: ["config"],
    queryFn: () => fetchJson<{ active: ConfigRow; history: ConfigRow[] }>("/api/config"),
  });

  useEffect(() => {
    if (data?.active) {
      setWeights(data.active.weights ?? {});
      setPrompt(data.active.niche_prompt ?? "");
    }
  }, [data]);

  const total = Object.values(weights).reduce((sum, value) => sum + value, 0);
  const valid = total === 100 && label.trim().length > 0;

  const saveMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          label,
          weights,
          niche_prompt: prompt || null,
        }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "Failed to save config");
      return payload as ConfigRow;
    },
    onSuccess: async (payload) => {
      toast.success(`Config v${payload.version} saved and activated.`);
      setLabel("");
      await queryClient.invalidateQueries({ queryKey: ["config"] });
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Failed to save"),
  });

  const restoreMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/config/${id}/restore`, { method: "POST" });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "Failed to restore config");
      return payload;
    },
    onSuccess: async () => {
      toast.success("Config restored");
      setRestoreTarget(null);
      await queryClient.invalidateQueries({ queryKey: ["config"] });
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Failed to restore"),
  });

  if (!data?.active) return <div className="p-8 text-sm text-muted-foreground">Loading...</div>;

  return (
    <div className="mx-auto max-w-3xl p-6">
      <h1 className="page-title">Scoring Configuration</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Tune ranking logic for future campaigns and keep a restorable config history.
      </p>

      <div className="surface-card mt-6 p-5">
        <div className="text-sm">
          <strong>Active:</strong> Config v{data.active.version} - "{data.active.label ?? "-"}"
        </div>
        <div className="mt-1 text-xs text-muted-foreground">
          Created: {data.active.created_at ? new Date(data.active.created_at).toLocaleDateString() : "-"}
        </div>
      </div>

      <div className="surface-card mt-6 p-5">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-muted-foreground">Weights</h2>
        <div className="space-y-3">
          {FIELDS.map(([key, fieldLabel]) => (
            <div key={key} className="flex items-center gap-3">
              <Label className="w-40 text-sm">{fieldLabel}</Label>
              <Input
                type="number"
                min={0}
                max={100}
                className="w-24"
                value={weights[key] ?? 0}
                onChange={(event) =>
                  setWeights((current) => ({ ...current, [key]: Number(event.target.value) }))
                }
              />
              <span className="text-xs text-muted-foreground">pts</span>
            </div>
          ))}
          <div className="flex items-center gap-3 border-t pt-3">
            <span className="w-40 text-sm font-semibold">Total</span>
            <span className={`w-24 text-right font-mono text-sm ${total === 100 ? "text-green-700" : "text-red-700"}`}>
              {total}
            </span>
            <span className="text-xs text-muted-foreground">
              pts {total === 100 ? "" : "(must equal 100)"}
            </span>
          </div>
        </div>
      </div>

      <div className="surface-card mt-6 p-5">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-muted-foreground">Hard disqualifiers</h2>
        <ul className="space-y-1 text-sm text-muted-foreground">
          <li>• DR below campaign minimum</li>
          <li>• Traffic below campaign minimum</li>
          <li>• Nofollow when dofollow required</li>
          <li>• Ranking: {data.active.disqualifiers?.ranking_excluded?.join(" or ") ?? "Poor or Bad"}</li>
        </ul>
        <p className="mt-3 text-xs text-muted-foreground">To change disqualifiers, edit the scoring_config table in Supabase directly.</p>
      </div>

      <div className="surface-card mt-6 p-5">
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">Niche Prompt (optional)</h2>
        <Textarea rows={4} value={prompt} onChange={(event) => setPrompt(event.target.value)} placeholder="Leave blank to use keyword matching only." />
      </div>

      <div className="surface-card mt-6 p-5">
        <Label>Label for this version</Label>
        <Input className="mt-1" placeholder="e.g. Increased niche weight for ecommerce" value={label} onChange={(event) => setLabel(event.target.value)} />
        {total !== 100 && <p className="mt-2 text-xs text-red-700">Weights must total 100 before saving.</p>}
        <div className="mt-4 flex justify-end">
          <Button disabled={!valid || saveMutation.isPending} onClick={() => saveMutation.mutate()}>
            {saveMutation.isPending ? "Saving..." : "Save as New Version"}
          </Button>
        </div>
      </div>

      <div className="mt-6 rounded-lg border bg-card p-5">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-muted-foreground">Version history</h2>
        <table className="w-full text-sm">
          <thead className="text-xs uppercase text-muted-foreground">
            <tr>
              <th className="py-2 text-left">Version</th>
              <th className="py-2 text-left">Label</th>
              <th className="py-2 text-left">Created</th>
              <th className="py-2 text-left">Active</th>
              <th className="py-2" />
            </tr>
          </thead>
          <tbody className="divide-y">
            {data.history.map((version) => (
              <tr key={version.id}>
                <td className="py-2">v{version.version}</td>
                <td className="py-2 text-muted-foreground">{version.label ?? "-"}</td>
                <td className="py-2 text-muted-foreground">{version.created_at ? new Date(version.created_at).toLocaleDateString() : "-"}</td>
                <td className="py-2">{version.is_active ? "Yes" : ""}</td>
                <td className="py-2 text-right">
                  {!version.is_active && (
                    <Button size="sm" variant="ghost" onClick={() => setRestoreTarget({ id: version.id, version: Number(version.version) })}>
                      Restore
                    </Button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <AlertDialog open={!!restoreTarget} onOpenChange={(open) => !open && setRestoreTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Restore config version?</AlertDialogTitle>
            <AlertDialogDescription>
              {restoreTarget ? `Restore config v${restoreTarget.version}? This will affect all future scoring jobs.` : ""}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => restoreTarget && restoreMutation.mutate(restoreTarget.id)}>
              Restore
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
