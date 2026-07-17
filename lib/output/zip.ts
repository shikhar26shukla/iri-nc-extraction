import fs from "fs/promises";
import path from "path";
import JSZip from "jszip";
import type { ProcessedFileResult } from "@/types";

export async function createZipFromResults(
  results: ProcessedFileResult[]
): Promise<Buffer> {
  const zip = new JSZip();
  for (const result of results) {
    zip.file(result.outputName, result.buffer);
  }
  return zip.generateAsync({ type: "nodebuffer" });
}

export async function ensureTempDir(): Promise<string> {
  const dir = path.join(process.cwd(), "tmp", "uploads");
  await fs.mkdir(dir, { recursive: true });
  return dir;
}

export async function cleanupTempDir(): Promise<void> {
  const dir = path.join(process.cwd(), "tmp", "uploads");
  try {
    const files = await fs.readdir(dir);
    await Promise.all(files.map((f) => fs.unlink(path.join(dir, f))));
  } catch {
    // ignore missing dir
  }
}

export function bufferToBase64(buffer: Buffer): string {
  return buffer.toString("base64");
}

export function base64ToBuffer(base64: string): Buffer {
  return Buffer.from(base64, "base64");
}
