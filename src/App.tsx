import React, { useState, useEffect, Suspense, lazy } from 'react';
import { doc, setDoc } from 'firebase/firestore';
import { signInAnonymously } from 'firebase/auth';
import { db, auth, requestNotificationPermission } from './firebase';
import { Download, X, MapPin, Phone, LogOut } from 'lucide-react';
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

// 🌟 Code Splitting: Portal အားလုံးကို Lazy Load လုပ်ထားသဖြင့် Initial Bundle အလွန်သေးငယ်ပြီး PremiumLoadingScreen ချက်ချင်းပေါ်မည် 🌟
const CustomerApp = lazy(() => import('./pages/CustomerApp'));
const AdminApp = lazy(() => import('./pages/AdminApp'));
const StaffApp = lazy(() => import('./pages/StaffApp'));
const POSScreen = lazy(() => import('./pages/POSScreen'));
const ThadingyutCampaign = lazy(() => import('./pages/ThadingyutCampaign'));

const THEME = { primary: '#123524', gold: '#D4AF37', textGray: '#4a5568' };
const PREFERRED_MODE_KEY = 'shangrila_preferred_portal_mode';

// 🌟 System Settings (App Branding) မှ Logo ကို PWA Icon အဖြစ် ပြောင်းပေးမည့် Helper (CORS ဖြစ်လျှင်လည်း S မပေါ်ဘဲ Logo အစစ်ကိုသာ ပြန်ပေးမည်) 🌟
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

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
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
          resolve(canvas.toDataURL('image/png'));
          return;
        }
      } catch {
        // Canvas CORS Error တက်ပါက S အက္ခရာ မထုတ်ဘဲ မူရင်း Logo URL အစစ်ကိုသာ တိုက်ရိုက်သုံးမည်
      }
      resolve(logoUrl);
    };
    img.onerror = () => resolve(logoUrl || fallbackUrl);
    img.src = logoUrl;
  });
};

class ErrorBoundary extends React.Component<{ children: any }, { hasError: boolean, error: any }> {
  constructor(props: any) { super(props); this.state = { hasError: false, error: null }; }
  static getDerivedStateFromError(error: any) { return { hasError: true, error }; }
  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-red-50 flex items-center justify-center p-10 text-center">
          <div><h1 className="text-3xl font-bold text-red-600 mb-4">App Crashed ⚠️</h1><p className="text-gray-700 font-mono text-sm bg-white p-4 rounded shadow">{this.state.error?.toString()}</p><button onClick={() => window.location.reload()} className="mt-6 px-6 py-3 bg-[#123524] text-white rounded-lg font-bold">Reload App</button></div>
        </div>
      );
    }
    return this.props.children;
  }
}

function MainApp() {
  const [appMode, setAppMode] = useState<'customer' | 'admin' | 'staff' | 'pos' | 'campaign'>(() => {
    const searchParams = new URLSearchParams(window.location.search);
    const mode = searchParams.get('mode');
    
    if (mode === 'admin' || mode === 'staff' || mode === 'pos') {
      try {
        // ဝန်ထမ်း သို့မဟုတ် POS အဖြစ် ဝင်ရောက်ပါက PWA Standalone ပြန်ဖွင့်ချိန်တွင် မှတ်မိစေရန် သိမ်းထားမည်
        if (mode === 'staff' || mode === 'pos') {
          localStorage.setItem(PREFERRED_MODE_KEY, mode);
        }
      } catch {}
      return mode;
    }
    if (mode === 'campaign') return 'campaign';

    // အကယ်၍ ဖုန်း Home Screen မှ Standalone App အဖြစ် တိုက်ရိုက်ဖွင့်ချိန် URL တွင် ?mode မပါသော်လည်း ယခင်က Staff/POS အဖြစ် သွင်းထားပါက ၎င်း Mode သို့ တိုက်ရိုက်ပို့ပေးမည်
    const isStandaloneLaunch = window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone;
    if (isStandaloneLaunch && !mode) {
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
  const { appData, setAppData } = useAppStore();

  const [isLoaderFinished, setIsLoaderFinished] = useState<boolean>(() => {
    const isPos = window.location.search.includes('mode=pos');
    return isPos || !navigator.onLine;
  });
  
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isStandalone, setIsStandalone] = useState(false);
  const [showInstallModal, setShowInstallModal] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);

  // Notification Setup
  useEffect(() => {
    if (!navigator.onLine) return;
    const setupNotifications = async () => {
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
    };
    setupNotifications();
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
      const [icon192, icon512] = await Promise.all([
        generatePwaIconFromUrl(activeLogoUrl, 192),
        generatePwaIconFromUrl(activeLogoUrl, 512)
      ]);

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

      // 4. Dynamic PWA Manifest တည်ဆောက်ခြင်း (Xiaomi/Redmi Launcher များအတွက် 'any' purpose သီးသန့်သုံးမည်)
      const startUrl = isStaffMode
        ? `${window.location.origin}/?mode=staff`
        : isPosMode
        ? `${window.location.origin}/?mode=pos`
        : `${window.location.origin}/`;

      const dynamicManifest = {
        id: isStaffMode ? '/?mode=staff' : isPosMode ? '/?mode=pos' : '/',
        short_name: isStaffMode ? 'SL Staff' : isPosMode ? 'SL POS' : 'Shangri-La',
        name: isStaffMode
          ? `${brandName} - Staff Portal`
          : isPosMode
          ? `${brandName} - POS System`
          : `${brandName} Men's Retreat`,
        description: "The Shangri-La Men's Retreat - Beyond Relaxation",
        start_url: startUrl,
        scope: `${window.location.origin}/`,
        display: 'standalone',
        orientation: 'portrait',
        theme_color: '#123524',
        background_color: '#123524',
        icons: [
          {
            src: icon192,
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any'
          },
          {
            src: icon512,
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any'
          }
        ]
      };

      try {
        const manifestJson = JSON.stringify(dynamicManifest);
        const blob = new Blob([manifestJson], { type: 'application/manifest+json' });
        const manifestUrl = URL.createObjectURL(blob);
        
        const manifestEl = document.getElementById('app-manifest') as HTMLLinkElement | null;
        if (manifestEl) {
          manifestEl.href = manifestUrl;
        } else {
          const newManifest = document.createElement('link');
          newManifest.id = 'app-manifest';
          newManifest.rel = 'manifest';
          newManifest.href = manifestUrl;
          document.head.appendChild(newManifest);
        }
      } catch (e) {
        console.warn('Dynamic manifest update warning:', e);
      }
    };

    syncBrandingAndManifest();
  }, [appData?.branding, appMode]);

  // 🌟 REAL-TIME CAMPAIGN & POPUP LOCKOUT GUARD (Admin မှ ပိတ်ထားလျှင် customer mode သို့ အလိုအလျောက် ပြန်ပို့မည်) 🌟
  useEffect(() => {
    const promo: any = appData?.promotion;
    if (!promo) return;

    const isExplicitlyOff =
      promo.allOff === true ||
      promo.isPopupActive === false ||
      promo.isActive === false ||
      promo.popupEnabled === false ||
      promo.miniGamePopup === false;

    if (isExplicitlyOff && appMode === 'campaign') {
      setAppMode('customer');
      const cleanUrl = window.location.origin + window.location.pathname;
      window.history.replaceState({}, document.title, cleanUrl);
    }
  }, [appData?.promotion, appMode]);

  useEffect(() => {
    const dataSafetyTimer = setTimeout(() => {
      setAppData((prev) => prev || getCachedAppData() || FALLBACK_APPDATA);
    }, 2500);
    const loaderSafetyTimer = setTimeout(() => {
      setIsLoaderFinished(true);
    }, 4500);

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

  const isFullScreenMode = appMode === 'pos' || appMode === 'campaign';

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

  return (
    <div className="min-h-screen bg-gray-50 text-gray-800 font-sans flex flex-col relative">
      {/* 🌟 Premium Loading Screen Overlay (Fade out ဖြစ်ချိန်တွင် အဖြူ Screen မပေါ်ဘဲ အောက်ခံ App တိုက်ရိုက်ပေါ်လာမည်) 🌟 */}
      {showLoadingOverlay && (
        <PremiumLoadingScreen
          isDataReady={!!appData}
          onFinish={() => setIsLoaderFinished(true)}
        />
      )}

      {/* 🌟 Promotion Popup (Customer Mode Only & When Allowed by Admin, after Loader finishes) 🌟 */}
      {!showLoadingOverlay && appMode === 'customer' && isGlobalPopupAllowed && safeAppData && <ThadingyutPopup appData={safeAppData} />}

      {showInstallModal && (
        <div className="fixed inset-0 z-[200] bg-black/80 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm overflow-hidden animate-fade-in shadow-2xl">
             <div className="p-4 bg-[#123524] flex justify-between items-center text-white"><h3 className="font-bold flex items-center"><Download className="w-4 h-4 mr-2"/> Install App</h3><button onClick={() => setShowInstallModal(false)} className="hover:bg-white/20 p-1 rounded-full"><X className="w-5 h-5"/></button></div>
             <div className="p-5 max-h-[75vh] overflow-y-auto space-y-4">
                <div className="text-center text-sm font-bold text-gray-700 mb-4">အောက်ပါ အဆင့်များအတိုင်း လုပ်ဆောင်ပေးပါ</div>
                {stepsToShow.map((step, idx) => (
                   <div key={step.id || idx} className="bg-gray-50 p-3 rounded-lg border border-gray-200 shadow-sm"><p className="text-xs font-bold mb-2 leading-relaxed text-gray-800">{idx + 1}။ {step.text}</p>{step.imageUrl && <img src={step.imageUrl} alt={`Step ${idx + 1}`} className="w-full rounded border border-gray-200" />}</div>
                ))}
                <button onClick={() => setShowInstallModal(false)} className="w-full py-3 bg-[#D4AF37] text-white font-bold rounded-lg mt-4 hover:bg-yellow-600 transition shadow-md">နားလည်ပါပြီ</button>
             </div>
          </div>
        </div>
      )}

      {!isFullScreenMode && (
        <header 
          className={`sticky top-0 z-[100] w-full transition-all duration-300 border-b border-gray-200 flex flex-col items-center justify-center ${isScrolled ? 'bg-white/95 backdrop-blur-md shadow-sm' : 'bg-white shadow-sm'} px-4 text-center`}
          style={{ 
            paddingTop: isScrolled ? 'calc(0.5rem + env(safe-area-inset-top))' : 'calc(1.5rem + env(safe-area-inset-top))',
            paddingBottom: isScrolled ? '0.5rem' : '1.5rem'
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
             <button onClick={handleDownloadApp} className={`transition-all duration-300 font-bold text-white flex items-center justify-center bg-gradient-to-r from-[#D4AF37] to-yellow-600 rounded-full shadow-sm border border-yellow-500 hover:opacity-90 ${isScrolled ? 'absolute right-3 sm:right-6 text-[9px] px-2.5 py-1.5' : 'mt-4 text-[10px] sm:text-xs px-4 py-2'}`} style={{ top: isScrolled ? 'calc(0.5rem + env(safe-area-inset-top))' : 'auto' }}>
               <Download className={`${isScrolled ? 'w-3 h-3 mr-1' : 'w-3.5 h-3.5 mr-1.5'}`} /> {isScrolled ? 'App' : appMode === 'staff' ? 'Install Staff App' : 'Download App'}
             </button>
          )}
          {appMode === 'admin' && loggedInAdmin && (
             <button onClick={() => { setLoggedInAdmin(null); sessionStorage.removeItem('shangrila_admin'); }} className={`absolute right-4 sm:right-6 text-xs font-bold text-red-500 flex items-center bg-red-50 rounded-full hover:bg-red-100 transition border border-red-100 ${isScrolled ? 'px-2 py-1' : 'px-3 py-1.5'}`} style={{ top: isScrolled ? 'calc(0.5rem + env(safe-area-inset-top))' : 'calc(1.5rem + env(safe-area-inset-top))' }}><LogOut className="w-3 h-3 mr-1" /> Logout</button>
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
