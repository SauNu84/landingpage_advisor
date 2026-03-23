// @prism-workflow auth-flow
// @prism-dimensions authentication, modal, email-otp
// NOTE: Requires running Next.js dev server: npm run dev
// NOTE: @playwright/test must be installed first: npm install --save-dev @playwright/test
// NOTE: Some tests are intentionally failing to CONFIRM known issues from static analysis

import { test, expect } from "@playwright/test";

// ---------------------------------------------------------------------------
// Test suite: Authentication flow — Landing page → Sign-in modal → OTP step
//
// Component reference: src/components/UserNav.tsx, src/components/SignInModal.tsx
//
// Key structural observations from source:
//  - Unauthenticated state: UserNav renders a plain <button> with text from
//    t.signIn (Auth.signIn i18n key). No aria-expanded attribute is present
//    on this button — this is FINDING-010.
//  - Clicking that button sets showModal=true which mounts <SignInModal>.
//  - SignInModal renders a FocusTrap wrapping a div[role="dialog"][aria-modal="true"]
//    with aria-labelledby="signin-modal-title".
//  - Backdrop click (on the outer div, not the inner card) calls onClose().
//  - Step 1 (email): label "Email" (i18n), input type="email", autoFocus.
//  - Step 2 (OTP): label "Verification code" (i18n), input type="text",
//    inputMode="numeric", maxLength=6.
// ---------------------------------------------------------------------------

test.describe("Auth flow", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/en");
  });

  // -------------------------------------------------------------------------
  // T-AUTH-01: Sign-in button is visible when unauthenticated
  // -------------------------------------------------------------------------
  test("T-AUTH-01: sign-in button is visible in UserNav when unauthenticated", async ({
    page,
  }) => {
    // The UserNav sign-in button uses text from Auth.signIn translation key.
    // Default English value is "Sign in".
    const signInBtn = page.getByRole("button", { name: /sign in/i });
    await expect(signInBtn).toBeVisible();
  });

  // -------------------------------------------------------------------------
  // T-AUTH-02: Clicking "Sign in" opens the modal with correct ARIA roles
  // -------------------------------------------------------------------------
  test("T-AUTH-02: clicking sign-in opens dialog with role=dialog", async ({
    page,
  }) => {
    await page.getByRole("button", { name: /sign in/i }).click();

    // SignInModal renders role="dialog" aria-modal="true"
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await expect(dialog).toHaveAttribute("aria-modal", "true");
  });

  // -------------------------------------------------------------------------
  // T-AUTH-03: Modal is labelled by its heading (aria-labelledby)
  // -------------------------------------------------------------------------
  test("T-AUTH-03: modal heading is linked via aria-labelledby", async ({
    page,
  }) => {
    await page.getByRole("button", { name: /sign in/i }).click();

    const dialog = page.getByRole("dialog");
    await expect(dialog).toHaveAttribute("aria-labelledby", "signin-modal-title");

    // The heading itself must be present and non-empty
    const heading = page.locator("#signin-modal-title");
    await expect(heading).toBeVisible();
    await expect(heading).not.toBeEmpty();
  });

  // -------------------------------------------------------------------------
  // T-AUTH-04: Email input appears and accepts typed text
  // -------------------------------------------------------------------------
  test("T-AUTH-04: email input is present and accepts input", async ({
    page,
  }) => {
    await page.getByRole("button", { name: /sign in/i }).click();

    // Email input inside the modal — type="email" with autoFocus
    const emailInput = page.getByRole("dialog").locator('input[type="email"]');
    await expect(emailInput).toBeVisible();
    await expect(emailInput).toBeFocused();

    await emailInput.fill("test@example.com");
    await expect(emailInput).toHaveValue("test@example.com");
  });

  // -------------------------------------------------------------------------
  // T-AUTH-05: Invalid email shows inline error
  // -------------------------------------------------------------------------
  test("T-AUTH-05: submitting empty/invalid email shows validation error", async ({
    page,
  }) => {
    await page.getByRole("button", { name: /sign in/i }).click();
    const dialog = page.getByRole("dialog");

    // Submit with empty email — SignInModal checks !email.includes("@")
    const emailInput = dialog.locator('input[type="email"]');
    await emailInput.fill("notanemail");

    // Click the send-code button
    await dialog.getByRole("button", { name: /send code/i }).click();

    // Error paragraph is rendered as a <p> with red styling, no aria-describedby link
    // NOTE: FINDING-013 — error is not linked via aria-describedby to the input
    const error = dialog.locator("p.text-red-600");
    await expect(error).toBeVisible();
  });

  // -------------------------------------------------------------------------
  // T-AUTH-06: Submitting valid email transitions to OTP step
  // -------------------------------------------------------------------------
  test("T-AUTH-06: valid email submission shows OTP code step", async ({
    page,
  }) => {
    await page.getByRole("button", { name: /sign in/i }).click();
    const dialog = page.getByRole("dialog");

    // Intercept the OTP request so we don't need a real email service
    await page.route("/api/auth/request-otp", async (route) => {
      await route.fulfill({ status: 200, body: JSON.stringify({ ok: true }) });
    });

    await dialog.locator('input[type="email"]').fill("test@example.com");
    await dialog.getByRole("button", { name: /send code/i }).click();

    // After success, step transitions to OTP: input type="text" inputMode="numeric"
    const otpInput = dialog.locator('input[inputmode="numeric"]');
    await expect(otpInput).toBeVisible();
    await expect(otpInput).toBeFocused();
  });

  // -------------------------------------------------------------------------
  // T-AUTH-07: OTP input accepts only 6 digits
  // -------------------------------------------------------------------------
  test("T-AUTH-07: OTP input enforces 6-digit numeric constraint", async ({
    page,
  }) => {
    await page.getByRole("button", { name: /sign in/i }).click();
    const dialog = page.getByRole("dialog");

    await page.route("/api/auth/request-otp", async (route) => {
      await route.fulfill({ status: 200, body: JSON.stringify({ ok: true }) });
    });

    await dialog.locator('input[type="email"]').fill("test@example.com");
    await dialog.getByRole("button", { name: /send code/i }).click();

    const otpInput = dialog.locator('input[inputmode="numeric"]');
    await expect(otpInput).toHaveAttribute("maxlength", "6");
    await expect(otpInput).toHaveAttribute("pattern", "[0-9]{6}");
  });

  // -------------------------------------------------------------------------
  // T-AUTH-08: Back button returns to email step from OTP step
  // -------------------------------------------------------------------------
  test("T-AUTH-08: back button from OTP step returns to email step", async ({
    page,
  }) => {
    await page.getByRole("button", { name: /sign in/i }).click();
    const dialog = page.getByRole("dialog");

    await page.route("/api/auth/request-otp", async (route) => {
      await route.fulfill({ status: 200, body: JSON.stringify({ ok: true }) });
    });

    await dialog.locator('input[type="email"]').fill("test@example.com");
    await dialog.getByRole("button", { name: /send code/i }).click();

    // Click back button
    await dialog.getByRole("button", { name: /back/i }).click();

    // Should be back on email step
    await expect(dialog.locator('input[type="email"]')).toBeVisible();
  });

  // -------------------------------------------------------------------------
  // T-AUTH-09: Close button dismisses the modal
  // -------------------------------------------------------------------------
  test("T-AUTH-09: close button dismisses the modal", async ({ page }) => {
    await page.getByRole("button", { name: /sign in/i }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();

    // Close button has aria-label from t.close ("Close" in English)
    await dialog.getByRole("button", { name: /close/i }).click();
    await expect(dialog).not.toBeVisible();
  });

  // -------------------------------------------------------------------------
  // T-AUTH-10: Backdrop click dismisses the modal
  // -------------------------------------------------------------------------
  test("T-AUTH-10: clicking backdrop (outside modal card) closes the modal", async ({
    page,
  }) => {
    await page.getByRole("button", { name: /sign in/i }).click();
    await expect(page.getByRole("dialog")).toBeVisible();

    // Click on the backdrop: the outer FocusTrap div (role="dialog") at its
    // edge, not the inner white card. Use a corner click.
    await page.mouse.click(10, 10);
    await expect(page.getByRole("dialog")).not.toBeVisible();
  });

  // -------------------------------------------------------------------------
  // T-AUTH-11 (INTENTIONALLY FAILS — FINDING-010)
  // UserNav authenticated menu button lacks aria-expanded
  // -------------------------------------------------------------------------
  test.fail(
    "T-AUTH-11 [FINDING-010]: authenticated user button has aria-expanded attribute",
    async ({ page }) => {
      // This test is expected to FAIL because UserNav's authenticated dropdown
      // button does not set aria-expanded. It should toggle between
      // aria-expanded="true" and aria-expanded="false" with showMenu state.
      //
      // To fix: add aria-expanded={showMenu} to the button in UserNav.tsx (line ~92)

      // Inject a fake auth session to render the authenticated state
      await page.route("/api/auth/me", async (route) => {
        await route.fulfill({
          status: 200,
          body: JSON.stringify({ user: { id: "1", email: "user@example.com" } }),
        });
      });
      await page.goto("/en");

      const menuBtn = page.locator('[data-testid="user-menu-button"]').or(
        page.getByRole("button", { name: /user@example\.com/i })
      );
      await expect(menuBtn).toHaveAttribute("aria-expanded", "false");
    }
  );
});
