import React, { useState, useEffect, useRef } from 'react';
import { collection, addDoc, getDocs, updateDoc, deleteDoc, doc, query, orderBy, getDoc, setDoc, onSnapshot } from 'firebase/firestore';
import { db } from './firebase';
import { Calendar, Clock, CreditCard, CheckCircle, Trash2, User, Phone, ShieldCheck, Activity, Copy, ChevronRight, ChevronLeft, Check, Sparkles, Droplets, Scissors, Home, ChevronDown, ChevronUp, Crown, Save, PlusCircle, Settings, UploadCloud, X, ImageIcon, MapPin, Search, LogOut, KeyRound, AlertCircle, History, UserCircle, CalendarPlus, Edit, ShieldAlert, Lock } from 'lucide-react';

// --- Theme & Icons Setup ---
const THEME = { primary: '#123524', gold: '#D4AF37', textGray: '#4a5568' };

const ICON_MAP: Record<string, any> = {
  massage: Sparkles,
  scrub: Droplets,
  waxing: Scissors,
  hotel: Home,
  facial: Droplets,
  manicure: Scissors,
  pedicure: Scissors,
};

// --- Types ---
interface MenuItem { id: string; name: string; price: number; duration: string; vvipPrice?: number; vvipIncluded?: boolean; }
interface MenuCategory { id: string; title: string; items: MenuItem[]; }
interface TherapistProfile { id: string; name: string; images: string[]; order: number; }
interface Booking { id?: string; name: string; phone: string; service: string; therapist: string; date: string; time: string; paymentMethod: string; txId: string; totalPrice: number; status: 'pending' | 'payment_checking' | 'approved' | 'cancelled'; cancelReason?: string; specialRequest?: string; createdAt: number; }
interface AppBranding { logoUrl: string; address: string; phone1: string; phone2: string; copyright: string; name: string; }
interface PaymentMethod { id: string; name: string; accountNumber: string; accountName: string; logoUrl: string; }
interface AppData { therapists: TherapistProfile[]; categories: MenuCategory[]; branding: AppBranding; paymentMethods: PaymentMethod[]; }
interface UserProfile { phone: string; name: string; password?: string; createdAt: number; }
interface AdminProfile { username: string; password?: string; }

// --- Default Data Setup ---
const DEFAULT_BRANDING: AppBranding = {
  logoUrl: '', name: "The Shangri-La", address: "33th(B) St, Between 65th & 65th(A) Sts, Mandalay",
  phone1: "09-458884517", phone2: "09-770072190", copyright: "© 2026 The Shangri-La Men's Retreat."
};
const DEFAULT_PAYMENT_METHODS: PaymentMethod[] = [{ id: 'p1', name: 'KBZ PAY', accountNumber: '09458888510', accountName: 'Htet Naing Kyaw', logoUrl: '' }];
const DEFAULT_THERAPISTS: TherapistProfile[] = Array.from({ length: 15 }, (_, i) => ({ id: `t_${i}`, name: `Therapist No-${i + 1}`, images: [], order: i }));
const DEFAULT_CATEGORIES: MenuCategory[] = [
  { id: 'massage', title: 'Massage', items: [{ id: 'm1', name: 'Traditional Massage', price: 25000, duration: '60 Mins' }] },
  { id: 'hotel', title: 'Hotel & Home Services', items: [{ id: 'h1', name: 'Part Time Outcall Service', price: 70000, duration: '100 Mins' }] }
];

const ALL_TIME_SLOTS = ["6:00 AM", "6:30 AM", "7:00 AM", "7:30 AM", "8:00 AM", "8:30 AM", "9:00 AM", "9:30 AM", "10:00 AM", "10:30 AM", "11:00 AM", "11:30 AM", "12:00 PM", "12:30 PM", "1:00 PM", "1:30 PM", "2:00 PM", "2:30 PM", "3:00 PM", "3:30 PM", "4:00 PM", "4:30 PM", "5:00 PM", "5:30 PM", "6:00 PM", "6:30 PM", "7:00 PM", "7:30 PM", "8:00 PM", "8:30 PM", "9:00 PM"];

const formatPrice = (price: any) => {
  const num = Number(price);
  if (isNaN(num)) return '0 Ks';
  return num.toLocaleString() + ' Ks';
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
        canvas.width = width; canvas.height = height; const ctx = canvas.getContext('2d'); ctx?.drawImage(img, sX, sY, sW, sH, 0, 0, width, height); resolve(canvas.toDataURL('image/jpeg', 0.7));
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
  const [isAdminMode, setIsAdminMode] = useState(false);
  const [loggedInAdmin, setLoggedInAdmin] = useState<string | null>(sessionStorage.getItem('shangrila_admin'));
  const [appData, setAppData] = useState<AppData | null>(null);
  const [dbError, setDbError] = useState(false);

  useEffect(() => {
    document.title = "The Shangri-La | Men's Retreat";
    const updateFavicon = (url: string) => {
      // Remove old icons
      const existingIcons = document.querySelectorAll("link[rel*='icon'], link[rel='apple-touch-icon']"); 
      existingIcons.forEach(icon => document.head.removeChild(icon));
      
      // Standard Favicon
      const newIcon = document.createElement('link'); 
      newIcon.rel = 'shortcut icon'; 
      newIcon.type = 'image/png'; 
      newIcon.href = url; 
      document.head.appendChild(newIcon);

      // Apple Touch Icon for "Add to Home Screen"
      const appleIcon = document.createElement('link');
      appleIcon.rel = 'apple-touch-icon';
      appleIcon.href = url;
      document.head.appendChild(appleIcon);
    };
    if (appData?.branding?.logoUrl) { updateFavicon(appData.branding.logoUrl); }
    else { updateFavicon("https://upload.wikimedia.org/wikipedia/commons/4/41/Shangri-La_Hotels_and_Resorts_logo.svg"); }
  }, [appData?.branding?.logoUrl]);

  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search);
    if (searchParams.get('mode') === 'admin') setIsAdminMode(true);

    const initData = async () => {
      try {
        const docRef = doc(db, 'settings', 'appData');
        const snap = await getDoc(docRef);
        let loadedData: Partial<AppData> = {};
        if (snap.exists()) loadedData = snap.data() || {};

        const finalCategories = Array.isArray(loadedData.categories) ? loadedData.categories : DEFAULT_CATEGORIES;
        const finalBranding = { ...DEFAULT_BRANDING, ...(loadedData.branding || {}) };
        const finalPaymentMethods = Array.isArray(loadedData.paymentMethods) ? loadedData.paymentMethods : DEFAULT_PAYMENT_METHODS;

        const tQuery = query(collection(db, 'therapists'), orderBy('order', 'asc'));
        const tSnap = await getDocs(tQuery);
        let loadedTherapists: TherapistProfile[] = [];

        if (!tSnap.empty) { tSnap.forEach(d => loadedTherapists.push({ id: d.id, ...d.data() } as TherapistProfile)); }
        else { loadedTherapists = DEFAULT_THERAPISTS; }

        setAppData({ categories: finalCategories, therapists: loadedTherapists, branding: finalBranding, paymentMethods: finalPaymentMethods });
      } catch (err) {
        console.error(err); setDbError(true);
        setAppData({ categories: DEFAULT_CATEGORIES, therapists: DEFAULT_THERAPISTS, branding: DEFAULT_BRANDING, paymentMethods: DEFAULT_PAYMENT_METHODS });
      }
    };
    initData();
  }, []);

  if (!appData) { return <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center text-[#123524] font-bold">Loading The Shangri-La...</div>; }

  return (
    <div className="min-h-screen bg-gray-50 text-gray-800 font-sans flex flex-col">
      {dbError && <div className="bg-red-500 text-white text-xs text-center py-1">Database Loading Warning. Showing Default Data.</div>}
      <header className="bg-white shadow-sm py-6 px-4 text-center border-b border-gray-200 flex flex-col items-center justify-center relative">
        <div className="flex items-center justify-center mb-1">
          {appData.branding.logoUrl && (
            <div className="w-12 h-12 rounded-full overflow-hidden mr-3 border-2 shadow-sm flex-shrink-0" style={{ borderColor: THEME.gold }}>
              <img src={appData.branding.logoUrl} alt="Logo" className="w-full h-full object-cover bg-white" />
            </div>
          )}
          <h1 className="text-2xl font-bold tracking-wider" style={{ color: THEME.primary }}>{appData.branding.name || 'The Shangri-La'}</h1>
        </div>
        <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: THEME.gold }}>Men's Retreat (Beyond Relaxation)</p>
        
        {isAdminMode && loggedInAdmin && (
           <button onClick={() => { setLoggedInAdmin(null); sessionStorage.removeItem('shangrila_admin'); }} className="absolute top-6 right-4 sm:right-6 text-xs font-bold text-red-500 flex items-center bg-red-50 px-3 py-1.5 rounded-full hover:bg-red-100 transition border border-red-100"><LogOut className="w-3 h-3 mr-1" /> Logout</button>
        )}
      </header>

      <main className="flex-1 w-full max-w-4xl mx-auto p-4 py-6">
        {isAdminMode ? (
          loggedInAdmin ? <AdminDashboard appData={appData} onSettingsUpdated={setAppData} /> 
                        : <AdminLogin onLogin={(user) => { setLoggedInAdmin(user); sessionStorage.setItem('shangrila_admin', user); }} />
        ) : <CustomerApp appData={appData} />}
      </main>

      {!isAdminMode && (
        <footer className="bg-white border-t border-gray-200 mt-10 py-8 text-center text-sm text-gray-500">
          <h3 className="font-bold text-base mb-2" style={{ color: THEME.primary }}>{appData.branding.name || 'The Shangri-La'} Men's Retreat</h3>
          <p className="mb-2 flex items-center justify-center text-xs sm:text-sm"><MapPin className="w-4 h-4 mr-1" /> {appData.branding.address}</p>
          <p className="mb-4 flex items-center justify-center text-xs sm:text-sm"><Phone className="w-4 h-4 mr-1" /> {appData.branding.phone1} &nbsp;|&nbsp; {appData.branding.phone2}</p>
          <p className="text-xs text-gray-400">{appData.branding.copyright}</p>
        </footer>
      )}
    </div>
  );
}

export default function Main() { return <ErrorBoundary><App /></ErrorBoundary>; }

// ==========================================
// 1. CUSTOMER MAIN APP
// ==========================================
function CustomerApp({ appData }: { appData: AppData }) {
  const [activeTab, setActiveTab] = useState<'book' | 'therapists' | 'history' | 'profile'>(() => {
     return new URLSearchParams(window.location.search).get('view') === 'therapists' ? 'therapists' : 'book';
  });
  const [userPhone, setUserPhone] = useState(localStorage.getItem('shangrila_user_phone') || '');
  const [hasNoti, setHasNoti] = useState(false);
  const prevStatuses = useRef<Record<string, string>>({});
  const isFirstLoad = useRef(true);

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
    if (audioEl && audioEl.paused) {
      audioEl.play().then(() => { audioEl.pause(); audioEl.currentTime = 0; }).catch(() => {});
    }
  };

  const tabs = [
    { id: 'book', label: 'Book Now', icon: CalendarPlus },
    { id: 'therapists', label: 'View Therapists', icon: User },
    { id: 'history', label: 'My Bookings', icon: History },
    { id: 'profile', label: 'Profile', icon: UserCircle }
  ] as const;

  return (
    <div className="max-w-2xl mx-auto" onClick={handleInteraction}>
      <audio id="customer-alert-sound" src="https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3" preload="auto" />

      <div className="flex justify-center items-center space-x-1 md:space-x-2 mb-10 bg-white p-2 rounded-2xl shadow-sm border border-gray-100 overflow-x-auto">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id} onClick={() => setActiveTab(tab.id)}
              className={`relative flex-1 min-w-[80px] flex flex-col sm:flex-row items-center justify-center py-3 px-1 sm:px-2 rounded-xl text-[10px] sm:text-xs md:text-sm font-bold transition-all duration-300 ${isActive ? 'bg-gray-50 shadow-sm border border-gray-200' : 'text-gray-500 hover:bg-gray-50/50 hover:text-gray-700'}`}
              style={{ color: isActive ? THEME.primary : undefined }}
            >
              <tab.icon className={`w-4 h-4 sm:w-5 sm:h-5 mb-1 sm:mb-0 sm:mr-1.5 ${isActive ? 'text-[#D4AF37]' : 'text-gray-400'}`} />
              <span className="text-center">{tab.label}</span>
              {tab.id === 'history' && hasNoti && <span className="absolute top-1 right-2 sm:top-2 sm:right-4 w-2 h-2 sm:w-2.5 sm:h-2.5 bg-red-500 rounded-full shadow-md animate-ping"></span>}
              {tab.id === 'history' && hasNoti && <span className="absolute top-1 right-2 sm:top-2 sm:right-4 w-2 h-2 sm:w-2.5 sm:h-2.5 bg-red-500 rounded-full shadow-md"></span>}
            </button>
          )
        })}
      </div>

      {activeTab === 'book' && <CustomerBookingWizard appData={appData} userPhone={userPhone} onBooked={(phone) => { setUserPhone(phone); localStorage.setItem('shangrila_user_phone', phone); setActiveTab('history'); }} />}
      {activeTab === 'therapists' && <CustomerBookingWizard appData={appData} userPhone={userPhone} forceTherapistFirst={true} onBooked={(phone) => { setUserPhone(phone); localStorage.setItem('shangrila_user_phone', phone); setActiveTab('history'); }} />}
      {activeTab === 'history' && <CustomerHistory userPhone={userPhone} onLoginSuccess={(phone) => { setUserPhone(phone); localStorage.setItem('shangrila_user_phone', phone); }} />}
      {activeTab === 'profile' && <CustomerProfile userPhone={userPhone} onLoginSuccess={(phone) => { setUserPhone(phone); localStorage.setItem('shangrila_user_phone', phone); }} onLogout={() => { setUserPhone(''); localStorage.removeItem('shangrila_user_phone'); setActiveTab('book'); }} />}
    </div>
  );
}

// 1.1 Booking Wizard
function CustomerBookingWizard({ appData, userPhone, onBooked, forceTherapistFirst = false }: { appData: AppData, userPhone: string, onBooked: (phone: string) => void, forceTherapistFirst?: boolean }) {
  const isTherapistFirst = forceTherapistFirst || new URLSearchParams(window.location.search).get('view') === 'therapists';
  
  const [step, setStep] = useState(1);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [formData, setFormData] = useState({ name: '', phone: userPhone, selectedItem: null as MenuItem | null, isVvipUpgrade: false, therapist: null as TherapistProfile | null, date: '', time: '', paymentMethod: '', txId: '', specialRequest: '' });
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
      else if (serviceName.includes("night")) allowedSlots = ALL_TIME_SLOTS.slice(ALL_TIME_SLOTS.indexOf("7:00 PM"), ALL_TIME_SLOTS.indexOf("9:00 PM") + 1);
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

  const calculateTotal = () => {
    if (!formData.selectedItem) return 0;
    const basePrice = Number(formData.selectedItem.price) || 0;
    const vvipPrice = Number(formData.selectedItem.vvipPrice) || 0;
    return formData.isVvipUpgrade && vvipPrice > 0 ? vvipPrice : basePrice;
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
     alert("ငွေပေးချေရန် သတ်မှတ်ချိန် (၁၅) မိနစ် ကုန်ဆုံးသွားပါပြီ။ ကျေးဇူးပြု၍ ဘိုကင် အသစ်ပြန်လည်တင်ပေးပါ။");
     setStep(1); setFormData({ name: '', phone: userPhone, selectedItem: null, isVvipUpgrade: false, therapist: null, date: '', time: '', paymentMethod: '', txId: '', specialRequest: '' });
  };
  const formattedCountdown = useCountdown(15, handleCountdownExpire);

  // --- Dynamic Checking for Overlaps and Blocked Slots ---
  const getBlockedSlots = (bookings: Booking[], selectedTherapistName: string, selectedDate: string) => {
      let blocked = new Set<string>();
      if (!selectedTherapistName || selectedTherapistName === 'Any Available Therapist') return blocked; 
      
      bookings.forEach(b => {
          if (b.status === 'cancelled') return;
          if (b.date !== selectedDate) return;
          if (b.therapist !== selectedTherapistName) return;

          if (b.time.includes("to")) {
              const [start, endRaw] = b.time.split(" to ");
              const end = endRaw.replace(" (Next Day)", "");
              const sIdx = ALL_TIME_SLOTS.indexOf(start);
              let eIdx = ALL_TIME_SLOTS.indexOf(end);
              
              if (endRaw.includes("Next Day") || (eIdx !== -1 && eIdx <= sIdx)) {
                  eIdx = ALL_TIME_SLOTS.length; // Blocks till end of day slots
              }

              if (sIdx !== -1 && eIdx !== -1) {
                  for (let i = sIdx; i < eIdx; i++) blocked.add(ALL_TIME_SLOTS[i]);
              }
              blocked.add(b.time); 
          } else {
              const sIdx = ALL_TIME_SLOTS.indexOf(b.time);
              if (sIdx !== -1) {
                  let slotsToBlock = 2; // Default 60 mins
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
    if (formData.txId.length !== 6) { alert("Transaction ID နောက်ဆုံး ၆ လုံးကို မှန်ကန်စွာ ဖြည့်ပေးပါ။"); return; }
    setLoading(true);
    
    try {
      // Concurrency Overlap Check before inserting
      const freshSnap = await getDocs(query(collection(db, 'bookings')));
      const freshBookings: Booking[] = [];
      freshSnap.forEach(d => freshBookings.push({id: d.id, ...d.data()} as Booking));
      
      const blockedNow = getBlockedSlots(freshBookings, formData.therapist?.name || '', formData.date);
      let isOverlap = false;

      if (formData.time.includes("to")) {
          const [start, endRaw] = formData.time.split(" to ");
          const end = endRaw.replace(" (Next Day)", "");
          const sIdx = ALL_TIME_SLOTS.indexOf(start);
          let eIdx = ALL_TIME_SLOTS.indexOf(end);
          
          if (endRaw.includes("Next Day") || (eIdx !== -1 && eIdx <= sIdx)) {
              eIdx = ALL_TIME_SLOTS.length;
          }

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

      if (isOverlap) {
         alert("ဆောရီးပါ.. သင်ရွေးချယ်ထားသော အချိန်သည် အခြားသူ ဘိုကင်တင်သွားပါပြီ။ ကျေးဇူးပြု၍ အခြားအချိန် ရွေးပေးပါ။");
         setLoading(false); return;
      }

      // Auto Create/Update Profile
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
        name: formData.name, phone: formData.phone,
        service: `${formData.selectedItem?.name} ${formData.selectedItem?.duration ? `(${formData.selectedItem.duration})` : ''} ${formData.isVvipUpgrade ? '+ VVIP Upgrade' : ''} ${formData.selectedItem?.vvipIncluded ? '(VVIP Included)' : ''}`,
        therapist: formData.therapist?.name || 'Any Available Therapist',
        date: formData.date, time: formData.time, paymentMethod: formData.paymentMethod, txId: formData.txId, totalPrice: calculateTotal(), status: 'pending', createdAt: Date.now(),
        specialRequest: formData.specialRequest
      };
      await addDoc(collection(db, 'bookings'), dataToSave);
      setSuccessMsg('Booking အောင်မြင်စွာ တင်ပြီးပါပြီ။ Admin မှ မကြာမီ ပြန်လည်ဆက်သွယ် အတည်ပြုပေးပါမည်။');
    } catch (error) { console.error(error); alert("Booking တင်ရာတွင် အခက်အခဲရှိနေပါသည်။"); }
    setLoading(false);
  };

  if (successMsg) {
    return (
      <div className="bg-white p-10 rounded-2xl shadow-lg text-center border border-gray-100 max-w-lg mx-auto mt-10 animate-fade-in">
        <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6"><CheckCircle className="w-10 h-10 text-green-600" /></div>
        <h2 className="text-2xl font-bold mb-3" style={{ color: THEME.primary }}>Booking Confirmed!</h2>
        <p className="text-gray-600 mb-8 leading-relaxed font-semibold">{successMsg}</p>
        <button onClick={() => { setSuccessMsg(''); onBooked(formData.phone); }} className="px-8 py-3 font-bold rounded-lg transition text-white w-full shadow-md hover:opacity-90" style={{ backgroundColor: THEME.primary }}>မှတ်တမ်းကြည့်ရန် (View History)</button>
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
      <div onClick={() => setFormData({ ...formData, therapist: null })} className={`flex items-center p-4 mb-6 rounded-xl cursor-pointer border transition-all duration-200 ${!formData.therapist ? 'border-[#D4AF37] bg-yellow-50 shadow-sm' : 'border-gray-200 bg-white hover:border-[#D4AF37]'}`}><div className="w-12 h-12 bg-gray-200 rounded-full flex items-center justify-center mr-4"><User className="w-6 h-6 text-gray-500" /></div><div><div className="font-bold text-gray-800">Any Available Therapist</div><div className="text-xs text-gray-500 mt-1">We'll assign the best available therapist for you</div></div></div>

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
            <label className="block mb-4 text-sm font-bold flex items-center" style={{ color: THEME.primary }}><Clock className="w-4 h-4 mr-2" style={{ color: THEME.primary }} /> Available Times</label>
            <div className={`grid gap-3 ${availableTimeSlots.length <= 2 ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-3 sm:grid-cols-4'}`}>
              {availableTimeSlots.map(t => {
                const isAvailable = isSlotAvailable(t);
                return (
                 <button key={t} type="button" disabled={!formData.date || !isAvailable} onClick={() => setFormData({ ...formData, time: t })} className={`py-3 px-2 text-xs sm:text-sm font-bold rounded-lg border transition-all ${formData.time === t ? 'border-[#D4AF37] bg-yellow-50 text-yellow-700 shadow-sm' : !isAvailable ? 'border-gray-200 bg-gray-100 text-gray-400 opacity-40 cursor-not-allowed line-through' : 'border-gray-200 bg-white text-gray-600 hover:border-[#D4AF37]'}`}>{t}</button>
                )
              })}
            </div>
            {availableTimeSlots.length === 0 && formData.date && <p className="text-sm text-red-500 mt-2 text-center">ရွေးချယ်ထားသော ဝန်ဆောင်မှုအတွက် အချိန်ရွေးချယ်၍ မရနိုင်ပါ။</p>}
          </div>
          <div className="mt-8 flex justify-between"><button onClick={() => handleNextStep(2)} className="px-6 py-4 rounded-lg font-bold text-gray-600 bg-white border border-gray-300 hover:bg-gray-50 transition">BACK</button><button disabled={!formData.date || !formData.time} onClick={() => handleNextStep(4)} className="px-8 py-4 rounded-lg font-bold text-white transition disabled:opacity-50 shadow-md hover:opacity-90" style={{ backgroundColor: THEME.primary }}>CONTINUE</button></div>
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
              <div className="flex items-center text-sm font-bold text-gray-700"><Calendar className="w-4 h-4 mr-2" style={{ color: THEME.gold }} /> {formData.date} at {formData.time}</div>
            </div>
            <div className="mt-6 pt-4 border-t-2 border-gray-100 flex justify-between items-center"><span className="font-bold text-gray-800">Total Price</span><span className="text-xl font-bold" style={{ color: THEME.gold }}>{formatPrice(calculateTotal())}</span></div>
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
              <div><label className="block mb-1 text-sm font-semibold text-gray-700">Phone Number (Login ID အဖြစ်အသုံးပြုရန်)</label><input required type="tel" name="phone" value={formData.phone} onChange={handleChange} placeholder="e.g. 09-xxxxxxxxx" className="w-full p-3 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:border-[#D4AF37] text-gray-800" /></div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 mb-6">
            <h3 className="text-sm font-bold tracking-widest uppercase mb-4 flex items-center" style={{ color: THEME.primary }}><CreditCard className="w-4 h-4 mr-2" style={{ color: THEME.primary }} /> Deposit Payment</h3>
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
          </div>

          <div className="mt-8 flex justify-between"><button type="button" onClick={() => handleNextStep(3)} className="px-6 py-4 rounded-lg font-bold text-gray-600 bg-white border border-gray-300 hover:bg-gray-50 transition">BACK</button><button disabled={loading || !formData.paymentMethod} type="submit" className="px-8 py-4 rounded-lg font-bold text-white transition disabled:opacity-50 shadow-lg flex-1 ml-4 flex justify-center items-center hover:opacity-90" style={{ backgroundColor: THEME.primary }}>{loading ? 'PROCESSING...' : 'CONFIRM BOOKING'}</button></div>
        </form>
      )}
    </div>
  );
}

// 1.2 Customer History Tab
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
                           <div className="text-xs text-gray-500 mt-1 flex items-center"><Calendar className="w-3 h-3 mr-1"/> {b.date} &nbsp; <Clock className="w-3 h-3 mx-1"/> {b.time}</div>
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

// 1.3 Customer Profile Tab
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

const XCircleIcon = ({className}:any) => <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>;

function StatusBadge({ status, cancelReason }: { status: string, cancelReason?: string }) {
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
  const [tab, setTab] = useState<'bookings' | 'users' | 'admins' | 'settings'>('bookings');
  
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
      
      <div className="flex flex-wrap justify-center gap-2 mb-6">
        <button onClick={() => setTab('bookings')} className={`relative px-4 sm:px-6 py-3 rounded-lg font-bold text-xs sm:text-sm transition-all flex items-center ${tab === 'bookings' ? 'bg-[#123524] text-white shadow-md' : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'}`}>
          <Calendar className="w-4 h-4 mr-2" /> Bookings
          {pendingCount > 0 && (
             <span className="absolute -top-2 -right-2 bg-red-500 text-white text-[10px] w-5 h-5 flex items-center justify-center rounded-full shadow-md font-bold animate-pulse">
               {pendingCount}
             </span>
          )}
        </button>
        <button onClick={() => setTab('users')} className={`px-4 sm:px-6 py-3 rounded-lg font-bold text-xs sm:text-sm transition-all flex items-center ${tab === 'users' ? 'bg-[#123524] text-white shadow-md' : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'}`}><User className="w-4 h-4 mr-2" /> Users</button>
        <button onClick={() => setTab('admins')} className={`px-4 sm:px-6 py-3 rounded-lg font-bold text-xs sm:text-sm transition-all flex items-center ${tab === 'admins' ? 'bg-[#123524] text-white shadow-md' : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'}`}><ShieldCheck className="w-4 h-4 mr-2" /> Admins</button>
        <button onClick={() => setTab('settings')} className={`px-4 sm:px-6 py-3 rounded-lg font-bold text-xs sm:text-sm transition-all flex items-center ${tab === 'settings' ? 'bg-[#D4AF37] text-white shadow-md' : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'}`}><Settings className="w-4 h-4 mr-2" /> Settings</button>
      </div>
      {tab === 'bookings' && <AdminBookingsList bookings={bookings} />}
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
      const input = window.prompt("ဖျက်သိမ်းရသည့် အကြောင်းရင်းကို ထည့်ပါ (ဥပမာ - ငွေလွှဲမဝင်ပါ):");
      if (input === null) return;
      reason = input;
    } else {
      if (!window.confirm('Status ပြောင်းလဲမည်မှာ သေချာပါသလား?')) return;
    }
    try {
      await updateDoc(doc(db, 'bookings', id), { status: newStatus, cancelReason: reason });
    } catch (e) { alert("Error Update"); }
  };

  const handleDelete = async (id: string) => { if (window.confirm('ဤ Booking ကို အပြီးအပိုင်ဖျက်မည် သေချာပါသလား?')) { await deleteDoc(doc(db, 'bookings', id)); } };

  return (
    <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
      <div className="flex justify-between items-center mb-6 border-b border-gray-100 pb-4"><h2 className="text-xl font-bold flex items-center" style={{ color: THEME.primary }}><ShieldCheck className="mr-2 text-yellow-500" /> Booking Requests</h2><span className="bg-yellow-100 text-yellow-700 px-4 py-1 rounded-full text-sm font-bold border border-yellow-200">Total: {bookings.length}</span></div>
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead><tr className="border-b-2 border-gray-100 text-xs text-gray-500 uppercase tracking-wider"><th className="p-3 pb-4">Customer</th><th className="p-3 pb-4">Service & Therapist</th><th className="p-3 pb-4">Date & Time</th><th className="p-3 pb-4">TxID & Total</th><th className="p-3 pb-4">Status & Action</th><th className="p-3 pb-4 text-right">Delete</th></tr></thead>
          <tbody>
            {bookings.length === 0 && (<tr><td colSpan={6} className="p-10 text-center text-gray-400">Booking မရှိသေးပါ။</td></tr>)}
            {bookings.map((b) => (
              <tr key={b.id} className="border-b border-gray-50 hover:bg-gray-50 transition">
                <td className="p-3">
                  <div className="font-bold text-gray-800">{b.name || 'No Name'}</div>
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
                  <div className="font-mono font-bold text-gray-800">{b.txId || '-'}</div>
                  <div className="text-[10px] uppercase tracking-wider font-bold text-yellow-600 mt-1">{b.paymentMethod || 'Unknown'} • {formatPrice(b.totalPrice)}</div>
                </td>
                <td className="p-3">
                  <select value={b.status} onChange={(e) => handleStatusChange(b.id!, e.target.value)} className={`text-[10px] font-bold p-1.5 rounded outline-none border cursor-pointer ${b.status === 'approved' ? 'bg-green-50 text-green-700 border-green-200' : b.status === 'payment_checking' ? 'bg-blue-50 text-blue-700 border-blue-200' : b.status === 'cancelled' ? 'bg-red-50 text-red-700 border-red-200' : 'bg-yellow-50 text-yellow-700 border-yellow-200'}`}>
                    <option value="pending">Pending</option>
                    <option value="payment_checking">Payment Confirming</option>
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
      <div className="overflow-x-auto"><table className="w-full text-left border-collapse"><thead><tr className="border-b-2 border-gray-100 text-xs text-gray-500 uppercase tracking-wider"><th className="p-3 pb-4">Phone (Login ID)</th><th className="p-3 pb-4">Name</th><th className="p-3 pb-4">Security</th><th className="p-3 pb-4">Created Date</th><th className="p-3 pb-4 text-right">Action</th></tr></thead><tbody>{users.length === 0 && (<tr><td colSpan={5} className="p-10 text-center text-gray-400">User မရှိသေးပါ။</td></tr>)}{users.map((u, idx) => (<tr key={idx} className="border-b border-gray-50 hover:bg-gray-50 transition"><td className="p-3 font-mono font-bold tracking-wider text-[#123524]">{u.phone}</td><td className="p-3 font-bold text-gray-800">{u.name || '-'}</td><td className="p-3">{u.password ? <span className="text-[10px] bg-green-100 text-green-700 font-bold px-2 py-1 rounded flex w-fit items-center"><KeyRound className="w-3 h-3 mr-1" /> Password Set</span> : <span className="text-[10px] bg-gray-100 text-gray-500 font-bold px-2 py-1 rounded flex w-fit items-center"><AlertCircle className="w-3 h-3 mr-1" /> None</span>}</td><td className="p-3 text-xs font-bold text-gray-500">{u.createdAt ? new Date(u.createdAt).toLocaleDateString() : '-'}</td><td className="p-3 text-right"><button onClick={() => { setEditingUser(u); setEditForm({ name: u.name || '', password: u.password || '' }); }} className="p-1.5 bg-blue-50 text-blue-600 rounded hover:bg-blue-100 font-bold text-[10px] flex items-center ml-auto"><Edit className="w-3 h-3 mr-1"/> Edit</button></td></tr>))}</tbody></table></div>
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

      <div className="overflow-x-auto"><table className="w-full text-left border-collapse"><thead><tr className="border-b-2 border-gray-100 text-xs text-gray-500 uppercase tracking-wider"><th className="p-3 pb-4">Username</th><th className="p-3 pb-4">Password</th><th className="p-3 pb-4 text-right">Action</th></tr></thead><tbody>{admins.map((a, idx) => (<tr key={idx} className="border-b border-gray-50 hover:bg-gray-50 transition"><td className="p-3 font-bold text-gray-800 flex items-center"><User className="w-4 h-4 mr-2 text-gray-400"/> {a.username}</td><td className="p-3 font-mono text-sm text-gray-500 flex items-center"><Lock className="w-3 h-3 mr-1"/> {a.password}</td><td className="p-3 text-right"><button onClick={() => handleDeleteAdmin(a.username)} className="p-1.5 bg-red-50 text-red-600 rounded hover:bg-red-100 font-bold text-[10px] flex items-center ml-auto"><Trash2 className="w-3 h-3 mr-1"/> Delete</button></td></tr>))}</tbody></table></div>
    </div>
  );
}

// Admin Settings
function AdminSettings({ appData, onSettingsUpdated }: { appData: AppData, onSettingsUpdated: (data: AppData) => void }) {
  const [localTherapists, setLocalTherapists] = useState<TherapistProfile[]>(JSON.parse(JSON.stringify(appData.therapists || [])));
  const [localCategories, setLocalCategories] = useState<MenuCategory[]>(JSON.parse(JSON.stringify(appData.categories || [])));
  const [localBranding, setLocalBranding] = useState<AppBranding>(JSON.parse(JSON.stringify(appData.branding || DEFAULT_BRANDING)));
  const [localPaymentMethods, setLocalPaymentMethods] = useState<PaymentMethod[]>(JSON.parse(JSON.stringify(appData.paymentMethods || DEFAULT_PAYMENT_METHODS)));

  const [deletedTherapistIds, setDeletedTherapistIds] = useState<string[]>([]);
  const [savingCategory, setSavingCategory] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState<string | null>(null);

  const handleSaveCategory = async (cIdx: number) => {
    const cat = localCategories[cIdx];
    if (!window.confirm(`ဤပြောင်းလဲမှုများကို (${cat.title}) သိမ်းဆည်းမည်မှာ သေချာပါသလား?`)) return;
    setSavingCategory(cat.id);
    try {
      await setDoc(doc(db, 'settings', 'appData'), { categories: localCategories }, { merge: true });
      onSettingsUpdated({ ...appData, categories: localCategories });
      alert('အောင်မြင်စွာ သိမ်းဆည်းပြီးပါပြီ။');
    } catch (e) { alert('Update လုပ်ရာတွင် အခက်အခဲရှိနေပါသည်။'); }
    setSavingCategory(null);
  };

  const handleSaveTherapists = async () => {
    if (!window.confirm(`ဝန်ထမ်းစာရင်းကို သိမ်းဆည်းမည်မှာ သေချာပါသလား?`)) return;
    setSavingCategory('therapists');
    try {
      const tPromises = localTherapists.map((t, idx) => setDoc(doc(db, 'therapists', t.id), { name: t.name, images: t.images, order: idx }));
      const delPromises = deletedTherapistIds.map(id => deleteDoc(doc(db, 'therapists', id)));
      await Promise.all([...tPromises, ...delPromises]);
      setDeletedTherapistIds([]);
      onSettingsUpdated({ ...appData, therapists: localTherapists });
      alert('ဝန်ထမ်းစာရင်းကို အောင်မြင်စွာ သိမ်းဆည်းပြီးပါပြီ။');
    } catch (e) { alert('Update လုပ်ရာတွင် အခက်အခဲရှိနေပါသည်။'); }
    setSavingCategory(null);
  };

  const handleSaveBranding = async () => {
    if (!window.confirm(`Logo နှင့် Footer အချက်အလက်များကို သိမ်းဆည်းမည်မှာ သေချာပါသလား?`)) return;
    setSavingCategory('branding');
    try {
      await setDoc(doc(db, 'settings', 'appData'), { branding: localBranding }, { merge: true });
      onSettingsUpdated({ ...appData, branding: localBranding });
      alert('Logo နှင့် Footer ကို အောင်မြင်စွာ သိမ်းဆည်းပြီးပါပြီ။');
    } catch (e) { alert('Update လုပ်ရာတွင် အခက်အခဲရှိနေပါသည်။'); }
    setSavingCategory(null);
  };

  const handleSavePayments = async () => {
    if (!window.confirm(`Payment အချက်အလက်များကို သိမ်းဆည်းမည်မှာ သေချာပါသလား?`)) return;
    setSavingCategory('payments');
    try {
      await setDoc(doc(db, 'settings', 'appData'), { paymentMethods: localPaymentMethods }, { merge: true });
      onSettingsUpdated({ ...appData, paymentMethods: localPaymentMethods });
      alert('Payment အချက်အလက်များကို အောင်မြင်စွာ သိမ်းဆည်းပြီးပါပြီ။');
    } catch (e) { alert('Update လုပ်ရာတွင် အခက်အခဲရှိနေပါသည်။'); }
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

  const addTherapist = () => setLocalTherapists([...localTherapists, { id: `t_${Date.now()}`, name: 'New Therapist', images: [], order: localTherapists.length }]);
  const updateTherapistName = (tIdx: number, name: string) => { const updated = [...localTherapists]; updated[tIdx].name = name; setLocalTherapists(updated); };
  const removeTherapist = (tIdx: number) => {
    if (!window.confirm("ဤဝန်ထမ်းအား ဖျက်မည် သေချာပါသလား?")) return;
    const t = localTherapists[tIdx];
    if (t.id && !t.id.startsWith('new_')) setDeletedTherapistIds([...deletedTherapistIds, t.id]);
    const updated = [...localTherapists]; updated.splice(tIdx, 1); setLocalTherapists(updated);
  };

  const handleImageUpload = async (tIdx: number, files: FileList | null) => {
    if (!files || files.length === 0) return; const therapist = localTherapists[tIdx]; if (therapist.images.length + files.length > 5) { alert('အများဆုံး ၅ ပုံသာ ထည့်ခွင့်ရှိပါတယ်။'); return; }
    setUploadingImage(therapist.id); const newUrls: string[] = [];
    try {
      for (let i = 0; i < files.length; i++) {
        const base64 = await compressImage(files[i], 450, 600); // 3:4 Ratio
        newUrls.push(base64);
      }
      const updated = [...localTherapists];
      updated[tIdx].images = [...updated[tIdx].images, ...newUrls];
      setLocalTherapists(updated);
    } catch (err) { alert("ပုံတင်ရာတွင် အခက်အခဲရှိနေပါသည်။"); }
    setUploadingImage(null);
  };

  const removeImage = (tIdx: number, imgIdx: number) => { const updated = [...localTherapists]; updated[tIdx].images.splice(imgIdx, 1); setLocalTherapists(updated); };

  const updateItem = (cIdx: number, iIdx: number, field: string, val: any) => { const updated = [...localCategories]; (updated[cIdx].items[iIdx] as any)[field] = val; setLocalCategories(updated); };
  const addItem = (cIdx: number) => { const updated = [...localCategories]; updated[cIdx].items.push({ id: Date.now().toString(), name: 'New Service', price: 0, duration: '60 Mins', vvipIncluded: false }); setLocalCategories(updated); };
  const deleteItem = (cIdx: number, iIdx: number) => { if (!window.confirm("ဤ Service အား ဖျက်မည် သေချာပါသလား?")) return; const updated = [...localCategories]; updated[cIdx].items.splice(iIdx, 1); setLocalCategories(updated); };

  const updatePaymentMethod = (pIdx: number, field: string, val: string) => { const updated = [...localPaymentMethods]; (updated[pIdx] as any)[field] = val; setLocalPaymentMethods(updated); };
  const addPaymentMethod = () => { setLocalPaymentMethods([...localPaymentMethods, { id: `p_${Date.now()}`, name: 'New Payment', accountNumber: '', accountName: '', logoUrl: '' }]); };
  const removePaymentMethod = (pIdx: number) => { if (!window.confirm("ဤ Payment အား ဖျက်မည် သေချာပါသလား?")) return; const updated = [...localPaymentMethods]; updated.splice(pIdx, 1); setLocalPaymentMethods(updated); };

  return (
    <div className="space-y-6">

      <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
        <div className="flex justify-between items-center mb-6 pb-4 border-b border-gray-100">
          <div>
             <h3 className="text-xl font-bold text-gray-800 flex items-center">App Branding & Footer</h3>
             <button type="button" onClick={() => {
                const url = window.location.origin + window.location.pathname + '?view=therapists';
                navigator.clipboard.writeText(url);
                alert('Gallery Link Copied:\n' + url);
             }} className="mt-2 text-xs flex items-center text-blue-600 bg-blue-50 px-3 py-1.5 rounded border border-blue-200 hover:bg-blue-100 transition">
                <Copy className="w-3 h-3 mr-1"/> Copy Gallery Link for Customers
             </button>
          </div>
          <button disabled={savingCategory === 'branding'} onClick={handleSaveBranding} className="flex items-center bg-[#123524] text-white px-4 py-2 rounded-lg font-bold shadow-md hover:opacity-90">
            <Save className="w-4 h-4 mr-2" /> {savingCategory === 'branding' ? 'Saving...' : 'Save Branding'}
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
      </div>

      <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
        <div className="flex justify-between items-center mb-6 pb-4 border-b border-gray-100"><div><h3 className="text-xl font-bold text-gray-800 flex items-center"><CreditCard className="w-5 h-5 mr-2 text-[#D4AF37]" /> Manage Payment</h3></div><div className="flex space-x-2"><button onClick={addPaymentMethod} className="flex items-center text-sm bg-gray-100 border border-gray-300 px-4 py-2 rounded-lg hover:bg-gray-200 font-bold"><PlusCircle className="w-4 h-4 mr-1" /> Add Payment</button><button disabled={savingCategory === 'payments'} onClick={handleSavePayments} className="flex items-center bg-[#123524] text-white px-4 py-2 rounded-lg font-bold shadow-md hover:opacity-90"><Save className="w-4 h-4 mr-2" /> {savingCategory === 'payments' ? 'Saving...' : 'Save Payments'}</button></div></div>
        <div className="space-y-3">{localPaymentMethods.map((pm, pIdx) => (<div key={pm.id} className="grid grid-cols-1 lg:grid-cols-12 gap-3 items-center bg-gray-50 p-3 border border-gray-200 rounded-lg hover:border-gray-300 transition"><div className="lg:col-span-2 flex flex-col items-center justify-center border-r border-gray-200 pr-2"><div className="w-12 h-12 bg-white border border-gray-200 rounded mb-1 flex items-center justify-center overflow-hidden relative group">{pm.logoUrl ? (<><img src={pm.logoUrl} alt="Logo" className="w-full h-full object-contain p-1" /><button onClick={() => updatePaymentMethod(pIdx, 'logoUrl', '')} className="absolute inset-0 bg-black/50 text-white flex items-center justify-center opacity-0 group-hover:opacity-100"><X className="w-4 h-4" /></button></>) : (<div className="text-[8px] text-gray-400 text-center">{uploadingImage === `pay_${pIdx}` ? '...' : 'No Logo'}</div>)}</div><label className="text-[10px] text-[#D4AF37] font-bold cursor-pointer hover:underline">Upload Logo<input type="file" accept="image/*" className="hidden" onChange={(e) => handlePaymentLogoUpload(pIdx, e)} disabled={uploadingImage === `pay_${pIdx}`} /></label></div><div className="lg:col-span-3"><label className="text-[10px] font-bold text-gray-400 uppercase">Bank Name</label><input type="text" value={pm.name} onChange={(e) => updatePaymentMethod(pIdx, 'name', e.target.value)} className="w-full p-2 text-sm border border-gray-200 rounded focus:border-[#D4AF37] outline-none font-bold text-gray-700" /></div><div className="lg:col-span-3"><label className="text-[10px] font-bold text-gray-400 uppercase">Account No</label><input type="text" value={pm.accountNumber} onChange={(e) => updatePaymentMethod(pIdx, 'accountNumber', e.target.value)} className="w-full p-2 text-sm border border-gray-200 rounded focus:border-[#D4AF37] outline-none font-bold text-[#123524] tracking-wider" /></div><div className="lg:col-span-3"><label className="text-[10px] font-bold text-gray-400 uppercase">Account Name</label><input type="text" value={pm.accountName} onChange={(e) => updatePaymentMethod(pIdx, 'accountName', e.target.value)} className="w-full p-2 text-sm border border-gray-200 rounded focus:border-[#D4AF37] outline-none" /></div><div className="lg:col-span-1 flex justify-end pt-4 lg:pt-0"><button onClick={() => removePaymentMethod(pIdx)} className="p-2 text-red-500 hover:bg-red-50 hover:text-red-700 rounded-lg transition"><Trash2 className="w-5 h-5" /></button></div></div>))}</div>
      </div>

      <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
        <div className="flex justify-between items-center mb-6 pb-4 border-b border-gray-100"><div><h3 className="text-xl font-bold text-gray-800 flex items-center"><User className="w-5 h-5 mr-2 text-[#D4AF37]" /> Manage Therapists</h3></div><div className="flex space-x-2"><button onClick={addTherapist} className="flex items-center text-sm bg-gray-100 border border-gray-300 px-4 py-2 rounded-lg hover:bg-gray-200 font-bold"><PlusCircle className="w-4 h-4 mr-1" /> Add Therapist</button><button disabled={savingCategory === 'therapists'} onClick={handleSaveTherapists} className="flex items-center bg-[#123524] text-white px-4 py-2 rounded-lg font-bold shadow-md hover:opacity-90"><Save className="w-4 h-4 mr-2" /> {savingCategory === 'therapists' ? 'Saving...' : 'Save Therapists'}</button></div></div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">{localTherapists.map((therapist, tIdx) => (<div key={therapist.id} className="border border-gray-200 rounded-xl p-4 bg-gray-50 relative"><button onClick={() => removeTherapist(tIdx)} className="absolute top-2 right-2 p-1 bg-red-100 text-red-500 rounded hover:bg-red-200"><Trash2 className="w-4 h-4" /></button><label className="block text-xs font-bold text-gray-500 mb-1">Therapist Name</label><input type="text" value={therapist.name} onChange={(e) => updateTherapistName(tIdx, e.target.value)} className="w-full p-2 text-sm font-bold border border-gray-300 rounded mb-4 focus:outline-none focus:border-[#D4AF37]" /><label className="block text-xs font-bold text-gray-500 mb-2">Photos (Max 5)</label><div className="flex flex-wrap gap-2 mb-2">{therapist.images.map((imgUrl, imgIdx) => (<div key={imgIdx} className="w-16 aspect-[3/4] relative rounded overflow-hidden shadow-sm border border-gray-200"><img src={imgUrl} alt="upload" className="w-full h-full object-cover" /><button onClick={() => removeImage(tIdx, imgIdx)} className="absolute top-1 right-1 bg-black/50 text-white rounded-full p-0.5 hover:bg-red-500"><X className="w-3 h-3" /></button></div>))}{therapist.images.length < 5 && (<label className="w-16 aspect-[3/4] border-2 border-dashed border-gray-300 rounded flex flex-col items-center justify-center cursor-pointer hover:bg-gray-100 hover:border-gray-400 transition text-gray-400">{uploadingImage === therapist.id ? <div className="text-[10px] font-bold animate-pulse text-center">Wait...</div> : (<span className="text-[10px] font-bold">Upload</span>)}<input type="file" accept="image/*" multiple className="hidden" onChange={(e) => handleImageUpload(tIdx, e.target.files)} disabled={uploadingImage === therapist.id} /></label>)}</div></div>))}</div>
      </div>

      {localCategories.map((cat, cIdx) => (
        <div key={cat.id} className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="bg-gray-50 p-4 border-b border-gray-200 flex justify-between items-center"><h3 className="font-bold text-gray-800 flex items-center text-lg"><Activity className="w-5 h-5 mr-2 text-[#D4AF37]" /> {cat.title} Category</h3><div className="flex space-x-2"><button onClick={() => addItem(cIdx)} className="flex items-center text-sm bg-white border border-gray-300 px-4 py-2 rounded-lg hover:bg-gray-100 font-bold"><PlusCircle className="w-4 h-4 mr-1" /> Add Item</button><button disabled={savingCategory === cat.id} onClick={() => handleSaveCategory(cIdx)} className="flex items-center bg-[#D4AF37] text-white px-4 py-2 rounded-lg font-bold shadow-md hover:opacity-90"><Save className="w-4 h-4 mr-2" /> {savingCategory === cat.id ? 'Saving...' : `Save ${cat.title}`}</button></div></div>
          <div className="p-4 space-y-3">{cat.items.length === 0 && <p className="text-sm text-gray-400 text-center py-4">No items in this category.</p>}
            {cat.items.map((item, iIdx) => (<div key={item.id} className="grid grid-cols-1 lg:grid-cols-12 gap-2 items-center bg-white p-3 border border-gray-200 rounded-lg hover:border-gray-300 transition"><div className="lg:col-span-3"><label className="text-[10px] font-bold text-gray-400 uppercase">Service Name</label><input type="text" value={item.name} onChange={(e) => updateItem(cIdx, iIdx, 'name', e.target.value)} className="w-full p-2 text-sm border border-gray-200 rounded focus:border-[#D4AF37] outline-none font-bold text-gray-700" /></div><div className="lg:col-span-2"><label className="text-[10px] font-bold text-gray-400 uppercase">Duration/Info</label><input type="text" value={item.duration} onChange={(e) => updateItem(cIdx, iIdx, 'duration', e.target.value)} placeholder="60 Mins" className="w-full p-2 text-sm border border-gray-200 rounded focus:border-[#D4AF37] outline-none" /></div><div className="lg:col-span-2"><label className="text-[10px] font-bold text-gray-400 uppercase">Price (Ks)</label><input type="number" value={item.price || ''} onChange={(e) => updateItem(cIdx, iIdx, 'price', Number(e.target.value))} className="w-full p-2 text-sm border border-gray-200 rounded focus:border-[#D4AF37] outline-none font-bold text-[#123524]" /></div><div className="lg:col-span-2"><label className="text-[10px] font-bold text-gray-400 uppercase">VVIP Price (Ks)</label><input type="number" value={item.vvipPrice || ''} onChange={(e) => updateItem(cIdx, iIdx, 'vvipPrice', e.target.value === '' ? undefined : Number(e.target.value))} placeholder="Optional" className="w-full p-2 text-sm border border-gray-200 rounded focus:border-[#D4AF37] outline-none font-bold text-yellow-600" /></div><div className="lg:col-span-2 flex items-center px-2 pt-4"><label className="text-xs font-bold text-gray-600 flex items-center cursor-pointer bg-gray-50 px-2 py-1.5 rounded border border-gray-200 w-full"><input type="checkbox" checked={item.vvipIncluded || false} onChange={(e) => updateItem(cIdx, iIdx, 'vvipIncluded', e.target.checked)} className="mr-2" /> VVIP Free</label></div><div className="lg:col-span-1 flex justify-end pt-4 lg:pt-0"><button onClick={() => deleteItem(cIdx, iIdx)} className="p-2 text-red-500 hover:bg-red-50 hover:text-red-700 rounded-lg transition"><Trash2 className="w-5 h-5" /></button></div></div>))}
          </div>
        </div>
      ))}
    </div>
  );
}
