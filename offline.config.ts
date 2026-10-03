import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./checks",
  workers: 1,
  reporter: "list",
  // Three cold browser launches need more room than a single browser test.
  timeout: 30_000,
  expect: { timeout: 5_000 },
});
