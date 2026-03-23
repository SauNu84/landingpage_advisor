/**
 * Tests: src/app/api/settings/posthog/test/route.ts
 * Auth guard, input validation, PostHog connection test
 */

// ── mocks ──────────────────────────────────────────────────────────────────

jest.mock("@/lib/session", () => ({
  getSessionFromRequest: jest.fn(),
}));

jest.mock("@/lib/posthog-client", () => ({
  testPostHogConnection: jest.fn(),
}));

import { POST } from "@/app/api/settings/posthog/test/route";
import { NextRequest } from "next/server";
import { getSessionFromRequest } from "@/lib/session";
import { testPostHogConnection } from "@/lib/posthog-client";

const mockGetSession = getSessionFromRequest as jest.MockedFunction<typeof getSessionFromRequest>;
const mockTestConnection = testPostHogConnection as jest.MockedFunction<typeof testPostHogConnection>;

function makeReq(body: unknown) {
  return new NextRequest("http://localhost/api/settings/posthog/test", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe("POST /api/settings/posthog/test", () => {
  it("returns 401 when not authenticated", async () => {
    mockGetSession.mockResolvedValue(null);
    const res = await POST(makeReq({ apiKey: "phc_key", projectId: "123" }));
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toMatch(/unauthorized/i);
  });

  it("returns 400 when apiKey is missing", async () => {
    mockGetSession.mockResolvedValue({ userId: "u1", email: "u@e.com" });
    const res = await POST(makeReq({ projectId: "123" }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/apiKey|projectId/i);
  });

  it("returns 400 when projectId is missing", async () => {
    mockGetSession.mockResolvedValue({ userId: "u1", email: "u@e.com" });
    const res = await POST(makeReq({ apiKey: "phc_key" }));
    expect(res.status).toBe(400);
  });

  it("returns 400 on invalid JSON body", async () => {
    mockGetSession.mockResolvedValue({ userId: "u1", email: "u@e.com" });
    const req = new NextRequest("http://localhost/api/settings/posthog/test", {
      method: "POST",
      body: "{{bad",
      headers: { "Content-Type": "application/json" },
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("returns connection result on success", async () => {
    mockGetSession.mockResolvedValue({ userId: "u1", email: "u@e.com" });
    mockTestConnection.mockResolvedValue({ ok: true, projectName: "My Project" });
    const res = await POST(makeReq({ apiKey: "phc_key", projectId: "123" }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.projectName).toBe("My Project");
  });

  it("returns failure result when connection fails", async () => {
    mockGetSession.mockResolvedValue({ userId: "u1", email: "u@e.com" });
    mockTestConnection.mockResolvedValue({ ok: false, error: "HTTP 401: Unauthorized" });
    const res = await POST(makeReq({ apiKey: "bad_key", projectId: "123" }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(false);
    expect(body.error).toMatch(/401/);
  });

  it("uses default host when not provided", async () => {
    mockGetSession.mockResolvedValue({ userId: "u1", email: "u@e.com" });
    mockTestConnection.mockResolvedValue({ ok: true, projectName: "P" });
    await POST(makeReq({ apiKey: "phc_key", projectId: "123" }));
    expect(mockTestConnection).toHaveBeenCalledWith(
      "123",
      "phc_key",
      "https://app.posthog.com"
    );
  });

  it("trims trailing slash from custom host", async () => {
    mockGetSession.mockResolvedValue({ userId: "u1", email: "u@e.com" });
    mockTestConnection.mockResolvedValue({ ok: true, projectName: "P" });
    await POST(makeReq({ apiKey: "phc_key", projectId: "123", host: "https://eu.posthog.com/" }));
    expect(mockTestConnection).toHaveBeenCalledWith(
      "123",
      "phc_key",
      "https://eu.posthog.com"
    );
  });
});
