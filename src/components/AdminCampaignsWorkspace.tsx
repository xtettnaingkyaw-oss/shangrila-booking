import React, { useState, useEffect, useMemo, useRef } from 'react';
import { collection, doc, onSnapshot, setDoc, updateDoc, deleteDoc, query } from 'firebase/firestore';
import {
  Sparkles,
  PartyPopper,
  Gift,
  Copy,
  PlusCircle,
  Edit,
  Trash2,
  X,
  Calendar,
  Download,
  Search,
  CheckCircle,
  Clock,
  AlertCircle,
  MessageCircle,
  Ban,
  ChevronDown,
  Lock,
  Globe,
  ExternalLink,
} from 'lucide-react';
import { db } from '../firebase';
import { encryptText } from '../security';
import { AppData, Booking, formatPrice } from '../shared';

export interface SavedCampaignCard {
  id: string;
  campaignTitle: string;
  boxTitle: string;
  isPopupActive: boolean;
  isBoxActive: boolean;
  hotelDiscountPercent: number;
  otherDiscountPercent: number;
  startDate: string;
  endDate: string;
  themeColor?: string;
  badgeText?: string;
  updatedAt: number;
}

const DEFAULT_SAVED_CAMPAIGNS: SavedCampaignCard[] = [
  {
    id: 'camp_thadingyut',
    campaignTitle: 'သီတင်းကျွတ် အထူးပရိုမိုးရှင်း',
    boxTitle: 'SPECIAL PROMO',
    isPopupActive: false,
    isBoxActive: false,
    hotelDiscountPercent: 10,
    otherDiscountPercent: 20,
    startDate: '2026-10-01',
    endDate: '2026-10-31',
    themeColor: 'from-amber-900 via-[#2a1808] to-[#140b03]',
    badgeText: 'LANTERN FESTIVAL',
    updatedAt: Date.now(),
  },
  {
    id: 'camp_tazaungdaing',
    campaignTitle: 'တန်ဆောင်တိုင် အထူးပရိုမိုးရှင်း',
    boxTitle: 'TAZAUNGDAING SPECIAL',
    isPopupActive: false,
    isBoxActive: false,
    hotelDiscountPercent: 10,
    otherDiscountPercent: 20,
    startDate: '2026-11-15',
    endDate: '2026-11-30',
    themeColor: 'from-[#123524] via-[#0B2419] to-[#06150e]',
    badgeText: 'FESTIVAL OF LIGHTS',
    updatedAt: Date.now(),
  },
  {
    id: 'camp_newyear',
    campaignTitle: 'နှစ်သစ်ကူး အထူးပရိုမိုးရှင်း (New Year Special)',
    boxTitle: 'NEW YEAR PROMO',
    isPopupActive: false,
    isBoxActive: false,
    hotelDiscountPercent: 10,
    otherDiscountPercent: 25,
    startDate: '2026-12-20',
    endDate: '2027-01-05',
    themeColor: 'from-emerald-950 via-[#123524] to-[#091e14]',
    badgeText: 'YEAR END SALE',
    updatedAt: Date.now(),
  },
];

const THEME_PRESETS = [
  { label: 'Emerald Gold', value: 'from-[#123524] via-[#0B2419] to-[#06150e]', swatch: 'bg-[#123524]' },
  { label: 'Lantern Amber', value: 'from-amber-900 via-[#2a1808] to-[#140b03]', swatch: 'bg-amber-900' },
  { label: 'Deep Forest', value: 'from-emerald-950 via-[#123524] to-[#091e14]', swatch: 'bg-emerald-950' },
  { label: 'Royal Slate', value: 'from-slate-900 via-slate-800 to-slate-950', swatch: 'bg-slate-900' },
];

const SUBTAB_STORAGE_KEY = 'shangrila_admin_campaigns_subtab';

const getLocalTodayStr = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const addDaysToDateStr = (days: number) => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const normalizeMyanmarPhone = (phone: string): string => {
  if (!phone) return '';
  let digits = String(phone).replace(/[^0-9]/g, '');
  if (digits.startsWith('959')) digits = '09' + digits.slice(3);
  return digits;
};

const isCampaignRewardUsedByCompletedService = (
  winnerPhone: string,
  winDate: string,
  allBookings: Booking[]
): { isUsed: boolean; completedBooking?: Booking; activePendingBooking?: Booking } => {
  const normWinPhone = normalizeMyanmarPhone(winnerPhone);
  if (!normWinPhone || normWinPhone.length < 7) return { isUsed: false };

  let completedBooking: Booking | undefined;
  let activePendingBooking: Booking | undefined;

  for (const b of allBookings) {
    if (!b || b.status === 'cancelled') continue;
    const normBPhone = normalizeMyanmarPhone(b.phone || '');
    if (normBPhone !== normWinPhone) continue;

    const submittedDateStr = b.createdAt
      ? (() => {
          const d = new Date(b.createdAt);
          return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        })()
      : '';

    const isSameDayOrAfterWin =
      b.date === winDate ||
      submittedDateStr === winDate ||
      (b.date >= winDate && submittedDateStr >= winDate);

    if (!isSameDayOrAfterWin) continue;

    if ((Number(b.totalPrice) || 0) <= 0 || Boolean((b as any).isAdminClockIn) || Boolean((b as any).isStaffClockIn)) {
      continue;
    }

    if (b.status === 'completed') {
      completedBooking = b;
      break;
    } else if (!activePendingBooking) {
      activePendingBooking = b;
    }
  }

  return {
    isUsed: Boolean(completedBooking),
    completedBooking,
    activePendingBooking,
  };
};

const safeCopyText = async (text: string): Promise<boolean> => {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // fallback
  }
  try {
    const el = document.createElement('textarea');
    el.value = text;
    el.style.position = 'fixed';
    el.style.opacity = '0';
    document.body.appendChild(el);
    el.select();
    document.execCommand('copy');
    document.body.removeChild(el);
    return true;
  } catch {
    return false;
  }
};

interface ToastState {
  type: 'success' | 'error' | 'info';
  message: string;
}

interface ConfirmDialogState {
  title: string;
  message: string;
  confirmLabel: string;
  secondaryLabel?: string;
  tone: 'danger' | 'primary';
  onConfirm: () => void | Promise<void>;
  onSecondary?: () => void | Promise<void>;
}

export function AdminCampaignsWorkspace({
  bookings = [],
  adminRole = 'super_admin',
  appData,
  onSettingsUpdated,
}: {
  bookings?: Booking[];
  adminRole?: string;
  appData?: AppData;
  onSettingsUpdated?: (data: AppData) => void;
}) {
  const todayStr = getLocalTodayStr();

  const [subView, setSubView] = useState<'cards_studio' | 'winners_tracker'>(() => {
    try {
      const saved = sessionStorage.getItem(SUBTAB_STORAGE_KEY);
      if (saved === 'cards_studio' || saved === 'winners_tracker') return saved;
    } catch {
      // ignore
    }
    return 'cards_studio';
  });

  const handleSetSubView = (view: 'cards_studio' | 'winners_tracker') => {
    setSubView(view);
    try {
      sessionStorage.setItem(SUBTAB_STORAGE_KEY, view);
    } catch {
      // ignore
    }
  };

  // Toast & In-App Confirm Dialog
  const [toast, setToast] = useState<ToastState | null>(null);
  const toastTimerRef = useRef<number | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialogState | null>(null);
  const [confirmBusy, setConfirmBusy] = useState(false);

  const showToast = (message: string, type: ToastState['type'] = 'success') => {
    setToast({ message, type });
    if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
    toastTimerRef.current = window.setTimeout(() => setToast(null), 3800);
  };

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
    };
  }, []);

  // ============================================================================
  // PART 1: PROMOTION & CAMPAIGN CARDS STUDIO
  // ============================================================================
  const [campaignCards, setCampaignCards] = useState<SavedCampaignCard[]>(DEFAULT_SAVED_CAMPAIGNS);
  const [expandedCards, setExpandedCards] = useState<Record<string, boolean>>({});
  const [livePromotion, setLivePromotion] = useState<any>(() => {
    return (
      appData?.promotion || {
        isActive: false,
        isBoxActive: false,
        boxTitle: 'SPECIAL PROMO',
        isPopupActive: false,
        campaignTitle: 'သီတင်းကျွတ် အထူးပရိုမိုးရှင်း',
        hotelDiscountPercent: 10,
        otherDiscountPercent: 20,
        startDate: '',
        endDate: '',
      }
    );
  });
  const [savingPromoId, setSavingPromoId] = useState<string | null>(null);
  const [editingCard, setEditingCard] = useState<SavedCampaignCard | null>(null);
  const [showCreateModal, setShowCreateModal] = useState<boolean>(false);
  const [newCardForm, setNewCardForm] = useState<SavedCampaignCard>({
    id: '',
    campaignTitle: '',
    boxTitle: 'SPECIAL DISCOUNT',
    isPopupActive: false,
    isBoxActive: false,
    hotelDiscountPercent: 10,
    otherDiscountPercent: 20,
    startDate: todayStr,
    endDate: addDaysToDateStr(14),
    themeColor: 'from-[#123524] via-[#0B2419] to-[#06150e]',
    badgeText: 'EXCLUSIVE EVENT',
    updatedAt: Date.now(),
  });

  // Real-time sync with settings/appData
  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'settings', 'appData'), (snap) => {
      if (!snap.exists()) return;
      const data = snap.data();
      if (data.promotion) {
        setLivePromotion(data.promotion);
      }
      if (Array.isArray(data.savedCampaignCards) && data.savedCampaignCards.length > 0) {
        setCampaignCards(data.savedCampaignCards);
        // Auto-expand any active card on initial load
        const liveCard = data.savedCampaignCards.find((c: SavedCampaignCard) => c.isPopupActive || c.isBoxActive);
        if (liveCard) {
          setExpandedCards((prev) => (Object.keys(prev).length === 0 ? { [liveCard.id]: true } : prev));
        }
      } else {
        const curPromo = data.promotion || {};
        const initialized = DEFAULT_SAVED_CAMPAIGNS.map((c, idx) => {
          if (idx === 0 && curPromo.campaignTitle) {
            return {
              ...c,
              campaignTitle: curPromo.campaignTitle || c.campaignTitle,
              boxTitle: curPromo.boxTitle || c.boxTitle,
              isPopupActive: Boolean(curPromo.isPopupActive),
              isBoxActive: Boolean(curPromo.isBoxActive),
              hotelDiscountPercent: Number(curPromo.hotelDiscountPercent ?? c.hotelDiscountPercent),
              otherDiscountPercent: Number(curPromo.otherDiscountPercent ?? c.otherDiscountPercent),
              startDate: curPromo.startDate || c.startDate,
              endDate: curPromo.endDate || c.endDate,
            };
          }
          return c;
        });
        setCampaignCards(initialized);
      }
    });
    return () => unsub();
  }, []);

  const syncCampaignStateToFirestore = async (
    updatedCards: SavedCampaignCard[],
    activeCardToPublish: SavedCampaignCard | null,
    actionId: string,
    toastMessage?: string
  ) => {
    setSavingPromoId(actionId);
    try {
      const nextPromotionPayload = activeCardToPublish
        ? {
            isActive: Boolean(activeCardToPublish.isPopupActive || activeCardToPublish.isBoxActive),
            allOff: false,
            isPopupActive: Boolean(activeCardToPublish.isPopupActive),
            isBoxActive: Boolean(activeCardToPublish.isBoxActive),
            campaignTitle: activeCardToPublish.campaignTitle.trim(),
            boxTitle: activeCardToPublish.boxTitle.trim() || 'SPECIAL PROMO',
            title: activeCardToPublish.boxTitle.trim() || 'SPECIAL PROMO',
            hotelDiscountPercent: Number(activeCardToPublish.hotelDiscountPercent) || 0,
            otherDiscountPercent: Number(activeCardToPublish.otherDiscountPercent) || 0,
            startDate: activeCardToPublish.startDate || '',
            endDate: activeCardToPublish.endDate || '',
            activeCampaignId: activeCardToPublish.id,
            updatedAt: Date.now(),
          }
        : {
            isActive: false,
            allOff: true,
            isPopupActive: false,
            isBoxActive: false,
            campaignTitle: livePromotion.campaignTitle || 'သီတင်းကျွတ် အထူးပရိုမိုးရှင်း',
            boxTitle: livePromotion.boxTitle || 'SPECIAL PROMO',
            title: livePromotion.boxTitle || 'SPECIAL PROMO',
            hotelDiscountPercent: 0,
            otherDiscountPercent: 0,
            startDate: '1970-01-01',
            endDate: '1970-01-01',
            activeCampaignId: '',
            updatedAt: Date.now(),
          };

      await setDoc(
        doc(db, 'settings', 'appData'),
        {
          promotion: nextPromotionPayload,
          savedCampaignCards: updatedCards,
        },
        { merge: true }
      );

      setLivePromotion(nextPromotionPayload);
      setCampaignCards(updatedCards);

      if (appData && onSettingsUpdated) {
        onSettingsUpdated({
          ...appData,
          promotion: nextPromotionPayload,
          savedCampaignCards: updatedCards,
        });
      }

      if (toastMessage) showToast(toastMessage, 'success');
    } catch (err) {
      console.error('Error syncing campaign:', err);
      showToast('Campaign အပြောင်းအလဲ သိမ်းဆည်းရာတွင် အမှားအယွင်းရှိနေပါသည်။', 'error');
    } finally {
      setSavingPromoId(null);
    }
  };

  const executeToggleCardChannel = async (
    card: SavedCampaignCard,
    channel: 'popup' | 'box' | 'master_toggle',
    overrideDates?: { startDate: string; endDate: string }
  ) => {
    let nextPopup = card.isPopupActive;
    let nextBox = card.isBoxActive;

    if (channel === 'popup') {
      nextPopup = !card.isPopupActive;
    } else if (channel === 'box') {
      nextBox = !card.isBoxActive;
    } else {
      const currentlyAnyOn = card.isPopupActive || card.isBoxActive;
      nextPopup = !currentlyAnyOn;
      nextBox = !currentlyAnyOn;
    }

    const updatedTargetCard: SavedCampaignCard = {
      ...card,
      ...(overrideDates || {}),
      isPopupActive: nextPopup,
      isBoxActive: nextBox,
      updatedAt: Date.now(),
    };

    const isTurningOn = nextPopup || nextBox;
    const nextCardsList = campaignCards.map((c) => {
      if (c.id === card.id) return updatedTargetCard;
      if (isTurningOn) return { ...c, isPopupActive: false, isBoxActive: false };
      return c;
    });

    if (isTurningOn) {
      setExpandedCards((prev) => ({ ...prev, [card.id]: true }));
    }

    const anyActiveCard = nextCardsList.find((c) => c.isPopupActive || c.isBoxActive) || null;
    const msg = isTurningOn
      ? `"${card.campaignTitle}" ကို Customer App တွင် ဖွင့်လိုက်ပါပြီ။`
      : `"${card.campaignTitle}" ကို ပိတ်လိုက်ပါပြီ။`;
    await syncCampaignStateToFirestore(nextCardsList, anyActiveCard, card.id, msg);
  };

  // Smart Date-Expiry Guard when activating an expired card
  const handleToggleCardChannel = (card: SavedCampaignCard, channel: 'popup' | 'box' | 'master_toggle') => {
    const willTurnOn =
      channel === 'popup'
        ? !card.isPopupActive
        : channel === 'box'
        ? !card.isBoxActive
        : !(card.isPopupActive || card.isBoxActive);

    const isCardDateExpired = Boolean(card.endDate && card.endDate < todayStr);
    if (willTurnOn && isCardDateExpired) {
      const extendedEnd = addDaysToDateStr(14);
      setConfirmDialog({
        title: 'Campaign ရက်စွဲ သက်တမ်းကုန်နေပါသည်',
        message: `"${card.campaignTitle}" ၏ ပြီးဆုံးရက် (${card.endDate}) သည် ကျော်လွန်သွားပြီဖြစ်သဖြင့် ယခုအတိုင်းဖွင့်ပါက Customer App တွင် ပေါ်လာမည်မဟုတ်ပါ။ ယနေ့ (${todayStr}) မှ ${extendedEnd} အထိ ရက်တိုးပြီး ချက်ချင်းဖွင့်မည်လား?`,
        confirmLabel: 'ရက်တိုးပြီး ဖွင့်မည်',
        secondaryLabel: 'ရက်စွဲကိုယ်တိုင်ပြင်မည်',
        tone: 'primary',
        onConfirm: async () => {
          await executeToggleCardChannel(card, channel, {
            startDate: todayStr,
            endDate: extendedEnd,
          });
        },
        onSecondary: () => {
          setEditingCard({
            ...card,
            startDate: todayStr,
            endDate: extendedEnd,
            isPopupActive: channel === 'popup' || channel === 'master_toggle' ? true : card.isPopupActive,
            isBoxActive: channel === 'box' || channel === 'master_toggle' ? true : card.isBoxActive,
          });
        },
      });
      return;
    }

    executeToggleCardChannel(card, channel);
  };

  const handleTurnOffAllPromotionsNow = () => {
    setConfirmDialog({
      title: 'Popup နှင့် Promo အားလုံး ပိတ်မည်လား?',
      message: 'Customer App နှင့် POS တွင် ဖွင့်ထားသော Popup Game နှင့် Promotion Box အားလုံးကို ချက်ချင်း ပိတ်သိမ်းမည် သေချာပါသလား?',
      confirmLabel: 'အားလုံးပိတ်မည်',
      tone: 'danger',
      onConfirm: async () => {
        const allOffCards = campaignCards.map((c) => ({
          ...c,
          isPopupActive: false,
          isBoxActive: false,
        }));
        await syncCampaignStateToFirestore(
          allOffCards,
          null,
          'turn_off_all',
          'Promotion နှင့် Popup အားလုံးကို Customer App တွင် ချက်ချင်းပိတ်လိုက်ပါပြီ။'
        );
      },
    });
  };

  const handleSaveEditedCard = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCard || !editingCard.campaignTitle.trim()) return;

    const updatedCard: SavedCampaignCard = {
      ...editingCard,
      campaignTitle: editingCard.campaignTitle.trim(),
      boxTitle: editingCard.boxTitle.trim() || 'SPECIAL PROMO',
      hotelDiscountPercent: Number(editingCard.hotelDiscountPercent) || 0,
      otherDiscountPercent: Number(editingCard.otherDiscountPercent) || 0,
      updatedAt: Date.now(),
    };

    const isThisCardActive = updatedCard.isPopupActive || updatedCard.isBoxActive;
    const nextCardsList = campaignCards.map((c) => {
      if (c.id === updatedCard.id) return updatedCard;
      if (isThisCardActive) return { ...c, isPopupActive: false, isBoxActive: false };
      return c;
    });

    const activeCard = nextCardsList.find((c) => c.isPopupActive || c.isBoxActive) || null;
    await syncCampaignStateToFirestore(
      nextCardsList,
      activeCard,
      updatedCard.id,
      `"${updatedCard.campaignTitle}" ပြင်ဆင်ချက်များ သိမ်းဆည်းပြီးပါပြီ။`
    );
    setEditingCard(null);
  };

  const handleCreateNewCard = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCardForm.campaignTitle.trim()) return;

    const created: SavedCampaignCard = {
      ...newCardForm,
      id: `camp_${Date.now()}`,
      campaignTitle: newCardForm.campaignTitle.trim(),
      boxTitle: newCardForm.boxTitle.trim() || 'SPECIAL PROMO',
      hotelDiscountPercent: Number(newCardForm.hotelDiscountPercent) || 0,
      otherDiscountPercent: Number(newCardForm.otherDiscountPercent) || 0,
      updatedAt: Date.now(),
    };

    const isTurningOn = created.isPopupActive || created.isBoxActive;
    const baseList = isTurningOn
      ? campaignCards.map((c) => ({ ...c, isPopupActive: false, isBoxActive: false }))
      : [...campaignCards];

    const nextCardsList = [created, ...baseList];
    const activeCard = nextCardsList.find((c) => c.isPopupActive || c.isBoxActive) || null;
    await syncCampaignStateToFirestore(
      nextCardsList,
      activeCard,
      created.id,
      `"${created.campaignTitle}" ကဒ်အသစ် ဖန်တီးပြီးပါပြီ။`
    );

    setExpandedCards((prev) => ({ ...prev, [created.id]: true }));
    setShowCreateModal(false);
    setNewCardForm({
      id: '',
      campaignTitle: '',
      boxTitle: 'SPECIAL DISCOUNT',
      isPopupActive: false,
      isBoxActive: false,
      hotelDiscountPercent: 10,
      otherDiscountPercent: 20,
      startDate: todayStr,
      endDate: addDaysToDateStr(14),
      themeColor: 'from-[#123524] via-[#0B2419] to-[#06150e]',
      badgeText: 'EXCLUSIVE EVENT',
      updatedAt: Date.now(),
    });
  };

  const handleDeleteCampaignCard = (card: SavedCampaignCard) => {
    if (campaignCards.length <= 1) {
      showToast('အနည်းဆုံး Campaign ကဒ် (၁) ခု ချန်ထားရပါမည်။', 'error');
      return;
    }
    setConfirmDialog({
      title: 'Campaign ကဒ်ကို ဖျက်မည်လား?',
      message: `"${card.campaignTitle}" ကဒ်ကို စာရင်းမှ အပြီးတိုင် ဖျက်မည် သေချာပါသလား?`,
      confirmLabel: 'ဖျက်မည် (Delete)',
      tone: 'danger',
      onConfirm: async () => {
        const nextCardsList = campaignCards.filter((c) => c.id !== card.id);
        const activeCard = nextCardsList.find((c) => c.isPopupActive || c.isBoxActive) || null;
        await syncCampaignStateToFirestore(
          nextCardsList,
          activeCard,
          card.id,
          `"${card.campaignTitle}" ကို ဖျက်လိုက်ပါပြီ။`
        );
      },
    });
  };

  // ============================================================================
  // PART 2: GAME WINNERS & USAGE TRACKER
  // ============================================================================
  const [records, setRecords] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active_unused' | 'used_completed' | 'expired'>('all');
  const [dateFilterMode, setDateFilterMode] = useState<'all' | 'today' | 'yesterday' | 'this_month' | 'custom_range'>('all');
  const [fromDate, setFromDate] = useState<string>(todayStr);
  const [toDate, setToDate] = useState<string>(todayStr);
  const [applyingBookingId, setApplyingBookingId] = useState<string | null>(null);

  const getYesterdayStr = () => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };

  const getThisMonthPrefix = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  };

  const formatReadableDateHeader = (dateStr: string) => {
    if (!dateStr) return 'Unknown Date';
    const yesterday = getYesterdayStr();
    const [y, m, d] = dateStr.split('-').map(Number);
    if (!y || !m || !d) return dateStr;
    const dt = new Date(y, m - 1, d);
    const formatted = dt.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
    if (dateStr === todayStr) return `ယနေ့ (Today) — ${formatted}`;
    if (dateStr === yesterday) return `မနေ့က (Yesterday) — ${formatted}`;
    return formatted;
  };

  useEffect(() => {
    const q = query(collection(db, 'campaign_records'));
    const unsub = onSnapshot(
      q,
      (snap) => {
        const data: any[] = [];
        snap.forEach((d) => {
          const raw = d.data();
          const rawDate = String(raw.date || '').trim();
          const cleanDate = rawDate.match(/^(\d{4}-\d{2}-\d{2})/)
            ? rawDate.match(/^(\d{4}-\d{2}-\d{2})/)![1]
            : raw.createdAt
            ? (() => {
                const dt = new Date(raw.createdAt);
                return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
              })()
            : todayStr;

          data.push({
            id: d.id,
            ...raw,
            cleanDate,
            phone: String(raw.phone || '').trim(),
            discountPercent: Number(raw.discountPercent) || 0,
          });
        });
        data.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
        setRecords(data);
        setLoading(false);
      },
      () => setLoading(false)
    );
    return () => unsub();
  }, [todayStr]);

  const enrichedRecords = useMemo(() => {
    return records.map((r) => {
      const usage = isCampaignRewardUsedByCompletedService(r.phone, r.cleanDate, bookings);
      let rewardStatus: 'used_completed' | 'active_unused' | 'expired' = 'active_unused';

      if (usage.isUsed) {
        rewardStatus = 'used_completed';
      } else if (r.cleanDate < todayStr) {
        rewardStatus = 'expired';
      } else {
        rewardStatus = 'active_unused';
      }

      const activeBookingNeedsDiscount =
        usage.activePendingBooking &&
        (!usage.activePendingBooking.discountPercent || usage.activePendingBooking.discountPercent === 0) &&
        r.discountPercent > 0;

      return {
        ...r,
        rewardStatus,
        completedBooking: usage.completedBooking,
        activePendingBooking: usage.activePendingBooking,
        activeBookingNeedsDiscount,
      };
    });
  }, [records, bookings, todayStr]);

  const dateAndSearchFiltered = useMemo(() => {
    const yesterday = getYesterdayStr();
    const thisMonthPrefix = getThisMonthPrefix();
    const q = search.trim().toLowerCase();

    return enrichedRecords.filter((r) => {
      const d = r.cleanDate || todayStr;
      if (dateFilterMode === 'today' && d !== todayStr) return false;
      if (dateFilterMode === 'yesterday' && d !== yesterday) return false;
      if (dateFilterMode === 'this_month' && !d.startsWith(thisMonthPrefix)) return false;
      if (dateFilterMode === 'custom_range') {
        const start = fromDate && toDate && fromDate > toDate ? toDate : fromDate;
        const end = fromDate && toDate && fromDate > toDate ? fromDate : toDate;
        if (start && d < start) return false;
        if (end && d > end) return false;
      }

      if (q) {
        const matchPhone = String(r.phone || '').toLowerCase().includes(q);
        const matchPct = `${r.discountPercent}%`.includes(q);
        const matchCustName =
          (r.completedBooking?.name || '').toLowerCase().includes(q) ||
          (r.activePendingBooking?.name || '').toLowerCase().includes(q);
        if (!matchPhone && !matchPct && !matchCustName) return false;
      }
      return true;
    });
  }, [enrichedRecords, dateFilterMode, fromDate, toDate, search, todayStr]);

  const finalFilteredRecords = useMemo(() => {
    if (statusFilter === 'all') return dateAndSearchFiltered;
    return dateAndSearchFiltered.filter((r) => r.rewardStatus === statusFilter);
  }, [dateAndSearchFiltered, statusFilter]);

  const summaryStats = useMemo(() => {
    let total = dateAndSearchFiltered.length;
    let usedCount = 0;
    let activeCount = 0;
    let expiredCount = 0;

    dateAndSearchFiltered.forEach((r) => {
      if (r.rewardStatus === 'used_completed') usedCount++;
      else if (r.rewardStatus === 'active_unused') activeCount++;
      else expiredCount++;
    });

    return { total, usedCount, activeCount, expiredCount };
  }, [dateAndSearchFiltered]);

  const groupedByDate = useMemo(() => {
    const map = new Map<
      string,
      { date: string; items: any[]; usedCount: number; activeCount: number; expiredCount: number }
    >();

    finalFilteredRecords.forEach((r) => {
      const d = r.cleanDate || todayStr;
      if (!map.has(d)) {
        map.set(d, { date: d, items: [], usedCount: 0, activeCount: 0, expiredCount: 0 });
      }
      const grp = map.get(d)!;
      grp.items.push(r);
      if (r.rewardStatus === 'used_completed') grp.usedCount++;
      else if (r.rewardStatus === 'active_unused') grp.activeCount++;
      else grp.expiredCount++;
    });

    return Array.from(map.values()).sort((a, b) => b.date.localeCompare(a.date));
  }, [finalFilteredRecords, todayStr]);

  const handleApplyCampaignDiscountToBooking = (winnerRecord: any, targetBooking: Booking) => {
    if (!targetBooking.id) return;
    const svcStr = String(targetBooking.service || '').toLowerCase();
    const isOutcall =
      svcStr.includes('outcall') ||
      svcStr.includes('hotel') ||
      svcStr.includes('half day') ||
      svcStr.includes('whole');

    const appliedPct = isOutcall ? Math.min(10, winnerRecord.discountPercent) : winnerRecord.discountPercent;
    const origPrice = Number(targetBooking.originalPrice) || Number(targetBooking.totalPrice) || 0;
    const discountedTotal = Math.round(origPrice * (1 - appliedPct / 100));
    const labelText = `Campaign Winner Bonus (${appliedPct}% OFF)`;

    setConfirmDialog({
      title: `Booking တွင် ${appliedPct}% OFF ထည့်မည်လား?`,
      message: `${targetBooking.name} (${winnerRecord.phone}) ၏ မူရင်းကျသင့်ငွေ ${formatPrice(origPrice)} မှ ${appliedPct}% လျှော့၍ ${formatPrice(discountedTotal)} သို့ ပြင်ဆင်မည် သေချာပါသလား?`,
      confirmLabel: `${appliedPct}% OFF ထည့်မည်`,
      tone: 'primary',
      onConfirm: async () => {
        setApplyingBookingId(targetBooking.id!);
        try {
          const isDep = (targetBooking as any).paymentStatus === 'deposit_only';
          const depPaid = Number((targetBooking as any).depositPaid) || 0;
          const newBalanceDue = isDep ? Math.max(0, discountedTotal - depPaid) : 0;

          await updateDoc(doc(db, 'bookings', targetBooking.id!), {
            originalPrice: encryptText(String(origPrice)),
            discountPercent: encryptText(String(appliedPct)),
            discountLabel: encryptText(labelText),
            totalPrice: discountedTotal,
            ...(isDep ? { balanceDue: newBalanceDue } : {}),
          });
          showToast(`${targetBooking.name} ၏ Booking အား ${appliedPct}% OFF (${formatPrice(discountedTotal)}) ပြင်ဆင်ပြီးပါပြီ။`, 'success');
        } catch {
          showToast('Discount ထည့်သွင်းရာတွင် အမှားအယွင်းရှိနေပါသည်။', 'error');
        } finally {
          setApplyingBookingId(null);
        }
      },
    });
  };

  const handleContactUser = (phone: string, discount: number) => {
    if (!phone) return;
    let formattedPhone = phone.replace(/[^0-9+]/g, '');
    if (formattedPhone.startsWith('09')) {
      formattedPhone = '+959' + formattedPhone.substring(2);
    } else if (!formattedPhone.startsWith('+')) {
      formattedPhone = '+' + formattedPhone;
    }
    const msg = encodeURIComponent(
      `မင်္ဂလာပါခင်ဗျာ။ The Shangri-La Men's Retreat မှ ဆက်သွယ်တာပါ။ \nလူကြီးမင်း ကံထူးရရှိထားသော အထူး Discount (${discount}% OFF) အား ယနေ့အတွင်း လာရောက်အသုံးပြုနိုင်ပါပြီခင်ဗျာ။`
    );
    const tgUrl = `https://t.me/${formattedPhone}?text=${msg}`;
    const a = document.createElement('a');
    a.href = tgUrl;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    a.click();
  };

  const handleDeleteRecord = (id: string, phone: string) => {
    if (adminRole !== 'super_admin') {
      showToast('Super Admin သာလျှင် ဖျက်ခွင့်ရှိပါသည်။', 'error');
      return;
    }
    setConfirmDialog({
      title: 'မဲပေါက်မှတ်တမ်း ဖျက်မည်လား?',
      message: `ဖုန်းနံပါတ် [${phone}] ၏ မဲပေါက်မှတ်တမ်းကို အပြီးတိုင် ဖျက်မည် သေချာပါသလား?`,
      confirmLabel: 'ဖျက်မည်',
      tone: 'danger',
      onConfirm: async () => {
        await deleteDoc(doc(db, 'campaign_records', id));
        showToast('မဲပေါက်မှတ်တမ်း ဖျက်ပြီးပါပြီ။', 'success');
      },
    });
  };

  const handleExportCSV = () => {
    const headers = [
      'Winning Date',
      'Phone Number',
      'Customer Name',
      'Discount Won (%)',
      'Reward Status',
      'Booking / Receipt Status',
      'Invoice / TxID',
      'Contact Source',
    ];
    const rows = finalFilteredRecords.map((r) => {
      const statusText =
        r.rewardStatus === 'used_completed'
          ? 'သုံးပြီးပြီ (Used - Service Completed)'
          : r.rewardStatus === 'active_unused'
          ? 'မသုံးရသေး (Active Today)'
          : 'သက်တမ်းကုန်ဆုံး (Expired - 1 Day Passed)';
      const linkedB = r.completedBooking || r.activePendingBooking;
      return [
        `"${r.cleanDate}"`,
        `"${r.phone}"`,
        `"${linkedB?.name || '-'}"`,
        `${r.discountPercent}%`,
        `"${statusText}"`,
        `"${linkedB ? linkedB.status.toUpperCase() : 'No Booking'}"`,
        `"${linkedB?.txId || '-'}"`,
        `"${r.telegramClicked ? 'Telegram' : 'App Only'}"`,
      ];
    });
    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `Campaign_Winners_Report_${todayStr}.csv`;
    link.click();
    showToast('Excel/CSV Report ဒေါင်းလုဒ်ဆွဲပြီးပါပြီ။', 'success');
  };

  const isAnyGlobalPromoLive = Boolean(
    !livePromotion?.allOff && (livePromotion?.isPopupActive || livePromotion?.isBoxActive || livePromotion?.isActive)
  );
  const isLivePromoExpired = Boolean(
    isAnyGlobalPromoLive && livePromotion?.endDate && livePromotion.endDate < todayStr
  );
  const activeCardObj = campaignCards.find((c) => c.isPopupActive || c.isBoxActive) || null;
  const allCardsExpanded = campaignCards.length > 0 && campaignCards.every((c) => expandedCards[c.id]);

  return (
    <div className="space-y-4 sm:space-y-5 animate-fade-in pb-10">
      {/* =========================================================================
          1. EXECUTIVE PROMOTION CONTROL HEADER (SINGLE-ELEVATION, ZERO CLUTTER)
         ========================================================================= */}
      <div className="bg-gradient-to-br from-[#0B2419] via-[#123524] to-[#0B2419] rounded-2xl sm:rounded-3xl p-4 sm:p-6 text-white shadow-md border border-[#C8A951]/25 relative overflow-hidden">
        <div className="absolute -right-12 -top-12 w-44 h-44 rounded-full bg-[#C8A951]/10 blur-2xl pointer-events-none" />

        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3.5 pb-4 border-b border-white/10">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[11px] font-semibold text-gray-300">
              <span className="text-[#D4AF37] uppercase tracking-wider font-bold">Promotion Hub</span>
              <span className="text-white/30">·</span>
              <span className="inline-flex items-center gap-1.5">
                <span
                  className={`w-2 h-2 rounded-full ${
                    isAnyGlobalPromoLive
                      ? isLivePromoExpired
                        ? 'bg-amber-400'
                        : 'bg-emerald-400 animate-pulse'
                      : 'bg-gray-400'
                  }`}
                />
                <span
                  className={
                    isAnyGlobalPromoLive
                      ? isLivePromoExpired
                        ? 'text-amber-300 font-bold'
                        : 'text-emerald-300 font-bold'
                      : 'text-gray-300 font-bold'
                  }
                >
                  {isAnyGlobalPromoLive
                    ? isLivePromoExpired
                      ? 'Active (Date Expired)'
                      : 'Live on Customer App'
                    : 'All OFF'}
                </span>
              </span>
            </div>

            <h2 className="text-lg sm:text-2xl font-serif font-bold text-[#D4AF37] tracking-tight mt-1 flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-[#D4AF37] shrink-0" />
              <span className="truncate">Promotion & Campaigns</span>
            </h2>

            <p className="text-xs text-gray-300 mt-1">
              {isAnyGlobalPromoLive
                ? `လက်ရှိဖွင့်ထားသည်: ${livePromotion?.campaignTitle || 'Active Promotion'}`
                : 'Customer App တွင် Promotion နှင့် Mini Game Popup အားလုံး ပိတ်ထားပါသည်'}
            </p>
          </div>

          {/* Only show Emergency Turn-Off when a campaign is actually LIVE */}
          {isAnyGlobalPromoLive && (
            <button
              type="button"
              disabled={savingPromoId === 'turn_off_all'}
              onClick={handleTurnOffAllPromotionsNow}
              className="w-full sm:w-auto min-h-[42px] px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-black shadow-sm transition flex items-center justify-center gap-2 shrink-0"
            >
              <Ban className="w-4 h-4 shrink-0" />
              <span>{savingPromoId === 'turn_off_all' ? 'Turning Off...' : 'Popup နှင့် Promo အားလုံးပိတ်မည်'}</span>
            </button>
          )}
        </div>

        {/* Expired Live Campaign Warning */}
        {isLivePromoExpired && (
          <div className="mt-3.5 p-3 rounded-xl bg-amber-500/15 border border-amber-400/40 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-xs">
            <div className="flex items-start gap-2 text-amber-100">
              <AlertCircle className="w-4 h-4 text-amber-300 shrink-0 mt-0.5" />
              <span>
                လက်ရှိဖွင့်ထားသော Campaign ၏ ပြီးဆုံးရက် (<strong>{livePromotion?.endDate}</strong>) ကျော်လွန်နေသဖြင့် Customer App တွင် ပေါ်မည်မဟုတ်ပါ။
              </span>
            </div>
            {activeCardObj && (
              <button
                type="button"
                onClick={() => setEditingCard(activeCardObj)}
                className="self-start sm:self-auto px-3 py-1.5 rounded-lg bg-[#D4AF37] text-[#0B2419] font-black text-[11px] shrink-0"
              >
                ရက်စွဲပြင်မည်
              </button>
            )}
          </div>
        )}

        {/* 4 Clean Status Tiles */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 pt-4">
          <div className="bg-black/20 border border-white/10 rounded-xl p-3">
            <div className="text-[10px] font-bold text-gray-300 uppercase tracking-wider">Mini Game Popup</div>
            <div
              className={`text-base sm:text-lg font-black mt-0.5 ${
                livePromotion?.isPopupActive && !livePromotion?.allOff ? 'text-emerald-400' : 'text-gray-400'
              }`}
            >
              {livePromotion?.isPopupActive && !livePromotion?.allOff ? 'ON (ဖွင့်ထား)' : 'OFF'}
            </div>
          </div>

          <div className="bg-black/20 border border-white/10 rounded-xl p-3">
            <div className="text-[10px] font-bold text-gray-300 uppercase tracking-wider">Booking Promo Box</div>
            <div
              className={`text-base sm:text-lg font-black mt-0.5 ${
                livePromotion?.isBoxActive && !livePromotion?.allOff ? 'text-emerald-400' : 'text-gray-400'
              }`}
            >
              {livePromotion?.isBoxActive && !livePromotion?.allOff ? 'ON (ဖွင့်ထား)' : 'OFF'}
            </div>
          </div>

          <div className="bg-black/20 border border-white/10 rounded-xl p-3">
            <div className="text-[10px] font-bold text-gray-300 uppercase tracking-wider">Active Discounts</div>
            <div className="text-base sm:text-lg font-black text-[#D4AF37] mt-0.5 tabular-nums">
              {isAnyGlobalPromoLive
                ? `${livePromotion?.otherDiscountPercent || 0}% / ${livePromotion?.hotelDiscountPercent || 0}%`
                : '0% / 0%'}
            </div>
            <div className="text-[10px] text-gray-400">In-Spa · Outcall</div>
          </div>

          <button
            type="button"
            onClick={() => handleSetSubView('winners_tracker')}
            className="text-left bg-black/20 hover:bg-black/30 border border-white/10 rounded-xl p-3 transition"
          >
            <div className="text-[10px] font-bold text-gray-300 uppercase tracking-wider">Game Winners</div>
            <div className="text-base sm:text-lg font-black text-white mt-0.5 tabular-nums">
              {records.length} <span className="text-xs font-semibold text-gray-400">ဦး</span>
            </div>
            <div className="text-[10px] text-emerald-300 tabular-nums">
              Today Active: {enrichedRecords.filter((r) => r.rewardStatus === 'active_unused').length}
            </div>
          </button>
        </div>
      </div>

      {/* =========================================================================
          2. CLEAN 2-TAB SEGMENTED SWITCHER
         ========================================================================= */}
      <div className="bg-white p-1.5 rounded-2xl border border-gray-200/90 shadow-xs grid grid-cols-2 gap-1.5">
        <button
          type="button"
          onClick={() => handleSetSubView('cards_studio')}
          className={`min-h-[44px] px-3 py-2 rounded-xl text-xs font-black transition flex items-center justify-center gap-2 ${
            subView === 'cards_studio'
              ? 'bg-[#0B2419] text-[#D4AF37] shadow-xs'
              : 'text-gray-600 hover:bg-gray-100'
          }`}
        >
          <Sparkles className="w-4 h-4 shrink-0" />
          <span>Campaign Cards</span>
          <span className="tabular-nums opacity-80">({campaignCards.length})</span>
        </button>

        <button
          type="button"
          onClick={() => handleSetSubView('winners_tracker')}
          className={`min-h-[44px] px-3 py-2 rounded-xl text-xs font-black transition flex items-center justify-center gap-2 ${
            subView === 'winners_tracker'
              ? 'bg-[#0B2419] text-[#D4AF37] shadow-xs'
              : 'text-gray-600 hover:bg-gray-100'
          }`}
        >
          <PartyPopper className="w-4 h-4 shrink-0" />
          <span>Game Winners</span>
          <span className="tabular-nums opacity-80">({records.length})</span>
        </button>
      </div>

      {/* =========================================================================
          VIEW 1: CAMPAIGN CARDS STUDIO (SINGLE-ELEVATION, COLLAPSIBLE CONTROLS)
         ========================================================================= */}
      {subView === 'cards_studio' && (
        <div className="space-y-4 animate-fade-in">
          {/* Clean Action Bar */}
          <div className="bg-white p-4 rounded-2xl border border-gray-200/90 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center justify-between sm:justify-start gap-3">
              <div>
                <h3 className="text-sm sm:text-base font-black text-[#123524] flex items-center gap-2">
                  <Gift className="w-4 h-4 text-[#D4AF37]" />
                  <span>Saved Campaigns ({campaignCards.length})</span>
                </h3>
                <p className="text-[11px] text-gray-500 mt-0.5">
                  ကဒ်တစ်ခုချင်းစီကို နှိပ်၍ Popup၊ Booking Box နှင့် Direct Link များ စီမံနိုင်ပါသည်
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  const next = !allCardsExpanded;
                  const map: Record<string, boolean> = {};
                  campaignCards.forEach((c) => {
                    map[c.id] = next;
                  });
                  setExpandedCards(map);
                }}
                className="text-[11px] font-bold text-gray-500 hover:text-[#123524] px-2.5 py-1.5 rounded-lg hover:bg-gray-100 shrink-0"
              >
                {allCardsExpanded ? 'Collapse All' : 'Expand All'}
              </button>
            </div>

            <div className="grid grid-cols-2 sm:flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={async () => {
                  const generalLink = `${window.location.origin}/?mode=campaign`;
                  const ok = await safeCopyText(generalLink);
                  showToast(
                    ok
                      ? 'Main Game Link ကူးယူပြီးပါပြီ (Mini Game Popup ဖွင့်ထားမှသာ ဆော့နိုင်ပါမည်)'
                      : generalLink,
                    'info'
                  );
                }}
                className="min-h-[40px] px-3.5 py-2 rounded-xl bg-amber-50 hover:bg-amber-100 text-[#123524] border border-[#D4AF37]/40 text-xs font-bold flex items-center justify-center gap-1.5 transition"
              >
                <Copy className="w-3.5 h-3.5 text-[#D4AF37] shrink-0" />
                <span className="truncate">Main Link</span>
              </button>

              <button
                type="button"
                onClick={() => setShowCreateModal(true)}
                className="min-h-[40px] px-4 py-2 rounded-xl bg-[#123524] hover:bg-[#1a4a32] text-[#D4AF37] text-xs font-black flex items-center justify-center gap-1.5 shadow-xs transition"
              >
                <PlusCircle className="w-4 h-4 shrink-0" />
                <span className="truncate">New Campaign</span>
              </button>
            </div>
          </div>

          {/* Campaign Cards Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
            {campaignCards.map((card) => {
              const isCardLive = Boolean(card.isPopupActive || card.isBoxActive);
              const isGameLinkPlayable = Boolean(card.isPopupActive);
              const isSavingThis = savingPromoId === card.id;
              const isExpanded = Boolean(expandedCards[card.id]);
              const isExpired = Boolean(card.endDate && card.endDate < todayStr);
              const isScheduled = Boolean(card.startDate && card.startDate > todayStr);
              const campaignShareUrl = `${window.location.origin}/?mode=campaign&campaign=${encodeURIComponent(card.id)}`;

              return (
                <div
                  key={card.id}
                  className={`bg-white rounded-2xl border overflow-hidden flex flex-col transition-all ${
                    isCardLive
                      ? 'border-[#D4AF37] shadow-md ring-1 ring-[#D4AF37]/30'
                      : 'border-gray-200/90 shadow-xs'
                  }`}
                >
                  {/* Sleek Theme Header */}
                  <div
                    className={`p-4 bg-gradient-to-br ${
                      card.themeColor || 'from-[#123524] via-[#0B2419] to-[#06150e]'
                    } text-white`}
                  >
                    <div className="flex items-center justify-between gap-2 text-[10px] font-bold uppercase tracking-wider mb-1.5">
                      <span className="text-[#D4AF37]/90 truncate">{card.badgeText || 'EXCLUSIVE EVENT'}</span>
                      <span
                        className={`inline-flex items-center gap-1 shrink-0 ${
                          isCardLive ? 'text-emerald-300' : 'text-gray-300/80'
                        }`}
                      >
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${
                            isCardLive ? 'bg-emerald-400 animate-pulse' : 'bg-gray-400'
                          }`}
                        />
                        {isCardLive ? 'ACTIVE' : 'OFF'}
                      </span>
                    </div>

                    <h4 className="text-base font-black text-[#D4AF37] leading-snug">{card.campaignTitle}</h4>
                    <div className="text-[11px] text-gray-300 font-medium mt-0.5 truncate">
                      Box: {card.boxTitle || 'SPECIAL PROMO'}
                    </div>
                  </div>

                  {/* Compact Unboxed Summary Strip (Zero Nested Cards!) */}
                  <div className="px-4 py-3.5 space-y-3">
                    {/* Discounts + Dates on Clean Unboxed Lines */}
                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                      <div className="flex items-center gap-2 font-bold text-[#123524] tabular-nums">
                        <span>In-Spa {card.otherDiscountPercent}%</span>
                        <span className="text-gray-300">·</span>
                        <span>Outcall {card.hotelDiscountPercent}%</span>
                      </div>

                      <div className="flex items-center gap-1.5 text-[11px] font-mono font-semibold text-gray-600 tabular-nums">
                        <Calendar className="w-3.5 h-3.5 text-[#D4AF37] shrink-0" />
                        <span>
                          {card.startDate || '-'} → {card.endDate || '-'}
                        </span>
                      </div>
                    </div>

                    {/* Channel & Date Health Line */}
                    <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] font-semibold">
                      <div className="flex items-center gap-2">
                        <span className={card.isPopupActive ? 'text-emerald-700 font-bold' : 'text-gray-400'}>
                          Popup {card.isPopupActive ? 'ON' : 'OFF'}
                        </span>
                        <span className="text-gray-300">·</span>
                        <span className={card.isBoxActive ? 'text-emerald-700 font-bold' : 'text-gray-400'}>
                          Box {card.isBoxActive ? 'ON' : 'OFF'}
                        </span>
                      </div>

                      {isExpired ? (
                        <span className="text-red-600 font-bold">Expired Date</span>
                      ) : isScheduled ? (
                        <span className="text-amber-600 font-bold">Scheduled</span>
                      ) : (
                        <span className="text-emerald-700 font-bold">Valid Today</span>
                      )}
                    </div>

                    {/* Primary Action Row */}
                    <div className="flex items-center gap-2 pt-0.5">
                      <button
                        type="button"
                        disabled={isSavingThis}
                        onClick={() => handleToggleCardChannel(card, 'master_toggle')}
                        className={`flex-1 min-h-[40px] px-3 py-2 rounded-xl text-xs font-black tracking-wide transition ${
                          isCardLive
                            ? 'bg-red-50 hover:bg-red-600 text-red-600 hover:text-white border border-red-200'
                            : 'bg-[#123524] hover:bg-[#1a4a32] text-[#D4AF37]'
                        }`}
                      >
                        {isSavingThis ? 'Saving...' : isCardLive ? 'Turn Off' : 'Activate'}
                      </button>

                      <button
                        type="button"
                        onClick={async () => {
                          const ok = await safeCopyText(campaignShareUrl);
                          showToast(
                            ok
                              ? isGameLinkPlayable
                                ? `"${card.campaignTitle}" Game Link ကူးယူပြီးပါပြီ`
                                : 'Link ကူးယူပြီးပါပြီ (မှတ်ချက် - Popup ဖွင့်ထားမှသာ Customer ဂိမ်းဆော့နိုင်ပါမည်)'
                              : campaignShareUrl,
                            isGameLinkPlayable ? 'success' : 'info'
                          );
                        }}
                        className="min-h-[40px] px-3 py-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-bold flex items-center gap-1.5 transition shrink-0"
                        title="Copy Direct Game Link"
                      >
                        <Copy className="w-3.5 h-3.5" />
                        <span>Link</span>
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          setExpandedCards((prev) => ({ ...prev, [card.id]: !prev[card.id] }))
                        }
                        className="min-h-[40px] w-10 rounded-xl bg-gray-100 hover:bg-gray-200 text-[#123524] flex items-center justify-center transition shrink-0"
                        title={isExpanded ? 'Hide Controls' : 'Manage Controls'}
                      >
                        <ChevronDown
                          className={`w-4 h-4 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}
                        />
                      </button>
                    </div>
                  </div>

                  {/* Expanded Controls Section (Clean Hairlines, Native Toggle Switches) */}
                  {isExpanded && (
                    <div className="border-t border-gray-100 bg-gray-50/50 divide-y divide-gray-100">
                      {/* Toggle 1: Mini Game Popup & Direct Link */}
                      <button
                        type="button"
                        disabled={isSavingThis}
                        onClick={() => handleToggleCardChannel(card, 'popup')}
                        className="w-full px-4 py-3 flex items-center justify-between gap-3 text-left hover:bg-gray-100/60 transition"
                      >
                        <div className="min-w-0">
                          <div className="text-xs font-bold text-gray-900">Mini Game Popup & Link</div>
                          <div className="text-[11px] text-gray-500 mt-0.5">
                            App အဖွင့် Popup နှင့် Direct Link ဂိမ်းကစားခွင့်
                          </div>
                        </div>
                        <span
                          className={`w-11 h-6 rounded-full p-0.5 transition-colors flex items-center shrink-0 ${
                            card.isPopupActive ? 'bg-emerald-600 justify-end' : 'bg-gray-300 justify-start'
                          }`}
                        >
                          <span className="w-5 h-5 rounded-full bg-white shadow-xs" />
                        </span>
                      </button>

                      {/* Toggle 2: Booking Promo Box */}
                      <button
                        type="button"
                        disabled={isSavingThis}
                        onClick={() => handleToggleCardChannel(card, 'box')}
                        className="w-full px-4 py-3 flex items-center justify-between gap-3 text-left hover:bg-gray-100/60 transition"
                      >
                        <div className="min-w-0">
                          <div className="text-xs font-bold text-gray-900">Booking Promo Box</div>
                          <div className="text-[11px] text-gray-500 mt-0.5">
                            Booking စာမျက်နှာပေါ်တွင် Discount Box ပြသမည်
                          </div>
                        </div>
                        <span
                          className={`w-11 h-6 rounded-full p-0.5 transition-colors flex items-center shrink-0 ${
                            card.isBoxActive ? 'bg-emerald-600 justify-end' : 'bg-gray-300 justify-start'
                          }`}
                        >
                          <span className="w-5 h-5 rounded-full bg-white shadow-xs" />
                        </span>
                      </button>

                      {/* Direct Campaign URL Row */}
                      <div className="px-4 py-3 space-y-1.5">
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="font-bold text-gray-600 flex items-center gap-1">
                            <Globe className="w-3.5 h-3.5 text-gray-400" />
                            Direct Campaign URL
                          </span>
                          <span
                            className={`font-bold flex items-center gap-1 ${
                              isGameLinkPlayable && !isExpired ? 'text-emerald-700' : 'text-red-500'
                            }`}
                          >
                            {isGameLinkPlayable && !isExpired ? (
                              <>
                                <CheckCircle className="w-3 h-3" /> Active
                              </>
                            ) : (
                              <>
                                <Lock className="w-3 h-3" /> {isExpired ? 'Expired' : 'Locked'}
                              </>
                            )}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <input
                            type="text"
                            readOnly
                            value={campaignShareUrl}
                            className="flex-1 min-w-0 px-2.5 py-2 bg-white border border-gray-200 rounded-lg font-mono text-[10px] text-gray-600 outline-none select-all"
                          />
                          <button
                            type="button"
                            onClick={async () => {
                              const ok = await safeCopyText(campaignShareUrl);
                              showToast(ok ? 'Campaign Link ကူးယူပြီးပါပြီ' : campaignShareUrl, 'success');
                            }}
                            className="min-h-[34px] px-3 py-1.5 bg-[#123524] text-[#D4AF37] rounded-lg text-[11px] font-bold shrink-0"
                          >
                            Copy
                          </button>
                        </div>
                      </div>

                      {/* Footer Edit & Delete */}
                      <div className="px-4 py-2.5 flex items-center justify-between gap-2 bg-white">
                        <button
                          type="button"
                          onClick={() => handleDeleteCampaignCard(card)}
                          className="min-h-[36px] px-2.5 py-1.5 text-xs font-bold text-red-600 hover:bg-red-50 rounded-lg flex items-center gap-1.5 transition"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>Delete</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingCard(card)}
                          className="min-h-[36px] px-3 py-1.5 text-xs font-bold text-[#123524] bg-gray-100 hover:bg-gray-200 rounded-lg flex items-center gap-1.5 transition"
                        >
                          <Edit className="w-3.5 h-3.5" />
                          <span>Edit Details</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* =========================================================================
          VIEW 2: GAME WINNERS & USAGE TRACKER (MOBILE CARDS + DESKTOP TABLE)
         ========================================================================= */}
      {subView === 'winners_tracker' && (
        <div className="space-y-4 animate-fade-in">
          {/* KPI Summary Strip */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
            <div className="bg-white p-3.5 rounded-2xl border border-gray-200/90 shadow-xs">
              <div className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Total Winners</div>
              <div className="text-xl font-black text-[#123524] mt-0.5 tabular-nums">{summaryStats.total} ဦး</div>
            </div>
            <div className="bg-white p-3.5 rounded-2xl border border-emerald-200/80 shadow-xs">
              <div className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider">Used / Completed</div>
              <div className="text-xl font-black text-emerald-700 mt-0.5 tabular-nums">{summaryStats.usedCount} ဦး</div>
            </div>
            <div className="bg-white p-3.5 rounded-2xl border border-blue-200/80 shadow-xs">
              <div className="text-[10px] font-bold text-blue-700 uppercase tracking-wider">Active Today</div>
              <div className="text-xl font-black text-blue-700 mt-0.5 tabular-nums">{summaryStats.activeCount} ဦး</div>
            </div>
            <div className="bg-white p-3.5 rounded-2xl border border-red-200/80 shadow-xs">
              <div className="text-[10px] font-bold text-red-600 uppercase tracking-wider">Expired</div>
              <div className="text-xl font-black text-red-600 mt-0.5 tabular-nums">{summaryStats.expiredCount} ဦး</div>
            </div>
          </div>

          {/* Unified Filters & Export Toolbar */}
          <div className="bg-white p-4 rounded-2xl border border-gray-200/90 shadow-xs space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
              {/* Single-Line Scrollable Date Filter */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 -mx-1 px-1">
                {[
                  { id: 'all', label: 'All Dates' },
                  { id: 'today', label: 'Today' },
                  { id: 'yesterday', label: 'Yesterday' },
                  { id: 'this_month', label: 'This Month' },
                  { id: 'custom_range', label: 'Custom Range' },
                ].map((dm) => (
                  <button
                    key={dm.id}
                    type="button"
                    onClick={() => setDateFilterMode(dm.id as any)}
                    className={`shrink-0 min-h-[34px] px-3 py-1.5 rounded-xl text-xs font-bold border transition whitespace-nowrap ${
                      dateFilterMode === dm.id
                        ? 'bg-[#123524] text-[#D4AF37] border-[#123524]'
                        : 'bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100'
                    }`}
                  >
                    {dm.label}
                  </button>
                ))}
              </div>

              <button
                type="button"
                onClick={handleExportCSV}
                className="min-h-[36px] px-3.5 py-1.5 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-xl text-xs font-bold hover:bg-emerald-100 flex items-center justify-center gap-1.5 shrink-0 transition"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Export CSV</span>
              </button>
            </div>

            {dateFilterMode === 'custom_range' && (
              <div className="grid grid-cols-2 gap-2.5 pt-1">
                <div>
                  <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">From</label>
                  <input
                    type="date"
                    value={fromDate}
                    onChange={(e) => {
                      const val = e.target.value;
                      setFromDate(val);
                      if (toDate && val > toDate) setToDate(val);
                    }}
                    className="w-full min-h-[38px] px-3 py-1.5 text-xs font-bold bg-gray-50 border border-gray-200 rounded-xl"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">To</label>
                  <input
                    type="date"
                    value={toDate}
                    onChange={(e) => {
                      const val = e.target.value;
                      setToDate(val);
                      if (fromDate && val < fromDate) setFromDate(val);
                    }}
                    className="w-full min-h-[38px] px-3 py-1.5 text-xs font-bold bg-gray-50 border border-gray-200 rounded-xl"
                  />
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-12 gap-2.5 pt-1">
              <div className="md:col-span-7 flex items-center gap-1.5 overflow-x-auto pb-1 -mx-1 px-1">
                {[
                  { id: 'all', label: `All (${summaryStats.total})` },
                  { id: 'active_unused', label: `Active (${summaryStats.activeCount})` },
                  { id: 'used_completed', label: `Used (${summaryStats.usedCount})` },
                  { id: 'expired', label: `Expired (${summaryStats.expiredCount})` },
                ].map((sf) => (
                  <button
                    key={sf.id}
                    type="button"
                    onClick={() => setStatusFilter(sf.id as any)}
                    className={`shrink-0 min-h-[34px] px-3 py-1.5 rounded-xl text-xs font-bold border transition whitespace-nowrap tabular-nums ${
                      statusFilter === sf.id
                        ? 'bg-[#123524] text-[#D4AF37] border-[#123524]'
                        : 'bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100'
                    }`}
                  >
                    {sf.label}
                  </button>
                ))}
              </div>

              <div className="md:col-span-5 relative">
                <input
                  type="text"
                  placeholder="ဖုန်းနံပါတ် သို့မဟုတ် အမည် ရှာရန်..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full min-h-[40px] pl-9 pr-8 py-2 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:border-[#123524] focus:bg-white text-xs font-semibold"
                />
                <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                {search && (
                  <button
                    type="button"
                    onClick={() => setSearch('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-1"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Date-Grouped Winners List (Responsive Cards on Mobile, Clean Table on Desktop) */}
          {loading ? (
            <div className="bg-white rounded-2xl border border-gray-200 p-10 text-center text-gray-400 text-xs font-bold">
              Loading Campaign Winners...
            </div>
          ) : groupedByDate.length === 0 ? (
            <div className="bg-white rounded-2xl border border-dashed border-gray-200 p-10 text-center text-gray-400 text-xs font-semibold">
              ရွေးချယ်ထားသော ရက်စွဲနှင့် စာရင်းအတွက် ကံထူးရှင်မှတ်တမ်း မရှိပါ။
            </div>
          ) : (
            <div className="space-y-4">
              {groupedByDate.map((grp) => (
                <div key={grp.date} className="rounded-2xl border border-gray-200/90 shadow-xs overflow-hidden bg-white">
                  {/* Date Header */}
                  <div className="bg-[#0B2419] px-4 py-3 text-white flex flex-wrap items-center justify-between gap-2">
                    <div className="font-bold text-xs sm:text-sm text-[#D4AF37] flex items-center gap-2">
                      <Calendar className="w-4 h-4 shrink-0" />
                      <span>{formatReadableDateHeader(grp.date)}</span>
                    </div>
                    <div className="text-[11px] text-gray-300 font-semibold tabular-nums">
                      Total {grp.items.length} · Used {grp.usedCount}
                      {grp.activeCount > 0 ? ` · Active ${grp.activeCount}` : ''}
                    </div>
                  </div>

                  {/* MOBILE LIST VIEW (Zero Horizontal Scroll!) */}
                  <div className="md:hidden divide-y divide-gray-100">
                    {grp.items.map((r) => {
                      const linkedB = r.completedBooking || r.activePendingBooking;
                      return (
                        <div key={r.id} className="p-4 space-y-2.5">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <div className="font-mono font-black text-sm text-[#123524] tabular-nums">{r.phone}</div>
                              <div className="text-[11px] text-gray-500 mt-0.5">
                                {linkedB?.name ? `${linkedB.name} · ` : ''}
                                {r.createdAt
                                  ? new Date(r.createdAt).toLocaleTimeString('en-US', {
                                      hour: '2-digit',
                                      minute: '2-digit',
                                    })
                                  : r.cleanDate}
                              </div>
                            </div>
                            <div className="text-right shrink-0">
                              <div className="text-sm font-black text-amber-700 tabular-nums">{r.discountPercent}% OFF</div>
                              <div
                                className={`text-[11px] font-bold mt-0.5 ${
                                  r.rewardStatus === 'used_completed'
                                    ? 'text-emerald-700'
                                    : r.rewardStatus === 'active_unused'
                                    ? 'text-blue-600'
                                    : 'text-red-500'
                                }`}
                              >
                                {r.rewardStatus === 'used_completed'
                                  ? '● Used'
                                  : r.rewardStatus === 'active_unused'
                                  ? '● Active Today'
                                  : '● Expired'}
                              </div>
                            </div>
                          </div>

                          {linkedB && (
                            <div className="text-xs text-gray-600 bg-gray-50 px-3 py-2 rounded-xl border border-gray-100 space-y-1">
                              <div className="font-bold text-gray-800">
                                {linkedB.service} ·{' '}
                                <span className="text-[#123524] tabular-nums">{formatPrice(linkedB.totalPrice)}</span>
                              </div>
                              <div className="text-[10px] text-gray-500 font-mono">
                                TxID: {linkedB.txId || '-'} · {linkedB.status.toUpperCase()}
                              </div>
                            </div>
                          )}

                          <div className="flex flex-wrap items-center gap-2 pt-0.5">
                            {r.activeBookingNeedsDiscount && linkedB && (
                              <button
                                type="button"
                                disabled={applyingBookingId === linkedB.id}
                                onClick={() => handleApplyCampaignDiscountToBooking(r, linkedB)}
                                className="flex-1 min-h-[38px] px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs flex items-center justify-center gap-1.5"
                              >
                                <Sparkles className="w-3.5 h-3.5" />
                                <span>
                                  {applyingBookingId === linkedB.id
                                    ? 'Applying...'
                                    : `Apply ${r.discountPercent}% OFF`}
                                </span>
                              </button>
                            )}

                            <button
                              type="button"
                              onClick={() => handleContactUser(r.phone, r.discountPercent)}
                              className="flex-1 min-h-[38px] px-3 py-1.5 bg-blue-50 text-blue-700 border border-blue-200/80 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5"
                            >
                              <MessageCircle className="w-3.5 h-3.5" />
                              <span>Telegram</span>
                            </button>

                            {adminRole === 'super_admin' && (
                              <button
                                type="button"
                                onClick={() => handleDeleteRecord(r.id, r.phone)}
                                className="min-h-[38px] w-10 rounded-xl bg-gray-100 text-gray-500 hover:bg-red-50 hover:text-red-600 flex items-center justify-center shrink-0"
                                title="Delete Record"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* DESKTOP TABLE VIEW */}
                  <div className="hidden md:block overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b border-gray-100 bg-gray-50/70 text-[11px] text-gray-500 uppercase tracking-wider">
                          <th className="p-3.5">Date & Time</th>
                          <th className="p-3.5">Phone & Customer</th>
                          <th className="p-3.5">Prize</th>
                          <th className="p-3.5">Status</th>
                          <th className="p-3.5">Booking / POS Receipt</th>
                          <th className="p-3.5 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 text-xs">
                        {grp.items.map((r) => {
                          const linkedB = r.completedBooking || r.activePendingBooking;
                          return (
                            <tr key={r.id} className="hover:bg-gray-50/70 transition">
                              <td className="p-3.5 font-mono text-gray-600 tabular-nums">
                                <div className="font-bold">{r.cleanDate}</div>
                                {r.createdAt && (
                                  <div className="text-[10px] text-gray-400">
                                    {new Date(r.createdAt).toLocaleTimeString('en-US', {
                                      hour: '2-digit',
                                      minute: '2-digit',
                                    })}
                                  </div>
                                )}
                              </td>
                              <td className="p-3.5">
                                <div className="font-mono font-black text-[#123524] text-sm tabular-nums">{r.phone}</div>
                                {linkedB?.name && <div className="text-xs font-semibold text-gray-600">{linkedB.name}</div>}
                              </td>
                              <td className="p-3.5 font-black text-amber-700 text-sm tabular-nums">
                                {r.discountPercent}% OFF
                              </td>
                              <td className="p-3.5">
                                <div
                                  className={`font-bold ${
                                    r.rewardStatus === 'used_completed'
                                      ? 'text-emerald-700'
                                      : r.rewardStatus === 'active_unused'
                                      ? 'text-blue-600'
                                      : 'text-red-500'
                                  }`}
                                >
                                  {r.rewardStatus === 'used_completed'
                                    ? '● Used (Completed)'
                                    : r.rewardStatus === 'active_unused'
                                    ? '● Active Today'
                                    : '● Expired'}
                                </div>
                              </td>
                              <td className="p-3.5">
                                {linkedB ? (
                                  <div className="space-y-1">
                                    <div className="font-bold text-gray-800">
                                      {linkedB.service} ·{' '}
                                      <span className="text-[#123524] tabular-nums">{formatPrice(linkedB.totalPrice)}</span>
                                    </div>
                                    <div className="text-[10px] text-gray-500 font-mono">
                                      TxID: {linkedB.txId || '-'} · {linkedB.status.toUpperCase()}
                                    </div>
                                    {r.activeBookingNeedsDiscount && (
                                      <button
                                        type="button"
                                        disabled={applyingBookingId === linkedB.id}
                                        onClick={() => handleApplyCampaignDiscountToBooking(r, linkedB)}
                                        className="px-2.5 py-1 rounded-lg bg-amber-500 hover:bg-amber-600 text-white font-bold text-[10px] inline-flex items-center gap-1"
                                      >
                                        <Sparkles className="w-3 h-3" />
                                        {applyingBookingId === linkedB.id
                                          ? 'Applying...'
                                          : `Apply ${r.discountPercent}% OFF`}
                                      </button>
                                    )}
                                  </div>
                                ) : (
                                  <span className="text-gray-400">No Booking Yet</span>
                                )}
                              </td>
                              <td className="p-3.5 text-right">
                                <div className="flex items-center justify-end gap-1.5">
                                  <button
                                    type="button"
                                    onClick={() => handleContactUser(r.phone, r.discountPercent)}
                                    className="px-3 py-1.5 bg-blue-50 text-blue-700 border border-blue-200 rounded-lg font-bold inline-flex items-center gap-1 hover:bg-blue-100"
                                  >
                                    <MessageCircle className="w-3.5 h-3.5" />
                                    <span>Telegram</span>
                                  </button>
                                  {adminRole === 'super_admin' && (
                                    <button
                                      type="button"
                                      onClick={() => handleDeleteRecord(r.id, r.phone)}
                                      className="p-1.5 rounded-lg bg-gray-100 text-gray-500 hover:bg-red-50 hover:text-red-600"
                                      title="Delete Record"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  )}
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* =========================================================================
          MODAL: EDIT CAMPAIGN CARD
         ========================================================================= */}
      {editingCard && (
        <div
          className="fixed inset-0 z-[260] bg-black/60 backdrop-blur-[2px] flex items-end sm:items-center justify-center p-0 sm:p-4 overflow-y-auto"
          onClick={() => setEditingCard(null)}
        >
          <form
            onSubmit={handleSaveEditedCard}
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-t-3xl sm:rounded-3xl max-w-lg w-full p-5 sm:p-6 shadow-2xl border border-gray-200 space-y-4 max-h-[90vh] overflow-y-auto"
          >
            <div className="flex justify-between items-center pb-3 border-b border-gray-100">
              <div>
                <h3 className="text-base font-black text-[#123524] flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-[#D4AF37]" />
                  <span>Edit Campaign</span>
                </h3>
                <p className="text-xs text-gray-500 mt-0.5 truncate">{editingCard.campaignTitle}</p>
              </div>
              <button
                type="button"
                onClick={() => setEditingCard(null)}
                className="w-8 h-8 rounded-full bg-gray-100 text-gray-500 hover:text-red-600 flex items-center justify-center"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3.5">
              <div>
                <label className="block text-[11px] font-bold text-gray-600 uppercase mb-1">
                  Campaign Title *
                </label>
                <input
                  type="text"
                  required
                  value={editingCard.campaignTitle}
                  onChange={(e) => setEditingCard({ ...editingCard, campaignTitle: e.target.value })}
                  className="w-full min-h-[42px] px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm font-bold text-[#123524] outline-none focus:border-[#123524] focus:bg-white"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-gray-600 uppercase mb-1">Box Title</label>
                  <input
                    type="text"
                    value={editingCard.boxTitle}
                    onChange={(e) => setEditingCard({ ...editingCard, boxTitle: e.target.value })}
                    className="w-full min-h-[42px] px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-gray-600 uppercase mb-1">Event Tag</label>
                  <input
                    type="text"
                    value={editingCard.badgeText || ''}
                    onChange={(e) => setEditingCard({ ...editingCard, badgeText: e.target.value })}
                    className="w-full min-h-[42px] px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-gray-600 uppercase mb-1">
                    In-Spa Discount (%)
                  </label>
                  <input
                    type="number"
                    inputMode="numeric"
                    min={0}
                    max={100}
                    value={editingCard.otherDiscountPercent}
                    onChange={(e) =>
                      setEditingCard({ ...editingCard, otherDiscountPercent: Number(e.target.value) })
                    }
                    className="w-full min-h-[42px] px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm font-black text-[#123524] tabular-nums"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-gray-600 uppercase mb-1">
                    Hotel / Outcall (%)
                  </label>
                  <input
                    type="number"
                    inputMode="numeric"
                    min={0}
                    max={100}
                    value={editingCard.hotelDiscountPercent}
                    onChange={(e) =>
                      setEditingCard({ ...editingCard, hotelDiscountPercent: Number(e.target.value) })
                    }
                    className="w-full min-h-[42px] px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm font-black text-[#123524] tabular-nums"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-gray-600 uppercase mb-1">Start Date</label>
                  <input
                    type="date"
                    value={editingCard.startDate}
                    onChange={(e) => setEditingCard({ ...editingCard, startDate: e.target.value })}
                    className="w-full min-h-[42px] px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-gray-600 uppercase mb-1">End Date</label>
                  <input
                    type="date"
                    value={editingCard.endDate}
                    onChange={(e) => setEditingCard({ ...editingCard, endDate: e.target.value })}
                    className="w-full min-h-[42px] px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-gray-600 uppercase mb-1.5">Card Theme</label>
                <div className="grid grid-cols-4 gap-2">
                  {THEME_PRESETS.map((tp) => (
                    <button
                      key={tp.value}
                      type="button"
                      onClick={() => setEditingCard({ ...editingCard, themeColor: tp.value })}
                      className={`p-2 rounded-xl border text-[10px] font-bold flex items-center gap-1.5 ${
                        editingCard.themeColor === tp.value
                          ? 'border-[#123524] bg-emerald-50 text-[#123524]'
                          : 'border-gray-200 text-gray-600'
                      }`}
                    >
                      <span className={`w-3 h-3 rounded-full shrink-0 ${tp.swatch}`} />
                      <span className="truncate">{tp.label.split(' ')[0]}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                <label className="min-h-[42px] flex items-center justify-between px-3 py-2 rounded-xl border border-gray-200 bg-gray-50 cursor-pointer">
                  <span className="text-xs font-bold text-gray-800">Mini Game Popup</span>
                  <input
                    type="checkbox"
                    checked={editingCard.isPopupActive}
                    onChange={(e) => setEditingCard({ ...editingCard, isPopupActive: e.target.checked })}
                    className="w-4 h-4 accent-[#123524]"
                  />
                </label>
                <label className="min-h-[42px] flex items-center justify-between px-3 py-2 rounded-xl border border-gray-200 bg-gray-50 cursor-pointer">
                  <span className="text-xs font-bold text-gray-800">Booking Promo Box</span>
                  <input
                    type="checkbox"
                    checked={editingCard.isBoxActive}
                    onChange={(e) => setEditingCard({ ...editingCard, isBoxActive: e.target.checked })}
                    className="w-4 h-4 accent-[#123524]"
                  />
                </label>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2.5 pt-3 border-t border-gray-100">
              <button
                type="button"
                onClick={() => setEditingCard(null)}
                className="min-h-[44px] bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-xs font-bold"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="min-h-[44px] bg-[#123524] hover:bg-[#1a4a32] text-[#D4AF37] rounded-xl text-xs font-black shadow-xs"
              >
                Save Changes
              </button>
            </div>
          </form>
        </div>
      )}

      {/* =========================================================================
          MODAL: CREATE NEW CAMPAIGN CARD
         ========================================================================= */}
      {showCreateModal && (
        <div
          className="fixed inset-0 z-[260] bg-black/60 backdrop-blur-[2px] flex items-end sm:items-center justify-center p-0 sm:p-4 overflow-y-auto"
          onClick={() => setShowCreateModal(false)}
        >
          <form
            onSubmit={handleCreateNewCard}
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-t-3xl sm:rounded-3xl max-w-lg w-full p-5 sm:p-6 shadow-2xl border border-gray-200 space-y-4 max-h-[90vh] overflow-y-auto"
          >
            <div className="flex justify-between items-center pb-3 border-b border-gray-100">
              <div>
                <h3 className="text-base font-black text-[#123524] flex items-center gap-2">
                  <PlusCircle className="w-4 h-4 text-[#D4AF37]" />
                  <span>New Campaign Card</span>
                </h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  ပွဲတော်အလိုက် Promotion ကဒ်အသစ်များ ကြိုတင်သိမ်းဆည်းထားနိုင်ပါသည်
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="w-8 h-8 rounded-full bg-gray-100 text-gray-500 hover:text-red-600 flex items-center justify-center"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3.5">
              <div>
                <label className="block text-[11px] font-bold text-gray-600 uppercase mb-1">
                  Campaign Title *
                </label>
                <input
                  type="text"
                  required
                  value={newCardForm.campaignTitle}
                  onChange={(e) => setNewCardForm({ ...newCardForm, campaignTitle: e.target.value })}
                  placeholder="ဥပမာ - တန်ဆောင်တိုင် အထူးပရိုမိုးရှင်း"
                  className="w-full min-h-[42px] px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm font-bold text-[#123524] outline-none focus:border-[#123524] focus:bg-white"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-gray-600 uppercase mb-1">Box Title</label>
                  <input
                    type="text"
                    value={newCardForm.boxTitle}
                    onChange={(e) => setNewCardForm({ ...newCardForm, boxTitle: e.target.value })}
                    className="w-full min-h-[42px] px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-gray-600 uppercase mb-1">Event Tag</label>
                  <input
                    type="text"
                    value={newCardForm.badgeText || ''}
                    onChange={(e) => setNewCardForm({ ...newCardForm, badgeText: e.target.value })}
                    className="w-full min-h-[42px] px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-gray-600 uppercase mb-1">
                    In-Spa Discount (%)
                  </label>
                  <input
                    type="number"
                    inputMode="numeric"
                    min={0}
                    max={100}
                    value={newCardForm.otherDiscountPercent}
                    onChange={(e) =>
                      setNewCardForm({ ...newCardForm, otherDiscountPercent: Number(e.target.value) })
                    }
                    className="w-full min-h-[42px] px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm font-black text-[#123524] tabular-nums"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-gray-600 uppercase mb-1">
                    Hotel / Outcall (%)
                  </label>
                  <input
                    type="number"
                    inputMode="numeric"
                    min={0}
                    max={100}
                    value={newCardForm.hotelDiscountPercent}
                    onChange={(e) =>
                      setNewCardForm({ ...newCardForm, hotelDiscountPercent: Number(e.target.value) })
                    }
                    className="w-full min-h-[42px] px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm font-black text-[#123524] tabular-nums"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-gray-600 uppercase mb-1">Start Date</label>
                  <input
                    type="date"
                    value={newCardForm.startDate}
                    onChange={(e) => setNewCardForm({ ...newCardForm, startDate: e.target.value })}
                    className="w-full min-h-[42px] px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-gray-600 uppercase mb-1">End Date</label>
                  <input
                    type="date"
                    value={newCardForm.endDate}
                    onChange={(e) => setNewCardForm({ ...newCardForm, endDate: e.target.value })}
                    className="w-full min-h-[42px] px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-gray-600 uppercase mb-1.5">Card Theme</label>
                <div className="grid grid-cols-4 gap-2">
                  {THEME_PRESETS.map((tp) => (
                    <button
                      key={tp.value}
                      type="button"
                      onClick={() => setNewCardForm({ ...newCardForm, themeColor: tp.value })}
                      className={`p-2 rounded-xl border text-[10px] font-bold flex items-center gap-1.5 ${
                        newCardForm.themeColor === tp.value
                          ? 'border-[#123524] bg-emerald-50 text-[#123524]'
                          : 'border-gray-200 text-gray-600'
                      }`}
                    >
                      <span className={`w-3 h-3 rounded-full shrink-0 ${tp.swatch}`} />
                      <span className="truncate">{tp.label.split(' ')[0]}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                <label className="min-h-[42px] flex items-center justify-between px-3 py-2 rounded-xl border border-gray-200 bg-gray-50 cursor-pointer">
                  <span className="text-xs font-bold text-gray-800">Popup ချက်ချင်းဖွင့်မည်</span>
                  <input
                    type="checkbox"
                    checked={newCardForm.isPopupActive}
                    onChange={(e) => setNewCardForm({ ...newCardForm, isPopupActive: e.target.checked })}
                    className="w-4 h-4 accent-[#123524]"
                  />
                </label>
                <label className="min-h-[42px] flex items-center justify-between px-3 py-2 rounded-xl border border-gray-200 bg-gray-50 cursor-pointer">
                  <span className="text-xs font-bold text-gray-800">Promo Box ချက်ချင်းဖွင့်မည်</span>
                  <input
                    type="checkbox"
                    checked={newCardForm.isBoxActive}
                    onChange={(e) => setNewCardForm({ ...newCardForm, isBoxActive: e.target.checked })}
                    className="w-4 h-4 accent-[#123524]"
                  />
                </label>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2.5 pt-3 border-t border-gray-100">
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="min-h-[44px] bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-xs font-bold"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="min-h-[44px] bg-[#123524] hover:bg-[#1a4a32] text-[#D4AF37] rounded-xl text-xs font-black shadow-xs"
              >
                Create Campaign
              </button>
            </div>
          </form>
        </div>
      )}

      {/* =========================================================================
          INLINE TOAST NOTIFICATION (ZERO WINDOW.ALERT)
         ========================================================================= */}
      {toast && (
        <div className="fixed bottom-5 left-1/2 -translate-x-1/2 sm:left-auto sm:translate-x-0 sm:right-6 z-[9990] w-[calc(100%-2rem)] sm:w-auto sm:max-w-md animate-fade-in">
          <div
            className={`px-4 py-3 rounded-2xl shadow-xl border flex items-center gap-2.5 text-xs font-bold ${
              toast.type === 'success'
                ? 'bg-[#0B2419] text-white border-[#C8A951]/40'
                : toast.type === 'error'
                ? 'bg-red-700 text-white border-red-400/50'
                : 'bg-slate-900 text-white border-slate-700'
            }`}
          >
            {toast.type === 'success' ? (
              <CheckCircle className="w-4 h-4 text-[#D4AF37] shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-amber-300 shrink-0" />
            )}
            <span className="flex-1 leading-snug">{toast.message}</span>
            <button
              type="button"
              onClick={() => setToast(null)}
              className="p-1 opacity-75 hover:opacity-100 shrink-0"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* =========================================================================
          IN-APP CONFIRMATION DIALOG (ZERO WINDOW.CONFIRM)
         ========================================================================= */}
      {confirmDialog && (
        <div
          className="fixed inset-0 z-[9995] bg-black/50 backdrop-blur-[2px] flex items-end sm:items-center justify-center p-4"
          onClick={() => !confirmBusy && setConfirmDialog(null)}
        >
          <div
            className="bg-white rounded-2xl w-full max-w-md p-5 shadow-2xl border border-gray-200 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start gap-3">
              <div
                className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                  confirmDialog.tone === 'danger' ? 'bg-red-50 text-red-600' : 'bg-emerald-50 text-emerald-700'
                }`}
              >
                <AlertCircle className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <h4 className="text-base font-black text-gray-900">{confirmDialog.title}</h4>
                <p className="text-xs text-gray-600 mt-1 leading-relaxed">{confirmDialog.message}</p>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-2 pt-1">
              <button
                type="button"
                disabled={confirmBusy}
                onClick={() => setConfirmDialog(null)}
                className="sm:flex-1 min-h-[42px] px-4 py-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-bold transition"
              >
                Cancel
              </button>
              {confirmDialog.secondaryLabel && confirmDialog.onSecondary && (
                <button
                  type="button"
                  disabled={confirmBusy}
                  onClick={async () => {
                    const fn = confirmDialog.onSecondary!;
                    setConfirmDialog(null);
                    await fn();
                  }}
                  className="sm:flex-1 min-h-[42px] px-4 py-2 rounded-xl bg-amber-50 hover:bg-amber-100 text-[#123524] border border-amber-300 text-xs font-bold transition"
                >
                  {confirmDialog.secondaryLabel}
                </button>
              )}
              <button
                type="button"
                disabled={confirmBusy}
                onClick={async () => {
                  setConfirmBusy(true);
                  try {
                    await confirmDialog.onConfirm();
                  } finally {
                    setConfirmBusy(false);
                    setConfirmDialog(null);
                  }
                }}
                className={`sm:flex-1 min-h-[42px] px-4 py-2 rounded-xl text-xs font-black text-white transition ${
                  confirmDialog.tone === 'danger'
                    ? 'bg-red-600 hover:bg-red-700'
                    : 'bg-[#123524] hover:bg-[#1a4a32] text-[#D4AF37]'
                }`}
              >
                {confirmBusy ? 'Processing...' : confirmDialog.confirmLabel}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
