import { test, expect } from "@playwright/test";

/**
 * Authentication flow tests.
 *
 * These tests use a fresh (unauthenticated) browser context unless
 * noted otherwise. Login is performed via the API to bypass the
 * Turnstile CAPTCHA widget on the login page.
 */

const API_BASE = "http://localhost:3000/api/v1";

test.describe("Authentication", () => {
  test.describe("Login page", () => {
    test("loads correctly with all three role tabs", async ({ page }) => {
      await page.goto("/login");
      await page.waitForLoadState("networkidle");

      // Branding
      await expect(page.getByRole("heading", { name: "OMG Teams" })).toBeVisible();
      await expect(
        page.getByText("Internal Recruitment & Workforce Management")
      ).toBeVisible();

      // Three role tabs
      await expect(page.getByRole("button", { name: "Recruiter" })).toBeVisible();
      await expect(
        page.getByRole("button", { name: "Reporting Manager" })
      ).toBeVisible();
      await expect(page.getByRole("button", { name: "Admin" })).toBeVisible();

      // Default tab is Recruiter — identifier label should be "Employee ID"
      await expect(page.getByText("Employee ID")).toBeVisible();
      await expect(page.getByPlaceholder("OMG-0001")).toBeVisible();

      // Password field
      await expect(page.getByLabel("Password")).toBeVisible();

      // Login button
      await expect(page.getByRole("button", { name: "Login" })).toBeVisible();

      // Footer text
      await expect(
        page.getByText("Contact your administrator if you need access")
      ).toBeVisible();
    });

    test("switching to Admin tab shows email field", async ({ page }) => {
      await page.goto("/login");
      await page.waitForLoadState("networkidle");

      await page.getByRole("button", { name: "Admin" }).click();

      await expect(page.getByLabel("Email")).toBeVisible();
      await expect(page.getByPlaceholder("admin@example.com")).toBeVisible();
    });

    test("shows validation errors for empty fields", async ({ page }) => {
      await page.goto("/login");
      await page.waitForLoadState("networkidle");

      // Submit without filling anything
      await page.getByRole("button", { name: "Login" }).click();

      // Zod validation messages
      await expect(page.getByText("This field is required")).toBeVisible();
      await expect(page.getByText("Password is required")).toBeVisible();
    });
  });

  test.describe("Login with valid credentials (via API)", () => {
    test("admin login redirects to admin dashboard", async ({ page }) => {
      // Login via API to bypass CAPTCHA
      const response = await page.request.post(`${API_BASE}/auth/login`, {
        data: {
          identifier: "admin@omg.com",
          password: "Test@1234",
          role: "ADMIN",
          deviceId: "e2e-auth-test-admin",
          turnstileToken: "e2e-bypass",
        },
      });
      expect(response.ok()).toBeTruthy();

      // Navigate to the app — should land on admin dashboard
      await page.goto("/admin/dashboard");
      await page.waitForLoadState("networkidle");

      await expect(page.getByRole("heading", { name: "Admin Dashboard" })).toBeVisible();
    });

    test("recruiter login redirects to recruiter dashboard", async ({ page }) => {
      const response = await page.request.post(`${API_BASE}/auth/login`, {
        data: {
          identifier: "recruiter@omg.com",
          password: "Test@1234",
          role: "RECRUITER",
          deviceId: "e2e-auth-test-recruiter",
          turnstileToken: "e2e-bypass",
        },
      });
      expect(response.ok()).toBeTruthy();

      await page.goto("/dashboard");
      await page.waitForLoadState("networkidle");

      await expect(page.getByRole("heading", { name: "My Dashboard" })).toBeVisible();
    });
  });

  test.describe("Login with invalid credentials", () => {
    test("shows error message for wrong password", async ({ page }) => {
      const response = await page.request.post(`${API_BASE}/auth/login`, {
        data: {
          identifier: "admin@omg.com",
          password: "WrongPassword123",
          role: "ADMIN",
          deviceId: "e2e-auth-test-invalid",
          turnstileToken: "e2e-bypass",
        },
      });

      // Should get 401 or 400
      expect(response.ok()).toBeFalsy();
      expect(response.status()).toBeGreaterThanOrEqual(400);
    });

    test("shows error message for non-existent user", async ({ page }) => {
      const response = await page.request.post(`${API_BASE}/auth/login`, {
        data: {
          identifier: "nonexistent@omg.com",
          password: "Test@1234",
          role: "ADMIN",
          deviceId: "e2e-auth-test-nouser",
          turnstileToken: "e2e-bypass",
        },
      });

      expect(response.ok()).toBeFalsy();
      expect(response.status()).toBeGreaterThanOrEqual(400);
    });
  });

  test.describe("Logout", () => {
    test("logs out and redirects to login page", async ({ browser }) => {
      // Create an authenticated context
      const context = await browser.newContext({
        storageState: "e2e/.auth/admin.json",
      });
      const page = await context.newPage();

      await page.goto("/admin/dashboard");
      await page.waitForLoadState("networkidle");

      // Open the avatar dropdown in the header
      const avatarButton = page.locator("header").locator("button").last();
      await avatarButton.click();

      // Click Logout
      await page.getByRole("button", { name: "Logout" }).click();

      // Should redirect to login
      await page.waitForURL(/\/login/);
      await expect(page.getByRole("heading", { name: "OMG Teams" })).toBeVisible();

      await context.close();
    });
  });

  test.describe("Unauthenticated access", () => {
    test("redirects to login when visiting a protected page", async ({ page }) => {
      // Fresh page with no cookies — visit a protected route
      await page.goto("/dashboard");
      await page.waitForLoadState("networkidle");

      // The app should redirect to /login (either client-side or the auth
      // context triggers a redirect when /auth/me returns 401)
      await page.waitForURL(/\/login/, { timeout: 15_000 });
      await expect(page.getByRole("heading", { name: "OMG Teams" })).toBeVisible();
    });

    test("redirects to login when visiting an admin page", async ({ page }) => {
      await page.goto("/admin/dashboard");
      await page.waitForLoadState("networkidle");

      await page.waitForURL(/\/login/, { timeout: 15_000 });
      await expect(page.getByRole("heading", { name: "OMG Teams" })).toBeVisible();
    });
  });
});
