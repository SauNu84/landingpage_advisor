/**
 * Tests: src/app/api/results/route.ts  (POST /api/results)
 *        src/app/api/results/[slug]/route.ts  (GET /api/results/[slug])
 */

// ── mocks ──────────────────────────────────────────────────────────────────

const mockAnalysisResult = {
  create: jest.fn(),
  findUnique: jest.fn(),
};

jest.mock("@/lib/db", () => ({
  prisma: {
    get analysisResult() { return mockAnalysisResult; },
  },
}));

jest.mock("@/lib/session", () => ({
  getSessionFromRequest: jest.fn(),
}));

import { POST as postResults } from "@/app/api/results/route";
import { GET as getResultBySlug } from "@/app/api/results/[slug]/route";
import { NextRequest } from "next/server";
import { getSessionFromRequest } from "@/lib/session";

const mockGetSession = getSessionFromRequest as jest.MockedFunction<typeof getSessionFromRequest>;

function makePostReq(body: unknown) {
  return new NextRequest("http://localhost/api/results", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

function makeGetReq(slug: string) {
  return new NextRequest(`http://localhost/api/results/${slug}`, { method: "GET" });
}

beforeEach(() => {
  jest.clearAllMocks();
});

// ── POST /api/results ──────────────────────────────────────────────────────

describe("POST /api/results", () => {
  it("returns 401 when not authenticated", async () => {
    mockGetSession.mockResolvedValue(null);
    const res = await postResults(makePostReq({ url: "https://example.com" }));
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toMatch(/unauthorized/i);
  });

  it("returns 400 when url is missing", async () => {
    mockGetSession.mockResolvedValue({ userId: "u1", email: "u@e.com" });
    const res = await postResults(makePostReq({ data: "foo" }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/url/i);
  });

  it("returns 400 when url is not a string", async () => {
    mockGetSession.mockResolvedValue({ userId: "u1", email: "u@e.com" });
    const res = await postResults(makePostReq({ url: 123 }));
    expect(res.status).toBe(400);
  });

  it("returns 400 on invalid JSON body", async () => {
    mockGetSession.mockResolvedValue({ userId: "u1", email: "u@e.com" });
    const req = new NextRequest("http://localhost/api/results", {
      method: "POST",
      body: "{{bad",
      headers: { "Content-Type": "application/json" },
    });
    const res = await postResults(req);
    expect(res.status).toBe(400);
  });

  it("returns 200 with slug on success", async () => {
    mockGetSession.mockResolvedValue({ userId: "u1", email: "u@e.com" });
    mockAnalysisResult.create.mockResolvedValue({ id: "id1" });
    const res = await postResults(makePostReq({ url: "https://example.com", score: 80 }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.slug).toBeDefined();
    expect(typeof body.slug).toBe("string");
  });

  it("persists result with userId in DB", async () => {
    mockGetSession.mockResolvedValue({ userId: "user42", email: "u@e.com" });
    mockAnalysisResult.create.mockResolvedValue({ id: "id1" });
    await postResults(makePostReq({ url: "https://example.com" }));
    expect(mockAnalysisResult.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ userId: "user42", url: "https://example.com" }),
      })
    );
  });
});

// ── GET /api/results/[slug] ────────────────────────────────────────────────

describe("GET /api/results/[slug]", () => {
  it("returns 404 when slug not found", async () => {
    mockAnalysisResult.findUnique.mockResolvedValue(null);
    const res = await getResultBySlug(makeGetReq("notfound"), { params: { slug: "notfound" } });
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toMatch(/not found/i);
  });

  it("returns 200 with parsed data when slug exists", async () => {
    const fakeData = { url: "https://example.com", score: 85 };
    mockAnalysisResult.findUnique.mockResolvedValue({
      slug: "abc12345",
      data: JSON.stringify(fakeData),
    });
    const res = await getResultBySlug(makeGetReq("abc12345"), { params: { slug: "abc12345" } });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual(fakeData);
  });

  it("queries DB with the correct slug", async () => {
    mockAnalysisResult.findUnique.mockResolvedValue(null);
    await getResultBySlug(makeGetReq("myslug"), { params: { slug: "myslug" } });
    expect(mockAnalysisResult.findUnique).toHaveBeenCalledWith({ where: { slug: "myslug" } });
  });
});
