import React, { useState, useEffect, Suspense, lazy } from 'react';
import { doc, getDoc, collection, getDocs, query, orderBy, setDoc } from 'firebase/firestore';
import { signInAnonymously } from 'firebase/auth'; 
import { db, auth, requestNotificationPermission, messaging } from './firebase'; 
import { onMessage } from 'firebase/messaging';
import { Download, X, MapPin, Phone, LogOut, DatabaseBackup } from 'lucide-react';
import { AppData, TherapistProfile, MenuCategory, PaymentMethod, AppBranding, PromotionSettings, InstallStep } from './shared';

import PremiumLoadingScreen from './pages/PremiumLoadingScreen';
import CustomerApp from './pages/CustomerApp'; 
import POSScreen from './pages/POSScreen'; // 🌟 POS Screen ကို Import ခေါ်ခြင်း 🌟
const AdminApp = lazy(() => import('./pages/AdminApp'));
const StaffApp = lazy(() => import('./pages/StaffApp'));

const THEME = { primary: '#123524', gold: '#D4AF37', textGray: '#4a5568' };

const DEFAULT_BRANDING: AppBranding = {
  logoUrl: '', name: "The Shangri-La", address: "33th(B) St, Between 65th & 65th(A) Sts, Mandalay",
  phone1: "09-458884517", phone2: "09-770072190", copyright: "© 2026 The Shangri-La Men's Retreat."
};
const DEFAULT_PAYMENT_METHODS: PaymentMethod[] = [{ id: 'p1', name: 'KBZ PAY', accountNumber: '09458888510', accountName: 'Htet Naing Kyaw', logoUrl: '' }];
const DEFAULT_THERAPISTS: TherapistProfile[] = Array.from({ length: 15 }, (_, i) => ({ id: `t_${i}`, name: `Therapist No-${i + 1}`, images: [], order: i, password: '' }));
const DEFAULT_PROMOTION: PromotionSettings = { isActive: false, hotelDiscountPercent: 10, otherDiscountPercent: 20, startDate: '', endDate: '' };

const DEFAULT_CATEGORIES: MenuCategory[] = [
  { id: 'massage', title: 'Massage', items: [{ id: 'm1', name: 'Traditional Massage', price: 25000, duration: '60 Mins' }] }
];
const DEFAULT_INSTALL_STEPS: InstallStep[] = [
   { id: '1', text: 'Browser ၏ Menu (⋮) သို့မဟုတ် Share icon ကိုနှိပ်ပါ။', imageUrl: '' }
];

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
  const [appMode, setAppMode] = useState<'customer' | 'admin' | 'staff' | 'pos'>('customer');
  const [loggedInAdmin, setLoggedInAdmin] = useState<string | null>(sessionStorage.getItem('shangrila_admin'));
  const [appData, setAppData] = useState<AppData | null>(null);
  const [dbError, setDbError] = useState(false);
  const [isLoaderFinished, setIsLoaderFinished] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isStandalone, setIsStandalone] = useState(false);
  const [showInstallModal, setShowInstallModal] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
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
    const searchParams = new URLSearchParams(window.location.search);
    if (searchParams.get('mode') === 'admin') setAppMode('admin');
    else if (searchParams.get('mode') === 'staff') setAppMode('staff');
    else if (searchParams.get('mode') === 'pos') setAppMode('pos'); // 🌟 POS Mode စစ်ဆေးခြင်း 🌟

    signInAnonymously(auth).catch((error) => { console.error("Firebase Auth Error:", error); });

    const initData = async () => {
      try {
        const [settingsSnap, therapistsSnap] = await Promise.all([
            getDoc(doc(db, 'settings', 'appData')).catch(() => null),
            getDocs(query(collection(db, 'therapists'), orderBy('order', 'asc'))).catch(() => null)
        ]);

        let loadedData: Partial<AppData> = {}; let loadedTherapists: TherapistProfile[] = [];
        if (settingsSnap && settingsSnap.exists()) { loadedData = settingsSnap.data() || {}; } else if (!settingsSnap) { setDbError(true); }
        if (therapistsSnap && !therapistsSnap.empty) { therapistsSnap.forEach(d => loadedTherapists.push({ id: d.id, ...d.data() } as TherapistProfile)); }

        setAppData({ 
            categories: Array.isArray(loadedData.categories) ? loadedData.categories : DEFAULT_CATEGORIES, 
            therapists: loadedTherapists.length > 0 ? loadedTherapists : DEFAULT_THERAPISTS, 
            branding: { ...DEFAULT_BRANDING, ...(loadedData.branding || {}) }, 
            paymentMethods: Array.isArray(loadedData.paymentMethods) ? loadedData.paymentMethods : DEFAULT_PAYMENT_METHODS, 
            promotion: loadedData.promotion || DEFAULT_PROMOTION, 
            installSteps: loadedData.installSteps || DEFAULT_INSTALL_STEPS 
        });
      } catch (err) { setDbError(true); }
    };
    initData();
  }, []);

  if (dbError) {
      return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6 text-center">
           <div className="bg-white p-8 rounded-2xl shadow-xl w-full max-w-md border border-red-100">
              <h2 className="text-xl font-bold text-red-600 mb-2">Network Error</h2>
              <button onClick={() => window.location.reload()} className="w-full py-3 bg-[#123524] text-[#D4AF37] rounded-lg font-bold">Refresh App</button>
           </div>
        </div>
      );
  }

  if (!isLoaderFinished) { 
      return <PremiumLoadingScreen isDataReady={!!appData} onFinish={() => setIsLoaderFinished(true)} />; 
  }

  return (
    <div className="min-h-screen bg-gray-50 text-gray-800 font-sans flex flex-col relative">
      <header 
        className={`sticky top-0 z-[100] w-full transition-all duration-300 border-b border-gray-200 flex flex-col items-center justify-center ${isScrolled ? 'bg-white/95 backdrop-blur-md shadow-sm' : 'bg-white shadow-sm'} px-4 text-center`}
        style={{ paddingTop: isScrolled ? 'calc(0.5rem + env(safe-area-inset-top))' : 'calc(1.5rem + env(safe-area-inset-top))', paddingBottom: isScrolled ? '0.5rem' : '1.5rem' }}
      >
        <div className="flex items-center justify-center mb-1">
          {appData?.branding?.logoUrl && (
            <div className={`rounded-full overflow-hidden mr-2 border-2 shadow-sm flex-shrink-0 ${isScrolled ? 'w-8 h-8' : 'w-12 h-12'}`} style={{ borderColor: THEME.gold }}>
              <img src={appData.branding.logoUrl} alt="Logo" className="w-full h-full object-cover bg-white" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
            </div>
          )}
          <h1 className={`font-bold font-serif ${isScrolled ? 'text-lg' : 'text-2xl'}`} style={{ color: THEME.primary }}>{appData?.branding?.name}</h1>
        </div>
        <p className={`font-bold uppercase tracking-[0.2em] transition-all overflow-hidden ${isScrolled ? 'h-0 opacity-0 m-0' : 'text-[10px] mt-1.5'}`} style={{ color: THEME.gold }}>Men's Retreat (Beyond Relaxation)</p>
      </header>

      <main className="flex-1 w-full max-w-6xl mx-auto p-4 py-6">
        <Suspense fallback={<div className="text-center py-20 font-bold">Loading...</div>}>
            {appMode === 'admin' ? (
              <AdminApp appData={appData} onSettingsUpdated={setAppData} />
            ) : appMode === 'staff' ? (
              <StaffApp appData={appData} />
            ) : appMode === 'pos' ? (
              <POSScreen appData={appData} />
            ) : (
              <CustomerApp appData={appData} />
            )}
        </Suspense>
      </main>
    </div>
  );
}

export default function App() { 
  return <ErrorBoundary><MainApp /></ErrorBoundary>; 
}
