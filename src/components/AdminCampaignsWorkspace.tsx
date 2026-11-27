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
  AlertCircle,
  MessageCircle,
  Ban,
  ChevronDown,
  Lock,
  Globe,
  Percent,
  Layers,
  Gamepad2,
  Files,
  Send,
  Snowflake,
  RotateCcw,
  Crown,
} from 'lucide-react';
import { db } from '../firebase';
import { encryptText } from '../security';
import {
  AppData,
  Booking,
  formatPrice,
  PromotionType,
  MiniGameStyle,
  SavedCampaignCard,
  DEFAULT_CHRISTMAS_PROBABILITIES,
  buildDefaultRewardProbabilities,
  resolvePromotionType,
  resolveMiniGameStyle,
} from '../shared';
import {
  notifyCampaignWinnerToTelegram,
  broadcastCampaignAnnouncementToTelegram,
} from '../telegramService';

export type { SavedCampaignCard };

const AVAILABLE_GAME_TIERS = [5, 10, 15, 20, 25, 30, 50];
const QUICK_CATEGORY_PERCENTS = [0, 10, 15, 20, 30];

const PROMO_TYPE_META: Record<
  PromotionType,
  {
    shortLabel: string;
    title: string;
    subtitle: string;
    kicker: string;
    popupTitle: string;
    popupDesc: string;
    boxTitle: string;
    boxDesc: string;
  }
> = {
  percentage_discount: {
    shortLabel: '% Discount',
    title: 'General % Discount',
    subtitle: 'In-Spa နှင့် Outcall အတွက် % လျှော့ဈေး',
    kicker: '% DISCOUNT',
    popupTitle: 'Promo Popup & Share Link',
    popupDesc: 'App အဖွင့်တွင် % Discount Popup နှင့် Link ဖွင့်မည်',
    boxTitle: 'Booking Promo Box',
    boxDesc: 'Booking စာမျက်နှာတွင် % Discount Box ပြပြီး အလိုအလျောက်လျှော့မည်',
  },
  mini_game: {
    shortLabel: 'Mini Game',
    title: 'Mini Game Campaign',
    subtitle: 'ဂိမ်းကစားပြီး Reward % မဲပေါက်စနစ်',
    kicker: 'MINI GAME CAMPAIGN',
    popupTitle: 'Mini Game Popup & Direct Game Link',
    popupDesc: 'App အဖွင့် Popup နှင့် Direct Link မှ ဂိမ်းကစားခွင့်ဖွင့်မည်',
    boxTitle: 'Booking Promo Box (Game Invite)',
    boxDesc: 'Booking စာမျက်နှာတွင် ဂိမ်းကစားရန် Banner ခလုတ်ပြသမည်',
  },
  category_discount: {
    shortLabel: 'By Category',
    title: 'Service Category Discount',
    subtitle: 'Massage / Scrub / Waxing Category အလိုက် % သတ်မှတ်ရန်',
    kicker: 'CATEGORY DISCOUNT',
    popupTitle: 'Category Offer Popup & Share Link',
    popupDesc: 'App အဖွင့်တွင် Category လျှော့ဈေး Popup နှင့် Link ဖွင့်မည်',
    boxTitle: 'Booking Promo Box & Category Tags',
    boxDesc: 'Booking နှင့် Service Category ခေါင်းစဉ်များတွင် လျှော့ဈေးပြသမည်',
  },
};

const buildChristmasSantaPresetCard = (startDateStr: string): SavedCampaignCard => ({
  id: 'camp_christmas_santa',
  promoType: 'mini_game',
  gameStyle: 'christmas_santa',
  campaignTitle: 'Christmas Santa လက်ဆောင်အိတ် ကံစမ်းမဲ Campaign',
  boxTitle: 'CHRISTMAS SANTA GIFT',
  description: 'Santa ဖိုးဖိုးကြီးထံမှ လက်ဆောင်တောင်းပြီး 10% မှ 50% OFF အထိ Christmas အထူးလျှော့ဈေးများ ရယူလိုက်ပါ',
  isPopupActive: false,
  isBoxActive: false,
  hotelDiscountPercent: 0,
  otherDiscountPercent: 0,
  gameRewardTiers: [10, 15, 20, 30, 50],
  rewardProbabilities: { ...DEFAULT_CHRISTMAS_PROBABILITIES },
  outcallRewardCap: 10,
  rewardValidityDays: 3,
  telegramAutoNotify: true,
  startDate: startDateStr,
  endDate: '2026-12-31',
  themeColor: 'from-[#7f1d1d] via-[#123524] to-[#081c12]',
  badgeText: 'MERRY CHRISTMAS GIFT',
  updatedAt: Date.now(),
});

const DEFAULT_SAVED_CAMPAIGNS: SavedCampaignCard[] = [
  buildChristmasSantaPresetCard('2026-11-27'),
  {
    id: 'camp_thadingyut',
    promoType: 'mini_game',
    gameStyle: 'lantern_catch',
    campaignTitle: 'သီတင်းကျွတ် မီးပုံးဖမ်းဂိမ်း Campaign',
    boxTitle: 'FESTIVAL MINI GAME',
    description: 'ဂိမ်းကစားပြီး ၅၀% အထိ အထူးလျှော့ဈေးများ ကံစမ်းရယူလိုက်ပါ',
    isPopupActive: false,
    isBoxActive: false,
    hotelDiscountPercent: 0,
    otherDiscountPercent: 0,
    gameRewardTiers: [10, 15, 20, 30, 50],
    rewardProbabilities: { ...DEFAULT_CHRISTMAS_PROBABILITIES },
    outcallRewardCap: 10,
    rewardValidityDays: 1,
    telegramAutoNotify: true,
    startDate: '2026-10-01',
    endDate: '2026-10-31',
    themeColor: 'from-amber-900 via-[#2a1808] to-[#140b03]',
    badgeText: 'LANTERN FESTIVAL',
    updatedAt: Date.now(),
  },
  {
    id: 'camp_tazaungdaing',
    promoType: 'percentage_discount',
    campaignTitle: 'တန်ဆောင်တိုင် အထူး % လျှော့ဈေး',
    boxTitle: 'TAZAUNGDAING SPECIAL',
    description: 'In-Spa နှင့် Hotel/Outcall ဝန်ဆောင်မှုအားလုံးအတွက် အထူးလျှော့ဈေး',
    isPopupActive: false,
    isBoxActive: false,
    hotelDiscountPercent: 10,
    otherDiscountPercent: 20,
    startDate: '2026-11-15',
    endDate: '2026-11-30',
    themeColor: 'from-[#123524] via-[#0B2419] to-[#06150e]',
    badgeText: 'SEASONAL OFFER',
    updatedAt: Date.now(),
  },
  {
    id: 'camp_newyear',
    promoType: 'category_discount',
    campaignTitle: 'နှစ်သစ်ကူး Service Category အထူးလျှော့ဈေး',
    boxTitle: 'NEW YEAR CATEGORY PROMO',
    description: 'ရွေးချယ်ထားသော Service Category များအတွက် သီးသန့်လျှော့ဈေး',
    isPopupActive: false,
    isBoxActive: false,
    hotelDiscountPercent: 0,
    otherDiscountPercent: 0,
    categoryDiscounts: { massage: 20, body_scrub: 25 },
    startDate: '2026-12-20',
    endDate: '2027-01-05',
    themeColor: 'from-emerald-950 via-[#123524] to-[#091e14]',
    badgeText: 'YEAR END SALE',
    updatedAt: Date.now(),
  },
];

const THEME_PRESETS = [
  { label: 'Emerald Gold', value: 'from-[#123524] via-[#0B2419] to-[#06150e]', swatch: 'bg-[#123524]' },
  { label: 'Christmas Red', value: 'from-[#7f1d1d] via-[#123524] to-[#081c12]', swatch: 'bg-red-800' },
  { label: 'Lantern Amber', value: 'from-amber-900 via-[#2a1808] to-[#140b03]', swatch: 'bg-amber-900' },
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

const normalizeCard = (raw: any): SavedCampaignCard => {
  const pType = resolvePromotionType(raw);
  const gStyle = resolveMiniGameStyle(raw);
  const rawTiers: number[] =
    Array.isArray(raw?.gameRewardTiers) && raw.gameRewardTiers.length > 0
      ? [...new Set<number>(raw.gameRewardTiers.map(Number).filter((n: number) => n > 0))].sort((a, b) => a - b)
      : [10, 15, 20, 30, 50];
  const normalizedProbs: Record<number, number> =
    raw?.rewardProbabilities && typeof raw.rewardProbabilities === 'object'
      ? Object.fromEntries(
          rawTiers.map((t) => [
            t,
            raw.rewardProbabilities[t] !== undefined
              ? Number(raw.rewardProbabilities[t])
              : buildDefaultRewardProbabilities(rawTiers)[t] ?? 1,
          ])
        )
      : buildDefaultRewardProbabilities(rawTiers);

  return {
    id: raw?.id || `camp_${Date.now()}`,
    promoType: pType,
    gameStyle: gStyle,
    campaignTitle: raw?.campaignTitle || raw?.title || 'Untitled Promotion',
    boxTitle: raw?.boxTitle || 'SPECIAL PROMO',
    description: raw?.description || '',
    isPopupActive: Boolean(raw?.isPopupActive),
    isBoxActive: Boolean(raw?.isBoxActive),
    hotelDiscountPercent: Number(raw?.hotelDiscountPercent) || 0,
    otherDiscountPercent: Number(raw?.otherDiscountPercent) || 0,
    gameRewardTiers: rawTiers,
    rewardProbabilities: normalizedProbs,
    outcallRewardCap: raw?.outcallRewardCap !== undefined ? Number(raw.outcallRewardCap) : 10,
    rewardValidityDays: Math.max(1, Number(raw?.rewardValidityDays) || 1),
    telegramAutoNotify: raw?.telegramAutoNotify !== false,
    categoryDiscounts:
      raw?.categoryDiscounts && typeof raw.categoryDiscounts === 'object' ? { ...raw.categoryDiscounts } : {},
    startDate: raw?.startDate || getLocalTodayStr(),
    endDate: raw?.endDate || addDaysToDateStr(14),
    themeColor: raw?.themeColor || THEME_PRESETS[0].value,
    badgeText: raw?.badgeText || PROMO_TYPE_META[pType].kicker,
    updatedAt: Number(raw?.updatedAt) || Date.now(),
  };
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
  } catch {}
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

const PromoTypeIcon = ({ type, className = 'w-4 h-4' }: { type: PromotionType; className?: string }) => {
  if (type === 'mini_game') return <Gamepad2 className={className} />;
  if (type === 'category_discount') return <Layers className={className} />;
  return <Percent className={className} />;
};

// ============================================================================
// SHARED CREATE / EDIT PROMOTION FORM MODAL (3 CLEAR PROMOTION TYPES)
// ============================================================================
function PromotionFormModal({
  mode,
  initialCard,
  categories,
  onClose,
  onSubmit,
  onError,
}: {
  mode: 'create' | 'edit';
  initialCard: SavedCampaignCard;
  categories: { id: string; title: string }[];
  onClose: () => void;
  onSubmit: (card: SavedCampaignCard) => void | Promise<void>;
  onError: (msg: string) => void;
}) {
  const [form, setForm] = useState<SavedCampaignCard>(() => {
    const tiers = [...(initialCard.gameRewardTiers || [10, 15, 20, 30, 50])];
    return {
      ...initialCard,
      gameStyle: initialCard.gameStyle || resolveMiniGameStyle(initialCard),
      telegramAutoNotify: initialCard.telegramAutoNotify !== false,
      categoryDiscounts: { ...(initialCard.categoryDiscounts || {}) },
      gameRewardTiers: tiers,
      rewardProbabilities: {
        ...buildDefaultRewardProbabilities(tiers),
        ...(initialCard.rewardProbabilities || {}),
      },
    };
  });
  const [submitting, setSubmitting] = useState(false);

  const meta = PROMO_TYPE_META[form.promoType];

  const handleSelectType = (nextType: PromotionType) => {
    setForm((prev) => {
      const nextTiers =
        prev.gameRewardTiers && prev.gameRewardTiers.length > 0 ? prev.gameRewardTiers : [10, 15, 20, 30, 50];
      return {
        ...prev,
        promoType: nextType,
        gameStyle: nextType === 'mini_game' ? prev.gameStyle || 'christmas_santa' : prev.gameStyle,
        badgeText:
          !prev.badgeText ||
          Object.values(PROMO_TYPE_META).some((m) => m.kicker === prev.badgeText)
            ? PROMO_TYPE_META[nextType].kicker
            : prev.badgeText,
        themeColor:
          nextType === 'mini_game'
            ? (prev.gameStyle || 'christmas_santa') === 'christmas_santa'
              ? THEME_PRESETS[1].value
              : THEME_PRESETS[2].value
            : THEME_PRESETS[0].value,
        otherDiscountPercent: nextType === 'percentage_discount' ? prev.otherDiscountPercent || 20 : prev.otherDiscountPercent,
        hotelDiscountPercent: nextType === 'percentage_discount' ? prev.hotelDiscountPercent || 10 : prev.hotelDiscountPercent,
        gameRewardTiers: nextTiers,
        rewardProbabilities: prev.rewardProbabilities || buildDefaultRewardProbabilities(nextTiers),
        outcallRewardCap: prev.outcallRewardCap ?? 10,
        rewardValidityDays: prev.rewardValidityDays || 3,
        telegramAutoNotify: prev.telegramAutoNotify !== false,
      };
    });
  };

  const toggleGameTier = (pct: number) => {
    setForm((prev) => {
      const current = prev.gameRewardTiers || [10, 15, 20, 30, 50];
      const exists = current.includes(pct);
      const next = exists ? current.filter((t) => t !== pct) : [...current, pct].sort((a, b) => a - b);
      const nextProbs = buildDefaultRewardProbabilities(next);
      return { ...prev, gameRewardTiers: next, rewardProbabilities: nextProbs };
    });
  };

  const setTierProbability = (tier: number, val: number) => {
    const clean = Math.max(0, Math.min(100, Number(val) || 0));
    setForm((prev) => ({
      ...prev,
      rewardProbabilities: {
        ...(prev.rewardProbabilities || {}),
        [tier]: clean,
      },
    }));
  };

  const totalProbabilityWeight = (form.gameRewardTiers || []).reduce(
    (sum, t) => sum + (Number(form.rewardProbabilities?.[t]) || 0),
    0
  );

  const setCategoryPercent = (catId: string, val: number) => {
    const clean = Math.max(0, Math.min(100, Math.round(Number(val) || 0)));
    setForm((prev) => ({
      ...prev,
      categoryDiscounts: {
        ...(prev.categoryDiscounts || {}),
        [catId]: clean,
      },
    }));
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.campaignTitle.trim()) {
      onError('Promotion ခေါင်းစဉ် ထည့်သွင်းပေးပါ။');
      return;
    }
    if (form.startDate && form.endDate && form.endDate < form.startDate) {
      onError('ပြီးဆုံးရက် (End Date) သည် စတင်ရက် (Start Date) ထက် မစောရပါ။');
      return;
    }

    if (form.promoType === 'percentage_discount') {
      if ((Number(form.otherDiscountPercent) || 0) <= 0 && (Number(form.hotelDiscountPercent) || 0) <= 0) {
        onError('In-Spa သို့မဟုတ် Outcall % Discount အနည်းဆုံးတစ်ခု ထည့်ပေးပါ။');
        return;
      }
    } else if (form.promoType === 'mini_game') {
      if (!form.gameRewardTiers || form.gameRewardTiers.length === 0) {
        onError('Mini Game Reward % အနည်းဆုံးတစ်ခု ရွေးချယ်ပေးပါ။');
        return;
      }
      if (totalProbabilityWeight <= 0) {
        onError('Reward % ကျနိုင်ခြေ (Odds) အနည်းဆုံးတစ်ခု 0 ထက်ကြီးရပါမည်။');
        return;
      }
    } else if (form.promoType === 'category_discount') {
      const hasAnyCategoryDiscount = Object.values(form.categoryDiscounts || {}).some((v) => Number(v) > 0);
      if (!hasAnyCategoryDiscount) {
        onError('အနည်းဆုံး Service Category တစ်ခုအတွက် % Discount သတ်မှတ်ပေးပါ။');
        return;
      }
    }

    setSubmitting(true);
    try {
      const cleanedCategoryMap: Record<string, number> = {};
      if (form.promoType === 'category_discount') {
        for (const [k, v] of Object.entries(form.categoryDiscounts || {})) {
          const n = Math.max(0, Math.min(100, Math.round(Number(v) || 0)));
          if (n > 0) cleanedCategoryMap[k] = n;
        }
      }

      const sortedTiers =
        form.promoType === 'mini_game'
          ? [...(form.gameRewardTiers || [10, 15, 20, 30, 50])].sort((a, b) => a - b)
          : [];
      const cleanedProbs: Record<number, number> = {};
      if (form.promoType === 'mini_game') {
        const defaults = buildDefaultRewardProbabilities(sortedTiers);
        sortedTiers.forEach((t) => {
          const rawP = form.rewardProbabilities?.[t];
          cleanedProbs[t] = rawP !== undefined ? Math.max(0, Number(rawP) || 0) : defaults[t] ?? 1;
        });
      }

      const finalCard: SavedCampaignCard = {
        ...form,
        gameStyle: form.promoType === 'mini_game' ? form.gameStyle || 'christmas_santa' : undefined,
        campaignTitle: form.campaignTitle.trim(),
        boxTitle: (form.boxTitle || form.campaignTitle).trim(),
        description: (form.description || '').trim(),
        badgeText: (form.badgeText || PROMO_TYPE_META[form.promoType].kicker).trim(),
        hotelDiscountPercent:
          form.promoType === 'percentage_discount' ? Math.max(0, Math.min(100, Number(form.hotelDiscountPercent) || 0)) : 0,
        otherDiscountPercent:
          form.promoType === 'percentage_discount' ? Math.max(0, Math.min(100, Number(form.otherDiscountPercent) || 0)) : 0,
        gameRewardTiers: sortedTiers,
        rewardProbabilities: cleanedProbs,
        outcallRewardCap:
          form.promoType === 'mini_game' ? Math.max(0, Math.min(100, Number(form.outcallRewardCap ?? 10))) : 10,
        rewardValidityDays:
          form.promoType === 'mini_game' ? Math.max(1, Number(form.rewardValidityDays) || 1) : 1,
        telegramAutoNotify: form.promoType === 'mini_game' ? form.telegramAutoNotify !== false : false,
        categoryDiscounts: cleanedCategoryMap,
        updatedAt: Date.now(),
      };
      await onSubmit(finalCard);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[9980] bg-black/55 backdrop-blur-[2px] flex items-end sm:items-center justify-center p-0 sm:p-4"
      onClick={onClose}
    >
      <form
        onSubmit={handleFormSubmit}
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-t-3xl sm:rounded-2xl w-full max-w-xl max-h-[92vh] flex flex-col shadow-2xl border border-gray-200 overflow-hidden"
      >
        {/* Modal Header */}
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between gap-3 shrink-0 bg-white">
          <div className="min-w-0">
            <h3 className="text-base font-black text-[#123524] flex items-center gap-2">
              {mode === 'create' ? (
                <PlusCircle className="w-5 h-5 text-[#D4AF37] shrink-0" />
              ) : (
                <Edit className="w-5 h-5 text-[#D4AF37] shrink-0" />
              )}
              <span className="truncate">
                {mode === 'create' ? 'Promotion အသစ် ဖန်တီးမည်' : 'Promotion ပြင်ဆင်မည်'}
              </span>
            </h3>
            <p className="text-[11px] text-gray-500 mt-0.5">
              Promotion အမျိုးအစား နှင့် ပြသမည့် Channel ကို တိကျစွာ ရွေးချယ်သတ်မှတ်ပါ
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="w-9 h-9 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-600 shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="p-5 overflow-y-auto space-y-5 flex-1">
          {/* STEP 1: CHOOSE PROMOTION TYPE */}
          <div className="space-y-2">
            <label className="text-[11px] font-black text-[#123524] uppercase tracking-wider block">
              1. Promotion အမျိုးအစား ရွေးချယ်ပါ
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {(['percentage_discount', 'mini_game', 'category_discount'] as PromotionType[]).map((t) => {
                const info = PROMO_TYPE_META[t];
                const selected = form.promoType === t;
                return (
                  <button
                    key={t}
                    type="button"
                    onClick={() => handleSelectType(t)}
                    className={`min-h-[60px] p-3 rounded-xl border text-left transition flex sm:flex-col items-center sm:items-start gap-3 sm:gap-1.5 ${
                      selected
                        ? 'bg-[#0B2419] text-white border-[#D4AF37] shadow-sm'
                        : 'bg-gray-50/80 hover:bg-gray-100 text-gray-800 border-gray-200'
                    }`}
                  >
                    <div
                      className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                        selected ? 'bg-[#D4AF37] text-[#0B2419]' : 'bg-white text-[#123524] border border-gray-200'
                      }`}
                    >
                      <PromoTypeIcon type={t} className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <div className={`text-xs font-black ${selected ? 'text-[#D4AF37]' : 'text-gray-900'}`}>
                        {info.shortLabel}
                      </div>
                      <div className={`text-[10px] leading-snug mt-0.5 ${selected ? 'text-gray-300' : 'text-gray-500'}`}>
                        {info.subtitle}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* STEP 2: OFFER CONFIGURATION (STRICTLY TYPE-SPECIFIC) */}
          <div className="space-y-3 pt-4 border-t border-gray-100">
            <label className="text-[11px] font-black text-[#123524] uppercase tracking-wider block">
              2. {meta.title} အသေးစိတ် သတ်မှတ်ပါ
            </label>

            {form.promoType === 'percentage_discount' && (
              <div className="grid grid-cols-2 gap-3 bg-gray-50 p-3.5 rounded-xl border border-gray-200/80">
                <div>
                  <label className="text-[11px] font-bold text-gray-700 block mb-1">In-Spa Services (% OFF)</label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={form.otherDiscountPercent}
                    onChange={(e) => setForm({ ...form, otherDiscountPercent: Number(e.target.value) })}
                    className="w-full min-h-[42px] px-3 py-2 border border-gray-300 bg-white rounded-xl text-sm font-black text-[#123524] outline-none focus:border-[#123524] tabular-nums"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-gray-700 block mb-1">Hotel & Outcall (% OFF)</label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={form.hotelDiscountPercent}
                    onChange={(e) => setForm({ ...form, hotelDiscountPercent: Number(e.target.value) })}
                    className="w-full min-h-[42px] px-3 py-2 border border-gray-300 bg-white rounded-xl text-sm font-black text-[#123524] outline-none focus:border-[#123524] tabular-nums"
                  />
                </div>
              </div>
            )}

            {form.promoType === 'mini_game' && (
              <div className="space-y-4 bg-gray-50 p-3.5 rounded-xl border border-gray-200/80">
                {/* Mini Game Experience Style */}
                <div>
                  <label className="text-[11px] font-bold text-gray-700 block mb-1.5">
                    Mini Game အမျိုးအစား (Game Theme)
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {(
                      [
                        {
                          id: 'christmas_santa' as MiniGameStyle,
                          title: 'Christmas Santa Gift Sack',
                          desc: 'Santa ဖိုးဖိုးကြီး လက်ဆောင်အိတ်မွှေနှောက်ဂိမ်း',
                        },
                        {
                          id: 'lantern_catch' as MiniGameStyle,
                          title: 'Lantern Catch Game',
                          desc: 'မီးပုံးဖမ်း ကံစမ်းမဲဂိမ်း',
                        },
                      ] as const
                    ).map((g) => {
                      const active = (form.gameStyle || 'christmas_santa') === g.id;
                      return (
                        <button
                          key={g.id}
                          type="button"
                          onClick={() =>
                            setForm((prev) => ({
                              ...prev,
                              gameStyle: g.id,
                              themeColor:
                                g.id === 'christmas_santa' ? THEME_PRESETS[1].value : THEME_PRESETS[2].value,
                            }))
                          }
                          className={`p-2.5 rounded-xl border text-left transition ${
                            active
                              ? 'bg-[#0B2419] text-white border-[#D4AF37]'
                              : 'bg-white text-gray-800 border-gray-200 hover:bg-gray-100'
                          }`}
                        >
                          <div className={`text-xs font-black ${active ? 'text-[#D4AF37]' : 'text-gray-900'}`}>
                            {g.title}
                          </div>
                          <div className={`text-[10px] mt-0.5 leading-snug ${active ? 'text-gray-300' : 'text-gray-500'}`}>
                            {g.desc}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Reward % Tiers */}
                <div>
                  <label className="text-[11px] font-bold text-gray-700 block mb-1.5">
                    ဂိမ်းမှ ပေါက်နိုင်မည့် Reward % များ ရွေးချယ်ပါ
                  </label>
                  <div className="flex flex-wrap gap-1.5">
                    {AVAILABLE_GAME_TIERS.map((pct) => {
                      const active = (form.gameRewardTiers || []).includes(pct);
                      return (
                        <button
                          key={pct}
                          type="button"
                          onClick={() => toggleGameTier(pct)}
                          className={`min-h-[38px] px-3 py-1.5 rounded-lg text-xs font-black tabular-nums border transition ${
                            active
                              ? 'bg-[#123524] text-[#D4AF37] border-[#123524]'
                              : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-100'
                          }`}
                        >
                          {pct}% OFF
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Exact Probability / Drop Rate Editor */}
                {(form.gameRewardTiers || []).length > 0 && (
                  <div className="bg-white p-3 rounded-xl border border-gray-200 space-y-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <div className="text-[11px] font-black text-[#123524]">
                          ဆုကျနိုင်ခြေ သတ်မှတ်ချက် (Drop Odds %)
                        </div>
                        <div className="text-[10px] text-gray-500">
                          ဥပမာ - 10% ကို အများဆုံး (55%) · 50% ကို 100 မှာ 1 ယောက် (1%)
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          setForm((prev) => ({
                            ...prev,
                            rewardProbabilities: buildDefaultRewardProbabilities(prev.gameRewardTiers || []),
                          }))
                        }
                        className="px-2.5 py-1 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 text-[10px] font-bold flex items-center gap-1 shrink-0"
                      >
                        <RotateCcw className="w-3 h-3" />
                        <span>Default</span>
                      </button>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {[...(form.gameRewardTiers || [])]
                        .sort((a, b) => a - b)
                        .map((tier) => {
                          const w = Number(form.rewardProbabilities?.[tier] ?? 0);
                          const effectivePct =
                            totalProbabilityWeight > 0 ? ((w / totalProbabilityWeight) * 100).toFixed(1) : '0.0';
                          return (
                            <div
                              key={tier}
                              className="p-2 rounded-lg bg-gray-50 border border-gray-200 flex items-center justify-between gap-1.5"
                            >
                              <div className="min-w-0">
                                <div className="text-xs font-black text-[#123524] tabular-nums">{tier}% OFF</div>
                                <div className="text-[10px] text-gray-500 tabular-nums">{effectivePct}% chance</div>
                              </div>
                              <input
                                type="number"
                                min="0"
                                max="100"
                                step="1"
                                value={w}
                                onChange={(e) => setTierProbability(tier, Number(e.target.value))}
                                className="w-14 min-h-[34px] px-1.5 py-1 border border-gray-300 bg-white rounded-lg text-xs font-black text-center text-[#123524] outline-none focus:border-[#123524] tabular-nums"
                              />
                            </div>
                          );
                        })}
                    </div>

                    <div className="flex items-center justify-between text-[10.5px] font-bold pt-1 border-t border-gray-100 tabular-nums">
                      <span className="text-gray-500">Total Weight</span>
                      <span className={totalProbabilityWeight === 100 ? 'text-emerald-700' : 'text-amber-600'}>
                        {totalProbabilityWeight}% {totalProbabilityWeight === 100 ? '· Exact 100%' : '· Auto-normalized'}
                      </span>
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  <div>
                    <label className="text-[11px] font-bold text-gray-700 block mb-1">
                      Outcall / Hotel အများဆုံးကန့်သတ်ချက် (%)
                    </label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={form.outcallRewardCap ?? 10}
                      onChange={(e) => setForm({ ...form, outcallRewardCap: Number(e.target.value) })}
                      className="w-full min-h-[40px] px-3 py-2 border border-gray-300 bg-white rounded-xl text-xs font-black text-[#123524] outline-none tabular-nums"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-gray-700 block mb-1">
                      မဲပေါက်ဆု သက်တမ်း (Validity)
                    </label>
                    <div className="grid grid-cols-3 gap-1.5">
                      {[1, 3, 7].map((days) => (
                        <button
                          key={days}
                          type="button"
                          onClick={() => setForm({ ...form, rewardValidityDays: days })}
                          className={`min-h-[40px] rounded-lg text-xs font-bold border transition ${
                            (form.rewardValidityDays || 1) === days
                              ? 'bg-[#123524] text-[#D4AF37] border-[#123524]'
                              : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-100'
                          }`}
                        >
                          {days === 1 ? '1 Day' : `${days} Days`}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Telegram Bot Auto-Notification Toggle */}
                <label className="flex items-center justify-between gap-3 p-3 rounded-xl bg-white border border-gray-200 cursor-pointer">
                  <div className="min-w-0">
                    <div className="text-xs font-bold text-gray-900 flex items-center gap-1.5">
                      <Send className="w-3.5 h-3.5 text-sky-600 shrink-0" />
                      <span>Telegram Bot Auto-Notification</span>
                    </div>
                    <div className="text-[10.5px] text-gray-500 mt-0.5">
                      ဆုမဲပေါက်တိုင်း Admin Group နှင့် Customer Telegram Bot ထံ အလိုအလျောက် အကြောင်းကြားပေးမည်
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={form.telegramAutoNotify !== false}
                    onChange={(e) => setForm({ ...form, telegramAutoNotify: e.target.checked })}
                    className="w-5 h-5 accent-[#123524] shrink-0"
                  />
                </label>
              </div>
            )}

            {form.promoType === 'category_discount' && (
              <div className="bg-gray-50 p-3.5 rounded-xl border border-gray-200/80 space-y-2.5">
                <div className="text-[11px] text-gray-600">
                  Service Category တစ်ခုချင်းစီအတွက် လျှော့ဈေး % ထည့်ပါ (0% ထားပါက ၎င်း Category မပါဝင်ပါ)
                </div>
                <div className="divide-y divide-gray-200/80 bg-white rounded-xl border border-gray-200 overflow-hidden">
                  {categories.map((cat) => {
                    const currentPct = Number(form.categoryDiscounts?.[cat.id]) || 0;
                    return (
                      <div key={cat.id} className="p-3 space-y-2">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-bold text-gray-900 truncate">{cat.title}</span>
                          <div className="flex items-center gap-1.5 shrink-0">
                            <input
                              type="number"
                              min="0"
                              max="100"
                              value={currentPct}
                              onChange={(e) => setCategoryPercent(cat.id, Number(e.target.value))}
                              className="w-16 min-h-[36px] px-2 py-1 border border-gray-300 rounded-lg text-xs font-black text-center text-[#123524] outline-none focus:border-[#123524] tabular-nums"
                            />
                            <span className="text-xs font-bold text-gray-500">%</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-1">
                          {QUICK_CATEGORY_PERCENTS.map((qPct) => (
                            <button
                              key={qPct}
                              type="button"
                              onClick={() => setCategoryPercent(cat.id, qPct)}
                              className={`flex-1 py-1 rounded-md text-[10px] font-bold tabular-nums border transition ${
                                currentPct === qPct
                                  ? 'bg-[#123524] text-[#D4AF37] border-[#123524]'
                                  : 'bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100'
                              }`}
                            >
                              {qPct === 0 ? 'OFF' : `${qPct}%`}
                            </button>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Common Title, Description, Duration */}
            <div className="space-y-3 pt-1">
              <div>
                <label className="text-[11px] font-bold text-gray-600 block mb-1">
                  Promotion / Campaign ခေါင်းစဉ် *
                </label>
                <input
                  type="text"
                  required
                  value={form.campaignTitle}
                  onChange={(e) => setForm({ ...form, campaignTitle: e.target.value })}
                  placeholder={
                    form.promoType === 'mini_game'
                      ? 'ဥပမာ - သင်္ကြန် အထူးကံစမ်းမဲ Mini Game'
                      : form.promoType === 'category_discount'
                      ? 'ဥပမာ - Body Scrub & Massage အထူးလျှော့ဈေး'
                      : 'ဥပမာ - Weekend Special 20% OFF'
                  }
                  className="w-full min-h-[42px] px-3 py-2 border border-gray-300 rounded-xl text-xs font-bold outline-none focus:border-[#123524]"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-bold text-gray-600 block mb-1">Booking Box ခေါင်းစဉ်</label>
                  <input
                    type="text"
                    value={form.boxTitle}
                    onChange={(e) => setForm({ ...form, boxTitle: e.target.value })}
                    placeholder="ဥပမာ - SPECIAL PROMO"
                    className="w-full min-h-[42px] px-3 py-2 border border-gray-300 rounded-xl text-xs font-bold outline-none focus:border-[#123524]"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-gray-600 block mb-1">Event Tag (Optional)</label>
                  <input
                    type="text"
                    value={form.badgeText || ''}
                    onChange={(e) => setForm({ ...form, badgeText: e.target.value })}
                    placeholder="ဥပမာ - LIMITED OFFER"
                    className="w-full min-h-[42px] px-3 py-2 border border-gray-300 rounded-xl text-xs font-bold outline-none focus:border-[#123524]"
                  />
                </div>
              </div>

              <div>
                <label className="text-[11px] font-bold text-gray-600 block mb-1">
                  အကျဉ်းချုပ် စာသား (Customer Popup & Box တွင် ပြသရန်)
                </label>
                <input
                  type="text"
                  value={form.description || ''}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="ဥပမာ - သတ်မှတ်ရက်အတွင်း ဘိုကင်တင်သူတိုင်း ခံစားခွင့်ရမည်"
                  className="w-full min-h-[42px] px-3 py-2 border border-gray-300 rounded-xl text-xs outline-none focus:border-[#123524]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-bold text-gray-600 block mb-1">စတင်ရက် (Start Date) *</label>
                  <input
                    type="date"
                    required
                    value={form.startDate}
                    onChange={(e) => setForm({ ...form, startDate: e.target.value })}
                    className="w-full min-h-[42px] px-3 py-2 border border-gray-300 rounded-xl text-xs font-mono outline-none focus:border-[#123524]"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-gray-600 block mb-1">ပြီးဆုံးရက် (End Date) *</label>
                  <input
                    type="date"
                    required
                    value={form.endDate}
                    onChange={(e) => setForm({ ...form, endDate: e.target.value })}
                    className="w-full min-h-[42px] px-3 py-2 border border-gray-300 rounded-xl text-xs font-mono outline-none focus:border-[#123524]"
                  />
                </div>
              </div>

              <div>
                <label className="text-[11px] font-bold text-gray-600 block mb-1.5">Card Theme</label>
                <div className="grid grid-cols-4 gap-2">
                  {THEME_PRESETS.map((t) => (
                    <button
                      key={t.value}
                      type="button"
                      onClick={() => setForm({ ...form, themeColor: t.value })}
                      className={`min-h-[38px] px-2 py-1.5 rounded-xl border text-[10px] font-bold flex items-center justify-center gap-1.5 transition ${
                        form.themeColor === t.value
                          ? 'border-[#123524] bg-emerald-50 text-[#123524]'
                          : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
                      }`}
                    >
                      <span className={`w-3 h-3 rounded-full shrink-0 ${t.swatch}`} />
                      <span className="truncate">{t.label.split(' ')[0]}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* STEP 3: DISPLAY CHANNELS */}
          <div className="space-y-2.5 pt-4 border-t border-gray-100">
            <label className="text-[11px] font-black text-[#123524] uppercase tracking-wider block">
              3. Customer App တွင် ပြသမည့် ပုံစံ (Display Channels)
            </label>

            <div className="space-y-2">
              <label className="min-h-[54px] flex items-center justify-between gap-3 p-3 rounded-xl border border-gray-200 bg-gray-50/80 cursor-pointer">
                <div className="min-w-0">
                  <div className="text-xs font-bold text-gray-900">{meta.boxTitle}</div>
                  <div className="text-[11px] text-gray-500 mt-0.5">{meta.boxDesc}</div>
                </div>
                <input
                  type="checkbox"
                  checked={form.isBoxActive}
                  onChange={(e) => setForm({ ...form, isBoxActive: e.target.checked })}
                  className="w-5 h-5 accent-[#123524] shrink-0"
                />
              </label>

              <label className="min-h-[54px] flex items-center justify-between gap-3 p-3 rounded-xl border border-gray-200 bg-gray-50/80 cursor-pointer">
                <div className="min-w-0">
                  <div className="text-xs font-bold text-gray-900">{meta.popupTitle}</div>
                  <div className="text-[11px] text-gray-500 mt-0.5">{meta.popupDesc}</div>
                </div>
                <input
                  type="checkbox"
                  checked={form.isPopupActive}
                  onChange={(e) => setForm({ ...form, isPopupActive: e.target.checked })}
                  className="w-5 h-5 accent-[#123524] shrink-0"
                />
              </label>
            </div>
          </div>
        </div>

        {/* Sticky Modal Footer */}
        <div className="px-5 py-3.5 border-t border-gray-100 bg-white grid grid-cols-2 gap-2.5 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="min-h-[44px] bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-xs font-bold transition"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="min-h-[44px] bg-[#123524] hover:bg-[#1a4a32] text-[#D4AF37] rounded-xl text-xs font-black shadow-xs transition"
          >
            {submitting ? 'Saving...' : mode === 'create' ? 'Create Promotion' : 'Save Changes'}
          </button>
        </div>
      </form>
    </div>
  );
}

// ============================================================================
// MAIN PROMOTION & CAMPAIGNS WORKSPACE
// ============================================================================
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

  const serviceCategories = useMemo(() => {
    const raw = Array.isArray(appData?.categories) ? appData!.categories : [];
    if (raw.length > 0) return raw.map((c) => ({ id: c.id, title: c.title }));
    return [
      { id: 'massage', title: 'Massage' },
      { id: 'body_scrub', title: 'Body Scrub' },
      { id: 'waxing', title: 'Waxing' },
      { id: 'hotel_service', title: 'Hotel & Home Services' },
    ];
  }, [appData?.categories]);

  const categoryTitleMap = useMemo(() => {
    const m: Record<string, string> = {};
    serviceCategories.forEach((c) => {
      m[c.id] = c.title;
    });
    if (m['hotel_service'] && !m['hotel']) m['hotel'] = m['hotel_service'];
    if (m['hotel'] && !m['hotel_service']) m['hotel_service'] = m['hotel'];
    return m;
  }, [serviceCategories]);

  const [subView, setSubView] = useState<'cards_studio' | 'winners_tracker'>(() => {
    try {
      const saved = sessionStorage.getItem(SUBTAB_STORAGE_KEY);
      if (saved === 'cards_studio' || saved === 'winners_tracker') return saved;
    } catch {}
    return 'cards_studio';
  });

  const [typeFilter, setTypeFilter] = useState<'all' | PromotionType>('all');

  const handleSetSubView = (view: 'cards_studio' | 'winners_tracker') => {
    setSubView(view);
    try {
      sessionStorage.setItem(SUBTAB_STORAGE_KEY, view);
    } catch {}
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

  // Campaign Cards State (Real-time synced with Firestore settings/appData)
  const [campaignCards, setCampaignCards] = useState<SavedCampaignCard[]>(DEFAULT_SAVED_CAMPAIGNS);
  const [livePromotion, setLivePromotion] = useState<any>(appData?.promotion || null);
  const [savingPromoId, setSavingPromoId] = useState<string | null>(null);
  const [expandedCards, setExpandedCards] = useState<Record<string, boolean>>({});
  const [modalMode, setModalMode] = useState<'create' | 'edit' | null>(null);
  const [modalCard, setModalCard] = useState<SavedCampaignCard | null>(null);

  // Game Winners State
  const [records, setRecords] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [applyingBookingId, setApplyingBookingId] = useState<string | null>(null);
  const [sendingWinnerId, setSendingWinnerId] = useState<string | null>(null);
  const [broadcastingCardId, setBroadcastingCardId] = useState<string | null>(null);
  const [dateFilterMode, setDateFilterMode] = useState<'today' | 'yesterday' | 'this_month' | 'all_time' | 'custom_range'>('all_time');
  const [fromDate, setFromDate] = useState(todayStr);
  const [toDate, setToDate] = useState(todayStr);
  const [statusFilter, setStatusFilter] = useState<'all' | 'active_unused' | 'used_completed' | 'expired'>('all');
  const [campaignFilter, setCampaignFilter] = useState<string>('all');
  const [tierFilter, setTierFilter] = useState<number | 'all'>('all');

  const getYesterdayStr = () => addDaysToDateStr(-1);
  const getThisMonthPrefix = () => todayStr.slice(0, 7);

  // 1. Live Listener for settings/appData
  useEffect(() => {
    const unsubSettings = onSnapshot(doc(db, 'settings', 'appData'), (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        const remotePromo = data.promotion || null;
        setLivePromotion(remotePromo);

        if (Array.isArray(data.savedCampaignCards) && data.savedCampaignCards.length > 0) {
          const normalized = data.savedCampaignCards.map(normalizeCard);
          setCampaignCards(normalized);
          const liveCard = normalized.find((c) => c.isPopupActive || c.isBoxActive);
          if (liveCard) {
            setExpandedCards((prev) =>
              Object.keys(prev).length === 0 ? { [liveCard.id]: true } : prev
            );
          }
        } else if (remotePromo) {
          const isPopupOn = Boolean(remotePromo.isPopupActive && !remotePromo.allOff);
          const isBoxOn = Boolean(remotePromo.isBoxActive && !remotePromo.allOff);
          const mergedDefaults = DEFAULT_SAVED_CAMPAIGNS.map((c, idx) =>
            idx === 0
              ? normalizeCard({
                  ...c,
                  promoType: resolvePromotionType(remotePromo),
                  campaignTitle: remotePromo.campaignTitle || c.campaignTitle,
                  boxTitle: remotePromo.boxTitle || c.boxTitle,
                  hotelDiscountPercent: remotePromo.hotelDiscountPercent ?? c.hotelDiscountPercent,
                  otherDiscountPercent: remotePromo.otherDiscountPercent ?? c.otherDiscountPercent,
                  categoryDiscounts: remotePromo.categoryDiscounts || c.categoryDiscounts,
                  startDate: remotePromo.startDate || c.startDate,
                  endDate: remotePromo.endDate || c.endDate,
                  isPopupActive: isPopupOn,
                  isBoxActive: isBoxOn,
                })
              : c
          );
          setCampaignCards(mergedDefaults);
        }
      }
    });
    return () => unsubSettings();
  }, []);

  // 2. Live Listener for campaign_records
  useEffect(() => {
    const q = query(collection(db, 'campaign_records'));
    const unsub = onSnapshot(q, (snap) => {
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() } as any));
      list.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
      setRecords(list);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  // Sync to Firestore & local appData cleanly (strictly isolates active promoType fields!)
  const syncCampaignCardsToFirestore = async (
    updatedCards: SavedCampaignCard[],
    activeCardForGlobal: SavedCampaignCard | null
  ) => {
    const isPopupOn = Boolean(activeCardForGlobal?.isPopupActive);
    const isBoxOn = Boolean(activeCardForGlobal?.isBoxActive);
    const isAnyOn = isPopupOn || isBoxOn;
    const activeType: PromotionType = activeCardForGlobal ? resolvePromotionType(activeCardForGlobal) : 'percentage_discount';

    const newGlobalPromo = activeCardForGlobal && isAnyOn
      ? {
          promoType: activeType,
          gameStyle: activeType === 'mini_game' ? resolveMiniGameStyle(activeCardForGlobal) : undefined,
          isActive: true,
          allOff: false,
          isPopupActive: isPopupOn,
          popupEnabled: isPopupOn,
          miniGamePopup: activeType === 'mini_game' ? isPopupOn : false,
          isBoxActive: isBoxOn,
          campaignTitle: activeCardForGlobal.campaignTitle,
          boxTitle: activeCardForGlobal.boxTitle,
          description: activeCardForGlobal.description || '',
          // Strictly isolate offer values by promoType (prevents cross-type leakage)
          hotelDiscountPercent: activeType === 'percentage_discount' ? Number(activeCardForGlobal.hotelDiscountPercent) || 0 : 0,
          otherDiscountPercent: activeType === 'percentage_discount' ? Number(activeCardForGlobal.otherDiscountPercent) || 0 : 0,
          gameRewardTiers: activeType === 'mini_game' ? (activeCardForGlobal.gameRewardTiers || [10, 15, 20, 30, 50]) : [],
          rewardProbabilities:
            activeType === 'mini_game'
              ? activeCardForGlobal.rewardProbabilities ||
                buildDefaultRewardProbabilities(activeCardForGlobal.gameRewardTiers || [10, 15, 20, 30, 50])
              : {},
          outcallRewardCap: activeType === 'mini_game' ? Number(activeCardForGlobal.outcallRewardCap ?? 10) : 10,
          rewardValidityDays: activeType === 'mini_game' ? Math.max(1, Number(activeCardForGlobal.rewardValidityDays) || 1) : 1,
          telegramAutoNotify: activeType === 'mini_game' ? activeCardForGlobal.telegramAutoNotify !== false : false,
          categoryDiscounts: activeType === 'category_discount' ? (activeCardForGlobal.categoryDiscounts || {}) : {},
          startDate: activeCardForGlobal.startDate,
          endDate: activeCardForGlobal.endDate,
          activeCampaignId: activeCardForGlobal.id,
          updatedAt: Date.now(),
        }
      : {
          promoType: 'percentage_discount' as PromotionType,
          isActive: false,
          allOff: true,
          isPopupActive: false,
          popupEnabled: false,
          miniGamePopup: false,
          isBoxActive: false,
          campaignTitle: '',
          boxTitle: '',
          description: '',
          hotelDiscountPercent: 0,
          otherDiscountPercent: 0,
          gameRewardTiers: [],
          rewardProbabilities: {},
          outcallRewardCap: 10,
          rewardValidityDays: 1,
          telegramAutoNotify: false,
          categoryDiscounts: {},
          startDate: '',
          endDate: '',
          activeCampaignId: '',
          updatedAt: Date.now(),
        };

    await setDoc(
      doc(db, 'settings', 'appData'),
      {
        savedCampaignCards: updatedCards,
        promotion: newGlobalPromo,
      },
      { merge: true }
    );

    setCampaignCards(updatedCards);
    setLivePromotion(newGlobalPromo);
    if (onSettingsUpdated && appData) {
      onSettingsUpdated({ ...appData, promotion: newGlobalPromo, savedCampaignCards: updatedCards } as any);
    }
  };

  // Channel Toggle with Smart Expired-Date Guard
  const executeToggleCardChannel = async (
    targetCard: SavedCampaignCard,
    action: 'toggle_popup' | 'toggle_box' | 'master_toggle',
    extendDates?: { startDate: string; endDate: string }
  ) => {
    setSavingPromoId(targetCard.id);
    try {
      const cardWithDates = extendDates
        ? { ...targetCard, startDate: extendDates.startDate, endDate: extendDates.endDate }
        : targetCard;

      let nextPopup = cardWithDates.isPopupActive;
      let nextBox = cardWithDates.isBoxActive;

      if (action === 'toggle_popup') {
        nextPopup = !cardWithDates.isPopupActive;
      } else if (action === 'toggle_box') {
        nextBox = !cardWithDates.isBoxActive;
      } else if (action === 'master_toggle') {
        const currentlyLive = cardWithDates.isPopupActive || cardWithDates.isBoxActive;
        if (currentlyLive) {
          nextPopup = false;
          nextBox = false;
        } else {
          // Activate sensible default channel by type (Mini Game -> Popup+Box, Discounts -> Box+Popup)
          nextPopup = true;
          nextBox = true;
        }
      }

      const willBecomeActive = nextPopup || nextBox;

      const updatedCards = campaignCards.map((c) => {
        if (c.id === targetCard.id) {
          return {
            ...cardWithDates,
            isPopupActive: nextPopup,
            isBoxActive: nextBox,
            updatedAt: Date.now(),
          };
        }
        // Only one promotion card live at a time so discounts never conflict
        if (willBecomeActive) {
          return { ...c, isPopupActive: false, isBoxActive: false };
        }
        return c;
      });

      const activeCard = updatedCards.find((c) => c.isPopupActive || c.isBoxActive) || null;
      await syncCampaignCardsToFirestore(updatedCards, activeCard);

      if (willBecomeActive) {
        const channels = [nextPopup ? 'Popup & Link' : '', nextBox ? 'Booking Box' : ''].filter(Boolean).join(' + ');
        showToast(`"${cardWithDates.campaignTitle}" ဖွင့်ပြီးပါပြီ (${channels})`, 'success');
      } else {
        showToast(`"${cardWithDates.campaignTitle}" ပိတ်ပြီးပါပြီ`, 'info');
      }
    } catch (err) {
      console.error(err);
      showToast('Promotion အခြေအနေ ပြောင်းလဲရာတွင် အမှားအယွင်းရှိနေပါသည်။', 'error');
    } finally {
      setSavingPromoId(null);
    }
  };

  const handleToggleCardChannel = (
    targetCard: SavedCampaignCard,
    action: 'toggle_popup' | 'toggle_box' | 'master_toggle'
  ) => {
    const turningOn =
      (action === 'toggle_popup' && !targetCard.isPopupActive) ||
      (action === 'toggle_box' && !targetCard.isBoxActive) ||
      (action === 'master_toggle' && !targetCard.isPopupActive && !targetCard.isBoxActive);

    const isExpired = Boolean(targetCard.endDate && targetCard.endDate < todayStr);

    if (turningOn && isExpired) {
      const nextEnd = addDaysToDateStr(14);
      setConfirmDialog({
        title: 'Promotion ရက်စွဲ ကုန်ဆုံးနေပါသည်',
        message: `"${targetCard.campaignTitle}" ၏ ပြီးဆုံးရက် (${targetCard.endDate}) ကျော်လွန်နေပြီဖြစ်၍ Customer App တွင် ပေါ်မည်မဟုတ်ပါ။ ယနေ့မှစ၍ ၁၄ ရက်သက်တမ်းတိုးပြီး ဖွင့်မည်လား?`,
        confirmLabel: `၁၄ ရက်တိုးပြီး ဖွင့်မည် (${nextEnd})`,
        secondaryLabel: 'ရက်စွဲကိုယ်တိုင်ပြင်မည်',
        tone: 'primary',
        onConfirm: () => executeToggleCardChannel(targetCard, action, { startDate: todayStr, endDate: nextEnd }),
        onSecondary: () => {
          setModalMode('edit');
          setModalCard(targetCard);
        },
      });
      return;
    }

    executeToggleCardChannel(targetCard, action);
  };

  const handleTurnOffAllPromotionsNow = () => {
    setConfirmDialog({
      title: 'Promotion နှင့် Popup အားလုံး ပိတ်မည်လား?',
      message: 'Customer App နှင့် POS ရှိ Promotion, Mini Game နှင့် Promo Box များအားလုံးကို ချက်ချင်းပိတ်သိမ်းပါမည်။',
      confirmLabel: 'အားလုံးပိတ်မည်',
      tone: 'danger',
      onConfirm: async () => {
        setSavingPromoId('turn_off_all');
        try {
          const allOffCards = campaignCards.map((c) => ({
            ...c,
            isPopupActive: false,
            isBoxActive: false,
            updatedAt: Date.now(),
          }));
          await syncCampaignCardsToFirestore(allOffCards, null);
          showToast('Customer App ရှိ Promotion နှင့် Popup အားလုံးကို ပိတ်သိမ်းပြီးပါပြီ။', 'success');
        } catch {
          showToast('ပိတ်သိမ်းရာတွင် အမှားအယွင်းရှိနေပါသည်။', 'error');
        } finally {
          setSavingPromoId(null);
        }
      },
    });
  };

  const openCreateModal = (defaultType?: PromotionType) => {
    const pType = defaultType || (typeFilter !== 'all' ? typeFilter : 'percentage_discount');
    setModalMode('create');
    setModalCard({
      id: `camp_${Date.now()}`,
      promoType: pType,
      gameStyle: pType === 'mini_game' ? 'christmas_santa' : undefined,
      campaignTitle: '',
      boxTitle: pType === 'mini_game' ? 'CHRISTMAS SANTA GIFT' : 'SPECIAL PROMO',
      description: '',
      isPopupActive: true,
      isBoxActive: true,
      hotelDiscountPercent: pType === 'percentage_discount' ? 10 : 0,
      otherDiscountPercent: pType === 'percentage_discount' ? 20 : 0,
      gameRewardTiers: [10, 15, 20, 30, 50],
      rewardProbabilities: { ...DEFAULT_CHRISTMAS_PROBABILITIES },
      outcallRewardCap: 10,
      rewardValidityDays: 3,
      telegramAutoNotify: true,
      categoryDiscounts: {},
      startDate: todayStr,
      endDate: addDaysToDateStr(14),
      themeColor: pType === 'mini_game' ? THEME_PRESETS[1].value : THEME_PRESETS[0].value,
      badgeText: PROMO_TYPE_META[pType].kicker,
      updatedAt: Date.now(),
    });
  };

  const handleQuickAddChristmasSantaCampaign = async () => {
    setSavingPromoId('add_christmas');
    try {
      const preset = buildChristmasSantaPresetCard(todayStr);
      const updatedCards = [preset, ...campaignCards];
      const activeCard = updatedCards.find((c) => c.isPopupActive || c.isBoxActive) || null;
      await syncCampaignCardsToFirestore(updatedCards, activeCard);
      setExpandedCards((prev) => ({ ...prev, [preset.id]: true }));
      showToast('Christmas Santa Campaign ထည့်သွင်းပြီးပါပြီ! Activate နှိပ်၍ စတင်ဖွင့်နိုင်ပါသည်။', 'success');
    } catch {
      showToast('Christmas Campaign ထည့်သွင်းရာတွင် အမှားအယွင်းရှိနေပါသည်။', 'error');
    } finally {
      setSavingPromoId(null);
    }
  };

  const handleBroadcastCampaignCard = (card: SavedCampaignCard) => {
    setConfirmDialog({
      title: 'Telegram Subscribers များထံ ပို့မည်လား?',
      message: `"${card.campaignTitle}" ကို Telegram Bot ချိတ်ထားသော Customer များအားလုံးထံ တိုက်ရိုက် ကံစမ်းနိုင်သည့် ခလုတ်နှင့်အတူ ပေးပို့မည် သေချာပါသလား?`,
      confirmLabel: 'Telegram မှ ပေးပို့မည်',
      tone: 'primary',
      onConfirm: async () => {
        setBroadcastingCardId(card.id);
        try {
          const tiers = card.gameRewardTiers?.length ? card.gameRewardTiers : [10, 15, 20, 30, 50];
          const res = await broadcastCampaignAnnouncementToTelegram({
            campaignId: card.id,
            campaignTitle: card.campaignTitle,
            description: card.description,
            gameStyle: resolveMiniGameStyle(card),
            maxDiscountPercent: Math.max(...tiers),
            endDate: card.endDate,
          });
          if (res.error) {
            showToast(res.error, 'error');
          } else {
            showToast(
              `Telegram Broadcast ပေးပို့ပြီးပါပြီ (${res.successCount}/${res.totalTargeted} ဦး အောင်မြင်သည်)`,
              'success'
            );
          }
        } catch {
          showToast('Telegram Broadcast ပေးပို့ရာတွင် အမှားအယွင်းရှိနေပါသည်။', 'error');
        } finally {
          setBroadcastingCardId(null);
        }
      },
    });
  };

  const handleDuplicateCard = async (card: SavedCampaignCard) => {
    const cloned: SavedCampaignCard = {
      ...card,
      id: `camp_${Date.now()}`,
      campaignTitle: `${card.campaignTitle} (Copy)`,
      isPopupActive: false,
      isBoxActive: false,
      startDate: todayStr,
      endDate: addDaysToDateStr(14),
      updatedAt: Date.now(),
    };
    const updatedCards = [cloned, ...campaignCards];
    const activeCard = updatedCards.find((c) => c.isPopupActive || c.isBoxActive) || null;
    try {
      await syncCampaignCardsToFirestore(updatedCards, activeCard);
      setExpandedCards((prev) => ({ ...prev, [cloned.id]: true }));
      showToast('Promotion ကဒ်ကို ပွားပြီးပါပြီ (Copy)', 'success');
    } catch {
      showToast('ပွားရာတွင် အမှားအယွင်းရှိနေပါသည်။', 'error');
    }
  };

  const handleSaveModalCard = async (savedCard: SavedCampaignCard) => {
    const isNowActive = savedCard.isPopupActive || savedCard.isBoxActive;
    let updatedCards: SavedCampaignCard[];

    if (modalMode === 'create') {
      updatedCards = [
        savedCard,
        ...campaignCards.map((c) => (isNowActive ? { ...c, isPopupActive: false, isBoxActive: false } : c)),
      ];
    } else {
      updatedCards = campaignCards.map((c) => {
        if (c.id === savedCard.id) return savedCard;
        return isNowActive ? { ...c, isPopupActive: false, isBoxActive: false } : c;
      });
    }

    const activeCard = updatedCards.find((c) => c.isPopupActive || c.isBoxActive) || null;
    await syncCampaignCardsToFirestore(updatedCards, activeCard);
    setModalMode(null);
    setModalCard(null);
    setExpandedCards((prev) => ({ ...prev, [savedCard.id]: true }));
    showToast(
      modalMode === 'create'
        ? `"${savedCard.campaignTitle}" ဖန်တီးပြီးပါပြီ။`
        : `"${savedCard.campaignTitle}" ပြင်ဆင်သိမ်းဆည်းပြီးပါပြီ။`,
      'success'
    );
  };

  const handleDeleteCard = (card: SavedCampaignCard) => {
    if (campaignCards.length <= 1) {
      showToast('အနည်းဆုံး Promotion ကဒ် (၁) ခု ကျန်ရှိရပါမည်။', 'info');
      return;
    }
    setConfirmDialog({
      title: 'Promotion ကဒ် ဖျက်မည်လား?',
      message: `"${card.campaignTitle}" ကို အပြီးတိုင် ဖျက်ပစ်မည် သေချာပါသလား?`,
      confirmLabel: 'ဖျက်မည်',
      tone: 'danger',
      onConfirm: async () => {
        const updatedCards = campaignCards.filter((c) => c.id !== card.id);
        const activeCard = updatedCards.find((c) => c.isPopupActive || c.isBoxActive) || null;
        await syncCampaignCardsToFirestore(updatedCards, activeCard);
        showToast(`"${card.campaignTitle}" ဖျက်ပြီးပါပြီ။`, 'success');
      },
    });
  };

  // Filtered Cards by Type
  const filteredCards = useMemo(() => {
    if (typeFilter === 'all') return campaignCards;
    return campaignCards.filter((c) => resolvePromotionType(c) === typeFilter);
  }, [campaignCards, typeFilter]);

  const typeCounts = useMemo(() => {
    const counts = { percentage_discount: 0, mini_game: 0, category_discount: 0 };
    campaignCards.forEach((c) => {
      counts[resolvePromotionType(c)]++;
    });
    return counts;
  }, [campaignCards]);

  // Helper: Shareable URL for a card based on its exact Promo Type
  const getShareUrlForCard = (card: SavedCampaignCard) => {
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    if (card.promoType === 'mini_game') {
      return `${origin}/?mode=campaign&campaign=${encodeURIComponent(card.id)}`;
    }
    return `${origin}/?promo=${encodeURIComponent(card.id)}`;
  };

  // Helper: Render clean unboxed offer summary string for any card
  const getOfferSummaryLine = (card: SavedCampaignCard): string => {
    if (card.promoType === 'mini_game') {
      const tiers = card.gameRewardTiers?.length ? [...card.gameRewardTiers].sort((a, b) => a - b) : [10, 15, 20, 30, 50];
      const styleLabel = resolveMiniGameStyle(card) === 'christmas_santa' ? 'Santa Gift Sack' : 'Lantern Game';
      const minT = tiers[0];
      const maxT = tiers[tiers.length - 1];
      const days = Math.max(1, Number(card.rewardValidityDays) || 1);
      const topOdds = card.rewardProbabilities?.[maxT];
      const topOddsStr = topOdds !== undefined ? ` · ${maxT}% (${topOdds}%)` : '';
      return `${styleLabel} · ${minT === maxT ? `${maxT}%` : `${minT}%–${maxT}%`}${topOddsStr} · ${days}d`;
    }
    if (card.promoType === 'category_discount') {
      const entries = Object.entries(card.categoryDiscounts || {})
        .filter(([, pct]) => Number(pct) > 0)
        .map(([catId, pct]) => `${categoryTitleMap[catId] || catId} ${pct}%`);
      return entries.length > 0 ? entries.join(' · ') : 'No categories selected';
    }
    const parts: string[] = [];
    if (card.otherDiscountPercent > 0) parts.push(`In-Spa ${card.otherDiscountPercent}%`);
    if (card.hotelDiscountPercent > 0) parts.push(`Outcall ${card.hotelDiscountPercent}%`);
    return parts.length > 0 ? parts.join(' · ') : '0% Discount';
  };

  const hasChristmasSantaCard = useMemo(
    () =>
      campaignCards.some(
        (c) => resolvePromotionType(c) === 'mini_game' && resolveMiniGameStyle(c) === 'christmas_santa'
      ),
    [campaignCards]
  );

  // =========================================================================
  // GAME WINNERS ENRICHMENT & FILTERS
  // =========================================================================
  const enrichedRecords = useMemo(() => {
    const activeValidityDays = Math.max(1, Number(livePromotion?.rewardValidityDays) || 1);
    const todayMs = new Date(`${todayStr}T00:00:00`).getTime();

    return records.map((r) => {
      const rawDate = String(r.date || '').trim();
      let cleanDate = todayStr;
      const isoMatch = rawDate.match(/^(\d{4}-\d{2}-\d{2})/);
      if (isoMatch) {
        cleanDate = isoMatch[1];
      } else if (r.createdAt) {
        const dt = new Date(r.createdAt);
        cleanDate = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
      }

      const usage = isCampaignRewardUsedByCompletedService(r.phone || '', cleanDate, bookings);
      const recValidity = Math.max(1, Number(r.rewardValidityDays) || activeValidityDays);
      const recMs = new Date(`${cleanDate}T00:00:00`).getTime();
      const diffDays = isNaN(recMs) ? 999 : Math.floor((todayMs - recMs) / (1000 * 60 * 60 * 24));
      const isWithinValidity = diffDays >= 0 && diffDays < recValidity;

      let rewardStatus: 'used_completed' | 'active_unused' | 'expired' = 'expired';
      if (r.manualRedeemed === true || usage.isUsed) {
        rewardStatus = 'used_completed';
      } else if (isWithinValidity) {
        rewardStatus = 'active_unused';
      }

      const activeBookingNeedsDiscount = Boolean(
        !r.manualRedeemed &&
          usage.activePendingBooking &&
          (!usage.activePendingBooking.discountPercent || Number(usage.activePendingBooking.discountPercent) === 0)
      );

      return {
        ...r,
        cleanDate,
        rewardStatus,
        completedBooking: usage.completedBooking,
        activePendingBooking: usage.activePendingBooking,
        activeBookingNeedsDiscount,
      };
    });
  }, [records, bookings, todayStr, livePromotion?.rewardValidityDays]);

  const availableCampaignTitles = useMemo(() => {
    const titles = new Set<string>();
    enrichedRecords.forEach((r) => {
      if (r.title) titles.add(String(r.title));
    });
    return Array.from(titles);
  }, [enrichedRecords]);

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

      if (campaignFilter !== 'all' && String(r.title || '') !== campaignFilter) return false;
      if (tierFilter !== 'all' && Number(r.discountPercent) !== tierFilter) return false;

      if (q) {
        const matchPhone = String(r.phone || '').toLowerCase().includes(q);
        const matchPct = `${r.discountPercent}%`.includes(q);
        const matchCode = String(r.promoCode || '').toLowerCase().includes(q);
        const matchTitle = String(r.title || '').toLowerCase().includes(q);
        const matchCustName =
          (r.customerName || '').toLowerCase().includes(q) ||
          (r.completedBooking?.name || '').toLowerCase().includes(q) ||
          (r.activePendingBooking?.name || '').toLowerCase().includes(q);
        if (!matchPhone && !matchPct && !matchCode && !matchTitle && !matchCustName) return false;
      }
      return true;
    });
  }, [enrichedRecords, dateFilterMode, fromDate, toDate, search, todayStr, campaignFilter, tierFilter]);

  const finalFilteredRecords = useMemo(() => {
    if (statusFilter === 'all') return dateAndSearchFiltered;
    return dateAndSearchFiltered.filter((r) => r.rewardStatus === statusFilter);
  }, [dateAndSearchFiltered, statusFilter]);

  const summaryStats = useMemo(() => {
    const total = dateAndSearchFiltered.length;
    let usedCount = 0;
    let activeCount = 0;
    let expiredCount = 0;
    const tierCounts: Record<number, number> = { 10: 0, 15: 0, 20: 0, 30: 0, 50: 0 };

    dateAndSearchFiltered.forEach((r) => {
      if (r.rewardStatus === 'used_completed') usedCount++;
      else if (r.rewardStatus === 'active_unused') activeCount++;
      else expiredCount++;
      const p = Number(r.discountPercent) || 0;
      if (p > 0) tierCounts[p] = (tierCounts[p] || 0) + 1;
    });

    return { total, usedCount, activeCount, expiredCount, tierCounts };
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

    const cap = Math.max(0, Number(livePromotion?.outcallRewardCap ?? 10));
    const appliedPct = isOutcall ? Math.min(cap, winnerRecord.discountPercent) : winnerRecord.discountPercent;
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

  const handleToggleManualRedeemed = async (record: any) => {
    const nextRedeemed = !record.manualRedeemed;
    try {
      await updateDoc(doc(db, 'campaign_records', record.id), {
        manualRedeemed: nextRedeemed,
        redeemedAt: nextRedeemed ? Date.now() : null,
      });
      showToast(
        nextRedeemed
          ? `${record.phone} (${record.discountPercent}% OFF) ကို သုံးပြီးပြီဟု မှတ်သားပြီးပါပြီ။`
          : `${record.phone} ၏ Redeem အခြေအနေကို ပြန်ဖွင့်ပြီးပါပြီ။`,
        'success'
      );
    } catch {
      showToast('Redeem အခြေအနေ ပြောင်းလဲရာတွင် အမှားအယွင်းရှိနေပါသည်။', 'error');
    }
  };

  const handleSendWinnerBotVoucher = async (record: any) => {
    setSendingWinnerId(record.id);
    try {
      const linkedB = record.completedBooking || record.activePendingBooking;
      const res = await notifyCampaignWinnerToTelegram({
        campaignId: record.campaignId,
        campaignTitle: record.title || 'Christmas Santa Gift Campaign',
        gameStyle: record.gameStyle || resolveMiniGameStyle({ title: record.title }),
        customerName: record.customerName || linkedB?.name || 'VIP Guest',
        customerPhone: record.phone,
        customerChatId: record.customerChatId || linkedB?.customerChatId || linkedB?.telegramChatId,
        discountPercent: Number(record.discountPercent) || 10,
        promoCode: record.promoCode || `XMAS-${record.discountPercent}`,
        rewardValidityDays: Number(record.rewardValidityDays || livePromotion?.rewardValidityDays) || 1,
        outcallRewardCap: Number(record.outcallRewardCap ?? livePromotion?.outcallRewardCap ?? 10),
        winDate: record.cleanDate || todayStr,
        sendToAdmin: false,
        sendToCustomer: true,
      });

      if (res.customerSent) {
        await updateDoc(doc(db, 'campaign_records', record.id), {
          telegramNotiCustomerSent: true,
          telegramNotiAt: Date.now(),
          ...(res.customerChatId ? { customerChatId: res.customerChatId } : {}),
        }).catch(() => {});
        showToast(`${record.phone} ၏ Telegram Bot ထံ Voucher ပေးပို့ပြီးပါပြီ။`, 'success');
      } else {
        showToast(
          'Customer သည် Telegram Bot နှင့် မချိတ်ဆက်ရသေးပါ — တိုက်ရိုက် Telegram Chat ဖြင့် ဆက်သွယ်နိုင်ပါသည်။',
          'info'
        );
        handleContactUser(record.phone, record.discountPercent);
      }
    } catch {
      showToast('Telegram Bot ပေးပို့ရာတွင် အမှားအယွင်းရှိနေပါသည်။', 'error');
    } finally {
      setSendingWinnerId(null);
    }
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
      `မင်္ဂလာပါခင်ဗျာ။ The Shangri-La Men's Retreat မှ ဆက်သွယ်တာပါ။ \nလူကြီးမင်း ကံထူးရရှိထားသော အထူး Discount (${discount}% OFF) အား လာရောက်အသုံးပြုနိုင်ပါပြီခင်ဗျာ။`
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
      'Campaign',
      'Promo Code',
      'Phone Number',
      'Customer Name',
      'Discount Won (%)',
      'Reward Status',
      'Telegram Bot Noti',
      'Booking / Receipt Status',
      'Invoice / TxID',
    ];
    const rows = finalFilteredRecords.map((r) => {
      const statusText =
        r.rewardStatus === 'used_completed'
          ? r.manualRedeemed
            ? 'သုံးပြီးပြီ (Manual Redeem)'
            : 'သုံးပြီးပြီ (Used - Service Completed)'
          : r.rewardStatus === 'active_unused'
          ? 'မသုံးရသေး (Active)'
          : 'သက်တမ်းကုန်ဆုံး (Expired)';
      const linkedB = r.completedBooking || r.activePendingBooking;
      const botStatus = r.telegramNotiCustomerSent
        ? 'Customer + Admin Sent'
        : r.telegramNotiAdminSent
        ? 'Admin Sent'
        : r.telegramClicked
        ? 'Manual Telegram'
        : 'App Only';
      return [
        `"${r.cleanDate}"`,
        `"${r.title || 'Campaign'}"`,
        `"${r.promoCode || `PROMO-${r.discountPercent}`}"`,
        `"${r.phone}"`,
        `"${r.customerName || linkedB?.name || '-'}"`,
        `${r.discountPercent}%`,
        `"${statusText}"`,
        `"${botStatus}"`,
        `"${linkedB ? linkedB.status.toUpperCase() : 'No Booking'}"`,
        `"${linkedB?.txId || '-'}"`,
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

  // Live Status Derived Values
  const isAnyGlobalPromoLive = Boolean(
    !livePromotion?.allOff && (livePromotion?.isPopupActive || livePromotion?.isBoxActive || livePromotion?.isActive)
  );
  const isLivePromoExpired = Boolean(
    isAnyGlobalPromoLive && livePromotion?.endDate && livePromotion.endDate < todayStr
  );
  const livePromoType: PromotionType = resolvePromotionType(livePromotion);
  const activeCardObj = campaignCards.find((c) => c.isPopupActive || c.isBoxActive) || null;
  const allCardsExpanded = filteredCards.length > 0 && filteredCards.every((c) => expandedCards[c.id]);

  const liveOfferHeadline = useMemo(() => {
    if (!isAnyGlobalPromoLive) return 'OFF';
    if (livePromoType === 'mini_game') {
      const tiers =
        Array.isArray(livePromotion?.gameRewardTiers) && livePromotion.gameRewardTiers.length > 0
          ? livePromotion.gameRewardTiers.map(Number)
          : [10, 15, 20, 30, 50];
      return `Up to ${Math.max(...tiers)}%`;
    }
    if (livePromoType === 'category_discount') {
      const vals = Object.values((livePromotion?.categoryDiscounts || {}) as Record<string, number>)
        .map(Number)
        .filter((v) => v > 0);
      return vals.length > 0 ? `${vals.length} Categories` : '0 Categories';
    }
    return `${livePromotion?.otherDiscountPercent || 0}% / ${livePromotion?.hotelDiscountPercent || 0}%`;
  }, [isAnyGlobalPromoLive, livePromoType, livePromotion]);

  const liveOfferSubtext = !isAnyGlobalPromoLive
    ? 'No Active Offer'
    : livePromoType === 'mini_game'
    ? 'Mini Game Rewards'
    : livePromoType === 'category_discount'
    ? 'Category-Specific %'
    : 'In-Spa · Outcall';

  const liveChannelsLabel = !isAnyGlobalPromoLive
    ? 'OFF'
    : livePromotion?.isPopupActive && livePromotion?.isBoxActive
    ? 'Popup + Box'
    : livePromotion?.isPopupActive
    ? 'Popup & Link'
    : 'Booking Box';

  return (
    <div className="space-y-4 sm:space-y-5 animate-fade-in pb-10">
      {/* =========================================================================
          1. EXECUTIVE PROMOTION CONTROL HEADER (SINGLE-ELEVATION, TYPE-AWARE)
         ========================================================================= */}
      <div className="bg-gradient-to-br from-[#0B2419] via-[#123524] to-[#0B2419] rounded-2xl sm:rounded-3xl p-4 sm:p-6 text-white shadow-md border border-[#C8A951]/25 relative overflow-hidden">
        <div className="absolute -right-12 -top-12 w-44 h-44 rounded-full bg-[#C8A951]/10 blur-2xl pointer-events-none" />

        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3.5 pb-4 border-b border-white/10">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] font-semibold text-gray-300">
              <span className="text-[#D4AF37] uppercase tracking-wider font-bold">Promotion Hub</span>
              <span className="text-white/30">·</span>
              <span
                className={
                  isAnyGlobalPromoLive
                    ? isLivePromoExpired
                      ? 'text-amber-300 font-bold'
                      : 'text-emerald-300 font-bold'
                    : 'text-gray-400 font-bold'
                }
              >
                {isAnyGlobalPromoLive
                  ? isLivePromoExpired
                    ? `Active (${PROMO_TYPE_META[livePromoType].shortLabel} · Date Expired)`
                    : `Live · ${PROMO_TYPE_META[livePromoType].shortLabel}`
                  : 'All OFF'}
              </span>
            </div>

            <h2 className="text-lg sm:text-2xl font-serif font-bold text-[#D4AF37] tracking-tight mt-1 flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-[#D4AF37] shrink-0" />
              <span className="truncate">Promotion & Campaigns</span>
            </h2>

            <p className="text-xs text-gray-300 mt-1">
              {isAnyGlobalPromoLive
                ? `လက်ရှိဖွင့်ထားသည်: ${livePromotion?.campaignTitle || 'Active Promotion'}`
                : '% Discount၊ Mini Game Campaign နှင့် Service Category Discount များကို သီးခြားစီ စီမံနိုင်ပါသည်'}
            </p>
          </div>

          {isAnyGlobalPromoLive && (
            <button
              type="button"
              disabled={savingPromoId === 'turn_off_all'}
              onClick={handleTurnOffAllPromotionsNow}
              className="w-full sm:w-auto min-h-[44px] px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-black shadow-sm transition flex items-center justify-center gap-2 shrink-0"
            >
              <Ban className="w-4 h-4 shrink-0" />
              <span>{savingPromoId === 'turn_off_all' ? 'Turning Off...' : 'Promotion အားလုံးပိတ်မည်'}</span>
            </button>
          )}
        </div>

        {/* Expired Live Campaign Warning */}
        {isLivePromoExpired && (
          <div className="mt-3.5 p-3 rounded-xl bg-amber-500/15 border border-amber-400/40 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-xs">
            <div className="flex items-start gap-2 text-amber-100">
              <AlertCircle className="w-4 h-4 text-amber-300 shrink-0 mt-0.5" />
              <span>
                လက်ရှိဖွင့်ထားသော Promotion ၏ ပြီးဆုံးရက် (<strong>{livePromotion?.endDate}</strong>) ကျော်လွန်နေသဖြင့် Customer App တွင် ပေါ်မည်မဟုတ်ပါ။
              </span>
            </div>
            {activeCardObj && (
              <button
                type="button"
                onClick={() => {
                  setModalMode('edit');
                  setModalCard(activeCardObj);
                }}
                className="self-start sm:self-auto px-3 py-1.5 rounded-lg bg-[#D4AF37] text-[#0B2419] font-black text-[11px] shrink-0"
              >
                ရက်စွဲပြင်မည်
              </button>
            )}
          </div>
        )}

        {/* 4 Clean Type-Aware KPI Tiles */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 pt-4">
          <div className="bg-black/20 border border-white/10 rounded-xl p-3">
            <div className="text-[10px] font-bold text-gray-300 uppercase tracking-wider">Active Type</div>
            <div
              className={`text-sm sm:text-base font-black mt-0.5 truncate ${
                isAnyGlobalPromoLive ? 'text-emerald-300' : 'text-gray-400'
              }`}
            >
              {isAnyGlobalPromoLive ? PROMO_TYPE_META[livePromoType].shortLabel : 'None (OFF)'}
            </div>
            <div className="text-[10px] text-gray-400 truncate mt-0.5">
              {isAnyGlobalPromoLive && livePromotion?.endDate ? `Until ${livePromotion.endDate}` : 'Ready to launch'}
            </div>
          </div>

          <div className="bg-black/20 border border-white/10 rounded-xl p-3">
            <div className="text-[10px] font-bold text-gray-300 uppercase tracking-wider">Display Channel</div>
            <div
              className={`text-sm sm:text-base font-black mt-0.5 truncate ${
                isAnyGlobalPromoLive ? 'text-white' : 'text-gray-400'
              }`}
            >
              {liveChannelsLabel}
            </div>
            <div className="text-[10px] text-gray-400 truncate mt-0.5">Customer App & POS</div>
          </div>

          <div className="bg-black/20 border border-white/10 rounded-xl p-3">
            <div className="text-[10px] font-bold text-gray-300 uppercase tracking-wider">Active Offer</div>
            <div className="text-sm sm:text-base font-black text-[#D4AF37] mt-0.5 tabular-nums truncate">
              {liveOfferHeadline}
            </div>
            <div className="text-[10px] text-gray-400 truncate mt-0.5">{liveOfferSubtext}</div>
          </div>

          <button
            type="button"
            onClick={() => handleSetSubView('winners_tracker')}
            className="text-left bg-black/20 hover:bg-black/30 border border-white/10 rounded-xl p-3 transition"
          >
            <div className="text-[10px] font-bold text-gray-300 uppercase tracking-wider">Game Winners</div>
            <div className="text-sm sm:text-base font-black text-white mt-0.5 tabular-nums">
              {records.length} <span className="text-xs font-semibold text-gray-400">ဦး</span>
            </div>
            <div className="text-[10px] text-emerald-300 tabular-nums mt-0.5">
              Active Valid: {enrichedRecords.filter((r) => r.rewardStatus === 'active_unused').length}
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
          className={`min-h-[44px] px-3 py-2 rounded-xl text-xs font-black transition flex items-center justify-center gap-2 whitespace-nowrap ${
            subView === 'cards_studio'
              ? 'bg-[#0B2419] text-[#D4AF37] shadow-xs'
              : 'text-gray-600 hover:bg-gray-100'
          }`}
        >
          <Sparkles className="w-4 h-4 shrink-0" />
          <span>Promotions</span>
          <span className="tabular-nums opacity-80">({campaignCards.length})</span>
        </button>

        <button
          type="button"
          onClick={() => handleSetSubView('winners_tracker')}
          className={`min-h-[44px] px-3 py-2 rounded-xl text-xs font-black transition flex items-center justify-center gap-2 whitespace-nowrap ${
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
          VIEW 1: 3-TYPE PROMOTIONS & CAMPAIGNS STUDIO
         ========================================================================= */}
      {subView === 'cards_studio' && (
        <div className="space-y-4 animate-fade-in">
          {/* Action & Type Filter Toolbar */}
          <div className="bg-white p-4 rounded-2xl border border-gray-200/90 shadow-xs space-y-3.5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-sm sm:text-base font-black text-[#123524] flex items-center gap-2">
                  <Gift className="w-4 h-4 text-[#D4AF37]" />
                  <span>Promotion Types & Saved Cards</span>
                </h3>
                <p className="text-[11px] text-gray-500 mt-0.5">
                  % Discount၊ Mini Game နှင့် Service Category Discount များကို အမျိုးအစားခွဲ၍ စီမံနိုင်ပါသည်
                </p>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    const next = !allCardsExpanded;
                    const map: Record<string, boolean> = {};
                    filteredCards.forEach((c) => {
                      map[c.id] = next;
                    });
                    setExpandedCards(map);
                  }}
                  className="min-h-[42px] px-3 py-2 rounded-xl text-xs font-bold text-gray-600 hover:text-[#123524] hover:bg-gray-100 transition whitespace-nowrap"
                >
                  {allCardsExpanded ? 'Collapse All' : 'Expand All'}
                </button>

                <button
                  type="button"
                  onClick={() => openCreateModal()}
                  className="flex-1 sm:flex-none min-h-[42px] px-4 py-2 rounded-xl bg-[#123524] hover:bg-[#1a4a32] text-[#D4AF37] text-xs font-black flex items-center justify-center gap-1.5 shadow-xs transition whitespace-nowrap"
                >
                  <PlusCircle className="w-4 h-4 shrink-0" />
                  <span>New Promotion</span>
                </button>
              </div>
            </div>

            {/* Interactive Type Filter Segmented Bar */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 bg-gray-100/90 p-1 rounded-xl">
              {(
                [
                  { id: 'all', label: 'All Types', count: campaignCards.length },
                  { id: 'percentage_discount', label: '% Discount', count: typeCounts.percentage_discount },
                  { id: 'mini_game', label: 'Mini Game', count: typeCounts.mini_game },
                  { id: 'category_discount', label: 'By Category', count: typeCounts.category_discount },
                ] as const
              ).map((item) => {
                const active = typeFilter === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setTypeFilter(item.id)}
                    className={`min-h-[38px] px-2.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 whitespace-nowrap ${
                      active
                        ? 'bg-white text-[#123524] shadow-xs'
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    {item.id !== 'all' && <PromoTypeIcon type={item.id} className="w-3.5 h-3.5 shrink-0" />}
                    <span>{item.label}</span>
                    <span className="text-[11px] opacity-70 tabular-nums">({item.count})</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 1-Click Ready-Made Christmas Santa Campaign Installer (shown only if not yet in saved cards) */}
          {!hasChristmasSantaCard && (
            <div className="bg-gradient-to-r from-[#7f1d1d] via-[#123524] to-[#0B2419] rounded-2xl p-4 text-white border border-[#D4AF37]/40 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-start sm:items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-xl bg-[#D4AF37]/20 border border-[#D4AF37]/50 flex items-center justify-center text-[#FDE68A] shrink-0">
                  <Snowflake className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <div className="text-xs sm:text-sm font-black text-[#FDE68A]">
                    Christmas Santa Gift Sack Campaign (အသင့်သုံး)
                  </div>
                  <p className="text-[11px] text-gray-200 mt-0.5 leading-snug">
                    10% (55%) · 15% (23%) · 20% (14%) · 30% (7%) · 50% (1% — 1 in 100) + Telegram Bot Auto-Noti
                  </p>
                </div>
              </div>
              <button
                type="button"
                disabled={savingPromoId === 'add_christmas'}
                onClick={handleQuickAddChristmasSantaCampaign}
                className="w-full sm:w-auto min-h-[42px] px-4 py-2 rounded-xl bg-[#D4AF37] hover:bg-[#c59b27] text-[#0B2419] text-xs font-black shrink-0 transition flex items-center justify-center gap-1.5"
              >
                <Gift className="w-4 h-4 shrink-0" />
                <span>{savingPromoId === 'add_christmas' ? 'Adding...' : 'Christmas Campaign ထည့်သွင်းမည်'}</span>
              </button>
            </div>
          )}

          {/* Empty State for Selected Filter */}
          {filteredCards.length === 0 ? (
            <div className="bg-white rounded-2xl border border-gray-200/90 p-8 text-center space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-[#123524] flex items-center justify-center mx-auto">
                <PromoTypeIcon type={typeFilter === 'all' ? 'percentage_discount' : typeFilter} className="w-6 h-6" />
              </div>
              <div>
                <h4 className="text-sm font-black text-gray-900">
                  {typeFilter === 'all'
                    ? 'Promotion ကဒ် မရှိသေးပါ'
                    : `${PROMO_TYPE_META[typeFilter].title} ကဒ် မရှိသေးပါ`}
                </h4>
                <p className="text-xs text-gray-500 mt-1">
                  အောက်ပါခလုတ်ကိုနှိပ်ပြီး အသစ်ဖန်တီးနိုင်ပါသည်
                </p>
              </div>
              <button
                type="button"
                onClick={() => openCreateModal(typeFilter === 'all' ? 'percentage_discount' : typeFilter)}
                className="min-h-[42px] px-5 py-2 rounded-xl bg-[#123524] text-[#D4AF37] text-xs font-black inline-flex items-center gap-1.5"
              >
                <PlusCircle className="w-4 h-4" />
                <span>
                  {typeFilter === 'all'
                    ? 'Promotion အသစ် ဖန်တီးမည်'
                    : `${PROMO_TYPE_META[typeFilter].shortLabel} အသစ် ဖန်တီးမည်`}
                </span>
              </button>
            </div>
          ) : (
            /* Type-Pure Single-Elevation Promotion Cards Grid */
            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
              {filteredCards.map((card) => {
                const pType = resolvePromotionType(card);
                const meta = PROMO_TYPE_META[pType];
                const isCardLive = Boolean(card.isPopupActive || card.isBoxActive);
                const isSavingThis = savingPromoId === card.id;
                const isExpanded = Boolean(expandedCards[card.id]);
                const isExpired = Boolean(card.endDate && card.endDate < todayStr);
                const isScheduled = Boolean(card.startDate && card.startDate > todayStr);
                const shareUrl = getShareUrlForCard(card);
                const isLinkAccessible =
                  pType === 'mini_game'
                    ? Boolean((card.isPopupActive || card.isBoxActive) && !isExpired)
                    : Boolean(card.isPopupActive && !isExpired);

                return (
                  <div
                    key={card.id}
                    className={`bg-white rounded-2xl border overflow-hidden flex flex-col transition-all ${
                      isCardLive
                        ? 'border-[#D4AF37] shadow-md ring-1 ring-[#D4AF37]/30'
                        : 'border-gray-200/90 shadow-xs'
                    }`}
                  >
                    {/* Card Theme Header */}
                    <div
                      className={`p-4 bg-gradient-to-br ${
                        card.themeColor || THEME_PRESETS[0].value
                      } text-white`}
                    >
                      <div className="flex items-center justify-between gap-2 text-[10px] font-bold uppercase tracking-wider mb-1.5">
                        <span className="inline-flex items-center gap-1.5 text-[#D4AF37] truncate">
                          <PromoTypeIcon type={pType} className="w-3.5 h-3.5 shrink-0" />
                          <span className="truncate">{meta.kicker}</span>
                        </span>
                        <span
                          className={`font-black shrink-0 ${
                            isCardLive ? 'text-emerald-300' : 'text-gray-300/80'
                          }`}
                        >
                          {isCardLive ? 'ACTIVE' : 'OFF'}
                        </span>
                      </div>

                      <h4 className="text-base font-black text-[#D4AF37] leading-snug">{card.campaignTitle}</h4>
                      <div className="text-[11px] text-gray-300 font-medium mt-0.5 truncate">
                        Box: {card.boxTitle || 'SPECIAL PROMO'}
                        {card.badgeText && card.badgeText !== meta.kicker ? ` · ${card.badgeText}` : ''}
                      </div>
                    </div>

                    {/* Clean Unboxed Offer Summary Strip (Strictly Type-Specific!) */}
                    <div className="px-4 py-3.5 space-y-3 flex-1 flex flex-col">
                      <div className="space-y-1.5">
                        <div className="text-xs font-extrabold text-[#123524] leading-snug tabular-nums">
                          {getOfferSummaryLine(card)}
                        </div>

                        <div className="flex flex-wrap items-center justify-between gap-2 text-[11px]">
                          <div className="flex items-center gap-1.5 font-mono font-semibold text-gray-600 tabular-nums">
                            <Calendar className="w-3.5 h-3.5 text-[#D4AF37] shrink-0" />
                            <span>
                              {card.startDate || '-'} → {card.endDate || '-'}
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

                        <div className="flex items-center gap-2 text-[11px] font-semibold text-gray-500">
                          <span className={card.isBoxActive ? 'text-emerald-700 font-bold' : 'text-gray-400'}>
                            Booking Box {card.isBoxActive ? 'ON' : 'OFF'}
                          </span>
                          <span className="text-gray-300">·</span>
                          <span className={card.isPopupActive ? 'text-emerald-700 font-bold' : 'text-gray-400'}>
                            Popup & Link {card.isPopupActive ? 'ON' : 'OFF'}
                          </span>
                        </div>
                      </div>

                      {/* Primary Action Row */}
                      <div className="flex items-center gap-2 pt-1 mt-auto">
                        <button
                          type="button"
                          disabled={isSavingThis}
                          onClick={() => handleToggleCardChannel(card, 'master_toggle')}
                          className={`flex-1 min-h-[44px] px-3 py-2 rounded-xl text-xs font-black tracking-wide transition ${
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
                            const ok = await safeCopyText(shareUrl);
                            showToast(
                              ok
                                ? isLinkAccessible
                                  ? `"${card.campaignTitle}" Link ကူးယူပြီးပါပြီ`
                                  : 'Link ကူးယူပြီးပါပြီ (မှတ်ချက် - Popup/Card ဖွင့်ထားပြီး သက်တမ်းအတွင်းဖြစ်မှ အလုပ်လုပ်ပါမည်)'
                                : shareUrl,
                              'info'
                            );
                          }}
                          className="min-h-[44px] px-3 py-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-800 text-xs font-bold flex items-center gap-1.5 transition shrink-0"
                        >
                          <Copy className="w-3.5 h-3.5 shrink-0" />
                          <span>Link</span>
                        </button>

                        <button
                          type="button"
                          aria-label={isExpanded ? 'Collapse details' : 'Expand details'}
                          onClick={() => setExpandedCards((prev) => ({ ...prev, [card.id]: !prev[card.id] }))}
                          className="min-h-[44px] min-w-[44px] rounded-xl border border-gray-200 hover:bg-gray-100 text-gray-700 flex items-center justify-center transition shrink-0"
                        >
                          <ChevronDown
                            className={`w-4 h-4 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}
                          />
                        </button>
                      </div>
                    </div>

                    {/* Collapsible Controls Drawer (Type-Aware Toggles + Direct Link + Actions) */}
                    {isExpanded && (
                      <div className="px-4 pb-4 pt-3 border-t border-gray-100 bg-gray-50/70 space-y-3">
                        {/* Channel 1: Booking Promo Box */}
                        <div className="flex items-center justify-between gap-3 py-1">
                          <div className="min-w-0">
                            <div className="text-xs font-bold text-gray-900">{meta.boxTitle}</div>
                            <div className="text-[11px] text-gray-500 leading-snug">{meta.boxDesc}</div>
                          </div>
                          <button
                            type="button"
                            role="switch"
                            aria-checked={card.isBoxActive}
                            disabled={isSavingThis}
                            onClick={() => handleToggleCardChannel(card, 'toggle_box')}
                            className={`relative inline-flex h-7 w-12 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ${
                              card.isBoxActive ? 'bg-emerald-600' : 'bg-gray-300'
                            }`}
                          >
                            <span
                              className={`pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow transition duration-200 ${
                                card.isBoxActive ? 'translate-x-5' : 'translate-x-0'
                              }`}
                            />
                          </button>
                        </div>

                        <div className="h-px bg-gray-200/80" />

                        {/* Channel 2: Popup & Shareable Direct Link */}
                        <div className="flex items-center justify-between gap-3 py-1">
                          <div className="min-w-0">
                            <div className="text-xs font-bold text-gray-900">{meta.popupTitle}</div>
                            <div className="text-[11px] text-gray-500 leading-snug">{meta.popupDesc}</div>
                          </div>
                          <button
                            type="button"
                            role="switch"
                            aria-checked={card.isPopupActive}
                            disabled={isSavingThis}
                            onClick={() => handleToggleCardChannel(card, 'toggle_popup')}
                            className={`relative inline-flex h-7 w-12 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ${
                              card.isPopupActive ? 'bg-emerald-600' : 'bg-gray-300'
                            }`}
                          >
                            <span
                              className={`pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow transition duration-200 ${
                                card.isPopupActive ? 'translate-x-5' : 'translate-x-0'
                              }`}
                            />
                          </button>
                        </div>

                        <div className="h-px bg-gray-200/80" />

                        {/* Direct Shareable URL */}
                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between text-[11px] font-bold">
                            <span className="text-gray-600 flex items-center gap-1">
                              <Globe className="w-3.5 h-3.5 text-[#123524]" />
                              {pType === 'mini_game' ? 'Direct Game Link' : 'Direct Promo Link'}
                            </span>
                            <span className={isLinkAccessible ? 'text-emerald-700' : 'text-red-500 flex items-center gap-1'}>
                              {!isLinkAccessible && <Lock className="w-3 h-3" />}
                              {isLinkAccessible ? 'Live' : isExpired ? 'Expired' : 'Locked'}
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <input
                              type="text"
                              readOnly
                              value={shareUrl}
                              className="flex-1 min-w-0 text-[11px] font-mono bg-white border border-gray-200 rounded-lg px-2.5 py-2 text-gray-700 outline-none"
                            />
                            <button
                              type="button"
                              onClick={async () => {
                                const ok = await safeCopyText(shareUrl);
                                showToast(ok ? 'Link ကူးယူပြီးပါပြီ' : shareUrl, 'info');
                              }}
                              className="min-h-[36px] px-3 py-1.5 rounded-lg bg-[#123524] text-[#D4AF37] text-[11px] font-bold shrink-0"
                            >
                              Copy
                            </button>
                          </div>
                        </div>

                        {/* Mini Game Telegram Bot Integration Strip */}
                        {pType === 'mini_game' && (
                          <div className="pt-1 flex items-center justify-between gap-2">
                            <div className="text-[11px] text-gray-600 font-semibold">
                              Telegram Bot Winner Noti:{' '}
                              <span className={card.telegramAutoNotify !== false ? 'text-emerald-700 font-bold' : 'text-gray-400'}>
                                {card.telegramAutoNotify !== false ? 'ON' : 'OFF'}
                              </span>
                            </div>
                            <button
                              type="button"
                              disabled={broadcastingCardId === card.id}
                              onClick={() => handleBroadcastCampaignCard(card)}
                              className="min-h-[34px] px-3 py-1 rounded-lg bg-sky-50 hover:bg-sky-100 text-sky-700 border border-sky-200 text-[11px] font-bold flex items-center gap-1.5 transition shrink-0"
                            >
                              <Send className="w-3 h-3 shrink-0" />
                              <span>{broadcastingCardId === card.id ? 'Sending...' : 'Telegram Broadcast'}</span>
                            </button>
                          </div>
                        )}

                        {/* Secondary Card Actions: Edit, Duplicate, Delete */}
                        <div className="flex items-center justify-between gap-2 pt-2 border-t border-gray-200/80">
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => handleDeleteCard(card)}
                              className="min-h-[38px] px-2.5 py-1.5 rounded-lg text-red-600 hover:bg-red-50 text-xs font-bold flex items-center gap-1 transition"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              <span>Delete</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDuplicateCard(card)}
                              className="min-h-[38px] px-2.5 py-1.5 rounded-lg text-gray-600 hover:bg-gray-200/70 text-xs font-bold flex items-center gap-1 transition"
                            >
                              <Files className="w-3.5 h-3.5" />
                              <span>Copy</span>
                            </button>
                          </div>

                          <button
                            type="button"
                            onClick={() => {
                              setModalMode('edit');
                              setModalCard(card);
                            }}
                            className="min-h-[38px] px-3.5 py-1.5 rounded-lg bg-white hover:bg-gray-100 border border-gray-300 text-gray-800 text-xs font-bold flex items-center gap-1.5 transition"
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
          )}
        </div>
      )}

      {/* =========================================================================
          VIEW 2: MINI GAME WINNERS TRACKER (MOBILE CARDS + DESKTOP TABLE)
         ========================================================================= */}
      {subView === 'winners_tracker' && (
        <div className="space-y-4 animate-fade-in">
          <div className="bg-white p-4 rounded-2xl border border-gray-200/90 shadow-xs space-y-3.5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-sm sm:text-base font-black text-[#123524] flex items-center gap-2">
                  <PartyPopper className="w-4 h-4 text-[#D4AF37]" />
                  <span>Mini Game Winners Tracker</span>
                </h3>
                <p className="text-[11px] text-gray-500 mt-0.5">
                  ဂိမ်းကစားပြီး Discount ကံထူးထားသော Customer စာရင်းနှင့် အသုံးပြုပြီးမှု အခြေအနေ
                </p>
              </div>
              <button
                type="button"
                onClick={handleExportCSV}
                className="w-full sm:w-auto min-h-[42px] px-4 py-2 rounded-xl bg-[#123524] hover:bg-[#1a4a32] text-[#D4AF37] text-xs font-black flex items-center justify-center gap-1.5 shrink-0 transition"
              >
                <Download className="w-4 h-4" />
                <span>Export CSV ({finalFilteredRecords.length})</span>
              </button>
            </div>

            {/* Search Input */}
            <div className="relative">
              <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="ဖုန်းနံပါတ်၊ Customer အမည် သို့မဟုတ် Discount % ဖြင့် ရှာရန်..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full min-h-[44px] pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-medium outline-none focus:border-[#123524] focus:bg-white transition"
              />
            </div>

            {/* Date Filter Segmented Row */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5">
              {(
                [
                  { id: 'today', label: 'ယနေ့' },
                  { id: 'yesterday', label: 'မနေ့က' },
                  { id: 'this_month', label: 'ယခုလ' },
                  { id: 'all_time', label: 'အားလုံး' },
                  { id: 'custom_range', label: 'ရက်စွဲရွေး' },
                ] as const
              ).map((btn) => (
                <button
                  key={btn.id}
                  type="button"
                  onClick={() => setDateFilterMode(btn.id)}
                  className={`min-h-[36px] px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition ${
                    dateFilterMode === btn.id
                      ? 'bg-[#123524] text-[#D4AF37]'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {btn.label}
                </button>
              ))}
            </div>

            {dateFilterMode === 'custom_range' && (
              <div className="grid grid-cols-2 gap-2.5 pt-1">
                <div>
                  <label className="text-[10px] font-bold text-gray-500 block mb-1">From Date</label>
                  <input
                    type="date"
                    value={fromDate}
                    onChange={(e) => setFromDate(e.target.value)}
                    className="w-full min-h-[40px] px-3 py-1.5 border border-gray-200 rounded-lg text-xs font-mono outline-none focus:border-[#123524]"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-gray-500 block mb-1">To Date</label>
                  <input
                    type="date"
                    value={toDate}
                    onChange={(e) => setToDate(e.target.value)}
                    className="w-full min-h-[40px] px-3 py-1.5 border border-gray-200 rounded-lg text-xs font-mono outline-none focus:border-[#123524]"
                  />
                </div>
              </div>
            )}

            {/* Campaign & Reward Tier Filters */}
            <div className="flex flex-col sm:flex-row sm:items-center gap-2">
              {availableCampaignTitles.length > 1 && (
                <select
                  value={campaignFilter}
                  onChange={(e) => setCampaignFilter(e.target.value)}
                  className="min-h-[38px] px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold text-gray-700 outline-none focus:border-[#123524]"
                >
                  <option value="all">All Campaigns</option>
                  {availableCampaignTitles.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              )}

              <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5">
                {(['all', 50, 30, 20, 15, 10] as const).map((tier) => (
                  <button
                    key={String(tier)}
                    type="button"
                    onClick={() => setTierFilter(tier)}
                    className={`min-h-[36px] px-2.5 py-1 rounded-lg text-[11px] font-bold whitespace-nowrap transition tabular-nums ${
                      tierFilter === tier
                        ? 'bg-[#0B2419] text-[#D4AF37]'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    {tier === 'all' ? 'All Tiers' : tier === 50 ? '50% Jackpot' : `${tier}% OFF`}
                  </button>
                ))}
              </div>
            </div>

            {/* Live Drop-Rate / Tier Distribution Bar */}
            {summaryStats.total > 0 && (
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-gray-600 bg-gray-50/90 border border-gray-200/80 rounded-xl px-3.5 py-2 tabular-nums">
                <span className="font-bold text-[#123524]">Prize Distribution:</span>
                {[10, 15, 20, 30, 50].map((pct) => {
                  const cnt = summaryStats.tierCounts[pct] || 0;
                  const share = summaryStats.total > 0 ? ((cnt / summaryStats.total) * 100).toFixed(1) : '0.0';
                  return (
                    <span key={pct} className={pct === 50 && cnt > 0 ? 'font-black text-amber-700' : 'font-semibold'}>
                      {pct}%: {cnt} ({share}%)
                    </span>
                  );
                })}
              </div>
            )}

            {/* Status Filter KPI Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
              {(
                [
                  { id: 'all', label: 'စုစုပေါင်း', count: summaryStats.total, accent: 'text-gray-900' },
                  { id: 'active_unused', label: 'Active (မသုံးရသေး)', count: summaryStats.activeCount, accent: 'text-amber-700' },
                  { id: 'used_completed', label: 'သုံးပြီးပြီ', count: summaryStats.usedCount, accent: 'text-emerald-700' },
                  { id: 'expired', label: 'သက်တမ်းကုန်', count: summaryStats.expiredCount, accent: 'text-red-600' },
                ] as const
              ).map((stat) => (
                <button
                  key={stat.id}
                  type="button"
                  onClick={() => setStatusFilter(stat.id)}
                  className={`p-3 rounded-xl border text-left transition ${
                    statusFilter === stat.id
                      ? 'bg-emerald-50/70 border-[#123524] shadow-xs'
                      : 'bg-gray-50/70 border-gray-200 hover:bg-gray-100'
                  }`}
                >
                  <div className="text-[11px] font-semibold text-gray-500 truncate">{stat.label}</div>
                  <div className={`text-lg font-black mt-0.5 tabular-nums ${stat.accent}`}>{stat.count}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Winners List (Grouped by Date) */}
          {loading ? (
            <div className="bg-white rounded-2xl border border-gray-200/90 p-10 text-center text-xs font-bold text-gray-400">
              Loading winners...
            </div>
          ) : groupedByDate.length === 0 ? (
            <div className="bg-white rounded-2xl border border-gray-200/90 p-10 text-center text-xs font-bold text-gray-400">
              ရွေးချယ်ထားသော အခြေအနေအတွက် မဲပေါက်မှတ်တမ်း မရှိပါ။
            </div>
          ) : (
            <div className="space-y-4">
              {groupedByDate.map((group) => (
                <div
                  key={group.date}
                  className="bg-white rounded-2xl border border-gray-200/90 shadow-xs overflow-hidden"
                >
                  {/* Date Group Header */}
                  <div className="px-4 py-3 bg-gray-50 border-b border-gray-200/80 flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2 text-xs font-black text-[#123524] font-mono tabular-nums">
                      <Calendar className="w-3.5 h-3.5 text-[#D4AF37]" />
                      <span>{group.date}</span>
                      {group.date === todayStr && (
                        <span className="text-[11px] font-sans font-bold text-emerald-700">· Today</span>
                      )}
                    </div>
                    <div className="text-[11px] font-semibold text-gray-500 tabular-nums">
                      Total {group.items.length} · Used {group.usedCount} · Active {group.activeCount}
                    </div>
                  </div>

                  {/* Mobile Card List (< md) */}
                  <div className="divide-y divide-gray-100 md:hidden">
                    {group.items.map((r) => {
                      const linkedBooking = r.completedBooking || r.activePendingBooking;
                      const isJackpot = Number(r.discountPercent) >= 50;
                      const statusLabel =
                        r.rewardStatus === 'used_completed'
                          ? r.manualRedeemed
                            ? 'သုံးပြီးပြီ (Manual)'
                            : 'သုံးပြီးပြီ'
                          : r.rewardStatus === 'active_unused'
                          ? 'Active (မသုံးရသေး)'
                          : 'သက်တမ်းကုန်';
                      const statusColor =
                        r.rewardStatus === 'used_completed'
                          ? 'text-emerald-700'
                          : r.rewardStatus === 'active_unused'
                          ? 'text-amber-700'
                          : 'text-red-600';

                      return (
                        <div key={r.id} className="p-4 space-y-2.5">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <div className="text-sm font-black text-gray-900 font-mono tabular-nums flex items-center gap-1.5">
                                <span>{r.phone}</span>
                                {isJackpot && <Crown className="w-3.5 h-3.5 text-amber-500 shrink-0" />}
                              </div>
                              <div className="text-[11px] text-gray-500 truncate mt-0.5">
                                {r.customerName || linkedBooking?.name || 'Guest Winner'} ·{' '}
                                <span className="font-mono font-semibold text-gray-700">
                                  {r.promoCode || `PROMO-${r.discountPercent}`}
                                </span>
                              </div>
                              <div className="text-[10.5px] text-gray-400 truncate mt-0.5">
                                {r.title || 'Campaign'}
                                {r.telegramNotiCustomerSent
                                  ? ' · Bot Voucher Sent'
                                  : r.telegramNotiAdminSent
                                  ? ' · Admin Notified'
                                  : ''}
                              </div>
                            </div>
                            <div className="text-right shrink-0">
                              <div
                                className={`text-base font-black tabular-nums ${
                                  isJackpot ? 'text-amber-600' : 'text-[#123524]'
                                }`}
                              >
                                {r.discountPercent}% OFF
                              </div>
                              <div className={`text-[11px] font-bold ${statusColor}`}>{statusLabel}</div>
                            </div>
                          </div>

                          {linkedBooking && (
                            <div className="text-[11px] text-gray-600 bg-gray-50 rounded-lg px-3 py-2 flex items-center justify-between gap-2">
                              <span className="truncate font-semibold">{linkedBooking.service || 'Booking Linked'}</span>
                              <span className="font-mono font-bold text-gray-800 shrink-0 tabular-nums">
                                {formatPrice(linkedBooking.totalPrice)}
                              </span>
                            </div>
                          )}

                          <div className="flex flex-wrap items-center gap-2 pt-0.5">
                            {r.activeBookingNeedsDiscount && r.activePendingBooking && (
                              <button
                                type="button"
                                disabled={applyingBookingId === r.activePendingBooking.id}
                                onClick={() => handleApplyCampaignDiscountToBooking(r, r.activePendingBooking)}
                                className="flex-1 min-h-[40px] px-3 py-1.5 rounded-xl bg-[#123524] text-[#D4AF37] text-xs font-black transition"
                              >
                                {applyingBookingId === r.activePendingBooking.id
                                  ? 'Applying...'
                                  : `Booking တွင် ${r.discountPercent}% ထည့်မည်`}
                              </button>
                            )}

                            {!r.completedBooking && (
                              <button
                                type="button"
                                onClick={() => handleToggleManualRedeemed(r)}
                                className={`min-h-[40px] px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                                  r.manualRedeemed
                                    ? 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                                    : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700'
                                }`}
                              >
                                {r.manualRedeemed ? 'Undo Used' : 'Mark Used'}
                              </button>
                            )}

                            <button
                              type="button"
                              disabled={sendingWinnerId === r.id}
                              onClick={() => handleSendWinnerBotVoucher(r)}
                              className="min-h-[40px] px-3 py-1.5 rounded-xl bg-sky-50 hover:bg-sky-100 text-sky-700 text-xs font-bold flex items-center gap-1.5 transition"
                            >
                              <Send className="w-3.5 h-3.5" />
                              <span>{sendingWinnerId === r.id ? 'Sending...' : 'Bot Voucher'}</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => handleContactUser(r.phone, r.discountPercent)}
                              aria-label="Open Telegram Chat"
                              className="min-h-[40px] min-w-[40px] rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 flex items-center justify-center transition"
                            >
                              <MessageCircle className="w-4 h-4" />
                            </button>

                            {adminRole === 'super_admin' && (
                              <button
                                type="button"
                                onClick={() => handleDeleteRecord(r.id, r.phone)}
                                aria-label="Delete winner record"
                                className="min-h-[40px] min-w-[40px] rounded-xl bg-red-50 hover:bg-red-100 text-red-600 flex items-center justify-center transition ml-auto"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Desktop Table (>= md) */}
                  <div className="hidden md:block overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b border-gray-100 text-[11px] font-bold text-gray-500 uppercase tracking-wider">
                          <th className="py-3 px-4">Phone / Customer</th>
                          <th className="py-3 px-4">Campaign & Code</th>
                          <th className="py-3 px-4">Discount</th>
                          <th className="py-3 px-4">Status</th>
                          <th className="py-3 px-4">Booking Link</th>
                          <th className="py-3 px-4 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 text-xs">
                        {group.items.map((r) => {
                          const linkedBooking = r.completedBooking || r.activePendingBooking;
                          const isJackpot = Number(r.discountPercent) >= 50;
                          return (
                            <tr key={r.id} className="hover:bg-gray-50/70 transition">
                              <td className="py-3 px-4">
                                <div className="font-mono font-bold text-gray-900 tabular-nums flex items-center gap-1.5">
                                  <span>{r.phone}</span>
                                  {isJackpot && <Crown className="w-3.5 h-3.5 text-amber-500 shrink-0" />}
                                </div>
                                <div className="text-[11px] text-gray-500">
                                  {r.customerName || linkedBooking?.name || 'Guest Winner'}
                                  {r.telegramNotiCustomerSent
                                    ? ' · Bot Sent'
                                    : r.telegramNotiAdminSent
                                    ? ' · Admin Notified'
                                    : ''}
                                </div>
                              </td>
                              <td className="py-3 px-4">
                                <div className="font-mono font-bold text-[#123524] tabular-nums">
                                  {r.promoCode || `PROMO-${r.discountPercent}`}
                                </div>
                                <div className="text-[11px] text-gray-500 truncate max-w-[190px]">
                                  {r.title || 'Campaign'}
                                </div>
                              </td>
                              <td
                                className={`py-3 px-4 font-black text-sm tabular-nums ${
                                  isJackpot ? 'text-amber-600' : 'text-[#123524]'
                                }`}
                              >
                                {r.discountPercent}% OFF
                              </td>
                              <td className="py-3 px-4 font-bold">
                                {r.rewardStatus === 'used_completed' ? (
                                  <span className="text-emerald-700">
                                    {r.manualRedeemed ? 'သုံးပြီးပြီ (Manual)' : 'သုံးပြီးပြီ'}
                                  </span>
                                ) : r.rewardStatus === 'active_unused' ? (
                                  <span className="text-amber-700">Active (မသုံးရသေး)</span>
                                ) : (
                                  <span className="text-red-600">သက်တမ်းကုန်</span>
                                )}
                              </td>
                              <td className="py-3 px-4">
                                {linkedBooking ? (
                                  <div>
                                    <div className="font-semibold text-gray-800 truncate max-w-[180px]">
                                      {linkedBooking.service}
                                    </div>
                                    <div className="text-[11px] text-gray-500 font-mono tabular-nums">
                                      {linkedBooking.status.toUpperCase()} · {formatPrice(linkedBooking.totalPrice)}
                                    </div>
                                  </div>
                                ) : (
                                  <span className="text-gray-400">No Booking</span>
                                )}
                              </td>
                              <td className="py-3 px-4 text-right">
                                <div className="inline-flex items-center gap-1.5">
                                  {r.activeBookingNeedsDiscount && r.activePendingBooking && (
                                    <button
                                      type="button"
                                      disabled={applyingBookingId === r.activePendingBooking.id}
                                      onClick={() => handleApplyCampaignDiscountToBooking(r, r.activePendingBooking)}
                                      className="px-2.5 py-1.5 rounded-lg bg-[#123524] text-[#D4AF37] text-[11px] font-black"
                                    >
                                      Apply {r.discountPercent}%
                                    </button>
                                  )}
                                  {!r.completedBooking && (
                                    <button
                                      type="button"
                                      onClick={() => handleToggleManualRedeemed(r)}
                                      className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold ${
                                        r.manualRedeemed
                                          ? 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                                          : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700'
                                      }`}
                                    >
                                      {r.manualRedeemed ? 'Undo' : 'Mark Used'}
                                    </button>
                                  )}
                                  <button
                                    type="button"
                                    disabled={sendingWinnerId === r.id}
                                    onClick={() => handleSendWinnerBotVoucher(r)}
                                    className="px-2.5 py-1.5 rounded-lg bg-sky-50 hover:bg-sky-100 text-sky-700 text-[11px] font-bold inline-flex items-center gap-1"
                                  >
                                    <Send className="w-3 h-3" />
                                    <span>{sendingWinnerId === r.id ? '...' : 'Bot'}</span>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleContactUser(r.phone, r.discountPercent)}
                                    className="p-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700"
                                    title="Direct Telegram Chat"
                                  >
                                    <MessageCircle className="w-3.5 h-3.5" />
                                  </button>
                                  {adminRole === 'super_admin' && (
                                    <button
                                      type="button"
                                      onClick={() => handleDeleteRecord(r.id, r.phone)}
                                      className="p-1.5 rounded-lg bg-red-50 hover:bg-red-100 text-red-600"
                                      title="Delete"
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
          CREATE / EDIT PROMOTION MODAL (GUIDED 3-TYPE WORKFLOW)
         ========================================================================= */}
      {modalMode && modalCard && (
        <PromotionFormModal
          mode={modalMode}
          initialCard={modalCard}
          categories={serviceCategories}
          onClose={() => {
            setModalMode(null);
            setModalCard(null);
          }}
          onSubmit={handleSaveModalCard}
          onError={(msg) => showToast(msg, 'error')}
        />
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
                className={`sm:flex-1 min-h-[42px] px-4 py-2 rounded-xl text-xs font-black transition ${
                  confirmDialog.tone === 'danger'
                    ? 'bg-red-600 hover:bg-red-700 text-white'
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
