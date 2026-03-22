import type { PageData, ExpertAnalysis, PostHogAdvice, ExpertName } from "./experts/types";

/**
 * PostHog Tracking Advisor
 *
 * Receives all 6 expert analyses + scraped DOM elements and outputs:
 * - Specific PostHog events to capture (with element selectors)
 * - Copy-paste JS code snippets for each event
 * - Key metrics to watch in PostHog dashboard
 * - Tracking strategy summary
 */

export function buildPostHogAdvisorPrompt(
  page: PageData,
  expertAnalyses: Record<ExpertName, ExpertAnalysis>
): string {
  const domList = page.domElements
    ? page.domElements
        .map((el) => {
          const parts = [el.tag];
          if (el.id) parts.push(`#${el.id}`);
          if (el.classes?.length) parts.push(`.${el.classes.join(".")}`);
          if (el.text) parts.push(`"${el.text.slice(0, 60)}"`);
          if (el.type) parts.push(`[type=${el.type}]`);
          if (el.name) parts.push(`[name=${el.name}]`);
          if (el.href) parts.push(`href="${el.href.slice(0, 80)}"`);
          return parts.join(" ");
        })
        .join("\n")
    : "(DOM elements not available — use semantic inference from page data)";

  const analysisJson = JSON.stringify(expertAnalyses, null, 2);

  return `You are a PostHog tracking specialist and growth engineer. Your job is to translate landing page expert analyses and DOM structure into a precise PostHog event tracking plan with copy-paste JavaScript snippets.

## Page Data

URL: ${page.url}
Title: ${page.title}

CTA buttons: ${JSON.stringify(page.ctaTexts)}
Form fields: ${JSON.stringify(page.formFields)}

## DOM Elements

${domList}

## Expert Analyses Summary

The following experts have analysed this page. Use their findings to prioritise which interactions matter most:

${analysisJson}

## Your Task

Design a comprehensive PostHog event tracking plan for this landing page. Focus on events that measure:

1. **Conversion funnel** — CTA clicks, form interactions, form submissions
2. **Engagement signals** — Scroll depth milestones (25%, 50%, 75%, 100%), time on page
3. **Section engagement** — Which sections do users interact with before converting?
4. **Drop-off points** — Where do users abandon the page or the form?
5. **Social proof engagement** — Do users interact with testimonials, pricing tables, or feature sections?
6. **Exit intent** — Capturing exit events for retargeting

## Event Naming Convention

Use snake_case. Pattern: \`<object>_<action>\`
Examples: \`cta_clicked\`, \`form_submitted\`, \`pricing_viewed\`, \`hero_scrolled_past\`

## Code Snippet Requirements

Each snippet must be:
- Self-contained and copy-paste ready
- Include element selector strategy (ID > class > text content)
- Use \`posthog.capture()\` with relevant properties
- Work with standard PostHog JS SDK (\`posthog-js\`)

## PostHog Analysis Types Reference

Use these exact values for \`analysisType\` and \`visualization\`:

| analysisType | visualization | Best for |
|---|---|---|
| Funnel | Funnel chart | Conversion step sequences (page_viewed → cta_clicked → form_submitted) |
| Trends | Line trend chart | Volume over time, daily/weekly event counts |
| Retention | Retention table | Do users who click CTA return? |
| Session Recording | Session replay | Understand exactly how users interact before converting |
| Heatmap | Click heatmap | Which page areas get the most attention |
| Correlation | Correlation analysis | Which events correlate with conversion |
| User Paths | Sankey diagram | What users do before/after a key event |
| Feature Flags | A/B test results | Experiment variants tracked via this event |

## Output Format

Return ONLY valid JSON — no markdown, no explanation outside the JSON object.

\`\`\`json
{
  "trackingPoints": [
    {
      "element": "<human-readable element description, e.g. 'Hero CTA button'>",
      "event": "<snake_case_event_name>",
      "properties": {
        "<property_key>": "<property_value_or_dynamic_placeholder>"
      },
      "codeSnippet": "<complete copy-paste JS snippet — escape newlines as \\n>",
      "analysisType": "<PostHog analysis type from the reference table above>",
      "visualization": "<PostHog visualization name from the reference table above>",
      "benefit": "<1-2 sentence business benefit: what decision or optimisation this event enables>"
    }
  ],
  "keyMetrics": [
    "<event_name_1>",
    "<event_name_2>",
    "<event_name_3>",
    "<event_name_4>",
    "<event_name_5>"
  ],
  "strategy": "<3-5 sentence strategy summary: what to measure first, what funnel to build in PostHog, and how to connect these events to the top conversion opportunities identified by the expert panel>",
  "dashboards": [
    {
      "name": "<dashboard name, e.g. 'Conversion Funnel'>",
      "description": "<1 sentence: what this dashboard shows and the decision it supports>",
      "events": ["<event_name_1>", "<event_name_2>", "<event_name_3>"]
    }
  ]
}
\`\`\`

## Guidance

- Generate 8–15 tracking points (not just CTAs — cover the full page journey)
- Prioritise events that connect to the top recommendations from the expert analyses
- For scroll depth tracking, provide a single reusable Intersection Observer snippet
- For form fields, track both \`field_focused\` and \`form_submitted\` separately
- Include at least one funnel-worthy event sequence (e.g., page_viewed → cta_clicked → form_submitted)
- All code snippets must assume \`posthog\` is already initialised globally
- Generate 3–5 dashboard suggestions that group events into actionable monitoring views
- Each benefit should name the specific optimisation decision it unlocks (e.g. "Identify which CTA variant drives more sign-ups")

Reference the expert weaknesses and high-priority recommendations to justify your event selection.`;
}

export type { PostHogAdvice };
