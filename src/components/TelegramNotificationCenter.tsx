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
} from 'lucide-react';
import { collection, doc, query, orderBy, limit, onSnapshot, getDocs, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { decryptText } from '../security';
import {
  TelegramBotConfig,
  StaffTelegramMapping,
  CustomerTelegramSubscriber,
  DEFAULT_TELEGRAM_CONFIG,
  getTelegramConfig,
  saveTelegramConfig,
  sendRawTelegramMessage,
  notifyBookingEvent,
  notifyCustomerBookingStatus,
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

// 🌟 Default Fallback Services (Firestore တွင် services မရှိသေးပါက အသုံးပြုရန်) 🌟
const FALLBACK_SERVICES = [
  { id: 'svc-aroma-60', name: 'Shangri-La Signature Aromatherapy (60 Mins)', duration: 60, price: 50000 },
  { id: 'svc-aroma-90', name: 'Shangri-La Signature Aromatherapy (90 Mins)', duration: 90, price: 70000 },
  { id: 'svc-royal-90', name: 'Imperial Royal Package (Massage + Scrub)', duration: 90, price: 85000 },
  { id: 'svc-wax-body', name: 'Full Body Grooming & Waxing Care', duration: 60, price: 60000 },
  { id: 'svc-half-day', name: 'Half-Day Retreat / Outcall Package (6 Hrs)', duration: 360, price: 90000 },
  { id: 'svc-night-call', name: 'Whole Night Outcall Service (8PM - 8AM)', duration: 720, price: 120000 },
];

// 🌟 Standard Time Slots (Day & Night Support) 🌟
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

type ButtonFeedbackState = 'idle' | 'loading' | 'success' | 'error';

export const TelegramNotificationCenter: React.FC = () => {
  const [config, setConfig] = useState<TelegramBotConfig>(DEFAULT_TELEGRAM_CONFIG);
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<
    'setup' | 'triggers' | 'staff' | 'customers' | 'botflow' | 'logs'
  >('setup');
  const [showToken, setShowToken] = useState<boolean>(false);
  const [statusBanner, setStatusBanner] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

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
  const [broadcastTarget, setBroadcastTarget] = useState<'ALL' | 'ADMIN' | 'STAFF_GROUP'>('ALL');
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

  // Logs State (Expanded to 200 to map per-customer latest delivery status accurately)
  const [logs, setLogs] = useState<any[]>([]);

  // ============================================================================
  // 🌟 QUICK MANUAL BOOKING & REAL-TIME CONFLICT ENGINE STATES 🌟
  // ============================================================================
  const [liveBookings, setLiveBookings] = useState<any[]>([]);
  const [catalogServices, setCatalogServices] = useState<any[]>(FALLBACK_SERVICES);
  const [therapistStatuses, setTherapistStatuses] = useState<Record<string, string>>({});

  const [manualBookingTarget, setManualBookingTarget] = useState<CustomerTelegramSubscriber | null>(null);
  const [mbPhone, setMbPhone] = useState<string>('');
  const [mbServiceId, setMbServiceId] = useState<string>(FALLBACK_SERVICES[0].id);
  const [mbCustomServiceName, setMbCustomServiceName] = useState<string>('');
  const [mbStaffId, setMbStaffId] = useState<string>('No. 1');
  const [mbDate, setMbDate] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [mbTime, setMbTime] = useState<string>('');
  const [mbBookingType, setMbBookingType] = useState<'in_spa' | 'outcall_hotel' | 'outcall_home' | 'half_day' | 'night_call'>('in_spa');
  const [mbRoomOrLocation, setMbRoomOrLocation] = useState<string>('VIP Private Suite');
  const [mbTotalPrice, setMbTotalPrice] = useState<number>(FALLBACK_SERVICES[0].price);
  const [mbPaymentMethod, setMbPaymentMethod] = useState<string>('KBZPay');
  const [mbDepositAmount, setMbDepositAmount] = useState<number>(0);
  const [mbPaymentRef, setMbPaymentRef] = useState<string>('');
  const [mbNotes, setMbNotes] = useState<string>('');
  const [isSubmittingManualBooking, setIsSubmittingManualBooking] = useState<boolean>(false);

  const showToast = (type: 'success' | 'error', text: string) => {
    setStatusBanner({ type, text });
    setTimeout(() => setStatusBanner(null), 4500);
  };

  // 🌟 Build Per-ChatId Latest Notification Status Map from Real-Time Logs 🌟
  const latestNotiByChatId = React.useMemo(() => {
    const map: Record<string, any> = {};
    for (const log of logs) {
      const cid = String(log.targetChatId || '').trim();
      if (!cid) continue;
      // Since `logs` is ordered by `timestamp desc`, the first match is the latest notification
      if (!map[cid]) {
        map[cid] = log;
      }
    }
    return map;
  }, [logs]);

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

      // Load Services from Firestore if available
      try {
        const svcSnap = await getDocs(collection(db, 'services'));
        const loadedSvcs: any[] = [];
        svcSnap.forEach((docSnap) => {
          const d = docSnap.data();
          const name = String(d.name || d.title || '').trim();
          if (!name || name.toLowerCase().includes('test')) return;
          loadedSvcs.push({
            id: docSnap.id,
            name,
            duration: parseDurationToMinutes(d.duration || 60),
            price: Number(d.price || d.amount || 50000),
          });
        });
        if (loadedSvcs.length > 0) {
          setCatalogServices(loadedSvcs);
        }
      } catch {
        // Keep FALLBACK_SERVICES
      }

      await loadSubscribers();
      setLoading(false);
    };
    loadData();

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

    // Fetch up to 200 recent logs so every subscribed customer's latest noti status is available
    const q = query(collection(db, 'telegramLogs'), orderBy('timestamp', 'desc'), limit(200));
    const unsubLogs = onSnapshot(
      q,
      (snap) => {
        setLogs(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      },
      (err) => console.warn('Telegram logs listener error:', err)
    );

    return () => {
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
  // 🌟 REAL-TIME STAFF TIME-SLOT CONFLICT CHECKER & MANUAL BOOKING HANDLERS 🌟
  // ============================================================================

  const checkStaffSlotConflict = (
    staffId: string,
    dateStr: string,
    candidateTime: string,
    candidateDurationMins: number
  ): { isBooked: boolean; conflictDetail?: string } => {
    if (!staffId || !dateStr || !candidateTime) return { isBooked: false };

    const targetStaffNum = extractStaffNumber(staffId);
    const candStart = parseTimeToMinutes(candidateTime);
    if (candStart < 0) return { isBooked: false };
    const candEnd = candStart + candidateDurationMins;

    let allBookings = [...liveBookings];
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

    for (const b of allBookings) {
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
        };
      }
    }

    return { isBooked: false };
  };

  const handleOpenManualBookingModal = (sub: CustomerTelegramSubscriber) => {
    setManualBookingTarget(sub);
    const cleanPhone =
      sub.customerPhone && !sub.customerPhone.includes('xxxx') ? sub.customerPhone.trim() : '';
    setMbPhone(cleanPhone);

    const firstSvc = catalogServices[0] || FALLBACK_SERVICES[0];
    setMbServiceId(firstSvc.id);
    setMbCustomServiceName('');
    setMbTotalPrice(Number(firstSvc.price || 50000));

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

  const handleConfirmAndSendManualBooking = async () => {
    if (!manualBookingTarget) return;

    if (!mbStaffId || !mbDate || !mbTime) {
      showToast('error', '❌ ကျေးဇူးပြု၍ ဝန်ထမ်း၊ နေ့ရက် နှင့် အချိန် (Time Slot) အပြည့်အစုံ ရွေးချယ်ပေးပါ။');
      return;
    }

    const selectedService =
      catalogServices.find((s) => String(s.id) === String(mbServiceId)) || FALLBACK_SERVICES[0];
    const finalServiceName =
      mbServiceId === 'custom'
        ? mbCustomServiceName.trim() || 'Custom Retreat Package'
        : selectedService.name;
    const durationMins =
      mbBookingType === 'half_day'
        ? 360
        : mbBookingType === 'night_call'
        ? 720
        : parseDurationToMinutes(selectedService?.duration || 60);

    const conflict = checkStaffSlotConflict(mbStaffId, mbDate, mbTime, durationMins);
    if (conflict.isBooked) {
      showToast(
        'error',
        `⛔ ရွေးချယ်ထားသော ဝန်ထမ်း (${mbStaffId}) သည် ${mbDate} (${mbTime}) တွင် ဘိုကင်ရှိနှင့်ပြီးသား ဖြစ်နေပါသည် (${conflict.conflictDetail})။`
      );
      return;
    }

    const selectedStaffMapping = config.staffMappings.find((s) => s.staffId === mbStaffId);
    const staffDisplayName = selectedStaffMapping?.staffName || `Therapist ${mbStaffId}`;

    const totalPrice = Math.max(0, Number(mbTotalPrice) || 0);
    const depositPaid = Math.min(totalPrice, Math.max(0, Number(mbDepositAmount) || 0));
    const remainingBalance = Math.max(0, totalPrice - depositPaid);

    const paymentStatusLabel =
      depositPaid <= 0
        ? 'UNPAID (ဆိုင်ရောက်မှရှင်းရန်)'
        : remainingBalance === 0
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

    const bookingId = `BK-${Date.now().toString().slice(-6)}`;
    const finalPhone = mbPhone.trim() || manualBookingTarget.customerPhone || `TG-${manualBookingTarget.chatId}`;
    const isOutcall = mbBookingType !== 'in_spa';

    setIsSubmittingManualBooking(true);
    const btnKey = `manual_bk_${manualBookingTarget.chatId}`;
    setButtonFeedback(btnKey, 'loading');

    try {
      const paymentSummaryNote =
        `[Payment: ${mbPaymentMethod} | စရံပေးချေပြီး: ${depositPaid.toLocaleString()} Ks | ကျန်ငွေ: ${remainingBalance.toLocaleString()} Ks` +
        `${mbPaymentRef.trim() ? ` | Ref: ${mbPaymentRef.trim()}` : ''}]`;

      const combinedNotes = [
        `[Telegram Manual Booking] ${bookingTypeLabel}`,
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
        serviceId: selectedService?.id || mbServiceId,
        serviceName: finalServiceName,
        duration: durationMins,
        price: totalPrice,
        totalAmount: totalPrice,
        paymentMethod: mbPaymentMethod,
        depositAmount: depositPaid,
        advancePaid: depositPaid,
        remainingBalance: remainingBalance,
        balanceDue: remainingBalance,
        paymentReference: mbPaymentRef.trim() || '',
        paymentStatus: depositPaid >= totalPrice ? 'paid' : depositPaid > 0 ? 'deposit_paid' : 'unpaid',
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
        createdAt: new Date().toISOString(),
        confirmedAt: new Date().toISOString(),
        updatedBy: 'Admin (Telegram Manual Booking)',
      };

      await setDoc(doc(db, 'bookings', bookingId), bookingRecord, { merge: true });

      try {
        const localRaw = localStorage.getItem('shangrila_bookings');
        if (localRaw) {
          const parsed = JSON.parse(localRaw);
          if (Array.isArray(parsed)) {
            localStorage.setItem('shangrila_bookings', JSON.stringify([bookingRecord, ...parsed]));
          }
        }
      } catch {
        // ignore
      }

      await saveCustomerTelegramSubscription(
        {
          ...manualBookingTarget,
          customerPhone: mbPhone.trim() || manualBookingTarget.customerPhone || '',
          lastBookingId: bookingId,
        },
        true
      );
      await loadSubscribers();

      const customerSlipHtml =
        `🌿 <b>THE SHANGRI-LA MEN'S RETREAT</b>\n` +
        `✅ <b>BOOKING CONFIRMED (ဘိုကင်အတည်ပြုပြီး)</b>\n` +
        `━━━━━━━━━━━━━━━━━━━━\n` +
        `🆔 <b>Booking ID:</b> <code>#${bookingId}</code>\n` +
        `👤 <b>Customer:</b> ${bookingRecord.customerName}\n` +
        `📞 <b>Phone:</b> ${finalPhone}\n` +
        `💆‍♂️ <b>Service:</b> ${finalServiceName} (${durationMins} Mins)\n` +
        `🏷️ <b>Service Type:</b> ${bookingTypeLabel}\n` +
        `👨‍💼 <b>Therapist:</b> ${staffDisplayName} (${mbStaffId})\n` +
        `📅 <b>Date:</b> ${mbDate}\n` +
        `⏰ <b>Time:</b> <b>${mbTime}</b>\n` +
        `📍 <b>Room / Location:</b> ${bookingRecord.roomName}\n` +
        `━━━━━━━━━━━━━━━━━━━━\n` +
        `💳 <b>PAYMENT & BALANCE SUMMARY</b>\n` +
        `• <b>ငွေပေးချေမှုစနစ်:</b> ${mbPaymentMethod}${mbPaymentRef.trim() ? ` (Ref: ${mbPaymentRef.trim()})` : ''}\n` +
        `• <b>စုစုပေါင်းကျသင့်ငွေ:</b> ${totalPrice.toLocaleString()} MMK\n` +
        `• <b>ပေးချေပြီး စရံငွေ (Deposit):</b> ${depositPaid.toLocaleString()} MMK\n` +
        `• <b>ကျန်ငွေ (Remaining Balance):</b> <b>${remainingBalance.toLocaleString()} MMK</b>\n` +
        `• <b>Payment Status:</b> ${paymentStatusLabel}\n` +
        (mbNotes.trim() ? `📝 <b>မှတ်ချက်:</b> ${mbNotes.trim()}\n` : '') +
        `━━━━━━━━━━━━━━━━━━━━\n` +
        `💛 လူကြီးမင်း၏ ဘိုကင်ကို အတည်ပြုသိမ်းဆည်းပြီးဖြစ်ပါသည်။ သတ်မှတ်ချိန်ထက် (၁၀) မိနစ်ခန့် ကြိုတင်ရောက်ရှိပေးပါရန် မေတ္တာရပ်ခံအပ်ပါသည်ခင်ဗျာ။\n` +
        `📍 33th(B) St, Between 65th & 65th(A) Sts, Chan Aye Tharzan Tsp, Mandalay\n` +
        `☎️ 09-458884517, 09-770072190`;

      const customerSendRes = await sendRawTelegramMessage(
        config.botToken,
        manualBookingTarget.chatId,
        customerSlipHtml,
        undefined,
        'MANUAL_BOOKING_CONFIRMED'
      );

      await notifyBookingEvent('BOOKING_CONFIRMED', {
        id: bookingId,
        customerName: bookingRecord.customerName,
        customerPhone: finalPhone,
        serviceName: finalServiceName,
        duration: durationMins,
        price: totalPrice,
        date: mbDate,
        time: mbTime,
        therapistId: mbStaffId,
        therapistName: staffDisplayName,
        roomName: bookingRecord.roomName,
        vipTier: bookingRecord.vipTier,
        status: 'confirmed',
        notes: combinedNotes,
        updatedBy: 'Admin Manual Booking Console',
      }).catch(() => {});

      if (selectedStaffMapping?.telegramChatId && selectedStaffMapping.receiveBookingAssign) {
        const staffAlertHtml =
          `🔔 <b>NEW CONFIRMED BOOKING ASSIGNED</b>\n` +
          `━━━━━━━━━━━━━━━━━━━━\n` +
          `🆔 <b>Booking ID:</b> <code>#${bookingId}</code>\n` +
          `👨‍💼 <b>Assigned To:</b> ${staffDisplayName} (${mbStaffId})\n` +
          `👤 <b>Customer:</b> ${bookingRecord.customerName}\n` +
          `💆‍♂️ <b>Service:</b> ${finalServiceName} (${durationMins} Mins)\n` +
          `📅 <b>Date & Time:</b> ${mbDate} @ <b>${mbTime}</b>\n` +
          `📍 <b>Location:</b> ${bookingRecord.roomName}\n` +
          `💵 <b>Total:</b> ${totalPrice.toLocaleString()} Ks (စရံ: ${depositPaid.toLocaleString()} Ks | ကောက်ခံရန်ကျန်ငွေ: <b>${remainingBalance.toLocaleString()} Ks</b> - ${mbPaymentMethod})`;

        await sendRawTelegramMessage(
          config.botToken,
          selectedStaffMapping.telegramChatId,
          staffAlertHtml,
          undefined,
          'STAFF_MANUAL_ASSIGN'
        ).catch(() => {});
      }

      setButtonFeedback(btnKey, 'success', 3000);
      setManualBookingTarget(null);

      if (customerSendRes.ok) {
        showToast(
          'success',
          `✅ Booking #${bookingId} (${staffDisplayName} • ${mbTime}) ကို အတည်ပြုသိမ်းဆည်းပြီး ${manualBookingTarget.customerName} ထံသို့ Confirmation Slip ပေးပို့ပြီးပါပြီ!`
        );
      } else {
        showToast(
          'error',
          `⚠️ Booking #${bookingId} ကို System ထဲ သိမ်းဆည်းပြီးသော်လည်း Telegram ပို့ရာတွင် အမှားရှိပါသည်: ${customerSendRes.error}`
        );
      }
    } catch (err: any) {
      console.error('Error creating manual booking:', err);
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
    const ok = await saveTelegramConfig(config);
    setSaving(false);
    if (ok) {
      setButtonFeedback('save_all', 'success');
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
      serviceName: 'Imperial Royal Signature Package',
      duration: 90,
      price: 85000,
      date: new Date().toISOString().split('T')[0],
      time: '04:30 PM',
      therapistId: 'No. 1',
      therapistName: 'Therapist No-1',
      roomName: 'VIP Jade Suite 1',
      vipTier: 'Signature V-VIP (20% Off)',
      status: 'confirmed',
      notes: 'Carebeau Massage Oil နှင့် အခန်းအပူချိန် အေးအေးလေး ပြင်ဆင်ထားပေးပါရန်။',
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
        `✅ Bot Updates စစ်ဆေးပြီးပါပြီ! Admin/ဝန်ထမ်းများကို ဖယ်ထုတ်ပြီး Customer စစ်စစ် (${updatedSubs.length}) ဦးကို ချိတ်ဆက်ထားပါသည်။`
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
    const res = await sendRawTelegramMessage(
      config.botToken,
      chatId,
      `🌿 <b>THE SHANGRI-LA MEN'S RETREAT</b>\n━━━━━━━━━━━━━━━━━━━━\n👋 မင်္ဂလာပါ <b>${staffName} (${staffId})</b>\nသင်၏ Telegram အကောင့်အား ဆိုင်၏ Real-Time Notification စနစ်နှင့် အောင်မြင်စွာ ချိတ်ဆက်ပြီးပါပြီ။`,
      undefined,
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
      showToast('success', '✅ Customer Subscriber အသစ်ကို အောင်မြင်စွာ ထည့်သွင်းပြီးပါပြီ။');
    } else {
      setButtonFeedback('add_sub', 'error');
      showToast('error', '❌ Subscriber ထည့်သွင်းရာတွင် အမှားအယွင်းရှိပါသည်။ (Private Chat ID သည် ဂဏန်းသီးသန့် ဖြစ်ရပါမည်)');
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
    const res = await notifyCustomerBookingStatus(
      'STATUS_UPDATE',
      {
        id: sub.lastBookingId || 'BK-889900',
        customerName: sub.customerName || 'VIP Guest',
        customerPhone: sub.customerPhone || '09-799999999',
        customerChatId: sub.chatId,
        serviceName: 'Shangri-La Signature Aromatherapy',
        duration: 60,
        price: 50000,
        date: new Date().toISOString().split('T')[0],
        time: '06:00 PM',
        therapistName: 'Therapist No-1',
        roomName: 'VIP Suite',
        status: 'approved',
      },
      config
    );
    if (res.customerSent) {
      setButtonFeedback(btnKey, 'success');
      showToast('success', `✅ ${sub.customerName} (${sub.chatId}) ထံသို့ Booking Approved Notification ပေးပို့ပြီးပါပြီ!`);
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

  if (loading) {
    return (
      <div className="p-8 text-center text-[#C8A951] bg-[#0B2419] rounded-2xl border border-[#C8A951]/30">
        <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2" />
        <p className="text-sm">Telegram Bot, Active Staff နှင့် Customer Subscribers စာရင်းကို စစ်ထုတ်နေပါသည်...</p>
      </div>
    );
  }

  const currentModalService =
    catalogServices.find((s) => String(s.id) === String(mbServiceId)) || FALLBACK_SERVICES[0];
  const currentModalDurationMins =
    mbBookingType === 'half_day'
      ? 360
      : mbBookingType === 'night_call'
      ? 720
      : parseDurationToMinutes(currentModalService?.duration || 60);
  const computedRemainingBalance = Math.max(0, (Number(mbTotalPrice) || 0) - (Number(mbDepositAmount) || 0));

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
      <div className="p-6 bg-gradient-to-r from-[#071810] via-[#0B2419] to-[#071810] border-b border-[#C8A951]/30 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="p-2 rounded-xl bg-[#C8A951]/15 border border-[#C8A951]/40 text-[#C8A951]">
              <Send className="w-5 h-5" />
            </span>
            <h2 className="text-xl font-bold text-[#C8A951] tracking-wide">
              TELEGRAM BOT, MINI APP & REAL-TIME NOTIFICATION CENTER
            </h2>
          </div>
          <p className="text-xs text-stone-400 mt-1">
            Customer & Staff Real-Time Booking Status Updates, Bulk Promotion Push Noti နှင့် Mini App Menu ထိန်းချုပ်ရေးစနစ်
          </p>
        </div>

        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 cursor-pointer bg-black/30 px-3.5 py-2 rounded-xl border border-[#C8A951]/30 hover:border-[#C8A951]/60 active:scale-95 transition">
            <input
              type="checkbox"
              checked={config.enabled}
              onChange={(e) => {
                const next = { ...config, enabled: e.target.checked };
                setConfig(next);
                saveTelegramConfig(next);
                showToast(
                  'success',
                  e.target.checked ? '🟢 Telegram Bot ကို ဖွင့်လိုက်ပါပြီ။' : '🔴 Telegram Bot ကို ခေတ္တပိတ်ထားပါသည်။'
                );
              }}
              className="accent-[#C8A951] w-4 h-4"
            />
            <span className="text-xs font-semibold text-[#C8A951]">
              {config.enabled ? '🟢 BOT ACTIVE' : '🔴 BOT PAUSED'}
            </span>
          </label>

          <button
            onClick={handleSaveConfig}
            disabled={saving}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-xs active:scale-95 transition duration-150 shadow-md ${
              btnStates['save_all'] === 'success'
                ? 'bg-emerald-500 text-black'
                : btnStates['save_all'] === 'error'
                ? 'bg-red-600 text-white'
                : 'bg-[#C8A951] text-[#0B2419] hover:bg-[#d8b962]'
            }`}
          >
            {btnStates['save_all'] === 'loading' ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : btnStates['save_all'] === 'success' ? (
              <Check className="w-4 h-4" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            {btnStates['save_all'] === 'loading'
              ? 'Saving...'
              : btnStates['save_all'] === 'success'
              ? 'Saved ✓'
              : 'Save All Changes'}
          </button>
        </div>
      </div>

      {/* Top Banner Toast */}
      {statusBanner && (
        <div
          className={`px-6 py-3 text-xs font-medium flex items-center justify-between ${
            statusBanner.type === 'success'
              ? 'bg-emerald-950/90 text-emerald-300 border-b border-emerald-500/30'
              : 'bg-red-950/90 text-red-300 border-b border-red-500/30'
          }`}
        >
          <div className="flex items-center gap-2">
            {statusBanner.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            ) : (
              <ShieldAlert className="w-4 h-4 text-red-400 shrink-0" />
            )}
            <span>{statusBanner.text}</span>
          </div>
          <button onClick={() => setStatusBanner(null)} className="text-stone-400 hover:text-white">
            ✕
          </button>
        </div>
      )}

      {/* Navigation Tabs */}
      <div className="flex overflow-x-auto border-b border-[#C8A951]/20 bg-[#071810]/60 px-4">
        {[
          { id: 'setup', label: '1. Bot & Channels Setup', icon: Settings },
          { id: 'triggers', label: '2. Notification Triggers', icon: Bell },
          { id: 'staff', label: `3. Active Staff (${config.staffMappings.length})`, icon: Users },
          { id: 'customers', label: `4. Subscribed Customers (${subscribers.length})`, icon: Smartphone },
          { id: 'botflow', label: '5. Mini App Menu & Bulk Promo', icon: Megaphone },
          { id: 'logs', label: '6. Delivery Logs', icon: History },
        ].map((tab) => {
          const Icon = tab.icon;
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-2 px-4 py-3.5 text-xs font-semibold whitespace-nowrap border-b-2 active:scale-95 transition ${
                active
                  ? 'border-[#C8A951] text-[#C8A951] bg-[#C8A951]/10'
                  : 'border-transparent text-stone-400 hover:text-stone-200'
              }`}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Tab Content */}
      <div className="p-6 space-y-6">
        {/* TAB 1: BOT & CHANNELS SETUP */}
        {activeTab === 'setup' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-black/25 p-4 rounded-xl border border-[#C8A951]/20">
                <label className="block text-xs font-semibold text-[#C8A951] mb-1">
                  Telegram Bot Token (@BotFather)
                </label>
                <div className="relative flex items-center">
                  <input
                    type={showToken ? 'text' : 'password'}
                    value={config.botToken}
                    onChange={(e) => setConfig({ ...config, botToken: e.target.value })}
                    placeholder="123456789:ABCdefGHIjklMNOpqrsTUVwxyz"
                    className="w-full bg-[#071810] border border-[#C8A951]/30 rounded-lg px-3 py-2 text-xs text-white pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowToken(!showToken)}
                    className="absolute right-2.5 text-stone-400 hover:text-[#C8A951] active:scale-90 transition"
                  >
                    {showToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="bg-black/25 p-4 rounded-xl border border-[#C8A951]/20">
                <label className="block text-xs font-semibold text-[#C8A951] mb-1">
                  Telegram Bot Username (e.g. ShangrilaRetreatBot)
                </label>
                <input
                  type="text"
                  value={config.botUsername || ''}
                  onChange={(e) => setConfig({ ...config, botUsername: e.target.value.replace(/^@/, '') })}
                  placeholder="ShangrilaRetreatBot (Auto-detected on Sync)"
                  className="w-full bg-[#071810] border border-[#C8A951]/30 rounded-lg px-3 py-2 text-xs text-white"
                />
              </div>

              <div className="bg-black/25 p-4 rounded-xl border border-[#C8A951]/20">
                <label className="block text-xs font-semibold text-[#C8A951] mb-1">
                  Official Web App URL (Mini App Launch URL)
                </label>
                <input
                  type="text"
                  value={config.webAppUrl}
                  onChange={(e) => setConfig({ ...config, webAppUrl: e.target.value })}
                  placeholder="https://www.shangrilamenretreat.online"
                  className="w-full bg-[#071810] border border-[#C8A951]/30 rounded-lg px-3 py-2 text-xs text-white"
                />
              </div>

              <div className="bg-black/25 p-4 rounded-xl border border-[#C8A951]/20">
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-semibold text-[#C8A951]">
                    Admin / Reception Group Chat ID
                  </label>
                  {config.adminGroupChatId && (
                    <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-bold">
                      <Check className="w-3 h-3" /> Active Admin ID
                    </span>
                  )}
                </div>
                <input
                  type="text"
                  value={config.adminGroupChatId}
                  onChange={(e) => setConfig({ ...config, adminGroupChatId: e.target.value })}
                  placeholder="-1001234567890 သို့မဟုတ် Admin Chat ID"
                  className="w-full bg-[#071810] border border-[#C8A951]/30 rounded-lg px-3 py-2 text-xs font-mono text-emerald-300"
                />
              </div>

              <div className="bg-black/25 p-4 rounded-xl border border-[#C8A951]/20 md:col-span-2">
                <label className="block text-xs font-semibold text-[#C8A951] mb-1">
                  Staff General Group Chat ID (Optional)
                </label>
                <input
                  type="text"
                  value={config.staffGroupChatId}
                  onChange={(e) => setConfig({ ...config, staffGroupChatId: e.target.value })}
                  placeholder="-1009876543210"
                  className="w-full bg-[#071810] border border-[#C8A951]/30 rounded-lg px-3 py-2 text-xs font-mono text-white"
                />
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <button
                onClick={handleTestAdminConnection}
                disabled={btnStates['test_admin'] === 'loading'}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-xs active:scale-95 transition duration-150 shadow ${
                  btnStates['test_admin'] === 'success'
                    ? 'bg-emerald-500 text-black font-bold'
                    : btnStates['test_admin'] === 'error'
                    ? 'bg-red-600 text-white'
                    : 'bg-emerald-600 hover:bg-emerald-500 text-white'
                }`}
              >
                {btnStates['test_admin'] === 'loading' ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : btnStates['test_admin'] === 'success' ? (
                  <Check className="w-4 h-4" />
                ) : (
                  <Sparkles className="w-4 h-4" />
                )}
                {btnStates['test_admin'] === 'loading'
                  ? 'Sending Test...'
                  : btnStates['test_admin'] === 'success'
                  ? 'Test Notification Sent ✓'
                  : 'Send Test Booking Notification'}
              </button>

              <button
                onClick={handleScanRecentChats}
                disabled={scanningChats}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border font-semibold text-xs active:scale-95 transition duration-150 ${
                  btnStates['scan_chats'] === 'success'
                    ? 'bg-emerald-500/30 text-emerald-200 border-emerald-400'
                    : 'bg-[#C8A951]/20 hover:bg-[#C8A951]/30 text-[#C8A951] border-[#C8A951]/40'
                }`}
              >
                <Radio className={`w-4 h-4 ${scanningChats ? 'animate-ping' : ''}`} />
                {scanningChats
                  ? 'Scanning Bot Updates...'
                  : btnStates['scan_chats'] === 'success'
                  ? '✅ Synced & Filtered Customers ✓'
                  : '🔄 Scan Recent Chats & Auto-Subscribe Customers'}
              </button>

              <button
                onClick={handleSyncBotMenu}
                disabled={btnStates['sync_menu'] === 'loading'}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs active:scale-95 transition duration-150 ${
                  btnStates['sync_menu'] === 'success'
                    ? 'bg-emerald-500 text-black'
                    : 'bg-[#C8A951] text-[#0B2419] hover:bg-[#d8b962]'
                }`}
              >
                {btnStates['sync_menu'] === 'loading' ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : btnStates['sync_menu'] === 'success' ? (
                  <Check className="w-4 h-4" />
                ) : (
                  <Smartphone className="w-4 h-4" />
                )}
                {btnStates['sync_menu'] === 'loading'
                  ? 'Pushing Menu Commands...'
                  : btnStates['sync_menu'] === 'success'
                  ? 'Mini App Menu Synced ✓'
                  : '⚡ Setup Mini App Menu & Commands (/book, /staff, /available, /history)'}
              </button>
            </div>

            {/* RECENT DISCOVERED CHATS TABLE */}
            {discoveredChats.length > 0 && (
              <div className="bg-black/30 rounded-xl border border-[#C8A951]/30 p-4 space-y-3">
                <h3 className="text-xs font-bold text-[#C8A951]">
                  📡 Bot သို့ လတ်တလော ဆက်သွယ်ထားသော အကောင့်များ (Admin နှင့် ဝန်ထမ်းအကောင့်များကို Customer List မှ အလိုအလျောက် စစ်ထုတ်ပေးထားပါသည်)
                </h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-[#C8A951]/20 text-stone-400">
                        <th className="py-2.5 px-2">Name / Group Title</th>
                        <th className="py-2.5 px-2">Role / Type</th>
                        <th className="py-2.5 px-2">Chat ID</th>
                        <th className="py-2.5 px-2">Last Message</th>
                        <th className="py-2.5 px-2 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {discoveredChats.map((c) => {
                        const isCurrentAdmin = String(config.adminGroupChatId || '').trim() === String(c.chatId).trim();
                        const linkedStaff = config.staffMappings.find(
                          (s) => String(s.telegramChatId || '').trim() === String(c.chatId).trim()
                        );
                        const copyKey = `copy_${c.chatId}`;
                        const adminKey = `set_admin_${c.chatId}`;

                        return (
                          <tr key={c.chatId} className="hover:bg-white/5">
                            <td className="py-2.5 px-2 font-medium text-white">
                              <div className="flex items-center gap-2">
                                <span>
                                  {c.titleOrName} {c.username ? <span className="text-stone-400">(@{c.username})</span> : ''}
                                </span>
                              </div>
                            </td>
                            <td className="py-2.5 px-2">
                              {isCurrentAdmin ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-[10px] font-bold">
                                  <Check className="w-3 h-3" /> ADMIN ACCOUNT
                                </span>
                              ) : linkedStaff ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-sky-500/20 text-sky-300 border border-sky-500/40 text-[10px] font-bold">
                                  👨‍💼 STAFF ({linkedStaff.staffId})
                                </span>
                              ) : c.roleTag === 'ADMIN' ? (
                                <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 text-[10px] font-bold">
                                  ADMIN / EXCLUDED
                                </span>
                              ) : (
                                <span className="px-2 py-0.5 rounded bg-[#C8A951]/15 text-[#C8A951] uppercase text-[10px] font-semibold">
                                  {c.type} • CUSTOMER
                                </span>
                              )}
                            </td>
                            <td className="py-2.5 px-2 font-mono text-emerald-300">{c.chatId}</td>
                            <td className="py-2.5 px-2 text-stone-400 truncate max-w-[140px]">{c.lastMessage}</td>
                            <td className="py-2.5 px-2">
                              <div className="flex items-center justify-end gap-2 flex-wrap">
                                <button
                                  onClick={() => handleCopyChatId(c.chatId, 'copy')}
                                  className={`px-2.5 py-1 rounded text-[11px] font-semibold flex items-center gap-1 active:scale-95 transition duration-150 ${
                                    btnStates[copyKey] === 'success'
                                      ? 'bg-emerald-500 text-black font-bold'
                                      : 'bg-white/10 hover:bg-white/20 text-white'
                                  }`}
                                >
                                  {btnStates[copyKey] === 'success' ? (
                                    <>
                                      <Check className="w-3 h-3" /> Copied!
                                    </>
                                  ) : (
                                    <>
                                      <Copy className="w-3 h-3" /> Copy ID
                                    </>
                                  )}
                                </button>

                                <button
                                  onClick={() => handleSetAsAdminId(c.chatId, c.titleOrName)}
                                  className={`px-2.5 py-1 rounded text-[11px] font-semibold flex items-center gap-1 active:scale-95 transition duration-150 ${
                                    isCurrentAdmin
                                      ? 'bg-emerald-500/25 text-emerald-300 border border-emerald-400/50 font-bold'
                                      : btnStates[adminKey] === 'loading'
                                      ? 'bg-[#C8A951]/40 text-white'
                                      : 'bg-[#C8A951]/20 text-[#C8A951] hover:bg-[#C8A951]/30 border border-[#C8A951]/30'
                                  }`}
                                >
                                  {btnStates[adminKey] === 'loading' ? (
                                    <>
                                      <RefreshCw className="w-3 h-3 animate-spin" /> Saving...
                                    </>
                                  ) : isCurrentAdmin ? (
                                    <>
                                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> Admin ID ✓
                                    </>
                                  ) : (
                                    'Set as Admin ID'
                                  )}
                                </button>

                                <select
                                  value={linkedStaff?.staffId || ''}
                                  onChange={(e) => handleAssignChatToStaff(c.chatId, e.target.value)}
                                  className={`bg-[#071810] border rounded px-2 py-1 text-[11px] cursor-pointer active:scale-95 transition ${
                                    linkedStaff
                                      ? 'border-sky-400/50 text-sky-300 font-bold'
                                      : 'border-[#C8A951]/30 text-stone-300'
                                  }`}
                                >
                                  <option value="">
                                    {linkedStaff ? `✅ Staff: ${linkedStaff.staffId}` : '👨‍💼 Link to Staff...'}
                                  </option>
                                  {config.staffMappings.map((sm) => (
                                    <option key={sm.staffId} value={sm.staffId}>
                                      {sm.staffId} ({staffHrMeta[sm.staffId]?.actualName || sm.staffName})
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

        {/* TAB 2: NOTIFICATION TRIGGERS */}
        {activeTab === 'triggers' && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-black/25 p-4 rounded-xl border border-[#C8A951]/20 space-y-3">
                <h3 className="text-sm font-bold text-[#C8A951] border-b border-[#C8A951]/20 pb-2">
                  📅 Customer & Admin Booking Status Real-Time Alerts
                </h3>
                {[
                  { key: 'customerDirectNoti', label: '📲 Customer ဆီသို့ Booking Status တိုက်ရိုက်ပို့မည် (Direct Customer Alert)' },
                  { key: 'newBooking', label: '🔔 Booking အသစ်ဝင်ချိန် (New Booking -> Pending)' },
                  { key: 'bookingConfirmed', label: '🟢 Booking အတည်ပြုချိန် (Status -> Approved / Confirmed)' },
                  { key: 'bookingInService', label: '💆‍♂️ ဝန်ဆောင်မှု စတင်ချိန် (Status -> In-Service)' },
                  { key: 'bookingCompleted', label: '✨ ဝန်ဆောင်မှု ပြီးဆုံးချိန် (Status -> Completed)' },
                  { key: 'bookingCancelled', label: '🔴 Booking ပယ်ဖျက်ချိန် (Status -> Cancelled)' },
                ].map((item) => (
                  <label
                    key={item.key}
                    className="flex items-center justify-between py-1.5 px-2 rounded-lg hover:bg-white/5 cursor-pointer transition"
                  >
                    <span className="text-xs text-stone-200">{item.label}</span>
                    <input
                      type="checkbox"
                      checked={(config.triggers as any)[item.key] !== false}
                      onChange={async (e) => {
                        const updated = {
                          ...config,
                          triggers: { ...config.triggers, [item.key]: e.target.checked },
                        };
                        setConfig(updated);
                        await saveTelegramConfig(updated);
                        showToast(
                          'success',
                          `✅ "${item.label}" ကို ${e.target.checked ? 'ဖွင့် (ON)' : 'ပိတ် (OFF)'} လိုက်ပါပြီ။`
                        );
                      }}
                      className="accent-[#C8A951] w-4 h-4"
                    />
                  </label>
                ))}
              </div>

              <div className="bg-black/25 p-4 rounded-xl border border-[#C8A951]/20 space-y-3">
                <h3 className="text-sm font-bold text-[#C8A951] border-b border-[#C8A951]/20 pb-2">
                  👨‍💼 ဝန်ထမ်းနှင့် ဆိုင်စီမံခန့်ခွဲမှု Alerts (Staff & Operations)
                </h3>
                {[
                  { key: 'staffAssigned', label: '👨‍💼 Therapist တာဝန်ချထားမှု (Direct Staff Alert)' },
                  { key: 'dutyRosterUpdated', label: '📅 Duty Roster / အဆိုင်းအပြောင်းအလဲ နိုတီ' },
                  { key: 'penaltyIssued', label: '⚠️ စည်းကမ်းထိန်းသိမ်းရေး / ဒဏ်ကြေး နိုတီ (Penalty System)' },
                  { key: 'payrollGenerated', label: '💵 လစာနှင့် ကော်မရှင် ထုတ်ပြန်ချက် (Payroll Ready)' },
                  { key: 'dailySalesSummary', label: '📊 နေ့စဉ် အရောင်းချုပ် (Daily Sales Summary)' },
                ].map((item) => (
                  <label
                    key={item.key}
                    className="flex items-center justify-between py-1.5 px-2 rounded-lg hover:bg-white/5 cursor-pointer transition"
                  >
                    <span className="text-xs text-stone-200">{item.label}</span>
                    <input
                      type="checkbox"
                      checked={(config.triggers as any)[item.key]}
                      onChange={async (e) => {
                        const updated = {
                          ...config,
                          triggers: { ...config.triggers, [item.key]: e.target.checked },
                        };
                        setConfig(updated);
                        await saveTelegramConfig(updated);
                        showToast(
                          'success',
                          `✅ "${item.label}" ကို ${e.target.checked ? 'ဖွင့် (ON)' : 'ပိတ် (OFF)'} လိုက်ပါပြီ။`
                        );
                      }}
                      className="accent-[#C8A951] w-4 h-4"
                    />
                  </label>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: ACTIVE STAFF TELEGRAM MAPPINGS */}
        {activeTab === 'staff' && (
          <div className="space-y-4">
            <div className="bg-black/20 p-3.5 rounded-xl border border-[#C8A951]/20 flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div>
                <p className="text-xs text-stone-200 font-semibold">
                  ✅ <b>HR Management → Active Staff List</b> ရှိ လက်ရှိ တာဝန်ထမ်းဆောင်နေသော Active ဝန်ထမ်းများကို သီးသန့်စစ်ထုတ် ချိတ်ဆက်ထားပါသည်။
                </p>
              </div>

              <button
                type="button"
                onClick={handleRefreshActiveStaff}
                disabled={btnStates['sync_staff'] === 'loading'}
                className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl border text-xs font-bold whitespace-nowrap active:scale-95 transition duration-150 ${
                  btnStates['sync_staff'] === 'success'
                    ? 'bg-emerald-500 text-black border-emerald-400'
                    : 'bg-[#C8A951]/20 hover:bg-[#C8A951]/30 text-[#C8A951] border-[#C8A951]/40'
                }`}
              >
                <RefreshCw className={`w-3.5 h-3.5 ${btnStates['sync_staff'] === 'loading' ? 'animate-spin' : ''}`} />
                {btnStates['sync_staff'] === 'success' ? 'Active Staff Synced ✓' : 'Sync Active Staff List'}
              </button>
            </div>

            <div className="overflow-x-auto bg-black/20 rounded-xl border border-[#C8A951]/20">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-[#C8A951]/20 text-[#C8A951] bg-black/40">
                    <th className="py-3 px-3">ID / Code</th>
                    <th className="py-3 px-3">Active Staff Name (HR Synced)</th>
                    <th className="py-3 px-3">Telegram Chat ID</th>
                    <th className="py-3 px-3 text-center">Booking</th>
                    <th className="py-3 px-3 text-center">Roster</th>
                    <th className="py-3 px-3 text-center">Penalty</th>
                    <th className="py-3 px-3 text-center">Payroll</th>
                    <th className="py-3 px-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {config.staffMappings.map((staff, idx) => {
                    const hrMeta = staffHrMeta[staff.staffId];
                    const pingKey = `staff_ping_${staff.staffId}`;
                    const saveStaffKey = `staff_save_${staff.staffId}`;

                    return (
                      <tr key={staff.staffId} className="hover:bg-white/5">
                        <td className="py-2.5 px-3 font-bold text-[#C8A951]">
                          <div className="flex items-center gap-1.5">
                            <span>{staff.staffId}</span>
                            <span className="px-1.5 py-0.5 text-[9px] rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-extrabold uppercase">
                              ACTIVE
                            </span>
                          </div>
                        </td>
                        <td className="py-2.5 px-3">
                          <div className="flex flex-col gap-0.5">
                            <input
                              type="text"
                              value={staff.staffName}
                              onChange={(e) => {
                                const updated = [...config.staffMappings];
                                updated[idx].staffName = e.target.value;
                                setConfig({ ...config, staffMappings: updated });
                              }}
                              className="bg-[#071810] border border-[#C8A951]/20 rounded px-2.5 py-1 text-xs font-semibold text-white w-44"
                            />
                            {hrMeta?.actualName && (
                              <span className="text-[10px] text-emerald-300/90 pl-1">
                                👤 {hrMeta.actualName} {hrMeta.position ? `• ${hrMeta.position}` : ''}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-2.5 px-3">
                          <div className="flex items-center gap-1.5">
                            <input
                              type="text"
                              value={staff.telegramChatId}
                              onChange={(e) => {
                                const updated = [...config.staffMappings];
                                updated[idx].telegramChatId = e.target.value;
                                setConfig({ ...config, staffMappings: updated });
                              }}
                              placeholder="e.g. 5063247381"
                              className="bg-[#071810] border border-[#C8A951]/30 rounded px-2.5 py-1 text-xs font-mono text-emerald-300 w-36"
                            />
                            {staff.telegramChatId && (
                              <span className="text-emerald-400" title="Chat ID Linked">
                                <CheckCircle2 className="w-4 h-4" />
                              </span>
                            )}
                          </div>
                        </td>
                        {(['receiveBookingAssign', 'receiveRosterUpdate', 'receivePenaltyAlert', 'receivePayrollAlert'] as const).map(
                          (field) => (
                            <td key={field} className="py-2.5 px-3 text-center">
                              <input
                                type="checkbox"
                                checked={staff[field]}
                                onChange={(e) => {
                                  const updated = [...config.staffMappings];
                                  updated[idx][field] = e.target.checked;
                                  setConfig({ ...config, staffMappings: updated });
                                }}
                                className="accent-[#C8A951] cursor-pointer"
                              />
                            </td>
                          )
                        )}
                        <td className="py-2.5 px-3 text-right space-x-1.5 whitespace-nowrap">
                          <button
                            onClick={async () => {
                              setButtonFeedback(saveStaffKey, 'loading');
                              const ok = await saveTelegramConfig(config);
                              if (staff.telegramChatId) {
                                await removeCustomerTelegramSubscriber(staff.telegramChatId, true);
                                await loadSubscribers();
                              }
                              setButtonFeedback(saveStaffKey, ok ? 'success' : 'error');
                              showToast(
                                ok ? 'success' : 'error',
                                ok
                                  ? `✅ ${staff.staffId} (${hrMeta?.actualName || staff.staffName}) ၏ Chat ID ကို သိမ်းဆည်းပြီးပါပြီ။`
                                  : '❌ သိမ်းဆည်းမရပါ။'
                              );
                            }}
                            className={`px-2.5 py-1 rounded text-[11px] font-semibold active:scale-95 transition duration-150 ${
                              btnStates[saveStaffKey] === 'success'
                                ? 'bg-emerald-500 text-black font-bold'
                                : 'bg-white/10 hover:bg-white/20 text-white'
                            }`}
                          >
                            {btnStates[saveStaffKey] === 'success' ? '✓ Saved' : '💾 Save'}
                          </button>

                          <button
                            onClick={() => handleTestStaffDirect(staff.staffId, staff.staffName, staff.telegramChatId)}
                            disabled={btnStates[pingKey] === 'loading'}
                            className={`px-2.5 py-1 rounded text-[11px] font-semibold active:scale-95 transition duration-150 ${
                              btnStates[pingKey] === 'success'
                                ? 'bg-emerald-500 text-black font-bold'
                                : btnStates[pingKey] === 'error'
                                ? 'bg-red-600 text-white'
                                : 'bg-[#C8A951]/20 text-[#C8A951] hover:bg-[#C8A951]/30'
                            }`}
                          >
                            {btnStates[pingKey] === 'loading'
                              ? 'Sending...'
                              : btnStates[pingKey] === 'success'
                              ? '✓ Ping Sent!'
                              : btnStates[pingKey] === 'error'
                              ? '✕ Failed'
                              : '🔔 Test Ping'}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 4: SUBSCRIBED CUSTOMERS (WITH LIVE LAST NOTI DELIVERY BADGE & + MANUAL BOOKING) */}
        {activeTab === 'customers' && (
          <div className="space-y-4">
            <div className="bg-black/25 p-4 rounded-xl border border-[#C8A951]/20 space-y-3">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-2">
                <div>
                  <h3 className="text-sm font-bold text-[#C8A951]">
                    📲 Subscribed Customers ({subscribers.length}) — Real-Time Booking Noti & Promo List
                  </h3>
                  <p className="text-xs text-stone-400">
                    Customer တစ်ဦးချင်းစီထံ နောက်ဆုံးပေးပို့ထားသော Notification အခြေအနေ (Sent / Failed နှင့် အချိန်) ကို တိုက်ရိုက် စစ်ဆေးနိုင်ပါသည်။
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 text-stone-400 absolute left-2.5 top-2.5" />
                    <input
                      type="text"
                      value={customerSearch}
                      onChange={(e) => setCustomerSearch(e.target.value)}
                      placeholder="အမည် / ဖုန်း / ID ရှာရန်..."
                      className="bg-[#071810] border border-[#C8A951]/30 rounded-xl pl-8 pr-3 py-1.5 text-xs text-white w-48"
                    />
                  </div>
                  <button
                    onClick={handleScanRecentChats}
                    disabled={scanningChats}
                    className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl font-bold text-xs active:scale-95 transition duration-150 ${
                      btnStates['scan_chats'] === 'success'
                        ? 'bg-emerald-500 text-black'
                        : 'bg-[#C8A951] text-[#0B2419] hover:bg-[#d8b962]'
                    }`}
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${scanningChats ? 'animate-spin' : ''}`} />
                    {scanningChats
                      ? 'Syncing...'
                      : btnStates['scan_chats'] === 'success'
                      ? 'Synced ✓'
                      : 'Auto-Sync New Bot Subscribers'}
                  </button>
                </div>
              </div>

              {/* Manual Add Customer Subscriber */}
              <div className="grid grid-cols-1 md:grid-cols-5 gap-2 pt-2 border-t border-[#C8A951]/15">
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
                  className={`flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg font-bold text-xs active:scale-95 transition duration-150 ${
                    btnStates['add_sub'] === 'success'
                      ? 'bg-emerald-400 text-black'
                      : 'bg-emerald-600 hover:bg-emerald-500 text-white'
                  }`}
                >
                  {btnStates['add_sub'] === 'success' ? (
                    <>
                      <Check className="w-3.5 h-3.5" /> Added ✓
                    </>
                  ) : (
                    <>
                      <UserPlus className="w-3.5 h-3.5" /> Add Subscriber
                    </>
                  )}
                </button>
              </div>
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
                        title="Select All Customers"
                      />
                    </th>
                    <th className="py-3 px-3">Customer Name</th>
                    <th className="py-3 px-3">Phone (Editable)</th>
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
                      const testKey = `test_noti_${sub.chatId}`;
                      const menuKey = `send_menu_${sub.chatId}`;
                      const phoneKey = `save_phone_${sub.chatId}`;
                      const copySubKey = `copy_sub_${sub.chatId}`;
                      const manualBkKey = `manual_bk_${sub.chatId}`;
                      const currentPhoneVal =
                        editingPhones[sub.chatId] !== undefined ? editingPhones[sub.chatId] : sub.customerPhone || '';

                      // Lookup latest notification delivery record for this customer's chatId
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
                          <td className="py-2.5 px-3">
                            <div className="flex items-center gap-1">
                              <Phone className="w-3 h-3 text-stone-400 shrink-0" />
                              <input
                                type="text"
                                value={currentPhoneVal}
                                onChange={(e) =>
                                  setEditingPhones((prev) => ({ ...prev, [sub.chatId]: e.target.value }))
                                }
                                placeholder="09-xxxxxxxxx"
                                className="bg-[#071810] border border-[#C8A951]/25 rounded px-2 py-0.5 text-xs font-mono text-stone-200 w-28"
                              />
                              {editingPhones[sub.chatId] !== undefined &&
                                editingPhones[sub.chatId] !== (sub.customerPhone || '') && (
                                  <button
                                    onClick={() => handleSaveCustomerPhoneInline(sub)}
                                    className="px-1.5 py-0.5 rounded bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] font-bold active:scale-95 transition"
                                    title="Save Phone Number"
                                  >
                                    {btnStates[phoneKey] === 'success' ? '✓' : '💾'}
                                  </button>
                                )}
                            </div>
                          </td>
                          <td className="py-2.5 px-3">
                            <div className="flex items-center gap-1.5">
                              <span className="font-mono text-emerald-300">{sub.chatId}</span>
                              <button
                                onClick={() => handleCopyChatId(sub.chatId, 'copy_sub')}
                                className="p-1 rounded hover:bg-white/10 text-stone-400 hover:text-white active:scale-90 transition"
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

                          {/* 🌟 NEW: LIVE LAST NOTIFICATION STATUS & TIME BADGE 🌟 */}
                          <td className="py-2.5 px-3">
                            {!lastLog ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-white/5 text-stone-400 border border-white/10 text-[10px]">
                                No Noti Yet
                              </span>
                            ) : lastLog.status === 'SUCCESS' ? (
                              <div
                                className="flex flex-col items-start gap-0.5"
                                title={lastLog.summary ? lastLog.summary.replace(/<[^>]+>/g, '') : 'Delivered to Telegram'}
                              >
                                <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-[10px] font-bold">
                                  <CheckCircle2 className="w-3 h-3 text-emerald-400 shrink-0" />
                                  <span>SENT</span>
                                  {lastLogTimeStr && (
                                    <span className="text-emerald-200/90 font-normal">• {lastLogTimeStr}</span>
                                  )}
                                </div>
                                <span className="text-[9px] text-stone-400 font-mono pl-0.5 truncate max-w-[150px]">
                                  {lastLog.type || 'NOTIFICATION'}
                                </span>
                              </div>
                            ) : (
                              <div
                                className="flex flex-col items-start gap-0.5"
                                title={lastLog.errorDetail || 'Delivery Failed'}
                              >
                                <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-red-500/20 text-red-300 border border-red-500/40 text-[10px] font-bold">
                                  <XCircle className="w-3 h-3 text-red-400 shrink-0" />
                                  <span>FAILED</span>
                                  {lastLogTimeStr && (
                                    <span className="text-red-200/90 font-normal">• {lastLogTimeStr}</span>
                                  )}
                                </div>
                                <span className="text-[9px] text-red-300/90 pl-0.5 truncate max-w-[160px]">
                                  {lastLog.errorDetail || lastLog.type || 'Blocked / Invalid Chat'}
                                </span>
                              </div>
                            )}
                          </td>

                          <td className="py-2.5 px-3 text-right">
                            <div className="flex items-center justify-end gap-1.5 whitespace-nowrap">
                              {/* + Manual Booking & Confirm Button */}
                              <button
                                type="button"
                                onClick={() => handleOpenManualBookingModal(sub)}
                                className={`px-2.5 py-1 rounded text-[11px] font-bold flex items-center gap-1 active:scale-95 transition duration-150 shadow-sm ${
                                  btnStates[manualBkKey] === 'success'
                                    ? 'bg-emerald-500 text-black'
                                    : 'bg-gradient-to-r from-[#C8A951] to-[#b39136] text-[#071810] hover:brightness-110'
                                }`}
                                title="Telegram Manual Booking သွင်းပြီး Bot Confirmation Slip တန်းပို့ရန်"
                              >
                                <CalendarPlus className="w-3.5 h-3.5" />
                                {btnStates[manualBkKey] === 'success' ? '✓ Booked & Sent' : '+ Manual Booking'}
                              </button>

                              {/* Test Booking Alert Button */}
                              <button
                                onClick={() => handleTestCustomerBookingNoti(sub)}
                                disabled={btnStates[testKey] === 'loading'}
                                className={`px-2.5 py-1 rounded text-[11px] font-semibold flex items-center gap-1 active:scale-95 transition duration-150 ${
                                  btnStates[testKey] === 'success'
                                    ? 'bg-emerald-500 text-black font-bold'
                                    : btnStates[testKey] === 'error'
                                    ? 'bg-red-600 text-white'
                                    : 'bg-emerald-600/30 text-emerald-300 border border-emerald-500/40 hover:bg-emerald-600/50'
                                }`}
                              >
                                {btnStates[testKey] === 'loading' ? (
                                  <>
                                    <RefreshCw className="w-3 h-3 animate-spin" /> Sending...
                                  </>
                                ) : btnStates[testKey] === 'success' ? (
                                  <>
                                    <Check className="w-3 h-3" /> Sent ✓
                                  </>
                                ) : btnStates[testKey] === 'error' ? (
                                  '✕ Failed'
                                ) : (
                                  '🔔 Test Booking Alert'
                                )}
                              </button>

                              {/* Send Menu Button */}
                              <button
                                onClick={() => handleSendCustomerMenu(sub)}
                                disabled={btnStates[menuKey] === 'loading'}
                                className={`px-2.5 py-1 rounded text-[11px] font-semibold flex items-center gap-1 active:scale-95 transition duration-150 ${
                                  btnStates[menuKey] === 'success'
                                    ? 'bg-emerald-500 text-black font-bold'
                                    : btnStates[menuKey] === 'error'
                                    ? 'bg-red-600 text-white'
                                    : 'bg-[#C8A951]/20 text-[#C8A951] hover:bg-[#C8A951]/30'
                                }`}
                              >
                                {btnStates[menuKey] === 'loading' ? (
                                  '...'
                                ) : btnStates[menuKey] === 'success' ? (
                                  '✓ Menu Sent'
                                ) : (
                                  'Send Menu'
                                )}
                              </button>

                              {/* Exclude as Staff/Admin or Remove Button */}
                              <button
                                onClick={() => handleExcludeOrRemoveSubscriber(sub, 'Admin/Staff သို့မဟုတ် မလိုအပ်သူအဖြစ်')}
                                className="p-1.5 rounded bg-red-500/15 text-red-300 hover:bg-red-500/30 border border-red-500/30 active:scale-90 transition"
                                title="ဝန်ထမ်း/Admin အကောင့်ဖြစ်နေပါက Customer စာရင်းမှ အပြီးအပိုင် ဖယ်ရှားရန်"
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

        {/* TAB 5: MINI APP MENU & BULK PROMO BROADCAST */}
        {activeTab === 'botflow' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Customer Bulk Promotion & Instant Push Noti */}
            <div className="bg-black/25 p-5 rounded-xl border border-[#C8A951]/30 space-y-4">
              <div className="flex items-center justify-between border-b border-[#C8A951]/20 pb-3">
                <h3 className="text-sm font-bold text-[#C8A951] flex items-center gap-2">
                  <Megaphone className="w-4 h-4" />
                  🎁 Customer Promotion Alert & Instant Push Broadcast
                </h3>
                <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  {subscribers.length} Subscribed
                </span>
              </div>

              <div>
                <label className="block text-xs text-[#C8A951] mb-1">ပေးပို့မည့် အုပ်စု (Target Audience)</label>
                <select
                  value={promoAudience}
                  onChange={(e) => setPromoAudience(e.target.value as any)}
                  className="w-full bg-[#071810] border border-[#C8A951]/30 rounded-lg px-3 py-2 text-xs text-white"
                >
                  <option value="ALL">👥 Subscribed Customer အားလုံး ({subscribers.length})</option>
                  <option value="VIP_ONLY">👑 VIP Members သီးသန့်</option>
                  <option value="SELECTED">✅ Tab 4 တွင် ရွေးချယ်ထားသူများ ({selectedSubIds.length})</option>
                </select>
              </div>

              <div>
                <label className="block text-xs text-[#C8A951] mb-1">ပရိုမိုးရှင်း ခေါင်းစဉ် (Promotion Headline)</label>
                <input
                  type="text"
                  value={promoTitle}
                  onChange={(e) => setPromoTitle(e.target.value)}
                  className="w-full bg-[#071810] border border-[#C8A951]/30 rounded-lg px-3 py-2 text-xs text-white"
                />
              </div>

              <div>
                <label className="block text-xs text-[#C8A951] mb-1 flex items-center gap-1">
                  <ImageIcon className="w-3.5 h-3.5" /> ပရိုမိုးရှင်း ပုံ Link (Optional Photo Banner URL)
                </label>
                <input
                  type="text"
                  value={promoImageUrl}
                  onChange={(e) => setPromoImageUrl(e.target.value)}
                  placeholder="https://i.ibb.co/... (ပုံပါထည့်ပို့လိုပါက Image URL ထည့်ပါ)"
                  className="w-full bg-[#071810] border border-[#C8A951]/30 rounded-lg px-3 py-2 text-xs text-white"
                />
              </div>

              <div>
                <label className="block text-xs text-[#C8A951] mb-1">
                  ပရိုမိုးရှင်း စာသား အပြည့်အစုံ (Promotion Message)
                </label>
                <textarea
                  rows={4}
                  value={promoMessage}
                  onChange={(e) => setPromoMessage(e.target.value)}
                  placeholder="ဥပမာ - ယနေ့ ဘိုကင်တင်သူများအတွက် VVIP Master Room အထူးလျှော့ဈေးနှင့် Carebeau Oil Massage..."
                  className="w-full bg-[#071810] border border-[#C8A951]/30 rounded-lg px-3 py-2 text-xs text-white"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-[#C8A951] mb-1">အဓိက ခလုတ်စာသား (CTA Button)</label>
                  <input
                    type="text"
                    value={promoButtonText}
                    onChange={(e) => setPromoButtonText(e.target.value)}
                    className="w-full bg-[#071810] border border-[#C8A951]/30 rounded-lg px-3 py-2 text-xs text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs text-[#C8A951] mb-1">နှိပ်လျှင် ပွင့်မည့် Mini App စာမျက်နှာ</label>
                  <select
                    value={promoButtonTab}
                    onChange={(e) => setPromoButtonTab(e.target.value as any)}
                    className="w-full bg-[#071810] border border-[#C8A951]/30 rounded-lg px-3 py-2 text-xs text-white"
                  >
                    <option value="booking">📅 ဘိုကင်တင်ရန် (?tab=booking)</option>
                    <option value="therapists">👥 ဝန်ထမ်းပုံကြည့်ရန် (?tab=therapists)</option>
                    <option value="available">🟢 အားနေသောဝန်ထမ်းများ (?tab=available)</option>
                    <option value="history">📋 My Booking History (?tab=history)</option>
                    <option value="vip">👑 VIP Member & Points (?tab=vip)</option>
                  </select>
                </div>
              </div>

              {promoProgress && (
                <div className="text-xs text-emerald-300 bg-emerald-950/60 px-3 py-2 rounded-lg border border-emerald-500/30">
                  ⏳ ပေးပို့နေပါသည်... ({promoProgress.sent} / {promoProgress.total})
                </div>
              )}

              <button
                onClick={handleSendCustomerPromoBroadcast}
                disabled={sendingPromo}
                className={`w-full py-2.5 rounded-xl font-bold text-xs flex items-center justify-center gap-2 active:scale-95 transition duration-150 ${
                  btnStates['promo_broadcast'] === 'success'
                    ? 'bg-emerald-500 text-black'
                    : btnStates['promo_broadcast'] === 'error'
                    ? 'bg-red-600 text-white'
                    : 'bg-[#C8A951] text-[#0B2419] hover:bg-[#d8b962]'
                }`}
              >
                <Send className="w-4 h-4" />
                {sendingPromo
                  ? 'Customer များထံ ပေးပို့နေပါသည်...'
                  : btnStates['promo_broadcast'] === 'success'
                  ? '✅ Promotion Broadcast Sent ✓'
                  : '🚀 Send Bulk Promotion / Instant Push to Customers'}
              </button>
            </div>

            {/* Bot Menu Config & Staff Broadcast */}
            <div className="space-y-6">
              <div className="bg-black/25 p-5 rounded-xl border border-[#C8A951]/20 space-y-4">
                <div className="flex items-center justify-between border-b border-[#C8A951]/20 pb-3">
                  <h3 className="text-sm font-bold text-[#C8A951]">🤖 Telegram Mini App Menu & Welcome</h3>
                  <button
                    onClick={handleSyncBotMenu}
                    className={`px-3 py-1.5 rounded-lg font-bold text-xs active:scale-95 transition ${
                      btnStates['sync_menu'] === 'success'
                        ? 'bg-emerald-500 text-black'
                        : 'bg-[#C8A951] text-[#0B2419] hover:bg-[#d8b962]'
                    }`}
                  >
                    {btnStates['sync_menu'] === 'success' ? '✓ Pushed to Telegram' : '⚡ Push Menu Icons to Telegram'}
                  </button>
                </div>

                <div className="text-[11px] text-stone-300 bg-black/30 p-3 rounded-lg border border-[#C8A951]/15 space-y-1">
                  <p className="font-bold text-[#C8A951]">Telegram Bot Menu တွင် အလိုအလျောက် ပါဝင်မည့် ခလုတ်များ -</p>
                  <p>• <code>/book</code> — 📅 ဘိုကင်တင်ရန် (Mini App Booking)</p>
                  <p>• <code>/staff</code> — 👥 ဝန်ထမ်းပုံကြည့်ရန် (Therapist Profiles)</p>
                  <p>• <code>/available</code> — 🟢 အားနေသော ဝန်ထမ်းများကြည့်ရန်</p>
                  <p>• <code>/history</code> — 📋 My Booking History & Status</p>
                  <p>• <code>/vip</code> — 👑 VIP Membership & Points</p>
                </div>

                <div>
                  <label className="block text-xs text-[#C8A951] mb-1">Bot Welcome Message</label>
                  <textarea
                    rows={2}
                    value={config.botFlow.welcomeMessage}
                    onChange={(e) =>
                      setConfig({
                        ...config,
                        botFlow: { ...config.botFlow, welcomeMessage: e.target.value },
                      })
                    }
                    className="w-full bg-[#071810] border border-[#C8A951]/30 rounded-lg px-3 py-2 text-xs text-white"
                  />
                </div>
              </div>

              <div className="bg-black/25 p-5 rounded-xl border border-[#C8A951]/20 space-y-4">
                <h3 className="text-sm font-bold text-[#C8A951] border-b border-[#C8A951]/20 pb-3">
                  📢 Instant Staff & Group Announcement
                </h3>

                <div>
                  <label className="block text-xs text-[#C8A951] mb-1">ခေါင်းစဉ် (Staff Announcement Title)</label>
                  <input
                    type="text"
                    value={broadcastTitle}
                    onChange={(e) => setBroadcastTitle(e.target.value)}
                    className="w-full bg-[#071810] border border-[#C8A951]/30 rounded-lg px-3 py-2 text-xs text-white"
                  />
                </div>

                <div>
                  <label className="block text-xs text-[#C8A951] mb-1">ဝန်ထမ်းများသို့ အသိပေးစာသား</label>
                  <textarea
                    rows={3}
                    value={broadcastBody}
                    onChange={(e) => setBroadcastBody(e.target.value)}
                    placeholder="ဝန်ထမ်းများအားလုံး သိရှိစေရန်..."
                    className="w-full bg-[#071810] border border-[#C8A951]/30 rounded-lg px-3 py-2 text-xs text-white"
                  />
                </div>

                <button
                  onClick={handleSendBroadcast}
                  disabled={sendingBroadcast}
                  className={`w-full py-2.5 rounded-xl border font-bold text-xs flex items-center justify-center gap-2 active:scale-95 transition duration-150 ${
                    btnStates['staff_broadcast'] === 'success'
                      ? 'bg-emerald-500 text-black border-emerald-400'
                      : 'bg-white/10 text-[#C8A951] border-[#C8A951]/40 hover:bg-white/20'
                  }`}
                >
                  <Send className="w-4 h-4" />
                  {sendingBroadcast
                    ? 'ပေးပို့နေပါသည်...'
                    : btnStates['staff_broadcast'] === 'success'
                    ? '✅ Announcement Sent ✓'
                    : 'Send Staff Announcement'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* TAB 6: DELIVERY LOGS */}
        {activeTab === 'logs' && (
          <div className="space-y-3">
            <h3 className="text-xs font-bold text-[#C8A951]">
              📜 နောက်ဆုံး ပေးပို့ခဲ့သော Telegram Notification မှတ်တမ်းများ (Recent Logs)
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
          🌟 QUICK MANUAL BOOKING, CONFLICT CHECK & DEPOSIT/BALANCE MODAL 🌟
      ============================================================================ */}
      {manualBookingTarget && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-[#0B2419] border-2 border-[#C8A951] rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden my-auto">
            {/* Modal Header */}
            <div className="px-5 py-4 bg-gradient-to-r from-[#071810] via-[#0B2419] to-[#071810] border-b border-[#C8A951]/30 flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-[#C8A951] flex items-center gap-2">
                  <CalendarPlus className="w-5 h-5" />
                  Quick Manual Booking & Bot Confirmation Slip
                </h3>
                <p className="text-xs text-stone-300 mt-0.5">
                  Customer: <b className="text-white">{manualBookingTarget.customerName}</b>{' '}
                  {manualBookingTarget.username ? `(@${manualBookingTarget.username})` : ''} • Chat ID:{' '}
                  <code className="text-emerald-300 font-mono">{manualBookingTarget.chatId}</code>
                </p>
              </div>
              <button
                type="button"
                onClick={() => setManualBookingTarget(null)}
                className="p-1.5 rounded-lg bg-white/5 hover:bg-white/15 text-stone-300 hover:text-white transition"
              >
                ✕
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 space-y-4 max-h-[80vh] overflow-y-auto text-xs">
              {/* Row 1: Customer Phone & Booking Mode */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[#C8A951] font-semibold mb-1 flex items-center gap-1">
                    <Phone className="w-3.5 h-3.5" /> Customer ဖုန်းနံပါတ် (Auto-Sync)
                  </label>
                  <input
                    type="text"
                    value={mbPhone}
                    onChange={(e) => setMbPhone(e.target.value)}
                    placeholder="09-xxxxxxxxx (မရှိပါက အလွတ်ထားနိုင်သည်)"
                    className="w-full bg-[#071810] border border-[#C8A951]/30 rounded-lg px-3 py-2 text-white font-mono"
                  />
                </div>

                <div>
                  <label className="block text-[#C8A951] font-semibold mb-1 flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5" /> Booking အမျိုးအစား (Service Mode)
                  </label>
                  <select
                    value={mbBookingType}
                    onChange={(e) => {
                      const val = e.target.value as any;
                      setMbBookingType(val);
                      if (val === 'in_spa') {
                        setMbRoomOrLocation('VIP Private Suite');
                      } else if (val === 'outcall_hotel') {
                        setMbRoomOrLocation('Hotel Outcall (ဟိုတယ်အမည်/အခန်းနံပါတ် ထည့်ရန်)');
                      } else if (val === 'outcall_home') {
                        setMbRoomOrLocation('Home Outcall (အိမ်လိပ်စာ ထည့်ရန်)');
                      } else if (val === 'half_day') {
                        setMbTotalPrice(90000);
                        setMbRoomOrLocation('Half-Day Outcall');
                      } else if (val === 'night_call') {
                        setMbTotalPrice(120000);
                        setMbTime('08:00 PM');
                        setMbRoomOrLocation('Whole Night Outcall (8:00 PM - 8:00 AM)');
                      }
                    }}
                    className="w-full bg-[#071810] border border-[#C8A951]/30 rounded-lg px-3 py-2 text-white"
                  >
                    <option value="in_spa">🏢 In-Spa Retreat (ဆိုင်တွင်လာရောက်မည်)</option>
                    <option value="outcall_hotel">🏨 Hotel Outcall (ဟိုတယ်သို့ခေါ်ယူမည်)</option>
                    <option value="outcall_home">🏠 Home Outcall (အိမ်သို့ခေါ်ယူမည်)</option>
                    <option value="half_day">🌤️ Half-Day Service (6 Hours)</option>
                    <option value="night_call">🌙 Whole Night Call (8:00 PM - 8:00 AM)</option>
                  </select>
                </div>
              </div>

              {/* Row 2: Service Selection & Room/Address */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[#C8A951] font-semibold mb-1">
                    💆‍♂️ ဝန်ဆောင်မှု ရွေးချယ်ရန် (Service Package) *
                  </label>
                  <select
                    value={mbServiceId}
                    onChange={(e) => {
                      const id = e.target.value;
                      setMbServiceId(id);
                      const found = catalogServices.find((s) => String(s.id) === id);
                      if (found) {
                        setMbTotalPrice(Number(found.price || 50000));
                      }
                    }}
                    className="w-full bg-[#071810] border border-[#C8A951]/30 rounded-lg px-3 py-2 text-white"
                  >
                    {catalogServices.map((svc) => (
                      <option key={svc.id} value={svc.id}>
                        {svc.name} — {Number(svc.price).toLocaleString()} Ks
                      </option>
                    ))}
                    <option value="custom">✨ Custom Service (စိတ်ကြိုက်ဝန်ဆောင်မှုအမည် ရိုက်ထည့်မည်)</option>
                  </select>
                  {mbServiceId === 'custom' && (
                    <input
                      type="text"
                      value={mbCustomServiceName}
                      onChange={(e) => setMbCustomServiceName(e.target.value)}
                      placeholder="ဝန်ဆောင်မှုအမည် ရိုက်ထည့်ပါ..."
                      className="mt-2 w-full bg-[#071810] border border-[#C8A951]/40 rounded-lg px-3 py-1.5 text-white"
                    />
                  )}
                </div>

                <div>
                  <label className="block text-[#C8A951] font-semibold mb-1">
                    📍 အခန်းအမည် သို့မဟုတ် ဟိုတယ်/အိမ်လိပ်စာ (Room / Location)
                  </label>
                  <input
                    type="text"
                    value={mbRoomOrLocation}
                    onChange={(e) => setMbRoomOrLocation(e.target.value)}
                    placeholder="ဥပမာ - VIP Suite 1 သို့မဟုတ် Hotel Hazel Room 305"
                    className="w-full bg-[#071810] border border-[#C8A951]/30 rounded-lg px-3 py-2 text-white"
                  />
                </div>
              </div>

              {/* Row 3: Staff Selection & Date */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
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

              {/* Row 4: Real-Time Staff Availability & Time-Slot Conflict Grid */}
              <div className="bg-black/30 p-3.5 rounded-xl border border-[#C8A951]/25 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-[#C8A951] font-bold flex items-center gap-1.5">
                    <Clock className="w-4 h-4" />
                    အချိန်ရွေးချယ်ရန် ({mbStaffId} ၏ {mbDate} ရက်နေ့ အား/မအား Real-Time စစ်ဆေးချက်) *
                  </label>
                  <span className="text-[11px] text-stone-400">
                    ကြာချိန်: <b className="text-emerald-300">{currentModalDurationMins} Mins</b>
                  </span>
                </div>

                <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
                  {MANUAL_TIME_SLOTS.map((slot) => {
                    const conflict = checkStaffSlotConflict(
                      mbStaffId,
                      mbDate,
                      slot,
                      currentModalDurationMins
                    );
                    const isSelected = mbTime === slot;

                    return (
                      <button
                        key={slot}
                        type="button"
                        disabled={conflict.isBooked}
                        onClick={() => setMbTime(slot)}
                        className={`py-2 px-1.5 rounded-lg text-[11px] font-bold border transition flex flex-col items-center justify-center ${
                          conflict.isBooked
                            ? 'bg-red-950/50 border-red-500/40 text-red-300/80 cursor-not-allowed opacity-75'
                            : isSelected
                            ? 'bg-[#C8A951] border-white text-[#071810] shadow-md scale-[1.02]'
                            : 'bg-[#071810] border-[#C8A951]/30 text-stone-200 hover:border-[#C8A951]'
                        }`}
                        title={conflict.isBooked ? `Booked: ${conflict.conflictDetail}` : 'Available'}
                      >
                        <span>{slot}</span>
                        {conflict.isBooked ? (
                          <span className="text-[9px] text-red-400 font-normal truncate max-w-full">
                            🔒 Booked
                          </span>
                        ) : (
                          <span
                            className={`text-[9px] font-normal ${
                              isSelected ? 'text-[#071810] font-semibold' : 'text-emerald-400'
                            }`}
                          >
                            {isSelected ? '✓ Selected' : '🟢 Free'}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Row 5: Payment Method, Deposit (စရံငွေ) & Auto Remaining Balance (ကျန်ငွေ) */}
              <div className="bg-gradient-to-br from-[#071810] to-black/60 p-4 rounded-xl border border-[#C8A951]/40 space-y-3">
                <div className="flex items-center justify-between border-b border-[#C8A951]/20 pb-2">
                  <h4 className="font-bold text-[#C8A951] flex items-center gap-1.5">
                    <Wallet className="w-4 h-4" />
                    💳 ငွေပေးချေမှုစနစ်၊ စရံငွေ (Deposit) နှင့် ကျန်ငွေ (Balance) တွက်ချက်မှု
                  </h4>
                  <div className="flex items-center gap-1">
                    {[
                      { label: 'စရံမရှိ (0)', ratio: 0 },
                      { label: '30%', ratio: 0.3 },
                      { label: '50%', ratio: 0.5 },
                      { label: 'အပြည့်ရှင်း (100%)', ratio: 1 },
                    ].map((preset) => (
                      <button
                        key={preset.label}
                        type="button"
                        onClick={() => setMbDepositAmount(Math.round((Number(mbTotalPrice) || 0) * preset.ratio))}
                        className="px-2 py-0.5 rounded bg-[#C8A951]/15 hover:bg-[#C8A951]/30 text-[#C8A951] border border-[#C8A951]/30 text-[10px] font-semibold active:scale-95 transition"
                      >
                        {preset.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                  <div>
                    <label className="block text-[11px] text-stone-300 mb-1">
                      ငွေပေးချေသည့် နည်းလမ်း
                    </label>
                    <select
                      value={mbPaymentMethod}
                      onChange={(e) => setMbPaymentMethod(e.target.value)}
                      className="w-full bg-[#0B2419] border border-[#C8A951]/30 rounded-lg px-2.5 py-2 text-white font-semibold"
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
                      စုစုပေါင်းကျသင့်ငွေ (Total MMK)
                    </label>
                    <input
                      type="number"
                      min={0}
                      step={1000}
                      value={mbTotalPrice}
                      onChange={(e) => setMbTotalPrice(Math.max(0, Number(e.target.value) || 0))}
                      className="w-full bg-[#0B2419] border border-[#C8A951]/30 rounded-lg px-2.5 py-2 text-white font-mono font-bold"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] text-emerald-300 font-semibold mb-1">
                      လွှဲထားသော စရံငွေ (Deposit MMK)
                    </label>
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
                      ကျန်ငွေ (Remaining Balance)
                    </label>
                    <div className="w-full bg-black/50 border border-amber-400/50 rounded-lg px-2.5 py-2 text-amber-300 font-mono font-extrabold flex items-center justify-between">
                      <span>{computedRemainingBalance.toLocaleString()}</span>
                      <span className="text-[10px] text-stone-400">Ks</span>
                    </div>
                  </div>
                </div>

                {/* Live Summary Bar & Transaction Ref */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                  <input
                    type="text"
                    value={mbPaymentRef}
                    onChange={(e) => setMbPaymentRef(e.target.value)}
                    placeholder="ငွေလွှဲပြေစာ အမှတ်စဉ် (Last 4/6 Digits - Optional)"
                    className="bg-[#0B2419] border border-[#C8A951]/25 rounded-lg px-3 py-1.5 text-xs text-white font-mono"
                  />
                  <input
                    type="text"
                    value={mbNotes}
                    onChange={(e) => setMbNotes(e.target.value)}
                    placeholder="အထူးမှတ်ချက် (ဥပမာ - Carebeau Oil / အခန်းအေးအေးလေး ပြင်ပေးရန်)"
                    className="bg-[#0B2419] border border-[#C8A951]/25 rounded-lg px-3 py-1.5 text-xs text-white"
                  />
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 bg-emerald-950/40 border border-emerald-500/30 rounded-lg px-3 py-2 text-[11px]">
                  <span className="text-stone-300">
                    💳 ပေးချေမှု: <b className="text-white">{mbPaymentMethod}</b>
                  </span>
                  <span className="text-stone-300">
                    စုစုပေါင်း: <b className="text-white">{Number(mbTotalPrice || 0).toLocaleString()} Ks</b>
                  </span>
                  <span className="text-emerald-300">
                    စရံငွေ: <b>{Number(mbDepositAmount || 0).toLocaleString()} Ks</b>
                  </span>
                  <span className="text-amber-300 font-bold">
                    ထပ်ရှင်းရန်ကျန်ငွေ: {computedRemainingBalance.toLocaleString()} Ks
                  </span>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-5 py-3.5 bg-[#071810] border-t border-[#C8A951]/30 flex items-center justify-between gap-3">
              <div className="text-[11px] text-stone-400">
                Confirm နှိပ်လိုက်သည်နှင့် <b>{mbStaffId}</b> ၏ <b>{mbTime || '...'}</b> Time Slot ကို Lock ချပြီး Bot မှ Slip ပို့ပေးပါမည်။
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setManualBookingTarget(null)}
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
                      : 'bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 text-black'
                  }`}
                >
                  {isSubmittingManualBooking ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      Confirming & Sending...
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
