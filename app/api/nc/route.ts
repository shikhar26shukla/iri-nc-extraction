import { NextRequest, NextResponse } from "next/server";
import { companyExists } from "@/lib/companies/store";
import { processNcFile } from "@/lib/nc/pipeline";
import {
  bufferToBase64,
  cleanupTempDir,
  createZipFromResults,
  ensureTempDir,
} from "@/lib/output/zip";

const MAX_FILE_SIZE = 20 * 1024 * 1024;

export async function POST(request: NextRequest) {
  try {
    await ensureTempDir();
    const formData = await request.formData();
    const companyId = String(formData.get("companyId") || "").trim();
    const files = formData.getAll("files") as File[];
    const wantZip = formData.get("zip") === "true";

    if (!companyId) {
      return NextResponse.json({ error: "companyId is required" }, { status: 400 });
    }
    if (!(await companyExists(companyId))) {
      return NextResponse.json({ error: "Company not found" }, { status: 404 });
    }
    if (!files.length) {
      return NextResponse.json({ error: "No files uploaded" }, { status: 400 });
    }

    const results = [];

    for (const file of files) {
      if (file.size > MAX_FILE_SIZE) {
        return NextResponse.json(
          { error: `File ${file.name} exceeds 20MB limit` },
          { status: 400 }
        );
      }

      const buffer = Buffer.from(await file.arrayBuffer());
      const processed = await processNcFile(buffer, file.name, companyId);
      results.push(processed);
    }

    if (wantZip && results.length > 1) {
      const zipBuffer = await createZipFromResults(results);
      return NextResponse.json({
        files: results.map((r) => ({
          originalName: r.originalName,
          outputName: r.outputName,
          data: bufferToBase64(r.buffer),
          log: r.log,
        })),
        zip: bufferToBase64(zipBuffer),
        zipName: "nc_results.zip",
      });
    }

    return NextResponse.json({
      files: results.map((r) => ({
        originalName: r.originalName,
        outputName: r.outputName,
        data: bufferToBase64(r.buffer),
        log: r.log,
      })),
    });
  } catch (error) {
    console.error("NC processing error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Processing failed" },
      { status: 500 }
    );
  } finally {
    await cleanupTempDir();
  }
}
