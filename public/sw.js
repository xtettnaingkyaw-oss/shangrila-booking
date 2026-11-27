const CACHE_NAME = 'shangrila-pos-cache-v19';
const CORE_ASSETS = [
  '/',
  '/index.html',
  '/?mode=pos',
  '/?mode=staff',
  '/?mode=admin',
  '/manifest.json',
  '/manifest-staff.json',
  '/manifest-pos.json',
  '/logo.png'
];

// Preview / Local Dev environments must NEVER be intercepted or cached by the Service Worker
// (otherwise a transient warmup page can be cached and trap Live Preview).
const IS_PREVIEW_OR_DEV =
  self.location.hostname === 'localhost' ||
  self.location.hostname === '127.0.0.1' ||
  self.location.hostname.endsWith('.run.app') ||
  self.location.hostname.startsWith('ais-dev-');

const isCacheableHtml = async (response) => {
  try {
    if (!response || !response.ok || response.type !== 'basic') return false;
    const text = await response.clone().text();
    if (
      text.includes('__aistudio_warmup_failed') ||
      text.includes('<title>Starting Server...</title>')
    ) {
      return false;
    }
    return true;
  } catch {
    return false;
  }
};

// Helper: Fetch with a fast timeout so iPhone PWA on slow mobile data falls back to instant cache instead of white-screen stalling
const fetchWithTimeout = (urlOrReq, options, timeoutMs) => {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Network timeout')), timeoutMs);
    fetch(urlOrReq, options)
      .then((res) => {
        clearTimeout(timer);
        resolve(res);
      })
      .catch((err) => {
        clearTimeout(timer);
        reject(err);
      });
  });
};

// 1. Install
self.addEventListener('install', (event) => {
  self.skipWaiting();
  if (IS_PREVIEW_OR_DEV) return;

  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      for (const url of CORE_ASSETS) {
        try {
          const res = await fetch(url, { cache: 'no-store', credentials: 'same-origin' });
          if (res && res.ok) {
            const isHtml = (res.headers.get('content-type') || '').includes('text/html');
            if (!isHtml || (await isCacheableHtml(res))) {
              await cache.put(url, res.clone());
              if (url === '/') {
                await cache.put('/index.html', res.clone());
              }
            }
          }
        } catch (err) {
          console.warn('Pre-cache skip:', url, err);
        }
      }
    })
  );
});

// 2. Activate
self.addEventListener('activate', (event) => {
  if (IS_PREVIEW_OR_DEV) {
    event.waitUntil(
      (async () => {
        try {
          const keys = await caches.keys();
          await Promise.all(keys.map((key) => caches.delete(key)));
        } catch {}
        try {
          await self.registration.unregister();
        } catch {}
        try {
          const clients = await self.clients.matchAll({ type: 'window' });
          clients.forEach((client) => {
            if ('navigate' in client) {
              client.navigate(client.url).catch(() => {});
            }
          });
        } catch {}
      })()
    );
    return;
  }

  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) return caches.delete(key);
        })
      )
    ).then(() => self.clients.claim())
  );
});

// 3. Fetch
self.addEventListener('fetch', (event) => {
  if (IS_PREVIEW_OR_DEV) return;
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);

  // Blob/Data URLs, ပြင်ပ API များ နှင့် Dev/Internal paths များကို Service Worker မှ မထိန်းချုပ်ပါ
  if (
    (url.protocol !== 'http:' && url.protocol !== 'https:') ||
    url.origin !== self.location.origin ||
    url.pathname.startsWith('/__aistudio') ||
    url.pathname.startsWith('/_aistudio') ||
    url.pathname.startsWith('/@vite') ||
    url.pathname.startsWith('/src/') ||
    url.pathname.startsWith('/node_modules/')
  ) {
    return;
  }

  // 🌟 Page Navigation: Fast Network-First (2.2s timeout) -> Instant Cache Fallback + Background Refresh 🌟
  if (event.request.mode === 'navigate') {
    event.respondWith(
      (async () => {
        const cache = await caches.open(CACHE_NAME);

        try {
          const networkResponse = await fetchWithTimeout(
            event.request.url,
            { cache: 'no-store', credentials: 'same-origin' },
            2200
          );
          if (networkResponse && networkResponse.ok && (await isCacheableHtml(networkResponse))) {
            await cache.put(event.request, networkResponse.clone());
            await cache.put('/', networkResponse.clone());
            await cache.put('/index.html', networkResponse.clone());
            return networkResponse;
          }
          if (networkResponse && networkResponse.ok) {
            return networkResponse;
          }
        } catch (err) {
          // Slow network or offline: serve cached shell immediately while refreshing in background
          fetch(event.request.url, { cache: 'no-store', credentials: 'same-origin' })
            .then(async (bgRes) => {
              if (bgRes && bgRes.ok && (await isCacheableHtml(bgRes))) {
                await cache.put(event.request, bgRes.clone());
                await cache.put('/', bgRes.clone());
                await cache.put('/index.html', bgRes.clone());
              }
            })
            .catch(() => {});
        }

        const cachedExact = await cache.match(event.request);
        if (cachedExact) return cachedExact;

        const cachedIgnoreSearch = await cache.match(event.request, { ignoreSearch: true });
        if (cachedIgnoreSearch) return cachedIgnoreSearch;

        const cachedRoot = await cache.match('/');
        if (cachedRoot) return cachedRoot;

        const cachedIndex = await cache.match('/index.html');
        if (cachedIndex) return cachedIndex;

        return new Response(
          '<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Shangri-La</title></head><body style="background:#0a1f15;color:#D4AF37;font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;text-align:center;padding:20px;"><div><h2>အင်တာနက် ခေတ္တဖွင့်ပြီး တစ်ကြိမ် အရင်ဝင်ပေးပါ</h2><p style="color:#fff;font-size:14px;">Offline စနစ်အတွက် ဖိုင်များသိမ်းဆည်းရန် ပထမဆုံးအကြိမ် အင်တာနက်ဖွင့်၍ Reload နှိပ်ပေးပါ။</p><button onclick="location.reload()" style="margin-top:15px;padding:12px 24px;background:#D4AF37;color:#123524;border:none;border-radius:8px;font-weight:bold;">Reload Now</button></div></body></html>',
          { headers: { 'Content-Type': 'text/html; charset=utf-8' } }
        );
      })()
    );
    return;
  }

  // 🌟 Vite Hashed Static Assets (/assets/*): Cache-First for Instant (<5ms) iPhone Launch 🌟
  if (url.pathname.startsWith('/assets/')) {
    event.respondWith(
      (async () => {
        const cache = await caches.open(CACHE_NAME);
        const cached = await cache.match(event.request);
        if (cached) return cached;

        try {
          const networkResponse = await fetch(event.request);
          if (networkResponse && networkResponse.ok && networkResponse.type === 'basic') {
            cache.put(event.request, networkResponse.clone());
          }
          return networkResponse;
        } catch {
          return new Response('', { status: 408 });
        }
      })()
    );
    return;
  }

  // 🌟 Other Same-Origin Files (Manifests, Logo, Icons): Network-First -> Cache Fallback 🌟
  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE_NAME);

      try {
        const networkResponse = await fetch(event.request);
        if (networkResponse && networkResponse.ok && networkResponse.type === 'basic') {
          cache.put(event.request, networkResponse.clone());
          return networkResponse;
        }
        if (networkResponse) return networkResponse;
      } catch (err) {
        // Offline fallback
      }

      const cachedResponse = await cache.match(event.request, { ignoreSearch: true });
      return cachedResponse || new Response('', { status: 408 });
    })()
  );
});
