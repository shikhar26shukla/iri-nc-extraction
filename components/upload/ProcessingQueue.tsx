"use client";

import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import type { ProcessingLog } from "@/types";
import { CheckCircle2, AlertCircle, Download, Loader2 } from "lucide-react";

export type FileJobStatus =
  | "queued"
  | "uploading"
  | "processing"
  | "done"
  | "error";

export interface FileJob {
  id: string;
  file: File;
  status: FileJobStatus;
  progress: number;
  log?: ProcessingLog;
  outputName?: string;
  downloadUrl?: string;
  error?: string;
}

interface ProcessingQueueProps {
  jobs: FileJob[];
  onDownloadAll?: () => void;
  zipReady?: boolean;
}

function statusLabel(status: FileJobStatus): string {
  switch (status) {
    case "queued":
      return "Queued";
    case "uploading":
      return "Uploading";
    case "processing":
      return "Processing";
    case "done":
      return "Complete";
    case "error":
      return "Error";
  }
}

export function ProcessingQueue({
  jobs,
  onDownloadAll,
  zipReady,
}: ProcessingQueueProps) {
  if (jobs.length === 0) return null;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Processing Queue</h3>
        {zipReady && onDownloadAll && (
          <Button size="sm" variant="outline" onClick={onDownloadAll}>
            <Download className="h-4 w-4" />
            Download All (.zip)
          </Button>
        )}
      </div>

      {jobs.map((job) => (
        <div key={job.id} className="rounded-lg border bg-card p-4">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{job.file.name}</p>
              <p className="text-xs text-muted-foreground">
                {statusLabel(job.status)}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {job.status === "done" && (
                <CheckCircle2 className="h-5 w-5 text-green-600" />
              )}
              {job.status === "error" && (
                <AlertCircle className="h-5 w-5 text-destructive" />
              )}
              {(job.status === "uploading" || job.status === "processing") && (
                <Loader2 className="h-5 w-5 animate-spin text-primary" />
              )}
              {job.downloadUrl && (
                <a href={job.downloadUrl} download={job.outputName}>
                  <Button size="sm" variant="secondary">
                    <Download className="h-4 w-4" />
                    Download
                  </Button>
                </a>
              )}
            </div>
          </div>

          {job.status !== "queued" && job.status !== "error" && (
            <Progress value={job.progress} className="mt-3" />
          )}

          {job.error && (
            <p className="mt-2 text-xs text-destructive">{job.error}</p>
          )}

          {job.log && (
            <details className="mt-3 text-xs text-muted-foreground">
              <summary className="cursor-pointer font-medium text-foreground">
                Processing log
              </summary>
              <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
                <div>Rows: {job.log.rowsProcessed}</div>
                <div>Local: {job.log.matchedLocally}</div>
                <div>AI: {job.log.matchedByAI}</div>
                <div>Unresolved: {job.log.unresolved}</div>
              </div>
              {job.log.skillBaseUpdated && job.log.skillBaseMerge && (
                <div className="mt-2 rounded-md bg-muted/50 p-2 text-xs">
                  <p className="font-medium text-foreground">
                    Skill base updated — {job.log.skillBaseMerge.entryCount} entries
                  </p>
                  <p>
                    Added: {job.log.skillBaseMerge.newParticulars} new particulars
                    {" · "}
                    Updated: {job.log.skillBaseMerge.updatedParticulars}
                    {" · "}
                    New codes: {job.log.skillBaseMerge.newCodes}
                    {" · "}
                    Duplicates merged: {job.log.skillBaseMerge.duplicatesMerged}
                  </p>
                </div>
              )}
              {job.log.processedSheets.length > 0 && (
                <p className="mt-2">
                  Processed sheets: {job.log.processedSheets.join(", ")}
                </p>
              )}
              {job.log.skippedSheets.length > 0 && (
                <p className="mt-1">
                  Skipped: {job.log.skippedSheets.slice(0, 5).join(", ")}
                  {job.log.skippedSheets.length > 5 ? "…" : ""}
                </p>
              )}
              {job.log.errors.length > 0 && (
                <ul className="mt-2 list-disc pl-4">
                  {job.log.errors.map((e) => (
                    <li key={e}>{e}</li>
                  ))}
                </ul>
              )}
            </details>
          )}
        </div>
      ))}
    </div>
  );
}
