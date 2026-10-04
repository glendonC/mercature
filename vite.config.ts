import { defineConfig, type Plugin } from "vite";
import { localDestinations } from "./local-destinations.ts";
import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
/** Everything in public/ except the model, which keeps its own cache: the manifest, icons and published places. */
function publicFiles(): string[] {
  const root = new URL("./public/", import.meta.url);
  if (!existsSync(root)) return [];
  return readdirSync(root, { recursive: true, encoding: "utf8" })
    .map((name) => name.split("\\").join("/"))
    .filter((name) => !name.startsWith("models/") && !name.endsWith(".DS_Store") && statSync(new URL(name, root)).isFile())
    .sort();
}
function offlineShell(): Plugin {
  return {
    name: "mercature-offline-shell",
    apply: "build",
    generateBundle(_options, bundle) {
      // Paths relative to the service worker, so the same build works at a domain root or under a sub-path.
      const assets = [
        "",
        "index.html",
        ...Object.keys(bundle)
          // The 11 MB inference runtime is stored with the model on request, not precached for every visitor.
          .filter((k) => !k.endsWith(".map") && !k.endsWith(".wasm")),
        ...publicFiles(),
      ];
      const digest = createHash("sha256");
      for (const [name, item] of Object.entries(bundle).sort(([a], [b]) =>
        a.localeCompare(b),
      )) {
        digest.update(name);
        digest.update(item.type === "chunk" ? item.code : item.source);
      }
      digest.update(readFileSync(new URL("./index.html", import.meta.url)));
      for (const name of publicFiles()) digest.update(readFileSync(new URL(`./public/${name}`, import.meta.url)));
      const cache = `mercature-app-${digest.digest("hex").slice(0, 16)}`;
      // Matches ignore Vary: a host may vary on Origin, and module scripts and stylesheets are requested with one while the precache was stored without.
      // Pages go past the HTTP cache: a newer index.html kept there after a deploy names chunks this worker never stored, so offline it must fall back to its own.
      const source = `const CACHE=${JSON.stringify(cache)};const SCOPE=new URL('./',self.location.href).pathname;const ASSETS=${JSON.stringify([...new Set(assets)])}.map(path=>SCOPE+path);
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(ASSETS))));
self.addEventListener('activate',event=>event.waitUntil(Promise.all([caches.keys().then(keys=>Promise.all(keys.filter(key=>key.startsWith('mercature-app-')&&key!==CACHE).map(key=>caches.delete(key)))),self.clients.claim()])));
self.addEventListener('fetch',event=>{const url=new URL(event.request.url);if(event.request.method!=='GET'||url.origin!==self.location.origin)return;if(event.request.mode==='navigate'){event.respondWith(fetch(event.request,{cache:'no-store'}).catch(()=>caches.open(CACHE).then(cache=>cache.match(SCOPE+'index.html',{ignoreVary:true}))));return;}if(ASSETS.includes(url.pathname))event.respondWith(caches.open(CACHE).then(cache=>cache.match(event.request,{ignoreVary:true}).then(response=>response||fetch(event.request))));});`;
      this.emitFile({ type: "asset", fileName: "sw.js", source });
    },
  };
}
export default defineConfig({ base: "./", plugins: [localDestinations(), offlineShell()] });
