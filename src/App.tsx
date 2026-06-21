import React, { useState, useEffect, useCallback, Suspense, lazy } from 'react';
import { doc, getDoc, collection, getDocs, query, orderBy } from 'firebase/firestore';
import { db } from './firebase';
import { X, MapPin, Phone, Download, LogOut } from 'lucide-react';
import { THEME, AppData, TherapistProfile, MenuCategory, AppBranding, PaymentMethod, PromotionSettings } from './shared';

// --- Lazy Load Pages (Code Splitting) ---
const CustomerApp = lazy(() => import('./pages/CustomerApp'));
const StaffApp = lazy(() => import('./pages/StaffApp'));
const AdminApp = lazy(() => import('./pages/AdminApp'));

// --- Defaults ---
const DEFAULT_BRANDING: AppBranding = { logoUrl: '', name: "The Shangri-La Men's Retreat", address: "33th(B) St, Between 65th & 65th(A) Sts, Mandalay", phone1: "09-458884517", phone2: "09-770072190", copyright: "© 2026 The Shangri-La Men's Retreat." };
const DEFAULT_PAYMENT_METHODS: PaymentMethod[] = [{ id: 'p1', name: 'KBZ PAY', accountNumber: '09458888510', accountName: 'Htet Naing Kyaw', logoUrl: '' }];
const DEFAULT_THERAPISTS: TherapistProfile[] = Array.from({ length: 15 }, (_, i) => ({ id: `t_${i}`, name: `Therapist No-${i + 1}`, images: [], order: i, password: '' }));
const DEFAULT_PROMOTION: PromotionSettings = { isActive: false, hotelDiscountPercent: 10, otherDiscountPercent: 20, startDate: '', endDate: '' };
const DEFAULT_CATEGORIES: MenuCategory[] = [ 
  { id: 'massage', title: 'Massage', items: [{ id: 'm1', name: 'Traditional Massage', price: 25000, duration: '60 Mins' }] }, 
  { id: 'hotel', title: 'Hotel & Home Services', items: [{ id: 'h1', name: 'Part Time Outcall Service', price: 70000, duration: '100 Mins' }] } 
];

class ErrorBoundary extends React.Component<{ children: any }, { hasError: boolean, error: any }> {
  constructor(props: any) { super(props); this.state = { hasError: false, error: null }; }
  static getDerivedStateFromError(error: any) { return { hasError: true, error }; }
  render() {
    if (this.state.hasError) return (
      <div className="min-h-screen bg-red-50 flex items-center justify-center p-10 text-center">
        <div>
          <h1 className="text-3xl font-bold text-red-600 mb-4">App Crashed ⚠️</h1>
          <p className="text-gray-700 font-mono text-sm bg-white p-4 rounded shadow">{this.state.error?.toString()}</p>
          <button onClick={() => window.location.reload()} className="mt-6 px-6 py-3 bg-[#123524] text-white rounded-lg font-bold">Reload App</button>
        </div>
      </div>
    );
    return this.props.children;
  }
}

// Loader for Suspense
const InitialLoader = () => (
  <div className="flex flex-col items-center justify-center min-h-screen text-[#123524] font-bold animate-pulse">
    Loading Shangri-La...
  </div>
);

function App() {
  const [appMode, setAppMode] = useState<'customer' | 'admin' | 'staff'>('customer');
  const [appData, setAppData] = useState<AppData | null>(null);
  const [dbError, setDbError] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isStandalone, setIsStandalone] = useState(false);
  const [showInstallModal, setShowInstallModal] = useState(false);
  const [loggedInAdmin, setLoggedInAdmin] = useState<string | null>(sessionStorage.getItem('shangrila_admin'));

  useEffect(() => {
    if (window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone) setIsStandalone(true);
    const handleBeforeInstallPrompt = (e: any) => { e.preventDefault(); setDeferredPrompt(e); };
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
  }, []);

  const handleDownloadApp = useCallback(async () => {
    if (deferredPrompt) { 
      deferredPrompt.prompt(); 
      const { outcome } = await deferredPrompt.userChoice; 
      if (outcome === 'accepted') { setDeferredPrompt(null); setIsStandalone(true); } 
    } else setShowInstallModal(true);
  }, [deferredPrompt]);

  useEffect(() => {
    document.title = appData?.branding?.name ? `${appData.branding.name} | Men's Retreat` : "The Shangri-La Men's Retreat";
    if (appData?.branding?.logoUrl) {
      const existingIcons = document.querySelectorAll("link[rel*='icon'], link[rel='apple-touch-icon'], link[rel='manifest']"); 
      existingIcons.forEach(icon => document.head.removeChild(icon));
      const newIcon = document.createElement('link'); newIcon.rel = 'shortcut icon'; newIcon.type = 'image/png'; newIcon.href = appData.branding.logoUrl; document.head.appendChild(newIcon);
      const appleIcon = document.createElement('link'); appleIcon.rel = 'apple-touch-icon'; appleIcon.href = appData.branding.logoUrl; document.head.appendChild(appleIcon);
    }
  }, [appData?.branding?.logoUrl, appData?.branding?.name]);

  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search);
    if (searchParams.get('mode') === 'admin') setAppMode('admin');
    else if (searchParams.get('mode') === 'staff') setAppMode('staff');

    const initData = async () => {
      try {
        const docRef = doc(db, 'settings', 'appData'); const snap = await getDoc(docRef);
        let loadedData: Partial<AppData> = {}; if (snap.exists()) loadedData = snap.data() || {};
        const finalCategories = Array.isArray(loadedData.categories) ? loadedData.categories : DEFAULT_CATEGORIES;
        const finalBranding = { ...DEFAULT_BRANDING, ...(loadedData.branding || {}) };
        const finalPaymentMethods = Array.isArray(loadedData.paymentMethods) ? loadedData.paymentMethods : DEFAULT_PAYMENT_METHODS;
        const finalPromotion = loadedData.promotion || DEFAULT_PROMOTION;
        
        const tQuery = query(collection(db, 'therapists'), orderBy('order', 'asc')); const tSnap = await getDocs(tQuery);
        let loadedTherapists: TherapistProfile[] = [];
        if (!tSnap.empty) { tSnap.forEach(d => loadedTherapists.push({ id: d.id, ...d.data() } as TherapistProfile)); } else { loadedTherapists = DEFAULT_THERAPISTS; }
        setAppData({ categories: finalCategories, therapists: loadedTherapists, branding: finalBranding, paymentMethods: finalPaymentMethods, promotion: finalPromotion });
      } catch (err) {
        console.error(err); setDbError(true);
        setAppData({ categories: DEFAULT_CATEGORIES, therapists: DEFAULT_THERAPISTS, branding: DEFAULT_BRANDING, paymentMethods: DEFAULT_PAYMENT_METHODS, promotion: DEFAULT_PROMOTION });
      }
    };
    initData();
  }, []);

  const handleSettingsUpdated = useCallback((newData: AppData) => { setAppData(newData); }, []);

  if (!appData) return <InitialLoader />;

  return (
    <div className="min-h-screen bg-gray-50 text-gray-800 font-sans flex flex-col">
      {dbError && <div className="bg-red-500 text-white text-xs text-center py-1 absolute w-full z-50 top-0">Database Loading Warning. Showing Default Data.</div>}
      
      {showInstallModal && (
        <div className="fixed inset-0 z-[200] bg-black/80 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm overflow-hidden animate-fade-in shadow-2xl">
             <div className="p-4 bg-[#123524] flex justify-between items-center text-white"><h3 className="font-bold">Install App</h3><button onClick={() => setShowInstallModal(false)} className="hover:bg-white/20 p-1 rounded-full"><X className="w-5 h-5"/></button></div>
             <div className="p-5 max-h-[75vh] overflow-y-auto space-y-4">
                <div className="text-center text-sm font-bold text-gray-700 mb-4">အောက်ပါ အဆင့်များအတိုင်း လုပ်ဆောင်ပေးပါ</div>
                <div className="bg-gray-50 p-3 rounded-lg border border-gray-200 shadow-sm"><p className="text-xs font-bold mb-2">၁။ Browser ၏ Menu (⋮) သို့မဟုတ် Share icon ကိုနှိပ်ပါ။</p></div>
                <div className="bg-gray-50 p-3 rounded-lg border border-gray-200 shadow-sm"><p className="text-xs font-bold mb-2">၂။ "Add to Home Screen" ကို ရွေးချယ်ပါ။</p></div>
                <div className="bg-gray-50 p-3 rounded-lg border border-gray-200 shadow-sm"><p className="text-xs font-bold mb-2">၃။ "Add" ကို နှိပ်ပါ။</p></div>
                <button onClick={() => setShowInstallModal(false)} className="w-full py-3 bg-[#D4AF37] text-white font-bold rounded-lg mt-4 hover:bg-yellow-600 transition">နားလည်ပါပြီ</button>
             </div>
          </div>
        </div>
      )}

      <header className="bg-white shadow-sm py-6 px-4 text-center border-b border-gray-200 flex flex-col items-center justify-center relative">
        <div className="flex items-center justify-center mb-1">
          {appData.branding.logoUrl && (<div className="w-12 h-12 rounded-full overflow-hidden mr-3 border-2 shadow-sm flex-shrink-0" style={{ borderColor: THEME.gold }}><img src={appData.branding.logoUrl} alt="Logo" className="w-full h-full object-cover bg-white" /></div>)}
          <h1 className="text-2xl font-bold tracking-wider" style={{ color: THEME.primary }}>{appData.branding.name}</h1>
        </div>
        <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: THEME.gold }}>Men's Retreat (Beyond Relaxation)</p>
        
        {!isStandalone && appMode === 'customer' && (
          <button onClick={handleDownloadApp} className="mt-4 text-[10px] sm:text-xs font-bold text-white flex items-center justify-center bg-[#D4AF37] px-4 py-2 rounded-full hover:bg-yellow-600 transition shadow-sm border border-yellow-600">
            <Download className="w-3.5 h-3.5 mr-1.5" /> Download App
          </button>
        )}

        {/* Admin Mode တွင် Logout ခလုတ်ပြရန် */}
        {appMode === 'admin' && loggedInAdmin && (
          <button onClick={() => { setLoggedInAdmin(null); sessionStorage.removeItem('shangrila_admin'); window.location.reload(); }} className="absolute top-6 right-4 sm:right-6 text-xs font-bold text-red-500 flex items-center bg-red-50 px-3 py-1.5 rounded-full hover:bg-red-100 transition border border-red-100">
            <LogOut className="w-3 h-3 mr-1" /> Logout
          </button>
        )}
      </header>

      <main className="flex-1 w-full max-w-4xl mx-auto p-4 py-6">
        <Suspense fallback={<InitialLoader />}>
            {appMode === 'admin' ? (
              <AdminApp appData={appData} onSettingsUpdated={handleSettingsUpdated} />
            ) : appMode === 'staff' ? (
              <StaffApp appData={appData} />
            ) : (
              <CustomerApp appData={appData} />
            )}
        </Suspense>
      </main>

      {appMode !== 'admin' && (
        <footer className="bg-white border-t border-gray-200 mt-10 py-8 text-center text-sm text-gray-500 px-4">
          <h3 className="font-bold text-base mb-3" style={{ color: THEME.primary }}>{appData.branding.name}</h3>
          <div className="mb-2 flex items-start justify-center text-xs sm:text-sm max-w-xs sm:max-w-md mx-auto">
            <MapPin className="w-4 h-4 mr-1.5 mt-0.5 flex-shrink-0" />
            <span className="text-left sm:text-center leading-relaxed">{appData.branding.address}</span>
          </div>
          <div className="mb-4 flex items-start justify-center text-xs sm:text-sm max-w-xs sm:max-w-md mx-auto">
            <Phone className="w-4 h-4 mr-1.5 mt-0.5 flex-shrink-0" />
            <span className="text-left sm:text-center leading-relaxed">{appData.branding.phone1} &nbsp;|&nbsp; {appData.branding.phone2}</span>
          </div>
          <p className="text-xs text-gray-400 mt-4">{appData.branding.copyright}</p>
        </footer>
      )}
    </div>
  );
}

export default function Main() { 
  return <ErrorBoundary><App /></ErrorBoundary>; 
}
