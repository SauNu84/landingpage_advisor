// @prism-workflow analysis-lifecycle
// @prism-dimensions D2,D5
/**
 * E2E Workflow: Analysis Lifecycle
 * Chain: POST /api/analyze (assert slug returned)
 *        → POST /api/results (store result, assert new slug)
 *        → GET /api/results/[slug] (assert data returned)
 *        → GET /api/history (assert result appears)
 */

// ── mocks ──────────────────────────────────────────────────────────────────

const mockAnalysisResult = {
  create: jest.fn(),
  findUnique: jest.fn(),
  findMany: jest.fn(),
};

jest.mock("@/lib/db", () => ({
  prisma: {
    get analysisResult() { return mockAnalysisResult; },
    postHogConfig: { findUnique: jest.fn() },
  },
}));
jest.mock("@/lib/scraper", () => ({ scrapePage: jest.fn() }));
jest.mock("@/lib/ai-provider", () => ({
  complete: jest.fn(),
  getProvider: jest.fn(() => "claude"),
}));
jest.mock("@/lib/session", () => ({
  getSessionFromRequest: jest.fn(),
}));
jest.mock("@/lib/rate-limit", () => ({
  checkAnalysisRateLimit: jest.fn(() =>
    Promise.resolve({ allowed: true, limit: 10, remaining: 9 })
  ),
  getClientIp: jest.fn(() => "127.0.0.1"),
}));

import { POST as analyzeRoute } from "@/app/api/analyze/route";
import { POST as postResults } from "@/app/api/results/route";
import { GET as getResultBySlug } from "@/app/api/results/[slug]/route";
import { GET as getHistory } from "@/app/api/history/route";
import { NextRequest } from "next/server";
import { scrapePage } from "@/lib/scraper";
import { complete } from "@/lib/ai-provider";
import { getSessionFromRequest } from "@/lib/session";

const mockScrapePage = scrapePage as jest.MockedFunction<typeof scrapePage>;
const mockComplete = complete as jest.MockedFunction<typeof complete>;
const mockGetSession = getSessionFromRequest as jest.MockedFunction<any>;

// ── shared fixtures ─────────────────────────────────────────────────────────

const TARGET_URL = "https://example.com/landing";

const fakePageData = {
  url: TARGET_URL,
  title: "Example Landing Page",
  description: "The best product ever",
  headings: { h1: ["Buy Now"], h2: [], h3: [] },
  ctaTexts: ["Get Started"],
  formFields: [],
  metaTags: {},
  bodyCopy: "Compelling copy about the product.",
};

const fakeExpertJson = JSON.stringify({
  score: 78,
  summary: "Solid layout",
  strengths: ["Clear CTA"],
  weaknesses: ["Lacks social proof"],
  recommendations: ["Add testimonials"],
});

const fakePostHogJson = JSON.stringify({
  trackingPoints: [{ event: "cta_click", description: "User clicks the CTA button" }],
  keyMetrics: ["conversion_rate"],
  strategy: "Track CTA engagement and form completion",
  dashboards: [],
});

const AUTHED_SESSION = { userId: "user-lifecycle-1", email: "lifecycle@example.com" };

function makePostReq(path: string, body: unknown) {
  return new NextRequest(`http://localhost${path}`, {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

function makeGetReq(path: string) {
  return new NextRequest(`http://localhost${path}`, { method: "GET" });
}

function setupAiMocks() {
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
}

beforeEach(() => {
  jest.clearAllMocks();
  process.env.ANTHROPIC_API_KEY = "sk-test-lifecycle-key";
  mockGetSession.mockResolvedValue(null);
  mockAnalysisResult.create.mockResolvedValue({ id: "db-id-1", slug: "testslug" });
  mockAnalysisResult.findUnique.mockResolvedValue(null);
  mockAnalysisResult.findMany.mockResolvedValue([]);
});

afterEach(() => {
  delete process.env.ANTHROPIC_API_KEY;
});

// ── Workflow: Step 1 — POST /api/analyze ───────────────────────────────────

describe("Analysis Lifecycle E2E — Step 1: POST /api/analyze", () => {
  it("returns 200 with slug, url, and experts on success", async () => {
    setupAiMocks();

    const res = await analyzeRoute(makePostReq("/api/analyze", { url: TARGET_URL }));
    expect(res.status).toBe(200);
    const body = await res.json();

    expect(body.slug).toBeDefined();
    expect(typeof body.slug).toBe("string");
    expect(body.url).toBe(TARGET_URL);
    expect(body.experts).toBeDefined();
    expect(Object.keys(body.experts)).toHaveLength(6);
  });

  it("persists result in DB with correct url", async () => {
    setupAiMocks();

    await analyzeRoute(makePostReq("/api/analyze", { url: TARGET_URL }));

    expect(mockAnalysisResult.create).toHaveBeenCalledTimes(1);
    expect(mockAnalysisResult.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ url: TARGET_URL }),
      })
    );
  });

  it("returns 400 when url is missing", async () => {
    const res = await analyzeRoute(makePostReq("/api/analyze", {}));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/url/i);
  });

  it("returns 400 for invalid URL format", async () => {
    const res = await analyzeRoute(makePostReq("/api/analyze", { url: "not-a-url" }));
    expect(res.status).toBe(400);
  });
});

// ── Workflow: Step 2 — POST /api/results ───────────────────────────────────

describe("Analysis Lifecycle E2E — Step 2: POST /api/results", () => {
  it("stores an analysis result and returns a new slug when authenticated", async () => {
    mockGetSession.mockResolvedValue(AUTHED_SESSION);
    mockAnalysisResult.create.mockResolvedValue({ id: "stored-id" });

    const payload = { url: TARGET_URL, score: 78, experts: {} };
    const res = await postResults(makePostReq("/api/results", payload));

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.slug).toBeDefined();
    expect(typeof body.slug).toBe("string");
  });

  it("persists result with correct userId and url", async () => {
    mockGetSession.mockResolvedValue(AUTHED_SESSION);
    mockAnalysisResult.create.mockResolvedValue({ id: "stored-id" });

    await postResults(makePostReq("/api/results", { url: TARGET_URL }));

    expect(mockAnalysisResult.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          url: TARGET_URL,
          userId: AUTHED_SESSION.userId,
        }),
      })
    );
  });

  it("returns 401 when not authenticated", async () => {
    mockGetSession.mockResolvedValue(null);
    const res = await postResults(makePostReq("/api/results", { url: TARGET_URL }));
    expect(res.status).toBe(401);
  });

  it("returns 400 when url is missing", async () => {
    mockGetSession.mockResolvedValue(AUTHED_SESSION);
    const res = await postResults(makePostReq("/api/results", { score: 80 }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/url/i);
  });
});

// ── Workflow: Step 3 — GET /api/results/[slug] ─────────────────────────────

describe("Analysis Lifecycle E2E — Step 3: GET /api/results/[slug]", () => {
  const STORED_SLUG = "abc12345";
  const STORED_DATA = { url: TARGET_URL, score: 78, analysedAt: "2026-03-23T00:00:00.000Z" };

  it("returns 200 with parsed result data for a known slug", async () => {
    mockAnalysisResult.findUnique.mockResolvedValue({
      slug: STORED_SLUG,
      data: JSON.stringify(STORED_DATA),
    });

    const res = await getResultBySlug(
      makeGetReq(`/api/results/${STORED_SLUG}`),
      { params: { slug: STORED_SLUG } }
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual(STORED_DATA);
  });

  it("returns 404 for an unknown slug", async () => {
    mockAnalysisResult.findUnique.mockResolvedValue(null);

    const res = await getResultBySlug(
      makeGetReq("/api/results/unknownslug"),
      { params: { slug: "unknownslug" } }
    );

    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toMatch(/not found/i);
  });

  it("queries DB with the correct slug", async () => {
    mockAnalysisResult.findUnique.mockResolvedValue(null);
    await getResultBySlug(makeGetReq(`/api/results/${STORED_SLUG}`), {
      params: { slug: STORED_SLUG },
    });
    expect(mockAnalysisResult.findUnique).toHaveBeenCalledWith({
      where: { slug: STORED_SLUG },
    });
  });
});

// ── Workflow: Step 4 — GET /api/history ────────────────────────────────────

describe("Analysis Lifecycle E2E — Step 4: GET /api/history", () => {
  const HISTORY_ITEM = {
    id: "hist-id-1",
    slug: "hist-slug-1",
    url: TARGET_URL,
    secondaryUrl: null,
    data: JSON.stringify({ experts: { "ui-design": { score: 78 }, "ux-research": { score: 72 } } }),
    createdAt: new Date("2026-03-23T00:00:00.000Z"),
  };

  it("returns 401 when not authenticated", async () => {
    mockGetSession.mockResolvedValue(null);
    const res = await getHistory(makeGetReq("/api/history"));
    expect(res.status).toBe(401);
  });

  it("returns 200 with results array when authenticated", async () => {
    mockGetSession.mockResolvedValue(AUTHED_SESSION);
    mockAnalysisResult.findMany.mockResolvedValue([HISTORY_ITEM]);

    const res = await getHistory(makeGetReq("/api/history"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.results).toBeDefined();
    expect(Array.isArray(body.results)).toBe(true);
  });

  it("returns result with computed overallScore and slug", async () => {
    mockGetSession.mockResolvedValue(AUTHED_SESSION);
    mockAnalysisResult.findMany.mockResolvedValue([HISTORY_ITEM]);

    const res = await getHistory(makeGetReq("/api/history"));
    const body = await res.json();
    const item = body.results[0];

    expect(item.slug).toBe("hist-slug-1");
    expect(item.url).toBe(TARGET_URL);
    expect(typeof item.overallScore).toBe("number");
    expect(item.isComparison).toBe(false);
  });

  it("returns empty results for a user with no analyses", async () => {
    mockGetSession.mockResolvedValue(AUTHED_SESSION);
    mockAnalysisResult.findMany.mockResolvedValue([]);

    const res = await getHistory(makeGetReq("/api/history"));
    const body = await res.json();
    expect(body.results).toHaveLength(0);
    expect(body.nextCursor).toBeNull();
  });

  it("queries DB filtered by the authenticated user's id", async () => {
    mockGetSession.mockResolvedValue(AUTHED_SESSION);
    mockAnalysisResult.findMany.mockResolvedValue([]);

    await getHistory(makeGetReq("/api/history"));

    expect(mockAnalysisResult.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: AUTHED_SESSION.userId },
      })
    );
  });
});

// ── Full chain in a single test ─────────────────────────────────────────────

describe("Analysis Lifecycle E2E — complete chain", () => {
  it("analyze → store results → retrieve by slug → appear in history", async () => {
    const GENERATED_SLUG = "chain001";

    // Step 1: POST /api/analyze
    setupAiMocks();
    mockAnalysisResult.create.mockResolvedValue({ id: "db-chain-1", slug: GENERATED_SLUG });
    mockGetSession.mockResolvedValue(null);

    const analyzeRes = await analyzeRoute(makePostReq("/api/analyze", { url: TARGET_URL }));
    expect(analyzeRes.status).toBe(200);
    const analyzeBody = await analyzeRes.json();
    const analyzeSlug = analyzeBody.slug;
    expect(analyzeSlug).toBeDefined();

    // Step 2: POST /api/results (authenticated store)
    mockGetSession.mockResolvedValue(AUTHED_SESSION);
    mockAnalysisResult.create.mockResolvedValue({ id: "db-chain-2" });

    const storeRes = await postResults(
      makePostReq("/api/results", { url: TARGET_URL, ...analyzeBody })
    );
    expect(storeRes.status).toBe(200);
    const storeBody = await storeRes.json();
    const storedSlug = storeBody.slug;
    expect(storedSlug).toBeDefined();

    // Step 3: GET /api/results/[slug] — retrieve stored result
    const fakeStored = { url: TARGET_URL, experts: analyzeBody.experts };
    mockAnalysisResult.findUnique.mockResolvedValue({
      slug: storedSlug,
      data: JSON.stringify(fakeStored),
    });

    const retrieveRes = await getResultBySlug(
      makeGetReq(`/api/results/${storedSlug}`),
      { params: { slug: storedSlug } }
    );
    expect(retrieveRes.status).toBe(200);
    const retrievedBody = await retrieveRes.json();
    expect(retrievedBody.url).toBe(TARGET_URL);

    // Step 4: GET /api/history — result appears
    const historyItem = {
      id: "db-chain-2",
      slug: storedSlug,
      url: TARGET_URL,
      secondaryUrl: null,
      data: JSON.stringify({ experts: { "ui-design": { score: 78 } } }),
      createdAt: new Date(),
    };
    mockAnalysisResult.findMany.mockResolvedValue([historyItem]);

    const historyRes = await getHistory(makeGetReq("/api/history"));
    expect(historyRes.status).toBe(200);
    const historyBody = await historyRes.json();
    expect(historyBody.results.length).toBeGreaterThan(0);
    expect(historyBody.results[0].slug).toBe(storedSlug);
  });
});
