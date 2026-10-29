import React, { useState, useEffect, Suspense, lazy } from 'react';
import { doc, getDoc, collection, getDocs, query, orderBy, setDoc } from 'firebase/firestore';
import { signInAnonymously } from 'firebase/auth'; 
import { db, auth, requestNotificationPermission } from './firebase'; 
import { Download, X, MapPin, Phone, LogOut } from 'lucide-react';
import { AppData, TherapistProfile, MenuCategory, PaymentMethod, AppBranding, PromotionSettings, InstallStep } from './shared';

// 🌟 Premium Loading Screen ကို Import ခေါ်ယူခြင်း 🌟
import PremiumLoadingScreen from './pages/PremiumLoadingScreen';
import CustomerApp from './pages/CustomerApp'; 

// 🌟 POS နှင့် Campaign Screen များကို Import ခေါ်ယူခြင်း 🌟
import POSScreen from './pages/POSScreen';
import ThadingyutCampaign from './pages/ThadingyutCampaign';
import ThadingyutPopup from './components/ThadingyutPopup';

const AdminApp = lazy(() => import('./pages/AdminApp'));
const StaffApp = lazy(() => import('./pages/StaffApp'));

const THEME = { primary: '#123524', gold: '#D4AF37', textGray: '#4a5568' };
const CACHED_APPDATA_KEY = 'shangrila_pos_cached_appdata_lite_v2';

const DEFAULT_BRANDING: AppBranding = {
  logoUrl: '', name: "The Shangri-La", address: "33th(B) St, Between 65th & 65th(A) Sts, Mandalay",
  phone1: "09-458884517", phone2: "09-770072190", copyright: "© 2026 The Shangri-La Men's Retreat."
};
const DEFAULT_PAYMENT_METHODS: PaymentMethod[] = [{ id: 'p1', name: 'KBZ PAY', accountNumber: '09458888510', accountName: 'Htet Naing Kyaw', logoUrl: '' }];
const DEFAULT_THERAPISTS: TherapistProfile[] = Array.from({ length: 15 }, (_, i) => ({ id: `t_${i}`, name: `Therapist No-${i + 1}`, images: [], order: i, password: '' }));
const DEFAULT_PROMOTION: PromotionSettings = { isActive: false, hotelDiscountPercent: 10, otherDiscountPercent: 20, startDate: '', endDate: '' };

const DEFAULT_CATEGORIES: MenuCategory[] = [
  { 
    id: 'massage', title: 'Massage', 
    items: [
      { id: 'm1', name: 'Traditional Massage', price: 25000, duration: '60 Mins' },
      { id: 'm2', name: 'Aroma Oil Massage', price: 35000, duration: '60 Mins' },
      { id: 'm3', name: 'Deep Tissue Sport Massage', price: 40000, duration: '90 Mins' },
      { id: 'm4', name: 'Special VIP Package', price: 60000, duration: '120 Mins' }
    ] 
  },
  { 
    id: 'hotel', title: 'Hotel & Home Services', 
    items: [
      { id: 'h1', name: 'Part Time Outcall Service', price: 70000, duration: '100 Mins' },
      { id: 'h2', name: 'VVIP Master Room', price: 90000, duration: '120 Mins' }
    ] 
  }
];

const DEFAULT_INSTALL_STEPS: InstallStep[] = [
   { id: '1', text: 'Browser ၏ Menu (⋮) သို့မဟုတ် Share icon ကိုနှိပ်ပါ။', imageUrl: '' },
   { id: '2', text: '"Add to Home Screen" ကို ရွေးချယ်ပါ။', imageUrl: '' },
   { id: '3', text: '"Add" ကို နှိပ်ပါ။ ဖုန်း Screen တွင် App အဖြစ် ရောက်ရှိသွားပါမည်။', imageUrl: '' }
];

const FALLBACK_APPDATA: AppData = {
  categories: DEFAULT_CATEGORIES,
  therapists: DEFAULT_THERAPISTS,
  branding: DEFAULT_BRANDING,
  paymentMethods: DEFAULT_PAYMENT_METHODS,
  promotion: DEFAULT_PROMOTION,
  installSteps: DEFAULT_INSTALL_STEPS
};

// LocalStorage မှ သိမ်းထားသော Cache Data ကို ချက်ချင်း ဆွဲထုတ်မည့် Helper Function
const getInitialAppData = (): AppData | null => {
  try {
    const cached = localStorage.getItem(CACHED_APPDATA_KEY);
    if (cached) {
      const parsed = JSON.parse(cached);
      if (parsed && parsed.categories?.length > 0) return parsed;
    }
  } catch {}
  // Offline ဖြစ်နေပါက သို့မဟုတ် POS mode ဖြစ်နေပါက Fallback Data ဖြင့် ချက်ချင်း ပွင့်စေမည်
  const isPos = window.location.search.includes('mode=pos');
  if (!navigator.onLine || isPos) {
    return FALLBACK_APPDATA;
  }
  return null;
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
  // 🌟 URL မှ Mode ကို စဖွင့်ဖွင့်ချင်း ချက်ချင်း ဖတ်ယူမည် (Admin မှ ပိတ်ထားပါက campaign mode သို့ ဝင်ခွင့်မပြုပါ) 🌟
  const [appMode, setAppMode] = useState<'customer' | 'admin' | 'staff' | 'pos' | 'campaign'>(() => {
    const searchParams = new URLSearchParams(window.location.search);
    const mode = searchParams.get('mode');
    
    // POS နှင့် Admin / Staff တို့အတွက် သီးသန့်ခွင့်ပြုမည်
    if (mode === 'admin' || mode === 'staff' || mode === 'pos') return mode;

    // အကယ်၍ mode=campaign ဖြင့် ဝင်လာပါက appData ရှိ promotion အခြေအနေကို ကြိုတင်စစ်ဆေးမည်
    if (mode === 'campaign') {
      const cached = localStorage.getItem(CACHED_APPDATA_KEY);
      if (cached) {
        try {
          const parsed = JSON.parse(cached);
          const isPromoLive = Boolean(parsed?.promotion?.isPopupActive || parsed?.promotion?.isActive);
          if (isPromoLive) return 'campaign';
        } catch {}
      }
      // မပွင့်ရသေးပါက customer mode သို့ ပြန်ပို့မည်
      return 'customer';
    }

    return 'customer';
  });

  const [loggedInAdmin, setLoggedInAdmin] = useState<string | null>(sessionStorage.getItem('shangrila_admin'));
  const [appData, setAppData] = useState<AppData | null>(() => getInitialAppData());

  // 🌟 POS Mode သို့မဟုတ် Offline ဖြစ်နေပါက Loading Screen ကို လုံးဝကျော်သွားမည် 🌟
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
    if (deferredPrompt) {
      deferredPrompt.prompt(); const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') { setDeferredPrompt(null); setIsStandalone(true); }
    } else { setShowInstallModal(true); }
  };

  useEffect(() => {
    document.title = appData?.branding?.name ? `${appData.branding.name} | Men's Retreat` : "The Shangri-La | Men's Retreat";
    const updateFavicon = (url: string) => {
      const existingIcons = document.querySelectorAll("link[rel*='icon'], link[rel='apple-touch-icon']"); 
      existingIcons.forEach(icon => document.head.removeChild(icon));
      
      const newIcon = document.createElement('link'); newIcon.rel = 'shortcut icon'; newIcon.type = 'image/png'; newIcon.href = url; document.head.appendChild(newIcon);
      const appleIcon = document.createElement('link'); appleIcon.rel = 'apple-touch-icon'; appleIcon.href = url; document.head.appendChild(appleIcon);
    };
    if (appData?.branding?.logoUrl) { 
        updateFavicon(appData.branding.logoUrl); 
        try { localStorage.setItem('shangrila_logo_cache', appData.branding.logoUrl); } catch {}
    }
  }, [appData?.branding?.logoUrl, appData?.branding?.name]);

  // 🌟 FIX: အင်တာနက်လိုင်း လေးနေလျှင် ၂.၅ စက္ကန့်ထက် ပိုမစောင့်ဘဲ Cache/Fallback Data ဖြင့် Loading ကို ချက်ချင်း ဖွင့်ပေးမည် 🌟
  useEffect(() => {
    const safetyTimer = setTimeout(() => {
      setAppData((prev) => prev || getInitialAppData() || FALLBACK_APPDATA);
      setIsLoaderFinished(true);
    }, 2500);

    if (navigator.onLine) {
      signInAnonymously(auth).catch((error) => { console.warn("Firebase Auth Warning:", error); });
    }

    const initData = async () => {
      if (!navigator.onLine) {
        setAppData((prev) => prev || getInitialAppData() || FALLBACK_APPDATA);
        setIsLoaderFinished(true);
        return;
      }

    // 🌟 REAL-TIME CAMPAIGN LOCKOUT GUARD 🌟
  // Admin မှ Promotion ပိတ်လိုက်သည်နှင့် တစ်ပြိုင်နက် campaign mode ဖြင့် ဝင်ရောက်နေပါက customer mode သို့ အလိုအလျောက် လွှဲပြောင်းပေးမည်
  useEffect(() => {
    if (appMode !== 'campaign') return;
    const promo = appData?.promotion;
    const isPromoLive = Boolean(promo?.isPopupActive === true || promo?.isActive === true);

    if (!isPromoLive) {
      setAppMode('customer');
      window.history.replaceState({}, document.title, window.location.pathname);
      alert("🙏 ဤအထူးပရိုမိုးရှင်း / မဲဖောက်သည့် အစီအစဉ် ပြီးဆုံးသွားပါပြီခင်ဗျာ။ (Campaign Ended)");
    }
  }, [appData?.promotion, appMode]);

      try {
        const [settingsSnap, therapistsSnap] = await Promise.all([
            getDoc(doc(db, 'settings', 'appData')).catch(err => { console.warn(err); return null; }),
            getDocs(query(collection(db, 'therapists'), orderBy('order', 'asc'))).catch(err => { console.warn(err); return null; })
        ]);

        let loadedData: Partial<AppData> = {}; 
        let loadedTherapists: TherapistProfile[] = [];
        
        if (settingsSnap && settingsSnap.exists()) { 
          loadedData = settingsSnap.data() || {}; 
        }
        if (therapistsSnap && !therapistsSnap.empty) { 
          therapistsSnap.forEach(d => loadedTherapists.push({ id: d.id, ...d.data() } as TherapistProfile)); 
        }

        // Firebase မှ Data ရလာပါက အသစ်ဖြင့် Update လုပ်မည်၊ မရပါက Cache/Default ကိုသုံးမည် (Network Error လုံးဝ မပြတော့ပါ)
        if ((settingsSnap && settingsSnap.exists()) || loadedTherapists.length > 0) {
          const freshAppData: AppData = { 
            categories: Array.isArray(loadedData.categories) && loadedData.categories.length > 0 ? loadedData.categories : DEFAULT_CATEGORIES, 
            therapists: loadedTherapists.length > 0 ? loadedTherapists : DEFAULT_THERAPISTS, 
            branding: { ...DEFAULT_BRANDING, ...(loadedData.branding || {}) }, 
            paymentMethods: Array.isArray(loadedData.paymentMethods) ? loadedData.paymentMethods : DEFAULT_PAYMENT_METHODS, 
            promotion: loadedData.promotion || DEFAULT_PROMOTION, 
            installSteps: loadedData.installSteps || DEFAULT_INSTALL_STEPS 
          };
          setAppData(freshAppData);
        } else {
          setAppData((prev) => prev || getInitialAppData() || FALLBACK_APPDATA);
        }
      } catch (err) {
        console.warn("Using cached/fallback data due to offline/network:", err);
        setAppData((prev) => prev || getInitialAppData() || FALLBACK_APPDATA);
      }
    };

    initData();
    return () => clearTimeout(safetyTimer);
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
       const sessionAdmin = sessionStorage.getItem('shangrila_admin');
       if (sessionAdmin !== loggedInAdmin) setLoggedInAdmin(sessionAdmin);
    }, 1000);
    return () => clearInterval(interval);
  }, [loggedInAdmin]);

  // POS Mode မဟုတ်မှသာ Loading Screen ပြသမည်
  if (!isLoaderFinished && appMode !== 'pos') { 
      return <PremiumLoadingScreen isDataReady={!!appData} onFinish={() => setIsLoaderFinished(true)} />; 
  }

  const safeAppData = appData || FALLBACK_APPDATA;
  const stepsToShow = safeAppData.installSteps && safeAppData.installSteps.length > 0 ? safeAppData.installSteps : DEFAULT_INSTALL_STEPS;

  // 🌟 Check if we are in full-screen modes (POS or Campaign)
  const isFullScreenMode = appMode === 'pos' || appMode === 'campaign';

  return (
    <div className="min-h-screen bg-gray-50 text-gray-800 font-sans flex flex-col relative">
      
      {/* 🌟 Promotion Popup (Customer Mode Only) 🌟 */}
      {appMode === 'customer' && safeAppData && <ThadingyutPopup appData={safeAppData} />}

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

      {/* 🌟 Hide Header for Full Screen Modes (POS / Campaign) 🌟 */}
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
          
          {!isStandalone && appMode === 'customer' && (
             <button onClick={handleDownloadApp} className={`transition-all duration-300 font-bold text-white flex items-center justify-center bg-gradient-to-r from-[#D4AF37] to-yellow-600 rounded-full shadow-sm border border-yellow-500 hover:opacity-90 ${isScrolled ? 'absolute right-3 sm:right-6 text-[9px] px-2.5 py-1.5' : 'mt-4 text-[10px] sm:text-xs px-4 py-2'}`} style={{ top: isScrolled ? 'calc(0.5rem + env(safe-area-inset-top))' : 'auto' }}>
               <Download className={`${isScrolled ? 'w-3 h-3 mr-1' : 'w-3.5 h-3.5 mr-1.5'}`} /> {isScrolled ? 'App' : 'Download App'}
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
              <StaffApp appData={safeAppData} />
            ) : appMode === 'pos' ? (
              <POSScreen appData={safeAppData} />
            ) : appMode === 'campaign' ? (
              <ThadingyutCampaign appData={safeAppData} />
            ) : (
              <CustomerApp appData={safeAppData} />
            )}
        </Suspense>
      </main>

      {/* 🌟 Hide Footer for Full Screen Modes (POS / Campaign) 🌟 */}
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
