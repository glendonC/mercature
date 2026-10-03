import { defineConfig, mergeConfig } from 'vite';
import base from '../../../vite.config';

/** The app's own build and service worker, with this page as the only entry. */
export default mergeConfig(base, defineConfig({
  root: new URL('.', import.meta.url).pathname,
  publicDir: new URL('../../../public', import.meta.url).pathname,
  build: { outDir: new URL('../../../.local/language/harness-dist', import.meta.url).pathname, emptyOutDir: true },
}));
