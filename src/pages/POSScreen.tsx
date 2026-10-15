import React, { useState, useEffect, useMemo, useRef } from 'react';
import { collection, addDoc, getDocs, updateDoc, doc, onSnapshot, query, orderBy, limit } from 'firebase/firestore';
import { db } from '../firebase';
import { encryptText, decryptText } from '../security';
import { AppData, MenuItem, TherapistProfile, formatPrice } from '../shared';
import {
  Sparkles, User, Clock, Plus, Printer, Wifi, WifiOff,
  RefreshCw, CheckCircle, Crown, Percent, ShoppingBag,
  ArrowLeft, History, Search, Banknote, Bluetooth, Settings, Upload, X,
  Menu, PackagePlus, Trash2, ChevronRight, Tag, AlertCircle, Calendar
} from 'lucide-react';

// Project ထဲရှိ THE SHANGRI LA - LOGO.png ကို Build Error မတက်စေဘဲ လှမ်းယူခြင်း
const defaultLogoImg = new URL('../THE SHANGRI LA - LOGO.png', import.meta.url).href;

interface CartItem {
  cartId: string;
  id: string;
  name: string;
  duration?: string;
  price: number;
  isVvipUpgrade?: boolean;
  vvipExtraPrice?: number;
  vvipIncluded?: boolean;
  isCustomItem?: boolean;
  discountEligible?: boolean;
  qty: number;
}

interface SavedExtraItem {
  id: string;
  name: string;
  price: number;
}

interface SavedDiscountPreset {
  id: string;
  label: string;
  type: 'percent' | 'fixed';
  value: number;
  category?: 'vip' | 'campaign' | 'custom';
}

interface OfflineSaleRecord {
  localId: string;
  firestoreDocId?: string;
  invoiceNo: string;
  createdAt: number;
  date: string;
  time: string;
  customerName: string;
  customerPhone: string;
  customerVipTier?: string;
  therapistName: string;
  items: CartItem[];
  subTotal: number;
  discountType: 'percent' | 'fixed';
  discountValue: number;
  discountAmount: number;
  discountReason: string;
  totalPrice: number;
  paymentMethod: string;
  paymentStatus: 'paid_in_full' | 'deposit_only';
  depositPaid: number;
  balanceDue: number;
  cashReceived: number;
  changeDue: number;
  serviceStatus: 'in_progress' | 'completed';
  pointsEarned: number;
  note: string;
  synced: boolean;
  startTimeMillis?: number;
  expectedEndTimeMillis?: number;
}

interface PosPrintSettings {
  paperWidth: '58mm' | '80mm';
  showLogo: boolean;
  customPrintedLogoDataUrl: string;
  logoFilterMode: 'auto_gold_extract' | 'bw_threshold';
  logoThreshold: number;
  logoSize: number;
  shopName: string;
  subtitle: string;
  headerText: string;
  footerText: string;
  phone: string;
  thankYouText: string;
  showCustomerInfo: boolean;
  savedPrinterId: string;
  savedPrinterName: string;
}

// 🌟 UI/UX Flying Animation Particle Interface 🌟
interface FlyingBubble {
  id: number;
  name: string;
  priceStr: string;
  startX: number;
  startY: number;
  deltaX: number;
  deltaY: number;
}

const OFFLINE_QUEUE_KEY = 'shangrila_pos_offline_queue_v1';
const LOCAL_SALES_HISTORY_KEY = 'shangrila_pos_local_history_v1';
const CACHED_APPDATA_KEY = 'shangrila_pos_cached_appdata_lite_v2';
const POS_PRINT_SETTINGS_KEY = 'shangrila_pos_print_settings_v3';
const SAVED_EXTRA_ITEMS_KEY = 'shangrila_pos_saved_extra_items_v1';
const SAVED_DISCOUNT_PRESETS_KEY = 'shangrila_pos_discount_presets_v1';

const DEFAULT_EXTRA_ITEMS: SavedExtraItem[] = [
  { id: 'ext_1', name: 'Carebeau Massage Oil (Bottle)', price: 15000 },
  { id: 'ext_2', name: 'Extra Time (30 Mins)', price: 15000 },
  { id: 'ext_3', name: 'Disposable Underwear / Amenities', price: 3000 },
  { id: 'ext_4', name: 'Energy Drink / Coffee', price: 3000 }
];

const DEFAULT_DISCOUNT_PRESETS: SavedDiscountPreset[] = [
  { id: 'vip_jade', label: 'Jade Elite VIP Member (10% OFF)', type: 'percent', value: 10, category: 'vip' },
  { id: 'vip_gold', label: 'Imperial Gold VIP Member (15% OFF)', type: 'percent', value: 15, category: 'vip' },
  { id: 'vip_vvip', label: 'Signature V-VIP Member (20% OFF)', type: 'percent', value: 20, category: 'vip' },
  { id: 'camp_early', label: 'Early Bird Promo (15% OFF)', type: 'percent', value: 15, category: 'campaign' },
  { id: 'camp_thadingyut', label: 'Special Festival Campaign (20% OFF)', type: 'percent', value: 20, category: 'campaign' },
  { id: 'camp_tele', label: 'Telegram Channel Subscriber (10% OFF)', type: 'percent', value: 10, category: 'campaign' },
  { id: 'custom_5000', label: 'Special Cash Voucher (-5,000 Ks)', type: 'fixed', value: 5000, category: 'custom' }
];

const DEFAULT_PRINT_SETTINGS: PosPrintSettings = {
  paperWidth: '58mm',
  showLogo: true,
  customPrintedLogoDataUrl: '',
  logoFilterMode: 'auto_gold_extract',
  logoThreshold: 12,
  logoSize: 192,
  shopName: 'THE SHANGRI-LA',
  subtitle: "MEN'S RETREAT",
  headerText: 'Beyond Relaxation',
  footerText: '33th(B) St, Between 65th & 65th(A) Sts, Chan Aye Tharzan Township, Mandalay',
  phone: '09-458884517',
  thankYouText: 'Thank You For Visiting Us!\nWe hope to see you again soon.',
  showCustomerInfo: true,
  savedPrinterId: '',
  savedPrinterName: ''
};

// Bluetooth Thermal Printer Service UUIDs အားလုံး
const BT_PRINTER_SERVICES = [
  '000018f0-0000-1000-8000-00805f9b34fb',
  '0000ff00-0000-1000-8000-00805f9b34fb',
  '49535343-fe7d-4ae5-8fa9-9fafd205e455',
  'e7810a71-73ae-499d-8c15-faa9aef0c3f2',
  '0000ffe0-0000-1000-8000-00805f9b34fb',
  '0000fee7-0000-1000-8000-00805f9b34fb',
  '0000ae00-0000-1000-8000-00805f9b34fb',
  '00001101-0000-1000-8000-00805f9b34fb'
];

const getLocalTodayStr = () => {
  const d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
};

const generateInvoiceNo = () => {
  const d = new Date();
  const ymd = `${String(d.getFullYear()).slice(-2)}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
  const rand = Math.floor(1000 + Math.random() * 9000);
  return `SL-${ymd}-${rand}`;
};

// 🌟 Helper to detect VIP Tier & Discount % from Customer Points or Tier String 🌟
const detectCustomerVipBenefit = (
  points: number,
  explicitTier?: string,
  explicitDiscount?: number
): { tierName: string; discountPercent: number } | null => {
  if (explicitDiscount && explicitDiscount > 0) {
    return {
      tierName: explicitTier || `VIP ${explicitDiscount}% Member`,
      discountPercent: explicitDiscount
    };
  }
  const tierNorm = (explicitTier || '').toLowerCase();
  if (tierNorm.includes('v-vip') || tierNorm.includes('vvip') || tierNorm.includes('signature') || points >= 30) {
    return { tierName: 'Signature V-VIP Member', discountPercent: 20 };
  }
  if (tierNorm.includes('gold') || tierNorm.includes('imperial') || points >= 15) {
    return { tierName: 'Imperial Gold VIP Member', discountPercent: 15 };
  }
  if (tierNorm.includes('jade') || tierNorm.includes('elite') || points >= 5) {
    return { tierName: 'Jade Elite VIP Member', discountPercent: 10 };
  }
  return null;
};

const saveLiteAppDataToCache = (data: AppData) => {
  if (!data) return;
  try {
    localStorage.removeItem('shangrila_pos_cached_appdata_v1');
    const liteData: AppData = {
      ...data,
      branding: {
        ...data.branding,
        logoUrl: data.branding?.logoUrl?.startsWith('data:') ? '' : (data.branding?.logoUrl || '')
      },
      categories: (data.categories || []).map((cat) => ({
        ...cat,
        items: (cat.items || []).map((item) => ({
          id: item.id,
          name: item.name,
          price: item.price,
          duration: item.duration,
          vvipPrice: item.vvipPrice,
          vvipIncluded: item.vvipIncluded
        }))
      })),
      therapists: (data.therapists || []).map((t) => ({
        id: t.id,
        name: t.name,
        order: t.order,
        images: [],
        imageUrl: t.imageUrl && !t.imageUrl.startsWith('data:') ? t.imageUrl : ''
      })),
      paymentMethods: (data.paymentMethods || []).map((pm) => ({
        ...pm,
        logoUrl: ''
      }))
    };
    localStorage.setItem(CACHED_APPDATA_KEY, JSON.stringify(liteData));
  } catch (err) {
    console.warn('Storage quota warning (ignored safely):', err);
  }
};

export default function POSScreen({ appData }: { appData: AppData }) {
  const [localAppData, setLocalAppData] = useState<AppData>(() => {
    if (appData && appData.categories?.length > 0) {
      return appData;
    }
    try {
      const cached = localStorage.getItem(CACHED_APPDATA_KEY);
      return cached ? JSON.parse(cached) : appData;
    } catch {
      return appData;
    }
  });

  useEffect(() => {
    if (appData && appData.categories?.length > 0) {
      setLocalAppData(appData);
      saveLiteAppDataToCache(appData);
    }
  }, [appData]);

  const [isOnline, setIsOnline] = useState<boolean>(navigator.onLine);
  const [offlineQueue, setOfflineQueue] = useState<OfflineSaleRecord[]>(() => {
    try {
      const saved = localStorage.getItem(OFFLINE_QUEUE_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [salesHistory, setSalesHistory] = useState<OfflineSaleRecord[]>(() => {
    try {
      const saved = localStorage.getItem(LOCAL_SALES_HISTORY_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [isSyncing, setIsSyncing] = useState(false);

  // 🌟 Navigation Views & Slide-Out Side Menu State 🌟
  const [activePosView, setActivePosView] = useState<
    'register' | 'online_bookings' | 'history' | 'extra_items' | 'discounts' | 'settings'
  >('register');
  const [isSideMenuOpen, setIsSideMenuOpen] = useState(false);

  // 🌟 Live Online Bookings State inside POS (For Instant Receipt Printing & Deposit Approval) 🌟
  const [liveOnlineBookings, setLiveOnlineBookings] = useState<any[]>([]);
  const [onlineSearchQuery, setOnlineSearchQuery] = useState('');
  const [onlineFilterTab, setOnlineFilterTab] = useState<'all' | 'today' | 'deposit_due'>('all');
  const [posDepositModalBooking, setPosDepositModalBooking] = useState<any | null>(null);
  const [posCustomDepositStr, setPosCustomDepositStr] = useState('');

  useEffect(() => {
    const q = query(collection(db, 'bookings'), orderBy('createdAt', 'desc'), limit(300));
    const unsub = onSnapshot(
      q,
      (snap) => {
        const list: any[] = [];
        const activePosInvoiceSet = new Set<string>();
        const cancelledPosInvoiceSet = new Set<string>();
        const paidInFullPosInvoiceSet = new Set<string>();
        let oldestLoadedMillis = Infinity;

        snap.forEach((d) => {
          const raw = d.data();
          const cAt = Number(raw.createdAt) || 0;
          if (cAt > 0 && cAt < oldestLoadedMillis) {
            oldestLoadedMillis = cAt;
          }

          const decTx = String(decryptText(raw.txId) || raw.txId || '').trim();
          const decDiscLabel = raw.discountLabel ? decryptText(raw.discountLabel) || raw.discountLabel : '';
          const isWalkInPos =
            decTx.startsWith('SL-') ||
            (raw.paymentMethod && String(raw.paymentMethod).includes('Shop POS')) ||
            String(decDiscLabel).includes('[Shop Walk-in');

          if (isWalkInPos) {
            if (raw.status === 'cancelled') {
              cancelledPosInvoiceSet.add(decTx);
            } else {
              activePosInvoiceSet.add(decTx);
              if (raw.paymentStatus === 'paid_in_full' || Number(raw.balanceDue) === 0) {
                paidInFullPosInvoiceSet.add(decTx);
              }
            }
          } else if (decTx !== 'ADMIN') {
            const total = Number(raw.totalPrice) || 0;
            const orig = raw.originalPrice ? Number(decryptText(raw.originalPrice) || raw.originalPrice) || total : total;
            const discPct = raw.discountPercent ? Number(decryptText(raw.discountPercent) || raw.discountPercent) || 0 : 0;
            list.push({
              id: d.id,
              ...raw,
              name: decryptText(raw.name) || raw.name || 'Online Guest',
              phone: decryptText(raw.phone) || raw.phone || '',
              txId: decTx,
              specialRequest: decryptText(raw.specialRequest) || raw.specialRequest || '',
              originalPrice: orig,
              discountPercent: discPct,
              discountLabel: decDiscLabel,
              vipTierName: raw.vipTierName ? decryptText(raw.vipTierName) : undefined
            });
          }
        });

        setLiveOnlineBookings(list);

        // 🌟 Real-Time Sync: Admin မှ Cancel သို့မဟုတ် Delete လုပ်ထားသော ဘောင်ချာများကို Shop POS မှ အလိုအလျောက် ဖယ်ရှားပေးခြင်း 🌟
        setSalesHistory((prevHistory) => {
          let changed = false;
          const syncedHistory = prevHistory
            .filter((item) => {
              // Offline ဖြစ်နေစဉ် ရိုက်ထားပြီး မSync ရသေးသော ဘောင်ချာများကို မဖျက်ပါ
              if (!item.synced) return true;
              // Admin မှ Cancel လုပ်ထားလျှင် Shop POS မှ ချက်ချင်းဖယ်ရှားမည်
              if (cancelledPosInvoiceSet.has(item.invoiceNo)) {
                changed = true;
                return false;
              }
              // Admin မှ အပြီးတိုင် Delete လုပ်ထားခဲ့သော ဘောင်ချာအဟောင်းများကိုလည်း Shop POS မှ ဖယ်ရှားမည်
              if (
                snap.size > 0 &&
                item.createdAt >= oldestLoadedMillis &&
                !activePosInvoiceSet.has(item.invoiceNo)
              ) {
                changed = true;
                return false;
              }
              return true;
            })
            .map((item) => {
              // Admin ဘက်မှ ကျန်ငွေ Approve လုပ်လိုက်ပါက Shop POS တွင်လည်း Paid in Full အလိုအလျောက် ပြောင်းပေးမည်
              if (
                item.paymentStatus === 'deposit_only' &&
                paidInFullPosInvoiceSet.has(item.invoiceNo)
              ) {
                changed = true;
                return {
                  ...item,
                  paymentStatus: 'paid_in_full' as const,
                  depositPaid: item.totalPrice,
                  balanceDue: 0
                };
              }
              return item;
            });

          if (changed) {
            try {
              localStorage.setItem(LOCAL_SALES_HISTORY_KEY, JSON.stringify(syncedHistory));
            } catch {}
            return syncedHistory;
          }
          return prevHistory;
        });
      },
      (err) => console.warn('POS real-time sync warning:', err)
    );
    return () => unsub();
  }, []);

  const pendingOnlineCount = useMemo(
    () => liveOnlineBookings.filter((b) => b.status === 'pending' || b.status === 'payment_checking').length,
    [liveOnlineBookings]
  );

  // 🌟 Convert Online Booking into POS Printable Receipt Format 🌟
  const convertOnlineBookingToReceipt = (b: any): OfflineSaleRecord => {
    const total = Number(b.totalPrice) || 0;
    const subTotal = Number(b.originalPrice) > total ? Number(b.originalPrice) : total;
    const discAmt = Math.max(0, subTotal - total);
    const isDepDue = b.paymentStatus === 'deposit_only' && Number(b.balanceDue) > 0;
    const depPaid = isDepDue ? Number(b.depositPaid) || 0 : total;
    const balDue = isDepDue ? Number(b.balanceDue) || 0 : 0;
    const cleanPayMethod = (b.paymentMethod || 'Online Pay').split('(')[0].trim();

    const serviceParts = String(b.service || 'Spa Service')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    const parsedItems: CartItem[] = serviceParts.map((part, idx) => {
      const isVvip = part.toLowerCase().includes('vvip');
      const durMatch = part.match(/\(([^)]+)\)/);
      const cleanName = part.replace(/\s*\([^)]*\)/g, '').replace('+ VVIP Upgrade', '').replace('+ VVIP', '').trim();
      return {
        cartId: `ob_${b.id}_${idx}`,
        id: `ob_${idx}`,
        name: cleanName || part,
        duration: durMatch ? durMatch[1] : undefined,
        price: serviceParts.length === 1 ? subTotal : Math.round(subTotal / serviceParts.length),
        isVvipUpgrade: isVvip,
        qty: 1
      };
    });

    return {
      localId: `online_${b.id}`,
      firestoreDocId: b.id,
      invoiceNo: b.txId ? `OB-${b.txId}` : `OB-${String(b.id).slice(-4).toUpperCase()}`,
      createdAt: b.createdAt || Date.now(),
      date: b.date || getLocalTodayStr(),
      time: b.time || 'Online',
      customerName: b.name || 'Online Guest',
      customerPhone: b.phone || '',
      customerVipTier: b.vipTierName,
      therapistName: b.therapist || 'Assigned Therapist',
      items: parsedItems,
      subTotal,
      discountType: 'percent',
      discountValue: Number(b.discountPercent) || 0,
      discountAmount: discAmt,
      discountReason: b.discountLabel || (discAmt > 0 ? 'Online Promo' : ''),
      totalPrice: total,
      paymentMethod: cleanPayMethod,
      paymentStatus: isDepDue ? 'deposit_only' : 'paid_in_full',
      depositPaid: depPaid,
      balanceDue: balDue,
      cashReceived: depPaid,
      changeDue: 0,
      serviceStatus: b.status === 'completed' ? 'completed' : 'in_progress',
      pointsEarned: Math.floor(total / 35000),
      note: b.specialRequest || 'Online Booking',
      synced: true
    };
  };

  // 🌟 Load Online Booking into POS Register Cart (To add Extra Items / VVIP Upgrade at Shop) 🌟
  const handleLoadOnlineBookingToPosCart = (b: any) => {
    const rec = convertOnlineBookingToReceipt(b);
    setCart(rec.items);
    setCustomerName(b.name || 'Online Guest');
    setCustomerPhone(b.phone || '');
    if (b.discountPercent && b.discountPercent > 0) {
      setDiscountType('percent');
      setDiscountValue(Number(b.discountPercent));
      setDiscountReason(b.discountLabel || `Online Promo (${b.discountPercent}% OFF)`);
    }
    const cleanMethod = (b.paymentMethod || 'KBZ PAY').split('(')[0].trim();
    setPaymentMethod(cleanMethod);
    if (b.paymentStatus === 'deposit_only' && Number(b.balanceDue) > 0) {
      setOnlinePayMode('deposit');
      setDepositAmountStr(String(b.depositPaid || ''));
    } else {
      setOnlinePayMode('full');
    }
    setSpecialNote(`Online Booking TxID: ${b.txId || '-'}`);
    setActivePosView('register');
    setPosStep(1);
  };

  // 🌟 Set 50% Deposit or Custom Deposit for Online Booking directly from POS 🌟
  const handlePosSetOnlineDeposit = async (b: any, depAmount: number) => {
    const total = Number(b.totalPrice) || 0;
    const validDep = Math.max(0, Math.min(total, Math.round(depAmount)));
    const balDue = Math.max(0, total - validDep);
    const cleanMethod = (b.paymentMethod || 'Online Pay').split('(')[0].trim();
    try {
      if (balDue === 0) {
        await updateDoc(doc(db, 'bookings', b.id), {
          paymentStatus: 'paid_in_full',
          depositPaid: total,
          balanceDue: 0,
          paymentMethod: `${cleanMethod} (Full Paid)`
        });
      } else {
        await updateDoc(doc(db, 'bookings', b.id), {
          paymentStatus: 'deposit_only',
          depositPaid: validDep,
          balanceDue: balDue,
          paymentMethod: `${cleanMethod} (စရံ: ${formatPrice(validDep)} | ကျန်ငွေ: ${formatPrice(balDue)})`
        });
      }
      setPosDepositModalBooking(null);
      setPosCustomDepositStr('');
    } catch (e) {
      alert('စရံသတ်မှတ်ရာတွင် အမှားအယွင်းရှိနေပါသည်။');
    }
  };

  // 🌟 Saved Extra / Sale Items State (Persisted in LocalStorage) 🌟
  const [savedExtraItems, setSavedExtraItems] = useState<SavedExtraItem[]>(() => {
    try {
      const saved = localStorage.getItem(SAVED_EXTRA_ITEMS_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {}
    return DEFAULT_EXTRA_ITEMS;
  });

  const [selectedExtraItemId, setSelectedExtraItemId] = useState<string>('');
  const [newExtraItemName, setNewExtraItemName] = useState('');
  const [newExtraItemPrice, setNewExtraItemPrice] = useState('');

  const updateSavedExtraItems = (newList: SavedExtraItem[]) => {
    setSavedExtraItems(newList);
    try {
      localStorage.setItem(SAVED_EXTRA_ITEMS_KEY, JSON.stringify(newList));
    } catch (e) {
      console.warn('Extra items storage error:', e);
    }
  };

  const handleCreateExtraItemInSettings = (e: React.FormEvent) => {
    e.preventDefault();
    const priceNum = parseInt(newExtraItemPrice, 10);
    if (!newExtraItemName.trim() || isNaN(priceNum) || priceNum <= 0) return;

    const newItem: SavedExtraItem = {
      id: `ext_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      name: newExtraItemName.trim(),
      price: priceNum
    };

    const updated = [newItem, ...savedExtraItems];
    updateSavedExtraItems(updated);
    setNewExtraItemName('');
    setNewExtraItemPrice('');
  };

  const handleDeleteSavedExtraItem = (id: string) => {
    const updated = savedExtraItems.filter((item) => item.id !== id);
    updateSavedExtraItems(updated);
    if (selectedExtraItemId === id) {
      setSelectedExtraItemId('');
    }
  };

  // 🌟 Saved Discount Presets State (Persisted in LocalStorage + Web App Active Promo Sync) 🌟
  const [savedDiscountPresets, setSavedDiscountPresets] = useState<SavedDiscountPreset[]>(() => {
    try {
      const saved = localStorage.getItem(SAVED_DISCOUNT_PRESETS_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {}
    return DEFAULT_DISCOUNT_PRESETS;
  });

  const [newDiscountLabel, setNewDiscountLabel] = useState('');
  const [newDiscountType, setNewDiscountType] = useState<'percent' | 'fixed'>('percent');
  const [newDiscountValue, setNewDiscountValue] = useState('');

  const updateSavedDiscountPresets = (newList: SavedDiscountPreset[]) => {
    setSavedDiscountPresets(newList);
    try {
      localStorage.setItem(SAVED_DISCOUNT_PRESETS_KEY, JSON.stringify(newList));
    } catch (e) {
      console.warn('Discount presets storage error:', e);
    }
  };

  const handleCreateDiscountPreset = (e: React.FormEvent) => {
    e.preventDefault();
    const valNum = parseInt(newDiscountValue, 10);
    if (!newDiscountLabel.trim() || isNaN(valNum) || valNum <= 0) return;

    const newPreset: SavedDiscountPreset = {
      id: `disc_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      label: newDiscountLabel.trim(),
      type: newDiscountType,
      value: newDiscountType === 'percent' ? Math.min(100, valNum) : valNum,
      category: 'custom'
    };

    updateSavedDiscountPresets([newPreset, ...savedDiscountPresets]);
    setNewDiscountLabel('');
    setNewDiscountValue('');
  };

  const handleDeleteDiscountPreset = (id: string) => {
    updateSavedDiscountPresets(savedDiscountPresets.filter((d) => d.id !== id));
  };

  // Combine Web App Active Promotion Discounts + Saved Presets for the Dropdown
  const allAvailableDiscounts = useMemo(() => {
    const dynamicWebPromos: SavedDiscountPreset[] = [];
    const promo = localAppData?.promotion as any;
    const campTitle = promo?.campaignTitle || 'သီတင်းကျွတ် မီးပုံးဖမ်းဂိမ်း';

    if (promo?.isPopupActive) {
      [5, 10, 15, 20, 25, 30].forEach((pct) => {
        dynamicWebPromos.push({
          id: `lantern_game_${pct}`,
          label: `${campTitle} (${pct}% OFF)`,
          type: 'percent',
          value: pct,
          category: 'campaign'
        });
      });
    }

    if (promo?.isBoxActive || promo?.isActive) {
      if (promo?.otherDiscountPercent && promo.otherDiscountPercent > 0) {
        dynamicWebPromos.push({
          id: 'webapp_active_promo_other',
          label: `${promo.boxTitle || 'In-App Promo'} - In-Spa (${promo.otherDiscountPercent}% OFF)`,
          type: 'percent',
          value: promo.otherDiscountPercent,
          category: 'campaign'
        });
      }
      if (promo?.hotelDiscountPercent && promo.hotelDiscountPercent > 0) {
        dynamicWebPromos.push({
          id: 'webapp_active_promo_hotel',
          label: `${promo.boxTitle || 'In-App Promo'} - Outcall (${promo.hotelDiscountPercent}% OFF)`,
          type: 'percent',
          value: promo.hotelDiscountPercent,
          category: 'campaign'
        });
      }
    }
    return [...dynamicWebPromos, ...savedDiscountPresets];
  }, [localAppData?.promotion, savedDiscountPresets]);

  // 🌟 Loyverse-Style Receipt Settings State 🌟
  const [printSettings, setPrintSettings] = useState<PosPrintSettings>(() => {
    try {
      const saved = localStorage.getItem(POS_PRINT_SETTINGS_KEY);
      if (saved) {
        return { ...DEFAULT_PRINT_SETTINGS, ...JSON.parse(saved) };
      }
    } catch {}
    return {
      ...DEFAULT_PRINT_SETTINGS,
      shopName: localAppData?.branding?.name || DEFAULT_PRINT_SETTINGS.shopName,
      footerText: localAppData?.branding?.address || DEFAULT_PRINT_SETTINGS.footerText,
      phone: localAppData?.branding?.phone1 || DEFAULT_PRINT_SETTINGS.phone
    };
  });

  const updatePrintSettings = (partial: Partial<PosPrintSettings>) => {
    setPrintSettings((prev) => {
      const updated = { ...prev, ...partial };
      try {
        localStorage.setItem(POS_PRINT_SETTINGS_KEY, JSON.stringify(updated));
      } catch {}
      return updated;
    });
  };

  const printedLogoInputRef = useRef<HTMLInputElement | null>(null);

  // 🌟 UI/UX Animation Refs & States (Jump-to-Bill Effect) 🌟
  const billCardRef = useRef<HTMLDivElement | null>(null);
  const billListScrollRef = useRef<HTMLDivElement | null>(null);
  const extraDropdownBtnRef = useRef<HTMLButtonElement | null>(null);
  const [flyingBubbles, setFlyingBubbles] = useState<FlyingBubble[]>([]);
  const [isBillCardBouncing, setIsBillCardBouncing] = useState(false);
  const [recentlyAddedItemId, setRecentlyAddedItemId] = useState<string | null>(null);

  // 🌟 Direct Web Bluetooth Printer States 🌟
  const [bluetoothDevice, setBluetoothDevice] = useState<any>(null);
  const [btCharacteristic, setBtCharacteristic] = useState<any>(null);
  const [isPrintingBt, setIsPrintingBt] = useState(false);
  const [processedLogoPreview, setProcessedLogoPreview] = useState<string>('');

  const digitalLogoUrl = defaultLogoImg || localAppData?.branding?.logoUrl || '';
  const printedLogoSourceUrl = printSettings.customPrintedLogoDataUrl || digitalLogoUrl;

  const [posStep, setPosStep] = useState<1 | 2 | 3 | 4>(1);
  const [activeCategory, setActiveCategory] = useState<string | null>(
    localAppData?.categories?.[0]?.id || 'massage'
  );

  const [cart, setCart] = useState<CartItem[]>([]);

  const [therapist1, setTherapist1] = useState<TherapistProfile | null>(null);
  const [therapist2, setTherapist2] = useState<TherapistProfile | null>(null);

  const [saleDate, setSaleDate] = useState<string>(getLocalTodayStr());
  const [saleTime, setSaleTime] = useState<string>(() => {
    const now = new Date();
    return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  });
  const [serviceStatus, setServiceStatus] = useState<'in_progress' | 'completed'>('in_progress');

  // 🌟 Customer, VIP Auto-Benefit & Active Promo Conflict Choice States 🌟
  const [customerName, setCustomerName] = useState('Walk-in Guest');
  const [customerPhone, setCustomerPhone] = useState('');
  const [foundCustomerPts, setFoundCustomerPts] = useState<number | null>(null);
  const [detectedVipBenefit, setDetectedVipBenefit] = useState<{
    tierName: string;
    discountPercent: number;
  } | null>(null);
  const [benefitChoiceMode, setBenefitChoiceMode] = useState<'vip' | 'promo'>('vip');
  const [isSearchingCustomer, setIsSearchingCustomer] = useState<boolean>(false);
  const [detectedCampaignWin, setDetectedCampaignWin] = useState<{
    campaignName: string;
    discountPercent: number;
    date?: string;
  } | null>(null);

  // 🌟 Discount States 🌟
  const [selectedDiscountPresetId, setSelectedDiscountPresetId] = useState<string>('none');
  const [discountType, setDiscountType] = useState<'percent' | 'fixed'>('percent');
  const [discountValue, setDiscountValue] = useState<number>(0);
  const [discountReason, setDiscountReason] = useState('No Discount');
  const [showCustomDiscountInputs, setShowCustomDiscountInputs] = useState(false);

  // 🌟 Payment & Deposit / Balance Due States 🌟
  const [paymentMethod, setPaymentMethod] = useState<string>('Cash');
  const [onlinePayMode, setOnlinePayMode] = useState<'full' | 'deposit'>('full');
  const [depositAmountStr, setDepositAmountStr] = useState<string>('');
  const [cashReceived, setCashReceived] = useState<string>('');
  const [specialNote, setSpecialNote] = useState('');

  const [activeReceipt, setActiveReceipt] = useState<OfflineSaleRecord | null>(null);
  const [savingSale, setSavingSale] = useState(false);
  const [approvingBalanceId, setApprovingBalanceId] = useState<string | null>(null);

  // 🌟 Receipts History Date Filter & Search States 🌟
  const [historyDateFilterMode, setHistoryDateFilterMode] = useState<'all' | 'today' | 'yesterday' | 'custom'>('all');
  const [historyCustomDate, setHistoryCustomDate] = useState<string>(getLocalTodayStr());
  const [historySearchQuery, setHistorySearchQuery] = useState<string>('');

  const getYesterdayStr = () => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
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

  // 🌟 Filter & Group Receipts by Date with Daily Totals 🌟
  const groupedHistoryByDate = useMemo(() => {
    const today = getLocalTodayStr();
    const yesterday = getYesterdayStr();
    const q = historySearchQuery.trim().toLowerCase();

    const filtered = salesHistory.filter((sale) => {
      if (historyDateFilterMode === 'today' && sale.date !== today) return false;
      if (historyDateFilterMode === 'yesterday' && sale.date !== yesterday) return false;
      if (historyDateFilterMode === 'custom' && historyCustomDate && sale.date !== historyCustomDate) return false;

      if (q) {
        const matchInvoice = (sale.invoiceNo || '').toLowerCase().includes(q);
        const matchCust = (sale.customerName || '').toLowerCase().includes(q);
        const matchPhone = (sale.customerPhone || '').toLowerCase().includes(q);
        const matchTherapist = (sale.therapistName || '').toLowerCase().includes(q);
        const matchItems = sale.items.some((i) => i.name.toLowerCase().includes(q));
        if (!matchInvoice && !matchCust && !matchPhone && !matchTherapist && !matchItems) return false;
      }
      return true;
    });

    const groupsMap = new Map<
      string,
      {
        date: string;
        sales: OfflineSaleRecord[];
        dailyTotalAmount: number;
        dailyDiscountAmount: number;
        dailyCashTotal: number;
        dailyOnlineTotal: number;
        dailyPendingBalance: number;
      }
    >();

    filtered.forEach((sale) => {
      const dKey = sale.date || today;
      if (!groupsMap.has(dKey)) {
        groupsMap.set(dKey, {
          date: dKey,
          sales: [],
          dailyTotalAmount: 0,
          dailyDiscountAmount: 0,
          dailyCashTotal: 0,
          dailyOnlineTotal: 0,
          dailyPendingBalance: 0
        });
      }
      const grp = groupsMap.get(dKey)!;
      grp.sales.push(sale);

      const total = Number(sale.totalPrice) || 0;
      const disc = Number(sale.discountAmount) || 0;
      const isDepositDue = sale.paymentStatus === 'deposit_only' && Number(sale.balanceDue) > 0;
      const due = isDepositDue ? Number(sale.balanceDue) || 0 : 0;
      const paidNow = isDepositDue ? Number(sale.depositPaid) || 0 : total;

      grp.dailyTotalAmount += total;
      grp.dailyDiscountAmount += disc;
      grp.dailyPendingBalance += due;

      if (sale.paymentMethod === 'Cash') {
        grp.dailyCashTotal += paidNow;
      } else {
        grp.dailyOnlineTotal += paidNow;
      }
    });

    return Array.from(groupsMap.values()).sort((a, b) => b.date.localeCompare(a.date));
  }, [salesHistory, historyDateFilterMode, historyCustomDate, historySearchQuery]);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      syncOfflineRecords();
    };
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [offlineQueue]);

  // 🌟 Find Writable Characteristic with Timeout Protection (Never hangs on PRINTING...!) 🌟
  const findWritableCharacteristic = async (device: any) => {
    const connectAndDiscover = async () => {
      if (!device.gatt.connected) {
        await device.gatt.connect();
      }
      const services = await device.gatt.getPrimaryServices();
      for (const service of services) {
        try {
          const characteristics = await service.getCharacteristics();
          for (const char of characteristics) {
            if (char.properties.write || char.properties.writeWithoutResponse) {
              return char;
            }
          }
        } catch {}
      }
      throw new Error('Printer write channel not found.');
    };

    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Bluetooth connection timed out.')), 5000)
    );

    return Promise.race([connectAndDiscover(), timeoutPromise]);
  };

  // 🌟 Auto-Reconnect Saved Bluetooth Printer on Page Load / Refresh 🌟
  useEffect(() => {
    let isMounted = true;
    const tryAutoReconnectPrinter = async () => {
      try {
        const bt = (navigator as any).bluetooth;
        if (!bt || typeof bt.getDevices !== 'function') return;

        const permittedDevices = await bt.getDevices();
        if (!permittedDevices || permittedDevices.length === 0) return;

        const targetDevice =
          permittedDevices.find(
            (d: any) =>
              (printSettings.savedPrinterId && d.id === printSettings.savedPrinterId) ||
              (printSettings.savedPrinterName && d.name === printSettings.savedPrinterName)
          ) || permittedDevices[0];

        if (!targetDevice) return;

        const writeChar = await findWritableCharacteristic(targetDevice);
        if (!isMounted) return;

        targetDevice.addEventListener('gattserverdisconnected', () => {
          setBtCharacteristic(null);
        });

        setBluetoothDevice(targetDevice);
        setBtCharacteristic(writeChar);
      } catch {}
    };

    tryAutoReconnectPrinter();
    return () => {
      isMounted = false;
    };
  }, []);

  // 🌟 Unified Top Header (Logo + "THE SHANGRI-LA" + "MEN'S RETREAT" in a SINGLE Raster Block for Zero Mid-Receipt Stutter!) 🌟
  const buildUnifiedHeaderRasterData = async (
    imgUrl: string,
    showLogo: boolean,
    filterMode: 'auto_gold_extract' | 'bw_threshold',
    thresholdVal: number,
    sizePx: number,
    shopName: string,
    subtitle: string
  ): Promise<{ rasterBytes: Uint8Array | null; previewDataUrl: string }> => {
    return new Promise((resolve) => {
      const renderHeaderWithOptionalLogo = (loadedImg: HTMLImageElement | null) => {
        try {
          const titleText = (shopName || '').trim().toUpperCase();
          const subText = (subtitle || '').trim().toUpperCase();

          const bannerWidth = 288;
          let logoCanvas: HTMLCanvasElement | null = null;
          let logoHeight = 0;
          let previewDataUrl = '';

          if (showLogo && loadedImg) {
            const targetLogoW = Math.max(96, Math.min(256, Math.round(sizePx / 8) * 8));
            const aspect = loadedImg.height / (loadedImg.width || 1);
            const rawHeight = Math.round(targetLogoW * aspect);

            const tempCanvas = document.createElement('canvas');
            tempCanvas.width = targetLogoW;
            tempCanvas.height = rawHeight;
            const tempCtx = tempCanvas.getContext('2d');

            if (tempCtx) {
              tempCtx.fillStyle = '#FFFFFF';
              tempCtx.fillRect(0, 0, targetLogoW, rawHeight);
              tempCtx.drawImage(loadedImg, 0, 0, targetLogoW, rawHeight);

              const rawImgData = tempCtx.getImageData(0, 0, targetLogoW, rawHeight);
              const rawPixels = rawImgData.data;

              const cornerLum =
                rawPixels[0] * 0.299 + rawPixels[1] * 0.587 + rawPixels[2] * 0.114;
              const isAlreadyLightBg = cornerLum > 200 || rawPixels[3] < 50;

              const dotMatrix: boolean[][] = [];
              let firstBlackRow = rawHeight;
              let lastBlackRow = 0;

              for (let y = 0; y < rawHeight; y++) {
                const row: boolean[] = [];
                for (let x = 0; x < targetLogoW; x++) {
                  const idx = (y * targetLogoW + x) * 4;
                  const r = rawPixels[idx];
                  const g = rawPixels[idx + 1];
                  const b = rawPixels[idx + 2];
                  const a = rawPixels[idx + 3];

                  let isBlack = false;
                  if (a > 60) {
                    const lum = r * 0.299 + g * 0.587 + b * 0.114;
                    if (filterMode === 'auto_gold_extract' && !isAlreadyLightBg) {
                      const goldWarmth = r - g;
                      const goldContrast = r - b;
                      if (
                        goldWarmth >= Math.max(4, thresholdVal - 3) ||
                        goldContrast >= 22 ||
                        lum > 92
                      ) {
                        isBlack = true;
                      }
                    } else {
                      const bwCutoff = Math.max(40, Math.min(235, 150 + thresholdVal * 2));
                      isBlack = lum < bwCutoff;
                    }
                  }

                  row.push(isBlack);
                  if (isBlack) {
                    if (y < firstBlackRow) firstBlackRow = y;
                    if (y > lastBlackRow) lastBlackRow = y;
                  }
                }
                dotMatrix.push(row);
              }

              if (firstBlackRow > lastBlackRow) {
                firstBlackRow = 0;
                lastBlackRow = rawHeight - 1;
              } else {
                firstBlackRow = Math.max(0, firstBlackRow - 8);
                lastBlackRow = Math.min(rawHeight - 1, lastBlackRow + 4);
              }

              const topSafePad = 12;
              const bottomSafePad = 4;
              const contentH = Math.max(16, lastBlackRow - firstBlackRow + 1);
              logoHeight = contentH + topSafePad + bottomSafePad;

              logoCanvas = document.createElement('canvas');
              logoCanvas.width = targetLogoW;
              logoCanvas.height = logoHeight;
              const lCtx = logoCanvas.getContext('2d');
              const lImgData = lCtx ? lCtx.createImageData(targetLogoW, logoHeight) : null;

              if (lCtx && lImgData) {
                for (let y = 0; y < logoHeight; y++) {
                  const srcY = y - topSafePad + firstBlackRow;
                  const inBoundsY =
                    y >= topSafePad && y < topSafePad + contentH && srcY < rawHeight;
                  for (let x = 0; x < targetLogoW; x++) {
                    const isBlackDot = inBoundsY ? dotMatrix[srcY][x] : false;
                    const pIdx = (y * targetLogoW + x) * 4;
                    const val = isBlackDot ? 20 : 255;
                    lImgData.data[pIdx] = val;
                    lImgData.data[pIdx + 1] = val;
                    lImgData.data[pIdx + 2] = val;
                    lImgData.data[pIdx + 3] = 255;
                  }
                }
                lCtx.putImageData(lImgData, 0, 0);
                previewDataUrl = logoCanvas.toDataURL('image/png');
              }
            }
          }

          let textBlockH = 0;
          if (titleText) textBlockH += 30;
          if (subText) textBlockH += 18;

          const totalBannerH = Math.ceil((logoHeight + textBlockH + 4) / 8) * 8;
          if (totalBannerH <= 8) {
            resolve({ rasterBytes: null, previewDataUrl });
            return;
          }

          const masterCanvas = document.createElement('canvas');
          masterCanvas.width = bannerWidth;
          masterCanvas.height = totalBannerH;
          const mCtx = masterCanvas.getContext('2d');
          if (!mCtx) {
            resolve({ rasterBytes: null, previewDataUrl });
            return;
          }

          mCtx.fillStyle = '#FFFFFF';
          mCtx.fillRect(0, 0, bannerWidth, totalBannerH);

          let curY = 0;
          if (logoCanvas) {
            const logoX = Math.round((bannerWidth - logoCanvas.width) / 2);
            mCtx.drawImage(logoCanvas, logoX, 0);
            curY += logoHeight + 2;
          } else {
            curY += 4;
          }

          mCtx.fillStyle = '#000000';
          mCtx.textAlign = 'center';
          mCtx.textBaseline = 'top';

          if (titleText) {
            mCtx.font = '900 23px Georgia, "Times New Roman", Times, serif';
            if ('letterSpacing' in mCtx) {
              (mCtx as any).letterSpacing = '1.2px';
            }
            mCtx.fillText(titleText, bannerWidth / 2, curY);
            mCtx.fillText(titleText, bannerWidth / 2 + 0.45, curY);
            curY += 28;
          }

          if (subText) {
            mCtx.font = '700 12px "Courier New", Courier, monospace, sans-serif';
            if ('letterSpacing' in mCtx) {
              (mCtx as any).letterSpacing = '2.5px';
            }
            mCtx.fillText(subText, bannerWidth / 2, curY);
          }

          const finalPixels = mCtx.getImageData(0, 0, bannerWidth, totalBannerH).data;
          const nBytesPerRow = Math.ceil(bannerWidth / 8);
          const bitmapBytes: number[] = [];

          for (let y = 0; y < totalBannerH; y++) {
            for (let xByte = 0; xByte < nBytesPerRow; xByte++) {
              let byte = 0;
              for (let bit = 0; bit < 8; bit++) {
                const pxCol = xByte * 8 + bit;
                if (pxCol < bannerWidth) {
                  const idx = (y * bannerWidth + pxCol) * 4;
                  const lum =
                    finalPixels[idx] * 0.299 +
                    finalPixels[idx + 1] * 0.587 +
                    finalPixels[idx + 2] * 0.114;
                  if (lum < 165) {
                    byte |= 1 << (7 - bit);
                  }
                }
              }
              bitmapBytes.push(byte);
            }
          }

          const xL = nBytesPerRow & 0xff;
          const xH = (nBytesPerRow >> 8) & 0xff;
          const yL = totalBannerH & 0xff;
          const yH = (totalBannerH >> 8) & 0xff;
          const rasterHeader = [0x1d, 0x76, 0x30, 0x00, xL, xH, yL, yH];

          resolve({
            rasterBytes: new Uint8Array([...rasterHeader, ...bitmapBytes]),
            previewDataUrl
          });
        } catch (e) {
          console.warn('Unified header raster error:', e);
          resolve({ rasterBytes: null, previewDataUrl: '' });
        }
      };

      if (showLogo && imgUrl) {
        const img = new Image();
        img.crossOrigin = 'Anonymous';
        img.onload = () => renderHeaderWithOptionalLogo(img);
        img.onerror = () => renderHeaderWithOptionalLogo(null);
        img.src = imgUrl;
      } else {
        renderHeaderWithOptionalLogo(null);
      }
    });
  };

  useEffect(() => {
    let active = true;
    if (printSettings.showLogo && printedLogoSourceUrl) {
      buildUnifiedHeaderRasterData(
        printedLogoSourceUrl,
        true,
        printSettings.logoFilterMode,
        printSettings.logoThreshold,
        printSettings.logoSize,
        printSettings.shopName,
        printSettings.subtitle
      ).then((res) => {
        if (active && res.previewDataUrl) {
          setProcessedLogoPreview(res.previewDataUrl);
        }
      });
    } else {
      setProcessedLogoPreview('');
    }
    return () => {
      active = false;
    };
  }, [
    printedLogoSourceUrl,
    printSettings.showLogo,
    printSettings.logoFilterMode,
    printSettings.logoThreshold,
    printSettings.logoSize,
    printSettings.shopName,
    printSettings.subtitle
  ]);

  // 🌟 Handle Custom Printed Receipt Logo Upload 🌟
  const handleUploadPrintedLogo = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        updatePrintSettings({ customPrintedLogoDataUrl: reader.result });
      }
    };
    reader.readAsDataURL(file);
  };

  const updateOfflineQueue = (newQueue: OfflineSaleRecord[]) => {
    setOfflineQueue(newQueue);
    try {
      localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(newQueue));
    } catch (e) {
      console.warn('Queue storage error:', e);
    }
  };

  const addToLocalHistory = (record: OfflineSaleRecord) => {
    const updated = [record, ...salesHistory.filter((r) => r.localId !== record.localId)].slice(0, 60);
    setSalesHistory(updated);
    try {
      localStorage.setItem(LOCAL_SALES_HISTORY_KEY, JSON.stringify(updated));
    } catch (e) {
      console.warn('History storage error:', e);
    }
  };

  const format12Hour = (time24: string) => {
    if (!time24 || !time24.includes(':')) return '12:00 PM';
    const [hStr, mStr] = time24.split(':');
    let h = parseInt(hStr, 10);
    const ampm = h >= 12 ? 'PM' : 'AM';
    h = h % 12 || 12;
    return `${h}:${mStr} ${ampm}`;
  };

  const uploadSaleToFirebase = async (record: OfflineSaleRecord): Promise<string> => {
    const serviceSummary = record.items
      .map(
        (item) =>
          `${item.name}${item.duration ? ` (${item.duration})` : ''}${item.isVvipUpgrade ? ' + VVIP' : ''}${
            item.qty > 1 ? ` x${item.qty}` : ''
          }`
      )
      .join(', ');

    const discountLabelText =
      record.discountAmount > 0
        ? `[Shop Walk-in] ${record.discountReason || 'Discount'} (${
            record.discountType === 'percent' ? `${record.discountValue}%` : formatPrice(record.discountValue)
          })`
        : '[Shop Walk-in Sale]';

    const paymentMethodSummary =
      record.paymentStatus === 'deposit_only'
        ? `${record.paymentMethod} (စရံ: ${formatPrice(record.depositPaid)} | ကျန်ငွေ: ${formatPrice(record.balanceDue)})`
        : `${record.paymentMethod} (Shop POS)`;

    const noteWithBalanceInfo = [
      record.note ? `[POS Note]: ${record.note}` : 'Shop Walk-in POS Sale',
      record.paymentStatus === 'deposit_only'
        ? `[PENDING BALANCE]: စရံ ${formatPrice(record.depositPaid)} ပေးချေပြီး၊ ကျန်ငွေ ${formatPrice(
            record.balanceDue
          )} ကောက်ခံရန်ကျန်ရှိ`
        : ''
    ]
      .filter(Boolean)
      .join(' | ');

    const bookingPayload: any = {
      name: encryptText(`${record.customerName} (Walk-in)`),
      phone: encryptText(record.customerPhone || 'Walk-in'),
      service: serviceSummary,
      therapist: record.therapistName || 'Any Available Therapist',
      date: record.date,
      time: record.time,
      paymentMethod: paymentMethodSummary,
      paymentStatus: record.paymentStatus,
      depositPaid: Number(record.depositPaid) || 0,
      balanceDue: Number(record.balanceDue) || 0,
      txId: encryptText(record.invoiceNo),
      totalPrice: Number(record.totalPrice) || 0,
      originalPrice: encryptText(record.subTotal.toString()),
      discountPercent: encryptText(
        record.discountType === 'percent'
          ? record.discountValue.toString()
          : Math.round((record.discountAmount / (record.subTotal || 1)) * 100).toString()
      ),
      discountLabel: encryptText(discountLabelText),
      specialRequest: encryptText(noteWithBalanceInfo),
      status: record.serviceStatus,
      createdAt: record.createdAt,
      ...(record.startTimeMillis && { startTimeMillis: record.startTimeMillis }),
      ...(record.expectedEndTimeMillis && { expectedEndTimeMillis: record.expectedEndTimeMillis })
    };

    const docRef = await addDoc(collection(db, 'bookings'), bookingPayload);

    if (record.customerPhone && record.customerPhone.trim().length >= 7 && record.pointsEarned > 0) {
      const cleanPhone = record.customerPhone.trim();
      const usersSnap = await getDocs(collection(db, 'users'));
      let foundDocId: string | null = null;
      let existingPts = 0;

      usersSnap.forEach((d) => {
        try {
          const data = d.data();
          const decPhone = decryptText(data.phone) || d.id;
          if (decPhone === cleanPhone || d.id === cleanPhone) {
            foundDocId = d.id;
            const decPts = decryptText(data.points) || data.points;
            existingPts = parseInt(decPts, 10) || 0;
          }
        } catch {}
      });

      const newTotalPts = existingPts + record.pointsEarned;
      if (foundDocId) {
        await updateDoc(doc(db, 'users', foundDocId), {
          points: encryptText(newTotalPts.toString())
        });
      } else {
        await addDoc(collection(db, 'users'), {
          phone: encryptText(cleanPhone),
          name: encryptText(record.customerName || 'Walk-in Guest'),
          password: encryptText(''),
          dob: encryptText(''),
          points: encryptText(record.pointsEarned.toString()),
          createdAt: Date.now()
        });
      }

      await addDoc(collection(db, 'point_history'), {
        phone: encryptText(cleanPhone),
        amount: encryptText(record.totalPrice.toString()),
        pointsEarned: encryptText(record.pointsEarned.toString()),
        invoiceNo: encryptText(record.invoiceNo),
        type: encryptText('Shop Walk-in POS'),
        date: record.date,
        createdAt: record.createdAt
      });
    }

    return docRef.id;
  };

  // 🌟 Approve Remaining Balance Due (Marks Deposit Sale as Paid in Full in Both POS & Admin Backoffice!) 🌟
  const handleApproveBalancePaid = async (sale: OfflineSaleRecord) => {
    setApprovingBalanceId(sale.localId);
    try {
      const cleanMethod = sale.paymentMethod.split('(')[0].trim();
      if (navigator.onLine) {
        let targetDocId = sale.firestoreDocId;
        if (!targetDocId) {
          const bookingsSnap = await getDocs(collection(db, 'bookings'));
          bookingsSnap.forEach((d) => {
            try {
              const bData = d.data();
              const decTx = decryptText(bData.txId) || bData.txId;
              if (decTx === sale.invoiceNo) {
                targetDocId = d.id;
              }
            } catch {}
          });
        }
        if (targetDocId) {
          await updateDoc(doc(db, 'bookings', targetDocId), {
            paymentStatus: 'paid_in_full',
            balanceDue: 0,
            depositPaid: sale.totalPrice,
            paymentMethod: `${cleanMethod} (Full Paid - Approved)`,
            specialRequest: encryptText(
              `${sale.note ? `[POS Note]: ${sale.note} | ` : ''}[BALANCE APPROVED]: ကျန်ငွေ ${formatPrice(
                sale.balanceDue
              )} အပြည့်အဝ လက်ခံရရှိပြီး`
            )
          });
        }
      }

      const updatedSale: OfflineSaleRecord = {
        ...sale,
        paymentStatus: 'paid_in_full',
        depositPaid: sale.totalPrice,
        balanceDue: 0,
        cashReceived: sale.totalPrice
      };

      const updatedHistory = salesHistory.map((h) =>
        h.localId === sale.localId ? updatedSale : h
      );
      setSalesHistory(updatedHistory);
      try {
        localStorage.setItem(LOCAL_SALES_HISTORY_KEY, JSON.stringify(updatedHistory));
      } catch {}

      if (activeReceipt?.localId === sale.localId) {
        setActiveReceipt(updatedSale);
      }
    } catch (err) {
      console.error('Approve balance error:', err);
      alert('ကျန်ငွေ အတည်ပြုရာတွင် အမှားအယွင်းရှိနေပါသည်။');
    } finally {
      setApprovingBalanceId(null);
    }
  };

  const syncOfflineRecords = async () => {
    if (!navigator.onLine || offlineQueue.length === 0 || isSyncing) return;
    setIsSyncing(true);
    const remaining: OfflineSaleRecord[] = [];
    const syncedMap = new Map<string, string>();

    for (const record of offlineQueue) {
      try {
        const docId = await uploadSaleToFirebase(record);
        syncedMap.set(record.localId, docId);
      } catch (err) {
        console.warn('Sync failed for record:', record.invoiceNo, err);
        remaining.push(record);
      }
    }

    updateOfflineQueue(remaining);

    if (syncedMap.size > 0) {
      const updatedHistory = salesHistory.map((h) =>
        syncedMap.has(h.localId)
          ? { ...h, synced: true, firestoreDocId: syncedMap.get(h.localId) }
          : h
      );
      setSalesHistory(updatedHistory);
      try {
        localStorage.setItem(LOCAL_SALES_HISTORY_KEY, JSON.stringify(updatedHistory));
      } catch {}
    }

    setIsSyncing(false);
  };

  // 🌟 Apply Either VIP Member Benefit OR Active Promotion Benefit 🌟
  const applyVipOrPromoChoice = (
    choice: 'vip' | 'promo',
    vipData: { tierName: string; discountPercent: number } | null,
    campaignWinData?: { campaignName: string; discountPercent: number; date?: string } | null
  ) => {
    setBenefitChoiceMode(choice);
    const promo = localAppData?.promotion as any;
    const activeWin = campaignWinData !== undefined ? campaignWinData : detectedCampaignWin;

    if (choice === 'vip' && vipData) {
      setDiscountType('percent');
      setDiscountValue(vipData.discountPercent);
      setDiscountReason(`${vipData.tierName} (${vipData.discountPercent}% OFF)`);
      const matchingPreset = allAvailableDiscounts.find(
        (d) => d.type === 'percent' && d.value === vipData.discountPercent && d.category === 'vip'
      );
      setSelectedDiscountPresetId(matchingPreset ? matchingPreset.id : 'custom');
    } else if (choice === 'promo') {
      if (activeWin && activeWin.discountPercent > 0) {
        setDiscountType('percent');
        setDiscountValue(activeWin.discountPercent);
        setDiscountReason(`${activeWin.campaignName} (${activeWin.discountPercent}% OFF)`);
        const matchingLantern = allAvailableDiscounts.find(
          (d) => d.id === `lantern_game_${activeWin.discountPercent}`
        );
        setSelectedDiscountPresetId(matchingLantern ? matchingLantern.id : 'custom');
      } else {
        const promoPct = promo?.otherDiscountPercent || promo?.hotelDiscountPercent || 15;
        const campTitle = promo?.campaignTitle || promo?.boxTitle || 'သီတင်းကျွတ် အထူးပရိုမိုးရှင်း';
        setDiscountType('percent');
        setDiscountValue(promoPct);
        setDiscountReason(`${campTitle} (${promoPct}% OFF)`);
        const matchingCamp = allAvailableDiscounts.find(
          (d) => d.type === 'percent' && d.value === promoPct
        );
        setSelectedDiscountPresetId(matchingCamp ? matchingCamp.id : 'custom');
      }
    }
  };

  // 🌟 Customer Phone Lookup -> Checks BOTH VIP Member Card AND Thadingyut Lantern Game (`campaign_records`)! 🌟
  const handleCheckCustomerPhone = async () => {
    const cleanInput = customerPhone.trim();
    if (!cleanInput) {
      setFoundCustomerPts(null);
      setDetectedVipBenefit(null);
      setDetectedCampaignWin(null);
      return;
    }
    if (!isOnline) return;

    setIsSearchingCustomer(true);
    try {
      const normalizePhone = (p: string) => p.replace(/[^0-9]/g, '').replace(/^959/, '09');
      const targetNorm = normalizePhone(cleanInput);

      const [usersSnap, campaignSnap] = await Promise.all([
        getDocs(collection(db, 'users')),
        getDocs(collection(db, 'campaign_records')).catch(() => null)
      ]);

      // 1. Check Users Collection for VIP Member & Points
      let foundUser = false;
      let vipBenefit: { tierName: string; discountPercent: number } | null = null;

      usersSnap.forEach((d) => {
        try {
          const data = d.data();
          const decPhone = decryptText(data.phone) || d.id;
          if (decPhone === cleanInput || d.id === cleanInput || normalizePhone(decPhone) === targetNorm) {
            foundUser = true;
            const decName = decryptText(data.name) || data.name;
            const decPts = parseInt(decryptText(data.points) || data.points || '0', 10);
            const decTier = decryptText(data.vipTier || data.tier || '') || data.vipTier || data.tier || '';
            const decVipDisc = parseInt(
              decryptText(data.vipDiscount || data.discountPercent || '') ||
                data.vipDiscount ||
                data.discountPercent ||
                '0',
              10
            );

            if (decName) setCustomerName(decName);
            const ptsNum = isNaN(decPts) ? 0 : decPts;
            setFoundCustomerPts(ptsNum);

            vipBenefit = detectCustomerVipBenefit(
              ptsNum,
              decTier,
              isNaN(decVipDisc) ? 0 : decVipDisc
            );
          }
        } catch {}
      });

      if (!foundUser) {
        setFoundCustomerPts(0);
      }
      setDetectedVipBenefit(vipBenefit);

      // 2. Check `campaign_records` Collection for Thadingyut Lantern Game Winner!
      let latestCampaignWin: { campaignName: string; discountPercent: number; date?: string; createdAt: number } | null = null;
      const campTitle = (localAppData?.promotion as any)?.campaignTitle || 'သီတင်းကျွတ် မီးပုံးဖမ်းဂိမ်း';

      if (campaignSnap) {
        campaignSnap.forEach((docSnap) => {
          try {
            const cData = docSnap.data();
            const rawPhone = String(cData.phone || '').trim();
            if (rawPhone === cleanInput || (targetNorm.length >= 7 && normalizePhone(rawPhone) === targetNorm)) {
              const wonPct = Number(cData.discountPercent) || 0;
              const cTime = Number(cData.createdAt) || 0;
              if (wonPct > 0 && (!latestCampaignWin || cTime >= latestCampaignWin.createdAt)) {
                latestCampaignWin = {
                  campaignName: campTitle,
                  discountPercent: wonPct,
                  date: cData.date || '',
                  createdAt: cTime
                };
              }
            }
          } catch {}
        });
      }

      setDetectedCampaignWin(latestCampaignWin);

      // 3. Auto-Apply Discount Logic
      if (vipBenefit && latestCampaignWin) {
        // Both VIP and Lantern Game Win exist -> Default to whichever gives higher discount, and show switcher!
        if (latestCampaignWin.discountPercent > vipBenefit.discountPercent) {
          applyVipOrPromoChoice('promo', vipBenefit, latestCampaignWin);
        } else {
          applyVipOrPromoChoice('vip', vipBenefit, latestCampaignWin);
        }
      } else if (vipBenefit) {
        applyVipOrPromoChoice('vip', vipBenefit, null);
      } else if (latestCampaignWin) {
        applyVipOrPromoChoice('promo', null, latestCampaignWin);
      }
    } catch (e) {
      console.warn('Customer lookup error:', e);
    } finally {
      setTimeout(() => setIsSearchingCustomer(false), 300);
    }
  };

  // 🌟 UI/UX Parabolic Jump-to-Bill Animation Trigger 🌟
  const triggerJumpToBillAnimation = (
    sourceElement: HTMLElement | null,
    itemName: string,
    priceNum: number,
    targetItemId: string
  ) => {
    setRecentlyAddedItemId(targetItemId);
    setTimeout(() => {
      setRecentlyAddedItemId((prev) => (prev === targetItemId ? null : prev));
    }, 850);

    setTimeout(() => {
      if (billListScrollRef.current) {
        billListScrollRef.current.scrollTo({
          top: billListScrollRef.current.scrollHeight,
          behavior: 'smooth'
        });
      }
    }, 120);

    if (sourceElement && billCardRef.current) {
      const btnRect = sourceElement.getBoundingClientRect();
      const billRect = billCardRef.current.getBoundingClientRect();

      const startX = btnRect.left + btnRect.width / 2;
      const startY = btnRect.top + btnRect.height / 2;
      const endX = billRect.left + billRect.width / 2;
      const endY = billRect.top + Math.min(90, billRect.height / 3);

      const bubbleId = Date.now() + Math.random();
      const newBubble: FlyingBubble = {
        id: bubbleId,
        name: itemName,
        priceStr: formatPrice(priceNum),
        startX,
        startY,
        deltaX: endX - startX,
        deltaY: endY - startY
      };

      setFlyingBubbles((prev) => [...prev, newBubble]);

      setTimeout(() => {
        setIsBillCardBouncing(true);
        setTimeout(() => setIsBillCardBouncing(false), 360);
      }, 430);

      setTimeout(() => {
        setFlyingBubbles((prev) => prev.filter((b) => b.id !== bubbleId));
      }, 560);
    } else {
      setIsBillCardBouncing(true);
      setTimeout(() => setIsBillCardBouncing(false), 360);
    }
  };

  const addServiceToCart = (item: MenuItem, e?: React.MouseEvent<HTMLElement>) => {
    const existingIdx = cart.findIndex((c) => c.id === item.id && !c.isCustomItem);
    const basePrice = Number(item.price) || 0;

    if (existingIdx > -1) {
      const updated = [...cart];
      updated[existingIdx].qty += 1;
      setCart(updated);
      triggerJumpToBillAnimation(e?.currentTarget || null, item.name, basePrice, updated[existingIdx].cartId);
    } else {
      const vvipFull = Number(item.vvipPrice) || 0;
      const vvipExtra = vvipFull > basePrice ? vvipFull - basePrice : 0;
      const newCartId = `${item.id}_${Date.now()}`;

      setCart([
        ...cart,
        {
          cartId: newCartId,
          id: item.id,
          name: item.name,
          duration: item.duration,
          price: basePrice,
          isVvipUpgrade: false,
          vvipExtraPrice: vvipExtra,
          vvipIncluded: !!item.vvipIncluded,
          discountEligible: true, // 🌟 Main Service များကို Default အားဖြင့် Discount ပေးမည်
          qty: 1
        }
      ]);
      triggerJumpToBillAnimation(e?.currentTarget || null, item.name, basePrice, newCartId);
    }
  };

  // 🌟 Add Selected Extra Item from Dropdown to Cart (Default: No Discount!) 🌟
  const handleAddSelectedExtraItemToCart = (
    extraItemId: string,
    sourceEl?: HTMLElement | null
  ) => {
    const found = savedExtraItems.find((x) => x.id === extraItemId);
    if (!found) return;

    const existingIdx = cart.findIndex((c) => c.isCustomItem && c.id === found.id);
    if (existingIdx > -1) {
      const updated = [...cart];
      updated[existingIdx].qty += 1;
      setCart(updated);
      triggerJumpToBillAnimation(
        sourceEl || extraDropdownBtnRef.current,
        found.name,
        found.price,
        updated[existingIdx].cartId
      );
    } else {
      const newCartId = `extra_${found.id}_${Date.now()}`;
      setCart([
        ...cart,
        {
          cartId: newCartId,
          id: found.id,
          name: found.name,
          price: found.price,
          isCustomItem: true,
          discountEligible: false, // 🌟 Extra Item (Towel/Oil/Drink) များကို Default အားဖြင့် Discount မပေးပါ (လိုအပ်ပါက ပြန်ဖွင့်နိုင်သည်)
          qty: 1
        }
      ]);
      triggerJumpToBillAnimation(
        sourceEl || extraDropdownBtnRef.current,
        found.name,
        found.price,
        newCartId
      );
    }
  };

  const toggleCartItemVvip = (cartId: string) => {
    setCart(
      cart.map((c) => (c.cartId === cartId ? { ...c, isVvipUpgrade: !c.isVvipUpgrade } : c))
    );
  };

  // 🌟 Item တစ်ခုချင်းစီအလိုက် Discount ပေး/မပေး ပြောင်းလဲသည့် Function 🌟
  const toggleCartItemDiscountEligible = (cartId: string) => {
    setCart(
      cart.map((c) => {
        if (c.cartId !== cartId) return c;
        const currentEligible = c.discountEligible !== undefined ? c.discountEligible : !c.isCustomItem;
        return { ...c, discountEligible: !currentEligible };
      })
    );
  };

  const updateCartQty = (cartId: string, delta: number) => {
    setCart(
      cart
        .map((c) => (c.cartId === cartId ? { ...c, qty: Math.max(0, c.qty + delta) } : c))
        .filter((c) => c.qty > 0)
    );
  };

  const subTotal = useMemo(() => {
    return cart.reduce((sum, item) => {
      const unitPrice = item.price + (item.isVvipUpgrade && item.vvipExtraPrice ? item.vvipExtraPrice : 0);
      return sum + unitPrice * item.qty;
    }, 0);
  }, [cart]);

  // 🌟 Discount ပေးရန် ရွေးချယ်ထားသော Item များ၏ စုစုပေါင်းတန်ဖိုးကိုသာ သီးသန့်တွက်ချက်ခြင်း 🌟
  const discountableSubTotal = useMemo(() => {
    return cart.reduce((sum, item) => {
      const isEligible = item.discountEligible !== undefined ? item.discountEligible : !item.isCustomItem;
      if (!isEligible) return sum;
      const unitPrice = item.price + (item.isVvipUpgrade && item.vvipExtraPrice ? item.vvipExtraPrice : 0);
      return sum + unitPrice * item.qty;
    }, 0);
  }, [cart]);

  const totalItemsCount = useMemo(() => {
    return cart.reduce((sum, item) => sum + item.qty, 0);
  }, [cart]);

  const discountAmount = useMemo(() => {
    if (discountValue <= 0 || discountableSubTotal <= 0) return 0;
    if (discountType === 'percent') {
      return Math.min(
        discountableSubTotal,
        Math.round((discountableSubTotal * Math.min(100, discountValue)) / 100)
      );
    }
    return Math.min(discountableSubTotal, discountValue);
  }, [discountableSubTotal, discountType, discountValue]);

  const finalTotal = Math.max(0, subTotal - discountAmount);
  const pointsEarned = Math.floor(finalTotal / 35000);
  const cashReceivedNum = parseInt(cashReceived, 10) || 0;
  const changeDue = Math.max(0, cashReceivedNum - finalTotal);

  const isOnlinePaymentSelected = paymentMethod !== 'Cash';
  const depositPaidNum = useMemo(() => {
    if (!isOnlinePaymentSelected || onlinePayMode === 'full') {
      return finalTotal;
    }
    const parsed = parseInt(depositAmountStr, 10) || 0;
    return Math.max(0, Math.min(finalTotal, parsed));
  }, [isOnlinePaymentSelected, onlinePayMode, depositAmountStr, finalTotal]);

  const balanceDueNum = useMemo(() => {
    if (!isOnlinePaymentSelected || onlinePayMode === 'full') return 0;
    return Math.max(0, finalTotal - depositPaidNum);
  }, [isOnlinePaymentSelected, onlinePayMode, finalTotal, depositPaidNum]);

  const handleSelectDiscountDropdown = (presetId: string) => {
    setSelectedDiscountPresetId(presetId);
    if (presetId === 'none') {
      setDiscountType('percent');
      setDiscountValue(0);
      setDiscountReason('No Discount');
      setShowCustomDiscountInputs(false);
      return;
    }
    if (presetId === 'custom') {
      setShowCustomDiscountInputs(true);
      if (discountReason === 'No Discount') setDiscountReason('Special Walk-in Discount');
      return;
    }
    setShowCustomDiscountInputs(false);
    const found = allAvailableDiscounts.find((d) => d.id === presetId);
    if (found) {
      setDiscountType(found.type);
      setDiscountValue(found.value);
      setDiscountReason(found.label);
    }
  };

  const handleCompleteSale = async () => {
    if (cart.length === 0) return;
    setSavingSale(true);

    const now = Date.now();
    const [hStr, mStr] = (saleTime || '12:00').split(':');
    const [y, m, d] = (saleDate || getLocalTodayStr()).split('-').map(Number);
    const startDt = new Date(y, m - 1, d, Number(hStr) || 0, Number(mStr) || 0, 0, 0);
    const startTimeMillis = startDt.getTime();

    let totalMins = 60;
    cart.forEach((c) => {
      const match = (c.duration || '').match(/(\d+)\s*Mins/i);
      if (match) totalMins = Math.max(totalMins, parseInt(match[1], 10));
    });
    const expectedEndTimeMillis = startTimeMillis + totalMins * 60 * 1000;

    const combinedTherapist =
      therapist1 && therapist2
        ? `${therapist1.name} & ${therapist2.name}`
        : therapist1
        ? therapist1.name
        : 'Any Available Therapist';

    const isDepositSale = isOnlinePaymentSelected && onlinePayMode === 'deposit' && balanceDueNum > 0;

    const newRecord: OfflineSaleRecord = {
      localId: `pos_${now}_${Math.random().toString(36).slice(2, 7)}`,
      invoiceNo: generateInvoiceNo(),
      createdAt: now,
      date: saleDate,
      time: format12Hour(saleTime),
      customerName: customerName.trim() || 'Walk-in Guest',
      customerPhone: customerPhone.trim(),
      customerVipTier: detectedVipBenefit?.tierName || undefined,
      therapistName: combinedTherapist,
      items: [...cart],
      subTotal,
      discountType,
      discountValue,
      discountAmount,
      discountReason: discountAmount > 0 ? discountReason.trim() || 'Walk-in Discount' : '',
      totalPrice: finalTotal,
      paymentMethod,
      paymentStatus: isDepositSale ? 'deposit_only' : 'paid_in_full',
      depositPaid: isDepositSale ? depositPaidNum : finalTotal,
      balanceDue: isDepositSale ? balanceDueNum : 0,
      cashReceived:
        paymentMethod === 'Cash'
          ? cashReceivedNum || finalTotal
          : isDepositSale
          ? depositPaidNum
          : finalTotal,
      changeDue: paymentMethod === 'Cash' ? changeDue : 0,
      serviceStatus,
      pointsEarned,
      note: specialNote.trim(),
      synced: false,
      startTimeMillis,
      expectedEndTimeMillis
    };

    if (navigator.onLine) {
      try {
        const docId = await uploadSaleToFirebase(newRecord);
        newRecord.synced = true;
        newRecord.firestoreDocId = docId;
      } catch (err) {
        console.warn('Saved to offline queue due to network error:', err);
        updateOfflineQueue([...offlineQueue, newRecord]);
      }
    } else {
      updateOfflineQueue([...offlineQueue, newRecord]);
    }

    addToLocalHistory(newRecord);
    setActiveReceipt(newRecord);
    setSavingSale(false);
  };

  // 🌟 Web Bluetooth Printer Pairing Function 🌟
  const handleConnectBluetoothPrinter = async (forceNewChooser = false): Promise<any> => {
    try {
      const bt = (navigator as any).bluetooth;
      if (!bt) {
        alert('Web Bluetooth မရရှိပါ။ Google Chrome ဖြင့် ဖွင့်ပေးပါ။');
        return null;
      }

      if (!forceNewChooser && typeof bt.getDevices === 'function') {
        try {
          const permitted = await bt.getDevices();
          const savedDev =
            permitted.find(
              (d: any) =>
                (printSettings.savedPrinterId && d.id === printSettings.savedPrinterId) ||
                (printSettings.savedPrinterName && d.name === printSettings.savedPrinterName)
            ) || permitted[0];

          if (savedDev) {
            const writeChar = await findWritableCharacteristic(savedDev);
            savedDev.addEventListener('gattserverdisconnected', () => setBtCharacteristic(null));
            setBluetoothDevice(savedDev);
            setBtCharacteristic(writeChar);
            return writeChar;
          }
        } catch {}
      }

      const device = await bt.requestDevice({
        acceptAllDevices: true,
        optionalServices: BT_PRINTER_SERVICES
      });

      const writeChar = await findWritableCharacteristic(device);

      device.addEventListener('gattserverdisconnected', () => {
        setBtCharacteristic(null);
      });

      setBluetoothDevice(device);
      setBtCharacteristic(writeChar);
      updatePrintSettings({
        savedPrinterId: device.id || '',
        savedPrinterName: device.name || 'Bluetooth Printer'
      });
      return writeChar;
    } catch (error: any) {
      console.warn('Bluetooth connection cancelled or failed:', error);
      if (error.name !== 'NotFoundError') {
        alert('Bluetooth Printer ချိတ်ဆက်မှု မအောင်မြင်ပါ: ' + error.message);
      }
      return null;
    }
  };

  // 🌟 Reliable 180-Byte BLE Streaming Helper with Timeout Protection (Never hangs on PRINTING...!) 🌟
  const writeChunkWithTimeout = (writeChar: any, chunk: Uint8Array, timeoutMs = 2500) => {
    const op = writeChar.properties.writeWithoutResponse
      ? writeChar.writeValueWithoutResponse(chunk)
      : writeChar.writeValue(chunk);

    const timer = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('BLE write timeout')), timeoutMs)
    );
    return Promise.race([op, timer]);
  };

  const sendBytesToPrinter = async (writeChar: any, dataBytes: Uint8Array) => {
    const chunkSize = 180;
    for (let i = 0; i < dataBytes.length; i += chunkSize) {
      const chunk = dataBytes.slice(i, i + chunkSize);
      try {
        await writeChunkWithTimeout(writeChar, chunk, 2500);
      } catch {
        for (let j = 0; j < chunk.length; j += 20) {
          const sub = chunk.slice(j, j + 20);
          await writeChunkWithTimeout(writeChar, sub, 2000);
          await new Promise((r) => setTimeout(r, 5));
        }
      }
      await new Promise((r) => setTimeout(r, 4));
    }
  };

  // 🌟 Smart Word-Wrap Helper 🌟
  const wordWrapText = (text: string, maxCols: number): string[] => {
    if (!text) return [];
    const words = text.trim().split(/\s+/);
    const lines: string[] = [];
    let currentLine = '';

    for (const word of words) {
      const candidate = currentLine ? `${currentLine} ${word}` : word;
      if (candidate.length <= maxCols) {
        currentLine = candidate;
      } else {
        if (currentLine) lines.push(currentLine);
        currentLine = word;
      }
    }
    if (currentLine) lines.push(currentLine);
    return lines;
  };

  // 🌟 PROFESSIONAL UI/UX NATIVE ESC/POS PRINT ENGINE (100% Reliable + Zero Mid-Receipt Stutter + Balanced Typography!) 🌟
  const handleBluetoothEscPosPrint = async (customRecord?: OfflineSaleRecord) => {
    const recordToPrint = customRecord || activeReceipt;
    if (!recordToPrint) return;
    setIsPrintingBt(true);

    try {
      let writeChar = btCharacteristic;

      if (writeChar && bluetoothDevice && !bluetoothDevice.gatt.connected) {
        writeChar = null;
      }

      if (!writeChar && bluetoothDevice) {
        try {
          writeChar = await findWritableCharacteristic(bluetoothDevice);
          setBtCharacteristic(writeChar);
        } catch {
          writeChar = null;
        }
      }

      if (!writeChar) {
        writeChar = await handleConnectBluetoothPrinter(true);
        if (!writeChar) {
          setIsPrintingBt(false);
          return;
        }
      }

      const colsFontA = printSettings.paperWidth === '80mm' ? 48 : 32;
      const colsFontB = printSettings.paperWidth === '80mm' ? 64 : 42;

      const ESC = '\x1B';
      const GS = '\x1D';
      const INIT = ESC + '@';
      const ALIGN_CENTER = ESC + 'a\x01';
      const ALIGN_LEFT = ESC + 'a\x00';
      const BOLD_ON = ESC + 'E\x01';
      const BOLD_OFF = ESC + 'E\x00';
      const FONT_A = ESC + 'M\x00'; // Standard Prominent Font (12x24) -> Reserved for TOTAL & Key Headers!
      const FONT_B = ESC + 'M\x01'; // Clean Compact Font (9x17) -> Used for Body Rows, Service Items & Subtotals!
      const NORMAL_SIZE = GS + '!\x00';
      const CUT_PAPER = GS + 'V\x41\x03';

      // Clean dashed divider in Font A
      const dashedDivider = FONT_A + NORMAL_SIZE + BOLD_OFF + '-'.repeat(colsFontA) + '\n';
      // Subtle spaced separator above TOTAL with comfortable vertical spacing
      const subtleTotalSeparator =
        FONT_B + NORMAL_SIZE + BOLD_OFF + '- '.repeat(Math.floor(colsFontB / 2)) + '\n';

      // 🌟 Clean Compact Font B Row (Used for Metadata, Service Items, Subtotal, Payment, Change Due) 🌟
      const formatCleanFontBRow = (
        left: string,
        right: string,
        leftBold = false,
        rightBold = false
      ): string => {
        const l = left.trim();
        const r = right.trim();
        const leftStr = (leftBold ? BOLD_ON : BOLD_OFF) + l + BOLD_OFF;
        const rightStr = (rightBold ? BOLD_ON : BOLD_OFF) + r + BOLD_OFF;
        const spaces = Math.max(1, colsFontB - l.length - r.length);
        return FONT_B + NORMAL_SIZE + leftStr + ' '.repeat(spaces) + rightStr + '\n';
      };

      // 🌟 Prominent Font A Row (Reserved for TOTAL so it stands out 35% larger & bolder than Font B rows!) 🌟
      const formatHeroTotalRow = (left: string, right: string): string => {
        const l = left.trim();
        const r = right.trim();
        const spaces = Math.max(1, colsFontA - l.length - r.length);
        return FONT_A + NORMAL_SIZE + BOLD_ON + `${l}${' '.repeat(spaces)}${r}\n` + BOLD_OFF;
      };

      // 1. Build Unified Top Header Raster (Logo + Store Title + Subtitle in ONE single image at the very top!)
      const { rasterBytes: headerBannerBytes } = await buildUnifiedHeaderRasterData(
        printedLogoSourceUrl,
        printSettings.showLogo,
        printSettings.logoFilterMode,
        printSettings.logoThreshold,
        printSettings.logoSize,
        printSettings.shopName,
        printSettings.subtitle
      );

      // 2. Build 100% Native Text Body (Zero mid-receipt images = Zero paper stutter!)
      let cmd = ALIGN_CENTER + NORMAL_SIZE + BOLD_OFF;

      if (!headerBannerBytes) {
        if (printSettings.shopName) {
          cmd += FONT_A + BOLD_ON + `${printSettings.shopName.toUpperCase()}\n` + BOLD_OFF;
        }
        if (printSettings.subtitle) {
          cmd += FONT_B + BOLD_OFF + `${printSettings.subtitle.toUpperCase()}\n`;
        }
      }

      if (printSettings.headerText) {
        wordWrapText(printSettings.headerText, colsFontA).forEach((line) => {
          cmd += FONT_A + BOLD_OFF + `${line}\n`;
        });
      }
      if (printSettings.footerText) {
        wordWrapText(printSettings.footerText, colsFontB).forEach((line) => {
          cmd += FONT_B + BOLD_OFF + `${line}\n`;
        });
      }
      if (printSettings.phone) {
        cmd += FONT_B + BOLD_OFF + `Tel: ${printSettings.phone}\n`;
      }
      cmd += dashedDivider;

      // 3. Metadata Section (Clean Compact Font B: Left Normal, Right Clean)
      cmd += ALIGN_LEFT;
      cmd += formatCleanFontBRow('Invoice:', recordToPrint.invoiceNo, false, true);
      cmd += formatCleanFontBRow('Date/Time:', `${recordToPrint.date} ${recordToPrint.time}`, false, false);
      if (printSettings.showCustomerInfo) {
        const customerFull = `${recordToPrint.customerName}${
          recordToPrint.customerPhone ? ` (${recordToPrint.customerPhone})` : ''
        }`;
        cmd += formatCleanFontBRow('Customer:', customerFull, false, false);
      }
      cmd += formatCleanFontBRow('Therapist:', recordToPrint.therapistName, false, false);
      cmd += dashedDivider;

      // 4. 🌟 Service Items Section ("1. Oil Massage   37,000 Ks" -> Normal Weight, NOT Bold, Clean & Crisp!) 🌟
      recordToPrint.items.forEach((item, idx) => {
        const unitPrice = item.price + (item.isVvipUpgrade && item.vvipExtraPrice ? item.vvipExtraPrice : 0);
        const itemTitle = `${idx + 1}. ${item.name}${item.qty > 1 ? ` x${item.qty}` : ''}`;
        const itemPriceStr = formatPrice(unitPrice * item.qty);

        cmd += formatCleanFontBRow(itemTitle, itemPriceStr, false, false);

        const subDetails = [
          item.duration || '',
          item.isVvipUpgrade ? '(+VVIP Room)' : '',
          item.vvipIncluded ? '(VVIP Free)' : ''
        ]
          .filter(Boolean)
          .join(' ');

        if (subDetails) {
          cmd += FONT_B + NORMAL_SIZE + BOLD_OFF + `   ${subDetails}\n`;
        }
      });
      cmd += dashedDivider;

      // 5. Subtotal & Discount (Clean Compact Font B Normal Weight)
      cmd += formatCleanFontBRow('Subtotal:', formatPrice(recordToPrint.subTotal), false, false);
      if (recordToPrint.discountAmount > 0) {
        cmd += formatCleanFontBRow(
          `Discount (${recordToPrint.discountReason}):`,
          `-${formatPrice(recordToPrint.discountAmount)}`,
          false,
          false
        );
      }

      // 6. 🌟 HERO TOTAL ROW (Spaced separator above + Large Font A Bold!) 🌟
      cmd += subtleTotalSeparator;
      cmd += formatHeroTotalRow('TOTAL:', formatPrice(recordToPrint.totalPrice));

      // 7. Payment, Deposit & Balance Due (Clean Compact Font B)
      if (recordToPrint.paymentStatus === 'deposit_only' && recordToPrint.balanceDue > 0) {
        cmd += formatCleanFontBRow(
          `Deposit (${recordToPrint.paymentMethod}):`,
          formatPrice(recordToPrint.depositPaid),
          false,
          false
        );
        cmd += formatHeroTotalRow('BALANCE DUE:', formatPrice(recordToPrint.balanceDue));
      } else {
        cmd += formatCleanFontBRow(
          `Payment (${recordToPrint.paymentMethod}):`,
          formatPrice(recordToPrint.cashReceived),
          false,
          false
        );
        if (recordToPrint.paymentMethod === 'Cash' && recordToPrint.changeDue > 0) {
          cmd += formatCleanFontBRow('Change Due:', formatPrice(recordToPrint.changeDue), false, false);
        }
      }

      // 8. VIP Points Earned Box (Clean ASCII Box in Font A)
      if (recordToPrint.pointsEarned > 0) {
        const boxInnerW = colsFontA - 4;
        const vipLeft = 'VIP Points Earned:';
        const vipRight = `+${recordToPrint.pointsEarned} Pts`;
        const vipSpaces = Math.max(1, boxInnerW - vipLeft.length - vipRight.length);
        const boxBorder = FONT_A + BOLD_OFF + `+${'-'.repeat(colsFontA - 2)}+\n`;
        const boxContent =
          FONT_A +
          BOLD_OFF +
          `| ${vipLeft}${' '.repeat(vipSpaces)}` +
          BOLD_ON +
          vipRight +
          BOLD_OFF +
          ` |\n`;

        cmd += boxBorder + boxContent + boxBorder;
      } else {
        cmd += dashedDivider;
      }

      // 9. Footer Thank You Note
      cmd += ALIGN_CENTER + NORMAL_SIZE;
      if (printSettings.thankYouText) {
        const lines = printSettings.thankYouText.split('\n');
        lines.forEach((line, i) => {
          if (i === 0) {
            wordWrapText(line, colsFontA).forEach((wLine) => {
              cmd += FONT_A + BOLD_ON + `${wLine}\n` + BOLD_OFF;
            });
          } else {
            wordWrapText(line, colsFontB).forEach((wLine) => {
              cmd += FONT_B + BOLD_OFF + `${wLine}\n`;
            });
          }
        });
      }
      cmd += FONT_A + `\n\n\n` + CUT_PAPER;

      // 10. Combine & Send in One Reliable Stream!
      const encoder = new TextEncoder();
      const initBytes = encoder.encode(INIT + ALIGN_CENTER);
      const bodyTextBytes = encoder.encode(cmd);

      const totalByteLen =
        initBytes.length +
        (headerBannerBytes ? headerBannerBytes.length : 0) +
        bodyTextBytes.length;

      const combinedPayload = new Uint8Array(totalByteLen);

      let offset = 0;
      combinedPayload.set(initBytes, offset);
      offset += initBytes.length;

      if (headerBannerBytes) {
        combinedPayload.set(headerBannerBytes, offset);
        offset += headerBannerBytes.length;
      }

      combinedPayload.set(bodyTextBytes, offset);

      await sendBytesToPrinter(writeChar, combinedPayload);
    } catch (err: any) {
      console.error('Bluetooth print failed:', err);
      setBtCharacteristic(null);
      alert('Printer ချိတ်ဆက်မှု ပြတ်တောက်သွားပါသည်။ ဘောင်ချာထုတ်မည် ခလုတ်ကို ပြန်နှိပ်၍ ချိတ်ဆက်ပါ။');
    } finally {
      setIsPrintingBt(false);
    }
  };

  // 🌟 Force Update App Cache Function 🌟
  const handleForceRefreshApp = async () => {
    try {
      if ('serviceWorker' in navigator) {
        const regs = await navigator.serviceWorker.getRegistrations();
        for (const r of regs) {
          await r.unregister();
        }
      }
      if ('caches' in window) {
        const keys = await caches.keys();
        for (const k of keys) {
          await caches.delete(k);
        }
      }
    } catch {}
    window.location.reload();
  };

  const samplePreviewReceipt: OfflineSaleRecord = {
    localId: 'sample_preview',
    invoiceNo: 'SL-261014-8888',
    createdAt: Date.now(),
    date: getLocalTodayStr(),
    time: '7:00 PM',
    customerName: 'Walk-in Guest',
    customerPhone: '09458884517',
    therapistName: 'Therapist No-1',
    items: [
      {
        cartId: 'sample_1',
        id: 'oil',
        name: 'Oil Massage',
        duration: '60 Mins',
        price: 25000,
        qty: 1
      }
    ],
    subTotal: 25000,
    discountType: 'percent',
    discountValue: 0,
    discountAmount: 0,
    discountReason: '',
    totalPrice: 25000,
    paymentMethod: 'Cash',
    paymentStatus: 'paid_in_full',
    depositPaid: 25000,
    balanceDue: 0,
    cashReceived: 25000,
    changeDue: 0,
    serviceStatus: 'completed',
    pointsEarned: 1,
    note: '',
    synced: true
  };

  const startNewSale = () => {
    setCart([]);
    setTherapist1(null);
    setTherapist2(null);
    setCustomerName('Walk-in Guest');
    setCustomerPhone('');
    setFoundCustomerPts(null);
    setDetectedVipBenefit(null);
    setSelectedDiscountPresetId('none');
    setDiscountValue(0);
    setDiscountReason('No Discount');
    setShowCustomDiscountInputs(false);
    setPaymentMethod('Cash');
    setOnlinePayMode('full');
    setDepositAmountStr('');
    setCashReceived('');
    setSpecialNote('');
    setActiveReceipt(null);
    setPosStep(1);
    const now = new Date();
    setSaleTime(`${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`);
  };

  const paymentOptions = useMemo(() => {
    const dynamicMethods = localAppData?.paymentMethods?.map((pm) => pm.name) || [];
    const defaults = ['KBZ PAY', 'Wave PAY', 'AYA PAY', 'UAB PAY'];
    const merged = Array.from(new Set(['Cash', ...dynamicMethods, ...defaults]));
    return merged;
  }, [localAppData?.paymentMethods]);

  const activeViewLabel =
    activePosView === 'register'
      ? 'POS Register'
      : activePosView === 'history'
      ? `Receipts (${salesHistory.length})`
      : activePosView === 'extra_items'
      ? 'Extra Items Setting'
      : activePosView === 'discounts'
      ? 'Discounts Setting'
      : 'Receipt Settings';

  const promoObj = localAppData?.promotion as any;
  const isStorePromoActive = !!(
    promoObj?.isPopupActive ||
    promoObj?.isBoxActive ||
    promoObj?.isActive ||
    detectedCampaignWin
  );
  const activeStorePromoTitle =
    detectedCampaignWin?.campaignName ||
    promoObj?.campaignTitle ||
    promoObj?.boxTitle ||
    'သီတင်းကျွတ် မီးပုံးဖမ်းဂိမ်း';
  const activeStorePromoPct =
    detectedCampaignWin?.discountPercent ||
    promoObj?.otherDiscountPercent ||
    promoObj?.hotelDiscountPercent ||
    15;

  return (
    <div className="min-h-screen bg-gray-100 text-gray-800 flex flex-col font-sans">
      {/* 🌟 UI/UX Guaranteed Tablet Split-Screen Grid & Parabolic Jump-to-Bill Keyframes 🌟 */}
      <style>{`
        .pos-split-layout {
          display: grid;
          grid-template-columns: 1fr;
          gap: 12px;
          align-items: start;
        }
        /* Tablet Portrait (520px+) & Landscape & Desktop -> Always 2 Columns Side-by-Side! */
        @media (min-width: 520px) {
          .pos-split-layout {
            grid-template-columns: minmax(0, 58%) minmax(0, 42%);
            gap: 14px;
          }
        }
        @media (min-width: 1024px) {
          .pos-split-layout {
            grid-template-columns: minmax(0, 60%) minmax(0, 40%);
            gap: 20px;
          }
        }
        @keyframes posFlyX {
          0% { transform: translateX(0); }
          100% { transform: translateX(var(--fly-dx)); }
        }
        @keyframes posFlyY {
          0% { transform: translateY(0) scale(1); opacity: 1; }
          32% { transform: translateY(calc(var(--fly-dy) * 0.15 - 55px)) scale(1.12); opacity: 1; }
          100% { transform: translateY(var(--fly-dy)) scale(0.45); opacity: 0.2; }
        }
        @keyframes posBillImpact {
          0% { transform: scale(1); }
          40% { transform: scale(1.028); box-shadow: 0 0 28px rgba(212, 175, 55, 0.55); }
          100% { transform: scale(1); }
        }
        @keyframes posItemPopIn {
          0% { transform: scale(0.95); background-color: rgba(212, 175, 55, 0.28); }
          60% { transform: scale(1.015); background-color: rgba(212, 175, 55, 0.15); }
          100% { transform: scale(1); background-color: transparent; }
        }
        .pos-fly-wrapper {
          position: fixed;
          z-index: 9999;
          pointer-events: none;
          animation: posFlyX 0.48s cubic-bezier(0.22, 0.61, 0.36, 1) forwards;
        }
        .pos-fly-inner {
          animation: posFlyY 0.48s cubic-bezier(0.32, 0.08, 0.68, 0.98) forwards;
        }
        .pos-bill-bounce {
          animation: posBillImpact 0.36s cubic-bezier(0.34, 1.56, 0.64, 1);
        }
        .pos-item-pop {
          animation: posItemPopIn 0.8s ease-out forwards;
        }
      `}</style>

      {/* 🌟 Floating Parabolic Chips (Service Jump-to-Bill Visual Feedback) 🌟 */}
      {flyingBubbles.map((b) => (
        <div
          key={b.id}
          className="pos-fly-wrapper"
          style={
            {
              left: `${b.startX - 75}px`,
              top: `${b.startY - 20}px`,
              '--fly-dx': `${b.deltaX}px`,
              '--fly-dy': `${b.deltaY}px`
            } as React.CSSProperties
          }
        >
          <div className="pos-fly-inner bg-gradient-to-r from-[#123524] to-[#1a4a32] text-[#D4AF37] border-2 border-[#D4AF37] px-3.5 py-1.5 rounded-full shadow-2xl flex items-center gap-2 whitespace-nowrap">
            <Sparkles className="w-3.5 h-3.5 text-[#D4AF37] animate-spin" />
            <span className="text-xs font-black tracking-wide">+ {b.name}</span>
            <span className="text-[10px] font-extrabold bg-[#D4AF37] text-[#123524] px-1.5 py-0.5 rounded-full">
              {b.priceStr}
            </span>
          </div>
        </div>
      ))}

      {/* ==========================================
          SLIDE-OUT SIDE MENU DRAWER (Loyverse POS Style)
         ========================================== */}
      {isSideMenuOpen && (
        <div className="fixed inset-0 z-[300] flex">
          <div
            onClick={() => setIsSideMenuOpen(false)}
            className="fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity"
          />

          <aside className="relative w-72 max-w-[82vw] bg-[#0B2419] text-white h-full shadow-2xl border-r border-[#D4AF37]/30 flex flex-col justify-between z-10 animate-fade-in">
            <div>
              <div className="p-4 bg-gradient-to-r from-[#123524] to-[#1a4a32] border-b border-[#D4AF37]/30 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  {digitalLogoUrl && (
                    <img
                      src={digitalLogoUrl}
                      alt="Logo"
                      className="w-9 h-9 rounded-full object-cover border border-[#D4AF37]"
                    />
                  )}
                  <div>
                    <h2 className="font-serif font-black text-sm text-[#D4AF37] tracking-wide">
                      THE SHANGRI-LA
                    </h2>
                    <p className="text-[10px] text-gray-300 font-semibold">POS Navigation & Settings</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsSideMenuOpen(false)}
                  className="p-1.5 rounded-full bg-white/10 text-gray-300 hover:text-white hover:bg-white/20 transition"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <nav className="p-3 space-y-1.5">
                <div className="px-3 py-1 text-[10px] font-extrabold uppercase tracking-widest text-[#D4AF37]/70">
                  Sales & Register
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setActivePosView('register');
                    setIsSideMenuOpen(false);
                  }}
                  className={`w-full px-3.5 py-3 rounded-xl text-xs font-bold flex items-center justify-between transition ${
                    activePosView === 'register'
                      ? 'bg-[#D4AF37] text-[#123524] shadow-md font-black'
                      : 'text-gray-200 hover:bg-white/10'
                  }`}
                >
                  <span className="flex items-center gap-2.5">
                    <ShoppingBag className="w-4 h-4" /> POS Register (အရောင်းကောင်တာ)
                  </span>
                  <ChevronRight className="w-4 h-4 opacity-70" />
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setActivePosView('online_bookings');
                    setIsSideMenuOpen(false);
                  }}
                  className={`w-full px-3.5 py-3 rounded-xl text-xs font-bold flex items-center justify-between transition ${
                    activePosView === 'online_bookings'
                      ? 'bg-[#D4AF37] text-[#123524] shadow-md font-black'
                      : 'text-gray-200 hover:bg-white/10'
                  }`}
                >
                  <span className="flex items-center gap-2.5">
                    <Calendar className="w-4 h-4" /> Online Bookings ({liveOnlineBookings.length})
                  </span>
                  {pendingOnlineCount > 0 ? (
                    <span className="bg-red-500 text-white text-[10px] font-black px-2 py-0.5 rounded-full animate-pulse">
                      {pendingOnlineCount} New
                    </span>
                  ) : (
                    <ChevronRight className="w-4 h-4 opacity-70" />
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setActivePosView('history');
                    setIsSideMenuOpen(false);
                  }}
                  className={`w-full px-3.5 py-3 rounded-xl text-xs font-bold flex items-center justify-between transition ${
                    activePosView === 'history'
                      ? 'bg-[#D4AF37] text-[#123524] shadow-md font-black'
                      : 'text-gray-200 hover:bg-white/10'
                  }`}
                >
                  <span className="flex items-center gap-2.5">
                    <History className="w-4 h-4" /> Receipts History ({salesHistory.length})
                  </span>
                  <ChevronRight className="w-4 h-4 opacity-70" />
                </button>

                <div className="pt-3 px-3 py-1 text-[10px] font-extrabold uppercase tracking-widest text-[#D4AF37]/70 border-t border-white/10 mt-2">
                  POS Settings & Presets
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setActivePosView('extra_items');
                    setIsSideMenuOpen(false);
                  }}
                  className={`w-full px-3.5 py-3 rounded-xl text-xs font-bold flex items-center justify-between transition ${
                    activePosView === 'extra_items'
                      ? 'bg-[#D4AF37] text-[#123524] shadow-md font-black'
                      : 'text-gray-200 hover:bg-white/10'
                  }`}
                >
                  <span className="flex items-center gap-2.5">
                    <PackagePlus className="w-4 h-4" /> အပိုပစ္စည်း / Extra Items ({savedExtraItems.length})
                  </span>
                  <ChevronRight className="w-4 h-4 opacity-70" />
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setActivePosView('discounts');
                    setIsSideMenuOpen(false);
                  }}
                  className={`w-full px-3.5 py-3 rounded-xl text-xs font-bold flex items-center justify-between transition ${
                    activePosView === 'discounts'
                      ? 'bg-[#D4AF37] text-[#123524] shadow-md font-black'
                      : 'text-gray-200 hover:bg-white/10'
                  }`}
                >
                  <span className="flex items-center gap-2.5">
                    <Tag className="w-4 h-4" /> Discounts & Promos ({allAvailableDiscounts.length})
                  </span>
                  <ChevronRight className="w-4 h-4 opacity-70" />
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setActivePosView('settings');
                    setIsSideMenuOpen(false);
                  }}
                  className={`w-full px-3.5 py-3 rounded-xl text-xs font-bold flex items-center justify-between transition ${
                    activePosView === 'settings'
                      ? 'bg-[#D4AF37] text-[#123524] shadow-md font-black'
                      : 'text-gray-200 hover:bg-white/10'
                  }`}
                >
                  <span className="flex items-center gap-2.5">
                    <Settings className="w-4 h-4" /> Receipt & Printer Settings
                  </span>
                  <ChevronRight className="w-4 h-4 opacity-70" />
                </button>
              </nav>
            </div>

            <div className="p-3.5 border-t border-white/10 space-y-2 bg-black/20">
              <button
                type="button"
                onClick={handleForceRefreshApp}
                className="w-full py-2.5 px-3 rounded-xl bg-white/10 hover:bg-white/15 text-xs font-bold text-gray-200 flex items-center justify-center gap-2 transition"
              >
                <RefreshCw className="w-3.5 h-3.5 text-[#D4AF37]" /> Force Update App Cache
              </button>
              <button
                type="button"
                onClick={() => (window.location.href = '/?mode=admin')}
                className="w-full py-2.5 px-3 rounded-xl bg-[#D4AF37]/15 hover:bg-[#D4AF37]/25 text-xs font-bold text-[#D4AF37] border border-[#D4AF37]/40 flex items-center justify-center gap-2 transition"
              >
                <ArrowLeft className="w-3.5 h-3.5" /> Back to Admin Backoffice
              </button>
            </div>
          </aside>
        </div>
      )}

      {/* ==========================================
          COMPACT SINGLE-ROW TOP POS HEADER BAR
         ========================================== */}
      <header className="no-print sticky top-0 z-50 bg-gradient-to-r from-[#123524] via-[#1a4a32] to-[#123524] text-white px-3 py-2 shadow-md border-b border-[#D4AF37]/40 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2.5 min-w-0">
          <button
            type="button"
            onClick={() => setIsSideMenuOpen(true)}
            title="Open POS Menu & Settings"
            className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-[#D4AF37] border border-[#D4AF37]/40 shadow-sm flex items-center justify-center transition active:scale-95"
          >
            <Menu className="w-5 h-5" />
          </button>

          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <img
                  src={digitalLogoUrl || defaultLogoImg}
                  alt="Shangri-La Logo"
                  className="w-6 h-6 sm:w-7 sm:h-7 rounded-full object-cover border border-[#D4AF37] mr-2 flex-shrink-0 shadow-sm bg-[#123524]"
                />
                SHANGRI-LA POS
              <span className="bg-[#D4AF37]/20 text-[#D4AF37] border border-[#D4AF37]/40 px-2 py-0.5 rounded-md text-[9px] font-extrabold whitespace-nowrap">
                {activeViewLabel}
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0">
          {activePosView !== 'register' && (
            <button
              type="button"
              onClick={() => setActivePosView('register')}
              className="px-2.5 py-1.5 rounded-xl text-[10px] font-black bg-[#D4AF37] text-[#123524] shadow-sm hover:bg-yellow-400 transition"
            >
              ← POS Register
            </button>
          )}

          <button
            type="button"
            onClick={() => handleConnectBluetoothPrinter(true)}
            className={`px-2.5 py-1.5 rounded-xl text-[10px] font-bold flex items-center border transition ${
              bluetoothDevice && btCharacteristic
                ? 'bg-green-500/20 text-green-300 border-green-400/40'
                : 'bg-white/10 text-[#D4AF37] border-[#D4AF37]/30 hover:bg-white/20'
            }`}
          >
            <Bluetooth className="w-3 h-3 mr-1 flex-shrink-0" />
            <span className="truncate max-w-[110px] sm:max-w-[160px]">
              {bluetoothDevice && btCharacteristic
                ? `${bluetoothDevice.name || printSettings.savedPrinterName || 'Printer'}`
                : printSettings.savedPrinterName
                ? `Reconnect`
                : 'BT Printer'}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActivePosView(activePosView === 'online_bookings' ? 'register' : 'online_bookings')}
            className={`px-2.5 py-1.5 rounded-xl text-[10px] font-black flex items-center border transition relative ${
              activePosView === 'online_bookings'
                ? 'bg-[#D4AF37] text-[#123524] border-[#D4AF37]'
                : 'bg-white/10 text-white border-[#D4AF37]/40 hover:bg-white/20'
            }`}
          >
            <Calendar className="w-3 h-3 mr-1 text-[#D4AF37]" />
            <span>Online Bookings</span>
            {pendingOnlineCount > 0 && (
              <span className="ml-1.5 px-1.5 py-0.2 bg-red-500 text-white rounded-full text-[9px] font-black animate-pulse">
                {pendingOnlineCount}
              </span>
            )}
          </button>

          {isOnline ? (
            <span className="bg-green-500/20 text-green-300 border border-green-400/40 px-2 py-1 rounded-full text-[10px] font-bold flex items-center">
              <Wifi className="w-3 h-3 mr-1 text-green-400" /> Online
            </span>
          ) : (
            <span className="bg-amber-500/20 text-amber-300 border border-amber-400/40 px-2 py-1 rounded-full text-[10px] font-bold flex items-center animate-pulse">
              <WifiOff className="w-3 h-3 mr-1 text-amber-400" /> Offline
            </span>
          )}

          {offlineQueue.length > 0 && (
            <button
              onClick={syncOfflineRecords}
              disabled={!isOnline || isSyncing}
              className="bg-[#D4AF37] text-[#123524] px-2.5 py-1 rounded-full text-[10px] font-black flex items-center shadow-sm hover:bg-yellow-400 disabled:opacity-60 transition"
            >
              <RefreshCw className={`w-3 h-3 mr-1 ${isSyncing ? 'animate-spin' : ''}`} />
              {isSyncing ? '...' : `Sync (${offlineQueue.length})`}
            </button>
          )}
        </div>
      </header>

      {/* ==========================================
          RECEIPT MODAL (Thermal Voucher & Direct BT Print)
         ========================================== */}
      {activeReceipt && (
        <div className="fixed inset-0 z-[200] bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-sm w-full p-5 shadow-2xl border border-[#D4AF37]/40 my-auto animate-fade-in">
            <div className="w-full overflow-hidden flex justify-center bg-gray-100 p-2 rounded-xl">
              <div
                id="pos-printable-receipt"
                className="w-[72mm] bg-white p-3 text-gray-900 font-mono text-xs border border-gray-300 rounded-lg shadow-sm"
              >
                <div className="text-center border-b border-dashed border-gray-400 pb-2.5 mb-2.5">
                  {printSettings.showLogo && (processedLogoPreview || printedLogoSourceUrl) && (
                    <img
                      src={processedLogoPreview || printedLogoSourceUrl}
                      alt="Printed Logo"
                      className="w-24 mx-auto mb-1.5 object-contain"
                    />
                  )}
                  {printSettings.shopName && (
                    <h2 className="font-serif font-black text-sm text-[#123524] uppercase tracking-wider">
                      {printSettings.shopName}
                    </h2>
                  )}
                  {printSettings.subtitle && (
                    <p className="text-[9px] font-bold text-gray-500 uppercase tracking-widest">
                      {printSettings.subtitle}
                    </p>
                  )}
                  {printSettings.headerText && (
                    <p className="text-[10px] font-semibold text-gray-700 mt-0.5">{printSettings.headerText}</p>
                  )}
                  {printSettings.footerText && (
                    <p className="text-[9px] text-gray-600 mt-0.5">{printSettings.footerText}</p>
                  )}
                  {printSettings.phone && (
                    <p className="text-[9px] text-gray-600">Tel: {printSettings.phone}</p>
                  )}
                </div>

                <div className="space-y-1 text-[10px] border-b border-dashed border-gray-300 pb-2.5 mb-2.5">
                  <div className="flex justify-between">
                    <span className="text-gray-500">Invoice:</span>
                    <span className="font-bold">{activeReceipt.invoiceNo}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Date/Time:</span>
                    <span className="text-gray-800">
                      {activeReceipt.date} {activeReceipt.time}
                    </span>
                  </div>
                  {printSettings.showCustomerInfo && (
                    <div className="flex justify-between">
                      <span className="text-gray-500">Customer:</span>
                      <span className="text-gray-800">
                        {activeReceipt.customerName}{' '}
                        {activeReceipt.customerPhone ? `(${activeReceipt.customerPhone})` : ''}
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-gray-500">Therapist:</span>
                    <span className="text-gray-800 text-right">{activeReceipt.therapistName}</span>
                  </div>
                </div>

                <div className="space-y-2 border-b border-dashed border-gray-300 pb-3 mb-3">
                  {activeReceipt.items.map((item, idx) => {
                    const unitPrice = item.price + (item.isVvipUpgrade && item.vvipExtraPrice ? item.vvipExtraPrice : 0);
                    return (
                      <div key={idx} className="text-[10px]">
                        <div className="flex justify-between font-normal text-gray-800">
                          <span>
                            {idx + 1}. {item.name} {item.qty > 1 ? `x${item.qty}` : ''}
                          </span>
                          <span>{formatPrice(unitPrice * item.qty)}</span>
                        </div>
                        <div className="text-[9px] text-gray-500 pl-3">
                          {item.duration && <span>{item.duration} </span>}
                          {item.isVvipUpgrade && <span className="text-amber-700">(+VVIP Room)</span>}
                          {item.vvipIncluded && <span className="text-green-700">(VVIP Free)</span>}
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="space-y-1 text-xs border-b border-dashed border-gray-300 pb-3 mb-3">
                  <div className="flex justify-between text-[10px]">
                    <span className="text-gray-500">Subtotal:</span>
                    <span className="text-gray-700">{formatPrice(activeReceipt.subTotal)}</span>
                  </div>
                  {activeReceipt.discountAmount > 0 && (
                    <div className="flex justify-between text-[10px] text-green-700">
                      <span>Discount ({activeReceipt.discountReason}):</span>
                      <span>-{formatPrice(activeReceipt.discountAmount)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-sm font-black py-1.5 my-1 border-t border-dashed border-gray-300 text-[#123524]">
                    <span>TOTAL:</span>
                    <span>{formatPrice(activeReceipt.totalPrice)}</span>
                  </div>

                  {activeReceipt.paymentStatus === 'deposit_only' && activeReceipt.balanceDue > 0 ? (
                    <>
                      <div className="flex justify-between text-[10px]">
                        <span className="text-gray-500">စရံငွေ ({activeReceipt.paymentMethod}):</span>
                        <span className="font-bold text-gray-800">{formatPrice(activeReceipt.depositPaid)}</span>
                      </div>
                      <div className="flex justify-between text-xs font-black text-red-600 pt-0.5">
                        <span>ကျန်ငွေ (Balance Due):</span>
                        <span>{formatPrice(activeReceipt.balanceDue)}</span>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="flex justify-between text-[10px]">
                        <span className="text-gray-500">Payment ({activeReceipt.paymentMethod}):</span>
                        <span className="text-gray-700">{formatPrice(activeReceipt.cashReceived)}</span>
                      </div>
                      {activeReceipt.paymentMethod === 'Cash' && activeReceipt.changeDue > 0 && (
                        <div className="flex justify-between text-[10px]">
                          <span className="text-gray-500">Change Due:</span>
                          <span className="text-gray-700">{formatPrice(activeReceipt.changeDue)}</span>
                        </div>
                      )}
                    </>
                  )}

                  {activeReceipt.pointsEarned > 0 && (
                    <div className="flex justify-between text-[10px] bg-yellow-50 p-1.5 rounded border border-yellow-200 mt-1.5">
                      <span className="text-yellow-800">VIP Points Earned:</span>
                      <span className="font-black text-[#123524]">+{activeReceipt.pointsEarned} Pts</span>
                    </div>
                  )}
                </div>

                <div className="text-center text-[10px] text-gray-500 space-y-0.5 whitespace-pre-line">
                  {printSettings.thankYouText}
                  {!activeReceipt.synced && (
                    <p className="text-[9px] text-amber-600 font-bold mt-1">[Saved Offline - Pending Sync]</p>
                  )}
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="no-print mt-4 flex flex-col gap-2">
              {activeReceipt.paymentStatus === 'deposit_only' && activeReceipt.balanceDue > 0 && (
                <button
                  type="button"
                  disabled={approvingBalanceId === activeReceipt.localId}
                  onClick={() => handleApproveBalancePaid(activeReceipt)}
                  className="w-full py-2.5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl font-black text-xs flex items-center justify-center shadow-sm transition"
                >
                  <CheckCircle className="w-4 h-4 mr-1.5" />
                  {approvingBalanceId === activeReceipt.localId
                    ? 'Approving...'
                    : `ကျန်ငွေ (${formatPrice(activeReceipt.balanceDue)}) ရရှိကြောင်း Approve လုပ်မည်`}
                </button>
              )}
              <button
                onClick={() => handleBluetoothEscPosPrint()}
                disabled={isPrintingBt}
                className="w-full py-3.5 bg-gradient-to-r from-[#123524] to-[#1a4a32] text-[#D4AF37] rounded-xl font-black text-xs uppercase tracking-widest flex items-center justify-center shadow-md hover:opacity-95 transition disabled:opacity-50"
              >
                <Printer className="w-4 h-4 mr-2" />
                {isPrintingBt
                  ? 'Printing...'
                  : btCharacteristic
                  ? `ဘောင်ချာထုတ်မည် (${bluetoothDevice?.name || printSettings.savedPrinterName || 'BT Printer'})`
                  : 'ဘောင်ချာထုတ်မည် (Connect & Print)'}
              </button>
              <button
                onClick={startNewSale}
                className="w-full py-3 bg-[#D4AF37] text-[#123524] rounded-xl font-black text-xs uppercase tracking-widest flex items-center justify-center shadow-sm hover:bg-yellow-500 transition"
              >
                <Plus className="w-4 h-4 mr-1.5" /> အရောင်းအသစ် ထပ်သွင်းမည် (New Sale)
              </button>
            </div>
          </div>
        </div>
      )}

      

      {/* ==========================================
          VIEW 5: DISCOUNTS & PROMOTIONS SETTING TAB
         ========================================== */}
      {activePosView === 'online_bookings' ? (
        /* ==========================================
           VIEW: ONLINE BOOKINGS IN POS (Print Receipt, Deposit Check & Approve Balance)
           ========================================== */
        <div className="max-w-5xl w-full mx-auto p-3.5 sm:p-5 space-y-4 animate-fade-in">
          {/* Deposit Configuration Modal inside POS */}
          {posDepositModalBooking && (
            <div className="fixed inset-0 z-[250] bg-black/65 backdrop-blur-xs flex items-center justify-center p-4">
              <div className="bg-white rounded-2xl max-w-sm w-full p-5 shadow-2xl border border-[#D4AF37]/40 space-y-4 animate-fade-in">
                <div className="flex justify-between items-center border-b pb-3">
                  <div>
                    <h3 className="text-sm font-black text-[#123524]">Online စရံ / အပြည့်ချေ သတ်မှတ်ရန်</h3>
                    <p className="text-[11px] text-gray-500">
                      {posDepositModalBooking.name} • စုစုပေါင်း: <strong>{formatPrice(posDepositModalBooking.totalPrice)}</strong>
                    </p>
                  </div>
                  <button onClick={() => setPosDepositModalBooking(null)} className="text-gray-400 hover:text-red-500">
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => handlePosSetOnlineDeposit(posDepositModalBooking, Math.round(posDepositModalBooking.totalPrice / 2))}
                    className="p-2.5 rounded-xl bg-amber-50 hover:bg-amber-100 border border-amber-300 text-amber-900 text-xs font-black"
                  >
                    50% စရံတစ်ဝက်
                    <span className="block text-[10px] font-bold text-amber-700 mt-0.5">
                      ({formatPrice(Math.round(posDepositModalBooking.totalPrice / 2))})
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handlePosSetOnlineDeposit(posDepositModalBooking, posDepositModalBooking.totalPrice)}
                    className="p-2.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 text-emerald-900 text-xs font-black"
                  >
                    100% အပြည့်ချေပြီး
                    <span className="block text-[10px] font-bold text-emerald-700 mt-0.5">
                      ({formatPrice(posDepositModalBooking.totalPrice)})
                    </span>
                  </button>
                </div>

                <div className="pt-2 border-t border-gray-100 space-y-2">
                  <label className="block text-[11px] font-bold text-gray-600">စိတ်ကြိုက် စရံငွေပမာဏ ရိုက်ထည့်ရန် (Ks):</label>
                  <input
                    type="number"
                    value={posCustomDepositStr}
                    onChange={(e) => setPosCustomDepositStr(e.target.value)}
                    placeholder="ဥပမာ - 15000"
                    className="w-full p-2.5 bg-gray-50 border border-gray-300 rounded-xl text-xs font-black text-[#123524]"
                  />
                  <button
                    type="button"
                    disabled={!posCustomDepositStr}
                    onClick={() => handlePosSetOnlineDeposit(posDepositModalBooking, Number(posCustomDepositStr) || 0)}
                    className="w-full py-2.5 bg-[#123524] text-[#D4AF37] rounded-xl text-xs font-black uppercase"
                  >
                    Save Deposit Amount
                  </button>
                </div>
              </div>
            </div>
          )}

          <div className="bg-white p-4 sm:p-5 rounded-2xl shadow-sm border border-gray-200 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 pb-3.5">
              <div>
                <h2 className="text-base sm:text-lg font-bold text-[#123524] flex items-center">
                  <Calendar className="w-5 h-5 mr-2 text-[#D4AF37]" />
                  Online Bookings — ဘောင်ချာထုတ်ရန် နှင့် ငွေလွှဲစစ်ဆေးရန်
                </h2>
                <p className="text-xs text-gray-500 mt-0.5">
                  Web App မှ တက်လာသော Online Booking များအား POS မှ တိုက်ရိုက် ဘောင်ချာထုတ်ပေးနိုင်ပြီး စရံ/ကျန်ငွေ အတည်ပြုနိုင်ပါသည်
                </p>
              </div>
              <button
                type="button"
                onClick={() => setActivePosView('register')}
                className="px-4 py-2 bg-[#123524] text-[#D4AF37] rounded-xl text-xs font-bold shadow-sm"
              >
                ← Back to POS Register
              </button>
            </div>

            <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-2.5">
              <div className="flex bg-gray-100 p-1 rounded-xl border border-gray-200">
                <button
                  type="button"
                  onClick={() => setOnlineFilterTab('all')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                    onlineFilterTab === 'all' ? 'bg-[#123524] text-[#D4AF37]' : 'text-gray-600'
                  }`}
                >
                  အားလုံး ({liveOnlineBookings.length})
                </button>
                <button
                  type="button"
                  onClick={() => setOnlineFilterTab('today')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                    onlineFilterTab === 'today' ? 'bg-[#123524] text-[#D4AF37]' : 'text-gray-600'
                  }`}
                >
                  ယနေ့ရက်ချိန်း (Today)
                </button>
                <button
                  type="button"
                  onClick={() => setOnlineFilterTab('deposit_due')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                    onlineFilterTab === 'deposit_due' ? 'bg-amber-500 text-white' : 'text-gray-600'
                  }`}
                >
                  စရံ / ကျန်ငွေရရန်ကျန်
                </button>
              </div>

              <div className="relative flex-1 sm:max-w-xs">
                <input
                  type="text"
                  value={onlineSearchQuery}
                  onChange={(e) => setOnlineSearchQuery(e.target.value)}
                  placeholder="အမည် / ဖုန်း / TxID ရှာရန်..."
                  className="w-full pl-8 pr-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold outline-none focus:border-[#123524]"
                />
                <Search className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-2.5" />
              </div>
            </div>
          </div>

          <div className="space-y-3">
            {liveOnlineBookings
              .filter((b) => {
                if (onlineFilterTab === 'today' && b.date !== getLocalTodayStr()) return false;
                if (onlineFilterTab === 'deposit_due' && !(b.paymentStatus === 'deposit_only' && Number(b.balanceDue) > 0)) return false;
                const q = onlineSearchQuery.trim().toLowerCase();
                if (!q) return true;
                return (
                  (b.name || '').toLowerCase().includes(q) ||
                  (b.phone || '').toLowerCase().includes(q) ||
                  (b.txId || '').toLowerCase().includes(q) ||
                  (b.service || '').toLowerCase().includes(q)
                );
              })
              .map((b) => {
                const isDepDue = b.paymentStatus === 'deposit_only' && Number(b.balanceDue) > 0;
                const receiptObj = convertOnlineBookingToReceipt(b);

                return (
                  <div
                    key={b.id}
                    className={`bg-white p-4 rounded-2xl shadow-xs border transition flex flex-col md:flex-row items-start md:items-center justify-between gap-4 ${
                      isDepDue ? 'border-amber-300 bg-amber-50/20' : 'border-gray-200'
                    }`}
                  >
                    <div className="space-y-1.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono font-black text-xs bg-[#123524] text-[#D4AF37] px-2.5 py-1 rounded-lg">
                          TxID: {b.txId || '-'}
                        </span>
                        <span className="text-xs font-extrabold text-[#123524]">
                          {b.date} • {b.time}
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${
                            b.status === 'approved'
                              ? 'bg-green-100 text-green-800'
                              : b.status === 'in_progress'
                              ? 'bg-orange-100 text-orange-800'
                              : b.status === 'completed'
                              ? 'bg-blue-100 text-blue-800'
                              : 'bg-yellow-100 text-yellow-800 animate-pulse'
                          }`}
                        >
                          {b.status}
                        </span>
                        <span className="bg-gray-100 text-gray-700 px-2 py-0.5 rounded text-[10px] font-bold">
                          {(b.paymentMethod || 'Online Pay').split('(')[0].trim()}
                        </span>
                      </div>

                      <div className="text-sm font-black text-gray-900">
                        {b.name} <span className="font-mono text-xs text-gray-500">({b.phone})</span>
                      </div>

                      <div className="text-xs font-bold text-gray-700">
                        Service: <span className="text-[#123524]">{b.service}</span> | Therapist:{' '}
                        <span className="text-[#123524]">{b.therapist}</span>
                      </div>
                      {b.specialRequest && (
                        <div className="text-[11px] text-red-500 italic">Note: {b.specialRequest}</div>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto justify-end border-t md:border-t-0 pt-3 md:pt-0">
                      <div className="text-right mr-2">
                        {b.originalPrice > b.totalPrice && (
                          <div className="text-[10px] text-gray-400 line-through">
                            {formatPrice(b.originalPrice)} (-{b.discountPercent}%)
                          </div>
                        )}
                        <div className="text-base font-black text-[#123524]">
                          {formatPrice(b.totalPrice)}
                        </div>
                        {isDepDue ? (
                          <div className="text-[10px] font-black text-red-600">
                            စရံ: {formatPrice(b.depositPaid)} | ကျန်ငွေ: {formatPrice(b.balanceDue)}
                          </div>
                        ) : (
                          <div className="text-[10px] font-bold text-emerald-700">Paid in Full</div>
                        )}
                      </div>

                      {/* Deposit vs Full Paid Toggle / Approve Balance Button */}
                      {isDepDue ? (
                        <button
                          type="button"
                          onClick={() => handleApproveBalancePaid(receiptObj)}
                          className="px-3 py-2.5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-[11px] font-black flex items-center shadow-sm transition"
                        >
                          <CheckCircle className="w-3.5 h-3.5 mr-1" /> ကျန်ငွေ Approve
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            setPosDepositModalBooking(b);
                            setPosCustomDepositStr(String(Math.round((Number(b.totalPrice) || 0) / 2)));
                          }}
                          className="px-2.5 py-2 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 rounded-xl text-[10px] font-black transition"
                        >
                          စရံသတ်မှတ်ရန်
                        </button>
                      )}

                      {/* Load to POS Register Cart (To add extra items) */}
                      <button
                        type="button"
                        onClick={() => handleLoadOnlineBookingToPosCart(b)}
                        className="px-3 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-xl text-[11px] font-bold transition"
                        title="အပိုပစ္စည်း သို့မဟုတ် VVIP ထပ်ပေါင်းရန် POS Cart ထဲသို့ ပို့မည်"
                      >
                        + အပိုထပ်ပေါင်း
                      </button>

                      {/* Print Thermal Receipt Button */}
                      <button
                        type="button"
                        onClick={() => setActiveReceipt(receiptObj)}
                        className="px-3.5 py-2.5 bg-gradient-to-r from-[#123524] to-[#1a4a32] text-[#D4AF37] rounded-xl text-xs font-black flex items-center shadow-md hover:opacity-95 transition"
                      >
                        <Printer className="w-4 h-4 mr-1.5" /> ဘောင်ချာထုတ်မည်
                      </button>
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      ) : activePosView === 'discounts' ? (
        <div className="max-w-4xl w-full mx-auto p-4 sm:p-6 space-y-5 animate-fade-in">
          <div className="bg-white p-5 sm:p-6 rounded-2xl shadow-sm border border-gray-200 space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 pb-4">
              <div>
                <h2 className="text-base sm:text-lg font-bold text-[#123524] flex items-center">
                  <Tag className="w-5 h-5 mr-2 text-[#D4AF37]" />
                  Discounts, VIP Tiers & Campaign Settings
                </h2>
                <p className="text-xs text-gray-500 mt-0.5">
                  ဤနေရာတွင် သတ်မှတ်ထားသော Discount % နှင့် Reason များကို POS Checkout Dropdown မှ တစ်ချက်နှိပ်ရုံဖြင့် အဆင်သင့် ရွေးချယ်နိုင်ပါသည်
                </p>
              </div>
              <button
                type="button"
                onClick={() => setActivePosView('register')}
                className="px-4 py-2 bg-[#123524] text-[#D4AF37] rounded-xl text-xs font-bold shadow-sm hover:bg-[#1a4a32] transition"
              >
                ← Back to POS Register
              </button>
            </div>

            {/* Add New Discount Preset Form */}
            <form
              onSubmit={handleCreateDiscountPreset}
              className="bg-gradient-to-r from-yellow-50 to-amber-50/40 p-4 rounded-xl border border-[#D4AF37]/40 grid grid-cols-1 sm:grid-cols-12 gap-3 items-end"
            >
              <div className="sm:col-span-5">
                <label className="block text-[11px] font-bold text-[#123524] uppercase mb-1">
                  Discount Reason / Campaign Name
                </label>
                <input
                  type="text"
                  required
                  placeholder="ဥပမာ - VIP 20% Member / Happy Hour Promo"
                  value={newDiscountLabel}
                  onChange={(e) => setNewDiscountLabel(e.target.value)}
                  className="w-full p-2.5 bg-white border border-gray-200 rounded-xl text-xs font-bold outline-none focus:border-[#123524]"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-[11px] font-bold text-[#123524] uppercase mb-1">Type</label>
                <select
                  value={newDiscountType}
                  onChange={(e) => setNewDiscountType(e.target.value as 'percent' | 'fixed')}
                  className="w-full p-2.5 bg-white border border-gray-200 rounded-xl text-xs font-bold text-[#123524] outline-none"
                >
                  <option value="percent">% ရာခိုင်နှုန်း</option>
                  <option value="fixed">Ks ငွေပမာဏ</option>
                </select>
              </div>
              <div className="sm:col-span-2">
                <label className="block text-[11px] font-bold text-[#123524] uppercase mb-1">
                  Value ({newDiscountType === 'percent' ? '%' : 'Ks'})
                </label>
                <input
                  type="number"
                  required
                  min={1}
                  placeholder={newDiscountType === 'percent' ? '20' : '5000'}
                  value={newDiscountValue}
                  onChange={(e) => setNewDiscountValue(e.target.value)}
                  className="w-full p-2.5 bg-white border border-gray-200 rounded-xl text-xs font-black text-[#123524] outline-none focus:border-[#123524]"
                />
              </div>
              <div className="sm:col-span-3">
                <button
                  type="submit"
                  className="w-full py-2.5 px-4 bg-gradient-to-r from-[#123524] to-[#1a4a32] text-[#D4AF37] rounded-xl text-xs font-black uppercase tracking-wider shadow-md hover:opacity-95 transition flex items-center justify-center"
                >
                  <Plus className="w-4 h-4 mr-1" /> သိမ်းဆည်းမည်
                </button>
              </div>
            </form>

            {/* Saved Discount Presets List */}
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-extrabold uppercase tracking-wider text-gray-500">
                  Available VIP & Campaign Discounts ({allAvailableDiscounts.length})
                </h3>
                <button
                  type="button"
                  onClick={() => updateSavedDiscountPresets(DEFAULT_DISCOUNT_PRESETS)}
                  className="text-xs font-bold text-[#123524] underline"
                >
                  Reset Default VIP & Campaign List
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {allAvailableDiscounts.map((disc) => (
                  <div
                    key={disc.id}
                    className="p-3.5 rounded-xl bg-gray-50 border border-gray-200 flex items-center justify-between gap-3 hover:border-[#D4AF37] transition"
                  >
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-xs text-gray-800">{disc.label}</span>
                        {disc.id.startsWith('webapp_') && (
                          <span className="bg-green-100 text-green-800 text-[9px] font-black px-1.5 py-0.5 rounded">
                            Web App Live
                          </span>
                        )}
                      </div>
                      <div className="text-xs font-black text-green-700 mt-0.5">
                        {disc.type === 'percent' ? `${disc.value}% OFF` : `-${formatPrice(disc.value)}`}
                      </div>
                    </div>
                    {!disc.id.startsWith('webapp_') && (
                      <button
                        type="button"
                        onClick={() => handleDeleteDiscountPreset(disc.id)}
                        title="Delete Discount Preset"
                        className="p-2 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 transition"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      ) : activePosView === 'extra_items' ? (
        /* ==========================================
           VIEW 4: EXTRA SALE ITEMS SETTING TAB
           ========================================== */
        <div className="max-w-4xl w-full mx-auto p-4 sm:p-6 space-y-5 animate-fade-in">
          <div className="bg-white p-5 sm:p-6 rounded-2xl shadow-sm border border-gray-200 space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 pb-4">
              <div>
                <h2 className="text-base sm:text-lg font-bold text-[#123524] flex items-center">
                  <PackagePlus className="w-5 h-5 mr-2 text-[#D4AF37]" />
                  Extra Sale Items Management (အပိုပစ္စည်းများ သိမ်းဆည်းရန်)
                </h2>
                <p className="text-xs text-gray-500 mt-0.5">
                  ဤနေရာတွင် ပေါင်းထည့်ထားသော အပိုပစ္စည်းများအားလုံးကို POS Register ၏ Dropdown Box မှတစ်ဆင့် အဆင်သင့် ရွေးချယ်ထည့်သွင်းနိုင်ပါသည်
                </p>
              </div>
              <button
                type="button"
                onClick={() => setActivePosView('register')}
                className="px-4 py-2 bg-[#123524] text-[#D4AF37] rounded-xl text-xs font-bold shadow-sm hover:bg-[#1a4a32] transition"
              >
                ← Back to POS Register
              </button>
            </div>

            <form
              onSubmit={handleCreateExtraItemInSettings}
              className="bg-gradient-to-r from-yellow-50 to-amber-50/40 p-4 rounded-xl border border-[#D4AF37]/40 grid grid-cols-1 sm:grid-cols-12 gap-3 items-end"
            >
              <div className="sm:col-span-6">
                <label className="block text-[11px] font-bold text-[#123524] uppercase mb-1">
                  Item / Extra Service Name (ပစ္စည်းအမည်)
                </label>
                <input
                  type="text"
                  required
                  placeholder="ဥပမာ - Carebeau Massage Oil / Extra 30 Mins / Drink"
                  value={newExtraItemName}
                  onChange={(e) => setNewExtraItemName(e.target.value)}
                  className="w-full p-3 bg-white border border-gray-200 rounded-xl text-xs font-bold outline-none focus:border-[#123524]"
                />
              </div>
              <div className="sm:col-span-3">
                <label className="block text-[11px] font-bold text-[#123524] uppercase mb-1">
                  Price (Ks - ဈေးနှုန်း)
                </label>
                <input
                  type="number"
                  required
                  min={1}
                  placeholder="15000"
                  value={newExtraItemPrice}
                  onChange={(e) => setNewExtraItemPrice(e.target.value)}
                  className="w-full p-3 bg-white border border-gray-200 rounded-xl text-xs font-black text-[#123524] outline-none focus:border-[#123524]"
                />
              </div>
              <div className="sm:col-span-3">
                <button
                  type="submit"
                  className="w-full py-3 px-4 bg-gradient-to-r from-[#123524] to-[#1a4a32] text-[#D4AF37] rounded-xl text-xs font-black uppercase tracking-wider shadow-md hover:opacity-95 transition flex items-center justify-center"
                >
                  <Plus className="w-4 h-4 mr-1" /> သိမ်းဆည်းမည်
                </button>
              </div>
            </form>

            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-extrabold uppercase tracking-wider text-gray-500">
                  Saved Extra Items ({savedExtraItems.length})
                </h3>
                {savedExtraItems.length === 0 && (
                  <button
                    type="button"
                    onClick={() => updateSavedExtraItems(DEFAULT_EXTRA_ITEMS)}
                    className="text-xs font-bold text-[#123524] underline"
                  >
                    Restore Sample Items
                  </button>
                )}
              </div>

              {savedExtraItems.length === 0 ? (
                <div className="p-10 text-center text-gray-400 text-xs font-bold bg-gray-50 rounded-xl border border-dashed border-gray-200">
                  သိမ်းဆည်းထားသော အပိုပစ္စည်း မရှိသေးပါ။ အပေါ်တွင် အသစ်ထည့်သွင်းနိုင်ပါသည်။
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {savedExtraItems.map((item) => (
                    <div
                      key={item.id}
                      className="p-3.5 rounded-xl bg-gray-50 border border-gray-200 flex items-center justify-between gap-3 hover:border-[#D4AF37] transition"
                    >
                      <div>
                        <div className="font-bold text-xs text-gray-800">{item.name}</div>
                        <div className="text-xs font-black text-[#123524] mt-0.5">
                          {formatPrice(item.price)}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleDeleteSavedExtraItem(item.id)}
                        title="Delete Item"
                        className="p-2 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 transition"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      ) : activePosView === 'settings' ? (
        /* ==========================================
           VIEW 3: LOYVERSE-STYLE RECEIPT & PRINTER SETTINGS
           ========================================== */
        <div className="max-w-7xl w-full mx-auto p-3 sm:p-5 pos-split-layout animate-fade-in">
          <div className="space-y-4 min-w-0">
            <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-200 space-y-5">
              <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                <div>
                  <h2 className="text-base font-bold text-gray-800">Receipt settings</h2>
                  <p className="text-[11px] text-gray-500">
                    Loyverse ပုံစံအတိုင်း Digital Logo နှင့် Thermal Printed Logo တို့ကို သီးသန့်စီ စိတ်ကြိုက်ချိန်ညှိနိုင်ပါသည်
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    if (confirm('Default ဘောင်ချာဒီဇိုင်းအတိုင်း ပြန်ထားမည်မှာ သေချာပါသလား?')) {
                      updatePrintSettings(DEFAULT_PRINT_SETTINGS);
                    }
                  }}
                  className="text-xs font-bold text-red-600 hover:underline"
                >
                  Reset Default
                </button>
              </div>

              <div>
                <div className="flex items-center justify-between mb-3">
                  <label className="text-xs font-bold text-gray-700">Logo</label>
                  <label className="flex items-center gap-2 text-xs font-bold text-[#123524] cursor-pointer">
                    <input
                      type="checkbox"
                      checked={printSettings.showLogo}
                      onChange={(e) => updatePrintSettings({ showLogo: e.target.checked })}
                      className="w-4 h-4 accent-[#123524]"
                    />
                    Print Logo on Thermal Receipt
                  </label>
                </div>

                <div className="grid grid-cols-2 gap-4 max-w-sm">
                  <div>
                    <div className="text-[11px] text-gray-500 mb-1.5 font-medium">Digital / App receipt</div>
                    <div className="w-32 h-32 rounded-lg border border-gray-200 bg-[#123524] overflow-hidden flex items-center justify-center shadow-sm">
                      {digitalLogoUrl ? (
                        <img src={digitalLogoUrl} alt="Digital Logo" className="w-full h-full object-contain" />
                      ) : (
                        <span className="text-xs text-white">No Logo</span>
                      )}
                    </div>
                  </div>

                  <div>
                    <div className="text-[11px] text-gray-500 mb-1.5 font-medium">Printed receipt</div>
                    <div className="relative w-32 h-32 rounded-lg border border-gray-300 bg-white overflow-hidden flex flex-col justify-between shadow-sm">
                      {printSettings.customPrintedLogoDataUrl && (
                        <button
                          type="button"
                          onClick={() => updatePrintSettings({ customPrintedLogoDataUrl: '' })}
                          title="Remove custom uploaded logo"
                          className="absolute top-1.5 left-1.5 z-10 w-6 h-6 rounded-full bg-white border border-gray-300 shadow flex items-center justify-center text-gray-600 hover:text-red-600"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      )}
                      <div className="flex-1 flex items-center justify-center p-2 overflow-hidden">
                        {processedLogoPreview ? (
                          <img
                            src={processedLogoPreview}
                            alt="Printed Receipt Monochrome"
                            className="max-w-full max-h-20 object-contain"
                          />
                        ) : (
                          <span className="text-xs text-gray-400">No Logo</span>
                        )}
                      </div>
                      <input
                        ref={printedLogoInputRef}
                        type="file"
                        accept="image/*"
                        onChange={handleUploadPrintedLogo}
                        className="hidden"
                      />
                      <button
                        type="button"
                        onClick={() => printedLogoInputRef.current?.click()}
                        className="w-full py-1.5 bg-[#8bc34a] hover:bg-[#7cb342] text-white font-bold text-[11px] uppercase tracking-wider transition flex items-center justify-center"
                      >
                        <Upload className="w-3 h-3 mr-1" /> Upload
                      </button>
                    </div>
                  </div>
                </div>

                {printSettings.showLogo && (
                  <div className="mt-4 p-3 bg-gray-50 rounded-xl border border-gray-200 space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-[11px] font-bold text-gray-700">Thermal Logo Conversion Mode:</span>
                      <div className="flex gap-1.5">
                        <button
                          type="button"
                          onClick={() => updatePrintSettings({ logoFilterMode: 'auto_gold_extract', logoThreshold: 12 })}
                          className={`px-2.5 py-1 rounded-lg text-[10px] font-bold border transition ${
                            printSettings.logoFilterMode === 'auto_gold_extract'
                              ? 'bg-[#123524] text-[#D4AF37] border-[#123524]'
                              : 'bg-white text-gray-600 border-gray-200'
                          }`}
                        >
                          Auto Extract Gold
                        </button>
                        <button
                          type="button"
                          onClick={() => updatePrintSettings({ logoFilterMode: 'bw_threshold', logoThreshold: 0 })}
                          className={`px-2.5 py-1 rounded-lg text-[10px] font-bold border transition ${
                            printSettings.logoFilterMode === 'bw_threshold'
                              ? 'bg-[#123524] text-[#D4AF37] border-[#123524]'
                              : 'bg-white text-gray-600 border-gray-200'
                          }`}
                        >
                          Standard B&W
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[10px] font-bold text-gray-600 mb-1">
                          Logo Sharpness ({printSettings.logoThreshold})
                        </label>
                        <input
                          type="range"
                          min={-20}
                          max={45}
                          step={1}
                          value={printSettings.logoThreshold}
                          onChange={(e) => updatePrintSettings({ logoThreshold: parseInt(e.target.value, 10) })}
                          className="w-full accent-[#123524]"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-gray-600 mb-1">
                          Logo Width ({printSettings.logoSize} px)
                        </label>
                        <input
                          type="range"
                          min={112}
                          max={256}
                          step={8}
                          value={printSettings.logoSize}
                          onChange={(e) => updatePrintSettings({ logoSize: parseInt(e.target.value, 10) })}
                          className="w-full accent-[#123524]"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="space-y-3 pt-1">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] text-gray-500 font-semibold mb-1">Store Title</label>
                    <input
                      type="text"
                      value={printSettings.shopName}
                      onChange={(e) => updatePrintSettings({ shopName: e.target.value })}
                      className="w-full border-b border-gray-300 focus:border-[#123524] py-1 text-xs font-bold outline-none bg-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-gray-500 font-semibold mb-1">Subtitle</label>
                    <input
                      type="text"
                      value={printSettings.subtitle}
                      onChange={(e) => updatePrintSettings({ subtitle: e.target.value })}
                      className="w-full border-b border-gray-300 focus:border-[#123524] py-1 text-xs font-bold outline-none bg-transparent"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] text-gray-500 font-semibold mb-1">Header</label>
                  <input
                    type="text"
                    maxLength={500}
                    value={printSettings.headerText}
                    onChange={(e) => updatePrintSettings({ headerText: e.target.value })}
                    placeholder="e.g. Beyond Relaxation"
                    className="w-full border-b border-gray-300 focus:border-[#123524] py-1 text-xs outline-none bg-transparent"
                  />
                </div>

                <div>
                  <label className="block text-[11px] text-gray-500 font-semibold mb-1">Footer (Address)</label>
                  <input
                    type="text"
                    maxLength={500}
                    value={printSettings.footerText}
                    onChange={(e) => updatePrintSettings({ footerText: e.target.value })}
                    className="w-full border-b border-gray-300 focus:border-[#123524] py-1 text-xs outline-none bg-transparent"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] text-gray-500 font-semibold mb-1">Phone Number</label>
                    <input
                      type="text"
                      value={printSettings.phone}
                      onChange={(e) => updatePrintSettings({ phone: e.target.value })}
                      className="w-full border-b border-gray-300 focus:border-[#123524] py-1 text-xs outline-none bg-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-gray-500 font-semibold mb-1">Closing Note</label>
                    <input
                      type="text"
                      value={printSettings.thankYouText}
                      onChange={(e) => updatePrintSettings({ thankYouText: e.target.value })}
                      className="w-full border-b border-gray-300 focus:border-[#123524] py-1 text-xs outline-none bg-transparent"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-gray-100">
                  <span className="text-xs font-medium text-gray-800">Show customer info</span>
                  <input
                    type="checkbox"
                    checked={printSettings.showCustomerInfo}
                    onChange={(e) => updatePrintSettings({ showCustomerInfo: e.target.checked })}
                    className="w-4 h-4 accent-[#123524]"
                  />
                </div>
              </div>
            </div>

            <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-200 space-y-3.5">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 pb-2.5">
                <div>
                  <h3 className="text-sm font-bold text-[#123524] flex items-center">
                    <Bluetooth className="w-4 h-4 mr-1.5 text-[#D4AF37]" /> Bluetooth Printer & Paper Size
                  </h3>
                  <p className="text-[11px] text-gray-500">ချိတ်ဆက်ထားသော Printer ကို အလိုအလျောက် မှတ်သားပေးထားပါသည်</p>
                </div>
                <button
                  type="button"
                  onClick={handleForceRefreshApp}
                  className="px-2.5 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-[11px] font-bold flex items-center"
                >
                  <RefreshCw className="w-3 h-3 mr-1" /> Force Update App
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={() => handleConnectBluetoothPrinter(true)}
                  className="py-2.5 px-3 bg-[#123524] text-[#D4AF37] rounded-xl font-bold text-xs flex items-center justify-center shadow-sm hover:bg-[#1a4a32] transition"
                >
                  <Bluetooth className="w-4 h-4 mr-1.5" />
                  {bluetoothDevice ? `Connected (${bluetoothDevice.name || 'Change'})` : 'Pair Bluetooth Printer'}
                </button>

                <button
                  type="button"
                  disabled={isPrintingBt}
                  onClick={() => handleBluetoothEscPosPrint(samplePreviewReceipt)}
                  className="py-2.5 px-3 bg-yellow-50 text-[#123524] border border-[#D4AF37] rounded-xl font-bold text-xs flex items-center justify-center hover:bg-yellow-100 transition disabled:opacity-50"
                >
                  <Printer className="w-4 h-4 mr-1.5" />
                  {isPrintingBt ? 'Printing...' : 'Test Print ထုတ်ကြည့်မည်'}
                </button>
              </div>

              <div className="grid grid-cols-2 gap-2.5 pt-1">
                {(['58mm', '80mm'] as const).map((w) => (
                  <button
                    key={w}
                    type="button"
                    onClick={() => updatePrintSettings({ paperWidth: w })}
                    className={`py-2 rounded-xl font-black text-xs border-2 transition ${
                      printSettings.paperWidth === w
                        ? 'border-[#123524] bg-[#123524] text-[#D4AF37]'
                        : 'border-gray-200 bg-gray-50 text-gray-600'
                    }`}
                  >
                    Paper Size: {w}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="min-w-0 sticky top-16">
            <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-200 space-y-3">
              <div className="text-center">
                <h3 className="text-xs font-extrabold text-[#123524]">Printed Receipt Live Preview</h3>
                <p className="text-[10px] text-gray-500">
                  စာရွက်လုံးဝမထစ်ဘဲ တစ်ဆက်တည်းထွက်မည့် Professional UI/UX Typography Hierarchy
                </p>
              </div>

              <div className="bg-gray-100 p-3 rounded-xl flex justify-center overflow-x-auto">
                <div className="w-[68mm] bg-white p-3 text-gray-900 font-mono text-xs border border-gray-300 rounded shadow-sm">
                  <div className="text-center border-b border-dashed border-gray-400 pb-2 mb-2">
                    {printSettings.showLogo && processedLogoPreview && (
                      <img
                        src={processedLogoPreview}
                        alt="Thermal Monochrome Preview"
                        style={{ width: `${Math.round(printSettings.logoSize * 0.5)}px` }}
                        className="mx-auto mb-1.5 object-contain"
                      />
                    )}
                    {printSettings.shopName && (
                      <h2 className="font-serif font-black text-xs uppercase tracking-wider">
                        {printSettings.shopName}
                      </h2>
                    )}
                    {printSettings.subtitle && (
                      <p className="text-[8px] text-gray-600 uppercase tracking-widest">
                        {printSettings.subtitle}
                      </p>
                    )}
                    {printSettings.headerText && (
                      <p className="text-[9px] text-gray-700 mt-0.5">{printSettings.headerText}</p>
                    )}
                    {printSettings.footerText && (
                      <p className="text-[8px] text-gray-600 mt-0.5">{printSettings.footerText}</p>
                    )}
                    {printSettings.phone && <p className="text-[8px] text-gray-600">Tel: {printSettings.phone}</p>}
                  </div>

                  <div className="space-y-1 text-[10px] border-b border-dashed border-gray-300 pb-2 mb-2">
                    <div className="flex justify-between">
                      <span className="text-gray-500">Invoice:</span>
                      <span className="font-bold">SL-261014-8888</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Date/Time:</span>
                      <span className="text-gray-800">{samplePreviewReceipt.date} 7:00 PM</span>
                    </div>
                    {printSettings.showCustomerInfo && (
                      <div className="flex justify-between">
                        <span className="text-gray-500">Customer:</span>
                        <span className="text-gray-800">Walk-in Guest</span>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span className="text-gray-500">Therapist:</span>
                      <span className="text-gray-800">Therapist No-1</span>
                    </div>
                  </div>

                  <div className="border-b border-dashed border-gray-300 pb-2 mb-2 text-[10px]">
                    <div className="flex justify-between font-normal text-gray-800">
                      <span>1. Oil Massage</span>
                      <span>25,000 Ks</span>
                    </div>
                    <div className="text-[9px] text-gray-500 pl-3">60 Mins</div>
                  </div>

                  <div className="space-y-1 border-b border-dashed border-gray-300 pb-2 mb-2">
                    <div className="flex justify-between text-[10px]">
                      <span className="text-gray-500">Subtotal:</span>
                      <span className="text-gray-700">25,000 Ks</span>
                    </div>
                    <div className="flex justify-between text-xs font-black py-1 my-1 border-t border-dashed border-gray-300">
                      <span>TOTAL:</span>
                      <span>25,000 Ks</span>
                    </div>
                    <div className="flex justify-between text-[10px]">
                      <span className="text-gray-500">Payment (Cash):</span>
                      <span className="text-gray-700">25,000 Ks</span>
                    </div>
                    <div className="flex justify-between text-[9px] p-1 rounded border border-gray-500 mt-1">
                      <span>VIP Points Earned:</span>
                      <span className="font-black">+1 Pts</span>
                    </div>
                  </div>

                  <div className="text-center text-[9px] text-gray-600 whitespace-pre-line">
                    {printSettings.thankYouText}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : activePosView === 'history' ? (
        /* ==========================================
           VIEW 2: DATE-GROUPED RECEIPTS HISTORY WITH FILTER & DAILY TOTALS
           ========================================== */
        <div className="max-w-4xl w-full mx-auto p-3.5 sm:p-5 space-y-4 animate-fade-in">
          {/* 1. Top Title & Offline Sync Card */}
          <div className="bg-white p-4 sm:p-5 rounded-2xl shadow-sm border border-gray-200 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 pb-3.5">
              <div>
                <h2 className="text-base sm:text-lg font-bold text-[#123524] flex items-center">
                  <History className="w-5 h-5 mr-2 text-[#D4AF37]" />
                  Walk-in POS Receipts History
                </h2>
                <p className="text-xs text-gray-500 mt-0.5">
                  ရက်စွဲအလိုက် ဘောင်ချာမှတ်တမ်းများ၊ တစ်ရက်စာ ရောင်းရငွေချုပ် နှင့် ကျန်ငွေ Approve ပြုလုပ်ရန်
                </p>
              </div>

              {offlineQueue.length > 0 && (
                <button
                  onClick={syncOfflineRecords}
                  disabled={!isOnline || isSyncing}
                  className="px-4 py-2.5 bg-[#123524] text-[#D4AF37] rounded-xl text-xs font-bold flex items-center shadow-sm disabled:opacity-50"
                >
                  <RefreshCw className={`w-4 h-4 mr-2 ${isSyncing ? 'animate-spin' : ''}`} />
                  Sync {offlineQueue.length} Offline Sales
                </button>
              )}
            </div>

            {/* 2. Clean Date Filter Pills, Custom Date Picker & Search Bar */}
            <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-2.5">
              {/* Quick Date Filter Buttons */}
              <div className="flex flex-wrap items-center gap-1.5 bg-gray-100 p-1 rounded-xl border border-gray-200">
                <button
                  type="button"
                  onClick={() => setHistoryDateFilterMode('all')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                    historyDateFilterMode === 'all'
                      ? 'bg-[#123524] text-[#D4AF37] shadow-xs'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  အားလုံး (All)
                </button>
                <button
                  type="button"
                  onClick={() => setHistoryDateFilterMode('today')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                    historyDateFilterMode === 'today'
                      ? 'bg-[#123524] text-[#D4AF37] shadow-xs'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  ယနေ့ (Today)
                </button>
                <button
                  type="button"
                  onClick={() => setHistoryDateFilterMode('yesterday')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                    historyDateFilterMode === 'yesterday'
                      ? 'bg-[#123524] text-[#D4AF37] shadow-xs'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  မနေ့က (Yesterday)
                </button>

                {/* Custom Date Picker Input */}
                <div
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border transition ${
                    historyDateFilterMode === 'custom'
                      ? 'bg-[#123524] text-[#D4AF37] border-[#D4AF37]'
                      : 'bg-white text-gray-700 border-gray-200'
                  }`}
                >
                  <Calendar className="w-3.5 h-3.5 text-[#D4AF37] flex-shrink-0" />
                  <input
                    type="date"
                    value={historyCustomDate}
                    onChange={(e) => {
                      setHistoryCustomDate(e.target.value);
                      setHistoryDateFilterMode('custom');
                    }}
                    className={`text-xs font-bold outline-none bg-transparent cursor-pointer ${
                      historyDateFilterMode === 'custom' ? 'text-[#D4AF37]' : 'text-[#123524]'
                    }`}
                  />
                </div>
              </div>

              {/* Search Input */}
              <div className="relative flex-1 md:max-w-xs">
                <input
                  type="text"
                  value={historySearchQuery}
                  onChange={(e) => setHistorySearchQuery(e.target.value)}
                  placeholder="ဘောင်ချာနံပါတ် / အမည် / ဖုန်း ရှာရန်..."
                  className="w-full pl-8 pr-7 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold outline-none focus:border-[#123524]"
                />
                <Search className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-2.5" />
                {historySearchQuery && (
                  <button
                    type="button"
                    onClick={() => setHistorySearchQuery('')}
                    className="absolute right-2.5 top-2 text-gray-400 hover:text-gray-600"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* 3. Date-Grouped Receipt Sections */}
          {groupedHistoryByDate.length === 0 ? (
            <div className="bg-white p-12 rounded-2xl text-center text-gray-400 font-bold border border-gray-200 space-y-2">
              <div>ရွေးချယ်ထားသော ရက်စွဲအတွက် Walk-in POS အရောင်းမှတ်တမ်း မရှိသေးပါ။</div>
              {historyDateFilterMode !== 'all' && (
                <button
                  type="button"
                  onClick={() => setHistoryDateFilterMode('all')}
                  className="text-xs font-black text-[#123524] underline"
                >
                  ရက်အားလုံး ပြန်ကြည့်မည် (Show All Dates)
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-5">
              {groupedHistoryByDate.map((group) => (
                <div
                  key={group.date}
                  className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden"
                >
                  {/* 🌟 Daily Header Banner with Total Amount & Breakdown 🌟 */}
                  <div className="bg-gradient-to-r from-[#123524] via-[#1a4a32] to-[#123524] px-4 py-3 text-white flex flex-wrap items-center justify-between gap-3 border-b border-[#D4AF37]/40">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-xl bg-white/10 border border-[#D4AF37]/40 flex items-center justify-center text-[#D4AF37]">
                        <Calendar className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="font-extrabold text-xs sm:text-sm text-[#D4AF37] tracking-wide">
                          {formatReadableDateHeader(group.date)}
                        </div>
                        <div className="flex flex-wrap items-center gap-2 text-[10px] text-gray-200 font-semibold mt-0.5">
                          <span>ဘောင်ချာ: {group.sales.length} စောင်</span>
                          <span>•</span>
                          <span>Cash: {formatPrice(group.dailyCashTotal)}</span>
                          <span>•</span>
                          <span>Online: {formatPrice(group.dailyOnlineTotal)}</span>
                          {group.dailyPendingBalance > 0 && (
                            <span className="bg-red-500/90 text-white px-2 py-0.5 rounded-full text-[9px] font-black">
                              ကျန်ငွေရရန်: {formatPrice(group.dailyPendingBalance)}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Daily Total Amount Highlight Box */}
                    <div className="bg-black/25 px-3.5 py-1.5 rounded-xl border border-[#D4AF37]/40 text-right">
                      <span className="text-[9px] font-bold text-gray-300 uppercase tracking-wider block">
                        Daily Total Amount
                      </span>
                      <span className="text-sm sm:text-base font-black text-[#D4AF37]">
                        {formatPrice(group.dailyTotalAmount)}
                      </span>
                    </div>
                  </div>

                  {/* Individual Receipts inside this Date Group */}
                  <div className="divide-y divide-gray-100">
                    {group.sales.map((sale) => {
                      const hasBalanceDue =
                        sale.paymentStatus === 'deposit_only' && sale.balanceDue > 0;
                      return (
                        <div
                          key={sale.localId}
                          className={`p-4 flex flex-wrap items-center justify-between gap-3 transition ${
                            hasBalanceDue
                              ? 'bg-amber-50/30 hover:bg-amber-50/50'
                              : 'hover:bg-gray-50/80'
                          }`}
                        >
                          <div className="space-y-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-mono font-black text-sm text-[#123524]">
                                {sale.invoiceNo}
                              </span>
                              <span className="text-[10px] font-bold text-gray-500 bg-gray-100 px-2 py-0.5 rounded">
                                {sale.time}
                              </span>
                              {sale.synced ? (
                                <span className="bg-green-50 text-green-700 border border-green-200 px-2 py-0.5 rounded-full text-[9px] font-bold flex items-center">
                                  <CheckCircle className="w-2.5 h-2.5 mr-1" /> Synced
                                </span>
                              ) : (
                                <span className="bg-amber-50 text-amber-700 border border-amber-200 px-2 py-0.5 rounded-full text-[9px] font-bold">
                                  Pending Sync
                                </span>
                              )}
                              <span className="bg-gray-100 text-gray-700 px-2 py-0.5 rounded text-[9px] font-bold">
                                {sale.paymentMethod}
                              </span>
                              {hasBalanceDue ? (
                                <span className="bg-red-100 text-red-700 border border-red-200 px-2 py-0.5 rounded-full text-[9px] font-black flex items-center">
                                  <AlertCircle className="w-2.5 h-2.5 mr-1" /> စရံ:{' '}
                                  {formatPrice(sale.depositPaid)} | ကျန်ငွေ:{' '}
                                  {formatPrice(sale.balanceDue)}
                                </span>
                              ) : (
                                <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-full text-[9px] font-bold">
                                  Paid in Full
                                </span>
                              )}
                            </div>

                            <div className="text-xs font-bold text-gray-800">
                              {sale.items.map((i) => `${i.name} (x${i.qty})`).join(', ')}
                            </div>

                            <div className="text-[11px] text-gray-500">
                              Customer: <span className="font-semibold text-gray-700">{sale.customerName}</span>
                              {sale.customerPhone ? ` (${sale.customerPhone})` : ''} | Therapist:{' '}
                              <span className="font-semibold text-[#123524]">{sale.therapistName}</span>
                            </div>
                          </div>

                          <div className="flex items-center gap-2.5 ml-auto">
                            <div className="text-right">
                              {sale.discountAmount > 0 && (
                                <div className="text-[10px] text-gray-400 line-through font-semibold">
                                  {formatPrice(sale.subTotal)}
                                </div>
                              )}
                              <div className="text-base font-black text-[#123524]">
                                {formatPrice(sale.totalPrice)}
                              </div>
                              {sale.discountAmount > 0 && (
                                <div className="text-[10px] text-green-600 font-bold">
                                  Discount: -{formatPrice(sale.discountAmount)}
                                </div>
                              )}
                            </div>

                            {hasBalanceDue && (
                              <button
                                type="button"
                                disabled={approvingBalanceId === sale.localId}
                                onClick={() => handleApproveBalancePaid(sale)}
                                className="px-3 py-2.5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl font-black text-[11px] flex items-center shadow-sm transition"
                              >
                                <CheckCircle className="w-3.5 h-3.5 mr-1" />
                                {approvingBalanceId === sale.localId ? '...' : 'ကျန်ငွေ Approve'}
                              </button>
                            )}

                            <button
                              onClick={() => setActiveReceipt(sale)}
                              className="p-2.5 bg-yellow-50 text-[#123524] border border-[#D4AF37]/40 rounded-xl hover:bg-yellow-100 transition font-bold text-xs flex items-center"
                            >
                              <Printer className="w-4 h-4 mr-1" /> ဘောင်ချာ
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        /* ==========================================
           VIEW 1: POS REGISTER (GUARANTEED 2-COLUMN SPLIT SCREEN ON TABLET & DESKTOP)
           ========================================== */
        <div className="flex-1 max-w-7xl w-full mx-auto p-2.5 sm:p-4 pos-split-layout">
          {/* LEFT PANEL: STEPS & SERVICES (58% Width on Tablet) */}
          <div className="space-y-3 min-w-0">
            <div className="bg-white p-2 rounded-2xl shadow-sm border border-gray-200 grid grid-cols-4 gap-1">
              {[
                { num: 1, label: '1. SERVICE', icon: Sparkles },
                { num: 2, label: '2. THERAPIST', icon: User },
                { num: 3, label: '3. TIME', icon: Clock },
                { num: 4, label: '4. PAYMENT', icon: Banknote }
              ].map((s) => {
                const active = posStep === s.num;
                const done = posStep > s.num;
                return (
                  <button
                    key={s.num}
                    type="button"
                    onClick={() => setPosStep(s.num as any)}
                    className={`py-2 px-1 rounded-xl font-extrabold text-[10px] sm:text-[11px] flex items-center justify-center transition-all ${
                      active
                        ? 'bg-gradient-to-r from-[#123524] to-[#1a4a32] text-[#D4AF37] shadow-sm'
                        : done
                        ? 'bg-yellow-50 text-[#123524] border border-[#D4AF37]/40'
                        : 'bg-gray-50 text-gray-500 hover:bg-gray-100'
                    }`}
                  >
                    <s.icon className="w-3 h-3 mr-1 flex-shrink-0" />
                    <span className="truncate">{s.label}</span>
                  </button>
                );
              })}
            </div>

            {posStep === 1 && (
              <div className="bg-white p-3 sm:p-4 rounded-2xl shadow-sm border border-gray-200 space-y-3 animate-fade-in">
                {/* 🌟 Ready-to-Pick Extra Sale Items Dropdown Box 🌟 */}
                <div className="border-b border-gray-100 pb-3 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <h2 className="text-sm sm:text-base font-bold text-[#123524]">
                        Select Services & Sale Items
                      </h2>
                      <p className="text-[10px] text-gray-500">
                        ဝန်ဆောင်မှု သို့မဟုတ် အပိုပစ္စည်း ရွေးလိုက်သည်နှင့် ညာဘက် Bill ထဲသို့ တိုက်ရိုက်ခုန်ဝင်သွားပါမည်
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 bg-yellow-50/70 p-2 rounded-xl border border-[#D4AF37]/40">
                    <select
                      value={selectedExtraItemId}
                      onChange={(e) => {
                        const val = e.target.value;
                        setSelectedExtraItemId(val);
                        if (val) {
                          handleAddSelectedExtraItemToCart(val, extraDropdownBtnRef.current);
                        }
                      }}
                      className="flex-1 p-2 bg-white border border-gray-200 rounded-lg text-xs font-bold text-[#123524] outline-none focus:border-[#123524] min-w-0"
                    >
                      <option value="">-- အပိုပစ္စည်း / Extra Sale Item အဆင်သင့် ရွေးချယ်ရန် --</option>
                      {savedExtraItems.map((ext) => (
                        <option key={ext.id} value={ext.id}>
                          {ext.name} — {formatPrice(ext.price)}
                        </option>
                      ))}
                    </select>

                    <button
                      ref={extraDropdownBtnRef}
                      type="button"
                      disabled={!selectedExtraItemId}
                      onClick={(e) => {
                        if (selectedExtraItemId) {
                          handleAddSelectedExtraItemToCart(selectedExtraItemId, e.currentTarget);
                        }
                      }}
                      className="px-3 py-2 bg-[#123524] text-[#D4AF37] rounded-lg text-[11px] font-black whitespace-nowrap shadow-sm hover:bg-[#1a4a32] disabled:opacity-40 transition flex items-center"
                    >
                      <Plus className="w-3.5 h-3.5 mr-0.5" /> Add
                    </button>

                    <button
                      type="button"
                      onClick={() => setActivePosView('extra_items')}
                      title="Manage Saved Extra Items"
                      className="p-2 bg-white text-[#123524] border border-[#D4AF37]/50 rounded-lg hover:bg-yellow-100 transition flex-shrink-0"
                    >
                      <Settings className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-hide">
                  {(localAppData?.categories || []).map((cat) => (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => setActiveCategory(cat.id)}
                      className={`px-3 py-1.5 rounded-xl text-[11px] font-bold whitespace-nowrap border transition ${
                        activeCategory === cat.id
                          ? 'bg-[#123524] text-[#D4AF37] border-[#123524] shadow-sm'
                          : 'bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100'
                      }`}
                    >
                      {cat.title}
                    </button>
                  ))}
                </div>

                <div className="grid grid-cols-2 gap-2 max-h-[64vh] overflow-y-auto pr-1">
                  {(localAppData?.categories || [])
                    .find((c) => c.id === activeCategory)
                    ?.items.map((item) => {
                      const inCartQty = cart
                        .filter((c) => c.id === item.id && !c.isCustomItem)
                        .reduce((s, i) => s + i.qty, 0);

                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={(e) => addServiceToCart(item, e)}
                          className={`p-2.5 rounded-xl border text-left transition-all duration-150 active:scale-95 flex flex-col justify-between relative group ${
                            inCartQty > 0
                              ? 'border-[#123524] bg-green-50/50 ring-1 ring-[#123524]/30 shadow-sm'
                              : 'border-gray-200 bg-white hover:border-[#D4AF37] hover:shadow-md'
                          }`}
                        >
                          {inCartQty > 0 && (
                            <span className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full bg-[#123524] text-[#D4AF37] text-[10px] font-black flex items-center justify-center shadow">
                              {inCartQty}
                            </span>
                          )}
                          <div>
                            <div className="font-bold text-[11px] sm:text-xs text-gray-800 line-clamp-2 pr-5 leading-snug">
                              {item.name}
                            </div>
                            {item.duration && (
                              <span className="inline-flex items-center text-[9px] font-bold text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded mt-1">
                                <Clock className="w-2.5 h-2.5 mr-1 text-[#D4AF37]" /> {item.duration}
                              </span>
                            )}
                          </div>
                          <div className="mt-2.5 pt-1.5 border-t border-gray-100 flex items-center justify-between">
                            <span className="font-black text-xs text-[#123524]">
                              {formatPrice(item.price)}
                            </span>
                            <span className="text-[9px] font-bold text-[#D4AF37] bg-[#123524] group-hover:bg-[#1a4a32] px-2 py-0.5 rounded-md shadow-sm transition">
                              + Add
                            </span>
                          </div>
                        </button>
                      );
                    })}
                </div>

                <div className="pt-1 flex justify-end">
                  <button
                    type="button"
                    disabled={cart.length === 0}
                    onClick={() => setPosStep(2)}
                    className="w-full py-3 bg-gradient-to-r from-[#123524] to-[#1a4a32] text-[#D4AF37] rounded-xl font-black text-xs uppercase tracking-widest disabled:opacity-50 shadow-md hover:opacity-95 transition"
                  >
                    Continue to Therapist →
                  </button>
                </div>
              </div>
            )}

            {posStep === 2 && (
              <div className="bg-white p-3.5 sm:p-5 rounded-2xl shadow-sm border border-gray-200 space-y-4 animate-fade-in">
                <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                  <div>
                    <h2 className="text-sm sm:text-base font-bold text-[#123524]">Assign Therapist</h2>
                    <p className="text-[11px] text-gray-500">ဝန်ဆောင်မှုပေးမည့် Therapist (၁ ဦး သို့မဟုတ် ၂ ဦး) ရွေးချယ်ပါ</p>
                  </div>
                  {(therapist1 || therapist2) && (
                    <button
                      type="button"
                      onClick={() => {
                        setTherapist1(null);
                        setTherapist2(null);
                      }}
                      className="text-xs font-bold text-red-500 hover:underline"
                    >
                      Clear Selection
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-3 gap-2 max-h-[60vh] overflow-y-auto">
                  {(localAppData?.therapists || []).map((t) => {
                    const isSelected = therapist1?.id === t.id || therapist2?.id === t.id;
                    return (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => {
                          if (therapist1?.id === t.id) setTherapist1(null);
                          else if (therapist2?.id === t.id) setTherapist2(null);
                          else if (!therapist1) setTherapist1(t);
                          else setTherapist2(t);
                        }}
                        className={`p-2 rounded-xl border text-center transition-all flex flex-col items-center relative ${
                          isSelected
                            ? 'border-[#123524] bg-[#123524] text-[#D4AF37] shadow-md scale-[1.02]'
                            : 'border-gray-200 bg-gray-50/60 text-gray-800 hover:border-[#D4AF37]'
                        }`}
                      >
                        <div className="w-11 h-11 rounded-full overflow-hidden bg-gray-200 mb-1.5 border border-[#D4AF37] flex items-center justify-center">
                          {t.images?.[0] || t.imageUrl ? (
                            <img src={t.images?.[0] || t.imageUrl} alt={t.name} className="w-full h-full object-cover" />
                          ) : (
                            <User className="w-5 h-5 text-gray-400" />
                          )}
                        </div>
                        <span className="font-bold text-[11px] truncate w-full">{t.name}</span>
                      </button>
                    );
                  })}
                </div>

                <div className="pt-3 flex justify-between gap-2.5">
                  <button
                    type="button"
                    onClick={() => setPosStep(1)}
                    className="px-5 py-3 rounded-xl font-bold text-xs bg-gray-100 text-gray-600"
                  >
                    ← Back
                  </button>
                  <button
                    type="button"
                    onClick={() => setPosStep(3)}
                    className="flex-1 py-3 bg-gradient-to-r from-[#123524] to-[#1a4a32] text-[#D4AF37] rounded-xl font-black text-xs uppercase tracking-widest shadow-md"
                  >
                    Continue to Time →
                  </button>
                </div>
              </div>
            )}

            {posStep === 3 && (
              <div className="bg-white p-3.5 sm:p-5 rounded-2xl shadow-sm border border-gray-200 space-y-4 animate-fade-in">
                <div className="border-b border-gray-100 pb-2.5">
                  <h2 className="text-sm sm:text-base font-bold text-[#123524]">Walk-in Time & Room Status</h2>
                  <p className="text-[11px] text-gray-500">ဧည့်သည် ဝင်ရောက်သည့်အချိန်နှင့် ဝန်ဆောင်မှု အခြေအနေ သတ်မှတ်ပါ</p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-gray-600 mb-1">Sale Date (နေ့ရက်)</label>
                    <input
                      type="date"
                      value={saleDate}
                      onChange={(e) => setSaleDate(e.target.value)}
                      className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl font-bold text-xs text-[#123524]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-600 mb-1">
                      Start Time (စတင်ချိန်)
                    </label>
                    <input
                      type="time"
                      value={saleTime}
                      onChange={(e) => setSaleTime(e.target.value)}
                      className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl font-black text-sm text-[#123524]"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-600 mb-2">
                    Booking / Service Status (Dashboard တွင် ပြသမည့် ပုံစံ)
                  </label>
                  <div className="grid grid-cols-2 gap-2.5">
                    <button
                      type="button"
                      onClick={() => setServiceStatus('in_progress')}
                      className={`p-3 rounded-xl border-2 text-left transition ${
                        serviceStatus === 'in_progress'
                          ? 'border-[#123524] bg-green-50/60'
                          : 'border-gray-200 bg-white'
                      }`}
                    >
                      <div className="font-black text-xs text-[#123524] flex items-center">
                        <Clock className="w-3.5 h-3.5 mr-1 text-orange-500" /> Start Service Now
                      </div>
                      <p className="text-[10px] text-gray-500 mt-1 font-semibold">
                        ဧည့်သည် ယခု စဝင်နေသည် (In Progress)
                      </p>
                    </button>

                    <button
                      type="button"
                      onClick={() => setServiceStatus('completed')}
                      className={`p-3 rounded-xl border-2 text-left transition ${
                        serviceStatus === 'completed'
                          ? 'border-[#123524] bg-green-50/60'
                          : 'border-gray-200 bg-white'
                      }`}
                    >
                      <div className="font-black text-xs text-[#123524] flex items-center">
                        <CheckCircle className="w-3.5 h-3.5 mr-1 text-green-600" /> Completed Sale
                      </div>
                      <p className="text-[10px] text-gray-500 mt-1 font-semibold">
                        ဝန်ဆောင်မှု ပြီးဆုံးပြီး ဘောင်ချာထုတ်မည်
                      </p>
                    </button>
                  </div>
                </div>

                <div className="pt-3 flex justify-between gap-2.5">
                  <button
                    type="button"
                    onClick={() => setPosStep(2)}
                    className="px-5 py-3 rounded-xl font-bold text-xs bg-gray-100 text-gray-600"
                  >
                    ← Back
                  </button>
                  <button
                    type="button"
                    onClick={() => setPosStep(4)}
                    className="flex-1 py-3 bg-gradient-to-r from-[#123524] to-[#1a4a32] text-[#D4AF37] rounded-xl font-black text-xs uppercase tracking-widest shadow-md"
                  >
                    Continue to Payment →
                  </button>
                </div>
              </div>
            )}

            {/* ==========================================
                STEP 4: CLEAN & STREAMLINED CUSTOMER, DISCOUNT & PAYMENT UI
               ========================================== */}
            {posStep === 4 && (
              <div className="bg-white p-3.5 sm:p-5 rounded-2xl shadow-sm border border-gray-200 space-y-4 animate-fade-in min-w-0 overflow-hidden">
                {/* 1. Customer, VIP Member & Thadingyut Lantern Game Lookup */}
                <div className="space-y-2.5">
                  <h3 className="text-xs font-extrabold uppercase tracking-wider text-[#123524] flex items-center">
                    <User className="w-4 h-4 mr-1.5 text-[#D4AF37]" /> Customer & VIP / Campaign Lookup
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <div>
                      <label className="block text-[10px] font-bold text-gray-500 mb-1">
                        Phone Number (VIP Card / မီးပုံးဖမ်းဂိမ်း စစ်ရန်)
                      </label>
                      <div className="flex gap-1.5">
                        <input
                          type="tel"
                          value={customerPhone}
                          onChange={(e) => setCustomerPhone(e.target.value)}
                          onBlur={handleCheckCustomerPhone}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              handleCheckCustomerPhone();
                            }
                          }}
                          placeholder="09xxxxxxxxx"
                          className="flex-1 min-w-0 p-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold outline-none focus:border-[#123524]"
                        />
                        {isOnline && (
                          <button
                            type="button"
                            disabled={isSearchingCustomer || !customerPhone.trim()}
                            onClick={handleCheckCustomerPhone}
                            className={`px-3.5 rounded-xl text-xs font-black shadow-sm flex items-center justify-center gap-1.5 transition active:scale-95 ${
                              isSearchingCustomer
                                ? 'bg-[#D4AF37] text-[#123524] ring-2 ring-[#123524]/30'
                                : 'bg-[#123524] text-[#D4AF37] hover:bg-[#1a4a32] disabled:opacity-50'
                            }`}
                          >
                            {isSearchingCustomer ? (
                              <>
                                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                                <span className="text-[10px]">ရှာနေသည်...</span>
                              </>
                            ) : (
                              <Search className="w-3.5 h-3.5" />
                            )}
                          </button>
                        )}
                      </div>
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-gray-500 mb-1">Customer Name</label>
                      <input
                        type="text"
                        value={customerName}
                        onChange={(e) => setCustomerName(e.target.value)}
                        placeholder="Walk-in Guest"
                        className="w-full min-w-0 p-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold outline-none focus:border-[#123524]"
                      />
                    </div>
                  </div>

                  {/* Searching Skeleton Pulse Indicator */}
                  {isSearchingCustomer && (
                    <div className="p-2.5 rounded-xl bg-yellow-50 border border-[#D4AF37]/50 flex items-center gap-2 text-xs font-bold text-[#123524] animate-pulse">
                      <RefreshCw className="w-4 h-4 animate-spin text-[#D4AF37]" />
                      <span>VIP Member စာရင်း နှင့် သီတင်းကျွတ် မီးပုံးဖမ်းဂိမ်း မှတ်တမ်း စစ်ဆေးနေပါသည်...</span>
                    </div>
                  )}

                  {/* VIP Member & Thadingyut Lantern Game Result Banner */}
                  {!isSearchingCustomer && (foundCustomerPts !== null || detectedCampaignWin) && (
                    <div className="p-2.5 rounded-xl bg-gradient-to-r from-yellow-50 to-amber-50/60 border border-[#D4AF37]/50 space-y-2 animate-fade-in">
                      <div className="flex flex-wrap items-center justify-between gap-1.5">
                        <span className="text-[11px] font-bold text-[#123524] flex items-center">
                          <Crown className="w-3.5 h-3.5 mr-1 text-[#D4AF37] flex-shrink-0" />
                          {detectedVipBenefit
                            ? `${detectedVipBenefit.tierName} (${detectedVipBenefit.discountPercent}% OFF)`
                            : foundCustomerPts && foundCustomerPts > 0
                            ? 'Registered Member'
                            : 'Walk-in / New Phone'}
                        </span>
                        {foundCustomerPts !== null && (
                          <span className="text-[10px] font-black bg-[#123524] text-[#D4AF37] px-2 py-0.5 rounded-full">
                            လက်ရှိပွိုင့်: {foundCustomerPts} Pts (+{pointsEarned} Pts တိုးမည်)
                          </span>
                        )}
                      </div>

                      {/* Show Thadingyut Lantern Game Won Badge if found in `campaign_records` */}
                      {detectedCampaignWin && (
                        <div className="px-2.5 py-1.5 rounded-lg bg-orange-100/80 border border-orange-300 flex items-center justify-between text-[11px] font-black text-orange-900">
                          <span className="flex items-center">
                            <Sparkles className="w-3.5 h-3.5 mr-1 text-orange-600" />
                            {detectedCampaignWin.campaignName} ပေါက်ထားသည်!
                          </span>
                          <span className="bg-orange-600 text-white px-2 py-0.5 rounded text-[10px]">
                            {detectedCampaignWin.discountPercent}% OFF
                          </span>
                        </div>
                      )}

                      {/* If Customer has VIP Benefit AND (Lantern Game Win OR Active Campaign) -> Let staff choose! */}
                      {detectedVipBenefit && isStorePromoActive && (
                        <div className="pt-1.5 border-t border-[#D4AF37]/30 space-y-1.5">
                          <span className="block text-[10px] font-extrabold text-amber-900">
                            ★ ခံစားခွင့် (၂) မျိုး ရှိနေပါသည် — မည်သည့်ခံစားခွင့်ကို အသုံးပြုမည်နည်း?
                          </span>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                            <button
                              type="button"
                              onClick={() =>
                                applyVipOrPromoChoice('vip', detectedVipBenefit, detectedCampaignWin)
                              }
                              className={`py-2 px-2.5 rounded-lg text-[10px] font-black border transition truncate ${
                                benefitChoiceMode === 'vip'
                                  ? 'bg-[#123524] text-[#D4AF37] border-[#123524] shadow-sm'
                                  : 'bg-white text-gray-700 border-gray-200'
                              }`}
                            >
                              VIP Card ({detectedVipBenefit.discountPercent}% OFF) သုံးမည်
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                applyVipOrPromoChoice('promo', detectedVipBenefit, detectedCampaignWin)
                              }
                              className={`py-2 px-2.5 rounded-lg text-[10px] font-black border transition truncate ${
                                benefitChoiceMode === 'promo'
                                  ? 'bg-orange-600 text-white border-orange-600 shadow-sm'
                                  : 'bg-white text-gray-700 border-gray-200'
                              }`}
                            >
                              {activeStorePromoTitle} ({activeStorePromoPct}% OFF) သုံးမည်
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* 2. Clean Dropdown Discount Selector + Per-Item Discount Eligibility Selector */}
                <div className="pt-3 border-t border-gray-100 space-y-2.5 min-w-0 overflow-hidden">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="text-xs font-extrabold uppercase tracking-wider text-[#123524] flex items-center truncate">
                      <Percent className="w-4 h-4 mr-1.5 text-[#D4AF37] flex-shrink-0" /> Discount / Promotion (လျှော့ဈေး)
                    </h3>
                    <button
                      type="button"
                      onClick={() => setActivePosView('discounts')}
                      className="text-[10px] font-bold text-[#123524] bg-gray-100 hover:bg-gray-200 px-2.5 py-1 rounded-lg flex items-center flex-shrink-0 whitespace-nowrap transition"
                    >
                      <Settings className="w-3 h-3 mr-1 text-[#D4AF37]" /> Manage Discounts
                    </button>
                  </div>

                  {/* Contained Select Wrapper */}
                  <div className="w-full min-w-0 overflow-hidden">
                    <select
                      value={selectedDiscountPresetId}
                      onChange={(e) => handleSelectDiscountDropdown(e.target.value)}
                      className="w-full max-w-full min-w-0 p-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold text-[#123524] outline-none focus:border-[#123524] truncate block"
                    >
                      <option value="none">No Discount (လျှော့ဈေး မရှိပါ)</option>
                      {allAvailableDiscounts.map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.label} — ({d.type === 'percent' ? `${d.value}%` : formatPrice(d.value)})
                        </option>
                      ))}
                      <option value="custom">+ Custom Discount (စိတ်ကြိုက် ရိုက်ထည့်မည်)...</option>
                    </select>
                  </div>

                  {/* 🌟 Item တစ်ခုချင်းစီအလိုက် လျှော့ဈေး ပေး/မပေး စိတ်ကြိုက် ရွေးချယ်နိုင်သည့် စာရင်း 🌟 */}
                  {discountValue > 0 && cart.length > 0 && (
                    <div className="p-2.5 bg-gray-50 rounded-xl border border-gray-200 space-y-1.5">
                      <div className="flex items-center justify-between text-[10px] font-extrabold text-gray-600">
                        <span>လျှော့ဈေးပေးမည့် Item များကို ရွေးချယ်ပါ:</span>
                        <span className="text-[#123524]">
                          Discount တွက်မည့်ငွေ: {formatPrice(discountableSubTotal)}
                        </span>
                      </div>
                      <div className="space-y-1">
                        {cart.map((cItem) => {
                          const isEligible =
                            cItem.discountEligible !== undefined ? cItem.discountEligible : !cItem.isCustomItem;
                          const itemTotal =
                            (cItem.price +
                              (cItem.isVvipUpgrade && cItem.vvipExtraPrice ? cItem.vvipExtraPrice : 0)) *
                            cItem.qty;
                          const itemDiscAmt =
                            isEligible && discountType === 'percent'
                              ? Math.round((itemTotal * Math.min(100, discountValue)) / 100)
                              : 0;

                          return (
                            <button
                              key={cItem.cartId}
                              type="button"
                              onClick={() => toggleCartItemDiscountEligible(cItem.cartId)}
                              className={`w-full px-2.5 py-1.5 rounded-lg border text-left flex items-center justify-between gap-2 transition ${
                                isEligible
                                  ? 'bg-green-50/80 border-green-300 text-[#123524]'
                                  : 'bg-white border-gray-200 text-gray-400'
                              }`}
                            >
                              <div className="flex items-center gap-2 min-w-0">
                                <input
                                  type="checkbox"
                                  readOnly
                                  checked={isEligible}
                                  className="w-3.5 h-3.5 accent-[#123524] pointer-events-none"
                                />
                                <span className="text-[11px] font-bold truncate">
                                  {cItem.name} {cItem.qty > 1 ? `x${cItem.qty}` : ''} ({formatPrice(itemTotal)})
                                </span>
                              </div>
                              <span
                                className={`text-[10px] font-black whitespace-nowrap px-1.5 py-0.5 rounded ${
                                  isEligible
                                    ? 'bg-green-600 text-white'
                                    : 'bg-gray-100 text-gray-500'
                                }`}
                              >
                                {isEligible
                                  ? discountType === 'percent'
                                    ? `-${formatPrice(itemDiscAmt)} (${discountValue}%)`
                                    : 'Discount ပါမည်'
                                  : 'No Discount'}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Summary pill showing auto-filled Discount & Reason */}
                  {discountValue > 0 && !showCustomDiscountInputs && (
                    <div className="px-3 py-2 bg-green-50 border border-green-200 rounded-xl flex items-center justify-between gap-2 text-xs min-w-0 overflow-hidden">
                      <span className="font-bold text-green-800 truncate min-w-0 flex-1">
                        Reason: {discountReason}
                      </span>
                      <span className="font-black text-green-700 whitespace-nowrap flex-shrink-0">
                        -{formatPrice(discountAmount)} ({discountType === 'percent' ? `${discountValue}%` : 'Fixed'})
                      </span>
                    </div>
                  )}

                  {/* Custom Discount Inputs */}
                  {showCustomDiscountInputs && (
                    <div className="p-3 bg-gray-50 rounded-xl border border-gray-200 grid grid-cols-12 gap-2 items-end animate-fade-in">
                      <div className="col-span-3">
                        <label className="block text-[10px] font-bold text-gray-500 mb-1">Type</label>
                        <select
                          value={discountType}
                          onChange={(e) => setDiscountType(e.target.value as 'percent' | 'fixed')}
                          className="w-full p-2 bg-white border border-gray-200 rounded-lg text-xs font-bold text-[#123524]"
                        >
                          <option value="percent">%</option>
                          <option value="fixed">Ks</option>
                        </select>
                      </div>
                      <div className="col-span-4">
                        <label className="block text-[10px] font-bold text-gray-500 mb-1">
                          Value ({discountType === 'percent' ? '%' : 'Ks'})
                        </label>
                        <input
                          type="number"
                          min={0}
                          value={discountValue || ''}
                          onChange={(e) =>
                            setDiscountValue(Math.max(0, parseInt(e.target.value, 10) || 0))
                          }
                          placeholder="0"
                          className="w-full p-2 bg-white border border-gray-200 rounded-lg text-xs font-black text-[#123524]"
                        />
                      </div>
                      <div className="col-span-5">
                        <label className="block text-[10px] font-bold text-gray-500 mb-1">Reason</label>
                        <input
                          type="text"
                          value={discountReason}
                          onChange={(e) => setDiscountReason(e.target.value)}
                          placeholder="Reason..."
                          className="w-full p-2 bg-white border border-gray-200 rounded-lg text-xs font-bold"
                        />
                      </div>
                    </div>
                  )}
                </div>
                {/* 3. Clean Payment Method Dropdown + Online Deposit / Balance Due Split */}
                <div className="pt-3 border-t border-gray-100 space-y-2.5">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 items-end">
                    <div>
                      <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1 flex items-center">
                        <Banknote className="w-3.5 h-3.5 mr-1 text-[#D4AF37]" /> Payment Method (ငွေပေးချေမှု စနစ်)
                      </label>
                      <select
                        value={paymentMethod}
                        onChange={(e) => {
                          setPaymentMethod(e.target.value);
                          if (e.target.value === 'Cash') {
                            setOnlinePayMode('full');
                          }
                        }}
                        className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-black text-[#123524] outline-none focus:border-[#123524]"
                      >
                        {paymentOptions.map((pm) => (
                          <option key={pm} value={pm}>
                            {pm}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-gray-500 mb-1">
                        Remark / Note (Optional)
                      </label>
                      <input
                        type="text"
                        value={specialNote}
                        onChange={(e) => setSpecialNote(e.target.value)}
                        placeholder="အခြား မှတ်ချက်..."
                        className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-semibold outline-none focus:border-[#123524]"
                      />
                    </div>
                  </div>

                  {/* Cash Received & Change Due (When Cash is selected) */}
                  {paymentMethod === 'Cash' ? (
                    <div className="bg-green-50/70 p-3 rounded-xl border border-green-200 grid grid-cols-2 gap-2.5 items-center">
                      <div>
                        <label className="block text-[10px] font-bold text-green-800 mb-1">
                          ပေးငွေ (Cash Received - Optional)
                        </label>
                        <input
                          type="number"
                          value={cashReceived}
                          onChange={(e) => setCashReceived(e.target.value)}
                          placeholder={finalTotal.toString()}
                          className="w-full p-2 bg-white border border-green-300 rounded-lg text-xs font-black text-[#123524]"
                        />
                      </div>
                      <div className="text-right">
                        <span className="text-[10px] font-bold text-green-700 block">ပြန်အမ်းငွေ (Change Due)</span>
                        <span className="text-base font-black text-green-800">{formatPrice(changeDue)}</span>
                      </div>
                    </div>
                  ) : (
                    /* Online Payment: Full Payment vs Deposit (စရံငွေ / ကျန်ငွေ ခွဲပြရန်) */
                    <div className="bg-yellow-50/70 p-3 rounded-xl border border-[#D4AF37]/40 space-y-2.5">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[11px] font-bold text-[#123524]">
                          {paymentMethod} ငွေလွှဲပုံစံ ရွေးချယ်ရန်:
                        </span>
                        <div className="flex bg-white p-0.5 rounded-lg border border-gray-200">
                          <button
                            type="button"
                            onClick={() => setOnlinePayMode('full')}
                            className={`px-2.5 py-1 rounded-md text-[10px] font-black transition ${
                              onlinePayMode === 'full'
                                ? 'bg-[#123524] text-[#D4AF37]'
                                : 'text-gray-600'
                            }`}
                          >
                            အပြည့်ချေ (Full Paid)
                          </button>
                          <button
                            type="button"
                            onClick={() => setOnlinePayMode('deposit')}
                            className={`px-2.5 py-1 rounded-md text-[10px] font-black transition ${
                              onlinePayMode === 'deposit'
                                ? 'bg-amber-500 text-white'
                                : 'text-gray-600'
                            }`}
                          >
                            စရံငွေသာလွှဲ (Deposit)
                          </button>
                        </div>
                      </div>

                      {onlinePayMode === 'deposit' && (
                        <div className="grid grid-cols-2 gap-2.5 items-center pt-1 border-t border-[#D4AF37]/30 animate-fade-in">
                          <div>
                            <label className="block text-[10px] font-bold text-amber-900 mb-1">
                              လွှဲထားသည့် စရံငွေ (Deposit Paid)
                            </label>
                            <input
                              type="number"
                              min={0}
                              max={finalTotal}
                              value={depositAmountStr}
                              onChange={(e) => setDepositAmountStr(e.target.value)}
                              placeholder="ဥပမာ - 10000"
                              className="w-full p-2 bg-white border border-amber-400 rounded-lg text-xs font-black text-[#123524]"
                            />
                          </div>
                          <div className="text-right">
                            <span className="text-[10px] font-bold text-red-600 block">
                              ကျန်ငွေ (Balance Due)
                            </span>
                            <span className="text-base font-black text-red-600">
                              {formatPrice(balanceDueNum)}
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div className="pt-2 flex justify-between gap-2.5">
                  <button
                    type="button"
                    onClick={() => setPosStep(3)}
                    className="px-4 py-3 rounded-xl font-bold text-xs bg-gray-100 text-gray-600"
                  >
                    ← Back
                  </button>
                  <button
                    type="button"
                    disabled={cart.length === 0 || savingSale}
                    onClick={handleCompleteSale}
                    className="flex-1 py-3.5 bg-gradient-to-r from-[#D4AF37] via-yellow-400 to-[#c59b27] text-[#123524] rounded-xl font-black text-xs uppercase tracking-wider shadow-lg hover:opacity-95 transition flex items-center justify-center"
                  >
                    <Printer className="w-4 h-4 mr-1.5" />
                    {savingSale ? 'Saving...' : `Complete & Print (${formatPrice(finalTotal)})`}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* RIGHT PANEL: STICKY CURRENT WALK-IN BILL (42% Width on Tablet - Always Visible Side-by-Side!) */}
          <div className="min-w-0 sticky top-14">
            <div
              ref={billCardRef}
              className={`bg-white rounded-2xl shadow-md border-2 transition-all duration-300 overflow-hidden ${
                isBillCardBouncing
                  ? 'pos-bill-bounce border-[#D4AF37] ring-4 ring-[#D4AF37]/30'
                  : 'border-[#D4AF37]/40'
              }`}
            >
              <div className="bg-gradient-to-r from-[#123524] to-[#1a4a32] p-3 text-white flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <ShoppingBag
                    className={`w-4 h-4 text-[#D4AF37] transition-transform duration-300 ${
                      isBillCardBouncing ? 'scale-125' : ''
                    }`}
                  />
                  <h3 className="font-bold text-xs sm:text-sm text-[#D4AF37] tracking-wide">
                    Current Walk-in Bill
                  </h3>
                  {totalItemsCount > 0 && (
                    <span
                      className={`bg-[#D4AF37] text-[#123524] text-[10px] font-black px-2 py-0.5 rounded-full shadow transition-transform duration-300 ${
                        isBillCardBouncing ? 'scale-125' : ''
                      }`}
                    >
                      {totalItemsCount}
                    </span>
                  )}
                </div>
                {cart.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setCart([])}
                    className="text-[10px] font-bold text-red-300 hover:text-red-200"
                  >
                    Clear All
                  </button>
                )}
              </div>

              <div
                ref={billListScrollRef}
                className="p-3 space-y-2 max-h-[45vh] overflow-y-auto divide-y divide-gray-100"
              >
                {cart.length === 0 ? (
                  <div className="py-10 text-center text-gray-400 text-[11px] font-bold leading-relaxed px-2">
                    ဝန်ဆောင်မှု သို့မဟုတ် Sale Item ရွေးချယ်ထားခြင်း မရှိသေးပါ။
                  </div>
                ) : (
                  cart.map((item) => {
                    const unitPrice = item.price + (item.isVvipUpgrade && item.vvipExtraPrice ? item.vvipExtraPrice : 0);
                    const isJustAdded = recentlyAddedItemId === item.cartId;
                    const isEligible =
                      item.discountEligible !== undefined ? item.discountEligible : !item.isCustomItem;

                    return (
                      <div
                        key={item.cartId}
                        className={`pt-2 first:pt-0 rounded-lg px-1.5 py-1 flex flex-col gap-1 transition-colors ${
                          isJustAdded ? 'pos-item-pop' : ''
                        }`}
                      >
                        <div className="flex justify-between items-start gap-1.5">
                          <div>
                            <div className="font-bold text-[11px] sm:text-xs text-gray-800 leading-snug">
                              {item.name}
                            </div>
                            {item.duration && <div className="text-[9px] text-gray-500">{item.duration}</div>}
                          </div>
                          <div className="font-black text-[11px] sm:text-xs text-[#123524] whitespace-nowrap">
                            {formatPrice(unitPrice * item.qty)}
                          </div>
                        </div>

                        <div className="flex items-center justify-between gap-1 mt-0.5 flex-wrap">
                          <div className="flex items-center gap-1 flex-wrap">
                            {!item.isCustomItem && item.vvipExtraPrice && item.vvipExtraPrice > 0 && !item.vvipIncluded ? (
                              <button
                                type="button"
                                onClick={() => toggleCartItemVvip(item.cartId)}
                                className={`px-1.5 py-0.5 rounded text-[9px] font-bold border flex items-center transition ${
                                  item.isVvipUpgrade
                                    ? 'bg-yellow-100 text-yellow-900 border-[#D4AF37]'
                                    : 'bg-gray-50 text-gray-500 border-gray-200'
                                }`}
                              >
                                <Crown className="w-2.5 h-2.5 mr-1 text-[#D4AF37]" />
                                VVIP (+{formatPrice(item.vvipExtraPrice)})
                              </button>
                            ) : item.vvipIncluded ? (
                              <span className="text-[9px] font-bold text-green-700 bg-green-50 px-1.5 py-0.5 rounded">
                                VVIP Included
                              </span>
                            ) : null}

                            {/* 🌟 Per-Item Discount Toggle Badge 🌟 */}
                            <button
                              type="button"
                              onClick={() => toggleCartItemDiscountEligible(item.cartId)}
                              title="Click to include or exclude this item from discount"
                              className={`px-1.5 py-0.5 rounded text-[9px] font-bold border flex items-center transition ${
                                isEligible
                                  ? 'bg-green-50 text-green-700 border-green-300'
                                  : 'bg-gray-100 text-gray-400 border-gray-200 line-through'
                              }`}
                            >
                              <Percent className="w-2.5 h-2.5 mr-0.5" />
                              {isEligible ? 'Disc ပါမည်' : 'No Disc'}
                            </button>
                          </div>

                          <div className="flex items-center gap-1.5 ml-auto">
                            <button
                              type="button"
                              onClick={() => updateCartQty(item.cartId, -1)}
                              className="w-5 h-5 rounded bg-gray-100 text-gray-700 font-black text-xs flex items-center justify-center hover:bg-red-100 hover:text-red-600"
                            >
                              -
                            </button>
                            <span className="text-[11px] font-black w-4 text-center">{item.qty}</span>
                            <button
                              type="button"
                              onClick={() => updateCartQty(item.cartId, 1)}
                              className="w-5 h-5 rounded bg-gray-100 text-gray-700 font-black text-xs flex items-center justify-center hover:bg-green-100 hover:text-green-700"
                            >
                              +
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              <div className="px-3 py-2 bg-gray-50 border-t border-gray-100 text-[10px] space-y-1">
                <div className="flex justify-between">
                  <span className="text-gray-500 font-semibold">Therapist:</span>
                  <span className="font-bold text-[#123524] truncate max-w-[140px]">
                    {therapist1 && therapist2
                      ? `${therapist1.name} & ${therapist2.name}`
                      : therapist1
                      ? therapist1.name
                      : 'Any Available'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500 font-semibold">Time & Status:</span>
                  <span className="font-bold text-gray-800">
                    {format12Hour(saleTime)} ({serviceStatus === 'in_progress' ? 'In Progress' : 'Completed'})
                  </span>
                </div>
              </div>

              <div className="p-3 bg-gradient-to-b from-yellow-50/50 to-white border-t border-gray-200 space-y-1.5">
                <div className="flex justify-between text-[11px] text-gray-600 font-semibold">
                  <span>Subtotal</span>
                  <span className="font-bold">{formatPrice(subTotal)}</span>
                </div>
                {discountAmount > 0 && (
                  <div className="flex justify-between text-[11px] text-green-700 font-bold">
                    <span className="truncate pr-2">Discount ({discountReason})</span>
                    <span className="whitespace-nowrap">-{formatPrice(discountAmount)}</span>
                  </div>
                )}
                <div className="flex justify-between items-center pt-1.5 border-t border-gray-200">
                  <span className="font-extrabold text-xs text-[#123524]">Net Total</span>
                  <span
                    className={`text-base sm:text-lg font-black text-[#123524] transition-transform duration-300 ${
                      isBillCardBouncing ? 'scale-110 text-green-800' : ''
                    }`}
                  >
                    {formatPrice(finalTotal)}
                  </span>
                </div>

                {/* Live Deposit & Balance Due Preview inside Current Walk-in Bill Card */}
                {isOnlinePaymentSelected && onlinePayMode === 'deposit' && finalTotal > 0 && (
                  <div className="p-2 rounded-lg bg-amber-50 border border-amber-200 text-[10px] space-y-0.5">
                    <div className="flex justify-between text-amber-900 font-bold">
                      <span>စရံငွေ ({paymentMethod}):</span>
                      <span>{formatPrice(depositPaidNum)}</span>
                    </div>
                    <div className="flex justify-between text-red-600 font-black">
                      <span>ကျန်ငွေ (Balance Due):</span>
                      <span>{formatPrice(balanceDueNum)}</span>
                    </div>
                  </div>
                )}

                {pointsEarned > 0 && (
                  <div className="text-[9px] text-right font-bold text-[#D4AF37]">
                    ★ +{pointsEarned} VIP Points ရရှိမည်
                  </div>
                )}

                <button
                  type="button"
                  disabled={cart.length === 0 || savingSale}
                  onClick={() => {
                    if (posStep < 4) setPosStep(4);
                    else handleCompleteSale();
                  }}
                  className="w-full mt-1.5 py-3 bg-gradient-to-r from-[#123524] to-[#1a4a32] text-[#D4AF37] rounded-xl font-black text-[11px] uppercase tracking-wider shadow-md disabled:opacity-50 hover:opacity-95 transition flex items-center justify-center"
                >
                  {posStep < 4 ? 'Proceed to Checkout →' : `Confirm & Print (${formatPrice(finalTotal)})`}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
