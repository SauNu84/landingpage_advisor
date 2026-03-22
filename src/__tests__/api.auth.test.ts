/**
 * Tests: src/app/api/auth/request-otp & verify-otp routes
 * OTP lifecycle: generation, expiry, invalidation, session creation
 */

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
  createSessionToken: jest.fn(() => Promise.resolve("jwt.session.token")),
  sessionCookieHeader: jest.fn(() => "auth_session=jwt.session.token; HttpOnly; Path=/; SameSite=Lax; Max-Age=604800"),
}));

import { POST as requestOtp } from "@/app/api/auth/request-otp/route";
import { POST as verifyOtp } from "@/app/api/auth/verify-otp/route";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { sendOtpEmail } from "@/lib/email";

const mockUpdateMany = prisma.otpToken.updateMany as jest.MockedFunction<any>;
const mockCreate = prisma.otpToken.create as jest.MockedFunction<any>;
const mockFindFirst = prisma.otpToken.findFirst as jest.MockedFunction<any>;
const mockUpdate = prisma.otpToken.update as jest.MockedFunction<any>;
const mockUserUpsert = prisma.user.upsert as jest.MockedFunction<any>;
const mockSendEmail = sendOtpEmail as jest.MockedFunction<typeof sendOtpEmail>;

function makeReq(path: string, body: unknown) {
  return new NextRequest(`http://localhost${path}`, {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  mockUpdateMany.mockResolvedValue({ count: 0 });
  mockCreate.mockResolvedValue({ id: "otp1" });
  mockSendEmail.mockResolvedValue(undefined);
  mockUserUpsert.mockResolvedValue({ id: "user1", email: "test@example.com" });
  mockUpdate.mockResolvedValue({ id: "otp1" });
});

// ── POST /api/auth/request-otp ─────────────────────────────────────────────

describe("POST /api/auth/request-otp", () => {
  it("returns 400 when email is missing", async () => {
    const res = await requestOtp(makeReq("/api/auth/request-otp", {}));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/email/i);
  });

  it("returns 400 for email without @", async () => {
    const res = await requestOtp(makeReq("/api/auth/request-otp", { email: "notanemail" }));
    expect(res.status).toBe(400);
  });

  it("returns 200 for valid email", async () => {
    const res = await requestOtp(makeReq("/api/auth/request-otp", { email: "user@example.com" }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
  });

  it("invalidates previous OTPs before creating new one", async () => {
    await requestOtp(makeReq("/api/auth/request-otp", { email: "user@example.com" }));
    expect(mockUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ email: "user@example.com", usedAt: null }),
      })
    );
    expect(mockCreate).toHaveBeenCalled();
  });

  it("sends OTP email", async () => {
    await requestOtp(makeReq("/api/auth/request-otp", { email: "user@example.com" }));
    expect(mockSendEmail).toHaveBeenCalledWith("user@example.com", expect.any(String));
  });

  it("sends a 6-digit numeric OTP", async () => {
    await requestOtp(makeReq("/api/auth/request-otp", { email: "user@example.com" }));
    const otp = mockSendEmail.mock.calls[0][1];
    expect(otp).toMatch(/^\d{6}$/);
  });

  it("normalises email to lowercase", async () => {
    await requestOtp(makeReq("/api/auth/request-otp", { email: "User@EXAMPLE.COM" }));
    expect(mockSendEmail).toHaveBeenCalledWith("user@example.com", expect.any(String));
  });

  it("returns 400 on invalid JSON body", async () => {
    const req = new NextRequest("http://localhost/api/auth/request-otp", {
      method: "POST",
      body: "{{bad json",
      headers: { "Content-Type": "application/json" },
    });
    const res = await requestOtp(req);
    expect(res.status).toBe(400);
  });
});

// ── POST /api/auth/verify-otp ──────────────────────────────────────────────

describe("POST /api/auth/verify-otp", () => {
  const validOtp = { id: "otp1", email: "user@example.com", token: "123456" };

  it("returns 400 when email is missing", async () => {
    const res = await verifyOtp(makeReq("/api/auth/verify-otp", { token: "123456" }));
    expect(res.status).toBe(400);
  });

  it("returns 400 when token is missing", async () => {
    const res = await verifyOtp(makeReq("/api/auth/verify-otp", { email: "u@e.com" }));
    expect(res.status).toBe(400);
  });

  it("returns 401 when OTP not found / expired", async () => {
    mockFindFirst.mockResolvedValue(null);
    const res = await verifyOtp(makeReq("/api/auth/verify-otp", { email: "u@e.com", token: "000000" }));
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toMatch(/invalid|expired/i);
  });

  it("returns 200 and sets session cookie on valid OTP", async () => {
    mockFindFirst.mockResolvedValue(validOtp);
    const res = await verifyOtp(
      makeReq("/api/auth/verify-otp", { email: "user@example.com", token: "123456" })
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.user).toEqual({ id: "user1", email: "test@example.com" });
    expect(res.headers.get("Set-Cookie")).toContain("auth_session=");
  });

  it("marks OTP as used after successful verification", async () => {
    mockFindFirst.mockResolvedValue(validOtp);
    await verifyOtp(makeReq("/api/auth/verify-otp", { email: "user@example.com", token: "123456" }));
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "otp1" },
        data: expect.objectContaining({ usedAt: expect.any(Date) }),
      })
    );
  });

  it("upserts user record on successful verification", async () => {
    mockFindFirst.mockResolvedValue(validOtp);
    await verifyOtp(makeReq("/api/auth/verify-otp", { email: "user@example.com", token: "123456" }));
    expect(mockUserUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { email: "user@example.com" },
      })
    );
  });
});
