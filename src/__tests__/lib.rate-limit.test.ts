/**
 * Tests: src/lib/rate-limit.ts
 * DB-backed daily rate limiting + IP extraction
 */

// Mock Prisma before importing module
jest.mock("@/lib/db", () => ({
  prisma: {
    analysisResult: {
      count: jest.fn(),
    },
  },
}));

import { checkAnalysisRateLimit, getClientIp } from "@/lib/rate-limit";
import { prisma } from "@/lib/db";

const mockCount = prisma.analysisResult.count as jest.MockedFunction<
  typeof prisma.analysisResult.count
>;

beforeEach(() => {
  mockCount.mockReset();
});

// ── checkAnalysisRateLimit ──────────────────────────────────────────────────

describe("checkAnalysisRateLimit — anonymous user", () => {
  const ip = "1.2.3.4";

  it("allows when count is 0 (limit=3)", async () => {
    mockCount.mockResolvedValue(0);
    const result = await checkAnalysisRateLimit(null, ip);
    expect(result.allowed).toBe(true);
    expect(result.limit).toBe(3);
    expect(result.remaining).toBe(3);
  });

  it("allows at count=2 (one under limit)", async () => {
    mockCount.mockResolvedValue(2);
    const result = await checkAnalysisRateLimit(null, ip);
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(1);
  });

  it("blocks at count=3 (at limit)", async () => {
    mockCount.mockResolvedValue(3);
    const result = await checkAnalysisRateLimit(null, ip);
    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
  });

  it("blocks above limit (count=10)", async () => {
    mockCount.mockResolvedValue(10);
    const result = await checkAnalysisRateLimit(null, ip);
    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
  });

  it("queries by ip and excludes authenticated results", async () => {
    mockCount.mockResolvedValue(0);
    await checkAnalysisRateLimit(null, ip);
    expect(mockCount).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ ip, userId: null }),
      })
    );
  });
});

describe("checkAnalysisRateLimit — authenticated user", () => {
  const userId = "user_abc";
  const ip = "5.5.5.5";

  it("allows when count is 0 (limit=20)", async () => {
    mockCount.mockResolvedValue(0);
    const result = await checkAnalysisRateLimit(userId, ip);
    expect(result.allowed).toBe(true);
    expect(result.limit).toBe(20);
    expect(result.remaining).toBe(20);
  });

  it("allows at count=19", async () => {
    mockCount.mockResolvedValue(19);
    const result = await checkAnalysisRateLimit(userId, ip);
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(1);
  });

  it("blocks at count=20", async () => {
    mockCount.mockResolvedValue(20);
    const result = await checkAnalysisRateLimit(userId, ip);
    expect(result.allowed).toBe(false);
  });

  it("queries by userId (not ip)", async () => {
    mockCount.mockResolvedValue(0);
    await checkAnalysisRateLimit(userId, ip);
    expect(mockCount).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ userId }),
      })
    );
  });
});

// ── getClientIp ─────────────────────────────────────────────────────────────

describe("getClientIp", () => {
  function makeRequest(headers: Record<string, string>): Request {
    return { headers: new Headers(headers) } as Request;
  }

  it("returns first IP from x-forwarded-for", () => {
    const req = makeRequest({ "x-forwarded-for": "10.0.0.1, 10.0.0.2" });
    expect(getClientIp(req)).toBe("10.0.0.1");
  });

  it("handles single IP in x-forwarded-for", () => {
    const req = makeRequest({ "x-forwarded-for": "203.0.113.1" });
    expect(getClientIp(req)).toBe("203.0.113.1");
  });

  it("falls back to 127.0.0.1 when header is absent", () => {
    const req = makeRequest({});
    expect(getClientIp(req)).toBe("127.0.0.1");
  });

  it("trims whitespace from forwarded IP", () => {
    const req = makeRequest({ "x-forwarded-for": "  192.168.1.1  , 10.0.0.1" });
    expect(getClientIp(req)).toBe("192.168.1.1");
  });
});
