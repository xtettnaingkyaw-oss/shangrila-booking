import {
  doc,
  getDoc,
  setDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  collection,
  addDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from './firebase';
import { decryptText } from './security';

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

export interface BusinessAutoReplyRule {
  id: string;
  name: string;
  enabled: boolean;
  keywords: string[];
  replyMessage: string;
  matchType?: 'contains' | 'exact';
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
  subscribers?: CustomerTelegramSubscriber[];
  excludedChatIds?: string[];
  // --- Telegram Business Direct Message (Keyword Auto-Reply) ---
  businessAutoReplyEnabled?: boolean;
  businessAutoReplyRules?: BusinessAutoReplyRule[];
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
  status: 'pending' | 'confirmed' | 'approved' | 'in-service' | 'completed' | 'cancelled' | string;
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

export const DEFAULT_BUSINESS_AUTO_REPLY_RULES: BusinessAutoReplyRule[] = [
  {
    id: 'job_recruitment_auto_reply',
    name: 'ဝန်ထမ်းခေါ်ယူမှု / အလုပ်လျှောက်ထားမှု Auto-Reply',
    enabled: true,
    matchType: 'contains',
    keywords: [
      'လူလိုသေးလား',
      'အလုပ်',
      'ဝန်ထမ်းလိုသေးလား',
      'အလုပ်လျှောက်',
      'ဝန်ထမ်းခေါ်',
      'လူခေါ်'
    ],
    replyMessage: `မင်္ဂလာပါ😊🫱🏻‍🫲🏾
အလုပ်လျှောက်ထားရန် အတွက်

၁။ အမည်
၂။ အသက်
၃။ အရပ်အမြင့်
၄။ ဇာတိ၊ လက်ရှိနေရပ်လိပ်စာ
၅။ Ai Photo မဖြစ်ရ၊ Effect မသုံးပဲရိုက်ထားတဲ့ပုံ မျက်နှာသေချာမြင်ရတဲ့ ဓာတ်ပုံ ( ၃ ) ပုံတို့ကို ပို့ပေးပါ။

✅ ပို့ပေးတဲ့ အချက်အလက်လေးတွေ ကိုကြည့်ပြီး အလုပ်ခန့်ရန်အတွက် အဆင်ပြေတယ်ဆိုရင် အလုပ်အကြောင်းလေးကိုဆက်လက် ရှင်းပြပေးပါ့မယ်။

⚠️ အချက်အလက်လေးတွေ ပြည့်စုံမှသာ အလုပ်အတွက် အင်တာဗျူးဆက်ဖြေကြားပေးမှာဖြစ်ပါတယ်။`
  },
  {
    id: 'menu_therapists_auto_reply',
    name: 'ဝန်ထမ်းပုံများ / Profiles ကြည့်ရန် Auto-Reply',
    enabled: true,
    matchType: 'contains',
    keywords: [
      'ဝန်ထမ်းပုံ',
      'ဝန်ထမ်းစာရင်း',
      'therapist',
      'staff',
      'ဘယ်သူတွေရှိလဲ',
      'ပုံတွေပြပါ',
      'ဝန်ထမ်းတွေ'
    ],
    replyMessage: `👥 <strong>THE SHANGRI-LA MEN'S RETREAT — ဝန်ထမ်းများစာရင်း</strong>\n\nတာဝန်ကျ Therapist များ၏ ပုံစံ၊ ကိုယ်ရေးအချက်အလက်နှင့် ဝန်ဆောင်မှုများကို အောက်ပါ Mini App ခလုတ်မှတစ်ဆင့် လွယ်ကူစွာ ကြည့်ရှုနိုင်ပါသည်။ 👇`
  },
  {
    id: 'menu_booking_auto_reply',
    name: 'ဘိုကင်တင်ရန် / Booking Auto-Reply',
    enabled: true,
    matchType: 'contains',
    keywords: [
      'ဘိုကင်',
      'ရက်ချိန်း',
      'booking',
      'book',
      'အချိန်ယူချင်လို့',
      'လာချင်လို့',
      'ချိန်းချင်လို့'
    ],
    replyMessage: `📅 <strong>THE SHANGRI-LA MEN'S RETREAT — ရက်ချိန်းရယူရန်</strong>\n\nလူကြီးမင်း လိုချင်သည့် ဝန်ဆောင်မှု၊ အချိန်နှင့် Therapist ကို အောက်ပါ Mini App မှတစ်ဆင့် တိုက်ရိုက် ရွေးချယ်ဘိုကင်တင်နိုင်ပါသည်။ 👇`
  },
  {
    id: 'menu_available_auto_reply',
    name: 'အားနေသောဝန်ထမ်းများ / Available Now Auto-Reply',
    enabled: true,
    matchType: 'contains',
    keywords: [
      'အားနေလား',
      'အားတဲ့သူ',
      'available',
      'free',
      'ခုန်ဆက်လို့ရလား',
      'сейчас'
    ],
    replyMessage: `🟢 <strong>လက်ရှိ အားလပ်နေသော ဝန်ထမ်းများ (Available Now)</strong>\n\nယခုအချိန်တွင် ဝန်ဆောင်မှုပေးရန် အသင့်ရှိနေသော Therapist များကို အောက်ပါ Mini App တွင် စစ်ဆေးနိုင်ပါသည်။ 👇`
  },
  {
    id: 'menu_vip_auto_reply',
    name: 'VIP Member & Points စစ်ရန် Auto-Reply',
    enabled: true,
    matchType: 'contains',
    keywords: [
      'vip',
      'ပွိုင့်',
      'points',
      'member',
      'membership',
      'discount'
    ],
    replyMessage: `👑 <strong>VIP Membership & Privileges</strong>\n\nလူကြီးမင်း၏ Member အဆင့်၊ စုဆောင်းထားသော Points များနှင့် အထူးခံစားခွင့်များကို အောက်ပါ Mini App တွင် ကြည့်ရှုနိုင်ပါသည်။ 👇`
  }
];

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
    { staffId: 'No. 5', staffName: 'Therapist No. 5', telegramChatId: '', receiveBookingAssign: true, receiveRosterUpdate: true, receivePenaltyAlert: true, receivePayrollAlert: true },
    { staffId: 'No. 6', staffName: 'Therapist No. 6', telegramChatId: '', receiveBookingAssign: true, receiveRosterUpdate: true, receivePenaltyAlert: true, receivePayrollAlert: true },
    { staffId: 'No. 10', staffName: 'Therapist No. 10', telegramChatId: '', receiveBookingAssign: true, receiveRosterUpdate: true, receivePenaltyAlert: true, receivePayrollAlert: true },
  ],
  subscribers: [],
  excludedChatIds: [],
  businessAutoReplyEnabled: true,
  businessAutoReplyRules: DEFAULT_BUSINESS_AUTO_REPLY_RULES,
};

// ==========================================
// 3. HELPER & ADMIN/STAFF FILTER FUNCTIONS
// ==========================================

export const safeDecryptValue = (val: any): string => {
  if (!val || typeof val !== 'string') return String(val || '');
  try {
    return decryptText(val) || val;
  } catch {
    return val;
  }
};

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
  const decrypted = safeDecryptValue(phone);
  const digits = String(decrypted).replace(/[^0-9]/g, '');
  if (digits.startsWith('959')) return '09' + digits.slice(3);
  if (digits.startsWith('9') && digits.length >= 8) return '0' + digits;
  return digits;
};

export const isPrivateUserChatId = (chatId: string | number | undefined | null): boolean => {
  if (!chatId) return false;
  const s = String(chatId).trim();
  return /^\d+$/.test(s) && !s.startsWith('-');
};

const KNOWN_ADMIN_OR_STAFF_PATTERNS = [
  'the shangri-la',
  'shangrilamenretreat',
  'shangrila_retreat',
  'htet wai',
  'nay myo maung',
  'min myat aung',
  'naing win aung',
  'n w a',
  'nwa146',
  'sai win thant htoo',
  'sharmink99',
  'အန်စာတုံး',
];

export const isStaffOrAdminSubscriber = (
  item: { chatId?: string; customerName?: string; username?: string; firstName?: string; lastName?: string },
  config?: TelegramBotConfig | null,
  extraStaffNames: string[] = []
): boolean => {
  const cid = String(item.chatId || '').trim();
  if (!cid || !isPrivateUserChatId(cid)) return true;

  if (config) {
    if (config.adminGroupChatId && String(config.adminGroupChatId).trim() === cid) return true;
    if (config.staffGroupChatId && String(config.staffGroupChatId).trim() === cid) return true;
    if (Array.isArray(config.excludedChatIds) && config.excludedChatIds.includes(cid)) return true;

    const staffMatchedById = (config.staffMappings || []).some(
      (s) => s.telegramChatId && String(s.telegramChatId).trim() === cid
    );
    if (staffMatchedById) return true;
  }

  const combinedText = [
    safeDecryptValue(item.customerName || ''),
    item.username || '',
    item.firstName || '',
    item.lastName || '',
  ]
    .join(' ')
    .toLowerCase()
    .trim();

  if (!combinedText) return false;

  for (const pattern of KNOWN_ADMIN_OR_STAFF_PATTERNS) {
    if (combinedText.includes(pattern)) return true;
  }

  if (config?.botUsername && combinedText.includes(config.botUsername.toLowerCase())) {
    return true;
  }

  for (const sName of extraStaffNames) {
    const cleanSName = sName.toLowerCase().trim();
    if (cleanSName.length >= 3 && combinedText.includes(cleanSName)) {
      return true;
    }
  }

  return false;
};

export const getTelegramConfig = async (): Promise<TelegramBotConfig> => {
  try {
    const docRef = doc(db, 'settings', 'telegramConfig');
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      const data = snap.data() as Partial<TelegramBotConfig>;
      if (data.botUsername) {
        try {
          localStorage.setItem('shangrila_bot_username', data.botUsername.replace(/^@/, '').trim());
        } catch {}
      }
      return {
        ...DEFAULT_TELEGRAM_CONFIG,
        ...data,
        triggers: { ...DEFAULT_TELEGRAM_CONFIG.triggers, ...(data.triggers || {}) },
        botFlow: { ...DEFAULT_TELEGRAM_CONFIG.botFlow, ...(data.botFlow || {}) },
        templates: { ...DEFAULT_TELEGRAM_CONFIG.templates, ...(data.templates || {}) },
        staffMappings: data.staffMappings || DEFAULT_TELEGRAM_CONFIG.staffMappings,
        subscribers: Array.isArray(data.subscribers) ? data.subscribers : [],
        excludedChatIds: Array.isArray(data.excludedChatIds) ? data.excludedChatIds : [],
        businessAutoReplyEnabled:
          data.businessAutoReplyEnabled !== undefined ? data.businessAutoReplyEnabled : true,
        businessAutoReplyRules:
          Array.isArray(data.businessAutoReplyRules) && data.businessAutoReplyRules.length > 0
            ? data.businessAutoReplyRules
            : DEFAULT_BUSINESS_AUTO_REPLY_RULES,
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
    if (config.botUsername) {
      try {
        localStorage.setItem('shangrila_bot_username', config.botUsername.replace(/^@/, '').trim());
      } catch {}
    }
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
// 4. CORE TELEGRAM API SENDERS
// ==========================================

export const sendRawTelegramMessage = async (
  botToken: string,
  chatId: string,
  htmlText: string,
  replyMarkup?: object,
  logType: string = 'SYSTEM',
  extraOptions?: { businessConnectionId?: string; replyToMessageId?: number; plainText?: boolean }
): Promise<{ ok: boolean; error?: string }> => {
  if (!botToken || !chatId) {
    return { ok: false, error: 'Missing Bot Token or Chat ID' };
  }

  const url = `https://api.telegram.org/bot${botToken.trim()}/sendMessage`;

  try {
    const bodyPayload: Record<string, unknown> = {
      chat_id: String(chatId).trim(),
      text: htmlText,
      disable_web_page_preview: true,
    };

    if (!extraOptions?.plainText) {
      bodyPayload.parse_mode = 'HTML';
    }

    if (replyMarkup) {
      bodyPayload.reply_markup = replyMarkup;
    }

    if (extraOptions?.businessConnectionId) {
      bodyPayload.business_connection_id = extraOptions.businessConnectionId;
    }

    if (extraOptions?.replyToMessageId) {
      bodyPayload.reply_to_message_id = extraOptions.replyToMessageId;
    }

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(bodyPayload),
    });

    const data = await response.json();

    if (!response.ok || !data.ok) {
      const errMsg = data.description || `HTTP Error ${response.status}`;
      await logTelegramActivity(logType, String(chatId), 'FAILED', htmlText.slice(0, 120), errMsg);
      return { ok: false, error: errMsg };
    }

    await logTelegramActivity(logType, String(chatId), 'SUCCESS', htmlText.slice(0, 120));
    return { ok: true };
  } catch (error: any) {
    const errMsg = error?.message || 'Network request failed';
    await logTelegramActivity(logType, String(chatId), 'FAILED', htmlText.slice(0, 120), errMsg);
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
      chat_id: String(chatId).trim(),
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
      return sendRawTelegramMessage(
        botToken,
        chatId,
        `${htmlCaption}\n\n🖼 <a href="${escapeHtml(photoUrl)}">ပရိုမိုးရှင်းပုံကြည့်ရန်</a>`,
        replyMarkup,
        logType
      );
    }

    await logTelegramActivity(logType, String(chatId), 'SUCCESS', `[PHOTO] ${htmlCaption.slice(0, 100)}`);
    return { ok: true };
  } catch (error: any) {
    const errMsg = error?.message || 'Network request failed';
    await logTelegramActivity(logType, String(chatId), 'FAILED', htmlCaption.slice(0, 120), errMsg);
    return { ok: false, error: errMsg };
  }
};

// ==========================================
// 4B. TELEGRAM BUSINESS DIRECT MESSAGE KEYWORD AUTO-REPLY ENGINE
// ==========================================

export const matchBusinessKeywordRule = (
  incomingText: string,
  config: TelegramBotConfig
): BusinessAutoReplyRule | null => {
  if (config.businessAutoReplyEnabled === false) return null;
  const rules =
    Array.isArray(config.businessAutoReplyRules) && config.businessAutoReplyRules.length > 0
      ? config.businessAutoReplyRules
      : DEFAULT_BUSINESS_AUTO_REPLY_RULES;

  const cleanText = String(incomingText || '').trim().toLowerCase();
  if (!cleanText || cleanText.startsWith('/')) return null;

  for (const rule of rules) {
    if (!rule.enabled || !rule.replyMessage?.trim() || !Array.isArray(rule.keywords)) continue;
    const isMatched = rule.keywords.some((kw) => {
      const cleanKw = String(kw || '').trim().toLowerCase();
      if (!cleanKw) return false;
      if (rule.matchType === 'exact') {
        return cleanText === cleanKw;
      }
      return cleanText.includes(cleanKw);
    });
    if (isMatched) return rule;
  }
  return null;
};

let isBusinessAutoReplyPolling = false;

export async function pollAndProcessBusinessAutoReplies(
  existingConfig?: TelegramBotConfig
): Promise<{ processedCount: number }> {
  if (isBusinessAutoReplyPolling) return { processedCount: 0 };
  isBusinessAutoReplyPolling = true;
  let processedCount = 0;

  try {
    const config = existingConfig || (await getTelegramConfig());
    if (!config.enabled || !config.botToken || config.businessAutoReplyEnabled === false) {
      return { processedCount: 0 };
    }

    // နောက်ဆုံး စစ်ဆေးပြီးသား update_id ကို LocalStorage မှ ရယူခြင်း
    let lastUpdateId = Number(localStorage.getItem('shangrila_biz_last_update_id') || 0);
    const offsetParam = lastUpdateId > 0 ? `&offset=${lastUpdateId + 1}` : '';

    const res = await fetch(
      `https://api.telegram.org/bot${config.botToken.trim()}/getUpdates?limit=50${offsetParam}&allowed_updates=${encodeURIComponent(
        JSON.stringify(['message', 'business_message', 'edited_message', 'callback_query', 'my_chat_member'])
      )}`
    );
    const data = await res.json();
    if (!data?.ok || !Array.isArray(data.result)) {
      return { processedCount: 0 };
    }

    const repliedIds: Set<string> = new Set(
      JSON.parse(localStorage.getItem('shangrila_business_autoreplied_ids') || '[]')
    );

    for (const update of data.result) {
      // update_id အမြဲတမ်း အမြင့်ဆုံးဖြစ်အောင် မှတ်ထားခြင်း (နောက်တစ်ခါခေါ်လျှင် ဒီထက်ကျော်ပြီးမှ ဆွဲထုတ်ရန်)
      if (update.update_id > lastUpdateId) {
        lastUpdateId = update.update_id;
      }

      const bMsg = update.business_message || update.message;
      if (!bMsg || !bMsg.text || !bMsg.chat?.id) continue;

      if (bMsg.from?.is_bot) continue;

      if (update.business_message && String(bMsg.from?.id) !== String(bMsg.chat?.id)) {
        continue;
      }

      const uniqueMsgKey = `${bMsg.chat.id}_${bMsg.message_id}`;
      if (repliedIds.has(uniqueMsgKey)) continue;

      // pollAndProcessBusinessAutoReplies ထဲတွင် မက်ဆေ့ချ်ပို့မည့် အပိုင်း၌ —
const matchedRule = matchBusinessKeywordRule(bMsg.text, config);
if (matchedRule) {
  repliedIds.add(uniqueMsgKey);

  // Bot Menu များနှင့် ချိတ်ဆက်ထားသော Inline Keyboards များ တည်ဆောက်ခြင်း
  let replyMarkup = undefined;
  const cleanUrl = (config.webAppUrl || 'https://www.shangrilamenretreat.online').replace(/\/$/, '');

  if (matchedRule.id === 'menu_therapists_auto_reply') {
    replyMarkup = {
      inline_keyboard: [[{ text: '👥 ဝန်ထမ်းပုံကြည့်ရန် (View Therapists)', web_app: { url: `${cleanUrl}/?tab=therapists` } }]]
    };
  } else if (matchedRule.id === 'menu_booking_auto_reply') {
    replyMarkup = {
      inline_keyboard: [[{ text: '📅 ယခုပဲ ဘိုကင်တင်ရန် (Book Now)', web_app: { url: `${cleanUrl}/?tab=booking` } }]]
    };
  } else if (matchedRule.id === 'menu_available_auto_reply') {
    replyMarkup = {
      inline_keyboard: [[{ text: '🟢 အားနေသော ဝန်ထမ်းများကြည့်ရန်', web_app: { url: `${cleanUrl}/?tab=available` } }]]
    };
  } else if (matchedRule.id === 'menu_vip_auto_reply') {
    replyMarkup = {
      inline_keyboard: [[{ text: '👑 VIP Member & Points စစ်ရန်', web_app: { url: `${cleanUrl}/?tab=vip` } }]]
    };
  }

  await sendRawTelegramMessage(
    config.botToken,
    String(bMsg.chat.id),
    matchedRule.replyMessage,
    replyMarkup, // ထည့်သွင်းလိုက်သော Mini App ခလုတ်များ
    `BUSINESS_AUTO_REPLY_${matchedRule.id.toUpperCase()}`,
    {
      businessConnectionId: bMsg.business_connection_id,
      replyToMessageId: bMsg.message_id,
      plainText: false
    }
  );
  processedCount++;
}
      }
    }

    // နောက်ဆုံး update_id ကို LocalStorage တွင် အမြဲမှတ်ထားမည်
    if (lastUpdateId > 0) {
      localStorage.setItem('shangrila_biz_last_update_id', String(lastUpdateId));
    }

    const trimmedReplied = Array.from(repliedIds).slice(-300);
    localStorage.setItem('shangrila_business_autoreplied_ids', JSON.stringify(trimmedReplied));
  } catch (err) {
    console.warn('pollAndProcessBusinessAutoReplies error:', err);
  } finally {
    isBusinessAutoReplyPolling = false;
  }

  return { processedCount };
}

// ==========================================
// 5. CUSTOMER SUBSCRIBER MANAGEMENT (CLEAN & STABLE)
// ==========================================

export const getDetectedTelegramWebAppUser = (): {
  chatId: string;
  firstName: string;
  lastName: string;
  username: string;
} | null => {
  try {
    const tg = (window as any)?.Telegram?.WebApp;
    if (tg) {
      try {
        tg.ready?.();
        tg.expand?.();
      } catch {}
    }
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

    const rawHash = window.location.hash ? window.location.hash.substring(1) : '';
    const hashParams = new URLSearchParams(rawHash);
    const searchParams = new URLSearchParams(window.location.search);
    const tgWebAppData = hashParams.get('tgWebAppData') || searchParams.get('tgWebAppData');

    if (tgWebAppData) {
      const initParams = new URLSearchParams(tgWebAppData);
      const userJson = initParams.get('user');
      if (userJson) {
        const parsedUser = JSON.parse(decodeURIComponent(userJson));
        if (parsedUser && parsedUser.id) {
          const userObj = {
            chatId: String(parsedUser.id),
            firstName: parsedUser.first_name || '',
            lastName: parsedUser.last_name || '',
            username: parsedUser.username || '',
          };
          localStorage.setItem('shangrila_tg_user', JSON.stringify(userObj));
          localStorage.setItem('shangrila_customer_chat_id', userObj.chatId);
          return userObj;
        }
      }
    }

    const explicitParamId = searchParams.get('tgChatId') || searchParams.get('chatId');
    if (explicitParamId && isPrivateUserChatId(explicitParamId)) {
      const userObj = {
        chatId: explicitParamId.trim(),
        firstName: searchParams.get('firstName') || '',
        lastName: '',
        username: searchParams.get('username') || '',
      };
      localStorage.setItem('shangrila_tg_user', JSON.stringify(userObj));
      localStorage.setItem('shangrila_customer_chat_id', userObj.chatId);
      return userObj;
    }

    const cached = localStorage.getItem('shangrila_tg_user');
    if (cached) {
      const parsed = JSON.parse(cached);
      if (parsed?.chatId && isPrivateUserChatId(parsed.chatId)) return parsed;
    }

    const savedChatId = localStorage.getItem('shangrila_customer_chat_id');
    if (savedChatId && isPrivateUserChatId(savedChatId)) {
      return { chatId: savedChatId, firstName: '', lastName: '', username: '' };
    }
  } catch (e) {
    console.warn('Error reading Telegram WebApp user:', e);
  }
  return null;
};

export const saveCustomerTelegramSubscription = async (
  subscriber: Partial<CustomerTelegramSubscriber> & { chatId: string },
  allowManualOverride: boolean = false
): Promise<boolean> => {
  if (!subscriber.chatId) return false;
  const cleanChatId = String(subscriber.chatId).trim();
  if (!isPrivateUserChatId(cleanChatId)) return false;

  const configData = await getTelegramConfig();

  if (!allowManualOverride && isStaffOrAdminSubscriber(subscriber, configData)) {
    return false;
  }

  let existingData: CustomerTelegramSubscriber | null = null;
  try {
    const docRef = doc(db, 'telegramSubscribers', cleanChatId);
    const existingSnap = await getDoc(docRef);
    if (existingSnap.exists()) {
      existingData = existingSnap.data() as CustomerTelegramSubscriber;
    }
  } catch {}

  if (!existingData && configData.subscribers) {
    existingData = configData.subscribers.find((s) => String(s.chatId) === cleanChatId) || null;
  }

  const nowIso = new Date().toISOString();
  const normalizedPhone = normalizePhone(subscriber.customerPhone || '');
  const cleanInputName = safeDecryptValue(subscriber.customerName || '').trim();

  const resolvedName =
    (cleanInputName &&
    cleanInputName !== 'Shangri-La Guest' &&
    cleanInputName !== 'Telegram Customer' &&
    cleanInputName !== 'Telegram User'
      ? cleanInputName
      : '') ||
    existingData?.customerName ||
    [subscriber.firstName, subscriber.lastName].filter(Boolean).join(' ') ||
    subscriber.username ||
    cleanInputName ||
    'Shangri-La Guest';

  const nextPhone = normalizedPhone || existingData?.customerPhone || '';
  const nextUsername = subscriber.username || existingData?.username || '';
  const nextVip = subscriber.vipTier || existingData?.vipTier || 'Member';
  const nextBookingId = subscriber.lastBookingId || existingData?.lastBookingId || '';
  const nextSubscribed = subscriber.subscribed !== undefined ? subscriber.subscribed : true;

  const hasMeaningfulChange =
    !existingData ||
    existingData.customerName !== resolvedName ||
    existingData.customerPhone !== nextPhone ||
    existingData.username !== nextUsername ||
    existingData.vipTier !== nextVip ||
    existingData.subscribed !== nextSubscribed ||
    (nextBookingId && existingData.lastBookingId !== nextBookingId);

  if (!hasMeaningfulChange && existingData) {
    return true;
  }

  const payload: CustomerTelegramSubscriber = {
    chatId: cleanChatId,
    customerName: resolvedName,
    customerPhone: nextPhone,
    username: nextUsername,
    firstName: subscriber.firstName || existingData?.firstName || '',
    lastName: subscriber.lastName || existingData?.lastName || '',
    vipTier: nextVip,
    subscribed: nextSubscribed,
    source: subscriber.source || existingData?.source || 'mini_app',
    lastBookingId: nextBookingId,
    subscribedAt: existingData?.subscribedAt || nowIso,
    updatedAt: existingData ? existingData.updatedAt || nowIso : nowIso,
  };

  let savedAnywhere = false;

  try {
    await setDoc(doc(db, 'telegramSubscribers', cleanChatId), payload, { merge: true });
    savedAnywhere = true;
  } catch {}

  try {
    const currentList = Array.isArray(configData.subscribers) ? [...configData.subscribers] : [];
    const idx = currentList.findIndex((s) => String(s.chatId) === cleanChatId);
    if (idx >= 0) {
      currentList[idx] = { ...currentList[idx], ...payload };
    } else {
      currentList.push(payload);
    }
    const nextExcluded = allowManualOverride
      ? (configData.excludedChatIds || []).filter((id) => id !== cleanChatId)
      : configData.excludedChatIds || [];

    await setDoc(
      doc(db, 'settings', 'telegramConfig'),
      { subscribers: currentList, excludedChatIds: nextExcluded },
      { merge: true }
    );
    savedAnywhere = true;
  } catch {}

  try {
    const localList: CustomerTelegramSubscriber[] = JSON.parse(
      localStorage.getItem('shangrila_cached_subscribers') || '[]'
    );
    const lIdx = localList.findIndex((s) => String(s.chatId) === cleanChatId);
    if (lIdx >= 0) localList[lIdx] = { ...localList[lIdx], ...payload };
    else localList.push(payload);
    localStorage.setItem('shangrila_cached_subscribers', JSON.stringify(localList));
  } catch {}

  return savedAnywhere;
};

export const removeCustomerTelegramSubscriber = async (
  chatId: string,
  addToExclusionList: boolean = true
): Promise<boolean> => {
  const cleanId = String(chatId || '').trim();
  if (!cleanId) return false;

  try {
    await deleteDoc(doc(db, 'telegramSubscribers', cleanId));
  } catch {}

  try {
    const cfg = await getTelegramConfig();
    const filteredSubs = (cfg.subscribers || []).filter((s) => String(s.chatId) !== cleanId);
    const excludedSet = new Set(cfg.excludedChatIds || []);
    if (addToExclusionList) {
      excludedSet.add(cleanId);
    }
    await setDoc(
      doc(db, 'settings', 'telegramConfig'),
      {
        subscribers: filteredSubs,
        excludedChatIds: Array.from(excludedSet),
      },
      { merge: true }
    );
  } catch {}

  try {
    const localList: CustomerTelegramSubscriber[] = JSON.parse(
      localStorage.getItem('shangrila_cached_subscribers') || '[]'
    );
    localStorage.setItem(
      'shangrila_cached_subscribers',
      JSON.stringify(localList.filter((s) => String(s.chatId) !== cleanId))
    );
  } catch {}

  return true;
};

export const getCustomerTelegramSubscribers = async (
  extraStaffNames: string[] = []
): Promise<CustomerTelegramSubscriber[]> => {
  const mergedMap = new Map<string, CustomerTelegramSubscriber>();
  const cfg = await getTelegramConfig();

  const mergeEntry = (item: Partial<CustomerTelegramSubscriber> & { chatId: string }) => {
    const cid = String(item.chatId || '').trim();
    if (!isPrivateUserChatId(cid)) return;

    if (isStaffOrAdminSubscriber(item, cfg, extraStaffNames)) {
      return;
    }

    const prev = mergedMap.get(cid);
    const cName = safeDecryptValue(
      item.customerName || [item.firstName, item.lastName].filter(Boolean).join(' ') || prev?.customerName || 'Guest'
    );
    const cPhone = normalizePhone(item.customerPhone || prev?.customerPhone || '');

    mergedMap.set(cid, {
      chatId: cid,
      customerName: cName,
      customerPhone: cPhone,
      username: item.username || prev?.username || '',
      firstName: item.firstName || prev?.firstName || '',
      lastName: item.lastName || prev?.lastName || '',
      vipTier: item.vipTier || prev?.vipTier || 'Member',
      subscribed: item.subscribed !== false,
      source: item.source || prev?.source || 'bot_command',
      lastBookingId: item.lastBookingId || prev?.lastBookingId || '',
      subscribedAt: item.subscribedAt || prev?.subscribedAt || '2026-01-01T00:00:00.000Z',
      updatedAt: item.updatedAt || prev?.updatedAt || '2026-01-01T00:00:00.000Z',
    });
  };

  if (Array.isArray(cfg.subscribers)) {
    cfg.subscribers.forEach((s) => {
      if (s && s.chatId) mergeEntry(s);
    });
  }

  try {
    const snap = await getDocs(collection(db, 'telegramSubscribers'));
    snap.forEach((docSnap) => {
      const data = docSnap.data() as CustomerTelegramSubscriber;
      const chatId = data?.chatId || docSnap.id;
      if (chatId) {
        mergeEntry({ ...data, chatId: String(chatId) });
      }
    });
  } catch {}

  try {
    const localList: CustomerTelegramSubscriber[] = JSON.parse(
      localStorage.getItem('shangrila_cached_subscribers') || '[]'
    );
    localList.forEach((s) => {
      if (s && s.chatId) mergeEntry(s);
    });
  } catch {}

  return Array.from(mergedMap.values()).sort((a, b) => {
    const aHasPhone = a.customerPhone ? 1 : 0;
    const bHasPhone = b.customerPhone ? 1 : 0;
    if (aHasPhone !== bHasPhone) return bHasPhone - aHasPhone;
    return a.chatId.localeCompare(b.chatId);
  });
};

export const findCustomerChatId = async (
  customerPhone?: string,
  explicitChatId?: string,
  customerName?: string,
  bookingId?: string
): Promise<string | null> => {
  const config = await getTelegramConfig();

  if (
    explicitChatId &&
    isPrivateUserChatId(explicitChatId) &&
    !isStaffOrAdminSubscriber({ chatId: explicitChatId }, config)
  ) {
    return String(explicitChatId).trim();
  }

  try {
    if (bookingId) {
      try {
        const bSnap = await getDoc(doc(db, 'bookings', bookingId));
        if (bSnap.exists()) {
          const bData = bSnap.data();
          const bChatId = bData?.customerChatId || bData?.telegramChatId || bData?.chatId;
          if (
            bChatId &&
            isPrivateUserChatId(bChatId) &&
            !isStaffOrAdminSubscriber({ chatId: String(bChatId) }, config)
          ) {
            return String(bChatId).trim();
          }
        }
      } catch {}
    }

    const subscribers = await getCustomerTelegramSubscribers();
    const activeSubs = subscribers.filter((s) => s.subscribed !== false && isPrivateUserChatId(s.chatId));

    if (bookingId) {
      const cleanId = bookingId.trim();
      const byBooking = activeSubs.find(
        (s) =>
          s.lastBookingId &&
          (s.lastBookingId === cleanId || cleanId.endsWith(s.lastBookingId) || s.lastBookingId.endsWith(cleanId))
      );
      if (byBooking) return byBooking.chatId;
    }

    const cleanTargetPhone = normalizePhone(customerPhone);
    if (cleanTargetPhone) {
      const byPhone = activeSubs.find((s) => {
        const subPhone = normalizePhone(s.customerPhone);
        return (
          subPhone &&
          (subPhone === cleanTargetPhone || subPhone.slice(-8) === cleanTargetPhone.slice(-8))
        );
      });
      if (byPhone) return byPhone.chatId;
    }

    const decryptedTargetName = safeDecryptValue(customerName || '').trim().toLowerCase();
    if (decryptedTargetName) {
      const byName = activeSubs.find((s) => {
        const subName = safeDecryptValue(s.customerName || '').trim().toLowerCase();
        const fullName = [s.firstName, s.lastName].filter(Boolean).join(' ').trim().toLowerCase();
        const uName = (s.username || '').trim().toLowerCase();
        return (
          (subName &&
            subName !== 'guest' &&
            subName !== 'telegram customer' &&
            (subName === decryptedTargetName ||
              subName.includes(decryptedTargetName) ||
              decryptedTargetName.includes(subName))) ||
          (fullName &&
            (fullName === decryptedTargetName ||
              fullName.includes(decryptedTargetName) ||
              decryptedTargetName.includes(fullName))) ||
          (uName && decryptedTargetName.includes(uName))
        );
      });
      if (byName) return byName.chatId;
    }

    return null;
  } catch {
    return null;
  }
};

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

export const fetchBotUsername = async (botToken?: string): Promise<string> => {
  try {
    const config = await getTelegramConfig();
    if (config.botUsername && config.botUsername.trim()) {
      const clean = config.botUsername.replace(/^@/, '').trim();
      localStorage.setItem('shangrila_bot_username', clean);
      return clean;
    }
    const token = botToken || config.botToken;
    if (!token) {
      return (localStorage.getItem('shangrila_bot_username') || 'theshangrilamenretreat').replace(/^@/, '').trim();
    }

    const res = await fetch(`https://api.telegram.org/bot${token.trim()}/getMe`);
    const data = await res.json();
    if (data?.ok && data?.result?.username) {
      const uname = String(data.result.username).replace(/^@/, '').trim();
      localStorage.setItem('shangrila_bot_username', uname);
      await saveTelegramConfig({ ...config, botUsername: uname });
      return uname;
    }
  } catch (e) {
    console.warn('Could not fetch bot username:', e);
  }
  return (localStorage.getItem('shangrila_bot_username') || 'theshangrilamenretreat').replace(/^@/, '').trim();
};

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
  return `https://t.me/theshangrilamenretreat?start=${startPayload}`;
};

// ==========================================
// 6. BOOKING REAL-TIME NOTIFICATIONS
// ==========================================

const getStatusBadge = (status: string): string => {
  switch (status.toLowerCase()) {
    case 'pending':
      return '🟡 <b>စောင့်ဆိုင်းဆဲ (PENDING)</b>';
    case 'approved':
    case 'confirmed':
      return '🟢 <b>အတည်ပြုပြီး (APPROVED / CONFIRMED)</b>';
    case 'in-service':
    case 'in_service':
      return '💆‍♂️ <b>ဝန်ဆောင်မှုပေးနေဆဲ (IN-SERVICE)</b>';
    case 'completed':
      return '✨ <b>ပြီးဆုံးပါပြီ (COMPLETED)</b>';
    case 'cancelled':
    case 'rejected':
      return '🔴 <b>ပယ်ဖျက်ထားသည် (CANCELLED)</b>';
    default:
      return `📌 <b>${escapeHtml(status.toUpperCase())}</b>`;
  }
};

export const notifyCustomerBookingStatus = async (
  eventType: 'NEW_BOOKING' | 'STATUS_UPDATE' | 'STAFF_ASSIGNED',
  booking: BookingNotificationPayload,
  existingConfig?: TelegramBotConfig
): Promise<{ customerSent: boolean; error?: string }> => {
  const config = existingConfig || (await getTelegramConfig());
  if (!config.enabled || !config.botToken || config.triggers.customerDirectNoti === false) {
    return { customerSent: false };
  }

  const decryptedCustomerName = safeDecryptValue(booking.customerName);
  const decryptedCustomerPhone = normalizePhone(booking.customerPhone) || safeDecryptValue(booking.customerPhone);

  let targetChatId = await findCustomerChatId(
    decryptedCustomerPhone,
    booking.customerChatId,
    decryptedCustomerName,
    booking.id
  );

  if (!targetChatId) {
    await fetchRecentBotChats(config.botToken, true);
    targetChatId = await findCustomerChatId(
      decryptedCustomerPhone,
      booking.customerChatId,
      decryptedCustomerName,
      booking.id
    );
  }

  if (!targetChatId) {
    return { customerSent: false, error: 'Customer Chat ID not subscribed or matched yet' };
  }

  await saveCustomerTelegramSubscription({
    chatId: targetChatId,
    customerName: decryptedCustomerName,
    customerPhone: decryptedCustomerPhone,
    vipTier: booking.vipTier,
    lastBookingId: booking.id,
    subscribed: true,
  });

  if (booking.id && booking.id !== 'TEST-9988') {
    try {
      await updateDoc(doc(db, 'bookings', booking.id), {
        customerChatId: targetChatId,
        telegramChatId: targetChatId,
      });
    } catch {}
  }

  const statusLower = booking.status.toLowerCase();
  const formattedPrice = booking.price ? `${Number(booking.price).toLocaleString()} MMK` : '-';

  let customerTitle = "🌿 <b>THE SHANGRI-LA MEN'S RETREAT</b>";
  let statusIntro = 'သင်၏ ရက်ချိန်းအချက်အလက် အောက်ပါအတိုင်း ဖြစ်ပါသည် -';

  if (statusLower === 'pending') {
    customerTitle = '🟡 <b>ဘိုကင်တင်ခြင်း လက်ခံရရှိပါသည် (BOOKING PENDING)</b>';
    statusIntro =
      'လူကြီးမင်း၏ ရက်ချိန်းတောင်းဆိုမှုကို လက်ခံရရှိပါသည်။ Admin အဖွဲ့မှ အမြန်ဆုံး စစ်ဆေးအတည်ပြုပေးပါမည်။';
  } else if (statusLower === 'confirmed' || statusLower === 'approved' || eventType === 'STAFF_ASSIGNED') {
    customerTitle = '🟢 <b>သင်၏ ရက်ချိန်းကို အတည်ပြုပြီးပါပြီ (BOOKING APPROVED)</b>';
    statusIntro =
      'လူကြီးမင်း၏ ဘိုကင်ကို အတည်ပြု (Approve) ပြုလုပ်ပြီးဖြစ်ပါသည်။ သတ်မှတ်ချိန်မတိုင်မီ (၁၀) မိနစ်ခန့် ကြိုတင်ကြွရောက်ပေးပါရန် လေးစားစွာ ပန်ကြားအပ်ပါသည်။';
  } else if (statusLower === 'in-service' || statusLower === 'in_service') {
    customerTitle = '💆‍♂️ <b>ဝန်ဆောင်မှု စတင်နေပါပြီ (IN-SERVICE)</b>';
    statusIntro =
      "The Shangri-La Men's Retreat တွင် စိတ်အေးချမ်းသာစွာ အနားယူအပန်းဖြေနိုင်ပါစေကြောင်း ဆုမွန်ကောင်းတောင်းအပ်ပါသည်။";
  } else if (statusLower === 'completed') {
    customerTitle = '✨ <b>ဝန်ဆောင်မှု ပြီးဆုံးပါပြီ (THANK YOU FOR VISITING)</b>';
    statusIntro =
      'လာရောက်အားပေးမှုအတွက် အထူးကျေးဇူးတင်ရှိပါသည်။ နောက်တစ်ကြိမ် ရက်ချိန်းများကိုလည်း အောက်ပါ Mini App မှတစ်ဆင့် အလွယ်တကူ ရယူနိုင်ပါသည်။';
  } else if (statusLower === 'cancelled' || statusLower === 'rejected') {
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
    `👤 <b>အမည်:</b> ${escapeHtml(decryptedCustomerName)}`,
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

export const notifyBookingEvent = async (
  eventType: 'NEW_BOOKING' | 'STATUS_UPDATE' | 'STAFF_ASSIGNED',
  booking: BookingNotificationPayload
): Promise<{ adminSent: boolean; staffSent: boolean; customerSent?: boolean; errors: string[] }> => {
  const config = await getTelegramConfig();
  const errors: string[] = [];

  if (!config.enabled || !config.botToken) {
    return { adminSent: false, staffSent: false, customerSent: false, errors: ['Telegram Bot is disabled or missing token'] };
  }

  const statusLower = booking.status.toLowerCase();
  if (eventType === 'NEW_BOOKING' && !config.triggers.newBooking) {
    return { adminSent: false, staffSent: false, customerSent: false, errors: [] };
  }
  if (eventType === 'STATUS_UPDATE') {
    if ((statusLower === 'confirmed' || statusLower === 'approved') && !config.triggers.bookingConfirmed) {
      return { adminSent: false, staffSent: false, customerSent: false, errors: [] };
    }
    if ((statusLower === 'in-service' || statusLower === 'in_service') && !config.triggers.bookingInService) {
      return { adminSent: false, staffSent: false, customerSent: false, errors: [] };
    }
    if (statusLower === 'completed' && !config.triggers.bookingCompleted) {
      return { adminSent: false, staffSent: false, customerSent: false, errors: [] };
    }
    if ((statusLower === 'cancelled' || statusLower === 'rejected') && !config.triggers.bookingCancelled) {
      return { adminSent: false, staffSent: false, customerSent: false, errors: [] };
    }
  }

  const decryptedCustomerName = safeDecryptValue(booking.customerName);
  const decryptedCustomerPhone = normalizePhone(booking.customerPhone) || safeDecryptValue(booking.customerPhone);

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
    `👤 <b>ဧည့်သည်အမည်:</b> ${escapeHtml(decryptedCustomerName)} ${booking.vipTier ? `(${escapeHtml(booking.vipTier)})` : ''}`,
    `📞 <b>ဖုန်းနံပါတ်:</b> <code>${escapeHtml(decryptedCustomerPhone)}</code>`,
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

  const customerResult = await notifyCustomerBookingStatus(eventType, booking, config);

  return { adminSent, staffSent, customerSent: customerResult.customerSent, errors };
};

// ==========================================
// 7. BULK PROMOTION & INSTANT PUSH BROADCAST
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
  const activeSubscribers = allSubscribers.filter((s) => s.subscribed !== false && isPrivateUserChatId(s.chatId));

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
// 8. STAFF OPERATIONS NOTIFICATIONS
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
// 9. BOT DISCOVERY, AUTO-STAFF LINKING & CUSTOMER SYNC
// ==========================================

export interface DiscoveredTelegramChat {
  chatId: string;
  titleOrName: string;
  username?: string;
  type: 'private' | 'group' | 'supergroup' | 'channel';
  lastMessage: string;
  date: string;
  startPayload?: string;
  roleTag?: 'ADMIN' | 'STAFF' | 'CUSTOMER' | 'GROUP';
  linkedStaffId?: string;
}

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
    const cleanToken = botToken.trim();
    await fetchBotUsername(cleanToken);

    const allowedUpdatesParam = encodeURIComponent(
      JSON.stringify(['message', 'business_message', 'edited_message', 'callback_query', 'my_chat_member'])
    );

    let response = await fetch(
      `https://api.telegram.org/bot${cleanToken}/getUpdates?limit=100&allowed_updates=${allowedUpdatesParam}`
    );
    let data = await response.json();

    if (!data.ok && (response.status === 409 || String(data.description || '').toLowerCase().includes('webhook'))) {
      await fetch(`https://api.telegram.org/bot${cleanToken}/deleteWebhook?drop_pending_updates=false`);
      response = await fetch(
        `https://api.telegram.org/bot${cleanToken}/getUpdates?limit=100&allowed_updates=${allowedUpdatesParam}`
      );
      data = await response.json();
    }

    const chatMap = new Map<string, DiscoveredTelegramChat & { firstName?: string; lastName?: string }>();
    let newlySubscribedCount = 0;
    const welcomedUpdateIds: Set<string> = new Set(
      JSON.parse(localStorage.getItem('shangrila_welcomed_tg_updates') || '[]')
    );
    const businessRepliedIds: Set<string> = new Set(
      JSON.parse(localStorage.getItem('shangrila_business_autoreplied_ids') || '[]')
    );

    const config = await getTelegramConfig();

    const existingBookings: any[] = [];
    try {
      const bookingsSnap = await getDocs(collection(db, 'bookings'));
      bookingsSnap.forEach((bDoc) => {
        existingBookings.push({ id: bDoc.id, ...bDoc.data() });
      });
    } catch {}

    if (data.ok && Array.isArray(data.result)) {
      for (const update of data.result) {
        const msgObj = update.business_message || update.message || update.edited_message;
        const chat =
          msgObj?.chat ||
          update.callback_query?.message?.chat ||
          update.callback_query?.from ||
          update.my_chat_member?.chat;

        if (!chat || !chat.id) continue;

        const chatIdStr = String(chat.id);
        const chatType = chat.type || (isPrivateUserChatId(chatIdStr) ? 'private' : 'group');
        const titleOrName =
          chat.title ||
          [chat.first_name, chat.last_name].filter(Boolean).join(' ') ||
          chat.username ||
          'Telegram User';
        const text: string = msgObj?.text || update.callback_query?.data || '';

        // --- Telegram Business Direct Message Keyword Auto-Reply ---
        if (
          msgObj &&
          msgObj.text &&
          !msgObj.from?.is_bot &&
          (!update.business_message || String(msgObj.from?.id) === String(msgObj.chat?.id))
        ) {
          const uniqueMsgKey = `${chatIdStr}_${msgObj.message_id}`;
          if (!businessRepliedIds.has(uniqueMsgKey)) {
            const matchedRule = matchBusinessKeywordRule(msgObj.text, config);
            if (matchedRule) {
              businessRepliedIds.add(uniqueMsgKey);
              await sendRawTelegramMessage(
                cleanToken,
                chatIdStr,
                matchedRule.replyMessage,
                undefined,
                `BUSINESS_AUTO_REPLY_${matchedRule.id.toUpperCase()}`,
                {
                  businessConnectionId: msgObj.business_connection_id,
                  replyToMessageId: msgObj.message_id,
                  plainText: true,
                }
              );
            }
          }
        }

        let startPayload = '';
        if (text.startsWith('/start')) {
          const parts = text.trim().split(/\s+/);
          if (parts.length > 1) startPayload = parts[1];
        }

        const prevEntry = chatMap.get(chatIdStr);
        chatMap.set(chatIdStr, {
          chatId: chatIdStr,
          titleOrName,
          username: chat.username || prevEntry?.username || '',
          firstName: chat.first_name || prevEntry?.firstName || '',
          lastName: chat.last_name || prevEntry?.lastName || '',
          type: chatType,
          lastMessage: text || prevEntry?.lastMessage || '[Bot Interaction]',
          date: msgObj?.date
            ? new Date(msgObj.date * 1000).toLocaleString()
            : prevEntry?.date || '-',
          startPayload: startPayload || prevEntry?.startPayload || '',
        });

        const updateKey = String(update.update_id);
        if (
          autoBindCustomers &&
          chatType === 'private' &&
          !welcomedUpdateIds.has(updateKey) &&
          (text.startsWith('/start') ||
            text.startsWith('/book') ||
            text.startsWith('/staff') ||
            text.startsWith('/available') ||
            text.startsWith('/history') ||
            text.startsWith('/vip'))
        ) {
          welcomedUpdateIds.add(updateKey);
          let extractedPhone = '';
          let extractedBookingId = '';
          if (startPayload.startsWith('book_')) {
            const tokens = startPayload.split('_');
            extractedBookingId = tokens[1] || '';
            extractedPhone = tokens.slice(2).join('') || '';
          } else if (startPayload.startsWith('sub_')) {
            extractedPhone = startPayload.replace('sub_', '');
          }
          await sendInteractiveMiniAppMenu(chatIdStr, config, extractedBookingId, extractedPhone);
        }
      }
    }

    localStorage.setItem(
      'shangrila_business_autoreplied_ids',
      JSON.stringify(Array.from(businessRepliedIds).slice(-300))
    );

    let staffMappingChanged = false;
    const updatedStaffMappings = [...(config.staffMappings || [])];

    const staffKnownNameToId: Record<string, string> = {
      'htet wai': 'No. 1',
      'nay myo maung': 'No. 3',
      'min myat aung': 'No. 5',
      'naing win aung': 'No. 6',
      'n w a': 'No. 6',
      'nwa146': 'No. 6',
      'sai win thant htoo': 'No. 10',
    };

    for (const discovered of chatMap.values()) {
      const lowerTitle = `${discovered.titleOrName} ${discovered.username || ''}`.toLowerCase();

      for (const [kName, targetStaffId] of Object.entries(staffKnownNameToId)) {
        if (lowerTitle.includes(kName)) {
          const sIdx = updatedStaffMappings.findIndex((s) => s.staffId === targetStaffId);
          if (sIdx >= 0 && !updatedStaffMappings[sIdx].telegramChatId) {
            updatedStaffMappings[sIdx] = {
              ...updatedStaffMappings[sIdx],
              telegramChatId: discovered.chatId,
            };
            staffMappingChanged = true;
          }
          discovered.roleTag = 'STAFF';
          discovered.linkedStaffId = targetStaffId;
        }
      }

      if (String(config.adminGroupChatId).trim() === discovered.chatId || lowerTitle.includes('shangrilamenretreat')) {
        discovered.roleTag = 'ADMIN';
      } else if (!isPrivateUserChatId(discovered.chatId)) {
        discovered.roleTag = 'GROUP';
      } else if (!discovered.roleTag) {
        const matchedStaff = updatedStaffMappings.find(
          (s) => String(s.telegramChatId).trim() === discovered.chatId
        );
        if (matchedStaff) {
          discovered.roleTag = 'STAFF';
          discovered.linkedStaffId = matchedStaff.staffId;
        } else if (
          isStaffOrAdminSubscriber(
            { chatId: discovered.chatId, customerName: discovered.titleOrName, username: discovered.username },
            config
          )
        ) {
          discovered.roleTag = 'ADMIN';
        } else {
          discovered.roleTag = 'CUSTOMER';
        }
      }
    }

    if (staffMappingChanged) {
      config.staffMappings = updatedStaffMappings;
      await saveTelegramConfig(config);
    }

    if (autoBindCustomers) {
      const sortedBookings = [...existingBookings].sort((a, b) =>
        String(b.createdAt || b.date || '').localeCompare(String(a.createdAt || a.date || ''))
      );

      for (const discovered of chatMap.values()) {
        if (discovered.type !== 'private' || !isPrivateUserChatId(discovered.chatId)) continue;

        if (
          discovered.roleTag === 'ADMIN' ||
          discovered.roleTag === 'STAFF' ||
          isStaffOrAdminSubscriber(
            {
              chatId: discovered.chatId,
              customerName: discovered.titleOrName,
              username: discovered.username,
              firstName: discovered.firstName,
              lastName: discovered.lastName,
            },
            config
          )
        ) {
          await removeCustomerTelegramSubscriber(discovered.chatId, false);
          continue;
        }

        let extractedPhone = '';
        let extractedBookingId = '';
        const payload = discovered.startPayload || '';

        if (payload.startsWith('book_')) {
          const tokens = payload.split('_');
          extractedBookingId = tokens[1] || '';
          extractedPhone = tokens.slice(2).join('') || '';
        } else if (payload.startsWith('sub_')) {
          extractedPhone = payload.replace('sub_', '');
        }

        const matchedBooking = sortedBookings.find((b) => {
          const bId = String(b.id || '');
          const bChat = String(b.customerChatId || b.telegramChatId || '').trim();
          const bName = safeDecryptValue(b.customerName || b.name || '').trim().toLowerCase();
          const bPhone = normalizePhone(b.customerPhone || b.phone || '');
          const dName = discovered.titleOrName.trim().toLowerCase();
          const dUser = (discovered.username || '').trim().toLowerCase();

          if (bChat === discovered.chatId) return true;
          if (extractedBookingId && (bId === extractedBookingId || bId.endsWith(extractedBookingId))) return true;
          if (extractedPhone && bPhone && bPhone === normalizePhone(extractedPhone)) return true;
          if (
            bName &&
            dName &&
            dName.length >= 3 &&
            (bName === dName || bName.includes(dName) || dName.includes(bName))
          ) {
            return true;
          }
          if (bName && dUser && dUser.length >= 3 && bName.includes(dUser)) return true;
          return false;
        });

        if (matchedBooking) {
          const mPhone = normalizePhone(matchedBooking.customerPhone || matchedBooking.phone || '');
          if (!extractedPhone && mPhone) extractedPhone = mPhone;
          if (!extractedBookingId && matchedBooking.id) extractedBookingId = matchedBooking.id;

          try {
            await updateDoc(doc(db, 'bookings', matchedBooking.id), {
              customerChatId: discovered.chatId,
              telegramChatId: discovered.chatId,
            });
          } catch {}
        }

        const resolvedCustomerName = matchedBooking
          ? safeDecryptValue(matchedBooking.customerName || matchedBooking.name || '') || discovered.titleOrName
          : discovered.titleOrName;

        const saved = await saveCustomerTelegramSubscription({
          chatId: discovered.chatId,
          customerName: resolvedCustomerName,
          customerPhone: extractedPhone,
          username: discovered.username || '',
          firstName: discovered.firstName || '',
          lastName: discovered.lastName || '',
          lastBookingId: extractedBookingId,
          subscribed: true,
          source: payload ? 'booking_deeplink' : 'bot_command',
        });

        if (saved) newlySubscribedCount++;
      }
    }

    const trimmedIds = Array.from(welcomedUpdateIds).slice(-200);
    localStorage.setItem('shangrila_welcomed_tg_updates', JSON.stringify(trimmedIds));

    return {
      ok: true,
      chats: Array.from(chatMap.values()),
      newlySubscribedCount,
    };
  } catch (err: any) {
    return { ok: false, chats: [], error: err?.message || 'Network error' };
  }
};

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

export const syncBotCommandsAndMenu = async (config: TelegramBotConfig): Promise<{ ok: boolean; message: string }> => {
  if (!config.botToken) return { ok: false, message: 'Bot Token မရှိပါ' };

  try {
    const baseUrl = `https://api.telegram.org/bot${config.botToken.trim()}`;
    const cleanWebAppUrl = (config.webAppUrl || 'https://www.shangrilamenretreat.online').replace(/\/$/, '');

    await fetchBotUsername(config.botToken);

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

// ==========================================
// 10. WALK-IN BOOKING, CLOCK-IN START, OUTCALL 4-STAGE & 10-MIN REMINDER ALERTS
// ==========================================

export interface WalkInServiceAlertPayload {
  bookingId: string;
  invoiceNo?: string;
  customerName: string;
  customerPhone?: string;
  serviceName: string;
  durationMins: number;
  totalPrice: number;
  therapistName: string;
  appointmentDate: string;
  appointmentTime: string;
  startTimeStr?: string;
  expectedEndTimeStr?: string;
  overdueMinutes?: number;
  notes?: string;
}

export interface OutcallServiceNotificationPayload {
  bookingId: string;
  invoiceNo?: string;
  customerName: string;
  customerPhone?: string;
  serviceName: string;
  durationMins: number;
  totalPrice: number;
  therapistName: string;
  appointmentDate: string;
  appointmentTime: string;
  outcallPhase: 'on_the_way' | 'in_service' | 'time_up' | 'returning' | 'return_reminder' | 'completed';
  dispatchedTimeStr?: string;
  arrivalStartTimeStr?: string;
  expectedEndTimeStr?: string;
  returningTimeStr?: string;
  overdueMinutes?: number;
  notes?: string;
}

export const resolveAssignedStaffChatIds = (
  therapistNameStr: string,
  staffMappings: StaffTelegramMapping[]
): { staffId: string; staffName: string; chatId: string }[] => {
  if (!therapistNameStr || !Array.isArray(staffMappings)) return [];
  const results: { staffId: string; staffName: string; chatId: string }[] = [];
  const seenChatIds = new Set<string>();

  const parts = String(therapistNameStr)
    .split(/&|,|\+/)
    .map((s) => s.trim())
    .filter(Boolean);

  for (const part of parts) {
    const numMatch = part.match(/0*(\d+)\b/);
    const targetNum = numMatch ? String(parseInt(numMatch[1], 10)) : '';

    const matched = staffMappings.find((m) => {
      const mIdNum = String(m.staffId || '').match(/0*(\d+)\b/);
      const mNameNum = String(m.staffName || '').match(/0*(\d+)\b/);
      const mNum = mIdNum ? String(parseInt(mIdNum[1], 10)) : mNameNum ? String(parseInt(mNameNum[1], 10)) : '';

      if (targetNum && mNum && targetNum === mNum) return true;
      return (
        String(m.staffName || '').trim().toLowerCase() === part.toLowerCase() ||
        String(m.staffId || '').trim().toLowerCase() === part.toLowerCase()
      );
    });

    if (
      matched &&
      matched.telegramChatId &&
      String(matched.telegramChatId).trim() &&
      matched.receiveBookingAssign !== false
    ) {
      const cleanId = String(matched.telegramChatId).trim();
      if (!seenChatIds.has(cleanId)) {
        seenChatIds.add(cleanId);
        results.push({
          staffId: matched.staffId,
          staffName: matched.staffName,
          chatId: cleanId,
        });
      }
    }
  }

  return results;
};

export const notifyOutcallServiceEvent = async (
  payload: OutcallServiceNotificationPayload
): Promise<{ adminSent: boolean; staffSent: boolean }> => {
  try {
    const config = await getTelegramConfig();
    if (!config.enabled || !config.botToken) {
      return { adminSent: false, staffSent: false };
    }

    const cleanCustomerName = safeDecryptValue(payload.customerName || 'Walk-in Guest');
    const cleanCustomerPhone =
      normalizePhone(payload.customerPhone) || safeDecryptValue(payload.customerPhone || '');
    const invCode = payload.invoiceNo || String(payload.bookingId || '').slice(-6).toUpperCase();

    let title = '';
    let statusBadge = '';
    let detailLines: string[] = [];

    switch (payload.outcallPhase) {
      case 'on_the_way':
        title = '🚗 OUTCALL DISPATCHED (ဧည့်သည်ထံ သွားနေဆဲ)';
        statusBadge = '🚗 <b>သွားနေဆဲ (ON THE WAY TO CLIENT)</b>';
        detailLines = [
          `🕒 <b>ဘောင်ချာထုတ်ချိန်:</b> ${escapeHtml(payload.dispatchedTimeStr || payload.appointmentTime)}`,
          `⏳ <b>Service Timer:</b> ဧည့်သည်ထံရောက်ရှိ၍ ဝန်ထမ်းမှ <b>"ဧည့်သည်ထံရောက်ရှိကြောင်း အကြောင်းကြားရန်"</b> နှိပ်မှသာ အချိန်စတင်မှတ်သားပါမည်။`,
        ];
        break;

      case 'in_service':
        title = '💆‍♂️ OUTCALL STARTED (ဧည့်သည်ထံရောက်ရှိပြီး ဝန်ဆောင်မှုစတင်နေပါပြီ)';
        statusBadge = '💆‍♂️ <b>ဝန်ဆောင်မှုပေးနေဆဲ (IN SERVICE)</b>';
        detailLines = [
          `🟢 <b>ဧည့်သည်ထံရောက်ရှိ/စတင်ချိန်:</b> <b>${escapeHtml(payload.arrivalStartTimeStr || '-')}</b>`,
          `🏁 <b>ပြီးဆုံးရမည့်အချိန် (End Time):</b> <b>${escapeHtml(payload.expectedEndTimeStr || '-')}</b>`,
          `⏱️ <i>ဝန်ထမ်း App တွင် သတ်မှတ်ချိန် (${payload.durationMins} မိနစ်) စတင်မှတ်သားနေပါပြီ။</i>`,
        ];
        break;

      case 'time_up':
        title = '⏰ OUTCALL TIME UP (ဝန်ဆောင်မှု သတ်မှတ်ချိန် ပြည့်ပါပြီ!)';
        statusBadge = '⏰ <b>သတ်မှတ်ချိန်ပြည့်ပြီ (SERVICE TIME UP)</b>';
        detailLines = [
          `🟢 <b>စတင်ခဲ့သည့်အချိန်:</b> ${escapeHtml(payload.arrivalStartTimeStr || '-')}`,
          `🏁 <b>သတ်မှတ်ပြီးဆုံးချိန်:</b> <b>${escapeHtml(payload.expectedEndTimeStr || '-')}</b>`,
          `🔔 <i>ဝန်ဆောင်မှုသတ်မှတ်ချိန် ပြည့်သွားပါပြီ။ ဝန်ဆောင်မှုပြီးဆုံးပါက Staff Portal တွင် <b>"ဝန်ဆောင်မှုပြီးဆုံးပြီ — ဆိုင်သို့ပြန်ထွက်မည်"</b> ခလုတ်ကို နှိပ်ပေးပါရန်။</i>`,
        ];
        break;

      case 'returning':
        title = '🛵 OUTCALL RETURNING (ဝန်ဆောင်မှုပြီးဆုံး၍ ဆိုင်သို့ပြန်လာနေဆဲ)';
        statusBadge = '🛵 <b>ဆိုင်သို့ပြန်လာနေဆဲ (RETURNING TO SHOP)</b>';
        detailLines = [
          `🟢 <b>စတင်ခဲ့သည့်အချိန်:</b> ${escapeHtml(payload.arrivalStartTimeStr || '-')}`,
          `🛵 <b>ပြန်ထွက်လာချိန်:</b> <b>${escapeHtml(payload.returningTimeStr || '-')}</b>`,
          `🏠 <i>ဆိုင်သို့ ပြန်လည်ရောက်ရှိပါက Staff Portal တွင် <b>"🏠 ဆိုင်သို့ပြန်ရောက်ပြီ (Complete & Clock Out)"</b> ခလုတ်ကို နှိပ်ပေးပါရန် (မနှိပ်သေးမချင်း ၁၀ မိနစ်တစ်ခါ သတိပေးပါမည်)။</i>`,
        ];
        break;

      case 'return_reminder':
        title = '🔔🛵 RETURN CLOCK-OUT REMINDER (ဆိုင်သို့ပြန်ရောက်ကြောင်း နှိပ်ရန် သတိပေးချက်)';
        statusBadge = '🛵 <b>ဆိုင်သို့ပြန်လာနေဆဲ — Clock Out မနှိပ်ရသေးပါ</b>';
        detailLines = [
          `🛵 <b>ဧည့်သည်ထံမှ ပြန်ထွက်လာချိန်:</b> ${escapeHtml(payload.returningTimeStr || '-')}`,
          `⏳ <b>ကြာမြင့်ချိန်:</b> <b>${payload.overdueMinutes || 10} မိနစ် ရှိပါပြီ</b>`,
          `⚠️ <i>ဆိုင်သို့ ပြန်လည်ရောက်ရှိပြီဖြစ်ပါက Staff Portal တွင် <b>"🏠 ဆိုင်သို့ပြန်ရောက်ပြီ (Complete & Clock Out)"</b> ခလုတ်ကို မမေ့မလျော့ နှိပ်ပေးပါရန်။</i>`,
        ];
        break;

      case 'completed':
        title = '🏠✅ OUTCALL COMPLETED (ဆိုင်သို့ပြန်ရောက်ပြီး Clock-Out ပြီးဆုံးပါပြီ)';
        statusBadge = '🟢 <b>ဆိုင်သို့ပြန်ရောက်ပြီ (AVAILABLE AT SHOP)</b>';
        detailLines = [
          `🟢 <b>ဝန်ဆောင်မှုစတင်ချိန်:</b> ${escapeHtml(payload.arrivalStartTimeStr || '-')}`,
          `🏠 <b>ဆိုင်သို့ပြန်ရောက်ချိန်:</b> <b>${escapeHtml(payload.returningTimeStr || '-')}</b>`,
          payload.notes ? `📝 <b>မှတ်ချက်:</b> ${escapeHtml(payload.notes)}` : '',
        ].filter(Boolean);
        break;
    }

    const msgHtml = [
      `<b>${escapeHtml(title)}</b>`,
      `━━━━━━━━━━━━━━━━━━━━`,
      `🧾 <b>ဘောင်ချာနံပါတ်:</b> <code>${escapeHtml(invCode)}</code>`,
      `📊 <b>Status:</b> ${statusBadge}`,
      `👨‍💼 <b>Therapist:</b> <b>${escapeHtml(payload.therapistName)}</b>`,
      `👤 <b>ဧည့်သည်:</b> ${escapeHtml(cleanCustomerName)} ${cleanCustomerPhone ? `(<code>${escapeHtml(cleanCustomerPhone)}</code>)` : ''}`,
      `💆‍♂️ <b>ဝန်ဆောင်မှု:</b> ${escapeHtml(payload.serviceName)} (${payload.durationMins} Mins)`,
      `💰 <b>ကျသင့်ငွေ:</b> ${Number(payload.totalPrice || 0).toLocaleString()} Ks`,
      `━━━━━━━━━━━━━━━━━━━━`,
      ...detailLines,
      `━━━━━━━━━━━━━━━━━━━━`,
      `<i>${escapeHtml(config.botFlow.customFooterText)}</i>`,
    ]
      .filter(Boolean)
      .join('\n');

    let adminSent = false;
    let staffSent = false;

    if (config.adminGroupChatId) {
      const res = await sendRawTelegramMessage(
        config.botToken,
        config.adminGroupChatId,
        msgHtml,
        undefined,
        `OUTCALL_${payload.outcallPhase.toUpperCase()}`
      );
      adminSent = res.ok;
    }

    const staffTargets = resolveAssignedStaffChatIds(payload.therapistName, config.staffMappings);
    for (const st of staffTargets) {
      const sRes = await sendRawTelegramMessage(
        config.botToken,
        st.chatId,
        msgHtml,
        undefined,
        `STAFF_OUTCALL_${payload.outcallPhase.toUpperCase()}`
      );
      staffSent = staffSent || sRes.ok;
    }

    if (config.staffGroupChatId && config.staffGroupChatId !== config.adminGroupChatId) {
      const gRes = await sendRawTelegramMessage(
        config.botToken,
        config.staffGroupChatId,
        msgHtml,
        undefined,
        `GROUP_OUTCALL_${payload.outcallPhase.toUpperCase()}`
      );
      staffSent = staffSent || gRes.ok;
    }

    return { adminSent, staffSent };
  } catch (err) {
    console.warn('notifyOutcallServiceEvent warning:', err);
    return { adminSent: false, staffSent: false };
  }
};

export const notifyWalkInBookingCreated = async (
  payload: WalkInServiceAlertPayload
): Promise<{ adminSent: boolean; staffSent: boolean }> => {
  const config = await getTelegramConfig();
  if (!config.enabled || !config.botToken) {
    return { adminSent: false, staffSent: false };
  }

  const cleanCustomerName = safeDecryptValue(payload.customerName || 'Walk-in Guest');
  const cleanCustomerPhone =
    normalizePhone(payload.customerPhone) || safeDecryptValue(payload.customerPhone || '');

  const msgHtml = [
    `📞 <b>WALK-IN ကြိုတင်ဘိုကင်အသစ် (PHONE RESERVATION)</b>`,
    `━━━━━━━━━━━━━━━━━━━━`,
    `🧾 <b>Booking Invoice:</b> <code>${escapeHtml(payload.invoiceNo || payload.bookingId.slice(-6).toUpperCase())}</code>`,
    `📊 <b>အခြေအနေ:</b> 🟡 <b>ကြိုတင်ဘိုကင်မှတ်ထားဆဲ (ဘောင်ချာမထုတ်ရသေးပါ)</b>`,
    `👤 <b>ဧည့်သည်:</b> ${escapeHtml(cleanCustomerName)} ${cleanCustomerPhone ? `(<code>${escapeHtml(cleanCustomerPhone)}</code>)` : ''}`,
    `💆‍♂️ <b>ဝန်ဆောင်မှု:</b> ${escapeHtml(payload.serviceName)} (${payload.durationMins} Mins)`,
    `💰 <b>ကျသင့်ငွေ:</b> ${Number(payload.totalPrice || 0).toLocaleString()} Ks`,
    `📅 <b>ချိန်းဆိုချိန်:</b> ${escapeHtml(payload.appointmentDate)} | ⏰ <b>${escapeHtml(payload.appointmentTime)}</b>`,
    `👨‍💼 <b>တာဝန်ကျဝန်ထမ်း:</b> <b>${escapeHtml(payload.therapistName)}</b>`,
    payload.notes ? `📝 <b>မှတ်ချက်:</b> <i>${escapeHtml(safeDecryptValue(payload.notes))}</i>` : null,
    `━━━━━━━━━━━━━━━━━━━━`,
    `📌 <i>ဧည့်သည်ရောက်ရှိ၍ POS မှ ဘောင်ချာထုတ်ပေးမှသာ ဝန်ထမ်း App တွင် အချိန်စမှတ်ပါမည်။</i>`,
  ]
    .filter(Boolean)
    .join('\n');

  let adminSent = false;
  let staffSent = false;

  if (config.adminGroupChatId) {
    const res = await sendRawTelegramMessage(
      config.botToken,
      config.adminGroupChatId,
      msgHtml,
      undefined,
      'WALKIN_BOOKING_NEW'
    );
    adminSent = res.ok;
  }

  const staffTargets = resolveAssignedStaffChatIds(payload.therapistName, config.staffMappings);
  for (const st of staffTargets) {
    const sRes = await sendRawTelegramMessage(
      config.botToken,
      st.chatId,
      msgHtml,
      undefined,
      'STAFF_WALKIN_BOOKING'
    );
    staffSent = staffSent || sRes.ok;
  }

  if (config.staffGroupChatId && config.staffGroupChatId !== config.adminGroupChatId) {
    const gRes = await sendRawTelegramMessage(
      config.botToken,
      config.staffGroupChatId,
      msgHtml,
      undefined,
      'GROUP_WALKIN_BOOKING'
    );
    staffSent = staffSent || gRes.ok;
  }

  return { adminSent, staffSent };
};

export const notifyServiceClockInStarted = async (
  payload: WalkInServiceAlertPayload
): Promise<{ adminSent: boolean; staffSent: boolean }> => {
  const config = await getTelegramConfig();
  if (!config.enabled || !config.botToken) {
    return { adminSent: false, staffSent: false };
  }

  const cleanCustomerName = safeDecryptValue(payload.customerName || 'Walk-in Guest');

  const msgHtml = [
    `▶️ <b>SERVICE CLOCK-IN စတင်ပါပြီ (TIMER STARTED)</b>`,
    `━━━━━━━━━━━━━━━━━━━━`,
    `🧾 <b>ဘောင်ချာနံပါတ်:</b> <code>${escapeHtml(payload.invoiceNo || payload.bookingId.slice(-6).toUpperCase())}</code>`,
    `🏷️ <b>အမျိုးအစား:</b> Voucher Issued & In-Service`,
    `👨‍💼 <b>Therapist:</b> <b>${escapeHtml(payload.therapistName)}</b>`,
    `👤 <b>ဧည့်သည်:</b> ${escapeHtml(cleanCustomerName)}`,
    `💆‍♂️ <b>ဝန်ဆောင်မှု:</b> ${escapeHtml(payload.serviceName)} (${payload.durationMins} Mins)`,
    `🟢 <b>စတင်ချိန် (Start Time):</b> <b>${escapeHtml(payload.startTimeStr || '-')}</b>`,
    `🏁 <b>ပြီးဆုံးရမည့်အချိန် (End Time):</b> <b>${escapeHtml(payload.expectedEndTimeStr || '-')}</b>`,
    `━━━━━━━━━━━━━━━━━━━━`,
    `⏱️ <i>ဝန်ထမ်း App တွင် အချိန်စတင်မှတ်သားနေပါပြီ။ ဝန်ဆောင်မှုပြီးဆုံးပါက Clock Out နှိပ်ပေးပါရန်။</i>`,
  ].join('\n');

  let adminSent = false;
  let staffSent = false;

  if (config.adminGroupChatId) {
    const res = await sendRawTelegramMessage(
      config.botToken,
      config.adminGroupChatId,
      msgHtml,
      undefined,
      'SERVICE_CLOCK_IN'
    );
    adminSent = res.ok;
  }

  const staffTargets = resolveAssignedStaffChatIds(payload.therapistName, config.staffMappings);
  for (const st of staffTargets) {
    const sRes = await sendRawTelegramMessage(
      config.botToken,
      st.chatId,
      msgHtml,
      undefined,
      'STAFF_CLOCK_IN'
    );
    staffSent = staffSent || sRes.ok;
  }

  if (config.staffGroupChatId && config.staffGroupChatId !== config.adminGroupChatId) {
    const gRes = await sendRawTelegramMessage(
      config.botToken,
      config.staffGroupChatId,
      msgHtml,
      undefined,
      'GROUP_CLOCK_IN'
    );
    staffSent = staffSent || gRes.ok;
  }

  return { adminSent, staffSent };
};

export const notifyServiceOverdueReminder = async (
  payload: WalkInServiceAlertPayload
): Promise<{ adminSent: boolean; staffSent: boolean }> => {
  const config = await getTelegramConfig();
  if (!config.enabled || !config.botToken) {
    return { adminSent: false, staffSent: false };
  }

  const msgHtml = [
    `⚠️⏰ <b>CLOCK-OUT REMINDER (သတ်မှတ်ချိန် ကျော်လွန်နေပါပြီ!)</b>`,
    `━━━━━━━━━━━━━━━━━━━━`,
    `❓ <b>Service သတ်မှတ်ချိန်ထက် ကျော်လွန်နေပြီဖြစ်၍ Clock Out လုပ်ဖို့ မေ့နေသလား?</b>`,
    ``,
    `👨‍💼 <b>Therapist:</b> <b>${escapeHtml(payload.therapistName)}</b>`,
    `🧾 <b>ဘောင်ချာ / ID:</b> <code>${escapeHtml(payload.invoiceNo || payload.bookingId.slice(-6).toUpperCase())}</code>`,
    `💆‍♂️ <b>ဝန်ဆောင်မှု:</b> ${escapeHtml(payload.serviceName)} (${payload.durationMins} Mins)`,
    `🟢 <b>စတင်ခဲ့သည့်အချိန်:</b> ${escapeHtml(payload.startTimeStr || '-')}`,
    `🏁 <b>ပြီးဆုံးရမည့်အချိန်:</b> ${escapeHtml(payload.expectedEndTimeStr || '-')}`,
    `🚨 <b>ကျော်လွန်ချိန် (Overdue):</b> <b>+${payload.overdueMinutes || 10} မိနစ် ကျော်လွန်နေပါသည်</b>`,
    `━━━━━━━━━━━━━━━━━━━━`,
    `🔔 <i>ဝန်ထမ်း App သို့မဟုတ် POS မှ "Clock Out / Complete" ခလုတ်ကို မနှိပ်မချင်း (၁၀) မိနစ်တစ်ခါ အလိုအလျောက် သတိပေးနေပါမည်။</i>`,
  ].join('\n');

  let adminSent = false;
  let staffSent = false;

  if (config.adminGroupChatId) {
    const res = await sendRawTelegramMessage(
      config.botToken,
      config.adminGroupChatId,
      msgHtml,
      undefined,
      'OVERDUE_CLOCKOUT_ALERT'
    );
    adminSent = res.ok;
  }

  const staffTargets = resolveAssignedStaffChatIds(payload.therapistName, config.staffMappings);
  for (const st of staffTargets) {
    const sRes = await sendRawTelegramMessage(
      config.botToken,
      st.chatId,
      msgHtml,
      undefined,
      'STAFF_OVERDUE_ALERT'
    );
    staffSent = staffSent || sRes.ok;
  }

  if (config.staffGroupChatId && config.staffGroupChatId !== config.adminGroupChatId) {
    const gRes = await sendRawTelegramMessage(
      config.botToken,
      config.staffGroupChatId,
      msgHtml,
      undefined,
      'GROUP_OVERDUE_ALERT'
    );
    staffSent = staffSent || gRes.ok;
  }

  return { adminSent, staffSent };
};
