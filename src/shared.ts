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
}

export interface MenuCategory {
  id: string;
  title: string;
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
  isActive: boolean;
  title: string;
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

export interface Booking {
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
  createdAt: number;
  specialRequest?: string;
  startTimeMillis?: number;
  expectedEndTimeMillis?: number;
  actualEndTimeMillis?: number;
  overtimeSeconds?: number;
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
