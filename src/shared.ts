import { ref, uploadString, getDownloadURL } from 'firebase/storage';
import { storage } from './firebase';

// 🎨 Theme & Styling
export const THEME = {
  primary: '#123524',
  gold: '#D4AF37',
  background: '#F9FAFB'
};

// 📌 Types & Interfaces
export interface MenuItem {
  id: string;
  name: string;
  price: number;
  vvipPrice?: number;
  duration?: string;
  vvipIncluded?: boolean;
  description?: string;
  imageUrl?: string;
  images?: string[]; // 🌟 Service HD ပုံ ၅ ပုံအထိ သိမ်းဆည်းရန်
  isHidden?: boolean; // 🌟 Customer App တွင် ဖျောက်ထားရန်
  isComingSoon?: boolean; // 🌟 Coming Soon ပြသထားရန်
  comingSoonText?: string;
}

export interface MenuCategory {
  id: string;
  title: string;
  order?: number;
  isHidden?: boolean; // 🌟 Category တစ်ခုလုံး ဖျောက်ထားရန်
  items: MenuItem[];
}

export interface TherapistProfile {
  id: string;
  name: string;
  images: string[];
  imageUrl?: string;
  order: number;
  password?: string;
  onboardingData?: any;
  updateRequested?: boolean;
  // 🌟 Customer App Visibility & Staff App Access Control Fields 🌟
  visibilityStatus?: 'active' | 'coming_soon' | 'hidden';
  isHidden?: boolean;
  isComingSoon?: boolean;
  comingSoonText?: string;
  staffAppAccess?: boolean;
  forceLogoutAt?: number;

  // 🌟 ဝန်ထမ်းအသစ်/အဟောင်း Data ခွဲခြားရန်နှင့် Soft Delete (Archive) စနစ်အတွက် Fields အသစ်များ 🌟
  realName?: string;            // Admin မှတ်သားရန် အမည်ရင်း သို့မဟုတ် မှတ်ချက် (ဥပမာ - "မောင်မောင် - 2026 Nov ဝင်")
  joinedDate?: string;          // အလုပ်စဝင်သည့်ရက်စွဲ (YYYY-MM-DD) - ၎င်းရက်နောက်ပိုင်း Data များကိုသာ Staff App တွင်ပြမည်
  joinedAtMillis?: number;      // အလုပ်စဝင်သည့် Timestamp (ms) - တိကျစွာ စစ်ထုတ်ရန်
  employmentCycleId?: string;   // လူသစ်ပြောင်းတိုင်း အသစ်ထုတ်ပေးမည့် Unique Employment ID
  isArchived?: boolean;         // အလုပ်ထွက်သွားသော ဝန်ထမ်းဟောင်း ဟုတ်/မဟုတ် (Soft Delete Flag)
  archivedAt?: string;          // အလုပ်ထွက်သည့်ရက်စွဲ (YYYY-MM-DD)
  archivedAtMillis?: number;    // အလုပ်ထွက်သည့် Timestamp (ms)
  archiveReason?: string;       // အလုပ်ထွက်သည့် အကြောင်းအရင်း / မှတ်ချက်
  originalBadgeName?: string;   // မူလဝန်ထမ်းနံပါတ် (ဥပမာ - "Therapist No-12")
}

export interface PaymentMethod {
  id: string;
  name: string;
  accountNumber: string;
  accountName: string;
  logoUrl: string;
}

export interface AppBranding {
  logoUrl: string;
  name: string;
  address: string;
  phone1: string;
  phone2: string;
  telegram?: string;
  viber?: string;
  copyright: string;
  shopLat?: number;
  shopLng?: number;
}

export type PromotionType = 'percentage_discount' | 'mini_game' | 'category_discount';
export type MiniGameStyle = 'christmas_santa' | 'lantern_catch';

export const DEFAULT_CHRISTMAS_PROBABILITIES: Record<number, number> = {
  10: 55,
  15: 23,
  20: 14,
  30: 7,
  50: 1,
};

export interface SavedCampaignCard {
  id: string;
  promoType: PromotionType;
  gameStyle?: MiniGameStyle;
  campaignTitle: string;
  boxTitle: string;
  description?: string;
  isPopupActive: boolean;
  isBoxActive: boolean;
  // Type 1: Percentage Discount (In-Spa & Outcall)
  hotelDiscountPercent: number;
  otherDiscountPercent: number;
  // Type 2: Mini Game Campaign Rewards
  gameRewardTiers?: number[];
  rewardProbabilities?: Record<number, number>;
  outcallRewardCap?: number;
  rewardValidityDays?: number;
  telegramAutoNotify?: boolean;
  // Type 3: Service Category Discounts ({ [categoryId]: discountPercent })
  categoryDiscounts?: Record<string, number>;
  // Duration & Visuals
  startDate: string;
  endDate: string;
  themeColor?: string;
  badgeText?: string;
  updatedAt: number;
}

export interface PromotionSettings {
  // Legacy & Master Flags
  isActive?: boolean;
  title?: string;

  // 🌟 Promotion Type Architecture (3 Clear Modes) 🌟
  promoType?: PromotionType;
  gameStyle?: MiniGameStyle;
  description?: string;

  // Box အတွက် Settings
  isBoxActive: boolean;           // 🌟 Customer App Booking မျက်နှာပြင်ပေါ်ရှိ Promo Box
  boxTitle?: string;              // Box ခေါင်းစဉ် (ဥပမာ: "Special Discount")
  
  // Popup & Link အတွက် Settings
  isPopupActive: boolean;         // 🌟 App အဖွင့် Popup နှင့် Shareable Direct Link
  campaignTitle?: string;         // Campaign / Offer ခေါင်းစဉ်
  
  // 🌟 Admin Backoffice All OFF & Card Controls များအတွက် 🌟
  allOff?: boolean;               // Admin မှ All OFF ပိတ်ထားခြင်း ရှိ/မရှိ
  activeCampaignId?: string;
  updatedAt?: number;
  campaigns?: SavedCampaignCard[]; // Saved Promotion & Campaign Cards စာရင်း
  cards?: SavedCampaignCard[];     // Fallback cards array
  
  // Type 1: General % Discount Settings
  hotelDiscountPercent: number;
  otherDiscountPercent: number;

  // Type 2: Mini Game Settings
  gameRewardTiers?: number[];
  rewardProbabilities?: Record<number, number>;
  outcallRewardCap?: number;
  rewardValidityDays?: number;
  telegramAutoNotify?: boolean;

  // Type 3: Service Category Discounts
  categoryDiscounts?: Record<string, number>;

  // Duration
  startDate: string;
  endDate: string;
}

export const resolvePromotionType = (promoOrCard: any): PromotionType => {
  if (!promoOrCard) return 'percentage_discount';
  const raw = promoOrCard.promoType;
  if (raw === 'percentage_discount' || raw === 'mini_game' || raw === 'category_discount') {
    return raw;
  }
  const catMap = promoOrCard.categoryDiscounts;
  if (catMap && typeof catMap === 'object' && Object.values(catMap).some((v) => Number(v) > 0)) {
    return 'category_discount';
  }
  if (Array.isArray(promoOrCard.gameRewardTiers) && promoOrCard.gameRewardTiers.length > 0) {
    return 'mini_game';
  }
  const idLower = String(promoOrCard.id || promoOrCard.activeCampaignId || '').toLowerCase();
  if (
    idLower.includes('thadingyut') ||
    idLower.includes('lantern') ||
    idLower.includes('christmas') ||
    idLower.includes('santa') ||
    idLower.includes('xmas') ||
    idLower.includes('game')
  ) {
    return 'mini_game';
  }
  return 'percentage_discount';
};

export const resolveMiniGameStyle = (promoOrCard: any): MiniGameStyle => {
  if (!promoOrCard) return 'lantern_catch';
  if (promoOrCard.gameStyle === 'christmas_santa' || promoOrCard.gameStyle === 'lantern_catch') {
    return promoOrCard.gameStyle;
  }
  const combined = [
    promoOrCard.id,
    promoOrCard.activeCampaignId,
    promoOrCard.campaignTitle,
    promoOrCard.title,
    promoOrCard.boxTitle,
    promoOrCard.badgeText,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
  if (
    combined.includes('christmas') ||
    combined.includes('santa') ||
    combined.includes('xmas') ||
    combined.includes('ခရစ္စမတ်')
  ) {
    return 'christmas_santa';
  }
  return 'lantern_catch';
};

export const buildDefaultRewardProbabilities = (tiers: number[]): Record<number, number> => {
  const sorted = [...new Set(tiers.map(Number).filter((n) => n > 0))].sort((a, b) => a - b);
  if (sorted.length === 0) return { ...DEFAULT_CHRISTMAS_PROBABILITIES };
  const exactClassic =
    sorted.length === 5 &&
    sorted[0] === 10 &&
    sorted[1] === 15 &&
    sorted[2] === 20 &&
    sorted[3] === 30 &&
    sorted[4] === 50;
  if (exactClassic) return { ...DEFAULT_CHRISTMAS_PROBABILITIES };

  // Dynamic fair distribution: lowest tier gets highest share, 50% (or top tier) stays rare (~1%)
  const result: Record<number, number> = {};
  if (sorted.length === 1) {
    result[sorted[0]] = 100;
    return result;
  }
  const hasTopRare = sorted[sorted.length - 1] >= 50;
  let remaining = hasTopRare ? 99 : 100;
  const activePool = hasTopRare ? sorted.slice(0, -1) : sorted;
  const rawWeights = activePool.map((_, i) => Math.pow(2.2, activePool.length - 1 - i));
  const rawSum = rawWeights.reduce((a, b) => a + b, 0);
  let assigned = 0;
  activePool.forEach((tier, i) => {
    if (i === activePool.length - 1) {
      result[tier] = Math.max(1, remaining - assigned);
    } else {
      const share = Math.max(1, Math.round((rawWeights[i] / rawSum) * remaining));
      result[tier] = share;
      assigned += share;
    }
  });
  if (hasTopRare) {
    result[sorted[sorted.length - 1]] = 1;
  }
  return result;
};

export const pickWeightedMiniGamePrize = (
  rawTiers?: number[],
  customProbabilities?: Record<number, number>
): number => {
  const tiers =
    Array.isArray(rawTiers) && rawTiers.length > 0
      ? [...new Set(rawTiers.map(Number).filter((n) => n > 0))].sort((a, b) => a - b)
      : [10, 15, 20, 30, 50];

  if (tiers.length === 1) return tiers[0];

  const fallbackProbs = buildDefaultRewardProbabilities(tiers);
  const weights = tiers.map((tier) => {
    const custom = customProbabilities ? Number((customProbabilities as any)[tier] ?? (customProbabilities as any)[String(tier)]) : NaN;
    if (!isNaN(custom) && custom >= 0) return custom;
    return fallbackProbs[tier] ?? 1;
  });

  const totalWeight = weights.reduce((a, b) => a + b, 0);
  if (totalWeight <= 0) return tiers[0];

  let randUnit = Math.random();
  try {
    if (typeof window !== 'undefined' && window.crypto?.getRandomValues) {
      const arr = new Uint32Array(1);
      window.crypto.getRandomValues(arr);
      randUnit = arr[0] / 4294967296;
    }
  } catch {}

  let r = randUnit * totalWeight;
  for (let i = 0; i < tiers.length; i++) {
    r -= weights[i];
    if (r < 0) return tiers[i];
  }
  return tiers[0];
};

export const getCategoryDiscountPercent = (
  categoryDiscounts: Record<string, number> | undefined,
  categoryId?: string,
  categoryTitle?: string
): number => {
  if (!categoryDiscounts || typeof categoryDiscounts !== 'object') return 0;
  if (categoryId && Number(categoryDiscounts[categoryId]) > 0) {
    return Number(categoryDiscounts[categoryId]);
  }
  // Alias matching for legacy 'hotel' <-> 'hotel_service'
  if (categoryId === 'hotel_service' && Number(categoryDiscounts['hotel']) > 0) {
    return Number(categoryDiscounts['hotel']);
  }
  if (categoryId === 'hotel' && Number(categoryDiscounts['hotel_service']) > 0) {
    return Number(categoryDiscounts['hotel_service']);
  }
  if (categoryTitle) {
    const titleLower = categoryTitle.toLowerCase();
    for (const [k, v] of Object.entries(categoryDiscounts)) {
      if (Number(v) > 0 && (k.toLowerCase() === titleLower || (titleLower.includes('hotel') && k.toLowerCase().includes('hotel')))) {
        return Number(v);
      }
    }
  }
  return 0;
};

export interface VipTier {
  id: string;
  name: string;
  requiredPoints: number;
  discountPercent: number;
  instantUpgrade: string;
  colorTheme: string;
}

export interface VipSettings {
  isActive: boolean;
  baseRuleText: string;
  preJadeText: string;
  preJadeRewards: string[];
  cumulativeText: string;
  instantUpgradeText: string;
  birthdayStandardText: string;
  birthdayImperialText: string;
  rules: string[];
  tiers: VipTier[];
}

export const DEFAULT_VIP_SETTINGS: VipSettings = {
  isActive: true,
  baseRuleText: "သုံးစွဲငွေ ၃၅,၀၀၀ ကျပ် လျှင် = ၁ ပွိုင့် (1 Point)",
  preJadeText: "Jade Member မဖြစ်မီ (၅၀) ပွိုင့် စုဆောင်းနေစဉ်ကာလအတွင်း (၁)လ အတွင်း ပြည့်မီသော Points များအတွက် အထူး Discount ကို ထပ်ဆောင်းပေးအပ်ပါသည်။",
  preJadeRewards: ['10 Pts = 10% Off', '20 Pts = 20% Off', '30 Pts = 30% Off', '40 Pts = 40% Off', '50 Pts = 50% Off'],
  cumulativeText: "Member အဆင့်များကို အဆင့်မြှင့်တင်ရာတွင် ပွိုင့်များကို သုညမှ ပြန်မစဘဲ ရှိပြီးသားပွိုင့်များအပေါ်တွင် ဆက်လက်ပေါင်းထည့်ပေးမည့် စနစ်ကို အသုံးပြုထားပါသည်။",
  instantUpgradeText: "(တစ်ကြိမ်တည်းဝယ်ယူမှုပြုလုပ်သူများအနေဖြင့် မိမိဝယ်ယူထားသည့်ငွေပမာဏအတိုင်း မိမိကြိုက်နှစ်သက်ရာ Service သို့မဟုတ် Package ကို မိမိဝယ်ယူထားသည့် Member အဆင့်ခံစားခွင့်နှင့်အညီ (၃)လအတွင်း ပြန်လည်သုံးစွဲနိုင်သည်။)",
  birthdayStandardText: "မည်သည့် VIP (Jade, Gold, Imperial) မဆို မိမိမွေးနေ့တွင် မည်သည့် Service ကိုမဆို 50% Discount ခံစားခွင့်ရရှိမည်။",
  birthdayImperialText: "အခြေခံ 20% + မွေးနေ့လတွင် ရရှိထားသော Points အရေအတွက် % ။",
  rules: [
    "ပွိုင့်သက်တမ်းနှင့် Renew ပြုလုပ်ခြင်း: Customer များ စုဆောင်းထားသော ပွိုင့်များ၏ သက်တမ်းမှာ (၆) လ ဖြစ်ပါသည်။",
    "VIP Member အဆင့်သို့ ရောက်ရှိသွားပါက အမြဲတမ်း Discount ခံစားခွင့်မှာမူ ဆက်လက် တည်ရှိနေမည် ဖြစ်ပါသည်။"
  ],
  tiers: [
    { id: 't1', name: 'Jade Elite Member', requiredPoints: 50, discountPercent: 10, instantUpgrade: '၈ သိန်းကျပ်', colorTheme: '#00A86B' },
    { id: 't2', name: 'Imperial Gold VIP', requiredPoints: 100, discountPercent: 15, instantUpgrade: '၁၅ သိန်းကျပ်', colorTheme: '#D4AF37' },
    { id: 't3', name: 'Shangri-La Signature V-VIP', requiredPoints: 150, discountPercent: 20, instantUpgrade: '၂၅ သိန်းကျပ်', colorTheme: '#1E1E1E' }
  ]
};

export interface SpaOperationsSettings {
  isOnlineBookingOpen?: boolean;
  maintenanceTitle?: string;
  maintenanceMessage?: string;
  openingTime?: string;
  closingTime?: string;
  leadTimeMins?: number;
  announcementBanner?: string;
  isAnnouncementActive?: boolean;
}

export interface AppData {
  categories: MenuCategory[];
  therapists: TherapistProfile[];
  archivedTherapists?: TherapistProfile[]; // 🌟 အလုပ်ထွက်သွားသော ဝန်ထမ်းဟောင်းများ၏ Profile မှတ်တမ်း
  paymentMethods: PaymentMethod[];
  branding: AppBranding;
  promotion: PromotionSettings;
  vipSettings: VipSettings;
  signUpBonus?: {
    isActive: boolean;
    points: number;
    startDate: string;
    endDate: string;
  };
  installSteps?: Array<{ id: string; text: string; imageUrl: string }>;
  spaOperations?: SpaOperationsSettings;
  savedCampaignCards?: any[];
}

export interface BookingTelegramNotiLog {
  eventType: 'NEW_BOOKING' | 'STATUS_UPDATE' | 'STAFF_ASSIGNED' | 'MANUAL_RESEND';
  statusKey: string;
  statusLabel: string;
  customerSent: boolean;
  adminSent: boolean;
  staffSent: boolean;
  chatId?: string;
  error?: string;
  updatedBy?: string;
  sentAt: number;
}

export interface Booking extends OutcallTrackingFields {
  id?: string;
  name: string;
  phone: string;
  service: string;
  therapist: string;
  date: string;
  time: string;
  paymentMethod: string;
  txId: string;
  totalPrice: number;
  originalPrice?: number;
  discountPercent?: number;
  discountLabel?: string;
  vipTierName?: string;
  status: 'pending' | 'payment_checking' | 'approved' | 'cancelled' | 'in_progress' | 'completed';
  cancelReason?: string;
  cancelledAt?: number;
  createdAt: number;
  specialRequest?: string;
  startTimeMillis?: number;
  expectedEndTimeMillis?: number;
  actualEndTimeMillis?: number;
  overtimeSeconds?: number;
  pointsAdded?: boolean;
  // 🌟 Outcall & POS Integration Fields 🌟
  durationMins?: number;
  paymentStatus?: 'paid_in_full' | 'deposit_only';
  depositPaid?: number;
  balanceDue?: number;
  posLocalId?: string;
  posItems?: any[];
  cashierName?: string;
  isOnlineBooking?: boolean;
  onlineBookingId?: string;
  isAdminClockIn?: boolean;
  isStaffClockIn?: boolean;
  bookingSource?: string;
  voucherIssued?: boolean;
  customerChatId?: string;
  telegramChatId?: string;
  // 🌟 Telegram Notification Delivery Tracking Fields 🌟
  telegramNotiStatus?: 'sent_customer' | 'admin_only_unlinked' | 'failed' | 'not_sent';
  telegramLastNotiLabel?: string;
  telegramLastNotiAt?: number;
  telegramLastNotiSent?: boolean;
  telegramLastNotiError?: string;
  telegramNotiHistory?: BookingTelegramNotiLog[];
}

export interface OutPass {
  id?: string;
  therapist: string;
  date: string;
  outTimeMillis: number;
  expectedInTimeMillis: number;
  inTimeMillis?: number;
  status: 'out' | 'returned';
  reason: string;
  overtimeSeconds?: number;
}

export interface UserProfile {
  docId?: string;
  phone: string;
  name: string;
  password?: string;
  points: number;
  dob?: string;
  createdAt: number;
  telegramChatId?: string;
  telegramUsername?: string;
  telegramSubscribed?: boolean;
  telegramLinkedAt?: number;
}

export interface AdminProfile {
  username: string;
  password?: string;
  role?: 'super_admin' | 'custom';
  permissions?: string[];
}

// 🛠️ Utility Functions
export const formatPrice = (price: any) => {
  const num = Number(price);
  if (isNaN(num)) return '0 Ks';
  return num.toLocaleString() + ' Ks';
};

export const compressImage = (file: File, maxWidth: number, maxHeight: number): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > maxWidth) {
            height *= maxWidth / width;
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width *= maxHeight / height;
            height = maxHeight;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', 0.8));
      };
      img.onerror = (error) => reject(error);
    };
    reader.onerror = (error) => reject(error);
  });
};

export type OutcallPhase = 'on_the_way' | 'in_service' | 'returning' | 'completed';

export interface OutcallTrackingFields {
  isOutcall?: boolean;
  outcallPhase?: OutcallPhase;
  outcallStatus?: OutcallPhase; // POS, Admin, Staff တစ်ပြေးညီ သုံးနိုင်ရန်
  dispatchedAtMillis?: number;
  arrivedAtMillis?: number;
  serviceFinishedAtMillis?: number;
  completedAtMillis?: number;
  startTimeMillis?: number; // 0 when 'on_the_way', Date.now() when 'in_service'
  durationMinutes?: number;
  returningStartedAt?: number;
  returningStartedAtMillis?: number;
  lastReturnReminderAt?: number;
  lastReturnReminderSentAt?: number;
  returnReminderCount?: number;
  timeUpNotiSent?: boolean;
  overtimeNotified?: boolean;
  clientLocationGps?: {
    lat: number;
    lng: number;
  };
}

/**
 * Hotel & Home Services အချိန်များကို မိနစ်အဖြစ် တစ်ပြေးညီ တွက်ချက်ပေးသော Function
 * - Part Time Outcall Service = 100 Mins
 * - Half Day Service = 6 Hrs (360 Mins)
 * - The Whole Night Service = 12 Hrs (720 Mins)
 * - The Whole Day Service = 12 Hrs (720 Mins)
 */
export function parseOutcallDurationMinutes(
  serviceName: string = '',
  durationStr: string = ''
): number {
  const nameLower = serviceName.toLowerCase();
  const durLower = durationStr.toLowerCase().trim();

  // 1. Explicit matching for the 4 core Hotel & Home Services
  if (nameLower.includes('part time outcall')) return 100;
  if (nameLower.includes('half day')) return 360; // 6 Hrs
  if (nameLower.includes('whole night')) return 720; // 12 Hrs
  if (nameLower.includes('whole day')) return 720; // 12 Hrs

  // 2. Dynamic parsing from duration string (e.g., "6 Hrs", "12 Hrs", "100 Mins")
  const hrMatch = durLower.match(/(\d+(?:\.\d+)?)\s*(?:hr|hrs|hour|hours|နာရီ)/i);
  if (hrMatch) {
    return Math.round(parseFloat(hrMatch[1]) * 60);
  }

  const minMatch = durLower.match(/(\d+)\s*(?:min|mins|minute|minutes|မိနစ်)/i);
  if (minMatch) {
    return parseInt(minMatch[1], 10);
  }

  return 100; // Default Outcall fallback
}

/**
 * ဘောင်ချာ သို့မဟုတ် Booking သည် Hotel & Home Services Category အောက်မှ ဟုတ်မဟုတ် စစ်ဆေးခြင်း
 */
export function isHotelOrHomeServiceBooking(
  bookingOrOrder: any,
  appData?: { categories?: Array<{ id?: string; title?: string; items?: any[] }> }
): boolean {
  if (!bookingOrOrder) return false;
  if (bookingOrOrder.isOutcall || bookingOrOrder.outcallPhase || bookingOrOrder.outcallStatus) {
    return true;
  }

  // 1. Gather all service names/IDs inside the booking or POS order
  const itemNames: string[] = [];
  const itemIds: string[] = [];

  if (typeof bookingOrOrder.service === 'string') itemNames.push(bookingOrOrder.service);
  if (typeof bookingOrOrder.packageName === 'string') itemNames.push(bookingOrOrder.packageName);
  if (typeof bookingOrOrder.categoryTitle === 'string') itemNames.push(bookingOrOrder.categoryTitle);

  if (Array.isArray(bookingOrOrder.items)) {
    bookingOrOrder.items.forEach((it: any) => {
      if (it?.name) itemNames.push(String(it.name));
      if (it?.title) itemNames.push(String(it.title));
      if (it?.id) itemIds.push(String(it.id));
      if (it?.categoryId) itemIds.push(String(it.categoryId));
      if (it?.category) itemNames.push(String(it.category));
    });
  }

  if (Array.isArray(bookingOrOrder.services)) {
    bookingOrOrder.services.forEach((s: any) => {
      if (typeof s === 'string') itemNames.push(s);
      else if (s?.name || s?.title) itemNames.push(s.name || s.title);
    });
  }

  // 2. Dynamic lookup in appData.categories (id === 'hotel' or title includes 'Hotel' / 'Home')
  if (appData?.categories && Array.isArray(appData.categories)) {
    const hotelCategories = appData.categories.filter((cat) => {
      const cid = (cat.id || '').toLowerCase();
      const ctitle = (cat.title || '').toLowerCase();
      return (
        cid === 'hotel' ||
        cid.includes('outcall') ||
        ctitle.includes('hotel') ||
        ctitle.includes('home service')
      );
    });

    for (const cat of hotelCategories) {
      if (cat.items && Array.isArray(cat.items)) {
        for (const catItem of cat.items) {
          const cItemName = (catItem.name || catItem.title || '').toLowerCase().trim();
          const cItemId = String(catItem.id || '').trim();
          if (
            (cItemId && itemIds.includes(cItemId)) ||
            (cItemName && itemNames.some((n) => n.toLowerCase().trim() === cItemName))
          ) {
            return true;
          }
        }
      }
    }
  }

  // 3. Keyword fallback for standard 4 services & future Hotel/Home items
  const combinedText = itemNames.join(' ').toLowerCase();
  const outcallKeywords = [
    'outcall',
    'hotel & home',
    'hotel service',
    'home service',
    'part time outcall',
    'half day service',
    'the whole night service',
    'the whole day service',
  ];

  return outcallKeywords.some((kw) => combinedText.includes(kw));
}

/**
 * 🌟 ဝန်ထမ်းသစ်၏ Staff App တွင် ဝန်ထမ်းဟောင်း၏ Data များ (Fine, Loan, Deposit, Payslip, Booking)
 * လုံးဝ မရောထွေးစေရန် စစ်ထုတ်ပေးသော Universal Helper Function
 */
export function isRecordBelongingToCurrentTherapist(
  record: any,
  therapist?: TherapistProfile | null
): boolean {
  if (!record || !therapist) return false;

  // ၁။ Record တွင် archived ဖြစ်ကြောင်း သို့မဟုတ် အခြား cycleId ဖြစ်ကြောင်း သတ်မှတ်ထားလျှင် ဖယ်ထုတ်မည်
  if (record.isArchivedStaffRecord && !therapist.isArchived) {
    return false;
  }

  // ၂။ နှစ်ဖက်လုံးတွင် employmentCycleId ရှိပါက တူညီမှသာ လက်ခံမည်
  if (therapist.employmentCycleId && record.employmentCycleId) {
    return therapist.employmentCycleId === record.employmentCycleId;
  }

  // ၃။ ဝန်ထမ်းသစ်တွင် joinedDate သို့မဟုတ် joinedAtMillis ရှိပါက အလုပ်စဝင်သည့်ရက်မတိုင်မီက Data အဟောင်းများကို ဖယ်ထုတ်မည်
  if (therapist.joinedDate) {
    const recDateStr = String(record.date || record.createdAtDate || '').slice(0, 10);
    if (/^\d{4}-\d{2}-\d{2}$/.test(recDateStr) && recDateStr < therapist.joinedDate) {
      return false;
    }
  }

  if (therapist.joinedAtMillis && typeof record.createdAt === 'number') {
    // joinedDate ၏ မနက် 00:00:00 မတိုင်မီ သွင်းထားသော မှတ်တမ်းဟောင်းများကို ဖယ်ထုတ်မည်
    const joinedDayStart = therapist.joinedDate
      ? new Date(`${therapist.joinedDate}T00:00:00`).getTime()
      : therapist.joinedAtMillis;
    if (record.createdAt < joinedDayStart) {
      return false;
    }
  }

  return true;
}

// 🚀 Firebase Storage Upload Function
export const uploadBase64ToStorage = async (base64String: string, folderName: string, fileName: string): Promise<string> => {
  try {
    const storageRef = ref(storage, `${folderName}/${fileName}`); 
    await uploadString(storageRef, base64String, 'data_url');
    const downloadURL = await getDownloadURL(storageRef);
    return downloadURL;
  } catch (error) {
    console.error("Storage upload error:", error);
    throw new Error("Image upload failed");
  }
};
