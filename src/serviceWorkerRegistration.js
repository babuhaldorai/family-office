// Registers the service worker in production builds. When a new version of
// the app has been downloaded, the page is told so it can offer "Update".
export function register() {
  if (process.env.NODE_ENV !== 'production' || !('serviceWorker' in navigator)) return;
  window.addEventListener('load', () => {
    navigator.serviceWorker.register(`${process.env.PUBLIC_URL}/service-worker.js`).then((reg) => {
      const announce = () => { window.__swWaiting = reg.waiting; window.dispatchEvent(new CustomEvent('v2-update')); };
      if (reg.waiting && navigator.serviceWorker.controller) announce();
      reg.addEventListener('updatefound', () => {
        const sw = reg.installing;
        if (!sw) return;
        sw.addEventListener('statechange', () => { if (sw.state === 'installed' && navigator.serviceWorker.controller) announce(); });
      });
      // look for a new version whenever the app comes back to the front
      document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') reg.update().catch(() => {}); });
    }).catch(() => {});
    let reloaded = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => { if (reloaded) return; reloaded = true; window.location.reload(); });
  });
}

export function applyUpdate() {
  if (window.__swWaiting) window.__swWaiting.postMessage({ type: 'SKIP_WAITING' });
  else window.location.reload();
}
