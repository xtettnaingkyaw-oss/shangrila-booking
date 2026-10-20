import React, { useState, useEffect, useMemo } from 'react';
import { collection, doc, onSnapshot, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { decryptText } from '../security';
import { Booking, TherapistProfile, formatPrice } from '../shared';
import {
  Banknote, Download, User, Award, Trash2, Search, FileSpreadsheet,
  Sliders, Wifi, RotateCcw, Edit3, Check
} from 'lucide-react';

// ============================================================================
// 🌟 1. EXACT COMMISSION RATE TABLE (FROM Staff Commession Rate.xlsx) 🌟
// ============================================================================

export type StaffSeniority = 'Senior' | 'Junior';

// Default Senior Staff Numbers from Excel: SGL-001 (No-1), SGL-012 (No-12), SGL-014 (No-14)
export const DEFAULT_SENIOR_NUMBERS = [1, 12, 14];

export const extractExactStaffNumber = (str: string): number | null => {
  const clean = String(str || '').trim().toLowerCase();
  if (!clean || clean.startsWith('therapist_')) return null;
  const noMatch = clean.match(/no[-\s]*0*(\d+)\b/i);
  if (noMatch) return parseInt(noMatch[1], 10);
  const sglMatch = clean.match(/sgl[-\s]*0*(\d+)\b/i);
  if (sglMatch) return parseInt(sglMatch[1], 10);
  const therapistMatch = clean.match(/therapist[-\s]*0*(\d+)\b/i);
  if (therapistMatch) return parseInt(therapistMatch[1], 10);
  const plainMatch = clean.match(/\b0*(\d+)\b/);
  if (plainMatch) return parseInt(plainMatch[1], 10);
  return null;
};

export const isSameStaffMember = (nameA: string, nameB: string, idB?: string): boolean => {
  const cleanA = String(nameA || '').trim().toLowerCase();
  const cleanB = String(nameB || '').trim().toLowerCase();
  const cleanIdB = String(idB || '').trim().toLowerCase();

  if (!cleanA || !cleanB) return false;
  if (cleanA === cleanB || (cleanIdB && cleanA === cleanIdB)) return true;

  const numA = extractExactStaffNumber(cleanA);
  const numB = extractExactStaffNumber(cleanB);

  if (numA !== null && numB !== null) {
    return numA === numB;
  }
  return false;
};

export const getStaffSeniority = (
  staffName: string,
  therapists: TherapistProfile[] = [],
  seniorityOverrides: Record<string, StaffSeniority> = {}
): StaffSeniority => {
  const cleanName = String(staffName || '').trim();
  if (seniorityOverrides[cleanName]) return seniorityOverrides[cleanName];

  const num = extractExactStaffNumber(cleanName);
  if (num !== null && seniorityOverrides[`No-${num}`]) {
    return seniorityOverrides[`No-${num}`];
  }

  const matchedProfile = therapists.find((t) => isSameStaffMember(cleanName, t.name, t.id));
  const jobPos = String(matchedProfile?.onboardingData?.jobPosition || '').toLowerCase();
  if (jobPos.includes('senior')) return 'Senior';
  if (jobPos.includes('junior')) return 'Junior';

  if (num !== null && DEFAULT_SENIOR_NUMBERS.includes(num)) {
    return 'Senior';
  }
  return 'Junior';
};

export interface ParsedServiceCommissionItem {
  rawItemText: string;
  matchedRuleName: string;
  category: string;
  qty: number;
  unitCommission: number;
  totalCommission: number;
  isVipRoom: boolean;
}

export const calculateSingleItemCommission = (
  rawSegment: string,
  seniority: StaffSeniority,
  hasBookingLevelVip: boolean = false
): ParsedServiceCommissionItem | null => {
  const text = String(rawSegment || '').trim();
  if (!text) return null;
  const lower = text.toLowerCase();

  if (
    lower.includes('sterilized single-use towel') ||
    lower.includes('single-use towel') ||
    lower.includes('disposable underwear') ||
    lower.includes('carebeau') ||
    lower.includes('oil (bottle)') ||
    lower.includes('walk-in reward redemption') ||
    (lower.includes('vvip room') && !lower.includes('massage') && !lower.includes('scrub'))
  ) {
    return null;
  }

  const qtyMatch = text.match(/\(x(\d+)\)/i) || text.match(/\bx(\d+)\b/i);
  const qty = qtyMatch ? Math.max(1, parseInt(qtyMatch[1], 10)) : 1;

  const isVip =
    hasBookingLevelVip ||
    lower.includes('vvip') ||
    lower.includes('(vip)') ||
    lower.includes('+ vip') ||
    lower.includes('+ vvip');

  const is90Min = lower.includes('90');
  const is120Min = lower.includes('120');

  let matchedRuleName = text;
  let category = 'Massage';
  let unitComm = 0;

  // 1. OUTCALL SERVICES (Senior vs Junior difference)
  if (lower.includes('part time outcall') || (lower.includes('outcall') && lower.includes('100'))) {
    matchedRuleName = 'Part Time Outcall (100 Min)';
    category = 'Outcall';
    unitComm = seniority === 'Senior' ? 12000 : 10000;
  } else if (lower.includes('half day')) {
    matchedRuleName = 'Half Day Service (6 Hrs)';
    category = 'Outcall';
    unitComm = seniority === 'Senior' ? 20000 : 15000;
  } else if (lower.includes('whole night')) {
    matchedRuleName = 'Whole Night Service (12 Hrs)';
    category = 'Outcall';
    unitComm = seniority === 'Senior' ? 35000 : 25000;
  } else if (lower.includes('whole day')) {
    matchedRuleName = 'Whole Day Service (12 Hrs)';
    category = 'Outcall';
    unitComm = seniority === 'Senior' ? 40000 : 30000;
  }
  // 2. BODY SCRUB SERVICES
  else if (lower.includes('body scrub') && (lower.includes('lotion') || is120Min)) {
    matchedRuleName = 'Body Scrub & Lotion 120 Min';
    category = 'Scrub';
    unitComm = 6000;
  } else if (lower.includes('body scrub') || lower.includes('scrub & bath')) {
    matchedRuleName = 'Body Scrub & Bath Only 60 Min';
    category = 'Scrub';
    unitComm = 5000;
  }
  // 3. WAXING SERVICES
  else if (lower.includes('underarm wax')) {
    matchedRuleName = 'Underarm Wax';
    category = 'Waxing';
    unitComm = 2500;
  } else if (lower.includes('arm wax')) {
    matchedRuleName = 'Arm Wax';
    category = 'Waxing';
    unitComm = 2000;
  } else if (lower.includes('half leg wax')) {
    matchedRuleName = 'Half Leg Wax';
    category = 'Waxing';
    unitComm = 3000;
  } else if (lower.includes('full leg wax')) {
    matchedRuleName = 'Full Leg Wax';
    category = 'Waxing';
    unitComm = 4500;
  } else if (lower.includes('bikini wax')) {
    matchedRuleName = 'Bikini Wax';
    category = 'Waxing';
    unitComm = 3500;
  } else if (lower.includes('brazilian wax')) {
    matchedRuleName = 'Brazilian Wax';
    category = 'Waxing';
    unitComm = 5000;
  }
  // 4. MASSAGE SERVICES
  else if (lower.includes('body to body')) {
    matchedRuleName = is90Min ? 'Body to Body Massage 90 Min' : 'Body to Body Massage 60 Min';
    category = 'Massage';
    unitComm = is90Min ? 7500 : 5000;
  } else if (lower.includes('lotion candle')) {
    matchedRuleName = is90Min ? 'Lotion Candle Massage 90 Min' : 'Lotion Candle Massage 60 Min';
    category = 'Massage';
    unitComm = is90Min ? 7500 : 5000;
  } else if (lower.includes('four hands') || lower.includes('4 hands')) {
    matchedRuleName = is90Min ? 'Four Hands Massage 90 Min' : 'Four Hands Massage 60 Min';
    category = 'Massage';
    unitComm = is90Min ? 5000 : 3500;
  } else if (lower.includes('body butter')) {
    if (is90Min) {
      matchedRuleName = isVip ? 'Body Butter Lotion 90 Min (VIP)' : 'Body Butter Lotion 90 Min';
      unitComm = isVip ? 6000 : 5000;
    } else {
      matchedRuleName = isVip ? 'Body Butter Lotion 60 Min (VIP)' : 'Body Butter Lotion 60 Min';
      unitComm = isVip ? 4000 : 3500;
    }
    category = 'Massage';
  } else if (lower.includes('aromatherapy')) {
    if (is90Min) {
      matchedRuleName = isVip ? 'Aromatherapy Massage 90 Min (VIP)' : 'Aromatherapy Massage 90 Min';
      unitComm = isVip ? 6000 : 4500;
    } else {
      matchedRuleName = isVip ? 'Aromatherapy Massage 60 Min (VIP)' : 'Aromatherapy Massage 60 Min';
      unitComm = isVip ? 4000 : 3000;
    }
    category = 'Massage';
  } else if (lower.includes('traditional')) {
    if (is90Min) {
      matchedRuleName = isVip ? 'Traditional Massage 90 Min (VIP)' : 'Traditional Massage 90 Min';
      unitComm = isVip ? 5000 : 3500;
    } else {
      matchedRuleName = isVip ? 'Traditional Massage 60 Min (VIP)' : 'Traditional Massage 60 Min';
      unitComm = isVip ? 3500 : 2500;
    }
    category = 'Massage';
  } else if (lower.includes('oil massage')) {
    if (is90Min) {
      matchedRuleName = isVip ? 'Oil Massage 90 Min (VIP)' : 'Oil Massage 90 Min';
      unitComm = isVip ? 5000 : 3500;
    } else {
      matchedRuleName = isVip ? 'Oil Massage 60 Min (VIP)' : 'Oil Massage 60 Min';
      unitComm = isVip ? 3500 : 2500;
    }
    category = 'Massage';
  } else {
    return null;
  }

  return {
    rawItemText: text,
    matchedRuleName,
    category,
    qty,
    unitCommission: unitComm,
    totalCommission: unitComm * qty,
    isVipRoom: isVip
  };
};

export const calculateBookingCommissionForStaff = (
  booking: any,
  seniority: StaffSeniority,
  therapistShareCount: number = 1
): {
  totalCommission: number;
  itemsBreakdown: ParsedServiceCommissionItem[];
} => {
  const serviceStr = String(booking?.service || '');
  const hasBookingLevelVip =
    serviceStr.toLowerCase().includes('+ vvip') ||
    serviceStr.toLowerCase().includes('vvip room') ||
    serviceStr.toLowerCase().includes('(vip)');

  const itemsBreakdown: ParsedServiceCommissionItem[] = [];

  if (Array.isArray(booking?.posItems) && booking.posItems.length > 0) {
    booking.posItems.forEach((pItem: any) => {
      const label = `${pItem.name || ''} (${pItem.duration || ''}) ${pItem.isVvip ? '+ VVIP' : ''}`;
      const res = calculateSingleItemCommission(label, seniority, Boolean(pItem.isVvip) || hasBookingLevelVip);
      if (res) {
        const q = Math.max(1, Number(pItem.qty) || 1);
        const isFourHands = res.matchedRuleName.toLowerCase().includes('four hands');
        const perStaffComm = isFourHands
          ? res.unitCommission * q
          : Math.round((res.unitCommission * q) / Math.max(1, therapistShareCount));

        itemsBreakdown.push({
          ...res,
          qty: q,
          totalCommission: perStaffComm
        });
      }
    });
  } else {
    const segments = serviceStr
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    segments.forEach((seg) => {
      const res = calculateSingleItemCommission(seg, seniority, hasBookingLevelVip);
      if (res) {
        const isFourHands = res.matchedRuleName.toLowerCase().includes('four hands');
        const perStaffComm = isFourHands
          ? res.totalCommission
          : Math.round(res.totalCommission / Math.max(1, therapistShareCount));

        itemsBreakdown.push({
          ...res,
          totalCommission: perStaffComm
        });
      }
    });
  }

  const totalCommission = itemsBreakdown.reduce((sum, item) => sum + item.totalCommission, 0);
  return { totalCommission, itemsBreakdown };
};

// ============================================================================
// 🌟 2. ADMIN STAFF PAYROLL & COMMISSION SETTLEMENT COMPONENT 🌟
// ============================================================================

interface CustomDeductionItem {
  id: string;
  reason: string;
  amount: number;
  date: string;
}

interface StaffMonthlyPayrollAdjustment {
  baseSalary: number;
  bonus: number;
  wifiFeeOverride?: number | null; // null/undefined = use global default WiFi fee
  customDeductions: CustomDeductionItem[];
  isPaidSettled: boolean;
  settledAt?: number | null;
  note?: string;
}

const WIFI_PRESETS = [0, 5000, 10000, 15000, 20000];

export function AdminStaffPayrollManager({
  bookings,
  therapists,
  adminRole
}: {
  bookings: Booking[];
  therapists: TherapistProfile[];
  adminRole: string;
}) {
  const todayStr =
    new Date().getFullYear() +
    '-' +
    String(new Date().getMonth() + 1).padStart(2, '0') +
    '-' +
    String(new Date().getDate()).padStart(2, '0');
  const currentYearMonth = todayStr.substring(0, 7);

  const [selectedMonth, setSelectedMonth] = useState<string>(currentYearMonth);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedStaffForDetail, setSelectedStaffForDetail] = useState<string | null>(null);
  const [showRateReferenceModal, setShowRateReferenceModal] = useState<boolean>(false);

  // Modal State for Adding Custom Deduction / Bonus / Base Salary
  const [editingStaffName, setEditingStaffName] = useState<string | null>(null);
  const [newDedReason, setNewDedReason] = useState<string>('');
  const [newDedAmount, setNewDedAmount] = useState<string>('');
  const [bonusInput, setBonusInput] = useState<string>('');
  const [baseSalaryInput, setBaseSalaryInput] = useState<string>('');

  // Inline Editing State for Custom Deduction Amount inside Modal
  const [editingDedId, setEditingDedId] = useState<string | null>(null);
  const [editingDedAmtValue, setEditingDedAmtValue] = useState<string>('');

  // Global Default Monthly WiFi Fee Input State
  const [customGlobalWifiInput, setCustomGlobalWifiInput] = useState<string>('10000');

  // Firestore synced states: Penalties/Loans & Payroll Adjustments & Seniority Overrides & Global WiFi Fee
  const [penalties, setPenalties] = useState<any[]>([]);
  const [payrollDocData, setPayrollDocData] = useState<{
    defaultWifiFee: number;
    adjustments: Record<string, StaffMonthlyPayrollAdjustment>;
    seniorityOverrides: Record<string, StaffSeniority>;
  }>({ defaultWifiFee: 10000, adjustments: {}, seniorityOverrides: {} });

  // 1. Listen to Penalties & Loans Collection
  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'penalties'), (snap) => {
      const list: any[] = [];
      snap.forEach((d) => list.push({ id: d.id, ...d.data() }));
      setPenalties(list);
    });
    return () => unsub();
  }, []);

  // 2. Listen to Monthly Payroll Adjustments in Firestore
  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'settings', `payroll_${selectedMonth}`), (snap) => {
      if (snap.exists()) {
        const data = snap.data() as any;
        const wifiFee = data.defaultWifiFee !== undefined ? Number(data.defaultWifiFee) : 10000;
        setPayrollDocData({
          defaultWifiFee: isNaN(wifiFee) ? 10000 : wifiFee,
          adjustments: data.adjustments || {},
          seniorityOverrides: data.seniorityOverrides || {}
        });
        setCustomGlobalWifiInput(String(isNaN(wifiFee) ? 10000 : wifiFee));
      } else {
        setPayrollDocData({ defaultWifiFee: 10000, adjustments: {}, seniorityOverrides: {} });
        setCustomGlobalWifiInput('10000');
      }
    });
    return () => unsub();
  }, [selectedMonth]);

  const uniqueTherapists = useMemo(() => {
    return Array.from(
      new Map(therapists.filter((t) => t.name && t.name.trim() !== '').map((t) => [t.name.trim(), t])).values()
    );
  }, [therapists]);

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

  // 🌟 Helper to get effective WiFi Fee for a staff member 🌟
  // Also migrates any manually added "လစဉ် WIFI ကြေး" inside customDeductions so it never duplicates!
  const getStaffEffectiveWifiAndCleanDeductions = (
    staffName: string,
    adj?: StaffMonthlyPayrollAdjustment
  ): { wifiFee: number; otherCustomDeductions: CustomDeductionItem[] } => {
    const rawList = adj?.customDeductions || [];
    const wifiItemInList = rawList.find(
      (d) => d.reason.toLowerCase().includes('wifi') || d.id === 'default_wifi'
    );
    const otherCustomDeductions = rawList.filter(
      (d) => !d.reason.toLowerCase().includes('wifi') && d.id !== 'default_wifi'
    );

    let wifiFee = payrollDocData.defaultWifiFee;
    if (adj?.wifiFeeOverride !== undefined && adj?.wifiFeeOverride !== null) {
      wifiFee = Number(adj.wifiFeeOverride);
    } else if (wifiItemInList) {
      wifiFee = Number(wifiItemInList.amount) || 0;
    }

    return { wifiFee: Math.max(0, wifiFee), otherCustomDeductions };
  };

  // 🌟 1-Click Global Default WiFi Fee Changer (Applies to all staff using default) 🌟
  const handleUpdateGlobalWifiFee = async (newFeeAmount: number, resetIndividualOverrides: boolean = false) => {
    const cleanFee = Math.max(0, Math.round(newFeeAmount));
    setCustomGlobalWifiInput(String(cleanFee));

    const nextAdjustments = { ...payrollDocData.adjustments };
    if (resetIndividualOverrides) {
      Object.keys(nextAdjustments).forEach((sName) => {
        const cleanedList = (nextAdjustments[sName].customDeductions || []).filter(
          (d) => !d.reason.toLowerCase().includes('wifi') && d.id !== 'default_wifi'
        );
        nextAdjustments[sName] = {
          ...nextAdjustments[sName],
          wifiFeeOverride: null,
          customDeductions: cleanedList
        };
      });
    }

    await setDoc(
      doc(db, 'settings', `payroll_${selectedMonth}`),
      {
        defaultWifiFee: cleanFee,
        adjustments: nextAdjustments,
        updatedAt: Date.now()
      },
      { merge: true }
    );
  };

  // 🌟 1-Click Individual Staff WiFi Fee Changer 🌟
  const handleSetIndividualWifiFee = async (staffName: string, newWifiAmt: number) => {
    const cleanAmt = Math.max(0, Math.round(newWifiAmt));
    const prev = payrollDocData.adjustments[staffName] || {
      baseSalary: 0,
      bonus: 0,
      customDeductions: [],
      isPaidSettled: false
    };
    const cleanedCustom = (prev.customDeductions || []).filter(
      (d) => !d.reason.toLowerCase().includes('wifi') && d.id !== 'default_wifi'
    );

    const updatedAdj: StaffMonthlyPayrollAdjustment = {
      ...prev,
      wifiFeeOverride: cleanAmt,
      customDeductions: cleanedCustom
    };

    await setDoc(
      doc(db, 'settings', `payroll_${selectedMonth}`),
      {
        adjustments: {
          ...payrollDocData.adjustments,
          [staffName]: updatedAdj
        },
        updatedAt: Date.now()
      },
      { merge: true }
    );
  };

  // Toggle Senior / Junior for a therapist
  const handleToggleSeniority = async (staffName: string, currentLevel: StaffSeniority) => {
    const nextLevel: StaffSeniority = currentLevel === 'Senior' ? 'Junior' : 'Senior';
    const updatedOverrides = {
      ...payrollDocData.seniorityOverrides,
      [staffName]: nextLevel
    };
    await setDoc(
      doc(db, 'settings', `payroll_${selectedMonth}`),
      { seniorityOverrides: updatedOverrides, updatedAt: Date.now() },
      { merge: true }
    );
  };

  // Open Adjustment Modal for a Staff
  const handleOpenAdjustmentModal = (staffName: string, currentAdj?: StaffMonthlyPayrollAdjustment) => {
    setEditingStaffName(staffName);
    setBonusInput(String(currentAdj?.bonus || 0));
    setBaseSalaryInput(String(currentAdj?.baseSalary || 0));
    setNewDedReason('');
    setNewDedAmount('');
    setEditingDedId(null);
  };

  // Save Base Salary & Bonus
  const handleSaveSalaryAndBonus = async (staffName: string) => {
    const prev = payrollDocData.adjustments[staffName] || {
      baseSalary: 0,
      bonus: 0,
      customDeductions: [],
      isPaidSettled: false
    };
    const updatedAdj: StaffMonthlyPayrollAdjustment = {
      ...prev,
      baseSalary: Math.max(0, Number(baseSalaryInput) || 0),
      bonus: Math.max(0, Number(bonusInput) || 0)
    };
    await setDoc(
      doc(db, 'settings', `payroll_${selectedMonth}`),
      {
        adjustments: {
          ...payrollDocData.adjustments,
          [staffName]: updatedAdj
        },
        updatedAt: Date.now()
      },
      { merge: true }
    );
  };

  // Add Custom Deduction Item
  const handleAddCustomDeduction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingStaffName) return;
    const amt = Math.max(0, Number(newDedAmount) || 0);
    if (!newDedReason.trim() || amt <= 0) {
      alert('ဖြတ်တောက်မည့် အကြောင်းအရာနှင့် ငွေပမာဏ ထည့်သွင်းပေးပါ။');
      return;
    }

    // If user typed WiFi, update the WiFi override directly instead of duplicating
    if (newDedReason.trim().toLowerCase().includes('wifi')) {
      await handleSetIndividualWifiFee(editingStaffName, amt);
      setNewDedReason('');
      setNewDedAmount('');
      return;
    }

    const prev = payrollDocData.adjustments[editingStaffName] || {
      baseSalary: 0,
      bonus: 0,
      customDeductions: [],
      isPaidSettled: false
    };

    const newItem: CustomDeductionItem = {
      id: `ded_${Date.now()}`,
      reason: newDedReason.trim(),
      amount: amt,
      date: todayStr
    };

    const cleanedPrevList = (prev.customDeductions || []).filter(
      (d) => !d.reason.toLowerCase().includes('wifi') && d.id !== 'default_wifi'
    );

    const updatedAdj: StaffMonthlyPayrollAdjustment = {
      ...prev,
      baseSalary: Math.max(0, Number(baseSalaryInput) || prev.baseSalary || 0),
      bonus: Math.max(0, Number(bonusInput) || prev.bonus || 0),
      customDeductions: [...cleanedPrevList, newItem]
    };

    await setDoc(
      doc(db, 'settings', `payroll_${selectedMonth}`),
      {
        adjustments: {
          ...payrollDocData.adjustments,
          [editingStaffName]: updatedAdj
        },
        updatedAt: Date.now()
      },
      { merge: true }
    );

    setNewDedReason('');
    setNewDedAmount('');
  };

  // Update an existing Custom Deduction's Amount inline
  const handleUpdateCustomDeductionAmount = async (staffName: string, dedId: string, newAmt: number) => {
    const prev = payrollDocData.adjustments[staffName];
    if (!prev) return;
    const cleanAmt = Math.max(0, Math.round(newAmt));
    const updatedList = (prev.customDeductions || []).map((d) =>
      d.id === dedId ? { ...d, amount: cleanAmt } : d
    );
    await setDoc(
      doc(db, 'settings', `payroll_${selectedMonth}`),
      {
        adjustments: {
          ...payrollDocData.adjustments,
          [staffName]: { ...prev, customDeductions: updatedList }
        },
        updatedAt: Date.now()
      },
      { merge: true }
    );
    setEditingDedId(null);
  };

  // Delete Custom Deduction Item
  const handleRemoveCustomDeduction = async (staffName: string, dedId: string) => {
    const prev = payrollDocData.adjustments[staffName];
    if (!prev) return;
    const updatedAdj: StaffMonthlyPayrollAdjustment = {
      ...prev,
      customDeductions: (prev.customDeductions || []).filter((d) => d.id !== dedId)
    };
    await setDoc(
      doc(db, 'settings', `payroll_${selectedMonth}`),
      {
        adjustments: {
          ...payrollDocData.adjustments,
          [staffName]: updatedAdj
        },
        updatedAt: Date.now()
      },
      { merge: true }
    );
  };

  // 🌟 FIXED: Toggle Paid / Settled Status (Reversible between Paid & Unpaid without Firestore undefined error!) 🌟
  const handleToggleSettledStatus = async (staffName: string, currentSettled: boolean) => {
    if (currentSettled) {
      const ok = window.confirm(
        `${staffName} ၏ လစာအား "မရှင်းရသေး (Unpaid)" အဖြစ် ပြန်လည်ပြောင်းလဲမည်မှာ သေချာပါသလား?`
      );
      if (!ok) return;
    }

    const prev = payrollDocData.adjustments[staffName] || {
      baseSalary: 0,
      bonus: 0,
      customDeductions: [],
      isPaidSettled: false
    };

    const nextSettled = !currentSettled;
    // IMPORTANT: Firestore rejects `undefined`, so we use `null` when reverting to unpaid!
    const updatedAdj: StaffMonthlyPayrollAdjustment = {
      ...prev,
      isPaidSettled: nextSettled,
      settledAt: nextSettled ? Date.now() : null
    };

    try {
      await setDoc(
        doc(db, 'settings', `payroll_${selectedMonth}`),
        {
          adjustments: {
            ...payrollDocData.adjustments,
            [staffName]: updatedAdj
          },
          updatedAt: Date.now()
        },
        { merge: true }
      );
    } catch (err) {
      console.error('Error toggling paid status:', err);
      alert('Status ပြောင်းလဲရာတွင် အမှားအယွင်းရှိနေပါသည်။');
    }
  };

  // 🌟 3. Compute Comprehensive Payroll Data for Each Staff Member 🌟
  const staffPayrollRows = useMemo(() => {
    const map = new Map<
      string,
      {
        staffId: string;
        staffName: string;
        shortId: string;
        seniority: StaffSeniority;
        sectionsCount: number;
        totalSalesAmount: number;
        totalServiceCommission: number;
        serviceSummaryMap: Map<string, { ruleName: string; category: string; count: number; unitComm: number; totalComm: number }>;
        bookingLogs: {
          bookingId: string;
          date: string;
          txId: string;
          customerName: string;
          rawService: string;
          salesShare: number;
          commissionEarned: number;
          items: ParsedServiceCommissionItem[];
        }[];
      }
    >();

    uniqueTherapists.forEach((t) => {
      const num = extractExactStaffNumber(t.name);
      const shortId = num !== null ? `SGL-${String(num).padStart(3, '0')}` : t.id;
      const seniority = getStaffSeniority(t.name, uniqueTherapists, payrollDocData.seniorityOverrides);
      map.set(t.name.trim(), {
        staffId: t.id,
        staffName: t.name.trim(),
        shortId,
        seniority,
        sectionsCount: 0,
        totalSalesAmount: 0,
        totalServiceCommission: 0,
        serviceSummaryMap: new Map(),
        bookingLogs: []
      });
    });

    bookings.forEach((b: any) => {
      if (!b || b.status === 'cancelled') return;

      const rawTx = parseSafeStr(b.txId).trim().toUpperCase();
      const rawService = String(b.service || '').trim();
      const totalAmt = parseSafeNum(b.totalPrice);

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

      const bDate = String(b.date || '').trim();
      if (!bDate.startsWith(selectedMonth)) return;

      const rawTherapistStr = String(b.therapist || '').trim();
      if (!rawTherapistStr || rawTherapistStr === '-' || rawTherapistStr.toLowerCase().includes('any available')) return;

      const splitNames = rawTherapistStr.split(/&|,|\+/).map((s) => s.trim()).filter(Boolean);
      if (splitNames.length === 0) return;

      const salesShare = Math.round(totalAmt / splitNames.length);

      splitNames.forEach((tNameRaw) => {
        const matchedProfile = uniqueTherapists.find((tp) => isSameStaffMember(tNameRaw, tp.name, tp.id));
        const canonicalName = matchedProfile ? matchedProfile.name.trim() : tNameRaw.trim();

        if (!map.has(canonicalName)) {
          const num = extractExactStaffNumber(canonicalName);
          map.set(canonicalName, {
            staffId: canonicalName,
            staffName: canonicalName,
            shortId: num !== null ? `SGL-${String(num).padStart(3, '0')}` : canonicalName,
            seniority: getStaffSeniority(canonicalName, uniqueTherapists, payrollDocData.seniorityOverrides),
            sectionsCount: 0,
            totalSalesAmount: 0,
            totalServiceCommission: 0,
            serviceSummaryMap: new Map(),
            bookingLogs: []
          });
        }

        const staffEntry = map.get(canonicalName)!;
        const commResult = calculateBookingCommissionForStaff(b, staffEntry.seniority, splitNames.length);

        staffEntry.sectionsCount += 1;
        staffEntry.totalSalesAmount += salesShare;
        staffEntry.totalServiceCommission += commResult.totalCommission;

        commResult.itemsBreakdown.forEach((it) => {
          const existing = staffEntry.serviceSummaryMap.get(it.matchedRuleName);
          if (existing) {
            existing.count += it.qty;
            existing.totalComm += it.totalCommission;
          } else {
            staffEntry.serviceSummaryMap.set(it.matchedRuleName, {
              ruleName: it.matchedRuleName,
              category: it.category,
              count: it.qty,
              unitComm: it.unitCommission,
              totalComm: it.totalCommission
            });
          }
        });

        staffEntry.bookingLogs.push({
          bookingId: b.id || '',
          date: bDate,
          txId: rawTx || 'Online',
          customerName: parseSafeStr(b.name) || 'Walk-in Guest',
          rawService,
          salesShare,
          commissionEarned: commResult.totalCommission,
          items: commResult.itemsBreakdown
        });
      });
    });

    // Combine with Fines, Loans, Default Monthly WiFi Fee, and Custom Deductions
    const finalRows = Array.from(map.values()).map((row) => {
      const myPenalties = penalties.filter((p) => {
        if (!isSameStaffMember(p.therapistName || '', row.staffName, row.staffId)) return false;
        const pDate = String(p.date || '');
        return pDate.startsWith(selectedMonth) && !p.isPaid;
      });

      const systemFinesTotal = myPenalties
        .filter((p) => p.type !== 'loan')
        .reduce((sum, p) => sum + (Number(p.amount) || 0), 0);

      const systemLoansTotal = myPenalties
        .filter((p) => p.type === 'loan')
        .reduce((sum, p) => sum + (Number(p.amount) || 0), 0);

      const adj = payrollDocData.adjustments[row.staffName] || {
        baseSalary: 0,
        bonus: 0,
        customDeductions: [],
        isPaidSettled: false
      };

      const { wifiFee, otherCustomDeductions } = getStaffEffectiveWifiAndCleanDeductions(row.staffName, adj);

      const otherCustomTotal = otherCustomDeductions.reduce((sum, d) => sum + (Number(d.amount) || 0), 0);
      const customDeductionsTotal = wifiFee + otherCustomTotal;

      // Combined display list including Default WiFi Fee (if > 0)
      const allCustomDeductionLabels: { id: string; reason: string; amount: number; isWifi: boolean; date?: string }[] = [];
      if (wifiFee > 0) {
        allCustomDeductionLabels.push({
          id: 'default_wifi',
          reason: 'လစဉ် WIFI ကြေး',
          amount: wifiFee,
          isWifi: true
        });
      }
      otherCustomDeductions.forEach((d) => {
        allCustomDeductionLabels.push({
          id: d.id,
          reason: d.reason,
          amount: Number(d.amount) || 0,
          isWifi: false,
          date: d.date
        });
      });

      const totalDeductions = systemFinesTotal + systemLoansTotal + customDeductionsTotal;
      const grossPay = (adj.baseSalary || 0) + row.totalServiceCommission + (adj.bonus || 0);
      const netPayable = grossPay - totalDeductions;

      return {
        ...row,
        serviceBreakdownList: Array.from(row.serviceSummaryMap.values()).sort((a, b) => b.totalComm - a.totalComm),
        bookingLogs: row.bookingLogs.sort((a, b) => b.date.localeCompare(a.date)),
        baseSalary: adj.baseSalary || 0,
        bonus: adj.bonus || 0,
        wifiFee,
        systemFinesTotal,
        systemLoansTotal,
        myPenalties,
        customDeductions: otherCustomDeductions,
        allCustomDeductionLabels,
        customDeductionsTotal,
        totalDeductions,
        grossPay,
        netPayable,
        isPaidSettled: Boolean(adj.isPaidSettled),
        settledAt: adj.settledAt || null
      };
    });

    return finalRows.sort((a, b) => {
      const nA = extractExactStaffNumber(a.staffName) ?? 999;
      const nB = extractExactStaffNumber(b.staffName) ?? 999;
      return nA - nB;
    });
  }, [uniqueTherapists, bookings, selectedMonth, penalties, payrollDocData]);

  const filteredRows = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return staffPayrollRows;
    return staffPayrollRows.filter(
      (r) =>
        r.staffName.toLowerCase().includes(q) ||
        r.shortId.toLowerCase().includes(q) ||
        r.seniority.toLowerCase().includes(q)
    );
  }, [staffPayrollRows, searchQuery]);

  // Global Totals for Executive Cards
  const globalTotals = useMemo(() => {
    return filteredRows.reduce(
      (acc, r) => {
        acc.totalSections += r.sectionsCount;
        acc.totalSales += r.totalSalesAmount;
        acc.totalCommission += r.totalServiceCommission;
        acc.totalSalaryAndBonus += r.baseSalary + r.bonus;
        acc.totalDeductions += r.totalDeductions;
        acc.totalNetPay += r.netPayable;
        return acc;
      },
      {
        totalSections: 0,
        totalSales: 0,
        totalCommission: 0,
        totalSalaryAndBonus: 0,
        totalDeductions: 0,
        totalNetPay: 0
      }
    );
  }, [filteredRows]);

  // Export Full Monthly Payroll CSV (Excel)
  const handleExportPayrollExcel = () => {
    const summaryHeaders = [
      'Staff ID',
      'Therapist Name',
      'Seniority Level',
      'Month',
      'Completed Sections (Sec)',
      'Total Sales Revenue (Ks)',
      'Exact Service Commission (Ks)',
      'Base Salary (Ks)',
      'Bonus (Ks)',
      'Gross Pay (Ks)',
      'System Fines (Ks)',
      'Staff Loans / Advances (Ks)',
      'Monthly WiFi Fee (Ks)',
      'Other Custom Deductions (Ks)',
      'Custom Deduction Reasons',
      'Total Deductions (Ks)',
      'NET PAYABLE SALARY (Ks)',
      'Payment Status',
      'Service-by-Service Breakdown'
    ];

    const summaryRows = filteredRows.map((r) => {
      const customReasonsStr = r.allCustomDeductionLabels
        .map((d) => `${d.reason} (${d.amount} Ks)`)
        .join(' | ');
      const otherDedAmt = r.customDeductions.reduce((s, d) => s + (Number(d.amount) || 0), 0);
      const serviceBreakdownStr = r.serviceBreakdownList
        .map((s) => `${s.ruleName}: ${s.count}x (${s.totalComm} Ks)`)
        .join(' ; ');

      return [
        `"${r.shortId}"`,
        `"${r.staffName}"`,
        `"${r.seniority}"`,
        `"${selectedMonth}"`,
        r.sectionsCount,
        r.totalSalesAmount,
        r.totalServiceCommission,
        r.baseSalary,
        r.bonus,
        r.grossPay,
        r.systemFinesTotal,
        r.systemLoansTotal,
        r.wifiFee,
        otherDedAmt,
        `"${customReasonsStr || '-'}"`,
        r.totalDeductions,
        r.netPayable,
        `"${r.isPaidSettled ? 'PAID / SETTLED' : 'UNPAID'}"`,
        `"${serviceBreakdownStr || 'No Services'}"`
      ];
    });

    const csvContent =
      '\uFEFF' + [summaryHeaders.join(','), ...summaryRows.map((row) => row.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `ShangriLa_Staff_Payroll_${selectedMonth}.csv`;
    link.click();
  };

  // Export Detailed Service-by-Service Log
  const handleExportDetailedServiceLogsExcel = () => {
    const headers = [
      'Date',
      'Invoice / TxID',
      'Staff ID',
      'Therapist Name',
      'Seniority',
      'Customer Name',
      'Booked Service Name',
      'Matched Commission Rule',
      'Category',
      'Qty',
      'Unit Commission Rate (Ks)',
      'Earned Commission (Ks)'
    ];

    const rows: any[] = [];
    filteredRows.forEach((staff) => {
      staff.bookingLogs.forEach((log) => {
        if (log.items.length === 0) {
          rows.push([
            `"${log.date}"`,
            `"${log.txId}"`,
            `"${staff.shortId}"`,
            `"${staff.staffName}"`,
            `"${staff.seniority}"`,
            `"${log.customerName}"`,
            `"${log.rawService}"`,
            `"Unmatched / Add-on"`,
            `"-"`,
            1,
            0,
            0
          ]);
        } else {
          log.items.forEach((it) => {
            rows.push([
              `"${log.date}"`,
              `"${log.txId}"`,
              `"${staff.shortId}"`,
              `"${staff.staffName}"`,
              `"${staff.seniority}"`,
              `"${log.customerName}"`,
              `"${it.rawItemText}"`,
              `"${it.matchedRuleName}"`,
              `"${it.category}"`,
              it.qty,
              it.unitCommission,
              it.totalCommission
            ]);
          });
        }
      });
    });

    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `ShangriLa_Detailed_Service_Commissions_${selectedMonth}.csv`;
    link.click();
  };

  const editingStaffRow = useMemo(() => {
    if (!editingStaffName) return null;
    return staffPayrollRows.find((r) => r.staffName === editingStaffName) || null;
  }, [editingStaffName, staffPayrollRows]);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* =========================================================================
          MODAL 1: OFFICIAL EXCEL COMMISSION RATE REFERENCE TABLE
         ========================================================================= */}
      {showRateReferenceModal && (
        <div className="fixed inset-0 z-[260] bg-black/70 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-3xl w-full p-6 shadow-2xl border border-[#D4AF37]/40 my-auto max-h-[90vh] flex flex-col">
            <div className="flex justify-between items-center border-b border-gray-200 pb-4 mb-4">
              <div>
                <h3 className="text-base sm:text-lg font-black text-[#123524] flex items-center">
                  <FileSpreadsheet className="w-5 h-5 mr-2 text-[#D4AF37]" />
                  Official Staff Commission Rate Card (Excel Standard)
                </h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  Staff Commession Rate.xlsx ဖိုင်ပါ ဝန်ဆောင်မှု (၃၄) မျိုး၏ တရားဝင် ကော်မရှင်နှုန်းထားများ
                </p>
              </div>
              <button
                onClick={() => setShowRateReferenceModal(false)}
                className="px-3 py-1.5 rounded-xl bg-gray-100 hover:bg-red-50 text-gray-600 hover:text-red-600 text-xs font-black"
              >
                ✕ Close
              </button>
            </div>

            <div className="overflow-y-auto flex-1 pr-1 space-y-4 text-xs">
              <div className="bg-emerald-50 border border-emerald-200 p-3.5 rounded-xl text-[#123524]">
                <div className="font-black text-xs uppercase tracking-wider mb-1">
                  Senior Therapists (Excel SGL-001, SGL-012, SGL-014):
                </div>
                <p className="text-[11px] font-semibold text-gray-700">
                  ပုံမှန် Massage, Scrub နှင့် Waxing များတွင် Junior နှင့် Senior ကော်မရှင်တူညီပြီး၊{' '}
                  <strong>Outcall Services (၄) မျိုး</strong> တွင် Senior Therapist များက ပိုမိုမြင့်မားသော ကော်မရှင်နှုန်းထား ရရှိပါသည်။
                </p>
              </div>

              <div className="overflow-x-auto border border-gray-200 rounded-xl">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-[#123524] text-[#D4AF37] text-[11px] uppercase">
                      <th className="p-2.5">Service Name</th>
                      <th className="p-2.5">Category</th>
                      <th className="p-2.5 text-right">Menu Price</th>
                      <th className="p-2.5 text-right">Junior Comm</th>
                      <th className="p-2.5 text-right">Senior Comm</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 font-semibold text-gray-700">
                    {[
                      ['Traditional / Oil Massage 60 Min', 'Massage', '25,000 Ks', '2,500 Ks', '2,500 Ks'],
                      ['Traditional / Oil Massage 90 Min', 'Massage', '37,000 Ks', '3,500 Ks', '3,500 Ks'],
                      ['Aromatherapy Massage 60 Min', 'Massage', '30,000 Ks', '3,000 Ks', '3,000 Ks'],
                      ['Aromatherapy Massage 90 Min', 'Massage', '45,000 Ks', '4,500 Ks', '4,500 Ks'],
                      ['Body Butter Lotion 60 Min', 'Massage', '35,000 Ks', '3,500 Ks', '3,500 Ks'],
                      ['Body Butter Lotion 90 Min', 'Massage', '50,000 Ks', '5,000 Ks', '5,000 Ks'],
                      ['Traditional / Oil 60 Min (VIP Room)', 'Massage (VIP)', '35,000 Ks', '3,500 Ks', '3,500 Ks'],
                      ['Traditional / Oil 90 Min (VIP Room)', 'Massage (VIP)', '52,000 Ks', '5,000 Ks', '5,000 Ks'],
                      ['Aromatherapy 60 Min (VIP Room)', 'Massage (VIP)', '40,000 Ks', '4,000 Ks', '4,000 Ks'],
                      ['Aromatherapy 90 Min (VIP Room)', 'Massage (VIP)', '60,000 Ks', '6,000 Ks', '6,000 Ks'],
                      ['Body Butter 60 Min (VIP Room)', 'Massage (VIP)', '45,000 Ks', '4,000 Ks', '4,000 Ks'],
                      ['Body Butter 90 Min (VIP Room)', 'Massage (VIP)', '67,000 Ks', '6,000 Ks', '6,000 Ks'],
                      ['Body to Body / Lotion Candle 60 Min', 'Massage', '55,000 Ks', '5,000 Ks', '5,000 Ks'],
                      ['Body to Body / Lotion Candle 90 Min', 'Massage', '82,000 Ks', '7,500 Ks', '7,500 Ks'],
                      ['Four Hands Massage 60 Min (Per Staff)', 'Massage', '35,000 Ks', '3,500 Ks', '3,500 Ks'],
                      ['Four Hands Massage 90 Min (Per Staff)', 'Massage', '52,000 Ks', '5,000 Ks', '5,000 Ks'],
                      ['Arm / Underarm / Half Leg / Bikini / Full Leg / Brazilian Wax', 'Waxing', '20k - 50k', '2,000 - 5,000 Ks', '2,000 - 5,000 Ks'],
                      ['Body Scrub & Bath Only 60 Min', 'Scrub', '70,000 Ks', '5,000 Ks', '5,000 Ks'],
                      ['Body Scrub & Lotion 120 Min', 'Scrub', '80,000 Ks', '6,000 Ks', '6,000 Ks'],
                      ['Part Time Outcall (100 Min)', 'Outcall', '70,000 Ks', '10,000 Ks', '12,000 Ks'],
                      ['Half Day Service (6 Hrs)', 'Outcall', '100,000 Ks', '15,000 Ks', '20,000 Ks'],
                      ['Whole Night Service (12 Hrs)', 'Outcall', '120,000 Ks', '25,000 Ks', '35,000 Ks'],
                      ['Whole Day Service (12 Hrs)', 'Outcall', '180,000 Ks', '30,000 Ks', '40,000 Ks']
                    ].map((r, i) => (
                      <tr key={i} className="hover:bg-gray-50">
                        <td className="p-2.5 font-bold text-[#123524]">{r[0]}</td>
                        <td className="p-2.5">{r[1]}</td>
                        <td className="p-2.5 text-right">{r[2]}</td>
                        <td className="p-2.5 text-right font-bold text-blue-700">{r[3]}</td>
                        <td className="p-2.5 text-right font-black text-emerald-700">{r[4]}</td>
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
          MODAL 2: CUSTOM DEDUCTIONS, 1-CLICK WIFI FEE, BONUS & BASE SALARY MANAGER
         ========================================================================= */}
      {editingStaffRow && (
        <div className="fixed inset-0 z-[260] bg-black/70 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-[#D4AF37]/40 my-auto space-y-5 animate-fade-in">
            <div className="flex justify-between items-start border-b border-gray-100 pb-3.5">
              <div>
                <span className="text-[10px] font-black uppercase tracking-widest bg-[#123524] text-[#D4AF37] px-2.5 py-0.5 rounded-full">
                  {editingStaffRow.shortId} • {editingStaffRow.seniority}
                </span>
                <h3 className="text-base font-black text-[#123524] mt-1">
                  {editingStaffRow.staffName} — လစာ၊ ဆုကြေး နှင့် ဖြတ်တောက်ငွေ ပြင်ဆင်ရန် ({selectedMonth})
                </h3>
              </div>
              <button
                onClick={() => setEditingStaffName(null)}
                className="px-2.5 py-1 rounded-lg bg-gray-100 text-gray-500 hover:text-red-600 font-bold text-xs"
              >
                ✕
              </button>
            </div>

            {/* 1. Base Salary & Bonus */}
            <div className="bg-gray-50 p-4 rounded-2xl border border-gray-200 space-y-3">
              <div className="text-xs font-black text-[#123524] uppercase tracking-wider">
                ၁။ အခြေခံလစာ နှင့် အပိုဆုကြေး (Base Salary & Bonus)
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Base Salary (Ks)</label>
                  <input
                    type="number"
                    value={baseSalaryInput}
                    onChange={(e) => setBaseSalaryInput(e.target.value)}
                    placeholder="0"
                    className="w-full p-2.5 bg-white border border-gray-300 rounded-xl text-xs font-black text-[#123524]"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Extra Bonus (Ks)</label>
                  <input
                    type="number"
                    value={bonusInput}
                    onChange={(e) => setBonusInput(e.target.value)}
                    placeholder="0"
                    className="w-full p-2.5 bg-white border border-gray-300 rounded-xl text-xs font-black text-blue-700"
                  />
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  handleSaveSalaryAndBonus(editingStaffRow.staffName);
                  alert('✅ အခြေခံလစာနှင့် Bonus သိမ်းဆည်းပြီးပါပြီ။');
                }}
                className="w-full py-2 bg-[#123524] text-[#D4AF37] rounded-xl text-xs font-black shadow-xs hover:bg-[#1a4a32] transition"
              >
                Save Salary & Bonus
              </button>
            </div>

            {/* 2. System Fines & Loans Info */}
            <div className="bg-amber-50/70 p-3.5 rounded-2xl border border-amber-200 space-y-1.5">
              <div className="text-[11px] font-black text-amber-900 flex justify-between">
                <span>Penalty & Loans Tab မှ ဒဏ်ကြေးနှင့် ကြိုထုတ်ငွေ:</span>
                <span>-{formatPrice(editingStaffRow.systemFinesTotal + editingStaffRow.systemLoansTotal)}</span>
              </div>
              <div className="text-[10px] text-amber-800 flex justify-between">
                <span>• ဒဏ်ကြေး (Fines): {formatPrice(editingStaffRow.systemFinesTotal)}</span>
                <span>• ကြိုထုတ်ငွေ (Loans): {formatPrice(editingStaffRow.systemLoansTotal)}</span>
              </div>
            </div>

            {/* 🌟 3. DEFAULT MONTHLY WIFI FEE (1-CLICK AMOUNT CHANGER) 🌟 */}
            <div className="bg-red-50/50 p-4 rounded-2xl border border-red-200 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black text-[#123524] flex items-center gap-1.5">
                  <Wifi className="w-4 h-4 text-red-600" />
                  လစဉ် WIFI ကြေး (Default ဖြတ်တောက်ငွေ)
                </span>
                <span className="text-xs font-black text-red-600 bg-white px-2.5 py-1 rounded-lg border border-red-200">
                  -{formatPrice(editingStaffRow.wifiFee)}
                </span>
              </div>

              <div className="text-[10px] font-bold text-gray-500">
                One-Click ပမာဏ ပြောင်းရန် (နှိပ်လိုက်သည်နှင့် ချက်ချင်းပြောင်းပါမည်):
              </div>

              <div className="flex flex-wrap items-center gap-1.5">
                {WIFI_PRESETS.map((presetAmt) => {
                  const isActive = editingStaffRow.wifiFee === presetAmt;
                  return (
                    <button
                      key={presetAmt}
                      type="button"
                      onClick={() => handleSetIndividualWifiFee(editingStaffRow.staffName, presetAmt)}
                      className={`px-2.5 py-1.5 rounded-xl text-[11px] font-black transition border ${
                        isActive
                          ? 'bg-red-600 text-white border-red-600 shadow-xs'
                          : 'bg-white text-gray-700 border-gray-300 hover:border-red-400'
                      }`}
                    >
                      {presetAmt === 0 ? '0 Ks (ကင်းလွတ်ခွင့်)' : `${presetAmt.toLocaleString()} Ks`}
                    </button>
                  );
                })}

                <input
                  type="number"
                  step={1000}
                  value={editingStaffRow.wifiFee}
                  onChange={(e) => handleSetIndividualWifiFee(editingStaffRow.staffName, Number(e.target.value) || 0)}
                  className="w-24 p-1.5 bg-white border border-red-300 rounded-xl text-xs font-black text-red-600 text-center outline-none focus:border-red-600"
                  title="စိတ်ကြိုက် WiFi ကြေး ရိုက်ထည့်ရန်"
                />
              </div>
            </div>

            {/* 4. Other Custom Deductions Manager */}
            <div className="space-y-3">
              <div className="text-xs font-black text-red-700 uppercase tracking-wider">
                ၂။ အခြား ဖြတ်တောက်ငွေများ စိတ်ကြိုက်ထည့်ရန် (Custom Deductions)
              </div>

              <form onSubmit={handleAddCustomDeduction} className="grid grid-cols-1 sm:grid-cols-12 gap-2">
                <input
                  type="text"
                  required
                  value={newDedReason}
                  onChange={(e) => setNewDedReason(e.target.value)}
                  placeholder="အကြောင်းအရာ (ဥပမာ - ယူနီဖောင်းဖိုး / ပစ္စည်းပျက်စီး)"
                  className="sm:col-span-7 p-2.5 bg-gray-50 border border-gray-300 rounded-xl text-xs font-bold outline-none focus:border-red-500"
                />
                <input
                  type="number"
                  required
                  value={newDedAmount}
                  onChange={(e) => setNewDedAmount(e.target.value)}
                  placeholder="ပမာဏ (Ks)"
                  className="sm:col-span-3 p-2.5 bg-gray-50 border border-gray-300 rounded-xl text-xs font-black text-red-600 outline-none focus:border-red-500"
                />
                <button
                  type="submit"
                  className="sm:col-span-2 py-2.5 px-3 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-black flex items-center justify-center"
                >
                  + ထည့်မည်
                </button>
              </form>

              {/* Existing Custom Deductions List (With 1-Click Inline Edit) */}
              <div className="space-y-1.5 max-h-40 overflow-y-auto">
                {editingStaffRow.customDeductions.length === 0 ? (
                  <div className="text-center py-3 text-[11px] text-gray-400 font-semibold border border-dashed border-gray-200 rounded-xl">
                    WiFi ကြေးမှလွဲ၍ အခြားဖြတ်တောက်ငွေ ထည့်သွင်းထားခြင်း မရှိပါ။
                  </div>
                ) : (
                  editingStaffRow.customDeductions.map((item) => {
                    const isEditingThis = editingDedId === item.id;
                    return (
                      <div
                        key={item.id}
                        className="flex items-center justify-between p-2.5 bg-red-50/60 border border-red-200 rounded-xl text-xs gap-2"
                      >
                        <div className="min-w-0 flex-1">
                          <span className="font-bold text-gray-800">{item.reason}</span>
                          <span className="text-[10px] text-gray-400 ml-2">({item.date})</span>
                        </div>

                        {isEditingThis ? (
                          <div className="flex items-center gap-1.5">
                            <input
                              type="number"
                              autoFocus
                              value={editingDedAmtValue}
                              onChange={(e) => setEditingDedAmtValue(e.target.value)}
                              className="w-24 px-2 py-1 bg-white border border-red-400 rounded-lg text-xs font-black text-red-600 outline-none"
                            />
                            <button
                              type="button"
                              onClick={() =>
                                handleUpdateCustomDeductionAmount(
                                  editingStaffRow.staffName,
                                  item.id,
                                  Number(editingDedAmtValue) || 0
                                )
                              }
                              className="p-1.5 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700"
                              title="Save Amount"
                            >
                              <Check className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => {
                                setEditingDedId(item.id);
                                setEditingDedAmtValue(String(item.amount));
                              }}
                              title="နှိပ်၍ ငွေပမာဏ ချက်ချင်းပြင်ရန်"
                              className="font-black text-red-600 hover:bg-red-100 px-2 py-1 rounded-lg flex items-center gap-1 transition"
                            >
                              <span>-{formatPrice(item.amount)}</span>
                              <Edit3 className="w-3 h-3 text-gray-400" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleRemoveCustomDeduction(editingStaffRow.staffName, item.id)}
                              className="p-1 text-red-500 hover:bg-red-100 rounded"
                              title="Delete Deduction"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Summary Footer inside Modal */}
            <div className="pt-3 border-t border-gray-200 flex items-center justify-between">
              <div>
                <div className="text-[10px] font-bold text-gray-400 uppercase">အသားတင် ပေးချေရမည့်လစာ (Net Payable)</div>
                <div className="text-lg font-black text-[#123524]">{formatPrice(editingStaffRow.netPayable)}</div>
              </div>
              <button
                type="button"
                onClick={() => setEditingStaffName(null)}
                className="px-5 py-2.5 bg-[#123524] text-[#D4AF37] rounded-xl text-xs font-black"
              >
                Done (ပြီးပြီ)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          TOP EXECUTIVE HEADER & CONTROLS
         ========================================================================= */}
      <div className="bg-white p-5 sm:p-6 rounded-2xl shadow-sm border border-gray-200 space-y-5">
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 border-b border-gray-100 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-100 text-emerald-800 border border-emerald-300">
                Excel Rate Card Synced
              </span>
              <h2 className="text-lg sm:text-xl font-black text-[#123524] flex items-center">
                <Banknote className="w-5 h-5 mr-2 text-[#D4AF37]" />
                Staff Pay Roll & Exact Service Commission Center
              </h2>
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Staff Commession Rate.xlsx ပါ ဝန်ဆောင်မှုတစ်ခုချင်းစီ၏ နှုန်းထားအတိအကျဖြင့် တွက်ချက်ထားပြီး၊ လစဉ် WiFi ကြေး၊ ဒဏ်ကြေးနှင့် အခြားဖြတ်တောက်ငွေများ နှုတ်၍ လကုန်လစာ တန်းရှင်းနိုင်ပါသည်
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto">
            <button
              type="button"
              onClick={() => setShowRateReferenceModal(true)}
              className="px-3.5 py-2 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 rounded-xl text-xs font-black flex items-center gap-1.5 transition"
            >
              <Sliders className="w-4 h-4 text-[#123524]" /> နှုန်းထားဇယား ကြည့်ရန်
            </button>
            <button
              type="button"
              onClick={handleExportPayrollExcel}
              className="px-3.5 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 rounded-xl text-xs font-black flex items-center gap-1.5 transition shadow-2xs"
            >
              <Download className="w-4 h-4" /> Export Payroll Excel
            </button>
            <button
              type="button"
              onClick={handleExportDetailedServiceLogsExcel}
              className="px-3.5 py-2 bg-[#123524] hover:bg-[#1a4a32] text-[#D4AF37] rounded-xl text-xs font-black flex items-center gap-1.5 transition shadow-sm"
            >
              <FileSpreadsheet className="w-4 h-4" /> Export Detailed Service Logs
            </button>
          </div>
        </div>

        {/* Filter Bar: Month Picker, Search & Global 1-Click Default WiFi Fee */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-3.5 items-end">
          <div className="lg:col-span-3">
            <label className="block text-[10px] font-extrabold text-gray-500 uppercase tracking-wider mb-1">
              လစာထုတ်မည့် လ ရွေးချယ်ရန် (Payroll Month)
            </label>
            <input
              type="month"
              value={selectedMonth}
              onChange={(e) => e.target.value && setSelectedMonth(e.target.value)}
              className="w-full p-2.5 bg-gray-50 border border-gray-300 rounded-xl text-xs font-black text-[#123524] outline-none focus:border-[#D4AF37]"
            />
          </div>

          <div className="lg:col-span-4">
            <label className="block text-[10px] font-extrabold text-gray-500 uppercase tracking-wider mb-1">
              ဝန်ထမ်း ရှာဖွေရန် (Search Staff / ID / Seniority)
            </label>
            <div className="relative">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="ဥပမာ - Therapist No-1, SGL-001, Senior..."
                className="w-full pl-9 pr-4 py-2.5 bg-gray-50 border border-gray-300 rounded-xl text-xs font-bold outline-none focus:border-[#D4AF37]"
              />
              <Search className="w-4 h-4 text-gray-400 absolute left-3 top-2.5" />
            </div>
          </div>

          {/* 🌟 1-CLICK GLOBAL DEFAULT MONTHLY WIFI FEE BAR 🌟 */}
          <div className="lg:col-span-5 bg-red-50/60 border border-red-200 p-2.5 rounded-xl">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[10px] font-black text-red-800 uppercase flex items-center gap-1">
                <Wifi className="w-3.5 h-3.5 text-red-600" />
                ဝန်ထမ်းအားလုံး၏ Default လစဉ် WiFi ကြေး (1-Click Change):
              </span>
              <button
                type="button"
                onClick={() => handleUpdateGlobalWifiFee(payrollDocData.defaultWifiFee, true)}
                className="text-[9px] font-bold text-blue-700 hover:underline flex items-center gap-0.5"
                title="ဝန်ထမ်းအားလုံးကို Default WiFi ကြေးအတိုင်း ပြန်ညှိမည်"
              >
                <RotateCcw className="w-2.5 h-2.5" /> Apply to All
              </button>
            </div>
            <div className="flex flex-wrap items-center gap-1">
              {WIFI_PRESETS.map((amt) => {
                const isSelected = payrollDocData.defaultWifiFee === amt;
                return (
                  <button
                    key={amt}
                    type="button"
                    onClick={() => handleUpdateGlobalWifiFee(amt, true)}
                    className={`px-2 py-1 rounded-lg text-[10px] font-black transition border ${
                      isSelected
                        ? 'bg-red-600 text-white border-red-600 shadow-2xs'
                        : 'bg-white text-gray-700 border-gray-300 hover:border-red-400'
                    }`}
                  >
                    {amt === 0 ? '0 Ks' : `${(amt / 1000).toFixed(0)}k`}
                  </button>
                );
              })}
              <div className="flex items-center gap-1 ml-auto">
                <input
                  type="number"
                  step={1000}
                  value={customGlobalWifiInput}
                  onChange={(e) => setCustomGlobalWifiInput(e.target.value)}
                  onBlur={() => handleUpdateGlobalWifiFee(Number(customGlobalWifiInput) || 0, false)}
                  className="w-20 px-2 py-1 bg-white border border-red-300 rounded-lg text-[11px] font-black text-red-700 text-center outline-none"
                />
                <span className="text-[10px] font-bold text-red-700">Ks</span>
              </div>
            </div>
          </div>
        </div>

        {/* 5 Summary Executive KPI Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 pt-2">
          <div className="p-3.5 rounded-2xl bg-gray-50 border border-gray-200">
            <div className="text-[10px] font-bold text-gray-500 uppercase">Total Completed Sections</div>
            <div className="text-lg font-black text-[#123524] mt-1">{globalTotals.totalSections} Sec</div>
          </div>
          <div className="p-3.5 rounded-2xl bg-blue-50/60 border border-blue-200">
            <div className="text-[10px] font-bold text-blue-800 uppercase">Total Service Sales</div>
            <div className="text-lg font-black text-blue-900 mt-1">{formatPrice(globalTotals.totalSales)}</div>
          </div>
          <div className="p-3.5 rounded-2xl bg-emerald-50/70 border border-emerald-200">
            <div className="text-[10px] font-bold text-emerald-800 uppercase">Total Exact Commissions</div>
            <div className="text-lg font-black text-emerald-800 mt-1">{formatPrice(globalTotals.totalCommission)}</div>
          </div>
          <div className="p-3.5 rounded-2xl bg-red-50/70 border border-red-200">
            <div className="text-[10px] font-bold text-red-700 uppercase">Total Fines, WiFi & Deductions</div>
            <div className="text-lg font-black text-red-600 mt-1">-{formatPrice(globalTotals.totalDeductions)}</div>
          </div>
          <div className="col-span-2 sm:col-span-1 p-3.5 rounded-2xl bg-gradient-to-br from-[#123524] to-[#1a4a32] text-white border border-[#D4AF37]/50 shadow-sm">
            <div className="text-[10px] font-bold text-[#D4AF37] uppercase">Total Net Payroll Payout</div>
            <div className="text-lg font-black text-white mt-1">{formatPrice(globalTotals.totalNetPay)}</div>
          </div>
        </div>
      </div>

      {/* =========================================================================
          MAIN PAYROLL TABLE & EXPANDABLE SERVICE-BY-SERVICE BREAKDOWN
         ========================================================================= */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[1050px]">
            <thead>
              <tr className="bg-[#123524] text-[#D4AF37] text-[11px] uppercase tracking-wider">
                <th className="p-3.5">Staff ID & Name</th>
                <th className="p-3.5 text-center">Rank Level</th>
                <th className="p-3.5 text-center">Sections</th>
                <th className="p-3.5 text-right">Service Commission</th>
                <th className="p-3.5 text-right">Salary / Bonus</th>
                <th className="p-3.5 text-right">Fines & Loans</th>
                <th className="p-3.5 text-right">WiFi & Custom Deductions</th>
                <th className="p-3.5 text-right">Net Payable</th>
                <th className="p-3.5 text-center">Status (နှိပ်၍ပြောင်းရန်)</th>
                <th className="p-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-xs">
              {filteredRows.map((row) => {
                const isExpanded = selectedStaffForDetail === row.staffName;
                return (
                  <React.Fragment key={row.staffName}>
                    <tr className={`hover:bg-gray-50/90 transition ${isExpanded ? 'bg-yellow-50/40' : ''}`}>
                      {/* 1. Staff ID & Name */}
                      <td className="p-3.5">
                        <div className="flex items-center gap-2.5">
                          <span className="font-mono text-[10px] font-black bg-gray-100 text-gray-700 px-2 py-1 rounded border border-gray-200">
                            {row.shortId}
                          </span>
                          <div>
                            <div className="font-black text-sm text-[#123524]">{row.staffName}</div>
                            <div className="text-[10px] text-gray-400 font-semibold">
                              Sales: {formatPrice(row.totalSalesAmount)}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* 2. Seniority Badge */}
                      <td className="p-3.5 text-center">
                        <button
                          type="button"
                          onClick={() => handleToggleSeniority(row.staffName, row.seniority)}
                          title="Click to switch between Senior & Junior rate"
                          className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border transition ${
                            row.seniority === 'Senior'
                              ? 'bg-amber-100 text-amber-900 border-amber-300 hover:bg-amber-200'
                              : 'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100'
                          }`}
                        >
                          {row.seniority === 'Senior' ? '★ Senior' : 'Junior'}
                        </button>
                      </td>

                      {/* 3. Completed Sections */}
                      <td className="p-3.5 text-center">
                        <span className="font-black text-xs bg-emerald-50 text-emerald-800 border border-emerald-200 px-2.5 py-1 rounded-lg">
                          {row.sectionsCount} Sec
                        </span>
                      </td>

                      {/* 4. Exact Service Commission */}
                      <td className="p-3.5 text-right">
                        <div className="font-black text-sm text-emerald-700">
                          {formatPrice(row.totalServiceCommission)}
                        </div>
                        <button
                          type="button"
                          onClick={() => setSelectedStaffForDetail(isExpanded ? null : row.staffName)}
                          className="text-[10px] font-bold text-blue-600 hover:underline inline-flex items-center mt-0.5"
                        >
                          {isExpanded ? 'Hide Details ▲' : 'Service အသေးစိတ် ▼'}
                        </button>
                      </td>

                      {/* 5. Base Salary & Bonus */}
                      <td className="p-3.5 text-right">
                        <div className="font-bold text-gray-800">{formatPrice(row.baseSalary + row.bonus)}</div>
                        {(row.baseSalary > 0 || row.bonus > 0) && (
                          <div className="text-[9px] text-gray-400">
                            Sal: {formatPrice(row.baseSalary)} | Bon: {formatPrice(row.bonus)}
                          </div>
                        )}
                      </td>

                      {/* 6. System Fines & Loans */}
                      <td className="p-3.5 text-right">
                        <div
                          className={`font-bold ${
                            row.systemFinesTotal + row.systemLoansTotal > 0 ? 'text-red-600' : 'text-gray-400'
                          }`}
                        >
                          -{formatPrice(row.systemFinesTotal + row.systemLoansTotal)}
                        </div>
                        {(row.systemFinesTotal > 0 || row.systemLoansTotal > 0) && (
                          <div className="text-[9px] text-red-400">
                            Fine: {formatPrice(row.systemFinesTotal)} | Loan: {formatPrice(row.systemLoansTotal)}
                          </div>
                        )}
                      </td>

                      {/* 🌟 7. WiFi & Custom Deductions (Clickable for quick 1-click edit) 🌟 */}
                      <td className="p-3.5 text-right">
                        <button
                          type="button"
                          onClick={() =>
                            handleOpenAdjustmentModal(row.staffName, payrollDocData.adjustments[row.staffName])
                          }
                          title="နှိပ်၍ WiFi ကြေး နှင့် အခြားဖြတ်တောက်ငွေများ ပြင်ဆင်ရန်"
                          className="text-right group ml-auto block"
                        >
                          <div
                            className={`font-black group-hover:underline ${
                              row.customDeductionsTotal > 0 ? 'text-red-600' : 'text-gray-400'
                            }`}
                          >
                            -{formatPrice(row.customDeductionsTotal)}
                          </div>
                          {row.allCustomDeductionLabels.length > 0 && (
                            <div
                              className="text-[9px] text-gray-500 truncate max-w-[160px] ml-auto"
                              title={row.allCustomDeductionLabels.map((d) => `${d.reason} (${formatPrice(d.amount)})`).join(', ')}
                            >
                              {row.allCustomDeductionLabels.map((d) => d.reason).join(', ')}
                            </div>
                          )}
                        </button>
                      </td>

                      {/* 8. Final Net Payable */}
                      <td className="p-3.5 text-right">
                        <div className={`text-sm font-black ${row.netPayable >= 0 ? 'text-[#123524]' : 'text-red-600'}`}>
                          {formatPrice(row.netPayable)}
                        </div>
                      </td>

                      {/* 🌟 9. Reversible Paid / Unpaid Status Button 🌟 */}
                      <td className="p-3.5 text-center">
                        <button
                          type="button"
                          onClick={() => handleToggleSettledStatus(row.staffName, row.isPaidSettled)}
                          title={
                            row.isPaidSettled
                              ? 'နှိပ်ပါက "မရှင်းရသေး (Unpaid)" သို့ ပြန်ပြောင်းပါမည်'
                              : 'နှိပ်ပါက "ရှင်းပြီး (Paid)" အဖြစ် သတ်မှတ်ပါမည်'
                          }
                          className={`px-3 py-1.5 rounded-full text-[10px] font-black uppercase transition cursor-pointer ${
                            row.isPaidSettled
                              ? 'bg-emerald-600 hover:bg-amber-600 text-white shadow-xs'
                              : 'bg-gray-100 text-gray-600 hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-300 border border-gray-300'
                          }`}
                        >
                          {row.isPaidSettled ? '✓ ရှင်းပြီး (PAID)' : 'မရှင်းရသေး'}
                        </button>
                      </td>

                      {/* 10. Actions */}
                      <td className="p-3.5 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() =>
                              handleOpenAdjustmentModal(row.staffName, payrollDocData.adjustments[row.staffName])
                            }
                            className="px-2.5 py-1.5 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 rounded-lg text-[10px] font-black transition whitespace-nowrap"
                          >
                            + ဖြတ်တောက်ငွေ / Bonus
                          </button>
                          <button
                            type="button"
                            onClick={() => setSelectedStaffForDetail(isExpanded ? null : row.staffName)}
                            className="px-2.5 py-1.5 bg-[#123524]/10 hover:bg-[#123524] text-[#123524] hover:text-[#D4AF37] rounded-lg text-[10px] font-black transition whitespace-nowrap"
                          >
                            {isExpanded ? 'ပိတ်မည်' : 'စာရင်းချုပ်'}
                          </button>
                        </div>
                      </td>
                    </tr>

                    {/* =====================================================================
                        EXPANDED ROW: DETAILED SERVICE-BY-SERVICE COMMISSION BREAKDOWN & SLIP
                       ===================================================================== */}
                    {isExpanded && (
                      <tr className="bg-gradient-to-b from-yellow-50/50 to-gray-50/80 border-b-2 border-[#D4AF37]/40">
                        <td colSpan={10} className="p-5">
                          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
                            {/* Left 5 Cols: Service-by-Service Summary Table */}
                            <div className="lg:col-span-5 bg-white p-4 rounded-2xl border border-gray-200 shadow-2xs space-y-3">
                              <div className="flex items-center justify-between border-b border-gray-100 pb-2.5">
                                <div>
                                  <h4 className="font-black text-xs text-[#123524] uppercase tracking-wider">
                                    ၁။ ဝန်ဆောင်မှုအမျိုးအစားအလိုက် ရရှိသော ကော်မရှင်စာရင်းချုပ်
                                  </h4>
                                  <p className="text-[10px] text-gray-500">
                                    {row.staffName} ({row.seniority} Rate) — {selectedMonth}
                                  </p>
                                </div>
                                <span className="text-xs font-black text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200">
                                  Total: {formatPrice(row.totalServiceCommission)}
                                </span>
                              </div>

                              {row.serviceBreakdownList.length === 0 ? (
                                <div className="py-8 text-center text-gray-400 font-bold text-xs">
                                  ဤလအတွက် ကော်မရှင်ရရှိသော ဝန်ဆောင်မှု မရှိသေးပါ။
                                </div>
                              ) : (
                                <table className="w-full text-left border-collapse text-xs">
                                  <thead>
                                    <tr className="border-b border-gray-100 text-[10px] text-gray-400 uppercase">
                                      <th className="py-2">Service Name</th>
                                      <th className="py-2 text-center">အကြိမ်ရေ</th>
                                      <th className="py-2 text-right">၁ ကြိမ်နှုန်း</th>
                                      <th className="py-2 text-right">စုစုပေါင်း</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-gray-50 font-semibold">
                                    {row.serviceBreakdownList.map((s, idx) => (
                                      <tr key={idx}>
                                        <td className="py-2 font-bold text-gray-800">{s.ruleName}</td>
                                        <td className="py-2 text-center">
                                          <span className="bg-gray-100 px-2 py-0.5 rounded font-black text-[#123524]">
                                            {s.count} Sec
                                          </span>
                                        </td>
                                        <td className="py-2 text-right text-gray-500">{formatPrice(s.unitComm)}</td>
                                        <td className="py-2 text-right font-black text-emerald-700">
                                          {formatPrice(s.totalComm)}
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              )}

                              {/* Deductions & Net Pay Slip Box */}
                              <div className="pt-3 border-t border-dashed border-gray-200 space-y-1.5 text-xs">
                                <div className="flex justify-between text-gray-600">
                                  <span>စုစုပေါင်း ကော်မရှင် (Service Commissions):</span>
                                  <strong className="text-emerald-700">+{formatPrice(row.totalServiceCommission)}</strong>
                                </div>
                                {row.baseSalary > 0 && (
                                  <div className="flex justify-between text-gray-600">
                                    <span>အခြေခံလစာ (Base Salary):</span>
                                    <strong>+{formatPrice(row.baseSalary)}</strong>
                                  </div>
                                )}
                                {row.bonus > 0 && (
                                  <div className="flex justify-between text-blue-700">
                                    <span>အပိုဆုကြေး (Bonus):</span>
                                    <strong>+{formatPrice(row.bonus)}</strong>
                                  </div>
                                )}
                                {row.systemFinesTotal > 0 && (
                                  <div className="flex justify-between text-red-600">
                                    <span>ဒဏ်ကြေး (System Fines):</span>
                                    <strong>-{formatPrice(row.systemFinesTotal)}</strong>
                                  </div>
                                )}
                                {row.systemLoansTotal > 0 && (
                                  <div className="flex justify-between text-red-600">
                                    <span>ကြိုထုတ်ချေးငွေ (Staff Loans):</span>
                                    <strong>-{formatPrice(row.systemLoansTotal)}</strong>
                                  </div>
                                )}
                                {row.allCustomDeductionLabels.map((cd) => (
                                  <div key={cd.id} className="flex justify-between text-red-600">
                                    <span>ဖြတ်တောက်ငွေ — {cd.reason}:</span>
                                    <strong>-{formatPrice(cd.amount)}</strong>
                                  </div>
                                ))}
                                <div className="flex justify-between items-center pt-2 border-t border-gray-200 text-sm font-black text-[#123524]">
                                  <span>အသားတင် ပေးချေရမည့်ငွေ (NET PAYABLE):</span>
                                  <span className="text-base text-[#123524] bg-yellow-100 px-3 py-1 rounded-xl border border-[#D4AF37]">
                                    {formatPrice(row.netPayable)}
                                  </span>
                                </div>
                              </div>
                            </div>

                            {/* Right 7 Cols: Chronological Daily Service Commission Logs */}
                            <div className="lg:col-span-7 bg-white p-4 rounded-2xl border border-gray-200 shadow-2xs flex flex-col">
                              <div className="flex items-center justify-between border-b border-gray-100 pb-2.5 mb-3">
                                <h4 className="font-black text-xs text-[#123524] uppercase tracking-wider">
                                  ၂။ ရက်စွဲနှင့် ဘောင်ချာတစ်စောင်ချင်းစီအလိုက် ကော်မရှင်မှတ်တမ်း ({row.bookingLogs.length} Sec)
                                </h4>
                              </div>

                              <div className="overflow-y-auto max-h-80 pr-1 space-y-2">
                                {row.bookingLogs.length === 0 ? (
                                  <div className="py-12 text-center text-gray-400 font-bold text-xs">
                                    မှတ်တမ်း မရှိသေးပါ။
                                  </div>
                                ) : (
                                  row.bookingLogs.map((log, lIdx) => (
                                    <div
                                      key={lIdx}
                                      className="p-3 rounded-xl bg-gray-50 border border-gray-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"
                                    >
                                      <div className="space-y-1">
                                        <div className="flex items-center gap-2">
                                          <span className="font-mono font-bold text-[11px] bg-[#123524] text-[#D4AF37] px-2 py-0.5 rounded">
                                            {log.date}
                                          </span>
                                          <span className="font-mono font-black text-gray-700">{log.txId}</span>
                                          <span className="text-[11px] text-gray-500">• {log.customerName}</span>
                                        </div>
                                        <div className="text-[11px] font-bold text-gray-800">{log.rawService}</div>
                                        <div className="flex flex-wrap gap-1.5">
                                          {log.items.map((it, iIdx) => (
                                            <span
                                              key={iIdx}
                                              className="text-[10px] font-black bg-emerald-50 text-emerald-800 border border-emerald-200 px-2 py-0.5 rounded"
                                            >
                                              ✓ {it.matchedRuleName}: +{formatPrice(it.totalCommission)}
                                            </span>
                                          ))}
                                        </div>
                                      </div>
                                      <div className="text-right flex-shrink-0 border-t sm:border-t-0 pt-1.5 sm:pt-0">
                                        <div className="text-[10px] text-gray-400 font-bold">Bill: {formatPrice(log.salesShare)}</div>
                                        <div className="text-xs font-black text-emerald-700">
                                          Comm: +{formatPrice(log.commissionEarned)}
                                        </div>
                                      </div>
                                    </div>
                                  ))
                                )}
                              </div>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
