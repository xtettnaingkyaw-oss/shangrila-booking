import React, { useState, useEffect, useRef, useMemo } from 'react';
import { collection, addDoc, getDocs, updateDoc, doc, query, onSnapshot, where, orderBy, limit } from 'firebase/firestore';
import { db } from '../firebase';
import { encryptText, decryptText } from '../security'; 

import { Calendar, Clock, CreditCard, CheckCircle, User, Phone, ChevronRight, ChevronLeft, Check, Sparkles, Droplets, Scissors, Home, ChevronDown, ChevronUp, History, UserCircle, CalendarPlus, ImageIcon, Activity, Crown, Copy, Percent, AlertCircle, KeyRound, BarChart2, Edit, LogOut, X, Trash2, Award, Star, ShieldCheck, Gift, Target, Info, MessageCircle } from 'lucide-react';
import { THEME, AppData, Booking, MenuItem, TherapistProfile, UserProfile, formatPrice } from '../shared';

// ==========================================
// CONSTANTS & HELPERS
// ==========================================
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

// ==========================================
// COMMON UI COMPONENTS
// ==========================================
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
export function AuthRequest({ onLoginSuccess, title, prefilledPhone = '', skipToPassword = false }: { onLoginSuccess: (phone: string) => void, title: string, prefilledPhone?: string, skipToPassword?: boolean }) {
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
             if (decPhone === phone.trim() || d.id === phone.trim()) { found = true; userPass = decryptText(data.password); }
         } catch(err) {}
      });
      if (!found) { setError("ဖုန်းနံပါတ် ရှာမတွေ့ပါ။ ဘိုကင်အရင်တင်ပေးပါခင်ဗျာ။"); }
      else { if (userPass) { setStep(2); } else { onLoginSuccess(phone.trim()); } }
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
             await updateDoc(doc(db, 'users', targetId), { resetRequested: true, resetContact: encryptText(contactInfo.trim()) });
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
          <button type="button" onClick={() => { setStep(3); setError(''); setSuccessMsg(''); }} disabled={loading} className="text-xs text-blue-600 underline font-bold mt-4 hover:text-blue-800">စကားဝှက်မေ့နေပါသလား? (Forgot Password)</button>
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
              data.push({ id: doc.id, ...raw, name: decryptText(raw.name), phone: decPhone, txId: decryptText(raw.txId), specialRequest: decryptText(raw.specialRequest), originalPrice: raw.originalPrice ? Number(decryptText(raw.originalPrice)) : undefined, discountPercent: raw.discountPercent ? Number(decryptText(raw.discountPercent)) : undefined, discountLabel: raw.discountLabel ? decryptText(raw.discountLabel) : undefined, vipTierName: raw.vipTierName ? decryptText(raw.vipTierName) : undefined } as Booking);
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
               const raw = d.data(); const decPhone = decryptText(raw.phone) || raw.phone;
               if (decPhone === userPhone) { data.push({ status: raw.status, discountLabel: raw.discountLabel ? decryptText(raw.discountLabel) : undefined, date: raw.date }); }
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
              const raw = doc.data(); const decPhone = decryptText(raw.phone) || raw.phone;
              if (decPhone === userPhone) { data.push({ id: doc.id, amount: Number(decryptText(raw.amount) || raw.amount), pointsEarned: Number(decryptText(raw.pointsEarned) || raw.pointsEarned), type: decryptText(raw.type) || raw.type, date: raw.date, createdAt: raw.createdAt }); }
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
          let foundUser = null; let docId = null; let maxPts = -1;
          
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
              setProfile({ ...(foundUser as any), name: decryptText((foundUser as any).name) || '', password: decryptText((foundUser as any).password) || '', phone: userPhone, points: maxPts, dob: decryptText((foundUser as any).dob) || (foundUser as any).dob || '' });
              setFormData({ name: decryptText((foundUser as any).name) || '', password: decryptText((foundUser as any).password) || '', dob: decryptText((foundUser as any).dob) || (foundUser as any).dob || '' });
              setUserDocId(docId);
          } else {
              setProfile({ name: 'Walk-in Guest', phone: userPhone, points: 0, dob: '', password: '' } as any);
              setFormData({ name: '', password: '', dob: '' });
          }
      } catch(err) {} finally { setLoading(false); }
    };
    
    const loadBackgroundHistory = async () => {
        try {
            const snap = await getDocs(collection(db, 'point_history'));
            const data: any[] = [];
            snap.forEach(doc => {
                const raw = doc.data(); const decPhone = decryptText(raw.phone) || raw.phone;
                if (decPhone === userPhone) { data.push({ id: doc.id, amount: Number(decryptText(raw.amount) || raw.amount), pointsEarned: Number(decryptText(raw.pointsEarned) || raw.pointsEarned), type: decryptText(raw.type) || raw.type, date: raw.date, createdAt: raw.createdAt }); }
            });
            data.sort((a, b) => b.createdAt - a.createdAt);
            setHistory(data);
        } catch (e) {}
    };

    fetchUser(); loadBackgroundHistory();
  }, [userPhone]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault(); setSaving(true);
    try {
      if (userDocId) { await updateDoc(doc(db, 'users', userDocId), { name: encryptText(formData.name), password: encryptText(formData.password), dob: encryptText(formData.dob) }); } 
      else {
          const newDocRef = await addDoc(collection(db, 'users'), { phone: encryptText(userPhone), name: encryptText(formData.name), password: encryptText(formData.password), dob: encryptText(formData.dob), points: encryptText('0'), createdAt: Date.now() });
          setUserDocId(newDocRef.id);
      }
      setProfile({ ...profile!, name: formData.name, password: formData.password, dob: formData.dob } as any);
      setEditMode(false); setAlertMessage("Profile အောင်မြင်စွာ ပြင်ဆင်ပြီးပါပြီ။");
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
  const isBdayMonth = () => { if (!profile?.dob) return false; const dobParts = profile.dob.split('-'); const currentParts = getLocalTodayStr().split('-'); return dobParts[1] === currentParts[1]; };

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
                      {loadingHistory ? (<div className="text-center py-10 text-gray-500 font-bold text-sm animate-pulse">Loading History...</div>) : history.length === 0 ? (<div className="text-center py-10 text-gray-400 font-bold text-sm">Point ရရှိထားသော မှတ်တမ်းမရှိသေးပါ။</div>) : (
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
                    <button onClick={() => { setShowHistory(true); fetchHistory(); }} className="px-4 py-1.5 bg-yellow-200 text-yellow-800 rounded-full text-[10px] font-bold shadow-sm hover:bg-yellow-300 transition flex items-center"><History className="w-3 h-3 mr-1"/> View History</button>
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
                        <div className="w-full h-2.5 bg-gray-100 rounded-full overflow-hidden"><div className="h-full rounded-full bg-gradient-to-r from-yellow-400 to-[#D4AF37] transition-all duration-1000 ease-out" style={{ width: `${progressPercent}%` }}></div></div>
                        <p className="text-[10px] text-gray-500 font-semibold mt-2.5 text-center leading-relaxed"><span className="font-bold text-[#123524]">{nextTier.name}</span> ဖြစ်ရန် လိုအပ်သော ပွိုင့်: <span className="font-bold text-red-500">{pointsNeeded} Pts</span></p>
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
                            <div className="flex justify-between items-center bg-white p-2.5 rounded-lg border border-blue-100 shadow-sm"><span className="text-[10px] text-gray-600 font-bold">Base (20%) + Monthly ({monthlyPoints}%)</span><span className="text-sm font-black text-blue-600">{Math.min(100, 20 + monthlyPoints)}% OFF</span></div>
                        ) : (
                            <div className="flex justify-between items-center bg-white p-2.5 rounded-lg border border-blue-100 shadow-sm"><span className="text-[10px] text-gray-600 font-bold">VIP Standard Birthday</span><span className="text-sm font-black text-blue-600">50% OFF</span></div>
                        )}
                    </div>
                )}
                {!userTier && (() => {
                    const nextTarget = Math.floor(monthlyPoints / 10) * 10 + 10; const actualTarget = nextTarget > 50 ? 50 : nextTarget; const ptsNeededForTarget = actualTarget - monthlyPoints; const basePoint = actualTarget - 10; const targetProgressPercent = ((monthlyPoints - basePoint) / 10) * 100; const possibleTiers = [10, 20, 30, 40]; const availableRewards: number[] = []; const usedRewards: number[] = [];
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
                                <div className="flex justify-between items-end mb-1.5"><span className="text-[9px] font-bold text-gray-500">Target Bonus: {actualTarget}% Off</span><span className="text-[9px] font-bold text-green-600">{actualTarget} Pts</span></div>
                                <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden mb-2"><div className="h-full rounded-full bg-green-500 transition-all duration-1000 ease-out" style={{ width: `${targetProgressPercent}%` }}></div></div>
                                <p className="text-[9px] text-gray-500 font-semibold text-center"><span className="font-bold text-green-600">{actualTarget}% Off</span> ခံစားခွင့်ရရန် လိုအပ်သောပွိုင့်: <span className="font-bold text-red-500">{ptsNeededForTarget} Pts</span></p>
                            </div>
                            {(availableRewards.length > 0 || usedRewards.length > 0) && (
                                <div className="space-y-2 pt-2 border-t border-gray-100">
                                    <h5 className="text-[11px] font-bold text-[#123524] mb-3 flex items-center mt-2"><Award className="w-3 h-3 mr-1 text-[#D4AF37]"/> Target Rewards Status</h5>
                                    {availableRewards.map(tier => (<div key={`avail-${tier}`} className="bg-green-50 text-green-700 p-2.5 rounded-lg text-[10px] font-bold border border-green-200 flex items-center justify-between shadow-sm"><span className="flex items-center"><Gift className="w-3.5 h-3.5 mr-1.5 text-green-600"/> {tier}% Discount ခံစားခွင့်</span><span className="bg-green-100 px-2 py-1 rounded text-green-800 shadow-sm">၁ ကြိမ် ရရှိထားပါသည်</span></div>))}
                                    {usedRewards.map(tier => (<div key={`used-${tier}`} className="bg-gray-50 text-gray-500 p-2.5 rounded-lg text-[10px] font-bold border border-gray-200 flex items-center justify-between opacity-75"><span className="flex items-center"><CheckCircle className="w-3.5 h-3.5 mr-1.5"/> {tier}% Discount ခံစားခွင့်</span><span className="bg-gray-200 px-2 py-1 rounded text-gray-600">အသုံးပြုပြီးပါပြီ</span></div>))}
                                </div>
                            )}
                        </div>
                    );
                })()}
            </div>
            <div className={`text-[10px] rounded-full px-3 py-1.5 inline-block font-bold mb-6 w-full ${profile?.password ? 'text-green-600 bg-green-50' : 'text-gray-500 bg-gray-100'}`}>{profile?.password ? '✅ Account Secured (Password Set)' : '⚠️ No Password Set (Auto-Login)'}</div>
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

// ==========================================
// CUSTOMER BOOKING WIZARD & TABS
// ==========================================
export function CustomerBookingWizard({ appData, userPhone = '', onBooked, forceTherapistFirst = false, initialTherapist = null, isStaffMode = false, staffClockIn = false, staffClockInSuccess, preselectedStaff }: { appData: AppData, userPhone?: string, onBooked?: (phone: string) => void, forceTherapistFirst?: boolean, initialTherapist?: TherapistProfile | null, isStaffMode?: boolean, staffClockIn?: boolean, staffClockInSuccess?: () => void, preselectedStaff?: string }) {
  const isTherapistFirst = forceTherapistFirst || new URLSearchParams(window.location.search).get('view') === 'therapists';
  const vipSettings = appData.vipSettings && Object.keys(appData.vipSettings).length > 0 ? appData.vipSettings : FALLBACK_VIP_SETTINGS;
  const promoTitle = appData.promotion?.title || 'SPECIAL PROMO';
  
  const [step, setStep] = useState(() => { if (staffClockIn) return isTherapistFirst ? 2 : 1; return initialTherapist ? 2 : 1; });
  useEffect(() => { window.scrollTo({ top: 0, behavior: 'smooth' }); }, [step]);

  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [formData, setFormData] = useState({ name: isStaffMode ? 'Walk-in Guest' : '', phone: userPhone, selectedItem: null as MenuItem | null, isVvipUpgrade: false, therapist: initialTherapist, therapist2: null as TherapistProfile | null, date: '', time: '', paymentMethod: '', txId: '', specialRequest: '' });
  
  const [loading, setLoading] = useState(false);
  const [paymentDropdownOpen, setPaymentDropdownOpen] = useState(false);
  const [viewGallery, setViewGallery] = useState<{ images: string[], index: number } | null>(null);
  const [successMsg, setSuccessMsg] = useState('');
  const [alertMessage, setAlertMessage] = useState('');
  
  // 🌟 Auth Modal States (For duplicate phone check)
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authModalPhone, setAuthModalPhone] = useState('');
  const [authModalHasPassword, setAuthModalHasPassword] = useState(false);
  const [verifiedPhone, setVerifiedPhone] = useState('');

  const [allBookings, setAllBookings] = useState<Booking[]>([]);
  const [userProfile, setUserProfile] = useState<any>(null);
  const [pointHistory, setPointHistory] = useState<any[]>([]);

  const stepContainerRef = useRef<HTMLDivElement>(null);
  const todayStr = getLocalTodayStr();

  const isFourHands = useMemo(() => { return (formData.selectedItem?.name || '').toLowerCase().includes('four hands'); }, [formData.selectedItem]);

  useEffect(() => {
      const q = query(collection(db, 'bookings'), where('date', '>=', todayStr));
      const unsub = onSnapshot(q, (snap) => {
          const arr: Booking[] = [];
          snap.forEach(d => { const raw = d.data(); arr.push({ id: d.id, ...raw, name: decryptText(raw.name), phone: decryptText(raw.phone), txId: decryptText(raw.txId), specialRequest: decryptText(raw.specialRequest), discountLabel: raw.discountLabel ? decryptText(raw.discountLabel) : undefined } as Booking); });
          setAllBookings(arr);
      });
      return () => unsub();
  }, [todayStr]);

  useEffect(() => {
      if (!userPhone) return;
      const fetchUser = async () => {
          try {
              const snap = await getDocs(collection(db, 'users'));
              let foundUser = null; let maxPts = -1;
              snap.forEach(d => {
                  try {
                      const data = d.data(); const decPhone = decryptText(data.phone) || d.id;
                      if (decPhone === userPhone || d.id === userPhone) {
                          const pts = parsePoints(data.points);
                          if (pts > maxPts) { maxPts = pts; foundUser = data; }
                      }
                  } catch (e) {}
              });
              if (foundUser) { setUserProfile({ ...(foundUser as any), points: maxPts, dob: decryptText((foundUser as any).dob) || (foundUser as any).dob || '' }); }
          } catch(e) {}
      };
      const fetchPH = async () => {
          try {
              const snap = await getDocs(collection(db, 'point_history'));
              const arr: any[] = [];
              snap.forEach(d => {
                  const raw = d.data();
                  if ((decryptText(raw.phone) || raw.phone) === userPhone) { arr.push({ date: raw.date, pointsEarned: Number(decryptText(raw.pointsEarned) || raw.pointsEarned || 0) }); }
              });
              setPointHistory(arr);
          } catch (e) {}
      };
      fetchUser(); fetchPH();
  }, [userPhone]);

  useEffect(() => { if (preselectedStaff && !formData.therapist) { const t = appData.therapists.find(staff => staff.name === preselectedStaff); if (t) setFormData(prev => ({...prev, therapist: t})); } }, [preselectedStaff, appData.therapists, formData.therapist]);
  useEffect(() => { if (staffClockIn && formData.date === todayStr && (!formData.time || !/^\d{1,2}:\d{2}(?::\d{2})?$/.test(formData.time))) { const now = new Date(); const hhmm = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`; setFormData(prev => ({ ...prev, time: hhmm })); } }, [staffClockIn, formData.date, todayStr]);

  const safePaymentMethods = Array.isArray(appData?.paymentMethods) ? appData.paymentMethods : [];
  const selectedPaymentConfig = safePaymentMethods.find(p => p.name === formData.paymentMethod);
  const getTier = (points: number) => { if(!vipSettings.isActive || !vipSettings.tiers) return null; const sortedTiers = [...vipSettings.tiers].sort((a,b) => b.requiredPoints - a.requiredPoints); return sortedTiers.find(t => points >= t.requiredPoints); };
  const userTier = getTier(userProfile?.points || 0);

  const checkPromoActive = () => {
      const promo = appData.promotion; if (!promo?.isActive) return false; if (!promo.startDate || !promo.endDate) return false;
      const today = new Date(getLocalTodayStr()).getTime(); const sDate = new Date(promo.startDate).getTime(); const eDate = new Date(promo.endDate).getTime();
      return today >= sDate && today <= eDate;
  };

  const isHotelService = appData.categories.find(c => c.id === 'hotel')?.items.some(i => i.id === formData.selectedItem?.id) || false;
  const promoActive = checkPromoActive();
  const isBirthday = () => { if (!userProfile?.dob || !formData.date) return false; const dobParts = userProfile.dob.split('-'); const bookParts = formData.date.split('-'); return dobParts[1] === bookParts[1] && dobParts[2] === bookParts[2]; };

  let finalDiscountPercent = 0; let discountLabel = '';
  if (promoActive) {
      finalDiscountPercent = isHotelService ? (appData.promotion?.hotelDiscountPercent || 0) : (appData.promotion?.otherDiscountPercent || 0);
      discountLabel = `${promoTitle} (${finalDiscountPercent}%)`;
  } else if (vipSettings.isActive && userProfile) {
      const currentMonthPrefix = getLocalTodayStr().substring(0, 7);
      const monthlyPts = pointHistory.filter(h => h.date && h.date.startsWith(currentMonthPrefix)).reduce((s, h) => s + h.pointsEarned, 0);
      const tierPercent = userTier ? userTier.discountPercent : 0; const tierLabel = userTier ? `VIP Member Discount (${tierPercent}%)` : '';
      let oneTimePercent = 0; let oneTimeLabel = ''; const possibleTiers = [40, 30, 20, 10]; 
      if (!userTier) {
          for (const tier of possibleTiers) {
              if (monthlyPts >= tier) {
                  const rewardLabel = `Pre-Jade Target Bonus (${tier}%)`;
                  const hasUsed = allBookings.some(b => (b.phone === userPhone) && b.discountLabel === rewardLabel && b.date && b.date.startsWith(currentMonthPrefix) && b.status !== 'cancelled');
                  if (!hasUsed) { oneTimePercent = tier; oneTimeLabel = rewardLabel; break; }
              }
          }
      }
      let bdayPercent = 0; let bdayLabel = '';
      if (userTier && isBirthday()) {
          if (userTier.name.toLowerCase().includes('imperial') || userTier.name.toLowerCase().includes('v-vip')) { bdayPercent = Math.min(100, 20 + monthlyPts); bdayLabel = `Imperial Birthday Bonus (${bdayPercent}%)`; } 
          else { bdayPercent = 50; bdayLabel = `VIP Birthday Bonus (50%)`; }
      }
      if (bdayPercent >= oneTimePercent && bdayPercent >= tierPercent && bdayPercent > 0) { finalDiscountPercent = bdayPercent; discountLabel = bdayLabel; }
      else if (oneTimePercent >= tierPercent && oneTimePercent > 0) { finalDiscountPercent = oneTimePercent; discountLabel = oneTimeLabel; }
      else if (tierPercent > 0) { finalDiscountPercent = tierPercent; discountLabel = tierLabel; }
  }

  const calculateSubTotal = () => {
    if (!formData.selectedItem) return 0;
    const basePrice = Number(formData.selectedItem.price) || 0; const vvipPrice = Number(formData.selectedItem.vvipPrice) || 0;
    return formData.isVvipUpgrade && vvipPrice > 0 && !formData.selectedItem.vvipIncluded ? vvipPrice : basePrice;
  };
  const calculateDiscountAmount = () => { return (calculateSubTotal() * finalDiscountPercent) / 100; };
  const calculateTotal = () => { return calculateSubTotal() - calculateDiscountAmount(); };

  const getRoomUsageMap = (selectedDate: string, bookingsArray: Booking[]) => {
      const usage = new Map<string, { vip: number, normal: number }>();
      ALL_TIME_SLOTS.forEach(s => usage.set(s, { vip: 0, normal: 0 }));
      bookingsArray.forEach(b => {
          if (b.status === 'cancelled' || b.status === 'completed') return; if (b.date !== selectedDate) return;
          const serviceLower = (b.service || '').toLowerCase(); const isBookingOutcall = serviceLower.includes('outcall') || serviceLower.includes('hotel') || serviceLower.includes('home');
          if (isBookingOutcall) return; 
          const isVip = serviceLower.includes('vvip'); const coveredSlots = getBookingCoveredSlots(b); 
          coveredSlots.forEach(slot => { const current = usage.get(slot); if (current) { if (isVip) current.vip += 1; else current.normal += 1; usage.set(slot, current); } });
      });
      return usage;
  };

  const roomUsageMap = useMemo(() => getRoomUsageMap(formData.date || todayStr, allBookings), [allBookings, formData.date, todayStr]);

  const currentRoomUsage = useMemo(() => {
      let vip = 0; let normal = 0; const now = new Date(); let currentSlot = "";
      for (let i = ALL_TIME_SLOTS.length - 1; i >= 0; i--) {
          const slot = ALL_TIME_SLOTS[i]; const [tPart, ampm] = slot.split(' '); let [h, m] = tPart.split(':').map(Number);
          if (ampm === 'PM' && h < 12) h += 12; if (ampm === 'AM' && h === 12) h = 0;
          const slotTime = new Date(); slotTime.setHours(h, m, 0, 0);
          if (now >= slotTime) { currentSlot = slot; break; }
      }
      allBookings.forEach(b => {
          if (b.status === 'cancelled' || b.status === 'completed' || b.date !== todayStr) return; 
          const serviceLower = (b.service || '').toLowerCase(); if (serviceLower.includes('outcall') || serviceLower.includes('hotel') || serviceLower.includes('home')) return;
          const isVip = serviceLower.includes('vvip'); const coveredSlots = getBookingCoveredSlots(b);
          if (currentSlot && coveredSlots.includes(currentSlot)) { if (isVip) vip++; else normal++; }
      });
      return { vip, normal, total: vip + normal };
  }, [allBookings, todayStr]);

  const isVipCurrentlyFull = currentRoomUsage.vip >= 3 || currentRoomUsage.total >= 5;
  const disableVvipToggle = !formData.selectedItem?.vvipPrice || isVipCurrentlyFull;

  const getBlockedSlots = (bookings: Booking[], selectedTherapistName: string, selectedDate: string) => {
      const blocked = new Set<string>();
      if (!selectedTherapistName || selectedTherapistName === 'Any Available Therapist') return blocked; 
      bookings.forEach(b => {
          if (b.status === 'cancelled' || b.status === 'completed' || b.date !== selectedDate || !b.therapist.includes(selectedTherapistName)) return;
          const coveredSlots = getBookingCoveredSlots(b);
          if (coveredSlots.length > 0) {
              coveredSlots.forEach(slot => blocked.add(slot));
              const firstIdx = ALL_TIME_SLOTS.indexOf(coveredSlots[0]); if (firstIdx > 0) blocked.add(ALL_TIME_SLOTS[firstIdx - 1]);
              const lastIdx = ALL_TIME_SLOTS.indexOf(coveredSlots[coveredSlots.length - 1]); if (lastIdx !== -1 && lastIdx < ALL_TIME_SLOTS.length - 1) blocked.add(ALL_TIME_SLOTS[lastIdx + 1]);
          }
      });
      return blocked;
  };

  const checkSlotState = (t: string) => {
      let neededSlots = 2; const fixedDetails = getFixedServiceDetails(formData.selectedItem?.name);
      if (fixedDetails) {
          const startIdx = ALL_TIME_SLOTS.indexOf(t.split(' to ')[0].trim()); let endIdx = ALL_TIME_SLOTS.indexOf(fixedDetails.end);
          if (fixedDetails.nextDay || endIdx === -1) endIdx = ALL_TIME_SLOTS.length; neededSlots = Math.max(1, endIdx - startIdx);
      } else if (formData.selectedItem) {
          const match = (formData.selectedItem.duration || '').match(/(\d+)\s*Mins/i); if (match) neededSlots = Math.ceil(parseInt(match[1]) / 30);
      }
      const actualTestStr = t.includes("to") ? `${t.split(' to ')[0].trim()} to ${t.split(' to ')[1]}` : t;
      const coveredSlotsForT = getSlotsFromTimeText(actualTestStr, neededSlots);
      if (coveredSlotsForT.length === 0) return { available: false, reason: 'invalid' };
      if (formData.therapist) {
          const tBlocked = getBlockedSlots(allBookings, formData.therapist.name, formData.date || todayStr);
          for (const slot of coveredSlotsForT) { if (tBlocked.has(slot)) return { available: false, reason: 'therapist' }; }
      }
      if (formData.therapist2) {
          const tBlocked2 = getBlockedSlots(allBookings, formData.therapist2.name, formData.date || todayStr);
          for (const slot of coveredSlotsForT) { if (tBlocked2.has(slot)) return { available: false, reason: 'therapist' }; }
      }
      const serviceLower = (formData.selectedItem?.name || '').toLowerCase();
      const isCurrentOutcall = serviceLower.includes('outcall') || serviceLower.includes('hotel') || serviceLower.includes('home');
      if (!isCurrentOutcall) {
          const isUserVip = formData.isVvipUpgrade || formData.selectedItem?.vvipIncluded;
          for (const slot of coveredSlotsForT) {
               const usage = roomUsageMap.get(slot) || { vip: 0, normal: 0 }; const totalUsed = usage.vip + usage.normal;
               if (isUserVip && (usage.vip >= 3 || totalUsed >= 5)) return { available: false, reason: 'room' };
               if (!isUserVip && (usage.normal >= 2 || totalUsed >= 5)) return { available: false, reason: 'room' };
          }
      }
      return { available: true, reason: '' };
  };

  const handleTimeSlotClick = (t: string, state: { available: boolean, reason: string }) => {
      if (!formData.date) return;
      if (state.reason === 'therapist') { setAlertMessage("ရွေးချယ်ထားသော ဝန်ထမ်းသည် ဤအချိန်တွင် ဘိုကင်ရှိနေပါသည်။ အခြားအချိန် ရွေးချယ်ပေးပါ။"); return; }
      if (state.reason === 'room') {
          const isUserVip = formData.isVvipUpgrade || formData.selectedItem?.vvipIncluded;
          let neededSlots = 2; const fixedDetails = getFixedServiceDetails(formData.selectedItem?.name);
          if (fixedDetails) {
              const startIdx = ALL_TIME_SLOTS.indexOf(t.split(' to ')[0].trim()); let endIdx = ALL_TIME_SLOTS.indexOf(fixedDetails.end);
              if (fixedDetails.nextDay || endIdx === -1) endIdx = ALL_TIME_SLOTS.length; neededSlots = Math.max(1, endIdx - startIdx);
          } else if (formData.selectedItem) {
              const match = (formData.selectedItem.duration || '').match(/(\d+)\s*Mins/i); if (match) neededSlots = Math.ceil(parseInt(match[1]) / 30);
          }
          const sIdx = ALL_TIME_SLOTS.indexOf(t.split(' to ')[0].trim()); let nextAvailable = '';
          for (let i = sIdx + 1; i < ALL_TIME_SLOTS.length; i++) {
              let durationFree = true;
              const actualTestStr = t.includes("to") ? `${ALL_TIME_SLOTS[i]} to ${t.split(' to ')[1]}` : ALL_TIME_SLOTS[i];
              for(let j=0; j < neededSlots; j++) {
                  const subSlot = ALL_TIME_SLOTS[i+j]; if(!subSlot) { durationFree = false; break; }
                  const subUsage = roomUsageMap.get(subSlot) || { vip: 0, normal: 0 }; const subTotal = subUsage.vip + subUsage.normal;
                  if (isUserVip && (subUsage.vip >= 3 || subTotal >= 5)) durationFree = false;
                  if (!isUserVip && (subUsage.normal >= 2 || subTotal >= 5)) durationFree = false;
              }
              if (durationFree && formData.therapist) {
                  const tBlocked = getBlockedSlots(allBookings, formData.therapist.name, formData.date); const testSlots = getSlotsFromTimeText(actualTestStr, neededSlots);
                  for (const slot of testSlots) { if (tBlocked.has(slot)) { durationFree = false; break; } }
              }
              if (durationFree && formData.therapist2) {
                  const tBlocked2 = getBlockedSlots(allBookings, formData.therapist2.name, formData.date); const testSlots = getSlotsFromTimeText(actualTestStr, neededSlots);
                  for (const slot of testSlots) { if (tBlocked2.has(slot)) { durationFree = false; break; } }
              }
              if (durationFree) { nextAvailable = ALL_TIME_SLOTS[i]; break; }
          }
          if (nextAvailable) { setAlertMessage(`လတ်တလော အခန်းပြည့်နေပါသည်၊ ${nextAvailable} အချိန်မှ ပြန်ရပါမည်။`); } 
          else { setAlertMessage(`လတ်တလော အခန်းပြည့်နေပါသည်၊ ယနေ့အတွက် အခန်းမရနိုင်တော့ပါ။`); }
          return;
      }
      if (state.available) {
          const fixedDetails = getFixedServiceDetails(formData.selectedItem?.name);
          if (fixedDetails) { setFormData({ ...formData, time: `${t} to ${fixedDetails.end}${fixedDetails.nextDay ? ' (Next Day)' : ''}` }); } 
          else if ((formData.selectedItem?.name || '').toLowerCase().includes("night")) { setFormData({ ...formData, time: `${t} to 8:00 AM (Next Day)` }); } 
          else { setFormData({ ...formData, time: t }); }
      }
  };

  const getAvailableTimeSlots = (targetDateOverride?: string) => {
    let allowedSlots = ALL_TIME_SLOTS.slice(ALL_TIME_SLOTS.indexOf("9:00 AM"), ALL_TIME_SLOTS.indexOf("11:00 PM") + 1);
    if (formData.selectedItem) {
        const fixedDetails = getFixedServiceDetails(formData.selectedItem.name);
        if (fixedDetails) {
            let startIndex = ALL_TIME_SLOTS.indexOf(fixedDetails.start); let endIndex = ALL_TIME_SLOTS.indexOf(fixedDetails.end);
            if (fixedDetails.nextDay || endIndex === -1) endIndex = ALL_TIME_SLOTS.length; allowedSlots = ALL_TIME_SLOTS.slice(Math.max(0, startIndex), endIndex);
        } else {
            const isHotelService = appData.categories.find(c => c.id === 'hotel')?.items.some(i => i.id === formData.selectedItem?.id);
            const serviceName = (formData.selectedItem.name || '').toLowerCase(); const isNightService = serviceName.includes("night");
            if (isHotelService) {
              if (serviceName.includes("outcall")) { allowedSlots = ALL_TIME_SLOTS.slice(ALL_TIME_SLOTS.indexOf("7:00 AM"), ALL_TIME_SLOTS.indexOf("7:00 PM") + 1); } 
              else if (isNightService) { allowedSlots = ["7:00 PM", "7:30 PM", "8:00 PM", "8:30 PM", "9:00 PM", "9:30 PM", "10:00 PM", "10:30 PM", "11:00 PM"]; }
            } else { allowedSlots = ALL_TIME_SLOTS.slice(ALL_TIME_SLOTS.indexOf("9:00 AM"), ALL_TIME_SLOTS.indexOf("9:00 PM") + 1); }
        }
    }
    const targetDate = targetDateOverride || formData.date || todayStr;
    if (targetDate === todayStr) {
        const now = new Date();
        allowedSlots = allowedSlots.filter(slot => {
            let timeStr = slot; if (slot.includes("to")) timeStr = slot.split(" to ")[0].trim(); 
            const match = timeStr.match(/(\d+):(\d+)\s+(AM|PM)/i);
            if (match) {
                let h = parseInt(match[1]); const m = parseInt(match[2]); const ampm = match[3].toUpperCase();
                if (ampm === 'PM' && h < 12) h += 12; if (ampm === 'AM' && h === 12) h = 0;
                const slotTime = new Date(); slotTime.setHours(h, m, 0, 0); return slotTime > now; 
            }
            return true; 
        });
    }
    return allowedSlots;
  };

  const availableTimeSlots = getAvailableTimeSlots();
  const isSelectedNightService = (formData.selectedItem?.name || '').toLowerCase().includes("night");
  const currentFixedDetails = getFixedServiceDetails(formData.selectedItem?.name);

  const getMinMaxDates = () => {
    const d = new Date(); const minDateStr = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
    d.setDate(d.getDate() + 3); const maxDateStr = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
    return { minDateStr, maxDateStr };
  }
  const { minDateStr, maxDateStr } = getMinMaxDates();

  const isTherapistFullForDate = (tName: string, dateToCheck: string) => {
      const allowedSlots = getAvailableTimeSlots(dateToCheck);
      let neededSlots = 2; const fixedDetails = getFixedServiceDetails(formData.selectedItem?.name);
      if (fixedDetails) neededSlots = 1; 
      else if (formData.selectedItem) { const match = (formData.selectedItem.duration || '').match(/(\d+)\s*Mins/i); if (match) neededSlots = Math.ceil(parseInt(match[1]) / 30); }
      const tBlocked = getBlockedSlots(allBookings, tName, dateToCheck);
      for (const t of allowedSlots) {
           const actualTestStr = t.includes("to") ? `${t.split(' to ')[0].trim()} to ${t.split(' to ')[1]}` : t;
           const covered = getSlotsFromTimeText(actualTestStr, neededSlots);
           let overlap = false; for (const slot of covered) { if (tBlocked.has(slot)) { overlap = true; break; } }
           if (!overlap) return false; 
      }
      return true;
  };

  const handleCopy = (text: string) => { if (navigator.clipboard && navigator.clipboard.writeText) { navigator.clipboard.writeText(text); setAlertMessage('Copied!'); } else { setAlertMessage("Copying manually required: " + text); } };
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => { setFormData({ ...formData, [e.target.name]: e.target.value }); };
  const handleNextStep = (nextStep: number) => { setStep(nextStep); };

  const handleCountdownExpire = () => {
     if (isStaffMode) return;
     setAlertMessage("ငွေပေးချေရန် သတ်မှတ်ချိန် (၁၅) မိနစ် ကုန်ဆုံးသွားပါပြီ။ ကျေးဇူးပြု၍ ဘိုကင် အသစ်ပြန်လည်တင်ပေးပါ။");
     setStep(1); setFormData({ name: '', phone: userPhone, selectedItem: null, isVvipUpgrade: false, therapist: null, therapist2: null, date: '', time: '', paymentMethod: '', txId: '', specialRequest: '' });
  };
  const formattedCountdown = useCountdown(isStaffMode ? 0 : 15, handleCountdownExpire);

  // 🚀 Core Booking Processing Function
  const processBooking = async (phoneToUse: string) => {
      setLoading(true);
      try {
          const freshSnap = await getDocs(query(collection(db, 'bookings'), where('date', '>=', todayStr)));
          const freshBookings: Booking[] = [];
          freshSnap.forEach(d => { const raw = d.data(); freshBookings.push({ id: d.id, ...raw, name: decryptText(raw.name), phone: decryptText(raw.phone), txId: decryptText(raw.txId), specialRequest: decryptText(raw.specialRequest) } as Booking); });
          
          let isOverlap = false; const timeRegex = /^\d{1,2}:\d{2}(?::\d{2})?$/;
          const isStaffImmediate = staffClockIn && formData.date === todayStr && timeRegex.test(formData.time || '');
          let fluidStartTimeMillis = Date.now(); let expectedEndTimeMillis = Date.now(); let durationMins = 60; let finalTimeStr = formData.time;
          const fixedDetails = getFixedServiceDetails(formData.selectedItem?.name);

          if (formData.selectedItem && !fixedDetails) { const match = (formData.selectedItem.duration || '').match(/(\d+)\s*Mins/i); if (match) durationMins = parseInt(match[1]) || 60; }

          if (isStaffImmediate) {
              const timeParts = (formData.time || "00:00").split(':'); const h = Number(timeParts[0]) || 0; const m = Number(timeParts[1]) || 0;
              const ampm = h >= 12 ? 'PM' : 'AM'; const hrs12 = h % 12 || 12; finalTimeStr = `${hrs12}:${m.toString().padStart(2, '0')} ${ampm}`;
              const dateParts = (formData.date || todayStr).split('-'); const startDateTime = new Date(Number(dateParts[0]), Number(dateParts[1])-1, Number(dateParts[2]));
              startDateTime.setHours(h, m, 0, 0); fluidStartTimeMillis = startDateTime.getTime(); 
              
              if (fixedDetails) {
                  finalTimeStr = `${finalTimeStr} to ${fixedDetails.end}${fixedDetails.nextDay ? ' (Next Day)' : ''}`;
                  const endParts = fixedDetails.end.split(' '); const [endHStr, endMStr] = (endParts[0] || '00:00').split(':'); const endAmPm = endParts[1] || 'AM';
                  let endH = parseInt(endHStr) || 0; if(endAmPm === 'PM' && endH < 12) endH += 12; if(endAmPm === 'AM' && endH === 12) endH = 0;
                  const endDateTime = new Date(startDateTime); endDateTime.setHours(endH, parseInt(endMStr) || 0, 0, 0);
                  if (fixedDetails.nextDay || endDateTime < startDateTime) endDateTime.setDate(endDateTime.getDate() + 1);
                  expectedEndTimeMillis = endDateTime.getTime();
              } else if ((formData.selectedItem?.name || '').toLowerCase().includes("night")) {
                  const nextDay = new Date(startDateTime); nextDay.setDate(nextDay.getDate() + 1); nextDay.setHours(8, 0, 0, 0); expectedEndTimeMillis = nextDay.getTime();
              } else { expectedEndTimeMillis = fluidStartTimeMillis + (durationMins * 60 * 1000); }

              const blockedNow = getBlockedSlots(freshBookings, formData.therapist?.name || '', formData.date || '');
              const blockedNow2 = formData.therapist2 ? getBlockedSlots(freshBookings, formData.therapist2.name, formData.date || '') : new Set();
              const coveredForImmediate = Array.from(getSlotsCoveredByInterval(fluidStartTimeMillis, expectedEndTimeMillis, formData.date || ''));
              for (const slot of coveredForImmediate) { if (blockedNow.has(slot) || blockedNow2.has(slot)) { isOverlap = true; break; } }
          } else {
              let neededSlots = 2; 
              if (fixedDetails) {
                  const startIdx = ALL_TIME_SLOTS.indexOf((formData.time || '').split(' to ')[0].trim()); let endIdx = ALL_TIME_SLOTS.indexOf(fixedDetails.end);
                  if (fixedDetails.nextDay || endIdx === -1) endIdx = ALL_TIME_SLOTS.length; neededSlots = Math.max(1, endIdx - startIdx);
              } else if (formData.selectedItem) {
                  const match = (formData.selectedItem.duration || '').match(/(\d+)\s*Mins/i); if (match) neededSlots = Math.ceil(parseInt(match[1]) / 30);
              }
              const actualTestStr = (formData.time || '').includes("to") ? `${(formData.time || '').split(' to ')[0].trim()} to ${(formData.time || '').split(' to ')[1]}` : (formData.time || '');
              const coveredSlots = getSlotsFromTimeText(actualTestStr, neededSlots);
              const blockedNow = getBlockedSlots(freshBookings, formData.therapist?.name || '', formData.date || '');
              const blockedNow2 = formData.therapist2 ? getBlockedSlots(freshBookings, formData.therapist2.name, formData.date || '') : new Set();
              for (const slot of coveredSlots) { if (blockedNow.has(slot) || blockedNow2.has(slot)) { isOverlap = true; break; } }
          }

          if (isOverlap) { setAlertMessage("ဆောရီးပါ.. သင်ရွေးချယ်ထားသော အချိန်သည် အခြားသူ ဘိုကင်တင်ထားသည်နှင့် ထပ်နေပါသည်။ ကျေးဇူးပြု၍ အချိန် ပြန်ရွေးပေးပါ။"); setLoading(false); return; }

          const serviceLowerNameForCheck = (formData.selectedItem?.name || '').toLowerCase();
          const isCurrentOutcall = serviceLowerNameForCheck.includes('outcall') || serviceLowerNameForCheck.includes('hotel') || serviceLowerNameForCheck.includes('home');
          if (!isCurrentOutcall) {
              const freshRoomUsage = getRoomUsageMap(formData.date || todayStr, freshBookings);
              const isUserVip = formData.isVvipUpgrade || formData.selectedItem?.vvipIncluded;
              let neededSlots = 2;
              if (fixedDetails) {
                  const startIdx = ALL_TIME_SLOTS.indexOf((formData.time || '').split(' to ')[0].trim()); let endIdx = ALL_TIME_SLOTS.indexOf(fixedDetails.end);
                  if (fixedDetails.nextDay || endIdx === -1) endIdx = ALL_TIME_SLOTS.length; neededSlots = Math.max(1, endIdx - startIdx);
              } else if (formData.selectedItem) {
                  const match = (formData.selectedItem.duration || '').match(/(\d+)\s*Mins/i); if (match) neededSlots = Math.ceil(parseInt(match[1]) / 30);
              }
              let coveredSlotsToCheck: string[] = [];
              if (isStaffImmediate) coveredSlotsToCheck = Array.from(getSlotsCoveredByInterval(fluidStartTimeMillis, expectedEndTimeMillis, formData.date || ''));
              else {
                  const actualTestStr = (formData.time || '').includes("to") ? `${(formData.time || '').split(' to ')[0].trim()} to ${(formData.time || '').split(' to ')[1]}` : (formData.time || '');
                  coveredSlotsToCheck = getSlotsFromTimeText(actualTestStr, neededSlots);
              }
              let isRoomOverlap = false;
              for (const slotName of coveredSlotsToCheck) {
                  const usage = freshRoomUsage.get(slotName) || { vip: 0, normal: 0 }; const totalUsed = usage.vip + usage.normal;
                  if (isUserVip) { if (usage.vip >= 3 || totalUsed >= 5) { isRoomOverlap = true; break; } }
                  else { if (usage.normal >= 2 || totalUsed >= 5) { isRoomOverlap = true; break; } }
              }
              if (isRoomOverlap) { setAlertMessage("ဆောရီးပါ.. သင်ရွေးချယ်ထားသော အချိန်တွင် အခန်းပြည့်သွားပါသည်။ အခြားအချိန် ရွေးချယ်ပေးပါ။"); setLoading(false); return; }
          }

          if (isNaN(expectedEndTimeMillis)) expectedEndTimeMillis = fluidStartTimeMillis + (60 * 60 * 1000);

          let combinedTherapistName = formData.therapist?.name || 'Any Available Therapist';
          if (isFourHands && formData.therapist && formData.therapist2) { combinedTherapistName = `${formData.therapist.name} & ${formData.therapist2.name}`; } 
          else if (isFourHands && formData.therapist) { combinedTherapistName = `${formData.therapist.name} & (Any Available)`; }

          const dataToSave: any = {
            name: encryptText(formData.name || (staffClockIn ? 'Walk-in (Staff-initiated)' : 'Walk-in Guest')), 
            phone: encryptText(phoneToUse),
            service: `${formData.selectedItem?.name || ''} ${formData.selectedItem?.duration ? `(${formData.selectedItem.duration})` : ''} ${formData.isVvipUpgrade ? '+ VVIP Upgrade' : ''} ${formData.selectedItem?.vvipIncluded ? '(VVIP Included)' : ''}`.trim(),
            therapist: combinedTherapistName,
            date: formData.date || todayStr, time: finalTimeStr || '00:00', paymentMethod: isStaffMode ? 'Cash Payment in Shop' : (formData.paymentMethod || '-'), 
            txId: encryptText(isStaffMode ? 'CASH' : (formData.txId || '-')), totalPrice: Number(calculateTotal()) || 0, status: isStaffImmediate ? 'in_progress' : (isStaffMode ? 'approved' : 'pending'), 
            createdAt: Date.now(), specialRequest: encryptText(formData.specialRequest || ''), originalPrice: encryptText(calculateSubTotal().toString()), discountPercent: encryptText(finalDiscountPercent.toString()),
            discountLabel: encryptText(discountLabel || ''), vipTierName: encryptText(userTier ? userTier.name : ''), ...(isStaffImmediate && { startTimeMillis: Number(fluidStartTimeMillis) || Date.now(), expectedEndTimeMillis: Number(expectedEndTimeMillis) || Date.now() })
          };

          Object.keys(dataToSave).forEach(key => dataToSave[key] === undefined ? delete dataToSave[key] : {});
          await addDoc(collection(db, 'bookings'), dataToSave);
          setSuccessMsg('Booking အောင်မြင်စွာ တင်ပြီးပါပြီ။' + (isStaffMode ? '' : ' Admin မှ မကြာမီ ပြန်လည်ဆက်သွယ် အတည်ပြုပေးပါမည်။'));
      } catch (error: any) { console.error(error); setAlertMessage("Error: " + (error.message || "Booking တင်ရာတွင် အခက်အခဲရှိနေပါသည်။")); }
      setLoading(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isStaffMode && formData.txId.length !== 6) { setAlertMessage("Transaction ID နောက်ဆုံး ၆ လုံးကို မှန်ကန်စွာ ဖြည့်ပေးပါ။"); return; }
    setLoading(true);
    try {
      if (formData.phone && formData.phone.trim() !== '') {
        const usersSnap = await getDocs(collection(db, 'users'));
        let userRefId: string | null = null; let hasName = false; let maxPts = -1; let exactPhoneMatch = false; let userHasPassword = false;
        usersSnap.forEach(d => {
          try {
              const decPhone = decryptText(d.data().phone) || d.id;
              if (decPhone === formData.phone.trim() || d.id === formData.phone.trim()) {
                 exactPhoneMatch = true; if (decryptText(d.data().password)) userHasPassword = true;
                 const pts = parsePoints(d.data().points);
                 if (pts > maxPts) { maxPts = pts; userRefId = d.id; hasName = !!decryptText(d.data().name); }
              }
          } catch(e) {}
        });

        if (exactPhoneMatch && !isStaffMode && userPhone !== formData.phone.trim() && verifiedPhone !== formData.phone.trim()) {
            setAuthModalPhone(formData.phone.trim()); setAuthModalHasPassword(userHasPassword); setShowAuthModal(true); setLoading(false); return;
        }

        if (!userRefId) {
          await addDoc(collection(db, 'users'), { phone: encryptText(formData.phone.trim()), name: encryptText(formData.name || ''), password: encryptText(''), points: encryptText('0'), dob: encryptText(''), createdAt: Date.now() });
        } else if (!hasName) { await updateDoc(doc(db, 'users', userRefId), { name: encryptText(formData.name || '') }); }
      }
      processBooking(formData.phone.trim());
    } catch (error: any) { console.error(error); setAlertMessage("Error checking database."); setLoading(false); }
  };

  if (successMsg) {
    return (
      <div className="bg-white p-10 rounded-2xl shadow-lg text-center border border-gray-100 max-w-lg mx-auto mt-10 animate-fade-in">
        <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6"><CheckCircle className="w-10 h-10 text-green-600" /></div>
        <h2 className="text-2xl font-bold mb-3" style={{ color: THEME.primary }}>Booking Confirmed!</h2>
        <p className="text-gray-600 mb-8 leading-relaxed font-semibold">{successMsg}</p>
        <button onClick={() => { 
           if (staffClockInSuccess) { staffClockInSuccess(); return; }
           if (isStaffMode) { setStep(1); setFormData({ name: 'Walk-in Guest', phone: '', selectedItem: null, isVvipUpgrade: false, therapist: initialTherapist, therapist2: null, date: '', time: '', paymentMethod: '', txId: '', specialRequest: '' }); setSuccessMsg(''); window.scrollTo({ top: 0, behavior: 'smooth' }); } 
           else { setSuccessMsg(''); if (onBooked) onBooked(formData.phone); }
        }} className="px-8 py-3 font-bold rounded-lg transition text-white w-full shadow-md hover:opacity-90" style={{ backgroundColor: THEME.primary }}>
           {staffClockIn ? 'Finish' : (isStaffMode ? 'နောက်ထပ် ဘိုကင်တင်မည် (Add Another)' : 'မှတ်တမ်းကြည့်ရန် (View History)')}
        </button>
      </div>
    );
  }

  const steps = isTherapistFirst ? [{ num: 1, label: 'THERAPIST', icon: User }, { num: 2, label: 'SERVICE', icon: Sparkles }, { num: 3, label: 'DATE & TIME', icon: Calendar }, { num: 4, label: 'CONFIRM', icon: CreditCard }] : [{ num: 1, label: 'SERVICE', icon: Sparkles }, { num: 2, label: 'THERAPIST', icon: User }, { num: 3, label: 'DATE & TIME', icon: Calendar }, { num: 4, label: 'CONFIRM', icon: CreditCard }];
  const renderStepper = () => (
    <div ref={stepContainerRef} className="flex items-center justify-center mb-10 w-full max-w-lg mx-auto scroll-mt-6">
      {steps.map((s, idx) => {
        const isCompleted = step > s.num; const isActive = step === s.num;
        return (
          <React.Fragment key={s.num}>
            <div className="flex flex-col items-center relative z-10">
              <div className={`w-10 h-10 sm:w-12 sm:h-12 rounded-full flex items-center justify-center transition-all duration-300 border-2 ${isCompleted ? 'bg-[#D4AF37] border-[#D4AF37] text-white' : isActive ? 'bg-[#123524] border-[#123524] text-white' : 'bg-white border-gray-200 text-gray-400'}`}>{isCompleted ? <Check className="w-5 h-5" /> : <s.icon className="w-4 h-4 sm:w-5 sm:h-5" />}</div>
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
        <div className="relative overflow-hidden bg-gradient-to-r from-[#123524] via-[#1a4a32] to-[#123524] p-3 sm:p-5 rounded-2xl mb-6 shadow-md border border-[#D4AF37]/40 animate-fade-in flex items-center justify-between">
           <div className="absolute -top-6 -right-6 w-20 h-20 bg-[#D4AF37] rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-pulse"></div><div className="absolute -bottom-6 -left-6 w-20 h-20 bg-[#D4AF37] rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-pulse"></div>
           <div className="relative z-10 flex items-center">
              <div className="w-8 h-8 sm:w-10 sm:h-10 bg-gradient-to-br from-[#D4AF37] to-yellow-600 rounded-full flex items-center justify-center mr-2.5 sm:mr-3 border border-[#123524] shadow-sm flex-shrink-0"><Percent className="w-4 h-4 sm:w-5 sm:h-5 text-[#123524]" /></div>
              <div><div className="flex items-center gap-2 mb-0.5"><h4 className="font-extrabold text-[#D4AF37] text-xs sm:text-sm tracking-wide uppercase flex items-center"><Sparkles className="w-3 h-3 mr-1" /> {promoTitle}</h4><span className="text-[7px] sm:text-[8px] text-[#123524] bg-[#D4AF37] px-1.5 py-0.5 rounded-full font-bold uppercase tracking-widest shadow-sm whitespace-nowrap ml-2">Limited Time</span></div><div className="text-[9px] sm:text-[10px] text-gray-300 font-semibold flex items-center">Valid until: <span className="text-white ml-1">{appData.promotion?.endDate}</span></div></div>
           </div>
           <div className="relative z-10 flex flex-col gap-1.5 ml-3">
               <div className="bg-white/10 text-white text-[9px] sm:text-[10px] font-bold px-2 py-1 rounded border border-[#D4AF37]/30 flex items-center justify-between min-w-[100px] backdrop-blur-sm shadow-sm"><span className="flex items-center"><Home className="w-2.5 h-2.5 mr-1 text-[#D4AF37]"/> Hotel</span> <span className="text-[#D4AF37] ml-2">{appData.promotion?.hotelDiscountPercent}% OFF</span></div>
               <div className="bg-white/10 text-white text-[9px] sm:text-[10px] font-bold px-2 py-1 rounded border border-[#D4AF37]/30 flex items-center justify-between min-w-[100px] backdrop-blur-sm shadow-sm"><span className="flex items-center"><Activity className="w-2.5 h-2.5 mr-1 text-[#D4AF37]"/> Other</span><span className="text-[#D4AF37] ml-2">{appData.promotion?.otherDiscountPercent}% OFF</span></div>
           </div>
        </div>
      )}

      <div className="text-center mb-8"><h2 className="text-2xl font-bold" style={{ color: THEME.primary }}>Choose Your Service</h2><p className="text-sm font-bold mt-2" style={{ color: THEME.gold }}>(သင်ရယူလိုသော ဝန်ဆောင်မှုကို ရွေးချယ်ပါ)</p></div>
      <div className="space-y-4">{appData.categories.map(category => {
        const CategoryIcon = ICON_MAP[category.id] || Activity;
        return (
          <div key={category.id} className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <div onClick={() => setActiveCategory(activeCategory === category.id ? null : category.id)} className="p-4 flex items-center justify-between cursor-pointer hover:bg-gray-50 transition"><div className="flex items-center text-sm font-bold" style={{ color: THEME.primary }}><CategoryIcon className="w-5 h-5 mr-3" style={{ color: THEME.gold }} /> {category.title}</div>{activeCategory === category.id ? <ChevronUp className="w-6 h-6" style={{ color: THEME.primary }} /> : <ChevronDown className="w-6 h-6" style={{ color: THEME.primary }} />}</div>
            {activeCategory === category.id && (
              <div className="p-2 border-t border-gray-100 bg-gray-50/50">{category.items.map(s => (
                <div key={s.id} onClick={() => setFormData({ ...formData, selectedItem: s, isVvipUpgrade: false, time: '', therapist2: null })} className={`flex justify-between items-center p-4 my-2 mx-2 rounded-lg cursor-pointer border transition-all duration-200 ${formData.selectedItem?.id === s.id ? 'border-[#D4AF37] bg-yellow-50 shadow-sm' : 'border-gray-200 bg-white hover:border-[#D4AF37]'}`}>
                  <div><div className="font-bold text-gray-800 text-sm">{s.name}</div>{s.duration && <div className="text-xs text-gray-500 mt-1">{s.duration}</div>}</div><div className="font-bold text-sm" style={{ color: THEME.primary }}>{formatPrice(s.price)}</div>
                </div>
              ))}</div>
            )}
          </div>
        )
      })}</div>
      
      <div className="bg-yellow-50 rounded-xl p-4 border border-yellow-200 mt-6 flex justify-between items-center shadow-sm">
        <div className="flex items-center"><div className="w-10 h-10 bg-yellow-100 rounded-lg flex items-center justify-center mr-4"><Crown className="w-5 h-5" style={{ color: THEME.gold }} /></div><div><div className="font-bold text-yellow-800 text-sm">VVIP Master Room</div><div className="text-xs text-yellow-600 font-semibold mt-1">{formData.selectedItem?.vvipIncluded ? '✅ Included (Free)' : (!formData.selectedItem ? 'Select a service' : (isVipCurrentlyFull ? '🚫 လတ်တလော VIP အခန်းပြည့်နေပါသည်' : (formData.selectedItem.vvipPrice ? 'Upgrade for extra comfort' : 'Not available')))}</div></div></div>
        {formData.selectedItem?.vvipIncluded ? <span className="bg-green-100 text-green-700 px-3 py-1 rounded-full text-xs font-bold border border-green-200">INCLUDED</span> : <input type="checkbox" checked={formData.isVvipUpgrade} disabled={disableVvipToggle} onChange={(e) => setFormData({ ...formData, isVvipUpgrade: e.target.checked, time: '' })} className="w-6 h-6 accent-[#D4AF37] cursor-pointer disabled:opacity-50" />}
      </div>

      <div className={`mt-8 flex ${currentStep === 1 ? 'justify-end' : 'justify-between'}`}>
        {currentStep === 2 && <button type="button" onClick={() => handleNextStep(1)} className="px-6 py-4 rounded-lg font-bold text-gray-600 bg-white border border-gray-300 hover:bg-gray-50 transition">BACK</button>}
        <button type="button" disabled={!formData.selectedItem} onClick={() => handleNextStep(currentStep + 1)} className="px-8 py-4 rounded-lg font-bold text-white transition disabled:opacity-50 shadow-md hover:opacity-90 flex items-center" style={{ backgroundColor: THEME.primary }}>
          {isTherapistFirst && currentStep === 2 ? 'CONTINUE TO DATE & TIME' : 'CONTINUE TO THERAPIST'} <ChevronRight className="w-5 h-5 ml-2" />
        </button>
      </div>
    </div>
  );

  const renderTherapistSelection = (currentStep: number) => {
      let globalCheckDate = formData.date;
      if (!globalCheckDate) { const now = new Date(); if (now.getHours() >= 23) { const tmrw = new Date(now); tmrw.setDate(tmrw.getDate() + 1); globalCheckDate = tmrw.getFullYear() + '-' + String(tmrw.getMonth() + 1).padStart(2, '0') + '-' + String(tmrw.getDate()).padStart(2, '0'); } else { globalCheckDate = todayStr; } }
      const allFullyBooked = appData.therapists.length > 0 && appData.therapists.every(t => isTherapistFullForDate(t.name, globalCheckDate));
      const isSelectionIncomplete = isFourHands && formData.therapist !== null && formData.therapist2 === null; const isAnySelected = formData.therapist === null;

      return (
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

          <div className="text-center mb-8"><h2 className="text-2xl font-bold" style={{ color: THEME.primary }}>Select Your Therapist</h2><p className="text-sm font-bold mt-2" style={{ color: THEME.gold }}>{isFourHands ? '(ဘိုကင်ယူထားလိုသော ဝန်ထမ်း ၂ ယောက်ကို ရွေးချယ်ပါ)' : '(ဘိုကင်ယူထားလိုသော ဝန်ထမ်းနံပါတ်ကို ရွေးချယ်ပါ)'}</p></div>
          <div onClick={() => setFormData({ ...formData, therapist: null, therapist2: null, time: '' })} className={`flex items-center p-4 mb-6 rounded-xl cursor-pointer border transition-all duration-200 ${!formData.therapist ? 'border-[#D4AF37] bg-yellow-50 shadow-sm' : 'border-gray-200 bg-white hover:border-[#D4AF37]'}`}>
              <div className="w-12 h-12 bg-gray-200 rounded-full flex items-center justify-center mr-4"><User className="w-6 h-6 text-gray-500" /></div>
              <div><div className="font-bold text-gray-800">Any Available Therapist</div><div className="text-xs text-gray-500 mt-1">We'll assign the best available therapist for you</div></div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            {appData.therapists.map((therapist) => {
              const isSelected1 = formData.therapist?.id === therapist.id; const isSelected2 = formData.therapist2?.id === therapist.id; const isSelected = isSelected1 || isSelected2;
              const hasImage = therapist.images && therapist.images.length > 0; const isFull = isTherapistFullForDate(therapist.name, globalCheckDate);
              const fullTextEn = globalCheckDate === todayStr ? "Fully Booked For Today" : "Fully Booked"; const fullTextMm = globalCheckDate === todayStr ? "(ဒီနေ့အတွက် ဘိုကင်ပြည့်သွားပါပြီ)" : "(ဘိုကင်ပြည့်သွားပါပြီ)";

              return (
                <div key={therapist.id} onClick={() => {
                    if (isFull) return;
                    if (isFourHands) {
                        if (isSelected1) { setFormData({ ...formData, therapist: formData.therapist2, therapist2: null, time: '' }); } 
                        else if (isSelected2) { setFormData({ ...formData, therapist2: null, time: '' }); } 
                        else if (!formData.therapist) { setFormData({ ...formData, therapist: therapist, time: '' }); } 
                        else if (!formData.therapist2) { setFormData({ ...formData, therapist2: therapist, time: '' }); } 
                        else { setFormData({ ...formData, therapist2: therapist, time: '' }); }
                    } else { setFormData({ ...formData, therapist: therapist, therapist2: null, time: '' }); }
                }} className={`flex flex-col items-center p-3 rounded-xl transition-all border-2 relative overflow-hidden ${isFull ? 'cursor-not-allowed border-gray-200 bg-gray-50' : isSelected ? 'border-[#D4AF37] bg-yellow-50 shadow-lg transform scale-105 cursor-pointer' : 'border-transparent bg-white hover:border-[#D4AF37]/50 hover:shadow-md cursor-pointer'}`}>
                  
                  {isFull && (<div className="absolute inset-0 z-20 flex items-center justify-center pointer-events-none"><div className="bg-red-600 text-white font-bold px-2 py-1.5 rounded shadow-xl transform -rotate-12 text-center w-11/12 border border-red-500"><div className="text-[10px] sm:text-xs leading-tight">{fullTextEn}</div><div className="text-[8px] sm:text-[9px] leading-tight mt-1 text-red-50">{fullTextMm}</div></div></div>)}

                  {isSelected1 && isFourHands && <div className="absolute top-2 right-2 bg-[#D4AF37] text-[#123524] w-6 h-6 rounded-full flex items-center justify-center font-black text-xs z-30 shadow-md border-2 border-white">1</div>}
                  {isSelected2 && isFourHands && <div className="absolute top-2 right-2 bg-[#D4AF37] text-[#123524] w-6 h-6 rounded-full flex items-center justify-center font-black text-xs z-30 shadow-md border-2 border-white">2</div>}
                  {isSelected && !isFourHands && <div className="absolute top-2 right-2 bg-[#D4AF37] text-white w-6 h-6 rounded-full flex items-center justify-center z-30 shadow-md border-2 border-white"><Check className="w-4 h-4"/></div>}

                  <div className={`w-full aspect-[3/4] rounded-lg overflow-hidden mb-3 bg-gray-100 flex items-center justify-center shadow-inner relative border-2 transition-colors ${isSelected ? 'border-[#D4AF37]' : 'border-[#123524]'} ${isFull ? 'opacity-70' : ''}`}>
                    {hasImage ? (
                      <>
                        <img src={therapist.images[0]} alt={therapist.name} loading="lazy" className="w-full h-full object-cover object-top" />
                        {therapist.images.length > 1 && (
                          <button type="button" onClick={(e) => { e.stopPropagation(); setViewGallery({ images: therapist.images, index: 0 }); }} className="absolute bottom-2 inset-x-2 bg-[#123524]/90 hover:bg-[#123524] text-[#D4AF37] text-[10px] font-bold py-1 px-1 rounded flex flex-col items-center justify-center backdrop-blur-sm border border-[#D4AF37]/50 transition z-30 leading-tight">
                            <div className="flex items-center"><ImageIcon className="w-3 h-3 mr-1" /> See {therapist.images.length} photos</div><div className="text-[8px] mt-0.5 text-[#D4AF37]/80">(နောက်ထပ်ပုံများကြည့်ရန်)</div>
                          </button>
                        )}
                      </>
                    ) : (<div className="flex flex-col items-center"><User className="w-12 h-12 text-[#123524]" /></div>)}
                  </div>
                  <div className={`font-bold text-sm text-center w-full truncate px-1 ${isFull ? 'text-gray-600' : 'text-gray-800'}`}>{therapist.name}</div>
                  <div className={`text-[10px] mt-1 text-center ${isFull ? 'text-gray-300' : 'text-gray-400'}`}>Professional Therapist</div>
                  
                  {isTherapistFirst && !isFourHands && (
                    <button type="button" disabled={isFull} onClick={(e) => { e.stopPropagation(); setFormData({ ...formData, therapist: therapist, therapist2: null, time: '' }); handleNextStep(currentStep + 1); }} className={`mt-3 w-full py-2 rounded-lg text-xs font-bold flex items-center justify-center transition shadow-sm border ${isFull ? 'bg-red-500/50 text-white border-red-500/50 cursor-not-allowed' : 'bg-[#123524] text-[#D4AF37] hover:bg-[#1a4a32] border-[#1a4a32]'}`}>Book Now {!isFull && <ChevronRight className="w-3 h-3 ml-1" />}</button>
                  )}
                </div>
              )
            })}
          </div>
          
          <div className={`mt-8 flex flex-col gap-4`}>
             <div className={`flex ${currentStep === 1 ? 'justify-end' : 'justify-between'} w-full`}>
                {currentStep === 2 && <button type="button" onClick={() => handleNextStep(1)} className="px-6 py-4 rounded-lg font-bold text-gray-600 bg-white border border-gray-300 hover:bg-gray-50 transition">BACK</button>}
                <button type="button" disabled={(!isAnySelected && isSelectionIncomplete) || allFullyBooked} onClick={() => handleNextStep(currentStep + 1)} className={`px-8 py-4 rounded-lg font-bold text-white transition shadow-md flex items-center w-full sm:w-auto justify-center ${((!isAnySelected && isSelectionIncomplete) || allFullyBooked) ? 'bg-gray-300 cursor-not-allowed' : 'hover:opacity-90'}`} style={!((!isAnySelected && isSelectionIncomplete) || allFullyBooked) ? { backgroundColor: THEME.primary } : {}}>
                  {isTherapistFirst && currentStep === 1 ? 'CONTINUE TO SERVICE' : 'CONTINUE'} {isTherapistFirst && currentStep === 1 && <ChevronRight className="w-5 h-5 ml-2" />}
                </button>
             </div>
             {(!formData.date || formData.date === todayStr) && allFullyBooked && (
                 <div className="bg-gray-50 border border-gray-200 rounded-xl p-5 text-center shadow-sm w-full animate-fade-in mt-4">
                     <p className="text-sm font-bold text-gray-700 mb-3 leading-relaxed">ဒီနေ့အတွက် ဘိုကင်ယူနိုင်သည့်အချိန်ကျော်လွန်သွားပြီလား (သို့မဟုတ်) ဝန်ထမ်းများအားလုံး ပြည့်နေပါသလား?</p>
                     <button type="button" onClick={(e) => { e.stopPropagation(); const tomorrowStr = getTomorrowStr(); setFormData({ ...formData, therapist: null, therapist2: null, date: tomorrowStr, time: '' }); setAlertMessage(`ရွေးချယ်မည့်ရက်အား မနက်ဖြန် (${tomorrowStr}) သို့ ပြောင်းလဲလိုက်ပါသည်။ ဝန်ထမ်းကို ဆက်လက်ရွေးချယ်ပါ။`); window.scrollTo({ top: 0, behavior: 'smooth' }); }} className="inline-flex items-center px-6 py-3 bg-[#123524] text-[#D4AF37] font-bold text-sm rounded-lg hover:bg-[#1a4a32] shadow-md transition"><CalendarPlus className="w-5 h-5 mr-2" /> နောက်ရက်အတွက် ဘိုကင်ကြိုယူရန် နှိပ်ပါ</button>
                 </div>
             )}
          </div>
        </div>
      );
  };

  return (
    <div>
      <CustomAlert message={alertMessage} onClose={() => setAlertMessage('')} />
      
      {showAuthModal && (
        <div className="fixed inset-0 z-[9999] bg-black/80 flex items-center justify-center p-4">
           <div className="relative w-full max-w-sm">
              <button onClick={() => { setShowAuthModal(false); setLoading(false); }} className="absolute -top-12 right-0 text-white hover:text-red-400 p-2"><X className="w-8 h-8"/></button>
              <AuthRequest title="အကောင့်ရှိပြီးသားဖြစ်နေပါသည်" prefilledPhone={authModalPhone} skipToPassword={authModalHasPassword} onLoginSuccess={(loggedInPhone) => { setShowAuthModal(false); setVerifiedPhone(loggedInPhone); processBooking(loggedInPhone); }} />
           </div>
        </div>
      )}

      {renderStepper()}
      {step === 1 && (isTherapistFirst ? renderTherapistSelection(1) : renderServiceSelection(1))}
      {step === 2 && (isTherapistFirst ? renderServiceSelection(2) : renderTherapistSelection(2))}

      {step === 3 && (
        <div className="animate-fade-in px-2 sm:px-0">
          <div className="text-center mb-8"><h2 className="text-2xl font-bold" style={{ color: THEME.primary }}>Pick Date & Time</h2><p className="text-sm font-bold mt-2" style={{ color: THEME.gold }}>(ဘိုကင်ရယူလိုသော နေ့ရက် နှင့် အချိန် ကို ရွေးချယ် ပါ)</p></div>
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 mb-6">
            <label className="block mb-2 text-sm font-bold flex items-center" style={{ color: THEME.primary }}><Calendar className="w-4 h-4 mr-2" style={{ color: THEME.primary }} /> Select Date</label>
            <input type="date" min={minDateStr} max={maxDateStr} value={formData.date} onChange={(e) => setFormData({ ...formData, date: e.target.value, time: '' })} className="w-full p-4 border border-gray-200 rounded-lg focus:outline-none focus:border-[#D4AF37] text-gray-800 bg-gray-50 mb-6" />
            
            {staffClockIn && formData.date === todayStr ? (
                <div className="bg-yellow-50 p-5 rounded-lg border border-yellow-200 mb-4 animate-fade-in">
                    <label className="block mb-2 text-sm font-bold flex items-center text-yellow-800"><Clock className="w-4 h-4 mr-2" /> Service Start Time (ဧည့်သည်ရောက်ရှိချိန်)</label>
                    <input type="time" value={formData.time} onChange={(e) => setFormData({...formData, time: e.target.value})} className="w-full p-4 border border-gray-200 rounded-lg focus:outline-none focus:border-[#D4AF37] text-gray-800 bg-white mb-2 font-bold text-center tracking-wider text-lg" />
                    <p className="text-[10px] text-yellow-700 font-semibold text-center mt-1">အမှန်တကယ် စတင်သည့်အချိန်ကို ပြင်ဆင်ရွေးချယ်နိုင်ပါသည်။</p>
                </div>
            ) : (
                <>
                    <label className="block mb-4 text-sm font-bold flex items-center" style={{ color: THEME.primary }}><Clock className="w-4 h-4 mr-2" style={{ color: THEME.primary }} /> Available Times</label>
                    <div className={`grid gap-3 ${availableTimeSlots.length <= 2 ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-3 sm:grid-cols-4'}`}>
                        {availableTimeSlots.map(t => {
                            const state = checkSlotState(t); const displayTime = t.includes("to") ? t.split(" to ")[0].trim() : t;
                            return (
                                <button key={t} type="button" disabled={!formData.date} 
                                   onClick={() => {
                                       if (!state.available) {
                                           let neededSlots = 2; const fixedDetails = getFixedServiceDetails(formData.selectedItem?.name);
                                           if (fixedDetails) { const startIdx = ALL_TIME_SLOTS.indexOf(t.split(' to ')[0].trim()); let endIdx = ALL_TIME_SLOTS.indexOf(fixedDetails.end); if (fixedDetails.nextDay || endIdx === -1) endIdx = ALL_TIME_SLOTS.length; neededSlots = Math.max(1, endIdx - startIdx); } 
                                           else if (formData.selectedItem) { const match = (formData.selectedItem.duration || '').match(/(\d+)\s*Mins/i); if (match) neededSlots = Math.ceil(parseInt(match[1]) / 30); }
                                           const isUserVip = formData.isVvipUpgrade || formData.selectedItem?.vvipIncluded; const sIdx = ALL_TIME_SLOTS.indexOf(t.split(' to ')[0].trim()); let nextAvailable = '';
                                           for (let i = sIdx + 1; i < ALL_TIME_SLOTS.length; i++) {
                                               let durationFree = true; const actualTestStr = t.includes("to") ? `${ALL_TIME_SLOTS[i]} to ${t.split(' to ')[1]}` : ALL_TIME_SLOTS[i];
                                               for(let j=0; j < neededSlots; j++) {
                                                   const subSlot = ALL_TIME_SLOTS[i+j]; if(!subSlot) { durationFree = false; break; }
                                                   const subUsage = roomUsageMap.get(subSlot) || { vip: 0, normal: 0 }; const subTotal = subUsage.vip + subUsage.normal;
                                                   if (isUserVip && (subUsage.vip >= 3 || subTotal >= 5)) durationFree = false;
                                                   if (!isUserVip && (subUsage.normal >= 2 || subTotal >= 5)) durationFree = false;
                                               }
                                               if (durationFree && formData.therapist) { const tBlocked = getBlockedSlots(allBookings, formData.therapist.name, formData.date); const testSlots = getSlotsFromTimeText(actualTestStr, neededSlots); for (const slot of testSlots) { if (tBlocked.has(slot)) { durationFree = false; break; } } }
                                               if (durationFree && formData.therapist2) { const tBlocked2 = getBlockedSlots(allBookings, formData.therapist2.name, formData.date); const testSlots = getSlotsFromTimeText(actualTestStr, neededSlots); for (const slot of testSlots) { if (tBlocked2.has(slot)) { durationFree = false; break; } } }
                                               if (durationFree) { nextAvailable = ALL_TIME_SLOTS[i]; break; }
                                           }
                                           if (nextAvailable) { setAlertMessage(`လတ်တလော အခန်းပြည့်နေပါသည်၊ ${nextAvailable} အချိန်မှ ပြန်ရပါမည်။`); } else { setAlertMessage(`လတ်တလော အခန်းပြည့်နေပါသည်၊ ယနေ့အတွက် အခန်းမရနိုင်တော့ပါ။`); } return;
                                       }
                                       handleTimeSlotClick(t, state);
                                   }} 
                                   className={`py-3 px-2 text-xs sm:text-sm font-bold rounded-lg border transition-all ${ formData.time === t || formData.time.startsWith(`${displayTime} to`) ? 'border-[#D4AF37] bg-yellow-50 text-yellow-700 shadow-sm' : (!state.available) ? 'border-gray-200 bg-gray-100 text-gray-400 opacity-40 line-through cursor-not-allowed' : 'border-gray-200 bg-white text-gray-600 hover:border-[#D4AF37]' }`}>
                                   {displayTime}
                                </button>
                            )
                        })}
                    </div>
                    {formData.time && currentFixedDetails && (
                        <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-lg shadow-sm animate-fade-in text-center">
                            <p className="text-sm text-green-800 font-bold mb-1 flex items-center justify-center"><Clock className="w-4 h-4 mr-2" /> ဝန်ဆောင်မှု ရရှိမည့် အချိန်</p>
                            <p className="text-lg text-green-700 font-bold tracking-wide">{formData.time.split(' to ')[0].trim()} မှ {currentFixedDetails.end}{currentFixedDetails.nextDay ? ' (နောက်ရက်)' : ''} အထိ</p>
                            <p className="text-xs text-green-600 font-semibold mt-1">(စုစုပေါင်း ကြာချိန် - {calculateTimeDiff(formData.time.split(' to ')[0].trim(), currentFixedDetails.end, currentFixedDetails.nextDay)})</p>
                            <p className="text-[10px] text-green-600/80 mt-2 border-t border-green-200/50 pt-2">* အချိန်ကျော်လွန်ပြီးမှ ဘိုကင်ယူပါက ပြီးဆုံးမည့်အချိန်ထိသာ ဝန်ဆောင်မှုရရှိပါမည်။</p>
                        </div>
                    )}
                    {!currentFixedDetails && isSelectedNightService && (<div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg text-blue-800 text-[11px] sm:text-xs font-bold text-center flex items-center justify-center animate-fade-in shadow-sm"><Clock className="w-4 h-4 mr-2"/> ဝန်ဆောင်မှုသည် နောက်ရက် မနက် ၈:၀၀ နာရီတွင် ပြီးဆုံးပါမည်။</div>)}
                </>
            )}
            {availableTimeSlots.length === 0 && formData.date && !(staffClockIn && formData.date === todayStr) && <p className="text-sm text-red-500 mt-2 text-center">ရွေးချယ်ထားသော ဝန်ဆောင်မှုအတွက် အချိန်ရွေးချယ်၍ မရနိုင်ပါ။</p>}
          </div>
          <div className="mt-8 flex justify-between"><button type="button" onClick={() => handleNextStep(2)} className="px-6 py-4 rounded-lg font-bold text-gray-600 bg-white border border-gray-300 hover:bg-gray-50 transition">BACK</button><button type="button" disabled={!formData.date || !formData.time.trim()} onClick={() => handleNextStep(4)} className="px-8 py-4 rounded-lg font-bold text-white transition disabled:opacity-50 shadow-md hover:opacity-90" style={{ backgroundColor: THEME.primary }}>CONTINUE</button></div>
        </div>
      )}

      {step === 4 && (
        <form onSubmit={handleSubmit} className="animate-fade-in pb-10 px-2 sm:px-0">
          <div className="text-center mb-8"><h2 className="text-2xl font-bold" style={{ color: THEME.primary }}>Confirm Booking</h2><p className="text-sm font-bold mt-2" style={{ color: THEME.gold }}>(ဘိုကင်မှတ်တမ်းအား ပြန်လည်စစ်ဆေးပြီး အတည်ပြုပေးပါ)</p></div>
          
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 mb-6">
            <h3 className="text-sm font-bold tracking-widest uppercase mb-5" style={{ color: THEME.gold }}>Booking Summary</h3>
            <div className="space-y-4">
              <div className="flex justify-between items-start">
                <div><div className="font-bold text-gray-800 flex items-center"><Activity className="w-4 h-4 mr-2 text-yellow-600"/> {formData.selectedItem?.name || 'Unknown Service'}</div>{formData.selectedItem?.duration && <div className="text-sm text-gray-500 ml-6">{formData.selectedItem.duration}</div>}</div>
                <div className="font-bold text-gray-800 text-sm">{formatPrice(formData.selectedItem?.price)}</div>
              </div>
              {formData.isVvipUpgrade && !formData.selectedItem?.vvipIncluded && (
                <div className="flex justify-between items-start pt-2 border-t border-gray-50"><div className="font-bold flex items-center text-sm" style={{ color: THEME.gold }}><Crown className="w-4 h-4 mr-2" style={{ color: THEME.gold }}/>VVIP Room Extra Fee</div><div className="font-bold text-sm" style={{ color: THEME.gold }}>+{formatPrice((Number(formData.selectedItem?.vvipPrice) || 0) - (Number(formData.selectedItem?.price) || 0))}</div></div>
              )}
              {formData.selectedItem?.vvipIncluded && (<div className="flex justify-between items-start pt-2 border-t border-gray-50"><div className="font-bold text-green-600 flex items-center text-sm"><Crown className="w-4 h-4 mr-2 text-green-500"/>VVIP Master Room</div><div className="font-bold text-green-600 text-sm bg-green-50 px-2 py-0.5 rounded">Included (Free)</div></div>)}
              
              <div className="flex items-center text-sm font-bold text-gray-700 pt-2 border-t border-gray-50"><User className="w-4 h-4 mr-2" style={{ color: THEME.gold }} /> {formData.therapist && formData.therapist2 && (formData.selectedItem?.name || '').toLowerCase().includes('four hands') ? `${formData.therapist.name} & ${formData.therapist2.name}` : (formData.therapist ? formData.therapist.name : 'Any Available Therapist')}</div>
              <div className="flex items-center text-sm font-bold text-gray-700"><Calendar className="w-4 h-4 mr-2" style={{ color: THEME.gold }} /> {formData.date} at {formData.time}</div>
            </div>
            
            <div className="mt-6 pt-4 border-t-2 border-gray-100">
                <div className="flex justify-between items-center text-sm text-gray-600 mb-2"><span className="font-semibold">Subtotal</span><span className="font-bold">{formatPrice(calculateSubTotal())}</span></div>
                {finalDiscountPercent > 0 && (
                    <div className="flex justify-between items-center text-sm text-green-600 mb-2 bg-green-50 px-2 py-1.5 rounded border border-green-200 shadow-sm animate-fade-in"><span className="font-bold flex items-center"><Percent className="w-3 h-3 mr-1"/> {discountLabel}</span><span className="font-bold">-{formatPrice(calculateDiscountAmount())}</span></div>
                )}
                <div className="flex justify-between items-center mt-2 pt-2 border-t border-gray-50"><span className="font-bold text-gray-800">Final Total Price</span><span className="text-xl font-bold" style={{ color: THEME.gold }}>{formatPrice(calculateTotal())}</span></div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 mb-6">
             <h3 className="text-sm font-bold tracking-widest uppercase mb-4" style={{ color: THEME.gold }}>Special Request (Optional)</h3>
             <textarea name="specialRequest" value={formData.specialRequest || ''} onChange={handleChange} placeholder="Write any special requests or notes here..." className="w-full p-3 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:border-[#D4AF37] text-gray-800" rows={3} />
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
                    {selectedPaymentConfig ? (<div className="flex items-center font-bold text-[#D4AF37]">{selectedPaymentConfig.logoUrl && <img src={selectedPaymentConfig.logoUrl} alt="" loading="lazy" className="w-6 h-6 mr-3 object-contain bg-white rounded-sm p-0.5" />}{selectedPaymentConfig.name}</div>) : (<span className="font-bold text-[#D4AF37]">-- ရွေးချယ်ပါ --</span>)}
                    <ChevronDown className="w-5 h-5 text-[#D4AF37]" />
                  </div>
                  {paymentDropdownOpen && (
                    <><div className="fixed inset-0 z-40" onClick={() => setPaymentDropdownOpen(false)}></div>
                      <div className="absolute z-50 w-full mt-2 bg-[#123524] rounded-lg shadow-xl overflow-hidden border border-[#1a4a32]">
                        {safePaymentMethods.map(pm => (<div key={pm.id} className="p-4 flex items-center cursor-pointer hover:bg-[#1a4a32] border-b border-[#1a4a32] transition-colors" onClick={() => { setFormData({ ...formData, paymentMethod: pm.name }); setPaymentDropdownOpen(false); }}>{pm.logoUrl && <img src={pm.logoUrl} alt="" loading="lazy" className="w-7 h-7 mr-3 object-contain bg-white rounded-sm p-1" />}<span className="font-bold text-[#D4AF37] text-base">{pm.name}</span></div>))}
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
                {selectedPaymentConfig && (
                  <div className="text-center mb-4 p-3 rounded bg-red-50 border border-red-100 animate-fade-in"><p className="text-sm text-red-600 font-bold">စရံငွေလွှဲပြီး ဘိုကင်အတည်ပြုရန် ကျန်သောအချိန်</p><div className="text-2xl font-mono font-bold text-red-700 mt-1">{formattedCountdown}</div></div>
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

// 🌟 THE COMPONENT THAT RENDERS THE TABS AND MAIN VIEW (Moved to bottom) 🌟
export default function CustomerApp({ appData }: { appData: AppData }) {
  const [activeTab, setActiveTab] = useState<'book' | 'therapists' | 'dashboard' | 'history' | 'profile' | 'vip'>(() => {
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

  const [realtimeVip, setRealtimeVip] = useState<any>(appData.vipSettings);
  useEffect(() => {
      const unsub = onSnapshot(doc(db, 'settings', 'appData'), (snap) => {
          if (snap.exists() && snap.data().vipSettings) setRealtimeVip(snap.data().vipSettings);
      });
      return () => unsub();
  }, []);
  const mergedAppData = { ...appData, vipSettings: realtimeVip || appData.vipSettings || FALLBACK_VIP_SETTINGS };

  useEffect(() => { window.scrollTo({ top: 0, behavior: 'smooth' }); }, [activeTab]);

  useEffect(() => {
    if (!userPhone) return;
    const q = query(collection(db, 'bookings'), orderBy('createdAt', 'desc'), limit(50));
    const unsubscribe = onSnapshot(q, (snap) => {
      let changed = false;
      snap.docs.forEach((doc) => {
        const raw = doc.data(); const bPhone = decryptText(raw.phone) || raw.phone;
        if (bPhone === userPhone) {
          const oldStatus = prevStatuses.current[doc.id];
          if (oldStatus && oldStatus !== raw.status) changed = true;
          prevStatuses.current[doc.id] = raw.status;
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

  const baseTabs = [
    { id: 'book', label: 'Book Now', icon: CalendarPlus }, 
    { id: 'therapists', label: 'View Therapists', icon: User },
    { id: 'dashboard', label: 'Dashboard', icon: BarChart2 }, 
    { id: 'history', label: 'My Bookings', icon: History }
  ] as const;

  const vipSettings = mergedAppData.vipSettings;
  const tabs = vipSettings.isActive ? [...baseTabs, { id: 'vip', label: 'VIP Member', icon: Award }, { id: 'profile', label: 'Profile', icon: UserCircle }] : [...baseTabs, { id: 'profile', label: 'Profile', icon: UserCircle }];

  return (
    <div className="max-w-2xl mx-auto" onClick={handleInteraction}>
      <audio id="customer-alert-sound" src="https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3" preload="auto" />
      
      {/* 🌟 STICKY TAB NAVIGATION BAR 🌟 */}
      <div className="sticky top-[48px] z-[90] bg-gray-50/90 backdrop-blur-xl pt-2 pb-3 px-4 -mx-4 sm:px-0 sm:mx-0 mb-8 shadow-[0_10px_30px_-15px_rgba(0,0,0,0.1)] transition-all duration-300">
         <div className="max-w-2xl mx-auto">
            <div className="flex sm:hidden justify-end mb-1 pr-1">
               <span className="text-[9px] text-[#123524] font-bold flex items-center animate-pulse bg-white/80 px-2 py-0.5 rounded-full border border-gray-200 shadow-sm">
                  ဘေးသို့ဆွဲကြည့်ပါ <span className="text-[#D4AF37] ml-1 tracking-tighter font-black">&gt;&gt;</span>
               </span>
            </div>
            <div className="flex justify-start sm:justify-center items-center space-x-2 bg-white/95 p-1.5 sm:p-2 rounded-2xl shadow-sm border border-gray-200/80 overflow-x-auto scrollbar-hide snap-x snap-mandatory">
              {tabs.map((tab) => {
                const isActive = activeTab === tab.id;
                return (
                  <button key={tab.id} onClick={() => { setPrefillTherapist(null); setActiveTab(tab.id as any); }}
                    className={`snap-start relative flex-1 min-w-[75px] sm:min-w-[80px] flex flex-col sm:flex-row items-center justify-center py-3 px-1 sm:px-2 rounded-xl text-[9px] sm:text-xs md:text-sm font-bold transition-all duration-300 ${isActive ? 'bg-gray-50 shadow-md border border-gray-200 transform scale-[1.02]' : 'text-gray-500 hover:bg-gray-50/50 hover:text-gray-700'}`} style={{ color: isActive ? THEME.primary : undefined }}>
                    <tab.icon className={`w-4 h-4 sm:w-5 sm:h-5 mb-1 sm:mb-0 sm:mr-1.5 transition-all duration-300 ${isActive ? 'text-[#D4AF37] scale-110 drop-shadow-sm' : 'text-gray-400'} ${tab.id === 'vip' && isActive ? 'animate-pulse' : ''}`} />
                    <span className="text-center whitespace-nowrap">{tab.label}</span>
                    {tab.id === 'history' && hasNoti && <span className="absolute top-1 right-2 sm:top-2 sm:right-4 w-2 h-2 sm:w-2.5 sm:h-2.5 bg-red-500 rounded-full shadow-md animate-ping"></span>}
                    {tab.id === 'history' && hasNoti && <span className="absolute top-1 right-2 sm:top-2 sm:right-4 w-2 h-2 sm:w-2.5 sm:h-2.5 bg-red-500 rounded-full shadow-md"></span>}
                  </button>
                )
              })}
            </div>
         </div>
      </div>
      
      {activeTab === 'book' && <CustomerBookingWizard appData={mergedAppData} userPhone={userPhone} onBooked={(phone) => { setUserPhone(phone); localStorage.setItem('shangrila_user_phone', phone); setActiveTab('history'); }} />}
      {activeTab === 'therapists' && <CustomerBookingWizard key={prefillTherapist ? prefillTherapist.id : 'default'} appData={mergedAppData} userPhone={userPhone} forceTherapistFirst={true} initialTherapist={prefillTherapist} onBooked={(phone) => { setUserPhone(phone); localStorage.setItem('shangrila_user_phone', phone); setActiveTab('history'); setPrefillTherapist(null); }} />}
      {activeTab === 'dashboard' && <CustomerDashboard appData={mergedAppData} onBookTherapist={handleDashboardBook} />}
      {activeTab === 'history' && <CustomerHistory userPhone={userPhone} onLoginSuccess={(phone) => { setUserPhone(phone); localStorage.setItem('shangrila_user_phone', phone); }} />}
      {activeTab === 'profile' && <CustomerProfile appData={mergedAppData} userPhone={userPhone} onLoginSuccess={(phone) => { setUserPhone(phone); localStorage.setItem('shangrila_user_phone', phone); }} onLogout={() => { setUserPhone(''); localStorage.removeItem('shangrila_user_phone'); setActiveTab('book'); }} />}
      {activeTab === 'vip' && <VipProgramView appData={mergedAppData} onGoToProfile={() => setActiveTab('profile')} />}
    </div>
  );
}
