// Development preview transport, scoped to this disposable preview only.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', event => event.waitUntil(self.clients.claim()));
self.addEventListener('fetch', event => {
  if (event.request.url === 'https://keeper-octopus.inscape.test/artwork.svg')
    event.respondWith(fetch('/browser-tests/fixtures/keeper-octopus.svg'));
});
