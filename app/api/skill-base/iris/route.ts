import { NextRequest, NextResponse } from "next/server";
import {
  companyExists,
  readCompanyKnowledgeBase,
  writeCompanyKnowledgeBase,
} from "@/lib/companies/store";
import { buildIrisSkillBaseFromWorkbook } from "@/lib/iris/build-skill-base";
import {
  snapshotIrisSkillBase,
  writeIrisSkillBaseWithSnapshot,
} from "@/lib/companies/skill-base-versions";
import { loadWorkbookBuffer } from "@/lib/excel/reader";
import type { IrisSkillEntry } from "@/types";

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
  const entries = await readCompanyKnowledgeBase<IrisSkillEntry>(companyId, "iris");
  return NextResponse.json({ entries, count: entries.length });
}

export async function POST(request: NextRequest) {
  try {
    const companyId = getCompanyId(request);
    if (!companyId) {
      return NextResponse.json({ error: "companyId is required" }, { status: 400 });
    }
    if (!(await companyExists(companyId))) {
      return NextResponse.json({ error: "Company not found" }, { status: 404 });
    }

    const modeParam = request.nextUrl.searchParams.get("mode") || "merge";
    if (modeParam !== "build" && modeParam !== "merge") {
      return NextResponse.json(
        { error: "mode must be build or merge" },
        { status: 400 }
      );
    }
    const mode = modeParam as "build" | "merge";

    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    if (!file) {
      return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const workbook = await loadWorkbookBuffer(buffer);
    const existing = await readCompanyKnowledgeBase<IrisSkillEntry>(companyId, "iris");
    const { entries, stats } = buildIrisSkillBaseFromWorkbook(
      workbook,
      mode,
      existing
    );

    await writeIrisSkillBaseWithSnapshot(companyId, entries, {
      source: mode,
      fileName: file.name,
      mergeStats: {
        entryCount: stats.entryCount,
        newParticulars: stats.newParticulars,
        updatedParticulars: stats.updatedParticulars,
        newCodes: stats.newCodes,
        duplicatesMerged: stats.duplicatesMerged,
      },
    });

    return NextResponse.json({
      success: true,
      mode,
      count: stats.entryCount,
      ...stats,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Upload failed" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const companyId = getCompanyId(request);
    if (!companyId) {
      return NextResponse.json({ error: "companyId is required" }, { status: 400 });
    }
    if (!(await companyExists(companyId))) {
      return NextResponse.json({ error: "Company not found" }, { status: 404 });
    }

    await snapshotIrisSkillBase(companyId, {
      source: "upload",
      fileName: "before-delete",
    });
    await writeCompanyKnowledgeBase(companyId, "iris", []);

    return NextResponse.json({ success: true, count: 0 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Delete failed" },
      { status: 500 }
    );
  }
}
