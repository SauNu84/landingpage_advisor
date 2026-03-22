import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

// GET /api/results/[slug] — fetch a stored AnalysisResult by slug
export async function GET(
  _request: NextRequest,
  { params }: { params: { slug: string } }
) {
  const record = await prisma.analysisResult.findUnique({
    where: { slug: params.slug },
  });

  if (!record) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json(JSON.parse(record.data));
}
