/* eslint-disable no-restricted-globals */
// Keeps a copy of the app itself on the device, so it opens with no signal.
// (The data has its own on-device copy, handled by Firestore.)
import { clientsClaim } from 'workbox-core';
import { precacheAndRoute, createHandlerBoundToURL } from 'workbox-precaching';
import { registerRoute } from 'workbox-routing';

clientsClaim();
precacheAndRoute(self.__WB_MANIFEST);

// Any page address opens the app shell; files and server functions are left alone.
const fileExtension = new RegExp('/[^/?]+\\.[^/]+$');
registerRoute(({ request, url }) => {
  if (request.mode !== 'navigate') return false;
  if (url.pathname.startsWith('/_') || url.pathname.startsWith('/.netlify')) return false;
  if (url.pathname.match(fileExtension)) return false;
  return true;
}, createHandlerBoundToURL(process.env.PUBLIC_URL + '/index.html'));

// A new version waits until the person taps "Update" (so a form being filled
// in is never reloaded underneath them).
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
});
