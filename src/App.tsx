import React, { useState, useEffect } from 'react';
import { collection, addDoc, getDocs, updateDoc, deleteDoc, doc, query, orderBy, getDoc, setDoc } from 'firebase/firestore';
import { db } from './firebase'; 
import { Calendar, Clock, CreditCard, CheckCircle, Trash2, User, Phone, ShieldCheck, Activity, Copy, ChevronRight, ChevronLeft, Check, Sparkles, Droplets, Scissors, Home, ChevronDown, ChevronUp, Crown, Save, PlusCircle, Settings, UploadCloud, X, ImageIcon, Image as ImageIconFeather, MapPin } from 'lucide-react';

// --- Types ---
interface MenuItem { id: string; name: string; price: number; duration: string; vvipPrice?: number; vvipIncluded?: boolean; }
interface MenuCategory { id: string; title: string; items: MenuItem[]; }
interface TherapistProfile { id: string; name: string; images: string[]; order: number; }
interface Booking { id?: string; name: string; phone: string; service: string; therapist: string; date: string; time: string; paymentMethod: string; txId: string; totalPrice: number; status: 'pending' | 'approved'; createdAt: number; }
interface AppBranding { logoUrl: string; address: string; phone1: string; phone2: string; copyright: string; }
interface PaymentMethod { id: string; name: string; accountNumber: string; accountName: string; logoUrl: string; }
interface AppData { therapists: TherapistProfile[]; categories: MenuCategory[]; branding: AppBranding; paymentMethods: PaymentMethod[]; }

// --- Theme & Icons Map ---
const THEME = { primary: '#123524', gold: '#D4AF37', textGray: '#4a5568' };
const ICON_MAP: Record<string, any> = { massage: Sparkles, scrub: Droplets, waxing: Scissors, hotel: Home };

// --- Default Initial Data ---
const DEFAULT_BRANDING: AppBranding = {
  logoUrl: '',
  address: "33th(B) St, Between 65th & 65th(A) Sts, Chan Aye Tharzan Township, Mandalay",
  phone1: "09-458884517",
  phone2: "09-770072190",
  copyright: "© 2026 The Shangri-La Men's Retreat. All rights reserved."
};
const DEFAULT_PAYMENT_METHODS: PaymentMethod[] = [
  { id: 'p1', name: 'KBZ PAY', accountNumber: '09458888510', accountName: 'Htet Naing Kyaw', logoUrl: '' },
  { id: 'p2', name: 'Wave PAY', accountNumber: '09458888510', accountName: 'Htet Naing Kyaw', logoUrl: '' },
  { id: 'p3', name: 'AYA PAY', accountNumber: '09458888510', accountName: 'Htet Naing Kyaw', logoUrl: '' },
  { id: 'p4', name: 'UAB PAY', accountNumber: '09458888510', accountName: 'Htet Naing Kyaw', logoUrl: '' },
];
const DEFAULT_THERAPISTS: TherapistProfile[] = Array.from({ length: 15 }, (_, i) => ({ id: `t_${i}`, name: `Therapist No-${i + 1}`, images: [], order: i }));
const DEFAULT_CATEGORIES: MenuCategory[] = [
  { id: 'massage', title: 'Massage', items: [
    { id: 'm1', name: 'Traditional Massage', price: 25000, vvipPrice: 35000, duration: '60 Mins' },
    { id: 'm2', name: 'Traditional Massage', price: 37000, vvipPrice: 52500, duration: '90 Mins' },
    { id: 'm3', name: 'Oil Massage', price: 25000, vvipPrice: 35000, duration: '60 Mins' },
    { id: 'm4', name: 'Oil Massage', price: 37000, vvipPrice: 52500, duration: '90 Mins' },
    { id: 'm5', name: 'Aromatherapy Massage', price: 30000, vvipPrice: 40000, duration: '60 Mins' },
    { id: 'm6', name: 'Aromatherapy Massage', price: 45000, vvipPrice: 60000, duration: '90 Mins' },
    { id: 'm7', name: 'Body Butter Lotion Massage', price: 35000, vvipPrice: 45000, duration: '60 Mins' },
    { id: 'm8', name: 'Body Butter Lotion Massage', price: 50000, vvipPrice: 67500, duration: '90 Mins' },
    { id: 'm9', name: 'Body to Body Massage', price: 55000, duration: '60 Mins', vvipIncluded: true },
    { id: 'm10', name: 'Body to Body Massage', price: 82000, duration: '90 Mins', vvipIncluded: true },
    { id: 'm11', name: 'Four Hands Massage', price: 70000, duration: '60 Mins', vvipIncluded: true },
    { id: 'm12', name: 'Four Hands Massage', price: 104000, duration: '90 Mins', vvipIncluded: true },
    { id: 'm13', name: 'Lotion Candle Massage', price: 55000, duration: '60 Mins', vvipIncluded: true },
    { id: 'm14', name: 'Lotion Candle Massage', price: 82000, duration: '90 Mins', vvipIncluded: true },
  ]},
  { id: 'scrub', title: 'Body Scrub', items: [
    { id: 's1', name: 'Body Scrub & Bath Only', price: 70000, duration: '60 Mins', vvipIncluded: true },
    { id: 's2', name: 'Body Scrub & Lotion Massage', price: 80000, duration: '120 Mins', vvipIncluded: true },
  ]},
  { id: 'waxing', title: 'Waxing', items: [
    { id: 'w1', name: 'Arm Wax', price: 20000, duration: '' }, { id: 'w2', name: 'Underarm Wax', price: 25000, duration: '' },
    { id: 'w3', name: 'Half Leg Wax', price: 30000, duration: '' }, { id: 'w4', name: 'Full Leg Wax', price: 45000, duration: '' },
    { id: 'w5', name: 'Bikini Wax', price: 35000, duration: '' }, { id: 'w6', name: 'Brazilian Wax', price: 50000, duration: '' },
  ]},
  { id: 'hotel', title: 'Hotel & Home Services', items: [
    { id: 'h1', name: 'Part Time Outcall Service', price: 70000, duration: '100 Mins' },
    { id: 'h2', name: 'Half Day Service', price: 100000, duration: '6:00 AM - 12:00 PM' },
    { id: 'h3', name: 'The Whole Night Service', price: 120000, duration: '8:00 PM - 8:00 AM' },
    { id: 'h4', name: 'The Whole Day Service', price: 180000, duration: '7:00 AM - 7:00 PM' },
  ]}
];

const TIME_SLOTS = ["9:00 AM", "9:30 AM", "10:00 AM", "10:30 AM", "11:00 AM", "11:30 AM", "12:00 PM", "12:30 PM", "1:00 PM", "1:30 PM", "2:00 PM", "2:30 PM", "3:00 PM", "3:30 PM", "4:00 PM", "4:30 PM", "5:00 PM", "5:30 PM", "6:00 PM", "6:30 PM", "7:00 PM", "7:30 PM", "8:00 PM"];

const formatPrice = (price: any) => {
  if (price === undefined || price === null) return '0 Ks';
  if (typeof price === 'number') return price.toLocaleString() + ' Ks';
  return String(price); 
};

// Base64 Image Compressor Helper
const compressImage = async (file: File, width: number, height: number): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let sW = img.width; let sH = img.height; let sX = 0; let sY = 0;
        const targetRatio = width / height; const imageRatio = sW / sH;
        if (imageRatio > targetRatio) { const nW = sH * targetRatio; sX = (sW - nW) / 2; sW = nW; } 
        else { const nH = sW / targetRatio; sY = (sH - nH) / 2; sH = nH; }
        canvas.width = width; canvas.height = height; 
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, sX, sY, sW, sH, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', 0.7));
      };
      img.onerror = (e) => reject(e);
    };
    reader.onerror = (e) => reject(e);
  });
};

export default function App() {
  const [isAdminMode, setIsAdminMode] = useState(false);
  const [appData, setAppData] = useState<AppData | null>(null);

  // --- Dynamic Tab Title & Favicon Setup ---
  useEffect(() => {
    document.title = "The Shangri-La | Men's Retreat";
    const updateFavicon = (url: string) => {
      const existingIcons = document.querySelectorAll("link[rel*='icon']");
      existingIcons.forEach(icon => document.head.removeChild(icon));
      const newIcon = document.createElement('link');
      newIcon.rel = 'shortcut icon';
      newIcon.type = 'image/png';
      newIcon.href = url;
      document.head.appendChild(newIcon);
    };
    const iconUrl = appData?.branding?.logoUrl || "https://upload.wikimedia.org/wikipedia/commons/4/41/Shangri-La_Hotels_and_Resorts_logo.svg";
    updateFavicon(iconUrl);
  }, [appData?.branding?.logoUrl]);

  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search);
    if (searchParams.get('mode') === 'admin') setIsAdminMode(true);

    const fetchSettings = async () => {
      try {
        const docRef = doc(db, 'settings', 'appData');
        const snap = await getDoc(docRef);
        let loadedCategories = DEFAULT_CATEGORIES;
        let loadedBranding = DEFAULT_BRANDING;
        let loadedPaymentMethods = DEFAULT_PAYMENT_METHODS;

        if (snap.exists()) {
          const data = snap.data();
          if (data.categories) loadedCategories = data.categories;
          if (data.branding) loadedBranding = { ...DEFAULT_BRANDING, ...data.branding };
          if (data.paymentMethods) loadedPaymentMethods = data.paymentMethods;
        } else {
          await setDoc(docRef, { categories: DEFAULT_CATEGORIES, branding: DEFAULT_BRANDING, paymentMethods: DEFAULT_PAYMENT_METHODS }, { merge: true });
        }

        const tQuery = query(collection(db, 'therapists'), orderBy('order', 'asc'));
        const tSnap = await getDocs(tQuery);
        let loadedTherapists: TherapistProfile[] = [];
        
        if (!tSnap.empty) {
          tSnap.forEach(d => loadedTherapists.push({ id: d.id, ...d.data() } as TherapistProfile));
        } else {
          const batchPromises = DEFAULT_THERAPISTS.map((t) => setDoc(doc(db, 'therapists', t.id), { name: t.name, images: t.images, order: t.order }));
          await Promise.all(batchPromises);
          loadedTherapists = DEFAULT_THERAPISTS;
        }

        setAppData({ categories: loadedCategories, therapists: loadedTherapists, branding: loadedBranding, paymentMethods: loadedPaymentMethods });
      } catch (err) {
        console.error("Error loading settings:", err);
      }
    };
    fetchSettings();
  }, []);

  if (!appData) {
    return <div className="min-h-screen bg-gray-50 flex items-center justify-center font-bold" style={{ color: THEME.primary }}>Loading System Data...</div>;
  }

  return (
    <div className="min-h-screen bg-gray-50 text-gray-800 font-sans flex flex-col">
      <header className="bg-white shadow-sm py-6 px-4 text-center border-b border-gray-200 flex flex-col items-center justify-center">
        <div className="flex items-center justify-center mb-1">
          {appData.branding.logoUrl && (
            <div className="w-12 h-12 rounded-full overflow-hidden mr-3 border-2 shadow-sm flex-shrink-0" style={{ borderColor: THEME.gold }}>
              <img src={appData.branding.logoUrl} alt="Logo" className="w-full h-full object-cover bg-white" />
            </div>
          )}
          <h1 className="text-2xl font-bold tracking-wider" style={{ color: THEME.primary }}>The Shangri-La</h1>
        </div>
        <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: THEME.gold }}>Men's Retreat (Beyond Relaxation)</p>
      </header>
      
      <main className="flex-1 w-full max-w-4xl mx-auto p-4 py-8">
        {isAdminMode ? <AdminDashboard appData={appData} onSettingsUpdated={setAppData} /> : <CustomerBooking appData={appData} />}
      </main>

      {!isAdminMode && (
        <footer className="bg-white border-t border-gray-200 mt-10 py-8 text-center text-sm text-gray-500">
          <h3 className="font-bold text-base mb-2" style={{ color: THEME.primary }}>The Shangri-La Men's Retreat</h3>
          <p className="mb-2 flex items-center justify-center"><MapPin className="w-4 h-4 mr-1"/> {appData.branding.address}</p>
          <p className="mb-4 flex items-center justify-center"><Phone className="w-4 h-4 mr-1"/> {appData.branding.phone1} &nbsp;|&nbsp; {appData.branding.phone2}</p>
          <p className="text-xs text-gray-400">{appData.branding.copyright}</p>
        </footer>
      )}
    </div>
  );
}

// ==========================================
// 1. CUSTOMER BOOKING SYSTEM
// ==========================================
function CustomerBooking({ appData }: { appData: AppData }) {
  const [step, setStep] = useState(1);
  const [activeCategory, setActiveCategory] = useState<string | null>(null); 
  const [formData, setFormData] = useState({ name: '', phone: '', selectedItem: null as MenuItem | null, isVvipUpgrade: false, therapist: null as TherapistProfile | null, date: '', time: '', paymentMethod: '', txId: '' });
  const [loading, setLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [copiedText, setCopiedText] = useState('');
  
  // Custom Payment Dropdown State
  const [paymentDropdownOpen, setPaymentDropdownOpen] = useState(false);
  const selectedPaymentConfig = appData.paymentMethods.find(p => p.name === formData.paymentMethod);

  // Gallery Modal State
  const [viewGallery, setViewGallery] = useState<{ images: string[], index: number } | null>(null);

  const today = new Date(); const maxD = new Date(); maxD.setDate(maxD.getDate() + 3);
  const minDateStr = today.toISOString().split('T')[0];
  const maxDateStr = maxD.toISOString().split('T')[0];

  const handleCopy = (text: string) => { navigator.clipboard.writeText(text); setCopiedText(text); setTimeout(() => setCopiedText(''), 2000); };
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setFormData({ ...formData, [e.target.name]: e.target.value });
  const calculateTotal = () => { if (!formData.selectedItem) return 0; return formData.isVvipUpgrade && formData.selectedItem.vvipPrice ? formData.selectedItem.vvipPrice : formData.selectedItem.price; };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.txId.length !== 6) { alert("Transaction ID နောက်ဆုံး ၆ လုံးကို မှန်ကန်စွာ ဖြည့်ပေးပါ။"); return; }
    setLoading(true);
    try {
      const dataToSave = { 
        name: formData.name, phone: formData.phone, 
        service: `${formData.selectedItem?.name} ${formData.selectedItem?.duration ? `(${formData.selectedItem.duration})` : ''} ${formData.isVvipUpgrade ? '+ VVIP Upgrade' : ''} ${formData.selectedItem?.vvipIncluded ? '(VVIP Included)' : ''}`, 
        therapist: formData.therapist?.name || 'Any Available Therapist', 
        date: formData.date, time: formData.time, paymentMethod: formData.paymentMethod, txId: formData.txId, totalPrice: calculateTotal(), status: 'pending', createdAt: Date.now() 
      };
      await addDoc(collection(db, 'bookings'), dataToSave);
      setSuccessMsg('Booking အောင်မြင်စွာ တင်ပြီးပါပြီ။ ငွေလွှဲမှတ်တမ်းကို စစ်ဆေးပြီး Admin မှ မကြာမီ အတည်ပြုပေးပါမည်။');
      setStep(1); setFormData({ name: '', phone: '', selectedItem: null, isVvipUpgrade: false, therapist: null, date: '', time: '', paymentMethod: '', txId: '' }); setActiveCategory(null);
    } catch (error) { console.error("Error adding document: ", error); alert("Booking တင်ရာတွင် အခက်အခဲရှိနေပါသည်။"); }
    setLoading(false);
  };

  const renderStepper = () => {
    const steps = [ { num: 1, label: 'SERVICE', icon: Sparkles }, { num: 2, label: 'THERAPIST', icon: User }, { num: 3, label: 'DATE & TIME', icon: Calendar }, { num: 4, label: 'CONFIRM', icon: CreditCard } ];
    return (
      <div className="flex items-center justify-center mb-10 w-full max-w-lg mx-auto">
        {steps.map((s, idx) => {
          const isCompleted = step > s.num;
          const isActive = step === s.num;
          return (
            <React.Fragment key={s.num}>
              <div className="flex flex-col items-center relative z-10">
                <div className={`w-12 h-12 rounded-full flex items-center justify-center transition-all duration-300 border-2 ${
                  isCompleted ? 'bg-[#D4AF37] border-[#D4AF37] text-white' : isActive ? 'bg-[#123524] border-[#123524] text-white' : 'bg-white border-gray-200 text-gray-400'
                }`}>
                  {isCompleted ? <Check className="w-6 h-6" /> : <s.icon className="w-5 h-5" />}
                </div>
                <span className={`text-[10px] uppercase tracking-wider font-bold mt-2 absolute -bottom-5 w-24 text-center ${isActive ? 'text-[#123524]' : 'text-gray-400'}`}>{s.label}</span>
              </div>
              {idx < steps.length - 1 && <div className={`flex-1 h-[2px] mx-1 transition-colors duration-300 ${isCompleted ? 'bg-[#D4AF37]' : 'bg-gray-200'}`} />}
            </React.Fragment>
          );
        })}
      </div>
    );
  };

  return (
    <div className="max-w-2xl mx-auto">
      {renderStepper()}
      
      {/* STEP 1: SERVICE */}
      {step === 1 && (
        <div className="animate-fade-in">
          <div className="text-center mb-8">
            <h2 className="text-2xl font-bold" style={{ color: THEME.primary }}>Choose Your Service</h2>
            <p className="text-sm font-bold mt-2" style={{ color: THEME.gold }}>(သင်ရယူလိုသော ဝန်ဆောင်မှုအမျိုးအစားကို အရင်ရွေးချယ်ပါ)</p>
          </div>
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
                  <div key={s.id} onClick={() => setFormData({...formData, selectedItem: s, isVvipUpgrade: false})} className={`flex justify-between items-center p-4 my-2 mx-2 rounded-lg cursor-pointer border transition-all duration-200 ${formData.selectedItem?.id === s.id ? 'border-yellow-500 bg-yellow-50 shadow-sm' : 'border-gray-200 bg-white hover:border-yellow-400'}`}>
                    <div><div className="font-bold text-gray-800 text-sm">{s.name}</div>{s.duration && <div className="text-xs text-gray-500 mt-1">{s.duration}</div>}</div>
                    <div className="font-bold text-sm" style={{ color: THEME.primary }}>{formatPrice(s.price)}</div>
                  </div>
                ))}</div>
              )}
            </div>
          )})}</div>
          <div className="bg-yellow-50 rounded-xl p-4 border border-yellow-200 mt-6 flex justify-between items-center shadow-sm">
            <div className="flex items-center"><div className="w-10 h-10 bg-yellow-100 rounded-lg flex items-center justify-center mr-4"><Crown className="w-5 h-5" style={{ color: THEME.gold }} /></div><div><div className="font-bold text-yellow-800 text-sm">VVIP Master Room</div><div className="text-xs text-yellow-600 font-semibold mt-1">{formData.selectedItem?.vvipIncluded ? '✅ Included (Free)' : (!formData.selectedItem ? 'Select a service' : (formData.selectedItem.vvipPrice ? 'Upgrade for extra comfort' : 'Not available'))}</div></div></div>
            {formData.selectedItem?.vvipIncluded ? <span className="bg-green-100 text-green-700 px-3 py-1 rounded-full text-xs font-bold border border-green-200">INCLUDED</span> : <button type="button" disabled={!formData.selectedItem?.vvipPrice} onClick={() => setFormData({...formData, isVvipUpgrade: !formData.isVvipUpgrade})} className={`w-12 h-6 rounded-full p-1 transition-colors duration-300 ${formData.isVvipUpgrade ? 'bg-green-600' : 'bg-gray-300'} ${!formData.selectedItem?.vvipPrice ? 'opacity-50' : ''}`}><div className={`w-4 h-4 bg-white rounded-full shadow-md transform transition-transform ${formData.isVvipUpgrade ? 'translate-x-6' : 'translate-x-0'}`} /></button>}
          </div>
          <div className="mt-8 flex justify-end"><button disabled={!formData.selectedItem} onClick={() => setStep(2)} className="px-8 py-4 rounded-lg font-bold text-white transition disabled:opacity-50 shadow-md hover:opacity-90 flex items-center" style={{ backgroundColor: THEME.primary }}>CONTINUE TO THERAPIST <ChevronRight className="w-5 h-5 ml-2" /></button></div>
        </div>
      )}

      {/* STEP 2: THERAPIST */}
      {step === 2 && (
        <div className="animate-fade-in relative">
          {viewGallery && (
            <div className="fixed inset-0 z-50 bg-black/95 flex flex-col items-center justify-center p-2 backdrop-blur-sm animate-fade-in">
              <button onClick={() => setViewGallery(null)} className="absolute top-4 right-4 z-50 text-white p-2 hover:text-[#D4AF37] transition bg-black/50 rounded-full">
                <X className="w-8 h-8" />
              </button>
              
              <div className="relative w-full h-[85vh] flex items-center justify-center">
                <img src={viewGallery.images[viewGallery.index]} alt="Therapist Detail" className="w-full h-full object-contain rounded-md drop-shadow-2xl" />
                {viewGallery.images.length > 1 && (
                  <>
                    <button onClick={(e) => { e.stopPropagation(); setViewGallery({ ...viewGallery, index: (viewGallery.index - 1 + viewGallery.images.length) % viewGallery.images.length }) }} className="absolute left-2 top-1/2 -translate-y-1/2 bg-white/10 hover:bg-white/30 text-white p-3 rounded-full transition backdrop-blur-md">
                      <ChevronLeft className="w-8 h-8" />
                    </button>
                    <button onClick={(e) => { e.stopPropagation(); setViewGallery({ ...viewGallery, index: (viewGallery.index + 1) % viewGallery.images.length }) }} className="absolute right-2 top-1/2 -translate-y-1/2 bg-white/10 hover:bg-white/30 text-white p-3 rounded-full transition backdrop-blur-md">
                      <ChevronRight className="w-8 h-8" />
                    </button>
                  </>
                )}
              </div>
              <div className="text-white mt-4 font-bold tracking-widest text-sm bg-black/50 px-4 py-1.5 rounded-full">{viewGallery.index + 1} / {viewGallery.images.length}</div>
            </div>
          )}

          <div className="text-center mb-8">
            <h2 className="text-2xl font-bold" style={{ color: THEME.primary }}>Select Your Therapist</h2>
            <p className="text-sm font-bold mt-2" style={{ color: THEME.gold }}>(ဘိုကင်ယူထားလိုသော ဝန်ထမ်းနံပါတ်ကို ရွေးချယ်ပါ)</p>
          </div>
          <div onClick={() => setFormData({...formData, therapist: null})} className={`flex items-center p-4 mb-6 rounded-xl cursor-pointer border transition-all duration-200 ${!formData.therapist ? 'border-[#D4AF37] bg-yellow-50 shadow-sm' : 'border-gray-200 bg-white hover:border-[#D4AF37]'}`}><div className="w-12 h-12 bg-gray-200 rounded-full flex items-center justify-center mr-4"><User className="w-6 h-6 text-gray-500" /></div><div><div className="font-bold text-gray-800">Any Available Therapist</div><div className="text-xs text-gray-500 mt-1">We'll assign the best available therapist for you</div></div></div>
          
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            {appData.therapists.map((therapist) => { 
              const isSelected = formData.therapist?.id === therapist.id;
              const hasImage = therapist.images && therapist.images.length > 0;
              return (
                <div key={therapist.id} onClick={() => setFormData({...formData, therapist: therapist})} className={`flex flex-col items-center p-3 rounded-xl cursor-pointer transition-all border-2 ${isSelected ? 'border-[#D4AF37] bg-yellow-50 shadow-lg transform scale-105' : 'border-transparent bg-white hover:border-[#D4AF37]/50 hover:shadow-md'}`}>
                  <div className={`w-full aspect-[3/4] rounded-lg overflow-hidden mb-3 bg-gray-100 flex items-center justify-center shadow-inner relative border-2 transition-colors ${isSelected ? 'border-[#D4AF37]' : 'border-[#123524]'}`}>
                    {hasImage ? (
                      <>
                        <img src={therapist.images[0]} alt={therapist.name} className="w-full h-full object-cover" />
                        {therapist.images.length > 1 && (
                          <button onClick={(e) => { e.stopPropagation(); setViewGallery({ images: therapist.images, index: 0 }); }} className="absolute bottom-2 inset-x-2 bg-[#123524]/80 hover:bg-[#123524] text-[#D4AF37] text-[10px] font-bold py-1.5 rounded flex items-center justify-center backdrop-blur-sm border border-[#D4AF37]/50 transition">
                            <ImageIcon className="w-3 h-3 mr-1" /> See {therapist.images.length} photos
                          </button>
                        )}
                      </>
                    ) : (<div className="flex flex-col items-center opacity-40"><User className="w-12 h-12 text-[#123524]" /></div>)}
                  </div>
                  <div className="font-bold text-sm text-gray-800 text-center w-full truncate px-1">{therapist.name}</div>
                  <div className="text-[10px] text-gray-400 mt-1 text-center">Professional Therapist</div>
                </div>
              ) 
            })}
          </div>
          <div className="mt-8 flex justify-between"><button onClick={() => setStep(1)} className="px-6 py-4 rounded-lg font-bold text-gray-600 bg-white border border-gray-300 hover:bg-gray-50 transition">BACK</button><button disabled={formData.therapist === undefined} onClick={() => setStep(3)} className="px-8 py-4 rounded-lg font-bold text-white transition disabled:opacity-50 shadow-md hover:opacity-90" style={{ backgroundColor: THEME.primary }}>CONTINUE</button></div>
        </div>
      )}

      {/* STEP 3 & 4 */}
      {step === 3 && (
        <div className="animate-fade-in">
          <div className="text-center mb-8"><h2 className="text-2xl font-bold" style={{ color: THEME.primary }}>Pick Date & Time</h2><p className="text-sm font-bold mt-2" style={{ color: THEME.gold }}>(ဘိုကင်ရယူလိုသော နေ့ရက် နှင့် အချိန် ကို ရွေးချယ် ပါ)</p></div>
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 mb-6"><label className="block mb-2 text-sm font-bold flex items-center" style={{ color: THEME.primary }}><Calendar className="w-4 h-4 mr-2" style={{ color: THEME.primary }}/> Select Date</label><input type="date" min={minDateStr} max={maxDateStr} value={formData.date} onChange={(e) => setFormData({...formData, date: e.target.value, time: ''})} className="w-full p-4 border border-gray-200 rounded-lg focus:outline-none focus:border-yellow-500 text-gray-800 bg-gray-50 mb-6" /><label className="block mb-4 text-sm font-bold flex items-center" style={{ color: THEME.primary }}><Clock className="w-4 h-4 mr-2" style={{ color: THEME.primary }}/> Available Times</label><div className="grid grid-cols-3 sm:grid-cols-4 gap-3">{TIME_SLOTS.map(t => (<button key={t} type="button" disabled={!formData.date} onClick={() => setFormData({...formData, time: t})} className={`py-3 px-2 text-xs sm:text-sm font-bold rounded-lg border transition-all ${formData.time === t ? 'border-yellow-500 bg-yellow-50 text-yellow-700 shadow-sm' : 'border-gray-200 bg-white text-gray-600 hover:border-yellow-400 disabled:opacity-40 disabled:hover:border-gray-200 disabled:cursor-not-allowed'}`}>{t}</button>))}</div></div>
          <div className="mt-8 flex justify-between"><button onClick={() => setStep(2)} className="px-6 py-4 rounded-lg font-bold text-gray-600 bg-white border border-gray-300 hover:bg-gray-50 transition">BACK</button><button disabled={!formData.date || !formData.time} onClick={() => setStep(4)} className="px-8 py-4 rounded-lg font-bold text-white transition disabled:opacity-50 shadow-md hover:opacity-90" style={{ backgroundColor: THEME.primary }}>CONTINUE</button></div>
        </div>
      )}

      {step === 4 && (
        <form onSubmit={handleSubmit} className="animate-fade-in pb-10">
          <div className="text-center mb-8"><h2 className="text-2xl font-bold" style={{ color: THEME.primary }}>Confirm Booking</h2><p className="text-sm font-bold mt-2" style={{ color: THEME.gold }}>(သင်ရွေးချယ်ခဲ့သော ဘိုကင်မှတ်တမ်းအား ပြန်လည်စစ်ဆေးပြီး စရံငွေကြိုတင်ပေးချေကာ ဘိုကင်ကို အတည်ပြုပေးပါ)</p></div>
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 mb-6"><h3 className="text-xs font-bold tracking-widest uppercase mb-5" style={{ color: THEME.gold }}>Booking Summary</h3><div className="space-y-4"><div className="flex justify-between items-start"><div><div className="font-bold text-gray-800 flex items-center"><Activity className="w-4 h-4 mr-2 text-yellow-600"/>{formData.selectedItem?.name}</div><div className="text-sm text-gray-500 ml-6">{formData.selectedItem?.duration}</div></div><div className="font-bold text-gray-800 text-sm">{formatPrice(formData.selectedItem?.price || 0)}</div></div>{formData.isVvipUpgrade && formData.selectedItem?.vvipPrice && (<div className="flex justify-between items-start pt-2 border-t border-gray-50"><div className="font-bold flex items-center text-sm" style={{ color: THEME.gold }}><Crown className="w-4 h-4 mr-2" style={{ color: THEME.gold }}/>VVIP Room Extra Fee</div><div className="font-bold text-sm" style={{ color: THEME.gold }}>+{formatPrice(formData.selectedItem.vvipPrice - formData.selectedItem.price)}</div></div>)}{formData.selectedItem?.vvipIncluded && (<div className="flex justify-between items-start pt-2 border-t border-gray-50"><div className="font-bold text-green-600 flex items-center text-sm"><Crown className="w-4 h-4 mr-2 text-green-500"/>VVIP Master Room</div><div className="font-bold text-green-600 text-sm bg-green-50 px-2 py-0.5 rounded">Included (Free)</div></div>)}<div className="flex items-center text-sm font-bold text-gray-700 pt-2 border-t border-gray-50"><User className="w-4 h-4 mr-2" style={{ color: THEME.gold }}/> {formData.therapist ? formData.therapist.name : 'Any Available Therapist'}</div><div className="flex items-center text-sm font-bold text-gray-700"><Calendar className="w-4 h-4 mr-2" style={{ color: THEME.gold }}/> {formData.date} at {formData.time}</div></div><div className="mt-6 pt-4 border-t-2 border-gray-100 flex justify-between items-center"><span className="font-bold text-gray-800">Total Price</span><span className="text-xl font-bold" style={{ color: THEME.gold }}>{formatPrice(calculateTotal())}</span></div></div>
          
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 mb-6"><h3 className="text-xs font-bold tracking-widest uppercase mb-4" style={{ color: THEME.gold }}>Your Information</h3><div className="space-y-4"><div><label className="block mb-1 text-sm font-semibold text-gray-700">Full Name</label><input required type="text" name="name" value={formData.name} onChange={handleChange} placeholder="e.g. Aung Aung" className="w-full p-3 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:border-yellow-500 text-gray-800" /></div><div><label className="block mb-1 text-sm font-semibold text-gray-700">Phone Number</label><input required type="tel" name="phone" value={formData.phone} onChange={handleChange} placeholder="e.g. 09-xxxxxxxxx" className="w-full p-3 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:border-yellow-500 text-gray-800" /></div></div></div>
          
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 mb-6"><h3 className="text-xs font-bold tracking-widest uppercase mb-4 flex items-center" style={{ color: THEME.primary }}><CreditCard className="w-4 h-4 mr-2" style={{ color: THEME.primary }}/> Deposit Payment</h3>
            
            {/* Custom Payment Dropdown */}
            <div className="relative mb-4">
              <label className="block mb-2 text-sm font-semibold text-gray-700">ငွေလွှဲမည့် စနစ် ရွေးချယ်ရန်</label>
              <div 
                className="w-full p-3 bg-[#123524] rounded-lg cursor-pointer flex justify-between items-center shadow-sm"
                onClick={() => setPaymentDropdownOpen(!paymentDropdownOpen)}
              >
                {selectedPaymentConfig ? (
                  <div className="flex items-center font-bold text-[#D4AF37]">
                    {selectedPaymentConfig.logoUrl && <img src={selectedPaymentConfig.logoUrl} alt="" className="w-6 h-6 mr-3 object-contain bg-white rounded-sm p-0.5" />}
                    {selectedPaymentConfig.name}
                  </div>
                ) : (
                  <span className="font-bold text-[#D4AF37]">-- ရွေးချယ်ပါ --</span>
                )}
                <ChevronDown className="w-5 h-5 text-[#D4AF37]" />
              </div>

              {paymentDropdownOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setPaymentDropdownOpen(false)}></div>
                  <div className="absolute z-50 w-full mt-2 bg-[#123524] rounded-lg shadow-xl overflow-hidden border border-[#1a4a32]">
                    {appData.paymentMethods.map(pm => (
                      <div 
                        key={pm.id} 
                        className="p-4 flex items-center cursor-pointer hover:bg-[#1a4a32] border-b border-[#1a4a32] last:border-b-0 transition-colors"
                        onClick={() => {
                          setFormData({ ...formData, paymentMethod: pm.name });
                          setPaymentDropdownOpen(false);
                        }}
                      >
                        {pm.logoUrl && <img src={pm.logoUrl} alt="" className="w-7 h-7 mr-3 object-contain bg-white rounded-sm p-1" />}
                        <span className="font-bold text-[#D4AF37] text-base">{pm.name}</span>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>

            {selectedPaymentConfig && (
              <div className="bg-yellow-50 p-5 rounded-lg mb-5 border border-yellow-200 animate-fade-in">
                <p className="text-sm text-gray-700 mb-4 leading-relaxed">Booking အတည်ပြုနိုင်ရန် အတွက် <strong className="text-yellow-700 font-bold">ကျသင့်ငွေ၏ တစ်ဝက်တိတိကို ({formatPrice(calculateTotal()/2)})</strong> စရံငွေ အဖြစ် အောက်ပါ {selectedPaymentConfig.name} အကောင့်သို့ ကြိုလွှဲပေးပါရန် မေတ္တာရပ်ခံအပ်ပါသည်။</p>
                <div className="flex flex-col space-y-3 bg-white p-4 rounded-md border border-yellow-100">
                  <div className="flex items-center justify-between sm:justify-start">
                    <span className="text-gray-500 text-sm w-16 inline-block">အကောင့်:</span> 
                    <strong className="tracking-widest text-gray-800 text-lg sm:mr-4">{selectedPaymentConfig.accountNumber}</strong>
                    <button type="button" onClick={() => handleCopy(selectedPaymentConfig.accountNumber)} className="flex items-center px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-xs font-bold text-gray-700 rounded transition"><Copy className="w-3 h-3 mr-1" /> {copiedText === selectedPaymentConfig.accountNumber ? 'Copied!' : 'Copy'}</button>
                  </div>
                  <div className="flex items-center justify-between sm:justify-start">
                    <span className="text-gray-500 text-sm w-16 inline-block">အမည်:</span> 
                    <strong className="text-gray-800 text-lg sm:mr-4">{selectedPaymentConfig.accountName}</strong>
                    <button type="button" onClick={() => handleCopy(selectedPaymentConfig.accountName)} className="flex items-center px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-xs font-bold text-gray-700 rounded transition"><Copy className="w-3 h-3 mr-1" /> {copiedText === selectedPaymentConfig.accountName ? 'Copied!' : 'Copy'}</button>
                  </div>
                </div>
              </div>
            )}
            
            <div><label className="block mb-2 text-sm font-bold" style={{ color: THEME.gold }}>စရံငွေပေးချေမှု ပြုလုပ်ပြီးပါက ငွေလွှဲပြေစာတွင်ပါဝင်သော ငွေလွှဲ Transaction ID (နောက်ဆုံး ၆ လုံး) ကို အောက်မှာရိုက်ထည့်ပေးပါ</label><input required type="text" name="txId" maxLength={6} minLength={6} placeholder="e.g. 123456" value={formData.txId} onChange={handleChange} className="w-full p-4 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:border-yellow-500 text-center text-2xl tracking-[0.5em] font-bold text-gray-800" /></div>
          </div>
          
          <div className="mt-8 flex justify-between"><button type="button" onClick={() => setStep(3)} className="px-6 py-4 rounded-lg font-bold text-gray-600 bg-white border border-gray-300 hover:bg-gray-50 transition">BACK</button><button disabled={loading || !formData.paymentMethod} type="submit" className="px-8 py-4 rounded-lg font-bold text-white transition disabled:opacity-50 shadow-lg flex-1 ml-4 flex justify-center items-center hover:opacity-90" style={{ backgroundColor: THEME.primary }}>{loading ? 'PROCESSING...' : 'CONFIRM BOOKING'}</button></div>
        </form>
      )}
    </div>
  );
}

// ==========================================
// 2. ADMIN DASHBOARD
// ==========================================
function AdminDashboard({ appData, onSettingsUpdated }: { appData: AppData, onSettingsUpdated: (data: AppData) => void }) {
  const [tab, setTab] = useState<'bookings' | 'settings'>('bookings');
  return (
    <div className="animate-fade-in">
      <div className="flex space-x-2 mb-6">
        <button onClick={() => setTab('bookings')} className={`px-6 py-3 rounded-lg font-bold text-sm transition-all flex items-center ${tab === 'bookings' ? 'bg-[#123524] text-white shadow-md' : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'}`}><Calendar className="w-4 h-4 mr-2" /> Bookings List</button>
        <button onClick={() => setTab('settings')} className={`px-6 py-3 rounded-lg font-bold text-sm transition-all flex items-center ${tab === 'settings' ? 'bg-[#D4AF37] text-white shadow-md' : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'}`}><Settings className="w-4 h-4 mr-2" /> System Settings</button>
      </div>
      {tab === 'bookings' ? <AdminBookingsList /> : <AdminSettings appData={appData} onSettingsUpdated={onSettingsUpdated} />}
    </div>
  );
}

function AdminBookingsList() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchBookings = async () => {
    try {
      const q = query(collection(db, 'bookings'), orderBy('createdAt', 'desc'));
      const querySnapshot = await getDocs(q);
      const data: Booking[] = [];
      querySnapshot.forEach((doc) => { data.push({ id: doc.id, ...doc.data() } as Booking); });
      setBookings(data);
    } catch (error) { console.error(error); }
    setLoading(false);
  };
  useEffect(() => { fetchBookings(); }, []);

  const handleApprove = async (id: string) => { if(window.confirm('ဤ Booking ကို အတည်ပြုမည် သေချာပါသလား?')) { await updateDoc(doc(db, 'bookings', id), { status: 'approved' }); fetchBookings(); } };
  const handleDelete = async (id: string) => { if(window.confirm('ဤ Booking ကို ဖျက်မည် သေချာပါသလား?')) { await deleteDoc(doc(db, 'bookings', id)); fetchBookings(); } };

  if (loading) return <div className="text-center py-20 text-gray-500 font-bold">Loading Bookings...</div>;

  return (
    <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
      <div className="flex justify-between items-center mb-6 border-b border-gray-100 pb-4"><h2 className="text-xl font-bold flex items-center" style={{ color: THEME.primary }}><ShieldCheck className="mr-2 text-yellow-500"/> Booking Requests</h2><span className="bg-yellow-100 text-yellow-700 px-4 py-1 rounded-full text-sm font-bold border border-yellow-200">Total: {bookings.length}</span></div>
      <div className="overflow-x-auto"><table className="w-full text-left border-collapse"><thead><tr className="border-b-2 border-gray-100 text-xs text-gray-500 uppercase tracking-wider"><th className="p-3 pb-4">Customer</th><th className="p-3 pb-4">Service & Therapist</th><th className="p-3 pb-4">Date & Time</th><th className="p-3 pb-4">TxID & Total</th><th className="p-3 pb-4">Status</th><th className="p-3 pb-4 text-right">Actions</th></tr></thead><tbody>{bookings.length === 0 && (<tr><td colSpan={6} className="p-10 text-center text-gray-400">Booking မရှိသေးပါ။</td></tr>)}{bookings.map((b) => (<tr key={b.id} className="border-b border-gray-50 hover:bg-gray-50 transition"><td className="p-3"><div className="font-bold text-gray-800">{b.name || 'No Name'}</div><div className="text-xs text-gray-500">{b.phone || '-'}</div></td><td className="p-3"><div className="font-bold text-sm text-gray-800">{b.service || '-'}</div><div className="text-xs text-gray-500 mt-1 flex items-center"><User className="w-3 h-3 mr-1"/>{b.therapist || '-'}</div></td><td className="p-3 text-sm text-gray-700"><div className="font-semibold">{b.date || '-'}</div><div className="text-gray-500 text-xs mt-1">{b.time || '-'}</div></td><td className="p-3"><div className="font-mono font-bold text-gray-800">{b.txId || '-'}</div><div className="text-[10px] uppercase tracking-wider font-bold text-yellow-600 mt-1">{b.paymentMethod || 'Unknown'} • {formatPrice(b.totalPrice)}</div></td><td className="p-3">{b.status === 'pending' ? <span className="bg-yellow-100 text-yellow-700 px-2 py-1 rounded text-xs font-bold border border-yellow-200">Pending</span> : <span className="bg-green-100 text-green-700 px-2 py-1 rounded text-xs font-bold border border-green-200">Approved</span>}</td><td className="p-3 text-right"><div className="flex justify-end space-x-2">{b.status === 'pending' && (<button onClick={() => handleApprove(b.id!)} className="p-2 bg-green-100 text-green-700 rounded-lg hover:bg-green-200 transition" title="Approve"><CheckCircle className="w-5 h-5" /></button>)}<button onClick={() => handleDelete(b.id!)} className="p-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition" title="Delete"><Trash2 className="w-5 h-5" /></button></div></td></tr>))}</tbody></table></div>
    </div>
  );
}

function AdminSettings({ appData, onSettingsUpdated }: { appData: AppData, onSettingsUpdated: (data: AppData) => void }) {
  const [localTherapists, setLocalTherapists] = useState<TherapistProfile[]>(JSON.parse(JSON.stringify(appData.therapists)));
  const [localCategories, setLocalCategories] = useState<MenuCategory[]>(JSON.parse(JSON.stringify(appData.categories)));
  const [localBranding, setLocalBranding] = useState<AppBranding>(JSON.parse(JSON.stringify(appData.branding || DEFAULT_BRANDING)));
  const [localPaymentMethods, setLocalPaymentMethods] = useState<PaymentMethod[]>(JSON.parse(JSON.stringify(appData.paymentMethods || DEFAULT_PAYMENT_METHODS)));
  
  const [deletedTherapistIds, setDeletedTherapistIds] = useState<string[]>([]);
  const [savingCategory, setSavingCategory] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState<string | null>(null);

  const handleSaveCategory = async (cIdx: number) => {
    const cat = localCategories[cIdx];
    if(!window.confirm(`ဤပြောင်းလဲမှုများကို (${cat.title}) သိမ်းဆည်းမည်မှာ သေချာပါသလား?`)) return;
    setSavingCategory(cat.id);
    try {
      await setDoc(doc(db, 'settings', 'appData'), { categories: localCategories }, { merge: true });
      onSettingsUpdated({ ...appData, categories: localCategories });
      alert('အောင်မြင်စွာ သိမ်းဆည်းပြီးပါပြီ။');
    } catch (e) { alert('Update လုပ်ရာတွင် အခက်အခဲရှိနေပါသည်။'); }
    setSavingCategory(null);
  };

  const handleSaveTherapists = async () => {
    if(!window.confirm(`ဝန်ထမ်းစာရင်းကို သိမ်းဆည်းမည်မှာ သေချာပါသလား?`)) return;
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
    if(!window.confirm(`Logo နှင့် Footer အချက်အလက်များကို သိမ်းဆည်းမည်မှာ သေချာပါသလား?`)) return;
    setSavingCategory('branding');
    try {
      await setDoc(doc(db, 'settings', 'appData'), { branding: localBranding }, { merge: true });
      onSettingsUpdated({ ...appData, branding: localBranding });
      alert('Logo နှင့် Footer ကို အောင်မြင်စွာ သိမ်းဆည်းပြီးပါပြီ။');
    } catch (e) { alert('Update လုပ်ရာတွင် အခက်အခဲရှိနေပါသည်။'); }
    setSavingCategory(null);
  };

  const handleSavePayments = async () => {
    if(!window.confirm(`Payment အချက်အလက်များကို သိမ်းဆည်းမည်မှာ သေချာပါသလား?`)) return;
    setSavingCategory('payments');
    try {
      await setDoc(doc(db, 'settings', 'appData'), { paymentMethods: localPaymentMethods }, { merge: true });
      onSettingsUpdated({ ...appData, paymentMethods: localPaymentMethods });
      alert('Payment အချက်အလက်များကို အောင်မြင်စွာ သိမ်းဆည်းပြီးပါပြီ။');
    } catch (e) { alert('Update လုပ်ရာတွင် အခက်အခဲရှိနေပါသည်။'); }
    setSavingCategory(null);
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingImage('logo');
    try {
      const base64 = await compressImage(file, 400, 400); 
      setLocalBranding({ ...localBranding, logoUrl: base64 });
    } catch (err) { alert("Logo တင်ရာတွင် အခက်အခဲရှိနေပါသည်။"); }
    setUploadingImage(null);
  };

  const handlePaymentLogoUpload = async (idx: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingImage(`pay_${idx}`);
    try {
      const base64 = await compressImage(file, 200, 200); 
      const updated = [...localPaymentMethods];
      updated[idx].logoUrl = base64;
      setLocalPaymentMethods(updated);
    } catch (err) { alert("Logo တင်ရာတွင် အခက်အခဲရှိနေပါသည်။"); }
    setUploadingImage(null);
  };

  const addTherapist = () => setLocalTherapists([...localTherapists, { id: `t_${Date.now()}`, name: 'New Therapist', images: [], order: localTherapists.length }]);
  const updateTherapistName = (tIdx: number, name: string) => { const updated = [...localTherapists]; updated[tIdx].name = name; setLocalTherapists(updated); };
  const removeTherapist = (tIdx: number) => {
    if(!window.confirm("ဤဝန်ထမ်းအား ဖျက်မည် သေချာပါသလား?")) return;
    const t = localTherapists[tIdx];
    if (t.id && !t.id.startsWith('new_')) setDeletedTherapistIds([...deletedTherapistIds, t.id]);
    const updated = [...localTherapists]; updated.splice(tIdx, 1); setLocalTherapists(updated);
  };

  const handleImageUpload = async (tIdx: number, files: FileList | null) => {
    if (!files || files.length === 0) return;
    const therapist = localTherapists[tIdx];
    if (therapist.images.length + files.length > 5) { alert('အများဆုံး ၅ ပုံသာ ထည့်ခွင့်ရှိပါတယ်။'); return; }

    setUploadingImage(therapist.id);
    const newUrls: string[] = [];
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
  const deleteItem = (cIdx: number, iIdx: number) => { if(!window.confirm("ဤ Service အား ဖျက်မည် သေချာပါသလား?")) return; const updated = [...localCategories]; updated[cIdx].items.splice(iIdx, 1); setLocalCategories(updated); };

  const updatePaymentMethod = (pIdx: number, field: string, val: string) => { const updated = [...localPaymentMethods]; (updated[pIdx] as any)[field] = val; setLocalPaymentMethods(updated); };
  const addPaymentMethod = () => { setLocalPaymentMethods([...localPaymentMethods, { id: `p_${Date.now()}`, name: 'New Payment', accountNumber: '', accountName: '', logoUrl: '' }]); };
  const removePaymentMethod = (pIdx: number) => { if(!window.confirm("ဤ Payment အား ဖျက်မည် သေချာပါသလား?")) return; const updated = [...localPaymentMethods]; updated.splice(pIdx, 1); setLocalPaymentMethods(updated); };

  return (
    <div className="space-y-6">
      
      {/* Branding & Footer Editor */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
        <div className="flex justify-between items-center mb-6 pb-4 border-b border-gray-100">
          <div><h3 className="text-xl font-bold text-gray-800 flex items-center"><ImageIconFeather className="w-5 h-5 mr-2 text-[#D4AF37]"/> App Branding & Footer</h3><p className="text-xs text-gray-500 mt-1">Logo ပုံနှင့် အောက်ခြေလိပ်စာများ ပြင်ဆင်ရန်</p></div>
          <button disabled={savingCategory === 'branding'} onClick={handleSaveBranding} className="flex items-center bg-[#123524] text-white px-4 py-2 rounded-lg font-bold shadow-md hover:opacity-90">
            <Save className="w-4 h-4 mr-2"/> {savingCategory === 'branding' ? 'Saving...' : 'Save Branding'}
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="border border-gray-200 rounded-xl p-4 bg-gray-50 flex flex-col items-center justify-center">
            <label className="block text-xs font-bold text-gray-500 mb-4 text-center w-full">Header Logo Image (Circle Format)</label>
            <div className="w-28 h-28 bg-white border-2 border-dashed border-gray-300 rounded-full flex items-center justify-center relative overflow-hidden mb-4 shadow-sm group">
              {localBranding.logoUrl ? (
                <>
                  <img src={localBranding.logoUrl} alt="Logo Preview" className="w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                     <button onClick={() => setLocalBranding({...localBranding, logoUrl: ''})} className="bg-red-500 text-white p-2 rounded-full hover:bg-red-600"><Trash2 className="w-4 h-4"/></button>
                  </div>
                </>
              ) : (
                <div className="flex flex-col items-center text-gray-400">
                  {uploadingImage === 'logo' ? <div className="text-xs font-bold animate-pulse">Uploading...</div> : <ImageIconFeather className="w-8 h-8 opacity-50"/>}
                </div>
              )}
            </div>
            <label className="bg-white border border-gray-300 text-gray-700 px-4 py-2 rounded-lg text-sm font-bold cursor-pointer hover:bg-gray-100 transition shadow-sm">
              {localBranding.logoUrl ? 'Change Logo' : 'Upload Logo'}
              <input type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} disabled={uploadingImage === 'logo'} />
            </label>
          </div>

          <div className="space-y-4">
            <div><label className="block text-xs font-bold text-gray-500 mb-1">Address</label><textarea value={localBranding.address} onChange={e => setLocalBranding({...localBranding, address: e.target.value})} className="w-full p-2 text-sm border border-gray-300 rounded focus:border-[#D4AF37] outline-none" rows={2} /></div>
            <div className="grid grid-cols-2 gap-2">
              <div><label className="block text-xs font-bold text-gray-500 mb-1">Phone 1</label><input type="text" value={localBranding.phone1} onChange={e => setLocalBranding({...localBranding, phone1: e.target.value})} className="w-full p-2 text-sm border border-gray-300 rounded focus:border-[#D4AF37] outline-none" /></div>
              <div><label className="block text-xs font-bold text-gray-500 mb-1">Phone 2</label><input type="text" value={localBranding.phone2} onChange={e => setLocalBranding({...localBranding, phone2: e.target.value})} className="w-full p-2 text-sm border border-gray-300 rounded focus:border-[#D4AF37] outline-none" /></div>
            </div>
            <div><label className="block text-xs font-bold text-gray-500 mb-1">Copyright Text</label><input type="text" value={localBranding.copyright} onChange={e => setLocalBranding({...localBranding, copyright: e.target.value})} className="w-full p-2 text-sm border border-gray-300 rounded focus:border-[#D4AF37] outline-none" /></div>
          </div>
        </div>
      </div>

      {/* Payment Methods Editor */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
        <div className="flex justify-between items-center mb-6 pb-4 border-b border-gray-100">
          <div><h3 className="text-xl font-bold text-gray-800 flex items-center"><CreditCard className="w-5 h-5 mr-2 text-[#D4AF37]"/> Manage Payment Methods</h3><p className="text-xs text-gray-500 mt-1">ငွေလွှဲစနစ်များနှင့် အကောင့်အချက်အလက်များ</p></div>
          <div className="flex space-x-2">
            <button onClick={addPaymentMethod} className="flex items-center text-sm bg-gray-100 border border-gray-300 px-4 py-2 rounded-lg hover:bg-gray-200 font-bold"><PlusCircle className="w-4 h-4 mr-1"/> Add Payment</button>
            <button disabled={savingCategory === 'payments'} onClick={handleSavePayments} className="flex items-center bg-[#123524] text-white px-4 py-2 rounded-lg font-bold shadow-md hover:opacity-90"><Save className="w-4 h-4 mr-2"/> {savingCategory === 'payments' ? 'Saving...' : 'Save Payments'}</button>
          </div>
        </div>

        <div className="space-y-3">
          {localPaymentMethods.map((pm, pIdx) => (
            <div key={pm.id} className="grid grid-cols-1 lg:grid-cols-12 gap-3 items-center bg-gray-50 p-3 border border-gray-200 rounded-lg hover:border-gray-300 transition">
              
              <div className="lg:col-span-2 flex flex-col items-center justify-center border-r border-gray-200 pr-2">
                <div className="w-12 h-12 bg-white border border-gray-200 rounded mb-1 flex items-center justify-center overflow-hidden relative group">
                  {pm.logoUrl ? (
                    <>
                      <img src={pm.logoUrl} alt="Logo" className="w-full h-full object-contain p-1" />
                      <button onClick={() => updatePaymentMethod(pIdx, 'logoUrl', '')} className="absolute inset-0 bg-black/50 text-white flex items-center justify-center opacity-0 group-hover:opacity-100"><X className="w-4 h-4"/></button>
                    </>
                  ) : (
                    <div className="text-[8px] text-gray-400 text-center">{uploadingImage === `pay_${pIdx}` ? '...' : 'No Logo'}</div>
                  )}
                </div>
                <label className="text-[10px] text-[#D4AF37] font-bold cursor-pointer hover:underline">
                  Upload Logo
                  <input type="file" accept="image/*" className="hidden" onChange={(e) => handlePaymentLogoUpload(pIdx, e)} disabled={uploadingImage === `pay_${pIdx}`} />
                </label>
              </div>

              <div className="lg:col-span-3"><label className="text-[10px] font-bold text-gray-400 uppercase">Bank/App Name</label><input type="text" value={pm.name} onChange={(e)=>updatePaymentMethod(pIdx, 'name', e.target.value)} placeholder="e.g. KBZ PAY" className="w-full p-2 text-sm border border-gray-200 rounded focus:border-[#D4AF37] outline-none font-bold text-gray-700"/></div>
              <div className="lg:col-span-3"><label className="text-[10px] font-bold text-gray-400 uppercase">Account Number</label><input type="text" value={pm.accountNumber} onChange={(e)=>updatePaymentMethod(pIdx, 'accountNumber', e.target.value)} placeholder="09xxxxxxxxx" className="w-full p-2 text-sm border border-gray-200 rounded focus:border-[#D4AF37] outline-none font-bold text-[#123524] tracking-wider"/></div>
              <div className="lg:col-span-3"><label className="text-[10px] font-bold text-gray-400 uppercase">Account Name</label><input type="text" value={pm.accountName} onChange={(e)=>updatePaymentMethod(pIdx, 'accountName', e.target.value)} placeholder="Name" className="w-full p-2 text-sm border border-gray-200 rounded focus:border-[#D4AF37] outline-none"/></div>
              <div className="lg:col-span-1 flex justify-end pt-4 lg:pt-0"><button onClick={()=>removePaymentMethod(pIdx)} className="p-2 text-red-500 hover:bg-red-50 hover:text-red-700 rounded-lg transition"><Trash2 className="w-5 h-5"/></button></div>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
        <div className="flex justify-between items-center mb-6 pb-4 border-b border-gray-100">
          <div><h3 className="text-xl font-bold text-gray-800 flex items-center"><User className="w-5 h-5 mr-2 text-[#D4AF37]"/> Manage Therapists</h3><p className="text-xs text-gray-500 mt-1">ဝန်ထမ်းအမည်များနှင့် အလှပုံများ ထည့်သွင်းပါ။</p></div>
          <div className="flex space-x-2">
            <button onClick={addTherapist} className="flex items-center text-sm bg-gray-100 border border-gray-300 px-4 py-2 rounded-lg hover:bg-gray-200 font-bold"><PlusCircle className="w-4 h-4 mr-1"/> Add Therapist</button>
            <button disabled={savingCategory === 'therapists'} onClick={handleSaveTherapists} className="flex items-center bg-[#123524] text-white px-4 py-2 rounded-lg font-bold shadow-md hover:opacity-90"><Save className="w-4 h-4 mr-2"/> {savingCategory === 'therapists' ? 'Saving...' : 'Save Therapists'}</button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {localTherapists.map((therapist, tIdx) => (
            <div key={therapist.id} className="border border-gray-200 rounded-xl p-4 bg-gray-50 relative">
              <button onClick={() => removeTherapist(tIdx)} className="absolute top-2 right-2 p-1 bg-red-100 text-red-500 rounded hover:bg-red-200"><Trash2 className="w-4 h-4"/></button>
              <label className="block text-xs font-bold text-gray-500 mb-1">Therapist Name</label>
              <input type="text" value={therapist.name} onChange={(e) => updateTherapistName(tIdx, e.target.value)} className="w-full p-2 text-sm font-bold border border-gray-300 rounded mb-4 focus:outline-none focus:border-[#D4AF37]"/>
              <label className="block text-xs font-bold text-gray-500 mb-2">Photos (Max 5, 4:3 Portrait Recommended)</label>
              <div className="flex flex-wrap gap-2 mb-2">
                {therapist.images.map((imgUrl, imgIdx) => (
                  <div key={imgIdx} className="w-16 aspect-[3/4] relative rounded overflow-hidden shadow-sm border border-gray-200">
                    <img src={imgUrl} alt="upload" className="w-full h-full object-cover" />
                    <button onClick={() => removeImage(tIdx, imgIdx)} className="absolute top-1 right-1 bg-black/50 text-white rounded-full p-0.5 hover:bg-red-500"><X className="w-3 h-3"/></button>
                  </div>
                ))}
                {therapist.images.length < 5 && (
                  <label className="w-16 aspect-[3/4] border-2 border-dashed border-gray-300 rounded flex flex-col items-center justify-center cursor-pointer hover:bg-gray-100 hover:border-gray-400 transition text-gray-400">
                    {uploadingImage === therapist.id ? <div className="text-[10px] font-bold animate-pulse text-center">Wait...</div> : (<><UploadCloud className="w-4 h-4 mb-1" /><span className="text-[10px] font-bold">Upload</span></>)}
                    <input type="file" accept="image/*" multiple className="hidden" onChange={(e) => handleImageUpload(tIdx, e.target.files)} disabled={uploadingImage === therapist.id} />
                  </label>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {localCategories.map((cat, cIdx) => (
        <div key={cat.id} className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="bg-gray-50 p-4 border-b border-gray-200 flex justify-between items-center">
            <h3 className="font-bold text-gray-800 flex items-center text-lg"><Activity className="w-5 h-5 mr-2 text-[#D4AF37]"/> {cat.title} Category</h3>
            <div className="flex space-x-2">
              <button onClick={() => addItem(cIdx)} className="flex items-center text-sm bg-white border border-gray-300 px-4 py-2 rounded-lg hover:bg-gray-100 font-bold"><PlusCircle className="w-4 h-4 mr-1"/> Add Item</button>
              <button disabled={savingCategory === cat.id} onClick={() => handleSaveCategory(cIdx)} className="flex items-center bg-[#D4AF37] text-white px-4 py-2 rounded-lg font-bold shadow-md hover:opacity-90"><Save className="w-4 h-4 mr-2"/> {savingCategory === cat.id ? 'Saving...' : `Save ${cat.title}`}</button>
            </div>
          </div>
          <div className="p-4 space-y-3">
            {cat.items.length === 0 && <p className="text-sm text-gray-400 text-center py-4">No items in this category.</p>}
            {cat.items.map((item, iIdx) => (
              <div key={item.id} className="grid grid-cols-1 lg:grid-cols-12 gap-2 items-center bg-white p-3 border border-gray-200 rounded-lg hover:border-gray-300 transition">
                <div className="lg:col-span-3"><label className="text-[10px] font-bold text-gray-400 uppercase">Service Name</label><input type="text" value={item.name} onChange={(e)=>updateItem(cIdx,iIdx,'name',e.target.value)} className="w-full p-2 text-sm border border-gray-200 rounded focus:border-[#D4AF37] outline-none font-bold text-gray-700"/></div>
                <div className="lg:col-span-2"><label className="text-[10px] font-bold text-gray-400 uppercase">Duration/Info</label><input type="text" value={item.duration} onChange={(e)=>updateItem(cIdx,iIdx,'duration',e.target.value)} placeholder="60 Mins" className="w-full p-2 text-sm border border-gray-200 rounded focus:border-[#D4AF37] outline-none"/></div>
                <div className="lg:col-span-2"><label className="text-[10px] font-bold text-gray-400 uppercase">Price (Ks)</label><input type="number" value={item.price || ''} onChange={(e)=>updateItem(cIdx,iIdx,'price',Number(e.target.value))} className="w-full p-2 text-sm border border-gray-200 rounded focus:border-[#D4AF37] outline-none font-bold text-[#123524]"/></div>
                <div className="lg:col-span-2"><label className="text-[10px] font-bold text-gray-400 uppercase">VVIP Price (Ks)</label><input type="number" value={item.vvipPrice || ''} onChange={(e)=>updateItem(cIdx,iIdx,'vvipPrice',e.target.value === '' ? undefined : Number(e.target.value))} placeholder="Optional" className="w-full p-2 text-sm border border-gray-200 rounded focus:border-[#D4AF37] outline-none font-bold text-yellow-600"/></div>
                <div className="lg:col-span-2 flex items-center px-2 pt-4"><label className="text-xs font-bold text-gray-600 flex items-center cursor-pointer bg-gray-50 px-2 py-1.5 rounded border border-gray-200 w-full"><input type="checkbox" checked={item.vvipIncluded || false} onChange={(e)=>updateItem(cIdx,iIdx,'vvipIncluded',e.target.checked)} className="mr-2"/> VVIP Free</label></div>
                <div className="lg:col-span-1 flex justify-end pt-4 lg:pt-0"><button onClick={()=>deleteItem(cIdx, iIdx)} className="p-2 text-red-500 hover:bg-red-50 hover:text-red-700 rounded-lg transition"><Trash2 className="w-5 h-5"/></button></div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
