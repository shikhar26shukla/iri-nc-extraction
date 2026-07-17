"use client";

import { useCallback, useState } from "react";
import { MultiFileDropzone } from "@/components/upload/MultiFileDropzone";
import {
  ProcessingQueue,
  type FileJob,
} from "@/components/upload/ProcessingQueue";
import { PageHeader, Card } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { CompanySelector } from "@/components/company/CompanySelector";
import { CompanyGate } from "@/components/company/CompanyGate";
import { useCompany } from "@/components/company/CompanyProvider";
import type { ProcessingLog } from "@/types";

interface ExtractorPageProps {
  service: "iris" | "nc";
  title: string;
  description: string;
}

interface ApiFileResult {
  originalName: string;
  outputName: string;
  data: string;
  log: ProcessingLog;
}

interface ApiResponse {
  files: ApiFileResult[];
  zip?: string;
  zipName?: string;
}

export function ExtractorPage({ service, title, description }: ExtractorPageProps) {
  const { selectedCompanyId, refreshCompanies } = useCompany();
  const [jobs, setJobs] = useState<FileJob[]>([]);
  const [processing, setProcessing] = useState(false);
  const [zipUrl, setZipUrl] = useState<string | null>(null);

  const updateJob = useCallback((id: string, patch: Partial<FileJob>) => {
    setJobs((prev) =>
      prev.map((j) => (j.id === id ? { ...j, ...patch } : j))
    );
  }, []);

  const handleFilesSelected = async (files: File[]) => {
    if (!selectedCompanyId) return;

    setZipUrl(null);
    const newJobs: FileJob[] = files.map((file, i) => ({
      id: `${Date.now()}-${i}`,
      file,
      status: "queued",
      progress: 0,
    }));
    setJobs(newJobs);
    setProcessing(true);

    try {
      for (const job of newJobs) {
        updateJob(job.id, { status: "uploading", progress: 20 });

        const formData = new FormData();
        formData.append("companyId", selectedCompanyId);
        formData.append("files", job.file);

        updateJob(job.id, { status: "processing", progress: 50 });

        const res = await fetch(`/api/${service}`, {
          method: "POST",
          body: formData,
        });

        if (!res.ok) {
          const err = await res.json().catch(() => ({ error: "Request failed" }));
          updateJob(job.id, {
            status: "error",
            progress: 100,
            error: err.error || "Processing failed",
          });
          continue;
        }

        const data: ApiResponse = await res.json();
        const result = data.files[0];
        if (!result) {
          updateJob(job.id, {
            status: "error",
            progress: 100,
            error: "No output returned",
          });
          continue;
        }

        const blob = base64ToBlob(
          result.data,
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        );
        const url = URL.createObjectURL(blob);

        updateJob(job.id, {
          status: "done",
          progress: 100,
          log: result.log,
          outputName: result.outputName,
          downloadUrl: url,
        });

        if (
          (service === "iris" || service === "nc") &&
          result.log.skillBaseUpdated
        ) {
          await refreshCompanies();
          window.dispatchEvent(
            new CustomEvent("skillBaseUpdated", {
              detail: { companyId: selectedCompanyId },
            })
          );
        }
      }

      if (newJobs.length > 1) {
        const formData = new FormData();
        formData.append("companyId", selectedCompanyId);
        for (const job of newJobs) {
          formData.append("files", job.file);
        }
        formData.append("zip", "true");

        const res = await fetch(`/api/${service}`, {
          method: "POST",
          body: formData,
        });

        if (res.ok) {
          const data: ApiResponse = await res.json();
          if (data.zip) {
            const zipBlob = base64ToBlob(data.zip, "application/zip");
            setZipUrl(URL.createObjectURL(zipBlob));
          }
        }
      }
    } finally {
      setProcessing(false);
    }
  };

  const handleDownloadAll = () => {
    if (!zipUrl) return;
    const a = document.createElement("a");
    a.href = zipUrl;
    a.download = `${service}_results.zip`;
    a.click();
  };

  return (
    <div>
      <PageHeader title={title} description={description} />
      <CompanySelector />
      <CompanyGate>
        <Card className="mb-6">
          <MultiFileDropzone
            onFilesSelected={handleFilesSelected}
            disabled={processing || !selectedCompanyId}
          />
          {jobs.length > 0 && (
            <div className="mt-4 flex justify-end">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setJobs([]);
                  setZipUrl(null);
                }}
              >
                Clear queue
              </Button>
            </div>
          )}
        </Card>
        <ProcessingQueue
          jobs={jobs}
          zipReady={!!zipUrl && jobs.filter((j) => j.status === "done").length > 1}
          onDownloadAll={handleDownloadAll}
        />
      </CompanyGate>
    </div>
  );
}

function base64ToBlob(base64: string, mime: string): Blob {
  const bytes = atob(base64);
  const arr = new Uint8Array(bytes.length);
  for (let i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i);
  return new Blob([arr], { type: mime });
}
