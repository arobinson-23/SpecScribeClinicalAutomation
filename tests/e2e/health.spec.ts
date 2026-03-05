import { test, expect } from "@playwright/test";

/**
 * Health endpoint smoke test.
 * No auth dependency — runs against any running instance.
 * Fast and always-on in CI before any other E2E tests.
 */
test.describe("GET /api/health", () => {
  test("returns 200 with status ok", async ({ request }) => {
    const res = await request.get("/api/health");

    expect(res.status()).toBe(200);

    const body = (await res.json()) as {
      status: string;
      db: string;
      timestamp: string;
    };

    expect(body.status).toBe("ok");
    expect(body.db).toBe("ok");
    expect(typeof body.timestamp).toBe("string");
    // ISO 8601 sanity check
    expect(new Date(body.timestamp).getTime()).toBeGreaterThan(0);
  });
});
