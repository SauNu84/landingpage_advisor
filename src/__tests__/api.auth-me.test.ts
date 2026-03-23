/**
 * Tests: src/app/api/auth/me & src/app/api/auth/signout routes
 */

jest.mock("@/lib/session", () => ({
  getSessionFromRequest: jest.fn(),
  clearSessionCookieHeader: jest.fn(() => "auth_session=; HttpOnly; Path=/; SameSite=Lax; Max-Age=0"),
}));

import { GET as getMe } from "@/app/api/auth/me/route";
import { POST as signout } from "@/app/api/auth/signout/route";
import { NextRequest } from "next/server";
import { getSessionFromRequest } from "@/lib/session";

const mockGetSession = getSessionFromRequest as jest.MockedFunction<typeof getSessionFromRequest>;

function makeGetReq(path: string) {
  return new NextRequest(`http://localhost${path}`, { method: "GET" });
}

function makePostReq(path: string) {
  return new NextRequest(`http://localhost${path}`, { method: "POST" });
}

beforeEach(() => {
  jest.clearAllMocks();
});

// ── GET /api/auth/me ────────────────────────────────────────────────────────

describe("GET /api/auth/me", () => {
  it("returns { user: null } when no session", async () => {
    mockGetSession.mockResolvedValue(null);
    const res = await getMe(makeGetReq("/api/auth/me"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ user: null });
  });

  it("returns user object when session exists", async () => {
    mockGetSession.mockResolvedValue({ userId: "user123", email: "test@example.com" });
    const res = await getMe(makeGetReq("/api/auth/me"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ user: { id: "user123", email: "test@example.com" } });
  });

  it("does not expose extra session fields", async () => {
    mockGetSession.mockResolvedValue({ userId: "user123", email: "test@example.com" });
    const res = await getMe(makeGetReq("/api/auth/me"));
    const body = await res.json();
    expect(Object.keys(body.user)).toEqual(["id", "email"]);
  });
});

// ── POST /api/auth/signout ──────────────────────────────────────────────────

describe("POST /api/auth/signout", () => {
  it("returns { ok: true }", async () => {
    const res = await signout();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ ok: true });
  });

  it("sets a cleared session cookie", async () => {
    const res = await signout();
    const setCookie = res.headers.get("Set-Cookie");
    expect(setCookie).toContain("auth_session=");
    expect(setCookie).toContain("Max-Age=0");
  });
});
