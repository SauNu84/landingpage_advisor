/**
 * Expert pipeline barrel export.
 * Import from here to access all expert prompt builders and shared types.
 */

export * from "./types";
export { buildUiDesignPrompt } from "./ui-design";
export { buildUxResearchPrompt } from "./ux-research";
export { buildExperimentPrompt } from "./experiment";
export { buildContentPrompt } from "./content";
export { buildSeoPrompt } from "./seo";
export { buildPsychologyPrompt } from "./psychology";

import { buildUiDesignPrompt } from "./ui-design";
import { buildUxResearchPrompt } from "./ux-research";
import { buildExperimentPrompt } from "./experiment";
import { buildContentPrompt } from "./content";
import { buildSeoPrompt } from "./seo";
import { buildPsychologyPrompt } from "./psychology";
import type { PageData, ExpertName } from "./types";

/**
 * Map of expert name → prompt builder function.
 * Use this to run all experts in parallel via Promise.all.
 *
 * @example
 * const results = await Promise.all(
 *   Object.entries(EXPERT_PROMPT_BUILDERS).map(async ([name, buildPrompt]) => {
 *     const prompt = buildPrompt(pageData);
 *     const response = await anthropic.messages.create({
 *       model: "claude-sonnet-4-6",
 *       max_tokens: 1024,
 *       messages: [{ role: "user", content: prompt }],
 *     });
 *     return [name, JSON.parse(response.content[0].text)];
 *   })
 * );
 */
export const EXPERT_PROMPT_BUILDERS: Record<
  ExpertName,
  (page: PageData) => string
> = {
  "ui-design": buildUiDesignPrompt,
  "ux-research": buildUxResearchPrompt,
  experiment: buildExperimentPrompt,
  content: buildContentPrompt,
  seo: buildSeoPrompt,
  psychology: buildPsychologyPrompt,
};

export const EXPERT_LABELS: Record<ExpertName, string> = {
  "ui-design": "UI/Design System Analyst",
  "ux-research": "UX Research Designer",
  experiment: "Experiment Designer",
  content: "Content/Copy Analyst",
  seo: "SEO Expert",
  psychology: "Marketing Psychologist",
};
