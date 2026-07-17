import { NextRequest, NextResponse } from "next/server";
import { companyExists } from "@/lib/companies/store";
import {
  listNcVersions,
  restoreNcVersion,
} from "@/lib/companies/nc-skill-base-versions";

function getCompanyId(request: NextRequest): string | null {
  return request.nextUrl.searchParams.get("companyId");
}

export async function GET(request: NextRequest) {
  const companyId = getCompanyId(request);
  if (!companyId) {
    return NextResponse.json({ error: "companyId is required" }, { status: 400 });
  }
  if (!(await companyExists(companyId))) {
    return NextResponse.json({ error: "Company not found" }, { status: 404 });
  }

  const versions = await listNcVersions(companyId);
  return NextResponse.json({ versions });
}

export async function POST(request: NextRequest) {
  try {
    const companyId = getCompanyId(request);
    const versionParam = request.nextUrl.searchParams.get("version");
    if (!companyId) {
      return NextResponse.json({ error: "companyId is required" }, { status: 400 });
    }
    if (!versionParam) {
      return NextResponse.json({ error: "version is required" }, { status: 400 });
    }
    const version = parseInt(versionParam, 10);
    if (Number.isNaN(version) || version < 1) {
      return NextResponse.json({ error: "Invalid version" }, { status: 400 });
    }
    if (!(await companyExists(companyId))) {
      return NextResponse.json({ error: "Company not found" }, { status: 404 });
    }

    const { restored } = await restoreNcVersion(companyId, version);
    return NextResponse.json({
      success: true,
      version,
      count: restored.length,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Restore failed" },
      { status: 500 }
    );
  }
}
