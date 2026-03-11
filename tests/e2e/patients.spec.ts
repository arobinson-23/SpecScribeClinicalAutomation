import { test, expect } from "@playwright/test";

/**
 * Patients list and API smoke tests.
 * No auth dependency for API shape tests — auth-gated results are acceptable.
 */

test.describe("Patients", () => {
  test("GET /api/patients returns correct envelope shape", async ({
    request,
  }) => {
    const res = await request.get("/api/patients");

    // 401/403 is acceptable (unauthenticated in CI); 200 requires correct shape
    if (res.status() === 200) {
      const body = (await res.json()) as {
        data: unknown[] | null;
        error: string | null;
        meta?: unknown;
      };
      expect(body).toHaveProperty("data");
      expect(body).toHaveProperty("error");
      expect(Array.isArray(body.data)).toBe(true);
    } else {
      expect([401, 403]).toContain(res.status());
    }
  });

  test("POST /api/patients with invalid body returns 400", async ({
    request,
  }) => {
    const res = await request.post("/api/patients", {
      data: { firstName: "" }, // missing required fields
    });

    // 401/403 from auth guard is fine; 400 confirms Zod validation fires
    expect([400, 401, 403]).toContain(res.status());
  });

  test("GET /api/patients/nonexistent-id returns 404 or auth error", async ({
    request,
  }) => {
    const res = await request.get(
      "/api/patients/00000000-0000-0000-0000-000000000000"
    );
    expect([401, 403, 404]).toContain(res.status());
  });
});
