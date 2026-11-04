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
}

export interface MenuCategory {
  id: string;
  title: string;
  order?: number;
  items: MenuItem[];
}

export interface TherapistProfile {
  id: string;
  name: string;
  images: string[];
  order: number;
  password?: string;
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
  copyright: string;
  shopLat?: number;
  shopLng?: number;
}

export interface PromotionSettings {
  // Box အတွက် Settings
  isBoxActive: boolean;           // 🌟 Customer App ထဲက Box အဟောင်းအတွက်
  boxTitle?: string;              // Box ခေါင်းစဉ် (ဥပမာ: "Special Discount")
  
  // Popup/Campaign အတွက် Settings
  isPopupActive: boolean;         // 🌟 App အဖွင့်မှာတက်လာမယ့် Popup အတွက်
  campaignTitle?: string;         // Popup/Game ခေါင်းစဉ် (ဥပမာ: "သီတင်းကျွတ် အထူးပရိုမိုးရှင်း")
  
  // 🌟 အသစ်ထပ်တိုးရန် (Admin Backoffice All OFF & Card Controls များအတွက်) 🌟
  allOff?: boolean;               // Admin မှ All OFF ပိတ်ထားခြင်း ရှိ/မရှိ
  campaigns?: any[];              // Saved Promotion & Campaign Cards စာရင်း
  cards?: any[];                  // Fallback cards array
  
  // အခြား Settings
  hotelDiscountPercent: number;
  otherDiscountPercent: number;
  startDate: string;
  endDate: string;
}

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

export interface AppData {
  categories: MenuCategory[];
  therapists: TherapistProfile[];
  paymentMethods: PaymentMethod[];
  branding: AppBranding;
  promotion: PromotionSettings;
  vipSettings: VipSettings;
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
  startTimeMillis?: number; // 0 when 'on_the_way', Date.now() when 'in_service'
  durationMinutes?: number;
  returningStartedAt?: number;
  lastReturnReminderAt?: number;
  returnReminderCount?: number;
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

// 🚀 Firebase Storage Upload Function (အသစ်ထည့်သွင်းထားသည်)
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


