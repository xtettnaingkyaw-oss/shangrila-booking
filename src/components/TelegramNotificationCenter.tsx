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
} from 'lucide-react';
import { collection, query, orderBy, limit, onSnapshot, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import { decryptText } from '../security';
import {
  TelegramBotConfig,
  TelegramStaffMapping,
  DEFAULT_TELEGRAM_CONFIG,
  getTelegramConfig,
  saveTelegramConfig,
  sendRawTelegramMessage,
  notifyBookingEvent,
  notifyStaffUpdate,
  fetchRecentBotChats,
  syncBotCommandsAndMenu,
  DiscoveredTelegramChat,
} from '../telegramService';

// 🌟 Helper: Extract Staff Number (e.g. "Therapist No-1" or "No. 1" -> 1) 🌟
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
  const [activeTab, setActiveTab] = useState<'setup' | 'triggers' | 'staff' | 'botflow' | 'logs'>('setup');
  const [showToken, setShowToken] = useState<boolean>(false);
  const [statusBanner, setStatusBanner] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // 🌟 Active Staff Extra Info (Actual Name & Position from HR Active Staff List) 🌟
  const [staffHrMeta, setStaffHrMeta] = useState<Record<string, { actualName?: string; position?: string }>>({});

  // Chat Discovery State
  const [scanningChats, setScanningChats] = useState<boolean>(false);
  const [discoveredChats, setDiscoveredChats] = useState<DiscoveredTelegramChat[]>([]);

  // Broadcast State
  const [broadcastTitle, setBroadcastTitle] = useState<string>('📢 ရုံးတွင်း အရေးကြီး အသိပေးချက်');
  const [broadcastBody, setBroadcastBody] = useState<string>('');
  const [broadcastTarget, setBroadcastTarget] = useState<'ALL' | 'ADMIN' | 'STAFF_GROUP'>('ALL');
  const [sendingBroadcast, setSendingBroadcast] = useState<boolean>(false);

  // Logs State
  const [logs, setLogs] = useState<any[]>([]);

  // 🌟 Sync Active Staff List from HR Management (`therapists` + `onboarding_requests`) 🌟
  const syncWithActiveStaffList = async (loadedConfig: TelegramBotConfig) => {
    try {
      const [therapistsSnap, onboardingSnap] = await Promise.all([
        getDocs(collection(db, 'therapists')),
        getDocs(collection(db, 'onboarding_requests')),
      ]);

      // 1. Collect HR Approved / Active Onboarding Profiles
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

      // 2. Collect Active Therapists from `therapists` collection (Primary source for Active Staff List)
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
        if (num !== null && hrResignedNums.has(num)) {
          return;
        }
        if (num !== null && seenNums.has(num)) {
          return;
        }
        if (num !== null) seenNums.add(num);

        const hrInfo = num !== null ? hrByNum.get(num) : undefined;
        const actualName = safeDecrypt(raw.actualName || raw.fullName || '') || hrInfo?.actualName || '';
        const position = safeDecrypt(raw.position || '') || hrInfo?.position || '';

        activeStaffItems.push({
          num,
          staffId: num !== null ? `No. ${num}` : d.id,
          staffName: rawName,
          actualName,
          position,
          order: num !== null ? num : Number(raw.order) || 999,
        });
      });

      // 3. Also include any Approved/Active HR staff not yet in `therapists` collection
      hrByNum.forEach((hrVal, num) => {
        if (!seenNums.has(num) && !hrResignedNums.has(num)) {
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

      // Sort by Staff Number (No-1, No-3, No-5, No-6, No-10, etc.)
      activeStaffItems.sort((a, b) => a.order - b.order);

      if (activeStaffItems.length === 0) {
        setConfig(loadedConfig);
        return;
      }

      // 4. Merge with existing Telegram `staffMappings` so saved Chat IDs & Checkboxes are preserved
      const existingMappings = loadedConfig.staffMappings || [];
      const metaMap: Record<string, { actualName?: string; position?: string }> = {};

      const syncedMappings: TelegramStaffMapping[] = activeStaffItems.map((activeItem) => {
        const matchedExisting = existingMappings.find((m) => {
          const mNum = extractStaffNumber(m.staffId) ?? extractStaffNumber(m.staffName);
          if (activeItem.num !== null && mNum !== null) {
            return activeItem.num === mNum;
          }
          return (
            m.staffId.trim().toLowerCase() === activeItem.staffId.trim().toLowerCase() ||
            m.staffName.trim().toLowerCase() === activeItem.staffName.trim().toLowerCase()
          );
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
      setConfig({
        ...loadedConfig,
        staffMappings: syncedMappings,
      });
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
      setLoading(false);
    };
    loadData();

    // Real-time listener for Telegram delivery logs
    const q = query(collection(db, 'telegramLogs'), orderBy('timestamp', 'desc'), limit(35));
    const unsub = onSnapshot(
      q,
      (snap) => {
        setLogs(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      },
      (err) => console.warn('Telegram logs listener error:', err)
    );

    return () => unsub();
  }, []);

  const showToast = (type: 'success' | 'error', text: string) => {
    setStatusBanner({ type, text });
    setTimeout(() => setStatusBanner(null), 5000);
  };

  const handleSaveConfig = async () => {
    setSaving(true);
    const ok = await saveTelegramConfig(config);
    setSaving(false);
    if (ok) {
      showToast('success', 'Telegram Bot Settings နှင့် Active Staff စာရင်းကို Firestore သို့ အောင်မြင်စွာ သိမ်းဆည်းပြီးပါပြီ။');
    } else {
      showToast('error', 'သိမ်းဆည်းရာတွင် အမှားအယွင်းရှိနေပါသည်။');
    }
  };

  const handleRefreshActiveStaff = async () => {
    setLoading(true);
    await syncWithActiveStaffList(config);
    setLoading(false);
    showToast('success', 'HR Active Staff List အတိုင်း ဝန်ထမ်းစာရင်းကို ပြန်လည်ချိတ်ဆက်ပြီးပါပြီ။');
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
      notes: 'Siam Sleep Balm နှင့် အခန်းအပူချိန် အေးအေးလေး ပြင်ဆင်ထားပေးပါရန်။',
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
    const res = await fetchRecentBotChats(config.botToken);
    setScanningChats(false);
    if (res.ok) {
      setDiscoveredChats(res.chats);
      if (res.chats.length === 0) {
        showToast('error', 'လတ်တလော Message မတွေ့ပါ။ Telegram Bot သို့ "/start" သို့မဟုတ် "Hello" တစ်ချက်ပို့ပြီး ပြန်နှိပ်ပါ။');
      } else {
        showToast('success', `Chat ID (${res.chats.length}) ခု ရှာဖွေတွေ့ရှိပါပြီ။`);
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
      `🌿 <b>THE SHANGRI-LA MEN'S RETREAT</b>\n━━━━━━━━━━━━━━━━━━━━\n👋 မင်္ဂလာပါ <b>${staffName} (${staffId})</b>\nသင်၏ Telegram အကောင့်အား ဆိုင်၏ Real-Time Notification စနစ်နှင့် အောင်မြင်စွာ ချိတ်ဆက်ပြီးပါပြီ။\n\n✅ Booking တာဝန်ချထားမှုများ\n✅ Duty Roster အပြောင်းအလဲများ\n✅ လစာနှင့် ရုံးတွင်းအသိပေးချက်များကို အချိန်နှင့်တစ်ပြေးညီ လက်ခံရရှိပါမည်။`,
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
      showToast('success', 'ကြေညာချက်ကို Telegram သို့ အောင်မြင်စွာ ပေးပို့ပြီးပါပြီ။');
    } else {
      showToast('error', `ပေးပို့မှု မအောင်မြင်ပါ: ${res.errors.join(', ')}`);
    }
  };

  if (loading) {
    return (
      <div className="p-8 text-center text-[#C8A951] bg-[#0B2419] rounded-2xl border border-[#C8A951]/30">
        <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2" />
        <p className="text-sm">Telegram Control Center နှင့် Active Staff စာရင်းကို ရယူနေပါသည်...</p>
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
              TELEGRAM BOT & REAL-TIME NOTIFICATION CENTER
            </h2>
          </div>
          <p className="text-xs text-stone-400 mt-1">
            Booking Status Updates, ဝန်ထမ်း တစ်ဦးချင်းစီအတွက် Real-Time Alerts နှင့် Bot Flow ထိန်းချုပ်ရေးစနစ်
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
          { id: 'staff', label: `3. Active Staff Chat IDs (${config.staffMappings.length})`, icon: Users },
          { id: 'botflow', label: '4. Bot Flow & Broadcast', icon: MessageSquare },
          { id: 'logs', label: '5. Delivery Logs', icon: History },
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
                <p className="text-[11px] text-stone-400 mt-1">
                  @BotFather မှ ရရှိသော HTTP API Token ကို ထည့်သွင်းပါ။
                </p>
              </div>

              <div className="bg-black/25 p-4 rounded-xl border border-[#C8A951]/20">
                <label className="block text-xs font-semibold text-[#C8A951] mb-1">
                  Official Web App URL
                </label>
                <input
                  type="text"
                  value={config.webAppUrl}
                  onChange={(e) => setConfig({ ...config, webAppUrl: e.target.value })}
                  placeholder="https://www.shangrilamenretreat.online"
                  className="w-full bg-[#071810] border border-[#C8A951]/30 rounded-lg px-3 py-2 text-xs text-white"
                />
                <p className="text-[11px] text-stone-400 mt-1">
                  Telegram Notification အောက်ရှိ Button နှိပ်လျှင် ပွင့်လာမည့် Link ဖြစ်ပါသည်။
                </p>
              </div>

              <div className="bg-black/25 p-4 rounded-xl border border-[#C8A951]/20">
                <label className="block text-xs font-semibold text-[#C8A951] mb-1">
                  Admin / Reception Group Chat ID
                </label>
                <input
                  type="text"
                  value={config.adminGroupChatId}
                  onChange={(e) => setConfig({ ...config, adminGroupChatId: e.target.value })}
                  placeholder="-1001234567890 သို့မဟုတ် 123456789"
                  className="w-full bg-[#071810] border border-[#C8A951]/30 rounded-lg px-3 py-2 text-xs text-white"
                />
                <p className="text-[11px] text-stone-400 mt-1">
                  Booking အသစ်နှင့် ငွေစာရင်း အသေးစိတ်အားလုံး ပေးပို့မည့် အဓိက Admin Group ID (Group ဆိုလျှင် ရှေ့တွင် `-` အနုတ်လက္ခဏာပါသည်)။
                </p>
              </div>

              <div className="bg-black/25 p-4 rounded-xl border border-[#C8A951]/20">
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
                <p className="text-[11px] text-stone-400 mt-1">
                  ဝန်ထမ်းအားလုံး ပါဝင်သော Group ရှိပါက ထည့်သွင်းနိုင်သည် (ဧည့်သည်ဖုန်းနံပါတ် မပါဝင်ဘဲ အချိန်စာရင်းနှင့် တာဝန်ချထားမှုသာ ပို့ပေးမည်)။
                </p>
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
                {scanningChats ? 'Scanning Bot Updates...' : '🔄 Scan Recent Chats (Auto-Find Chat IDs)'}
              </button>
            </div>

            {/* Discovered Chats Table */}
            {discoveredChats.length > 0 && (
              <div className="bg-black/30 rounded-xl border border-[#C8A951]/30 p-4 space-y-3">
                <h3 className="text-xs font-bold text-[#C8A951]">
                  📡 Bot သို့ လတ်တလော ဆက်သွယ်ထားသော အကောင့်နှင့် Group များ (Click to Copy Chat ID)
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
                              className="px-2 py-1 rounded bg-white/10 hover:bg-white/20 text-[11px] flex items-center gap-1"
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
                📅 Booking Status Real-Time Alerts
              </h3>
              {[
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
                  ✅ <b>HR Management → Active Staff List</b> ရှိ လက်ရှိ တာဝန်ထမ်းဆောင်နေသော Active ဝန်ထမ်း ({config.staffMappings.length}) ဦးကိုသာ တိုက်ရိုက် ချိတ်ဆက်ပြသထားပါသည်။
                </p>
                <p className="text-[11px] text-stone-400 mt-0.5">
                  💡 ဝန်ထမ်းတစ်ဦးချင်းစီသည် ဆိုင်၏ Telegram Bot ကို <b>Start</b> နှိပ်ထားရပါမည်။ ထို့နောက် Tab 1 ရှိ{' '}
                  <b>Scan Recent Chats</b> ဖြင့် ၎င်းတို့၏ Chat ID ကို ရှာယူပြီး အောက်ပါဇယားတွင် ထည့်သွင်းပါ။
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

        {/* TAB 4: BOT FLOW & BROADCAST */}
        {activeTab === 'botflow' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Bot Flow Controller */}
            <div className="bg-black/25 p-5 rounded-xl border border-[#C8A951]/20 space-y-4">
              <div className="flex items-center justify-between border-b border-[#C8A951]/20 pb-3">
                <h3 className="text-sm font-bold text-[#C8A951]">🤖 Telegram Bot Flow & Menu Customization</h3>
                <button
                  onClick={handleSyncBotMenu}
                  className="px-3 py-1.5 rounded-lg bg-[#C8A951] text-[#0B2419] font-bold text-xs hover:bg-[#d8b962]"
                >
                  ⚡ Push Commands to Telegram
                </button>
              </div>

              <div className="space-y-3">
                <label className="flex items-center justify-between text-xs">
                  <span>Notification အောက်တွင် [🌐 Open Admin Panel] ခလုတ်ထည့်မည်</span>
                  <input
                    type="checkbox"
                    checked={config.botFlow.enableWebAppButton}
                    onChange={(e) =>
                      setConfig({
                        ...config,
                        botFlow: { ...config.botFlow, enableWebAppButton: e.target.checked },
                      })
                    }
                    className="accent-[#C8A951] w-4 h-4"
                  />
                </label>

                <div>
                  <label className="block text-xs text-[#C8A951] mb-1">New Booking Header Title</label>
                  <input
                    type="text"
                    value={config.templates.newBookingTitle}
                    onChange={(e) =>
                      setConfig({
                        ...config,
                        templates: { ...config.templates, newBookingTitle: e.target.value },
                      })
                    }
                    className="w-full bg-[#071810] border border-[#C8A951]/30 rounded-lg px-3 py-2 text-xs text-white"
                  />
                </div>

                <div>
                  <label className="block text-xs text-[#C8A951] mb-1">Booking Status Update Header Title</label>
                  <input
                    type="text"
                    value={config.templates.statusUpdateTitle}
                    onChange={(e) =>
                      setConfig({
                        ...config,
                        templates: { ...config.templates, statusUpdateTitle: e.target.value },
                      })
                    }
                    className="w-full bg-[#071810] border border-[#C8A951]/30 rounded-lg px-3 py-2 text-xs text-white"
                  />
                </div>

                <div>
                  <label className="block text-xs text-[#C8A951] mb-1">Bot Welcome Message (/start)</label>
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

                <div>
                  <label className="block text-xs text-[#C8A951] mb-1">Custom Notification Footer</label>
                  <input
                    type="text"
                    value={config.botFlow.customFooterText}
                    onChange={(e) =>
                      setConfig({
                        ...config,
                        botFlow: { ...config.botFlow, customFooterText: e.target.value },
                      })
                    }
                    className="w-full bg-[#071810] border border-[#C8A951]/30 rounded-lg px-3 py-2 text-xs text-white"
                  />
                </div>
              </div>
            </div>

            {/* Instant Broadcast Box */}
            <div className="bg-black/25 p-5 rounded-xl border border-[#C8A951]/20 space-y-4">
              <h3 className="text-sm font-bold text-[#C8A951] border-b border-[#C8A951]/20 pb-3">
                📢 Instant Staff & Group Announcement (Broadcast)
              </h3>

              <div>
                <label className="block text-xs text-[#C8A951] mb-1">ခေါင်းစဉ် (Announcement Title)</label>
                <input
                  type="text"
                  value={broadcastTitle}
                  onChange={(e) => setBroadcastTitle(e.target.value)}
                  className="w-full bg-[#071810] border border-[#C8A951]/30 rounded-lg px-3 py-2 text-xs text-white"
                />
              </div>

              <div>
                <label className="block text-xs text-[#C8A951] mb-1">
                  အကြောင်းအရာ အပြည့်အစုံ (Message Content)
                </label>
                <textarea
                  rows={4}
                  value={broadcastBody}
                  onChange={(e) => setBroadcastBody(e.target.value)}
                  placeholder="ဥပမာ - မနက်ဖြန် သီတင်းကျွတ် အထူးပရိုမိုးရှင်းရှိသဖြင့် ဝန်ထမ်းအားလုံး မနက် ၉:၃၀ အရောက် ဆိုင်သို့ လာရောက်ကြပါရန်..."
                  className="w-full bg-[#071810] border border-[#C8A951]/30 rounded-lg px-3 py-2 text-xs text-white"
                />
              </div>

              <button
                onClick={handleSendBroadcast}
                disabled={sendingBroadcast}
                className="w-full py-2.5 rounded-xl bg-[#C8A951] text-[#0B2419] font-bold text-xs hover:bg-[#d8b962] flex items-center justify-center gap-2"
              >
                <Send className="w-4 h-4" />
                {sendingBroadcast ? 'ပေးပို့နေပါသည်...' : 'Telegram သို့ ချက်ချင်းပေးပို့မည် (Send Now)'}
              </button>
            </div>
          </div>
        )}

        {/* TAB 5: DELIVERY LOGS */}
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
