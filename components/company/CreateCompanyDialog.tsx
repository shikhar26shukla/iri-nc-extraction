"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useCompany } from "@/components/company/CompanyProvider";

interface CreateCompanyDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreateCompanyDialog({
  open,
  onOpenChange,
}: CreateCompanyDialogProps) {
  const { refreshCompanies, setSelectedCompanyId } = useCompany();
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  if (!open) return null;

  const handleSave = async () => {
    setError("");
    setSaving(true);
    try {
      const res = await fetch("/api/companies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to create company");
        return;
      }
      await refreshCompanies();
      setSelectedCompanyId(data.company.id);
      setName("");
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-xl border bg-card p-6 shadow-lg">
        <h2 className="text-lg font-semibold">Create Company</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Each company has its own IRIS and NC skill bases.
        </p>
        <div className="mt-4">
          <label className="mb-1.5 block text-sm font-medium">Company Name</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Forest Car Company Ltd"
            className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            autoFocus
          />
        </div>
        {error && <p className="mt-2 text-sm text-destructive">{error}</p>}
        <div className="mt-6 flex justify-end gap-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={!name.trim() || saving}>
            {saving ? "Saving…" : "Save"}
          </Button>
        </div>
      </div>
    </div>
  );
}
