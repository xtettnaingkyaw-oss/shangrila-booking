import React, { useState, useEffect, useMemo } from 'react';
import {
  collection,
  doc,
  onSnapshot,
  addDoc,
  updateDoc,
  deleteDoc,
  setDoc,
  query,
  orderBy
} from 'firebase/firestore';
import { db } from '../firebase';
import { decryptText } from '../security';
import { Booking, TherapistProfile, formatPrice } from '../shared';
import {
  calculateBookingCommissionForStaff,
  getStaffSeniority,
  isSameStaffMember,
  extractExactStaffNumber
} from './StaffPayrollSystem';
import {
  Wallet,
  TrendingUp,
  TrendingDown,
  PieChart,
  PlusCircle,
  Trash2,
  Download,
  Calendar,
  Search,
  Banknote,
  Crown,
  UserCheck,
  Sparkles,
  CheckCircle,
  AlertCircle,
  Filter,
  Layers,
  ArrowUpRight,
  ArrowDownRight,
  Save,
  X,
  FileSpreadsheet
} from 'lucide-react';

// ============================================================================
// 🌟 1. EXPENSE CATEGORIES & SPA SUPPLY PRESETS 🌟
// ============================================================================

export type ExpenseCategoryId =
  | 'spa_supplies'
  | 'shop_rent'
  | 'electricity'
  | 'water_bill'
  | 'tax_license'
  | 'marketing'
  | 'staff_meals'
  | 'owner_meals'
  | 'debt_payment'
  | 'maintenance_other';

export interface ExpenseCategoryMeta {
  id: ExpenseCategoryId;
  title: string;
  subTitle: string;
  badgeColor: string;
  barColor: string;
  iconEmoji: string;
  quickPresets: string[];
}

export const EXPENSE_CATEGORIES: ExpenseCategoryMeta[] = [
  {
    id: 'spa_supplies',
    title: 'ဆိုင်သုံးပစ္စည်း ဝယ်ယူစရိတ် (Spa Supplies)',
    subTitle: 'အနှိပ်ဆီ၊ ရေချိုးဆပ်ပြာ၊ ခေါင်းလျှော်ရည်၊ အမှိုက်အိတ်၊ Waxing ပစ္စည်း',
    badgeColor: 'bg-emerald-50 text-emerald-800 border-emerald-200',
    barColor: 'bg-emerald-600',
    iconEmoji: '🧴',
    quickPresets: [
      'အနှိပ်ဆီ (Massage Oil)',
      'ရေချိုးဆပ်ပြာ (Body Wash / Soap)',
      'ခေါင်းလျှော်ရည် (Shampoo)',
      'အမှိုက်အိတ် (Trash Bags)',
      'Waxing ပစ္စည်းများ (Wax Beans / Strips)',
      'Body Scrub ပစ္စည်းများ',
      'Body Butter / Aroma Lotion',
      'တစ်ခါသုံးသဘက် (Sterilized Towels)',
      'တစ်ခါသုံးဘောင်းဘီ (Disposable Underwear)',
      'တစ်ရှူး၊ အရက်ပြန် နှင့် သန့်ရှင်းရေးသုံးပစ္စည်း'
    ]
  },
  {
    id: 'shop_rent',
    title: 'ဆိုင်ခန်းငှားခ (Shop Rent)',
    subTitle: 'လစဉ် သို့မဟုတ် နှစ်စဉ် ဆိုင်ခန်းငှားရမ်းခ',
    badgeColor: 'bg-indigo-50 text-indigo-800 border-indigo-200',
    barColor: 'bg-indigo-600',
    iconEmoji: '🏠',
    quickPresets: ['လစဉ် ဆိုင်ခန်းငှားခ', 'ဆိုင်ခန်း စပေါ်ငွေ / ကြိုပေးငွေ']
  },
  {
    id: 'electricity',
    title: 'မီးမီတာခ / မီးစက်ဆီ (Electricity & Fuel)',
    subTitle: 'EPC မီးမီတာခ၊ ဒီဇယ်/ဓာတ်ဆီ နှင့် အင်ဗာတာ/ဘက်ထရီ',
    badgeColor: 'bg-amber-50 text-amber-900 border-amber-300',
    barColor: 'bg-amber-500',
    iconEmoji: '⚡',
    quickPresets: ['လစဉ် EPC မီးမီတာခ', 'မီးစက် ဒီဇယ် / ဓာတ်ဆီဖိုး', 'မီးစက် အင်ဂျင်ဝိုင် / ပြုပြင်ခ']
  },
  {
    id: 'water_bill',
    title: 'ရေမီတာခ / သောက်ရေသန့် (Water Bill)',
    subTitle: 'စည်ပင်ရေမီတာခ၊ ရေသန့်ဘူး နှင့် ရေပန့်စရိတ်',
    badgeColor: 'bg-cyan-50 text-cyan-800 border-cyan-200',
    barColor: 'bg-cyan-600',
    iconEmoji: '💧',
    quickPresets: ['လစဉ် ရေမီတာခ', 'သောက်ရေသန့်ဘူးဖိုး (Drinking Water)', 'ရေစစ် / ရေပိုက်ပြုပြင်ခ']
  },
  {
    id: 'tax_license',
    title: 'အခွန်အခနှင့် လိုင်စင်ကြေး (Tax & Fees)',
    subTitle: 'စည်ပင်ခွန်၊ ဝင်ငွေခွန်၊ ဆိုင်းဘုတ်ခွန် နှင့် လိုင်စင်ကြေးများ',
    badgeColor: 'bg-purple-50 text-purple-800 border-purple-200',
    barColor: 'bg-purple-600',
    iconEmoji: '🏛️',
    quickPresets: ['လစဉ် အခွန်အခ', 'စည်ပင် လိုင်စင်ကြေး / သန့်ရှင်းရေးခွန်', 'ဆိုင်းဘုတ်ခွန်']
  },
  {
    id: 'marketing',
    title: 'Marketing စရိတ် (Ads & Promotions)',
    subTitle: 'Facebook/TikTok Boost, ဒီဇိုင်း, ဗီနိုင်း, ပရိုမိုးရှင်း လက်ဆောင်',
    badgeColor: 'bg-pink-50 text-pink-800 border-pink-200',
    barColor: 'bg-pink-600',
    iconEmoji: '📢',
    quickPresets: [
      'TikTok / Facebook Boost Ads',
      'ဘောင်ချာစာအုပ် / လိပ်စာကတ် / Vinyl Print',
      'Customer Giveaway / လက်ဆောင်ပစ္စည်း',
      'Content / Video ရိုက်ကူးရေးစရိတ်'
    ]
  },
  {
    id: 'staff_meals',
    title: 'ဝန်ထမ်း စားစရိတ် / သက်သာချောင်ချိရေး (Staff Meals)',
    subTitle: 'ဝန်ထမ်း ထမင်းဖိုး၊ မုန့်ဖိုး၊ ဆေးဝါး နှင့် ဝန်ထမ်းကြိုပို့စရိတ်',
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
    title: 'နေ့စဉ် မိမိစားစရိတ် / ဧည့်ခံစရိတ် (Owner & Hospitality)',
    subTitle: 'နေ့စဉ် မိမိစားစရိတ်၊ ဧည့်သည် ကော်ဖီ/မုန့် ဧည့်ခံစရိတ်',
    badgeColor: 'bg-teal-50 text-teal-800 border-teal-200',
    barColor: 'bg-teal-600',
    iconEmoji: '☕',
    quickPresets: [
      'နေ့စဉ် မိမိစားစရိတ် (Owner Daily Meal)',
      'ဧည့်သည် ဧည့်ခံ ကော်ဖီ / အအေး / မုန့်ဖိုး',
      'သွားလာရေး / ဆီဖိုး'
    ]
  },
  {
    id: 'debt_payment',
    title: 'အကြွေးပေးငွေ / ပေးရန်ကျန်ငွေချေခြင်း (Debt Payment)',
    subTitle: 'ပစ္စည်းဖိုးအကြွေးဆပ်ခြင်း သို့မဟုတ် ချေးငွေပြန်ဆပ်ခြင်း',
    badgeColor: 'bg-rose-50 text-rose-800 border-rose-200',
    barColor: 'bg-rose-600',
    iconEmoji: '💳',
    quickPresets: ['ဆိုင်သုံးပစ္စည်း အကြွေးဆပ်ငွေ', 'လုပ်ငန်း အကြွေးပေးချေငွေ']
  },
  {
    id: 'maintenance_other',
    title: 'ပြုပြင်ထိန်းသိမ်းစရိတ်နှင့် အထွေထွေ (Maintenance & Misc)',
    subTitle: 'Aircon ပြင်ခ၊ အင်တာနက် WiFi ဘေလ်၊ ပရိဘောဂ နှင့် အထွေထွေ',
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

// ============================================================================
// 🌟 SHARED HOOK: CALCULATE MONTHLY PAYROLL, REVENUE & EXPENSES 🌟
// ============================================================================

export function useMonthlyFinancialEngine(
  selectedMonth: string,
  bookings: Booking[],
  therapists: TherapistProfile[]
) {
  const [expenses, setExpenses] = useState<ExpenseRecord[]>([]);
  const [penalties, setPenalties] = useState<any[]>([]);
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
    managerName: 'Manager'
  });

  // 1. Real-time Expenses Listener
  useEffect(() => {
    const q = query(collection(db, 'expenses'), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(q, (snap) => {
      const arr: ExpenseRecord[] = [];
      snap.forEach((d) => {
        const raw = d.data();
        const dateStr = String(raw.date || getLocalTodayStr());
        arr.push({
          id: d.id,
          date: dateStr,
          yearMonth: dateStr.substring(0, 7),
          category: (raw.category as ExpenseCategoryId) || 'maintenance_other',
          title: String(raw.title || ''),
          amount: Number(raw.amount) || 0,
          paymentMethod: String(raw.paymentMethod || 'Cash'),
          note: String(raw.note || ''),
          createdAt: Number(raw.createdAt) || Date.now()
        });
      });
      setExpenses(arr);
    });
    return () => unsub();
  }, []);

  // 2. Real-time Penalties Listener
  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'penalties'), (snap) => {
      const list: any[] = [];
      snap.forEach((d) => list.push({ id: d.id, ...d.data() }));
      setPenalties(list);
    });
    return () => unsub();
  }, []);

  // 3. Real-time Payroll & Executive Salaries Listener for Selected Month
  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'settings', `payroll_${selectedMonth}`), (snap) => {
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
    });
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

  // 4. Calculate Staff Payroll Summary & Revenue for `selectedMonth`
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

    // Daily Revenue Map
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

      // Skip Admin/Staff non-sale clock-ins
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

      // Daily Revenue aggregation
      if (!dailyRevenueMap.has(bDate)) {
        dailyRevenueMap.set(bDate, { online: 0, pos: 0, totalRevenue: 0, count: 0 });
      }
      const dEntry = dailyRevenueMap.get(bDate)!;
      if (isOnline) dEntry.online += totalAmt;
      else dEntry.pos += totalAmt;
      dEntry.totalRevenue += totalAmt;
      dEntry.count += 1;

      // Therapist Commission Calculation
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

    // Compute Each Therapist's Net Payable Salary (Matching Staff Pay Roll Tab)
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

  // 5. Filter Recorded Expenses for Selected Month
  const monthExpenses = useMemo(() => {
    return expenses.filter((e) => e.yearMonth === selectedMonth);
  }, [expenses, selectedMonth]);

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
    expenses,
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
// 🌟 2. ADMIN EXPENSE MANAGER COMPONENT (TAB 1) 🌟
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
  const currentYearMonth = todayStr.substring(0, 7);

  const [selectedMonth, setSelectedMonth] = useState<string>(currentYearMonth);
  const [activeCategoryFilter, setActiveCategoryFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Add Expense Form States
  const [expDate, setExpDate] = useState<string>(todayStr);
  const [expCategory, setExpCategory] = useState<ExpenseCategoryId>('spa_supplies');
  const [expTitle, setExpTitle] = useState<string>('');
  const [expAmount, setExpAmount] = useState<string>('');
  const [expPaymentMethod, setExpPaymentMethod] = useState<string>('Cash');
  const [expNote, setExpNote] = useState<string>('');
  const [isSavingExpense, setIsSavingExpense] = useState<boolean>(false);

  // Executive Salaries (CEO & Manager) Modal/Input States
  const [ceoSalaryInput, setCeoSalaryInput] = useState<string>('0');
  const [managerSalaryInput, setManagerSalaryInput] = useState<string>('0');
  const [ceoNameInput, setCeoNameInput] = useState<string>('CEO');
  const [managerNameInput, setManagerNameInput] = useState<string>('Spa Manager');
  const [isSavingExecSalary, setIsSavingExecSalary] = useState<boolean>(false);
  const [showPayrollBreakdownModal, setShowPayrollBreakdownModal] = useState<boolean>(false);

  const {
    monthExpenses,
    totalOperationalExpenses,
    payrollDoc,
    monthlyCalculations,
    grandTotalAllOutflow
  } = useMonthlyFinancialEngine(selectedMonth, bookings, therapists);

  // Sync CEO & Manager Salary inputs when month changes
  useEffect(() => {
    setCeoSalaryInput(String(payrollDoc.ceoSalary || 0));
    setManagerSalaryInput(String(payrollDoc.managerSalary || 0));
    setCeoNameInput(payrollDoc.ceoName || 'CEO');
    setManagerNameInput(payrollDoc.managerName || 'Spa Manager');
  }, [payrollDoc.ceoSalary, payrollDoc.managerSalary, payrollDoc.ceoName, payrollDoc.managerName]);

  const selectedCategoryMeta = useMemo(() => {
    return EXPENSE_CATEGORIES.find((c) => c.id === expCategory) || EXPENSE_CATEGORIES[0];
  }, [expCategory]);

  // Save CEO & Manager Monthly Salaries into `settings/payroll_${selectedMonth}`
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
      alert(`✅ ${selectedMonth} အတွက် CEO လစာနှင့် Manager လစာ သတ်မှတ်သိမ်းဆည်းပြီးပါပြီ။`);
    } catch (err) {
      alert('လစာ သိမ်းဆည်းရာတွင် အမှားအယွင်းရှိနေပါသည်။');
    } finally {
      setIsSavingExecSalary(false);
    }
  };

  // Add New Daily / Monthly Expense
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
      await addDoc(collection(db, 'expenses'), {
        date: targetDate,
        yearMonth: targetDate.substring(0, 7),
        category: expCategory,
        title: expTitle.trim(),
        amount: amt,
        paymentMethod: expPaymentMethod,
        note: expNote.trim(),
        createdAt: Date.now()
      });

      // If user added an expense for a different month, switch view to that month automatically
      if (targetDate.substring(0, 7) !== selectedMonth) {
        setSelectedMonth(targetDate.substring(0, 7));
      }

      setExpTitle('');
      setExpAmount('');
      setExpNote('');
    } catch (err) {
      alert('အသုံးစရိတ် သိမ်းဆည်းရာတွင် အမှားအယွင်းရှိနေပါသည်။');
    } finally {
      setIsSavingExpense(false);
    }
  };

  const handleDeleteExpense = async (id: string, title: string, amt: number) => {
    if (adminRole !== 'super_admin') {
      alert('Super Admin သာလျှင် ဖျက်ခွင့်ရှိပါသည်။');
      return;
    }
    if (!window.confirm(`"${title}" (${formatPrice(amt)}) အသုံးစရိတ်မှတ်တမ်းကို ဖျက်မည်မှာ သေချာပါသလား?`)) {
      return;
    }
    await deleteDoc(doc(db, 'expenses', id));
  };

  // Category Breakdown Summary (10 Expense Categories + 1 Auto-Synced Payroll Category)
  const categoryBreakdownList = useMemo(() => {
    const map = new Map<ExpenseCategoryId, { total: number; count: number }>();
    EXPENSE_CATEGORIES.forEach((c) => map.set(c.id, { total: 0, count: 0 }));

    monthExpenses.forEach((e) => {
      const entry = map.get(e.category) || { total: 0, count: 0 };
      entry.total += e.amount;
      entry.count += 1;
      map.set(e.category, entry);
    });

    const operationalRows = EXPENSE_CATEGORIES.map((meta) => {
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
  }, [monthExpenses, grandTotalAllOutflow]);

  // Filtered Expenses for Table & Daily Grouping
  const filteredExpenses = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return monthExpenses.filter((e) => {
      if (activeCategoryFilter !== 'all' && e.category !== activeCategoryFilter) return false;
      if (q) {
        const catMeta = EXPENSE_CATEGORIES.find((c) => c.id === e.category);
        const match =
          e.title.toLowerCase().includes(q) ||
          e.note.toLowerCase().includes(q) ||
          e.paymentMethod.toLowerCase().includes(q) ||
          (catMeta?.title || '').toLowerCase().includes(q);
        if (!match) return false;
      }
      return true;
    });
  }, [monthExpenses, activeCategoryFilter, searchQuery]);

  // Export Monthly Expenses + Payroll to Excel (CSV)
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
      const catMeta = EXPENSE_CATEGORIES.find((c) => c.id === e.category);
      return [
        `"${e.date}"`,
        `"${catMeta?.title || e.category}"`,
        `"${e.title}"`,
        `"${e.paymentMethod}"`,
        e.amount,
        `"${e.note || '-'}"`
      ];
    });

    // Append Auto-Synced Payroll & Executive Salaries Rows
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
    <div className="space-y-6 animate-fade-in">
      {/* =========================================================================
          MODAL: STAFF PAYROLL & EXECUTIVE SALARY BREAKDOWN
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
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-red-100 text-red-800 border border-red-200">
                Shop Expense & Payroll Tracker
              </span>
              <h2 className="text-lg sm:text-xl font-black text-[#123524] flex items-center">
                <Wallet className="w-5 h-5 mr-2 text-[#D4AF37]" />
                Expense Manager (နေ့စဉ်နှင့် လစဉ် အသုံးစရိတ် စီမံခန့်ခွဲမှု)
              </h2>
            </div>
            <p className="text-xs text-gray-500 mt-1">
              ဆိုင်အသုံးစရိတ် (၁၀) မျိုး၊ ဝန်ထမ်းလစာ (Staff Payroll)၊ CEO လစာ နှင့် Manager လစာများကို Category အလိုက် စနစ်တကျ မှတ်သားစစ်ဆေးနိုင်ပါသည်
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
              onClick={handleExportExpensesExcel}
              className="px-3.5 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 rounded-xl text-xs font-black flex items-center gap-1.5 transition shadow-2xs"
            >
              <Download className="w-4 h-4" /> Export Expenses Excel
            </button>
          </div>
        </div>

        {/* 4 Top Summary KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
          <div className="p-4 rounded-2xl bg-red-50/60 border border-red-200">
            <div className="text-[10px] font-extrabold text-red-800 uppercase tracking-wider">
              ၁။ ဆိုင်အသုံးစရိတ် စုစုပေါင်း (Operational Expenses)
            </div>
            <div className="text-xl font-black text-red-600 mt-1">
              {formatPrice(totalOperationalExpenses)}
            </div>
            <div className="text-[10px] font-bold text-gray-500 mt-1">
              မှတ်တမ်းအရေအတွက်: {monthExpenses.length} ကြိမ်
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-amber-50/70 border border-amber-200">
            <div className="text-[10px] font-extrabold text-amber-900 uppercase tracking-wider flex items-center justify-between">
              <span>၂။ ဝန်ထမ်းလစာ စုစုပေါင်း (Staff Net Payroll)</span>
              <span className="bg-amber-200/80 text-amber-900 px-1.5 py-0.5 rounded text-[9px] font-black">
                Auto-Sync
              </span>
            </div>
            <div className="text-xl font-black text-[#123524] mt-1">
              {formatPrice(monthlyCalculations.totalTherapistNetPayroll)}
            </div>
            <div className="text-[10px] font-bold text-amber-800 mt-1">
              Therapists: {monthlyCalculations.therapistPayrollList.length} ဦး ({monthlyCalculations.totalBookingsCount}{' '}
              Sec)
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-blue-50/70 border border-blue-200">
            <div className="text-[10px] font-extrabold text-blue-900 uppercase tracking-wider">
              ၃။ CEO + Manager လစာ (Executive Salaries)
            </div>
            <div className="text-xl font-black text-blue-900 mt-1">
              {formatPrice(payrollDoc.ceoSalary + payrollDoc.managerSalary)}
            </div>
            <div className="text-[10px] font-bold text-blue-700 mt-1">
              CEO: {formatPrice(payrollDoc.ceoSalary)} | Mgr: {formatPrice(payrollDoc.managerSalary)}
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-gradient-to-br from-[#0B2419] via-[#123524] to-[#1a4a32] text-white border border-[#D4AF37]/50 shadow-sm">
            <div className="text-[10px] font-extrabold text-[#D4AF37] uppercase tracking-wider">
              ၄။ တစ်လစာ စုစုပေါင်း ထွက်ငွေချုပ် (Total Outflow)
            </div>
            <div className="text-xl font-black text-white mt-1">
              {formatPrice(grandTotalAllOutflow)}
            </div>
            <div className="text-[10px] font-semibold text-emerald-200 mt-1">
              အသုံးစရိတ် + ဝန်ထမ်းလစာ + CEO/Manager လစာ
            </div>
          </div>
        </div>
      </div>

      {/* =========================================================================
          2. PAYROLL & EXECUTIVE SALARY CATEGORY CARD (CEO, MANAGER & STAFF PAYROLL)
         ========================================================================= */}
      <div className="bg-gradient-to-r from-[#0B2419] via-[#123524] to-[#1a4a32] text-white p-5 sm:p-6 rounded-2xl shadow-md border border-[#D4AF37]/50 space-y-4">
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-3 border-b border-white/10 pb-3.5">
          <div>
            <span className="inline-flex items-center gap-1.5 bg-[#D4AF37] text-[#0B2419] text-[10px] font-black uppercase tracking-widest px-2.5 py-0.5 rounded-full">
              💼 Auto-Synced Payroll Expense Category
            </span>
            <h3 className="text-base sm:text-lg font-black text-white mt-1.5">
              ဝန်ထမ်းလစာ (Staff Pay Roll) နှင့် CEO / Manager လစာ သတ်မှတ်ချက် ({selectedMonth})
            </h3>
            <p className="text-xs text-gray-300 mt-0.5">
              Staff Pay Roll Tab မှ ဝန်ထမ်းအားလုံး၏ အသားတင်ပေးချေရမည့်လစာကို အလိုအလျောက် ဆွဲယူထားပြီး CEO နှင့် Manager လစာကိုပါ ဤနေရာတွင် သတ်မှတ်နိုင်ပါသည်
            </p>
          </div>

          <div className="flex items-center gap-2.5 self-end lg:self-center">
            <div className="bg-black/30 border border-[#D4AF37]/40 px-4 py-2 rounded-xl text-right">
              <div className="text-[10px] font-bold text-gray-300 uppercase">စုစုပေါင်း လစာစရိတ် (Total Payroll)</div>
              <div className="text-base sm:text-lg font-black text-[#D4AF37]">
                {formatPrice(monthlyCalculations.totalCombinedPayroll)}
              </div>
            </div>
            <button
              type="button"
              onClick={() => setShowPayrollBreakdownModal(true)}
              className="px-3.5 py-2.5 bg-white/10 hover:bg-white/20 text-[#D4AF37] border border-[#D4AF37]/40 rounded-xl text-xs font-black transition whitespace-nowrap"
            >
              စာရင်းအသေးစိတ် ကြည့်ရန်
            </button>
          </div>
        </div>

        <form onSubmit={handleSaveExecutiveSalaries} className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
          <div className="md:col-span-3 bg-white/5 p-3 rounded-xl border border-white/10">
            <div className="text-[10px] font-bold text-emerald-300 uppercase">
              ၁။ Therapists Net Payroll ({monthlyCalculations.therapistPayrollList.length} ဦး)
            </div>
            <div className="text-base font-black text-white mt-1">
              {formatPrice(monthlyCalculations.totalTherapistNetPayroll)}
            </div>
            <div className="text-[10px] text-gray-300 mt-0.5">
              ရှင်းပြီး: {monthlyCalculations.settledTherapistsCount} ဦး / စုစုပေါင်း{' '}
              {monthlyCalculations.therapistPayrollList.length} ဦး
            </div>
          </div>

          <div className="md:col-span-3">
            <label className="block text-[10px] font-extrabold text-[#D4AF37] uppercase mb-1">
              ၂။ CEO လစာ သတ်မှတ်ရန် (CEO Salary - Ks)
            </label>
            <div className="flex gap-1.5">
              <input
                type="text"
                value={ceoNameInput}
                onChange={(e) => setCeoNameInput(e.target.value)}
                placeholder="CEO"
                className="w-24 p-2.5 bg-black/30 border border-white/20 rounded-xl text-xs font-bold text-white outline-none focus:border-[#D4AF37]"
              />
              <input
                type="number"
                min={0}
                step={10000}
                value={ceoSalaryInput}
                onChange={(e) => setCeoSalaryInput(e.target.value)}
                placeholder="0"
                className="flex-1 min-w-0 p-2.5 bg-white text-[#123524] rounded-xl text-xs font-black outline-none"
              />
            </div>
          </div>

          <div className="md:col-span-4">
            <label className="block text-[10px] font-extrabold text-[#D4AF37] uppercase mb-1">
              ၃။ Manager လစာ သတ်မှတ်ရန် (Manager Salary - Ks)
            </label>
            <div className="flex gap-1.5">
              <input
                type="text"
                value={managerNameInput}
                onChange={(e) => setManagerNameInput(e.target.value)}
                placeholder="Manager"
                className="w-28 p-2.5 bg-black/30 border border-white/20 rounded-xl text-xs font-bold text-white outline-none focus:border-[#D4AF37]"
              />
              <input
                type="number"
                min={0}
                step={10000}
                value={managerSalaryInput}
                onChange={(e) => setManagerSalaryInput(e.target.value)}
                placeholder="0"
                className="flex-1 min-w-0 p-2.5 bg-white text-[#123524] rounded-xl text-xs font-black outline-none"
              />
            </div>
          </div>

          <div className="md:col-span-2">
            <button
              type="submit"
              disabled={isSavingExecSalary}
              className="w-full py-2.5 px-4 bg-[#D4AF37] hover:bg-yellow-400 text-[#0B2419] rounded-xl text-xs font-black uppercase shadow-md transition flex items-center justify-center gap-1.5"
            >
              <Save className="w-4 h-4" />
              <span>{isSavingExecSalary ? 'Saving...' : 'Save Salaries'}</span>
            </button>
          </div>
        </form>
      </div>

      {/* =========================================================================
          3. ADD NEW EXPENSE FORM + CATEGORY BREAKDOWN PROGRESS CARDS
         ========================================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left 5 Cols: Add Expense Form with Smart Quick Chips */}
        <div className="lg:col-span-5 bg-white p-5 rounded-2xl shadow-sm border border-gray-200 space-y-4">
          <div className="border-b border-gray-100 pb-3">
            <h3 className="text-sm sm:text-base font-black text-[#123524] flex items-center">
              <PlusCircle className="w-4 h-4 mr-2 text-[#D4AF37]" />
              အသုံးစရိတ်အသစ် ထည့်သွင်းရန် (Add Daily / Monthly Expense)
            </h3>
            <p className="text-[11px] text-gray-500 mt-0.5">
              Category ရွေးချယ်ပြီး အသင့်ပါသော ပစ္စည်းအမည်များကို တစ်ချက်နှိပ်၍ မြန်ဆန်စွာ ထည့်သွင်းနိုင်ပါသည်
            </p>
          </div>

          <form onSubmit={handleAddExpense} className="space-y-3.5">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] font-extrabold text-gray-500 uppercase mb-1">
                  နေ့ရက် (Date) *
                </label>
                <input
                  type="date"
                  required
                  value={expDate}
                  onChange={(e) => setExpDate(e.target.value)}
                  className="w-full p-2.5 bg-gray-50 border border-gray-300 rounded-xl text-xs font-black text-[#123524] outline-none focus:border-[#D4AF37]"
                />
              </div>
              <div>
                <label className="block text-[10px] font-extrabold text-gray-500 uppercase mb-1">
                  ငွေပေးချေမှုစနစ် (Payment)
                </label>
                <select
                  value={expPaymentMethod}
                  onChange={(e) => setExpPaymentMethod(e.target.value)}
                  className="w-full p-2.5 bg-gray-50 border border-gray-300 rounded-xl text-xs font-black text-[#123524] outline-none focus:border-[#D4AF37]"
                >
                  <option value="Cash">Cash (ငွေသား)</option>
                  <option value="KBZ PAY">KBZ PAY</option>
                  <option value="Wave PAY">Wave PAY</option>
                  <option value="AYA PAY">AYA PAY</option>
                  <option value="Bank Transfer">Bank Transfer</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-extrabold text-gray-500 uppercase mb-1">
                အသုံးစရိတ် အမျိုးအစား (Select Category) *
              </label>
              <select
                value={expCategory}
                onChange={(e) => setExpCategory(e.target.value as ExpenseCategoryId)}
                className="w-full p-2.5 bg-yellow-50/70 border border-[#D4AF37]/60 rounded-xl text-xs font-black text-[#123524] outline-none focus:border-[#123524]"
              >
                {EXPENSE_CATEGORIES.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.iconEmoji} {c.title}
                  </option>
                ))}
              </select>
            </div>

            {/* Quick-Pick Preset Chips for Selected Category */}
            <div className="bg-gray-50 p-3 rounded-xl border border-gray-200 space-y-1.5">
              <div className="text-[10px] font-extrabold text-gray-500 uppercase">
                အမြန်ရွေးချယ်ရန် ({selectedCategoryMeta.iconEmoji} Quick Items):
              </div>
              <div className="flex flex-wrap gap-1.5">
                {selectedCategoryMeta.quickPresets.map((preset, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setExpTitle(preset)}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition ${
                      expTitle === preset
                        ? 'bg-[#123524] text-[#D4AF37] border-[#123524] shadow-2xs'
                        : 'bg-white text-gray-700 border-gray-200 hover:border-[#D4AF37]'
                    }`}
                  >
                    + {preset}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
              <div className="sm:col-span-7">
                <label className="block text-[10px] font-extrabold text-gray-500 uppercase mb-1">
                  အသုံးစရိတ် အကြောင်းအရာ (Item Name) *
                </label>
                <input
                  type="text"
                  required
                  value={expTitle}
                  onChange={(e) => setExpTitle(e.target.value)}
                  placeholder="ဥပမာ - အနှိပ်ဆီ ၅ ဘူး / လစဉ် မီးမီတာခ..."
                  className="w-full p-2.5 bg-gray-50 border border-gray-300 rounded-xl text-xs font-bold text-gray-800 outline-none focus:border-[#123524]"
                />
              </div>

              <div className="sm:col-span-5">
                <label className="block text-[10px] font-extrabold text-gray-500 uppercase mb-1">
                  ကုန်ကျငွေ ပမာဏ (Amount - Ks) *
                </label>
                <input
                  type="number"
                  required
                  min={1}
                  value={expAmount}
                  onChange={(e) => setExpAmount(e.target.value)}
                  placeholder="ဥပမာ - 25000"
                  className="w-full p-2.5 bg-gray-50 border border-gray-300 rounded-xl text-xs font-black text-red-600 outline-none focus:border-red-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-extrabold text-gray-500 uppercase mb-1">
                မှတ်ချက် / အသေးစိတ် (Optional Note)
              </label>
              <input
                type="text"
                value={expNote}
                onChange={(e) => setExpNote(e.target.value)}
                placeholder="ဥပမာ - ဘောင်ချာနံပါတ် / ဆိုင်အမည် / အရေအတွက်..."
                className="w-full p-2.5 bg-gray-50 border border-gray-300 rounded-xl text-xs font-semibold text-gray-700 outline-none focus:border-[#123524]"
              />
            </div>

            <button
              type="submit"
              disabled={isSavingExpense}
              className="w-full py-3 bg-gradient-to-r from-[#123524] to-[#1a4a32] text-[#D4AF37] rounded-xl font-black text-xs uppercase tracking-wider shadow-md hover:opacity-95 transition flex items-center justify-center gap-2 disabled:opacity-50"
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
                မည်သည့်အပိုင်းတွင် မည်မျှကုန်ကျနေသည်ကို တစ်ချက်ကြည့်ရုံဖြင့် သိရှိနိုင်ပြီး Category တစ်ခုချင်းစီကို နှိပ်၍ စစ်ကြည့်နိုင်ပါသည်
              </p>
            </div>
            {activeCategoryFilter !== 'all' && (
              <button
                type="button"
                onClick={() => setActiveCategoryFilter('all')}
                className="px-3 py-1 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-xs font-black"
              >
                အားလုံး ပြန်ကြည့်မည် (Show All)
              </button>
            )}
          </div>

          <div className="space-y-2.5 max-h-[540px] overflow-y-auto pr-1">
            {/* 1. Payroll & Executive Salaries Bar (Auto-Synced) */}
            <div
              onClick={() => setShowPayrollBreakdownModal(true)}
              className="p-3.5 rounded-xl bg-amber-50/70 border border-amber-300 cursor-pointer hover:shadow-xs transition"
            >
              <div className="flex items-center justify-between gap-2 text-xs">
                <div className="font-black text-[#123524] flex items-center gap-1.5">
                  <span>💼</span>
                  <span>ဝန်ထမ်းလစာ + CEO + Manager လစာ (Payroll Auto-Synced)</span>
                </div>
                <div className="text-right">
                  <span className="font-black text-sm text-[#123524]">
                    {formatPrice(monthlyCalculations.totalCombinedPayroll)}
                  </span>
                  <span className="text-[10px] font-bold text-amber-800 ml-2">
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

            {/* 2. Operational Expense Categories */}
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
                      <div className="font-bold text-gray-800 flex items-center gap-1.5 truncate">
                        <span>{cat.iconEmoji}</span>
                        <span className="truncate">{cat.title}</span>
                        <span className="text-[10px] font-black bg-white px-2 py-0.5 rounded border border-gray-200 text-gray-600">
                          {cat.count} ကြိမ်
                        </span>
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
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
          4. DETAILED EXPENSE RECORDS TABLE (FILTERABLE & SEARCHABLE)
         ========================================================================= */}
      <div className="bg-white p-5 sm:p-6 rounded-2xl shadow-sm border border-gray-200 space-y-4">
        <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-3 border-b border-gray-100 pb-4">
          <div>
            <h3 className="text-base font-black text-[#123524]">
              နေ့စဉ် အသုံးစရိတ် မှတ်တမ်းစာရင်း ({selectedMonth})
            </h3>
            <p className="text-xs text-gray-500">
              စုစုပေါင်း ပြသထားသော အသုံးစရိတ်:{' '}
              <strong className="text-red-600">
                {formatPrice(filteredExpenses.reduce((s, e) => s + e.amount, 0))}
              </strong>{' '}
              ({filteredExpenses.length} ကြိမ်)
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <select
              value={activeCategoryFilter}
              onChange={(e) => setActiveCategoryFilter(e.target.value)}
              className="p-2 bg-gray-50 border border-gray-300 rounded-xl text-xs font-bold text-[#123524] outline-none"
            >
              <option value="all">Category အားလုံး ({monthExpenses.length})</option>
              {EXPENSE_CATEGORIES.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.iconEmoji} {c.title}
                </option>
              ))}
            </select>

            <div className="relative w-full sm:w-64">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="ပစ္စည်းအမည် / မှတ်ချက် ရှာရန်..."
                className="w-full pl-8 pr-7 py-2 bg-gray-50 border border-gray-300 rounded-xl text-xs font-bold outline-none focus:border-[#D4AF37]"
              />
              <Search className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-2.5" />
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

        <div className="overflow-x-auto rounded-xl border border-gray-200">
          <table className="w-full text-left border-collapse min-w-[850px]">
            <thead>
              <tr className="bg-[#123524] text-[#D4AF37] text-[11px] uppercase tracking-wider">
                <th className="p-3.5">နေ့ရက် (Date)</th>
                <th className="p-3.5">အမျိုးအစား (Category)</th>
                <th className="p-3.5">အသုံးစရိတ် အကြောင်းအရာ (Description)</th>
                <th className="p-3.5">Payment Method</th>
                <th className="p-3.5 text-right">ကုန်ကျငွေ (Amount)</th>
                <th className="p-3.5 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-xs">
              {filteredExpenses.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-10 text-center text-gray-400 font-bold">
                    ရွေးချယ်ထားသောလ ({selectedMonth}) အတွက် အသုံးစရိတ်မှတ်တမ်း မရှိသေးပါ။
                  </td>
                </tr>
              ) : (
                filteredExpenses.map((exp) => {
                  const catMeta = EXPENSE_CATEGORIES.find((c) => c.id === exp.category);
                  return (
                    <tr key={exp.id} className="hover:bg-gray-50/80 transition">
                      <td className="p-3.5 font-mono font-bold text-gray-700 whitespace-nowrap">{exp.date}</td>
                      <td className="p-3.5">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-black border ${
                            catMeta?.badgeColor || 'bg-gray-100 text-gray-700 border-gray-200'
                          }`}
                        >
                          <span>{catMeta?.iconEmoji}</span>
                          <span>{catMeta?.title.split('(')[0].trim() || exp.category}</span>
                        </span>
                      </td>
                      <td className="p-3.5">
                        <div className="font-bold text-gray-800 text-sm">{exp.title}</div>
                        {exp.note && <div className="text-[11px] text-gray-500 mt-0.5">မှတ်ချက်: {exp.note}</div>}
                      </td>
                      <td className="p-3.5">
                        <span className="bg-gray-100 text-gray-700 px-2.5 py-1 rounded-md font-bold text-[11px]">
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
                          onClick={() => handleDeleteExpense(exp.id, exp.title, exp.amount)}
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
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// 🌟 3. ADMIN REVENUE & NET PROFIT DASHBOARD COMPONENT (TAB 2) 🌟
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
    monthExpenses,
    totalOperationalExpenses,
    payrollDoc,
    monthlyCalculations,
    grandTotalAllOutflow,
    netProfit,
    profitMarginPercent
  } = useMonthlyFinancialEngine(selectedMonth, bookings, therapists);

  // Category Breakdown for Outflow Panel
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

    EXPENSE_CATEGORIES.forEach((cat) => {
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
  }, [monthExpenses, monthlyCalculations, payrollDoc]);

  // Daily Cashflow Ledger (Every active day in the month)
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

    EXPENSE_CATEGORIES.forEach((cat) => {
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
      {/* =========================================================================
          1. TOP EXECUTIVE P&L HEADER & MONTH PICKER
         ========================================================================= */}
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

        {/* 3 Hero Financial Equation Cards: TOTAL INFLOW - TOTAL OUTFLOW = NET PROFIT */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Card 1: Total Revenue (Inflow) */}
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

          {/* Card 2: Total Outflow (Operational Expenses + Payroll + CEO/Manager) */}
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

          {/* Card 3: NET PROFIT (အသားတင်အမြတ်) */}
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

      {/* =========================================================================
          2. SIDE-BY-SIDE INFLOW (REVENUE SOURCES) VS OUTFLOW (EXPENSE CATEGORIES)
         ========================================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left 5 Cols: Revenue Sources & Payment Methods Breakdown */}
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

          {/* Channel Split */}
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

          {/* Payment Method Split */}
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

        {/* Right 7 Cols: Outflow (Expenses + Payroll) Breakdown */}
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

      {/* =========================================================================
          3. DAILY CASHFLOW LEDGER (DAY-BY-DAY INFLOW VS EXPENSE)
         ========================================================================= */}
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
