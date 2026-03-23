// @prism-workflow auth-flow
// @prism-dimensions D2,D4
/**
 * E2E Workflow: Auth Flow
 * Chain: request-otp → verify-otp (session cookie set) → auth/me (user returned)
 *        → signout (cookie cleared) → auth/me (user null)
 * Error paths: invalid OTP → 401, missing email → 400
 */

// ── mocks ──────────────────────────────────────────────────────────────────

const mockOtpToken = {
  updateMany: jest.fn(),
  create: jest.fn(),
  findFirst: jest.fn(),
  update: jest.fn(),
};
const mockUser = { upsert: jest.fn() };

jest.mock("@/lib/db", () => ({
  prisma: {
    get otpToken() { return mockOtpToken; },
    get user() { return mockUser; },
    $transaction: jest.fn(async (fn: (tx: unknown) => Promise<unknown>) =>
      fn({ otpToken: mockOtpToken, user: mockUser })
    ),
  },
}));
jest.mock("@/lib/email", () => ({ sendOtpEmail: jest.fn() }));
jest.mock("@/lib/session", () => ({
  createSessionToken: jest.fn(() => Promise.resolve("jwt.e2e.session.token")),
  sessionCookieHeader: jest.fn(
    () => "auth_session=jwt.e2e.session.token; HttpOnly; Path=/; SameSite=Lax; Max-Age=604800"
  ),
  clearSessionCookieHeader: jest.fn(
    () => "auth_session=; HttpOnly; Path=/; SameSite=Lax; Max-Age=0"
  ),
  getSessionFromRequest: jest.fn(),
}));

import { POST as requestOtp } from "@/app/api/auth/request-otp/route";
import { POST as verifyOtp } from "@/app/api/auth/verify-otp/route";
import { GET as authMe } from "@/app/api/auth/me/route";
import { POST as signout } from "@/app/api/auth/signout/route";
import { NextRequest } from "next/server";
import { getSessionFromRequest } from "@/lib/session";

const mockGetSession = getSessionFromRequest as jest.MockedFunction<any>;
const mockOtpFindFirst = mockOtpToken.findFirst as jest.MockedFunction<any>;
const mockOtpCreate = mockOtpToken.create as jest.MockedFunction<any>;
const mockOtpUpdateMany = mockOtpToken.updateMany as jest.MockedFunction<any>;
const mockOtpUpdate = mockOtpToken.update as jest.MockedFunction<any>;
const mockUserUpsert = mockUser.upsert as jest.MockedFunction<any>;

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

const TEST_EMAIL = "e2e-user@example.com";
const TEST_OTP = "654321";
const VALID_OTP_RECORD = { id: "otp-e2e-1", email: TEST_EMAIL, token: TEST_OTP };
const AUTHED_USER = { id: "user-e2e-1", email: TEST_EMAIL };

beforeEach(() => {
  jest.clearAllMocks();
  mockOtpUpdateMany.mockResolvedValue({ count: 0 });
  mockOtpCreate.mockResolvedValue({ id: "otp-e2e-1" });
  mockOtpUpdate.mockResolvedValue({ id: "otp-e2e-1" });
  mockUserUpsert.mockResolvedValue(AUTHED_USER);
  mockGetSession.mockResolvedValue(null);
});

// ── Workflow: Full auth chain ───────────────────────────────────────────────

describe("Auth Flow E2E — happy path chain", () => {
  it("Step 1: POST /api/auth/request-otp returns ok:true for valid email", async () => {
    const res = await requestOtp(makePostReq("/api/auth/request-otp", { email: TEST_EMAIL }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
  });

  it("Step 2: POST /api/auth/verify-otp sets session cookie and returns user", async () => {
    mockOtpFindFirst.mockResolvedValue(VALID_OTP_RECORD);

    const res = await verifyOtp(
      makePostReq("/api/auth/verify-otp", { email: TEST_EMAIL, token: TEST_OTP })
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.user).toEqual({ id: AUTHED_USER.id, email: AUTHED_USER.email });

    const cookie = res.headers.get("Set-Cookie");
    expect(cookie).not.toBeNull();
    expect(cookie).toContain("auth_session=");
    expect(cookie).toContain("HttpOnly");
  });

  it("Step 3: GET /api/auth/me returns user when session is active", async () => {
    mockGetSession.mockResolvedValue({ userId: AUTHED_USER.id, email: AUTHED_USER.email });

    const res = await authMe(makeGetReq("/api/auth/me"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.user).toEqual({ id: AUTHED_USER.id, email: AUTHED_USER.email });
  });

  it("Step 4: POST /api/auth/signout clears the session cookie", async () => {
    const res = await signout();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);

    const cookie = res.headers.get("Set-Cookie");
    expect(cookie).not.toBeNull();
    expect(cookie).toContain("auth_session=;");
    expect(cookie).toContain("Max-Age=0");
  });

  it("Step 5: GET /api/auth/me returns null user after signout", async () => {
    mockGetSession.mockResolvedValue(null);

    const res = await authMe(makeGetReq("/api/auth/me"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.user).toBeNull();
  });
});

// ── Full workflow in sequence ───────────────────────────────────────────────

describe("Auth Flow E2E — complete chain in single test", () => {
  it("chains request-otp → verify-otp → me → signout → me", async () => {
    // 1. Request OTP
    const otpRes = await requestOtp(
      makePostReq("/api/auth/request-otp", { email: TEST_EMAIL })
    );
    expect(otpRes.status).toBe(200);

    // 2. Verify OTP — session cookie set
    mockOtpFindFirst.mockResolvedValue(VALID_OTP_RECORD);
    const verifyRes = await verifyOtp(
      makePostReq("/api/auth/verify-otp", { email: TEST_EMAIL, token: TEST_OTP })
    );
    expect(verifyRes.status).toBe(200);
    const verifyCookie = verifyRes.headers.get("Set-Cookie");
    expect(verifyCookie).toContain("auth_session=");

    // 3. auth/me — authenticated
    mockGetSession.mockResolvedValue({ userId: AUTHED_USER.id, email: AUTHED_USER.email });
    const meRes1 = await authMe(makeGetReq("/api/auth/me"));
    expect((await meRes1.json()).user).not.toBeNull();

    // 4. Signout — cookie cleared
    const signoutRes = await signout();
    expect(signoutRes.headers.get("Set-Cookie")).toContain("Max-Age=0");

    // 5. auth/me — unauthenticated
    mockGetSession.mockResolvedValue(null);
    const meRes2 = await authMe(makeGetReq("/api/auth/me"));
    expect((await meRes2.json()).user).toBeNull();
  });
});

// ── Error paths ─────────────────────────────────────────────────────────────

describe("Auth Flow E2E — error paths", () => {
  it("POST /api/auth/request-otp returns 400 when email is missing", async () => {
    const res = await requestOtp(makePostReq("/api/auth/request-otp", {}));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/email/i);
  });

  it("POST /api/auth/request-otp returns 400 for email without @", async () => {
    const res = await requestOtp(makePostReq("/api/auth/request-otp", { email: "notvalid" }));
    expect(res.status).toBe(400);
  });

  it("POST /api/auth/verify-otp returns 401 for invalid OTP token", async () => {
    mockOtpFindFirst.mockResolvedValue(null);
    const res = await verifyOtp(
      makePostReq("/api/auth/verify-otp", { email: TEST_EMAIL, token: "000000" })
    );
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toMatch(/invalid|expired/i);
  });

  it("POST /api/auth/verify-otp returns 400 when email is missing", async () => {
    const res = await verifyOtp(makePostReq("/api/auth/verify-otp", { token: TEST_OTP }));
    expect(res.status).toBe(400);
  });

  it("POST /api/auth/verify-otp returns 400 when token is missing", async () => {
    const res = await verifyOtp(makePostReq("/api/auth/verify-otp", { email: TEST_EMAIL }));
    expect(res.status).toBe(400);
  });

  it("POST /api/auth/verify-otp marks OTP as used after successful verification", async () => {
    mockOtpFindFirst.mockResolvedValue(VALID_OTP_RECORD);
    await verifyOtp(makePostReq("/api/auth/verify-otp", { email: TEST_EMAIL, token: TEST_OTP }));
    expect(mockOtpUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: VALID_OTP_RECORD.id },
        data: expect.objectContaining({ usedAt: expect.any(Date) }),
      })
    );
  });

  it("POST /api/auth/request-otp invalidates prior OTPs before creating new one", async () => {
    await requestOtp(makePostReq("/api/auth/request-otp", { email: TEST_EMAIL }));
    expect(mockOtpUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ email: TEST_EMAIL, usedAt: null }),
      })
    );
    expect(mockOtpCreate).toHaveBeenCalled();
  });
});
