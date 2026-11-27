// Local fixture transport only. Production accepts public HTTPS/IPFS artwork;
// map this reserved test host to local fixtures without relaxing that boundary.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', event => event.waitUntil(self.clients.claim()));
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (url.origin === 'https://keeper-snake.inscape.test' && /^\/(big|small)\.svg$/.test(url.pathname)) {
    event.respondWith(fetch(`/browser-tests/fixtures/keeper-snake-${url.pathname.slice(1, -4)}.svg`));
  }
});
