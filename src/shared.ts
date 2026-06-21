// src/shared.ts
import { useState, useEffect } from 'react';

// --- Theme & Constants ---
export const THEME = { primary: '#123524', gold: '#D4AF37', textGray: '#4a5568' };

export const ALL_TIME_SLOTS = ["6:00 AM", "6:30 AM", "7:00 AM", "7:30 AM", "8:00 AM", "8:30 AM", "9:00 AM", "9:30 AM", "10:00 AM", "10:30 AM", "11:00 AM", "11:30 AM", "12:00 PM", "12:30 PM", "1:00 PM", "1:30 PM", "2:00 PM", "2:30 PM", "3:00 PM", "3:30 PM", "4:00 PM", "4:30 PM", "5:00 PM", "5:30 PM", "6:00 PM", "6:30 PM", "7:00 PM", "7:30 PM", "8:00 PM", "8:30 PM", "9:00 PM"];

// --- Types & Interfaces ---
export interface MenuItem { id: string; name: string; price: number; duration: string; vvipPrice?: number; vvipIncluded?: boolean; }
export interface MenuCategory { id: string; title: string; items: MenuItem[]; }
export interface TherapistProfile { id: string; name: string; images: string[]; order: number; password?: string; }
export interface Booking { id?: string; name: string; phone: string; service: string; therapist: string; date: string; time: string; paymentMethod: string; txId: string; totalPrice: number; status: 'pending' | 'payment_checking' | 'approved' | 'in_progress' | 'completed' | 'cancelled'; cancelReason?: string; specialRequest?: string; createdAt: number; startTimeMillis?: number; expectedEndTimeMillis?: number; actualEndTimeMillis?: number; overtimeSeconds?: number; }
export interface OutPass { id?: string; therapist: string; date: string; outTimeMillis: number; inTimeMillis?: number; expectedInTimeMillis: number; status: 'out' | 'returned'; overtimeSeconds?: number; reason?: string; }
export interface AppBranding { logoUrl: string; address: string; phone1: string; phone2: string; copyright: string; name: string; shopLat?: number; shopLng?: number; }
export interface PaymentMethod { id: string; name: string; accountNumber: string; accountName: string; logoUrl: string; }
export interface PromotionSettings { isActive: boolean; hotelDiscountPercent: number; otherDiscountPercent: number; startDate: string; endDate: string; }
export interface AppData { therapists: TherapistProfile[]; categories: MenuCategory[]; branding: AppBranding; paymentMethods: PaymentMethod[]; promotion?: PromotionSettings; }
export interface UserProfile { phone: string; name: string; password?: string; createdAt: number; }
export interface AdminProfile { username: string; password?: string; }

// --- Helpers ---
export const formatPrice = (price: any) => { const num = Number(price); if (isNaN(num)) return '0 Ks'; return num.toLocaleString() + ' Ks'; };

export const formatSecondsMMSS = (totalSeconds: number | undefined) => {
  if (totalSeconds === undefined) return '00:00';
  const isNegative = totalSeconds < 0; const absSecs = Math.abs(totalSeconds);
  const m = Math.floor(absSecs / 60); const s = Math.floor(absSecs % 60);
  return `${isNegative ? '-' : ''}${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
};

export const compressImage = async (file: File, width: number, height: number): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader(); reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image(); img.src = event.target?.result as string;
      img.onload = () => {
        const canvas = document.createElement('canvas'); let sW = img.width, sH = img.height, sX = 0, sY = 0;
        const targetRatio = width / height, imageRatio = sW / sH;
        if (imageRatio > targetRatio) { const nW = sH * targetRatio; sX = (sW - nW) / 2; sW = nW; } else { const nH = sW / targetRatio; sY = (sH - nH) / 2; sH = nH; }
        canvas.width = width; canvas.height = height; const ctx = canvas.getContext('2d'); ctx?.drawImage(img, sX, sY, sW, sH, 0, 0, width, height); 
        resolve(canvas.toDataURL('image/jpeg', 0.85)); 
      }; img.onerror = reject;
    }; reader.onerror = reject;
  });
};

export function useCountdown(initialMinutes: number, onExpire: () => void) {
  const [timeLeft, setTimeLeft] = useState(initialMinutes * 60);
  useEffect(() => {
    if (timeLeft <= 0) { onExpire(); return; }
    const intervalId = setInterval(() => setTimeLeft(t => t - 1), 1000);
    return () => clearInterval(intervalId);
  }, [timeLeft, onExpire]);
  return `${Math.floor(timeLeft / 60).toString().padStart(2, '0')}:${(timeLeft % 60).toString().padStart(2, '0')}`;
}

export const getLocalTodayStr = () => {
  const d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
};

export const calculateDistanceInMeters = (lat1: number, lon1: number, lat2: number, lon2: number) => {
  const R = 6371e3, p1 = lat1 * Math.PI / 180, p2 = lat2 * Math.PI / 180, dp = (lat2 - lat1) * Math.PI / 180, dl = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dp / 2) * Math.sin(dp / 2) + Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) * Math.sin(dl / 2);
  return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
};

export function getSlotsCoveredByInterval(startTimeMillis: number, endTimeMillis: number, dateStr: string): Set<string> {
  const blocked = new Set<string>(); const [y, m, d] = dateStr.split('-');
  const dateObj = new Date(Number(y), Number(m) - 1, Number(d));
  const startOfDay = dateObj.setHours(0, 0, 0, 0), endOfDay = dateObj.setHours(23, 59, 59, 999);
  if (endTimeMillis <= startOfDay || startTimeMillis >= endOfDay) return blocked;
  ALL_TIME_SLOTS.forEach(slot => {
    if (slot.includes("to")) return; 
    const slotTime = new Date(Number(y), Number(m) - 1, Number(d)); const [time, ampm] = slot.split(' ');
    let [sh, sm] = time.split(':').map(Number);
    if (ampm === 'PM' && sh < 12) sh += 12; if (ampm === 'AM' && sh === 12) sh = 0;
    slotTime.setHours(sh, sm, 0, 0); const slotTimeMillis = slotTime.getTime();
    if ((startTimeMillis < slotTimeMillis + 1800000) && (endTimeMillis > slotTimeMillis)) blocked.add(slot);
  });
  return blocked;
}
