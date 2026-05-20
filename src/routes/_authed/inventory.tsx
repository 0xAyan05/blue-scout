import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { getInventoryStatus, uploadInventory } from "@/lib/vendors.functions";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export const Route = createFileRoute("/_authed/inventory")({
  component: InventoryPage,
});

function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function InventoryPage() {
  const inv = useServerFn(getInventoryStatus);
  const upload = useServerFn(uploadInventory);
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["inventory"],
    queryFn: () => inv({}),
  });

  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<{
    ok: boolean;
    title: string;
    lines: string[];
  } | null>(null);

  const statusText = useMemo(() => {
    if (!data || data.count === 0) return "No inventory loaded. Upload a CSV to get started.";
    return `${data.count} domains loaded`;
  }, [data]);

  const mut = useMutation({
    mutationFn: async () => {
      if (!file) throw new Error("No file selected");
      const text = await file.text();
      return upload({ data: { csv: text } });
    },
    onSuccess: async (response) => {
      if (response.ok) {
        setResult({
          ok: true,
          title: "Upload complete",
          lines: [
            `${response.imported} domains imported`,
            `${response.skipped} rows skipped (missing required fields)`,
          ],
        });
        toast.success("Inventory uploaded");
        setFile(null);
        await qc.invalidateQueries({ queryKey: ["inventory"] });
        return;
      }

      if (response.code === "UPLOAD_MISSING_COLUMNS") {
        setResult({
          ok: false,
          title: "Upload failed",
          lines: [
            `Missing required columns: ${(response as { missing?: string[] }).missing?.join(", ") ?? ""}`,
            "Please fix your CSV and try again.",
          ],
        });
      } else {
        setResult({
          ok: false,
          title: "Could not parse this file",
          lines: ["Make sure it is a valid CSV with headers in row 1."],
        });
      }

      toast.error(response.error);
    },
    onError: (error) => {
      setResult({
        ok: false,
        title: "Upload failed",
        lines: [error instanceof Error ? error.message : "Unexpected upload error"],
      });
      toast.error(error instanceof Error ? error.message : "Upload failed");
    },
  });

  return (
    <div className="mx-auto max-w-3xl p-6">
      <h1 className="text-2xl font-semibold">Vendor Inventory</h1>

      <div className="mt-6 rounded-lg border bg-card p-5">
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

      <div className="mt-6 rounded-lg border bg-card p-5">
        <label className="block cursor-pointer rounded-md border-2 border-dashed p-8 text-center hover:bg-accent/50">
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
            <span className="text-sm text-muted-foreground">
              Drag and drop a CSV here, or click to browse
            </span>
          )}
        </label>

        <p className="mt-3 text-xs text-amber-700">
          Warning: Uploading a new CSV replaces the entire current inventory.
        </p>

        <div className="mt-4 flex justify-end">
          <Button disabled={!file || mut.isPending} onClick={() => mut.mutate()}>
            {mut.isPending ? "Parsing and validating..." : "Upload and Replace Inventory"}
          </Button>
        </div>

        {result && (
          <div
            className={`mt-4 rounded-md p-3 text-sm ${
              result.ok ? "bg-green-50 text-green-800" : "bg-red-50 text-red-800"
            }`}
          >
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
