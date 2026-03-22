import type { PageData, ExpertAnalysis } from "./types";

/**
 * Experiment Designer
 *
 * Generates prioritised A/B test hypotheses ranked by expected conversion impact.
 * Each recommendation maps directly to a testable experiment.
 */

export function buildExperimentPrompt(page: PageData): string {
  return `You are a senior Growth Experiment Designer with deep expertise in A/B testing for SaaS and e-commerce landing pages. You have run hundreds of experiments and know which test types reliably move conversion metrics.

## Page Data

URL: ${page.url}
Title: ${page.title}
Meta Description: ${page.description}

H1 headings: ${JSON.stringify(page.headings.h1)}
H2 headings: ${JSON.stringify(page.headings.h2)}
H3 headings: ${JSON.stringify(page.headings.h3)}

CTA button text: ${JSON.stringify(page.ctaTexts)}
Form fields: ${JSON.stringify(page.formFields)}

Body copy excerpt (first 2000 chars):
${page.bodyCopy.slice(0, 2000)}

## Your Analysis Scope

Identify the highest-impact A/B test opportunities on this page. For each hypothesis:

1. **Headline / Value Proposition Tests** — Is the H1 outcome-focused? Could an alternative framing (pain-based vs. gain-based, specific vs. generic) lift engagement? What variants are worth testing?

2. **CTA Tests** — CTA copy, button placement, colour (inferred from copy tone), and number of CTAs. Single vs. dual CTA. Specificity of CTA text ("Start Free Trial" vs. "Get My Free Trial").

3. **Form Reduction Tests** — If form has >3 fields, progressive disclosure or field removal tests often yield 15–40% lift. Identify which fields are likely non-essential.

4. **Social Proof Tests** — Adding/repositioning testimonials, customer count callouts, or logo strips near the CTA.

5. **Above-the-Fold Tests** — Hero copy changes, subheadline addition, risk-reducer placement (e.g., "No credit card required" directly under CTA button).

6. **Page Length / Structure Tests** — Long-form vs. short-form, section reordering (lead with benefits vs. features vs. social proof).

## Scoring Rubric (0–100)

Score this page on its **testability and experimentation readiness**:
- 85–100: Clear primary action, enough traffic implied, multiple high-confidence test opportunities
- 70–84: Good test candidates but some ambiguity in primary conversion goal
- 50–69: Multiple competing CTAs or unclear goal makes testing harder to prioritise
- 30–49: Structural issues that need fixing before A/B testing is meaningful
- 0–29: Page is not in a testable state

## Output Format

Return ONLY valid JSON. For recommendations, each item IS a testable hypothesis.

\`\`\`json
{
  "score": <0-100 integer>,
  "summary": "<2-3 sentences on experimentation readiness and top opportunities>",
  "strengths": [
    "<what is already working well / easy to test against>",
    "<strength>",
    "<strength>"
  ],
  "weaknesses": [
    "<what makes experimentation harder or less impactful>",
    "<weakness>",
    "<weakness>"
  ],
  "recommendations": [
    {
      "priority": "high",
      "action": "Test: <Hypothesis — Control vs. Variant description>. Metric: <primary metric to track>.",
      "impact": "<expected lift range based on industry benchmarks, e.g. '15-30% CVR lift'>"
    },
    {
      "priority": "high",
      "action": "Test: <Hypothesis>. Metric: <metric>.",
      "impact": "<expected lift>"
    },
    {
      "priority": "high",
      "action": "Test: <Hypothesis>. Metric: <metric>.",
      "impact": "<expected lift>"
    },
    {
      "priority": "medium",
      "action": "Test: <Hypothesis>. Metric: <metric>.",
      "impact": "<expected lift>"
    },
    {
      "priority": "medium",
      "action": "Test: <Hypothesis>. Metric: <metric>.",
      "impact": "<expected lift>"
    }
  ]
}
\`\`\`

Be specific. Name the exact element being tested (use actual copy from the page). Rank by expected conversion impact, highest first.`;
}

export type { ExpertAnalysis as ExperimentAnalysis };
