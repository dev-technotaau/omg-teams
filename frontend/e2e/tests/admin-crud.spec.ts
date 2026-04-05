import { test, expect } from "../fixtures/auth";

/**
 * Admin CRUD page tests.
 *
 * Verifies that all major admin pages load correctly and render
 * their primary UI elements. Uses the pre-authenticated admin
 * page fixture.
 */

test.describe("Admin CRUD Pages", () => {
  test("Users page loads with table and controls", async ({ adminPage }) => {
    await adminPage.goto("/admin/users");
    await adminPage.waitForLoadState("networkidle");

    // Page heading
    await expect(
      adminPage.getByRole("heading", { name: /User Management/i })
    ).toBeVisible();

    // Search input should be present
    await expect(
      adminPage.getByPlaceholder(/search/i)
    ).toBeVisible();

    // Table or loading skeleton should be present
    const table = adminPage.locator("table");
    const skeleton = adminPage.locator('[class*="animate-pulse"]');
    await expect(table.or(skeleton).first()).toBeVisible();
  });

  test("Holidays page loads with calendar view", async ({ adminPage }) => {
    await adminPage.goto("/admin/holidays");
    await adminPage.waitForLoadState("networkidle");

    // The page has month/calendar related UI
    // Check for day labels (Mon, Tue, etc.)
    await expect(adminPage.getByText("Sun")).toBeVisible();
    await expect(adminPage.getByText("Mon")).toBeVisible();
    await expect(adminPage.getByText("Tue")).toBeVisible();

    // Holiday type legend should be present
    await expect(adminPage.getByText("NATIONAL").first()).toBeVisible();
  });

  test("Settings page loads with category sections", async ({ adminPage }) => {
    await adminPage.goto("/admin/settings");
    await adminPage.waitForLoadState("networkidle");

    // Category tabs or section headings
    await expect(adminPage.getByText("General")).toBeVisible();
    await expect(adminPage.getByText("Session & Security")).toBeVisible();
    await expect(adminPage.getByText("Attendance")).toBeVisible();
    await expect(adminPage.getByText("Leave")).toBeVisible();
    await expect(adminPage.getByText("Reports")).toBeVisible();
  });

  test("Analytics page loads with charts area", async ({ adminPage }) => {
    await adminPage.goto("/admin/analytics");
    await adminPage.waitForLoadState("networkidle");

    // Period selector should be present
    await expect(adminPage.getByText("This Month")).toBeVisible();

    // Chart area containers or loading skeletons
    const chartContainers = adminPage.locator(".recharts-responsive-container");
    const skeletons = adminPage.locator('[class*="animate-pulse"]');

    // Either charts rendered or skeletons are showing
    await expect(
      chartContainers.first().or(skeletons.first())
    ).toBeVisible({ timeout: 15_000 });
  });

  test("Audit Log page loads with table and filters", async ({ adminPage }) => {
    await adminPage.goto("/admin/audit-log");
    await adminPage.waitForLoadState("networkidle");

    // Page heading
    await expect(
      adminPage.getByRole("heading", { name: /Audit Log/i })
    ).toBeVisible();

    // Search / filter controls
    await expect(
      adminPage.getByPlaceholder(/search/i)
    ).toBeVisible();

    // Table or empty state or loading
    const table = adminPage.locator("table");
    const emptyState = adminPage.getByText(/no.*audit/i);
    const skeleton = adminPage.locator('[class*="animate-pulse"]');
    await expect(
      table.or(emptyState).or(skeleton).first()
    ).toBeVisible();
  });

  test("Master Data page loads with dropdown management UI", async ({ adminPage }) => {
    await adminPage.goto("/admin/master-data");
    await adminPage.waitForLoadState("networkidle");

    // Category selector — first category is "State"
    await expect(adminPage.getByText("State")).toBeVisible();
    await expect(adminPage.getByText("Location")).toBeVisible();
    await expect(adminPage.getByText("Profile")).toBeVisible();

    // Zone filter tabs
    await expect(adminPage.getByText("All").first()).toBeVisible();
    await expect(adminPage.getByText("Set A").first()).toBeVisible();
    await expect(adminPage.getByText("Set B").first()).toBeVisible();
  });

  test("Import page loads with wizard step 1", async ({ adminPage }) => {
    await adminPage.goto("/admin/import");
    await adminPage.waitForLoadState("networkidle");

    // Wizard step indicator — step 1 is "Upload File"
    await expect(adminPage.getByText("Upload File")).toBeVisible();

    // Upload area should show a drop zone or file input
    const dropZone = adminPage.getByText(/drag|drop|upload|csv|xlsx/i).first();
    await expect(dropZone).toBeVisible();
  });

  test("Email Templates page loads with template list", async ({ adminPage }) => {
    await adminPage.goto("/admin/email-templates");
    await adminPage.waitForLoadState("networkidle");

    // Table/list of templates or loading/empty state
    const table = adminPage.locator("table");
    const emptyState = adminPage.getByText(/no.*template/i);
    const skeleton = adminPage.locator('[class*="animate-pulse"]');
    await expect(
      table.or(emptyState).or(skeleton).first()
    ).toBeVisible();
  });
});
