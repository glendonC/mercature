import { defineConfig, type Plugin, type Rolldown } from "vite";
import { localDestinations } from "./local-destinations.ts";
import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
/** Everything in public/ except the model, which keeps its own cache, and the install-size icons, which are read once, online, when the app is installed. */
function publicFiles(): string[] {
  const root = new URL("./public/", import.meta.url);
  if (!existsSync(root)) return [];
  return readdirSync(root, { recursive: true, encoding: "utf8" })
    .map((name) => name.split("\\").join("/"))
    .filter((name) => !name.startsWith("models/") && !/^icons\/.*-512\.png$/.test(name) && !name.endsWith(".DS_Store") && statSync(new URL(name, root)).isFile())
    .sort();
}
/** Published files fetched on first use rather than at install: every place's 3D areas, and Narikala's package. The worker keeps them once fetched. */
const LATER = /^places\/(?:[^/]+\/pieces\/|narikala\/)/;
/** A place's records, read from the network while online so the first open after a deploy is never served an older copy; the stored copy serves offline. */
const FRESH = /^places\/[^/]+\/(?:place\.json|pieces\/space\.json)$/;
/** Places with a published package; only their covers can show outside a local install. */
function publishedPlaces(): Set<string> {
  const root = new URL("./public/places/", import.meta.url);
  return new Set(existsSync(root) ? readdirSync(root).filter((name) => statSync(new URL(name, root)).isDirectory()) : []);
}
/** Build output no deployed screen shows: the covers of places only a local install opens, and the design review at ?ui=kit. */
function unshown(bundle: Rolldown.OutputBundle): Set<string> {
  const published = publishedPlaces(), skip = new Set<string>();
  for (const [name, item] of Object.entries(bundle)) {
    if (item.type === "chunk" && item.facadeModuleId?.split("\\").join("/").endsWith("/src/ui/Kit.tsx")) {
      skip.add(name);
      for (const css of item.viteMetadata?.importedCss ?? []) skip.add(css);
    }
    const cover = item.type === "asset" && item.originalFileNames.map((file) => file.split("\\").join("/").match(/(?:^|\/)src\/covers\/([^/]+)\.webp$/)?.[1]).find(Boolean);
    if (cover && !published.has(cover)) skip.add(name);
  }
  return skip;
}
function offlineShell(): Plugin {
  return {
    name: "mercature-offline-shell",
    apply: "build",
    generateBundle(_options, bundle) {
      // Paths relative to the service worker, so the same build works at a domain root or under a sub-path.
      const skip = unshown(bundle);
      const assets = [
        "",
        "index.html",
        ...Object.keys(bundle)
          // The 11 MB inference runtime is stored with the model on request, not precached for every visitor.
          .filter((k) => !k.endsWith(".map") && !k.endsWith(".wasm") && !skip.has(k)),
        ...publicFiles().filter((name) => !LATER.test(name)),
      ];
      const digest = createHash("sha256");
      for (const [name, item] of Object.entries(bundle).sort(([a], [b]) =>
        a.localeCompare(b),
      )) {
        digest.update(name);
        digest.update(item.type === "chunk" ? item.code : item.source);
      }
      digest.update(readFileSync(new URL("./index.html", import.meta.url)));
      const later = createHash("sha256");
      for (const name of publicFiles()) (LATER.test(name) ? later : digest).update(name).update(readFileSync(new URL(`./public/${name}`, import.meta.url)));
      const cache = `mercature-app-${digest.digest("hex").slice(0, 16)}`, kept = `mercature-later-${later.digest("hex").slice(0, 16)}`;
      // Matches ignore Vary: a host may vary on Origin, and module scripts and stylesheets are requested with one while the precache was stored without.
      // Pages go past the HTTP cache: a newer index.html kept there after a deploy names chunks this worker never stored, so offline it must fall back to its own.
      // Files fetched later are kept on first use in their own cache, named for their contents, so a deploy that changes them starts it afresh.
      // A new worker takes over at once instead of waiting for every tab to close, so an open tab never mixes a new build with an older worker's records.
      // Every file it stores is fetched past the HTTP cache, so a page kept there for its max-age never joins chunks of another build in one precache.
      // A place's records go to the network first (revalidated, kept in the cache they belong to); offline, or past 4 s on a slow line, the stored copy answers.
      const source = `const CACHE=${JSON.stringify(cache)};const KEPT=${JSON.stringify(kept)};const LATER=new RegExp(${JSON.stringify(LATER.source)});const FRESH=new RegExp(${JSON.stringify(FRESH.source)});const SCOPE=new URL('./',self.location.href).pathname;const ASSETS=${JSON.stringify([...new Set(assets)])}.map(path=>SCOPE+path);
self.addEventListener('install',event=>{self.skipWaiting();event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(ASSETS.map(path=>new Request(path,{cache:'reload'})))));});
const fresh=(request,name)=>caches.open(name).then(cache=>{const stored=()=>cache.match(request,{ignoreVary:true});const network=fetch(request,{cache:'no-cache'}).then(response=>{if(response.ok&&response.type==='basic')cache.put(request,response.clone());return response;});network.catch(()=>{});return Promise.race([network,new Promise(resolve=>setTimeout(resolve,4000))]).then(response=>response||stored().then(hit=>hit||network),()=>stored().then(hit=>hit||Response.error()));});
self.addEventListener('activate',event=>event.waitUntil(Promise.all([caches.keys().then(keys=>Promise.all(keys.filter(key=>key.startsWith('mercature-app-')&&key!==CACHE||key.startsWith('mercature-later-')&&key!==KEPT).map(key=>caches.delete(key)))),self.clients.claim()])));
self.addEventListener('fetch',event=>{const url=new URL(event.request.url);if(event.request.method!=='GET'||url.origin!==self.location.origin)return;if(event.request.mode==='navigate'){event.respondWith(fetch(event.request,{cache:'no-store'}).catch(()=>caches.open(CACHE).then(cache=>cache.match(SCOPE+'index.html',{ignoreVary:true}))));return;}if(url.pathname.startsWith(SCOPE)&&FRESH.test(url.pathname.slice(SCOPE.length))){event.respondWith(fresh(event.request,ASSETS.includes(url.pathname)?CACHE:KEPT));return;}if(ASSETS.includes(url.pathname))event.respondWith(caches.open(CACHE).then(cache=>cache.match(event.request,{ignoreVary:true}).then(response=>response||fetch(event.request))));else if(url.pathname.startsWith(SCOPE)&&LATER.test(url.pathname.slice(SCOPE.length)))event.respondWith(caches.open(KEPT).then(cache=>cache.match(event.request,{ignoreVary:true}).then(hit=>hit||fetch(event.request,{cache:'reload'}).then(response=>{if(response.ok&&response.type==='basic')cache.put(event.request,response.clone());return response;}))));});`;
      this.emitFile({ type: "asset", fileName: "sw.js", source });
    },
  };
}
export default defineConfig({ base: "./", plugins: [localDestinations(), offlineShell()] });
