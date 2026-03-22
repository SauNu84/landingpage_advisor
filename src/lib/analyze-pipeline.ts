import { complete } from "@/lib/ai-provider";
import { scrapePage } from "@/lib/scraper";
import { buildUiDesignPrompt } from "@/lib/experts/ui-design";
import { buildUxResearchPrompt } from "@/lib/experts/ux-research";
import { buildExperimentPrompt } from "@/lib/experts/experiment";
import { buildContentPrompt } from "@/lib/experts/content";
import { buildSeoPrompt } from "@/lib/experts/seo";
import { buildPsychologyPrompt } from "@/lib/experts/psychology";
import { buildPostHogAdvisorPrompt } from "@/lib/posthog-advisor";
import { parseJsonResponse } from "@/lib/parse-json-response";
import type {
  ExpertName,
  ExpertAnalysis,
  AnalysisResult,
  PostHogAdvice,
} from "@/lib/experts/types";

async function callExpert(prompt: string): Promise<ExpertAnalysis> {
  const text = await complete(prompt, { maxTokens: 1024 });
  return parseJsonResponse(text) as ExpertAnalysis;
}

async function callPostHogAdvisor(prompt: string): Promise<PostHogAdvice> {
  const text = await complete(prompt, { maxTokens: 2048 });
  return parseJsonResponse(text) as PostHogAdvice;
}

export async function analyzePage(url: string): Promise<AnalysisResult> {
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
