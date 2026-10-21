import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  collection,
  doc,
  onSnapshot,
  addDoc,
  deleteDoc,
  setDoc,
  getDoc,
  query,
  orderBy
} from 'firebase/firestore';
import { db } from '../firebase';
import { decryptText } from '../security';
import { Booking, TherapistProfile, formatPrice } from '../shared';
import {
  calculateBookingCommissionForStaff,
  getStaffSeniority,
  isSameStaffMember
} from './StaffPayrollSystem';
import {
  Wallet,
  TrendingUp,
  PieChart,
  PlusCircle,
  Trash2,
  Download,
  Calendar,
  Search,
  Banknote,
  ArrowUpRight,
  ArrowDownRight,
  Save,
  X,
  FileSpreadsheet,
  Settings,
  Edit3,
  Plus,
  RotateCcw,
  ChevronDown,
  ChevronUp,
  Check
} from 'lucide-react';

// ============================================================================
// 🌟 1. SEARCHABLE ICON LIBRARY (65+ CURATED SPA & BUSINESS ICONS) 🌟
// ============================================================================

export interface IconOption {
  emoji: string;
  label: string;
  keywords: string;
}

export const EXPENSE_ICON_LIBRARY: IconOption[] = [
  // Transportation & Travel
  { emoji: '🚕', label: 'Taxi / ကားခ', keywords: 'taxi cab car transport သွားလာရေး တက္ကစီ ကားခကြေး' },
  { emoji: '🚗', label: 'Car / ကြိုပို့ကား', keywords: 'car auto vehicle transport ကား သွားလာရေး' },
  { emoji: '🛵', label: 'Motorbike / ဆိုင်ကယ်', keywords: 'scooter bike delivery ဆိုင်ကယ် ကယ်ရီ ပို့ဆောင်ရေး' },
  { emoji: '⛽', label: 'Fuel / ဆီဖိုး', keywords: 'fuel gas petrol diesel စက်သုံးဆီ ဓာတ်ဆီ ဒီဇယ် မီးစက်ဆီ' },
  { emoji: '✈️', label: 'Travel / ခရီးစရိတ်', keywords: 'flight travel trip outcall ခရီးစရိတ် ပြင်ဦးလွင်' },
  { emoji: '🚌', label: 'Bus / ကားဂိတ်တန်ဆာခ', keywords: 'bus express gate cargo ကားဂိတ် တန်ဆာခ' },

  // Spa Supplies & Consumables
  { emoji: '🧴', label: 'Lotion / အနှိပ်ဆီ', keywords: 'lotion oil bottle shampoo soap ဆိုင်သုံးပစ္စည်း အနှိပ်ဆီ ခေါင်းလျှော်ရည်' },
  { emoji: '🧼', label: 'Soap / ဆပ်ပြာ', keywords: 'soap wash clean hygiene ဆပ်ပြာ ရေချိုးဆပ်ပြာ သန့်ရှင်းရေး' },
  { emoji: '🧖‍♂️', label: 'Spa / သဘက်', keywords: 'spa towel massage steam သဘက် အနှိပ် ပေါင်းခန်း' },
  { emoji: '🕯️', label: 'Candle / Aroma', keywords: 'candle aroma scent wax ဖယောင်းတိုင် အမွှေးနံ့သာ waxing' },
  { emoji: '🧺', label: 'Laundry / လျှော်ဖွပ်ခ', keywords: 'laundry basket towel wash လျှော်ဖွပ်ခ အဝတ်လျှော် အမှိုက်အိတ်' },
  { emoji: '🧹', label: 'Cleaning / သန့်ရှင်းရေး', keywords: 'broom clean trash bag တံမြက်စည်း အမှိုက်အိတ် သန့်ရှင်းရေး' },
  { emoji: '🧻', label: 'Tissue / တစ်ရှူး', keywords: 'tissue paper roll towel တစ်ရှူး စက္ကူ' },
  { emoji: '🪒', label: 'Waxing / Shaving', keywords: 'razor wax shaving ဓား waxing ပစ္စည်း' },
  { emoji: '💊', label: 'Medicine / ဆေးဝါး', keywords: 'medicine first aid health ဆေးဝါး ကျန်းမာရေး' },

  // Utilities, Rent & Maintenance
  { emoji: '🏠', label: 'Shop Rent / ဆိုင်ခန်းငှားခ', keywords: 'house shop rent building ဆိုင်ခန်းငှားခ အိမ်လခ' },
  { emoji: '⚡', label: 'Electricity / မီးမီတာ', keywords: 'electricity power epc light မီးမီတာ လျှပ်စစ်' },
  { emoji: '💧', label: 'Water / ရေမီတာ', keywords: 'water drop drinking bill ရေမီတာ သောက်ရေသန့်' },
  { emoji: '🌐', label: 'WiFi / အင်တာနက်', keywords: 'wifi internet network bill အင်တာနက် ဝိုင်ဖိုင် ဖုန်းဘေလ်' },
  { emoji: '❄️', label: 'Aircon / အဲကွန်း', keywords: 'aircon ac cold cooling အဲကွန်း ပြုပြင်ခ' },
  { emoji: '🔧', label: 'Repair / ပြုပြင်ထိန်းသိမ်း', keywords: 'wrench tool repair maintenance ပြုပြင်ရေး လက်သမား ရေပိုက်' },
  { emoji: '💡', label: 'Light / မီးသီးမီးချောင်း', keywords: 'bulb light lamp မီးသီး မီးချောင်း လျှပ်စစ်ပစ္စည်း' },
  { emoji: '🛋️', label: 'Furniture / ပရိဘောဂ', keywords: 'sofa bed chair furniture ပရိဘောဂ ကုတင် ထိုင်ခုံ' },

  // Food, Meals & Hospitality
  { emoji: '🍱', label: 'Staff Meal / ထမင်းဘူး', keywords: 'bento food staff meal lunch ဝန်ထမ်းစားစရိတ် ထမင်းဖိုး ဟင်းဖိုး' },
  { emoji: '☕', label: 'Coffee / မိမိစားစရိတ်', keywords: 'coffee tea drink owner hospitality ကော်ဖီ လက်ဖက်ရည် မိမိစားစရိတ် ဧည့်ခံ' },
  { emoji: '🍜', label: 'Noodles / မုန့်ဖိုး', keywords: 'noodle soup breakfast snack မနက်စာ မုန့်ဖိုး စားစရိတ်' },
  { emoji: '🥤', label: 'Drinks / အအေး', keywords: 'drink juice water cup အအေး ဧည့်ခံစရိတ်' },
  { emoji: '🎂', label: 'Birthday / ပွဲစရိတ်', keywords: 'cake birthday party celebration မွေးနေ့ ပွဲစရိတ် မုန့်ကျွေး' },

  // Marketing, Office & Finance
  { emoji: '📢', label: 'Marketing / ကြော်ငြာ', keywords: 'marketing ads boost promotion facebook tiktok ကြော်ငြာ မားကတ်တင်း' },
  { emoji: '🎥', label: 'Video / Content', keywords: 'video camera tiktok shoot ရိုက်ကူးရေး ဓာတ်ပုံ ဒီဇိုင်း' },
  { emoji: '🎁', label: 'Gift / လက်ဆောင်', keywords: 'gift present giveaway bonus လက်ဆောင် ပရိုမိုးရှင်း' },
  { emoji: '🖨️', label: 'Print / ဘောင်ချာစာအုပ်', keywords: 'print paper voucher vinyl ဘောင်ချာ စာရေးကိရိယာ ဗီနိုင်း' },
  { emoji: '🏛️', label: 'Tax / အခွန်အခ', keywords: 'tax license government municipal အခွန် လိုင်စင် စည်ပင်' },
  { emoji: '💳', label: 'Debt / အကြွေးဆပ်', keywords: 'credit card debt loan pay အကြွေး ချေးငွေ ဘဏ်' },
  { emoji: '💼', label: 'Salary / လစာ', keywords: 'briefcase salary payroll bonus လစာ ကော်မရှင် ဝန်ထမ်း' },
  { emoji: '👑', label: 'Executive / CEO', keywords: 'crown vip ceo manager ဒါရိုက်တာ မန်နေဂျာ' },
  { emoji: '🤝', label: 'Commission / ပွဲစားခ', keywords: 'handshake partner agent ပွဲစားခ ကော်မရှင် လက်ဆောင်' },
  { emoji: '🙏', label: 'Donation / အလှူအတန်း', keywords: 'pray donation charity merit အလှူ ကုသိုလ် ပရဟိတ' },
  { emoji: '📦', label: 'Package / ပါဆယ်', keywords: 'box parcel delivery stock ပစ္စည်း ပါဆယ် ကုန်ပစ္စည်း' },
  { emoji: '📌', label: 'General / အထွေထွေ', keywords: 'pin general other misc အထွေထွေ အခြား' }
];

export function suggestEmojiForTitle(title: string): string | null {
  const clean = title.toLowerCase().trim();
  if (!clean) return null;
  if (clean.includes('taxi') || clean.includes('တက္ကစီ') || clean.includes('ကားခ') || clean.includes('transport')) return '🚕';
  if (clean.includes('ဆိုင်ကယ်') || clean.includes('bike') || clean.includes('delivery') || clean.includes('ပို့ဆောင်')) return '🛵';
  if (clean.includes('ဆီ') && (clean.includes('မီးစက်') || clean.includes('ဓာတ်ဆီ') || clean.includes('ဒီဇယ်') || clean.includes('fuel'))) return '⛽';
  if (clean.includes('အနှိပ်ဆီ') || clean.includes('lotion') || clean.includes('oil') || clean.includes('ဆိုင်သုံး')) return '🧴';
  if (clean.includes('ဆပ်ပြာ') || clean.includes('soap') || clean.includes('shampoo')) return '🧼';
  if (clean.includes('မီး') || clean.includes('electric') || clean.includes('epc')) return '⚡';
  if (clean.includes('ရေ') || clean.includes('water')) return '💧';
  if (clean.includes('ငှား') || clean.includes('rent')) return '🏠';
  if (clean.includes('အခွန်') || clean.includes('tax') || clean.includes('လိုင်စင်')) return '🏛️';
  if (clean.includes('market') || clean.includes('ကြော်ငြာ') || clean.includes('boost') || clean.includes('ads')) return '📢';
  if (clean.includes('ထမင်း') || clean.includes('ဝန်ထမ်းစား') || clean.includes('meal') || clean.includes('food')) return '🍱';
  if (clean.includes('ကော်ဖီ') || clean.includes('မိမိစား') || clean.includes('coffee') || clean.includes('ဧည့်ခံ')) return '☕';
  if (clean.includes('အကြွေး') || clean.includes('debt') || clean.includes('loan')) return '💳';
  if (clean.includes('wifi') || clean.includes('အင်တာနက်') || clean.includes('internet')) return '🌐';
  if (clean.includes('aircon') || clean.includes('အဲကွန်း')) return '❄️';
  if (clean.includes('အလှူ') || clean.includes('donation')) return '🙏';
  if (clean.includes('ပြုပြင်') || clean.includes('repair')) return '🔧';
  return null;
}

// ============================================================================
// 🌟 2. DEFAULT EXPENSE CATEGORIES 🌟
// ============================================================================

export type ExpenseCategoryId = string;

export interface ExpenseCategoryMeta {
  id: string;
  title: string;
  subTitle: string;
  badgeColor: string;
  barColor: string;
  iconEmoji: string;
  quickPresets: string[];
}

export const DEFAULT_EXPENSE_CATEGORIES: ExpenseCategoryMeta[] = [
  {
    id: 'spa_supplies',
    title: 'ဆိုင်သုံးပစ္စည်းများ',
    subTitle: 'Spa Supplies & Consumables',
    badgeColor: 'bg-emerald-50 text-emerald-800 border-emerald-200',
    barColor: 'bg-emerald-600',
    iconEmoji: '🧴',
    quickPresets: [
      'အနှိပ်ဆီ (Massage Oil)',
      'ရေချိုးဆပ်ပြာ (Body Wash)',
      'ခေါင်းလျှော်ရည် (Shampoo)',
      'အမှိုက်အိတ် (Trash Bags)',
      'Waxing ပစ္စည်းများ',
      'Body Scrub ပစ္စည်းများ',
      'Body Butter / Lotion',
      'တစ်ခါသုံးသဘက် (Towels)',
      'Disposable Underwear',
      'တစ်ရှူး / အရက်ပြန် / သန့်ရှင်းရေး'
    ]
  },
  {
    id: 'shop_rent',
    title: 'ဆိုင်ခန်းငှားခ',
    subTitle: 'Shop Rent & Lease',
    badgeColor: 'bg-indigo-50 text-indigo-800 border-indigo-200',
    barColor: 'bg-indigo-600',
    iconEmoji: '🏠',
    quickPresets: ['လစဉ် ဆိုင်ခန်းငှားခ', 'ဆိုင်ခန်း စပေါ်ငွေ / ကြိုပေးငွေ']
  },
  {
    id: 'electricity',
    title: 'မီးမီတာ / မီးစက်ဆီ',
    subTitle: 'Electricity & Generator Fuel',
    badgeColor: 'bg-amber-50 text-amber-900 border-amber-300',
    barColor: 'bg-amber-500',
    iconEmoji: '⚡',
    quickPresets: ['လစဉ် EPC မီးမီတာခ', 'မီးစက် ဒီဇယ် / ဓာတ်ဆီဖိုး', 'မီးစက် အင်ဂျင်ဝိုင် / ပြုပြင်ခ']
  },
  {
    id: 'water_bill',
    title: 'ရေမီတာ / သောက်ရေသန့်',
    subTitle: 'Water Bill & Drinking Water',
    badgeColor: 'bg-cyan-50 text-cyan-800 border-cyan-200',
    barColor: 'bg-cyan-600',
    iconEmoji: '💧',
    quickPresets: ['လစဉ် ရေမီတာခ', 'သောက်ရေသန့်ဘူးဖိုး', 'ရေစစ် / ရေပိုက်ပြုပြင်ခ']
  },
  {
    id: 'tax_license',
    title: 'အခွန်အခနှင့် လိုင်စင်ကြေး',
    subTitle: 'Tax & Municipal License',
    badgeColor: 'bg-purple-50 text-purple-800 border-purple-200',
    barColor: 'bg-purple-600',
    iconEmoji: '🏛️',
    quickPresets: ['လစဉ် အခွန်အခ', 'စည်ပင် လိုင်စင်ကြေး / သန့်ရှင်းရေးခွန်', 'ဆိုင်းဘုတ်ခွန်']
  },
  {
    id: 'marketing',
    title: 'Marketing စရိတ်',
    subTitle: 'Social Media Ads & Promotions',
    badgeColor: 'bg-pink-50 text-pink-800 border-pink-200',
    barColor: 'bg-pink-600',
    iconEmoji: '📢',
    quickPresets: [
      'TikTok / Facebook Boost Ads',
      'ဘောင်ချာစာအုပ် / လိပ်စာကတ် / Vinyl',
      'Customer Giveaway လက်ဆောင်',
      'Content / Video ရိုက်ကူးရေး'
    ]
  },
  {
    id: 'staff_meals',
    title: 'ဝန်ထမ်း စားစရိတ် / သက်သာ',
    subTitle: 'Staff Meals & Welfare',
    badgeColor: 'bg-orange-50 text-orange-800 border-orange-200',
    barColor: 'bg-orange-500',
    iconEmoji: '🍱',
    quickPresets: [
      'ဝန်ထမ်း နေ့စဉ်ထမင်း/ဟင်းဖိုး',
      'ဝန်ထမ်း မုန့်ဖိုး / လက်ဖက်ရည်ဖိုး',
      'ဝန်ထမ်း ဆေးဝါးစရိတ်',
      'ဝန်ထမ်း ယူနီဖောင်းစရိတ်'
    ]
  },
  {
    id: 'owner_meals',
    title: 'နေ့စဉ် မိမိစားစရိတ် / ဧည့်ခံ',
    subTitle: 'Owner Daily Meals & Hospitality',
    badgeColor: 'bg-teal-50 text-teal-800 border-teal-200',
    barColor: 'bg-teal-600',
    iconEmoji: '☕',
    quickPresets: [
      'နေ့စဉ် မိမိစားစရိတ်',
      'ဧည့်သည် ဧည့်ခံ ကော်ဖီ / အအေး / မုန့်ဖိုး',
      'သွားလာရေး / ဆီဖိုး'
    ]
  },
  {
    id: 'debt_payment',
    title: 'အကြွေးပေးငွေ',
    subTitle: 'Debt & Credit Repayment',
    badgeColor: 'bg-rose-50 text-rose-800 border-rose-200',
    barColor: 'bg-rose-600',
    iconEmoji: '💳',
    quickPresets: ['ဆိုင်သုံးပစ္စည်း အကြွေးဆပ်ငွေ', 'လုပ်ငန်း အကြွေးပေးချေငွေ']
  },
  {
    id: 'maintenance_other',
    title: 'ပြုပြင်ထိန်းသိမ်း / အထွေထွေ',
    subTitle: 'Maintenance & General Misc',
    badgeColor: 'bg-slate-100 text-slate-800 border-slate-300',
    barColor: 'bg-slate-600',
    iconEmoji: '🔧',
    quickPresets: [
      'လစဉ် အင်တာနက် WiFi ဘေလ်',
      'Aircon ဆေးကြော / ပြုပြင်ခ',
      'မီးသီး / ရေပိုက် / အခန်းပြုပြင်ခ',
      'အထွေထွေ အသုံးစရိတ်'
    ]
  }
];

const COLOR_THEMES = [
  { badgeColor: 'bg-emerald-50 text-emerald-800 border-emerald-200', barColor: 'bg-emerald-600' },
  { badgeColor: 'bg-indigo-50 text-indigo-800 border-indigo-200', barColor: 'bg-indigo-600' },
  { badgeColor: 'bg-amber-50 text-amber-900 border-amber-300', barColor: 'bg-amber-500' },
  { badgeColor: 'bg-cyan-50 text-cyan-800 border-cyan-200', barColor: 'bg-cyan-600' },
  { badgeColor: 'bg-purple-50 text-purple-800 border-purple-200', barColor: 'bg-purple-600' },
  { badgeColor: 'bg-pink-50 text-pink-800 border-pink-200', barColor: 'bg-pink-600' },
  { badgeColor: 'bg-orange-50 text-orange-800 border-orange-200', barColor: 'bg-orange-500' },
  { badgeColor: 'bg-teal-50 text-teal-800 border-teal-200', barColor: 'bg-teal-600' },
  { badgeColor: 'bg-rose-50 text-rose-800 border-rose-200', barColor: 'bg-rose-600' },
  { badgeColor: 'bg-slate-100 text-slate-800 border-slate-300', barColor: 'bg-slate-600' }
];

export interface ExpenseRecord {
  id: string;
  date: string; // YYYY-MM-DD
  yearMonth: string; // YYYY-MM
  category: ExpenseCategoryId;
  title: string;
  amount: number;
  paymentMethod: string;
  note: string;
  createdAt: number;
  sourceDoc?: 'settings' | 'collection';
}

const getLocalTodayStr = () => {
  const d = new Date();
  return (
    d.getFullYear() +
    '-' +
    String(d.getMonth() + 1).padStart(2, '0') +
    '-' +
    String(d.getDate()).padStart(2, '0')
  );
};

const getYesterdayStr = () => {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return (
    d.getFullYear() +
    '-' +
    String(d.getMonth() + 1).padStart(2, '0') +
    '-' +
    String(d.getDate()).padStart(2, '0')
  );
};

const formatReadableDateHeader = (dateStr: string) => {
  if (!dateStr) return 'Unknown Date';
  const today = getLocalTodayStr();
  const yesterday = getYesterdayStr();
  const [y, m, d] = dateStr.split('-').map(Number);
  if (!y || !m || !d) return dateStr;
  const dt = new Date(y, m - 1, d);
  const formatted = dt.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });
  if (dateStr === today) return `ယနေ့ (Today) — ${formatted}`;
  if (dateStr === yesterday) return `မနေ့က (Yesterday) — ${formatted}`;
  return formatted;
};

// ============================================================================
// 🌟 SHARED HOOK: CALCULATE MONTHLY PAYROLL, REVENUE, EXPENSES & CUSTOM CATEGORIES 🌟
// ============================================================================

export function useMonthlyFinancialEngine(
  selectedMonth: string,
  bookings: Booking[],
  therapists: TherapistProfile[]
) {
  const [settingsExpenses, setSettingsExpenses] = useState<ExpenseRecord[]>([]);
  const [legacyCollectionExpenses, setLegacyCollectionExpenses] = useState<ExpenseRecord[]>([]);
  const [penalties, setPenalties] = useState<any[]>([]);
  const [categories, setCategories] = useState<ExpenseCategoryMeta[]>(DEFAULT_EXPENSE_CATEGORIES);

  const [payrollDoc, setPayrollDoc] = useState<{
    defaultWifiFee: number;
    adjustments: Record<string, any>;
    seniorityOverrides: Record<string, any>;
    ceoSalary: number;
    managerSalary: number;
    ceoName: string;
    managerName: string;
  }>({
    defaultWifiFee: 10000,
    adjustments: {},
    seniorityOverrides: {},
    ceoSalary: 0,
    managerSalary: 0,
    ceoName: 'CEO',
    managerName: 'Spa Manager'
  });

  useEffect(() => {
    const unsub = onSnapshot(
      doc(db, 'settings', 'expense_categories'),
      (snap) => {
        if (snap.exists() && Array.isArray(snap.data()?.list) && snap.data()!.list.length > 0) {
          setCategories(snap.data()!.list);
        } else {
          setCategories(DEFAULT_EXPENSE_CATEGORIES);
        }
      },
      () => {
        setCategories(DEFAULT_EXPENSE_CATEGORIES);
      }
    );
    return () => unsub();
  }, []);

  const saveCustomCategories = async (newList: ExpenseCategoryMeta[]) => {
    setCategories(newList);
    try {
      localStorage.setItem('shangrila_expense_categories', JSON.stringify(newList));
    } catch {}
    await setDoc(
      doc(db, 'settings', 'expense_categories'),
      { list: newList, updatedAt: Date.now() },
      { merge: true }
    );
  };

  useEffect(() => {
    const unsub = onSnapshot(
      doc(db, 'settings', `expenses_${selectedMonth}`),
      (snap) => {
        if (snap.exists() && Array.isArray(snap.data()?.records)) {
          const list: ExpenseRecord[] = snap.data()!.records.map((r: any) => {
            const dateStr = String(r.date || `${selectedMonth}-01`);
            return {
              id: String(r.id || `exp_${Date.now()}`),
              date: dateStr,
              yearMonth: dateStr.substring(0, 7),
              category: String(r.category || 'maintenance_other'),
              title: String(r.title || ''),
              amount: Number(r.amount) || 0,
              paymentMethod: String(r.paymentMethod || 'Cash'),
              note: String(r.note || ''),
              createdAt: Number(r.createdAt) || Date.now(),
              sourceDoc: 'settings'
            };
          });
          setSettingsExpenses(list);
        } else {
          setSettingsExpenses([]);
        }
      },
      (err) => {
        console.warn('Settings expenses listener error:', err);
      }
    );
    return () => unsub();
  }, [selectedMonth]);

  useEffect(() => {
    const q = query(collection(db, 'expenses'), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(
      q,
      (snap) => {
        const arr: ExpenseRecord[] = [];
        snap.forEach((d) => {
          const raw = d.data();
          const dateStr = String(raw.date || getLocalTodayStr());
          arr.push({
            id: d.id,
            date: dateStr,
            yearMonth: dateStr.substring(0, 7),
            category: String(raw.category || 'maintenance_other'),
            title: String(raw.title || ''),
            amount: Number(raw.amount) || 0,
            paymentMethod: String(raw.paymentMethod || 'Cash'),
            note: String(raw.note || ''),
            createdAt: Number(raw.createdAt) || Date.now(),
            sourceDoc: 'collection'
          });
        });
        setLegacyCollectionExpenses(arr);
      },
      () => {}
    );
    return () => unsub();
  }, []);

  const monthExpenses = useMemo(() => {
    const map = new Map<string, ExpenseRecord>();
    legacyCollectionExpenses
      .filter((e) => e.yearMonth === selectedMonth)
      .forEach((e) => map.set(e.id, e));
    settingsExpenses
      .filter((e) => e.yearMonth === selectedMonth)
      .forEach((e) => map.set(e.id, e));
    return Array.from(map.values()).sort((a, b) => {
      if (b.date !== a.date) return b.date.localeCompare(a.date);
      return (b.createdAt || 0) - (a.createdAt || 0);
    });
  }, [settingsExpenses, legacyCollectionExpenses, selectedMonth]);

  useEffect(() => {
    const unsub = onSnapshot(
      collection(db, 'penalties'),
      (snap) => {
        const list: any[] = [];
        snap.forEach((d) => list.push({ id: d.id, ...d.data() }));
        setPenalties(list);
      },
      () => {}
    );
    return () => unsub();
  }, []);

  useEffect(() => {
    const unsub = onSnapshot(
      doc(db, 'settings', `payroll_${selectedMonth}`),
      (snap) => {
        if (snap.exists()) {
          const data = snap.data() as any;
          const wifi = data.defaultWifiFee !== undefined ? Number(data.defaultWifiFee) : 10000;
          setPayrollDoc({
            defaultWifiFee: isNaN(wifi) ? 10000 : wifi,
            adjustments: data.adjustments || {},
            seniorityOverrides: data.seniorityOverrides || {},
            ceoSalary: Number(data.ceoSalary) || 0,
            managerSalary: Number(data.managerSalary) || 0,
            ceoName: String(data.ceoName || 'CEO'),
            managerName: String(data.managerName || 'Spa Manager')
          });
        } else {
          setPayrollDoc({
            defaultWifiFee: 10000,
            adjustments: {},
            seniorityOverrides: {},
            ceoSalary: 0,
            managerSalary: 0,
            ceoName: 'CEO',
            managerName: 'Spa Manager'
          });
        }
      },
      () => {}
    );
    return () => unsub();
  }, [selectedMonth]);

  const parseSafeNum = (v: any): number => {
    if (v === undefined || v === null || v === '') return 0;
    if (typeof v === 'number') return isNaN(v) ? 0 : v;
    const s = String(v).trim();
    const dec = decryptText(s);
    const n = Number(dec || s);
    return isNaN(n) ? 0 : n;
  };

  const parseSafeStr = (v: any): string => {
    if (!v) return '';
    if (typeof v !== 'string') return String(v);
    return decryptText(v) || v;
  };

  const uniqueTherapists = useMemo(() => {
    return Array.from(
      new Map(
        (therapists || [])
          .filter((t) => t.name && t.name.trim() !== '')
          .map((t) => [t.name.trim(), t])
      ).values()
    );
  }, [therapists]);

  const monthlyCalculations = useMemo(() => {
    let onlineSalesTotal = 0;
    let onlineBookingsCount = 0;
    let posSalesTotal = 0;
    let posBillsCount = 0;
    let totalCollectedCash = 0;
    let totalCollectedDigital = 0;
    let totalPendingBalanceDue = 0;
    let totalDiscountGiven = 0;

    const paymentMethodMap = new Map<string, { method: string; amount: number; count: number }>();

    const staffCommMap = new Map<
      string,
      {
        staffId: string;
        staffName: string;
        sectionsCount: number;
        serviceCommission: number;
      }
    >();

    uniqueTherapists.forEach((t) => {
      staffCommMap.set(t.name.trim(), {
        staffId: t.id,
        staffName: t.name.trim(),
        sectionsCount: 0,
        serviceCommission: 0
      });
    });

    const dailyRevenueMap = new Map<
      string,
      { online: number; pos: number; totalRevenue: number; count: number }
    >();

    bookings.forEach((b: any) => {
      if (!b || b.status === 'cancelled') return;
      const bDate = String(b.date || '').trim();
      if (!bDate.startsWith(selectedMonth)) return;

      const rawTx = parseSafeStr(b.txId).trim().toUpperCase();
      const rawPay = String(b.paymentMethod || '').trim();
      const rawPayLower = rawPay.toLowerCase();
      const rawDisc = parseSafeStr(b.discountLabel).trim().toLowerCase();
      const rawService = String(b.service || '').trim();
      const totalAmt = parseSafeNum(b.totalPrice);
      const origAmt = parseSafeNum(b.originalPrice) || totalAmt;

      if (
        totalAmt <= 0 ||
        rawTx === 'ADMIN' ||
        rawTx === 'CASH' ||
        Boolean(b.isAdminClockIn) ||
        Boolean(b.isStaffClockIn) ||
        rawService.toLowerCase().includes('walk-in reward redemption')
      ) {
        return;
      }

      const isOnline =
        Boolean(b.isOnlineBooking) ||
        Boolean(b.onlineBookingId) ||
        (!rawTx.startsWith('SL-') &&
          !rawPayLower.includes('shop pos') &&
          !rawDisc.includes('[shop walk-in') &&
          !Boolean(b.posLocalId));

      if (isOnline) {
        onlineSalesTotal += totalAmt;
        onlineBookingsCount += 1;
      } else {
        posSalesTotal += totalAmt;
        posBillsCount += 1;
      }

      if (origAmt > totalAmt) {
        totalDiscountGiven += origAmt - totalAmt;
      }

      const isDepDue = b.paymentStatus === 'deposit_only' && parseSafeNum(b.balanceDue) > 0;
      const dueAmt = isDepDue ? parseSafeNum(b.balanceDue) : 0;
      const collectedNow = isDepDue
        ? parseSafeNum(b.depositPaid) || Math.max(0, totalAmt - dueAmt)
        : totalAmt;

      totalPendingBalanceDue += dueAmt;

      const cleanMethodName = (rawPay || 'Cash').split('(')[0].trim() || 'Cash';
      if (cleanMethodName.toLowerCase().includes('cash')) {
        totalCollectedCash += collectedNow;
      } else {
        totalCollectedDigital += collectedNow;
      }

      const pmUpper = cleanMethodName.toUpperCase();
      const existingPm = paymentMethodMap.get(pmUpper);
      if (existingPm) {
        existingPm.amount += totalAmt;
        existingPm.count += 1;
      } else {
        paymentMethodMap.set(pmUpper, { method: cleanMethodName, amount: totalAmt, count: 1 });
      }

      if (!dailyRevenueMap.has(bDate)) {
        dailyRevenueMap.set(bDate, { online: 0, pos: 0, totalRevenue: 0, count: 0 });
      }
      const dEntry = dailyRevenueMap.get(bDate)!;
      if (isOnline) dEntry.online += totalAmt;
      else dEntry.pos += totalAmt;
      dEntry.totalRevenue += totalAmt;
      dEntry.count += 1;

      const rawTherapistStr = String(b.therapist || '').trim();
      if (!rawTherapistStr || rawTherapistStr === '-' || rawTherapistStr.toLowerCase().includes('any available')) {
        return;
      }
      const splitNames = rawTherapistStr
        .split(/&|,|\+/)
        .map((s) => s.trim())
        .filter(Boolean);
      if (splitNames.length === 0) return;

      splitNames.forEach((tNameRaw) => {
        const matchedProfile = uniqueTherapists.find((tp) => isSameStaffMember(tNameRaw, tp.name, tp.id));
        const canonicalName = matchedProfile ? matchedProfile.name.trim() : tNameRaw.trim();
        if (!staffCommMap.has(canonicalName)) {
          staffCommMap.set(canonicalName, {
            staffId: canonicalName,
            staffName: canonicalName,
            sectionsCount: 0,
            serviceCommission: 0
          });
        }
        const st = staffCommMap.get(canonicalName)!;
        const seniority = getStaffSeniority(
          canonicalName,
          uniqueTherapists,
          payrollDoc.seniorityOverrides
        );
        const commRes = calculateBookingCommissionForStaff(b, seniority, splitNames.length);
        st.sectionsCount += 1;
        st.serviceCommission += commRes.totalCommission;
      });
    });

    let totalTherapistNetPayroll = 0;
    let totalTherapistGrossCommission = 0;
    let totalTherapistBaseAndBonus = 0;
    let totalTherapistDeductions = 0;
    let settledTherapistsCount = 0;

    const therapistPayrollList = Array.from(staffCommMap.values()).map((st) => {
      const adj = payrollDoc.adjustments[st.staffName] || {
        baseSalary: 0,
        bonus: 0,
        customDeductions: [],
        isPaidSettled: false
      };

      const rawCustom = adj.customDeductions || [];
      const wifiInList = rawCustom.find(
        (d: any) => String(d.reason || '').toLowerCase().includes('wifi') || d.id === 'default_wifi'
      );
      const otherCustom = rawCustom.filter(
        (d: any) => !String(d.reason || '').toLowerCase().includes('wifi') && d.id !== 'default_wifi'
      );

      let wifiFee = payrollDoc.defaultWifiFee;
      if (adj.wifiFeeOverride !== undefined && adj.wifiFeeOverride !== null) {
        wifiFee = Number(adj.wifiFeeOverride);
      } else if (wifiInList) {
        wifiFee = Number(wifiInList.amount) || 0;
      }
      wifiFee = Math.max(0, wifiFee);

      const otherCustomTotal = otherCustom.reduce((s: number, d: any) => s + (Number(d.amount) || 0), 0);

      const myPenalties = penalties.filter((p) => {
        if (!isSameStaffMember(p.therapistName || '', st.staffName, st.staffId)) return false;
        return String(p.date || '').startsWith(selectedMonth) && !p.isPaid;
      });

      const finesAndLoansTotal = myPenalties.reduce((s, p) => s + (Number(p.amount) || 0), 0);
      const staffDeductions = wifiFee + otherCustomTotal + finesAndLoansTotal;
      const baseAndBonus = (Number(adj.baseSalary) || 0) + (Number(adj.bonus) || 0);
      const grossPay = st.serviceCommission + baseAndBonus;
      const netPayable = Math.max(0, grossPay - staffDeductions);

      totalTherapistGrossCommission += st.serviceCommission;
      totalTherapistBaseAndBonus += baseAndBonus;
      totalTherapistDeductions += staffDeductions;
      totalTherapistNetPayroll += netPayable;
      if (adj.isPaidSettled) settledTherapistsCount += 1;

      return {
        ...st,
        baseAndBonus,
        staffDeductions,
        netPayable,
        isPaidSettled: Boolean(adj.isPaidSettled)
      };
    });

    const totalCombinedPayroll =
      totalTherapistNetPayroll + payrollDoc.ceoSalary + payrollDoc.managerSalary;

    const totalRevenue = onlineSalesTotal + posSalesTotal;

    return {
      totalRevenue,
      onlineSalesTotal,
      onlineBookingsCount,
      posSalesTotal,
      posBillsCount,
      totalBookingsCount: onlineBookingsCount + posBillsCount,
      totalCollectedCash,
      totalCollectedDigital,
      totalPendingBalanceDue,
      totalDiscountGiven,
      paymentMethodsBreakdown: Array.from(paymentMethodMap.values()).sort((a, b) => b.amount - a.amount),
      dailyRevenueMap,
      therapistPayrollList,
      totalTherapistGrossCommission,
      totalTherapistBaseAndBonus,
      totalTherapistDeductions,
      totalTherapistNetPayroll,
      settledTherapistsCount,
      totalCombinedPayroll
    };
  }, [bookings, uniqueTherapists, selectedMonth, payrollDoc, penalties]);

  const totalOperationalExpenses = useMemo(() => {
    return monthExpenses.reduce((sum, e) => sum + e.amount, 0);
  }, [monthExpenses]);

  const grandTotalAllOutflow =
    totalOperationalExpenses + monthlyCalculations.totalCombinedPayroll;

  const netProfit = monthlyCalculations.totalRevenue - grandTotalAllOutflow;
  const profitMarginPercent =
    monthlyCalculations.totalRevenue > 0
      ? (netProfit / monthlyCalculations.totalRevenue) * 100
      : 0;

  return {
    categories,
    saveCustomCategories,
    monthExpenses,
    totalOperationalExpenses,
    payrollDoc,
    monthlyCalculations,
    grandTotalAllOutflow,
    netProfit,
    profitMarginPercent
  };
}

// ============================================================================
// 🌟 3. ADMIN EXPENSE MANAGER COMPONENT (WITH DAILY GROUPING & DATE FILTERS) 🌟
// ============================================================================

export function AdminExpenseManager({
  bookings,
  therapists,
  adminRole
}: {
  bookings: Booking[];
  therapists: TherapistProfile[];
  adminRole: string;
}) {
  const todayStr = getLocalTodayStr();
  const yesterdayStr = getYesterdayStr();
  const currentYearMonth = todayStr.substring(0, 7);

  const [selectedMonth, setSelectedMonth] = useState<string>(currentYearMonth);
  const [activeCategoryFilter, setActiveCategoryFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // 🌟 Date Filter States for Daily Expense Records 🌟
  const [dateFilterMode, setDateFilterMode] = useState<
    'all' | 'today' | 'yesterday' | 'single_date' | 'custom_range'
  >('all');
  const [singleDateFilter, setSingleDateFilter] = useState<string>(todayStr);
  const [fromDate, setFromDate] = useState<string>(`${currentYearMonth}-01`);
  const [toDate, setToDate] = useState<string>(todayStr);

  // Add Expense Form States
  const [expDate, setExpDate] = useState<string>(todayStr);
  const [expCategory, setExpCategory] = useState<string>('spa_supplies');
  const [expTitle, setExpTitle] = useState<string>('');
  const [expAmount, setExpAmount] = useState<string>('');
  const [expPaymentMethod, setExpPaymentMethod] = useState<string>('Cash');
  const [expNote, setExpNote] = useState<string>('');
  const [isSavingExpense, setIsSavingExpense] = useState<boolean>(false);

  // Custom Luxury Category Dropdown Popover States
  const [isCategoryDropdownOpen, setIsCategoryDropdownOpen] = useState<boolean>(false);
  const [dropdownSearchQuery, setDropdownSearchQuery] = useState<string>('');
  const categoryDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (categoryDropdownRef.current && !categoryDropdownRef.current.contains(e.target as Node)) {
        setIsCategoryDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Quick Items Inline Customization States
  const [isEditingQuickItems, setIsEditingQuickItems] = useState<boolean>(false);
  const [showAddQuickItemInput, setShowAddQuickItemInput] = useState<boolean>(false);
  const [newQuickItemText, setNewQuickItemText] = useState<string>('');

  // Category & Searchable Icon Manager Modal States
  const [showCategoryManagerModal, setShowCategoryManagerModal] = useState<boolean>(false);
  const [newCatEmoji, setNewCatEmoji] = useState<string>('🚕');
  const [newCatTitle, setNewCatTitle] = useState<string>('');
  const [editingCatId, setEditingCatId] = useState<string | null>(null);
  const [editingCatTitle, setEditingCatTitle] = useState<string>('');
  const [editingCatEmoji, setEditingCatEmoji] = useState<string>('');

  const [iconPickerTarget, setIconPickerTarget] = useState<'new' | 'edit' | null>(null);
  const [iconSearchQuery, setIconSearchQuery] = useState<string>('');

  // Executive Salaries (CEO & Manager) States
  const [showSalaryEditor, setShowSalaryEditor] = useState<boolean>(false);
  const [ceoSalaryInput, setCeoSalaryInput] = useState<string>('0');
  const [managerSalaryInput, setManagerSalaryInput] = useState<string>('0');
  const [ceoNameInput, setCeoNameInput] = useState<string>('CEO');
  const [managerNameInput, setManagerNameInput] = useState<string>('Spa Manager');
  const [isSavingExecSalary, setIsSavingExecSalary] = useState<boolean>(false);
  const [showPayrollBreakdownModal, setShowPayrollBreakdownModal] = useState<boolean>(false);

  const {
    categories,
    saveCustomCategories,
    monthExpenses,
    totalOperationalExpenses,
    payrollDoc,
    monthlyCalculations,
    grandTotalAllOutflow
  } = useMonthlyFinancialEngine(selectedMonth, bookings, therapists);

  useEffect(() => {
    if (categories.length > 0 && !categories.some((c) => c.id === expCategory)) {
      setExpCategory(categories[0].id);
    }
  }, [categories, expCategory]);

  useEffect(() => {
    setCeoSalaryInput(String(payrollDoc.ceoSalary || 0));
    setManagerSalaryInput(String(payrollDoc.managerSalary || 0));
    setCeoNameInput(payrollDoc.ceoName || 'CEO');
    setManagerNameInput(payrollDoc.managerName || 'Spa Manager');
  }, [payrollDoc.ceoSalary, payrollDoc.managerSalary, payrollDoc.ceoName, payrollDoc.managerName]);

  const selectedCategoryMeta = useMemo(() => {
    return categories.find((c) => c.id === expCategory) || categories[0] || DEFAULT_EXPENSE_CATEGORIES[0];
  }, [categories, expCategory]);

  const filteredDropdownCategories = useMemo(() => {
    const q = dropdownSearchQuery.trim().toLowerCase();
    if (!q) return categories;
    return categories.filter(
      (c) =>
        c.title.toLowerCase().includes(q) ||
        c.subTitle.toLowerCase().includes(q) ||
        c.quickPresets.some((p) => p.toLowerCase().includes(q))
    );
  }, [categories, dropdownSearchQuery]);

  const filteredIconLibrary = useMemo(() => {
    const q = iconSearchQuery.trim().toLowerCase();
    if (!q) return EXPENSE_ICON_LIBRARY;
    return EXPENSE_ICON_LIBRARY.filter(
      (ic) =>
        ic.label.toLowerCase().includes(q) ||
        ic.keywords.toLowerCase().includes(q) ||
        ic.emoji.includes(q)
    );
  }, [iconSearchQuery]);

  // ============================================================================
  // 🌟 MULTI-SELECT QUICK ITEMS LOGIC 🌟
  // ============================================================================

  const selectedItemsList = useMemo(() => {
    return expTitle
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
  }, [expTitle]);

  const handleToggleQuickItem = (preset: string) => {
    const cleanPreset = preset.trim();
    const exists = selectedItemsList.some((item) => item.toLowerCase() === cleanPreset.toLowerCase());

    let nextList: string[];
    if (exists) {
      nextList = selectedItemsList.filter((item) => item.toLowerCase() !== cleanPreset.toLowerCase());
    } else {
      nextList = [...selectedItemsList, cleanPreset];
    }
    setExpTitle(nextList.join(', '));
  };

  const handleSelectAllQuickItems = () => {
    if (!selectedCategoryMeta) return;
    const allPresets = selectedCategoryMeta.quickPresets;
    const merged = Array.from(new Set([...selectedItemsList, ...allPresets]));
    setExpTitle(merged.join(', '));
  };

  const handleClearQuickItems = () => {
    setExpTitle('');
  };

  // ============================================================================
  // 🌟 CATEGORY & QUICK ITEMS CRUD FUNCTIONS 🌟
  // ============================================================================

  const handleAddQuickPresetItem = async () => {
    const clean = newQuickItemText.trim();
    if (!clean || !selectedCategoryMeta) return;
    if (!selectedCategoryMeta.quickPresets.includes(clean)) {
      const updatedCategories = categories.map((cat) =>
        cat.id === selectedCategoryMeta.id
          ? { ...cat, quickPresets: [...cat.quickPresets, clean] }
          : cat
      );
      await saveCustomCategories(updatedCategories);
    }
    if (!selectedItemsList.includes(clean)) {
      setExpTitle([...selectedItemsList, clean].join(', '));
    }
    setNewQuickItemText('');
    setShowAddQuickItemInput(false);
  };

  const handleRemoveQuickPresetItem = async (presetToRemove: string) => {
    if (!selectedCategoryMeta) return;
    const updatedCategories = categories.map((cat) =>
      cat.id === selectedCategoryMeta.id
        ? { ...cat, quickPresets: cat.quickPresets.filter((p) => p !== presetToRemove) }
        : cat
    );
    await saveCustomCategories(updatedCategories);
  };

  const handleAddNewCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanTitle = newCatTitle.trim();
    if (!cleanTitle) return;

    const autoEmoji = suggestEmojiForTitle(cleanTitle);
    const theme = COLOR_THEMES[categories.length % COLOR_THEMES.length];
    const newCat: ExpenseCategoryMeta = {
      id: `cat_${Date.now()}`,
      title: cleanTitle,
      subTitle: 'Custom Category',
      badgeColor: theme.badgeColor,
      barColor: theme.barColor,
      iconEmoji: newCatEmoji.trim() || autoEmoji || '📌',
      quickPresets: [cleanTitle]
    };

    const nextList = [...categories, newCat];
    await saveCustomCategories(nextList);
    setExpCategory(newCat.id);
    setNewCatTitle('');
    setNewCatEmoji('🚕');
    setIconPickerTarget(null);
  };

  const handleSaveEditedCategory = async (catId: string) => {
    const cleanTitle = editingCatTitle.trim();
    if (!cleanTitle) return;
    const nextList = categories.map((c) =>
      c.id === catId
        ? { ...c, title: cleanTitle, iconEmoji: editingCatEmoji.trim() || c.iconEmoji }
        : c
    );
    await saveCustomCategories(nextList);
    setEditingCatId(null);
    setIconPickerTarget(null);
  };

  const handleDeleteCategory = async (catId: string, title: string) => {
    if (categories.length <= 1) {
      alert('အနည်းဆုံး Category (၁) ခု ရှိရပါမည်။');
      return;
    }
    if (!window.confirm(`"${title}" Category ကို ဖျက်မည်မှာ သေချာပါသလား?`)) return;
    const nextList = categories.filter((c) => c.id !== catId);
    await saveCustomCategories(nextList);
  };

  const handleResetDefaultCategories = async () => {
    if (!window.confirm('မူလ Default Category (၁၀) မျိုးနှင့် Quick Items များအတိုင်း ပြန်ထားမည်မှာ သေချာပါသလား?')) {
      return;
    }
    await saveCustomCategories(DEFAULT_EXPENSE_CATEGORIES);
  };

  const handleSaveExecutiveSalaries = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingExecSalary(true);
    try {
      await setDoc(
        doc(db, 'settings', `payroll_${selectedMonth}`),
        {
          ceoSalary: Math.max(0, Number(ceoSalaryInput) || 0),
          managerSalary: Math.max(0, Number(managerSalaryInput) || 0),
          ceoName: ceoNameInput.trim() || 'CEO',
          managerName: managerNameInput.trim() || 'Spa Manager',
          updatedAt: Date.now()
        },
        { merge: true }
      );
      setShowSalaryEditor(false);
      alert(`✅ ${selectedMonth} အတွက် CEO လစာနှင့် Manager လစာ သတ်မှတ်သိမ်းဆည်းပြီးပါပြီ။`);
    } catch (err) {
      alert('လစာ သိမ်းဆည်းရာတွင် အမှားအယွင်းရှိနေပါသည်။');
    } finally {
      setIsSavingExecSalary(false);
    }
  };

  // Save Expense into `settings/expenses_${yearMonth}`
  const handleAddExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    const amt = Math.max(0, Number(expAmount) || 0);
    if (!expTitle.trim() || amt <= 0) {
      alert('အသုံးစရိတ် အကြောင်းအရာနှင့် ငွေပမာဏ ထည့်သွင်းပေးပါ။');
      return;
    }

    setIsSavingExpense(true);
    try {
      const targetDate = expDate || todayStr;
      const targetYearMonth = targetDate.substring(0, 7);

      const newRecord: ExpenseRecord = {
        id: `exp_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        date: targetDate,
        yearMonth: targetYearMonth,
        category: expCategory,
        title: expTitle.trim(),
        amount: amt,
        paymentMethod: expPaymentMethod,
        note: expNote.trim(),
        createdAt: Date.now(),
        sourceDoc: 'settings'
      };

      const settingsDocRef = doc(db, 'settings', `expenses_${targetYearMonth}`);
      const existingSnap = await getDoc(settingsDocRef);
      const existingRecords =
        existingSnap.exists() && Array.isArray(existingSnap.data()?.records)
          ? existingSnap.data()!.records
          : [];

      const updatedRecords = [newRecord, ...existingRecords];

      await setDoc(
        settingsDocRef,
        {
          yearMonth: targetYearMonth,
          records: updatedRecords,
          updatedAt: Date.now()
        },
        { merge: true }
      );

      if (targetYearMonth !== selectedMonth) {
        setSelectedMonth(targetYearMonth);
      }

      setExpTitle('');
      setExpAmount('');
      setExpNote('');
    } catch (err: any) {
      console.error('Expense Save Error:', err);
      alert(`အသုံးစရိတ် သိမ်းဆည်းရာတွင် အမှားအယွင်းရှိနေပါသည်: ${err?.message || ''}`);
    } finally {
      setIsSavingExpense(false);
    }
  };

  const handleDeleteExpense = async (exp: ExpenseRecord) => {
    if (adminRole !== 'super_admin') {
      alert('Super Admin သာလျှင် ဖျက်ခွင့်ရှိပါသည်။');
      return;
    }
    if (!window.confirm(`"${exp.title}" (${formatPrice(exp.amount)}) အသုံးစရိတ်မှတ်တမ်းကို ဖျက်မည်မှာ သေချာပါသလား?`)) {
      return;
    }

    try {
      const targetYm = exp.yearMonth || selectedMonth;
      const settingsDocRef = doc(db, 'settings', `expenses_${targetYm}`);
      const snap = await getDoc(settingsDocRef);
      if (snap.exists() && Array.isArray(snap.data()?.records)) {
        const nextRecords = snap.data()!.records.filter((r: any) => r.id !== exp.id);
        await setDoc(settingsDocRef, { records: nextRecords, updatedAt: Date.now() }, { merge: true });
      }
      if (exp.sourceDoc === 'collection') {
        await deleteDoc(doc(db, 'expenses', exp.id)).catch(() => {});
      }
    } catch (err) {
      alert('မှတ်တမ်းဖျက်ရာတွင် အမှားအယွင်းရှိနေပါသည်။');
    }
  };

  // Category Breakdown Summary
  const categoryBreakdownList = useMemo(() => {
    const map = new Map<string, { total: number; count: number }>();
    categories.forEach((c) => map.set(c.id, { total: 0, count: 0 }));

    monthExpenses.forEach((e) => {
      const entry = map.get(e.category) || { total: 0, count: 0 };
      entry.total += e.amount;
      entry.count += 1;
      map.set(e.category, entry);
    });

    const operationalRows = categories.map((meta) => {
      const st = map.get(meta.id) || { total: 0, count: 0 };
      const pct = grandTotalAllOutflow > 0 ? (st.total / grandTotalAllOutflow) * 100 : 0;
      return {
        ...meta,
        total: st.total,
        count: st.count,
        pct
      };
    });

    return operationalRows.sort((a, b) => b.total - a.total);
  }, [categories, monthExpenses, grandTotalAllOutflow]);

  // 🌟 Filter Expenses by Date Mode, Category, and Search Query 🌟
  const filteredExpenses = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return monthExpenses.filter((e) => {
      const eDate = e.date || todayStr;

      // 1. Date Filter Check
      if (dateFilterMode === 'today' && eDate !== todayStr) return false;
      if (dateFilterMode === 'yesterday' && eDate !== yesterdayStr) return false;
      if (dateFilterMode === 'single_date' && singleDateFilter && eDate !== singleDateFilter) return false;
      if (dateFilterMode === 'custom_range') {
        const start = fromDate && toDate && fromDate > toDate ? toDate : fromDate;
        const end = fromDate && toDate && fromDate > toDate ? fromDate : toDate;
        if (start && eDate < start) return false;
        if (end && eDate > end) return false;
      }

      // 2. Category Filter Check
      if (activeCategoryFilter !== 'all' && e.category !== activeCategoryFilter) return false;

      // 3. Search Query Check
      if (q) {
        const catMeta = categories.find((c) => c.id === e.category);
        const match =
          e.title.toLowerCase().includes(q) ||
          e.note.toLowerCase().includes(q) ||
          e.paymentMethod.toLowerCase().includes(q) ||
          (catMeta?.title || '').toLowerCase().includes(q);
        if (!match) return false;
      }
      return true;
    });
  }, [
    monthExpenses,
    dateFilterMode,
    todayStr,
    yesterdayStr,
    singleDateFilter,
    fromDate,
    toDate,
    activeCategoryFilter,
    searchQuery,
    categories
  ]);

  // 🌟 Group Filtered Expenses by Date (Just like Sale Reports!) 🌟
  const groupedExpensesByDate = useMemo(() => {
    const groupsMap = new Map<
      string,
      {
        date: string;
        records: ExpenseRecord[];
        dailyTotalAmount: number;
        dailyCashTotal: number;
        dailyDigitalTotal: number;
      }
    >();

    filteredExpenses.forEach((exp) => {
      const dKey = exp.date || todayStr;
      if (!groupsMap.has(dKey)) {
        groupsMap.set(dKey, {
          date: dKey,
          records: [],
          dailyTotalAmount: 0,
          dailyCashTotal: 0,
          dailyDigitalTotal: 0
        });
      }
      const grp = groupsMap.get(dKey)!;
      grp.records.push(exp);
      grp.dailyTotalAmount += exp.amount;

      if ((exp.paymentMethod || 'Cash').toLowerCase().includes('cash')) {
        grp.dailyCashTotal += exp.amount;
      } else {
        grp.dailyDigitalTotal += exp.amount;
      }
    });

    return Array.from(groupsMap.values()).sort((a, b) => b.date.localeCompare(a.date));
  }, [filteredExpenses, todayStr]);

  const handleExportExpensesExcel = () => {
    const headers = [
      'Date',
      'Category',
      'Expense Item / Description',
      'Payment Method',
      'Amount (Ks)',
      'Remark / Note'
    ];

    const rows: any[] = filteredExpenses.map((e) => {
      const catMeta = categories.find((c) => c.id === e.category);
      return [
        `"${e.date}"`,
        `"${catMeta?.title || e.category}"`,
        `"${e.title}"`,
        `"${e.paymentMethod}"`,
        e.amount,
        `"${e.note || '-'}"`
      ];
    });

    rows.push([
      `"${selectedMonth}-30"`,
      `"ဝန်ထမ်းလစာနှင့် ကော်မရှင် (Staff Payroll Auto-Synced)"`,
      `"Therapists Net Payroll (${monthlyCalculations.therapistPayrollList.length} Staff)"`,
      `"Payroll Settlement"`,
      monthlyCalculations.totalTherapistNetPayroll,
      `"Auto-synced from Staff Pay Roll Tab"`
    ]);

    if (payrollDoc.ceoSalary > 0) {
      rows.push([
        `"${selectedMonth}-30"`,
        `"Executive Salary"`,
        `"${payrollDoc.ceoName} Salary"`,
        `"Payroll"`,
        payrollDoc.ceoSalary,
        `"Monthly Executive Salary"`
      ]);
    }

    if (payrollDoc.managerSalary > 0) {
      rows.push([
        `"${selectedMonth}-30"`,
        `"Executive Salary"`,
        `"${payrollDoc.managerName} Salary"`,
        `"Payroll"`,
        payrollDoc.managerSalary,
        `"Monthly Manager Salary"`
      ]);
    }

    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `ShangriLa_Expenses_And_Payroll_${selectedMonth}.csv`;
    link.click();
  };

  return (
    <div className="space-y-5 animate-fade-in">
      {/* =========================================================================
          MODAL 1: CATEGORY & SEARCHABLE ICON MANAGER
         ========================================================================= */}
      {showCategoryManagerModal && (
        <div className="fixed inset-0 z-[260] bg-black/70 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-6 shadow-2xl border border-[#D4AF37]/40 my-auto max-h-[92vh] flex flex-col space-y-4 animate-fade-in">
            <div className="flex justify-between items-center border-b border-gray-200 pb-3.5">
              <div>
                <h3 className="text-base sm:text-lg font-black text-[#123524] flex items-center">
                  <Settings className="w-5 h-5 mr-2 text-[#D4AF37]" />
                  Expense Categories & Icon Picker (စိတ်ကြိုက် ပြင်ဆင်ရန်)
                </h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  Category အသစ်ထည့်ခြင်း၊ အမည်ပြင်ခြင်း နှင့် သက်ဆိုင်ရာ Icon များကို စာရိုက်ရှာပြီး ပြောင်းလဲနိုင်ပါသည်
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowCategoryManagerModal(false);
                  setIconPickerTarget(null);
                  setEditingCatId(null);
                }}
                className="px-3 py-1.5 rounded-xl bg-gray-100 hover:bg-red-50 text-gray-600 hover:text-red-600 text-xs font-black"
              >
                ✕ Close
              </button>
            </div>

            <form
              onSubmit={handleAddNewCategory}
              className="bg-gray-50 p-3.5 rounded-2xl border border-gray-200 space-y-2.5"
            >
              <div className="text-[10px] font-extrabold text-[#123524] uppercase tracking-wider">
                Category အသစ် ထပ်တိုးရန် (Add New Category):
              </div>
              <div className="flex flex-col sm:flex-row gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setIconPickerTarget(iconPickerTarget === 'new' ? null : 'new');
                    setIconSearchQuery('');
                  }}
                  className="px-3 py-2.5 bg-white border-2 border-[#D4AF37] rounded-xl flex items-center justify-center gap-1.5 hover:bg-yellow-50 transition shadow-2xs flex-shrink-0"
                  title="Click to search and choose Icon"
                >
                  <span className="text-lg">{newCatEmoji}</span>
                  <span className="text-[11px] font-black text-[#123524]">Icon ရွေးရန်</span>
                  <ChevronDown className="w-3.5 h-3.5 text-gray-500" />
                </button>

                <input
                  type="text"
                  required
                  value={newCatTitle}
                  onChange={(e) => {
                    const val = e.target.value;
                    setNewCatTitle(val);
                    const suggested = suggestEmojiForTitle(val);
                    if (suggested) setNewCatEmoji(suggested);
                  }}
                  placeholder="ဥပမာ - Transportation Charges (Taxi) / ကားခ..."
                  className="flex-1 p-2.5 bg-white border border-gray-300 rounded-xl text-xs font-bold text-gray-800 outline-none focus:border-[#123524]"
                />
                <button
                  type="submit"
                  className="px-4 py-2.5 bg-[#123524] text-[#D4AF37] rounded-xl text-xs font-black whitespace-nowrap hover:bg-[#1a4a32] transition shadow-xs"
                >
                  + Category ထည့်မည်
                </button>
              </div>

              {iconPickerTarget === 'new' && (
                <div className="bg-white p-3.5 rounded-2xl border-2 border-[#123524]/20 shadow-md space-y-2.5 animate-fade-in">
                  <div className="flex items-center justify-between gap-2">
                    <div className="relative flex-1">
                      <input
                        type="text"
                        autoFocus
                        value={iconSearchQuery}
                        onChange={(e) => setIconSearchQuery(e.target.value)}
                        placeholder="Icon ရှာရန် (ဥပမာ - taxi, ကား, food, မီး, ရေ, ဆီ, wifi, gift)..."
                        className="w-full pl-8 pr-7 py-2 bg-gray-50 border border-gray-300 rounded-xl text-xs font-bold text-gray-800 outline-none focus:border-[#123524]"
                      />
                      <Search className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-2.5" />
                      {iconSearchQuery && (
                        <button
                          type="button"
                          onClick={() => setIconSearchQuery('')}
                          className="absolute right-2.5 top-2.5 text-gray-400 hover:text-gray-600"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => setIconPickerTarget(null)}
                      className="px-2.5 py-1.5 bg-gray-100 rounded-lg text-[11px] font-bold text-gray-600"
                    >
                      ပိတ်မည်
                    </button>
                  </div>

                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-1.5 max-h-44 overflow-y-auto p-1">
                    {filteredIconLibrary.map((ic, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => {
                          setNewCatEmoji(ic.emoji);
                          setIconPickerTarget(null);
                        }}
                        className={`p-2 rounded-xl border text-left flex items-center gap-2 transition ${
                          newCatEmoji === ic.emoji
                            ? 'bg-[#123524] text-[#D4AF37] border-[#123524] font-black'
                            : 'bg-gray-50/70 hover:bg-yellow-50 border-gray-200 text-gray-700 font-bold'
                        }`}
                      >
                        <span className="text-base">{ic.emoji}</span>
                        <span className="text-[10px] truncate">{ic.label}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </form>

            <div className="overflow-y-auto flex-1 space-y-2 pr-1">
              {categories.map((cat) => {
                const isEditing = editingCatId === cat.id;
                return (
                  <div
                    key={cat.id}
                    className={`p-3 rounded-2xl border transition ${
                      isEditing ? 'bg-yellow-50/50 border-[#123524] shadow-sm' : 'bg-white border-gray-200'
                    }`}
                  >
                    {isEditing ? (
                      <div className="space-y-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              setIconPickerTarget(iconPickerTarget === 'edit' ? null : 'edit');
                              setIconSearchQuery('');
                            }}
                            className="px-3 py-2 bg-white border-2 border-[#D4AF37] rounded-xl flex items-center gap-1.5 shadow-2xs hover:bg-yellow-50"
                            title="Icon ပြောင်းရန် နှိပ်ပါ"
                          >
                            <span className="text-lg">{editingCatEmoji}</span>
                            <span className="text-[11px] font-black text-[#123524]">Icon ရွေးရန်</span>
                            <ChevronDown className="w-3.5 h-3.5 text-gray-500" />
                          </button>

                          <input
                            type="text"
                            autoFocus
                            value={editingCatTitle}
                            onChange={(e) => {
                              const val = e.target.value;
                              setEditingCatTitle(val);
                              const suggested = suggestEmojiForTitle(val);
                              if (suggested) setEditingCatEmoji(suggested);
                            }}
                            className="flex-1 min-w-[180px] p-2 bg-white border border-[#123524] rounded-xl text-xs font-bold text-[#123524] outline-none"
                          />

                          <button
                            type="button"
                            onClick={() => handleSaveEditedCategory(cat.id)}
                            className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black flex items-center gap-1 shadow-xs"
                          >
                            <Check className="w-3.5 h-3.5" /> Save
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setEditingCatId(null);
                              setIconPickerTarget(null);
                            }}
                            className="px-2.5 py-2 bg-gray-100 text-gray-600 rounded-xl text-xs font-bold"
                          >
                            ✕
                          </button>
                        </div>

                        {iconPickerTarget === 'edit' && (
                          <div className="bg-white p-3 rounded-xl border border-gray-300 space-y-2 animate-fade-in">
                            <div className="relative">
                              <input
                                type="text"
                                autoFocus
                                value={iconSearchQuery}
                                onChange={(e) => setIconSearchQuery(e.target.value)}
                                placeholder="Icon ရှာရန် (ဥပမာ - taxi, ကား, ဆိုင်ကယ်, ထမင်း, မီး, ရေ, ဆီ)..."
                                className="w-full pl-8 pr-7 py-2 bg-gray-50 border border-gray-300 rounded-xl text-xs font-bold text-gray-800 outline-none focus:border-[#123524]"
                              />
                              <Search className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-2.5" />
                            </div>
                            <div className="grid grid-cols-3 sm:grid-cols-4 gap-1.5 max-h-44 overflow-y-auto p-1">
                              {filteredIconLibrary.map((ic, idx) => (
                                <button
                                  key={idx}
                                  type="button"
                                  onClick={() => {
                                    setEditingCatEmoji(ic.emoji);
                                    setIconPickerTarget(null);
                                  }}
                                  className={`p-2 rounded-xl border text-left flex items-center gap-2 transition ${
                                    editingCatEmoji === ic.emoji
                                      ? 'bg-[#123524] text-[#D4AF37] border-[#123524] font-black'
                                      : 'bg-gray-50 hover:bg-yellow-50 border-gray-200 text-gray-700 font-bold'
                                  }`}
                                >
                                  <span className="text-base">{ic.emoji}</span>
                                  <span className="text-[10px] truncate">{ic.label}</span>
                                </button>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-3 min-w-0">
                          <span className="w-9 h-9 rounded-xl bg-gray-100 border border-gray-200 flex items-center justify-center text-lg flex-shrink-0">
                            {cat.iconEmoji}
                          </span>
                          <div className="min-w-0">
                            <div className="text-xs font-black text-gray-800 truncate">{cat.title}</div>
                            <div className="text-[10px] text-gray-400 font-semibold">
                              အသေးစိတ် ခေါင်းစဉ် (Quick Items): {cat.quickPresets.length} ခု
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5 flex-shrink-0">
                          <button
                            type="button"
                            onClick={() => {
                              setEditingCatId(cat.id);
                              setEditingCatTitle(cat.title);
                              setEditingCatEmoji(cat.iconEmoji);
                              setIconPickerTarget('edit');
                              setIconSearchQuery('');
                            }}
                            className="px-3 py-1.5 rounded-xl bg-amber-50 hover:bg-amber-100 text-[#123524] border border-amber-200 text-[11px] font-black flex items-center gap-1 transition"
                          >
                            <Edit3 className="w-3 h-3" /> Icon / အမည်ပြင်ရန်
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteCategory(cat.id, cat.title)}
                            className="p-1.5 rounded-xl bg-red-50 hover:bg-red-100 text-red-600 transition"
                            title="Delete Category"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="pt-3 border-t border-gray-200 flex items-center justify-between">
              <button
                type="button"
                onClick={handleResetDefaultCategories}
                className="text-xs font-bold text-gray-500 hover:text-[#123524] flex items-center gap-1"
              >
                <RotateCcw className="w-3.5 h-3.5" /> မူလ Default စာရင်းအတိုင်း ပြန်ထားမည်
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowCategoryManagerModal(false);
                  setIconPickerTarget(null);
                  setEditingCatId(null);
                }}
                className="px-5 py-2 bg-[#123524] text-[#D4AF37] rounded-xl text-xs font-black"
              >
                Done (ပြီးပြီ)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          MODAL 2: STAFF PAYROLL & EXECUTIVE SALARY BREAKDOWN
         ========================================================================= */}
      {showPayrollBreakdownModal && (
        <div className="fixed inset-0 z-[260] bg-black/70 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-6 shadow-2xl border border-[#D4AF37]/40 my-auto max-h-[90vh] flex flex-col space-y-4">
            <div className="flex justify-between items-center border-b border-gray-200 pb-3.5">
              <div>
                <h3 className="text-base sm:text-lg font-black text-[#123524] flex items-center">
                  <Banknote className="w-5 h-5 mr-2 text-[#D4AF37]" />
                  လစာနှင့် ကော်မရှင် စာရင်းချုပ် ({selectedMonth})
                </h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  Staff Pay Roll မှ တိုက်ရိုက်ချိတ်ဆက်ထားသော ဝန်ထမ်းလစာ၊ CEO လစာ နှင့် Manager လစာ အသေးစိတ်
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowPayrollBreakdownModal(false)}
                className="px-3 py-1.5 rounded-xl bg-gray-100 hover:bg-red-50 text-gray-600 hover:text-red-600 text-xs font-black"
              >
                ✕ Close
              </button>
            </div>

            <div className="overflow-y-auto flex-1 space-y-3 pr-1 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200">
                  <div className="text-[10px] font-bold text-emerald-800 uppercase">Therapists Net Pay</div>
                  <div className="text-sm font-black text-[#123524] mt-0.5">
                    {formatPrice(monthlyCalculations.totalTherapistNetPayroll)}
                  </div>
                </div>
                <div className="p-3 rounded-xl bg-amber-50 border border-amber-200">
                  <div className="text-[10px] font-bold text-amber-900 uppercase">{payrollDoc.ceoName} Salary</div>
                  <div className="text-sm font-black text-[#123524] mt-0.5">
                    {formatPrice(payrollDoc.ceoSalary)}
                  </div>
                </div>
                <div className="p-3 rounded-xl bg-blue-50 border border-blue-200">
                  <div className="text-[10px] font-bold text-blue-900 uppercase">{payrollDoc.managerName} Salary</div>
                  <div className="text-sm font-black text-[#123524] mt-0.5">
                    {formatPrice(payrollDoc.managerSalary)}
                  </div>
                </div>
              </div>

              <div className="border border-gray-200 rounded-xl overflow-hidden">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-[#123524] text-[#D4AF37] text-[10px] uppercase">
                      <th className="p-2.5">Staff / Executive</th>
                      <th className="p-2.5 text-center">Sections</th>
                      <th className="p-2.5 text-right">Gross / Comm</th>
                      <th className="p-2.5 text-right">Deductions</th>
                      <th className="p-2.5 text-right">Net Payable</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 font-semibold text-gray-700">
                    {payrollDoc.ceoSalary > 0 && (
                      <tr className="bg-amber-50/40">
                        <td className="p-2.5 font-black text-[#123524]">👑 {payrollDoc.ceoName} (CEO Salary)</td>
                        <td className="p-2.5 text-center">-</td>
                        <td className="p-2.5 text-right">{formatPrice(payrollDoc.ceoSalary)}</td>
                        <td className="p-2.5 text-right">0 Ks</td>
                        <td className="p-2.5 text-right font-black text-[#123524]">{formatPrice(payrollDoc.ceoSalary)}</td>
                      </tr>
                    )}
                    {payrollDoc.managerSalary > 0 && (
                      <tr className="bg-blue-50/40">
                        <td className="p-2.5 font-black text-[#123524]">👔 {payrollDoc.managerName} (Manager Salary)</td>
                        <td className="p-2.5 text-center">-</td>
                        <td className="p-2.5 text-right">{formatPrice(payrollDoc.managerSalary)}</td>
                        <td className="p-2.5 text-right">0 Ks</td>
                        <td className="p-2.5 text-right font-black text-[#123524]">
                          {formatPrice(payrollDoc.managerSalary)}
                        </td>
                      </tr>
                    )}
                    {monthlyCalculations.therapistPayrollList.map((st, i) => (
                      <tr key={i} className="hover:bg-gray-50">
                        <td className="p-2.5 font-bold text-gray-800">{st.staffName}</td>
                        <td className="p-2.5 text-center">{st.sectionsCount} Sec</td>
                        <td className="p-2.5 text-right text-emerald-700">
                          {formatPrice(st.serviceCommission + st.baseAndBonus)}
                        </td>
                        <td className="p-2.5 text-right text-red-600">-{formatPrice(st.staffDeductions)}</td>
                        <td className="p-2.5 text-right font-black text-[#123524]">{formatPrice(st.netPayable)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          1. TOP HEADER & EXECUTIVE SUMMARY CARDS
         ========================================================================= */}
      <div className="bg-white p-5 sm:p-6 rounded-2xl shadow-sm border border-gray-200 space-y-5">
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 border-b border-gray-100 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-[#123524]/10 text-[#123524]">
                Shop Expense & Payroll Tracker
              </span>
              <h2 className="text-lg sm:text-xl font-black text-[#123524] flex items-center">
                <Wallet className="w-5 h-5 mr-2 text-[#D4AF37]" />
                Expense Manager (နေ့စဉ်နှင့် လစဉ် အသုံးစရိတ် စီမံခန့်ခွဲမှု)
              </h2>
            </div>
            <p className="text-xs text-gray-500 mt-1">
              ဆိုင်အသုံးစရိတ်များ၊ ဝန်ထမ်းလစာ (Staff Payroll)၊ CEO လစာ နှင့် Manager လစာများကို Category အလိုက် စိတ်ကြိုက် ပြင်ဆင်မှတ်သားနိုင်ပါသည်
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto">
            <div className="flex items-center gap-2 bg-gray-50 px-3 py-1.5 rounded-xl border border-gray-300">
              <Calendar className="w-4 h-4 text-[#D4AF37]" />
              <span className="text-[11px] font-bold text-gray-500">လ ရွေးရန်:</span>
              <input
                type="month"
                value={selectedMonth}
                onChange={(e) => {
                  if (e.target.value) {
                    setSelectedMonth(e.target.value);
                    setDateFilterMode('all');
                  }
                }}
                className="bg-transparent text-xs font-black text-[#123524] outline-none cursor-pointer"
              />
            </div>

            <button
              type="button"
              onClick={() => setShowCategoryManagerModal(true)}
              className="px-3 py-2 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 rounded-xl text-xs font-black flex items-center gap-1.5 transition"
            >
              <Settings className="w-3.5 h-3.5 text-[#123524]" /> Category & Icon ပြင်ရန်
            </button>

            <button
              type="button"
              onClick={handleExportExpensesExcel}
              className="px-3.5 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 rounded-xl text-xs font-black flex items-center gap-1.5 transition shadow-2xs"
            >
              <Download className="w-3.5 h-3.5" /> Export Excel
            </button>
          </div>
        </div>

        {/* 4 Top Summary KPI Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
          <div className="p-4 rounded-2xl bg-red-50/60 border border-red-200">
            <div className="text-[10px] font-extrabold text-red-800 uppercase tracking-wider">
              ၁။ ဆိုင်အသုံးစရိတ် (Operational)
            </div>
            <div className="text-lg sm:text-xl font-black text-red-600 mt-1">
              {formatPrice(totalOperationalExpenses)}
            </div>
            <div className="text-[10px] font-bold text-gray-500 mt-1">
              မှတ်တမ်း: {monthExpenses.length} ကြိမ်
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-amber-50/70 border border-amber-200">
            <div className="text-[10px] font-extrabold text-amber-900 uppercase tracking-wider flex items-center justify-between">
              <span>၂။ ဝန်ထမ်းလစာ (Staff Payroll)</span>
              <span className="bg-amber-200/80 text-amber-900 px-1.5 py-0.2 rounded text-[8px] font-black">
                Auto
              </span>
            </div>
            <div className="text-lg sm:text-xl font-black text-[#123524] mt-1">
              {formatPrice(monthlyCalculations.totalTherapistNetPayroll)}
            </div>
            <div className="text-[10px] font-bold text-amber-800 mt-1">
              ဝန်ထမ်း {monthlyCalculations.therapistPayrollList.length} ဦး ({monthlyCalculations.totalBookingsCount} Sec)
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-blue-50/70 border border-blue-200">
            <div className="text-[10px] font-extrabold text-blue-900 uppercase tracking-wider">
              ၃။ CEO + Manager လစာ
            </div>
            <div className="text-lg sm:text-xl font-black text-blue-900 mt-1">
              {formatPrice(payrollDoc.ceoSalary + payrollDoc.managerSalary)}
            </div>
            <div className="text-[10px] font-bold text-blue-700 mt-1 truncate">
              CEO: {formatPrice(payrollDoc.ceoSalary)} | Mgr: {formatPrice(payrollDoc.managerSalary)}
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-gradient-to-br from-[#0B2419] via-[#123524] to-[#1a4a32] text-white border border-[#D4AF37]/50 shadow-sm">
            <div className="text-[10px] font-extrabold text-[#D4AF37] uppercase tracking-wider">
              ၄။ စုစုပေါင်း ထွက်ငွေချုပ် (Total Outflow)
            </div>
            <div className="text-lg sm:text-xl font-black text-white mt-1">
              {formatPrice(grandTotalAllOutflow)}
            </div>
            <div className="text-[10px] font-semibold text-emerald-200 mt-1 truncate">
              အသုံးစရိတ် + လစာအားလုံးပေါင်း
            </div>
          </div>
        </div>

        {/* Sleek Collapsible Executive Payroll Bar */}
        <div className="bg-gradient-to-r from-[#0B2419] via-[#123524] to-[#1a4a32] text-white p-4 rounded-2xl border border-[#D4AF37]/40">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#D4AF37]/15 border border-[#D4AF37]/40 flex items-center justify-center text-lg">
                💼
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs sm:text-sm font-black text-white">
                    ဝန်ထမ်းလစာ + CEO + Manager လစာ စာရင်းချုပ် ({selectedMonth})
                  </span>
                  <span className="bg-[#D4AF37] text-[#0B2419] text-[9px] font-black px-2 py-0.5 rounded uppercase">
                    Payroll Category
                  </span>
                </div>
                <div className="text-[11px] text-gray-300 mt-0.5">
                  Therapists Net: <strong className="text-[#D4AF37]">{formatPrice(monthlyCalculations.totalTherapistNetPayroll)}</strong> •{' '}
                  {payrollDoc.ceoName}: <strong className="text-white">{formatPrice(payrollDoc.ceoSalary)}</strong> •{' '}
                  {payrollDoc.managerName}: <strong className="text-white">{formatPrice(payrollDoc.managerSalary)}</strong>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 ml-auto">
              <button
                type="button"
                onClick={() => setShowSalaryEditor(!showSalaryEditor)}
                className="px-3 py-2 bg-[#D4AF37] hover:bg-yellow-400 text-[#0B2419] rounded-xl text-xs font-black flex items-center gap-1 transition"
              >
                <Edit3 className="w-3.5 h-3.5" />
                <span>CEO / Manager လစာ သတ်မှတ်ရန်</span>
                {showSalaryEditor ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              </button>
              <button
                type="button"
                onClick={() => setShowPayrollBreakdownModal(true)}
                className="px-3 py-2 bg-white/10 hover:bg-white/20 text-white border border-white/20 rounded-xl text-xs font-bold transition"
              >
                စာရင်းအသေးစိတ်
              </button>
            </div>
          </div>

          {showSalaryEditor && (
            <form
              onSubmit={handleSaveExecutiveSalaries}
              className="mt-4 pt-4 border-t border-white/15 grid grid-cols-1 md:grid-cols-12 gap-3 items-end animate-fade-in"
            >
              <div className="md:col-span-5">
                <label className="block text-[10px] font-extrabold text-[#D4AF37] uppercase mb-1">
                  CEO အမည် နှင့် လစာ (Ks)
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={ceoNameInput}
                    onChange={(e) => setCeoNameInput(e.target.value)}
                    placeholder="CEO"
                    className="w-28 p-2.5 bg-black/30 border border-white/20 rounded-xl text-xs font-bold text-white outline-none"
                  />
                  <input
                    type="number"
                    min={0}
                    step={10000}
                    value={ceoSalaryInput}
                    onChange={(e) => setCeoSalaryInput(e.target.value)}
                    placeholder="0"
                    className="flex-1 p-2.5 bg-white text-[#123524] rounded-xl text-xs font-black outline-none"
                  />
                </div>
              </div>

              <div className="md:col-span-5">
                <label className="block text-[10px] font-extrabold text-[#D4AF37] uppercase mb-1">
                  Manager အမည် နှင့် လစာ (Ks)
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={managerNameInput}
                    onChange={(e) => setManagerNameInput(e.target.value)}
                    placeholder="Spa Manager"
                    className="w-32 p-2.5 bg-black/30 border border-white/20 rounded-xl text-xs font-bold text-white outline-none"
                  />
                  <input
                    type="number"
                    min={0}
                    step={10000}
                    value={managerSalaryInput}
                    onChange={(e) => setManagerSalaryInput(e.target.value)}
                    placeholder="0"
                    className="flex-1 p-2.5 bg-white text-[#123524] rounded-xl text-xs font-black outline-none"
                  />
                </div>
              </div>

              <div className="md:col-span-2">
                <button
                  type="submit"
                  disabled={isSavingExecSalary}
                  className="w-full py-2.5 px-4 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-xs font-black uppercase shadow-md transition flex items-center justify-center gap-1.5"
                >
                  <Save className="w-4 h-4" />
                  <span>{isSavingExecSalary ? '...' : 'Save'}</span>
                </button>
              </div>
            </form>
          )}
        </div>
      </div>

      {/* =========================================================================
          2. ADD NEW EXPENSE FORM & CATEGORY BREAKDOWN
         ========================================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left 5 Cols: Add Expense Form */}
        <div className="lg:col-span-5 bg-white p-5 rounded-2xl shadow-sm border border-gray-200 space-y-4">
          <div className="flex items-center justify-between border-b border-gray-100 pb-3">
            <div>
              <h3 className="text-sm sm:text-base font-black text-[#123524] flex items-center">
                <PlusCircle className="w-4 h-4 mr-2 text-[#D4AF37]" />
                အသုံးစရိတ်အသစ် ထည့်သွင်းရန်
              </h3>
              <p className="text-[11px] text-gray-500 mt-0.5">
                ဘောင်ချာတစ်စောင်တည်းတွင် ပစ္စည်းအများကြီးပါလျှင် တစ်ခုထက်ပိုနှိပ်၍ ပေါင်းထည့်နိုင်ပါသည်
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowCategoryManagerModal(true)}
              className="px-2.5 py-1.5 rounded-xl bg-amber-50 hover:bg-amber-100 text-[#123524] border border-amber-200 text-[11px] font-black flex items-center gap-1 transition"
            >
              <Settings className="w-3.5 h-3.5 text-[#D4AF37]" />
              <span>Category / Icon ပြင်ရန်</span>
            </button>
          </div>

          <form onSubmit={handleAddExpense} className="space-y-4">
            <div ref={categoryDropdownRef} className="relative">
              <label className="block text-[10px] font-extrabold text-gray-500 uppercase tracking-wider mb-1.5">
                ၁။ အသုံးစရိတ် အမျိုးအစား ရွေးချယ်ပါ (Select Category) *
              </label>

              <button
                type="button"
                onClick={() => {
                  setIsCategoryDropdownOpen(!isCategoryDropdownOpen);
                  setDropdownSearchQuery('');
                }}
                className="w-full p-3 bg-gradient-to-r from-[#0B2419]/5 via-yellow-50/40 to-white border-2 border-[#D4AF37]/60 hover:border-[#123524] rounded-xl flex items-center justify-between transition shadow-2xs"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span className="w-9 h-9 rounded-xl bg-[#123524] text-[#D4AF37] flex items-center justify-center text-lg shadow-xs flex-shrink-0">
                    {selectedCategoryMeta?.iconEmoji || '📌'}
                  </span>
                  <div className="text-left min-w-0">
                    <div className="text-xs sm:text-sm font-black text-[#123524] truncate">
                      {selectedCategoryMeta?.title}
                    </div>
                    <div className="text-[10px] font-semibold text-gray-500 truncate">
                      အသင့်ရွေးချယ်စရာ {selectedCategoryMeta?.quickPresets.length || 0} မျိုး ပါဝင်သည်
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 pl-2 flex-shrink-0">
                  <span className="text-[10px] font-bold text-[#123524] bg-[#D4AF37]/25 px-2 py-0.5 rounded-md">
                    ပြောင်းရန်
                  </span>
                  {isCategoryDropdownOpen ? (
                    <ChevronUp className="w-4 h-4 text-[#123524]" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-[#123524]" />
                  )}
                </div>
              </button>

              {isCategoryDropdownOpen && (
                <div className="absolute left-0 right-0 top-full mt-2 z-50 bg-white rounded-2xl shadow-2xl border-2 border-[#123524]/20 overflow-hidden animate-fade-in">
                  <div className="p-2.5 bg-gray-50 border-b border-gray-200 flex items-center gap-2">
                    <div className="relative flex-1">
                      <input
                        type="text"
                        autoFocus
                        value={dropdownSearchQuery}
                        onChange={(e) => setDropdownSearchQuery(e.target.value)}
                        placeholder="Category အမည်ရှာရန်..."
                        className="w-full pl-8 pr-7 py-1.5 bg-white border border-gray-300 rounded-xl text-xs font-bold text-gray-800 outline-none focus:border-[#123524]"
                      />
                      <Search className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-2" />
                      {dropdownSearchQuery && (
                        <button
                          type="button"
                          onClick={() => setDropdownSearchQuery('')}
                          className="absolute right-2 top-2 text-gray-400 hover:text-gray-600"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="max-h-64 overflow-y-auto divide-y divide-gray-100 p-1.5">
                    {filteredDropdownCategories.length === 0 ? (
                      <div className="p-4 text-center text-xs text-gray-400 font-bold">
                        ရှာဖွေထားသော Category မတွေ့ပါ။
                      </div>
                    ) : (
                      filteredDropdownCategories.map((cat) => {
                        const isSelected = expCategory === cat.id;
                        return (
                          <button
                            key={cat.id}
                            type="button"
                            onClick={() => {
                              setExpCategory(cat.id);
                              setIsCategoryDropdownOpen(false);
                            }}
                            className={`w-full px-3 py-2.5 rounded-xl flex items-center justify-between gap-2 text-left transition ${
                              isSelected
                                ? 'bg-[#123524] text-[#D4AF37] font-black shadow-xs'
                                : 'hover:bg-yellow-50/70 text-gray-800 font-bold'
                            }`}
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              <span
                                className={`w-8 h-8 rounded-lg flex items-center justify-center text-base flex-shrink-0 ${
                                  isSelected ? 'bg-white/15' : 'bg-gray-100'
                                }`}
                              >
                                {cat.iconEmoji}
                              </span>
                              <div className="min-w-0">
                                <div className="text-xs truncate">{cat.title}</div>
                                <div
                                  className={`text-[10px] truncate ${
                                    isSelected ? 'text-gray-300 font-medium' : 'text-gray-400 font-medium'
                                  }`}
                                >
                                  {cat.quickPresets.slice(0, 3).join(' • ') || cat.subTitle}
                                </div>
                              </div>
                            </div>
                            {isSelected && <Check className="w-4 h-4 text-[#D4AF37] flex-shrink-0" />}
                          </button>
                        );
                      })
                    )}
                  </div>

                  <div className="p-2 bg-gray-50 border-t border-gray-200 flex items-center justify-between">
                    <button
                      type="button"
                      onClick={() => {
                        setIsCategoryDropdownOpen(false);
                        setShowCategoryManagerModal(true);
                      }}
                      className="w-full py-2 px-3 bg-[#123524]/10 hover:bg-[#123524] text-[#123524] hover:text-[#D4AF37] rounded-xl text-xs font-black flex items-center justify-center gap-1.5 transition"
                    >
                      <Settings className="w-3.5 h-3.5" />
                      <span>+ Category အသစ်ထည့်ရန် / Icon ပြောင်းရန်</span>
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div className="bg-gray-50/90 p-3.5 rounded-2xl border border-gray-200 space-y-2.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <span className="text-[10px] font-extrabold text-[#123524] uppercase flex items-center gap-1">
                    <span>{selectedCategoryMeta?.iconEmoji}</span>
                    <span>အမြန်ရွေးချယ်ရန် (Multiple Select ရသည်):</span>
                  </span>
                  {selectedItemsList.length > 0 && (
                    <span className="text-[10px] font-bold text-emerald-700 block mt-0.5">
                      ✓ ရွေးချယ်ထားသော အမျိုးအစား ({selectedItemsList.length}) ခု ပေါင်းထည့်ထားသည်
                    </span>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-1">
                  {selectedCategoryMeta?.quickPresets.length > 1 && (
                    <button
                      type="button"
                      onClick={handleSelectAllQuickItems}
                      className="px-2 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 text-[10px] font-black transition"
                    >
                      အားလုံးရွေးမည်
                    </button>
                  )}
                  {selectedItemsList.length > 0 && (
                    <button
                      type="button"
                      onClick={handleClearQuickItems}
                      className="px-2 py-1 rounded-lg bg-gray-200 hover:bg-gray-300 text-gray-700 text-[10px] font-bold transition"
                    >
                      ပြန်ရှင်းမည်
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setShowAddQuickItemInput(!showAddQuickItemInput)}
                    className="px-2 py-1 rounded-lg bg-[#123524] text-[#D4AF37] text-[10px] font-black flex items-center gap-0.5 hover:bg-[#1a4a32] transition"
                  >
                    <Plus className="w-3 h-3" /> အသစ်ထည့်
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsEditingQuickItems(!isEditingQuickItems)}
                    className={`px-2 py-1 rounded-lg text-[10px] font-black border transition ${
                      isEditingQuickItems
                        ? 'bg-red-600 text-white border-red-600'
                        : 'bg-white text-gray-600 border-gray-300 hover:border-gray-400'
                    }`}
                  >
                    {isEditingQuickItems ? '✓ ပြီးပြီ' : 'ဖျက်ရန် / ပြင်ရန်'}
                  </button>
                </div>
              </div>

              {showAddQuickItemInput && (
                <div className="flex gap-1.5 pt-1 animate-fade-in">
                  <input
                    type="text"
                    autoFocus
                    value={newQuickItemText}
                    onChange={(e) => setNewQuickItemText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddQuickPresetItem();
                      }
                    }}
                    placeholder="အသေးစိတ် ခေါင်းစဉ်အသစ် ရိုက်ထည့်ပါ..."
                    className="flex-1 p-2 bg-white border border-[#123524] rounded-xl text-xs font-bold text-gray-800 outline-none"
                  />
                  <button
                    type="button"
                    onClick={handleAddQuickPresetItem}
                    className="px-3 py-2 bg-emerald-600 text-white rounded-xl text-xs font-black"
                  >
                    Save
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowAddQuickItemInput(false);
                      setNewQuickItemText('');
                    }}
                    className="px-2.5 py-2 bg-gray-200 text-gray-600 rounded-xl text-xs font-bold"
                  >
                    ✕
                  </button>
                </div>
              )}

              <div className="flex flex-wrap gap-1.5">
                {selectedCategoryMeta?.quickPresets.length === 0 ? (
                  <span className="text-[11px] text-gray-400 font-semibold py-1">
                    အသင့်ရွေးချယ်စရာ ခေါင်းစဉ်မရှိသေးပါ။ "+ အသစ်ထည့်" ကိုနှိပ်၍ ထည့်နိုင်ပါသည်။
                  </span>
                ) : (
                  selectedCategoryMeta?.quickPresets.map((preset, idx) => {
                    const isSelectedChip = selectedItemsList.some(
                      (item) => item.toLowerCase() === preset.trim().toLowerCase()
                    );
                    return (
                      <div key={idx} className="inline-flex items-center">
                        <button
                          type="button"
                          onClick={() => handleToggleQuickItem(preset)}
                          className={`px-2.5 py-1.5 text-[11px] font-bold border transition flex items-center gap-1 ${
                            isEditingQuickItems ? 'rounded-l-lg' : 'rounded-lg'
                          } ${
                            isSelectedChip
                              ? 'bg-[#123524] text-[#D4AF37] border-[#123524] shadow-2xs'
                              : 'bg-white text-gray-700 border-gray-200 hover:border-[#D4AF37]'
                          }`}
                        >
                          <span>{isSelectedChip ? '✓' : '+'}</span>
                          <span>{preset}</span>
                        </button>
                        {isEditingQuickItems && (
                          <button
                            type="button"
                            onClick={() => handleRemoveQuickPresetItem(preset)}
                            className="px-1.5 py-1.5 bg-red-100 hover:bg-red-600 text-red-600 hover:text-white border border-l-0 border-red-200 rounded-r-lg text-[11px] font-black transition"
                            title="ဖျက်မည်"
                          >
                            ✕
                          </button>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
              <div className="sm:col-span-7">
                <label className="block text-[10px] font-extrabold text-gray-500 uppercase mb-1">
                  ၂။ အသုံးစရိတ် အကြောင်းအရာ (Item Name / Multiple Items) *
                </label>
                <input
                  type="text"
                  required
                  value={expTitle}
                  onChange={(e) => setExpTitle(e.target.value)}
                  placeholder="အပေါ်မှ ခလုတ်များကို တစ်ခုထက်ပိုနှိပ်ပါ သို့မဟုတ် စာရိုက်ထည့်ပါ..."
                  className="w-full p-2.5 bg-gray-50 border border-gray-300 rounded-xl text-xs font-bold text-gray-800 outline-none focus:border-[#123524]"
                />
              </div>

              <div className="sm:col-span-5">
                <label className="block text-[10px] font-extrabold text-gray-500 uppercase mb-1">
                  ၃။ ကုန်ကျငွေ ပမာဏ (Amount - Ks) *
                </label>
                <input
                  type="number"
                  required
                  min={1}
                  value={expAmount}
                  onChange={(e) => setExpAmount(e.target.value)}
                  placeholder="ဥပမာ - 215400"
                  className="w-full p-2.5 bg-gray-50 border border-gray-300 rounded-xl text-xs font-black text-red-600 outline-none focus:border-red-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
              <div className="sm:col-span-4">
                <label className="block text-[10px] font-extrabold text-gray-500 uppercase mb-1">
                  နေ့ရက် (Date)
                </label>
                <input
                  type="date"
                  required
                  value={expDate}
                  onChange={(e) => setExpDate(e.target.value)}
                  className="w-full p-2.5 bg-gray-50 border border-gray-300 rounded-xl text-xs font-black text-[#123524] outline-none"
                />
              </div>

              <div className="sm:col-span-4">
                <label className="block text-[10px] font-extrabold text-gray-500 uppercase mb-1">
                  Payment Method
                </label>
                <select
                  value={expPaymentMethod}
                  onChange={(e) => setExpPaymentMethod(e.target.value)}
                  className="w-full p-2.5 bg-gray-50 border border-gray-300 rounded-xl text-xs font-black text-[#123524] outline-none"
                >
                  <option value="Cash">Cash (ငွေသား)</option>
                  <option value="KBZ PAY">KBZ PAY</option>
                  <option value="Wave PAY">Wave PAY</option>
                  <option value="AYA PAY">AYA PAY</option>
                  <option value="Bank Transfer">Bank Transfer</option>
                </select>
              </div>

              <div className="sm:col-span-4">
                <label className="block text-[10px] font-extrabold text-gray-500 uppercase mb-1">
                  မှတ်ချက် (Optional)
                </label>
                <input
                  type="text"
                  value={expNote}
                  onChange={(e) => setExpNote(e.target.value)}
                  placeholder="ဆိုင်အမည် / အရေအတွက်..."
                  className="w-full p-2.5 bg-gray-50 border border-gray-300 rounded-xl text-xs font-semibold text-gray-700 outline-none"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isSavingExpense}
              className="w-full py-3.5 bg-gradient-to-r from-[#123524] to-[#1a4a32] text-[#D4AF37] rounded-xl font-black text-xs uppercase tracking-wider shadow-md hover:opacity-95 transition flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <PlusCircle className="w-4 h-4" />
              <span>{isSavingExpense ? 'သိမ်းဆည်းနေပါသည်...' : 'အသုံးစရိတ် သိမ်းဆည်းမည် (Save Expense)'}</span>
            </button>
          </form>
        </div>

        {/* Right 7 Cols: Category-by-Category Breakdown with Visual Progress Bars */}
        <div className="lg:col-span-7 bg-white p-5 rounded-2xl shadow-sm border border-gray-200 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 pb-3">
            <div>
              <h3 className="text-sm sm:text-base font-black text-[#123524] flex items-center">
                <PieChart className="w-4 h-4 mr-2 text-[#D4AF37]" />
                Category အလိုက် ကုန်ကျစရိတ် စာရင်းချုပ် ({selectedMonth})
              </h3>
              <p className="text-[11px] text-gray-500 mt-0.5">
                Category တစ်ခုချင်းစီကို နှိပ်၍ အောက်ပါစာရင်းဇယားတွင် သီးသန့် စစ်ကြည့်နိုင်ပါသည်
              </p>
            </div>
            {activeCategoryFilter !== 'all' && (
              <button
                type="button"
                onClick={() => setActiveCategoryFilter('all')}
                className="px-3 py-1 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-xs font-black"
              >
                အားလုံး ပြန်ကြည့်မည်
              </button>
            )}
          </div>

          <div className="space-y-2.5 max-h-[480px] overflow-y-auto pr-1">
            <div
              onClick={() => setShowPayrollBreakdownModal(true)}
              className="p-3.5 rounded-xl bg-amber-50/70 border border-amber-300 cursor-pointer hover:shadow-xs transition"
            >
              <div className="flex items-center justify-between gap-2 text-xs">
                <div className="font-black text-[#123524] flex items-center gap-1.5">
                  <span>💼</span>
                  <span>ဝန်ထမ်းလစာ + CEO + Manager လစာ (Payroll Auto-Synced)</span>
                </div>
                <div className="text-right whitespace-nowrap">
                  <span className="font-black text-sm text-[#123524]">
                    {formatPrice(monthlyCalculations.totalCombinedPayroll)}
                  </span>
                  <span className="text-[10px] font-bold text-amber-800 ml-1.5">
                    (
                    {grandTotalAllOutflow > 0
                      ? ((monthlyCalculations.totalCombinedPayroll / grandTotalAllOutflow) * 100).toFixed(1)
                      : '0.0'}
                    %)
                  </span>
                </div>
              </div>
              <div className="w-full h-2 bg-amber-200/60 rounded-full overflow-hidden mt-2">
                <div
                  className="h-full bg-[#123524] rounded-full transition-all duration-500"
                  style={{
                    width: `${Math.min(
                      100,
                      grandTotalAllOutflow > 0
                        ? (monthlyCalculations.totalCombinedPayroll / grandTotalAllOutflow) * 100
                        : 0
                    )}%`
                  }}
                />
              </div>
            </div>

            {categoryBreakdownList.map((cat) => {
              const isSelected = activeCategoryFilter === cat.id;
              return (
                <div
                  key={cat.id}
                  onClick={() => setActiveCategoryFilter(isSelected ? 'all' : cat.id)}
                  className={`p-3.5 rounded-xl border cursor-pointer transition ${
                    isSelected
                      ? 'bg-yellow-50 border-[#123524] ring-1 ring-[#123524]'
                      : 'bg-gray-50/70 border-gray-200 hover:bg-gray-100/70'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <div className="min-w-0">
                      <div className="font-bold text-gray-800 flex items-center gap-2 truncate">
                        <span className="text-sm">{cat.iconEmoji}</span>
                        <span className="truncate">{cat.title}</span>
                        <span className="text-[10px] font-black bg-white px-2 py-0.5 rounded border border-gray-200 text-gray-600">
                          {cat.count} ကြိမ်
                        </span>
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0 whitespace-nowrap">
                      <span className={`font-black text-sm ${cat.total > 0 ? 'text-red-600' : 'text-gray-400'}`}>
                        {formatPrice(cat.total)}
                      </span>
                      <span className="text-[10px] font-bold text-gray-500 ml-1.5">
                        ({cat.pct.toFixed(1)}%)
                      </span>
                    </div>
                  </div>
                  <div className="w-full h-1.5 bg-gray-200 rounded-full overflow-hidden mt-2">
                    <div
                      className={`h-full ${cat.barColor} rounded-full transition-all duration-500`}
                      style={{ width: `${Math.min(100, cat.pct)}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* =========================================================================
          🌟 3. DATE-GROUPED DAILY EXPENSE RECORDS (SALE REPORT STYLE + DATE FILTER BAR) 🌟
         ========================================================================= */}
      <div className="bg-white p-5 sm:p-6 rounded-2xl shadow-sm border border-gray-200 space-y-5">
        {/* Top Title & Filtered Total Summary */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-gray-100 pb-4">
          <div>
            <h3 className="text-base sm:text-lg font-black text-[#123524] flex items-center gap-2">
              <Calendar className="w-5 h-5 text-[#D4AF37]" />
              <span>နေ့စဉ် အသုံးစရိတ် မှတ်တမ်းစာရင်း ({selectedMonth})</span>
            </h3>
            <p className="text-xs text-gray-500 mt-0.5">
              ရက်စွဲတစ်ရက်ချင်းစီအလိုက် တစ်ရက်စာ စုစုပေါင်းအသုံးစရိတ် (Daily Expense Total) နှင့် မှတ်တမ်းအသေးစိတ်
            </p>
          </div>

          <div className="flex items-center gap-2.5 self-end sm:self-center">
            <div className="bg-red-50 border border-red-200 px-4 py-2 rounded-xl text-right">
              <span className="text-[10px] font-extrabold text-red-800 uppercase block">
                စုစုပေါင်း ပြသထားသော အသုံးစရိတ် ({filteredExpenses.length} ကြိမ်)
              </span>
              <span className="text-base sm:text-lg font-black text-red-600">
                -{formatPrice(filteredExpenses.reduce((s, e) => s + e.amount, 0))}
              </span>
            </div>
          </div>
        </div>

        {/* 🌟 Date Filter Bar (All, Today, Yesterday, Single Date, From -> To Range) + Category + Search 🌟 */}
        <div className="flex flex-col gap-3 bg-gray-50/80 p-3.5 rounded-2xl border border-gray-200/90">
          {/* Row 1: Quick Date Filter Buttons & Date Pickers */}
          <div className="flex flex-wrap items-center justify-between gap-2.5">
            <div className="flex flex-wrap items-center gap-1 bg-white p-1 rounded-xl border border-gray-200 shadow-2xs">
              <button
                type="button"
                onClick={() => setDateFilterMode('all')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                  dateFilterMode === 'all'
                    ? 'bg-[#123524] text-[#D4AF37] shadow-xs'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                ရက်အားလုံး ({monthExpenses.length})
              </button>
              <button
                type="button"
                onClick={() => {
                  const todayYm = todayStr.substring(0, 7);
                  if (selectedMonth !== todayYm) setSelectedMonth(todayYm);
                  setDateFilterMode('today');
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                  dateFilterMode === 'today'
                    ? 'bg-[#123524] text-[#D4AF37] shadow-xs'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                ယနေ့ (Today)
              </button>
              <button
                type="button"
                onClick={() => {
                  const yestYm = yesterdayStr.substring(0, 7);
                  if (selectedMonth !== yestYm) setSelectedMonth(yestYm);
                  setDateFilterMode('yesterday');
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                  dateFilterMode === 'yesterday'
                    ? 'bg-[#123524] text-[#D4AF37] shadow-xs'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                မနေ့က (Yesterday)
              </button>

              {/* Single Specific Date Picker */}
              <div
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border transition ${
                  dateFilterMode === 'single_date'
                    ? 'bg-[#123524] text-[#D4AF37] border-[#123524]'
                    : 'bg-gray-50 text-gray-700 border-gray-200'
                }`}
              >
                <span className="text-[10px] font-bold opacity-80">ရက်စွဲရွေးရန်:</span>
                <input
                  type="date"
                  value={singleDateFilter}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (!val) return;
                    setSingleDateFilter(val);
                    if (val.substring(0, 7) !== selectedMonth) {
                      setSelectedMonth(val.substring(0, 7));
                    }
                    setDateFilterMode('single_date');
                  }}
                  className={`text-xs font-bold outline-none bg-transparent cursor-pointer ${
                    dateFilterMode === 'single_date' ? 'text-[#D4AF37]' : 'text-[#123524]'
                  }`}
                />
              </div>
            </div>

            {/* From Date ➔ To Date Range Picker */}
            <div
              className={`flex flex-wrap items-center gap-2 px-3 py-1.5 rounded-xl border transition shadow-2xs ${
                dateFilterMode === 'custom_range'
                  ? 'bg-[#123524] text-[#D4AF37] border-[#D4AF37]'
                  : 'bg-white text-gray-700 border-gray-200'
              }`}
            >
              <Calendar className="w-3.5 h-3.5 text-[#D4AF37] flex-shrink-0" />
              <div className="flex items-center gap-1.5 text-xs font-bold">
                <span
                  className={`text-[10px] uppercase ${
                    dateFilterMode === 'custom_range' ? 'text-gray-300' : 'text-gray-400'
                  }`}
                >
                  From:
                </span>
                <input
                  type="date"
                  value={fromDate}
                  onChange={(e) => {
                    const val = e.target.value;
                    setFromDate(val);
                    if (toDate && val > toDate) setToDate(val);
                    setDateFilterMode('custom_range');
                  }}
                  className={`text-xs font-bold outline-none bg-transparent cursor-pointer ${
                    dateFilterMode === 'custom_range' ? 'text-[#D4AF37]' : 'text-[#123524]'
                  }`}
                />
              </div>

              <span
                className={`text-xs font-black ${
                  dateFilterMode === 'custom_range' ? 'text-[#D4AF37]' : 'text-gray-400'
                }`}
              >
                ➔
              </span>

              <div className="flex items-center gap-1.5 text-xs font-bold">
                <span
                  className={`text-[10px] uppercase ${
                    dateFilterMode === 'custom_range' ? 'text-gray-300' : 'text-gray-400'
                  }`}
                >
                  To:
                </span>
                <input
                  type="date"
                  value={toDate}
                  onChange={(e) => {
                    const val = e.target.value;
                    setToDate(val);
                    if (fromDate && val < fromDate) setFromDate(val);
                    setDateFilterMode('custom_range');
                  }}
                  className={`text-xs font-bold outline-none bg-transparent cursor-pointer ${
                    dateFilterMode === 'custom_range' ? 'text-[#D4AF37]' : 'text-[#123524]'
                  }`}
                />
              </div>
            </div>
          </div>

          {/* Row 2: Category Dropdown Filter & Search Input */}
          <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-2.5 pt-2 border-t border-gray-200/60">
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-bold text-gray-500">Category စစ်ရန်:</span>
              <select
                value={activeCategoryFilter}
                onChange={(e) => setActiveCategoryFilter(e.target.value)}
                className="p-2 bg-white border border-gray-300 rounded-xl text-xs font-bold text-[#123524] outline-none shadow-2xs"
              >
                <option value="all">Category အားလုံး ({monthExpenses.length})</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.iconEmoji} {c.title}
                  </option>
                ))}
              </select>
            </div>

            <div className="relative w-full sm:w-72">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="ပစ္စည်းအမည် / မှတ်ချက် / Payment ရှာရန်..."
                className="w-full pl-9 pr-8 py-2 bg-white border border-gray-200 rounded-xl text-xs font-bold outline-none focus:border-[#D4AF37] shadow-2xs"
              />
              <Search className="w-4 h-4 text-gray-400 absolute left-3 top-2.5" />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-2.5 text-gray-400 hover:text-gray-600"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* 🌟 Date-Grouped Daily Expense Cards (Matches Sale Report Look & Feel!) 🌟 */}
        {groupedExpensesByDate.length === 0 ? (
          <div className="p-12 text-center text-gray-400 font-bold border border-dashed border-gray-200 rounded-2xl space-y-2">
            <div>ရွေးချယ်ထားသော ရက်စွဲနှင့် စာရင်းအတွက် အသုံးစရိတ်မှတ်တမ်း မရှိပါ။</div>
            {(dateFilterMode !== 'all' || activeCategoryFilter !== 'all' || searchQuery) && (
              <button
                type="button"
                onClick={() => {
                  setDateFilterMode('all');
                  setActiveCategoryFilter('all');
                  setSearchQuery('');
                }}
                className="text-xs font-black text-[#123524] underline"
              >
                ရက်အားလုံး ပြန်ကြည့်မည် (Show All Records)
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-6">
            {groupedExpensesByDate.map((group) => (
              <div
                key={group.date}
                className="rounded-2xl border border-gray-200 shadow-xs overflow-hidden bg-white"
              >
                {/* Daily Header Banner */}
                <div className="bg-gradient-to-r from-[#123524] via-[#1a4a32] to-[#123524] px-4 sm:px-5 py-3.5 text-white flex flex-wrap items-center justify-between gap-3 border-b border-[#D4AF37]/40">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-white/10 border border-[#D4AF37]/40 flex items-center justify-center text-[#D4AF37] shadow-inner">
                      <Calendar className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="font-extrabold text-xs sm:text-sm text-[#D4AF37] tracking-wide">
                        {formatReadableDateHeader(group.date)}
                      </div>
                      <div className="flex flex-wrap items-center gap-2 text-[11px] text-gray-200 font-semibold mt-0.5">
                        <span>
                          အသုံးစရိတ် အရေအတွက်: <strong>{group.records.length} ကြိမ်</strong>
                        </span>
                        <span>•</span>
                        <span>
                          Cash: <strong>{formatPrice(group.dailyCashTotal)}</strong>
                        </span>
                        <span>•</span>
                        <span>
                          Online Pay: <strong>{formatPrice(group.dailyDigitalTotal)}</strong>
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="bg-black/30 px-4 py-2 rounded-xl border border-[#D4AF37]/40 text-right ml-auto">
                    <span className="text-[9px] font-bold text-gray-300 uppercase tracking-wider block">
                      Daily Expense Total (တစ်ရက်စာ စုစုပေါင်း ကုန်ကျငွေ)
                    </span>
                    <span className="text-base sm:text-lg font-black text-[#D4AF37]">
                      -{formatPrice(group.dailyTotalAmount)}
                    </span>
                  </div>
                </div>

                {/* Expenses Table inside Date Group */}
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse min-w-[820px]">
                    <thead>
                      <tr className="border-b border-gray-100 bg-gray-50/70 text-[11px] text-gray-500 uppercase tracking-wider">
                        <th className="p-3.5">နေ့ရက် (Date)</th>
                        <th className="p-3.5">အမျိုးအစား (Category)</th>
                        <th className="p-3.5">အသုံးစရိတ် အကြောင်းအရာ (Description)</th>
                        <th className="p-3.5">Payment Method</th>
                        <th className="p-3.5 text-right">ကုန်ကျငွေ (Amount)</th>
                        <th className="p-3.5 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 text-xs">
                      {group.records.map((exp) => {
                        const catMeta = categories.find((c) => c.id === exp.category);
                        return (
                          <tr key={exp.id} className="hover:bg-gray-50/80 transition">
                            <td className="p-3.5 font-mono font-bold text-gray-700 whitespace-nowrap">
                              {exp.date}
                            </td>
                            <td className="p-3.5">
                              <span
                                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-black border ${
                                  catMeta?.badgeColor || 'bg-gray-100 text-gray-700 border-gray-200'
                                }`}
                              >
                                <span>{catMeta?.iconEmoji || '📌'}</span>
                                <span>{catMeta?.title || exp.category}</span>
                              </span>
                            </td>
                            <td className="p-3.5 max-w-md">
                              <div className="font-bold text-gray-800 text-sm leading-snug">{exp.title}</div>
                              {exp.note && (
                                <div className="text-[11px] text-gray-500 mt-0.5 font-medium">
                                  မှတ်ချက်: {exp.note}
                                </div>
                              )}
                            </td>
                            <td className="p-3.5">
                              <span className="bg-gray-100 text-gray-700 border border-gray-200 px-2.5 py-1 rounded-md font-bold text-[11px]">
                                {exp.paymentMethod}
                              </span>
                            </td>
                            <td className="p-3.5 text-right font-black text-sm text-red-600 whitespace-nowrap">
                              -{formatPrice(exp.amount)}
                            </td>
                            <td className="p-3.5 text-right">
                              <button
                                type="button"
                                disabled={adminRole !== 'super_admin'}
                                onClick={() => handleDeleteExpense(exp)}
                                className={`p-1.5 rounded-lg transition ${
                                  adminRole === 'super_admin'
                                    ? 'bg-red-50 text-red-600 hover:bg-red-100'
                                    : 'bg-gray-100 text-gray-300 cursor-not-allowed'
                                }`}
                                title="Delete Expense"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
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
    </div>
  );
}

// ============================================================================
// 🌟 4. ADMIN REVENUE & NET PROFIT DASHBOARD COMPONENT 🌟
// ============================================================================

export function AdminRevenueProfitDashboard({
  bookings,
  therapists
}: {
  bookings: Booking[];
  therapists: TherapistProfile[];
}) {
  const todayStr = getLocalTodayStr();
  const currentYearMonth = todayStr.substring(0, 7);
  const [selectedMonth, setSelectedMonth] = useState<string>(currentYearMonth);

  const {
    categories,
    monthExpenses,
    totalOperationalExpenses,
    payrollDoc,
    monthlyCalculations,
    grandTotalAllOutflow,
    netProfit,
    profitMarginPercent
  } = useMonthlyFinancialEngine(selectedMonth, bookings, therapists);

  const outflowBreakdown = useMemo(() => {
    const items: { label: string; icon: string; amount: number; color: string }[] = [
      {
        label: `ဝန်ထမ်းလစာနှင့် ကော်မရှင် (${monthlyCalculations.therapistPayrollList.length} ဦး)`,
        icon: '💼',
        amount: monthlyCalculations.totalTherapistNetPayroll,
        color: 'bg-amber-500'
      }
    ];

    if (payrollDoc.ceoSalary > 0 || payrollDoc.managerSalary > 0) {
      items.push({
        label: `CEO (${payrollDoc.ceoName}) + Manager (${payrollDoc.managerName}) လစာ`,
        icon: '👑',
        amount: payrollDoc.ceoSalary + payrollDoc.managerSalary,
        color: 'bg-blue-600'
      });
    }

    categories.forEach((cat) => {
      const sum = monthExpenses
        .filter((e) => e.category === cat.id)
        .reduce((s, e) => s + e.amount, 0);
      if (sum > 0) {
        items.push({
          label: cat.title,
          icon: cat.iconEmoji,
          amount: sum,
          color: cat.barColor
        });
      }
    });

    return items.sort((a, b) => b.amount - a.amount);
  }, [categories, monthExpenses, monthlyCalculations, payrollDoc]);

  const dailyCashflowRows = useMemo(() => {
    const [y, m] = selectedMonth.split('-').map(Number);
    const daysInMonth = y && m ? new Date(y, m, 0).getDate() : 30;
    const rows: {
      date: string;
      onlineRev: number;
      posRev: number;
      totalRev: number;
      dayExpenses: number;
      dayNet: number;
    }[] = [];

    for (let d = 1; d <= daysInMonth; d++) {
      const dStr = `${selectedMonth}-${String(d).padStart(2, '0')}`;
      if (dStr > todayStr) continue;

      const rev = monthlyCalculations.dailyRevenueMap.get(dStr) || {
        online: 0,
        pos: 0,
        totalRevenue: 0,
        count: 0
      };
      const expSum = monthExpenses
        .filter((e) => e.date === dStr)
        .reduce((s, e) => s + e.amount, 0);

      if (rev.totalRevenue > 0 || expSum > 0) {
        rows.push({
          date: dStr,
          onlineRev: rev.online,
          posRev: rev.pos,
          totalRev: rev.totalRevenue,
          dayExpenses: expSum,
          dayNet: rev.totalRevenue - expSum
        });
      }
    }

    return rows.sort((a, b) => b.date.localeCompare(a.date));
  }, [selectedMonth, todayStr, monthlyCalculations.dailyRevenueMap, monthExpenses]);

  const handleExportProfitLossExcel = () => {
    const headers = ['Category Type', 'Section / Item Name', 'Amount (Ks)', 'Share (%)'];
    const rows: any[] = [
      ['INFLOW (ဝင်ငွေ)', 'Online Bookings Revenue', monthlyCalculations.onlineSalesTotal, ''],
      ['INFLOW (ဝင်ငွေ)', 'POS Walk-in Sales Revenue', monthlyCalculations.posSalesTotal, ''],
      ['INFLOW TOTAL', 'စုစုပေါင်း ဝင်ငွေ (Total Gross Revenue)', monthlyCalculations.totalRevenue, '100%'],
      ['---', '---', 0, ''],
      ['OUTFLOW (ထွက်ငွေ)', 'Therapists Net Payroll', monthlyCalculations.totalTherapistNetPayroll, ''],
      ['OUTFLOW (ထွက်ငွေ)', `${payrollDoc.ceoName} (CEO Salary)`, payrollDoc.ceoSalary, ''],
      ['OUTFLOW (ထွက်ငွေ)', `${payrollDoc.managerName} (Manager Salary)`, payrollDoc.managerSalary, '']
    ];

    categories.forEach((cat) => {
      const sum = monthExpenses
        .filter((e) => e.category === cat.id)
        .reduce((s, e) => s + e.amount, 0);
      rows.push(['OUTFLOW (ထွက်ငွေ)', cat.title, sum, '']);
    });

    rows.push(['OUTFLOW TOTAL', 'စုစုပေါင်း ထွက်ငွေ (Total Outflow)', grandTotalAllOutflow, '']);
    rows.push(['---', '---', 0, '']);
    rows.push([
      'NET PROFIT (အသားတင်အမြတ်)',
      'အသားတင် ကျန်ရှိသောအမြတ်ငွေ (Net Profit)',
      netProfit,
      `${profitMarginPercent.toFixed(1)}%`
    ]);

    const csvContent =
      '\uFEFF' + [headers.join(','), ...rows.map((r) => r.map((c: any) => `"${c}"`).join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `ShangriLa_Revenue_And_Net_Profit_${selectedMonth}.csv`;
    link.click();
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="bg-white p-5 sm:p-6 rounded-2xl shadow-sm border border-gray-200 space-y-5">
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 border-b border-gray-100 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-100 text-emerald-800 border border-emerald-300">
                Executive P&L Statement
              </span>
              <h2 className="text-lg sm:text-xl font-black text-[#123524] flex items-center">
                <TrendingUp className="w-5 h-5 mr-2 text-[#D4AF37]" />
                Revenue & Net Profit Dashboard (ဝင်ငွေ၊ ထွက်ငွေ နှင့် အသားတင်အမြတ် စာရင်းချုပ်)
              </h2>
            </div>
            <p className="text-xs text-gray-500 mt-1">
              တစ်လစာ မည်သည့်အပိုင်းမှ ငွေမည်မျှဝင်ပြီး မည်သည့်အပိုင်းတွင် မည်မျှကုန်ကျကာ အသားတင်အမြတ် (Net Profit) မည်မျှကျန်ရှိသည်ကို အလွယ်တကူ ကြည့်ရှုနိုင်ပါသည်
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 w-full lg:w-auto">
            <div className="flex items-center gap-2 bg-gray-50 px-3 py-1.5 rounded-xl border border-gray-300">
              <Calendar className="w-4 h-4 text-[#D4AF37]" />
              <span className="text-[11px] font-bold text-gray-500">လ ရွေးချယ်ရန်:</span>
              <input
                type="month"
                value={selectedMonth}
                onChange={(e) => e.target.value && setSelectedMonth(e.target.value)}
                className="bg-transparent text-xs font-black text-[#123524] outline-none cursor-pointer"
              />
            </div>

            <button
              type="button"
              onClick={handleExportProfitLossExcel}
              className="px-3.5 py-2 bg-[#123524] hover:bg-[#1a4a32] text-[#D4AF37] rounded-xl text-xs font-black flex items-center gap-1.5 transition shadow-sm"
            >
              <FileSpreadsheet className="w-4 h-4" /> Export P&L Excel
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="p-5 rounded-2xl bg-gradient-to-br from-emerald-50 to-green-50/40 border-2 border-emerald-200 flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-xs font-black text-emerald-900 uppercase tracking-wider">
                ၁။ စုစုပေါင်း ဝင်ငွေ (Total Revenue)
              </span>
              <span className="w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-xs">
                <ArrowUpRight className="w-5 h-5" />
              </span>
            </div>
            <div className="text-2xl sm:text-3xl font-black text-[#123524] my-2">
              +{formatPrice(monthlyCalculations.totalRevenue)}
            </div>
            <div className="pt-2.5 border-t border-emerald-200/80 grid grid-cols-2 gap-2 text-[11px] font-bold text-emerald-900">
              <div>
                Online Bookings ({monthlyCalculations.onlineBookingsCount}):
                <span className="block font-black text-[#123524]">
                  {formatPrice(monthlyCalculations.onlineSalesTotal)}
                </span>
              </div>
              <div className="text-right">
                POS Walk-in ({monthlyCalculations.posBillsCount}):
                <span className="block font-black text-[#123524]">
                  {formatPrice(monthlyCalculations.posSalesTotal)}
                </span>
              </div>
            </div>
          </div>

          <div className="p-5 rounded-2xl bg-gradient-to-br from-red-50 to-rose-50/40 border-2 border-red-200 flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-xs font-black text-red-900 uppercase tracking-wider">
                ၂။ စုစုပေါင်း ထွက်ငွေ (Expenses + Payroll)
              </span>
              <span className="w-9 h-9 rounded-xl bg-red-600 text-white flex items-center justify-center shadow-xs">
                <ArrowDownRight className="w-5 h-5" />
              </span>
            </div>
            <div className="text-2xl sm:text-3xl font-black text-red-600 my-2">
              -{formatPrice(grandTotalAllOutflow)}
            </div>
            <div className="pt-2.5 border-t border-red-200/80 grid grid-cols-2 gap-2 text-[11px] font-bold text-red-900">
              <div>
                ဆိုင်အသုံးစရိတ် ({monthExpenses.length} ကြိမ်):
                <span className="block font-black text-red-700">
                  {formatPrice(totalOperationalExpenses)}
                </span>
              </div>
              <div className="text-right">
                ဝန်ထမ်း + CEO/Mgr လစာ:
                <span className="block font-black text-red-700">
                  {formatPrice(monthlyCalculations.totalCombinedPayroll)}
                </span>
              </div>
            </div>
          </div>

          <div
            className={`p-5 rounded-2xl border-2 flex flex-col justify-between shadow-lg ${
              netProfit >= 0
                ? 'bg-gradient-to-br from-[#0B2419] via-[#123524] to-[#1a4a32] text-white border-[#D4AF37]'
                : 'bg-gradient-to-br from-red-900 to-rose-950 text-white border-red-400'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-black text-[#D4AF37] uppercase tracking-wider">
                ၃။ အသားတင်အမြတ် (NET PROFIT)
              </span>
              <span className="px-2.5 py-1 rounded-full text-[11px] font-black bg-[#D4AF37] text-[#0B2419]">
                Margin: {profitMarginPercent.toFixed(1)}%
              </span>
            </div>
            <div
              className={`text-2xl sm:text-3xl font-black my-2 ${
                netProfit >= 0 ? 'text-[#D4AF37]' : 'text-red-300'
              }`}
            >
              {netProfit >= 0 ? '+' : ''}
              {formatPrice(netProfit)}
            </div>
            <div className="pt-2.5 border-t border-white/15 flex items-center justify-between text-[11px] text-gray-200 font-semibold">
              <span>Cash လက်ခံရရှိ: {formatPrice(monthlyCalculations.totalCollectedCash)}</span>
              <span>Online Pay: {formatPrice(monthlyCalculations.totalCollectedDigital)}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-5 bg-white p-5 rounded-2xl shadow-sm border border-gray-200 space-y-5">
          <div className="border-b border-gray-100 pb-3">
            <h3 className="text-sm sm:text-base font-black text-[#123524] flex items-center">
              <ArrowUpRight className="w-4 h-4 mr-1.5 text-emerald-600" />
              ဝင်ငွေ ရရှိမှု အသေးစိတ် (Revenue Breakdown — {selectedMonth})
            </h3>
            <p className="text-[11px] text-gray-500 mt-0.5">
              Online Booking နှင့် ဆိုင် Walk-in POS အရောင်းချန်နယ်အလိုက် ဝင်ငွေစာရင်း
            </p>
          </div>

          <div className="space-y-3">
            <div className="p-3.5 rounded-xl bg-emerald-50/70 border border-emerald-200">
              <div className="flex justify-between items-center text-xs">
                <span className="font-black text-[#123524]">
                  🛍️ Shop Walk-in POS Sales ({monthlyCalculations.posBillsCount} Bills)
                </span>
                <span className="font-black text-sm text-emerald-800">
                  {formatPrice(monthlyCalculations.posSalesTotal)}
                </span>
              </div>
              <div className="w-full h-2 bg-emerald-200/70 rounded-full overflow-hidden mt-2">
                <div
                  className="h-full bg-emerald-600 rounded-full"
                  style={{
                    width: `${
                      monthlyCalculations.totalRevenue > 0
                        ? (monthlyCalculations.posSalesTotal / monthlyCalculations.totalRevenue) * 100
                        : 0
                    }%`
                  }}
                />
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-blue-50/70 border border-blue-200">
              <div className="flex justify-between items-center text-xs">
                <span className="font-black text-[#123524]">
                  📱 Online Web App Bookings ({monthlyCalculations.onlineBookingsCount} Bookings)
                </span>
                <span className="font-black text-sm text-blue-800">
                  {formatPrice(monthlyCalculations.onlineSalesTotal)}
                </span>
              </div>
              <div className="w-full h-2 bg-blue-200/70 rounded-full overflow-hidden mt-2">
                <div
                  className="h-full bg-blue-600 rounded-full"
                  style={{
                    width: `${
                      monthlyCalculations.totalRevenue > 0
                        ? (monthlyCalculations.onlineSalesTotal / monthlyCalculations.totalRevenue) * 100
                        : 0
                    }%`
                  }}
                />
              </div>
            </div>
          </div>

          <div className="pt-3 border-t border-gray-100 space-y-2.5">
            <div className="text-xs font-black text-gray-700 uppercase tracking-wider">
              ငွေပေးချေမှု စနစ်အလိုက် ဝင်ငွေ (By Payment Method)
            </div>
            {monthlyCalculations.paymentMethodsBreakdown.length === 0 ? (
              <div className="text-xs text-gray-400 font-bold py-4 text-center">ဝင်ငွေမှတ်တမ်း မရှိသေးပါ။</div>
            ) : (
              monthlyCalculations.paymentMethodsBreakdown.map((pm, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between p-2.5 rounded-xl bg-gray-50 border border-gray-200 text-xs"
                >
                  <span className="font-bold text-gray-800">
                    {pm.method} <span className="text-[10px] text-gray-400">({pm.count} Bills)</span>
                  </span>
                  <span className="font-black text-[#123524]">{formatPrice(pm.amount)}</span>
                </div>
              ))
            )}

            {monthlyCalculations.totalPendingBalanceDue > 0 && (
              <div className="p-3 rounded-xl bg-amber-50 border border-amber-300 flex justify-between items-center text-xs">
                <span className="font-bold text-amber-900">ကောက်ခံရန်ကျန်ငွေ (Pending Balance Due):</span>
                <span className="font-black text-red-600">
                  {formatPrice(monthlyCalculations.totalPendingBalanceDue)}
                </span>
              </div>
            )}
          </div>
        </div>

        <div className="lg:col-span-7 bg-white p-5 rounded-2xl shadow-sm border border-gray-200 space-y-4">
          <div className="border-b border-gray-100 pb-3 flex items-center justify-between">
            <div>
              <h3 className="text-sm sm:text-base font-black text-[#123524] flex items-center">
                <ArrowDownRight className="w-4 h-4 mr-1.5 text-red-600" />
                ထွက်ငွေ ကဏ္ဍအလိုက် စာရင်းချုပ် (Outflow Breakdown — {selectedMonth})
              </h3>
              <p className="text-[11px] text-gray-500 mt-0.5">
                ဝန်ထမ်းလစာ၊ CEO/Manager လစာ နှင့် ဆိုင်အသုံးစရိတ် အမျိုးအစားတစ်ခုချင်းစီ၏ ကုန်ကျငွေအချိုးအစား
              </p>
            </div>
            <span className="text-xs font-black text-red-600 bg-red-50 px-3 py-1 rounded-xl border border-red-200">
              Total Outflow: -{formatPrice(grandTotalAllOutflow)}
            </span>
          </div>

          <div className="space-y-2.5 max-h-[430px] overflow-y-auto pr-1">
            {outflowBreakdown.map((item, idx) => {
              const pct = grandTotalAllOutflow > 0 ? (item.amount / grandTotalAllOutflow) * 100 : 0;
              return (
                <div key={idx} className="p-3 rounded-xl bg-gray-50 border border-gray-200 space-y-1.5">
                  <div className="flex items-center justify-between text-xs gap-2">
                    <span className="font-bold text-gray-800 flex items-center gap-1.5 truncate">
                      <span>{item.icon}</span>
                      <span className="truncate">{item.label}</span>
                    </span>
                    <div className="text-right flex-shrink-0">
                      <span className="font-black text-red-600">-{formatPrice(item.amount)}</span>
                      <span className="text-[10px] font-bold text-gray-400 ml-1.5">({pct.toFixed(1)}%)</span>
                    </div>
                  </div>
                  <div className="w-full h-1.5 bg-gray-200 rounded-full overflow-hidden">
                    <div
                      className={`h-full ${item.color} rounded-full`}
                      style={{ width: `${Math.min(100, pct)}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="bg-white p-5 sm:p-6 rounded-2xl shadow-sm border border-gray-200 space-y-4">
        <div className="border-b border-gray-100 pb-3">
          <h3 className="text-base font-black text-[#123524]">
            နေ့စဉ် ဝင်ငွေ နှင့် အသုံးစရိတ် နှိုင်းယှဉ်ချက်ဇယား (Daily Cashflow Ledger — {selectedMonth})
          </h3>
          <p className="text-xs text-gray-500">
            ရက်စွဲတစ်ရက်ချင်းစီအလိုက် Online ဝင်ငွေ၊ POS ဝင်ငွေ၊ နေ့စဉ်အသုံးစရိတ် နှင့် နေ့စဉ်ကျန်ငွေ
          </p>
        </div>

        <div className="overflow-x-auto rounded-xl border border-gray-200">
          <table className="w-full text-left border-collapse min-w-[800px]">
            <thead>
              <tr className="bg-[#123524] text-[#D4AF37] text-[11px] uppercase tracking-wider">
                <th className="p-3.5">Date (ရက်စွဲ)</th>
                <th className="p-3.5 text-right">Online Sales</th>
                <th className="p-3.5 text-right">POS Walk-in Sales</th>
                <th className="p-3.5 text-right">Total Daily Revenue (ဝင်ငွေ)</th>
                <th className="p-3.5 text-right">Daily Expenses (ထွက်ငွေ)</th>
                <th className="p-3.5 text-right">Daily Net Cashflow</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-xs font-semibold">
              {dailyCashflowRows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-10 text-center text-gray-400 font-bold">
                    ဤလအတွက် နေ့စဉ် ဝင်ငွေ/ထွက်ငွေ မှတ်တမ်း မရှိသေးပါ။
                  </td>
                </tr>
              ) : (
                dailyCashflowRows.map((row) => (
                  <tr key={row.date} className="hover:bg-gray-50 transition">
                    <td className="p-3.5 font-mono font-black text-[#123524]">{row.date}</td>
                    <td className="p-3.5 text-right text-blue-700">{formatPrice(row.onlineRev)}</td>
                    <td className="p-3.5 text-right text-emerald-700">{formatPrice(row.posRev)}</td>
                    <td className="p-3.5 text-right font-black text-[#123524]">+{formatPrice(row.totalRev)}</td>
                    <td className="p-3.5 text-right font-bold text-red-600">
                      {row.dayExpenses > 0 ? `-${formatPrice(row.dayExpenses)}` : '0 Ks'}
                    </td>
                    <td
                      className={`p-3.5 text-right font-black ${
                        row.dayNet >= 0 ? 'text-emerald-700' : 'text-red-600'
                      }`}
                    >
                      {row.dayNet >= 0 ? '+' : ''}
                      {formatPrice(row.dayNet)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
