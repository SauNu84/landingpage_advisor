import { NextRequest, NextResponse } from "next/server";
import { getProvider } from "@/lib/ai-provider";
import { analyzePage } from "@/lib/analyze-pipeline";
import { prisma } from "@/lib/db";
import { nanoid } from "nanoid";
import { getSessionFromRequest } from "@/lib/session";
import { checkAnalysisRateLimit, getClientIp } from "@/lib/rate-limit";
import type { AnalysisResult } from "@/lib/experts/types";
import { logger } from "@/lib/logger";

export interface ComparisonResult {
  url1: string;
  url2: string;
  result1: AnalysisResult;
  result2: AnalysisResult;
  analysedAt: string;
  slug: string;
}

export async function POST(request: NextRequest) {
  let url1: string;
  let url2: string;
  try {
    const body = await request.json();
    url1 = body?.url1;
    url2 = body?.url2;
    if (!url1 || typeof url1 !== "string" || !url2 || typeof url2 !== "string") {
      return NextResponse.json({ error: "url1 and url2 are required" }, { status: 400 });
    }
    new URL(url1);
    new URL(url2);
  } catch {
    return NextResponse.json(
      { error: "Invalid request body or URLs" },
      { status: 400 }
    );
  }

  const provider = getProvider();
  const hasKey =
    provider === "openai"
      ? !!process.env.OPENAI_API_KEY
      : !!process.env.ANTHROPIC_API_KEY;

  if (!hasKey) {
    return NextResponse.json(
      {
        error:
          provider === "openai"
            ? "OPENAI_API_KEY is not configured"
            : "ANTHROPIC_API_KEY is not configured",
      },
      { status: 500 }
    );
  }

  // Rate limiting — a comparison counts as 1 analysis
  const session = await getSessionFromRequest(request);
  const ip = getClientIp(request);
  const rateLimit = await checkAnalysisRateLimit(session?.userId ?? null, ip);

  if (!rateLimit.allowed) {
    return NextResponse.json(
      {
        error: session
          ? "Daily analysis limit reached (20/day). Please try again tomorrow."
          : "Daily analysis limit reached (3/day). Sign in for more analyses.",
        rateLimitExceeded: true,
      },
      { status: 429 }
    );
  }

  try {
    // Run both full pipelines in parallel
    const [result1, result2] = await Promise.all([
      analyzePage(url1),
      analyzePage(url2),
    ]);

    const slug = nanoid(8);
    await prisma.analysisResult.create({
      data: {
        slug,
        url: url1,
        data: JSON.stringify(result1),
        secondaryUrl: url2,
        secondaryData: JSON.stringify(result2),
        userId: session?.userId ?? null,
        ip,
      },
    });

    const comparison: ComparisonResult = {
      url1,
      url2,
      result1,
      result2,
      analysedAt: new Date().toISOString(),
      slug,
    };

    return NextResponse.json(comparison);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Comparison failed";
    logger.error("compare", "unhandled error", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
