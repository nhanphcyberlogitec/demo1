import { test, expect, Page } from "@playwright/test";

const API_BASE = "http://localhost:8000";
const ADMIN_EMAIL = "admin@example.com";
const ADMIN_PASSWORD = "password123";

// ---------- helpers ----------

async function login(page: Page) {
  await page.goto("/login");
  await page.evaluate(() => localStorage.clear());
  await page.goto("/login");
  await page.locator('input[type="email"]').fill(ADMIN_EMAIL);
  await page.locator('input[type="password"]').fill(ADMIN_PASSWORD);
  await page.locator('button[type="submit"]').click();
  await expect(page).toHaveURL(/\/dashboard/, { timeout: 10000 });
}

async function apiLogin(): Promise<string> {
  const res = await fetch(`${API_BASE}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD }),
  });
  const body = await res.json();
  return body.data.token as string;
}

async function createUserViaApi(
  token: string,
  overrides: Partial<{
    name: string;
    email: string;
    password: string;
    is_active: boolean;
  }> = {}
) {
  const email =
    overrides.email ??
    `e2e-${Date.now()}-${Math.floor(Math.random() * 10000)}@example.com`;
  const res = await fetch(`${API_BASE}/api/accounts`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      name: overrides.name ?? "E2E User",
      email,
      password: overrides.password ?? "Valid1234",
      is_active: overrides.is_active ?? true,
    }),
  });
  const body = await res.json();
  return body.data as {
    id: string;
    email: string;
    name: string;
    is_active: boolean;
  };
}

async function deleteUserViaApi(token: string, id: string) {
  // no hard delete endpoint — best-effort: nothing to do. Keep around.
  // (backend has no DELETE by design; tests can tolerate leftover rows.)
}

async function findAdminId(token: string): Promise<string> {
  const res = await fetch(
    `${API_BASE}/api/accounts?q=${encodeURIComponent(ADMIN_EMAIL)}`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  const body = await res.json();
  const match = body.data.items.find((u: any) => u.email === ADMIN_EMAIL);
  return match.id as string;
}

// ---------- tests ----------

test.describe("Accounts — list page", () => {
  test("renders header, toolbar, and columns", async ({ page }) => {
    await login(page);
    await page.goto("/accounts");

    await expect(page.locator("h2", { hasText: "Accounts" })).toBeVisible();
    await expect(
      page.locator('a:has-text("+ New account")')
    ).toBeVisible();
    await expect(
      page.locator('input[placeholder="Search by name or email"]')
    ).toBeVisible();
    await expect(page.locator('select[aria-label="Filter by status"]')).toBeVisible();

    for (const h of ["Name", "Email", "Status", "Created", "Actions"]) {
      await expect(
        page.locator("thead th", { hasText: new RegExp(`^${h}$`) })
      ).toBeVisible();
    }
    // admin row shows up
    await expect(
      page.locator("tbody td", { hasText: ADMIN_EMAIL })
    ).toBeVisible();
  });

  test("search filters rows by email substring (debounced)", async ({ page }) => {
    const token = await apiLogin();
    const u = await createUserViaApi(token, {
      name: "Search Target",
      email: `srch-${Date.now()}@example.com`,
    });

    await login(page);
    await page.goto("/accounts");

    await page
      .locator('input[placeholder="Search by name or email"]')
      .fill(u.email.slice(0, 10));
    // debounce 300ms
    await expect(
      page.locator("tbody td", { hasText: u.email })
    ).toBeVisible({ timeout: 3000 });
    // admin shouldn't appear for this narrow query
    await expect(
      page.locator("tbody td", { hasText: ADMIN_EMAIL })
    ).toHaveCount(0);
  });

  test("status filter narrows to Active/Inactive", async ({ page }) => {
    const token = await apiLogin();
    const inactive = await createUserViaApi(token, { is_active: false });

    await login(page);
    await page.goto("/accounts");

    await page.locator('select[aria-label="Filter by status"]').selectOption("inactive");
    await expect(
      page.locator("tbody td", { hasText: inactive.email })
    ).toBeVisible({ timeout: 3000 });
    // active admin is not in inactive list
    await expect(
      page.locator("tbody td", { hasText: ADMIN_EMAIL })
    ).toHaveCount(0);
  });

  test("shows empty state for a no-match search", async ({ page }) => {
    await login(page);
    await page.goto("/accounts");

    await page
      .locator('input[placeholder="Search by name or email"]')
      .fill("zzzzzzzz-no-such-user-zzzzzzzz");
    await expect(
      page.locator("text=No accounts match your filters.")
    ).toBeVisible({ timeout: 3000 });
  });

  test("redirects to /login when no token present", async ({ page }) => {
    await page.goto("/login");
    await page.evaluate(() => localStorage.clear());
    await page.goto("/accounts");
    await expect(page).toHaveURL(/\/login/, { timeout: 10000 });
  });
});

test.describe("Accounts — detail & edit", () => {
  test("edits name and shows success toast", async ({ page }) => {
    const token = await apiLogin();
    const u = await createUserViaApi(token, { name: "Edit Me" });

    await login(page);
    await page.goto(`/accounts/${u.id}`);

    const nameInput = page.locator("#name");
    await expect(nameInput).toHaveValue("Edit Me");

    await nameInput.fill("Edited Name");
    await page.locator('button[type="submit"]:has-text("Save")').click();

    await expect(page.locator("text=Changes saved")).toBeVisible({
      timeout: 5000,
    });
    await expect(nameInput).toHaveValue("Edited Name");
  });

  test("duplicate email surfaces field error", async ({ page }) => {
    const token = await apiLogin();
    const a = await createUserViaApi(token);
    const b = await createUserViaApi(token);

    await login(page);
    await page.goto(`/accounts/${b.id}`);
    await page.locator("#email").fill(a.email);
    await page.locator('button[type="submit"]:has-text("Save")').click();

    await expect(
      page.locator("#email-error, p.text-sm.text-\\[\\#dc2626\\]").filter({
        hasText: /already exists/i,
      })
    ).toBeVisible({ timeout: 5000 });
  });

  test("Cancel reverts edits to last saved", async ({ page }) => {
    const token = await apiLogin();
    const u = await createUserViaApi(token, { name: "Stable Name" });

    await login(page);
    await page.goto(`/accounts/${u.id}`);
    await page.locator("#name").fill("Dirty Name");
    await page.locator('button:has-text("Cancel")').click();
    await expect(page.locator("#name")).toHaveValue("Stable Name");
  });

  test("deactivate shows confirm dialog; confirming updates status", async ({
    page,
  }) => {
    const token = await apiLogin();
    const u = await createUserViaApi(token, { is_active: true });

    await login(page);
    await page.goto(`/accounts/${u.id}`);

    await page.locator('button:has-text("Deactivate")').click();

    const dialog = page.locator('[role="dialog"]');
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText("Deactivate account?");
    await expect(dialog).toContainText(u.email);

    await dialog.locator('button:has-text("Confirm deactivation")').click();

    await expect(page.locator("text=Account deactivated")).toBeVisible({
      timeout: 5000,
    });
    await expect(page.locator('button:has-text("Activate")')).toBeVisible();
    await expect(
      page.locator("header + main span", { hasText: "Inactive" }).first()
    ).toBeVisible();
  });

  test("Cancel on confirm dialog aborts the action", async ({ page }) => {
    const token = await apiLogin();
    const u = await createUserViaApi(token, { is_active: true });

    await login(page);
    await page.goto(`/accounts/${u.id}`);
    await page.locator('button:has-text("Deactivate")').click();
    const dialog = page.locator('[role="dialog"]');
    await expect(dialog).toBeVisible();
    await dialog.locator('button:has-text("Cancel")').click();
    await expect(dialog).toHaveCount(0);
    // Still shows Deactivate button (still active)
    await expect(page.locator('button:has-text("Deactivate")')).toBeVisible();
  });

  test("self-deactivate button disabled on own account", async ({ page }) => {
    const token = await apiLogin();
    const adminId = await findAdminId(token);

    await login(page);
    await page.goto(`/accounts/${adminId}`);

    const btn = page.locator('button:has-text("Deactivate")');
    await expect(btn).toBeVisible();
    await expect(btn).toBeDisabled();
    await expect(btn).toHaveAttribute(
      "title",
      /cannot deactivate your own account/i
    );
  });

  test("invalid email format blocks submit", async ({ page }) => {
    const token = await apiLogin();
    const u = await createUserViaApi(token);

    await login(page);
    await page.goto(`/accounts/${u.id}`);
    await page.locator("#email").fill("not-an-email");
    await page.locator('button[type="submit"]:has-text("Save")').click();

    await expect(
      page.locator("p", { hasText: /valid email/i })
    ).toBeVisible();
  });
});

test.describe("Accounts — create", () => {
  test("creates account, toast + new row visible", async ({ page }) => {
    await login(page);
    await page.goto("/accounts/new");
    const email = `new-${Date.now()}@example.com`;

    await page.locator("#name").fill("Freshly Created");
    await page.locator("#email").fill(email);
    await page.locator("#password").fill("Valid1234");
    await page.locator("#confirm").fill("Valid1234");
    await page.locator('button[type="submit"]:has-text("Create")').click();

    await expect(page).toHaveURL(/\/accounts(\?|$)/, { timeout: 10000 });
    await expect(page.locator("text=Account created")).toBeVisible({
      timeout: 5000,
    });
    // New row should appear after reload/render
    await page
      .locator('input[placeholder="Search by name or email"]')
      .fill(email);
    await expect(
      page.locator("tbody td", { hasText: email })
    ).toBeVisible({ timeout: 3000 });
  });

  test("duplicate email surfaces inline error", async ({ page }) => {
    const token = await apiLogin();
    const u = await createUserViaApi(token);

    await login(page);
    await page.goto("/accounts/new");
    await page.locator("#name").fill("Dup");
    await page.locator("#email").fill(u.email);
    await page.locator("#password").fill("Valid1234");
    await page.locator("#confirm").fill("Valid1234");
    await page.locator('button[type="submit"]:has-text("Create")').click();

    await expect(
      page.locator("p", { hasText: /already exists/i })
    ).toBeVisible({ timeout: 5000 });
    await expect(page).toHaveURL(/\/accounts\/new/);
  });

  test("confirm-password mismatch blocks client-side", async ({ page }) => {
    await login(page);
    await page.goto("/accounts/new");
    await page.locator("#name").fill("Mismatch");
    await page.locator("#email").fill(`mm-${Date.now()}@example.com`);
    await page.locator("#password").fill("Valid1234");
    await page.locator("#confirm").fill("Different1");
    await page.locator('button[type="submit"]:has-text("Create")').click();

    await expect(
      page.locator("p", { hasText: /Passwords do not match/i })
    ).toBeVisible();
    await expect(page).toHaveURL(/\/accounts\/new/);
  });

  test("short password blocks client-side", async ({ page }) => {
    await login(page);
    await page.goto("/accounts/new");
    await page.locator("#name").fill("Short");
    await page.locator("#email").fill(`short-${Date.now()}@example.com`);
    await page.locator("#password").fill("abc1");
    await page.locator("#confirm").fill("abc1");
    await page.locator('button[type="submit"]:has-text("Create")').click();

    await expect(
      page.locator("p", { hasText: /at least 8 characters/i })
    ).toBeVisible();
  });
});

test.describe("Accounts — auth redirects", () => {
  test("/accounts/[id] redirects to /login without token", async ({ page }) => {
    await page.goto("/login");
    await page.evaluate(() => localStorage.clear());
    await page.goto("/accounts/00000000-0000-0000-0000-000000000000");
    await expect(page).toHaveURL(/\/login/, { timeout: 10000 });
  });

  test("/accounts/new redirects to /login without token", async ({ page }) => {
    await page.goto("/login");
    await page.evaluate(() => localStorage.clear());
    await page.goto("/accounts/new");
    await expect(page).toHaveURL(/\/login/, { timeout: 10000 });
  });
});
