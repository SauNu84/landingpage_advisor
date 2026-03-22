/**
 * Tests: src/app/api/bulk/route.ts
 * 3–10 URL validation, deduplication, rate limit, partial-failure behaviour
 */

jest.mock("@/lib/db", () => ({
  prisma: {
    analysisResult: { count: jest.fn(), create: jest.fn() },
  },
}));
jest.mock("@/lib/analyze-pipeline", () => ({ analyzePage: jest.fn() }));
jest.mock("@/lib/ai-provider", () => ({ getProvider: jest.fn(() => "claude") }));
jest.mock("@/lib/session", () => ({
  getSessionFromRequest: jest.fn(() => Promise.resolve(null)),
}));
jest.mock("@/lib/rate-limit", () => ({
  checkAnalysisRateLimit: jest.fn(() =>
    Promise.resolve({ allowed: true, limit: 10, remaining: 9 })
  ),
  getClientIp: jest.fn(() => "127.0.0.1"),
}));

import { POST } from "@/app/api/bulk/route";
import { NextRequest } from "next/server";
import { analyzePage } from "@/lib/analyze-pipeline";
import { checkAnalysisRateLimit } from "@/lib/rate-limit";
import { prisma } from "@/lib/db";

const mockAnalyzePage = analyzePage as jest.MockedFunction<typeof analyzePage>;
const mockRateLimit = checkAnalysisRateLimit as jest.MockedFunction<
  typeof checkAnalysisRateLimit
>;
const mockCreate = prisma.analysisResult.create as jest.MockedFunction<
  typeof prisma.analysisResult.create
>;

function makeReq(body: unknown) {
  return new NextRequest("http://localhost/api/bulk", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

const fakeResult = {
  url: "https://example.com",
  analysedAt: "2026-03-22T00:00:00.000Z",
  experts: {},
  posthog: { trackingPoints: [], keyMetrics: [], strategy: "", dashboards: [] },
};

beforeEach(() => {
  jest.clearAllMocks();
  process.env.ANTHROPIC_API_KEY = "sk-test";
  mockCreate.mockResolvedValue({ id: "x", slug: "bulk1234" } as never);
});

afterEach(() => {
  delete process.env.ANTHROPIC_API_KEY;
});

// ── URL count validation ────────────────────────────────────────────────────

describe("POST /api/bulk — URL count validation", () => {
  it("returns 400 when no urls field provided", async () => {
    const res = await POST(makeReq({}));
    expect(res.status).toBe(400);
  });

  it("returns 400 when urls is empty array", async () => {
    const res = await POST(makeReq({ urls: [] }));
    expect(res.status).toBe(400);
  });

  it("returns 400 for fewer than 3 unique URLs", async () => {
    const res = await POST(makeReq({ urls: ["https://a.com", "https://b.com"] }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/3/);
  });

  it("returns 400 for more than 10 URLs", async () => {
    const urls = Array.from({ length: 11 }, (_, i) => `https://site${i}.com`);
    const res = await POST(makeReq({ urls }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/10/);
  });

  it("deduplicates and rejects if unique count drops below 3", async () => {
    const res = await POST(makeReq({
      urls: [
        "https://a.com",
        "https://a.com",
        "https://a.com",
      ],
    }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/3/);
  });

  it("accepts exactly 3 unique URLs", async () => {
    mockAnalyzePage.mockResolvedValue(fakeResult as never);
    const res = await POST(makeReq({
      urls: ["https://a.com", "https://b.com", "https://c.com"],
    }));
    expect(res.status).toBe(200);
  });

  it("accepts exactly 10 unique URLs", async () => {
    mockAnalyzePage.mockResolvedValue(fakeResult as never);
    const urls = Array.from({ length: 10 }, (_, i) => `https://site${i}.com`);
    const res = await POST(makeReq({ urls }));
    expect(res.status).toBe(200);
  });
});

// ── URL format validation ───────────────────────────────────────────────────

describe("POST /api/bulk — URL format validation", () => {
  it("returns 400 when a URL is not a string", async () => {
    const res = await POST(makeReq({ urls: ["https://a.com", "https://b.com", 42] }));
    expect(res.status).toBe(400);
  });

  it("returns 400 when a URL has an invalid protocol (ftp://)", async () => {
    const res = await POST(makeReq({
      urls: ["https://a.com", "https://b.com", "ftp://c.com"],
    }));
    expect(res.status).toBe(400);
  });
});

// ── rate limiting ──────────────────────────────────────────────────────────

describe("POST /api/bulk — rate limiting", () => {
  it("returns 429 when rate limit exceeded", async () => {
    mockRateLimit.mockResolvedValueOnce({ allowed: false, limit: 10, remaining: 0 });
    const res = await POST(makeReq({
      urls: ["https://a.com", "https://b.com", "https://c.com"],
    }));
    expect(res.status).toBe(429);
    const body = await res.json();
    expect(body.rateLimitExceeded).toBe(true);
  });
});

// ── success path ────────────────────────────────────────────────────────────

describe("POST /api/bulk — success", () => {
  const threeUrls = ["https://a.com", "https://b.com", "https://c.com"];

  it("returns 200 with type=bulk and per-URL results", async () => {
    mockAnalyzePage.mockResolvedValue(fakeResult as never);
    const res = await POST(makeReq({ urls: threeUrls }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.type).toBe("bulk");
    expect(body.results).toHaveLength(3);
    expect(body.slug).toBeDefined();
  });

  it("persists the bulk result with first URL", async () => {
    mockAnalyzePage.mockResolvedValue(fakeResult as never);
    await POST(makeReq({ urls: threeUrls }));
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ url: "https://a.com" }),
      })
    );
  });

  // P0 fix: partial-failure now returns 200 with successful results only
  it("returns partial results when one URL in batch throws", async () => {
    mockAnalyzePage
      .mockResolvedValueOnce(fakeResult as never)
      .mockRejectedValueOnce(new Error("Scrape failed"))
      .mockResolvedValueOnce(fakeResult as never);
    const res = await POST(makeReq({ urls: threeUrls }));
    expect(res.status).toBe(200);
    const body = await res.json();
    // Only 2 of 3 URLs succeeded
    expect(body.urls).toHaveLength(2);
    expect(body.results).toHaveLength(2);
  });
});
