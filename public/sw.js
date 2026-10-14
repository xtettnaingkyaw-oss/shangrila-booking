const CACHE_NAME = 'shangrila-pos-offline-v4';
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/?mode=pos',
  '/manifest.json'
];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE).catch((err) => console.warn('Cache addAll warning:', err));
    })
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key); // ကုဒ်အဟောင်း Cache များကို ရှင်းထုတ်မည်
          }
        })
      )
    )
  );
  self.clients.claim();
});

const fetchWithTimeout = (request, timeout = 3000) => {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Network timeout')), timeout);
    fetch(request)
      .then((response) => {
        clearTimeout(timer);
        resolve(response);
      })
      .catch((err) => {
        clearTimeout(timer);
        reject(err);
      });
  });
};

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);

  // Firebase Firestore API Call များကို Service Worker မှ ဝင်မစွက်ဖက်ပါ
  if (url.hostname.includes('firestore.googleapis.com') || url.hostname.includes('google')) {
    return;
  }

  // HTML Navigation (Page ဖွင့်ခြင်း - ဥပမာ /?mode=pos) အတွက်
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetchWithTimeout(event.request, 2500)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, copy);
            cache.put('/index.html', copy.clone());
          });
          return response;
        })
        .catch(() => {
          return caches.match(event.request).then((res) => res || caches.match('/index.html') || caches.match('/'));
        })
    );
    return;
  }

  // JS, CSS, Images နှင့် အခြား Assets ဖိုင်များအတွက် (Network First -> Fallback to Cache)
  event.respondWith(
    fetchWithTimeout(event.request, 3000)
      .then((response) => {
        if (response && response.status === 200) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
        }
        return response;
      })
      .catch(() => {
        return caches.match(event.request, { ignoreSearch: true });
      })
  );
});
