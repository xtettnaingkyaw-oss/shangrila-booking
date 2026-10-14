const CACHE_NAME = 'shangrila-pos-offline-v1';
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/?mode=pos',
  '/manifest.json'
];

// Install Event
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
  self.skipWaiting();
});

// Activate Event
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    })
  );
  self.clientsClaim();
});

// Fetch Event (Offline First Strategy)
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // Network ကနေ ရလာပါက Cache ထဲသို့ အသစ်တင်ပေးမည်
        const clone = response.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, clone);
        });
        return response;
      })
      .catch(() => {
        // အင်တာနက် လုံးဝမရှိပါက Cache ထဲမှ အဟောင်းကို ပြန်ထုတ်ပြမည် (Offline Mode)
        return caches.match(event.request).then((cachedResponse) => {
          if (cachedResponse) {
            return cachedResponse;
          }
          // Fallback to index.html for SPA routing
          if (event.request.mode === 'navigate') {
            return caches.match('/index.html');
          }
        });
      })
  );
});
