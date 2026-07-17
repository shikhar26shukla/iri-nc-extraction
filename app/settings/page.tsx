"use client";

import { useEffect, useState } from "react";
import { PageHeader, Card } from "@/components/layout/page-header";
import { Slider } from "@/components/ui/slider";
import { CheckCircle2, XCircle } from "lucide-react";

const THRESHOLD_KEY = "iris-nc-confidence-threshold";

export default function SettingsPage() {
  const [apiConfigured, setApiConfigured] = useState<boolean | null>(null);
  const [threshold, setThreshold] = useState(0.85);
  const [envThreshold, setEnvThreshold] = useState(0.85);

  useEffect(() => {
    fetch("/api/settings")
      .then((r) => r.json())
      .then((data) => {
        setApiConfigured(data.apiKeyConfigured);
        setEnvThreshold(data.confidenceThreshold);
        const stored = localStorage.getItem(THRESHOLD_KEY);
        setThreshold(
          stored ? parseFloat(stored) : data.confidenceThreshold
        );
      });
  }, []);

  const handleThresholdChange = (value: number[]) => {
    const v = value[0];
    setThreshold(v);
    localStorage.setItem(THRESHOLD_KEY, String(v));
  };

  return (
    <div>
      <PageHeader
        title="Settings"
        description="Configure processing options. API key is loaded from environment variables only."
      />

      <div className="grid gap-6 max-w-xl">
        <Card>
          <h3 className="text-sm font-semibold">Claude API</h3>
          <div className="mt-3 flex items-center gap-2">
            {apiConfigured === null ? (
              <span className="text-sm text-muted-foreground">Checking…</span>
            ) : apiConfigured ? (
              <>
                <CheckCircle2 className="h-5 w-5 text-green-600" />
                <span className="text-sm">API key configured via .env.local</span>
              </>
            ) : (
              <>
                <XCircle className="h-5 w-5 text-destructive" />
                <span className="text-sm">
                  API key not configured — add ANTHROPIC_API_KEY to .env.local
                </span>
              </>
            )}
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            For security, the API key is never stored in the browser or settings UI.
          </p>
        </Card>

        <Card>
          <h3 className="text-sm font-semibold">Match confidence threshold</h3>
          <p className="mt-1 text-xs text-muted-foreground">
            Server default: {envThreshold}. Local override stored in browser.
          </p>
          <div className="mt-4 space-y-2">
            <Slider
              value={[threshold]}
              min={0.5}
              max={1}
              step={0.05}
              onValueChange={handleThresholdChange}
            />
            <p className="text-sm font-medium">{threshold.toFixed(2)}</p>
          </div>
        </Card>

        <Card>
          <h3 className="text-sm font-semibold">Output format</h3>
          <p className="mt-1 text-sm text-muted-foreground">Excel (.xlsx)</p>
        </Card>

        <Card>
          <h3 className="text-sm font-semibold">Version</h3>
          <p className="mt-1 text-sm text-muted-foreground">1.0.0</p>
        </Card>
      </div>
    </div>
  );
}
