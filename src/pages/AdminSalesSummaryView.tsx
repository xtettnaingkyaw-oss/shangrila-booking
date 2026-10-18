import React, { useState, useMemo } from 'react';
import {
  BarChart2, Calendar, Clock, User, Download, TrendingUp,
  ShoppingBag, Percent, CreditCard, Sparkles, Tag, Layers,
  FileText, ArrowUpRight, ArrowDownRight, Search, CheckCircle, AlertCircle
} from 'lucide-react';
import { AppData, Booking, formatPrice } from '../shared';
import { decryptText } from '../security';

interface NormalizedSaleItem {
  name: string;
  category: string;
  qty: number;
  revenue: number;
  isVvip: boolean;
}

interface NormalizedSale {
  id: string;
  invoiceNo: string;
  date: string; // YYYY-MM-DD
  time: string;
  hour24: number;
  createdAt: number;
  customerName: string;
  customerPhone: string;
  therapistRaw: string;
  therapists: string[];
  serviceRaw: string;
  parsedItems: NormalizedSaleItem[];
  grossAmount: number;
  discountAmount: number;
  discountPercent: number;
  discountLabel: string;
  netAmount: number;
  collectedAmount: number;
  balanceDue: number;
  paymentMethodClean: string;
  channel: 'pos' | 'online';
  status: string;
  isCancelled: boolean;
}

type DatePreset =
  | 'today'
  | 'yesterday'
  | 'this_week'
  | 'last_week'
  | 'this_month'
  | 'last_month'
  | 'last_7_days'
  | 'last_30_days'
  | 'custom';

type ReportSubView =
  | 'summary'
  | 'by_item'
  | 'by_category'
  | 'by_employee'
  | 'by_payment'
  | 'discounts'
  | 'receipts';

const toYMD = (d: Date) => {
  return (
    d.getFullYear() +
    '-' +
    String(d.getMonth() + 1).padStart(2, '0') +
    '-' +
    String(d.getDate()).padStart(2, '0')
  );
};

const safeNum = (val: any): number => {
  if (val === undefined || val === null || val === '') return 0;
  if (typeof val === 'number') return isNaN(val) ? 0 : val;
  const str = String(val).trim();
  const dec = decryptText(str);
  const n = Number(dec || str);
  return isNaN(n) ? 0 : n;
};

const safeStr = (val: any): string => {
  if (!val) return '';
  if (typeof val !== 'string') return String(val);
  return decryptText(val) || val;
};

const parseHourFromTimeStr = (timeStr: string, createdAt?: number): number => {
  if (timeStr) {
    const match12 = timeStr.match(/(\d+):(\d+)\s*(AM|PM)/i);
    if (match12) {
      let h = parseInt(match12[1], 10);
      const ampm = match12[3].toUpperCase();
      if (ampm === 'PM' && h < 12) h += 12;
      if (ampm === 'AM' && h === 12) h = 0;
      return h;
    }
    const match24 = timeStr.match(/(\d+):(\d+)/);
    if (match24) {
      return parseInt(match24[1], 10);
    }
  }
  if (createdAt) {
    return new Date(createdAt).getHours();
  }
  return 12;
};

export default function AdminSalesSummaryView({
  bookings,
  appData
}: {
  bookings: Booking[];
  appData: AppData;
}) {
  // 🌟 1. Loyverse-Style Filter States 🌟
  const [datePreset, setDatePreset] = useState<DatePreset>('this_month');
  const [customStartDate, setCustomStartDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(1);
    return toYMD(d);
  });
  const [customEndDate, setCustomEndDate] = useState<string>(() => toYMD(new Date()));
  const [showDateDropdown, setShowDateDropdown] = useState(false);

  const [channelFilter, setChannelFilter] = useState<'all' | 'pos' | 'online'>('all');
  const [employeeFilter, setEmployeeFilter] = useState<string>('all');
  const [timeSlotFilter, setTimeSlotFilter] = useState<'all' | 'morning' | 'afternoon' | 'evening'>('all');

  const [activeReportTab, setActiveReportTab] = useState<ReportSubView>('summary');
  const [activeKpiMetric, setActiveKpiMetric] = useState<'gross' | 'net' | 'discounts' | 'collected'>('net');
  const [chartType, setChartType] = useState<'area' | 'bar'>('area');
  const [chartGranularity, setChartGranularity] = useState<'days' | 'hours'>('days');
  const [receiptSearch, setReceiptSearch] = useState('');

  // 🌟 Build Lookup Map for Menu Items -> Category & Price 🌟
  const menuLookup = useMemo(() => {
    const map = new Map<string, { categoryTitle: string; price: number }>();
    (appData?.categories || []).forEach((cat) => {
      (cat.items || []).forEach((item) => {
        map.set(item.name.trim().toLowerCase(), {
          categoryTitle: cat.title,
          price: Number(item.price) || 0
        });
      });
    });
    return map;
  }, [appData?.categories]);

  // 🌟 Calculate Current Date Range & Previous Comparison Date Range 🌟
  const { startDateStr, endDateStr, prevStartDateStr, prevEndDateStr, periodLabel } = useMemo(() => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    let start = new Date(today);
    let end = new Date(today);
    let label = 'This Month';

    if (datePreset === 'today') {
      label = `Today (${toYMD(today)})`;
    } else if (datePreset === 'yesterday') {
      start.setDate(today.getDate() - 1);
      end.setDate(today.getDate() - 1);
      label = `Yesterday (${toYMD(start)})`;
    } else if (datePreset === 'this_week') {
      const day = today.getDay() || 7;
      start.setDate(today.getDate() - day + 1);
      label = 'This Week';
    } else if (datePreset === 'last_week') {
      const day = today.getDay() || 7;
      end.setDate(today.getDate() - day);
      start = new Date(end);
      start.setDate(end.getDate() - 6);
      label = 'Last Week';
    } else if (datePreset === 'this_month') {
      start = new Date(today.getFullYear(), today.getMonth(), 1);
      label = today.toLocaleString('en-US', { month: 'long', year: 'numeric' });
    } else if (datePreset === 'last_month') {
      start = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      end = new Date(today.getFullYear(), today.getMonth(), 0);
      label = start.toLocaleString('en-US', { month: 'long', year: 'numeric' });
    } else if (datePreset === 'last_7_days') {
      start.setDate(today.getDate() - 6);
      label = 'Last 7 Days';
    } else if (datePreset === 'last_30_days') {
      start.setDate(today.getDate() - 29);
      label = 'Last 30 Days';
    } else if (datePreset === 'custom') {
      const [sy, sm, sd] = (customStartDate || toYMD(today)).split('-').map(Number);
      const [ey, em, ed] = (customEndDate || toYMD(today)).split('-').map(Number);
      start = new Date(sy, (sm || 1) - 1, sd || 1);
      end = new Date(ey, (em || 1) - 1, ed || 1);
      if (start > end) {
        const tmp = start;
        start = end;
        end = tmp;
      }
      label = `${toYMD(start)} — ${toYMD(end)}`;
    }

    const diffDays = Math.max(1, Math.round((end.getTime() - start.getTime()) / 86400000) + 1);
    const prevEnd = new Date(start);
    prevEnd.setDate(start.getDate() - 1);
    const prevStart = new Date(prevEnd);
    prevStart.setDate(prevEnd.getDate() - diffDays + 1);

    return {
      startDateStr: toYMD(start),
      endDateStr: toYMD(end),
      prevStartDateStr: toYMD(prevStart),
      prevEndDateStr: toYMD(prevEnd),
      periodLabel: label
    };
  }, [datePreset, customStartDate, customEndDate]);

 // 🌟 Normalize All Bookings (Both Online & Walk-in POS) with Strict Non-Revenue Filter 🌟
  const allNormalizedSales: NormalizedSale[] = useMemo(() => {
    return bookings
      .filter((b: any) => {
        const rawTx = String(decryptText(b.txId) || b.txId || '').trim();
        const rawTxUpper = rawTx.toUpperCase();
        const rawName = String(decryptText(b.name) || b.name || '').trim().toLowerCase();
        const rawPay = String(b.paymentMethod || '').trim().toLowerCase();
        const rawDisc = String(decryptText(b.discountLabel) || b.discountLabel || '').trim().toLowerCase();
        const rawService = String(b.service || '').trim().toLowerCase();
        const rawTime = String(b.time || '').trim().toLowerCase();
        const priceNum = Number(b.totalPrice) || 0;

        // 1. Exclude Admin Manual Clock-in or Cashier Staff Clock-In dummy records
        if (
          rawTxUpper === 'ADMIN' ||
          rawTxUpper === 'CASH' ||
          rawTx === '' ||
          rawTx === '-'
        ) {
          return false;
        }

        // 2. Exclude Walk-in Reward Redemption (0 Ks)
        if (rawService.includes('walk-in reward redemption') || priceNum <= 0) {
          return false;
        }

        // 3. Exclude Staff App Clock-In records ('Cash Payment in Shop' or 'Walk-in' without proper POS invoice)
        const isStaffClockInRecord =
          rawPay.includes('cash payment in shop') ||
          rawName.includes('walk-in') ||
          Boolean(b.isStaffClockIn);

        // If it's a staff clock-in and NOT a genuine POS bill (SL-...) and NOT a genuine online booking, exclude it
        const isGenuinePos = rawTxUpper.startsWith('SL-') || rawPay.includes('shop pos') || rawDisc.includes('[shop walk-in') || Boolean(b.posLocalId);
        const isGenuineOnline = !isStaffClockInRecord && !isGenuinePos && priceNum > 0;

        if (isStaffClockInRecord && !isGenuinePos && !isGenuineOnline) {
          return false;
        }

        return true;
      })
      .map((b: any) => {
        const tx = safeStr(b.txId) || b.id || '-';
        const custName = safeStr(b.name) || 'Walk-in Guest';
        const custPhone = safeStr(b.phone) || '-';
        const discLabelRaw = safeStr(b.discountLabel);
        const cleanDiscLabel = discLabelRaw
          .replace('[Shop Walk-in Sale]', '')
          .replace('[Shop Walk-in]', '')
          .trim();

        const isPos =
          tx.startsWith('SL-') ||
          (b.paymentMethod &&
            (b.paymentMethod.includes('Shop POS') ||
              b.paymentMethod.includes('စရံ:') ||
              b.paymentMethod.includes('Full Paid - Approved'))) ||
          discLabelRaw.includes('[Shop Walk-in');

        const netAmt = safeNum(b.totalPrice);
        const origAmt = safeNum(b.originalPrice) || netAmt;
        const grossAmt = Math.max(origAmt, netAmt);
        const discAmt = Math.max(0, grossAmt - netAmt);
        const discPct =
          safeNum(b.discountPercent) ||
          (grossAmt > 0 && discAmt > 0 ? Math.round((discAmt / grossAmt) * 100) : 0);

        const isDepositOnly = b.paymentStatus === 'deposit_only' && safeNum(b.balanceDue) > 0;
        const balanceDue = isDepositOnly ? safeNum(b.balanceDue) : 0;
        const collectedAmt = isDepositOnly
          ? safeNum(b.depositPaid) || Math.max(0, netAmt - balanceDue)
          : netAmt;

        let payMethodClean = (b.paymentMethod || 'Cash').split('(')[0].trim();
        if (payMethodClean.toLowerCase().includes('cash')) payMethodClean = 'Cash';

        const therapistRaw = b.therapist || 'Any Available Therapist';
        const therapists = therapistRaw
          .split(/&|,/)
          .map((t: string) => t.trim())
          .filter((t: string) => t && t !== '-');

        // Parse individual service items from service summary string
        const rawParts = (b.service || 'General Service')
          .split(',')
          .map((s: string) => s.trim())
          .filter(Boolean);

        const tempItems = rawParts.map((part: string) => {
          let s = part;
          let qty = 1;
          const qMatch = s.match(/\s+x(\d+)$/i) || s.match(/\(x(\d+)\)$/i);
          if (qMatch) {
            qty = parseInt(qMatch[1], 10) || 1;
            s = s.replace(qMatch[0], '').trim();
          }
          const isVvip = s.includes('+ VVIP') || s.toLowerCase().includes('vvip');
          s = s.replace('+ VVIP', '').trim();
          const baseName = s.replace(/\s*\([^)]*\)\s*$/, '').trim() || s;

          const matchedMenu = menuLookup.get(baseName.toLowerCase());
          let category = matchedMenu?.categoryTitle || 'Extra Sale Items';
          if (!matchedMenu) {
            const lower = baseName.toLowerCase();
            if (lower.includes('massage') || lower.includes('hands')) category = 'Massage';
            else if (lower.includes('scrub')) category = 'Body Scrub';
            else if (lower.includes('wax')) category = 'Waxing';
            else if (lower.includes('outcall') || lower.includes('day') || lower.includes('night'))
              category = 'Hotel & Home Services';
          }
          const unitMenuPrice = (matchedMenu?.price || 25000) + (isVvip ? 15000 : 0);
          return {
            name: baseName,
            category,
            qty,
            isVvip,
            weightPrice: unitMenuPrice * qty
          };
        });

        const totalWeight = tempItems.reduce((acc: number, it: any) => acc + it.weightPrice, 0) || 1;
        const parsedItems: NormalizedSaleItem[] = tempItems.map((it: any) => ({
          name: it.name,
          category: it.category,
          qty: it.qty,
          isVvip: it.isVvip,
          revenue: Math.round(netAmt * (it.weightPrice / totalWeight))
        }));

        const hour24 = parseHourFromTimeStr(b.time || '', b.createdAt);

        return {
          id: b.id || tx,
          invoiceNo: tx,
          date: b.date || toYMD(new Date(b.createdAt || Date.now())),
          time: b.time || '',
          hour24,
          createdAt: b.createdAt || Date.now(),
          customerName: custName,
          customerPhone: custPhone,
          therapistRaw,
          therapists,
          serviceRaw: b.service || '-',
          parsedItems,
          grossAmount: grossAmt,
          discountAmount: discAmt,
          discountPercent: discPct,
          discountLabel: cleanDiscLabel || (discAmt > 0 ? 'Special Discount' : ''),
          netAmount: netAmt,
          collectedAmount: collectedAmt,
          balanceDue,
          paymentMethodClean: payMethodClean,
          channel: isPos ? 'pos' : 'online',
          status: b.status || 'completed',
          isCancelled: b.status === 'cancelled'
        };
      });
  }, [bookings, menuLookup]);

  // Helper to apply Channel, Employee, and Time-of-Day filters
  const matchesNonDateFilters = (sale: NormalizedSale) => {
    if (channelFilter !== 'all' && sale.channel !== channelFilter) return false;
    if (employeeFilter !== 'all' && !sale.therapists.includes(employeeFilter)) return false;
    if (timeSlotFilter !== 'all') {
      if (timeSlotFilter === 'morning' && (sale.hour24 < 6 || sale.hour24 >= 12)) return false;
      if (timeSlotFilter === 'afternoon' && (sale.hour24 < 12 || sale.hour24 >= 17)) return false;
      if (timeSlotFilter === 'evening' && sale.hour24 < 17 && sale.hour24 >= 6) return false;
    }
    return true;
  };

  // 🌟 Current Period Sales & Previous Period Sales (For Growth % Comparison) 🌟
  const currentPeriodSales = useMemo(() => {
    return allNormalizedSales.filter(
      (s) => s.date >= startDateStr && s.date <= endDateStr && matchesNonDateFilters(s)
    );
  }, [allNormalizedSales, startDateStr, endDateStr, channelFilter, employeeFilter, timeSlotFilter]);

  const previousPeriodSales = useMemo(() => {
    return allNormalizedSales.filter(
      (s) => s.date >= prevStartDateStr && s.date <= prevEndDateStr && matchesNonDateFilters(s)
    );
  }, [allNormalizedSales, prevStartDateStr, prevEndDateStr, channelFilter, employeeFilter, timeSlotFilter]);

  // 🌟 Calculate KPI Totals & Comparison Deltas 🌟
  const kpiStats = useMemo(() => {
    const calcMetrics = (list: NormalizedSale[]) => {
      let gross = 0;
      let refunds = 0;
      let refundCount = 0;
      let discounts = 0;
      let net = 0;
      let collected = 0;
      let balanceDue = 0;
      let validBills = 0;
      let posNet = 0;
      let onlineNet = 0;

      list.forEach((s) => {
        if (s.isCancelled) {
          refunds += s.netAmount;
          refundCount += 1;
        } else {
          validBills += 1;
          gross += s.grossAmount;
          discounts += s.discountAmount;
          net += s.netAmount;
          collected += s.collectedAmount;
          balanceDue += s.balanceDue;
          if (s.channel === 'pos') posNet += s.netAmount;
          else onlineNet += s.netAmount;
        }
      });

      return { gross, refunds, refundCount, discounts, net, collected, balanceDue, validBills, posNet, onlineNet };
    };

    const cur = calcMetrics(currentPeriodSales);
    const prev = calcMetrics(previousPeriodSales);

    const calcDelta = (c: number, p: number) => {
      const diff = c - p;
      const pct = p > 0 ? ((diff / p) * 100).toFixed(1) : c > 0 ? '100.0' : '0.0';
      return { diff, pct: Number(pct) };
    };

    return {
      cur,
      prev,
      grossDelta: calcDelta(cur.gross, prev.gross),
      discountsDelta: calcDelta(cur.discounts, prev.discounts),
      netDelta: calcDelta(cur.net, prev.net),
      collectedDelta: calcDelta(cur.collected, prev.collected)
    };
  }, [currentPeriodSales, previousPeriodSales]);

  // Active valid (non-cancelled) sales for breakdowns
  const validSales = useMemo(
    () => currentPeriodSales.filter((s) => !s.isCancelled),
    [currentPeriodSales]
  );

  // 🌟 Chart Data Points (By Days or By Hours) 🌟
  const chartDataPoints = useMemo(() => {
    const getMetricVal = (s: NormalizedSale) => {
      if (activeKpiMetric === 'gross') return s.grossAmount;
      if (activeKpiMetric === 'discounts') return s.discountAmount;
      if (activeKpiMetric === 'collected') return s.collectedAmount;
      return s.netAmount;
    };

    if (chartGranularity === 'hours') {
      const hourBuckets = Array.from({ length: 16 }, (_, i) => {
        const h = i + 8; // 8 AM to 11 PM
        const label = h === 12 ? '12 PM' : h > 12 ? `${h - 12} PM` : `${h} AM`;
        return { key: String(h), label, value: 0, bills: 0 };
      });
      validSales.forEach((s) => {
        const idx = Math.max(0, Math.min(15, s.hour24 - 8));
        hourBuckets[idx].value += getMetricVal(s);
        hourBuckets[idx].bills += 1;
      });
      return hourBuckets;
    }

    // By Days between startDateStr and endDateStr
    const [sy, sm, sd] = startDateStr.split('-').map(Number);
    const [ey, em, ed] = endDateStr.split('-').map(Number);
    const curDate = new Date(sy, sm - 1, sd);
    const endDate = new Date(ey, em - 1, ed);

    const dayMap = new Map<string, { key: string; label: string; value: number; bills: number }>();
    while (curDate <= endDate) {
      const ymd = toYMD(curDate);
      const shortLabel = curDate.toLocaleDateString('en-US', { month: 'short', day: '2-digit' });
      dayMap.set(ymd, { key: ymd, label: shortLabel, value: 0, bills: 0 });
      curDate.setDate(curDate.getDate() + 1);
    }

    validSales.forEach((s) => {
      if (dayMap.has(s.date)) {
        const entry = dayMap.get(s.date)!;
        entry.value += getMetricVal(s);
        entry.bills += 1;
      }
    });

    return Array.from(dayMap.values());
  }, [validSales, startDateStr, endDateStr, activeKpiMetric, chartGranularity]);

  // 🌟 Breakdown 1: Daily Summary Table 🌟
  const dailySummaryRows = useMemo(() => {
    const map = new Map<
      string,
      {
        date: string;
        bills: number;
        posBills: number;
        onlineBills: number;
        gross: number;
        discounts: number;
        net: number;
        collected: number;
        balanceDue: number;
      }
    >();

    validSales.forEach((s) => {
      if (!map.has(s.date)) {
        map.set(s.date, {
          date: s.date,
          bills: 0,
          posBills: 0,
          onlineBills: 0,
          gross: 0,
          discounts: 0,
          net: 0,
          collected: 0,
          balanceDue: 0
        });
      }
      const r = map.get(s.date)!;
      r.bills += 1;
      if (s.channel === 'pos') r.posBills += 1;
      else r.onlineBills += 1;
      r.gross += s.grossAmount;
      r.discounts += s.discountAmount;
      r.net += s.netAmount;
      r.collected += s.collectedAmount;
      r.balanceDue += s.balanceDue;
    });

    return Array.from(map.values()).sort((a, b) => b.date.localeCompare(a.date));
  }, [validSales]);

  // 🌟 Breakdown 2: Sales by Item 🌟
  const salesByItemRows = useMemo(() => {
    const map = new Map<
      string,
      { name: string; category: string; qty: number; vvipCount: number; netRevenue: number }
    >();

    validSales.forEach((s) => {
      s.parsedItems.forEach((it) => {
        const key = it.name.toLowerCase();
        if (!map.has(key)) {
          map.set(key, {
            name: it.name,
            category: it.category,
            qty: 0,
            vvipCount: 0,
            netRevenue: 0
          });
        }
        const row = map.get(key)!;
        row.qty += it.qty;
        if (it.isVvip) row.vvipCount += it.qty;
        row.netRevenue += it.revenue;
      });
    });

    return Array.from(map.values()).sort((a, b) => b.netRevenue - a.netRevenue);
  }, [validSales]);

  // 🌟 Breakdown 3: Sales by Category 🌟
  const salesByCategoryRows = useMemo(() => {
    const map = new Map<string, { category: string; qty: number; netRevenue: number }>();
    salesByItemRows.forEach((item) => {
      if (!map.has(item.category)) {
        map.set(item.category, { category: item.category, qty: 0, netRevenue: 0 });
      }
      const row = map.get(item.category)!;
      row.qty += item.qty;
      row.netRevenue += item.netRevenue;
    });
    return Array.from(map.values()).sort((a, b) => b.netRevenue - a.netRevenue);
  }, [salesByItemRows]);

  // 🌟 Breakdown 4: Sales by Employee (Therapist) 🌟
  const salesByEmployeeRows = useMemo(() => {
    const map = new Map<
      string,
      { therapist: string; sessions: number; grossSales: number; discounts: number; netSales: number }
    >();

    validSales.forEach((s) => {
      const tList = s.therapists.length > 0 ? s.therapists : ['Unassigned'];
      const splitDivisor = tList.length; // Four Hands splits credit or counts session for both
      tList.forEach((tName) => {
        if (!map.has(tName)) {
          map.set(tName, {
            therapist: tName,
            sessions: 0,
            grossSales: 0,
            discounts: 0,
            netSales: 0
          });
        }
        const row = map.get(tName)!;
        row.sessions += 1;
        row.grossSales += Math.round(s.grossAmount / splitDivisor);
        row.discounts += Math.round(s.discountAmount / splitDivisor);
        row.netSales += Math.round(s.netAmount / splitDivisor);
      });
    });

    return Array.from(map.values()).sort((a, b) => b.netSales - a.netSales);
  }, [validSales]);

  // 🌟 Breakdown 5: Sales by Payment Type 🌟
  const salesByPaymentRows = useMemo(() => {
    const map = new Map<
      string,
      { method: string; bills: number; netSales: number; collected: number; balanceDue: number }
    >();

    validSales.forEach((s) => {
      const m = s.paymentMethodClean || 'Cash';
      if (!map.has(m)) {
        map.set(m, { method: m, bills: 0, netSales: 0, collected: 0, balanceDue: 0 });
      }
      const row = map.get(m)!;
      row.bills += 1;
      row.netSales += s.netAmount;
      row.collected += s.collectedAmount;
      row.balanceDue += s.balanceDue;
    });

    return Array.from(map.values()).sort((a, b) => b.netSales - a.netSales);
  }, [validSales]);

  // 🌟 Breakdown 6: Discounts & Promotions Breakdown 🌟
  const discountsBreakdownRows = useMemo(() => {
    const map = new Map<
      string,
      { label: string; count: number; totalDiscountGiven: number; generatedNetSales: number }
    >();

    validSales
      .filter((s) => s.discountAmount > 0)
      .forEach((s) => {
        const lbl = s.discountLabel || `Discount (${s.discountPercent}% OFF)`;
        if (!map.has(lbl)) {
          map.set(lbl, {
            label: lbl,
            count: 0,
            totalDiscountGiven: 0,
            generatedNetSales: 0
          });
        }
        const row = map.get(lbl)!;
        row.count += 1;
        row.totalDiscountGiven += s.discountAmount;
        row.generatedNetSales += s.netAmount;
      });

    return Array.from(map.values()).sort((a, b) => b.totalDiscountGiven - a.totalDiscountGiven);
  }, [validSales]);

  // 🌟 Universal CSV Exporter for Active Sub-View 🌟
  const handleExportCurrentReport = () => {
    let headers: string[] = [];
    let rows: (string | number)[][] = [];
    let filename = `ShangriLa_Sales_${activeReportTab}_${startDateStr}_to_${endDateStr}.csv`;

    if (activeReportTab === 'summary') {
      headers = ['Date', 'Total Bills', 'POS Bills', 'Online Bills', 'Gross Sales (Ks)', 'Discounts (Ks)', 'Net Sales (Ks)', 'Collected (Ks)', 'Balance Due (Ks)'];
      rows = dailySummaryRows.map((r) => [
        r.date, r.bills, r.posBills, r.onlineBills, r.gross, r.discounts, r.net, r.collected, r.balanceDue
      ]);
    } else if (activeReportTab === 'by_item') {
      headers = ['Service / Item Name', 'Category', 'Quantity Sold', 'VVIP Upgrades', 'Net Revenue (Ks)'];
      rows = salesByItemRows.map((r) => [
        `"${r.name}"`, `"${r.category}"`, r.qty, r.vvipCount, r.netRevenue
      ]);
    } else if (activeReportTab === 'by_category') {
      headers = ['Category', 'Items Sold', 'Net Revenue (Ks)', 'Share (%)'];
      rows = salesByCategoryRows.map((r) => [
        `"${r.category}"`,
        r.qty,
        r.netRevenue,
        kpiStats.cur.net > 0 ? ((r.netRevenue / kpiStats.cur.net) * 100).toFixed(1) + '%' : '0%'
      ]);
    } else if (activeReportTab === 'by_employee') {
      headers = ['Therapist Name', 'Total Sessions', 'Gross Sales (Ks)', 'Discounts (Ks)', 'Net Sales (Ks)', 'Avg Per Session (Ks)'];
      rows = salesByEmployeeRows.map((r) => [
        `"${r.therapist}"`,
        r.sessions,
        r.grossSales,
        r.discounts,
        r.netSales,
        r.sessions > 0 ? Math.round(r.netSales / r.sessions) : 0
      ]);
    } else if (activeReportTab === 'by_payment') {
      headers = ['Payment Method', 'Transactions', 'Net Sales (Ks)', 'Collected Amount (Ks)', 'Pending Balance Due (Ks)'];
      rows = salesByPaymentRows.map((r) => [
        `"${r.method}"`, r.bills, r.netSales, r.collected, r.balanceDue
      ]);
    } else if (activeReportTab === 'discounts') {
      headers = ['Discount / Campaign Label', 'Times Used', 'Total Discount Amount (Ks)', 'Net Sales Generated (Ks)'];
      rows = discountsBreakdownRows.map((r) => [
        `"${r.label}"`, r.count, r.totalDiscountGiven, r.generatedNetSales
      ]);
    } else {
      headers = ['Invoice / TxID', 'Channel', 'Date', 'Time', 'Customer', 'Phone', 'Services', 'Therapist', 'Gross (Ks)', 'Discount (Ks)', 'Discount Label', 'Net Total (Ks)', 'Payment Method', 'Collected (Ks)', 'Balance Due (Ks)'];
      rows = currentPeriodSales.map((s) => [
        `"${s.invoiceNo}"`,
        s.channel === 'pos' ? 'Shop POS' : 'Online Booking',
        s.date,
        `"${s.time}"`,
        `"${s.customerName}"`,
        `"${s.customerPhone}"`,
        `"${s.serviceRaw}"`,
        `"${s.therapistRaw}"`,
        s.grossAmount,
        s.discountAmount,
        `"${s.discountLabel}"`,
        s.netAmount,
        `"${s.paymentMethodClean}"`,
        s.collectedAmount,
        s.balanceDue
      ]);
    }

    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const uniqueTherapistNames = useMemo(() => {
    const set = new Set<string>();
    (appData?.therapists || []).forEach((t) => {
      if (t.name && t.name.trim()) set.add(t.name.trim());
    });
    return Array.from(set);
  }, [appData?.therapists]);

  // SVG Chart Geometry Calculation
  const maxChartVal = useMemo(() => {
    const m = Math.max(...chartDataPoints.map((d) => d.value), 0);
    return m > 0 ? m : 100000;
  }, [chartDataPoints]);

  const svgWidth = 780;
  const svgHeight = 220;
  const padLeft = 65;
  const padRight = 20;
  const padTop = 20;
  const padBottom = 35;
  const plotW = svgWidth - padLeft - padRight;
  const plotH = svgHeight - padTop - padBottom;

  const chartCoords = useMemo(() => {
    const len = chartDataPoints.length;
    if (len === 0) return [];
    return chartDataPoints.map((pt, idx) => {
      const x = padLeft + (len === 1 ? plotW / 2 : (idx / (len - 1)) * plotW);
      const y = padTop + plotH - (pt.value / maxChartVal) * plotH;
      return { ...pt, x, y };
    });
  }, [chartDataPoints, maxChartVal, plotW, plotH]);

  const polylinePoints = chartCoords.map((c) => `${c.x},${c.y}`).join(' ');
  const areaPolygonPoints =
    chartCoords.length > 0
      ? `${chartCoords[0].x},${padTop + plotH} ${polylinePoints} ${
          chartCoords[chartCoords.length - 1].x
        },${padTop + plotH}`
      : '';

  const activeMetricTitle =
    activeKpiMetric === 'gross'
      ? 'Gross Sales (မူရင်း ရောင်းရငွေ)'
      : activeKpiMetric === 'discounts'
      ? 'Discounts (လျှော့ပေးငွေ)'
      : activeKpiMetric === 'collected'
      ? 'Collected Cash & Online (လက်ခံရရှိပြီးငွေ)'
      : 'Net Sales (အသားတင် ရောင်းရငွေ)';

  return (
    <div className="space-y-5 animate-fade-in">
      {/* ==========================================
          TOP FILTER BAR (Loyverse Backoffice Style)
         ========================================== */}
      <div className="bg-white p-4 sm:p-5 rounded-2xl shadow-sm border border-gray-200 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2.5">
          {/* 1. Date Range Picker Popover Button */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowDateDropdown(!showDateDropdown)}
              className="px-4 py-2.5 bg-[#123524] text-[#D4AF37] rounded-xl text-xs font-black flex items-center gap-2 shadow-sm hover:bg-[#1a4a32] transition"
            >
              <Calendar className="w-4 h-4" />
              <span>{periodLabel}</span>
            </button>

            {showDateDropdown && (
              <div className="absolute left-0 mt-2 z-50 bg-white rounded-2xl shadow-2xl border border-gray-200 p-4 w-80 sm:w-96 animate-fade-in">
                <div className="text-xs font-extrabold text-[#123524] uppercase tracking-wider mb-2.5 border-b pb-2 flex justify-between items-center">
                  <span>Select Report Period</span>
                  <button
                    type="button"
                    onClick={() => setShowDateDropdown(false)}
                    className="text-gray-400 hover:text-gray-700 text-[11px]"
                  >
                    ✕ Close
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-1.5 mb-3">
                  {[
                    { id: 'today', label: 'Today (ယနေ့)' },
                    { id: 'yesterday', label: 'Yesterday (မနေ့က)' },
                    { id: 'this_week', label: 'This Week (ယခုအပတ်)' },
                    { id: 'last_week', label: 'Last Week (ပြီးခဲ့သည့်အပတ်)' },
                    { id: 'this_month', label: 'This Month (ယခုလ)' },
                    { id: 'last_month', label: 'Last Month (ပြီးခဲ့သည့်လ)' },
                    { id: 'last_7_days', label: 'Last 7 Days (၇ ရက်)' },
                    { id: 'last_30_days', label: 'Last 30 Days (ရက် ၃၀)' }
                  ].map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => {
                        setDatePreset(p.id as DatePreset);
                        setShowDateDropdown(false);
                      }}
                      className={`py-2 px-2.5 rounded-lg text-left text-xs font-bold transition ${
                        datePreset === p.id
                          ? 'bg-[#123524] text-[#D4AF37]'
                          : 'bg-gray-50 text-gray-700 hover:bg-gray-100'
                      }`}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>

                <div className="border-t border-gray-100 pt-3 space-y-2">
                  <div className="text-[11px] font-bold text-gray-500">Custom Date Range (စိတ်ကြိုက်ရက်ရွေးရန်)</div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[10px] text-gray-400 font-bold mb-0.5">Start Date</label>
                      <input
                        type="date"
                        value={customStartDate}
                        onChange={(e) => {
                          setCustomStartDate(e.target.value);
                          setDatePreset('custom');
                        }}
                        className="w-full p-2 bg-gray-50 border border-gray-200 rounded-lg text-xs font-bold text-[#123524]"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] text-gray-400 font-bold mb-0.5">End Date</label>
                      <input
                        type="date"
                        value={customEndDate}
                        onChange={(e) => {
                          setCustomEndDate(e.target.value);
                          setDatePreset('custom');
                        }}
                        className="w-full p-2 bg-gray-50 border border-gray-200 rounded-lg text-xs font-bold text-[#123524]"
                      />
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setDatePreset('custom');
                      setShowDateDropdown(false);
                    }}
                    className="w-full py-2 bg-[#D4AF37] text-[#123524] rounded-lg text-xs font-black uppercase tracking-wider mt-1"
                  >
                    Apply Custom Range
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* 2. Channel Filter (All vs Shop POS vs Online Booking) */}
          <select
            value={channelFilter}
            onChange={(e) => setChannelFilter(e.target.value as any)}
            className="px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold text-[#123524] outline-none focus:border-[#D4AF37]"
          >
            <option value="all">All Channels (Online + Shop POS)</option>
            <option value="pos">Shop Walk-in POS Only</option>
            <option value="online">Online Bookings Only</option>
          </select>

          {/* 3. Time of Day Filter */}
          <div className="flex items-center bg-gray-50 border border-gray-200 rounded-xl px-2.5 py-2">
            <Clock className="w-3.5 h-3.5 text-[#D4AF37] mr-1.5" />
            <select
              value={timeSlotFilter}
              onChange={(e) => setTimeSlotFilter(e.target.value as any)}
              className="bg-transparent text-xs font-bold text-gray-700 outline-none"
            >
              <option value="all">All Day (တစ်နေ့လုံး)</option>
              <option value="morning">Morning (6AM - 12PM)</option>
              <option value="afternoon">Afternoon (12PM - 5PM)</option>
              <option value="evening">Evening / Night (5PM+)</option>
            </select>
          </div>

          {/* 4. Employee / Therapist Filter */}
          <div className="flex items-center bg-gray-50 border border-gray-200 rounded-xl px-2.5 py-2">
            <User className="w-3.5 h-3.5 text-[#D4AF37] mr-1.5" />
            <select
              value={employeeFilter}
              onChange={(e) => setEmployeeFilter(e.target.value)}
              className="bg-transparent text-xs font-bold text-gray-700 outline-none"
            >
              <option value="all">All Therapists (ဝန်ထမ်းအားလုံး)</option>
              {uniqueTherapistNames.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Export Button */}
        <button
          type="button"
          onClick={handleExportCurrentReport}
          className="px-4 py-2.5 bg-green-50 hover:bg-green-100 text-green-700 border border-green-200 rounded-xl text-xs font-black flex items-center shadow-2xs transition"
        >
          <Download className="w-4 h-4 mr-1.5" /> Export Excel (CSV)
        </button>
      </div>

      {/* ==========================================
          MAIN LOYVERSE-STYLE 2-COLUMN ANALYTICS LAYOUT
         ========================================== */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* LEFT NAVIGATION MENU (7 Report Views - Loyverse Style) */}
        <div className="lg:col-span-3 bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="p-3.5 bg-gradient-to-r from-[#123524] to-[#1a4a32] text-[#D4AF37] text-xs font-black uppercase tracking-wider flex items-center">
            <BarChart2 className="w-4 h-4 mr-2" /> Sales Reports Menu
          </div>
          <div className="p-2 flex lg:flex-col gap-1 overflow-x-auto scrollbar-hide">
            {[
              { id: 'summary', label: 'Sales summary', sub: 'နေ့စဉ် အရောင်းချုပ်', icon: TrendingUp },
              { id: 'by_item', label: 'Sales by item', sub: 'Service တစ်ခုချင်းအလိုက်', icon: Sparkles },
              { id: 'by_category', label: 'Sales by category', sub: 'Category အလိုက်', icon: Layers },
              { id: 'by_employee', label: 'Sales by employee', sub: 'Therapist အလိုက်', icon: User },
              { id: 'by_payment', label: 'Sales by payment type', sub: 'ငွေပေးချေမှုအလိုက်', icon: CreditCard },
              { id: 'discounts', label: 'Discounts', sub: 'လျှော့ဈေးနှင့် ပရိုမိုးရှင်းချုပ်', icon: Tag },
              { id: 'receipts', label: 'Receipts (All Bills)', sub: 'ဘောင်ချာအားလုံး စစ်ရန်', icon: FileText }
            ].map((item) => {
              const active = activeReportTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setActiveReportTab(item.id as ReportSubView)}
                  className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-left transition whitespace-nowrap lg:whitespace-normal ${
                    active
                      ? 'bg-[#123524] text-[#D4AF37] shadow-sm'
                      : 'text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  <item.icon className={`w-4 h-4 flex-shrink-0 ${active ? 'text-[#D4AF37]' : 'text-gray-400'}`} />
                  <div>
                    <div className="text-xs font-extrabold leading-tight">{item.label}</div>
                    <div className={`text-[10px] hidden sm:block ${active ? 'text-gray-300' : 'text-gray-400'}`}>
                      {item.sub}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Channel Split Mini Summary inside Sidebar */}
          <div className="hidden lg:block p-4 border-t border-gray-100 bg-gray-50/60 space-y-2.5">
            <div className="text-[10px] font-extrabold text-gray-400 uppercase tracking-wider">
              Channel Revenue Split
            </div>
            <div className="space-y-1.5 text-xs">
              <div className="flex justify-between items-center">
                <span className="font-bold text-gray-600 flex items-center">
                  <span className="w-2 h-2 rounded-full bg-[#123524] mr-1.5" /> Shop POS:
                </span>
                <span className="font-black text-[#123524]">{formatPrice(kpiStats.cur.posNet)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="font-bold text-gray-600 flex items-center">
                  <span className="w-2 h-2 rounded-full bg-[#D4AF37] mr-1.5" /> Online Booking:
                </span>
                <span className="font-black text-amber-700">{formatPrice(kpiStats.cur.onlineNet)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT CONTENT AREA (KPI Cards + Chart + Active Breakdown Table) */}
        <div className="lg:col-span-9 space-y-5 min-w-0">
          {/* 1. Loyverse-Style 5 KPI Metric Tabs */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-5 divide-y sm:divide-y-0 sm:divide-x divide-gray-100">
              {/* KPI 1: Gross Sales */}
              <button
                type="button"
                onClick={() => setActiveKpiMetric('gross')}
                className={`p-4 text-left transition relative ${
                  activeKpiMetric === 'gross' ? 'bg-green-50/40' : 'hover:bg-gray-50'
                }`}
              >
                {activeKpiMetric === 'gross' && (
                  <div className="absolute bottom-0 left-0 right-0 h-1 bg-[#123524]" />
                )}
                <div className="text-[11px] font-bold text-gray-500">Gross sales</div>
                <div className="text-base sm:text-lg font-black text-gray-900 mt-1">
                  {formatPrice(kpiStats.cur.gross)}
                </div>
                <div
                  className={`text-[10px] font-bold mt-1 flex items-center ${
                    kpiStats.grossDelta.diff >= 0 ? 'text-green-600' : 'text-red-500'
                  }`}
                >
                  {kpiStats.grossDelta.diff >= 0 ? (
                    <ArrowUpRight className="w-3 h-3 mr-0.5" />
                  ) : (
                    <ArrowDownRight className="w-3 h-3 mr-0.5" />
                  )}
                  {kpiStats.grossDelta.diff >= 0 ? '+' : ''}
                  {formatPrice(kpiStats.grossDelta.diff)} ({kpiStats.grossDelta.pct}%)
                </div>
              </button>

              {/* KPI 2: Refunds / Cancelled */}
              <div className="p-4 text-left">
                <div className="text-[11px] font-bold text-gray-500">Refunds / Cancelled</div>
                <div className="text-base sm:text-lg font-black text-gray-900 mt-1">
                  {formatPrice(kpiStats.cur.refunds)}
                </div>
                <div className="text-[10px] font-bold text-gray-400 mt-1">
                  {kpiStats.cur.refundCount} Cancelled Bookings
                </div>
              </div>

              {/* KPI 3: Discounts */}
              <button
                type="button"
                onClick={() => setActiveKpiMetric('discounts')}
                className={`p-4 text-left transition relative ${
                  activeKpiMetric === 'discounts' ? 'bg-green-50/40' : 'hover:bg-gray-50'
                }`}
              >
                {activeKpiMetric === 'discounts' && (
                  <div className="absolute bottom-0 left-0 right-0 h-1 bg-[#123524]" />
                )}
                <div className="text-[11px] font-bold text-gray-500">Discounts</div>
                <div className="text-base sm:text-lg font-black text-green-700 mt-1">
                  {formatPrice(kpiStats.cur.discounts)}
                </div>
                <div className="text-[10px] font-bold text-green-600 mt-1">
                  {kpiStats.cur.gross > 0
                    ? `${((kpiStats.cur.discounts / kpiStats.cur.gross) * 100).toFixed(1)}% of Gross`
                    : '0% of Gross'}
                </div>
              </button>

              {/* KPI 4: Net Sales */}
              <button
                type="button"
                onClick={() => setActiveKpiMetric('net')}
                className={`p-4 text-left transition relative ${
                  activeKpiMetric === 'net' ? 'bg-green-50/40' : 'hover:bg-gray-50'
                }`}
              >
                {activeKpiMetric === 'net' && (
                  <div className="absolute bottom-0 left-0 right-0 h-1 bg-[#123524]" />
                )}
                <div className="text-[11px] font-bold text-gray-500">Net sales</div>
                <div className="text-base sm:text-lg font-black text-[#123524] mt-1">
                  {formatPrice(kpiStats.cur.net)}
                </div>
                <div
                  className={`text-[10px] font-bold mt-1 flex items-center ${
                    kpiStats.netDelta.diff >= 0 ? 'text-green-600' : 'text-red-500'
                  }`}
                >
                  {kpiStats.netDelta.diff >= 0 ? (
                    <ArrowUpRight className="w-3 h-3 mr-0.5" />
                  ) : (
                    <ArrowDownRight className="w-3 h-3 mr-0.5" />
                  )}
                  {kpiStats.netDelta.diff >= 0 ? '+' : ''}
                  {formatPrice(kpiStats.netDelta.diff)} ({kpiStats.netDelta.pct}%)
                </div>
              </button>

              {/* KPI 5: Cash Collected & Balance Due */}
              <button
                type="button"
                onClick={() => setActiveKpiMetric('collected')}
                className={`p-4 text-left transition relative col-span-2 sm:col-span-1 ${
                  activeKpiMetric === 'collected' ? 'bg-green-50/40' : 'hover:bg-gray-50'
                }`}
              >
                {activeKpiMetric === 'collected' && (
                  <div className="absolute bottom-0 left-0 right-0 h-1 bg-[#123524]" />
                )}
                <div className="text-[11px] font-bold text-gray-500">Collected Revenue</div>
                <div className="text-base sm:text-lg font-black text-emerald-700 mt-1">
                  {formatPrice(kpiStats.cur.collected)}
                </div>
                {kpiStats.cur.balanceDue > 0 ? (
                  <div className="text-[10px] font-black text-red-600 mt-1">
                    ကျန်ငွေရရန်: {formatPrice(kpiStats.cur.balanceDue)}
                  </div>
                ) : (
                  <div className="text-[10px] font-bold text-emerald-600 mt-1">
                    {kpiStats.cur.validBills} Paid Bills
                  </div>
                )}
              </button>
            </div>

            {/* 2. Interactive Loyverse-Style Area / Bar Chart */}
            <div className="p-4 sm:p-6 border-t border-gray-100">
              <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
                <div>
                  <h3 className="text-sm font-extrabold text-[#123524]">{activeMetricTitle}</h3>
                  <p className="text-[10px] text-gray-400 font-semibold">
                    {startDateStr} မှ {endDateStr} အတွင်း အရောင်း차트
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <select
                    value={chartType}
                    onChange={(e) => setChartType(e.target.value as 'area' | 'bar')}
                    className="px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs font-bold text-gray-700 outline-none"
                  >
                    <option value="area">Area Chart</option>
                    <option value="bar">Bar Chart</option>
                  </select>

                  <select
                    value={chartGranularity}
                    onChange={(e) => setChartGranularity(e.target.value as 'days' | 'hours')}
                    className="px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs font-bold text-gray-700 outline-none"
                  >
                    <option value="days">By Days (ရက်အလိုက်)</option>
                    <option value="hours">By Hours (နာရီအလိုက်)</option>
                  </select>
                </div>
              </div>

              {/* SVG Chart Container */}
              <div className="w-full overflow-x-auto">
                <svg
                  viewBox={`0 0 ${svgWidth} ${svgHeight}`}
                  className="w-full h-52 sm:h-60 min-w-[520px] select-none"
                >
                  <defs>
                    <linearGradient id="shangrilaAreaGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#4caf50" stopOpacity="0.32" />
                      <stop offset="100%" stopColor="#4caf50" stopOpacity="0.02" />
                    </linearGradient>
                  </defs>

                  {/* Horizontal Grid Lines */}
                  {[0, 0.25, 0.5, 0.75, 1].map((ratio, idx) => {
                    const y = padTop + plotH - ratio * plotH;
                    const labelVal = Math.round(maxChartVal * ratio);
                    return (
                      <g key={idx}>
                        <line
                          x1={padLeft}
                          y1={y}
                          x2={svgWidth - padRight}
                          y2={y}
                          stroke="#f1f5f9"
                          strokeWidth="1"
                        />
                        <text
                          x={padLeft - 8}
                          y={y + 3}
                          textAnchor="end"
                          className="text-[9px] fill-gray-400 font-mono"
                        >
                          {labelVal >= 1000 ? `${(labelVal / 1000).toFixed(0)}k` : labelVal}
                        </text>
                      </g>
                    );
                  })}

                  {/* Area or Bar Visualization */}
                  {chartType === 'area' ? (
                    <>
                      {chartCoords.length > 1 && (
                        <polygon points={areaPolygonPoints} fill="url(#shangrilaAreaGrad)" />
                      )}
                      {chartCoords.length > 1 && (
                        <polyline
                          fill="none"
                          stroke="#4caf50"
                          strokeWidth="2.5"
                          points={polylinePoints}
                        />
                      )}
                      {chartCoords.map((c, idx) => (
                        <g key={idx} className="group">
                          <circle
                            cx={c.x}
                            cy={c.y}
                            r="4"
                            fill="#ffffff"
                            stroke="#2e7d32"
                            strokeWidth="2.5"
                          />
                          {c.value > 0 && (
                            <title>{`${c.label}: ${formatPrice(c.value)} (${c.bills} Bills)`}</title>
                          )}
                        </g>
                      ))}
                    </>
                  ) : (
                    chartCoords.map((c, idx) => {
                      const barW = Math.max(8, Math.min(28, plotW / Math.max(1, chartCoords.length) - 6));
                      const barH = Math.max(2, padTop + plotH - c.y);
                      return (
                        <g key={idx}>
                          <rect
                            x={c.x - barW / 2}
                            y={c.y}
                            width={barW}
                            height={barH}
                            rx="4"
                            fill="#123524"
                          >
                            <title>{`${c.label}: ${formatPrice(c.value)} (${c.bills} Bills)`}</title>
                          </rect>
                        </g>
                      );
                    })
                  )}

                  {/* X-Axis Labels */}
                  {chartCoords.map((c, idx) => {
                    const step = Math.max(1, Math.ceil(chartCoords.length / 8));
                    if (idx % step !== 0 && idx !== chartCoords.length - 1) return null;
                    return (
                      <text
                        key={idx}
                        x={c.x}
                        y={svgHeight - 10}
                        textAnchor="middle"
                        className="text-[9px] fill-gray-500 font-semibold"
                      >
                        {c.label}
                      </text>
                    );
                  })}
                </svg>
              </div>
            </div>
          </div>

          {/* ==========================================
              3. DYNAMIC SUB-REPORT TABLE (Based on Left Menu Selection)
             ========================================== */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-4 sm:p-6">
            {/* SUB-VIEW 1: DAILY SALES SUMMARY */}
            {activeReportTab === 'summary' && (
              <div>
                <h3 className="text-base font-bold text-[#123524] mb-4">
                  Daily Sales Summary (နေ့ရက်အလိုက် Online + POS အရောင်းချုပ်)
                </h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse min-w-[720px] text-xs">
                    <thead>
                      <tr className="border-b-2 border-gray-100 text-gray-500 uppercase">
                        <th className="p-3">Date (နေ့ရက်)</th>
                        <th className="p-3">Bills (POS / Online)</th>
                        <th className="p-3 text-right">Gross Sales</th>
                        <th className="p-3 text-right">Discounts</th>
                        <th className="p-3 text-right">Net Sales</th>
                        <th className="p-3 text-right">Collected</th>
                        <th className="p-3 text-right">Balance Due</th>
                      </tr>
                    </thead>
                    <tbody>
                      {dailySummaryRows.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="p-10 text-center text-gray-400 font-bold">
                            ရွေးချယ်ထားသော ကာလအတွင်း အရောင်းစာရင်း မရှိသေးပါ။
                          </td>
                        </tr>
                      ) : (
                        dailySummaryRows.map((r) => (
                          <tr key={r.date} className="border-b border-gray-50 hover:bg-gray-50">
                            <td className="p-3 font-bold text-[#123524]">{r.date}</td>
                            <td className="p-3 font-semibold text-gray-700">
                              {r.bills} Bills{' '}
                              <span className="text-[10px] text-gray-400">
                                (POS: {r.posBills} | Online: {r.onlineBills})
                              </span>
                            </td>
                            <td className="p-3 text-right font-semibold text-gray-700">
                              {formatPrice(r.gross)}
                            </td>
                            <td className="p-3 text-right font-bold text-green-600">
                              {r.discounts > 0 ? `-${formatPrice(r.discounts)}` : '0 Ks'}
                            </td>
                            <td className="p-3 text-right font-black text-[#123524]">
                              {formatPrice(r.net)}
                            </td>
                            <td className="p-3 text-right font-bold text-emerald-700">
                              {formatPrice(r.collected)}
                            </td>
                            <td className="p-3 text-right font-bold text-red-600">
                              {r.balanceDue > 0 ? formatPrice(r.balanceDue) : '0 Ks'}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* SUB-VIEW 2: SALES BY ITEM */}
            {activeReportTab === 'by_item' && (
              <div>
                <h3 className="text-base font-bold text-[#123524] mb-4">
                  Sales by Item (ဝန်ဆောင်မှု နှင့် အပိုပစ္စည်း တစ်ခုချင်းစီအလိုက် ရောင်းအား)
                </h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse min-w-[650px] text-xs">
                    <thead>
                      <tr className="border-b-2 border-gray-100 text-gray-500 uppercase">
                        <th className="p-3">Service / Sale Item</th>
                        <th className="p-3">Category</th>
                        <th className="p-3 text-center">Items Sold (Qty)</th>
                        <th className="p-3 text-center">VVIP Room Upgrades</th>
                        <th className="p-3 text-right">Net Sales</th>
                      </tr>
                    </thead>
                    <tbody>
                      {salesByItemRows.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="p-10 text-center text-gray-400 font-bold">
                            အရောင်းမှတ်တမ်း မရှိသေးပါ။
                          </td>
                        </tr>
                      ) : (
                        salesByItemRows.map((r, i) => (
                          <tr key={i} className="border-b border-gray-50 hover:bg-gray-50">
                            <td className="p-3 font-bold text-gray-800">{r.name}</td>
                            <td className="p-3">
                              <span className="bg-gray-100 text-gray-700 px-2.5 py-1 rounded-full text-[10px] font-bold">
                                {r.category}
                              </span>
                            </td>
                            <td className="p-3 text-center font-black text-[#123524]">{r.qty}</td>
                            <td className="p-3 text-center font-bold text-amber-700">
                              {r.vvipCount > 0 ? `${r.vvipCount} VVIP` : '-'}
                            </td>
                            <td className="p-3 text-right font-black text-[#123524]">
                              {formatPrice(r.netRevenue)}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* SUB-VIEW 3: SALES BY CATEGORY */}
            {activeReportTab === 'by_category' && (
              <div>
                <h3 className="text-base font-bold text-[#123524] mb-4">
                  Sales by Category (အမျိုးအစားအလိုက် ရောင်းအားချုပ်)
                </h3>
                <div className="space-y-3">
                  {salesByCategoryRows.length === 0 ? (
                    <div className="p-10 text-center text-gray-400 font-bold text-xs">
                      အရောင်းမှတ်တမ်း မရှိသေးပါ။
                    </div>
                  ) : (
                    salesByCategoryRows.map((r, i) => {
                      const pct =
                        kpiStats.cur.net > 0
                          ? Math.min(100, Math.round((r.netRevenue / kpiStats.cur.net) * 100))
                          : 0;
                      return (
                        <div
                          key={i}
                          className="p-4 rounded-xl bg-gray-50 border border-gray-200 space-y-2"
                        >
                          <div className="flex justify-between items-center">
                            <div>
                              <span className="font-extrabold text-sm text-[#123524]">
                                {r.category}
                              </span>
                              <span className="ml-2 text-xs font-bold text-gray-500">
                                ({r.qty} Items Sold)
                              </span>
                            </div>
                            <div className="text-right">
                              <span className="font-black text-sm text-[#123524]">
                                {formatPrice(r.netRevenue)}
                              </span>
                              <span className="ml-2 text-xs font-black text-[#D4AF37] bg-[#123524] px-2 py-0.5 rounded">
                                {pct}%
                              </span>
                            </div>
                          </div>
                          <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-gradient-to-r from-[#123524] to-[#D4AF37]"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            )}

            {/* SUB-VIEW 4: SALES BY EMPLOYEE (THERAPIST) */}
            {activeReportTab === 'by_employee' && (
              <div>
                <h3 className="text-base font-bold text-[#123524] mb-4">
                  Sales by Employee (Therapist တစ်ဦးချင်းစီအလိုက် ရောင်းအားချုပ်)
                </h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse min-w-[650px] text-xs">
                    <thead>
                      <tr className="border-b-2 border-gray-100 text-gray-500 uppercase">
                        <th className="p-3">Rank & Therapist</th>
                        <th className="p-3 text-center">Sessions</th>
                        <th className="p-3 text-right">Gross Sales</th>
                        <th className="p-3 text-right">Discounts</th>
                        <th className="p-3 text-right">Net Sales</th>
                        <th className="p-3 text-right">Avg Bill</th>
                      </tr>
                    </thead>
                    <tbody>
                      {salesByEmployeeRows.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="p-10 text-center text-gray-400 font-bold">
                            အရောင်းမှတ်တမ်း မရှိသေးပါ။
                          </td>
                        </tr>
                      ) : (
                        salesByEmployeeRows.map((r, i) => (
                          <tr key={r.therapist} className="border-b border-gray-50 hover:bg-gray-50">
                            <td className="p-3 font-bold text-[#123524]">
                              <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-[#123524] text-[#D4AF37] text-[10px] font-black mr-2">
                                {i + 1}
                              </span>
                              {r.therapist}
                            </td>
                            <td className="p-3 text-center font-black text-gray-800">
                              {r.sessions} ပွဲ
                            </td>
                            <td className="p-3 text-right font-semibold text-gray-600">
                              {formatPrice(r.grossSales)}
                            </td>
                            <td className="p-3 text-right font-bold text-green-600">
                              {r.discounts > 0 ? `-${formatPrice(r.discounts)}` : '0 Ks'}
                            </td>
                            <td className="p-3 text-right font-black text-[#123524]">
                              {formatPrice(r.netSales)}
                            </td>
                            <td className="p-3 text-right font-bold text-gray-600">
                              {formatPrice(r.sessions > 0 ? Math.round(r.netSales / r.sessions) : 0)}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* SUB-VIEW 5: SALES BY PAYMENT TYPE */}
            {activeReportTab === 'by_payment' && (
              <div>
                <h3 className="text-base font-bold text-[#123524] mb-4">
                  Sales by Payment Type (ငွေပေးချေမှု စနစ်အလိုက် ဝင်ငွေချုပ်)
                </h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse min-w-[600px] text-xs">
                    <thead>
                      <tr className="border-b-2 border-gray-100 text-gray-500 uppercase">
                        <th className="p-3">Payment Type</th>
                        <th className="p-3 text-center">Transactions</th>
                        <th className="p-3 text-right">Net Sales</th>
                        <th className="p-3 text-right">Collected Amount</th>
                        <th className="p-3 text-right">Pending Balance Due</th>
                      </tr>
                    </thead>
                    <tbody>
                      {salesByPaymentRows.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="p-10 text-center text-gray-400 font-bold">
                            အရောင်းမှတ်တမ်း မရှိသေးပါ။
                          </td>
                        </tr>
                      ) : (
                        salesByPaymentRows.map((r) => (
                          <tr key={r.method} className="border-b border-gray-50 hover:bg-gray-50">
                            <td className="p-3 font-black text-[#123524]">{r.method}</td>
                            <td className="p-3 text-center font-bold text-gray-700">{r.bills}</td>
                            <td className="p-3 text-right font-black text-[#123524]">
                              {formatPrice(r.netSales)}
                            </td>
                            <td className="p-3 text-right font-bold text-emerald-700">
                              {formatPrice(r.collected)}
                            </td>
                            <td className="p-3 text-right font-bold text-red-600">
                              {r.balanceDue > 0 ? formatPrice(r.balanceDue) : '0 Ks'}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* SUB-VIEW 6: DISCOUNTS REPORT */}
            {activeReportTab === 'discounts' && (
              <div>
                <h3 className="text-base font-bold text-[#123524] mb-4">
                  Discounts & Promotions Report (VIP နှင့် သီတင်းကျွတ် ပရိုမိုးရှင်း လျှော့ဈေးချုပ်)
                </h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse min-w-[600px] text-xs">
                    <thead>
                      <tr className="border-b-2 border-gray-100 text-gray-500 uppercase">
                        <th className="p-3">Discount / Campaign Reason</th>
                        <th className="p-3 text-center">Times Applied</th>
                        <th className="p-3 text-right">Discount Amount Given</th>
                        <th className="p-3 text-right">Net Sales Generated</th>
                      </tr>
                    </thead>
                    <tbody>
                      {discountsBreakdownRows.length === 0 ? (
                        <tr>
                          <td colSpan={4} className="p-10 text-center text-gray-400 font-bold">
                            ရွေးချယ်ထားသော ကာလအတွင်း Discount ပေးထားသော ဘောင်ချာ မရှိပါ။
                          </td>
                        </tr>
                      ) : (
                        discountsBreakdownRows.map((r, i) => (
                          <tr key={i} className="border-b border-gray-50 hover:bg-gray-50">
                            <td className="p-3 font-bold text-gray-800">{r.label}</td>
                            <td className="p-3 text-center font-black text-[#123524]">
                              {r.count} ကြိမ်
                            </td>
                            <td className="p-3 text-right font-black text-green-600">
                              -{formatPrice(r.totalDiscountGiven)}
                            </td>
                            <td className="p-3 text-right font-black text-[#123524]">
                              {formatPrice(r.generatedNetSales)}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* SUB-VIEW 7: ALL UNIFIED RECEIPTS (ONLINE + POS) */}
            {activeReportTab === 'receipts' && (
              <div className="space-y-4">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                  <h3 className="text-base font-bold text-[#123524]">
                    All Unified Receipts ({currentPeriodSales.length} Bills)
                  </h3>
                  <div className="relative w-full sm:w-64">
                    <input
                      type="text"
                      value={receiptSearch}
                      onChange={(e) => setReceiptSearch(e.target.value)}
                      placeholder="ဘောင်ချာ / အမည် / ဖုန်း ရှာရန်..."
                      className="w-full pl-8 pr-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold outline-none focus:border-[#D4AF37]"
                    />
                    <Search className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-2.5" />
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse min-w-[820px] text-xs">
                    <thead>
                      <tr className="border-b-2 border-gray-100 text-gray-500 uppercase">
                        <th className="p-3">Invoice / Date</th>
                        <th className="p-3">Channel</th>
                        <th className="p-3">Customer</th>
                        <th className="p-3">Services & Therapist</th>
                        <th className="p-3">Payment</th>
                        <th className="p-3 text-right">Gross / Discount / Net</th>
                      </tr>
                    </thead>
                    <tbody>
                      {currentPeriodSales
                        .filter((s) => {
                          if (!receiptSearch.trim()) return true;
                          const q = receiptSearch.toLowerCase();
                          return (
                            s.invoiceNo.toLowerCase().includes(q) ||
                            s.customerName.toLowerCase().includes(q) ||
                            s.customerPhone.toLowerCase().includes(q) ||
                            s.serviceRaw.toLowerCase().includes(q)
                          );
                        })
                        .map((s) => (
                          <tr
                            key={s.id}
                            className={`border-b border-gray-50 hover:bg-gray-50 ${
                              s.isCancelled ? 'opacity-50 bg-red-50/20' : ''
                            }`}
                          >
                            <td className="p-3">
                              <div className="font-mono font-black text-[#123524]">
                                {s.invoiceNo}
                              </div>
                              <div className="text-[10px] text-gray-400">
                                {s.date} {s.time}
                              </div>
                            </td>
                            <td className="p-3">
                              {s.channel === 'pos' ? (
                                <span className="bg-[#123524] text-[#D4AF37] px-2.5 py-1 rounded-full text-[9px] font-black">
                                  Shop POS
                                </span>
                              ) : (
                                <span className="bg-blue-50 text-blue-700 border border-blue-200 px-2.5 py-1 rounded-full text-[9px] font-black">
                                  Online Booking
                                </span>
                              )}
                            </td>
                            <td className="p-3">
                              <div className="font-bold text-gray-800">{s.customerName}</div>
                              <div className="text-[10px] font-mono text-gray-500">
                                {s.customerPhone}
                              </div>
                            </td>
                            <td className="p-3 max-w-xs">
                              <div className="font-bold text-gray-800 truncate">{s.serviceRaw}</div>
                              <div className="text-[10px] text-gray-500">
                                Therapist: {s.therapistRaw}
                              </div>
                            </td>
                            <td className="p-3">
                              <div className="font-bold text-gray-700">{s.paymentMethodClean}</div>
                              {s.balanceDue > 0 ? (
                                <span className="text-[9px] font-black text-red-600 flex items-center mt-0.5">
                                  <AlertCircle className="w-3 h-3 mr-0.5" /> Due:{' '}
                                  {formatPrice(s.balanceDue)}
                                </span>
                              ) : (
                                <span className="text-[9px] font-bold text-emerald-600 flex items-center mt-0.5">
                                  <CheckCircle className="w-3 h-3 mr-0.5" /> Paid
                                </span>
                              )}
                            </td>
                            <td className="p-3 text-right">
                              {s.discountAmount > 0 && (
                                <div className="text-[10px] text-gray-400 line-through">
                                  {formatPrice(s.grossAmount)} (-{s.discountPercent}%)
                                </div>
                              )}
                              <div className="font-black text-sm text-[#123524]">
                                {formatPrice(s.netAmount)}
                              </div>
                              {s.discountLabel && (
                                <div className="text-[9px] text-green-700 font-bold">
                                  {s.discountLabel}
                                </div>
                              )}
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
