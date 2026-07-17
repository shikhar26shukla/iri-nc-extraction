"use client";

import { Button } from "@/components/ui/button";
import { History, RotateCcw } from "lucide-react";
import type { SkillBaseVersion } from "@/types";

interface SkillBaseVersionHistoryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  type: "iris" | "nc";
  versions: SkillBaseVersion[];
  onRestore: (version: number) => void;
}

function formatVersionSource(source: SkillBaseVersion["source"]) {
  const labels: Record<SkillBaseVersion["source"], string> = {
    build: "Build",
    merge: "Merge",
    "auto-merge": "Auto Merge",
    "auto-learn": "Auto-learn",
    restore: "Restore",
    upload: "Upload",
    seed: "Seed",
  };
  return labels[source] || source;
}

function formatMergeStats(v: SkillBaseVersion, type: "iris" | "nc") {
  if (!v.mergeStats) return null;
  const s = v.mergeStats;
  const newLabel = type === "nc" ? "new details" : "new particulars";
  const updatedLabel = type === "nc" ? "updated details" : "updated particulars";
  const newCount = s.newDetails ?? s.newParticulars;
  const updatedCount = s.updatedDetails ?? s.updatedParticulars;
  return (
    <p className="mt-1 text-xs text-muted-foreground">
      Added: {newCount} {newLabel}
      {" · "}
      Updated: {updatedCount} {updatedLabel}
      {" · "}
      New codes: {s.newCodes}
      {" · "}
      Duplicates merged: {s.duplicatesMerged}
    </p>
  );
}

export function SkillBaseVersionHistoryDialog({
  open,
  onOpenChange,
  type,
  versions,
  onRestore,
}: SkillBaseVersionHistoryDialogProps) {
  if (!open) return null;

  const title =
    type === "iris" ? "IRIS Version History" : "Nominal Code Version History";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={() => onOpenChange(false)}
    >
      <div
        className="flex max-h-[80vh] w-full max-w-2xl flex-col rounded-xl border bg-card shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="border-b px-6 py-4">
          <div className="flex items-center gap-2">
            <History className="h-5 w-5" />
            <h2 className="text-lg font-semibold">{title}</h2>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {versions.length} version{versions.length === 1 ? "" : "s"} saved
          </p>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4">
          {versions.length === 0 ? (
            <p className="text-sm text-muted-foreground">No version history yet.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {versions.map((v) => (
                <li
                  key={v.version}
                  className="flex flex-wrap items-center justify-between gap-2 rounded border bg-muted/30 px-3 py-2"
                >
                  <div>
                    <span>
                      Version {v.version} — {formatVersionSource(v.source)}
                      {v.fileName ? ` — ${v.fileName}` : ""} — {v.entryCount} entries
                      <span className="ml-2 text-xs text-muted-foreground">
                        {new Date(v.createdAt).toLocaleString()}
                      </span>
                    </span>
                    {formatMergeStats(v, type)}
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onRestore(v.version)}
                  >
                    <RotateCcw className="h-3 w-3" />
                    Restore
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="flex justify-end border-t px-6 py-4">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </div>
      </div>
    </div>
  );
}
