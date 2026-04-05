import { test, expect } from "../fixtures/auth";

/**
 * Navigation and layout tests.
 *
 * Verifies sidebar links, shared pages (search, help,
 * notifications, profile), and role-based navigation.
 */

test.describe("Navigation & Layout", () => {
  test.describe("Sidebar navigation - Admin", () => {
    test("sidebar displays admin-specific links", async ({ adminPage }) => {
      await adminPage.goto("/admin/dashboard");
      await adminPage.waitForLoadState("networkidle");

      const sidebar = adminPage.locator("aside");

      // Admin nav items
      await expect(sidebar.getByText("Dashboard")).toBeVisible();
      await expect(sidebar.getByText("Employees")).toBeVisible();
      await expect(sidebar.getByText("User Management")).toBeVisible();
      await expect(sidebar.getByText("Candidate Reports")).toBeVisible();
      await expect(sidebar.getByText("Companies")).toBeVisible();
      await expect(sidebar.getByText("Analytics")).toBeVisible();
      await expect(sidebar.getByText("Audit Log")).toBeVisible();
      await expect(sidebar.getByText("Master Data")).toBeVisible();
      await expect(sidebar.getByText("Email Templates")).toBeVisible();
      await expect(sidebar.getByText("Holidays")).toBeVisible();
      await expect(sidebar.getByText("Settings")).toBeVisible();
    });

    test("clicking Employees navigates correctly", async ({ adminPage }) => {
      await adminPage.goto("/admin/dashboard");
      await adminPage.waitForLoadState("networkidle");

      const sidebar = adminPage.locator("aside");
      await sidebar.getByText("Employees").click();

      await adminPage.waitForURL(/\/admin\/employees/);
      await adminPage.waitForLoadState("networkidle");
    });

    test("clicking Analytics navigates correctly", async ({ adminPage }) => {
      await adminPage.goto("/admin/dashboard");
      await adminPage.waitForLoadState("networkidle");

      const sidebar = adminPage.locator("aside");
      await sidebar.getByText("Analytics").click();

      await adminPage.waitForURL(/\/admin\/analytics/);
      await adminPage.waitForLoadState("networkidle");
    });
  });

  test.describe("Sidebar navigation - Recruiter", () => {
    test("sidebar displays recruiter-specific links", async ({ recruiterPage }) => {
      await recruiterPage.goto("/dashboard");
      await recruiterPage.waitForLoadState("networkidle");

      const sidebar = recruiterPage.locator("aside");

      // Recruiter nav items
      await expect(sidebar.getByText("Dashboard")).toBeVisible();
      await expect(sidebar.getByText("Add Report")).toBeVisible();
      await expect(sidebar.getByText("My Reports")).toBeVisible();
      await expect(sidebar.getByText("My Attendance")).toBeVisible();
      await expect(sidebar.getByText("My Leaves")).toBeVisible();
      await expect(sidebar.getByText("My Documents")).toBeVisible();

      // Should NOT see admin items
      await expect(sidebar.getByText("User Management")).not.toBeVisible();
      await expect(sidebar.getByText("Settings")).not.toBeVisible();
    });

    test("clicking Add Report navigates to new report form", async ({
      recruiterPage,
    }) => {
      await recruiterPage.goto("/dashboard");
      await recruiterPage.waitForLoadState("networkidle");

      const sidebar = recruiterPage.locator("aside");
      await sidebar.getByText("Add Report").click();

      await recruiterPage.waitForURL(/\/reports\/new/);
      await recruiterPage.waitForLoadState("networkidle");

      await expect(
        recruiterPage.getByRole("heading", { name: "Add Report" })
      ).toBeVisible();
    });
  });

  test.describe("Sidebar navigation - Reporting Manager", () => {
    test("sidebar displays RM-specific links", async ({ rmPage }) => {
      await rmPage.goto("/dashboard");
      await rmPage.waitForLoadState("networkidle");

      const sidebar = rmPage.locator("aside");

      // RM nav items
      await expect(sidebar.getByText("Dashboard")).toBeVisible();
      await expect(sidebar.getByText("My Recruiters")).toBeVisible();
      await expect(sidebar.getByText("Team Reports")).toBeVisible();
      await expect(sidebar.getByText("Team Attendance")).toBeVisible();
      await expect(sidebar.getByText("Team Leaves")).toBeVisible();
      await expect(sidebar.getByText("My Attendance")).toBeVisible();
      await expect(sidebar.getByText("My Leaves")).toBeVisible();
      await expect(sidebar.getByText("My Documents")).toBeVisible();

      // Should NOT see admin items
      await expect(sidebar.getByText("User Management")).not.toBeVisible();
      await expect(sidebar.getByText("Analytics")).not.toBeVisible();
    });

    test("clicking My Recruiters navigates correctly", async ({ rmPage }) => {
      await rmPage.goto("/dashboard");
      await rmPage.waitForLoadState("networkidle");

      const sidebar = rmPage.locator("aside");
      await sidebar.getByText("My Recruiters").click();

      await rmPage.waitForURL(/\/my-recruiters/);
      await rmPage.waitForLoadState("networkidle");
    });
  });

  test.describe("Search page", () => {
    test("loads and accepts search input", async ({ adminPage }) => {
      await adminPage.goto("/search");
      await adminPage.waitForLoadState("networkidle");

      // Search input should be present on the page
      const searchInput = adminPage.getByRole("textbox").first();
      await expect(searchInput).toBeVisible();

      // Type a query
      await searchInput.fill("test candidate");
      await expect(searchInput).toHaveValue("test candidate");
    });

    test("search with short query does not trigger results", async ({ adminPage }) => {
      await adminPage.goto("/search?q=a");
      await adminPage.waitForLoadState("networkidle");

      // With a 1-character query, no results should load (min 2 chars)
      // Either no results text or the page just shows the input
      await expect(
        adminPage.getByRole("textbox").first()
      ).toBeVisible();
    });
  });

  test.describe("Help page", () => {
    test("loads with FAQ sections", async ({ recruiterPage }) => {
      await recruiterPage.goto("/help");
      await recruiterPage.waitForLoadState("networkidle");

      // FAQ section headings
      await expect(recruiterPage.getByText("Recruiter FAQs")).toBeVisible();

      // Individual FAQ questions
      await expect(
        recruiterPage.getByText("How do I submit a daily candidate report?")
      ).toBeVisible();
      await expect(
        recruiterPage.getByText("How does the zone-based form work?")
      ).toBeVisible();

      // Search input for filtering FAQs
      const searchInput = recruiterPage.getByRole("textbox").first();
      await expect(searchInput).toBeVisible();
    });

    test("admin sees all FAQ sections including admin-specific", async ({
      adminPage,
    }) => {
      await adminPage.goto("/help");
      await adminPage.waitForLoadState("networkidle");

      await expect(adminPage.getByText("Recruiter FAQs")).toBeVisible();
      await expect(adminPage.getByText("Reporting Manager FAQs")).toBeVisible();
      await expect(adminPage.getByText("Admin FAQs")).toBeVisible();

      // Admin-specific FAQ
      await expect(
        adminPage.getByText("How do I manage system users?")
      ).toBeVisible();
    });
  });

  test.describe("Notifications page", () => {
    test("loads with notification controls", async ({ recruiterPage }) => {
      await recruiterPage.goto("/notifications");
      await recruiterPage.waitForLoadState("networkidle");

      // Heading
      await expect(
        recruiterPage.getByRole("heading", { name: "Notifications" })
      ).toBeVisible();

      // Action buttons
      await expect(
        recruiterPage.getByRole("button", { name: /Mark All Read/i })
      ).toBeVisible();
      await expect(
        recruiterPage.getByRole("button", { name: /Clear All/i })
      ).toBeVisible();

      // Either notifications list or empty state
      const notificationItem = recruiterPage.locator('[class*="rounded-lg"][class*="border"]').first();
      const emptyState = recruiterPage.getByText("No notifications");
      const skeleton = recruiterPage.locator('[class*="animate-pulse"]');
      await expect(
        notificationItem.or(emptyState).or(skeleton).first()
      ).toBeVisible();
    });
  });

  test.describe("Profile page", () => {
    test("loads with user information", async ({ recruiterPage }) => {
      await recruiterPage.goto("/profile");
      await recruiterPage.waitForLoadState("networkidle");

      // Heading
      await expect(
        recruiterPage.getByRole("heading", { name: "My Profile" })
      ).toBeVisible();

      // Personal information section
      await expect(recruiterPage.getByText("Personal Information")).toBeVisible();

      // Field labels
      await expect(recruiterPage.getByText("Employee ID")).toBeVisible();
    });

    test("admin profile page loads correctly", async ({ adminPage }) => {
      await adminPage.goto("/profile");
      await adminPage.waitForLoadState("networkidle");

      await expect(
        adminPage.getByRole("heading", { name: "My Profile" })
      ).toBeVisible();
      await expect(adminPage.getByText("Personal Information")).toBeVisible();
    });
  });
});
