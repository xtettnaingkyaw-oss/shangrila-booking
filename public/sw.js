const SHELL_CACHE = 'shangrila-shell-v23';
const ASSET_CACHE = 'shangrila-assets-v1';

const CORE_ASSETS = [
  '/',
  '/index.html',
  '/?mode=pos',
  '/?mode=staff',
  '/?mode=admin',
  '/manifest.json',
  '/manifest-staff.json',
  '/manifest-pos.json',
  '/manifest-admin.json',
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
    const ct = (response.headers.get('content-type') || '').toLowerCase();
    if (ct && !ct.includes('text/html')) return false;
    const text = await response.clone().text();
    if (
      !text.includes('id="root"') ||
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

// Real AbortController timeout so slow/throttled Myanmar no-VPN routes never leave dangling iOS WebKit sockets
const fetchWithTimeout = async (urlOrReq, options = {}, timeoutMs = 4500) => {
  const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timer = controller ? setTimeout(() => controller.abort(), timeoutMs) : null;
  try {
    return await fetch(urlOrReq, controller ? { ...options, signal: controller.signal } : options);
  } finally {
    if (timer) clearTimeout(timer);
  }
};

// Precache all Vite hashed JS/CSS/image assets listed in /precache-manifest.json
// so every portal (Customer, Staff, Admin, POS) opens offline or without VPN.
const precacheBuildAssets = async (timeoutMs = 6000) => {
  try {
    const manifestRes = await fetchWithTimeout(
      '/precache-manifest.json',
      { cache: 'no-store', credentials: 'same-origin' },
      timeoutMs
    );
    if (!manifestRes || !manifestRes.ok) return [];
    const manifestData = await manifestRes.json();
    const assetUrls = Array.isArray(manifestData?.assets) ? manifestData.assets : [];
    if (assetUrls.length === 0) return [];

    const assetCache = await caches.open(ASSET_CACHE);
    const BATCH_SIZE = 4;
    for (let i = 0; i < assetUrls.length; i += BATCH_SIZE) {
      const batch = assetUrls.slice(i, i + BATCH_SIZE);
      await Promise.allSettled(
        batch.map(async (assetUrl) => {
          const existing = await assetCache.match(assetUrl);
          if (existing) return;
          const res = await fetchWithTimeout(assetUrl, { credentials: 'same-origin' }, timeoutMs);
          if (res && res.ok && res.type === 'basic') {
            const ct = (res.headers.get('content-type') || '').toLowerCase();
            if (assetUrl.endsWith('.js') && ct.includes('text/html')) return;
            if (assetUrl.endsWith('.css') && ct.includes('text/html')) return;
            await assetCache.put(assetUrl, res.clone());
          }
        })
      );
    }
    return assetUrls;
  } catch {
    return [];
  }
};

// Atomic background update: fetch fresh HTML + its Vite chunks FIRST before replacing cached shell
// so cached index.html NEVER points to uncached JS/CSS hashes on no-VPN launches.
const refreshShellInBackground = async (requestUrl, requestObj) => {
  try {
    const shellCache = await caches.open(SHELL_CACHE);
    const freshRes = await fetchWithTimeout(
      requestUrl,
      { cache: 'no-store', credentials: 'same-origin' },
      5000
    );
    if (!freshRes || !freshRes.ok || !(await isCacheableHtml(freshRes))) return;

    const freshHtmlText = await freshRes.clone().text();
    const oldCached = await shellCache.match('/index.html');
    const oldHtmlText = oldCached ? await oldCached.clone().text().catch(() => '') : '';

    // Always ensure the new build's JS/CSS chunks are cached before updating shell HTML
    if (freshHtmlText !== oldHtmlText) {
      await precacheBuildAssets(6000);
    }

    await Promise.all([
      shellCache.put(requestObj, freshRes.clone()),
      shellCache.put('/', freshRes.clone()),
      shellCache.put('/index.html', freshRes.clone()),
      shellCache.put('/?mode=staff', freshRes.clone()),
      shellCache.put('/?mode=admin', freshRes.clone()),
      shellCache.put('/?mode=pos', freshRes.clone())
    ]);

    if (oldHtmlText && freshHtmlText !== oldHtmlText) {
      const clients = await self.clients.matchAll({ type: 'window' });
      clients.forEach((client) => {
        client.postMessage({ type: 'SHANGRILA_APP_UPDATED' });
      });
    }
  } catch {
    // Offline or slow no-VPN route — silently keep existing cached shell
  }
};

// 1. Install — Parallel precache with timeouts so slow no-VPN networks never stall SW install
self.addEventListener('install', (event) => {
  self.skipWaiting();
  if (IS_PREVIEW_OR_DEV) return;

  event.waitUntil(
    (async () => {
      const shellCache = await caches.open(SHELL_CACHE);

      // Fetch core shell & static portal manifests in parallel (fast 4.5s timeout each)
      await Promise.allSettled(
        CORE_ASSETS.map(async (url) => {
          try {
            const res = await fetchWithTimeout(
              url,
              { cache: 'no-store', credentials: 'same-origin' },
              4500
            );
            if (res && res.ok) {
              const isHtml = (res.headers.get('content-type') || '').includes('text/html');
              if (!isHtml || (await isCacheableHtml(res))) {
                await shellCache.put(url, res.clone());
                if (url === '/') {
                  await shellCache.put('/index.html', res.clone());
                }
              }
            }
          } catch {
            // Skip individual timeout cleanly so SW still activates
          }
        })
      );

      // Precache all built Vite JS/CSS/logo chunks into persistent ASSET_CACHE
      await precacheBuildAssets(6000);
    })()
  );
});

// 2. Activate — Keep ASSET_CACHE intact so active shells never 404 on hashed chunks
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
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys.map((key) => {
          if (key !== SHELL_CACHE && key !== ASSET_CACHE) {
            return caches.delete(key);
          }
          return Promise.resolve();
        })
      );

      // Prune very old unused hashed assets only if ASSET_CACHE grows beyond 80 entries
      try {
        const assetCache = await caches.open(ASSET_CACHE);
        const cachedReqs = await assetCache.keys();
        if (cachedReqs.length > 80) {
          const manifestRes = await fetchWithTimeout(
            '/precache-manifest.json',
            { cache: 'no-store', credentials: 'same-origin' },
            3500
          ).catch(() => null);
          if (manifestRes && manifestRes.ok) {
            const manifestData = await manifestRes.json();
            const currentSet = new Set(Array.isArray(manifestData?.assets) ? manifestData.assets : []);
            const obsolete = cachedReqs.filter((req) => !currentSet.has(new URL(req.url).pathname));
            await Promise.allSettled(obsolete.map((req) => assetCache.delete(req)));
          }
        }
      } catch {}

      await self.clients.claim();
    })()
  );
});

// Message API for in-app manual update / cache reset recovery
self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  if (event.data?.type === 'CLEAR_ALL_CACHES') {
    event.waitUntil(
      caches.keys().then((keys) => Promise.all(keys.map((k) => caches.delete(k))))
    );
  }
});

// 3. Fetch
self.addEventListener('fetch', (event) => {
  if (IS_PREVIEW_OR_DEV) return;
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);

  // Never intercept cross-origin APIs (Firebase, Telegram, etc.), blobs, or Vite dev paths
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

  // 🌟 Page Navigation: INSTANT Cache-First (<10ms) + Atomic Background Revalidate 🌟
  // Prevents blank white screens on iPhone Home Screen PWAs in Myanmar without VPN!
  if (event.request.mode === 'navigate') {
    event.respondWith(
      (async () => {
        const shellCache = await caches.open(SHELL_CACHE);

        const cachedShell =
          (await shellCache.match(event.request)) ||
          (await shellCache.match(event.request, { ignoreSearch: true })) ||
          (await shellCache.match('/')) ||
          (await shellCache.match('/index.html'));

        if (cachedShell) {
          // Kick off atomic background update without blocking iPhone launch
          event.waitUntil(refreshShellInBackground(event.request.url, event.request));
          return cachedShell;
        }

        // First-ever uncached launch: try network with generous timeout, then dark-emerald recovery screen
        try {
          const networkResponse = await fetchWithTimeout(
            event.request.url,
            { cache: 'no-store', credentials: 'same-origin' },
            7500
          );
          if (networkResponse && networkResponse.ok && (await isCacheableHtml(networkResponse))) {
            await shellCache.put(event.request, networkResponse.clone());
            await shellCache.put('/', networkResponse.clone());
            await shellCache.put('/index.html', networkResponse.clone());
            event.waitUntil(precacheBuildAssets(6000));
            return networkResponse;
          }
          if (networkResponse && networkResponse.ok) {
            return networkResponse;
          }
        } catch {}

        return new Response(
          `<!DOCTYPE html>
<html lang="my">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
  <meta name="theme-color" content="#0a1f15">
  <title>The Shangri-La</title>
</head>
<body style="background:#0a1f15;color:#fff;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;padding:24px;text-align:center;">
  <div style="max-width:340px;width:100%;background:rgba(18,53,36,0.9);border:1px solid rgba(212,175,55,0.35);border-radius:20px;padding:28px 20px;box-shadow:0 20px 50px rgba(0,0,0,0.45);">
    <img src="/logo.png" alt="Shangri-La" style="width:72px;height:72px;object-fit:contain;margin:0 auto 14px;display:block;" onerror="this.style.display='none'">
    <h2 style="color:#D4AF37;font-size:18px;margin:0 0 10px;">အင်တာနက် ချိတ်ဆက်မှု နှေးကွေးနေပါသည်</h2>
    <p style="color:#d1d5db;font-size:13px;line-height:1.6;margin:0 0 20px;">
      ပထမဆုံးအကြိမ် ဖိုင်များသိမ်းဆည်းရန် အင်တာနက် (သို့မဟုတ် Wi-Fi / VPN ခေတ္တ) ချိတ်ဆက်ပြီး ပြန်ဖွင့်ပေးပါ။ တစ်ကြိမ်ဖွင့်ပြီးပါက နောက်ပိုင်း VPN မလိုဘဲ ချက်ချင်းပွင့်လာပါမည်။
    </p>
    <button onclick="location.reload()" style="width:100%;padding:13px 20px;background:#D4AF37;color:#0a1f15;border:none;border-radius:12px;font-weight:800;font-size:14px;cursor:pointer;">
      ပြန်လည်ဖွင့်ရန် (Retry)
    </button>
  </div>
</body>
</html>`,
          { headers: { 'Content-Type': 'text/html; charset=utf-8' } }
        );
      })()
    );
    return;
  }

  // 🌟 Vite Hashed Static Assets (/assets/*): Cache-First from persistent ASSET_CACHE 🌟
  if (url.pathname.startsWith('/assets/')) {
    event.respondWith(
      (async () => {
        const assetCache = await caches.open(ASSET_CACHE);
        const cached = await assetCache.match(event.request);
        if (cached) return cached;

        try {
          const networkResponse = await fetchWithTimeout(
            event.request,
            { credentials: 'same-origin' },
            10000
          );
          if (networkResponse && networkResponse.ok && networkResponse.type === 'basic') {
            const ct = (networkResponse.headers.get('content-type') || '').toLowerCase();
            const isBrokenHtmlFallback =
              (url.pathname.endsWith('.js') || url.pathname.endsWith('.css')) &&
              ct.includes('text/html');
            if (!isBrokenHtmlFallback) {
              assetCache.put(event.request, networkResponse.clone());
              return networkResponse;
            }
            return new Response('', { status: 404, statusText: 'Chunk Outdated' });
          }
          return networkResponse;
        } catch {
          return new Response('', { status: 408, statusText: 'Asset Timeout' });
        }
      })()
    );
    return;
  }

  // 🌟 Other Same-Origin Static Files (Manifests, Logo, Icons): Stale-While-Revalidate 🌟
  event.respondWith(
    (async () => {
      const shellCache = await caches.open(SHELL_CACHE);
      const cachedResponse = await shellCache.match(event.request, { ignoreSearch: true });

      const networkFetch = fetchWithTimeout(event.request, { credentials: 'same-origin' }, 4500)
        .then((res) => {
          if (res && res.ok && res.type === 'basic') {
            shellCache.put(event.request, res.clone());
          }
          return res;
        })
        .catch(() => null);

      if (cachedResponse) {
        event.waitUntil(networkFetch);
        return cachedResponse;
      }

      const fresh = await networkFetch;
      return fresh || new Response('', { status: 408 });
    })()
  );
});
