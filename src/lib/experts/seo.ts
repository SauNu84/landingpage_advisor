import type { PageData, ExpertAnalysis } from "./types";

/**
 * SEO Expert
 *
 * Evaluates meta tags, heading structure, keyword presence, OG tags,
 * and schema markup signals from the scraped page data.
 */

export function buildSeoPrompt(page: PageData): string {
  const metaTagsFormatted = Object.entries(page.metaTags)
    .map(([k, v]) => `  ${k}: ${v}`)
    .join("\n");

  return `You are a senior SEO Specialist with deep expertise in on-page SEO, technical SEO signals, and AI search optimisation (AEO/GEO). You audit landing pages to maximise organic search visibility and click-through rates.

## Page Data

URL: ${page.url}
Title: ${page.title}
Meta Description: ${page.description}

H1 headings: ${JSON.stringify(page.headings.h1)}
H2 headings: ${JSON.stringify(page.headings.h2)}
H3 headings: ${JSON.stringify(page.headings.h3)}

CTA button text: ${JSON.stringify(page.ctaTexts)}
Form fields: ${JSON.stringify(page.formFields)}

All meta tags detected:
${metaTagsFormatted || "  (none detected)"}

Body copy (first 2500 chars):
${page.bodyCopy.slice(0, 2500)}

## Your Analysis Scope

Evaluate these dimensions:

1. **Title Tag** — Is it present and within 50–60 characters? Does it include the primary keyword near the front? Is it compelling enough to earn a click from SERPs? Does it match the H1 intent?

2. **Meta Description** — Is it present and within 150–160 characters? Does it include a CTA or value hook? Does it reinforce the title tag with secondary keywords?

3. **Heading Structure** — Is there exactly one H1? Does the H1 contain the primary target keyword? Are H2s used to signal topical sections (not just visual design)? Do H3s expand on H2 topics logically?

4. **Keyword Presence and Density** — Based on the page title, headings, and body copy, what is the apparent target keyword? Is it present in the H1, at least one H2, and the opening paragraph of body copy? Is keyword density natural or is the page over/under-optimised?

5. **Open Graph / Social Meta Tags** — Is og:title present? og:description? og:image? og:url? Are Twitter Card tags present (twitter:card, twitter:title, twitter:description)? Missing OG tags hurt social sharing and can reduce referral traffic.

6. **Schema Markup Signals** — Are there any structured data indicators in the meta tags (e.g., JSON-LD references, schema.org)? What schema types would benefit this page (Organization, WebPage, Product, FAQPage, BreadcrumbList)?

7. **URL Structure** — Based on the URL, is it clean, keyword-rich, and human-readable? Avoid parameter-heavy or auto-generated URLs.

8. **AI Search Optimisation (AEO/GEO)** — Does the content directly answer likely user questions? Is there a clear entity definition (what is this product, who is it for)? Would an AI model summarising this page get the value prop right?

## Scoring Rubric (0–100)

- 85–100: Complete on-page SEO, strong keyword signals, full OG tags, schema-ready
- 70–84: Good SEO foundation with a few addressable gaps
- 50–69: Missing key on-page elements (title, meta description, or OG tags incomplete)
- 30–49: Significant SEO gaps — likely ranking below potential
- 0–29: Critical SEO errors (missing H1, no title tag, duplicate/missing meta)

## Output Format

Return ONLY valid JSON — no markdown, no explanation outside the JSON object.

\`\`\`json
{
  "score": <0-100 integer>,
  "summary": "<2-3 sentence executive summary of SEO health and biggest opportunity>",
  "strengths": [
    "<specific SEO strength with reference to actual tag/content>",
    "<specific strength>",
    "<specific strength>"
  ],
  "weaknesses": [
    "<specific SEO gap with reference to actual missing/weak element>",
    "<specific weakness>",
    "<specific weakness>"
  ],
  "recommendations": [
    {
      "priority": "high",
      "action": "<concrete SEO fix — include suggested tag values where possible>",
      "impact": "<expected organic ranking or CTR improvement>"
    },
    {
      "priority": "high",
      "action": "<concrete action with suggested value>",
      "impact": "<expected impact>"
    },
    {
      "priority": "medium",
      "action": "<concrete action>",
      "impact": "<expected impact>"
    },
    {
      "priority": "medium",
      "action": "<concrete action>",
      "impact": "<expected impact>"
    },
    {
      "priority": "low",
      "action": "<concrete action>",
      "impact": "<expected impact>"
    }
  ]
}
\`\`\`

Be specific. Reference actual tag values and headings from the page. Suggest exact copy for title tags and meta descriptions where improvements are needed.`;
}

export type { ExpertAnalysis as SeoAnalysis };
