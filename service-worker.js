const CACHE_NAME = 'ducks-academy-v2-104';

self.addEventListener('install', event => {
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k.startsWith('ducks-academy') && k !== CACHE_NAME).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;

  const isAsset = /\.(?:webp|png|jpg|jpeg|svg|mp4|pdf|woff2?)$/i.test(url.pathname);
  if (isAsset) {
    event.respondWith(
      caches.match(req).then(cached => {
        const network = fetch(req).then(res => {
          if (res && res.ok) caches.open(CACHE_NAME).then(cache => cache.put(req, res.clone()));
          return res;
        }).catch(() => cached);
        return cached || network;
      })
    );
    return;
  }

  event.respondWith(
    fetch(req, {cache:'no-cache'}).then(res => {
      if (res && res.ok) caches.open(CACHE_NAME).then(cache => cache.put(req, res.clone()));
      return res;
    }).catch(() => caches.match(req).then(cached => cached || caches.match('./index.html')))
  );
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  const target = event.notification.data?.url || './';
  event.waitUntil(clients.matchAll({type:'window',includeUncontrolled:true}).then(list => {
    for(const client of list){ if('focus' in client) return client.focus(); }
    if(clients.openWindow) return clients.openWindow(target);
  }));
});
