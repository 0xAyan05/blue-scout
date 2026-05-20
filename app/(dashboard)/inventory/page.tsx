"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { fetchJson } from "@/lib/client-fetch";
import { toast } from "sonner";

type InventoryStatus = {
  count: number;
  lastUploadedAt: string | null;
};

function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function InventoryPage() {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["inventory"],
    queryFn: () => fetchJson<InventoryStatus>("/api/inventory/status"),
  });

  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<{ ok: boolean; title: string; lines: string[] } | null>(null);

  const statusText = useMemo(() => {
    if (!data || data.count === 0) return "No inventory loaded. Upload a CSV to get started.";
    return `${data.count} domains loaded`;
  }, [data]);

  const mutation = useMutation({
    mutationFn: async () => {
      if (!file) throw new Error("No file selected");
      const formData = new FormData();
      formData.append("file", file);
      const response = await fetch("/api/inventory/upload", { method: "POST", body: formData });
      const payload = await response.json();
      if (!response.ok) throw payload;
      return payload as { imported: number; skipped: number };
    },
    onSuccess: async (payload) => {
      setResult({
        ok: true,
        title: "Upload complete",
        lines: [
          `${payload.imported} domains imported`,
          `${payload.skipped} rows skipped (missing required fields)`,
        ],
      });
      toast.success("Inventory uploaded");
      setFile(null);
      await queryClient.invalidateQueries({ queryKey: ["inventory"] });
    },
    onError: (error) => {
      const payload = error as { error?: string; code?: string; details?: { missing?: string[] } };
      if (payload.code === "UPLOAD_MISSING_COLUMNS") {
        setResult({
          ok: false,
          title: "Upload failed",
          lines: [
            `Missing required columns: ${payload.details?.missing?.join(", ") ?? ""}`,
            "Please fix your CSV and try again.",
          ],
        });
      } else if (payload.code === "UPLOAD_PARSE_ERROR") {
        setResult({
          ok: false,
          title: "Could not parse this file",
          lines: ["Make sure it is a valid CSV with headers in row 1."],
        });
      } else {
        setResult({
          ok: false,
          title: "Upload failed",
          lines: [payload.error ?? "Unexpected upload error"],
        });
      }
      toast.error(payload.error ?? "Upload failed");
    },
  });

  return (
    <div className="mx-auto max-w-3xl p-6">
      <h1 className="page-title">Vendor Inventory</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Replace the active publisher database with a validated CSV snapshot.
      </p>

      <div className="surface-card mt-6 p-5">
        {isLoading ? (
          <div className="space-y-2">
            <div className="h-5 w-40 animate-pulse rounded bg-muted" />
            <div className="h-4 w-52 animate-pulse rounded bg-muted" />
          </div>
        ) : data && data.count > 0 ? (
          <>
            <p className="text-sm">
              <span className="text-green-700">OK</span> <strong>{statusText}</strong>
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Last uploaded: {data.lastUploadedAt ? new Date(data.lastUploadedAt).toLocaleString() : "-"}
            </p>
          </>
        ) : (
          <p className="text-sm text-muted-foreground">{statusText}</p>
        )}
      </div>

      <div className="surface-card mt-6 p-5">
        <label className="block cursor-pointer rounded-2xl border-2 border-dashed border-slate-300/90 bg-[linear-gradient(180deg,rgba(248,250,252,0.9),rgba(255,255,255,0.85))] p-10 text-center transition hover:border-primary/50 hover:bg-accent/40">
          <input
            type="file"
            accept=".csv"
            className="hidden"
            onChange={(event) => {
              setFile(event.target.files?.[0] ?? null);
              setResult(null);
            }}
          />
          {file ? (
            <div className="text-sm">
              <strong>{file.name}</strong>
              <div className="text-xs text-muted-foreground">{formatFileSize(file.size)}</div>
            </div>
          ) : (
            <span className="text-sm text-muted-foreground">Drag and drop a CSV here, or click to browse</span>
          )}
        </label>

        <p className="mt-3 text-xs text-amber-700">
          Warning: Uploading a new CSV replaces the entire current inventory.
        </p>

        <div className="mt-4 flex justify-end">
          <Button disabled={!file || mutation.isPending} onClick={() => mutation.mutate()}>
            {mutation.isPending ? "Parsing and validating..." : "Upload and Replace Inventory"}
          </Button>
        </div>

        {result && (
          <div className={`mt-4 rounded-md p-3 text-sm ${result.ok ? "bg-green-50 text-green-800" : "bg-red-50 text-red-800"}`}>
            <div className="font-medium">{result.title}</div>
            {result.lines.map((line) => (
              <div key={line} className="mt-1">
                {line}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
