const CACHE_NAME = 'shangrila-pos-cache-v5';
const INITIAL_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json'
];

// 1. Install: အခြေခံဖိုင်များကို သိမ်းဆည်းမည်
self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(INITIAL_ASSETS).catch(() => {});
    })
  );
});

// 2. Activate: Cache အဟောင်းများကို ရှင်းလင်းမည်
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) return caches.delete(key);
        })
      )
    )
  );
  self.clients.claim();
});

// 3. Fetch: Timeout လုံးဝမဖြတ်ဘဲ Cache နှင့် Network ကို အချိတ်အဆက်မိမိ လုပ်ဆောင်မည်
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);

  // Firebase / Google API များကို ကျော်သွားမည်
  if (
    url.hostname.includes('googleapis.com') ||
    url.hostname.includes('firebase') ||
    url.hostname.includes('gstatic.com')
  ) {
    return;
  }

  // Page ဖွင့်ခြင်း (Navigation: /, /?mode=pos, etc.)
  if (event.request.mode === 'navigate') {
    event.respondWith(
      caches.open(CACHE_NAME).then((cache) => {
        return cache.match('/index.html').then((cachedHtml) => {
          const networkFetch = fetch(event.request)
            .then((networkResponse) => {
              if (networkResponse && networkResponse.status === 200) {
                cache.put('/index.html', networkResponse.clone());
              }
              return networkResponse;
            })
            .catch(() => {
              // Offline ဖြစ်နေပါက Cache ထဲမှ index.html ကို ပြန်ပေးမည်
              return cachedHtml;
            });

          // Cache ရှိပြီးသားဆိုလျှင် ချက်ချင်းတန်းဖွင့်ပေးပြီး နောက်ကွယ်မှ Update လုပ်မည် (လိုင်းနှေးနေလည်း လုံးဝမထစ်တော့ပါ)
          return cachedHtml || networkFetch;
        });
      })
    );
    return;
  }

  // JS, CSS, ပုံများ နှင့် အခြား Assets ဖိုင်များအတွက် (Cache First -> Network Fallback & Update)
  event.respondWith(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.match(event.request, { ignoreSearch: true }).then((cachedResponse) => {
        const fetchPromise = fetch(event.request)
          .then((networkResponse) => {
            if (networkResponse && networkResponse.status === 200) {
              cache.put(event.request, networkResponse.clone());
            }
            return networkResponse;
          })
          .catch(() => cachedResponse);

        return cachedResponse || fetchPromise;
      });
    })
  );
});
