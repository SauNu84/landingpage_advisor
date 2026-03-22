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
import type {
  ExpertName,
  ExpertAnalysis,
  AnalysisResult,
  PostHogAdvice,
} from "@/lib/experts/types";

function parseJsonResponse(text: string): unknown {
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

async function analyzePage(url: string): Promise<AnalysisResult> {
  const page = await scrapePage(url);

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

  const postHogPrompt = buildPostHogAdvisorPrompt(page, experts);
  const posthog = await callPostHogAdvisor(postHogPrompt);

  return {
    url,
    analysedAt: new Date().toISOString(),
    experts,
    posthog,
  };
}

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
    console.error("[compare] error:", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
