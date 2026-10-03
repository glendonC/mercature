import { defineConfig } from '@playwright/test';
/** Domain tests import the source directly, so they need no server and never open a browser. */
export const domainTests = /tests\/(?:spatial|plans|language|site)\/.+\.spec\.ts$|tests\/destinations\/data\.spec\.ts$/;
export default defineConfig({ testDir: './tests', testMatch: domainTests, fullyParallel: true, reporter: 'list' });
