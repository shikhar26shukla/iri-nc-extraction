"use client";

import { useState } from "react";
import { PageHeader, Card } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { useCompany } from "@/components/company/CompanyProvider";
import { CreateCompanyDialog } from "@/components/company/CreateCompanyDialog";

export default function CompaniesPage() {
  const { companies, selectedCompanyId, setSelectedCompanyId, loading } =
    useCompany();
  const [dialogOpen, setDialogOpen] = useState(false);

  return (
    <div>
      <PageHeader
        title="Companies"
        description="Each company has its own IRIS and NC skill bases."
      />

      <div className="mb-4">
        <Button onClick={() => setDialogOpen(true)}>+ New Company</Button>
      </div>

      <CreateCompanyDialog open={dialogOpen} onOpenChange={setDialogOpen} />

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : companies.length === 0 ? (
        <Card>
          <p className="text-sm text-muted-foreground">
            No companies yet. Create one to get started.
          </p>
        </Card>
      ) : (
        <div className="space-y-3">
          {companies.map((company) => (
            <Card key={company.id} className="flex items-center justify-between py-4">
              <div>
                <p className="font-medium">{company.name}</p>
                <p className="text-xs text-muted-foreground">
                  ID: {company.id} · IRIS: {company.irisCount ?? 0} · NC:{" "}
                  {company.ncCount ?? 0}
                </p>
              </div>
              <Button
                variant={selectedCompanyId === company.id ? "default" : "outline"}
                size="sm"
                onClick={() => setSelectedCompanyId(company.id)}
              >
                {selectedCompanyId === company.id ? "Selected" : "Select"}
              </Button>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
