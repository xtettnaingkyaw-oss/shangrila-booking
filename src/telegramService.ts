// Telegram Pro Service Engine for Shangrila Men Retreat
// Bot Token: 9156108930:AAHFdX5tb7YOk5Od4kI5SUgb8-qfteYN6AI

export interface TelegramSettings {
  botToken: string;
  adminGroupId: string;
  channelUsername: string;
  enabled: boolean;
}

export interface TelegramSubscriber {
  chatId: string;
  name: string;
  username?: string;
  phone?: string;
  isVip: boolean;
  joinedAt: string;
}

export interface TelegramNotificationLog {
  timestamp: string;
  type: string;
  chatId: string;
  message: string;
  status: 'success' | 'failed';
}

export interface OutPass {
  id?: string;
  staffName: string;
  reason: string;
  outTime: string;
  expectedReturn: string;
  status: 'pending' | 'approved' | 'returned' | 'overtime';
}

// Default Settings with Provided Bot Token
const DEFAULT_SETTINGS: TelegramSettings = {
  botToken: '9156108930:AAHFdX5tb7YOk5Od4kI5SUgb8-qfteYN6AI',
  adminGroupId: '-1002000000000', // Update with actual group ID if needed
  channelUsername: '@shangrilamenretreat',
  enabled: true,
};

export const getTelegramSettings = (): TelegramSettings => {
  const saved = localStorage.getItem('shangrila_telegram_settings');
  if (saved) {
    try {
      return JSON.parse(saved);
    } catch (e) {
      return DEFAULT_SETTINGS;
    }
  }
  return DEFAULT_SETTINGS;
};

export const saveTelegramSettings = (settings: TelegramSettings): void => {
  localStorage.setItem('shangrila_telegram_settings', JSON.stringify(settings));
};

// Core Telegram API Sender
export const sendTelegramMessage = async (chatId: string, text: string, replyMarkup?: any): Promise<boolean> => {
  const settings = getTelegramSettings();
  if (!settings.enabled || !settings.botToken) return false;

  try {
    const url = `https://api.telegram.org/bot${settings.botToken}/sendMessage`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: text,
        parse_mode: 'Markdown',
        reply_markup: replyMarkup,
      }),
    });

    const data = await response.json();
    logNotification('direct', chatId, text, data.ok ? 'success' : 'failed');
    return data.ok;
  } catch (error) {
    console.error('Telegram send error:', error);
    logNotification('direct', chatId, text, 'failed');
    return false;
  }
};

// Broadcast to Channel (Fixed & Exported)
export const broadcastTelegramMessage = async (text: string, replyMarkup?: any): Promise<boolean> => {
  const settings = getTelegramSettings();
  const target = settings.channelUsername || settings.adminGroupId;
  if (!target) return false;
  return await sendTelegramMessage(target, text, replyMarkup);
};

// Quick Penalty Alert to Staff & Admin Group
export const sendQuickPenaltyAlert = async (staffName: string, amount: number, reason: string): Promise<boolean> => {
  const settings = getTelegramSettings();
  const message = `⚠️ *STAFF PENALTY NOTICE*\n\n👤 ဝန်ထမ်း: *${staffName}*\n💰 ဒဏ်ကြေး: *${amount.toLocaleString()} MMK*\n📋 အကြောင်းအရင်း: ${reason}\n\n_လစာရှင်းတမ်းတွင် အလိုအလျောက် ခုနှိမ်သွားမည်ဖြစ်ပါသည်။_`;
  
  let success = true;
  if (settings.adminGroupId) {
    const res = await sendTelegramMessage(settings.adminGroupId, message);
    if (!res) success = false;
  }
  return success;
};

// Sync Subscribers
export const syncTelegramSubscribers = async (): Promise<TelegramSubscriber[]> => {
  const saved = localStorage.getItem('shangrila_telegram_subscribers');
  if (saved) {
    try {
      return JSON.parse(saved);
    } catch (e) {
      return [];
    }
  }
  return [];
};

// Log helper
const logNotification = (type: string, chatId: string, message: string, status: 'success' | 'failed') => {
  try {
    const logs: TelegramNotificationLog[] = JSON.parse(localStorage.getItem('shangrila_telegram_logs') || '[]');
    logs.unshift({
      timestamp: new Date().toISOString(),
      type,
      chatId,
      message,
      status,
    });
    if (logs.length > 50) logs.pop();
    localStorage.setItem('shangrila_telegram_logs', JSON.stringify(logs));
  } catch (e) {
    console.error('Error logging telegram notification:', e);
  }
};
