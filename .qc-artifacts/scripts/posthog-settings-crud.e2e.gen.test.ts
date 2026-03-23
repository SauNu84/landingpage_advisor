// @prism-workflow posthog-settings-crud
// @prism-dimensions D2,D4,D5
/**
 * E2E Workflow: PostHog Settings CRUD
 * Chain: POST (create) → GET (read, verify key masked)
 *        → POST /test (test connection) → POST (update) → DELETE → GET (verify gone)
 */

// ── mocks ──────────────────────────────────────────────────────────────────

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
jest.mock("@/lib/posthog-client", () => ({
  testPostHogConnection: jest.fn(),
}));

import { GET, POST, DELETE } from "@/app/api/settings/posthog/route";
import { POST as testConnection } from "@/app/api/settings/posthog/test/route";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionFromRequest } from "@/lib/session";
import { testPostHogConnection } from "@/lib/posthog-client";
import { encrypt } from "@/lib/encrypt";

const mockFindUnique = prisma.postHogConfig.findUnique as jest.MockedFunction<any>;
const mockUpsert = prisma.postHogConfig.upsert as jest.MockedFunction<any>;
const mockDeleteMany = prisma.postHogConfig.deleteMany as jest.MockedFunction<any>;
const mockGetSession = getSessionFromRequest as jest.MockedFunction<any>;
const mockTestConnection = testPostHogConnection as jest.MockedFunction<any>;

const AUTHED_SESSION = { userId: "user-posthog-1", email: "posthog-user@example.com" };

const INITIAL_KEY = "phc_initial_api_key_abcdef123456";
const UPDATED_KEY = "phc_updated_api_key_xyz789012345";
const PROJECT_ID = "proj-posthog-e2e";
const HOST = "https://app.posthog.com";

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

function makeTestReq(body?: unknown) {
  return new NextRequest("http://localhost/api/settings/posthog/test", {
    method: "POST",
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
  mockGetSession.mockResolvedValue(null);
});

// ── Auth guard ──────────────────────────────────────────────────────────────

describe("PostHog Settings CRUD E2E — auth guard", () => {
  it("GET returns 401 when unauthenticated", async () => {
    const res = await GET(makeReq("GET"));
    expect(res.status).toBe(401);
  });

  it("POST returns 401 when unauthenticated", async () => {
    const res = await POST(makeReq("POST", { apiKey: INITIAL_KEY, projectId: PROJECT_ID }));
    expect(res.status).toBe(401);
  });

  it("DELETE returns 401 when unauthenticated", async () => {
    const res = await DELETE(makeReq("DELETE"));
    expect(res.status).toBe(401);
  });

  it("POST /test returns 401 when unauthenticated", async () => {
    const res = await testConnection(
      makeTestReq({ apiKey: INITIAL_KEY, projectId: PROJECT_ID })
    );
    expect(res.status).toBe(401);
  });
});

// ── Step 1: Create ──────────────────────────────────────────────────────────

describe("PostHog Settings CRUD E2E — Step 1: POST (create)", () => {
  beforeEach(() => {
    mockGetSession.mockResolvedValue(AUTHED_SESSION);
  });

  it("returns 200 and ok:true when config is created", async () => {
    const res = await POST(makeReq("POST", { apiKey: INITIAL_KEY, projectId: PROJECT_ID }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
  });

  it("calls upsert with encrypted API key", async () => {
    await POST(makeReq("POST", { apiKey: INITIAL_KEY, projectId: PROJECT_ID }));
    expect(mockUpsert).toHaveBeenCalledTimes(1);
    const call = mockUpsert.mock.calls[0][0];
    expect(call.create.apiKey).not.toBe(INITIAL_KEY);
    expect(call.create.apiKey).toContain(":");
    expect(call.create.projectId).toBe(PROJECT_ID);
  });

  it("defaults host to https://app.posthog.com when not provided", async () => {
    await POST(makeReq("POST", { apiKey: INITIAL_KEY, projectId: PROJECT_ID }));
    const call = mockUpsert.mock.calls[0][0];
    expect(call.create.host).toBe("https://app.posthog.com");
  });

  it("strips trailing slash from custom host", async () => {
    await POST(makeReq("POST", {
      apiKey: INITIAL_KEY,
      projectId: PROJECT_ID,
      host: "https://eu.posthog.com/",
    }));
    const call = mockUpsert.mock.calls[0][0];
    expect(call.create.host).toBe("https://eu.posthog.com");
  });

  it("returns 400 when apiKey is missing", async () => {
    const res = await POST(makeReq("POST", { projectId: PROJECT_ID }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/apiKey/i);
  });

  it("returns 400 when projectId is missing", async () => {
    const res = await POST(makeReq("POST", { apiKey: INITIAL_KEY }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/projectId/i);
  });
});

// ── Step 2: Read (masked key) ───────────────────────────────────────────────

describe("PostHog Settings CRUD E2E — Step 2: GET (read with masked key)", () => {
  beforeEach(() => {
    mockGetSession.mockResolvedValue(AUTHED_SESSION);
  });

  it("returns connected:false when no config exists", async () => {
    mockFindUnique.mockResolvedValue(null);
    const res = await GET(makeReq("GET"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.connected).toBe(false);
  });

  it("returns connected:true with masked API key after config is saved", async () => {
    mockFindUnique.mockResolvedValue({
      apiKey: encrypt(INITIAL_KEY),
      projectId: PROJECT_ID,
      host: HOST,
    });

    const res = await GET(makeReq("GET"));
    expect(res.status).toBe(200);
    const body = await res.json();

    expect(body.connected).toBe(true);
    expect(body.apiKeyMasked).toMatch(/••••••/);
    expect(body.apiKeyMasked).toContain(INITIAL_KEY.slice(-6));
    // Full plaintext key must NOT be exposed
    expect(JSON.stringify(body)).not.toContain(INITIAL_KEY);
  });

  it("returns projectId and host in response", async () => {
    mockFindUnique.mockResolvedValue({
      apiKey: encrypt(INITIAL_KEY),
      projectId: PROJECT_ID,
      host: HOST,
    });

    const res = await GET(makeReq("GET"));
    const body = await res.json();
    expect(body.projectId).toBe(PROJECT_ID);
    expect(body.host).toBe(HOST);
  });
});

// ── Step 3: Test connection ─────────────────────────────────────────────────

describe("PostHog Settings CRUD E2E — Step 3: POST /test (test connection)", () => {
  beforeEach(() => {
    mockGetSession.mockResolvedValue(AUTHED_SESSION);
  });

  it("returns connection success when testPostHogConnection resolves ok", async () => {
    mockTestConnection.mockResolvedValue({ ok: true, eventCount: 42 });

    const res = await testConnection(
      makeTestReq({ apiKey: INITIAL_KEY, projectId: PROJECT_ID })
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
  });

  it("forwards failure from testPostHogConnection", async () => {
    mockTestConnection.mockResolvedValue({ ok: false, error: "Invalid API key" });

    const res = await testConnection(
      makeTestReq({ apiKey: "phc_bad_key", projectId: PROJECT_ID })
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(false);
    expect(body.error).toBeDefined();
  });

  it("returns 400 when apiKey is missing", async () => {
    const res = await testConnection(makeTestReq({ projectId: PROJECT_ID }));
    expect(res.status).toBe(400);
  });

  it("returns 400 when projectId is missing", async () => {
    const res = await testConnection(makeTestReq({ apiKey: INITIAL_KEY }));
    expect(res.status).toBe(400);
  });
});

// ── Step 4: Update ──────────────────────────────────────────────────────────

describe("PostHog Settings CRUD E2E — Step 4: POST (update)", () => {
  beforeEach(() => {
    mockGetSession.mockResolvedValue(AUTHED_SESSION);
  });

  it("upserts with new key when updating config", async () => {
    const res = await POST(makeReq("POST", {
      apiKey: UPDATED_KEY,
      projectId: PROJECT_ID,
      host: HOST,
    }));

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(mockUpsert).toHaveBeenCalledTimes(1);
    const call = mockUpsert.mock.calls[0][0];
    expect(call.update.apiKey).not.toBe(UPDATED_KEY); // should be encrypted
    expect(call.where.userId).toBe(AUTHED_SESSION.userId);
  });

  it("GET after update reflects the new (masked) key", async () => {
    mockFindUnique.mockResolvedValue({
      apiKey: encrypt(UPDATED_KEY),
      projectId: PROJECT_ID,
      host: HOST,
    });

    const res = await GET(makeReq("GET"));
    const body = await res.json();
    expect(body.connected).toBe(true);
    expect(body.apiKeyMasked).toContain(UPDATED_KEY.slice(-6));
    expect(JSON.stringify(body)).not.toContain(UPDATED_KEY);
  });
});

// ── Step 5: Delete ──────────────────────────────────────────────────────────

describe("PostHog Settings CRUD E2E — Step 5: DELETE", () => {
  beforeEach(() => {
    mockGetSession.mockResolvedValue(AUTHED_SESSION);
  });

  it("returns 200 and calls deleteMany for the authenticated user", async () => {
    const res = await DELETE(makeReq("DELETE"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(mockDeleteMany).toHaveBeenCalledWith({ where: { userId: AUTHED_SESSION.userId } });
  });
});

// ── Step 6: GET after delete (verify gone) ─────────────────────────────────

describe("PostHog Settings CRUD E2E — Step 6: GET after DELETE (verify gone)", () => {
  beforeEach(() => {
    mockGetSession.mockResolvedValue(AUTHED_SESSION);
  });

  it("returns connected:false after config is deleted", async () => {
    mockFindUnique.mockResolvedValue(null);

    const res = await GET(makeReq("GET"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.connected).toBe(false);
    expect(body.apiKeyMasked).toBeUndefined();
    expect(body.projectId).toBeUndefined();
  });
});

// ── Full CRUD chain in a single test ───────────────────────────────────────

describe("PostHog Settings CRUD E2E — complete chain", () => {
  it("create → read masked key → test connection → update → delete → verify gone", async () => {
    mockGetSession.mockResolvedValue(AUTHED_SESSION);

    // 1. Create
    const createRes = await POST(makeReq("POST", { apiKey: INITIAL_KEY, projectId: PROJECT_ID }));
    expect(createRes.status).toBe(200);
    expect((await createRes.json()).ok).toBe(true);

    // 2. Read — verify key is masked
    mockFindUnique.mockResolvedValue({
      apiKey: encrypt(INITIAL_KEY),
      projectId: PROJECT_ID,
      host: HOST,
    });
    const readRes1 = await GET(makeReq("GET"));
    const readBody1 = await readRes1.json();
    expect(readBody1.connected).toBe(true);
    expect(readBody1.apiKeyMasked).toContain(INITIAL_KEY.slice(-6));
    expect(JSON.stringify(readBody1)).not.toContain(INITIAL_KEY);

    // 3. Test connection
    mockTestConnection.mockResolvedValue({ ok: true, eventCount: 10 });
    const testRes = await testConnection(
      makeTestReq({ apiKey: INITIAL_KEY, projectId: PROJECT_ID })
    );
    expect(testRes.status).toBe(200);
    expect((await testRes.json()).ok).toBe(true);

    // 4. Update with new key
    jest.clearAllMocks();
    mockGetSession.mockResolvedValue(AUTHED_SESSION);
    mockUpsert.mockResolvedValue({});
    const updateRes = await POST(makeReq("POST", { apiKey: UPDATED_KEY, projectId: PROJECT_ID }));
    expect(updateRes.status).toBe(200);
    const updateCall = mockUpsert.mock.calls[0][0];
    // Encrypted key should differ from original
    expect(updateCall.update.apiKey).not.toBe(INITIAL_KEY);

    // 5. Delete
    mockDeleteMany.mockResolvedValue({ count: 1 });
    const deleteRes = await DELETE(makeReq("DELETE"));
    expect(deleteRes.status).toBe(200);

    // 6. Verify gone
    mockFindUnique.mockResolvedValue(null);
    const readRes2 = await GET(makeReq("GET"));
    const readBody2 = await readRes2.json();
    expect(readBody2.connected).toBe(false);
  });
});
