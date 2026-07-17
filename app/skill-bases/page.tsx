"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { PageHeader, Card } from "@/components/layout/page-header";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SkillBaseTable } from "@/components/tables/SkillBaseTable";
import { Button } from "@/components/ui/button";
import { Upload, Download, History, RotateCcw, Trash2 } from "lucide-react";
import { CompanySelector } from "@/components/company/CompanySelector";
import { CompanyGate } from "@/components/company/CompanyGate";
import { useCompany } from "@/components/company/CompanyProvider";
import type { IrisSkillEntry, NcSkillEntry, SkillBaseVersion } from "@/types";

interface IrisTableRow extends IrisSkillEntry {
  topCode: string;
  topCount: number;
  allCodes: string;
}

function enrichIrisRows(entries: IrisSkillEntry[]): IrisTableRow[] {
  return entries.map((entry) => {
    const stats =
      entry.irisCodes && entry.irisCodes.length > 0
        ? [...entry.irisCodes].sort((a, b) => b.count - a.count)
        : entry.irisCode
          ? entry.irisCode.split("/").map((code) => ({ code: code.trim(), count: 1 }))
          : [];
    const top = stats[0];
    const allCodes = stats.map((s) => `${s.code} (${s.count})`).join(", ");
    return {
      ...entry,
      topCode: top?.code || "",
      topCount: top?.count || 0,
      allCodes,
    };
  });
}

export default function SkillBasesPage() {
  const { selectedCompanyId } = useCompany();
  const [irisData, setIrisData] = useState<IrisSkillEntry[]>([]);
  const [ncData, setNcData] = useState<NcSkillEntry[]>([]);
  const [irisVersions, setIrisVersions] = useState<SkillBaseVersion[]>([]);
  const [ncVersions, setNcVersions] = useState<SkillBaseVersion[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploadMsg, setUploadMsg] = useState("");
  const irisBuildInputRef = useRef<HTMLInputElement>(null);
  const irisMergeInputRef = useRef<HTMLInputElement>(null);
  const ncBuildInputRef = useRef<HTMLInputElement>(null);
  const ncMergeInputRef = useRef<HTMLInputElement>(null);

  const loadData = useCallback(async () => {
    if (!selectedCompanyId) {
      setIrisData([]);
      setNcData([]);
      setIrisVersions([]);
      setNcVersions([]);
      return;
    }
    setLoading(true);
    const [irisRes, ncRes, irisVersionsRes, ncVersionsRes] = await Promise.all([
      fetch(`/api/skill-base/iris?companyId=${selectedCompanyId}`),
      fetch(`/api/skill-base/nc?companyId=${selectedCompanyId}`),
      fetch(`/api/skill-base/iris/versions?companyId=${selectedCompanyId}`),
      fetch(`/api/skill-base/nc/versions?companyId=${selectedCompanyId}`),
    ]);
    const irisJson = await irisRes.json();
    const ncJson = await ncRes.json();
    const irisVersionsJson = await irisVersionsRes.json();
    const ncVersionsJson = await ncVersionsRes.json();
    setIrisData(irisJson.entries || []);
    setNcData(ncJson.entries || []);
    setIrisVersions(irisVersionsJson.versions || []);
    setNcVersions(ncVersionsJson.versions || []);
    setLoading(false);
  }, [selectedCompanyId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    const onFocus = () => loadData();
    const onSkillBaseUpdated = (e: Event) => {
      const detail = (e as CustomEvent<{ companyId: string }>).detail;
      if (detail?.companyId === selectedCompanyId) loadData();
    };
    window.addEventListener("focus", onFocus);
    window.addEventListener("skillBaseUpdated", onSkillBaseUpdated);
    return () => {
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("skillBaseUpdated", onSkillBaseUpdated);
    };
  }, [loadData, selectedCompanyId]);

  const irisTableData = useMemo(() => enrichIrisRows(irisData), [irisData]);

  const handleIrisUpload = async (mode: "build" | "merge", file: File) => {
    if (!selectedCompanyId) return;
    if (
      mode === "build" &&
      !window.confirm(
        "This replaces the current IRIS skill base with entries from the uploaded file. Continue?"
      )
    ) {
      return;
    }

    setUploadMsg("");
    const formData = new FormData();
    formData.append("file", file);
    const res = await fetch(
      `/api/skill-base/iris?companyId=${selectedCompanyId}&mode=${mode}`,
      { method: "POST", body: formData }
    );
    const data = await res.json();
    if (!res.ok) {
      setUploadMsg(data.error || "Upload failed");
      return;
    }
    setUploadMsg(
      `${mode === "build" ? "Built" : "Merged"} IRIS skill base — ${data.entryCount} entries, ${data.codesFound} unique codes (${data.rowsRead} rows read)`
    );
    await loadData();
  };

  const handleNcUpload = async (mode: "build" | "merge", file: File) => {
    if (!selectedCompanyId) return;
    if (
      mode === "build" &&
      !window.confirm(
        "This replaces the current NC skill base with entries from the uploaded file. Continue?"
      )
    ) {
      return;
    }

    setUploadMsg("");
    const formData = new FormData();
    formData.append("file", file);
    const res = await fetch(
      `/api/skill-base/nc?companyId=${selectedCompanyId}&mode=${mode}`,
      { method: "POST", body: formData }
    );
    const data = await res.json();
    if (!res.ok) {
      setUploadMsg(data.error || "Upload failed");
      return;
    }
    setUploadMsg(
      `${mode === "build" ? "Built" : "Merged"} NC skill base — ${data.entryCount} entries, ${data.codesFound} unique codes (${data.rowsRead} rows read)`
    );
    await loadData();
  };

  const handleIrisRestore = async (version: number) => {
    if (!selectedCompanyId) return;
    if (!window.confirm(`Restore IRIS skill base to version ${version}?`)) return;

    setUploadMsg("");
    const res = await fetch(
      `/api/skill-base/iris/versions?companyId=${selectedCompanyId}&version=${version}`,
      { method: "POST" }
    );
    const data = await res.json();
    if (!res.ok) {
      setUploadMsg(data.error || "Restore failed");
      return;
    }
    setUploadMsg(`Restored version ${version} — ${data.count} entries`);
    await loadData();
  };

  const handleNcRestore = async (version: number) => {
    if (!selectedCompanyId) return;
    if (!window.confirm(`Restore NC skill base to version ${version}?`)) return;

    setUploadMsg("");
    const res = await fetch(
      `/api/skill-base/nc/versions?companyId=${selectedCompanyId}&version=${version}`,
      { method: "POST" }
    );
    const data = await res.json();
    if (!res.ok) {
      setUploadMsg(data.error || "Restore failed");
      return;
    }
    setUploadMsg(`Restored NC version ${version} — ${data.count} entries`);
    await loadData();
  };

  const handleDelete = async (type: "iris" | "nc") => {
    if (!selectedCompanyId) return;
    if (
      !window.confirm(
        "This permanently clears the skill base for this company. A version snapshot will be saved first."
      )
    ) {
      return;
    }

    setUploadMsg("");
    const res = await fetch(
      `/api/skill-base/${type}?companyId=${selectedCompanyId}`,
      { method: "DELETE" }
    );
    const data = await res.json();
    if (!res.ok) {
      setUploadMsg(data.error || "Delete failed");
      return;
    }
    setUploadMsg(`Deleted ${type.toUpperCase()} skill base`);
    await loadData();
  };

  const exportCsv = (type: "iris" | "nc") => {
    const data = type === "iris" ? irisData : ncData;
    let csv = "";
    if (type === "iris") {
      csv = "Type,Particular,IRIS Code,Top Code,Count,All Codes,Notes\n";
      for (const row of enrichIrisRows(data as IrisSkillEntry[])) {
        csv += `"${row.type || ""}","${row.particular}","${row.irisCode}","${row.topCode}",${row.topCount},"${row.allCodes}","${row.notes || ""}"\n`;
      }
    } else {
      csv = "Details,N/C\n";
      for (const row of data as NcSkillEntry[]) {
        csv += `"${row.details}","${row.nc}"\n`;
      }
    }
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${type}-skill-base.csv`;
    a.click();
  };

  const formatMergeStats = (v: SkillBaseVersion, type: "iris" | "nc") => {
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
  };

  const formatVersionSource = (source: SkillBaseVersion["source"]) => {
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
  };

  return (
    <div>
      <PageHeader
        title="Skill Bases"
        description="Manage per-company IRIS and Nominal Code lookup tables."
      />
      <CompanySelector />
      <CompanyGate>
        {uploadMsg && (
          <p className="mb-4 rounded-lg bg-muted px-4 py-2 text-sm">{uploadMsg}</p>
        )}

        <Tabs defaultValue="iris">
          <TabsList>
            <TabsTrigger value="iris">IRIS ({irisData.length})</TabsTrigger>
            <TabsTrigger value="nc">Nominal Codes ({ncData.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="iris">
            <Card>
              <div className="mb-4 flex flex-wrap items-center gap-2">
                <Button
                  size="sm"
                  onClick={() => irisBuildInputRef.current?.click()}
                >
                  <Upload className="h-4 w-4" />
                  Build New Skill Base
                </Button>
                <input
                  ref={irisBuildInputRef}
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleIrisUpload("build", f);
                    e.target.value = "";
                  }}
                />
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => irisMergeInputRef.current?.click()}
                >
                  <Upload className="h-4 w-4" />
                  Merge Into Skill Base
                </Button>
                <input
                  ref={irisMergeInputRef}
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleIrisUpload("merge", f);
                    e.target.value = "";
                  }}
                />
                <Button variant="secondary" size="sm" onClick={() => exportCsv("iris")}>
                  <Download className="h-4 w-4" />
                  Export CSV
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                  onClick={() => handleDelete("iris")}
                  disabled={irisData.length === 0}
                >
                  <Trash2 className="h-4 w-4" />
                  Delete IRIS Skill Base
                </Button>
              </div>

              {irisVersions.length > 0 && (
                <div className="mb-6 rounded-lg border bg-muted/30 p-4">
                  <div className="mb-2 flex items-center gap-2 text-sm font-medium">
                    <History className="h-4 w-4" />
                    Version history
                  </div>
                  <ul className="space-y-2 text-sm">
                    {irisVersions.map((v) => (
                      <li
                        key={v.version}
                        className="flex flex-wrap items-center justify-between gap-2 rounded border bg-background px-3 py-2"
                      >
                        <div>
                          <span>
                            Version {v.version} — {formatVersionSource(v.source)}
                            {v.fileName ? ` — ${v.fileName}` : ""} — {v.entryCount} entries
                            <span className="ml-2 text-xs text-muted-foreground">
                              {new Date(v.createdAt).toLocaleString()}
                            </span>
                          </span>
                          {formatMergeStats(v, "iris")}
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleIrisRestore(v.version)}
                        >
                          <RotateCcw className="h-3 w-3" />
                          Restore
                        </Button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {loading ? (
                <p className="text-sm text-muted-foreground">Loading…</p>
              ) : (
                <SkillBaseTable
                  data={irisTableData}
                  columns={[
                    { key: "type", header: "Type" },
                    { key: "particular", header: "Particular" },
                    { key: "irisCode", header: "IRIS Code" },
                    { key: "topCode", header: "Top Code" },
                    { key: "topCount", header: "Count" },
                    { key: "allCodes", header: "All Codes" },
                    { key: "notes", header: "Notes" },
                  ]}
                />
              )}
            </Card>
          </TabsContent>

          <TabsContent value="nc">
            <Card>
              <div className="mb-4 flex flex-wrap items-center gap-2">
                <Button
                  size="sm"
                  onClick={() => ncBuildInputRef.current?.click()}
                >
                  <Upload className="h-4 w-4" />
                  Build New Skill Base
                </Button>
                <input
                  ref={ncBuildInputRef}
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleNcUpload("build", f);
                    e.target.value = "";
                  }}
                />
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => ncMergeInputRef.current?.click()}
                >
                  <Upload className="h-4 w-4" />
                  Merge Into Skill Base
                </Button>
                <input
                  ref={ncMergeInputRef}
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleNcUpload("merge", f);
                    e.target.value = "";
                  }}
                />
                <Button variant="secondary" size="sm" onClick={() => exportCsv("nc")}>
                  <Download className="h-4 w-4" />
                  Export CSV
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                  onClick={() => handleDelete("nc")}
                  disabled={ncData.length === 0}
                >
                  <Trash2 className="h-4 w-4" />
                  Delete NC Skill Base
                </Button>
              </div>

              {ncVersions.length > 0 && (
                <div className="mb-6 rounded-lg border bg-muted/30 p-4">
                  <div className="mb-2 flex items-center gap-2 text-sm font-medium">
                    <History className="h-4 w-4" />
                    Version history
                  </div>
                  <ul className="space-y-2 text-sm">
                    {ncVersions.map((v) => (
                      <li
                        key={v.version}
                        className="flex flex-wrap items-center justify-between gap-2 rounded border bg-background px-3 py-2"
                      >
                        <div>
                          <span>
                            Version {v.version} — {formatVersionSource(v.source)}
                            {v.fileName ? ` — ${v.fileName}` : ""} — {v.entryCount} entries
                            <span className="ml-2 text-xs text-muted-foreground">
                              {new Date(v.createdAt).toLocaleString()}
                            </span>
                          </span>
                          {formatMergeStats(v, "nc")}
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleNcRestore(v.version)}
                        >
                          <RotateCcw className="h-3 w-3" />
                          Restore
                        </Button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {loading ? (
                <p className="text-sm text-muted-foreground">Loading…</p>
              ) : (
                <SkillBaseTable
                  data={ncData}
                  columns={[
                    { key: "details", header: "Details" },
                    { key: "nc", header: "N/C" },
                  ]}
                />
              )}
            </Card>
          </TabsContent>
        </Tabs>
      </CompanyGate>
    </div>
  );
}
