import React, { useState, useEffect, useRef, useMemo } from 'react';
import { collection, addDoc, getDocs, updateDoc, doc, query, onSnapshot, where, orderBy, limit } from 'firebase/firestore';
import { db } from '../firebase';
import { encryptText, decryptText } from '../security'; 

import { Calendar, Clock, CreditCard, CheckCircle, User, Phone, ChevronRight, ChevronLeft, Check, Sparkles, Droplets, Scissors, Home, ChevronDown, ChevronUp, History, UserCircle, CalendarPlus, ImageIcon, Activity, Crown, Copy, Percent, AlertCircle, KeyRound, BarChart2, Edit, LogOut, X, Trash2, Award, Star, ShieldCheck, Gift, Target, Info, MessageCircle } from 'lucide-react';
import { THEME, AppData, Booking, MenuItem, TherapistProfile, UserProfile, formatPrice } from '../shared';

const FALLBACK_VIP_SETTINGS = {
  isActive: true,
  rules: [
    "ပွိုင့်သက်တမ်းနှင့် Renew ပြုလုပ်ခြင်း: Customer များ စုဆောင်းထားသော ပွိုင့်များ၏ သက်တမ်းမှာ (၆) လ ဖြစ်ပါသည်။ ၆ လ တစ်ကြိမ် ပွိုင့်များကို Renew ပြုလုပ်မည် (အသစ်ပြန်လည် စတင်မည်) ဖြစ်ပါသည်။",
    "(၆) လ ကာလအတွင်း VIP အဆင့် တစ်ခုခုသို့ ရောက်ရှိရန် လိုအပ်သော ပွိုင့်အရေအတွက် မပြည့်မီပါက (၆) လ ပြည့်သည့်နေ့တွင် ပွိုင့်များ သုညမှ ပြန်လည်စတင်မည် ဖြစ်ပါသည်။",
    "VIP Member အဆင့်သို့ ရောက်ရှိသွားပါက အမြဲတမ်း Discount ခံစားခွင့်မှာမူ ပွိုင့် Renew လုပ်သည်နှင့် သက်ဆိုင်ခြင်းမရှိဘဲ ဆက်လက် တည်ရှိနေမည် ဖြစ်ပါသည်။",
    "ကတ်ပျောက်ဆုံးခြင်း: ကတ်ပျောက်ဆုံး၊ ပျက်စီးပါက ဝန်ဆောင်ခ ၁၅,၀၀၀ ကျပ်ဖြင့် အသစ်ပြန်လည် ထုတ်ပေးပါမည်။ ယခင်စုဆောင်းထားသော ပွိုင့်များ အပြည့်အဝ ပြန်လည်ရရှိမည် ဖြစ်ပါသည်။",
    "လွှဲပြောင်းအသုံးပြုခွင့်: VIP Member Card အား မိတ်ဆွေသူငယ်ချင်းများနှင့် မျှဝေသုံးစွဲခွင့်ရှိပြီး၊ လိုအပ်ပါက ဝန်ထမ်းများမှ ဖုန်းနံပါတ် တိုက်ဆိုင်စစ်ဆေးခြင်း ပြုလုပ်နိုင်ပါသည်။",
    "The Shangri-La Men's Retreat မှ ဤ Membership Program ၏ စည်းကမ်းချက်များကို ကြိုတင်အကြောင်းကြားခြင်းမရှိဘဲ ပြင်ဆင်ပြောင်းလဲခွင့် ရှိပါသည်။"
  ],
  tiers: [
    { id: 't1', name: 'Jade Elite Member', requiredPoints: 50, discountPercent: 10, instantUpgrade: '၈ သိန်းကျပ်', colorTheme: '#00A86B' },
    { id: 't2', name: 'Imperial Gold VIP', requiredPoints: 100, discountPercent: 15, instantUpgrade: '၁၅ သိန်းကျပ်', colorTheme: '#D4AF37' },
    { id: 't3', name: 'Shangri-La Signature V-VIP', requiredPoints: 150, discountPercent: 20, instantUpgrade: '၂၅ သိန်းကျပ်', colorTheme: '#1E1E1E' }
  ]
};

const ICON_MAP: Record<string, any> = { massage: Sparkles, scrub: Droplets, waxing: Scissors, hotel: Home, facial: Droplets, manicure: Scissors, pedicure: Scissors };

const ALL_TIME_SLOTS = ["6:00 AM", "6:30 AM", "7:00 AM", "7:30 AM", "8:00 AM", "8:30 AM", "9:00 AM", "9:30 AM", "10:00 AM", "10:30 AM", "11:00 AM", "11:30 AM", "12:00 PM", "12:30 PM", "1:00 PM", "1:30 PM", "2:00 PM", "2:30 PM", "3:00 PM", "3:30 PM", "4:00 PM", "4:30 PM", "5:00 PM", "5:30 PM", "6:00 PM", "6:30 PM", "7:00 PM", "7:30 PM", "8:00 PM", "8:30 PM", "9:00 PM", "9:30 PM", "10:00 PM", "10:30 PM", "11:00 PM"];

const getLocalTodayStr = () => { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
export const getTomorrowStr = () => { const d = new Date(); d.setDate(d.getDate() + 1); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };

export const getFixedServiceDetails = (serviceName: string | undefined | null) => {
    if (!serviceName) return null;
    const name = serviceName.toLowerCase();
    if (name.includes("half day")) return { start: "6:00 AM", end: "12:00 PM", nextDay: false };
    if (name.includes("whole day")) return { start: "7:00 AM", end: "7:00 PM", nextDay: false };
    if (name.includes("whole night")) return { start: "8:00 PM", end: "8:00 AM", nextDay: true };
    if (name.includes("day & night") || name.includes("24hr") || name.includes("24 hr")) return { start: "7:00 AM", end: "7:00 AM", nextDay: true };
    return null;
};

export const calculateTimeDiff = (startStr: string, endStr: string, isNextDay: boolean) => {
    const getMins = (tStr: string) => {
        const match = tStr.match(/(\d+):(\d+)\s+(AM|PM)/i);
        if(!match) return 0;
        let h = parseInt(match[1]); const m = parseInt(match[2]);
        if(match[3].toUpperCase() === 'PM' && h < 12) h += 12;
        if(match[3].toUpperCase() === 'AM' && h === 12) h = 0;
        return h * 60 + m;
    };
    let startMins = getMins(startStr); let endMins = getMins(endStr);
    if (isNextDay) endMins += 24 * 60;
    if (endMins < startMins) endMins += 24 * 60; 
    const diff = endMins - startMins; const hrs = Math.floor(diff / 60); const mins = diff % 60;
    if (hrs === 0) return `${mins} မိနစ်`;
    return `${hrs} နာရီ ${mins > 0 ? mins + ' မိနစ်' : ''}`;
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
    if (!dateStr) return blocked;
    const [y, m, d] = dateStr.split('-');
    if (!y || !m || !d) return blocked;
    const dateObj = new Date(Number(y), Number(m) - 1, Number(d));
    const startOfDay = dateObj.setHours(0, 0, 0, 0); const endOfDay = dateObj.setHours(23, 59, 59, 999);
    if (endTimeMillis <= startOfDay || startTimeMillis >= endOfDay) return blocked;
    ALL_TIME_SLOTS.forEach(slot => {
        if (slot.includes("to")) return; 
        const slotTime = new Date(Number(y), Number(m) - 1, Number(d));
        const [time, ampm] = slot.split(' ');
        let [sh, sm] = time.split(':').map(Number);
        if (ampm === 'PM' && sh < 12) sh += 12; if (ampm === 'AM' && sh === 12) sh = 0;
        slotTime.setHours(sh, sm, 0, 0);
        const slotTimeMillis = slotTime.getTime();
        const nextSlotTimeMillis = slotTimeMillis + (30 * 60 * 1000); 
        if ((startTimeMillis < nextSlotTimeMillis) && (endTimeMillis > slotTimeMillis)) { blocked.add(slot); }
    });
    return blocked;
}

export function getSlotsFromTimeText(t: string, neededSlotsByDuration: number): string[] {
    if (!t) return [];
    if (t.includes("to")) {
        const [start, endRaw] = t.split(" to ");
        const end = endRaw ? endRaw.replace(" (Next Day)", "") : "";
        const sIdx = ALL_TIME_SLOTS.indexOf(start.trim());
        let eIdx = ALL_TIME_SLOTS.indexOf(end.trim());
        if (endRaw && (endRaw.includes("Next Day") || (eIdx !== -1 && eIdx <= sIdx))) { eIdx = ALL_TIME_SLOTS.length; }
        const slots = [];
        if (sIdx !== -1) { for (let i = sIdx; i < eIdx; i++) { if (ALL_TIME_SLOTS[i]) slots.push(ALL_TIME_SLOTS[i]); } }
        return slots;
    } else {
        const sIdx = ALL_TIME_SLOTS.indexOf(t.trim());
        const slots = [];
        if (sIdx !== -1) { for (let i = 0; i < neededSlotsByDuration; i++) { if (ALL_TIME_SLOTS[sIdx + i]) slots.push(ALL_TIME_SLOTS[sIdx + i]); } }
        return slots;
    }
}

export function getBookingCoveredSlots(b: Booking): string[] {
    if (!b) return [];
    const serviceLower = (b.service || '').toLowerCase();
    const isNight = serviceLower.includes('night') || serviceLower.includes('24 hour') || serviceLower.includes('day and night');
    let slots: string[] = [];

    if (b.status === 'in_progress' && b.startTimeMillis) {
        let end = Math.max(Date.now(), b.expectedEndTimeMillis || Date.now());
        if (isNight) {
            const d = new Date(b.startTimeMillis); d.setDate(d.getDate() + 1); d.setHours(8, 0, 0, 0); 
            end = Math.max(end, d.getTime());
        }
        slots = Array.from(getSlotsCoveredByInterval(b.startTimeMillis, end, b.date || ''));
    } else if (b.time) {
        if (isNight) {
            const startStr = b.time.split(" to ")[0].trim();
            let sIdx = ALL_TIME_SLOTS.indexOf(startStr);
            if (sIdx === -1) sIdx = ALL_TIME_SLOTS.indexOf(b.time.trim());
            if (sIdx !== -1) { for (let i = sIdx; i < ALL_TIME_SLOTS.length; i++) { slots.push(ALL_TIME_SLOTS[i]); } }
        } else if (b.time.includes("to")) {
            const [start, endRaw] = b.time.split(" to ");
            const end = endRaw ? endRaw.replace(" (Next Day)", "").trim() : "";
            const sIdx = ALL_TIME_SLOTS.indexOf(start.trim());
            let eIdx = ALL_TIME_SLOTS.indexOf(end);
            if (endRaw && (endRaw.includes("Next Day") || (eIdx !== -1 && eIdx <= sIdx))) { eIdx = ALL_TIME_SLOTS.length; }
            if (sIdx !== -1) { for (let i = sIdx; i < eIdx; i++) { if (ALL_TIME_SLOTS[i]) slots.push(ALL_TIME_SLOTS[i]); } }
        } else {
            let neededSlots = 2; const match = (b.service || '').match(/(\d+)\s*Mins/i);
            if (match) neededSlots = Math.ceil(parseInt(match[1]) / 30);
            const sIdx = ALL_TIME_SLOTS.indexOf(b.time.trim());
            if (sIdx !== -1) { for (let i = 0; i < neededSlots; i++) { if (ALL_TIME_SLOTS[sIdx + i]) slots.push(ALL_TIME_SLOTS[sIdx + i]); } }
        }
    }
    return slots;
}

const parsePoints = (pts: any) => {
    if (pts === undefined || pts === null) return 0;
    if (typeof pts === 'number') return pts;
    const dec = decryptText(pts);
    const val = parseInt(dec || pts, 10);
    return isNaN(val) ? 0 : val;
};

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

export function CustomAlert({ message, title = "Shangrila Online Booking", onClose }: { message: string, title?: string, onClose: () => void }) {
  if (!message) return null;
  return (
    <div className="fixed inset-0 z-[9999] bg-black/60 flex items-center justify-center p-4 animate-fade-in" style={{ animationDuration: '0.2s' }}>
      <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full overflow-hidden transform transition-all scale-100 animate-slide-up">
        <div className="bg-[#123524] p-4 flex items-center justify-between">
          <h3 className="text-[#D4AF37] font-bold text-sm flex items-center"><AlertCircle className="w-4 h-4 mr-2" /> {title}</h3>
          <button onClick={onClose} className="text-white hover:text-red-400 transition"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-6 text-center">
          <p className="text-gray-700 text-sm font-semibold leading-relaxed mb-6">{message}</p>
          <button onClick={onClose} className="w-full py-3 bg-[#D4AF37] text-white rounded-lg font-bold shadow-md hover:bg-yellow-600 transition">OK</button>
        </div>
      </div>
    </div>
  );
}

// ==========================================
// AUTH REQUEST (LOGIN & FORGOT PASSWORD)
// ==========================================
export function AuthRequest({ 
  onLoginSuccess, 
  title, 
  prefilledPhone = '', 
  skipToPassword = false 
}: { 
  onLoginSuccess: (phone: string) => void, 
  title: string, 
  prefilledPhone?: string, 
  skipToPassword?: boolean 
}) {
  const [phone, setPhone] = useState(prefilledPhone);
  const [password, setPassword] = useState('');
  const [contactInfo, setContactInfo] = useState('');
  const [step, setStep] = useState(skipToPassword ? 2 : 1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const handleNext = async (e: React.FormEvent) => {
    e.preventDefault(); setError(''); setSuccessMsg(''); setLoading(true);
    try {
      const snap = await getDocs(collection(db, 'users'));
      let found = false; let userPass = '';
      snap.forEach(d => {
         try {
             const data = d.data(); const decPhone = decryptText(data.phone) || d.id;
             if (decPhone === phone.trim() || d.id === phone.trim()) {
                found = true; userPass = decryptText(data.password);
             }
         } catch(err) {}
      });
      if (!found) { setError("ဖုန်းနံပါတ် ရှာမတွေ့ပါ။ ဘိုကင်အရင်တင်ပေးပါခင်ဗျာ။"); }
      else {
        if (userPass) { setStep(2); } else { onLoginSuccess(phone.trim()); }
      }
    } catch (e) { setError("Network Error"); }
    finally { setLoading(false); }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault(); setError(''); setLoading(true);
    try {
      const snap = await getDocs(collection(db, 'users'));
      let userPass = '';
      snap.forEach(d => {
         try {
             const data = d.data(); const decPhone = decryptText(data.phone) || d.id;
             if (decPhone === phone.trim() || d.id === phone.trim()) { userPass = decryptText(data.password); }
         } catch(err){}
      });
      if (userPass === password) { onLoginSuccess(phone.trim()); }
      else { setError("Password မှားယွင်းနေပါသည်။"); }
    } catch (e) { setError("Network Error"); }
    finally { setLoading(false); }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
     e.preventDefault();
     if(!contactInfo.trim()) { setError('ဆက်သွယ်ရန် Viber သို့မဟုတ် Telegram အကောင့် ဖြည့်ပေးပါ။'); return; }
     setLoading(true); setError(''); setSuccessMsg('');
     try {
         const snap = await getDocs(collection(db, 'users'));
         let targetId = null;
         snap.forEach(d => {
             const decPhone = decryptText(d.data().phone) || d.id;
             if (decPhone === phone.trim() || d.id === phone.trim()) targetId = d.id;
         });
         if (targetId) {
             await updateDoc(doc(db, 'users', targetId), { 
                 resetRequested: true,
                 resetContact: encryptText(contactInfo.trim()) 
             });
             setSuccessMsg('Admin ထံသို့ စကားဝှက်အသစ်တောင်းဆိုမှု ပို့ပြီးပါပြီ။ မကြာမီ ဆက်သွယ်ပေးပါမည်။');
             setTimeout(() => { setStep(1); setSuccessMsg(''); setContactInfo(''); setPassword(''); }, 6000);
         }
     } catch (e) { setError('Error requesting reset.'); }
     setLoading(false);
  };

  return (
    <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-200 max-w-sm mx-auto text-center mt-10 animate-fade-in px-4 sm:px-8">
      <div className="w-16 h-16 bg-gray-100 rounded-full mx-auto flex items-center justify-center mb-6 text-[#123524]"><KeyRound className="w-8 h-8" /></div>
      <h2 className="text-xl font-bold text-gray-800 mb-2">{step === 3 ? 'Reset Password' : 'Login Required'}</h2>
      <p className="text-xs font-bold text-gray-500 mb-6">{step === 3 ? 'Admin ထံသို့ စကားဝှက်အသစ် တောင်းဆိုရန်' : `${title}`}</p>

      {step === 1 && (
        <form onSubmit={handleNext} className="space-y-4">
          <input required type="tel" placeholder="Enter Phone Number" value={phone} onChange={e => setPhone(e.target.value)} className="w-full p-3 bg-gray-50 border border-gray-200 rounded-lg outline-none focus:border-[#D4AF37] font-bold text-center tracking-wider" />
          {error && <div className="text-xs font-bold text-red-500">{error}</div>}
          <button type="submit" disabled={loading} className="w-full py-3 bg-[#123524] text-white rounded-lg font-bold shadow-md hover:bg-green-900">{loading ? 'Checking...' : 'Next'}</button>
        </form>
      )}
      
      {step === 2 && (
        <form onSubmit={handleLogin} className="space-y-4 flex flex-col">
          <input required type="password" placeholder="Enter Password" value={password} onChange={e => setPassword(e.target.value)} className="w-full p-3 bg-gray-50 border border-gray-200 rounded-lg outline-none focus:border-[#D4AF37] font-bold text-center tracking-wider" />
          {error && <div className="text-xs font-bold text-red-500">{error}</div>}
          <button type="submit" disabled={loading} className="w-full py-3 bg-[#123524] text-white rounded-lg font-bold shadow-md hover:bg-green-900">{loading ? 'Logging in...' : 'Login'}</button>
          
          <button type="button" onClick={() => { setStep(3); setError(''); setSuccessMsg(''); }} disabled={loading} className="text-xs text-blue-600 underline font-bold mt-4 hover:text-blue-800">
             စကားဝှက်မေ့နေပါသလား? (Forgot Password)
          </button>
        </form>
      )}

      {step === 3 && (
        <form onSubmit={handleResetPassword} className="space-y-4 flex flex-col">
          <div className="text-left">
             <label className="block text-xs font-bold text-gray-600 mb-1">ဆက်သွယ်ရန် (Viber သို့မဟုတ် Telegram ဖုန်းနံပါတ်)</label>
             <div className="relative">
                 <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none"><MessageCircle className="w-4 h-4 text-gray-400" /></div>
                 <input required type="text" placeholder="e.g. 09-xxxxxxxxx (Viber)" value={contactInfo} onChange={e => setContactInfo(e.target.value)} className="w-full pl-10 pr-3 py-3 bg-gray-50 border border-gray-200 rounded-lg outline-none focus:border-[#D4AF37] font-bold text-sm" />
             </div>
          </div>
          {error && <div className="text-xs font-bold text-red-500">{error}</div>}
          {successMsg && <div className="text-xs font-bold text-green-600 bg-green-50 p-3 rounded-lg border border-green-200">{successMsg}</div>}
          
          {!successMsg && <button type="submit" disabled={loading} className="w-full py-3 bg-red-600 text-white rounded-lg font-bold shadow-md hover:bg-red-700 flex justify-center items-center">{loading ? 'Sending...' : 'Request New Password'}</button>}
          <button type="button" onClick={() => setStep(2)} disabled={loading} className="text-xs text-gray-500 underline font-bold mt-2 hover:text-gray-700">Cancel & Go Back</button>
        </form>
      )}
    </div>
  );
}

// ==========================================
// VIEWS & COMPONENTS
// ==========================================
export function VipProgramView({ appData, onGoToProfile }: { appData: AppData, onGoToProfile?: () => void }) {
   const vipSettings = appData.vipSettings && Object.keys(appData.vipSettings).length > 0 ? appData.vipSettings : FALLBACK_VIP_SETTINGS;
   if (!vipSettings || !vipSettings.isActive) return <div className="text-center py-20 text-gray-400 font-bold text-sm">VIP Program is currently unavailable.</div>;
   const sortedTiers = [...vipSettings.tiers].sort((a,b) => a.requiredPoints - b.requiredPoints);
   const baseRule = (vipSettings as any).baseRuleText || "သုံးစွဲငွေ ၃၅,၀၀၀ ကျပ် လျှင် = ၁ ပွိုင့် (1 Point)";
   const preJadeTxt = (vipSettings as any).preJadeText || "Jade Member မဖြစ်မီ (၅၀) ပွိုင့် စုဆောင်းနေစဉ်ကာလအတွင်း (၁)လ အတွင်း ပြည့်မီသော Points များအတွက် အထူး Discount ကို ထပ်ဆောင်းပေးအပ်ပါသည်။";
   const preJadeRws = (vipSettings as any).preJadeRewards || ['10 Pts = 10% Off', '20 Pts = 20% Off', '30 Pts = 30% Off', '40 Pts = 40% Off', '50 Pts = 50% Off'];
   const cumulativeTxt = (vipSettings as any).cumulativeText || "Member အဆင့်များကို အဆင့်မြှင့်တင်ရာတွင် ပွိုင့်များကို သုညမှ ပြန်မစဘဲ ရှိပြီးသားပွိုင့်များအပေါ်တွင် ဆက်လက်ပေါင်းထည့်ပေးမည့် စနစ်ကို အသုံးပြုထားပါသည်။";
   const instantUpgTxt = (vipSettings as any).instantUpgradeText || "(တစ်ကြိမ်တည်းဝယ်ယူမှုပြုလုပ်သူများအနေဖြင့် မိမိဝယ်ယူထားသည့်ငွေပမာဏအတိုင်း မိမိကြိုက်နှစ်သက်ရာ Service သို့မဟုတ် Package ကို မိမိဝယ်ယူထားသည့် Member အဆင့်ခံစားခွင့်နှင့်အညီ (၃)လအတွင်း ပြန်လည်သုံးစွဲနိုင်သည်။)";
   const bdayStd = (vipSettings as any).birthdayStandardText || "မည်သည့် VIP (Jade, Gold, Imperial) မဆို မိမိမွေးနေ့တွင် မည်သည့် Service ကိုမဆို 50% Discount ခံစားခွင့်ရရှိမည်။";
   const bdayImp = (vipSettings as any).birthdayImperialText || "အခြေခံ 20% + မွေးနေ့လတွင် ရရှိထားသော Points အရေအတွက် % ။";

   return (
       <div className="max-w-md mx-auto animate-fade-in pb-20">
           <div className="bg-[#123524] text-white p-8 rounded-b-[40px] shadow-lg text-center relative overflow-hidden">
               <div className="absolute top-0 right-0 w-32 h-32 bg-white opacity-5 rounded-full -mr-10 -mt-10 blur-xl"></div>
               <div className="absolute bottom-0 left-0 w-24 h-24 bg-[#D4AF37] opacity-10 rounded-full -ml-8 -mb-8 blur-lg"></div>
               <Award className="w-14 h-14 mx-auto mb-4 text-[#D4AF37] drop-shadow-md animate-pulse" />
               <h2 className="text-2xl font-bold tracking-wider" style={{ color: '#D4AF37' }}>VIP MEMBERSHIP</h2>
               <p className="text-[10px] font-bold mt-2 uppercase tracking-widest text-gray-300">Exclusive Privileges Program</p>
               <div className="mt-6 inline-flex flex-col items-center bg-black/20 p-3 rounded-xl border border-white/10">
                   <span className="text-[10px] font-bold uppercase text-[#D4AF37] mb-1 tracking-widest">Base Rule</span>
                   <span className="text-xs font-semibold text-white">{baseRule}</span>
               </div>
           </div>

           <div className="px-5 mt-8 space-y-8">
               <section>
                   <h3 className="font-bold text-[#123524] text-base mb-4 flex items-center"><Star className="w-5 h-5 mr-2 text-[#D4AF37]"/> Member အဆင့်များနှင့် ခံစားခွင့်များ</h3>
                   <div className="space-y-4">
                       {sortedTiers.map(tier => (
                           <div key={tier.id} className="relative rounded-2xl p-5 overflow-hidden shadow-sm border border-gray-100 transition-all hover:shadow-md" style={{ backgroundColor: tier.colorTheme, color: tier.colorTheme === '#D4AF37' ? '#123524' : '#fff' }}>
                               <div className="absolute top-0 right-0 w-24 h-24 bg-white opacity-[0.08] rounded-full -mr-5 -mt-5"></div>
                               <div className="flex justify-between items-center relative z-10 mb-4 border-b border-white/20 pb-3">
                                   <div><h4 className="font-bold text-[17px] tracking-wide">{tier.name}</h4><p className="text-[11px] mt-1 opacity-90 font-semibold">{tier.requiredPoints} Points Required</p></div>
                                   <div className="text-right"><div className="text-3xl font-black">{tier.discountPercent}%</div><div className="text-[9px] uppercase font-bold tracking-widest mt-0.5 opacity-80">Discount</div></div>
                               </div>
                               <div className="relative z-10 flex items-center justify-between text-[11px] font-semibold bg-black/10 px-3 py-2 rounded-lg">
                                   <span className="opacity-90">တစ်ကြိမ်တည်း ဝယ်ယူပါက</span><span className="font-bold">{tier.instantUpgrade}</span>
                               </div>
                           </div>
                       ))}
                   </div>
               </section>

               <section>
                   <div className="bg-gradient-to-br from-[#123524] to-[#1a4a32] rounded-2xl p-5 shadow-sm text-white relative overflow-hidden">
                       <Target className="absolute -right-4 -bottom-4 w-24 h-24 text-white opacity-5" />
                       <h3 className="font-bold text-[#D4AF37] text-sm mb-3 flex items-center relative z-10">လစဉ် Target Rewards (Pre-Jade)</h3>
                       <p className="text-[11px] text-gray-300 leading-relaxed mb-4 relative z-10 font-semibold">{preJadeTxt}</p>
                       <ul className="space-y-2 relative z-10">
                           {preJadeRws.map((r: string, i: number) => (
                               <li key={i} className="flex justify-between items-center bg-white/10 px-3 py-2 rounded-lg text-xs font-bold border border-white/5">
                                   <span>{r.split('=')[0]}</span><span className="text-[#D4AF37]">{r.split('=')[1]} (၁ ကြိမ်)</span>
                               </li>
                           ))}
                       </ul>
                   </div>
               </section>

               <section className="bg-yellow-50 border border-yellow-200 rounded-2xl p-5">
                   <h3 className="font-bold text-[#123524] text-sm mb-2 flex items-center"><Info className="w-4 h-4 mr-2 text-yellow-600"/> Cumulative Upgrade System</h3>
                   <p className="text-[11px] text-gray-700 leading-relaxed font-semibold mb-4">{cumulativeTxt}</p>
                   <div className="bg-white border border-[#D4AF37]/40 shadow-sm rounded-xl p-4 relative overflow-hidden">
                       <div className="absolute top-0 left-0 w-1.5 h-full bg-[#D4AF37]"></div>
                       <p className="text-[11px] text-gray-700 leading-relaxed font-semibold"><span className="text-[#123524] font-bold block mb-1">💡 အထူးသတိပြုရန် -</span>{instantUpgTxt}</p>
                   </div>
               </section>

               <section>
                   <h3 className="font-bold text-[#123524] text-sm mb-4 flex items-center"><Gift className="w-5 h-5 mr-2 text-red-500"/> မွေးနေ့ အထူးခံစားခွင့်များ</h3>
                   <div className="space-y-3">
                       <div className="bg-red-50 border border-red-100 rounded-xl p-4 flex items-start">
                           <div className="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0 mr-3 mt-0.5"><Star className="w-4 h-4 text-red-500"/></div>
                           <div><h4 className="font-bold text-[#123524] text-xs">Standard Birthday Bonus</h4><p className="text-[11px] text-gray-600 mt-1 font-semibold leading-relaxed whitespace-pre-line">{bdayStd}</p></div>
                       </div>
                       <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 flex items-start text-white">
                           <div className="w-8 h-8 rounded-full bg-gray-800 flex items-center justify-center flex-shrink-0 mr-3 mt-0.5"><Crown className="w-4 h-4 text-[#D4AF37]"/></div>
                           <div><h4 className="font-bold text-[#D4AF37] text-xs">Imperial V-VIP သီးသန့်ခံစားခွင့်</h4><p className="text-[11px] text-gray-400 mt-1 font-semibold leading-relaxed whitespace-pre-line">{bdayImp}</p></div>
                       </div>
                   </div>
               </section>

               <section className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm">
                   <h3 className="font-bold text-[#123524] text-sm mb-4 flex items-center"><ShieldCheck className="w-4 h-4 mr-2 text-[#D4AF37]"/> Membership Terms & Conditions</h3>
                   <ul className="space-y-3">
                       {vipSettings.rules.map((rule, idx) => (
                           <li key={idx} className="flex items-start text-[11px] text-gray-600 leading-relaxed font-semibold">
                               <ChevronRight className="w-3 h-3 mr-1.5 mt-0.5 text-[#D4AF37] flex-shrink-0" />{rule}
                           </li>
                       ))}
                   </ul>
               </section>

               <div className="text-center pt-6 pb-8 border-t border-gray-200">
                   <div className="w-12 h-1 bg-gray-200 mx-auto rounded-full mb-4"></div>
                   <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest mb-2">Check Your Points</p>
                   <p className="text-xs text-gray-600 font-semibold mb-5 px-4 leading-relaxed">မိမိ၏ လက်ရှိ Point များကို မိမိ၏ Profile တွင် အချိန်မရွေး ဝင်ရောက်စစ်ဆေးနိုင်ပါသည်။</p>
                   {onGoToProfile && (
                       <button onClick={onGoToProfile} className="inline-flex items-center justify-center px-6 py-3 bg-[#123524] text-[#D4AF37] font-bold text-xs rounded-full shadow-md hover:shadow-lg transition transform hover:-translate-y-0.5">
                           <UserCircle className="w-4 h-4 mr-2" /> Point စစ်ရန် (Go to Profile)
                       </button>
                   )}
               </div>
           </div>
       </div>
   );
}

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
                  <img src={t.images[0]} alt={t.name} loading="lazy" className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" />
                  <div className="absolute inset-0 bg-gradient-to-t from-[#123524]/90 via-transparent to-transparent opacity-80"></div>
                </>
              ) : (
                <div className="w-full h-full flex items-center justify-center text-gray-300"><ImageIcon className="w-10 h-10 opacity-20"/></div>
              )}
              <div className="absolute top-2 left-2 w-7 h-7 rounded-full bg-[#D4AF37] text-white flex items-center justify-center font-bold text-xs shadow-md border border-[#D4AF37]/50">{t.order + 1}</div>
              <div className="absolute bottom-0 left-0 right-0 p-4 text-center">
                 <h3 className="font-bold text-white text-lg drop-shadow-md">{t.name}</h3>
                 {t.images.length > 1 && <span className="text-[9px] text-[#D4AF37] font-bold tracking-widest uppercase mt-1 block drop-shadow-sm flex items-center justify-center"><ImageIcon className="w-2.5 h-2.5 mr-1"/>{t.images.length} Photos</span>}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function CustomerDashboard({ appData, onBookTherapist }: { appData: AppData, onBookTherapist: (t: TherapistProfile) => void }) {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [viewingDetails, setViewingDetails] = useState<TherapistProfile | null>(null);
  const todayStr = getLocalTodayStr();
  const [now, setNow] = useState(new Date());

  useEffect(() => {
     const timer = setInterval(() => setNow(new Date()), 60000); 
     return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const q = query(collection(db, 'bookings'), where('date', '>=', todayStr));
    const unsub = onSnapshot(q, (snap) => {
        const arr: Booking[] = [];
        snap.forEach(d => {
            const raw = d.data();
            arr.push({ id: d.id, ...raw, name: decryptText(raw.name), phone: decryptText(raw.phone), txId: decryptText(raw.txId), specialRequest: decryptText(raw.specialRequest) } as Booking);
        });
        setBookings(arr);
    });
    return () => unsub();
  }, [todayStr]);

  const getNextSlotTime = (slot: string) => {
      if (slot.includes("to")) return slot.split(" to ")[1];
      const idx = ALL_TIME_SLOTS.indexOf(slot);
      if (idx !== -1 && idx < ALL_TIME_SLOTS.length - 1) return ALL_TIME_SLOTS[idx + 1];
      if (idx === ALL_TIME_SLOTS.length - 1) return "11:30 PM";
      return slot;
  };

  const generateTimeline = (therapistName: string) => {
      const tBookings = bookings.filter(b => b.therapist === therapistName && b.date === todayStr && b.status !== 'cancelled' && b.status !== 'completed');
      const coveredMap = new Map<string, { service: string, status: string }>();

      tBookings.forEach(b => {
           const cleanServiceName = (b.service || '').split('(')[0].trim();
           const coveredSlots = getBookingCoveredSlots(b);
           coveredSlots.forEach(slot => { coveredMap.set(slot, { service: cleanServiceName, status: 'Booked' }); });
           
           if (coveredSlots.length > 0) {
               const firstIdx = ALL_TIME_SLOTS.indexOf(coveredSlots[0]);
               if (firstIdx > 0 && !coveredMap.has(ALL_TIME_SLOTS[firstIdx - 1])) { coveredMap.set(ALL_TIME_SLOTS[firstIdx - 1], { service: 'နားချိန် (Rest)', status: 'Buffer' }); }
               const lastIdx = ALL_TIME_SLOTS.indexOf(coveredSlots[coveredSlots.length - 1]);
               if (lastIdx !== -1 && lastIdx < ALL_TIME_SLOTS.length - 1 && !coveredMap.has(ALL_TIME_SLOTS[lastIdx + 1])) { coveredMap.set(ALL_TIME_SLOTS[lastIdx + 1], { service: 'နားချိန် (Rest)', status: 'Buffer' }); }
           }
      });

      const rawSlots = ALL_TIME_SLOTS.map(slot => {
          const covered = coveredMap.get(slot);
          if (covered) return { slot, state: covered.status, service: covered.service };
          const [timePart, ampm] = slot.split(' ');
          let [h, m] = timePart.split(':').map(Number);
          if (ampm === 'PM' && h < 12) h += 12; if (ampm === 'AM' && h === 12) h = 0;
          const slotTime = new Date(); slotTime.setHours(h, m, 0, 0);
          if (slotTime <= now) return { slot, state: 'Past', service: '' };
          return { slot, state: 'Available', service: '' };
      });

      const merged = [];
      if (rawSlots.length === 0) return [];
      let currentBlock = { startSlot: rawSlots[0].slot, endSlot: rawSlots[0].slot, state: rawSlots[0].state, service: rawSlots[0].service };

      for (let i = 1; i < rawSlots.length; i++) {
          const curr = rawSlots[i];
          if (curr.state === currentBlock.state && curr.service === currentBlock.service) { currentBlock.endSlot = curr.slot; } 
          else { merged.push(currentBlock); currentBlock = { startSlot: curr.slot, endSlot: curr.slot, state: curr.state, service: curr.service }; }
      }
      merged.push(currentBlock);

      return merged.map(b => {
          let endTime = getNextSlotTime(b.endSlot);
          if (b.state === 'Booked') {
             const matchingNB = tBookings.find(bk => (bk.service || '').split('(')[0].trim() === b.service);
             if (matchingNB) {
                 if (matchingNB.time && matchingNB.time.includes("Next Day")) { endTime = "8:00 AM (Next Day)"; } 
                 else if (matchingNB.status === 'in_progress' && matchingNB.expectedEndTimeMillis) {
                     const endD = new Date(matchingNB.expectedEndTimeMillis);
                     if (endD.getHours() === 8 && endD.getDate() !== new Date().getDate()) { endTime = "8:00 AM (Next Day)"; }
                 }
             }
          }
          return { ...b, endTime };
      });
  };

  const getTherapistStatus = (tName: string) => {
      let blockedNow = new Set<string>();
      let isCurrentlyActive = false; let activeServiceName = ''; let upcomingServices: string[] = []; let hasNightBooking = false;
      const currentHour = now.getHours(); const isPast6PM = currentHour >= 18;
      
      bookings.forEach(b => {
          if (b.status === 'cancelled' || b.status === 'completed' || b.date !== todayStr || b.therapist !== tName) return;
          const cleanServiceName = (b.service || '').split('(')[0].trim();
          const serviceLower = cleanServiceName.toLowerCase();
          const isNight = serviceLower.includes('night') || serviceLower.includes('24 hour') || serviceLower.includes('day and night');
          const coveredSlots = getBookingCoveredSlots(b);
          
          if (coveredSlots.length > 0) {
              coveredSlots.forEach(slot => blockedNow.add(slot));
              const firstIdx = ALL_TIME_SLOTS.indexOf(coveredSlots[0]);
              if (firstIdx > 0) blockedNow.add(ALL_TIME_SLOTS[firstIdx - 1]); 
              const lastIdx = ALL_TIME_SLOTS.indexOf(coveredSlots[coveredSlots.length - 1]);
              if (lastIdx !== -1 && lastIdx < ALL_TIME_SLOTS.length - 1) blockedNow.add(ALL_TIME_SLOTS[lastIdx + 1]); 
          }

          if (b.status === 'in_progress') {
               isCurrentlyActive = true; activeServiceName = cleanServiceName;
               if (isNight || (b.expectedEndTimeMillis && new Date(b.expectedEndTimeMillis).getHours() === 8 && new Date(b.expectedEndTimeMillis).getDate() !== new Date().getDate())) { hasNightBooking = true; }
          } else {
               if (coveredSlots.some(slot => {
                   const [timePart, ampm] = slot.split(' ');
                   let [h, m] = timePart.split(':').map(Number);
                   if (ampm === 'PM' && h < 12) h += 12; if (ampm === 'AM' && h === 12) h = 0;
                   const slotTime = new Date(); slotTime.setHours(h, m, 0, 0);
                   return slotTime > now;
               })) {
                   if (!upcomingServices.includes(cleanServiceName)) { upcomingServices.push(cleanServiceName); }
                   if (isNight) hasNightBooking = true;
               }
          }
      });

      const finalServiceName = upcomingServices.join('၊ '); 
      if (isCurrentlyActive) return { label: 'In Service (Active)', mm: 'ဝန်ဆောင်မှုပေးနေပါသည်', color: 'bg-orange-100 text-orange-700 border-orange-200', activeService: activeServiceName };
      if (upcomingServices.length > 0 || hasNightBooking) {
          if (hasNightBooking) {
              if (isPast6PM) return { label: 'Fully Booked For Today', mm: 'ဒီနေ့အတွက် ဘိုကင်ပြည့်သွားပါပြီ', color: 'bg-red-100 text-red-700 border-red-200', activeService: '' };
              return { label: 'Night Full / Day Available', mm: finalServiceName ? `${finalServiceName} ဘိုကင်ယူထားပါသည်။ နေ့ပိုင်းရပါသေးသည်။` : 'ညပိုင်းပြည့်၊ နေ့ပိုင်းရပါသေးတယ်', color: 'bg-yellow-100 text-yellow-700 border-yellow-200', activeService: '' };
          }
          let mmText = finalServiceName ? `${finalServiceName} ဘိုကင်ယူထားပါသည်` : 'အချိန်တချို့ ယူထားပါတယ်';
          return { label: 'Partially Booked', mm: mmText, color: 'bg-blue-100 text-blue-700 border-blue-200', activeService: '' }; 
      }

      let futureSlotsTotal = 0; let futureSlotsBooked = 0;
      const endLimitIdx = ALL_TIME_SLOTS.indexOf("11:00 PM");
      for (let i = 0; i <= endLimitIdx; i++) {
          const slot = ALL_TIME_SLOTS[i]; const [timePart, ampm] = slot.split(' ');
          let [h, m] = timePart.split(':').map(Number);
          if (ampm === 'PM' && h < 12) h += 12; if (ampm === 'AM' && h === 12) h = 0;
          const slotTime = new Date(); slotTime.setHours(h, m, 0, 0);
          if (slotTime > now) { futureSlotsTotal++; if (blockedNow.has(slot)) futureSlotsBooked++; }
      }
      
      const isShopFull = futureSlotsTotal > 0 && futureSlotsBooked === futureSlotsTotal;
      if (isShopFull || (futureSlotsTotal === 0 && hasNightBooking)) return { label: 'Fully Booked For Today', mm: 'ဒီနေ့အတွက် ဘိုကင်ပြည့်သွားပါပြီ', color: 'bg-red-100 text-red-700 border-red-200', activeService: '' };
      return { label: 'Available Now', mm: 'အားပါတယ်', color: 'bg-green-100 text-green-700 border-green-200', activeService: '' };
  };

  const bookingCounts: Record<string, number> = {};
  bookings.forEach(b => { if (b.status !== 'cancelled') { bookingCounts[b.therapist] = (bookingCounts[b.therapist] || 0) + 1; } });
  const top5Therapists = [...appData.therapists].sort((a, b) => {
     const countA = bookingCounts[a.name] || 0; const countB = bookingCounts[b.name] || 0;
     if (countA !== countB) return countB - countA; 
     return (a.order || 0) - (b.order || 0);
  }).slice(0, 5);

  return (
    <div className="animate-fade-in px-2 sm:px-0 relative">
       {viewingDetails && (
           <div className="fixed inset-0 z-[9999] bg-black/60 flex items-center justify-center p-4 animate-fade-in" onClick={() => setViewingDetails(null)}>
               <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden flex flex-col max-h-[85vh] animate-slide-up" onClick={e => e.stopPropagation()}>
                   <div className="bg-[#123524] p-4 flex items-center justify-between">
                       <div className="flex items-center">
                           {viewingDetails.images[0] ? <img src={viewingDetails.images[0]} loading="lazy" className="w-10 h-10 rounded-full object-cover mr-3 border border-[#D4AF37]"/> : <User className="w-10 h-10 rounded-full p-2 bg-gray-100 text-gray-400 mr-3"/>}
                           <div><h3 className="text-[#D4AF37] font-bold text-sm tracking-wide">{viewingDetails.name}'s Schedule</h3><p className="text-[10px] text-gray-300 font-semibold mt-0.5">Today ({getLocalTodayStr()})</p></div>
                       </div>
                       <button onClick={() => setViewingDetails(null)} className="text-white hover:text-red-400 transition bg-white/10 hover:bg-white/20 p-1.5 rounded-full"><X className="w-5 h-5"/></button>
                   </div>
                   <div className="p-4 overflow-y-auto flex-1 bg-gray-50 space-y-2">
                       {generateTimeline(viewingDetails.name).map((block, idx) => (
                            <div key={idx} className={`p-3 rounded-xl border flex items-center justify-between shadow-sm transition-colors ${block.state === 'Available' ? 'bg-green-50 border-green-200' : block.state === 'Booked' ? 'bg-blue-50 border-blue-200' : block.state === 'Buffer' ? 'bg-orange-50 border-orange-200' : 'bg-gray-100 border-gray-200 opacity-60'}`}>
                                <div className="text-xs font-mono font-bold text-gray-700 w-[45%]">{block.startSlot} - {block.endTime}</div>
                                <div className="w-[55%] flex justify-end">
                                    {block.state === 'Available' && <span className="text-green-700 font-bold text-[10px] uppercase flex items-center"><CheckCircle className="w-3 h-3 mr-1"/> အားပါသည်</span>}
                                    {block.state === 'Booked' && <span className="text-blue-700 font-bold text-[10px] uppercase leading-tight flex items-center text-right"><span className="w-1.5 h-1.5 rounded-full bg-blue-500 mr-1.5 animate-pulse"></span> {block.service}</span>}
                                    {block.state === 'Buffer' && <span className="text-orange-600 font-bold text-[10px] uppercase leading-tight flex items-center text-right"><Clock className="w-3 h-3 mr-1"/> {block.service}</span>}
                                    {block.state === 'Past' && <span className="text-gray-500 font-bold text-[10px] uppercase flex items-center"><Clock className="w-3 h-3 mr-1"/> ကျော်လွန်သွားပါပြီ</span>}
                                </div>
                            </div>
                       ))}
                   </div>
               </div>
           </div>
       )}

       <div className="text-center mb-8">
         <h2 className="text-2xl font-bold" style={{ color: THEME.primary }}>Today's Availability</h2>
         <p className="text-sm font-bold mt-2" style={{ color: THEME.gold }}>(ဒီနေ့အတွက် ဝန်ထမ်းများ၏ ဘိုကင် အခြေအနေ)</p>
       </div>
       <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {appData.therapists.map(t => {
             const status = getTherapistStatus(t.name);
             const isAvailable = status.label === 'Available Now';
             const isPartiallyBooked = status.label === 'Partially Booked' || status.label === 'In Service (Active)';
             const isFullyBooked = status.label.includes('Fully Booked');

             return (
                <div key={t.id} className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex items-center hover:shadow-md transition">
                   <div className={`w-16 h-20 rounded-lg overflow-hidden flex-shrink-0 mr-3 sm:mr-4 border object-cover ${isAvailable ? 'border-green-200' : isPartiallyBooked ? 'border-blue-200' : isFullyBooked ? 'border-red-200 grayscale opacity-80' : 'border-orange-200'}`}>
                       {t.images && t.images.length > 0 ? <img src={t.images[0]} loading="lazy" className="w-full h-full object-cover object-top" /> : <User className="w-full h-full p-2 text-gray-400 bg-gray-100" />}
                   </div>
                   <div className="flex-1">
                       <h3 className="font-bold text-gray-800 text-sm mb-1">{t.name}</h3>
                       <div className={`px-2 py-1.5 inline-block rounded border text-[9px] sm:text-[10px] font-bold leading-tight ${status.color}`}>
                          <span className="block pb-1 mb-1 border-b" style={{ borderColor: 'currentColor', opacity: 0.85 }}>{status.label}</span>
                          {status.activeService && (<span className="block pb-1 mb-1 border-b text-current opacity-90 leading-snug" style={{ borderColor: 'currentColor' }}>{status.activeService}</span>)}
                          <span className="font-semibold block opacity-90 leading-snug">{status.mm}</span>
                       </div>
                   </div>
                   <div className="flex flex-col space-y-2 ml-2 flex-shrink-0">
                       <button disabled={isFullyBooked} onClick={() => onBookTherapist(t)} className={`px-4 py-2 rounded-lg text-xs font-bold whitespace-nowrap shadow-sm flex items-center justify-center border transition-all ${isFullyBooked ? 'bg-red-500/60 text-white border-transparent cursor-not-allowed' : 'bg-[#123524] text-[#D4AF37] hover:bg-[#1a4a32] border-[#1a4a32]'}`}>Book Now</button>
                       <button onClick={() => setViewingDetails(t)} className="px-2 py-1.5 rounded-lg text-[10px] font-bold whitespace-nowrap shadow-sm flex items-center justify-center border transition-all bg-yellow-50 text-[#123524] hover:bg-yellow-100 border-yellow-200"><Clock className="w-3 h-3 mr-1" /> အချိန်ဇယား</button>
                   </div>
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
                 {top5Therapists.map((t, idx) => {
                     const status = getTherapistStatus(t.name);
                     const isFullyBooked = status.label.includes('Fully Booked');

                     return (
                         <div key={t.id} className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden flex flex-col relative hover:shadow-md transition">
                             <div className="absolute top-0 left-0 bg-yellow-500 text-white w-7 h-7 flex items-center justify-center rounded-br-lg font-bold text-xs z-10 shadow-sm border-r border-b border-yellow-600">{idx + 1}</div>
                             <div className={`w-full aspect-[3/4] bg-gray-100 relative ${isFullyBooked ? 'grayscale opacity-80' : ''}`}>
                                 {t.images && t.images.length > 0 ? <img src={t.images[0]} loading="lazy" className="w-full h-full object-cover object-top" /> : <User className="w-full h-full p-6 text-gray-400 opacity-50" />}
                             </div>
                             <div className="p-3 flex flex-col flex-1 justify-between bg-gray-50/50">
                                 <div className="font-bold text-gray-800 text-sm text-center mb-3 truncate px-1">{t.name}</div>
                                 <div className="flex flex-col space-y-2 mt-auto">
                                     <button disabled={isFullyBooked} onClick={() => onBookTherapist(t)} className={`w-full py-2 rounded-lg text-[10px] font-bold shadow-sm flex justify-center items-center border transition-all ${isFullyBooked ? 'bg-red-500/60 text-white border-transparent cursor-not-allowed' : 'bg-[#123524] text-[#D4AF37] hover:bg-[#1a4a32] border-[#1a4a32]'}`}>Book Now {!isFullyBooked && <ChevronRight className="w-3 h-3 ml-0.5"/>}</button>
                                     <button onClick={() => setViewingDetails(t)} className={`w-full py-1.5 rounded-lg text-[10px] font-bold shadow-sm flex justify-center items-center border transition-all ${isFullyBooked ? 'bg-gray-100 text-gray-500 border-gray-200 hover:bg-gray-200' : 'bg-yellow-50 text-[#123524] hover:bg-yellow-100 border-yellow-200'}`}><Clock className="w-3 h-3 mr-1"/> အချိန်ဇယား</button>
                                 </div>
                             </div>
                         </div>
                     );
                 })}
             </div>
         </div>
       )}
    </div>
  );
}

export function CustomerHistory({ userPhone, onLoginSuccess }: { userPhone: string, onLoginSuccess: (phone: string) => void }) {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedBookingId, setExpandedBookingId] = useState<string | null>(null);

  useEffect(() => {
    if (!userPhone) return;
    const fetchMyBookings = async () => {
      try {
        const q = query(collection(db, 'bookings'), orderBy('createdAt', 'desc'));
        const snap = await getDocs(q);
        const data: Booking[] = [];
        snap.forEach((doc) => {
          const raw = doc.data();
          const decPhone = decryptText(raw.phone) || raw.phone;
          if (decPhone === userPhone) {
              data.push({
                  id: doc.id, 
                  ...raw,
                  name: decryptText(raw.name),
                  phone: decPhone,
                  txId: decryptText(raw.txId),
                  specialRequest: decryptText(raw.specialRequest),
                  originalPrice: raw.originalPrice ? Number(decryptText(raw.originalPrice)) : undefined,
                  discountPercent: raw.discountPercent ? Number(decryptText(raw.discountPercent)) : undefined,
                  discountLabel: raw.discountLabel ? decryptText(raw.discountLabel) : undefined,
                  vipTierName: raw.vipTierName ? decryptText(raw.vipTierName) : undefined
              } as Booking);
          }
        });
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
                           <div className="font-bold text-gray-800 text-sm sm:text-base">{(b.service || '').split('(')[0]}</div>
                           <div className="text-xs text-gray-500 mt-1 flex items-center"><Calendar className="w-3 h-3 mr-1"/> {b.date} &nbsp; <Clock className="w-3 h-3 mx-1"/> {b.time}</div>
                        </div>
                     </div>
                     <div className="flex flex-col items-end">
                        <StatusBadge status={b.status} cancelReason={b.cancelReason} />
                        {b.originalPrice && b.originalPrice > b.totalPrice ? (
                            <div className="mt-2 text-right">
                               <div className="flex items-center justify-end space-x-1 mb-0.5"><span className="text-[9px] text-gray-400 line-through">{formatPrice(b.originalPrice)}</span><span className="text-[9px] font-bold text-red-500">-{b.discountPercent}%</span></div>
                               <div className="font-bold text-[#123524] text-sm">{formatPrice(b.totalPrice)}</div>
                            </div>
                        ) : (
                            <div className="font-bold mt-2 text-[#123524] text-sm">{formatPrice(b.totalPrice)}</div>
                        )}
                        <div className="text-[10px] text-gray-400 mt-1 flex items-center">{isExpanded ? <><ChevronUp className="w-3 h-3 mr-1"/> Less</> : <><ChevronDown className="w-3 h-3 mr-1"/> More</>}</div>
                     </div>
                  </div>
                  {isExpanded && (
                     <div className="p-5 border-t border-gray-100 bg-gray-50 animate-fade-in">
                        <div className="grid grid-cols-2 gap-4 mb-4">
                           <div className="bg-white p-3 rounded-lg border border-gray-100"><span className="text-[10px] uppercase font-bold text-gray-400 block mb-1">THERAPIST</span><span className="text-sm font-bold text-gray-800">{b.therapist}</span></div>
                           <div className="bg-white p-3 rounded-lg border border-gray-100"><span className="text-[10px] uppercase font-bold text-gray-400 block mb-1">DURATION / EXTRA</span><span className="text-sm font-bold text-gray-800">{(b.service || '').split('(')[1] ? '(' + (b.service || '').split('(').slice(1).join('(') : '-'}</span></div>
                           <div className="bg-white p-3 rounded-lg border border-gray-100"><span className="text-[10px] uppercase font-bold text-gray-400 block mb-1">TXID</span><span className="text-sm font-mono font-bold text-gray-800 tracking-widest">{b.txId}</span></div>
                           <div className="bg-white p-3 rounded-lg border border-gray-100"><span className="text-[10px] uppercase font-bold text-gray-400 block mb-1">PAYMENT</span><span className="text-sm font-bold text-gray-800">{b.paymentMethod}</span></div>
                        </div>
                        {b.discountLabel && (
                            <div className="bg-green-50 p-3 rounded-lg border border-green-100 mb-4 flex items-center">
                                <Award className="w-4 h-4 text-green-600 mr-2"/>
                                <div><span className="text-[10px] uppercase font-bold text-green-700 block mb-0.5">Applied Discount</span><span className="text-sm text-green-800 font-bold">{b.discountLabel}</span></div>
                            </div>
                        )}
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

export function CustomerProfile({ appData, userPhone, onLoginSuccess, onLogout }: { appData: AppData, userPhone: string, onLoginSuccess: (phone: string) => void, onLogout: () => void }) {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [userDocId, setUserDocId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [editMode, setEditMode] = useState(false);
  const [formData, setFormData] = useState({ name: '', password: '', dob: '' });
  const [saving, setSaving] = useState(false);
  const [alertMessage, setAlertMessage] = useState('');

  const [showHistory, setShowHistory] = useState(false);
  const [history, setHistory] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [userBookings, setUserBookings] = useState<any[]>([]);

  const vipSettings = appData.vipSettings && Object.keys(appData.vipSettings).length > 0 ? appData.vipSettings : FALLBACK_VIP_SETTINGS;

  useEffect(() => {
    if (!userPhone) return;
    const fetchBookings = async () => {
       try {
           const currentMonthPrefix = getLocalTodayStr().substring(0, 7);
           const snap = await getDocs(query(collection(db, 'bookings'), where('date', '>=', currentMonthPrefix + '-01')));
           const data: any[] = [];
           snap.forEach(d => {
               const raw = d.data();
               const decPhone = decryptText(raw.phone) || raw.phone;
               if (decPhone === userPhone) {
                   data.push({ status: raw.status, discountLabel: raw.discountLabel ? decryptText(raw.discountLabel) : undefined, date: raw.date });
               }
           });
           setUserBookings(data);
       } catch(e) {}
    };
    fetchBookings();
  }, [userPhone]);

  const fetchHistory = async () => {
      setLoadingHistory(true);
      try {
          const snap = await getDocs(collection(db, 'point_history'));
          const data: any[] = [];
          snap.forEach(doc => {
              const raw = doc.data();
              const decPhone = decryptText(raw.phone) || raw.phone;
              if (decPhone === userPhone) {
                  data.push({ id: doc.id, amount: Number(decryptText(raw.amount) || raw.amount), pointsEarned: Number(decryptText(raw.pointsEarned) || raw.pointsEarned), type: decryptText(raw.type) || raw.type, date: raw.date, createdAt: raw.createdAt });
              }
          });
          data.sort((a, b) => b.createdAt - a.createdAt);
          setHistory(data);
      } catch (e) { console.error(e); }
      setLoadingHistory(false);
  };

  useEffect(() => {
    if (!userPhone) return;
    const fetchUser = async () => {
      try {
          const snap = await getDocs(collection(db, 'users'));
          let foundUser = null;
          let docId = null;
          let maxPts = -1;
          
          snap.forEach(d => {
             const data = d.data();
             try {
                 const decPhone = decryptText(data.phone) || d.id;
                 if (decPhone === userPhone || d.id === userPhone) {
                     const pts = parsePoints(data.points);
                     if (pts > maxPts) { maxPts = pts; foundUser = data; docId = d.id; }
                 }
             } catch(e) {}
          });
          
          if (foundUser) {
              setProfile({ 
                  ...(foundUser as any), 
                  name: decryptText((foundUser as any).name) || '', 
                  password: decryptText((foundUser as any).password) || '', 
                  phone: userPhone,
                  points: maxPts,
                  dob: decryptText((foundUser as any).dob) || (foundUser as any).dob || ''
              });
              setFormData({ 
                  name: decryptText((foundUser as any).name) || '', 
                  password: decryptText((foundUser as any).password) || '',
                  dob: decryptText((foundUser as any).dob) || (foundUser as any).dob || ''
              });
              setUserDocId(docId);
          } else {
              setProfile({ name: 'Walk-in Guest', phone: userPhone, points: 0, dob: '', password: '' } as any);
              setFormData({ name: '', password: '', dob: '' });
          }
      } catch(err) {
          console.error("Error fetching profile", err);
      } finally {
          setLoading(false);
      }
    };
    
    const loadBackgroundHistory = async () => {
        try {
            const snap = await getDocs(collection(db, 'point_history'));
            const data: any[] = [];
            snap.forEach(doc => {
                const raw = doc.data();
                const decPhone = decryptText(raw.phone) || raw.phone;
                if (decPhone === userPhone) {
                    data.push({ id: doc.id, amount: Number(decryptText(raw.amount) || raw.amount), pointsEarned: Number(decryptText(raw.pointsEarned) || raw.pointsEarned), type: decryptText(raw.type) || raw.type, date: raw.date, createdAt: raw.createdAt });
                }
            });
            data.sort((a, b) => b.createdAt - a.createdAt);
            setHistory(data);
        } catch (e) {}
    };

    fetchUser();
    loadBackgroundHistory();
  }, [userPhone]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (userDocId) {
          await updateDoc(doc(db, 'users', userDocId), { 
              name: encryptText(formData.name), 
              password: encryptText(formData.password),
              dob: encryptText(formData.dob)
          });
      } else {
          const newDocRef = await addDoc(collection(db, 'users'), {
              phone: encryptText(userPhone),
              name: encryptText(formData.name),
              password: encryptText(formData.password),
              dob: encryptText(formData.dob),
              points: encryptText('0'),
              createdAt: Date.now()
          });
          setUserDocId(newDocRef.id);
      }
      setProfile({ ...profile!, name: formData.name, password: formData.password, dob: formData.dob } as any);
      setEditMode(false);
      setAlertMessage("Profile အောင်မြင်စွာ ပြင်ဆင်ပြီးပါပြီ။");
    } catch (e) { setAlertMessage("Error updating profile."); }
    setSaving(false);
  };

  if (!userPhone) return <AuthRequest onLoginSuccess={onLoginSuccess} title="View Profile" />;
  if (loading) return <div className="text-center py-10 font-bold text-gray-500">Loading Profile...</div>;

  const sortedTiers = [...(vipSettings.tiers || FALLBACK_VIP_SETTINGS.tiers)].sort((a,b) => a.requiredPoints - b.requiredPoints);
  const currentPoints = profile?.points || 0;
  
  let userTier = null; let nextTier = null;
  for (let i = 0; i < sortedTiers.length; i++) {
      if (currentPoints >= sortedTiers[i].requiredPoints) { userTier = sortedTiers[i]; }
      if (currentPoints < sortedTiers[i].requiredPoints && !nextTier) { nextTier = sortedTiers[i]; }
  }

  const progressPercent = nextTier ? Math.min(100, (currentPoints / nextTier.requiredPoints) * 100) : 100;
  const pointsNeeded = nextTier ? nextTier.requiredPoints - currentPoints : 0;

  const currentMonthPrefix = getLocalTodayStr().substring(0, 7);
  const monthlyPoints = history.filter(h => h.date && h.date.startsWith(currentMonthPrefix)).reduce((sum, h) => sum + h.pointsEarned, 0);
  
  const isBdayMonth = () => {
      if (!profile?.dob) return false;
      const dobParts = profile.dob.split('-');
      const currentParts = getLocalTodayStr().split('-');
      return dobParts[1] === currentParts[1];
  };

  return (
    <div className="animate-fade-in max-w-sm mx-auto px-4 sm:px-0">
      <CustomAlert message={alertMessage} onClose={() => setAlertMessage('')} />
      
      {showHistory && (
          <div className="fixed inset-0 z-[100] bg-black/60 flex items-end justify-center sm:items-center sm:p-4 animate-fade-in" onClick={() => setShowHistory(false)}>
              <div className="bg-white w-full sm:max-w-md rounded-t-3xl sm:rounded-2xl shadow-2xl overflow-hidden flex flex-col h-[85vh] sm:h-auto sm:max-h-[85vh] animate-slide-up" onClick={e => e.stopPropagation()}>
                  <div className="bg-[#123524] p-5 flex items-center justify-between sticky top-0 z-10 shadow-sm">
                      <h3 className="text-[#D4AF37] font-bold text-base flex items-center"><History className="w-5 h-5 mr-2" /> Points History</h3>
                      <button onClick={() => setShowHistory(false)} className="text-white hover:text-red-400 transition bg-white/10 hover:bg-white/20 p-1.5 rounded-full"><X className="w-5 h-5"/></button>
                  </div>
                  <div className="p-4 overflow-y-auto flex-1 bg-gray-50 space-y-3 pb-8">
                      {loadingHistory ? (
                          <div className="text-center py-10 text-gray-500 font-bold text-sm animate-pulse">Loading History...</div>
                      ) : history.length === 0 ? (
                          <div className="text-center py-10 text-gray-400 font-bold text-sm">Point ရရှိထားသော မှတ်တမ်းမရှိသေးပါ။</div>
                      ) : (
                          history.map((h, i) => (
                              <div key={i} className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex items-center justify-between hover:border-[#D4AF37]/50 transition">
                                  <div className="flex items-center">
                                      <div className={`w-10 h-10 rounded-full flex items-center justify-center mr-3 ${h.type.includes('Online') ? 'bg-blue-50 text-blue-500' : 'bg-green-50 text-green-500'}`}>
                                          {h.type.includes('Online') ? <CalendarPlus className="w-5 h-5"/> : <Home className="w-5 h-5"/>}
                                      </div>
                                      <div>
                                          <div className="font-bold text-[#123524] text-sm">{h.type}</div>
                                          <div className="text-[10px] text-gray-500 mt-0.5">{new Date(h.createdAt).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })}</div>
                                          <div className="text-[10px] font-semibold text-gray-600 mt-1">Amount: {formatPrice(h.amount)}</div>
                                      </div>
                                  </div>
                                  <div className="text-right">
                                      <div className="text-lg font-black text-green-600">+{h.pointsEarned}</div>
                                      <div className="text-[9px] font-bold text-gray-400 uppercase tracking-widest mt-0.5">Points</div>
                                  </div>
                              </div>
                          ))
                      )}
                  </div>
              </div>
          </div>
      )}

      <div className="text-center mb-6"><h2 className="text-2xl font-bold" style={{ color: THEME.primary }}>My Profile</h2></div>

      <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200 text-center mb-6">
        <div className="w-20 h-20 bg-gray-100 rounded-full mx-auto flex items-center justify-center mb-4 text-[#D4AF37] relative shadow-sm">
            {userTier ? <Crown className="w-10 h-10" style={{ color: userTier.colorTheme }} /> : <User className="w-10 h-10" />}
        </div>

        {!editMode ? (
          <>
            <h3 className="text-xl font-bold text-gray-800">{profile?.name || 'Walk-in Guest'}</h3>
            <p className="text-sm font-bold text-gray-500 mt-1 mb-4 flex items-center justify-center"><Phone className="w-4 h-4 mr-1" /> {profile?.phone}</p>
            
            {userTier && (
                <div className="mb-6 inline-flex items-center px-4 py-1.5 rounded-full text-xs font-bold text-white shadow-sm border border-white/20" style={{ backgroundColor: userTier.colorTheme }}>
                    <Award className="w-4 h-4 mr-1.5"/> {userTier.name} ({userTier.discountPercent}%)
                </div>
            )}
            
            <div className="grid grid-cols-2 gap-3 mb-6">
                <div className="bg-gradient-to-br from-yellow-50 to-yellow-100 border border-yellow-200 rounded-xl p-4 flex flex-col items-center justify-center shadow-sm relative overflow-hidden group">
                    <Star className="w-16 h-16 absolute -top-4 -right-4 text-yellow-500 opacity-10 group-hover:scale-110 transition-transform" />
                    <span className="text-[10px] text-yellow-700 font-bold uppercase tracking-widest flex items-center mb-1"><Star className="w-3 h-3 mr-1"/> My VIP Points</span>
                    <span className="text-3xl font-black text-[#123524] mb-3">{currentPoints}</span>
                    <button onClick={() => { setShowHistory(true); fetchHistory(); }} className="px-4 py-1.5 bg-yellow-200 text-yellow-800 rounded-full text-[10px] font-bold shadow-sm hover:bg-yellow-300 transition flex items-center">
                        <History className="w-3 h-3 mr-1"/> View History
                    </button>
                </div>

                <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 flex flex-col items-center justify-center shadow-sm">
                    <span className="text-[10px] text-blue-600 font-bold uppercase tracking-widest flex items-center mb-1"><Gift className="w-3 h-3 mr-1"/> Birthday</span>
                    <span className="text-sm font-bold text-blue-900 mt-1">{(profile as any)?.dob ? new Date((profile as any).dob).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }) : 'Not Set'}</span>
                </div>
            </div>

            <div className="bg-white border border-gray-200 rounded-xl p-5 mb-6 shadow-sm relative overflow-hidden text-left">
                <h4 className="text-xs font-bold text-gray-800 mb-3 flex items-center"><Target className="w-4 h-4 mr-1.5 text-[#D4AF37]"/> VIP Progress</h4>
                {nextTier ? (
                    <>
                        <div className="flex justify-between items-end mb-1.5">
                            <span className="text-[10px] font-bold text-gray-500">Current: {currentPoints} Pts</span>
                            <span className="text-[10px] font-bold text-[#D4AF37] text-right max-w-[120px] truncate" title={nextTier.name}>{nextTier.name} ({nextTier.requiredPoints} Pts)</span>
                        </div>
                        <div className="w-full h-2.5 bg-gray-100 rounded-full overflow-hidden">
                            <div className="h-full rounded-full bg-gradient-to-r from-yellow-400 to-[#D4AF37] transition-all duration-1000 ease-out" style={{ width: `${progressPercent}%` }}></div>
                        </div>
                        <p className="text-[10px] text-gray-500 font-semibold mt-2.5 text-center leading-relaxed">
                            <span className="font-bold text-[#123524]">{nextTier.name}</span> ဖြစ်ရန် လိုအပ်သော ပွိုင့်: <span className="font-bold text-red-500">{pointsNeeded} Pts</span>
                        </p>
                    </>
                ) : (
                    <div className="text-center p-2 border-b border-gray-100 mb-4 pb-4">
                        <Crown className="w-8 h-8 text-[#D4AF37] mx-auto mb-2" />
                        <p className="text-xs font-bold text-[#123524] leading-relaxed">ဂုဏ်ယူပါသည်။ သင်သည် အမြင့်ဆုံး VIP အဆင့်သို့ ရောက်ရှိနေပါပြီ။</p>
                    </div>
                )}

                <div className="mt-4 p-3 bg-gray-50 rounded-lg border border-gray-100 flex justify-between items-center">
                    <span className="text-[11px] font-bold text-gray-600 flex items-center"><Calendar className="w-3.5 h-3.5 mr-1.5 text-gray-400"/> ယခုလအတွင်း စုဆောင်းထားသောပွိုင့်</span>
                    <span className="text-sm font-black text-[#123524]">{monthlyPoints} Pts</span>
                </div>

                {isBdayMonth() && userTier && (
                    <div className="mt-3 p-4 bg-blue-50 border border-blue-200 rounded-xl">
                        <h5 className="text-[11px] font-bold text-blue-800 mb-2 flex items-center"><Gift className="w-4 h-4 mr-1.5"/> Birthday Month Bonus</h5>
                        <p className="text-[10px] text-blue-700 font-semibold mb-3 leading-relaxed">ယခုလသည် သင့်မွေးနေ့လဖြစ်သောကြောင့် အထူးခံစားခွင့် ရရှိနေပါသည်။</p>
                        {(userTier.name.toLowerCase().includes('imperial') || userTier.name.toLowerCase().includes('v-vip')) ? (
                            <div className="flex justify-between items-center bg-white p-2.5 rounded-lg border border-blue-100 shadow-sm">
                                <span className="text-[10px] text-gray-600 font-bold">Base (20%) + Monthly ({monthlyPoints}%)</span>
                                <span className="text-sm font-black text-blue-600">{Math.min(100, 20 + monthlyPoints)}% OFF</span>
                            </div>
                        ) : (
                            <div className="flex justify-between items-center bg-white p-2.5 rounded-lg border border-blue-100 shadow-sm">
                                <span className="text-[10px] text-gray-600 font-bold">VIP Standard Birthday</span>
                                <span className="text-sm font-black text-blue-600">50% OFF</span>
                            </div>
                        )}
                    </div>
                )}

                {!userTier && (() => {
                    const nextTarget = Math.floor(monthlyPoints / 10) * 10 + 10; 
                    const actualTarget = nextTarget > 50 ? 50 : nextTarget;
                    const ptsNeededForTarget = actualTarget - monthlyPoints;
                    const basePoint = actualTarget - 10;
                    const targetProgressPercent = ((monthlyPoints - basePoint) / 10) * 100;
                    const possibleTiers = [10, 20, 30, 40];
                    const availableRewards: number[] = []; const usedRewards: number[] = [];
                    
                    possibleTiers.forEach(tier => {
                        if (monthlyPoints >= tier) {
                            const rewardLabel = `Pre-Jade Target Bonus (${tier}%)`;
                            const isUsed = userBookings.some(b => b.discountLabel === rewardLabel && b.date && b.date.startsWith(currentMonthPrefix) && b.status !== 'cancelled');
                            if (isUsed) { usedRewards.push(tier); } else { availableRewards.push(tier); }
                        }
                    });

                    return (
                        <div className="mt-4 pt-4 border-t border-gray-100 animate-fade-in">
                            <div className="mb-4">
                                <h5 className="text-[11px] font-bold text-[#123524] mb-3 flex items-center"><Target className="w-3 h-3 mr-1 text-green-600"/> Monthly Target Rewards (Pre-Jade)</h5>
                                <div className="flex justify-between items-end mb-1.5">
                                    <span className="text-[9px] font-bold text-gray-500">Target Bonus: {actualTarget}% Off</span>
                                    <span className="text-[9px] font-bold text-green-600">{actualTarget} Pts</span>
                                </div>
                                <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden mb-2">
                                    <div className="h-full rounded-full bg-green-500 transition-all duration-1000 ease-out" style={{ width: `${targetProgressPercent}%` }}></div>
                                </div>
                                <p className="text-[9px] text-gray-500 font-semibold text-center"><span className="font-bold text-green-600">{actualTarget}% Off</span> ခံစားခွင့်ရရန် လိုအပ်သောပွိုင့်: <span className="font-bold text-red-500">{ptsNeededForTarget} Pts</span></p>
                            </div>

                            {(availableRewards.length > 0 || usedRewards.length > 0) && (
                                <div className="space-y-2 pt-2 border-t border-gray-100">
                                    <h5 className="text-[11px] font-bold text-[#123524] mb-3 flex items-center mt-2"><Award className="w-3 h-3 mr-1 text-[#D4AF37]"/> Target Rewards Status</h5>
                                    {availableRewards.map(tier => (
                                        <div key={`avail-${tier}`} className="bg-green-50 text-green-700 p-2.5 rounded-lg text-[10px] font-bold border border-green-200 flex items-center justify-between shadow-sm"><span className="flex items-center"><Gift className="w-3.5 h-3.5 mr-1.5 text-green-600"/> {tier}% Discount ခံစားခွင့်</span><span className="bg-green-100 px-2 py-1 rounded text-green-800 shadow-sm">၁ ကြိမ် ရရှိထားပါသည်</span></div>
                                    ))}
                                    {usedRewards.map(tier => (
                                        <div key={`used-${tier}`} className="bg-gray-50 text-gray-500 p-2.5 rounded-lg text-[10px] font-bold border border-gray-200 flex items-center justify-between opacity-75"><span className="flex items-center"><CheckCircle className="w-3.5 h-3.5 mr-1.5"/> {tier}% Discount ခံစားခွင့်</span><span className="bg-gray-200 px-2 py-1 rounded text-gray-600">အသုံးပြုပြီးပါပြီ</span></div>
                                    ))}
                                </div>
                            )}
                        </div>
                    );
                })()}
            </div>

            <div className={`text-[10px] rounded-full px-3 py-1.5 inline-block font-bold mb-6 w-full ${profile?.password ? 'text-green-600 bg-green-50' : 'text-gray-500 bg-gray-100'}`}>
              {profile?.password ? '✅ Account Secured (Password Set)' : '⚠️ No Password Set (Auto-Login)'}
            </div>
            <button onClick={() => setEditMode(true)} className="w-full py-3 bg-[#123524] text-white rounded-lg font-bold shadow-md hover:bg-green-900 transition flex justify-center items-center"><Edit className="w-4 h-4 mr-2" /> Edit Profile Details</button>
          </>
        ) : (
          <form onSubmit={handleSave} className="text-left space-y-4">
            <div><label className="block text-xs font-bold text-gray-500 mb-1">Full Name</label><input type="text" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} className="w-full p-3 bg-gray-50 border border-gray-200 rounded-lg outline-none focus:border-[#D4AF37]" required /></div>
            <div><label className="block text-xs font-bold text-gray-500 mb-1">Date of Birth (For Birthday Bonus)</label><input type="date" value={formData.dob} onChange={e => setFormData({ ...formData, dob: e.target.value })} className="w-full p-3 bg-gray-50 border border-gray-200 rounded-lg outline-none focus:border-[#D4AF37]" /></div>
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
