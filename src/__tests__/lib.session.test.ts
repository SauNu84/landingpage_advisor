/**
 * Tests: src/lib/session.ts
 * JWT-based session create / verify / cookie helpers
 */

process.env.SESSION_SECRET = "test-secret-32chars-padded-here!!";

import {
  createSessionToken,
  verifySessionToken,
  sessionCookieHeader,
  clearSessionCookieHeader,
  SESSION_COOKIE,
} from "@/lib/session";

const PAYLOAD = { userId: "user_abc123", email: "test@example.com" };

describe("createSessionToken", () => {
  it("returns a non-empty JWT string", async () => {
    const token = await createSessionToken(PAYLOAD);
    expect(typeof token).toBe("string");
    expect(token.split(".").length).toBe(3); // header.payload.sig
  });
});

describe("verifySessionToken", () => {
  it("returns the original payload for a valid token", async () => {
    const token = await createSessionToken(PAYLOAD);
    const result = await verifySessionToken(token);
    expect(result).toEqual(PAYLOAD);
  });

  it("returns null for a garbage string", async () => {
    expect(await verifySessionToken("not.a.token")).toBeNull();
  });

  it("returns null for an empty string", async () => {
    expect(await verifySessionToken("")).toBeNull();
  });

  it("returns null when signed with a different secret", async () => {
    // Sign with different env to produce wrong-key token
    const originalSecret = process.env.SESSION_SECRET;
    process.env.SESSION_SECRET = "different-secret-32chars-padding!";
    const wrongToken = await createSessionToken(PAYLOAD);
    process.env.SESSION_SECRET = originalSecret;
    // Now verify against original secret — should fail
    expect(await verifySessionToken(wrongToken)).toBeNull();
  });
});

describe("sessionCookieHeader", () => {
  it("includes the cookie name and token", async () => {
    const token = await createSessionToken(PAYLOAD);
    const header = sessionCookieHeader(token);
    expect(header).toContain(`${SESSION_COOKIE}=${token}`);
  });

  it("sets HttpOnly and SameSite=Lax", async () => {
    const header = sessionCookieHeader("tok");
    expect(header).toContain("HttpOnly");
    expect(header).toContain("SameSite=Lax");
  });

  it("sets Max-Age to 7 days (604800 seconds)", async () => {
    const header = sessionCookieHeader("tok");
    expect(header).toContain("Max-Age=604800");
  });
});

describe("clearSessionCookieHeader", () => {
  it("sets Max-Age=0 to expire the cookie", () => {
    const header = clearSessionCookieHeader();
    expect(header).toContain("Max-Age=0");
  });

  it("includes the cookie name", () => {
    expect(clearSessionCookieHeader()).toContain(SESSION_COOKIE);
  });
});
