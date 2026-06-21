import React, { useState, useEffect, useRef } from 'react';
import { collection, addDoc, getDocs, updateDoc, deleteDoc, doc, query, orderBy, getDoc, setDoc, onSnapshot } from 'firebase/firestore';
import { db } from './firebase';
import { Calendar, Clock, CreditCard, CheckCircle, Trash2, User, Phone, ShieldCheck, Activity, Copy, ChevronRight, ChevronLeft, Check, Sparkles, Droplets, Scissors, Home, ChevronDown, ChevronUp, Crown, Save, PlusCircle, Settings, UploadCloud, X, ImageIcon, MapPin, Search, LogOut, KeyRound, AlertCircle, History, UserCircle, CalendarPlus, Edit, ShieldAlert, Lock, BarChart2, Coffee, Percent, Download } from 'lucide-react';

const THEME = { primary: '#123524', gold: '#D4AF37', textGray: '#4a5568' };

const ICON_MAP: Record<string, any> = {
  massage: Sparkles, scrub: Droplets, waxing: Scissors, hotel: Home, facial: Droplets, manicure: Scissors, pedicure: Scissors,
};

interface MenuItem { id: string; name: string; price: number; duration: string; vvipPrice?: number; vvipIncluded?: boolean; }
interface MenuCategory { id: string; title: string; items: MenuItem[]; }
interface TherapistProfile { id: string; name: string; images: string[]; order: number; password?: string; }
interface Booking { id?: string; name: string; phone: string; service: string; therapist: string; date: string; time: string; paymentMethod: string; txId: string; totalPrice: number; status: 'pending' | 'payment_checking' | 'approved' | 'in_progress' | 'completed' | 'cancelled'; cancelReason?: string; specialRequest?: string; createdAt: number; startTimeMillis?: number; expectedEndTimeMillis?: number; actualEndTimeMillis?: number; overtimeSeconds?: number; }
interface OutPass { id?: string; therapist: string; date: string; outTimeMillis: number; inTimeMillis?: number; expectedInTimeMillis: number; status: 'out' | 'returned'; overtimeSeconds?: number; reason?: string; }
interface AppBranding { logoUrl: string; address: string; phone1: string; phone2: string; copyright: string; name: string; shopLat?: number; shopLng?: number; }
interface PaymentMethod { id: string; name: string; accountNumber: string; accountName: string; logoUrl: string; }
interface PromotionSettings { isActive: boolean; hotelDiscountPercent: number; otherDiscountPercent: number; startDate: string; endDate: string; }
interface AppData { therapists: TherapistProfile[]; categories: MenuCategory[]; branding: AppBranding; paymentMethods: PaymentMethod[]; promotion?: PromotionSettings; }
interface UserProfile { phone: string; name: string; password?: string; createdAt: number; }
interface AdminProfile { username: string; password?: string; }

const DEFAULT_BRANDING: AppBranding = {
  logoUrl: '', name: "The Shangri-La", address: "33th(B) St, Between 65th & 65th(A) Sts, Mandalay",
  phone1: "09-458884517", phone2: "09-770072190", copyright: "© 2026 The Shangri-La Men's Retreat."
};
const DEFAULT_PAYMENT_METHODS: PaymentMethod[] = [{ id: 'p1', name: 'KBZ PAY', accountNumber: '09458888510', accountName: 'Htet Naing Kyaw', logoUrl: '' }];
const DEFAULT_THERAPISTS: TherapistProfile[] = Array.from({ length: 15 }, (_, i) => ({ id: `t_${i}`, name: `Therapist No-${i + 1}`, images: [], order: i, password: '' }));
const DEFAULT_PROMOTION: PromotionSettings = { isActive: false, hotelDiscountPercent: 10, otherDiscountPercent: 20, startDate: '', endDate: '' };
const DEFAULT_CATEGORIES: MenuCategory[] = [
  { id: 'massage', title: 'Massage', items: [{ id: 'm1', name: 'Traditional Massage', price: 25000, duration: '60 Mins' }] },
  { id: 'hotel', title: 'Hotel & Home Services', items: [{ id: 'h1', name: 'Part Time Outcall Service', price: 70000, duration: '100 Mins' }] }
];

const ALL_TIME_SLOTS = ["6:00 AM", "6:30 AM", "7:00 AM", "7:30 AM", "8:00 AM", "8:30 AM", "9:00 AM", "9:30 AM", "10:00 AM", "10:30 AM", "11:00 AM", "11:30 AM", "12:00 PM", "12:30 PM", "1:00 PM", "1:30 PM", "2:00 PM", "2:30 PM", "3:00 PM", "3:30 PM", "4:00 PM", "4:30 PM", "5:00 PM", "5:30 PM", "6:00 PM", "6:30 PM", "7:00 PM", "7:30 PM", "8:00 PM", "8:30 PM", "9:00 PM"];

const formatPrice = (price: any) => { const num = Number(price); if (isNaN(num)) return '0 Ks'; return num.toLocaleString() + ' Ks'; };

const formatSecondsMMSS = (totalSeconds: number | undefined | null) => {
    if (totalSeconds === undefined || totalSeconds === null) return '00:00';
    const isNegative = totalSeconds < 0;
    const absSecs = Math.abs(totalSeconds);
    const m = Math.floor(absSecs / 60);
    const s = Math.floor(absSecs % 60);
    return `${isNegative ? '-' : ''}${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
};

const formatTimeDisplay = (totalSeconds: number | undefined | null) => {
    if (totalSeconds === undefined || totalSeconds === null) return '00:00';
    const isNegative = totalSeconds < 0;
    const absSecs = Math.abs(totalSeconds);
    const h = Math.floor(absSecs / 3600);
    const m = Math.floor((absSecs % 3600) / 60);
    const s = Math.floor(absSecs % 60);
    const formatted = h > 0 
       ? `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
       : `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    return `${isNegative ? '-' : ''}${formatted}`;
};

const compressImage = async (file: File, width: number, height: number): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader(); reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image(); img.src = event.target?.result as string;
      img.onload = () => {
        const canvas = document.createElement('canvas'); let sW = img.width; let sH = img.height; let sX = 0; let sY = 0;
        const targetRatio = width / height; const imageRatio = sW / sH;
        if (imageRatio > targetRatio) { const nW = sH * targetRatio; sX = (sW - nW) / 2; sW = nW; } else { const nH = sW / targetRatio; sY = (sH - nH) / 2; sH = nH; }
        canvas.width = width; canvas.height = height; const ctx = canvas.getContext('2d'); ctx?.drawImage(img, sX, sY, sW, sH, 0, 0, width, height); 
        resolve(canvas.toDataURL('image/jpeg', 0.85)); 
      }; img.onerror = (e) => reject(e);
    }; reader.onerror = (e) => reject(e);
  });
};

function useCountdown(initialMinutes: number, onExpire: () => void) {
  const [timeLeft, setTimeLeft] = useState(initialMinutes * 60);
  useEffect(() => {
    if (timeLeft <= 0) { onExpire(); return; }
    const intervalId = setInterval(() => { setTimeLeft(t => t - 1); }, 1000);
    return () => clearInterval(intervalId);
  }, [timeLeft, onExpire]);
  const minutes = Math.floor(timeLeft / 60); const seconds = timeLeft % 60;
  return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

const getLocalTodayStr = () => {
  const d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
};

const calculateDistanceInMeters = (lat1: number, lon1: number, lat2: number, lon2: number) => {
  const R = 6371e3;
  const p1 = lat1 * Math.PI / 180;
  const p2 = lat2 * Math.PI / 180;
  const dp = (lat2 - lat1) * Math.PI / 180;
  const dl = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dp / 2) * Math.sin(dp / 2) + Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) * Math.sin(dl / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

function getSlotsCoveredByInterval(startTimeMillis: number, endTimeMillis: number, dateStr: string): Set<string> {
    const blocked = new Set<string>();
    const [y, m, d] = dateStr.split('-');
    const dateObj = new Date(Number(y), Number(m) - 1, Number(d));
    const startOfDay = dateObj.setHours(0, 0, 0, 0);
    const endOfDay = dateObj.setHours(23, 59, 59, 999);

    if (endTimeMillis <= startOfDay || startTimeMillis >= endOfDay) return blocked;

    ALL_TIME_SLOTS.forEach(slot => {
        if (slot.includes("to")) return; 
        const slotTime = new Date(Number(y), Number(m) - 1, Number(d));
        const [time, ampm] = slot.split(' ');
        let [sh, sm] = time.split(':').map(Number);
        if (ampm === 'PM' && sh < 12) sh += 12;
        if (ampm === 'AM' && sh === 12) sh = 0;
        slotTime.setHours(sh, sm, 0, 0);
        
        const slotTimeMillis = slotTime.getTime();
        const nextSlotTimeMillis = slotTimeMillis + (30 * 60 * 1000); 

        if ((startTimeMillis < nextSlotTimeMillis) && (endTimeMillis > slotTimeMillis)) {
            blocked.add(slot);
        }
    });
    return blocked;
}

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

// --- Main App Setup ---
function App() {
  const [appMode, setAppMode] = useState<'customer' | 'admin' | 'staff'>('customer');
  const [loggedInAdmin, setLoggedInAdmin] = useState<string | null>(sessionStorage.getItem('shangrila_admin'));
  const [appData, setAppData] = useState<AppData | null>(null);
  const [dbError, setDbError] = useState(false);

  // PWA Install State
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isStandalone, setIsStandalone] = useState(false);
  const [showInstallModal, setShowInstallModal] = useState(false);

  useEffect(() => {
    if (window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone) { setIsStandalone(true); }
    const handleBeforeInstallPrompt = (e: any) => { e.preventDefault(); setDeferredPrompt(e); };
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
  }, []);

  const handleDownloadApp = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') { setDeferredPrompt(null); setIsStandalone(true); }
    } else { setShowInstallModal(true); }
  };

  useEffect(() => {
    document.title = appData?.branding?.name ? `${appData.branding.name} | Men's Retreat` : "The Shangri-La | Men's Retreat";
    const updateFavicon = (url: string) => {
      const existingIcons = document.querySelectorAll("link[rel*='icon'], link[rel='apple-touch-icon'], link[rel='manifest']"); 
      existingIcons.forEach(icon => document.head.removeChild(icon));
      const newIcon = document.createElement('link'); newIcon.rel = 'shortcut icon'; newIcon.type = 'image/png'; newIcon.href = url; document.head.appendChild(newIcon);
      const appleIcon = document.createElement('link'); appleIcon.rel = 'apple-touch-icon'; appleIcon.href = url; document.head.appendChild(appleIcon);
      const appName = appData?.branding?.name || "The Shangri-La";
      const manifest = { name: appName, short_name: appName, start_url: "/", display: "standalone", background_color: "#ffffff", theme_color: THEME.primary, icons: [{ src: url, sizes: "192x192", type: "image/png" }, { src: url, sizes: "512x512", type: "image/png" }] };
      const manifestBlob = new Blob([JSON.stringify(manifest)], { type: "application/json" });
      const manifestUrl = URL.createObjectURL(manifestBlob);
      const manifestLink = document.createElement('link'); manifestLink.rel = 'manifest'; manifestLink.href = manifestUrl; document.head.appendChild(manifestLink);
    };
    if (appData?.branding?.logoUrl) { updateFavicon(appData.branding.logoUrl); } else { updateFavicon("https://upload.wikimedia.org/wikipedia/commons/4/41/Shangri-La_Hotels_and_Resorts_logo.svg"); }
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

  if (!appData) { return <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center text-[#123524] font-bold">Loading The Shangri-La...</div>; }

  return (
    <div className="min-h-screen bg-gray-50 text-gray-800 font-sans flex flex-col">
      {dbError && <div className="bg-red-500 text-white text-xs text-center py-1">Database Loading Warning. Showing Default Data.</div>}
      
      {showInstallModal && (
        <div className="fixed inset-0 z-[200] bg-black/80 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm overflow-hidden animate-fade-in shadow-2xl">
             <div className="p-4 bg-[#123524] flex justify-between items-center text-white">
                <h3 className="font-bold">Install App</h3>
                <button onClick={() => setShowInstallModal(false)} className="hover:bg-white/20 p-1 rounded-full"><X className="w-5 h-5"/></button>
             </div>
             <div className="p-5 max-h-[75vh] overflow-y-auto space-y-4">
                <div className="text-center text-sm font-bold text-gray-700 mb-4">အောက်ပါ အဆင့်များအတိုင်း လုပ်ဆောင်ပေးပါ</div>
                <div className="bg-gray-50 p-3 rounded-lg border border-gray-200 shadow-sm">
                   <p className="text-xs font-bold mb-2">၁။ Google Chrome သို့မဟုတ် Safari ဖြင့်ဖွင့်ပါ။</p>
                   <img src="IMG-4b261923cff4539f30342daac99711c1-V.jpg" alt="Step 1" className="w-full rounded border border-gray-200" onError={(e) => {(e.target as HTMLImageElement).style.display = 'none';}} />
                </div>
                <div className="bg-gray-50 p-3 rounded-lg border border-gray-200 shadow-sm">
                   <p className="text-xs font-bold mb-2">၂။ Browser ၏ Menu (⋮) သို့မဟုတ် Share icon ကိုနှိပ်ပါ။</p>
                   <img src="IMG-8abdfebb76fdc5851c1f4d2531b29e34-V.jpg" alt="Step 2" className="w-full rounded border border-gray-200" onError={(e) => {(e.target as HTMLImageElement).style.display = 'none';}} />
                </div>
                <div className="bg-gray-50 p-3 rounded-lg border border-gray-200 shadow-sm">
                   <p className="text-xs font-bold mb-2">၃။ &quot;Add to Home Screen&quot; ကို ရွေးချယ်ပါ။</p>
                   <img src="IMG-da2b6f5c3680c5b5720d615c39ffeceb-V.jpg" alt="Step 3" className="w-full rounded border border-gray-200" onError={(e) => {(e.target as HTMLImageElement).style.display = 'none';}} />
                </div>
                <div className="bg-gray-50 p-3 rounded-lg border border-gray-200 shadow-sm">
                   <p className="text-xs font-bold mb-2">၄။ &quot;Add&quot; ကို နှိပ်ပါ။ ဖုန်း Screen တွင် App အဖြစ် ရောက်ရှိသွားပါမည်။</p>
                   <img src="IMG-1d0fc2218a07a3dbd00e8f759472d424-V.jpg" alt="Step 4" className="w-full rounded border border-gray-200" onError={(e) => {(e.target as HTMLImageElement).style.display = 'none';}} />
                </div>
                <button onClick={() => setShowInstallModal(false)} className="w-full py-3 bg-[#D4AF37] text-white font-bold rounded-lg mt-4 hover:bg-yellow-600 transition">နားလည်ပါပြီ</button>
             </div>
          </div>
        </div>
      )}

      <header className="bg-white shadow-sm py-6 px-4 text-center border-b border-gray-200 flex flex-col items-center justify-center relative">
        <div className="flex items-center justify-center mb-1">
          {appData.branding.logoUrl && (
            <div className="w-12 h-12 rounded-full overflow-hidden mr-3 border-2 shadow-sm flex-shrink-0" style={{ borderColor: THEME.gold }}>
              <img src={appData.branding.logoUrl} alt="Logo" className="w-full h-full object-cover bg-white" />
            </div>
          )}
          <h1 className="text-2xl font-bold tracking-wider" style={{ color: THEME.primary }}>{appData.branding.name || 'The Shangri-La'}</h1>
        </div>
        <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: THEME.gold }}>Men&apos;s Retreat (Beyond Relaxation)</p>
        
        {!isStandalone && appMode === 'customer' && (
           <button onClick={handleDownloadApp} className="mt-4 text-[10px] sm:text-xs font-bold text-white flex items-center justify-center bg-[#D4AF37] px-4 py-2 rounded-full hover:bg-yellow-600 transition shadow-sm border border-yellow-600">
             <Download className="w-3.5 h-3.5 mr-1.5" /> Download App
           </button>
        )}
        {appMode === 'admin' && loggedInAdmin && (
           <button onClick={() => { setLoggedInAdmin(null); sessionStorage.removeItem('shangrila_admin'); }} className="absolute top-6 right-4 sm:right-6 text-xs font-bold text-red-500 flex items-center bg-red-50 px-3 py-1.5 rounded-full hover:bg-red-100 transition border border-red-100"><LogOut className="w-3 h-3 mr-1" /> Logout</button>
        )}
      </header>

      <main className="flex-1 w-full max-w-4xl mx-auto p-4 py-6">
        {appMode === 'admin' ? (
          loggedInAdmin ? <AdminDashboard appData={appData} onSettingsUpdated={setAppData} /> 
                        : <AdminLogin onLogin={(user) => { setLoggedInAdmin(user); sessionStorage.setItem('shangrila_admin', user); }} />
        ) : appMode === 'staff' ? (
          <StaffApp appData={appData} />
        ) : <CustomerApp appData={appData} />}
      </main>

      {appMode !== 'admin' && (
        <footer className="bg-white border-t border-gray-200 mt-10 py-8 text-center text-sm text-gray-500 px-4">
          <h3 className="font-bold text-base mb-3" style={{ color: THEME.primary }}>{appData.branding.name || 'The Shangri-La'} Men&apos;s Retreat</h3>
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

function CustomerApp({ appData }: { appData: AppData }) {
  const [activeTab, setActiveTab] = useState<'book' | 'therapists' | 'dashboard' | 'history' | 'profile'>(() => {
     const view = new URLSearchParams(window.location.search).get('view');
     if (view === 'therapists') return 'therapists';
     if (view === 'dashboard') return 'dashboard';
     return 'book';
  });
  const [userPhone, setUserPhone] = useState(localStorage.getItem('shangrila_user_phone') || '');
  const [hasNoti, setHasNoti] = useState(false);
  const [prefillTherapist, setPrefillTherapist] = useState<TherapistProfile | null>(null);
  const prevStatuses = useRef<Record<string, string>>({});
  const isFirstLoad = useRef(true);

  useEffect(() => { window.scrollTo({ top: 0, behavior: 'smooth' }); }, [activeTab]);

  useEffect(() => {
    if (!userPhone) return;
    const q = query(collection(db, 'bookings'));
    const unsubscribe = onSnapshot(q, (snap) => {
      let changed = false;
      snap.docs.forEach((doc) => {
        const b = { id: doc.id, ...doc.data() } as Booking;
        if (b.phone === userPhone) {
          const oldStatus = prevStatuses.current[b.id!];
          if (oldStatus && oldStatus !== b.status) changed = true;
          prevStatuses.current[b.id!] = b.status;
        }
      });
      if (!isFirstLoad.current && changed) {
        if (activeTab !== 'history') setHasNoti(true);
        const audioEl = document.getElementById('customer-alert-sound') as HTMLAudioElement;
        if (audioEl) { audioEl.currentTime = 0; audioEl.play().catch(() => {}); }
      }
      isFirstLoad.current = false;
    });
    return () => unsubscribe();
  }, [userPhone, activeTab]);

  useEffect(() => { if (activeTab === 'history') setHasNoti(false); }, [activeTab]);

  const handleInteraction = () => {
    const audioEl = document.getElementById('customer-alert-sound') as HTMLAudioElement;
    if (audioEl && audioEl.paused) { audioEl.play().then(() => { audioEl.pause(); audioEl.currentTime = 0; }).catch(() => {}); }
  };

  const handleDashboardBook = (t: TherapistProfile) => { setPrefillTherapist(t); setActiveTab('therapists'); };

  const tabs = [
    { id: 'book', label: 'Book Now', icon: CalendarPlus }, { id: 'therapists', label: 'View Therapists', icon: User },
    { id: 'dashboard', label: 'Dashboard', icon: BarChart2 }, { id: 'history', label: 'My Bookings', icon: History },
    { id: 'profile', label: 'Profile', icon: UserCircle }
  ] as const;

  return (
    <div className="max-w-2xl mx-auto" onClick={handleInteraction}>
      <audio id="customer-alert-sound" src="https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3" preload="auto" />
      <div className="flex justify-start sm:justify-center items-center space-x-1 md:space-x-2 mb-10 bg-white p-2 rounded-2xl shadow-sm border border-gray-100 overflow-x-auto scrollbar-hide">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button key={tab.id} onClick={() => { setPrefillTherapist(null); setActiveTab(tab.id as any); }}
              className={`relative flex-1 min-w-[75px] sm:min-w-[80px] flex flex-col sm:flex-row items-center justify-center py-3 px-1 sm:px-2 rounded-xl text-[9px] sm:text-xs md:text-sm font-bold transition-all duration-300 ${isActive ? 'bg-gray-50 shadow-sm border border-gray-200' : 'text-gray-500 hover:bg-gray-50/50 hover:text-gray-700'}`} style={{ color: isActive ? THEME.primary : undefined }}>
              <tab.icon className={`w-4 h-4 sm:w-5 sm:h-5 mb-1 sm:mb-0 sm:mr-1.5 ${isActive ? 'text-[#D4AF37]' : 'text-gray-400'}`} />
              <span className="text-center">{tab.label}</span>
              {tab.id === 'history' && hasNoti && <span className="absolute top-1 right-2 sm:top-2 sm:right-4 w-2 h-2 sm:w-2.5 sm:h-2.5 bg-red-500 rounded-full shadow-md animate-ping"></span>}
              {tab.id === 'history' && hasNoti && <span className="absolute top-1 right-2 sm:top-2 sm:right-4 w-2 h-2 sm:w-2.5 sm:h-2.5 bg-red-500 rounded-full shadow-md"></span>}
            </button>
          )
        })}
      </div>
      {activeTab === 'book' && <CustomerBookingWizard appData={appData} userPhone={userPhone} onBooked={(phone) => { setUserPhone(phone); localStorage.setItem('shangrila_user_phone', phone); setActiveTab('history'); }} />}
      {activeTab === 'therapists' && <CustomerBookingWizard key={prefillTherapist ? prefillTherapist.id : 'default'} appData={appData} userPhone={userPhone} forceTherapistFirst={true} initialTherapist={prefillTherapist} onBooked={(phone) => { setUserPhone(phone); localStorage.setItem('shangrila_user_phone', phone); setActiveTab('history'); setPrefillTherapist(null); }} />}
      {activeTab === 'dashboard' && <CustomerDashboard appData={appData} onBookTherapist={handleDashboardBook} />}
      {activeTab === 'history' && <CustomerHistory userPhone={userPhone} onLoginSuccess={(phone) => { setUserPhone(phone); localStorage.setItem('shangrila_user_phone', phone); }} />}
      {activeTab === 'profile' && <CustomerProfile userPhone={userPhone} onLoginSuccess={(phone) => { setUserPhone(phone); localStorage.setItem('shangrila_user_phone', phone); }} onLogout={() => { setUserPhone(''); localStorage.removeItem('shangrila_user_phone'); setActiveTab('book'); }} />}
    </div>
  );
}

function CustomerDashboard({ appData, onBookTherapist }: { appData: AppData, onBookTherapist: (t: TherapistProfile) => void }) {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const todayStr = getLocalTodayStr();

  useEffect(() => {
    const q = query(collection(db, 'bookings'));
    const unsub = onSnapshot(q, (snap) => {
        const arr: Booking[] = [];
        snap.forEach(d => arr.push({id: d.id, ...d.data()} as Booking));
        setBookings(arr);
    });
    return () => unsub();
  }, []);

  const getTherapistStatus = (tName: string) => {
      let blockedNow = new Set<string>();
      let isCurrentlyActive = false;
      
      bookings.forEach(b => {
          if (b.status === 'cancelled' || b.status === 'completed') return;
          if (b.date !== todayStr) return;
          if (b.therapist !== tName) return;

          if (b.status === 'in_progress' && b.startTimeMillis) {
               isCurrentlyActive = true;
               const end = Math.max(Date.now(), b.expectedEndTimeMillis || Date.now());
               getSlotsCoveredByInterval(b.startTimeMillis!, end, b.date).forEach(slot => blockedNow.add(slot));
          } else if (b.time && b.time.includes("to")) {
              const [start, endRaw] = b.time.split(" to ");
              const end = endRaw.replace(" (Next Day)", "");
              const sIdx = ALL_TIME_SLOTS.indexOf(start);
              let eIdx = ALL_TIME_SLOTS.indexOf(end);
              if (endRaw.includes("Next Day") || (eIdx !== -1 && eIdx <= sIdx)) { eIdx = ALL_TIME_SLOTS.length; }
              if (sIdx !== -1 && eIdx !== -1) {
                  for (let i = sIdx; i < eIdx; i++) blockedNow.add(ALL_TIME_SLOTS[i]);
              }
              blockedNow.add(b.time); 
          } else if (b.time) {
              const sIdx = ALL_TIME_SLOTS.indexOf(b.time);
              if (sIdx !== -1) {
                  let slotsToBlock = 2; 
                  const match = b.service.match(/(\d+)\s*Mins/i);
                  if (match) slotsToBlock = Math.ceil(parseInt(match[1]) / 30);
                  for (let i = sIdx; i < sIdx + slotsToBlock; i++) {
                      if (ALL_TIME_SLOTS[i]) blockedNow.add(ALL_TIME_SLOTS[i]);
                  }
              }
          }
      });

      if (isCurrentlyActive) {
          return { label: 'In Service (Active)', mm: 'ဝန်ဆောင်မှုပေးနေပါသည်', color: 'bg-orange-100 text-orange-700 border-orange-200' };
      }

      let is24hFull = false;
      if (blockedNow.has("7:00 AM to 7:00 AM (Next Day)")) {
          is24hFull = true;
      } else if (blockedNow.has("7:00 AM to 7:00 PM") && blockedNow.has("7:00 PM to 7:00 AM (Next Day)")) {
          is24hFull = true;
      }

      if (is24hFull) { return { label: 'Fully Booked (Day & Night)', mm: 'နေ့ရောညပါ ပြည့်နေပါပြီ', color: 'bg-red-100 text-red-700 border-red-200' }; }

      const isNightFull = blockedNow.has("7:00 PM to 7:00 AM (Next Day)");
      const isDayFull = blockedNow.has("7:00 AM to 7:00 PM");

      let shopSlotsTotal = 0; let shopSlotsBooked = 0;
      for (let i = 6; i <= 30; i++) { shopSlotsTotal++; if (blockedNow.has(ALL_TIME_SLOTS[i])) shopSlotsBooked++; }
      const isShopFull = shopSlotsBooked === shopSlotsTotal;

      if (isDayFull && !isNightFull) return { label: 'Day Full / Night Available', mm: 'နေ့ပိုင်းပြည့်၊ ညပိုင်းရပါသေးတယ်', color: 'bg-orange-100 text-orange-700 border-orange-200' };
      if (isNightFull && !isDayFull && !isShopFull) return { label: 'Night Full / Day Available', mm: 'ညပိုင်းပြည့်၊ နေ့ပိုင်းရပါသေးတယ်', color: 'bg-yellow-100 text-yellow-700 border-yellow-200' };
      if (isShopFull && isNightFull) return { label: 'Fully Booked For Today', mm: 'ဒီနေ့အတွက် ဘိုကင်ပြည့်သွားပါပြီ', color: 'bg-red-100 text-red-700 border-red-200' };
      if (isShopFull && !isNightFull) return { label: 'Shop Full / Night Available', mm: 'ဆိုင်ချိန်ပြည့်၊ ညပိုင်းရပါသေးတယ်', color: 'bg-orange-100 text-orange-700 border-orange-200' };
      if (shopSlotsBooked > 0) return { label: 'Partially Booked', mm: 'ဆိုင်ချိန်တချို့ ယူထားပါတယ်', color: 'bg-blue-100 text-blue-700 border-blue-200' };

      return { label: 'Available', mm: 'အားပါတယ်', color: 'bg-green-100 text-green-700 border-green-200' };
  };

  const bookingCounts: Record<string, number> = {};
  bookings.forEach(b => {
     if (b.status !== 'cancelled') { bookingCounts[b.therapist] = (bookingCounts[b.therapist] || 0) + 1; }
  });

  const top5Therapists = [...appData.therapists].sort((a, b) => {
     const countA = bookingCounts[a.name] || 0; const countB = bookingCounts[b.name] || 0;
     if (countA !== countB) return countB - countA; 
     return (a.order || 0) - (b.order || 0);
  }).slice(0, 5);

  return (
    <div className="animate-fade-in">
       <div className="text-center mb-8">
         <h2 className="text-2xl font-bold" style={{ color: THEME.primary }}>Today's Availability</h2>
         <p className="text-sm font-bold mt-2" style={{ color: THEME.gold }}>(ဒီနေ့အတွက် ဝန်ထမ်းများ၏ ဘိုကင် အခြေအနေ)</p>
       </div>
       <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {appData.therapists.map(t => {
             const status = getTherapistStatus(t.name);
             const isAvailable = status.label === 'Available';
             const isPartiallyBooked = status.label === 'Partially Booked' || status.label === 'In Service (Active)';
             const isFullyBooked = status.label.includes('Fully Booked');

             return (
                <div key={t.id} className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex items-center hover:shadow-md transition">
                   <div className={`w-14 h-14 rounded-lg overflow-hidden flex-shrink-0 mr-3 sm:mr-4 border ${isAvailable ? 'border-green-200' : isPartiallyBooked ? 'border-blue-200' : isFullyBooked ? 'border-red-200 grayscale' : 'border-orange-200'}`}>
                       {t.images && t.images.length > 0 ? <img src={t.images[0]} alt="Therapist" className="w-full h-full object-cover" /> : <User className="w-full h-full p-2 text-gray-400 bg-gray-100" />}
                   </div>
                   <div className="flex-1">
                       <h3 className="font-bold text-gray-800 text-sm mb-1">{t.name}</h3>
                       <div className={`px-2 py-1.5 inline-block rounded border text-[9px] sm:text-[10px] font-bold leading-tight ${status.color}`}>
                          {status.label} <br/> <span className="font-semibold opacity-90">{status.mm}</span>
                       </div>
                   </div>
                   <button onClick={() => onBookTherapist(t)} className="ml-2 px-4 py-2 bg-[#123524] text-[#D4AF37] rounded-lg text-xs font-bold whitespace-nowrap shadow-sm hover:bg-[#1a4a32] flex items-center border border-[#1a4a32]">
                       Book Now
                   </button>
                </div>
             )
          })}
       </div>

       {top5Therapists.length > 0 && (
         <div className="mt-14 pt-8 border-t-2 border-gray-100">
             <div className="text-center mb-6">
                 <h2 className="text-2xl font-bold flex items-center justify-center" style={{ color: THEME.primary }}><Crown className="w-6 h-6 mr-2 text-yellow-500"/> Our Top 5 Therapists</h2>
                 <p className="text-sm font-bold mt-2" style={{ color: THEME.gold }}>(ဆိုင်၏ ဘိုကင်အယူအများဆုံး ဝန်ထမ်းများ)</p>
             </div>
             <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4">
                 {top5Therapists.map((t, idx) => (
                     <div key={t.id} className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden flex flex-col relative hover:shadow-md transition">
                         <div className="absolute top-0 left-0 bg-yellow-500 text-white w-7 h-7 flex items-center justify-center rounded-br-lg font-bold text-xs z-10 shadow-sm border-r border-b border-yellow-600">
                            {idx + 1}
                         </div>
                         <div className="w-full aspect-[3/4] bg-gray-100 relative">
                             {t.images && t.images.length > 0 ? <img src={t.images[0]} alt="Therapist" className="w-full h-full object-cover" /> : <User className="w-full h-full p-6 text-gray-400 opacity-50" />}
                         </div>
                         <div className="p-3 flex flex-col flex-1 justify-between bg-gray-50/50">
                             <div className="font-bold text-gray-800 text-sm text-center mb-3 truncate px-1">{t.name}</div>
                             <button onClick={() => onBookTherapist(t)} className="w-full bg-[#123524] text-[#D4AF37] py-2 rounded-lg text-[10px] font-bold shadow-sm hover:bg-[#1a4a32] flex justify-center items-center border border-[#1a4a32]">
                                 Book Now <ChevronRight className="w-3 h-3 ml-0.5"/>
                             </button>
                         </div>
                     </div>
                 ))}
             </div>
         </div>
       )}
    </div>
  );
}

function StaffApp({ appData }: { appData: AppData }) {
   const [loggedInStaff, setLoggedInStaff] = useState<TherapistProfile | null>(() => {
       const saved = localStorage.getItem('shangrila_staff_profile');
       return saved ? JSON.parse(saved) : null;
   });
   const handleLogout = () => { setLoggedInStaff(null); localStorage.removeItem('shangrila_staff_profile'); };

   return (
       <div className="max-w-3xl mx-auto">
           {loggedInStaff ? (
               <StaffSessionManager appData={appData} loggedInStaff={loggedInStaff} onLogout={handleLogout} />
           ) : (
               <StaffLogin therapists={appData.therapists} onLoginSuccess={(profile) => {
                   setLoggedInStaff(profile); localStorage.setItem('shangrila_staff_profile', JSON.stringify(profile));
               }} />
           )}
       </div>
   );
}

function StaffLogin({ therapists, onLoginSuccess }: { therapists: TherapistProfile[], onLoginSuccess: (p: TherapistProfile) => void }) {
   const [therapistId, setTherapistId] = useState('');
   const [password, setPassword] = useState('');
   const [error, setError] = useState('');

   const handleLogin = (e: React.FormEvent) => {
       e.preventDefault(); setError('');
       const staff = therapists.find(t => t.id === therapistId);
       if (staff && staff.password === password) { onLoginSuccess(staff); } else { setError('Invalid Therapist Selection or Password.'); }
   };

   return (
       <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100 max-w-sm mx-auto text-center mt-10 animate-fade-in">
           <div className="w-16 h-16 bg-red-50 rounded-full mx-auto flex items-center justify-center mb-6 text-[#123524]"><ShieldAlert className="w-8 h-8" /></div>
           <h2 className="text-xl font-bold text-gray-800 mb-2">Staff Portal Login</h2>
           <p className="text-xs font-bold text-gray-500 mb-6">Secure Access Only</p>
           <form onSubmit={handleLogin} className="space-y-4">
               <div>
                   <label className="block text-left text-xs font-bold text-gray-500 mb-1">Select Therapist</label>
                   <div className="relative">
                       <select required value={therapistId} onChange={e=>setTherapistId(e.target.value)} className="w-full p-3 bg-gray-50 border border-gray-200 rounded-lg outline-none focus:border-[#D4AF37] font-bold text-center tracking-wider appearance-none cursor-pointer text-gray-800">
                           <option value="" disabled>-- Select Your Profile --</option>
                           {therapists.map(t => (<option key={t.id} value={t.id}>{t.name}</option>))}
                       </select>
                       <div className="absolute inset-y-0 right-0 flex items-center px-4 pointer-events-none text-gray-400"><ChevronDown className="w-4 h-4" /></div>
                   </div>
               </div>
               <div>
                   <label className="block text-left text-xs font-bold text-gray-500 mb-1">Password</label>
                   <input required type="password" placeholder="Password" value={password} onChange={e=>setPassword(e.target.value)} className="w-full p-3 bg-gray-50 border border-gray-200 rounded-lg outline-none focus:border-[#D4AF37] font-bold text-center tracking-wider" />
               </div>
               {error && <div className="text-xs font-bold text-red-500">{error}</div>}
               <button type="submit" className="w-full py-3 bg-[#123524] text-white rounded-lg font-bold shadow-md hover:bg-green-900 transition flex items-center justify-center"><KeyRound className="w-4 h-4 mr-2"/> Verify and Login</button>
           </form>
       </div>
   );
}

function StaffSessionManager({ appData, loggedInStaff, onLogout }: { appData: AppData, loggedInStaff: TherapistProfile, onLogout: () => void }) {
   const [activeSession, setActiveSession] = useState<Booking | null>(null);
   const [showClockInFlow, setShowClockInFlow] = useState(false);
   const [loading, setLoading] = useState(true);
   const [staffTab, setStaffTab] = useState<'service' | 'history' | 'outpass'>('service');

   useEffect(() => {
       const q = query(collection(db, 'bookings'), orderBy('createdAt', 'desc'));
       const unsubscribe = onSnapshot(q, (snap) => {
           let foundActive = null;
           snap.forEach((doc) => {
               const b = { id: doc.id, ...doc.data() } as Booking;
               if (b.therapist === loggedInStaff.name && b.status === 'in_progress') { foundActive = b; }
           });
           setActiveSession(foundActive); setLoading(false);
       });
       return () => unsubscribe();
   }, [loggedInStaff.name]);

   const handleStopSession = async () => {
       if (!activeSession || !activeSession.id) return;
       if (!window.confirm("Are you sure you want to STOP this service now?")) return;
       try {
           const now = Date.now();
           const overtimeMillis = Math.max(0, now - (activeSession.expectedEndTimeMillis || now));
           await updateDoc(doc(db, 'bookings', activeSession.id), { status: 'completed', actualEndTimeMillis: now, overtimeSeconds: Math.floor(overtimeMillis / 1000) });
           setActiveSession(null);
       } catch (error) { console.error(error); alert("Error stopping session."); }
   };

   if (loading) return <div className="text-center py-20 font-bold text-gray-500">Loading Dashboard...</div>;

   return (
       <div className="bg-white p-4 sm:p-8 rounded-2xl shadow-sm border border-gray-100 animate-fade-in relative">
           <div className="flex justify-between items-center mb-6 pb-6 border-b border-gray-100">
               <div className="flex items-center">
                   <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-full overflow-hidden mr-3 sm:mr-4 border-2 border-[#123524] shadow-sm flex-shrink-0">
                       {loggedInStaff.images && loggedInStaff.images[0] ? <img src={loggedInStaff.images[0]} alt="Therapist" className="w-full h-full object-cover" /> : <User className="w-full h-full p-2 sm:p-3 text-gray-400 bg-gray-100" />}
                   </div>
                   <div>
                       <h2 className="text-xl sm:text-2xl font-bold text-[#123524]">{loggedInStaff.name}</h2>
                       <p className="text-[10px] sm:text-xs font-bold text-gray-500 mt-0.5">Professional Therapist</p>
                   </div>
               </div>
               <button onClick={onLogout} className="text-[10px] sm:text-xs font-bold text-red-500 flex items-center bg-red-50 px-2 sm:px-3 py-1.5 rounded-full hover:bg-red-100 transition border border-red-100 whitespace-nowrap"><LogOut className="w-3.5 h-3.5 sm:mr-1" /> <span className="hidden sm:inline">Log Out</span></button>
           </div>

           <div className="flex space-x-1 sm:space-x-2 mb-6 bg-gray-50 p-1.5 rounded-xl border border-gray-100">
              <button onClick={() => setStaffTab('service')} className={`flex-1 py-2 text-[10px] sm:text-xs font-bold rounded-lg transition ${staffTab === 'service' ? 'bg-white shadow text-[#123524]' : 'text-gray-500 hover:bg-gray-100'}`}>Service</button>
              <button onClick={() => setStaffTab('history')} className={`flex-1 py-2 text-[10px] sm:text-xs font-bold rounded-lg transition ${staffTab === 'history' ? 'bg-white shadow text-[#123524]' : 'text-gray-500 hover:bg-gray-100'}`}>History</button>
              <button onClick={() => setStaffTab('outpass')} className={`flex-1 py-2 text-[10px] sm:text-xs font-bold rounded-lg transition ${staffTab === 'outpass' ? 'bg-white shadow text-[#123524]' : 'text-gray-500 hover:bg-gray-100'}`}>Out Pass</button>
           </div>

           {staffTab === 'history' && <StaffDailyHistoryTab loggedInStaff={loggedInStaff} />}
           {staffTab === 'outpass' && <StaffOutPassTab appData={appData} loggedInStaff={loggedInStaff} />}
           {staffTab === 'service' && (
               activeSession ? (
                   <ActiveSessionDisplay session={activeSession} onStop={handleStopSession} />
               ) : showClockInFlow ? (
                   <div className="animate-fade-in mt-4">
                       <div className="flex items-center justify-between mb-6">
                           <button onClick={() => setShowClockInFlow(false)} className="text-xs font-bold text-gray-500 flex items-center bg-gray-100 px-3 py-1.5 rounded-lg hover:bg-gray-200"><ChevronLeft className="w-3 h-3 mr-1"/> BACK</button>
                       </div>
                       <div className="text-center mb-8 border-b border-gray-100 pb-6">
                          <h2 className="text-2xl font-bold text-[#123524] flex items-center justify-center"><CalendarPlus className="w-6 h-6 mr-2 text-[#D4AF37]"/> Staff Clock In</h2>
                          <p className="text-sm font-bold mt-2 text-[#D4AF37]">(ဆိုင်တွင်း / Outcall ဘိုကင်များ စာရင်းသွင်းရန်)</p>
                       </div>
                       <CustomerBookingWizard appData={appData} userPhone="" onBooked={() => {}} forceTherapistFirst={true} isStaffMode={true} staffClockIn={true} staffClockInSuccess={() => setShowClockInFlow(false)} preselectedStaff={loggedInStaff.name}/>
                   </div>
               ) : (
                   <div className="text-center py-16 sm:py-20 border-2 border-dashed border-gray-100 rounded-2xl bg-gray-50 mt-4">
                       <div className="w-20 h-20 sm:w-24 sm:h-24 bg-white rounded-full mx-auto flex items-center justify-center mb-6 sm:mb-8 text-[#D4AF37] shadow-inner border border-gray-100"><CheckCircle className="w-10 h-10 sm:w-12 sm:h-12" /></div>
                       <h3 className="text-xl sm:text-2xl font-bold text-gray-800 mb-2">Ready For Service</h3>
                       <p className="text-[10px] sm:text-xs font-bold text-gray-500 mb-8 sm:mb-10 max-w-sm mx-auto leading-relaxed px-4">No active session. Please click the button below to Clock In and start tracking your service time.</p>
                       <button onClick={() => setShowClockInFlow(true)} className="px-6 sm:px-10 py-3 sm:py-4 bg-[#123524] text-white rounded-xl font-bold shadow-lg flex items-center mx-auto hover:bg-green-900 transition text-sm"><Sparkles className="w-4 h-4 sm:w-5 sm:h-5 mr-2 text-[#D4AF37]"/> Clock In / Start New Service</button>
                   </div>
               )
           )}
       </div>
   );
}

function StaffDailyHistoryTab({ loggedInStaff }: { loggedInStaff: TherapistProfile }) {
    const [history, setHistory] = useState<Booking[]>([]);
    const [loading, setLoading] = useState(true);
    const todayStr = getLocalTodayStr();

    useEffect(() => {
        const q = query(collection(db, 'bookings'));
        const unsub = onSnapshot(q, (snap) => {
            const arr: Booking[] = [];
            snap.forEach(doc => {
                const b = { id: doc.id, ...doc.data() } as Booking;
                if (b.therapist === loggedInStaff.name && b.date === todayStr && (b.status === 'completed' || b.status === 'cancelled')) { arr.push(b); }
            });
            arr.sort((a,b) => (b.actualEndTimeMillis || 0) - (a.actualEndTimeMillis || 0));
            setHistory(arr); setLoading(false);
        });
        return () => unsub();
    }, [loggedInStaff.name, todayStr]);

    if (loading) return <div className="text-center py-10 text-xs font-bold text-gray-400">Loading...</div>;

    return (
        <div className="animate-fade-in mt-4">
            <h3 className="font-bold text-gray-800 mb-4 text-sm flex items-center"><History className="w-4 h-4 mr-2 text-[#D4AF37]"/> Today's Completed Services</h3>
            {history.length === 0 ? (
                <div className="text-center py-10 bg-gray-50 rounded-xl border border-gray-100 text-xs font-bold text-gray-400">No completed services today.</div>
            ) : (
                <div className="space-y-3">
                    {history.map(b => (
                        <div key={b.id} className="p-4 bg-gray-50 border border-gray-100 rounded-xl">
                            <div className="flex justify-between items-start mb-2">
                                <span className="font-bold text-sm text-[#123524]">{b.service.split('(')[0]}</span>
                                <span className={`text-[9px] px-2 py-0.5 rounded font-bold uppercase ${b.status === 'completed' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>{b.status}</span>
                            </div>
                            <div className="flex justify-between items-center text-xs text-gray-500">
                                <span>Cust: {b.name}</span>
                                <span>Slot: {b.time}</span>
                            </div>
                            {b.status === 'completed' && b.overtimeSeconds !== undefined && b.overtimeSeconds > 0 && (
                                <div className="mt-2 text-[10px] text-red-500 font-bold bg-red-50 p-1.5 rounded text-right">
                                    Overtime: +{Math.floor(b.overtimeSeconds / 60)} mins
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

function StaffOutPassTab({ appData, loggedInStaff }: { appData: AppData, loggedInStaff: TherapistProfile }) {
    const [outpasses, setOutpasses] = useState<OutPass[]>([]);
    const [loading, setLoading] = useState(true);
    const [reason, setReason] = useState('');
    const [locating, setLocating] = useState(false);
    const [locError, setLocError] = useState('');
    const todayStr = getLocalTodayStr();

    useEffect(() => {
        const q = query(collection(db, 'outpasses'));
        const unsub = onSnapshot(q, snap => {
            const arr: OutPass[] = [];
            snap.forEach(d => {
                const data = d.data() as OutPass;
                if (data.date === todayStr) arr.push({ id: d.id, ...data });
            });
            arr.sort((a,b) => b.outTimeMillis - a.outTimeMillis);
            setOutpasses(arr); setLoading(false);
        });
        return () => unsub();
    }, [todayStr]);

    const myPasses = outpasses.filter(o => o.therapist === loggedInStaff.name);
    const activePasses = outpasses.filter(o => o.status === 'out');
    const myActivePass = myPasses.find(o => o.status === 'out');

    const handleGoOut = async () => {
        if (activePasses.length >= 2) return;
        if (myPasses.length >= 4) return;
        if (!reason.trim()) { setLocError("အကြောင်းပြချက် (Reason) ရေးပေးပါ။"); return; }
        if (!appData.branding.shopLat || !appData.branding.shopLng) { setLocError("Admin Panel -> Settings တွင် ဆိုင်၏ Location အရင်သတ်မှတ်ပါ။"); return; }

        setLocating(true); setLocError('');

        if (!navigator.geolocation) { setLocError("ဖုန်းတွင် Location Service မရနိုင်ပါ။"); setLocating(false); return; }

        navigator.geolocation.getCurrentPosition(async (pos) => {
            const dist = calculateDistanceInMeters(pos.coords.latitude, pos.coords.longitude, appData.branding.shopLat!, appData.branding.shopLng!);
            if (dist > 15) { setLocError(`ဆိုင်နှင့် အကွာအဝေး ${Math.round(dist)} မီတာ ရှိနေပါသည်။ (၁၀ မီတာအတွင်းသာ နှိပ်ခွင့်ရှိသည်)`); setLocating(false); return; }

            const now = Date.now();
            await addDoc(collection(db, 'outpasses'), { therapist: loggedInStaff.name, date: todayStr, outTimeMillis: now, expectedInTimeMillis: now + 30 * 60 * 1000, status: 'out', reason: reason.trim() });
            setReason(''); setLocating(false);
        }, (err) => { setLocError("Location (GPS) ဖွင့်ပေးရန် လိုအပ်ပါသည်။"); setLocating(false); }, { enableHighAccuracy: true });
    };

    const handleReturn = async () => {
        if (!myActivePass || !myActivePass.id) return;
        if (!appData.branding.shopLat || !appData.branding.shopLng) { setLocError("Admin Panel -> Settings တွင် ဆိုင်၏ Location အရင်သတ်မှတ်ပါ။"); return; }

        setLocating(true); setLocError('');

        navigator.geolocation.getCurrentPosition(async (pos) => {
            const dist = calculateDistanceInMeters(pos.coords.latitude, pos.coords.longitude, appData.branding.shopLat!, appData.branding.shopLng!);
            if (dist > 15) { setLocError(`ဆိုင်နှင့် အကွာအဝေး ${Math.round(dist)} မီတာ ရှိနေပါသည်။ (၁၀ မီတာအတွင်းသာ နှိပ်ခွင့်ရှိသည်)`); setLocating(false); return; }

            const now = Date.now();
            const overtimeMillis = Math.max(0, now - myActivePass.expectedInTimeMillis);
            await updateDoc(doc(db, 'outpasses', myActivePass.id), { status: 'returned', inTimeMillis: now, overtimeSeconds: Math.floor(overtimeMillis / 1000) });
            setLocating(false);
        }, (err) => { setLocError("Location (GPS) ဖွင့်ပေးရန် လိုအပ်ပါသည်။"); setLocating(false); }, { enableHighAccuracy: true });
    };

    if (loading) return <div className="text-center py-10 text-xs font-bold text-gray-400">Loading...</div>;

    if (myActivePass) { return <OutPassActiveDisplay pass={myActivePass} onReturn={handleReturn} locating={locating} locError={locError} />; }

    const canGoOut = myPasses.length < 4 && activePasses.length < 2;

    return (
        <div className="bg-white py-6 sm:p-8 rounded-2xl text-center animate-fade-in mt-4">
            <div className="w-16 h-16 sm:w-20 sm:h-20 bg-purple-50 rounded-full mx-auto flex items-center justify-center mb-4 sm:mb-6 text-purple-600 border border-purple-100"><Coffee className="w-8 h-8 sm:w-10 sm:h-10" /></div>
            <h3 className="text-lg sm:text-xl font-bold text-gray-800 mb-2">Personal Out Pass</h3>
            <p className="text-xs text-gray-500 mb-6">တစ်ရက်လျှင် အများဆုံး ၄ ကြိမ် (၁ ကြိမ်လျှင် မိနစ် ၃၀) ထွက်ခွင့်ရှိပါသည်။<br/><span className="mt-2 inline-block bg-gray-100 px-3 py-1 rounded-full">ယနေ့ထွက်ပြီးသားအကြိမ်ရေ: <strong>{myPasses.length} / 4</strong></span></p>
            
            {!canGoOut && myPasses.length >= 4 && (<div className="bg-red-50 text-red-600 p-4 rounded-xl font-bold border border-red-100 text-[11px] sm:text-xs mb-6">ဒီနေ့အတွက် သင်၏ အပြင်ထွက်ခွင့် (၄ ကြိမ်) ပြည့်သွားပါပြီ။</div>)}
            {!canGoOut && myPasses.length < 4 && activePasses.length >= 2 && (<div className="bg-orange-50 text-orange-700 p-4 rounded-xl font-bold border border-orange-100 text-[11px] sm:text-xs mb-6 leading-relaxed">လက်ရှိတွင် ဝန်ထမ်း ၂ ယောက်<br/>({activePasses.map(p => p.therapist).join(', ')})<br/>အပြင်ထွက်နေပါသည်။ ၎င်းတို့ပြန်လာမှသာ ထွက်ခွင့်ရပါမည်။</div>)}

            {canGoOut && (
                <div className="mb-4 text-left max-w-xs mx-auto">
                   <label className="block text-xs font-bold text-gray-500 mb-1">အကြောင်းပြချက် (Reason)</label>
                   <input type="text" placeholder="ဥပမာ - စျေးဝယ်၊ မုန့်ဝယ်" value={reason} onChange={e=>setReason(e.target.value)} className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-lg outline-none focus:border-purple-400 text-xs" />
                </div>
            )}
            {locError && <div className="text-xs font-bold text-red-500 mb-4">{locError}</div>}
            <button disabled={!canGoOut || locating} onClick={handleGoOut} className="px-6 sm:px-8 py-3 sm:py-4 bg-purple-600 text-white rounded-xl font-bold shadow-md w-full sm:w-auto disabled:opacity-50 disabled:cursor-not-allowed hover:bg-purple-700 transition text-sm">
                {locating ? 'Checking Location...' : 'Clock Out (Take 30 Mins Pass)'}
            </button>

            {myPasses.filter(p => p.status === 'returned').length > 0 && (
                <div className="mt-10 text-left">
                    <h4 className="font-bold text-gray-800 text-xs sm:text-sm mb-3 px-1">Today's Out Pass History</h4>
                    <div className="space-y-2">
                        {myPasses.filter(p => p.status === 'returned').map(p => (
                            <div key={p.id} className="p-3 bg-gray-50 rounded-lg border border-gray-200 flex justify-between items-center text-xs">
                                <span className="text-gray-600 font-mono font-semibold">{new Date(p.outTimeMillis).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})} - {p.inTimeMillis ? new Date(p.inTimeMillis).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : ''}</span>
                                {(p.overtimeSeconds || 0) > 0 ? (
                                    <span className="text-red-500 font-bold bg-red-50 px-2 py-1 rounded">Late +{Math.floor(p.overtimeSeconds!/60)} mins</span>
                                ) : (
                                    <span className="text-green-600 font-bold bg-green-50 px-2 py-1 rounded">On Time</span>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}

function OutPassActiveDisplay({ pass, onReturn, locating, locError }: { pass: OutPass, onReturn: () => void, locating: boolean, locError: string }) {
    const [remainingTime, setRemainingTime] = useState<number | null>(null);
    const [overtimeSecs, setOvertimeSecs] = useState<number>(0);

    useEffect(() => {
        const updateTimer = () => {
            const now = Date.now();
            if (now < pass.expectedInTimeMillis) {
                setRemainingTime(Math.ceil((pass.expectedInTimeMillis - now) / 1000));
                setOvertimeSecs(0);
            } else {
                setRemainingTime(0);
                setOvertimeSecs(Math.floor((now - pass.expectedInTimeMillis) / 1000));
            }
        };
        updateTimer();
        const intervalId = setInterval(updateTimer, 1000);
        return () => clearInterval(intervalId);
    }, [pass.expectedInTimeMillis]);

    return (
        <div className="bg-white py-8 rounded-2xl text-center animate-fade-in mt-4 border border-gray-100 shadow-sm px-4">
            <div className="inline-flex items-center px-3 py-1 bg-purple-100 text-purple-700 text-[10px] font-bold uppercase tracking-wider rounded-full mb-6 border border-purple-200 animate-pulse"><Coffee className="w-3 h-3 mr-1.5"/> Personal Out Pass Active</div>
            
            {remainingTime !== null && remainingTime > 0 ? (
                <div className="mb-8">
                    <div className="text-xs font-bold text-gray-400 uppercase mb-2">REMAINING TIME</div>
                    <div className="text-5xl font-mono font-bold text-gray-800 tracking-tighter">{formatSecondsMMSS(remainingTime)}</div>
                </div>
            ) : (
                <div className="mb-8">
                    <div className="text-xs font-bold text-red-500 uppercase mb-2 animate-bounce">LATE (OVERTIME)</div>
                    <div className="text-5xl font-mono font-bold text-red-600 tracking-tighter">+{formatSecondsMMSS(overtimeSecs)}</div>
                </div>
            )}
            
            {locError && <div className="text-xs font-bold text-red-500 mb-4">{locError}</div>}
            <button disabled={locating} onClick={onReturn} className="w-full sm:w-auto sm:px-16 py-4 bg-[#123524] text-[#D4AF37] rounded-xl font-bold shadow-lg flex items-center justify-center hover:bg-[#1a4a32] transition border border-[#1a4a32] mx-auto text-sm disabled:opacity-50"><CheckCircle className="w-4 h-4 sm:w-5 sm:h-5 mr-2"/> {locating ? 'Checking Location...' : 'Clock In (Return)'}</button>
        </div>
    );
}

function ActiveSessionDisplay({ session, onStop }: { session: Booking, onStop: () => void }) {
   const [remainingTime, setRemainingTime] = useState<number | null>(null);
   const [overtimeSecs, setOvertimeSecs] = useState<number>(0);

   useEffect(() => {
       if (!session.expectedEndTimeMillis) return;
       const updateTimer = () => {
           const now = Date.now();
           if (now < session.expectedEndTimeMillis!) {
               setRemainingTime(Math.ceil((session.expectedEndTimeMillis! - now) / 1000));
               setOvertimeSecs(0);
           } else {
               setRemainingTime(0);
               setOvertimeSecs(Math.floor((now - session.expectedEndTimeMillis!) / 1000));
           }
       };
       updateTimer();
       const intervalId = setInterval(updateTimer, 1000);
       return () => clearInterval(intervalId);
   }, [session.expectedEndTimeMillis]);

   return (
       <div className="animate-fade-in space-y-6 mt-4">
           <div className="bg-white p-5 sm:p-6 rounded-xl border border-gray-100 flex flex-col sm:flex-row sm:flex-nowrap justify-between items-start sm:items-center">
               <div className="w-full sm:w-auto mb-6 sm:mb-0">
                   <StatusBadge status={session.status} />
                   <h3 className="text-lg sm:text-xl font-bold text-gray-800 mt-3">{session.service.split('(')[0]}</h3>
                   <div className="text-[10px] sm:text-xs text-gray-500 mt-1 flex items-center"><Calendar className="w-3 h-3 mr-1"/> {session.date} &nbsp; <Clock className="w-3 h-3 mx-1"/> Slot: {session.time}</div>
                   <div className="text-[10px] sm:text-xs font-bold mt-2 bg-yellow-50 px-2 py-1 rounded inline-block" style={{ color: THEME.gold }}>Customer: {session.name}</div>
               </div>
               <div className="text-left sm:text-right w-full sm:w-auto pt-4 sm:pt-0 border-t sm:border-0 border-gray-100">
                   {remainingTime !== null && remainingTime > 0 ? (
                       <>
                           <div className="text-[10px] sm:text-xs font-bold text-gray-400 uppercase">REMAINING TIME</div>
                           <div className="text-4xl sm:text-5xl font-mono font-bold text-gray-800 tracking-tighter">{formatTimeDisplay(remainingTime)}</div>
                           <div className="text-[10px] sm:text-xs font-bold text-gray-500 mt-0.5">Total Service: {session.service.split('(')[1]?.replace(')', '') || '-'}</div>
                       </>
                   ) : (
                       <div className="animate-pulse">
                           <div className="text-[10px] sm:text-xs font-bold text-red-500 uppercase">OVERTIME (အချိန်ပို)</div>
                           <div className="text-4xl sm:text-5xl font-mono font-bold text-red-600 tracking-tighter">+{formatTimeDisplay(overtimeSecs)}</div>
                           <div className="text-[10px] sm:text-xs font-bold text-red-400 mt-0.5">Duration passed expected time.</div>
                       </div>
                   )}
               </div>
           </div>
           
           <div className="flex justify-between items-center p-3 rounded-lg bg-gray-50 border border-gray-100 text-[10px] sm:text-xs text-gray-500">
               <span>Price: <strong className="text-gray-800 text-xs sm:text-sm">{formatPrice(session.totalPrice)}</strong></span>
               <span className="hidden sm:inline">TxID: <strong className="text-gray-800 text-sm tracking-wider">{session.txId}</strong></span>
               <span>Live: <strong className="text-gray-800 text-xs sm:text-sm">{formatTimeDisplay(Math.floor((Date.now() - (session.startTimeMillis || Date.now())) / 1000))}</strong></span>
           </div>

           <button onClick={onStop} className="w-full py-4 bg-red-500 text-white rounded-xl font-bold shadow-lg flex items-center justify-center mx-auto hover:bg-red-600 transition text-sm"><Trash2 className="w-4 h-4 sm:w-5 sm:h-5 mr-2"/> Stop Service / End Now</button>
       </div>
   );
}
အပိုင်း (၂) - Admin နှင့် Customer Booking Wizard ပိုင်း
TypeScript
// ==========================================
// 1.3 CUSTOMER BOOKING WIZARD (COMMON COMPONENT)
// ==========================================
function CustomerBookingWizard({ appData, userPhone, onBooked, forceTherapistFirst = false, initialTherapist = null, isStaffMode = false, staffClockIn = false, staffClockInSuccess, preselectedStaff }: { appData: AppData, userPhone: string, onBooked: (phone: string) => void, forceTherapistFirst?: boolean, initialTherapist?: TherapistProfile | null, isStaffMode?: boolean, staffClockIn?: boolean, staffClockInSuccess?: () => void, preselectedStaff?: string }) {
  const isTherapistFirst = forceTherapistFirst || new URLSearchParams(window.location.search).get('view') === 'therapists';
  
  const [step, setStep] = useState(() => {
      if (staffClockIn) return isTherapistFirst ? 2 : 1;
      return initialTherapist ? 2 : 1;
  });
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [formData, setFormData] = useState({ name: isStaffMode ? 'Walk-in Guest' : '', phone: userPhone, selectedItem: null as MenuItem | null, isVvipUpgrade: false, therapist: initialTherapist, date: '', time: '', paymentMethod: '', txId: '', specialRequest: '' });
  const [loading, setLoading] = useState(false);
  const [paymentDropdownOpen, setPaymentDropdownOpen] = useState(false);
  const [viewGallery, setViewGallery] = useState<{ images: string[], index: number } | null>(null);
  const [successMsg, setSuccessMsg] = useState('');
  
  const [allBookings, setAllBookings] = useState<Booking[]>([]);
  const stepContainerRef = useRef<HTMLDivElement>(null);
  const todayStr = getLocalTodayStr();

  useEffect(() => {
      const q = query(collection(db, 'bookings'));
      const unsub = onSnapshot(q, (snap) => {
          const arr: Booking[] = [];
          snap.forEach(d => arr.push({id: d.id, ...d.data()} as Booking));
          setAllBookings(arr);
      });
      return () => unsub();
  }, []);

  useEffect(() => {
     if (preselectedStaff && !formData.therapist) {
         const t = appData.therapists.find(staff => staff.name === preselectedStaff);
         if (t) setFormData(prev => ({...prev, therapist: t}));
     }
  }, [preselectedStaff, appData.therapists, formData.therapist]);

  useEffect(() => {
      if (staffClockIn && formData.date === todayStr && (!formData.time || !/^\d{2}:\d{2}$/.test(formData.time))) {
          const now = new Date();
          const hhmm = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
          setFormData(prev => ({ ...prev, time: hhmm }));
      }
  }, [staffClockIn, formData.date, todayStr]);

  const safePaymentMethods = Array.isArray(appData?.paymentMethods) ? appData.paymentMethods : [];
  const selectedPaymentConfig = safePaymentMethods.find(p => p.name === formData.paymentMethod);

  const getAvailableTimeSlots = () => {
    if (!formData.selectedItem) return [];
    const isHotelService = appData.categories.find(c => c.id === 'hotel')?.items.some(i => i.id === formData.selectedItem?.id);
    const serviceName = formData.selectedItem.name.toLowerCase();
    let allowedSlots = ALL_TIME_SLOTS;

    if (isHotelService) {
      if (serviceName.includes("day & night") || serviceName.includes("day and night") || serviceName.includes("24 hour")) return ["7:00 AM to 7:00 AM (Next Day)"];
      else if (serviceName.includes("outcall")) allowedSlots = ALL_TIME_SLOTS.slice(ALL_TIME_SLOTS.indexOf("7:00 AM"), ALL_TIME_SLOTS.indexOf("7:00 PM") + 1);
      else if (serviceName.includes("half day")) return ["6:00 AM to 12:00 PM", "12:00 PM to 6:00 PM"];
      else if (serviceName.includes("night")) return ["7:00 PM to 7:00 AM (Next Day)"];
      else if (serviceName.includes("whole day")) return ["7:00 AM to 7:00 PM"];
    } else {
       allowedSlots = ALL_TIME_SLOTS.slice(ALL_TIME_SLOTS.indexOf("9:00 AM"), ALL_TIME_SLOTS.indexOf("9:00 PM") + 1);
    }
    return allowedSlots;
  };
  const availableTimeSlots = getAvailableTimeSlots();

  const getMinMaxDates = () => {
    const d = new Date(); 
    const minDateStr = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
    d.setDate(d.getDate() + 3); 
    const maxDateStr = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
    return { minDateStr, maxDateStr };
  }
  const { minDateStr, maxDateStr } = getMinMaxDates();

  const isHotelService = appData.categories.find(c => c.id === 'hotel')?.items.some(i => i.id === formData.selectedItem?.id) || false;

  const checkPromoActive = () => {
      const promo = appData.promotion;
      if (!promo?.isActive) return false;
      if (!promo.startDate || !promo.endDate) return false;
      const today = new Date(getLocalTodayStr()).getTime();
      const sDate = new Date(promo.startDate).getTime();
      const eDate = new Date(promo.endDate).getTime();
      return today >= sDate && today <= eDate;
  };

  const promoActive = checkPromoActive();
  const discountPercent = promoActive 
      ? (isHotelService ? (appData.promotion?.hotelDiscountPercent || 0) : (appData.promotion?.otherDiscountPercent || 0)) 
      : 0;

  const calculateSubTotal = () => {
    if (!formData.selectedItem) return 0;
    const basePrice = Number(formData.selectedItem.price) || 0;
    const vvipPrice = Number(formData.selectedItem.vvipPrice) || 0;
    return formData.isVvipUpgrade && vvipPrice > 0 ? vvipPrice : basePrice;
  };

  const calculateDiscountAmount = () => {
      return (calculateSubTotal() * discountPercent) / 100;
  };

  const calculateTotal = () => {
      return calculateSubTotal() - calculateDiscountAmount();
  };

  const handleCopy = (text: string) => {
    if (navigator.clipboard && navigator.clipboard.writeText) { navigator.clipboard.writeText(text); alert('Copied!'); }
    else { alert("Copying manually required: " + text); }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleNextStep = (nextStep: number) => {
    setStep(nextStep);
    if (stepContainerRef.current) { stepContainerRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' }); } 
    else { window.scrollTo({ top: 0, behavior: 'smooth' }); }
  };

  const handleCountdownExpire = () => {
     if (isStaffMode) return;
     alert("ငွေပေးချေရန် သတ်မှတ်ချိန် (၁၅) မိနစ် ကုန်ဆုံးသွားပါပြီ။ ကျေးဇူးပြု၍ ဘိုကင် အသစ်ပြန်လည်တင်ပေးပါ။");
     setStep(1); setFormData({ name: '', phone: userPhone, selectedItem: null, isVvipUpgrade: false, therapist: null, date: '', time: '', paymentMethod: '', txId: '', specialRequest: '' });
  };
  const formattedCountdown = useCountdown(isStaffMode ? 0 : 15, handleCountdownExpire);

  const getBlockedSlots = (bookings: Booking[], selectedTherapistName: string, selectedDate: string) => {
      let blocked = new Set<string>();
      if (!selectedTherapistName || selectedTherapistName === 'Any Available Therapist') return blocked; 
      
      bookings.forEach(b => {
          if (b.status === 'cancelled' || b.status === 'completed') return; 
          if (b.date !== selectedDate) return;
          if (b.therapist !== selectedTherapistName) return;

          if (b.status === 'in_progress' && b.startTimeMillis) {
               const end = Math.max(Date.now(), b.expectedEndTimeMillis || Date.now());
               getSlotsCoveredByInterval(b.startTimeMillis!, end, b.date).forEach(slot => blocked.add(slot));
          } else if (b.time && b.time.includes("to")) {
              const [start, endRaw] = b.time.split(" to ");
              const end = endRaw.replace(" (Next Day)", "");
              const sIdx = ALL_TIME_SLOTS.indexOf(start);
              let eIdx = ALL_TIME_SLOTS.indexOf(end);
              
              if (endRaw.includes("Next Day") || (eIdx !== -1 && eIdx <= sIdx)) {
                  eIdx = ALL_TIME_SLOTS.length; 
              }

              if (sIdx !== -1 && eIdx !== -1) {
                  for (let i = sIdx; i < eIdx; i++) blocked.add(ALL_TIME_SLOTS[i]);
              }
              blocked.add(b.time); 
          } else if (b.time) {
              const sIdx = ALL_TIME_SLOTS.indexOf(b.time);
              if (sIdx !== -1) {
                  let slotsToBlock = 2; 
                  const match = b.service.match(/(\d+)\s*Mins/i);
                  if (match) slotsToBlock = Math.ceil(parseInt(match[1]) / 30);
                  
                  for (let i = sIdx; i < sIdx + slotsToBlock; i++) {
                      if (ALL_TIME_SLOTS[i]) blocked.add(ALL_TIME_SLOTS[i]);
                  }
              }
          }
      });
      return blocked;
  };

  const isTherapistFullForDate = (tName: string, dateToCheck: string) => {
      const blockedNow = getBlockedSlots(allBookings, tName, dateToCheck);
      let neededSlots = 2; 
      if (formData.selectedItem) {
          const match = formData.selectedItem.duration.match(/(\d+)\s*Mins/i);
          if (match) neededSlots = Math.ceil(parseInt(match[1]) / 30);
      }

      const allowedSlots = formData.selectedItem ? getAvailableTimeSlots() : ALL_TIME_SLOTS.slice(ALL_TIME_SLOTS.indexOf("9:00 AM"), ALL_TIME_SLOTS.indexOf("9:00 PM") + 1);

      let hasAvailableSlot = false;
      for (const t of allowedSlots) {
          if (t.includes("to")) {
              const [start, endRaw] = t.split(" to ");
              const end = endRaw.replace(" (Next Day)", "");
              const sIdx = ALL_TIME_SLOTS.indexOf(start);
              let eIdx = ALL_TIME_SLOTS.indexOf(end);
              
              if (endRaw.includes("Next Day") || (eIdx !== -1 && eIdx <= sIdx)) {
                  eIdx = ALL_TIME_SLOTS.length;
              }

              let overlap = false;
              if (sIdx !== -1 && eIdx !== -1) {
                  for (let i = sIdx; i < eIdx; i++) {
                      if (blockedNow.has(ALL_TIME_SLOTS[i])) { overlap = true; break; }
                  }
              }
              if (blockedNow.has(t)) overlap = true;
              if (!overlap) { hasAvailableSlot = true; break; }
          } else {
              const sIdx = ALL_TIME_SLOTS.indexOf(t);
              if (sIdx === -1) continue;

              let overlap = false;
              for (let i = 0; i < neededSlots; i++) {
                  if (!ALL_TIME_SLOTS[sIdx + i] || blockedNow.has(ALL_TIME_SLOTS[sIdx + i])) { overlap = true; break; }
              }
              if (!overlap) { hasAvailableSlot = true; break; }
          }
      }
      return !hasAvailableSlot;
  };

  const blockedSlots = getBlockedSlots(allBookings, formData.therapist?.name || '', formData.date);

  const isSlotAvailable = (t: string) => {
      if (blockedSlots.has(t)) return false;
      if (t.includes("to")) {
          const [start, endRaw] = t.split(" to ");
          const end = endRaw.replace(" (Next Day)", "");
          const sIdx = ALL_TIME_SLOTS.indexOf(start);
          let eIdx = ALL_TIME_SLOTS.indexOf(end);
          
          if (endRaw.includes("Next Day") || (eIdx !== -1 && eIdx <= sIdx)) {
              eIdx = ALL_TIME_SLOTS.length;
          }

          if (sIdx !== -1 && eIdx !== -1) {
              for (let i = sIdx; i < eIdx; i++) {
                  if (blockedSlots.has(ALL_TIME_SLOTS[i])) return false;
              }
          }
          return true;
      }
      const sIdx = ALL_TIME_SLOTS.indexOf(t);
      if (sIdx === -1) return true;
      let neededSlots = 2;
      if (formData.selectedItem) {
          const match = formData.selectedItem.duration.match(/(\d+)\s*Mins/i);
          if (match) neededSlots = Math.ceil(parseInt(match[1]) / 30);
      }
      for (let i = 0; i < neededSlots; i++) {
          if (!ALL_TIME_SLOTS[sIdx + i] || blockedSlots.has(ALL_TIME_SLOTS[sIdx + i])) return false;
      }
      return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isStaffMode && formData.txId.length !== 6) { alert("Transaction ID နောက်ဆုံး ၆ လုံးကို မှန်ကန်စွာ ဖြည့်ပေးပါ။"); return; }
    setLoading(true);
    
    try {
      const freshSnap = await getDocs(query(collection(db, 'bookings')));
      const freshBookings: Booking[] = [];
      freshSnap.forEach(d => freshBookings.push({id: d.id, ...d.data()} as Booking));
      
      const blockedNow = getBlockedSlots(freshBookings, formData.therapist?.name || '', formData.date);
      let isOverlap = false;
      
      const isStaffImmediate = staffClockIn && formData.date === todayStr && /^\d{2}:\d{2}$/.test(formData.time);

      let fluidStartTimeMillis = Date.now();
      let expectedEndTimeMillis = Date.now();
      let durationMins = 60;
      let finalTimeStr = formData.time;

      if (formData.selectedItem) {
         const match = formData.selectedItem.duration.match(/(\d+)\s*Mins/i);
         if (match) durationMins = parseInt(match[1]);
      }

      if (isStaffImmediate) {
          const [h, m] = formData.time.split(':').map(Number);
          const ampm = h >= 12 ? 'PM' : 'AM';
          const hrs12 = h % 12 || 12;
          finalTimeStr = `${hrs12}:${m.toString().padStart(2, '0')} ${ampm}`;

          const [y, mo, d] = formData.date.split('-');
          const startDateTime = new Date(Number(y), Number(mo)-1, Number(d));
          startDateTime.setHours(h, m, 0, 0);
          
          fluidStartTimeMillis = startDateTime.getTime();
          expectedEndTimeMillis = fluidStartTimeMillis + (durationMins * 60 * 1000);

          freshBookings.forEach(b => {
              if (b.therapist !== formData.therapist?.name || b.status === 'cancelled' || b.status === 'completed' || b.date !== formData.date) return;
              
              let otherStart = 0, otherEnd = 0;
              if (b.status === 'in_progress' && b.startTimeMillis) {
                  otherStart = b.startTimeMillis;
                  otherEnd = Math.max(Date.now(), b.expectedEndTimeMillis || Date.now());
              } else if (b.time && b.time !== 'NOW' && !b.time.includes('to')) {
                  const [oy, omo, od] = b.date.split('-');
                  const slotTime = new Date(Number(oy), Number(omo)-1, Number(od));
                  
                  if (b.time.includes('AM') || b.time.includes('PM')) {
                      const [tPart, oampm] = b.time.split(' ');
                      let [sh, sm] = tPart.split(':').map(Number);
                      if (oampm === 'PM' && sh < 12) sh += 12;
                      if (oampm === 'AM' && sh === 12) sh = 0;
                      slotTime.setHours(sh, sm, 0, 0);
                  } else {
                      let [sh, sm] = b.time.split(':').map(Number);
                      slotTime.setHours(sh, sm, 0, 0);
                  }

                  otherStart = slotTime.getTime();
                  let bDur = 60;
                  const bMatch = b.service.match(/(\d+)\s*Mins/i);
                  if (bMatch) bDur = parseInt(bMatch[1]);
                  otherEnd = otherStart + bDur * 60000;
              } else {
                  return; 
              }

              if (fluidStartTimeMillis < otherEnd && expectedEndTimeMillis > otherStart) {
                  isOverlap = true;
              }
          });

      } else {
          if (formData.time.includes("to")) {
              const [start, endRaw] = formData.time.split(" to ");
              const end = endRaw.replace(" (Next Day)", "");
              const sIdx = ALL_TIME_SLOTS.indexOf(start);
              let eIdx = ALL_TIME_SLOTS.indexOf(end);
              if (endRaw.includes("Next Day") || (eIdx !== -1 && eIdx <= sIdx)) { eIdx = ALL_TIME_SLOTS.length; }

              if (sIdx !== -1 && eIdx !== -1) {
                  for (let i = sIdx; i < eIdx; i++) {
                      if (blockedNow.has(ALL_TIME_SLOTS[i])) { isOverlap = true; break; }
                  }
              }
              if (blockedNow.has(formData.time)) isOverlap = true;
          } else {
              const sIdx = ALL_TIME_SLOTS.indexOf(formData.time);
              let neededSlots = 2; 
              const match = formData.selectedItem?.duration.match(/(\d+)\s*Mins/i);
              if (match) neededSlots = Math.ceil(parseInt(match[1]) / 30);
              for (let i = 0; i < neededSlots; i++) { 
                  if (!ALL_TIME_SLOTS[sIdx + i] || blockedNow.has(ALL_TIME_SLOTS[sIdx + i])) { isOverlap = true; break; }
              }
          }
      }

      if (isOverlap) {
         alert("ဆောရီးပါ.. သင်ရွေးချယ်ထားသော အချိန်သည် အခြားသူ ဘိုကင်တင်ထားသည်နှင့် ထပ်နေပါသည်။ ကျေးဇူးပြု၍ အချိန် ပြန်ရွေးပေးပါ။");
         setLoading(false); return;
      }

      if (formData.phone && formData.phone.trim() !== '') {
        const userRef = doc(db, 'users', formData.phone);
        const userSnap = await getDoc(userRef);
        if (!userSnap.exists()) {
          await setDoc(userRef, { phone: formData.phone, name: formData.name, password: '', createdAt: Date.now() });
        } else if (!userSnap.data().name) {
          await updateDoc(userRef, { name: formData.name });
        }
      }

      const dataToSave = {
        name: formData.name || (staffClockIn ? 'Walk-in (Staff-initiated)' : 'Walk-in Guest'), 
        phone: formData.phone || '-',
        service: `${formData.selectedItem?.name} ${formData.selectedItem?.duration ? `(${formData.selectedItem.duration})` : ''} ${formData.isVvipUpgrade ? '+ VVIP Upgrade' : ''} ${formData.selectedItem?.vvipIncluded ? '(VVIP Included)' : ''}`,
        therapist: formData.therapist?.name || 'Any Available Therapist',
        date: formData.date, 
        time: finalTimeStr, 
        paymentMethod: isStaffMode ? 'Cash Payment in Shop' : formData.paymentMethod, 
        txId: isStaffMode ? 'CASH' : formData.txId, 
        totalPrice: calculateTotal(), 
        status: isStaffImmediate ? 'in_progress' : (isStaffMode ? 'approved' : 'pending'), 
        createdAt: Date.now(),
        specialRequest: formData.specialRequest,
        ...(isStaffImmediate && {
           startTimeMillis: fluidStartTimeMillis,
           expectedEndTimeMillis: expectedEndTimeMillis
        })
      };
      await addDoc(collection(db, 'bookings'), dataToSave);
      setSuccessMsg('Booking အောင်မြင်စွာ တင်ပြီးပါပြီ။' + (isStaffMode ? '' : ' Admin မှ မကြာမီ ပြန်လည်ဆက်သွယ် အတည်ပြုပေးပါမည်။'));
    } catch (error) { console.error(error); alert("Booking တင်ရာတွင် အခက်အခဲရှိနေပါသည်။"); }
    setLoading(false);
  };

  if (successMsg) {
    return (
      <div className="bg-white p-10 rounded-2xl shadow-lg text-center border border-gray-100 max-w-lg mx-auto mt-10 animate-fade-in">
        <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6"><CheckCircle className="w-10 h-10 text-green-600" /></div>
        <h2 className="text-2xl font-bold mb-3" style={{ color: THEME.primary }}>Booking Confirmed!</h2>
        <p className="text-gray-600 mb-8 leading-relaxed font-semibold">{successMsg}</p>
        <button onClick={() => { 
           if (staffClockInSuccess) {
               staffClockInSuccess();
               return;
           }
           if (isStaffMode) {
               setStep(1);
               setFormData({ name: 'Walk-in Guest', phone: '', selectedItem: null, isVvipUpgrade: false, therapist: initialTherapist, date: '', time: '', paymentMethod: '', txId: '', specialRequest: '' });
               setSuccessMsg('');
               window.scrollTo({ top: 0, behavior: 'smooth' });
           } else {
               setSuccessMsg(''); 
               onBooked(formData.phone); 
           }
        }} className="px-8 py-3 font-bold rounded-lg transition text-white w-full shadow-md hover:opacity-90" style={{ backgroundColor: THEME.primary }}>
           {staffClockIn ? 'Finish' : (isStaffMode ? 'နောက်ထပ် ဘိုကင်တင်မည် (Add Another)' : 'မှတ်တမ်းကြည့်ရန် (View History)')}
        </button>
      </div>
    );
  }

  const steps = isTherapistFirst
    ? [{ num: 1, label: 'THERAPIST', icon: User }, { num: 2, label: 'SERVICE', icon: Sparkles }, { num: 3, label: 'DATE & TIME', icon: Calendar }, { num: 4, label: 'CONFIRM', icon: CreditCard }]
    : [{ num: 1, label: 'SERVICE', icon: Sparkles }, { num: 2, label: 'THERAPIST', icon: User }, { num: 3, label: 'DATE & TIME', icon: Calendar }, { num: 4, label: 'CONFIRM', icon: CreditCard }];

  const renderStepper = () => (
    <div ref={stepContainerRef} className="flex items-center justify-center mb-10 w-full max-w-lg mx-auto scroll-mt-6">
      {steps.map((s, idx) => {
        const isCompleted = step > s.num; const isActive = step === s.num;
        return (
          <React.Fragment key={s.num}>
            <div className="flex flex-col items-center relative z-10">
              <div className={`w-10 h-10 sm:w-12 sm:h-12 rounded-full flex items-center justify-center transition-all duration-300 border-2 ${isCompleted ? 'bg-[#D4AF37] border-[#D4AF37] text-white' : isActive ? 'bg-[#123524] border-[#123524] text-white' : 'bg-white border-gray-200 text-gray-400'}`}>
                {isCompleted ? <Check className="w-5 h-5" /> : <s.icon className="w-4 h-4 sm:w-5 sm:h-5" />}
              </div>
              <span className={`text-[9px] sm:text-[10px] uppercase tracking-wider font-bold mt-2 absolute -bottom-5 w-24 text-center ${isActive ? 'text-[#123524]' : 'text-gray-400'}`}>{s.label}</span>
            </div>
            {idx < steps.length - 1 && <div className={`flex-1 h-[2px] mx-1 transition-colors duration-300 ${isCompleted ? 'bg-[#D4AF37]' : 'bg-gray-200'}`} />}
          </React.Fragment>
        );
      })}
    </div>
  );

  const renderServiceSelection = (currentStep: number) => (
    <div className="animate-fade-in">
      {promoActive && (
          <div className="bg-green-50 border border-green-200 p-4 rounded-xl mb-6 shadow-sm flex items-start animate-fade-in">
             <Sparkles className="w-6 h-6 text-green-600 mr-3 flex-shrink-0 mt-0.5" />
             <div>
                <h4 className="font-bold text-green-800 text-sm">🎉 App Special Promotion!</h4>
                <p className="text-xs text-green-700 mt-1 font-semibold leading-relaxed">
                   Hotel & Home Services: {appData.promotion?.hotelDiscountPercent}% OFF <br/>
                   Other Services: {appData.promotion?.otherDiscountPercent}% OFF <br/>
                   <span className="text-[10px] text-green-600/80 bg-green-100 px-2 py-0.5 rounded mt-1 inline-block border border-green-200">Valid until: {appData.promotion?.endDate}</span>
                </p>
             </div>
          </div>
      )}

      <div className="text-center mb-8"><h2 className="text-2xl font-bold" style={{ color: THEME.primary }}>Choose Your Service</h2><p className="text-sm font-bold mt-2" style={{ color: THEME.gold }}>(သင်ရယူလိုသော ဝန်ဆောင်မှုကို ရွေးချယ်ပါ)</p></div>
      <div className="space-y-4">{appData.categories.map(category => {
        const CategoryIcon = ICON_MAP[category.id] || Activity;
        return (
          <div key={category.id} className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <div onClick={() => setActiveCategory(activeCategory === category.id ? null : category.id)} className="p-4 flex items-center justify-between cursor-pointer hover:bg-gray-50 transition">
              <div className="flex items-center text-sm font-bold" style={{ color: THEME.primary }}><CategoryIcon className="w-5 h-5 mr-3" style={{ color: THEME.gold }} /> {category.title}</div>
              {activeCategory === category.id ? <ChevronUp className="w-6 h-6" style={{ color: THEME.primary }} /> : <ChevronDown className="w-6 h-6" style={{ color: THEME.primary }} />}
            </div>
            {activeCategory === category.id && (
              <div className="p-2 border-t border-gray-100 bg-gray-50/50">{category.items.map(s => (
                <div key={s.id} onClick={() => setFormData({ ...formData, selectedItem: s, isVvipUpgrade: false })} className={`flex justify-between items-center p-4 my-2 mx-2 rounded-lg cursor-pointer border transition-all duration-200 ${formData.selectedItem?.id === s.id ? 'border-[#D4AF37] bg-yellow-50 shadow-sm' : 'border-gray-200 bg-white hover:border-[#D4AF37]'}`}>
                  <div><div className="font-bold text-gray-800 text-sm">{s.name}</div>{s.duration && <div className="text-xs text-gray-500 mt-1">{s.duration}</div>}</div>
                  <div className="font-bold text-sm" style={{ color: THEME.primary }}>{formatPrice(s.price)}</div>
                </div>
              ))}</div>
            )}
          </div>
        )
      })}</div>
      <div className="bg-yellow-50 rounded-xl p-4 border border-yellow-200 mt-6 flex justify-between items-center shadow-sm">
        <div className="flex items-center"><div className="w-10 h-10 bg-yellow-100 rounded-lg flex items-center justify-center mr-4"><Crown className="w-5 h-5" style={{ color: THEME.gold }} /></div><div><div className="font-bold text-yellow-800 text-sm">VVIP Master Room</div><div className="text-xs text-yellow-600 font-semibold mt-1">{formData.selectedItem?.vvipIncluded ? '✅ Included (Free)' : (!formData.selectedItem ? 'Select a service' : (formData.selectedItem.vvipPrice ? 'Upgrade for extra comfort' : 'Not available'))}</div></div></div>
        {formData.selectedItem?.vvipIncluded ? <span className="bg-green-100 text-green-700 px-3 py-1 rounded-full text-xs font-bold border border-green-200">INCLUDED</span> : <button type="button" disabled={!formData.selectedItem?.vvipPrice} onClick={() => setFormData({ ...formData, isVvipUpgrade: !formData.isVvipUpgrade })} className={`w-12 h-6 rounded-full p-1 transition-colors duration-300 ${formData.isVvipUpgrade ? 'bg-green-600' : 'bg-gray-300'} ${!formData.selectedItem?.vvipPrice ? 'opacity-50' : ''}`}><div className={`w-4 h-4 bg-white rounded-full shadow-md transform transition-transform ${formData.isVvipUpgrade ? 'translate-x-6' : 'translate-x-0'}`} /></button>}
      </div>
      <div className={`mt-8 flex ${currentStep === 1 ? 'justify-end' : 'justify-between'}`}>
        {currentStep === 2 && <button onClick={() => handleNextStep(1)} className="px-6 py-4 rounded-lg font-bold text-gray-600 bg-white border border-gray-300 hover:bg-gray-50 transition">BACK</button>}
        <button disabled={!formData.selectedItem} onClick={() => handleNextStep(currentStep + 1)} className="px-8 py-4 rounded-lg font-bold text-white transition disabled:opacity-50 shadow-md hover:opacity-90 flex items-center" style={{ backgroundColor: THEME.primary }}>
          {isTherapistFirst && currentStep === 2 ? 'CONTINUE TO DATE & TIME' : 'CONTINUE TO THERAPIST'} <ChevronRight className="w-5 h-5 ml-2" />
        </button>
      </div>
    </div>
  );

  const renderTherapistSelection = (currentStep: number) => (
    <div className="animate-fade-in relative">
      {viewGallery && (
        <div className="fixed inset-0 z-[100] bg-black/95 flex flex-col items-center justify-center backdrop-blur-sm animate-fade-in">
          <button onClick={() => setViewGallery(null)} className="absolute top-4 right-4 z-[110] text-white p-2 hover:text-[#D4AF37] transition bg-black/50 rounded-full"><X className="w-8 h-8" /></button>
          <div className="relative w-full flex-1 flex items-center justify-center overflow-hidden py-10 px-0 sm:px-10">
            <img src={viewGallery.images[viewGallery.index]} alt="Detail" className="w-full h-full object-contain drop-shadow-2xl" />
            {viewGallery.images.length > 1 && (
              <>
                <button onClick={(e) => { e.stopPropagation(); setViewGallery({ ...viewGallery, index: (viewGallery.index - 1 + viewGallery.images.length) % viewGallery.images.length }) }} className="absolute left-2 sm:left-8 top-1/2 -translate-y-1/2 bg-black/40 hover:bg-black/70 text-white p-3 rounded-full transition z-[110] border border-white/10"><ChevronLeft className="w-6 h-6 sm:w-8 sm:h-8" /></button>
                <button onClick={(e) => { e.stopPropagation(); setViewGallery({ ...viewGallery, index: (viewGallery.index + 1) % viewGallery.images.length }) }} className="absolute right-2 sm:right-8 top-1/2 -translate-y-1/2 bg-black/40 hover:bg-black/70 text-white p-3 rounded-full transition z-[110] border border-white/10"><ChevronRight className="w-6 h-6 sm:w-8 sm:h-8" /></button>
              </>
            )}
          </div>
          <div className="absolute bottom-6 text-white font-bold tracking-widest text-sm bg-black/50 px-4 py-1.5 rounded-full z-[110]">{viewGallery.index + 1} / {viewGallery.images.length}</div>
        </div>
      )}

      <div className="text-center mb-8"><h2 className="text-2xl font-bold" style={{ color: THEME.primary }}>Select Your Therapist</h2><p className="text-sm font-bold mt-2" style={{ color: THEME.gold }}>(ဘိုကင်ယူထားလိုသော ဝန်ထမ်းနံပါတ်ကို ရွေးချယ်ပါ)</p></div>
      <div onClick={() => setFormData({ ...formData, therapist: null })} className={`flex items-center p-4 mb-6 rounded-xl cursor-pointer border transition-all duration-200 ${!formData.therapist ? 'border-[#D4AF37] bg-yellow-50 shadow-sm' : 'border-gray-200 bg-white hover:border-[#D4AF37]'}`}><div className="w-12 h-12 bg-gray-200 rounded-full flex items-center justify-center mr-4"><User className="w-6 h-6 text-gray-500" /></div><div><div className="font-bold text-gray-800">Any Available Therapist</div><div className="text-xs text-gray-500 mt-1">We&apos;ll assign the best available therapist for you</div></div></div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        {appData.therapists.map((therapist) => {
          const isSelected = formData.therapist?.id === therapist.id; const hasImage = therapist.images && therapist.images.length > 0;
          
          const checkDate = formData.date || todayStr;
          const isFull = isTherapistFullForDate(therapist.name, checkDate);
          const fullTextEn = checkDate === todayStr ? "Fully Booked For Today" : "Fully Booked";
          const fullTextMm = checkDate === todayStr ? "(ဒီနေ့အတွက် ဘိုကင်ပြည့်သွားပါပြီ)" : "(ဘိုကင်ပြည့်သွားပါပြီ)";

          return (
            <div key={therapist.id} onClick={() => !isFull && setFormData({ ...formData, therapist: therapist })} className={`flex flex-col items-center p-3 rounded-xl transition-all border-2 relative overflow-hidden ${isFull ? 'cursor-not-allowed border-gray-200 bg-gray-50' : isSelected ? 'border-[#D4AF37] bg-yellow-50 shadow-lg transform scale-105 cursor-pointer' : 'border-transparent bg-white hover:border-[#D4AF37]/50 hover:shadow-md cursor-pointer'}`}>
              {isFull && (
                <div className="absolute inset-0 z-20 bg-white/50 backdrop-blur-[2px] flex items-center justify-center">
                  <div className="bg-red-600 text-white font-bold px-2 py-1.5 rounded shadow-xl transform -rotate-12 text-center w-11/12 border border-red-500">
                    <div className="text-[10px] sm:text-xs leading-tight">{fullTextEn}</div>
                    <div className="text-[8px] sm:text-[9px] leading-tight mt-1 text-red-50">{fullTextMm}</div>
                  </div>
                </div>
              )}
              <div className={`w-full aspect-[3/4] rounded-lg overflow-hidden mb-3 bg-gray-100 flex items-center justify-center shadow-inner relative border-2 transition-colors ${isSelected ? 'border-[#D4AF37]' : 'border-[#123524]'} ${isFull ? 'opacity-40 grayscale' : ''}`}>
                {hasImage ? (
                  <>
                    <img src={therapist.images[0]} alt={therapist.name} className="w-full h-full object-cover" />
                    {therapist.images.length > 1 && (
                      <button onClick={(e) => { e.stopPropagation(); setViewGallery({ images: therapist.images, index: 0 }); }} className="absolute bottom-2 inset-x-2 bg-[#123524]/90 hover:bg-[#123524] text-[#D4AF37] text-[10px] font-bold py-1 px-1 rounded flex flex-col items-center justify-center backdrop-blur-sm border border-[#D4AF37]/50 transition z-30 leading-tight">
                        <div className="flex items-center"><ImageIcon className="w-3 h-3 mr-1" /> See {therapist.images.length} photos</div>
                        <div className="text-[8px] mt-0.5 text-[#D4AF37]/80">(နောက်ထပ်ပုံများကြည့်ရန်)</div>
                      </button>
                    )}
                  </>
                ) : (<div className="flex flex-col items-center opacity-40"><User className="w-12 h-12 text-[#123524]" /></div>)}
              </div>
              <div className={`font-bold text-sm text-center w-full truncate px-1 ${isFull ? 'text-gray-400' : 'text-gray-800'}`}>{therapist.name}</div>
              <div className={`text-[10px] mt-1 text-center ${isFull ? 'text-gray-300' : 'text-gray-400'}`}>Professional Therapist</div>
              
              {isTherapistFirst && !isFull && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setFormData({ ...formData, therapist: therapist });
                    handleNextStep(currentStep + 1);
                  }}
                  className="mt-3 w-full bg-[#123524] text-[#D4AF37] py-2 rounded-lg text-xs font-bold flex items-center justify-center hover:opacity-90 transition shadow-sm border border-[#1a4a32]"
                >
                  ဘိုကင်ယူမည် <ChevronRight className="w-3 h-3 ml-1" />
                </button>
              )}
            </div>
          )
        })}
      </div>
      <div className={`mt-8 flex ${currentStep === 1 ? 'justify-end' : 'justify-between'}`}>
         {currentStep === 2 && <button onClick={() => handleNextStep(1)} className="px-6 py-4 rounded-lg font-bold text-gray-600 bg-white border border-gray-300 hover:bg-gray-50 transition">BACK</button>}
         <button disabled={formData.therapist === undefined} onClick={() => handleNextStep(currentStep + 1)} className={`px-8 py-4 rounded-lg font-bold text-white transition disabled:opacity-50 shadow-md hover:opacity-90 flex items-center`} style={{ backgroundColor: THEME.primary }}>
           {isTherapistFirst && currentStep === 1 ? 'CONTINUE TO SERVICE' : 'CONTINUE'} {isTherapistFirst && currentStep === 1 && <ChevronRight className="w-5 h-5 ml-2" />}
         </button>
      </div>
    </div>
  );

  return (
    <div>
      {renderStepper()}

      {step === 1 && (isTherapistFirst ? renderTherapistSelection(1) : renderServiceSelection(1))}
      {step === 2 && (isTherapistFirst ? renderServiceSelection(2) : renderTherapistSelection(2))}

      {/* STEP 3: DATE & TIME */}
      {step === 3 && (
        <div className="animate-fade-in">
          <div className="text-center mb-8">
            <h2 className="text-2xl font-bold" style={{ color: THEME.primary }}>Pick Date & Time</h2>
            <p className="text-sm font-bold mt-2" style={{ color: THEME.gold }}>(ဘိုကင်ရယူလိုသော နေ့ရက် နှင့် အချိန် ကို ရွေးချယ် ပါ)</p>
          </div>
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 mb-6">
            <label className="block mb-2 text-sm font-bold flex items-center" style={{ color: THEME.primary }}><Calendar className="w-4 h-4 mr-2" style={{ color: THEME.primary }} /> Select Date</label>
            <input type="date" min={minDateStr} max={maxDateStr} value={formData.date} onChange={(e) => setFormData({ ...formData, date: e.target.value, time: '' })} className="w-full p-4 border border-gray-200 rounded-lg focus:outline-none focus:border-[#D4AF37] text-gray-800 bg-gray-50 mb-6" />
            
            {/* Staff Clock In Fluid Time Input (Today only) */}
            {staffClockIn && formData.date === todayStr ? (
                <div className="bg-yellow-50 p-5 rounded-lg border border-yellow-200 mb-4 animate-fade-in">
                    <label className="block mb-2 text-sm font-bold flex items-center text-yellow-800"><Clock className="w-4 h-4 mr-2" /> Service Start Time (ဧည့်သည်ရောက်ရှိချိန်)</label>
                    <input 
                       type="time" 
                       value={formData.time}
                       onChange={(e) => setFormData({...formData, time: e.target.value})}
                       className="w-full p-4 border border-gray-200 rounded-lg focus:outline-none focus:border-[#D4AF37] text-gray-800 bg-white mb-2 font-bold text-center tracking-wider text-lg"
                    />
                    <p className="text-[10px] text-yellow-700 font-semibold text-center mt-1">အမှန်တကယ် စတင်သည့်အချိန်ကို ပြင်ဆင်ရွေးချယ်နိုင်ပါသည်။</p>
                </div>
            ) : (
                <>
                    <label className="block mb-4 text-sm font-bold flex items-center" style={{ color: THEME.primary }}><Clock className="w-4 h-4 mr-2" style={{ color: THEME.primary }} /> Available Times</label>
                    <div className={`grid gap-3 ${availableTimeSlots.length <= 2 ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-3 sm:grid-cols-4'}`}>
                        {availableTimeSlots.map(t => {
                            const isAvailable = isSlotAvailable(t);
                            return (
                                <button key={t} type="button" disabled={!formData.date || !isAvailable} onClick={() => setFormData({ ...formData, time: t })} className={`py-3 px-2 text-xs sm:text-sm font-bold rounded-lg border transition-all ${formData.time === t ? 'border-[#D4AF37] bg-yellow-50 text-yellow-700 shadow-sm' : !isAvailable ? 'border-gray-200 bg-gray-100 text-gray-400 opacity-40 cursor-not-allowed line-through' : 'border-gray-200 bg-white text-gray-600 hover:border-[#D4AF37]'}`}>{t}</button>
                            )
                        })}
                    </div>
                </>
            )}

            {availableTimeSlots.length === 0 && formData.date && !(staffClockIn && formData.date === todayStr) && <p className="text-sm text-red-500 mt-2 text-center">ရွေးချယ်ထားသော ဝန်ဆောင်မှုအတွက် အချိန်ရွေးချယ်၍ မရနိုင်ပါ။</p>}
          </div>
          <div className="mt-8 flex justify-between"><button onClick={() => handleNextStep(2)} className="px-6 py-4 rounded-lg font-bold text-gray-600 bg-white border border-gray-300 hover:bg-gray-50 transition">BACK</button><button disabled={!formData.date || !formData.time.trim()} onClick={() => handleNextStep(4)} className="px-8 py-4 rounded-lg font-bold text-white transition disabled:opacity-50 shadow-md hover:opacity-90" style={{ backgroundColor: THEME.primary }}>CONTINUE</button></div>
        </div>
      )}

      {/* STEP 4: CONFIRM */}
      {step === 4 && (
        <form onSubmit={handleSubmit} className="animate-fade-in pb-10">
          <div className="text-center mb-8"><h2 className="text-2xl font-bold" style={{ color: THEME.primary }}>Confirm Booking</h2><p className="text-sm font-bold mt-2" style={{ color: THEME.gold }}>(ဘိုကင်မှတ်တမ်းအား ပြန်လည်စစ်ဆေးပြီး အတည်ပြုပေးပါ)</p></div>
          
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 mb-6">
            <h3 className="text-sm font-bold tracking-widest uppercase mb-5" style={{ color: THEME.gold }}>Booking Summary</h3>
            <div className="space-y-4">
              <div className="flex justify-between items-start">
                <div>
                  <div className="font-bold text-gray-800 flex items-center"><Activity className="w-4 h-4 mr-2 text-yellow-600"/> {formData.selectedItem?.name || 'Unknown Service'}</div>
                  {formData.selectedItem?.duration && <div className="text-sm text-gray-500 ml-6">{formData.selectedItem.duration}</div>}
                </div>
                <div className="font-bold text-gray-800 text-sm">{formatPrice(formData.selectedItem?.price)}</div>
              </div>
              {formData.isVvipUpgrade && (
                <div className="flex justify-between items-start pt-2 border-t border-gray-50">
                  <div className="font-bold flex items-center text-sm" style={{ color: THEME.gold }}><Crown className="w-4 h-4 mr-2" style={{ color: THEME.gold }}/>VVIP Room Extra Fee</div>
                  <div className="font-bold text-sm" style={{ color: THEME.gold }}>+{formatPrice((Number(formData.selectedItem?.vvipPrice) || 0) - (Number(formData.selectedItem?.price) || 0))}</div>
                </div>
              )}
              {formData.selectedItem?.vvipIncluded && (<div className="flex justify-between items-start pt-2 border-t border-gray-50"><div className="font-bold text-green-600 flex items-center text-sm"><Crown className="w-4 h-4 mr-2 text-green-500"/>VVIP Master Room</div><div className="font-bold text-green-600 text-sm bg-green-50 px-2 py-0.5 rounded">Included (Free)</div></div>)}
              <div className="flex items-center text-sm font-bold text-gray-700 pt-2 border-t border-gray-50"><User className="w-4 h-4 mr-2" style={{ color: THEME.gold }} /> {formData.therapist ? formData.therapist.name : 'Any Available Therapist'}</div>
              <div className="flex items-center text-sm font-bold text-gray-700"><Calendar className="w-4 h-4 mr-2" style={{ color: THEME.gold }} /> {formData.date} at {staffClockIn && formData.date === todayStr && /^\d{2}:\d{2}$/.test(formData.time) ? `${(Number(formData.time.split(':')[0])%12)||12}:${formData.time.split(':')[1]} ${Number(formData.time.split(':')[0])>=12?'PM':'AM'}` : formData.time}</div>
            </div>
            
            <div className="mt-6 pt-4 border-t-2 border-gray-100">
                <div className="flex justify-between items-center text-sm text-gray-600 mb-2">
                    <span className="font-semibold">Subtotal</span>
                    <span className="font-bold">{formatPrice(calculateSubTotal())}</span>
                </div>
                {promoActive && discountPercent > 0 && (
                    <div className="flex justify-between items-center text-sm text-green-600 mb-2 bg-green-50 px-2 py-1 rounded">
                        <span className="font-bold flex items-center"><Percent className="w-3 h-3 mr-1"/> Promo Discount ({discountPercent}%)</span>
                        <span className="font-bold">-{formatPrice(calculateDiscountAmount())}</span>
                    </div>
                )}
                <div className="flex justify-between items-center mt-2 pt-2 border-t border-gray-50">
                    <span className="font-bold text-gray-800">Final Total Price</span>
                    <span className="text-xl font-bold" style={{ color: THEME.gold }}>{formatPrice(calculateTotal())}</span>
                </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 mb-6">
             <h3 className="text-sm font-bold tracking-widest uppercase mb-4" style={{ color: THEME.gold }}>Special Request (Optional)</h3>
             <textarea 
               name="specialRequest" 
               value={formData.specialRequest || ''} 
               onChange={handleChange} 
               placeholder="Write any special requests or notes here..." 
               className="w-full p-3 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:border-[#D4AF37] text-gray-800" 
               rows={3}
             />
          </div>

          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 mb-6">
            <h3 className="text-sm font-bold tracking-widest uppercase mb-4" style={{ color: THEME.gold }}>Your Information</h3>
            <div className="space-y-4">
              <div><label className="block mb-1 text-sm font-semibold text-gray-700">Full Name</label><input required type="text" name="name" value={formData.name} onChange={handleChange} placeholder="e.g. Aung Aung" className="w-full p-3 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:border-[#D4AF37] text-gray-800" /></div>
              <div><label className="block mb-1 text-sm font-semibold text-gray-700">Phone Number {isStaffMode ? '' : '(Login ID အဖြစ်အသုံးပြုရန်)'}</label><input required={!isStaffMode} type="tel" name="phone" value={formData.phone} onChange={handleChange} placeholder="e.g. 09-xxxxxxxxx" className="w-full p-3 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:border-[#D4AF37] text-gray-800" /></div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 mb-6">
            <h3 className="text-sm font-bold tracking-widest uppercase mb-4 flex items-center" style={{ color: THEME.primary }}><CreditCard className="w-4 h-4 mr-2" style={{ color: THEME.primary }} /> Deposit Payment</h3>
            
            {isStaffMode ? (
              <div className="bg-green-50 p-5 rounded-lg border border-green-200 text-center shadow-sm">
                  <span className="font-bold text-green-800 text-lg flex justify-center items-center"><CheckCircle className="w-5 h-5 mr-2"/> Cash Payment in Shop</span>
                  <p className="text-xs font-semibold text-green-600 mt-2">{staffClockIn && formData.date === todayStr ? '"Confirm and Start Now" နှိပ်သည်နှင့် ဝန်ဆောင်မှုကို စတင်ပါမည်။' : 'ဤဘိုကင်ကို စနစ်မှ အလိုအလျောက် အတည်ပြု (Approve) ပါမည်။'}</p>
              </div>
            ) : (
              <>
                <div className="relative mb-4">
                  <label className="block mb-2 text-sm font-semibold text-gray-700" style={{ color: THEME.primary }}>ငွေလွှဲမည့် စနစ် ရွေးချယ်ရန်</label>

                  <div onClick={() => setPaymentDropdownOpen(!paymentDropdownOpen)} className="w-full p-3 bg-[#123524] rounded-lg cursor-pointer flex justify-between items-center shadow-sm">
                    {selectedPaymentConfig ? (<div className="flex items-center font-bold text-[#D4AF37]">{selectedPaymentConfig.logoUrl && <img src={selectedPaymentConfig.logoUrl} alt="" className="w-6 h-6 mr-3 object-contain bg-white rounded-sm p-0.5" />}{selectedPaymentConfig.name}</div>) : (<span className="font-bold text-[#D4AF37]">-- ရွေးချယ်ပါ --</span>)}
                    <ChevronDown className="w-5 h-5 text-[#D4AF37]" />
                  </div>
                  {paymentDropdownOpen && (
                    <><div className="fixed inset-0 z-40" onClick={() => setPaymentDropdownOpen(false)}></div>
                      <div className="absolute z-50 w-full mt-2 bg-[#123524] rounded-lg shadow-xl overflow-hidden border border-[#1a4a32]">
                        {safePaymentMethods.map(pm => (<div key={pm.id} className="p-4 flex items-center cursor-pointer hover:bg-[#1a4a32] border-b border-[#1a4a32] transition-colors" onClick={() => { setFormData({ ...formData, paymentMethod: pm.name }); setPaymentDropdownOpen(false); }}>{pm.logoUrl && <img src={pm.logoUrl} alt="" className="w-7 h-7 mr-3 object-contain bg-white rounded-sm p-1" />}<span className="font-bold text-[#D4AF37] text-base">{pm.name}</span></div>))}
                      </div></>
                  )}
                </div>
                {selectedPaymentConfig && (
                  <div className="bg-yellow-50 p-5 rounded-lg mb-5 border border-yellow-200 animate-fade-in">
                    <p className="text-sm text-gray-700 mb-4 leading-relaxed">Booking အတည်ပြုနိုင်ရန် <strong className="text-yellow-700 font-bold">ကျသင့်ငွေ၏ တစ်ဝက် ({formatPrice(calculateTotal() / 2)})</strong> စရံငွေအား {selectedPaymentConfig.name} သို့ လွှဲပေးပါ။</p>
                    <div className="flex flex-col space-y-3 bg-white p-4 rounded-md border border-yellow-100">
                      <div className="flex items-center justify-between sm:justify-start"><span className="text-gray-500 text-sm w-16 inline-block">အကောင့်:</span> <strong className="tracking-widest text-gray-800 text-lg sm:mr-4">{selectedPaymentConfig.accountNumber}</strong><button type="button" onClick={() => handleCopy(selectedPaymentConfig.accountNumber)} className="flex items-center px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-xs font-bold text-gray-700 rounded transition"><Copy className="w-3 h-3 mr-1" /> Copy</button></div>
                      <div className="flex items-center justify-between sm:justify-start"><span className="text-gray-500 text-sm w-16 inline-block">အမည်:</span> <strong className="text-gray-800 text-lg sm:mr-4">{selectedPaymentConfig.accountName}</strong><button type="button" onClick={() => handleCopy(selectedPaymentConfig.accountName)} className="flex items-center px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-xs font-bold text-gray-700 rounded transition"><Copy className="w-3 h-3 mr-1" /> Copy</button></div>
                    </div>
                  </div>
                )}
                
                {/* Countdown Timer Display */}
                {selectedPaymentConfig && (
                  <div className="text-center mb-4 p-3 rounded bg-red-50 border border-red-100 animate-fade-in">
                     <p className="text-sm text-red-600 font-bold">စရံငွေလွှဲပြီး ဘိုကင်အတည်ပြုရန် ကျန်သောအချိန်</p>
                     <div className="text-2xl font-mono font-bold text-red-700 mt-1">{formattedCountdown}</div>
                  </div>
                )}

                <div><label className="block mb-2 text-sm font-bold" style={{ color: THEME.gold }}>ငွေလွှဲ Transaction ID (နောက်ဆုံး ၆ လုံး) ထည့်ပေးပါ</label><input required type="text" name="txId" maxLength={6} minLength={6} placeholder="e.g. 123456" value={formData.txId} onChange={handleChange} className="w-full p-4 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:border-[#D4AF37] text-center text-2xl tracking-[0.5em] font-bold text-gray-800" /></div>
              </>
            )}
          </div>

          <div className="mt-8 flex justify-between">
            <button type="button" onClick={() => handleNextStep(3)} className="px-6 py-4 rounded-lg font-bold text-gray-600 bg-white border border-gray-300 hover:bg-gray-50 transition">BACK</button>
            <button disabled={loading || (!isStaffMode && !formData.paymentMethod)} type="submit" className="px-8 py-4 rounded-lg font-bold text-white transition disabled:opacity-50 shadow-lg flex-1 ml-4 flex justify-center items-center hover:opacity-90" style={{ backgroundColor: THEME.primary }}>{loading ? 'PROCESSING...' : (staffClockIn && formData.date === todayStr ? 'CONFIRM AND START NOW' : 'CONFIRM BOOKING')}</button>
          </div>
        </form>
      )}
    </div>
  );
}

// 1.4 Customer History Tab
function CustomerHistory({ userPhone, onLoginSuccess }: { userPhone: string, onLoginSuccess: (phone: string) => void }) {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedBookingId, setExpandedBookingId] = useState<string | null>(null);

  useEffect(() => {
    if (!userPhone) return;
    const fetchMyBookings = async () => {
      try {
        const q = query(collection(db, 'bookings'));
        const snap = await getDocs(q);
        const data: Booking[] = [];
        snap.forEach((doc) => {
          const b = { id: doc.id, ...doc.data() } as Booking;
          if (b.phone === userPhone) data.push(b);
        });
        data.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
        setBookings(data);
      } catch (e) { console.error(e); }
      setLoading(false);
    };
    fetchMyBookings();
  }, [userPhone]);

  if (!userPhone) return <AuthRequest onLoginSuccess={onLoginSuccess} title="View My Bookings" />;
  if (loading) return <div className="text-center py-10 font-bold text-gray-500">Loading Bookings...</div>;

  return (
    <div className="animate-fade-in">
      <div className="text-center mb-8"><h2 className="text-2xl font-bold" style={{ color: THEME.primary }}>Booking History</h2><p className="text-sm font-bold mt-2" style={{ color: THEME.gold }}>(သင်၏ ဘိုကင်မှတ်တမ်းများ)</p></div>
      {bookings.length === 0 ? (
        <div className="bg-white p-10 rounded-2xl shadow-sm border border-gray-100 text-center text-gray-500 font-bold">ဘိုကင်မှတ်တမ်း မရှိသေးပါ။</div>
      ) : (
        <div className="space-y-4">
          {bookings.map(b => {
             const isExpanded = expandedBookingId === b.id;
             return (
               <div key={b.id} className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden transition-all duration-300">
                  <div 
                     className="p-5 flex justify-between items-center cursor-pointer hover:bg-gray-50"
                     onClick={() => setExpandedBookingId(isExpanded ? null : b.id!)}
                  >
                     <div className="flex items-start">
                        <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center mr-4 mt-1"><Sparkles className="w-5 h-5 text-gray-500"/></div>
                        <div>
                           <div className="font-bold text-gray-800 text-sm sm:text-base">{b.service.split('(')[0]}</div>
                           <div className="text-xs text-gray-500 mt-1 flex items-center"><Calendar className="w-3 h-3 mr-1"/> {b.date} &nbsp; <Clock className="w-3 h-3 mx-1"/> Slot: {b.time}</div>
                        </div>
                     </div>
                     <div className="flex flex-col items-end">
                        <StatusBadge status={b.status} cancelReason={b.cancelReason} />
                        <div className="font-bold mt-2" style={{ color: THEME.gold }}>{formatPrice(b.totalPrice)}</div>
                        <div className="text-[10px] text-gray-400 mt-1 flex items-center">
                           {isExpanded ? <><ChevronUp className="w-3 h-3 mr-1"/> Less details</> : <><ChevronDown className="w-3 h-3 mr-1"/> More details</>}
                        </div>
                     </div>
                  </div>

                  {isExpanded && (
                     <div className="p-5 border-t border-gray-100 bg-gray-50 animate-fade-in">
                        <div className="grid grid-cols-2 gap-4 mb-4">
                           <div className="bg-white p-3 rounded-lg border border-gray-100">
                              <span className="text-[10px] uppercase font-bold text-gray-400 block mb-1">THERAPIST</span>
                              <span className="text-sm font-bold text-gray-800">{b.therapist}</span>
                           </div>
                           <div className="bg-white p-3 rounded-lg border border-gray-100">
                              <span className="text-[10px] uppercase font-bold text-gray-400 block mb-1">DURATION / EXTRA</span>
                              <span className="text-sm font-bold text-gray-800">{b.service.split('(')[1] ? '(' + b.service.split('(').slice(1).join('(') : '-'}</span>
                           </div>
                           <div className="bg-white p-3 rounded-lg border border-gray-100">
                              <span className="text-[10px] uppercase font-bold text-gray-400 block mb-1">TXID</span>
                              <span className="text-sm font-mono font-bold text-gray-800 tracking-widest">{b.txId}</span>
                           </div>
                           <div className="bg-white p-3 rounded-lg border border-gray-100">
                              <span className="text-[10px] uppercase font-bold text-gray-400 block mb-1">PAYMENT</span>
                              <span className="text-sm font-bold text-gray-800">{b.paymentMethod}</span>
                           </div>
                        </div>
                        {b.specialRequest && (
                           <div className="bg-white p-3 rounded-lg border border-gray-100 mb-4">
                              <span className="text-[10px] uppercase font-bold text-gray-400 block mb-1">SPECIAL REQUEST NOTE</span>
                              <span className="text-sm text-gray-700 italic">{b.specialRequest}</span>
                           </div>
                        )}
                        <div className="flex justify-between items-center text-xs text-gray-400 font-semibold px-1">
                           <span>Booked: {new Date(b.createdAt).toLocaleDateString()}</span>
                           <span className="text-[#123524] text-sm">Total: {formatPrice(b.totalPrice)}</span>
                        </div>
                     </div>
                  )}
               </div>
             )
          })}
        </div>
      )}
    </div>
  );
}

// 1.5 CUSTOMER PROFILE TAB
function CustomerProfile({ userPhone, onLoginSuccess, onLogout }: { userPhone: string, onLoginSuccess: (phone: string) => void, onLogout: () => void }) {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [editMode, setEditMode] = useState(false);
  const [formData, setFormData] = useState({ name: '', password: '' });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!userPhone) return;
    const fetchUser = async () => {
      const snap = await getDoc(doc(db, 'users', userPhone));
      if (snap.exists()) {
        const data = snap.data() as UserProfile;
        setProfile(data);
        setFormData({ name: data.name || '', password: data.password || '' });
      }
      setLoading(false);
    };
    fetchUser();
  }, [userPhone]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await updateDoc(doc(db, 'users', userPhone), { name: formData.name, password: formData.password });
      setProfile({ ...profile!, name: formData.name, password: formData.password });
      setEditMode(false);
      alert("Profile အောင်မြင်စွာ ပြင်ဆင်ပြီးပါပြီ။");
    } catch (e) { alert("Error updating profile."); }
    setSaving(false);
  };

  if (!userPhone) return <AuthRequest onLoginSuccess={onLoginSuccess} title="View Profile" />;
  if (loading) return <div className="text-center py-10 font-bold text-gray-500">Loading Profile...</div>;
  if (!profile) return <div className="text-center py-10 font-bold text-red-500">User not found. Try logging out.</div>;

  return (
    <div className="animate-fade-in max-w-sm mx-auto">
      <div className="text-center mb-8"><h2 className="text-2xl font-bold" style={{ color: THEME.primary }}>My Profile</h2></div>

      <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200 text-center mb-6">
        <div className="w-20 h-20 bg-gray-100 rounded-full mx-auto flex items-center justify-center mb-4 text-[#D4AF37]"><User className="w-10 h-10" /></div>

        {!editMode ? (
          <>
            <h3 className="text-xl font-bold text-gray-800">{profile.name || 'User'}</h3>
            <p className="text-sm font-bold text-gray-500 mt-1 mb-6 flex items-center justify-center"><Phone className="w-4 h-4 mr-1" /> {profile.phone}</p>
            <div className={`text-xs rounded-full px-3 py-1 inline-block font-bold mb-6 ${profile.password ? 'text-green-600 bg-green-50' : 'text-gray-500 bg-gray-100'}`}>
              {profile.password ? '✅ Account Secured (Password Set)' : '⚠️ No Password Set (Auto-Login)'}
            </div>
            <button onClick={() => setEditMode(true)} className="w-full py-3 bg-[#123524] text-white rounded-lg font-bold shadow-md hover:bg-green-900 transition flex justify-center items-center"><Edit className="w-4 h-4 mr-2" /> Edit Profile</button>
          </>
        ) : (
          <form onSubmit={handleSave} className="text-left space-y-4">
            <div><label className="block text-xs font-bold text-gray-500 mb-1">Full Name</label><input type="text" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} className="w-full p-3 bg-gray-50 border border-gray-200 rounded-lg outline-none focus:border-[#D4AF37]" required /></div>
            <div><label className="block text-xs font-bold text-gray-500 mb-1">Set Password (Optional)</label><input type="text" value={formData.password} onChange={e => setFormData({ ...formData, password: e.target.value })} placeholder="Leave blank for no password" className="w-full p-3 bg-gray-50 border border-gray-200 rounded-lg outline-none focus:border-[#D4AF37]" /></div>
            <div className="flex space-x-2 pt-2">
              <button type="button" onClick={() => setEditMode(false)} className="flex-1 py-3 bg-gray-100 text-gray-600 rounded-lg font-bold hover:bg-gray-200">Cancel</button>
              <button type="submit" disabled={saving} className="flex-1 py-3 bg-[#123524] text-white rounded-lg font-bold shadow-md hover:bg-green-900">{saving ? 'Saving...' : 'Save'}</button>
            </div>
          </form>
        )}
      </div>
      <button onClick={onLogout} className="w-full py-3 bg-red-50 text-red-600 rounded-lg font-bold border border-red-100 hover:bg-red-100 transition flex justify-center items-center"><LogOut className="w-4 h-4 mr-2" /> Log Out</button>
    </div>
  );
}

function AuthRequest({ onLoginSuccess, title }: { onLoginSuccess: (phone: string) => void, title: string }) {
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleNext = async (e: React.FormEvent) => {
    e.preventDefault(); setError(''); setLoading(true);
    try {
      const snap = await getDoc(doc(db, 'users', phone));
      if (!snap.exists()) { setError("ဖုန်းနံပါတ် ရှာမတွေ့ပါ။ ဘိုကင်အရင်တင်ပေးပါခင်ဗျာ။"); }
      else {
        const user = snap.data() as UserProfile;
        if (user.password) { setStep(2); }
        else { onLoginSuccess(phone); }
      }
    } catch (e) { setError("Network Error"); }
    setLoading(false);
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault(); setError(''); setLoading(true);
    try {
      const snap = await getDoc(doc(db, 'users', phone));
      const user = snap.data() as UserProfile;
      if (user.password === password) { onLoginSuccess(phone); }
      else { setError("Password မှားယွင်းနေပါသည်။"); }
    } catch (e) { setError("Network Error"); }
    setLoading(false);
  };

  return (
    <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-200 max-w-sm mx-auto text-center mt-10 animate-fade-in">
      <div className="w-16 h-16 bg-gray-100 rounded-full mx-auto flex items-center justify-center mb-6 text-[#123524]"><KeyRound className="w-8 h-8" /></div>
      <h2 className="text-xl font-bold text-gray-800 mb-2">Login Required</h2>
      <p className="text-xs font-bold text-gray-500 mb-6">{title} ကိုကြည့်ရန် လော့ဂ်အင် ဝင်ပေးပါ</p>

      {step === 1 ? (
        <form onSubmit={handleNext} className="space-y-4">
          <input required type="tel" placeholder="Enter Phone Number" value={phone} onChange={e => setPhone(e.target.value)} className="w-full p-3 bg-gray-50 border border-gray-200 rounded-lg outline-none focus:border-[#D4AF37] font-bold text-center tracking-wider" />
          {error && <div className="text-xs font-bold text-red-500">{error}</div>}
          <button type="submit" disabled={loading} className="w-full py-3 bg-[#123524] text-white rounded-lg font-bold shadow-md hover:bg-green-900">{loading ? 'Checking...' : 'Next'}</button>
        </form>
      ) : (
        <form onSubmit={handleLogin} className="space-y-4">
          <input required type="password" placeholder="Enter Password" value={password} onChange={e => setPassword(e.target.value)} className="w-full p-3 bg-gray-50 border border-gray-200 rounded-lg outline-none focus:border-[#D4AF37] font-bold text-center tracking-wider" />
          {error && <div className="text-xs font-bold text-red-500">{error}</div>}
          <button type="submit" disabled={loading} className="w-full py-3 bg-[#123524] text-white rounded-lg font-bold shadow-md hover:bg-green-900">{loading ? 'Logging in...' : 'Login'}</button>
        </form>
      )}
    </div>
  );
}

const XCircleIcon = ({className}: {className?: string}) => <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>;

function StatusBadge({ status, cancelReason }: { status: string, cancelReason?: string }) {
  if (status === 'in_progress') return <span className="text-orange-600 border border-orange-200 bg-orange-50 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider flex items-center w-fit animate-pulse"><Droplets className="w-3 h-3 mr-1"/> In Progress</span>;
  if (status === 'completed') return <span className="text-gray-600 border border-gray-200 bg-gray-50 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider flex items-center w-fit"><CheckCircle className="w-3 h-3 mr-1"/> Completed</span>;
  if (status === 'payment_checking') return <span className="text-blue-600 border border-blue-200 bg-blue-50 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider flex items-center w-fit"><Clock className="w-3 h-3 mr-1"/> Confirming</span>;
  if (status === 'approved') return <span className="text-green-600 border border-green-200 bg-green-50 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider flex items-center w-fit"><CheckCircle className="w-3 h-3 mr-1"/> Confirmed</span>;
  if (status === 'cancelled') return (
    <div className="flex flex-col items-end">
      <span className="text-red-500 border border-red-200 bg-red-50 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider flex items-center w-fit"><XCircleIcon className="w-3 h-3 mr-1"/> Cancelled</span>
      {cancelReason && <span className="text-[10px] text-red-400 mt-1 max-w-[200px] text-right leading-tight text-xs">Reason: {cancelReason}</span>}
    </div>
  );
  return <span className="text-yellow-600 border border-yellow-200 bg-yellow-50 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider flex items-center w-fit"><Clock className="w-3 h-3 mr-1"/> Pending</span>;
}
အပိုင်း (၂) - Admin နှင့် Customer Booking Wizard ပိုင်း
(အောက်ပါ ကုဒ်များကို အပေါ်က ကုဒ်တွေရဲ့အဆုံးမှာ ဆက်ပြီး Paste ချပေးပါ)

TypeScript
// ==========================================
// 2. ADMIN AUTHENTICATION
// ==========================================
function AdminLogin({ onLogin }: { onLogin: (u: string) => void }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault(); setLoading(true); setError('');
    try {
      const snap = await getDoc(doc(db, 'admins', username));
      if (snap.exists()) {
        if (snap.data().password === password) onLogin(username);
        else setError('Invalid password');
      } else {
        const allAdmins = await getDocs(collection(db, 'admins'));
        if (allAdmins.empty && username === 'admin' && password === 'admin123') {
          await setDoc(doc(db, 'admins', 'admin'), { username: 'admin', password: 'admin123' });
          onLogin('admin');
        } else {
          setError('Admin user not found');
        }
      }
    } catch (e) { setError('Network error'); }
    setLoading(false);
  };

  return (
    <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-200 max-w-sm mx-auto text-center mt-10 animate-fade-in">
      <div className="w-16 h-16 bg-red-50 rounded-full mx-auto flex items-center justify-center mb-6 text-red-600"><ShieldAlert className="w-8 h-8" /></div>
      <h2 className="text-xl font-bold text-gray-800 mb-2">Admin Portal</h2>
      <p className="text-xs font-bold text-gray-500 mb-6">Restricted Access</p>
      
      <form onSubmit={handleLogin} className="space-y-4">
        <input required type="text" placeholder="Username" value={username} onChange={e=>setUsername(e.target.value)} className="w-full p-3 bg-gray-50 border border-gray-200 rounded-lg outline-none focus:border-[#D4AF37] font-bold text-center tracking-wider" />
        <input required type="password" placeholder="Password" value={password} onChange={e=>setPassword(e.target.value)} className="w-full p-3 bg-gray-50 border border-gray-200 rounded-lg outline-none focus:border-[#D4AF37] font-bold text-center tracking-wider" />
        {error && <div className="text-xs font-bold text-red-500">{error}</div>}
        <button type="submit" disabled={loading} className="w-full py-3 bg-[#123524] text-white rounded-lg font-bold shadow-md hover:bg-green-900">{loading ? 'Verifying...' : 'Login'}</button>
      </form>
    </div>
  );
}

// ==========================================
// 3. ADMIN DASHBOARD
// ==========================================
function AdminDashboard({ appData, onSettingsUpdated }: { appData: AppData, onSettingsUpdated: (data: AppData) => void }) {
  const [tab, setTab] = useState<'bookings' | 'reports' | 'users' | 'admins' | 'settings'>('bookings');
  
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [pendingCount, setPendingCount] = useState(0);
  const isFirstLoad = useRef(true);

  useEffect(() => {
    const q = query(collection(db, 'bookings'));
    const unsubscribe = onSnapshot(q, (snap) => {
      const data: Booking[] = [];
      let currentPendingCount = 0;
      
      snap.forEach((doc) => { 
          const b = { id: doc.id, ...doc.data() } as Booking;
          data.push(b);
          if (b.status === 'pending') currentPendingCount++;
      });
      data.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
      
      setBookings(data);
      setPendingCount(currentPendingCount);

      if (!isFirstLoad.current) {
        const hasNewBooking = snap.docChanges().some(change => change.type === 'added' && change.doc.data().status === 'pending');
        if (hasNewBooking) {
           const audioEl = document.getElementById('admin-alert-sound') as HTMLAudioElement;
           if (audioEl) {
              audioEl.currentTime = 0;
              audioEl.play().catch(e => console.log("Audio play blocked by browser:", e));
              
              setTimeout(() => {
                 audioEl.pause();
                 audioEl.currentTime = 0;
              }, 5000);
           }
        }
      }
      isFirstLoad.current = false;
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [tab]);

  const handleInteraction = () => {
     const audioEl = document.getElementById('admin-alert-sound') as HTMLAudioElement;
     if (audioEl && audioEl.paused) {
        audioEl.play().then(() => {
           audioEl.pause();
           audioEl.currentTime = 0;
        }).catch(() => {});
     }
  };

  return (
    <div className="animate-fade-in" onClick={handleInteraction}>
      <audio id="admin-alert-sound" src="https://actions.google.com/sounds/v1/alarms/alarm_clock.ogg" preload="auto" loop />
      
      <div className="flex flex-wrap justify-center gap-2 mb-6 scrollbar-hide overflow-x-auto p-1">
        <button onClick={() => setTab('bookings')} className={`relative px-4 sm:px-5 py-3 rounded-lg font-bold text-xs transition-all flex items-center whitespace-nowrap ${tab === 'bookings' ? 'bg-[#123524] text-white shadow-md' : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'}`}>
          <CalendarPlus className="w-4 h-4 mr-2" /> Bookings
          {pendingCount > 0 && (
             <span className="absolute -top-2 -right-2 bg-red-500 text-white text-[10px] w-5 h-5 flex items-center justify-center rounded-full shadow-md font-bold animate-pulse">
               {pendingCount}
             </span>
          )}
        </button>
        <button onClick={() => setTab('reports')} className={`px-4 sm:px-5 py-3 rounded-lg font-bold text-xs transition-all flex items-center whitespace-nowrap ${tab === 'reports' ? 'bg-[#123524] text-white shadow-md' : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'}`}><BarChart2 className="w-4 h-4 mr-2" /> Staff History</button>
        <button onClick={() => setTab('users')} className={`px-4 sm:px-5 py-3 rounded-lg font-bold text-xs transition-all flex items-center whitespace-nowrap ${tab === 'users' ? 'bg-[#123524] text-white shadow-md' : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'}`}><User className="w-4 h-4 mr-2" /> Users</button>
        <button onClick={() => setTab('admins')} className={`px-4 sm:px-5 py-3 rounded-lg font-bold text-xs transition-all flex items-center whitespace-nowrap ${tab === 'admins' ? 'bg-[#123524] text-white shadow-md' : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'}`}><ShieldCheck className="w-4 h-4 mr-2" /> Admins</button>
        <button onClick={() => setTab('settings')} className={`px-4 sm:px-5 py-3 rounded-lg font-bold text-xs transition-all flex items-center whitespace-nowrap ${tab === 'settings' ? 'bg-[#D4AF37] text-white shadow-md' : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'}`}><Settings className="w-4 h-4 mr-2" /> Settings</button>
      </div>
      {tab === 'bookings' && <AdminBookingsList bookings={bookings.filter(b => b.status !== 'in_progress' && b.status !== 'completed')} />}
      {tab === 'reports' && <AdminStaffHistoryList appData={appData} bookings={bookings.filter(b => b.status === 'in_progress' || b.status === 'completed')} />}
      {tab === 'users' && <AdminUsersList />}
      {tab === 'admins' && <AdminManagementList />}
      {tab === 'settings' && <AdminSettings appData={appData} onSettingsUpdated={onSettingsUpdated} />}
    </div>
  );
}

function AdminBookingsList({ bookings }: { bookings: Booking[] }) {
  const handleStatusChange = async (id: string, newStatus: string) => {
    let reason = '';
    if (newStatus === 'cancelled') {
      const input = window.prompt("Reason for cancellation:");
      if (input === null) return;
      reason = input;
    } else {
      if (!window.confirm('Are you sure you want to change this status?')) return;
    }
    try {
      await updateDoc(doc(db, 'bookings', id), { status: newStatus, cancelReason: reason });
    } catch (e) { alert("Error Update"); }
  };

  const handleDelete = async (id: string) => { if (window.confirm('Are you sure you want to delete this booking?')) { await deleteDoc(doc(db, 'bookings', id)); } };

  return (
    <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
      <div className="flex justify-between items-center mb-6 border-b border-gray-100 pb-4"><h2 className="text-xl font-bold flex items-center" style={{ color: THEME.primary }}><CalendarPlus className="mr-2 text-yellow-500" /> Booking Requests</h2><span className="bg-yellow-100 text-yellow-700 px-4 py-1 rounded-full text-sm font-bold border border-yellow-200">Total: {bookings.length}</span></div>
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse min-w-[800px]">
          <thead><tr className="border-b-2 border-gray-100 text-xs text-gray-500 uppercase tracking-wider"><th className="p-3 pb-4">Customer</th><th className="p-3 pb-4">Service & Therapist</th><th className="p-3 pb-4">Date & Time</th><th className="p-3 pb-4">TxID & Total</th><th className="p-3 pb-4">Status & Action</th><th className="p-3 pb-4 text-right">Delete</th></tr></thead>
          <tbody>
            {bookings.length === 0 && (<tr><td colSpan={6} className="p-10 text-center text-gray-400">No pending bookings.</td></tr>)}
            {bookings.map((b) => (
              <tr key={b.id} className="border-b border-gray-50 hover:bg-gray-50 transition">
                <td className="p-3">
                  <div className="font-bold text-gray-800 text-sm">{b.name || 'No Name'}</div>
                  <div className="text-xs text-gray-500">{b.phone || '-'}</div>
                </td>
                <td className="p-3">
                  <div className="font-bold text-sm text-gray-800">{b.service || '-'}</div>
                  <div className="text-xs text-gray-500 mt-1 flex items-center"><User className="w-3 h-3 mr-1" />{b.therapist || '-'}</div>
                  {b.specialRequest && <div className="text-xs text-red-500 mt-1 italic">Note: {b.specialRequest}</div>}
                </td>
                <td className="p-3 text-sm text-gray-700">
                  <div className="font-semibold">{b.date || '-'}</div>
                  <div className="text-gray-500 text-xs mt-1">{b.time || '-'}</div>
                </td>
                <td className="p-3">
                  <div className="font-mono font-bold text-gray-800 text-sm">{b.txId || '-'}</div>
                  <div className="text-[10px] uppercase tracking-wider font-bold text-yellow-600 mt-1">{b.paymentMethod || 'Unknown'} • {formatPrice(b.totalPrice)}</div>
                </td>
                <td className="p-3">
                  <select value={b.status} onChange={(e) => handleStatusChange(b.id!, e.target.value)} className={`text-[10px] font-bold p-1.5 rounded outline-none border cursor-pointer ${b.status === 'approved' ? 'bg-green-50 text-green-700 border-green-200' : b.status === 'payment_checking' ? 'bg-blue-50 text-blue-700 border-blue-200' : b.status === 'cancelled' ? 'bg-red-50 text-red-700 border-red-200' : 'bg-yellow-50 text-yellow-700 border-yellow-200'}`}>
                    <option value="pending">Pending</option>
                    <option value="payment_checking">Confirming</option>
                    <option value="approved">Approve</option>
                    <option value="cancelled">Cancel</option>
                  </select>
                  {b.status === 'cancelled' && b.cancelReason && <div className="text-[9px] text-red-500 mt-1 max-w-[120px] truncate" title={b.cancelReason}>Reason: {b.cancelReason}</div>}
                </td>
                <td className="p-3 text-right">
                  <button onClick={() => handleDelete(b.id!)} className="p-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition"><Trash2 className="w-4 h-4" /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function AdminStaffHistoryList({ appData, bookings }: { appData: AppData, bookings: Booking[] }) {
   const [view, setView] = useState<'dashboard' | 'service' | 'outpass'>('dashboard');
   const [outpasses, setOutpasses] = useState<OutPass[]>([]);

   useEffect(() => {
       const unsub = onSnapshot(query(collection(db, 'outpasses'), orderBy('outTimeMillis', 'desc')), snap => {
           const arr: OutPass[] = [];
           snap.forEach(d => arr.push({id: d.id, ...d.data()} as OutPass));
           setOutpasses(arr);
       });
       return () => unsub();
   }, []);

   const handleDeleteBooking = async (id: string) => { if(window.confirm('Are you sure you want to delete this record?')) await deleteDoc(doc(db, 'bookings', id)); };
   const handleDeleteOutpass = async (id: string) => { if(window.confirm('Are you sure you want to delete this out pass?')) await deleteDoc(doc(db, 'outpasses', id)); };

   return (
       <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
           <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 border-b border-gray-100 pb-4">
              <h2 className="text-xl font-bold flex items-center mb-4 sm:mb-0" style={{ color: THEME.primary }}><BarChart2 className="mr-2 text-[#D4AF37]" /> Staff Reports</h2>
              <div className="flex space-x-2 bg-gray-50 p-1 rounded-lg border border-gray-200 w-full sm:w-auto">
                 <button onClick={() => setView('dashboard')} className={`flex-1 sm:flex-none px-4 py-2 text-xs font-bold rounded transition ${view === 'dashboard' ? 'bg-white shadow text-[#123524]' : 'text-gray-500 hover:bg-gray-100'}`}>Dashboard View</button>
                 <button onClick={() => setView('service')} className={`flex-1 sm:flex-none px-4 py-2 text-xs font-bold rounded transition ${view === 'service' ? 'bg-white shadow text-[#123524]' : 'text-gray-500 hover:bg-gray-100'}`}>Services List</button>
                 <button onClick={() => setView('outpass')} className={`flex-1 sm:flex-none px-4 py-2 text-xs font-bold rounded transition ${view === 'outpass' ? 'bg-white shadow text-[#123524]' : 'text-gray-500 hover:bg-gray-100'}`}>Out Passes List</button>
              </div>
           </div>

           {view === 'dashboard' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                 {appData.therapists.map(t => {
                     const activeBooking = bookings.find(b => b.therapist === t.name && b.status === 'in_progress');
                     const activeOutpass = outpasses.find(o => o.therapist === t.name && o.status === 'out');

                     let statusColor = "bg-green-50 border-green-200";
                     let badgeColor = "bg-green-100 text-green-700";
                     let badgeText = "AVAILABLE";
                     let content = <div className="text-sm font-semibold text-gray-500 mt-2 h-16 flex items-center">Currently waiting for customers</div>;

                     if (activeBooking) {
                         const isOutcall = activeBooking.service.toLowerCase().includes('outcall');
                         statusColor = isOutcall ? "bg-blue-50 border-blue-200" : "bg-orange-50 border-orange-200";
                         badgeColor = isOutcall ? "bg-blue-100 text-blue-700 animate-pulse" : "bg-orange-100 text-orange-700 animate-pulse";
                         badgeText = isOutcall ? "OUTCALL ACTIVE" : "IN SERVICE";
                         content = (
                             <div className="mt-2 text-sm h-16 flex flex-col justify-center">
                                 <div className="font-bold text-gray-800 truncate" title={activeBooking.service.split('(')[0]}>{activeBooking.service.split('(')[0]}</div>
                                 <div className="text-xs text-gray-600 mt-0.5 truncate">Cust: {activeBooking.name}</div>
                                 <div className="text-[10px] text-gray-500 mt-1.5 font-mono">
                                     Start: {formatMillis(activeBooking.startTimeMillis)} &nbsp;|&nbsp; Exp End: {formatMillis(activeBooking.expectedEndTimeMillis)}
                                 </div>
                             </div>
                         );
                     } else if (activeOutpass) {
                         statusColor = "bg-purple-50 border-purple-200";
                         badgeColor = "bg-purple-100 text-purple-700 animate-pulse";
                         badgeText = "OUT PASS";
                         content = (
                             <div className="mt-2 text-sm h-16 flex flex-col justify-center">
                                 <div className="font-bold text-gray-800 truncate" title={activeOutpass.reason}>Reason: {activeOutpass.reason || '-'}</div>
                                 <div className="text-[10px] text-gray-500 mt-1.5 font-mono">
                                     Out Time: {formatMillis(activeOutpass.outTimeMillis)} <br/> 
                                     Exp Return: {formatMillis(activeOutpass.expectedInTimeMillis)}
                                 </div>
                             </div>
                         );
                     }

                     return (
                         <div key={t.id} className={`p-4 rounded-xl border-2 transition-all shadow-sm ${statusColor}`}>
                             <div className="flex justify-between items-start mb-2">
                                 <div className="font-bold text-[#123524] truncate flex-1 pr-2">{t.name}</div>
                                 <span className={`text-[9px] px-2 py-1 rounded font-bold uppercase tracking-wider flex-shrink-0 ${badgeColor}`}>
                                     {badgeText}
                                 </span>
                             </div>
                             {content}
                         </div>
                     );
                 })}
              </div>
           )}

           {view === 'service' && (
              <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse min-w-[900px]">
                      <thead><tr className="border-b-2 border-gray-100 text-xs text-gray-500 uppercase tracking-wider"><th className="p-3 pb-4">Staff (Therapist)</th><th className="p-3 pb-4">Service & Customer</th><th className="p-3 pb-4">Date</th><th className="p-3 pb-4">Start Time</th><th className="p-3 pb-4">Expected End</th><th className="p-3 pb-4">Actual End</th><th className="p-3 pb-4 text-right">Overtime / Action</th></tr></thead>
                      <tbody>
                          {bookings.length === 0 && (<tr><td colSpan={7} className="p-10 text-center text-gray-400">No service records found.</td></tr>)}
                          {bookings.map((b) => (
                              <tr key={b.id} className="border-b border-gray-50 hover:bg-gray-50 transition text-sm">
                                  <td className="p-3 font-bold text-[#123524]">{b.therapist}</td>
                                  <td className="p-3">
                                      <div className="font-semibold text-gray-800">{b.service.split('(')[0]}</div>
                                      <div className="text-xs text-gray-500 mt-0.5">Cust: {b.name}</div>
                                  </td>
                                  <td className="p-3 text-gray-700 font-semibold">{b.date}</td>
                                  <td className="p-3 font-mono text-gray-600">{formatMillis(b.startTimeMillis)}</td>
                                  <td className="p-3 font-mono text-gray-600">{formatMillis(b.expectedEndTimeMillis)}</td>
                                  <td className="p-3 font-mono text-gray-600">{b.status === 'in_progress' ? <span className="text-orange-500 animate-pulse font-bold">ACTIVE</span> : formatMillis(b.actualEndTimeMillis)}</td>
                                  <td className="p-3 text-right">
                                     <div className={`font-mono font-bold text-base mb-1 ${(b.overtimeSeconds || 0) > 0 ? 'text-red-600' : 'text-gray-400'}`}>{formatTimeDisplay(b.overtimeSeconds)}</div>
                                     <button onClick={() => handleDeleteBooking(b.id!)} className="text-red-500 hover:text-red-700 text-xs font-bold bg-red-50 px-2 py-1 rounded">Delete</button>
                                  </td>
                              </tr>
                          ))}
                      </tbody>
                  </table>
              </div>
           )}
           
           {view === 'outpass' && (
              <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse min-w-[900px]">
                      <thead><tr className="border-b-2 border-gray-100 text-xs text-gray-500 uppercase tracking-wider"><th className="p-3 pb-4">Staff (Therapist)</th><th className="p-3 pb-4">Date</th><th className="p-3 pb-4">Out Time</th><th className="p-3 pb-4">Expected Return</th><th className="p-3 pb-4">Actual Return</th><th className="p-3 pb-4 text-right">Overtime / Action</th></tr></thead>
                      <tbody>
                          {outpasses.length === 0 && (<tr><td colSpan={6} className="p-10 text-center text-gray-400">No out pass records found.</td></tr>)}
                          {outpasses.map((o) => (
                              <tr key={o.id} className="border-b border-gray-50 hover:bg-gray-50 transition text-sm">
                                  <td className="p-3">
                                      <div className="font-bold text-purple-700"><Coffee className="w-3 h-3 inline mr-1"/>{o.therapist}</div>
                                      <div className="text-[10px] text-gray-500 mt-0.5">Reason: {o.reason || '-'}</div>
                                  </td>
                                  <td className="p-3 text-gray-700 font-semibold">{o.date}</td>
                                  <td className="p-3 font-mono text-gray-600">{formatMillis(o.outTimeMillis)}</td>
                                  <td className="p-3 font-mono text-gray-600">{formatMillis(o.expectedInTimeMillis)}</td>
                                  <td className="p-3 font-mono text-gray-600">{o.status === 'out' ? <span className="text-orange-500 animate-pulse font-bold">OUT NOW</span> : formatMillis(o.inTimeMillis)}</td>
                                  <td className="p-3 text-right">
                                     <div className={`font-mono font-bold text-base mb-1 ${(o.overtimeSeconds || 0) > 0 ? 'text-red-600' : 'text-gray-400'}`}>{formatTimeDisplay(o.overtimeSeconds)}</div>
                                     <button onClick={() => handleDeleteOutpass(o.id!)} className="text-red-500 hover:text-red-700 text-xs font-bold bg-red-50 px-2 py-1 rounded">Delete</button>
                                  </td>
                              </tr>
                          ))}
                      </tbody>
                  </table>
              </div>
           )}
       </div>
   );
}

function AdminUsersList() {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingUser, setEditingUser] = useState<UserProfile | null>(null);
  const [editForm, setEditForm] = useState({ name: '', password: '' });

  const fetchUsers = async () => {
    try {
      const snap = await getDocs(collection(db, 'users'));
      const data: UserProfile[] = [];
      snap.forEach(doc => data.push(doc.data() as UserProfile));
      data.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
      setUsers(data);
    } catch (e) { console.error(e); }
    setLoading(false);
  };
  useEffect(() => { fetchUsers(); }, []);

  const handleUpdateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;
    try {
      await updateDoc(doc(db, 'users', editingUser.phone), { name: editForm.name, password: editForm.password });
      alert('User အချက်အလက်များ ပြင်ဆင်ပြီးပါပြီ။');
      setEditingUser(null);
      fetchUsers();
    } catch (e) { alert('Error updating user'); }
  };

  if (loading) return <div className="text-center py-20 text-gray-500 font-bold">Loading Users...</div>;

  return (
    <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200 relative">
      {editingUser && (
         <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
            <div className="bg-white p-6 rounded-xl shadow-lg max-w-sm w-full">
               <h3 className="text-lg font-bold mb-4 text-[#123524]">Edit User ({editingUser.phone})</h3>
               <form onSubmit={handleUpdateUser} className="space-y-4">
                 <div><label className="block text-xs font-bold text-gray-500 mb-1">Name</label><input type="text" value={editForm.name} onChange={e=>setEditForm({...editForm, name: e.target.value})} className="w-full p-2 border rounded" required /></div>
                 <div><label className="block text-xs font-bold text-gray-500 mb-1">Password</label><input type="text" value={editForm.password} onChange={e=>setEditForm({...editForm, password: e.target.value})} placeholder="Leave blank for no password" className="w-full p-2 border rounded" /></div>
                 <div className="flex space-x-2 pt-2">
                   <button type="button" onClick={() => setEditingUser(null)} className="flex-1 py-2 bg-gray-100 text-gray-600 rounded font-bold">Cancel</button>
                   <button type="submit" className="flex-1 py-2 bg-[#123524] text-white rounded font-bold">Save</button>
                 </div>
               </form>
            </div>
         </div>
      )}

      <div className="flex justify-between items-center mb-6 border-b border-gray-100 pb-4"><h2 className="text-xl font-bold flex items-center" style={{ color: THEME.primary }}><UserCircle className="mr-2 text-[#D4AF37]" /> Auto-Created Profiles</h2><span className="bg-gray-100 text-gray-700 px-4 py-1 rounded-full text-sm font-bold border border-gray-200">Total: {users.length}</span></div>
      <div className="overflow-x-auto"><table className="w-full text-left border-collapse min-w-[700px]"><thead><tr className="border-b-2 border-gray-100 text-xs text-gray-500 uppercase tracking-wider"><th className="p-3 pb-4">Phone (Login ID)</th><th className="p-3 pb-4">Name</th><th className="p-3 pb-4">Security</th><th className="p-3 pb-4">Created Date</th><th className="p-3 pb-4 text-right">Action</th></tr></thead><tbody>{users.length === 0 && (<tr><td colSpan={5} className="p-10 text-center text-gray-400">User မရှိသေးပါ။</td></tr>)}{users.map((u, idx) => (<tr key={idx} className="border-b border-gray-50 hover:bg-gray-50 transition"><td className="p-3 font-mono font-bold tracking-wider text-[#123524]">{u.phone}</td><td className="p-3 font-bold text-gray-800">{u.name || '-'}</td><td className="p-3">{u.password ? <span className="text-[10px] bg-green-100 text-green-700 font-bold px-2 py-1 rounded flex w-fit items-center"><KeyRound className="w-3 h-3 mr-1" /> Password Set</span> : <span className="text-[10px] bg-gray-100 text-gray-500 font-bold px-2 py-1 rounded flex w-fit items-center"><AlertCircle className="w-3 h-3 mr-1" /> None</span>}</td><td className="p-3 text-xs font-bold text-gray-500">{u.createdAt ? new Date(u.createdAt).toLocaleDateString() : '-'}</td><td className="p-3 text-right"><button onClick={() => { setEditingUser(u); setEditForm({ name: u.name || '', password: u.password || '' }); }} className="p-1.5 bg-blue-50 text-blue-600 rounded hover:bg-blue-100 font-bold text-[10px] flex items-center ml-auto"><Edit className="w-3 h-3 mr-1"/> Edit</button></td></tr>))}</tbody></table></div>
    </div>
  );
}

function AdminManagementList() {
  const [admins, setAdmins] = useState<AdminProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [newAdmin, setNewAdmin] = useState({ username: '', password: '' });

  const fetchAdmins = async () => {
    try {
      const snap = await getDocs(collection(db, 'admins'));
      const data: AdminProfile[] = [];
      snap.forEach(doc => data.push(doc.data() as AdminProfile));
      setAdmins(data);
    } catch (e) { console.error(e); }
    setLoading(false);
  };
  useEffect(() => { fetchAdmins(); }, []);

  const handleAddAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    if(!newAdmin.username || !newAdmin.password) return;
    try {
      await setDoc(doc(db, 'admins', newAdmin.username), { username: newAdmin.username, password: newAdmin.password });
      setNewAdmin({ username: '', password: '' });
      fetchAdmins();
    } catch (e) { alert('Error adding admin'); }
  };

  const handleDeleteAdmin = async (username: string) => {
    if (admins.length <= 1) { alert("အနည်းဆုံး Admin တစ်ယောက် ကျန်ရှိရပါမည်။"); return; }
    if (!window.confirm(`Admin [${username}] ကို ဖျက်မည် သေချာပါသလား?`)) return;
    try {
      await deleteDoc(doc(db, 'admins', username));
      fetchAdmins();
    } catch (e) { alert('Error deleting admin'); }
  };

  if (loading) return <div className="text-center py-20 text-gray-500 font-bold">Loading Admins...</div>;

  return (
    <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
      <div className="flex justify-between items-center mb-6 border-b border-gray-100 pb-4"><h2 className="text-xl font-bold flex items-center" style={{ color: THEME.primary }}><ShieldCheck className="mr-2 text-[#D4AF37]" /> Manage Admins</h2><span className="bg-gray-100 text-gray-700 px-4 py-1 rounded-full text-sm font-bold border border-gray-200">Total: {admins.length}</span></div>
      
      <form onSubmit={handleAddAdmin} className="mb-6 p-4 bg-gray-50 border border-gray-200 rounded-lg flex flex-col sm:flex-row gap-3 items-end">
        <div className="w-full sm:flex-1"><label className="block text-xs font-bold text-gray-500 mb-1">New Username</label><input type="text" value={newAdmin.username} onChange={e=>setNewAdmin({...newAdmin, username: e.target.value})} className="w-full p-2 border rounded" required /></div>
        <div className="w-full sm:flex-1"><label className="block text-xs font-bold text-gray-500 mb-1">New Password</label><input type="text" value={newAdmin.password} onChange={e=>setNewAdmin({...newAdmin, password: e.target.value})} className="w-full p-2 border rounded" required /></div>
        <button type="submit" className="w-full sm:w-auto px-4 py-2 bg-[#123524] text-white rounded font-bold flex items-center justify-center"><PlusCircle className="w-4 h-4 mr-1"/> Add Admin</button>
      </form>

      <div className="overflow-x-auto"><table className="w-full text-left border-collapse min-w-[600px]"><thead><tr className="border-b-2 border-gray-100 text-xs text-gray-500 uppercase tracking-wider"><th className="p-3 pb-4">Username</th><th className="p-3 pb-4">Password</th><th className="p-3 pb-4 text-right">Action</th></tr></thead><tbody>{admins.map((a, idx) => (<tr key={idx} className="border-b border-gray-50 hover:bg-gray-50 transition"><td className="p-3 font-bold text-gray-800 flex items-center"><User className="w-4 h-4 mr-2 text-gray-400"/> {a.username}</td><td className="p-3 font-mono text-sm text-gray-500 flex items-center"><Lock className="w-3 h-3 mr-1"/> {a.password}</td><td className="p-3 text-right"><button onClick={() => handleDeleteAdmin(a.username)} className="p-1.5 bg-red-50 text-red-600 rounded hover:bg-red-100 font-bold text-[10px] flex items-center ml-auto"><Trash2 className="w-3 h-3 mr-1"/> Delete</button></td></tr>))}</tbody></table></div>
    </div>
  );
}

// Admin Settings
function AdminSettings({ appData, onSettingsUpdated }: { appData: AppData, onSettingsUpdated: (data: AppData) => void }) {
  const [localTherapists, setLocalTherapists] = useState<TherapistProfile[]>(JSON.parse(JSON.stringify(appData.therapists || [])));
  const [localCategories, setLocalCategories] = useState<MenuCategory[]>(JSON.parse(JSON.stringify(appData.categories || [])));
  const [localBranding, setLocalBranding] = useState<AppBranding>(JSON.parse(JSON.stringify(appData.branding || DEFAULT_BRANDING)));
  const [localPaymentMethods, setLocalPaymentMethods] = useState<PaymentMethod[]>(JSON.parse(JSON.stringify(appData.paymentMethods || DEFAULT_PAYMENT_METHODS)));
  const [localPromotion, setLocalPromotion] = useState<PromotionSettings>(JSON.parse(JSON.stringify(appData.promotion || DEFAULT_PROMOTION)));

  const [deletedTherapistIds, setDeletedTherapistIds] = useState<string[]>([]);
  const [savingCategory, setSavingCategory] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState<string | null>(null);

  const handleSaveCategory = async (cIdx: number) => {
    const cat = localCategories[cIdx];
    if (!window.confirm(`Are you sure you want to save ${cat.title}?`)) return;
    setSavingCategory(cat.id);
    try {
      await setDoc(doc(db, 'settings', 'appData'), { categories: localCategories }, { merge: true });
      onSettingsUpdated({ ...appData, categories: localCategories });
      alert('Saved Successfully.');
    } catch (e) { alert('Update error.'); }
    setSavingCategory(null);
  };

  const handleSavePromotion = async () => {
    if (!window.confirm(`Are you sure you want to save promotion settings?`)) return;
    setSavingCategory('promotion');
    try {
      await setDoc(doc(db, 'settings', 'appData'), { promotion: localPromotion }, { merge: true });
      onSettingsUpdated({ ...appData, promotion: localPromotion });
      alert('Promotion settings saved successfully.');
    } catch (e) { alert('Update error.'); }
    setSavingCategory(null);
  };

  const handleSaveTherapists = async () => {
    if (!window.confirm(`Are you sure you want to save therapists list and ranking?`)) return;
    setSavingCategory('therapists');
    try {
      const finalizedTherapists = localTherapists.map((t, idx) => ({ ...t, order: idx }));
      
      const tPromises = finalizedTherapists.map((t) => setDoc(doc(db, 'therapists', t.id), { name: t.name, images: t.images, order: t.order, password: t.password || '' }));
      const delPromises = deletedTherapistIds.map(id => deleteDoc(doc(db, 'therapists', id)));
      
      await Promise.all([...tPromises, ...delPromises]);
      
      setDeletedTherapistIds([]);
      setLocalTherapists(finalizedTherapists);
      onSettingsUpdated({ ...appData, therapists: finalizedTherapists });
      
      alert('Therapists saved successfully.');
    } catch (e) { alert('Update error.'); }
    setSavingCategory(null);
  };

  const handleSaveBranding = async () => {
    if (!window.confirm(`Are you sure you want to save branding settings?`)) return;
    setSavingCategory('branding');
    try {
      await setDoc(doc(db, 'settings', 'appData'), { branding: localBranding }, { merge: true });
      onSettingsUpdated({ ...appData, branding: localBranding });
      alert('Branding saved successfully.');
    } catch (e) { alert('Update error.'); }
    setSavingCategory(null);
  };

  const handleSavePayments = async () => {
    if (!window.confirm(`Are you sure you want to save payment methods?`)) return;
    setSavingCategory('payments');
    try {
      await setDoc(doc(db, 'settings', 'appData'), { paymentMethods: localPaymentMethods }, { merge: true });
      onSettingsUpdated({ ...appData, paymentMethods: localPaymentMethods });
      alert('Payment methods saved successfully.');
    } catch (e) { alert('Update error.'); }
    setSavingCategory(null);
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return; setUploadingImage('logo');
    try { const base64 = await compressImage(file, 400, 400); setLocalBranding({ ...localBranding, logoUrl: base64 }); } catch (err) { alert("Error"); }
    setUploadingImage(null);
  };

  const handlePaymentLogoUpload = async (idx: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return; setUploadingImage(`pay_${idx}`);
    try { const base64 = await compressImage(file, 200, 200); const updated = [...localPaymentMethods]; updated[idx].logoUrl = base64; setLocalPaymentMethods(updated); } catch (err) { alert("Error"); }
    setUploadingImage(null);
  };

  const addTherapist = () => setLocalTherapists([...localTherapists, { id: `t_${Date.now()}`, name: 'New Therapist', images: [], order: localTherapists.length, password: '' }]);
  
  const updateTherapistField = (tIdx: number, field: keyof TherapistProfile, val: any) => { 
      const updated = [...localTherapists]; 
      updated[tIdx] = { ...updated[tIdx], [field]: val };
      setLocalTherapists(updated); 
  };

  const removeTherapist = (tIdx: number) => {
    if (!window.confirm("Are you sure you want to delete this therapist?")) return;
    const t = localTherapists[tIdx];
    if (t.id && !t.id.startsWith('new_')) setDeletedTherapistIds([...deletedTherapistIds, t.id]);
    const updated = [...localTherapists]; updated.splice(tIdx, 1); setLocalTherapists(updated);
  };

  const moveTherapistUp = (tIdx: number) => {
    if (tIdx === 0) return;
    const updated = [...localTherapists];
    const temp = updated[tIdx - 1];
    updated[tIdx - 1] = updated[tIdx];
    updated[tIdx] = temp;
    setLocalTherapists(updated);
  };

  const moveTherapistDown = (tIdx: number) => {
    if (tIdx === localTherapists.length - 1) return;
    const updated = [...localTherapists];
    const temp = updated[tIdx + 1];
    updated[tIdx + 1] = updated[tIdx];
    updated[tIdx] = temp;
    setLocalTherapists(updated);
  };

  const handleImageUpload = async (tIdx: number, files: FileList | null) => {
    if (!files || files.length === 0) return; const therapist = localTherapists[tIdx]; if (therapist.images.length + files.length > 5) { alert('Max 5 photos allowed.'); return; }
    setUploadingImage(therapist.id); const newUrls: string[] = [];
    try {
      for (let i = 0; i < files.length; i++) {
        const base64 = await compressImage(files[i], 900, 1200); 
        newUrls.push(base64);
      }
      const updated = [...localTherapists];
      updated[tIdx].images = [...updated[tIdx].images, ...newUrls];
      setLocalTherapists(updated);
    } catch (err) { alert("Upload error."); }
    setUploadingImage(null);
  };

  const removeImage = (tIdx: number, imgIdx: number) => { const updated = [...localTherapists]; updated[tIdx].images.splice(imgIdx, 1); setLocalTherapists(updated); };

  const updateItem = (cIdx: number, iIdx: number, field: string, val: any) => { const updated = [...localCategories]; (updated[cIdx].items[iIdx] as any)[field] = val; setLocalCategories(updated); };
  const addItem = (cIdx: number) => { const updated = [...localCategories]; updated[cIdx].items.push({ id: Date.now().toString(), name: 'New Service', price: 0, duration: '60 Mins', vvipIncluded: false }); setLocalCategories(updated); };
  const deleteItem = (cIdx: number, iIdx: number) => { if (!window.confirm("Are you sure?")) return; const updated = [...localCategories]; updated[cIdx].items.splice(iIdx, 1); setLocalCategories(updated); };

  const updatePaymentMethod = (pIdx: number, field: string, val: string) => { const updated = [...localPaymentMethods]; (updated[pIdx] as any)[field] = val; setLocalPaymentMethods(updated); };
  const addPaymentMethod = () => { setLocalPaymentMethods([...localPaymentMethods, { id: `p_${Date.now()}`, name: 'New Payment', accountNumber: '', accountName: '', logoUrl: '' }]); };
  const removePaymentMethod = (pIdx: number) => { if (!window.confirm("Are you sure?")) return; const updated = [...localPaymentMethods]; updated.splice(pIdx, 1); setLocalPaymentMethods(updated); };

  return (
    <div className="space-y-6">

      {/* App Promotion & Discounts Section */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200 mt-6">
         <div className="flex justify-between items-center mb-6 pb-4 border-b border-gray-100">
            <div>
               <h3 className="text-xl font-bold text-gray-800 flex items-center"><Sparkles className="w-5 h-5 mr-2 text-green-600" /> App Promotion & Discounts</h3>
               <p className="text-xs text-gray-500 mt-1">Web App မှ Booking တင်သူများအတွက် Discount သတ်မှတ်ရန်</p>
            </div>
            <button disabled={savingCategory === 'promotion'} onClick={handleSavePromotion} className="flex items-center bg-[#123524] text-white px-4 py-2 rounded-lg font-bold shadow-md hover:opacity-90 flex-shrink-0 ml-3">
               <Save className="w-4 h-4 mr-2" /> {savingCategory === 'promotion' ? 'Saving...' : 'Save'}
            </button>
         </div>
         
         <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
             <div className="flex items-center space-x-3 mb-2 md:col-span-2 bg-gray-50 p-3 rounded-lg border border-gray-200 w-full sm:w-auto">
                 <label className="text-sm font-bold text-gray-700 cursor-pointer flex-1 flex items-center justify-between">
                     <span>Enable Promotion (Promotion ဖွင့်ရန်)</span>
                     <input type="checkbox" checked={localPromotion.isActive} onChange={(e) => setLocalPromotion({...localPromotion, isActive: e.target.checked})} className="w-5 h-5 accent-[#123524]" />
                 </label>
             </div>
             
             <div>
                 <label className="block text-xs font-bold text-gray-500 mb-1">Hotel & Home Services Discount (%)</label>
                 <input type="number" value={localPromotion.hotelDiscountPercent} onChange={(e) => setLocalPromotion({...localPromotion, hotelDiscountPercent: Number(e.target.value)})} className="w-full p-2 text-sm border border-gray-300 rounded focus:border-[#D4AF37] outline-none" />
             </div>
             <div>
                 <label className="block text-xs font-bold text-gray-500 mb-1">Other Services Discount (%)</label>
                 <input type="number" value={localPromotion.otherDiscountPercent} onChange={(e) => setLocalPromotion({...localPromotion, otherDiscountPercent: Number(e.target.value)})} className="w-full p-2 text-sm border border-gray-300 rounded focus:border-[#D4AF37] outline-none" />
             </div>
             <div>
                 <label className="block text-xs font-bold text-gray-500 mb-1">Start Date</label>
                 <input type="date" value={localPromotion.startDate} onChange={(e) => setLocalPromotion({...localPromotion, startDate: e.target.value})} className="w-full p-2 text-sm border border-gray-300 rounded focus:border-[#D4AF37] outline-none" />
             </div>
             <div>
                 <label className="block text-xs font-bold text-gray-500 mb-1">End Date</label>
                 <input type="date" value={localPromotion.endDate} onChange={(e) => setLocalPromotion({...localPromotion, endDate: e.target.value})} className="w-full p-2 text-sm border border-gray-300 rounded focus:border-[#D4AF37] outline-none" />
             </div>
         </div>
      </div>

      <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
        <div className="flex justify-between items-center mb-6 pb-4 border-b border-gray-100">
          <div>
             <h3 className="text-xl font-bold text-gray-800 flex items-center">App Branding & Footer</h3>
             <div className="flex flex-wrap gap-2 mt-2">
                 <button type="button" onClick={() => {
                    const url = window.location.origin + window.location.pathname + '?view=therapists';
                    navigator.clipboard.writeText(url);
                    alert('Gallery Link Copied:\n' + url);
                 }} className="text-xs flex items-center text-blue-600 bg-blue-50 px-3 py-1.5 rounded border border-blue-200 hover:bg-blue-100 transition whitespace-nowrap">
                    <Copy className="w-3 h-3 mr-1"/> Copy Gallery Link
                 </button>
                 <button type="button" onClick={() => {
                    const url = window.location.origin + window.location.pathname + '?view=dashboard';
                    navigator.clipboard.writeText(url);
                    alert('Dashboard Link Copied:\n' + url);
                 }} className="text-xs flex items-center text-green-600 bg-green-50 px-3 py-1.5 rounded border border-green-200 hover:bg-green-100 transition whitespace-nowrap">
                    <Copy className="w-3 h-3 mr-1"/> Copy Dashboard Link
                 </button>
                 <button type="button" onClick={() => {
                    const url = window.location.origin + window.location.pathname + '?mode=staff';
                    navigator.clipboard.writeText(url);
                    alert('Staff Portal Link Copied:\n' + url);
                 }} className="text-xs flex items-center text-purple-600 bg-purple-50 px-3 py-1.5 rounded border border-purple-200 hover:bg-purple-100 transition whitespace-nowrap mt-2 sm:mt-0 sm:ml-2">
                    <Copy className="w-3 h-3 mr-1"/> Copy Staff Portal Link
                 </button>
             </div>
          </div>
          <button disabled={savingCategory === 'branding'} onClick={handleSaveBranding} className="flex items-center bg-[#123524] text-white px-4 py-2 rounded-lg font-bold shadow-md hover:opacity-90 flex-shrink-0 ml-3">
            <Save className="w-4 h-4 mr-2" /> {savingCategory === 'branding' ? 'Saving...' : 'Save'}
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="border border-gray-200 rounded-xl p-4 bg-gray-50 flex flex-col items-center justify-center">
            <label className="block text-xs font-bold text-gray-500 mb-4 text-center w-full">Header Logo Image (Circle Format)</label>
            <div className="w-28 h-28 bg-white border-2 border-dashed border-gray-300 rounded-full flex items-center justify-center relative overflow-hidden mb-4 shadow-sm group">
              {localBranding.logoUrl ? (
                <><img src={localBranding.logoUrl} alt="Logo Preview" className="w-full h-full object-cover" /><div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"><button onClick={() => setLocalBranding({ ...localBranding, logoUrl: '' })} className="bg-red-500 text-white p-2 rounded-full hover:bg-red-600"><Trash2 className="w-4 h-4" /></button></div></>
              ) : (
                <div className="flex flex-col items-center text-gray-400">{uploadingImage === 'logo' ? <div className="text-xs font-bold animate-pulse">Uploading...</div> : "No Logo"}</div>
              )}
            </div>
            <label className="bg-white border border-gray-300 text-gray-700 px-4 py-2 rounded-lg text-sm font-bold cursor-pointer hover:bg-gray-100 transition shadow-sm">
              {localBranding.logoUrl ? 'Change Logo' : 'Upload Logo'}
              <input type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} disabled={uploadingImage === 'logo'} />
            </label>
          </div>
          <div className="space-y-4">
            <div><label className="block text-xs font-bold text-gray-500 mb-1">Business Name</label><input type="text" value={localBranding.name || ''} onChange={e => setLocalBranding({ ...localBranding, name: e.target.value })} className="w-full p-2 text-sm border border-gray-300 rounded focus:border-[#D4AF37] outline-none" /></div>
            <div><label className="block text-xs font-bold text-gray-500 mb-1">Address</label><textarea value={localBranding.address} onChange={e => setLocalBranding({ ...localBranding, address: e.target.value })} className="w-full p-2 text-sm border border-gray-300 rounded focus:border-[#D4AF37] outline-none" rows={2} /></div>
            <div className="grid grid-cols-2 gap-2">
              <div><label className="block text-xs font-bold text-gray-500 mb-1">Phone 1</label><input type="text" value={localBranding.phone1} onChange={e => setLocalBranding({ ...localBranding, phone1: e.target.value })} className="w-full p-2 text-sm border border-gray-300 rounded focus:border-[#D4AF37] outline-none" /></div>
              <div><label className="block text-xs font-bold text-gray-500 mb-1">Phone 2</label><input type="text" value={localBranding.phone2} onChange={e => setLocalBranding({ ...localBranding, phone2: e.target.value })} className="w-full p-2 text-sm border border-gray-300 rounded focus:border-[#D4AF37] outline-none" /></div>
            </div>
            <div><label className="block text-xs font-bold text-gray-500 mb-1">Copyright Text</label><input type="text" value={localBranding.copyright} onChange={e => setLocalBranding({ ...localBranding, copyright: e.target.value })} className="w-full p-2 text-sm border border-gray-300 rounded focus:border-[#D4AF37] outline-none" /></div>
          </div>
        </div>

        <div className="border-t border-gray-100 pt-6 mt-6">
          <h4 className="text-sm font-bold text-gray-800 mb-2">Shop Location (For Staff Out Pass GPS Restriction)</h4>
          <div className="flex items-center space-x-2">
             <div className="flex-1 bg-gray-50 p-3 rounded border border-gray-200 text-xs text-gray-600 font-mono">
               Lat: {localBranding.shopLat ? localBranding.shopLat.toFixed(5) : 'Not set'}, Lng: {localBranding.shopLng ? localBranding.shopLng.toFixed(5) : 'Not set'}
             </div>
             <button type="button" onClick={() => {
                navigator.geolocation.getCurrentPosition((pos) => {
                   setLocalBranding({...localBranding, shopLat: pos.coords.latitude, shopLng: pos.coords.longitude});
                   alert("Location updated! Please click 'Save' above to confirm.");
                }, () => alert("Please enable Location Services in your browser to get coordinates."), {enableHighAccuracy: true});
             }} className="bg-green-50 text-green-700 px-4 py-3 rounded-lg text-xs font-bold border border-green-200 hover:bg-green-100 transition whitespace-nowrap">
                Get Current GPS
             </button>
          </div>
          <p className="text-[10px] text-gray-400 mt-2">Staff will only be able to Clock Out/In within 15 meters of this exact location. Make sure you are physically at the shop when setting this.</p>
        </div>
      </div>

      <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
        <div className="flex justify-between items-center mb-6 pb-4 border-b border-gray-100"><div><h3 className="text-xl font-bold text-gray-800 flex items-center"><CreditCard className="w-5 h-5 mr-2 text-[#D4AF37]" /> Manage Payment</h3></div><div className="flex space-x-2"><button onClick={addPaymentMethod} className="flex items-center text-sm bg-gray-100 border border-gray-300 px-4 py-2 rounded-lg hover:bg-gray-200 font-bold whitespace-nowrap"><PlusCircle className="w-4 h-4 mr-1" /> Add Payment</button><button disabled={savingCategory === 'payments'} onClick={handleSavePayments} className="flex items-center bg-[#123524] text-white px-4 py-2 rounded-lg font-bold shadow-md hover:opacity-90 flex-shrink-0"><Save className="w-4 h-4 mr-2" /> {savingCategory === 'payments' ? 'Saving...' : 'Save'}</button></div></div>
        <div className="space-y-3">{localPaymentMethods.map((pm, pIdx) => (<div key={pm.id} className="grid grid-cols-1 lg:grid-cols-12 gap-3 items-center bg-gray-50 p-3 border border-gray-200 rounded-lg hover:border-gray-300 transition"><div className="lg:col-span-2 flex flex-col items-center justify-center border-r border-gray-200 pr-2"><div className="w-12 h-12 bg-white border border-gray-200 rounded mb-1 flex items-center justify-center overflow-hidden relative group">{pm.logoUrl ? (<><img src={pm.logoUrl} alt="Logo" className="w-full h-full object-contain p-1" /><button onClick={() => updatePaymentMethod(pIdx, 'logoUrl', '')} className="absolute inset-0 bg-black/50 text-white flex items-center justify-center opacity-0 group-hover:opacity-100"><X className="w-4 h-4" /></button></>) : (<div className="text-[8px] text-gray-400 text-center">{uploadingImage === `pay_${pIdx}` ? '...' : 'No Logo'}</div>)}</div><label className="text-[10px] text-[#D4AF37] font-bold cursor-pointer hover:underline">Upload Logo<input type="file" accept="image/*" className="hidden" onChange={(e) => handlePaymentLogoUpload(pIdx, e)} disabled={uploadingImage === `pay_${pIdx}`} /></label></div><div className="lg:col-span-3"><label className="text-[10px] font-bold text-gray-400 uppercase">Bank Name</label><input type="text" value={pm.name} onChange={(e) => updatePaymentMethod(pIdx, 'name', e.target.value)} className="w-full p-2 text-sm border border-gray-200 rounded focus:border-[#D4AF37] outline-none font-bold text-gray-700" /></div><div className="lg:col-span-3"><label className="text-[10px] font-bold text-gray-400 uppercase">Account No</label><input type="text" value={pm.accountNumber} onChange={(e) => updatePaymentMethod(pIdx, 'accountNumber', e.target.value)} className="w-full p-2 text-sm border border-gray-200 rounded focus:border-[#D4AF37] outline-none font-bold text-[#123524] tracking-wider" /></div><div className="lg:col-span-3"><label className="text-[10px] font-bold text-gray-400 uppercase">Account Name</label><input type="text" value={pm.accountName} onChange={(e) => updatePaymentMethod(pIdx, 'accountName', e.target.value)} className="w-full p-2 text-sm border border-gray-200 rounded focus:border-[#D4AF37] outline-none" /></div><div className="lg:col-span-1 flex justify-end pt-4 lg:pt-0"><button onClick={() => removePaymentMethod(pIdx)} className="p-2 text-red-500 hover:bg-red-50 hover:text-red-700 rounded-lg transition"><Trash2 className="w-5 h-5" /></button></div></div>))}</div>
      </div>

      <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
        <div className="flex justify-between items-center mb-6 pb-4 border-b border-gray-100"><div><h3 className="text-xl font-bold text-gray-800 flex items-center"><User className="w-5 h-5 mr-2 text-[#D4AF37]" /> Manage Therapists (Staff)</h3></div><div className="flex space-x-2"><button onClick={addTherapist} className="flex items-center text-sm bg-gray-100 border border-gray-300 px-4 py-2 rounded-lg hover:bg-gray-200 font-bold whitespace-nowrap"><PlusCircle className="w-4 h-4 mr-1" /> Add Therapist</button><button disabled={savingCategory === 'therapists'} onClick={handleSaveTherapists} className="flex items-center bg-[#123524] text-white px-4 py-2 rounded-lg font-bold shadow-md hover:opacity-90 flex-shrink-0"><Save className="w-4 h-4 mr-2" /> {savingCategory === 'therapists' ? 'Saving...' : 'Save'}</button></div></div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {localTherapists.map((therapist, tIdx) => (
            <div key={therapist.id} className="border border-gray-200 rounded-xl p-4 bg-gray-50 relative">
              <button onClick={() => removeTherapist(tIdx)} className="absolute top-2 right-2 p-1 bg-red-100 text-red-500 rounded hover:bg-red-200"><Trash2 className="w-4 h-4" /></button>
              
              <div className="mb-3 mt-2">
                 <span className="bg-[#123524] text-white text-[10px] font-bold px-2 py-1 rounded">Login ID: {therapist.id}</span>
              </div>

              <div className="grid grid-cols-2 gap-3 mb-4">
                 <div>
                    <label className="block text-xs font-bold text-gray-500 mb-1">Therapist Name</label>
                    <input type="text" value={therapist.name} onChange={(e) => updateTherapistField(tIdx, 'name', e.target.value)} className="w-full p-2 text-sm font-bold border border-gray-300 rounded focus:outline-none focus:border-[#D4AF37]" />
                 </div>
                 <div>
                    <label className="block text-xs font-bold text-gray-500 mb-1">Login Password</label>
                    <input type="text" value={therapist.password || ''} onChange={(e) => updateTherapistField(tIdx, 'password', e.target.value)} placeholder="Password" className="w-full p-2 text-sm font-bold border border-gray-300 rounded focus:outline-none focus:border-[#D4AF37]" />
                 </div>
              </div>
              
              <label className="block text-xs font-bold text-gray-500 mb-2">Photos (Max 5)</label>
              <div className="flex flex-wrap gap-2 mb-2">
                {therapist.images.map((imgUrl, imgIdx) => (
                  <div key={imgIdx} className="w-16 aspect-[3/4] relative rounded overflow-hidden shadow-sm border border-gray-200">
                    <img src={imgUrl} alt="upload" className="w-full h-full object-cover" />
                    <button onClick={() => removeImage(tIdx, imgIdx)} className="absolute top-1 right-1 bg-black/50 text-white rounded-full p-0.5 hover:bg-red-500"><X className="w-3 h-3" /></button>
                  </div>
                ))}
                {therapist.images.length < 5 && (
                    <>
                    <label className="w-16 aspect-[3/4] border-2 border-dashed border-gray-300 rounded flex flex-col items-center justify-center cursor-pointer hover:bg-gray-100 hover:border-gray-400 transition text-gray-400 relative">
                        {uploadingImage === therapist.id ? <div className="text-[10px] font-bold animate-pulse text-center">Wait...</div> : (<span className="text-[10px] font-bold">Upload</span>)}
                        <input type="file" accept="image/*" multiple className="absolute inset-0 opacity-0 cursor-pointer" onChange={(e) => handleImageUpload(tIdx, e.target.files)} disabled={uploadingImage === therapist.id} />
                    </label>
                    </>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Manual Therapist Ranking Section */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200 mt-6">
         <div className="flex justify-between items-center mb-6 pb-4 border-b border-gray-100">
            <div>
               <h3 className="text-xl font-bold text-gray-800 flex items-center"><Crown className="w-5 h-5 mr-2 text-[#D4AF37]" /> Top 5 Therapists Ranking</h3>
               <p className="text-xs text-gray-500 mt-1">ဘိုကင်အရေအတွက် တူညီနေပါက အောက်ပါအစီအစဉ်အတိုင်း Top 5 တွင် ပေါ်မည်ဖြစ်ပါသည်။</p>
            </div>
            <button disabled={savingCategory === 'therapists'} onClick={handleSaveTherapists} className="flex items-center bg-[#123524] text-white px-4 py-2 rounded-lg font-bold shadow-md hover:opacity-90 flex-shrink-0 ml-3">
               <Save className="w-4 h-4 mr-2" /> {savingCategory === 'therapists' ? 'Saving...' : 'Save'}
            </button>
         </div>
         <div className="flex flex-col space-y-2">
            {localTherapists.map((therapist, tIdx) => (
                <div key={therapist.id} className="flex items-center justify-between p-3 bg-gray-50 border border-gray-200 rounded-lg hover:border-[#D4AF37] transition">
                    <div className="flex items-center">
                        <span className="w-6 h-6 rounded bg-[#123524] text-white flex items-center justify-center text-xs font-bold mr-3">{tIdx + 1}</span>
                        <span className="font-bold text-gray-800 text-sm">{therapist.name}</span>
                    </div>
                    <div className="flex space-x-1">
                        <button type="button" onClick={() => moveTherapistUp(tIdx)} disabled={tIdx === 0} className="p-1.5 bg-white border border-gray-300 text-gray-600 rounded hover:bg-gray-100 disabled:opacity-30"><ChevronUp className="w-4 h-4" /></button>
                        <button type="button" onClick={() => moveTherapistDown(tIdx)} disabled={tIdx === localTherapists.length - 1} className="p-1.5 bg-white border border-gray-300 text-gray-600 rounded hover:bg-gray-100 disabled:opacity-30"><ChevronDown className="w-4 h-4" /></button>
                    </div>
                </div>
            ))}
         </div>
      </div>

      {localCategories.map((cat, cIdx) => (
        <div key={cat.id} className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden mt-6">
          <div className="bg-gray-50 p-4 border-b border-gray-200 flex justify-between items-center"><h3 className="font-bold text-gray-800 flex items-center text-lg"><Activity className="w-5 h-5 mr-2 text-[#D4AF37]" /> {cat.title} Category</h3><div className="flex space-x-2"><button onClick={() => addItem(cIdx)} className="flex items-center text-sm bg-white border border-gray-300 px-4 py-2 rounded-lg hover:bg-gray-100 font-bold whitespace-nowrap"><PlusCircle className="w-4 h-4 mr-1" /> Add Item</button><button disabled={savingCategory === cat.id} onClick={() => handleSaveCategory(cIdx)} className="flex items-center bg-[#D4AF37] text-white px-4 py-2 rounded-lg font-bold shadow-md hover:opacity-90 flex-shrink-0"><Save className="w-4 h-4 mr-2" /> {savingCategory === cat.id ? 'Saving...' : 'Save'}</button></div></div>
          <div className="p-4 space-y-3">{cat.items.length === 0 && <p className="text-sm text-gray-400 text-center py-4">No items in this category.</p>}
            {cat.items.map((item, iIdx) => (<div key={item.id} className="grid grid-cols-1 lg:grid-cols-12 gap-2 items-center bg-white p-3 border border-gray-200 rounded-lg hover:border-gray-300 transition"><div className="lg:col-span-3"><label className="text-[10px] font-bold text-gray-400 uppercase">Service Name</label><input type="text" value={item.name} onChange={(e) => updateItem(cIdx, iIdx, 'name', e.target.value)} className="w-full p-2 text-sm border border-gray-200 rounded focus:border-[#D4AF37] outline-none font-bold text-gray-700" /></div><div className="lg:col-span-2"><label className="text-[10px] font-bold text-gray-400 uppercase">Duration/Info</label><input type="text" value={item.duration} onChange={(e) => updateItem(cIdx, iIdx, 'duration', e.target.value)} placeholder="60 Mins" className="w-full p-2 text-sm border border-gray-200 rounded focus:border-[#D4AF37] outline-none" /></div><div className="lg:col-span-2"><label className="text-[10px] font-bold text-gray-400 uppercase">Price (Ks)</label><input type="number" value={item.price || ''} onChange={(e) => updateItem(cIdx, iIdx, 'price', Number(e.target.value))} className="w-full p-2 text-sm border border-gray-200 rounded focus:border-[#D4AF37] outline-none font-bold text-[#123524]" /></div><div className="lg:col-span-2"><label className="text-[10px] font-bold text-gray-400 uppercase">VVIP Price (Ks)</label><input type="number" value={item.vvipPrice || ''} onChange={(e) => updateItem(cIdx, iIdx, 'vvipPrice', e.target.value === '' ? undefined : Number(e.target.value))} placeholder="Optional" className="w-full p-2 text-sm border border-gray-200 rounded focus:border-[#D4AF37] outline-none font-bold text-yellow-600" /></div><div className="lg:col-span-2 flex items-center px-2 pt-4"><label className="text-xs font-bold text-gray-600 flex items-center cursor-pointer bg-gray-50 px-2 py-1.5 rounded border border-gray-200 w-full"><input type="checkbox" checked={item.vvipIncluded || false} onChange={(e) => updateItem(cIdx, iIdx, 'vvipIncluded', e.target.checked)} className="mr-2" /> VVIP Free</label></div><div className="lg:col-span-1 flex justify-end pt-4 lg:pt-0"><button onClick={() => deleteItem(cIdx, iIdx)} className="p-2 text-red-500 hover:bg-red-50 hover:text-red-700 rounded-lg transition"><Trash2 className="w-5 h-5" /></button></div></div>))}
          </div>
        </div>
      ))}
    </div>
  );
}
