import * as cheerio from "cheerio";
import type { PageData, DomElement } from "./experts/types";

export async function scrapePage(url: string): Promise<PageData> {
  const response = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (compatible; LandingPageAdvisor/1.0; +https://github.com/martech)",
    },
    signal: AbortSignal.timeout(15000),
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.status} ${response.statusText}`);
  }

  const html = await response.text();
  const $ = cheerio.load(html);

  // Remove script and style content
  $("script, style, noscript").remove();

  // Title
  const title = $("title").text().trim() || $("h1").first().text().trim();

  // Meta description
  const description =
    $('meta[name="description"]').attr("content") ||
    $('meta[property="og:description"]').attr("content") ||
    "";

  // Meta tags (og, twitter, canonical)
  const metaTags: Record<string, string> = {};
  $("meta").each((_, el) => {
    const name =
      $(el).attr("name") ||
      $(el).attr("property") ||
      $(el).attr("http-equiv");
    const content = $(el).attr("content");
    if (name && content) {
      metaTags[name] = content;
    }
  });
  const canonical = $('link[rel="canonical"]').attr("href");
  if (canonical) metaTags["canonical"] = canonical;

  // Headings
  const h1: string[] = [];
  const h2: string[] = [];
  const h3: string[] = [];
  $("h1").each((_, el) => {
    const text = $(el).text().trim();
    if (text) h1.push(text);
  });
  $("h2").each((_, el) => {
    const text = $(el).text().trim();
    if (text) h2.push(text);
  });
  $("h3").each((_, el) => {
    const text = $(el).text().trim();
    if (text) h3.push(text);
  });

  // CTA button text
  const ctaTexts: string[] = [];
  $("button, a[href], input[type=submit], input[type=button]").each((_, el) => {
    const text =
      $(el).text().trim() || $(el).attr("value") || $(el).attr("aria-label");
    if (text && text.length < 100) {
      ctaTexts.push(text);
    }
  });

  // Form fields
  const formFields: string[] = [];
  $("input, textarea, select").each((_, el) => {
    const label = $(el).attr("placeholder") || $(el).attr("name") || $(el).attr("aria-label");
    if (label) formFields.push(label);
  });
  $("label").each((_, el) => {
    const text = $(el).text().trim();
    if (text) formFields.push(text);
  });

  // Visible body text (first 2000 chars)
  const bodyCopy = $("body").text().replace(/\s+/g, " ").trim().slice(0, 2000);

  // DOM elements for PostHog advisor
  const domElements: DomElement[] = [];
  $(
    "button, a[href], input, textarea, select, form, [data-track], [id], [class]"
  )
    .slice(0, 100)
    .each((_, el) => {
      const element: DomElement = {
        tag: el.type === "tag" ? el.name : el.type,
      };
      const id = $(el).attr("id");
      if (id) element.id = id;
      const cls = $(el).attr("class");
      if (cls) element.classes = cls.split(/\s+/).filter(Boolean).slice(0, 5);
      const text = $(el).clone().children().remove().end().text().trim();
      if (text && text.length < 80) element.text = text;
      const href = $(el).attr("href");
      if (href) element.href = href;
      const type = $(el).attr("type");
      if (type) element.type = type;
      const name = $(el).attr("name");
      if (name) element.name = name;
      const placeholder = $(el).attr("placeholder");
      if (placeholder) element.placeholder = placeholder;
      domElements.push(element);
    });

  return {
    url,
    title,
    description,
    headings: { h1, h2, h3 },
    ctaTexts: Array.from(new Set(ctaTexts)).slice(0, 20),
    formFields: Array.from(new Set(formFields)).slice(0, 20),
    metaTags,
    bodyCopy,
    domElements,
  };
}
