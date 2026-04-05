import { test as base, type Page } from "@playwright/test";

/**
 * Custom test fixtures that provide pre-authenticated Page
 * objects for each role. Storage state files are created by
 * global-setup.ts before the test suite runs.
 */

type AuthFixtures = {
  adminPage: Page;
  recruiterPage: Page;
  rmPage: Page;
};

export const test = base.extend<AuthFixtures>({
  adminPage: async ({ browser }, use) => {
    const context = await browser.newContext({
      storageState: "e2e/.auth/admin.json",
    });
    const page = await context.newPage();
    // eslint-disable-next-line react-hooks/rules-of-hooks
    await use(page);
    await context.close();
  },

  recruiterPage: async ({ browser }, use) => {
    const context = await browser.newContext({
      storageState: "e2e/.auth/recruiter.json",
    });
    const page = await context.newPage();
    // eslint-disable-next-line react-hooks/rules-of-hooks
    await use(page);
    await context.close();
  },

  rmPage: async ({ browser }, use) => {
    const context = await browser.newContext({
      storageState: "e2e/.auth/reportingManager.json",
    });
    const page = await context.newPage();
    // eslint-disable-next-line react-hooks/rules-of-hooks
    await use(page);
    await context.close();
  },
});

export { expect } from "@playwright/test";
