import React, { useState, useEffect, useMemo } from 'react';
import {
  collection,
  onSnapshot,
  addDoc,
  deleteDoc,
  updateDoc,
  doc,
  getDoc,
  setDoc,
  query,
  orderBy
} from 'firebase/firestore';
import { db } from '../firebase';
import {
  Calendar,
  Wallet,
  Banknote,
  Trash2,
  X,
  CheckCircle,
  Search,
  AlertTriangle,
  ShieldAlert,
  ArrowUpRight,
  ArrowDownRight,
  Download,
  PlusCircle,
  UserCheck,
  Clock,
  Sparkles,
  CheckCircle2,
  FileSpreadsheet,
  RefreshCw,
  Layers,
  Send
} from 'lucide-react';
import { THEME, formatPrice } from '../shared';
import { notifyStaffUpdate } from '../telegramService';
import { isSameStaffMember } from './StaffPayrollSystem';

const CATEGORIES = [
  'ဆိုင်သန့်ရှင်းရေးတာဝန် ပျက်ကွက်ခြင်း',
  'Out Pass စည်းကမ်းများ',
  'Jibble Clock In/ Clock Out စည်းကမ်းများ',
  'ဆူညံခြင်း၊ ဂိမ်းကစားခြင်း၊ စလော့ဆော့ခြင်း',
  'ဧည့်သည်အား ဝန်ဆောင်မှုအားနည်းခြင်း',
  'စည်းကမ်းမဲ့ ဆေးလိပ်၊ အရက်၊ မူးယစ်ဆေးသုံးခြင်း၊ ဝန်ထမ်းအချင်းချင်း ရန်ဖြစ်ခြင်း',
  'မီးဖိုချောင်စည်းကမ်း ဖောက်ဖျက်ခြင်း',
  'အိပ်ချိန်စည်းကမ်း ဖောက်ဖျက်ခြင်း',
  'အခြား ဖောက်ဖျက်မှုများ'
];

const QUICK_PENALTY_AMOUNTS = [5000, 10000, 15000, 20000, 30000, 50000];
const QUICK_DEPOSIT_AMOUNTS = [30000, 50000, 100000, 150000, 200000, 300000];
const QUICK_LOAN_AMOUNTS = [10000, 20000, 30000, 50000, 100000, 150000];

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

// Helper functions
export const getDaysOverdue = (dateStr: string) => {
  if (!dateStr) return 0;
  const dToday = new Date();
  dToday.setHours(0, 0, 0, 0);
  const pDate = new Date(dateStr);
  if (isNaN(pDate.getTime())) return 0;
  pDate.setHours(0, 0, 0, 0);
  const diffTime = dToday.getTime() - pDate.getTime();
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
  return diffDays > 0 ? diffDays : 0;
};

export const calculateAmount = (p: any) => {
  if (p.isPaid) return Number(p.finalAmount || p.amount) || 0;
  if (p.disableDoubling) return Number(p.amount) || 0;
  const days = getDaysOverdue(p.date);
  return (Number(p.amount) || 0) * Math.pow(2, days);
};

// Helper: Push a deduction item directly into `settings/payroll_YYYY-MM` so Staff Pay Roll Tab receives it automatically
async function syncDeductionToStaffPayrollDoc(
  yearMonth: string,
  staffName: string,
  deductionId: string,
  reason: string,
  amount: number
) {
  const cleanStaffName = String(staffName || '').trim();
  if (!cleanStaffName || !yearMonth || amount <= 0) return;

  const payrollRef = doc(db, 'settings', `payroll_${yearMonth}`);
  const snap = await getDoc(payrollRef);
  const existingData = snap.exists() ? (snap.data() as any) : {};
  const adjustments = { ...(existingData.adjustments || {}) };

  const staffAdj = adjustments[cleanStaffName] || {
    baseSalary: 0,
    bonus: 0,
    customDeductions: [],
    note: '',
    isPaidSettled: false
  };

  const currentDeductions: any[] = Array.isArray(staffAdj.customDeductions)
    ? [...staffAdj.customDeductions]
    : [];

  // Prevent duplicate entry with same ID
  const filtered = currentDeductions.filter((d) => d.id !== deductionId);
  filtered.push({
    id: deductionId,
    reason,
    amount: Math.round(amount)
  });

  adjustments[cleanStaffName] = {
    ...staffAdj,
    customDeductions: filtered
  };

  await setDoc(
    payrollRef,
    {
      yearMonth,
      adjustments,
      updatedAt: Date.now()
    },
    { merge: true }
  );
}

// ============================================================================
// 🌟 1. ADMIN PENALTY, DEPOSIT & LOAN LUXURY MANAGEMENT STUDIO 🌟
// ============================================================================
export function AdminPenaltyManager({ therapists }: { therapists: any[] }) {
  const uniqueTherapists = useMemo(() => {
    return Array.from(
      new Map(
        (therapists || [])
          .filter((t) => t.name && t.name.trim() !== '')
          .map((t) => [t.name.trim(), t])
      ).values()
    );
  }, [therapists]);

  const todayStr = getLocalTodayStr();
  const todayObj = new Date();
  const currentYear = todayObj.getFullYear();
  const currentMonth = String(todayObj.getMonth() + 1).padStart(2, '0');
  const currentYearMonth = `${currentYear}-${currentMonth}`;
  const lastDayOfMonth = new Date(currentYear, todayObj.getMonth() + 1, 0).getDate();

  const prevMonthObj = new Date(currentYear, todayObj.getMonth() - 1, 1);
  const prevYearMonth = `${prevMonthObj.getFullYear()}-${String(
    prevMonthObj.getMonth() + 1
  ).padStart(2, '0')}`;
  const prevMonthLastDay = new Date(
    prevMonthObj.getFullYear(),
    prevMonthObj.getMonth() + 1,
    0
  ).getDate();

  const [subTab, setSubTab] = useState<'dashboard' | 'add' | 'history' | 'deposits' | 'loans'>(
    'dashboard'
  );
  const [penalties, setPenalties] = useState<any[]>([]);
  const [deposits, setDeposits] = useState<any[]>([]);
  const [loans, setLoans] = useState<any[]>([]);
  const [selectedTherapistId, setSelectedTherapistId] = useState<string | null>(null);
  const [modalActiveTab, setModalActiveTab] = useState<'penalties' | 'deposits' | 'loans'>(
    'penalties'
  );

  // Date & Period Filter States
  const [periodPreset, setPeriodPreset] = useState<
    'this_month' | 'last_month' | 'today' | 'all_time' | 'custom'
  >('this_month');
  const [startDate, setStartDate] = useState(`${currentYearMonth}-01`);
  const [endDate, setEndDate] = useState(
    `${currentYearMonth}-${String(lastDayOfMonth).padStart(2, '0')}`
  );
  const [targetPayrollMonth, setTargetPayrollMonth] = useState<string>(prevYearMonth);

  // Search & Staff Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [historyFilter, setHistoryFilter] = useState('');
  const [penaltyStatusFilter, setPenaltyStatusFilter] = useState<'all' | 'unpaid' | 'paid'>('all');
  const [depositFilter, setDepositFilter] = useState('');
  const [loanFilter, setLoanFilter] = useState('');
  const [isSyncingPayroll, setIsSyncingPayroll] = useState<string | null>(null);

  // Forms
  const [formData, setFormData] = useState({
    therapistId: uniqueTherapists[0]?.id || '1',
    category: CATEGORIES[0],
    amount: '',
    remark: '',
    date: todayStr,
    disableDoubling: false
  });

  const [depositForm, setDepositForm] = useState({
    therapistId: uniqueTherapists[0]?.id || '1',
    amount: '',
    date: todayStr,
    txType: 'deposit' as 'deposit' | 'withdraw',
    note: ''
  });

  const [loanForm, setLoanForm] = useState({
    therapistId: uniqueTherapists[0]?.id || '1',
    amount: '',
    note: '',
    date: todayStr,
    type: 'borrow' as 'borrow' | 'repay',
    repayMethod: 'salary' as 'cash' | 'salary',
    payrollMonth: prevYearMonth
  });

  useEffect(() => {
    if (uniqueTherapists.length > 0) {
      setFormData((prev) => ({
        ...prev,
        therapistId: prev.therapistId || uniqueTherapists[0].id
      }));
      setDepositForm((prev) => ({
        ...prev,
        therapistId: prev.therapistId || uniqueTherapists[0].id
      }));
      setLoanForm((prev) => ({
        ...prev,
        therapistId: prev.therapistId || uniqueTherapists[0].id
      }));
    }
  }, [uniqueTherapists]);

  useEffect(() => {
    const unsubP = onSnapshot(
      query(collection(db, 'penalties'), orderBy('createdAt', 'desc')),
      (snap) => setPenalties(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
    );
    const unsubD = onSnapshot(
      query(collection(db, 'deposits'), orderBy('createdAt', 'desc')),
      (snap) => setDeposits(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
    );
    const unsubL = onSnapshot(
      query(collection(db, 'loans'), orderBy('createdAt', 'desc')),
      (snap) => setLoans(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
    );
    return () => {
      unsubP();
      unsubD();
      unsubL();
    };
  }, []);

  // Apply Period Preset
  const handleSelectPeriodPreset = (
    preset: 'this_month' | 'last_month' | 'today' | 'all_time'
  ) => {
    setPeriodPreset(preset);
    if (preset === 'this_month') {
      setStartDate(`${currentYearMonth}-01`);
      setEndDate(`${currentYearMonth}-${String(lastDayOfMonth).padStart(2, '0')}`);
      setTargetPayrollMonth(currentYearMonth);
    } else if (preset === 'last_month') {
      setStartDate(`${prevYearMonth}-01`);
      setEndDate(`${prevYearMonth}-${String(prevMonthLastDay).padStart(2, '0')}`);
      setTargetPayrollMonth(prevYearMonth);
    } else if (preset === 'today') {
      setStartDate(todayStr);
      setEndDate(todayStr);
    } else if (preset === 'all_time') {
      setStartDate('');
      setEndDate('');
    }
  };

  // Match Staff Helper (Supports ID or Name matching seamlessly with Payroll)
  const matchesStaff = (record: any, staffId: string, staffName: string) => {
    if (!record) return false;
    if (String(record.therapistId) === String(staffId)) return true;
    return isSameStaffMember(record.therapistName || '', staffName, staffId);
  };

  // Filtered Lists by Date, Staff & Search
  const filteredPenalties = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const selectedStaffObj = uniqueTherapists.find((t) => String(t.id) === String(historyFilter));

    return penalties.filter((p) => {
      if (startDate && p.date < startDate) return false;
      if (endDate && p.date > endDate) return false;
      if (historyFilter && selectedStaffObj) {
        if (!matchesStaff(p, selectedStaffObj.id, selectedStaffObj.name)) return false;
      }
      if (penaltyStatusFilter === 'unpaid' && p.isPaid) return false;
      if (penaltyStatusFilter === 'paid' && !p.isPaid) return false;
      if (q) {
        const matchText =
          String(p.therapistName || '').toLowerCase().includes(q) ||
          String(p.category || '').toLowerCase().includes(q) ||
          String(p.remark || '').toLowerCase().includes(q) ||
          String(p.date || '').includes(q);
        if (!matchText) return false;
      }
      return true;
    });
  }, [penalties, startDate, endDate, historyFilter, penaltyStatusFilter, searchQuery, uniqueTherapists]);

  const filteredDeposits = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const selectedStaffObj = uniqueTherapists.find((t) => String(t.id) === String(depositFilter));

    return deposits.filter((d) => {
      if (startDate && d.date < startDate) return false;
      if (endDate && d.date > endDate) return false;
      if (depositFilter && selectedStaffObj) {
        if (!matchesStaff(d, selectedStaffObj.id, selectedStaffObj.name)) return false;
      }
      if (q) {
        const matchText =
          String(d.therapistName || '').toLowerCase().includes(q) ||
          String(d.note || '').toLowerCase().includes(q) ||
          String(d.date || '').includes(q);
        if (!matchText) return false;
      }
      return true;
    });
  }, [deposits, startDate, endDate, depositFilter, searchQuery, uniqueTherapists]);

  const filteredLoans = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const selectedStaffObj = uniqueTherapists.find((t) => String(t.id) === String(loanFilter));

    return loans.filter((l) => {
      if (startDate && l.date < startDate) return false;
      if (endDate && l.date > endDate) return false;
      if (loanFilter && selectedStaffObj) {
        if (!matchesStaff(l, selectedStaffObj.id, selectedStaffObj.name)) return false;
      }
      if (q) {
        const matchText =
          String(l.therapistName || '').toLowerCase().includes(q) ||
          String(l.note || '').toLowerCase().includes(q) ||
          String(l.date || '').includes(q);
        if (!matchText) return false;
      }
      return true;
    });
  }, [loans, startDate, endDate, loanFilter, searchQuery, uniqueTherapists]);

  // Calculate Individual Staff Stats
  const getStats = (id: string, name: string) => {
    const pAll = penalties.filter((item) => matchesStaff(item, id, name));
    const pPeriod = filteredPenalties.filter((item) => matchesStaff(item, id, name));

    const unpaidAll = pAll.filter((item) => !item.isPaid);
    const paidAll = pAll.filter((item) => item.isPaid);

    const totalUnpaid = unpaidAll.reduce((sum, item) => sum + calculateAmount(item), 0);
    const totalPaid = paidAll.reduce((sum, item) => sum + calculateAmount(item), 0);
    const overdueCount = unpaidAll.filter((item) => getDaysOverdue(item.date) > 0).length;

    const dAll = deposits.filter((item) => matchesStaff(item, id, name));
    const depositBalance = dAll.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
    const totalDepositedIn = dAll
      .filter((item) => Number(item.amount) > 0)
      .reduce((sum, item) => sum + Number(item.amount), 0);
    const totalDepositDeducted = dAll
      .filter((item) => Number(item.amount) < 0)
      .reduce((sum, item) => sum + Math.abs(Number(item.amount)), 0);

    const lAll = loans.filter((item) => matchesStaff(item, id, name));
    const totalLoan = Math.max(
      0,
      lAll.reduce((sum, item) => sum + (Number(item.amount) || 0), 0)
    );

    return {
      count: pAll.length,
      unpaidCount: unpaidAll.length,
      overdueCount,
      totalUnpaid,
      totalPaid,
      depositBalance,
      totalDepositedIn,
      totalDepositDeducted,
      totalLoan,
      list: pAll,
      periodPenaltyList: pPeriod,
      depositList: dAll,
      loanList: lAll
    };
  };

  // Global Executive KPI Summary (For Overview Dashboard Banner)
  const globalSummary = useMemo(() => {
    let totalDepositsHeld = 0;
    let staffWithDepositsCount = 0;
    let totalUnpaidPenaltiesAmt = 0;
    let totalUnpaidPenaltiesCount = 0;
    let totalPaidPenaltiesAmt = 0;
    let totalActiveLoansAmt = 0;
    let staffWithLoansCount = 0;

    uniqueTherapists.forEach((t) => {
      const st = getStats(t.id, t.name);
      if (st.depositBalance > 0) {
        totalDepositsHeld += st.depositBalance;
        staffWithDepositsCount += 1;
      }
      if (st.totalUnpaid > 0) {
        totalUnpaidPenaltiesAmt += st.totalUnpaid;
        totalUnpaidPenaltiesCount += st.unpaidCount;
      }
      totalPaidPenaltiesAmt += st.totalPaid;
      if (st.totalLoan > 0) {
        totalActiveLoansAmt += st.totalLoan;
        staffWithLoansCount += 1;
      }
    });

    const periodDepositsAdded = filteredDeposits
      .filter((d) => Number(d.amount) > 0)
      .reduce((s, d) => s + Number(d.amount), 0);

    const periodDepositsUsed = filteredDeposits
      .filter((d) => Number(d.amount) < 0)
      .reduce((s, d) => s + Math.abs(Number(d.amount)), 0);

    return {
      totalDepositsHeld,
      staffWithDepositsCount,
      periodDepositsAdded,
      periodDepositsUsed,
      totalUnpaidPenaltiesAmt,
      totalUnpaidPenaltiesCount,
      totalPaidPenaltiesAmt,
      totalActiveLoansAmt,
      staffWithLoansCount,
      totalPayrollDeductionReady: totalUnpaidPenaltiesAmt + totalActiveLoansAmt
    };
  }, [uniqueTherapists, penalties, deposits, loans, filteredDeposits]);

  const selectedTherapistStats = useMemo(() => {
    if (!selectedTherapistId) return null;
    const tObj = uniqueTherapists.find((t) => String(t.id) === String(selectedTherapistId));
    if (!tObj) return null;
    return {
      ...tObj,
      ...getStats(tObj.id, tObj.name)
    };
  }, [selectedTherapistId, uniqueTherapists, penalties, deposits, loans]);

  // ============================================================================
  // 🌟 ACTION HANDLERS (PENALTIES, DEPOSITS, LOANS & PAYROLL SYNC) 🌟
  // ============================================================================
  const handleSubmitPenalty = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.amount) return alert('ပမာဏဖြည့်ပါ');
    const tObj = uniqueTherapists.find((t) => String(t.id) === String(formData.therapistId));
    const targetStaffName = tObj?.name || 'Unknown';
    const penaltyAmountNum = Number(formData.amount);

    await addDoc(collection(db, 'penalties'), {
      ...formData,
      amount: penaltyAmountNum,
      therapistName: targetStaffName,
      isPaid: false,
      createdAt: Date.now()
    });

    notifyStaffUpdate({
      type: 'PENALTY_ISSUED',
      staffId: formData.therapistId,
      staffName: targetStaffName,
      title: '⚠️ စည်းကမ်းထိန်းသိမ်းရေး / ဒဏ်ကြေး သတိပေးချက် (Penalty Notice)',
      details: [
        `📋 အကြောင်းအရာ: ${formData.category}`,
        formData.remark ? `📝 မှတ်ချက်: ${formData.remark}` : null
      ]
        .filter(Boolean)
        .join('\n'),
      amount: penaltyAmountNum,
      effectiveDate: formData.date || todayStr,
      issuedBy: 'Management (Admin Panel)'
    }).catch((err) => console.warn('Telegram penalty alert error:', err));

    setFormData({ ...formData, amount: '', remark: '' });
    alert(`✅ ${targetStaffName} အတွက် ဒဏ်ကြေး (${formatPrice(penaltyAmountNum)}) မှတ်တမ်းတင်ပြီးပါပြီ။\n(Staff Pay Roll Tab တွင်လည်း အလိုအလျောက် ချိတ်ဆက်ပြီးဖြစ်ပါသည်)`);
    setSubTab('dashboard');
  };

  const handleSubmitDeposit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!depositForm.amount) return alert('ပမာဏဖြည့်ပါ');
    const tObj = uniqueTherapists.find((t) => String(t.id) === String(depositForm.therapistId));
    const targetStaffName = tObj?.name || 'Unknown';
    const rawAmt = Math.abs(Number(depositForm.amount));
    const currentStats = getStats(depositForm.therapistId, targetStaffName);

    if (depositForm.txType === 'withdraw' && rawAmt > currentStats.depositBalance) {
      return alert(
        `လက်ကျန်အပ်ငွေ (${formatPrice(currentStats.depositBalance)}) ထက် ကျော်လွန်၍ ထုတ်ယူ/နှုတ်ယူ၍ မရပါ။`
      );
    }

    const finalAmount = depositForm.txType === 'withdraw' ? -rawAmt : rawAmt;
    const defaultNote =
      depositForm.txType === 'withdraw' ? 'အပ်ငွေ ပြန်ထုတ်ပေးခြင်း / ဖြတ်တောက်ခြင်း' : 'အပ်ငွေသွင်းခြင်း';

    await addDoc(collection(db, 'deposits'), {
      therapistId: depositForm.therapistId,
      therapistName: targetStaffName,
      amount: finalAmount,
      date: depositForm.date || todayStr,
      type: depositForm.txType === 'withdraw' ? 'deduction' : 'deposit',
      note: depositForm.note.trim() || defaultNote,
      createdAt: Date.now()
    });

    notifyStaffUpdate({
      type: 'GENERAL_ANNOUNCEMENT',
      staffId: depositForm.therapistId,
      staffName: targetStaffName,
      title:
        depositForm.txType === 'withdraw'
          ? '📤 အပ်ငွေ ပြန်ထုတ်/ဖြတ်တောက်ခြင်း မှတ်တမ်း (Deposit Deduction)'
          : '💰 အပ်ငွေသွင်းခြင်း မှတ်တမ်း (Deposit Recorded)',
      details: `မှတ်ချက်: ${depositForm.note.trim() || defaultNote}`,
      amount: rawAmt,
      effectiveDate: depositForm.date || todayStr,
      issuedBy: 'Shop Accountant / Management'
    }).catch((err) => console.warn('Telegram deposit alert error:', err));

    setDepositForm({ ...depositForm, amount: '', note: '' });
    alert('✅ အပ်ငွေစာရင်း အောင်မြင်စွာ မှတ်တမ်းတင်ပြီးပါပြီ။');
  };

  const handleSubmitLoan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loanForm.amount) return alert('ပမာဏဖြည့်ပါ');
    const tObj = uniqueTherapists.find((t) => String(t.id) === String(loanForm.therapistId));
    const targetStaffName = tObj?.name || 'Unknown';
    const amountNum = Math.abs(Number(loanForm.amount));
    let finalAmount = amountNum;
    let finalNote = loanForm.note.trim();

    if (loanForm.type === 'repay') {
      const currentBalance = getStats(loanForm.therapistId, targetStaffName).totalLoan;
      if (amountNum > currentBalance) {
        return alert(
          `လက်ကျန် ကြိုထုတ်ငွေ (${formatPrice(currentBalance)}) ထက် ကျော်လွန်၍ ဆပ်၍မရပါ။`
        );
      }
      finalAmount = -amountNum;
      finalNote = !finalNote
        ? loanForm.repayMethod === 'cash'
          ? 'လက်ငင်းငွေဖြင့် ပြန်ဆပ်သည်'
          : `လစာထဲမှ နှုတ်၍ ပြန်ဆပ်သည် (${loanForm.payrollMonth})`
        : (loanForm.repayMethod === 'cash'
            ? '[လက်ငင်း] '
            : `[လစာဖြတ် ${loanForm.payrollMonth}] `) + finalNote;
    } else {
      if (!finalNote) finalNote = 'ကြိုထုတ်ငွေ (Staff Advance)';
    }

    const loanDocRef = await addDoc(collection(db, 'loans'), {
      therapistId: loanForm.therapistId,
      therapistName: targetStaffName,
      amount: finalAmount,
      date: loanForm.date || todayStr,
      type: loanForm.type,
      repayMethod: loanForm.type === 'repay' ? loanForm.repayMethod : null,
      payrollMonth: loanForm.type === 'repay' && loanForm.repayMethod === 'salary' ? loanForm.payrollMonth : null,
      note: finalNote,
      createdAt: Date.now()
    });

    // 🌟 If Repay via Salary is chosen, automatically sync to `settings/payroll_YYYY-MM`! 🌟
    if (loanForm.type === 'repay' && loanForm.repayMethod === 'salary') {
      await syncDeductionToStaffPayrollDoc(
        loanForm.payrollMonth || prevYearMonth,
        targetStaffName,
        `loan_repay_${loanDocRef.id}`,
        `ကြိုထုတ်ငွေ ပြန်ဆပ် (${loanForm.date}) - ${loanForm.note || 'Salary Deduction'}`,
        amountNum
      );
    }

    notifyStaffUpdate({
      type: 'GENERAL_ANNOUNCEMENT',
      staffId: loanForm.therapistId,
      staffName: targetStaffName,
      title:
        loanForm.type === 'borrow'
          ? '💸 ငွေကြိုထုတ်ယူမှု မှတ်တမ်း (Loan / Advance)'
          : '💵 ချေးငွေပြန်ဆပ်ပြီးစီးမှု မှတ်တမ်း (Loan Repayment)',
      details: `အမျိုးအစား: ${
        loanForm.type === 'borrow' ? 'ကြိုထုတ်ငွေ' : 'ပြန်ဆပ်ငွေ'
      }\nမှတ်ချက်: ${finalNote}`,
      amount: Math.abs(finalAmount),
      effectiveDate: loanForm.date || todayStr,
      issuedBy: 'Management (Admin Panel)'
    }).catch((err) => console.warn('Telegram loan alert error:', err));

    setLoanForm({ ...loanForm, amount: '', note: '' });
    alert(
      loanForm.type === 'repay' && loanForm.repayMethod === 'salary'
        ? `✅ ပြန်ဆပ်ငွေ မှတ်တမ်းတင်ပြီး Staff Pay Roll (${loanForm.payrollMonth}) စာရင်းထဲသို့ အလိုအလျောက် ချိတ်ဆက်နှုတ်ပေးပြီးပါပြီ!`
        : '✅ ကြိုထုတ်ငွေ / ပြန်ဆပ်ငွေ မှတ်တမ်းတင်ပြီးပါပြီ။'
    );
  };

  // Settle Penalty via Cash, Deposit, OR Direct Salary Deduction
  const handleMarkAsPaid = async (p: any, method: 'cash' | 'deposit' | 'salary') => {
    const currentAmt = calculateAmount(p);

    if (method === 'deposit') {
      const d = deposits.filter((item) => matchesStaff(item, p.therapistId, p.therapistName));
      const depositBalance = d.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
      if (depositBalance < currentAmt) {
        return alert(`အပ်ငွေလက်ကျန် (${formatPrice(depositBalance)}) မလုံလောက်ပါ။`);
      }

      if (
        window.confirm(
          `${p.therapistName} ၏ အပ်ငွေထဲမှ ဒဏ်ကြေး ${formatPrice(currentAmt)} နှုတ်ယူမည်မှာ သေချာပါသလား?`
        )
      ) {
        await addDoc(collection(db, 'deposits'), {
          therapistId: p.therapistId,
          therapistName: p.therapistName,
          amount: -currentAmt,
          date: todayStr,
          type: 'deduction',
          note: `${p.date} ရက်စွဲပါ ဒဏ်ကြေး (${p.category}) ဖြတ်တောက်ခြင်း`,
          createdAt: Date.now()
        });
        await updateDoc(doc(db, 'penalties', p.id), {
          isPaid: true,
          paidMethod: 'deposit',
          finalAmount: currentAmt,
          paidDate: todayStr
        });
      }
    } else if (method === 'salary') {
      const penaltyYm = String(p.date || targetPayrollMonth).substring(0, 7) || targetPayrollMonth;
      if (
        window.confirm(
          `${p.therapistName} ၏ ဒဏ်ကြေး (${formatPrice(
            currentAmt
          )}) ကို ${penaltyYm} လစာစာရင်း (Staff Pay Roll) ထဲမှ ဖြတ်တောက်ပြီးကြောင်း သတ်မှတ်မည်မှာ သေချာပါသလား?`
        )
      ) {
        await syncDeductionToStaffPayrollDoc(
          penaltyYm,
          p.therapistName,
          `penalty_${p.id}`,
          `ဒဏ်ကြေး (${p.date}): ${p.category}`,
          currentAmt
        );
        await updateDoc(doc(db, 'penalties', p.id), {
          isPaid: true,
          paidMethod: 'salary',
          finalAmount: currentAmt,
          paidDate: todayStr
        });
        alert(`✅ ${p.therapistName} ၏ ${penaltyYm} လစာစာရင်းထဲသို့ ဒဏ်ကြေး ${formatPrice(currentAmt)} ပေါင်းထည့်နှုတ်ယူပြီးပါပြီ။`);
      }
    } else {
      if (
        window.confirm(
          `လက်ငင်းငွေ (Cash) ${formatPrice(currentAmt)} လက်ခံရရှိပြီးကြောင်း သတ်မှတ်မည်မှာ သေချာပါသလား?`
        )
      ) {
        await updateDoc(doc(db, 'penalties', p.id), {
          isPaid: true,
          paidMethod: 'cash',
          finalAmount: currentAmt,
          paidDate: todayStr
        });
      }
    }
  };

  // 1-Click Push Staff's Active Loan Balance to Selected Month's Payroll
  const handleSyncLoanToPayroll = async (staffId: string, staffName: string, loanBalance: number) => {
    if (loanBalance <= 0) return;
    if (
      !window.confirm(
        `${staffName} ၏ လက်ကျန်ကြိုထုတ်ငွေ (${formatPrice(
          loanBalance
        )}) ကို [${targetPayrollMonth}] လစာစာရင်း (Staff Pay Roll Tab) ထဲသို့ ဖြတ်တောက်ရန် ပို့မည်မှာ သေချာပါသလား?\n\n(ချေးငွေစာရင်းတွင်လည်း လစာမှနှုတ်ပြီးကြောင်း အလိုအလျောက် မှတ်တမ်းတင်ပေးပါမည်)`
      )
    ) {
      return;
    }

    setIsSyncingPayroll(staffId);
    try {
      const repayDoc = await addDoc(collection(db, 'loans'), {
        therapistId: staffId,
        therapistName: staffName,
        amount: -loanBalance,
        date: todayStr,
        type: 'repay',
        repayMethod: 'salary',
        payrollMonth: targetPayrollMonth,
        note: `[လစာဖြတ် ${targetPayrollMonth}] Staff Pay Roll သို့ အလိုအလျောက် ပို့ပြီး`,
        createdAt: Date.now()
      });

      await syncDeductionToStaffPayrollDoc(
        targetPayrollMonth,
        staffName,
        `loan_sync_${repayDoc.id}`,
        `ကြိုထုတ်ငွေ လစာမှနှုတ် (${targetPayrollMonth})`,
        loanBalance
      );

      alert(
        `✅ ${staffName} ၏ ကြိုထုတ်ငွေ ${formatPrice(
          loanBalance
        )} ကို Staff Pay Roll (${targetPayrollMonth}) သို့ အောင်မြင်စွာ ပို့ပြီးပါပြီ!`
      );
    } catch (e) {
      alert('Payroll သို့ ချိတ်ဆက်ရာတွင် အမှားအယွင်းရှိနေပါသည်။');
    } finally {
      setIsSyncingPayroll(null);
    }
  };

  // Export Comprehensive CSV Report
  const handleExportCSV = () => {
    const headers = [
      'Therapist Name',
      'Deposit Balance (Ks)',
      'Unpaid Penalties (Ks)',
      'Unpaid Penalty Count',
      'Paid Penalties (Ks)',
      'Active Loan Balance (Ks)',
      'Net Payroll Deduction Ready (Ks)'
    ];
    const rows = uniqueTherapists.map((t) => {
      const st = getStats(t.id, t.name);
      return [
        `"${t.name}"`,
        st.depositBalance,
        st.totalUnpaid,
        st.unpaidCount,
        st.totalPaid,
        st.totalLoan,
        st.totalUnpaid + st.totalLoan
      ];
    });

    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `ShangriLa_Staff_Deposits_Penalties_Loans_${todayStr}.csv`;
    link.click();
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* =========================================================================
          1. LUXURY EXECUTIVE HEADER & NAVIGATION BAR
         ========================================================================= */}
      <div className="bg-white p-5 sm:p-6 rounded-2xl shadow-sm border border-gray-200 space-y-5">
        <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4 border-b border-gray-100 pb-4">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-[#123524]/10 text-[#123524]">
                HR & Payroll Financial Ledger
              </span>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-100 text-amber-900 border border-amber-300 flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-[#123524]" /> Auto-Synced with Staff Pay Roll
              </span>
            </div>
            <h2
              className="text-lg sm:text-xl font-black flex items-center mt-1.5"
              style={{ color: THEME.primary }}
            >
              <Banknote className="mr-2 text-[#D4AF37]" />
              ဝန်ထမ်း ဒဏ်ကြေး၊ အပ်ငွေနှင့် ကြိုထုတ်ငွေ စီမံခန့်ခွဲမှု (Penalty, Deposit & Loans)
            </h2>
            <p className="text-xs text-gray-500 mt-1">
              ဝန်ထမ်းတစ်ဦးချင်းစီ၏ စုစုပေါင်းအပ်ထားငွေ (Deposits)၊ စည်းကမ်းထိန်းသိမ်းရေး ဒဏ်ကြေးများနှင့် လစာကြိုထုတ်ငွေများကို Staff Pay Roll နှင့် တိုက်ရိုက်ချိတ်ဆက် စီမံနိုင်ပါသည်
            </p>
          </div>

          {/* Sub-Navigation Pills */}
          <div className="flex flex-wrap gap-1.5 bg-[#0B2419] p-1.5 rounded-2xl border border-[#D4AF37]/40 w-full xl:w-auto shadow-md">
            {[
              { id: 'dashboard', label: 'Overview', icon: Layers, badge: 0 },
              { id: 'add', label: '+ Issue Penalty', icon: ShieldAlert, badge: 0 },
              {
                id: 'history',
                label: 'Penalties History',
                icon: AlertTriangle,
                badge: globalSummary.totalUnpaidPenaltiesCount
              },
              {
                id: 'deposits',
                label: 'Deposits (အပ်ငွေ)',
                icon: Wallet,
                badge: globalSummary.staffWithDepositsCount
              },
              {
                id: 'loans',
                label: 'Loans / Advance',
                icon: Banknote,
                badge: globalSummary.staffWithLoansCount
              }
            ].map((item) => {
              const IconComp = item.icon;
              const isActive = subTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setSubTab(item.id as any)}
                  className={`flex-1 sm:flex-none px-3.5 py-2 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1.5 whitespace-nowrap ${
                    isActive
                      ? 'bg-gradient-to-r from-[#D4AF37] via-[#e2c15a] to-[#C8A951] text-[#0B2419] shadow-sm'
                      : 'text-gray-200 hover:bg-white/10 hover:text-white'
                  }`}
                >
                  <IconComp className="w-3.5 h-3.5" />
                  <span>{item.label}</span>
                  {item.badge > 0 && (
                    <span
                      className={`px-1.5 py-0.2 rounded-full text-[9px] font-black ${
                        isActive ? 'bg-[#0B2419] text-[#D4AF37]' : 'bg-white/20 text-[#D4AF37]'
                      }`}
                    >
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* =====================================================================
            2. EXECUTIVE OVERVIEW KPI CARDS (INCLUDES TOTAL DEPOSITS HELD!)
           ===================================================================== */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
          {/* Card 1: Total Deposits Held (စုစုပေါင်း အပ်ထားငွေ) */}
          <div
            onClick={() => setSubTab('deposits')}
            className="p-4 rounded-2xl bg-gradient-to-br from-[#0B2419] via-[#123524] to-[#1a4a32] text-white border-2 border-[#D4AF37]/60 shadow-md cursor-pointer hover:scale-[1.01] transition relative overflow-hidden"
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-extrabold text-[#D4AF37] uppercase tracking-wider">
                ၁။ စုစုပေါင်း အပ်ထားငွေ (TOTAL DEPOSITS)
              </span>
              <span className="w-8 h-8 rounded-xl bg-[#D4AF37]/20 border border-[#D4AF37]/40 text-[#D4AF37] flex items-center justify-center">
                <Wallet className="w-4 h-4" />
              </span>
            </div>
            <div className="text-xl sm:text-2xl font-black text-[#D4AF37] mt-1.5">
              {formatPrice(globalSummary.totalDepositsHeld)}
            </div>
            <div className="flex items-center justify-between text-[10px] text-emerald-200 font-semibold mt-2 pt-2 border-t border-white/15">
              <span>အပ်ငွေရှိသူ: {globalSummary.staffWithDepositsCount} ဦး</span>
              <span className="underline text-[#D4AF37] font-black">စာရင်းကြည့်ရန် →</span>
            </div>
          </div>

          {/* Card 2: Unpaid Penalties (မဆောင်ရသေးသော ဒဏ်ကြေး) */}
          <div
            onClick={() => {
              setPenaltyStatusFilter('unpaid');
              setSubTab('history');
            }}
            className={`p-4 rounded-2xl border-2 cursor-pointer hover:shadow-md transition ${
              globalSummary.totalUnpaidPenaltiesAmt > 0
                ? 'bg-red-50/70 border-red-300'
                : 'bg-gray-50 border-gray-200'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-extrabold text-red-800 uppercase tracking-wider">
                ၂။ မဆောင်ရသေး ဒဏ်ကြေး (UNPAID FINES)
              </span>
              <span className="px-2 py-0.5 rounded-full text-[9px] font-black bg-red-600 text-white">
                {globalSummary.totalUnpaidPenaltiesCount} ခု
              </span>
            </div>
            <div className="text-xl sm:text-2xl font-black text-red-600 mt-1.5">
              {formatPrice(globalSummary.totalUnpaidPenaltiesAmt)}
            </div>
            <div className="flex items-center justify-between text-[10px] font-bold text-gray-600 mt-2 pt-2 border-t border-red-200/60">
              <span className="text-emerald-700">
                ပေးဆောင်ပြီး: {formatPrice(globalSummary.totalPaidPenaltiesAmt)}
              </span>
              <span className="text-red-700 underline font-black">စစ်ဆေးရန် →</span>
            </div>
          </div>

          {/* Card 3: Active Loans / Staff Advances (ကြိုထုတ်ငွေ လက်ကျန်) */}
          <div
            onClick={() => setSubTab('loans')}
            className="p-4 rounded-2xl bg-purple-50/70 border-2 border-purple-200 cursor-pointer hover:shadow-md transition"
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-extrabold text-purple-900 uppercase tracking-wider">
                ၃။ ကြိုထုတ်ငွေ လက်ကျန် (STAFF LOANS)
              </span>
              <span className="px-2 py-0.5 rounded-full text-[9px] font-black bg-purple-700 text-white">
                {globalSummary.staffWithLoansCount} ဦး
              </span>
            </div>
            <div className="text-xl sm:text-2xl font-black text-purple-900 mt-1.5">
              {formatPrice(globalSummary.totalActiveLoansAmt)}
            </div>
            <div className="flex items-center justify-between text-[10px] font-bold text-purple-800 mt-2 pt-2 border-t border-purple-200/70">
              <span>လစာမှ နှုတ်ယူနိုင်သည်</span>
              <span className="underline font-black">စာရင်းသွင်းရန် →</span>
            </div>
          </div>

          {/* Card 4: Payroll Auto-Deduction Queue (Staff Pay Roll ချိတ်ဆက်မှု) */}
          <div className="p-4 rounded-2xl bg-amber-50/80 border-2 border-amber-300 flex flex-col justify-between">
            <div className="flex items-center justify-between gap-1">
              <span className="text-[10px] font-extrabold text-amber-950 uppercase tracking-wider">
                ၄။ လစာမှနှုတ်ရန် စုစုပေါင်း (PAYROLL SYNC)
              </span>
              <input
                type="month"
                value={targetPayrollMonth}
                onChange={(e) => e.target.value && setTargetPayrollMonth(e.target.value)}
                className="bg-white border border-amber-300 rounded-lg px-1.5 py-0.5 text-[10px] font-black text-[#123524] outline-none cursor-pointer"
                title="လစာဖြတ်မည့် လကို ရွေးချယ်ရန်"
              />
            </div>
            <div className="text-xl sm:text-2xl font-black text-[#123524] mt-1.5">
              {formatPrice(globalSummary.totalPayrollDeductionReady)}
            </div>
            <div className="flex items-center justify-between text-[10px] font-bold text-amber-900 mt-2 pt-2 border-t border-amber-200">
              <span>ဒဏ်ကြေး + ကြိုထုတ်ငွေပေါင်း</span>
              <button
                type="button"
                onClick={handleExportCSV}
                className="text-[#123524] hover:underline font-black flex items-center gap-0.5"
              >
                <Download className="w-3 h-3" /> CSV
              </button>
            </div>
          </div>
        </div>

        {/* =====================================================================
            3. SMART DATE FILTER, QUICK PERIOD PRESETS & SEARCH BAR
           ===================================================================== */}
        {subTab !== 'add' && (
          <div className="bg-gray-50/90 p-3.5 rounded-2xl border border-gray-200 flex flex-col xl:flex-row items-stretch xl:items-center justify-between gap-3">
            {/* Quick Period Presets */}
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[11px] font-extrabold text-[#123524] flex items-center mr-1">
                <Calendar className="w-3.5 h-3.5 mr-1 text-[#D4AF37]" /> ကာလရွေးရန်:
              </span>
              {[
                { id: 'this_month', label: `ယခုလ (${currentYearMonth})` },
                { id: 'last_month', label: `ပြီးခဲ့သည့်လ (${prevYearMonth} လစာ)` },
                { id: 'today', label: 'ယနေ့ (Today)' },
                { id: 'all_time', label: 'မှတ်တမ်းအားလုံး (All Time)' }
              ].map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => handleSelectPeriodPreset(p.id as any)}
                  className={`px-3 py-1.5 rounded-xl text-[11px] font-black transition ${
                    periodPreset === p.id
                      ? 'bg-[#123524] text-[#D4AF37] shadow-2xs'
                      : 'bg-white text-gray-600 border border-gray-200 hover:border-[#D4AF37]'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>

            {/* Custom Date Range & Search */}
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-1.5 bg-white px-3 py-1.5 rounded-xl border border-gray-200 shadow-2xs">
                <span className="text-[10px] font-bold text-gray-400 uppercase">From:</span>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => {
                    setStartDate(e.target.value);
                    setPeriodPreset('custom');
                  }}
                  className="text-xs font-bold text-[#123524] outline-none bg-transparent cursor-pointer"
                />
                <span className="text-gray-300 font-black">➔</span>
                <span className="text-[10px] font-bold text-gray-400 uppercase">To:</span>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => {
                    setEndDate(e.target.value);
                    setPeriodPreset('custom');
                  }}
                  className="text-xs font-bold text-[#123524] outline-none bg-transparent cursor-pointer"
                />
              </div>

              <div className="relative flex-1 sm:w-56">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="ဝန်ထမ်းအမည် / အကြောင်းအရာ ရှာရန်..."
                  className="w-full pl-8 pr-7 py-1.5 bg-white border border-gray-200 rounded-xl text-xs font-bold text-gray-800 outline-none focus:border-[#D4AF37]"
                />
                <Search className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-2.5" />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2 top-2 text-gray-400 hover:text-gray-600"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* =========================================================================
          4. SUB-TAB 1: LUXURY STAFF OVERVIEW CARDS (WITH DEPOSITS, LOANS, FINES & QUICK ACTIONS)
         ========================================================================= */}
      {subTab === 'dashboard' && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 animate-fade-in">
          {uniqueTherapists
            .filter((t) =>
              !searchQuery.trim()
                ? true
                : t.name.toLowerCase().includes(searchQuery.trim().toLowerCase())
            )
            .map((t) => {
              const stats = getStats(t.id, t.name);
              const hasUnpaid = stats.unpaidCount > 0;
              const hasLoan = stats.totalLoan > 0;
              const isClean = !hasUnpaid && !hasLoan;

              return (
                <div
                  key={t.id}
                  onClick={() => {
                    setSelectedTherapistId(t.id);
                    setModalActiveTab('penalties');
                  }}
                  className={`rounded-2xl border-2 bg-white overflow-hidden cursor-pointer transition-all duration-200 hover:shadow-lg flex flex-col justify-between ${
                    hasUnpaid
                      ? 'border-red-300 hover:border-red-400'
                      : hasLoan
                      ? 'border-purple-200 hover:border-[#D4AF37]'
                      : 'border-gray-200 hover:border-[#D4AF37]'
                  }`}
                >
                  {/* Card Top Header */}
                  <div className="p-4 bg-gradient-to-r from-[#0B2419] via-[#123524] to-[#1a4a32] text-white flex items-center justify-between gap-2 border-b border-[#D4AF37]/30">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-9 h-9 rounded-xl bg-[#D4AF37]/20 border border-[#D4AF37]/50 flex items-center justify-center text-[#D4AF37] font-serif font-black text-xs flex-shrink-0">
                        {t.name.replace(/[^0-9]/g, '')
                          ? `No-${t.name.replace(/[^0-9]/g, '')}`
                          : t.name.substring(0, 2).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <h3 className="font-black text-sm text-[#D4AF37] truncate">{t.name}</h3>
                        <p className="text-[10px] text-gray-300 font-semibold">
                          Click to view full 360° ledger
                        </p>
                      </div>
                    </div>

                    {hasUnpaid ? (
                      <span className="px-2.5 py-1 rounded-full text-[9px] font-black uppercase bg-red-600 text-white shadow animate-pulse flex-shrink-0">
                        ⚠️ ဒဏ်ကြေး ({stats.unpaidCount})
                      </span>
                    ) : isClean ? (
                      <span className="px-2.5 py-1 rounded-full text-[9px] font-black uppercase bg-emerald-500/20 border border-emerald-400/40 text-emerald-200 flex-shrink-0">
                        ✓ Clear Record
                      </span>
                    ) : null}
                  </div>

                  {/* Card Body: 3-Column Financial Matrix (Deposit, Unpaid Fine, Loan Balance) */}
                  <div className="p-4 space-y-3 flex-1 flex flex-col justify-between">
                    <div className="grid grid-cols-3 gap-2 text-center">
                      {/* 1. Deposit Balance */}
                      <div className="p-2.5 rounded-xl bg-blue-50/70 border border-blue-200">
                        <span className="text-[9px] font-extrabold text-blue-800 uppercase block">
                          အပ်ထားငွေ
                        </span>
                        <span className="text-xs font-black text-blue-900 mt-0.5 block">
                          {formatPrice(stats.depositBalance)}
                        </span>
                      </div>

                      {/* 2. Unpaid Penalty */}
                      <div
                        className={`p-2.5 rounded-xl border ${
                          stats.totalUnpaid > 0
                            ? 'bg-red-50 border-red-300'
                            : 'bg-gray-50 border-gray-200'
                        }`}
                      >
                        <span
                          className={`text-[9px] font-extrabold uppercase block ${
                            stats.totalUnpaid > 0 ? 'text-red-700' : 'text-gray-400'
                          }`}
                        >
                          ဒဏ်ကြေးကျန်
                        </span>
                        <span
                          className={`text-xs font-black mt-0.5 block ${
                            stats.totalUnpaid > 0 ? 'text-red-600' : 'text-gray-500'
                          }`}
                        >
                          {formatPrice(stats.totalUnpaid)}
                        </span>
                      </div>

                      {/* 3. Active Loan */}
                      <div
                        className={`p-2.5 rounded-xl border ${
                          stats.totalLoan > 0
                            ? 'bg-purple-50 border-purple-300'
                            : 'bg-gray-50 border-gray-200'
                        }`}
                      >
                        <span
                          className={`text-[9px] font-extrabold uppercase block ${
                            stats.totalLoan > 0 ? 'text-purple-800' : 'text-gray-400'
                          }`}
                        >
                          ကြိုထုတ်ငွေ
                        </span>
                        <span
                          className={`text-xs font-black mt-0.5 block ${
                            stats.totalLoan > 0 ? 'text-purple-800' : 'text-gray-500'
                          }`}
                        >
                          {formatPrice(stats.totalLoan)}
                        </span>
                      </div>
                    </div>

                    {/* Paid Fines & Payroll Sync Info */}
                    <div className="flex items-center justify-between text-[11px] px-1 pt-1">
                      <span className="text-gray-500 font-semibold">
                        ဆောင်ပြီးဒဏ်ကြေး:{' '}
                        <strong className="text-emerald-700">{formatPrice(stats.totalPaid)}</strong>
                      </span>
                      {(stats.totalUnpaid > 0 || stats.totalLoan > 0) && (
                        <span className="text-[10px] font-black text-amber-900 bg-amber-100 px-2 py-0.5 rounded border border-amber-300">
                          လစာမှနှုတ်ရန်: {formatPrice(stats.totalUnpaid + stats.totalLoan)}
                        </span>
                      )}
                    </div>

                    {/* Quick Action Buttons on Card (Stop Propagation so Modal doesn't open unintentionally) */}
                    <div
                      className="pt-2.5 border-t border-gray-100 grid grid-cols-3 gap-1.5"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <button
                        type="button"
                        onClick={() => {
                          setFormData((prev) => ({ ...prev, therapistId: t.id }));
                          setSubTab('add');
                        }}
                        className="py-1.5 px-2 rounded-lg bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 text-[10px] font-black transition text-center"
                      >
                        + ဒဏ်ကြေး
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setDepositForm((prev) => ({
                            ...prev,
                            therapistId: t.id,
                            txType: 'deposit'
                          }));
                          setSubTab('deposits');
                        }}
                        className="py-1.5 px-2 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 text-[10px] font-black transition text-center"
                      >
                        + အပ်ငွေ
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setLoanForm((prev) => ({ ...prev, therapistId: t.id, type: 'borrow' }));
                          setSubTab('loans');
                        }}
                        className="py-1.5 px-2 rounded-lg bg-purple-50 hover:bg-purple-100 text-purple-800 border border-purple-200 text-[10px] font-black transition text-center"
                      >
                        + ကြိုထုတ်
                      </button>
                    </div>

                    {/* 1-Click Sync Active Loan to Payroll Button */}
                    {stats.totalLoan > 0 && (
                      <div onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          disabled={isSyncingPayroll === t.id}
                          onClick={() => handleSyncLoanToPayroll(t.id, t.name, stats.totalLoan)}
                          className="w-full py-2 px-3 rounded-xl bg-gradient-to-r from-[#123524] to-[#1a4a32] text-[#D4AF37] text-[10px] font-black flex items-center justify-center gap-1.5 shadow-xs hover:opacity-95 transition"
                        >
                          <Send className="w-3 h-3" />
                          <span>
                            {isSyncingPayroll === t.id
                              ? 'Syncing...'
                              : `ကြိုထုတ်ငွေ (${formatPrice(stats.totalLoan)}) အား ${targetPayrollMonth} လစာမှနှုတ်မည်`}
                          </span>
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
        </div>
      )}

      {/* =========================================================================
          5. SUB-TAB 2: ISSUE NEW PENALTY (WITH QUICK AMOUNT CHIPS & 2X RULE TOGGLE)
         ========================================================================= */}
      {subTab === 'add' && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden max-w-2xl mx-auto animate-fade-in">
          <div className="bg-gradient-to-r from-[#0B2419] via-[#123524] to-[#1a4a32] p-5 text-white border-b border-[#D4AF37]/40 flex items-center justify-between">
            <div>
              <h3 className="font-black text-base text-[#D4AF37] flex items-center gap-2">
                <ShieldAlert className="w-5 h-5" />
                <span>ဝန်ထမ်း ဒဏ်ကြေးအသစ် တပ်ဆင်ရန် (Issue Staff Penalty)</span>
              </h3>
              <p className="text-[11px] text-gray-300 mt-0.5">
                မှတ်တမ်းတင်လိုက်သည်နှင့် ဝန်ထမ်းထံ Telegram Notification ပေးပို့ပြီး Staff Pay Roll တွင် အလိုအလျောက် ချိတ်ဆက်ပေးပါမည်
              </p>
            </div>
          </div>

          <form onSubmit={handleSubmitPenalty} className="p-6 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-[11px] font-extrabold text-gray-600 uppercase mb-1.5">
                  ၁။ ဝန်ထမ်း ရွေးချယ်ရန် (Select Therapist) *
                </label>
                <select
                  className="w-full p-3 border-2 border-gray-200 focus:border-[#123524] rounded-xl text-xs bg-gray-50 font-black text-[#123524] outline-none"
                  value={formData.therapistId}
                  onChange={(e) => setFormData({ ...formData, therapistId: e.target.value })}
                >
                  {uniqueTherapists.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-extrabold text-gray-600 uppercase mb-1.5">
                  ၂။ ရက်စွဲ (Effective Date) *
                </label>
                <input
                  type="date"
                  className="w-full p-3 border-2 border-gray-200 focus:border-[#123524] rounded-xl text-xs bg-gray-50 font-black text-[#123524] outline-none"
                  value={formData.date}
                  onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-extrabold text-gray-600 uppercase mb-1.5">
                ၃။ ဖောက်ဖျက်သည့် စည်းကမ်းချက် (Violation Category) *
              </label>
              <select
                className="w-full p-3 border-2 border-gray-200 focus:border-[#123524] rounded-xl text-xs bg-gray-50 font-bold text-gray-800 outline-none"
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-extrabold text-gray-600 uppercase mb-1.5">
                ၄။ အခြေခံ ဒဏ်ကြေးပမာဏ (Penalty Amount - Ks) *
              </label>
              <div className="flex flex-wrap gap-1.5 mb-2">
                {QUICK_PENALTY_AMOUNTS.map((amt) => (
                  <button
                    key={amt}
                    type="button"
                    onClick={() => setFormData({ ...formData, amount: String(amt) })}
                    className={`px-3 py-1.5 rounded-lg text-xs font-black border transition ${
                      Number(formData.amount) === amt
                        ? 'bg-[#123524] text-[#D4AF37] border-[#123524]'
                        : 'bg-gray-50 text-gray-700 border-gray-200 hover:border-[#D4AF37]'
                    }`}
                  >
                    {amt.toLocaleString()} Ks
                  </button>
                ))}
              </div>
              <input
                type="number"
                placeholder="ဥပမာ - 10000"
                className="w-full p-3 border-2 border-gray-200 focus:border-red-500 rounded-xl text-sm bg-gray-50 font-black text-red-600 outline-none"
                value={formData.amount}
                onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                required
                min="0"
              />
            </div>

            <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-between gap-3">
              <div>
                <div className="text-xs font-black text-amber-950">
                  📌 ရက်လွန် ၂ ဆတိုးစနစ် ကင်းလွတ်ခွင့် (Fixed Penalty Mode)
                </div>
                <div className="text-[10px] text-amber-800 font-semibold">
                  အမှန်ခြစ်ပေးထားပါက ရက်လွန်သော်လည်း ဒဏ်ကြေး (၂) ဆ မတက်ဘဲ မူရင်းပမာဏအတိုင်းသာ လစာမှ နှုတ်ယူပါမည်
                </div>
              </div>
              <input
                type="checkbox"
                checked={formData.disableDoubling}
                onChange={(e) => setFormData({ ...formData, disableDoubling: e.target.checked })}
                className="w-5 h-5 accent-[#123524] cursor-pointer flex-shrink-0"
              />
            </div>

            <div>
              <label className="block text-[11px] font-extrabold text-gray-600 uppercase mb-1.5">
                ၅။ မှတ်ချက် / အသေးစိတ်ဖော်ပြချက် (Remark - Optional)
              </label>
              <textarea
                placeholder="ဥပမာ - Outpass ချိန် နာရီဝက်ကျော် / နံနက် 8 နာရီထိုးမှ အိပ်ယာထ..."
                className="w-full p-3 border-2 border-gray-200 focus:border-[#123524] rounded-xl text-xs bg-gray-50 font-semibold outline-none"
                value={formData.remark}
                onChange={(e) => setFormData({ ...formData, remark: e.target.value })}
                rows={2}
              />
            </div>

            <button
              type="submit"
              className="w-full py-3.5 bg-gradient-to-r from-[#123524] to-[#1a4a32] text-[#D4AF37] rounded-xl font-black text-xs shadow-md hover:opacity-95 transition uppercase tracking-wider flex items-center justify-center gap-2"
            >
              <ShieldAlert className="w-4 h-4" />
              <span>ဒဏ်ကြေး မှတ်တမ်းတင်ပြီး Telegram ပို့မည်</span>
            </button>
          </form>
        </div>
      )}

      {/* =========================================================================
          6. SUB-TAB 3: PENALTIES HISTORY (WITH CASH, DEPOSIT & SALARY DEDUCTION ACTIONS)
         ========================================================================= */}
      {subTab === 'history' && (
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden border border-gray-200 animate-fade-in">
          <div className="p-4 sm:p-5 bg-gradient-to-r from-[#0B2419] via-[#123524] to-[#1a4a32] text-white flex flex-wrap justify-between items-center gap-3 border-b border-[#D4AF37]/40">
            <div>
              <h3 className="font-black text-sm sm:text-base text-[#D4AF37] flex items-center gap-2">
                <AlertTriangle className="w-4 h-4" />
                <span>ဒဏ်ကြေး မှတ်တမ်းများ ({filteredPenalties.length} ခု)</span>
              </h3>
              <p className="text-[11px] text-gray-300 mt-0.5">
                မဆောင်ရသေးသော ဒဏ်ကြေးများသည် Staff Pay Roll တွင် အလိုအလျောက် နှုတ်ယူရန် ချိတ်ဆက်ထားပြီး ဖြစ်ပါသည်
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="flex bg-black/30 p-1 rounded-xl border border-white/15">
                {[
                  { id: 'all', label: 'အားလုံး' },
                  { id: 'unpaid', label: 'မဆောင်ရသေး' },
                  { id: 'paid', label: 'ပေးဆောင်ပြီး' }
                ].map((st) => (
                  <button
                    key={st.id}
                    type="button"
                    onClick={() => setPenaltyStatusFilter(st.id as any)}
                    className={`px-2.5 py-1 rounded-lg text-[10px] font-black transition ${
                      penaltyStatusFilter === st.id
                        ? 'bg-[#D4AF37] text-[#0B2419]'
                        : 'text-gray-300 hover:text-white'
                    }`}
                  >
                    {st.label}
                  </button>
                ))}
              </div>

              <select
                value={historyFilter}
                onChange={(e) => setHistoryFilter(e.target.value)}
                className="p-2 border border-[#D4AF37]/50 rounded-xl text-xs outline-none bg-white text-[#123524] font-black shadow-sm"
              >
                <option value="">All Therapists (ဝန်ထမ်းအားလုံး)</option>
                {uniqueTherapists.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[820px]">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200 text-[11px] text-gray-500 uppercase tracking-wider">
                  <th className="p-3.5">Name / Date</th>
                  <th className="p-3.5">Category & Status</th>
                  <th className="p-3.5 text-right">Amount</th>
                  <th className="p-3.5 text-right">Settlement Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-xs">
                {filteredPenalties.map((p) => {
                  const days = getDaysOverdue(p.date);
                  const amount = calculateAmount(p);
                  const isOverdue = !p.isPaid && !p.disableDoubling && days > 0;
                  return (
                    <tr key={p.id} className="hover:bg-gray-50/80 transition">
                      <td className="p-3.5">
                        <div className="font-black text-[#123524] text-sm">{p.therapistName}</div>
                        <div className="text-gray-500 font-mono font-bold text-[11px] mt-0.5">
                          {p.date}
                        </div>
                      </td>

                      <td className="p-3.5">
                        <div className="font-bold text-gray-800 text-sm">{p.category}</div>
                        {p.remark && (
                          <div className="text-red-600 font-semibold text-xs mt-0.5">
                            - {p.remark}
                          </div>
                        )}
                        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                          {p.isPaid ? (
                            <span
                              className={`px-2.5 py-0.5 rounded-full text-[10px] font-black border ${
                                p.paidMethod === 'deposit'
                                  ? 'bg-blue-50 text-blue-700 border-blue-200'
                                  : p.paidMethod === 'salary'
                                  ? 'bg-amber-50 text-amber-900 border-amber-300'
                                  : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              }`}
                            >
                              ✓{' '}
                              {p.paidMethod === 'deposit'
                                ? 'အပ်ငွေမှ နှုတ်ပြီး'
                                : p.paidMethod === 'salary'
                                ? 'လစာထဲမှ နှုတ်ပြီး'
                                : 'ပေးဆောင်ပြီး (Cash)'}
                            </span>
                          ) : (
                            <>
                              <span
                                className={`px-2.5 py-0.5 rounded-full text-[10px] font-black border ${
                                  isOverdue
                                    ? 'bg-red-50 text-red-700 border-red-200 animate-pulse'
                                    : 'bg-yellow-50 text-yellow-800 border-yellow-300'
                                }`}
                              >
                                {isOverdue
                                  ? `⚠️ ရက်လွန် (${days} ရက် • 2x တိုးနေသည်)`
                                  : '⏳ မဆောင်ရသေး (Auto-Linked to Payroll)'}
                              </span>
                            </>
                          )}
                        </div>
                      </td>

                      <td
                        className={`p-3.5 text-right font-black text-sm whitespace-nowrap ${
                          p.isPaid ? 'text-emerald-600' : 'text-red-600'
                        }`}
                      >
                        {formatPrice(amount)}
                        {!p.isPaid && Number(p.amount) !== amount && (
                          <div className="text-[10px] text-gray-400 font-semibold">
                            မူရင်း: {formatPrice(Number(p.amount))}
                          </div>
                        )}
                      </td>

                      <td className="p-3.5 text-right">
                        <div className="flex justify-end items-center gap-1.5 flex-wrap">
                          {!p.isPaid && (
                            <>
                              <button
                                type="button"
                                onClick={() => handleMarkAsPaid(p, 'cash')}
                                className="bg-emerald-50 text-emerald-700 px-2.5 py-1.5 rounded-lg border border-emerald-200 hover:bg-emerald-600 hover:text-white font-black text-[10px] transition"
                                title="လက်ငင်းငွေဖြင့် ပေးချေမည်"
                              >
                                💵 Cash
                              </button>
                              <button
                                type="button"
                                onClick={() => handleMarkAsPaid(p, 'deposit')}
                                className="bg-blue-50 text-blue-700 px-2.5 py-1.5 rounded-lg border border-blue-200 hover:bg-blue-600 hover:text-white font-black text-[10px] transition"
                                title="ဝန်ထမ်း၏ အပ်ထားငွေထဲမှ နှုတ်မည်"
                              >
                                💰 အပ်ငွေမှနှုတ်
                              </button>
                              <button
                                type="button"
                                onClick={() => handleMarkAsPaid(p, 'salary')}
                                className="bg-amber-50 text-[#123524] px-2.5 py-1.5 rounded-lg border border-[#D4AF37] hover:bg-[#123524] hover:text-[#D4AF37] font-black text-[10px] transition"
                                title="Staff Pay Roll လစာစာရင်းထဲသို့ တိုက်ရိုက်ပို့၍ ပိတ်မည်"
                              >
                                💼 လစာမှနှုတ်
                              </button>
                            </>
                          )}
                          <button
                            type="button"
                            onClick={() => {
                              if (window.confirm('ဤဒဏ်ကြေးမှတ်တမ်းကို ဖျက်ရန် သေချာပါသလား?')) {
                                deleteDoc(doc(db, 'penalties', p.id));
                              }
                            }}
                            className="p-1.5 rounded-lg bg-gray-100 text-gray-400 hover:bg-red-50 hover:text-red-600 transition"
                            title="Delete Record"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {filteredPenalties.length === 0 && (
                  <tr>
                    <td colSpan={4} className="p-10 text-center text-gray-400 font-bold">
                      ရွေးချယ်ထားသော ကာလအတွင်း ဒဏ်ကြေးမှတ်တမ်း မရှိသေးပါ။
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* =========================================================================
          7. SUB-TAB 4: DEPOSITS MANAGEMENT (TOTAL DEPOSITS HELD + DEPOSIT/DEDUCT LEDGER)
         ========================================================================= */}
      {subTab === 'deposits' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 animate-fade-in">
          {/* Left Column: Deposit / Withdraw Form & Staff Balances */}
          <div className="lg:col-span-5 space-y-5">
            <form
              onSubmit={handleSubmitDeposit}
              className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden"
            >
              <div className="bg-gradient-to-r from-[#0B2419] via-[#123524] to-[#1a4a32] p-4 text-white border-b border-[#D4AF37]/40">
                <h3 className="font-black text-sm text-[#D4AF37] flex items-center gap-2">
                  <Wallet className="w-4 h-4" />
                  <span>ဝန်ထမ်း အပ်ငွေသွင်းရန် / ပြန်ထုတ်ပေးရန်</span>
                </h3>
                <p className="text-[10px] text-gray-300 mt-0.5">
                  စုစုပေါင်း လက်ရှိအပ်ထားငွေ:{' '}
                  <strong className="text-[#D4AF37]">
                    {formatPrice(globalSummary.totalDepositsHeld)}
                  </strong>
                </p>
              </div>

              <div className="p-5 space-y-4">
                <div className="grid grid-cols-2 gap-2 bg-gray-100 p-1 rounded-xl border border-gray-200">
                  <button
                    type="button"
                    onClick={() => setDepositForm({ ...depositForm, txType: 'deposit' })}
                    className={`py-2 rounded-lg text-xs font-black transition ${
                      depositForm.txType === 'deposit'
                        ? 'bg-[#123524] text-[#D4AF37] shadow-2xs'
                        : 'text-gray-600'
                    }`}
                  >
                    + အပ်ငွေ အသစ်သွင်းမည်
                  </button>
                  <button
                    type="button"
                    onClick={() => setDepositForm({ ...depositForm, txType: 'withdraw' })}
                    className={`py-2 rounded-lg text-xs font-black transition ${
                      depositForm.txType === 'withdraw'
                        ? 'bg-red-600 text-white shadow-2xs'
                        : 'text-gray-600'
                    }`}
                  >
                    - အပ်ငွေ ပြန်ထုတ်/နှုတ်မည်
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-extrabold text-gray-500 uppercase mb-1">
                      ဝန်ထမ်း ရွေးချယ်ရန်
                    </label>
                    <select
                      className="w-full p-2.5 border border-gray-300 rounded-xl text-xs bg-gray-50 font-black text-[#123524] outline-none"
                      value={depositForm.therapistId}
                      onChange={(e) =>
                        setDepositForm({ ...depositForm, therapistId: e.target.value })
                      }
                    >
                      {uniqueTherapists.map((t) => {
                        const bal = getStats(t.id, t.name).depositBalance;
                        return (
                          <option key={t.id} value={t.id}>
                            {t.name} (လက်ကျန်: {formatPrice(bal)})
                          </option>
                        );
                      })}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[10px] font-extrabold text-gray-500 uppercase mb-1">
                      နေ့ရက် (Date)
                    </label>
                    <input
                      type="date"
                      value={depositForm.date}
                      onChange={(e) => setDepositForm({ ...depositForm, date: e.target.value })}
                      className="w-full p-2.5 border border-gray-300 rounded-xl text-xs bg-gray-50 font-bold text-[#123524] outline-none"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-extrabold text-gray-500 uppercase mb-1">
                    ပမာဏ (Amount - Ks)
                  </label>
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {QUICK_DEPOSIT_AMOUNTS.map((amt) => (
                      <button
                        key={amt}
                        type="button"
                        onClick={() => setDepositForm({ ...depositForm, amount: String(amt) })}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-black border transition ${
                          Number(depositForm.amount) === amt
                            ? 'bg-[#123524] text-[#D4AF37] border-[#123524]'
                            : 'bg-gray-50 text-gray-700 border-gray-200 hover:border-[#D4AF37]'
                        }`}
                      >
                        {amt.toLocaleString()}
                      </button>
                    ))}
                  </div>
                  <input
                    type="number"
                    placeholder="အပ်ငွေပမာဏ (ကျပ်)"
                    className="w-full p-3 border border-gray-300 rounded-xl text-sm bg-gray-50 font-black text-[#123524] outline-none"
                    value={depositForm.amount}
                    onChange={(e) => setDepositForm({ ...depositForm, amount: e.target.value })}
                    required
                    min="1"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-extrabold text-gray-500 uppercase mb-1">
                    မှတ်ချက် (Note)
                  </label>
                  <input
                    type="text"
                    placeholder="ဥပမာ - လစဉ် စပေါ်အပ်ငွေ / အပ်ငွေသွင်းခြင်း"
                    className="w-full p-2.5 border border-gray-300 rounded-xl text-xs bg-gray-50 font-semibold outline-none"
                    value={depositForm.note}
                    onChange={(e) => setDepositForm({ ...depositForm, note: e.target.value })}
                  />
                </div>

                <button
                  type="submit"
                  className={`w-full py-3 rounded-xl font-black text-xs shadow-md transition uppercase tracking-wider ${
                    depositForm.txType === 'withdraw'
                      ? 'bg-red-600 hover:bg-red-700 text-white'
                      : 'bg-gradient-to-r from-[#123524] to-[#1a4a32] text-[#D4AF37]'
                  }`}
                >
                  {depositForm.txType === 'withdraw'
                    ? 'အပ်ငွေ ပြန်ထုတ်/နှုတ်ယူမှု မှတ်တမ်းတင်မည်'
                    : 'အပ်ငွေ စာရင်းသွင်းမည်'}
                </button>
              </div>
            </form>

            {/* Individual Staff Deposit Balances Summary Box */}
            <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-sm space-y-3">
              <div className="flex items-center justify-between border-b border-gray-100 pb-2.5">
                <span className="text-xs font-black text-[#123524]">
                  ဝန်ထမ်းအလိုက် လက်ရှိအပ်ထားငွေ စာရင်းချုပ်
                </span>
                <span className="text-xs font-black text-blue-700 bg-blue-50 px-2.5 py-0.5 rounded-lg border border-blue-200">
                  စုစုပေါင်း: {formatPrice(globalSummary.totalDepositsHeld)}
                </span>
              </div>
              <div className="space-y-1.5 max-h-60 overflow-y-auto pr-1">
                {uniqueTherapists.map((t) => {
                  const st = getStats(t.id, t.name);
                  return (
                    <div
                      key={t.id}
                      onClick={() => setDepositFilter(String(depositFilter) === String(t.id) ? '' : t.id)}
                      className={`p-2.5 rounded-xl border flex items-center justify-between text-xs cursor-pointer transition ${
                        String(depositFilter) === String(t.id)
                          ? 'bg-blue-50 border-blue-400 font-black'
                          : 'bg-gray-50/70 border-gray-200 hover:bg-gray-100'
                      }`}
                    >
                      <span className="font-bold text-gray-800">{t.name}</span>
                      <span
                        className={`font-black ${
                          st.depositBalance > 0 ? 'text-blue-700' : 'text-gray-400'
                        }`}
                      >
                        {formatPrice(st.depositBalance)}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Right Column: Deposits Transaction History */}
          <div className="lg:col-span-7 bg-white rounded-2xl shadow-sm overflow-hidden border border-gray-200 flex flex-col">
            <div className="p-4 sm:p-5 bg-gradient-to-r from-[#0B2419] via-[#123524] to-[#1a4a32] text-white flex flex-wrap justify-between items-center gap-3 border-b border-[#D4AF37]/40">
              <div>
                <h3 className="font-black text-sm sm:text-base text-[#D4AF37]">
                  အပ်ငွေ / ဖြတ်တောက်မှု မှတ်တမ်းများ ({filteredDeposits.length})
                </h3>
                <p className="text-[11px] text-gray-300 mt-0.5">
                  ကာလအတွင်း အပ်ငွေသွင်း: +{formatPrice(globalSummary.periodDepositsAdded)} • နှုတ်ယူ: -
                  {formatPrice(globalSummary.periodDepositsUsed)}
                </p>
              </div>
              <select
                value={depositFilter}
                onChange={(e) => setDepositFilter(e.target.value)}
                className="p-2 border border-[#D4AF37]/50 rounded-xl text-xs outline-none bg-white text-[#123524] font-black shadow-sm"
              >
                <option value="">All Therapists (ဝန်ထမ်းအားလုံး)</option>
                {uniqueTherapists.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="overflow-x-auto flex-1">
              <table className="w-full text-xs text-left border-collapse min-w-[540px]">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200 text-[11px] text-gray-500 uppercase">
                    <th className="p-3.5">Name / Date</th>
                    <th className="p-3.5">Type & Note</th>
                    <th className="p-3.5 text-right">Amount</th>
                    <th className="p-3.5 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredDeposits.map((d) => (
                    <tr key={d.id} className="hover:bg-gray-50/80 transition">
                      <td className="p-3.5">
                        <div className="font-black text-[#123524] text-sm">{d.therapistName}</div>
                        <div className="text-gray-500 font-mono font-bold text-[10px] mt-0.5">
                          {d.date}
                        </div>
                      </td>
                      <td className="p-3.5">
                        <span
                          className={`px-2 py-0.5 rounded text-[9px] font-black mr-2 uppercase ${
                            d.amount > 0
                              ? 'bg-blue-100 text-blue-800 border border-blue-200'
                              : 'bg-red-100 text-red-700 border border-red-200'
                          }`}
                        >
                          {d.amount > 0 ? '+ အပ်ငွေသွင်း' : '- နှုတ်ယူ'}
                        </span>
                        <span className="text-gray-700 font-semibold">{d.note}</span>
                      </td>
                      <td
                        className={`p-3.5 text-right font-black text-sm whitespace-nowrap ${
                          d.amount > 0 ? 'text-blue-600' : 'text-red-600'
                        }`}
                      >
                        {d.amount > 0 ? '+' : ''}
                        {formatPrice(Number(d.amount))}
                      </td>
                      <td className="p-3.5 text-center">
                        <button
                          type="button"
                          onClick={() => {
                            if (window.confirm('ဖျက်ရန်သေချာပါသလား?')) {
                              deleteDoc(doc(db, 'deposits', d.id));
                            }
                          }}
                          className="text-gray-400 hover:text-red-600 p-1.5 rounded-lg hover:bg-red-50 transition"
                        >
                          <Trash2 size={15} />
                        </button>
                      </td>
                    </tr>
                  ))}
                  {filteredDeposits.length === 0 && (
                    <tr>
                      <td colSpan={4} className="p-10 text-center text-gray-400 font-bold">
                        အပ်ငွေ မှတ်တမ်းမရှိသေးပါ။
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          8. SUB-TAB 5: LOANS / STAFF ADVANCES (WITH DIRECT PAYROLL DEDUCTION LINK)
         ========================================================================= */}
      {subTab === 'loans' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 animate-fade-in">
          {/* Left Column: Borrow / Repay Form */}
          <div className="lg:col-span-5 space-y-5">
            <form
              onSubmit={handleSubmitLoan}
              className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden"
            >
              <div className="bg-gradient-to-r from-[#0B2419] via-[#123524] to-[#1a4a32] p-4 text-white border-b border-[#D4AF37]/40">
                <h3 className="font-black text-sm text-[#D4AF37] flex items-center gap-2">
                  <Banknote className="w-4 h-4" />
                  <span>ကြိုထုတ်ငွေ / ပြန်ဆပ်ငွေ (Loans & Salary Advance)</span>
                </h3>
                <p className="text-[10px] text-gray-300 mt-0.5">
                  လစာမှနှုတ်၍ ပြန်ဆပ်ခြင်း ရွေးချယ်ပါက Staff Pay Roll Tab ထဲသို့ အလိုအလျောက် ပေါင်းထည့်နှုတ်ယူပေးပါမည်
                </p>
              </div>

              <div className="p-5 space-y-4">
                <div className="grid grid-cols-2 gap-2 bg-gray-100 p-1 rounded-xl border border-gray-200">
                  <button
                    type="button"
                    onClick={() => setLoanForm({ ...loanForm, type: 'borrow' })}
                    className={`py-2 rounded-lg text-xs font-black transition ${
                      loanForm.type === 'borrow'
                        ? 'bg-purple-800 text-white shadow-2xs'
                        : 'text-gray-600'
                    }`}
                  >
                    💸 ငွေကြိုထုတ်မည် (Borrow)
                  </button>
                  <button
                    type="button"
                    onClick={() => setLoanForm({ ...loanForm, type: 'repay' })}
                    className={`py-2 rounded-lg text-xs font-black transition ${
                      loanForm.type === 'repay'
                        ? 'bg-emerald-600 text-white shadow-2xs'
                        : 'text-gray-600'
                    }`}
                  >
                    💵 ပြန်ဆပ်မည် (Repay)
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-extrabold text-gray-500 uppercase mb-1">
                      ဝန်ထမ်း ရွေးချယ်ရန်
                    </label>
                    <select
                      className="w-full p-2.5 border border-gray-300 rounded-xl text-xs bg-gray-50 font-black text-[#123524] outline-none"
                      value={loanForm.therapistId}
                      onChange={(e) => setLoanForm({ ...loanForm, therapistId: e.target.value })}
                    >
                      {uniqueTherapists.map((t) => {
                        const bal = getStats(t.id, t.name).totalLoan;
                        return (
                          <option key={t.id} value={t.id}>
                            {t.name} (ချေးငွေကျန်: {formatPrice(bal)})
                          </option>
                        );
                      })}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[10px] font-extrabold text-gray-500 uppercase mb-1">
                      နေ့ရက် (Date)
                    </label>
                    <input
                      type="date"
                      className="w-full p-2.5 border border-gray-300 rounded-xl text-xs bg-gray-50 font-bold text-[#123524] outline-none"
                      value={loanForm.date}
                      onChange={(e) => setLoanForm({ ...loanForm, date: e.target.value })}
                      required
                    />
                  </div>
                </div>

                {loanForm.type === 'repay' && (
                  <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 space-y-3">
                    <div>
                      <label className="block text-[10px] font-extrabold text-amber-950 uppercase mb-1">
                        ပြန်ဆပ်မည့် နည်းလမ်း (Repayment Method)
                      </label>
                      <select
                        className="w-full p-2.5 border border-amber-300 rounded-xl text-xs bg-white font-black text-[#123524] outline-none"
                        value={loanForm.repayMethod}
                        onChange={(e) =>
                          setLoanForm({
                            ...loanForm,
                            repayMethod: e.target.value as 'cash' | 'salary'
                          })
                        }
                      >
                        <option value="salary">
                          💼 လစာထဲမှ နှုတ်၍ ပြန်ဆပ်မည် (Auto-Sync to Staff Pay Roll)
                        </option>
                        <option value="cash">💵 လက်ငင်းငွေ (Cash) ဖြင့် ပြန်ဆပ်မည်</option>
                      </select>
                    </div>

                    {loanForm.repayMethod === 'salary' && (
                      <div>
                        <label className="block text-[10px] font-extrabold text-amber-950 uppercase mb-1">
                          နှုတ်ယူမည့် လစာကာလ (Target Payroll Month)
                        </label>
                        <input
                          type="month"
                          value={loanForm.payrollMonth}
                          onChange={(e) =>
                            setLoanForm({ ...loanForm, payrollMonth: e.target.value })
                          }
                          className="w-full p-2 bg-white border border-amber-300 rounded-xl text-xs font-black text-[#123524]"
                        />
                      </div>
                    )}
                  </div>
                )}

                <div>
                  <label className="block text-[10px] font-extrabold text-gray-500 uppercase mb-1">
                    ပမာဏ (Amount - Ks)
                  </label>
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {QUICK_LOAN_AMOUNTS.map((amt) => (
                      <button
                        key={amt}
                        type="button"
                        onClick={() => setLoanForm({ ...loanForm, amount: String(amt) })}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-black border transition ${
                          Number(loanForm.amount) === amt
                            ? 'bg-[#123524] text-[#D4AF37] border-[#123524]'
                            : 'bg-gray-50 text-gray-700 border-gray-200 hover:border-[#D4AF37]'
                        }`}
                      >
                        {amt.toLocaleString()}
                      </button>
                    ))}
                  </div>
                  <input
                    type="number"
                    placeholder="ပမာဏ (ကျပ်)"
                    className="w-full p-3 border border-gray-300 rounded-xl text-sm bg-gray-50 font-black text-[#123524] outline-none"
                    value={loanForm.amount}
                    onChange={(e) => setLoanForm({ ...loanForm, amount: e.target.value })}
                    required
                    min="1"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-extrabold text-gray-500 uppercase mb-1">
                    မှတ်ချက် (Note)
                  </label>
                  <input
                    type="text"
                    placeholder="ဥပမာ - လစာကြိုထုတ် / အိမ်လခအတွက် ကြိုထုတ်..."
                    className="w-full p-2.5 border border-gray-300 rounded-xl text-xs bg-gray-50 font-semibold outline-none"
                    value={loanForm.note}
                    onChange={(e) => setLoanForm({ ...loanForm, note: e.target.value })}
                  />
                </div>

                <button
                  type="submit"
                  className={`w-full py-3.5 text-white rounded-xl font-black text-xs shadow-md transition uppercase tracking-wider ${
                    loanForm.type === 'borrow'
                      ? 'bg-gradient-to-r from-[#123524] to-[#1a4a32] text-[#D4AF37]'
                      : 'bg-emerald-600 hover:bg-emerald-700'
                  }`}
                >
                  {loanForm.type === 'borrow'
                    ? 'ကြိုထုတ်ငွေ စာရင်းသွင်းမည်'
                    : 'ပြန်ဆပ်ငွေ စာရင်းသွင်းမည်'}
                </button>
              </div>
            </form>
          </div>

          {/* Right Column: Loans History Table */}
          <div className="lg:col-span-7 bg-white rounded-2xl shadow-sm overflow-hidden border border-gray-200 flex flex-col">
            <div className="p-4 sm:p-5 bg-gradient-to-r from-[#0B2419] via-[#123524] to-[#1a4a32] text-white flex flex-wrap justify-between items-center gap-3 border-b border-[#D4AF37]/40">
              <div>
                <h3 className="font-black text-sm sm:text-base text-[#D4AF37]">
                  ကြိုထုတ်ငွေ / ပြန်ဆပ်ငွေ မှတ်တမ်းများ ({filteredLoans.length})
                </h3>
                <p className="text-[11px] text-gray-300 mt-0.5">
                  စုစုပေါင်း ပြန်ရရန်ကျန်သော ကြိုထုတ်ငွေ:{' '}
                  <strong className="text-[#D4AF37]">
                    {formatPrice(globalSummary.totalActiveLoansAmt)}
                  </strong>
                </p>
              </div>
              <select
                value={loanFilter}
                onChange={(e) => setLoanFilter(e.target.value)}
                className="p-2 border border-[#D4AF37]/50 rounded-xl text-xs outline-none bg-white text-[#123524] font-black shadow-sm"
              >
                <option value="">All Therapists (ဝန်ထမ်းအားလုံး)</option>
                {uniqueTherapists.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="overflow-x-auto flex-1">
              <table className="w-full text-xs text-left border-collapse min-w-[540px]">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200 text-[11px] text-gray-500 uppercase">
                    <th className="p-3.5">Name / Date</th>
                    <th className="p-3.5">Type & Note</th>
                    <th className="p-3.5 text-right">Amount</th>
                    <th className="p-3.5 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredLoans.map((l) => (
                    <tr key={l.id} className="hover:bg-purple-50/40 transition">
                      <td className="p-3.5">
                        <div className="font-black text-[#123524] text-sm">{l.therapistName}</div>
                        <div className="text-gray-500 font-mono font-bold text-[10px] mt-0.5">
                          {l.date}
                        </div>
                      </td>
                      <td className="p-3.5">
                        {l.amount < 0 ? (
                          <span className="bg-emerald-100 text-emerald-800 border border-emerald-200 px-2 py-0.5 rounded text-[9px] font-black mr-2">
                            ✓ ပြန်ဆပ်ပြီး
                          </span>
                        ) : (
                          <span className="bg-purple-100 text-purple-800 border border-purple-200 px-2 py-0.5 rounded text-[9px] font-black mr-2">
                            💸 ကြိုထုတ်ငွေ
                          </span>
                        )}
                        <span className="text-gray-700 font-semibold">{l.note}</span>
                      </td>
                      <td
                        className={`p-3.5 text-right font-black text-sm whitespace-nowrap ${
                          l.amount > 0 ? 'text-purple-700' : 'text-emerald-600'
                        }`}
                      >
                        {l.amount > 0 ? '+' : ''}
                        {formatPrice(Number(l.amount))}
                      </td>
                      <td className="p-3.5 text-center">
                        <button
                          type="button"
                          onClick={() => {
                            if (window.confirm('ဖျက်ရန်သေချာပါသလား?')) {
                              deleteDoc(doc(db, 'loans', l.id));
                            }
                          }}
                          className="text-gray-400 hover:text-red-600 p-1.5 rounded-lg hover:bg-red-50 transition"
                        >
                          <Trash2 size={15} />
                        </button>
                      </td>
                    </tr>
                  ))}
                  {filteredLoans.length === 0 && (
                    <tr>
                      <td colSpan={4} className="p-10 text-center text-gray-400 font-bold">
                        ကြိုထုတ်ငွေ မှတ်တမ်းမရှိသေးပါ။
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          9. 360° STAFF FINANCIAL LEDGER MODAL (PENALTIES + DEPOSITS + LOANS)
         ========================================================================= */}
      {selectedTherapistStats && (
        <div
          className="fixed inset-0 z-[9999] bg-black/70 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in"
          onClick={() => setSelectedTherapistId(null)}
        >
          <div
            className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl border border-[#D4AF37]/40 relative max-h-[88vh] flex flex-col overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="p-5 bg-gradient-to-r from-[#0B2419] via-[#123524] to-[#1a4a32] text-white flex items-center justify-between border-b border-[#D4AF37]/40">
              <div>
                <span className="text-[10px] font-black uppercase tracking-widest text-[#D4AF37] block">
                  360° Staff Financial Profile
                </span>
                <h3 className="font-black text-lg text-white mt-0.5">
                  {selectedTherapistStats.name} — အသေးစိတ် ငွေစာရင်းမှတ်တမ်း
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedTherapistId(null)}
                className="p-2 rounded-xl bg-white/10 hover:bg-red-500 text-white transition"
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Summary Strip */}
            <div className="p-4 bg-gray-50 border-b border-gray-200 grid grid-cols-3 gap-3 text-center">
              <div
                onClick={() => setModalActiveTab('deposits')}
                className={`p-3 rounded-xl border cursor-pointer transition ${
                  modalActiveTab === 'deposits'
                    ? 'bg-blue-50 border-blue-400 ring-1 ring-blue-400'
                    : 'bg-white border-gray-200'
                }`}
              >
                <span className="text-[10px] font-black text-blue-800 uppercase block">
                  အပ်ငွေ လက်ကျန် ({selectedTherapistStats.depositList.length})
                </span>
                <span className="text-sm sm:text-base font-black text-blue-900 mt-0.5 block">
                  {formatPrice(selectedTherapistStats.depositBalance)}
                </span>
              </div>

              <div
                onClick={() => setModalActiveTab('penalties')}
                className={`p-3 rounded-xl border cursor-pointer transition ${
                  modalActiveTab === 'penalties'
                    ? 'bg-red-50 border-red-400 ring-1 ring-red-400'
                    : 'bg-white border-gray-200'
                }`}
              >
                <span className="text-[10px] font-black text-red-700 uppercase block">
                  ဒဏ်ကြေးကျန် ({selectedTherapistStats.unpaidCount} ခု)
                </span>
                <span className="text-sm sm:text-base font-black text-red-600 mt-0.5 block">
                  {formatPrice(selectedTherapistStats.totalUnpaid)}
                </span>
              </div>

              <div
                onClick={() => setModalActiveTab('loans')}
                className={`p-3 rounded-xl border cursor-pointer transition ${
                  modalActiveTab === 'loans'
                    ? 'bg-purple-50 border-purple-400 ring-1 ring-purple-400'
                    : 'bg-white border-gray-200'
                }`}
              >
                <span className="text-[10px] font-black text-purple-800 uppercase block">
                  ကြိုထုတ်ငွေကျန် ({selectedTherapistStats.loanList.length})
                </span>
                <span className="text-sm sm:text-base font-black text-purple-900 mt-0.5 block">
                  {formatPrice(selectedTherapistStats.totalLoan)}
                </span>
              </div>
            </div>

            {/* Modal Tab Content */}
            <div className="p-5 overflow-y-auto flex-1 space-y-3">
              {modalActiveTab === 'penalties' && (
                <>
                  {selectedTherapistStats.list.length === 0 ? (
                    <p className="text-xs text-gray-400 text-center py-8 font-bold">
                      ဒဏ်ကြေး မှတ်တမ်းမရှိပါ။
                    </p>
                  ) : (
                    selectedTherapistStats.list.map((p: any) => {
                      const amt = calculateAmount(p);
                      return (
                        <div
                          key={p.id}
                          className={`p-3.5 rounded-xl border text-xs flex items-center justify-between gap-3 ${
                            p.isPaid
                              ? 'bg-emerald-50/50 border-emerald-200'
                              : 'bg-red-50/70 border-red-200'
                          }`}
                        >
                          <div>
                            <div className="font-black text-gray-800">
                              {p.date} — {p.category}
                            </div>
                            {p.remark && (
                              <div className="text-red-600 font-semibold mt-0.5">- {p.remark}</div>
                            )}
                            <div className="text-[10px] font-bold text-gray-500 mt-1">
                              {p.isPaid
                                ? `✓ ပေးဆောင်ပြီး (${p.paidMethod || 'cash'})`
                                : '⏳ မဆောင်ရသေး'}
                            </div>
                          </div>
                          <div className="text-right flex-shrink-0">
                            <div
                              className={`font-black text-sm ${
                                p.isPaid ? 'text-emerald-700' : 'text-red-600'
                              }`}
                            >
                              {formatPrice(amt)}
                            </div>
                            {!p.isPaid && (
                              <div className="flex gap-1 mt-1.5">
                                <button
                                  type="button"
                                  onClick={() => handleMarkAsPaid(p, 'cash')}
                                  className="px-2 py-1 bg-emerald-600 text-white rounded text-[9px] font-black"
                                >
                                  Cash
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleMarkAsPaid(p, 'deposit')}
                                  className="px-2 py-1 bg-blue-600 text-white rounded text-[9px] font-black"
                                >
                                  Deposit
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleMarkAsPaid(p, 'salary')}
                                  className="px-2 py-1 bg-[#123524] text-[#D4AF37] rounded text-[9px] font-black"
                                >
                                  Salary
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                </>
              )}

              {modalActiveTab === 'deposits' && (
                <>
                  {selectedTherapistStats.depositList.length === 0 ? (
                    <p className="text-xs text-gray-400 text-center py-8 font-bold">
                      အပ်ငွေ မှတ်တမ်းမရှိပါ။
                    </p>
                  ) : (
                    selectedTherapistStats.depositList.map((d: any) => (
                      <div
                        key={d.id}
                        className={`p-3.5 rounded-xl border text-xs flex justify-between items-center ${
                          d.amount > 0
                            ? 'bg-blue-50/50 border-blue-200'
                            : 'bg-red-50/50 border-red-200'
                        }`}
                      >
                        <div>
                          <div className="font-black text-gray-800">{d.date}</div>
                          <div className="text-gray-600 font-semibold mt-0.5">{d.note}</div>
                        </div>
                        <div
                          className={`font-black text-sm ${
                            d.amount > 0 ? 'text-blue-700' : 'text-red-600'
                          }`}
                        >
                          {d.amount > 0 ? '+' : ''}
                          {formatPrice(Number(d.amount))}
                        </div>
                      </div>
                    ))
                  )}
                </>
              )}

              {modalActiveTab === 'loans' && (
                <>
                  {selectedTherapistStats.loanList.length === 0 ? (
                    <p className="text-xs text-gray-400 text-center py-8 font-bold">
                      ကြိုထုတ်ငွေ မှတ်တမ်းမရှိပါ။
                    </p>
                  ) : (
                    selectedTherapistStats.loanList.map((l: any) => (
                      <div
                        key={l.id}
                        className={`p-3.5 rounded-xl border text-xs flex justify-between items-center ${
                          l.amount > 0
                            ? 'bg-purple-50/50 border-purple-200'
                            : 'bg-emerald-50/50 border-emerald-200'
                        }`}
                      >
                        <div>
                          <div className="font-black text-gray-800">{l.date}</div>
                          <div className="text-gray-600 font-semibold mt-0.5">{l.note}</div>
                        </div>
                        <div
                          className={`font-black text-sm ${
                            l.amount > 0 ? 'text-purple-700' : 'text-emerald-600'
                          }`}
                        >
                          {l.amount > 0 ? '+' : ''}
                          {formatPrice(Number(l.amount))}
                        </div>
                      </div>
                    ))
                  )}
                </>
              )}
            </div>

            <div className="p-4 bg-gray-50 border-t border-gray-200 flex justify-between items-center">
              {selectedTherapistStats.totalLoan > 0 ? (
                <button
                  type="button"
                  onClick={() =>
                    handleSyncLoanToPayroll(
                      selectedTherapistStats.id,
                      selectedTherapistStats.name,
                      selectedTherapistStats.totalLoan
                    )
                  }
                  className="px-4 py-2 bg-[#123524] text-[#D4AF37] rounded-xl text-xs font-black flex items-center gap-1.5"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>
                    ကြိုထုတ်ငွေ ({formatPrice(selectedTherapistStats.totalLoan)}) အား{' '}
                    {targetPayrollMonth} လစာမှနှုတ်ရန် ပို့မည်
                  </span>
                </button>
              ) : (
                <span className="text-xs text-gray-500 font-bold">
                  ✓ ကြိုထုတ်ငွေ လက်ကျန်မရှိပါ
                </span>
              )}

              <button
                type="button"
                onClick={() => setSelectedTherapistId(null)}
                className="px-5 py-2 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-xl text-xs font-black"
              >
                ပိတ်မည် (Close)
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// 🌟 2. STAFF PENALTY, DEPOSIT & LOAN VIEW (FOR STAFF PORTAL APP) 🌟
// ============================================================================
export function StaffPenaltyView({ therapistName }: { therapistName: string }) {
  const [penalties, setPenalties] = useState<any[]>([]);
  const [loans, setLoans] = useState<any[]>([]);
  const [deposits, setDeposits] = useState<any[]>([]);
  const [activeView, setActiveView] = useState<'penalties' | 'loans' | 'deposits'>('penalties');

  useEffect(() => {
    const unsubP = onSnapshot(collection(db, 'penalties'), (snap) =>
      setPenalties(
        snap.docs
          .map((d) => ({ id: d.id, ...d.data() }))
          .filter((p: any) => isSameStaffMember(p.therapistName || '', therapistName))
          .sort((a: any, b: any) => (b.createdAt || 0) - (a.createdAt || 0))
      )
    );
    const unsubL = onSnapshot(collection(db, 'loans'), (snap) =>
      setLoans(
        snap.docs
          .map((d) => ({ id: d.id, ...d.data() }))
          .filter((l: any) => isSameStaffMember(l.therapistName || '', therapistName))
          .sort((a: any, b: any) => (b.createdAt || 0) - (a.createdAt || 0))
      )
    );
    const unsubD = onSnapshot(collection(db, 'deposits'), (snap) =>
      setDeposits(
        snap.docs
          .map((d) => ({ id: d.id, ...d.data() }))
          .filter((d: any) => isSameStaffMember(d.therapistName || '', therapistName))
          .sort((a: any, b: any) => (b.createdAt || 0) - (a.createdAt || 0))
      )
    );
    return () => {
      unsubP();
      unsubL();
      unsubD();
    };
  }, [therapistName]);

  const totalUnpaidPenalties = penalties
    .filter((p) => !p.isPaid)
    .reduce((sum, p) => sum + calculateAmount(p), 0);
  const totalLoanBalance = Math.max(
    0,
    loans.reduce((sum, l) => sum + (Number(l.amount) || 0), 0)
  );
  const totalDeposit = deposits.reduce((sum, d) => sum + (Number(d.amount) || 0), 0);

  return (
    <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 mt-6 animate-fade-in">
      <h3 className="text-base font-black text-[#123524] mb-4 flex items-center">
        <Banknote className="w-5 h-5 mr-2 text-[#D4AF37]" /> ကျွန်ုပ်၏ အပ်ငွေ၊ ဒဏ်ကြေးနှင့် ကြိုထုတ်ငွေစာရင်း
      </h3>

      <div className="grid grid-cols-3 gap-3 mb-6">
        <div
          onClick={() => setActiveView('deposits')}
          className={`p-3 rounded-xl border text-center cursor-pointer transition-all ${
            activeView === 'deposits'
              ? 'bg-[#123524] text-[#D4AF37] border-[#D4AF37] shadow-md scale-[1.02]'
              : 'bg-blue-50/50 border-blue-200 text-blue-900 hover:border-blue-300'
          }`}
        >
          <span className="text-[10px] font-bold uppercase block opacity-85">အပ်ထားငွေ လက်ကျန်</span>
          <span className="text-sm sm:text-base font-black mt-0.5 block">
            {formatPrice(totalDeposit)}
          </span>
        </div>

        <div
          onClick={() => setActiveView('penalties')}
          className={`p-3 rounded-xl border text-center cursor-pointer transition-all ${
            activeView === 'penalties'
              ? 'bg-red-50 border-red-400 shadow-md scale-[1.02]'
              : 'bg-red-50/40 border-red-100 hover:border-red-300'
          }`}
        >
          <span className="text-[10px] font-bold text-red-600 uppercase block">
            မဆောင်ရသေး ဒဏ်ကြေး
          </span>
          <span className="text-sm sm:text-base font-black text-red-700 mt-0.5 block">
            {formatPrice(totalUnpaidPenalties)}
          </span>
        </div>

        <div
          onClick={() => setActiveView('loans')}
          className={`p-3 rounded-xl border text-center cursor-pointer transition-all ${
            activeView === 'loans'
              ? 'bg-purple-50 border-purple-400 shadow-md scale-[1.02]'
              : 'bg-purple-50/40 border-purple-100 hover:border-purple-300'
          }`}
        >
          <span className="text-[10px] font-bold text-purple-700 uppercase block">
            ကြိုထုတ်ငွေ လက်ကျန်
          </span>
          <span className="text-sm sm:text-base font-black text-purple-800 mt-0.5 block">
            {formatPrice(totalLoanBalance)}
          </span>
        </div>
      </div>

      <div className="space-y-6">
        {activeView === 'penalties' && (
          <div className="animate-fade-in">
            <h4 className="text-xs font-bold text-gray-700 mb-3 uppercase tracking-wider border-b pb-2">
              ဒဏ်ကြေး မှတ်တမ်းများ
            </h4>
            <div className="space-y-2.5">
              {penalties.length === 0 ? (
                <p className="text-xs text-gray-400 text-center py-4 bg-gray-50 rounded-xl">
                  ဒဏ်ကြေး မှတ်တမ်း မရှိပါ
                </p>
              ) : (
                penalties.map((p) => {
                  const days = getDaysOverdue(p.date);
                  const amount = calculateAmount(p);
                  const isOverdue = !p.isPaid && !p.disableDoubling && days > 0;

                  return (
                    <div
                      key={p.id}
                      className={`p-3.5 rounded-xl border text-xs flex flex-col ${
                        p.isPaid
                          ? 'bg-green-50/60 border-green-200'
                          : 'bg-red-50 border-red-200'
                      }`}
                    >
                      <div className="flex justify-between items-start mb-1.5">
                        <span className="font-bold text-gray-800 text-sm">{p.date}</span>
                        <span
                          className={`font-black text-sm ${
                            p.isPaid ? 'text-green-700' : 'text-red-600'
                          }`}
                        >
                          {formatPrice(amount)}
                        </span>
                      </div>
                      <p className="font-semibold text-gray-700">{p.category}</p>
                      {p.remark && (
                        <p className="text-red-500 font-semibold text-[11px] mt-1">- {p.remark}</p>
                      )}
                      <div className="mt-2 pt-2 border-t border-gray-200/60 flex justify-between items-center">
                        {p.isPaid ? (
                          <span className="text-[10px] font-bold text-green-700 bg-green-100 px-2 py-0.5 rounded">
                            ✓ ပေးဆောင်ပြီး (
                            {p.paidMethod === 'deposit'
                              ? 'အပ်ငွေမှနှုတ်သည်'
                              : p.paidMethod === 'salary'
                              ? 'လစာမှနှုတ်သည်'
                              : 'လက်ငင်း'}
                            )
                          </span>
                        ) : (
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                              isOverdue
                                ? 'bg-red-100 text-red-700'
                                : 'bg-yellow-100 text-yellow-700'
                            }`}
                          >
                            {isOverdue ? `! ရက်လွန်နေသည် (${days} ရက်)` : '• ယနေ့ဆောင်ရန်'}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}

        {activeView === 'deposits' && (
          <div className="animate-fade-in">
            <h4 className="text-xs font-bold text-gray-700 mb-3 uppercase tracking-wider border-b pb-2">
              အပ်ငွေ / ဖြတ်တောက်မှု မှတ်တမ်းများ
            </h4>
            <div className="space-y-2.5">
              {deposits.length === 0 ? (
                <p className="text-xs text-gray-400 text-center py-4 bg-gray-50 rounded-xl">
                  အပ်ငွေ မှတ်တမ်း မရှိပါ
                </p>
              ) : (
                deposits.map((d) => (
                  <div
                    key={d.id}
                    className={`p-3.5 rounded-xl border text-xs flex flex-col ${
                      d.amount > 0 ? 'bg-blue-50 border-blue-200' : 'bg-red-50 border-red-200'
                    }`}
                  >
                    <div className="flex justify-between items-start mb-1.5">
                      <span className="font-bold text-gray-800 text-sm">{d.date}</span>
                      <span
                        className={`font-black text-sm ${
                          d.amount > 0 ? 'text-blue-600' : 'text-red-600'
                        }`}
                      >
                        {d.amount > 0 ? '+' : ''}
                        {formatPrice(Number(d.amount))}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      {d.amount < 0 ? (
                        <span className="bg-red-100 text-red-700 px-2 py-0.5 rounded text-[10px] font-bold">
                          နှုတ်ယူမှု
                        </span>
                      ) : (
                        <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded text-[10px] font-bold">
                          အပ်ငွေသွင်း
                        </span>
                      )}
                      <span className="text-gray-600 font-semibold">{d.note}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {activeView === 'loans' && (
          <div className="animate-fade-in">
            <h4 className="text-xs font-bold text-gray-700 mb-3 uppercase tracking-wider border-b pb-2">
              ကြိုထုတ်ငွေ / ပြန်ဆပ်ငွေ မှတ်တမ်းများ
            </h4>
            <div className="space-y-2.5">
              {loans.length === 0 ? (
                <p className="text-xs text-gray-400 text-center py-4 bg-gray-50 rounded-xl">
                  ချေးငွေ မှတ်တမ်း မရှိပါ
                </p>
              ) : (
                loans.map((l) => (
                  <div
                    key={l.id}
                    className={`p-3.5 rounded-xl border text-xs flex flex-col ${
                      l.amount > 0 ? 'bg-purple-50 border-purple-200' : 'bg-green-50 border-green-200'
                    }`}
                  >
                    <div className="flex justify-between items-start mb-1.5">
                      <span className="font-bold text-gray-800 text-sm">{l.date}</span>
                      <span
                        className={`font-black text-sm ${
                          l.amount > 0 ? 'text-purple-700' : 'text-green-700'
                        }`}
                      >
                        {l.amount > 0 ? '' : '-'}
                        {formatPrice(Math.abs(Number(l.amount)))}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      {l.amount < 0 ? (
                        <span className="bg-green-100 text-green-700 px-2 py-0.5 rounded text-[10px] font-bold">
                          ပြန်ဆပ်
                        </span>
                      ) : (
                        <span className="bg-purple-100 text-purple-700 px-2 py-0.5 rounded text-[10px] font-bold">
                          ကြိုထုတ်
                        </span>
                      )}
                      <span className="text-gray-600 font-semibold">{l.note}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
