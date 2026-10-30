import {
  doc,
  getDoc,
  setDoc,
  getDocs,
  updateDoc,
  collection,
  addDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from './firebase';

// ==========================================
// 1. TYPES & INTERFACES
// ==========================================

export interface StaffTelegramMapping {
  staffId: string;
  staffName: string;
  telegramChatId: string;
  receiveBookingAssign: boolean;
  receiveRosterUpdate: boolean;
  receivePenaltyAlert: boolean;
  receivePayrollAlert: boolean;
}

export interface CustomerTelegramSubscriber {
  chatId: string;
  customerName: string;
  customerPhone: string;
  username?: string;
  firstName?: string;
  lastName?: string;
  vipTier?: string;
  subscribed: boolean;
  source?: 'mini_app' | 'booking_deeplink' | 'bot_command' | 'admin_manual';
  lastBookingId?: string;
  subscribedAt: string;
  updatedAt: string;
}

export interface TelegramBotConfig {
  enabled: boolean;
  botToken: string;
  botUsername?: string;
  adminGroupChatId: string;
  staffGroupChatId: string;
  webAppUrl: string;
  triggers: {
    newBooking: boolean;
    bookingConfirmed: boolean;
    bookingInService: boolean;
    bookingCompleted: boolean;
    bookingCancelled: boolean;
    staffAssigned: boolean;
    dutyRosterUpdated: boolean;
    penaltyIssued: boolean;
    payrollGenerated: boolean;
    dailySalesSummary: boolean;
    customerDirectNoti?: boolean;
    customerPromoBroadcast?: boolean;
  };
  botFlow: {
    enableInlineButtons: boolean;
    enableWebAppButton: boolean;
    welcomeMessage: string;
    bookingHelpMessage: string;
    staffBindInstruction: string;
    customFooterText: string;
  };
  templates: {
    newBookingTitle: string;
    statusUpdateTitle: string;
    staffAssignTitle: string;
  };
  staffMappings: StaffTelegramMapping[];
}

export interface BookingNotificationPayload {
  id: string;
  customerName: string;
  customerPhone: string;
  customerChatId?: string;
  serviceName: string;
  duration?: string | number;
  price?: number;
  date: string;
  time: string;
  therapistId?: string;
  therapistName?: string;
  roomName?: string;
  vipTier?: string;
  status: 'pending' | 'confirmed' | 'in-service' | 'completed' | 'cancelled' | string;
  notes?: string;
  updatedBy?: string;
}

export interface StaffNotificationPayload {
  type: 'ROSTER_UPDATE' | 'PENALTY_ISSUED' | 'REWARD_ISSUED' | 'PAYROLL_READY' | 'GENERAL_ANNOUNCEMENT';
  staffId?: string;
  staffName: string;
  title: string;
  details: string;
  amount?: number;
  effectiveDate: string;
  issuedBy?: string;
}

export interface CustomerBroadcastPayload {
  title: string;
  message: string;
  imageUrl?: string;
  targetAudience: 'ALL' | 'VIP_ONLY' | 'SELECTED';
  selectedChatIds?: string[];
  buttonText?: string;
  buttonTab?: 'booking' | 'therapists' | 'available' | 'history' | 'vip';
}

// ==========================================
// 2. DEFAULT CONFIGURATION
// ==========================================

export const DEFAULT_TELEGRAM_CONFIG: TelegramBotConfig = {
  enabled: true,
  botToken: import.meta.env.VITE_TELEGRAM_BOT_TOKEN || '',
  botUsername: import.meta.env.VITE_TELEGRAM_BOT_USERNAME || '',
  adminGroupChatId: import.meta.env.VITE_TELEGRAM_CHAT_ID || '',
  staffGroupChatId: '',
  webAppUrl: 'https://www.shangrilamenretreat.online',
  triggers: {
    newBooking: true,
    bookingConfirmed: true,
    bookingInService: true,
    bookingCompleted: true,
    bookingCancelled: true,
    staffAssigned: true,
    dutyRosterUpdated: true,
    penaltyIssued: true,
    payrollGenerated: true,
    dailySalesSummary: true,
    customerDirectNoti: true,
    customerPromoBroadcast: true,
  },
  botFlow: {
    enableInlineButtons: true,
    enableWebAppButton: true,
    welcomeMessage:
      "🌿 THE SHANGRI-LA MEN'S RETREAT မှ ကြိုဆိုပါတယ်။ သီးသန့် အဆင့်မြင့် ဝန်ဆောင်မှုများအတွက် အောက်ပါ Mini App Menu ခလုတ်များမှတစ်ဆင့် ရက်ချိန်းရယူခြင်း၊ ဝန်ထမ်းပုံကြည့်ရှုခြင်းနှင့် ဘိုကင်အခြေအနေ စစ်ဆေးခြင်းများ ပြုလုပ်နိုင်ပါသည်။",
    bookingHelpMessage:
      '📅 ရက်ချိန်းရယူရန် အောက်ပါ Mini App ခလုတ်ကိုနှိပ်ပါ သို့မဟုတ် Reception (09-458884517, 09-770072190) သို့ တိုက်ရိုက်ဆက်သွယ်နိုင်ပါသည်။',
    staffBindInstruction:
      '👨‍💼 ဝန်ထမ်းများ မိမိ၏ Chat ID ချိတ်ဆက်လိုပါက ဤ Bot သို့ မိမိအမည် သို့မဟုတ် အမှတ်စဉ် (ဥပမာ - No. 1) ပေးပို့ထားပါ။',
    customFooterText: "✨ The Shangri-La Men's Retreat • Mandalay",
  },
  templates: {
    newBookingTitle: '🔔 ရက်ချိန်းအသစ် ဝင်ရောက်လာပါသည် (NEW BOOKING)',
    statusUpdateTitle: '🔄 ရက်ချိန်း အခြေအနေ ပြောင်းလဲမှု (STATUS UPDATE)',
    staffAssignTitle: '👨‍💼 ဝန်ဆောင်မှု တာဝန်ချထားခြင်း (THERAPIST ASSIGNED)',
  },
  staffMappings: [
    { staffId: 'No. 1', staffName: 'Therapist No. 1', telegramChatId: '', receiveBookingAssign: true, receiveRosterUpdate: true, receivePenaltyAlert: true, receivePayrollAlert: true },
    { staffId: 'No. 3', staffName: 'Therapist No. 3', telegramChatId: '', receiveBookingAssign: true, receiveRosterUpdate: true, receivePenaltyAlert: true, receivePayrollAlert: true },
    { staffId: 'No. 6', staffName: 'Therapist No. 6', telegramChatId: '', receiveBookingAssign: true, receiveRosterUpdate: true, receivePenaltyAlert: true, receivePayrollAlert: true },
    { staffId: 'No. 7', staffName: 'Therapist No. 7', telegramChatId: '', receiveBookingAssign: true, receiveRosterUpdate: true, receivePenaltyAlert: true, receivePayrollAlert: true },
    { staffId: 'No. 9', staffName: 'Therapist No. 9', telegramChatId: '', receiveBookingAssign: true, receiveRosterUpdate: true, receivePenaltyAlert: true, receivePayrollAlert: true },
    { staffId: 'No. 10', staffName: 'Therapist No. 10', telegramChatId: '', receiveBookingAssign: true, receiveRosterUpdate: true, receivePenaltyAlert: true, receivePayrollAlert: true },
    { staffId: 'No. 11', staffName: 'Therapist No. 11', telegramChatId: '', receiveBookingAssign: true, receiveRosterUpdate: true, receivePenaltyAlert: true, receivePayrollAlert: true },
    { staffId: 'No. 12', staffName: 'Therapist No. 12', telegramChatId: '', receiveBookingAssign: true, receiveRosterUpdate: true, receivePenaltyAlert: true, receivePayrollAlert: true },
    { staffId: 'No. 13', staffName: 'Therapist No. 13', telegramChatId: '', receiveBookingAssign: true, receiveRosterUpdate: true, receivePenaltyAlert: true, receivePayrollAlert: true },
    { staffId: 'No. 14', staffName: 'Therapist No. 14', telegramChatId: '', receiveBookingAssign: true, receiveRosterUpdate: true, receivePenaltyAlert: true, receivePayrollAlert: true },
    { staffId: 'Manager', staffName: 'Shop Manager', telegramChatId: '', receiveBookingAssign: true, receiveRosterUpdate: true, receivePenaltyAlert: true, receivePayrollAlert: true },
  ],
};

// ==========================================
// 3. HELPER FUNCTIONS
// ==========================================

export const escapeHtml = (unsafe: string | number | undefined | null): string => {
  if (unsafe === undefined || unsafe === null) return '-';
  return String(unsafe)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
};

export const normalizePhone = (phone: string | undefined | null): string => {
  if (!phone) return '';
  const digits = String(phone).replace(/[^0-9]/g, '');
  if (digits.startsWith('959')) return '09' + digits.slice(3);
  if (digits.startsWith('9') && digits.length >= 8) return '0' + digits;
  return digits;
};

export const getTelegramConfig = async (): Promise<TelegramBotConfig> => {
  try {
    const docRef = doc(db, 'settings', 'telegramConfig');
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      const data = snap.data() as Partial<TelegramBotConfig>;
      return {
        ...DEFAULT_TELEGRAM_CONFIG,
        ...data,
        triggers: { ...DEFAULT_TELEGRAM_CONFIG.triggers, ...(data.triggers || {}) },
        botFlow: { ...DEFAULT_TELEGRAM_CONFIG.botFlow, ...(data.botFlow || {}) },
        templates: { ...DEFAULT_TELEGRAM_CONFIG.templates, ...(data.templates || {}) },
        staffMappings: data.staffMappings || DEFAULT_TELEGRAM_CONFIG.staffMappings,
      };
    } else {
      await setDoc(docRef, DEFAULT_TELEGRAM_CONFIG);
      return DEFAULT_TELEGRAM_CONFIG;
    }
  } catch (error) {
    console.error('Error loading Telegram config from Firestore:', error);
    return DEFAULT_TELEGRAM_CONFIG;
  }
};

export const saveTelegramConfig = async (config: TelegramBotConfig): Promise<boolean> => {
  try {
    const docRef = doc(db, 'settings', 'telegramConfig');
    await setDoc(docRef, { ...config, updatedAt: new Date().toISOString() }, { merge: true });
    return true;
  } catch (error) {
    console.error('Error saving Telegram config:', error);
    return false;
  }
};

const logTelegramActivity = async (
  type: string,
  targetChatId: string,
  status: 'SUCCESS' | 'FAILED',
  summary: string,
  errorDetail?: string
) => {
  try {
    await addDoc(collection(db, 'telegramLogs'), {
      type,
      targetChatId,
      status,
      summary,
      errorDetail: errorDetail || null,
      createdAt: serverTimestamp(),
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    console.warn('Could not write telegram log:', err);
  }
};

/**
 * Mini App အတွင်းရှိ သက်ဆိုင်ရာ Tab သို့ တိုက်ရိုက်ပွင့်စေမည့် Inline Keyboard တည်ဆောက်ပေးခြင်း
 */
export const buildCustomerMiniAppInlineKeyboard = (baseUrl: string = 'https://www.shangrilamenretreat.online') => {
  const cleanUrl = baseUrl.replace(/\/$/, '');
  return {
    inline_keyboard: [
      [
        {
          text: '📅 ဘိုကင်တင်ရန် (Book Now)',
          web_app: { url: `${cleanUrl}/?tab=booking` },
        },
      ],
      [
        {
          text: '👥 ဝန်ထမ်းပုံကြည့်ရန်',
          web_app: { url: `${cleanUrl}/?tab=therapists` },
        },
        {
          text: '🟢 အားနေသောဝန်ထမ်းများ',
          web_app: { url: `${cleanUrl}/?tab=available` },
        },
      ],
      [
        {
          text: '📋 My Booking History & Status',
          web_app: { url: `${cleanUrl}/?tab=history` },
        },
      ],
      [
        {
          text: '👑 VIP Member & Privileges',
          web_app: { url: `${cleanUrl}/?tab=vip` },
        },
      ],
    ],
  };
};

// ==========================================
// 4. CORE TELEGRAM API SENDERS (MESSAGE & PHOTO)
// ==========================================

export const sendRawTelegramMessage = async (
  botToken: string,
  chatId: string,
  htmlText: string,
  replyMarkup?: object,
  logType: string = 'SYSTEM'
): Promise<{ ok: boolean; error?: string }> => {
  if (!botToken || !chatId) {
    return { ok: false, error: 'Missing Bot Token or Chat ID' };
  }

  const url = `https://api.telegram.org/bot${botToken.trim()}/sendMessage`;

  try {
    const bodyPayload: Record<string, unknown> = {
      chat_id: chatId.trim(),
      text: htmlText,
      parse_mode: 'HTML',
      disable_web_page_preview: true,
    };

    if (replyMarkup) {
      bodyPayload.reply_markup = replyMarkup;
    }

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(bodyPayload),
    });

    const data = await response.json();

    if (!response.ok || !data.ok) {
      const errMsg = data.description || `HTTP Error ${response.status}`;
      await logTelegramActivity(logType, chatId, 'FAILED', htmlText.slice(0, 120), errMsg);
      return { ok: false, error: errMsg };
    }

    await logTelegramActivity(logType, chatId, 'SUCCESS', htmlText.slice(0, 120));
    return { ok: true };
  } catch (error: any) {
    const errMsg = error?.message || 'Network request failed';
    await logTelegramActivity(logType, chatId, 'FAILED', htmlText.slice(0, 120), errMsg);
    return { ok: false, error: errMsg };
  }
};

export const sendRawTelegramPhoto = async (
  botToken: string,
  chatId: string,
  photoUrl: string,
  htmlCaption: string,
  replyMarkup?: object,
  logType: string = 'PROMO_PHOTO'
): Promise<{ ok: boolean; error?: string }> => {
  if (!botToken || !chatId || !photoUrl) {
    return { ok: false, error: 'Missing Bot Token, Chat ID, or Photo URL' };
  }

  const url = `https://api.telegram.org/bot${botToken.trim()}/sendPhoto`;

  try {
    const bodyPayload: Record<string, unknown> = {
      chat_id: chatId.trim(),
      photo: photoUrl.trim(),
      caption: htmlCaption,
      parse_mode: 'HTML',
    };

    if (replyMarkup) {
      bodyPayload.reply_markup = replyMarkup;
    }

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(bodyPayload),
    });

    const data = await response.json();

    if (!response.ok || !data.ok) {
      // Fallback to text message if image URL fails to load on Telegram server
      return sendRawTelegramMessage(
        botToken,
        chatId,
        `${htmlCaption}\n\n🖼 <a href="${escapeHtml(photoUrl)}">ပရိုမိုးရှင်းပုံကြည့်ရန်</a>`,
        replyMarkup,
        logType
      );
    }

    await logTelegramActivity(logType, chatId, 'SUCCESS', `[PHOTO] ${htmlCaption.slice(0, 100)}`);
    return { ok: true };
  } catch (error: any) {
    const errMsg = error?.message || 'Network request failed';
    await logTelegramActivity(logType, chatId, 'FAILED', htmlCaption.slice(0, 120), errMsg);
    return { ok: false, error: errMsg };
  }
};

// ==========================================
// 5. CUSTOMER SUBSCRIBER MANAGEMENT & AUTO-CAPTURE
// ==========================================

/**
 * Telegram Mini App မှ ဝင်လာသော Customer ၏ Chat ID နှင့် အချက်အလက်ကို window.Telegram.WebApp သို့မဟုတ် localStorage မှ ဖတ်ယူခြင်း
 */
export const getDetectedTelegramWebAppUser = (): {
  chatId: string;
  firstName: string;
  lastName: string;
  username: string;
} | null => {
  try {
    const tg = (window as any)?.Telegram?.WebApp;
    const liveUser = tg?.initDataUnsafe?.user;
    if (liveUser && liveUser.id) {
      const userObj = {
        chatId: String(liveUser.id),
        firstName: liveUser.first_name || '',
        lastName: liveUser.last_name || '',
        username: liveUser.username || '',
      };
      localStorage.setItem('shangrila_tg_user', JSON.stringify(userObj));
      localStorage.setItem('shangrila_customer_chat_id', userObj.chatId);
      return userObj;
    }

    const cached = localStorage.getItem('shangrila_tg_user');
    if (cached) {
      const parsed = JSON.parse(cached);
      if (parsed?.chatId) return parsed;
    }

    const savedChatId = localStorage.getItem('shangrila_customer_chat_id');
    if (savedChatId) {
      return { chatId: savedChatId, firstName: '', lastName: '', username: '' };
    }
  } catch (e) {
    console.warn('Error reading Telegram WebApp user:', e);
  }
  return null;
};

/**
 * Customer ၏ Telegram Chat ID ကို Firestore 'telegramSubscribers' collection တွင် သိမ်းဆည်းခြင်း (Auto-Subscribe)
 */
export const saveCustomerTelegramSubscription = async (
  subscriber: Partial<CustomerTelegramSubscriber> & { chatId: string }
): Promise<boolean> => {
  if (!subscriber.chatId) return false;
  try {
    const cleanChatId = String(subscriber.chatId).trim();
    const docRef = doc(db, 'telegramSubscribers', cleanChatId);
    const existingSnap = await getDoc(docRef);
    const existingData = existingSnap.exists() ? (existingSnap.data() as CustomerTelegramSubscriber) : null;

    const nowIso = new Date().toISOString();
    const normalizedPhone = normalizePhone(subscriber.customerPhone || existingData?.customerPhone || '');

    const payload: CustomerTelegramSubscriber = {
      chatId: cleanChatId,
      customerName:
        subscriber.customerName ||
        existingData?.customerName ||
        [subscriber.firstName, subscriber.lastName].filter(Boolean).join(' ') ||
        'Shangri-La Guest',
      customerPhone: normalizedPhone || subscriber.customerPhone || existingData?.customerPhone || '',
      username: subscriber.username ?? existingData?.username ?? '',
      firstName: subscriber.firstName ?? existingData?.firstName ?? '',
      lastName: subscriber.lastName ?? existingData?.lastName ?? '',
      vipTier: subscriber.vipTier ?? existingData?.vipTier ?? 'Member',
      subscribed: subscriber.subscribed !== undefined ? subscriber.subscribed : true,
      source: subscriber.source || existingData?.source || 'mini_app',
      lastBookingId: subscriber.lastBookingId || existingData?.lastBookingId || '',
      subscribedAt: existingData?.subscribedAt || nowIso,
      updatedAt: nowIso,
    };

    await setDoc(docRef, payload, { merge: true });
    localStorage.setItem('shangrila_customer_chat_id', cleanChatId);
    return true;
  } catch (error) {
    console.error('Error saving customer telegram subscription:', error);
    return false;
  }
};

/**
 * Customer များအားလုံး၏ Telegram Subscription စာရင်းကို Firestore မှ ဆွဲယူခြင်း
 */
export const getCustomerTelegramSubscribers = async (): Promise<CustomerTelegramSubscriber[]> => {
  try {
    const snap = await getDocs(collection(db, 'telegramSubscribers'));
    const list: CustomerTelegramSubscriber[] = [];
    snap.forEach((docSnap) => {
      const data = docSnap.data() as CustomerTelegramSubscriber;
      if (data && data.chatId) {
        list.push(data);
      }
    });
    return list.sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''));
  } catch (error) {
    console.error('Error fetching telegram subscribers:', error);
    return [];
  }
};

/**
 * Customer ၏ ဖုန်းနံပါတ် သို့မဟုတ် Booking မှတစ်ဆင့် ၎င်း၏ Telegram Chat ID ကို ရှာဖွေပေးခြင်း
 */
export const findCustomerChatId = async (
  customerPhone?: string,
  explicitChatId?: string
): Promise<string | null> => {
  if (explicitChatId && String(explicitChatId).trim()) {
    return String(explicitChatId).trim();
  }
  const cleanTargetPhone = normalizePhone(customerPhone);
  if (!cleanTargetPhone) return null;

  try {
    const subscribers = await getCustomerTelegramSubscribers();
    const matched = subscribers.find(
      (s) => s.subscribed !== false && normalizePhone(s.customerPhone) === cleanTargetPhone
    );
    return matched ? matched.chatId : null;
  } catch {
    return null;
  }
};

/**
 * Mini App ဖွင့်လိုက်သည်နှင့် အလိုအလျောက် Subscribe လုပ်ပေးမည့် Helper
 */
export const autoSubscribeFromTelegramWebApp = async (
  customerName?: string,
  customerPhone?: string,
  vipTier?: string
): Promise<string | null> => {
  const detected = getDetectedTelegramWebAppUser();
  if (!detected || !detected.chatId) return null;

  await saveCustomerTelegramSubscription({
    chatId: detected.chatId,
    customerName: customerName || [detected.firstName, detected.lastName].filter(Boolean).join(' '),
    customerPhone: customerPhone || '',
    username: detected.username,
    firstName: detected.firstName,
    lastName: detected.lastName,
    vipTier: vipTier || 'Member',
    subscribed: true,
    source: 'mini_app',
  });

  return detected.chatId;
};

/**
 * Bot Username ကို Telegram getMe API မှ အလိုအလျောက် ဆွဲယူခြင်း
 */
export const fetchBotUsername = async (botToken?: string): Promise<string> => {
  try {
    const config = await getTelegramConfig();
    if (config.botUsername) return config.botUsername.replace(/^@/, '');
    const token = botToken || config.botToken;
    if (!token) return '';

    const res = await fetch(`https://api.telegram.org/bot${token.trim()}/getMe`);
    const data = await res.json();
    if (data?.ok && data?.result?.username) {
      const uname = data.result.username;
      await saveTelegramConfig({ ...config, botUsername: uname });
      return uname;
    }
  } catch (e) {
    console.warn('Could not fetch bot username:', e);
  }
  return '';
};

/**
 * ဘိုကင်တင်သည့် နောက်ဆုံးအဆင့်နှင့် Subscribe ခလုတ်တို့အတွက် Deep-Link URL ထုတ်ပေးခြင်း
 * ဥပမာ - https://t.me/YourBot?start=book_BK123_09458884517
 */
export const buildCustomerTelegramDeepLink = async (params: {
  mode: 'subscribe' | 'booking_notify';
  bookingId?: string;
  customerPhone?: string;
  customerName?: string;
}): Promise<string> => {
  const botUsername = await fetchBotUsername();
  const cleanPhone = normalizePhone(params.customerPhone) || 'guest';
  const cleanBookingId = (params.bookingId || '').replace(/[^a-zA-Z0-9]/g, '').slice(-12);

  const startPayload =
    params.mode === 'booking_notify' && cleanBookingId
      ? `book_${cleanBookingId}_${cleanPhone}`
      : `sub_${cleanPhone}`;

  if (botUsername) {
    return `https://t.me/${botUsername}?start=${startPayload}`;
  }
  return `https://t.me/?start=${startPayload}`;
};

// ==========================================
// 6. BOOKING REAL-TIME NOTIFICATIONS (ADMIN + STAFF + CUSTOMER)
// ==========================================

const getStatusBadge = (status: string): string => {
  switch (status.toLowerCase()) {
    case 'pending':
      return '🟡 <b>စောင့်ဆိုင်းဆဲ (PENDING)</b>';
    case 'confirmed':
      return '🟢 <b>အတည်ပြုပြီး (CONFIRMED)</b>';
    case 'in-service':
    case 'in_service':
      return '💆‍♂️ <b>ဝန်ဆောင်မှုပေးနေဆဲ (IN-SERVICE)</b>';
    case 'completed':
      return '✨ <b>ပြီးဆုံးပါပြီ (COMPLETED)</b>';
    case 'cancelled':
      return '🔴 <b>ပယ်ဖျက်ထားသည် (CANCELLED)</b>';
    default:
      return `📌 <b>${escapeHtml(status.toUpperCase())}</b>`;
  }
};

/**
 * Customer ထံသို့ တိုက်ရိုက်ပေးပို့မည့် Booking Status Update Message
 */
export const notifyCustomerBookingStatus = async (
  eventType: 'NEW_BOOKING' | 'STATUS_UPDATE' | 'STAFF_ASSIGNED',
  booking: BookingNotificationPayload,
  existingConfig?: TelegramBotConfig
): Promise<{ customerSent: boolean; error?: string }> => {
  const config = existingConfig || (await getTelegramConfig());
  if (!config.enabled || !config.botToken || config.triggers.customerDirectNoti === false) {
    return { customerSent: false };
  }

  const targetChatId = await findCustomerChatId(booking.customerPhone, booking.customerChatId);
  if (!targetChatId) {
    return { customerSent: false, error: 'Customer Chat ID not subscribed yet' };
  }

  // Save/update customer subscriber profile with latest booking info
  await saveCustomerTelegramSubscription({
    chatId: targetChatId,
    customerName: booking.customerName,
    customerPhone: booking.customerPhone,
    vipTier: booking.vipTier,
    lastBookingId: booking.id,
  });

  const statusLower = booking.status.toLowerCase();
  const formattedPrice = booking.price ? `${Number(booking.price).toLocaleString()} MMK` : '-';

  let customerTitle = '🌿 <b>THE SHANGRI-LA MEN\'S RETREAT</b>';
  let statusIntro = 'သင်၏ ရက်ချိန်းအချက်အလက် အောက်ပါအတိုင်း ဖြစ်ပါသည် -';

  if (eventType === 'NEW_BOOKING' || statusLower === 'pending') {
    customerTitle = '🔔 <b>ဘိုကင်တင်ခြင်း လက်ခံရရှိပါသည် (BOOKING RECEIVED)</b>';
    statusIntro =
      'လူကြီးမင်း၏ ရက်ချိန်းတောင်းဆိုမှုကို လက်ခံရရှိပါသည်။ Admin အဖွဲ့မှ အမြန်ဆုံး စစ်ဆေးအတည်ပြုပေးပါမည်။';
  } else if (statusLower === 'confirmed' || eventType === 'STAFF_ASSIGNED') {
    customerTitle = '✅ <b>သင်၏ ရက်ချိန်းကို အတည်ပြုပြီးပါပြီ (BOOKING CONFIRMED)</b>';
    statusIntro =
      'လူကြီးမင်း၏ ဘိုကင်ကို အတည်ပြုပြီးဖြစ်ပါသည်။ သတ်မှတ်ချိန်မတိုင်မီ (၁၀) မိနစ်ခန့် ကြိုတင်ကြွရောက်ပေးပါရန် လေးစားစွာ ပန်ကြားအပ်ပါသည်။';
  } else if (statusLower === 'in-service' || statusLower === 'in_service') {
    customerTitle = '💆‍♂️ <b>ဝန်ဆောင်မှု စတင်နေပါပြီ (IN-SERVICE)</b>';
    statusIntro = 'The Shangri-La Men\'s Retreat တွင် စိတ်အေးချမ်းသာစွာ အနားယူအပန်းဖြေနိုင်ပါစေကြောင်း ဆုမွန်ကောင်းတောင်းအပ်ပါသည်။';
  } else if (statusLower === 'completed') {
    customerTitle = '✨ <b>ဝန်ဆောင်မှု ပြီးဆုံးပါပြီ (THANK YOU FOR VISITING)</b>';
    statusIntro =
      'လာရောက်အားပေးမှုအတွက် အထူးကျေးဇူးတင်ရှိပါသည်။ နောက်တစ်ကြိမ် ရက်ချိန်းများကိုလည်း အောက်ပါ Mini App မှတစ်ဆင့် အလွယ်တကူ ရယူနိုင်ပါသည်။';
  } else if (statusLower === 'cancelled') {
    customerTitle = '🔴 <b>သင်၏ ရက်ချိန်း ပယ်ဖျက်ထားပါသည် (BOOKING CANCELLED)</b>';
    statusIntro =
      'သင်၏ ရက်ချိန်းကို ပယ်ဖျက်ထားပါသည်။ အချိန်ပြန်လည်ချိန်းဆိုလိုပါက အောက်ပါခလုတ်မှတစ်ဆင့် ပြန်လည်ရယူနိုင်ပါသည်။';
  }

  const customerMsg = [
    customerTitle,
    `━━━━━━━━━━━━━━━━━━━━`,
    statusIntro,
    ``,
    `🆔 <b>Booking ID:</b> <code>#${escapeHtml(booking.id.slice(-6).toUpperCase())}</code>`,
    `📊 <b>Status:</b> ${getStatusBadge(booking.status)}`,
    `👤 <b>အမည်:</b> ${escapeHtml(booking.customerName)}`,
    `💆‍♂️ <b>ဝန်ဆောင်မှု:</b> ${escapeHtml(booking.serviceName)} ${booking.duration ? `(${escapeHtml(booking.duration)} Mins)` : ''}`,
    `💰 <b>ကျသင့်ငွေ:</b> ${escapeHtml(formattedPrice)}`,
    `📅 <b>နေ့ရက် / အချိန်:</b> ${escapeHtml(booking.date)} | ⏰ <b>${escapeHtml(booking.time)}</b>`,
    `👨‍💼 <b>Therapist:</b> ${escapeHtml(booking.therapistName || booking.therapistId || 'အသင့်စီစဉ်ပေးထားပါမည်')}`,
    booking.roomName ? `🚪 <b>အခန်း (Room):</b> ${escapeHtml(booking.roomName)}` : null,
    `━━━━━━━━━━━━━━━━━━━━`,
    `📍 <b>လိပ်စာ:</b> 33th(B) St, Between 65th & 65th(A) Sts, Chan Aye Tharzan Tsp, Mandalay`,
    `📞 <b>ဖုန်း:</b> 09-458884517, 09-770072190`,
    `<i>${escapeHtml(config.botFlow.customFooterText)}</i>`,
  ]
    .filter((line) => line !== null)
    .join('\n');

  const cleanUrl = (config.webAppUrl || 'https://www.shangrilamenretreat.online').replace(/\/$/, '');
  const customerKeyboard = {
    inline_keyboard: [
      [
        {
          text: '📋 My Booking History & Status',
          web_app: { url: `${cleanUrl}/?tab=history` },
        },
      ],
      [
        {
          text: '🟢 အားနေသော ဝန်ထမ်းများကြည့်ရန်',
          web_app: { url: `${cleanUrl}/?tab=available` },
        },
        {
          text: '📅 ဘိုကင်အသစ်တင်ရန်',
          web_app: { url: `${cleanUrl}/?tab=booking` },
        },
      ],
    ],
  };

  const res = await sendRawTelegramMessage(
    config.botToken,
    targetChatId,
    customerMsg,
    customerKeyboard,
    `CUSTOMER_BOOKING_${eventType}`
  );

  return { customerSent: res.ok, error: res.error };
};

/**
 * Booking အသစ် သို့မဟုတ် Status ပြောင်းလဲမှုတိုင်းအတွက် Admin Group + သက်ဆိုင်ရာ ဝန်ထမ်း + Customer ထံသို့ တစ်ပြိုင်နက် ပို့ပေးမည့် Function
 */
export const notifyBookingEvent = async (
  eventType: 'NEW_BOOKING' | 'STATUS_UPDATE' | 'STAFF_ASSIGNED',
  booking: BookingNotificationPayload
): Promise<{ adminSent: boolean; staffSent: boolean; customerSent?: boolean; errors: string[] }> => {
  const config = await getTelegramConfig();
  const errors: string[] = [];

  if (!config.enabled || !config.botToken) {
    return { adminSent: false, staffSent: false, customerSent: false, errors: ['Telegram Bot is disabled or missing token'] };
  }

  // Check if specific trigger is enabled
  const statusLower = booking.status.toLowerCase();
  if (eventType === 'NEW_BOOKING' && !config.triggers.newBooking) {
    return { adminSent: false, staffSent: false, customerSent: false, errors: [] };
  }
  if (eventType === 'STATUS_UPDATE') {
    if (statusLower === 'confirmed' && !config.triggers.bookingConfirmed) return { adminSent: false, staffSent: false, customerSent: false, errors: [] };
    if ((statusLower === 'in-service' || statusLower === 'in_service') && !config.triggers.bookingInService) return { adminSent: false, staffSent: false, customerSent: false, errors: [] };
    if (statusLower === 'completed' && !config.triggers.bookingCompleted) return { adminSent: false, staffSent: false, customerSent: false, errors: [] };
    if (statusLower === 'cancelled' && !config.triggers.bookingCancelled) return { adminSent: false, staffSent: false, customerSent: false, errors: [] };
  }

  const headerTitle =
    eventType === 'NEW_BOOKING'
      ? config.templates.newBookingTitle
      : eventType === 'STAFF_ASSIGNED'
      ? config.templates.staffAssignTitle
      : config.templates.statusUpdateTitle;

  const formattedPrice = booking.price ? `${Number(booking.price).toLocaleString()} MMK` : '-';

  const adminMessage = [
    `<b>${escapeHtml(headerTitle)}</b>`,
    `━━━━━━━━━━━━━━━━━━━━`,
    `🆔 <b>Booking ID:</b> <code>#${escapeHtml(booking.id.slice(-6).toUpperCase())}</code>`,
    `📊 <b>Status:</b> ${getStatusBadge(booking.status)}`,
    `👤 <b>ဧည့်သည်အမည်:</b> ${escapeHtml(booking.customerName)} ${booking.vipTier ? `(${escapeHtml(booking.vipTier)})` : ''}`,
    `📞 <b>ဖုန်းနံပါတ်:</b> <code>${escapeHtml(booking.customerPhone)}</code>`,
    `💆‍♂️ <b>ဝန်ဆောင်မှု:</b> ${escapeHtml(booking.serviceName)} ${booking.duration ? `(${escapeHtml(booking.duration)} Mins)` : ''}`,
    `💰 <b>ကျသင့်ငွေ:</b> ${escapeHtml(formattedPrice)}`,
    `📅 <b>နေ့ရက် / အချိန်:</b> ${escapeHtml(booking.date)} | ⏰ <b>${escapeHtml(booking.time)}</b>`,
    `👨‍💼 <b>Therapist:</b> ${escapeHtml(booking.therapistName || booking.therapistId || 'မရွေးချယ်ရသေးပါ')}`,
    booking.roomName ? `🚪 <b>အခန်း (Room):</b> ${escapeHtml(booking.roomName)}` : null,
    booking.notes ? `📝 <b>မှတ်ချက်:</b> <i>${escapeHtml(booking.notes)}</i>` : null,
    booking.updatedBy ? `✍️ <b>ပြင်ဆင်သူ:</b> ${escapeHtml(booking.updatedBy)}` : null,
    `━━━━━━━━━━━━━━━━━━━━`,
    `<i>${escapeHtml(config.botFlow.customFooterText)}</i>`,
  ]
    .filter(Boolean)
    .join('\n');

  const inlineKeyboard: any[] = [];
  if (config.botFlow.enableWebAppButton && config.webAppUrl) {
    inlineKeyboard.push([
      {
        text: '🌐 Open Admin Panel',
        url: `${config.webAppUrl}/?mode=admin`,
      },
    ]);
  }

  const replyMarkup = inlineKeyboard.length > 0 ? { inline_keyboard: inlineKeyboard } : undefined;

  let adminSent = false;
  let staffSent = false;

  // 1. Send to Admin Group
  if (config.adminGroupChatId) {
    const res = await sendRawTelegramMessage(
      config.botToken,
      config.adminGroupChatId,
      adminMessage,
      replyMarkup,
      `BOOKING_${eventType}`
    );
    adminSent = res.ok;
    if (!res.ok && res.error) errors.push(`Admin Group: ${res.error}`);
  }

  // 2. Send to Assigned Staff (Direct Chat or Staff Group)
  if (config.triggers.staffAssigned && (booking.therapistId || booking.therapistName)) {
    const staffMessage = [
      `<b>${escapeHtml(config.templates.staffAssignTitle)}</b>`,
      `━━━━━━━━━━━━━━━━━━━━`,
      `👨‍💼 <b>Therapist:</b> <b>${escapeHtml(booking.therapistName || booking.therapistId)}</b>`,
      `📊 <b>အခြေအနေ:</b> ${getStatusBadge(booking.status)}`,
      `💆‍♂️ <b>ဝန်ဆောင်မှု:</b> ${escapeHtml(booking.serviceName)} ${booking.duration ? `(${escapeHtml(booking.duration)} Mins)` : ''}`,
      `📅 <b>နေ့ရက်:</b> ${escapeHtml(booking.date)}`,
      `⏰ <b>အချိန်:</b> <b>${escapeHtml(booking.time)}</b>`,
      booking.roomName ? `🚪 <b>အခန်း:</b> ${escapeHtml(booking.roomName)}` : null,
      booking.notes ? `📝 <b>ဧည့်သည်မှတ်ချက်:</b> <i>${escapeHtml(booking.notes)}</i>` : null,
      `━━━━━━━━━━━━━━━━━━━━`,
      `⚠️ <i>သတ်မှတ်ချိန်မတိုင်မီ ၁၀ မိနစ်ကြိုတင်၍ အခန်းနှင့် လိုအပ်သည်များကို အသင့်ပြင်ဆင်ထားပေးပါရန်။</i>`,
    ]
      .filter(Boolean)
      .join('\n');

    const matchedStaff = config.staffMappings.find(
      (s) =>
        s.staffId.toLowerCase() === (booking.therapistId || '').toLowerCase() ||
        s.staffName.toLowerCase() === (booking.therapistName || '').toLowerCase() ||
        (booking.therapistName && booking.therapistName.includes(s.staffId))
    );

    if (matchedStaff && matchedStaff.telegramChatId && matchedStaff.receiveBookingAssign) {
      const staffRes = await sendRawTelegramMessage(
        config.botToken,
        matchedStaff.telegramChatId,
        staffMessage,
        undefined,
        'STAFF_DIRECT_ASSIGN'
      );
      staffSent = staffRes.ok;
      if (!staffRes.ok && staffRes.error) errors.push(`${matchedStaff.staffId}: ${staffRes.error}`);
    }

    if (config.staffGroupChatId && config.staffGroupChatId !== config.adminGroupChatId) {
      const groupRes = await sendRawTelegramMessage(
        config.botToken,
        config.staffGroupChatId,
        staffMessage,
        undefined,
        'STAFF_GROUP_ASSIGN'
      );
      staffSent = staffSent || groupRes.ok;
    }
  }

  // 3. Send Real-Time Update to Subscribed Customer
  const customerResult = await notifyCustomerBookingStatus(eventType, booking, config);

  return { adminSent, staffSent, customerSent: customerResult.customerSent, errors };
};

// ==========================================
// 7. BULK PROMOTION & INSTANT PUSH BROADCAST TO CUSTOMERS
// ==========================================

export const sendBulkCustomerBroadcast = async (
  payload: CustomerBroadcastPayload,
  onProgress?: (sentCount: number, totalCount: number) => void
): Promise<{ totalTargeted: number; successCount: number; failedCount: number; errors: string[] }> => {
  const config = await getTelegramConfig();
  const errors: string[] = [];

  if (!config.enabled || !config.botToken) {
    return { totalTargeted: 0, successCount: 0, failedCount: 0, errors: ['Telegram Bot is disabled or missing token'] };
  }

  const allSubscribers = await getCustomerTelegramSubscribers();
  const activeSubscribers = allSubscribers.filter((s) => s.subscribed !== false && s.chatId);

  let targetList = activeSubscribers;
  if (payload.targetAudience === 'VIP_ONLY') {
    targetList = activeSubscribers.filter(
      (s) => s.vipTier && (s.vipTier.toLowerCase().includes('vip') || s.vipTier.includes('%'))
    );
  } else if (payload.targetAudience === 'SELECTED' && payload.selectedChatIds?.length) {
    const selectedSet = new Set(payload.selectedChatIds);
    targetList = activeSubscribers.filter((s) => selectedSet.has(s.chatId));
  }

  const cleanUrl = (config.webAppUrl || 'https://www.shangrilamenretreat.online').replace(/\/$/, '');
  const targetTab = payload.buttonTab || 'booking';
  const primaryButtonText = payload.buttonText || '📅 ယခုပဲ ဘိုကင်တင်ရန် (Book Now)';

  const replyMarkup = {
    inline_keyboard: [
      [
        {
          text: primaryButtonText,
          web_app: { url: `${cleanUrl}/?tab=${targetTab}` },
        },
      ],
      [
        {
          text: '👥 ဝန်ထမ်းပုံကြည့်ရန်',
          web_app: { url: `${cleanUrl}/?tab=therapists` },
        },
        {
          text: '🟢 အားနေသောဝန်ထမ်းများ',
          web_app: { url: `${cleanUrl}/?tab=available` },
        },
      ],
      [
        {
          text: '📋 My Booking History & Status',
          web_app: { url: `${cleanUrl}/?tab=history` },
        },
      ],
    ],
  };

  const formattedHtml = [
    `✨ <b>${escapeHtml(payload.title)}</b>`,
    `━━━━━━━━━━━━━━━━━━━━`,
    escapeHtml(payload.message),
    `━━━━━━━━━━━━━━━━━━━━`,
    `📍 <b>The Shangri-La Men's Retreat</b>`,
    `📞 09-458884517, 09-770072190`,
  ].join('\n');

  let successCount = 0;
  let failedCount = 0;

  for (let i = 0; i < targetList.length; i++) {
    const sub = targetList[i];
    let res: { ok: boolean; error?: string };

    if (payload.imageUrl && payload.imageUrl.trim()) {
      res = await sendRawTelegramPhoto(
        config.botToken,
        sub.chatId,
        payload.imageUrl.trim(),
        formattedHtml,
        replyMarkup,
        'CUSTOMER_PROMO_BROADCAST'
      );
    } else {
      res = await sendRawTelegramMessage(
        config.botToken,
        sub.chatId,
        formattedHtml,
        replyMarkup,
        'CUSTOMER_PROMO_BROADCAST'
      );
    }

    if (res.ok) {
      successCount++;
    } else {
      failedCount++;
      if (res.error) errors.push(`${sub.customerName} (${sub.chatId}): ${res.error}`);
    }

    if (onProgress) {
      onProgress(i + 1, targetList.length);
    }

    // Telegram flood limit ကို ကာကွယ်ရန် တစ်စောင်နှင့်တစ်စောင်ကြား 60ms စောင့်ပေးခြင်း
    await new Promise((r) => setTimeout(r, 60));
  }

  return {
    totalTargeted: targetList.length,
    successCount,
    failedCount,
    errors,
  };
};

// ==========================================
// 8. STAFF OPERATIONS NOTIFICATIONS (ROSTER, PENALTY, PAYROLL)
// ==========================================

export const notifyStaffUpdate = async (
  payload: StaffNotificationPayload
): Promise<{ sent: boolean; errors: string[] }> => {
  const config = await getTelegramConfig();
  const errors: string[] = [];

  if (!config.enabled || !config.botToken) {
    return { sent: false, errors: ['Telegram Bot is disabled'] };
  }

  if (payload.type === 'ROSTER_UPDATE' && !config.triggers.dutyRosterUpdated) return { sent: false, errors: [] };
  if (payload.type === 'PENALTY_ISSUED' && !config.triggers.penaltyIssued) return { sent: false, errors: [] };
  if (payload.type === 'PAYROLL_READY' && !config.triggers.payrollGenerated) return { sent: false, errors: [] };

  const typeEmoji =
    payload.type === 'ROSTER_UPDATE'
      ? '📅'
      : payload.type === 'PENALTY_ISSUED'
      ? '⚠️'
      : payload.type === 'REWARD_ISSUED'
      ? '🏆'
      : payload.type === 'PAYROLL_READY'
      ? '💵'
      : '📢';

  const message = [
    `${typeEmoji} <b>${escapeHtml(payload.title)}</b>`,
    `━━━━━━━━━━━━━━━━━━━━`,
    `👨‍💼 <b>ဝန်ထမ်း:</b> ${escapeHtml(payload.staffName)}`,
    `📆 <b>နေ့ရက်:</b> ${escapeHtml(payload.effectiveDate)}`,
    payload.amount !== undefined ? `💰 <b>ပမာဏ:</b> ${Number(payload.amount).toLocaleString()} MMK` : null,
    `📋 <b>အသေးစိတ်:</b>\n${escapeHtml(payload.details)}`,
    payload.issuedBy ? `\n✍️ <b>ထုတ်ပြန်သူ:</b> ${escapeHtml(payload.issuedBy)}` : null,
    `━━━━━━━━━━━━━━━━━━━━`,
    `<i>${escapeHtml(config.botFlow.customFooterText)}</i>`,
  ]
    .filter(Boolean)
    .join('\n');

  let sentAny = false;

  if (payload.staffId || payload.staffName) {
    const matchedStaff = config.staffMappings.find(
      (s) =>
        s.staffId.toLowerCase() === (payload.staffId || '').toLowerCase() ||
        s.staffName.toLowerCase() === payload.staffName.toLowerCase() ||
        payload.staffName.includes(s.staffId)
    );

    if (matchedStaff && matchedStaff.telegramChatId) {
      const allowed =
        (payload.type === 'ROSTER_UPDATE' && matchedStaff.receiveRosterUpdate) ||
        (payload.type === 'PENALTY_ISSUED' && matchedStaff.receivePenaltyAlert) ||
        (payload.type === 'PAYROLL_READY' && matchedStaff.receivePayrollAlert) ||
        payload.type === 'GENERAL_ANNOUNCEMENT' ||
        payload.type === 'REWARD_ISSUED';

      if (allowed) {
        const res = await sendRawTelegramMessage(
          config.botToken,
          matchedStaff.telegramChatId,
          message,
          undefined,
          `STAFF_${payload.type}`
        );
        sentAny = sentAny || res.ok;
        if (!res.ok && res.error) errors.push(res.error);
      }
    }
  }

  const targetGroup = config.staffGroupChatId || config.adminGroupChatId;
  if (targetGroup) {
    const res = await sendRawTelegramMessage(
      config.botToken,
      targetGroup,
      message,
      undefined,
      `GROUP_${payload.type}`
    );
    sentAny = sentAny || res.ok;
    if (!res.ok && res.error) errors.push(res.error);
  }

  return { sent: sentAny, errors };
};

// ==========================================
// 9. BOT DISCOVERY, AUTO-SUBSCRIBE SYNC & MINI APP MENU SETUP
// ==========================================

export interface DiscoveredTelegramChat {
  chatId: string;
  titleOrName: string;
  username?: string;
  type: 'private' | 'group' | 'supergroup' | 'channel';
  lastMessage: string;
  date: string;
  startPayload?: string;
}

/**
 * Bot သို့ ဝင်ရောက်လာသော Message များနှင့် `/start book_<BookingID>_<Phone>` သို့မဟုတ် `/start sub_<Phone>` တို့ကို စစ်ဆေးပြီး
 * Customer Chat ID ကို အလိုအလျောက် Subscribe လုပ်ပေးခြင်း + Booking နှင့် ချိတ်ဆက်ပေးခြင်း
 */
export const fetchRecentBotChats = async (
  botToken: string,
  autoBindCustomers: boolean = true
): Promise<{
  ok: boolean;
  chats: DiscoveredTelegramChat[];
  newlySubscribedCount?: number;
  error?: string;
}> => {
  if (!botToken) return { ok: false, chats: [], error: 'Bot Token လိုအပ်ပါသည်' };

  try {
    const response = await fetch(`https://api.telegram.org/bot${botToken.trim()}/getUpdates?limit=100`);
    const data = await response.json();

    if (!data.ok) {
      return { ok: false, chats: [], error: data.description || 'Failed to fetch updates' };
    }

    const chatMap = new Map<string, DiscoveredTelegramChat>();
    let newlySubscribedCount = 0;
    const processedUpdateIds: Set<string> = new Set(
      JSON.parse(localStorage.getItem('shangrila_processed_tg_updates') || '[]')
    );

    const config = await getTelegramConfig();

    for (const update of data.result || []) {
      const msg = update.message || update.edited_message || update.my_chat_member;
      if (!msg || !msg.chat) continue;

      const chat = msg.chat;
      const chatIdStr = String(chat.id);
      const titleOrName =
        chat.title || [chat.first_name, chat.last_name].filter(Boolean).join(' ') || 'Unknown User';
      const text: string = msg.text || '';

      let startPayload = '';
      if (text.startsWith('/start')) {
        const parts = text.trim().split(/\s+/);
        if (parts.length > 1) startPayload = parts[1];
      }

      chatMap.set(chatIdStr, {
        chatId: chatIdStr,
        titleOrName,
        username: chat.username,
        type: chat.type,
        lastMessage: text || '[Media / Action]',
        date: msg.date ? new Date(msg.date * 1000).toLocaleString() : '-',
        startPayload,
      });

      // Auto-Subscribe private user chats & handle /start deep-links
      const updateKey = String(update.update_id);
      if (autoBindCustomers && chat.type === 'private' && !processedUpdateIds.has(updateKey)) {
        processedUpdateIds.add(updateKey);

        let extractedPhone = '';
        let extractedBookingId = '';

        if (startPayload.startsWith('book_')) {
          // Format: book_<BookingID>_<Phone>
          const tokens = startPayload.split('_');
          extractedBookingId = tokens[1] || '';
          extractedPhone = tokens.slice(2).join('') || '';
        } else if (startPayload.startsWith('sub_')) {
          extractedPhone = startPayload.replace('sub_', '');
        }

        await saveCustomerTelegramSubscription({
          chatId: chatIdStr,
          customerName: titleOrName,
          customerPhone: extractedPhone,
          username: chat.username || '',
          firstName: chat.first_name || '',
          lastName: chat.last_name || '',
          lastBookingId: extractedBookingId,
          subscribed: true,
          source: startPayload ? 'booking_deeplink' : 'bot_command',
        });

        newlySubscribedCount++;

        // If user clicked /start or menu commands, send interactive Mini App menu automatically
        if (
          text.startsWith('/start') ||
          text.startsWith('/book') ||
          text.startsWith('/staff') ||
          text.startsWith('/available') ||
          text.startsWith('/history') ||
          text.startsWith('/vip')
        ) {
          await sendInteractiveMiniAppMenu(chatIdStr, config, extractedBookingId, extractedPhone);
        }
      }
    }

    // Keep last 200 processed update IDs
    const trimmedIds = Array.from(processedUpdateIds).slice(-200);
    localStorage.setItem('shangrila_processed_tg_updates', JSON.stringify(trimmedIds));

    return {
      ok: true,
      chats: Array.from(chatMap.values()).reverse(),
      newlySubscribedCount,
    };
  } catch (err: any) {
    return { ok: false, chats: [], error: err?.message || 'Network error' };
  }
};

/**
 * Customer ထံသို့ Interactive Mini App Menu ခလုတ်များ (ဘိုကင်တင်ရန်၊ ဝန်ထမ်းပုံကြည့်ရန်၊ အားနေသောဝန်ထမ်းများ၊ Booking History) ပေးပို့ခြင်း
 */
export const sendInteractiveMiniAppMenu = async (
  chatId: string,
  existingConfig?: TelegramBotConfig,
  linkedBookingId?: string,
  linkedPhone?: string
): Promise<{ ok: boolean; error?: string }> => {
  const config = existingConfig || (await getTelegramConfig());
  if (!config.botToken || !chatId) return { ok: false, error: 'Missing token or chatId' };

  const bookingConfirmLine = linkedBookingId
    ? `\n✅ <b>သင်၏ ဘိုကင် (<code>#${escapeHtml(linkedBookingId.slice(-6).toUpperCase())}</code>) နှင့် Telegram Notification ကို အောင်မြင်စွာ ချိတ်ဆက်ပြီးပါပြီ!</b> ${linkedPhone ? `(📞 ${escapeHtml(linkedPhone)})` : ''}\n`
    : `\n🔔 <b>Telegram Real-Time Notification ကို အောင်မြင်စွာ ချိတ်ဆက်ပြီးပါပြီ!</b>\n`;

  const menuHtml = [
    `🌿 <b>THE SHANGRI-LA MEN'S RETREAT</b>`,
    `<i>Beyond Relaxation • Since 2018</i>`,
    `━━━━━━━━━━━━━━━━━━━━`,
    bookingConfirmLine,
    escapeHtml(config.botFlow.welcomeMessage),
    ``,
    `👇 <b>အောက်ပါ Mini App Menu ခလုတ်များကို နှိပ်၍ တိုက်ရိုက် အသုံးပြုနိုင်ပါသည် -</b>`,
    `• 📅 <b>ဘိုကင်တင်ရန်:</b> ဝန်ဆောင်မှုနှင့် အချိန်ရွေးချယ်ရန်`,
    `• 👥 <b>ဝန်ထမ်းပုံကြည့်ရန်:</b> Therapist များ၏ ပရိုဖိုင်ကြည့်ရန်`,
    `• 🟢 <b>အားနေသောဝန်ထမ်းများ:</b> လက်ရှိအားလပ်နေသူများ စစ်ဆေးရန်`,
    `• 📋 <b>My Booking History:</b> မိမိဘိုကင်အခြေအနေ ကြည့်ရှုရန်`,
    `━━━━━━━━━━━━━━━━━━━━`,
    `📍 33th(B) St, Between 65th & 65th(A) Sts, Chan Aye Tharzan Tsp, Mandalay`,
    `📞 09-458884517, 09-770072190`,
  ].join('\n');

  const keyboard = buildCustomerMiniAppInlineKeyboard(config.webAppUrl);
  return sendRawTelegramMessage(config.botToken, chatId, menuHtml, keyboard, 'CUSTOMER_MENU_WELCOME');
};

/**
 * Telegram Bot ၏ Menu Commands (/start, /book, /staff, /available, /history, /vip, /contact) နှင့်
 * WebApp Menu Button ကို Admin Panel မှ တိုက်ရိုက် သတ်မှတ်ပေးခြင်း
 */
export const syncBotCommandsAndMenu = async (config: TelegramBotConfig): Promise<{ ok: boolean; message: string }> => {
  if (!config.botToken) return { ok: false, message: 'Bot Token မရှိပါ' };

  try {
    const baseUrl = `https://api.telegram.org/bot${config.botToken.trim()}`;
    const cleanWebAppUrl = (config.webAppUrl || 'https://www.shangrilamenretreat.online').replace(/\/$/, '');

    // Auto-fetch and save botUsername if missing
    await fetchBotUsername(config.botToken);

    // 1. Set Rich Bot Commands for Customer Mini App Navigation
    await fetch(`${baseUrl}/setMyCommands`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        commands: [
          { command: 'start', description: '🌿 Main Menu & Notification Subscribe' },
          { command: 'book', description: '📅 ဘိုကင်တင်ရန် (Book Appointment)' },
          { command: 'staff', description: '👥 ဝန်ထမ်းပုံကြည့်ရန် (View Therapists)' },
          { command: 'available', description: '🟢 အားနေသော ဝန်ထမ်းများကြည့်ရန် (Available Now)' },
          { command: 'history', description: '📋 My Booking History & Status' },
          { command: 'vip', description: '👑 VIP Membership & Points စစ်ရန်' },
          { command: 'contact', description: '📞 ဆိုင်လိပ်စာနှင့် ဖုန်းနံပါတ်များ' },
          { command: 'myid', description: '🆔 မိမိ၏ Telegram Chat ID ကြည့်ရန်' },
        ],
      }),
    });

    // 2. Set Chat Menu Button to Launch Mini App Directly
    if (config.botFlow.enableWebAppButton && cleanWebAppUrl) {
      await fetch(`${baseUrl}/setChatMenuButton`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          menu_button: {
            type: 'web_app',
            text: '🌿 ဘိုကင်တင်ရန် / Menu',
            web_app: { url: `${cleanWebAppUrl}/?source=tg_menu` },
          },
        }),
      });
    }

    return {
      ok: true,
      message:
        'Telegram Mini App Menu Button နှင့် Commands (/book, /staff, /available, /history, /vip) အားလုံးကို အောင်မြင်စွာ ချိတ်ဆက်ပြီးပါပြီ။',
    };
  } catch (err: any) {
    return { ok: false, message: err?.message || 'Failed to sync bot commands' };
  }
};
