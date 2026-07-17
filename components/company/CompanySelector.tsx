"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCompany } from "@/components/company/CompanyProvider";
import { CreateCompanyDialog } from "@/components/company/CreateCompanyDialog";

export function CompanySelector() {
  const {
    companies,
    selectedCompanyId,
    setSelectedCompanyId,
    loading,
  } = useCompany();
  const [dialogOpen, setDialogOpen] = useState(false);

  return (
    <div className="mb-6 flex flex-wrap items-end gap-3">
      <div className="min-w-[220px] flex-1">
        <label className="mb-1.5 block text-sm font-medium">Company</label>
        <select
          value={selectedCompanyId || ""}
          onChange={(e) => setSelectedCompanyId(e.target.value || null)}
          disabled={loading}
          className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
        >
          <option value="">Select a company…</option>
          {companies.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name} ({c.id})
            </option>
          ))}
        </select>
      </div>
      <Button
        type="button"
        variant="outline"
        size="default"
        onClick={() => setDialogOpen(true)}
        aria-label="Create company"
      >
        <Plus className="h-4 w-4" />
      </Button>
      <CreateCompanyDialog open={dialogOpen} onOpenChange={setDialogOpen} />
    </div>
  );
}
