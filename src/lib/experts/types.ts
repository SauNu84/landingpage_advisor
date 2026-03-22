/**
 * Shared TypeScript interfaces for the Landing Page Advisor expert pipeline.
 */

export interface PageData {
  url: string;
  title: string;
  description: string;
  headings: {
    h1: string[];
    h2: string[];
    h3: string[];
  };
  ctaTexts: string[];
  formFields: string[];
  metaTags: Record<string, string>;
  bodyCopy: string;
  /** Raw DOM element list for PostHog advisor */
  domElements?: DomElement[];
}

export interface DomElement {
  tag: string;
  id?: string;
  classes?: string[];
  text?: string;
  href?: string;
  type?: string; // for inputs
  name?: string;
  placeholder?: string;
}

export interface Recommendation {
  priority: "high" | "medium" | "low";
  action: string;
  impact: string;
}

export interface ExpertAnalysis {
  score: number;
  summary: string;
  strengths: string[];
  weaknesses: string[];
  recommendations: Recommendation[];
}

export interface TrackingPoint {
  element: string;
  event: string;
  properties?: Record<string, string | number | boolean>;
  codeSnippet: string;
  /** PostHog analysis type best suited for this event (e.g. "Funnel", "Trends", "Retention") */
  analysisType: string;
  /** Specific PostHog visualization to use (e.g. "Funnel chart", "Line trend", "Heatmap") */
  visualization: string;
  /** Business benefit of tracking this event */
  benefit: string;
}

export interface DashboardSuggestion {
  name: string;
  description: string;
  events: string[];
}

export interface PostHogAdvice {
  trackingPoints: TrackingPoint[];
  keyMetrics: string[];
  strategy: string;
  /** Suggested PostHog dashboards to build from these events */
  dashboards: DashboardSuggestion[];
}

export type ExpertName =
  | "ui-design"
  | "ux-research"
  | "experiment"
  | "content"
  | "seo"
  | "psychology";

export interface AnalysisResult {
  url: string;
  analysedAt: string;
  experts: Record<ExpertName, ExpertAnalysis>;
  posthog: PostHogAdvice;
}
