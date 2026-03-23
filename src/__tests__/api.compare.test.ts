/**
 * Tests: src/app/api/compare/route.ts
 * URL validation, provider key check, rate limiting, success, error handling
 */

// ── mocks ──────────────────────────────────────────────────────────────────

const mockAnalysisResult = {
  create: jest.fn(),
};

jest.mock("@/lib/db", () => ({
  prisma: {
    get analysisResult() { return mockAnalysisResult; },
  },
}));

jest.mock("@/lib/ai-provider", () => ({
  getProvider: jest.fn(() => "claude"),
}));

jest.mock("@/lib/analyze-pipeline", () => ({
  analyzePage: jest.fn(),
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

import { POST } from "@/app/api/compare/route";
import { NextRequest } from "next/server";
import { analyzePage } from "@/lib/analyze-pipeline";
import { checkAnalysisRateLimit } from "@/lib/rate-limit";
import { getProvider } from "@/lib/ai-provider";

const mockAnalyzePage = analyzePage as jest.MockedFunction<typeof analyzePage>;
const mockRateLimit = checkAnalysisRateLimit as jest.MockedFunction<typeof checkAnalysisRateLimit>;
const mockGetProvider = getProvider as jest.MockedFunction<typeof getProvider>;

function makeReq(body: unknown) {
  return new NextRequest("http://localhost/api/compare", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

const fakeResult = {
  url: "https://example.com",
  analysedAt: new Date().toISOString(),
  experts: {},
  posthog: { trackingPoints: [], keyMetrics: [], strategy: "", dashboards: [] },
};

beforeEach(() => {
  jest.clearAllMocks();
  process.env.ANTHROPIC_API_KEY = "sk-test-key";
  mockGetProvider.mockReturnValue("claude");
  mockAnalysisResult.create.mockResolvedValue({ id: "id1", slug: "abc12345" });
});

afterEach(() => {
  delete process.env.ANTHROPIC_API_KEY;
});

// ── validation ─────────────────────────────────────────────────────────────

describe("POST /api/compare — validation", () => {
  it("returns 400 when url1 is missing", async () => {
    const res = await POST(makeReq({ url2: "https://example.com" }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/url1|url2/i);
  });

  it("returns 400 when url2 is missing", async () => {
    const res = await POST(makeReq({ url1: "https://example.com" }));
    expect(res.status).toBe(400);
  });

  it("returns 400 when url1 is not a valid URL", async () => {
    const res = await POST(makeReq({ url1: "not-a-url", url2: "https://example.com" }));
    expect(res.status).toBe(400);
  });

  it("returns 400 when url2 is not a valid URL", async () => {
    const res = await POST(makeReq({ url1: "https://example.com", url2: "not-a-url" }));
    expect(res.status).toBe(400);
  });

  it("returns 400 on invalid JSON body", async () => {
    const req = new NextRequest("http://localhost/api/compare", {
      method: "POST",
      body: "{{invalid",
      headers: { "Content-Type": "application/json" },
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });
});

// ── provider key check ─────────────────────────────────────────────────────

describe("POST /api/compare — provider key check", () => {
  it("returns 500 when ANTHROPIC_API_KEY is not set", async () => {
    delete process.env.ANTHROPIC_API_KEY;
    const res = await POST(makeReq({ url1: "https://a.com", url2: "https://b.com" }));
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toMatch(/ANTHROPIC_API_KEY/i);
  });

  it("returns 500 when OPENAI_API_KEY is not set for openai provider", async () => {
    mockGetProvider.mockReturnValue("openai");
    delete process.env.OPENAI_API_KEY;
    const res = await POST(makeReq({ url1: "https://a.com", url2: "https://b.com" }));
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toMatch(/OPENAI_API_KEY/i);
  });
});

// ── rate limiting ──────────────────────────────────────────────────────────

describe("POST /api/compare — rate limiting", () => {
  it("returns 429 when rate limit exceeded (anonymous)", async () => {
    mockRateLimit.mockResolvedValueOnce({ allowed: false, limit: 5, remaining: 0 });
    const res = await POST(makeReq({ url1: "https://a.com", url2: "https://b.com" }));
    expect(res.status).toBe(429);
    const body = await res.json();
    expect(body.rateLimitExceeded).toBe(true);
    expect(body.error).toMatch(/sign in/i);
  });
});

// ── success ────────────────────────────────────────────────────────────────

describe("POST /api/compare — success", () => {
  beforeEach(() => {
    mockAnalyzePage.mockResolvedValue(fakeResult as never);
  });

  it("returns 200 with comparison result", async () => {
    const res = await POST(makeReq({ url1: "https://a.com", url2: "https://b.com" }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.url1).toBe("https://a.com");
    expect(body.url2).toBe("https://b.com");
    expect(body.result1).toBeDefined();
    expect(body.result2).toBeDefined();
    expect(body.slug).toBeDefined();
    expect(body.analysedAt).toBeDefined();
  });

  it("calls analyzePage for both URLs", async () => {
    await POST(makeReq({ url1: "https://a.com", url2: "https://b.com" }));
    expect(mockAnalyzePage).toHaveBeenCalledTimes(2);
    expect(mockAnalyzePage).toHaveBeenCalledWith("https://a.com");
    expect(mockAnalyzePage).toHaveBeenCalledWith("https://b.com");
  });

  it("persists comparison result in DB", async () => {
    await POST(makeReq({ url1: "https://a.com", url2: "https://b.com" }));
    expect(mockAnalysisResult.create).toHaveBeenCalledTimes(1);
    expect(mockAnalysisResult.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          url: "https://a.com",
          secondaryUrl: "https://b.com",
        }),
      })
    );
  });
});

// ── error handling ─────────────────────────────────────────────────────────

describe("POST /api/compare — error handling", () => {
  it("returns 500 when analyzePage throws", async () => {
    mockAnalyzePage.mockRejectedValue(new Error("AI failure"));
    const res = await POST(makeReq({ url1: "https://a.com", url2: "https://b.com" }));
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toMatch(/AI failure/);
  });
});
