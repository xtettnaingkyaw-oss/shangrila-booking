import React, { useState, useEffect, useMemo, useRef } from 'react';
import { collection, addDoc, getDocs, updateDoc, doc } from 'firebase/firestore';
import { db } from '../firebase';
import { encryptText, decryptText } from '../security';
import { AppData, MenuItem, TherapistProfile, formatPrice } from '../shared';
import {
  Sparkles, User, Clock, Plus, Printer, Wifi, WifiOff,
  RefreshCw, CheckCircle, Crown, Percent, ShoppingBag,
  ArrowLeft, History, Search, Banknote, Bluetooth, Settings, Upload, X
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
  qty: number;
}

interface OfflineSaleRecord {
  localId: string;
  invoiceNo: string;
  createdAt: number;
  date: string;
  time: string;
  customerName: string;
  customerPhone: string;
  therapistName: string;
  items: CartItem[];
  subTotal: number;
  discountType: 'percent' | 'fixed';
  discountValue: number;
  discountAmount: number;
  discountReason: string;
  totalPrice: number;
  paymentMethod: string;
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
  customPrintedLogoDataUrl: string; // Loyverse ကဲ့သို့ Printed Receipt အတွက် သီးသန့် Upload တင်ထားသော Logo
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

const OFFLINE_QUEUE_KEY = 'shangrila_pos_offline_queue_v1';
const LOCAL_SALES_HISTORY_KEY = 'shangrila_pos_local_history_v1';
const CACHED_APPDATA_KEY = 'shangrila_pos_cached_appdata_lite_v2';
const POS_PRINT_SETTINGS_KEY = 'shangrila_pos_print_settings_v3';

const DEFAULT_PRINT_SETTINGS: PosPrintSettings = {
  paperWidth: '58mm',
  showLogo: true,
  customPrintedLogoDataUrl: '',
  logoFilterMode: 'auto_gold_extract', // အစိမ်းရင့်နောက်ခံကို အဖြူပြောင်းပြီး ရွှေရောင်တောင်တန်းနှင့် စာသားကိုသာ အမည်းရောင်ထုတ်ပေးမည့် စနစ်
  logoThreshold: 12,
  logoSize: 184,
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
  const [activePosView, setActivePosView] = useState<'register' | 'history' | 'settings'>('register');

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

  // 🌟 Direct Web Bluetooth Printer States 🌟
  const [bluetoothDevice, setBluetoothDevice] = useState<any>(null);
  const [btCharacteristic, setBtCharacteristic] = useState<any>(null);
  const [isPrintingBt, setIsPrintingBt] = useState(false);
  const [processedLogoPreview, setProcessedLogoPreview] = useState<string>('');

  // Digital Logo (ဘယ်ဘက်အကွက်) နှင့် Printed Source Logo (ညာဘက်အကွက်)
  const digitalLogoUrl = defaultLogoImg || localAppData?.branding?.logoUrl || '';
  const printedLogoSourceUrl = printSettings.customPrintedLogoDataUrl || digitalLogoUrl;

  const [posStep, setPosStep] = useState<1 | 2 | 3 | 4>(1);
  const [activeCategory, setActiveCategory] = useState<string | null>(
    localAppData?.categories?.[0]?.id || 'massage'
  );

  const [cart, setCart] = useState<CartItem[]>([]);
  const [customItemName, setCustomItemName] = useState('');
  const [customItemPrice, setCustomItemPrice] = useState('');
  const [showCustomItemForm, setShowCustomItemForm] = useState(false);

  const [therapist1, setTherapist1] = useState<TherapistProfile | null>(null);
  const [therapist2, setTherapist2] = useState<TherapistProfile | null>(null);

  const [saleDate, setSaleDate] = useState<string>(getLocalTodayStr());
  const [saleTime, setSaleTime] = useState<string>(() => {
    const now = new Date();
    return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  });
  const [serviceStatus, setServiceStatus] = useState<'in_progress' | 'completed'>('in_progress');

  const [customerName, setCustomerName] = useState('Walk-in Guest');
  const [customerPhone, setCustomerPhone] = useState('');
  const [foundCustomerPts, setFoundCustomerPts] = useState<number | null>(null);

  const [discountType, setDiscountType] = useState<'percent' | 'fixed'>('percent');
  const [discountValue, setDiscountValue] = useState<number>(0);
  const [discountReason, setDiscountReason] = useState('Walk-in Promo');

  const [paymentMethod, setPaymentMethod] = useState<string>('Cash');
  const [cashReceived, setCashReceived] = useState<string>('');
  const [specialNote, setSpecialNote] = useState('');

  const [activeReceipt, setActiveReceipt] = useState<OfflineSaleRecord | null>(null);
  const [savingSale, setSavingSale] = useState(false);

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

  // 🌟 Find Writable Characteristic from Connected GATT Server 🌟
  const findWritableCharacteristic = async (device: any) => {
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
    throw new Error('Printer write channel not found. Please make sure it is a Bluetooth thermal printer.');
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

        if (!targetDevice.gatt.connected && typeof targetDevice.watchAdvertisements === 'function') {
          try {
            await targetDevice.watchAdvertisements();
          } catch {}
        }

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

  // 🌟 Loyverse-Grade Smart Monochrome Logo Converter 🌟
  // အစိမ်းရင့်နောက်ခံ (#123524) ကို ၁၀၀% အဖြူရောင်ပြောင်းပြီး ရွှေရောင်တောင်တန်းနှင့် စာသား (#D4AF37) ကိုသာ အမည်းရောင် Line-Art အဖြစ် ထုတ်ပေးသည်
  const buildLogoRasterData = async (
    imgUrl: string,
    filterMode: 'auto_gold_extract' | 'bw_threshold',
    thresholdVal: number,
    sizePx: number
  ): Promise<{ rasterBytes: Uint8Array | null; previewDataUrl: string }> => {
    return new Promise((resolve) => {
      if (!imgUrl) {
        resolve({ rasterBytes: null, previewDataUrl: '' });
        return;
      }
      const img = new Image();
      img.crossOrigin = 'Anonymous';
      img.onload = () => {
        try {
          const targetWidth = Math.max(96, Math.min(384, Math.round(sizePx / 8) * 8));
          const aspect = img.height / (img.width || 1);
          const rawHeight = Math.round(targetWidth * aspect);

          const tempCanvas = document.createElement('canvas');
          tempCanvas.width = targetWidth;
          tempCanvas.height = rawHeight;
          const tempCtx = tempCanvas.getContext('2d');
          if (!tempCtx) {
            resolve({ rasterBytes: null, previewDataUrl: '' });
            return;
          }

          tempCtx.fillStyle = '#FFFFFF';
          tempCtx.fillRect(0, 0, targetWidth, rawHeight);
          tempCtx.drawImage(img, 0, 0, targetWidth, rawHeight);

          const rawImgData = tempCtx.getImageData(0, 0, targetWidth, rawHeight);
          const rawPixels = rawImgData.data;

          // ပုံထဲတွင် အဖြူထည်နောက်ခံ ဟုတ်မဟုတ် အနားသတ်ထောင့်များကို စစ်ဆေးခြင်း
          const cornerLum =
            (rawPixels[0] * 0.299 + rawPixels[1] * 0.587 + rawPixels[2] * 0.114);
          const isAlreadyLightBg = cornerLum > 200 || rawPixels[3] < 50;

          // 1-bit pixel matrix တည်ဆောက်ခြင်းနှင့် အပေါ်/အောက် အဖြူသားအပိုများကို Auto-Trim ဖြတ်ထုတ်ခြင်း
          const dotMatrix: boolean[][] = [];
          let firstBlackRow = rawHeight;
          let lastBlackRow = 0;

          for (let y = 0; y < rawHeight; y++) {
            const row: boolean[] = [];
            for (let x = 0; x < targetWidth; x++) {
              const idx = (y * targetWidth + x) * 4;
              const r = rawPixels[idx];
              const g = rawPixels[idx + 1];
              const b = rawPixels[idx + 2];
              const a = rawPixels[idx + 3];

              let isBlack = false;
              if (a > 80) {
                const lum = r * 0.299 + g * 0.587 + b * 0.114;

                if (filterMode === 'auto_gold_extract' && !isAlreadyLightBg) {
                  // အစိမ်းရင့်နောက်ခံတွင် Green > Red ဖြစ်ပြီး၊ ရွှေရောင်/အဖြူရောင် စာသားနှင့် တောင်တန်းတွင် Red > Green နှင့် အလင်းရောင်မြင့်သည်
                  const goldWarmth = r - g;
                  if (goldWarmth >= thresholdVal || lum > 115) {
                    isBlack = true;
                  }
                } else {
                  // သာမန် အဖြူနောက်ခံပေါ်မှ အမည်းရောင် Logo အတွက်
                  const bwCutoff = Math.max(40, Math.min(230, 140 + thresholdVal * 2));
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
            firstBlackRow = Math.max(0, firstBlackRow - 6);
            lastBlackRow = Math.min(rawHeight - 1, lastBlackRow + 6);
          }

          const croppedHeight = Math.max(16, lastBlackRow - firstBlackRow + 1);
          const nBytesPerRow = Math.ceil(targetWidth / 8);
          const bitmapBytes: number[] = [];

          const outCanvas = document.createElement('canvas');
          outCanvas.width = targetWidth;
          outCanvas.height = croppedHeight;
          const outCtx = outCanvas.getContext('2d');
          const outImgData = outCtx ? outCtx.createImageData(targetWidth, croppedHeight) : null;

          for (let y = 0; y < croppedHeight; y++) {
            const srcY = firstBlackRow + y;
            for (let xByte = 0; xByte < nBytesPerRow; xByte++) {
              let byte = 0;
              for (let bit = 0; bit < 8; bit++) {
                const pxCol = xByte * 8 + bit;
                const isBlackDot = pxCol < targetWidth ? dotMatrix[srcY][pxCol] : false;
                if (isBlackDot) {
                  byte |= 1 << (7 - bit);
                }
                if (outImgData && pxCol < targetWidth) {
                  const pIdx = (y * targetWidth + pxCol) * 4;
                  const val = isBlackDot ? 20 : 255;
                  outImgData.data[pIdx] = val;
                  outImgData.data[pIdx + 1] = val;
                  outImgData.data[pIdx + 2] = val;
                  outImgData.data[pIdx + 3] = 255;
                }
              }
              bitmapBytes.push(byte);
            }
          }

          let previewDataUrl = '';
          if (outCtx && outImgData) {
            outCtx.putImageData(outImgData, 0, 0);
            previewDataUrl = outCanvas.toDataURL('image/png');
          }

          const xL = nBytesPerRow & 0xff;
          const xH = (nBytesPerRow >> 8) & 0xff;
          const yL = croppedHeight & 0xff;
          const yH = (croppedHeight >> 8) & 0xff;
          const rasterHeader = [0x1d, 0x76, 0x30, 0x00, xL, xH, yL, yH];

          resolve({
            rasterBytes: new Uint8Array([...rasterHeader, ...bitmapBytes, 0x0a]),
            previewDataUrl
          });
        } catch (e) {
          console.warn('Logo raster error:', e);
          resolve({ rasterBytes: null, previewDataUrl: '' });
        }
      };
      img.onerror = () => resolve({ rasterBytes: null, previewDataUrl: '' });
      img.src = imgUrl;
    });
  };

  useEffect(() => {
    let active = true;
    if (printSettings.showLogo && printedLogoSourceUrl) {
      buildLogoRasterData(
        printedLogoSourceUrl,
        printSettings.logoFilterMode,
        printSettings.logoThreshold,
        printSettings.logoSize
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
    printSettings.logoSize
  ]);

  // 🌟 Handle Custom Printed Receipt Logo Upload (Loyverse Style) 🌟
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

  const uploadSaleToFirebase = async (record: OfflineSaleRecord) => {
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

    const bookingPayload: any = {
      name: encryptText(`${record.customerName} (Walk-in)`),
      phone: encryptText(record.customerPhone || 'Walk-in'),
      service: serviceSummary,
      therapist: record.therapistName || 'Any Available Therapist',
      date: record.date,
      time: record.time,
      paymentMethod: `${record.paymentMethod} (Shop POS)`,
      txId: encryptText(record.invoiceNo),
      totalPrice: Number(record.totalPrice) || 0,
      originalPrice: encryptText(record.subTotal.toString()),
      discountPercent: encryptText(
        record.discountType === 'percent'
          ? record.discountValue.toString()
          : Math.round((record.discountAmount / (record.subTotal || 1)) * 100).toString()
      ),
      discountLabel: encryptText(discountLabelText),
      specialRequest: encryptText(record.note ? `[POS Note]: ${record.note}` : 'Shop Walk-in POS Sale'),
      status: record.serviceStatus,
      createdAt: record.createdAt,
      ...(record.startTimeMillis && { startTimeMillis: record.startTimeMillis }),
      ...(record.expectedEndTimeMillis && { expectedEndTimeMillis: record.expectedEndTimeMillis })
    };

    await addDoc(collection(db, 'bookings'), bookingPayload);

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
  };

  const syncOfflineRecords = async () => {
    if (!navigator.onLine || offlineQueue.length === 0 || isSyncing) return;
    setIsSyncing(true);
    const remaining: OfflineSaleRecord[] = [];
    const syncedIds = new Set<string>();

    for (const record of offlineQueue) {
      try {
        await uploadSaleToFirebase(record);
        syncedIds.add(record.localId);
      } catch (err) {
        console.warn('Sync failed for record:', record.invoiceNo, err);
        remaining.push(record);
      }
    }

    updateOfflineQueue(remaining);

    if (syncedIds.size > 0) {
      const updatedHistory = salesHistory.map((h) =>
        syncedIds.has(h.localId) ? { ...h, synced: true } : h
      );
      setSalesHistory(updatedHistory);
      try {
        localStorage.setItem(LOCAL_SALES_HISTORY_KEY, JSON.stringify(updatedHistory));
      } catch {}
    }

    setIsSyncing(false);
  };

  const handleCheckCustomerPhone = async () => {
    if (!customerPhone.trim() || !isOnline) return;
    try {
      const snap = await getDocs(collection(db, 'users'));
      let found = false;
      snap.forEach((d) => {
        try {
          const data = d.data();
          const decPhone = decryptText(data.phone) || d.id;
          if (decPhone === customerPhone.trim()) {
            found = true;
            const decName = decryptText(data.name);
            const decPts = parseInt(decryptText(data.points) || data.points || '0', 10);
            if (decName) setCustomerName(decName);
            setFoundCustomerPts(isNaN(decPts) ? 0 : decPts);
          }
        } catch {}
      });
      if (!found) setFoundCustomerPts(0);
    } catch {}
  };

  const addServiceToCart = (item: MenuItem) => {
    const existingIdx = cart.findIndex((c) => c.id === item.id && !c.isCustomItem);
    if (existingIdx > -1) {
      const updated = [...cart];
      updated[existingIdx].qty += 1;
      setCart(updated);
    } else {
      const basePrice = Number(item.price) || 0;
      const vvipFull = Number(item.vvipPrice) || 0;
      const vvipExtra = vvipFull > basePrice ? vvipFull - basePrice : 0;

      setCart([
        ...cart,
        {
          cartId: `${item.id}_${Date.now()}`,
          id: item.id,
          name: item.name,
          duration: item.duration,
          price: basePrice,
          isVvipUpgrade: false,
          vvipExtraPrice: vvipExtra,
          vvipIncluded: !!item.vvipIncluded,
          qty: 1
        }
      ]);
    }
  };

  const toggleCartItemVvip = (cartId: string) => {
    setCart(
      cart.map((c) => (c.cartId === cartId ? { ...c, isVvipUpgrade: !c.isVvipUpgrade } : c))
    );
  };

  const updateCartQty = (cartId: string, delta: number) => {
    setCart(
      cart
        .map((c) => (c.cartId === cartId ? { ...c, qty: Math.max(0, c.qty + delta) } : c))
        .filter((c) => c.qty > 0)
    );
  };

  const handleAddCustomItem = (e: React.FormEvent) => {
    e.preventDefault();
    const priceNum = parseInt(customItemPrice, 10);
    if (!customItemName.trim() || isNaN(priceNum) || priceNum <= 0) return;

    setCart([
      ...cart,
      {
        cartId: `custom_${Date.now()}`,
        id: 'custom',
        name: customItemName.trim(),
        price: priceNum,
        isCustomItem: true,
        qty: 1
      }
    ]);
    setCustomItemName('');
    setCustomItemPrice('');
    setShowCustomItemForm(false);
  };

  const subTotal = useMemo(() => {
    return cart.reduce((sum, item) => {
      const unitPrice = item.price + (item.isVvipUpgrade && item.vvipExtraPrice ? item.vvipExtraPrice : 0);
      return sum + unitPrice * item.qty;
    }, 0);
  }, [cart]);

  const discountAmount = useMemo(() => {
    if (discountValue <= 0) return 0;
    if (discountType === 'percent') {
      return Math.min(subTotal, Math.round((subTotal * Math.min(100, discountValue)) / 100));
    }
    return Math.min(subTotal, discountValue);
  }, [subTotal, discountType, discountValue]);

  const finalTotal = Math.max(0, subTotal - discountAmount);
  const pointsEarned = Math.floor(finalTotal / 35000);
  const cashReceivedNum = parseInt(cashReceived, 10) || 0;
  const changeDue = Math.max(0, cashReceivedNum - finalTotal);

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

    const newRecord: OfflineSaleRecord = {
      localId: `pos_${now}_${Math.random().toString(36).slice(2, 7)}`,
      invoiceNo: generateInvoiceNo(),
      createdAt: now,
      date: saleDate,
      time: format12Hour(saleTime),
      customerName: customerName.trim() || 'Walk-in Guest',
      customerPhone: customerPhone.trim(),
      therapistName: combinedTherapist,
      items: [...cart],
      subTotal,
      discountType,
      discountValue,
      discountAmount,
      discountReason: discountReason.trim() || 'Walk-in Discount',
      totalPrice: finalTotal,
      paymentMethod,
      cashReceived: paymentMethod === 'Cash' ? (cashReceivedNum || finalTotal) : finalTotal,
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
        await uploadSaleToFirebase(newRecord);
        newRecord.synced = true;
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

  // 🌟 Web Bluetooth Printer Pairing Function (With Auto-Save for Reconnect) 🌟
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

  // 🌟 Helper to send byte chunks safely over BLE 🌟
  const sendBytesToPrinter = async (writeChar: any, dataBytes: Uint8Array) => {
    const chunkSize = 20;
    for (let i = 0; i < dataBytes.length; i += chunkSize) {
      const chunk = dataBytes.slice(i, i + chunkSize);
      if (writeChar.properties.writeWithoutResponse) {
        await writeChar.writeValueWithoutResponse(chunk);
      } else {
        await writeChar.writeValue(chunk);
      }
      await new Promise((r) => setTimeout(r, 12));
    }
  };

  // 🌟 Loyverse-Style Direct ESC/POS Bluetooth Print 🌟
  const handleBluetoothEscPosPrint = async (customRecord?: OfflineSaleRecord) => {
    const recordToPrint = customRecord || activeReceipt;
    if (!recordToPrint) return;
    setIsPrintingBt(true);

    try {
      let writeChar = btCharacteristic;

      if (!writeChar && bluetoothDevice) {
        try {
          writeChar = await findWritableCharacteristic(bluetoothDevice);
          setBtCharacteristic(writeChar);
        } catch {
          writeChar = null;
        }
      }

      if (!writeChar) {
        writeChar = await handleConnectBluetoothPrinter(false);
        if (!writeChar) {
          setIsPrintingBt(false);
          return;
        }
      }

      const maxCols = printSettings.paperWidth === '80mm' ? 48 : 32;
      const divider = '-'.repeat(maxCols) + '\n';

      const padLine = (left: string, right: string) => {
        const l = left.trim();
        const r = right.trim();
        const spaces = maxCols - l.length - r.length;
        if (spaces <= 1) return `${l} ${r}\n`;
        return `${l}${' '.repeat(spaces)}${r}\n`;
      };

      const ESC = '\x1B';
      const GS = '\x1D';
      const INIT = ESC + '@';
      const ALIGN_CENTER = ESC + 'a\x01';
      const ALIGN_LEFT = ESC + 'a\x00';
      const BOLD_ON = ESC + 'E\x01';
      const BOLD_OFF = ESC + 'E\x00';
      const DOUBLE_HEIGHT = GS + '!\x01';
      const NORMAL_TEXT = GS + '!\x00';
      const CUT_PAPER = GS + 'V\x41\x03';

      const encoder = new TextEncoder();

      // 1. Printer Init & Center Alignment
      await sendBytesToPrinter(writeChar, encoder.encode(INIT + ALIGN_CENTER));

      // 2. Print Clean Loyverse-Style Monochrome Logo
      if (printSettings.showLogo && printedLogoSourceUrl) {
        const { rasterBytes } = await buildLogoRasterData(
          printedLogoSourceUrl,
          printSettings.logoFilterMode,
          printSettings.logoThreshold,
          printSettings.logoSize
        );
        if (rasterBytes) {
          await sendBytesToPrinter(writeChar, rasterBytes);
        }
      }

      // 3. Header & Receipt Content
      let cmd = ALIGN_CENTER + BOLD_ON + DOUBLE_HEIGHT;
      if (printSettings.shopName) {
        cmd += `${printSettings.shopName.toUpperCase()}\n`;
      }
      if (printSettings.subtitle) {
        cmd += NORMAL_TEXT + `${printSettings.subtitle.toUpperCase()}\n`;
      }
      cmd += NORMAL_TEXT + BOLD_OFF;
      if (printSettings.headerText) {
        cmd += `${printSettings.headerText}\n`;
      }
      if (printSettings.footerText) {
        cmd += `${printSettings.footerText}\n`;
      }
      if (printSettings.phone) {
        cmd += `Tel: ${printSettings.phone}\n`;
      }
      cmd += divider;

      cmd += ALIGN_LEFT;
      cmd += padLine('Invoice:', recordToPrint.invoiceNo);
      cmd += padLine('Date/Time:', `${recordToPrint.date} ${recordToPrint.time}`);
      if (printSettings.showCustomerInfo) {
        cmd += padLine(
          'Customer:',
          `${recordToPrint.customerName}${recordToPrint.customerPhone ? ` (${recordToPrint.customerPhone})` : ''}`
        );
      }
      cmd += padLine('Therapist:', recordToPrint.therapistName);
      cmd += divider;

      recordToPrint.items.forEach((item, idx) => {
        const unitPrice = item.price + (item.isVvipUpgrade && item.vvipExtraPrice ? item.vvipExtraPrice : 0);
        const itemTitle = `${idx + 1}. ${item.name}${item.qty > 1 ? ` x${item.qty}` : ''}`;
        const itemPriceStr = formatPrice(unitPrice * item.qty);

        cmd += BOLD_ON + padLine(itemTitle, itemPriceStr) + BOLD_OFF;

        const subDetails = [
          item.duration || '',
          item.isVvipUpgrade ? '(+VVIP Room)' : '',
          item.vvipIncluded ? '(VVIP Free)' : ''
        ]
          .filter(Boolean)
          .join(' ');

        if (subDetails) {
          cmd += `   ${subDetails}\n`;
        }
      });
      cmd += divider;

      cmd += padLine('Subtotal:', formatPrice(recordToPrint.subTotal));
      if (recordToPrint.discountAmount > 0) {
        cmd += padLine(`Discount (${recordToPrint.discountReason}):`, `-${formatPrice(recordToPrint.discountAmount)}`);
      }
      cmd += BOLD_ON + DOUBLE_HEIGHT + padLine('TOTAL:', formatPrice(recordToPrint.totalPrice)) + NORMAL_TEXT + BOLD_OFF;
      cmd += padLine(`Payment (${recordToPrint.paymentMethod}):`, formatPrice(recordToPrint.cashReceived));
      if (recordToPrint.paymentMethod === 'Cash' && recordToPrint.changeDue > 0) {
        cmd += padLine('Change Due:', formatPrice(recordToPrint.changeDue));
      }
      if (recordToPrint.pointsEarned > 0) {
        cmd += padLine('VIP Points Earned:', `+${recordToPrint.pointsEarned} Pts`);
      }
      cmd += divider;

      cmd += ALIGN_CENTER;
      if (printSettings.thankYouText) {
        const lines = printSettings.thankYouText.split('\n');
        lines.forEach((line, i) => {
          if (i === 0) cmd += BOLD_ON + `${line}\n` + BOLD_OFF;
          else cmd += `${line}\n`;
        });
      }
      cmd += `\n\n\n` + CUT_PAPER;

      await sendBytesToPrinter(writeChar, encoder.encode(cmd));
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
    setDiscountValue(0);
    setCashReceived('');
    setSpecialNote('');
    setActiveReceipt(null);
    setPosStep(1);
    const now = new Date();
    setSaleTime(`${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`);
  };

  const paymentOptions = [
    'Cash',
    ...(localAppData?.paymentMethods?.map((pm) => pm.name) || ['KBZ PAY', 'WAVE PAY', 'AYA PAY'])
  ];

  return (
    <div className="min-h-screen bg-gray-100 text-gray-800 flex flex-col font-sans">
      {/* ==========================================
          TOP POS HEADER BAR
         ========================================== */}
      <header className="no-print sticky top-0 z-50 bg-gradient-to-r from-[#123524] via-[#1a4a32] to-[#123524] text-white px-4 py-3 shadow-md border-b border-[#D4AF37]/40 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-3">
          <button
            onClick={() => (window.location.href = '/?mode=admin')}
            className="bg-white/10 hover:bg-white/20 text-[#D4AF37] px-3 py-1.5 rounded-xl text-xs font-bold flex items-center border border-[#D4AF37]/30 transition"
          >
            <ArrowLeft className="w-4 h-4 mr-1" /> Backoffice
          </button>
          <div>
            <h1 className="font-serif font-extrabold text-sm sm:text-base text-[#D4AF37] tracking-wide flex items-center">
              <Crown className="w-4 h-4 mr-1.5" /> SHANGRI-LA WALK-IN POS
            </h1>
            <p className="text-[10px] text-gray-300 font-semibold">Offline-First Point of Sale & Billing</p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Bluetooth Status / Quick Connect Button */}
          <button
            type="button"
            onClick={() => handleConnectBluetoothPrinter(false)}
            className={`px-3 py-1.5 rounded-xl text-[10px] font-bold flex items-center border transition ${
              bluetoothDevice && btCharacteristic
                ? 'bg-green-500/20 text-green-300 border-green-400/40'
                : 'bg-white/10 text-[#D4AF37] border-[#D4AF37]/30 hover:bg-white/20'
            }`}
          >
            <Bluetooth className="w-3.5 h-3.5 mr-1" />
            {bluetoothDevice && btCharacteristic
              ? `Connected: ${bluetoothDevice.name || printSettings.savedPrinterName || 'Printer'}`
              : printSettings.savedPrinterName
              ? `Reconnect ${printSettings.savedPrinterName}`
              : 'Connect BT Printer'}
          </button>

          {isOnline ? (
            <span className="bg-green-500/20 text-green-300 border border-green-400/40 px-2.5 py-1 rounded-full text-[10px] font-bold flex items-center">
              <Wifi className="w-3 h-3 mr-1 text-green-400" /> Online
            </span>
          ) : (
            <span className="bg-amber-500/20 text-amber-300 border border-amber-400/40 px-2.5 py-1 rounded-full text-[10px] font-bold flex items-center animate-pulse">
              <WifiOff className="w-3 h-3 mr-1 text-amber-400" /> Offline
            </span>
          )}

          {offlineQueue.length > 0 && (
            <button
              onClick={syncOfflineRecords}
              disabled={!isOnline || isSyncing}
              className="bg-[#D4AF37] text-[#123524] px-3 py-1 rounded-full text-[10px] font-black flex items-center shadow-sm hover:bg-yellow-400 disabled:opacity-60 transition"
            >
              <RefreshCw className={`w-3 h-3 mr-1 ${isSyncing ? 'animate-spin' : ''}`} />
              {isSyncing ? 'Syncing...' : `Sync (${offlineQueue.length})`}
            </button>
          )}

          <div className="flex bg-black/30 p-0.5 rounded-xl border border-white/10">
            <button
              onClick={() => setActivePosView('register')}
              className={`px-3 py-1.5 rounded-lg text-[10px] font-bold transition ${
                activePosView === 'register' ? 'bg-[#D4AF37] text-[#123524]' : 'text-gray-300 hover:text-white'
              }`}
            >
              POS Register
            </button>
            <button
              onClick={() => setActivePosView('history')}
              className={`px-3 py-1.5 rounded-lg text-[10px] font-bold transition flex items-center ${
                activePosView === 'history' ? 'bg-[#D4AF37] text-[#123524]' : 'text-gray-300 hover:text-white'
              }`}
            >
              <History className="w-3 h-3 mr-1" /> Receipts ({salesHistory.length})
            </button>
            <button
              onClick={() => setActivePosView('settings')}
              className={`px-3 py-1.5 rounded-lg text-[10px] font-bold transition flex items-center ${
                activePosView === 'settings' ? 'bg-[#D4AF37] text-[#123524]' : 'text-gray-300 hover:text-white'
              }`}
            >
              <Settings className="w-3 h-3 mr-1" /> Receipt Settings
            </button>
          </div>
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

                <div className="space-y-1 text-[11px] border-b border-dashed border-gray-300 pb-2.5 mb-2.5">
                  <div className="flex justify-between">
                    <span className="text-gray-500">Invoice:</span>
                    <span className="font-bold">{activeReceipt.invoiceNo}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Date/Time:</span>
                    <span className="font-bold">
                      {activeReceipt.date} {activeReceipt.time}
                    </span>
                  </div>
                  {printSettings.showCustomerInfo && (
                    <div className="flex justify-between">
                      <span className="text-gray-500">Customer:</span>
                      <span className="font-bold">
                        {activeReceipt.customerName}{' '}
                        {activeReceipt.customerPhone ? `(${activeReceipt.customerPhone})` : ''}
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-gray-500">Therapist:</span>
                    <span className="font-bold text-right">{activeReceipt.therapistName}</span>
                  </div>
                </div>

                <div className="space-y-2 border-b border-dashed border-gray-300 pb-3 mb-3">
                  {activeReceipt.items.map((item, idx) => {
                    const unitPrice = item.price + (item.isVvipUpgrade && item.vvipExtraPrice ? item.vvipExtraPrice : 0);
                    return (
                      <div key={idx} className="text-[11px]">
                        <div className="flex justify-between font-bold">
                          <span>
                            {idx + 1}. {item.name} {item.qty > 1 ? `x${item.qty}` : ''}
                          </span>
                          <span>{formatPrice(unitPrice * item.qty)}</span>
                        </div>
                        <div className="text-[10px] text-gray-500 pl-3">
                          {item.duration && <span>{item.duration} </span>}
                          {item.isVvipUpgrade && <span className="text-amber-700 font-bold">(+VVIP Room)</span>}
                          {item.vvipIncluded && <span className="text-green-700 font-bold">(VVIP Free)</span>}
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="space-y-1 text-xs border-b border-dashed border-gray-300 pb-3 mb-3">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Subtotal:</span>
                    <span className="font-bold">{formatPrice(activeReceipt.subTotal)}</span>
                  </div>
                  {activeReceipt.discountAmount > 0 && (
                    <div className="flex justify-between text-green-700">
                      <span>Discount ({activeReceipt.discountReason}):</span>
                      <span className="font-bold">-{formatPrice(activeReceipt.discountAmount)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-sm font-black pt-1 border-t border-gray-200 text-[#123524]">
                    <span>TOTAL:</span>
                    <span>{formatPrice(activeReceipt.totalPrice)}</span>
                  </div>
                  <div className="flex justify-between text-[11px] pt-1">
                    <span className="text-gray-500">Payment ({activeReceipt.paymentMethod}):</span>
                    <span className="font-bold">{formatPrice(activeReceipt.cashReceived)}</span>
                  </div>
                  {activeReceipt.paymentMethod === 'Cash' && activeReceipt.changeDue > 0 && (
                    <div className="flex justify-between text-[11px]">
                      <span className="text-gray-500">Change Due:</span>
                      <span className="font-bold">{formatPrice(activeReceipt.changeDue)}</span>
                    </div>
                  )}
                  {activeReceipt.pointsEarned > 0 && (
                    <div className="flex justify-between text-[10px] bg-yellow-50 p-1.5 rounded border border-yellow-200 mt-1">
                      <span className="font-bold text-yellow-800">VIP Points Earned:</span>
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
            <div className="no-print mt-4 flex flex-col gap-2.5">
              <button
                onClick={() => handleBluetoothEscPosPrint()}
                disabled={isPrintingBt}
                className="w-full py-3.5 bg-gradient-to-r from-[#123524] to-[#1a4a32] text-[#D4AF37] rounded-xl font-black text-xs uppercase tracking-widest flex items-center justify-center shadow-md hover:opacity-95 transition disabled:opacity-50"
              >
                <Printer className="w-4 h-4 mr-2" />
                {isPrintingBt
                  ? 'Printing to Bluetooth Printer...'
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
          VIEW 3: LOYVERSE-STYLE RECEIPT & PRINTER SETTINGS
         ========================================== */}
      {activePosView === 'settings' ? (
        <div className="max-w-6xl w-full mx-auto p-4 sm:p-6 grid grid-cols-1 lg:grid-cols-12 gap-6 animate-fade-in">
          <div className="lg:col-span-7 space-y-5">
            {/* 1. Loyverse-Style Receipt Settings Card */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200 space-y-6">
              <div className="flex items-center justify-between border-b border-gray-100 pb-4">
                <div>
                  <h2 className="text-lg font-bold text-gray-800">Receipt settings</h2>
                  <p className="text-xs text-gray-500">
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

              {/* Loyverse Dual Logo Section: Digital vs Printed Receipt */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <label className="text-sm font-bold text-gray-700">Logo</label>
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

                <div className="grid grid-cols-2 sm:grid-cols-2 gap-6 max-w-md">
                  {/* Left Box: Digital / Emailed Receipt Logo */}
                  <div>
                    <div className="text-xs text-gray-500 mb-2 font-medium">Digital / App receipt</div>
                    <div className="w-36 h-36 rounded-lg border border-gray-200 bg-[#123524] overflow-hidden flex items-center justify-center shadow-sm">
                      {digitalLogoUrl ? (
                        <img src={digitalLogoUrl} alt="Digital Logo" className="w-full h-full object-contain" />
                      ) : (
                        <span className="text-xs text-white">No Logo</span>
                      )}
                    </div>
                  </div>

                  {/* Right Box: Printed Receipt Logo (Monochrome Line Art + Upload Button) */}
                  <div>
                    <div className="text-xs text-gray-500 mb-2 font-medium">Printed receipt</div>
                    <div className="relative w-36 h-36 rounded-lg border border-gray-300 bg-white overflow-hidden flex flex-col justify-between shadow-sm">
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
                            className="max-w-full max-h-24 object-contain"
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
                        className="w-full py-2 bg-[#8bc34a] hover:bg-[#7cb342] text-white font-bold text-xs uppercase tracking-wider transition flex items-center justify-center"
                      >
                        <Upload className="w-3.5 h-3.5 mr-1" /> Upload
                      </button>
                    </div>
                  </div>
                </div>

                {/* Smart Thermal Filter & Contrast Controls */}
                {printSettings.showLogo && (
                  <div className="mt-4 p-3.5 bg-gray-50 rounded-xl border border-gray-200 space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-xs font-bold text-gray-700">Thermal Logo Conversion Mode:</span>
                      <div className="flex gap-1.5">
                        <button
                          type="button"
                          onClick={() => updatePrintSettings({ logoFilterMode: 'auto_gold_extract', logoThreshold: 12 })}
                          className={`px-3 py-1.5 rounded-lg text-[11px] font-bold border transition ${
                            printSettings.logoFilterMode === 'auto_gold_extract'
                              ? 'bg-[#123524] text-[#D4AF37] border-[#123524]'
                              : 'bg-white text-gray-600 border-gray-200'
                          }`}
                        >
                          Auto Extract Gold Logo (အစိမ်းရင့်နောက်ခံဖျောက်)
                        </button>
                        <button
                          type="button"
                          onClick={() => updatePrintSettings({ logoFilterMode: 'bw_threshold', logoThreshold: 0 })}
                          className={`px-3 py-1.5 rounded-lg text-[11px] font-bold border transition ${
                            printSettings.logoFilterMode === 'bw_threshold'
                              ? 'bg-[#123524] text-[#D4AF37] border-[#123524]'
                              : 'bg-white text-gray-600 border-gray-200'
                          }`}
                        >
                          Standard B&W Image
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-[11px] font-bold text-gray-600 mb-1">
                          Logo Sharpness / Contrast ({printSettings.logoThreshold})
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
                        <label className="block text-[11px] font-bold text-gray-600 mb-1">
                          Printed Logo Width ({printSettings.logoSize} px)
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

              {/* Loyverse-Style Text Fields */}
              <div className="space-y-4 pt-2">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs text-gray-500 font-semibold mb-1">Store Title</label>
                    <input
                      type="text"
                      value={printSettings.shopName}
                      onChange={(e) => updatePrintSettings({ shopName: e.target.value })}
                      className="w-full border-b border-gray-300 focus:border-[#123524] py-1.5 text-sm font-bold outline-none bg-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 font-semibold mb-1">Subtitle</label>
                    <input
                      type="text"
                      value={printSettings.subtitle}
                      onChange={(e) => updatePrintSettings({ subtitle: e.target.value })}
                      className="w-full border-b border-gray-300 focus:border-[#123524] py-1.5 text-sm font-bold outline-none bg-transparent"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs text-gray-500 font-semibold mb-1">Header</label>
                  <input
                    type="text"
                    maxLength={500}
                    value={printSettings.headerText}
                    onChange={(e) => updatePrintSettings({ headerText: e.target.value })}
                    placeholder="e.g. အားပေးမှုကို အထူးကျေးဇူးတင်ရှိပါသည်။"
                    className="w-full border-b border-gray-300 focus:border-[#123524] py-1.5 text-sm outline-none bg-transparent"
                  />
                  <div className="text-right text-[10px] text-gray-400 mt-0.5">
                    {printSettings.headerText.length} / 500
                  </div>
                </div>

                <div>
                  <label className="block text-xs text-gray-500 font-semibold mb-1">Footer (Address)</label>
                  <input
                    type="text"
                    maxLength={500}
                    value={printSettings.footerText}
                    onChange={(e) => updatePrintSettings({ footerText: e.target.value })}
                    placeholder="33th(B), Between 65th & 65(A)th Streets, Chan Aye Tharzan Township, Mandalay."
                    className="w-full border-b border-gray-300 focus:border-[#123524] py-1.5 text-sm outline-none bg-transparent"
                  />
                  <div className="text-right text-[10px] text-gray-400 mt-0.5">
                    {printSettings.footerText.length} / 500
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs text-gray-500 font-semibold mb-1">Phone Number</label>
                    <input
                      type="text"
                      value={printSettings.phone}
                      onChange={(e) => updatePrintSettings({ phone: e.target.value })}
                      className="w-full border-b border-gray-300 focus:border-[#123524] py-1.5 text-sm outline-none bg-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 font-semibold mb-1">Closing Note</label>
                    <input
                      type="text"
                      value={printSettings.thankYouText}
                      onChange={(e) => updatePrintSettings({ thankYouText: e.target.value })}
                      className="w-full border-b border-gray-300 focus:border-[#123524] py-1.5 text-sm outline-none bg-transparent"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between pt-3 border-t border-gray-100">
                  <span className="text-sm font-medium text-gray-800">Show customer info</span>
                  <input
                    type="checkbox"
                    checked={printSettings.showCustomerInfo}
                    onChange={(e) => updatePrintSettings({ showCustomerInfo: e.target.checked })}
                    className="w-5 h-5 accent-[#123524]"
                  />
                </div>
              </div>
            </div>

            {/* 2. Bluetooth Hardware & Paper Width Card */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 pb-3">
                <div>
                  <h3 className="text-base font-bold text-[#123524] flex items-center">
                    <Bluetooth className="w-4 h-4 mr-1.5 text-[#D4AF37]" /> Bluetooth Printer & Paper Size
                  </h3>
                  <p className="text-xs text-gray-500">ချိတ်ဆက်ထားသော Printer ကို အလိုအလျောက် မှတ်သားပေးထားပါသည်</p>
                </div>
                <button
                  type="button"
                  onClick={handleForceRefreshApp}
                  className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-xs font-bold flex items-center"
                >
                  <RefreshCw className="w-3.5 h-3.5 mr-1" /> Force Update App
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => handleConnectBluetoothPrinter(true)}
                  className="py-3 px-4 bg-[#123524] text-[#D4AF37] rounded-xl font-bold text-xs flex items-center justify-center shadow-sm hover:bg-[#1a4a32] transition"
                >
                  <Bluetooth className="w-4 h-4 mr-2" />
                  {bluetoothDevice ? `Connected (${bluetoothDevice.name || 'Change'})` : 'Pair Bluetooth Printer'}
                </button>

                <button
                  type="button"
                  disabled={isPrintingBt}
                  onClick={() => handleBluetoothEscPosPrint(samplePreviewReceipt)}
                  className="py-3 px-4 bg-yellow-50 text-[#123524] border border-[#D4AF37] rounded-xl font-bold text-xs flex items-center justify-center hover:bg-yellow-100 transition disabled:opacity-50"
                >
                  <Printer className="w-4 h-4 mr-2" />
                  {isPrintingBt ? 'Printing...' : 'စမ်းသပ် ဘောင်ချာထုတ်ကြည့်မည် (Test Print)'}
                </button>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-1">
                {(['58mm', '80mm'] as const).map((w) => (
                  <button
                    key={w}
                    type="button"
                    onClick={() => updatePrintSettings({ paperWidth: w })}
                    className={`py-2.5 rounded-xl font-black text-xs border-2 transition ${
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

          {/* Right Column: Exact Thermal Receipt Output Preview */}
          <div className="lg:col-span-5">
            <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-200 sticky top-20 space-y-4">
              <div className="text-center">
                <h3 className="text-sm font-extrabold text-[#123524]">Printed Receipt Live Preview</h3>
                <p className="text-[11px] text-gray-500">
                  စာရွက်ပေါ်တွင် အမှန်တကယ် ရိုက်နှိပ်ထွက်လာမည့် 1-Bit Monochrome ပုံစံ
                </p>
              </div>

              <div className="bg-gray-100 p-4 rounded-xl flex justify-center">
                <div className="w-[72mm] bg-white p-4 text-gray-900 font-mono text-xs border border-gray-300 rounded shadow-sm">
                  <div className="text-center border-b border-dashed border-gray-400 pb-2.5 mb-2.5">
                    {printSettings.showLogo && processedLogoPreview && (
                      <img
                        src={processedLogoPreview}
                        alt="Thermal Monochrome Preview"
                        style={{ width: `${Math.round(printSettings.logoSize * 0.6)}px` }}
                        className="mx-auto mb-2 object-contain"
                      />
                    )}
                    {printSettings.shopName && (
                      <h2 className="font-black text-sm uppercase tracking-wider">{printSettings.shopName}</h2>
                    )}
                    {printSettings.subtitle && (
                      <p className="text-[9px] font-bold text-gray-600 uppercase tracking-widest">
                        {printSettings.subtitle}
                      </p>
                    )}
                    {printSettings.headerText && (
                      <p className="text-[10px] font-semibold text-gray-800 mt-0.5">{printSettings.headerText}</p>
                    )}
                    {printSettings.footerText && (
                      <p className="text-[9px] text-gray-600 mt-0.5">{printSettings.footerText}</p>
                    )}
                    {printSettings.phone && <p className="text-[9px] text-gray-600">Tel: {printSettings.phone}</p>}
                  </div>

                  <div className="space-y-1 text-[11px] border-b border-dashed border-gray-300 pb-2 mb-2">
                    <div className="flex justify-between">
                      <span>Invoice:</span>
                      <span className="font-bold">SL-261014-8888</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Date/Time:</span>
                      <span className="font-bold">{samplePreviewReceipt.date} 7:00 PM</span>
                    </div>
                    {printSettings.showCustomerInfo && (
                      <div className="flex justify-between">
                        <span>Customer:</span>
                        <span className="font-bold">Walk-in Guest</span>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span>Therapist:</span>
                      <span className="font-bold">Therapist No-1</span>
                    </div>
                  </div>

                  <div className="border-b border-dashed border-gray-300 pb-2 mb-2 text-[11px]">
                    <div className="flex justify-between font-bold">
                      <span>1. Oil Massage</span>
                      <span>25,000 Ks</span>
                    </div>
                    <div className="text-[10px] text-gray-500 pl-3">60 Mins</div>
                  </div>

                  <div className="space-y-1 text-xs border-b border-dashed border-gray-300 pb-2 mb-2">
                    <div className="flex justify-between">
                      <span>Subtotal:</span>
                      <span className="font-bold">25,000 Ks</span>
                    </div>
                    <div className="flex justify-between text-sm font-black pt-1 border-t border-gray-200">
                      <span>TOTAL:</span>
                      <span>25,000 Ks</span>
                    </div>
                  </div>

                  <div className="text-center text-[10px] text-gray-600 whitespace-pre-line">
                    {printSettings.thankYouText}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : activePosView === 'history' ? (
        /* ==========================================
           VIEW 2: LOCAL & OFFLINE RECEIPTS HISTORY
           ========================================== */
        <div className="max-w-4xl w-full mx-auto p-4 space-y-4">
          <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-200 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold text-[#123524]">Walk-in POS Receipts History</h2>
              <p className="text-xs text-gray-500">Offline နှင့် Online သွင်းထားသော ဘောင်ချာမှတ်တမ်းများ</p>
            </div>
            {offlineQueue.length > 0 && (
              <button
                onClick={syncOfflineRecords}
                disabled={!isOnline || isSyncing}
                className="px-4 py-2.5 bg-[#123524] text-[#D4AF37] rounded-xl text-xs font-bold flex items-center shadow-sm disabled:opacity-50"
              >
                <RefreshCw className={`w-4 h-4 mr-2 ${isSyncing ? 'animate-spin' : ''}`} />
                Sync {offlineQueue.length} Offline Sales to Backoffice
              </button>
            )}
          </div>

          {salesHistory.length === 0 ? (
            <div className="bg-white p-12 rounded-2xl text-center text-gray-400 font-bold border border-gray-200">
              ယနေ့အတွက် Walk-in POS အရောင်းမှတ်တမ်း မရှိသေးပါ။
            </div>
          ) : (
            <div className="space-y-3">
              {salesHistory.map((sale) => (
                <div
                  key={sale.localId}
                  className="bg-white p-4 rounded-2xl shadow-sm border border-gray-200 flex flex-wrap items-center justify-between gap-3 hover:border-[#D4AF37] transition"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-black text-sm text-[#123524]">{sale.invoiceNo}</span>
                      {sale.synced ? (
                        <span className="bg-green-50 text-green-700 border border-green-200 px-2 py-0.5 rounded-full text-[9px] font-bold flex items-center">
                          <CheckCircle className="w-2.5 h-2.5 mr-1" /> Synced to Admin
                        </span>
                      ) : (
                        <span className="bg-amber-50 text-amber-700 border border-amber-200 px-2 py-0.5 rounded-full text-[9px] font-bold">
                          Pending Offline Sync
                        </span>
                      )}
                      <span className="bg-gray-100 text-gray-700 px-2 py-0.5 rounded text-[9px] font-bold">
                        {sale.paymentMethod}
                      </span>
                    </div>
                    <div className="text-xs font-bold text-gray-800 mt-1">
                      {sale.items.map((i) => `${i.name} (x${i.qty})`).join(', ')}
                    </div>
                    <div className="text-[11px] text-gray-500 mt-0.5">
                      Customer: {sale.customerName} | Therapist: {sale.therapistName} | {sale.date} {sale.time}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <div className="text-base font-black text-[#123524]">{formatPrice(sale.totalPrice)}</div>
                      {sale.discountAmount > 0 && (
                        <div className="text-[10px] text-green-600 font-bold">
                          Discount: -{formatPrice(sale.discountAmount)}
                        </div>
                      )}
                    </div>
                    <button
                      onClick={() => setActiveReceipt(sale)}
                      className="p-2.5 bg-yellow-50 text-[#123524] border border-[#D4AF37]/40 rounded-xl hover:bg-yellow-100 transition font-bold text-xs flex items-center"
                    >
                      <Printer className="w-4 h-4 mr-1" /> ဘောင်ချာ
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        /* ==========================================
           VIEW 1: POS REGISTER
           ========================================== */
        <div className="flex-1 max-w-6xl w-full mx-auto p-3 sm:p-5 grid grid-cols-1 lg:grid-cols-12 gap-5">
          <div className="lg:col-span-7 space-y-4">
            <div className="bg-white p-3.5 rounded-2xl shadow-sm border border-gray-200 grid grid-cols-4 gap-1.5">
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
                    className={`py-2.5 px-2 rounded-xl font-extrabold text-[10px] sm:text-xs flex items-center justify-center transition-all ${
                      active
                        ? 'bg-gradient-to-r from-[#123524] to-[#1a4a32] text-[#D4AF37] shadow-sm'
                        : done
                        ? 'bg-yellow-50 text-[#123524] border border-[#D4AF37]/40'
                        : 'bg-gray-50 text-gray-500 hover:bg-gray-100'
                    }`}
                  >
                    <s.icon className="w-3.5 h-3.5 mr-1 flex-shrink-0" />
                    <span className="truncate">{s.label}</span>
                  </button>
                );
              })}
            </div>

            {posStep === 1 && (
              <div className="bg-white p-4 sm:p-5 rounded-2xl shadow-sm border border-gray-200 space-y-4 animate-fade-in">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 pb-3">
                  <div>
                    <h2 className="text-base sm:text-lg font-bold text-[#123524]">Select Services & Sale Items</h2>
                    <p className="text-xs text-gray-500">ဘောင်ချာထဲသို့ ထည့်သွင်းလိုသော ဝန်ဆောင်မှုများကို နှိပ်ပါ</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowCustomItemForm(!showCustomItemForm)}
                    className="bg-yellow-50 hover:bg-yellow-100 text-[#123524] border border-[#D4AF37]/50 px-3 py-2 rounded-xl text-xs font-bold flex items-center shadow-sm transition"
                  >
                    <Plus className="w-3.5 h-3.5 mr-1 text-[#D4AF37]" /> အပိုပစ္စည်း/Sale Item ထည့်ရန်
                  </button>
                </div>

                {showCustomItemForm && (
                  <form
                    onSubmit={handleAddCustomItem}
                    className="bg-gradient-to-r from-yellow-50 to-amber-50/40 p-3.5 rounded-xl border border-[#D4AF37]/40 flex flex-wrap gap-2 items-end animate-fade-in"
                  >
                    <div className="flex-1 min-w-[150px]">
                      <label className="block text-[10px] font-bold text-[#123524] uppercase mb-1">
                        Item / Extra Service Name
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. Carebeau Oil / Extra 30 Mins / Drink"
                        value={customItemName}
                        onChange={(e) => setCustomItemName(e.target.value)}
                        className="w-full p-2.5 bg-white border border-gray-200 rounded-lg text-xs font-bold outline-none focus:border-[#123524]"
                      />
                    </div>
                    <div className="w-32">
                      <label className="block text-[10px] font-bold text-[#123524] uppercase mb-1">Price (Ks)</label>
                      <input
                        type="number"
                        required
                        placeholder="10000"
                        value={customItemPrice}
                        onChange={(e) => setCustomItemPrice(e.target.value)}
                        className="w-full p-2.5 bg-white border border-gray-200 rounded-lg text-xs font-bold outline-none focus:border-[#123524]"
                      />
                    </div>
                    <button
                      type="submit"
                      className="px-4 py-2.5 bg-[#123524] text-[#D4AF37] rounded-lg text-xs font-bold shadow-sm hover:bg-[#1a4a32]"
                    >
                      + ထည့်မည်
                    </button>
                  </form>
                )}

                <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
                  {(localAppData?.categories || []).map((cat) => (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => setActiveCategory(cat.id)}
                      className={`px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap border transition ${
                        activeCategory === cat.id
                          ? 'bg-[#123524] text-[#D4AF37] border-[#123524] shadow-sm'
                          : 'bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100'
                      }`}
                    >
                      {cat.title}
                    </button>
                  ))}
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 max-h-[55vh] overflow-y-auto pr-1">
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
                          onClick={() => addServiceToCart(item)}
                          className={`p-3 rounded-xl border text-left transition-all flex flex-col justify-between relative group ${
                            inCartQty > 0
                              ? 'border-[#123524] bg-green-50/40 ring-1 ring-[#123524]/20'
                              : 'border-gray-200 bg-white hover:border-[#D4AF37] hover:shadow-sm'
                          }`}
                        >
                          {inCartQty > 0 && (
                            <span className="absolute top-2 right-2 w-5 h-5 rounded-full bg-[#123524] text-[#D4AF37] text-[10px] font-black flex items-center justify-center shadow">
                              {inCartQty}
                            </span>
                          )}
                          <div>
                            <div className="font-bold text-xs text-gray-800 line-clamp-2 pr-5 leading-snug">
                              {item.name}
                            </div>
                            {item.duration && (
                              <span className="inline-flex items-center text-[10px] font-bold text-gray-500 bg-gray-100 px-2 py-0.5 rounded mt-1.5">
                                <Clock className="w-2.5 h-2.5 mr-1 text-[#D4AF37]" /> {item.duration}
                              </span>
                            )}
                          </div>
                          <div className="mt-3 pt-2 border-t border-gray-100 flex items-center justify-between">
                            <span className="font-black text-xs sm:text-sm text-[#123524]">
                              {formatPrice(item.price)}
                            </span>
                            <span className="text-[10px] font-bold text-[#D4AF37] bg-[#123524] px-2 py-0.5 rounded">
                              + Add
                            </span>
                          </div>
                        </button>
                      );
                    })}
                </div>

                <div className="pt-3 flex justify-end">
                  <button
                    type="button"
                    disabled={cart.length === 0}
                    onClick={() => setPosStep(2)}
                    className="w-full sm:w-auto px-8 py-3.5 bg-gradient-to-r from-[#123524] to-[#1a4a32] text-[#D4AF37] rounded-xl font-black text-xs uppercase tracking-widest disabled:opacity-50 shadow-md"
                  >
                    Continue to Therapist →
                  </button>
                </div>
              </div>
            )}

            {posStep === 2 && (
              <div className="bg-white p-4 sm:p-5 rounded-2xl shadow-sm border border-gray-200 space-y-4 animate-fade-in">
                <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                  <div>
                    <h2 className="text-base sm:text-lg font-bold text-[#123524]">Assign Therapist</h2>
                    <p className="text-xs text-gray-500">ဝန်ဆောင်မှုပေးမည့် Therapist (၁ ဦး သို့မဟုတ် ၂ ဦး) ရွေးချယ်ပါ</p>
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

                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2.5 max-h-[55vh] overflow-y-auto">
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
                        className={`p-2.5 rounded-xl border text-center transition-all flex flex-col items-center relative ${
                          isSelected
                            ? 'border-[#123524] bg-[#123524] text-[#D4AF37] shadow-md scale-[1.02]'
                            : 'border-gray-200 bg-gray-50/60 text-gray-800 hover:border-[#D4AF37]'
                        }`}
                      >
                        <div className="w-12 h-12 rounded-full overflow-hidden bg-gray-200 mb-2 border border-[#D4AF37] flex items-center justify-center">
                          {t.images?.[0] || t.imageUrl ? (
                            <img src={t.images?.[0] || t.imageUrl} alt={t.name} className="w-full h-full object-cover" />
                          ) : (
                            <User className="w-6 h-6 text-gray-400" />
                          )}
                        </div>
                        <span className="font-bold text-xs truncate w-full">{t.name}</span>
                      </button>
                    );
                  })}
                </div>

                <div className="pt-4 flex justify-between gap-3">
                  <button
                    type="button"
                    onClick={() => setPosStep(1)}
                    className="px-6 py-3.5 rounded-xl font-bold text-xs bg-gray-100 text-gray-600"
                  >
                    ← Back
                  </button>
                  <button
                    type="button"
                    onClick={() => setPosStep(3)}
                    className="flex-1 py-3.5 bg-gradient-to-r from-[#123524] to-[#1a4a32] text-[#D4AF37] rounded-xl font-black text-xs uppercase tracking-widest shadow-md"
                  >
                    Continue to Time & Status →
                  </button>
                </div>
              </div>
            )}

            {posStep === 3 && (
              <div className="bg-white p-4 sm:p-5 rounded-2xl shadow-sm border border-gray-200 space-y-5 animate-fade-in">
                <div className="border-b border-gray-100 pb-3">
                  <h2 className="text-base sm:text-lg font-bold text-[#123524]">Walk-in Time & Room Status</h2>
                  <p className="text-xs text-gray-500">ဧည့်သည် ဝင်ရောက်သည့်အချိန်နှင့် ဝန်ဆောင်မှု အခြေအနေ သတ်မှတ်ပါ</p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-600 mb-1.5">Sale Date (နေ့ရက်)</label>
                    <input
                      type="date"
                      value={saleDate}
                      onChange={(e) => setSaleDate(e.target.value)}
                      className="w-full p-3.5 bg-gray-50 border border-gray-200 rounded-xl font-bold text-sm text-[#123524]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-600 mb-1.5">
                      Start Time (စတင်ချိန်)
                    </label>
                    <input
                      type="time"
                      value={saleTime}
                      onChange={(e) => setSaleTime(e.target.value)}
                      className="w-full p-3.5 bg-gray-50 border border-gray-200 rounded-xl font-black text-base text-[#123524]"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-600 mb-2">
                    Booking / Service Status (Dashboard တွင် ပြသမည့် ပုံစံ)
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setServiceStatus('in_progress')}
                      className={`p-4 rounded-xl border-2 text-left transition ${
                        serviceStatus === 'in_progress'
                          ? 'border-[#123524] bg-green-50/60'
                          : 'border-gray-200 bg-white'
                      }`}
                    >
                      <div className="font-black text-xs sm:text-sm text-[#123524] flex items-center">
                        <Clock className="w-4 h-4 mr-1.5 text-orange-500" /> Start Service Now
                      </div>
                      <p className="text-[10px] text-gray-500 mt-1 font-semibold">
                        ဧည့်သည် ယခု စဝင်နေသည် (Dashboard တွင် In Progress နှင့် အခန်း Busy ပြပေးမည်)
                      </p>
                    </button>

                    <button
                      type="button"
                      onClick={() => setServiceStatus('completed')}
                      className={`p-4 rounded-xl border-2 text-left transition ${
                        serviceStatus === 'completed'
                          ? 'border-[#123524] bg-green-50/60'
                          : 'border-gray-200 bg-white'
                      }`}
                    >
                      <div className="font-black text-xs sm:text-sm text-[#123524] flex items-center">
                        <CheckCircle className="w-4 h-4 mr-1.5 text-green-600" /> Completed Sale
                      </div>
                      <p className="text-[10px] text-gray-500 mt-1 font-semibold">
                        ဝန်ဆောင်မှု ပြီးဆုံးပြီး ငွေရှင်းဘောင်ချာသာ ထုတ်မည်
                      </p>
                    </button>
                  </div>
                </div>

                <div className="pt-4 flex justify-between gap-3">
                  <button
                    type="button"
                    onClick={() => setPosStep(2)}
                    className="px-6 py-3.5 rounded-xl font-bold text-xs bg-gray-100 text-gray-600"
                  >
                    ← Back
                  </button>
                  <button
                    type="button"
                    onClick={() => setPosStep(4)}
                    className="flex-1 py-3.5 bg-gradient-to-r from-[#123524] to-[#1a4a32] text-[#D4AF37] rounded-xl font-black text-xs uppercase tracking-widest shadow-md"
                  >
                    Continue to Payment & Discount →
                  </button>
                </div>
              </div>
            )}

            {posStep === 4 && (
              <div className="bg-white p-4 sm:p-5 rounded-2xl shadow-sm border border-gray-200 space-y-5 animate-fade-in">
                <div className="space-y-3">
                  <h3 className="text-xs font-extrabold uppercase tracking-wider text-[#123524] flex items-center">
                    <User className="w-4 h-4 mr-1.5 text-[#D4AF37]" /> Customer & VIP Points (Optional)
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[10px] font-bold text-gray-500 mb-1">Customer Name</label>
                      <input
                        type="text"
                        value={customerName}
                        onChange={(e) => setCustomerName(e.target.value)}
                        placeholder="Walk-in Guest"
                        className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-gray-500 mb-1">
                        Phone Number (VIP Point ထည့်ပေးရန်)
                      </label>
                      <div className="flex gap-1.5">
                        <input
                          type="tel"
                          value={customerPhone}
                          onChange={(e) => setCustomerPhone(e.target.value)}
                          onBlur={handleCheckCustomerPhone}
                          placeholder="09xxxxxxxxx"
                          className="flex-1 p-3 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold"
                        />
                        {isOnline && (
                          <button
                            type="button"
                            onClick={handleCheckCustomerPhone}
                            className="px-3 bg-yellow-50 border border-[#D4AF37]/50 rounded-xl text-[#123524] text-xs font-bold"
                          >
                            <Search className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                      {foundCustomerPts !== null && (
                        <span className="text-[10px] font-bold text-green-700 mt-1 block">
                          ★ လက်ရှိစုဆောင်းထားသော ပွိုင့်: {foundCustomerPts} Pts (+{pointsEarned} Pts ထပ်တိုးမည်)
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="pt-3 border-t border-gray-100 space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-extrabold uppercase tracking-wider text-[#123524] flex items-center">
                      <Percent className="w-4 h-4 mr-1.5 text-[#D4AF37]" /> Add Discount (လျှော့ဈေး သတ်မှတ်ရန်)
                    </h3>
                    <div className="flex bg-gray-100 p-0.5 rounded-lg">
                      <button
                        type="button"
                        onClick={() => {
                          setDiscountType('percent');
                          setDiscountValue(0);
                        }}
                        className={`px-2.5 py-1 rounded-md text-[10px] font-bold ${
                          discountType === 'percent' ? 'bg-[#123524] text-[#D4AF37]' : 'text-gray-600'
                        }`}
                      >
                        % ရာခိုင်နှုန်း
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setDiscountType('fixed');
                          setDiscountValue(0);
                        }}
                        className={`px-2.5 py-1 rounded-md text-[10px] font-bold ${
                          discountType === 'fixed' ? 'bg-[#123524] text-[#D4AF37]' : 'text-gray-600'
                        }`}
                      >
                        Ks ငွေပမာဏ
                      </button>
                    </div>
                  </div>

                  {discountType === 'percent' && (
                    <div className="flex flex-wrap gap-1.5">
                      {[0, 10, 15, 20, 30, 50].map((pct) => (
                        <button
                          key={pct}
                          type="button"
                          onClick={() => setDiscountValue(pct)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition ${
                            discountValue === pct
                              ? 'bg-[#123524] text-[#D4AF37] border-[#123524]'
                              : 'bg-gray-50 text-gray-700 border-gray-200 hover:border-[#D4AF37]'
                          }`}
                        >
                          {pct === 0 ? 'No Discount' : `${pct}% OFF`}
                        </button>
                      ))}
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[10px] font-bold text-gray-500 mb-1">
                        Discount ({discountType === 'percent' ? '%' : 'Ks'})
                      </label>
                      <input
                        type="number"
                        min={0}
                        value={discountValue || ''}
                        onChange={(e) => setDiscountValue(Math.max(0, parseInt(e.target.value, 10) || 0))}
                        placeholder="0"
                        className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-black text-[#123524]"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-gray-500 mb-1">Discount Label / Reason</label>
                      <input
                        type="text"
                        value={discountReason}
                        onChange={(e) => setDiscountReason(e.target.value)}
                        placeholder="e.g. VIP / Early Bird / Thadingyut"
                        className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold"
                      />
                    </div>
                  </div>
                </div>

                <div className="pt-3 border-t border-gray-100 space-y-3">
                  <h3 className="text-xs font-extrabold uppercase tracking-wider text-[#123524] flex items-center">
                    <Banknote className="w-4 h-4 mr-1.5 text-[#D4AF37]" /> Payment Method (ငွေပေးချေမှု စနစ်)
                  </h3>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {paymentOptions.map((pm) => (
                      <button
                        key={pm}
                        type="button"
                        onClick={() => setPaymentMethod(pm)}
                        className={`py-3 px-2 rounded-xl font-black text-xs border transition flex items-center justify-center ${
                          paymentMethod === pm
                            ? 'bg-gradient-to-r from-[#123524] to-[#1a4a32] text-[#D4AF37] border-[#D4AF37] shadow-sm'
                            : 'bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100'
                        }`}
                      >
                        {pm === 'Cash' && <Banknote className="w-4 h-4 mr-1.5 text-[#D4AF37]" />}
                        {pm}
                      </button>
                    ))}
                  </div>

                  {paymentMethod === 'Cash' && (
                    <div className="bg-green-50/70 p-3.5 rounded-xl border border-green-200 grid grid-cols-2 gap-3 items-center">
                      <div>
                        <label className="block text-[10px] font-bold text-green-800 mb-1">
                          ပေးငွေ (Cash Received - Optional)
                        </label>
                        <input
                          type="number"
                          value={cashReceived}
                          onChange={(e) => setCashReceived(e.target.value)}
                          placeholder={finalTotal.toString()}
                          className="w-full p-2.5 bg-white border border-green-300 rounded-lg text-sm font-black text-[#123524]"
                        />
                      </div>
                      <div className="text-right">
                        <span className="text-[10px] font-bold text-green-700 block">ပြန်အမ်းငွေ (Change Due)</span>
                        <span className="text-lg font-black text-green-800">{formatPrice(changeDue)}</span>
                      </div>
                    </div>
                  )}

                  <div>
                    <label className="block text-[10px] font-bold text-gray-500 mb-1">Remark / Note (Optional)</label>
                    <input
                      type="text"
                      value={specialNote}
                      onChange={(e) => setSpecialNote(e.target.value)}
                      placeholder="အခြား မှတ်ချက်..."
                      className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-semibold"
                    />
                  </div>
                </div>

                <div className="pt-2 flex justify-between gap-3">
                  <button
                    type="button"
                    onClick={() => setPosStep(3)}
                    className="px-5 py-3.5 rounded-xl font-bold text-xs bg-gray-100 text-gray-600"
                  >
                    ← Back
                  </button>
                  <button
                    type="button"
                    disabled={cart.length === 0 || savingSale}
                    onClick={handleCompleteSale}
                    className="flex-1 py-4 bg-gradient-to-r from-[#D4AF37] via-yellow-400 to-[#c59b27] text-[#123524] rounded-xl font-black text-sm uppercase tracking-wider shadow-lg hover:opacity-95 transition flex items-center justify-center"
                  >
                    <Printer className="w-4 h-4 mr-2" />
                    {savingSale ? 'Saving...' : `Complete Sale & Print (${formatPrice(finalTotal)})`}
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className="lg:col-span-5">
            <div className="bg-white rounded-2xl shadow-md border border-[#D4AF37]/40 overflow-hidden sticky top-20">
              <div className="bg-gradient-to-r from-[#123524] to-[#1a4a32] p-4 text-white flex items-center justify-between">
                <div className="flex items-center">
                  <ShoppingBag className="w-4 h-4 mr-2 text-[#D4AF37]" />
                  <h3 className="font-bold text-sm text-[#D4AF37] tracking-wide">Current Walk-in Bill</h3>
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

              <div className="p-4 space-y-3 max-h-[45vh] overflow-y-auto divide-y divide-gray-100">
                {cart.length === 0 ? (
                  <div className="py-10 text-center text-gray-400 text-xs font-bold">
                    ဝန်ဆောင်မှု သို့မဟုတ် Sale Item ရွေးချယ်ထားခြင်း မရှိသေးပါ။
                  </div>
                ) : (
                  cart.map((item) => {
                    const unitPrice = item.price + (item.isVvipUpgrade && item.vvipExtraPrice ? item.vvipExtraPrice : 0);
                    return (
                      <div key={item.cartId} className="pt-3 first:pt-0 flex flex-col gap-1.5">
                        <div className="flex justify-between items-start">
                          <div>
                            <div className="font-bold text-xs text-gray-800">{item.name}</div>
                            {item.duration && <div className="text-[10px] text-gray-500">{item.duration}</div>}
                          </div>
                          <div className="font-black text-xs text-[#123524]">
                            {formatPrice(unitPrice * item.qty)}
                          </div>
                        </div>

                        <div className="flex items-center justify-between mt-1">
                          {!item.isCustomItem && item.vvipExtraPrice && item.vvipExtraPrice > 0 && !item.vvipIncluded ? (
                            <button
                              type="button"
                              onClick={() => toggleCartItemVvip(item.cartId)}
                              className={`px-2 py-1 rounded text-[9px] font-bold border flex items-center transition ${
                                item.isVvipUpgrade
                                  ? 'bg-yellow-100 text-yellow-900 border-[#D4AF37]'
                                  : 'bg-gray-50 text-gray-500 border-gray-200'
                              }`}
                            >
                              <Crown className="w-3 h-3 mr-1 text-[#D4AF37]" />
                              VVIP (+{formatPrice(item.vvipExtraPrice)})
                            </button>
                          ) : item.vvipIncluded ? (
                            <span className="text-[9px] font-bold text-green-700 bg-green-50 px-2 py-0.5 rounded">
                              VVIP Included
                            </span>
                          ) : (
                            <span />
                          )}

                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => updateCartQty(item.cartId, -1)}
                              className="w-6 h-6 rounded bg-gray-100 text-gray-700 font-black text-xs flex items-center justify-center hover:bg-red-100 hover:text-red-600"
                            >
                              -
                            </button>
                            <span className="text-xs font-black w-4 text-center">{item.qty}</span>
                            <button
                              type="button"
                              onClick={() => updateCartQty(item.cartId, 1)}
                              className="w-6 h-6 rounded bg-gray-100 text-gray-700 font-black text-xs flex items-center justify-center hover:bg-green-100 hover:text-green-700"
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

              <div className="px-4 py-3 bg-gray-50 border-t border-gray-100 text-xs space-y-1">
                <div className="flex justify-between">
                  <span className="text-gray-500 font-semibold">Therapist:</span>
                  <span className="font-bold text-[#123524]">
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

              <div className="p-4 bg-gradient-to-b from-yellow-50/50 to-white border-t border-gray-200 space-y-2">
                <div className="flex justify-between text-xs text-gray-600 font-semibold">
                  <span>Subtotal</span>
                  <span className="font-bold">{formatPrice(subTotal)}</span>
                </div>
                {discountAmount > 0 && (
                  <div className="flex justify-between text-xs text-green-700 font-bold">
                    <span>Discount ({discountReason})</span>
                    <span>-{formatPrice(discountAmount)}</span>
                  </div>
                )}
                <div className="flex justify-between items-center pt-2 border-t border-gray-200">
                  <span className="font-extrabold text-sm text-[#123524]">Net Total</span>
                  <span className="text-xl font-black text-[#123524]">{formatPrice(finalTotal)}</span>
                </div>
                {pointsEarned > 0 && (
                  <div className="text-[10px] text-right font-bold text-[#D4AF37]">
                    ★ ဤဘောင်ချာအတွက် +{pointsEarned} VIP Points ရရှိမည်
                  </div>
                )}

                <button
                  type="button"
                  disabled={cart.length === 0 || savingSale}
                  onClick={() => {
                    if (posStep < 4) setPosStep(4);
                    else handleCompleteSale();
                  }}
                  className="w-full mt-2 py-3.5 bg-gradient-to-r from-[#123524] to-[#1a4a32] text-[#D4AF37] rounded-xl font-black text-xs uppercase tracking-widest shadow-md disabled:opacity-50 hover:opacity-95 transition flex items-center justify-center"
                >
                  {posStep < 4 ? 'Proceed to Checkout →' : `Confirm & Print Receipt (${formatPrice(finalTotal)})`}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
