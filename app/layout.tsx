import type { Metadata } from "next";
import { HeaderNav } from "@/components/layout/header-nav";
import { CompanyProvider } from "@/components/company/CompanyProvider";
import "./globals.css";

export const metadata: Metadata = {
  title: "IRIS & Nominal Code Extractor",
  description: "Internal tool for IRIS and N/C code extraction",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <CompanyProvider>
          <div className="flex min-h-screen flex-col">
            <HeaderNav />
            <main className="flex-1 overflow-auto p-8">{children}</main>
          </div>
        </CompanyProvider>
      </body>
    </html>
  );
}
