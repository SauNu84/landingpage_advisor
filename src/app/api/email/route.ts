import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

// POST /api/email — capture email + slug association for a report
export async function POST(request: NextRequest) {
  let email: string;
  let slug: string;
  try {
    const body = await request.json();
    email = body?.email;
    slug = body?.slug;
    if (!email || typeof email !== "string" || !email.includes("@")) {
      return NextResponse.json({ error: "Valid email is required" }, { status: 400 });
    }
    if (!slug || typeof slug !== "string") {
      return NextResponse.json({ error: "slug is required" }, { status: 400 });
    }
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  await prisma.emailCapture.create({ data: { slug, email } });

  return NextResponse.json({ ok: true });
}
