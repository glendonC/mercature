import { defineConfig } from '@playwright/test';
const port = process.env.MERCATURE_PORT ?? '4173';
export default defineConfig({ testDir: './tests', fullyParallel: true, use: { baseURL: `http://127.0.0.1:${port}`, headless: true }, reporter: 'list' });
