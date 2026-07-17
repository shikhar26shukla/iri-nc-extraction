import { NextRequest, NextResponse } from "next/server";
import { getCompany, updateCompany } from "@/lib/companies/store";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const company = await getCompany(id);
  if (!company) {
    return NextResponse.json({ error: "Company not found" }, { status: 404 });
  }
  return NextResponse.json({ company });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const updates: { name?: string; autoLearnIris?: boolean } = {};

    if (body.name !== undefined) updates.name = String(body.name);
    if (body.autoLearnIris !== undefined) {
      updates.autoLearnIris = Boolean(body.autoLearnIris);
    }

    const company = await updateCompany(id, updates);
    return NextResponse.json({ company });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Update failed" },
      { status: error instanceof Error && error.message.includes("not found") ? 404 : 500 }
    );
  }
}
