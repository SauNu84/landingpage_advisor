/**
 * Tests: src/app/api/history/route.ts
 * Auth guard, cursor pagination, score extraction, bulk/comparison detection
 */

jest.mock("@/lib/db", () => ({
  prisma: {
    analysisResult: {
      findMany: jest.fn(),
    },
  },
}));
jest.mock("@/lib/session", () => ({
  getSessionFromRequest: jest.fn(),
}));

import { GET } from "@/app/api/history/route";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionFromRequest } from "@/lib/session";

const mockFindMany = prisma.analysisResult.findMany as jest.MockedFunction<any>;
const mockGetSession = getSessionFromRequest as jest.MockedFunction<any>;

function makeReq(query = "") {
  return new NextRequest(`http://localhost/api/history${query}`);
}

function makeAnalysisItem(overrides: Record<string, unknown> = {}) {
  return {
    id: "id1",
    slug: "abc12345",
    url: "https://example.com",
    secondaryUrl: null,
    data: JSON.stringify({
      experts: {
        "ui-design": { score: 80 },
        "ux-research": { score: 60 },
        experiment: { score: 70 },
        content: { score: 90 },
        seo: { score: 50 },
        psychology: { score: 75 },
      },
    }),
    createdAt: new Date("2026-03-22T00:00:00.000Z"),
    ...overrides,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
});

// ── auth guard ─────────────────────────────────────────────────────────────

describe("GET /api/history — auth guard", () => {
  it("returns 401 when unauthenticated", async () => {
    mockGetSession.mockResolvedValue(null);
    const res = await GET(makeReq());
    expect(res.status).toBe(401);
  });
});

// ── pagination ─────────────────────────────────────────────────────────────

describe("GET /api/history — pagination", () => {
  beforeEach(() => {
    mockGetSession.mockResolvedValue({ userId: "user1", email: "u@e.com" });
  });

  it("returns results without nextCursor when <= PAGE_SIZE", async () => {
    mockFindMany.mockResolvedValue([makeAnalysisItem()]);
    const res = await GET(makeReq());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.results).toHaveLength(1);
    expect(body.nextCursor).toBeNull();
  });

  it("returns nextCursor when more than PAGE_SIZE results exist", async () => {
    // Return 21 items (PAGE_SIZE=20, so 21 means hasMore=true)
    const items = Array.from({ length: 21 }, (_, i) =>
      makeAnalysisItem({ id: `id${i}`, slug: `sl${i}` })
    );
    mockFindMany.mockResolvedValue(items);
    const res = await GET(makeReq());
    const body = await res.json();
    expect(body.results).toHaveLength(20);
    expect(body.nextCursor).toBe("id19");
  });

  it("passes cursor to findMany when provided", async () => {
    mockFindMany.mockResolvedValue([]);
    await GET(makeReq("?cursor=id5"));
    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        cursor: { id: "id5" },
        skip: 1,
      })
    );
  });
});

// ── score extraction ────────────────────────────────────────────────────────

describe("GET /api/history — score extraction", () => {
  beforeEach(() => {
    mockGetSession.mockResolvedValue({ userId: "user1", email: "u@e.com" });
  });

  it("calculates correct overall score (average of 6 expert scores)", async () => {
    // scores: 80+60+70+90+50+75 = 425 / 6 = 70.83 → rounds to 71
    mockFindMany.mockResolvedValue([makeAnalysisItem()]);
    const res = await GET(makeReq());
    const body = await res.json();
    expect(body.results[0].overallScore).toBe(71);
  });

  it("sets overallScore to null when experts field is missing", async () => {
    mockFindMany.mockResolvedValue([
      makeAnalysisItem({ data: JSON.stringify({ url: "https://x.com" }) }),
    ]);
    const res = await GET(makeReq());
    const body = await res.json();
    expect(body.results[0].overallScore).toBeNull();
  });

  it("handles malformed JSON in data gracefully", async () => {
    mockFindMany.mockResolvedValue([
      makeAnalysisItem({ data: "{{broken json" }),
    ]);
    const res = await GET(makeReq());
    expect(res.status).toBe(200); // should not throw
    const body = await res.json();
    expect(body.results[0].overallScore).toBeNull();
  });
});

// ── comparison detection ────────────────────────────────────────────────────

describe("GET /api/history — comparison / bulk detection", () => {
  beforeEach(() => {
    mockGetSession.mockResolvedValue({ userId: "user1", email: "u@e.com" });
  });

  it("marks isComparison=true when secondaryUrl is set", async () => {
    mockFindMany.mockResolvedValue([
      makeAnalysisItem({ secondaryUrl: "https://competitor.com" }),
    ]);
    const res = await GET(makeReq());
    const body = await res.json();
    expect(body.results[0].isComparison).toBe(true);
    expect(body.results[0].secondaryUrl).toBe("https://competitor.com");
  });

  it("marks isComparison=false for regular analysis", async () => {
    mockFindMany.mockResolvedValue([makeAnalysisItem()]);
    const res = await GET(makeReq());
    const body = await res.json();
    expect(body.results[0].isComparison).toBe(false);
  });
});
