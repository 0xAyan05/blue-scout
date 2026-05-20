import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { getInventoryStatus, uploadInventory } from "@/lib/vendors.functions";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export const Route = createFileRoute("/_authed/inventory")({
  component: InventoryPage,
});

function InventoryPage() {
  const inv = useServerFn(getInventoryStatus);
  const upload = useServerFn(uploadInventory);
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ["inventory"], queryFn: () => inv({}) });
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);

  const mut = useMutation({
    mutationFn: async () => {
      if (!file) throw new Error("No file");
      const text = await file.text();
      return upload({ data: { csv: text } });
    },
    onSuccess: (r) => {
      if (r.ok) {
        setResult({ ok: true, message: `Imported ${r.imported} domains${r.skipped > 0 ? `, skipped ${r.skipped}` : ""}` });
        toast.success("Inventory uploaded");
        qc.invalidateQueries({ queryKey: ["inventory"] });
        setFile(null);
      } else {
        setResult({ ok: false, message: r.error });
        toast.error(r.error);
      }
    },
    onError: (e) => {
      toast.error(e instanceof Error ? e.message : "Upload failed");
    },
  });

  return (
    <div className="mx-auto max-w-2xl p-6">
      <h1 className="text-2xl font-semibold">Vendor Inventory</h1>

      <div className="mt-6 rounded-lg border bg-card p-5">
        {data && data.count > 0 ? (
          <>
            <p className="text-sm">
              <span className="text-green-700">✓</span> <strong>{data.count}</strong> domains loaded
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Last uploaded: {data.lastUploadedAt ? new Date(data.lastUploadedAt).toLocaleString() : "—"}
            </p>
          </>
        ) : (
          <p className="text-sm text-muted-foreground">No inventory loaded. Upload a CSV to get started.</p>
        )}
      </div>

      <div className="mt-6 rounded-lg border bg-card p-5">
        <label className="block cursor-pointer rounded-md border-2 border-dashed p-8 text-center hover:bg-accent/50">
          <input
            type="file"
            accept=".csv"
            className="hidden"
            onChange={(e) => { setFile(e.target.files?.[0] ?? null); setResult(null); }}
          />
          {file ? (
            <div className="text-sm">
              <strong>{file.name}</strong>
              <div className="text-xs text-muted-foreground">{(file.size / 1024).toFixed(1)} KB</div>
            </div>
          ) : (
            <span className="text-sm text-muted-foreground">Click to choose a .csv file</span>
          )}
        </label>
        <p className="mt-3 text-xs text-amber-700">⚠ Uploading a new CSV replaces the entire current inventory.</p>
        <div className="mt-4 flex justify-end">
          <Button disabled={!file || mut.isPending} onClick={() => mut.mutate()}>
            {mut.isPending ? "Parsing and validating…" : "Upload and Replace Inventory"}
          </Button>
        </div>
        {result && (
          <div className={`mt-4 rounded-md p-3 text-sm ${result.ok ? "bg-green-50 text-green-800" : "bg-red-50 text-red-800"}`}>
            {result.ok ? "✓ " : "✗ "}{result.message}
          </div>
        )}
      </div>
    </div>
  );
}
