import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { collection, getDocs, doc, getDoc } from 'firebase/firestore';
import { db } from './firebase';
import {
  AppData,
  TherapistProfile,
  MenuCategory,
  AppBranding,
  PaymentMethod,
  PromotionSettings,
  DEFAULT_VIP_SETTINGS
} from './shared';

export const CACHED_APPDATA_KEY = 'shangrila_pos_cached_appdata_lite_v2';

export const DEFAULT_BRANDING: AppBranding = {
  logoUrl: '',
  name: "The Shangri-La",
  address: "33th(B) St, Between 65th & 65th(A) Sts, Mandalay",
  phone1: "09-458884517",
  phone2: "09-770072190",
  copyright: "© 2026 The Shangri-La Men's Retreat."
};

export const DEFAULT_PAYMENT_METHODS: PaymentMethod[] = [
  { id: 'p1', name: 'KBZ PAY', accountNumber: '09458888510', accountName: 'Htet Naing Kyaw', logoUrl: '' }
];

export const DEFAULT_THERAPISTS: TherapistProfile[] = Array.from({ length: 15 }, (_, i) => ({
  id: `t_${i}`,
  name: `Therapist No-${i + 1}`,
  images: [],
  order: i,
  password: ''
}));

export const DEFAULT_PROMOTION: PromotionSettings = {
  isBoxActive: false,
  isPopupActive: false,
  hotelDiscountPercent: 10,
  otherDiscountPercent: 20,
  startDate: '',
  endDate: ''
};

export const DEFAULT_CATEGORIES: MenuCategory[] = [
  {
    id: 'massage',
    title: 'Massage',
    items: [
      { id: 'm1', name: 'Traditional Massage', price: 25000, duration: '60 Mins' },
      { id: 'm2', name: 'Aroma Oil Massage', price: 35000, duration: '60 Mins' },
      { id: 'm3', name: 'Deep Tissue Sport Massage', price: 40000, duration: '90 Mins' },
      { id: 'm4', name: 'Special VIP Package', price: 60000, duration: '120 Mins' }
    ]
  },
  {
    id: 'hotel',
    title: 'Hotel & Home Services',
    items: [
      { id: 'h1', name: 'Part Time Outcall Service', price: 70000, duration: '100 Mins' },
      { id: 'h2', name: 'VVIP Master Room', price: 90000, duration: '120 Mins' }
    ]
  }
];

export const DEFAULT_INSTALL_STEPS = [
  { id: '1', text: 'Browser ၏ Menu (⋮) သို့မဟုတ် Share icon ကိုနှိပ်ပါ။', imageUrl: '' },
  { id: '2', text: '"Install app" သို့မဟုတ် "Add to Home Screen" ကို ရွေးချယ်ပါ။', imageUrl: '' },
  { id: '3', text: '"Install" သို့မဟုတ် "Add" ကို နှိပ်ပါ။ ဖုန်း Screen တွင် App အဖြစ် ရောက်ရှိသွားပါမည်။', imageUrl: '' }
];

export const FALLBACK_APPDATA: AppData = {
  categories: DEFAULT_CATEGORIES,
  therapists: DEFAULT_THERAPISTS,
  archivedTherapists: [],
  branding: DEFAULT_BRANDING,
  paymentMethods: DEFAULT_PAYMENT_METHODS,
  promotion: DEFAULT_PROMOTION,
  vipSettings: DEFAULT_VIP_SETTINGS,
  installSteps: DEFAULT_INSTALL_STEPS
};

export const getCachedAppData = (): AppData | null => {
  try {
    const cached = localStorage.getItem(CACHED_APPDATA_KEY);
    if (cached) {
      const parsed = JSON.parse(cached);
      if (parsed && parsed.categories?.length > 0) {
        return {
          ...FALLBACK_APPDATA,
          ...parsed,
          branding: { ...DEFAULT_BRANDING, ...(parsed.branding || {}) },
          vipSettings: parsed.vipSettings || DEFAULT_VIP_SETTINGS,
          promotion: { ...DEFAULT_PROMOTION, ...(parsed.promotion || {}) }
        };
      }
    }
  } catch {
    // Ignore invalid localStorage payload
  }
  return null;
};

interface AppDataContextProps {
  appData: AppData | null;
  loading: boolean;
  refreshAppData: () => Promise<void>;
  setAppData: React.Dispatch<React.SetStateAction<AppData | null>>;
}

const AppDataContext = createContext<AppDataContextProps>({
  appData: null,
  loading: true,
  refreshAppData: async () => {},
  setAppData: () => {},
});

export const useAppStore = () => useContext(AppDataContext);

export const AppDataProvider = ({ children }: { children: ReactNode }) => {
  const [appData, setAppData] = useState<AppData | null>(() => {
    const cached = getCachedAppData();
    if (cached) return cached;
    const isPos = typeof window !== 'undefined' && window.location.search.includes('mode=pos');
    if ((typeof navigator !== 'undefined' && !navigator.onLine) || isPos) {
      return FALLBACK_APPDATA;
    }
    return null;
  });
  const [loading, setLoading] = useState(true);

  const fetchAllData = useCallback(async () => {
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      setAppData((prev) => prev || getCachedAppData() || FALLBACK_APPDATA);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      // Single consolidated startup fetch (prevents duplicate reads across App.tsx and AppDataContext)
      const [settingsSnap, therapistsSnap, categoriesSnap] = await Promise.all([
        getDoc(doc(db, 'settings', 'appData')).catch((err) => {
          console.warn('Settings fetch warning:', err);
          return null;
        }),
        getDocs(collection(db, 'therapists')).catch((err) => {
          console.warn('Therapists fetch warning:', err);
          return null;
        }),
        getDocs(collection(db, 'categories')).catch((err) => {
          console.warn('Categories fetch warning:', err);
          return null;
        })
      ]);

      const settingsData = settingsSnap && settingsSnap.exists() ? settingsSnap.data() : {};

      const activeTherapistsList: TherapistProfile[] = [];
      const archivedTherapistsList: TherapistProfile[] = [];

      if (therapistsSnap && !therapistsSnap.empty) {
        therapistsSnap.forEach((docSnap) => {
          const data = docSnap.data() as TherapistProfile;
          const profile: TherapistProfile = {
            ...data,
            id: data.id || docSnap.id,
          };
          if (profile.isArchived) {
            archivedTherapistsList.push(profile);
          } else {
            activeTherapistsList.push(profile);
          }
        });
      }

      activeTherapistsList.sort((a, b) => (a.order || 0) - (b.order || 0));
      archivedTherapistsList.sort((a, b) => (b.archivedAtMillis || 0) - (a.archivedAtMillis || 0));

      const categoriesList: MenuCategory[] = [];
      if (categoriesSnap && !categoriesSnap.empty) {
        categoriesSnap.forEach((docSnap) => categoriesList.push(docSnap.data() as MenuCategory));
        categoriesList.sort((a, b) => (a.order || 0) - (b.order || 0));
      }

      const resolvedCategories =
        categoriesList.length > 0
          ? categoriesList
          : Array.isArray(settingsData.categories) && settingsData.categories.length > 0
          ? settingsData.categories
          : DEFAULT_CATEGORIES;

      const resolvedTherapists =
        activeTherapistsList.length > 0 ? activeTherapistsList : DEFAULT_THERAPISTS;

      const hasRemoteData =
        Boolean(settingsSnap && settingsSnap.exists()) ||
        activeTherapistsList.length > 0 ||
        categoriesList.length > 0;

      if (hasRemoteData) {
        const mergedData: AppData = {
          vipSettings: settingsData.vipSettings || DEFAULT_VIP_SETTINGS,
          branding: { ...DEFAULT_BRANDING, ...(settingsData.branding || {}) },
          promotion: { ...DEFAULT_PROMOTION, ...(settingsData.promotion || {}) },
          signUpBonus: settingsData.signUpBonus || undefined,
          paymentMethods:
            Array.isArray(settingsData.paymentMethods) && settingsData.paymentMethods.length > 0
              ? settingsData.paymentMethods
              : DEFAULT_PAYMENT_METHODS,
          installSteps:
            Array.isArray(settingsData.installSteps) && settingsData.installSteps.length > 0
              ? settingsData.installSteps
              : DEFAULT_INSTALL_STEPS,
          spaOperations: settingsData.spaOperations || undefined,
          savedCampaignCards: settingsData.savedCampaignCards || [],
          therapists: resolvedTherapists,
          archivedTherapists: archivedTherapistsList,
          categories: resolvedCategories,
        };

        setAppData(mergedData);

        // Save lightweight offline cache (strip heavy base64 images to avoid QuotaExceededError)
        try {
          const liteCache = {
            ...mergedData,
            therapists: mergedData.therapists.map((t) => ({ ...t, images: t.images?.slice(0, 1) || [] })),
            archivedTherapists: []
          };
          localStorage.setItem(CACHED_APPDATA_KEY, JSON.stringify(liteCache));
        } catch {
          // Ignore storage quota warnings
        }
      } else {
        setAppData((prev) => prev || getCachedAppData() || FALLBACK_APPDATA);
      }
    } catch (error) {
      console.warn('Error fetching global app data, falling back to cache:', error);
      setAppData((prev) => prev || getCachedAppData() || FALLBACK_APPDATA);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAllData();
  }, [fetchAllData]);

  return (
    <AppDataContext.Provider value={{ appData, loading, refreshAppData: fetchAllData, setAppData }}>
      {children}
    </AppDataContext.Provider>
  );
};
