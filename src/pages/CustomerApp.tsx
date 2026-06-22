import React, { useState, useEffect, useRef, useMemo } from 'react';
import { collection, addDoc, getDocs, updateDoc, doc, query, onSnapshot, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../firebase';

// Vercel တွင် App Crash မဖြစ်စေရန် လိုအပ်သော Icon အားလုံးကို အပြည့်အစုံ ထည့်သွင်းထားပါသည်
import { Calendar, Clock, CreditCard, CheckCircle, User, Phone, ChevronRight, ChevronLeft, Check, Sparkles, Droplets, Scissors, Home, ChevronDown, ChevronUp, History, UserCircle, CalendarPlus, ImageIcon, Activity, Crown, Copy, Percent, AlertCircle, KeyRound, BarChart2, Edit, LogOut, X, Trash2, ShieldCheck, ShieldAlert, Save, PlusCircle, Settings, UploadCloud, MapPin, Search, Lock, Coffee, Download } from 'lucide-react';
import { THEME, AppData, Booking, MenuItem, TherapistProfile, UserProfile, formatPrice } from '../shared';

// ==========================================
// LOCAL HELPERS & CONSTANTS
// ==========================================
const ICON_MAP: Record<string, any> = {
  massage: Sparkles, scrub: Droplets, waxing: Scissors, hotel: Home, facial: Droplets, manicure: Scissors, pedicure: Scissors,
};

const ALL_TIME_SLOTS = ["6:00 AM", "6:30 AM", "7:00 AM", "7:30 AM", "8:00 AM", "8:30 AM", "9:00 AM", "9:30 AM", "10:00 AM", "10:30 AM", "11:00 AM", "11:30 AM", "12:00 PM", "12:30 PM", "1:00 PM", "1:30 PM", "2:00 PM", "2:30 PM", "3:00 PM", "3:30 PM", "4:00 PM", "4:30 PM", "5:00 PM", "5:30 PM", "6:00 PM", "6:30 PM", "7:00 PM", "7:30 PM", "8:00 PM", "8:30 PM", "9:00 PM"];

const getLocalTodayStr = () => {
  const d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
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

const XCircleIcon = ({className}:any) => <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>;

export function StatusBadge({ status, cancelReason }: { status: string, cancelReason?: string }) {
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

export function BookingCard({ b }: { b: Booking }) {
   const statusColor = { pending: 'bg-yellow-100 text-yellow-700 border-yellow-200', payment_checking: 'bg-blue-100 text-blue-700 border-blue-200', approved: 'bg-green-100 text-green-700 border-green-200', in_progress: 'bg-orange-100 text-orange-700 border-orange-200', completed: 'bg-gray-100 text-gray-600 border-gray-200', cancelled: 'bg-red-100 text-red-700 border-red-200' }[b.status];
   return (
     <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 hover:border-[#D4AF37]/50 transition-all duration-300 relative overflow-hidden group">
       <div className={`absolute top-0 left-0 w-1.5 h-full ${b.status === 'in_progress' ? 'bg-orange-500 animate-pulse' : b.status === 'approved' ? 'bg-green-500' : 'bg-gray-200'}`}></div>
       <div className="flex justify-between items-start mb-3">
         <div>
           <div className="font-bold text-gray-800 text-base">{b.service.split('(')[0]}</div>
           <div className="text-xs text-gray-500 mt-1 flex items-center"><User className="w-3 h-3 mr-1 text-[#D4AF37]"/> {b.therapist}</div>
         </div>
         <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full border uppercase tracking-wider ${statusColor}`}>{b.status.replace('_', ' ')}</span>
       </div>
       <div className="grid grid-cols-2 gap-3 mb-3 bg-gray-50 p-3 rounded-xl border border-gray-100">
         <div><div className="text-[10px] text-gray-400 font-bold uppercase mb-0.5">Date</div><div className="font-semibold text-sm text-gray-700 flex items-center"><Calendar className="w-3 h-3 mr-1 text-[#123524]"/>{b.date}</div></div>
         <div><div className="text-[10px] text-gray-400 font-bold uppercase mb-0.5">Time</div><div className="font-semibold text-sm text-[#123524] flex items-center"><Clock className="w-3 h-3 mr-1 text-[#D4AF37]"/>{b.time}</div></div>
       </div>
       <div className="flex justify-between items-end pt-3 border-t border-gray-100">
         <div className="text-[10px] text-gray-400 font-mono">ID: {b.id?.slice(-6).toUpperCase()}</div>
         <div className="font-bold text-[#123524] text-lg">{formatPrice(b.totalPrice)}</div>
       </div>
     </div>
   );
}

// ==========================================
// MAIN CUSTOMER APP WRAPPER
// ==========================================
export default function CustomerApp({ appData }: { appData: AppData }) {
  const [activeTab, setActiveTab] = useState<'book' | 'therapists' | 'dashboard' | 'history' | 'profile'>(() => {
     const searchParams = new URLSearchParams(window.location.search);
     const view = searchParams.get('view');
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

// ==========================================
// CUSTOMER BOOKING WIZARD (FULL LOGIC)
// ==========================================
export function CustomerBookingWizard({
    appData, 
    userPhone = '', 
    onBooked, 
    forceTherapistFirst = false, 
    initialTherapist = null, 
    isStaffMode = false, 
    staffClockIn = false, 
    staffClockInSuccess, 
    preselectedStaff 
}: { 
    appData: AppData, 
    userPhone?: string, 
    onBooked?: (phone: string) => void, 
    forceTherapistFirst?: boolean, 
    initialTherapist?: TherapistProfile | null, 
    isStaffMode?: boolean, 
    staffClockIn?: boolean, 
    staffClockInSuccess?: () => void, 
    preselectedStaff?: string 
}) {
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

  // Time Slot Logic (With Real-Time Check for Today)
  const getAvailableTimeSlots = () => {
    if (!formData.selectedItem) return [];
    const isHotelService = appData.categories.find(c => c.id === 'hotel')?.items.some(i => i.id === formData.selectedItem?.id);
    const serviceName = formData.selectedItem.name.toLowerCase();
    let allowedSlots = ALL_TIME_SLOTS;

    // Filter by service type first
    if (isHotelService) {
      if (serviceName.includes("day & night") || serviceName.includes("day and night") || serviceName.includes("24 hour")) allowedSlots = ["7:00 AM to 7:00 AM (Next Day)"];
      else if (serviceName.includes("outcall")) allowedSlots = ALL_TIME_SLOTS.slice(ALL_TIME_SLOTS.indexOf("7:00 AM"), ALL_TIME_SLOTS.indexOf("7:00 PM") + 1);
      else if (serviceName.includes("half day")) allowedSlots = ["6:00 AM to 12:00 PM", "12:00 PM to 6:00 PM"];
      else if (serviceName.includes("night")) allowedSlots = ["7:00 PM to 7:00 AM (Next Day)"];
      else if (serviceName.includes("whole day")) allowedSlots = ["7:00 AM to 7:00 PM"];
    } else {
       allowedSlots = ALL_TIME_SLOTS.slice(ALL_TIME_SLOTS.indexOf("9:00 AM"), ALL_TIME_SLOTS.indexOf("9:00 PM") + 1);
    }

    // Filter by Real-time if the date is today
    if (formData.date === todayStr) {
        const now = new Date();
        allowedSlots = allowedSlots.filter(slot => {
            let timeStr = slot;
            if (slot.includes("to")) timeStr = slot.split(" to ")[0]; // Get the start time of the interval
            
            const match = timeStr.match(/(\d+):(\d+)\s+(AM|PM)/i);
            if (match) {
                let h = parseInt(match[1]);
                const m = parseInt(match[2]);
                const ampm = match[3].toUpperCase();
                
                if (ampm === 'PM' && h < 12) h += 12;
                if (ampm === 'AM' && h === 12) h = 0;
                
                const slotTime = new Date();
                slotTime.setHours(h, m, 0, 0);
                return slotTime > now; // Only return slots that are in the future
            }
            return true; 
        });
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
    return formData.isVvipUpgrade && vvipPrice > 0 && !formData.selectedItem.vvipIncluded ? vvipPrice : basePrice;
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

      // Use the newly computed real-time available slots to check availability
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
              } else if (b.time && !b.time.includes('to')) {
                  const [oy, omo, od] = b.date.split('-');
                  const slotTime = new Date(Number(oy), Number(omo)-1, Number(od));
                  const [tPart, oampm] = b.time.split(' ');
                  let [sh, sm] = tPart.split(':').map(Number);
                  if (oampm === 'PM' && sh < 12) sh += 12;
                  if (oampm === 'AM' && sh === 12) sh = 0;
                  slotTime.setHours(sh, sm, 0, 0);

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
           if (staffClockInSuccess) { staffClockInSuccess(); return; }
           if (isStaffMode) {
               setStep(1); setFormData({ name: 'Walk-in Guest', phone: '', selectedItem: null, isVvipUpgrade: false, therapist: initialTherapist, date: '', time: '', paymentMethod: '', txId: '', specialRequest: '' }); setSuccessMsg(''); window.scrollTo({ top: 0, behavior: 'smooth' });
           } else { setSuccessMsg(''); if (onBooked) onBooked(formData.phone); }
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
    <div className="animate-fade-in px-2 sm:px-0">
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
      
      {/* VVIP Toggle Display */}
      <div className="bg-yellow-50 rounded-xl p-4 border border-yellow-200 mt-6 flex justify-between items-center shadow-sm">
        <div className="flex items-center">
            <div className="w-10 h-10 bg-yellow-100 rounded-lg flex items-center justify-center mr-4">
                <Crown className="w-5 h-5" style={{ color: THEME.gold }} />
            </div>
            <div>
                <div className="font-bold text-yellow-800 text-sm">VVIP Master Room</div>
                <div className="text-xs text-yellow-600 font-semibold mt-1">
                    {formData.selectedItem?.vvipIncluded ? '✅ Included (Free)' : (!formData.selectedItem ? 'Select a service' : (formData.selectedItem.vvipPrice ? 'Upgrade for extra comfort' : 'Not available'))}
                </div>
            </div>
        </div>
        {formData.selectedItem?.vvipIncluded ? (
            <span className="bg-green-100 text-green-700 px-3 py-1 rounded-full text-xs font-bold border border-green-200">INCLUDED</span>
        ) : (
            <input type="checkbox" checked={formData.isVvipUpgrade} disabled={!formData.selectedItem?.vvipPrice} onChange={(e) => setFormData({ ...formData, isVvipUpgrade: e.target.checked })} className="w-6 h-6 accent-[#D4AF37] cursor-pointer" />
        )}
      </div>

      <div className={`mt-8 flex ${currentStep === 1 ? 'justify-end' : 'justify-between'}`}>
        {currentStep === 2 && <button type="button" onClick={() => handleNextStep(1)} className="px-6 py-4 rounded-lg font-bold text-gray-600 bg-white border border-gray-300 hover:bg-gray-50 transition">BACK</button>}
        <button type="button" disabled={!formData.selectedItem} onClick={() => handleNextStep(currentStep + 1)} className="px-8 py-4 rounded-lg font-bold text-white transition disabled:opacity-50 shadow-md hover:opacity-90 flex items-center" style={{ backgroundColor: THEME.primary }}>
          {isTherapistFirst && currentStep === 2 ? 'CONTINUE TO DATE & TIME' : 'CONTINUE TO THERAPIST'} <ChevronRight className="w-5 h-5 ml-2" />
        </button>
      </div>
    </div>
  );

  const renderTherapistSelection = (currentStep: number) => (
    <div className="animate-fade-in relative px-2 sm:px-0">
      {viewGallery && (
        <div className="fixed inset-0 z-[100] bg-black/95 flex flex-col items-center justify-center backdrop-blur-sm animate-fade-in">
          <button type="button" onClick={() => setViewGallery(null)} className="absolute top-4 right-4 z-[110] text-white p-2 hover:text-[#D4AF37] transition bg-black/50 rounded-full"><X className="w-8 h-8" /></button>
          <div className="relative w-full flex-1 flex items-center justify-center overflow-hidden py-10 px-0 sm:px-10">
            <img src={viewGallery.images[viewGallery.index]} alt="Detail" className="w-full h-full object-contain drop-shadow-2xl" />
            {viewGallery.images.length > 1 && (
              <>
                <button type="button" onClick={(e) => { e.stopPropagation(); setViewGallery({ ...viewGallery, index: (viewGallery.index - 1 + viewGallery.images.length) % viewGallery.images.length }) }} className="absolute left-2 sm:left-8 top-1/2 -translate-y-1/2 bg-black/40 hover:bg-black/70 text-white p-3 rounded-full transition z-[110] border border-white/10"><ChevronLeft className="w-6 h-6 sm:w-8 sm:h-8" /></button>
                <button type="button" onClick={(e) => { e.stopPropagation(); setViewGallery({ ...viewGallery, index: (viewGallery.index + 1) % viewGallery.images.length }) }} className="absolute right-2 sm:right-8 top-1/2 -translate-y-1/2 bg-black/40 hover:bg-black/70 text-white p-3 rounded-full transition z-[110] border border-white/10"><ChevronRight className="w-6 h-6 sm:w-8 sm:h-8" /></button>
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
                      <button type="button" onClick={(e) => { e.stopPropagation(); setViewGallery({ images: therapist.images, index: 0 }); }} className="absolute bottom-2 inset-x-2 bg-[#123524]/90 hover:bg-[#123524] text-[#D4AF37] text-[10px] font-bold py-1 px-1 rounded flex flex-col items-center justify-center backdrop-blur-sm border border-[#D4AF37]/50 transition z-30 leading-tight">
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
                <button type="button" onClick={(e) => { e.stopPropagation(); setFormData({ ...formData, therapist: therapist }); handleNextStep(currentStep + 1); }} className="mt-3 w-full bg-[#123524] text-[#D4AF37] py-2 rounded-lg text-xs font-bold flex items-center justify-center hover:opacity-90 transition shadow-sm border border-[#1a4a32]">
                  ဘိုကင်ယူမည် <ChevronRight className="w-3 h-3 ml-1" />
                </button>
              )}
            </div>
          )
        })}
      </div>
      <div className={`mt-8 flex ${currentStep === 1 ? 'justify-end' : 'justify-between'}`}>
         {currentStep === 2 && <button type="button" onClick={() => handleNextStep(1)} className="px-6 py-4 rounded-lg font-bold text-gray-600 bg-white border border-gray-300 hover:bg-gray-50 transition">BACK</button>}
         <button type="button" disabled={formData.therapist === undefined} onClick={() => handleNextStep(currentStep + 1)} className={`px-8 py-4 rounded-lg font-bold text-white transition disabled:opacity-50 shadow-md hover:opacity-90 flex items-center`} style={{ backgroundColor: THEME.primary }}>
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
        <div className="animate-fade-in px-2 sm:px-0">
          <div className="text-center mb-8">
            <h2 className="text-2xl font-bold" style={{ color: THEME.primary }}>Pick Date & Time</h2>
            <p className="text-sm font-bold mt-2" style={{ color: THEME.gold }}>(ဘိုကင်ရယူလိုသော နေ့ရက် နှင့် အချိန် ကို ရွေးချယ် ပါ)</p>
          </div>
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 mb-6">
            <label className="block mb-2 text-sm font-bold flex items-center" style={{ color: THEME.primary }}><Calendar className="w-4 h-4 mr-2" style={{ color: THEME.primary }} /> Select Date</label>
            <input type="date" min={minDateStr} max={maxDateStr} value={formData.date} onChange={(e) => setFormData({ ...formData, date: e.target.value, time: '' })} className="w-full p-4 border border-gray-200 rounded-lg focus:outline-none focus:border-[#D4AF37] text-gray-800 bg-gray-50 mb-6" />
            
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
          <div className="mt-8 flex justify-between"><button type="button" onClick={() => handleNextStep(2)} className="px-6 py-4 rounded-lg font-bold text-gray-600 bg-white border border-gray-300 hover:bg-gray-50 transition">BACK</button><button type="button" disabled={!formData.date || !formData.time.trim()} onClick={() => handleNextStep(4)} className="px-8 py-4 rounded-lg font-bold text-white transition disabled:opacity-50 shadow-md hover:opacity-90" style={{ backgroundColor: THEME.primary }}>CONTINUE</button></div>
        </div>
      )}

      {/* STEP 4: CONFIRM */}
      {step === 4 && (
        <form onSubmit={handleSubmit} className="animate-fade-in pb-10 px-2 sm:px-0">
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
              {formData.isVvipUpgrade && !formData.selectedItem?.vvipIncluded && (
                <div className="flex justify-between items-start pt-2 border-t border-gray-50">
                  <div className="font-bold flex items-center text-sm" style={{ color: THEME.gold }}><Crown className="w-4 h-4 mr-2" style={{ color: THEME.gold }}/>VVIP Room Extra Fee</div>
                  <div className="font-bold text-sm" style={{ color: THEME.gold }}>+{formatPrice((Number(formData.selectedItem?.vvipPrice) || 0) - (Number(formData.selectedItem?.price) || 0))}</div>
                </div>
              )}
              {formData.selectedItem?.vvipIncluded && (<div className="flex justify-between items-start pt-2 border-t border-gray-50"><div className="font-bold text-green-600 flex items-center text-sm"><Crown className="w-4 h-4 mr-2 text-green-500"/>VVIP Master Room</div><div className="font-bold text-green-600 text-sm bg-green-50 px-2 py-0.5 rounded">Included (Free)</div></div>)}
              <div className="flex items-center text-sm font-bold text-gray-700 pt-2 border-t border-gray-50"><User className="w-4 h-4 mr-2" style={{ color: THEME.gold }} /> {formData.therapist ? formData.therapist.name : 'Any Available Therapist'}</div>
              <div className="flex items-center text-sm font-bold text-gray-700"><Calendar className="w-4 h-4 mr-2" style={{ color: THEME.gold }} /> {formData.date} at {formData.time}</div>
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

// ==========================================
// COMPONENT: TherapistsGallery
// ==========================================
export function TherapistsGallery({ appData }: { appData: AppData }) {
  return (
    <div className="max-w-4xl mx-auto px-4 pb-20 animate-fade-in">
      <div className="text-center mb-10">
        <h2 className="text-2xl font-bold text-[#123524] mb-2 font-serif">Our Professionals</h2>
        <div className="w-16 h-1 bg-[#D4AF37] mx-auto rounded-full mb-4"></div>
        <p className="text-sm text-gray-500 max-w-md mx-auto leading-relaxed">Experience ultimate relaxation with our certified and highly skilled therapists.</p>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6">
        {appData.therapists.map((t) => (
          <div key={t.id} className="bg-white rounded-2xl overflow-hidden shadow-sm hover:shadow-xl transition-all duration-300 border border-gray-100 group">
            <div className="aspect-[3/4] relative overflow-hidden bg-gray-50">
              {t.images.length > 0 ? (
                <>
                  <img src={t.images[0]} alt={t.name} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" />
                  <div className="absolute inset-0 bg-gradient-to-t from-[#123524]/90 via-transparent to-transparent opacity-80"></div>
                </>
              ) : (
                <div className="w-full h-full flex items-center justify-center text-gray-300"><ImageIcon className="w-10 h-10 opacity-20"/></div>
              )}
              {/* Badge */}
              <div className="absolute top-2 left-2 w-7 h-7 rounded-full bg-[#D4AF37] text-white flex items-center justify-center font-bold text-xs shadow-md border border-[#D4AF37]/50">{t.order + 1}</div>
              
              <div className="absolute bottom-0 left-0 right-0 p-4 text-center">
                 <h3 className="font-bold text-white text-lg drop-shadow-md">{t.name}</h3>
                 {t.images.length > 1 && <span className="text-[9px] text-[#D4AF37] font-bold tracking-widest uppercase mt-1 block drop-shadow-sm flex items-center justify-center"><ImageIcon className="w-2.5 h-2.5 mr-1"/>{t.images.length} Photos</span>}
              </div>
            </div>
            {t.images.length > 1 && (
              <div className="p-3 bg-white grid grid-cols-4 gap-2">
                {t.images.slice(1, 5).map((img, idx) => (
                  <div key={idx} className="aspect-square rounded-lg overflow-hidden border border-gray-100 cursor-pointer hover:border-[#D4AF37] transition">
                    <img src={img} alt={`${t.name} ${idx+2}`} className="w-full h-full object-cover" />
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ==========================================
// COMPONENT: CustomerDashboard 
// ==========================================
export function CustomerDashboard({ appData, onBookTherapist }: { appData: AppData, onBookTherapist: (t: TherapistProfile) => void }) {
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
      let activeServiceName = '';
      
      bookings.forEach(b => {
          if (b.status === 'cancelled' || b.status === 'completed') return;
          if (b.date !== todayStr) return;
          if (b.therapist !== tName) return;

          if (b.status === 'in_progress' && b.startTimeMillis) {
               isCurrentlyActive = true;
               activeServiceName = b.service.split('(')[0].trim();
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
          return { 
              label: 'In Service (Active)', 
              mm: 'ဝန်ဆောင်မှုပေးနေပါသည်', 
              color: 'bg-orange-100 text-orange-700 border-orange-200',
              activeService: activeServiceName
          };
      }

      let is24hFull = false;
      if (blockedNow.has("7:00 AM to 7:00 AM (Next Day)")) { is24hFull = true; } 
      else if (blockedNow.has("7:00 AM to 7:00 PM") && blockedNow.has("7:00 PM to 7:00 AM (Next Day)")) { is24hFull = true; }

      if (is24hFull) return { label: 'Fully Booked (Day & Night)', mm: 'နေ့ရောညပါ ပြည့်နေပါပြီ', color: 'bg-red-100 text-red-700 border-red-200' };

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
    <div className="animate-fade-in px-2 sm:px-0">
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
                       {t.images && t.images.length > 0 ? <img src={t.images[0]} className="w-full h-full object-cover" /> : <User className="w-full h-full p-2 text-gray-400 bg-gray-100" />}
                   </div>
                   <div className="flex-1">
                       <h3 className="font-bold text-gray-800 text-sm mb-1">{t.name}</h3>
                       <div className={`px-2 py-1.5 inline-block rounded border text-[9px] sm:text-[10px] font-bold leading-tight ${status.color}`}>
                          {status.label}
                          {status.activeService && (
                              <span className="block mt-0.5 text-orange-900 border-t border-orange-200/60 pt-0.5">
                                 {status.activeService}
                              </span>
                          )}
                          <span className="font-semibold opacity-90 block mt-0.5">{status.mm}</span>
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
                             {t.images && t.images.length > 0 ? <img src={t.images[0]} className="w-full h-full object-cover" /> : <User className="w-full h-full p-6 text-gray-400 opacity-50" />}
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

// ==========================================
// COMPONENT: CustomerHistory
// ==========================================
export function CustomerHistory({ userPhone, onLoginSuccess }: { userPhone: string, onLoginSuccess: (phone: string) => void }) {
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
    <div className="animate-fade-in px-2 sm:px-0">
      <div className="text-center mb-8"><h2 className="text-2xl font-bold" style={{ color: THEME.primary }}>Booking History</h2><p className="text-sm font-bold mt-2" style={{ color: THEME.gold }}>(သင်၏ ဘိုကင်မှတ်တမ်းများ)</p></div>
      {bookings.length === 0 ? (
        <div className="bg-white p-10 rounded-2xl shadow-sm border border-gray-100 text-center text-gray-500 font-bold">ဘိုကင်မှတ်တမ်း မရှိသေးပါ။</div>
      ) : (
        <div className="space-y-4">
          {bookings.map(b => {
             const isExpanded = expandedBookingId === b.id;
             return (
               <div key={b.id} className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden transition-all duration-300">
                  <div className="p-5 flex justify-between items-center cursor-pointer hover:bg-gray-50" onClick={() => setExpandedBookingId(isExpanded ? null : b.id!)}>
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
                        <div className="text-[10px] text-gray-400 mt-1 flex items-center">{isExpanded ? <><ChevronUp className="w-3 h-3 mr-1"/> Less</> : <><ChevronDown className="w-3 h-3 mr-1"/> More</>}</div>
                     </div>
                  </div>
                  {isExpanded && (
                     <div className="p-5 border-t border-gray-100 bg-gray-50 animate-fade-in">
                        <div className="grid grid-cols-2 gap-4 mb-4">
                           <div className="bg-white p-3 rounded-lg border border-gray-100"><span className="text-[10px] uppercase font-bold text-gray-400 block mb-1">THERAPIST</span><span className="text-sm font-bold text-gray-800">{b.therapist}</span></div>
                           <div className="bg-white p-3 rounded-lg border border-gray-100"><span className="text-[10px] uppercase font-bold text-gray-400 block mb-1">DURATION / EXTRA</span><span className="text-sm font-bold text-gray-800">{b.service.split('(')[1] ? '(' + b.service.split('(').slice(1).join('(') : '-'}</span></div>
                           <div className="bg-white p-3 rounded-lg border border-gray-100"><span className="text-[10px] uppercase font-bold text-gray-400 block mb-1">TXID</span><span className="text-sm font-mono font-bold text-gray-800 tracking-widest">{b.txId}</span></div>
                           <div className="bg-white p-3 rounded-lg border border-gray-100"><span className="text-[10px] uppercase font-bold text-gray-400 block mb-1">PAYMENT</span><span className="text-sm font-bold text-gray-800">{b.paymentMethod}</span></div>
                        </div>
                        {b.specialRequest && <div className="bg-white p-3 rounded-lg border border-gray-100 mb-4"><span className="text-[10px] uppercase font-bold text-gray-400 block mb-1">SPECIAL REQUEST NOTE</span><span className="text-sm text-gray-700 italic">{b.specialRequest}</span></div>}
                        <div className="flex justify-between items-center text-xs text-gray-400 font-semibold px-1"><span>Booked: {new Date(b.createdAt).toLocaleDateString()}</span><span className="text-[#123524] text-sm">Total: {formatPrice(b.totalPrice)}</span></div>
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

// ==========================================
// COMPONENT: CustomerProfile
// ==========================================
export function CustomerProfile({ userPhone, onLoginSuccess, onLogout }: { userPhone: string, onLoginSuccess: (phone: string) => void, onLogout: () => void }) {
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
    <div className="animate-fade-in max-w-sm mx-auto px-4 sm:px-0">
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

// ==========================================
// COMPONENT: AuthRequest
// ==========================================
export function AuthRequest({ onLoginSuccess, title }: { onLoginSuccess: (phone: string) => void, title: string }) {
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
    <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-200 max-w-sm mx-auto text-center mt-10 animate-fade-in px-4 sm:px-8">
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
