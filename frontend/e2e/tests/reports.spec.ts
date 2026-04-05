import { test, expect } from "../fixtures/auth";

/**
 * Report submission tests.
 *
 * Tests the recruiter workflow for adding candidate reports:
 * zone selection, form fields, draft saving, and listing.
 */

test.describe("Reports", () => {
  test.describe("New report form", () => {
    test("shows zone selection step initially", async ({ recruiterPage }) => {
      await recruiterPage.goto("/reports/new");
      await recruiterPage.waitForLoadState("networkidle");

      // Heading
      await expect(
        recruiterPage.getByRole("heading", { name: "Add Report" })
      ).toBeVisible();

      // Zone description
      await expect(
        recruiterPage.getByText("Select the zone for this candidate report")
      ).toBeVisible();

      // All five zones should be listed
      await expect(recruiterPage.getByText("North")).toBeVisible();
      await expect(recruiterPage.getByText("South")).toBeVisible();
      await expect(recruiterPage.getByText("East")).toBeVisible();
      await expect(recruiterPage.getByText("West")).toBeVisible();
      await expect(recruiterPage.getByText("Central")).toBeVisible();

      // Set labels
      await expect(recruiterPage.getByText("All 33 fields").first()).toBeVisible();
      await expect(
        recruiterPage.getByText("28 fields (screening hidden)").first()
      ).toBeVisible();
    });

    test("selecting West zone loads Set A form fields", async ({ recruiterPage }) => {
      await recruiterPage.goto("/reports/new");
      await recruiterPage.waitForLoadState("networkidle");

      // Select West zone (Set A — 33 fields)
      await recruiterPage.getByText("West").click();

      // Form should now be visible with zone info
      await expect(
        recruiterPage.getByText(/Zone: WEST \(Set A\)/)
      ).toBeVisible();

      // Candidate Information fieldset
      await expect(recruiterPage.getByText("Candidate Information")).toBeVisible();
      await expect(recruiterPage.getByText("Date Sourced")).toBeVisible();
      await expect(recruiterPage.getByText("Candidate Name")).toBeVisible();
      await expect(recruiterPage.getByText("Contact No")).toBeVisible();
      await expect(recruiterPage.getByText("Email ID")).toBeVisible();

      // Education fieldset
      await expect(recruiterPage.getByText("Education")).toBeVisible();
      await expect(recruiterPage.getByText("Higher Qualification")).toBeVisible();

      // Employment fieldset
      await expect(recruiterPage.getByText("Employment")).toBeVisible();
      await expect(recruiterPage.getByText("Profile")).toBeVisible();

      // Save Draft button
      await expect(
        recruiterPage.getByRole("button", { name: "Save Draft" })
      ).toBeVisible();

      // Change zone link
      await expect(recruiterPage.getByText("Change")).toBeVisible();
    });

    test("selecting East zone loads Set B form fields", async ({ recruiterPage }) => {
      await recruiterPage.goto("/reports/new");
      await recruiterPage.waitForLoadState("networkidle");

      // Select East zone (Set B — 28 fields)
      await recruiterPage.getByText("East").click();

      // Form should show Set B zone info
      await expect(
        recruiterPage.getByText(/Zone: EAST \(Set B\)/)
      ).toBeVisible();

      // Common fields should still be present
      await expect(recruiterPage.getByText("Candidate Information")).toBeVisible();
      await expect(recruiterPage.getByText("Education")).toBeVisible();
      await expect(recruiterPage.getByText("Employment")).toBeVisible();
    });

    test("can change zone after selection", async ({ recruiterPage }) => {
      await recruiterPage.goto("/reports/new");
      await recruiterPage.waitForLoadState("networkidle");

      // Select a zone
      await recruiterPage.getByText("North").click();
      await expect(recruiterPage.getByText(/Zone: NORTH/)).toBeVisible();

      // Click "Change" to go back to zone selection
      await recruiterPage.getByText("Change").click();

      // Should return to zone selection
      await expect(
        recruiterPage.getByText("Select the zone for this candidate report")
      ).toBeVisible();
    });
  });

  test.describe("Reports list", () => {
    test("recruiter sees My Reports page with add button", async ({ recruiterPage }) => {
      await recruiterPage.goto("/reports");
      await recruiterPage.waitForLoadState("networkidle");

      // Page heading
      await expect(
        recruiterPage.getByRole("heading", { name: "My Reports" })
      ).toBeVisible();

      // Add Report button
      await expect(
        recruiterPage.getByRole("link", { name: /Add Report/ })
      ).toBeVisible();

      // Table or empty state
      const table = recruiterPage.locator("table");
      const emptyState = recruiterPage.getByText(/no.*report/i);
      const skeleton = recruiterPage.locator('[class*="animate-pulse"]');
      await expect(
        table.or(emptyState).or(skeleton).first()
      ).toBeVisible();
    });

    test("RM sees Candidate Reports page without add button", async ({ rmPage }) => {
      await rmPage.goto("/reports");
      await rmPage.waitForLoadState("networkidle");

      // RM heading
      await expect(
        rmPage.getByRole("heading", { name: "Candidate Reports" })
      ).toBeVisible();

      // RM should not see the "Add Report" link (only recruiters)
      await expect(
        rmPage.getByRole("link", { name: /Add Report/ })
      ).not.toBeVisible();
    });
  });
});
