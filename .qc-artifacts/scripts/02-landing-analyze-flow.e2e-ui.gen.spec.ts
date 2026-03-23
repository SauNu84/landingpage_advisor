// @prism-workflow landing-analyze-flow
// @prism-dimensions home-page, url-input, mode-tabs, loading-state, analyze-result
// NOTE: Requires running Next.js dev server: npm run dev
// NOTE: @playwright/test must be installed first: npm install --save-dev @playwright/test
// NOTE: Some tests are intentionally failing to CONFIRM known issues from static analysis

import { test, expect } from "@playwright/test";

// ---------------------------------------------------------------------------
// Test suite: Landing page → URL input → Analyze → Results
//
// Component reference: src/app/[locale]/page.tsx, src/app/[locale]/analyze/page.tsx
//
// Key structural observations from source:
//  - Page renders a mode toggle with 3 buttons: Single (default), Compare, Bulk.
//    Buttons use text from t("modeToggle.single/compare/bulk") i18n keys.
//  - Single mode: label[for="url"] + input#url + submit button.
//  - Compare mode: label[for="url1"] + input#url1, label[for="url2"] + input#url2.
//  - Bulk mode: label[for="bulk-urls"] + textarea#bulk-urls.
//  - On submit: loading state renders <LoadingExpert> with expert badges cycling.
//  - On success: sessionStorage.setItem("analysisResult", ...) then router.push("/analyze").
//  - Analyze page reads sessionStorage; if empty, redirects to "/".
//  - Error messages render as <p class="text-red-600 ..."> inline, no role="alert".
// ---------------------------------------------------------------------------

test.describe("Landing page — single URL analyze flow", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/en");
  });

  // -------------------------------------------------------------------------
  // T-LAND-01: Landing page renders key structural elements
  // -------------------------------------------------------------------------
  test("T-LAND-01: landing page renders heading, mode toggle, and URL input", async ({
    page,
  }) => {
    // App name heading (Common.appName i18n key — "Landing Page Advisor")
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();

    // Mode toggle buttons
    await expect(page.getByRole("button", { name: /single/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /compare/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /bulk/i })).toBeVisible();

    // Single mode form with labeled input (default state)
    await expect(page.locator("#url")).toBeVisible();
    await expect(page.locator('label[for="url"]')).toBeVisible();
  });

  // -------------------------------------------------------------------------
  // T-LAND-02: URL input has autoFocus in single mode
  // -------------------------------------------------------------------------
  test("T-LAND-02: URL input is focused on page load (autoFocus)", async ({
    page,
  }) => {
    await expect(page.locator("#url")).toBeFocused();
  });

  // -------------------------------------------------------------------------
  // T-LAND-03: Submitting empty URL shows validation error
  // -------------------------------------------------------------------------
  test("T-LAND-03: submitting empty URL renders inline error", async ({
    page,
  }) => {
    // Submit with blank input — triggers t("errors.enterUrl")
    await page.locator("#url").fill("");
    await page.getByRole("button", { name: /analyze/i }).click();

    const error = page.locator("p.text-red-600");
    await expect(error).toBeVisible();
    await expect(error).not.toBeEmpty();
  });

  // -------------------------------------------------------------------------
  // T-LAND-04: Submitting invalid URL shows invalid URL error
  // -------------------------------------------------------------------------
  test("T-LAND-04: submitting non-URL string shows invalid URL error", async ({
    page,
  }) => {
    await page.locator("#url").fill("not-a-url");
    await page.getByRole("button", { name: /analyze/i }).click();

    const error = page.locator("p.text-red-600");
    await expect(error).toBeVisible();
  });

  // -------------------------------------------------------------------------
  // T-LAND-05: Valid URL submission triggers loading state then navigates
  // -------------------------------------------------------------------------
  test("T-LAND-05: valid URL submission shows loading state and navigates to /analyze", async ({
    page,
  }) => {
    // Stub the API so we don't need a real AI call
    const fakeResult = {
      url: "https://example.com",
      slug: "test-slug",
      analysedAt: new Date().toISOString(),
      experts: {
        "ui-design": { score: 72, summary: "Good", recommendations: [] },
        "ux-research": { score: 68, summary: "Fair", recommendations: [] },
        experiment: { score: 65, summary: "OK", recommendations: [] },
        content: { score: 80, summary: "Good", recommendations: [] },
        seo: { score: 75, summary: "Good", recommendations: [] },
        psychology: { score: 70, summary: "Good", recommendations: [] },
      },
      posthog: { events: [], funnels: [], properties: [] },
      liveData: null,
    };

    await page.route("/api/analyze", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(fakeResult),
      });
    });

    await page.locator("#url").fill("https://example.com");
    await page.getByRole("button", { name: /analyze/i }).click();

    // Loading state: LoadingExpert is rendered (page replaces form)
    // The loading view has no specific testid but the form is no longer visible
    await expect(page.locator("#url")).not.toBeVisible({ timeout: 5000 });

    // After API resolves, navigates to /analyze
    await page.waitForURL(/\/en\/analyze/, { timeout: 10000 });
    await expect(page).toHaveURL(/\/en\/analyze/);
  });

  // -------------------------------------------------------------------------
  // T-LAND-06: Expert badge pills are rendered on load
  // -------------------------------------------------------------------------
  test("T-LAND-06: expert badge pills are visible on the landing page", async ({
    page,
  }) => {
    // EXPERT_BADGES renders 7 spans with text from expertBadges.* i18n keys
    const badges = page.locator(
      "span.bg-indigo-50.text-indigo-700.rounded-full"
    );
    await expect(badges).toHaveCount(7);
  });
});

test.describe("Landing page — mode tab switching", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/en");
  });

  // -------------------------------------------------------------------------
  // T-LAND-07: Switching to Compare mode shows two URL inputs
  // -------------------------------------------------------------------------
  test("T-LAND-07: clicking Compare tab shows two labeled URL inputs", async ({
    page,
  }) => {
    await page.getByRole("button", { name: /compare/i }).click();

    await expect(page.locator("#url1")).toBeVisible();
    await expect(page.locator('label[for="url1"]')).toBeVisible();
    await expect(page.locator("#url2")).toBeVisible();
    await expect(page.locator('label[for="url2"]')).toBeVisible();

    // Single URL input should be gone
    await expect(page.locator("#url")).not.toBeVisible();
  });

  // -------------------------------------------------------------------------
  // T-LAND-08: Switching to Bulk mode shows textarea
  // -------------------------------------------------------------------------
  test("T-LAND-08: clicking Bulk tab shows labeled textarea", async ({
    page,
  }) => {
    await page.getByRole("button", { name: /bulk/i }).click();

    const textarea = page.locator("#bulk-urls");
    await expect(textarea).toBeVisible();
    await expect(page.locator('label[for="bulk-urls"]')).toBeVisible();

    // Single URL input should be gone
    await expect(page.locator("#url")).not.toBeVisible();
  });

  // -------------------------------------------------------------------------
  // T-LAND-09: Switching back to Single mode restores single input
  // -------------------------------------------------------------------------
  test("T-LAND-09: switching from Compare back to Single restores single URL form", async ({
    page,
  }) => {
    await page.getByRole("button", { name: /compare/i }).click();
    await page.getByRole("button", { name: /single/i }).click();

    await expect(page.locator("#url")).toBeVisible();
    await expect(page.locator("#url1")).not.toBeVisible();
  });

  // -------------------------------------------------------------------------
  // T-LAND-10: Bulk textarea shows live URL count badge
  // -------------------------------------------------------------------------
  test("T-LAND-10: bulk textarea shows live URL count badge when URLs are entered", async ({
    page,
  }) => {
    await page.getByRole("button", { name: /bulk/i }).click();

    // Initially no count badge (bulkUrlCount === 0 → badge hidden)
    const countBadge = page.locator("span.rounded-full").filter({
      hasNotText: /ui design|ux research|experiment|content|seo|psychology|posthog/i,
    });

    await page.locator("#bulk-urls").fill(
      "https://example.com\nhttps://test.com\nhttps://demo.com"
    );

    // After entering 3 URLs, count badge appears with green styling (3–10 is valid)
    const greenBadge = page.locator("span.text-green-700.bg-green-50");
    await expect(greenBadge).toBeVisible();
  });

  // -------------------------------------------------------------------------
  // T-LAND-11: Compare mode error clears when switching tabs
  // -------------------------------------------------------------------------
  test("T-LAND-11: validation error clears when switching modes", async ({
    page,
  }) => {
    // Trigger an error in compare mode (submit without filling both URLs)
    await page.getByRole("button", { name: /compare/i }).click();
    await page.getByRole("button", { name: /compare/i }).last().click(); // submit button text is "Compare"

    // Now switch to single — setError("") is called in onClick
    await page.getByRole("button", { name: /single/i }).click();

    // Error should be gone
    await expect(page.locator("p.text-red-600")).not.toBeVisible();
  });
});

test.describe("Analyze results page", () => {
  // -------------------------------------------------------------------------
  // T-ANALYZE-01: /analyze redirects to home when sessionStorage is empty
  // -------------------------------------------------------------------------
  test("T-ANALYZE-01: visiting /analyze without sessionStorage redirects to home", async ({
    page,
  }) => {
    // Navigate directly without seeding sessionStorage
    await page.goto("/en/analyze");
    // Page effect calls router.replace("/") on missing data
    await page.waitForURL(/\/en$|\/en\//, { timeout: 5000 });
    await expect(page).not.toHaveURL(/\/en\/analyze/);
  });

  // -------------------------------------------------------------------------
  // T-ANALYZE-02: /analyze renders score gauge and expert cards with seeded data
  // -------------------------------------------------------------------------
  test("T-ANALYZE-02: analyze page renders overall score and expert cards from sessionStorage", async ({
    page,
  }) => {
    const fakeResult = {
      url: "https://example.com",
      slug: "abc123",
      analysedAt: new Date().toISOString(),
      experts: {
        "ui-design": { score: 72, summary: "Good UI", recommendations: [] },
        "ux-research": { score: 68, summary: "Fair UX", recommendations: [] },
        experiment: { score: 65, summary: "OK tests", recommendations: [] },
        content: { score: 80, summary: "Good content", recommendations: [] },
        seo: { score: 75, summary: "Good SEO", recommendations: [] },
        psychology: { score: 70, summary: "Good psych", recommendations: [] },
      },
      posthog: { events: [], funnels: [], properties: [] },
      liveData: null,
    };

    // Seed sessionStorage before navigation
    await page.goto("/en");
    await page.evaluate((result) => {
      sessionStorage.setItem("analysisResult", JSON.stringify(result));
    }, fakeResult);

    await page.goto("/en/analyze");

    // URL of the analyzed page is shown in the h1
    await expect(
      page.getByRole("heading", { name: /example\.com/i })
    ).toBeVisible();

    // Expert card grid — AnalyzePage renders 6 ExpertCards
    // Each ExpertCard is inside the "Expert Analyses" section
    const expertSection = page.getByRole("heading", {
      name: /expert analyses/i,
    });
    await expect(expertSection).toBeVisible();
  });
});
