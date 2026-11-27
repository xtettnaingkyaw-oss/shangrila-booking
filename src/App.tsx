import React, { useState, useEffect, Suspense, lazy } from 'react';
import { doc, setDoc } from 'firebase/firestore';
import { signInAnonymously } from 'firebase/auth';
import { db, auth, requestNotificationPermission, reconnectFirestoreNetwork } from './firebase';
import { Download, X, MapPin, Phone, LogOut, WifiOff, RefreshCw } from 'lucide-react';
import { AppData } from './shared';
import {
  useAppStore,
  FALLBACK_APPDATA,
  DEFAULT_INSTALL_STEPS,
  getCachedAppData
} from './AppDataContext';

// 🌟 Premium Loading Screen ကို Import ခေါ်ယူခြင်း (မူလ public folder မှ logo အတိုင်း သုံးမည်) 🌟
import PremiumLoadingScreen from './pages/PremiumLoadingScreen';
import ThadingyutPopup from './components/ThadingyutPopup';

// 🌟 Resilient dynamic import with automatic retry (prevents blank white screen on flaky no-VPN Myanmar mobile data) 🌟
function importWithRetry<T>(factory: () => Promise<T>, retries = 2, delayMs = 700): Promise<T> {
  return factory().catch((err) => {
    if (retries <= 0) throw err;
    return new Promise<T>((resolve, reject) => {
      setTimeout(() => {
        importWithRetry(factory, retries - 1, delayMs * 2).then(resolve, reject);
      }, delayMs);
    });
  });
}

// 🌟 Code Splitting + Eager Preload of Active Portal Chunk (iPhone တွင် ချက်ချင်းပွင့်စေရန်) 🌟
const loadCustomerApp = () => importWithRetry(() => import('./pages/CustomerApp'));
const loadAdminApp = () => importWithRetry(() => import('./pages/AdminApp'));
const loadStaffApp = () => importWithRetry(() => import('./pages/StaffApp'));
const loadPOSScreen = () => importWithRetry(() => import('./pages/POSScreen'));
const loadThadingyutCampaign = () => importWithRetry(() => import('./pages/ThadingyutCampaign'));

const CustomerApp = lazy(loadCustomerApp);
const AdminApp = lazy(loadAdminApp);
const StaffApp = lazy(loadStaffApp);
const POSScreen = lazy(loadPOSScreen);
const ThadingyutCampaign = lazy(loadThadingyutCampaign);

const detectInitialPortalMode = (): 'customer' | 'admin' | 'staff' | 'pos' | 'campaign' => {
  if (typeof window === 'undefined') return 'customer';
  const searchParams = new URLSearchParams(window.location.search);
  const rawMode = (searchParams.get('mode') || searchParams.get('portal') || '').toLowerCase();
  const path = (window.location.pathname || '').toLowerCase();

  if (rawMode === 'staff' || path.startsWith('/staff')) return 'staff';
  if (rawMode === 'pos' || path.startsWith('/pos')) return 'pos';
  if (rawMode === 'admin' || path.startsWith('/admin')) return 'admin';
  if (rawMode === 'campaign' || path.startsWith('/campaign') || searchParams.has('campaign')) return 'campaign';
  return 'customer';
};

const getLoaderForMode = (mode: 'customer' | 'admin' | 'staff' | 'pos' | 'campaign') => {
  if (mode === 'staff') return loadStaffApp;
  if (mode === 'pos') return loadPOSScreen;
  if (mode === 'admin') return loadAdminApp;
  if (mode === 'campaign') return loadThadingyutCampaign;
  return loadCustomerApp;
};

// Preload the active portal JS bundle immediately in parallel with Firebase startup
let initialPortalPreloadPromise: Promise<unknown> | null = null;
if (typeof window !== 'undefined') {
  const bootMode = detectInitialPortalMode();
  initialPortalPreloadPromise = getLoaderForMode(bootMode)().catch(() => null);
}

const THEME = { primary: '#123524', gold: '#D4AF37', textGray: '#4a5568' };
const PREFERRED_MODE_KEY = 'shangrila_preferred_portal_mode';

// 🌟 System Settings (App Branding) မှ Logo ကို PWA Icon အဖြစ် ပြောင်းပေးမည့် Helper (Timeout ပါဝင်သဖြင့် VPN မဖွင့်လျှင်လည်း မဆိုင်းငံ့ပါ) 🌟
const generatePwaIconFromUrl = (logoUrl: string, size: number): Promise<string> => {
  return new Promise((resolve) => {
    const fallbackUrl = `${window.location.origin}/logo.png`;
    if (!logoUrl) {
      resolve(fallbackUrl);
      return;
    }

    if (logoUrl.startsWith('data:image/')) {
      resolve(logoUrl);
      return;
    }

    let settled = false;
    const finish = (val: string) => {
      if (settled) return;
      settled = true;
      resolve(val);
    };
    const timer = window.setTimeout(() => finish(fallbackUrl), 3500);

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      window.clearTimeout(timer);
      try {
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.fillStyle = '#123524';
          ctx.fillRect(0, 0, size, size);
          const minDim = Math.min(img.width, img.height);
          const sx = (img.width - minDim) / 2;
          const sy = (img.height - minDim) / 2;
          ctx.drawImage(img, sx, sy, minDim, minDim, 0, 0, size, size);
          finish(canvas.toDataURL('image/png'));
          return;
        }
      } catch {
        // Canvas CORS Error တက်ပါက မူရင်း Logo URL အစစ်ကိုသာ တိုက်ရိုက်သုံးမည်
      }
      finish(logoUrl);
    };
    img.onerror = () => {
      window.clearTimeout(timer);
      finish(logoUrl || fallbackUrl);
    };
    img.src = logoUrl;
  });
};

const clearAppCachesAndReload = async () => {
  try {
    if ('caches' in window) {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k)));
    }
    if ('serviceWorker' in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map((r) => r.unregister()));
    }
  } catch {}
  window.location.reload();
};

class ErrorBoundary extends React.Component<{ children: any }, { hasError: boolean, error: any }> {
  constructor(props: any) { super(props); this.state = { hasError: false, error: null }; }
  static getDerivedStateFromError(error: any) { return { hasError: true, error }; }
  render() {
    if (this.state.hasError) {
      const isChunkError = /loading chunk|dynamically imported module|failed to fetch/i.test(String(this.state.error || ''));
      return (
        <div className="min-h-screen bg-[#0a1f15] flex items-center justify-center p-6 text-center">
          <div className="max-w-sm w-full bg-[#123524] border border-[#D4AF37]/35 rounded-2xl p-6 shadow-2xl space-y-4">
            <img src="/logo.png" alt="The Shangri-La" className="w-16 h-16 mx-auto object-contain" />
            <h1 className="text-lg font-bold text-[#D4AF37]">
              {isChunkError ? 'App ဖိုင်များ ဆွဲယူမှု မပြည့်စုံသေးပါ' : 'App ဖွင့်ရာတွင် အမှားအယွင်း ရှိနေပါသည်'}
            </h1>
            <p className="text-xs text-gray-300 leading-relaxed">
              {isChunkError
                ? 'အင်တာနက်ချိတ်ဆက်မှု နှေးကွေးခြင်း သို့မဟုတ် Version အသစ် Update ဖြစ်နေခြင်းကြောင့် ဖြစ်နိုင်ပါသည်။ အောက်ပါခလုတ်ဖြင့် ပြန်လည်ဖွင့်ပေးပါ။'
                : 'ခေတ္တပြန်လည်ဖွင့်ပေးပါ။ ပြဿနာဆက်ရှိနေပါက Cache ရှင်းပြီး ပြန်ဖွင့်နိုင်ပါသည်။'}
            </p>
            <div className="space-y-2 pt-1">
              <button
                onClick={() => window.location.reload()}
                className="w-full min-h-[44px] px-5 py-2.5 bg-[#D4AF37] text-[#0a1f15] rounded-xl font-extrabold text-xs shadow"
              >
                ပြန်လည်ဖွင့်ရန် (Reload App)
              </button>
              <button
                onClick={clearAppCachesAndReload}
                className="w-full min-h-[40px] px-5 py-2 bg-white/10 text-gray-200 border border-white/15 rounded-xl font-bold text-xs"
              >
                Cache ရှင်းပြီး ပြန်ဖွင့်ရန်
              </button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

function MainApp() {
  const [appMode, setAppMode] = useState<'customer' | 'admin' | 'staff' | 'pos' | 'campaign'>(() => {
    const detected = detectInitialPortalMode();
    if (detected === 'admin' || detected === 'staff' || detected === 'pos') {
      try {
        if (detected === 'staff' || detected === 'pos') {
          localStorage.setItem(PREFERRED_MODE_KEY, detected);
        }
      } catch {}
      return detected;
    }
    if (detected === 'campaign') return 'campaign';

    // အကယ်၍ ဖုန်း Home Screen မှ Standalone App အဖြစ် တိုက်ရိုက်ဖွင့်ချိန် URL တွင် ?mode မပါသော်လည်း ယခင်က Staff/POS အဖြစ် သွင်းထားပါက ၎င်း Mode သို့ တိုက်ရိုက်ပို့ပေးမည်
    const isStandaloneLaunch = window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone;
    if (isStandaloneLaunch) {
      try {
        const savedMode = localStorage.getItem(PREFERRED_MODE_KEY);
        if (savedMode === 'staff' || savedMode === 'pos') {
          return savedMode;
        }
      } catch {}
    }

    return 'customer';
  });

  const [loggedInAdmin, setLoggedInAdmin] = useState<string | null>(sessionStorage.getItem('shangrila_admin'));
  const { appData, setAppData, isSlowConnection, refreshAppData } = useAppStore();

  const [isPortalChunkReady, setIsPortalChunkReady] = useState<boolean>(false);
  const [isReconnecting, setIsReconnecting] = useState<boolean>(false);
  const [hasAppUpdate, setHasAppUpdate] = useState<boolean>(false);

  const [isLoaderFinished, setIsLoaderFinished] = useState<boolean>(() => {
    const isPos = detectInitialPortalMode() === 'pos';
    return isPos;
  });
  
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isStandalone, setIsStandalone] = useState(false);
  const [isOnline, setIsOnline] = useState<boolean>(typeof navigator !== 'undefined' ? navigator.onLine : true);
  const [showInstallModal, setShowInstallModal] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);

  const isIOSDevice = typeof navigator !== 'undefined' && /iphone|ipad|ipod/i.test(navigator.userAgent || '');

  // Track active portal lazy chunk readiness so splash never fades out into a blank white screen
  useEffect(() => {
    let active = true;
    const loader =
      appMode === detectInitialPortalMode() && initialPortalPreloadPromise
        ? initialPortalPreloadPromise
        : getLoaderForMode(appMode)().catch(() => null);

    Promise.resolve(loader).finally(() => {
      if (active) setIsPortalChunkReady(true);
    });

    const chunkFallback = window.setTimeout(() => {
      if (active) setIsPortalChunkReady(true);
    }, 5000);

    return () => {
      active = false;
      window.clearTimeout(chunkFallback);
    };
  }, [appMode]);

  // Listen for Service Worker background update notifications
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;
    const onMessage = (event: MessageEvent) => {
      if (event.data?.type === 'SHANGRILA_APP_UPDATED') {
        setHasAppUpdate(true);
      }
    };
    navigator.serviceWorker.addEventListener('message', onMessage);
    return () => navigator.serviceWorker.removeEventListener('message', onMessage);
  }, []);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      refreshAppData().catch(() => {});
    };
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [refreshAppData]);

  // Notification Setup — deferred & non-blocking, only refreshes token if permission was already granted
  useEffect(() => {
    if (!navigator.onLine) return;
    if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
    const timer = window.setTimeout(async () => {
      try {
        if (typeof requestNotificationPermission === 'function') {
          const token = await requestNotificationPermission();
          if (token && db) {
            await setDoc(doc(db, 'fcm_tokens', token), {
              token: token, updatedAt: new Date(), device: navigator.userAgent
            }, { merge: true });
          }
        }
      } catch (err) {
        console.warn("Notification Error:", err);
      }
    }, 4000);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    if (window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone) { setIsStandalone(true); }
    const handleBeforeInstallPrompt = (e: any) => { e.preventDefault(); setDeferredPrompt(e); };
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
  }, []);

  const handleDownloadApp = async () => {
    try {
      if (appMode === 'staff' || appMode === 'pos') {
        localStorage.setItem(PREFERRED_MODE_KEY, appMode);
      }
    } catch {}

    if (deferredPrompt) {
      deferredPrompt.prompt(); const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') { setDeferredPrompt(null); setIsStandalone(true); }
    } else { setShowInstallModal(true); }
  };

  // Note: Telegram Business DM auto-reply polling is intentionally scoped to AdminApp only
  // to avoid Customer browsers hitting api.telegram.org (blocked without VPN in Myanmar) and causing 409 conflicts.

  // 🌟 System Settings > App Branding မှ Logo ကို Favicon, Apple Touch Icon နှင့် PWA Manifest သို့ အလိုအလျောက် ချိတ်ဆက်ခြင်း 🌟
  useEffect(() => {
    const brandName = appData?.branding?.name || "The Shangri-La";
    const isStaffMode = appMode === 'staff';
    const isPosMode = appMode === 'pos';

    document.title = isStaffMode
      ? `${brandName} | Staff Portal`
      : isPosMode
      ? `${brandName} | POS`
      : `${brandName} | Men's Retreat`;

    // System Settings (Firebase) မှ Logo ကို ဦးစားပေးယူမည်၊ မရှိသေးခင် Cache မှ ယူမည်
    const cachedLogo = localStorage.getItem('shangrila_logo_cache') || '';
    const rawLogo = appData?.branding?.logoUrl || cachedLogo || '';
    const isBrokenImgbb = rawLogo.includes('ibb.co') || rawLogo.includes('imgbb.com');
    const activeLogoUrl = (!rawLogo || isBrokenImgbb)
      ? `${window.location.origin}/logo.png`
      : rawLogo;

    // နောက်တစ်ကြိမ် Page ပြန်ဖွင့်ချိန် index.html က ချက်ချင်းဖတ်နိုင်ရန် LocalStorage တွင် အမြဲ Sync လုပ်ထားမည်
    if (appData?.branding) {
      try {
        localStorage.setItem('shangrila_branding', JSON.stringify({
          ...appData.branding,
          logoUrl: activeLogoUrl
        }));
        if (!isBrokenImgbb && rawLogo) {
          localStorage.setItem('shangrila_logo_cache', rawLogo);
        }
      } catch {}
    }

    const syncBrandingAndManifest = async () => {
      const icon192 = await generatePwaIconFromUrl(activeLogoUrl, 192);

      // 1. Browser Tab Favicon ပြောင်းလဲခြင်း
      const faviconEl = document.getElementById('app-favicon') as HTMLLinkElement | null;
      if (faviconEl) {
        faviconEl.href = icon192;
      } else {
        const newIcon = document.createElement('link');
        newIcon.id = 'app-favicon';
        newIcon.rel = 'icon';
        newIcon.type = 'image/png';
        newIcon.href = icon192;
        document.head.appendChild(newIcon);
      }

      // 2. macOS Safari (Add to Dock) & iOS (Add to Home Screen) အတွက် Data URI မသုံးဘဲ တိုက်ရိုက် Logo URL သုံးရန်
      const appleIconEl = document.getElementById('app-apple-icon') as HTMLLinkElement | null;
      if (appleIconEl) {
        appleIconEl.href = activeLogoUrl;
      }

      // 3. Open Graph (og:image) ကိုပါ လက်ရှိ Branding Logo နှင့် ညှိပေးခြင်း
      const ogImageEl = document.querySelector('meta[property="og:image"]') as HTMLMetaElement | null;
      if (ogImageEl && activeLogoUrl.startsWith('http')) {
        ogImageEl.content = activeLogoUrl;
      }

      // 4. Static Portal Manifest ချိတ်ဆက်ခြင်း (iOS Safari သည် blob: manifest ကို လက်မခံသဖြင့် Static JSON Manifest ကိုသာ အမြဲသုံးမည်)
      const isAdminMode = appMode === 'admin';
      const targetManifestHref = isStaffMode
        ? '/manifest-staff.json'
        : isPosMode
        ? '/manifest-pos.json'
        : isAdminMode
        ? '/manifest-admin.json'
        : '/manifest.json';

      const manifestEl = document.getElementById('app-manifest') as HTMLLinkElement | null;
      if (manifestEl) {
        if (manifestEl.getAttribute('href') !== targetManifestHref) {
          manifestEl.setAttribute('href', targetManifestHref);
        }
      } else {
        const newManifest = document.createElement('link');
        newManifest.id = 'app-manifest';
        newManifest.rel = 'manifest';
        newManifest.href = targetManifestHref;
        document.head.appendChild(newManifest);
      }

      // 5. iOS Safari Home Screen App Title Sync
      const appleTitleEl = document.getElementById('app-apple-title') as HTMLMetaElement | null;
      if (appleTitleEl) {
        appleTitleEl.content = isStaffMode
          ? 'SL Staff'
          : isPosMode
          ? 'SL POS'
          : isAdminMode
          ? 'SL Admin'
          : 'Shangri-La';
      }
      // 6. Sync browser/iOS theme-color + html/body solid background with active portal so iOS 26 status bar never shows a mismatched blur band
      const activeSurfaceColor = !isLoaderFinished && appMode !== 'pos'
        ? '#0a1f15'
        : isPosMode
        ? '#123524'
        : '#ffffff';
      const themeMeta = document.querySelector('meta[name="theme-color"]') as HTMLMetaElement | null;
      if (themeMeta) {
        themeMeta.content = activeSurfaceColor;
      }
      document.documentElement.style.backgroundColor = activeSurfaceColor;
      document.body.style.backgroundColor = activeSurfaceColor;
    };

    syncBrandingAndManifest();
  }, [appData?.branding, appMode, isLoaderFinished]);

  // 🌟 REAL-TIME CAMPAIGN & POPUP LOCKOUT GUARD (Admin မှ ပိတ်ထားလျှင် customer mode သို့ အလိုအလျောက် ပြန်ပို့မည်) 🌟
  useEffect(() => {
    const promo: any = appData?.promotion;
    if (!promo) return;

    const now = new Date();
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const isDateExpired = Boolean(promo.endDate && todayStr > promo.endDate);

    const isExplicitlyOff =
      promo.allOff === true ||
      promo.isPopupActive === false ||
      promo.isActive === false ||
      promo.popupEnabled === false ||
      promo.miniGamePopup === false ||
      isDateExpired;

    if (isExplicitlyOff && appMode === 'campaign') {
      setAppMode('customer');
      const cleanUrl = window.location.origin + window.location.pathname;
      window.history.replaceState({}, document.title, cleanUrl);
    }
  }, [appData?.promotion, appMode]);

  useEffect(() => {
    // Fast safety deadlines so slow Myanmar no-VPN routes never leave users waiting on the splash screen
    const dataSafetyTimer = setTimeout(() => {
      setAppData((prev) => prev || getCachedAppData() || FALLBACK_APPDATA);
    }, 3800);
    const loaderSafetyTimer = setTimeout(() => {
      setIsLoaderFinished(true);
    }, 5800);

    if (navigator.onLine) {
      signInAnonymously(auth).catch((error) => { console.warn("Firebase Auth Warning:", error); });
    }

    return () => {
      clearTimeout(dataSafetyTimer);
      clearTimeout(loaderSafetyTimer);
    };
  }, [setAppData]);

  useEffect(() => {
    const interval = setInterval(() => {
       const sessionAdmin = sessionStorage.getItem('shangrila_admin');
       if (sessionAdmin !== loggedInAdmin) setLoggedInAdmin(sessionAdmin);
    }, 1000);
    return () => clearInterval(interval);
  }, [loggedInAdmin]);

  const showLoadingOverlay = !isLoaderFinished && appMode !== 'pos';
  const safeAppData = appData || FALLBACK_APPDATA;
  const stepsToShow = safeAppData.installSteps && safeAppData.installSteps.length > 0 ? safeAppData.installSteps : DEFAULT_INSTALL_STEPS;

  const isFullScreenMode = appMode === 'pos' || appMode === 'campaign' || (appMode === 'admin' && Boolean(loggedInAdmin));

  // 🌟 Admin မှ All OFF သို့မဟုတ် Popup ပိတ်ထားခြင်း ရှိမရှိ စစ်ဆေးခြင်း 🌟
  const promoSettings: any = safeAppData?.promotion;
  const isGlobalPopupAllowed = Boolean(
    promoSettings &&
    promoSettings.allOff !== true &&
    promoSettings.isPopupActive !== false &&
    promoSettings.isActive !== false &&
    promoSettings.popupEnabled !== false &&
    promoSettings.miniGamePopup !== false
  );

  const statusBarBgColor = showLoadingOverlay ? '#0a1f15' : appMode === 'pos' ? '#123524' : '#ffffff';

  return (
    <div className="min-h-screen bg-gray-50 text-gray-800 font-sans flex flex-col relative">
      {/* 🌟 Solid real DOM status-bar backing plate at top:0 for iOS 26 Standalone PWA WebKit color sampling 🌟 */}
      <div
        aria-hidden="true"
        className="fixed top-0 left-0 right-0 pointer-events-none z-[185] transition-colors duration-300"
        style={{
          height: 'env(safe-area-inset-top, 0px)',
          backgroundColor: statusBarBgColor,
        }}
      />

      {/* 🌟 Premium Loading Screen Overlay (Portal chunk & data ready ဖြစ်မှ Fade out လုပ်သဖြင့် အဖြူ Screen လုံးဝမပေါ်ပါ) 🌟 */}
      {showLoadingOverlay && (
        <PremiumLoadingScreen
          isDataReady={!!appData && isPortalChunkReady}
          onFinish={() => setIsLoaderFinished(true)}
        />
      )}

      {/* 🌟 Promotion Popup (Customer Mode Only & When Allowed by Admin, after Loader finishes) 🌟 */}
      {!showLoadingOverlay && appMode === 'customer' && isGlobalPopupAllowed && safeAppData && <ThadingyutPopup appData={safeAppData} />}

      {showInstallModal && (
        <div className="fixed inset-0 z-[200] bg-black/80 flex items-center justify-center p-4" onClick={() => setShowInstallModal(false)}>
          <div className="bg-white rounded-2xl w-full max-w-sm overflow-hidden animate-fade-in shadow-2xl" onClick={(e) => e.stopPropagation()}>
             <div className="p-4 bg-[#123524] flex justify-between items-center text-white">
               <h3 className="font-bold flex items-center">
                 <Download className="w-4 h-4 mr-2 text-[#D4AF37]"/>
                 {appMode === 'staff' ? 'Install Staff App' : appMode === 'pos' ? 'Install POS App' : 'Install App'}
               </h3>
               <button onClick={() => setShowInstallModal(false)} className="hover:bg-white/20 p-1 rounded-full"><X className="w-5 h-5"/></button>
             </div>
             <div className="p-5 max-h-[75vh] overflow-y-auto space-y-4">
                {isIOSDevice && (
                  <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3.5 text-left space-y-1.5">
                    <div className="text-xs font-extrabold text-[#123524]">iPhone / iPad (Safari) အတွက် လမ်းညွှန်</div>
                    <p className="text-[11px] text-gray-700 leading-relaxed">
                      ၁။ ဤ Link ကို <strong>Safari Browser</strong> ဖြင့် တိုက်ရိုက်ဖွင့်ပါ (Viber / Telegram / Messenger အတွင်းမှ မသွင်းပါနှင့်)။<br/>
                      ၂။ Safari အောက်ခြေရှိ <strong>Share (⬆️)</strong> ခလုတ်ကို နှိပ်ပါ။<br/>
                      ၃။ <strong>"Add to Home Screen"</strong> ကို ရွေးပြီး အမည်တွင် <strong>"{appMode === 'staff' ? 'SL Staff' : appMode === 'pos' ? 'SL POS' : 'Shangri-La'}"</strong> ပေါ်နေကြောင်း စစ်ဆေးပြီး <strong>Add</strong> နှိပ်ပါ။
                    </p>
                  </div>
                )}
                <div className="text-center text-sm font-bold text-gray-700 mb-2">အောက်ပါ အဆင့်များအတိုင်း လုပ်ဆောင်ပေးပါ</div>
                {stepsToShow.map((step, idx) => (
                   <div key={step.id || idx} className="bg-gray-50 p-3 rounded-lg border border-gray-200 shadow-sm"><p className="text-xs font-bold mb-2 leading-relaxed text-gray-800">{idx + 1}။ {step.text}</p>{step.imageUrl && <img src={step.imageUrl} alt={`Step ${idx + 1}`} className="w-full rounded border border-gray-200" />}</div>
                ))}
                <button onClick={() => setShowInstallModal(false)} className="w-full py-3 bg-[#D4AF37] text-white font-bold rounded-lg mt-4 hover:bg-yellow-600 transition shadow-md">နားလည်ပါပြီ</button>
             </div>
          </div>
        </div>
      )}

      {!isOnline && (
        <div
          className="fixed bottom-4 left-4 z-[180] flex items-center gap-2 rounded-full bg-amber-600/95 text-white px-3.5 py-1.5 text-[11px] font-bold shadow-lg border border-amber-300/60 backdrop-blur-sm"
          style={{ marginBottom: 'env(safe-area-inset-bottom)' }}
        >
          <WifiOff className="w-3.5 h-3.5 flex-shrink-0" />
          <span>Offline Mode — Cached data</span>
        </div>
      )}

      {isOnline && isSlowConnection && (
        <button
          type="button"
          disabled={isReconnecting}
          onClick={async () => {
            setIsReconnecting(true);
            try {
              await reconnectFirestoreNetwork(true);
              await refreshAppData();
            } finally {
              setIsReconnecting(false);
            }
          }}
          className="fixed bottom-4 left-4 z-[180] flex items-center gap-2 rounded-full bg-[#0B2419]/95 text-[#D4AF37] px-3.5 py-2 text-[11px] font-bold shadow-lg border border-[#D4AF37]/40 backdrop-blur-sm"
          style={{ marginBottom: 'env(safe-area-inset-bottom)' }}
        >
          <RefreshCw className={`w-3.5 h-3.5 flex-shrink-0 ${isReconnecting ? 'animate-spin' : ''}`} />
          <span>{isReconnecting ? 'Server ချိတ်ဆက်နေပါသည်...' : 'Cached Mode — ပြန်ချိတ်ရန် နှိပ်ပါ'}</span>
        </button>
      )}

      {hasAppUpdate && (
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="fixed bottom-4 right-4 z-[180] flex items-center gap-2 rounded-full bg-[#123524] text-[#D4AF37] px-4 py-2 text-[11px] font-extrabold shadow-xl border border-[#D4AF37]/50"
          style={{ marginBottom: 'env(safe-area-inset-bottom)' }}
        >
          <RefreshCw className="w-3.5 h-3.5 flex-shrink-0" />
          <span>Update အသစ်ရပါပြီ — ဖွင့်မည်</span>
        </button>
      )}

      {!isFullScreenMode && (
        <header 
          className="sticky top-0 z-[100] w-full transition-all duration-300 border-b border-gray-200 flex flex-col items-center justify-center bg-white shadow-sm px-4 text-center"
          style={{ 
            backgroundColor: '#ffffff',
            paddingTop: isScrolled
              ? 'calc(0.65rem + env(safe-area-inset-top, 0px) + var(--ios-top-clearance, 0px))'
              : 'calc(1.25rem + env(safe-area-inset-top, 0px) + var(--ios-top-clearance, 0px))',
            paddingBottom: isScrolled ? '0.65rem' : '1.35rem'
          }}
        >
          <div className="flex items-center justify-center mb-1 transition-all duration-300">
            {safeAppData.branding?.logoUrl && (
              <div className={`rounded-full overflow-hidden mr-2.5 sm:mr-3 border-2 shadow-sm flex-shrink-0 transition-all duration-300 ${isScrolled ? 'w-8 h-8 border-[1px]' : 'w-12 h-12 sm:w-14 sm:h-14 border-2'}`} style={{ borderColor: THEME.gold }}>
                <img src={safeAppData.branding.logoUrl} alt="Logo" className="w-full h-full object-cover bg-white" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
              </div>
            )}
            <h1 className={`font-bold font-serif tracking-wide transition-all duration-300 ${isScrolled ? 'text-lg sm:text-xl' : 'text-2xl'}`} style={{ color: THEME.primary }}>{safeAppData.branding?.name || 'The Shangri-La'}</h1>
          </div>
          
          <p className={`font-bold uppercase tracking-[0.2em] transition-all duration-300 overflow-hidden ${isScrolled ? 'h-0 opacity-0 m-0' : 'h-auto opacity-100 text-[10px] sm:text-[11px] mt-1.5'}`} style={{ color: THEME.gold }}>Men's Retreat (Beyond Relaxation)</p>
          
          {!isStandalone && (appMode === 'customer' || appMode === 'staff') && (
             <button onClick={handleDownloadApp} className={`transition-all duration-300 font-bold text-white flex items-center justify-center bg-gradient-to-r from-[#D4AF37] to-yellow-600 rounded-full shadow-sm border border-yellow-500 hover:opacity-90 ${isScrolled ? 'absolute right-3 sm:right-6 text-[9px] px-2.5 py-1.5' : 'mt-4 text-[10px] sm:text-xs px-4 py-2'}`} style={{ top: isScrolled ? 'calc(0.65rem + env(safe-area-inset-top, 0px) + var(--ios-top-clearance, 0px))' : 'auto' }}>
               <Download className={`${isScrolled ? 'w-3 h-3 mr-1' : 'w-3.5 h-3.5 mr-1.5'}`} /> {isScrolled ? 'App' : appMode === 'staff' ? 'Install Staff App' : 'Download App'}
             </button>
          )}
          {appMode === 'admin' && loggedInAdmin && (
             <button onClick={() => { setLoggedInAdmin(null); sessionStorage.removeItem('shangrila_admin'); }} className={`absolute right-4 sm:right-6 text-xs font-bold text-red-500 flex items-center bg-red-50 rounded-full hover:bg-red-100 transition border border-red-100 ${isScrolled ? 'px-2 py-1' : 'px-3 py-1.5'}`} style={{ top: isScrolled ? 'calc(0.65rem + env(safe-area-inset-top, 0px) + var(--ios-top-clearance, 0px))' : 'calc(1.25rem + env(safe-area-inset-top, 0px) + var(--ios-top-clearance, 0px))' }}><LogOut className="w-3 h-3 mr-1" /> Logout</button>
          )}
        </header>
      )}

      {/* 🌟 MAIN CONTENT AREA 🌟 */}
      <main className={`flex-1 w-full mx-auto ${isFullScreenMode ? 'max-w-full p-0' : 'max-w-4xl p-4 py-6'}`}>
        <Suspense fallback={<div className="text-center py-20 font-bold text-[#123524] flex flex-col items-center"><div className="w-10 h-10 border-4 border-[#123524] border-t-[#D4AF37] rounded-full animate-spin mb-4"></div>Loading App Module...</div>}>
            {appMode === 'admin' ? (
              <AdminApp appData={safeAppData} onSettingsUpdated={setAppData} />
            ) : appMode === 'staff' ? (
              <StaffApp />
            ) : appMode === 'pos' ? (
              <POSScreen appData={safeAppData} />
            ) : appMode === 'campaign' ? (
              <ThadingyutCampaign appData={safeAppData} />
            ) : (
              <CustomerApp appData={safeAppData} />
            )}
        </Suspense>
      </main>

      {!isFullScreenMode && appMode !== 'admin' && (
        <footer className="bg-white border-t border-gray-200 mt-10 py-8 text-center text-sm text-gray-500 px-4">
          <h3 className="font-bold text-base mb-3" style={{ color: THEME.primary }}>{safeAppData.branding?.name || 'The Shangri-La'} Men's Retreat</h3>
          <div className="mb-2 flex items-start justify-center text-xs sm:text-sm max-w-xs sm:max-w-md mx-auto"><MapPin className="w-4 h-4 mr-1.5 mt-0.5 flex-shrink-0" /><span className="text-left sm:text-center leading-relaxed">{safeAppData.branding?.address}</span></div>
          <div className="mb-4 flex items-start justify-center text-xs sm:text-sm max-w-xs sm:max-w-md mx-auto"><Phone className="w-4 h-4 mr-1.5 mt-0.5 flex-shrink-0" /><span className="text-left sm:text-center leading-relaxed">{safeAppData.branding?.phone1} &nbsp;|&nbsp; {safeAppData.branding?.phone2}</span></div>
          <p className="text-xs text-gray-400 mt-4">{safeAppData.branding?.copyright}</p>
        </footer>
      )}
    </div>
  );
}

export default function App() { return <ErrorBoundary><MainApp /></ErrorBoundary>; }
