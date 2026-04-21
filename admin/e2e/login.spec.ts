import { test, expect, type Page } from "@playwright/test";

// Live seed row per DB_SCHEMA.md §4 and TECH_SPEC.md §7 AC-3.
const SEEDED_EMAIL = "admin@example.com";
const SEEDED_PASSWORD = "password123";

// Copy the frontend is expected to render (from admin/app/login/page.tsx and
// TECH_SPEC.md §2.2 / §5).
const UI = {
  invalidCreds: "Invalid email or password.",
  network: "We couldn't reach the server. Please try again.",
  emailRequired: "Email is required.",
  emailInvalid: "Enter a valid email address.",
  passwordTooShort: "Password must be at least 8 characters.",
};

async function clearStorage(page: Page) {
  // Visit the app origin once so localStorage is accessible for that origin.
  await page.goto("/login");
  await page.evaluate(() => localStorage.clear());
}

async function fillAndSubmit(page: Page, email: string, password: string) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
}

// Scope the form-level alert to <main>, ignoring Next.js's route announcer.
function formAlert(page: Page) {
  return page.locator("main [role='alert']");
}

test.describe("Login page — AC-1…AC-12 (TECH_SPEC §7)", () => {
  test.beforeEach(async ({ page }) => {
    await clearStorage(page);
  });

  // ---------------------------------------------------------------------------
  // E2E-01 / AC-1 — render form, autofocus on email
  // ---------------------------------------------------------------------------
  test("E2E-01 / AC-1: renders email + password + Sign in, autofocus on email", async ({
    page,
  }) => {
    await page.goto("/login");
    const email = page.locator("#email");
    const password = page.locator("#password");
    const submit = page.getByRole("button", { name: "Sign in" });

    await expect(email).toBeVisible();
    await expect(email).toHaveAttribute("type", "email");

    await expect(password).toBeVisible();
    await expect(password).toHaveAttribute("type", "password");

    await expect(submit).toBeVisible();

    const focusedId = await page.evaluate(
      () => (document.activeElement as HTMLElement | null)?.id ?? ""
    );
    expect(focusedId).toBe("email");
  });

  // ---------------------------------------------------------------------------
  // E2E-02 / AC-2 — root redirects to /login
  // ---------------------------------------------------------------------------
  test("E2E-02 / AC-2: `/` redirects to /login", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByRole("button", { name: "Sign in" })).toBeVisible();
  });

  // ---------------------------------------------------------------------------
  // E2E-03 / AC-3 — successful login lands on /dashboard with token + user
  // ---------------------------------------------------------------------------
  test("E2E-03 / AC-3: valid credentials land on /dashboard with token + user in storage", async ({
    page,
  }) => {
    await fillAndSubmit(page, SEEDED_EMAIL, SEEDED_PASSWORD);
    await page.waitForURL(/\/dashboard$/, { timeout: 10_000 });

    const token = await page.evaluate(() => localStorage.getItem("token"));
    const user = await page.evaluate(() => localStorage.getItem("user"));
    expect(token && token.split(".").length === 3).toBeTruthy();
    expect(user).toContain(SEEDED_EMAIL);

    await expect(page.getByText(`Welcome, ${SEEDED_EMAIL}`)).toBeVisible();
  });

  // ---------------------------------------------------------------------------
  // E2E-04 / AC-4 — wrong password → generic banner, password cleared, stays on /login
  // ---------------------------------------------------------------------------
  test("E2E-04 / AC-4: wrong password shows generic banner, clears password, stays on /login", async ({
    page,
  }) => {
    await fillAndSubmit(page, SEEDED_EMAIL, "wrong-password-123");
    await expect(formAlert(page)).toContainText(UI.invalidCreds);
    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByLabel("Password")).toHaveValue("");

    const token = await page.evaluate(() => localStorage.getItem("token"));
    const user = await page.evaluate(() => localStorage.getItem("user"));
    expect(token).toBeNull();
    expect(user).toBeNull();
  });

  // ---------------------------------------------------------------------------
  // E2E-05 / AC-4 (arm 2) — unknown email shows identical banner
  // ---------------------------------------------------------------------------
  test("E2E-05 / AC-4: unknown email shows the same generic banner", async ({
    page,
  }) => {
    await fillAndSubmit(page, "ghost-user@example.com", SEEDED_PASSWORD);
    await expect(formAlert(page)).toContainText(UI.invalidCreds);
    await expect(page).toHaveURL(/\/login$/);
  });

  // ---------------------------------------------------------------------------
  // E2E-06 / AC-5 — empty email → inline error, no network call
  // ---------------------------------------------------------------------------
  test("E2E-06 / AC-5: empty email blocks submit (inline error, no network call)", async ({
    page,
  }) => {
    let loginCalled = false;
    await page.route("**/api/auth/login", async (route) => {
      loginCalled = true;
      await route.abort();
    });

    await page.goto("/login");
    await page.getByLabel("Password").fill("password123");
    await page.getByRole("button", { name: "Sign in" }).click();

    await expect(page.locator("#email-error")).toHaveText(
      new RegExp(UI.emailRequired.replace(/\./g, "\\."))
    );
    expect(loginCalled).toBe(false);
  });

  // ---------------------------------------------------------------------------
  // E2E-07 / AC-5 — short password → inline error, no network call
  // ---------------------------------------------------------------------------
  test("E2E-07 / AC-5: short password blocks submit (inline error, no network call)", async ({
    page,
  }) => {
    let loginCalled = false;
    await page.route("**/api/auth/login", async (route) => {
      loginCalled = true;
      await route.abort();
    });

    await page.goto("/login");
    await page.getByLabel("Email").fill(SEEDED_EMAIL);
    await page.getByLabel("Password").fill("abc");
    await page.getByRole("button", { name: "Sign in" }).click();

    await expect(page.locator("#password-error")).toHaveText(
      new RegExp(UI.passwordTooShort.replace(/\./g, "\\."))
    );
    expect(loginCalled).toBe(false);
  });

  // ---------------------------------------------------------------------------
  // E2E-08 / AC-6 — 422 from server maps messages under each field
  // ---------------------------------------------------------------------------
  test("E2E-08 / AC-6: server 422 errors render beneath the matching fields", async ({
    page,
  }) => {
    await page.route("**/api/auth/login", async (route) => {
      await route.fulfill({
        status: 422,
        contentType: "application/json",
        body: JSON.stringify({
          success: false,
          data: {
            errors: {
              email: "Email is required",
              password: "Password must be at least 8 characters",
            },
          },
          message: "Validation failed",
        }),
      });
    });

    // Form-level values must pass client-side validation so the request
    // actually reaches the stubbed server.
    await fillAndSubmit(page, SEEDED_EMAIL, SEEDED_PASSWORD);
    await expect(page.locator("#email-error")).toContainText(
      "Email is required"
    );
    await expect(page.locator("#password-error")).toContainText(
      "Password must be at least 8 characters"
    );
  });

  // ---------------------------------------------------------------------------
  // E2E-09 / AC-7 — unauthed /dashboard redirects to /login
  // ---------------------------------------------------------------------------
  test("E2E-09 / AC-7: unauthenticated /dashboard redirects to /login without flashing content", async ({
    page,
  }) => {
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByText(/Welcome,/)).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Log out" })).toHaveCount(0);
  });

  // ---------------------------------------------------------------------------
  // E2E-10 / AC-8 — signed-in visit to /login bounces to /dashboard
  // ---------------------------------------------------------------------------
  test("E2E-10 / AC-8: signed-in visit to /login bounces to /dashboard", async ({
    page,
  }) => {
    await fillAndSubmit(page, SEEDED_EMAIL, SEEDED_PASSWORD);
    await page.waitForURL(/\/dashboard$/, { timeout: 10_000 });

    await page.goto("/login");
    await expect(page).toHaveURL(/\/dashboard$/);
    await expect(page.getByRole("button", { name: "Sign in" })).toHaveCount(0);
  });

  // ---------------------------------------------------------------------------
  // E2E-11 / AC-9 — logout clears storage and re-blocks /dashboard
  // ---------------------------------------------------------------------------
  test("E2E-11 / AC-9: logout clears storage and returns to /login; /dashboard stays gated", async ({
    page,
  }) => {
    await fillAndSubmit(page, SEEDED_EMAIL, SEEDED_PASSWORD);
    await page.waitForURL(/\/dashboard$/, { timeout: 10_000 });

    await page.getByRole("button", { name: "Log out" }).click();
    await expect(page).toHaveURL(/\/login$/);

    const token = await page.evaluate(() => localStorage.getItem("token"));
    const user = await page.evaluate(() => localStorage.getItem("user"));
    expect(token).toBeNull();
    expect(user).toBeNull();

    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/login$/);
  });

  // ---------------------------------------------------------------------------
  // E2E-12 / AC-10 — pending state
  // ---------------------------------------------------------------------------
  test("E2E-12 / AC-10: pending state disables submit + inputs and shows 'Signing in…'", async ({
    page,
  }) => {
    // Long enough to outlast Playwright slowMo (2000 ms per action) plus the
    // subsequent navigation, so the pending state is reliably observable.
    await page.route("**/api/auth/login", async (route) => {
      await new Promise((r) => setTimeout(r, 8000));
      await route.continue();
    });

    await page.goto("/login");
    await page.getByLabel("Email").fill(SEEDED_EMAIL);
    await page.getByLabel("Password").fill(SEEDED_PASSWORD);
    await page.getByRole("button", { name: "Sign in" }).click();

    const busyBtn = page.getByRole("button", { name: "Signing in…" });
    await expect(busyBtn).toBeVisible({ timeout: 5_000 });
    await expect(busyBtn).toBeDisabled();
    await expect(busyBtn).toHaveAttribute("aria-busy", "true");
    await expect(page.getByLabel("Email")).toBeDisabled();
    await expect(page.getByLabel("Password")).toBeDisabled();

    await page.waitForURL(/\/dashboard$/, { timeout: 20_000 });
  });

  // ---------------------------------------------------------------------------
  // E2E-13 / AC-11 — backend unreachable → friendly network banner
  // ---------------------------------------------------------------------------
  test("E2E-13 / AC-11: backend unreachable shows generic 'please try again' banner", async ({
    page,
  }) => {
    await page.route("**/api/auth/login", async (route) => {
      await route.abort("failed");
    });

    await fillAndSubmit(page, SEEDED_EMAIL, SEEDED_PASSWORD);
    await expect(formAlert(page)).toContainText(UI.network);
    await expect(page.getByRole("button", { name: "Sign in" })).toBeEnabled();

    // No stack trace or technical detail in the rendered page.
    const bodyText = await page.locator("main").innerText();
    expect(bodyText).not.toMatch(/at\s.+\.(ts|tsx|js|jsx):\d+/);
    expect(bodyText).not.toMatch(/Traceback/i);
    expect(bodyText).not.toMatch(/TypeError|Error:/);
  });

  // ---------------------------------------------------------------------------
  // E2E-14 / AC-12 — no plaintext password disclosure
  // ---------------------------------------------------------------------------
  test("E2E-14 / AC-12: password masked in DOM, not stored in localStorage, not echoed in response", async ({
    page,
  }) => {
    let responseBody = "";
    page.on("response", async (resp) => {
      if (resp.url().includes("/api/auth/login")) {
        try {
          responseBody = await resp.text();
        } catch {
          /* ignore */
        }
      }
    });

    await page.goto("/login");
    await page.getByLabel("Email").fill(SEEDED_EMAIL);
    await page.getByLabel("Password").fill(SEEDED_PASSWORD);

    // Password input must be masked (type=password).
    await expect(page.locator("#password")).toHaveAttribute("type", "password");

    await page.getByRole("button", { name: "Sign in" }).click();
    await page.waitForURL(/\/dashboard$/, { timeout: 10_000 });

    // localStorage must not contain the plaintext password.
    const storageDump = await page.evaluate(() => {
      const dump: Record<string, string | null> = {};
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k) dump[k] = localStorage.getItem(k);
      }
      return JSON.stringify(dump);
    });
    expect(storageDump).not.toContain(SEEDED_PASSWORD);

    // Response must not echo the plaintext password.
    expect(responseBody).not.toContain(SEEDED_PASSWORD);
    expect(responseBody).not.toContain("password_hash");
    expect(responseBody).not.toContain("$2b$");
  });
});
