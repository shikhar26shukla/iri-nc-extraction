import { NextRequest, NextResponse } from "next/server";
import { createCompany, listCompanies } from "@/lib/companies/store";

export async function GET() {
  const companies = await listCompanies();
  return NextResponse.json({ companies });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const name = String(body.name || "").trim();
    if (!name) {
      return NextResponse.json({ error: "Company name is required" }, { status: 400 });
    }
    const company = await createCompany(name);
    return NextResponse.json({ company });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create company" },
      { status: 500 }
    );
  }
}
