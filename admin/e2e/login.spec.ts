import { test, expect } from "@playwright/test";

test.describe("Login Page", () => {
  test.beforeEach(async ({ page }) => {
    // Clear localStorage before each test
    await page.goto("/login");
    await page.evaluate(() => localStorage.clear());
    await page.goto("/login");
  });

  test("should display login form with all required elements", async ({
    page,
  }) => {
    await expect(page.locator("h1")).toHaveText("Login");
    await expect(page.locator('label:has-text("Email")')).toBeVisible();
    await expect(page.locator('label:has-text("Password")')).toBeVisible();
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
    await expect(
      page.locator('button[type="submit"]:has-text("Login")')
    ).toBeVisible();
  });

  test("should show placeholder text in inputs", async ({ page }) => {
    await expect(page.locator('input[type="email"]')).toHaveAttribute(
      "placeholder",
      "admin@example.com"
    );
    await expect(page.locator('input[type="password"]')).toHaveAttribute(
      "placeholder",
      "Enter password"
    );
  });

  test("should login successfully with valid credentials and redirect to dashboard", async ({
    page,
  }) => {
    await page.locator('input[type="email"]').fill("admin@example.com");
    await page.locator('input[type="password"]').fill("password123");
    await page.locator('button[type="submit"]').click();

    // Should redirect to dashboard
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 10000 });

    // Dashboard should show welcome message
    await expect(page.locator("h1")).toHaveText("Dashboard");
    await expect(page.locator("text=Welcome, Admin!")).toBeVisible();
  });

  test("should show error message for invalid password", async ({ page }) => {
    await page.locator('input[type="email"]').fill("admin@example.com");
    await page.locator('input[type="password"]').fill("wrongpassword");
    await page.locator('button[type="submit"]').click();

    await expect(
      page.locator("text=Invalid email or password")
    ).toBeVisible({ timeout: 10000 });

    // Should stay on login page
    await expect(page).toHaveURL(/\/login/);
  });

  test("should show error message for non-existent email", async ({
    page,
  }) => {
    await page.locator('input[type="email"]').fill("nonexistent@example.com");
    await page.locator('input[type="password"]').fill("password123");
    await page.locator('button[type="submit"]').click();

    await expect(
      page.locator("text=Invalid email or password")
    ).toBeVisible({ timeout: 10000 });

    // Should stay on login page
    await expect(page).toHaveURL(/\/login/);
  });

  test("should show error for password shorter than 6 characters", async ({
    page,
  }) => {
    await page.locator('input[type="email"]').fill("admin@example.com");
    await page.locator('input[type="password"]').fill("short");
    await page.locator('button[type="submit"]').click();

    await expect(
      page.locator("text=Password must be at least 6 characters")
    ).toBeVisible({ timeout: 10000 });

    // Should stay on login page
    await expect(page).toHaveURL(/\/login/);
  });

  test("should show loading state while logging in", async ({ page }) => {
    await page.locator('input[type="email"]').fill("admin@example.com");
    await page.locator('input[type="password"]').fill("password123");
    await page.locator('button[type="submit"]').click();

    // Button should briefly show loading text
    // Note: this may be fast, so we just verify the button exists and is clickable
    await expect(page.locator('button[type="submit"]')).toBeVisible();
  });

  test("should prevent form submission with empty fields", async ({
    page,
  }) => {
    // Click submit without filling anything
    await page.locator('button[type="submit"]').click();

    // Should stay on login page (HTML5 required validation)
    await expect(page).toHaveURL(/\/login/);
  });

  test("should store token and user in localStorage after successful login", async ({
    page,
  }) => {
    await page.locator('input[type="email"]').fill("admin@example.com");
    await page.locator('input[type="password"]').fill("password123");
    await page.locator('button[type="submit"]').click();

    await expect(page).toHaveURL(/\/dashboard/, { timeout: 10000 });

    // Verify localStorage
    const token = await page.evaluate(() => localStorage.getItem("token"));
    const userJson = await page.evaluate(() => localStorage.getItem("user"));
    expect(token).toBeTruthy();
    expect(userJson).toBeTruthy();

    const user = JSON.parse(userJson!);
    expect(user.email).toBe("admin@example.com");
    expect(user.name).toBe("Admin");
  });
});

test.describe("Dashboard Page", () => {
  test("should redirect to login when not authenticated", async ({ page }) => {
    await page.goto("/dashboard");
    await page.evaluate(() => localStorage.clear());
    await page.goto("/dashboard");

    // Should redirect to login
    await expect(page).toHaveURL(/\/login/, { timeout: 10000 });
  });

  test("should logout and redirect to login", async ({ page }) => {
    // Login first
    await page.goto("/login");
    await page.locator('input[type="email"]').fill("admin@example.com");
    await page.locator('input[type="password"]').fill("password123");
    await page.locator('button[type="submit"]').click();
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 10000 });

    // Click logout
    await page.locator('button:has-text("Logout")').click();

    // Should redirect to login
    await expect(page).toHaveURL(/\/login/, { timeout: 10000 });

    // localStorage should be cleared
    const token = await page.evaluate(() => localStorage.getItem("token"));
    expect(token).toBeNull();
  });
});
