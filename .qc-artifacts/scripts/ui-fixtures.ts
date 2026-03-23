// ui-fixtures.ts
// @prism-workflow auth-fixtures
// NOTE: Requires running Next.js dev server: npm run dev
// NOTE: @playwright/test must be installed first: npm install --save-dev @playwright/test
//
// Auth notes:
// - The app uses a magic-link / OTP flow via /api/auth/request-otp and /api/auth/verify-otp
// - When RESEND_API_KEY is not set (local dev), the OTP code is logged to the server console
//   so you can observe it there during manual testing.
// - In CI / test environments, intercept the OTP via server log scraping or by seeding
//   the database directly (see prisma/schema.prisma — OtpToken table).

import { test as base, expect, type Page, type BrowserContext } from "@playwright/test";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Request an OTP for the given email address.
 * Returns the response body; does NOT complete the OTP step.
 *
 * In local dev (no RESEND_API_KEY), the 6-digit code is printed to the
 * Next.js server console. Retrieve it from there for the verify step.
 */
export async function requestOtp(page: Page, email: string): Promise<void> {
  const response = await page.request.post("/api/auth/request-otp", {
    data: { email: email.toLowerCase() },
    headers: { "Content-Type": "application/json" },
  });
  if (!response.ok()) {
    const body = await response.json();
    throw new Error(`request-otp failed: ${body.error ?? response.status()}`);
  }
}

/**
 * Verify an OTP for the given email, returning the set-cookie header value.
 * Pass the 6-digit code retrieved from the server console.
 */
export async function verifyOtp(
  page: Page,
  email: string,
  token: string
): Promise<void> {
  const response = await page.request.post("/api/auth/verify-otp", {
    data: { email: email.toLowerCase(), token },
    headers: { "Content-Type": "application/json" },
  });
  if (!response.ok()) {
    const body = await response.json();
    throw new Error(`verify-otp failed: ${body.error ?? response.status()}`);
  }
}

/**
 * Full sign-in helper: calls request-otp, then verifyOtp with the given token.
 * Typical usage in a test that can read the OTP token out-of-band:
 *
 *   const token = readOtpFromServerLog(); // test-infrastructure-specific
 *   await loginViaAPI(page, "user@example.com", token);
 */
export async function loginViaAPI(
  page: Page,
  email: string,
  token: string
): Promise<void> {
  await requestOtp(page, email);
  await verifyOtp(page, email, token);
}

/**
 * Inject a pre-existing auth_session cookie directly into the browser context.
 * Use this when you have a known session token seeded into the test database.
 *
 * Example (with database seed):
 *   await injectSessionCookie(page.context(), process.env.TEST_SESSION_TOKEN!);
 *   await page.goto("/history");
 */
export async function injectSessionCookie(
  context: BrowserContext,
  sessionToken: string,
  baseURL = "http://localhost:3000"
): Promise<void> {
  await context.addCookies([
    {
      name: "auth_session",
      value: sessionToken,
      domain: new URL(baseURL).hostname,
      path: "/",
      httpOnly: true,
      secure: false,
      sameSite: "Lax",
    },
  ]);
}

// ---------------------------------------------------------------------------
// Custom fixtures
// ---------------------------------------------------------------------------

type AuthFixtures = {
  /** A page that already has an authenticated session cookie injected.
   *  Requires TEST_SESSION_TOKEN env var to contain a valid, pre-seeded token. */
  authenticatedPage: Page;
};

export const test = base.extend<AuthFixtures>({
  authenticatedPage: async ({ page, context }, use) => {
    const token = process.env.TEST_SESSION_TOKEN;
    if (!token) {
      throw new Error(
        "TEST_SESSION_TOKEN env var must be set to run authenticated tests. " +
          "Seed a session into the database and export its token."
      );
    }
    await injectSessionCookie(context, token);
    await use(page);
  },
});

export { expect };
