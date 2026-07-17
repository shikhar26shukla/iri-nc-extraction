"use client";

import { useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { Upload } from "lucide-react";
import { cn } from "@/lib/utils";

interface MultiFileDropzoneProps {
  onFilesSelected: (files: File[]) => void;
  disabled?: boolean;
  accept?: Record<string, string[]>;
}

export function MultiFileDropzone({
  onFilesSelected,
  disabled = false,
  accept = {
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [".xlsx"],
    "application/vnd.ms-excel": [".xls"],
    "text/csv": [".csv"],
  },
}: MultiFileDropzoneProps) {
  const onDrop = useCallback(
    (accepted: File[]) => {
      if (accepted.length > 0) onFilesSelected(accepted);
    },
    [onFilesSelected]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept,
    multiple: true,
    disabled,
  });

  return (
    <div
      {...getRootProps()}
      className={cn(
        "flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed px-6 py-12 transition-colors",
        isDragActive
          ? "border-primary bg-primary/5"
          : "border-border bg-muted/30 hover:border-primary/50",
        disabled && "pointer-events-none opacity-50"
      )}
    >
      <input {...getInputProps()} />
      <Upload className="mb-3 h-10 w-10 text-muted-foreground" />
      <p className="text-sm font-medium">
        {isDragActive ? "Drop files here" : "Drag & drop Excel/CSV files"}
      </p>
      <p className="mt-1 text-xs text-muted-foreground">
        or click to browse — multiple files supported
      </p>
    </div>
  );
}
