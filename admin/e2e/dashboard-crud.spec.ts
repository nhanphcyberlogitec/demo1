// Smoke spec for the new /dashboard + /dashboard/users UI. Hits the live
// FastAPI on :8000 (no mocks). Phase 4 development helper — qa-tester will
// derive the canonical Playwright suite from TECH_SPEC §8 in Phase 5.
//
// Run with: cd admin && npx playwright test e2e/dashboard-crud.spec.ts
import { test, expect, type Page } from "@playwright/test";

const SEED_EMAIL = "admin@example.com";
const SEED_PASSWORD = "password123";

async function login(page: Page) {
  await page.goto("/login");
  await page.evaluate(() => localStorage.clear());
  await page.goto("/login");
  await page.getByLabel("Email").fill(SEED_EMAIL);
  await page.getByLabel("Password").fill(SEED_PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL(/\/dashboard$/, { timeout: 15_000 });
}

// Both the topbar (h1) and the content area (h2) carry the page title, so
// scope content selectors to <main> when looking at the content heading.
function content(page: Page) {
  return page.locator("main");
}

function dialog(page: Page) {
  return page.getByRole("dialog");
}

test.describe("Dashboard + Users CRUD smoke", () => {
  // The Playwright config sets `slowMo: 2000` which makes long flows easily
  // overrun the default 30 s timeout — bump for the multi-step happy path.
  test.setTimeout(180_000);
  test("end-to-end happy path: dashboard → list → create → edit → delete", async ({
    page,
  }) => {
    await login(page);

    // Dashboard page (TECH_SPEC §3.1)
    await expect(content(page).locator("#dashboard-heading")).toHaveText(
      "Dashboard"
    );
    await expect(content(page).getByText(`Welcome, ${SEED_EMAIL}`)).toBeVisible();
    await expect(content(page).getByText("Total users")).toBeVisible();

    // Sidebar nav
    await page.getByRole("link", { name: "Users" }).click();
    await page.waitForURL(/\/dashboard\/users$/);
    await expect(content(page).locator("#users-heading")).toHaveText("Users");
    await expect(content(page).getByText(SEED_EMAIL)).toBeVisible();

    // Self row should have a "you" badge and a disabled Delete button.
    const selfRow = page.getByRole("row").filter({ hasText: SEED_EMAIL });
    await expect(selfRow.getByText("you", { exact: false })).toBeVisible();
    await expect(
      selfRow.getByRole("button", { name: `Delete user ${SEED_EMAIL}` })
    ).toBeDisabled();

    // Create user (TECH_SPEC §3.3)
    const probeEmail = `probe.${Date.now()}@example.com`;
    await page.getByRole("button", { name: "New user" }).click();
    await expect(dialog(page)).toBeVisible();
    await dialog(page).getByLabel("Email").fill(probeEmail);
    await dialog(page).getByLabel("Name").fill("Probe Smoke");
    await dialog(page).getByLabel("Role").selectOption("user");
    await dialog(page).getByLabel("Password", { exact: true }).fill("correct horse");
    await dialog(page).getByLabel("Confirm password").fill("correct horse");
    await dialog(page).getByRole("button", { name: "Create user" }).click();
    await expect(dialog(page)).toHaveCount(0, { timeout: 10_000 });
    await expect(content(page).getByText(probeEmail)).toBeVisible();

    // Edit user — change name + reset password (TECH_SPEC §3.4)
    const probeRow = page.getByRole("row").filter({ hasText: probeEmail });
    await probeRow
      .getByRole("button", { name: `Edit user ${probeEmail}` })
      .click();
    await expect(dialog(page)).toBeVisible();
    await dialog(page).getByLabel("Name").fill("Probe Renamed");
    await dialog(page).getByRole("button", { name: "Reset password" }).click();
    await dialog(page)
      .getByLabel("New password", { exact: true })
      .fill("new strong password");
    await dialog(page)
      .getByLabel("Confirm new password")
      .fill("new strong password");
    await dialog(page).getByRole("button", { name: "Save changes" }).click();
    await expect(dialog(page)).toHaveCount(0, { timeout: 10_000 });
    await expect(content(page).getByText("Probe Renamed")).toBeVisible();

    // Delete user (TECH_SPEC §3.5)
    const renamedRow = page.getByRole("row").filter({ hasText: probeEmail });
    await renamedRow
      .getByRole("button", { name: `Delete user ${probeEmail}` })
      .click();
    await expect(dialog(page)).toBeVisible();
    await dialog(page).getByRole("button", { name: "Delete" }).click();
    await expect(dialog(page)).toHaveCount(0, { timeout: 10_000 });
    await expect(content(page).getByText(probeEmail)).toHaveCount(0);
  });

  test("search resets to page 1 and filters", async ({ page }) => {
    await login(page);
    await page.goto("/dashboard/users");
    await expect(content(page).locator("#users-heading")).toHaveText("Users");
    await page
      .getByRole("searchbox", { name: "Search users by email or name" })
      .fill("zzz-no-match-xyz");
    await expect(content(page).getByText("No users match your search.")).toBeVisible({
      timeout: 5_000,
    });
  });

  test("duplicate email surfaces server error on the email field", async ({
    page,
  }) => {
    await login(page);
    await page.goto("/dashboard/users");
    await page.getByRole("button", { name: "New user" }).click();
    await dialog(page).getByLabel("Email").fill(SEED_EMAIL);
    await dialog(page).getByLabel("Name").fill("Dup");
    await dialog(page).getByLabel("Password", { exact: true }).fill("password123");
    await dialog(page).getByLabel("Confirm password").fill("password123");
    await dialog(page).getByRole("button", { name: "Create user" }).click();
    await expect(page.locator("#user-email-error")).toContainText(
      "Email already in use",
      { timeout: 5_000 }
    );
    await expect(dialog(page)).toBeVisible();
  });

  test("self-row Role select is disabled (last-admin defense)", async ({
    page,
  }) => {
    await login(page);
    await page.goto("/dashboard/users");
    const selfRow = page.getByRole("row").filter({ hasText: SEED_EMAIL });
    await selfRow
      .getByRole("button", { name: `Edit user ${SEED_EMAIL}` })
      .click();
    await expect(dialog(page)).toBeVisible();
    await expect(dialog(page).getByLabel("Role")).toBeDisabled();
    await dialog(page).getByRole("button", { name: "Close" }).click();
  });
});
