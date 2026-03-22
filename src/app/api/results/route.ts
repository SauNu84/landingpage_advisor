import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { nanoid } from "nanoid";
import { getSessionFromRequest } from "@/lib/session";

// POST /api/results — store an AnalysisResult and return its slug
export async function POST(request: NextRequest) {
  const session = await getSessionFromRequest(request);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
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
    data: { slug, url, data: JSON.stringify(data), userId: session.userId },
  });

  return NextResponse.json({ slug });
}
