import { test, expect } from "@playwright/test";

/**
 * RBAC redirect smoke tests.
 * Verifies that protected routes reject unauthenticated requests with the
 * correct HTTP status or redirect to sign-in — never silently return 200.
 */

const PROTECTED_API_ROUTES = [
  "/api/patients",
  "/api/encounters",
  "/api/prior-auth",           // prior-auth list (if it exists as GET)
  "/api/compliance",
  "/api/ehr/status",
];

const PROTECTED_PAGE_ROUTES = [
  "/encounters",
  "/patients",
  "/prior-auth",
  "/settings/users",
  "/settings/practice",
  "/analytics",
];

test.describe("API routes — unauthenticated access blocked", () => {
  for (const route of PROTECTED_API_ROUTES) {
    test(`GET ${route} returns 401 or 403`, async ({ request }) => {
      const res = await request.get(route);
      expect([401, 403]).toContain(res.status());
    });
  }
});

test.describe("Dashboard pages — unauthenticated redirect to sign-in", () => {
  for (const route of PROTECTED_PAGE_ROUTES) {
    test(`GET ${route} redirects unauthenticated users`, async ({ page }) => {
      await page.goto(route);
      // Clerk redirects to /sign-in; allow up to 8s for the redirect
      await expect(page).toHaveURL(/sign-in/, { timeout: 8_000 });
    });
  }
});
