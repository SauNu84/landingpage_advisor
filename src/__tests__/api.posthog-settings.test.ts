/**
 * Tests: src/app/api/settings/posthog/route.ts
 * Auth guard, GET (masked key), POST (encrypt + upsert), DELETE
 */

process.env.SESSION_SECRET = "test-secret-32chars-padded-here!!";

jest.mock("@/lib/db", () => ({
  prisma: {
    postHogConfig: {
      findUnique: jest.fn(),
      upsert: jest.fn(),
      deleteMany: jest.fn(),
    },
  },
}));
jest.mock("@/lib/session", () => ({
  getSessionFromRequest: jest.fn(),
}));

import { GET, POST, DELETE } from "@/app/api/settings/posthog/route";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionFromRequest } from "@/lib/session";
import { encrypt } from "@/lib/encrypt";

const mockFindUnique = prisma.postHogConfig.findUnique as jest.MockedFunction<any>;
const mockUpsert = prisma.postHogConfig.upsert as jest.MockedFunction<any>;
const mockDeleteMany = prisma.postHogConfig.deleteMany as jest.MockedFunction<any>;
const mockGetSession = getSessionFromRequest as jest.MockedFunction<any>;

const authedSession = { userId: "user1", email: "test@example.com" };

function makeReq(method: string, body?: unknown) {
  return new NextRequest("http://localhost/api/settings/posthog", {
    method,
    ...(body !== undefined
      ? {
          body: JSON.stringify(body),
          headers: { "Content-Type": "application/json" },
        }
      : {}),
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  mockUpsert.mockResolvedValue({});
  mockDeleteMany.mockResolvedValue({ count: 1 });
});

// ── auth guard ─────────────────────────────────────────────────────────────

describe("Auth guard — all methods", () => {
  beforeEach(() => {
    mockGetSession.mockResolvedValue(null);
  });

  it("GET returns 401 when unauthenticated", async () => {
    const res = await GET(makeReq("GET"));
    expect(res.status).toBe(401);
  });

  it("POST returns 401 when unauthenticated", async () => {
    const res = await POST(makeReq("POST", { apiKey: "k", projectId: "p" }));
    expect(res.status).toBe(401);
  });

  it("DELETE returns 401 when unauthenticated", async () => {
    const res = await DELETE(makeReq("DELETE"));
    expect(res.status).toBe(401);
  });
});

// ── GET /api/settings/posthog ──────────────────────────────────────────────

describe("GET /api/settings/posthog", () => {
  beforeEach(() => {
    mockGetSession.mockResolvedValue(authedSession);
  });

  it("returns { connected: false } when no config exists", async () => {
    mockFindUnique.mockResolvedValue(null);
    const res = await GET(makeReq("GET"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.connected).toBe(false);
  });

  it("returns masked API key (last 6 chars visible)", async () => {
    const plainKey = "phc_abcdefghij123456";
    mockFindUnique.mockResolvedValue({
      apiKey: encrypt(plainKey),
      projectId: "proj123",
      host: "https://app.posthog.com",
    });
    const res = await GET(makeReq("GET"));
    const body = await res.json();
    expect(body.connected).toBe(true);
    expect(body.apiKeyMasked).toMatch(/••••••/);
    expect(body.apiKeyMasked).toContain(plainKey.slice(-6));
    // Full key must NOT appear in response
    expect(JSON.stringify(body)).not.toContain(plainKey);
  });

  it("returns projectId and host in response", async () => {
    mockFindUnique.mockResolvedValue({
      apiKey: encrypt("phc_testkey"),
      projectId: "myproject",
      host: "https://eu.posthog.com",
    });
    const res = await GET(makeReq("GET"));
    const body = await res.json();
    expect(body.projectId).toBe("myproject");
    expect(body.host).toBe("https://eu.posthog.com");
  });
});

// ── POST /api/settings/posthog ─────────────────────────────────────────────

describe("POST /api/settings/posthog", () => {
  beforeEach(() => {
    mockGetSession.mockResolvedValue(authedSession);
  });

  it("returns 400 when apiKey is missing", async () => {
    const res = await POST(makeReq("POST", { projectId: "p" }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/apiKey/i);
  });

  it("returns 400 when projectId is missing", async () => {
    const res = await POST(makeReq("POST", { apiKey: "key" }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/projectId/i);
  });

  it("returns 200 and upserts config on valid input", async () => {
    const res = await POST(makeReq("POST", { apiKey: "phc_key", projectId: "proj1" }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(mockUpsert).toHaveBeenCalledTimes(1);
  });

  it("stores API key encrypted (not plain text)", async () => {
    await POST(makeReq("POST", { apiKey: "phc_secret123", projectId: "p1" }));
    const upsertCall = mockUpsert.mock.calls[0][0];
    const storedKey = upsertCall.create.apiKey;
    expect(storedKey).not.toBe("phc_secret123");
    expect(storedKey).toContain(":");
  });

  it("defaults host to https://app.posthog.com when not provided", async () => {
    await POST(makeReq("POST", { apiKey: "k", projectId: "p" }));
    const upsertCall = mockUpsert.mock.calls[0][0];
    expect(upsertCall.create.host).toBe("https://app.posthog.com");
  });

  it("strips trailing slash from custom host", async () => {
    await POST(makeReq("POST", { apiKey: "k", projectId: "p", host: "https://eu.posthog.com/" }));
    const upsertCall = mockUpsert.mock.calls[0][0];
    expect(upsertCall.create.host).toBe("https://eu.posthog.com");
  });
});

// ── DELETE /api/settings/posthog ──────────────────────────────────────────

describe("DELETE /api/settings/posthog", () => {
  beforeEach(() => {
    mockGetSession.mockResolvedValue(authedSession);
  });

  it("returns 200 and calls deleteMany", async () => {
    const res = await DELETE(makeReq("DELETE"));
    expect(res.status).toBe(200);
    expect(mockDeleteMany).toHaveBeenCalledWith({ where: { userId: "user1" } });
  });
});
