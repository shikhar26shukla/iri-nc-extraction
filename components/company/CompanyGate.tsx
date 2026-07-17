"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useCompany } from "@/components/company/CompanyProvider";
import { CreateCompanyDialog } from "@/components/company/CreateCompanyDialog";

export function CompanyGate({ children }: { children: React.ReactNode }) {
  const { selectedCompany, loading } = useCompany();
  const [dialogOpen, setDialogOpen] = useState(false);

  if (loading) {
    return <p className="text-sm text-muted-foreground">Loading companies…</p>;
  }

  if (!selectedCompany) {
    return (
      <div className="rounded-xl border border-dashed bg-muted/30 px-6 py-12 text-center">
        <p className="text-sm font-medium">No company selected.</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Create a company first.
        </p>
        <Button className="mt-4" onClick={() => setDialogOpen(true)}>
          + New Company
        </Button>
        <CreateCompanyDialog open={dialogOpen} onOpenChange={setDialogOpen} />
      </div>
    );
  }

  return <>{children}</>;
}
