import React, { useState, useEffect, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { collection, addDoc, getDocs, getDoc, updateDoc, doc, query, onSnapshot, where, orderBy, limit } from 'firebase/firestore';
import { db, patchFirestoreDocumentFast, reconnectFirestoreNetwork } from '../firebase';
import { encryptText, decryptText } from '../security';

import { Calendar, Clock, CreditCard, CheckCircle, User, Phone, ChevronRight, ChevronLeft, Check, Sparkles, Droplets, Scissors, Home, ChevronDown, ChevronUp, History, UserCircle, CalendarPlus, ImageIcon, Activity, Crown, Copy, Percent, AlertCircle, KeyRound, BarChart2, Edit, LogOut, X, Trash2, Award, Star, ShieldCheck, Gift, Target, Info, MessageCircle, UserPlus, ShieldAlert, PartyPopper, Bell, Send, RefreshCw} from 'lucide-react';
import { THEME, AppData, Booking, MenuItem, TherapistProfile, UserProfile, formatPrice, resolvePromotionType, resolveMiniGameStyle, getCategoryDiscountPercent } from '../shared';

import { useAppStore } from '../AppDataContext';
import ThadingyutCampaign from './ThadingyutCampaign';
import {
  notifyBookingEvent,
  notifyStaffUpdate,
  fetchBotUsername,
  normalizePhone,
  generateSecureOtpCode,
  generateOtpRequestToken,
  requestCustomerPasswordOtp,
  pollAndDeliverPendingOtpForUser
} from '../telegramService';
import { playCustomerChime, unlockAudioContext } from '../utils/soundEffects';

// 🌟 iOS PWA / Safari / Browser အားလုံးတွင် Popup မပိတ်စေဘဲ ချက်ချင်း Telegram ပွင့်စေမည့် Synchronous Helper 🌟
const getInstantTelegramLink = (phoneStr?: string, bookingId?: string) => {
  const botUser = (
    localStorage.getItem('shangrila_bot_username') ||
    import.meta.env.VITE_TELEGRAM_BOT_USERNAME ||
    'theshangrilamenretreat'
  )
    .replace(/^@/, '')
    .trim();
  const cleanPhone = normalizePhone(phoneStr) || 'guest';
  const cleanBId = (bookingId || '').replace(/[^a-zA-Z0-9]/g, '').slice(-12);
  const startParam = cleanBId ? `book_${cleanBId}_${cleanPhone}` : `sub_${cleanPhone}`;
  return {
    httpsUrl: `https://t.me/${botUser}?start=${startParam}`,
    tgAppUrl: `tg://resolve?domain=${botUser}&start=${startParam}`,
  };
};

// 🌟 Fullscreen Portal Lightbox for Therapist Photos (Header, Tab Bar, Stepper, Telegram Button တို့ လုံးဝမဖုံးစေရန် document.body သို့ Portal ဖြင့် Render လုပ်သည်) 🌟
const TherapistPhotoLightbox = ({
  gallery,
  onChangeIndex,
  onClose,
}: {
  gallery: { images: string[]; index: number; name?: string } | null;
  onChangeIndex: (nextIndex: number) => void;
  onClose: () => void;
}) => {
  const touchStartXRef = useRef<number | null>(null);

  useEffect(() => {
    if (!gallery) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      else if (e.key === 'ArrowLeft' && gallery.images.length > 1) {
        onChangeIndex((gallery.index - 1 + gallery.images.length) % gallery.images.length);
      } else if (e.key === 'ArrowRight' && gallery.images.length > 1) {
        onChangeIndex((gallery.index + 1) % gallery.images.length);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [gallery, onChangeIndex, onClose]);

  if (!gallery || typeof document === 'undefined') return null;

  const total = gallery.images.length;
  const goPrev = () => onChangeIndex((gallery.index - 1 + total) % total);
  const goNext = () => onChangeIndex((gallery.index + 1) % total);

  return createPortal(
    <div
      className="fixed inset-0 z-[99999] bg-black/95 backdrop-blur-md flex flex-col justify-between select-none"
      style={{
        paddingTop: 'max(0.875rem, env(safe-area-inset-top))',
        paddingBottom: 'max(1.25rem, env(safe-area-inset-bottom))',
      }}
      onClick={onClose}
      onTouchStart={(e) => {
        touchStartXRef.current = e.touches[0]?.clientX ?? null;
      }}
      onTouchEnd={(e) => {
        if (touchStartXRef.current === null || total <= 1) return;
        const endX = e.changedTouches[0]?.clientX ?? touchStartXRef.current;
        const delta = endX - touchStartXRef.current;
        touchStartXRef.current = null;
        if (delta > 45) goPrev();
        else if (delta < -45) goNext();
      }}
    >
      {/* Top Bar: Therapist Name + Counter + Close Button */}
      <div
        className="w-full flex items-center justify-between px-4 sm:px-6 z-20 flex-shrink-0"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2.5 min-w-0">
          {gallery.name && (
            <span className="text-white/95 font-bold text-sm sm:text-base truncate tracking-wide">
              {gallery.name}
            </span>
          )}
          {total > 1 && (
            <span className="text-[#D4AF37] text-xs font-bold bg-white/10 px-3 py-1 rounded-full border border-[#D4AF37]/35 tracking-widest flex-shrink-0">
              {gallery.index + 1} / {total}
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close gallery"
          className="w-10 h-10 flex items-center justify-center rounded-full bg-white/15 hover:bg-white/25 active:scale-95 text-white border border-white/20 shadow-lg transition flex-shrink-0"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Main Photo Area: Large, Phone-Screen Fitted & Centered */}
      <div
        className="relative flex-1 w-full flex items-center justify-center px-2.5 sm:px-10 py-3 min-h-0"
        onClick={(e) => e.stopPropagation()}
      >
        <img
          src={gallery.images[gallery.index]}
          alt={gallery.name ? `${gallery.name} photo ${gallery.index + 1}` : 'Therapist Photo'}
          className="w-full sm:w-auto max-w-[95vw] sm:max-w-2xl max-h-[80dvh] object-contain rounded-2xl shadow-[0_24px_64px_rgba(0,0,0,0.85)] border border-white/10"
        />

        {total > 1 && (
          <>
            <button
              type="button"
              onClick={goPrev}
              aria-label="Previous photo"
              className="absolute left-3 sm:left-6 top-1/2 -translate-y-1/2 w-10 h-10 sm:w-11 sm:h-11 flex items-center justify-center bg-black/55 hover:bg-black/80 active:scale-95 text-white rounded-full border border-white/25 backdrop-blur-sm shadow-xl transition"
            >
              <ChevronLeft className="w-6 h-6" />
            </button>
            <button
              type="button"
              onClick={goNext}
              aria-label="Next photo"
              className="absolute right-3 sm:right-6 top-1/2 -translate-y-1/2 w-10 h-10 sm:w-11 sm:h-11 flex items-center justify-center bg-black/55 hover:bg-black/80 active:scale-95 text-white rounded-full border border-white/25 backdrop-blur-sm shadow-xl transition"
            >
              <ChevronRight className="w-6 h-6" />
            </button>
          </>
        )}
      </div>

      {/* Bottom Indicator Dots */}
      <div
        className="w-full flex items-center justify-center gap-2 px-4 z-20 flex-shrink-0 min-h-[24px]"
        onClick={(e) => e.stopPropagation()}
      >
        {total > 1 &&
          gallery.images.map((_, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => onChangeIndex(idx)}
              aria-label={`Photo ${idx + 1}`}
              className={`h-2 rounded-full transition-all duration-200 ${
                idx === gallery.index
                  ? 'w-7 bg-[#D4AF37] shadow-[0_0_8px_rgba(212,175,55,0.75)]'
                  : 'w-2 bg-white/35 hover:bg-white/60'
              }`}
            />
          ))}
      </div>
    </div>,
    document.body
  );
};

// 🌟 Safe iOS/PWA external Telegram launch: cancels fallback redirect as soon as Telegram opens so returning never triggers a second navigation abort 🌟
const launchTelegramExternalUrl = (tgAppUrl: string, httpsUrl: string) => {
  const isIOS =
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const isPWA =
    window.matchMedia?.('(display-mode: standalone)').matches || (window.navigator as any)?.standalone === true;

  if (isIOS || isPWA) {
    let settled = false;
    const cleanup = () => {
      settled = true;
      clearTimeout(fallbackTimer);
      document.removeEventListener('visibilitychange', onHide);
      window.removeEventListener('pagehide', onHide);
      window.removeEventListener('blur', onHide);
    };
    const onHide = () => {
      if (document.visibilityState === 'hidden' || document.hidden) {
        cleanup();
      } else {
        cleanup();
      }
    };
    document.addEventListener('visibilitychange', onHide);
    window.addEventListener('pagehide', onHide);
    window.addEventListener('blur', onHide);

    const fallbackTimer = setTimeout(() => {
      if (!settled && document.visibilityState === 'visible') {
        cleanup();
        window.location.href = httpsUrl;
      } else {
        cleanup();
      }
    }, 650);

    window.location.href = tgAppUrl;
  } else {
    const w = window.open(httpsUrl, '_blank', 'noopener,noreferrer');
    if (!w) window.location.href = httpsUrl;
  }
};

const openTelegramBotInstantly = (phoneStr?: string, bookingId?: string) => {
  const { httpsUrl, tgAppUrl } = getInstantTelegramLink(phoneStr, bookingId);
  fetchBotUsername().catch(() => {});
  launchTelegramExternalUrl(tgAppUrl, httpsUrl);
};

// 🌟 Open Telegram Bot with custom start payload (used for Password Reset OTP auto-delivery) 🌟
const getTelegramBotStartUrls = (startParam: string) => {
  const botUser = (
    localStorage.getItem('shangrila_bot_username') ||
    import.meta.env.VITE_TELEGRAM_BOT_USERNAME ||
    'theshangrilamenretreat'
  )
    .replace(/^@/, '')
    .trim();
  return {
    httpsUrl: `https://t.me/${botUser}?start=${encodeURIComponent(startParam)}`,
    tgAppUrl: `tg://resolve?domain=${botUser}&start=${encodeURIComponent(startParam)}`,
  };
};

const openTelegramBotWithStartParam = (startParam: string, overrideHttpsUrl?: string, overrideTgUrl?: string) => {
  const fallback = getTelegramBotStartUrls(startParam);
  const httpsUrl = overrideHttpsUrl || fallback.httpsUrl;
  const tgAppUrl = overrideTgUrl || fallback.tgAppUrl;
  launchTelegramExternalUrl(tgAppUrl, httpsUrl);
};

// 🌟 Resilient User Doc Update (SDK + Stateless HTTPS REST race — saves in <500ms even if iOS froze Firestore WebChannel!) 🌟
const resilientUpdateUserDoc = async (
  targetUserId: string,
  payload: Record<string, string | number | boolean | null>,
  timeoutMs: number = 8000
): Promise<void> => {
  let sdkResolved = false;

  const sdkPromise = updateDoc(doc(db, 'users', targetUserId), payload).then(() => {
    sdkResolved = true;
    return 'sdk' as const;
  });

  const restPromise = patchFirestoreDocumentFast('users', targetUserId, payload, Math.max(4000, timeoutMs - 500)).then((ok) => {
    if (!ok) throw new Error('rest_failed');
    return 'rest' as const;
  });

  const winner = await new Promise<'sdk' | 'rest'>((resolve, reject) => {
    let finished = false;
    let failureCount = 0;

    const timer = setTimeout(() => {
      if (!finished) {
        finished = true;
        reject(new Error('timeout'));
      }
    }, timeoutMs);

    const onSuccess = (source: 'sdk' | 'rest') => {
      if (!finished) {
        finished = true;
        clearTimeout(timer);
        resolve(source);
      }
    };

    const onFailure = () => {
      failureCount += 1;
      if (failureCount >= 2 && !finished) {
        finished = true;
        clearTimeout(timer);
        reject(new Error('write_failed'));
      }
    };

    sdkPromise.then(onSuccess, onFailure);
    restPromise.then(onSuccess, onFailure);
  });

  // If stateless REST won while Firestore SDK socket was still stalled on iOS resume, cycle SDK network in background
  if (winner === 'rest' && !sdkResolved) {
    reconnectFirestoreNetwork(true).catch(() => {});
  }
};

// 🌟 Safe helper to read Customer's active Telegram Chat ID (fixes operator-precedence bug) 🌟
const getActiveCustomerTelegramChatId = (): string => {
  try {
    const webAppUserId = (window as any)?.Telegram?.WebApp?.initDataUnsafe?.user?.id;
    if (webAppUserId) return String(webAppUserId).trim();
  } catch {}
  try {
    const direct = localStorage.getItem('shangrila_customer_chat_id');
    if (direct && direct.trim()) return direct.trim();
  } catch {}
  try {
    const rawUser = localStorage.getItem('shangrila_tg_user');
    if (rawUser) {
      const parsed = JSON.parse(rawUser);
      if (parsed?.chatId) return String(parsed.chatId).trim();
    }
  } catch {}
  return '';
};


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
// AUTH REQUEST (LOGIN, FORGOT PASSWORD & REGISTER) - LUXURY UI
// ==========================================
export function AuthRequest({ onLoginSuccess, title, prefilledPhone = '', skipToPassword = false }: { onLoginSuccess: (phone: string) => void, title: string, prefilledPhone?: string, skipToPassword?: boolean }) {
  const [phone, setPhone] = useState(prefilledPhone);
  const [password, setPassword] = useState('');
  
  // Registration Form State
  const [regForm, setRegForm] = useState({ name: '', dob: '', password: '' });

  // Reset Password State (Telegram Bot Auto-OTP System)
  const [userId, setUserId] = useState<string | null>(null);
  const [otpState, setOtpState] = useState<'none' | 'verify'>('none');
  const [generatedOtp, setGeneratedOtp] = useState('');
  const [otpToken, setOtpToken] = useState('');
  const [otpExpiresAt, setOtpExpiresAt] = useState<number>(0);
  const [otpSentToTelegram, setOtpSentToTelegram] = useState(false);
  const [otpBotUrls, setOtpBotUrls] = useState<{ httpsUrl: string; tgAppUrl: string } | null>(null);
  const [otpInput, setOtpInput] = useState('');
  const [focusedOtpIdx, setFocusedOtpIdx] = useState<number | null>(null);
  const otpBoxRefs = useRef<(HTMLInputElement | null)[]>([]);
  const lastAutoVerifiedRef = useRef<string>('');
  const [otpAttempts, setOtpAttempts] = useState(0);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [otpRemainingSecs, setOtpRemainingSecs] = useState(0);
  const [checkingBotDelivery, setCheckingBotDelivery] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  
  // 🌟 App Data for OTP Contacts & Welcome Bonus
  const [appDataState, setAppDataState] = useState<any>(null);

  // Steps: 1=Phone, 2=Login, 3=Reset Request & Bot OTP Verify, 4=Register, 5=Set New Password
  const [step, setStep] = useState(skipToPassword ? 2 : 1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // 🌟 Fetch AppData on Mount & Resolve userId when prefilledPhone is provided (e.g. Booking Auth Modal)
  useEffect(() => {
      getDoc(doc(db, 'settings', 'appData')).then(snap => {
          if(snap.exists()) setAppDataState(snap.data());
      });
      fetchBotUsername().catch(() => {});
  }, []);

  useEffect(() => {
      if (!prefilledPhone || userId) return;
      const cleanPrefill = prefilledPhone.trim();
      if (!cleanPrefill) return;
      getDocs(collection(db, 'users')).then((snap) => {
          snap.forEach((d) => {
              try {
                  const data = d.data();
                  const decPhone = decryptText(data.phone) || d.id;
                  if (decPhone === cleanPrefill || d.id === cleanPrefill) {
                      setUserId(d.id);
                  }
              } catch {}
          });
      }).catch(() => {});
  }, [prefilledPhone, userId]);

  // Real-time listener on users/{userId} so when Telegram Bot delivers OTP, UI immediately turns green & stays synced
  useEffect(() => {
      if (step === 3 && otpState === 'verify' && userId) {
          const unsub = onSnapshot(doc(db, 'users', userId), (docSnap) => {
              if (docSnap.exists()) {
                  const data = docSnap.data();
                  if (data.otpSentToTelegram === true && (!otpToken || data.otpToken === otpToken)) {
                      setOtpSentToTelegram(true);
                  }
                  if (data.resetOtp) {
                      const dec = decryptText(data.resetOtp) || '';
                      if (dec && dec.length === 6) {
                          setGeneratedOtp((prev) => (prev !== dec ? dec : prev));
                      }
                  }
                  if (data.otpExpiresAt) {
                      setOtpExpiresAt(Number(data.otpExpiresAt));
                  }
              }
          });
          return () => unsub();
      }
  }, [step, otpState, userId, otpToken]);

  // Background Telegram Bot delivery poller (works even when Admin Panel is closed!)
  useEffect(() => {
      if (step !== 3 || otpState !== 'verify' || otpSentToTelegram || !userId || !generatedOtp || !otpToken) return;
      let cancelled = false;

      const runCheck = async () => {
          if (cancelled) return;
          const res = await pollAndDeliverPendingOtpForUser({
              userId,
              phone: phone.trim(),
              otp: generatedOtp,
              otpToken,
          });
          if (!cancelled && res.delivered) {
              setOtpSentToTelegram(true);
          }
      };

      runCheck();
      const interval = setInterval(runCheck, 3000);
      const handleVisibility = () => {
          if (document.visibilityState === 'visible') runCheck();
      };
      window.addEventListener('focus', runCheck);
      document.addEventListener('visibilitychange', handleVisibility);

      return () => {
          cancelled = true;
          clearInterval(interval);
          window.removeEventListener('focus', runCheck);
          document.removeEventListener('visibilitychange', handleVisibility);
      };
  }, [step, otpState, otpSentToTelegram, userId, phone, generatedOtp, otpToken]);

  // Countdown timers (Resend cooldown + 10-minute OTP expiry)
  useEffect(() => {
      if (resendCooldown <= 0) return;
      const t = setInterval(() => setResendCooldown((c) => Math.max(0, c - 1)), 1000);
      return () => clearInterval(t);
  }, [resendCooldown]);

  useEffect(() => {
      if (step !== 3 || otpState !== 'verify' || !otpExpiresAt) return;
      const updateRemain = () => {
          const left = Math.max(0, Math.floor((otpExpiresAt - Date.now()) / 1000));
          setOtpRemainingSecs(left);
      };
      updateRemain();
      const t = setInterval(updateRemain, 1000);
      return () => clearInterval(t);
  }, [step, otpState, otpExpiresAt]);

  const handleNext = async (e: React.FormEvent) => {
    e.preventDefault(); setError(''); setSuccessMsg(''); setLoading(true);
    try {
      const snap = await getDocs(collection(db, 'users'));
      let found = false; let userPass = ''; let foundId = null;
      snap.forEach(d => {
         try {
             const data = d.data(); const decPhone = decryptText(data.phone) || d.id;
             if (decPhone === phone.trim() || d.id === phone.trim()) { 
                 found = true; userPass = decryptText(data.password); foundId = d.id;
                 const expAt = Number(data.otpExpiresAt || 0);
                 if (data.resetRequested && data.resetOtp && expAt > Date.now()) {
                     setOtpState('verify');
                     setGeneratedOtp(decryptText(data.resetOtp) || '');
                     setOtpToken(String(data.otpToken || ''));
                     setOtpExpiresAt(expAt);
                     setOtpSentToTelegram(Boolean(data.otpSentToTelegram));
                     setOtpAttempts(Number(data.otpAttempts || 0));
                 } else {
                     setOtpState('none');
                 }
             }
         } catch(err) {}
      });
      
      setUserId(foundId);

      if (!found) { 
          setError("သင်ထည့်လိုက်သောဖုန်းနံပါတ်ဖြင့် အကောင့်ရှာမတွေ့ပါ။ အောက်ပါ 'အကောင့်သစ်ဖွင့်ရန်' ခလုတ်ကို နှိပ်ပေးပါ။"); 
      }
      else { 
          if (userPass) { setStep(2); } 
          else { onLoginSuccess(phone.trim()); } 
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

  // 🌟 Self-Service Telegram Bot Auto-OTP Request (Zero Admin Wait!) 🌟
  const handleRequestOTP = async (autoOpenBot: boolean = true) => {
      setLoading(true); setError(''); setSuccessMsg('');
      try {
          let targetUserId = userId;
          const cleanPhoneInput = phone.trim();
          if (!targetUserId && cleanPhoneInput) {
              const snap = await getDocs(collection(db, 'users'));
              snap.forEach((d) => {
                  try {
                      const data = d.data();
                      const decPhone = decryptText(data.phone) || d.id;
                      if (decPhone === cleanPhoneInput || d.id === cleanPhoneInput) {
                          targetUserId = d.id;
                      }
                  } catch {}
              });
              if (targetUserId) setUserId(targetUserId);
          }

          if (!targetUserId) {
              setError('အကောင့်ရှာမတွေ့ပါ။ ဖုန်းနံပါတ် ပြန်လည်စစ်ဆေးပေးပါ။');
              setLoading(false);
              return;
          }

          const otp = generateSecureOtpCode();
          const token = generateOtpRequestToken();
          const expiresAt = Date.now() + 10 * 60 * 1000; // 10 minutes validity
          const activeChatId = getActiveCustomerTelegramChatId();

          await resilientUpdateUserDoc(targetUserId, {
              resetRequested: true,
              resetOtp: encryptText(otp),
              otpToken: token,
              otpExpiresAt: expiresAt,
              otpAttempts: 0,
              otpSentToTelegram: false,
              otpApproved: true,
              otpRequestedAt: Date.now()
          });

          setGeneratedOtp(otp);
          setOtpToken(token);
          setOtpExpiresAt(expiresAt);
          setOtpAttempts(0);
          setOtpInput('');
          lastAutoVerifiedRef.current = '';
          setOtpSentToTelegram(false);
          setResendCooldown(45);

          const dispatchRes = await requestCustomerPasswordOtp({
              userId: targetUserId,
              phone: cleanPhoneInput,
              otp,
              otpToken: token,
              explicitChatId: activeChatId || undefined,
          });

          setOtpBotUrls({ httpsUrl: dispatchRes.httpsUrl, tgAppUrl: dispatchRes.tgAppUrl });
          if (dispatchRes.sentDirectly) {
              setOtpSentToTelegram(true);
          }

          // Immediately transition to Enter 6-Digit OTP verification step
          setOtpState('verify');

          // Auto-open Telegram Bot so user lands straight on the Bot chat to receive/copy their OTP
          if (autoOpenBot) {
              const cleanNormPhone = normalizePhone(cleanPhoneInput) || cleanPhoneInput.replace(/[^0-9]/g, '') || 'user';
              openTelegramBotWithStartParam(
                  `otp_${cleanNormPhone}_${token}`,
                  dispatchRes.httpsUrl,
                  dispatchRes.tgAppUrl
              );
          }
      } catch (e) {
          setError('OTP တောင်းခံရာတွင် အခက်အခဲရှိနေပါသည်။ ထပ်မံကြိုးစားပေးပါ။');
      } finally {
          setLoading(false);
      }
  };

  const handleManualCheckBotOtp = async () => {
      if (!userId || !generatedOtp || !otpToken) return;
      setCheckingBotDelivery(true);
      setError('');
      try {
          const res = await pollAndDeliverPendingOtpForUser({
              userId,
              phone: phone.trim(),
              otp: generatedOtp,
              otpToken,
          });
          if (res.delivered) {
              setOtpSentToTelegram(true);
          } else {
              setError('Telegram Bot ထဲတွင် START ခလုတ်ကို နှိပ်ပြီးပြီလား စစ်ဆေးပေးပါ (နှိပ်ပြီးပါက စက္ကန့်အနည်းငယ်အတွင်း OTP ရောက်လာပါမည်)။');
          }
      } finally {
          setCheckingBotDelivery(false);
      }
  };

  const verifyOtpCode = async (codeOverride?: string) => {
      setError('');
      const entered = (codeOverride ?? otpInput).replace(/\D/g, '').slice(0, 6);
      if (entered.length !== 6) {
          setError('Telegram Bot မှ ရရှိသော ဂဏန်း ၆ လုံး (OTP) ကို ပြည့်စုံစွာ ရိုက်ထည့်ပေးပါ။');
          return;
      }
      if (otpExpiresAt && Date.now() > otpExpiresAt) {
          setError('OTP သက်တမ်း (၁၀ မိနစ်) ကုန်ဆုံးသွားပါပြီ။ "OTP အသစ် ပြန်တောင်းရန်" ကို နှိပ်ပေးပါ။');
          return;
      }
      if (otpAttempts >= 5) {
          setError('OTP မှားယွင်းရိုက်ထည့်မှု အကြိမ်ရေ ပြည့်သွားပါပြီ။ ကျေးဇူးပြု၍ OTP အသစ် ပြန်တောင်းပေးပါ။');
          return;
      }

      // 🌟 Fast-Path Instant Verification (0ms, zero hang even after iOS app-switch from Telegram!) 🌟
      if (generatedOtp && generatedOtp.length === 6 && entered === generatedOtp) {
          setError('');
          setLoading(false);
          setStep(5);
          return;
      }

      // Fallback: Check Firestore with a strict 2.5s timeout so iOS WebKit resume NEVER hangs on "စစ်ဆေးနေပါသည်..."
      setLoading(true);
      try {
          let expectedOtp = generatedOtp;
          if (userId) {
              const timeoutPromise = new Promise<null>((resolve) => setTimeout(() => resolve(null), 2500));
              const uSnap = await Promise.race([
                  getDoc(doc(db, 'users', userId)).catch(() => null),
                  timeoutPromise
              ]);
              if (uSnap && uSnap.exists()) {
                  const uData = uSnap.data();
                  if (uData.otpExpiresAt && Date.now() > Number(uData.otpExpiresAt)) {
                      setError('OTP သက်တမ်း ကုန်ဆုံးသွားပါပြီ။ OTP အသစ် ပြန်တောင်းပေးပါ။');
                      return;
                  }
                  const freshOtp = decryptText(uData.resetOtp) || '';
                  if (freshOtp) {
                      expectedOtp = freshOtp;
                      setGeneratedOtp(freshOtp);
                  }
              }
          }

          if (!expectedOtp) {
              setError('အင်တာနက်ချိတ်ဆက်မှု နှေးကွေးနေပါသည်။ ခဏစောင့်ပြီး ထပ်မံအတည်ပြုပေးပါ။');
              return;
          }

          if (entered !== expectedOtp) {
              const nextAttempts = otpAttempts + 1;
              setOtpAttempts(nextAttempts);
              if (userId) {
                  updateDoc(doc(db, 'users', userId), { otpAttempts: nextAttempts }).catch(() => {});
              }
              setError(`OTP ကုဒ် မှားယွင်းနေပါသည်။ (${Math.max(0, 5 - nextAttempts)} ကြိမ်သာ ကျန်ရှိတော့သည်)`);
              return;
          }

          // OTP Verified! Proceed directly to Set New Password (Step 5)
          setError('');
          setStep(5);
      } catch {
          setError('OTP စစ်ဆေးရာတွင် အခက်အခဲရှိနေပါသည်။ ထပ်မံကြိုးစားပေးပါ။');
      } finally {
          setLoading(false);
      }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
      e.preventDefault();
      await verifyOtpCode();
  };

  // Auto-verify smoothly when all 6 digits are filled (e.g. Copy/Paste or 6th digit typed)
  useEffect(() => {
      if (step !== 3 || otpState !== 'verify') return;
      const clean = otpInput.replace(/\D/g, '');
      if (clean.length < 6) {
          lastAutoVerifiedRef.current = '';
          return;
      }
      if (clean.length === 6 && !loading && lastAutoVerifiedRef.current !== clean) {
          lastAutoVerifiedRef.current = clean;
          const t = setTimeout(() => {
              verifyOtpCode(clean);
          }, 180);
          return () => clearTimeout(t);
      }
  }, [otpInput, step, otpState, loading]);

  const applyOtpString = (raw: string, startIndex: number = 0) => {
      const digits = raw.replace(/\D/g, '');
      if (!digits) return;
      if (error) setError('');

      // Full or multi-digit paste (e.g. "985604" or "OTP: 985 604") -> fill from box 0
      if (digits.length > 1) {
          const six = digits.slice(0, 6);
          setOtpInput(six);
          const focusIdx = Math.min(six.length - 1, 5);
          requestAnimationFrame(() => otpBoxRefs.current[focusIdx]?.focus());
          return;
      }

      // Single digit entry: replace existing slot or append at first empty slot
      const targetIdx = startIndex > otpInput.length ? otpInput.length : startIndex;
      const chars = Array.from({ length: 6 }, (_, i) => otpInput[i] || '');
      chars[targetIdx] = digits[0];
      const next = chars.join('').slice(0, 6);
      setOtpInput(next);
      if (targetIdx < 5) {
          requestAnimationFrame(() => otpBoxRefs.current[targetIdx + 1]?.focus());
      }
  };

  const handleOtpBoxKeyDown = (idx: number, e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Backspace') {
          e.preventDefault();
          if (error) setError('');
          const chars = Array.from({ length: 6 }, (_, i) => otpInput[i] || '');
          if (chars[idx]) {
              chars[idx] = '';
              setOtpInput(chars.join(''));
          } else if (idx > 0) {
              chars[idx - 1] = '';
              setOtpInput(chars.join(''));
              requestAnimationFrame(() => otpBoxRefs.current[idx - 1]?.focus());
          }
      } else if (e.key === 'ArrowLeft' && idx > 0) {
          e.preventDefault();
          otpBoxRefs.current[idx - 1]?.focus();
      } else if (e.key === 'ArrowRight' && idx < 5) {
          e.preventDefault();
          otpBoxRefs.current[idx + 1]?.focus();
      }
  };

  const handlePasteOtpFromClipboard = async () => {
      try {
          if (navigator.clipboard && navigator.clipboard.readText) {
              const clip = await navigator.clipboard.readText();
              const digits = (clip || '').replace(/\D/g, '').slice(0, 6);
              if (digits.length > 0) {
                  applyOtpString(digits, 0);
                  return;
              }
          }
      } catch {}
      // Graceful fallback on iOS if clipboard prompt is declined: focus box 1 so user can tap native Paste
      otpBoxRefs.current[0]?.focus();
  };

  const handleSetNewPassword = async (e: React.FormEvent) => {
      e.preventDefault();
      if (newPassword.length < 6) { setError('စကားဝှက် အနည်းဆုံး ၆ လုံး ထည့်ပါ။'); return; }
      if (newPassword !== confirmPassword) { setError('စကားဝှက်များ တူညီမှုမရှိပါ။ ပြန်စစ်ဆေးပေးပါ။'); return; }

      setLoading(true); setError('');
      try {
          let targetUserId = userId;
          const cleanPhoneInput = phone.trim();
          if (!targetUserId && cleanPhoneInput) {
              const snap = await Promise.race([
                  getDocs(collection(db, 'users')),
                  new Promise<null>((resolve) => setTimeout(() => resolve(null), 4000))
              ]);
              if (snap) {
                  snap.forEach((d) => {
                      try {
                          const data = d.data();
                          const decPhone = decryptText(data.phone) || d.id;
                          if (decPhone === cleanPhoneInput || d.id === cleanPhoneInput) {
                              targetUserId = d.id;
                          }
                      } catch {}
                  });
              }
              if (targetUserId) setUserId(targetUserId);
          }

          if (!targetUserId) {
              setError('အကောင့်အချက်အလက် ရှာမတွေ့ပါ။ ပြန်လည်ဝင်ရောက်ကြိုးစားပေးပါ။');
              return;
          }

          await resilientUpdateUserDoc(targetUserId, {
              password: encryptText(newPassword),
              resetRequested: false,
              resetOtp: '',
              otpToken: '',
              otpExpiresAt: 0,
              otpAttempts: 0,
              otpSentToTelegram: false,
              otpApproved: false
          }, 8000);

          setSuccessMsg('စကားဝှက်အသစ် အောင်မြင်စွာ ပြောင်းလဲပြီးပါပြီ။');
          setTimeout(() => { onLoginSuccess(phone.trim()); }, 1200);
      } catch (err: any) {
          setError(
              err?.message === 'timeout'
                  ? 'အင်တာနက်ချိတ်ဆက်မှု နှေးကွေးနေပါသည်။ ခေတ္တစောင့်ပြီး ထပ်မံနှိပ်ပေးပါ။'
                  : 'စကားဝှက်ပြောင်းလဲရာတွင် အခက်အခဲရှိနေပါသည်။ ထပ်မံကြိုးစားပေးပါ။'
          );
      } finally {
          setLoading(false);
      }
  };

  const checkBonusValid = () => {
      const bonus = appDataState?.signUpBonus;
      if (!bonus?.isActive || !bonus.startDate || !bonus.endDate || !bonus.points) return false;
      const todayMillis = new Date(getLocalTodayStr()).getTime();
      const sDate = new Date(bonus.startDate).getTime();
      const eDate = new Date(bonus.endDate).getTime();
      return todayMillis >= sDate && todayMillis <= eDate;
  };

  const handleRegister = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!regForm.name.trim()) { setError('နာမည်ထည့်ပေးပါခင်ဗျာ။'); return; }
      if (!regForm.password.trim() || regForm.password.length < 6) { setError('စကားဝှက် (Password) အနည်းဆုံး ၆ လုံး ထည့်ပေးပါ။'); return; }

      setLoading(true); setError('');
      try {
          const snap = await getDocs(collection(db, 'users'));
          let phoneExists = false; let foundId = null;
          snap.forEach(d => {
             try {
                 const data = d.data(); const decPhone = decryptText(data.phone) || d.id;
                 if (decPhone === phone.trim() || d.id === phone.trim()) { phoneExists = true; foundId = d.id; }
             } catch(err) {}
          });

          if (phoneExists) {
              setUserId(foundId);
              setError('သင်ထည့်လိုက်သော ဖုန်းနံပါတ်ဖြင့်ပြုလုပ်ထားသော User Account ရှိပြီးသားဖြစ်ပါသည်။ ကျေးဇူးပြု၍ Login ဝင်ပါ (သို့မဟုတ်) Password မေ့နေပါသလား။');
              setLoading(false);
              return;
          }

          // 🌟 Auto Welcome Bonus Points Logic
          let startingPoints = 0;
          let earnedBonus = false;
          if (checkBonusValid()) {
              startingPoints = appDataState.signUpBonus.points;
              earnedBonus = true;
          }

          await addDoc(collection(db, 'users'), {
              phone: encryptText(phone.trim()),
              name: encryptText(regForm.name.trim()),
              password: encryptText(regForm.password),
              dob: encryptText(regForm.dob),
              points: encryptText(startingPoints.toString()),
              createdAt: Date.now()
          });

          if (earnedBonus) {
              await addDoc(collection(db, 'point_history'), {
                  phone: encryptText(phone.trim()),
                  amount: encryptText('0'),
                  pointsEarned: encryptText(startingPoints.toString()),
                  invoiceNo: encryptText('Welcome Bonus'),
                  type: encryptText('Sign-Up Bonus'),
                  date: getLocalTodayStr(),
                  createdAt: Date.now()
              });
          }

          setSuccessMsg(earnedBonus ? `အကောင့်သစ် ဖွင့်ပြီးပါပြီ။ Welcome Bonus အနေဖြင့် ${startingPoints} Pts လက်ဆောင်ရရှိပါသည်။` : 'အကောင့်သစ် အောင်မြင်စွာ ဖွင့်ပြီးပါပြီ။');
          setTimeout(() => { onLoginSuccess(phone.trim()); }, 2500);
      } catch (err) { setError('Error creating account.'); }
      setLoading(false);
  };

  return (
    <div className="relative bg-white px-5 py-7 sm:p-10 rounded-[2rem] shadow-[0_8px_30px_rgb(0,0,0,0.06)] border border-[#D4AF37]/20 max-w-sm mx-auto text-center mt-8 mb-12 animate-fade-in overflow-hidden">
      <div className="absolute -top-16 -right-16 w-40 h-40 bg-[#D4AF37] opacity-10 rounded-full blur-3xl pointer-events-none"></div>
      <div className="absolute -bottom-16 -left-16 w-40 h-40 bg-[#123524] opacity-[0.03] rounded-full blur-3xl pointer-events-none"></div>

      <div className="relative z-10 w-20 h-20 bg-gradient-to-br from-[#123524] to-[#1a4a32] rounded-full mx-auto flex items-center justify-center mb-6 shadow-lg border-2 border-[#D4AF37]/40 group transition-all duration-500 hover:scale-105">
          <div className="absolute inset-0 rounded-full bg-[#D4AF37] opacity-0 group-hover:opacity-20 transition-opacity duration-500 blur-md"></div>
          {step === 4 ? <UserPlus className="w-8 h-8 text-[#D4AF37]" /> : step === 5 ? <ShieldCheck className="w-8 h-8 text-[#D4AF37]" /> : <KeyRound className="w-8 h-8 text-[#D4AF37]" />}
      </div>
      
      <h2 className="relative z-10 text-2xl font-bold text-[#123524] mb-2 tracking-wide font-serif">
          {step === 3 ? 'Reset Password' : step === 4 ? 'Create Account' : step === 5 ? 'New Password' : 'Login Required'}
      </h2>
      <p className="relative z-10 text-[11px] font-bold text-[#D4AF37] mb-8 uppercase tracking-widest">
          {step === 3 ? 'Request OTP' : step === 4 ? 'Join the exclusive club' : step === 5 ? 'Secure your account' : title}
      </p>

      {step === 1 && (
        <form onSubmit={handleNext} className="relative z-10 space-y-5 flex flex-col">
          <div className="relative group">
            <input required type="tel" placeholder="Enter Phone Number" value={phone} onChange={e => setPhone(e.target.value)} 
                   className="w-full p-4 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:border-[#D4AF37] focus:ring-2 focus:ring-[#D4AF37]/20 transition-all font-bold text-center tracking-wider text-[#123524] shadow-inner" />
          </div>
          
          {error && <div className="text-xs font-bold text-red-500 leading-relaxed bg-red-50 p-3 rounded-xl border border-red-100 animate-slide-up">{error}</div>}
          
          <button type="submit" disabled={loading} 
                  className="w-full py-4 bg-gradient-to-r from-[#123524] to-[#1a4a32] text-[#D4AF37] rounded-xl font-bold shadow-[0_4px_15px_rgba(18,53,36,0.3)] hover:shadow-[0_6px_20px_rgba(18,53,36,0.4)] hover:from-[#0d261a] hover:to-[#123524] transform hover:-translate-y-0.5 transition-all duration-300 flex items-center justify-center tracking-widest uppercase text-xs">
              {loading ? 'Authenticating...' : 'Continue'} <ChevronRight className="w-4 h-4 ml-2 opacity-80"/>
          </button>

          <div className="mt-6 pt-6 border-t border-gray-100">
              <p className="text-[10px] font-bold text-[#D4AF37] mb-4 leading-relaxed uppercase tracking-wider">New to Shangri-La?</p>
              <button type="button" onClick={() => { setStep(4); setError(''); }} disabled={loading} 
                      className="w-full py-3.5 bg-gradient-to-r from-yellow-50 to-white text-[#123524] border border-[#D4AF37]/50 rounded-xl font-bold shadow-sm hover:shadow-md hover:from-yellow-100 hover:to-yellow-50 transition-all duration-300 flex items-center justify-center text-sm transform hover:-translate-y-0.5">
                  <UserPlus className="w-4 h-4 mr-2 text-[#D4AF37]" /> အကောင့်သစ်ဖွင့်ရန်
              </button>
          </div>
        </form>
      )}
      
      {step === 2 && (
        <form onSubmit={handleLogin} className="relative z-10 space-y-5 flex flex-col animate-slide-up">
          <input required type="password" placeholder="Enter Password" value={password} onChange={e => setPassword(e.target.value)} 
                 className="w-full p-4 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:border-[#D4AF37] focus:ring-2 focus:ring-[#D4AF37]/20 transition-all font-bold text-center tracking-wider text-[#123524] shadow-inner" />
          {error && <div className="text-xs font-bold text-red-500 bg-red-50 p-3 rounded-xl border border-red-100">{error}</div>}
          
          <button type="submit" disabled={loading} 
                  className="w-full py-4 bg-gradient-to-r from-[#123524] to-[#1a4a32] text-[#D4AF37] rounded-xl font-bold shadow-[0_4px_15px_rgba(18,53,36,0.3)] hover:shadow-[0_6px_20px_rgba(18,53,36,0.4)] transform hover:-translate-y-0.5 transition-all duration-300 tracking-widest uppercase text-xs">
              {loading ? 'Logging in...' : 'Secure Login'}
          </button>
          
          <div className="mt-4 pt-5 border-t border-gray-100">
              <p className="text-[10px] font-bold text-[#D4AF37] mb-3 leading-relaxed uppercase tracking-wider">
                  စကားဝှက်မေ့နေပါသလား? (Forgot Password)
              </p>
              <button type="button" onClick={() => { setStep(3); setError(''); setSuccessMsg(''); }} disabled={loading} 
                      className="w-full py-3.5 bg-yellow-50 text-[#D4AF37] border border-[#D4AF37]/50 rounded-xl font-bold shadow-sm hover:shadow-md hover:bg-yellow-100 transition-all duration-300 flex items-center justify-center text-xs transform hover:-translate-y-0.5 uppercase tracking-widest">
                  <KeyRound className="w-4 h-4 mr-2" /> Request New Password
              </button>
          </div>
        </form>
      )}

      {step === 3 && (
        <div className="relative z-10 space-y-4 flex flex-col animate-slide-up">
           {otpState === 'none' && (
              <>
                <div className="text-left bg-gradient-to-br from-[#F4F9F6] to-amber-50/60 border border-[#D4AF37]/35 p-4 rounded-xl shadow-inner space-y-2">
                   <p className="text-xs font-bold text-[#123524] leading-relaxed text-center">
                     စကားဝှက်အသစ် ပြန်လည်သတ်မှတ်ရန်အတွက် အောက်ပါခလုတ်ကို နှိပ်ပါ။ Telegram Bot မှ တစ်ခါသုံးကုဒ် (၆ လုံး OTP) ကို အလိုအလျောက် ပေးပို့ပေးပါမည်။
                   </p>
                   <p className="text-[11px] text-gray-500 font-semibold text-center leading-relaxed">
                     Admin Approve စောင့်စရာမလိုဘဲ Bot မှ ရရှိသော OTP ကို ရိုက်ထည့်၍ ချက်ချင်း Password အသစ် သတ်မှတ်နိုင်ပါသည်။
                   </p>
                </div>
                <button
                  type="button"
                  onClick={() => handleRequestOTP(true)}
                  disabled={loading}
                  className="w-full py-4 bg-gradient-to-r from-[#229ED9] to-[#1a82b5] text-white rounded-xl font-bold shadow-md hover:brightness-110 active:scale-[0.98] transition flex justify-center items-center gap-2 tracking-wide text-xs sm:text-sm"
                >
                    <Send className="w-4 h-4" />
                    <span>{loading ? 'OTP ပြင်ဆင်နေပါသည်...' : 'Telegram Bot မှ OTP တောင်းခံရန်'}</span>
                </button>
              </>
           )}
           
           {/* 🌟 Self-Service Telegram Bot OTP Verification Step 🌟 */}
           {otpState === 'verify' && (
              <form onSubmit={handleVerifyOtp} className="space-y-4 text-left">
                  {/* Delivery Status Banner */}
                  {otpSentToTelegram ? (
                    <div className="bg-emerald-50 border border-emerald-200 p-3.5 rounded-xl flex items-start gap-2.5 shadow-xs">
                      <CheckCircle className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
                      <div className="text-xs leading-relaxed">
                        <div className="font-black text-emerald-800">OTP ကုဒ်ကို Telegram Bot သို့ ပေးပို့ပြီးပါပြီ!</div>
                        <div className="text-[11px] text-emerald-700 font-semibold mt-0.5">
                          Telegram Bot မှ ရရှိသော ဂဏန်း ၆ လုံးကို အောက်တွင် ရိုက်ထည့်ပေးပါ။
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="bg-sky-50 border border-sky-200 p-3.5 rounded-xl space-y-2.5 shadow-xs">
                      <div className="flex items-start gap-2.5">
                        <Send className="w-4 h-4 text-[#229ED9] flex-shrink-0 mt-0.5 animate-pulse" />
                        <div className="text-xs leading-relaxed">
                          <div className="font-black text-sky-900">Telegram Bot ထဲတွင် START နှိပ်၍ OTP ရယူပါ</div>
                          <div className="text-[11px] text-sky-700 font-semibold mt-0.5">
                            Bot ပွင့်လာပါက အောက်ဆုံးရှိ <strong>START</strong> ကို နှိပ်လိုက်ရုံဖြင့် ဂဏန်း ၆ လုံး OTP ကို အလိုအလျောက် ပို့ပေးပါမည်။
                          </div>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <a
                          href={
                            otpBotUrls?.httpsUrl ||
                            getTelegramBotStartUrls(
                              `otp_${normalizePhone(phone) || 'user'}_${otpToken}`
                            ).httpsUrl
                          }
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => {
                            e.preventDefault();
                            const cleanP = normalizePhone(phone) || phone.replace(/[^0-9]/g, '') || 'user';
                            openTelegramBotWithStartParam(
                              `otp_${cleanP}_${otpToken}`,
                              otpBotUrls?.httpsUrl,
                              otpBotUrls?.tgAppUrl
                            );
                          }}
                          className="flex-1 py-2 px-3 rounded-lg bg-[#229ED9] hover:bg-[#1b86ba] text-white text-[11px] font-bold flex items-center justify-center gap-1.5 shadow-sm transition"
                        >
                          <Send className="w-3.5 h-3.5" /> Telegram Bot ဖွင့်ရန်
                        </a>
                        <button
                          type="button"
                          onClick={handleManualCheckBotOtp}
                          disabled={checkingBotDelivery}
                          className="py-2 px-3 rounded-lg bg-white hover:bg-sky-100 text-sky-800 border border-sky-200 text-[11px] font-bold flex items-center justify-center gap-1 transition disabled:opacity-60"
                        >
                          <RefreshCw className={`w-3.5 h-3.5 ${checkingBotDelivery ? 'animate-spin' : ''}`} />
                          {checkingBotDelivery ? 'စစ်နေ...' : 'OTP စစ်ရန်'}
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Luxury 6-Box Segmented OTP Input */}
                  <div className="bg-gradient-to-b from-[#FAFBF9] to-white p-3.5 sm:p-4 rounded-2xl border border-[#D4AF37]/25 shadow-inner space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <label className="text-[10px] font-extrabold text-[#123524]/75 uppercase tracking-[0.12em]">
                        6-Digit OTP Code
                      </label>
                      {otpRemainingSecs > 0 ? (
                        <span
                          className={`inline-flex items-center gap-1 text-[10px] font-mono font-bold px-2.5 py-0.5 rounded-full border ${
                            otpRemainingSecs <= 60
                              ? 'text-amber-700 bg-amber-50 border-amber-200'
                              : 'text-[#123524] bg-emerald-50 border-emerald-200/80'
                          }`}
                        >
                          <Clock className="w-3 h-3" />
                          {Math.floor(otpRemainingSecs / 60)}:{String(otpRemainingSecs % 60).padStart(2, '0')}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-red-600 bg-red-50 px-2.5 py-0.5 rounded-full border border-red-200">
                          သက်တမ်းကုန်ဆုံး
                        </span>
                      )}
                    </div>

                    <div
                      className="grid grid-cols-6 gap-1.5 sm:gap-2"
                      onPaste={(e) => {
                        e.preventDefault();
                        const pasted = e.clipboardData.getData('text') || '';
                        applyOtpString(pasted, 0);
                      }}
                    >
                      {[0, 1, 2, 3, 4, 5].map((idx) => {
                        const digit = otpInput[idx] || '';
                        const isFocused = focusedOtpIdx === idx;
                        const hasErr = Boolean(error);
                        return (
                          <div key={idx} className="relative">
                            <input
                              ref={(el) => { otpBoxRefs.current[idx] = el; }}
                              type="text"
                              inputMode="numeric"
                              pattern="[0-9]*"
                              autoComplete={idx === 0 ? 'one-time-code' : 'off'}
                              aria-label={`OTP digit ${idx + 1}`}
                              value={digit}
                              onFocus={(e) => {
                                setFocusedOtpIdx(idx);
                                e.target.select();
                              }}
                              onBlur={() => setFocusedOtpIdx((prev) => (prev === idx ? null : prev))}
                              onChange={(e) => {
                                const rawVal = e.target.value;
                                if (!rawVal) {
                                  const chars = Array.from({ length: 6 }, (_, i) => otpInput[i] || '');
                                  chars[idx] = '';
                                  setOtpInput(chars.join(''));
                                  if (error) setError('');
                                  return;
                                }
                                const clean = rawVal.replace(/\D/g, '');
                                if (!clean) return;
                                // If box already had 1 digit and user typed a replacement digit (e.g. "9" -> "95")
                                if (digit && clean.length === 2) {
                                  const replaced = clean[0] === digit ? clean[1] : clean[0];
                                  applyOtpString(replaced, idx);
                                  return;
                                }
                                if (clean.length > 1) {
                                  applyOtpString(clean, 0);
                                } else {
                                  applyOtpString(clean, idx);
                                }
                              }}
                              onKeyDown={(e) => handleOtpBoxKeyDown(idx, e)}
                              className={`w-full h-12 sm:h-14 rounded-xl text-center font-mono font-black text-xl sm:text-2xl tabular-nums outline-none transition-all duration-200 caret-[#D4AF37] ${
                                hasErr
                                  ? 'border-2 border-red-400 bg-red-50/70 text-red-700 ring-2 ring-red-100'
                                  : isFocused
                                  ? 'border-2 border-[#123524] bg-white text-[#123524] ring-4 ring-[#D4AF37]/25 -translate-y-0.5 shadow-md'
                                  : digit
                                  ? 'border-2 border-[#123524]/70 bg-gradient-to-b from-[#F3F9F5] to-[#FFFDF5] text-[#123524] shadow-sm'
                                  : 'border-[1.5px] border-[#D4AF37]/40 bg-white text-[#123524] hover:border-[#D4AF37]/75 shadow-[0_1px_4px_rgba(18,53,36,0.04)]'
                              }`}
                            />
                            {!digit && !isFocused && (
                              <span
                                aria-hidden="true"
                                className="pointer-events-none absolute inset-0 flex items-center justify-center"
                              >
                                <span className="w-1.5 h-1.5 rounded-full bg-[#D4AF37]/45" />
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>

                    {/* Quick Paste / Clear Bar */}
                    <div className="flex items-center justify-between pt-0.5">
                      <span className="text-[10px] text-gray-400 font-semibold">
                        Copy / Paste ဖြင့် တိုက်ရိုက်ထည့်နိုင်သည်
                      </span>
                      {otpInput.length > 0 ? (
                        <button
                          type="button"
                          onClick={() => {
                            setOtpInput('');
                            lastAutoVerifiedRef.current = '';
                            setError('');
                            requestAnimationFrame(() => otpBoxRefs.current[0]?.focus());
                          }}
                          className="inline-flex items-center gap-1 text-[10px] font-bold text-gray-500 hover:text-red-500 transition px-2 py-0.5 rounded-md hover:bg-red-50"
                        >
                          <X className="w-3 h-3" /> ပြန်ဖျက်ရန်
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={handlePasteOtpFromClipboard}
                          className="inline-flex items-center gap-1 text-[10px] font-bold text-[#123524] bg-[#D4AF37]/15 hover:bg-[#D4AF37]/25 border border-[#D4AF37]/35 px-2.5 py-0.5 rounded-full transition active:scale-95"
                        >
                          <Copy className="w-3 h-3 text-[#b59021]" /> ကုဒ် Paste လုပ်ရန်
                        </button>
                      )}
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={loading || otpInput.length !== 6}
                    className="w-full py-3.5 sm:py-4 bg-gradient-to-r from-[#123524] to-[#1a4a32] text-[#D4AF37] rounded-xl font-bold shadow-[0_4px_15px_rgba(18,53,36,0.3)] hover:brightness-110 active:scale-[0.98] transition-all flex justify-center items-center gap-2 tracking-wide text-xs disabled:opacity-45 disabled:cursor-not-allowed"
                  >
                    <ShieldCheck className="w-4 h-4 shrink-0" />
                    <span>{loading ? 'စစ်ဆေးနေပါသည်...' : 'OTP အတည်ပြုပြီး Password အသစ်လုပ်မည်'}</span>
                  </button>

                  {/* Open Telegram Bot + Resend OTP Actions */}
                  <div className="flex items-center justify-between gap-2 pt-1">
                    {otpSentToTelegram && (
                      <a
                        href={
                          otpBotUrls?.httpsUrl ||
                          getTelegramBotStartUrls(
                            `otp_${normalizePhone(phone) || 'user'}_${otpToken}`
                          ).httpsUrl
                        }
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => {
                          e.preventDefault();
                          const cleanP = normalizePhone(phone) || phone.replace(/[^0-9]/g, '') || 'user';
                          openTelegramBotWithStartParam(
                            `otp_${cleanP}_${otpToken}`,
                            otpBotUrls?.httpsUrl,
                            otpBotUrls?.tgAppUrl
                          );
                        }}
                        className="text-[11px] font-bold text-[#229ED9] hover:underline flex items-center gap-1"
                      >
                        <MessageCircle className="w-3.5 h-3.5" /> Telegram Bot ဖွင့်ရန်
                      </a>
                    )}
                    <button
                      type="button"
                      disabled={loading || resendCooldown > 0}
                      onClick={() => handleRequestOTP(true)}
                      className="text-[11px] font-bold text-[#123524] hover:text-[#D4AF37] disabled:text-gray-400 transition ml-auto flex items-center gap-1"
                    >
                      <RefreshCw className="w-3 h-3" />
                      {resendCooldown > 0
                        ? `OTP ပြန်တောင်းရန် (${resendCooldown}s)`
                        : 'OTP အသစ် ပြန်တောင်းရန်'}
                    </button>
                  </div>
              </form>
           )}

           {error && <div className="text-xs font-bold text-red-500 bg-red-50 p-3 rounded-xl border border-red-100 leading-relaxed">{error}</div>}
           <button type="button" onClick={() => { setStep(2); setError(''); }} disabled={loading} className="text-xs text-gray-500 font-bold mt-1 hover:text-[#123524] transition-colors">Cancel & Go Back</button>
        </div>
      )}

      {step === 4 && (
        <form onSubmit={handleRegister} className="relative z-10 space-y-4 flex flex-col text-left animate-slide-up">
          {checkBonusValid() && (
              <div className="bg-yellow-50 border border-yellow-200 p-3 rounded-xl mb-1 shadow-sm flex items-center justify-center animate-pulse">
                  <Gift className="w-4 h-4 text-yellow-600 mr-2 flex-shrink-0" />
                  <span className="text-[10px] sm:text-xs font-bold text-yellow-800 leading-tight">ယခုပဲ အကောင့်သစ်ဖွင့်ပြီး {appDataState.signUpBonus.points} Points လက်ဆောင်ရယူလိုက်ပါ!</span>
              </div>
          )}

          {/* 🌟 Telegram Notification Auto-Bind Option 🌟 */}
          <div className="bg-yellow-50/70 p-4 rounded-xl border border-[#D4AF37]/30 mb-6 flex items-center justify-between">
              <div className="flex items-center">
                  <MessageCircle className="w-5 h-5 text-[#123524] mr-3 shrink-0" />
                  <div>
                      <div className="font-bold text-xs text-[#123524]">Telegram Real-Time Noti ရယူမည်</div>
                      <div className="text-[10px] text-gray-500 font-semibold">ဘိုကင် Status ပြောင်းလဲမှုကို Telegram ဖြင့် တိုက်ရိုက် ပို့ပေးပါမည်။</div>
                  </div>
              </div>
              <a
                  href={getInstantTelegramLink(phone).httpsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => {
                      e.preventDefault();
                      openTelegramBotInstantly(phone);
                  }}
                  className="px-3 py-2 bg-[#123524] text-[#D4AF37] rounded-lg text-[10px] font-bold shadow-sm hover:bg-[#1a4a32] active:scale-95 transition whitespace-nowrap"
              >
                  Connect Telegram
              </a>
          </div>
          
          <div>
            <label className="block text-[10px] font-bold text-gray-500 mb-1.5 uppercase tracking-wider">Phone Number (Login ID)</label>
            <input type="tel" value={phone} disabled className="w-full p-3.5 bg-gray-100 border border-gray-200 rounded-xl outline-none font-bold text-gray-400 cursor-not-allowed text-center tracking-wider" />
          </div>
          <div>
            <label className="block text-[10px] font-bold text-gray-500 mb-1.5 uppercase tracking-wider">Full Name <span className="text-red-500">*</span></label>
            <input required type="text" placeholder="e.g. Aung Aung" value={regForm.name} onChange={e => setRegForm({...regForm, name: e.target.value})} 
                   className="w-full p-3.5 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:border-[#D4AF37] focus:ring-2 focus:ring-[#D4AF37]/20 transition-all font-bold text-sm shadow-inner" />
          </div>
          <div>
            <label className="block text-[10px] font-bold text-gray-500 mb-1.5 uppercase tracking-wider">Date of Birth (Optional)</label>
            <input type="date" value={regForm.dob} onChange={e => setRegForm({...regForm, dob: e.target.value})} 
                   className="w-full p-3.5 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:border-[#D4AF37] focus:ring-2 focus:ring-[#D4AF37]/20 transition-all font-bold text-sm text-[#123524] shadow-inner" />
          </div>
          <div>
            <label className="block text-[10px] font-bold text-gray-500 mb-1.5 uppercase tracking-wider">Password <span className="text-red-500">*</span></label>
            <input required type="password" placeholder="အနည်းဆုံး ၆ လုံး ထည့်ပါ" minLength={6} value={regForm.password} onChange={e => setRegForm({...regForm, password: e.target.value})} 
                   className="w-full p-3.5 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:border-[#D4AF37] focus:ring-2 focus:ring-[#D4AF37]/20 transition-all text-center font-bold tracking-widest shadow-inner" />
          </div>
          
          {error && (
              <div className="bg-red-50 p-4 rounded-xl border border-red-200 animate-slide-up shadow-sm mt-2 text-center">
                  <div className="text-xs font-bold text-red-500 leading-relaxed">{error}</div>
                  {error.includes('ရှိပြီးသားဖြစ်ပါသည်') && (
                      <div className="flex flex-col gap-2 mt-4">
                          <button type="button" onClick={() => { setStep(2); setError(''); }} className="w-full py-3.5 bg-[#123524] text-[#D4AF37] rounded-xl font-bold shadow-sm hover:bg-[#1a4a32] transition text-xs flex justify-center items-center uppercase tracking-widest">
                              Login ဝင်ပါ
                          </button>
                          <button type="button" onClick={() => { setStep(3); setError(''); }} className="w-full py-3.5 bg-yellow-50 text-[#D4AF37] border border-[#D4AF37]/50 rounded-xl font-bold shadow-sm hover:bg-yellow-100 transition text-xs flex justify-center items-center uppercase tracking-widest">
                              <KeyRound className="w-3.5 h-3.5 mr-1.5" /> Password အသစ် Request လုပ်ရန်
                          </button>
                      </div>
                  )}
              </div>
          )}

          {successMsg && <div className="text-xs font-bold text-[#123524] bg-green-50 p-4 rounded-xl border border-green-200 text-center shadow-sm mt-2 flex flex-col items-center"><CheckCircle className="w-6 h-6 text-green-600 mb-2"/> {successMsg}</div>}
          
          {!successMsg && !error?.includes('ရှိပြီးသားဖြစ်ပါသည်') && (
             <button type="submit" disabled={loading} 
                     className="w-full py-4 mt-2 bg-gradient-to-r from-[#123524] to-[#1a4a32] text-[#D4AF37] rounded-xl font-bold shadow-[0_4px_15px_rgba(18,53,36,0.3)] hover:shadow-[0_6px_20px_rgba(18,53,36,0.4)] transform hover:-translate-y-0.5 transition-all duration-300 flex justify-center items-center tracking-widest uppercase text-xs">
                 {loading ? 'Creating Profile...' : 'Complete Registration'}
             </button>
          )}
          {!successMsg && (
             <button type="button" onClick={() => { setStep(1); setError(''); }} disabled={loading} className="text-xs text-gray-400 font-bold mt-3 text-center hover:text-[#123524] transition-colors uppercase tracking-wider">
                 Cancel & Go Back
             </button>
          )}
        </form>
      )}

      {step === 5 && (
        <form onSubmit={handleSetNewPassword} className="relative z-10 space-y-4 flex flex-col text-left animate-slide-up">
          <div>
            <label className="block text-[10px] font-bold text-gray-500 mb-1.5 uppercase tracking-wider">New Password <span className="text-red-500">*</span></label>
            <input required type="password" placeholder="အသစ်ထားမည့် စကားဝှက်" minLength={6} value={newPassword} onChange={e => setNewPassword(e.target.value)} 
                   className="w-full p-3.5 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:border-[#D4AF37] focus:ring-2 focus:ring-[#D4AF37]/20 transition-all text-center font-bold tracking-widest shadow-inner" />
          </div>
          <div>
            <label className="block text-[10px] font-bold text-gray-500 mb-1.5 uppercase tracking-wider">Confirm Password <span className="text-red-500">*</span></label>
            <input required type="password" placeholder="စကားဝှက်ကို ထပ်ရိုက်ပါ" minLength={6} value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} 
                   className="w-full p-3.5 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:border-[#D4AF37] focus:ring-2 focus:ring-[#D4AF37]/20 transition-all text-center font-bold tracking-widest shadow-inner" />
          </div>
          {error && <div className="text-xs font-bold text-red-500 text-center bg-red-50 p-2.5 rounded-lg border border-red-100">{error}</div>}
          {successMsg && <div className="text-xs font-bold text-[#123524] bg-green-50 p-3 rounded-xl border border-green-200 text-center shadow-sm">{successMsg}</div>}
          
          {!successMsg && (
             <button type="submit" disabled={loading} 
                     className="w-full py-4 mt-2 bg-gradient-to-r from-[#123524] to-[#1a4a32] text-[#D4AF37] rounded-xl font-bold shadow-[0_4px_15px_rgba(18,53,36,0.3)] hover:shadow-[0_6px_20px_rgba(18,53,36,0.4)] transform hover:-translate-y-0.5 transition-all duration-300 flex justify-center items-center tracking-widest uppercase text-xs">
                 {loading ? 'Saving...' : 'Confirm & Auto Login'}
             </button>
          )}
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
   const baseRule = (vipSettings as any).baseRuleText || "သုံးစွဲငွေ ၃၅,၀⁠၀၀ ကျပ် လျှင် = ၁ ပွိုင့် (1 Point)";
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
                   
                   {/* 🌟 LUXURY CARD UI အသစ် 🌟 */}
                   <div className="space-y-5">
                      {sortedTiers.map(tier => {
                          const isGold = tier.colorTheme === '#D4AF37';
                          const textColor = isGold ? 'text-[#123524]' : 'text-white';
                          const accentColor = isGold ? 'text-[#123524]' : 'text-[#D4AF37]';
                          const badgeBg = isGold ? 'bg-[#123524] text-[#D4AF37] border-transparent' : 'bg-white/20 text-white border-white/30';

                          return (
                              <div key={tier.id} 
                                   className="relative rounded-[1.2rem] p-6 overflow-hidden shadow-[0_8px_20px_rgba(0,0,0,0.12)] border border-white/20 transform transition-transform hover:scale-[1.02] cursor-default"
                                   style={{ backgroundColor: tier.colorTheme }}
                              >
                                  {/* Card Background Decoration */}
                                  <div className="absolute top-0 right-0 w-32 h-32 bg-white opacity-20 rounded-full -mr-10 -mt-10 blur-2xl"></div>
                                  <div className="absolute bottom-0 left-0 w-24 h-24 bg-black opacity-10 rounded-full -ml-8 -mb-8 blur-xl"></div>
                                  
                                  <div className="relative z-10">
                                      <div className="flex justify-between items-start mb-8">
                                          <div>
                                              <h4 className={`font-extrabold text-lg flex items-center tracking-wide ${textColor}`}>
                                                  <Crown className={`w-5 h-5 mr-2 drop-shadow-sm ${accentColor}`}/> {tier.name}
                                              </h4>
                                              <span className={`text-[9px] font-bold uppercase tracking-widest opacity-80 mt-1 block ${textColor}`}>Shangri-La Exclusive Card</span>
                                          </div>
                                          <span className={`text-[10px] font-bold px-3 py-1.5 rounded-full backdrop-blur-md border shadow-sm tracking-wider ${badgeBg}`}>
                                              {tier.requiredPoints} Pts
                                          </span>
                                      </div>
                                      
                                      <div className="flex justify-between items-end border-t border-white/20 pt-4">
                                          <div>
                                              <div className={`text-[9px] font-bold uppercase tracking-widest opacity-80 mb-1 ${textColor}`}>Discount</div>
                                              <div className={`text-2xl font-black drop-shadow-sm ${textColor}`}>
                                                  {tier.discountPercent}% <span className="text-sm font-bold opacity-90">OFF</span>
                                              </div>
                                          </div>
                                          <div className="text-right">
                                              <div className={`text-[9px] font-bold uppercase tracking-widest opacity-80 mb-1 ${textColor}`}>Instant Upgrade</div>
                                              <div className={`text-sm font-bold drop-shadow-sm ${textColor}`}>{tier.instantUpgrade}</div>
                                          </div>
                                      </div>
                                  </div>
                              </div>
                          );
                      })}
                   </div>
               </section>

               <section>
                   <h3 className="font-bold text-[#123524] text-base mb-4 flex items-center"><Target className="w-5 h-5 mr-2 text-green-600"/> လစဉ် Target ပြည့်ပါက (Pre-Jade)</h3>
                   <p className="text-[10px] text-gray-500 mb-3 leading-relaxed">{preJadeTxt}</p>
                   <div className="bg-green-50 p-4 rounded-xl border border-green-100">
                       <ul className="space-y-2">
                           {preJadeRws.map((rw: string, i: number) => (
                               <li key={i} className="text-xs font-bold text-green-800 flex items-center"><CheckCircle className="w-3 h-3 mr-2 text-green-500"/> {rw}</li>
                           ))}
                       </ul>
                   </div>
               </section>
               
               <section>
                   <h3 className="font-bold text-[#123524] text-base mb-4 flex items-center"><Gift className="w-5 h-5 mr-2 text-blue-500"/> မွေးနေ့လ အထူးခံစားခွင့်များ</h3>
                   <div className="space-y-3">
                       <div className="bg-blue-50 p-3 rounded-xl border border-blue-100">
                           <span className="text-[10px] font-bold text-blue-800 block mb-1">VIP Standard (Jade & Gold)</span>
                           <span className="text-xs text-blue-600">{bdayStd}</span>
                       </div>
                       <div className="bg-blue-50 p-3 rounded-xl border border-blue-100">
                           <span className="text-[10px] font-bold text-blue-800 block mb-1">Imperial & V-VIP Only</span>
                           <span className="text-xs text-blue-600">{bdayImp}</span>
                       </div>
                   </div>
               </section>

               <section>
                   <h3 className="font-bold text-[#123524] text-base mb-4 flex items-center"><Info className="w-5 h-5 mr-2 text-gray-500"/> အခြားစည်းကမ်းချက်များ</h3>
                   <div className="bg-gray-50 p-4 rounded-xl border border-gray-200">
                       <ul className="space-y-3">
                           <li className="text-[10px] text-gray-600 font-semibold leading-relaxed flex items-start"><ChevronRight className="w-3 h-3 mr-1 mt-0.5 text-[#D4AF37] flex-shrink-0"/> {cumulativeTxt}</li>
                           {vipSettings.rules.map((rule: string, i: number) => (
                               <li key={i} className="text-[10px] text-gray-600 font-semibold leading-relaxed flex items-start"><ChevronRight className="w-3 h-3 mr-1 mt-0.5 text-[#D4AF37] flex-shrink-0"/> {rule}</li>
                           ))}
                       </ul>
                   </div>
               </section>
           </div>
       </div>
   );
}

export function TherapistsGallery({ appData }: { appData: AppData }) {
    const [viewGallery, setViewGallery] = useState<{ images: string[], index: number, name?: string } | null>(null);
    const [loadingGalleryId, setLoadingGalleryId] = useState<string | null>(null);

    const openGallery = async (t: TherapistProfile) => {
        setLoadingGalleryId(t.id);
        try {
            const docSnap = await getDoc(doc(db, 'therapists', t.id));
            if (docSnap.exists() && docSnap.data().images && docSnap.data().images.length > 0) {
                setViewGallery({ images: docSnap.data().images, index: 0, name: t.name });
            } else if (t.images && t.images.length > 0) {
                setViewGallery({ images: t.images, index: 0, name: t.name });
            }
        } catch (e) {
            if (t.images && t.images.length > 0) setViewGallery({ images: t.images, index: 0, name: t.name });
        }
        setLoadingGalleryId(null);
    };

    return (
        <div className="max-w-4xl mx-auto px-4 pb-20 animate-fade-in relative">
          
          {/* 🌟 Fullscreen Portal Image Gallery Popup 🌟 */}
          <TherapistPhotoLightbox
            gallery={viewGallery}
            onChangeIndex={(nextIdx) => setViewGallery((prev) => (prev ? { ...prev, index: nextIdx } : null))}
            onClose={() => setViewGallery(null)}
          />

          <div className="text-center mb-10">
            <h2 className="text-2xl font-bold text-[#123524] mb-2 font-serif">Our Professionals</h2>
            <div className="w-16 h-1 bg-[#D4AF37] mx-auto rounded-full mb-4"></div>
            <p className="text-sm text-gray-500 max-w-md mx-auto leading-relaxed">Experience ultimate relaxation with our certified and highly skilled therapists.</p>
          </div>
         <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6">
            {appData.therapists
              .filter((t: any) => t.visibilityStatus !== 'hidden' && !t.isHidden)
              .map((t: any, idx: number) => {
                const isComingSoon = t.visibilityStatus === 'coming_soon' || Boolean(t.isComingSoon);
                const comingSoonLabel = t.comingSoonText || 'Coming Soon .. Booking လက်မခံသေးပါ';

                return (
                  <div key={t.id} className="bg-white rounded-2xl overflow-hidden shadow-sm hover:shadow-xl transition-all duration-300 border border-gray-100 group">
                    <div className="aspect-[3/4] relative overflow-hidden bg-gray-50">
                      {(t.images?.[0] || t.imageUrl) ? (
                        <>
                          <img src={t.images?.[0] || t.imageUrl} alt={t.name} loading="lazy" className={`w-full h-full object-cover transition-transform duration-700 group-hover:scale-110 ${isComingSoon ? 'grayscale-[30%]' : ''}`} />
                          <div className="absolute inset-0 bg-gradient-to-t from-[#123524]/90 via-transparent to-transparent opacity-80"></div>
                        </>
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-gray-300"><ImageIcon className="w-10 h-10 opacity-20"/></div>
                      )}
                      <div className="absolute top-2 left-2 w-7 h-7 rounded-full bg-[#D4AF37] text-white flex items-center justify-center font-bold text-xs shadow-md border border-[#D4AF37]/50">{idx + 1}</div>

                      {isComingSoon && (
                        <div className="absolute top-2 right-2 bg-amber-500/95 text-white px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-wider shadow-md border border-amber-300 animate-pulse">
                          ⏳ Coming Soon
                        </div>
                      )}
                      
                      <div className="absolute bottom-0 left-0 right-0 p-4 text-center">
                        <h3 className="font-bold text-white text-lg drop-shadow-md">{t.name}</h3>
                        {isComingSoon && (
                          <div className="mt-1.5 bg-amber-500/90 text-white text-[10px] font-extrabold px-2.5 py-1 rounded-lg shadow">
                            {comingSoonLabel}
                          </div>
                        )}
                        {t.images && t.images.length > 0 && (
                          <button 
                            onClick={(e) => { e.stopPropagation(); openGallery(t); }}
                            disabled={loadingGalleryId === t.id}
                            className="mx-auto mt-2.5 bg-black/60 backdrop-blur-md hover:bg-black/90 text-[#D4AF37] px-4 py-1.5 rounded-full text-[9px] sm:text-[10px] font-bold tracking-wider flex items-center justify-center border border-[#D4AF37]/40 hover:border-[#D4AF37] transition-all duration-300 shadow-lg z-10 relative cursor-pointer disabled:opacity-50 hover:-translate-y-0.5"
                          >
                            {loadingGalleryId === t.id ? (
                              <span className="animate-pulse flex items-center"><ImageIcon className="w-3 h-3 mr-1 animate-spin"/> Loading...</span>
                            ) : (
                              <><ImageIcon className="w-3.5 h-3.5 mr-1.5"/> နောက်ထပ်ပုံများကြည့်ရန်</>
                            )}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
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
              arr.push({ id: d.id, ...raw, name: decryptText(raw.name), phone: decryptText(raw.phone), txId: decryptText(raw.txId), specialRequest: decryptText(raw.specialRequest), discountLabel: raw.discountLabel ? decryptText(raw.discountLabel) : undefined } as Booking);
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
      const tBookings = bookings.filter(b => {
          if (!b.therapist || b.date !== todayStr || b.status === 'cancelled' || b.status === 'completed') return false;
          const names = b.therapist.split('&').map(n => n.trim().replace('(Any Available)', '').trim());
          return names.includes(therapistName.trim());
      });
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
          if (b.status === 'cancelled' || b.status === 'completed' || b.date !== todayStr || !b.therapist) return;
          
          const names = b.therapist.split('&').map(n => n.trim().replace('(Any Available)', '').trim());
          if (!names.includes(tName.trim())) return;
        
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

  // 🌟 Hide လုပ်ထားသော ဝန်ထမ်းများကို Dashboard နှင့် Top 5 တွင် လုံးဝ ဖယ်ထုတ်ရန် 🌟
  const visibleTherapists = useMemo(() => {
    return (appData.therapists || []).filter((t: any) => t.visibilityStatus !== 'hidden' && !t.isHidden);
  }, [appData.therapists]);

  const bookingCounts: Record<string, number> = {};
  bookings.forEach(b => { if (b.status !== 'cancelled') { bookingCounts[b.therapist] = (bookingCounts[b.therapist] || 0) + 1; } });
  
  const top5Therapists = [...visibleTherapists].sort((a, b) => {
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
                           {(viewingDetails.images?.[0] || viewingDetails.imageUrl) ? (
                               <img src={viewingDetails.images?.[0] || viewingDetails.imageUrl} loading="lazy" className="w-10 h-10 rounded-full object-cover mr-3 border border-[#D4AF37]"/>
                           ) : (
                               <User className="w-10 h-10 rounded-full p-2 bg-gray-100 text-gray-400 mr-3"/>
                           )}
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
          {visibleTherapists.map((t: any) => {
             const isComingSoon = t.visibilityStatus === 'coming_soon' || Boolean(t.isComingSoon);
             const comingSoonLabel = t.comingSoonText || 'Coming Soon .. Booking လက်မခံသေးပါ';
             const status = getTherapistStatus(t.name);
             const isAvailable = !isComingSoon && status.label === 'Available Now';
             const isPartiallyBooked = !isComingSoon && (status.label === 'Partially Booked' || status.label === 'In Service (Active)');
             const isFullyBooked = isComingSoon || status.label.includes('Fully Booked');

             return (
                <div key={t.id} className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex items-center hover:shadow-md transition">
                   <div className={`w-16 h-20 rounded-lg overflow-hidden flex-shrink-0 mr-3 sm:mr-4 border object-cover ${isComingSoon ? 'border-amber-300 grayscale-[20%]' : isAvailable ? 'border-green-200' : isPartiallyBooked ? 'border-blue-200' : isFullyBooked ? 'border-red-200 grayscale opacity-80' : 'border-orange-200'}`}>
                       {(t.images?.[0] || t.imageUrl) ? (
                           <img src={t.images?.[0] || t.imageUrl} loading="lazy" className="w-full h-full object-cover object-top" />
                       ) : (
                           <User className="w-full h-full p-2 text-gray-400 bg-gray-100" />
                       )}
                   </div>
                   <div className="flex-1">
                       <h3 className="font-bold text-gray-800 text-sm mb-1">{t.name}</h3>
                       {isComingSoon ? (
                         <div className="px-2 py-1 inline-block rounded border border-amber-300 bg-amber-50 text-amber-800 text-[9px] font-black leading-tight">
                           <span className="block pb-0.5 mb-0.5 border-b border-amber-200 uppercase">⏳ Coming Soon</span>
                           <span className="font-bold block">{comingSoonLabel}</span>
                         </div>
                       ) : (
                         <div className={`px-2 py-1.5 inline-block rounded border text-[9px] sm:text-[10px] font-bold leading-tight ${status.color}`}>
                            <span className="block pb-1 mb-1 border-b" style={{ borderColor: 'currentColor', opacity: 0.85 }}>{status.label}</span>
                            {status.activeService && (<span className="block pb-1 mb-1 border-b text-current opacity-90 leading-snug" style={{ borderColor: 'currentColor' }}>{status.activeService}</span>)}
                            <span className="font-semibold block opacity-90 leading-snug">{status.mm}</span>
                         </div>
                       )}
                   </div>
                   <div className="flex flex-col space-y-2 ml-2 flex-shrink-0">
                       <button
                         disabled={isFullyBooked}
                         onClick={() => !isComingSoon && onBookTherapist(t)}
                         className={`px-4 py-2 rounded-lg text-xs font-bold whitespace-nowrap shadow-sm flex items-center justify-center border transition-all ${
                           isComingSoon
                             ? 'bg-amber-100 text-amber-800 border-amber-300 cursor-not-allowed'
                             : isFullyBooked
                             ? 'bg-red-500/60 text-white border-transparent cursor-not-allowed'
                             : 'bg-[#123524] text-[#D4AF37] hover:bg-[#1a4a32] border-[#123524]'
                         }`}
                       >
                         {isComingSoon ? 'Coming Soon' : 'Book Now'}
                       </button>
                       {!isComingSoon && (
                         <button onClick={() => setViewingDetails(t)} className="px-2 py-1.5 rounded-lg text-[10px] font-bold whitespace-nowrap shadow-sm flex items-center justify-center border transition-all bg-yellow-50 text-[#123524] hover:bg-yellow-100 border-yellow-200"><Clock className="w-3 h-3 mr-1" /> အချိန်ဇယား</button>
                       )}
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
                 {top5Therapists.map((t: any, idx) => {
                     const isComingSoon = t.visibilityStatus === 'coming_soon' || Boolean(t.isComingSoon);
                     const status = getTherapistStatus(t.name);
                     const isFullyBooked = isComingSoon || status.label.includes('Fully Booked');

                     return (
                         <div key={t.id} className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden flex flex-col relative hover:shadow-md transition">
                             <div className="absolute top-0 left-0 bg-yellow-500 text-white w-7 h-7 flex items-center justify-center rounded-br-lg font-bold text-xs z-10 shadow-sm border-r border-b border-yellow-600">{idx + 1}</div>
                             {isComingSoon && (
                               <div className="absolute top-1.5 right-1.5 bg-amber-500 text-white text-[8px] font-black px-2 py-0.5 rounded-full z-10 shadow">
                                 Coming Soon
                               </div>
                             )}
                             <div className={`w-full aspect-[3/4] bg-gray-100 relative ${isFullyBooked ? 'grayscale opacity-80' : ''}`}>
                                 {(t.images?.[0] || t.imageUrl) ? (
                                     <img src={t.images?.[0] || t.imageUrl} loading="lazy" className="w-full h-full object-cover object-top" />
                                 ) : (
                                     <User className="w-full h-full p-6 text-gray-400 opacity-50" />
                                 )}
                             </div>
                             <div className="p-3 flex flex-col flex-1 justify-between bg-gray-50/50">
                                 <div className="font-bold text-gray-800 text-sm text-center mb-2 truncate px-1">{t.name}</div>
                                 <div className="flex flex-col space-y-2 mt-auto">
                                     <button
                                       disabled={isFullyBooked}
                                       onClick={() => !isComingSoon && onBookTherapist(t)}
                                       className={`w-full py-2 rounded-lg text-[10px] font-bold shadow-sm flex justify-center items-center border transition-all ${
                                         isComingSoon
                                           ? 'bg-amber-100 text-amber-800 border-amber-300 cursor-not-allowed'
                                           : isFullyBooked
                                           ? 'bg-red-500/60 text-white border-transparent cursor-not-allowed'
                                           : 'bg-[#123524] text-[#D4AF37] hover:bg-[#1a4a32] border-[#123524]'
                                       }`}
                                     >
                                       {isComingSoon ? 'Booking ပိတ်ထားသည်' : <>Book Now {!isFullyBooked && <ChevronRight className="w-3 h-3 ml-0.5"/>}</>}
                                     </button>
                                     {!isComingSoon && (
                                       <button onClick={() => setViewingDetails(t)} className={`w-full py-1.5 rounded-lg text-[10px] font-bold shadow-sm flex justify-center items-center border transition-all ${isFullyBooked ? 'bg-gray-100 text-gray-500 border-gray-200 hover:bg-gray-200' : 'bg-yellow-50 text-[#123524] hover:bg-yellow-100 border-yellow-200'}`}><Clock className="w-3 h-3 mr-1"/> အချိန်ဇယား</button>
                                     )}
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

// ==========================================
// CUSTOMER PROFILE - LUXURY UI (COMPACT)
// ==========================================
export function CustomerProfile({ appData, userPhone, onLoginSuccess, onLogout }: { appData: AppData, userPhone: string, onLoginSuccess: (phone: string) => void, onLogout: () => void }) {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [userDocId, setUserDocId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [editMode, setEditMode] = useState(false);
  const [formData, setFormData] = useState({ name: '', password: '', dob: '' });
  const [saving, setSaving] = useState(false);
  const [alertMessage, setAlertMessage] = useState('');
  
  const [viewDesc, setViewDesc] = useState<{title: string, desc: string} | null>(null);
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

  if (!userPhone) {
      return (
          <AuthRequest 
             onLoginSuccess={(phone) => {
                 onLoginSuccess(phone);
                 const searchParams = new URLSearchParams(window.location.search);
                 if (searchParams.get('return') === 'campaign') {
                     window.location.href = '/?campaign=true';
                 }
             }} 
             title="View Profile" 
          />
      );
  }
  if (loading) return <div className="text-center py-20 font-bold text-[#D4AF37] animate-pulse tracking-widest text-sm uppercase">Loading Profile...</div>;

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
    <div className="animate-fade-in max-w-sm mx-auto px-4 sm:px-0 relative pb-12">
      <CustomAlert message={alertMessage} onClose={() => setAlertMessage('')} />
      
      {/* 🌟 History Modal (Floating Card Style) ဘောင်ကွယ်ခြင်းပြဿနာ ဖြေရှင်းထားပါသည် */}
      {showHistory && (
          <div className="fixed inset-0 z-[999] bg-black/60 flex items-center justify-center p-4 sm:p-6 animate-fade-in backdrop-blur-sm" onClick={() => setShowHistory(false)}>
              <div className="bg-white w-full max-w-md rounded-[1.5rem] shadow-2xl overflow-hidden flex flex-col max-h-[85vh] animate-slide-up border border-[#D4AF37]/30" onClick={e => e.stopPropagation()}>
                  <div className="bg-gradient-to-r from-[#123524] to-[#1a4a32] p-4 sm:p-5 flex items-center justify-between sticky top-0 z-10 shadow-md">
                      <h3 className="text-[#D4AF37] font-bold text-sm flex items-center tracking-wide"><History className="w-4 h-4 mr-2" /> Points History</h3>
                      <button onClick={() => setShowHistory(false)} className="text-white hover:text-red-400 transition bg-white/10 hover:bg-white/20 p-1.5 rounded-full"><X className="w-4 h-4"/></button>
                  </div>
                  <div className="p-4 overflow-y-auto flex-1 bg-gray-50 space-y-3 pb-6">
                      {loadingHistory ? (<div className="text-center py-10 text-[#D4AF37] font-bold text-xs animate-pulse tracking-widest uppercase">Loading...</div>) : history.length === 0 ? (<div className="text-center py-10 text-gray-400 font-bold text-xs">Point ရရှိထားသော မှတ်တမ်းမရှိသေးပါ။</div>) : (
                          history.map((h, i) => (
                              <div key={i} className="bg-white p-3.5 rounded-xl shadow-sm border border-gray-100 flex items-center justify-between hover:border-[#D4AF37]/50 transition-all hover:shadow-md group">
                                  <div className="flex items-center">
                                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center mr-3 transition-transform group-hover:scale-105 ${h.type.includes('Online') ? 'bg-blue-50 text-blue-500 border border-blue-100' : 'bg-gradient-to-br from-[#123524] to-[#1a4a32] text-[#D4AF37] shadow-sm'}`}>
                                          {h.type.includes('Online') ? <CalendarPlus className="w-4 h-4"/> : <Home className="w-4 h-4"/>}
                                      </div>
                                      <div>
                                          <div className="font-bold text-[#123524] text-xs mb-0.5">{h.type}</div>
                                          <div className="text-[9px] font-semibold text-gray-500">{new Date(h.createdAt).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })}</div>
                                          <div className="text-[9px] font-bold text-gray-400 mt-0.5 uppercase tracking-wider">Spent: {formatPrice(h.amount)}</div>
                                      </div>
                                  </div>
                                  <div className="text-right">
                                      <div className="text-lg font-black text-green-600 drop-shadow-sm">+{h.pointsEarned}</div>
                                      <div className="text-[8px] font-bold text-gray-400 uppercase tracking-widest mt-0.5">Points</div>
                                  </div>
                              </div>
                          ))
                      )}
                  </div>
              </div>
          </div>
      )}

      {/* 🌟 Header */}
      <div className="text-center mb-6">
          <h2 className="text-xl font-bold text-[#123524] font-serif tracking-wide">My Profile</h2>
          <div className="w-8 h-1 bg-[#D4AF37] mx-auto rounded-full mt-2"></div>
      </div>

      {/* 🌟 Luxury Profile Card (Compact) */}
      <div className="relative bg-white p-6 sm:p-8 rounded-[1.5rem] shadow-[0_8px_30px_rgb(0,0,0,0.06)] border border-[#D4AF37]/20 text-center mb-6 overflow-hidden z-10 transition-all duration-500">
        
        {/* Background Glows */}
        <div className="absolute -top-16 -right-16 w-40 h-40 bg-[#D4AF37] opacity-10 rounded-full blur-3xl pointer-events-none"></div>
        <div className="absolute -bottom-16 -left-16 w-40 h-40 bg-[#123524] opacity-[0.04] rounded-full blur-3xl pointer-events-none"></div>

        {/* Profile Avatar */}
        <div className="relative z-10 w-20 h-20 bg-gradient-to-br from-[#123524] to-[#1a4a32] rounded-full mx-auto flex items-center justify-center mb-4 shadow-[0_4px_20px_rgba(18,53,36,0.4)] border-[2px] border-[#D4AF37]/50 group transition-all duration-500 hover:scale-105">
            <div className="absolute inset-0 rounded-full bg-[#D4AF37] opacity-0 group-hover:opacity-20 transition-opacity duration-500 blur-md"></div>
            {userTier ? <Crown className="w-8 h-8 drop-shadow-md text-[#D4AF37]" /> : <User className="w-8 h-8 text-[#D4AF37]" />}
        </div>
        
        {!editMode ? (
          <div className="animate-fade-in">
            <h3 className="relative z-10 text-xl font-bold text-[#123524] mb-1 tracking-wide drop-shadow-sm">{profile?.name || 'Walk-in Guest'}</h3>
            <p className="relative z-10 text-[10px] font-semibold text-gray-500 mb-4 flex items-center justify-center"><Phone className="w-3 h-3 mr-1.5 text-[#D4AF37]" /> {profile?.phone}</p>
            
            {userTier && (
                <div className="relative z-10 mb-6 inline-flex items-center px-4 py-1.5 rounded-full text-[10px] font-bold text-white shadow-md border border-white/20 transform hover:scale-105 transition-transform cursor-default" style={{ backgroundColor: userTier.colorTheme }}>
                    <Award className="w-3.5 h-3.5 mr-1.5"/> {userTier.name} ({userTier.discountPercent}%)
                </div>
            )}

            {/* Metrics Grid (Compact Height) */}
            <div className="relative z-10 grid grid-cols-2 gap-3 mb-6">
                {/* VIP Points Card (Gold Theme) */}
                <div className="bg-gradient-to-br from-yellow-50 to-yellow-100 border border-yellow-300 rounded-xl p-3 flex flex-col items-center justify-center shadow-md relative overflow-hidden group hover:-translate-y-0.5 transition-all duration-300">
                    <Star className="w-12 h-12 absolute -top-3 -right-3 text-yellow-500 opacity-10 group-hover:scale-110 transition-transform" />
                    <span className="text-[8px] text-yellow-700 font-bold uppercase tracking-widest flex items-center mb-1"><Star className="w-3 h-3 mr-1 animate-pulse"/> VIP Points</span>
                    <span className="text-2xl font-black text-[#123524] mb-2 drop-shadow-sm tracking-tight">{currentPoints}</span>
                    <button onClick={() => { setShowHistory(true); fetchHistory(); }} className="w-full py-1.5 bg-[#123524] text-[#D4AF37] rounded-lg text-[9px] font-bold shadow-sm hover:bg-[#1a4a32] transform hover:-translate-y-0.5 transition-all flex items-center justify-center tracking-wider uppercase"><History className="w-3 h-3 mr-1"/> History</button>
                </div>
                {/* Birthday Card (Green Border) */}
                <div className="bg-white border-2 border-[#123524]/60 rounded-xl p-3 flex flex-col items-center justify-center shadow-md hover:-translate-y-0.5 transition-all duration-300 relative overflow-hidden group">
                    <div className="absolute -bottom-6 -left-6 w-16 h-16 bg-blue-500 opacity-5 rounded-full blur-xl"></div>
                    <span className="text-[8px] text-blue-600 font-bold uppercase tracking-widest flex items-center mb-1.5"><Gift className="w-3 h-3 mr-1"/> Birthday</span>
                    <span className="text-[11px] font-black text-[#123524] my-auto bg-blue-50/50 px-2 py-1.5 rounded-lg border border-blue-100/50 w-full text-center">{(profile as any)?.dob ? new Date((profile as any).dob).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }) : 'Not Set'}</span>
                    <p className="text-[7.5px] text-gray-400 mt-1.5 font-semibold text-center leading-tight">Special bonuses on your birthday.</p>
                </div>
            </div>

            {/* VIP Progress Area (Compact) */}
            <div className="relative z-10 bg-gray-50/80 backdrop-blur-sm border border-gray-200/80 rounded-xl p-4 mb-6 shadow-sm text-left group hover:border-[#D4AF37]/40 transition-colors duration-300">
                <h4 className="text-[10px] font-bold text-[#123524] mb-3 flex items-center tracking-widest uppercase"><Target className="w-3.5 h-3.5 mr-1.5 text-[#D4AF37]"/> VIP Progress</h4>
                
                {nextTier ? (
                    <>
                        <div className="flex justify-between items-end mb-2">
                            <span className="text-[9px] font-bold text-gray-500 bg-white px-2 py-1 rounded shadow-sm border border-gray-100">Current: {currentPoints}</span>
                            <span className="text-[9px] font-bold text-[#123524] text-right truncate bg-yellow-50 px-2 py-1 rounded border border-[#D4AF37]/30 shadow-sm" title={nextTier.name}>{nextTier.name} ({nextTier.requiredPoints})</span>
                        </div>
                        <div className="w-full h-2 bg-gray-200/80 rounded-full overflow-hidden shadow-inner p-[1px]">
                            <div className="h-full rounded-full bg-gradient-to-r from-yellow-400 via-[#D4AF37] to-yellow-500 transition-all duration-1000 ease-out relative" style={{ width: `${progressPercent}%` }}></div>
                        </div>
                        <p className="text-[9px] text-gray-500 font-semibold mt-3 text-center leading-relaxed bg-white py-1.5 rounded-lg border border-gray-100"><span className="font-bold text-[#123524]">{nextTier.name}</span> ဖြစ်ရန် လိုအပ်သော ပွိုင့်: <span className="font-bold text-red-500 bg-red-50 px-1.5 py-0.5 rounded">{pointsNeeded} Pts</span></p>
                    </>
                ) : (
                    <div className="text-center py-3 bg-gradient-to-b from-yellow-50 to-white rounded-lg border border-[#D4AF37]/20 shadow-sm">
                        <Crown className="w-8 h-8 text-[#D4AF37] mx-auto mb-1 filter drop-shadow-sm" />
                        <p className="text-[9px] font-bold text-[#123524] leading-relaxed px-2">ဂုဏ်ယူပါသည်။ သင်သည် အမြင့်ဆုံး VIP အဆင့်သို့ ရောက်ရှိနေပါပြီ။</p>
                    </div>
                )}
                
                <div className="mt-3 p-2.5 bg-white rounded-lg border border-gray-100 flex justify-between items-center shadow-sm">
                    <span className="text-[9px] font-bold text-gray-500 flex items-center uppercase tracking-wider"><Calendar className="w-3 h-3 mr-1.5 text-[#D4AF37]"/> ယခုလ စုဆောင်းပွိုင့်</span>
                    <span className="text-xs font-black text-[#123524] bg-green-50/80 px-2 py-1 rounded-md border border-green-200 text-green-700">{monthlyPoints} Pts</span>
                </div>
                
                {isBdayMonth() && userTier && (
                    <div className="mt-3 p-3 bg-gradient-to-br from-blue-50 to-white border border-blue-200/60 rounded-lg shadow-sm relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-12 h-12 bg-blue-400 opacity-5 rounded-full blur-xl"></div>
                        <h5 className="text-[10px] font-bold text-blue-800 mb-1.5 flex items-center tracking-wide uppercase"><Gift className="w-3.5 h-3.5 mr-1.5"/> Birthday Month Bonus</h5>
                        <p className="text-[9px] text-blue-700 font-semibold mb-2.5 leading-relaxed opacity-90">ယခုလသည် သင့်မွေးနေ့လဖြစ်သောကြောင့် အထူးခံစားခွင့် ရရှိနေပါသည်။</p>
                        {(userTier.name.toLowerCase().includes('imperial') || userTier.name.toLowerCase().includes('v-vip')) ? (
                            <div className="flex justify-between items-center bg-white p-2 rounded-lg border border-blue-100 shadow-sm"><span className="text-[8px] text-gray-600 font-bold uppercase tracking-wider">Base 20% + Monthly {monthlyPoints}%</span><span className="text-xs font-black text-blue-600">{Math.min(100, 20 + monthlyPoints)}% OFF</span></div>
                        ) : (
                            <div className="flex justify-between items-center bg-white p-2 rounded-lg border border-blue-100 shadow-sm"><span className="text-[8px] text-gray-600 font-bold uppercase tracking-wider">VIP Standard Birthday</span><span className="text-xs font-black text-blue-600">50% OFF</span></div>
                        )}
                    </div>
                )}

                {/* Pre-Jade Target Logic UI */}
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
                        <div className="mt-3 pt-3 border-t border-gray-100/80 animate-fade-in">
                            <div className="mb-3">
                                <h5 className="text-[10px] font-bold text-[#123524] mb-2.5 flex items-center uppercase tracking-wider"><Target className="w-3.5 h-3.5 mr-1.5 text-green-600"/> Monthly Target Rewards (Pre-Jade)</h5>
                                <div className="flex justify-between items-end mb-1.5"><span className="text-[8px] font-bold text-gray-500 bg-white px-2 py-0.5 rounded shadow-sm border border-gray-100">Target: {actualTarget}% Off</span><span className="text-[8px] font-bold text-green-700 bg-green-50 px-2 py-0.5 rounded shadow-sm border border-green-100">{actualTarget} Pts</span></div>
                                <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden mb-2 shadow-inner"><div className="h-full rounded-full bg-gradient-to-r from-green-400 to-green-600 transition-all duration-1000 ease-out" style={{ width: `${targetProgressPercent}%` }}></div></div>
                                <p className="text-[8px] text-gray-500 font-semibold text-center bg-white py-1.5 rounded-md border border-gray-50"><span className="font-bold text-green-600">{actualTarget}% Off</span> ခံစားခွင့်ရရန် လိုအပ်သောပွိုင့်: <span className="font-bold text-red-500">{ptsNeededForTarget} Pts</span></p>
                            </div>
                            {(availableRewards.length > 0 || usedRewards.length > 0) && (
                                <div className="space-y-2 pt-2 border-t border-gray-100/80">
                                    <h5 className="text-[9px] font-bold text-[#123524] mb-2 flex items-center mt-1.5 uppercase tracking-wider"><Award className="w-3 h-3 mr-1.5 text-[#D4AF37]"/> Rewards Status</h5>
                                    {availableRewards.map(tier => (<div key={`avail-${tier}`} className="bg-gradient-to-r from-green-50 to-white text-[#123524] p-2 rounded-lg text-[9px] font-bold border border-green-200/60 flex items-center justify-between shadow-sm transform hover:-translate-y-0.5 transition-all"><span className="flex items-center"><Gift className="w-3 h-3 mr-1.5 text-green-600"/> {tier}% Discount</span><span className="bg-[#123524] text-[#D4AF37] px-2 py-1 rounded-md shadow-sm">၁ ကြိမ် ရရှိထားပါသည်</span></div>))}
                                    {usedRewards.map(tier => (<div key={`used-${tier}`} className="bg-gray-50 text-gray-400 p-2 rounded-lg text-[9px] font-bold border border-gray-200 flex items-center justify-between opacity-80"><span className="flex items-center"><CheckCircle className="w-3 h-3 mr-1.5"/> {tier}% Discount</span><span className="bg-gray-200 text-gray-500 px-2 py-1 rounded-md">အသုံးပြုပြီးပါပြီ</span></div>))}
                                </div>
                            )}
                        </div>
                    );
                })()}
            </div>

            {/* Badges & Edit Button */}
            <div className="relative z-10 flex flex-col gap-3">
                <div className={`text-[9px] rounded-lg px-3 py-2.5 flex items-center justify-center font-bold border transition-colors shadow-sm uppercase tracking-wider ${profile?.password ? 'text-green-700 bg-green-50/80 border-green-200' : 'text-gray-500 bg-gray-50/80 border-gray-200'}`}>
                    {profile?.password ? <><ShieldCheck className="w-3.5 h-3.5 mr-1.5 text-green-500" /> Account Secured (Password Set)</> : <><AlertCircle className="w-3.5 h-3.5 mr-1.5 text-gray-400" /> No Password Set (Auto-Login)</>}
                </div>
                <button onClick={() => setEditMode(true)} className="w-full py-3.5 bg-gradient-to-r from-[#123524] to-[#1a4a32] text-[#D4AF37] rounded-xl font-bold shadow-[0_4px_15px_rgba(18,53,36,0.3)] hover:shadow-[0_6px_20px_rgba(18,53,36,0.4)] transform hover:-translate-y-0.5 transition-all duration-300 flex justify-center items-center tracking-widest uppercase text-[10px]">
                    <Edit className="w-3.5 h-3.5 mr-1.5" /> Edit Profile Details
                </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSave} className="relative z-10 text-left space-y-4 animate-slide-up">
            <div>
                <label className="block text-[9px] font-bold text-gray-500 mb-1.5 uppercase tracking-wider">Full Name <span className="text-red-500">*</span></label>
                <input type="text" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:border-[#D4AF37] focus:ring-2 focus:ring-[#D4AF37]/20 transition-all font-bold text-xs text-[#123524] shadow-inner" required />
            </div>
            <div>
                <label className="block text-[9px] font-bold text-gray-500 mb-1.5 uppercase tracking-wider">Date of Birth (For Birthday Bonus)</label>
                <input type="date" value={formData.dob} onChange={e => setFormData({ ...formData, dob: e.target.value })} className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:border-[#D4AF37] focus:ring-2 focus:ring-[#D4AF37]/20 transition-all font-bold text-xs text-gray-700 shadow-inner" />
            </div>
            <div>
                <label className="block text-[9px] font-bold text-gray-500 mb-1.5 uppercase tracking-wider">Set Password (Optional)</label>
                <input type="password" value={formData.password} onChange={e => setFormData({ ...formData, password: e.target.value })} placeholder="Leave blank for auto-login" className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:border-[#D4AF37] focus:ring-2 focus:ring-[#D4AF37]/20 transition-all font-bold text-xs tracking-widest text-center shadow-inner" />
            </div>
            <div className="flex space-x-2.5 pt-3">
              <button type="button" onClick={() => setEditMode(false)} className="flex-1 py-3.5 bg-gray-50 text-gray-500 rounded-xl font-bold border border-gray-200 hover:bg-gray-100 hover:text-gray-700 transition-colors uppercase tracking-wider text-[10px]">Cancel</button>
              <button type="submit" disabled={saving} className="flex-1 py-3.5 bg-gradient-to-r from-[#123524] to-[#1a4a32] text-[#D4AF37] rounded-xl font-bold shadow-[0_4px_15px_rgba(18,53,36,0.3)] hover:shadow-[0_6px_20px_rgba(18,53,36,0.4)] transform hover:-translate-y-0.5 transition-all duration-300 uppercase tracking-widest text-[10px] flex justify-center items-center">{saving ? 'Saving...' : 'Save Changes'}</button>
            </div>
          </form>
        )}
      </div>

      {/* 🌟 Telegram Noti & Mini App Subscribe Button 🌟 */}
      <a
          href={getInstantTelegramLink(userPhone).httpsUrl}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => {
              e.preventDefault();
              openTelegramBotInstantly(userPhone);
          }}
          className="w-full mb-3 py-3.5 text-[#123524] bg-gradient-to-r from-yellow-50 to-amber-50 border border-[#D4AF37]/50 rounded-xl font-bold shadow-sm hover:bg-yellow-100 active:scale-95 transition-all flex justify-center items-center tracking-widest text-[10px] uppercase group"
      >
          <MessageCircle className="w-3.5 h-3.5 mr-1.5 text-[#D4AF37] group-hover:scale-110 transition-transform" /> Connect Telegram Noti & Mini App
      </a>

      <button onClick={onLogout} className="w-full py-3.5 text-red-500 bg-white border border-red-100 rounded-xl font-bold shadow-sm hover:bg-red-50 hover:border-red-200 transition-all flex justify-center items-center tracking-widest text-[10px] uppercase group">
          <LogOut className="w-3.5 h-3.5 mr-1.5 group-hover:scale-110 transition-transform" /> Log Out
      </button>
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

  // 🌟 အသစ်: User က Promotion ယူပြီးသားလား စစ်ဆေးရန် State နှင့် useEffect 🌟
  const [userPastPromo, setUserPastPromo] = useState(false);

  useEffect(() => {
      if (!userPhone) return;
      const checkPromoUsage = async () => {
          try {
              const currentPromoTitle = appData.promotion?.title || 'SPECIAL PROMO';
              const campaignPromoTitle = appData.promotion?.campaignTitle || 'အထူး ပရိုမိုးရှင်း အစီအစဉ်';
              const q = query(collection(db, 'bookings'), orderBy('createdAt', 'desc'), limit(100));
              const snap = await getDocs(q);
              let used = false;
              snap.forEach(d => {
                  const raw = d.data();
                  const decPhone = decryptText(raw.phone) || raw.phone;
                  if (decPhone === userPhone && raw.status !== 'cancelled') {
                      const dLabel = raw.discountLabel ? decryptText(raw.discountLabel) : '';
                      if (dLabel && (dLabel.includes(currentPromoTitle) || dLabel.includes(campaignPromoTitle) || dLabel.includes('WINNER'))) {
                          used = true;
                      }
                  }
              });
              setUserPastPromo(used);
          } catch (e) {}
      };
      checkPromoUsage();
  }, [userPhone, appData.promotion]);

  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [formData, setFormData] = useState({ name: isStaffMode ? 'Walk-in Guest' : '', phone: userPhone, selectedItem: null as MenuItem | null, isVvipUpgrade: false, therapist: initialTherapist, therapist2: null as TherapistProfile | null, date: '', time: '', paymentMethod: '', txId: '', specialRequest: '' });
  const [loading, setLoading] = useState(false);
  const [paymentDropdownOpen, setPaymentDropdownOpen] = useState(false);
  const [viewGallery, setViewGallery] = useState<{ images: string[], index: number, name?: string } | null>(null);
  const [loadingGalleryId, setLoadingGalleryId] = useState<string | null>(null);
  const [viewDesc, setViewDesc] = useState<{title: string, desc: string} | null>(null);

  const openGallery = async (t: TherapistProfile) => {
      setLoadingGalleryId(t.id);
      try {
          const docSnap = await getDoc(doc(db, 'therapists', t.id));
          if (docSnap.exists() && docSnap.data().images && docSnap.data().images.length > 0) {
              setViewGallery({ images: docSnap.data().images, index: 0, name: t.name });
          } else if (t.images && t.images.length > 0) {
              setViewGallery({ images: t.images, index: 0, name: t.name });
          }
      } catch (e) {
          if (t.images && t.images.length > 0) setViewGallery({ images: t.images, index: 0, name: t.name });
      }
      setLoadingGalleryId(null);
  };
  const [successMsg, setSuccessMsg] = useState('');
  const [lastSubmittedBooking, setLastSubmittedBooking] = useState<{
    id: string;
    service: string;
    therapist: string;
    date: string;
    time: string;
    phone: string;
    totalPrice: number;
    chatId: string;
    customerNotiSent: boolean;
  } | null>(null);
  const [tgBotTapped, setTgBotTapped] = useState(false);
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
      // 🌟 Index ပြဿနာမရှိစေရန် where အစား orderBy ကို ပြောင်းသုံးထားပါသည် 🌟
      const q = query(collection(db, 'bookings'), orderBy('createdAt', 'desc'), limit(150));
      const unsub = onSnapshot(q, (snap) => {
          const arr: Booking[] = [];
          snap.forEach(d => { 
              const raw = d.data(); 
              // Frontend ရောက်မှ လိုအပ်တဲ့ Date ကို စစ်ထုတ်ပါမည်
              if (raw.date >= todayStr) {
                  arr.push({ id: d.id, ...raw, name: decryptText(raw.name), phone: decryptText(raw.phone), txId: decryptText(raw.txId), specialRequest: decryptText(raw.specialRequest), discountLabel: raw.discountLabel ? decryptText(raw.discountLabel) : undefined } as Booking); 
              }
          });
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

  // 🌟 TYPE-AWARE PROMOTION ENGINE (% Discount | Mini Game | Category Discount) 🌟
  const activePromoType = resolvePromotionType(appData.promotion);

  const isPromoWithinDate = () => {
      const promo: any = appData.promotion;
      if (!promo || promo.allOff === true) return false;
      if (!promo.startDate || !promo.endDate) return false;
      const today = getLocalTodayStr();
      return today >= promo.startDate && today <= promo.endDate;
  };

  const checkBoxPromoActive = () => {
      const promo: any = appData.promotion;
      return Boolean(promo?.isBoxActive && isPromoWithinDate());
  };

  const isAnyDiscountChannelLive = () => {
      const promo: any = appData.promotion;
      return Boolean((promo?.isBoxActive || promo?.isPopupActive) && isPromoWithinDate());
  };

  const selectedCategoryObj = useMemo(() => {
      if (!formData.selectedItem) return null;
      return appData.categories.find(c => (c.items || []).some(i => i.id === formData.selectedItem?.id)) || null;
  }, [appData.categories, formData.selectedItem]);

  const isHotelService = useMemo(() => {
      if (!formData.selectedItem) return false;
      if (
        selectedCategoryObj &&
        (selectedCategoryObj.id === 'hotel_service' ||
          selectedCategoryObj.id === 'hotel' ||
          String(selectedCategoryObj.title || '').toLowerCase().includes('hotel'))
      ) {
        return true;
      }
      const itemNameLower = String(formData.selectedItem.name || '').toLowerCase();
      return itemNameLower.includes('outcall') || itemNameLower.includes('hotel') || itemNameLower.includes('half day') || itemNameLower.includes('whole');
  }, [selectedCategoryObj, formData.selectedItem]);

  const boxPromoActive = checkBoxPromoActive();
  const discountChannelLive = isAnyDiscountChannelLive();
  const isBirthday = () => { if (!userProfile?.dob || !formData.date) return false; const dobParts = userProfile.dob.split('-'); const bookParts = formData.date.split('-'); return dobParts[1] === bookParts[1] && dobParts[2] === bookParts[2]; };

  let finalDiscountPercent = 0; let discountLabel = '';

  const isMiniGameActive = () => {
      const promo: any = appData.promotion;
      return Boolean(
        activePromoType === 'mini_game' &&
        (promo?.isPopupActive || promo?.isBoxActive) &&
        isPromoWithinDate()
      );
  };

  const campaignDiscountStr = localStorage.getItem('shangrila_campaign_discount');
  const campaignLabelStr = localStorage.getItem('shangrila_campaign_label');
  const campaignWinDateStr = localStorage.getItem('shangrila_campaign_date');
  const validityDays = Math.max(1, Number((appData.promotion as any)?.rewardValidityDays) || 1);
  const isCampaignPrizeValid = (() => {
      if (!campaignWinDateStr) return true;
      const winMs = new Date(`${campaignWinDateStr}T00:00:00`).getTime();
      const todayMs = new Date(`${todayStr}T00:00:00`).getTime();
      if (isNaN(winMs) || isNaN(todayMs)) return campaignWinDateStr === todayStr;
      const diffDays = Math.floor((todayMs - winMs) / (1000 * 60 * 60 * 24));
      return diffDays >= 0 && diffDays < validityDays;
  })();
  const campaignPrize = campaignDiscountStr && isCampaignPrizeValid ? parseInt(campaignDiscountStr, 10) : 0;
  const outcallRewardCap = Math.max(0, Number((appData.promotion as any)?.outcallRewardCap ?? 10));
  const boxPromoTitle = appData.promotion?.boxTitle || appData.promotion?.title || 'SPECIAL PROMO';

  // Type-Strict Discount Resolution (Zero Cross-Type Leakage!)
  if (activePromoType === 'mini_game' && isMiniGameActive() && campaignPrize > 0 && !userPastPromo) {
      finalDiscountPercent = isHotelService ? Math.min(outcallRewardCap, campaignPrize) : campaignPrize;
      discountLabel = `${campaignLabelStr || appData.promotion?.campaignTitle || 'Campaign'} WINNER (${finalDiscountPercent}%)`;
  } else if (activePromoType === 'percentage_discount' && discountChannelLive && !userPastPromo) {
      finalDiscountPercent = isHotelService
        ? (appData.promotion?.hotelDiscountPercent || 0)
        : (appData.promotion?.otherDiscountPercent || 0);
      if (finalDiscountPercent > 0) {
        discountLabel = `${boxPromoTitle} (${finalDiscountPercent}%)`;
      }
  } else if (activePromoType === 'category_discount' && discountChannelLive && !userPastPromo) {
      const catPct = getCategoryDiscountPercent(
        (appData.promotion as any)?.categoryDiscounts,
        selectedCategoryObj?.id,
        selectedCategoryObj?.title
      );
      if (catPct > 0) {
        finalDiscountPercent = catPct;
        discountLabel = `${boxPromoTitle} - ${selectedCategoryObj?.title || 'Category'} (${catPct}%)`;
      }
  }

  if (finalDiscountPercent === 0 && vipSettings.isActive && userProfile) {
      const currentMonthPrefix = getLocalTodayStr().substring(0, 7);
      const monthlyPts = pointHistory.filter(h => h.date && h.date.startsWith(currentMonthPrefix)).reduce((s, h) => s + h.pointsEarned, 0);
      
      const tierPercent = userTier ? userTier.discountPercent : 0; 
      const tierLabel = userTier ? `${userTier.name} Discount (${tierPercent}%)` : '';
      
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
          if (userTier.name.toLowerCase().includes('imperial') || userTier.name.toLowerCase().includes('v-vip')) { 
              bdayPercent = Math.min(100, 20 + monthlyPts); 
              bdayLabel = `Imperial Birthday Bonus (${bdayPercent}%)`; 
          } else { 
              bdayPercent = 50; 
              bdayLabel = `VIP Birthday Bonus (50%)`; 
          }
      }

      if (bdayPercent > Math.max(oneTimePercent, tierPercent)) { 
          finalDiscountPercent = bdayPercent; discountLabel = bdayLabel; 
      } else if (tierPercent >= oneTimePercent && tierPercent > 0) { 
          finalDiscountPercent = tierPercent; discountLabel = tierLabel; 
      } else if (oneTimePercent > 0) { 
          finalDiscountPercent = oneTimePercent; discountLabel = oneTimeLabel; 
      }
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
    let allowedSlots = ALL_TIME_SLOTS.slice(ALL_TIME_SLOTS.indexOf("9:00 AM"), ALL_TIME_SLOTS.indexOf("9:00 PM") + 1);
    if (formData.selectedItem) {
        const fixedDetails = getFixedServiceDetails(formData.selectedItem.name);
        if (fixedDetails) {
            let startIndex = ALL_TIME_SLOTS.indexOf(fixedDetails.start); let endIndex = ALL_TIME_SLOTS.indexOf(fixedDetails.end);
            if (fixedDetails.nextDay || endIndex === -1) endIndex = ALL_TIME_SLOTS.length; allowedSlots = ALL_TIME_SLOTS.slice(Math.max(0, startIndex), endIndex);
        } else {
            const serviceName = (formData.selectedItem.name || '').toLowerCase();
            const isNightService = serviceName.includes("night");
            const isOutcallService = serviceName.includes("outcall");
            const isHotelCategory = appData.categories.some(c => 
                (c.id === 'hotel' || (c.title || '').toLowerCase().includes('hotel') || (c.title || '').toLowerCase().includes('home')) &&
                c.items.some(i => i.id === formData.selectedItem?.id || i.name === formData.selectedItem?.name)
            );

            if (isOutcallService) {
                // 🌟 Part Time Outcall အား မနက် 7:00 AM မှ ည 7:00 PM အထိသာ တိကျစွာ ကန့်သတ်ထားသည်
                allowedSlots = ALL_TIME_SLOTS.slice(ALL_TIME_SLOTS.indexOf("7:00 AM"), ALL_TIME_SLOTS.indexOf("7:00 PM") + 1);
            } else if (isHotelCategory && isNightService) {
                allowedSlots = ["7:00 PM", "7:30 PM", "8:00 PM", "8:30 PM", "9:00 PM", "9:30 PM", "10:00 PM", "10:30 PM", "11:00 PM"];
            } else {
                allowedSlots = ALL_TIME_SLOTS.slice(ALL_TIME_SLOTS.indexOf("9:00 AM"), ALL_TIME_SLOTS.indexOf("9:00 PM") + 1);
            }
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
          const activeTgChatId = getActiveCustomerTelegramChatId();
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
            customerChatId: activeTgChatId, 
            telegramChatId: activeTgChatId, 
            service: `${formData.selectedItem?.name || ''} ${formData.selectedItem?.duration ? `(${formData.selectedItem.duration})` : ''} ${formData.isVvipUpgrade ? '+ VVIP Upgrade' : ''} ${formData.selectedItem?.vvipIncluded ? '(VVIP Included)' : ''}`.trim(),
            therapist: combinedTherapistName,
            date: formData.date || todayStr, time: finalTimeStr || '00:00', paymentMethod: isStaffMode ? 'Cash Payment in Shop' : (formData.paymentMethod || '-'), 
            txId: encryptText(isStaffMode ? 'CASH' : (formData.txId || '-')), totalPrice: Number(calculateTotal()) || 0, status: isStaffImmediate ? 'in_progress' : (isStaffMode ? 'approved' : 'pending'), 
            createdAt: Date.now(), specialRequest: encryptText(formData.specialRequest || ''), originalPrice: encryptText(calculateSubTotal().toString()), discountPercent: encryptText(finalDiscountPercent.toString()),
            discountLabel: encryptText(discountLabel || ''), vipTierName: encryptText(userTier ? userTier.name : ''), ...(isStaffImmediate && { startTimeMillis: Number(fluidStartTimeMillis) || Date.now(), expectedEndTimeMillis: Number(expectedEndTimeMillis) || Date.now() })
          };

          Object.keys(dataToSave).forEach(key => dataToSave[key] === undefined ? delete dataToSave[key] : {});
          const bookingDocRef = await addDoc(collection(db, 'bookings'), dataToSave);

          // 🌟 REAL-TIME TELEGRAM NOTIFICATION ပေးပို့ခြင်း 🌟
          const plainCustomerName = formData.name || (staffClockIn ? 'Walk-in (Staff-initiated)' : 'Walk-in Guest');
          const plainServiceTitle = `${formData.selectedItem?.name || ''} ${formData.isVvipUpgrade ? '+ VVIP Upgrade' : ''} ${formData.selectedItem?.vvipIncluded ? '(VVIP Included)' : ''}`.trim();
          const roomLabel = (formData.isVvipUpgrade || formData.selectedItem?.vvipIncluded) ? 'VVIP Master Room' : 'Standard Room';
          const paymentSummary = isStaffMode
              ? 'Cash Payment in Shop'
              : `${formData.paymentMethod || '-'} (TxID: ${formData.txId || '-'} | စရံ: ${formatPrice(calculateTotal() / 2)})`;
          const combinedNotes = [
              `💳 ငွေပေးချေမှု: ${paymentSummary}`,
              discountLabel ? `🏷️ Discount: ${discountLabel} (-${finalDiscountPercent}%)` : null,
              formData.specialRequest ? `📝 မှတ်ချက်: ${formData.specialRequest}` : null
          ].filter(Boolean).join(' | ');

          const bookingStatusForNoti = isStaffImmediate ? 'in-service' : (isStaffMode ? 'confirmed' : 'pending');

          setTgBotTapped(false);
          setLastSubmittedBooking({
              id: bookingDocRef.id,
              service: plainServiceTitle,
              therapist: combinedTherapistName,
              date: formData.date || todayStr,
              time: finalTimeStr || '00:00',
              phone: phoneToUse,
              totalPrice: Number(calculateTotal()) || 0,
              chatId: activeTgChatId,
              customerNotiSent: false
          });

          // 1. Admin Group နှင့် Primary Therapist ထံသို့ ပေးပို့ခြင်း (+ Customer Direct Telegram Noti)
          notifyBookingEvent(isStaffImmediate ? 'STATUS_UPDATE' : 'NEW_BOOKING', {
              id: bookingDocRef.id,
              customerName: plainCustomerName,
              customerPhone: phoneToUse || '-',
              customerChatId: activeTgChatId || undefined,
              serviceName: plainServiceTitle,
              duration: formData.selectedItem?.duration || '',
              price: Number(calculateTotal()) || 0,
              date: formData.date || todayStr,
              time: finalTimeStr || '00:00',
              therapistId: formData.therapist?.id || formData.therapist?.name || '',
              therapistName: combinedTherapistName,
              roomName: roomLabel,
              vipTier: userTier ? `${userTier.name} (${userTier.discountPercent}% OFF)` : undefined,
              status: bookingStatusForNoti,
              notes: combinedNotes,
              updatedBy: isStaffMode ? (staffClockIn ? 'Staff Clock-In' : 'Staff Walk-In') : 'Customer Online App'
          })
            .then((res) => {
              if (res?.customerSent || res?.chatId) {
                setLastSubmittedBooking((prev) =>
                  prev && prev.id === bookingDocRef.id
                    ? {
                        ...prev,
                        chatId: res.chatId || prev.chatId,
                        customerNotiSent: Boolean(res.customerSent),
                      }
                    : prev
                );
              }
            })
            .catch(err => console.warn('Telegram booking notification error:', err));

          // 2. Four Hands ဖြစ်၍ ဒုတိယ Therapist ပါဝင်ပါက ဒုတိယ Therapist ထံသို့လည်း သီးသန့် ထပ်ပို့ပေးခြင်း
          if (isFourHands && formData.therapist2) {
              notifyBookingEvent('STAFF_ASSIGNED', {
                  id: bookingDocRef.id,
                  customerName: plainCustomerName,
                  customerPhone: phoneToUse || '-',
                  customerChatId: activeTgChatId || undefined,
                  serviceName: `${plainServiceTitle} (Four Hands Partner: ${formData.therapist?.name || '-'})`,
                  duration: formData.selectedItem?.duration || '',
                  price: Number(calculateTotal()) || 0,
                  date: formData.date || todayStr,
                  time: finalTimeStr || '00:00',
                  therapistId: formData.therapist2.id || formData.therapist2.name,
                  therapistName: formData.therapist2.name,
                  roomName: roomLabel,
                  status: bookingStatusForNoti,
                  notes: formData.specialRequest || '',
                  updatedBy: 'Four Hands Assignment'
              }).catch(err => console.warn('Telegram 2nd therapist notification error:', err));
          }

          // 🌟 Booking တင်ပြီးသွားပါက Campaign Discount ကို ဖျက်ပစ်မည် 🌟
          localStorage.removeItem('shangrila_campaign_discount');
          localStorage.removeItem('shangrila_campaign_label');
          setSuccessMsg('Booking အောင်မြင်စွာ တင်ပြီးပါပြီ။' + (isStaffMode ? '' : ' Admin မှ မကြာမီ ပြန်လည်ဆက်သွယ် အတည်ပြုပေးပါမည်။'));
      } catch (error: any) { console.error(error); setAlertMessage("Error: " + (error.message || "Booking တင်ရာတွင် အခက်အခဲရှိနေပါသည်။")); }
      setLoading(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isStaffMode && formData.txId.length !== 6) { setAlertMessage("Transaction ID နောက်ဆုံး ၆ လုံးကို မှန်ကန်စွာ ဖြည့်ပေးပါ။"); return; }

    // 🌟 Guard: Part Time Outcall သည် ည 7:00 PM ထက် နောက်ကျ၍ လုံးဝ ဘိုကင်တင်ခွင့်မပြုပါ
    if (!staffClockIn && formData.selectedItem) {
      const startSlotOnly = (formData.time || '').split(' to ')[0].trim();
      const validSlotsForService = getAvailableTimeSlots(formData.date || todayStr);
      if (!validSlotsForService.includes(startSlotOnly)) {
        setAlertMessage("ရွေးချယ်ထားသော ဝန်ဆောင်မှုအတွက် သတ်မှတ်ချိန် ကျော်လွန်နေပါသည် (Part Time Outcall သည် ည 7:00 PM နောက်ဆုံးဖြစ်ပါသည်)။ ကျေးဇူးပြု၍ အချိန်ပြန်ရွေးပေးပါ။");
        setFormData(prev => ({ ...prev, time: '' }));
        setStep(3);
        return;
      }
    }

    setLoading(true);
    try {
      const activeTgChatId = getActiveCustomerTelegramChatId();
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
          await addDoc(collection(db, 'users'), {
            phone: encryptText(formData.phone.trim()),
            name: encryptText(formData.name || ''),
            password: encryptText(''),
            points: encryptText('0'),
            dob: encryptText(''),
            createdAt: Date.now(),
            ...(activeTgChatId ? { telegramChatId: activeTgChatId, telegramSubscribed: true, telegramLinkedAt: Date.now() } : {})
          });
        } else {
          const userPatch: Record<string, any> = {};
          if (!hasName && formData.name) userPatch.name = encryptText(formData.name);
          if (activeTgChatId) {
            userPatch.telegramChatId = activeTgChatId;
            userPatch.telegramSubscribed = true;
            userPatch.telegramLinkedAt = Date.now();
          }
          if (Object.keys(userPatch).length > 0) {
            await updateDoc(doc(db, 'users', userRefId), userPatch);
          }
        }
      }
      processBooking(formData.phone.trim());
    } catch (error: any) { console.error(error); setAlertMessage("Error checking database."); setLoading(false); }
  };

  if (successMsg) {
    const confirmedPhone = lastSubmittedBooking?.phone || formData.phone || userPhone;
    const confirmedBookingId = lastSubmittedBooking?.id || '';
    const isTgLinked = Boolean(lastSubmittedBooking?.chatId);
    const tgLinkInfo = getInstantTelegramLink(confirmedPhone, confirmedBookingId);

    return (
      <div className="max-w-lg mx-auto mt-6 sm:mt-10 space-y-4 animate-fade-in">
        {/* Main Booking Confirmed Card */}
        <div className="bg-white p-7 sm:p-9 rounded-2xl shadow-lg text-center border border-gray-100">
          <div className="w-18 h-18 sm:w-20 sm:h-20 bg-emerald-50 border-2 border-emerald-200 rounded-full flex items-center justify-center mx-auto mb-5 shadow-sm">
            <CheckCircle className="w-10 h-10 text-emerald-600" />
          </div>
          <h2 className="text-2xl font-bold mb-2" style={{ color: THEME.primary }}>Booking Confirmed!</h2>
          <p className="text-gray-600 text-sm mb-5 leading-relaxed font-semibold">{successMsg}</p>

          {/* Compact Booking Receipt Summary */}
          {lastSubmittedBooking && !staffClockIn && (
            <div className="bg-[#F8FAF9] border border-[#123524]/15 rounded-xl p-3.5 mb-6 text-left text-xs space-y-1.5">
              <div className="flex items-center justify-between border-b border-gray-200/80 pb-1.5">
                <span className="text-gray-500 font-semibold">Booking ID</span>
                <span className="font-mono font-black text-[#123524] bg-[#D4AF37]/20 px-2 py-0.5 rounded">
                  #{lastSubmittedBooking.id.slice(-6).toUpperCase()}
                </span>
              </div>
              <div className="flex items-start justify-between gap-3">
                <span className="text-gray-500 font-semibold flex-shrink-0">ဝန်ဆောင်မှု</span>
                <span className="font-bold text-gray-800 text-right">{lastSubmittedBooking.service}</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-gray-500 font-semibold">Therapist</span>
                <span className="font-bold text-[#123524]">{lastSubmittedBooking.therapist}</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-gray-500 font-semibold">ရက်စွဲ / အချိန်</span>
                <span className="font-bold text-gray-800">{lastSubmittedBooking.date} • {lastSubmittedBooking.time}</span>
              </div>
            </div>
          )}

          <button onClick={() => { 
             if (staffClockInSuccess) { staffClockInSuccess(); return; }
             if (isStaffMode) { setStep(1); setFormData({ name: 'Walk-in Guest', phone: '', selectedItem: null, isVvipUpgrade: false, therapist: initialTherapist, therapist2: null, date: '', time: '', paymentMethod: '', txId: '', specialRequest: '' }); setSuccessMsg(''); setLastSubmittedBooking(null); window.scrollTo({ top: 0, behavior: 'smooth' }); } 
             else { setSuccessMsg(''); setLastSubmittedBooking(null); if (onBooked) onBooked(confirmedPhone); }
          }} className="px-8 py-3.5 font-bold rounded-xl transition text-white w-full shadow-md hover:opacity-95 active:scale-[0.99]" style={{ backgroundColor: THEME.primary }}>
             {staffClockIn ? 'Finish' : (isStaffMode ? 'နောက်ထပ် ဘိုကင်တင်မည် (Add Another)' : 'မှတ်တမ်းကြည့်ရန် (View History)')}
          </button>
        </div>

        {/* 🌟 Telegram Booking Status Update Noti Opt-In Card (Right Below Confirmation) 🌟 */}
        {!isStaffMode && !staffClockIn && (
          <div className="bg-gradient-to-br from-[#0e2a1c] via-[#123524] to-[#0b2317] text-white p-5 sm:p-6 rounded-2xl shadow-xl border border-[#D4AF37]/45 relative overflow-hidden">
            <div className="absolute -right-8 -top-8 w-32 h-32 rounded-full bg-[#229ED9]/15 blur-2xl pointer-events-none" />
            <div className="relative z-10">
              <div className="flex items-start gap-3 mb-3.5">
                <div className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 border shadow-md ${isTgLinked ? 'bg-emerald-500/20 border-emerald-400/50 text-emerald-300' : 'bg-[#229ED9]/25 border-[#229ED9]/50 text-[#5bc0f8]'}`}>
                  <Bell className="w-5 h-5" />
                </div>
                <div className="text-left flex-1 min-w-0">
                  <div className="flex items-center flex-wrap gap-2 mb-1">
                    <h3 className="font-bold text-sm sm:text-base text-[#F5DC82] leading-snug">
                      Telegram မှ Booking Status Update Noti ရယူရန်
                    </h3>
                    {isTgLinked && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-black px-2 py-0.5 rounded-full bg-emerald-500/25 text-emerald-200 border border-emerald-400/40">
                        <Check className="w-3 h-3" /> Noti ON
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] sm:text-xs text-emerald-100/85 leading-relaxed">
                    {isTgLinked
                      ? 'သင်၏ Telegram အကောင့်နှင့် ချိတ်ဆက်ပြီးဖြစ်ပါသည်။ Admin မှ ဘိုကင် Approved, ဝန်ဆောင်မှုစတင်ချိန် နှင့် ပြီးဆုံးချိန် Update များကို Bot မှ အလိုအလျောက် ပေးပို့ပေးပါမည်။'
                      : 'Admin မှ ဘိုကင် အတည်ပြု (Approved)၊ ဝန်ဆောင်မှုစတင် (In-Service) နှင့် ပြီးဆုံးချိန် Update များကို Telegram Bot မှ ချက်ချင်း သိရှိနိုင်ရန် အခုပဲ ချိတ်ဆက်ထားလိုက်ပါ။'}
                  </p>
                </div>
              </div>

              {isTgLinked && lastSubmittedBooking?.customerNotiSent && (
                <div className="mb-3.5 px-3 py-2 rounded-xl bg-emerald-500/15 border border-emerald-400/35 text-[11px] font-bold text-emerald-200 flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-emerald-300 flex-shrink-0" />
                  <span>ဘိုကင်တင်ပြီးကြောင်း (Booking Pending) Noti ကို သင်၏ Telegram သို့ ပေးပို့ပြီးပါပြီ။</span>
                </div>
              )}

              <a
                href={tgLinkInfo.httpsUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => {
                  e.preventDefault();
                  setTgBotTapped(true);
                  openTelegramBotInstantly(confirmedPhone, confirmedBookingId);
                }}
                className={`w-full py-3.5 px-4 rounded-xl font-bold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-lg transition-all active:scale-[0.98] ${
                  isTgLinked
                    ? 'bg-white/10 hover:bg-white/15 text-[#F5DC82] border border-[#D4AF37]/50'
                    : 'bg-gradient-to-r from-[#229ED9] to-[#1b86ba] hover:brightness-110 text-white border border-sky-300/40'
                }`}
              >
                <Send className="w-4 h-4" />
                <span>
                  {isTgLinked
                    ? 'Telegram Bot Chat ဖွင့်ကြည့်ရန် (Open Bot)'
                    : 'Telegram Bot နှင့် ချိတ်ဆက်ပြီး Noti ရယူမည်'}
                </span>
              </a>

              {!isTgLinked && (
                <p className="mt-2.5 text-[11px] text-center text-amber-200/90 font-medium">
                  * Telegram ပွင့်လာပါက အောက်ဆုံးရှိ <strong className="text-white">START</strong> ခလုတ်ကို တစ်ချက်နှိပ်ပေးရုံဖြင့် ဤဘိုကင်နှင့် အလိုအလျောက် ချိတ်ဆက်ပြီးဖြစ်ပါသည်။
                </p>
              )}

              {tgBotTapped && !isTgLinked && (
                <div className="mt-3 px-3 py-2 rounded-xl bg-[#D4AF37]/20 border border-[#D4AF37]/50 text-[11px] text-amber-100 font-semibold text-center">
                  Telegram Bot သို့ ဖွင့်လိုက်ပါပြီ — Bot ထဲတွင် <strong>START</strong> နှိပ်ပြီးပါက Status Update Noti များ စတင်ရရှိပါမည်။
                </div>
              )}
            </div>
          </div>
        )}
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
    <div className="animate-fade-in -mx-1.5 sm:mx-0">
      
      {/* 🌟 အသစ်: Ripple Animation & Falling Box Lanterns CSS 🌟 */}
      <style>{`
          .ripple-effect {
              position: absolute;
              border-radius: 50%;
              background: rgba(255, 255, 255, 0.4);
              transform: scale(0);
              animation: ripple 0.6s linear;
              pointer-events: none;
          }
          @keyframes ripple {
              to {
                  transform: scale(4);
                  opacity: 0;
              }
          }
          @keyframes boxMiniFall { 
              0% { transform: translateY(-20px) rotate(-10deg); opacity: 0; } 
              20% { opacity: 1; } 
              100% { transform: translateY(150px) rotate(15deg); opacity: 0; } 
          }
          .box-mini-lantern { 
              position: absolute; 
              animation-name: boxMiniFall; 
              animation-timing-function: ease-in-out; 
              pointer-events: none; 
              filter: drop-shadow(0 0 5px rgba(255, 140, 0, 0.5));
              z-index: 1;
          }
      `}</style>

      {viewDesc && (
          <div className="fixed inset-0 z-[9999] bg-black/60 flex items-center justify-center p-4 sm:p-6 animate-fade-in backdrop-blur-sm" onClick={() => setViewDesc(null)}>
              <div className="bg-white w-full max-w-sm rounded-[1.5rem] shadow-2xl overflow-hidden flex flex-col animate-slide-up border border-[#D4AF37]/30" onClick={e => e.stopPropagation()}>
                  <div className="bg-gradient-to-r from-[#123524] to-[#1a4a32] p-4 flex items-center justify-between shadow-md">
                      <h3 className="text-[#D4AF37] font-bold text-sm tracking-wide flex items-center"><Info className="w-4 h-4 mr-2" /> {viewDesc.title}</h3>
                      <button onClick={() => setViewDesc(null)} className="text-white hover:text-red-400 transition bg-white/10 hover:bg-white/20 p-1.5 rounded-full"><X className="w-4 h-4"/></button>
                  </div>
                  <div className="p-6 text-[11px] sm:text-xs text-gray-700 leading-relaxed text-left font-semibold bg-gray-50/50 whitespace-pre-wrap">
                      {viewDesc.desc || 'အကောင်းဆုံးသော ဝန်ဆောင်မှုဖြင့် လူကြီးမင်း၏ ပင်ပန်းနွမ်းနယ်မှုများကို အပြည့်အဝ ပြေပျောက်စေပါမည်။'}
                  </div>
                  <div className="p-4 border-t border-gray-100 bg-white">
                      <button onClick={() => setViewDesc(null)} className="w-full py-3 bg-gray-100 text-gray-700 rounded-xl font-bold shadow-sm hover:bg-gray-200 transition text-xs uppercase tracking-widest border border-gray-200">
                          ပိတ်မည် (Close)
                      </button>
                  </div>
              </div>
          </div>
      )}


      {/* 🌟 Type-Aware Customer App Booking Promo Box (% Discount | Mini Game | Category Discount) 🌟 */}
      {boxPromoActive && !userPastPromo && (
        <div className="relative overflow-hidden bg-gradient-to-r from-[#0B2419] via-[#123524] to-[#0B2419] p-4 sm:p-5 rounded-2xl mb-6 shadow-md border border-[#D4AF37]/40 animate-fade-in mx-1.5 sm:mx-0">
          <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-start sm:items-center gap-3 min-w-0">
              <div className="w-10 h-10 bg-gradient-to-br from-[#D4AF37] to-yellow-600 rounded-xl flex items-center justify-center border border-[#123524] shadow-sm flex-shrink-0">
                {activePromoType === 'mini_game' ? (
                  <Gift className="w-5 h-5 text-[#0B2419]" />
                ) : (
                  <Percent className="w-5 h-5 text-[#0B2419]" />
                )}
              </div>
              <div className="min-w-0">
                <div className="text-[10px] font-bold text-emerald-300 uppercase tracking-wider">
                  {activePromoType === 'mini_game'
                    ? 'Mini Game Campaign'
                    : activePromoType === 'category_discount'
                    ? 'Category Special'
                    : 'Special Discount'}
                  {' · '}
                  Valid until {appData.promotion?.endDate}
                </div>
                <h4 className="font-extrabold text-[#D4AF37] text-sm sm:text-base leading-snug mt-0.5 truncate">
                  {appData.promotion?.boxTitle || appData.promotion?.campaignTitle || promoTitle}
                </h4>
                {(appData.promotion as any)?.description && (
                  <p className="text-[11px] text-gray-300 mt-0.5 leading-snug">
                    {(appData.promotion as any).description}
                  </p>
                )}
              </div>
            </div>

            {/* Right Action / Offer Summary based on exact Promo Type */}
            {activePromoType === 'mini_game' ? (
              <div className="flex items-center gap-2 shrink-0">
                {campaignPrize > 0 ? (
                  <div className="bg-emerald-500/20 border border-emerald-400/40 rounded-xl px-3.5 py-2 text-right">
                    <div className="text-[10px] text-emerald-200 font-bold">Your Reward</div>
                    <div className="text-sm font-black text-[#D4AF37] tabular-nums">{campaignPrize}% OFF Ready</div>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      const cid = (appData.promotion as any)?.activeCampaignId;
                      window.location.href = cid
                        ? `/?mode=campaign&campaign=${encodeURIComponent(cid)}`
                        : '/?mode=campaign';
                    }}
                    className={`w-full sm:w-auto min-h-[42px] px-4 py-2 rounded-xl font-black text-xs shadow transition flex items-center justify-center gap-1.5 ${
                      resolveMiniGameStyle(appData.promotion) === 'christmas_santa'
                        ? 'bg-gradient-to-r from-[#B91C1C] to-[#991B1B] hover:from-[#DC2626] hover:to-[#B91C1C] text-[#FDE68A] border border-[#D4AF37]/70'
                        : 'bg-[#D4AF37] hover:bg-[#c59b27] text-[#0B2419]'
                    }`}
                  >
                    <Gift className="w-4 h-4 shrink-0" />
                    <span>
                      {resolveMiniGameStyle(appData.promotion) === 'christmas_santa'
                        ? 'Santa ထံမှ လက်ဆောင်တောင်းမည်'
                        : 'ကံစမ်းမည်'}{' '}
                      (Up to{' '}
                      {Array.isArray((appData.promotion as any)?.gameRewardTiers) &&
                      (appData.promotion as any).gameRewardTiers.length > 0
                        ? Math.max(...(appData.promotion as any).gameRewardTiers.map(Number))
                        : 50}
                      %)
                    </span>
                  </button>
                )}
              </div>
            ) : activePromoType === 'category_discount' ? (
              <div className="flex flex-wrap gap-1.5 sm:justify-end">
                {appData.categories
                  .map((cat) => ({
                    id: cat.id,
                    title: cat.title,
                    pct: getCategoryDiscountPercent((appData.promotion as any)?.categoryDiscounts, cat.id, cat.title),
                  }))
                  .filter((entry) => entry.pct > 0)
                  .map((entry) => (
                    <div
                      key={entry.id}
                      className="bg-black/25 text-white text-[11px] font-bold px-2.5 py-1.5 rounded-lg border border-[#D4AF37]/30 flex items-center gap-2 tabular-nums"
                    >
                      <span className="text-gray-200">{entry.title}</span>
                      <span className="text-[#D4AF37] font-black">{entry.pct}% OFF</span>
                    </div>
                  ))}
              </div>
            ) : (
              <div className="flex sm:flex-col gap-1.5 shrink-0">
                {(appData.promotion?.otherDiscountPercent || 0) > 0 && (
                  <div className="flex-1 sm:flex-none bg-black/25 text-white text-[11px] font-bold px-3 py-1.5 rounded-lg border border-[#D4AF37]/30 flex items-center justify-between gap-3 tabular-nums">
                    <span className="flex items-center text-gray-200">
                      <Activity className="w-3 h-3 mr-1 text-[#D4AF37]" /> In-Spa
                    </span>
                    <span className="text-[#D4AF37] font-black">{appData.promotion?.otherDiscountPercent}% OFF</span>
                  </div>
                )}
                {(appData.promotion?.hotelDiscountPercent || 0) > 0 && (
                  <div className="flex-1 sm:flex-none bg-black/25 text-white text-[11px] font-bold px-3 py-1.5 rounded-lg border border-[#D4AF37]/30 flex items-center justify-between gap-3 tabular-nums">
                    <span className="flex items-center text-gray-200">
                      <Home className="w-3 h-3 mr-1 text-[#D4AF37]" /> Outcall
                    </span>
                    <span className="text-[#D4AF37] font-black">{appData.promotion?.hotelDiscountPercent}% OFF</span>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      <div className="text-center mb-6 sm:mb-8 px-1.5 sm:px-0">
        <h2 className="text-xl sm:text-2xl font-bold" style={{ color: THEME.primary }}>Choose Your Service</h2>
        <p className="text-xs sm:text-sm font-bold mt-1.5" style={{ color: THEME.gold }}>(သင်ရယူလိုသော ဝန်ဆောင်မှုကို ရွေးချယ်ပါ)</p>
      </div>
      
      <div className="space-y-4">
          {appData.categories.map(category => {
            const CategoryIcon = ICON_MAP[category.id] || Activity;
            const categoryPromoPct =
              activePromoType === 'category_discount' && discountChannelLive && !userPastPromo
                ? getCategoryDiscountPercent((appData.promotion as any)?.categoryDiscounts, category.id, category.title)
                : 0;
            return (
              <div key={category.id} className="bg-white rounded-[1.2rem] shadow-sm border border-gray-100 overflow-hidden">
                <div onClick={() => setActiveCategory(activeCategory === category.id ? null : category.id)} className="p-3.5 sm:p-4 flex items-center justify-between cursor-pointer hover:bg-gray-50 transition">
                  <div className="flex items-center text-sm font-bold gap-2" style={{ color: THEME.primary }}>
                    <CategoryIcon className="w-5 h-5 mr-1 shrink-0" style={{ color: THEME.gold }} />
                    <span>{category.title}</span>
                    {categoryPromoPct > 0 && (
                      <span className="text-[11px] font-extrabold text-emerald-700 tabular-nums">
                        · {categoryPromoPct}% OFF
                      </span>
                    )}
                  </div>
                  {activeCategory === category.id ? <ChevronUp className="w-5 h-5" style={{ color: THEME.primary }} /> : <ChevronDown className="w-5 h-5" style={{ color: THEME.primary }} />}
                </div>
                {activeCategory === category.id && (
                    <div className="p-2 sm:p-4 border-t border-gray-100 bg-gray-50/50 grid grid-cols-2 gap-2 sm:gap-4">
                        {(() => {
                            const groupedItems = category.items.reduce((acc, item) => {
                                const name = (item.name || '').trim();
                                if (!acc[name]) {
                                    acc[name] = {
                                        baseName: name,
                                        description: item.description || '',
                                        imageUrl: item.imageUrl || '',
                                        images: item.images || [], 
                                        variants: []
                                    };
                                }
                                if (!acc[name].imageUrl && item.imageUrl) acc[name].imageUrl = item.imageUrl;
                                if ((!acc[name].images || acc[name].images.length === 0) && item.images && item.images.length > 0) {
                                    acc[name].images = item.images;
                                }
                                if (!acc[name].description && item.description) acc[name].description = item.description;
                                
                                acc[name].variants.push(item);
                                return acc;
                            }, {} as Record<string, { baseName: string, description: string, imageUrl: string, images: string[], variants: MenuItem[] }>);
                            return Object.values(groupedItems).map((group, gIdx) => {
                                const selectedVariant = group.variants.find(v => formData.selectedItem?.id === v.id);
                                const isGroupSelected = !!selectedVariant;
                                const displayVariant = selectedVariant || group.variants[0];

                                return (
                                    <div
                                        key={gIdx}
                                        className={`w-full text-left bg-white border ${
                                            isGroupSelected 
                                                ? 'border-[#123524] shadow-md ring-1 ring-[#123524]/20 scale-[1.01]' 
                                                : 'border-gray-100 shadow-sm hover:border-[#D4AF37]/60 hover:shadow-md'
                                        } rounded-[1rem] transition-all duration-300 flex flex-col relative overflow-hidden group cursor-pointer`}
                                        onClick={() => setFormData({...formData, selectedItem: displayVariant, isVvipUpgrade: false, time: '', therapist2: null })}
                                    >
                                        {isGroupSelected && (
                                            <div className="absolute top-0 right-0 bg-[#123524] text-[#D4AF37] p-1.5 rounded-bl-xl z-20 shadow-sm">
                                                <CheckCircle className="w-3.5 h-3.5" />
                                            </div>
                                        )}

                                        <div className="w-full aspect-square bg-white relative border-b border-gray-100/80 flex items-center justify-center p-1.5 sm:p-2.5">
                                            {(() => {
                                                const displayImgUrl = (group.images && group.images.length > 0) ? group.images[0] : group.imageUrl;
                                                
                                                return displayImgUrl ? (
                                                    <img src={displayImgUrl} alt={group.baseName} className="w-full h-full object-cover rounded-[0.8rem] shadow-sm transition-transform duration-700 group-hover:scale-105" />
                                                ) : (
                                                    <div className="w-full h-full flex flex-col items-center justify-center text-gray-300 bg-gray-50 rounded-[0.8rem]">
                                                        <Sparkles className="w-5 h-5 mb-1 opacity-40 text-[#D4AF37]" />
                                                        <span className="text-[7px] font-bold uppercase tracking-widest opacity-40">Shangri-La</span>
                                                    </div>
                                                );
                                            })()}
                                        </div>

                                        <div className="p-2 sm:p-3 flex flex-col justify-between flex-1">
                                            <div className="mb-2">
                                                <h4 className={`font-bold text-[11.5px] sm:text-xs tracking-wide line-clamp-2 leading-tight ${isGroupSelected ? 'text-[#123524]' : 'text-gray-800'}`}>
                                                    {group.baseName}
                                                </h4>
                                                <div className={`font-black text-[11px] sm:text-sm mt-1 ${isGroupSelected ? 'text-[#123524]' : 'text-[#D4AF37]'}`}>
                                                    {displayVariant.price ? `${displayVariant.price.toLocaleString()} Ks` : ''} 
                                                </div>
                                            </div>

                                            <div className="flex flex-wrap gap-1.5 mt-auto mb-2">
                                                {group.variants.map((v) => {
                                                    const isVariantSelected = formData.selectedItem?.id === v.id;
                                                    return (
                                                        <button 
                                                            key={v.id}
                                                            type="button"
                                                            onClick={(e) => {
                                                                e.stopPropagation(); 
                                                                setFormData({...formData, selectedItem: v, isVvipUpgrade: false, time: '', therapist2: null });
                                                            }}
                                                            className={`flex-1 flex items-center justify-center px-1 py-1.5 rounded-lg border text-[9px] font-bold transition-all ${
                                                                isVariantSelected 
                                                                    ? 'bg-[#123524] text-[#D4AF37] border-[#123524] shadow-sm' 
                                                                    : 'bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100 hover:border-[#D4AF37]/50'
                                                            }`}
                                                        >
                                                            <Clock className={`w-2.5 h-2.5 mr-1 ${isVariantSelected ? 'text-[#D4AF37]' : 'text-gray-400'}`} />
                                                            {v.duration}
                                                        </button>
                                                    );
                                                })}
                                            </div>

                                            <button 
                                                type="button" 
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setViewDesc({ title: group.baseName, desc: group.description });
                                                }}
                                                className="w-full flex items-center justify-center py-1.5 px-2 rounded-lg border border-[#D4AF37]/40 text-[9px] font-bold text-[#123524] bg-yellow-50/50 hover:bg-yellow-100 transition-colors shadow-sm"
                                            >
                                                <Info className="w-3 h-3 mr-1" /> အသေးစိတ်ဖတ်ရန်
                                            </button>
                                        </div>
                                    </div>
                                );
                            });
                        })()}
                    </div>
                )}
              </div>
            );
          })}
      </div>
      
      <div className="bg-yellow-50 rounded-xl p-4 border border-yellow-200 mt-6 flex justify-between items-center shadow-sm mx-1.5 sm:mx-0">
        <div className="flex items-center"><div className="w-10 h-10 bg-yellow-100 rounded-lg flex items-center justify-center mr-4"><Crown className="w-5 h-5" style={{ color: THEME.gold }} /></div><div><div className="font-bold text-yellow-800 text-sm">VVIP Master Room</div><div className="text-xs text-yellow-600 font-semibold mt-1">{formData.selectedItem?.vvipIncluded ? '✅ Included (Free)' : (!formData.selectedItem ? 'Select a service' : (isVipCurrentlyFull ? '🚫 လတ်တလော VIP အခန်းပြည့်နေပါသည်' : (formData.selectedItem.vvipPrice ? 'Upgrade for extra comfort' : 'Not available')))}</div></div></div>
        {formData.selectedItem?.vvipIncluded ? <span className="bg-green-100 text-green-700 px-3 py-1 rounded-full text-xs font-bold border border-green-200">INCLUDED</span> : <input type="checkbox" checked={formData.isVvipUpgrade} disabled={disableVvipToggle} onChange={(e) => setFormData({ ...formData, isVvipUpgrade: e.target.checked, time: '' })} className="w-6 h-6 accent-[#D4AF37] cursor-pointer disabled:opacity-50" />}
      </div>

     <div className="mt-8 flex justify-between gap-4 mx-1.5 sm:mx-0">
        {currentStep > 1 && (
          <button type="button" onClick={() => handleNextStep(currentStep - 1)} className="px-6 py-4 rounded-xl font-bold text-gray-600 bg-white border border-gray-200 hover:bg-gray-50 transition shadow-sm text-xs sm:text-sm tracking-wider">
            BACK
          </button>
        )}
        <button type="button" disabled={!formData.selectedItem} onClick={() => handleNextStep(currentStep + 1)} className="flex-1 py-4 px-4 rounded-xl font-bold text-[#D4AF37] bg-gradient-to-r from-[#123524] to-[#1a4a32] transition disabled:opacity-50 shadow-[0_4px_15px_rgba(18,53,36,0.3)] hover:shadow-[0_6px_20px_rgba(18,53,36,0.4)] flex items-center justify-center text-xs sm:text-sm tracking-widest uppercase whitespace-nowrap">
          {isTherapistFirst && currentStep === 2 ? 'CONTINUE TO DATE & TIME' : 'CONTINUE TO THERAPIST'} <ChevronRight className="w-4 h-4 ml-1.5 flex-shrink-0" />
        </button>
      </div>
      </div> 
    );

 const renderTherapistSelection = (currentStep: number) => {
    const is4Hands = formData.selectedItem?.name?.toLowerCase().includes('4') || formData.selectedItem?.name?.toLowerCase().includes('four');

    return (
    <div className="animate-fade-in px-4 sm:px-0">
      
      {/* 🌟 1. Fullscreen Portal Image Gallery Popup (Modal) အပိုင်း 🌟 */}
      <TherapistPhotoLightbox
        gallery={viewGallery}
        onChangeIndex={(nextIdx) => setViewGallery((prev) => (prev ? { ...prev, index: nextIdx } : null))}
        onClose={() => setViewGallery(null)}
      />

      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold" style={{ color: THEME.primary }}>Choose Your Therapist</h2>
        <p className="text-sm font-bold mt-2" style={{ color: THEME.gold }}>(သင်ဘိုကင်ရယူလိုသော Therapist ကို ရွေးချယ်ပါ)</p>
      </div>
      
     <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
        {appData.therapists
          .filter((t: any) => t.visibilityStatus !== 'hidden' && !t.isHidden)
          .map((therapist: any, idx: number) => {
            const isComingSoon = therapist.visibilityStatus === 'coming_soon' || Boolean(therapist.isComingSoon);
            const comingSoonLabel = therapist.comingSoonText || 'Coming Soon .. Booking လက်မခံသေးပါ';
            const isSelected = !isComingSoon && (formData.therapist?.id === therapist.id || formData.therapist2?.id === therapist.id);

            const handleSelectThisTherapist = () => {
              if (isComingSoon) {
                setAlertMessage(`${therapist.name} — ${comingSoonLabel}`);
                return;
              }
              if (is4Hands) {
                if (formData.therapist?.id === therapist.id) setFormData({...formData, therapist: null});
                else if (formData.therapist2?.id === therapist.id) setFormData({...formData, therapist2: null});
                else if (!formData.therapist) setFormData({...formData, therapist: therapist});
                else if (!formData.therapist2) setFormData({...formData, therapist2: therapist});
              } else {
                setFormData({...formData, therapist: formData.therapist?.id === therapist.id ? null : therapist, therapist2: null});
              }
            };
          
            return (
              <div 
                key={therapist.id || idx} 
                onClick={handleSelectThisTherapist}
                className={`w-full bg-white border ${
                  isComingSoon
                    ? 'border-amber-300 bg-amber-50/20 opacity-95 cursor-not-allowed'
                    : isSelected
                    ? 'border-[#123524] shadow-md ring-1 ring-[#123524]/20 scale-[1.01] cursor-pointer'
                    : 'border-gray-100 shadow-sm hover:border-[#D4AF37]/60 hover:shadow-md cursor-pointer'
                } rounded-[1rem] transition-all duration-300 flex flex-col relative overflow-hidden group`}
              >
                {isSelected && (
                    <div className="absolute top-0 right-0 bg-[#123524] text-[#D4AF37] p-1.5 rounded-bl-xl z-20 shadow-sm">
                        <CheckCircle className="w-3.5 h-3.5" />
                    </div>
                )}

                {isComingSoon && (
                    <div className="absolute top-2 right-2 bg-amber-500 text-white px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-wider z-20 shadow animate-pulse">
                        ⏳ Coming Soon
                    </div>
                )}
                
                <div className="w-full aspect-[3/4] bg-white relative border-b border-gray-100/80 flex items-center justify-center p-1.5 sm:p-2.5">
                  {(therapist.images?.[0] || therapist.imageUrl) ? (
                    <img src={therapist.images?.[0] || therapist.imageUrl} alt={therapist.name} className={`w-full h-full object-cover rounded-[0.8rem] shadow-sm transition-transform duration-700 group-hover:scale-105 ${isComingSoon ? 'grayscale-[25%]' : ''}`} />
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center text-gray-300 bg-gray-50 rounded-[0.8rem]">
                        <User className="w-8 h-8 mb-1 opacity-40 text-[#D4AF37]" />
                        <span className="text-[9px] font-bold uppercase tracking-widest opacity-40">Therapist</span>
                    </div>
                  )}
                  
                  {therapist.images && therapist.images.length > 0 && (
                    <button 
                      type="button"
                      disabled={loadingGalleryId === therapist.id}
                      onClick={(e) => {
                        e.stopPropagation();
                        openGallery(therapist);
                      }}
                      className="absolute bottom-3 left-1/2 -translate-x-1/2 bg-black/60 backdrop-blur-md text-[#D4AF37] px-4 py-1.5 rounded-full text-[9px] sm:text-[10px] font-bold tracking-wider flex items-center shadow-lg border border-[#D4AF37]/40 hover:bg-black/90 hover:-translate-y-0.5 hover:border-[#D4AF37] transition-all duration-300 z-20 whitespace-nowrap disabled:opacity-50"
                    >
                      {loadingGalleryId === therapist.id ? (
                          <span className="animate-pulse flex items-center"><ImageIcon className="w-3 h-3 mr-1 animate-spin"/> Loading...</span>
                      ) : (
                          <><ImageIcon className="w-3.5 h-3.5 mr-1.5"/> နောက်ထပ်ပုံများကြည့်ရန်</>
                      )}
                    </button>
                  )}
                </div>

                <div className="p-2.5 sm:p-3 text-center flex-1 flex flex-col justify-between bg-gray-50/30">
                  <h4 className={`font-bold text-[11px] sm:text-xs mb-1.5 truncate ${isSelected ? 'text-[#123524]' : 'text-gray-800'}`}>{therapist.name}</h4>
                  {isComingSoon ? (
                    <div className="w-full py-2 px-1.5 rounded-lg bg-amber-100 text-amber-900 border border-amber-300 text-[9.5px] font-black leading-tight">
                      {comingSoonLabel}
                    </div>
                  ) : (
                    <button 
                       type="button"
                       onClick={(e) => {
                          e.stopPropagation();
                          if (is4Hands) {
                              if (!formData.therapist) { 
                                  setFormData({...formData, therapist: therapist}); 
                              } else if (!formData.therapist2 && formData.therapist.id !== therapist.id) {
                                  setFormData({...formData, therapist2: therapist});
                                  setTimeout(() => handleNextStep(currentStep + 1), 50);
                              } else {
                                  if (formData.therapist?.id === therapist.id) setFormData({...formData, therapist: null});
                                  if (formData.therapist2?.id === therapist.id) setFormData({...formData, therapist2: null});
                              }
                          } else {
                              setFormData({...formData, therapist: therapist, therapist2: null});
                              setTimeout(() => handleNextStep(currentStep + 1), 50);
                          }
                       }}
                       className="w-full py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center border shadow-sm bg-[#123524] text-[#D4AF37] hover:bg-[#1a4a32] border-[#1a4a32]"
                    >
                       Book Now
                    </button>
                  )}
                </div>
              </div>
            );
          })}
      </div>

     <div className="mt-8 flex justify-between gap-4">
        {currentStep > 1 && (
          <button type="button" onClick={() => handleNextStep(currentStep - 1)} className="px-6 py-4 rounded-xl font-bold text-gray-600 bg-white border border-gray-200 hover:bg-gray-50 transition shadow-sm text-xs sm:text-sm tracking-wider">
            BACK
          </button>
        )}
        <button type="button" disabled={is4Hands ? (!formData.therapist || !formData.therapist2) : !formData.therapist} onClick={() => handleNextStep(currentStep + 1)} className="flex-1 py-4 px-4 rounded-xl font-bold text-[#D4AF37] bg-gradient-to-r from-[#123524] to-[#1a4a32] transition disabled:opacity-50 shadow-[0_4px_15px_rgba(18,53,36,0.3)] hover:shadow-[0_6px_20px_rgba(18,53,36,0.4)] flex items-center justify-center text-xs sm:text-sm tracking-widest uppercase whitespace-nowrap">
          {isTherapistFirst && currentStep === 1 ? 'CONTINUE TO SERVICE' : 'CONTINUE TO DATE & TIME'} <ChevronRight className="w-4 h-4 ml-1.5 flex-shrink-0" />
        </button>
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
          <div className="text-center mb-6 sm:mb-8">
            <h2 className="text-2xl font-bold font-serif tracking-wide" style={{ color: THEME.primary }}>Pick Date & Time</h2>
            <div className="w-12 h-1 bg-[#D4AF37] mx-auto rounded-full my-2"></div>
            <p className="text-xs sm:text-sm font-bold mt-1" style={{ color: THEME.gold }}>(ဘိုကင်ရယူလိုသော နေ့ရက် နှင့် အချိန် ကို ရွေးချယ်ပါ)</p>
          </div>

          <div className="relative bg-white p-5 sm:p-7 rounded-[1.5rem] shadow-[0_8px_30px_rgb(0,0,0,0.06)] border border-[#D4AF37]/25 mb-6 overflow-hidden">
            {/* Subtle Luxury Background Glow */}
            <div className="absolute -top-16 -right-16 w-36 h-36 bg-[#D4AF37] opacity-10 rounded-full blur-3xl pointer-events-none"></div>
            <div className="absolute -bottom-16 -left-16 w-36 h-36 bg-[#123524] opacity-[0.04] rounded-full blur-3xl pointer-events-none"></div>

            {/* 🌟 1. LUXURY 4-DAY DATE SELECTOR CARDS 🌟 */}
            <div className="relative z-10 mb-7">
              <div className="flex items-center justify-between mb-3.5">
                <label className="text-xs sm:text-sm font-extrabold uppercase tracking-wider flex items-center text-[#123524]">
                  <Calendar className="w-4 h-4 mr-2 text-[#D4AF37]" /> Select Date
                </label>
                {formData.date && (
                  <span className="text-[10px] font-bold text-[#123524] bg-yellow-50 px-2.5 py-1 rounded-full border border-[#D4AF37]/40 shadow-sm">
                    {new Date(formData.date + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </span>
                )}
              </div>

              <div className="grid grid-cols-4 gap-2 sm:gap-3">
                {Array.from({ length: 4 }).map((_, idx) => {
                  const d = new Date();
                  d.setDate(d.getDate() + idx);
                  const dStr = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
                  const isSelected = formData.date === dStr;
                  const dayLabel = idx === 0 ? 'Today' : idx === 1 ? 'Tmrw' : d.toLocaleDateString('en-US', { weekday: 'short' });
                  const dateNum = d.getDate();
                  const monthName = d.toLocaleDateString('en-US', { month: 'short' });

                  return (
                    <button
                      key={dStr}
                      type="button"
                      onClick={() => setFormData({ ...formData, date: dStr, time: '' })}
                      className={`relative py-3 px-1.5 rounded-2xl border flex flex-col items-center justify-center transition-all duration-300 outline-none overflow-hidden group ${
                        isSelected
                          ? 'bg-gradient-to-b from-[#123524] to-[#1a4a32] text-white border-[#D4AF37] shadow-[0_6px_15px_rgba(18,53,36,0.25)] scale-[1.03] ring-1 ring-[#D4AF37]'
                          : 'bg-gray-50/80 text-gray-600 border-gray-200/80 hover:border-[#D4AF37]/60 hover:bg-yellow-50/30'
                      }`}
                    >
                      {isSelected && (
                        <div className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-[#D4AF37] animate-pulse"></div>
                      )}
                      <span className={`text-[9px] sm:text-[10px] font-extrabold uppercase tracking-wider mb-0.5 ${isSelected ? 'text-[#D4AF37]' : 'text-gray-400 group-hover:text-[#123524]'}`}>
                        {dayLabel}
                      </span>
                      <span className={`text-xl sm:text-2xl font-black leading-tight my-0.5 ${isSelected ? 'text-white drop-shadow-sm' : 'text-[#123524]'}`}>
                        {dateNum}
                      </span>
                      <span className={`text-[9px] sm:text-[10px] font-bold uppercase tracking-widest ${isSelected ? 'text-gray-300' : 'text-gray-400'}`}>
                        {monthName}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="border-t border-gray-100 my-5"></div>

            {/* 🌟 2. PREMIUM TIME SLOTS SECTION 🌟 */}
            {staffClockIn && formData.date === todayStr ? (
                <div className="relative z-10 bg-gradient-to-br from-yellow-50 to-amber-50/50 p-5 rounded-2xl border border-[#D4AF37]/40 mb-2 animate-fade-in shadow-inner">
                    <label className="block mb-2.5 text-xs sm:text-sm font-extrabold flex items-center justify-center text-[#123524] uppercase tracking-wider">
                      <Clock className="w-4 h-4 mr-2 text-[#D4AF37]" /> Service Start Time (ဧည့်သည်ရောက်ရှိချိန်)
                    </label>
                    <input type="time" value={formData.time} onChange={(e) => setFormData({...formData, time: e.target.value})} className="w-full max-w-full box-border p-3.5 border-2 border-[#D4AF37]/50 rounded-xl focus:outline-none focus:border-[#123524] text-[#123524] bg-white mb-2 font-black text-center tracking-widest text-lg shadow-sm" />
                    <p className="text-[10px] text-yellow-800 font-semibold text-center mt-1">အမှန်တကယ် စတင်သည့်အချိန်ကို ပြင်ဆင်ရွေးချယ်နိုင်ပါသည်။</p>
                </div>
            ) : (
                <div className="relative z-10">
                    <div className="flex items-center justify-between mb-4">
                      <label className="text-xs sm:text-sm font-extrabold uppercase tracking-wider flex items-center text-[#123524]">
                        <Clock className="w-4 h-4 mr-2 text-[#D4AF37]" /> Available Times
                      </label>
                      <div className="flex items-center gap-2.5 text-[9px] font-bold text-gray-400">
                        <span className="flex items-center"><span className="w-2 h-2 rounded-full bg-[#123524] mr-1"></span> Selected</span>
                        <span className="flex items-center"><span className="w-2 h-2 rounded-full bg-gray-200 mr-1"></span> Booked</span>
                      </div>
                    </div>

                    {!formData.date ? (
                      <div className="bg-gray-50/80 border border-dashed border-gray-200 rounded-2xl p-8 text-center animate-fade-in">
                        <Calendar className="w-8 h-8 text-[#D4AF37] mx-auto mb-2 opacity-60 animate-bounce" />
                        <p className="text-xs font-bold text-gray-500">အချိန်ဇယားများ ကြည့်ရှုရန် အပေါ်တွင် နေ့ရက်အရင် ရွေးချယ်ပေးပါခင်ဗျာ။</p>
                      </div>
                    ) : (
                      <div className={`grid gap-2.5 sm:gap-3 ${availableTimeSlots.length <= 2 ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-3 sm:grid-cols-4'}`}>
                          {availableTimeSlots.map(t => {
                              const state = checkSlotState(t);
                              const displayTime = t.includes("to") ? t.split(" to ")[0].trim() : t;
                              const isTimeSelected = formData.time === t || formData.time.startsWith(`${displayTime} to`);

                              return (
                                  <button
                                     key={t}
                                     type="button"
                                     disabled={!formData.date}
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
                                     className={`relative py-3 px-2 rounded-xl text-xs sm:text-sm font-bold border transition-all duration-200 flex items-center justify-center ${
                                       isTimeSelected
                                         ? 'bg-gradient-to-r from-[#123524] to-[#1a4a32] text-[#D4AF37] border-[#D4AF37] shadow-[0_4px_12px_rgba(18,53,36,0.25)] scale-[1.03]'
                                         : !state.available
                                         ? 'border-gray-100 bg-gray-100/70 text-gray-400 opacity-50 line-through cursor-not-allowed'
                                         : 'border-gray-200/90 bg-white text-gray-700 hover:border-[#D4AF37] hover:bg-yellow-50/40 hover:text-[#123524] shadow-sm'
                                     }`}
                                  >
                                     {displayTime}
                                     {isTimeSelected && (
                                       <CheckCircle className="w-3 h-3 text-[#D4AF37] absolute top-1 right-1" />
                                     )}
                                  </button>
                              );
                          })}
                      </div>
                    )}

                    {formData.time && currentFixedDetails && (
                        <div className="mt-5 p-4 bg-gradient-to-br from-green-50 to-emerald-50/60 border border-green-200 rounded-2xl shadow-sm animate-fade-in text-center">
                            <p className="text-xs sm:text-sm text-[#123524] font-extrabold mb-1 flex items-center justify-center"><Clock className="w-4 h-4 mr-1.5 text-[#D4AF37]" /> ဝန်ဆောင်မှု ရရှိမည့် အချိန်</p>
                            <p className="text-base sm:text-lg text-green-800 font-black tracking-wide">{formData.time.split(' to ')[0].trim()} မှ {currentFixedDetails.end}{currentFixedDetails.nextDay ? ' (နောက်ရက်)' : ''} အထိ</p>
                            <p className="text-xs text-green-700 font-bold mt-1">(စုစုပေါင်း ကြာချိန် - {calculateTimeDiff(formData.time.split(' to ')[0].trim(), currentFixedDetails.end, currentFixedDetails.nextDay)})</p>
                            <p className="text-[10px] text-green-700/80 mt-2 border-t border-green-200/60 pt-2 font-semibold">* အချိန်ကျော်လွန်ပြီးမှ ဘိုကင်ယူပါက ပြီးဆုံးမည့်အချိန်ထိသာ ဝန်ဆောင်မှုရရှိပါမည်။</p>
                        </div>
                    )}
                    {!currentFixedDetails && isSelectedNightService && (
                      <div className="mt-5 p-3.5 bg-blue-50/90 border border-blue-200 rounded-xl text-blue-900 text-[11px] sm:text-xs font-bold text-center flex items-center justify-center animate-fade-in shadow-sm">
                        <Clock className="w-4 h-4 mr-2 text-blue-600 flex-shrink-0"/> ဝန်ဆောင်မှုသည် နောက်ရက် မနက် ၈:၀၀ နာရီတွင် ပြီးဆုံးပါမည်။
                      </div>
                    )}
                </div>
            )}
            {availableTimeSlots.length === 0 && formData.date && !(staffClockIn && formData.date === todayStr) && (
              <div className="mt-4 p-4 bg-red-50 border border-red-100 rounded-xl text-center">
                <p className="text-xs sm:text-sm font-bold text-red-600">ရွေးချယ်ထားသော နေ့ရက်အတွက် အချိန်ရွေးချယ်၍ မရနိုင်တော့ပါ။ အခြားနေ့ရက်ကို ရွေးချယ်ကြည့်ပါ။</p>
              </div>
            )}
          </div>

          <div className="mt-8 flex justify-between gap-4">
            <button type="button" onClick={() => handleNextStep(2)} className="px-6 py-4 rounded-xl font-bold text-gray-600 bg-white border border-gray-200 hover:bg-gray-50 transition shadow-sm text-xs sm:text-sm tracking-wider">
              BACK
            </button>
            <button type="button" disabled={!formData.date || !formData.time.trim()} onClick={() => handleNextStep(4)} className="flex-1 py-4 rounded-xl font-bold text-[#D4AF37] bg-gradient-to-r from-[#123524] to-[#1a4a32] transition disabled:opacity-50 shadow-[0_4px_15px_rgba(18,53,36,0.3)] hover:shadow-[0_6px_20px_rgba(18,53,36,0.4)] flex items-center justify-center text-xs sm:text-sm tracking-widest uppercase">
              CONTINUE <ChevronRight className="w-4 h-4 ml-1.5" />
            </button>
          </div>
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

          {/* 🌟 Payment Design အသစ် နှင့် OTP-Style TxID 🌟 */}
          <div className="bg-white p-4 sm:p-6 rounded-2xl shadow-sm border border-gray-100 mb-6">
            <h3 className="text-sm font-bold tracking-widest uppercase mb-5 flex items-center" style={{ color: THEME.primary }}><CreditCard className="w-4 h-4 mr-2" style={{ color: THEME.primary }} /> Deposit Payment</h3>
            {isStaffMode ? (
              <div className="bg-green-50 p-5 rounded-xl border border-green-200 text-center shadow-sm">
                  <span className="font-bold text-green-800 text-lg flex justify-center items-center"><CheckCircle className="w-5 h-5 mr-2"/> Cash Payment in Shop</span>
                  <p className="text-xs font-semibold text-green-600 mt-2">{staffClockIn && formData.date === todayStr ? '"Confirm and Start Now" နှိပ်သည်နှင့် ဝန်ဆောင်မှုကို စတင်ပါမည်။' : 'ဤဘိုကင်ကို စနစ်မှ အလိုအလျောက် အတည်ပြု (Approve) ပါမည်။'}</p>
              </div>
            ) : (
              <>
                <div className="relative mb-5">
                  <label className="block mb-2.5 text-[11px] sm:text-xs font-bold text-gray-500 uppercase tracking-wider">ငွေလွှဲမည့် စနစ် ရွေးချယ်ရန်</label>
                  <div onClick={() => setPaymentDropdownOpen(!paymentDropdownOpen)} className="w-full p-4 bg-[#123524] rounded-xl cursor-pointer flex justify-between items-center shadow-md border border-[#1a4a32] hover:bg-[#153e2a] transition-colors">
                    {selectedPaymentConfig ? (<div className="flex items-center font-bold text-[#D4AF37]">{selectedPaymentConfig.logoUrl && <img src={selectedPaymentConfig.logoUrl} alt="" loading="lazy" className="w-6 h-6 mr-3 object-contain bg-white rounded p-0.5" />}{selectedPaymentConfig.name}</div>) : (<span className="font-bold text-[#D4AF37]">-- ရွေးချယ်ပါ --</span>)}
                    <ChevronDown className="w-5 h-5 text-[#D4AF37]" />
                  </div>
                  {paymentDropdownOpen && (
                    <><div className="fixed inset-0 z-40" onClick={() => setPaymentDropdownOpen(false)}></div>
                      <div className="absolute z-50 w-full mt-2 bg-[#123524] rounded-xl shadow-2xl overflow-hidden border border-[#D4AF37]/30">
                        {safePaymentMethods.map(pm => (<div key={pm.id} className="p-4 flex items-center cursor-pointer hover:bg-[#1a4a32] border-b border-[#1a4a32] transition-colors" onClick={() => { setFormData({ ...formData, paymentMethod: pm.name }); setPaymentDropdownOpen(false); }}>{pm.logoUrl && <img src={pm.logoUrl} alt="" loading="lazy" className="w-7 h-7 mr-3 object-contain bg-white rounded p-1" />}<span className="font-bold text-[#D4AF37] text-base">{pm.name}</span></div>))}
                      </div></>
                  )}
                </div>
                
                {selectedPaymentConfig && (
                  <div className="relative overflow-hidden bg-gradient-to-br from-[#123524] to-[#1a4a32] p-5 sm:p-6 rounded-2xl shadow-lg border border-[#D4AF37]/30 text-white mb-6 animate-fade-in">
                      <div className="absolute -top-10 -right-10 w-32 h-32 bg-[#D4AF37] opacity-10 rounded-full blur-3xl pointer-events-none"></div>
                      <div className="absolute -bottom-10 -left-10 w-32 h-32 bg-[#D4AF37] opacity-10 rounded-full blur-3xl pointer-events-none"></div>
                      
                      <div className="relative z-10">
                          <p className="text-[11px] sm:text-xs text-gray-300 mb-5 leading-relaxed bg-black/20 p-3.5 rounded-xl border border-white/5">
                              Booking အတည်ပြုနိုင်ရန် <strong className="text-[#D4AF37] font-bold text-sm tracking-wide">ကျသင့်ငွေ၏ တစ်ဝက် ({formatPrice(calculateTotal() / 2)})</strong> စရံငွေအား {selectedPaymentConfig.name} သို့ လွှဲပေးပါ။
                          </p>
                          
                          <div className="space-y-3 sm:space-y-4">
                              <div className="flex justify-between items-center bg-black/30 p-3.5 sm:p-4 rounded-xl border border-white/10 shadow-inner">
                                  <div>
                                      <div className="text-[9px] text-[#D4AF37]/80 uppercase tracking-widest mb-1.5 font-bold">Account Number</div>
                                      <div className="text-lg sm:text-xl font-mono font-bold tracking-widest text-[#D4AF37]">{selectedPaymentConfig.accountNumber}</div>
                                  </div>
                                  <button type="button" onClick={() => handleCopy(selectedPaymentConfig.accountNumber)} className="bg-[#D4AF37] hover:bg-yellow-500 text-[#123524] px-4 py-2.5 rounded-lg text-[10px] font-bold flex items-center transition shadow-sm border border-[#D4AF37] active:scale-95"><Copy className="w-3.5 h-3.5 sm:mr-1.5"/><span className="hidden sm:inline">COPY</span></button>
                              </div>
                              
                              <div className="flex justify-between items-center bg-black/30 p-3.5 sm:p-4 rounded-xl border border-white/10 shadow-inner">
                                  <div>
                                      <div className="text-[9px] text-gray-400 uppercase tracking-widest mb-1.5 font-bold">Account Name</div>
                                      <div className="text-sm font-bold text-white tracking-wide">{selectedPaymentConfig.accountName}</div>
                                  </div>
                                  <button type="button" onClick={() => handleCopy(selectedPaymentConfig.accountName)} className="bg-white/10 hover:bg-white/20 text-white px-4 py-2.5 rounded-lg text-[10px] font-bold flex items-center transition border border-white/20 active:scale-95"><Copy className="w-3.5 h-3.5 sm:mr-1.5"/><span className="hidden sm:inline">COPY</span></button>
                              </div>
                          </div>
                      </div>
                  </div>
                )}
                
                {selectedPaymentConfig && (
                  <div className="text-center mb-6 p-4 rounded-xl bg-red-50 border border-red-100 animate-fade-in shadow-sm">
                      <p className="text-[10px] sm:text-xs text-red-600 font-bold uppercase tracking-wider mb-1 flex items-center justify-center"><Clock className="w-3.5 h-3.5 mr-1.5" /> စရံငွေလွှဲရန် ကျန်သောအချိန်</p>
                      <div className="text-2xl sm:text-3xl font-mono font-black text-red-600">{formattedCountdown}</div>
                  </div>
                )}
                
                <div className="mt-2 mb-2 bg-gray-50/50 p-4 sm:p-6 rounded-2xl border border-gray-100">
                    <label className="block mb-4 text-xs sm:text-sm font-bold text-center tracking-widest uppercase flex flex-col items-center gap-1" style={{ color: THEME.gold }}>
                        <span>ငွေလွှဲ Transaction ID ထည့်သွင်းရန်</span>
                        <span className="text-[9px] sm:text-[10px] text-gray-400 lowercase font-semibold tracking-normal">(နောက်ဆုံး ၆ လုံး)</span>
                    </label>
                    <div className="flex justify-center gap-2 sm:gap-3" dir="ltr">
                        {Array.from({ length: 6 }).map((_, idx) => {
                            const val = (formData.txId || '').split('')[idx] || '';
                            return (
                                <input
                                    key={idx}
                                    id={`txId-${idx}`}
                                    type="tel"
                                    inputMode="numeric"
                                    pattern="[0-9]*"
                                    autoComplete="one-time-code"
                                    maxLength={1}
                                    value={val.trim()}
                                    onChange={(e) => {
                                        const inputVal = e.target.value.replace(/[^0-9]/g, '').slice(-1);
                                        let str = formData.txId || '';
                                        str = str.padEnd(6, ' ');
                                        const newStr = str.substring(0, idx) + (inputVal || ' ') + str.substring(idx + 1);
                                        setFormData({ ...formData, txId: newStr.trimEnd() });
                                        
                                        if (inputVal && idx < 5) {
                                            document.getElementById(`txId-${idx + 1}`)?.focus();
                                        }
                                    }}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Backspace' && !val.trim() && idx > 0) {
                                            document.getElementById(`txId-${idx - 1}`)?.focus();
                                        }
                                    }}
                                    onClick={() => {
                                        const currentLength = (formData.txId || '').trim().length;
                                        if (idx > currentLength && currentLength < 6) {
                                            document.getElementById(`txId-${currentLength}`)?.focus();
                                        }
                                    }}
                                    className={`w-10 h-12 sm:w-12 sm:h-14 bg-white border-2 rounded-xl text-center text-lg sm:text-xl font-black text-[#123524] shadow-sm transition-all uppercase outline-none
                                        ${val.trim() ? 'border-[#D4AF37] ring-2 ring-[#D4AF37]/20' : 'border-gray-200 focus:border-[#123524]'}
                                    `}
                                />
                            );
                        })}
                    </div>
                </div>
              </>
            )}
          </div>

          <div className="mt-8 flex justify-between gap-4">
            <button type="button" onClick={() => handleNextStep(3)} className="px-6 py-4 rounded-xl font-bold text-gray-600 bg-white border border-gray-200 hover:bg-gray-50 transition shadow-sm text-xs sm:text-sm tracking-wider">
              BACK
            </button>
            <button disabled={loading || (!isStaffMode && !formData.paymentMethod) || (!isStaffMode && (formData.txId || '').trim().length !== 6)} type="submit" className="flex-1 py-4 px-4 rounded-xl font-bold text-[#D4AF37] bg-gradient-to-r from-[#123524] to-[#1a4a32] transition disabled:opacity-50 shadow-[0_4px_15px_rgba(18,53,36,0.3)] hover:shadow-[0_6px_20px_rgba(18,53,36,0.4)] flex items-center justify-center text-xs sm:text-sm tracking-widest uppercase whitespace-nowrap">
              {loading ? 'PROCESSING...' : (staffClockIn && formData.date === todayStr ? 'CONFIRM & START NOW' : 'CONFIRM BOOKING')} <ChevronRight className="w-4 h-4 ml-1.5 flex-shrink-0" />
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

// 🌟 THE COMPONENT THAT RENDERS THE TABS AND MAIN VIEW 🌟
// ==========================================
// CUSTOMER APP WIDGET (TABS & NAVIGATION)
// ==========================================
export default function CustomerApp({ appData }: { appData: AppData }) {
   const { appData: globalAppData } = useAppStore(); // 🌟 Context မှ Data ကို ယူသုံးခြင်း

   // 🌟 ၁။ State များကို ရှေ့ဆုံးတွင် အရင်ဆုံး ကြေညာပါ 🌟
   const [userPhone, setUserPhone] = useState(localStorage.getItem('shangrila_user_phone') || '');
   const [tgUser, setTgUser] = useState<{ chatId: string; firstName: string; username?: string } | null>(null);
   const [hasNoti, setHasNoti] = useState(false);
   const [prefillTherapist, setPrefillTherapist] = useState<TherapistProfile | null>(null);
   const prevStatuses = useRef<Record<string, string>>({});
   const isFirstLoad = useRef(true);

   // 🌟 ၂။ Merged AppData တွက်ချက်ခြင်း 🌟
   const mergedAppData = { 
        ...appData,
        ...globalAppData,
        vipSettings: globalAppData?.vipSettings || appData.vipSettings || FALLBACK_VIP_SETTINGS,
        therapists: Array.from(new Map((globalAppData?.therapists?.length ? globalAppData.therapists : (appData.therapists || [])).map(t => [t.name, t])).values()),
        categories: globalAppData?.categories?.length ? globalAppData.categories : (appData.categories || [])
   };

   // 🌟 ၃။ ULTRA-STRICT CAMPAIGN & URL LINK GUARD 🌟
   const [showCampaign, setShowCampaign] = useState(() => {
        const searchParams = new URLSearchParams(window.location.search);
        const modeParam = searchParams.get('mode');
        const campaignParam = searchParams.get('campaign');
        const hasCampaignIntent = modeParam === 'campaign' || campaignParam === 'true' || campaignParam || searchParams.has('campaign');
        
        if (!hasCampaignIntent) return false;

        const promo: any = mergedAppData.promotion;
        const todayNow = getLocalTodayStr();
        const withinDate = (!promo?.startDate || todayNow >= promo.startDate) && (!promo?.endDate || todayNow <= promo.endDate);
        const isPromoLive = Boolean(
          resolvePromotionType(promo) === 'mini_game' &&
          (promo?.isPopupActive || promo?.isBoxActive) &&
          promo?.allOff !== true &&
          withinDate
        );

        if (!isPromoLive) {
            window.history.replaceState({}, document.title, window.location.pathname);
            return false;
        }

        return true;
   });

   // 🌟 ၄။ Telegram Mini App & userPhone ကို သုံးသော useEffect များကို အောက်တွင် ဆက်ထည့်ပါ 🌟
   useEffect(() => {
     fetchBotUsername().catch(() => {});
        import('../telegramService').then(async (tgService) => {
            // 1. Mini App မှ ဝင်လာလျှင် Auto-subscribe လုပ်မည်
            const detectedChatId = await tgService.autoSubscribeFromTelegramWebApp();
            const webAppUser = tgService.getDetectedTelegramWebAppUser();
            if (webAppUser) {
                setTgUser({
                    chatId: webAppUser.chatId,
                    firstName: webAppUser.firstName || 'Telegram User',
                    username: webAppUser.username
                });
            }
            if (detectedChatId && !userPhone) {
                const cachedPhone = localStorage.getItem('shangrila_user_phone');
                if (cachedPhone) {
                    setUserPhone(cachedPhone);
                }
            }
        }).catch(() => {});
   }, [userPhone]);

   // Real-time effect to guard against any lingering state or manual URL tampering
   useEffect(() => {
        const searchParams = new URLSearchParams(window.location.search);
        const modeParam = searchParams.get('mode');
        const campaignParam = searchParams.get('campaign');
        const hasCampaignIntent = modeParam === 'campaign' || campaignParam === 'true' || campaignParam || searchParams.has('campaign');

        if (!hasCampaignIntent) return;

        const promo: any = mergedAppData.promotion;
        const todayNow = getLocalTodayStr();
        const withinDate = (!promo?.startDate || todayNow >= promo.startDate) && (!promo?.endDate || todayNow <= promo.endDate);
        const isPromoLive = Boolean(
          resolvePromotionType(promo) === 'mini_game' &&
          (promo?.isPopupActive || promo?.isBoxActive) &&
          promo?.allOff !== true &&
          withinDate
        );

        if (!isPromoLive && showCampaign) {
            setShowCampaign(false);
            window.history.replaceState({}, document.title, window.location.pathname);
        }
   }, [mergedAppData.promotion, showCampaign]);

   const [activeTab, setActiveTab] = useState<'book' | 'therapists' | 'dashboard' | 'history' | 'profile' | 'vip'>(() => {
        const searchParams = new URLSearchParams(window.location.search);
        const view = searchParams.get('view') || searchParams.get('tab');

        if (view === 'therapists') return 'therapists';
        if (view === 'dashboard' || view === 'available') return 'dashboard';
        if (view === 'vip') return 'vip';
        if (view === 'profile') return 'profile';
        if (view === 'history') return 'history';
        if (view === 'booking') return 'book';
        return 'book';
   });

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
         playCustomerChime();
       }
       isFirstLoad.current = false;
     });
     return () => unsubscribe();
   }, [userPhone, activeTab]);

   useEffect(() => { if (activeTab === 'history') setHasNoti(false); }, [activeTab]);

   const handleInteraction = () => {
     unlockAudioContext();
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
     <div className="w-full relative" onClick={handleInteraction}>

       {/* 🌟 ညာဘက်အောက်နားတွင် အမြဲပေါ်နေမည့် Floating Telegram Direct Link Button (100% Mobile & iOS PWA Ready) 🌟 */}
       <div
         className="fixed right-5 z-[999] flex items-center gap-2"
         style={{ bottom: 'calc(1.25rem + env(safe-area-inset-bottom))' }}
       >
           {tgUser ? (
               <div className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full bg-[#123524] text-[#D4AF37] border border-[#D4AF37]/40 text-xs font-bold shadow-2xl animate-fade-in backdrop-blur-md">
                   <span className="w-2.5 h-2.5 rounded-full bg-green-400 animate-pulse"></span>
                   <span>Telegram Connected</span>
               </div>
           ) : (
               <a
                   href={getInstantTelegramLink(userPhone).httpsUrl}
                   target="_blank"
                   rel="noopener noreferrer"
                   onClick={(e) => {
                       e.preventDefault();
                       openTelegramBotInstantly(userPhone);
                   }}
                   className="flex items-center gap-2 pl-3.5 pr-1.5 py-1.5 rounded-full bg-[#123524]/95 border border-[#D4AF37]/50 shadow-[0_8px_25px_rgba(0,0,0,0.35)] active:scale-95 transition-transform duration-150 cursor-pointer no-underline"
                   style={{ WebkitTapHighlightColor: 'transparent' }}
               >
                   <span className="text-[#D4AF37] text-[11px] font-bold whitespace-nowrap">
                       Telegram ချိတ်ဆက်ရန် ✈️
                   </span>
                   <span className="flex items-center justify-center w-11 h-11 rounded-full bg-gradient-to-r from-[#0088cc] to-[#00a2ff] text-white shadow-md border border-white/80">
                       <svg className="w-6 h-6 fill-current drop-shadow-sm" viewBox="0 0 24 24">
                           <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-.99-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69.01-.03.01-.14-.07-.2-.08-.06-.19-.04-.27 0-.12.07-2.01 1.28-5.69 3.77-.54.37-1.03.55-1.47.54-.48-.01-1.4-.27-2.08-.49-.84-.27-1.51-.42-1.45-.89.03-.25.38-.51 1.07-.78 4.18-1.82 6.98-3.02 8.39-3.61 4-.1.66 4.83.65 4.98z"/>
                       </svg>
                   </span>
               </a>
           )}
       </div>

       {/* 🌟 ULTRA-COMPACT LUXURY GLASS STICKY TAB BAR 🌟 */}
       <div 
         className="sticky z-[90] w-full bg-white/70 backdrop-blur-2xl shadow-[0_4px_15px_rgba(0,0,0,0.03)] border-b border-white/40 transition-all duration-300 pt-1 pb-1 mb-4 rounded-b-[1rem]"
         style={{ top: 'calc(53px + env(safe-area-inset-top))' }}
       >
          <div className="max-w-4xl mx-auto flex flex-col items-center">
              
              {/* Swipe Indicator (Compact & Animated) */}
              <div className="w-full max-w-[95vw] flex sm:hidden justify-end mb-0.5 pr-1.5">
                  <span className="text-[8px] text-[#123524] font-black flex items-center bg-white/80 px-2 py-0.5 rounded-full border border-[#123524]/10 shadow-sm tracking-widest animate-pulse">
                      ဘေးသို့ဆွဲကြည့်ပါ <ChevronRight className="w-2.5 h-2.5 ml-0.5 text-[#123524]" /><ChevronRight className="w-2.5 h-2.5 -ml-1.5 text-[#123524]" />
                  </span>
              </div>

              {/* Compact Glass Container */}
              <div className="w-full px-1.5">
                  <div className="w-full bg-white/50 backdrop-blur-xl border border-white/80 shadow-[inset_0_0_5px_rgba(0,0,0,0.02)] p-0.5 rounded-xl">
                      
                      {/* 🌟 SCROLLABLE TRACK 🌟 */}
                      <div className="w-full overflow-x-auto scrollbar-hide rounded-lg" style={{ touchAction: 'pan-x' }}>
                          <div className="flex sm:flex-wrap sm:justify-center items-center gap-1 w-max sm:w-full mx-auto">
                            {tabs.map((tab) => {
                              const isActive = activeTab === tab.id;
                              return (
                                <button 
                                  key={tab.id} 
                                  onClick={() => { setPrefillTherapist(null); setActiveTab(tab.id as any); }}
                                  className={`relative flex-shrink-0 flex flex-col items-center justify-center py-1.5 px-2.5 sm:py-2 sm:px-4 min-w-[65px] sm:min-[80px] rounded-lg text-[9px] sm:text-[10px] font-bold transition-all duration-300 ease-out outline-none group ${
                                    isActive 
                                      ? 'bg-white text-[#123524] shadow-[0_2px_5px_rgba(0,0,0,0.05)] border border-gray-100 transform scale-[1.02]' 
                                      : 'text-gray-500 hover:text-[#123524] hover:bg-white/60 border border-transparent'
                                  }`}
                                >
                                  <tab.icon className={`flex-shrink-0 w-4 h-4 sm:w-4 sm:h-4 mb-1 transition-all duration-300 ${isActive ? 'text-[#D4AF37] scale-110 drop-shadow-sm' : 'text-gray-400 group-hover:text-gray-600'} ${tab.id === 'vip' && isActive ? 'animate-pulse' : ''}`} />
                                  
                                  <span className={`whitespace-nowrap tracking-wide leading-none ${isActive ? 'text-[#123524]' : ''}`}>{tab.label}</span>
                                  
                                  {/* Notification Dots */}
                                  {tab.id === 'history' && hasNoti && (
                                    <>
                                      <span className="absolute top-1 right-1 w-1.5 h-1.5 bg-red-500 rounded-full shadow-md animate-ping"></span>
                                      <span className="absolute top-1 right-1 w-1.5 h-1.5 bg-red-500 rounded-full shadow-md"></span>
                                    </>
                                  )}
                                </button>
                              )
                            })}
                          </div>
                      </div>

                  </div>
              </div>

          </div>
       </div>
       
       {/* 🌟 Main Content Area */}
       <div className="max-w-2xl mx-auto px-4 sm:px-0">
            {/* 📢 Special Announcement Banner (If enabled in Admin Operations) */}
            {(mergedAppData as any)?.spaOperations?.isAnnouncementActive && (mergedAppData as any)?.spaOperations?.announcementBanner && (
                <div className="mb-5 p-3.5 rounded-2xl bg-gradient-to-r from-[#123524] via-[#1a4a32] to-[#123524] text-[#D4AF37] border border-[#D4AF37]/40 shadow-md flex items-center gap-3 animate-fade-in">
                    <Sparkles className="w-5 h-5 flex-shrink-0 animate-pulse" />
                    <div className="text-xs font-bold leading-relaxed text-white">
                        {(mergedAppData as any).spaOperations.announcementBanner}
                    </div>
                </div>
            )}

            {showCampaign ? (
                <div className="fixed inset-0 z-[100] bg-black">
                    <ThadingyutCampaign appData={mergedAppData} />
                    <button 
                        onClick={() => {
                            setShowCampaign(false);
                            window.history.pushState({}, '', '/');
                        }}
                        className="absolute top-4 right-4 z-[200] text-white bg-black/50 p-2 rounded-full hover:bg-black/80"
                    >
                        <X className="w-6 h-6"/>
                    </button>
                </div>
            ) : (
                <>
                    {/* 🌐 Check if Online Booking is Paused by Admin */}
                    {(activeTab === 'book' || activeTab === 'therapists') && (mergedAppData as any)?.spaOperations?.isOnlineBookingOpen === false ? (
                        <div className="bg-white p-8 rounded-3xl shadow-md border-2 border-[#D4AF37]/40 text-center space-y-4 my-6 animate-fade-in">
                            <div className="w-16 h-16 rounded-full bg-amber-50 border border-[#D4AF37] mx-auto flex items-center justify-center text-[#123524]">
                                <Clock className="w-8 h-8 text-[#D4AF37]" />
                            </div>
                            <h3 className="text-xl font-black text-[#123524]">
                                {(mergedAppData as any)?.spaOperations?.maintenanceTitle || 'Online Booking ခေတ္တပိတ်ထားပါသည်'}
                            </h3>
                            <p className="text-xs sm:text-sm text-gray-600 font-semibold leading-relaxed max-w-md mx-auto">
                                {(mergedAppData as any)?.spaOperations?.maintenanceMessage || 'လက်ရှိတွင် ဆိုင်ဝန်ဆောင်မှု အချိန်ဇယားများ ပြည့်နေပါသဖြင့် Online Booking ခေတ္တပိတ်ထားပါသည်ခင်ဗျာ။'}
                            </p>
                            <div className="pt-2 flex flex-wrap justify-center gap-3">
                                {mergedAppData?.branding?.phone1 && (
                                    <a href={`tel:${mergedAppData.branding.phone1}`} className="px-5 py-2.5 rounded-xl bg-[#123524] text-[#D4AF37] text-xs font-black flex items-center gap-1.5 shadow">
                                        <Phone className="w-4 h-4" /> ဖုန်းဖြင့် ဆက်သွယ်ရန် ({mergedAppData.branding.phone1})
                                    </a>
                                )}
                                <button
                                    type="button"
                                    onClick={() => setActiveTab('dashboard')}
                                    className="px-5 py-2.5 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-black"
                                >
                                    ဝန်ထမ်းအချိန်ဇယား ကြည့်ရန်
                                </button>
                            </div>
                        </div>
                    ) : (
                        <>
                            {activeTab === 'book' && <CustomerBookingWizard appData={mergedAppData} userPhone={userPhone} onBooked={(phone) => { setUserPhone(phone); localStorage.setItem('shangrila_user_phone', phone); setActiveTab('history'); }} />}
                            {activeTab === 'therapists' && <CustomerBookingWizard key={prefillTherapist ? prefillTherapist.id : 'default'} appData={mergedAppData} userPhone={userPhone} forceTherapistFirst={true} initialTherapist={prefillTherapist} onBooked={(phone) => { setUserPhone(phone); localStorage.setItem('shangrila_user_phone', phone); setActiveTab('history'); setPrefillTherapist(null); }} />}
                        </>
                    )}
                    {activeTab === 'dashboard' && <CustomerDashboard appData={mergedAppData} onBookTherapist={handleDashboardBook} />}
                    {activeTab === 'history' && <CustomerHistory userPhone={userPhone} onLoginSuccess={(phone) => { setUserPhone(phone); localStorage.setItem('shangrila_user_phone', phone); }} />}
                    {activeTab === 'profile' && <CustomerProfile appData={mergedAppData} userPhone={userPhone} onLoginSuccess={(phone) => { setUserPhone(phone); localStorage.setItem('shangrila_user_phone', phone); }} onLogout={() => { setUserPhone(''); localStorage.removeItem('shangrila_user_phone'); setActiveTab('book'); }} />}
                    {activeTab === 'vip' && <VipProgramView appData={mergedAppData} onGoToProfile={() => setActiveTab('profile')} />}
                </>
            )}
       </div>
     </div>
   );
}
