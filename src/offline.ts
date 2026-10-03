export async function prepareOffline(): Promise<void> {
  if (!("serviceWorker" in navigator)) return;
  if (import.meta.env.PROD) {
    await navigator.serviceWorker.register("/sw.js");
  } else {
    // Retire this app's production cache on the development origin without touching saved places.
    const registrations = await navigator.serviceWorker.getRegistrations();
    for (const registration of registrations)
      if (
        new URL(registration.scope).origin === location.origin &&
        registration.active?.scriptURL === `${location.origin}/sw.js`
      )
        await registration.unregister();
    for (const key of await caches.keys())
      if (key.startsWith("mercature-app-")) await caches.delete(key);
  }
}
