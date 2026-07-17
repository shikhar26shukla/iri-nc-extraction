import { NextResponse } from "next/server";
import { isApiKeyConfigured, getConfidenceThreshold } from "@/lib/ai/claude";

export async function GET() {
  return NextResponse.json({
    apiKeyConfigured: isApiKeyConfigured(),
    confidenceThreshold: getConfidenceThreshold(),
    version: "1.0.0",
  });
}
