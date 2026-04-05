/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  ...require("./jest.config"),

  // Override for E2E
  roots: ["<rootDir>/test"],
  testMatch: ["**/*.e2e-spec.ts", "**/*.e2e.test.ts"],
  setupFilesAfterSetup: ["<rootDir>/test/jest.e2e.setup.ts"],

  // E2E tests run sequentially and get more time
  maxWorkers: 1,
  testTimeout: 30_000,
};
