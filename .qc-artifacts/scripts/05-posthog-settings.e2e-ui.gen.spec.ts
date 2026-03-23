// @prism-workflow posthog-settings
// @prism-dimensions settings, api-key, save, test-connection, disconnect, auth-guard
// NOTE: Requires running Next.js dev server: npm run dev
// NOTE: @playwright/test must be installed first: npm install --save-dev @playwright/test
// NOTE: Some tests are intentionally failing to CONFIRM known issues from static analysis

import { test, expect } from "@playwright/test";
import { injectSessionCookie } from "./ui-fixtures";

// ---------------------------------------------------------------------------
// Test suite: PostHog Settings page
//
// Component reference: src/app/[locale]/settings/posthog/page.tsx
//
// Key structural observations from source:
//  - On mount: fetches GET /api/settings/posthog.
//    If 401 → router.replace("/") (no visible settings page).
//    If 200 with connected:false → shows connection form only.
//    If 200 with connected:true → shows green status card + form.
//  - Form fields:
//      API Key: input type="password" (label from PostHogSettings.apiKeyLabel)
//      Project ID: input type="text", placeholder="12345"
//      Host: input type="text", placeholder="https://app.posthog.com"
//  - Two action buttons:
//      "Test connection" (type="button" calls handleTest)
//      "Save" (type="submit" calls handleSave)
//  - After successful save: green "Saved!" message; apiKeyMasked shown in status.
//  - After successful test: green test result message.
//  - Disconnect button (only when connected): calls DELETE /api/settings/posthog
//    after browser confirm() dialog.
// ---------------------------------------------------------------------------

// Helpers for stubbing the settings API
async function stubDisconnected(page: import("@playwright/test").Page) {
  await page.route("/api/settings/posthog", async (route) => {
    if (route.request().method() === "GET") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ connected: false }),
      });
    } else {
      await route.continue();
    }
  });
}

async function stubConnected(page: import("@playwright/test").Page) {
  await page.route("/api/settings/posthog", async (route) => {
    const method = route.request().method();
    if (method === "GET") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          connected: true,
          projectId: "99999",
          host: "https://app.posthog.com",
          apiKeyMasked: "••••••abc123",
        }),
      });
    } else {
      await route.continue();
    }
  });
}

test.describe("PostHog Settings — auth guard", () => {
  // -------------------------------------------------------------------------
  // T-PH-01: Unauthenticated visit redirects to home
  // -------------------------------------------------------------------------
  test("T-PH-01: visiting /settings/posthog unauthenticated redirects to home", async ({
    page,
  }) => {
    await page.route("/api/settings/posthog", async (route) => {
      await route.fulfill({
        status: 401,
        contentType: "application/json",
        body: JSON.stringify({ error: "Unauthorized" }),
      });
    });

    await page.goto("/en/settings/posthog");

    // router.replace("/") is called on 401 in useEffect
    await page.waitForURL(/\/en$|\/en\//, { timeout: 5000 });
    await expect(page).not.toHaveURL(/\/settings\/posthog/);
  });
});

test.describe("PostHog Settings — disconnected state", () => {
  test.beforeEach(async ({ page }) => {
    await stubDisconnected(page);

    const token = process.env.TEST_SESSION_TOKEN;
    if (token) await injectSessionCookie(page.context(), token);

    await page.goto("/en/settings/posthog");
  });

  // -------------------------------------------------------------------------
  // T-PH-02: Disconnected state renders connection form without status card
  // -------------------------------------------------------------------------
  test("T-PH-02: disconnected state shows form but no connected status banner", async ({
    page,
  }) => {
    // Green connected status banner should NOT be visible
    const connectedBanner = page.locator("div.bg-green-50.border-green-200");
    await expect(connectedBanner).not.toBeVisible();

    // Form inputs should be visible
    await expect(page.locator('input[type="password"]')).toBeVisible();
    await expect(
      page.locator('input[placeholder="12345"]')
    ).toBeVisible();
    await expect(
      page.locator('input[placeholder="https://app.posthog.com"]')
    ).toBeVisible();
  });

  // -------------------------------------------------------------------------
  // T-PH-03: Submitting without API key and project ID shows validation error
  // -------------------------------------------------------------------------
  test("T-PH-03: saving without API key and project ID shows validation error", async ({
    page,
  }) => {
    // Leave all fields empty, click Save
    await page.getByRole("button", { name: /save/i }).click();

    // Error is rendered as <p class="text-red-600 ..."> or inline message
    const error = page.locator("p.text-red-600");
    await expect(error).toBeVisible();
  });

  // -------------------------------------------------------------------------
  // T-PH-04: Successful save shows green confirmation and masked API key
  // -------------------------------------------------------------------------
  test("T-PH-04: successful save shows confirmation message and masked key in status", async ({
    page,
  }) => {
    // Stub the POST endpoint to return success
    await page.route("/api/settings/posthog", async (route) => {
      if (route.request().method() === "POST") {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ ok: true }),
        });
      } else {
        // GET — still disconnected for this override
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ connected: false }),
        });
      }
    });

    // Fill in valid credentials
    await page.locator('input[type="password"]').fill("phx_mytestapikey123456");
    await page.locator('input[placeholder="12345"]').fill("12345");

    await page.getByRole("button", { name: /save/i }).click();

    // After save: PostHogSettings.savedSuccess i18n key — green confirmation
    const confirmation = page.locator("p.text-green-700");
    await expect(confirmation).toBeVisible({ timeout: 5000 });

    // Component sets apiKeyMasked from last 6 chars: "••••••123456"
    // The status banner now appears (connected: true in local state)
    const maskedKey = page.locator("code").filter({ hasText: /^••/ });
    await expect(maskedKey).toBeVisible();
  });

  // -------------------------------------------------------------------------
  // T-PH-05: Test connection button triggers test API call
  // -------------------------------------------------------------------------
  test("T-PH-05: test connection button calls /api/settings/posthog/test", async ({
    page,
  }) => {
    let testApiCalled = false;
    await page.route("/api/settings/posthog/test", async (route) => {
      testApiCalled = true;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ ok: true, projectName: "My Project" }),
      });
    });

    await page.locator('input[type="password"]').fill("phx_testapikey123456");
    await page.locator('input[placeholder="12345"]').fill("12345");

    await page.getByRole("button", { name: /test/i }).click();

    // Wait for test result
    const successMsg = page.locator("div.bg-green-50.border-green-200").filter({
      hasText: /my project/i,
    });
    await expect(successMsg).toBeVisible({ timeout: 5000 });
    expect(testApiCalled).toBe(true);
  });

  // -------------------------------------------------------------------------
  // T-PH-06: Failed test connection shows error message
  // -------------------------------------------------------------------------
  test("T-PH-06: failed test connection shows error state", async ({
    page,
  }) => {
    await page.route("/api/settings/posthog/test", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ ok: false, error: "Invalid API key" }),
      });
    });

    await page.locator('input[type="password"]').fill("phx_badkey");
    await page.locator('input[placeholder="12345"]').fill("12345");
    await page.getByRole("button", { name: /test/i }).click();

    const errorMsg = page.locator("div.bg-red-50.border-red-200");
    await expect(errorMsg).toBeVisible({ timeout: 5000 });
    await expect(errorMsg).toContainText("Invalid API key");
  });
});

test.describe("PostHog Settings — connected state", () => {
  test.beforeEach(async ({ page }) => {
    await stubConnected(page);

    const token = process.env.TEST_SESSION_TOKEN;
    if (token) await injectSessionCookie(page.context(), token);

    await page.goto("/en/settings/posthog");
  });

  // -------------------------------------------------------------------------
  // T-PH-07: Connected state shows status banner with masked key and project ID
  // -------------------------------------------------------------------------
  test("T-PH-07: connected state shows green status banner with project and masked key", async ({
    page,
  }) => {
    const banner = page.locator("div.bg-green-50.border-green-200").first();
    await expect(banner).toBeVisible();

    // Project ID is displayed
    await expect(banner.locator("code").filter({ hasText: "99999" })).toBeVisible();

    // Masked API key
    await expect(banner.locator("code").filter({ hasText: /^••/ })).toBeVisible();

    // Host
    await expect(
      banner.locator("code").filter({ hasText: "app.posthog.com" })
    ).toBeVisible();
  });

  // -------------------------------------------------------------------------
  // T-PH-08: Disconnect button is visible when connected
  // -------------------------------------------------------------------------
  test("T-PH-08: disconnect button is visible in connected state", async ({
    page,
  }) => {
    const disconnectBtn = page.getByRole("button", { name: /disconnect/i });
    await expect(disconnectBtn).toBeVisible();
  });

  // -------------------------------------------------------------------------
  // T-PH-09: Disconnect button calls DELETE endpoint after browser confirm
  // -------------------------------------------------------------------------
  test("T-PH-09: confirming disconnect calls DELETE /api/settings/posthog and removes status banner", async ({
    page,
  }) => {
    let deleteWasCalled = false;

    await page.route("/api/settings/posthog", async (route) => {
      if (route.request().method() === "DELETE") {
        deleteWasCalled = true;
        await route.fulfill({ status: 200, body: JSON.stringify({ ok: true }) });
      } else {
        // Re-use connected stub for GET
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            connected: true,
            projectId: "99999",
            host: "https://app.posthog.com",
            apiKeyMasked: "••••••abc123",
          }),
        });
      }
    });

    // Accept the confirm() dialog
    page.once("dialog", (dialog) => dialog.accept());

    const disconnectBtn = page.getByRole("button", { name: /disconnect/i });
    await disconnectBtn.click();

    // After disconnect: setConfig({ connected: false }) → banner gone
    const banner = page.locator("div.bg-green-50.border-green-200");
    await expect(banner).not.toBeVisible({ timeout: 5000 });
    expect(deleteWasCalled).toBe(true);
  });

  // -------------------------------------------------------------------------
  // T-PH-10: Cancelling disconnect keeps the status banner intact
  // -------------------------------------------------------------------------
  test("T-PH-10: cancelling the disconnect confirm keeps connected status", async ({
    page,
  }) => {
    // Dismiss the confirm() dialog
    page.once("dialog", (dialog) => dialog.dismiss());

    await page.getByRole("button", { name: /disconnect/i }).click();

    // Banner should still be visible
    const banner = page.locator("div.bg-green-50.border-green-200").first();
    await expect(banner).toBeVisible();
  });

  // -------------------------------------------------------------------------
  // T-PH-11: Form heading changes to "Update connection" when already connected
  // -------------------------------------------------------------------------
  test("T-PH-11: form section heading reads 'Update connection' when already connected", async ({
    page,
  }) => {
    // PostHogSettings.updateConnection i18n key
    const formHeading = page.getByRole("heading", { name: /update connection/i });
    await expect(formHeading).toBeVisible();
  });

  // -------------------------------------------------------------------------
  // T-PH-12: API key placeholder shows update text when already connected
  // -------------------------------------------------------------------------
  test("T-PH-12: API key input shows update placeholder when connected", async ({
    page,
  }) => {
    // When connected, placeholder is t("apiKeyPlaceholderUpdate") — not "phx_..."
    const apiKeyInput = page.locator('input[type="password"]');
    const placeholder = await apiKeyInput.getAttribute("placeholder");
    // Placeholder should NOT be "phx_..." (that's the fresh connect state)
    expect(placeholder).not.toBe("phx_...");
    expect(placeholder!.length).toBeGreaterThan(0);
  });
});

test.describe("PostHog Settings — navigation", () => {
  test.beforeEach(async ({ page }) => {
    await stubDisconnected(page);
    const token = process.env.TEST_SESSION_TOKEN;
    if (token) await injectSessionCookie(page.context(), token);
    await page.goto("/en/settings/posthog");
  });

  // -------------------------------------------------------------------------
  // T-PH-13: Back link in header navigates to home page
  // -------------------------------------------------------------------------
  test("T-PH-13: back link in header navigates to home", async ({ page }) => {
    // PostHogSettings.back i18n key — rendered as a <Link href="/">
    const backLink = page.getByRole("link", { name: /back/i });
    await expect(backLink).toBeVisible();
    await backLink.click();

    await page.waitForURL(/\/en$|\/en\//, { timeout: 5000 });
    await expect(page).not.toHaveURL(/\/settings\/posthog/);
  });
});
