import { doc, getDoc, setDoc, collection, addDoc, serverTimestamp } from 'firebase/firestore';
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

export interface TelegramBotConfig {
  enabled: boolean;
  botToken: string;
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
  staffId?: string; // အကယ်၍ တစ်ဦးချင်းပို့လိုပါက ထည့်ရန်
  staffName: string;
  title: string;
  details: string;
  amount?: number;
  effectiveDate: string;
  issuedBy?: string;
}

// ==========================================
// 2. DEFAULT CONFIGURATION
// ==========================================

export const DEFAULT_TELEGRAM_CONFIG: TelegramBotConfig = {
  enabled: true,
  botToken: import.meta.env.VITE_TELEGRAM_BOT_TOKEN || '',
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
  },
  botFlow: {
    enableInlineButtons: true,
    enableWebAppButton: true,
    welcomeMessage: '🌿 THE SHANGRI-LA MEN\'S RETREAT မှ ကြိုဆိုပါတယ်။ သီးသန့် အဆင့်မြင့် ဝန်ဆောင်မှုများအတွက် အောက်ပါ ခလုတ်မှတစ်ဆင့် ရက်ချိန်းရယူနိုင်ပါသည်။',
    bookingHelpMessage: '📅 ရက်ချိန်းရယူရန် Web App ကိုနှိပ်ပါ သို့မဟုတ် Reception သို့ တိုက်ရိုက်ဆက်သွယ်နိုင်ပါသည်။',
    staffBindInstruction: '👨‍💼 ဝန်ထမ်းများ မိမိ၏ Chat ID ချိတ်ဆက်လိုပါက ဤ Bot သို့ မိမိအမည် သို့မဟုတ် အမှတ်စဉ် (ဥပမာ - No. 1) ပေးပို့ထားပါ။',
    customFooterText: '✨ The Shangri-La Men\'s Retreat • Mandalay',
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

/**
 * Telegram HTML parse_mode တွင် Error မတက်စေရန် အထူးသင်္ကေတများကို သန့်စင်ပေးခြင်း
 */
export const escapeHtml = (unsafe: string | number | undefined | null): string => {
  if (unsafe === undefined || unsafe === null) return '-';
  return String(unsafe)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
};

/**
 * Firestore မှ Telegram Config ကို ဆွဲယူခြင်း (မရှိပါက Default ဖြင့် အလိုအလျောက် တည်ဆောက်ပေးမည်)
 */
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

/**
 * Telegram Config အသစ်ကို Firestore သို့ သိမ်းဆည်းခြင်း
 */
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

/**
 * Notification ပို့သည့် မှတ်တမ်း (Logs) ကို Firestore တွင် သိမ်းဆည်းခြင်း
 */
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

// ==========================================
// 4. CORE TELEGRAM API SENDER
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

// ==========================================
// 5. BOOKING REAL-TIME NOTIFICATIONS
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
 * Booking အသစ် သို့မဟုတ် Status ပြောင်းလဲမှုတိုင်းအတွက် Admin Group + သက်ဆိုင်ရာ ဝန်ထမ်းထံ ပို့ပေးမည့် Function
 */
export const notifyBookingEvent = async (
  eventType: 'NEW_BOOKING' | 'STATUS_UPDATE' | 'STAFF_ASSIGNED',
  booking: BookingNotificationPayload
): Promise<{ adminSent: boolean; staffSent: boolean; errors: string[] }> => {
  const config = await getTelegramConfig();
  const errors: string[] = [];

  if (!config.enabled || !config.botToken) {
    return { adminSent: false, staffSent: false, errors: ['Telegram Bot is disabled or missing token'] };
  }

  // Check if specific trigger is enabled
  const statusLower = booking.status.toLowerCase();
  if (eventType === 'NEW_BOOKING' && !config.triggers.newBooking) {
    return { adminSent: false, staffSent: false, errors: [] };
  }
  if (eventType === 'STATUS_UPDATE') {
    if (statusLower === 'confirmed' && !config.triggers.bookingConfirmed) return { adminSent: false, staffSent: false, errors: [] };
    if ((statusLower === 'in-service' || statusLower === 'in_service') && !config.triggers.bookingInService) return { adminSent: false, staffSent: false, errors: [] };
    if (statusLower === 'completed' && !config.triggers.bookingCompleted) return { adminSent: false, staffSent: false, errors: [] };
    if (statusLower === 'cancelled' && !config.triggers.bookingCancelled) return { adminSent: false, staffSent: false, errors: [] };
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

  // Inline Keyboard တည်ဆောက်ခြင်း
  const inlineKeyboard: any[] = [];
  if (config.botFlow.enableWebAppButton && config.webAppUrl) {
    inlineKeyboard.push([
      {
        text: '🌐 Open Admin Panel',
        url: `${config.webAppUrl}`,
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

    // Find matching individual staff chat ID
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

    // Also notify general Staff Group if configured
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

  return { adminSent, staffSent, errors };
};

// ==========================================
// 6. STAFF OPERATIONS NOTIFICATIONS (ROSTER, PENALTY, PAYROLL)
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

  // Send to specific staff member if mapped
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

  // Send to Staff Group (or Admin Group for record)
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
// 7. BOT DISCOVERY & INTERACTIVE BOT FLOW SYNC
// ==========================================

export interface DiscoveredTelegramChat {
  chatId: string;
  titleOrName: string;
  username?: string;
  type: 'private' | 'group' | 'supergroup' | 'channel';
  lastMessage: string;
  date: string;
}

/**
 * Bot သို့ နောက်ဆုံးပို့ထားသော Message များမှ Chat ID များကို ဆွဲထုတ်ပေးခြင်း (Admin Panel မှ တိုက်ရိုက် ချိတ်ဆက်နိုင်ရန်)
 */
export const fetchRecentBotChats = async (botToken: string): Promise<{
  ok: boolean;
  chats: DiscoveredTelegramChat[];
  error?: string;
}> => {
  if (!botToken) return { ok: false, chats: [], error: 'Bot Token လိုအပ်ပါသည်' };

  try {
    const response = await fetch(`https://api.telegram.org/bot${botToken.trim()}/getUpdates?limit=50`);
    const data = await response.json();

    if (!data.ok) {
      return { ok: false, chats: [], error: data.description || 'Failed to fetch updates' };
    }

    const chatMap = new Map<string, DiscoveredTelegramChat>();

    for (const update of data.result || []) {
      const msg = update.message || update.edited_message || update.my_chat_member;
      if (!msg || !msg.chat) continue;

      const chat = msg.chat;
      const chatIdStr = String(chat.id);
      const titleOrName =
        chat.title || [chat.first_name, chat.last_name].filter(Boolean).join(' ') || 'Unknown User';

      chatMap.set(chatIdStr, {
        chatId: chatIdStr,
        titleOrName,
        username: chat.username,
        type: chat.type,
        lastMessage: msg.text || '[Media / Action]',
        date: msg.date ? new Date(msg.date * 1000).toLocaleString() : '-',
      });
    }

    return { ok: true, chats: Array.from(chatMap.values()).reverse() };
  } catch (err: any) {
    return { ok: false, chats: [], error: err?.message || 'Network error' };
  }
};

/**
 * Telegram Bot ၏ Menu Commands (/start, /book, /staff) နှင့် WebApp Menu Button ကို Admin Panel မှ တိုက်ရိုက် သတ်မှတ်ပေးခြင်း
 */
export const syncBotCommandsAndMenu = async (config: TelegramBotConfig): Promise<{ ok: boolean; message: string }> => {
  if (!config.botToken) return { ok: false, message: 'Bot Token မရှိပါ' };

  try {
    const baseUrl = `https://api.telegram.org/bot${config.botToken.trim()}`;

    // 1. Set Bot Commands
    await fetch(`${baseUrl}/setMyCommands`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        commands: [
          { command: 'start', description: '🌿 Welcome & Main Menu' },
          { command: 'book', description: '📅 ရက်ချိန်းရယူရန် (Book Appointment)' },
          { command: 'vip', description: '👑 VIP Membership အချက်အလက်များ' },
          { command: 'myid', description: '🆔 မိမိ၏ Telegram Chat ID ကြည့်ရန် (Staff Only)' },
        ],
      }),
    });

    // 2. Set Chat Menu Button to Launch Web App
    if (config.botFlow.enableWebAppButton && config.webAppUrl) {
      await fetch(`${baseUrl}/setChatMenuButton`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          menu_button: {
            type: 'web_app',
            text: '🌿 Book Now',
            web_app: { url: config.webAppUrl },
          },
        }),
      });
    }

    return { ok: true, message: 'Telegram Bot Commands နှင့် Web App Menu Button ကို အောင်မြင်စွာ Update လုပ်ပြီးပါပြီ။' };
  } catch (err: any) {
    return { ok: false, message: err?.message || 'Failed to sync bot commands' };
  }
};
