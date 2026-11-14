/// <reference lib="webworker" />
import { clientsClaim, setCacheNameDetails } from 'workbox-core';
import {
  cleanupOutdatedCaches,
  createHandlerBoundToURL,
  precacheAndRoute,
  type PrecacheEntry,
} from 'workbox-precaching';
import { registerRoute } from 'workbox-routing';
import { NetworkOnly } from 'workbox-strategies';
import { isPrivatePath, isShellNavigation } from './cache-policy';

declare const self: ServiceWorkerGlobalScope & { __WB_MANIFEST: (PrecacheEntry | string)[] };

setCacheNameDetails({ prefix: 'suivi', suffix: 'static-v1' });
// Aucune mise en attente Workbox des requêtes privées : une seule file Dexie sera
// utilisée par le protocole métier, avec ses UUID, permissions et reçus explicites.
for (const method of ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'] as const) {
  registerRoute(
    ({ url }) => url.origin === self.location.origin && isPrivatePath(url.pathname),
    new NetworkOnly({ fetchOptions: { cache: 'no-store' } }),
    method,
  );
}
precacheAndRoute(self.__WB_MANIFEST);
cleanupOutdatedCaches();
registerRoute(
  ({ request, url }) =>
    request.mode === 'navigate' &&
    url.origin === self.location.origin &&
    isShellNavigation(url.pathname),
  createHandlerBoundToURL('/index.html'),
);
// SKIP_WAITING n'est envoyé que par le bouton de mise à jour confirmé par l'utilisateur.
self.addEventListener('message', (event: ExtendableMessageEvent) => {
  if (event.data?.type === 'SKIP_WAITING') void self.skipWaiting();
});
clientsClaim();
