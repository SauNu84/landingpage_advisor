/**
 * Tests: src/app/api/email/route.ts
 * Email capture: validation, persistence
 */

// ── mocks ──────────────────────────────────────────────────────────────────

const mockEmailCapture = { create: jest.fn() };

jest.mock("@/lib/db", () => ({
  prisma: {
    get emailCapture() { return mockEmailCapture; },
  },
}));

import { POST } from "@/app/api/email/route";
import { NextRequest } from "next/server";

function makeReq(body: unknown) {
  return new NextRequest("http://localhost/api/email", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  mockEmailCapture.create.mockResolvedValue({ id: "cap1" });
});

describe("POST /api/email", () => {
  it("returns 400 when email is missing", async () => {
    const res = await POST(makeReq({ slug: "abc123" }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/email/i);
  });

  it("returns 400 when email has no @ sign", async () => {
    const res = await POST(makeReq({ email: "notanemail", slug: "abc123" }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/email/i);
  });

  it("returns 400 when slug is missing", async () => {
    const res = await POST(makeReq({ email: "user@example.com" }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/slug/i);
  });

  it("returns 400 when slug is not a string", async () => {
    const res = await POST(makeReq({ email: "user@example.com", slug: 123 }));
    expect(res.status).toBe(400);
  });

  it("returns 400 on invalid JSON body", async () => {
    const req = new NextRequest("http://localhost/api/email", {
      method: "POST",
      body: "{{bad",
      headers: { "Content-Type": "application/json" },
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("returns 200 and persists email capture on success", async () => {
    const res = await POST(makeReq({ email: "user@example.com", slug: "abc123" }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(mockEmailCapture.create).toHaveBeenCalledWith({
      data: { email: "user@example.com", slug: "abc123" },
    });
  });
});
