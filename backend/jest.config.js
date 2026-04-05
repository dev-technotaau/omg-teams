/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  // ── Environment ──
  testEnvironment: "node",
  roots: ["<rootDir>/src"],

  // ── TypeScript transform ──
  transform: {
    "^.+\\.tsx?$": [
      "ts-jest",
      {
        tsconfig: "tsconfig.test.json",
        diagnostics: { ignoreDiagnostics: [151001] },
      },
    ],
  },

  // ── Path aliases (mirror tsconfig paths) ──
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/src/$1",
    "^@config/(.*)$": "<rootDir>/src/config/$1",
    "^@controllers/(.*)$": "<rootDir>/src/controllers/$1",
    "^@middleware/(.*)$": "<rootDir>/src/middleware/$1",
    "^@models/(.*)$": "<rootDir>/src/models/$1",
    "^@routes/(.*)$": "<rootDir>/src/routes/$1",
    "^@services/(.*)$": "<rootDir>/src/services/$1",
    "^@utils/(.*)$": "<rootDir>/src/utils/$1",
    "^@types/(.*)$": "<rootDir>/src/types/$1",
    "^@validators/(.*)$": "<rootDir>/src/validators/$1",
    "^@constants/(.*)$": "<rootDir>/src/constants/$1",
    "^@jobs/(.*)$": "<rootDir>/src/jobs/$1",
    "^@events/(.*)$": "<rootDir>/src/events/$1",
  },

  // ── File patterns ──
  testMatch: ["**/*.test.ts", "**/*.spec.ts"],
  testPathIgnorePatterns: ["/node_modules/", "/dist/"],

  // ── Coverage ──
  collectCoverageFrom: [
    "src/**/*.ts",
    "!src/**/*.d.ts",
    "!src/**/index.ts",
    "!src/types/**",
  ],
  coverageDirectory: "coverage",
  coverageReporters: ["text", "text-summary", "lcov", "clover"],
  coverageThreshold: {
    global: {
      branches: 60,
      functions: 60,
      lines: 60,
      statements: 60,
    },
  },

  // ── Misc ──
  verbose: true,
  clearMocks: true,
  restoreMocks: true,
  maxWorkers: "50%",
};
