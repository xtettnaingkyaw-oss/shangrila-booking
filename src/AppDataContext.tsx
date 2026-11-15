import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { collection, getDocs, doc, getDoc } from 'firebase/firestore';
import { db } from './firebase';
import { AppData, TherapistProfile, MenuCategory, DEFAULT_VIP_SETTINGS } from './shared';

interface AppDataContextProps {
  appData: AppData | null;
  loading: boolean;
  refreshAppData: () => Promise<void>;
}

const AppDataContext = createContext<AppDataContextProps>({
  appData: null,
  loading: true,
  refreshAppData: async () => {},
});

export const useAppStore = () => useContext(AppDataContext);

export const AppDataProvider = ({ children }: { children: ReactNode }) => {
  const [appData, setAppData] = useState<AppData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchAllData = async () => {
    setLoading(true);
    try {
      // 1. Fetch Settings (App Data)
      const settingsSnap = await getDoc(doc(db, 'settings', 'appData'));
      const settingsData = settingsSnap.exists() ? settingsSnap.data() : {};

      // 2. Fetch Therapists (Active နှင့် Archived ဝန်ထမ်းဟောင်းများကို ခွဲထုတ်ခြင်း)
      const therapistsSnap = await getDocs(collection(db, 'therapists'));
      const activeTherapistsList: TherapistProfile[] = [];
      const archivedTherapistsList: TherapistProfile[] = [];

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

      activeTherapistsList.sort((a, b) => (a.order || 0) - (b.order || 0));
      archivedTherapistsList.sort(
        (a, b) => (b.archivedAtMillis || 0) - (a.archivedAtMillis || 0)
      );

      // 3. Fetch Categories
      const categoriesSnap = await getDocs(collection(db, 'categories'));
      const categoriesList: MenuCategory[] = [];
      categoriesSnap.forEach((docSnap) => categoriesList.push(docSnap.data() as MenuCategory));
      categoriesList.sort((a, b) => (a.order || 0) - (b.order || 0));

      // Merge Data
      const mergedData: AppData = {
        vipSettings: settingsData.vipSettings || DEFAULT_VIP_SETTINGS,
        branding: settingsData.branding || {},
        promotion: settingsData.promotion || {},
        signUpBonus: settingsData.signUpBonus || {},
        paymentMethods: settingsData.paymentMethods || [],
        installSteps: settingsData.installSteps || [],
        spaOperations: settingsData.spaOperations || {},
        savedCampaignCards: settingsData.savedCampaignCards || [],
        therapists: activeTherapistsList,
        archivedTherapists: archivedTherapistsList,
        categories: categoriesList,
      };

      setAppData(mergedData);
    } catch (error) {
      console.error("Error fetching global app data:", error);
    } finally {
      setLoading(false);
    }
  };

  // Run only ONCE when the app starts
  useEffect(() => {
    fetchAllData();
  }, []);

  return (
    <AppDataContext.Provider value={{ appData, loading, refreshAppData: fetchAllData }}>
      {children}
    </AppDataContext.Provider>
  );
};
