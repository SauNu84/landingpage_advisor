// @prism-workflow accessibility-checks
// @prism-dimensions a11y, aria, focus-management, skip-links
// NOTE: Requires running Next.js dev server: npm run dev
// NOTE: @playwright/test must be installed first: npm install --save-dev @playwright/test
// NOTE: Some tests are intentionally failing to CONFIRM known issues from static analysis

import { test, expect } from "@playwright/test";

// ---------------------------------------------------------------------------
// Test suite: Accessibility checks across key pages
//
// Tests in this file are a mix of:
//   - Expected passing tests (confirms correct a11y behaviour)
//   - test.fail() tests that CONFIRM known issues found by static analysis
//
// FINDING references:
//   FINDING-010: UserNav authenticated menu button missing aria-expanded
//   FINDING-012: No skip-navigation link present in the app shell
//   FINDING-013: Error messages not linked to their inputs via aria-describedby
// ---------------------------------------------------------------------------

test.describe("Accessibility — landing page", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/en");
  });

  // -------------------------------------------------------------------------
  // T-A11Y-01 (INTENTIONALLY FAILS — FINDING-012)
  // Skip-to-content link should be the first focusable element
  // -------------------------------------------------------------------------
  test.fail(
    "T-A11Y-01 [FINDING-012]: skip-to-content link is the first focusable element",
    async ({ page }) => {
      // A skip link is not present in any of the page layouts discovered in source.
      // src/app/[locale]/page.tsx renders <main> directly without a skip link.
      // This test confirms FINDING-012 by being marked test.fail().
      //
      // To fix: add <a href="#main-content" class="sr-only focus:not-sr-only ...">
      //         Skip to content</a> as the very first element in the layout.

      await page.keyboard.press("Tab");
      const firstFocused = await page.evaluate(
        () => document.activeElement?.getAttribute("href") ?? ""
      );
      expect(firstFocused).toBe("#main-content");
    }
  );

  // -------------------------------------------------------------------------
  // T-A11Y-02: Main landmark is present
  // -------------------------------------------------------------------------
  test("T-A11Y-02: page has a <main> landmark element", async ({ page }) => {
    await expect(page.getByRole("main")).toBeVisible();
  });

  // -------------------------------------------------------------------------
  // T-A11Y-03: URL input has an associated <label>
  // -------------------------------------------------------------------------
  test("T-A11Y-03: URL input is associated with a label via for/id", async ({
    page,
  }) => {
    // label[for="url"] is present and input#url exists
    await expect(page.locator('label[for="url"]')).toBeVisible();
    await expect(page.locator("#url")).toBeVisible();
  });

  // -------------------------------------------------------------------------
  // T-A11Y-04 (INTENTIONALLY FAILS — FINDING-013)
  // URL input error message should be linked via aria-describedby
  // -------------------------------------------------------------------------
  test.fail(
    "T-A11Y-04 [FINDING-013]: URL input error is linked via aria-describedby",
    async ({ page }) => {
      // In page.tsx, the error <p> has no id and input#url has no aria-describedby.
      // Screen readers cannot programmatically associate the error with the field.
      //
      // To fix: give the error <p id="url-error"> and add aria-describedby="url-error"
      //         to input#url when an error is present.

      // Trigger the error state
      await page.locator("#url").fill("");
      await page.getByRole("button", { name: /analyze/i }).click();

      // Verify the link — this will fail because the attribute is absent
      const input = page.locator("#url");
      const describedBy = await input.getAttribute("aria-describedby");
      expect(describedBy).toBeTruthy();

      // Also verify the referenced element exists
      const errorEl = page.locator(`#${describedBy}`);
      await expect(errorEl).toBeVisible();
    }
  );

  // -------------------------------------------------------------------------
  // T-A11Y-05: Mode toggle buttons have visible text (not icon-only)
  // -------------------------------------------------------------------------
  test("T-A11Y-05: mode toggle buttons are not icon-only (have visible text)", async ({
    page,
  }) => {
    for (const name of [/single/i, /compare/i, /bulk/i]) {
      const btn = page.getByRole("button", { name });
      await expect(btn).toBeVisible();
      // Accessible name matches visible text (no icon-only buttons here)
      const text = await btn.innerText();
      expect(text.trim().length).toBeGreaterThan(0);
    }
  });

  // -------------------------------------------------------------------------
  // T-A11Y-06: Page has a single h1 element
  // -------------------------------------------------------------------------
  test("T-A11Y-06: page contains exactly one h1 element", async ({ page }) => {
    const h1s = page.getByRole("heading", { level: 1 });
    await expect(h1s).toHaveCount(1);
  });
});

test.describe("Accessibility — SignInModal", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/en");
    // Open the modal
    await page.getByRole("button", { name: /sign in/i }).click();
  });

  // -------------------------------------------------------------------------
  // T-A11Y-07: SignInModal traps focus (FocusTrap is used)
  // -------------------------------------------------------------------------
  test("T-A11Y-07: SignInModal traps focus — Tab cycles within the dialog", async ({
    page,
  }) => {
    // SignInModal wraps content in <FocusTrap> (focus-trap-react package).
    // Tab from the email input should stay inside the dialog.
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();

    // The email input should be auto-focused
    const emailInput = dialog.locator('input[type="email"]');
    await expect(emailInput).toBeFocused();

    // Tab forward through all focusable elements — focus should stay in dialog
    // (FocusTrap prevents escape). Tab 5 times and check each time.
    for (let i = 0; i < 5; i++) {
      await page.keyboard.press("Tab");
      const activeInDialog = await page.evaluate(() => {
        const dialog = document.querySelector('[role="dialog"]');
        return dialog
          ? dialog.contains(document.activeElement)
          : false;
      });
      expect(activeInDialog).toBe(true);
    }
  });

  // -------------------------------------------------------------------------
  // T-A11Y-08: Modal can be closed with Escape key
  // -------------------------------------------------------------------------
  test("T-A11Y-08: pressing Escape key closes the modal", async ({ page }) => {
    await expect(page.getByRole("dialog")).toBeVisible();
    await page.keyboard.press("Escape");
    // FocusTrap by default calls onDeactivate on Escape; SignInModal uses
    // the backdrop/close-button mechanism. This may need wiring if not handled.
    // Test documents expected behaviour — adjust once implemented.
    await expect(page.getByRole("dialog")).not.toBeVisible({ timeout: 2000 });
  });

  // -------------------------------------------------------------------------
  // T-A11Y-09: Close button has accessible label (aria-label)
  // -------------------------------------------------------------------------
  test("T-A11Y-09: close button has aria-label attribute", async ({ page }) => {
    const closeBtn = page
      .getByRole("dialog")
      .getByRole("button", { name: /close/i });
    await expect(closeBtn).toHaveAttribute("aria-label");
    const label = await closeBtn.getAttribute("aria-label");
    expect(label!.trim().length).toBeGreaterThan(0);
  });

  // -------------------------------------------------------------------------
  // T-A11Y-10 (INTENTIONALLY FAILS — FINDING-013)
  // Modal email input error not linked via aria-describedby
  // -------------------------------------------------------------------------
  test.fail(
    "T-A11Y-10 [FINDING-013]: modal email input error linked via aria-describedby",
    async ({ page }) => {
      // SignInModal email <input type="email"> has no aria-describedby.
      // The error <p> has no id. Same pattern as the landing page URL field.

      const dialog = page.getByRole("dialog");
      await dialog.locator('input[type="email"]').fill("bad");
      await dialog.getByRole("button", { name: /send code/i }).click();

      const input = dialog.locator('input[type="email"]');
      const describedBy = await input.getAttribute("aria-describedby");
      expect(describedBy).toBeTruthy();
    }
  );
});

test.describe("Accessibility — UserNav authenticated state", () => {
  // -------------------------------------------------------------------------
  // T-A11Y-11 (INTENTIONALLY FAILS — FINDING-010)
  // Authenticated menu button should expose aria-expanded
  // -------------------------------------------------------------------------
  test.fail(
    "T-A11Y-11 [FINDING-010]: authenticated user menu button has aria-expanded",
    async ({ page }) => {
      // Stub /api/auth/me to return a logged-in user
      await page.route("/api/auth/me", async (route) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ user: { id: "u1", email: "user@example.com" } }),
        });
      });
      await page.goto("/en");

      // The button that shows user.email should have aria-expanded
      const menuBtn = page.getByRole("button", { name: /user@example\.com/i });
      await expect(menuBtn).toHaveAttribute("aria-expanded", "false");

      await menuBtn.click();
      await expect(menuBtn).toHaveAttribute("aria-expanded", "true");
    }
  );
});

test.describe("Accessibility — history page", () => {
  // -------------------------------------------------------------------------
  // T-A11Y-12: Unauthenticated history page has a visible heading
  // -------------------------------------------------------------------------
  test("T-A11Y-12: unauthenticated /history page has accessible heading", async ({
    page,
  }) => {
    // Stub 401 so we see the "sign in required" branch
    await page.route("/api/history*", async (route) => {
      await route.fulfill({ status: 401, body: JSON.stringify({ error: "Unauthorized" }) });
    });
    await page.goto("/en/history");

    const heading = page.getByRole("heading");
    await expect(heading).toBeVisible();
  });
});
