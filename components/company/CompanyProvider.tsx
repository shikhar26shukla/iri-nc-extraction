"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import type { Company } from "@/types";

interface CompanySummary extends Company {
  irisCount?: number;
  ncCount?: number;
}

interface CompanyContextValue {
  companies: CompanySummary[];
  selectedCompanyId: string | null;
  selectedCompany: CompanySummary | null;
  setSelectedCompanyId: (id: string | null) => void;
  refreshCompanies: () => Promise<void>;
  loading: boolean;
}

const STORAGE_KEY = "selectedCompanyId";

const CompanyContext = createContext<CompanyContextValue | null>(null);

export function CompanyProvider({ children }: { children: React.ReactNode }) {
  const [companies, setCompanies] = useState<CompanySummary[]>([]);
  const [selectedCompanyId, setSelectedCompanyIdState] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshCompanies = useCallback(async () => {
    const res = await fetch("/api/companies");
    const data = await res.json();
    setCompanies(data.companies || []);
  }, []);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) setSelectedCompanyIdState(stored);
    refreshCompanies().finally(() => setLoading(false));
  }, [refreshCompanies]);

  const setSelectedCompanyId = useCallback((id: string | null) => {
    setSelectedCompanyIdState(id);
    if (id) localStorage.setItem(STORAGE_KEY, id);
    else localStorage.removeItem(STORAGE_KEY);
  }, []);

  const selectedCompany =
    companies.find((c) => c.id === selectedCompanyId) || null;

  return (
    <CompanyContext.Provider
      value={{
        companies,
        selectedCompanyId,
        selectedCompany,
        setSelectedCompanyId,
        refreshCompanies,
        loading,
      }}
    >
      {children}
    </CompanyContext.Provider>
  );
}

export function useCompany() {
  const ctx = useContext(CompanyContext);
  if (!ctx) throw new Error("useCompany must be used within CompanyProvider");
  return ctx;
}
