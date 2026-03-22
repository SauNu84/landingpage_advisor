/**
 * Tests: src/app/api/analyze/route.ts
 * URL validation, rate limiting, provider key check, 500 on AI failure
 */

// ── mocks ──────────────────────────────────────────────────────────────────
jest.mock("@/lib/db", () => ({
  prisma: {
    analysisResult: { count: jest.fn(), create: jest.fn() },
    postHogConfig: { findUnique: jest.fn() },
  },
}));
jest.mock("@/lib/scraper", () => ({ scrapePage: jest.fn() }));
jest.mock("@/lib/ai-provider", () => ({
  complete: jest.fn(),
  getProvider: jest.fn(() => "claude"),
}));
jest.mock("@/lib/session", () => ({
  getSessionFromRequest: jest.fn(() => Promise.resolve(null)),
}));
jest.mock("@/lib/rate-limit", () => ({
  checkAnalysisRateLimit: jest.fn(() =>
    Promise.resolve({ allowed: true, limit: 10, remaining: 9 })
  ),
  getClientIp: jest.fn(() => "127.0.0.1"),
}));

import { POST } from "@/app/api/analyze/route";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { scrapePage } from "@/lib/scraper";
import { complete } from "@/lib/ai-provider";
import { checkAnalysisRateLimit } from "@/lib/rate-limit";

const mockScrapePage = scrapePage as jest.MockedFunction<typeof scrapePage>;
const mockComplete = complete as jest.MockedFunction<typeof complete>;
const mockRateLimit = checkAnalysisRateLimit as jest.MockedFunction<
  typeof checkAnalysisRateLimit
>;
const mockCreate = prisma.analysisResult.create as jest.MockedFunction<
  typeof prisma.analysisResult.create
>;

function makeReq(body: unknown) {
  return new NextRequest("http://localhost/api/analyze", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

const fakePageData = {
  url: "https://example.com",
  title: "Example",
  description: "",
  headings: { h1: [], h2: [], h3: [] },
  ctaTexts: [],
  formFields: [],
  metaTags: {},
  bodyCopy: "Example content",
};

const fakeExpertJson = JSON.stringify({
  score: 75,
  summary: "Good",
  strengths: ["Clear headline"],
  weaknesses: ["No CTA"],
  recommendations: [],
});

const fakePostHogJson = JSON.stringify({
  trackingPoints: [],
  keyMetrics: [],
  strategy: "Track everything",
  dashboards: [],
});

beforeEach(() => {
  jest.clearAllMocks();
  process.env.ANTHROPIC_API_KEY = "sk-test-key";
  mockCreate.mockResolvedValue({ id: "id1", slug: "abc12345" } as never);
});

afterEach(() => {
  delete process.env.ANTHROPIC_API_KEY;
});

// ── validation ─────────────────────────────────────────────────────────────

describe("POST /api/analyze — input validation", () => {
  it("returns 400 when url is missing", async () => {
    const res = await POST(makeReq({}));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/url/i);
  });

  it("returns 400 when url is not a string", async () => {
    const res = await POST(makeReq({ url: 123 }));
    expect(res.status).toBe(400);
  });

  it("returns 400 for an invalid URL format", async () => {
    const res = await POST(makeReq({ url: "not-a-url" }));
    expect(res.status).toBe(400);
  });

  it("returns 400 for an empty body", async () => {
    const req = new NextRequest("http://localhost/api/analyze", {
      method: "POST",
      body: "{{invalid json",
      headers: { "Content-Type": "application/json" },
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });
});

// ── provider key check ─────────────────────────────────────────────────────

describe("POST /api/analyze — provider key check", () => {
  it("returns 500 when ANTHROPIC_API_KEY is not set", async () => {
    delete process.env.ANTHROPIC_API_KEY;
    const res = await POST(makeReq({ url: "https://example.com" }));
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toMatch(/ANTHROPIC_API_KEY/i);
  });
});

// ── rate limiting ──────────────────────────────────────────────────────────

describe("POST /api/analyze — rate limiting", () => {
  it("returns 429 when rate limit exceeded", async () => {
    mockRateLimit.mockResolvedValueOnce({
      allowed: false,
      limit: 10,
      remaining: 0,
    });
    const res = await POST(makeReq({ url: "https://example.com" }));
    expect(res.status).toBe(429);
    const body = await res.json();
    expect(body.rateLimitExceeded).toBe(true);
  });
});

// ── success path ───────────────────────────────────────────────────────────

describe("POST /api/analyze — success", () => {
  beforeEach(() => {
    mockScrapePage.mockResolvedValue(fakePageData as never);
    // 6 expert calls + 1 PostHog advisor call
    mockComplete
      .mockResolvedValueOnce(fakeExpertJson) // ui-design
      .mockResolvedValueOnce(fakeExpertJson) // ux-research
      .mockResolvedValueOnce(fakeExpertJson) // experiment
      .mockResolvedValueOnce(fakeExpertJson) // content
      .mockResolvedValueOnce(fakeExpertJson) // seo
      .mockResolvedValueOnce(fakeExpertJson) // psychology
      .mockResolvedValueOnce(fakePostHogJson); // posthog advisor
  });

  it("returns 200 with slug and expert scores", async () => {
    const res = await POST(makeReq({ url: "https://example.com" }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.slug).toBeDefined();
    expect(body.experts).toBeDefined();
    expect(Object.keys(body.experts)).toHaveLength(6);
  });

  it("persists result in DB", async () => {
    await POST(makeReq({ url: "https://example.com" }));
    expect(mockCreate).toHaveBeenCalledTimes(1);
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ url: "https://example.com" }),
      })
    );
  });

  it("returns 500 when AI call throws", async () => {
    mockScrapePage.mockResolvedValue(fakePageData as never);
    // Reset queued once-values and set a universal rejection
    mockComplete.mockReset();
    mockComplete.mockRejectedValue(new Error("AI timeout"));
    const res = await POST(makeReq({ url: "https://example.com" }));
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toMatch(/AI timeout/);
  });
});
