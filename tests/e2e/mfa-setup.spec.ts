import { test, expect } from "@playwright/test";

/**
 * MFA setup flow E2E test.
 *
 * Prerequisites (set via env):
 *   CLERK_TEST_USER_EMAIL    — email of a pre-created test Clerk user
 *   CLERK_TEST_USER_PASSWORD — password for that user
 *
 * The test user must NOT have MFA enabled so the setup flow is reached.
 * In CI, provision a fresh test user before this suite runs.
 */

const TEST_EMAIL = process.env.CLERK_TEST_USER_EMAIL ?? "";
const TEST_PASSWORD = process.env.CLERK_TEST_USER_PASSWORD ?? "";

test.describe("MFA setup flow", () => {
  test.skip(
    !TEST_EMAIL || !TEST_PASSWORD,
    "CLERK_TEST_USER_EMAIL and CLERK_TEST_USER_PASSWORD must be set"
  );

  test("unauthenticated user is redirected to sign-in", async ({ page }) => {
    await page.goto("/mfa-verify");
    // Clerk redirects unauthenticated users to /sign-in
    await expect(page).toHaveURL(/sign-in/);
  });

  test("after sign-in without MFA, redirected to /mfa-verify with QR code", async ({
    page,
  }) => {
    // Sign in via Clerk-hosted UI
    await page.goto("/sign-in");
    await page.getByLabel(/email/i).fill(TEST_EMAIL);
    await page.getByLabel(/password/i).fill(TEST_PASSWORD);
    await page.getByRole("button", { name: /sign in|continue/i }).click();

    // Should land on /mfa-verify (setup mode — no MFA cookie yet)
    await page.waitForURL(/mfa-verify/, { timeout: 10_000 });

    // Setup mode shows a QR code image
    const qrImg = page.getByAltText("Authenticator QR code");
    await expect(qrImg).toBeVisible({ timeout: 10_000 });

    // 6-digit input is rendered
    const codeInput = page.getByLabel(/6-digit code/i);
    await expect(codeInput).toBeVisible();
  });

  test("invalid TOTP code shows error and stays on /mfa-verify", async ({
    page,
  }) => {
    await page.goto("/sign-in");
    await page.getByLabel(/email/i).fill(TEST_EMAIL);
    await page.getByLabel(/password/i).fill(TEST_PASSWORD);
    await page.getByRole("button", { name: /sign in|continue/i }).click();
    await page.waitForURL(/mfa-verify/, { timeout: 10_000 });

    // Wait for the setup QR to load
    await page.getByAltText("Authenticator QR code").waitFor({ timeout: 10_000 });

    // Submit an obviously wrong 6-digit code
    const codeInput = page.getByLabel(/6-digit code/i);
    await codeInput.fill("000000");
    await page.getByRole("button", { name: /confirm|verify/i }).click();

    // Error message should appear
    const alert = page.getByRole("alert");
    await expect(alert).toBeVisible({ timeout: 5_000 });
    await expect(alert).not.toBeEmpty();

    // Still on /mfa-verify — not redirected
    expect(page.url()).toContain("/mfa-verify");
  });
});
