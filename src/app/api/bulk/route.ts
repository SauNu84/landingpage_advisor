import { NextRequest, NextResponse } from "next/server";
import { getProvider } from "@/lib/ai-provider";
import { analyzePage } from "@/lib/analyze-pipeline";
import { prisma } from "@/lib/db";
import { nanoid } from "nanoid";
import { getSessionFromRequest } from "@/lib/session";
import { checkAnalysisRateLimit, getClientIp } from "@/lib/rate-limit";
import type { BulkAnalysisResult } from "@/lib/experts/types";

export async function POST(request: NextRequest) {
  let urls: string[];
  try {
    const body = await request.json();
    const raw: unknown[] = body?.urls;

    if (!Array.isArray(raw) || raw.length === 0) {
      return NextResponse.json(
        { error: "urls must be a non-empty array" },
        { status: 400 }
      );
    }

    // Validate and normalise each URL
    const parsed = raw.map((u) => {
      if (typeof u !== "string") throw new Error("Each URL must be a string");
      const trimmed = u.trim();
      const p = new URL(trimmed);
      if (p.protocol !== "http:" && p.protocol !== "https:") {
        throw new Error(`Invalid protocol for URL: ${trimmed}`);
      }
      return trimmed;
    });

    // Deduplicate
    urls = Array.from(new Set(parsed));

    if (urls.length < 3) {
      return NextResponse.json(
        { error: "Please provide at least 3 unique URLs." },
        { status: 400 }
      );
    }
    if (urls.length > 10) {
      return NextResponse.json(
        { error: "Please provide no more than 10 URLs." },
        { status: 400 }
      );
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Invalid request body or URLs";
    return NextResponse.json({ error: message }, { status: 400 });
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

  // Rate limiting — bulk counts as 1 analysis
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
    // Run all analyses in parallel
    const results = await Promise.all(urls.map((url) => analyzePage(url)));

    const slug = nanoid(8);
    const bulkResult: BulkAnalysisResult = {
      type: "bulk",
      urls,
      results,
      analysedAt: new Date().toISOString(),
      slug,
    };

    await prisma.analysisResult.create({
      data: {
        slug,
        url: urls[0],
        data: JSON.stringify(bulkResult),
        userId: session?.userId ?? null,
        ip,
      },
    });

    return NextResponse.json(bulkResult);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Bulk analysis failed";
    console.error("[bulk] error:", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
