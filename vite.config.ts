import { defineConfig, type Plugin } from "vite";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
function offlineShell(): Plugin {
  return {
    name: "mercature-offline-shell",
    apply: "build",
    generateBundle(_options, bundle) {
      const assets = [
        "/",
        "/index.html",
        "/manifest.webmanifest",
        ...Object.keys(bundle)
          .filter((k) => !k.endsWith(".map"))
          .map((k) => `/${k}`),
      ];
      const digest = createHash("sha256");
      for (const [name, item] of Object.entries(bundle).sort(([a], [b]) =>
        a.localeCompare(b),
      )) {
        digest.update(name);
        digest.update(item.type === "chunk" ? item.code : item.source);
      }
      digest.update(
        readFileSync(new URL("./public/manifest.webmanifest", import.meta.url)),
      );
      digest.update(readFileSync(new URL("./index.html", import.meta.url)));
      const cache = `mercature-app-${digest.digest("hex").slice(0, 16)}`;
      const source = `const CACHE=${JSON.stringify(cache)};const ASSETS=${JSON.stringify([...new Set(assets)])};
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(ASSETS))));
self.addEventListener('activate',event=>event.waitUntil(Promise.all([caches.keys().then(keys=>Promise.all(keys.filter(key=>key.startsWith('mercature-app-')&&key!==CACHE).map(key=>caches.delete(key)))),self.clients.claim()])));
self.addEventListener('fetch',event=>{const url=new URL(event.request.url);if(event.request.method!=='GET'||url.origin!==self.location.origin)return;if(event.request.mode==='navigate'){event.respondWith(fetch(event.request).catch(()=>caches.open(CACHE).then(cache=>cache.match('/index.html'))));return;}if(ASSETS.includes(url.pathname))event.respondWith(caches.open(CACHE).then(cache=>cache.match(event.request).then(response=>response||fetch(event.request))));});`;
      this.emitFile({ type: "asset", fileName: "sw.js", source });
    },
  };
}
export default defineConfig({ plugins: [offlineShell()] });
