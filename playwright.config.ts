import { defineConfig } from '@playwright/test';
import { domainTests } from './fast.config.ts';
const port = process.env.MERCATURE_PORT ?? '4173';
export default defineConfig({
  testDir: './tests', fullyParallel: true, reporter: 'list', expect: { timeout: 5_000 },
  use: { baseURL: `http://127.0.0.1:${port}`, headless: true },
  projects: [{ name: 'domain', testMatch: domainTests }, { name: 'ui', testIgnore: domainTests, timeout: 10_000 }],
});
