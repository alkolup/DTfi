/* DigiTool pro Tablet – offline cache (HTTPS nebo localhost, ne file://) */
const CACHE_NAME = 'digitool-tablet-v18-fi-local-log';

const SHELL = [
  './index.html',
  './3_ParkTask.html',
  './14_DegreeSequenceTask.html',
  './19_EulerTask_plus3.html',
  './manifest.webmanifest',
  './icon.svg',
  './icon-192.png',
  './icon-512.png',
  './sw.js',
  './digitool-action-log-store.js',
  './vendor/jspsych/jspsych.browser.min.js',
  './vendor/jspsych/jspsych.css',
  './vendor/plugin-html-button-response/plugin-html-button-response.browser.min.js'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) =>
        Promise.all(
          SHELL.map((url) =>
            cache.add(new Request(url, { cache: 'reload' })).catch((err) => {
              console.warn('[DigiTool SW] přeskočeno:', url, err);
            })
          )
        )
      )
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const reqUrl = new URL(req.url);
  const isSameOrigin = reqUrl.origin === self.location.origin;
  const isHtmlNavigation =
    req.mode === 'navigate' ||
    (req.headers.get('accept') || '').includes('text/html');

  const matchByPathVariants = async (pathName) => {
    const cleanPath = (pathName || '').replace(/^\//, '');
    const variants = [
      `./${cleanPath}`,
      `/${cleanPath}`,
      new URL(cleanPath, self.registration.scope).toString(),
      `${self.location.origin}/${cleanPath}`
    ];
    for (const key of variants) {
      const hit = await caches.match(key, { ignoreSearch: true });
      if (hit) return hit;
    }
    return null;
  };

  event.respondWith(
    (isHtmlNavigation
      ? fetch(req).then((res) => {
          // U HTML navigace preferujeme síť, aby Chrome nedostal nevalidní odpověď
          // ze staré cache/SW kombinace.
          if (res && res.status === 200 && isSameOrigin) {
            const copy = res.clone();
            caches.open(CACHE_NAME).then((cache) => {
              try {
                cache.put(req, copy);
              } catch (_) {}
            });
          }
          return res;
        }).catch(() => null)
      : caches.match(req, { ignoreSearch: true })
    ).then((cachedOrNetwork) => {
      if (cachedOrNetwork) return cachedOrNetwork;
      return fetch(req)
        .then((res) => {
          if (!res || res.status !== 200) {
            return res;
          }
          const copy = res.clone();
          caches.open(CACHE_NAME).then((cache) => {
            try {
              cache.put(req, copy);
            } catch (_) {}
          });
          return res;
        })
        .catch(() => {
          if (isHtmlNavigation && isSameOrigin) {
            // Offline navigace na úlohy používají query parametry (?rid=...).
            // Ignorujeme query, aby se našla předkešovaná HTML stránka úlohy.
            const path = reqUrl.pathname.replace(/^.*\//, '');
            if (path) {
              return matchByPathVariants(path).then((taskPage) => {
                if (taskPage) return taskPage;
                return matchByPathVariants('index.html');
              });
            }
          }
          if (isHtmlNavigation) return matchByPathVariants('index.html');
          return new Response('', { status: 503, statusText: 'Offline' });
        });
    })
  );
});
