import { defineConfig, type Plugin } from 'vite';
function offlineShell():Plugin {
  return { name:'mercature-offline-shell', apply:'build', generateBundle(_options,bundle) {
    const assets=['/','/index.html','/manifest.webmanifest',...Object.keys(bundle).filter(k=>!k.endsWith('.map')).map(k=>`/${k}`)];
    const revision=Object.keys(bundle).sort().join('|');
    let hash=2166136261;for(const char of revision){hash^=char.charCodeAt(0);hash=Math.imul(hash,16777619);}
    const cache=`mercature-app-${(hash>>>0).toString(16)}`;
    const source=`const CACHE=${JSON.stringify(cache)};const ASSETS=${JSON.stringify([...new Set(assets)])};
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(ASSETS))));
self.addEventListener('activate',event=>event.waitUntil(Promise.all([caches.keys().then(keys=>Promise.all(keys.filter(key=>key.startsWith('mercature-app-')&&key!==CACHE).map(key=>caches.delete(key)))),self.clients.claim()])));
self.addEventListener('fetch',event=>{const url=new URL(event.request.url);if(event.request.method!=='GET'||url.origin!==self.location.origin)return;if(event.request.mode==='navigate'){event.respondWith(fetch(event.request).catch(()=>caches.open(CACHE).then(cache=>cache.match('/index.html'))));return;}if(ASSETS.includes(url.pathname))event.respondWith(caches.open(CACHE).then(cache=>cache.match(event.request).then(response=>response||fetch(event.request))));});`;
    this.emitFile({type:'asset',fileName:'sw.js',source});
  }};
}
export default defineConfig({plugins:[offlineShell()]});
