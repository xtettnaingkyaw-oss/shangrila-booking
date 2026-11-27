import React, { useState, useEffect, useMemo, useRef } from 'react';
import { collection, getDocs, updateDoc, deleteDoc, doc, getDoc, setDoc, writeBatch } from 'firebase/firestore';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import CryptoJS from 'crypto-js';
import {
  Settings,
  Trash2,
  KeyRound,
  AlertCircle,
  Save,
  PlusCircle,
  X,
  Copy,
  Crown,
  ChevronUp,
  ChevronDown,
  Download,
  ImageIcon,
  Sparkles,
  CreditCard,
  MapPin,
  Star,
  Award,
  Gift,
  Target,
  Search,
  CheckCircle,
  Clock,
  Users,
  Eye,
  EyeOff,
  Power,
  Globe,
  ShieldCheck,
  RefreshCw,
} from 'lucide-react';
import { db, secondaryAuth } from '../firebase';
import { encryptText, decryptText } from '../security';
import {
  AppData,
  AppBranding,
  PaymentMethod,
  compressImage,
  DEFAULT_VIP_SETTINGS,
  formatPrice,
} from '../shared';
import { DEFAULT_INSTALL_STEPS } from '../AppDataContext';

export interface SettingsInstallStep {
  id: string;
  text: string;
  imageUrl: string;
}

type SettingsSubTab = 'services' | 'therapists' | 'operations' | 'branding' | 'payments' | 'vip_security';
type VipSecuritySection = 'vip' | 'bonus' | 'install' | 'security';

interface ToastState {
  type: 'success' | 'error' | 'info';
  message: string;
}

interface ConfirmDialogState {
  title: string;
  message: string;
  confirmLabel: string;
  tone: 'danger' | 'primary';
  onConfirm: () => void | Promise<void>;
}

const DEFAULT_MENU_CATEGORIES = [
  {
    id: 'massage',
    title: 'Massage',
    order: 0,
    isHidden: false,
    items: [
      { id: 'm1', name: 'Myanmar Traditional Massage', duration: '60 Mins', price: 25000, vvipPrice: 35000, vvipIncluded: false, description: '', imageUrl: '', isHidden: false, isComingSoon: false },
      { id: 'm2', name: 'Myanmar Traditional Massage', duration: '90 Mins', price: 37000, vvipPrice: 52000, vvipIncluded: false, description: '', imageUrl: '', isHidden: false, isComingSoon: false },
      { id: 'm3', name: 'Oil Massage', duration: '60 Mins', price: 25000, vvipPrice: 35000, vvipIncluded: false, description: '', imageUrl: '', isHidden: false, isComingSoon: false },
      { id: 'm4', name: 'Oil Massage', duration: '90 Mins', price: 37000, vvipPrice: 52000, vvipIncluded: false, description: '', imageUrl: '', isHidden: false, isComingSoon: false },
      { id: 'm5', name: 'Aromatherapy Massage', duration: '60 Mins', price: 30000, vvipPrice: 40000, vvipIncluded: false, description: '', imageUrl: '', isHidden: false, isComingSoon: false },
      { id: 'm6', name: 'Aromatherapy Massage', duration: '90 Mins', price: 45000, vvipPrice: 60000, vvipIncluded: false, description: '', imageUrl: '', isHidden: false, isComingSoon: false },
      { id: 'm7', name: 'Body Butter Lotion Massage', duration: '60 Mins', price: 35000, vvipPrice: 45000, vvipIncluded: false, description: '', imageUrl: '', isHidden: false, isComingSoon: false },
      { id: 'm8', name: 'Body Butter Lotion Massage', duration: '90 Mins', price: 50000, vvipPrice: 67000, vvipIncluded: false, description: '', imageUrl: '', isHidden: false, isComingSoon: false },
      { id: 'm9', name: 'Body to Body Massage', duration: '60 Mins', price: 55000, vvipPrice: 0, vvipIncluded: true, description: 'VVIP Room Included', imageUrl: '', isHidden: false, isComingSoon: false },
      { id: 'm10', name: 'Body to Body Massage', duration: '90 Mins', price: 82000, vvipPrice: 0, vvipIncluded: true, description: 'VVIP Room Included', imageUrl: '', isHidden: false, isComingSoon: false },
      { id: 'm11', name: 'Four Hands Massage', duration: '60 Mins', price: 70000, vvipPrice: 0, vvipIncluded: true, description: 'VVIP Room Included', imageUrl: '', isHidden: false, isComingSoon: false },
      { id: 'm12', name: 'Four Hands Massage', duration: '90 Mins', price: 104000, vvipPrice: 0, vvipIncluded: true, description: 'VVIP Room Included', imageUrl: '', isHidden: false, isComingSoon: false },
      { id: 'm13', name: 'Lotion Candle Massage', duration: '60 Mins', price: 55000, vvipPrice: 0, vvipIncluded: true, description: 'VVIP Room Included', imageUrl: '', isHidden: false, isComingSoon: false },
      { id: 'm14', name: 'Lotion Candle Massage', duration: '90 Mins', price: 82000, vvipPrice: 0, vvipIncluded: true, description: 'VVIP Room Included', imageUrl: '', isHidden: false, isComingSoon: false },
    ],
  },
  {
    id: 'body_scrub',
    title: 'Body Scrub',
    order: 1,
    isHidden: false,
    items: [
      { id: 's1', name: 'Body Scrub & Bath Only', duration: '60 Mins', price: 70000, vvipPrice: 0, vvipIncluded: true, description: 'Scrub Options: Coffee | Aloe Vera | Tamarind | Milk | Vitamin C | Daily Shower Spa Salt', imageUrl: '', isHidden: false, isComingSoon: false },
      { id: 's2', name: 'Body Scrub & Lotion Massage', duration: '120 Mins', price: 80000, vvipPrice: 0, vvipIncluded: true, description: 'Scrub Options: Coffee | Aloe Vera | Tamarind | Milk | Vitamin C | Daily Shower Spa Salt', imageUrl: '', isHidden: false, isComingSoon: false },
    ],
  },
  {
    id: 'waxing',
    title: 'Waxing',
    order: 2,
    isHidden: false,
    items: [
      { id: 'w1', name: 'Arm Wax', duration: 'Session', price: 20000, vvipPrice: 0, vvipIncluded: false, description: '', imageUrl: '', isHidden: false, isComingSoon: false },
      { id: 'w2', name: 'Underarm Wax', duration: 'Session', price: 25000, vvipPrice: 0, vvipIncluded: false, description: '', imageUrl: '', isHidden: false, isComingSoon: false },
      { id: 'w3', name: 'Half Leg Wax', duration: 'Session', price: 30000, vvipPrice: 0, vvipIncluded: false, description: '', imageUrl: '', isHidden: false, isComingSoon: false },
      { id: 'w4', name: 'Full Leg Wax', duration: 'Session', price: 45000, vvipPrice: 0, vvipIncluded: false, description: '', imageUrl: '', isHidden: false, isComingSoon: false },
      { id: 'w5', name: 'Bikini Wax', duration: 'Session', price: 35000, vvipPrice: 0, vvipIncluded: false, description: '', imageUrl: '', isHidden: false, isComingSoon: false },
      { id: 'w6', name: 'Brazilian Wax', duration: 'Session', price: 50000, vvipPrice: 0, vvipIncluded: false, description: '', imageUrl: '', isHidden: false, isComingSoon: false },
    ],
  },
  {
    id: 'hotel_service',
    title: 'Hotel & Home Services',
    order: 3,
    isHidden: false,
    items: [
      { id: 'h1', name: 'Part Time Outcall Service', duration: '100 Mins', price: 70000, vvipPrice: 0, vvipIncluded: false, description: '', imageUrl: '', isHidden: false, isComingSoon: false },
      { id: 'h2', name: 'Half Day Service', duration: '6 Hrs', price: 100000, vvipPrice: 0, vvipIncluded: false, description: '6:00 AM to 12:00 PM OR 12:00 PM to 6:00 PM', imageUrl: '', isHidden: false, isComingSoon: false },
      { id: 'h3', name: 'The Whole Night Service', duration: '12 Hrs', price: 120000, vvipPrice: 0, vvipIncluded: false, description: '8:00 PM to 8:00 AM', imageUrl: '', isHidden: false, isComingSoon: false },
      { id: 'h4', name: 'The Whole Day Service', duration: '12 Hrs', price: 180000, vvipPrice: 0, vvipIncluded: false, description: '7:00 AM to 7:00 PM', imageUrl: '', isHidden: false, isComingSoon: false },
    ],
  },
];

const SUBTAB_STORAGE_KEY = 'shangrila_admin_settings_subtab';

const safeCopyText = async (text: string): Promise<boolean> => {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // fallback below
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

export function AdminSettingsWorkspace({
  appData,
  onSettingsUpdated,
}: {
  appData: AppData;
  onSettingsUpdated: (data: AppData) => void;
}) {
  const defaultVipConfig = {
    isActive: appData.vipSettings?.isActive ?? true,
    baseRuleText: appData.vipSettings?.baseRuleText || 'သုံးစွဲငွေ ၃၅,၀၀၀ ကျပ် လျှင် = ၁ ပွိုင့် (1 Point)',
    preJadeText:
      appData.vipSettings?.preJadeText ||
      'Jade Member မဖြစ်မီ (၅၀) ပွိုင့် စုဆောင်းနေစဉ်ကာလအတွင်း (၁)လ အတွင်း ပြည့်မီသော Points များအတွက် အထူး Discount ကို ထပ်ဆောင်းပေးအပ်ပါသည်။',
    preJadeRewards: appData.vipSettings?.preJadeRewards || [
      '10 Pts = 10% Off',
      '20 Pts = 20% Off',
      '30 Pts = 30% Off',
      '40 Pts = 40% Off',
      '50 Pts = 50% Off',
    ],
    cumulativeText:
      appData.vipSettings?.cumulativeText ||
      'Member အဆင့်များကို အဆင့်မြှင့်တင်ရာတွင် ပွိုင့်များကို သုညမှ ပြန်မစဘဲ ရှိပြီးသားပွိုင့်များအပေါ်တွင် ဆက်လက်ပေါင်းထည့်ပေးမည့် စနစ်ကို အသုံးပြုထားပါသည်။',
    instantUpgradeText:
      appData.vipSettings?.instantUpgradeText ||
      '(တစ်ကြိမ်တည်းဝယ်ယူမှုပြုလုပ်သူများအနေဖြင့် မိမိဝယ်ယူထားသည့်ငွေပမာဏအတိုင်း မိမိကြိုက်နှစ်သက်ရာ Service သို့မဟုတ် Package ကို မိမိဝယ်ယူထားသည့် Member အဆင့်ခံစားခွင့်နှင့်အညီ (၃)လအတွင်း ပြန်လည်သုံးစွဲနိုင်သည်။)',
    birthdayStandardText:
      appData.vipSettings?.birthdayStandardText ||
      'မည်သည့် VIP (Jade, Gold, Imperial) မဆို မိမိမွေးနေ့တွင် မည်သည့် Service ကိုမဆို 50% Discount ခံစားခွင့်ရရှိမည်။',
    birthdayImperialText:
      appData.vipSettings?.birthdayImperialText || 'အခြေခံ 20% + မွေးနေ့လတွင် ရရှိထားသော Points အရေအတွက် % ။',
    rules: appData.vipSettings?.rules || DEFAULT_VIP_SETTINGS.rules,
    tiers: appData.vipSettings?.tiers || DEFAULT_VIP_SETTINGS.tiers,
  };

  // Persist active sub-tab in sessionStorage
  const [activeSubTab, setActiveSubTab] = useState<SettingsSubTab>(() => {
    try {
      const saved = sessionStorage.getItem(SUBTAB_STORAGE_KEY) as SettingsSubTab | null;
      if (saved && ['services', 'therapists', 'operations', 'branding', 'payments', 'vip_security'].includes(saved)) {
        return saved;
      }
    } catch {
      // ignore storage restrictions
    }
    return 'services';
  });

  const handleSelectSubTab = (tab: SettingsSubTab) => {
    setActiveSubTab(tab);
    try {
      sessionStorage.setItem(SUBTAB_STORAGE_KEY, tab);
    } catch {
      // ignore
    }
  };

  // Inner switcher for Tab 6 (keeps mobile page clean & short)
  const [vipSecuritySection, setVipSecuritySection] = useState<VipSecuritySection>('vip');

  // Toast & In-App Confirm Dialog (replaces jarring window.alert & window.confirm)
  const [toast, setToast] = useState<ToastState | null>(null);
  const toastTimerRef = useRef<number | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialogState | null>(null);
  const [confirmBusy, setConfirmBusy] = useState(false);

  const showToast = (message: string, type: ToastState['type'] = 'success') => {
    setToast({ message, type });
    if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
    toastTimerRef.current = window.setTimeout(() => setToast(null), 3600);
  };

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
    };
  }, []);

  // Search, Filter & Accordion Expand States
  const [serviceSearch, setServiceSearch] = useState('');
  const [serviceFilterMode, setServiceFilterMode] = useState<'all' | 'active' | 'coming_soon' | 'hidden'>('all');
  const [selectedCategoryTabId, setSelectedCategoryTabId] = useState<string>('all');
  const [expandedServices, setExpandedServices] = useState<Record<string, boolean>>({});

  const [therapistSearch, setTherapistSearch] = useState('');
  const [therapistFilterMode, setTherapistFilterMode] = useState<'all' | 'active' | 'coming_soon' | 'hidden' | 'app_locked'>('all');
  const [expandedTherapists, setExpandedTherapists] = useState<Record<string, boolean>>({});
  const [revealedPasswords, setRevealedPasswords] = useState<Record<string, boolean>>({});

  // Unsaved-change dirty markers per section
  const [dirtyCategories, setDirtyCategories] = useState<Record<string, boolean>>({});
  const [dirtyTherapists, setDirtyTherapists] = useState(false);
  const [dirtyOperations, setDirtyOperations] = useState(false);
  const [dirtyBranding, setDirtyBranding] = useState(false);
  const [dirtyPayments, setDirtyPayments] = useState(false);
  const [dirtyVip, setDirtyVip] = useState(false);
  const [dirtyBonus, setDirtyBonus] = useState(false);
  const [dirtyInstallSteps, setDirtyInstallSteps] = useState(false);

  // Global Spa Operations & Online Booking Control State
  const [spaOperations, setSpaOperations] = useState<any>(() => ({
    isOnlineBookingOpen: (appData as any)?.spaOperations?.isOnlineBookingOpen ?? true,
    maintenanceTitle: (appData as any)?.spaOperations?.maintenanceTitle || 'Online Booking ခေတ္တပိတ်ထားပါသည်',
    maintenanceMessage:
      (appData as any)?.spaOperations?.maintenanceMessage ||
      'လက်ရှိတွင် ဆိုင်ဝန်ဆောင်မှု အချိန်ဇယားများ ပြည့်နေပါသဖြင့် Online Booking ခေတ္တပိတ်ထားပါသည်ခင်ဗျာ။ အရေးပေါ် ရက်ချိန်းရယူလိုပါက ဖုန်း သို့မဟုတ် Telegram သို့ တိုက်ရိုက်ဆက်သွယ်နိုင်ပါသည်။',
    openingTime: (appData as any)?.spaOperations?.openingTime || '10:00 AM',
    closingTime: (appData as any)?.spaOperations?.closingTime || '11:00 PM',
    leadTimeMins: Number((appData as any)?.spaOperations?.leadTimeMins) || 30,
    announcementBanner: (appData as any)?.spaOperations?.announcementBanner || '',
    isAnnouncementActive: Boolean((appData as any)?.spaOperations?.isAnnouncementActive),
  }));

  const [localTherapists, setLocalTherapists] = useState<any[]>(() => {
    return (appData.therapists || []).map((t: any) => ({
      ...t,
      password: decryptText(t.password) || t.password || '',
      visibilityStatus: t.visibilityStatus || (t.isHidden ? 'hidden' : t.isComingSoon ? 'coming_soon' : 'active'),
      comingSoonText: t.comingSoonText || 'Coming Soon .. Booking လက်မခံသေးပါ',
      staffAppAccess: t.staffAppAccess !== false,
    }));
  });

  useEffect(() => {
    const fetchTherapists = async () => {
      try {
        const snap = await getDocs(collection(db, 'therapists'));
        const arr: any[] = [];
        snap.forEach((d) => {
          const data = d.data();
          if (!data.name || data.name.trim() === '') {
            deleteDoc(doc(db, 'therapists', d.id)).catch(() => {});
          } else {
            arr.push({
              id: d.id,
              ...data,
              password: decryptText(data.password) || data.password || '',
              visibilityStatus: data.visibilityStatus || (data.isHidden ? 'hidden' : data.isComingSoon ? 'coming_soon' : 'active'),
              comingSoonText: data.comingSoonText || 'Coming Soon .. Booking လက်မခံသေးပါ',
              staffAppAccess: data.staffAppAccess !== false,
            });
          }
        });
        arr.sort((a, b) => (a.order || 0) - (b.order || 0));
        setLocalTherapists(arr);
      } catch (e) {
        console.error('Error loading therapists:', e);
      }
    };
    fetchTherapists();
  }, []);

  const [localCategories, setLocalCategories] = useState<any[]>(() => {
    if (appData.categories && appData.categories.length > 0) {
      return appData.categories;
    }
    return DEFAULT_MENU_CATEGORIES;
  });

  // Fetch categories once on mount (prevents clobbering unsaved local edits when other settings save)
  const categoriesHydratedRef = useRef(false);
  useEffect(() => {
    if (categoriesHydratedRef.current) return;
    categoriesHydratedRef.current = true;
    const fetchAndSyncCategories = async () => {
      try {
        const snap = await getDocs(collection(db, 'categories'));
        const arr: any[] = [];
        snap.forEach((d) => arr.push({ docId: d.id, ...d.data() }));

        if (arr.length > 0) {
          arr.sort((a, b) => (a.order || 0) - (b.order || 0));
          setLocalCategories(arr);
        } else if (!appData.categories || appData.categories.length === 0) {
          const batch = writeBatch(db);
          DEFAULT_MENU_CATEGORIES.forEach((cat, idx) => {
            batch.set(doc(db, 'categories', cat.id), { ...cat, order: idx });
          });
          batch.set(doc(db, 'settings', 'appData'), { categories: DEFAULT_MENU_CATEGORIES }, { merge: true });
          await batch.commit();
          setLocalCategories(DEFAULT_MENU_CATEGORIES);
        }
      } catch (e) {
        console.error('Error loading categories:', e);
      }
    };
    fetchAndSyncCategories();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [localBranding, setLocalBranding] = useState<AppBranding>(
    JSON.parse(
      JSON.stringify(
        appData.branding || {
          logoUrl: '',
          address: '',
          phone1: '',
          phone2: '',
          telegram: '',
          viber: '',
          copyright: '',
          name: '',
          shopLat: 0,
          shopLng: 0,
        }
      )
    )
  );
  const [localPaymentMethods, setLocalPaymentMethods] = useState<PaymentMethod[]>(
    JSON.parse(JSON.stringify(appData.paymentMethods || []))
  );
  const [localSignUpBonus, setLocalSignUpBonus] = useState<any>(
    JSON.parse(JSON.stringify(appData.signUpBonus || { isActive: false, points: 5, startDate: '', endDate: '' }))
  );
  const [localInstallSteps, setLocalInstallSteps] = useState<SettingsInstallStep[]>(DEFAULT_INSTALL_STEPS);
  const [localVipSettings, setLocalVipSettings] = useState<any>(defaultVipConfig);

  const [deletedTherapistIds, setDeletedTherapistIds] = useState<string[]>([]);
  const [savingCategory, setSavingCategory] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState<string | null>(null);
  const [gettingGps, setGettingGps] = useState(false);

  const [newSecretKey, setNewSecretKey] = useState('');
  const [migratingKey, setMigratingKey] = useState(false);

  useEffect(() => {
    const fetchExtraSettings = async () => {
      try {
        const snap = await getDoc(doc(db, 'settings', 'appData'));
        if (snap.exists()) {
          const d = snap.data();
          if (d.installSteps) setLocalInstallSteps(d.installSteps);
          if (d.spaOperations) setSpaOperations((prev: any) => ({ ...prev, ...d.spaOperations }));
        }
      } catch (e) {
        console.error(e);
      }
    };
    fetchExtraSettings();
  }, []);

  // Live KPI Metrics
  const kpiMetrics = useMemo(() => {
    let totalServices = 0;
    let activeServices = 0;
    let comingSoonServices = 0;
    let hiddenServices = 0;

    localCategories.forEach((cat: any) => {
      const catHidden = Boolean(cat.isHidden);
      (cat.items || []).forEach((it: any) => {
        totalServices++;
        if (catHidden || it.isHidden) hiddenServices++;
        else if (it.isComingSoon) comingSoonServices++;
        else activeServices++;
      });
    });

    const totalStaff = localTherapists.length;
    const activeStaff = localTherapists.filter((t: any) => (t.visibilityStatus || 'active') === 'active').length;
    const comingSoonStaff = localTherapists.filter((t: any) => t.visibilityStatus === 'coming_soon').length;
    const hiddenStaff = localTherapists.filter((t: any) => t.visibilityStatus === 'hidden').length;
    const appAllowedStaff = localTherapists.filter((t: any) => t.staffAppAccess !== false).length;

    return {
      totalServices,
      activeServices,
      comingSoonServices,
      hiddenServices,
      totalStaff,
      activeStaff,
      comingSoonStaff,
      hiddenStaff,
      appAllowedStaff,
    };
  }, [localCategories, localTherapists]);

  const anyDirtyServices = Object.values(dirtyCategories).some(Boolean);
  const anyDirtyVipSecurity = dirtyVip || dirtyBonus || dirtyInstallSteps;

  // =========================================================================
  // FIRESTORE PERSISTENCE HANDLERS
  // =========================================================================

  const handleForceFixCategories = () => {
    setConfirmDialog({
      title: 'Reset Default Spa Menu?',
      message: 'Menu အဟောင်းများကိုဖျက်၍ မူလ Default Service စာရင်းအတိုင်း အသစ်ပြန်လည်ထည့်သွင်းမည် သေချာပါသလား?',
      confirmLabel: 'Reset Menu Now',
      tone: 'danger',
      onConfirm: async () => {
        setSavingCategory('force_fix');
        try {
          const batch = writeBatch(db);
          const snap = await getDocs(collection(db, 'categories'));
          snap.forEach((d) => batch.delete(doc(db, 'categories', d.id)));
          DEFAULT_MENU_CATEGORIES.forEach((cat, idx) => {
            batch.set(doc(db, 'categories', cat.id), { ...cat, order: idx });
          });
          batch.set(doc(db, 'settings', 'appData'), { categories: DEFAULT_MENU_CATEGORIES }, { merge: true });
          await batch.commit();
          setLocalCategories(DEFAULT_MENU_CATEGORIES);
          setDirtyCategories({});
          onSettingsUpdated({ ...appData, categories: DEFAULT_MENU_CATEGORIES });
          showToast('Menu အားလုံးကို မူလအတိုင်း အောင်မြင်စွာ ပြန်လည်ပြင်ဆင်ပြီးပါပြီ။', 'success');
        } catch (e) {
          console.error(e);
          showToast('Menu Reset လုပ်ရာတွင် Error ဖြစ်နေပါသည်။', 'error');
        } finally {
          setSavingCategory(null);
        }
      },
    });
  };

  const handleSaveCategory = async (cIdx: number, silent = false, overrideCategories?: any[]) => {
    const targetCats = overrideCategories || localCategories;
    const cat = targetCats[cIdx];
    if (!cat) return;

    setSavingCategory(cat.id);
    try {
      const cleanItems = (cat.items || []).map((item: any) => {
        let imgs = Array.isArray(item.images) ? item.images : item.imageUrl ? [item.imageUrl] : [];
        imgs = imgs.filter(Boolean);

        return {
          id: String(item.id || Date.now()),
          name: String(item.name || ''),
          duration: String(item.duration || ''),
          price: Number(item.price) || 0,
          vvipPrice: Number(item.vvipPrice) || 0,
          vvipIncluded: Boolean(item.vvipIncluded),
          description: String(item.description || ''),
          images: imgs,
          isHidden: Boolean(item.isHidden),
          isComingSoon: Boolean(item.isComingSoon),
          comingSoonText: String(item.comingSoonText || 'Coming Soon .. Booking လက်မခံသေးပါ'),
        };
      });

      const categoryToSave = {
        id: String(cat.id),
        title: String(cat.title),
        order: Number(cIdx),
        isHidden: Boolean(cat.isHidden),
        items: cleanItems,
      };

      const payloadSizeKB = Math.round(JSON.stringify(categoryToSave).length / 1024);
      if (payloadSizeKB > 900) {
        showToast(`ပုံများ များလွန်းသဖြင့် Document Size (${payloadSizeKB} KB) ကြီးနေပါသည်။ ပုံအချို့ဖျက်ပြီး ပြန်သိမ်းပါ။`, 'error');
        setSavingCategory(null);
        return;
      }

      await setDoc(doc(db, 'categories', cat.id), categoryToSave, { merge: true });

      const nextCategories = [...targetCats];
      nextCategories[cIdx] = categoryToSave;
      setLocalCategories(nextCategories);
      setDirtyCategories((prev) => ({ ...prev, [cat.id]: false }));

      const leanCategoriesForGlobal = nextCategories.map((c) => ({
        ...c,
        isHidden: Boolean(c.isHidden),
        items: (c.items || []).map((i: any) => ({
          ...i,
          images: [],
          imageUrl: '',
          isHidden: Boolean(i.isHidden),
          isComingSoon: Boolean(i.isComingSoon),
          comingSoonText: String(i.comingSoonText || 'Coming Soon .. Booking လက်မခံသေးပါ'),
        })),
      }));

      await setDoc(doc(db, 'settings', 'appData'), { categories: leanCategoriesForGlobal }, { merge: true });
      onSettingsUpdated({ ...appData, categories: leanCategoriesForGlobal });

      if (!silent) {
        showToast(`"${cat.title}" Category ကို အောင်မြင်စွာ သိမ်းဆည်းပြီးပါပြီ။`, 'success');
      }
    } catch (e: any) {
      console.error('Service Category Save Error:', e);
      showToast(`Save error: ${e?.code || e?.message || 'Unknown Firebase error'}`, 'error');
    } finally {
      setSavingCategory(null);
    }
  };

  const handleQuickServiceStatusChange = async (
    cIdx: number,
    iIdx: number,
    mode: 'active' | 'coming_soon' | 'hidden'
  ) => {
    const updated = localCategories.map((c, idx) =>
      idx === cIdx ? { ...c, items: [...(c.items || [])] } : c
    );
    const targetItem = { ...updated[cIdx].items[iIdx] };
    if (mode === 'active') {
      targetItem.isHidden = false;
      targetItem.isComingSoon = false;
    } else if (mode === 'coming_soon') {
      targetItem.isHidden = false;
      targetItem.isComingSoon = true;
      targetItem.comingSoonText = targetItem.comingSoonText || 'Coming Soon .. Booking လက်မခံသေးပါ';
    } else {
      targetItem.isHidden = true;
      targetItem.isComingSoon = false;
    }
    updated[cIdx].items[iIdx] = targetItem;
    setLocalCategories(updated);
    await handleSaveCategory(cIdx, true, updated);
    const labelMap = { active: 'Active (ပြမည်)', coming_soon: 'Coming Soon', hidden: 'Hidden (ဖျောက်ထားမည်)' };
    showToast(`"${targetItem.name}" → ${labelMap[mode]} သတ်မှတ်ပြီးပါပြီ`, 'success');
  };

  const handleToggleCategoryHidden = async (cIdx: number) => {
    const updated = [...localCategories];
    const nextHidden = !updated[cIdx].isHidden;
    updated[cIdx] = { ...updated[cIdx], isHidden: nextHidden };
    setLocalCategories(updated);
    await handleSaveCategory(cIdx, true, updated);
    showToast(
      nextHidden
        ? `"${updated[cIdx].title}" Category ကို Customer App တွင် ဖျောက်ထားပြီးပါပြီ`
        : `"${updated[cIdx].title}" Category ကို Customer App တွင် ပြန်ဖွင့်ပြီးပါပြီ`,
      'success'
    );
  };

  const handleQuickTherapistVisibility = async (
    tIdx: number,
    nextStatus: 'active' | 'coming_soon' | 'hidden'
  ) => {
    const prevSnapshot = localTherapists[tIdx];
    const updated = [...localTherapists];
    const target = {
      ...updated[tIdx],
      visibilityStatus: nextStatus,
      isHidden: nextStatus === 'hidden',
      isComingSoon: nextStatus === 'coming_soon',
      comingSoonText: updated[tIdx].comingSoonText || 'Coming Soon .. Booking လက်မခံသေးပါ',
    };
    updated[tIdx] = target;
    setLocalTherapists(updated);

    if (target.id && !target.id.startsWith('new_') && !target.id.startsWith('t_')) {
      try {
        await updateDoc(doc(db, 'therapists', target.id), {
          visibilityStatus: nextStatus,
          isHidden: nextStatus === 'hidden',
          isComingSoon: nextStatus === 'coming_soon',
          comingSoonText: target.comingSoonText,
        });
        const labelMap = { active: 'Active', coming_soon: 'Coming Soon', hidden: 'Hidden' };
        showToast(`${target.name} → ${labelMap[nextStatus]} ပြောင်းလဲပြီးပါပြီ`, 'success');
      } catch (e) {
        console.warn('Instant visibility update error:', e);
        const rolledBack = [...updated];
        rolledBack[tIdx] = prevSnapshot;
        setLocalTherapists(rolledBack);
        showToast('Visibility ပြောင်းလဲရာတွင် Error ဖြစ်နေပါသည်။', 'error');
      }
    } else {
      setDirtyTherapists(true);
    }
  };

  const handleToggleStaffAppAccess = (tIdx: number) => {
    const target = localTherapists[tIdx];
    const currentAccess = target.staffAppAccess !== false;
    const nextAccess = !currentAccess;

    setConfirmDialog({
      title: nextAccess ? 'Staff Portal ပြန်ဖွင့်ပေးမည်လား?' : 'Staff Portal ပိတ်၍ Auto Logout လုပ်မည်လား?',
      message: nextAccess
        ? `${target.name} အား Staff App သို့ ဝင်ရောက်အသုံးပြုခွင့် ပြန်ဖွင့်ပေးမည် သေချာပါသလား?`
        : `${target.name} ၏ Staff App အသုံးပြုခွင့်ကို ပိတ်လိုက်ပါက လက်ရှိ ဝင်သုံးနေသော ဖုန်း/Device မှ ချက်ချင်း Auto Log Out ဖြစ်သွားပါမည်။`,
      confirmLabel: nextAccess ? 'ပြန်ဖွင့်ပေးမည်' : 'ပိတ်မည် (Auto Logout)',
      tone: nextAccess ? 'primary' : 'danger',
      onConfirm: async () => {
        const forceLogoutTimestamp = !nextAccess ? Date.now() : target.forceLogoutAt || 0;
        const updated = [...localTherapists];
        updated[tIdx] = {
          ...target,
          staffAppAccess: nextAccess,
          forceLogoutAt: forceLogoutTimestamp,
        };
        setLocalTherapists(updated);

        if (target.id && !target.id.startsWith('new_') && !target.id.startsWith('t_')) {
          try {
            await updateDoc(doc(db, 'therapists', target.id), {
              staffAppAccess: nextAccess,
              forceLogoutAt: forceLogoutTimestamp,
            });
            showToast(
              nextAccess
                ? `${target.name} အား Staff App အသုံးပြုခွင့် ပြန်ဖွင့်ပေးပြီးပါပြီ။`
                : `${target.name} ၏ Staff App ကို ပိတ်၍ Auto Log Out ပြုလုပ်ပြီးပါပြီ။`,
              'success'
            );
          } catch (e) {
            showToast('Staff App Access ပြောင်းလဲရာတွင် Error ဖြစ်နေပါသည်။', 'error');
          }
        } else {
          setDirtyTherapists(true);
        }
      },
    });
  };

  const handleSaveTherapists = async () => {
    const hasEmptyName = localTherapists.some((t) => !t.name || !String(t.name).trim());
    if (hasEmptyName) {
      showToast('ဝန်ထမ်းအမည် အလွတ်မထားဘဲ ဖြည့်သွင်းပေးပါ။', 'error');
      return;
    }

    setSavingCategory('therapists');
    try {
      const batch = writeBatch(db);

      deletedTherapistIds.forEach((id) => {
        if (id) batch.delete(doc(db, 'therapists', id));
      });

      const uniqueTherapistsMap = new Map();
      for (const t of localTherapists) {
        const trimmedName = String(t.name).trim();
        if (uniqueTherapistsMap.has(trimmedName)) {
          if (!t.id.startsWith('t_') && !t.id.startsWith('new_')) {
            uniqueTherapistsMap.set(trimmedName, { ...t, name: trimmedName });
          }
        } else {
          uniqueTherapistsMap.set(trimmedName, { ...t, name: trimmedName });
        }
      }
      const cleanTherapists = Array.from(uniqueTherapistsMap.values());
      const finalTherapistsToSync: any[] = [];

      for (let i = 0; i < cleanTherapists.length; i++) {
        const t = cleanTherapists[i];
        const isNew = t.id.startsWith('new_') || t.id.startsWith('t_');
        const finalId = isNew ? `therapist_${Date.now()}_${i}` : t.id;
        const tRef = doc(db, 'therapists', finalId);

        const rawPwd = String(t.password || '').trim();
        const isPlaceholderPwd = !rawPwd || rawPwd === 'SECURED_ACCOUNT';

        if (!isPlaceholderPwd && rawPwd.length >= 6 && isNew) {
          try {
            await createUserWithEmailAndPassword(secondaryAuth, `${finalId.toLowerCase()}@shangrila.com`, rawPwd);
          } catch {
            // already exists or handled separately
          }
        }

        const visStatus = t.visibilityStatus || 'active';
        // Avoid double-encrypting the literal "SECURED_ACCOUNT" sentinel string
        const persistedPassword = isNew
          ? 'SECURED_ACCOUNT'
          : isPlaceholderPwd
          ? 'SECURED_ACCOUNT'
          : encryptText(rawPwd);

        const updatedT = JSON.parse(
          JSON.stringify({
            ...t,
            id: finalId,
            order: i,
            password: persistedPassword,
            visibilityStatus: visStatus,
            isHidden: visStatus === 'hidden',
            isComingSoon: visStatus === 'coming_soon',
            comingSoonText: t.comingSoonText || 'Coming Soon .. Booking လက်မခံသေးပါ',
            staffAppAccess: t.staffAppAccess !== false,
            forceLogoutAt: t.forceLogoutAt || 0,
          })
        );

        batch.set(tRef, updatedT, { merge: true });
        finalTherapistsToSync.push({
          ...updatedT,
          password: isPlaceholderPwd ? 'SECURED_ACCOUNT' : rawPwd,
        });
      }

      batch.set(doc(db, 'settings', 'appData'), { therapists: [] }, { merge: true });
      await batch.commit();

      setLocalTherapists(finalTherapistsToSync);
      setDeletedTherapistIds([]);
      setDirtyTherapists(false);
      onSettingsUpdated({ ...appData, therapists: finalTherapistsToSync });
      showToast('ဝန်ထမ်းစာရင်းနှင့် Staff App သတ်မှတ်ချက်များအားလုံး သိမ်းဆည်းပြီးပါပြီ။', 'success');
    } catch (error: any) {
      console.error(error);
      showToast('Error saving therapists: ' + (error?.message || 'Unknown error'), 'error');
    } finally {
      setSavingCategory(null);
    }
  };

  const handleSaveSpaOperations = async () => {
    setSavingCategory('spa_operations');
    try {
      await setDoc(doc(db, 'settings', 'appData'), { spaOperations }, { merge: true });
      onSettingsUpdated({ ...appData, spaOperations } as any);
      setDirtyOperations(false);
      showToast('Online Booking နှင့် ဆိုင်ဖွင့်ချိန် သတ်မှတ်ချက်များ သိမ်းဆည်းပြီးပါပြီ။', 'success');
    } catch {
      showToast('Operations settings သိမ်းဆည်းရာတွင် Error ဖြစ်နေပါသည်။', 'error');
    } finally {
      setSavingCategory(null);
    }
  };

  const handleSaveBranding = async () => {
    setSavingCategory('branding');
    try {
      await setDoc(doc(db, 'settings', 'appData'), { branding: localBranding }, { merge: true });
      onSettingsUpdated({ ...appData, branding: localBranding });
      setDirtyBranding(false);
      showToast('Branding နှင့် GPS အချက်အလက်များ သိမ်းဆည်းပြီးပါပြီ။', 'success');
    } catch {
      showToast('Branding သိမ်းဆည်းရာတွင် Error ဖြစ်နေပါသည်။', 'error');
    } finally {
      setSavingCategory(null);
    }
  };

  const handleSavePayments = async () => {
    setSavingCategory('payments');
    try {
      await setDoc(doc(db, 'settings', 'appData'), { paymentMethods: localPaymentMethods }, { merge: true });
      onSettingsUpdated({ ...appData, paymentMethods: localPaymentMethods });
      setDirtyPayments(false);
      showToast('Payment Gateways များကို အောင်မြင်စွာ သိမ်းဆည်းပြီးပါပြီ။', 'success');
    } catch {
      showToast('Payment Gateways သိမ်းဆည်းရာတွင် Error ဖြစ်နေပါသည်။', 'error');
    } finally {
      setSavingCategory(null);
    }
  };

  const handleSaveVipSettings = async () => {
    setSavingCategory('vip_settings');
    try {
      await setDoc(doc(db, 'settings', 'appData'), { vipSettings: localVipSettings }, { merge: true });
      onSettingsUpdated({ ...appData, vipSettings: localVipSettings });
      setDirtyVip(false);
      showToast('VIP Membership Program ကို အောင်မြင်စွာ သိမ်းဆည်းပြီးပါပြီ။', 'success');
    } catch {
      showToast('VIP Program သိမ်းဆည်းရာတွင် Error ဖြစ်နေပါသည်။', 'error');
    } finally {
      setSavingCategory(null);
    }
  };

  const handleSaveSignUpBonus = async () => {
    setSavingCategory('signup_bonus');
    try {
      await setDoc(doc(db, 'settings', 'appData'), { signUpBonus: localSignUpBonus }, { merge: true });
      onSettingsUpdated({ ...appData, signUpBonus: localSignUpBonus });
      setDirtyBonus(false);
      showToast('Welcome Bonus သတ်မှတ်ချက်များ သိမ်းဆည်းပြီးပါပြီ။', 'success');
    } catch {
      showToast('Welcome Bonus သိမ်းဆည်းရာတွင် Error ဖြစ်နေပါသည်။', 'error');
    } finally {
      setSavingCategory(null);
    }
  };

  const handleSaveInstallSteps = async () => {
    setSavingCategory('install_steps');
    try {
      await setDoc(doc(db, 'settings', 'appData'), { installSteps: localInstallSteps }, { merge: true });
      onSettingsUpdated({ ...appData, installSteps: localInstallSteps });
      setDirtyInstallSteps(false);
      showToast('PWA Install Guide အဆင့်များ သိမ်းဆည်းပြီးပါပြီ။', 'success');
    } catch {
      showToast('Install Guide သိမ်းဆည်းရာတွင် Error ဖြစ်နေပါသည်။', 'error');
    } finally {
      setSavingCategory(null);
    }
  };

  const handleChangeSecretKey = () => {
    if (!newSecretKey.trim()) {
      showToast('Key အသစ် ရိုက်ထည့်ပေးပါ။', 'error');
      return;
    }
    if (newSecretKey.trim().length < 10) {
      showToast('Key အသစ်သည် အနည်းဆုံး စာလုံး ၁၀ လုံးရှိရပါမည်။', 'error');
      return;
    }

    setConfirmDialog({
      title: 'AES-256 Encryption Key ပြောင်းလဲမည်လား?',
      message:
        'သတိပြုရန်: Database တစ်ခုလုံးရှိ Users, Bookings, Admins နှင့် Therapists Data များကို Key အသစ်ဖြင့် Re-Encrypt လုပ်မည်ဖြစ်ပါသည်။ ပြီးပါက Environment Variables (VITE_SECRET_KEY) တွင်ပါ ပြောင်းထည့်၍ Redeploy လုပ်ရပါမည်။',
      confirmLabel: 'Rotate Key Now',
      tone: 'danger',
      onConfirm: async () => {
        setMigratingKey(true);
        try {
          const targetKey = newSecretKey.trim();
          const reEncrypt = (oldCipher: string) => {
            if (!oldCipher || !oldCipher.startsWith('U2FsdGVk')) return oldCipher;
            try {
              const bytes = CryptoJS.AES.decrypt(oldCipher, import.meta.env.VITE_SECRET_KEY);
              const originalText = bytes.toString(CryptoJS.enc.Utf8);
              if (!originalText) return oldCipher;
              return CryptoJS.AES.encrypt(originalText, targetKey).toString();
            } catch {
              return oldCipher;
            }
          };

          const uSnap = await getDocs(collection(db, 'users'));
          const uPromises: Promise<void>[] = [];
          uSnap.forEach((d) => {
            const raw = d.data();
            uPromises.push(
              updateDoc(doc(db, 'users', d.id), {
                name: reEncrypt(raw.name),
                phone: reEncrypt(raw.phone),
                password: reEncrypt(raw.password),
                points: reEncrypt(raw.points),
                dob: reEncrypt(raw.dob),
              })
            );
          });
          await Promise.all(uPromises);

          const bSnap = await getDocs(collection(db, 'bookings'));
          const bPromises: Promise<void>[] = [];
          bSnap.forEach((d) => {
            const raw = d.data();
            bPromises.push(
              updateDoc(doc(db, 'bookings', d.id), {
                name: reEncrypt(raw.name),
                phone: reEncrypt(raw.phone),
                txId: reEncrypt(raw.txId),
                specialRequest: reEncrypt(raw.specialRequest),
              })
            );
          });
          await Promise.all(bPromises);

          const aSnap = await getDocs(collection(db, 'admins'));
          const aPromises: Promise<void>[] = [];
          aSnap.forEach((d) => {
            const raw = d.data();
            aPromises.push(
              updateDoc(doc(db, 'admins', d.id), {
                username: reEncrypt(raw.username),
                password: reEncrypt(raw.password),
              })
            );
          });
          await Promise.all(aPromises);

          const tPromises: Promise<void>[] = [];
          localTherapists.forEach((t) => {
            if (t.password && t.password !== 'SECURED_ACCOUNT') {
              tPromises.push(
                updateDoc(doc(db, 'therapists', t.id), {
                  password: CryptoJS.AES.encrypt(t.password, targetKey).toString(),
                })
              );
            }
          });
          await Promise.all(tPromises);

          setNewSecretKey('');
          showToast('Data အားလုံးကို Key အသစ်ဖြင့် ပြောင်းလဲပြီးပါပြီ။ Vercel တွင် Key အသစ်ထည့်၍ Redeploy လုပ်ပါ။', 'success');
        } catch (e) {
          console.error(e);
          showToast('Key Rotation လုပ်ရာတွင် Error ဖြစ်နေပါသည်။', 'error');
        } finally {
          setMigratingKey(false);
        }
      },
    });
  };

  // =========================================================================
  // IMAGE UPLOAD & LIST MUTATION HELPERS
  // =========================================================================

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingImage('logo');
    try {
      const base64 = await compressImage(file, 300, 300);
      setLocalBranding({ ...localBranding, logoUrl: base64 });
      setDirtyBranding(true);
    } catch {
      showToast('Logo တင်ရာတွင် Error ဖြစ်နေပါသည်။', 'error');
    } finally {
      setUploadingImage(null);
    }
  };

  const handlePaymentLogoUpload = async (idx: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingImage(`pay_${idx}`);
    try {
      const base64 = await compressImage(file, 200, 200);
      const updated = [...localPaymentMethods];
      updated[idx] = { ...updated[idx], logoUrl: base64 };
      setLocalPaymentMethods(updated);
      setDirtyPayments(true);
    } catch {
      showToast('Payment Logo တင်ရာတွင် Error ဖြစ်နေပါသည်။', 'error');
    } finally {
      setUploadingImage(null);
    }
  };

  const handleInstallImageUpload = async (idx: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingImage(`install_${idx}`);
    try {
      const base64 = await compressImage(file, 300, 600);
      const updated = [...localInstallSteps];
      updated[idx] = { ...updated[idx], imageUrl: base64 };
      setLocalInstallSteps(updated);
      setDirtyInstallSteps(true);
    } catch {
      showToast('Image တင်ရာတွင် Error ဖြစ်နေပါသည်။', 'error');
    } finally {
      setUploadingImage(null);
    }
  };

  const handleServiceImageUpload = async (cIdx: number, iIdx: number, files: FileList | null) => {
    if (!files || files.length === 0) return;

    const category = localCategories[cIdx];
    const item = category.items[iIdx];
    const currentImages = Array.isArray(item.images) ? item.images : item.imageUrl ? [item.imageUrl] : [];

    if (currentImages.length + files.length > 5) {
      showToast('Service တစ်ခုလျှင် အများဆုံး ပုံ (၅) ပုံသာ တင်နိုင်ပါသည်။', 'error');
      return;
    }

    setUploadingImage(`service_${cIdx}_${iIdx}`);
    const newUrls: string[] = [];

    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const base64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = (ev) => {
            const img = new Image();
            img.onload = () => {
              const canvas = document.createElement('canvas');
              const MAX_DIM = 600;
              let w = img.width;
              let h = img.height;
              if (w > h) {
                if (w > MAX_DIM) {
                  h *= MAX_DIM / w;
                  w = MAX_DIM;
                }
              } else {
                if (h > MAX_DIM) {
                  w *= MAX_DIM / h;
                  h = MAX_DIM;
                }
              }
              canvas.width = Math.round(w);
              canvas.height = Math.round(h);
              const ctx = canvas.getContext('2d');
              if (ctx) {
                ctx.fillStyle = '#FFF';
                ctx.fillRect(0, 0, canvas.width, canvas.height);
                ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                resolve(canvas.toDataURL('image/jpeg', 0.65));
              } else {
                resolve(ev.target?.result as string);
              }
            };
            img.onerror = reject;
            img.src = ev.target?.result as string;
          };
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });
        newUrls.push(base64);
      }

      const updated = localCategories.map((c, idx) =>
        idx === cIdx ? { ...c, items: [...(c.items || [])] } : c
      );
      updated[cIdx].items[iIdx] = { ...item, images: [...currentImages, ...newUrls] };
      delete updated[cIdx].items[iIdx].imageUrl;
      setLocalCategories(updated);
      setDirtyCategories((prev) => ({ ...prev, [category.id]: true }));
    } catch (err) {
      console.error(err);
      showToast('ပုံတင်ရာတွင် Error ဖြစ်နေပါသည်။', 'error');
    } finally {
      setUploadingImage(null);
    }
  };

  const handleTherapistPhotoUpload = (tIdx: number, file?: File) => {
    if (!file) return;
    setUploadingImage(`therapist_${tIdx}`);
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_SIZE = 800;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_SIZE) {
            height *= MAX_SIZE / width;
            width = MAX_SIZE;
          }
        } else {
          if (height > MAX_SIZE) {
            width *= MAX_SIZE / height;
            height = MAX_SIZE;
          }
        }
        canvas.width = Math.round(width);
        canvas.height = Math.round(height);
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.fillStyle = '#FFFFFF';
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        }
        const finalBase64 = canvas.toDataURL('image/jpeg', 0.8);
        setLocalTherapists((prev) => {
          const next = [...prev];
          const currImgs = Array.isArray(next[tIdx].images) ? [...next[tIdx].images] : [];
          currImgs.push(finalBase64);
          next[tIdx] = { ...next[tIdx], images: currImgs };
          return next;
        });
        setDirtyTherapists(true);
        setUploadingImage(null);
      };
      img.onerror = () => {
        setUploadingImage(null);
        showToast('ပုံဖတ်ရာတွင် Error ဖြစ်နေပါသည်။', 'error');
      };
      img.src = event.target?.result as string;
    };
    reader.onerror = () => {
      setUploadingImage(null);
      showToast('ပုံဖတ်ရာတွင် Error ဖြစ်နေပါသည်။', 'error');
    };
    reader.readAsDataURL(file);
  };

  const updateItem = (cIdx: number, iIdx: number, field: string, val: any) => {
    const catId = localCategories[cIdx]?.id;
    const updated = localCategories.map((c, idx) =>
      idx === cIdx ? { ...c, items: [...(c.items || [])] } : c
    );
    updated[cIdx].items[iIdx] = { ...updated[cIdx].items[iIdx], [field]: val };
    setLocalCategories(updated);
    if (catId) setDirtyCategories((prev) => ({ ...prev, [catId]: true }));
  };

  const addItem = (cIdx: number) => {
    const catId = localCategories[cIdx]?.id;
    const newId = Date.now().toString();
    const updated = localCategories.map((c, idx) =>
      idx === cIdx ? { ...c, items: [...(c.items || [])] } : c
    );
    updated[cIdx].items.push({
      id: newId,
      name: 'New Service',
      price: 0,
      vvipPrice: 0,
      duration: '60 Mins',
      vvipIncluded: false,
      description: '',
      images: [],
      isHidden: false,
      isComingSoon: false,
      comingSoonText: 'Coming Soon .. Booking လက်မခံသေးပါ',
    });
    setLocalCategories(updated);
    if (catId) setDirtyCategories((prev) => ({ ...prev, [catId]: true }));
    setExpandedServices((prev) => ({ ...prev, [`${catId}_${newId}`]: true }));
    showToast('Service အသစ်ထည့်ပြီးပါပြီ — အချက်အလက်ဖြည့်ပြီး Save နှိပ်ပါ', 'info');
  };

  const requestDeleteItem = (cIdx: number, iIdx: number) => {
    const cat = localCategories[cIdx];
    const item = cat?.items?.[iIdx];
    setConfirmDialog({
      title: 'Service ကို ဖျက်မည်လား?',
      message: `"${item?.name || 'Unnamed Service'}" ကို ${cat?.title || ''} စာရင်းမှ ဖျက်မည် သေချာပါသလား?`,
      confirmLabel: 'ဖျက်မည် (Delete)',
      tone: 'danger',
      onConfirm: () => {
        const updated = localCategories.map((c, idx) =>
          idx === cIdx ? { ...c, items: c.items.filter((_: any, j: number) => j !== iIdx) } : c
        );
        setLocalCategories(updated);
        if (cat?.id) setDirtyCategories((prev) => ({ ...prev, [cat.id]: true }));
        showToast(`"${item?.name}" ကို ဖျက်ပြီးပါပြီ — အတည်ပြုရန် Save နှိပ်ပါ`, 'info');
      },
    });
  };

  const addTherapist = () => {
    const newId = `new_t_${Date.now()}`;
    setLocalTherapists((prev) => [
      ...prev,
      {
        id: newId,
        name: `Therapist No-${prev.length + 1}`,
        images: [],
        order: prev.length,
        password: '',
        visibilityStatus: 'active',
        comingSoonText: 'Coming Soon .. Booking လက်မခံသေးပါ',
        staffAppAccess: true,
      },
    ]);
    setExpandedTherapists((prev) => ({ ...prev, [newId]: true }));
    setDirtyTherapists(true);
    showToast('ဝန်ထမ်းအသစ် ထည့်သွင်းပြီးပါပြီ — အချက်အလက်ဖြည့်ပြီး Save All နှိပ်ပါ', 'info');
  };

  const updateTherapist = (tIdx: number, field: string, val: any) => {
    setLocalTherapists((prev) => {
      const next = [...prev];
      next[tIdx] = { ...next[tIdx], [field]: val };
      return next;
    });
    setDirtyTherapists(true);
  };

  const requestRemoveTherapist = (tIdx: number) => {
    const t = localTherapists[tIdx];
    setConfirmDialog({
      title: 'ဝန်ထမ်းကို ဖျက်မည်လား?',
      message: `"${t?.name || 'Therapist'}" ကို စာရင်းမှ အပြီးတိုင်ဖျက်မည် သေချာပါသလား?`,
      confirmLabel: 'ဖျက်မည် (Delete)',
      tone: 'danger',
      onConfirm: () => {
        if (t?.id && !t.id.startsWith('new_')) {
          setDeletedTherapistIds((prev) => [...prev, t.id]);
        }
        setLocalTherapists((prev) => prev.filter((_, idx) => idx !== tIdx));
        setDirtyTherapists(true);
        showToast(`"${t?.name}" ကို စာရင်းမှဖယ်ရှားပြီးပါပြီ — Save All နှိပ်၍ အတည်ပြုပါ`, 'info');
      },
    });
  };

  const moveTherapistUp = (tIdx: number) => {
    if (tIdx === 0) return;
    setLocalTherapists((prev) => {
      const next = [...prev];
      [next[tIdx - 1], next[tIdx]] = [next[tIdx], next[tIdx - 1]];
      return next;
    });
    setDirtyTherapists(true);
  };

  const moveTherapistDown = (tIdx: number) => {
    if (tIdx === localTherapists.length - 1) return;
    setLocalTherapists((prev) => {
      const next = [...prev];
      [next[tIdx + 1], next[tIdx]] = [next[tIdx], next[tIdx + 1]];
      return next;
    });
    setDirtyTherapists(true);
  };

  const updatePaymentMethod = (pIdx: number, field: string, val: string) => {
    const updated = [...localPaymentMethods];
    updated[pIdx] = { ...updated[pIdx], [field]: val };
    setLocalPaymentMethods(updated);
    setDirtyPayments(true);
  };

  const addPaymentMethod = () => {
    setLocalPaymentMethods((prev) => [
      ...prev,
      { id: `p_${Date.now()}`, name: 'New Payment', accountNumber: '', accountName: '', logoUrl: '' },
    ]);
    setDirtyPayments(true);
  };

  const requestRemovePaymentMethod = (pIdx: number) => {
    const pm = localPaymentMethods[pIdx];
    setConfirmDialog({
      title: 'Payment Gateway ဖျက်မည်လား?',
      message: `"${pm?.name || 'Payment Method'}" ကို ဖျက်မည် သေချာပါသလား?`,
      confirmLabel: 'ဖျက်မည်',
      tone: 'danger',
      onConfirm: () => {
        setLocalPaymentMethods((prev) => prev.filter((_, i) => i !== pIdx));
        setDirtyPayments(true);
        showToast('Payment Method ဖယ်ရှားပြီးပါပြီ — Save Payments နှိပ်ပါ', 'info');
      },
    });
  };

  const updateVipTier = (tIdx: number, field: string, val: any) => {
    const updated = [...localVipSettings.tiers];
    updated[tIdx] = { ...updated[tIdx], [field]: val };
    setLocalVipSettings({ ...localVipSettings, tiers: updated });
    setDirtyVip(true);
  };

  const updateVipRule = (rIdx: number, val: string) => {
    const updated = [...localVipSettings.rules];
    updated[rIdx] = val;
    setLocalVipSettings({ ...localVipSettings, rules: updated });
    setDirtyVip(true);
  };

  const handleCopyQuickLink = async (label: string, queryStr: string) => {
    const url = window.location.origin + window.location.pathname + queryStr;
    const ok = await safeCopyText(url);
    showToast(ok ? `${label} Link ကူးယူပြီးပါပြီ` : url, ok ? 'success' : 'info');
  };

  const handleGetCurrentGps = () => {
    if (!navigator.geolocation) {
      showToast('ဤ Browser တွင် GPS Location မပံ့ပိုးပါ။', 'error');
      return;
    }
    setGettingGps(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocalBranding((prev) => ({
          ...prev,
          shopLat: pos.coords.latitude,
          shopLng: pos.coords.longitude,
        }));
        setDirtyBranding(true);
        setGettingGps(false);
        showToast('ဆိုင် GPS တည်နေရာ ရယူပြီးပါပြီ — Save Branding နှိပ်၍ အတည်ပြုပါ။', 'success');
      },
      () => {
        setGettingGps(false);
        showToast('Location Services ဖွင့်ထားကြောင်း စစ်ဆေးပြီး ထပ်မံကြိုးစားပါ။', 'error');
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  // Workspace tabs definition (uniform 2x3 on mobile, 3x2 tablet, 6x1 desktop)
  const workspaceTabs: {
    id: SettingsSubTab;
    label: string;
    metric: string;
    metricTone?: string;
    icon: React.ReactNode;
    dirty?: boolean;
  }[] = [
    {
      id: 'services',
      label: 'Services & Menu',
      metric: `${kpiMetrics.activeServices}/${kpiMetrics.totalServices}`,
      icon: <Sparkles className="w-4 h-4 shrink-0" />,
      dirty: anyDirtyServices,
    },
    {
      id: 'therapists',
      label: 'Therapists & Staff',
      metric: `${kpiMetrics.totalStaff}`,
      icon: <Users className="w-4 h-4 shrink-0" />,
      dirty: dirtyTherapists,
    },
    {
      id: 'operations',
      label: 'Booking & Hours',
      metric: spaOperations.isOnlineBookingOpen ? 'OPEN' : 'PAUSED',
      metricTone: spaOperations.isOnlineBookingOpen ? 'text-emerald-600' : 'text-red-600',
      icon: <Globe className="w-4 h-4 shrink-0" />,
      dirty: dirtyOperations,
    },
    {
      id: 'branding',
      label: 'Brand & GPS',
      metric: localBranding.shopLat && localBranding.shopLng ? 'GPS ON' : 'SET',
      icon: <MapPin className="w-4 h-4 shrink-0" />,
      dirty: dirtyBranding,
    },
    {
      id: 'payments',
      label: 'Payments',
      metric: `${localPaymentMethods.length}`,
      icon: <CreditCard className="w-4 h-4 shrink-0" />,
      dirty: dirtyPayments,
    },
    {
      id: 'vip_security',
      label: 'VIP & Security',
      metric: localVipSettings.isActive ? 'VIP ON' : 'OFF',
      icon: <Crown className="w-4 h-4 shrink-0" />,
      dirty: anyDirtyVipSecurity,
    },
  ];

  return (
    <div className="space-y-4 sm:space-y-5 animate-fade-in pb-10">
      {/* =========================================================================
          1. COMPACT EXECUTIVE HEADER & 4-METRIC OVERVIEW
         ========================================================================= */}
      <div className="bg-gradient-to-br from-[#0B2419] via-[#123524] to-[#0B2419] rounded-2xl sm:rounded-3xl p-4 sm:p-6 text-white shadow-md border border-[#C8A951]/25 relative overflow-hidden">
        <div className="absolute -right-12 -top-12 w-44 h-44 rounded-full bg-[#C8A951]/10 blur-2xl pointer-events-none" />

        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3.5 pb-4 border-b border-white/10">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[11px] font-semibold text-gray-300">
              <span className="text-[#D4AF37] uppercase tracking-wider font-bold">Control Center</span>
              <span className="text-white/30">·</span>
              <span className="inline-flex items-center gap-1.5">
                <span
                  className={`w-2 h-2 rounded-full ${
                    spaOperations.isOnlineBookingOpen ? 'bg-emerald-400' : 'bg-red-400'
                  }`}
                />
                <span className={spaOperations.isOnlineBookingOpen ? 'text-emerald-300 font-bold' : 'text-red-300 font-bold'}>
                  {spaOperations.isOnlineBookingOpen ? 'Online Booking Open' : 'Online Booking Paused'}
                </span>
              </span>
            </div>
            <h2 className="text-lg sm:text-2xl font-serif font-bold text-[#D4AF37] tracking-tight mt-1 flex items-center gap-2">
              <Settings className="w-5 h-5 text-[#D4AF37] shrink-0" />
              <span className="truncate">System Settings & Visibility</span>
            </h2>
          </div>

          {/* Quick Share Links: Uniform 3-col row on mobile */}
          <div className="grid grid-cols-3 sm:flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() => handleCopyQuickLink('Therapist Gallery', '?view=therapists')}
              className="min-h-[38px] px-2.5 sm:px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/15 active:scale-[0.98] text-[11px] font-bold text-[#D4AF37] border border-[#C8A951]/30 flex items-center justify-center gap-1.5 transition"
            >
              <Copy className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">Therapist</span>
            </button>
            <button
              type="button"
              onClick={() => handleCopyQuickLink('Staff App Portal', '?mode=staff')}
              className="min-h-[38px] px-2.5 sm:px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/15 active:scale-[0.98] text-[11px] font-bold text-emerald-300 border border-emerald-400/25 flex items-center justify-center gap-1.5 transition"
            >
              <Copy className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">Staff App</span>
            </button>
            <button
              type="button"
              onClick={() => handleCopyQuickLink('VIP Member', '?view=vip')}
              className="min-h-[38px] px-2.5 sm:px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/15 active:scale-[0.98] text-[11px] font-bold text-amber-200 border border-amber-300/25 flex items-center justify-center gap-1.5 transition"
            >
              <Copy className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">VIP Link</span>
            </button>
          </div>
        </div>

        {/* 4 Clean KPI Tiles (Tabular Numerals, Unboxed Metadata) */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 pt-4">
          <button
            type="button"
            onClick={() => handleSelectSubTab('services')}
            className="text-left bg-black/20 hover:bg-black/30 border border-white/10 rounded-xl p-3 transition"
          >
            <div className="text-[10px] font-bold text-gray-300 uppercase tracking-wider">Services Menu</div>
            <div className="text-lg sm:text-xl font-black text-[#D4AF37] mt-0.5 tabular-nums">
              {kpiMetrics.activeServices}
              <span className="text-xs font-semibold text-gray-400"> / {kpiMetrics.totalServices} Active</span>
            </div>
            <div className="text-[10px] text-gray-300 mt-1 tabular-nums">
              Soon {kpiMetrics.comingSoonServices} · Hide {kpiMetrics.hiddenServices}
            </div>
          </button>

          <button
            type="button"
            onClick={() => handleSelectSubTab('therapists')}
            className="text-left bg-black/20 hover:bg-black/30 border border-white/10 rounded-xl p-3 transition"
          >
            <div className="text-[10px] font-bold text-gray-300 uppercase tracking-wider">Therapists</div>
            <div className="text-lg sm:text-xl font-black text-white mt-0.5 tabular-nums">
              {kpiMetrics.totalStaff} <span className="text-xs font-semibold text-gray-400">ဦး</span>
            </div>
            <div className="text-[10px] text-gray-300 mt-1 tabular-nums">
              Active {kpiMetrics.activeStaff} · Soon {kpiMetrics.comingSoonStaff} · Hide {kpiMetrics.hiddenStaff}
            </div>
          </button>

          <button
            type="button"
            onClick={() => handleSelectSubTab('therapists')}
            className="text-left bg-black/20 hover:bg-black/30 border border-white/10 rounded-xl p-3 transition"
          >
            <div className="text-[10px] font-bold text-gray-300 uppercase tracking-wider">Staff App Access</div>
            <div className="text-lg sm:text-xl font-black text-emerald-400 mt-0.5 tabular-nums">
              {kpiMetrics.appAllowedStaff}
              <span className="text-xs font-semibold text-gray-400"> / {kpiMetrics.totalStaff} Open</span>
            </div>
            <div className="text-[10px] text-gray-300 mt-1 tabular-nums">
              Locked:{' '}
              <span className={kpiMetrics.totalStaff - kpiMetrics.appAllowedStaff > 0 ? 'text-red-300 font-bold' : 'text-gray-300'}>
                {kpiMetrics.totalStaff - kpiMetrics.appAllowedStaff} ဦး
              </span>
            </div>
          </button>

          <button
            type="button"
            onClick={() => handleSelectSubTab('payments')}
            className="text-left bg-black/20 hover:bg-black/30 border border-white/10 rounded-xl p-3 transition"
          >
            <div className="text-[10px] font-bold text-gray-300 uppercase tracking-wider">Payments & VIP</div>
            <div className="text-lg sm:text-xl font-black text-[#D4AF37] mt-0.5 tabular-nums">
              {localPaymentMethods.length} <span className="text-xs font-semibold text-gray-400">Gateways</span>
            </div>
            <div className="text-[10px] text-gray-300 mt-1">
              VIP:{' '}
              <span className={localVipSettings.isActive ? 'text-emerald-300 font-bold' : 'text-gray-400'}>
                {localVipSettings.isActive ? 'Active' : 'Disabled'}
              </span>
            </div>
          </button>
        </div>
      </div>

      {/* =========================================================================
          2. UNIFORM 6-TAB WORKSPACE GRID (NO MORE SCATTERED WRAPPED PILLS)
         ========================================================================= */}
      <div className="bg-white p-2 rounded-2xl border border-gray-200/90 shadow-xs">
        <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-2">
          {workspaceTabs.map((tabItem) => {
            const isAct = activeSubTab === tabItem.id;
            return (
              <button
                key={tabItem.id}
                type="button"
                onClick={() => handleSelectSubTab(tabItem.id)}
                className={`relative min-h-[58px] px-3 py-2.5 rounded-xl text-left transition-all flex flex-col justify-between border ${
                  isAct
                    ? 'bg-[#0B2419] text-white border-[#C8A951]/50 shadow-sm'
                    : 'bg-gray-50/70 text-gray-700 border-transparent hover:bg-gray-100/90 hover:text-[#123524]'
                }`}
              >
                <div className="flex items-center justify-between gap-2 w-full">
                  <span className={isAct ? 'text-[#D4AF37]' : 'text-[#123524]/75'}>{tabItem.icon}</span>
                  <span
                    className={`text-[10px] font-black tracking-wide tabular-nums ${
                      isAct ? 'text-[#D4AF37]' : tabItem.metricTone || 'text-gray-500'
                    }`}
                  >
                    {tabItem.metric}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-1 mt-1.5">
                  <span className={`text-xs font-bold truncate ${isAct ? 'text-white' : 'text-gray-800'}`}>
                    {tabItem.label}
                  </span>
                  {tabItem.dirty && (
                    <span
                      title="Unsaved changes"
                      className="w-2 h-2 rounded-full bg-amber-400 shrink-0 animate-pulse"
                    />
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* =========================================================================
          TAB 1: SERVICES & MENU STUDIO (COLLAPSIBLE SINGLE-ELEVATION ROWS)
         ========================================================================= */}
      {activeSubTab === 'services' && (
        <div className="space-y-4 animate-fade-in">
          {/* Unified Filter & Search Card */}
          <div className="bg-white p-4 sm:p-5 rounded-2xl border border-gray-200/90 shadow-xs space-y-3.5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-base sm:text-lg font-black text-[#123524] flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-[#D4AF37] shrink-0" />
                  <span>Spa Menu & Service Visibility</span>
                </h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  Service တစ်ခုချင်းစီကို နှိပ်၍ စျေးနှုန်း၊ ပုံနှင့် ပြသမှု (Active / Coming Soon / Hide) ပြင်ဆင်နိုင်ပါသည်
                </p>
              </div>
              <button
                type="button"
                disabled={savingCategory === 'force_fix'}
                onClick={handleForceFixCategories}
                className="self-start sm:self-auto min-h-[38px] px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200/80 rounded-xl text-xs font-bold flex items-center gap-1.5 transition shrink-0"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${savingCategory === 'force_fix' ? 'animate-spin' : ''}`} />
                <span>{savingCategory === 'force_fix' ? 'Resetting...' : 'Reset Default'}</span>
              </button>
            </div>

            {/* Single-Line Scrollable Category Selector */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 -mx-1 px-1">
              <button
                type="button"
                onClick={() => setSelectedCategoryTabId('all')}
                className={`shrink-0 min-h-[36px] px-3.5 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap border ${
                  selectedCategoryTabId === 'all'
                    ? 'bg-[#123524] text-[#D4AF37] border-[#123524]'
                    : 'bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100'
                }`}
              >
                All ({localCategories.length})
              </button>
              {localCategories.map((c: any) => {
                const isSelected = selectedCategoryTabId === c.id;
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setSelectedCategoryTabId(c.id)}
                    className={`shrink-0 min-h-[36px] px-3.5 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap flex items-center gap-1.5 border ${
                      isSelected
                        ? 'bg-[#123524] text-[#D4AF37] border-[#123524]'
                        : 'bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100'
                    }`}
                  >
                    <span>{c.title}</span>
                    <span className={`text-[10px] tabular-nums ${isSelected ? 'text-[#D4AF37]/80' : 'text-gray-400'}`}>
                      {c.items?.length || 0}
                    </span>
                    {c.isHidden && <EyeOff className="w-3 h-3 text-red-400" />}
                    {dirtyCategories[c.id] && <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />}
                  </button>
                );
              })}
            </div>

            {/* Status Filter + Search Row */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-2.5">
              <div className="md:col-span-6 grid grid-cols-4 gap-1 bg-gray-100/90 p-1 rounded-xl border border-gray-200/80">
                {[
                  { id: 'all', label: 'All' },
                  { id: 'active', label: 'Active' },
                  { id: 'coming_soon', label: 'Soon' },
                  { id: 'hidden', label: 'Hidden' },
                ].map((fm) => (
                  <button
                    key={fm.id}
                    type="button"
                    onClick={() => setServiceFilterMode(fm.id as any)}
                    className={`min-h-[34px] rounded-lg text-[11px] font-bold transition ${
                      serviceFilterMode === fm.id
                        ? 'bg-white text-[#123524] shadow-2xs'
                        : 'text-gray-500 hover:text-gray-800'
                    }`}
                  >
                    {fm.label}
                  </button>
                ))}
              </div>

              <div className="md:col-span-6 relative">
                <input
                  type="text"
                  value={serviceSearch}
                  onChange={(e) => setServiceSearch(e.target.value)}
                  placeholder="Service အမည် ရှာရန်..."
                  className="w-full min-h-[42px] pl-9 pr-8 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-semibold text-gray-800 outline-none focus:border-[#123524] focus:bg-white transition"
                />
                <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                {serviceSearch && (
                  <button
                    type="button"
                    onClick={() => setServiceSearch('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-1"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Categories Panels */}
          {localCategories.map((cat: any, cIdx: number) => {
            if (selectedCategoryTabId !== 'all' && cat.id !== selectedCategoryTabId) return null;

            const q = serviceSearch.trim().toLowerCase();
            const filteredItemsWithIdx = (cat.items || [])
              .map((item: any, iIdx: number) => ({ item, iIdx }))
              .filter(({ item }: any) => {
                const isItemHidden = Boolean(cat.isHidden || item.isHidden);
                const isItemSoon = !isItemHidden && Boolean(item.isComingSoon);
                const isItemActive = !isItemHidden && !isItemSoon;

                if (serviceFilterMode === 'active' && !isItemActive) return false;
                if (serviceFilterMode === 'coming_soon' && !isItemSoon) return false;
                if (serviceFilterMode === 'hidden' && !isItemHidden) return false;

                if (q) {
                  return (
                    String(item.name || '').toLowerCase().includes(q) ||
                    String(item.description || '').toLowerCase().includes(q)
                  );
                }
                return true;
              });

            const allExpandedInCat =
              filteredItemsWithIdx.length > 0 &&
              filteredItemsWithIdx.every(({ item }: any) => expandedServices[`${cat.id}_${item.id}`]);

            const toggleAllInCat = () => {
              const nextState = !allExpandedInCat;
              setExpandedServices((prev) => {
                const copy = { ...prev };
                filteredItemsWithIdx.forEach(({ item }: any) => {
                  copy[`${cat.id}_${item.id}`] = nextState;
                });
                return copy;
              });
            };

            const isDirtyCat = Boolean(dirtyCategories[cat.id]);

            return (
              <div
                key={cat.id}
                className={`bg-white rounded-2xl border overflow-hidden shadow-xs transition ${
                  cat.isHidden ? 'border-red-200' : isDirtyCat ? 'border-amber-300' : 'border-gray-200/90'
                }`}
              >
                {/* Clean Category Header */}
                <div className="p-4 sm:px-5 bg-gray-50/70 border-b border-gray-200/80 space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className={`w-9 h-9 rounded-xl flex items-center justify-center font-black text-sm shrink-0 tabular-nums ${
                          cat.isHidden ? 'bg-red-100 text-red-600' : 'bg-[#123524] text-[#D4AF37]'
                        }`}
                      >
                        {cIdx + 1}
                      </div>
                      <div className="min-w-0">
                        <h4 className="font-black text-base text-[#123524] truncate">{cat.title}</h4>
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] font-semibold text-gray-500 mt-0.5 tabular-nums">
                          <span className={cat.isHidden ? 'text-red-600 font-bold' : 'text-emerald-700 font-bold'}>
                            {cat.isHidden ? '● Hidden in App' : '● Visible in App'}
                          </span>
                          <span>·</span>
                          <span>{cat.items?.length || 0} Services</span>
                          {isDirtyCat && (
                            <>
                              <span>·</span>
                              <span className="text-amber-600 font-bold">Unsaved edits</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    {filteredItemsWithIdx.length > 0 && (
                      <button
                        type="button"
                        onClick={toggleAllInCat}
                        className="text-[11px] font-bold text-gray-500 hover:text-[#123524] px-2.5 py-1.5 rounded-lg hover:bg-gray-200/60 transition shrink-0"
                      >
                        {allExpandedInCat ? 'Collapse All' : 'Expand All'}
                      </button>
                    )}
                  </div>

                  {/* Category Action Bar */}
                  <div className="grid grid-cols-3 sm:flex sm:flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleToggleCategoryHidden(cIdx)}
                      className={`min-h-[38px] px-3 py-1.5 rounded-xl text-xs font-bold border flex items-center justify-center gap-1.5 transition ${
                        cat.isHidden
                          ? 'bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100'
                          : 'bg-white text-gray-700 border-gray-200 hover:bg-red-50 hover:text-red-600 hover:border-red-200'
                      }`}
                    >
                      {cat.isHidden ? <Eye className="w-3.5 h-3.5 shrink-0" /> : <EyeOff className="w-3.5 h-3.5 shrink-0" />}
                      <span className="truncate">{cat.isHidden ? 'Show All' : 'Hide Cat'}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => addItem(cIdx)}
                      className="min-h-[38px] px-3 py-1.5 bg-white border border-gray-200 hover:bg-gray-100 text-[#123524] rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition"
                    >
                      <PlusCircle className="w-3.5 h-3.5 text-[#D4AF37] shrink-0" />
                      <span className="truncate">Add</span>
                    </button>

                    <button
                      type="button"
                      disabled={savingCategory === cat.id}
                      onClick={() => handleSaveCategory(cIdx)}
                      className={`min-h-[38px] px-3.5 py-1.5 rounded-xl text-xs font-black flex items-center justify-center gap-1.5 transition shadow-xs ${
                        isDirtyCat
                          ? 'bg-[#D4AF37] hover:bg-[#c5a02f] text-[#0B2419]'
                          : 'bg-[#123524] hover:bg-[#1a4a32] text-[#D4AF37]'
                      }`}
                    >
                      <Save className="w-3.5 h-3.5 shrink-0" />
                      <span className="truncate">
                        {savingCategory === cat.id ? 'Saving...' : isDirtyCat ? 'Save*' : 'Save'}
                      </span>
                    </button>
                  </div>
                </div>

                {/* Single-Elevation Collapsible Service List */}
                {filteredItemsWithIdx.length === 0 ? (
                  <div className="p-8 text-center text-gray-400 font-semibold text-xs">
                    ဤ Category တွင် ရွေးချယ်ထားသော Service မရှိပါ။
                  </div>
                ) : (
                  <div className="divide-y divide-gray-100">
                    {filteredItemsWithIdx.map(({ item, iIdx }: any) => {
                      const itemKey = `${cat.id}_${item.id}`;
                      const isExpanded = Boolean(expandedServices[itemKey]);
                      const itemStatus: 'active' | 'coming_soon' | 'hidden' = item.isHidden
                        ? 'hidden'
                        : item.isComingSoon
                        ? 'coming_soon'
                        : 'active';
                      const itemImgs = Array.isArray(item.images)
                        ? item.images
                        : item.imageUrl
                        ? [item.imageUrl]
                        : [];

                      return (
                        <div
                          key={item.id}
                          className={`transition-colors ${
                            itemStatus === 'hidden'
                              ? 'bg-gray-50/70'
                              : isExpanded
                              ? 'bg-[#123524]/[0.02]'
                              : 'bg-white'
                          }`}
                        >
                          {/* Compact Row Header (1-Tap Accordion Trigger) */}
                          <button
                            type="button"
                            onClick={() =>
                              setExpandedServices((prev) => ({ ...prev, [itemKey]: !prev[itemKey] }))
                            }
                            className="w-full px-4 sm:px-5 py-3.5 flex items-center justify-between gap-3 text-left hover:bg-gray-50/80 transition"
                          >
                            <div className="flex items-start gap-2.5 min-w-0 flex-1">
                              <span
                                className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${
                                  itemStatus === 'active'
                                    ? 'bg-emerald-500'
                                    : itemStatus === 'coming_soon'
                                    ? 'bg-amber-500'
                                    : 'bg-red-400'
                                }`}
                              />
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2">
                                  <span
                                    className={`text-sm font-bold truncate ${
                                      itemStatus === 'hidden' ? 'text-gray-400 line-through' : 'text-[#123524]'
                                    }`}
                                  >
                                    {item.name || 'Unnamed Service'}
                                  </span>
                                </div>
                                <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[11px] text-gray-500 mt-0.5 tabular-nums">
                                  <span className="font-semibold">{item.duration || '-'}</span>
                                  <span>·</span>
                                  <span className="font-bold text-[#123524]">
                                    {formatPrice(Number(item.price) || 0)}
                                  </span>
                                  {item.vvipIncluded ? (
                                    <>
                                      <span>·</span>
                                      <span className="text-amber-700 font-semibold">VVIP Free</span>
                                    </>
                                  ) : Number(item.vvipPrice) > 0 ? (
                                    <>
                                      <span>·</span>
                                      <span className="text-amber-700 font-semibold">
                                        VVIP {formatPrice(Number(item.vvipPrice))}
                                      </span>
                                    </>
                                  ) : null}
                                  {itemImgs.length > 0 && (
                                    <>
                                      <span>·</span>
                                      <span className="text-gray-400">{itemImgs.length} photo{itemImgs.length > 1 ? 's' : ''}</span>
                                    </>
                                  )}
                                </div>
                              </div>
                            </div>

                            <div className="flex items-center gap-2 shrink-0">
                              <span
                                className={`text-[10px] font-bold uppercase tracking-wide ${
                                  itemStatus === 'active'
                                    ? 'text-emerald-700'
                                    : itemStatus === 'coming_soon'
                                    ? 'text-amber-600'
                                    : 'text-red-500'
                                }`}
                              >
                                {itemStatus === 'active' ? 'Active' : itemStatus === 'coming_soon' ? 'Soon' : 'Hidden'}
                              </span>
                              <ChevronDown
                                className={`w-4 h-4 text-gray-400 transition-transform duration-200 ${
                                  isExpanded ? 'rotate-180 text-[#123524]' : ''
                                }`}
                              />
                            </div>
                          </button>

                          {/* Expanded Inline Editor */}
                          {isExpanded && (
                            <div className="px-4 sm:px-5 pb-4 pt-1 space-y-4 border-t border-gray-100">
                              {/* 3-State Instant Visibility Bar */}
                              <div className="space-y-2 pt-2">
                                <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider">
                                  Customer App Visibility (1-Tap Instant Sync)
                                </label>
                                <div className="grid grid-cols-3 gap-1.5 bg-gray-100 p-1 rounded-xl">
                                  <button
                                    type="button"
                                    onClick={() => handleQuickServiceStatusChange(cIdx, iIdx, 'active')}
                                    className={`min-h-[38px] rounded-lg text-xs font-bold transition ${
                                      itemStatus === 'active'
                                        ? 'bg-emerald-600 text-white shadow-xs'
                                        : 'text-gray-600 hover:bg-white/70'
                                    }`}
                                  >
                                    Active (ပြမည်)
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleQuickServiceStatusChange(cIdx, iIdx, 'coming_soon')}
                                    className={`min-h-[38px] rounded-lg text-xs font-bold transition ${
                                      itemStatus === 'coming_soon'
                                        ? 'bg-amber-500 text-white shadow-xs'
                                        : 'text-gray-600 hover:bg-white/70'
                                    }`}
                                  >
                                    Coming Soon
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleQuickServiceStatusChange(cIdx, iIdx, 'hidden')}
                                    className={`min-h-[38px] rounded-lg text-xs font-bold transition ${
                                      itemStatus === 'hidden'
                                        ? 'bg-red-600 text-white shadow-xs'
                                        : 'text-gray-600 hover:bg-white/70'
                                    }`}
                                  >
                                    Hide (ဖျောက်)
                                  </button>
                                </div>
                                {itemStatus === 'coming_soon' && (
                                  <input
                                    type="text"
                                    value={item.comingSoonText || 'Coming Soon .. Booking လက်မခံသေးပါ'}
                                    onChange={(e) => updateItem(cIdx, iIdx, 'comingSoonText', e.target.value)}
                                    placeholder="Coming Soon စာသား..."
                                    className="w-full min-h-[40px] px-3 py-2 text-xs font-semibold bg-amber-50/70 border border-amber-200 rounded-xl text-amber-950 outline-none focus:border-amber-400"
                                  />
                                )}
                              </div>

                              {/* Clean Responsive Form Fields */}
                              <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                                <div className="sm:col-span-7">
                                  <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">
                                    Service Name
                                  </label>
                                  <input
                                    type="text"
                                    value={item.name}
                                    onChange={(e) => updateItem(cIdx, iIdx, 'name', e.target.value)}
                                    className="w-full min-h-[42px] px-3 py-2 text-sm bg-white border border-gray-200 rounded-xl focus:border-[#123524] outline-none font-bold text-gray-900"
                                  />
                                </div>
                                <div className="sm:col-span-5">
                                  <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">
                                    Duration / Info
                                  </label>
                                  <input
                                    type="text"
                                    value={item.duration}
                                    onChange={(e) => updateItem(cIdx, iIdx, 'duration', e.target.value)}
                                    placeholder="60 Mins"
                                    className="w-full min-h-[42px] px-3 py-2 text-sm bg-white border border-gray-200 rounded-xl focus:border-[#123524] outline-none font-semibold"
                                  />
                                </div>
                              </div>

                              {/* Side-by-Side Prices on Mobile */}
                              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 items-end">
                                <div>
                                  <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">
                                    Normal Price (Ks)
                                  </label>
                                  <input
                                    type="number"
                                    inputMode="numeric"
                                    value={item.price || ''}
                                    onChange={(e) => updateItem(cIdx, iIdx, 'price', Number(e.target.value))}
                                    className="w-full min-h-[42px] px-3 py-2 text-sm bg-white border border-gray-200 rounded-xl focus:border-[#123524] outline-none font-black text-[#123524] tabular-nums"
                                  />
                                </div>
                                <div>
                                  <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">
                                    VVIP Price (Ks)
                                  </label>
                                  <input
                                    type="number"
                                    inputMode="numeric"
                                    value={item.vvipPrice || ''}
                                    onChange={(e) =>
                                      updateItem(
                                        cIdx,
                                        iIdx,
                                        'vvipPrice',
                                        e.target.value === '' ? undefined : Number(e.target.value)
                                      )
                                    }
                                    placeholder="Optional"
                                    className="w-full min-h-[42px] px-3 py-2 text-sm bg-white border border-gray-200 rounded-xl focus:border-[#123524] outline-none font-bold text-amber-700 tabular-nums"
                                  />
                                </div>
                                <div className="col-span-2 sm:col-span-1">
                                  <label className="min-h-[42px] px-3 py-2 bg-white border border-gray-200 rounded-xl flex items-center justify-between cursor-pointer">
                                    <span className="text-xs font-bold text-gray-700">VVIP Room Free</span>
                                    <input
                                      type="checkbox"
                                      checked={item.vvipIncluded || false}
                                      onChange={(e) => updateItem(cIdx, iIdx, 'vvipIncluded', e.target.checked)}
                                      className="w-4 h-4 accent-[#123524]"
                                    />
                                  </label>
                                </div>
                              </div>

                              {/* Description & Touch-Friendly Service Photos */}
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                                <div>
                                  <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">
                                    Description (အသေးစိတ်ဖော်ပြချက်)
                                  </label>
                                  <textarea
                                    value={item.description || ''}
                                    onChange={(e) => updateItem(cIdx, iIdx, 'description', e.target.value)}
                                    rows={3}
                                    className="w-full p-2.5 border border-gray-200 rounded-xl text-xs resize-none outline-none focus:border-[#123524] bg-white font-medium"
                                    placeholder="Service အကြောင်း အသေးစိတ်ရေးရန်..."
                                  />
                                </div>

                                <div>
                                  <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1.5">
                                    Service Photos ({itemImgs.length}/5)
                                  </label>
                                  <div className="flex flex-wrap gap-2">
                                    {itemImgs.map((imgUrl: string, imgIdx: number) => (
                                      <div
                                        key={imgIdx}
                                        className="w-20 aspect-[4/3] relative rounded-xl overflow-hidden border border-gray-200 bg-gray-100"
                                      >
                                        <img src={imgUrl} alt="Service" className="w-full h-full object-cover" />
                                        {/* Always accessible on mobile touchscreens */}
                                        <button
                                          type="button"
                                          onClick={(e) => {
                                            e.preventDefault();
                                            const updated = localCategories.map((c, idx) =>
                                              idx === cIdx ? { ...c, items: [...c.items] } : c
                                            );
                                            const cItem = { ...updated[cIdx].items[iIdx] };
                                            const cImgs = [...itemImgs];
                                            cImgs.splice(imgIdx, 1);
                                            cItem.images = cImgs;
                                            delete cItem.imageUrl;
                                            updated[cIdx].items[iIdx] = cItem;
                                            setLocalCategories(updated);
                                            setDirtyCategories((prev) => ({ ...prev, [cat.id]: true }));
                                          }}
                                          className="absolute top-1 right-1 w-5 h-5 rounded-full bg-red-600/90 text-white flex items-center justify-center shadow-xs"
                                          title="Delete photo"
                                        >
                                          <X className="w-3 h-3" />
                                        </button>
                                        {itemImgs.length > 1 && (
                                          <div className="absolute bottom-1 inset-x-1 flex justify-between pointer-events-auto">
                                            {imgIdx > 0 ? (
                                              <button
                                                type="button"
                                                onClick={() => {
                                                  const updated = localCategories.map((c, idx) =>
                                                    idx === cIdx ? { ...c, items: [...c.items] } : c
                                                  );
                                                  const cItem = { ...updated[cIdx].items[iIdx] };
                                                  const cImgs = [...itemImgs];
                                                  [cImgs[imgIdx - 1], cImgs[imgIdx]] = [cImgs[imgIdx], cImgs[imgIdx - 1]];
                                                  cItem.images = cImgs;
                                                  delete cItem.imageUrl;
                                                  updated[cIdx].items[iIdx] = cItem;
                                                  setLocalCategories(updated);
                                                  setDirtyCategories((prev) => ({ ...prev, [cat.id]: true }));
                                                }}
                                                className="w-5 h-5 rounded-full bg-black/65 text-white text-[10px] font-bold flex items-center justify-center"
                                              >
                                                &lt;
                                              </button>
                                            ) : (
                                              <span />
                                            )}
                                            {imgIdx < itemImgs.length - 1 && (
                                              <button
                                                type="button"
                                                onClick={() => {
                                                  const updated = localCategories.map((c, idx) =>
                                                    idx === cIdx ? { ...c, items: [...c.items] } : c
                                                  );
                                                  const cItem = { ...updated[cIdx].items[iIdx] };
                                                  const cImgs = [...itemImgs];
                                                  [cImgs[imgIdx + 1], cImgs[imgIdx]] = [cImgs[imgIdx], cImgs[imgIdx + 1]];
                                                  cItem.images = cImgs;
                                                  delete cItem.imageUrl;
                                                  updated[cIdx].items[iIdx] = cItem;
                                                  setLocalCategories(updated);
                                                  setDirtyCategories((prev) => ({ ...prev, [cat.id]: true }));
                                                }}
                                                className="w-5 h-5 rounded-full bg-black/65 text-white text-[10px] font-bold flex items-center justify-center"
                                              >
                                                &gt;
                                              </button>
                                            )}
                                          </div>
                                        )}
                                      </div>
                                    ))}

                                    {itemImgs.length < 5 && (
                                      <label className="w-20 aspect-[4/3] rounded-xl border-2 border-dashed border-gray-300 flex flex-col items-center justify-center cursor-pointer hover:bg-gray-100 transition bg-white text-gray-400">
                                        <input
                                          type="file"
                                          accept="image/*"
                                          multiple
                                          className="hidden"
                                          onChange={(e) => {
                                            handleServiceImageUpload(cIdx, iIdx, e.target.files);
                                            e.target.value = '';
                                          }}
                                          disabled={uploadingImage === `service_${cIdx}_${iIdx}`}
                                        />
                                        {uploadingImage === `service_${cIdx}_${iIdx}` ? (
                                          <span className="text-[9px] font-bold text-[#D4AF37] animate-pulse">Wait..</span>
                                        ) : (
                                          <>
                                            <ImageIcon className="w-4 h-4 opacity-60" />
                                            <span className="text-[9px] font-bold text-gray-500 mt-0.5">Upload</span>
                                          </>
                                        )}
                                      </label>
                                    )}
                                  </div>
                                </div>
                              </div>

                              {/* Item Footer Actions */}
                              <div className="flex items-center justify-between pt-2 border-t border-gray-100">
                                <button
                                  type="button"
                                  onClick={() => requestDeleteItem(cIdx, iIdx)}
                                  className="min-h-[36px] px-3 py-1.5 text-xs font-bold text-red-600 hover:bg-red-50 rounded-xl flex items-center gap-1.5 transition"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                  <span>Delete Service</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() =>
                                    setExpandedServices((prev) => ({ ...prev, [itemKey]: false }))
                                  }
                                  className="min-h-[36px] px-3.5 py-1.5 text-xs font-bold text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-xl transition"
                                >
                                  Done
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
            );
          })}
        </div>
      )}

      {/* =========================================================================
          TAB 2: THERAPISTS VISIBILITY & STAFF APP ACCESS (MOBILE-FIRST FIXED)
         ========================================================================= */}
      {activeSubTab === 'therapists' && (
        <div className="space-y-4 animate-fade-in">
          {/* Toolbar Card */}
          <div className="bg-white p-4 sm:p-5 rounded-2xl border border-gray-200/90 shadow-xs space-y-3.5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-base sm:text-lg font-black text-[#123524] flex items-center gap-2">
                  <Users className="w-4 h-4 text-[#D4AF37] shrink-0" />
                  <span>Therapists & Staff App Access</span>
                </h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  ဝန်ထမ်းတစ်ဦးချင်းစီကို နှိပ်၍ Visibility နှင့် Staff App ဝင်ရောက်ခွင့် (Auto Logout) စီမံနိုင်ပါသည်
                </p>
              </div>

              <div className="grid grid-cols-2 sm:flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={addTherapist}
                  className="min-h-[40px] px-3.5 py-2 bg-gray-100 hover:bg-gray-200 text-[#123524] border border-gray-200 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition"
                >
                  <PlusCircle className="w-4 h-4 text-[#D4AF37]" />
                  <span>Add Staff</span>
                </button>
                <button
                  type="button"
                  disabled={savingCategory === 'therapists'}
                  onClick={handleSaveTherapists}
                  className={`min-h-[40px] px-4 py-2 rounded-xl text-xs font-black flex items-center justify-center gap-1.5 shadow-xs transition ${
                    dirtyTherapists
                      ? 'bg-[#D4AF37] hover:bg-[#c5a02f] text-[#0B2419]'
                      : 'bg-[#123524] hover:bg-[#1a4a32] text-[#D4AF37]'
                  }`}
                >
                  <Save className="w-4 h-4" />
                  <span>
                    {savingCategory === 'therapists' ? 'Saving...' : dirtyTherapists ? 'Save All*' : 'Save All'}
                  </span>
                </button>
              </div>
            </div>

            {/* Single-Line Scrollable Filter + Search */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-2.5">
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 -mx-1 px-1">
                {[
                  { id: 'all', label: `All (${kpiMetrics.totalStaff})` },
                  { id: 'active', label: `Active (${kpiMetrics.activeStaff})` },
                  { id: 'coming_soon', label: `Soon (${kpiMetrics.comingSoonStaff})` },
                  { id: 'hidden', label: `Hidden (${kpiMetrics.hiddenStaff})` },
                  { id: 'app_locked', label: `Locked (${kpiMetrics.totalStaff - kpiMetrics.appAllowedStaff})` },
                ].map((tf) => (
                  <button
                    key={tf.id}
                    type="button"
                    onClick={() => setTherapistFilterMode(tf.id as any)}
                    className={`shrink-0 min-h-[34px] px-3 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap border tabular-nums ${
                      therapistFilterMode === tf.id
                        ? 'bg-[#123524] text-[#D4AF37] border-[#123524]'
                        : 'bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100'
                    }`}
                  >
                    {tf.label}
                  </button>
                ))}
              </div>

              <div className="relative md:w-64 shrink-0">
                <input
                  type="text"
                  value={therapistSearch}
                  onChange={(e) => setTherapistSearch(e.target.value)}
                  placeholder="ဝန်ထမ်းအမည် သို့မဟုတ် ID ရှာရန်..."
                  className="w-full min-h-[40px] pl-9 pr-8 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-semibold outline-none focus:border-[#123524] focus:bg-white transition"
                />
                <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                {therapistSearch && (
                  <button
                    type="button"
                    onClick={() => setTherapistSearch('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-1"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Collapsible Therapist Cards */}
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-3.5">
            {localTherapists.map((therapist: any, tIdx: number) => {
              const visStatus: 'active' | 'coming_soon' | 'hidden' = therapist.visibilityStatus || 'active';
              const isAppAllowed = therapist.staffAppAccess !== false;

              if (therapistFilterMode === 'active' && visStatus !== 'active') return null;
              if (therapistFilterMode === 'coming_soon' && visStatus !== 'coming_soon') return null;
              if (therapistFilterMode === 'hidden' && visStatus !== 'hidden') return null;
              if (therapistFilterMode === 'app_locked' && isAppAllowed) return null;

              const q = therapistSearch.trim().toLowerCase();
              if (
                q &&
                !String(therapist.name || '').toLowerCase().includes(q) &&
                !String(therapist.id || '').toLowerCase().includes(q)
              ) {
                return null;
              }

              const isExpanded = Boolean(expandedTherapists[therapist.id]);
              const thumbUrl = Array.isArray(therapist.images) && therapist.images[0] ? therapist.images[0] : '';
              const photoCount = Array.isArray(therapist.images) ? therapist.images.length : 0;
              const isPwdVisible = Boolean(revealedPasswords[therapist.id]);

              return (
                <div
                  key={therapist.id}
                  className={`bg-white rounded-2xl border overflow-hidden shadow-xs transition ${
                    visStatus === 'hidden'
                      ? 'border-gray-300 bg-gray-50/40'
                      : !isAppAllowed
                      ? 'border-red-200'
                      : isExpanded
                      ? 'border-[#123524]/40'
                      : 'border-gray-200/90'
                  }`}
                >
                  {/* Clean Compact Profile Row */}
                  <div className="p-3.5 sm:p-4 flex items-center justify-between gap-2.5">
                    <button
                      type="button"
                      onClick={() =>
                        setExpandedTherapists((prev) => ({ ...prev, [therapist.id]: !prev[therapist.id] }))
                      }
                      className="flex items-center gap-3 min-w-0 flex-1 text-left"
                    >
                      <div className="w-11 h-11 rounded-xl overflow-hidden bg-[#123524] text-[#D4AF37] font-black text-sm flex items-center justify-center shrink-0 border border-gray-200">
                        {thumbUrl ? (
                          <img src={thumbUrl} alt={therapist.name} className="w-full h-full object-cover" />
                        ) : (
                          <span>{String(therapist.name || 'T').slice(0, 2).toUpperCase()}</span>
                        )}
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-black text-[#123524] truncate">
                            {therapist.name || 'Unnamed Therapist'}
                          </span>
                        </div>
                        {/* Unboxed Metadata with Dot Separators */}
                        <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[11px] font-semibold mt-0.5 tabular-nums">
                          <span
                            className={
                              visStatus === 'active'
                                ? 'text-emerald-700'
                                : visStatus === 'coming_soon'
                                ? 'text-amber-600'
                                : 'text-red-500'
                            }
                          >
                            {visStatus === 'active'
                              ? '● Active'
                              : visStatus === 'coming_soon'
                              ? '● Soon'
                              : '● Hidden'}
                          </span>
                          <span className="text-gray-300">·</span>
                          <span className={isAppAllowed ? 'text-gray-600' : 'text-red-600 font-bold'}>
                            {isAppAllowed ? 'App Open' : 'App Locked'}
                          </span>
                          <span className="text-gray-300">·</span>
                          <span className="text-gray-400">{photoCount} photos</span>
                        </div>
                      </div>
                    </button>

                    {/* Reorder + Expand Controls */}
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => moveTherapistUp(tIdx)}
                        disabled={tIdx === 0}
                        className="w-8 h-8 rounded-lg bg-gray-50 hover:bg-gray-100 border border-gray-200/80 flex items-center justify-center disabled:opacity-35 transition"
                        title="Move Up"
                      >
                        <ChevronUp className="w-4 h-4 text-gray-700" />
                      </button>
                      <button
                        type="button"
                        onClick={() => moveTherapistDown(tIdx)}
                        disabled={tIdx === localTherapists.length - 1}
                        className="w-8 h-8 rounded-lg bg-gray-50 hover:bg-gray-100 border border-gray-200/80 flex items-center justify-center disabled:opacity-35 transition"
                        title="Move Down"
                      >
                        <ChevronDown className="w-4 h-4 text-gray-700" />
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setExpandedTherapists((prev) => ({ ...prev, [therapist.id]: !prev[therapist.id] }))
                        }
                        className="w-8 h-8 rounded-lg bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition ml-0.5"
                        title={isExpanded ? 'Collapse' : 'Edit Therapist'}
                      >
                        <ChevronDown
                          className={`w-4 h-4 text-[#123524] transition-transform duration-200 ${
                            isExpanded ? 'rotate-180' : ''
                          }`}
                        />
                      </button>
                    </div>
                  </div>

                  {/* Expanded Therapist Controls */}
                  {isExpanded && (
                    <div className="px-4 pb-4 pt-3 border-t border-gray-100 space-y-4 bg-gray-50/40">
                      {/* 1. Customer App Visibility */}
                      <div className="space-y-2">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[11px] font-bold text-gray-600 uppercase tracking-wider">
                            ၁။ Customer App Visibility
                          </span>
                          <span
                            className={`text-[11px] font-bold ${
                              visStatus === 'active'
                                ? 'text-emerald-700'
                                : visStatus === 'coming_soon'
                                ? 'text-amber-700'
                                : 'text-red-600'
                            }`}
                          >
                            {visStatus === 'active'
                              ? 'ဘိုကင်လက်ခံနေသည်'
                              : visStatus === 'coming_soon'
                              ? 'ဘိုကင်ပိတ်ထားသည်'
                              : 'App တွင် ဖျောက်ထားသည်'}
                          </span>
                        </div>

                        <div className="grid grid-cols-3 gap-1.5 bg-gray-100 p-1 rounded-xl">
                          <button
                            type="button"
                            onClick={() => handleQuickTherapistVisibility(tIdx, 'active')}
                            className={`min-h-[38px] rounded-lg text-xs font-bold transition ${
                              visStatus === 'active'
                                ? 'bg-emerald-600 text-white shadow-xs'
                                : 'text-gray-600 hover:bg-white/80'
                            }`}
                          >
                            Active
                          </button>
                          <button
                            type="button"
                            onClick={() => handleQuickTherapistVisibility(tIdx, 'coming_soon')}
                            className={`min-h-[38px] rounded-lg text-xs font-bold transition ${
                              visStatus === 'coming_soon'
                                ? 'bg-amber-500 text-white shadow-xs'
                                : 'text-gray-600 hover:bg-white/80'
                            }`}
                          >
                            Coming Soon
                          </button>
                          <button
                            type="button"
                            onClick={() => handleQuickTherapistVisibility(tIdx, 'hidden')}
                            className={`min-h-[38px] rounded-lg text-xs font-bold transition ${
                              visStatus === 'hidden'
                                ? 'bg-red-600 text-white shadow-xs'
                                : 'text-gray-600 hover:bg-white/80'
                            }`}
                          >
                            Hide
                          </button>
                        </div>

                        {visStatus === 'coming_soon' && (
                          <input
                            type="text"
                            value={therapist.comingSoonText || 'Coming Soon .. Booking လက်မခံသေးပါ'}
                            onChange={(e) => updateTherapist(tIdx, 'comingSoonText', e.target.value)}
                            className="w-full min-h-[40px] px-3 py-2 text-xs font-semibold bg-amber-50/70 border border-amber-200 rounded-xl text-amber-950 outline-none focus:border-amber-400"
                            placeholder="Coming Soon စာသား..."
                          />
                        )}
                      </div>

                      {/* 2. Staff Portal Access — FIXED MOBILE STACKING (ZERO CRUSHED TEXT!) */}
                      <div
                        className={`p-3.5 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                          isAppAllowed ? 'bg-emerald-50/60 border-emerald-200/80' : 'bg-red-50/70 border-red-200'
                        }`}
                      >
                        <div className="flex items-start gap-2.5 min-w-0 flex-1">
                          <div
                            className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${
                              isAppAllowed ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-600'
                            }`}
                          >
                            <Power className="w-4 h-4" />
                          </div>
                          <div className="min-w-0">
                            <div className="text-xs font-black text-gray-900 leading-snug">
                              ၂။ Staff App ဝင်ရောက်အသုံးပြုခွင့် (Staff Portal)
                            </div>
                            <p className="text-[11px] font-medium text-gray-600 mt-0.5 leading-relaxed">
                              {isAppAllowed
                                ? 'လက်ရှိတွင် Staff App သို့ ပုံမှန်ဝင်ရောက်အသုံးပြုနိုင်ပါသည်။'
                                : 'ပိတ်ထားပါသည် (လက်ရှိသုံးနေသော ဖုန်းမှ Auto Log Out လုပ်ထားပါသည်)။'}
                            </p>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleToggleStaffAppAccess(tIdx)}
                          className={`w-full sm:w-auto shrink-0 min-h-[42px] px-4 py-2 rounded-xl text-xs font-black tracking-wide transition shadow-xs ${
                            isAppAllowed
                              ? 'bg-red-600 hover:bg-red-700 text-white'
                              : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                          }`}
                        >
                          {isAppAllowed ? 'ပိတ်မည် (Auto Logout)' : 'ပြန်ဖွင့်ပေးမည်'}
                        </button>
                      </div>

                      {/* 3. Name, Password & Subtle Copyable Login ID */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">
                            Therapist Name
                          </label>
                          <input
                            type="text"
                            value={therapist.name}
                            onChange={(e) => updateTherapist(tIdx, 'name', e.target.value)}
                            placeholder="e.g. Therapist No-1"
                            className="w-full min-h-[42px] px-3 py-2 text-sm bg-white border border-gray-200 rounded-xl focus:border-[#123524] outline-none font-bold text-[#123524]"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">
                            Staff App Password
                          </label>
                          <div className="relative">
                            <input
                              type={isPwdVisible ? 'text' : 'password'}
                              minLength={6}
                              value={therapist.password === 'SECURED_ACCOUNT' ? '' : therapist.password}
                              onChange={(e) => updateTherapist(tIdx, 'password', e.target.value)}
                              placeholder={
                                therapist.password === 'SECURED_ACCOUNT'
                                  ? 'Secured (အသစ်ပြောင်းလိုမှ ရိုက်ပါ)'
                                  : 'Min 6 chars'
                              }
                              className="w-full min-h-[42px] pl-3 pr-10 py-2 text-sm bg-white border border-gray-200 rounded-xl focus:border-[#123524] outline-none font-mono font-bold text-gray-800"
                            />
                            <button
                              type="button"
                              onClick={() =>
                                setRevealedPasswords((prev) => ({
                                  ...prev,
                                  [therapist.id]: !prev[therapist.id],
                                }))
                              }
                              className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-gray-400 hover:text-gray-700"
                              title={isPwdVisible ? 'Hide password' : 'Show password'}
                            >
                              {isPwdVisible ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* Subtle Login ID caption */}
                      <div className="flex items-center justify-between gap-2 text-[11px] text-gray-500 bg-white px-3 py-2 rounded-xl border border-gray-200/70">
                        <span className="truncate font-mono">
                          Staff ID: <strong className="text-gray-700">{therapist.id}</strong>
                        </span>
                        <button
                          type="button"
                          onClick={async () => {
                            const ok = await safeCopyText(therapist.id);
                            showToast(ok ? 'Staff ID ကူးယူပြီးပါပြီ' : therapist.id, 'info');
                          }}
                          className="text-[#123524] font-bold flex items-center gap-1 shrink-0 hover:underline"
                        >
                          <Copy className="w-3 h-3" />
                          <span>Copy</span>
                        </button>
                      </div>

                      {/* 4. Gallery Photos (Touch-Friendly Always-Accessible Controls) */}
                      <div>
                        <label className="block text-[10px] font-bold text-gray-500 uppercase mb-2">
                          Gallery Photos ({photoCount}/5 HD)
                        </label>
                        <div className="grid grid-cols-4 sm:grid-cols-5 gap-2">
                          {therapist.images &&
                            therapist.images.map((imgUrl: string, imgIdx: number) => (
                              <div
                                key={imgIdx}
                                className="aspect-[3/4] relative rounded-xl overflow-hidden border border-gray-200 bg-gray-100"
                              >
                                <img src={imgUrl} alt="Therapist" className="w-full h-full object-cover" />
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.preventDefault();
                                    setLocalTherapists((prev) => {
                                      const next = [...prev];
                                      const imgs = [...(next[tIdx].images || [])];
                                      imgs.splice(imgIdx, 1);
                                      next[tIdx] = { ...next[tIdx], images: imgs };
                                      return next;
                                    });
                                    setDirtyTherapists(true);
                                  }}
                                  className="absolute top-1 right-1 w-5 h-5 rounded-full bg-red-600/90 text-white flex items-center justify-center shadow-xs"
                                  title="Delete photo"
                                >
                                  <X className="w-3 h-3" />
                                </button>
                                {therapist.images.length > 1 && (
                                  <div className="absolute bottom-1 inset-x-1 flex justify-between">
                                    {imgIdx > 0 ? (
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setLocalTherapists((prev) => {
                                            const next = [...prev];
                                            const imgs = [...(next[tIdx].images || [])];
                                            [imgs[imgIdx - 1], imgs[imgIdx]] = [imgs[imgIdx], imgs[imgIdx - 1]];
                                            next[tIdx] = { ...next[tIdx], images: imgs };
                                            return next;
                                          });
                                          setDirtyTherapists(true);
                                        }}
                                        className="w-5 h-5 rounded-full bg-black/65 text-white text-[10px] font-bold flex items-center justify-center"
                                      >
                                        &lt;
                                      </button>
                                    ) : (
                                      <span />
                                    )}
                                    {imgIdx < therapist.images.length - 1 && (
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setLocalTherapists((prev) => {
                                            const next = [...prev];
                                            const imgs = [...(next[tIdx].images || [])];
                                            [imgs[imgIdx + 1], imgs[imgIdx]] = [imgs[imgIdx], imgs[imgIdx + 1]];
                                            next[tIdx] = { ...next[tIdx], images: imgs };
                                            return next;
                                          });
                                          setDirtyTherapists(true);
                                        }}
                                        className="w-5 h-5 rounded-full bg-black/65 text-white text-[10px] font-bold flex items-center justify-center"
                                      >
                                        &gt;
                                      </button>
                                    )}
                                  </div>
                                )}
                              </div>
                            ))}

                          {photoCount < 5 && (
                            <label className="aspect-[3/4] rounded-xl border-2 border-dashed border-gray-300 flex flex-col items-center justify-center cursor-pointer hover:bg-gray-100 transition bg-white text-gray-500">
                              <input
                                type="file"
                                accept="image/*"
                                className="hidden"
                                onChange={(e) => {
                                  handleTherapistPhotoUpload(tIdx, e.target.files?.[0]);
                                  e.target.value = '';
                                }}
                                disabled={uploadingImage === `therapist_${tIdx}`}
                              />
                              {uploadingImage === `therapist_${tIdx}` ? (
                                <span className="text-[10px] font-bold text-[#D4AF37] animate-pulse">Wait..</span>
                              ) : (
                                <>
                                  <PlusCircle className="w-4 h-4 text-gray-400 mb-0.5" />
                                  <span className="text-[10px] font-bold">Photo</span>
                                </>
                              )}
                            </label>
                          )}
                        </div>
                      </div>

                      {/* Card Footer */}
                      <div className="flex items-center justify-between pt-2 border-t border-gray-200/70">
                        <button
                          type="button"
                          onClick={() => requestRemoveTherapist(tIdx)}
                          className="min-h-[36px] px-3 py-1.5 text-xs font-bold text-red-600 hover:bg-red-50 rounded-xl flex items-center gap-1.5 transition"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>Delete Staff</span>
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setExpandedTherapists((prev) => ({ ...prev, [therapist.id]: false }))
                          }
                          className="min-h-[36px] px-3.5 py-1.5 text-xs font-bold text-gray-600 bg-white border border-gray-200 hover:bg-gray-100 rounded-xl transition"
                        >
                          Done
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
          TAB 3: ONLINE BOOKING & OPERATIONS
         ========================================================================= */}
      {activeSubTab === 'operations' && (
        <div className="bg-white p-4 sm:p-6 rounded-2xl border border-gray-200/90 shadow-xs space-y-5 animate-fade-in">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-gray-100">
            <div>
              <h3 className="text-base sm:text-lg font-black text-[#123524] flex items-center gap-2">
                <Globe className="w-4 h-4 text-[#D4AF37] shrink-0" />
                <span>Online Booking & Operating Hours</span>
              </h3>
              <p className="text-xs text-gray-500 mt-0.5">
                Customer App ၏ Online Booking အဖွင့်/အပိတ်၊ ဆိုင်ဖွင့်ချိန်နှင့် အထူးကြေညာချက်များ စီမံရန်
              </p>
            </div>
            <button
              type="button"
              disabled={savingCategory === 'spa_operations'}
              onClick={handleSaveSpaOperations}
              className={`w-full sm:w-auto min-h-[42px] px-5 py-2.5 rounded-xl text-xs font-black flex items-center justify-center gap-2 shadow-xs transition ${
                dirtyOperations
                  ? 'bg-[#D4AF37] hover:bg-[#c5a02f] text-[#0B2419]'
                  : 'bg-[#123524] hover:bg-[#1a4a32] text-[#D4AF37]'
              }`}
            >
              <Save className="w-4 h-4" />
              <span>{savingCategory === 'spa_operations' ? 'Saving...' : dirtyOperations ? 'Save Operations*' : 'Save Operations'}</span>
            </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-5">
            {/* Master Online Booking Switch */}
            <div
              className={`p-4 sm:p-5 rounded-2xl border space-y-4 ${
                spaOperations.isOnlineBookingOpen
                  ? 'bg-emerald-50/40 border-emerald-200'
                  : 'bg-red-50/50 border-red-200'
              }`}
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h4 className="font-black text-sm text-[#123524]">Master Online Booking Switch</h4>
                  <p className="text-xs text-gray-600 mt-0.5">
                    {spaOperations.isOnlineBookingOpen
                      ? 'လက်ရှိတွင် Customer များ Online Booking ပုံမှန်တင်နိုင်ပါသည်။'
                      : 'လက်ရှိတွင် Online Booking ခေတ္တပိတ်ထားပါသည်။'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setSpaOperations({
                      ...spaOperations,
                      isOnlineBookingOpen: !spaOperations.isOnlineBookingOpen,
                    });
                    setDirtyOperations(true);
                  }}
                  className={`w-full sm:w-auto shrink-0 min-h-[42px] px-4 py-2 rounded-xl text-xs font-black shadow-xs transition ${
                    spaOperations.isOnlineBookingOpen
                      ? 'bg-red-600 hover:bg-red-700 text-white'
                      : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                  }`}
                >
                  {spaOperations.isOnlineBookingOpen ? 'Pause Online Booking' : 'Open Online Booking'}
                </button>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-gray-600 mb-1">
                  Booking ပိတ်ထားချိန် ပြသမည့် ခေါင်းစဉ် (Maintenance Title)
                </label>
                <input
                  type="text"
                  value={spaOperations.maintenanceTitle}
                  onChange={(e) => {
                    setSpaOperations({ ...spaOperations, maintenanceTitle: e.target.value });
                    setDirtyOperations(true);
                  }}
                  className="w-full min-h-[42px] px-3 py-2 bg-white border border-gray-200 rounded-xl text-xs font-bold text-gray-800 outline-none focus:border-[#123524]"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-gray-600 mb-1">
                  Booking ပိတ်ထားချိန် Customer ထံ ပြသမည့် အသိပေးစာသား
                </label>
                <textarea
                  rows={3}
                  value={spaOperations.maintenanceMessage}
                  onChange={(e) => {
                    setSpaOperations({ ...spaOperations, maintenanceMessage: e.target.value });
                    setDirtyOperations(true);
                  }}
                  className="w-full p-3 bg-white border border-gray-200 rounded-xl text-xs font-medium text-gray-700 outline-none focus:border-[#123524]"
                />
              </div>
            </div>

            {/* Operating Hours & Announcement Banner */}
            <div className="bg-gray-50/70 p-4 sm:p-5 rounded-2xl border border-gray-200/80 space-y-4">
              <h4 className="font-black text-sm text-[#123524] flex items-center gap-2">
                <Clock className="w-4 h-4 text-[#D4AF37]" />
                <span>Operating Hours & Announcement Banner</span>
              </h4>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Opening Time</label>
                  <input
                    type="text"
                    value={spaOperations.openingTime}
                    onChange={(e) => {
                      setSpaOperations({ ...spaOperations, openingTime: e.target.value });
                      setDirtyOperations(true);
                    }}
                    placeholder="10:00 AM"
                    className="w-full min-h-[42px] px-3 py-2 bg-white border border-gray-200 rounded-xl text-xs font-bold text-[#123524] tabular-nums"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Closing Time</label>
                  <input
                    type="text"
                    value={spaOperations.closingTime}
                    onChange={(e) => {
                      setSpaOperations({ ...spaOperations, closingTime: e.target.value });
                      setDirtyOperations(true);
                    }}
                    placeholder="11:00 PM"
                    className="w-full min-h-[42px] px-3 py-2 bg-white border border-gray-200 rounded-xl text-xs font-bold text-[#123524] tabular-nums"
                  />
                </div>
                <div className="col-span-2 sm:col-span-1">
                  <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">
                    Min Lead Time (Mins)
                  </label>
                  <input
                    type="number"
                    inputMode="numeric"
                    value={spaOperations.leadTimeMins}
                    onChange={(e) => {
                      setSpaOperations({ ...spaOperations, leadTimeMins: Number(e.target.value) });
                      setDirtyOperations(true);
                    }}
                    className="w-full min-h-[42px] px-3 py-2 bg-white border border-gray-200 rounded-xl text-xs font-bold text-[#123524] tabular-nums"
                  />
                </div>
              </div>

              <div className="pt-3 border-t border-gray-200/80 space-y-2.5">
                <label className="flex items-center justify-between gap-3 cursor-pointer bg-white p-3 rounded-xl border border-gray-200/80">
                  <span className="text-xs font-bold text-gray-800">
                    Customer App ထိပ်ဆုံးတွင် အထူးကြေညာချက် (Banner) ပြသမည်
                  </span>
                  <input
                    type="checkbox"
                    checked={spaOperations.isAnnouncementActive}
                    onChange={(e) => {
                      setSpaOperations({ ...spaOperations, isAnnouncementActive: e.target.checked });
                      setDirtyOperations(true);
                    }}
                    className="w-4 h-4 accent-[#123524] shrink-0"
                  />
                </label>
                <textarea
                  rows={3}
                  value={spaOperations.announcementBanner}
                  onChange={(e) => {
                    setSpaOperations({ ...spaOperations, announcementBanner: e.target.value });
                    setDirtyOperations(true);
                  }}
                  placeholder="ဥပမာ - ယနေ့ ညပိုင်း Night Call ဝန်ဆောင်မှုများ ကြိုတင်ဘိုကင်တင်နိုင်ပါပြီ..."
                  className="w-full p-3 bg-white border border-gray-200 rounded-xl text-xs font-medium text-gray-700 outline-none focus:border-[#123524]"
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          TAB 4: BRAND IDENTITY, CONTACT INFO & GPS GEOFENCING
         ========================================================================= */}
      {activeSubTab === 'branding' && (
        <div className="bg-white p-4 sm:p-6 rounded-2xl border border-gray-200/90 shadow-xs space-y-5 animate-fade-in">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-gray-100">
            <div>
              <h3 className="text-base sm:text-lg font-black text-[#123524] flex items-center gap-2">
                <MapPin className="w-4 h-4 text-[#D4AF37] shrink-0" />
                <span>Brand Identity, Contact & Shop GPS</span>
              </h3>
              <p className="text-xs text-gray-500 mt-0.5">
                ဆိုင်လိုဂို၊ အမည်၊ လိပ်စာ၊ ဖုန်းနံပါတ် နှင့် Staff Out Pass 50m GPS Geofencing ပြင်ဆင်ရန်
              </p>
            </div>
            <button
              type="button"
              disabled={savingCategory === 'branding'}
              onClick={handleSaveBranding}
              className={`w-full sm:w-auto min-h-[42px] px-5 py-2.5 rounded-xl text-xs font-black flex items-center justify-center gap-2 shadow-xs transition ${
                dirtyBranding
                  ? 'bg-[#D4AF37] hover:bg-[#c5a02f] text-[#0B2419]'
                  : 'bg-[#123524] hover:bg-[#1a4a32] text-[#D4AF37]'
              }`}
            >
              <Save className="w-4 h-4" />
              <span>{savingCategory === 'branding' ? 'Saving...' : dirtyBranding ? 'Save Branding*' : 'Save Branding'}</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-12 gap-5">
            {/* Logo Panel */}
            <div className="md:col-span-4 bg-gray-50/70 border border-gray-200/80 rounded-2xl p-5 flex flex-col items-center justify-center text-center">
              <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-3">
                Header Logo (Circle)
              </label>
              <div className="w-28 h-28 bg-white border-2 border-dashed border-gray-300 rounded-full flex items-center justify-center overflow-hidden mb-4 shadow-xs">
                {localBranding.logoUrl ? (
                  <img src={localBranding.logoUrl} alt="Logo Preview" className="w-full h-full object-cover" />
                ) : (
                  <span className="text-xs font-semibold text-gray-400">
                    {uploadingImage === 'logo' ? 'Uploading...' : 'No Logo'}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <label className="min-h-[38px] px-4 py-2 bg-white border border-gray-200 text-[#123524] rounded-xl text-xs font-bold cursor-pointer hover:bg-gray-100 transition inline-flex items-center">
                  {localBranding.logoUrl ? 'Change Logo' : 'Upload Logo'}
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleLogoUpload}
                    disabled={uploadingImage === 'logo'}
                  />
                </label>
                {localBranding.logoUrl && (
                  <button
                    type="button"
                    onClick={() => {
                      setLocalBranding({ ...localBranding, logoUrl: '' });
                      setDirtyBranding(true);
                    }}
                    className="min-h-[38px] px-3 py-2 bg-red-50 text-red-600 border border-red-200 rounded-xl text-xs font-bold hover:bg-red-100 transition"
                    title="Remove logo"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>

            {/* Contact Form */}
            <div className="md:col-span-8 space-y-3.5">
              <div>
                <label className="block text-[11px] font-bold text-gray-500 uppercase mb-1">Business Name</label>
                <input
                  type="text"
                  value={localBranding.name || ''}
                  onChange={(e) => {
                    setLocalBranding({ ...localBranding, name: e.target.value });
                    setDirtyBranding(true);
                  }}
                  className="w-full min-h-[42px] px-3 py-2 text-sm border border-gray-200 rounded-xl focus:border-[#123524] outline-none font-bold text-gray-900"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-gray-500 uppercase mb-1">Address</label>
                <textarea
                  value={localBranding.address}
                  onChange={(e) => {
                    setLocalBranding({ ...localBranding, address: e.target.value });
                    setDirtyBranding(true);
                  }}
                  className="w-full p-3 text-sm border border-gray-200 rounded-xl focus:border-[#123524] outline-none"
                  rows={2}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-gray-500 uppercase mb-1">Phone 1</label>
                  <input
                    type="text"
                    value={localBranding.phone1}
                    onChange={(e) => {
                      setLocalBranding({ ...localBranding, phone1: e.target.value });
                      setDirtyBranding(true);
                    }}
                    className="w-full min-h-[42px] px-3 py-2 text-sm border border-gray-200 rounded-xl focus:border-[#123524] outline-none font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-gray-500 uppercase mb-1">Phone 2</label>
                  <input
                    type="text"
                    value={localBranding.phone2}
                    onChange={(e) => {
                      setLocalBranding({ ...localBranding, phone2: e.target.value });
                      setDirtyBranding(true);
                    }}
                    className="w-full min-h-[42px] px-3 py-2 text-sm border border-gray-200 rounded-xl focus:border-[#123524] outline-none font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-gray-500 uppercase mb-1">Telegram Link</label>
                  <input
                    type="text"
                    value={(localBranding as any).telegram || ''}
                    onChange={(e) => {
                      setLocalBranding({ ...localBranding, telegram: e.target.value } as any);
                      setDirtyBranding(true);
                    }}
                    placeholder="https://t.me/username"
                    className="w-full min-h-[42px] px-3 py-2 text-sm border border-gray-200 rounded-xl focus:border-[#123524] outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-gray-500 uppercase mb-1">Viber Link</label>
                  <input
                    type="text"
                    value={(localBranding as any).viber || ''}
                    onChange={(e) => {
                      setLocalBranding({ ...localBranding, viber: e.target.value } as any);
                      setDirtyBranding(true);
                    }}
                    placeholder="viber://add?number=..."
                    className="w-full min-h-[42px] px-3 py-2 text-sm border border-gray-200 rounded-xl focus:border-[#123524] outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-gray-500 uppercase mb-1">Copyright Text</label>
                <input
                  type="text"
                  value={localBranding.copyright}
                  onChange={(e) => {
                    setLocalBranding({ ...localBranding, copyright: e.target.value });
                    setDirtyBranding(true);
                  }}
                  className="w-full min-h-[42px] px-3 py-2 text-sm border border-gray-200 rounded-xl focus:border-[#123524] outline-none"
                />
              </div>
            </div>
          </div>

          {/* Shop GPS Geofencing */}
          <div className="pt-4 border-t border-gray-100 space-y-2.5">
            <div className="flex items-center justify-between gap-2">
              <h4 className="text-sm font-black text-[#123524] flex items-center gap-1.5">
                <MapPin className="w-4 h-4 text-[#D4AF37]" />
                <span>Shop GPS Location (Staff Out Pass 50m Geofencing)</span>
              </h4>
              <span
                className={`text-[11px] font-bold ${
                  localBranding.shopLat && localBranding.shopLng ? 'text-emerald-700' : 'text-amber-600'
                }`}
              >
                {localBranding.shopLat && localBranding.shopLng ? '● Active' : '● Not Set'}
              </span>
            </div>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
              <div className="flex-1 bg-gray-50 px-3.5 py-3 rounded-xl border border-gray-200 text-xs text-gray-700 font-mono font-bold tabular-nums">
                Lat: {localBranding.shopLat ? localBranding.shopLat.toFixed(5) : 'Not set'} · Lng:{' '}
                {localBranding.shopLng ? localBranding.shopLng.toFixed(5) : 'Not set'}
              </div>
              <button
                type="button"
                disabled={gettingGps}
                onClick={handleGetCurrentGps}
                className="min-h-[42px] bg-emerald-50 text-emerald-800 px-4 py-2.5 rounded-xl text-xs font-black border border-emerald-200 hover:bg-emerald-100 transition whitespace-nowrap flex items-center justify-center gap-1.5"
              >
                <MapPin className="w-4 h-4" />
                <span>{gettingGps ? 'Locating...' : 'Get Current Shop GPS'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          TAB 5: PAYMENT GATEWAYS
         ========================================================================= */}
      {activeSubTab === 'payments' && (
        <div className="bg-white p-4 sm:p-6 rounded-2xl border border-gray-200/90 shadow-xs space-y-4 animate-fade-in">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-gray-100">
            <div>
              <h3 className="text-base sm:text-lg font-black text-[#123524] flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-[#D4AF37] shrink-0" />
                <span>Payment Gateways ({localPaymentMethods.length})</span>
              </h3>
              <p className="text-xs text-gray-500 mt-0.5">
                Customer App တွင် ငွေလွှဲလက်ခံမည့် KPay, WavePay နှင့် ဘဏ်အကောင့်များ စီမံရန်
              </p>
            </div>

            <div className="grid grid-cols-2 sm:flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={addPaymentMethod}
                className="min-h-[40px] px-3.5 py-2 bg-gray-100 border border-gray-200 hover:bg-gray-200 text-[#123524] rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition"
              >
                <PlusCircle className="w-4 h-4 text-[#D4AF37]" />
                <span>Add Payment</span>
              </button>
              <button
                type="button"
                disabled={savingCategory === 'payments'}
                onClick={handleSavePayments}
                className={`min-h-[40px] px-4 py-2 rounded-xl text-xs font-black flex items-center justify-center gap-1.5 shadow-xs transition ${
                  dirtyPayments
                    ? 'bg-[#D4AF37] hover:bg-[#c5a02f] text-[#0B2419]'
                    : 'bg-[#123524] hover:bg-[#1a4a32] text-[#D4AF37]'
                }`}
              >
                <Save className="w-4 h-4" />
                <span>{savingCategory === 'payments' ? 'Saving...' : dirtyPayments ? 'Save*' : 'Save Payments'}</span>
              </button>
            </div>
          </div>

          {localPaymentMethods.length === 0 ? (
            <div className="p-8 text-center text-xs font-semibold text-gray-400 border border-dashed border-gray-200 rounded-2xl">
              Payment Gateway မထည့်သွင်းရသေးပါ။ "+ Add Payment" နှိပ်၍ ထည့်သွင်းပါ။
            </div>
          ) : (
            <div className="space-y-3">
              {localPaymentMethods.map((pm, pIdx) => (
                <div
                  key={pm.id}
                  className="bg-gray-50/70 p-4 border border-gray-200/80 rounded-2xl space-y-3"
                >
                  {/* Top Row: Logo + Upload/Remove + Delete */}
                  <div className="flex items-center justify-between gap-3 pb-3 border-b border-gray-200/70">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 bg-white border border-gray-200 rounded-xl flex items-center justify-center overflow-hidden shrink-0">
                        {pm.logoUrl ? (
                          <img src={pm.logoUrl} alt={pm.name} className="w-full h-full object-contain p-1" />
                        ) : (
                          <span className="text-[9px] text-gray-400 font-bold text-center">
                            {uploadingImage === `pay_${pIdx}` ? '...' : 'Logo'}
                          </span>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <label className="min-h-[34px] px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-[11px] font-bold text-[#123524] cursor-pointer hover:bg-gray-100 inline-flex items-center">
                          {pm.logoUrl ? 'Change Logo' : 'Upload Logo'}
                          <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={(e) => handlePaymentLogoUpload(pIdx, e)}
                            disabled={uploadingImage === `pay_${pIdx}`}
                          />
                        </label>
                        {pm.logoUrl && (
                          <button
                            type="button"
                            onClick={() => updatePaymentMethod(pIdx, 'logoUrl', '')}
                            className="min-h-[34px] px-2.5 py-1.5 text-[11px] font-bold text-gray-500 hover:text-red-600 rounded-lg hover:bg-red-50 transition"
                          >
                            Remove Logo
                          </button>
                        )}
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => requestRemovePaymentMethod(pIdx)}
                      className="min-h-[36px] w-9 flex items-center justify-center text-red-500 hover:bg-red-50 rounded-xl transition shrink-0"
                      title="Delete Payment Gateway"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Inputs Row */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">
                        Bank / Wallet Name
                      </label>
                      <input
                        type="text"
                        value={pm.name}
                        onChange={(e) => updatePaymentMethod(pIdx, 'name', e.target.value)}
                        className="w-full min-h-[42px] px-3 py-2 text-sm bg-white border border-gray-200 rounded-xl focus:border-[#123524] outline-none font-bold text-gray-800"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">
                        Account Number / Phone
                      </label>
                      <input
                        type="text"
                        value={pm.accountNumber}
                        onChange={(e) => updatePaymentMethod(pIdx, 'accountNumber', e.target.value)}
                        className="w-full min-h-[42px] px-3 py-2 text-sm bg-white border border-gray-200 rounded-xl focus:border-[#123524] outline-none font-mono font-black text-[#123524] tracking-wider tabular-nums"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">
                        Account Holder Name
                      </label>
                      <input
                        type="text"
                        value={pm.accountName}
                        onChange={(e) => updatePaymentMethod(pIdx, 'accountName', e.target.value)}
                        className="w-full min-h-[42px] px-3 py-2 text-sm bg-white border border-gray-200 rounded-xl focus:border-[#123524] outline-none font-semibold"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* =========================================================================
          TAB 6: VIP, WELCOME BONUS, PWA INSTALL GUIDE & SECURITY (4-WAY INNER SWITCHER)
         ========================================================================= */}
      {activeSubTab === 'vip_security' && (
        <div className="space-y-4 animate-fade-in">
          {/* Inner 4-Section Switcher (Prevents Endless Scrolling on Mobile) */}
          <div className="bg-white p-1.5 rounded-2xl border border-gray-200/90 shadow-xs grid grid-cols-2 sm:grid-cols-4 gap-1.5">
            {[
              { id: 'vip', label: 'VIP Program', icon: <Award className="w-3.5 h-3.5" />, dirty: dirtyVip },
              { id: 'bonus', label: 'Welcome Bonus', icon: <Gift className="w-3.5 h-3.5" />, dirty: dirtyBonus },
              { id: 'install', label: 'Install Guide', icon: <Download className="w-3.5 h-3.5" />, dirty: dirtyInstallSteps },
              { id: 'security', label: 'Security Key', icon: <KeyRound className="w-3.5 h-3.5" />, dirty: false },
            ].map((sec) => {
              const isAct = vipSecuritySection === sec.id;
              return (
                <button
                  key={sec.id}
                  type="button"
                  onClick={() => setVipSecuritySection(sec.id as VipSecuritySection)}
                  className={`min-h-[40px] px-3 py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition ${
                    isAct
                      ? 'bg-[#123524] text-[#D4AF37] shadow-2xs'
                      : 'text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  {sec.icon}
                  <span>{sec.label}</span>
                  {sec.dirty && <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />}
                </button>
              );
            })}
          </div>

          {/* 6A. VIP Program */}
          {vipSecuritySection === 'vip' && (
            <div className="bg-white p-4 sm:p-6 rounded-2xl border border-gray-200/90 shadow-xs space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-gray-100">
                <div>
                  <h3 className="text-base sm:text-lg font-black text-[#123524] flex items-center gap-2">
                    <Award className="w-5 h-5 text-[#D4AF37]" />
                    <span>VIP Membership Program</span>
                  </h3>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Jade Elite, Imperial Gold, Signature V-VIP အဆင့်များနှင့် Point စည်းမျဉ်းများ ပြင်ဆင်ရန်
                  </p>
                </div>
                <button
                  type="button"
                  disabled={savingCategory === 'vip_settings'}
                  onClick={handleSaveVipSettings}
                  className={`w-full sm:w-auto min-h-[42px] px-5 py-2.5 rounded-xl text-xs font-black flex items-center justify-center gap-2 shadow-xs transition ${
                    dirtyVip
                      ? 'bg-[#D4AF37] hover:bg-[#c5a02f] text-[#0B2419]'
                      : 'bg-[#123524] hover:bg-[#1a4a32] text-[#D4AF37]'
                  }`}
                >
                  <Save className="w-4 h-4" />
                  <span>{savingCategory === 'vip_settings' ? 'Saving...' : dirtyVip ? 'Save VIP*' : 'Save VIP Program'}</span>
                </button>
              </div>

              <label className="flex items-center justify-between gap-3 bg-gray-50 p-3.5 rounded-xl border border-gray-200/80 cursor-pointer">
                <span className="text-xs font-bold text-[#123524]">
                  Enable VIP Program (Customer App တွင် VIP Tab ကို ဖွင့်ထားမည်)
                </span>
                <input
                  type="checkbox"
                  checked={localVipSettings.isActive}
                  onChange={(e) => {
                    setLocalVipSettings({ ...localVipSettings, isActive: e.target.checked });
                    setDirtyVip(true);
                  }}
                  className="w-4 h-4 accent-[#123524] shrink-0"
                />
              </label>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Tiers */}
                <div className="space-y-3">
                  <h4 className="font-bold text-xs uppercase tracking-wider text-gray-500 flex items-center gap-1.5">
                    <Star className="w-3.5 h-3.5 text-[#D4AF37]" />
                    <span>1. Membership Tiers & Base Rule</span>
                  </h4>

                  <div className="bg-gray-50/70 p-3.5 rounded-xl border border-gray-200/80">
                    <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Base Rule Text</label>
                    <input
                      type="text"
                      value={localVipSettings.baseRuleText}
                      onChange={(e) => {
                        setLocalVipSettings({ ...localVipSettings, baseRuleText: e.target.value });
                        setDirtyVip(true);
                      }}
                      className="w-full min-h-[40px] px-3 py-2 text-xs bg-white border border-gray-200 rounded-xl focus:border-[#123524] outline-none font-semibold text-gray-800"
                    />
                  </div>

                  {localVipSettings.tiers.map((tier: any, tIdx: number) => (
                    <div key={tier.id} className="p-4 bg-gray-50/70 border border-gray-200/80 rounded-xl space-y-3">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        <div>
                          <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Tier Name</label>
                          <input
                            type="text"
                            value={tier.name}
                            onChange={(e) => updateVipTier(tIdx, 'name', e.target.value)}
                            className="w-full min-h-[40px] px-3 py-2 text-xs bg-white border border-gray-200 rounded-xl focus:border-[#123524] outline-none font-bold"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">
                            Card Color Code
                          </label>
                          <input
                            type="text"
                            value={tier.colorTheme}
                            onChange={(e) => updateVipTier(tIdx, 'colorTheme', e.target.value)}
                            className="w-full min-h-[40px] px-3 py-2 text-xs bg-white border border-gray-200 rounded-xl focus:border-[#123524] outline-none font-mono"
                          />
                        </div>
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        <div>
                          <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Points</label>
                          <input
                            type="number"
                            inputMode="numeric"
                            value={tier.requiredPoints}
                            onChange={(e) => updateVipTier(tIdx, 'requiredPoints', Number(e.target.value))}
                            className="w-full min-h-[40px] px-2.5 py-2 text-xs bg-white border border-gray-200 rounded-xl outline-none font-bold tabular-nums"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Discount %</label>
                          <input
                            type="number"
                            inputMode="numeric"
                            value={tier.discountPercent}
                            onChange={(e) => updateVipTier(tIdx, 'discountPercent', Number(e.target.value))}
                            className="w-full min-h-[40px] px-2.5 py-2 text-xs bg-white border border-gray-200 rounded-xl outline-none text-red-600 font-bold tabular-nums"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Instant Amt</label>
                          <input
                            type="text"
                            value={tier.instantUpgrade || ''}
                            onChange={(e) => updateVipTier(tIdx, 'instantUpgrade', e.target.value)}
                            className="w-full min-h-[40px] px-2.5 py-2 text-xs bg-white border border-gray-200 rounded-xl outline-none text-blue-700 font-bold tabular-nums"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Target Rewards & Rules */}
                <div className="space-y-5">
                  <div className="space-y-2.5">
                    <h4 className="font-bold text-xs uppercase tracking-wider text-gray-500 flex items-center gap-1.5">
                      <Target className="w-3.5 h-3.5 text-[#D4AF37]" />
                      <span>2. Target Rewards (Pre-Jade)</span>
                    </h4>
                    <div className="bg-gray-50/70 p-4 rounded-xl border border-gray-200/80 space-y-3">
                      <div>
                        <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Description</label>
                        <textarea
                          value={localVipSettings.preJadeText}
                          onChange={(e) => {
                            setLocalVipSettings({ ...localVipSettings, preJadeText: e.target.value });
                            setDirtyVip(true);
                          }}
                          rows={2}
                          className="w-full p-2.5 text-xs bg-white border border-gray-200 rounded-xl outline-none font-medium text-gray-700"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="block text-[10px] font-bold text-gray-500 uppercase">Reward Steps</label>
                        {(localVipSettings.preJadeRewards || []).map((reward: string, rIdx: number) => (
                          <div key={rIdx} className="flex items-center gap-2">
                            <input
                              type="text"
                              value={reward}
                              onChange={(e) => {
                                const newR = [...localVipSettings.preJadeRewards];
                                newR[rIdx] = e.target.value;
                                setLocalVipSettings({ ...localVipSettings, preJadeRewards: newR });
                                setDirtyVip(true);
                              }}
                              className="flex-1 min-h-[38px] px-3 py-1.5 text-xs bg-white border border-gray-200 rounded-xl outline-none font-semibold"
                            />
                            <button
                              type="button"
                              onClick={() => {
                                setLocalVipSettings({
                                  ...localVipSettings,
                                  preJadeRewards: localVipSettings.preJadeRewards.filter(
                                    (_: any, i: number) => i !== rIdx
                                  ),
                                });
                                setDirtyVip(true);
                              }}
                              className="w-9 h-9 bg-red-50 text-red-500 rounded-xl hover:bg-red-100 flex items-center justify-center shrink-0"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ))}
                        <button
                          type="button"
                          onClick={() => {
                            setLocalVipSettings({
                              ...localVipSettings,
                              preJadeRewards: [...(localVipSettings.preJadeRewards || []), 'New Reward'],
                            });
                            setDirtyVip(true);
                          }}
                          className="min-h-[36px] text-xs font-bold bg-white border border-gray-200 px-3 py-1.5 rounded-xl hover:bg-gray-100 inline-flex items-center gap-1.5"
                        >
                          <PlusCircle className="w-3.5 h-3.5 text-[#D4AF37]" />
                          <span>Add Reward Step</span>
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2.5">
                    <h4 className="font-bold text-xs uppercase tracking-wider text-gray-500 flex items-center gap-1.5">
                      <ShieldCheck className="w-3.5 h-3.5 text-[#D4AF37]" />
                      <span>3. VIP Rules & Terms</span>
                    </h4>
                    <div className="space-y-2.5 bg-gray-50/70 p-4 rounded-xl border border-gray-200/80 max-h-72 overflow-y-auto">
                      {localVipSettings.rules.map((rule: string, rIdx: number) => (
                        <div key={rIdx} className="flex items-start gap-2">
                          <span className="mt-2 text-xs font-bold text-gray-400 tabular-nums w-4 shrink-0">
                            {rIdx + 1}.
                          </span>
                          <textarea
                            value={rule}
                            onChange={(e) => updateVipRule(rIdx, e.target.value)}
                            rows={2}
                            className="flex-1 p-2 text-xs bg-white border border-gray-200 rounded-xl outline-none font-medium text-gray-700"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              setLocalVipSettings({
                                ...localVipSettings,
                                rules: localVipSettings.rules.filter((_: any, i: number) => i !== rIdx),
                              });
                              setDirtyVip(true);
                            }}
                            className="w-9 h-9 bg-red-50 text-red-500 rounded-xl hover:bg-red-100 flex items-center justify-center shrink-0"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                      <button
                        type="button"
                        onClick={() => {
                          setLocalVipSettings({
                            ...localVipSettings,
                            rules: [...localVipSettings.rules, 'စည်းကမ်းချက်အသစ်...'],
                          });
                          setDirtyVip(true);
                        }}
                        className="min-h-[36px] text-xs font-bold bg-white border border-gray-200 px-3 py-1.5 rounded-xl hover:bg-gray-100 inline-flex items-center gap-1.5"
                      >
                        <PlusCircle className="w-3.5 h-3.5 text-[#D4AF37]" />
                        <span>Add Rule</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 6B. Welcome Bonus */}
          {vipSecuritySection === 'bonus' && (
            <div className="bg-white p-4 sm:p-6 rounded-2xl border border-gray-200/90 shadow-xs space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-gray-100">
                <div>
                  <h3 className="text-base sm:text-lg font-black text-[#123524] flex items-center gap-2">
                    <Gift className="w-5 h-5 text-purple-600" />
                    <span>New User Welcome Bonus</span>
                  </h3>
                  <p className="text-xs text-gray-500 mt-0.5">
                    အကောင့်သစ်ဖွင့်သူများကို Point လက်ဆောင်ပေးမည့် အစီအစဉ်
                  </p>
                </div>
                <button
                  type="button"
                  disabled={savingCategory === 'signup_bonus'}
                  onClick={handleSaveSignUpBonus}
                  className={`w-full sm:w-auto min-h-[42px] px-5 py-2.5 rounded-xl text-xs font-black flex items-center justify-center gap-2 shadow-xs transition ${
                    dirtyBonus
                      ? 'bg-[#D4AF37] hover:bg-[#c5a02f] text-[#0B2419]'
                      : 'bg-[#123524] hover:bg-[#1a4a32] text-[#D4AF37]'
                  }`}
                >
                  <Save className="w-4 h-4" />
                  <span>{savingCategory === 'signup_bonus' ? 'Saving...' : dirtyBonus ? 'Save Bonus*' : 'Save Bonus'}</span>
                </button>
              </div>

              <label className="flex items-center justify-between gap-3 p-3.5 bg-gray-50 rounded-xl border border-gray-200/80 cursor-pointer">
                <span className="text-xs font-bold text-gray-800">
                  Enable Welcome Bonus (ပွိုင့်လက်ဆောင်ပေးမည်)
                </span>
                <input
                  type="checkbox"
                  checked={localSignUpBonus.isActive}
                  onChange={(e) => {
                    setLocalSignUpBonus({ ...localSignUpBonus, isActive: e.target.checked });
                    setDirtyBonus(true);
                  }}
                  className="w-4 h-4 accent-[#123524]"
                />
              </label>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-gray-500 uppercase mb-1">
                    Bonus Points Amount
                  </label>
                  <input
                    type="number"
                    inputMode="numeric"
                    value={localSignUpBonus.points || ''}
                    onChange={(e) => {
                      setLocalSignUpBonus({ ...localSignUpBonus, points: Number(e.target.value) });
                      setDirtyBonus(true);
                    }}
                    className="w-full min-h-[42px] px-3 py-2 text-sm border border-gray-200 rounded-xl font-bold tabular-nums"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-gray-500 uppercase mb-1">Start Date</label>
                  <input
                    type="date"
                    value={localSignUpBonus.startDate}
                    onChange={(e) => {
                      setLocalSignUpBonus({ ...localSignUpBonus, startDate: e.target.value });
                      setDirtyBonus(true);
                    }}
                    className="w-full min-h-[42px] px-3 py-2 text-xs border border-gray-200 rounded-xl font-bold"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-gray-500 uppercase mb-1">End Date</label>
                  <input
                    type="date"
                    value={localSignUpBonus.endDate}
                    onChange={(e) => {
                      setLocalSignUpBonus({ ...localSignUpBonus, endDate: e.target.value });
                      setDirtyBonus(true);
                    }}
                    className="w-full min-h-[42px] px-3 py-2 text-xs border border-gray-200 rounded-xl font-bold"
                  />
                </div>
              </div>
            </div>
          )}

          {/* 6C. PWA Install Guide */}
          {vipSecuritySection === 'install' && (
            <div className="bg-white p-4 sm:p-6 rounded-2xl border border-gray-200/90 shadow-xs space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-gray-100">
                <div>
                  <h3 className="text-base sm:text-lg font-black text-[#123524] flex items-center gap-2">
                    <Download className="w-5 h-5 text-blue-600" />
                    <span>Download App Instructions (PWA Guide)</span>
                  </h3>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Customer App တွင် Download နှိပ်လျှင် ပြသမည့် လမ်းညွှန်အဆင့်များ
                  </p>
                </div>
                <div className="grid grid-cols-2 sm:flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => {
                      if (localInstallSteps.length < 10) {
                        setLocalInstallSteps([
                          ...localInstallSteps,
                          { id: Date.now().toString(), text: '', imageUrl: '' },
                        ]);
                        setDirtyInstallSteps(true);
                      }
                    }}
                    className="min-h-[40px] px-3.5 py-2 bg-gray-100 border border-gray-200 rounded-xl text-xs font-bold hover:bg-gray-200 transition"
                  >
                    + Add Step
                  </button>
                  <button
                    type="button"
                    disabled={savingCategory === 'install_steps'}
                    onClick={handleSaveInstallSteps}
                    className={`min-h-[40px] px-4 py-2 rounded-xl text-xs font-black transition ${
                      dirtyInstallSteps
                        ? 'bg-[#D4AF37] hover:bg-[#c5a02f] text-[#0B2419]'
                        : 'bg-[#123524] hover:bg-[#1a4a32] text-[#D4AF37]'
                    }`}
                  >
                    {savingCategory === 'install_steps'
                      ? 'Saving...'
                      : dirtyInstallSteps
                      ? 'Save Steps*'
                      : 'Save Steps'}
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
                {localInstallSteps.map((step, idx) => (
                  <div
                    key={step.id}
                    className="p-4 bg-gray-50/70 border border-gray-200/80 rounded-2xl relative space-y-3"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-black text-xs text-[#123524] tabular-nums">Step {idx + 1}</span>
                      <button
                        type="button"
                        onClick={() => {
                          setLocalInstallSteps(localInstallSteps.filter((_, i) => i !== idx));
                          setDirtyInstallSteps(true);
                        }}
                        className="w-7 h-7 text-red-500 bg-red-50 hover:bg-red-100 rounded-lg flex items-center justify-center"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <textarea
                      value={step.text}
                      onChange={(e) => {
                        const updated = [...localInstallSteps];
                        updated[idx] = { ...updated[idx], text: e.target.value };
                        setLocalInstallSteps(updated);
                        setDirtyInstallSteps(true);
                      }}
                      className="w-full p-2.5 bg-white border border-gray-200 rounded-xl text-xs font-medium outline-none focus:border-[#123524]"
                      rows={2}
                    />

                    <div className="flex items-center gap-3">
                      <div className="w-14 h-20 bg-gray-200 rounded-xl border border-gray-300 flex items-center justify-center overflow-hidden relative shrink-0">
                        {step.imageUrl ? (
                          <>
                            <img src={step.imageUrl} alt={`Step ${idx + 1}`} className="w-full h-full object-cover" />
                            <button
                              type="button"
                              onClick={() => {
                                const updated = [...localInstallSteps];
                                updated[idx] = { ...updated[idx], imageUrl: '' };
                                setLocalInstallSteps(updated);
                                setDirtyInstallSteps(true);
                              }}
                              className="absolute top-1 right-1 bg-black/70 text-white rounded-full p-0.5"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </>
                        ) : (
                          <ImageIcon className="w-5 h-5 text-gray-400" />
                        )}
                      </div>
                      <label className="min-h-[36px] text-[11px] font-bold text-[#123524] bg-amber-50 px-3 py-2 rounded-xl border border-[#D4AF37]/40 cursor-pointer inline-flex items-center">
                        {uploadingImage === `install_${idx}` ? 'Uploading...' : 'Upload Image'}
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => handleInstallImageUpload(idx, e)}
                          disabled={uploadingImage === `install_${idx}`}
                        />
                      </label>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 6D. AES-256 Encryption Key Rotation */}
          {vipSecuritySection === 'security' && (
            <div className="bg-white p-4 sm:p-6 rounded-2xl border border-gray-200/90 shadow-xs space-y-4">
              <div className="pb-3 border-b border-gray-100">
                <h3 className="text-base sm:text-lg font-black text-[#123524] flex items-center gap-2">
                  <KeyRound className="w-5 h-5 text-orange-500" />
                  <span>AES-256 Encryption Key Rotation</span>
                </h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  Database တစ်ခုလုံးရှိ Data များကို Key အသစ်ဖြင့် အလိုအလျောက် ပြောင်းလဲပေးပါမည်
                </p>
              </div>

              <div className="bg-orange-50 p-3.5 rounded-xl border border-orange-200 text-xs text-orange-900 font-medium leading-relaxed flex items-start gap-2.5">
                <AlertCircle className="w-4 h-4 text-orange-600 shrink-0 mt-0.5" />
                <span>
                  သတိပြုရန်: Key ပြောင်းပြီးပါက Vercel Environment Variables (<code>VITE_SECRET_KEY</code>) တွင်ပါ တူညီသော Key အသစ်ကို ပြောင်းထည့်၍ Redeploy လုပ်ရပါမည်။
                </span>
              </div>

              <div className="flex flex-col sm:flex-row gap-2.5">
                <input
                  type="text"
                  placeholder="Enter New Secret Key (Min 10 Chars)"
                  value={newSecretKey}
                  onChange={(e) => setNewSecretKey(e.target.value)}
                  className="flex-1 min-h-[44px] px-3.5 py-2.5 border border-gray-200 rounded-xl outline-none focus:border-orange-500 font-mono text-xs font-bold"
                />
                <button
                  type="button"
                  disabled={migratingKey}
                  onClick={handleChangeSecretKey}
                  className="min-h-[44px] px-5 py-2.5 bg-orange-600 hover:bg-orange-700 text-white rounded-xl text-xs font-black shadow-xs transition whitespace-nowrap"
                >
                  {migratingKey ? 'Re-Encrypting...' : 'Rotate Key Now'}
                </button>
              </div>
            </div>
          )}
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

            <div className="grid grid-cols-2 gap-2.5 pt-1">
              <button
                type="button"
                disabled={confirmBusy}
                onClick={() => setConfirmDialog(null)}
                className="min-h-[44px] px-4 py-2.5 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-bold transition"
              >
                Cancel
              </button>
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
                className={`min-h-[44px] px-4 py-2.5 rounded-xl text-xs font-black text-white transition ${
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
