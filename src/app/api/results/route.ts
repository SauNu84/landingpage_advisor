import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { nanoid } from "nanoid";

// POST /api/results — store an AnalysisResult and return its slug
export async function POST(request: NextRequest) {
  let url: string;
  let data: unknown;
  try {
    const body = await request.json();
    url = body?.url;
    data = body;
    if (!url || typeof url !== "string") {
      return NextResponse.json({ error: "url is required" }, { status: 400 });
    }
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const slug = nanoid(8);
  await prisma.analysisResult.create({
    data: { slug, url, data: JSON.stringify(data) },
  });

  return NextResponse.json({ slug });
}
