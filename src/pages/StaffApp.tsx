import React, { useState, useEffect, useMemo } from 'react';
import { collection, query, onSnapshot, doc, updateDoc, addDoc, where } from 'firebase/firestore';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { db, auth } from '../firebase';
import { decryptText } from '../security';
import {
  LogOut, User, Clock, CheckCircle, History, Coffee, Sparkles,
  Calendar, ShieldAlert, KeyRound, ChevronDown, Droplets, Trophy,
  TrendingUp, Target, Award, Crown, Banknote, ClipboardList, Bell,
  BookOpen, CheckCircle2, Timer, AlertTriangle, Hourglass, Zap
} from 'lucide-react';
import { THEME, AppData, Booking, OutPass, TherapistProfile } from '../shared';

import { useAppStore } from '../AppDataContext';
import { StaffPenaltyView } from './PenaltySystem';
import { NewEmployeeOnboardingForm, StaffProfileView } from './OnboardingSystem';
import { StaffEmployeeHandbookReader } from './EmployeeHandbookSystem';

const formatPrice = (price: any) => {
  const num = Number(price);
  if (isNaN(num)) return '0 Ks';
  return num.toLocaleString() + ' Ks';
};

const formatSecondsMMSS = (totalSeconds: number | undefined) => {
  if (totalSeconds === undefined || isNaN(totalSeconds)) return '00:00';
  const isNegative = totalSeconds < 0;
  const absSecs = Math.max(0, Math.floor(Math.abs(totalSeconds)));
  const m = Math.floor(absSecs / 60);
  const s = Math.floor(absSecs % 60);
  return `${isNegative ? '-' : ''}${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
};

const getLocalTodayStr = () => {
  const d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
};

// 🌟 ၁။ Admin Clock-In သီးသန့် ဟုတ်/မဟုတ် စစ်ဆေးသည့် Function 🌟
// (POS ဘောင်ချာ SL-... နှင့် Online Booking တို့ လုံးဝမပါဝင်စေရ)
export const isStrictlyAdminClockIn = (b: any): boolean => {
  if (!b) return false;
  const decTx = String(decryptText(b.txId) || b.txId || '').trim().toUpperCase();
  const payMethod = String(b.paymentMethod || '').toLowerCase();
  const discLabel = String(decryptText(b.discountLabel) || b.discountLabel || '').toLowerCase();

  // POS Walk-in Bill သို့မဟုတ် Online Booking ဖြစ်ပါက Admin Clock-In မဟုတ်ပါ (ဝန်ထမ်းကိုယ်တိုင် ပိတ်မှ ရပ်မည်)
  if (
    decTx.startsWith('SL-') ||
    decTx.startsWith('OB-') ||
    payMethod.includes('shop pos') ||
    discLabel.includes('[shop walk-in') ||
    Boolean(b.posLocalId)
  ) {
    return false;
  }

  return (
    Boolean(b.isAdminClockIn) ||
    Boolean(b.isStaffClockIn) ||
    decTx === 'ADMIN' ||
    decTx === 'CASH' ||
    payMethod.includes('admin clock') ||
    payMethod.includes('cash payment in shop') ||
    b.time === 'Walk-in'
  );
};

// 🌟 ၂။ Service Menu အတိုင်း မိနစ်အတိအကျ တွက်ချက်ပေးသည့် Smart Parser 🌟
export const extractAccurateServiceDurationMins = (session: any, appData: AppData): { totalMins: number; label: string } => {
  const serviceStr = String(session?.service || '');

  if (Array.isArray(session?.posItems) && session.posItems.length > 0) {
    let sumMins = 0;
    session.posItems.forEach((item: any) => {
      const itemMins = parseDurationStringToMins(`${item.name || ''} ${item.duration || ''}`, appData);
      if (itemMins > 0) {
        sumMins += itemMins * (Number(item.qty) || 1);
      }
    });
    if (sumMins > 0) {
      return { totalMins: sumMins, label: `${sumMins} Mins` };
    }
  }

  const parts = serviceStr.split(',').map((s) => s.trim()).filter(Boolean);
  let totalCalcMins = 0;

  for (const part of parts) {
    const qtyMatch = part.match(/\(x(\d+)\)$/i) || part.match(/\s+x(\d+)$/i);
    const qty = qtyMatch ? parseInt(qtyMatch[1], 10) || 1 : 1;
    const partMins = parseDurationStringToMins(part, appData);
    totalCalcMins += partMins * qty;
  }

  if (totalCalcMins > 0) {
    return { totalMins: totalCalcMins, label: `${totalCalcMins} Mins` };
  }

  if (session?.startTimeMillis && session?.expectedEndTimeMillis && session.expectedEndTimeMillis > session.startTimeMillis) {
    const diffMins = Math.round((session.expectedEndTimeMillis - session.startTimeMillis) / 60000);
    if (diffMins > 0 && diffMins <= 1440) {
      return { totalMins: diffMins, label: `${diffMins} Mins` };
    }
  }

  return { totalMins: 60, label: '60 Mins' };
};

export const parseDurationStringToMins = (text: string, appData: AppData): number => {
  const clean = text.toLowerCase();

  const minsMatch = clean.match(/(\d+)\s*(?:mins|min|မိနစ်)/i);
  if (minsMatch) return parseInt(minsMatch[1], 10);

  const hrsMatch = clean.match(/(\d+(?:\.\d+)?)\s*(?:hours|hour|hrs|hr|နာရီ)/i);
  if (hrsMatch) return Math.round(parseFloat(hrsMatch[1]) * 60);

  if (clean.includes('whole day') || clean.includes('full day')) return 480; // 8 Hours
  if (clean.includes('whole night') || clean.includes('overnight') || clean.includes('full night')) return 600; // 10 Hours

  if (appData?.categories) {
    for (const cat of appData.categories) {
      for (const item of cat.items || []) {
        const itemNameLower = (item.name || '').toLowerCase();
        if (itemNameLower && clean.includes(itemNameLower)) {
          const dStr = (item.duration || '').toLowerCase();
          const mMatch = dStr.match(/(\d+)\s*(?:mins|min)/i);
          if (mMatch) return parseInt(mMatch[1], 10);
          const hMatch = dStr.match(/(\d+(?:\.\d+)?)\s*(?:hours|hour|hrs|hr)/i);
          if (hMatch) return Math.round(parseFloat(hMatch[1]) * 60);
        }
      }
    }
  }

  if (clean.includes('oil (bottle)') || clean.includes('underwear') || clean.includes('drink') || clean.includes('coffee')) {
    return 0;
  }

  return 60;
};

const parseBookingDateTimeToMillis = (dateStr: string, timeStr: string, fallbackCreatedAt?: number): number => {
  try {
    if (!dateStr || !timeStr) return fallbackCreatedAt || Date.now();
    const [y, m, d] = dateStr.split('-').map(Number);
    if (!y || !m || !d) return fallbackCreatedAt || Date.now();

    const cleanTime = timeStr.trim().toUpperCase();
    const match = cleanTime.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i);
    if (!match) return fallbackCreatedAt || Date.now();

    let hours = parseInt(match[1], 10);
    const mins = parseInt(match[2], 10);
    const period = match[3];

    if (period === 'PM' && hours < 12) hours += 12;
    if (period === 'AM' && hours === 12) hours = 0;

    return new Date(y, m - 1, d, hours, mins, 0, 0).getTime();
  } catch {
    return fallbackCreatedAt || Date.now();
  }
};

const calculateDistanceInMeters = (lat1: number, lon1: number, lat2: number, lon2: number) => {
  const R = 6371e3;
  const p1 = (lat1 * Math.PI) / 180;
  const p2 = (lat2 * Math.PI) / 180;
  const dp = ((lat2 - lat1) * Math.PI) / 180;
  const dl = ((lon2 - lon1) * Math.PI) / 180;
  const a = Math.sin(dp / 2) * Math.sin(dp / 2) + Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) * Math.sin(dl / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

const XCircleIcon = ({ className }: any) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

function StatusBadge({ status, cancelReason }: { status: string; cancelReason?: string }) {
  if (status === 'in_progress')
    return (
      <span className="text-orange-600 border border-orange-200 bg-orange-50 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider flex items-center w-fit animate-pulse">
        <Droplets className="w-3.5 h-3.5 mr-1" /> In Progress (ဝန်ဆောင်မှုပေးနေဆဲ)
      </span>
    );
  if (status === 'completed')
    return (
      <span className="text-emerald-700 border border-emerald-200 bg-emerald-50 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider flex items-center w-fit">
        <CheckCircle className="w-3.5 h-3.5 mr-1" /> Completed
      </span>
    );
  if (status === 'payment_checking')
    return (
      <span className="text-blue-600 border border-blue-200 bg-blue-50 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider flex items-center w-fit">
        <Clock className="w-3 h-3 mr-1" /> Confirming
      </span>
    );
  if (status === 'approved')
    return (
      <span className="text-green-600 border border-green-200 bg-green-50 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider flex items-center w-fit">
        <CheckCircle className="w-3 h-3 mr-1" /> Approved (POS ဘောင်ချာထုတ်ရန်စောင့်ဆိုင်းဆဲ)
      </span>
    );
  if (status === 'cancelled')
    return (
      <div className="flex flex-col items-end">
        <span className="text-red-500 border border-red-200 bg-red-50 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider flex items-center w-fit">
          <XCircleIcon className="w-3 h-3 mr-1" /> Cancelled
        </span>
        {cancelReason && <span className="text-[10px] text-red-400 mt-1 max-w-[200px] text-right leading-tight">Reason: {cancelReason}</span>}
      </div>
    );
  return (
    <span className="text-yellow-600 border border-yellow-200 bg-yellow-50 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider flex items-center w-fit">
      <Clock className="w-3 h-3 mr-1" /> Pending
    </span>
  );
}

export default function StaffApp() {
  const { appData: globalAppData } = useAppStore();
  const [isRegistering, setIsRegistering] = useState(window.location.hash === '#register');

  const [loggedInStaff, setLoggedInStaff] = useState<TherapistProfile | null>(() => {
    const saved = localStorage.getItem('shangrila_staff_profile');
    return saved ? JSON.parse(saved) : null;
  });

  useEffect(() => {
    const handleHashChange = () => setIsRegistering(window.location.hash === '#register');
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  const handleLogout = () => {
    setLoggedInStaff(null);
    localStorage.removeItem('shangrila_staff_profile');
  };

  if (!globalAppData) return <div className="text-center py-20 font-bold text-gray-500">Loading Staff Portal...</div>;

  if (isRegistering) {
    return (
      <NewEmployeeOnboardingForm
        onBack={() => {
          window.location.hash = '';
          setIsRegistering(false);
        }}
      />
    );
  }

  return (
    <div className="max-w-3xl mx-auto">
      {loggedInStaff ? (
        <StaffSessionManager appData={globalAppData} loggedInStaff={loggedInStaff} onLogout={handleLogout} />
      ) : (
        <StaffLogin
          therapists={globalAppData.therapists}
          onLoginSuccess={(profile) => {
            setLoggedInStaff(profile);
            localStorage.setItem('shangrila_staff_profile', JSON.stringify(profile));
          }}
        />
      )}
    </div>
  );
}

function StaffLogin({ therapists, onLoginSuccess }: { therapists: TherapistProfile[]; onLoginSuccess: (p: TherapistProfile) => void }) {
  const [therapistId, setTherapistId] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const staff = therapists.find((t) => (t.id || t.name) === therapistId);

    if (!staff) {
      setError('Invalid Therapist Selection.');
      setLoading(false);
      return;
    }

    try {
      let loggedIn = false;
      let lastErr = null;
      const cleanPassword = password.trim();

      const possibleEmails = [
        `${(staff.id || '').replace(/\s+/g, '').toLowerCase()}@shangrila.com`,
        `${(staff.name || '').replace(/\s+/g, '').toLowerCase()}@shangrila.com`
      ];

      for (const email of possibleEmails) {
        if (!email || email === '@shangrila.com') continue;
        try {
          await signInWithEmailAndPassword(auth, email, cleanPassword);
          loggedIn = true;
          break;
        } catch (err) {
          lastErr = err;
        }
      }

      if (!loggedIn) {
        throw lastErr;
      }

      const decPassword = staff.password ? decryptText(staff.password) || staff.password : '';
      onLoginSuccess({ ...staff, password: decPassword });
    } catch (err) {
      console.error('Login Error:', err);
      setError('Invalid Therapist Selection or Password.');
    }
    setLoading(false);
  };

  return (
    <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100 max-w-sm mx-auto text-center mt-10 animate-fade-in">
      <div className="w-16 h-16 bg-red-50 rounded-full mx-auto flex items-center justify-center mb-6 text-[#123524]">
        <ShieldAlert className="w-8 h-8" />
      </div>
      <h2 className="text-xl font-bold text-gray-800 mb-2">Staff Portal Login</h2>
      <p className="text-xs font-bold text-gray-500 mb-6">Secured by Firebase Auth</p>

      <form onSubmit={handleLogin} className="space-y-4">
        <div>
          <label className="block text-left text-xs font-bold text-gray-500 mb-1">Select Therapist</label>
          <div className="relative">
            <select
              required
              value={therapistId}
              onChange={(e) => setTherapistId(e.target.value)}
              className="w-full p-3 bg-gray-50 border border-gray-200 rounded-lg outline-none focus:border-[#D4AF37] font-bold text-center tracking-wider appearance-none cursor-pointer text-gray-800"
            >
              <option value="" disabled>
                -- Select Your Profile --
              </option>
              {Array.from(new Map(therapists.map((t: any) => [t.name, t])).values()).map((t: any) => {
                const uniqueVal = t.id || t.name;
                return (
                  <option key={uniqueVal} value={uniqueVal}>
                    {t.name}
                  </option>
                );
              })}
            </select>
            <div className="absolute inset-y-0 right-0 flex items-center px-4 pointer-events-none text-gray-400">
              <ChevronDown className="w-4 h-4" />
            </div>
          </div>
        </div>
        <div>
          <label className="block text-left text-xs font-bold text-gray-500 mb-1">Password</label>
          <input
            required
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full p-3 bg-gray-50 border border-gray-200 rounded-lg outline-none focus:border-[#D4AF37] font-bold text-center tracking-wider"
          />
        </div>
        {error && <div className="text-xs font-bold text-red-500">{error}</div>}
        <button
          type="submit"
          disabled={loading}
          className="w-full py-3 bg-[#123524] text-white rounded-lg font-bold shadow-md hover:bg-green-900 transition flex items-center justify-center"
        >
          <KeyRound className="w-4 h-4 mr-2" /> {loading ? 'Logging in...' : 'Verify and Login'}
        </button>
      </form>

      <div className="mt-6 pt-4 border-t border-gray-100">
        <p className="text-[10px] text-gray-400 mb-3 font-bold">Login ID မရှိသေးသော ဝန်ထမ်းသစ်များအတွက်</p>
        <button
          type="button"
          onClick={() => (window.location.hash = 'register')}
          className="w-full py-3 bg-white text-[#D4AF37] border-2 border-[#D4AF37] rounded-lg font-bold shadow-sm hover:bg-yellow-50 transition"
        >
          New Employee Registration
        </button>
      </div>
    </div>
  );
}

function StaffSessionManager({ appData, loggedInStaff, onLogout }: { appData: AppData; loggedInStaff: TherapistProfile; onLogout: () => void }) {
  const liveStaff =
    appData.therapists.find((t) => t.id === loggedInStaff.id) ||
    appData.therapists.find((t) => t.name === loggedInStaff.name) ||
    loggedInStaff;
  const displayPosition = liveStaff.onboardingData?.jobPosition || 'Professional Therapist';

  const [activeSession, setActiveSession] = useState<Booking | null>(null);
  const [upcomingBookings, setUpcomingBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [stoppingSession, setStoppingSession] = useState(false);

  const [staffTab, setStaffTab] = useState<'service' | 'history' | 'outpass' | 'performance' | 'financials' | 'roster' | 'profile' | 'handbook'>('service');
  const [showMoreTabs, setShowMoreTabs] = useState(false);

  const [rosterData, setRosterData] = useState<any>(null);
  const [hasRosterNoti, setHasRosterNoti] = useState(false);
  const [unpaidPenaltyCount, setUnpaidPenaltyCount] = useState(0);

  // 🌟 REAL-TIME SESSION LISTENER:
  // 1. ဒီနေ့မဟုတ်သော Session အဟောင်းများကို အလိုအလျောက် ပိတ်ပြီး ဖျောက်မည်။
  // 2. Admin Clock-In သီးသန့်ကိုသာ အချိန်ပြည့်လျှင် Auto Clock-Out လုပ်မည်။
  // 3. POS နှင့် Online Booking (POS မှ ဘောင်ချာထုတ်ပြီးသား) များကိုမူ ဝန်ထမ်းက Complete နှိပ်မှသာ ရပ်မည်။
  useEffect(() => {
    const q = query(collection(db, 'bookings'));
    const unsubscribe = onSnapshot(q, (snap) => {
      const todayStr = getLocalTodayStr();
      const myActiveCandidates: Booking[] = [];
      const myUpcomingToday: Booking[] = [];
      const now = Date.now();

      snap.forEach((docSnap) => {
        const raw = docSnap.data();
        const therapistField = String(raw.therapist || '');

        const assignedNames = therapistField.split(/&|,/).map((s) => s.trim().toLowerCase());
        const isAssignedToMe = assignedNames.includes(liveStaff.name.trim().toLowerCase());
        if (!isAssignedToMe) return;

        const decTx = String(decryptText(raw.txId) || raw.txId || '').trim();
        const b: Booking = {
          id: docSnap.id,
          ...raw,
          name: decryptText(raw.name) || raw.name || 'Walk-in Guest',
          phone: decryptText(raw.phone) || raw.phone || '',
          txId: decTx,
          specialRequest: decryptText(raw.specialRequest) || raw.specialRequest || ''
        } as Booking;

        if (b.status === 'in_progress') {
          const durInfo = extractAccurateServiceDurationMins(b, appData);
          const startMs = b.startTimeMillis || parseBookingDateTimeToMillis(b.date, b.time, b.createdAt);
          const expectedEndMs = startMs + durInfo.totalMins * 60 * 1000;

          // (က) ဒီနေ့မဟုတ်သော ရက်ဟောင်းမှ ကျန်နေသည့် Session များအားလုံးကို အလိုအလျောက် ပိတ်သိမ်းပြီး ဖျောက်မည်
          if (b.date !== todayStr) {
            updateDoc(doc(db, 'bookings', docSnap.id), {
              status: 'completed',
              actualEndTimeMillis: expectedEndMs,
              overtimeSeconds: 0
            }).catch(() => {});
            return;
          }

          // (ခ) Admin Clock-In သီးသန့်ဖြစ်ပြီး သတ်မှတ်ချိန်ပြည့်သွားပါက အလိုအလျောက် Auto Clock-Out လုပ်မည်
          if (isStrictlyAdminClockIn(b) && now >= expectedEndMs) {
            updateDoc(doc(db, 'bookings', docSnap.id), {
              status: 'completed',
              startTimeMillis: startMs,
              expectedEndTimeMillis: expectedEndMs,
              actualEndTimeMillis: expectedEndMs,
              overtimeSeconds: 0
            }).catch(() => {});
            return;
          }

          myActiveCandidates.push(b);
        } else if (b.date === todayStr && (b.status === 'approved' || b.status === 'payment_checking')) {
          // Online Booking (Admin Approve လုပ်ပြီးသော်လည်း POS မှ ဘောင်ချာမထုတ်ရသေးသဖြင့် စောင့်ဆိုင်းနေသော ပွဲများ)
          myUpcomingToday.push(b);
        }
      });

      myActiveCandidates.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
      setActiveSession(myActiveCandidates[0] || null);

      myUpcomingToday.sort((a, b) => (a.time || '').localeCompare(b.time || ''));
      setUpcomingBookings(myUpcomingToday);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [liveStaff.name, appData]);

  useEffect(() => {
    const q = query(collection(db, 'penalties'), where('therapistName', '==', liveStaff.name));
    const unsubscribe = onSnapshot(q, (snap) => {
      let count = 0;
      snap.forEach((d) => {
        if (d.data().isPaid === false) count++;
      });
      setUnpaidPenaltyCount(count);
    });
    return () => unsubscribe();
  }, [liveStaff.name]);

  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'settings', 'dutyRoster'), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setRosterData(data);
        const lastSeen = localStorage.getItem('shangrila_roster_last_seen');
        if (!lastSeen || Number(lastSeen) < (data.updatedAt || 0)) {
          if (staffTab !== 'roster') setHasRosterNoti(true);
        }
      }
    });
    return () => unsub();
  }, [staffTab]);

  const handleGoToRoster = () => {
    setStaffTab('roster');
    setHasRosterNoti(false);
    if (rosterData?.updatedAt) localStorage.setItem('shangrila_roster_last_seen', rosterData.updatedAt.toString());
  };

  // 🌟 ဝန်ထမ်းမှ ဝန်ဆောင်မှုပြီးဆုံးကြောင်း နှိပ်သည့်အခါ အချိန်မည်မျှကျော်သွားသည် (Overtime) ကို အတိအကျ တွက်ချက်သိမ်းဆည်းပေးခြင်း 🌟
  const handleCompleteServiceSession = async () => {
    if (!activeSession || !activeSession.id || stoppingSession) return;
    if (!window.confirm('ဝန်ဆောင်မှု ပြီးဆုံးကြောင်း အတည်ပြုပါသလား? (Confirm Service Completed)')) return;

    setStoppingSession(true);
    try {
      const now = Date.now();
      const durInfo = extractAccurateServiceDurationMins(activeSession, appData);
      const startMs =
        activeSession.startTimeMillis ||
        parseBookingDateTimeToMillis(activeSession.date, activeSession.time, activeSession.createdAt);
      const accurateExpectedEndMs = startMs + durInfo.totalMins * 60 * 1000;
      const overtimeMillis = Math.max(0, now - accurateExpectedEndMs);

      await updateDoc(doc(db, 'bookings', activeSession.id), {
        status: 'completed',
        startTimeMillis: startMs,
        expectedEndTimeMillis: accurateExpectedEndMs,
        actualEndTimeMillis: now,
        overtimeSeconds: isStrictlyAdminClockIn(activeSession) ? 0 : Math.floor(overtimeMillis / 1000)
      });
      setActiveSession(null);
    } catch (error) {
      console.error(error);
      alert('Error completing service session.');
    } finally {
      setStoppingSession(false);
    }
  };

  if (loading) return <div className="text-center py-20 font-bold text-gray-500">Loading Dashboard...</div>;

  return (
    <div className="bg-white p-4 sm:p-8 rounded-2xl shadow-sm border border-gray-100 animate-fade-in relative">
      <div className="flex justify-between items-center mb-6 pb-6 border-b border-gray-100">
        <div className="flex items-center">
          <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-full overflow-hidden mr-3 sm:mr-4 border-2 border-[#123524] shadow-sm flex-shrink-0">
            {liveStaff.images && liveStaff.images[0] ? (
              <img src={liveStaff.images[0]} className="w-full h-full object-cover" />
            ) : (
              <User className="w-full h-full p-2 sm:p-3 text-gray-400 bg-gray-100" />
            )}
          </div>
          <div>
            <h2 className="text-xl sm:text-2xl font-bold text-[#123524]">{liveStaff.name}</h2>
            <p className="text-[10px] sm:text-xs font-bold text-gray-500 mt-0.5">{displayPosition}</p>
          </div>
        </div>
        <button
          onClick={onLogout}
          className="text-[10px] sm:text-xs font-bold text-red-500 flex items-center bg-red-50 px-2.5 sm:px-3.5 py-2 rounded-full hover:bg-red-100 transition border border-red-100 whitespace-nowrap"
        >
          <LogOut className="w-3.5 h-3.5 sm:mr-1" /> <span className="hidden sm:inline">Log Out</span>
        </button>
      </div>

      {/* Navigation Tabs */}
      <div className="relative mb-6">
        <div className="flex space-x-1 sm:space-x-2 bg-gray-50 p-1.5 rounded-xl border border-gray-100 relative">
          <button
            onClick={() => {
              setStaffTab('service');
              setShowMoreTabs(false);
            }}
            className={`flex-1 px-3 py-2 text-[10px] sm:text-xs font-bold rounded-lg transition flex items-center justify-center gap-1 ${
              staffTab === 'service' ? 'bg-white shadow text-[#123524]' : 'text-gray-500 hover:bg-gray-100'
            }`}
          >
            <span>Service</span>
            {activeSession && <span className="w-2 h-2 rounded-full bg-orange-500 animate-ping" />}
          </button>
          <button
            onClick={() => {
              setStaffTab('outpass');
              setShowMoreTabs(false);
            }}
            className={`flex-1 px-3 py-2 text-[10px] sm:text-xs font-bold rounded-lg transition ${
              staffTab === 'outpass' ? 'bg-white shadow text-[#123524]' : 'text-gray-500 hover:bg-gray-100'
            }`}
          >
            Out Pass
          </button>
          <button
            onClick={() => {
              setStaffTab('performance');
              setShowMoreTabs(false);
            }}
            className={`flex-1 px-3 py-2 text-[10px] sm:text-xs font-bold rounded-lg transition ${
              staffTab === 'performance'
                ? 'bg-gradient-to-r from-[#123524] to-[#1a4a32] shadow text-[#D4AF37]'
                : 'text-gray-500 hover:bg-gray-100'
            }`}
          >
            <Sparkles className="w-3 h-3 inline mb-0.5 mr-1" />
            Matrix
          </button>

          <button
            onClick={() => setShowMoreTabs(!showMoreTabs)}
            className={`relative flex-1 px-3 py-2 text-[10px] sm:text-xs font-bold rounded-lg transition flex items-center justify-center ${
              ['history', 'financials', 'roster', 'profile', 'handbook'].includes(staffTab) || showMoreTabs
                ? 'bg-gray-200 text-[#123524] shadow-inner'
                : 'text-gray-500 hover:bg-gray-100'
            }`}
          >
            More <ChevronDown className={`w-3 h-3 ml-1 transition-transform ${showMoreTabs ? 'rotate-180' : ''}`} />
            {(unpaidPenaltyCount > 0 || hasRosterNoti) && (
              <span className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-100 border border-red-200 rounded-full flex items-center justify-center shadow-sm">
                <style>{`@keyframes bell-ring { 0%, 100% { transform: rotate(-15deg); } 50% { transform: rotate(15deg); } }`}</style>
                <Bell className="w-3 h-3 text-red-500 fill-red-500 origin-top" style={{ animation: 'bell-ring 0.3s ease-in-out infinite' }} />
              </span>
            )}
          </button>
        </div>

        {showMoreTabs && (
          <div className="absolute right-0 mt-2 w-52 bg-white rounded-xl shadow-xl border border-gray-100 z-50 overflow-hidden animate-slide-up flex flex-col p-1.5">
            <button
              onClick={() => {
                setStaffTab('history');
                setShowMoreTabs(false);
              }}
              className={`px-4 py-3 text-xs font-bold text-left rounded-lg transition flex items-center ${
                staffTab === 'history' ? 'bg-gray-50 text-[#123524]' : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              <History className="w-4 h-4 mr-2 text-gray-400" /> History
            </button>

            <button
              onClick={() => {
                setStaffTab('financials');
                setShowMoreTabs(false);
              }}
              className={`px-4 py-3 text-xs font-bold text-left rounded-lg transition flex items-center justify-between ${
                staffTab === 'financials' ? 'bg-purple-50 text-purple-700' : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              <span className="flex items-center">
                <Banknote className="w-4 h-4 mr-2 text-purple-400" /> Fine & Loan
              </span>
              {unpaidPenaltyCount > 0 && (
                <span className="bg-red-500 text-white text-[9px] w-4 h-4 flex items-center justify-center rounded-full shadow-md animate-pulse">
                  {unpaidPenaltyCount}
                </span>
              )}
            </button>

            <button
              onClick={() => {
                handleGoToRoster();
                setShowMoreTabs(false);
              }}
              className={`px-4 py-3 text-xs font-bold text-left rounded-lg transition flex items-center justify-between ${
                staffTab === 'roster' ? 'bg-blue-50 text-blue-700' : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              <span className="flex items-center">
                <ClipboardList className={`w-4 h-4 mr-2 ${hasRosterNoti ? 'text-red-400 animate-bounce' : 'text-blue-400'}`} /> Duties
              </span>
              {hasRosterNoti && <span className="bg-red-500 w-2 h-2 rounded-full shadow-md animate-ping mr-1"></span>}
            </button>

            <button
              onClick={() => {
                setStaffTab('profile');
                setShowMoreTabs(false);
              }}
              className={`px-4 py-3 text-xs font-bold text-left rounded-lg transition flex items-center ${
                staffTab === 'profile' ? 'bg-gray-50 text-[#123524]' : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              <User className="w-4 h-4 mr-2 text-gray-400" /> My Profile
            </button>

            <button
              onClick={() => {
                setStaffTab('handbook');
                setShowMoreTabs(false);
              }}
              className={`px-4 py-3 text-xs font-bold text-left rounded-lg transition flex items-center ${
                staffTab === 'handbook' ? 'bg-[#123524] text-[#D4AF37]' : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              <BookOpen className="w-4 h-4 mr-2 text-[#D4AF37] flex-shrink-0" /> Employee Hand Book
            </button>
          </div>
        )}
      </div>

      {staffTab === 'history' && <StaffDailyHistoryTab loggedInStaff={liveStaff} appData={appData} />}
      {staffTab === 'outpass' && <StaffOutPassTab appData={appData} loggedInStaff={liveStaff} />}
      {staffTab === 'performance' && <StaffPerformanceTab loggedInStaff={liveStaff} />}
      {staffTab === 'financials' && <StaffPenaltyView therapistName={liveStaff.name} />}
      {staffTab === 'profile' && <StaffProfileView staff={liveStaff} />}
      {staffTab === 'handbook' && <StaffEmployeeHandbookReader staffId={liveStaff.id} staffName={liveStaff.name} />}

      {staffTab === 'roster' && (
        <div className="space-y-4 animate-fade-in mt-4">
          <div className="text-center mb-6 border-b border-gray-100 pb-4">
            <h2 className="text-xl font-bold text-[#123524] tracking-wider mb-1 flex justify-center items-center">
              <ClipboardList className="w-5 h-5 mr-2 text-[#D4AF37]" /> Duty Roster
            </h2>
            <p className="text-[10px] text-gray-500 font-semibold mb-2">(အသေးစိတ်ဖတ်ရန် တာဝန်ခေါင်းစဉ်များကို နှိပ်ပါ)</p>
            {rosterData?.lastRotated && (
              <span className="inline-block px-3 py-1 bg-blue-50 text-blue-700 rounded-lg text-[10px] font-bold border border-blue-100">
                Last Updated: {rosterData.lastRotated}
              </span>
            )}
          </div>

          {rosterData?.assignments && rosterData?.tasks ? (
            <div className="space-y-3">
              {rosterData.tasks.map((task: any) => {
                const assignedIds = rosterData.assignments[task.id] || [];
                const isMyDuty = assignedIds.includes(liveStaff.id);

                return (
                  <details
                    key={task.id}
                    className={`group rounded-xl border ${
                      isMyDuty
                        ? 'bg-gradient-to-r from-[#123524] to-[#1a4a32] border-[#D4AF37] shadow-lg transform scale-[1.02] transition-transform'
                        : 'bg-gray-50 border-gray-200 shadow-sm'
                    } overflow-hidden`}
                  >
                    <summary className="p-4 flex items-center justify-between cursor-pointer outline-none list-none">
                      <h3 className={`font-bold text-sm leading-relaxed pr-2 ${isMyDuty ? 'text-[#D4AF37]' : 'text-[#123524]'}`}>
                        {task.title}
                      </h3>
                      <div className="flex items-center gap-2">
                        {isMyDuty && (
                          <span className="bg-[#D4AF37] text-[#123524] text-[9px] font-black px-2 py-0.5 rounded-md uppercase tracking-widest shadow-sm">
                            Your Duty
                          </span>
                        )}
                        <ChevronDown className={`w-4 h-4 transition-transform group-open:rotate-180 ${isMyDuty ? 'text-[#D4AF37]' : 'text-gray-400'}`} />
                      </div>
                    </summary>

                    <div className={`p-4 pt-0 border-t ${isMyDuty ? 'border-white/10' : 'border-gray-200'} bg-black/5`}>
                      <div className="mt-3 py-3 px-3 rounded-lg bg-black/10">
                        <ul className="space-y-1.5">
                          {task.desc.map((d: string, i: number) => (
                            <li key={i} className={`flex items-start text-[11px] font-semibold leading-relaxed ${isMyDuty ? 'text-gray-300' : 'text-gray-600'}`}>
                              <span className="mr-2 mt-0.5">•</span>
                              <span>{d}</span>
                            </li>
                          ))}
                        </ul>
                      </div>

                      <div className="flex flex-wrap gap-2 mt-3">
                        {assignedIds.length === 0 ? (
                          <span className={`text-[10px] italic font-semibold ${isMyDuty ? 'text-gray-300' : 'text-gray-400'}`}>No staff assigned</span>
                        ) : (
                          assignedIds.map((id: string) => {
                            const tProfile = appData.therapists.find((t) => t.id === id);
                            const isMe = id === liveStaff.id;
                            return (
                              <span
                                key={id}
                                className={`text-xs font-bold px-2.5 py-1.5 rounded-lg flex items-center shadow-sm ${
                                  isMe ? 'bg-white text-[#123524]' : 'bg-white border border-gray-200 text-gray-700'
                                }`}
                              >
                                <User className={`w-3 h-3 mr-1.5 ${isMe ? 'text-[#D4AF37]' : 'text-gray-400'}`} /> {tProfile ? tProfile.name : id}
                              </span>
                            );
                          })
                        )}
                      </div>
                    </div>
                  </details>
                );
              })}
            </div>
          ) : (
            <div className="text-center p-10 bg-gray-50 rounded-xl border border-dashed border-gray-200 text-gray-400 text-xs font-bold">
              တာဝန်ခွဲဝေထားခြင်း မရှိသေးပါ။
            </div>
          )}
        </div>
      )}

      {staffTab === 'service' && (
        <div className="space-y-6 mt-4 animate-fade-in">
          {activeSession ? (
            <ActiveSessionDisplay
              session={activeSession}
              appData={appData}
              onStop={handleCompleteServiceSession}
              stopping={stoppingSession}
            />
          ) : (
            <div className="text-center py-14 sm:py-16 px-4 border-2 border-dashed border-gray-200 rounded-2xl bg-gradient-to-b from-gray-50/60 to-white">
              <div className="w-20 h-20 bg-[#123524]/5 rounded-full mx-auto flex items-center justify-center mb-5 text-[#123524] border border-[#123524]/15 shadow-inner">
                <CheckCircle2 className="w-10 h-10 text-[#D4AF37]" />
              </div>
              <span className="inline-flex items-center px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest bg-emerald-50 text-emerald-700 border border-emerald-200 mb-3">
                ● Standby / Available for Service
              </span>
              <h3 className="text-lg sm:text-xl font-black text-[#123524] mb-2">
                လက်ရှိ ဝန်ဆောင်မှုပေးနေသော အချိန်မရှိပါ
              </h3>
              <p className="text-xs font-semibold text-gray-500 max-w-md mx-auto leading-relaxed">
                Reception POS မှ ဘောင်ချာထုတ်လိုက်သည့်အခါ (သို့မဟုတ်) Admin Clock-In သွင်းပေးလိုက်သည့်အခါမှသာ သင်၏ Service Timer စတင်မှတ်သားပါမည်။
              </p>
            </div>
          )}

          {/* Today's Upcoming Online Bookings (Waiting for POS Receipt Print to Start Timer!) */}
          {upcomingBookings.length > 0 && (
            <div className="bg-gray-50 p-4 sm:p-5 rounded-2xl border border-gray-200 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-xs sm:text-sm font-black text-[#123524] flex items-center">
                    <Hourglass className="w-4 h-4 mr-1.5 text-[#D4AF37]" />
                    ယနေ့ ကြိုတင်ဘိုကင်စာရင်း (Upcoming Online Bookings)
                  </h4>
                  <p className="text-[10px] text-gray-500 font-semibold mt-0.5">
                    ဧည့်သည်ရောက်ရှိပြီး POS မှ ဘောင်ချာထုတ်လိုက်သည်နှင့် အချိန်စတင်မှတ်သားပေးပါမည်
                  </p>
                </div>
                <span className="bg-[#123524] text-[#D4AF37] text-[10px] font-black px-2.5 py-0.5 rounded-full">
                  {upcomingBookings.length} ပွဲ
                </span>
              </div>
              <div className="space-y-2">
                {upcomingBookings.map((ub) => {
                  const dur = extractAccurateServiceDurationMins(ub, appData);
                  return (
                    <div
                      key={ub.id}
                      className="bg-white p-3.5 rounded-xl border border-gray-200 flex flex-wrap items-center justify-between gap-2 shadow-xs"
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-black text-[#123524] bg-yellow-50 border border-[#D4AF37]/40 px-2 py-0.5 rounded">
                            ချိန်းဆိုချိန်: {ub.time}
                          </span>
                          <span className="font-bold text-xs sm:text-sm text-gray-800">{ub.service}</span>
                        </div>
                        <div className="text-[11px] text-gray-500 mt-1">
                          Customer: <strong className="text-gray-700">{ub.name}</strong> • သတ်မှတ်ချိန်: <strong>{dur.totalMins} Mins</strong>
                        </div>
                      </div>
                      <StatusBadge status={ub.status} />
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// 🌟 ACTIVE SESSION DISPLAY (Distinguishes Admin Auto-Out vs POS/Online Manual Complete) 🌟
// ============================================================================
function ActiveSessionDisplay({
  session,
  appData,
  onStop,
  stopping
}: {
  session: Booking;
  appData: AppData;
  onStop: () => void;
  stopping: boolean;
}) {
  const isAdminAutoSession = useMemo(() => isStrictlyAdminClockIn(session), [session]);
  const durationInfo = useMemo(() => extractAccurateServiceDurationMins(session, appData), [session, appData]);
  const totalServiceSeconds = durationInfo.totalMins * 60;

  const accurateStartMillis = useMemo(() => {
    if (session.startTimeMillis && session.startTimeMillis > 0) return session.startTimeMillis;
    return parseBookingDateTimeToMillis(session.date, session.time, session.createdAt);
  }, [session.startTimeMillis, session.date, session.time, session.createdAt]);

  const accurateExpectedEndMillis = useMemo(() => {
    return accurateStartMillis + totalServiceSeconds * 1000;
  }, [accurateStartMillis, totalServiceSeconds]);

  const [nowMillis, setNowMillis] = useState<number>(Date.now());

  // Live 1-second ticker + Auto Clock-Out trigger if strictly Admin Clock-In
  useEffect(() => {
    const intervalId = setInterval(() => {
      const currentNow = Date.now();
      setNowMillis(currentNow);

      // Admin Clock-In ဖြစ်ပြီး အချိန်ပြည့်သွားပါက အလိုအလျောက် Auto Clock-Out လုပ်မည်
      if (isAdminAutoSession && currentNow >= accurateExpectedEndMillis && session.id) {
        updateDoc(doc(db, 'bookings', session.id), {
          status: 'completed',
          startTimeMillis: accurateStartMillis,
          expectedEndTimeMillis: accurateExpectedEndMillis,
          actualEndTimeMillis: accurateExpectedEndMillis,
          overtimeSeconds: 0
        }).catch(() => {});
      }
    }, 1000);
    return () => clearInterval(intervalId);
  }, [isAdminAutoSession, accurateStartMillis, accurateExpectedEndMillis, session.id]);

  const elapsedSeconds = Math.max(0, Math.floor((nowMillis - accurateStartMillis) / 1000));
  const remainingSeconds = Math.max(0, Math.ceil((accurateExpectedEndMillis - nowMillis) / 1000));
  const overtimeSeconds = nowMillis > accurateExpectedEndMillis ? Math.floor((nowMillis - accurateExpectedEndMillis) / 1000) : 0;

  const progressPercent = Math.min(100, Math.max(0, Math.round((elapsedSeconds / (totalServiceSeconds || 1)) * 100)));

  const startTimeFormatted = new Date(accurateStartMillis).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const expectedEndFormatted = new Date(accurateExpectedEndMillis).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  const cleanServiceTitle = (session.service || 'Spa Service').replace(/\(\d+\s*Mins\)/gi, '').trim();

  return (
    <div className="animate-fade-in space-y-5">
      <div className="bg-gradient-to-br from-[#0B2419] via-[#123524] to-[#1a4a32] text-white p-5 sm:p-7 rounded-3xl shadow-xl border-2 border-[#D4AF37]/60 relative overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-2 pb-4 border-b border-white/10">
          <StatusBadge status={session.status} />
          <div className="flex items-center gap-2">
            {isAdminAutoSession ? (
              <span className="inline-flex items-center gap-1 bg-blue-500/20 text-blue-200 border border-blue-400/40 px-2.5 py-1 rounded-lg text-[10px] font-black">
                <Zap className="w-3 h-3 text-yellow-300" /> Admin Clock-In (အချိန်ပြည့်လျှင် Auto ပိတ်မည်)
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 bg-amber-500/20 text-amber-200 border border-amber-400/40 px-2.5 py-1 rounded-lg text-[10px] font-black">
                <Clock className="w-3 h-3 text-[#D4AF37]" /> ဝန်ဆောင်မှုပြီးလျှင် Complete နှိပ်ရန်
              </span>
            )}
            {session.txId && (
              <span className="font-mono text-[11px] font-black bg-black/30 text-[#D4AF37] px-3 py-1 rounded-lg border border-[#D4AF37]/30">
                {session.txId}
              </span>
            )}
          </div>
        </div>

        <div className="mt-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="inline-flex items-center gap-1.5 bg-[#D4AF37] text-[#123524] px-3 py-1 rounded-lg text-xs font-black uppercase tracking-wider shadow-sm">
              <Timer className="w-3.5 h-3.5" />
              သတ်မှတ်ချိန်: {durationInfo.totalMins} မိနစ် ({durationInfo.totalMins >= 60 && durationInfo.totalMins % 60 === 0 ? `${durationInfo.totalMins / 60} နာရီ` : `${durationInfo.totalMins} Mins`})
            </div>
            <h3 className="text-xl sm:text-2xl font-serif font-black text-white leading-snug pt-1">
              {cleanServiceTitle}
            </h3>
            <div className="text-xs font-bold text-gray-200 flex flex-wrap items-center gap-2 pt-0.5">
              <span className="bg-white/10 px-2.5 py-1 rounded-md text-[#D4AF37]">
                ဧည့်သည်: {session.name}
              </span>
              <span className="bg-white/10 px-2.5 py-1 rounded-md text-gray-200">
                နေ့ရက်: {session.date}
              </span>
            </div>
          </div>

          <div className="bg-black/30 backdrop-blur-xs px-5 py-4 rounded-2xl border border-white/15 text-center sm:text-right min-w-[195px]">
            {remainingSeconds > 0 ? (
              <>
                <div className="text-[10px] font-extrabold text-[#D4AF37] uppercase tracking-widest mb-1">
                  ကျန်ရှိချိန် (REMAINING TIME)
                </div>
                <div className="text-4xl sm:text-5xl font-mono font-black text-white tracking-tight">
                  {formatSecondsMMSS(remainingSeconds)}
                </div>
                <div className="text-[10px] font-bold text-gray-300 mt-1">
                  မိနစ် : စက္ကန့် ({Math.ceil(remainingSeconds / 60)} မိနစ် ကျန်)
                </div>
              </>
            ) : (
              <div className="animate-pulse">
                <div className="text-[10px] font-extrabold text-red-400 uppercase tracking-widest mb-1 flex items-center justify-center sm:justify-end gap-1">
                  <AlertTriangle className="w-3.5 h-3.5" /> အချိန်ပို (OVERTIME)
                </div>
                <div className="text-4xl sm:text-5xl font-mono font-black text-red-400 tracking-tight">
                  +{formatSecondsMMSS(overtimeSeconds)}
                </div>
                <div className="text-[10px] font-bold text-red-300 mt-1">
                  သတ်မှတ်ချိန်ထက် ကျော်လွန်နေပါသည်
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="mt-6 space-y-1.5">
          <div className="flex justify-between text-[11px] font-bold text-gray-300">
            <span>စတင်ချိန်: <strong className="text-white">{startTimeFormatted}</strong></span>
            <span>ကြာမြင့်ချိန်: <strong className="text-[#D4AF37]">{formatSecondsMMSS(elapsedSeconds)} / {durationInfo.totalMins}:00</strong></span>
            <span>ပြီးဆုံးရမည့်ချိန်: <strong className="text-white">{expectedEndFormatted}</strong></span>
          </div>
          <div className="w-full h-3 bg-black/40 rounded-full overflow-hidden p-0.5 border border-white/10">
            <div
              className={`h-full rounded-full transition-all duration-700 ${
                overtimeSeconds > 0
                  ? 'bg-gradient-to-r from-red-500 to-orange-500'
                  : 'bg-gradient-to-r from-[#D4AF37] to-emerald-400'
              }`}
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>

        <div className="mt-5 pt-4 border-t border-white/10 flex flex-wrap justify-between items-center gap-2 text-xs text-gray-300">
          <span>
            ကျသင့်ငွေ: <strong className="text-[#D4AF37] text-sm">{formatPrice(session.totalPrice)}</strong>
          </span>
          <span>
            Therapist: <strong className="text-white">{session.therapist}</strong>
          </span>
        </div>
      </div>

      <button
        type="button"
        disabled={stopping}
        onClick={onStop}
        className="w-full py-4 sm:py-5 bg-gradient-to-r from-emerald-600 via-green-600 to-emerald-700 hover:from-emerald-700 hover:to-green-800 text-white rounded-2xl font-black shadow-xl flex items-center justify-center mx-auto transition active:scale-[0.99] text-sm sm:text-base tracking-wide border-2 border-emerald-400/30 disabled:opacity-50"
      >
        <CheckCircle2 className="w-5 h-5 sm:w-6 sm:h-6 mr-2.5 text-yellow-300" />
        {stopping ? 'သိမ်းဆည်းနေပါသည်...' : 'ဝန်ဆောင်မှု ပြီးဆုံးကြောင်း အတည်ပြုမည် (Complete Service)'}
      </button>
    </div>
  );
}

function StaffDailyHistoryTab({ loggedInStaff, appData }: { loggedInStaff: TherapistProfile; appData: AppData }) {
  const [history, setHistory] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const todayStr = getLocalTodayStr();

  useEffect(() => {
    const q = query(collection(db, 'bookings'), where('date', '==', todayStr));
    const unsub = onSnapshot(q, (snap) => {
      const arr: Booking[] = [];
      snap.forEach((docSnap) => {
        const raw = docSnap.data();
        const assignedNames = String(raw.therapist || '')
          .split(/&|,/)
          .map((s) => s.trim().toLowerCase());
        if (!assignedNames.includes(loggedInStaff.name.trim().toLowerCase())) return;

        const b = {
          id: docSnap.id,
          ...raw,
          name: decryptText(raw.name) || raw.name,
          phone: decryptText(raw.phone) || raw.phone,
          txId: decryptText(raw.txId) || raw.txId,
          specialRequest: decryptText(raw.specialRequest) || raw.specialRequest
        } as Booking;

        if (b.status === 'completed' || b.status === 'cancelled') {
          arr.push(b);
        }
      });
      arr.sort((a, b) => (b.actualEndTimeMillis || 0) - (a.actualEndTimeMillis || 0));
      setHistory(arr);
      setLoading(false);
    });
    return () => unsub();
  }, [loggedInStaff.name, todayStr]);

  if (loading) return <div className="text-center py-10 text-xs font-bold text-gray-400">Loading...</div>;

  return (
    <div className="animate-fade-in mt-4">
      <h3 className="font-bold text-gray-800 mb-4 text-sm flex items-center">
        <History className="w-4 h-4 mr-2 text-[#D4AF37]" /> ယနေ့ ပြီးဆုံးခဲ့သော ဝန်ဆောင်မှုများ (Today's Completed Services)
      </h3>
      {history.length === 0 ? (
        <div className="text-center py-10 bg-gray-50 rounded-xl border border-gray-100 text-xs font-bold text-gray-400">
          ယနေ့ ပြီးဆုံးခဲ့သော ဝန်ဆောင်မှု မရှိသေးပါ။
        </div>
      ) : (
        <div className="space-y-3">
          {history.map((b) => {
            const dur = extractAccurateServiceDurationMins(b, appData);
            return (
              <div key={b.id} className="p-4 bg-gray-50 border border-gray-200 rounded-xl">
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <span className="font-bold text-sm text-[#123524] block">{b.service}</span>
                    <span className="text-[10px] font-black text-amber-800 bg-amber-100 px-2 py-0.5 rounded mt-1 inline-block">
                      သတ်မှတ်ချိန်: {dur.totalMins} Mins
                    </span>
                  </div>
                  <span
                    className={`text-[9px] px-2.5 py-1 rounded-full font-black uppercase ${
                      b.status === 'completed' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                    }`}
                  >
                    {b.status}
                  </span>
                </div>
                <div className="flex justify-between items-center text-xs text-gray-500 mt-2 pt-2 border-t border-gray-200/70">
                  <span>Customer: <strong>{b.name}</strong></span>
                  <span>စတင်ချိန်: <strong>{b.time}</strong></span>
                  <span className="font-black text-[#123524]">{formatPrice(b.totalPrice)}</span>
                </div>
                {b.status === 'completed' && b.overtimeSeconds !== undefined && b.overtimeSeconds > 60 && (
                  <div className="mt-2 text-[10px] text-red-600 font-bold bg-red-50 p-1.5 rounded text-right">
                    အချိန်ပို (Overtime): +{Math.floor(b.overtimeSeconds / 60)} မိနစ် {b.overtimeSeconds % 60} စက္ကန့်
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function StaffOutPassTab({ appData, loggedInStaff }: { appData: AppData; loggedInStaff: TherapistProfile }) {
  const [allOutpasses, setAllOutpasses] = useState<OutPass[]>([]);
  const [loading, setLoading] = useState(true);
  const [reason, setReason] = useState('');
  const [locating, setLocating] = useState(false);
  const [locError, setLocError] = useState('');
  const todayStr = getLocalTodayStr();

  useEffect(() => {
    const q = query(collection(db, 'outpasses'), where('date', '==', todayStr));
    const unsub = onSnapshot(q, (snap) => {
      const arr: OutPass[] = [];
      snap.forEach((d) => {
        arr.push({ id: d.id, ...d.data() } as OutPass);
      });
      arr.sort((a, b) => b.outTimeMillis - a.outTimeMillis);
      setAllOutpasses(arr);
      setLoading(false);
    });
    return () => unsub();
  }, [todayStr]);

  const myPasses = allOutpasses.filter((o) => o.therapist === loggedInStaff.name);
  const activePasses = allOutpasses.filter((o) => o.status === 'out');
  const myActivePass = myPasses.find((o) => o.status === 'out');

  const handleGoOut = async () => {
    if (activePasses.length >= 2) return;
    if (myPasses.length >= 4) return;
    if (!reason.trim()) {
      setLocError('အကြောင်းပြချက် (Reason) ရေးပေးပါ။');
      return;
    }
    if (!appData.branding.shopLat || !appData.branding.shopLng) {
      setLocError('Admin Panel -> Settings တွင် ဆိုင်၏ Location အရင်သတ်မှတ်ပါ။');
      return;
    }

    setLocating(true);
    setLocError('');
    if (!navigator.geolocation) {
      setLocError('ဖုန်းတွင် Location Service မရနိုင်ပါ။');
      setLocating(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const dist = calculateDistanceInMeters(
          pos.coords.latitude,
          pos.coords.longitude,
          appData.branding.shopLat!,
          appData.branding.shopLng!
        );

        if (dist > 50) {
          setLocError(`ဆိုင်နှင့် အကွာအဝေး ${Math.round(dist)} မီတာ ရှိနေပါသည်။ (၅၀ မီတာအတွင်းသာ နှိပ်ခွင့်ရှိသည်)`);
          setLocating(false);
          return;
        }

        const now = Date.now();
        await addDoc(collection(db, 'outpasses'), {
          therapist: loggedInStaff.name,
          date: todayStr,
          outTimeMillis: now,
          expectedInTimeMillis: now + 30 * 60 * 1000,
          status: 'out',
          reason: reason.trim()
        });
        setReason('');
        setLocating(false);
      },
      () => {
        setLocError('Location (GPS) ဖွင့်ပေးရန် လိုအပ်ပါသည်။');
        setLocating(false);
      },
      { enableHighAccuracy: true }
    );
  };

  const handleReturn = async () => {
    if (!myActivePass || !myActivePass.id) return;
    if (!appData.branding.shopLat || !appData.branding.shopLng) {
      setLocError('Admin Panel -> Settings တွင် ဆိုင်၏ Location အရင်သတ်မှတ်ပါ။');
      return;
    }

    setLocating(true);
    setLocError('');
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const dist = calculateDistanceInMeters(
          pos.coords.latitude,
          pos.coords.longitude,
          appData.branding.shopLat!,
          appData.branding.shopLng!
        );

        if (dist > 50) {
          setLocError(`ဆိုင်နှင့် အကွာအဝေး ${Math.round(dist)} မီတာ ရှိနေပါသည်။ (၅၀ မီတာအတွင်းသာ နှိပ်ခွင့်ရှိသည်)`);
          setLocating(false);
          return;
        }

        const now = Date.now();
        const overtimeMillis = Math.max(0, now - myActivePass.expectedInTimeMillis);
        await updateDoc(doc(db, 'outpasses', myActivePass.id), {
          status: 'returned',
          inTimeMillis: now,
          overtimeSeconds: Math.floor(overtimeMillis / 1000)
        });
        setLocating(false);
      },
      () => {
        setLocError('Location (GPS) ဖွင့်ပေးရန် လိုအပ်ပါသည်။');
        setLocating(false);
      },
      { enableHighAccuracy: true }
    );
  };

  if (loading) return <div className="text-center py-10 text-xs font-bold text-gray-400">Loading...</div>;

  if (myActivePass) {
    return <OutPassActiveDisplay pass={myActivePass} onReturn={handleReturn} locating={locating} locError={locError} />;
  }

  const canGoOut = myPasses.length < 4 && activePasses.length < 2;

  return (
    <div className="bg-white py-6 sm:p-8 rounded-2xl text-center animate-fade-in mt-4">
      <div className="w-16 h-16 sm:w-20 sm:h-20 bg-purple-50 rounded-full mx-auto flex items-center justify-center mb-4 sm:mb-6 text-purple-600 border border-purple-100">
        <Coffee className="w-8 h-8 sm:w-10 sm:h-10" />
      </div>
      <h3 className="text-lg sm:text-xl font-bold text-gray-800 mb-2">Personal Out Pass</h3>
      <p className="text-xs text-gray-500 mb-6">
        တစ်ရက်လျှင် အများဆုံး ၄ ကြိမ် (၁ ကြိမ်လျှင် မိနစ် ၃၀) ထွက်ခွင့်ရှိပါသည်။
        <br />
        <span className="mt-2 inline-block bg-gray-100 px-3 py-1 rounded-full">
          ယနေ့ထွက်ပြီးသားအကြိမ်ရေ: <strong>{myPasses.length} / 4</strong>
        </span>
      </p>

      {!canGoOut && myPasses.length >= 4 && (
        <div className="bg-red-50 text-red-600 p-4 rounded-xl font-bold border border-red-100 text-[11px] sm:text-xs mb-6">
          ဒီနေ့အတွက် သင်၏ အပြင်ထွက်ခွင့် (၄ ကြိမ်) ပြည့်သွားပါပြီ။
        </div>
      )}
      {!canGoOut && myPasses.length < 4 && activePasses.length >= 2 && (
        <div className="bg-orange-50 text-orange-700 p-4 rounded-xl font-bold border border-orange-100 text-[11px] sm:text-xs mb-6 leading-relaxed">
          လက်ရှိတွင် ဝန်ထမ်း ၂ ယောက်
          <br />({activePasses.map((p) => p.therapist).join(', ')})<br />
          အပြင်ထွက်နေပါသည်။ ၎င်းတို့ပြန်လာမှသာ ထွက်ခွင့်ရပါမည်။
        </div>
      )}

      {canGoOut && (
        <div className="mb-4 text-left max-w-xs mx-auto">
          <label className="block text-xs font-bold text-gray-500 mb-1">အကြောင်းပြချက် (Reason)</label>
          <input
            type="text"
            placeholder="ဥပမာ - စျေးဝယ်၊ မုန့်ဝယ်"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-lg outline-none focus:border-purple-400 text-xs"
          />
        </div>
      )}

      {locError && <div className="text-xs font-bold text-red-500 mb-4">{locError}</div>}

      <button
        disabled={!canGoOut || locating}
        onClick={handleGoOut}
        className="px-6 sm:px-8 py-3 sm:py-4 bg-purple-600 text-white rounded-xl font-bold shadow-md w-full sm:w-auto disabled:opacity-50 disabled:cursor-not-allowed hover:bg-purple-700 transition text-sm"
      >
        {locating ? 'Checking Location...' : 'Clock Out (Take 30 Mins Pass)'}
      </button>

      {myPasses.filter((p) => p.status === 'returned').length > 0 && (
        <div className="mt-10 text-left">
          <h4 className="font-bold text-gray-800 text-xs sm:text-sm mb-3 px-1">Today's Out Pass History</h4>
          <div className="space-y-2">
            {myPasses
              .filter((p) => p.status === 'returned')
              .map((p) => (
                <div key={p.id} className="p-3 bg-gray-50 rounded-lg border border-gray-200 flex justify-between items-center text-xs">
                  <span className="text-gray-600 font-mono font-semibold">
                    {new Date(p.outTimeMillis).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} -{' '}
                    {p.inTimeMillis ? new Date(p.inTimeMillis).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                  </span>
                  {p.overtimeSeconds && p.overtimeSeconds > 0 ? (
                    <span className="text-red-500 font-bold bg-red-50 px-2 py-1 rounded">Late +{Math.floor(p.overtimeSeconds / 60)} mins</span>
                  ) : (
                    <span className="text-green-600 font-bold bg-green-50 px-2 py-1 rounded">On Time</span>
                  )}
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}

function OutPassActiveDisplay({ pass, onReturn, locating, locError }: { pass: OutPass; onReturn: () => void; locating: boolean; locError: string }) {
  const [remainingTime, setRemainingTime] = useState<number | null>(null);
  const [overtimeSecs, setOvertimeSecs] = useState<number>(0);

  useEffect(() => {
    const updateTimer = () => {
      const now = Date.now();
      if (now < pass.expectedInTimeMillis) {
        setRemainingTime(Math.ceil((pass.expectedInTimeMillis - now) / 1000));
        setOvertimeSecs(0);
      } else {
        setRemainingTime(0);
        setOvertimeSecs(Math.floor((now - pass.expectedInTimeMillis) / 1000));
      }
    };
    updateTimer();
    const intervalId = setInterval(updateTimer, 1000);
    return () => clearInterval(intervalId);
  }, [pass.expectedInTimeMillis]);

  return (
    <div className="bg-white py-8 rounded-2xl text-center animate-fade-in mt-4 border border-gray-100 shadow-sm px-4">
      <div className="inline-flex items-center px-3 py-1 bg-purple-100 text-purple-700 text-[10px] font-bold uppercase tracking-wider rounded-full mb-6 border border-purple-200 animate-pulse">
        <Coffee className="w-3 h-3 mr-1.5" /> Personal Out Pass Active
      </div>

      {remainingTime !== null && remainingTime > 0 ? (
        <div className="mb-8">
          <div className="text-xs font-bold text-gray-400 uppercase mb-2">REMAINING TIME</div>
          <div className="text-5xl font-mono font-bold text-gray-800 tracking-tighter">{formatSecondsMMSS(remainingTime)}</div>
        </div>
      ) : (
        <div className="mb-8">
          <div className="text-xs font-bold text-red-500 uppercase mb-2 animate-bounce">LATE (OVERTIME)</div>
          <div className="text-5xl font-mono font-bold text-red-600 tracking-tighter">+{formatSecondsMMSS(overtimeSecs)}</div>
        </div>
      )}

      {locError && <div className="text-xs font-bold text-red-500 mb-4">{locError}</div>}

      <button
        disabled={locating}
        onClick={onReturn}
        className="w-full sm:w-auto sm:px-16 py-4 bg-[#123524] text-[#D4AF37] rounded-xl font-bold shadow-lg flex items-center justify-center hover:bg-[#1a4a32] transition border border-[#1a4a32] mx-auto text-sm disabled:opacity-50"
      >
        <CheckCircle className="w-4 h-4 sm:w-5 sm:h-5 mr-2" /> {locating ? 'Checking Location...' : 'Clock In (Return)'}
      </button>
    </div>
  );
}

function StaffPerformanceTab({ loggedInStaff }: { loggedInStaff: TherapistProfile }) {
  const [matrixData, setMatrixData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [subTab, setSubTab] = useState<'leaderboard' | 'my_stats'>('leaderboard');

  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'settings', 'matrixData'), (snap) => {
      if (snap.exists()) setMatrixData(snap.data());
      setLoading(false);
    });
    return () => unsub();
  }, []);

  if (loading) return <div className="text-center py-20 text-[#D4AF37] font-bold animate-pulse text-xs uppercase tracking-widest">Loading Matrix Data...</div>;
  if (!matrixData || !matrixData.dailyEntries)
    return (
      <div className="text-center py-20 text-gray-400 font-bold text-xs bg-gray-50 rounded-xl border border-dashed border-gray-200 mt-4">
        No Matrix Data available. Admin needs to upload the Excel file.
      </div>
    );

  const parseExcelDate = (val: any) => {
    if (!val) return '';
    if (typeof val === 'number') {
      const d = new Date(Math.round((val - 25569) * 86400 * 1000));
      return d.toISOString().split('T')[0];
    }
    const str = String(val).trim();
    if (str.includes('T')) return str.split('T')[0];
    return str;
  };

  const allEntries = (matrixData.dailyEntries || []).map((e: any) => ({
    ...e,
    ParsedDate: parseExcelDate(e.Date),
    CleanStaffId: String(e['Staff ID'] || '').trim().toLowerCase(),
    CleanStaffName: String(e['Staff Name'] || '').trim().toLowerCase()
  }));

  const uniqueDates = Array.from(new Set(allEntries.map((e: any) => e.ParsedDate))).filter(Boolean).sort() as string[];

  const allDates: string[] = [];
  if (uniqueDates.length > 0) {
    const firstDateStr = uniqueDates[0];
    const [yearStr, monthStr] = firstDateStr.split('-');
    const year = parseInt(yearStr, 10);
    const month = parseInt(monthStr, 10);
    const daysInMonth = new Date(year, month, 0).getDate();
    for (let i = 1; i <= daysInMonth; i++) {
      allDates.push(`${year}-${String(month).padStart(2, '0')}-${String(i).padStart(2, '0')}`);
    }
  } else {
    const currentMonth = new Date().getMonth() + 1;
    const currentYear = new Date().getFullYear();
    const daysInMonth = new Date(currentYear, currentMonth, 0).getDate();
    for (let i = 1; i <= daysInMonth; i++) {
      allDates.push(`${currentYear}-${String(currentMonth).padStart(2, '0')}-${String(i).padStart(2, '0')}`);
    }
  }

  const totalDays = allDates.length;
  const BASE_DAILY_TARGET = 150000;
  const monthlyTotalTarget = totalDays * BASE_DAILY_TARGET;

  const staffSalesMap = new Map();
  let calcThisMonthUpToToday = 0;
  let calcYesterdaySales = 0;
  let calcTotalThisMonthSales = 0;

  const todayStr = getLocalTodayStr();
  const prevD = new Date();
  prevD.setDate(prevD.getDate() - 1);
  const prevDayStr = prevD.getFullYear() + '-' + String(prevD.getMonth() + 1).padStart(2, '0') + '-' + String(prevD.getDate()).padStart(2, '0');

  allEntries.forEach((e: any) => {
    const sId = String(e['Staff ID'] || '').trim().replace(/^SGL-0*/i, 'No-');
    const amt = Number(e['Sales Amount']) || 0;

    if (!staffSalesMap.has(sId)) {
      staffSalesMap.set(sId, { actual: 0, commission: 0 });
    }
    staffSalesMap.get(sId).actual += amt;
    staffSalesMap.get(sId).commission += Number(e['Commission']) || 0;

    calcTotalThisMonthSales += amt;
    if (e.ParsedDate <= todayStr) calcThisMonthUpToToday += amt;
    if (e.ParsedDate === prevDayStr) calcYesterdaySales += amt;
  });

  const sortedPerformers = Array.from(staffSalesMap.entries())
    .map(([id, data]) => ({
      'Staff ID': id,
      '1 to 31 Actual': data.actual
    }))
    .sort((a, b) => b['1 to 31 Actual'] - a['1 to 31 Actual']);

  const maxActual = sortedPerformers.length > 0 ? Math.max(...sortedPerformers.map((p) => p['1 to 31 Actual']), 1) : 1;

  const staffNameStr = String(loggedInStaff?.name || '').trim().toLowerCase();
  const staffIdStr = String(loggedInStaff?.id || '').trim().toLowerCase();
  const nameMatch = staffNameStr.match(/\d+/);
  const currentStaffNum = nameMatch ? parseInt(nameMatch[0], 10) : staffIdStr.match(/\d+/) ? parseInt(staffIdStr.match(/\d+/)![0], 10) : null;

  const checkIsMe = (pIdStr: string) => {
    const pIdClean = String(pIdStr || '').trim().toLowerCase();
    const pNumMatch = pIdClean.match(/\d+/);
    const pNum = pNumMatch ? parseInt(pNumMatch[0], 10) : null;
    return pIdClean === staffIdStr || pIdClean === `no-${currentStaffNum}` || (currentStaffNum !== null && pNum === currentStaffNum);
  };

  let mySummary: any = null;
  for (const [sId, data] of staffSalesMap.entries()) {
    if (checkIsMe(sId)) {
      mySummary = {
        'Total Actual Sales': data.actual,
        'Total Commessions': data.commission,
        Bonus: 0,
        'Final Pay': data.commission
      };
      break;
    }
  }

  const myEntries = allEntries.filter((e: any) => checkIsMe(String(e['Staff ID'] || '').trim()));

  const comparison = matrixData.comparisonData || {};
  const comparisonMeta = matrixData.comparisonMeta || {};

  const upToTodayData = comparison.upToToday || { lastMonth: 0, thisMonth: calcThisMonthUpToToday, difference: calcThisMonthUpToToday };
  const yesterdayData = comparison.yesterday || { lastMonth: 0, thisMonth: calcYesterdaySales, difference: calcYesterdaySales };
  const fullMonthData = comparison.fullMonth || { lastMonth: 0, thisMonth: calcTotalThisMonthSales, difference: calcTotalThisMonthSales };

  const lastMonthUpToTodaySales = Number(upToTodayData.lastMonth) || 0;
  const displayThisMonthUpToToday = Number(upToTodayData.thisMonth) || 0;
  const upToTodayDiff = Number(upToTodayData.difference) || displayThisMonthUpToToday - lastMonthUpToTodaySales;

  const lastMonthYesterdaySales = Number(yesterdayData.lastMonth) || 0;
  const displayYesterdaySales = Number(yesterdayData.thisMonth) || 0;
  const dayDifference = Number(yesterdayData.difference) || displayYesterdaySales - lastMonthYesterdaySales;

  const totalLastMonthSales = Number(fullMonthData.lastMonth) || 0;
  const totalThisMonthSales = Number(fullMonthData.thisMonth) || 0;
  const salesDiff = Number(fullMonthData.difference) || totalThisMonthSales - totalLastMonthSales;

  const yesterdayDateTextStr = prevDayStr;
  const lastMonthNameStr = comparisonMeta.previousMonthName || 'PREVIOUS MONTH';
  const thisMonthNameStr = comparisonMeta.thisMonthName || 'THIS MONTH';

  let cumActualPrior = 0;
  const fullDailyBreakdown = allDates.map((d: any, idx: number) => {
    const dayRecords = myEntries.filter((e: any) => e.ParsedDate === d);
    const dayActual = dayRecords.reduce((sum: number, r: any) => sum + (Number(r['Sales Amount']) || 0), 0);

    const daysRemaining = totalDays - idx;
    const remainingTargetPrior = Math.max(0, monthlyTotalTarget - cumActualPrior);
    const adjustedDailyTarget = daysRemaining > 0 ? Math.round(remainingTargetPrior / daysRemaining) : 0;

    const runningCumTarget = BASE_DAILY_TARGET * (idx + 1);
    const cumActual = cumActualPrior + dayActual;
    const dailyVariance = dayActual - BASE_DAILY_TARGET;
    const remainingMonthlyTarget = Math.max(0, monthlyTotalTarget - cumActual);

    cumActualPrior = cumActual;

    return {
      dayNo: idx + 1,
      date: d,
      hasSales: dayRecords.length > 0,
      services: dayRecords,
      dayActual,
      dailyTarget: BASE_DAILY_TARGET,
      adjustedDailyTarget,
      dailyVariance,
      cumTarget: runningCumTarget,
      cumActual,
      remainingMonthlyTarget
    };
  });

  const dailyBreakdown = fullDailyBreakdown.filter((item) => item.date <= todayStr);
  const pastDays = fullDailyBreakdown.filter((item) => item.date < todayStr);
  const workedDaysCount = pastDays.filter((item) => item.hasSales).length;
  const missedDays = pastDays.filter((item) => !item.hasSales);
  const missedDaysCount = missedDays.length;

  return (
    <div className="animate-fade-in mt-4">
      <div className="flex space-x-2 mb-6 bg-gray-100 p-1.5 rounded-xl">
        <button
          onClick={() => setSubTab('leaderboard')}
          className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${subTab === 'leaderboard' ? 'bg-white shadow text-[#123524]' : 'text-gray-500'}`}
        >
          <Trophy className="w-3.5 h-3.5 inline mr-1.5" /> Leaderboard
        </button>
        <button
          onClick={() => setSubTab('my_stats')}
          className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${subTab === 'my_stats' ? 'bg-white shadow text-[#123524]' : 'text-gray-500'}`}
        >
          <TrendingUp className="w-3.5 h-3.5 inline mr-1.5" /> My Stats
        </button>
      </div>

      {subTab === 'leaderboard' && (
        <div className="space-y-6">
          <div className="text-center mb-6">
            <h3 className="text-lg font-bold text-[#123524] font-serif">Top Performers of the Month</h3>
            <p className="text-[10px] text-gray-500 uppercase tracking-widest mt-1">Shangri-La Hall of Fame</p>
          </div>

          <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 mb-8 overflow-x-auto">
            <div className="flex items-end space-x-3 h-52 pb-2 pt-14 min-w-max border-b border-gray-100">
              {sortedPerformers.map((p, idx) => {
                const actualSales = p['1 to 31 Actual'];
                const heightPercent = Math.max(5, (actualSales / maxActual) * 100);
                const isMe = checkIsMe(p['Staff ID']);
                const metPercent = monthlyTotalTarget > 0 ? (actualSales / monthlyTotalTarget) * 100 : 0;

                let barColor = 'bg-gray-200 hover:bg-gray-300';
                if (idx === 0) barColor = 'bg-gradient-to-t from-[#123524] to-[#1a4a32] shadow-md';
                else if (idx === 1) barColor = 'bg-gradient-to-t from-[#D4AF37] to-yellow-400 shadow-md';
                else if (idx === 2) barColor = 'bg-gradient-to-t from-gray-400 to-gray-300 shadow-md';
                else if (idx === 3) barColor = 'bg-gradient-to-t from-orange-400 to-orange-300 shadow-sm';
                else if (idx === 4) barColor = 'bg-gradient-to-t from-blue-400 to-blue-300 shadow-sm';

                if (isMe && idx > 4) barColor = 'bg-gradient-to-t from-green-400 to-green-500 shadow-sm';

                return (
                  <div key={idx} className="flex flex-col justify-end items-center group w-12 h-full">
                    <div className="text-[9px] font-bold text-gray-500 mb-2 opacity-0 group-hover:opacity-100 transition-opacity -rotate-45 whitespace-nowrap z-10">
                      {formatPrice(actualSales)}
                    </div>

                    <div
                      className={`w-8 rounded-t-md relative transition-all duration-1000 ease-out flex justify-center ${barColor} ${
                        isMe ? 'ring-2 ring-offset-1 ring-[#D4AF37]' : ''
                      }`}
                      style={{ height: `${heightPercent}%` }}
                    >
                      {idx === 0 && <Crown className="w-6 h-6 text-[#D4AF37] absolute -top-12" />}
                      <span className={`absolute -top-5 text-[9px] font-bold ${idx === 0 ? 'text-[#123524]' : idx === 1 ? 'text-yellow-600' : 'text-gray-600'}`}>
                        {metPercent.toFixed(0)}%
                      </span>
                    </div>

                    <span className={`text-[10px] font-bold mt-2 ${isMe ? 'text-[#D4AF37]' : 'text-gray-600'}`}>{p['Staff ID']}</span>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 mb-8">
            <h3 className="font-bold text-gray-800 text-sm mb-4 flex items-center">
              <TrendingUp className="w-4 h-4 mr-2 text-blue-500" /> Last Month Vs This Month
            </h3>
            <div className="space-y-6">
              <div className="bg-blue-50/50 p-4 rounded-xl border border-blue-100">
                <div className="text-xs font-bold text-blue-900 mb-2 flex items-center">
                  <Calendar className="w-3.5 h-3.5 mr-1.5" /> ပြီးခဲ့တဲ့လ vs ယခုလ (Up to Today)
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-center">
                  <div className="bg-white p-2.5 rounded-lg border border-blue-200">
                    <div className="text-[9px] text-gray-500 font-bold uppercase">{lastMonthNameStr}</div>
                    <div className="text-xs font-bold text-gray-800 mt-0.5">{formatPrice(lastMonthUpToTodaySales)}</div>
                  </div>
                  <div className="bg-white p-2.5 rounded-lg border border-blue-200">
                    <div className="text-[9px] text-blue-700 font-bold uppercase">{thisMonthNameStr}</div>
                    <div className="text-xs font-black text-[#123524] mt-0.5">{formatPrice(displayThisMonthUpToToday)}</div>
                  </div>
                  <div className={`p-2.5 rounded-lg border text-center ${upToTodayDiff >= 0 ? 'bg-green-50 border-green-200 text-green-700' : 'bg-red-50 border-red-200 text-red-700'}`}>
                    <div className="text-[9px] font-bold uppercase">Difference</div>
                    <div className="text-xs font-black mt-0.5">
                      {upToTodayDiff >= 0 ? '+' : ''}
                      {formatPrice(upToTodayDiff)}
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-purple-50/50 p-4 rounded-xl border border-purple-100">
                <div className="text-xs font-bold text-purple-900 mb-2 flex items-center">
                  <Clock className="w-3.5 h-3.5 mr-1.5" /> မနေ့ကနေ့ချင်းအလိုက်နှိုင်းယှဉ်ချက် ({yesterdayDateTextStr})
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-center">
                  <div className="bg-white p-2.5 rounded-lg border border-purple-200">
                    <div className="text-[9px] text-gray-500 font-bold uppercase">Last Month Same Day</div>
                    <div className="text-xs font-bold text-gray-800 mt-0.5">{formatPrice(lastMonthYesterdaySales)}</div>
                  </div>
                  <div className="bg-white p-2.5 rounded-lg border border-purple-200">
                    <div className="text-[9px] text-purple-700 font-bold uppercase">This Month Yesterday</div>
                    <div className="text-xs font-black text-[#123524] mt-0.5">{formatPrice(displayYesterdaySales)}</div>
                  </div>
                  <div className={`p-2.5 rounded-lg border text-center ${dayDifference >= 0 ? 'bg-green-50 border-green-200 text-green-700' : 'bg-red-50 border-red-200 text-red-700'}`}>
                    <div className="text-[9px] font-bold uppercase">Day Difference</div>
                    <div className="text-xs font-black mt-0.5">
                      {dayDifference >= 0 ? '+' : ''}
                      {formatPrice(dayDifference)}
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
                <div className="bg-gray-50 p-3.5 rounded-xl border border-gray-200 text-center">
                  <div className="text-[9px] text-gray-500 font-bold uppercase tracking-wider mb-1">{lastMonthNameStr} TOTAL</div>
                  <div className="text-sm font-bold text-gray-800">{formatPrice(totalLastMonthSales)}</div>
                </div>
                <div className="bg-yellow-50 p-3.5 rounded-xl border border-yellow-200 text-center">
                  <div className="text-[9px] text-yellow-700 font-bold uppercase tracking-wider mb-1">{thisMonthNameStr} TOTAL</div>
                  <div className="text-sm font-black text-[#123524]">{formatPrice(totalThisMonthSales)}</div>
                </div>
                <div className={`p-3.5 rounded-xl border text-center ${salesDiff >= 0 ? 'bg-green-50 border-green-200 text-green-700' : 'bg-red-50 border-red-200 text-red-700'}`}>
                  <div className="text-[9px] font-bold uppercase tracking-wider mb-1">Full Month Difference</div>
                  <div className="text-sm font-black">
                    {salesDiff >= 0 ? '+' : ''}
                    {formatPrice(salesDiff)}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            {sortedPerformers.map((p, idx) => {
              const isMe = checkIsMe(p['Staff ID']);
              let badgeClass = 'bg-gray-100 text-gray-600';
              if (idx === 0) badgeClass = 'bg-yellow-100 text-yellow-700 border border-yellow-300';
              else if (idx === 1) badgeClass = 'bg-gray-200 text-gray-700 border border-gray-400';
              else if (idx === 2) badgeClass = 'bg-orange-100 text-orange-700 border border-orange-300';

              const actualSales = p['1 to 31 Actual'];
              const metPercent = monthlyTotalTarget > 0 ? (actualSales / monthlyTotalTarget) * 100 : 0;

              return (
                <div
                  key={idx}
                  className={`flex items-center p-4 rounded-xl border transition-all ${
                    isMe ? 'bg-yellow-50/50 border-[#D4AF37] shadow-md scale-[1.02]' : 'bg-white border-gray-100 shadow-sm'
                  }`}
                >
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs mr-4 ${badgeClass}`}>
                    {idx === 0 ? <Trophy className="w-4 h-4" /> : `#${idx + 1}`}
                  </div>
                  <div className="flex-1">
                    <div className="font-bold text-gray-800 text-sm flex items-center">
                      {p['Staff ID']}{' '}
                      {isMe && <span className="ml-2 text-[9px] bg-[#123524] text-[#D4AF37] px-2 py-0.5 rounded uppercase tracking-wider">YOU</span>}
                    </div>
                    <div className="text-[10px] text-gray-500 font-semibold mt-0.5">Target: {formatPrice(monthlyTotalTarget)}</div>
                  </div>
                  <div className="text-right">
                    <div className="font-black text-[#123524]">{formatPrice(actualSales)}</div>
                    <div className={`text-[9px] font-bold mt-0.5 ${metPercent >= 50 ? 'text-green-500' : 'text-orange-500'}`}>
                      Met {metPercent.toFixed(1)}%
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {subTab === 'my_stats' && (
        <div className="space-y-6">
          {!mySummary ? (
            <div className="text-center py-10 text-gray-400 text-xs font-bold border-2 border-dashed border-gray-200 rounded-xl bg-gray-50">
              Your data is not found in the uploaded Matrix.
            </div>
          ) : (
            <>
              <div className="bg-gradient-to-br from-[#123524] to-[#1a4a32] p-6 rounded-2xl shadow-lg relative overflow-hidden flex flex-col items-center">
                <div className="absolute top-0 right-0 w-32 h-32 bg-[#D4AF37] opacity-10 rounded-full -mr-10 -mt-10 blur-2xl"></div>
                <h3 className="text-[#D4AF37] font-bold text-sm tracking-widest uppercase mb-6 flex items-center">
                  <Target className="w-4 h-4 mr-2" /> Monthly Target
                </h3>

                <div className="relative w-32 h-32 flex items-center justify-center bg-black/20 rounded-full border-4 border-white/5 shadow-inner">
                  <div className="text-center">
                    <div className="text-2xl font-black text-white">
                      {mySummary['Total Actual Sales'] > 0 && monthlyTotalTarget > 0
                        ? Math.round((mySummary['Total Actual Sales'] / monthlyTotalTarget) * 100)
                        : 0}
                      %
                    </div>
                    <div className="text-[8px] text-[#D4AF37] font-bold uppercase tracking-wider mt-1">Achieved</div>
                  </div>
                  <svg viewBox="0 0 128 128" className="absolute inset-0 w-full h-full transform -rotate-90 overflow-visible">
                    <circle cx="64" cy="64" r="58" stroke="currentColor" strokeWidth="6" fill="transparent" className="text-white/10" />
                    <circle
                      cx="64"
                      cy="64"
                      r="58"
                      stroke="currentColor"
                      strokeWidth="6"
                      fill="transparent"
                      className="text-[#D4AF37]"
                      strokeDasharray="364"
                      strokeDashoffset={364 - 364 * (mySummary['Total Actual Sales'] / monthlyTotalTarget)}
                      strokeLinecap="round"
                      style={{ transition: 'stroke-dashoffset 1s ease-out' }}
                    />
                  </svg>
                </div>

                <div className="grid grid-cols-2 gap-4 w-full mt-8">
                  <div className="bg-white/10 p-3 rounded-xl border border-white/10 text-center">
                    <div className="text-[9px] text-gray-300 font-bold uppercase tracking-wider mb-1">Target</div>
                    <div className="text-sm font-bold text-white">{formatPrice(monthlyTotalTarget)}</div>
                  </div>
                  <div className="bg-white/10 p-3 rounded-xl border border-[#D4AF37]/30 text-center">
                    <div className="text-[9px] text-[#D4AF37] font-bold uppercase tracking-wider mb-1">Actual Sales</div>
                    <div className="text-sm font-bold text-[#D4AF37]">{formatPrice(mySummary['Total Actual Sales'])}</div>
                  </div>
                </div>
              </div>

              <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100">
                <h3 className="font-bold text-gray-800 text-sm mb-4 flex items-center">
                  <Award className="w-4 h-4 mr-2 text-yellow-600" /> Financial Summary
                </h3>
                <div className="space-y-3">
                  <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                    <span className="text-xs font-semibold text-gray-600">Total Commissions</span>
                    <span className="font-bold text-[#123524]">{formatPrice(mySummary['Total Commessions'])}</span>
                  </div>
                  <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                    <span className="text-xs font-semibold text-gray-600">Bonus</span>
                    <span className="font-bold text-blue-600">{formatPrice(mySummary['Bonus'])}</span>
                  </div>
                  <div className="flex justify-between items-center p-3 bg-yellow-50 rounded-lg border border-yellow-200">
                    <span className="text-xs font-bold text-yellow-800">Final Expected Pay</span>
                    <span className="font-black text-yellow-700 text-lg">{formatPrice(mySummary['Final Pay'])}</span>
                  </div>
                </div>
              </div>

              <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100">
                <h3 className="font-bold text-gray-800 text-sm mb-2 flex items-center">
                  <Calendar className="w-4 h-4 mr-2 text-blue-500" /> Attendance Summary
                </h3>
                <p className="text-[10px] text-gray-500 mb-4">
                  (လဆန်းမှ ပြီးခဲ့သည့်ရက်အထိ အလုပ်လုပ်ရက် စုစုပေါင်း {pastDays.length} ရက်အတွင်း ဝင်ရောက်မှု အခြေအနေ)
                </p>

                <div className="grid grid-cols-2 gap-3 mb-4">
                  <div className="bg-green-50 p-3 rounded-xl border border-green-100 text-center shadow-sm">
                    <div className="text-[9px] text-green-600 font-bold uppercase tracking-wider mb-1">Worked Days</div>
                    <div className="text-2xl font-black text-green-700">
                      {workedDaysCount} <span className="text-[10px] font-bold text-green-600/70">/ {pastDays.length} Days</span>
                    </div>
                  </div>
                  <div className="bg-red-50 p-3 rounded-xl border border-red-100 text-center shadow-sm">
                    <div className="text-[9px] text-red-600 font-bold uppercase tracking-wider mb-1">Missed Days</div>
                    <div className="text-2xl font-black text-red-700">
                      {missedDaysCount} <span className="text-[10px] font-bold text-red-600/70">/ {pastDays.length} Days</span>
                    </div>
                  </div>
                </div>

                {missedDaysCount > 0 ? (
                  <div className="bg-gray-50 p-3.5 rounded-xl border border-gray-200">
                    <span className="text-[10px] font-bold text-gray-500 mb-2.5 block">Section မဝင်ထားသော ရက်များ :</span>
                    <div className="flex flex-wrap gap-2">
                      {missedDays.map((md) => (
                        <span key={md.date} className="bg-white border border-red-200 text-red-500 text-[9px] font-bold px-2 py-1 rounded-md shadow-sm">
                          Day {md.dayNo} ({md.date})
                        </span>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="bg-gray-50 p-3.5 rounded-xl border border-gray-200 text-center text-[10px] font-bold text-gray-500 flex flex-col items-center">
                    <CheckCircle className="w-5 h-5 text-green-500 mb-1.5" />
                    ယနေ့အထိ Section မပျက်ထားပါ။ အလွန်ကောင်းမွန်ပါတယ်။
                  </div>
                )}
              </div>

              <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100">
                <h3 className="font-bold text-[#123524] text-sm mb-4 flex items-center justify-between">
                  <span className="flex items-center">
                    <Calendar className="w-4 h-4 mr-2 text-[#D4AF37]" /> Dynamic Daily Tracker
                  </span>
                </h3>
                <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1">
                  {dailyBreakdown.map((item, idx) => (
                    <div
                      key={idx}
                      className={`p-4 rounded-xl border transition-all ${
                        item.hasSales ? 'bg-white border-gray-200 shadow-sm' : 'bg-gray-50/70 border-dashed border-gray-200'
                      }`}
                    >
                      <div className="flex justify-between items-center mb-2">
                        <div className="flex items-center space-x-2">
                          <span className="bg-[#123524] text-[#D4AF37] text-[10px] font-bold px-2 py-0.5 rounded">Day {item.dayNo}</span>
                          <span className="text-xs font-mono font-bold text-gray-700">{item.date}</span>
                        </div>
                        <div>
                          {item.hasSales ? (
                            <span className="bg-green-100 text-green-700 text-[9px] font-bold px-2 py-0.5 rounded uppercase tracking-wider">
                              Active Sale
                            </span>
                          ) : (
                            <span className="bg-gray-200 text-gray-600 text-[9px] font-bold px-2 py-0.5 rounded uppercase tracking-wider">
                              No Sales
                            </span>
                          )}
                        </div>
                      </div>
                      {item.hasSales && (
                        <div className="space-y-1 my-2 bg-gray-50 p-2.5 rounded-lg border border-gray-100">
                          {item.services.map((s: any, sIdx: number) => (
                            <div key={sIdx} className="flex justify-between text-xs font-semibold text-gray-800">
                              <span>• {s['Service Name']}</span>
                              <span className="font-bold text-[#123524]">{formatPrice(s['Sales Amount'])}</span>
                            </div>
                          ))}
                        </div>
                      )}
                      <div className="grid grid-cols-2 gap-2 mt-3 pt-3 border-t border-gray-100 text-[11px]">
                        <div>
                          <span className="text-gray-400 font-semibold text-[10px] block">Daily Actual vs Target</span>
                          <span className={`font-black ${item.dayActual >= item.dailyTarget ? 'text-green-600' : 'text-orange-600'}`}>
                            {formatPrice(item.dayActual)}{' '}
                            <span className="text-[9px] font-bold text-gray-400">
                              ({item.dayActual >= item.dailyTarget ? 'Met' : `${formatPrice(item.dailyVariance)}`})
                            </span>
                          </span>
                          <span className="text-[#123524] font-bold text-[9px] block mt-1.5">Total Actual: {formatPrice(item.cumActual)}</span>
                        </div>
                        <div className="text-right">
                          <span className="text-gray-400 font-semibold text-[10px] block">Adjusted Daily Target</span>
                          <span className="font-bold text-[#123524]">{formatPrice(item.adjustedDailyTarget)}</span>
                          <span className="text-[9px] text-gray-500 block mt-1.5">
                            Remaining: <span className="font-bold text-red-500">{formatPrice(item.remainingMonthlyTarget)}</span>
                          </span>
                          <span className="text-[9px] text-gray-500 block mt-0.5">Cum. Target: {formatPrice(item.cumTarget)}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
