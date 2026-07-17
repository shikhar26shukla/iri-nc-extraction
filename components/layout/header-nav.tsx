"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  FileSpreadsheet,
  Settings,
  Database,
  Landmark,
  Building2,
} from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/companies", label: "Companies", icon: Building2 },
  { href: "/iris", label: "IRIS Extractor", icon: Landmark },
  { href: "/nc", label: "Nominal Code Extractor", icon: FileSpreadsheet },
  { href: "/skill-bases", label: "Skill Bases", icon: Database },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function HeaderNav() {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-50 border-b bg-card">
      <div className="flex flex-wrap items-center gap-x-6 gap-y-3 px-6 py-3">
        <div className="shrink-0">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Internal Tool
          </p>
          <h1 className="text-lg font-semibold leading-tight">IRIS &amp; N/C</h1>
        </div>

        <nav className="flex flex-1 flex-wrap items-center gap-1">
          {navItems.map(({ href, label, icon: Icon }) => {
            const active = pathname === href || pathname.startsWith(`${href}/`);
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  "flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors whitespace-nowrap",
                  active
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                )}
              >
                <Icon className="h-4 w-4 shrink-0" />
                {label}
              </Link>
            );
          })}
        </nav>

        <span className="hidden text-xs text-muted-foreground sm:inline">
          v1.0.0
        </span>
      </div>
    </header>
  );
}
