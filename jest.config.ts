import type { Config } from "jest";

const config: Config = {
  preset: "ts-jest",
  testEnvironment: "node",
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/src/$1",
    // stub ESM-only packages that don't need to run in tests
    "^nanoid$": "<rootDir>/src/__tests__/__mocks__/nanoid.cjs",
    "^jose$": "<rootDir>/src/__tests__/__mocks__/jose.cjs",
  },
  transform: {
    "^.+\\.tsx?$": ["ts-jest", { tsconfig: { module: "CommonJS" } }],
  },
  transformIgnorePatterns: [
    "/node_modules/(?!(nanoid|jose)/)",
  ],
  testMatch: ["**/__tests__/**/*.test.ts"],
  collectCoverageFrom: [
    "src/lib/**/*.ts",
    "src/app/api/**/*.ts",
    "!src/**/*.d.ts",
  ],
};

export default config;
