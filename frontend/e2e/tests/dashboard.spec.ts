import { test, expect } from "../fixtures/auth";

/**
 * Dashboard tests for each role.
 *
 * Uses pre-authenticated page fixtures so each test starts
 * with a valid session (cookies loaded from storageState).
 */

test.describe("Dashboard", () => {
  test.describe("Admin dashboard", () => {
    test("loads with KPI cards and attendance summary", async ({ adminPage }) => {
      await adminPage.goto("/admin/dashboard");
      await adminPage.waitForLoadState("networkidle");

      // Page heading
      await expect(
        adminPage.getByRole("heading", { name: "Admin Dashboard" })
      ).toBeVisible();

      // Welcome text
      await expect(adminPage.getByText(/Welcome back,/)).toBeVisible();

      // Attendance summary cards
      await expect(adminPage.getByText("Present Today")).toBeVisible();
      await expect(adminPage.getByText("Absent Today")).toBeVisible();
      await expect(adminPage.getByText("Late Today")).toBeVisible();
      await expect(adminPage.getByText("On Leave")).toBeVisible();
      await expect(adminPage.getByText("Half Day")).toBeVisible();

      // KPI cards
      await expect(adminPage.getByText("Candidates Today")).toBeVisible();
      await expect(adminPage.getByText("This Month")).toBeVisible();
      await expect(adminPage.getByText("Pending")).toBeVisible();
      await expect(adminPage.getByText("Outstanding")).toBeVisible();

      // Section headings
      await expect(adminPage.getByText("Today's Logins")).toBeVisible();
      await expect(adminPage.getByText("Pending Actions")).toBeVisible();
    });
  });

  test.describe("Recruiter dashboard", () => {
    test("loads with stats cards and attendance info", async ({ recruiterPage }) => {
      await recruiterPage.goto("/dashboard");
      await recruiterPage.waitForLoadState("networkidle");

      // Page heading
      await expect(
        recruiterPage.getByRole("heading", { name: "My Dashboard" })
      ).toBeVisible();

      // Welcome text
      await expect(recruiterPage.getByText(/Welcome back,/)).toBeVisible();

      // Stats cards
      await expect(recruiterPage.getByText("Candidates Today")).toBeVisible();
      await expect(recruiterPage.getByText("Completion Rate")).toBeVisible();
      await expect(recruiterPage.getByText("Pending Reports")).toBeVisible();
      await expect(recruiterPage.getByText("Target Progress")).toBeVisible();

      // Attendance card
      await expect(recruiterPage.getByText("Today's Attendance")).toBeVisible();

      // Leave balance card
      await expect(recruiterPage.getByText("Leave Balance")).toBeVisible();
      await expect(recruiterPage.getByText("Casual Leave")).toBeVisible();
      await expect(recruiterPage.getByText("Sick Leave")).toBeVisible();
      await expect(recruiterPage.getByText("Earned Leave")).toBeVisible();
    });

    test("shows Add Report link in sidebar", async ({ recruiterPage }) => {
      await recruiterPage.goto("/dashboard");
      await recruiterPage.waitForLoadState("networkidle");

      const sidebar = recruiterPage.locator("aside");
      await expect(sidebar.getByText("Add Report")).toBeVisible();
      await expect(sidebar.getByText("My Reports")).toBeVisible();
    });
  });

  test.describe("Reporting Manager dashboard", () => {
    test("loads with team view and stats", async ({ rmPage }) => {
      await rmPage.goto("/dashboard");
      await rmPage.waitForLoadState("networkidle");

      // Page heading — RM sees "Team Dashboard"
      await expect(
        rmPage.getByRole("heading", { name: "Team Dashboard" })
      ).toBeVisible();

      // Welcome text
      await expect(rmPage.getByText(/Welcome back,/)).toBeVisible();

      // RM-specific stats
      await expect(rmPage.getByText("Team Candidates Today")).toBeVisible();
      await expect(rmPage.getByText("Active Recruiters")).toBeVisible();

      // Common stats
      await expect(rmPage.getByText("Completion Rate")).toBeVisible();
      await expect(rmPage.getByText("Pending Reports")).toBeVisible();

      // Attendance and leave cards
      await expect(rmPage.getByText("Today's Attendance")).toBeVisible();
      await expect(rmPage.getByText("Leave Balance")).toBeVisible();
    });

    test("shows team-related sidebar links", async ({ rmPage }) => {
      await rmPage.goto("/dashboard");
      await rmPage.waitForLoadState("networkidle");

      const sidebar = rmPage.locator("aside");
      await expect(sidebar.getByText("My Recruiters")).toBeVisible();
      await expect(sidebar.getByText("Team Reports")).toBeVisible();
      await expect(sidebar.getByText("Team Attendance")).toBeVisible();
      await expect(sidebar.getByText("Team Leaves")).toBeVisible();
    });
  });
});
