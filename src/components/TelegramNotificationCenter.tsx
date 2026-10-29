import React, { useState, useEffect } from 'react';
import { 
  Send, Settings, Users, MessageSquare, AlertCircle, CheckCircle2, 
  RefreshCw, Shield, Bell, ExternalLink, Bot, Check, X, Smartphone
} from 'lucide-react';
import { 
  getTelegramSettings, saveTelegramSettings, sendTelegramMessage, 
  broadcastTelegramMessage, sendQuickPenaltyAlert, syncTelegramSubscribers,
  TelegramSettings, TelegramSubscriber, TelegramNotificationLog 
} from '../telegramService';

export const TelegramNotificationCenter: React.FC = () => {
  const [settings, setSettings] = useState<TelegramSettings>(getTelegramSettings());
  const [subscribers, setSubscribers] = useState<TelegramSubscriber[]>([]);
  const [logs, setLogs] = useState<TelegramNotificationLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'broadcast' | 'subscribers' | 'settings' | 'logs'>('broadcast');

  // Broadcast Form State
  const [broadcastText, setBroadcastText] = useState('');
  const [broadcastTarget, setBroadcastTarget] = useState<'all' | 'channel' | 'vip'>('channel');
  const [includeBookButton, setIncludeBookButton] = useState(true);
  const [sending, setSending] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const currentSettings = getTelegramSettings();
      setSettings(currentSettings);
      const subs = await syncTelegramSubscribers();
      setSubscribers(subs);
      
      // Load logs from localStorage
      const savedLogs = localStorage.getItem('shangrila_telegram_logs');
      if (savedLogs) {
        setLogs(JSON.parse(savedLogs));
      }
    } catch (error) {
      console.error('Error loading Telegram data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveSettings = (e: React.FormEvent) => {
    e.preventDefault();
    saveTelegramSettings(settings);
    setStatusMessage({ type: 'success', text: 'Telegram ဆက်တင်များကို အောင်မြင်စွာ သိမ်းဆည်းပြီးပါပြီ။' });
    setTimeout(() => setStatusMessage(null), 4000);
  };

  const handleSendBroadcast = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!broadcastText.trim()) return;

    setSending(true);
    setStatusMessage(null);

    try {
      let successCount = 0;
      const inlineKeyboard = includeBookButton ? {
        inline_keyboard: [[
          { text: '🌟 Book Now / ဘိုကင်တင်ရန်', url: 'https://shangrilamenretreat.com' },
          { text: '📞 ဆက်သွယ်ရန်', url: 'https://t.me/shangrila_support' }
        ]]
      } : undefined;

      if (broadcastTarget === 'channel' && settings.channelUsername) {
        const success = await broadcastTelegramMessage(
          `📢 **THE SHANGRILA MEN RETREAT**\n\n${broadcastText}`,
          inlineKeyboard
        );
        if (success) successCount = 1;
      } else {
        // Broadcast to subscribers / VIPs
        const targets = subscribers.filter(s => broadcastTarget === 'all' || (broadcastTarget === 'vip' && s.isVip));
        for (const sub of targets) {
          const success = await broadcastTelegramMessage(broadcastText, inlineKeyboard);
          if (success) successCount++;
        }
      }

      setStatusMessage({ type: 'success', text: `သတင်းစာကို အောင်မြင်စွာ ပေးပို့ပြီးပါပြီ။ (Target count: ${successCount})` });
      setBroadcastText('');
      loadData();
    } catch (error: any) {
      setStatusMessage({ type: 'error', text: `ပေးပို့၍မရပါ: ${error.message || 'Unknown error'}` });
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="bg-slate-900 text-slate-100 rounded-2xl p-6 shadow-2xl border border-amber-500/30 max-w-5xl mx-auto my-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row items-center justify-between pb-6 border-b border-slate-800 gap-4">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl text-amber-400">
            <Bot className="w-8 h-8" />
          </div>
          <div>
            <h2 className="text-2xl font-bold tracking-wide text-amber-400">Telegram Pro Notification Center</h2>
            <p className="text-sm text-slate-400">Realtime Bot Automation, Channel Broadcast & Staff Alerts</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button 
            onClick={loadData}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl transition border border-slate-700 text-sm font-medium"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <span className={`px-3 py-1.5 rounded-full text-xs font-semibold flex items-center gap-1.5 ${settings.enabled ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'}`}>
            <span className={`w-2 h-2 rounded-full ${settings.enabled ? 'bg-emerald-400 animate-pulse' : 'bg-rose-400'}`}></span>
            {settings.enabled ? 'Bot Active' : 'Bot Disabled'}
          </span>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex flex-wrap gap-2 my-6 border-b border-slate-800 pb-4">
        {[
          { id: 'broadcast', label: 'Channel Broadcast', icon: Send },
          { id: 'subscribers', label: `Subscribers (${subscribers.length})`, icon: Users },
          { id: 'settings', label: 'Bot Settings', icon: Settings },
          { id: 'logs', label: 'Delivery Logs', icon: Bell },
        ].map(tab => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-medium text-sm transition ${
                activeTab === tab.id 
                  ? 'bg-amber-500 text-slate-950 font-semibold shadow-lg shadow-amber-500/20' 
                  : 'bg-slate-800/60 text-slate-400 hover:bg-slate-800 hover:text-slate-200'
              }`}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Status Alert Banner */}
      {statusMessage && (
        <div className={`p-4 rounded-xl mb-6 flex items-center gap-3 border ${statusMessage.type === 'success' ? 'bg-emerald-950/40 border-emerald-500/30 text-emerald-300' : 'bg-rose-950/40 border-rose-500/30 text-rose-300'}`}>
          {statusMessage.type === 'success' ? <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" /> : <AlertCircle className="w-5 h-5 text-rose-400 shrink-0" />}
          <span className="text-sm font-medium">{statusMessage.text}</span>
        </div>
      )}

      {/* Tab 1: Broadcast */}
      {activeTab === 'broadcast' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-4">
            <form onSubmit={handleSendBroadcast} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Broadcast Message (Markdown Supported)</label>
                <textarea
                  rows={6}
                  value={broadcastText}
                  onChange={(e) => setBroadcastText(e.target.value)}
                  placeholder="ဥပမာ - 🌟 Happy Hour Promo! ယနေ့ ညနေ ၃ နာရီမှ ၆ နာရီအတွင်း Signature Service တိုင်းအတွက် 20% Discount ရရှိမည်ဖြစ်ပါသည်..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-4 text-slate-100 placeholder-slate-600 focus:outline-none focus:border-amber-500 transition text-sm"
                  required
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">Target Audience</label>
                  <select
                    value={broadcastTarget}
                    onChange={(e: any) => setBroadcastTarget(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-slate-200 focus:outline-none focus:border-amber-500 text-sm"
                  >
                    <option value="channel">Official Telegram Channel ({settings.channelUsername})</option>
                    <option value="all">All Connected Customers ({subscribers.length})</option>
                    <option value="vip">VIP Members Only</option>
                  </select>
                </div>

                <div className="flex items-center pt-6">
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={includeBookButton}
                      onChange={(e) => setIncludeBookButton(e.target.checked)}
                      className="w-5 h-5 rounded bg-slate-950 border-slate-800 text-amber-500 focus:ring-amber-500"
                    />
                    <span className="text-sm font-medium text-slate-300">Include "Book Now" Button</span>
                  </label>
                </div>
              </div>

              <button
                type="submit"
                disabled={sending}
                className="w-full flex items-center justify-center gap-2 py-3.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold rounded-xl shadow-lg shadow-amber-500/20 transition disabled:opacity-50"
              >
                {sending ? <RefreshCw className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
                Send Telegram Broadcast Now
              </button>
            </form>
          </div>

          {/* Preview Card */}
          <div className="bg-slate-950 border border-slate-800 rounded-2xl p-5 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-4">
                <span className="text-xs font-bold text-amber-400 tracking-wider uppercase">Live Preview</span>
                <Smartphone className="w-4 h-4 text-slate-500" />
              </div>
              <div className="bg-slate-900 rounded-xl p-4 border border-slate-800 text-xs space-y-3">
                <div className="flex items-center gap-2 text-amber-400 font-bold">
                  <span>📢 THE SHANGRILA MEN RETREAT</span>
                </div>
                <p className="text-slate-300 whitespace-pre-wrap leading-relaxed">
                  {broadcastText || 'သင်၏ မက်ဆေ့ချ် စာသားများသည် ဤနေရာတွင် ပုံစံပေါ်လာမည်ဖြစ်ပါသည်...'}
                </p>
                {includeBookButton && (
                  <div className="pt-2 space-y-1.5">
                    <div className="w-full py-2 bg-amber-500/20 border border-amber-500/40 text-amber-300 font-semibold text-center rounded-lg">
                      🌟 Book Now / ဘိုကင်တင်ရန်
                    </div>
                    <div className="w-full py-2 bg-slate-800 text-slate-300 font-semibold text-center rounded-lg">
                      📞 ဆက်သွယ်ရန်
                    </div>
                  </div>
                )}
              </div>
            </div>
            <div className="mt-4 pt-3 border-t border-slate-900 text-[11px] text-slate-500 text-center">
              Bot Token Connected: {settings.botToken.substring(0, 10)}...
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Subscribers */}
      {activeTab === 'subscribers' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-slate-200">Connected Telegram Users ({subscribers.length})</h3>
            <span className="text-xs text-slate-400">Auto-synced from Customer & Staff App</span>
          </div>

          <div className="overflow-x-auto rounded-xl border border-slate-800">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-950 text-slate-400 text-xs uppercase tracking-wider border-b border-slate-800">
                <tr>
                  <th className="p-4">Name / Phone</th>
                  <th className="p-4">Telegram Username</th>
                  <th className="p-4">Role / Status</th>
                  <th className="p-4">Chat ID</th>
                  <th className="p-4">Joined Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {subscribers.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="p-8 text-center text-slate-500">
                      လက်လွတ်ချိတ်ဆက်ထားသော Subscribers မရှိသေးပါ။ Customer များ Bot ကို စတင်အသုံးပြုချိန်တွင် အလိုအလျောက် ပေါ်လာပါမည်။
                    </td>
                  </tr>
                ) : (
                  subscribers.map((sub, idx) => (
                    <tr key={idx} className="hover:bg-slate-800/30 transition">
                      <td className="p-4 font-medium text-slate-200">{sub.name}</td>
                      <td className="p-4 text-amber-400">@{sub.username || 'N/A'}</td>
                      <td className="p-4">
                        <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${sub.isVip ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' : 'bg-slate-800 text-slate-300'}`}>
                          {sub.isVip ? '🌟 VIP Member' : 'Regular User'}
                        </span>
                      </td>
                      <td className="p-4 font-mono text-xs text-slate-400">{sub.chatId}</td>
                      <td className="p-4 text-xs text-slate-500">{new Date(sub.joinedAt).toLocaleDateString()}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 3: Settings */}
      {activeTab === 'settings' && (
        <form onSubmit={handleSaveSettings} className="max-w-2xl space-y-5">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Telegram Bot API Token</label>
            <input
              type="text"
              value={settings.botToken}
              onChange={(e) => setSettings({ ...settings, botToken: e.target.value })}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-slate-100 font-mono text-sm focus:outline-none focus:border-amber-500"
              required
            />
            <p className="text-xs text-slate-500 mt-1">BotFather မှ ရရှိထားသော Token ဖြစ်ပါသည်။</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">Admin Group Chat ID</label>
              <input
                type="text"
                value={settings.adminGroupId}
                onChange={(e) => setSettings({ ...settings, adminGroupId: e.target.value })}
                placeholder="-100xxxxxxxxxx"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-slate-100 font-mono text-sm focus:outline-none focus:border-amber-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">Channel Username</label>
              <input
                type="text"
                value={settings.channelUsername}
                onChange={(e) => setSettings({ ...settings, channelUsername: e.target.value })}
                placeholder="@shangrilamenretreat"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-slate-100 font-mono text-sm focus:outline-none focus:border-amber-500"
              />
            </div>
          </div>

          <div className="pt-2">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={settings.enabled}
                onChange={(e) => setSettings({ ...settings, enabled: e.target.checked })}
                className="w-5 h-5 rounded bg-slate-950 border-slate-800 text-amber-500 focus:ring-amber-500"
              />
              <span className="text-sm font-medium text-slate-200">Enable Realtime Telegram Notifications System</span>
            </label>
          </div>

          <button
            type="submit"
            className="px-6 py-3 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl shadow-lg shadow-amber-500/20 transition"
          >
            Save Bot Settings
          </button>
        </form>
      )}

      {/* Tab 4: Logs */}
      {activeTab === 'logs' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-slate-200">Notification Delivery History</h3>
            <button
              onClick={() => { localStorage.removeItem('shangrila_telegram_logs'); setLogs([]); }}
              className="text-xs text-rose-400 hover:underline"
            >
              Clear Logs
            </button>
          </div>

          <div className="space-y-2">
            {logs.length === 0 ? (
              <div className="p-8 text-center text-slate-500 bg-slate-950 border border-slate-800 rounded-xl">
                ပြသရန် Delivery Logs များ မရှိသေးပါ။
              </div>
            ) : (
              logs.map((log, idx) => (
                <div key={idx} className="bg-slate-950 border border-slate-800 rounded-xl p-4 flex items-center justify-between text-xs">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 bg-slate-800 text-amber-400 rounded font-semibold uppercase">{log.type}</span>
                      <span className="text-slate-400 font-mono">ChatID: {log.chatId}</span>
                    </div>
                    <p className="text-slate-300 truncate max-w-xl">{log.message}</p>
                  </div>
                  <div className="text-right space-y-1">
                    <span className={`px-2.5 py-0.5 rounded-full font-semibold ${log.status === 'success' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'}`}>
                      {log.status}
                    </span>
                    <p className="text-slate-500 text-[10px]">{new Date(log.timestamp).toLocaleTimeString()}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export const TelegramGlobalBridge: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 z-50 flex items-center gap-2.5 px-4 py-3 bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-400 hover:to-blue-500 text-white font-bold rounded-full shadow-2xl shadow-sky-500/40 border border-sky-400/30 transition transform hover:scale-105"
      >
        <Bot className="w-5 h-5 animate-bounce" />
        <span className="text-sm">Telegram Noti</span>
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-4">
          <div className="relative w-full max-w-4xl max-h-[90vh] overflow-y-auto bg-slate-900 border border-amber-500/30 rounded-2xl shadow-2xl p-6">
            <button
              onClick={() => setIsOpen(false)}
              className="absolute top-4 right-4 p-2 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-200 rounded-full transition"
            >
              <X className="w-5 h-5" />
            </button>
            <TelegramNotificationCenter />
          </div>
        </div>
      )}
    </>
  );
};
