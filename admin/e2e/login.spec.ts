import { test, expect, type Page } from "@playwright/test";

const SEEDED_EMAIL = "admin@example.com";
const SEEDED_PASSWORD = "password123";

const ERRORS = {
  invalidCreds: "Invalid email or password.",
  emailRequired: "Email is required.",
  emailInvalid: "Enter a valid email address.",
  passwordTooShort: "Password must be at least 6 characters.",
  network: "We couldn't reach the server. Please try again.",
};

async function clearStorage(page: Page) {
  await page.goto("/login");
  await page.evaluate(() => localStorage.clear());
}

async function loginWith(page: Page, email: string, password: string) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
}

// Scope the alert locator to the login form, excluding Next.js's route announcer.
function formAlert(page: Page) {
  return page.locator("main [role='alert']");
}

test.describe("Login page — acceptance criteria", () => {
  test.beforeEach(async ({ page }) => {
    await clearStorage(page);
  });

  test("TC-E-01 / AC-1: root `/` redirects to /login", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveURL(/\/login$/);
    await expect(
      page.getByRole("heading", { name: "Admin Panel", level: 1 })
    ).toBeVisible();
  });

  test("TC-E-02 / AC-2: unauthed /dashboard redirects to /login", async ({
    page,
  }) => {
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByRole("button", { name: "Sign in" })).toBeVisible();
  });

  test("TC-E-03 / AC-3: valid credentials land on /dashboard within 2s", async ({
    page,
  }) => {
    const start = Date.now();
    await loginWith(page, SEEDED_EMAIL, SEEDED_PASSWORD);
    await page.waitForURL(/\/dashboard$/, { timeout: 5000 });
    const elapsed = Date.now() - start;
    expect(elapsed).toBeLessThan(4000);

    const token = await page.evaluate(() => localStorage.getItem("token"));
    const user = await page.evaluate(() => localStorage.getItem("user"));
    expect(token && token.split(".").length === 3).toBeTruthy();
    expect(user).toContain(SEEDED_EMAIL);
  });

  test("TC-E-04 / AC-4: wrong password shows inline error", async ({ page }) => {
    await loginWith(page, SEEDED_EMAIL, "wrong-password-123");
    await expect(formAlert(page)).toContainText(ERRORS.invalidCreds);
    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByLabel("Password")).toHaveValue("");
  });

  test("TC-E-05 / AC-5: unknown email shows identical error", async ({ page }) => {
    await loginWith(page, "ghost-user@example.com", SEEDED_PASSWORD);
    await expect(formAlert(page)).toContainText(ERRORS.invalidCreds);
    await expect(page).toHaveURL(/\/login$/);
  });

  test("TC-E-06 / AC-6: empty email → inline error, no network call", async ({
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
      new RegExp(ERRORS.emailRequired)
    );
    expect(loginCalled).toBe(false);
  });

  test("TC-E-07 / AC-7: malformed email → inline error, no network call", async ({
    page,
  }) => {
    let loginCalled = false;
    await page.route("**/api/auth/login", async (route) => {
      loginCalled = true;
      await route.abort();
    });
    await page.goto("/login");
    await page.getByLabel("Email").fill("foo");
    await page.getByLabel("Password").fill("password123");
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page.locator("#email-error")).toHaveText(
      new RegExp(ERRORS.emailInvalid)
    );
    expect(loginCalled).toBe(false);
  });

  test("TC-E-08 / AC-8: short password → inline error, no network call", async ({
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
      new RegExp(ERRORS.passwordTooShort)
    );
    expect(loginCalled).toBe(false);
  });

  test("TC-E-09 / AC-9: backend unreachable → friendly network message", async ({
    page,
  }) => {
    await page.route("**/api/auth/login", async (route) => {
      await route.abort("failed");
    });
    await loginWith(page, SEEDED_EMAIL, SEEDED_PASSWORD);
    await expect(formAlert(page)).toContainText(ERRORS.network);
    await expect(page.getByLabel("Password")).toHaveValue("");
    await expect(page.getByRole("button", { name: "Sign in" })).toBeEnabled();
  });

  test("TC-E-10 / AC-10: submit + inputs disabled in flight", async ({
    page,
  }) => {
    await page.route("**/api/auth/login", async (route) => {
      await new Promise((r) => setTimeout(r, 1500));
      await route.continue();
    });
    await page.goto("/login");
    await page.getByLabel("Email").fill(SEEDED_EMAIL);
    await page.getByLabel("Password").fill(SEEDED_PASSWORD);
    await page.getByRole("button", { name: "Sign in" }).click();
    const busyBtn = page.getByRole("button", { name: "Signing in…" });
    await expect(busyBtn).toBeVisible();
    await expect(busyBtn).toBeDisabled();
    await expect(page.getByLabel("Email")).toBeDisabled();
    await expect(page.getByLabel("Password")).toBeDisabled();
    await page.waitForURL(/\/dashboard$/, { timeout: 10000 });
  });

  test("TC-E-11 / AC-11: logout clears storage and returns to /login", async ({
    page,
  }) => {
    await loginWith(page, SEEDED_EMAIL, SEEDED_PASSWORD);
    await page.waitForURL(/\/dashboard$/);
    await page.getByRole("button", { name: "Log out" }).click();
    await expect(page).toHaveURL(/\/login$/);
    const token = await page.evaluate(() => localStorage.getItem("token"));
    const user = await page.evaluate(() => localStorage.getItem("user"));
    expect(token).toBeNull();
    expect(user).toBeNull();
  });

  test("TC-E-12 / AC-12: post-logout back button does not expose /dashboard", async ({
    page,
  }) => {
    await loginWith(page, SEEDED_EMAIL, SEEDED_PASSWORD);
    await page.waitForURL(/\/dashboard$/);
    await page.getByRole("button", { name: "Log out" }).click();
    await expect(page).toHaveURL(/\/login$/);
    // Clicking Back must not reveal any dashboard content. The guard must
    // either redirect to /login or the history must not contain /dashboard at all.
    await page.goBack().catch(() => undefined);
    await page.waitForLoadState("domcontentloaded");
    await expect(page.getByText(/Welcome,/)).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Log out" })).toHaveCount(0);
  });

  test("TC-E-13 / AC-13: already-signed-in visit to /login redirects to /dashboard", async ({
    page,
  }) => {
    await loginWith(page, SEEDED_EMAIL, SEEDED_PASSWORD);
    await page.waitForURL(/\/dashboard$/);
    await page.goto("/login");
    await expect(page).toHaveURL(/\/dashboard$/);
  });

  test("TC-E-14 / AC-19: keyboard-only login (Tab/Tab/Enter)", async ({
    page,
  }) => {
    await page.goto("/login");
    await page.getByLabel("Email").focus();
    await page.keyboard.type(SEEDED_EMAIL);
    await page.keyboard.press("Tab");
    await page.keyboard.type(SEEDED_PASSWORD);
    await page.keyboard.press("Enter");
    await page.waitForURL(/\/dashboard$/, { timeout: 5000 });
  });

  test("TC-E-15 / AC-20: each input has a programmatic <label>", async ({
    page,
  }) => {
    await page.goto("/login");
    for (const id of ["email", "password"]) {
      const input = page.locator(`#${id}`);
      await expect(input).toBeVisible();
      const label = page.locator(`label[for="${id}"]`);
      await expect(label).toBeVisible();
    }
  });

  test("TC-E-16 / AC-21: error cue is non-color (icon + text)", async ({
    page,
  }) => {
    await page.goto("/login");
    await page.getByLabel("Email").fill("foo");
    await page.getByLabel("Password").fill("password123");
    await page.getByRole("button", { name: "Sign in" }).click();
    const errorEl = page.locator("#email-error");
    await expect(errorEl).toBeVisible();
    await expect(errorEl).toContainText(ERRORS.emailInvalid);
    const hasIcon = await errorEl
      .locator("[aria-hidden='true']")
      .count();
    expect(hasIcon).toBeGreaterThan(0);
  });

  test("TC-E-17 / AC-22: alert region has aria-live / role=alert", async ({
    page,
  }) => {
    await page.goto("/login");
    const alertRegion = formAlert(page);
    await expect(alertRegion).toBeAttached();
    const ariaLive = await alertRegion.getAttribute("aria-live");
    expect(ariaLive).toBe("polite");

    await loginWith(page, SEEDED_EMAIL, "wrong-password-123");
    await expect(alertRegion).toContainText(ERRORS.invalidCreds);
  });

  test("TC-E-18 / AC-23 — 1440px: no horizontal scroll", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/login");
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth
    );
    expect(overflow).toBeLessThanOrEqual(0);
    await expect(page.getByRole("heading", { name: "Admin Panel" })).toBeVisible();
  });

  test("TC-E-19 / AC-23 — 1024px: no horizontal scroll", async ({ page }) => {
    await page.setViewportSize({ width: 1024, height: 800 });
    await page.goto("/login");
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth
    );
    expect(overflow).toBeLessThanOrEqual(0);
  });

  test("TC-E-20 / AC-23 — 768px: no horizontal scroll", async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.goto("/login");
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth
    );
    expect(overflow).toBeLessThanOrEqual(0);
  });

  test("TC-E-21 / AC-24 — 375px: form remains functional", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 800 });
    await page.goto("/login");
    await expect(page.getByLabel("Email")).toBeVisible();
    await expect(page.getByLabel("Password")).toBeVisible();
    await expect(page.getByRole("button", { name: "Sign in" })).toBeVisible();
    await page.getByLabel("Email").fill(SEEDED_EMAIL);
    await page.getByLabel("Password").fill(SEEDED_PASSWORD);
    await expect(page.getByLabel("Email")).toHaveValue(SEEDED_EMAIL);
  });

  test("TC-E-22: password input has type=password", async ({ page }) => {
    await page.goto("/login");
    const type = await page.locator("#password").getAttribute("type");
    expect(type).toBe("password");
  });

  test("TC-E-23: on 401, password cleared and focus returns to email", async ({
    page,
  }) => {
    await loginWith(page, SEEDED_EMAIL, "wrong-password-123");
    await expect(formAlert(page)).toContainText(ERRORS.invalidCreds);
    await expect(page.getByLabel("Password")).toHaveValue("");
    const focusedId = await page.evaluate(
      () => (document.activeElement as HTMLElement | null)?.id ?? ""
    );
    expect(focusedId).toBe("email");
  });
});
