import { chromium } from "@playwright/test";

/**
 * Global Setup — authenticates as each role via API and
 * persists storageState (cookies) for reuse across tests.
 *
 * Credentials are test-only and should match the seed data.
 */

const API_BASE = "http://localhost:3000/api/v1";

interface RoleCredentials {
  file: string;
  identifier: string;
  password: string;
  role: string;
}

const ROLES: RoleCredentials[] = [
  {
    file: "e2e/.auth/admin.json",
    identifier: "admin@omg.com",
    password: "Test@1234",
    role: "ADMIN",
  },
  {
    file: "e2e/.auth/recruiter.json",
    identifier: "recruiter@omg.com",
    password: "Test@1234",
    role: "RECRUITER",
  },
  {
    file: "e2e/.auth/reportingManager.json",
    identifier: "rm@omg.com",
    password: "Test@1234",
    role: "REPORTING_MANAGER",
  },
];

async function globalSetup(): Promise<void> {
  const browser = await chromium.launch();

  for (const cred of ROLES) {
    const context = await browser.newContext();
    const page = await context.newPage();

    // Hit the login API directly — bypasses Turnstile CAPTCHA
    const response = await page.request.post(`${API_BASE}/auth/login`, {
      data: {
        identifier: cred.identifier,
        password: cred.password,
        role: cred.role,
        deviceId: `e2e-test-${cred.role.toLowerCase()}`,
        turnstileToken: "e2e-bypass",
      },
    });

    if (!response.ok()) {
      const body = await response.text();
      throw new Error(
        `Global setup: failed to login as ${cred.role} (${response.status()}): ${body}`
      );
    }

    // Navigate to the app so cookies are associated with the frontend origin
    await page.goto("http://localhost:3001");
    await page.waitForLoadState("networkidle");

    // Persist cookies / localStorage as storageState
    await context.storageState({ path: cred.file });
    await context.close();
  }

  await browser.close();
}

export default globalSetup;
