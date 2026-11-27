import React, { useState, useEffect, useRef } from 'react';
import {
  Send,
  Bell,
  Settings,
  Users,
  CheckCircle2,
  XCircle,
  RefreshCw,
  ShieldAlert,
  Sparkles,
  Copy,
  Radio,
  History,
  Save,
  Eye,
  EyeOff,
  Megaphone,
  UserPlus,
  Smartphone,
  Image as ImageIcon,
  Check,
  UserX,
  Search,
  Phone,
  CalendarPlus,
  Clock,
  MapPin,
  Wallet,
  Tag,
  Layers,
  Edit3,
  Lock,
  Trash2,
  RotateCcw,
} from 'lucide-react';
import {
  collection,
  doc,
  query,
  orderBy,
  limit,
  onSnapshot,
  getDocs,
   getDoc,
  setDoc,
  addDoc,
} from 'firebase/firestore';
import { db } from '../firebase';
import { decryptText } from '../security';
import * as SharedModule from '../shared';
import {
  TelegramBotConfig,
  StaffTelegramMapping,
  CustomerTelegramSubscriber,
  DEFAULT_TELEGRAM_CONFIG,
  getTelegramConfig,
  saveTelegramConfig,
  patchTelegramConfig,
  sendRawTelegramMessage,
  notifyBookingEvent,
  notifyStaffUpdate,
  fetchRecentBotChats,
  syncBotCommandsAndMenu,
  DiscoveredTelegramChat,
  getCustomerTelegramSubscribers,
  saveCustomerTelegramSubscription,
  removeCustomerTelegramSubscriber,
  sendBulkCustomerBroadcast,
  sendInteractiveMiniAppMenu,
} from '../telegramService';

// 🌟 Helper: Extract Staff Number 🌟
const extractStaffNumber = (str: string): number | null => {
  if (!str) return null;
  const m = String(str).match(/(?:no\.?|therapist|#|\b)\s*-?\s*(\d+)/i);
  if (m) return parseInt(m[1], 10);
  const numOnly = String(str).trim().match(/^(\d+)$/);
  return numOnly ? parseInt(numOnly[1], 10) : null;
};

const safeDecrypt = (val: any): string => {
  if (!val || typeof val !== 'string') return String(val || '');
  try {
    return decryptText(val) || val;
  } catch {
    return val;
  }
};

// 🌟 Menu Item Interface (Synced 100% with CustomerApp & shared.ts) 🌟
export interface ManualMenuServiceItem {
  id: string;
  name: string;
  category: string;
  duration: number;
  price: number;
}

// Duration String ("90 mins", "2 hrs") မှ မိနစ်ထုတ်ယူသည့် Helper
const parseDurationToMinutes = (dur?: string | number): number => {
  if (typeof dur === 'number' && dur > 0) return dur;
  if (!dur) return 60;
  const lower = String(dur).toLowerCase();
  if (lower.includes('half') || lower.includes('6 hr')) return 360;
  if (lower.includes('night') || lower.includes('12 hr')) return 720;
  const num = parseInt(lower.replace(/[^0-9]/g, ''), 10);
  if (lower.includes('hr') || lower.includes('hour')) return (num || 1) * 60;
  return num || 60;
};

// Normalize any raw service array into clean CustomerApp Menu Items
const normalizeServiceArray = (rawList: any[]): ManualMenuServiceItem[] => {
  if (!Array.isArray(rawList)) return [];
  const items: ManualMenuServiceItem[] = [];
  const seen = new Set<string>();

  rawList.forEach((raw, idx) => {
    if (!raw || typeof raw !== 'object') return;
    const name = String(raw.name || raw.title || raw.serviceName || '').trim();
    const price = Number(raw.price ?? raw.amount ?? raw.cost ?? 0);
    if (!name || price <= 0) return;
    if (name.toLowerCase().includes('test service')) return;
    if (raw.active === false || raw.isDeleted === true || raw.disabled === true) return;

    const key = `${name.toLowerCase()}_${price}`;
    if (seen.has(key)) return;
    seen.add(key);

    items.push({
      id: String(raw.id || `svc-${idx}-${price}`),
      name,
      category: String(raw.category || raw.type || raw.group || 'Retreat Services').trim(),
      duration: parseDurationToMinutes(raw.duration || raw.time || 60),
      price,
    });
  });

  return items;
};

// 🌟 Discover Official Services from `src/shared.ts` exports automatically 🌟
const getSharedModuleServices = (): ManualMenuServiceItem[] => {
  try {
    const mod = SharedModule as Record<string, any>;
    for (const exportKey of Object.keys(mod)) {
      const val = mod[exportKey];
      if (Array.isArray(val) && val.length > 0 && typeof val[0] === 'object') {
        const first = val[0];
        if (('name' in first || 'title' in first) && ('price' in first || 'amount' in first)) {
          const normalized = normalizeServiceArray(val);
          if (normalized.length > 0) return normalized;
        }
      }
    }
  } catch {
    // ignore
  }
  return [];
};

// 🌟 Standard Time Slots (Customer App Format) 🌟
const MANUAL_TIME_SLOTS = [
  '10:00 AM', '11:00 AM', '12:00 PM', '01:00 PM', '02:00 PM',
  '03:00 PM', '04:00 PM', '05:00 PM', '06:00 PM', '07:00 PM',
  '08:00 PM', '09:00 PM', '10:00 PM', '11:00 PM', '12:00 AM',
];

const PAYMENT_METHODS = [
  'KBZPay',
  'WavePay',
  'AYA Pay',
  'CB Pay',
  'Bank Transfer (ဘဏ်လွှဲ)',
  'Cash (ဆိုင်ရောက်မှရှင်း / လက်ငင်း)',
];

// Time String ("02:30 PM") ကို မိနစ်အဖြစ် ပြောင်းလဲသည့် Helper
const parseTimeToMinutes = (timeStr: string): number => {
  if (!timeStr) return -1;
  const match = String(timeStr).trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i);
  if (!match) return -1;
  let hours = parseInt(match[1], 10);
  const minutes = parseInt(match[2], 10);
  const period = match[3]?.toUpperCase();
  if (period === 'PM' && hours < 12) hours += 12;
  if (period === 'AM' && hours === 12) hours = 0;
  return hours * 60 + minutes;
};

// 🌟 Format Timestamp for Customer Delivery Badge 🌟
const formatLogTimeShort = (ts: any): string => {
  if (!ts) return '';
  try {
    const d = typeof ts?.toDate === 'function' ? ts.toDate() : new Date(ts);
    if (isNaN(d.getTime())) return '';
    const now = new Date();
    const isToday =
      d.getDate() === now.getDate() &&
      d.getMonth() === now.getMonth() &&
      d.getFullYear() === now.getFullYear();
    const timePart = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    if (isToday) return `Today, ${timePart}`;
    const datePart = d.toLocaleDateString([], { month: 'short', day: 'numeric' });
    return `${datePart}, ${timePart}`;
  } catch {
    return '';
  }
};

// ============================================================================
// 🌟 MULTI-ROUTE RESILIENT TELEGRAM SENDER (FIXES "Failed to fetch" ERROR) 🌟
// ============================================================================
const sendResilientTelegramMessage = async (
  botToken: string,
  chatId: string,
  htmlText: string,
  eventType: string = 'MANUAL_BOOKING_CONFIRMED'
): Promise<{ ok: boolean; error?: string }> => {
  const cleanToken = String(botToken || '').trim();
  const cleanChatId = String(chatId || '').trim();
  if (!cleanToken || !cleanChatId) {
    return { ok: false, error: 'Bot Token သို့မဟုတ် Chat ID မပြည့်စုံပါ။' };
  }

  try {
    const primaryRes = await sendRawTelegramMessage(cleanToken, cleanChatId, htmlText, undefined, eventType);
    if (primaryRes && primaryRes.ok) {
      return { ok: true };
    }
    if (primaryRes?.error && !String(primaryRes.error).toLowerCase().includes('failed to fetch')) {
      return { ok: false, error: primaryRes.error };
    }
  } catch {
    // fallback
  }

  const tgGetUrl = `https://api.telegram.org/bot${cleanToken}/sendMessage?chat_id=${encodeURIComponent(
    cleanChatId
  )}&parse_mode=HTML&disable_web_page_preview=true&text=${encodeURIComponent(htmlText)}`;

  try {
    const res2 = await fetch(tgGetUrl, { method: 'GET' });
    const data2 = await res2.json();
    if (data2 && data2.ok) {
      await addDoc(collection(db, 'telegramLogs'), {
        timestamp: new Date().toISOString(),
        type: eventType,
        targetChatId: cleanChatId,
        status: 'SUCCESS',
        summary: htmlText.slice(0, 180),
      }).catch(() => {});
      return { ok: true };
    }
    if (data2?.description) {
      return { ok: false, error: data2.description };
    }
  } catch {
    // fallback
  }

  try {
    const proxyUrl = `https://corsproxy.io/?${encodeURIComponent(tgGetUrl)}`;
    const res3 = await fetch(proxyUrl, { method: 'GET' });
    const data3 = await res3.json();
    if (data3 && data3.ok) {
      await addDoc(collection(db, 'telegramLogs'), {
        timestamp: new Date().toISOString(),
        type: eventType,
        targetChatId: cleanChatId,
        status: 'SUCCESS',
        summary: htmlText.slice(0, 180),
      }).catch(() => {});
      return { ok: true };
    }
    if (data3?.description) {
      return { ok: false, error: data3.description };
    }
  } catch {
    // fallback
  }

  try {
    await fetch(tgGetUrl, { method: 'GET', mode: 'no-cors' });
    await addDoc(collection(db, 'telegramLogs'), {
      timestamp: new Date().toISOString(),
      type: eventType,
      targetChatId: cleanChatId,
      status: 'SUCCESS',
      summary: htmlText.slice(0, 180),
    }).catch(() => {});
    return { ok: true };
  } catch (finalErr: any) {
    const errMsg = finalErr?.message || 'Network Connection Blocked';
    await addDoc(collection(db, 'telegramLogs'), {
      timestamp: new Date().toISOString(),
      type: eventType,
      targetChatId: cleanChatId,
      status: 'FAILED',
      errorDetail: errMsg,
      summary: htmlText.slice(0, 140),
    }).catch(() => {});
    return { ok: false, error: errMsg };
  }
};

type ButtonFeedbackState = 'idle' | 'loading' | 'success' | 'error';

export const TelegramNotificationCenter: React.FC = () => {
  const [config, setConfig] = useState<TelegramBotConfig>(DEFAULT_TELEGRAM_CONFIG);
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<
    'setup' | 'triggers' | 'staff' | 'customers' | 'botflow' | 'logs'
  >('customers');
  const [showToken, setShowToken] = useState<boolean>(false);
  const [statusBanner, setStatusBanner] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // ============================================================================
  // 🌟 CLEAN READ-ONLY CARD VIEW vs EDIT MODE TOGGLE STATES (UI/UX UPGRADE) 🌟
  // ============================================================================
  const [editSections, setEditSections] = useState<Record<string, boolean>>({
    botSetup: false,
    discoveredChats: false,
    customerTriggers: false,
    staffTriggers: false,
    addSubscriberForm: false,
    promoComposer: false,
    welcomeConfig: false,
    staffBroadcast: false,
  });
  const [editingStaffRowId, setEditingStaffRowId] = useState<string | null>(null);
  const [editingCustomerRowId, setEditingCustomerRowId] = useState<string | null>(null);

  const toggleSectionEdit = (sectionKey: string) => {
    setEditSections((prev) => ({ ...prev, [sectionKey]: !prev[sectionKey] }));
  };

  // 🌟 Individual Button Tactile & Visual Feedback Map 🌟
  const [btnStates, setBtnStates] = useState<Record<string, ButtonFeedbackState>>({});
  const setButtonFeedback = (key: string, state: ButtonFeedbackState, resetMs: number = 2200) => {
    setBtnStates((prev) => ({ ...prev, [key]: state }));
    if (state === 'success' || state === 'error') {
      setTimeout(() => {
        setBtnStates((prev) => ({ ...prev, [key]: 'idle' }));
      }, resetMs);
    }
  };

  const [staffHrMeta, setStaffHrMeta] = useState<Record<string, { actualName?: string; position?: string }>>({});
  const hrStaffNamesRef = useRef<string[]>([]);

  // Chat Discovery State
  const [scanningChats, setScanningChats] = useState<boolean>(false);
  const [discoveredChats, setDiscoveredChats] = useState<DiscoveredTelegramChat[]>([]);

  // Customer Subscribers State
  const [subscribers, setSubscribers] = useState<CustomerTelegramSubscriber[]>([]);
  const [selectedSubIds, setSelectedSubIds] = useState<string[]>([]);
  const [customerSearch, setCustomerSearch] = useState<string>('');
  const [editingPhones, setEditingPhones] = useState<Record<string, string>>({});

  const [manualSubName, setManualSubName] = useState<string>('');
  const [manualSubPhone, setManualSubPhone] = useState<string>('');
  const [manualSubChatId, setManualSubChatId] = useState<string>('');
  const [manualSubVip, setManualSubVip] = useState<string>('Member');

  // Staff Broadcast State
  const [broadcastTitle, setBroadcastTitle] = useState<string>('📢 ရုံးတွင်း အရေးကြီး အသိပေးချက်');
  const [broadcastBody, setBroadcastBody] = useState<string>('');
  const [broadcastTarget] = useState<'ALL' | 'ADMIN' | 'STAFF_GROUP'>('ALL');
  const [sendingBroadcast, setSendingBroadcast] = useState<boolean>(false);

  // Customer Promotion & Instant Push Broadcast State
  const [promoTitle, setPromoTitle] = useState<string>('✨ THE SHANGRI-LA EXCLUSIVE PROMOTION');
  const [promoMessage, setPromoMessage] = useState<string>('');
  const [promoImageUrl, setPromoImageUrl] = useState<string>('');
  const [promoAudience, setPromoAudience] = useState<'ALL' | 'VIP_ONLY' | 'SELECTED'>('ALL');
  const [promoButtonText, setPromoButtonText] = useState<string>('📅 ယခုပဲ ဘိုကင်တင်ရန် (Book Now)');
  const [promoButtonTab, setPromoButtonTab] = useState<'booking' | 'therapists' | 'available' | 'history' | 'vip'>('booking');
  const [sendingPromo, setSendingPromo] = useState<boolean>(false);
  const [promoProgress, setPromoProgress] = useState<{ sent: number; total: number } | null>(null);

  // Logs State
  const [logs, setLogs] = useState<any[]>([]);

  // ============================================================================
  // 🌟 CUSTOMER APP LIVE MENU, CONFLICT OVERRIDE & EDIT EXISTING BOOKING STATES 🌟
  // ============================================================================
  const [liveBookings, setLiveBookings] = useState<any[]>([]);
  const [catalogServices, setCatalogServices] = useState<ManualMenuServiceItem[]>(() => getSharedModuleServices());
  const [therapistStatuses, setTherapistStatuses] = useState<Record<string, string>>({});

  const [manualBookingTarget, setManualBookingTarget] = useState<CustomerTelegramSubscriber | null>(null);
  // If editing an existing booking on a booked slot, store its ID here so that slot is unlocked & updated in-place!
  const [editingBookingId, setEditingBookingId] = useState<string | null>(null);

  const [mbPhone, setMbPhone] = useState<string>('');
  const [mbSelectedCategory, setMbSelectedCategory] = useState<string>('ALL');
  const [mbSelectedServiceIds, setMbSelectedServiceIds] = useState<string[]>([]);
  const [mbCustomServiceName, setMbCustomServiceName] = useState<string>('');
  const [mbStaffId, setMbStaffId] = useState<string>('No. 1');
  const [mbDate, setMbDate] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [mbTime, setMbTime] = useState<string>('');
  const [mbBookingType, setMbBookingType] = useState<'in_spa' | 'outcall_hotel' | 'outcall_home' | 'half_day' | 'night_call'>('in_spa');
  const [mbRoomOrLocation, setMbRoomOrLocation] = useState<string>('VIP Private Suite');

  // Pricing & Discount States
  const [mbSubtotalPrice, setMbSubtotalPrice] = useState<number>(0);
  const [mbApplyDiscount, setMbApplyDiscount] = useState<boolean>(false);
  const [mbDiscountMode, setMbDiscountMode] = useState<'PERCENT' | 'FIXED'>('PERCENT');
  const [mbDiscountValue, setMbDiscountValue] = useState<number>(10);
  const [mbDiscountReason, setMbDiscountReason] = useState<string>('VIP / Promo Discount');

  // Payment & Deposit States
  const [mbPaymentMethod, setMbPaymentMethod] = useState<string>('KBZPay');
  const [mbDepositAmount, setMbDepositAmount] = useState<number>(0);
  const [mbPaymentRef, setMbPaymentRef] = useState<string>('');
  const [mbNotes, setMbNotes] = useState<string>('');
  const [isSubmittingManualBooking, setIsSubmittingManualBooking] = useState<boolean>(false);

  const showToast = (type: 'success' | 'error', text: string) => {
    setStatusBanner({ type, text });
    setTimeout(() => setStatusBanner(null), 5000);
  };

  // 🌟 Build Per-ChatId Latest Notification Status Map from Real-Time Logs 🌟
  const latestNotiByChatId = React.useMemo(() => {
    const map: Record<string, any> = {};
    for (const log of logs) {
      const cid = String(log.targetChatId || '').trim();
      if (!cid) continue;
      if (!map[cid]) {
        map[cid] = log;
      }
    }
    return map;
  }, [logs]);

  // ============================================================================
  // 🌟 EXACT CUSTOMER APP MENU LOADER (NO FAKE FALLBACK MIXING) 🌟
  // ============================================================================
  const syncExactCustomerAppMenu = async () => {
    try {
      // 1. Check Firestore `services` collection (Primary source for CustomerApp & System Settings)
      const svcSnap = await getDocs(collection(db, 'services'));
      const firestoreServices: any[] = [];
      svcSnap.forEach((d) => firestoreServices.push({ id: d.id, ...d.data() }));
      const normalizedFirestore = normalizeServiceArray(firestoreServices);
      if (normalizedFirestore.length > 0) {
        setCatalogServices(normalizedFirestore);
        return;
      }

      // 2. Check Firestore `settings` documents (in case menu is saved inside settings/systemSettings or settings/menu)
      for (const docName of ['systemSettings', 'menu', 'appData', 'general']) {
        const settingDoc = await getDoc(doc(db, 'settings', docName)).catch(() => null);
        if (settingDoc && settingDoc.exists()) {
          const data = settingDoc.data();
          const candidateArr = data?.services || data?.menuItems || data?.serviceMenu || data?.packages;
          const normalizedSetting = normalizeServiceArray(candidateArr);
          if (normalizedSetting.length > 0) {
            setCatalogServices(normalizedSetting);
            return;
          }
        }
      }

      // 3. Check localStorage keys used by CustomerApp / AppDataContext
      for (const lsKey of [
        'shangrila_services',
        'services',
        'shangrila_menu',
        'shangrila_app_data',
        'appData',
      ]) {
        const raw = localStorage.getItem(lsKey);
        if (!raw) continue;
        const parsed = JSON.parse(raw);
        const list = Array.isArray(parsed) ? parsed : parsed?.services || parsed?.menuItems;
        const normalizedLocal = normalizeServiceArray(list);
        if (normalizedLocal.length > 0) {
          setCatalogServices(normalizedLocal);
          return;
        }
      }

      // 4. Fallback to `src/shared.ts` exported service list
      const sharedServices = getSharedModuleServices();
      if (sharedServices.length > 0) {
        setCatalogServices(sharedServices);
      }
    } catch (err) {
      console.warn('Menu sync warning:', err);
    }
  };

  // 🌟 STABLE SUBSCRIBER LOADER 🌟
  const loadSubscribers = async () => {
    const list = await getCustomerTelegramSubscribers(hrStaffNamesRef.current);
    setSubscribers((prev) => {
      const prevSig = JSON.stringify(
        prev.map((s) => `${s.chatId}:${s.customerName}:${s.customerPhone}:${s.vipTier}:${s.subscribed}`)
      );
      const nextSig = JSON.stringify(
        list.map((s) => `${s.chatId}:${s.customerName}:${s.customerPhone}:${s.vipTier}:${s.subscribed}`)
      );
      if (prevSig === nextSig) return prev;
      return list;
    });
    return list;
  };

  // 🌟 STRICT SYNC: HR Management ၏ Active Staff List နှင့် အတိအကျ ချိန်ညှိခြင်း 🌟
  const syncWithActiveStaffList = async (loadedConfig: TelegramBotConfig) => {
    try {
      const [therapistsSnap, onboardingSnap] = await Promise.all([
        getDocs(collection(db, 'therapists')),
        getDocs(collection(db, 'onboarding_requests')),
      ]);

      const hrByNum = new Map<number, { actualName: string; position: string; therapistName: string; status: string }>();
      const hrResignedNums = new Set<number>();
      const allDetectedStaffNames: string[] = [];
      const statusMap: Record<string, string> = {};

      onboardingSnap.forEach((d) => {
        const raw = d.data();
        const status = String(raw.status || '').toLowerCase();
        const tName = safeDecrypt(raw.therapistName || raw.assignedName || raw.name || '');
        const fullName = safeDecrypt(raw.fullName || raw.actualName || raw.name || '');
        const position = safeDecrypt(raw.position || raw.jobPosition || '');
        const num = extractStaffNumber(tName) ?? extractStaffNumber(raw.staffId || '');

        if (fullName) allDetectedStaffNames.push(fullName);

        if (status === 'resigned' || status === 'terminated' || status === 'rejected' || raw.isResigned === true) {
          if (num !== null) hrResignedNums.add(num);
          return;
        }

        if (status === 'approved' || status === 'active') {
          if (num !== null) {
            hrByNum.set(num, {
              actualName: fullName,
              position,
              therapistName: tName || `Therapist No-${num}`,
              status,
            });
          }
        }
      });

      const activeStaffItems: {
        num: number | null;
        staffId: string;
        staffName: string;
        actualName?: string;
        position?: string;
        order: number;
      }[] = [];
      const seenNums = new Set<number>();

      therapistsSnap.forEach((d) => {
        const raw = d.data();
        const rawName = String(raw.name || '').trim();
        if (!rawName) return;

        const status = String(raw.status || 'active').toLowerCase();
        if (status === 'resigned' || status === 'inactive' || raw.isResigned === true || raw.active === false) {
          return;
        }

        const num = extractStaffNumber(rawName) ?? extractStaffNumber(d.id);
        if (num === null || num > 50 || hrResignedNums.has(num) || seenNums.has(num)) {
          return;
        }
        seenNums.add(num);

        const staffKey = `No. ${num}`;
        statusMap[staffKey] = String(raw.availability || raw.currentStatus || raw.status || 'available').toLowerCase();

        const hrInfo = hrByNum.get(num);
        const actualName = safeDecrypt(raw.actualName || raw.fullName || '') || hrInfo?.actualName || '';
        const position = safeDecrypt(raw.position || '') || hrInfo?.position || '';

        if (actualName) allDetectedStaffNames.push(actualName);

        activeStaffItems.push({
          num,
          staffId: staffKey,
          staffName: rawName,
          actualName,
          position,
          order: num,
        });
      });

      hrByNum.forEach((hrVal, num) => {
        if (num <= 50 && !seenNums.has(num) && !hrResignedNums.has(num)) {
          seenNums.add(num);
          const staffKey = `No. ${num}`;
          statusMap[staffKey] = 'available';
          activeStaffItems.push({
            num,
            staffId: staffKey,
            staffName: hrVal.therapistName || `Therapist No-${num}`,
            actualName: hrVal.actualName,
            position: hrVal.position,
            order: num,
          });
        }
      });

      setTherapistStatuses(statusMap);
      activeStaffItems.sort((a, b) => a.order - b.order);

      const finalStaffList =
        activeStaffItems.length > 0
          ? activeStaffItems
          : [
              { num: 1, staffId: 'No. 1', staffName: 'Therapist No-1', actualName: 'Htet Wai', position: 'Professional Therapist', order: 1 },
              { num: 3, staffId: 'No. 3', staffName: 'Therapist No-3', actualName: 'Nay Myo Maung', position: 'Junior Therapist', order: 3 },
              { num: 5, staffId: 'No. 5', staffName: 'Therapist No-5', actualName: 'Min Myat Aung', position: 'Professional Therapist', order: 5 },
              { num: 6, staffId: 'No. 6', staffName: 'Therapist No-6', actualName: 'Naing Win Aung', position: 'Professional Therapist', order: 6 },
              { num: 10, staffId: 'No. 10', staffName: 'Therapist No-10', actualName: 'Sai Win Thant Htoo', position: 'Junior Therapist', order: 10 },
            ];

      finalStaffList.forEach((s) => {
        if (s.actualName) allDetectedStaffNames.push(s.actualName);
      });
      hrStaffNamesRef.current = Array.from(new Set(allDetectedStaffNames.filter(Boolean)));

      const existingMappings = loadedConfig.staffMappings || [];
      const metaMap: Record<string, { actualName?: string; position?: string }> = {};

      const syncedMappings: StaffTelegramMapping[] = finalStaffList.map((activeItem) => {
        const matchedExisting = existingMappings.find((m) => {
          const mNum = extractStaffNumber(m.staffId) ?? extractStaffNumber(m.staffName);
          return activeItem.num === mNum;
        });

        metaMap[activeItem.staffId] = {
          actualName: activeItem.actualName,
          position: activeItem.position,
        };

        return {
          staffId: activeItem.staffId,
          staffName: activeItem.staffName,
          telegramChatId: matchedExisting?.telegramChatId || '',
          receiveBookingAssign: matchedExisting?.receiveBookingAssign ?? true,
          receiveRosterUpdate: matchedExisting?.receiveRosterUpdate ?? true,
          receivePenaltyAlert: matchedExisting?.receivePenaltyAlert ?? true,
          receivePayrollAlert: matchedExisting?.receivePayrollAlert ?? true,
        };
      });

      setStaffHrMeta(metaMap);
      const updatedConfig = {
        ...loadedConfig,
        staffMappings: syncedMappings,
      };

      await saveTelegramConfig(updatedConfig);
      setConfig(updatedConfig);
      return updatedConfig;
    } catch (err) {
      console.error('Error syncing Active Staff List with Telegram:', err);
      setConfig(loadedConfig);
      return loadedConfig;
    }
  };

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      const loaded = await getTelegramConfig();
      const syncedCfg = await syncWithActiveStaffList(loaded);

      if (syncedCfg.botToken) {
        const scanRes = await fetchRecentBotChats(syncedCfg.botToken, true);
        if (scanRes.ok && scanRes.chats.length > 0) {
          setDiscoveredChats(scanRes.chats);
        }
        const latestCfg = await getTelegramConfig();
        setConfig(latestCfg);
      }

      await syncExactCustomerAppMenu();
      await loadSubscribers();
      setLoading(false);
    };
    loadData();

    // Real-time listener on `services` so any price/menu change in System Settings reflects immediately
    const unsubServices = onSnapshot(
      collection(db, 'services'),
      (snap) => {
        const rawList: any[] = [];
        snap.forEach((d) => rawList.push({ id: d.id, ...d.data() }));
        const normalized = normalizeServiceArray(rawList);
        if (normalized.length > 0) {
          setCatalogServices(normalized);
        }
      },
      () => {}
    );

    const unsubSubscribers = onSnapshot(
      collection(db, 'telegramSubscribers'),
      () => {
        loadSubscribers();
      },
      () => {}
    );

    const unsubConfigDoc = onSnapshot(
      doc(db, 'settings', 'telegramConfig'),
      () => {
        loadSubscribers();
      },
      () => {}
    );

    const unsubBookings = onSnapshot(
      collection(db, 'bookings'),
      (snap) => {
        const bList = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        setLiveBookings(bList);
      },
      () => {}
    );

    const q = query(collection(db, 'telegramLogs'), orderBy('timestamp', 'desc'), limit(200));
    const unsubLogs = onSnapshot(
      q,
      (snap) => {
        setLogs(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      },
      (err) => console.warn('Telegram logs listener error:', err)
    );

    return () => {
      unsubServices();
      unsubSubscribers();
      unsubConfigDoc();
      unsubBookings();
      unsubLogs();
    };
  }, []);

  // Background Auto-Polling (Every 30s)
  useEffect(() => {
    if (!config.botToken || !config.enabled) return;
    const interval = setInterval(async () => {
      await fetchRecentBotChats(config.botToken, true).catch(() => {});
      await loadSubscribers();
    }, 30000);
    return () => clearInterval(interval);
  }, [config.botToken, config.enabled]);

  // ============================================================================
  // 🌟 REAL-TIME STAFF TIME-SLOT CONFLICT CHECKER + EDIT EXISTING BOOKING 🌟
  // ============================================================================

  const getAllCombinedBookings = (): any[] => {
    const allBookings = [...liveBookings];
    try {
      const localRaw = localStorage.getItem('shangrila_bookings') || localStorage.getItem('bookings');
      if (localRaw) {
        const parsed = JSON.parse(localRaw);
        if (Array.isArray(parsed)) {
          const existingIds = new Set(allBookings.map((b) => String(b.id)));
          parsed.forEach((lb) => {
            if (lb && lb.id && !existingIds.has(String(lb.id))) {
              allBookings.push(lb);
            }
          });
        }
      }
    } catch {
      // ignore
    }
    return allBookings;
  };

  const checkStaffSlotConflict = (
    staffId: string,
    dateStr: string,
    candidateTime: string,
    candidateDurationMins: number,
    ignoreBookingId?: string | null
  ): { isBooked: boolean; conflictDetail?: string; conflictingBooking?: any } => {
    if (!staffId || !dateStr || !candidateTime) return { isBooked: false };

    const targetStaffNum = extractStaffNumber(staffId);
    const candStart = parseTimeToMinutes(candidateTime);
    if (candStart < 0) return { isBooked: false };
    const candEnd = candStart + candidateDurationMins;

    const allBookings = getAllCombinedBookings();

    for (const b of allBookings) {
      // 🌟 CRITICAL FIX FOR QUESTION 2: If we are editing this exact booking, do NOT block its own time slot! 🌟
      if (ignoreBookingId && String(b.id || b.bookingId) === String(ignoreBookingId)) {
        continue;
      }

      const status = String(b.status || '').toLowerCase();
      if (status === 'cancelled' || status === 'rejected' || status === 'completed') continue;

      const bDate = String(b.date || b.bookingDate || '').trim();
      if (bDate !== dateStr) continue;

      const bStaffNum =
        extractStaffNumber(b.therapistId || '') ??
        extractStaffNumber(b.staffId || '') ??
        extractStaffNumber(b.therapistName || '') ??
        extractStaffNumber(b.staffName || '');

      const isSameStaff =
        (targetStaffNum !== null && bStaffNum !== null && targetStaffNum === bStaffNum) ||
        String(b.therapistId || b.staffId || '').trim().toLowerCase() === staffId.trim().toLowerCase();

      if (!isSameStaff) continue;

      const bType = String(b.bookingType || b.serviceName || '').toLowerCase();
      if (bType.includes('night') && candStart >= 19 * 60) {
        return {
          isBooked: true,
          conflictDetail: `Night Call (${b.customerName || 'Booked'})`,
          conflictingBooking: b,
        };
      }

      const existStart = parseTimeToMinutes(b.time || b.bookingTime || '');
      if (existStart < 0) continue;

      const existDuration = parseDurationToMinutes(b.duration || 60);
      const outcallBuffer = b.isOutcall || bType.includes('outcall') || bType.includes('hotel') ? 30 : 0;
      const existEnd = existStart + existDuration + outcallBuffer;

      if (candStart < existEnd && existStart < candEnd) {
        return {
          isBooked: true,
          conflictDetail: `${b.time || ''} • ${b.customerName || 'Booked'}`,
          conflictingBooking: b,
        };
      }
    }

    return { isBooked: false };
  };

  // Load an existing booking into the Modal so Admin can edit details, keep the same time slot, and resend Bot Noti!
  const handleLoadExistingBookingForEdit = (b: any) => {
    if (!b) return;
    const bId = String(b.id || b.bookingId || '');
    setEditingBookingId(bId);
    setMbPhone(String(b.customerPhone || b.phone || ''));
    setMbStaffId(String(b.therapistId || b.staffId || 'No. 1'));
    setMbDate(String(b.date || b.bookingDate || new Date().toISOString().split('T')[0]));
    setMbTime(String(b.time || b.bookingTime || ''));
    setMbBookingType((b.bookingType as any) || 'in_spa');
    setMbRoomOrLocation(String(b.roomName || b.address || 'VIP Private Suite'));

    if (Array.isArray(b.serviceIds) && b.serviceIds.length > 0) {
      setMbSelectedServiceIds(b.serviceIds);
      setMbCustomServiceName('');
    } else {
      // Match by name or put in custom name
      const matched = catalogServices.find(
        (s) => s.name.toLowerCase() === String(b.serviceName || '').toLowerCase()
      );
      if (matched) {
        setMbSelectedServiceIds([matched.id]);
        setMbCustomServiceName('');
      } else {
        setMbSelectedServiceIds([]);
        setMbCustomServiceName(String(b.serviceName || ''));
      }
    }

    setMbSubtotalPrice(Number(b.subtotalPrice ?? b.price ?? b.totalAmount ?? 45000));
    setMbApplyDiscount(Boolean(b.discountApplied));
    setMbDiscountMode(b.discountMode === 'FIXED' ? 'FIXED' : 'PERCENT');
    setMbDiscountValue(Number(b.discountValue || 10));
    setMbDiscountReason(String(b.discountReason || 'VIP / Promo Discount'));
    setMbPaymentMethod(String(b.paymentMethod || 'KBZPay'));
    setMbDepositAmount(Number(b.depositAmount ?? b.advancePaid ?? 0));
    setMbPaymentRef(String(b.paymentReference || ''));
    showToast(
      'success',
      `✏️ Booking #${bId} (${b.time}) ကို ပြန်လည်ပြင်ဆင်ရန် ဆွဲတင်ပြီးပါပြီ။ အချက်အလက်ပြင်ပြီး Resend နှိပ်နိုင်ပါသည်။`
    );
  };

  // Release / Cancel a conflicting booking slot directly if needed
  const handleReleaseBookedSlot = async (b: any) => {
    if (!b || !b.id) return;
    const confirmCancel = window.confirm(
      `Booking #${b.id} (${b.customerName} • ${b.date} ${b.time}) ကို ပယ်ဖျက်ပြီး ဤအချိန် (Time Slot) ကို ပြန်ဖွင့်ပေးမည်မှာ သေချာပါသလား?`
    );
    if (!confirmCancel) return;

    try {
      await setDoc(
        doc(db, 'bookings', String(b.id)),
        { status: 'cancelled', updatedAt: new Date().toISOString() },
        { merge: true }
      );
      if (editingBookingId === String(b.id)) {
        setEditingBookingId(null);
      }
      showToast('success', `✅ Booking #${b.id} ကို ပယ်ဖျက်ပြီး ${b.time} Time Slot ကို ပြန်ဖွင့်ပေးလိုက်ပါပြီ။`);
    } catch (err: any) {
      showToast('error', `❌ Slot ပြန်ဖွင့်ရာတွင် အမှားရှိပါသည်: ${err?.message}`);
    }
  };

  // Toggle service selection in Customer App style menu
  const handleToggleMenuService = (svc: ManualMenuServiceItem) => {
    setMbSelectedServiceIds((prev) => {
      const exists = prev.includes(svc.id);
      const next = exists ? prev.filter((id) => id !== svc.id) : [...prev, svc.id];
      const finalIds = next.length > 0 ? next : [svc.id];

      const sumPrice = finalIds.reduce((acc, id) => {
        const found = catalogServices.find((item) => item.id === id);
        return acc + (found ? Number(found.price || 0) : 0);
      }, 0);
      setMbSubtotalPrice(sumPrice);
      return finalIds;
    });
  };

  const handleOpenManualBookingModal = (sub: CustomerTelegramSubscriber) => {
    setManualBookingTarget(sub);
    setEditingBookingId(null);

    const cleanPhone =
      sub.customerPhone && !sub.customerPhone.includes('xxxx') ? sub.customerPhone.trim() : '';
    setMbPhone(cleanPhone);

    const firstSvc = catalogServices[0];
    setMbSelectedCategory('ALL');
    setMbSelectedServiceIds(firstSvc ? [firstSvc.id] : []);
    setMbCustomServiceName('');
    setMbSubtotalPrice(firstSvc ? Number(firstSvc.price || 0) : 0);

    // Auto-detect if subscriber has VIP tier for discount preset
    const tierStr = String(sub.vipTier || '').toLowerCase();
    if (tierStr.includes('20%')) {
      setMbApplyDiscount(true);
      setMbDiscountMode('PERCENT');
      setMbDiscountValue(20);
      setMbDiscountReason('V-VIP 20% Member Discount');
    } else if (tierStr.includes('15%')) {
      setMbApplyDiscount(true);
      setMbDiscountMode('PERCENT');
      setMbDiscountValue(15);
      setMbDiscountReason('VIP 15% Member Discount');
    } else if (tierStr.includes('10%')) {
      setMbApplyDiscount(true);
      setMbDiscountMode('PERCENT');
      setMbDiscountValue(10);
      setMbDiscountReason('VIP 10% Member Discount');
    } else {
      setMbApplyDiscount(false);
      setMbDiscountMode('PERCENT');
      setMbDiscountValue(10);
      setMbDiscountReason('Promo / Special Discount');
    }

    const firstStaff = config.staffMappings[0]?.staffId || 'No. 1';
    setMbStaffId(firstStaff);
    setMbDate(new Date().toISOString().split('T')[0]);
    setMbTime('');
    setMbBookingType('in_spa');
    setMbRoomOrLocation('VIP Private Suite');
    setMbPaymentMethod('KBZPay');
    setMbDepositAmount(0);
    setMbPaymentRef('');
    setMbNotes('');
  };

  // Calculate live pricing, discount, net total, and remaining balance
  const selectedMenuObjects = catalogServices.filter((s) => mbSelectedServiceIds.includes(s.id));
  const combinedServiceNames =
    [
      ...selectedMenuObjects.map((s) => s.name),
      mbCustomServiceName.trim() ? mbCustomServiceName.trim() : '',
    ]
      .filter(Boolean)
      .join(' + ') || 'Shangri-La Retreat Service';

  const calculatedDurationMins =
    mbBookingType === 'half_day'
      ? 360
      : mbBookingType === 'night_call'
      ? 720
      : selectedMenuObjects.reduce((sum, s) => sum + parseDurationToMinutes(s.duration || 60), 0) || 60;

  const rawSubtotal = Math.max(0, Number(mbSubtotalPrice) || 0);
  const calculatedDiscountAmount = !mbApplyDiscount
    ? 0
    : mbDiscountMode === 'PERCENT'
    ? Math.round((rawSubtotal * Math.min(100, Math.max(0, Number(mbDiscountValue) || 0))) / 100)
    : Math.min(rawSubtotal, Math.max(0, Number(mbDiscountValue) || 0));

  const calculatedNetTotal = Math.max(0, rawSubtotal - calculatedDiscountAmount);
  const calculatedDeposit = Math.min(calculatedNetTotal, Math.max(0, Number(mbDepositAmount) || 0));
  const computedRemainingBalance = Math.max(0, calculatedNetTotal - calculatedDeposit);

  // Find active bookings belonging to this customer so Admin can one-click edit & resend at top of modal
  const customerActiveBookings = React.useMemo(() => {
    if (!manualBookingTarget) return [];
    const targetCid = String(manualBookingTarget.chatId).trim();
    const targetName = String(manualBookingTarget.customerName || '').trim().toLowerCase();
    return getAllCombinedBookings().filter((b) => {
      const st = String(b.status || '').toLowerCase();
      if (st === 'cancelled' || st === 'rejected' || st === 'completed') return false;
      const sameCid = String(b.customerChatId || b.telegramChatId || '').trim() === targetCid;
      const sameName = targetName && String(b.customerName || '').trim().toLowerCase() === targetName;
      return sameCid || sameName;
    });
  }, [manualBookingTarget, liveBookings]);

  const handleConfirmAndSendManualBooking = async () => {
    if (!manualBookingTarget) return;

    if (!mbStaffId || !mbDate || !mbTime) {
      showToast('error', '❌ ကျေးဇူးပြု၍ ဝန်ထမ်း၊ နေ့ရက် နှင့် အချိန် (Time Slot) အပြည့်အစုံ ရွေးချယ်ပေးပါ။');
      return;
    }

    // Pass `editingBookingId` so the booking being edited does NOT conflict with itself!
    const conflict = checkStaffSlotConflict(
      mbStaffId,
      mbDate,
      mbTime,
      calculatedDurationMins,
      editingBookingId
    );
    if (conflict.isBooked) {
      showToast(
        'error',
        `⛔ ရွေးချယ်ထားသော ဝန်ထမ်း (${mbStaffId}) သည် ${mbDate} (${mbTime}) တွင် အခြားဘိုကင်ရှိနေပါသည် (${conflict.conflictDetail})။ ပြင်ဆင်လိုပါက အဆိုပါအချိန်ကွက်ကို နှိပ်၍ Edit လုပ်နိုင်ပါသည်။`
      );
      return;
    }

    const selectedStaffMapping = config.staffMappings.find((s) => s.staffId === mbStaffId);
    const staffDisplayName = selectedStaffMapping?.staffName || `Therapist ${mbStaffId}`;

    const paymentStatusLabel =
      calculatedDeposit <= 0
        ? 'UNPAID (ဆိုင်ရောက်မှရှင်းရန်)'
        : computedRemainingBalance === 0
        ? `FULL PAID (${mbPaymentMethod})`
        : `DEPOSIT PAID (${mbPaymentMethod})`;

    const bookingTypeLabel =
      mbBookingType === 'outcall_hotel'
        ? '🏨 Hotel Outcall Service'
        : mbBookingType === 'outcall_home'
        ? '🏠 Home Outcall Service'
        : mbBookingType === 'half_day'
        ? '🌤️ Half-Day Outcall Package'
        : mbBookingType === 'night_call'
        ? '🌙 Whole Night Call (8PM - 8AM)'
        : '🏢 In-Spa Private Room';

    // Reuse existing booking ID if we are editing/resending, otherwise create a new ID
    const isUpdateMode = Boolean(editingBookingId);
    const bookingId = editingBookingId || `BK-${Date.now().toString().slice(-6)}`;
    const finalPhone = mbPhone.trim() || manualBookingTarget.customerPhone || `TG-${manualBookingTarget.chatId}`;
    const isOutcall = mbBookingType !== 'in_spa';

    setIsSubmittingManualBooking(true);
    const btnKey = `manual_bk_${manualBookingTarget.chatId}`;
    setButtonFeedback(btnKey, 'loading');

    try {
      const discountLabelStr = mbApplyDiscount
        ? mbDiscountMode === 'PERCENT'
          ? `${mbDiscountValue}% Off (-${calculatedDiscountAmount.toLocaleString()} Ks)`
          : `-${calculatedDiscountAmount.toLocaleString()} Ks`
        : 'No Discount (0 Ks)';

      const paymentSummaryNote =
        `[မူရင်းဈေး: ${rawSubtotal.toLocaleString()} Ks | Discount: ${discountLabelStr} | အသားတင်ကျသင့်ငွေ: ${calculatedNetTotal.toLocaleString()} Ks | ` +
        `Payment: ${mbPaymentMethod} | စရံ: ${calculatedDeposit.toLocaleString()} Ks | ကျန်ငွေ: ${computedRemainingBalance.toLocaleString()} Ks` +
        `${mbPaymentRef.trim() ? ` | Ref: ${mbPaymentRef.trim()}` : ''}]`;

      const combinedNotes = [
        `[Telegram Manual Booking${isUpdateMode ? ' - Updated' : ''}] ${bookingTypeLabel}`,
        paymentSummaryNote,
        mbNotes.trim(),
      ]
        .filter(Boolean)
        .join(' — ');

      const bookingRecord: Record<string, any> = {
        id: bookingId,
        bookingId: bookingId,
        customerName: manualBookingTarget.customerName || 'VIP Guest',
        customerPhone: finalPhone,
        phone: finalPhone,
        customerChatId: String(manualBookingTarget.chatId),
        telegramChatId: String(manualBookingTarget.chatId),
        vipTier: manualBookingTarget.vipTier || 'Member',
        serviceIds: mbSelectedServiceIds,
        serviceId: mbSelectedServiceIds[0] || 'custom',
        serviceName: combinedServiceNames,
        duration: calculatedDurationMins,
        subtotalPrice: rawSubtotal,
        discountApplied: mbApplyDiscount,
        discountMode: mbApplyDiscount ? mbDiscountMode : 'NONE',
        discountValue: mbApplyDiscount ? mbDiscountValue : 0,
        discountAmount: calculatedDiscountAmount,
        discountReason: mbApplyDiscount ? mbDiscountReason : '',
        price: calculatedNetTotal,
        totalAmount: calculatedNetTotal,
        paymentMethod: mbPaymentMethod,
        depositAmount: calculatedDeposit,
        advancePaid: calculatedDeposit,
        remainingBalance: computedRemainingBalance,
        balanceDue: computedRemainingBalance,
        paymentReference: mbPaymentRef.trim() || '',
        paymentStatus:
          calculatedDeposit >= calculatedNetTotal
            ? 'paid'
            : calculatedDeposit > 0
            ? 'deposit_paid'
            : 'unpaid',
        date: mbDate,
        bookingDate: mbDate,
        time: mbTime,
        bookingTime: mbTime,
        therapistId: mbStaffId,
        staffId: mbStaffId,
        therapistName: staffDisplayName,
        staffName: staffDisplayName,
        bookingType: mbBookingType,
        isOutcall: isOutcall,
        roomName: mbRoomOrLocation.trim() || (isOutcall ? bookingTypeLabel : 'VIP Private Suite'),
        address: mbRoomOrLocation.trim() || (isOutcall ? bookingTypeLabel : "The Shangri-La Men's Retreat (Mandalay)"),
        status: 'confirmed',
        source: 'TELEGRAM_MANUAL',
        notes: combinedNotes,
        updatedAt: new Date().toISOString(),
        confirmedAt: new Date().toISOString(),
        updatedBy: 'Admin (Telegram Manual Booking)',
      };

      if (!isUpdateMode) {
        bookingRecord.createdAt = new Date().toISOString();
      }

      // 1. Save / Update in Firestore `bookings` collection
      await setDoc(doc(db, 'bookings', bookingId), bookingRecord, { merge: true });

      // 2. Sync to localStorage fallback
      try {
        const localRaw = localStorage.getItem('shangrila_bookings');
        if (localRaw) {
          const parsed = JSON.parse(localRaw);
          if (Array.isArray(parsed)) {
            const filtered = parsed.filter((item) => String(item?.id) !== String(bookingId));
            localStorage.setItem('shangrila_bookings', JSON.stringify([bookingRecord, ...filtered]));
          }
        }
      } catch {
        // ignore
      }

      // 3. Update Subscriber's Phone & lastBookingId
      await saveCustomerTelegramSubscription(
        {
          ...manualBookingTarget,
          customerPhone: mbPhone.trim() || manualBookingTarget.customerPhone || '',
          lastBookingId: bookingId,
        },
        true
      );
      await loadSubscribers();

      // 4. Build Official Customer Telegram Confirmation Slip
      const discountBlockHtml = mbApplyDiscount
        ? `• <b>မူရင်းကျသင့်ငွေ (Subtotal):</b> ${rawSubtotal.toLocaleString()} MMK\n` +
          `• <b>Discount လျှော့ငွေ (${mbDiscountMode === 'PERCENT' ? `${mbDiscountValue}%` : 'Special'}):</b> -${calculatedDiscountAmount.toLocaleString()} MMK\n` +
          `• <b>အသားတင်ကျသင့်ငွေ (Net Total):</b> <b>${calculatedNetTotal.toLocaleString()} MMK</b>\n`
        : `• <b>စုစုပေါင်းကျသင့်ငွေ (Total):</b> <b>${calculatedNetTotal.toLocaleString()} MMK</b>\n`;

      const headerBadge = isUpdateMode
        ? `🔄 <b>BOOKING UPDATED & CONFIRMED (ဘိုကင်ပြင်ဆင်အတည်ပြုချက်)</b>`
        : `✅ <b>BOOKING CONFIRMED (ဘိုကင်အတည်ပြုပြီး)</b>`;

      const customerSlipHtml =
        `🌿 <b>THE SHANGRI-LA MEN'S RETREAT</b>\n` +
        `${headerBadge}\n` +
        `━━━━━━━━━━━━━━━━━━━━\n` +
        `🆔 <b>Booking ID:</b> <code>#${bookingId}</code>\n` +
        `👤 <b>Customer:</b> ${bookingRecord.customerName}\n` +
        `📞 <b>Phone:</b> ${finalPhone}\n` +
        `💆‍♂️ <b>Service:</b> ${combinedServiceNames}\n` +
        `⏳ <b>Duration:</b> ${calculatedDurationMins} Mins\n` +
        `🏷️ <b>Service Type:</b> ${bookingTypeLabel}\n` +
        `👨‍💼 <b>Therapist:</b> ${staffDisplayName} (${mbStaffId})\n` +
        `📅 <b>Date:</b> ${mbDate}\n` +
        `⏰ <b>Time:</b> <b>${mbTime}</b>\n` +
        `📍 <b>Room / Location:</b> ${bookingRecord.roomName}\n` +
        `━━━━━━━━━━━━━━━━━━━━\n` +
        `💳 <b>PAYMENT, DISCOUNT & BALANCE</b>\n` +
        discountBlockHtml +
        `• <b>ငွေပေးချေမှုစနစ်:</b> ${mbPaymentMethod}${mbPaymentRef.trim() ? ` (Ref: ${mbPaymentRef.trim()})` : ''}\n` +
        `• <b>ပေးချေပြီး စရံငွေ (Deposit):</b> ${calculatedDeposit.toLocaleString()} MMK\n` +
        `• <b>ထပ်ရှင်းရန် ကျန်ငွေ (Balance):</b> <b>${computedRemainingBalance.toLocaleString()} MMK</b>\n` +
        `• <b>Status:</b> ${paymentStatusLabel}\n` +
        (mbNotes.trim() ? `📝 <b>မှတ်ချက်:</b> ${mbNotes.trim()}\n` : '') +
        `━━━━━━━━━━━━━━━━━━━━\n` +
        `💛 လူကြီးမင်း၏ ဘိုကင်ကို အတည်ပြုသိမ်းဆည်းပြီးဖြစ်ပါသည်။ သတ်မှတ်ချိန်ထက် (၁၀) မိနစ်ခန့် ကြိုတင်ရောက်ရှိပေးပါရန် မေတ္တာရပ်ခံအပ်ပါသည်ခင်ဗျာ။\n` +
        `📍 33th(B) St, Between 65th & 65th(A) Sts, Chan Aye Tharzan Tsp, Mandalay\n` +
        `☎️ 09-458884517, 09-770072190`;

      const customerSendRes = await sendResilientTelegramMessage(
        config.botToken,
        manualBookingTarget.chatId,
        customerSlipHtml,
        isUpdateMode ? 'MANUAL_BOOKING_UPDATED' : 'MANUAL_BOOKING_CONFIRMED'
      );

      // 5. Notify Admin Group & Assigned Therapist
      if (config.adminGroupChatId) {
        const adminCopyHtml =
          `📋 <b>[ADMIN COPY] ${isUpdateMode ? 'UPDATED' : 'NEW'} MANUAL BOOKING</b>\n` + customerSlipHtml;
        await sendResilientTelegramMessage(
          config.botToken,
          config.adminGroupChatId,
          adminCopyHtml,
          'ADMIN_BOOKING_ALERT'
        ).catch(() => {});
      }

      if (selectedStaffMapping?.telegramChatId && selectedStaffMapping.receiveBookingAssign) {
        const staffAlertHtml =
          `🔔 <b>${isUpdateMode ? 'UPDATED BOOKING ASSIGNMENT' : 'NEW CONFIRMED BOOKING ASSIGNED'}</b>\n` +
          `━━━━━━━━━━━━━━━━━━━━\n` +
          `🆔 <b>Booking ID:</b> <code>#${bookingId}</code>\n` +
          `👨‍💼 <b>Assigned To:</b> ${staffDisplayName} (${mbStaffId})\n` +
          `👤 <b>Customer:</b> ${bookingRecord.customerName}\n` +
          `💆‍♂️ <b>Service:</b> ${combinedServiceNames} (${calculatedDurationMins} Mins)\n` +
          `📅 <b>Date & Time:</b> ${mbDate} @ <b>${mbTime}</b>\n` +
          `📍 <b>Location:</b> ${bookingRecord.roomName}\n` +
          `💵 <b>Net Total:</b> ${calculatedNetTotal.toLocaleString()} Ks ` +
          `(စရံ: ${calculatedDeposit.toLocaleString()} Ks | ကောက်ခံရန်ကျန်ငွေ: <b>${computedRemainingBalance.toLocaleString()} Ks</b> - ${mbPaymentMethod})`;

        await sendResilientTelegramMessage(
          config.botToken,
          selectedStaffMapping.telegramChatId,
          staffAlertHtml,
          'STAFF_MANUAL_ASSIGN'
        ).catch(() => {});
      }

      setButtonFeedback(btnKey, 'success', 3000);
      setManualBookingTarget(null);
      setEditingBookingId(null);

      if (customerSendRes.ok) {
        showToast(
          'success',
          `✅ Booking #${bookingId} (${staffDisplayName} • ${mbTime}) ကို ${
            isUpdateMode ? 'ပြန်လည်ပြင်ဆင်ပြီး' : 'သိမ်းဆည်းပြီး'
          } ${manualBookingTarget.customerName} ထံသို့ Confirmation Slip ပေးပို့ပြီးပါပြီ!`
        );
      } else {
        showToast(
          'error',
          `⚠️ Booking #${bookingId} ကို သိမ်းဆည်းပြီးသော်လည်း Telegram ပို့ရာတွင် အမှားရှိပါသည်: ${customerSendRes.error}`
        );
      }
    } catch (err: any) {
      console.error('Error creating/updating manual booking:', err);
      setButtonFeedback(btnKey, 'error');
      showToast('error', `❌ Manual Booking သိမ်းဆည်းရာတွင် အမှားအယွင်းရှိပါသည်: ${err?.message || 'Unknown error'}`);
    } finally {
      setIsSubmittingManualBooking(false);
    }
  };

  // ==========================================
  // INTERACTIVE ACTION HANDLERS WITH UI FEEDBACK
  // ==========================================

  const handleSaveConfig = async () => {
    setSaving(true);
    setButtonFeedback('save_all', 'loading');
    const { businessAutoReplyEnabled: _e, businessAutoReplyRules: _r, ...centerOnlyConfig } = config;
    const ok = await patchTelegramConfig(centerOnlyConfig);
    setSaving(false);
    if (ok) {
      setButtonFeedback('save_all', 'success');
      setEditSections((prev) => ({ ...prev, botSetup: false, welcomeConfig: false }));
      setEditingStaffRowId(null);
      showToast('success', '✅ Telegram Bot Settings နှင့် Chat IDs စာရင်းကို အောင်မြင်စွာ သိမ်းဆည်းပြီးပါပြီ။');
    } else {
      setButtonFeedback('save_all', 'error');
      showToast('error', '❌ သိမ်းဆည်းရာတွင် အမှားအယွင်းရှိနေပါသည်။');
    }
  };

  const handleCopyChatId = async (chatId: string, keyPrefix: string = 'copy') => {
    const btnKey = `${keyPrefix}_${chatId}`;
    try {
      await navigator.clipboard.writeText(chatId);
      setButtonFeedback(btnKey, 'success', 1800);
      showToast('success', `📋 Chat ID (${chatId}) ကို Copy ကူးယူပြီးပါပြီ။`);
    } catch {
      setButtonFeedback(btnKey, 'error', 1800);
      showToast('error', '❌ Copy ကူးယူမရပါ။');
    }
  };

  const handleSetAsAdminId = async (chatId: string, titleOrName: string) => {
    const btnKey = `set_admin_${chatId}`;
    setButtonFeedback(btnKey, 'loading');
    const updatedConfig: TelegramBotConfig = {
      ...config,
      adminGroupChatId: chatId,
    };
    setConfig(updatedConfig);
    const ok = await saveTelegramConfig(updatedConfig);
    await removeCustomerTelegramSubscriber(chatId, false);
    await loadSubscribers();

    if (ok) {
      setButtonFeedback(btnKey, 'success', 2500);
      showToast('success', `✅ "${titleOrName}" (${chatId}) ကို Admin ID အဖြစ် သတ်မှတ်ပြီး သိမ်းဆည်းပြီးပါပြီ!`);
    } else {
      setButtonFeedback(btnKey, 'error', 2500);
      showToast('error', '❌ Admin ID သတ်မှတ်ရာတွင် အမှားအယွင်းရှိပါသည်။');
    }
  };

  const handleAssignChatToStaff = async (chatId: string, staffId: string) => {
    if (!staffId) return;
    const btnKey = `assign_staff_${chatId}`;
    setButtonFeedback(btnKey, 'loading');

    const updatedMappings = config.staffMappings.map((s) =>
      s.staffId === staffId ? { ...s, telegramChatId: chatId } : s
    );
    const updatedConfig: TelegramBotConfig = {
      ...config,
      staffMappings: updatedMappings,
    };
    setConfig(updatedConfig);
    const ok = await saveTelegramConfig(updatedConfig);
    await removeCustomerTelegramSubscriber(chatId, true);
    await loadSubscribers();

    if (ok) {
      setButtonFeedback(btnKey, 'success', 2500);
      showToast('success', `✅ Chat ID (${chatId}) ကို ဝန်ထမ်း ${staffId} သို့ အောင်မြင်စွာ ချိတ်ဆက်ပြီးပါပြီ!`);
    } else {
      setButtonFeedback(btnKey, 'error', 2500);
      showToast('error', '❌ ဝန်ထမ်း Chat ID ချိတ်ဆက်မှု မအောင်မြင်ပါ။');
    }
  };

  const handleRefreshActiveStaff = async () => {
    setButtonFeedback('sync_staff', 'loading');
    await syncWithActiveStaffList(config);
    await loadSubscribers();
    setButtonFeedback('sync_staff', 'success');
    showToast('success', '✅ HR Active Staff List အတိုင်း အသစ်ပြန်လည် ချိန်ညှိပြီးပါပြီ။');
  };

  const handleTestAdminConnection = async () => {
    if (!config.botToken || !config.adminGroupChatId) {
      setButtonFeedback('test_admin', 'error');
      showToast('error', '❌ Bot Token နှင့် Admin Group Chat ID ကို အရင်ဖြည့်သွင်းပါ။');
      return;
    }
    setButtonFeedback('test_admin', 'loading');
    await saveTelegramConfig(config);
    const res = await notifyBookingEvent('NEW_BOOKING', {
      id: 'TEST-9988',
      customerName: 'U Min Khant (Test VIP)',
      customerPhone: '09-799999999',
      serviceName: catalogServices[0]?.name || 'Signature Package',
      duration: catalogServices[0]?.duration || 60,
      price: catalogServices[0]?.price || 45000,
      date: new Date().toISOString().split('T')[0],
      time: '04:30 PM',
      therapistId: 'No. 1',
      therapistName: 'Therapist No-1',
      roomName: 'VIP Jade Suite 1',
      vipTier: 'Signature V-VIP (20% Off)',
      status: 'confirmed',
      notes: 'Admin Test Notification',
      updatedBy: 'Admin Test Console',
    });

    if (res.adminSent) {
      setButtonFeedback('test_admin', 'success');
      showToast('success', '✅ စမ်းသပ် Booking Notification ကို Admin Telegram သို့ အောင်မြင်စွာ ပေးပို့ပြီးပါပြီ!');
    } else {
      setButtonFeedback('test_admin', 'error');
      showToast('error', `❌ ပေးပို့မှု မအောင်မြင်ပါ: ${res.errors.join(', ')}`);
    }
  };

  const handleScanRecentChats = async () => {
    if (!config.botToken) {
      setButtonFeedback('scan_chats', 'error');
      showToast('error', '❌ Telegram Bot Token အရင်ထည့်သွင်းပေးပါ။');
      return;
    }
    setScanningChats(true);
    setButtonFeedback('scan_chats', 'loading');
    const res = await fetchRecentBotChats(config.botToken, true);
    const latestCfg = await getTelegramConfig();
    setConfig(latestCfg);
    const updatedSubs = await loadSubscribers();
    setScanningChats(false);

    if (res.ok) {
      setDiscoveredChats(res.chats);
      setButtonFeedback('scan_chats', 'success');
      showToast(
        'success',
        `✅ Bot Updates စစ်ဆေးပြီးပါပြီ! Customer စစ်စစ် (${updatedSubs.length}) ဦးကို ချိတ်ဆက်ထားပါသည်။`
      );
    } else {
      setButtonFeedback('scan_chats', 'error');
      showToast('error', `❌ ${res.error || 'Chat ID ရှာဖွေမရပါ။'}`);
    }
  };

  const handleTestStaffDirect = async (staffId: string, staffName: string, chatId: string) => {
    const btnKey = `staff_ping_${staffId}`;
    if (!chatId) {
      setButtonFeedback(btnKey, 'error');
      showToast('error', `❌ ${staffName} အတွက် Telegram Chat ID မထည့်ရသေးပါ။`);
      return;
    }
    setButtonFeedback(btnKey, 'loading');
    const res = await sendResilientTelegramMessage(
      config.botToken,
      chatId,
      `🌿 <b>THE SHANGRI-LA MEN'S RETREAT</b>\n━━━━━━━━━━━━━━━━━━━━\n👋 မင်္ဂလာပါ <b>${staffName} (${staffId})</b>\nသင်၏ Telegram အကောင့်အား ဆိုင်၏ Real-Time Notification စနစ်နှင့် အောင်မြင်စွာ ချိတ်ဆက်ပြီးပါပြီ။`,
      'STAFF_TEST'
    );
    if (res.ok) {
      setButtonFeedback(btnKey, 'success');
      showToast('success', `✅ ${staffName} (${chatId}) ထံသို့ Test Message ပို့ပြီးပါပြီ။`);
    } else {
      setButtonFeedback(btnKey, 'error');
      showToast('error', `❌ ${staffName} ထံ ပို့မရပါ: ${res.error}`);
    }
  };

  const handleSyncBotMenu = async () => {
    setButtonFeedback('sync_menu', 'loading');
    await saveTelegramConfig(config);
    const res = await syncBotCommandsAndMenu(config);
    if (res.ok) {
      setButtonFeedback('sync_menu', 'success');
      showToast('success', `✅ ${res.message}`);
    } else {
      setButtonFeedback('sync_menu', 'error');
      showToast('error', `❌ ${res.message}`);
    }
  };

  const handleAddManualSubscriber = async () => {
    if (!manualSubChatId.trim()) {
      setButtonFeedback('add_sub', 'error');
      showToast('error', '❌ Customer ၏ Telegram Chat ID ထည့်သွင်းပေးပါ။');
      return;
    }
    setButtonFeedback('add_sub', 'loading');
    const ok = await saveCustomerTelegramSubscription(
      {
        chatId: manualSubChatId.trim(),
        customerName: manualSubName.trim() || 'Shangri-La Guest',
        customerPhone: manualSubPhone.trim(),
        vipTier: manualSubVip,
        subscribed: true,
        source: 'admin_manual',
      },
      true
    );
    if (ok) {
      setManualSubName('');
      setManualSubPhone('');
      setManualSubChatId('');
      await loadSubscribers();
      setButtonFeedback('add_sub', 'success');
      setEditSections((prev) => ({ ...prev, addSubscriberForm: false }));
      showToast('success', '✅ Customer Subscriber အသစ်ကို အောင်မြင်စွာ ထည့်သွင်းပြီးပါပြီ။');
    } else {
      setButtonFeedback('add_sub', 'error');
      showToast('error', '❌ Subscriber ထည့်သွင်းရာတွင် အမှားအယွင်းရှိပါသည်။');
    }
  };

  const handleSaveCustomerPhoneInline = async (sub: CustomerTelegramSubscriber) => {
    const btnKey = `save_phone_${sub.chatId}`;
    const newPhone = (editingPhones[sub.chatId] ?? sub.customerPhone ?? '').trim();
    setButtonFeedback(btnKey, 'loading');
    const ok = await saveCustomerTelegramSubscription(
      {
        ...sub,
        customerPhone: newPhone,
      },
      true
    );
    await loadSubscribers();
    setEditingCustomerRowId(null);
    if (ok) {
      setButtonFeedback(btnKey, 'success');
      showToast('success', `✅ ${sub.customerName} ၏ ဖုန်းနံပါတ် (${newPhone || '-'}) ကို သိမ်းဆည်းပြီးပါပြီ။`);
    } else {
      setButtonFeedback(btnKey, 'error');
      showToast('error', '❌ ဖုန်းနံပါတ် သိမ်းဆည်းမရပါ။');
    }
  };

  const handleExcludeOrRemoveSubscriber = async (sub: CustomerTelegramSubscriber, reasonLabel: string) => {
    const btnKey = `remove_sub_${sub.chatId}`;
    setButtonFeedback(btnKey, 'loading');
    const ok = await removeCustomerTelegramSubscriber(sub.chatId, true);
    setSelectedSubIds((prev) => prev.filter((id) => id !== sub.chatId));
    await loadSubscribers();
    if (ok) {
      setButtonFeedback(btnKey, 'success');
      showToast(
        'success',
        `✅ "${sub.customerName}" (${sub.chatId}) ကို Subscribed Customers စာရင်းမှ (${reasonLabel}) ဖယ်ရှားပြီးပါပြီ။`
      );
    } else {
      setButtonFeedback(btnKey, 'error');
      showToast('error', '❌ ဖယ်ရှားရာတွင် အမှားအယွင်းရှိပါသည်။');
    }
  };

  const handleSendCustomerMenu = async (sub: CustomerTelegramSubscriber) => {
    const btnKey = `send_menu_${sub.chatId}`;
    setButtonFeedback(btnKey, 'loading');
    const res = await sendInteractiveMiniAppMenu(sub.chatId, config, sub.lastBookingId, sub.customerPhone);
    if (res.ok) {
      setButtonFeedback(btnKey, 'success');
      showToast('success', `✅ ${sub.customerName} ထံသို့ Mini App Menu ခလုတ်များ ပေးပို့ပြီးပါပြီ။`);
    } else {
      setButtonFeedback(btnKey, 'error');
      showToast('error', `❌ ပေးပို့မရပါ: ${res.error}`);
    }
  };

  const handleTestCustomerBookingNoti = async (sub: CustomerTelegramSubscriber) => {
    const btnKey = `test_noti_${sub.chatId}`;
    setButtonFeedback(btnKey, 'loading');
    const testHtml =
      `🌿 <b>THE SHANGRI-LA MEN'S RETREAT</b>\n` +
      `✅ <b>BOOKING STATUS NOTIFICATION</b>\n` +
      `━━━━━━━━━━━━━━━━━━━━\n` +
      `👤 <b>Customer:</b> ${sub.customerName || 'VIP Guest'}\n` +
      `💆‍♂️ <b>Service:</b> ${catalogServices[0]?.name || 'Shangri-La Signature Retreat'}\n` +
      `📅 <b>Date:</b> ${new Date().toISOString().split('T')[0]}\n` +
      `⏰ <b>Time:</b> 06:00 PM\n` +
      `👨‍💼 <b>Therapist:</b> Therapist No-1\n` +
      `━━━━━━━━━━━━━━━━━━━━\n` +
      `💛 သင်၏ Telegram Notification ချိတ်ဆက်မှု အောင်မြင်စွာ အလုပ်လုပ်နေပါသည်။`;

    const res = await sendResilientTelegramMessage(config.botToken, sub.chatId, testHtml, 'STATUS_UPDATE');
    if (res.ok) {
      setButtonFeedback(btnKey, 'success');
      showToast('success', `✅ ${sub.customerName} (${sub.chatId}) ထံသို့ Test Booking Alert ပေးပို့ပြီးပါပြီ!`);
    } else {
      setButtonFeedback(btnKey, 'error');
      showToast('error', `❌ ပေးပို့မရပါ: ${res.error}`);
    }
  };

  const handleSendBroadcast = async () => {
    if (!broadcastBody.trim()) {
      setButtonFeedback('staff_broadcast', 'error');
      showToast('error', '❌ ပေးပို့လိုသည့် စာသား ရေးသားပေးပါ။');
      return;
    }
    setSendingBroadcast(true);
    setButtonFeedback('staff_broadcast', 'loading');
    const res = await notifyStaffUpdate({
      type: 'GENERAL_ANNOUNCEMENT',
      staffName: broadcastTarget === 'ALL' ? 'ဝန်ထမ်းအားလုံး (All Staff)' : 'သက်ဆိုင်ရာ အဖွဲ့ဝင်များ',
      title: broadcastTitle,
      details: broadcastBody,
      effectiveDate: new Date().toLocaleDateString(),
      issuedBy: 'Management (Admin Panel)',
    });
    setSendingBroadcast(false);
    if (res.sent) {
      setBroadcastBody('');
      setButtonFeedback('staff_broadcast', 'success');
      setEditSections((prev) => ({ ...prev, staffBroadcast: false }));
      showToast('success', '✅ ကြေညာချက်ကို ဝန်ထမ်း Telegram သို့ အောင်မြင်စွာ ပေးပို့ပြီးပါပြီ။');
    } else {
      setButtonFeedback('staff_broadcast', 'error');
      showToast('error', `❌ ပေးပို့မှု မအောင်မြင်ပါ: ${res.errors.join(', ')}`);
    }
  };

  const handleSendCustomerPromoBroadcast = async () => {
    if (!promoMessage.trim()) {
      setButtonFeedback('promo_broadcast', 'error');
      showToast('error', '❌ Customer များထံ ပေးပို့လိုသည့် ပရိုမိုးရှင်း သို့မဟုတ် အသိပေးစာသား ရေးသားပေးပါ။');
      return;
    }
    if (promoAudience === 'SELECTED' && selectedSubIds.length === 0) {
      setButtonFeedback('promo_broadcast', 'error');
      showToast('error', '❌ ပေးပို့လိုသော Customer အနည်းဆုံး (၁) ဦးကို ရွေးချယ်ပေးပါ။');
      return;
    }

    setSendingPromo(true);
    setButtonFeedback('promo_broadcast', 'loading');
    setPromoProgress({ sent: 0, total: subscribers.length });

    const res = await sendBulkCustomerBroadcast(
      {
        title: promoTitle,
        message: promoMessage,
        imageUrl: promoImageUrl.trim() || undefined,
        targetAudience: promoAudience,
        selectedChatIds: selectedSubIds,
        buttonText: promoButtonText,
        buttonTab: promoButtonTab,
      },
      (sent, total) => setPromoProgress({ sent, total })
    );

    setSendingPromo(false);
    setPromoProgress(null);

    if (res.successCount > 0) {
      setButtonFeedback('promo_broadcast', 'success');
      setEditSections((prev) => ({ ...prev, promoComposer: false }));
      showToast(
        'success',
        `✅ Customer (${res.successCount}/${res.totalTargeted}) ဦးထံသို့ Promotion / Push Notification အောင်မြင်စွာ ပေးပို့ပြီးပါပြီ!`
      );
    } else {
      setButtonFeedback('promo_broadcast', 'error');
      showToast(
        'error',
        `❌ ပေးပို့မှု မအောင်မြင်ပါ (Targeted: ${res.totalTargeted}). ${res.errors.slice(0, 2).join(', ')}`
      );
    }
  };

  const filteredSubscribers = subscribers.filter((s) => {
    if (!customerSearch.trim()) return true;
    const q = customerSearch.toLowerCase();
    return (
      s.customerName.toLowerCase().includes(q) ||
      (s.username || '').toLowerCase().includes(q) ||
      (s.customerPhone || '').toLowerCase().includes(q) ||
      s.chatId.includes(q)
    );
  });

  const serviceCategories = React.useMemo(() => {
    const cats = Array.from(new Set(catalogServices.map((s) => s.category)));
    return ['ALL', ...cats];
  }, [catalogServices]);

  const visibleCategoryServices = React.useMemo(() => {
    if (mbSelectedCategory === 'ALL') return catalogServices;
    return catalogServices.filter((s) => s.category === mbSelectedCategory);
  }, [catalogServices, mbSelectedCategory]);

  if (loading) {
    return (
      <div className="p-8 text-center text-[#C8A951] bg-[#0B2419] rounded-2xl border border-[#C8A951]/30">
        <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2" />
        <p className="text-sm">Telegram Bot, Active Staff နှင့် Customer App Menu စာရင်းကို ချိတ်ဆက်နေပါသည်...</p>
      </div>
    );
  }

  return (
    <div className="relative bg-[#0B2419] text-stone-100 rounded-2xl border border-[#C8A951]/30 shadow-2xl overflow-hidden">
      {/* Floating Bottom-Right Toast Notification */}
      {statusBanner && (
        <div
          className={`fixed bottom-5 right-5 z-50 max-w-md px-4 py-3 rounded-xl shadow-2xl border text-xs font-semibold flex items-center gap-3 transition-all duration-200 ${
            statusBanner.type === 'success'
              ? 'bg-emerald-950/95 text-emerald-200 border-emerald-400/50'
              : 'bg-red-950/95 text-red-200 border-red-400/50'
          }`}
        >
          {statusBanner.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          ) : (
            <ShieldAlert className="w-4 h-4 text-red-400 shrink-0" />
          )}
          <span className="leading-relaxed">{statusBanner.text}</span>
          <button
            onClick={() => setStatusBanner(null)}
            className="ml-2 text-stone-400 hover:text-white active:scale-90 transition"
          >
            ✕
          </button>
        </div>
      )}

      {/* Header */}
      <div className="p-4 sm:p-5 bg-gradient-to-r from-[#071810] via-[#0B2419] to-[#071810] border-b border-[#C8A951]/30 flex flex-col md:flex-row md:items-center md:justify-between gap-3.5">
        <div className="min-w-0">
          <div className="flex items-start sm:items-center gap-2.5">
            <span className="p-2 rounded-xl bg-[#C8A951]/15 border border-[#C8A951]/40 text-[#C8A951] shrink-0">
              <Send className="w-5 h-5" />
            </span>
            <div className="min-w-0">
              <h2 className="text-sm sm:text-lg font-bold text-[#C8A951] tracking-wide leading-snug">
                TELEGRAM BOT, MINI APP &amp; REAL-TIME NOTIFICATION CENTER
              </h2>
              <p className="text-[11px] text-stone-400 mt-0.5 leading-relaxed">
                Clean Summary Mode — ပြင်ဆင်လိုသော ကဒ်ရှိ <b>✏️ Edit</b> ကိုနှိပ်မှသာ ပြင်ဆင်နိုင်အောင် စနစ်တကျ Lock ချထားပါသည်။
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <label className="flex items-center gap-2 cursor-pointer bg-black/30 px-3 py-2 min-h-[40px] rounded-xl border border-[#C8A951]/30 hover:border-[#C8A951]/60 transition flex-1 sm:flex-initial justify-center">
            <input
              type="checkbox"
              checked={config.enabled}
              onChange={(e) => {
                const next = { ...config, enabled: e.target.checked };
                setConfig(next);
                patchTelegramConfig({ enabled: e.target.checked });
                showToast(
                  'success',
                  e.target.checked ? '🟢 Telegram Bot ကို ဖွင့်လိုက်ပါပြီ။' : '🔴 Telegram Bot ကို ခေတ္တပိတ်ထားပါသည်။'
                );
              }}
              className="accent-[#C8A951] w-4 h-4"
            />
            <span className="text-xs font-semibold text-[#C8A951] whitespace-nowrap">
              {config.enabled ? '🟢 BOT ACTIVE' : '🔴 BOT PAUSED'}
            </span>
          </label>

          <button
            onClick={handleSaveConfig}
            disabled={saving}
            className={`flex items-center justify-center gap-1.5 px-4 py-2 min-h-[40px] rounded-xl font-bold text-xs active:scale-95 transition shadow-md whitespace-nowrap flex-1 sm:flex-initial ${
              btnStates['save_all'] === 'success'
                ? 'bg-emerald-500 text-black'
                : 'bg-[#C8A951] text-[#0B2419] hover:bg-[#d8b962]'
            }`}
          >
            {btnStates['save_all'] === 'loading' ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            {btnStates['save_all'] === 'success' ? 'Saved ✓' : 'Save Changes'}
          </button>
        </div>
      </div>

      {/* Navigation Tabs — Mobile-First 2x3 Tap Grid, Desktop Single-Row Tab Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:flex lg:overflow-x-auto gap-1.5 lg:gap-0 p-2.5 lg:p-0 lg:px-4 border-b border-[#C8A951]/20 bg-[#071810]/70">
        {[
          { id: 'setup', shortLabel: '1. Bot Setup', label: '1. Bot Setup', icon: Settings },
          { id: 'triggers', shortLabel: '2. Triggers', label: '2. Notification Triggers', icon: Bell },
          { id: 'staff', shortLabel: `3. Staff (${config.staffMappings.length})`, label: `3. Active Staff (${config.staffMappings.length})`, icon: Users },
          { id: 'customers', shortLabel: `4. Customers (${subscribers.length})`, label: `4. Subscribed Customers (${subscribers.length})`, icon: Smartphone },
          { id: 'botflow', shortLabel: '5. Mini App', label: '5. Mini App & Promo', icon: Megaphone },
          { id: 'logs', shortLabel: '6. Logs', label: '6. Delivery Logs', icon: History },
        ].map((tab) => {
          const Icon = tab.icon;
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center justify-center lg:justify-start gap-1.5 lg:gap-2 px-2.5 lg:px-4 py-2.5 lg:py-3 min-h-[42px] text-[11px] lg:text-xs font-semibold whitespace-nowrap rounded-xl lg:rounded-none border lg:border-0 lg:border-b-2 active:scale-[0.98] transition tabular-nums ${
                active
                  ? 'border-[#C8A951] text-[#C8A951] bg-[#C8A951]/15 lg:bg-[#C8A951]/10 shadow-xs lg:shadow-none'
                  : 'border-white/10 lg:border-transparent text-stone-300 lg:text-stone-400 bg-white/[0.03] lg:bg-transparent hover:text-stone-100'
              }`}
            >
              <Icon className="w-3.5 h-3.5 lg:w-4 lg:h-4 shrink-0" />
              <span className="truncate lg:hidden">{tab.shortLabel}</span>
              <span className="hidden lg:inline">{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Tab Content */}
      <div className="p-3.5 sm:p-5 space-y-4">
        {/* =====================================================================
            TAB 1: BOT & CHANNELS SETUP (COMPACT READ-ONLY CARD + EDIT TOGGLE)
        ===================================================================== */}
        {activeTab === 'setup' && (
          <div className="space-y-4">
            <div className="bg-black/25 p-4 rounded-xl border border-[#C8A951]/25 space-y-4">
              <div className="flex items-center justify-between border-b border-[#C8A951]/15 pb-3">
                <div>
                  <h3 className="text-sm font-bold text-[#C8A951] flex items-center gap-2">
                    <Settings className="w-4 h-4" />
                    Telegram Bot & Group Channels Configuration
                  </h3>
                  <p className="text-[11px] text-stone-400">
                    Bot Token, Mini App URL နှင့် Admin / Staff Group Chat ID ချိတ်ဆက်မှု အချက်အလက်များ
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => toggleSectionEdit('botSetup')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition ${
                    editSections.botSetup
                      ? 'bg-emerald-500 text-black'
                      : 'bg-white/10 text-[#C8A951] hover:bg-white/20 border border-[#C8A951]/30'
                  }`}
                >
                  {editSections.botSetup ? (
                    <>
                      <Lock className="w-3.5 h-3.5" /> Done Editing
                    </>
                  ) : (
                    <>
                      <Edit3 className="w-3.5 h-3.5" /> ✏️ Edit Settings
                    </>
                  )}
                </button>
              </div>

              {/* READ-ONLY COMPACT SUMMARY VIEW */}
              {!editSections.botSetup ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
                  <div className="bg-[#071810]/90 p-3 rounded-xl border border-white/10">
                    <span className="text-[10px] text-stone-400 block">Bot Username</span>
                    <span className="font-bold text-white mt-0.5 block">
                      @{config.botUsername || 'theshangrila_app'}
                    </span>
                    <span className="text-[10px] text-emerald-400">
                      Token: {config.botToken ? `••••••••${config.botToken.slice(-6)}` : 'Not Set'}
                    </span>
                  </div>

                  <div className="bg-[#071810]/90 p-3 rounded-xl border border-white/10">
                    <span className="text-[10px] text-stone-400 block">Mini App URL</span>
                    <span className="font-semibold text-[#C8A951] truncate block mt-0.5">
                      {config.webAppUrl || 'https://www.shangrilamenretreat.online'}
                    </span>
                  </div>

                  <div className="bg-[#071810]/90 p-3 rounded-xl border border-white/10">
                    <span className="text-[10px] text-stone-400 block">Admin Group Chat ID</span>
                    <span className="font-mono font-bold text-emerald-300 block mt-0.5">
                      {config.adminGroupChatId || 'Not Linked'}
                    </span>
                  </div>

                  <div className="bg-[#071810]/90 p-3 rounded-xl border border-white/10">
                    <span className="text-[10px] text-stone-400 block">Staff Group Chat ID</span>
                    <span className="font-mono font-bold text-stone-200 block mt-0.5">
                      {config.staffGroupChatId || 'Optional (Not Set)'}
                    </span>
                  </div>
                </div>
              ) : (
                /* EDITABLE FORM VIEW (ONLY WHEN EDIT IS CLICKED) */
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                  <div>
                    <label className="block text-xs font-semibold text-[#C8A951] mb-1">
                      Telegram Bot Token (@BotFather)
                    </label>
                    <div className="relative flex items-center">
                      <input
                        type={showToken ? 'text' : 'password'}
                        value={config.botToken}
                        onChange={(e) => setConfig({ ...config, botToken: e.target.value })}
                        className="w-full bg-[#071810] border border-[#C8A951]/40 rounded-lg px-3 py-2 text-xs text-white pr-10"
                      />
                      <button
                        type="button"
                        onClick={() => setShowToken(!showToken)}
                        className="absolute right-2.5 text-stone-400 hover:text-[#C8A951]"
                      >
                        {showToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-[#C8A951] mb-1">
                      Telegram Bot Username
                    </label>
                    <input
                      type="text"
                      value={config.botUsername || ''}
                      onChange={(e) => setConfig({ ...config, botUsername: e.target.value.replace(/^@/, '') })}
                      className="w-full bg-[#071810] border border-[#C8A951]/40 rounded-lg px-3 py-2 text-xs text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-[#C8A951] mb-1">
                      Official Web App URL
                    </label>
                    <input
                      type="text"
                      value={config.webAppUrl}
                      onChange={(e) => setConfig({ ...config, webAppUrl: e.target.value })}
                      className="w-full bg-[#071810] border border-[#C8A951]/40 rounded-lg px-3 py-2 text-xs text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-[#C8A951] mb-1">
                      Admin / Reception Group Chat ID
                    </label>
                    <input
                      type="text"
                      value={config.adminGroupChatId}
                      onChange={(e) => setConfig({ ...config, adminGroupChatId: e.target.value })}
                      className="w-full bg-[#071810] border border-[#C8A951]/40 rounded-lg px-3 py-2 text-xs font-mono text-emerald-300"
                    />
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-xs font-semibold text-[#C8A951] mb-1">
                      Staff General Group Chat ID (Optional)
                    </label>
                    <input
                      type="text"
                      value={config.staffGroupChatId}
                      onChange={(e) => setConfig({ ...config, staffGroupChatId: e.target.value })}
                      className="w-full bg-[#071810] border border-[#C8A951]/40 rounded-lg px-3 py-2 text-xs font-mono text-white"
                    />
                  </div>
                </div>
              )}

              {/* Quick Action Bar */}
              <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-white/10">
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    onClick={handleTestAdminConnection}
                    disabled={btnStates['test_admin'] === 'loading'}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs transition"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    {btnStates['test_admin'] === 'loading' ? 'Sending...' : 'Test Admin Alert'}
                  </button>

                  <button
                    onClick={handleScanRecentChats}
                    disabled={scanningChats}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#C8A951]/20 hover:bg-[#C8A951]/30 text-[#C8A951] border border-[#C8A951]/40 font-semibold text-xs transition"
                  >
                    <Radio className={`w-3.5 h-3.5 ${scanningChats ? 'animate-ping' : ''}`} />
                    {scanningChats ? 'Scanning...' : 'Scan & Auto-Sync Subscribers'}
                  </button>

                  <button
                    onClick={handleSyncBotMenu}
                    disabled={btnStates['sync_menu'] === 'loading'}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#C8A951] text-[#0B2419] font-bold text-xs transition"
                  >
                    <Smartphone className="w-3.5 h-3.5" />
                    Sync Bot Menu Commands
                  </button>
                </div>

                {discoveredChats.length > 0 && (
                  <button
                    type="button"
                    onClick={() => toggleSectionEdit('discoveredChats')}
                    className="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-stone-300 text-xs font-semibold border border-white/10"
                  >
                    {editSections.discoveredChats
                      ? '▲ Hide Recent Bot Chats'
                      : `📡 View Recent Bot Chats (${discoveredChats.length})`}
                  </button>
                )}
              </div>
            </div>

            {/* Collapsible Recent Discovered Chats */}
            {editSections.discoveredChats && discoveredChats.length > 0 && (
              <div className="bg-black/30 rounded-xl border border-[#C8A951]/30 p-4 space-y-2">
                <h3 className="text-xs font-bold text-[#C8A951]">
                  📡 Bot သို့ လတ်တလော ဆက်သွယ်ထားသော အကောင့်များ ({discoveredChats.length})
                </h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-[#C8A951]/20 text-stone-400">
                        <th className="py-2 px-2">Name</th>
                        <th className="py-2 px-2">Role</th>
                        <th className="py-2 px-2">Chat ID</th>
                        <th className="py-2 px-2 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {discoveredChats.map((c) => {
                        const isCurrentAdmin = String(config.adminGroupChatId || '').trim() === String(c.chatId).trim();
                        const linkedStaff = config.staffMappings.find(
                          (s) => String(s.telegramChatId || '').trim() === String(c.chatId).trim()
                        );
                        return (
                          <tr key={c.chatId} className="hover:bg-white/5">
                            <td className="py-2 px-2 font-medium text-white">
                              {c.titleOrName} {c.username ? <span className="text-stone-400">(@{c.username})</span> : ''}
                            </td>
                            <td className="py-2 px-2">
                              {isCurrentAdmin ? (
                                <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 text-[10px] font-bold">
                                  ADMIN
                                </span>
                              ) : linkedStaff ? (
                                <span className="px-2 py-0.5 rounded bg-sky-500/20 text-sky-300 text-[10px] font-bold">
                                  STAFF ({linkedStaff.staffId})
                                </span>
                              ) : (
                                <span className="px-2 py-0.5 rounded bg-[#C8A951]/15 text-[#C8A951] text-[10px]">
                                  CUSTOMER
                                </span>
                              )}
                            </td>
                            <td className="py-2 px-2 font-mono text-emerald-300">{c.chatId}</td>
                            <td className="py-2 px-2 text-right">
                              <div className="flex items-center justify-end gap-1.5">
                                <button
                                  onClick={() => handleCopyChatId(c.chatId, 'copy')}
                                  className="px-2 py-1 rounded bg-white/10 text-white text-[10px]"
                                >
                                  Copy ID
                                </button>
                                <button
                                  onClick={() => handleSetAsAdminId(c.chatId, c.titleOrName)}
                                  className="px-2 py-1 rounded bg-[#C8A951]/20 text-[#C8A951] text-[10px]"
                                >
                                  {isCurrentAdmin ? '✓ Admin' : 'Set Admin'}
                                </button>
                                <select
                                  value={linkedStaff?.staffId || ''}
                                  onChange={(e) => handleAssignChatToStaff(c.chatId, e.target.value)}
                                  className="bg-[#071810] border border-[#C8A951]/30 rounded px-2 py-1 text-[10px] text-stone-200"
                                >
                                  <option value="">Link Staff...</option>
                                  {config.staffMappings.map((sm) => (
                                    <option key={sm.staffId} value={sm.staffId}>
                                      {sm.staffId} ({sm.staffName})
                                    </option>
                                  ))}
                                </select>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* =====================================================================
            TAB 2: NOTIFICATION TRIGGERS (CLEAN READ-ONLY CARDS + EDIT BUTTON)
        ===================================================================== */}
        {activeTab === 'triggers' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Card 1: Customer & Admin Triggers */}
            <div className="bg-black/25 p-4 rounded-xl border border-[#C8A951]/25 space-y-3">
              <div className="flex items-center justify-between border-b border-[#C8A951]/20 pb-2.5">
                <h3 className="text-xs font-bold text-[#C8A951]">
                  📅 Customer & Admin Booking Status Alerts
                </h3>
                <button
                  type="button"
                  onClick={() => toggleSectionEdit('customerTriggers')}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold flex items-center gap-1 transition ${
                    editSections.customerTriggers
                      ? 'bg-emerald-500 text-black'
                      : 'bg-white/10 text-[#C8A951] hover:bg-white/20'
                  }`}
                >
                  <Edit3 className="w-3 h-3" />
                  {editSections.customerTriggers ? 'Done' : 'Edit'}
                </button>
              </div>

              <div className="space-y-1.5">
                {[
                  { key: 'customerDirectNoti', label: '📲 Direct Customer Booking Status Alert' },
                  { key: 'newBooking', label: '🔔 New Booking Created (Pending)' },
                  { key: 'bookingConfirmed', label: '🟢 Booking Approved / Confirmed' },
                  { key: 'bookingInService', label: '💆‍♂️ Service Started (In-Service)' },
                  { key: 'bookingCompleted', label: '✨ Service Completed' },
                  { key: 'bookingCancelled', label: '🔴 Booking Cancelled' },
                ].map((item) => {
                  const isOn = (config.triggers as any)[item.key] !== false;
                  return (
                    <div
                      key={item.key}
                      className="flex items-center justify-between py-1.5 px-2.5 rounded-lg bg-[#071810]/70 border border-white/5"
                    >
                      <span className="text-xs text-stone-200">{item.label}</span>
                      {editSections.customerTriggers ? (
                        <input
                          type="checkbox"
                          checked={isOn}
                          onChange={async (e) => {
                            const updated = {
                              ...config,
                              triggers: { ...config.triggers, [item.key]: e.target.checked },
                            };
                            setConfig(updated);
                            await saveTelegramConfig(updated);
                          }}
                          className="accent-[#C8A951] w-4 h-4 cursor-pointer"
                        />
                      ) : (
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            isOn
                              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                              : 'bg-stone-800 text-stone-400'
                          }`}
                        >
                          {isOn ? 'ON' : 'OFF'}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Card 2: Staff & Operations Triggers */}
            <div className="bg-black/25 p-4 rounded-xl border border-[#C8A951]/25 space-y-3">
              <div className="flex items-center justify-between border-b border-[#C8A951]/20 pb-2.5">
                <h3 className="text-xs font-bold text-[#C8A951]">
                  👨‍💼 Staff & Operations Alerts
                </h3>
                <button
                  type="button"
                  onClick={() => toggleSectionEdit('staffTriggers')}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold flex items-center gap-1 transition ${
                    editSections.staffTriggers
                      ? 'bg-emerald-500 text-black'
                      : 'bg-white/10 text-[#C8A951] hover:bg-white/20'
                  }`}
                >
                  <Edit3 className="w-3 h-3" />
                  {editSections.staffTriggers ? 'Done' : 'Edit'}
                </button>
              </div>

              <div className="space-y-1.5">
                {[
                  { key: 'staffAssigned', label: '👨‍💼 Therapist Booking Assignment Alert' },
                  { key: 'dutyRosterUpdated', label: '📅 Duty Roster / Shift Update' },
                  { key: 'penaltyIssued', label: '⚠️ Penalty / Discipline Alert' },
                  { key: 'payrollGenerated', label: '💵 Payroll & Commission Ready' },
                  { key: 'dailySalesSummary', label: '📊 Daily Sales Summary Report' },
                ].map((item) => {
                  const isOn = Boolean((config.triggers as any)[item.key]);
                  return (
                    <div
                      key={item.key}
                      className="flex items-center justify-between py-1.5 px-2.5 rounded-lg bg-[#071810]/70 border border-white/5"
                    >
                      <span className="text-xs text-stone-200">{item.label}</span>
                      {editSections.staffTriggers ? (
                        <input
                          type="checkbox"
                          checked={isOn}
                          onChange={async (e) => {
                            const updated = {
                              ...config,
                              triggers: { ...config.triggers, [item.key]: e.target.checked },
                            };
                            setConfig(updated);
                            await saveTelegramConfig(updated);
                          }}
                          className="accent-[#C8A951] w-4 h-4 cursor-pointer"
                        />
                      ) : (
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            isOn
                              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                              : 'bg-stone-800 text-stone-400'
                          }`}
                        >
                          {isOn ? 'ON' : 'OFF'}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* =====================================================================
            TAB 3: ACTIVE STAFF (CLEAN READ-ONLY CARDS + PER-ROW EDIT BUTTON)
        ===================================================================== */}
        {activeTab === 'staff' && (
          <div className="space-y-4">
            <div className="bg-black/20 p-3.5 rounded-xl border border-[#C8A951]/20 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <p className="text-xs text-stone-200 font-semibold">
                ✅ <b>HR Active Staff List</b> — ဝန်ထမ်းတစ်ဦးချင်းစီကို ပြင်ဆင်လိုမှသာ <b>✏️ Edit</b> ကိုနှိပ်ပါ။
              </p>
              <button
                type="button"
                onClick={handleRefreshActiveStaff}
                disabled={btnStates['sync_staff'] === 'loading'}
                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-[#C8A951]/20 hover:bg-[#C8A951]/30 text-[#C8A951] border border-[#C8A951]/40 text-xs font-bold"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${btnStates['sync_staff'] === 'loading' ? 'animate-spin' : ''}`} />
                Sync HR Active Staff
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {config.staffMappings.map((staff, idx) => {
                const hrMeta = staffHrMeta[staff.staffId];
                const isEditingRow = editingStaffRowId === staff.staffId;
                const pingKey = `staff_ping_${staff.staffId}`;

                return (
                  <div
                    key={staff.staffId}
                    className={`p-4 rounded-xl border transition space-y-3 ${
                      isEditingRow
                        ? 'bg-[#071810] border-[#C8A951] shadow-lg'
                        : 'bg-black/25 border-[#C8A951]/20 hover:border-[#C8A951]/40'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-sm font-extrabold text-[#C8A951]">{staff.staffId}</span>
                          <span className="px-1.5 py-0.5 text-[9px] rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-bold">
                            ACTIVE
                          </span>
                        </div>
                        <p className="text-xs font-bold text-white mt-0.5">{staff.staffName}</p>
                        {hrMeta?.actualName && (
                          <p className="text-[11px] text-emerald-300/90">
                            👤 {hrMeta.actualName} {hrMeta.position ? `• ${hrMeta.position}` : ''}
                          </p>
                        )}
                      </div>

                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => handleTestStaffDirect(staff.staffId, staff.staffName, staff.telegramChatId)}
                          className="px-2 py-1 rounded-lg bg-[#C8A951]/15 hover:bg-[#C8A951]/30 text-[#C8A951] text-[10px] font-bold"
                        >
                          {btnStates[pingKey] === 'loading' ? '...' : '🔔 Ping'}
                        </button>
                        <button
                          type="button"
                          onClick={async () => {
                            if (isEditingRow) {
                              await saveTelegramConfig(config);
                              setEditingStaffRowId(null);
                              showToast('success', `✅ ${staff.staffId} အချက်အလက်ကို သိမ်းဆည်းပြီးပါပြီ။`);
                            } else {
                              setEditingStaffRowId(staff.staffId);
                            }
                          }}
                          className={`px-2.5 py-1 rounded-lg text-[10px] font-bold flex items-center gap-1 ${
                            isEditingRow
                              ? 'bg-emerald-500 text-black'
                              : 'bg-white/10 text-stone-200 hover:bg-white/20'
                          }`}
                        >
                          {isEditingRow ? (
                            <>
                              <Check className="w-3 h-3" /> Save
                            </>
                          ) : (
                            <>
                              <Edit3 className="w-3 h-3" /> Edit
                            </>
                          )}
                        </button>
                      </div>
                    </div>

                    {!isEditingRow ? (
                      <div className="pt-2 border-t border-white/10 flex items-center justify-between text-[11px]">
                        <span className="text-stone-400">Telegram Chat ID:</span>
                        {staff.telegramChatId ? (
                          <span className="font-mono text-emerald-300 font-bold flex items-center gap-1">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                            {staff.telegramChatId}
                          </span>
                        ) : (
                          <span className="text-stone-500 italic">Not Linked</span>
                        )}
                      </div>
                    ) : (
                      <div className="pt-2 border-t border-[#C8A951]/30 space-y-2.5 text-xs">
                        <div>
                          <label className="block text-[10px] text-[#C8A951] mb-1">Display Name</label>
                          <input
                            type="text"
                            value={staff.staffName}
                            onChange={(e) => {
                              const updated = [...config.staffMappings];
                              updated[idx].staffName = e.target.value;
                              setConfig({ ...config, staffMappings: updated });
                            }}
                            className="w-full bg-black/50 border border-[#C8A951]/40 rounded-lg px-2.5 py-1.5 text-xs text-white"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] text-[#C8A951] mb-1">Telegram Chat ID</label>
                          <input
                            type="text"
                            value={staff.telegramChatId}
                            onChange={(e) => {
                              const updated = [...config.staffMappings];
                              updated[idx].telegramChatId = e.target.value;
                              setConfig({ ...config, staffMappings: updated });
                            }}
                            placeholder="e.g. 5063247381"
                            className="w-full bg-black/50 border border-[#C8A951]/40 rounded-lg px-2.5 py-1.5 text-xs font-mono text-emerald-300"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* =====================================================================
            TAB 4: SUBSCRIBED CUSTOMERS (READ-ONLY PHONE BY DEFAULT + EDIT ICON)
        ===================================================================== */}
        {activeTab === 'customers' && (
          <div className="space-y-4">
            <div className="bg-black/25 p-4 rounded-xl border border-[#C8A951]/20 space-y-3">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-2">
                <div>
                  <h3 className="text-sm font-bold text-[#C8A951]">
                    📲 Subscribed Customers ({subscribers.length}) — Real-Time Booking & Delivery Status
                  </h3>
                  <p className="text-xs text-stone-400">
                    Customer ဘေးရှိ <b>+ Manual Booking</b> ကိုနှိပ်၍ ဘိုကင်အသစ်သွင်းခြင်း သို့မဟုတ် ဘိုကင်အဟောင်းကို ပြန်ပြင်၍ Noti ပြန်ပို့ခြင်း ပြုလုပ်နိုင်ပါသည်။
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 text-stone-400 absolute left-2.5 top-2.5" />
                    <input
                      type="text"
                      value={customerSearch}
                      onChange={(e) => setCustomerSearch(e.target.value)}
                      placeholder="အမည် / ဖုန်း / ID ရှာရန်..."
                      className="bg-[#071810] border border-[#C8A951]/30 rounded-xl pl-8 pr-3 py-1.5 text-xs text-white w-44"
                    />
                  </div>

                  <button
                    type="button"
                    onClick={() => toggleSectionEdit('addSubscriberForm')}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/15 text-[#C8A951] border border-[#C8A951]/30 text-xs font-bold"
                  >
                    <UserPlus className="w-3.5 h-3.5" />
                    {editSections.addSubscriberForm ? 'Close Form' : '+ Add Subscriber'}
                  </button>

                  <button
                    onClick={handleScanRecentChats}
                    disabled={scanningChats}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#C8A951] text-[#0B2419] font-bold text-xs"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${scanningChats ? 'animate-spin' : ''}`} />
                    Auto-Sync
                  </button>
                </div>
              </div>

              {/* Collapsible Manual Add Subscriber Form */}
              {editSections.addSubscriberForm && (
                <div className="grid grid-cols-1 md:grid-cols-5 gap-2 pt-3 border-t border-[#C8A951]/20">
                  <input
                    type="text"
                    value={manualSubName}
                    onChange={(e) => setManualSubName(e.target.value)}
                    placeholder="Customer Name"
                    className="bg-[#071810] border border-[#C8A951]/30 rounded-lg px-3 py-1.5 text-xs text-white"
                  />
                  <input
                    type="text"
                    value={manualSubPhone}
                    onChange={(e) => setManualSubPhone(e.target.value)}
                    placeholder="Phone (09-xxxxxxxxx)"
                    className="bg-[#071810] border border-[#C8A951]/30 rounded-lg px-3 py-1.5 text-xs text-white"
                  />
                  <input
                    type="text"
                    value={manualSubChatId}
                    onChange={(e) => setManualSubChatId(e.target.value)}
                    placeholder="Telegram Chat ID"
                    className="bg-[#071810] border border-[#C8A951]/30 rounded-lg px-3 py-1.5 text-xs font-mono text-emerald-300"
                  />
                  <select
                    value={manualSubVip}
                    onChange={(e) => setManualSubVip(e.target.value)}
                    className="bg-[#071810] border border-[#C8A951]/30 rounded-lg px-3 py-1.5 text-xs text-white"
                  >
                    <option value="Member">Member</option>
                    <option value="VIP 10%">VIP (10% Off)</option>
                    <option value="VIP 15%">VIP (15% Off)</option>
                    <option value="V-VIP 20%">V-VIP (20% Off)</option>
                  </select>
                  <button
                    onClick={handleAddManualSubscriber}
                    className="flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs"
                  >
                    <Check className="w-3.5 h-3.5" /> Save Subscriber
                  </button>
                </div>
              )}
            </div>

            <div className="overflow-x-auto bg-black/20 rounded-xl border border-[#C8A951]/20">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-[#C8A951]/20 text-[#C8A951] bg-black/40">
                    <th className="py-3 px-3">
                      <input
                        type="checkbox"
                        checked={
                          filteredSubscribers.length > 0 &&
                          filteredSubscribers.every((s) => selectedSubIds.includes(s.chatId))
                        }
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedSubIds(filteredSubscribers.map((s) => s.chatId));
                          } else {
                            setSelectedSubIds([]);
                          }
                        }}
                        className="accent-[#C8A951] cursor-pointer"
                      />
                    </th>
                    <th className="py-3 px-3">Customer Name</th>
                    <th className="py-3 px-3">Phone</th>
                    <th className="py-3 px-3">Telegram Chat ID</th>
                    <th className="py-3 px-3">VIP Tier</th>
                    <th className="py-3 px-3">Last Noti Status</th>
                    <th className="py-3 px-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {filteredSubscribers.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-6 text-center text-stone-400">
                        Subscribed လုပ်ထားသော Customer မရှိသေးပါ။
                      </td>
                    </tr>
                  ) : (
                    filteredSubscribers.map((sub) => {
                      const isSelected = selectedSubIds.includes(sub.chatId);
                      const isEditingPhone = editingCustomerRowId === sub.chatId;
                      const testKey = `test_noti_${sub.chatId}`;
                      const menuKey = `send_menu_${sub.chatId}`;
                      const copySubKey = `copy_sub_${sub.chatId}`;
                      const manualBkKey = `manual_bk_${sub.chatId}`;
                      const currentPhoneVal =
                        editingPhones[sub.chatId] !== undefined ? editingPhones[sub.chatId] : sub.customerPhone || '';

                      const lastLog = latestNotiByChatId[String(sub.chatId).trim()];
                      const lastLogTimeStr = lastLog ? formatLogTimeShort(lastLog.timestamp) : '';

                      return (
                        <tr key={sub.chatId} className="hover:bg-white/5">
                          <td className="py-2.5 px-3">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelectedSubIds([...selectedSubIds, sub.chatId]);
                                } else {
                                  setSelectedSubIds(selectedSubIds.filter((id) => id !== sub.chatId));
                                }
                              }}
                              className="accent-[#C8A951] cursor-pointer"
                            />
                          </td>
                          <td className="py-2.5 px-3 font-semibold text-white">
                            <div>
                              {sub.customerName}{' '}
                              {sub.username ? <span className="text-stone-400">(@{sub.username})</span> : null}
                            </div>
                            <div className="text-[10px] text-stone-500 uppercase">
                              {sub.source || 'mini_app'}
                            </div>
                          </td>

                          {/* Clean Read-Only Phone with Edit Button */}
                          <td className="py-2.5 px-3">
                            {!isEditingPhone ? (
                              <div className="flex items-center gap-1.5">
                                <Phone className="w-3 h-3 text-stone-400 shrink-0" />
                                <span className="font-mono text-stone-200">
                                  {sub.customerPhone || <span className="text-stone-500">—</span>}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setEditingPhones((prev) => ({
                                      ...prev,
                                      [sub.chatId]: sub.customerPhone || '',
                                    }));
                                    setEditingCustomerRowId(sub.chatId);
                                  }}
                                  className="p-1 rounded hover:bg-white/10 text-stone-400 hover:text-[#C8A951]"
                                  title="Edit Phone"
                                >
                                  <Edit3 className="w-3 h-3" />
                                </button>
                              </div>
                            ) : (
                              <div className="flex items-center gap-1">
                                <input
                                  type="text"
                                  value={currentPhoneVal}
                                  onChange={(e) =>
                                    setEditingPhones((prev) => ({ ...prev, [sub.chatId]: e.target.value }))
                                  }
                                  placeholder="09-xxxxxxxxx"
                                  className="bg-[#071810] border border-[#C8A951] rounded px-2 py-0.5 text-xs font-mono text-white w-28"
                                />
                                <button
                                  type="button"
                                  onClick={() => handleSaveCustomerPhoneInline(sub)}
                                  className="px-2 py-0.5 rounded bg-emerald-500 text-black text-[10px] font-bold"
                                >
                                  Save
                                </button>
                              </div>
                            )}
                          </td>

                          <td className="py-2.5 px-3">
                            <div className="flex items-center gap-1.5">
                              <span className="font-mono text-emerald-300">{sub.chatId}</span>
                              <button
                                onClick={() => handleCopyChatId(sub.chatId, 'copy_sub')}
                                className="p-1 rounded hover:bg-white/10 text-stone-400 hover:text-white"
                                title="Copy Chat ID"
                              >
                                {btnStates[copySubKey] === 'success' ? (
                                  <Check className="w-3 h-3 text-emerald-400" />
                                ) : (
                                  <Copy className="w-3 h-3" />
                                )}
                              </button>
                            </div>
                          </td>
                          <td className="py-2.5 px-3">
                            <span className="px-2 py-0.5 rounded bg-[#C8A951]/20 text-[#C8A951] text-[10px] font-bold">
                              {sub.vipTier || 'Member'}
                            </span>
                          </td>

                          {/* LIVE LAST NOTIFICATION STATUS & TIME BADGE */}
                          <td className="py-2.5 px-3">
                            {!lastLog ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-white/5 text-stone-400 border border-white/10 text-[10px]">
                                No Noti Yet
                              </span>
                            ) : lastLog.status === 'SUCCESS' ? (
                              <div className="flex flex-col items-start gap-0.5">
                                <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-[10px] font-bold">
                                  <CheckCircle2 className="w-3 h-3 text-emerald-400 shrink-0" />
                                  <span>SENT</span>
                                  {lastLogTimeStr && (
                                    <span className="text-emerald-200/90 font-normal">• {lastLogTimeStr}</span>
                                  )}
                                </div>
                                <span className="text-[9px] text-stone-400 font-mono pl-0.5 truncate max-w-[140px]">
                                  {lastLog.type || 'NOTIFICATION'}
                                </span>
                              </div>
                            ) : (
                              <div className="flex flex-col items-start gap-0.5">
                                <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-red-500/20 text-red-300 border border-red-500/40 text-[10px] font-bold">
                                  <XCircle className="w-3 h-3 text-red-400 shrink-0" />
                                  <span>FAILED</span>
                                  {lastLogTimeStr && (
                                    <span className="text-red-200/90 font-normal">• {lastLogTimeStr}</span>
                                  )}
                                </div>
                                <span className="text-[9px] text-red-300/90 pl-0.5 truncate max-w-[150px]">
                                  {lastLog.errorDetail || 'Failed'}
                                </span>
                              </div>
                            )}
                          </td>

                          <td className="py-2.5 px-3 text-right">
                            <div className="flex items-center justify-end gap-1.5 whitespace-nowrap">
                              <button
                                type="button"
                                onClick={() => handleOpenManualBookingModal(sub)}
                                className={`px-2.5 py-1 rounded text-[11px] font-bold flex items-center gap-1 active:scale-95 transition shadow-sm ${
                                  btnStates[manualBkKey] === 'success'
                                    ? 'bg-emerald-500 text-black'
                                    : 'bg-gradient-to-r from-[#C8A951] to-[#b39136] text-[#071810] hover:brightness-110'
                                }`}
                              >
                                <CalendarPlus className="w-3.5 h-3.5" />
                                {btnStates[manualBkKey] === 'success' ? '✓ Sent' : '+ Manual Booking'}
                              </button>

                              <button
                                onClick={() => handleTestCustomerBookingNoti(sub)}
                                disabled={btnStates[testKey] === 'loading'}
                                className="px-2 py-1 rounded text-[11px] font-semibold bg-emerald-600/30 text-emerald-300 border border-emerald-500/40 hover:bg-emerald-600/50"
                              >
                                {btnStates[testKey] === 'loading' ? '...' : '🔔 Test'}
                              </button>

                              <button
                                onClick={() => handleSendCustomerMenu(sub)}
                                disabled={btnStates[menuKey] === 'loading'}
                                className="px-2 py-1 rounded text-[11px] font-semibold bg-[#C8A951]/20 text-[#C8A951] hover:bg-[#C8A951]/30"
                              >
                                Menu
                              </button>

                              <button
                                onClick={() => handleExcludeOrRemoveSubscriber(sub, 'Removed')}
                                className="p-1.5 rounded bg-red-500/15 text-red-300 hover:bg-red-500/30 border border-red-500/30"
                                title="Remove Subscriber"
                              >
                                <UserX className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* =====================================================================
            TAB 5: MINI APP MENU & BULK PROMO (CLEAN SUMMARY CARDS + EDIT TOGGLE)
        ===================================================================== */}
        {activeTab === 'botflow' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Card 1: Bulk Promotion Broadcast */}
            <div className="bg-black/25 p-4 rounded-xl border border-[#C8A951]/30 space-y-3">
              <div className="flex items-center justify-between border-b border-[#C8A951]/20 pb-2.5">
                <div>
                  <h3 className="text-xs font-bold text-[#C8A951] flex items-center gap-1.5">
                    <Megaphone className="w-4 h-4" />
                    Customer Bulk Promotion
                  </h3>
                  <p className="text-[10px] text-stone-400">{subscribers.length} Subscribed Customers</p>
                </div>
                <button
                  type="button"
                  onClick={() => toggleSectionEdit('promoComposer')}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold flex items-center gap-1 ${
                    editSections.promoComposer
                      ? 'bg-emerald-500 text-black'
                      : 'bg-white/10 text-[#C8A951] hover:bg-white/20'
                  }`}
                >
                  <Edit3 className="w-3 h-3" />
                  {editSections.promoComposer ? 'Close' : 'Compose'}
                </button>
              </div>

              {!editSections.promoComposer ? (
                <div className="space-y-2 text-xs">
                  <div className="bg-[#071810]/80 p-3 rounded-lg border border-white/5">
                    <span className="text-[10px] text-stone-400 block">Headline:</span>
                    <p className="font-bold text-white truncate">{promoTitle}</p>
                    <span className="text-[10px] text-stone-400 block mt-1.5">Target Audience:</span>
                    <p className="text-emerald-300 font-semibold">{promoAudience}</p>
                  </div>
                  <p className="text-[11px] text-stone-400">
                    ပရိုမိုးရှင်းစာသား ရေးသားပြီး ပေးပို့ရန် <b>Compose</b> ခလုတ်ကို နှိပ်ပါ။
                  </p>
                </div>
              ) : (
                <div className="space-y-2.5 text-xs">
                  <select
                    value={promoAudience}
                    onChange={(e) => setPromoAudience(e.target.value as any)}
                    className="w-full bg-[#071810] border border-[#C8A951]/30 rounded-lg px-2.5 py-1.5 text-white"
                  >
                    <option value="ALL">👥 All Subscribed ({subscribers.length})</option>
                    <option value="VIP_ONLY">👑 VIP Members Only</option>
                    <option value="SELECTED">✅ Selected in Tab 4 ({selectedSubIds.length})</option>
                  </select>
                  <input
                    type="text"
                    value={promoTitle}
                    onChange={(e) => setPromoTitle(e.target.value)}
                    placeholder="Promotion Headline"
                    className="w-full bg-[#071810] border border-[#C8A951]/30 rounded-lg px-2.5 py-1.5 text-white"
                  />
                  <input
                    type="text"
                    value={promoImageUrl}
                    onChange={(e) => setPromoImageUrl(e.target.value)}
                    placeholder="Optional Image URL (https://...)"
                    className="w-full bg-[#071810] border border-[#C8A951]/30 rounded-lg px-2.5 py-1.5 text-white"
                  />
                  <textarea
                    rows={3}
                    value={promoMessage}
                    onChange={(e) => setPromoMessage(e.target.value)}
                    placeholder="ပရိုမိုးရှင်း စာသား ရေးသားရန်..."
                    className="w-full bg-[#071810] border border-[#C8A951]/30 rounded-lg px-2.5 py-1.5 text-white"
                  />
                  <button
                    onClick={handleSendCustomerPromoBroadcast}
                    disabled={sendingPromo}
                    className="w-full py-2 rounded-xl bg-[#C8A951] text-[#0B2419] font-bold text-xs"
                  >
                    {sendingPromo ? 'Sending...' : '🚀 Send Promotion Broadcast'}
                  </button>
                </div>
              )}
            </div>

            {/* Card 2: Bot Welcome & Mini App Commands */}
            <div className="bg-black/25 p-4 rounded-xl border border-[#C8A951]/25 space-y-3">
              <div className="flex items-center justify-between border-b border-[#C8A951]/20 pb-2.5">
                <div>
                  <h3 className="text-xs font-bold text-[#C8A951]">🤖 Bot Welcome & Menu</h3>
                  <p className="text-[10px] text-stone-400">Commands: /book, /staff, /available, /vip</p>
                </div>
                <button
                  type="button"
                  onClick={() => toggleSectionEdit('welcomeConfig')}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold flex items-center gap-1 ${
                    editSections.welcomeConfig
                      ? 'bg-emerald-500 text-black'
                      : 'bg-white/10 text-[#C8A951] hover:bg-white/20'
                  }`}
                >
                  <Edit3 className="w-3 h-3" />
                  {editSections.welcomeConfig ? 'Done' : 'Edit'}
                </button>
              </div>

              {!editSections.welcomeConfig ? (
                <div className="space-y-2.5 text-xs">
                  <div className="bg-[#071810]/80 p-3 rounded-lg border border-white/5 text-stone-300 line-clamp-3">
                    {config.botFlow.welcomeMessage}
                  </div>
                  <button
                    onClick={handleSyncBotMenu}
                    className="w-full py-2 rounded-xl bg-[#C8A951]/20 hover:bg-[#C8A951]/30 text-[#C8A951] border border-[#C8A951]/30 font-bold text-xs"
                  >
                    ⚡ Push Menu Icons to Telegram
                  </button>
                </div>
              ) : (
                <div className="space-y-2.5 text-xs">
                  <textarea
                    rows={4}
                    value={config.botFlow.welcomeMessage}
                    onChange={(e) =>
                      setConfig({
                        ...config,
                        botFlow: { ...config.botFlow, welcomeMessage: e.target.value },
                      })
                    }
                    className="w-full bg-[#071810] border border-[#C8A951]/40 rounded-lg px-2.5 py-1.5 text-white"
                  />
                  <button
                    onClick={handleSaveConfig}
                    className="w-full py-2 rounded-xl bg-emerald-500 text-black font-bold text-xs"
                  >
                    💾 Save Welcome Message
                  </button>
                </div>
              )}
            </div>

            {/* Card 3: Staff Announcement */}
            <div className="bg-black/25 p-4 rounded-xl border border-[#C8A951]/25 space-y-3">
              <div className="flex items-center justify-between border-b border-[#C8A951]/20 pb-2.5">
                <div>
                  <h3 className="text-xs font-bold text-[#C8A951]">📢 Staff Announcement</h3>
                  <p className="text-[10px] text-stone-400">Send instant notice to active staff</p>
                </div>
                <button
                  type="button"
                  onClick={() => toggleSectionEdit('staffBroadcast')}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold flex items-center gap-1 ${
                    editSections.staffBroadcast
                      ? 'bg-emerald-500 text-black'
                      : 'bg-white/10 text-[#C8A951] hover:bg-white/20'
                  }`}
                >
                  <Edit3 className="w-3 h-3" />
                  {editSections.staffBroadcast ? 'Close' : 'Write'}
                </button>
              </div>

              {!editSections.staffBroadcast ? (
                <div className="space-y-2 text-xs">
                  <div className="bg-[#071810]/80 p-3 rounded-lg border border-white/5">
                    <span className="text-[10px] text-stone-400 block">Default Title:</span>
                    <p className="font-bold text-white truncate">{broadcastTitle}</p>
                  </div>
                  <p className="text-[11px] text-stone-400">
                    ဝန်ထမ်းများထံ အသိပေးစာပို့ရန် <b>Write</b> ကိုနှိပ်ပါ။
                  </p>
                </div>
              ) : (
                <div className="space-y-2.5 text-xs">
                  <input
                    type="text"
                    value={broadcastTitle}
                    onChange={(e) => setBroadcastTitle(e.target.value)}
                    className="w-full bg-[#071810] border border-[#C8A951]/30 rounded-lg px-2.5 py-1.5 text-white"
                  />
                  <textarea
                    rows={3}
                    value={broadcastBody}
                    onChange={(e) => setBroadcastBody(e.target.value)}
                    placeholder="ဝန်ထမ်းများအားလုံး သိရှိစေရန်..."
                    className="w-full bg-[#071810] border border-[#C8A951]/30 rounded-lg px-2.5 py-1.5 text-white"
                  />
                  <button
                    onClick={handleSendBroadcast}
                    disabled={sendingBroadcast}
                    className="w-full py-2 rounded-xl bg-emerald-500 text-black font-bold text-xs"
                  >
                    {sendingBroadcast ? 'Sending...' : '📢 Send Staff Announcement'}
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 6: DELIVERY LOGS */}
        {activeTab === 'logs' && (
          <div className="space-y-3">
            <h3 className="text-xs font-bold text-[#C8A951]">
              📜 နောက်ဆုံး ပေးပို့ခဲ့သော Telegram Notification မှတ်တမ်းများ (Recent 50 Logs)
            </h3>
            <div className="overflow-x-auto bg-black/25 rounded-xl border border-[#C8A951]/20">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-[#C8A951]/20 text-stone-400">
                    <th className="py-2.5 px-3">Time</th>
                    <th className="py-2.5 px-3">Event Type</th>
                    <th className="py-2.5 px-3">Target Chat ID</th>
                    <th className="py-2.5 px-3">Status</th>
                    <th className="py-2.5 px-3">Details / Error</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {logs.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-6 text-center text-stone-400">
                        Notification မှတ်တမ်း မရှိသေးပါ။
                      </td>
                    </tr>
                  ) : (
                    logs.slice(0, 50).map((log) => (
                      <tr key={log.id} className="hover:bg-white/5">
                        <td className="py-2 px-3 text-stone-400 whitespace-nowrap">
                          {log.timestamp ? new Date(log.timestamp).toLocaleTimeString() : '-'}
                        </td>
                        <td className="py-2 px-3 font-semibold text-[#C8A951]">{log.type}</td>
                        <td className="py-2 px-3 font-mono text-stone-300">{log.targetChatId}</td>
                        <td className="py-2 px-3">
                          {log.status === 'SUCCESS' ? (
                            <span className="inline-flex items-center gap-1 text-emerald-400 font-semibold">
                              <CheckCircle2 className="w-3.5 h-3.5" /> SENT
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-red-400 font-semibold">
                              <XCircle className="w-3.5 h-3.5" /> FAILED
                            </span>
                          )}
                        </td>
                        <td className="py-2 px-3 text-stone-300 max-w-md truncate">
                          {log.errorDetail ? (
                            <span className="text-red-300">{log.errorDetail}</span>
                          ) : (
                            log.summary?.replace(/<[^>]+>/g, '')
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* ============================================================================
          🌟 STEP-BY-STEP CUSTOMER APP MENU, EDIT EXISTING SLOT & BOT SLIP MODAL 🌟
      ============================================================================ */}
      {manualBookingTarget && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-[#0B2419] border-2 border-[#C8A951] rounded-2xl w-full max-w-3xl shadow-2xl overflow-hidden my-auto">
            {/* Modal Header */}
            <div className="px-5 py-4 bg-gradient-to-r from-[#071810] via-[#0B2419] to-[#071810] border-b border-[#C8A951]/30 flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-[#C8A951] flex items-center gap-2">
                  <CalendarPlus className="w-5 h-5" />
                  {editingBookingId
                    ? `✏️ Edit Existing Booking (#${editingBookingId}) & Resend Bot Slip`
                    : 'Customer App Booking Flow & Bot Confirmation Slip'}
                </h3>
                <p className="text-xs text-stone-300 mt-0.5">
                  Customer: <b className="text-white">{manualBookingTarget.customerName}</b>{' '}
                  {manualBookingTarget.username ? `(@${manualBookingTarget.username})` : ''} • Chat ID:{' '}
                  <code className="text-emerald-300 font-mono">{manualBookingTarget.chatId}</code>
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setManualBookingTarget(null);
                  setEditingBookingId(null);
                }}
                className="p-1.5 rounded-lg bg-white/5 hover:bg-white/15 text-stone-300 hover:text-white transition"
              >
                ✕
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 space-y-4 max-h-[80vh] overflow-y-auto text-xs">
              {/* 🌟 QUICK BANNER: EXISTING BOOKINGS FOR THIS CUSTOMER (ONE-CLICK EDIT & RESEND) 🌟 */}
              {customerActiveBookings.length > 0 && (
                <div className="bg-amber-950/40 border border-amber-400/50 rounded-xl p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-amber-300 flex items-center gap-1.5">
                      <RotateCcw className="w-4 h-4" />
                      ဤ Customer ၏ လက်ရှိတင်ထားသော ဘိုကင်များ (အချက်အလက်ပြင်ပြီး အချိန်အတူတူ Noti ပြန်ပို့ရန် နှိပ်ပါ) —
                    </span>
                    {editingBookingId && (
                      <button
                        type="button"
                        onClick={() => setEditingBookingId(null)}
                        className="px-2 py-0.5 rounded bg-white/10 text-stone-200 text-[10px]"
                      >
                        + ဘိုကင်အသစ် သီးသန့်တင်မည်
                      </button>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {customerActiveBookings.map((eb) => {
                      const isCurrentEdit = editingBookingId === String(eb.id || eb.bookingId);
                      return (
                        <div
                          key={eb.id || eb.bookingId}
                          className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-[11px] ${
                            isCurrentEdit
                              ? 'bg-amber-400 text-black border-white font-bold'
                              : 'bg-[#071810] text-stone-200 border-amber-400/40'
                          }`}
                        >
                          <span>
                            #{eb.id} • <b>{eb.therapistId || eb.staffId}</b> • {eb.date} @ <b>{eb.time}</b> (
                            {Number(eb.price || 0).toLocaleString()} Ks)
                          </span>
                          <button
                            type="button"
                            onClick={() => handleLoadExistingBookingForEdit(eb)}
                            className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              isCurrentEdit
                                ? 'bg-black text-amber-300'
                                : 'bg-amber-400/20 text-amber-300 hover:bg-amber-400/30'
                            }`}
                          >
                            {isCurrentEdit ? '✓ Editing Now' : '✏️ Edit & Resend'}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleReleaseBookedSlot(eb)}
                            className="p-1 rounded bg-red-500/20 text-red-300 hover:bg-red-500/40"
                            title="Cancel Booking & Free Time Slot"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* STEP 1: EXACT CUSTOMER APP OFFICIAL MENU SELECTION */}
              <div className="bg-black/30 p-4 rounded-xl border border-[#C8A951]/30 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#C8A951]/20 pb-2.5">
                  <h4 className="font-bold text-[#C8A951] flex items-center gap-1.5 text-xs">
                    <Layers className="w-4 h-4" />
                    အဆင့် (၁) — Customer App Menu မှ ဝန်ဆောင်မှု ရွေးချယ်ရန် ({catalogServices.length} Items Synced) *
                  </h4>
                  <button
                    type="button"
                    onClick={syncExactCustomerAppMenu}
                    className="text-[10px] text-emerald-300 hover:underline flex items-center gap-1"
                  >
                    <RefreshCw className="w-3 h-3" /> Sync Live Menu Prices
                  </button>
                </div>

                {/* Category Filter Pills */}
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
                  {serviceCategories.map((cat) => {
                    const active = mbSelectedCategory === cat;
                    return (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => setMbSelectedCategory(cat)}
                        className={`px-3 py-1.5 rounded-lg text-[11px] font-bold whitespace-nowrap transition ${
                          active
                            ? 'bg-[#C8A951] text-[#071810] shadow'
                            : 'bg-[#071810] text-stone-300 border border-[#C8A951]/25 hover:border-[#C8A951]'
                        }`}
                      >
                        {cat === 'ALL' ? '📋 Menu အားလုံး (All)' : cat}
                      </button>
                    );
                  })}
                </div>

                {/* Menu Cards Grid */}
                {visibleCategoryServices.length === 0 ? (
                  <div className="p-4 text-center text-stone-400 bg-[#071810] rounded-xl border border-white/10">
                    Menu စာရင်း အလွတ်ဖြစ်နေပါသည်။ အောက်ပါကွက်လပ်တွင် ဝန်ဆောင်မှုအမည်နှင့် ဈေးနှုန်း တိုက်ရိုက်ရိုက်ထည့်နိုင်ပါသည်။
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto pr-1">
                    {visibleCategoryServices.map((svc) => {
                      const isSelected = mbSelectedServiceIds.includes(svc.id);
                      return (
                        <button
                          key={svc.id}
                          type="button"
                          onClick={() => handleToggleMenuService(svc)}
                          className={`p-2.5 rounded-xl border text-left transition flex items-start justify-between gap-2 ${
                            isSelected
                              ? 'bg-[#C8A951]/20 border-[#C8A951] text-white shadow-md'
                              : 'bg-[#071810]/90 border-white/10 text-stone-300 hover:border-[#C8A951]/40'
                          }`}
                        >
                          <div className="space-y-0.5">
                            <div className="font-bold text-[11px] leading-snug flex items-center gap-1.5">
                              <span
                                className={`w-4 h-4 rounded flex items-center justify-center text-[10px] shrink-0 ${
                                  isSelected
                                    ? 'bg-[#C8A951] text-[#071810] font-extrabold'
                                    : 'border border-stone-500 text-transparent'
                                }`}
                              >
                                ✓
                              </span>
                              <span>{svc.name}</span>
                            </div>
                            <div className="text-[10px] text-stone-400 pl-5">
                              {svc.category} • ⏳ {svc.duration} Mins
                            </div>
                          </div>
                          <div className="text-right shrink-0">
                            <span className="text-xs font-extrabold text-[#C8A951] font-mono">
                              {Number(svc.price).toLocaleString()}
                            </span>
                            <span className="block text-[9px] text-stone-400">MMK</span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}

                {/* Selected Summary & Optional Custom Service Name Override */}
                <div className="pt-2 border-t border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="text-[11px] text-stone-200">
                    <span className="text-[#C8A951] font-bold">ရွေးထားသည့် Menu: </span>
                    {combinedServiceNames}
                  </div>
                  <input
                    type="text"
                    value={mbCustomServiceName}
                    onChange={(e) => setMbCustomServiceName(e.target.value)}
                    placeholder="+ စိတ်ကြိုက် ဝန်ဆောင်မှုအမည် ရိုက်ထည့်ရန်..."
                    className="bg-[#071810] border border-[#C8A951]/30 rounded-lg px-2.5 py-1 text-[11px] text-white sm:w-64"
                  />
                </div>
              </div>

              {/* STEP 2: SERVICE MODE, ROOM/LOCATION, THERAPIST & CLICKABLE EDITABLE TIME SLOTS */}
              <div className="bg-black/30 p-4 rounded-xl border border-[#C8A951]/30 space-y-3">
                <h4 className="font-bold text-[#C8A951] flex items-center gap-1.5 text-xs border-b border-[#C8A951]/20 pb-2">
                  <Clock className="w-4 h-4" />
                  အဆင့် (၂) — ဝန်ထမ်း နှင့် အချိန် (Time Slot) ရွေးချယ်ရန် (🔒 Booked ဖြစ်နေသော အချိန်ကို နှိပ်၍လည်း ပြန်ပြင်ပြီး Noti ပြန်ပို့နိုင်သည်) *
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[#C8A951] font-semibold mb-1 flex items-center gap-1">
                      <Phone className="w-3.5 h-3.5" /> Customer ဖုန်းနံပါတ်
                    </label>
                    <input
                      type="text"
                      value={mbPhone}
                      onChange={(e) => setMbPhone(e.target.value)}
                      placeholder="09-xxxxxxxxx"
                      className="w-full bg-[#071810] border border-[#C8A951]/30 rounded-lg px-3 py-2 text-white font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-[#C8A951] font-semibold mb-1 flex items-center gap-1">
                      <MapPin className="w-3.5 h-3.5" /> Service အမျိုးအစား
                    </label>
                    <select
                      value={mbBookingType}
                      onChange={(e) => {
                        const val = e.target.value as any;
                        setMbBookingType(val);
                        if (val === 'in_spa') {
                          setMbRoomOrLocation('VIP Private Suite');
                        } else if (val === 'outcall_hotel') {
                          setMbRoomOrLocation('Hotel Outcall (ဟိုတယ်အမည်/အခန်းနံပါတ်)');
                        } else if (val === 'outcall_home') {
                          setMbRoomOrLocation('Home Outcall (အိမ်လိပ်စာ)');
                        } else if (val === 'half_day') {
                          setMbRoomOrLocation('Half-Day Outcall');
                        } else if (val === 'night_call') {
                          setMbTime('08:00 PM');
                          setMbRoomOrLocation('Whole Night Outcall (Hotel / Home)');
                        }
                      }}
                      className="w-full bg-[#071810] border border-[#C8A951]/30 rounded-lg px-3 py-2 text-white"
                    >
                      <option value="in_spa">🏢 In-Spa Retreat (ဆိုင်တွင်လာရောက်မည်)</option>
                      <option value="outcall_hotel">🏨 Hotel Outcall (ဟိုတယ်သို့ခေါ်ယူမည်)</option>
                      <option value="outcall_home">🏠 Home Outcall (အိမ်သို့ခေါ်ယူမည်)</option>
                      <option value="half_day">🌤️ Half-Day Outcall (6 Hours)</option>
                      <option value="night_call">🌙 Whole Night Call (8PM - 8AM)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[#C8A951] font-semibold mb-1">
                      📍 အခန်းအမည် / ဟိုတယ်လိပ်စာ
                    </label>
                    <input
                      type="text"
                      value={mbRoomOrLocation}
                      onChange={(e) => setMbRoomOrLocation(e.target.value)}
                      placeholder="VIP Suite 1 / Hotel Hazel Rm 305"
                      className="w-full bg-[#071810] border border-[#C8A951]/30 rounded-lg px-3 py-2 text-white"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  <div>
                    <label className="block text-[#C8A951] font-semibold mb-1">
                      👨‍💼 တာဝန်ကျ ဝန်ထမ်း ရွေးချယ်ရန် (Active Staff) *
                    </label>
                    <select
                      value={mbStaffId}
                      onChange={(e) => {
                        setMbStaffId(e.target.value);
                        setMbTime('');
                      }}
                      className="w-full bg-[#071810] border border-[#C8A951]/30 rounded-lg px-3 py-2 text-white font-semibold"
                    >
                      {config.staffMappings.map((st) => {
                        const hrMeta = staffHrMeta[st.staffId];
                        const stStatus = therapistStatuses[st.staffId] || 'available';
                        const isOff = stStatus.includes('off') || stStatus.includes('leave');
                        return (
                          <option key={st.staffId} value={st.staffId}>
                            {st.staffId} — {st.staffName} {hrMeta?.actualName ? `(${hrMeta.actualName})` : ''}{' '}
                            {isOff ? ' [⚠️ OFF/LEAVE]' : ' [🟢 ACTIVE]'}
                          </option>
                        );
                      })}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[#C8A951] font-semibold mb-1">
                      📅 ဘိုကင်နေ့ရက် (Booking Date) *
                    </label>
                    <input
                      type="date"
                      value={mbDate}
                      onChange={(e) => {
                        setMbDate(e.target.value);
                        setMbTime('');
                      }}
                      className="w-full bg-[#071810] border border-[#C8A951]/30 rounded-lg px-3 py-2 text-white"
                    />
                  </div>
                </div>

                {/* Real-Time Conflict Time Slots (Booked Slots are Clickable to Edit & Resend!) */}
                <div className="pt-1 space-y-1.5">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-stone-300">
                      ⏰ <b>{mbStaffId}</b> ၏ <b>{mbDate}</b> ရက်နေ့ အချိန်ဇယား (အနီရောင် <b>Booked</b> အချိန်ကို နှိပ်ပါက အဆိုပါဘိုကင်ကို ပြန်ပြင်ပြီး Noti ပြန်ပို့နိုင်ပါသည်) —
                    </span>
                    <span className="text-stone-400">
                      ကြာချိန်: <b className="text-emerald-300">{calculatedDurationMins} Mins</b>
                    </span>
                  </div>
                  <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
                    {MANUAL_TIME_SLOTS.map((slot) => {
                      const conflict = checkStaffSlotConflict(
                        mbStaffId,
                        mbDate,
                        slot,
                        calculatedDurationMins,
                        editingBookingId
                      );
                      const isSelected = mbTime === slot;

                      return (
                        <button
                          key={slot}
                          type="button"
                          onClick={() => {
                            if (conflict.isBooked && conflict.conflictingBooking) {
                              // Clicking a Booked slot loads that booking into Edit & Resend mode!
                              handleLoadExistingBookingForEdit(conflict.conflictingBooking);
                            } else {
                              setMbTime(slot);
                            }
                          }}
                          className={`py-2 px-1.5 rounded-lg text-[11px] font-bold border transition flex flex-col items-center justify-center ${
                            conflict.isBooked
                              ? 'bg-red-950/60 border-red-500/50 text-red-200 hover:bg-amber-500/20 hover:border-amber-400 cursor-pointer'
                              : isSelected
                              ? 'bg-[#C8A951] border-white text-[#071810] shadow-md scale-[1.02]'
                              : 'bg-[#071810] border-[#C8A951]/30 text-stone-200 hover:border-[#C8A951]'
                          }`}
                          title={
                            conflict.isBooked
                              ? `Booked (${conflict.conflictDetail}) — နှိပ်၍ ဤဘိုကင်ကို ပြန်ပြင်ပြီး Noti ပြန်ပို့နိုင်သည်`
                              : 'Available'
                          }
                        >
                          <span>{slot}</span>
                          {conflict.isBooked ? (
                            <span className="text-[9px] text-amber-300 font-semibold truncate max-w-full">
                              🔒 Booked (✏️ ပြင်ရန်နှိပ်ပါ)
                            </span>
                          ) : (
                            <span
                              className={`text-[9px] font-normal ${
                                isSelected ? 'text-[#071810] font-semibold' : 'text-emerald-400'
                              }`}
                            >
                              {isSelected ? (editingBookingId ? '✓ Editing Slot' : '✓ Selected') : '🟢 Free'}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* STEP 3: DISCOUNT (YES/NO), PAYMENT METHOD, DEPOSIT & REMAINING BALANCE */}
              <div className="bg-gradient-to-br from-[#071810] to-black/60 p-4 rounded-xl border border-[#C8A951]/40 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#C8A951]/20 pb-2.5">
                  <h4 className="font-bold text-[#C8A951] flex items-center gap-1.5 text-xs">
                    <Wallet className="w-4 h-4" />
                    အဆင့် (၃) — Discount လျှော့မည်/မလျှော့မည်၊ စရံငွေ (Deposit) နှင့် ကျန်ငွေ တွက်ချက်မှု
                  </h4>

                  <div className="flex items-center gap-1.5 bg-black/40 p-1 rounded-xl border border-[#C8A951]/30">
                    <button
                      type="button"
                      onClick={() => setMbApplyDiscount(false)}
                      className={`px-3 py-1 rounded-lg text-[11px] font-bold transition ${
                        !mbApplyDiscount
                          ? 'bg-stone-700 text-white shadow'
                          : 'text-stone-400 hover:text-white'
                      }`}
                    >
                      ✕ Discount မလျှော့ပါ
                    </button>
                    <button
                      type="button"
                      onClick={() => setMbApplyDiscount(true)}
                      className={`px-3 py-1 rounded-lg text-[11px] font-bold flex items-center gap-1 transition ${
                        mbApplyDiscount
                          ? 'bg-emerald-500 text-black shadow'
                          : 'text-emerald-300 hover:bg-emerald-500/10'
                      }`}
                    >
                      <Tag className="w-3 h-3" /> ✓ Discount လျှော့ပေးမည်
                    </button>
                  </div>
                </div>

                {mbApplyDiscount && (
                  <div className="bg-emerald-950/30 border border-emerald-500/40 rounded-xl p-3 space-y-2.5">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-[11px] font-bold text-emerald-300 flex items-center gap-1">
                        <Tag className="w-3.5 h-3.5" /> Discount အမျိုးအစားနှင့် ပမာဏ ရွေးချယ်ရန် —
                      </span>
                      <div className="flex flex-wrap items-center gap-1">
                        {[
                          { label: '5% Off', mode: 'PERCENT' as const, val: 5 },
                          { label: '10% (VIP)', mode: 'PERCENT' as const, val: 10 },
                          { label: '15% (VIP)', mode: 'PERCENT' as const, val: 15 },
                          { label: '20% (V-VIP)', mode: 'PERCENT' as const, val: 20 },
                          { label: '-5,000 Ks', mode: 'FIXED' as const, val: 5000 },
                          { label: '-10,000 Ks', mode: 'FIXED' as const, val: 10000 },
                        ].map((preset) => (
                          <button
                            key={preset.label}
                            type="button"
                            onClick={() => {
                              setMbDiscountMode(preset.mode);
                              setMbDiscountValue(preset.val);
                            }}
                            className={`px-2 py-0.5 rounded text-[10px] font-bold border transition ${
                              mbDiscountMode === preset.mode && mbDiscountValue === preset.val
                                ? 'bg-emerald-400 text-black border-white'
                                : 'bg-black/40 text-emerald-200 border-emerald-500/30 hover:bg-emerald-500/20'
                            }`}
                          >
                            {preset.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                      <div>
                        <label className="block text-[10px] text-stone-300 mb-1">Discount စနစ်</label>
                        <select
                          value={mbDiscountMode}
                          onChange={(e) => setMbDiscountMode(e.target.value as 'PERCENT' | 'FIXED')}
                          className="w-full bg-[#071810] border border-emerald-500/40 rounded-lg px-2.5 py-1.5 text-white font-semibold"
                        >
                          <option value="PERCENT">ရာခိုင်နှုန်းဖြင့် (% Off)</option>
                          <option value="FIXED">ကျပ်ငွေပမာဏဖြင့် (Fixed MMK)</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-[10px] text-stone-300 mb-1">
                          {mbDiscountMode === 'PERCENT' ? 'လျှော့မည့် ရာခိုင်နှုန်း (%)' : 'လျှော့မည့် ငွေပမာဏ (MMK)'}
                        </label>
                        <input
                          type="number"
                          min={0}
                          value={mbDiscountValue}
                          onChange={(e) => setMbDiscountValue(Math.max(0, Number(e.target.value) || 0))}
                          className="w-full bg-[#071810] border border-emerald-500/40 rounded-lg px-2.5 py-1.5 text-emerald-300 font-mono font-bold"
                        />
                      </div>

                      <div>
                        <label className="block text-[10px] text-stone-300 mb-1">
                          လျှော့ပေးသည့် အကြောင်းရင်း (Optional)
                        </label>
                        <input
                          type="text"
                          value={mbDiscountReason}
                          onChange={(e) => setMbDiscountReason(e.target.value)}
                          placeholder="ဥပမာ - VIP Member / Promo"
                          className="w-full bg-[#071810] border border-emerald-500/40 rounded-lg px-2.5 py-1.5 text-white"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* Main Financial Inputs Row */}
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                  <div>
                    <label className="block text-[11px] text-stone-300 mb-1">
                      မူရင်းကျသင့်ငွေ (Subtotal MMK)
                    </label>
                    <input
                      type="number"
                      min={0}
                      step={1000}
                      value={mbSubtotalPrice}
                      onChange={(e) => setMbSubtotalPrice(Math.max(0, Number(e.target.value) || 0))}
                      className="w-full bg-[#0B2419] border border-[#C8A951]/30 rounded-lg px-2.5 py-2 text-white font-mono font-bold"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] text-[#C8A951] font-semibold mb-1">
                      အသားတင်ကျသင့်ငွေ (Net Total)
                    </label>
                    <div className="w-full bg-black/50 border border-[#C8A951]/50 rounded-lg px-2.5 py-2 text-[#C8A951] font-mono font-extrabold flex items-center justify-between">
                      <span>{calculatedNetTotal.toLocaleString()}</span>
                      <span className="text-[10px] text-stone-400">Ks</span>
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-[11px] text-emerald-300 font-semibold">
                        လွှဲထားသော စရံငွေ (Deposit)
                      </label>
                      <div className="flex gap-1">
                        {[
                          { l: '0', r: 0 },
                          { l: '50%', r: 0.5 },
                          { l: '100%', r: 1 },
                        ].map((p) => (
                          <button
                            key={p.l}
                            type="button"
                            onClick={() => setMbDepositAmount(Math.round(calculatedNetTotal * p.r))}
                            className="px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-300 text-[9px] font-bold hover:bg-emerald-500/40"
                          >
                            {p.l}
                          </button>
                        ))}
                      </div>
                    </div>
                    <input
                      type="number"
                      min={0}
                      step={1000}
                      value={mbDepositAmount}
                      onChange={(e) => setMbDepositAmount(Math.max(0, Number(e.target.value) || 0))}
                      className="w-full bg-[#0B2419] border border-emerald-500/50 rounded-lg px-2.5 py-2 text-emerald-300 font-mono font-bold"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] text-amber-300 font-semibold mb-1">
                      ထပ်ရှင်းရန် ကျန်ငွေ (Balance)
                    </label>
                    <div className="w-full bg-black/50 border border-amber-400/50 rounded-lg px-2.5 py-2 text-amber-300 font-mono font-extrabold flex items-center justify-between">
                      <span>{computedRemainingBalance.toLocaleString()}</span>
                      <span className="text-[10px] text-stone-400">Ks</span>
                    </div>
                  </div>
                </div>

                {/* Payment Method, Ref & Special Note */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[11px] text-stone-300 mb-1">ငွေပေးချေသည့် နည်းလမ်း</label>
                    <select
                      value={mbPaymentMethod}
                      onChange={(e) => setMbPaymentMethod(e.target.value)}
                      className="w-full bg-[#0B2419] border border-[#C8A951]/30 rounded-lg px-2.5 py-1.5 text-white font-semibold"
                    >
                      {PAYMENT_METHODS.map((pm) => (
                        <option key={pm} value={pm}>
                          {pm}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] text-stone-300 mb-1">
                      ပြေစာအမှတ်စဉ် (Last 4/6 Digits - Optional)
                    </label>
                    <input
                      type="text"
                      value={mbPaymentRef}
                      onChange={(e) => setMbPaymentRef(e.target.value)}
                      placeholder="e.g. 948210"
                      className="w-full bg-[#0B2419] border border-[#C8A951]/25 rounded-lg px-3 py-1.5 text-xs text-white font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] text-stone-300 mb-1">အထူးမှတ်ချက် (Special Note)</label>
                    <input
                      type="text"
                      value={mbNotes}
                      onChange={(e) => setMbNotes(e.target.value)}
                      placeholder="ဥပမာ - Carebeau Oil / အခန်းအေးအေးလေး"
                      className="w-full bg-[#0B2419] border border-[#C8A951]/25 rounded-lg px-3 py-1.5 text-xs text-white"
                    />
                  </div>
                </div>

                {/* Live Receipt Preview Bar */}
                <div className="flex flex-wrap items-center justify-between gap-2 bg-emerald-950/40 border border-emerald-500/30 rounded-lg px-3.5 py-2 text-[11px]">
                  <span className="text-stone-300">
                    မူရင်းဈေး: <b className="text-white">{rawSubtotal.toLocaleString()} Ks</b>
                  </span>
                  <span className="text-emerald-300">
                    Discount: <b>-{calculatedDiscountAmount.toLocaleString()} Ks</b>
                  </span>
                  <span className="text-[#C8A951] font-bold">
                    အသားတင်: {calculatedNetTotal.toLocaleString()} Ks
                  </span>
                  <span className="text-emerald-300">
                    စရံ ({mbPaymentMethod}): <b>{calculatedDeposit.toLocaleString()} Ks</b>
                  </span>
                  <span className="text-amber-300 font-extrabold">
                    ကျန်ငွေ: {computedRemainingBalance.toLocaleString()} Ks
                  </span>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-5 py-3.5 bg-[#071810] border-t border-[#C8A951]/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="text-[11px] text-stone-400">
                {editingBookingId ? (
                  <span className="text-amber-300 font-semibold">
                    ✏️ Booking #{editingBookingId} ({mbStaffId} • {mbTime}) ကို ပြင်ဆင်ပြီး Customer ထံ Slip အသစ် ပြန်ပို့ပါမည်။
                  </span>
                ) : (
                  <span>
                    Confirm နှိပ်လိုက်သည်နှင့် <b>{mbStaffId}</b> ၏ <b>{mbTime || '...'}</b> Time Slot ကို Lock ချပြီး Bot Slip ပို့ပေးပါမည်။
                  </span>
                )}
              </div>
              <div className="flex items-center justify-end gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    setManualBookingTarget(null);
                    setEditingBookingId(null);
                  }}
                  className="px-4 py-2 rounded-xl border border-stone-600 text-stone-300 hover:bg-white/5 text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={isSubmittingManualBooking || !mbTime}
                  onClick={handleConfirmAndSendManualBooking}
                  className={`px-5 py-2 rounded-xl font-bold text-xs flex items-center gap-2 active:scale-95 transition shadow-lg ${
                    !mbTime
                      ? 'bg-stone-700 text-stone-400 cursor-not-allowed'
                      : editingBookingId
                      ? 'bg-gradient-to-r from-amber-400 to-amber-500 text-black'
                      : 'bg-gradient-to-r from-emerald-500 to-emerald-600 text-black'
                  }`}
                >
                  {isSubmittingManualBooking ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      Sending...
                    </>
                  ) : editingBookingId ? (
                    <>
                      <RotateCcw className="w-4 h-4" />
                      Update Booking & Resend Bot Slip
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      Confirm Booking & Send Bot Slip
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TelegramNotificationCenter;
