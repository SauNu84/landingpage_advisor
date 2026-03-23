// @prism-workflow rate-limit-enforcement
// @prism-dimensions D4,D7
/**
 * E2E Workflow: Rate Limit Enforcement
 * Verify that checkAnalysisRateLimit returning {allowed:false} produces 429
 * on /api/analyze, /api/bulk, and /api/compare routes.
 * Validates: status 429, rateLimitExceeded:true, error message content.
 */

// ── mocks ──────────────────────────────────────────────────────────────────

jest.mock("@/lib/db", () => ({
  prisma: {
    analysisResult: { create: jest.fn(), count: jest.fn() },
    postHogConfig: { findUnique: jest.fn() },
  },
}));
jest.mock("@/lib/scraper", () => ({ scrapePage: jest.fn() }));
jest.mock("@/lib/ai-provider", () => ({
  complete: jest.fn(),
  getProvider: jest.fn(() => "claude"),
}));
jest.mock("@/lib/analyze-pipeline", () => ({
  analyzePage: jest.fn(),
}));
jest.mock("@/lib/session", () => ({
  getSessionFromRequest: jest.fn(),
}));
jest.mock("@/lib/rate-limit", () => ({
  checkAnalysisRateLimit: jest.fn(),
  getClientIp: jest.fn(() => "10.0.0.1"),
}));

import { POST as analyzeRoute } from "@/app/api/analyze/route";
import { POST as bulkRoute } from "@/app/api/bulk/route";
import { POST as compareRoute } from "@/app/api/compare/route";
import { NextRequest } from "next/server";
import { checkAnalysisRateLimit } from "@/lib/rate-limit";
import { getSessionFromRequest } from "@/lib/session";

const mockRateLimit = checkAnalysisRateLimit as jest.MockedFunction<typeof checkAnalysisRateLimit>;
const mockGetSession = getSessionFromRequest as jest.MockedFunction<any>;

// Rate limit response fixtures
const RATE_LIMITED = { allowed: false, limit: 5, remaining: 0 } as const;
const RATE_ALLOWED = { allowed: true, limit: 5, remaining: 4 } as const;

function makePostReq(path: string, body: unknown) {
  return new NextRequest(`http://localhost${path}`, {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  process.env.ANTHROPIC_API_KEY = "sk-test-rate-limit-key";
  mockGetSession.mockResolvedValue(null);
  mockRateLimit.mockResolvedValue(RATE_ALLOWED);
});

afterEach(() => {
  delete process.env.ANTHROPIC_API_KEY;
});

// ── POST /api/analyze — rate limit enforcement ──────────────────────────────

describe("Rate Limit Enforcement E2E — POST /api/analyze", () => {
  it("returns 429 when rate limit is exceeded (anonymous user)", async () => {
    mockRateLimit.mockResolvedValue(RATE_LIMITED);

    const res = await analyzeRoute(makePostReq("/api/analyze", { url: "https://example.com" }));

    expect(res.status).toBe(429);
    const body = await res.json();
    expect(body.rateLimitExceeded).toBe(true);
  });

  it("includes limit count in error message (anonymous user)", async () => {
    mockRateLimit.mockResolvedValue(RATE_LIMITED);

    const res = await analyzeRoute(makePostReq("/api/analyze", { url: "https://example.com" }));
    const body = await res.json();

    expect(body.error).toMatch(/5\/day/);
  });

  it('includes "Sign in" prompt in error for anonymous user', async () => {
    mockGetSession.mockResolvedValue(null);
    mockRateLimit.mockResolvedValue(RATE_LIMITED);

    const res = await analyzeRoute(makePostReq("/api/analyze", { url: "https://example.com" }));
    const body = await res.json();

    expect(body.error).toMatch(/Sign in/i);
  });

  it("does NOT include Sign in prompt for authenticated user", async () => {
    mockGetSession.mockResolvedValue({ userId: "user-rl-1", email: "rl@example.com" });
    mockRateLimit.mockResolvedValue(RATE_LIMITED);

    const res = await analyzeRoute(makePostReq("/api/analyze", { url: "https://example.com" }));
    const body = await res.json();

    expect(body.error).not.toMatch(/Sign in/i);
    expect(body.error).toMatch(/try again tomorrow/i);
  });

  it("does NOT rate limit when checkAnalysisRateLimit returns allowed:true", async () => {
    mockRateLimit.mockResolvedValue(RATE_ALLOWED);
    // We don't need full analysis success — just verify 429 is NOT returned
    const res = await analyzeRoute(makePostReq("/api/analyze", { url: "https://example.com" }));
    expect(res.status).not.toBe(429);
  });

  it("passes userId=null to checkAnalysisRateLimit for anonymous requests", async () => {
    mockGetSession.mockResolvedValue(null);
    mockRateLimit.mockResolvedValue(RATE_LIMITED);

    await analyzeRoute(makePostReq("/api/analyze", { url: "https://example.com" }));

    expect(mockRateLimit).toHaveBeenCalledWith(null, expect.any(String));
  });

  it("passes userId to checkAnalysisRateLimit for authenticated requests", async () => {
    mockGetSession.mockResolvedValue({ userId: "user-rl-2", email: "rl2@example.com" });
    mockRateLimit.mockResolvedValue(RATE_LIMITED);

    await analyzeRoute(makePostReq("/api/analyze", { url: "https://example.com" }));

    expect(mockRateLimit).toHaveBeenCalledWith("user-rl-2", expect.any(String));
  });
});

// ── POST /api/bulk — rate limit enforcement ─────────────────────────────────

describe("Rate Limit Enforcement E2E — POST /api/bulk", () => {
  const VALID_URLS = [
    "https://example.com/a",
    "https://example.com/b",
    "https://example.com/c",
  ];

  it("returns 429 when rate limit is exceeded (anonymous user)", async () => {
    mockRateLimit.mockResolvedValue(RATE_LIMITED);

    const res = await bulkRoute(makePostReq("/api/bulk", { urls: VALID_URLS }));

    expect(res.status).toBe(429);
    const body = await res.json();
    expect(body.rateLimitExceeded).toBe(true);
  });

  it("includes limit count in error message", async () => {
    mockRateLimit.mockResolvedValue(RATE_LIMITED);

    const res = await bulkRoute(makePostReq("/api/bulk", { urls: VALID_URLS }));
    const body = await res.json();

    expect(body.error).toMatch(/5\/day/);
  });

  it('includes "Sign in" prompt for anonymous user', async () => {
    mockGetSession.mockResolvedValue(null);
    mockRateLimit.mockResolvedValue(RATE_LIMITED);

    const res = await bulkRoute(makePostReq("/api/bulk", { urls: VALID_URLS }));
    const body = await res.json();

    expect(body.error).toMatch(/Sign in/i);
  });

  it("does NOT include Sign in prompt for authenticated user", async () => {
    mockGetSession.mockResolvedValue({ userId: "user-rl-bulk", email: "rl-bulk@example.com" });
    mockRateLimit.mockResolvedValue(RATE_LIMITED);

    const res = await bulkRoute(makePostReq("/api/bulk", { urls: VALID_URLS }));
    const body = await res.json();

    expect(body.error).not.toMatch(/Sign in/i);
    expect(body.error).toMatch(/try again tomorrow/i);
  });

  it("passes userId=null to checkAnalysisRateLimit for anonymous bulk requests", async () => {
    mockGetSession.mockResolvedValue(null);
    mockRateLimit.mockResolvedValue(RATE_LIMITED);

    await bulkRoute(makePostReq("/api/bulk", { urls: VALID_URLS }));

    expect(mockRateLimit).toHaveBeenCalledWith(null, expect.any(String));
  });
});

// ── POST /api/compare — rate limit enforcement ──────────────────────────────

describe("Rate Limit Enforcement E2E — POST /api/compare", () => {
  const COMPARE_BODY = {
    url1: "https://example.com/page-a",
    url2: "https://example.com/page-b",
  };

  it("returns 429 when rate limit is exceeded (anonymous user)", async () => {
    mockRateLimit.mockResolvedValue(RATE_LIMITED);

    const res = await compareRoute(makePostReq("/api/compare", COMPARE_BODY));

    expect(res.status).toBe(429);
    const body = await res.json();
    expect(body.rateLimitExceeded).toBe(true);
  });

  it("includes limit count in error message", async () => {
    mockRateLimit.mockResolvedValue(RATE_LIMITED);

    const res = await compareRoute(makePostReq("/api/compare", COMPARE_BODY));
    const body = await res.json();

    expect(body.error).toMatch(/5\/day/);
  });

  it('includes "Sign in" prompt for anonymous user', async () => {
    mockGetSession.mockResolvedValue(null);
    mockRateLimit.mockResolvedValue(RATE_LIMITED);

    const res = await compareRoute(makePostReq("/api/compare", COMPARE_BODY));
    const body = await res.json();

    expect(body.error).toMatch(/Sign in/i);
  });

  it("does NOT include Sign in prompt for authenticated user", async () => {
    mockGetSession.mockResolvedValue({ userId: "user-rl-cmp", email: "rl-cmp@example.com" });
    mockRateLimit.mockResolvedValue(RATE_LIMITED);

    const res = await compareRoute(makePostReq("/api/compare", COMPARE_BODY));
    const body = await res.json();

    expect(body.error).not.toMatch(/Sign in/i);
    expect(body.error).toMatch(/try again tomorrow/i);
  });

  it("passes userId=null to checkAnalysisRateLimit for anonymous compare requests", async () => {
    mockGetSession.mockResolvedValue(null);
    mockRateLimit.mockResolvedValue(RATE_LIMITED);

    await compareRoute(makePostReq("/api/compare", COMPARE_BODY));

    expect(mockRateLimit).toHaveBeenCalledWith(null, expect.any(String));
  });
});

// ── Cross-route consistency ─────────────────────────────────────────────────

describe("Rate Limit Enforcement E2E — cross-route consistency", () => {
  const VALID_ANALYZE_BODY = { url: "https://example.com" };
  const VALID_BULK_BODY = { urls: ["https://a.com", "https://b.com", "https://c.com"] };
  const VALID_COMPARE_BODY = { url1: "https://a.com", url2: "https://b.com" };

  it("all three routes return 429 with rateLimitExceeded:true when rate limited", async () => {
    mockRateLimit.mockResolvedValue(RATE_LIMITED);

    const [analyzeRes, bulkRes, compareRes] = await Promise.all([
      analyzeRoute(makePostReq("/api/analyze", VALID_ANALYZE_BODY)),
      bulkRoute(makePostReq("/api/bulk", VALID_BULK_BODY)),
      compareRoute(makePostReq("/api/compare", VALID_COMPARE_BODY)),
    ]);

    for (const res of [analyzeRes, bulkRes, compareRes]) {
      expect(res.status).toBe(429);
      const body = await res.json();
      expect(body.rateLimitExceeded).toBe(true);
      expect(body.error).toBeDefined();
    }
  });

  it("all three routes include daily limit in error message", async () => {
    mockRateLimit.mockResolvedValue({ allowed: false, limit: 3, remaining: 0 });

    const [analyzeRes, bulkRes, compareRes] = await Promise.all([
      analyzeRoute(makePostReq("/api/analyze", VALID_ANALYZE_BODY)),
      bulkRoute(makePostReq("/api/bulk", VALID_BULK_BODY)),
      compareRoute(makePostReq("/api/compare", VALID_COMPARE_BODY)),
    ]);

    for (const res of [analyzeRes, bulkRes, compareRes]) {
      const body = await res.json();
      expect(body.error).toMatch(/3\/day/);
    }
  });

  it("all three routes call checkAnalysisRateLimit exactly once per request", async () => {
    mockRateLimit.mockResolvedValue(RATE_LIMITED);

    await analyzeRoute(makePostReq("/api/analyze", VALID_ANALYZE_BODY));
    expect(mockRateLimit).toHaveBeenCalledTimes(1);

    jest.clearAllMocks();
    mockGetSession.mockResolvedValue(null);
    mockRateLimit.mockResolvedValue(RATE_LIMITED);
    await bulkRoute(makePostReq("/api/bulk", VALID_BULK_BODY));
    expect(mockRateLimit).toHaveBeenCalledTimes(1);

    jest.clearAllMocks();
    mockGetSession.mockResolvedValue(null);
    mockRateLimit.mockResolvedValue(RATE_LIMITED);
    await compareRoute(makePostReq("/api/compare", VALID_COMPARE_BODY));
    expect(mockRateLimit).toHaveBeenCalledTimes(1);
  });
});
