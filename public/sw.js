const CACHE_NAME = 'shangrila-pos-cache-v8';
const CORE_ASSETS = [
  '/',
  '/index.html',
  '/?mode=pos',
  '/manifest.json'
];

// 1. Install: Service Worker အသစ်ကို ချက်ချင်း အသက်သွင်းမည်
self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      for (const url of CORE_ASSETS) {
        try {
          const res = await fetch(url, { cache: 'no-store' });
          if (res && res.ok) {
            await cache.put(url, res.clone());
            if (url === '/') {
              await cache.put('/index.html', res.clone());
            }
          }
        } catch (err) {
          console.warn('Pre-cache skip:', url, err);
        }
      }
    })
  );
});

// 2. Activate: Cache အဟောင်း (v6 အပါအဝင် အားလုံး) ကို ချက်ချင်း ဖျက်ထုတ်မည်
self.addEventListener('activate', (event) => {
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

// 3. Fetch: Online ဖြစ်နေပါက ကုဒ်အသစ်ကို အမြဲဦးစားပေးဆွဲပြီး Offline ဖြစ်မှသာ Cache ကို သုံးမည်
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);

  // ပြင်ပ API များ (Firebase, Google Fonts/APIs) ကို Service Worker မှ မထိန်းချုပ်ပါ
  if (url.origin !== self.location.origin) {
    return;
  }

  // 🌟 Page Navigation 🌟
  if (event.request.mode === 'navigate') {
    event.respondWith(
      (async () => {
        const cache = await caches.open(CACHE_NAME);

        try {
          // Online ဖြစ်နေပါက Browser Cache မသုံးဘဲ Server မှ ကုဒ်အသစ်ကို တိုက်ရိုက်ဆွဲမည်
          const networkResponse = await fetch(event.request, { cache: 'no-store' });
          if (networkResponse && networkResponse.ok) {
            await cache.put(event.request, networkResponse.clone());
            await cache.put('/', networkResponse.clone());
            await cache.put('/index.html', networkResponse.clone());
            return networkResponse;
          }
        } catch (err) {
          // Offline ဖြစ်နေပါက Cache ထဲမှ ရှာဖွေပေးမည်
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
          '<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Shangri-La POS</title></head><body style="background:#123524;color:#D4AF37;font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;text-align:center;padding:20px;"><div><h2>အင်တာနက် ခေတ္တဖွင့်ပြီး တစ်ကြိမ် အရင်ဝင်ပေးပါ</h2><p style="color:#fff;font-size:14px;">Offline စနစ်အတွက် ဖိုင်များသိမ်းဆည်းရန် ပထမဆုံးအကြိမ် အင်တာနက်ဖွင့်၍ Reload နှိပ်ပေးပါ။</p><button onclick="location.reload()" style="margin-top:15px;padding:12px 24px;background:#D4AF37;color:#123524;border:none;border-radius:8px;font-weight:bold;">Reload Now</button></div></body></html>',
          { headers: { 'Content-Type': 'text/html; charset=utf-8' } }
        );
      })()
    );
    return;
  }

  // 🌟 JS, CSS, Images နှင့် အခြား Assets ဖိုင်များအတွက် (Network First -> Offline Cache Fallback) 🌟
  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE_NAME);

      try {
        const networkResponse = await fetch(event.request);
        if (networkResponse && networkResponse.ok) {
          cache.put(event.request, networkResponse.clone());
          return networkResponse;
        }
      } catch (err) {
        // Offline ဖြစ်နေချိန်တွင် အောက်ပါ Cache မှ ပြန်ပေးမည်
      }

      const cachedResponse = await cache.match(event.request, { ignoreSearch: true });
      return cachedResponse || new Response('', { status: 408 });
    })()
  );
});
