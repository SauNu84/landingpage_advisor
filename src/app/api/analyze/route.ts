import { NextRequest, NextResponse } from "next/server";
import { complete, getProvider } from "@/lib/ai-provider";
import { scrapePage } from "@/lib/scraper";
import { buildUiDesignPrompt } from "@/lib/experts/ui-design";
import { buildUxResearchPrompt } from "@/lib/experts/ux-research";
import { buildExperimentPrompt } from "@/lib/experts/experiment";
import { buildContentPrompt } from "@/lib/experts/content";
import { buildSeoPrompt } from "@/lib/experts/seo";
import { buildPsychologyPrompt } from "@/lib/experts/psychology";
import { buildPostHogAdvisorPrompt } from "@/lib/posthog-advisor";
import { prisma } from "@/lib/db";
import { nanoid } from "nanoid";
import { getSessionFromRequest } from "@/lib/session";
import { checkAnalysisRateLimit, getClientIp } from "@/lib/rate-limit";
import type {
  ExpertName,
  ExpertAnalysis,
  AnalysisResult,
  PostHogAdvice,
} from "@/lib/experts/types";

function parseJsonResponse(text: string): unknown {
  // Strip markdown code fences if present
  const cleaned = text
    .replace(/^```(?:json)?\s*/m, "")
    .replace(/\s*```\s*$/m, "")
    .trim();
  return JSON.parse(cleaned);
}

async function callExpert(prompt: string): Promise<ExpertAnalysis> {
  const text = await complete(prompt, { maxTokens: 1024 });
  return parseJsonResponse(text) as ExpertAnalysis;
}

async function callPostHogAdvisor(prompt: string): Promise<PostHogAdvice> {
  const text = await complete(prompt, { maxTokens: 2048 });
  return parseJsonResponse(text) as PostHogAdvice;
}

export async function POST(request: NextRequest) {
  let url: string;
  try {
    const body = await request.json();
    url = body?.url;
    if (!url || typeof url !== "string") {
      return NextResponse.json({ error: "url is required" }, { status: 400 });
    }
    // Validate URL
    new URL(url);
  } catch {
    return NextResponse.json(
      { error: "Invalid request body or URL" },
      { status: 400 }
    );
  }

  // Validate at least one AI provider key is configured
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

  // Rate limiting
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
    // Step 1: Scrape the page
    const page = await scrapePage(url);

    // Step 2: Run 6 expert analyses in parallel
    const expertPrompts: Record<ExpertName, string> = {
      "ui-design": buildUiDesignPrompt(page),
      "ux-research": buildUxResearchPrompt(page),
      experiment: buildExperimentPrompt(page),
      content: buildContentPrompt(page),
      seo: buildSeoPrompt(page),
      psychology: buildPsychologyPrompt(page),
    };

    const expertNames = Object.keys(expertPrompts) as ExpertName[];
    const expertResults = await Promise.all(
      expertNames.map((name) => callExpert(expertPrompts[name]))
    );

    const experts = Object.fromEntries(
      expertNames.map((name, i) => [name, expertResults[i]])
    ) as Record<ExpertName, ExpertAnalysis>;

    // Step 3: Run PostHog advisor after experts complete
    const postHogPrompt = buildPostHogAdvisorPrompt(page, experts);
    const posthog = await callPostHogAdvisor(postHogPrompt);

    const result: AnalysisResult = {
      url,
      analysedAt: new Date().toISOString(),
      experts,
      posthog,
    };

    // Persist result and generate shareable slug
    const slug = nanoid(8);
    await prisma.analysisResult.create({
      data: {
        slug,
        url,
        data: JSON.stringify(result),
        userId: session?.userId ?? null,
        ip,
      },
    });

    return NextResponse.json({ ...result, slug });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Analysis failed";
    console.error("[analyze] error:", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
