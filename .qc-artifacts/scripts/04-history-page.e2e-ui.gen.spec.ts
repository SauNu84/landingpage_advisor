// @prism-workflow history-page
// @prism-dimensions authentication-guard, history-list, pagination, empty-state
// NOTE: Requires running Next.js dev server: npm run dev
// NOTE: @playwright/test must be installed first: npm install --save-dev @playwright/test
// NOTE: Some tests are intentionally failing to CONFIRM known issues from static analysis

import { test, expect } from "@playwright/test";
import { injectSessionCookie } from "./ui-fixtures";

// ---------------------------------------------------------------------------
// Test suite: History page
//
// Component reference: src/app/[locale]/history/page.tsx
//
// Key structural observations from source:
//  - Fetches GET /api/history on mount.
//  - If 401: renders "Sign in required" state with a "Go home" button.
//    Heading text from History.signInRequired i18n key.
//  - If empty results: renders empty-state card with History.empty text.
//  - If items: renders a list of <Link> cards linking to /r/{slug}.
//    Each card shows hostname, date, score badge, and expert score chips.
//  - If nextCursor is present: shows "Load more" button.
//  - Loading state: renders t("loading") text while fetch is in flight.
// ---------------------------------------------------------------------------

// Reusable fake history data
const fakeHistoryItem = {
  id: "item-1",
  slug: "result-abc",
  url: "https://example.com/landing",
  secondaryUrl: null,
  overallScore: 74,
  expertScores: { "ui-design": 72, "ux-research": 68, seo: 75 },
  createdAt: "2026-03-20T10:00:00.000Z",
  isComparison: false,
};

const fakeComparisonItem = {
  id: "item-2",
  slug: "result-def",
  url: "https://example.com",
  secondaryUrl: "https://competitor.com",
  overallScore: 65,
  expertScores: {},
  createdAt: "2026-03-19T08:00:00.000Z",
  isComparison: true,
};

test.describe("History page — unauthenticated", () => {
  // -------------------------------------------------------------------------
  // T-HIST-01: Unauthenticated visit shows sign-in prompt
  // -------------------------------------------------------------------------
  test("T-HIST-01: visiting /history unauthenticated shows sign-in required state", async ({
    page,
  }) => {
    await page.route("/api/history*", async (route) => {
      await route.fulfill({
        status: 401,
        contentType: "application/json",
        body: JSON.stringify({ error: "Unauthorized" }),
      });
    });

    await page.goto("/en/history");

    // HistoryPage renders h2 with History.signInRequired on 401
    const heading = page.getByRole("heading", { level: 2 });
    await expect(heading).toBeVisible();

    // Lock icon SVG is present (inside the indigo-100 circle)
    const lockCircle = page.locator(
      "div.w-12.h-12.bg-indigo-100.rounded-full"
    );
    await expect(lockCircle).toBeVisible();
  });

  // -------------------------------------------------------------------------
  // T-HIST-02: "Go home" button on sign-in prompt navigates to landing page
  // -------------------------------------------------------------------------
  test("T-HIST-02: go-home button navigates to landing page", async ({
    page,
  }) => {
    await page.route("/api/history*", async (route) => {
      await route.fulfill({
        status: 401,
        contentType: "application/json",
        body: JSON.stringify({ error: "Unauthorized" }),
      });
    });

    await page.goto("/en/history");

    // Button text from History.goHome i18n key ("Go home" or similar)
    const goHomeBtn = page.getByRole("button", { name: /go home/i });
    await expect(goHomeBtn).toBeVisible();
    await goHomeBtn.click();

    await page.waitForURL(/\/en$|\/en\//, { timeout: 5000 });
    await expect(page).not.toHaveURL(/\/en\/history/);
  });

  // -------------------------------------------------------------------------
  // T-HIST-03: Loading state is shown while fetch is in flight
  // -------------------------------------------------------------------------
  test("T-HIST-03: loading indicator is shown while /api/history is pending", async ({
    page,
  }) => {
    let resolveRoute: () => void;
    const routeHeld = new Promise<void>((res) => { resolveRoute = res; });

    await page.route("/api/history*", async (route) => {
      // Hold the response until we signal
      await routeHeld;
      await route.fulfill({
        status: 401,
        contentType: "application/json",
        body: JSON.stringify({ error: "Unauthorized" }),
      });
    });

    await page.goto("/en/history");

    // While held, loading text should be visible
    // History.loading i18n key (likely "Loading..." in English)
    const loadingEl = page.getByText(/loading/i);
    await expect(loadingEl).toBeVisible({ timeout: 3000 });

    // Release the route
    resolveRoute!();
  });
});

test.describe("History page — authenticated, empty state", () => {
  // -------------------------------------------------------------------------
  // T-HIST-04: Empty history shows empty-state card
  // -------------------------------------------------------------------------
  test("T-HIST-04: authenticated user with no history sees empty state card", async ({
    page,
  }) => {
    await page.route("/api/history*", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ results: [], nextCursor: null }),
      });
    });

    // Use cookie injection if TEST_SESSION_TOKEN is available; otherwise just
    // stub the API (the component doesn't re-check auth after 200 response)
    const token = process.env.TEST_SESSION_TOKEN;
    if (token) {
      await injectSessionCookie(page.context(), token);
    }

    await page.goto("/en/history");

    // Empty state card: History.empty i18n key
    const emptyCard = page.locator(
      "div.text-center.py-20.bg-white.rounded-2xl"
    );
    await expect(emptyCard).toBeVisible();
  });
});

test.describe("History page — authenticated, with results", () => {
  test.beforeEach(async ({ page }) => {
    await page.route("/api/history*", async (route) => {
      const url = new URL(route.request().url());
      const cursor = url.searchParams.get("cursor");

      if (cursor === "page2") {
        // Second page — no more results
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            results: [fakeComparisonItem],
            nextCursor: null,
          }),
        });
      } else {
        // First page — has nextCursor
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            results: [fakeHistoryItem],
            nextCursor: "page2",
          }),
        });
      }
    });

    const token = process.env.TEST_SESSION_TOKEN;
    if (token) {
      await injectSessionCookie(page.context(), token);
    }

    await page.goto("/en/history");
  });

  // -------------------------------------------------------------------------
  // T-HIST-05: History items are rendered as links
  // -------------------------------------------------------------------------
  test("T-HIST-05: history items render as links to /r/{slug}", async ({
    page,
  }) => {
    const itemLink = page.getByRole("link").filter({
      hasText: /example\.com/,
    });
    await expect(itemLink).toBeVisible();
    await expect(itemLink).toHaveAttribute("href", /\/r\/result-abc/);
  });

  // -------------------------------------------------------------------------
  // T-HIST-06: Score badge is shown for items with an overall score
  // -------------------------------------------------------------------------
  test("T-HIST-06: score badge is visible for items with overallScore", async ({
    page,
  }) => {
    // ScoreBadge renders a span with the numeric score; 74 is green (>= 50 but < 75)
    // Actually 74 < 75 so it's yellow (>= 50 text-yellow-700)
    const scoreBadge = page.locator(
      "span.rounded-full.font-semibold"
    ).filter({ hasText: "74" });
    await expect(scoreBadge).toBeVisible();
  });

  // -------------------------------------------------------------------------
  // T-HIST-07: Expert score chips are visible on items that have them
  // -------------------------------------------------------------------------
  test("T-HIST-07: expert score chips are rendered for items with expertScores", async ({
    page,
  }) => {
    // fakeHistoryItem has expertScores: { "ui-design": 72, ... }
    const chip = page.locator("span.bg-gray-100.text-gray-600.text-xs").first();
    await expect(chip).toBeVisible();
  });

  // -------------------------------------------------------------------------
  // T-HIST-08: "Load more" button is shown when nextCursor is present
  // -------------------------------------------------------------------------
  test("T-HIST-08: load more button is visible when nextCursor is returned", async ({
    page,
  }) => {
    const loadMoreBtn = page.getByRole("button", { name: /load more/i });
    await expect(loadMoreBtn).toBeVisible();
  });

  // -------------------------------------------------------------------------
  // T-HIST-09: Clicking "Load more" appends next page and hides button
  // -------------------------------------------------------------------------
  test("T-HIST-09: clicking load more appends items and hides button when no further pages", async ({
    page,
  }) => {
    const loadMoreBtn = page.getByRole("button", { name: /load more/i });
    await loadMoreBtn.click();

    // After loading, the comparison item from page 2 should now be visible
    const comparisonBadge = page.locator(
      "span.bg-purple-100.text-purple-700"
    );
    await expect(comparisonBadge).toBeVisible({ timeout: 5000 });

    // nextCursor is null after page 2 → button disappears
    await expect(loadMoreBtn).not.toBeVisible();
  });

  // -------------------------------------------------------------------------
  // T-HIST-10: Comparison items show the "comparison" badge and "vs" hostname
  // -------------------------------------------------------------------------
  test("T-HIST-10: comparison items show comparison badge and secondary URL", async ({
    page,
  }) => {
    // Load the second page which contains fakeComparisonItem
    await page.getByRole("button", { name: /load more/i }).click();

    // isComparison=true → span with "comparison" text (History.comparison i18n key)
    const compBadge = page.locator("span.bg-purple-100.text-purple-700");
    await expect(compBadge).toBeVisible({ timeout: 5000 });

    // secondaryUrl is shown as "vs competitor.com"
    const vsText = page.getByText(/vs competitor\.com/i);
    await expect(vsText).toBeVisible();
  });

  // -------------------------------------------------------------------------
  // T-HIST-11: "Analyze new" button navigates to landing page
  // -------------------------------------------------------------------------
  test("T-HIST-11: analyze new button navigates to the home page", async ({
    page,
  }) => {
    // Header contains a button/link with History.analyzeNew text
    const analyzeNewBtn = page.getByRole("button", { name: /analyze new/i });
    await expect(analyzeNewBtn).toBeVisible();
    await analyzeNewBtn.click();

    await page.waitForURL(/\/en$|\/en\//, { timeout: 5000 });
    await expect(page).not.toHaveURL(/\/en\/history/);
  });
});
