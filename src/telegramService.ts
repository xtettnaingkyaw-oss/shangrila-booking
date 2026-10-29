/**
 * THE SHANGRI-LA MEN RETREAT
 * Real-Time Telegram Notification & Pro Channel Broadcast Engine
 * File: src/telegramService.ts
 *
 * Pre-configured with Bot API Token: 9156108930:AAHFdX5tb7YOk5Od4kI5SUgb8-qfteYN6AI
 * Includes:
 * 1. Real-Time Firestore Watcher Engine (`startTelegramRealtimeEngine`) for `bookings`, `penalties`, and `outpasses`
 * 2. Auto-Discovery of Bot Username (`getMe`), Channel IDs, Group IDs, and User `/start` Deep-Links (`getUpdates`)
 * 3. Customer Direct Notifications (Booking Created, Status Changes, VIP Points, Receipts)
 * 4. Staff Direct & Group Notifications (Assigned Bookings, Penalties, OutPass, Duty Roster, Payslips)
 * 5. Public / VIP Telegram Channel Push Broadcasts
 */

import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  addDoc,
  updateDoc,
  query,
  orderBy,
  limit,
  onSnapshot,
} from 'firebase/firestore';
import { db } from './firebase';
import { Booking, OutPass } from './shared';

// ============================================================================
// 1. INTERFACES & TYPES
// ============================================================================

export interface TelegramEventToggles {
  bookingCreatedAdmin: boolean;
  bookingCreatedCustomer: boolean;
  bookingStatusCustomer: boolean;
  bookingAssignedStaff: boolean;
  serviceTimerAlerts: boolean;
  vipPointsReward: boolean;
  staffPenaltyAlert: boolean;
  staffOutPassAlert: boolean;
  dutyRosterBroadcast: boolean;
  staffPayslipDispatch: boolean;
  dailySalesReportAdmin: boolean;
}

export interface TelegramSettings {
  isEnabled: boolean;
  botToken: string;
  botUsername: string;
  publicChannelId: string;
  adminGroupChatId: string;
  staffGroupChatId: string;
  bookingTopicId?: number;
  penaltyTopicId?: number;
  rosterTopicId?: number;
  financeTopicId?: number;
  webAppUrl: string;
  shopMapsUrl: string;
  lastUpdateOffset?: number;
  toggles: TelegramEventToggles;
}

export interface TelegramSubscriber {
  id: string;
  role: 'customer' | 'staff' | 'admin' | 'channel' | 'group';
  identifier: string;
  displayName: string;
  chatId: string;
  username?: string;
  firstName?: string;
  vipTier?: string;
  linkedAt: number;
  isActive: boolean;
}

export interface StaffPenaltyNotificationPayload {
  id?: string;
  therapistId?: string;
  staffName: string;
  category: string;
  reason: string;
  amount: number;
  date: string;
  issuedBy?: string;
  totalMonthlyPenalty?: number;
  autoDeductFromPayroll?: boolean;
}

export interface DutyRosterNotificationPayload {
  date: string;
  title?: string;
  assignments: {
    roleName: string;
    staffNames: string[];
    shiftTime?: string;
    note?: string;
  }[];
}

export interface StaffPayslipNotificationPayload {
  staffName: string;
  staffCode?: string;
  monthYear: string;
  baseSalary: number;
  commissionTotal: number;
  overtimeBonus: number;
  attendanceBonus?: number;
  penaltyDeduction: number;
  advanceDeduction?: number;
  netPayable: number;
  completedSessionsCount?: number;
}

export interface DailySalesNotificationPayload {
  date: string;
  totalRevenue: number;
  cashRevenue: number;
  digitalRevenue: number;
  totalExpenses: number;
  netProfit: number;
  completedBookingsCount: number;
  walkInOrdersCount: number;
  closedBy?: string;
}

export interface ChannelPushBroadcastPayload {
  target: 'public_channel' | 'all_customers' | 'vip_customers' | 'all_staff' | 'staff_group';
  badgeText?: string;
  title: string;
  body: string;
  imageUrl?: string;
  promoCode?: string;
  discountText?: string;
  ctaButtonText?: string;
  ctaButtonUrl?: string;
}

export interface TelegramDeliveryLog {
  id?: string;
  eventType: string;
  recipientLabel: string;
  chatId: string;
  status: 'sent' | 'failed';
  errorMessage?: string;
  messagePreview: string;
  createdAt: number;
}

// ============================================================================
// 2. DEFAULT SETTINGS & FIRESTORE HELPERS
// ============================================================================

const DEFAULT_BOT_TOKEN = '9156108930:AAHFdX5tb7YOk5Od4kI5SUgb8-qfteYN6AI';
const TELEGRAM_SETTINGS_DOC = doc(db, 'settings', 'telegramConfig');
const TELEGRAM_SUBSCRIBERS_COL = collection(db, 'telegramSubscribers');
const TELEGRAM_LOGS_COL = collection(db, 'telegramLogs');
const DEDUP_STORAGE_KEY = 'shangrila_tg_sent_events_v1';

export const DEFAULT_TELEGRAM_SETTINGS: TelegramSettings = {
  isEnabled: true,
  botToken: import.meta.env.VITE_TELEGRAM_BOT_TOKEN || DEFAULT_BOT_TOKEN,
  botUsername: import.meta.env.VITE_TELEGRAM_BOT_USERNAME || '',
  publicChannelId: import.meta.env.VITE_TELEGRAM_CHANNEL_ID || '',
  adminGroupChatId: import.meta.env.VITE_TELEGRAM_ADMIN_CHAT_ID || '',
  staffGroupChatId: import.meta.env.VITE_TELEGRAM_STAFF_CHAT_ID || '',
  webAppUrl:
    typeof window !== 'undefined'
      ? window.location.origin
      : 'https://shangrila-booking-3bqe.vercel.app',
  shopMapsUrl: 'https://maps.google.com/?q=33th(B)+St,+Between+65th+&+65th(A)+Sts,+Mandalay',
  lastUpdateOffset: 0,
  toggles: {
    bookingCreatedAdmin: true,
    bookingCreatedCustomer: true,
    bookingStatusCustomer: true,
    bookingAssignedStaff: true,
    serviceTimerAlerts: true,
    vipPointsReward: true,
    staffPenaltyAlert: true,
    staffOutPassAlert: true,
    dutyRosterBroadcast: true,
    staffPayslipDispatch: true,
    dailySalesReportAdmin: true,
  },
};

let cachedSettings: TelegramSettings | null = null;
let cacheTimestamp = 0;

function hasEventBeenSent(eventKey: string): boolean {
  try {
    const raw = localStorage.getItem(DEDUP_STORAGE_KEY);
    const map: Record<string, number> = raw ? JSON.parse(raw) : {};
    return Boolean(map[eventKey]);
  } catch {
    return false;
  }
}

function markEventAsSent(eventKey: string): void {
  try {
    const raw = localStorage.getItem(DEDUP_STORAGE_KEY);
    const map: Record<string, number> = raw ? JSON.parse(raw) : {};
    map[eventKey] = Date.now();
    // Keep last 400 keys to prevent storage bloat
    const keys = Object.keys(map);
    if (keys.length > 400) {
      keys
        .sort((a, b) => map[a] - map[b])
        .slice(0, keys.length - 400)
        .forEach((k) => delete map[k]);
    }
    localStorage.setItem(DEDUP_STORAGE_KEY, JSON.stringify(map));
  } catch {
    // ignore storage errors
  }
}

export function normalizePhone(phone: string): string {
  if (!phone) return '';
  const digits = phone.replace(/[^0-9]/g, '');
  if (digits.startsWith('959')) {
    return '09' + digits.slice(3);
  }
  if (digits.startsWith('9') && !digits.startsWith('09')) {
    return '0' + digits;
  }
  return digits;
}

export function normalizeStaffKey(nameOrId: string): string {
  return (nameOrId || '').trim().toLowerCase().replace(/\s+/g, '_');
}

export function formatMMK(amount: number | undefined): string {
  return `${Number(amount || 0).toLocaleString('en-US')} MMK`;
}

export function escapeHtml(text: string | number | undefined | null): string {
  if (text === undefined || text === null) return '';
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

export async function getTelegramSettings(forceRefresh = false): Promise<TelegramSettings> {
  const now = Date.now();
  if (!forceRefresh && cachedSettings && now - cacheTimestamp < 25000) {
    return cachedSettings;
  }
  try {
    const snap = await getDoc(TELEGRAM_SETTINGS_DOC);
    if (snap.exists()) {
      const data = snap.data() as Partial<TelegramSettings>;
      cachedSettings = {
        ...DEFAULT_TELEGRAM_SETTINGS,
        ...data,
        botToken: data.botToken || DEFAULT_BOT_TOKEN,
        toggles: {
          ...DEFAULT_TELEGRAM_SETTINGS.toggles,
          ...(data.toggles || {}),
        },
      };
    } else {
      cachedSettings = { ...DEFAULT_TELEGRAM_SETTINGS };
      await setDoc(TELEGRAM_SETTINGS_DOC, cachedSettings, { merge: true }).catch(() => {});
    }
    cacheTimestamp = now;
    return cachedSettings;
  } catch (err) {
    console.warn('[TelegramService] Failed to load settings, using default:', err);
    return DEFAULT_TELEGRAM_SETTINGS;
  }
}

export async function saveTelegramSettings(settings: TelegramSettings): Promise<void> {
  const cleanSettings: TelegramSettings = {
    ...settings,
    botToken: settings.botToken.trim() || DEFAULT_BOT_TOKEN,
  };
  await setDoc(TELEGRAM_SETTINGS_DOC, cleanSettings, { merge: true });
  cachedSettings = cleanSettings;
  cacheTimestamp = Date.now();
}

// ============================================================================
// 3. CORE TELEGRAM BOT HTTP CLIENT
// ============================================================================

interface SendTelegramOptions {
  chatId: string | number;
  text: string;
  photoUrl?: string;
  messageThreadId?: number;
  inlineKeyboard?: { text: string; url?: string; callback_data?: string }[][];
  disableNotification?: boolean;
  eventType?: string;
  recipientLabel?: string;
}

export async function sendTelegramMessage(
  options: SendTelegramOptions
): Promise<{ ok: boolean; error?: string }> {
  const settings = await getTelegramSettings();
  const token = settings.botToken || DEFAULT_BOT_TOKEN;
  if (!settings.isEnabled || !token) {
    return { ok: false, error: 'Telegram Bot is disabled or Bot Token is missing.' };
  }

  const targetChatId = String(options.chatId || '').trim();
  if (!targetChatId) {
    return { ok: false, error: 'Target chatId is empty.' };
  }

  const isPhoto = Boolean(options.photoUrl && options.photoUrl.startsWith('http'));
  const endpoint = isPhoto ? 'sendPhoto' : 'sendMessage';
  const apiUrl = `https://api.telegram.org/bot${token}/${endpoint}`;

  const bodyPayload: Record<string, unknown> = {
    chat_id: targetChatId,
    parse_mode: 'HTML',
    disable_web_page_preview: !isPhoto,
    disable_notification: Boolean(options.disableNotification),
  };

  if (isPhoto) {
    bodyPayload.photo = options.photoUrl;
    bodyPayload.caption = options.text;
  } else {
    bodyPayload.text = options.text;
  }

  if (options.messageThreadId && Number(options.messageThreadId) > 0) {
    bodyPayload.message_thread_id = Number(options.messageThreadId);
  }

  if (options.inlineKeyboard && options.inlineKeyboard.length > 0) {
    bodyPayload.reply_markup = {
      inline_keyboard: options.inlineKeyboard,
    };
  }

  let lastError = '';
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bodyPayload),
      });
      const result = await response.json();

      if (result.ok) {
        await logTelegramDelivery({
          eventType: options.eventType || 'notification',
          recipientLabel: options.recipientLabel || targetChatId,
          chatId: targetChatId,
          status: 'sent',
          messagePreview: options.text.replace(/<[^>]+>/g, '').slice(0, 140),
          createdAt: Date.now(),
        });
        return { ok: true };
      }

      lastError = result.description || `HTTP ${response.status}`;
      if (response.status === 429 && result.parameters?.retry_after) {
        const waitMs = Math.min(Number(result.parameters.retry_after) * 1000, 5000);
        await new Promise((r) => setTimeout(r, waitMs));
        continue;
      }
      break;
    } catch (err: unknown) {
      lastError = err instanceof Error ? err.message : 'Network error';
    }
  }

  await logTelegramDelivery({
    eventType: options.eventType || 'notification',
    recipientLabel: options.recipientLabel || targetChatId,
    chatId: targetChatId,
    status: 'failed',
    errorMessage: lastError,
    messagePreview: options.text.replace(/<[^>]+>/g, '').slice(0, 140),
    createdAt: Date.now(),
  });

  return { ok: false, error: lastError };
}

async function logTelegramDelivery(log: TelegramDeliveryLog): Promise<void> {
  try {
    await addDoc(TELEGRAM_LOGS_COL, log);
  } catch {
    // ignore log write errors
  }
}

// ============================================================================
// 4. BOT AUTO-DISCOVERY (`getMe`) & DEEP-LINK SUBSCRIBER SYNC (`getUpdates`)
// ============================================================================

export function buildTelegramDeepLink(
  botUsername: string,
  role: 'customer' | 'staff',
  identifier: string
): string {
  const cleanBot = (botUsername || 'ShangrilaMenRetreatBot').replace(/^@/, '').trim();
  if (role === 'customer') {
    const cleanPhone = normalizePhone(identifier);
    return `https://t.me/${cleanBot}?start=phone_${encodeURIComponent(cleanPhone)}`;
  }
  const cleanStaff = normalizeStaffKey(identifier);
  return `https://t.me/${cleanBot}?start=staff_${encodeURIComponent(cleanStaff)}`;
}

/**
 * Fetches the official Bot Username from Telegram API `getMe` and saves it to settings
 */
export async function verifyAndSyncBotIdentity(): Promise<{
  ok: boolean;
  botUsername?: string;
  botName?: string;
  error?: string;
}> {
  const settings = await getTelegramSettings();
  const token = settings.botToken || DEFAULT_BOT_TOKEN;
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/getMe`);
    const data = await res.json();
    if (data.ok && data.result?.username) {
      const username = data.result.username;
      const firstName = data.result.first_name || 'Shangri-La Bot';
      if (settings.botUsername !== username) {
        const updated = { ...settings, botUsername: username, botToken: token };
        await saveTelegramSettings(updated);
      }
      return { ok: true, botUsername: username, botName: firstName };
    }
    return { ok: false, error: data.description || 'Invalid Bot Token' };
  } catch (err: unknown) {
    return { ok: false, error: err instanceof Error ? err.message : 'Network error' };
  }
}

/**
 * Polls `getUpdates` to:
 * 1. Auto-link customers (`/start phone_09...`) and staff (`/start staff_...`)
 * 2. Auto-detect Channels (`channel_post` / `my_chat_member`) and Groups where the Bot is added
 */
export async function syncTelegramSubscribers(): Promise<{
  newlyLinked: number;
  subscribers: TelegramSubscriber[];
}> {
  const settings = await getTelegramSettings(true);
  const token = settings.botToken || DEFAULT_BOT_TOKEN;
  if (!token) {
    return { newlyLinked: 0, subscribers: [] };
  }

  let newlyLinked = 0;
  try {
    await verifyAndSyncBotIdentity();
    const offsetParam = settings.lastUpdateOffset
      ? `?offset=${settings.lastUpdateOffset + 1}&limit=100`
      : '?limit=100';
    const response = await fetch(
      `https://api.telegram.org/bot${token}/getUpdates${offsetParam}`
    );
    const data = await response.json();

    if (data.ok && Array.isArray(data.result) && data.result.length > 0) {
      let maxUpdateId = settings.lastUpdateOffset || 0;
      let updatedSettingsFields: Partial<TelegramSettings> = {};

      for (const update of data.result) {
        if (update.update_id > maxUpdateId) {
          maxUpdateId = update.update_id;
        }

        // Auto-detect Channel if Bot receives channel_post or is promoted in a channel
        const channelChat =
          update.channel_post?.chat ||
          (update.my_chat_member?.chat?.type === 'channel' ? update.my_chat_member.chat : null);
        if (channelChat && channelChat.id) {
          const chanId = channelChat.username ? `@${channelChat.username}` : String(channelChat.id);
          if (!settings.publicChannelId) {
            updatedSettingsFields.publicChannelId = chanId;
          }
          const chanSub: TelegramSubscriber = {
            id: `channel_${channelChat.id}`,
            role: 'channel',
            identifier: chanId,
            displayName: channelChat.title || 'Telegram Channel',
            chatId: String(channelChat.id),
            username: channelChat.username || '',
            linkedAt: Date.now(),
            isActive: true,
          };
          await setDoc(doc(TELEGRAM_SUBSCRIBERS_COL, chanSub.id), chanSub, { merge: true });
        }

        // Auto-detect Group / Supergroup if Bot is added to a group
        const groupChat =
          update.message?.chat?.type === 'group' || update.message?.chat?.type === 'supergroup'
            ? update.message.chat
            : update.my_chat_member?.chat?.type === 'group' ||
              update.my_chat_member?.chat?.type === 'supergroup'
            ? update.my_chat_member.chat
            : null;
        if (groupChat && groupChat.id) {
          const grpId = String(groupChat.id);
          if (!settings.adminGroupChatId) {
            updatedSettingsFields.adminGroupChatId = grpId;
          }
          if (!settings.staffGroupChatId) {
            updatedSettingsFields.staffGroupChatId = grpId;
          }
          const grpSub: TelegramSubscriber = {
            id: `group_${groupChat.id}`,
            role: 'group',
            identifier: grpId,
            displayName: groupChat.title || 'Telegram Group',
            chatId: grpId,
            linkedAt: Date.now(),
            isActive: true,
          };
          await setDoc(doc(TELEGRAM_SUBSCRIBERS_COL, grpSub.id), grpSub, { merge: true });
        }

        const msg = update.message;
        if (!msg || !msg.text || !msg.chat) continue;

        const text = String(msg.text).trim();
        const chatId = String(msg.chat.id);
        const firstName = msg.from?.first_name || 'Member';
        const username = msg.from?.username || '';

        if (text.startsWith('/start')) {
          const parts = text.split(' ');
          const payload = parts[1] || '';

          if (payload.startsWith('phone_')) {
            const rawPhone = decodeURIComponent(payload.replace('phone_', ''));
            const phone = normalizePhone(rawPhone);
            if (phone) {
              const subDoc: TelegramSubscriber = {
                id: `cust_${phone}`,
                role: 'customer',
                identifier: phone,
                displayName: firstName,
                chatId,
                username,
                firstName,
                linkedAt: Date.now(),
                isActive: true,
              };
              await setDoc(doc(TELEGRAM_SUBSCRIBERS_COL, subDoc.id), subDoc, { merge: true });
              newlyLinked++;

              await sendTelegramMessage({
                chatId,
                eventType: 'customer_linked',
                recipientLabel: `${firstName} (${phone})`,
                text:
                  `🌿 <b>THE SHANGRI-LA MEN RETREAT</b> 👑\n\n` +
                  `မင်္ဂလာပါ <b>${escapeHtml(firstName)}</b> ခင်ဗျာ။\n` +
                  `လူကြီးမင်း၏ ဖုန်းနံပါတ် (<code>${escapeHtml(phone)}</code>) ကို Telegram Realtime Notification စနစ်နှင့် အောင်မြင်စွာ ချိတ်ဆက်ပြီးပါပြီ။\n\n` +
                  `✅ <b>အလိုအလျောက် လက်ခံရရှိမည့် အသိပေးချက်များ -</b>\n` +
                  `• ဘိုကင် အတည်ပြုချက်နှင့် Status ပြောင်းလဲမှုများ\n` +
                  `• ဝန်ဆောင်မှု စတင်/ပြီးဆုံးချိန်နှင့် Digital Receipt\n` +
                  `• VIP Membership Points နှင့် အထူး Promotion များ`,
                inlineKeyboard: [[{ text: '📅 Open Booking Web App', url: settings.webAppUrl }]],
              });
            }
          } else if (payload.startsWith('staff_')) {
            const staffKey = normalizeStaffKey(decodeURIComponent(payload.replace('staff_', '')));
            if (staffKey) {
              const subDoc: TelegramSubscriber = {
                id: `staff_${staffKey}`,
                role: 'staff',
                identifier: staffKey,
                displayName: firstName,
                chatId,
                username,
                firstName,
                linkedAt: Date.now(),
                isActive: true,
              };
              await setDoc(doc(TELEGRAM_SUBSCRIBERS_COL, subDoc.id), subDoc, { merge: true });
              newlyLinked++;

              await sendTelegramMessage({
                chatId,
                eventType: 'staff_linked',
                recipientLabel: `Staff: ${staffKey}`,
                text:
                  `🌿 <b>THE SHANGRI-LA STAFF PORTAL</b> 🛡️\n\n` +
                  `မင်္ဂလာပါ <b>${escapeHtml(firstName)}</b> (<code>${escapeHtml(
                    staffKey.toUpperCase()
                  )}</code>)!\n` +
                  `သင်၏ Staff Telegram Notification စနစ်ကို အောင်မြင်စွာ ချိတ်ဆက်ပြီးပါပြီ။\n\n` +
                  `📌 <b>သင်လက်ခံရရှိမည့် အသိပေးချက်များ -</b>\n` +
                  `• မိမိတာဝန်ကျသော Booking အသစ်များ\n` +
                  `• Duty Roster တာဝန်ကျဇယားများ\n` +
                  `• OutPass အတည်ပြုချက်နှင့် အချိန်သတိပေးချက်များ\n` +
                  `• စည်းကမ်းထိန်းသိမ်းရေး (Penalty) နှင့် လစာပြေစာ (Payslip) များ`,
                inlineKeyboard: [
                  [{ text: '🛡️ Open Staff App', url: `${settings.webAppUrl}/?mode=staff` }],
                ],
              });
            }
          } else {
            // Generic /start without deep-link payload: register as general subscriber
            const subDoc: TelegramSubscriber = {
              id: `user_${chatId}`,
              role: 'customer',
              identifier: username ? `@${username}` : chatId,
              displayName: firstName,
              chatId,
              username,
              firstName,
              linkedAt: Date.now(),
              isActive: true,
            };
            await setDoc(doc(TELEGRAM_SUBSCRIBERS_COL, subDoc.id), subDoc, { merge: true });
            if (!settings.adminGroupChatId) {
              updatedSettingsFields.adminGroupChatId = chatId;
            }
            newlyLinked++;
          }
        }
      }

      if (maxUpdateId > (settings.lastUpdateOffset || 0) || Object.keys(updatedSettingsFields).length > 0) {
        const merged = {
          ...settings,
          ...updatedSettingsFields,
          lastUpdateOffset: maxUpdateId,
        };
        await saveTelegramSettings(merged).catch(() => {});
      }
    }
  } catch (err) {
    console.warn('[TelegramService] Error syncing subscribers:', err);
  }

  const allSubs = await listTelegramSubscribers();
  return { newlyLinked, subscribers: allSubs };
}

export async function listTelegramSubscribers(): Promise<TelegramSubscriber[]> {
  try {
    const snap = await getDocs(TELEGRAM_SUBSCRIBERS_COL);
    return snap.docs.map((d) => d.data() as TelegramSubscriber);
  } catch {
    return [];
  }
}

export async function findCustomerChatId(phone: string): Promise<string | null> {
  const cleanPhone = normalizePhone(phone);
  if (!cleanPhone) return null;
  try {
    const directRef = doc(TELEGRAM_SUBSCRIBERS_COL, `cust_${cleanPhone}`);
    const directSnap = await getDoc(directRef);
    if (directSnap.exists()) {
      const sub = directSnap.data() as TelegramSubscriber;
      if (sub.isActive && sub.chatId) return sub.chatId;
    }
  } catch {
    // ignore
  }
  return null;
}

export async function findStaffChatId(staffNameOrId: string): Promise<string | null> {
  const key = normalizeStaffKey(staffNameOrId);
  if (!key) return null;
  try {
    const directRef = doc(TELEGRAM_SUBSCRIBERS_COL, `staff_${key}`);
    const directSnap = await getDoc(directRef);
    if (directSnap.exists()) {
      const sub = directSnap.data() as TelegramSubscriber;
      if (sub.isActive && sub.chatId) return sub.chatId;
    }
  } catch {
    // ignore
  }
  return null;
}

export async function getRecentTelegramLogs(maxCount = 30): Promise<TelegramDeliveryLog[]> {
  try {
    const q = query(TELEGRAM_LOGS_COL, orderBy('createdAt', 'desc'), limit(maxCount));
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, ...(d.data() as TelegramDeliveryLog) }));
  } catch {
    return [];
  }
}

// ============================================================================
// 5. EVENT NOTIFICATION HANDLERS (BOOKINGS, PENALTIES, OUTPASS, ROSTER, PAYROLL)
// ============================================================================

const STATUS_BADGES: Record<
  Booking['status'],
  { icon: string; mmLabel: string; enLabel: string }
> = {
  pending: {
    icon: '⏳',
    mmLabel: 'စောင့်ဆိုင်းဆဲ (Pending Review)',
    enLabel: 'Pending Confirmation',
  },
  payment_checking: {
    icon: '🧾',
    mmLabel: 'ငွေလွှဲပြေစာ စစ်ဆေးနေဆဲ (Checking Payment)',
    enLabel: 'Verifying Payment Slip',
  },
  approved: {
    icon: '✅',
    mmLabel: 'ဘိုကင် အတည်ပြုပြီး (Confirmed)',
    enLabel: 'Booking Confirmed',
  },
  in_progress: {
    icon: '💆‍♂️',
    mmLabel: 'ဝန်ဆောင်မှု ပေးနေဆဲ (Session In Progress)',
    enLabel: 'Session In Progress',
  },
  completed: {
    icon: '🌟',
    mmLabel: 'ဝန်ဆောင်မှု ပြီးဆုံးပါပြီ (Completed)',
    enLabel: 'Session Completed',
  },
  cancelled: {
    icon: '❌',
    mmLabel: 'ဘိုကင် ပယ်ဖျက်ထားသည် (Cancelled)',
    enLabel: 'Booking Cancelled',
  },
};

export async function notifyBookingCreated(booking: Booking): Promise<void> {
  const settings = await getTelegramSettings();
  if (!settings.isEnabled) return;

  await syncTelegramSubscribers().catch(() => {});

  const discountLine =
    booking.discountPercent && booking.discountPercent > 0
      ? `\n🏷️ <b>Discount:</b> ${booking.discountPercent}% (${escapeHtml(booking.discountLabel || 'Promo')})`
      : '';

  const vipLine = booking.vipTierName
    ? `\n👑 <b>VIP Tier:</b> ${escapeHtml(booking.vipTierName)}`
    : '';

  const specialLine = booking.specialRequest
    ? `\n📝 <b>အထူးမှာကြားချက်:</b> ${escapeHtml(booking.specialRequest)}`
    : '';

  if (settings.toggles.bookingCreatedAdmin && settings.adminGroupChatId) {
    const adminText =
      `🔔 <b>NEW BOOKING ALERT — THE SHANGRI-LA</b>\n` +
      `━━━━━━━━━━━━━━━━━━━━\n` +
      `👤 <b>Customer:</b> ${escapeHtml(booking.name)}\n` +
      `📞 <b>Phone:</b> <code>${escapeHtml(booking.phone)}</code>\n` +
      `💆‍♂️ <b>Service:</b> ${escapeHtml(booking.service)}\n` +
      `🧑‍⚕️ <b>Therapist:</b> ${escapeHtml(booking.therapist)}\n` +
      `📅 <b>Date & Time:</b> ${escapeHtml(booking.date)} | ⏰ ${escapeHtml(booking.time)}\n` +
      `💳 <b>Payment:</b> ${escapeHtml(booking.paymentMethod)}\n` +
      `💰 <b>Total Price:</b> <b>${formatMMK(booking.totalPrice)}</b>` +
      discountLine +
      vipLine +
      specialLine +
      `\n━━━━━━━━━━━━━━━━━━━━\n` +
      `⚡ <i>Admin Panel တွင် ငွေလွှဲပြေစာ စစ်ဆေးပြီး အတည်ပြုပေးပါ။</i>`;

    await sendTelegramMessage({
      chatId: settings.adminGroupChatId,
      messageThreadId: settings.bookingTopicId,
      text: adminText,
      eventType: 'booking_created_admin',
      recipientLabel: 'Admin Group',
      inlineKeyboard: [
        [{ text: '🛡️ Open Admin Dashboard', url: `${settings.webAppUrl}/?mode=admin` }],
      ],
    });
  }

  if (settings.toggles.bookingCreatedCustomer) {
    const customerChatId = await findCustomerChatId(booking.phone);
    if (customerChatId) {
      const customerText =
        `🌿 <b>THE SHANGRI-LA MEN RETREAT</b> 👑\n` +
        `━━━━━━━━━━━━━━━━━━━━\n` +
        `မင်္ဂလာပါ <b>${escapeHtml(booking.name)}</b> ခင်ဗျာ၊\n` +
        `လူကြီးမင်း၏ ဘိုကင်ကို လက်ခံရရှိပါသည်။ Admin မှ ငွေလွှဲပြေစာ စစ်ဆေးပြီးပါက အတည်ပြုချက် ချက်ချင်းပေးပို့ပါမည်။\n\n` +
        `📋 <b>ဘိုကင် အချက်အလက်များ -</b>\n` +
        `• <b>ဝန်ဆောင်မှု:</b> ${escapeHtml(booking.service)}\n` +
        `• <b>Therapist:</b> ${escapeHtml(booking.therapist)}\n` +
        `• <b>နေ့ရက်/အချိန်:</b> ${escapeHtml(booking.date)} (${escapeHtml(booking.time)})\n` +
        `• <b>ပေးချေမှု:</b> ${escapeHtml(booking.paymentMethod)}\n` +
        `• <b>ကျသင့်ငွေ:</b> <b>${formatMMK(booking.totalPrice)}</b>\n` +
        `• <b>Status:</b> ⏳ ငွေလွှဲပြေစာ စစ်ဆေးနေဆဲ\n` +
        `━━━━━━━━━━━━━━━━━━━━`;

      await sendTelegramMessage({
        chatId: customerChatId,
        text: customerText,
        eventType: 'booking_created_customer',
        recipientLabel: `${booking.name} (${booking.phone})`,
        inlineKeyboard: [[{ text: '📅 View My Booking Status', url: settings.webAppUrl }]],
      });
    }
  }
}

export async function notifyBookingStatusChanged(
  booking: Booking,
  newStatus: Booking['status'],
  extraOptions?: {
    cancelReason?: string;
    pointsEarned?: number;
    updatedTotalPoints?: number;
  }
): Promise<void> {
  const settings = await getTelegramSettings();
  if (!settings.isEnabled) return;

  const badge = STATUS_BADGES[newStatus] || STATUS_BADGES.pending;
  const cancelReason = extraOptions?.cancelReason || booking.cancelReason;

  if (settings.toggles.bookingStatusCustomer) {
    const customerChatId = await findCustomerChatId(booking.phone);
    if (customerChatId) {
      let statusSpecificNote = '';
      if (newStatus === 'approved') {
        statusSpecificNote =
          `\n✨ <b>လူကြီးမင်း၏ ဘိုကင်ကို အတည်ပြုပြီးပါပြီ!</b>\n` +
          `ချိန်းဆိုထားသော အချိန်ထက် (၁၀) မိနစ်ခန့် ကြိုတင်ကြွရောက်ပေးပါရန် လေးစားစွာ မေတ္တာရပ်ခံအပ်ပါသည်။`;
      } else if (newStatus === 'in_progress') {
        statusSpecificNote =
          `\n💆‍♂️ <b>လူကြီးမင်း၏ အပန်းဖြေ ဝန်ဆောင်မှု စတင်နေပါပြီ။</b>\n` +
          `စိတ်အေးချမ်းသာယာသော အချိန်လေး ဖြစ်ပါစေကြောင်း ဆုမွန်ကောင်းတောင်းအပ်ပါသည်။`;
      } else if (newStatus === 'completed') {
        const ptsText = extraOptions?.pointsEarned
          ? `\n🎁 <b>ရရှိသော VIP Points:</b> +${extraOptions.pointsEarned} Pts (စုစုပေါင်း: ${
              extraOptions.updatedTotalPoints || extraOptions.pointsEarned
            } Pts)`
          : '';
        statusSpecificNote =
          `\n🌟 <b>ဝန်ဆောင်မှု ပြီးဆုံးပါပြီ။</b>\n` +
          `The Shangri-La Men Retreat ကို ရွေးချယ်အားပေးမှုအတွက် အထူးကျေးဇူးတင်ရှိပါသည်။` +
          ptsText;
      } else if (newStatus === 'cancelled') {
        statusSpecificNote =
          `\n⚠️ <b>ပယ်ဖျက်ရသည့် အကြောင်းအရင်း:</b> ${escapeHtml(
            cancelReason || 'အချိန်ညှိနှိုင်းရန် လိုအပ်ပါသည်'
          )}\n` +
          `အသေးစိတ် သိရှိလိုပါက ဆိုင်သို့ တိုက်ရိုက်ဆက်သွယ်မေးမြန်းနိုင်ပါသည်။`;
      }

      const customerMsg =
        `🌿 <b>THE SHANGRI-LA BOOKING UPDATE</b>\n` +
        `━━━━━━━━━━━━━━━━━━━━\n` +
        `${badge.icon} <b>Status:</b> <b>${escapeHtml(badge.mmLabel)}</b>\n\n` +
        `👤 <b>အမည်:</b> ${escapeHtml(booking.name)}\n` +
        `💆‍♂️ <b>ဝန်ဆောင်မှု:</b> ${escapeHtml(booking.service)}\n` +
        `🧑‍⚕️ <b>Therapist:</b> ${escapeHtml(booking.therapist)}\n` +
        `📅 <b>နေ့ရက်/အချိန်:</b> ${escapeHtml(booking.date)} | ⏰ ${escapeHtml(booking.time)}\n` +
        `💰 <b>ပမာဏ:</b> ${formatMMK(booking.totalPrice)}` +
        statusSpecificNote +
        `\n━━━━━━━━━━━━━━━━━━━━`;

      const buttons: { text: string; url: string }[][] = [
        [{ text: '📅 Open Shangri-La App', url: settings.webAppUrl }],
      ];
      if (newStatus === 'approved' && settings.shopMapsUrl) {
        buttons.push([{ text: '📍 လမ်းညွှန်မြေပုံ (Google Maps)', url: settings.shopMapsUrl }]);
      }

      await sendTelegramMessage({
        chatId: customerChatId,
        text: customerMsg,
        eventType: `booking_status_${newStatus}`,
        recipientLabel: `${booking.name} (${booking.phone})`,
        inlineKeyboard: buttons,
      });
    }
  }

  if (
    settings.toggles.bookingAssignedStaff &&
    (newStatus === 'approved' || newStatus === 'cancelled')
  ) {
    const staffChatId = await findStaffChatId(booking.therapist);
    const staffAssignmentMsg =
      newStatus === 'approved'
        ? `📌 <b>တာဝန်ကျ ဘိုကင်အသစ် အတည်ပြုချက်</b>\n` +
          `━━━━━━━━━━━━━━━━━━━━\n` +
          `🧑‍⚕️ <b>Therapist:</b> <b>${escapeHtml(booking.therapist)}</b>\n` +
          `💆‍♂️ <b>Service:</b> ${escapeHtml(booking.service)}\n` +
          `📅 <b>Date:</b> ${escapeHtml(booking.date)}\n` +
          `⏰ <b>Time:</b> <b>${escapeHtml(booking.time)}</b>\n` +
          `👤 <b>Customer:</b> ${escapeHtml(booking.name)}\n` +
          (booking.specialRequest
            ? `📝 <b>မှတ်ချက်:</b> ${escapeHtml(booking.specialRequest)}\n`
            : '') +
          `━━━━━━━━━━━━━━━━━━━━\n` +
          `<i>ကျေးဇူးပြု၍ သတ်မှတ်ချိန်မတိုင်မီ ကြိုတင်ပြင်ဆင်ထားပေးပါရန်။</i>`
        : `❌ <b>ဘိုကင် ပယ်ဖျက်ခြင်း အသိပေးချက်</b>\n` +
          `🧑‍⚕️ <b>Therapist:</b> ${escapeHtml(booking.therapist)}\n` +
          `📅 <b>Date/Time:</b> ${escapeHtml(booking.date)} (${escapeHtml(booking.time)})\n` +
          `💆‍♂️ <b>Service:</b> ${escapeHtml(booking.service)}`;

    if (staffChatId) {
      await sendTelegramMessage({
        chatId: staffChatId,
        text: staffAssignmentMsg,
        eventType: `staff_booking_${newStatus}`,
        recipientLabel: `Staff: ${booking.therapist}`,
        inlineKeyboard: [
          [{ text: '🛡️ Open Staff App', url: `${settings.webAppUrl}/?mode=staff` }],
        ],
      });
    }

    if (settings.staffGroupChatId) {
      await sendTelegramMessage({
        chatId: settings.staffGroupChatId,
        messageThreadId: settings.bookingTopicId,
        text: staffAssignmentMsg,
        eventType: `staff_group_booking_${newStatus}`,
        recipientLabel: 'Staff Group (Bookings)',
      });
    }
  }
}

export async function notifyStaffPenalty(
  penalty: StaffPenaltyNotificationPayload
): Promise<{ sentToStaff: boolean; sentToGroup: boolean }> {
  const settings = await getTelegramSettings();
  if (!settings.isEnabled || !settings.toggles.staffPenaltyAlert) {
    return { sentToStaff: false, sentToGroup: false };
  }

  await syncTelegramSubscribers().catch(() => {});

  const monthlyLine =
    penalty.totalMonthlyPenalty !== undefined
      ? `\n📊 <b>ယခုလ စုစုပေါင်း ဒဏ်ကြေး:</b> ${formatMMK(penalty.totalMonthlyPenalty)}`
      : '';

  const payrollNote =
    penalty.autoDeductFromPayroll !== false
      ? `\n💳 <i>မှတ်ချက် - အဆိုပါ ဒဏ်ကြေးပမာဏကို လချုပ်လစာ (Payroll) တွင် အလိုအလျောက် ခုနှိမ်သွားမည်ဖြစ်ပါသည်။</i>`
      : '';

  const penaltyMessage =
    `⚠️ <b>စည်းကမ်းထိန်းသိမ်းရေးနှင့် ဒဏ်ကြေး အသိပေးချက်</b>\n` +
    `<b>(STAFF PENALTY NOTIFICATION)</b>\n` +
    `━━━━━━━━━━━━━━━━━━━━\n` +
    `👤 <b>ဝန်ထမ်းအမည်:</b> <b>${escapeHtml(penalty.staffName)}</b>\n` +
    `📌 <b>အမျိုးအစား:</b> ${escapeHtml(penalty.category)}\n` +
    `📝 <b>အကြောင်းအရင်း:</b> ${escapeHtml(penalty.reason)}\n` +
    `📅 <b>နေ့ရက်:</b> ${escapeHtml(penalty.date)}\n` +
    `💸 <b>ဒဏ်ကြေးပမာဏ:</b> <b>${formatMMK(penalty.amount)}</b>` +
    monthlyLine +
    (penalty.issuedBy ? `\n🛡️ <b>စစ်ဆေးသူ:</b> ${escapeHtml(penalty.issuedBy)}` : '') +
    payrollNote +
    `\n━━━━━━━━━━━━━━━━━━━━\n` +
    `<i>ဆိုင်၏ စည်းမျဉ်းစည်းကမ်းများကို လေးစားလိုက်နာပေးပါရန် အသိပေးအပ်ပါသည်။</i>`;

  let sentToStaff = false;
  let sentToGroup = false;

  const staffChatId =
    (await findStaffChatId(penalty.staffName)) ||
    (penalty.therapistId ? await findStaffChatId(penalty.therapistId) : null);
  if (staffChatId) {
    const res = await sendTelegramMessage({
      chatId: staffChatId,
      text: penaltyMessage,
      eventType: 'staff_penalty_dm',
      recipientLabel: `Staff: ${penalty.staffName}`,
      inlineKeyboard: [
        [{ text: '📋 View Penalty Record in Staff App', url: `${settings.webAppUrl}/?mode=staff` }],
      ],
    });
    sentToStaff = res.ok;
  }

  const groupTarget = settings.staffGroupChatId || settings.adminGroupChatId;
  if (groupTarget) {
    const res = await sendTelegramMessage({
      chatId: groupTarget,
      messageThreadId: settings.penaltyTopicId,
      text: penaltyMessage,
      eventType: 'staff_penalty_group',
      recipientLabel: `Group Penalty Alert (${penalty.staffName})`,
    });
    sentToGroup = res.ok;
  }

  return { sentToStaff, sentToGroup };
}

export async function notifyOutPassEvent(
  outPass: OutPass,
  event: 'requested' | 'approved' | 'returned' | 'overtime'
): Promise<void> {
  const settings = await getTelegramSettings();
  if (!settings.isEnabled || !settings.toggles.staffOutPassAlert) return;

  const outTimeStr = new Date(outPass.outTimeMillis).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });
  const expectedInStr = new Date(outPass.expectedInTimeMillis).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });

  if (event === 'requested' && settings.adminGroupChatId) {
    await sendTelegramMessage({
      chatId: settings.adminGroupChatId,
      text:
        `🚶‍♂️ <b>STAFF OUTPASS REQUEST</b>\n` +
        `━━━━━━━━━━━━━━━━━━━━\n` +
        `👤 <b>Staff:</b> <b>${escapeHtml(outPass.therapist)}</b>\n` +
        `📝 <b>အကြောင်းအရင်း:</b> ${escapeHtml(outPass.reason)}\n` +
        `⏰ <b>ထွက်ခွာချိန်:</b> ${escapeHtml(outTimeStr)} → ပြန်ဝင်ရမည့်ချိန်: ${escapeHtml(
          expectedInStr
        )}`,
      eventType: 'outpass_requested',
      recipientLabel: 'Admin Group',
      inlineKeyboard: [
        [{ text: '🛡️ Review in Admin Panel', url: `${settings.webAppUrl}/?mode=admin` }],
      ],
    });
  } else if (event === 'overtime') {
    const overtimeMins = Math.ceil((outPass.overtimeSeconds || 0) / 60);
    const alertMsg =
      `🚨 <b>OUTPASS OVERTIME ALERT</b>\n` +
      `━━━━━━━━━━━━━━━━━━━━\n` +
      `👤 <b>ဝန်ထမ်း:</b> <b>${escapeHtml(outPass.therapist)}</b>\n` +
      `⏱️ <b>သတ်မှတ်ချိန်ထက် ကျော်လွန်ချိန်:</b> <b>${overtimeMins} မိနစ်</b>\n` +
      `📝 <b>အကြောင်းအရင်း:</b> ${escapeHtml(outPass.reason)}`;

    const staffChatId = await findStaffChatId(outPass.therapist);
    if (staffChatId) {
      await sendTelegramMessage({
        chatId: staffChatId,
        text: alertMsg,
        eventType: 'outpass_overtime_staff',
        recipientLabel: `Staff: ${outPass.therapist}`,
      });
    }
    if (settings.adminGroupChatId) {
      await sendTelegramMessage({
        chatId: settings.adminGroupChatId,
        text: alertMsg,
        eventType: 'outpass_overtime_admin',
        recipientLabel: 'Admin Group',
      });
    }
  }
}

export async function notifyDutyRosterPublished(
  roster: DutyRosterNotificationPayload
): Promise<{ ok: boolean; error?: string }> {
  const settings = await getTelegramSettings();
  if (!settings.isEnabled || !settings.toggles.dutyRosterBroadcast) {
    return { ok: false, error: 'Duty Roster notification is disabled.' };
  }

  const lines = roster.assignments.map(
    (a) =>
      `🔹 <b>${escapeHtml(a.roleName)}</b>${a.shiftTime ? ` (${escapeHtml(a.shiftTime)})` : ''}:\n` +
      `   └ 👥 ${escapeHtml(a.staffNames.join(', ') || 'None')}` +
      (a.note ? `\n   └ 📝 <i>${escapeHtml(a.note)}</i>` : '')
  );

  const text =
    `📅 <b>THE SHANGRI-LA DAILY DUTY ROSTER</b>\n` +
    `<b>${escapeHtml(roster.title || 'နေ့စဉ် တာဝန်ကျဇယား')} — ${escapeHtml(roster.date)}</b>\n` +
    `━━━━━━━━━━━━━━━━━━━━\n` +
    lines.join('\n\n') +
    `\n━━━━━━━━━━━━━━━━━━━━\n` +
    `✅ <i>မိမိတာဝန်ကျရာ ကဏ္ဍအလိုက် အချိန်မှန် စနစ်တကျ ဆောင်ရွက်ပေးကြပါရန်။</i>`;

  const targetChat = settings.staffGroupChatId || settings.adminGroupChatId;
  if (!targetChat) {
    return { ok: false, error: 'Staff Group or Admin Group Chat ID is not configured.' };
  }

  return sendTelegramMessage({
    chatId: targetChat,
    messageThreadId: settings.rosterTopicId,
    text,
    eventType: 'duty_roster_broadcast',
    recipientLabel: 'Staff Group (Duty Roster)',
    inlineKeyboard: [
      [{ text: '📋 View Full Roster in Staff App', url: `${settings.webAppUrl}/?mode=staff` }],
    ],
  });
}

export async function notifyStaffPayslip(
  payslip: StaffPayslipNotificationPayload
): Promise<{ ok: boolean; error?: string }> {
  const settings = await getTelegramSettings();
  if (!settings.isEnabled || !settings.toggles.staffPayslipDispatch) {
    return { ok: false, error: 'Payslip notification is disabled.' };
  }

  const staffChatId = await findStaffChatId(payslip.staffName);
  if (!staffChatId) {
    return {
      ok: false,
      error: `Staff member "${payslip.staffName}" has not linked their Telegram account yet.`,
    };
  }

  const text =
    `💵 <b>THE SHANGRI-LA OFFICIAL PAYSLIP</b>\n` +
    `<b>လစာရှင်းတမ်း — ${escapeHtml(payslip.monthYear)}</b>\n` +
    `━━━━━━━━━━━━━━━━━━━━\n` +
    `👤 <b>ဝန်ထမ်းအမည်:</b> <b>${escapeHtml(payslip.staffName)}</b> ${
      payslip.staffCode ? `(<code>${escapeHtml(payslip.staffCode)}</code>)` : ''
    }\n` +
    (payslip.completedSessionsCount !== undefined
      ? `💆‍♂️ <b>ဝန်ဆောင်မှု အကြိမ်ရေ:</b> ${payslip.completedSessionsCount} ပွဲ\n`
      : '') +
    `\n<b>➕ ရရှိငွေများ (Earnings):</b>\n` +
    `• အခြေခံလစာ (Base Salary): ${formatMMK(payslip.baseSalary)}\n` +
    `• ကော်မရှင် (Commission): ${formatMMK(payslip.commissionTotal)}\n` +
    `• အချိန်ပိုဆုကြေး (Overtime): ${formatMMK(payslip.overtimeBonus)}\n` +
    (payslip.attendanceBonus
      ? `• ရက်မှန်ကြေး (Attendance): ${formatMMK(payslip.attendanceBonus)}\n`
      : '') +
    `\n<b>➖ ခုနှိမ်ငွေများ (Deductions):</b>\n` +
    `• စည်းကမ်းဒဏ်ကြေး (Penalties): -${formatMMK(payslip.penaltyDeduction)}\n` +
    (payslip.advanceDeduction
      ? `• ကြိုထုတ်ငွေ (Advance): -${formatMMK(payslip.advanceDeduction)}\n`
      : '') +
    `━━━━━━━━━━━━━━━━━━━━\n` +
    `💰 <b>အသားတင် ထုတ်ယူရရှိငွေ (Net Pay):</b>\n` +
    `👉 <b>${formatMMK(payslip.netPayable)}</b>\n` +
    `━━━━━━━━━━━━━━━━━━━━`;

  return sendTelegramMessage({
    chatId: staffChatId,
    text,
    eventType: 'staff_payslip_dm',
    recipientLabel: `Staff: ${payslip.staffName}`,
    inlineKeyboard: [
      [{ text: '🧾 View Detailed Payslip in Staff App', url: `${settings.webAppUrl}/?mode=staff` }],
    ],
  });
}

export async function notifyDailySalesSummary(
  summary: DailySalesNotificationPayload
): Promise<{ ok: boolean; error?: string }> {
  const settings = await getTelegramSettings();
  if (!settings.isEnabled || !settings.toggles.dailySalesReportAdmin || !settings.adminGroupChatId) {
    return { ok: false, error: 'Daily sales Telegram report is disabled or Admin Chat ID missing.' };
  }

  const text =
    `📊 <b>THE SHANGRI-LA DAILY FINANCIAL SUMMARY</b>\n` +
    `📅 <b>နေ့ရက်:</b> <b>${escapeHtml(summary.date)}</b>\n` +
    `━━━━━━━━━━━━━━━━━━━━\n` +
    `💵 <b>စုစုပေါင်း ဝင်ငွေ (Total Revenue):</b> <b>${formatMMK(summary.totalRevenue)}</b>\n` +
    `   ├ Cash ပေးချေမှု: ${formatMMK(summary.cashRevenue)}\n` +
    `   └ Mobile Banking: ${formatMMK(summary.digitalRevenue)}\n\n` +
    `📉 <b>စုစုပေါင်း အသုံးစရိတ် (Expenses):</b> ${formatMMK(summary.totalExpenses)}\n` +
    `💎 <b>အသားတင် အမြတ်ငွေ (Net Profit):</b> <b>${formatMMK(summary.netProfit)}</b>\n\n` +
    `📈 <b>ဝန်ဆောင်မှု မှတ်တမ်း:</b>\n` +
    `   ├ Online Bookings: ${summary.completedBookingsCount} ခု\n` +
    `   └ POS Walk-ins: ${summary.walkInOrdersCount} ခု\n` +
    (summary.closedBy ? `👤 <b>စာရင်းပိတ်သူ:</b> ${escapeHtml(summary.closedBy)}\n` : '') +
    `━━━━━━━━━━━━━━━━━━━━`;

  return sendTelegramMessage({
    chatId: settings.adminGroupChatId,
    messageThreadId: settings.financeTopicId,
    text,
    eventType: 'daily_sales_summary',
    recipientLabel: 'Admin Group (Finance)',
    inlineKeyboard: [
      [{ text: '📊 Open Admin Finance View', url: `${settings.webAppUrl}/?mode=admin` }],
    ],
  });
}

// ============================================================================
// 6. PRO CHANNEL & TARGETED PUSH BROADCAST ENGINE
// ============================================================================

export async function sendChannelPushBroadcast(
  payload: ChannelPushBroadcastPayload
): Promise<{ sentCount: number; failedCount: number; errors: string[] }> {
  const settings = await getTelegramSettings();
  const token = settings.botToken || DEFAULT_BOT_TOKEN;
  if (!settings.isEnabled || !token) {
    return { sentCount: 0, failedCount: 1, errors: ['Telegram Bot is disabled or unconfigured.'] };
  }

  const badgeHeader = payload.badgeText
    ? `✨ <b>${escapeHtml(payload.badgeText)}</b> ✨\n`
    : `🌿 <b>THE SHANGRI-LA MEN RETREAT</b> 👑\n`;

  const promoBlock =
    payload.promoCode || payload.discountText
      ? `\n🎁 <b>Special Offer:</b> ${escapeHtml(payload.discountText || '')}` +
        (payload.promoCode
          ? `\n🎟️ <b>Promo Code:</b> <code>${escapeHtml(payload.promoCode)}</code>`
          : '') +
        '\n'
      : '';

  const formattedMessage =
    badgeHeader +
    `━━━━━━━━━━━━━━━━━━━━\n` +
    `<b>${escapeHtml(payload.title)}</b>\n\n` +
    `${escapeHtml(payload.body)}` +
    promoBlock +
    `\n━━━━━━━━━━━━━━━━━━━━\n` +
    `📍 <i>The Shangri-La Men Retreat — Luxury Wellness & Grooming</i>`;

  const ctaUrl = payload.ctaButtonUrl || settings.webAppUrl;
  const ctaText = payload.ctaButtonText || '📅 ဘိုကင်ရယူရန် (Book Now)';
  const keyboard = [[{ text: ctaText, url: ctaUrl }]];

  let targetChats: { chatId: string; label: string }[] = [];

  if (payload.target === 'public_channel') {
    if (!settings.publicChannelId) {
      return {
        sentCount: 0,
        failedCount: 1,
        errors: ['Public Telegram Channel ID (@ChannelName or -100...) is not configured.'],
      };
    }
    targetChats = [
      { chatId: settings.publicChannelId, label: `Channel (${settings.publicChannelId})` },
    ];
  } else if (payload.target === 'staff_group') {
    const groupChat = settings.staffGroupChatId || settings.adminGroupChatId;
    if (!groupChat) {
      return { sentCount: 0, failedCount: 1, errors: ['Staff Group Chat ID is not configured.'] };
    }
    targetChats = [{ chatId: groupChat, label: 'Staff Group' }];
  } else {
    const allSubs = await listTelegramSubscribers();
    const activeSubs = allSubs.filter((s) => s.isActive && s.chatId);

    if (payload.target === 'all_customers') {
      targetChats = activeSubs
        .filter((s) => s.role === 'customer')
        .map((s) => ({ chatId: s.chatId, label: `${s.displayName} (${s.identifier})` }));
    } else if (payload.target === 'vip_customers') {
      targetChats = activeSubs
        .filter((s) => s.role === 'customer')
        .map((s) => ({ chatId: s.chatId, label: `VIP: ${s.displayName}` }));
    } else if (payload.target === 'all_staff') {
      targetChats = activeSubs
        .filter((s) => s.role === 'staff')
        .map((s) => ({ chatId: s.chatId, label: `Staff: ${s.displayName}` }));
    }
  }

  let sentCount = 0;
  let failedCount = 0;
  const errors: string[] = [];

  for (const target of targetChats) {
    const res = await sendTelegramMessage({
      chatId: target.chatId,
      text: formattedMessage,
      photoUrl: payload.imageUrl,
      inlineKeyboard: keyboard,
      eventType: `push_broadcast_${payload.target}`,
      recipientLabel: target.label,
    });
    if (res.ok) {
      sentCount++;
    } else {
      failedCount++;
      if (res.error) errors.push(`${target.label}: ${res.error}`);
    }
    if (targetChats.length > 1) {
      await new Promise((r) => setTimeout(r, 65));
    }
  }

  return { sentCount, failedCount, errors };
}

// ============================================================================
// 7. ZERO-TOUCH REALTIME FIRESTORE WATCHER ENGINE (`bookings`, `penalties`, `outpasses`)
// ============================================================================

let realtimeEngineStarted = false;

/**
 * Automatically observes Firestore collections (`bookings`, `penalties`, `outpasses`)
 * and dispatches Telegram notifications in real time without modifying existing page logic.
 */
export function startTelegramRealtimeEngine(): () => void {
  if (realtimeEngineStarted) {
    return () => {};
  }
  realtimeEngineStarted = true;

  const engineStartTimestamp = Date.now();
  const bookingStatusMap = new Map<string, Booking['status']>();
  let bookingsInitialLoaded = false;
  let penaltiesInitialLoaded = false;
  let outpassesInitialLoaded = false;

  // Periodic subscriber sync (every 45 seconds) so `/start` deep links are always bound automatically
  verifyAndSyncBotIdentity().catch(() => {});
  syncTelegramSubscribers().catch(() => {});
  const syncInterval = setInterval(() => {
    syncTelegramSubscribers().catch(() => {});
  }, 45000);

  // 1) Watch `bookings` collection for new bookings and status transitions
  const unsubBookings = onSnapshot(
    collection(db, 'bookings'),
    (snapshot) => {
      if (!bookingsInitialLoaded) {
        snapshot.docs.forEach((d) => {
          const data = d.data() as Booking;
          bookingStatusMap.set(d.id, data.status);
        });
        bookingsInitialLoaded = true;
        return;
      }

      snapshot.docChanges().forEach((change) => {
        const docId = change.doc.id;
        const booking = { id: docId, ...(change.doc.data() as Booking) };

        if (change.type === 'added') {
          bookingStatusMap.set(docId, booking.status);
          const createdKey = `booking_created_${docId}`;
          if (
            (booking.createdAt || 0) >= engineStartTimestamp - 30000 &&
            !hasEventBeenSent(createdKey)
          ) {
            markEventAsSent(createdKey);
            notifyBookingCreated(booking).catch((e) =>
              console.warn('[TelegramEngine] notifyBookingCreated error:', e)
            );
          }
        } else if (change.type === 'modified') {
          const prevStatus = bookingStatusMap.get(docId);
          if (prevStatus && prevStatus !== booking.status) {
            bookingStatusMap.set(docId, booking.status);
            const statusKey = `booking_status_${docId}_${booking.status}`;
            if (!hasEventBeenSent(statusKey)) {
              markEventAsSent(statusKey);
              notifyBookingStatusChanged(booking, booking.status).catch((e) =>
                console.warn('[TelegramEngine] notifyBookingStatusChanged error:', e)
              );
            }
          }
        }
      });
    },
    (err) => console.warn('[TelegramEngine] bookings listener error:', err)
  );

  // 2) Watch `penalties` collection for new Staff Penalty records
  const unsubPenalties = onSnapshot(
    collection(db, 'penalties'),
    (snapshot) => {
      if (!penaltiesInitialLoaded) {
        penaltiesInitialLoaded = true;
        return;
      }

      snapshot.docChanges().forEach((change) => {
        if (change.type === 'added') {
          const docId = change.doc.id;
          const data = change.doc.data() as {
            therapistId?: string;
            therapistName?: string;
            staffName?: string;
            category?: string;
            amount?: number;
            reason?: string;
            date?: string;
            createdAt?: number;
          };
          const penaltyKey = `penalty_added_${docId}`;
          if (
            (data.createdAt || Date.now()) >= engineStartTimestamp - 30000 &&
            !hasEventBeenSent(penaltyKey)
          ) {
            markEventAsSent(penaltyKey);
            notifyStaffPenalty({
              id: docId,
              therapistId: data.therapistId,
              staffName: data.therapistName || data.staffName || 'Staff Member',
              category: data.category || 'စည်းကမ်းပျက်ကွက်မှု (Policy Breach)',
              amount: Number(data.amount || 0),
              reason: data.reason || '-',
              date: data.date || new Date().toISOString().slice(0, 10),
              issuedBy: 'Admin',
              autoDeductFromPayroll: true,
            }).catch((e) => console.warn('[TelegramEngine] notifyStaffPenalty error:', e));
          }
        }
      });
    },
    (err) => console.warn('[TelegramEngine] penalties listener error:', err)
  );

  // 3) Watch `outpasses` collection for Staff OutPass requests & overtime alerts
  const unsubOutpasses = onSnapshot(
    collection(db, 'outpasses'),
    (snapshot) => {
      if (!outpassesInitialLoaded) {
        outpassesInitialLoaded = true;
        return;
      }

      snapshot.docChanges().forEach((change) => {
        const docId = change.doc.id;
        const outPass = { id: docId, ...(change.doc.data() as OutPass) };

        if (change.type === 'added') {
          const outKey = `outpass_req_${docId}`;
          if (!hasEventBeenSent(outKey)) {
            markEventAsSent(outKey);
            notifyOutPassEvent(outPass, 'requested').catch(() => {});
          }
        } else if (change.type === 'modified' && (outPass.overtimeSeconds || 0) > 0) {
          const otKey = `outpass_ot_${docId}`;
          if (!hasEventBeenSent(otKey)) {
            markEventAsSent(otKey);
            notifyOutPassEvent(outPass, 'overtime').catch(() => {});
          }
        }
      });
    },
    (err) => console.warn('[TelegramEngine] outpasses listener error:', err)
  );

  return () => {
    clearInterval(syncInterval);
    unsubBookings();
    unsubPenalties();
    unsubOutpasses();
    realtimeEngineStarted = false;
  };
}
