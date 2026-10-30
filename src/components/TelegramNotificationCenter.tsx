import React, { useState, useEffect } from 'react';
import {
  Send,
  Bell,
  Settings,
  Users,
  CheckCircle2,
  XCircle,
  RefreshCw,
  ShieldAlert,
  MessageSquare,
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
} from 'lucide-react';
import { collection, query, orderBy, limit, onSnapshot, getDocs } from 'firebase/firestore';
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
  notifyStaffUpdate,
  fetchRecentBotChats,
  syncBotCommandsAndMenu,
  DiscoveredTelegramChat,
  getCustomerTelegramSubscribers,
  saveCustomerTelegramSubscription,
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
  return decryptText(val) || val;
};

export const TelegramNotificationCenter: React.FC = () => {
  const [config, setConfig] = useState<TelegramBotConfig>(DEFAULT_TELEGRAM_CONFIG);
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<
    'setup' | 'triggers' | 'staff' | 'customers' | 'botflow' | 'logs'
  >('setup');
  const [showToken, setShowToken] = useState<boolean>(false);
  const [statusBanner, setStatusBanner] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const [staffHrMeta, setStaffHrMeta] = useState<Record<string, { actualName?: string; position?: string }>>({});

  // Chat Discovery State
  const [scanningChats, setScanningChats] = useState<boolean>(false);
  const [discoveredChats, setDiscoveredChats] = useState<DiscoveredTelegramChat[]>([]);

  // Customer Subscribers State
  const [subscribers, setSubscribers] = useState<CustomerTelegramSubscriber[]>([]);
  const [selectedSubIds, setSelectedSubIds] = useState<string[]>([]);
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

  // Logs State
  const [logs, setLogs] = useState<any[]>([]);

  const loadSubscribers = async () => {
    const list = await getCustomerTelegramSubscribers();
    setSubscribers(list);
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

      onboardingSnap.forEach((d) => {
        const raw = d.data();
        const status = String(raw.status || '').toLowerCase();
        const tName = safeDecrypt(raw.therapistName || raw.assignedName || raw.name || '');
        const fullName = safeDecrypt(raw.fullName || raw.actualName || raw.name || '');
        const position = safeDecrypt(raw.position || raw.jobPosition || '');
        const num = extractStaffNumber(tName) ?? extractStaffNumber(raw.staffId || '');

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

        if (num === null || num > 50 || hrResignedNums.has(num)) {
          return;
        }
        if (seenNums.has(num)) {
          return;
        }
        seenNums.add(num);

        const hrInfo = hrByNum.get(num);
        const actualName = safeDecrypt(raw.actualName || raw.fullName || '') || hrInfo?.actualName || '';
        const position = safeDecrypt(raw.position || '') || hrInfo?.position || '';

        activeStaffItems.push({
          num,
          staffId: `No. ${num}`,
          staffName: rawName,
          actualName,
          position,
          order: num,
        });
      });

      hrByNum.forEach((hrVal, num) => {
        if (num <= 50 && !seenNums.has(num) && !hrResignedNums.has(num)) {
          seenNums.add(num);
          activeStaffItems.push({
            num,
            staffId: `No. ${num}`,
            staffName: hrVal.therapistName || `Therapist No-${num}`,
            actualName: hrVal.actualName,
            position: hrVal.position,
            order: num,
          });
        }
      });

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
    } catch (err) {
      console.error('Error syncing Active Staff List with Telegram:', err);
      setConfig(loadedConfig);
    }
  };

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      const loaded = await getTelegramConfig();
      await syncWithActiveStaffList(loaded);
      await loadSubscribers();
      setLoading(false);
    };
    loadData();

    // Real-time listener for Telegram Subscribers
    const unsubSubscribers = onSnapshot(
      collection(db, 'telegramSubscribers'),
      (snap) => {
        const list: CustomerTelegramSubscriber[] = [];
        snap.forEach((d) => {
          const data = d.data() as CustomerTelegramSubscriber;
          if (data && data.chatId) list.push(data);
        });
        setSubscribers(list.sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || '')));
      },
      (err) => console.warn('Subscribers listener warning:', err)
    );

    const q = query(collection(db, 'telegramLogs'), orderBy('timestamp', 'desc'), limit(35));
    const unsubLogs = onSnapshot(
      q,
      (snap) => {
        setLogs(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      },
      (err) => console.warn('Telegram logs listener error:', err)
    );

    return () => {
      unsubSubscribers();
      unsubLogs();
    };
  }, []);

  // Background Auto-Polling: Customer များ Bot ၌ /start နှိပ်ထားပါက အလိုအလျောက် Subscribe ဖမ်းယူပေးခြင်း
  useEffect(() => {
    if (!config.botToken || !config.enabled) return;
    const interval = setInterval(() => {
      fetchRecentBotChats(config.botToken, true).catch(() => {});
    }, 25000);
    return () => clearInterval(interval);
  }, [config.botToken, config.enabled]);

  const showToast = (type: 'success' | 'error', text: string) => {
    setStatusBanner({ type, text });
    setTimeout(() => setStatusBanner(null), 5000);
  };

  const handleSaveConfig = async () => {
    setSaving(true);
    const ok = await saveTelegramConfig(config);
    setSaving(false);
    if (ok) {
      showToast('success', 'Telegram Bot Settings နှင့် Chat IDs စာရင်းကို အောင်မြင်စွာ သိမ်းဆည်းပြီးပါပြီ။');
    } else {
      showToast('error', 'သိမ်းဆည်းရာတွင် အမှားအယွင်းရှိနေပါသည်။');
    }
  };

  const handleRefreshActiveStaff = async () => {
    setLoading(true);
    await syncWithActiveStaffList(config);
    setLoading(false);
    showToast('success', 'HR Active Staff List အတိုင်း အသစ်ပြန်လည် ချိန်ညှိပြီးပါပြီ။');
  };

  const handleTestAdminConnection = async () => {
    if (!config.botToken || !config.adminGroupChatId) {
      showToast('error', 'Bot Token နှင့် Admin Group Chat ID ကို အရင်ဖြည့်သွင်းပါ။');
      return;
    }
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
      showToast('success', 'စမ်းသပ် Booking Notification ကို Telegram သို့ အောင်မြင်စွာ ပေးပို့ပြီးပါပြီ!');
    } else {
      showToast('error', `ပေးပို့မှု မအောင်မြင်ပါ: ${res.errors.join(', ')}`);
    }
  };

  const handleScanRecentChats = async () => {
    setScanningChats(true);
    const res = await fetchRecentBotChats(config.botToken, true);
    setScanningChats(false);
    
    if (res.ok) {
      setDiscoveredChats(res.chats);

      // 🌟 အဓိက ပြင်ဆင်ချက်: ရှာတွေ့သမျှ Private Chat များကို Firestore သို့ တိုက်ရိုက် Auto-Save လုပ်မည် 🌟
      const { doc, setDoc } = await import('firebase/firestore');
      let savedCount = 0;

      for (const chat of res.chats) {
        if (chat.type === 'private' || chat.type === 'PRIVATE') {
          const chatIdStr = String(chat.chatId).trim();
          if (chatIdStr && !chatIdStr.startsWith('-')) {
            await setDoc(
              doc(db, 'telegramSubscribers', chatIdStr),
              {
                chatId: chatIdStr,
                customerName: chat.titleOrName || 'Telegram Customer',
                customerPhone: '',
                username: chat.username || '',
                vipTier: 'Member',
                subscribed: true,
                source: 'bot_command',
                updatedAt: new Date().toISOString(),
              },
              { merge: true }
            );
            savedCount++;
          }
        }
      }

      await loadSubscribers();
      
      if (res.chats.length === 0) {
        showToast('error', 'လတ်တလော Message မတွေ့ပါ။ Telegram Bot သို့ "/start" တစ်ချက်ပို့ပြီး ပြန်နှိပ်ပါ။');
      } else {
        showToast(
          'success',
          `Chat ID (${res.chats.length}) ခု တွေ့ရှိပြီး Subscribed Customers (${savedCount}) ဦးကို အောင်မြင်စွာ သိမ်းဆည်းပြီးပါပြီ။`
        );
      }
    } else {
      showToast('error', res.error || 'Chat ID ရှာဖွေမရပါ။');
    }
  };

  const handleTestStaffDirect = async (staffId: string, staffName: string, chatId: string) => {
    if (!chatId) {
      showToast('error', `${staffName} အတွက် Telegram Chat ID မထည့်ရသေးပါ။`);
      return;
    }
    const res = await sendRawTelegramMessage(
      config.botToken,
      chatId,
      `🌿 <b>THE SHANGRI-LA MEN'S RETREAT</b>\n━━━━━━━━━━━━━━━━━━━━\n👋 မင်္ဂလာပါ <b>${staffName} (${staffId})</b>\nသင်၏ Telegram အကောင့်အား ဆိုင်၏ Real-Time Notification စနစ်နှင့် အောင်မြင်စွာ ချိတ်ဆက်ပြီးပါပြီ။`,
      undefined,
      'STAFF_TEST'
    );
    if (res.ok) {
      showToast('success', `${staffName} ထံသို့ Test Message ပို့ပြီးပါပြီ။`);
    } else {
      showToast('error', `${staffName} ထံ ပို့မရပါ: ${res.error}`);
    }
  };

  const handleSyncBotMenu = async () => {
    await saveTelegramConfig(config);
    const res = await syncBotCommandsAndMenu(config);
    if (res.ok) {
      showToast('success', res.message);
    } else {
      showToast('error', res.message);
    }
  };

  const handleAddManualSubscriber = async () => {
    if (!manualSubChatId.trim()) {
      showToast('error', 'Customer ၏ Telegram Chat ID ထည့်သွင်းပေးပါ။');
      return;
    }
    const ok = await saveCustomerTelegramSubscription({
      chatId: manualSubChatId.trim(),
      customerName: manualSubName.trim() || 'Shangri-La Guest',
      customerPhone: manualSubPhone.trim(),
      vipTier: manualSubVip,
      subscribed: true,
      source: 'admin_manual',
    });
    if (ok) {
      setManualSubName('');
      setManualSubPhone('');
      setManualSubChatId('');
      showToast('success', 'Customer Subscriber အသစ်ကို အောင်မြင်စွာ ထည့်သွင်းပြီးပါပြီ။');
    } else {
      showToast('error', 'Subscriber ထည့်သွင်းရာတွင် အမှားအယွင်းရှိပါသည်။');
    }
  };

  const handleSendCustomerMenu = async (sub: CustomerTelegramSubscriber) => {
    const res = await sendInteractiveMiniAppMenu(sub.chatId, config, sub.lastBookingId, sub.customerPhone);
    if (res.ok) {
      showToast('success', `${sub.customerName} ထံသို့ Mini App Menu ခလုတ်များ ပေးပို့ပြီးပါပြီ။`);
    } else {
      showToast('error', `ပေးပို့မရပါ: ${res.error}`);
    }
  };

  const handleSendBroadcast = async () => {
    if (!broadcastBody.trim()) {
      showToast('error', 'ပေးပို့လိုသည့် စာသား ရေးသားပေးပါ။');
      return;
    }
    setSendingBroadcast(true);
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
      showToast('success', 'ကြေညာချက်ကို ဝန်ထမ်း Telegram သို့ အောင်မြင်စွာ ပေးပို့ပြီးပါပြီ။');
    } else {
      showToast('error', `ပေးပို့မှု မအောင်မြင်ပါ: ${res.errors.join(', ')}`);
    }
  };

  const handleSendCustomerPromoBroadcast = async () => {
    if (!promoMessage.trim()) {
      showToast('error', 'Customer များထံ ပေးပို့လိုသည့် ပရိုမိုးရှင်း သို့မဟုတ် အသိပေးစာသား ရေးသားပေးပါ။');
      return;
    }
    if (promoAudience === 'SELECTED' && selectedSubIds.length === 0) {
      showToast('error', 'ပေးပို့လိုသော Customer အနည်းဆုံး (၁) ဦးကို ရွေးချယ်ပေးပါ။');
      return;
    }

    setSendingPromo(true);
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
      showToast(
        'success',
        `Customer (${res.successCount}/${res.totalTargeted}) ဦးထံသို့ Promotion / Push Notification အောင်မြင်စွာ ပေးပို့ပြီးပါပြီ!`
      );
    } else {
      showToast(
        'error',
        `ပေးပို့မှု မအောင်မြင်ပါ (Targeted: ${res.totalTargeted}). ${res.errors.slice(0, 2).join(', ')}`
      );
    }
  };

  if (loading) {
    return (
      <div className="p-8 text-center text-[#C8A951] bg-[#0B2419] rounded-2xl border border-[#C8A951]/30">
        <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2" />
        <p className="text-sm">Telegram Bot, Active Staff နှင့် Customer Subscribers စာရင်းကို စစ်ထုတ်နေပါသည်...</p>
      </div>
    );
  }

  return (
    <div className="bg-[#0B2419] text-stone-100 rounded-2xl border border-[#C8A951]/30 shadow-2xl overflow-hidden">
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
          <label className="flex items-center gap-2 cursor-pointer bg-black/30 px-3.5 py-2 rounded-xl border border-[#C8A951]/30">
            <input
              type="checkbox"
              checked={config.enabled}
              onChange={(e) => setConfig({ ...config, enabled: e.target.checked })}
              className="accent-[#C8A951] w-4 h-4"
            />
            <span className="text-xs font-semibold text-[#C8A951]">
              {config.enabled ? '🟢 BOT ACTIVE' : '🔴 BOT PAUSED'}
            </span>
          </label>

          <button
            onClick={handleSaveConfig}
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#C8A951] text-[#0B2419] font-bold text-xs hover:bg-[#d8b962] transition disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            {saving ? 'Saving...' : 'Save All Changes'}
          </button>
        </div>
      </div>

      {/* Status Toast */}
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
              className={`flex items-center gap-2 px-4 py-3.5 text-xs font-semibold whitespace-nowrap border-b-2 transition ${
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
                    className="absolute right-2.5 text-stone-400 hover:text-[#C8A951]"
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
                <label className="block text-xs font-semibold text-[#C8A951] mb-1">
                  Admin / Reception Group Chat ID
                </label>
                <input
                  type="text"
                  value={config.adminGroupChatId}
                  onChange={(e) => setConfig({ ...config, adminGroupChatId: e.target.value })}
                  placeholder="-1001234567890"
                  className="w-full bg-[#071810] border border-[#C8A951]/30 rounded-lg px-3 py-2 text-xs text-white"
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
                  className="w-full bg-[#071810] border border-[#C8A951]/30 rounded-lg px-3 py-2 text-xs text-white"
                />
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <button
                onClick={handleTestAdminConnection}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs transition"
              >
                <Sparkles className="w-4 h-4" />
                Send Test Booking Notification
              </button>

              <button
                onClick={handleScanRecentChats}
                disabled={scanningChats}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#C8A951]/20 hover:bg-[#C8A951]/30 text-[#C8A951] border border-[#C8A951]/40 font-semibold text-xs transition"
              >
                <Radio className={`w-4 h-4 ${scanningChats ? 'animate-ping' : ''}`} />
                {scanningChats ? 'Scanning Bot Updates...' : '🔄 Scan Recent Chats & Auto-Subscribe Customers'}
              </button>

              <button
                onClick={handleSyncBotMenu}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#C8A951] text-[#0B2419] hover:bg-[#d8b962] font-bold text-xs transition"
              >
                <Smartphone className="w-4 h-4" />
                ⚡ Setup Mini App Menu & Commands (/book, /staff, /available, /history)
              </button>
            </div>

            {/* RECENT DISCOVERED CHATS TABLE */}
            {discoveredChats.length > 0 && (
              <div className="bg-black/30 rounded-xl border border-[#C8A951]/30 p-4 space-y-3">
                <h3 className="text-xs font-bold text-[#C8A951]">
                  📡 Bot သို့ လတ်တလော ဆက်သွယ်ထားသော Customer များနှင့် Group များ (Private Chats များသည် Auto-Subscribed ဖြစ်ပြီးသားဖြစ်ပါသည်)
                </h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-[#C8A951]/20 text-stone-400">
                        <th className="py-2 px-2">Name / Group Title</th>
                        <th className="py-2 px-2">Type</th>
                        <th className="py-2 px-2">Chat ID</th>
                        <th className="py-2 px-2">Last Message</th>
                        <th className="py-2 px-2">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {discoveredChats.map((c) => (
                        <tr key={c.chatId} className="hover:bg-white/5">
                          <td className="py-2 px-2 font-medium text-white">
                            {c.titleOrName} {c.username ? `(@${c.username})` : ''}
                          </td>
                          <td className="py-2 px-2 uppercase text-[10px] text-[#C8A951]">{c.type}</td>
                          <td className="py-2 px-2 font-mono text-emerald-300">{c.chatId}</td>
                          <td className="py-2 px-2 text-stone-400 truncate max-w-[160px]">{c.lastMessage}</td>
                          <td className="py-2 px-2 flex items-center gap-2">
                            <button
                              onClick={() => {
                                navigator.clipboard.writeText(c.chatId);
                                showToast('success', `Chat ID (${c.chatId}) ကို Copy ကူးပြီးပါပြီ။`);
                              }}
                              className="px-2 py-1 rounded bg-white/10 hover:bg-white/20 text-[11px] flex items-center gap-1 text-white"
                            >
                              <Copy className="w-3 h-3" /> Copy ID
                            </button>
                            <button
                              onClick={() => setConfig({ ...config, adminGroupChatId: c.chatId })}
                              className="px-2 py-1 rounded bg-[#C8A951]/20 text-[#C8A951] hover:bg-[#C8A951]/30 text-[11px]"
                            >
                              Set as Admin ID
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 2: NOTIFICATION TRIGGERS */}
        {activeTab === 'triggers' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-black/25 p-4 rounded-xl border border-[#C8A951]/20 space-y-3">
              <h3 className="text-sm font-bold text-[#C8A951] border-b border-[#C8A951]/20 pb-2">
                📅 Customer & Admin Booking Status Real-Time Alerts
              </h3>
              {[
                { key: 'customerDirectNoti', label: '📲 Customer ဆီသို့ Booking Status တိုက်ရိုက်ပို့မည် (Direct Customer Alert)' },
                { key: 'newBooking', label: '🔔 Booking အသစ်ဝင်ချိန် (New Booking Created)' },
                { key: 'bookingConfirmed', label: '🟢 Booking အတည်ပြုချိန် (Status -> Confirmed)' },
                { key: 'bookingInService', label: '💆‍♂️ ဝန်ဆောင်မှု စတင်ချိန် (Status -> In-Service)' },
                { key: 'bookingCompleted', label: '✨ ဝန်ဆောင်မှု ပြီးဆုံးချိန် (Status -> Completed)' },
                { key: 'bookingCancelled', label: '🔴 Booking ပယ်ဖျက်ချိန် (Status -> Cancelled)' },
              ].map((item) => (
                <label key={item.key} className="flex items-center justify-between py-1.5 cursor-pointer">
                  <span className="text-xs text-stone-200">{item.label}</span>
                  <input
                    type="checkbox"
                    checked={(config.triggers as any)[item.key] !== false}
                    onChange={(e) =>
                      setConfig({
                        ...config,
                        triggers: { ...config.triggers, [item.key]: e.target.checked },
                      })
                    }
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
                <label key={item.key} className="flex items-center justify-between py-1.5 cursor-pointer">
                  <span className="text-xs text-stone-200">{item.label}</span>
                  <input
                    type="checkbox"
                    checked={(config.triggers as any)[item.key]}
                    onChange={(e) =>
                      setConfig({
                        ...config,
                        triggers: { ...config.triggers, [item.key]: e.target.checked },
                      })
                    }
                    className="accent-[#C8A951] w-4 h-4"
                  />
                </label>
              ))}
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
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#C8A951]/20 hover:bg-[#C8A951]/30 text-[#C8A951] border border-[#C8A951]/40 text-xs font-bold whitespace-nowrap transition"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Sync Active Staff List
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
                    <th className="py-3 px-3 text-right">Test</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {config.staffMappings.map((staff, idx) => {
                    const hrMeta = staffHrMeta[staff.staffId];
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
                          <input
                            type="text"
                            value={staff.telegramChatId}
                            onChange={(e) => {
                              const updated = [...config.staffMappings];
                              updated[idx].telegramChatId = e.target.value;
                              setConfig({ ...config, staffMappings: updated });
                            }}
                            placeholder="e.g. 582910394"
                            className="bg-[#071810] border border-[#C8A951]/30 rounded px-2.5 py-1 text-xs font-mono text-emerald-300 w-40"
                          />
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
                                className="accent-[#C8A951]"
                              />
                            </td>
                          )
                        )}
                        <td className="py-2.5 px-3 text-right">
                          <button
                            onClick={() => handleTestStaffDirect(staff.staffId, staff.staffName, staff.telegramChatId)}
                            className="px-2.5 py-1 rounded bg-[#C8A951]/20 text-[#C8A951] hover:bg-[#C8A951]/30 text-[11px] font-semibold"
                          >
                            Test Ping
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

        {/* TAB 4: SUBSCRIBED CUSTOMERS */}
        {activeTab === 'customers' && (
          <div className="space-y-4">
            <div className="bg-black/25 p-4 rounded-xl border border-[#C8A951]/20 space-y-3">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-2">
                <div>
                  <h3 className="text-sm font-bold text-[#C8A951]">
                    📲 Subscribed Customers (Real-Time Booking Noti & Promo List)
                  </h3>
                  <p className="text-xs text-stone-400">
                    Customer များ Telegram Mini App ဖွင့်ချိန် သို့မဟုတ် Booking အတည်ပြုခလုတ်နှိပ်ချိန်တွင် Chat ID ကို အလိုအလျောက် ဖမ်းယူသိမ်းဆည်းပေးပါသည်။
                  </p>
                </div>
                <button
                  onClick={handleScanRecentChats}
                  disabled={scanningChats}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#C8A951] text-[#0B2419] font-bold text-xs hover:bg-[#d8b962] transition"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${scanningChats ? 'animate-spin' : ''}`} />
                  Auto-Sync New Bot Subscribers
                </button>
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
                  className="flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs"
                >
                  <UserPlus className="w-3.5 h-3.5" /> Add Subscriber
                </button>
              </div>
            </div>

            <div className="overflow-x-auto bg-black/20 rounded-xl border border-[#C8A951]/20">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-[#C8A951]/20 text-[#C8A951] bg-black/40">
                    <th className="py-3 px-3">Select</th>
                    <th className="py-3 px-3">Customer Name</th>
                    <th className="py-3 px-3">Phone</th>
                    <th className="py-3 px-3">Telegram Chat ID</th>
                    <th className="py-3 px-3">VIP Tier</th>
                    <th className="py-3 px-3">Source</th>
                    <th className="py-3 px-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {subscribers.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-6 text-center text-stone-400">
                        Subscribed လုပ်ထားသော Customer မရှိသေးပါ။
                      </td>
                    </tr>
                  ) : (
                    subscribers.map((sub) => {
                      const isSelected = selectedSubIds.includes(sub.chatId);
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
                              className="accent-[#C8A951]"
                            />
                          </td>
                          <td className="py-2.5 px-3 font-semibold text-white">
                            {sub.customerName} {sub.username ? <span className="text-stone-400">(@{sub.username})</span> : null}
                          </td>
                          <td className="py-2.5 px-3 font-mono text-stone-200">{sub.customerPhone || '-'}</td>
                          <td className="py-2.5 px-3 font-mono text-emerald-300">{sub.chatId}</td>
                          <td className="py-2.5 px-3">
                            <span className="px-2 py-0.5 rounded bg-[#C8A951]/20 text-[#C8A951] text-[10px] font-bold">
                              {sub.vipTier || 'Member'}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-stone-400 uppercase text-[10px]">
                            {sub.source || 'mini_app'}
                          </td>
                          <td className="py-2.5 px-3 text-right space-x-2">
                            <button
                              onClick={() => handleSendCustomerMenu(sub)}
                              className="px-2.5 py-1 rounded bg-[#C8A951]/20 text-[#C8A951] hover:bg-[#C8A951]/30 text-[11px] font-semibold"
                            >
                              Send Mini App Menu
                            </button>
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
                className="w-full py-2.5 rounded-xl bg-[#C8A951] text-[#0B2419] font-bold text-xs hover:bg-[#d8b962] flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <Send className="w-4 h-4" />
                {sendingPromo
                  ? 'Customer များထံ ပေးပို့နေပါသည်...'
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
                    className="px-3 py-1.5 rounded-lg bg-[#C8A951] text-[#0B2419] font-bold text-xs hover:bg-[#d8b962]"
                  >
                    ⚡ Push Menu Icons to Telegram
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
                  className="w-full py-2.5 rounded-xl bg-white/10 text-[#C8A951] border border-[#C8A951]/40 font-bold text-xs hover:bg-white/20 flex items-center justify-center gap-2"
                >
                  <Send className="w-4 h-4" />
                  {sendingBroadcast ? 'ပေးပို့နေပါသည်...' : 'Send Staff Announcement'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* TAB 6: DELIVERY LOGS */}
        {activeTab === 'logs' && (
          <div className="space-y-3">
            <h3 className="text-xs font-bold text-[#C8A951]">
              📜 နောက်ဆုံး ပေးပို့ခဲ့သော Telegram Notification မှတ်တမ်းများ (Last 35 Logs)
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
                    logs.map((log) => (
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
    </div>
  );
};

export default TelegramNotificationCenter;
