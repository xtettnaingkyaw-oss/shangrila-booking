import React, { useState, useEffect, useCallback, useMemo, useRef, memo } from 'react';
import { collection, getDocs, updateDoc, deleteDoc, doc, query, orderBy, getDoc, setDoc, onSnapshot, addDoc, writeBatch, runTransaction, where, limit } from 'firebase/firestore';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';
import { db, auth, secondaryAuth } from '../firebase';
import { encryptText, decryptText } from '../security'; 
import CryptoJS from 'crypto-js'; 
import { CalendarPlus, BarChart2, User, ShieldCheck, Settings, Trash2, Edit, ShieldAlert, Lock, UserCircle, KeyRound, AlertCircle, Save, PlusCircle, X, Copy, Crown, ChevronUp, ChevronDown, Activity, Coffee, Download, ImageIcon, Sparkles, CreditCard, MapPin, Phone, LogOut, Star, Award, Gift, Target, Info, Search, History, UserPlus, CheckCircle, MessageCircle, TrendingUp, Trophy, Calendar, Clock, Banknote, Timer, ClipboardList, PartyPopper, ShoppingBag, Users, Ban} from 'lucide-react';
import { DutyRosterSystem } from './DutyRosterSystem';
import { AdminHRManagement } from './OnboardingSystem';
import { THEME, AppData, TherapistProfile, Booking, OutPass, MenuCategory, PaymentMethod, UserProfile, AdminProfile, AppBranding, PromotionSettings, formatPrice, compressImage, VipSettings, VipTier, DEFAULT_VIP_SETTINGS, uploadBase64ToStorage } from '../shared';
import { useAppStore } from '../AppDataContext';
import { AdminPenaltyManager } from './PenaltySystem';
import AdminSalesSummaryView from './AdminSalesSummaryView';
import { AdminEmployeeHandbookManager } from './EmployeeHandbookSystem';
import { AdminStaffPayrollManager, calculateBookingCommissionForStaff, getStaffSeniority, isSameStaffMember } from './StaffPayrollSystem';
import { AdminExpenseManager, AdminExpenseReportDashboard, AdminRevenueProfitDashboard } from './ExpenseAndRevenueSystem';
import { BookOpen, Wallet, PieChart } from 'lucide-react';

export interface InstallStep { id: string; text: string; imageUrl: string; }
const DEFAULT_INSTALL_STEPS: InstallStep[] = [
   { id: '1', text: 'Browser ၏ Menu (⋮) သို့မဟုတ် Share icon ကိုနှိပ်ပါ။', imageUrl: '' },
   { id: '2', text: '"Add to Home Screen" ကို ရွေးချယ်ပါ။', imageUrl: '' },
   { id: '3', text: '"Add" ကို နှိပ်ပါ။ ဖုန်း Screen တွင် App အဖြစ် ရောက်ရှိသွားပါမည်။', imageUrl: '' }
];

const getLocalTodayStr = () => {
    const d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
};

interface LocalAdminProfile extends AdminProfile { docId?: string; username?: string; password?: string; role?: 'super_admin' | 'custom'; permissions?: string[]; }

export default function AdminApp({ appData, onSettingsUpdated }: { appData: AppData, onSettingsUpdated: (data: AppData) => void }) {
  const [loggedInAdmin, setLoggedInAdmin] = useState<string | null>(sessionStorage.getItem('shangrila_admin'));

  const { appData: globalAppData } = useAppStore();

  const mergedAppData = { 
      ...appData, 
      ...globalAppData,
      vipSettings: globalAppData?.vipSettings || appData.vipSettings || DEFAULT_VIP_SETTINGS 
  };

  useEffect(() => {
    const interval = setInterval(() => {
       const sessionAdmin = sessionStorage.getItem('shangrila_admin');
       if (sessionAdmin !== loggedInAdmin) setLoggedInAdmin(sessionAdmin);
    }, 1000);
    return () => clearInterval(interval);
  }, [loggedInAdmin]);

  const handleLogout = () => {
      if (!window.confirm("Are you sure you want to log out?")) return;
      sessionStorage.removeItem('shangrila_admin');
      setLoggedInAdmin(null);
  };

  if (!loggedInAdmin) {
    return <AdminLogin onLogin={(user) => { sessionStorage.setItem('shangrila_admin', user); setLoggedInAdmin(user); }} />;
  }
  return <AdminDashboard appData={mergedAppData} onSettingsUpdated={onSettingsUpdated} loggedInAdmin={loggedInAdmin} onLogout={handleLogout} />;
}

function AdminLogin({ onLogin }: { onLogin: (u: string) => void }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault(); setLoading(true); setError('');
    try {
      if (username === 'admin' && password === 'admin123') {
          try { await signInWithEmailAndPassword(auth, 'admin@shangrila.com', password); } 
          catch (e: any) {
              await createUserWithEmailAndPassword(auth, 'admin@shangrila.com', password);
              await addDoc(collection(db, 'admins'), { username: encryptText('admin'), password: encryptText('admin123'), role: 'super_admin', permissions: ['bookings', 'reports', 'users', 'points', 'admins', 'settings'] });
          }
          onLogin('admin'); setLoading(false); return;
      }
      await signInWithEmailAndPassword(auth, `${username.toLowerCase()}@shangrila.com`, password);
      onLogin(username);
    } catch (e) { setError('Invalid Admin Username or Password'); }
    setLoading(false);
  };

  return (
    <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-200 max-w-sm mx-auto text-center mt-10 animate-fade-in">
      <div className="w-16 h-16 bg-red-50 rounded-full mx-auto flex items-center justify-center mb-6 text-red-600"><ShieldAlert className="w-8 h-8" /></div>
      <h2 className="text-xl font-bold text-gray-800 mb-2">Admin Portal</h2>
      <p className="text-xs font-bold text-gray-500 mb-6">Secured by Firebase Auth</p>
      <form onSubmit={handleLogin} className="space-y-4">
        <input required type="text" placeholder="Username" value={username} onChange={e=>setUsername(e.target.value)} className="w-full p-3 bg-gray-50 border border-gray-200 rounded-lg outline-none focus:border-[#D4AF37] font-bold text-center tracking-wider" />
        <input required type="password" placeholder="Password" value={password} onChange={e=>setPassword(e.target.value)} className="w-full p-3 bg-gray-50 border border-gray-200 rounded-lg outline-none focus:border-[#D4AF37] font-bold text-center tracking-wider" />
        {error && <div className="text-xs font-bold text-red-500">{error}</div>}
        <button type="submit" disabled={loading} className="w-full py-3 bg-[#123524] text-white rounded-lg font-bold shadow-md hover:bg-green-900">{loading ? 'Verifying...' : 'Login'}</button>
      </form>
    </div>
  );
}

  const AdminDashboard = memo(({ appData, onSettingsUpdated, loggedInAdmin, onLogout }: { appData: AppData, onSettingsUpdated: (data: AppData) => void, loggedInAdmin: string, onLogout: () => void }) => {
  const [tab, setTab] = useState<'bookings' | 'sales_summary' | 'revenue_dashboard' | 'expenses' | 'expense_report' | 'reports' | 'payroll' | 'users' | 'points' | 'admins' | 'pos_users' | 'settings' | 'penalties' | 'roster' | 'hr' | 'campaigns' | 'pos_sales' | 'handbook'>('sales_summary');
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [pendingCount, setPendingCount] = useState(0);
  const [resetRequestCount, setResetRequestCount] = useState(0);
  const [updateRequestCount, setUpdateRequestCount] = useState(0);
  const [adminRole, setAdminRole] = useState<'super_admin' | 'custom'>('super_admin');
  const [adminPermissions, setAdminPermissions] = useState<string[]>([]);
  const [roleLoaded, setRoleLoaded] = useState(false);
  const isFirstLoad = useRef(true);

  // 🌟 Responsive Sidebar States (Mobile Drawer + Desktop Collapse) 🌟
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [isDesktopSidebarCollapsed, setIsDesktopSidebarCollapsed] = useState(false);

  const activeLogoUrl = appData?.branding?.logoUrl || '';

  useEffect(() => {
    const fetchRole = async () => {
      try {
        const allAdmins = await getDocs(collection(db, 'admins'));
        let matchedAdmin: LocalAdminProfile | null = null;
        allAdmins.forEach(d => {
          const raw = d.data();
          const decUser = decryptText(raw.username) || d.id;
          if (decUser.toLowerCase() === loggedInAdmin.toLowerCase()) matchedAdmin = raw as LocalAdminProfile;
        });
        if (matchedAdmin) {
          const r = matchedAdmin.role || 'super_admin';
          const p = matchedAdmin.permissions || ['bookings', 'reports', 'users', 'points', 'admins', 'settings', 'penalties'];
          setAdminRole(r);
          setAdminPermissions(p);
          const isAllowedExtraTab =
            (p.includes('bookings') && (tab === 'sales_summary' || tab === 'pos_sales' || tab === 'revenue_dashboard' || tab === 'expenses' || tab === 'expense_report')) ||
            (p.includes('admins') && tab === 'pos_users') ||
            (p.includes('settings') && (tab === 'roster' || tab === 'hr' || tab === 'campaigns' || tab === 'handbook' || tab === 'pos_users'));
          if (r !== 'super_admin' && !p.includes(tab) && !isAllowedExtraTab && p.length > 0) {
            setTab(p[0] as any);
          }
        }
      } catch (e) {
        console.error("Error fetching admin role", e);
      }
      setRoleLoaded(true);
    };
    fetchRole();
  }, [loggedInAdmin, tab]);

  const [onboardingPendingCount, setOnboardingPendingCount] = useState(0);

  useEffect(() => {
    const q = query(collection(db, 'onboarding_requests'), where('status', '==', 'pending'));
    const unsubReq = onSnapshot(q, (snap) => {
      let realCount = 0;
      snap.forEach(doc => {
        const data = doc.data();
        if ((data.fullName && data.fullName.trim() !== '') || (data.name && data.name.trim() !== '')) {
          realCount++;
        }
      });
      setOnboardingPendingCount(realCount);
    });
    return () => unsubReq();
  }, []);

  useEffect(() => {
    const q = query(collection(db, 'users'), where('resetRequested', '==', true));
    const unsubUsers = onSnapshot(q, (snap) => {
      setResetRequestCount(snap.size);
    });
    return () => unsubUsers();
  }, []);

  useEffect(() => {
    const q = query(collection(db, 'therapists'), where('updateRequested', '==', true));
    const unsubUpdates = onSnapshot(q, (snap) => {
      let realCount = 0;
      snap.forEach(doc => {
        const data = doc.data();
        if (data.name && data.name.trim() !== '') realCount++;
      });
      setUpdateRequestCount(realCount);
    });
    return () => unsubUpdates();
  }, []);

  useEffect(() => {
    const q = query(collection(db, 'bookings'), orderBy('createdAt', 'desc'), limit(3000));
    const unsubscribe = onSnapshot(q, (snap) => {
      const data: Booking[] = [];
      let currentPendingCount = 0;
      snap.forEach((doc) => {
        const raw = doc.data();
        const b = {
          id: doc.id,
          ...raw,
          name: decryptText(raw.name) || raw.name,
          phone: decryptText(raw.phone) || raw.phone,
          txId: decryptText(raw.txId) || raw.txId,
          specialRequest: decryptText(raw.specialRequest) || raw.specialRequest,
          originalPrice: raw.originalPrice ? Number(decryptText(raw.originalPrice)) : undefined,
          discountPercent: raw.discountPercent ? Number(decryptText(raw.discountPercent)) : undefined,
          discountLabel: raw.discountLabel ? decryptText(raw.discountLabel) : undefined,
          vipTierName: raw.vipTierName ? decryptText(raw.vipTierName) : undefined
        } as Booking;
        data.push(b);
        if (b.status === 'pending') currentPendingCount++;
      });
      data.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
      setBookings(data);
      setPendingCount(currentPendingCount);
      if (!isFirstLoad.current && snap.docChanges().some(change => change.type === 'added' && change.doc.data().status === 'pending')) {
        const audioEl = document.getElementById('admin-alert-sound') as HTMLAudioElement;
        if (audioEl) {
          audioEl.currentTime = 0;
          audioEl.play().catch(e => console.log("Audio blocked", e));
          setTimeout(() => {
            audioEl.pause();
            audioEl.currentTime = 0;
          }, 5000);
        }
      }
      isFirstLoad.current = false;
    });
    return () => unsubscribe();
  }, []);

  const handleInteraction = useCallback(() => {
    const audioEl = document.getElementById('admin-alert-sound') as HTMLAudioElement;
    if (audioEl && audioEl.paused) {
      audioEl.play().then(() => {
        audioEl.pause();
        audioEl.currentTime = 0;
      }).catch(() => {});
    }
  }, []);

  const hasAccess = useCallback((tabId: string) => {
    if (adminRole === 'super_admin') return true;
    return adminPermissions.includes(tabId);
  }, [adminRole, adminPermissions]);

  const pendingBookings = useMemo(() => bookings.filter(b => b.status !== 'in_progress' && b.status !== 'completed'), [bookings]);
  const historyBookings = useMemo(() => bookings.filter(b => b.status === 'in_progress' || b.status === 'completed'), [bookings]);
  const posUnpaidBalanceCount = useMemo(() => {
    return bookings.filter((b: any) => b.status !== 'cancelled' && b.paymentStatus === 'deposit_only' && Number(b.balanceDue) > 0).length;
  }, [bookings]);

  const handleForceRefreshApp = async () => {
    try {
      if ('serviceWorker' in navigator) {
        const regs = await navigator.serviceWorker.getRegistrations();
        for (const r of regs) await r.unregister();
      }
      if ('caches' in window) {
        const keys = await caches.keys();
        for (const k of keys) await caches.delete(k);
      }
    } catch {}
    window.location.reload();
  };

  // 🌟 Structured Navigation Groups for World-Class Spa Admin Experience 🌟
  const navGroups = useMemo(() => [
    {
      groupTitle: 'Sales & Revenue',
      items: [
        {
          id: 'sales_summary',
          label: 'Sale Summary',
          subLabel: 'Online + POS Analytics',
          icon: TrendingUp,
          visible: hasAccess('bookings'),
          badge: 0
        },
        {
          id: 'revenue_dashboard',
          label: 'Revenue Dashboard',
          subLabel: 'Inflow, Outflow & Net Profit',
          icon: PieChart,
          visible: hasAccess('bookings') || hasAccess('reports'),
          badge: 0
        },
        {
          id: 'expenses',
          label: 'Expense Manager',
          subLabel: 'Add Expense & History List',
          icon: Wallet,
          visible: hasAccess('bookings') || hasAccess('reports'),
          badge: 0
        },
        {
          id: 'expense_report',
          label: 'Expense Report',
          subLabel: 'Category & Overall Analytics',
          icon: BarChart2,
          visible: hasAccess('bookings') || hasAccess('reports'),
          badge: 0
        },
        {
          id: 'bookings',
          label: 'Online Bookings',
          subLabel: 'Booking Requests',
          icon: CalendarPlus,
          visible: hasAccess('bookings'),
          badge: 0
        },
        {
          id: 'pos_sales',
          label: 'POS Walk-in Sales',
          subLabel: 'Receipts & Balance Due',
          icon: ShoppingBag,
          visible: hasAccess('bookings'),
          badge: posUnpaidBalanceCount
        }
      ]
    },
    {
      groupTitle: 'Staff & Operations',
      items: [
        {
          id: 'reports',
          label: 'Staff History & Live',
          subLabel: 'In-Room & Performance',
          icon: BarChart2,
          visible: hasAccess('reports'),
          badge: 0
        },
        {
          id: 'payroll',
          label: 'Staff Pay Roll',
          subLabel: 'Commissions & Net Salary',
          icon: Banknote,
          visible: hasAccess('reports') || hasAccess('penalties'),
          badge: 0
        },
        {
          id: 'roster',
          label: 'Duty Roster',
          subLabel: 'Attendance & Shifts',
          icon: ClipboardList,
          visible: hasAccess('settings'),
          badge: 0
        },
        {
          id: 'hr',
          label: 'HR Management',
          subLabel: 'Onboarding & Profiles',
          icon: UserPlus,
          visible: hasAccess('settings'),
          badge: updateRequestCount + onboardingPendingCount
        },
        {
          id: 'handbook',
          label: 'Employee Handbook',
          subLabel: 'Staff Rules & CMS',
          icon: BookOpen,
          visible: hasAccess('settings'),
          badge: 0
        },
        {
          id: 'penalties',
          label: 'Penalty & Loans',
          subLabel: 'Fines & Staff Advances',
          icon: Banknote,
          visible: hasAccess('penalties'),
          badge: 0
        }
      ]
    },
    {
      groupTitle: 'Customers & VIP',
      items: [
        {
          id: 'users',
          label: 'Users & VIP Profiles',
          subLabel: 'Member Accounts & OTP',
          icon: User,
          visible: hasAccess('users'),
          badge: resetRequestCount
        },
        {
          id: 'points',
          label: 'Point Management',
          subLabel: 'Add & Audit VIP Points',
          icon: Star,
          visible: hasAccess('points'),
          badge: 0
        },
        {
          id: 'campaigns',
          label: 'Game Campaigns',
          subLabel: 'Lantern Game Winners',
          icon: Gift,
          visible: hasAccess('settings'),
          badge: 0
        }
      ]
    },
    {
      groupTitle: 'System & Security',
      items: [
        {
          id: 'pos_users',
          label: 'POS Staff Accounts',
          subLabel: 'POS Login & Cloud Sync',
          icon: Users,
          visible: hasAccess('admins') || hasAccess('settings'),
          badge: 0
        },
        {
          id: 'admins',
          label: 'Manage Admins',
          subLabel: 'Roles & Permissions',
          icon: ShieldCheck,
          visible: hasAccess('admins'),
          badge: 0
        },
        {
          id: 'settings',
          label: 'System Settings',
          subLabel: 'Menu, Staff & Branding',
          icon: Settings,
          visible: hasAccess('settings'),
          badge: 0
        }
      ]
    }
  ], [hasAccess, pendingCount, posUnpaidBalanceCount, updateRequestCount, onboardingPendingCount, resetRequestCount]);

  const activeNavItem = useMemo(() => {
    for (const grp of navGroups) {
      for (const it of grp.items) {
        if (it.id === tab) return it;
      }
    }
    return { label: 'Dashboard', subLabel: 'Overview', icon: TrendingUp };
  }, [navGroups, tab]);

  const totalAlertsCount = pendingCount + posUnpaidBalanceCount + resetRequestCount + updateRequestCount + onboardingPendingCount;

  if (!roleLoaded) return <div className="p-10 text-center text-gray-500 font-bold mt-10">Loading Admin Privileges...</div>;

  return (
    <div
      className="fixed inset-0 z-[100] bg-[#F4F6F5] flex overflow-hidden font-sans text-gray-800"
      onClick={handleInteraction}
    >
      <audio id="admin-alert-sound" src="https://actions.google.com/sounds/v1/alarms/alarm_clock.ogg" preload="auto" loop />

      {/* ==========================================
          MOBILE / TABLET BACKDROP OVERLAY
         ========================================== */}
      {isMobileSidebarOpen && (
        <div
          onClick={() => setIsMobileSidebarOpen(false)}
          className="fixed inset-0 z-[110] bg-black/60 backdrop-blur-xs lg:hidden transition-opacity"
        />
      )}

      {/* ==========================================
          LUXURY SIDE NAVIGATION BAR (Desktop Fixed + Mobile Slide-Out Drawer)
         ========================================== */}
      <aside
        className={`fixed lg:static inset-y-0 left-0 z-[120] bg-[#0B2419] text-white flex flex-col justify-between border-r border-[#C8A951]/25 shadow-2xl transition-all duration-300 ease-in-out ${
          isMobileSidebarOpen ? 'translate-x-0 w-72' : '-translate-x-full lg:translate-x-0'
        } ${isDesktopSidebarCollapsed ? 'lg:w-20' : 'lg:w-64'}`}
      >
        {/* 1. Brand Header inside Sidebar */}
        <div className="h-16 px-4 bg-gradient-to-r from-[#123524] to-[#0B2419] border-b border-[#C8A951]/25 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            {activeLogoUrl ? (
              <img
                src={activeLogoUrl}
                alt="The Shangri-La"
                className="w-10 h-10 rounded-full object-cover border-2 border-[#C8A951] shadow-md flex-shrink-0 bg-[#123524]"
              />
            ) : (
              <div className="w-10 h-10 rounded-full bg-[#123524] border-2 border-[#C8A951] flex items-center justify-center text-[#C8A951] font-serif font-black text-sm flex-shrink-0">
                SL
              </div>
            )}
            {!isDesktopSidebarCollapsed && (
              <div className="min-w-0">
                <h1 className="font-serif font-black text-sm text-[#D4AF37] tracking-wider truncate">
                  THE SHANGRI-LA
                </h1>
                <p className="text-[10px] text-emerald-200/80 font-semibold uppercase tracking-widest truncate">
                  Admin Backoffice
                </p>
              </div>
            )}
          </div>

          {/* Close Button on Mobile / Collapse Toggle on Desktop */}
          <button
            type="button"
            onClick={() => setIsMobileSidebarOpen(false)}
            className="lg:hidden p-1.5 rounded-lg bg-white/10 text-gray-300 hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* 2. Scrollable Categorized Navigation Links */}
        <div className="flex-1 overflow-y-auto py-3 px-2.5 space-y-4 scrollbar-hide">
          {navGroups.map((group, gIdx) => {
            const visibleItems = group.items.filter((i) => i.visible);
            if (visibleItems.length === 0) return null;
            return (
              <div key={gIdx} className="space-y-1">
                {!isDesktopSidebarCollapsed && (
                  <div className="px-3 py-1 text-[10px] font-extrabold uppercase tracking-widest text-[#D4AF37]/65">
                    {group.groupTitle}
                  </div>
                )}
                {visibleItems.map((item) => {
                  const isActive = tab === item.id;
                  const IconComp = item.icon;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => {
                        setTab(item.id as any);
                        setIsMobileSidebarOpen(false);
                      }}
                      title={isDesktopSidebarCollapsed ? `${item.label} — ${item.subLabel}` : undefined}
                      className={`w-full group relative flex items-center ${
                        isDesktopSidebarCollapsed ? 'justify-center px-2 py-3' : 'justify-between px-3 py-2.5'
                      } rounded-xl text-left transition-all duration-150 ${
                        isActive
                          ? 'bg-gradient-to-r from-[#D4AF37] via-[#e0be4c] to-[#C8A951] text-[#0B2419] shadow-lg font-black'
                          : 'text-gray-200 hover:bg-white/10 hover:text-white font-bold'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <IconComp
                          className={`w-4 h-4 flex-shrink-0 transition-transform group-hover:scale-110 ${
                            isActive ? 'text-[#0B2419]' : 'text-[#D4AF37]'
                          }`}
                        />
                        {!isDesktopSidebarCollapsed && (
                          <div className="min-w-0">
                            <div className="text-xs leading-tight truncate">{item.label}</div>
                            <div
                              className={`text-[10px] truncate mt-0.5 ${
                                isActive ? 'text-[#0B2419]/80 font-bold' : 'text-gray-400 font-medium'
                              }`}
                            >
                              {item.subLabel}
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Notification Badge */}
                      {item.badge > 0 && (
                        <span
                          className={`${
                            isDesktopSidebarCollapsed
                              ? 'absolute top-1.5 right-1.5 w-4 h-4 text-[9px]'
                              : 'px-2 py-0.5 text-[10px]'
                          } bg-red-500 text-white font-black rounded-full flex items-center justify-center shadow animate-pulse flex-shrink-0`}
                        >
                          {item.badge}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            );
          })}
        </div>

        {/* 3. Sidebar Footer Actions (POS Quick Launch, Collapse, Update & Logout) */}
        <div className="p-3 border-t border-white/10 bg-black/25 space-y-2 flex-shrink-0">
          {/* Open Walk-in POS Terminal Button */}
          <button
            type="button"
            onClick={() => (window.location.href = '/?mode=pos')}
            title="Open Walk-in POS Terminal"
            className="w-full py-2.5 px-3 rounded-xl bg-[#123524] hover:bg-[#1a4a32] text-[#D4AF37] border border-[#D4AF37]/40 text-xs font-black flex items-center justify-center gap-2 shadow-sm transition"
          >
            <ShoppingBag className="w-4 h-4 flex-shrink-0" />
            {!isDesktopSidebarCollapsed && <span>Open Walk-in POS →</span>}
          </button>

          <div className={`grid ${isDesktopSidebarCollapsed ? 'grid-cols-1' : 'grid-cols-2'} gap-1.5`}>
            <button
              type="button"
              onClick={handleForceRefreshApp}
              title="Clear Cache & Update App"
              className="py-2 px-2.5 rounded-xl bg-white/10 hover:bg-white/15 text-gray-200 text-[11px] font-bold flex items-center justify-center gap-1.5 transition"
            >
              <span>🔄</span>
              {!isDesktopSidebarCollapsed && <span>Update App</span>}
            </button>

            <button
              type="button"
              onClick={onLogout}
              title="Logout Admin"
              className="py-2 px-2.5 rounded-xl bg-red-500/20 hover:bg-red-500/30 text-red-300 border border-red-500/30 text-[11px] font-bold flex items-center justify-center gap-1.5 transition"
            >
              <LogOut className="w-3.5 h-3.5 flex-shrink-0" />
              {!isDesktopSidebarCollapsed && <span>Logout</span>}
            </button>
          </div>

          {/* Desktop Sidebar Collapse/Expand Toggle */}
          <button
            type="button"
            onClick={() => setIsDesktopSidebarCollapsed(!isDesktopSidebarCollapsed)}
            className="hidden lg:flex w-full py-1.5 text-[10px] font-bold text-gray-400 hover:text-[#D4AF37] items-center justify-center gap-1 transition"
          >
            {isDesktopSidebarCollapsed ? '➔ Expand Menu' : '← Collapse Sidebar'}
          </button>
        </div>
      </aside>

      {/* ==========================================
          MAIN FULL-SCREEN WORKSPACE (100% Width on Desktop & Responsive on Mobile/Tablet)
         ========================================== */}
      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
        {/* Top Executive Header Bar */}
        <header className="h-16 bg-white border-b border-gray-200 px-4 sm:px-6 flex items-center justify-between gap-3 flex-shrink-0 shadow-2xs z-20">
          <div className="flex items-center gap-3 min-w-0">
            {/* Hamburger Menu Button for Mobile & Tablet */}
            <button
              type="button"
              onClick={() => setIsMobileSidebarOpen(true)}
              className="lg:hidden p-2.5 rounded-xl bg-[#123524] text-[#D4AF37] shadow-sm active:scale-95 transition relative"
              title="Open Admin Menu"
            >
              <div className="space-y-1">
                <span className="block w-4 h-0.5 bg-[#D4AF37]" />
                <span className="block w-4 h-0.5 bg-[#D4AF37]" />
                <span className="block w-4 h-0.5 bg-[#D4AF37]" />
              </div>
              {totalAlertsCount > 0 && (
                <span className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-red-500 text-white text-[9px] font-black flex items-center justify-center">
                  {totalAlertsCount}
                </span>
              )}
            </button>

            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-extrabold text-[#123524] truncate">
                  {activeNavItem.label}
                </h2>
                <span className="hidden sm:inline-block bg-[#123524]/10 text-[#123524] px-2.5 py-0.5 rounded-full text-[10px] font-bold">
                  {activeNavItem.subLabel}
                </span>
              </div>
              <p className="text-[11px] text-gray-400 font-semibold hidden sm:block">
                The Shangri-La Men's Retreat • Mandalay Executive Portal
              </p>
            </div>
          </div>

          {/* Right Quick Status Pills & Actions */}
          <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
            {pendingCount > 0 && (
              <button
                type="button"
                onClick={() => setTab('bookings')}
                className="px-3 py-1.5 rounded-full bg-red-50 text-red-600 border border-red-200 text-xs font-black flex items-center gap-1.5 animate-pulse hover:bg-red-100 transition"
              >
                <CalendarPlus className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Pending Bookings:</span> {pendingCount}
              </button>
            )}

            {posUnpaidBalanceCount > 0 && (
              <button
                type="button"
                onClick={() => setTab('pos_sales')}
                className="px-3 py-1.5 rounded-full bg-amber-50 text-amber-800 border border-amber-300 text-xs font-black flex items-center gap-1.5 hover:bg-amber-100 transition"
              >
                <ShoppingBag className="w-3.5 h-3.5 text-amber-600" />
                <span className="hidden sm:inline">POS Balance Due:</span> {posUnpaidBalanceCount}
              </button>
            )}

            <div className="hidden md:flex items-center gap-2 bg-gray-50 border border-gray-200 px-3 py-1.5 rounded-xl">
              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
              <span className="text-xs font-bold text-gray-700 capitalize">{loggedInAdmin}</span>
              <span className="text-[10px] font-black bg-[#123524] text-[#D4AF37] px-2 py-0.5 rounded uppercase">
                {adminRole === 'super_admin' ? 'Super Admin' : 'Staff Admin'}
              </span>
            </div>
          </div>
        </header>

        {/* Scrollable Full-Width Content Area */}
        <main className="flex-1 overflow-y-auto p-3 sm:p-5 lg:p-6">
          <div className="w-full max-w-[1600px] mx-auto pb-12">
            {tab === 'bookings' && hasAccess('bookings') && <AdminBookingsList bookings={bookings} adminRole={adminRole} />}
            {tab === 'reports' && hasAccess('reports') && <AdminStaffHistoryList bookings={historyBookings} allBookings={bookings} adminRole={adminRole} therapists={appData.therapists} />}
            {tab === 'users' && hasAccess('users') && <AdminUsersList adminRole={adminRole} appData={appData} />}
            {tab === 'points' && hasAccess('points') && <AdminPointManagement adminRole={adminRole} appData={appData} />}
            {tab === 'admins' && hasAccess('admins') && <AdminManagementList />}
            {tab === 'payroll' && (hasAccess('reports') || hasAccess('penalties')) && (<AdminStaffPayrollManager bookings={bookings} therapists={appData.therapists} adminRole={adminRole} />)}
            {tab === 'penalties' && hasAccess('penalties') && <AdminPenaltyManager therapists={appData.therapists} />}
            {tab === 'roster' && hasAccess('settings') && <DutyRosterSystem therapists={appData.therapists} />}
            {tab === 'hr' && hasAccess('settings') && <AdminHRManagement />}
            {tab === 'settings' && hasAccess('settings') && <AdminSettings appData={appData} onSettingsUpdated={onSettingsUpdated} />}
            {tab === 'campaigns' && hasAccess('settings') && <AdminCampaignsView bookings={bookings} adminRole={adminRole} />}
            {tab === 'pos_sales' && hasAccess('bookings') && <AdminPOSSalesList bookings={bookings} adminRole={adminRole} />}
            {tab === 'sales_summary' && hasAccess('bookings') && <AdminSalesSummaryView bookings={bookings} appData={appData} />}
            {tab === 'revenue_dashboard' && (hasAccess('bookings') || hasAccess('reports')) && <AdminRevenueProfitDashboard bookings={bookings} therapists={appData.therapists} />}
            {tab === 'expenses' && (hasAccess('bookings') || hasAccess('reports')) && <AdminExpenseManager bookings={bookings} therapists={appData.therapists} adminRole={adminRole} onOpenReport={() => setTab('expense_report')} />}
{tab === 'expense_report' && (hasAccess('bookings') || hasAccess('reports')) && <AdminExpenseReportDashboard bookings={bookings} therapists={appData.therapists} adminRole={adminRole} onOpenEntry={() => setTab('expenses')} />}
            {tab === 'handbook' && hasAccess('settings') && <AdminEmployeeHandbookManager />}
            {tab === 'pos_users' && (hasAccess('admins') || hasAccess('settings')) && <AdminPOSUsersManager adminRole={adminRole} />}
          </div>
        </main>
      </div>
    </div>
  );
});

function AdminBookingsList({ bookings, adminRole }: { bookings: Booking[], adminRole: string }) {
  const [filterPayMode, setFilterPayMode] = useState<'all' | 'pending_action' | 'deposit_only' | 'paid_in_full' | 'cancelled'>('all');
  const [dateFilterMode, setDateFilterMode] = useState<'all' | 'today' | 'yesterday' | 'this_month' | 'last_month' | 'upcoming' | 'custom_range'>('all');
  const [fromDate, setFromDate] = useState<string>(getLocalTodayStr());
  const [toDate, setToDate] = useState<string>(getLocalTodayStr());
  const [searchQuery, setSearchQuery] = useState('');

  // 🌟 Campaign Winners စာရင်းကို အလိုအလျောက် ဆွဲယူထားမည် 🌟
  const [campaignWinnersList, setCampaignWinnersList] = useState<any[]>([]);
  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'campaign_records'), (snap) => {
      const arr: any[] = [];
      snap.forEach((d) => arr.push({ id: d.id, ...d.data() }));
      setCampaignWinnersList(arr);
    });
    return () => unsub();
  }, []);

  // 🌟 Modals States (Deposit Config, View Slip Details, Cancel with Reason) 🌟
  const [depositModalBooking, setDepositModalBooking] = useState<Booking | null>(null);
  const [customDepositInput, setCustomDepositInput] = useState<string>('');
  const [viewingBooking, setViewingBooking] = useState<Booking | null>(null);
  const [cancellingBooking, setCancellingBooking] = useState<Booking | null>(null);
  const [cancelReasonInput, setCancelReasonInput] = useState<string>('');
  const [isSubmittingCancel, setIsSubmittingCancel] = useState(false);

  const getYesterdayStr = () => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  };

  const getThisMonthPrefix = () => {
    const d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
  };

  const getLastMonthPrefix = () => {
    const d = new Date();
    d.setDate(1);
    d.setMonth(d.getMonth() - 1);
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
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
    if (dateStr > today) return `ကြိုတင်ရက်ချိန်း (Upcoming) — ${formatted}`;
    return formatted;
  };

  // 🌟 STRICT FILTER: Customer Web App မှ တင်ထားသော Online Booking အစစ်များ (POS မှ Add-on / VVIP Upgrade လုပ်ထားသည့် Online Booking များအပါအဝင်) 🌟
  const onlineOnlyBookings = useMemo(() => {
    return bookings.filter((b: any) => {
      const rawTx = String(b.txId || '').trim();
      const rawTxUpper = rawTx.toUpperCase();
      const rawName = String(b.name || '').trim().toLowerCase();
      const rawPay = String(b.paymentMethod || '').trim().toLowerCase();
      const rawDisc = String(b.discountLabel || '').trim().toLowerCase();
      const rawService = String(b.service || '').trim().toLowerCase();
      const rawTime = String(b.time || '').trim().toLowerCase();
      const priceNum = Number(b.totalPrice) || 0;

      // ✅ အကယ်၍ မူလကတည်းက Online Booking ဖြစ်ကြောင်း သတ်မှတ်ထားပါက (POS မှ ပြင်ဆင်ထားသော်လည်း) Online Bookings ထဲတွင်သာ အမြဲပြသမည်
      if (Boolean(b.isOnlineBooking) || Boolean(b.onlineBookingId)) {
        return true;
      }

      // 1. သီးသန့် POS Walk-in ဘောင်ချာအသစ်များ (SL-...) ကိုသာ ဖယ်ထုတ်မည်
      if (
        rawTxUpper.startsWith('SL-') ||
        rawPay.includes('shop pos') ||
        rawDisc.includes('[shop walk-in') ||
        Boolean(b.posLocalId)
      ) {
        return false;
      }

      // 2. Staff Clock-In / Admin Clock-In နှင့် 0 Ks Reward များကို ဖယ်ထုတ်မည်
      const isStaffClockInOrNonSale =
        rawTxUpper === 'ADMIN' ||
        rawTxUpper === 'CASH' ||
        rawTx === '' ||
        rawTx === '-' ||
        rawName === 'walk-in (admin manual)' ||
        rawPay.includes('cash payment in shop') ||
        rawPay.includes('admin clock') ||
        rawService.includes('walk-in reward redemption') ||
        rawTime === 'walk-in' ||
        priceNum <= 0 ||
        Boolean(b.isStaffClockIn) ||
        Boolean(b.isAdminClockIn);

      return !isStaffClockInOrNonSale;
    });
  }, [bookings]);

  // 🌟 1. ရက်စွဲ (Date Filter: Today, Yesterday, This Month, Last Month, From-To Range) နှင့် Search စစ်ထုတ်ခြင်း 🌟
  const dateAndSearchFiltered = useMemo(() => {
    const today = getLocalTodayStr();
    const yesterday = getYesterdayStr();
    const thisMonthPrefix = getThisMonthPrefix();
    const lastMonthPrefix = getLastMonthPrefix();
    const q = searchQuery.trim().toLowerCase();

    return onlineOnlyBookings.filter((b: any) => {
      const bDate = b.date || today;
      if (dateFilterMode === 'today' && bDate !== today) return false;
      if (dateFilterMode === 'yesterday' && bDate !== yesterday) return false;
      if (dateFilterMode === 'this_month' && !bDate.startsWith(thisMonthPrefix)) return false;
      if (dateFilterMode === 'last_month' && !bDate.startsWith(lastMonthPrefix)) return false;
      if (dateFilterMode === 'upcoming' && bDate <= today) return false;
      if (dateFilterMode === 'custom_range') {
        const start = fromDate && toDate && fromDate > toDate ? toDate : fromDate;
        const end = fromDate && toDate && fromDate > toDate ? fromDate : toDate;
        if (start && bDate < start) return false;
        if (end && bDate > end) return false;
      }

      if (q) {
        const matchSearch =
          (b.name || '').toLowerCase().includes(q) ||
          (b.phone || '').toLowerCase().includes(q) ||
          (b.txId || '').toLowerCase().includes(q) ||
          (b.service || '').toLowerCase().includes(q) ||
          (b.therapist || '').toLowerCase().includes(q) ||
          (b.discountLabel || '').toLowerCase().includes(q) ||
          (b.cancelReason || '').toLowerCase().includes(q);
        if (!matchSearch) return false;
      }
      return true;
    });
  }, [onlineOnlyBookings, dateFilterMode, fromDate, toDate, searchQuery]);

  // 🌟 2. Payment / Status Filter ထပ်စစ်ခြင်း 🌟
  const filteredBookings = useMemo(() => {
    return dateAndSearchFiltered.filter((b: any) => {
      const isCancelled = b.status === 'cancelled';
      if (filterPayMode === 'cancelled') return isCancelled;

      const isPendingAction = b.status === 'pending' || b.status === 'payment_checking';
      if (filterPayMode === 'pending_action') return !isCancelled && isPendingAction;

      const isDepositDue = !isCancelled && b.paymentStatus === 'deposit_only' && Number(b.balanceDue) > 0;
      if (filterPayMode === 'deposit_only') return isDepositDue;
      if (filterPayMode === 'paid_in_full') return !isCancelled && !isDepositDue;

      return true; // 'all'
    });
  }, [dateAndSearchFiltered, filterPayMode]);

  // 🌟 3. Summary Financial Cards (4 Cards - Excludes Cancelled Bookings Automatically!) 🌟
  const summaryStats = useMemo(() => {
    let totalOnlineSalesAmt = 0;
    let totalDiscountAmt = 0;
    let totalCollectedAmt = 0;
    let totalPendingBalanceAmt = 0;
    let pendingBalanceCount = 0;
    let pendingActionCount = 0;
    let validBookingsCount = 0;
    let cancelledCount = 0;

    dateAndSearchFiltered.forEach((b: any) => {
      if (b.status === 'cancelled') {
        cancelledCount++;
        return;
      }
      validBookingsCount++;
      if (b.status === 'pending' || b.status === 'payment_checking') {
        pendingActionCount++;
      }

      const total = Number(b.totalPrice) || 0;
      const orig = Number(b.originalPrice) || total;
      const disc = orig > total ? orig - total : 0;

      const isDepositDue = b.paymentStatus === 'deposit_only' && Number(b.balanceDue) > 0;
      const due = isDepositDue ? Number(b.balanceDue) || 0 : 0;
      const paid = isDepositDue ? (Number(b.depositPaid) || Math.max(0, total - due)) : total;

      totalOnlineSalesAmt += total;
      totalDiscountAmt += disc;
      totalCollectedAmt += paid;
      totalPendingBalanceAmt += due;
      if (isDepositDue) pendingBalanceCount++;
    });

    return {
      totalOnlineSalesAmt,
      totalDiscountAmt,
      totalCollectedAmt,
      totalPendingBalanceAmt,
      pendingBalanceCount,
      pendingActionCount,
      validBookingsCount,
      cancelledCount
    };
  }, [dateAndSearchFiltered]);

  // 🌟 4. ရက်စွဲတစ်ရက်ချင်းစီအလိုက် အုပ်စုဖွဲ့ပြီး Daily Total တွက်ချက်ခြင်း 🌟
  const groupedBookingsByDate = useMemo(() => {
    const today = getLocalTodayStr();
    const groupsMap = new Map<
      string,
      {
        date: string;
        bookingsList: Booking[];
        validCount: number;
        pendingCount: number;
        cancelledCount: number;
        dailyTotalAmount: number;
        dailyCollectedAmount: number;
        dailyPendingBalance: number;
      }
    >();

    filteredBookings.forEach((b: any) => {
      const dKey = b.date || today;
      if (!groupsMap.has(dKey)) {
        groupsMap.set(dKey, {
          date: dKey,
          bookingsList: [],
          validCount: 0,
          pendingCount: 0,
          cancelledCount: 0,
          dailyTotalAmount: 0,
          dailyCollectedAmount: 0,
          dailyPendingBalance: 0
        });
      }
      const grp = groupsMap.get(dKey)!;
      grp.bookingsList.push(b);

      if (b.status === 'cancelled') {
        grp.cancelledCount += 1;
        return;
      }

      grp.validCount += 1;
      if (b.status === 'pending' || b.status === 'payment_checking') {
        grp.pendingCount += 1;
      }

      const total = Number(b.totalPrice) || 0;
      const isDepositDue = b.paymentStatus === 'deposit_only' && Number(b.balanceDue) > 0;
      const due = isDepositDue ? Number(b.balanceDue) || 0 : 0;
      const paid = isDepositDue ? (Number(b.depositPaid) || Math.max(0, total - due)) : total;

      grp.dailyTotalAmount += total;
      grp.dailyCollectedAmount += paid;
      grp.dailyPendingBalance += due;
    });

    return Array.from(groupsMap.values()).sort((a, b) => b.date.localeCompare(a.date));
  }, [filteredBookings]);

  const handleStatusChange = async (b: Booking, newStatus: string) => {
    if (newStatus === 'cancelled') {
      setCancellingBooking(b);
      setCancelReasonInput('');
      return;
    }
    if (!window.confirm(`Booking Status ကို "${newStatus.toUpperCase()}" သို့ ပြောင်းလဲမည်မှာ သေချာပါသလား?`)) return;

    let updateData: any = { status: newStatus, cancelReason: '' };

    // အကယ်၍ Approved လုပ်ခြင်းဖြစ်ပြီး ပွိုင့်မထည့်ရသေးပါက Points များကို လုံခြုံစွာ ပေါင်းထည့်မည်
    if (newStatus === 'approved' && !(b as any).pointsAdded && b.totalPrice >= 35000) {
      const earnedPts = Math.floor(b.totalPrice / 35000);
      try {
        const usersSnap = await getDocs(collection(db, 'users'));
        let targetDocRef: any = null;
        let existingPts = 0;

        const cleanBookingPhone = String(b.phone || '').trim();
        const normalizePhone = (p: string) => p.replace(/[^0-9]/g, '').replace(/^959/, '09');
        const targetNorm = normalizePhone(cleanBookingPhone);

        usersSnap.forEach(d => {
          const uData = d.data();
          const decPhone = decryptText(uData.phone) || uData.phone || d.id;
          const decPhoneNorm = normalizePhone(decPhone);
          
          if (decPhone === cleanBookingPhone || d.id === cleanBookingPhone || (targetNorm.length >= 7 && decPhoneNorm === targetNorm)) {
            targetDocRef = doc(db, 'users', d.id);
            const rawPts = decryptText(uData.points) || uData.points || '0';
            existingPts = parseInt(rawPts, 10) || 0;
          }
        });

        if (targetDocRef) {
          // အကယ်၍ Customer အကောင့် ရှိပြီးသားဆိုလျှင် Points ပေါင်းမည်
          await runTransaction(db, async (transaction) => {
            const userDoc = await transaction.get(targetDocRef);
            if (!userDoc.exists()) throw new Error("User does not exist!");

            const uData = userDoc.data() as any;
            const currentPts = parseInt(decryptText(uData.points) || uData.points || '0', 10) || existingPts;
            const newTotal = currentPts + earnedPts;

            transaction.update(targetDocRef, { points: encryptText(newTotal.toString()) });

            const newHistoryRef = doc(collection(db, 'point_history'));
            transaction.set(newHistoryRef, {
              phone: encryptText(cleanBookingPhone),
              amount: encryptText(b.totalPrice.toString()),
              pointsEarned: encryptText(earnedPts.toString()),
              invoiceNo: encryptText(b.txId || 'Online'),
              type: encryptText('Online Booking'),
              date: getLocalTodayStr(),
              createdAt: Date.now()
            });

            const bookingRef = doc(db, 'bookings', b.id!);
            transaction.update(bookingRef, { ...updateData, pointsAdded: true });
          });

          alert(`✅ Booking Confirmed! Customer ထံသို့ Point (${earnedPts} Pts) အလိုအလျောက် ပေါင်းထည့်ပေးလိုက်ပါပြီ။`);
          return;
        } else {
          // အကယ်၍ Customer အကောင့် မရှိသေးပါက အလိုအလျောက် အကောင့်သစ် ဖွင့်ပေးပြီး Points ထည့်မည်
          const newUserRef = doc(collection(db, 'users'));
          await setDoc(newUserRef, {
            phone: encryptText(cleanBookingPhone),
            name: encryptText(b.name || 'Online Guest'),
            password: encryptText(''),
            dob: encryptText(''),
            points: encryptText(earnedPts.toString()),
            createdAt: Date.now()
          });

          await addDoc(collection(db, 'point_history'), {
            phone: encryptText(cleanBookingPhone),
            amount: encryptText(b.totalPrice.toString()),
            pointsEarned: encryptText(earnedPts.toString()),
            invoiceNo: encryptText(b.txId || 'Online'),
            type: encryptText('Online Booking'),
            date: getLocalTodayStr(),
            createdAt: Date.now()
          });

          await updateDoc(doc(db, 'bookings', b.id!), { ...updateData, pointsAdded: true });
          alert(`✅ Booking Confirmed! Customer အကောင့်အသစ် ဖွင့်လှစ်ပေးပြီး Point (${earnedPts} Pts) ထည့်သွင်းပြီးပါပြီ။`);
          return;
        }
      } catch (e) {
        console.error("Transaction Error:", e);
        // အကယ်၍ Transaction Fail ခدခဲ့ရင်တောင် Booking Status ကို အရင် Approved ဖြစ်အောင် Update လုပ်ပေးမည် (အရေးကြီးဆုံးဖြစ်သောကြောင့်)
        await updateDoc(doc(db, 'bookings', b.id!), updateData);
        alert("⚠️ Booking Status ကို အတည်ပြုပြီးပါပြီ (သို့သော် Point ပေါင်းရာတွင် အကြိမ်ရေကန့်သတ်ချက်/ချိတ်ဆက်မှု အနည်းငယ်နှောင့်နှေးသွားပါသည်။)");
        return;
      }
    }

    try {
      await updateDoc(doc(db, 'bookings', b.id!), updateData);
    } catch (e) {
      alert("Error Update Status");
    }
  };

  // 🌟 Confirm Cancel Online Booking with Reason 🌟
  const handleConfirmCancelOnlineBooking = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cancellingBooking) return;
    const reason = cancelReasonInput.trim();
    if (!reason) {
      alert('ကျေးဇူးပြု၍ ပယ်ဖျက်ရသည့် အကြောင်းရင်း (Cancel Reason) ရေးပေးပါ။');
      return;
    }
    setIsSubmittingCancel(true);
    try {
      await updateDoc(doc(db, 'bookings', cancellingBooking.id!), {
        status: 'cancelled',
        cancelReason: reason,
        cancelledAt: Date.now()
      });
      setCancellingBooking(null);
      setCancelReasonInput('');
    } catch (err) {
      alert('Booking ပယ်ဖျက်ရာတွင် အမှားအယွင်းရှိနေပါသည်။');
    } finally {
      setIsSubmittingCancel(false);
    }
  };

  // 🌟 Online Booking အား စရံတစ်ဝက် (50%) သို့မဟုတ် စိတ်ကြိုက်စရံ သတ်မှတ်ပေးမည့် Function 🌟
  const handleSetOnlineDeposit = async (b: Booking, depositAmt: number) => {
    const total = Number(b.totalPrice) || 0;
    const validDep = Math.max(0, Math.min(total, Math.round(depositAmt)));
    const balDue = Math.max(0, total - validDep);
    const cleanMethod = (b.paymentMethod || 'Online Pay').split('(')[0].trim();

    try {
      if (balDue === 0) {
        await updateDoc(doc(db, 'bookings', b.id!), {
          paymentStatus: 'paid_in_full',
          depositPaid: total,
          balanceDue: 0,
          paymentMethod: `${cleanMethod} (Full Paid)`
        });
      } else {
        await updateDoc(doc(db, 'bookings', b.id!), {
          paymentStatus: 'deposit_only',
          depositPaid: validDep,
          balanceDue: balDue,
          paymentMethod: `${cleanMethod} (စရံ: ${formatPrice(validDep)} | ကျန်ငွေ: ${formatPrice(balDue)})`
        });
      }
      setDepositModalBooking(null);
      setCustomDepositInput('');
    } catch (e) {
      alert('စရံငွေ သတ်မှတ်ရာတွင် အမှားအယွင်းရှိနေပါသည်။');
    }
  };

  // 🌟 Direct Telegram Contact Helper for Customer 🌟
  const handleContactCustomerTelegram = (b: Booking) => {
    if (!b.phone) return;
    let formattedPhone = b.phone.replace(/[^0-9+]/g, '');
    if (formattedPhone.startsWith('09')) {
      formattedPhone = '+959' + formattedPhone.substring(2);
    } else if (!formattedPhone.startsWith('+')) {
      formattedPhone = '+' + formattedPhone;
    }
    const msg = encodeURIComponent(
      `မင်္ဂလာပါ ခင်ဗျာ။ The Shangri-La Men's Retreat မှ ဖြစ်ပါသည်။\nလူကြီးမင်း၏ Online Booking —\n• ရက်စွဲ/အချိန်: ${b.date} (${b.time})\n• ဝန်ဆောင်မှု: ${b.service}\n• Therapist: ${b.therapist}\n• ကျသင့်ငွေ: ${formatPrice(b.totalPrice)}\nအား လက်ခံရရှိပြီး အတည်ပြုပေးထားပါသည်ခင်ဗျာ။`
    );
    window.open(`https://t.me/${formattedPhone}?text=${msg}`, '_blank');
  };

  const handleDelete = async (id: string) => {
    if (adminRole !== 'super_admin') {
      alert('Super Admin သာလျှင် ဖျက်ခွင့်ရှိပါသည်။');
      return;
    }
    if (window.confirm('ဤ Online Booking မှတ်တမ်းကို အပြီးတိုင် ဖျက်မည်မှာ သေချာပါသလား?')) {
      await deleteDoc(doc(db, 'bookings', id));
    }
  };

  const handleExportExcel = () => {
    const headers = ['Booking ID', 'Status', 'Cancel Reason', 'Date', 'Time', 'Customer Name', 'Phone', 'Service', 'Therapist', 'Original Price (Ks)', 'Discount Percent (%)', 'Discount Label', 'Net Total Price (Ks)', 'Payment Method', 'Payment Status', 'Deposit Paid (Ks)', 'Balance Due (Ks)', 'Transaction ID', 'Special Request', 'Submitted At'];
    const rows = filteredBookings.map((b: any) => {
      const isCancelled = b.status === 'cancelled';
      const isDep = !isCancelled && b.paymentStatus === 'deposit_only' && Number(b.balanceDue) > 0;
      const depPaid = isCancelled ? 0 : isDep ? Number(b.depositPaid) || 0 : Number(b.totalPrice) || 0;
      const balDue = isDep ? Number(b.balanceDue) || 0 : 0;
      return [
        b.id || '',
        `"${b.status || ''}"`,
        `"${b.cancelReason || ''}"`,
        b.date || '',
        `"${b.time || ''}"`,
        `"${b.name || ''}"`,
        `"${b.phone || ''}"`,
        `"${b.service || ''}"`,
        `"${b.therapist || ''}"`,
        b.originalPrice || b.totalPrice || 0,
        b.discountPercent || 0,
        b.discountLabel ? `"${b.discountLabel}"` : '',
        isCancelled ? 0 : (b.totalPrice || 0),
        `"${b.paymentMethod || ''}"`,
        isCancelled ? 'Cancelled' : isDep ? 'Deposit Only' : 'Paid in Full',
        depPaid,
        balDue,
        `"${b.txId || ''}"`,
        `"${b.specialRequest || ''}"`,
        b.createdAt ? `"${new Date(b.createdAt).toLocaleString()}"` : ''
      ];
    });
    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `Online_Bookings_Report_${dateFilterMode === 'custom_range' ? `${fromDate}_to_${toDate}` : getLocalTodayStr()}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200 space-y-6 animate-fade-in">
      {/* ==========================================
          MODAL 1: DEPOSIT / FULL PAID CONFIGURATION
         ========================================== */}
      {depositModalBooking && (
        <div className="fixed inset-0 z-[250] bg-black/65 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-5 shadow-2xl border border-[#D4AF37]/40 space-y-4 animate-fade-in">
            <div className="flex justify-between items-center border-b pb-3">
              <div>
                <h3 className="text-sm font-black text-[#123524]">Online ငွေလွှဲပမာဏ စစ်ဆေးသတ်မှတ်ရန်</h3>
                <p className="text-[11px] text-gray-500">
                  {depositModalBooking.name} • စုစုပေါင်း: <strong className="text-[#123524]">{formatPrice(depositModalBooking.totalPrice)}</strong>
                </p>
              </div>
              <button onClick={() => setDepositModalBooking(null)} className="text-gray-400 hover:text-red-500">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-2">
              <div className="text-[11px] font-bold text-gray-600">အမြန်ရွေးချယ်ရန် (Quick Presets):</div>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => handleSetOnlineDeposit(depositModalBooking, Math.round(depositModalBooking.totalPrice / 2))}
                  className="p-2.5 rounded-xl bg-amber-50 hover:bg-amber-100 border border-amber-300 text-amber-900 text-xs font-black transition text-center"
                >
                  50% စရံတစ်ဝက်
                  <span className="block text-[10px] font-bold text-amber-700 mt-0.5">
                    ({formatPrice(Math.round(depositModalBooking.totalPrice / 2))})
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => handleSetOnlineDeposit(depositModalBooking, depositModalBooking.totalPrice)}
                  className="p-2.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 text-emerald-900 text-xs font-black transition text-center"
                >
                  100% အပြည့်ချေပြီး
                  <span className="block text-[10px] font-bold text-emerald-700 mt-0.5">
                    ({formatPrice(depositModalBooking.totalPrice)})
                  </span>
                </button>
              </div>
            </div>

            <div className="pt-2 border-t border-gray-100 space-y-2">
              <label className="block text-[11px] font-bold text-gray-600">
                သို့မဟုတ် လွှဲထားသည့် စရံငွေပမာဏ ရိုက်ထည့်ရန် (Ks):
              </label>
              <input
                type="number"
                value={customDepositInput}
                onChange={(e) => setCustomDepositInput(e.target.value)}
                placeholder="ဥပမာ - 15000"
                className="w-full p-2.5 bg-gray-50 border border-gray-300 rounded-xl text-sm font-black text-[#123524] outline-none focus:border-[#123524]"
              />
              {customDepositInput && (
                <div className="flex justify-between text-xs font-bold px-1">
                  <span className="text-amber-800">စရံ: {formatPrice(Number(customDepositInput) || 0)}</span>
                  <span className="text-red-600">
                    ကျန်ငွေ: {formatPrice(Math.max(0, depositModalBooking.totalPrice - (Number(customDepositInput) || 0)))}
                  </span>
                </div>
              )}
              <button
                type="button"
                disabled={!customDepositInput}
                onClick={() => handleSetOnlineDeposit(depositModalBooking, Number(customDepositInput) || 0)}
                className="w-full py-2.5 bg-[#123524] text-[#D4AF37] rounded-xl text-xs font-black uppercase tracking-wider disabled:opacity-40 shadow-sm"
              >
                Save Deposit Amount
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==========================================
          MODAL 2: VIEW ONLINE BOOKING SLIP DETAILS
         ========================================== */}
      {viewingBooking && (() => {
        const isCancelled = viewingBooking.status === 'cancelled';
        const total = Number(viewingBooking.totalPrice) || 0;
        const orig = Number(viewingBooking.originalPrice) || total;
        const discAmt = orig > total ? orig - total : 0;
        const isDepDue = !isCancelled && (viewingBooking as any).paymentStatus === 'deposit_only' && Number((viewingBooking as any).balanceDue) > 0;
        const depAmt = Number((viewingBooking as any).depositPaid) || 0;
        const balAmt = Number((viewingBooking as any).balanceDue) || 0;
        const serviceList = String(viewingBooking.service || '').split(',').map(s => s.trim()).filter(Boolean);

        return (
          <div className="fixed inset-0 z-[250] bg-black/70 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
            <div className="bg-white rounded-3xl max-w-sm w-full p-5 shadow-2xl border border-[#D4AF37]/40 my-auto animate-fade-in space-y-4">
              <div className="flex justify-between items-center border-b border-gray-100 pb-3">
                <h3 className="text-sm font-black text-[#123524] flex items-center">
                  <CalendarPlus className="w-4 h-4 mr-1.5 text-[#D4AF37]" />
                  Online Booking Slip (ဘောင်ချာအသေးစိတ်)
                </h3>
                <button onClick={() => setViewingBooking(null)} className="p-1 rounded-full bg-gray-100 text-gray-500 hover:text-red-600">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="bg-gray-50 p-4 rounded-2xl border border-gray-200 font-mono text-xs space-y-3">
                {isCancelled && (
                  <div className="bg-red-600 text-white text-center py-1.5 px-3 rounded-lg font-sans font-black text-xs uppercase tracking-widest">
                    🚫 CANCELLED BOOKING (ပယ်ဖျက်ထားသည်)
                  </div>
                )}

                <div className="text-center border-b border-dashed border-gray-300 pb-2.5">
                  <div className="font-serif font-black text-sm text-[#123524]">THE SHANGRI-LA</div>
                  <div className="text-[9px] text-gray-500 uppercase tracking-widest">MEN'S RETREAT • ONLINE BOOKING</div>
                </div>

                <div className="space-y-1 text-[11px] border-b border-dashed border-gray-300 pb-2.5">
                  <div className="flex justify-between">
                    <span className="text-gray-500">Transaction ID:</span>
                    <span className="font-black text-[#123524]">{viewingBooking.txId || '-'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Booking Date:</span>
                    <span className="font-bold">{viewingBooking.date} ({viewingBooking.time})</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Customer:</span>
                    <span className="font-bold text-right">{viewingBooking.name} ({viewingBooking.phone})</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Therapist:</span>
                    <span className="font-bold text-[#123524] text-right">{viewingBooking.therapist || '-'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Status:</span>
                    <span className="font-black uppercase text-emerald-700">{viewingBooking.status}</span>
                  </div>
                </div>

                <div className="space-y-1.5 border-b border-dashed border-gray-300 pb-2.5">
                  <div className="text-[10px] font-bold text-gray-400 uppercase">Booked Services:</div>
                  {serviceList.map((svc, i) => (
                    <div key={i} className="text-[11px] font-bold text-gray-800 pl-1">
                      {i + 1}. {svc}
                    </div>
                  ))}
                  {viewingBooking.specialRequest && (
                    <div className="text-[10px] text-red-600 italic pt-1">
                      Note: {viewingBooking.specialRequest}
                    </div>
                  )}
                </div>

                <div className="space-y-1 text-xs">
                  <div className="flex justify-between text-[11px]">
                    <span className="text-gray-500">Subtotal (မူရင်းကျသင့်ငွေ):</span>
                    <span className="font-bold">{formatPrice(orig)}</span>
                  </div>
                  {discAmt > 0 && (
                    <div className="flex justify-between text-[11px] text-green-700 font-bold">
                      <span>Discount ({viewingBooking.discountLabel || `${viewingBooking.discountPercent}%`}):</span>
                      <span>-{formatPrice(discAmt)}</span>
                    </div>
                  )}
                  <div className={`flex justify-between text-sm font-black py-1.5 border-t border-dashed border-gray-300 ${isCancelled ? 'line-through text-gray-400' : 'text-[#123524]'}`}>
                    <span>NET TOTAL:</span>
                    <span>{formatPrice(total)}</span>
                  </div>
                  <div className="flex justify-between text-[11px]">
                    <span className="text-gray-500">Payment Method:</span>
                    <span className="font-bold">{viewingBooking.paymentMethod || 'Online Pay'}</span>
                  </div>
                  {isDepDue && (
                    <div className="p-2 rounded-lg bg-amber-50 border border-amber-200 mt-1 space-y-0.5 font-sans">
                      <div className="flex justify-between text-[10px] font-bold text-amber-900">
                        <span>စရံလွှဲငွေ:</span>
                        <span>{formatPrice(depAmt)}</span>
                      </div>
                      <div className="flex justify-between text-[11px] font-black text-red-600">
                        <span>ကျန်ငွေ (Balance Due):</span>
                        <span>{formatPrice(balAmt)}</span>
                      </div>
                    </div>
                  )}
                </div>

                {isCancelled && viewingBooking.cancelReason && (
                  <div className="p-2.5 rounded-xl bg-red-50 border border-red-200 font-sans text-xs space-y-1">
                    <div className="text-[10px] font-black text-red-700 uppercase">ပယ်ဖျက်ရသည့် အကြောင်းရင်း:</div>
                    <div className="font-bold text-red-900">{viewingBooking.cancelReason}</div>
                  </div>
                )}
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => handleContactCustomerTelegram(viewingBooking)}
                  className="flex-1 py-2.5 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-xl font-black text-xs flex items-center justify-center gap-1.5 transition"
                >
                  <MessageCircle className="w-4 h-4" /> Telegram ပို့မည်
                </button>
                <button
                  type="button"
                  onClick={() => setViewingBooking(null)}
                  className="flex-1 py-2.5 bg-[#123524] text-[#D4AF37] rounded-xl font-black text-xs transition"
                >
                  ပိတ်မည် (Close)
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ==========================================
          MODAL 3: CANCEL ONLINE BOOKING WITH REASON
         ========================================== */}
      {cancellingBooking && (
        <div className="fixed inset-0 z-[260] bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
          <form
            onSubmit={handleConfirmCancelOnlineBooking}
            className="bg-white rounded-2xl max-w-md w-full p-5 shadow-2xl border border-red-200 space-y-4 animate-fade-in"
          >
            <div className="flex justify-between items-start border-b border-gray-100 pb-3">
              <div>
                <h3 className="text-base font-black text-red-600 flex items-center">
                  <AlertCircle className="w-5 h-5 mr-1.5" />
                  Cancel Online Booking (ရက်ချိန်း ပယ်ဖျက်ရန်)
                </h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  Customer: <strong className="text-gray-800">{cancellingBooking.name}</strong> • ပမာဏ:{' '}
                  <strong className="text-[#123524]">{formatPrice(cancellingBooking.totalPrice)}</strong>
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setCancellingBooking(null);
                  setCancelReasonInput('');
                }}
                className="text-gray-400 hover:text-gray-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div>
              <label className="block text-xs font-extrabold text-gray-700 mb-1.5">
                ပယ်ဖျက်ရသည့် အကြောင်းရင်း (Cancel Reason) *
              </label>
              <textarea
                required
                rows={3}
                value={cancelReasonInput}
                onChange={(e) => setCancelReasonInput(e.target.value)}
                placeholder="ဥပမာ - ငွေလွှဲပြေစာ မမှန်ကန်သောကြောင့် / Customer မှ ရက်ချိန်းပြန်ဖျက်သောကြောင့်..."
                className="w-full p-3 bg-gray-50 border border-gray-300 rounded-xl text-xs font-bold text-gray-800 outline-none focus:border-red-500"
              />
              <div className="flex flex-wrap gap-1.5 mt-2">
                {[
                  'Customer မှ ရက်ချိန်းပြန်လည်ပယ်ဖျက်သည်',
                  'ငွေလွှဲ TxID စစ်ဆေး၍ မတွေ့ရှိပါ',
                  'Booking ၂ ခါ ထပ်တင်မိသောကြောင့် (Duplicate)',
                  'ရွေးချယ်ထားသော အချိန်/Therapist မအားလပ်ပါ'
                ].map((preset, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setCancelReasonInput(preset)}
                    className="text-[10px] font-bold bg-gray-100 hover:bg-gray-200 text-gray-700 px-2.5 py-1 rounded-lg transition"
                  >
                    + {preset}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => {
                  setCancellingBooking(null);
                  setCancelReasonInput('');
                }}
                className="flex-1 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl font-bold text-xs transition"
              >
                မလုပ်တော့ပါ
              </button>
              <button
                type="submit"
                disabled={isSubmittingCancel || !cancelReasonInput.trim()}
                className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl font-black text-xs shadow-md transition disabled:opacity-50"
              >
                {isSubmittingCancel ? 'Cancelling...' : '🚫 Confirm Cancel Booking'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* 1. Header & Export */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b border-gray-100 pb-4 gap-4">
        <div>
          <h2 className="text-xl font-bold flex items-center" style={{ color: THEME.primary }}>
            <CalendarPlus className="mr-2 text-[#D4AF37]" /> Online Bookings & Daily Revenue Report
          </h2>
          <p className="text-xs text-gray-500 mt-1">
            ရက်စွဲအလိုက် Online Booking များ၊ တစ်ရက်စာ ရောင်းရငွေချုပ် (Daily Total)၊ ငွေလွှဲစရံ (Deposit) နှင့် ကျန်ငွေများ စစ်ဆေးအတည်ပြုရန်
          </p>
        </div>
        <div className="flex items-center space-x-3 w-full sm:w-auto">
          <button
            onClick={handleExportExcel}
            className="flex-1 sm:flex-none justify-center items-center flex px-4 py-2 bg-green-50 text-green-700 border border-green-200 rounded-lg text-xs font-bold hover:bg-green-100 transition shadow-sm"
          >
            <Download className="w-4 h-4 mr-1.5" /> Export Excel
          </button>
          <span className="bg-yellow-100 text-yellow-800 px-4 py-2 rounded-lg text-xs font-black border border-yellow-200">
            Valid Bookings: {summaryStats.validBookingsCount}
          </span>
        </div>
      </div>

      {/* 2. Executive Financial Summary Cards (4 Cards) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        <div className="p-4 rounded-xl bg-gray-50 border border-gray-200">
          <div className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">
            စုစုပေါင်း Online ရောင်းရငွေ (Net Online Sales)
          </div>
          <div className="text-lg font-black text-[#123524] mt-1">
            {formatPrice(summaryStats.totalOnlineSalesAmt)}
          </div>
        </div>
        <div className="p-4 rounded-xl bg-green-50/60 border border-green-200">
          <div className="text-[10px] font-bold text-green-700 uppercase tracking-wider">
            စုစုပေါင်း လျှော့ပေးငွေ (Total Discounts)
          </div>
          <div className="text-lg font-black text-green-700 mt-1">
            -{formatPrice(summaryStats.totalDiscountAmt)}
          </div>
        </div>
        <div className="p-4 rounded-xl bg-emerald-50/70 border border-emerald-200">
          <div className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider">
            လက်ခံရရှိပြီးငွေ (Collected / Deposit + Full)
          </div>
          <div className="text-lg font-black text-emerald-800 mt-1">
            {formatPrice(summaryStats.totalCollectedAmt)}
          </div>
        </div>
        <div className={`p-4 rounded-xl border ${summaryStats.totalPendingBalanceAmt > 0 ? 'bg-amber-50 border-amber-300' : 'bg-gray-50 border-gray-200'}`}>
          <div className="text-[10px] font-bold text-red-600 uppercase tracking-wider flex items-center justify-between">
            <span>ရရန်ကျန်ငွေ (Pending Balance Due)</span>
            {summaryStats.pendingBalanceCount > 0 && (
              <span className="bg-red-600 text-white text-[9px] px-2 py-0.5 rounded-full font-black">
                {summaryStats.pendingBalanceCount} Bookings
              </span>
            )}
          </div>
          <div className="text-lg font-black text-red-600 mt-1">
            {formatPrice(summaryStats.totalPendingBalanceAmt)}
          </div>
        </div>
      </div>

      {/* 3. Date Filter Bar (All, Today, Yesterday, This Month, Last Month, From -> To) + Status Filter + Search */}
      <div className="flex flex-col gap-3 bg-gray-50/70 p-3.5 rounded-2xl border border-gray-200/80">
        {/* Top Row: Quick Date Pills & From -> To Date Range Picker */}
        <div className="flex flex-wrap items-center justify-between gap-2.5">
          <div className="flex flex-wrap items-center gap-1 bg-white p-1 rounded-xl border border-gray-200 shadow-2xs">
            <button
              type="button"
              onClick={() => setDateFilterMode('all')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                dateFilterMode === 'all' ? 'bg-[#123524] text-[#D4AF37] shadow-xs' : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              ရက်အားလုံး (All)
            </button>
            <button
              type="button"
              onClick={() => setDateFilterMode('today')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                dateFilterMode === 'today' ? 'bg-[#123524] text-[#D4AF37] shadow-xs' : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              ယနေ့ (Today)
            </button>
            <button
              type="button"
              onClick={() => setDateFilterMode('yesterday')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                dateFilterMode === 'yesterday' ? 'bg-[#123524] text-[#D4AF37] shadow-xs' : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              မနေ့က (Yesterday)
            </button>
            <button
              type="button"
              onClick={() => setDateFilterMode('this_month')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                dateFilterMode === 'this_month' ? 'bg-[#123524] text-[#D4AF37] shadow-xs' : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              ယခုလ (This Month)
            </button>
            <button
              type="button"
              onClick={() => setDateFilterMode('last_month')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                dateFilterMode === 'last_month' ? 'bg-[#123524] text-[#D4AF37] shadow-xs' : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              အရင်လ (Last Month)
            </button>
            <button
              type="button"
              onClick={() => setDateFilterMode('upcoming')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                dateFilterMode === 'upcoming' ? 'bg-blue-600 text-white shadow-xs' : 'text-blue-700 hover:bg-blue-50'
              }`}
            >
              ကြိုတင်ရက်ချိန်း (Upcoming)
            </button>
          </div>

          {/* 🌟 From Date ➔ To Date Range Picker 🌟 */}
          <div
            className={`flex flex-wrap items-center gap-2 px-3 py-1.5 rounded-xl border transition shadow-2xs ${
              dateFilterMode === 'custom_range'
                ? 'bg-[#123524] text-[#D4AF37] border-[#D4AF37]'
                : 'bg-white text-gray-700 border-gray-200'
            }`}
          >
            <Calendar className="w-3.5 h-3.5 text-[#D4AF37] flex-shrink-0" />
            <div className="flex items-center gap-1.5 text-xs font-bold">
              <span className={`text-[10px] uppercase ${dateFilterMode === 'custom_range' ? 'text-gray-300' : 'text-gray-400'}`}>
                From:
              </span>
              <input
                type="date"
                value={fromDate}
                onChange={(e) => {
                  const val = e.target.value;
                  setFromDate(val);
                  if (toDate && val > toDate) setToDate(val);
                  setDateFilterMode('custom_range');
                }}
                className={`text-xs font-bold outline-none bg-transparent cursor-pointer ${
                  dateFilterMode === 'custom_range' ? 'text-[#D4AF37]' : 'text-[#123524]'
                }`}
              />
            </div>

            <span className={`text-xs font-black ${dateFilterMode === 'custom_range' ? 'text-[#D4AF37]' : 'text-gray-400'}`}>
              ➔
            </span>

            <div className="flex items-center gap-1.5 text-xs font-bold">
              <span className={`text-[10px] uppercase ${dateFilterMode === 'custom_range' ? 'text-gray-300' : 'text-gray-400'}`}>
                To:
              </span>
              <input
                type="date"
                value={toDate}
                onChange={(e) => {
                  const val = e.target.value;
                  setToDate(val);
                  if (fromDate && val < fromDate) setFromDate(val);
                  setDateFilterMode('custom_range');
                }}
                className={`text-xs font-bold outline-none bg-transparent cursor-pointer ${
                  dateFilterMode === 'custom_range' ? 'text-[#D4AF37]' : 'text-[#123524]'
                }`}
              />
            </div>
          </div>
        </div>

        {/* Bottom Row: Payment & Status Filter Pills + Search */}
        <div className="flex flex-col lg:flex-row justify-between items-stretch lg:items-center gap-2.5 pt-1 border-t border-gray-200/60">
          <div className="flex flex-wrap bg-white p-1 rounded-xl border border-gray-200 shadow-2xs gap-0.5">
            <button
              type="button"
              onClick={() => setFilterPayMode('all')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                filterPayMode === 'all' ? 'bg-[#123524] text-white shadow-xs' : 'text-gray-600'
              }`}
            >
              အားလုံး ({dateAndSearchFiltered.length})
            </button>
            <button
              type="button"
              onClick={() => setFilterPayMode('pending_action')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                filterPayMode === 'pending_action' ? 'bg-yellow-500 text-white shadow-xs' : 'text-yellow-700 hover:bg-yellow-50'
              }`}
            >
              အတည်ပြုရန်ကျန် ({summaryStats.pendingActionCount})
            </button>
            <button
              type="button"
              onClick={() => setFilterPayMode('deposit_only')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                filterPayMode === 'deposit_only' ? 'bg-amber-500 text-white shadow-xs' : 'text-gray-600'
              }`}
            >
              စရံ / ကျန်ငွေရှိ ({summaryStats.pendingBalanceCount})
            </button>
            <button
              type="button"
              onClick={() => setFilterPayMode('paid_in_full')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                filterPayMode === 'paid_in_full' ? 'bg-emerald-700 text-white shadow-xs' : 'text-gray-600'
              }`}
            >
              အပြည့်ချေပြီး ({summaryStats.validBookingsCount - summaryStats.pendingBalanceCount})
            </button>
            <button
              type="button"
              onClick={() => setFilterPayMode('cancelled')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                filterPayMode === 'cancelled' ? 'bg-red-600 text-white shadow-xs' : 'text-red-600 hover:bg-red-50'
              }`}
            >
              ပယ်ဖျက်ထားသော ({summaryStats.cancelledCount})
            </button>
          </div>

          <div className="relative w-full lg:w-72">
            <input
              type="text"
              placeholder="အမည်၊ ဖုန်း သို့မဟုတ် TxID ရှာရန်..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-8 py-2 bg-white border border-gray-200 rounded-xl outline-none focus:border-[#D4AF37] text-xs font-bold shadow-2xs"
            />
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-2.5" />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-2.5 text-gray-400 hover:text-gray-600"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* 4. Date-Grouped Online Bookings Sections */}
      {groupedBookingsByDate.length === 0 ? (
        <div className="p-12 text-center text-gray-400 font-bold border border-dashed border-gray-200 rounded-2xl space-y-2">
          <div>ရွေးချယ်ထားသော ရက်စွဲနှင့် စာရင်းအတွက် Online Booking မှတ်တမ်း မရှိပါ။</div>
          {dateFilterMode !== 'all' && (
            <button
              type="button"
              onClick={() => setDateFilterMode('all')}
              className="text-xs font-black text-[#123524] underline"
            >
              ရက်အားလုံး ပြန်ကြည့်မည် (Show All Dates)
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-6">
          {groupedBookingsByDate.map((group) => (
            <div
              key={group.date}
              className="rounded-2xl border border-gray-200 shadow-xs overflow-hidden bg-white"
            >
              {/* Daily Header Banner */}
              <div className="bg-gradient-to-r from-[#123524] via-[#1a4a32] to-[#123524] px-4 sm:px-5 py-3.5 text-white flex flex-wrap items-center justify-between gap-3 border-b border-[#D4AF37]/40">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-white/10 border border-[#D4AF37]/40 flex items-center justify-center text-[#D4AF37] shadow-inner">
                    <Calendar className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="font-extrabold text-xs sm:text-sm text-[#D4AF37] tracking-wide">
                      {formatReadableDateHeader(group.date)}
                    </div>
                    <div className="flex flex-wrap items-center gap-2 text-[11px] text-gray-200 font-semibold mt-0.5">
                      <span>အတည်ပြု/Valid Booking: <strong>{group.validCount} ခု</strong></span>
                      {group.pendingCount > 0 && (
                        <span className="bg-yellow-500 text-[#123524] px-2 py-0.5 rounded-full text-[10px] font-black animate-pulse">
                          အတည်ပြုရန်ကျန်: {group.pendingCount} ခု
                        </span>
                      )}
                      {group.cancelledCount > 0 && (
                        <span className="bg-red-500/30 border border-red-400/50 text-red-200 px-2 py-0.2 rounded text-[10px] font-bold">
                          ပယ်ဖျက်: {group.cancelledCount} ခု
                        </span>
                      )}
                      <span>•</span>
                      <span>လက်ခံရရှိပြီး: <strong>{formatPrice(group.dailyCollectedAmount)}</strong></span>
                      {group.dailyPendingBalance > 0 && (
                        <span className="bg-red-500 text-white px-2 py-0.5 rounded-full text-[10px] font-black animate-pulse">
                          ကျန်ငွေရရန်: {formatPrice(group.dailyPendingBalance)}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="bg-black/30 px-4 py-2 rounded-xl border border-[#D4AF37]/40 text-right ml-auto">
                  <span className="text-[9px] font-bold text-gray-300 uppercase tracking-wider block">
                    Daily Online Total (တစ်ရက်စာ စုစုပေါင်း)
                  </span>
                  <span className="text-base sm:text-lg font-black text-[#D4AF37]">
                    {formatPrice(group.dailyTotalAmount)}
                  </span>
                </div>
              </div>

              {/* Bookings Table inside Date Group */}
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse min-w-[980px]">
                  <thead>
                    <tr className="border-b border-gray-100 bg-gray-50/70 text-[11px] text-gray-500 uppercase tracking-wider">
                      <th className="p-3">Customer</th>
                      <th className="p-3">Service & Therapist</th>
                      <th className="p-3">Appointment Time</th>
                      <th className="p-3">TxID, Deposit & Total</th>
                      <th className="p-3">Booking Status</th>
                      <th className="p-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {group.bookingsList.map((b) => {
                      const isCancelled = b.status === 'cancelled';
                      const isDepositDue = !isCancelled && (b as any).paymentStatus === 'deposit_only' && Number((b as any).balanceDue) > 0;
                      const isPending = b.status === 'pending' || b.status === 'payment_checking';

                      return (
                        <tr
                          key={b.id}
                          className={`border-b last:border-b-0 transition text-sm ${
                            isCancelled
                              ? 'bg-red-50/35 hover:bg-red-50/60'
                              : isPending
                              ? 'bg-yellow-50/30 hover:bg-yellow-50/60'
                              : isDepositDue
                              ? 'bg-amber-50/30 border-amber-200 hover:bg-amber-50/60'
                              : 'border-gray-50 hover:bg-gray-50'
                          }`}
                        >
                          {/* 1. Customer */}
                          <td className="p-3">
                            <div className={`font-bold text-sm ${isCancelled ? 'line-through text-gray-500' : 'text-gray-800'}`}>
                              {b.name || 'No Name'}
                            </div>
                            <div className="text-xs text-gray-500 font-mono">{b.phone || '-'}</div>
                            {isCancelled ? (
                              <span className="mt-1.5 inline-flex items-center px-2 py-0.5 rounded text-[9px] font-black bg-red-600 text-white uppercase tracking-wider">
                                🚫 Cancelled
                              </span>
                            ) : b.vipTierName ? (
                              <div className="mt-1.5 flex items-center w-fit px-2 py-0.5 rounded text-[9px] font-bold bg-gradient-to-r from-yellow-100 to-yellow-50 text-yellow-800 border border-yellow-300 shadow-2xs">
                                <Crown className="w-3 h-3 mr-1 text-yellow-600" /> {b.vipTierName}
                              </div>
                            ) : b.discountPercent && b.discountPercent > 0 ? (
                              <div className="mt-1.5 flex items-center w-fit px-2 py-0.5 rounded text-[9px] font-bold bg-gradient-to-r from-green-100 to-green-50 text-green-800 border border-green-300 shadow-2xs">
                                <Sparkles className="w-3 h-3 mr-1 text-green-600" /> Promo ({b.discountPercent}% OFF)
                              </div>
                            ) : null}
                          </td>

                          {/* 2. Service & Therapist */}
                          <td className="p-3 max-w-xs">
                            <div className={`font-bold text-sm leading-snug ${isCancelled ? 'line-through text-gray-400' : 'text-gray-800'}`}>
                              {b.service || '-'}
                            </div>
                            <div className="text-xs text-gray-500 mt-1 flex items-center font-semibold">
                              <User className="w-3 h-3 mr-1 text-[#D4AF37]" />
                              {b.therapist || '-'}
                            </div>
                            {b.specialRequest && (
                              <div className="text-xs text-red-500 mt-1 italic">Note: {b.specialRequest}</div>
                            )}
                          </td>

                          {/* 3. Appointment Time & Submitted At */}
                          <td className="p-3 text-sm text-gray-700">
                            <div className="font-semibold text-[#123524]">{b.date || '-'}</div>
                            <div className="text-gray-600 text-xs font-bold mt-0.5 mb-1.5">{b.time || '-'}</div>
                            {b.createdAt && (
                              <div className="text-[9px] font-bold text-gray-400 flex flex-col gap-0.5 border-t border-gray-100 pt-1.5 mt-1 w-max">
                                <span className="uppercase text-[8px] tracking-wider text-blue-400">Submitted At:</span>
                                <span>
                                  {new Date(b.createdAt).toLocaleString('en-US', {
                                    month: 'short',
                                    day: 'numeric',
                                    hour: '2-digit',
                                    minute: '2-digit'
                                  })}
                                </span>
                              </div>
                            )}
                          </td>

                          {/* 4. TxID, Deposit & Total */}
                          <td className="p-3">
                            <div className={`font-mono font-bold text-sm ${isCancelled ? 'line-through text-red-700' : 'text-gray-800'}`}>
                              TxID: {b.txId || '-'}
                            </div>
                            <div className="text-[9px] uppercase tracking-wider font-bold text-gray-500 mt-0.5">
                              {(b.paymentMethod || 'Online Pay').split('(')[0].trim()}
                            </div>

                            {b.originalPrice && b.originalPrice > b.totalPrice ? (
                              <div className={`mt-1.5 p-1.5 rounded-md w-max border ${isCancelled ? 'bg-gray-100 border-gray-200 opacity-60' : 'bg-green-50 border-green-100'}`}>
                                <div className="flex items-center space-x-2 mb-0.5">
                                  <span className="text-[10px] text-gray-400 line-through">{formatPrice(b.originalPrice)}</span>
                                  <span className="text-[9px] font-bold text-red-500 bg-red-100 px-1 py-0.5 rounded">-{b.discountPercent}%</span>
                                </div>
                                <div className={`font-bold text-sm ${isCancelled ? 'line-through text-gray-500' : 'text-[#123524]'}`}>
                                  {formatPrice(b.totalPrice)}
                                </div>
                                {b.discountLabel && (
                                  <div className="text-[8.5px] text-green-700 font-semibold mt-0.5 uppercase tracking-wider">
                                    {b.discountLabel.replace(/ \(\d+\%\)/, '')}
                                  </div>
                                )}
                              </div>
                            ) : (
                              <div>
                                <div className={`mt-1 font-black text-base ${isCancelled ? 'line-through text-gray-400' : 'text-[#123524]'}`}>
                                  {formatPrice(b.totalPrice)}
                                </div>

                                {/* 🌟 အကယ်၍ Campaign မဲပေါက်ထားပြီး Booking တွင် Discount မနှုတ်ရသေးပါက 1-Click ဖြင့် တိုက်ရိုက်နှုတ်ပေးနိုင်သော ခလုတ် 🌟 */}
                                {(() => {
                                  if (isCancelled || (b.discountPercent && b.discountPercent > 0)) return null;
                                  const normBPhone = normalizeMyanmarPhone(b.phone || '');
                                  const submittedDate = b.createdAt
                                    ? (() => {
                                        const dt = new Date(b.createdAt);
                                        return (
                                          dt.getFullYear() +
                                          '-' +
                                          String(dt.getMonth() + 1).padStart(2, '0') +
                                          '-' +
                                          String(dt.getDate()).padStart(2, '0')
                                        );
                                      })()
                                    : b.date;

                                  const matchedWin = campaignWinnersList.find((w) => {
                                    const wPhone = normalizeMyanmarPhone(w.phone || '');
                                    const wDate = String(w.date || '').substring(0, 10);
                                    return wPhone === normBPhone && (wDate === submittedDate || wDate === b.date);
                                  });

                                  if (!matchedWin || !matchedWin.discountPercent) return null;

                                  const usage = isCampaignRewardUsedByCompletedService(
                                    matchedWin.phone,
                                    String(matchedWin.date || '').substring(0, 10),
                                    bookings
                                  );
                                  if (usage.isUsed && usage.completedBooking?.id !== b.id) return null;

                                  const svcStr = String(b.service || '').toLowerCase();
                                  const isOutcall =
                                    svcStr.includes('outcall') ||
                                    svcStr.includes('hotel') ||
                                    svcStr.includes('half day') ||
                                    svcStr.includes('whole');
                                  const applyPct = isOutcall
                                    ? Math.min(10, Number(matchedWin.discountPercent))
                                    : Number(matchedWin.discountPercent);
                                  const newPrice = Math.round((Number(b.totalPrice) || 0) * (1 - applyPct / 100));

                                  return (
                                    <button
                                      type="button"
                                      onClick={async () => {
                                        if (
                                          !window.confirm(
                                            `${b.name} (${b.phone}) သည် Campaign မှ ${matchedWin.discountPercent}% OFF ပေါက်ထားပါသည်။\n\nမူရင်း ${formatPrice(b.totalPrice)} မှ ${applyPct}% လျှော့ပြီး ${formatPrice(newPrice)} သို့ ပြောင်းလဲပေးမည် သေချာပါသလား?`
                                          )
                                        )
                                          return;
                                        const orig = Number(b.totalPrice) || 0;
                                        await updateDoc(doc(db, 'bookings', b.id!), {
                                          originalPrice: encryptText(String(orig)),
                                          discountPercent: encryptText(String(applyPct)),
                                          discountLabel: encryptText(`Campaign Winner Bonus (${applyPct}% OFF)`),
                                          totalPrice: newPrice
                                        });
                                      }}
                                      className="mt-1.5 px-2.5 py-1 rounded-lg bg-orange-500 hover:bg-orange-600 text-white text-[10px] font-black flex items-center gap-1 shadow-xs animate-pulse"
                                    >
                                      <Sparkles className="w-3 h-3" /> 🎁 Apply Campaign {applyPct}% OFF ({formatPrice(newPrice)})
                                    </button>
                                  );
                                })()}
                              </div>
                            )}

                            {/* Deposit vs Full Paid Controls */}
                            {!isCancelled && (
                              isDepositDue ? (
                                <div className="mt-2 p-2 bg-amber-50 border border-amber-300 rounded-lg space-y-1 w-max">
                                  <div className="text-[10px] font-bold text-amber-900">
                                    စရံလွှဲငွေ: {formatPrice(Number((b as any).depositPaid) || 0)}
                                  </div>
                                  <div className="text-[10px] font-black text-red-600">
                                    ကျန်ငွေရရန်: {formatPrice(Number((b as any).balanceDue) || 0)}
                                  </div>
                                  <div className="flex gap-1 pt-1">
                                    <button
                                      type="button"
                                      onClick={async () => {
                                        if (!window.confirm(`ကျန်ငွေ ${formatPrice(Number((b as any).balanceDue))} အပြည့်အဝ လက်ခံရရှိပြီးကြောင်း Approve လုပ်မည်မှာ သေချာပါသလား?`)) return;
                                        const cleanMethod = (b.paymentMethod || '').split('(')[0].trim();
                                        await updateDoc(doc(db, 'bookings', b.id!), {
                                          paymentStatus: 'paid_in_full',
                                          balanceDue: 0,
                                          depositPaid: b.totalPrice,
                                          paymentMethod: `${cleanMethod} (Full Paid - Approved)`
                                        });
                                      }}
                                      className="px-2.5 py-1 bg-amber-500 hover:bg-amber-600 text-white rounded text-[9px] font-black flex items-center shadow-sm transition"
                                    >
                                      <CheckCircle className="w-3 h-3 mr-1" /> ကျန်ငွေ Approve
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setDepositModalBooking(b);
                                        setCustomDepositInput(String((b as any).depositPaid || ''));
                                      }}
                                      className="px-2 py-1 bg-white border border-gray-300 text-gray-600 rounded text-[9px] font-bold hover:bg-gray-100"
                                    >
                                      ပြင်ရန်
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                <div className="mt-2 flex items-center gap-1.5 flex-wrap">
                                  <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-full text-[9px] font-black flex items-center">
                                    <CheckCircle className="w-2.5 h-2.5 mr-1" /> Full Paid
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setDepositModalBooking(b);
                                      setCustomDepositInput(String(Math.round((b.totalPrice || 0) / 2)));
                                    }}
                                    className="text-[9px] font-bold text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200 px-2 py-0.5 rounded transition"
                                  >
                                    စရံသတ်မှတ်ရန်
                                  </button>
                                </div>
                              )
                            )}
                          </td>

                          {/* 5. Booking Status & Points Badge */}
                          <td className="p-3">
                            <select
                              value={b.status}
                              onChange={(e) => handleStatusChange(b, e.target.value)}
                              className={`text-[10px] font-black px-2.5 py-1.5 rounded-lg outline-none border cursor-pointer uppercase tracking-wider ${
                                b.status === 'approved' || b.status === 'completed'
                                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                  : b.status === 'in_progress'
                                  ? 'bg-orange-50 text-orange-700 border-orange-200'
                                  : b.status === 'payment_checking'
                                  ? 'bg-blue-50 text-blue-700 border-blue-200'
                                  : b.status === 'cancelled'
                                  ? 'bg-red-50 text-red-700 border-red-200'
                                  : 'bg-yellow-50 text-yellow-800 border-yellow-300'
                              }`}
                            >
                              <option value="pending">Pending</option>
                              <option value="payment_checking">Confirming</option>
                              <option value="approved">Approved</option>
                              <option value="in_progress">In Room (Active)</option>
                              <option value="completed">Completed</option>
                              <option value="cancelled">Cancelled</option>
                            </select>

                            {isCancelled && b.cancelReason && (
                              <div className="mt-1.5 p-2 rounded-lg bg-red-50 border border-red-200 text-[10px] text-red-800 font-bold max-w-[180px] leading-snug">
                                အကြောင်းရင်း: {b.cancelReason}
                              </div>
                            )}

                            {(b as any).pointsAdded && !isCancelled && (
                              <div className="text-[9px] text-emerald-600 font-black mt-1.5 uppercase flex items-center">
                                <Award className="w-3 h-3 mr-0.5" /> VIP Points Added
                              </div>
                            )}
                          </td>

                          {/* 6. Actions (View Slip, Telegram, Cancel, Delete) */}
                          <td className="p-3 text-right">
                            <div className="flex flex-col sm:flex-row items-end sm:items-center justify-end gap-1.5">
                              <button
                                type="button"
                                onClick={() => setViewingBooking(b)}
                                className="px-2.5 py-1.5 rounded-lg bg-[#123524]/10 hover:bg-[#123524] text-[#123524] hover:text-[#D4AF37] font-black text-[10px] transition flex items-center whitespace-nowrap"
                              >
                                🧾 View Slip
                              </button>

                              <button
                                type="button"
                                onClick={() => handleContactCustomerTelegram(b)}
                                title="Send Confirmation via Telegram"
                                className="p-1.5 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100 border border-blue-200 transition"
                              >
                                <MessageCircle className="w-3.5 h-3.5" />
                              </button>

                              {!isCancelled && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setCancellingBooking(b);
                                    setCancelReasonInput('');
                                  }}
                                  className="px-2.5 py-1.5 rounded-lg bg-red-50 text-red-600 border border-red-200 hover:bg-red-600 hover:text-white font-black text-[10px] transition whitespace-nowrap"
                                >
                                  🚫 Cancel
                                </button>
                              )}

                              {adminRole === 'super_admin' && (
                                <button
                                  type="button"
                                  onClick={() => handleDelete(b.id!)}
                                  title="Permanently Delete Record (Super Admin)"
                                  className="p-1.5 rounded-lg bg-gray-100 text-gray-500 hover:bg-red-100 hover:text-red-600 transition"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function AdminPointManagement({ adminRole, appData }: { adminRole: string, appData: AppData }) {
  const [users, setUsers] = useState<any[]>([]); const [search, setSearch] = useState(''); const [loading, setLoading] = useState(true); const [selectedUser, setSelectedUser] = useState<any>(null);
  const [amount, setAmount] = useState<number | ''>(''); const [invoiceNo, setInvoiceNo] = useState(''); const [processing, setProcessing] = useState(false);
  const [history, setHistory] = useState<any[]>([]); const [historySearch, setHistorySearch] = useState('');
  const [selectedUserMonthlyPoints, setSelectedUserMonthlyPoints] = useState(0); const [selectedUserUsedRewards, setSelectedUserUsedRewards] = useState<string[]>([]); const [userBookings, setUserBookings] = useState<any[]>([]);

  const fetchUsers = async () => {
    try {
      const snap = await getDocs(collection(db, 'users')); const data: any[] = [];
      snap.forEach(doc => { const raw = doc.data(); data.push({ docId: doc.id, ...raw, phone: decryptText(raw.phone) || doc.id, name: decryptText(raw.name) || raw.name, points: parseInt(decryptText(raw.points as string) || (raw.points as string) || '0', 10) }); });
      data.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)); setUsers(data);
    } catch (e) { console.error(e); } setLoading(false);
  };
  useEffect(() => { fetchUsers(); }, []);

  useEffect(() => {
      const fetchPointsAndBookings = async () => {
          // 🌟 Real-time onSnapshot အစား getDocs ဖြင့် တစ်ကြိမ်တည်းသာ ဆွဲယူပြီး Limit သက်သာစေပါမည်
          const snap = await getDocs(query(collection(db, 'point_history'), orderBy('createdAt', 'desc')));
          const data: any[] = [];
          snap.forEach(doc => { const raw = doc.data(); data.push({ id: doc.id, phone: decryptText(raw.phone) || raw.phone, amount: Number(decryptText(raw.amount) || raw.amount), pointsEarned: Number(decryptText(raw.pointsEarned) || raw.pointsEarned), invoiceNo: raw.invoiceNo ? decryptText(raw.invoiceNo) : '-', type: decryptText(raw.type) || raw.type, date: raw.date, createdAt: raw.createdAt }); });
          setHistory(data);

          const snapB = await getDocs(collection(db, 'bookings'));
          const dataB: any[] = [];
          snapB.forEach(d => { const raw = d.data(); dataB.push({ phone: decryptText(raw.phone) || raw.phone, status: raw.status, date: raw.date, discountLabel: raw.discountLabel ? decryptText(raw.discountLabel) : undefined }); });
          setUserBookings(dataB);
      };
      fetchPointsAndBookings();
  }, []);

  useEffect(() => {
      if (!selectedUser) return; const currentMonthPrefix = getLocalTodayStr().substring(0, 7);
      const mPts = history.filter(h => h.phone === selectedUser.phone && h.date && h.date.startsWith(currentMonthPrefix)).reduce((sum, h) => sum + h.pointsEarned, 0);
      setSelectedUserMonthlyPoints(mPts);
      const used: string[] = [];
      userBookings.filter(b => b.phone === selectedUser.phone && b.date && b.date.startsWith(currentMonthPrefix) && b.status !== 'cancelled').forEach(b => { if (b.discountLabel && b.discountLabel.includes('Target Bonus')) { used.push(b.discountLabel); } });
      setSelectedUserUsedRewards(used);
  }, [selectedUser, history, userBookings]);

  const filteredUsers = users.filter(u => u.phone.includes(search) || (u.name && u.name.toLowerCase().includes(search.toLowerCase())));
  const filteredHistory = history.filter(h => h.phone.includes(historySearch) || h.invoiceNo.toLowerCase().includes(historySearch.toLowerCase()));
  const earnedPoints = Math.floor(Number(amount) / 35000) || 0;

  const handleAddPoints = async (e: React.FormEvent) => {
     e.preventDefault(); if (!selectedUser) return; if (earnedPoints <= 0) return alert('သုံးစွဲငွေသည် အနည်းဆုံး ၃၅,၀၀၀ ကျပ် ရှိရပါမည်။'); if (!invoiceNo.trim()) return alert('Invoice Number ထည့်ပေးပါ။');
     if (!window.confirm(`${selectedUser.name || selectedUser.phone} သို့ ${earnedPoints} Points ထည့်သွင်းမည် သေချာပါသလား?`)) return;
     setProcessing(true);
     try {
         const newTotal = (selectedUser.points || 0) + earnedPoints;
         const batch = writeBatch(db); // 🌟 Batch Write အသုံးပြုခြင်း
         
         const userRef = doc(db, 'users', selectedUser.docId);
         batch.update(userRef, { points: encryptText(newTotal.toString()) });
         
         const historyRef = doc(collection(db, 'point_history'));
         batch.set(historyRef, { 
             phone: encryptText(selectedUser.phone), amount: encryptText(amount.toString()), 
             pointsEarned: encryptText(earnedPoints.toString()), invoiceNo: encryptText(invoiceNo), 
             type: encryptText('Walk-in / Direct'), date: getLocalTodayStr(), createdAt: Date.now() 
         });

         await batch.commit(); // တပြိုင်နက်တည်း သိမ်းမည်

         alert(`✅ ${earnedPoints} Points အောင်မြင်စွာ ထည့်သွင်းပြီးပါပြီ။ (စုစုပေါင်း - ${newTotal} Pts)`);
         await fetchUsers(); const updatedUser = users.find(u => u.docId === selectedUser.docId); if (updatedUser) setSelectedUser({ ...updatedUser, points: newTotal });
         setAmount(''); setInvoiceNo('');
     } catch(e) { alert('Error adding points.'); } setProcessing(false);
  };

  const handleDeleteHistory = async (hId: string, phone: string, pointsEarned: string | number) => {
      if (adminRole !== 'super_admin') { alert('Super Admin သာလျှင် ဖျက်ခွင့်ရှိပါသည်။'); return; }
      if (!window.confirm(`ဤမှတ်တမ်းကိုဖျက်၍ Customer ထံမှ ${pointsEarned} Points ကို ပြန်နှုတ်မည် သေချာပါသလား?`)) return;
      try {
          const batch = writeBatch(db); // 🌟 Batch Write အသုံးပြုခြင်း
          let targetDocId = null;
          let currentPts = 0;
          
          const targetUser = users.find(u => u.phone === phone); 
          if (targetUser) {
              targetDocId = targetUser.docId;
              currentPts = targetUser.points || 0;
          } else {
              const snap = await getDocs(collection(db, 'users'));
              snap.forEach(d => { 
                  const uData = d.data(); const decPhone = decryptText(uData.phone) || d.id; 
                  if (decPhone === phone) { targetDocId = d.id; currentPts = parseInt(decryptText(uData.points as string) || (uData.points as string) || '0', 10); } 
              });
          }

          if (targetDocId) {
              const newTotal = Math.max(0, currentPts - (Number(pointsEarned) || 0));
              batch.update(doc(db, 'users', targetDocId), { points: encryptText(newTotal.toString()) });
          }
          
          batch.delete(doc(db, 'point_history', hId));
          await batch.commit(); // ပြန်နှုတ်တာရော မှတ်တမ်းဖျက်တာရော တပြိုင်နက်တည်း လုပ်မည်

          alert(`✅ မှတ်တမ်းကို ဖျက်ပြီး Customer ထံမှ ${pointsEarned} Points ပြန်နှုတ်လိုက်ပါပြီ။`);
          await fetchUsers(); if (selectedUser && selectedUser.phone === phone) { setSelectedUser({ ...selectedUser, points: Math.max(0, currentPts - (Number(pointsEarned) || 0)) }); }
      } catch (e) { alert('Error deleting record.'); }
  };

  const handleExportHistory = () => {
      const headers = ['Record ID', 'Date & Time', 'Customer Phone', 'Invoice / TxID', 'Amount (Ks)', 'Points Added', 'Source'];
      const rows = filteredHistory.map(h => [ h.id || '', `"${new Date(h.createdAt).toLocaleString()}"`, `"${h.phone}"`, `"${h.invoiceNo}"`, h.amount || 0, h.pointsEarned || 0, `"${h.type}"` ]);
      const csvContent = '\uFEFF' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' }); const link = document.createElement('a'); const url = URL.createObjectURL(blob);
      link.setAttribute('href', url); link.setAttribute('download', `Point_History_Report_${getLocalTodayStr()}.csv`); link.style.visibility = 'hidden';
      document.body.appendChild(link); link.click(); document.body.removeChild(link);
  };

  const handleRedeemReward = async (tier: number) => {
      if (!selectedUser) return; if (!window.confirm(`ဤ Customer အတွက် ${tier}% Target Reward ကို အသုံးပြုပြီးဖြစ်ကြောင်း သတ်မှတ်မည် သေချာပါသလား?`)) return;
      const rewardLabel = `Pre-Jade Target Bonus (${tier}%)`;
      try {
          await addDoc(collection(db, 'bookings'), { phone: encryptText(selectedUser.phone), name: encryptText(selectedUser.name || 'Unknown'), service: `Walk-in Reward Redemption (${tier}%)`, therapist: '-', date: getLocalTodayStr(), time: 'Walk-in', status: 'completed', discountLabel: encryptText(rewardLabel), totalPrice: 0, createdAt: Date.now() });
          alert('Reward အသုံးပြုပြီးကြောင်း မှတ်တမ်းတင်ပြီးပါပြီ။'); setSelectedUserUsedRewards([...selectedUserUsedRewards, rewardLabel]);
      } catch(e) { alert('Error updating reward status.'); }
  };

  const getTier = (points: number) => { if(!appData.vipSettings?.isActive || !appData.vipSettings?.tiers) return null; const sortedTiers = [...appData.vipSettings.tiers].sort((a,b) => b.requiredPoints - a.requiredPoints); return sortedTiers.find(t => points >= t.requiredPoints); };
  const userTier = selectedUser ? getTier(selectedUser.points || 0) : null;

  return (
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 border-b border-gray-100 pb-4 gap-4">
              <div><h2 className="text-xl font-bold flex items-center" style={{ color: THEME.primary }}><Star className="mr-2 text-yellow-500" /> Point Management</h2><p className="text-xs text-gray-500 mt-1">ဆိုင်တွင် တိုက်ရိုက် Service ယူသူများအတွက် Invoice ပမာဏ ထည့်သွင်း၍ Point ပေါင်းရန်</p></div>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <div className="flex flex-col border-r-0 lg:border-r border-gray-100 lg:pr-8">
                  <div className="relative mb-4"><input type="text" placeholder="Search customer by name or phone..." value={search} onChange={(e) => setSearch(e.target.value)} className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-lg outline-none focus:border-[#D4AF37] text-sm font-semibold" /><Search className="w-4 h-4 text-gray-400 absolute left-4 top-3.5" /></div>
                  <div className="flex-1 overflow-y-auto max-h-[500px] border border-gray-100 rounded-lg bg-gray-50/50 p-2 space-y-2 scrollbar-hide">
                      {loading ? (<div className="text-center p-4 text-xs font-bold text-gray-400">Loading...</div>) : filteredUsers.length === 0 ? (<div className="text-center p-4 text-xs font-bold text-gray-400">No users found.</div>) : (
                          filteredUsers.map(u => (
                              <div key={u.docId} onClick={() => setSelectedUser(u)} className={`p-3 rounded-lg border cursor-pointer transition-all flex justify-between items-center ${selectedUser?.docId === u.docId ? 'bg-yellow-50 border-yellow-300 shadow-sm' : 'bg-white border-gray-200 hover:border-[#D4AF37]/50'}`}>
                                  <div><div className="font-bold text-sm text-[#123524]">{u.name || 'Unknown Name'}</div><div className="text-xs font-mono text-gray-500 mt-0.5">{u.phone}</div></div>
                                  <div className="text-right"><div className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Current Pts</div><div className="font-black text-lg text-yellow-600">{u.points || 0}</div></div>
                              </div>
                          ))
                      )}
                  </div>
              </div>
              <div className="flex flex-col">
                  {selectedUser ? (
                      <div className="animate-fade-in flex flex-col h-full overflow-y-auto pr-2 scrollbar-hide">
                          <div className="bg-[#123524] rounded-xl p-5 mb-6 text-white shadow-md relative overflow-hidden flex-shrink-0">
                              <div className="absolute top-0 right-0 w-32 h-32 bg-white opacity-5 rounded-full -mr-10 -mt-10 blur-xl"></div>
                              <h4 className="text-xs text-[#D4AF37] font-bold uppercase tracking-widest mb-1">Selected Customer</h4>
                              <div className="font-bold text-xl mb-1 flex items-center">{selectedUser.name || 'Unknown'}</div>
                              <div className="text-sm text-gray-300 font-mono mb-4">{selectedUser.phone}</div>
                              <div className="flex flex-col gap-2">
                                  {userTier && (
                                      <div className="flex items-center w-fit px-2.5 py-1 rounded font-bold text-[10px] shadow-sm text-white" style={{ backgroundColor: userTier.colorTheme }}><Crown className="w-3 h-3 mr-1.5" /> {userTier.name}</div>
                                  )}
                                  <div className="flex items-center space-x-2 bg-black/20 p-2.5 rounded-lg w-fit border border-white/10"><Award className="w-4 h-4 text-[#D4AF37]"/><span className="text-sm font-semibold">Total Accumulated: <span className="font-bold text-[#D4AF37] text-lg">{selectedUser.points || 0} Pts</span></span></div>
                              </div>
                          </div>
                          <form onSubmit={handleAddPoints} className="mb-6 flex-shrink-0">
                              <div className="mb-4"><label className="block text-xs font-bold text-gray-500 mb-2 uppercase tracking-wider">Enter Invoice Amount (MMK)</label><div className="relative"><input type="number" required value={amount} onChange={(e) => setAmount(Number(e.target.value) || '')} placeholder="e.g. 70000" className="w-full pl-6 pr-16 py-4 border-2 border-gray-200 rounded-xl outline-none focus:border-[#D4AF37] text-xl font-black text-[#123524]" /><span className="absolute right-6 top-4 font-bold text-gray-400">Ks</span></div></div>
                              <div className="mb-6"><label className="block text-xs font-bold text-gray-500 mb-2 uppercase tracking-wider">Invoice Number</label><div className="relative"><input type="text" required value={invoiceNo} onChange={(e) => setInvoiceNo(e.target.value)} placeholder="e.g. INV-20260830-01" className="w-full pl-6 pr-4 py-4 border-2 border-gray-200 rounded-xl outline-none focus:border-[#D4AF37] text-sm font-bold text-[#123524]" /></div></div>
                              <div className="bg-green-50 border border-green-200 rounded-xl p-6 text-center mb-6"><p className="text-xs font-bold text-green-700 uppercase tracking-widest mb-2">Points to be Added</p><div className="text-4xl font-black text-green-600 mb-2">+{earnedPoints}</div><p className="text-[10px] text-green-600/80 font-semibold">(စနစ်မှ သတ်မှတ်ထားသော ၃၅,၀၀၀ ကျပ် = ၁ ပွိုင့် နှုန်းဖြင့် တွက်ချက်ထားပါသည်)</p></div>
                              <button type="submit" disabled={processing || earnedPoints <= 0} className="w-full py-4 bg-[#D4AF37] text-white rounded-xl font-bold text-base shadow-md hover:bg-yellow-600 transition disabled:opacity-50 flex justify-center items-center">{processing ? 'Processing...' : 'CONFIRM & ADD POINTS'}</button>
                          </form>
                          {!userTier && (
                              <div className="bg-gray-50 p-4 rounded-xl border border-gray-200 mt-2 flex-shrink-0">
                                  <h4 className="font-bold text-sm text-[#123524] mb-3 flex items-center"><Gift className="w-4 h-4 mr-2 text-green-600"/> Monthly Target Rewards (Pre-Jade)</h4>
                                  <div className="text-xs text-gray-500 mb-4 bg-white p-2.5 rounded-lg border border-gray-100 shadow-sm">ယခုလအတွင်း စုဆောင်းထားသောပွိုင့်: <strong className="text-green-600 text-sm ml-1">{selectedUserMonthlyPoints} Pts</strong></div>
                                  <div className="space-y-2">
                                      {[10, 20, 30, 40, 50].map(tier => {
                                          const isUnlocked = selectedUserMonthlyPoints >= tier; const rewardLabel = `Pre-Jade Target Bonus (${tier}%)`; const isUsed = selectedUserUsedRewards.includes(rewardLabel);
                                          return (
                                              <div key={tier} className="flex justify-between items-center p-3 rounded-lg border border-gray-200 bg-white shadow-sm">
                                                  <span className="text-xs font-bold text-gray-700">{tier} Pts = {tier}% OFF</span>
                                                  {!isUnlocked ? (<span className="text-[10px] text-gray-400 font-semibold bg-gray-100 px-3 py-1.5 rounded">Locked</span>) : isUsed ? (<span className="text-[10px] text-gray-500 font-bold bg-gray-100 px-3 py-1.5 rounded flex items-center"><CheckCircle className="w-3.5 h-3.5 mr-1.5"/> Used</span>) : (<button type="button" onClick={() => handleRedeemReward(tier)} className="text-[10px] font-bold bg-green-50 text-green-700 hover:bg-green-100 px-4 py-1.5 rounded shadow-sm border border-green-200 transition whitespace-nowrap">Mark as Used</button>)}
                                              </div>
                                          )
                                      })}
                                  </div>
                              </div>
                          )}
                      </div>
                  ) : (<div className="flex-1 border-2 border-dashed border-gray-200 rounded-xl flex flex-col items-center justify-center p-10 text-gray-400 bg-gray-50/50"><UserCircle className="w-16 h-16 mb-4 opacity-30" /><p className="text-sm font-bold">Please select a customer from the list first</p></div>)}
              </div>
          </div>
          {adminRole === 'super_admin' && (
              <div className="mt-8 pt-6 border-t border-gray-100 animate-fade-in">
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 gap-4">
                      <h3 className="text-lg font-bold text-gray-800 flex items-center"><History className="w-5 h-5 mr-2 text-[#D4AF37]" /> Points History Record</h3>
                      <div className="flex items-center space-x-3 w-full sm:w-auto"><div className="relative w-full sm:w-64"><input type="text" placeholder="Search phone or invoice..." value={historySearch} onChange={(e) => setHistorySearch(e.target.value)} className="w-full pl-9 pr-3 py-2 bg-gray-50 border border-gray-200 rounded-lg outline-none focus:border-[#D4AF37] text-xs font-semibold" /><Search className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-2.5" /></div><button onClick={handleExportHistory} className="flex-shrink-0 justify-center items-center flex px-3 py-2 bg-green-50 text-green-700 border border-green-200 rounded-lg text-xs font-bold hover:bg-green-100 transition shadow-sm"><Download className="w-4 h-4 mr-1.5" /> Export</button></div>
                  </div>
                  <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse min-w-[800px]">
                          <thead><tr className="border-b-2 border-gray-100 text-xs text-gray-500 uppercase tracking-wider"><th className="p-3 pb-4">Date & Time</th><th className="p-3 pb-4">Customer Phone</th><th className="p-3 pb-4">Invoice / TxID</th><th className="p-3 pb-4">Amount</th><th className="p-3 pb-4">Points Added</th><th className="p-3 pb-4">Source</th><th className="p-3 pb-4 text-right">Action</th></tr></thead>
                          <tbody>
                              {filteredHistory.length === 0 && <tr><td colSpan={7} className="p-10 text-center text-gray-400">No point history found.</td></tr>}
                              {filteredHistory.map((h) => (
                                  <tr key={h.id} className="border-b border-gray-50 hover:bg-gray-50 transition text-sm">
                                      <td className="p-3 text-gray-600">{new Date(h.createdAt).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short'})}</td><td className="p-3 font-bold text-gray-800 font-mono tracking-wider">{h.phone}</td><td className="p-3 font-mono font-semibold text-gray-700">{h.invoiceNo}</td><td className="p-3 font-semibold text-[#123524]">{formatPrice(h.amount)}</td><td className="p-3 font-black text-green-600">+{h.pointsEarned} Pts</td><td className="p-3"><span className={`text-[10px] px-2 py-1 rounded font-bold uppercase tracking-wider ${h.type.includes('Online') ? 'bg-blue-50 text-blue-600' : 'bg-green-50 text-green-600'}`}>{h.type}</span></td>
                                      <td className="p-3 text-right"><button onClick={() => handleDeleteHistory(h.id, h.phone, h.pointsEarned)} className="p-1.5 bg-red-50 text-red-600 rounded hover:bg-red-100 transition inline-flex" title="Delete & Deduct"><Trash2 className="w-4 h-4"/></button></td>
                                  </tr>
                              ))}
                          </tbody>
                      </table>
                  </div>
              </div>
          )}
      </div>
  );
}

function AdminStaffHistoryList({ bookings, allBookings, adminRole, therapists }: { bookings: Booking[], allBookings?: Booking[], adminRole: string, therapists: TherapistProfile[] }) {
  const [view, setView] = useState<'dashboard' | 'service' | 'outpass' | 'performance'>('dashboard');
  const [outpasses, setOutpasses] = useState<OutPass[]>([]);
  const [serviceDateFilter, setServiceDateFilter] = useState<'today' | 'yesterday' | 'custom' | 'all'>('today');
  const [customFilterDate, setCustomFilterDate] = useState<string>(getLocalTodayStr());
  const [historySearch, setHistorySearch] = useState<string>('');
  const [outpassDateFilter, setOutpassDateFilter] = useState<'today' | 'all'>('today');
  const todayStr = getLocalTodayStr();
  const [now, setNow] = useState(Date.now());

  // 🌟 Admin Clock-In Modal States 🌟
  const [showClockInModal, setShowClockInModal] = useState(false);
  const { appData: globalAppData } = useAppStore();

  const getYesterdayStr = () => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  };

  // 🌟 ၁ စက္ကန့်တစ်ကြိမ် Live Countdown နှင့် Auto Clock-Out စစ်ဆေးရန် 🌟
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const unsub = onSnapshot(query(collection(db, 'outpasses'), orderBy('outTimeMillis', 'desc')), (snap) => {
      const arr: OutPass[] = [];
      snap.forEach((d) => arr.push({ id: d.id, ...d.data() } as OutPass));
      setOutpasses(arr);
    });
    return () => unsub();
  }, []);

  // ============================================================================
  // 🌟 TIME & DURATION FORMATTING HELPERS (AM/PM, နာရီ၊ မိနစ် အတိအကျ) 🌟
  // ============================================================================
  const formatTimeAMPM = (millis: number | undefined): string => {
    if (!millis || isNaN(millis)) return '-';
    return new Date(millis).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  };

  const formatMinsToHrMinBurmese = (totalMins: number): string => {
    const mins = Math.max(0, Math.round(totalMins));
    if (mins >= 60) {
      const h = Math.floor(mins / 60);
      const m = mins % 60;
      return m > 0 ? `${h} နာရီ ${m} မိနစ်` : `${h} နာရီ`;
    }
    return `${mins} မိနစ်`;
  };

  const formatSecondsClock = (totalSeconds: number | undefined): string => {
    if (totalSeconds === undefined || isNaN(totalSeconds)) return '00:00';
    const absSecs = Math.max(0, Math.floor(Math.abs(totalSeconds)));
    const h = Math.floor(absSecs / 3600);
    const m = Math.floor((absSecs % 3600) / 60);
    const s = absSecs % 60;
    if (h > 0) {
      return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    }
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  const formatSecondsToBurmeseWords = (totalSeconds: number | undefined): string => {
    if (!totalSeconds || isNaN(totalSeconds) || totalSeconds <= 0) return '0 မိနစ်';
    const absSecs = Math.max(0, Math.floor(Math.abs(totalSeconds)));
    const h = Math.floor(absSecs / 3600);
    const m = Math.floor((absSecs % 3600) / 60);
    const s = absSecs % 60;

    if (h > 0) {
      return `${h} နာရီ ${m} မိနစ် ${s > 0 ? `${s} စက္ကန့်` : ''}`.trim();
    }
    if (m > 0) {
      return `${m} မိနစ် ${s > 0 ? `${s} စက္ကန့်` : ''}`.trim();
    }
    return `${s} စက္ကန့်`;
  };

  const formatBadgeTimerText = (totalSeconds: number, isOvertime: boolean): string => {
    const absSecs = Math.max(0, Math.floor(Math.abs(totalSeconds)));
    const h = Math.floor(absSecs / 3600);
    const m = Math.floor((absSecs % 3600) / 60);
    const s = absSecs % 60;

    if (h > 0) {
      return isOvertime
        ? `အချိန်ပို: +${h} နာရီ ${m} မိနစ်`
        : `⏳ ${h} နာရီ ${m} မိနစ် ကျန်`;
    }
    const mmss = `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    return isOvertime ? `အချိန်ပို: +${mmss} မိနစ်` : `⏳ ${mmss} မိနစ် ကျန်`;
  };

  // 🌟 Helper 1: Admin Clock-In သီးသန့် ဟုတ်/မဟုတ် စစ်ဆေးသည့် Function 🌟
  const isStrictlyAdminClockIn = useCallback((b: any): boolean => {
    if (!b) return false;
    const rawTx = String(b.txId || '').trim().toUpperCase();
    const rawPay = String(b.paymentMethod || '').toLowerCase();
    const rawDisc = String(b.discountLabel || '').toLowerCase();

    if (
      rawTx.startsWith('SL-') ||
      rawTx.startsWith('OB-') ||
      rawPay.includes('shop pos') ||
      rawDisc.includes('[shop walk-in') ||
      Boolean(b.posLocalId)
    ) {
      return false;
    }

    return (
      Boolean(b.isAdminClockIn) ||
      Boolean(b.isStaffClockIn) ||
      rawTx === 'ADMIN' ||
      rawTx === 'CASH' ||
      rawPay.includes('admin') ||
      rawPay.includes('cash payment in shop') ||
      String(b.name || '').toLowerCase().includes('admin manual')
    );
  }, []);

  // 🌟 Helper 2: Service တစ်ခုချင်းစီ၏ မိနစ်ကို တွက်ချက်ပေးသည့် Parser (Towel & Add-ons = 0 Mins) 🌟
  const parseSingleServiceMins = useCallback((text: string): number => {
    const clean = String(text || '').toLowerCase().trim();
    if (!clean) return 0;

    // 1. ပင်မ ဝန်ဆောင်မှု (Massage, Scrub, Wax, Outcall) ဟုတ်/မဟုတ် စစ်ဆေးခြင်း
    const hasCoreServiceKeyword =
      clean.includes('massage') ||
      clean.includes('scrub') ||
      clean.includes('wax') ||
      clean.includes('outcall') ||
      clean.includes('half day') ||
      clean.includes('whole night') ||
      clean.includes('whole day') ||
      clean.includes('full day');

    // 2. ပင်မဝန်ဆောင်မှု မဟုတ်ဘဲ Towel, Underwear, Bottle, VVIP Upgrade စသည့် Add-on ပစ္စည်းဖြစ်ပါက 0 မိနစ် ပြန်ပေးမည်
    if (
      !hasCoreServiceKeyword &&
      (clean.includes('towel') ||
        clean.includes('sterilized') ||
        clean.includes('single-use') ||
        clean.includes('underwear') ||
        clean.includes('disposable') ||
        clean.includes('oil (bottle)') ||
        clean.includes('bottle') ||
        clean.includes('carebeau') ||
        clean.includes('drink') ||
        clean.includes('coffee') ||
        clean.includes('water') ||
        clean.includes('tip') ||
        clean.includes('vvip room') ||
        clean === 'vvip' ||
        clean === 'vip')
    ) {
      return 0;
    }

    // 3. မိနစ် / နာရီ အတိအကျ ပါဝင်ပါက ဖမ်းယူမည်
    const minsMatch = clean.match(/(\d+)\s*(?:mins|min|မိနစ်)/i);
    if (minsMatch) return parseInt(minsMatch[1], 10);

    const hrsMatch = clean.match(/(\d+(?:\.\d+)?)\s*(?:hours|hour|hrs|hr|နာရီ)/i);
    if (hrsMatch) return Math.round(parseFloat(hrsMatch[1]) * 60);

    // 4. Package အမည်များ စစ်ဆေးခြင်း
    if (clean.includes('whole night') || clean.includes('whole day') || clean.includes('full day')) return 720; // 12 Hrs
    if (clean.includes('half day')) return 360; // 6 Hrs
    if (clean.includes('part time outcall')) return 100; // 100 Mins
    if (clean.includes('body scrub') && clean.includes('lotion')) return 120; // 120 Mins
    if (clean.includes('body scrub')) return 60; // 60 Mins
    if (clean.includes('wax')) return 60; // 60 Mins

    // 5. Menu Category ထဲမှ တိုက်ဆိုင်စစ်ဆေးခြင်း
    if (globalAppData?.categories) {
      for (const cat of globalAppData.categories) {
        for (const item of cat.items || []) {
          const itemName = String(item.name || '').toLowerCase();
          if (itemName && clean.includes(itemName) && item.duration) {
            const dStr = String(item.duration).toLowerCase();
            const m = dStr.match(/(\d+)\s*(?:mins|min)/i);
            if (m) return parseInt(m[1], 10);
            const h = dStr.match(/(\d+(?:\.\d+)?)\s*(?:hours|hour|hrs|hr)/i);
            if (h) return Math.round(parseFloat(h[1]) * 60);
          }
        }
      }
    }

    return 60;
  }, [globalAppData]);

  // 🌟 Helper 3: POS Multi-Item နှင့် Comma-Separated Services အားလုံးအတွက် စုစုပေါင်း မိနစ်အမှန် တွက်ချက်ခြင်း 🌟
  const parseServiceDurationMins = useCallback((bOrText: any): number => {
    if (typeof bOrText === 'string') {
      const parts = bOrText.split(',').map((s) => s.trim()).filter(Boolean);
      if (parts.length <= 1) return parseSingleServiceMins(bOrText) || 60;
      let sum = 0;
      parts.forEach((p) => {
        const qtyMatch = p.match(/\(x(\d+)\)$/i) || p.match(/\s+x(\d+)$/i);
        const qty = qtyMatch ? parseInt(qtyMatch[1], 10) || 1 : 1;
        sum += parseSingleServiceMins(p) * qty;
      });
      return sum > 0 ? sum : 60;
    }

    const session = bOrText;
    if (Array.isArray(session?.posItems) && session.posItems.length > 0) {
      let sumMins = 0;
      session.posItems.forEach((item: any) => {
        const itemMins = parseSingleServiceMins(`${item.name || ''} ${item.duration || ''}`);
        if (itemMins > 0) sumMins += itemMins * (Number(item.qty) || 1);
      });
      if (sumMins > 0) return sumMins;
    }

    const serviceStr = String(session?.service || '');
    const parts = serviceStr.split(',').map((s) => s.trim()).filter(Boolean);
    let totalCalc = 0;
    for (const part of parts) {
      const qtyMatch = part.match(/\(x(\d+)\)$/i) || part.match(/\s+x(\d+)$/i);
      const qty = qtyMatch ? parseInt(qtyMatch[1], 10) || 1 : 1;
      totalCalc += parseSingleServiceMins(part) * qty;
    }
    if (totalCalc > 0) return totalCalc;

    if (session?.startTimeMillis && session?.expectedEndTimeMillis && session.expectedEndTimeMillis > session.startTimeMillis) {
      const diffMins = Math.round((session.expectedEndTimeMillis - session.startTimeMillis) / 60000);
      if (diffMins > 0 && diffMins <= 1440) return diffMins;
    }

    return 60;
  }, [parseSingleServiceMins]);

  const parseDateAndTimeStrToMillis = (dateStr?: string, timeStr?: string, fallbackMs?: number): number => {
    try {
      if (!dateStr || !timeStr) return fallbackMs || Date.now();
      const [y, m, d] = dateStr.split('-').map(Number);
      if (!y || !m || !d) return fallbackMs || Date.now();
      const match = timeStr.trim().toUpperCase().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i);
      if (!match) return fallbackMs || Date.now();
      let hours = parseInt(match[1], 10);
      const mins = parseInt(match[2], 10);
      const period = match[3];
      if (period === 'PM' && hours < 12) hours += 12;
      if (period === 'AM' && hours === 12) hours = 0;
      return new Date(y, m - 1, d, hours, mins, 0, 0).getTime();
    } catch {
      return fallbackMs || Date.now();
    }
  };

  // 🌟 Helper 4: Booking တစ်ခု၏ Start Time နှင့် Expected End Time အမှန်ကို တွက်ချက်ပေးခြင်း 🌟
  const getAccurateSessionTimes = useCallback((b: any) => {
    const durationMins = parseServiceDurationMins(b);
    const startMs =
      Number(b?.startTimeMillis) ||
      parseDateAndTimeStrToMillis(b?.date, b?.time, Number(b?.createdAt)) ||
      Date.now();
    const expectedEndMs = startMs + durationMins * 60 * 1000;
    return { startMs, expectedEndMs, durationMins };
  }, [parseServiceDurationMins]);

  // 🌟 AUTO CLEANUP OLD DAYS & AUTO CLOCK-OUT FOR ADMIN CLOCK-IN ONLY 🌟
  useEffect(() => {
    const currentNow = Date.now();
    const currentToday = getLocalTodayStr();

    bookings.forEach((b: any) => {
      if (b.status !== 'in_progress' || !b.id) return;

      const { startMs, expectedEndMs } = getAccurateSessionTimes(b);

      if (b.date !== currentToday) {
        updateDoc(doc(db, 'bookings', b.id), {
          status: 'completed',
          startTimeMillis: startMs,
          expectedEndTimeMillis: expectedEndMs,
          actualEndTimeMillis: expectedEndMs,
          overtimeSeconds: 0
        }).catch(() => {});
        return;
      }

      if (isStrictlyAdminClockIn(b) && currentNow >= expectedEndMs) {
        updateDoc(doc(db, 'bookings', b.id), {
          status: 'completed',
          startTimeMillis: startMs,
          expectedEndTimeMillis: expectedEndMs,
          actualEndTimeMillis: expectedEndMs,
          overtimeSeconds: 0
        }).catch(() => {});
      }
    });
  }, [bookings, now, getAccurateSessionTimes, isStrictlyAdminClockIn]);

  const handleDeleteBooking = async (id: string) => {
    if (adminRole !== 'super_admin') {
      alert('Super Admin သာလျှင် ဖျက်ခွင့်ရှိပါသည်။');
      return;
    }
    if (window.confirm('ဤဝန်ဆောင်မှုမှတ်တမ်းကို အပြီးတိုင် ဖျက်မည်မှာ သေချာပါသလား?')) {
      await deleteDoc(doc(db, 'bookings', id));
    }
  };

  const handleDeleteOutpass = async (id: string) => {
    if (adminRole !== 'super_admin') {
      alert('Super Admin သာလျှင် ဖျက်ခွင့်ရှိပါသည်။');
      return;
    }
    if (window.confirm('ဤ Out Pass မှတ်တမ်းကို အပြီးတိုင် ဖျက်မည်မှာ သေချာပါသလား?')) {
      await deleteDoc(doc(db, 'outpasses', id));
    }
  };

  const handleForceCompleteBooking = async (b: Booking) => {
    if (!b.id) return;
    if (window.confirm(`${b.therapist} ၏ "${b.service}" ကို ပြီးဆုံးပြီ (Completed) အဖြစ် သတ်မှတ်မည် သေချာပါသလား?`)) {
      const currentNow = Date.now();
      const { startMs, expectedEndMs } = getAccurateSessionTimes(b);
      const isAutoAdmin = isStrictlyAdminClockIn(b);
      const overtimeSecs = isAutoAdmin ? 0 : Math.max(0, Math.floor((currentNow - expectedEndMs) / 1000));

      await updateDoc(doc(db, 'bookings', b.id), {
        status: 'completed',
        startTimeMillis: startMs,
        expectedEndTimeMillis: expectedEndMs,
        actualEndTimeMillis: currentNow,
        overtimeSeconds: overtimeSecs
      });
    }
  };

  const handleForceReturnOutpass = async (o: OutPass) => {
    if (!o.id) return;
    if (window.confirm(`${o.therapist} ၏ Out Pass ကို ပြန်ရောက်ပြီ (Returned) အဖြစ် သတ်မှတ်မည် သေချာပါသလား?`)) {
      const currentNow = Date.now();
      const overtimeSecs = o.expectedInTimeMillis
        ? Math.max(0, Math.floor((currentNow - o.expectedInTimeMillis) / 1000))
        : 0;
      await updateDoc(doc(db, 'outpasses', o.id), {
        status: 'returned',
        inTimeMillis: currentNow,
        overtimeSeconds: overtimeSecs
      });
    }
  };

const getTodayServiceStats = (tName: string) => {
    const cleanTarget = tName.trim().toLowerCase();
    const tBookings = bookings.filter((b) => {
      if (!b.therapist || b.date !== todayStr || (b.status !== 'completed' && b.status !== 'in_progress')) return false;
      const assignedList = String(b.therapist).split(/&|,|\+/).map((s) => s.trim().toLowerCase());
      return assignedList.includes(cleanTarget);
    });
    return {
      count: tBookings.length,
      names: tBookings.map((b) => (b.service || '').split('(')[0].trim())
    };
  };

  const getTodayOutpassCount = (tName: string) => {
    return outpasses.filter((o) => o.therapist === tName && o.date === todayStr).length;
  };

  // 🌟 DBOARD ACTIVE FILTER: ဒီနေ့ရက်စွဲ (`b.date === todayStr`) ဖြစ်သော Active Session များကိုသာ ပြသမည်! 🌟
  const activeBookings = useMemo(() => {
    return bookings.filter((b) => {
      if (b.status !== 'in_progress') return false;
      if (b.date !== todayStr) return false;

      const { expectedEndMs } = getAccurateSessionTimes(b);
      if (isStrictlyAdminClockIn(b) && now >= expectedEndMs) return false;

      return true;
    });
  }, [bookings, todayStr, now, getAccurateSessionTimes, isStrictlyAdminClockIn]);

  // လက်ရှိ Overtime ဖြစ်နေသော Active Session အရေအတွက်
  const activeOvertimeCount = useMemo(() => {
    return activeBookings.filter((b) => {
      const { expectedEndMs } = getAccurateSessionTimes(b);
      return !isStrictlyAdminClockIn(b) && now > expectedEndMs;
    }).length;
  }, [activeBookings, now, getAccurateSessionTimes, isStrictlyAdminClockIn]);

  // ဒီနေ့အတွက် Out Pass များသာ ပြသမည်
  const activeOutpasses = useMemo(() => {
    return outpasses.filter((o) => o.status === 'out' && o.date === todayStr);
  }, [outpasses, todayStr]);

  // Services List Tab အတွက် Filter (Today, Yesterday, Custom Date, All + Search)
  const displayedServiceHistory = useMemo(() => {
    const yesterdayStr = getYesterdayStr();
    const q = historySearch.trim().toLowerCase();

    return bookings.filter((b) => {
      if (serviceDateFilter === 'today' && b.date !== todayStr) return false;
      if (serviceDateFilter === 'yesterday' && b.date !== yesterdayStr) return false;
      if (serviceDateFilter === 'custom' && customFilterDate && b.date !== customFilterDate) return false;

      if (q) {
        const match =
          String(b.therapist || '').toLowerCase().includes(q) ||
          String(b.service || '').toLowerCase().includes(q) ||
          String(b.name || '').toLowerCase().includes(q) ||
          String(b.txId || '').toLowerCase().includes(q);
        if (!match) return false;
      }
      return true;
    });
  }, [bookings, serviceDateFilter, customFilterDate, historySearch, todayStr]);

  // Outpasses List Tab အတွက် Filter
  const displayedOutpasses = useMemo(() => {
    const q = historySearch.trim().toLowerCase();
    return outpasses.filter((o) => {
      if (outpassDateFilter === 'today' && o.date !== todayStr) return false;
      if (q) {
        return (
          String(o.therapist || '').toLowerCase().includes(q) ||
          String(o.reason || '').toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [outpasses, outpassDateFilter, historySearch, todayStr]);

  const uniqueTherapists = Array.from(new Map(therapists.map((t) => [t.name, t])).values());
  const allTherapistsStats = uniqueTherapists.map((t) => {
    const serviceStats = getTodayServiceStats(t.name);
    const opCount = getTodayOutpassCount(t.name);
    return { name: t.name, sections: serviceStats.count, outpasses: opCount };
  });

  const serviceLeaderboard = [...allTherapistsStats].filter((s) => s.sections > 0).sort((a, b) => b.sections - a.sections);
  const outpassLeaderboard = [...allTherapistsStats].filter((s) => s.outpasses > 0).sort((a, b) => b.outpasses - a.outpasses);
  const totalSectionsToday = serviceLeaderboard.reduce((sum, item) => sum + item.sections, 0);

  // 🌟 Excel Export for Staff Service History 🌟
  const handleExportServiceHistoryCSV = () => {
    const headers = [
      'Date',
      'Therapist',
      'Service Name',
      'Assigned Duration',
      'Customer',
      'Session Type',
      'Start Time (AM/PM)',
      'Expected End (AM/PM)',
      'Actual End (AM/PM)',
      'Status',
      'Overtime'
    ];
    const rows = displayedServiceHistory.map((b) => {
      const { startMs, expectedEndMs, durationMins } = getAccurateSessionTimes(b);
      const isAdminAuto = isStrictlyAdminClockIn(b);
      const ovSecs = isAdminAuto ? 0 : b.overtimeSeconds || 0;
      return [
        `"${b.date || ''}"`,
        `"${b.therapist || ''}"`,
        `"${b.service || ''}"`,
        `"${formatMinsToHrMinBurmese(durationMins)} (${durationMins} မိနစ်)"`,
        `"${b.name || ''}"`,
        `"${isAdminAuto ? 'Admin Clock-In (Auto)' : 'POS / Online Booking'}"`,
        `"${formatTimeAMPM(startMs)}"`,
        `"${formatTimeAMPM(expectedEndMs)}"`,
        `"${b.status === 'in_progress' ? 'ACTIVE' : formatTimeAMPM(b.actualEndTimeMillis || expectedEndMs)}"`,
        `"${b.status}"`,
        `"${ovSecs > 0 ? `+${formatSecondsToBurmeseWords(ovSecs)}` : 'On Time'}"`
      ];
    });
    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `Staff_Service_History_${todayStr}.csv`;
    link.click();
  };

  return (
    <div className="bg-white p-5 sm:p-6 rounded-2xl shadow-sm border border-gray-200 space-y-6">
      {/* Header & Sub-Navigation Tabs */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center border-b border-gray-100 pb-4 gap-4">
        <div>
          <h2 className="text-xl font-bold flex items-center" style={{ color: THEME.primary }}>
            <BarChart2 className="mr-2 text-[#D4AF37]" /> Staff Live Monitor & Service History
          </h2>
          <p className="text-xs text-gray-500 mt-1">
            ဝန်ထမ်းများ၏ လက်ရှိ ဝန်ဆောင်မှုအချိန် (AM/PM)၊ ကျန်ရှိချိန် (နာရီ/မိနစ်)၊ အချိန်ပို (Overtime) နှင့် Out Pass မှတ်တမ်းများ
          </p>
        </div>

        <div className="flex space-x-1.5 bg-gray-100 p-1.5 rounded-xl border border-gray-200 w-full lg:w-auto overflow-x-auto scrollbar-hide">
          <button
            onClick={() => setView('dashboard')}
            className={`whitespace-nowrap flex-1 lg:flex-none px-4 py-2 text-xs font-black rounded-lg transition flex items-center justify-center gap-1.5 ${
              view === 'dashboard' ? 'bg-[#123524] text-[#D4AF37] shadow-sm' : 'text-gray-600 hover:bg-white/60'
            }`}
          >
            <Activity className="w-3.5 h-3.5" />
            <span>Live Dashboard</span>
            {activeBookings.length > 0 && (
              <span className="bg-orange-500 text-white text-[9px] px-1.5 py-0.2 rounded-full">
                {activeBookings.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setView('service')}
            className={`whitespace-nowrap flex-1 lg:flex-none px-4 py-2 text-xs font-black rounded-lg transition flex items-center justify-center gap-1.5 ${
              view === 'service' ? 'bg-[#123524] text-[#D4AF37] shadow-sm' : 'text-gray-600 hover:bg-white/60'
            }`}
          >
            <History className="w-3.5 h-3.5" />
            <span>Services List</span>
          </button>
          <button
            onClick={() => setView('outpass')}
            className={`whitespace-nowrap flex-1 lg:flex-none px-4 py-2 text-xs font-black rounded-lg transition flex items-center justify-center gap-1.5 ${
              view === 'outpass' ? 'bg-[#123524] text-[#D4AF37] shadow-sm' : 'text-gray-600 hover:bg-white/60'
            }`}
          >
            <Coffee className="w-3.5 h-3.5" />
            <span>Out Passes List</span>
            {activeOutpasses.length > 0 && (
              <span className="bg-purple-600 text-white text-[9px] px-1.5 py-0.2 rounded-full">
                {activeOutpasses.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setView('performance')}
            className={`whitespace-nowrap flex-1 lg:flex-none px-4 py-2 text-xs font-black rounded-lg transition flex items-center justify-center gap-1.5 ${
              view === 'performance' ? 'bg-[#123524] text-[#D4AF37] shadow-sm' : 'text-gray-600 hover:bg-white/60'
            }`}
          >
            <TrendingUp className="w-3.5 h-3.5" />
            <span>Performance Stats</span>
          </button>
        </div>
      </div>

      {view === 'dashboard' && (
        <div className="space-y-8 animate-fade-in">
          {/* 🌟 TOP EXECUTIVE KPI SUMMARY STRIP 🌟 */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
            <div className="p-4 rounded-2xl bg-orange-50/70 border border-orange-200 flex items-center justify-between">
              <div>
                <div className="text-[10px] font-extrabold text-orange-800 uppercase tracking-wider">
                  လက်ရှိ ဝန်ဆောင်မှုပေးနေသူ
                </div>
                <div className="text-2xl font-black text-[#123524] mt-1">
                  {activeBookings.length} <span className="text-xs font-bold text-gray-500">ဦး</span>
                </div>
              </div>
              <div className="w-10 h-10 rounded-xl bg-orange-500/15 text-orange-600 flex items-center justify-center">
                <Activity className="w-5 h-5" />
              </div>
            </div>

            <div className={`p-4 rounded-2xl border flex items-center justify-between ${activeOvertimeCount > 0 ? 'bg-red-50 border-red-300' : 'bg-gray-50 border-gray-200'}`}>
              <div>
                <div className={`text-[10px] font-extrabold uppercase tracking-wider ${activeOvertimeCount > 0 ? 'text-red-700' : 'text-gray-500'}`}>
                  အချိန်ပို (Overtime / Late)
                </div>
                <div className={`text-2xl font-black mt-1 ${activeOvertimeCount > 0 ? 'text-red-600 animate-pulse' : 'text-gray-700'}`}>
                  {activeOvertimeCount} <span className="text-xs font-bold">Sec</span>
                </div>
              </div>
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${activeOvertimeCount > 0 ? 'bg-red-500/15 text-red-600' : 'bg-gray-200/70 text-gray-400'}`}>
                <AlertCircle className="w-5 h-5" />
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-purple-50/70 border border-purple-200 flex items-center justify-between">
              <div>
                <div className="text-[10px] font-extrabold text-purple-800 uppercase tracking-wider">
                  လက်ရှိ အပြင်ထွက်နေသူ (Out Pass)
                </div>
                <div className="text-2xl font-black text-purple-900 mt-1">
                  {activeOutpasses.length} <span className="text-xs font-bold text-purple-600">/ 2 ဦး</span>
                </div>
              </div>
              <div className="w-10 h-10 rounded-xl bg-purple-500/15 text-purple-600 flex items-center justify-center">
                <Coffee className="w-5 h-5" />
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-emerald-50/70 border border-emerald-200 flex items-center justify-between">
              <div>
                <div className="text-[10px] font-extrabold text-emerald-800 uppercase tracking-wider">
                  ယနေ့ စုစုပေါင်း Sections
                </div>
                <div className="text-2xl font-black text-[#123524] mt-1">
                  {totalSectionsToday} <span className="text-xs font-bold text-emerald-700">Sec</span>
                </div>
              </div>
              <div className="w-10 h-10 rounded-xl bg-emerald-500/15 text-emerald-700 flex items-center justify-center">
                <CheckCircle className="w-5 h-5" />
              </div>
            </div>
          </div>

          {/* 🌟 ADMIN MANUAL CLOCK IN MODAL 🌟 */}
          {showClockInModal && (
            <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
              <div className="bg-white p-6 rounded-2xl shadow-xl w-full max-w-sm animate-slide-up border border-gray-200">
                <div className="flex justify-between items-center mb-4 border-b pb-3">
                  <h3 className="text-lg font-bold text-[#123524] flex items-center">
                    <Timer className="w-5 h-5 mr-2 text-[#D4AF37]" /> Admin Manual Clock In
                  </h3>
                  <button onClick={() => setShowClockInModal(false)} className="text-gray-400 hover:text-red-500">
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <form
                  onSubmit={async (e) => {
                    e.preventDefault();
                    const form = e.target as HTMLFormElement;
                    const tName = (form.elements.namedItem('therapist') as HTMLSelectElement).value;
                    const svc = (form.elements.namedItem('service') as HTMLSelectElement).value;
                    const customSvc = (form.elements.namedItem('customService') as HTMLInputElement).value;
                    const finalService = svc === 'custom' ? customSvc : svc;

                    if (!tName || (!svc && !customSvc)) {
                      alert('အချက်အလက်များ ပြည့်စုံအောင် ဖြည့်ပါ။');
                      return;
                    }

                    const alreadyInService = activeBookings.some((ab) => ab.therapist === tName);
                    if (alreadyInService) {
                      alert(`⚠️ ${tName} သည် လက်ရှိ Service ဝင်နေဆဲ ဖြစ်ပါသည်။`);
                      return;
                    }

                    const durationMins = parseServiceDurationMins(finalService);
                    const durationFormatted = formatMinsToHrMinBurmese(durationMins);
                    const startMs = Date.now();
                    const expectedEndMs = startMs + durationMins * 60 * 1000;

                    if (
                      window.confirm(
                        `${tName} အတွက် "${finalService}"\n• သတ်မှတ်ကြာချိန်: ${durationFormatted} (${durationMins} မိနစ်)\n• စတင်ချိန်: ${formatTimeAMPM(startMs)}\n• ပြီးဆုံးရမည့်ချိန်: ${formatTimeAMPM(expectedEndMs)}\n\nစတင်မည် သေချာပါသလား? (သတ်မှတ်ချိန်ပြည့်ပါက Auto Clock-Out ထွက်ပါမည်)`
                      )
                    ) {
                      try {
                        await addDoc(collection(db, 'bookings'), {
                          name: encryptText('Walk-in (Admin Manual)'),
                          phone: encryptText('09000000000'),
                          service: finalService,
                          therapist: tName,
                          date: todayStr,
                          time: formatTimeAMPM(startMs),
                          status: 'in_progress',
                          isAdminClockIn: true,
                          paymentMethod: 'Admin Clock In',
                          txId: encryptText('ADMIN'),
                          totalPrice: 0,
                          createdAt: startMs,
                          startTimeMillis: startMs,
                          expectedEndTimeMillis: expectedEndMs
                        });
                        setShowClockInModal(false);
                        alert(`✅ ${tName} အား ${durationFormatted} (${durationMins} မိနစ်) ဖြင့် အောင်မြင်စွာ Clock-in ဝင်ပေးပြီးပါပြီ။`);
                      } catch (err) {
                        alert('Error: ' + err);
                      }
                    }
                  }}
                  className="space-y-4"
                >
                  <div>
                    <label className="block text-xs font-bold text-gray-500 mb-1">Select Therapist</label>
                    <select
                      name="therapist"
                      required
                      className="w-full p-3 bg-gray-50 border border-gray-200 rounded-lg outline-none font-bold text-[#123524]"
                    >
                      <option value="">-- ရွေးချယ်ပါ --</option>
                      {Array.from(new Map(therapists.map((t) => [t.name, t])).values()).map((t: any) => (
                        <option key={t.id} value={t.name}>
                          {t.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-500 mb-1">Select Service (Menu အချိန်အတိုင်း Auto မှတ်မည်)</label>
                    <select
                      name="service"
                      required
                      className="w-full p-3 bg-gray-50 border border-gray-200 rounded-lg outline-none font-bold text-gray-700 mb-2"
                      onChange={(e) => {
                        const customInput = document.getElementById('customServiceInput') as HTMLInputElement;
                        if (customInput) customInput.style.display = e.target.value === 'custom' ? 'block' : 'none';
                      }}
                    >
                      <option value="">-- ရွေးချယ်ပါ --</option>
                      {globalAppData?.categories
                        ?.flatMap((c) => c.items)
                        .map((item, idx) => (
                          <option key={idx} value={`${item.name} (${item.duration})`}>
                            {item.name} ({item.duration})
                          </option>
                        ))}
                      <option value="custom">-- အခြား (Custom Service) --</option>
                    </select>
                    <input
                      type="text"
                      id="customServiceInput"
                      name="customService"
                      placeholder="ဥပမာ - Oil Massage (90 Mins)"
                      className="w-full p-3 bg-gray-50 border border-gray-200 rounded-lg outline-none font-bold text-gray-700 hidden"
                    />
                  </div>

                  <div className="bg-blue-50 p-3 rounded-lg border border-blue-200">
                    <p className="text-[10px] text-blue-800 font-semibold leading-relaxed">
                      ⚡ <strong>Auto Clock-Out စနစ်:</strong> Admin Clock In ဖြင့် သွင်းထားသော ဝန်ဆောင်မှုသည် ရွေးချယ်ထားသော Service Menu အချိန်ပြည့်သည်နှင့် <strong>အလိုအလျောက် ပြီးဆုံးကြောင်း (Auto Clock-Out)</strong> သတ်မှတ်ပေးပါမည်။
                    </p>
                  </div>

                  <button
                    type="submit"
                    className="w-full py-3 bg-[#123524] text-[#D4AF37] rounded-lg font-bold shadow-md hover:bg-[#1a4a32] transition"
                  >
                    Start Service Now
                  </button>
                </form>
              </div>
            </div>
          )}

          {/* ================== CURRENTLY IN SERVICE (TODAY ONLY) ================== */}
          <div>
            <div className="flex flex-wrap justify-between items-center gap-2 mb-4 border-b border-gray-100 pb-3">
              <div>
                <h3 className="text-sm sm:text-base font-extrabold text-[#123524] flex items-center">
                  <Activity className="w-4 h-4 mr-2 text-orange-500" />
                  Currently In Service Today (Active: {activeBookings.length})
                </h3>
                <p className="text-[11px] text-gray-500 font-semibold mt-0.5">
                  Admin Clock-In များ အချိန်ပြည့်လျှင် Auto ပိတ်ပေးပြီး၊ POS / Online Booking များသည် ဝန်ထမ်း Complete နှိပ်မှ ရပ်ပါမည်
                </p>
              </div>
              <button
                onClick={() => setShowClockInModal(true)}
                className="bg-[#123524] text-[#D4AF37] hover:bg-[#1a4a32] px-4 py-2 rounded-xl text-xs font-black border border-[#D4AF37]/40 flex items-center transition shadow-sm"
              >
                <Timer className="w-4 h-4 mr-1.5" /> + Admin Clock In
              </button>
            </div>

            {activeBookings.length === 0 ? (
              <div className="text-xs font-bold text-gray-400 bg-gray-50/70 p-8 rounded-2xl text-center border border-dashed border-gray-200">
                ယနေ့ လက်ရှိ ဝန်ဆောင်မှုပေးနေသော ဝန်ထမ်းမရှိပါ။ (No staff currently in service today)
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {activeBookings.map((b) => {
                  const { startMs, expectedEndMs, durationMins } = getAccurateSessionTimes(b);
                  const totalServiceSecs = Math.max(1, durationMins * 60);
                  const isAdminAuto = isStrictlyAdminClockIn(b);
                  const isOutcall =
                    b.service.toLowerCase().includes('outcall') ||
                    b.service.toLowerCase().includes('hotel') ||
                    b.service.toLowerCase().includes('home') ||
                    b.service.toLowerCase().includes('whole');

                  const isLate = !isAdminAuto && now > expectedEndMs;
                  const elapsedSecs = Math.max(0, Math.floor((now - startMs) / 1000));
                  const remainingSecs = Math.max(0, Math.ceil((expectedEndMs - now) / 1000));
                  const overtimeSecs = isLate ? Math.floor((now - expectedEndMs) / 1000) : 0;
                  const progressPct = Math.min(100, Math.max(0, Math.round((elapsedSecs / totalServiceSecs) * 100)));

                  const tStats = getTodayServiceStats(b.therapist);
                  const cleanServiceTitle = (b.service || 'Spa Service').replace(/\(\d+\s*Mins\)/gi, '').trim();
                  const durationLabel = formatMinsToHrMinBurmese(durationMins);

                  return (
                    <div
                      key={b.id}
                      className={`p-5 rounded-2xl border-2 flex flex-col ${
                        isLate
                          ? 'bg-red-50/60 border-red-300 shadow-red-100/50'
                          : isAdminAuto
                          ? 'bg-emerald-50/40 border-emerald-200'
                          : isOutcall
                          ? 'bg-blue-50/40 border-blue-200'
                          : 'bg-orange-50/40 border-orange-200'
                      } shadow-sm relative overflow-hidden transition-all hover:shadow-md`}
                    >
                      <div
                        className={`absolute top-0 left-0 w-1.5 h-full ${
                          isLate ? 'bg-red-500' : isAdminAuto ? 'bg-emerald-500' : isOutcall ? 'bg-blue-500' : 'bg-orange-500'
                        } animate-pulse`}
                      />

                      {/* Row 1: Therapist Name & Live Remaining / Overtime Badge (with Hours & Mins) */}
                      <div className="flex justify-between items-start mb-2.5 gap-2">
                        <div>
                          <div className={`font-black text-base ${isLate ? 'text-red-900' : 'text-[#123524]'}`}>
                            {b.therapist}
                          </div>
                          {b.txId && b.txId !== 'ADMIN' && (
                            <span className="font-mono text-[10px] font-black text-gray-500">
                              Bill: {b.txId}
                            </span>
                          )}
                        </div>

                        <div className="text-right">
                          <span
                            className={`inline-block text-[10px] font-black px-2.5 py-1 rounded-lg tracking-wide shadow-2xs ${
                              isLate
                                ? 'bg-red-600 text-white animate-pulse'
                                : isAdminAuto
                                ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                                : isOutcall
                                ? 'bg-blue-100 text-blue-800 border border-blue-300'
                                : 'bg-orange-100 text-orange-800 border border-orange-300'
                            }`}
                          >
                            {isLate
                              ? formatBadgeTimerText(overtimeSecs, true)
                              : formatBadgeTimerText(remainingSecs, false)}
                          </span>
                          <div className="text-[9px] font-mono font-bold text-gray-500 mt-0.5">
                            {isLate
                              ? `(+${formatSecondsClock(overtimeSecs)} ကျော်လွန်)`
                              : `(${formatSecondsClock(remainingSecs)} ကျန်ရှိ)`}
                          </div>
                        </div>
                      </div>

                      {/* Row 2: Service Name & Duration Pill (Hours & Mins) */}
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div className="text-sm font-black text-gray-800 leading-snug" title={b.service}>
                          {cleanServiceTitle}
                        </div>
                        <span className="text-[10px] font-black bg-[#123524] text-[#D4AF37] px-2.5 py-1 rounded-lg flex-shrink-0 shadow-2xs whitespace-nowrap">
                          ⏱ {durationLabel}
                          {durationMins >= 60 ? ` (${durationMins} မိနစ်)` : ''}
                        </span>
                      </div>

                      {/* Row 3: Customer & Session Mode Badge */}
                      <div className="flex items-center justify-between text-xs text-gray-600 mb-3">
                        <span className="flex items-center truncate font-semibold">
                          <User className="w-3.5 h-3.5 mr-1 text-[#D4AF37] flex-shrink-0" />
                          ဧည့်သည်: <strong className="ml-1 text-gray-800 truncate">{b.name}</strong>
                        </span>
                        <span
                          className={`text-[9px] font-black px-2 py-0.5 rounded-md flex-shrink-0 ${
                            isAdminAuto ? 'bg-blue-100 text-blue-700 border border-blue-200' : 'bg-amber-100 text-amber-800 border border-amber-300'
                          }`}
                        >
                          {isAdminAuto ? '⚡ Auto Clock-Out' : '👤 Staff Complete'}
                        </span>
                      </div>

                      {/* Row 4: Start Time (AM/PM), Progress Bar & Expected End Time (AM/PM) */}
                      <div
                        className={`p-3 rounded-xl border mb-3 space-y-2 ${
                          isLate ? 'bg-white/90 border-red-200' : 'bg-white/80 border-gray-200/80'
                        }`}
                      >
                        <div className="flex justify-between items-center text-xs">
                          <div>
                            <span className="text-[10px] font-bold text-gray-400 block uppercase">စတင်ချိန် (Start)</span>
                            <span className="font-mono font-black text-gray-800 text-xs sm:text-sm">
                              {formatTimeAMPM(startMs)}
                            </span>
                          </div>

                          <div className="text-center">
                            <span className="text-[10px] font-bold text-gray-400 block uppercase">ကြာမြင့်ချိန်</span>
                            <span className="font-bold text-[#123524] text-[11px]">
                              {formatSecondsToBurmeseWords(elapsedSecs)}
                            </span>
                          </div>

                          <div className="text-right">
                            <span className="text-[10px] font-bold text-gray-400 block uppercase">
                              {isAdminAuto ? 'Auto-Out ချိန်' : 'ပြီးဆုံးရမည့်ချိန် (End)'}
                            </span>
                            <span
                              className={`font-mono font-black text-xs sm:text-sm px-1.5 py-0.5 rounded ${
                                isLate ? 'bg-red-100 text-red-700' : 'text-[#123524]'
                              }`}
                            >
                              {formatTimeAMPM(expectedEndMs)}
                            </span>
                          </div>
                        </div>

                        {/* Visual Progress Bar */}
                        <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all duration-700 ${
                              isLate
                                ? 'bg-gradient-to-r from-red-500 to-orange-500'
                                : 'bg-gradient-to-r from-[#123524] to-[#D4AF37]'
                            }`}
                            style={{ width: `${progressPct}%` }}
                          />
                        </div>
                      </div>

                      {/* Row 5: Today's Sections & Complete Action Button */}
                      <div className="mt-auto pt-2.5 border-t border-dashed border-gray-300/70">
                        <div className="flex justify-between items-center mb-1">
                          <span className="text-[10px] font-bold text-gray-600">
                            ယနေ့ ဝင်ပြီးသော​ Sections (Today Sections):{' '}
                            <strong className="text-orange-600 text-xs">{tStats.count} Sec</strong>
                          </span>
                          {Number(b.totalPrice) > 0 && (
                            <span className="text-[11px] font-black text-[#123524]">
                              {formatPrice(b.totalPrice)}
                            </span>
                          )}
                        </div>
                        <div className="text-[10px] text-gray-500 truncate mb-3 font-medium" title={tStats.names.join(', ')}>
                          {tStats.names.join(', ')}
                        </div>
                        <button
                          onClick={() => handleForceCompleteBooking(b)}
                          className="w-full py-2.5 px-4 bg-[#123524] hover:bg-[#1a4a32] text-[#D4AF37] rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1.5 shadow-sm active:scale-[0.99]"
                        >
                          <CheckCircle className="w-4 h-4 text-[#D4AF37] flex-shrink-0" />
                          <span>ပြီးဆုံးပြီဟု သတ်မှတ်မည် (Complete)</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* 🌟 All Staff Today's Total Sections 🌟 */}
            <div className="mt-6 pt-5 border-t border-gray-100">
              <h4 className="text-[11px] font-bold text-gray-500 mb-3 uppercase tracking-wider flex items-center">
                <Activity className="w-3.5 h-3.5 mr-1.5 text-orange-400" />
                Today's Total Sections (All Staff)
              </h4>
              <div className="flex flex-wrap gap-2.5">
                {serviceLeaderboard.length === 0 ? (
                  <span className="text-xs text-gray-400 font-semibold bg-gray-50 px-3 py-2 rounded-lg border border-dashed border-gray-200">
                    ဒီနေ့အတွက် Section ဝင်ထားသော ဝန်ထမ်းမရှိသေးပါ။
                  </span>
                ) : (
                  serviceLeaderboard.map((s) => (
                    <div
                      key={s.name}
                      className="bg-white border border-orange-200 px-3.5 py-2 rounded-xl flex items-center justify-between gap-3 shadow-xs hover:border-orange-400 transition-colors"
                    >
                      <span className="text-xs font-bold text-gray-700">{s.name}</span>
                      <span className="bg-orange-100 text-orange-800 text-[10px] font-black px-2.5 py-0.5 rounded-md">
                        {s.sections} Sections
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* ================== OUTPASS SECTION (AM/PM + LIVE COUNTDOWN) ================== */}
          <div className="pt-4 border-t border-gray-100">
            <h3 className="text-sm sm:text-base font-extrabold text-[#123524] mb-3 flex items-center pb-2">
              <Coffee className="w-4 h-4 mr-2 text-purple-600" />
              Currently on Out Pass (Active: {activeOutpasses.length} / 2)
            </h3>
            {activeOutpasses.length === 0 ? (
              <div className="text-xs font-bold text-gray-400 bg-gray-50/70 p-8 rounded-2xl text-center border border-dashed border-gray-200">
                လက်ရှိ အပြင်ထွက်နေသော ဝန်ထမ်းမရှိပါ။ (No staff currently on out pass)
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {activeOutpasses.map((o) => {
                  const expectedInMs = o.expectedInTimeMillis || o.outTimeMillis + 30 * 60 * 1000;
                  const isLate = now > expectedInMs;
                  const remSecs = Math.max(0, Math.ceil((expectedInMs - now) / 1000));
                  const overSecs = isLate ? Math.floor((now - expectedInMs) / 1000) : 0;
                  const opCount = getTodayOutpassCount(o.therapist);

                  return (
                    <div
                      key={o.id}
                      className={`p-5 rounded-2xl border-2 flex flex-col ${
                        isLate ? 'bg-red-50/60 border-red-300' : 'bg-purple-50/40 border-purple-200'
                      } shadow-sm relative overflow-hidden transition-all hover:shadow-md`}
                    >
                      <div className={`absolute top-0 left-0 w-1.5 h-full ${isLate ? 'bg-red-500' : 'bg-purple-500'} animate-pulse`} />

                      <div className="flex justify-between items-start mb-2.5 gap-2">
                        <div>
                          <div className={`font-black text-base ${isLate ? 'text-red-900' : 'text-[#123524]'}`}>
                            {o.therapist}
                          </div>
                          <span className="text-[10px] font-bold text-purple-700">
                            ခွင့်ပြုချိန်: 30 မိနစ် (Out Pass)
                          </span>
                        </div>

                        <div className="text-right">
                          <span
                            className={`inline-block text-[10px] font-black px-2.5 py-1 rounded-lg tracking-wide ${
                              isLate
                                ? 'bg-red-600 text-white animate-pulse'
                                : 'bg-purple-100 text-purple-800 border border-purple-300'
                            }`}
                          >
                            {isLate
                              ? formatBadgeTimerText(overSecs, true)
                              : formatBadgeTimerText(remSecs, false)}
                          </span>
                        </div>
                      </div>

                      <div className="text-xs text-gray-700 mb-3 bg-white/70 p-2.5 rounded-xl border border-purple-100">
                        <span className="font-bold text-gray-500">အကြောင်းပြချက် (Reason):</span>{' '}
                        <strong className="text-gray-800">{o.reason || 'No reason provided'}</strong>
                      </div>

                      <div
                        className={`flex justify-between items-center text-xs p-3 rounded-xl border mb-3 ${
                          isLate ? 'bg-white border-red-200' : 'bg-white border-purple-200/60'
                        }`}
                      >
                        <div>
                          <span className="text-[10px] font-bold text-gray-400 block uppercase">ထွက်ချိန် (Out)</span>
                          <span className="font-mono font-black text-gray-800 text-xs sm:text-sm">
                            {formatTimeAMPM(o.outTimeMillis)}
                          </span>
                        </div>

                        <span className="text-gray-300 font-black">➔</span>

                        <div className="text-right">
                          <span className="text-[10px] font-bold text-gray-400 block uppercase">ပြန်ဝင်ရမည့်ချိန် (Return)</span>
                          <span
                            className={`font-mono font-black text-xs sm:text-sm px-1.5 py-0.5 rounded ${
                              isLate ? 'bg-red-100 text-red-700' : 'text-purple-700'
                            }`}
                          >
                            {formatTimeAMPM(expectedInMs)}
                          </span>
                        </div>
                      </div>

                      <div className="mt-auto pt-2.5 border-t border-dashed border-gray-300/70">
                        <div className="flex justify-between items-center mb-3">
                          <span className="text-[10px] font-bold text-gray-600">ယနေ့ ထွက်ပြီးသားအကြိမ်:</span>
                          <span className="text-[10px] font-black text-purple-800 bg-purple-100 px-2.5 py-0.5 rounded-md">
                            {opCount} / 4 ကြိမ်
                          </span>
                        </div>
                        <button
                          onClick={() => handleForceReturnOutpass(o)}
                          className="w-full py-2.5 px-4 bg-[#123524] hover:bg-[#1a4a32] text-[#D4AF37] rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1.5 shadow-sm"
                        >
                          <CheckCircle className="w-4 h-4 text-[#D4AF37] flex-shrink-0" />
                          <span>ပြန်ရောက်ပြီဟု သတ်မှတ်မည် (Return)</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* 🌟 All Staff Today's Total Outpasses 🌟 */}
            <div className="mt-6 pt-5 border-t border-gray-100">
              <h4 className="text-[11px] font-bold text-gray-500 mb-3 uppercase tracking-wider flex items-center">
                <Coffee className="w-3.5 h-3.5 mr-1.5 text-purple-400" />
                Today's Outpass Usage (All Staff)
              </h4>
              <div className="flex flex-wrap gap-2.5">
                {outpassLeaderboard.length === 0 ? (
                  <span className="text-xs text-gray-400 font-semibold bg-gray-50 px-3 py-2 rounded-lg border border-dashed border-gray-200">
                    ဒီနေ့အတွက် Out Pass သုံးထားသော ဝန်ထမ်းမရှိသေးပါ။
                  </span>
                ) : (
                  outpassLeaderboard.map((s) => (
                    <div
                      key={s.name}
                      className="bg-white border border-purple-200 px-3.5 py-2 rounded-xl flex items-center justify-between gap-3 shadow-xs hover:border-purple-400 transition-colors"
                    >
                      <span className="text-xs font-bold text-gray-700">{s.name}</span>
                      <span className="bg-purple-100 text-purple-800 text-[10px] font-black px-2.5 py-0.5 rounded-md">
                        {s.outpasses} / 4 ကြိမ်
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================================
          🌟 TAB 2: SERVICES HISTORY LIST (AM/PM, နာရီ/မိနစ်, SEARCH & EXCEL EXPORT) 🌟
          ============================================================================ */}
      {view === 'service' && (
        <div className="space-y-4 animate-fade-in">
          <div className="flex flex-col lg:flex-row justify-between items-stretch lg:items-center gap-3 bg-gray-50 p-3.5 rounded-2xl border border-gray-200">
            <div className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                onClick={() => setServiceDateFilter('today')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                  serviceDateFilter === 'today' ? 'bg-[#123524] text-[#D4AF37]' : 'bg-white text-gray-600 border border-gray-200'
                }`}
              >
                ယနေ့ (Today)
              </button>
              <button
                type="button"
                onClick={() => setServiceDateFilter('yesterday')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                  serviceDateFilter === 'yesterday' ? 'bg-[#123524] text-[#D4AF37]' : 'bg-white text-gray-600 border border-gray-200'
                }`}
              >
                မနေ့က (Yesterday)
              </button>
              <button
                type="button"
                onClick={() => setServiceDateFilter('all')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                  serviceDateFilter === 'all' ? 'bg-[#123524] text-[#D4AF37]' : 'bg-white text-gray-600 border border-gray-200'
                }`}
              >
                ရက်အားလုံး (All History)
              </button>
              <input
                type="date"
                value={customFilterDate}
                onChange={(e) => {
                  setCustomFilterDate(e.target.value);
                  setServiceDateFilter('custom');
                }}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold border outline-none cursor-pointer ${
                  serviceDateFilter === 'custom'
                    ? 'bg-[#123524] text-[#D4AF37] border-[#123524]'
                    : 'bg-white text-gray-700 border-gray-200'
                }`}
              />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="relative flex-1 sm:w-64">
                <input
                  type="text"
                  value={historySearch}
                  onChange={(e) => setHistorySearch(e.target.value)}
                  placeholder="ဝန်ထမ်း၊ ဝန်ဆောင်မှု သို့မဟုတ် ဧည့်သည် ရှာရန်..."
                  className="w-full pl-9 pr-7 py-1.5 bg-white border border-gray-200 rounded-xl text-xs font-bold outline-none focus:border-[#D4AF37]"
                />
                <Search className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-2.5" />
                {historySearch && (
                  <button
                    type="button"
                    onClick={() => setHistorySearch('')}
                    className="absolute right-2.5 top-2 text-gray-400 hover:text-gray-600"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              <button
                type="button"
                onClick={handleExportServiceHistoryCSV}
                className="px-3.5 py-1.5 bg-green-50 hover:bg-green-100 text-green-700 border border-green-200 rounded-xl text-xs font-black flex items-center gap-1.5 transition"
              >
                <Download className="w-3.5 h-3.5" /> Export Excel
              </button>
            </div>
          </div>

          <div className="overflow-x-auto rounded-2xl border border-gray-200">
            <table className="w-full text-left border-collapse min-w-[950px]">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50 text-[11px] text-gray-500 uppercase tracking-wider">
                  <th className="p-3.5">Staff (Therapist)</th>
                  <th className="p-3.5">Service, Duration & Customer</th>
                  <th className="p-3.5">Date</th>
                  <th className="p-3.5">စတင်ချိန် (Start)</th>
                  <th className="p-3.5">ပြီးဆုံးရမည့်ချိန် (Expected)</th>
                  <th className="p-3.5">ပြီးဆုံးချိန် (Actual End)</th>
                  <th className="p-3.5 text-right">အချိန်ပို (Overtime) / Action</th>
                </tr>
              </thead>
              <tbody>
                {displayedServiceHistory.length === 0 && (
                  <tr>
                    <td colSpan={7} className="p-10 text-center text-gray-400 font-bold text-xs">
                      ရွေးချယ်ထားသော ရက်စွဲအတွက် ဝန်ဆောင်မှုမှတ်တမ်း မရှိပါ။
                    </td>
                  </tr>
                )}
                {displayedServiceHistory.map((b) => {
                  const { startMs, expectedEndMs, durationMins } = getAccurateSessionTimes(b);
                  const isAdminAuto = isStrictlyAdminClockIn(b);
                  let currentOvertime = isAdminAuto ? 0 : b.overtimeSeconds || 0;
                  let isLate = currentOvertime > 60;
                  if (!isAdminAuto && b.status === 'in_progress' && now > expectedEndMs) {
                    currentOvertime = Math.floor((now - expectedEndMs) / 1000);
                    isLate = currentOvertime > 60;
                  }
                  const durationFormatted = formatMinsToHrMinBurmese(durationMins);

                  return (
                    <tr key={b.id} className="border-b border-gray-100 hover:bg-gray-50/80 transition text-sm">
                      <td className="p-3.5">
                        <div className="font-black text-[#123524]">{b.therapist}</div>
                        <span
                          className={`inline-block mt-1 text-[9px] font-black px-2 py-0.5 rounded ${
                            isAdminAuto ? 'bg-blue-50 text-blue-700 border border-blue-200' : 'bg-amber-50 text-amber-800 border border-amber-200'
                          }`}
                        >
                          {isAdminAuto ? '⚡ Admin Clock-In' : '🧾 POS / Online'}
                        </span>
                      </td>

                      <td className="p-3.5 max-w-xs">
                        <div className="font-bold text-gray-800 leading-snug">
                          {b.service.replace(/\(\d+\s*Mins\)/gi, '').trim()}
                        </div>
                        <div className="flex flex-wrap items-center gap-2 mt-1">
                          <span className="text-[10px] font-black text-[#123524] bg-yellow-100 border border-[#D4AF37]/40 px-2 py-0.5 rounded">
                            ⏱ သတ်မှတ်ချိန်: {durationFormatted}
                            {durationMins >= 60 ? ` (${durationMins} မိနစ်)` : ''}
                          </span>
                          <span className="text-xs text-gray-500 font-semibold">• ဧည့်သည်: {b.name}</span>
                        </div>
                      </td>

                      <td className="p-3.5 text-gray-700 font-bold text-xs">{b.date}</td>

                      <td className="p-3.5 font-mono font-bold text-gray-800 text-xs">
                        {formatTimeAMPM(startMs)}
                      </td>

                      <td className="p-3.5 font-mono font-bold text-gray-700 text-xs">
                        {formatTimeAMPM(expectedEndMs)}
                      </td>

                      <td className="p-3.5 font-mono text-xs">
                        {b.status === 'in_progress' ? (
                          <span className="bg-orange-100 text-orange-700 border border-orange-300 px-2.5 py-1 rounded-full text-[10px] animate-pulse font-black">
                            ● IN PROGRESS
                          </span>
                        ) : (
                          <span className="font-bold text-emerald-800">
                            {formatTimeAMPM(b.actualEndTimeMillis || expectedEndMs)}
                          </span>
                        )}
                      </td>

                      <td className="p-3.5 text-right">
                        {isLate ? (
                          <div className="mb-1.5">
                            <span className="inline-block bg-red-50 text-red-600 border border-red-200 px-2.5 py-1 rounded-lg text-xs font-black">
                              +{formatSecondsToBurmeseWords(currentOvertime)}
                            </span>
                            <div className="text-[10px] font-mono text-red-400 mt-0.5">
                              (+{formatSecondsClock(currentOvertime)})
                            </div>
                          </div>
                        ) : (
                          <div className="mb-1.5">
                            <span className="inline-block bg-emerald-50 text-emerald-700 border border-emerald-200 px-2.5 py-0.5 rounded-lg text-[10px] font-black">
                              ✓ အချိန်မှန် (On Time)
                            </span>
                          </div>
                        )}

                        <button
                          onClick={() => handleDeleteBooking(b.id!)}
                          disabled={adminRole !== 'super_admin'}
                          className={`text-[10px] font-bold px-2.5 py-1 rounded-lg transition ${
                            adminRole === 'super_admin'
                              ? 'text-red-600 hover:bg-red-100 bg-red-50'
                              : 'text-gray-300 bg-gray-100 cursor-not-allowed'
                          }`}
                          title="Delete Record"
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ============================================================================
          🌟 TAB 3: OUT PASSES LIST (AM/PM & နာရီ/မိနစ်) 🌟
          ============================================================================ */}
      {view === 'outpass' && (
        <div className="space-y-4 animate-fade-in">
          <div className="flex flex-wrap justify-between items-center gap-3 bg-gray-50 p-3.5 rounded-2xl border border-gray-200">
            <div className="flex gap-1.5">
              <button
                type="button"
                onClick={() => setOutpassDateFilter('today')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                  outpassDateFilter === 'today' ? 'bg-[#123524] text-[#D4AF37]' : 'bg-white text-gray-600 border border-gray-200'
                }`}
              >
                ယနေ့ (Today Only)
              </button>
              <button
                type="button"
                onClick={() => setOutpassDateFilter('all')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                  outpassDateFilter === 'all' ? 'bg-[#123524] text-[#D4AF37]' : 'bg-white text-gray-600 border border-gray-200'
                }`}
              >
                ရက်အားလုံး (All Out Passes)
              </button>
            </div>

            <div className="relative w-full sm:w-64">
              <input
                type="text"
                value={historySearch}
                onChange={(e) => setHistorySearch(e.target.value)}
                placeholder="ဝန်ထမ်း သို့မဟုတ် အကြောင်းပြချက် ရှာရန်..."
                className="w-full pl-9 pr-7 py-1.5 bg-white border border-gray-200 rounded-xl text-xs font-bold outline-none focus:border-purple-400"
              />
              <Search className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-2.5" />
            </div>
          </div>

          <div className="overflow-x-auto rounded-2xl border border-gray-200">
            <table className="w-full text-left border-collapse min-w-[900px]">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50 text-[11px] text-gray-500 uppercase tracking-wider">
                  <th className="p-3.5">Staff (Therapist) & Reason</th>
                  <th className="p-3.5">Date</th>
                  <th className="p-3.5">ထွက်ချိန် (Out Time)</th>
                  <th className="p-3.5">ပြန်ဝင်ရမည့်ချိန် (Expected)</th>
                  <th className="p-3.5">ပြန်ရောက်ချိန် (Actual Return)</th>
                  <th className="p-3.5 text-right">အချိန်ပို (Overtime) / Action</th>
                </tr>
              </thead>
              <tbody>
                {displayedOutpasses.length === 0 && (
                  <tr>
                    <td colSpan={6} className="p-10 text-center text-gray-400 font-bold text-xs">
                      Out Pass မှတ်တမ်း မရှိပါ။
                    </td>
                  </tr>
                )}
                {displayedOutpasses.map((o) => {
                  let currentOvertime = o.overtimeSeconds || 0;
                  let isLate = currentOvertime > 0;
                  if (o.status === 'out' && o.expectedInTimeMillis && now > o.expectedInTimeMillis) {
                    currentOvertime = Math.floor((now - o.expectedInTimeMillis) / 1000);
                    isLate = true;
                  }
                  return (
                    <tr key={o.id} className="border-b border-gray-100 hover:bg-gray-50/80 transition text-sm">
                      <td className="p-3.5">
                        <div className="font-black text-purple-800 flex items-center">
                          <Coffee className="w-3.5 h-3.5 mr-1.5 text-purple-500" />
                          {o.therapist}
                        </div>
                        <div className="text-xs text-gray-600 font-semibold mt-0.5">
                          အကြောင်းပြချက်: {o.reason || '-'}
                        </div>
                      </td>

                      <td className="p-3.5 text-gray-700 font-bold text-xs">{o.date}</td>

                      <td className="p-3.5 font-mono font-bold text-gray-800 text-xs">
                        {formatTimeAMPM(o.outTimeMillis)}
                      </td>

                      <td className="p-3.5 font-mono font-bold text-gray-700 text-xs">
                        {formatTimeAMPM(o.expectedInTimeMillis)}
                      </td>

                      <td className="p-3.5 font-mono text-xs">
                        {o.status === 'out' ? (
                          <span className="bg-purple-100 text-purple-800 border border-purple-300 px-2.5 py-1 rounded-full text-[10px] animate-pulse font-black">
                            ● OUT NOW
                          </span>
                        ) : (
                          <span className="font-bold text-emerald-800">{formatTimeAMPM(o.inTimeMillis)}</span>
                        )}
                      </td>

                      <td className="p-3.5 text-right">
                        {isLate ? (
                          <div className="mb-1.5">
                            <span className="inline-block bg-red-50 text-red-600 border border-red-200 px-2.5 py-1 rounded-lg text-xs font-black">
                              +{formatSecondsToBurmeseWords(currentOvertime)}
                            </span>
                            <div className="text-[10px] font-mono text-red-400 mt-0.5">
                              (+{formatSecondsClock(currentOvertime)})
                            </div>
                          </div>
                        ) : (
                          <div className="mb-1.5">
                            <span className="inline-block bg-emerald-50 text-emerald-700 border border-emerald-200 px-2.5 py-0.5 rounded-lg text-[10px] font-black">
                              ✓ အချိန်မှန် (On Time)
                            </span>
                          </div>
                        )}

                        <button
                          onClick={() => handleDeleteOutpass(o.id!)}
                          disabled={adminRole !== 'super_admin'}
                          className={`text-[10px] font-bold px-2.5 py-1 rounded-lg transition ${
                            adminRole === 'super_admin'
                              ? 'text-red-600 hover:bg-red-100 bg-red-50'
                              : 'text-gray-300 bg-gray-100 cursor-not-allowed'
                          }`}
                          title="Delete"
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {view === 'performance' && <AdminStaffPerformanceView therapists={therapists} bookings={allBookings || bookings} />}
    </div>
  );
}

function AdminUsersList({ adminRole, appData }: { adminRole: string, appData: AppData }) {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingUser, setEditingUser] = useState<any>(null);
  const [editForm, setEditForm] = useState({ name: '', password: '', dob: '', points: 0 });
  const [creatingUser, setCreatingUser] = useState(false);
  const [createForm, setCreateForm] = useState({ name: '', phone: '', password: '', dob: '' });
  
  const [searchQuery, setSearchQuery] = useState('');

  const fetchUsers = async () => {
    try {
      const snap = await getDocs(collection(db, 'users'));
      const data: any[] = [];
      snap.forEach(doc => {
          const raw = doc.data();
          data.push({ 
             docId: doc.id, ...raw, phone: decryptText(raw.phone) || doc.id, name: decryptText(raw.name) || raw.name, password: decryptText(raw.password) || raw.password,
             points: parseInt(decryptText(raw.points as string) || (raw.points as string) || '0', 10), dob: decryptText(raw.dob) || raw.dob || '',
             resetRequested: raw.resetRequested || false, 
             resetOtp: raw.resetOtp ? decryptText(raw.resetOtp) : '',
             otpApproved: raw.otpApproved || false
          });
      });
      data.sort((a, b) => {
          if (a.resetRequested && !b.resetRequested) return -1;
          if (!a.resetRequested && b.resetRequested) return 1;
          return (b.createdAt || 0) - (a.createdAt || 0);
      });
      setUsers(data);
    } catch (e) { console.error(e); } setLoading(false);
  };
  
  useEffect(() => { fetchUsers(); }, []);

  const handleUpdateUser = async (e: React.FormEvent) => {
    e.preventDefault(); if (!editingUser) return;
    try {
      // Password အသစ်ရိုက်ထည့်ပါက SECURED_ACCOUNT ဟုသာ သိမ်းပါမည်
      const finalPwd = editForm.password && editForm.password.length >= 6 ? "SECURED_ACCOUNT" : (editingUser.password || "");
      await updateDoc(doc(db, 'users', editingUser.docId), { name: encryptText(editForm.name), password: encryptText(finalPwd), dob: encryptText(editForm.dob), points: encryptText(editForm.points.toString()) });
      alert('User အချက်အလက်များ ပြင်ဆင်ပြီးပါပြီ။ (စကားဝှက်အသစ် ပြောင်းလိုပါက Customer App မှ Forgot Password ကိုသာ အသုံးပြုခိုင်းပါ)'); 
      setEditingUser(null); fetchUsers();
    } catch (e) { alert('Error updating user'); }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault(); const phoneStr = createForm.phone.trim();
    const exists = users.some(u => u.phone === phoneStr);
    if (exists) { alert("ဤဖုန်းနံပါတ်ဖြင့် အကောင့်ရှိပြီးသားဖြစ်ပါသည်။"); return; }
    
    const pwd = createForm.password || '123456';
    if (pwd.length < 6) { alert("Password သည် အနည်းဆုံး ၆ လုံး ရှိရပါမည်။"); return; }

    try {
        // 🌟 Security: Firebase Auth တွင် Customer အကောင့် လုံခြုံစွာ ဖန်တီးပေးခြင်း
        try {
            await createUserWithEmailAndPassword(secondaryAuth, `${phoneStr}@shangrila.com`, pwd);
        } catch (authErr: any) {
            console.log("Auth Error (may already exist):", authErr.message);
        }

        // 🌟 Security: Database ထဲတွင် Password အစစ်ကို မသိမ်းတော့ပါ။
        await addDoc(collection(db, 'users'), { phone: encryptText(phoneStr), name: encryptText(createForm.name), password: encryptText("SECURED_ACCOUNT"), dob: encryptText(createForm.dob), points: encryptText('0'), createdAt: Date.now() });
        
        alert('User အသစ် ဖန်တီးပြီးပါပြီ။ (Password အစစ်ကို Database ပြင်ပတွင် လုံခြုံစွာ သိမ်းဆည်းပြီးပါပြီ)'); 
        setCreatingUser(false); setCreateForm({ name: '', phone: '', password: '', dob: '' }); fetchUsers();
    } catch (e) { alert('Error creating user'); }
  };

  const handleDeleteUser = async (docId: string, phone: string) => {
    if (adminRole !== 'super_admin') { alert('Super Admin သာလျှင် ဖျက်ခွင့်ရှိပါသည်။'); return; }
    if (!window.confirm(`User [${phone}] ကို အပြီးတိုင် ဖျက်မည် သေချာပါသလား?`)) return;
    try { await deleteDoc(doc(db, 'users', docId)); fetchUsers(); } catch (e) { alert('Error deleting user'); }
  };

  const handleApproveOTP = async (docId: string) => {
      if (adminRole !== 'super_admin') { alert('Super Admin သာလျှင် ခွင့်ပြုနိုင်ပါသည်။'); return; }
      try {
          await updateDoc(doc(db, 'users', docId), { otpApproved: true });
          alert('OTP အတည်ပြုပြီးပါပြီ။ User ဘက်တွင် စကားဝှက်အသစ် ပြောင်းနိုင်ပါပြီ။');
          fetchUsers();
      } catch(e) { alert('Error approving OTP'); }
  };

  const handleExportUsers = () => {
      const headers = ['User ID', 'Phone (Login ID)', 'Name', 'DOB', 'Total Points', 'VIP Tier', 'Joined Date'];
      const rows = users.map(u => { const tier = getTier(u.points); return [ u.docId || '', `"${u.phone || ''}"`, `"${u.name || ''}"`, `"${u.dob || ''}"`, u.points || 0, tier ? `"${tier.name}"` : 'None', u.createdAt ? `"${new Date(u.createdAt).toLocaleString()}"` : '' ]; });
      const csvContent = '\uFEFF' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' }); const link = document.createElement('a'); const url = URL.createObjectURL(blob);
      link.setAttribute('href', url); link.setAttribute('download', `Users_Report_${getLocalTodayStr()}.csv`); link.style.visibility = 'hidden';
      document.body.appendChild(link); link.click(); document.body.removeChild(link);
  };

  const getTier = (points: number) => { if(!appData.vipSettings?.isActive || !appData.vipSettings?.tiers) return null; const sortedTiers = [...appData.vipSettings.tiers].sort((a,b) => b.requiredPoints - a.requiredPoints); return sortedTiers.find(t => points >= t.requiredPoints); };

  const filteredUsers = users.filter(u => 
      u.phone.includes(searchQuery) || 
      (u.name && u.name.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  if (loading) return <div className="text-center py-20 text-gray-500 font-bold">Loading Users...</div>;

  return (
    <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200 relative">
      {editingUser && (
         <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
            <div className="bg-white p-6 rounded-xl shadow-lg max-w-sm w-full animate-fade-in"><h3 className="text-lg font-bold mb-4 text-[#123524] flex items-center"><Edit className="w-5 h-5 mr-2 text-[#D4AF37]"/> Edit User ({editingUser.phone})</h3>
               <form onSubmit={handleUpdateUser} className="space-y-4">
                 <div><label className="block text-xs font-bold text-gray-500 mb-1">Name</label><input type="text" value={editForm.name} onChange={e=>setEditForm({...editForm, name: e.target.value})} className="w-full p-2 border rounded focus:border-[#D4AF37] outline-none" required /></div>
                 <div><label className="block text-xs font-bold text-gray-500 mb-1">Date of Birth</label><input type="date" value={editForm.dob} onChange={e=>setEditForm({...editForm, dob: e.target.value})} className="w-full p-2 border rounded focus:border-[#D4AF37] outline-none" /></div>
                 <div><label className="block text-xs font-bold text-gray-500 mb-1">Total Points <span className="text-[9px] text-orange-500">(Fix total points here if sync failed)</span></label><input type="number" value={editForm.points} onChange={e=>setEditForm({...editForm, points: Number(e.target.value)})} className="w-full p-2 border rounded focus:border-[#D4AF37] outline-none font-bold" required /></div>
                 <div><label className="block text-xs font-bold text-gray-500 mb-1">New Password (စကားဝှက်အသစ် ပြောင်းရန်)</label><input type="text" value={editForm.password} onChange={e=>setEditForm({...editForm, password: e.target.value})} placeholder="Enter new password" className="w-full p-2 border rounded outline-none font-bold focus:border-[#D4AF37]" /></div>
                 <div className="flex space-x-2 pt-2"><button type="button" onClick={() => setEditingUser(null)} className="flex-1 py-2 bg-gray-100 text-gray-600 rounded font-bold hover:bg-gray-200">Cancel</button><button type="submit" className="flex-1 py-2 bg-[#123524] text-white rounded font-bold hover:bg-green-900">Save</button></div>
               </form>
            </div>
         </div>
      )}

      {creatingUser && (
          <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
              <div className="bg-white p-6 rounded-xl shadow-lg max-w-sm w-full animate-fade-in">
                  <h3 className="text-lg font-bold mb-4 text-[#123524] flex items-center"><UserPlus className="w-5 h-5 mr-2 text-[#D4AF37]"/> Create New User</h3>
                  <form onSubmit={handleCreateUser} className="space-y-4">
                      <div><label className="block text-xs font-bold text-gray-500 mb-1">Phone Number (Login ID) *</label><input type="tel" value={createForm.phone} onChange={e=>setCreateForm({...createForm, phone: e.target.value})} className="w-full p-2 border rounded focus:border-[#D4AF37] outline-none" required placeholder="e.g. 09xxxxxxxxx"/></div>
                      <div><label className="block text-xs font-bold text-gray-500 mb-1">Name *</label><input type="text" value={createForm.name} onChange={e=>setCreateForm({...createForm, name: e.target.value})} className="w-full p-2 border rounded focus:border-[#D4AF37] outline-none" required placeholder="Customer Name"/></div>
                      <div><label className="block text-xs font-bold text-gray-500 mb-1">Date of Birth</label><input type="date" value={createForm.dob} onChange={e=>setCreateForm({...createForm, dob: e.target.value})} className="w-full p-2 border rounded focus:border-[#D4AF37] outline-none" /></div>
                      <div><label className="block text-xs font-bold text-gray-500 mb-1">Password (Optional)</label><input type="text" value={createForm.password} onChange={e=>setCreateForm({...createForm, password: e.target.value})} placeholder="Leave blank for auto-login" className="w-full p-2 border rounded focus:border-[#D4AF37] outline-none" /></div>
                      <div className="flex space-x-2 pt-2"><button type="button" onClick={() => setCreatingUser(false)} className="flex-1 py-2 bg-gray-100 text-gray-600 rounded font-bold hover:bg-gray-200">Cancel</button><button type="submit" className="flex-1 py-2 bg-[#123524] text-white rounded font-bold hover:bg-green-900">Create</button></div>
                  </form>
              </div>
          </div>
      )}

      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 border-b border-gray-100 pb-4 gap-4">
          <h2 className="text-xl font-bold flex items-center" style={{ color: THEME.primary }}><UserCircle className="mr-2 text-[#D4AF37]" /> Auto-Created Profiles & VIP</h2>
          
          <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-2 items-center w-full md:w-auto">
              <div className="relative w-full sm:w-60">
                  <input type="text" placeholder="Search phone or name..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full pl-9 pr-3 py-2 bg-gray-50 border border-gray-200 rounded-lg outline-none focus:border-[#D4AF37] text-sm font-semibold" />
                  <Search className="w-4 h-4 text-gray-400 absolute left-3 top-2.5" />
              </div>
              <div className="flex space-x-2 w-full sm:w-auto">
                  <button onClick={handleExportUsers} className="flex-1 sm:flex-none justify-center items-center flex px-3 py-2 bg-green-50 text-green-700 border border-green-200 rounded-lg text-sm font-bold hover:bg-green-100 transition shadow-sm"><Download className="w-4 h-4 mr-1.5" /> Export</button>
                  <button onClick={() => setCreatingUser(true)} className="flex-1 sm:flex-none flex items-center justify-center text-sm bg-gray-100 border border-gray-300 px-4 py-2 rounded-lg hover:bg-gray-200 font-bold whitespace-nowrap shadow-sm"><PlusCircle className="w-4 h-4 mr-1.5" /> Add New</button>
              </div>
          </div>
      </div>
      
      <div className="overflow-x-auto"><table className="w-full text-left border-collapse min-w-[800px]"><thead><tr className="border-b-2 border-gray-100 text-xs text-gray-500 uppercase tracking-wider"><th className="p-3 pb-4">Phone (Login ID)</th><th className="p-3 pb-4">Name & DOB</th><th className="p-3 pb-4">VIP Tier & Points</th><th className="p-3 pb-4">Security / OTP Request</th><th className="p-3 pb-4 text-right">Action</th></tr></thead><tbody>{filteredUsers.length === 0 && (<tr><td colSpan={5} className="p-10 text-center text-gray-400">User မတွေ့ပါ။</td></tr>)}{filteredUsers.map((u, idx) => {
         const userTier = getTier(u.points);
         return (
         <tr key={idx} className={`border-b hover:bg-gray-50 transition ${u.resetRequested && !u.otpApproved ? 'bg-red-50/30 border-red-100' : 'border-gray-50'}`}>
             <td className="p-3 font-mono font-bold tracking-wider text-[#123524]">{u.phone}</td>
             <td className="p-3"><div className="font-bold text-gray-800">{u.name || '-'}</div>{u.dob && <div className="text-[10px] text-gray-500 mt-0.5 flex items-center"><Gift className="w-3 h-3 mr-1"/> {u.dob}</div>}</td>
             <td className="p-3"><div className="flex items-center space-x-2"><span className="font-bold text-gray-800 text-lg">{u.points || 0} Pts</span>{userTier && <span className="text-[10px] px-2 py-0.5 rounded font-bold text-white shadow-sm flex items-center" style={{ backgroundColor: userTier.colorTheme }}><Award className="w-3 h-3 mr-1"/> {userTier.name} ({userTier.discountPercent}%)</span>}</div></td>
             <td className="p-3">
               {u.resetRequested ? (
                   <div className="flex flex-col gap-1">
                       <span className="text-[10px] bg-red-100 text-red-700 font-bold px-2 py-1 rounded flex w-fit items-center border border-red-200 animate-pulse"><AlertCircle className="w-3 h-3 mr-1" /> Password Reset Req</span>
                       {u.resetOtp && <span className="text-[10px] font-mono bg-yellow-50 text-yellow-800 font-bold px-2 py-1 rounded border border-yellow-200">OTP: {u.resetOtp}</span>}
                       {!u.otpApproved ? (
                           <button onClick={() => handleApproveOTP(u.docId)} disabled={adminRole !== 'super_admin'} className={`text-[9px] text-white font-bold px-3 py-1.5 rounded mt-1 w-fit transition shadow-md ${adminRole === 'super_admin' ? 'bg-green-600 hover:bg-green-700' : 'bg-gray-300 cursor-not-allowed'}`}>Approve OTP</button>
                       ) : (
                           <span className="text-[9px] text-green-600 font-bold mt-1">✓ OTP Approved</span>
                       )}
                   </div>
               ) : u.password ? (<span className="text-[10px] bg-green-100 text-green-700 font-bold px-2 py-1 rounded flex w-fit items-center"><KeyRound className="w-3 h-3 mr-1" /> Set</span>) : (<span className="text-[10px] bg-gray-100 text-gray-500 font-bold px-2 py-1 rounded flex w-fit items-center"><AlertCircle className="w-3 h-3 mr-1" /> None</span>)}
             </td>
             <td className="p-3 text-right">
                 <div className="flex items-center justify-end space-x-2">
                     <button onClick={() => { setEditingUser(u); setEditForm({ name: u.name || '', password: u.password || '', dob: u.dob || '', points: u.points || 0 }); }} disabled={adminRole !== 'super_admin'} className={`p-1.5 rounded transition font-bold text-[10px] flex items-center ${adminRole === 'super_admin' ? 'bg-blue-50 text-blue-600 hover:bg-blue-100' : 'bg-gray-50 text-gray-300 cursor-not-allowed'}`} title={adminRole !== 'super_admin' ? 'Super Admin Only' : 'Edit Info'}><Edit className="w-3 h-3 mr-1"/> Edit Info</button>
                     <button onClick={() => handleDeleteUser(u.docId, u.phone)} disabled={adminRole !== 'super_admin'} className={`p-1.5 rounded transition font-bold text-[10px] flex items-center ${adminRole === 'super_admin' ? 'bg-red-50 text-red-600 hover:bg-red-100' : 'bg-gray-50 text-gray-300 cursor-not-allowed'}`} title={adminRole !== 'super_admin' ? 'Super Admin Only' : 'Delete'}><Trash2 className="w-3 h-3 mr-1"/> Delete</button>
                 </div>
             </td>
         </tr>
         );
      })}</tbody></table></div>
    </div>
  );
}

function AdminManagementList() {
  const [admins, setAdmins] = useState<LocalAdminProfile[]>([]); const [loading, setLoading] = useState(true);
  const [newAdmin, setNewAdmin] = useState<{username: string, password: string, role: 'super_admin'|'custom', permissions: string[]}>({ username: '', password: '', role: 'super_admin', permissions: ['bookings', 'reports', 'users', 'points', 'settings', 'penalties'] });
  const [editingAdmin, setEditingAdmin] = useState<LocalAdminProfile | null>(null);

  const fetchAdmins = async () => {
    try { const snap = await getDocs(collection(db, 'admins')); const data: LocalAdminProfile[] = []; snap.forEach(doc => { const raw = doc.data(); data.push({ docId: doc.id, ...raw, username: decryptText(raw.username) || doc.id, password: decryptText(raw.password) || raw.password }); }); setAdmins(data); } catch (e) { console.error(e); } setLoading(false);
  };
  useEffect(() => { fetchAdmins(); }, []);

  const handleAddAdmin = async (e: React.FormEvent) => {
    e.preventDefault(); if(!newAdmin.username || !newAdmin.password) return;
    try { await createUserWithEmailAndPassword(secondaryAuth, `${newAdmin.username.toLowerCase()}@shangrila.com`, newAdmin.password); await addDoc(collection(db, 'admins'), { username: encryptText(newAdmin.username), password: encryptText(newAdmin.password), role: newAdmin.role, permissions: newAdmin.role === 'super_admin' ? ['bookings', 'reports', 'users', 'points', 'admins', 'settings', 'penalties'] : newAdmin.permissions }); setNewAdmin({ username: '', password: '', role: 'super_admin', permissions: ['bookings', 'reports', 'users', 'points', 'settings', 'penalties'] }); fetchAdmins(); } catch (e) { alert('Error adding admin. It may already exist in Auth.'); }
  };

  const handleUpdateAdmin = async (e: React.FormEvent) => {
      e.preventDefault(); if (!editingAdmin || !editingAdmin.docId) return;
      try { await updateDoc(doc(db, 'admins', editingAdmin.docId), { username: encryptText(editingAdmin.username || ''), password: encryptText(editingAdmin.password || ''), role: editingAdmin.role, permissions: editingAdmin.role === 'super_admin' ? ['bookings', 'reports', 'users', 'points', 'admins', 'settings', 'penalties'] : editingAdmin.permissions }); alert('Admin updated successfully.'); setEditingAdmin(null); fetchAdmins(); } catch (e) { alert('Error updating admin.'); }
  };

  const handleDeleteAdmin = async (docId: string, username: string) => {
    if (admins.length <= 1) { alert("အနည်းဆုံး Admin တစ်ယောက် ကျန်ရှိရပါမည်။"); return; } if (!window.confirm(`Admin [${username}] ကို ဖျက်မည် သေချာပါသလား?`)) return;
    try { await deleteDoc(doc(db, 'admins', docId)); fetchAdmins(); } catch (e) { alert('Error deleting admin'); }
  };

  const handleCheckboxChange = (tabId: string) => { setNewAdmin(prev => { const perms = prev.permissions.includes(tabId) ? prev.permissions.filter(p => p !== tabId) : [...prev.permissions, tabId]; return { ...prev, permissions: perms }; }); };
  const handleEditCheckboxChange = (tabId: string) => { setEditingAdmin(prev => { if(!prev) return prev; const perms = (prev.permissions||[]).includes(tabId) ? (prev.permissions||[]).filter(p => p !== tabId) : [...(prev.permissions||[]), tabId]; return { ...prev, permissions: perms }; }); };

  if (loading) return <div className="text-center py-20 text-gray-500 font-bold">Loading Admins...</div>;

  return (
    <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200 relative">
      {editingAdmin && (
          <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
              <div className="bg-white p-6 rounded-xl shadow-lg max-w-sm w-full animate-fade-in"><h3 className="text-lg font-bold mb-4 text-[#123524] flex items-center"><Edit className="w-5 h-5 mr-2 text-[#D4AF37]"/> Edit Admin</h3>
                  <form onSubmit={handleUpdateAdmin} className="space-y-4">
                      <div><label className="block text-xs font-bold text-gray-500 mb-1">Username</label><input type="text" value={editingAdmin.username} onChange={e=>setEditingAdmin({...editingAdmin, username: e.target.value})} className="w-full p-2 border rounded focus:border-[#D4AF37] outline-none" required /></div>
                      <div><label className="block text-xs font-bold text-gray-500 mb-1">Password</label><input type="text" value={editingAdmin.password} onChange={e=>setEditingAdmin({...editingAdmin, password: e.target.value})} className="w-full p-2 border rounded focus:border-[#D4AF37] outline-none" minLength={6} required /></div>
                      <div className="w-full mt-4 border-t border-gray-200 pt-4"><label className="block text-xs font-bold text-gray-500 mb-2">Admin Role Permissions</label><div className="flex flex-col sm:flex-row gap-4 sm:space-x-4 mb-3"><label className="flex items-center space-x-2 text-sm font-bold cursor-pointer"><input type="radio" checked={editingAdmin.role === 'super_admin'} onChange={() => setEditingAdmin({...editingAdmin, role: 'super_admin'})} className="w-4 h-4 accent-[#123524]" /><span className="text-[#123524]">Super Admin</span></label><label className="flex items-center space-x-2 text-sm font-bold cursor-pointer"><input type="radio" checked={editingAdmin.role === 'custom'} onChange={() => setEditingAdmin({...editingAdmin, role: 'custom'})} className="w-4 h-4 accent-[#123524]" /><span className="text-[#123524]">Custom Role</span></label></div>{editingAdmin.role === 'custom' && (<div className="bg-gray-50 p-4 rounded-lg border border-gray-200 shadow-sm animate-fade-in"><div className="flex flex-wrap gap-4">{['bookings', 'reports', 'users', 'points', 'penalties', 'settings'].map(tab => (<label key={tab} className="flex items-center space-x-2 text-xs font-bold cursor-pointer bg-white px-3 py-2 rounded border border-gray-100 hover:bg-gray-50 transition"><input type="checkbox" checked={(editingAdmin.permissions||[]).includes(tab)} onChange={() => handleEditCheckboxChange(tab)} className="w-4 h-4 accent-[#123524]" /><span className="capitalize">{tab === 'reports' ? 'Staff History' : tab === 'points' ? 'Point Mgmt' : tab === 'penalties' ? 'Penalty & Loans' : tab}</span></label>))}</div></div>)}</div>
                      <div className="flex space-x-2 pt-2"><button type="button" onClick={() => setEditingAdmin(null)} className="flex-1 py-2 bg-gray-100 text-gray-600 rounded font-bold hover:bg-gray-200">Cancel</button><button type="submit" className="flex-1 py-2 bg-[#123524] text-white rounded font-bold hover:bg-green-900">Save</button></div>
                  </form>
              </div>
          </div>
      )}

      <div className="flex justify-between items-center mb-6 border-b border-gray-100 pb-4"><h2 className="text-xl font-bold flex items-center" style={{ color: THEME.primary }}><ShieldCheck className="mr-2 text-[#D4AF37]" /> Manage Admins</h2><span className="bg-gray-100 text-gray-700 px-4 py-1 rounded-full text-sm font-bold border border-gray-200">Total: {admins.length}</span></div>
      <form onSubmit={handleAddAdmin} className="mb-6 p-5 bg-gray-50 border border-gray-200 rounded-xl flex flex-col items-end">
        <div className="flex flex-col sm:flex-row gap-4 w-full"><div className="w-full sm:flex-1"><label className="block text-xs font-bold text-gray-500 mb-1">New Username</label><input type="text" value={newAdmin.username} onChange={e=>setNewAdmin({...newAdmin, username: e.target.value})} className="w-full p-3 border border-gray-300 rounded outline-none focus:border-[#D4AF37]" required /></div><div className="w-full sm:flex-1"><label className="block text-xs font-bold text-gray-500 mb-1">New Password (Min 6 Chars)</label><input type="text" value={newAdmin.password} onChange={e=>setNewAdmin({...newAdmin, password: e.target.value})} className="w-full p-3 border border-gray-300 rounded outline-none focus:border-[#D4AF37]" minLength={6} required /></div></div>
        <div className="w-full mt-4 border-t border-gray-200 pt-4"><label className="block text-xs font-bold text-gray-500 mb-2">Admin Role Permissions</label><div className="flex flex-col sm:flex-row gap-4 sm:space-x-4 mb-3"><label className="flex items-center space-x-2 text-sm font-bold cursor-pointer"><input type="radio" checked={newAdmin.role === 'super_admin'} onChange={() => setNewAdmin({...newAdmin, role: 'super_admin'})} className="w-4 h-4 accent-[#123524]" /><span className="text-[#123524]">Super Admin <span className="text-xs text-gray-500 font-semibold">(All Access)</span></span></label><label className="flex items-center space-x-2 text-sm font-bold cursor-pointer"><input type="radio" checked={newAdmin.role === 'custom'} onChange={() => setNewAdmin({...newAdmin, role: 'custom'})} className="w-4 h-4 accent-[#123524]" /><span className="text-[#123524]">Custom Role</span></label></div>{newAdmin.role === 'custom' && (<div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm animate-fade-in"><p className="text-[10px] text-gray-400 font-bold mb-3 uppercase tracking-wider">Select Allowed Tabs (ဝင်ကြည့်ခွင့်ပြုမည့် Tab ကိုရွေးပါ)</p><div className="flex flex-wrap gap-4">{['bookings', 'reports', 'users', 'points', 'penalties', 'settings'].map(tab => (<label key={tab} className="flex items-center space-x-2 text-xs font-bold cursor-pointer bg-gray-50 px-3 py-2 rounded border border-gray-100 hover:bg-gray-100 transition"><input type="checkbox" checked={newAdmin.permissions.includes(tab)} onChange={() => handleCheckboxChange(tab)} className="w-4 h-4 accent-[#123524]" /><span className="capitalize">{tab === 'reports' ? 'Staff History' : tab === 'points' ? 'Point Mgmt' : tab === 'penalties' ? 'Penalty & Loans' : tab}</span></label>))}</div><p className="text-[10px] text-red-500 mt-3 font-semibold flex items-center"><AlertCircle className="w-3 h-3 mr-1"/> Note: Custom admins are restricted from accessing the 'Admins' management tab.</p></div>)}</div>
        <button type="submit" className="w-full sm:w-auto px-6 py-3 bg-[#123524] text-white rounded font-bold flex items-center justify-center mt-4 shadow-md hover:bg-green-900 transition"><PlusCircle className="w-5 h-5 mr-2"/> Add New Admin</button>
      </form>
      <div className="overflow-x-auto"><table className="w-full text-left border-collapse min-w-[600px]"><thead><tr className="border-b-2 border-gray-100 text-xs text-gray-500 uppercase tracking-wider"><th className="p-3 pb-4">Username & Role</th><th className="p-3 pb-4">Password</th><th className="p-3 pb-4 text-right">Action</th></tr></thead><tbody>{admins.map((a, idx) => (<tr key={idx} className="border-b border-gray-50 hover:bg-gray-50 transition"><td className="p-3"><div className="font-bold text-gray-800 flex items-center text-sm"><User className="w-4 h-4 mr-2 text-gray-400"/> {a.username}</div><div className="mt-1.5">{a.role === 'super_admin' || !a.role ? (<span className="text-[9px] bg-purple-100 text-purple-700 px-2 py-0.5 rounded font-bold uppercase tracking-wider border border-purple-200">Super Admin</span>) : (<div className="flex flex-wrap gap-1 mt-1">{a.permissions?.map(p => <span key={p} className="text-[9px] font-bold bg-blue-50 text-blue-700 px-2 py-0.5 border border-blue-200 rounded uppercase tracking-wider">{p === 'reports' ? 'Staff History' : p === 'points' ? 'Point Mgmt' : p === 'penalties' ? 'Penalty & Loans' : p}</span>)}</div>)}</div></td><td className="p-3 font-mono text-sm text-gray-500 flex items-center"><Lock className="w-3 h-3 mr-1"/> {a.password}</td><td className="p-3 text-right">
          <div className="flex items-center justify-end space-x-2"><button onClick={() => setEditingAdmin(a)} className="p-1.5 bg-blue-50 text-blue-600 rounded hover:bg-blue-100 transition inline-flex"><Edit className="w-4 h-4"/></button><button onClick={() => handleDeleteAdmin(a.docId!, a.username || '')} className="p-1.5 bg-red-50 text-red-600 rounded hover:bg-red-100 transition inline-flex"><Trash2 className="w-4 h-4"/></button></div>
      </td></tr>))}</tbody></table></div>
    </div>
  );
}

function AdminSettings({ appData, onSettingsUpdated }: { appData: AppData, onSettingsUpdated: (data: AppData) => void }) {
  const defaultVipConfig = {
    isActive: appData.vipSettings?.isActive ?? true,
    baseRuleText: appData.vipSettings?.baseRuleText || "သုံးစွဲငွေ ၃၅,၀၀၀ ကျပ် လျှင် = ၁ ပွိုင့် (1 Point)",
    preJadeText: appData.vipSettings?.preJadeText || "Jade Member မဖြစ်မီ (၅၀) ပွိုင့် စုဆောင်းနေစဉ်ကာလအတွင်း (၁)လ အတွင်း ပြည့်မီသော Points များအတွက် အထူး Discount ကို ထပ်ဆောင်းပေးအပ်ပါသည်။",
    preJadeRewards: appData.vipSettings?.preJadeRewards || ['10 Pts = 10% Off', '20 Pts = 20% Off', '30 Pts = 30% Off', '40 Pts = 40% Off', '50 Pts = 50% Off'],
    cumulativeText: appData.vipSettings?.cumulativeText || "Member အဆင့်များကို အဆင့်မြှင့်တင်ရာတွင် ပွိုင့်များကို သုညမှ ပြန်မစဘဲ ရှိပြီးသားပွိုင့်များအပေါ်တွင် ဆက်လက်ပေါင်းထည့်ပေးမည့် စနစ်ကို အသုံးပြုထားပါသည်။",
    instantUpgradeText: appData.vipSettings?.instantUpgradeText || "(တစ်ကြိမ်တည်းဝယ်ယူမှုပြုလုပ်သူများအနေဖြင့် မိမိဝယ်ယူထားသည့်ငွေပမာဏအတိုင်း မိမိကြိုက်နှစ်သက်ရာ Service သို့မဟုတ် Package ကို မိမိဝယ်ယူထားသည့် Member အဆင့်ခံစားခွင့်နှင့်အညီ (၃)လအတွင်း ပြန်လည်သုံးစွဲနိုင်သည်။)",
    birthdayStandardText: appData.vipSettings?.birthdayStandardText || "မည်သည့် VIP (Jade, Gold, Imperial) မဆို မိမိမွေးနေ့တွင် မည်သည့် Service ကိုမဆို 50% Discount ခံစားခွင့်ရရှိမည်။",
    birthdayImperialText: appData.vipSettings?.birthdayImperialText || "အခြေခံ 20% + မွေးနေ့လတွင် ရရှိထားသော Points အရေအတွက် % ။",
    rules: appData.vipSettings?.rules || DEFAULT_VIP_SETTINGS.rules,
    tiers: appData.vipSettings?.tiers || DEFAULT_VIP_SETTINGS.tiers
  };

  const [localTherapists, setLocalTherapists] = useState<TherapistProfile[]>(() => { return (appData.therapists || []).map(t => ({...t, password: decryptText(t.password) || t.password})); });
  useEffect(() => {
        const fetchTherapists = async () => {
            const snap = await getDocs(collection(db, 'therapists'));
            const arr: any[] = [];
            snap.forEach(d => {
                const data = d.data();
                // 🌟 FIX: အကွက်လွတ် (Ghost) များကို Database ထဲမှ အလိုအလျောက် ဖျက်ထုတ်ပစ်မည် 🌟
                if (!data.name || data.name.trim() === '') {
                    deleteDoc(doc(db, 'therapists', d.id)).catch(() => {});
                } else {
                    arr.push({ id: d.id, ...data });
                }
            });
            arr.sort((a, b) => (a.order || 0) - (b.order || 0));
            setLocalTherapists(arr);
        };
        fetchTherapists();
    }, []);
  
   const DEFAULT_MENU_CATEGORIES = [
      {
          id: 'massage',
          title: 'Massage',
          order: 0,
          items: [
              { id: 'm1', name: 'Myanmar Traditional Massage', duration: '60 Mins', price: 25000, vvipPrice: 35000, vvipIncluded: false, description: '', imageUrl: '' },
              { id: 'm2', name: 'Myanmar Traditional Massage', duration: '90 Mins', price: 37000, vvipPrice: 52000, vvipIncluded: false, description: '', imageUrl: '' },
              { id: 'm3', name: 'Oil Massage', duration: '60 Mins', price: 25000, vvipPrice: 35000, vvipIncluded: false, description: '', imageUrl: '' },
              { id: 'm4', name: 'Oil Massage', duration: '90 Mins', price: 37000, vvipPrice: 52000, vvipIncluded: false, description: '', imageUrl: '' },
              { id: 'm5', name: 'Aromatherapy Massage', duration: '60 Mins', price: 30000, vvipPrice: 40000, vvipIncluded: false, description: '', imageUrl: '' },
              { id: 'm6', name: 'Aromatherapy Massage', duration: '90 Mins', price: 45000, vvipPrice: 60000, vvipIncluded: false, description: '', imageUrl: '' },
              { id: 'm7', name: 'Body Butter Lotion Massage', duration: '60 Mins', price: 35000, vvipPrice: 45000, vvipIncluded: false, description: '', imageUrl: '' },
              { id: 'm8', name: 'Body Butter Lotion Massage', duration: '90 Mins', price: 50000, vvipPrice: 67000, vvipIncluded: false, description: '', imageUrl: '' },
              { id: 'm9', name: 'Body to Body Massage', duration: '60 Mins', price: 55000, vvipPrice: 0, vvipIncluded: true, description: 'VVIP Room Included', imageUrl: '' },
              { id: 'm10', name: 'Body to Body Massage', duration: '90 Mins', price: 82000, vvipPrice: 0, vvipIncluded: true, description: 'VVIP Room Included', imageUrl: '' },
              { id: 'm11', name: 'Four Hands Massage', duration: '60 Mins', price: 70000, vvipPrice: 0, vvipIncluded: true, description: 'VVIP Room Included', imageUrl: '' },
              { id: 'm12', name: 'Four Hands Massage', duration: '90 Mins', price: 104000, vvipPrice: 0, vvipIncluded: true, description: 'VVIP Room Included', imageUrl: '' },
              { id: 'm13', name: 'Lotion Candle Massage', duration: '60 Mins', price: 55000, vvipPrice: 0, vvipIncluded: true, description: 'VVIP Room Included', imageUrl: '' },
              { id: 'm14', name: 'Lotion Candle Massage', duration: '90 Mins', price: 82000, vvipPrice: 0, vvipIncluded: true, description: 'VVIP Room Included', imageUrl: '' }
          ]
      },
      {
          id: 'body_scrub',
          title: 'Body Scrub',
          order: 1,
          items: [
              { id: 's1', name: 'Body Scrub & Bath Only', duration: '60 Mins', price: 70000, vvipPrice: 0, vvipIncluded: true, description: 'Scrub Options: Coffee | Aloe Vera | Tamarind | Milk | Vitamin C | Daily Shower Spa Salt', imageUrl: '' },
              { id: 's2', name: 'Body Scrub & Lotion Massage', duration: '120 Mins', price: 80000, vvipPrice: 0, vvipIncluded: true, description: 'Scrub Options: Coffee | Aloe Vera | Tamarind | Milk | Vitamin C | Daily Shower Spa Salt', imageUrl: '' }
          ]
      },
      {
          id: 'waxing',
          title: 'Waxing',
          order: 2,
          items: [
              { id: 'w1', name: 'Arm Wax', duration: 'Session', price: 20000, vvipPrice: 0, vvipIncluded: false, description: '', imageUrl: '' },
              { id: 'w2', name: 'Underarm Wax', duration: 'Session', price: 25000, vvipPrice: 0, vvipIncluded: false, description: '', imageUrl: '' },
              { id: 'w3', name: 'Half Leg Wax', duration: 'Session', price: 30000, vvipPrice: 0, vvipIncluded: false, description: '', imageUrl: '' },
              { id: 'w4', name: 'Full Leg Wax', duration: 'Session', price: 45000, vvipPrice: 0, vvipIncluded: false, description: '', imageUrl: '' },
              { id: 'w5', name: 'Bikini Wax', duration: 'Session', price: 35000, vvipPrice: 0, vvipIncluded: false, description: '', imageUrl: '' },
              { id: 'w6', name: 'Brazilian Wax', duration: 'Session', price: 50000, vvipPrice: 0, vvipIncluded: false, description: '', imageUrl: '' }
          ]
      },
      {
          id: 'hotel_service',
          title: 'Hotel & Home Services',
          order: 3,
          items: [
              { id: 'h1', name: 'Part Time Outcall Service', duration: '100 Mins', price: 70000, vvipPrice: 0, vvipIncluded: false, description: '', imageUrl: '' },
              { id: 'h2', name: 'Half Day Service', duration: '6 Hrs', price: 100000, vvipPrice: 0, vvipIncluded: false, description: '6:00 AM to 12:00 PM OR 12:00 PM to 6:00 PM', imageUrl: '' },
              { id: 'h3', name: 'The Whole Night Service', duration: '12 Hrs', price: 120000, vvipPrice: 0, vvipIncluded: false, description: '8:00 PM to 8:00 AM', imageUrl: '' },
              { id: 'h4', name: 'The Whole Day Service', duration: '12 Hrs', price: 180000, vvipPrice: 0, vvipIncluded: false, description: '7:00 AM to 7:00 PM', imageUrl: '' }
          ]
      }
  ];

  const [localCategories, setLocalCategories] = useState<MenuCategory[]>(() => {
      if (appData.categories && appData.categories.length > 0) {
          return appData.categories;
      }
      return DEFAULT_MENU_CATEGORIES;
  });

  useEffect(() => {
      const fetchAndSyncCategories = async () => {
          if (appData.categories && appData.categories.length === 4) return;
          
          const snap = await getDocs(collection(db, 'categories'));
          const arr: any[] = [];
          snap.forEach(d => arr.push({ docId: d.id, ...d.data() }));
          
          if (arr.length !== 4) {
              const batch = writeBatch(db);
              arr.forEach(cat => {
                  if (cat.docId) batch.delete(doc(db, 'categories', cat.docId));
              });
              DEFAULT_MENU_CATEGORIES.forEach((cat, idx) => {
                  const cDocRef = doc(db, 'categories', cat.id);
                  batch.set(cDocRef, { ...cat, order: idx });
              });
              
              // 🌟 FIX DELAY: Save directly into appData to prevent the 3 second delay for Customer App
              batch.update(doc(db, 'settings', 'appData'), { categories: DEFAULT_MENU_CATEGORIES });
              
              await batch.commit();
              setLocalCategories(DEFAULT_MENU_CATEGORIES);
          } else {
              arr.sort((a, b) => (a.order || 0) - (b.order || 0));
              setLocalCategories(arr);
          }
      };
      fetchAndSyncCategories();
  }, [appData.categories]);

  const handleForceFixCategories = async () => {
      if (!window.confirm("Menu အဟောင်းများကိုဖျက်၍ ပုံထဲကအတိုင်း အသစ်ပြန်လည်ထည့်သွင်းမည် သေချာပါသလား?")) return;
      setSavingCategory('force_fix');
      try {
          const batch = writeBatch(db);
          const snap = await getDocs(collection(db, 'categories'));
          snap.forEach(d => batch.delete(doc(db, 'categories', d.id)));
          
          DEFAULT_MENU_CATEGORIES.forEach((cat, idx) => {
              batch.set(doc(db, 'categories', cat.id), { ...cat, order: idx });
          });
      
          
          await batch.commit();
          setLocalCategories(DEFAULT_MENU_CATEGORIES);
          alert("✅ Menu အားလုံးကို အောင်မြင်စွာ ပြန်လည်ပြင်ဆင်ပြီးပါပြီ။ Customer App ကို ပိတ်ပြီး ပြန်ဖွင့်ကြည့်ပါ။");
      } catch (e) {
          console.error(e);
          alert("Error fixing categories");
      }
      setSavingCategory(null);
  };
   
  const [localBranding, setLocalBranding] = useState<AppBranding>(JSON.parse(JSON.stringify(appData.branding || { logoUrl: '', address: '', phone1: '', phone2: '', telegram: '', viber: '', copyright: '', name: '', shopLat: 0, shopLng: 0 })));
  const [localPaymentMethods, setLocalPaymentMethods] = useState<PaymentMethod[]>(JSON.parse(JSON.stringify(appData.paymentMethods || [])));
  const [localPromotion, setLocalPromotion] = useState<any>(() => {
  const defaultPromo = { 
        isBoxActive: false, 
        boxTitle: 'SPECIAL DISCOUNT', 
        isPopupActive: false, 
        campaignTitle: 'သီတင်းကျွတ် အထူးပရိုမိုးရှင်း', 
        hotelDiscountPercent: 10, 
        otherDiscountPercent: 20, 
        startDate: '', 
        endDate: '' 
    };
    return JSON.parse(JSON.stringify(appData.promotion || defaultPromo));
});
  const [localSignUpBonus, setLocalSignUpBonus] = useState<any>(JSON.parse(JSON.stringify(appData.signUpBonus || { isActive: false, points: 5, startDate: '', endDate: '' })));
  const [localInstallSteps, setLocalInstallSteps] = useState<InstallStep[]>(DEFAULT_INSTALL_STEPS);
  const [localVipSettings, setLocalVipSettings] = useState<any>(defaultVipConfig);

  const [deletedTherapistIds, setDeletedTherapistIds] = useState<string[]>([]);
  const [savingCategory, setSavingCategory] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState<string | null>(null);

 const handleExcelUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setSavingCategory('excel_upload');
    
    try {
        const reader = new FileReader();
        
        reader.onload = async (event) => {
            try {
                // 🌟 အပြောင်းအလဲလုပ်ထားသော နေရာ - ဖိုင်တင်မှသာ XLSX ကို Download ဆွဲပါမည် 🌟
                const XLSX = await import('xlsx');

                const binaryData = event.target?.result;
                const workbook = XLSX.read(binaryData, { type: 'binary' });

                let topData: any[] = [];
                let monthlyData: any[] = [];
                let entryData: any[] = [];

                const allSheets = workbook.SheetNames.map(name => ({
                    name,
                    data: XLSX.utils.sheet_to_json(workbook.Sheets[name])
                }));

                for (const sheet of allSheets) {
                    if (sheet.data.length === 0) continue;
                    const keys = Object.keys(sheet.data[0]).join(' ').toLowerCase();

                    if (keys.includes('staff id') && (keys.includes('actual') || keys.includes('1 to'))) {
                        topData = sheet.data;
                    } else if (keys.includes('final pay') || keys.includes('commession') || keys.includes('commission')) {
                        monthlyData = sheet.data;
                    } else if (keys.includes('date') && keys.includes('sales amount')) {
                        entryData = sheet.data;
                    }
                }

                const findSheet = (keywords: string[]) => {
                    const sheetName = workbook.SheetNames.find(s => keywords.some(k => s.toLowerCase().includes(k.toLowerCase())));
                    return sheetName ? XLSX.utils.sheet_to_json(workbook.Sheets[sheetName]) : [];
                };

                if (topData.length === 0) topData = findSheet(['Top Performers', 'Top Performer', 'Top']);
                if (monthlyData.length === 0) monthlyData = findSheet(['Monthly Summary', 'Monthly', 'Summary']);
                if (entryData.length === 0) entryData = findSheet(['Daily Entry', 'Daily', 'Entry']);

                if (topData.length === 0 && monthlyData.length === 0 && allSheets.length >= 3) {
                    entryData = allSheets[0].data;
                    topData = allSheets[1].data;
                    monthlyData = allSheets[2].data;
                }

                if (topData.length === 0 && monthlyData.length === 0) {
            throw new Error("Excel ဖိုင်ထဲတွင် လိုအပ်သော Data များကို ရှာမတွေ့ပါ။ Sheet အမည် သို့မဟုတ် Column ခေါင်းစဉ်များ မှန်ကန်မှုရှိမရှိ စစ်ဆေးပါ။");
        }

        // 🌟 ၁။ Top Performers Data ကို ရှင်းလင်းခြင်း (ဤနေရာတွင် တစ်ကြိမ်သာ ရှိရပါမည်) 🌟
        const normalizedTopData = topData.map((row: any) => {
            const newRow = { ...row };
            const actualKey = Object.keys(row).find(k => k.toLowerCase().includes('actual') && k.toLowerCase().includes('1 to'));
            
            if (actualKey && actualKey !== '1 to 31 Actual') {
                newRow['1 to 31 Actual'] = row[actualKey];
            }
            return newRow;
        });

        // 🌟 ၂။ Excel ထဲက Date များနှင့် Staff ID များကို တိကျစေရန် ရှင်းလင်းခြင်း (Normalization) 🌟
        const normalizedEntryData = entryData.map((row: any) => {
            const newRow = { ...row };
            
            // 🌟 Staff ID များကို ပုံစံညီအောင် အလိုအလျောက် ပြောင်းလဲပေးခြင်း (SGL-001 မှ No-1 သို့) 🌟
            if (newRow['Staff ID']) {
                let sId = String(newRow['Staff ID']).trim();
                // SGL- ပါလာပါက No- သို့ အလိုအလျောက်ပြောင်းပေးမည်
                if (sId.toUpperCase().startsWith('SGL-')) {
                    const numPart = parseInt(sId.split('-')[1], 10);
                    if (!isNaN(numPart)) {
                        sId = "No-" + numPart;
                    }
                }
                newRow['Staff ID'] = sId;
            }

            // Date ပုံစံကို App ကဖတ်တတ်တဲ့ 'YYYY-MM-DD' အဖြစ် ပြောင်းလဲပေးခြင်း
            const rawDate = row['Date'] || row['date'] || row['DATE'];
            if (rawDate) {
                let parsedStr = '';
                if (typeof rawDate === 'number') {
                    const utcDays = Math.floor(rawDate - 25569);
                    const dateObj = new Date(utcDays * 86400 * 1000);
                    parsedStr = dateObj.toISOString().split('T')[0];
                } else if (typeof rawDate === 'string') {
                    const dateObj = new Date(rawDate.trim());
                    if (!isNaN(dateObj.getTime())) {
                        const y = dateObj.getFullYear();
                        const m = String(dateObj.getMonth() + 1).padStart(2, '0');
                        const d = String(dateObj.getDate()).padStart(2, '0');
                        parsedStr = y + "-" + m + "-" + d; // Quote အမှားမဖြစ်စေရန် String ပေါင်းနည်းသုံးထားပါသည်
                    } else {
                        parsedStr = rawDate.trim();
                    }
                }
                newRow.ParsedDate = parsedStr; 
                newRow.Date = parsedStr; // 🌟 ဤစာကြောင်း မဖြစ်မနေ ပါရပါမည် 🌟
            }
            return newRow;
        });

        // 🌟 ၃။ Excel ရဲ့ Top Performers Sheet ထဲက Comparison Data 4 ခုကို တိတိကျကျ သိမ်းဆည်းခြင်း 🌟
        const topPerformersSheet = workbook.Sheets['Top Performers'];

        const readCellNumber = (address: string, fallback = 0) => {
            const cell = topPerformersSheet?.[address];
            const value = cell?.v;
            if (typeof value === 'number' && Number.isFinite(value)) return value;
            const parsed = Number(String(value ?? '').replace(/,/g, '').trim());
            return Number.isFinite(parsed) ? parsed : fallback;
        };

        const excelI24 = readCellNumber('I24');
        const excelI25 = readCellNumber('I25');
        const excelI26 = readCellNumber('I26');
        const excelI27 = readCellNumber('I27');
        const excelI28 = readCellNumber('I28');
        const excelJ28 = readCellNumber('J28');
        const excelI30 = readCellNumber('I30');
        const excelI31 = readCellNumber('I31', excelI25);

        const comparisonData = {
            upToToday: { lastMonth: excelI24, thisMonth: excelI25, difference: readCellNumber('J24', excelI25 - excelI24) },
            yesterday: { lastMonth: excelI27, thisMonth: excelI26, difference: readCellNumber('J26', excelI26 - excelI27) },
            target: { actual: excelI28, target: readCellNumber('I29', excelI28 * (1 + excelJ28)), growthPercent: excelJ28 * 100 },
            fullMonth: { lastMonth: excelI30, thisMonth: excelI31, difference: readCellNumber('J30', excelI31 - excelI30) }
        };

        const validUploadDates = normalizedEntryData
            .map((row: any) => String(row.ParsedDate || row.Date || '').trim())
            .filter((date: string) => /^\d{4}-\d{2}-\d{2}$/.test(date))
            .sort();
        const reportDateStr = validUploadDates[validUploadDates.length - 1] || getLocalTodayStr();
        const [reportYear, reportMonth] = reportDateStr.split('-').map(Number);
        const reportDate = new Date(reportYear, reportMonth - 1, 1);
        const previousMonthDate = new Date(reportYear, reportMonth - 2, 1);
        const thisMonthName = reportDate.toLocaleString('en-US', { month: 'long' }).toUpperCase();
        const previousMonthName = previousMonthDate.toLocaleString('en-US', { month: 'long' }).toUpperCase();

        await setDoc(doc(db, 'settings', 'matrixData'), {
            topPerformers: normalizedTopData,
            monthlySummary: monthlyData,
            dailyEntries: normalizedEntryData,
            comparisonData,
            comparisonMeta: { thisMonthName, previousMonthName, reportDate: reportDateStr },
            lastUpdated: Date.now()
        }, { merge: true });

                alert("✅ Excel Data များကို အောင်မြင်စွာ Upload တင်ပြီးပါပြီ။");
                setSavingCategory(null);
            } catch (innerErr: any) {
                console.error("Processing Error:", innerErr);
                alert(`ဖိုင်အချက်အလက် စီမံရာတွင် အမှားရှိနေပါသည်: ${innerErr.message}`);
                setSavingCategory(null);
            }
        };

        reader.onerror = (err) => {
            console.error("FileReader Error:", err);
            alert("Excel ဖိုင်ကို ဖတ်ရှု၍ မရပါ။ ဖိုင်ပျက်နေခြင်း သို့မဟုတ် ပုံစံမမှန်ခြင်း ဖြစ်နိုင်ပါသည်။");
            setSavingCategory(null);
        };

        reader.readAsBinaryString(file);
        
    } catch (error: any) {
        console.error("Excel Upload Error:", error);
        alert(`Excel ဖိုင် ဖတ်ရာတွင် အခက်အခဲရှိနေပါသည်။\nအကြောင်းရင်း: ${error.message}`);
        setSavingCategory(null);
    } finally {
        e.target.value = '';
    }
};
  
  const [newSecretKey, setNewSecretKey] = useState('');
  const [migratingKey, setMigratingKey] = useState(false);

  const [expandedSection, setExpandedSection] = useState<string | null>(null);
  const toggleSection = (sec: string) => setExpandedSection(prev => prev === sec ? null : sec);

  useEffect(() => { const fetchInstallSteps = async () => { try { const snap = await getDoc(doc(db, 'settings', 'appData')); if (snap.exists() && snap.data().installSteps) { setLocalInstallSteps(snap.data().installSteps); } } catch (e) { console.error(e); } }; fetchInstallSteps(); }, []);

  const handleChangeSecretKey = async () => {
      if(!newSecretKey) return alert("Key အသစ် ရိုက်ထည့်ပါ");
      if(newSecretKey.length < 10) return alert("Key အသစ်သည် အနည်းဆုံး စာလုံး ၁၀ လုံးရှိရပါမည်");
      if(!window.confirm("သတိပြုရန်: ဤလုပ်ဆောင်ချက်သည် Database တစ်ခုလုံးရှိ Data များကို Key အသစ်ဖြင့် ပြောင်းလဲမည်ဖြစ်ပါသည်။ သေချာပါသလား?")) return;
      setMigratingKey(true);
      try {
          const reEncrypt = (oldCipher: string) => { if(!oldCipher || !oldCipher.startsWith('U2FsdGVk')) return oldCipher; try { const bytes = CryptoJS.AES.decrypt(oldCipher, import.meta.env.VITE_SECRET_KEY); const originalText = bytes.toString(CryptoJS.enc.Utf8); if(!originalText) return oldCipher; return CryptoJS.AES.encrypt(originalText, newSecretKey).toString(); } catch(e) { return oldCipher; } };
          const uSnap = await getDocs(collection(db, 'users')); const uPromises: any[] = []; uSnap.forEach(d => { const raw = d.data(); uPromises.push(updateDoc(doc(db, 'users', d.id), { name: reEncrypt(raw.name), phone: reEncrypt(raw.phone), password: reEncrypt(raw.password), points: reEncrypt(raw.points), dob: reEncrypt(raw.dob) })); }); await Promise.all(uPromises);
          const bSnap = await getDocs(collection(db, 'bookings')); const bPromises: any[] = []; bSnap.forEach(d => { const raw = d.data(); bPromises.push(updateDoc(doc(db, 'bookings', d.id), { name: reEncrypt(raw.name), phone: reEncrypt(raw.phone), txId: reEncrypt(raw.txId), specialRequest: reEncrypt(raw.specialRequest) })); }); await Promise.all(bPromises);
          const aSnap = await getDocs(collection(db, 'admins')); const aPromises: any[] = []; aSnap.forEach(d => { const raw = d.data(); aPromises.push(updateDoc(doc(db, 'admins', d.id), { username: reEncrypt(raw.username), password: reEncrypt(raw.password) })); }); await Promise.all(aPromises);
          const tPromises: any[] = []; localTherapists.forEach(t => { tPromises.push(updateDoc(doc(db, 'therapists', t.id), { password: CryptoJS.AES.encrypt(t.password || '', newSecretKey).toString() })); }); await Promise.all(tPromises);
          alert("Data အားလုံးကို Key အသစ်ဖြင့် အောင်မြင်စွာ ပြောင်းလဲပြီးပါပြီ။ Vercel တွင် Key အသစ်သွားထည့်ပြီး Redeploy ပြုလုပ်ပါ။");
      } catch(e) { console.error(e); alert("Error updating keys"); }
      setMigratingKey(false);
  };

  const handleSaveVipSettings = async () => {
    if (!window.confirm(`Are you sure you want to save VIP Program settings?`)) return;
    setSavingCategory('vip_settings');
    try { await setDoc(doc(db, 'settings', 'appData'), { vipSettings: localVipSettings }, { merge: true }); onSettingsUpdated({ ...appData, vipSettings: localVipSettings }); alert('VIP Membership Program saved successfully.'); } catch (e) { alert('Update error.'); } setSavingCategory(null);
  };

  const updateVipTier = (tIdx: number, field: string, val: any) => { const updated = [...localVipSettings.tiers]; (updated[tIdx] as any)[field] = val; setLocalVipSettings({...localVipSettings, tiers: updated}); };
  const updateVipRule = (rIdx: number, val: string) => { const updated = [...localVipSettings.rules]; updated[rIdx] = val; setLocalVipSettings({...localVipSettings, rules: updated}); };

  // 🌟 FIX 2: invalid-argument Error မတက်စေရန် Data များကို အတိအကျ သန့်စင်ခြင်း (Strict Casting) 🌟
  const handleSaveCategory = async (cIdx: number) => {
      const cat = localCategories[cIdx];
      if (!window.confirm(`Are you sure you want to save ${cat.title}?`)) return;
      setSavingCategory(cat.id);

      try {
          const cleanItems = cat.items.map((item: any) => {
              // ပုံဟောင်းနှင့် ပုံသစ်များကို Array ထဲသို့ သေချာစုစည်းမည်
              let imgs = Array.isArray(item.images) ? item.images : (item.imageUrl ? [item.imageUrl] : []);
              imgs = imgs.filter(Boolean); // Error မဖြစ်စေရန် အလွတ်များကို ဖယ်ထုတ်မည်

              // Database က လက်ခံမည့် Format အတိုင်း undefined များကို ဖယ်ရှားပြီး အတိအကျ ပြောင်းလဲမည်
              return {
                  id: String(item.id || Date.now()),
                  name: String(item.name || ''),
                  duration: String(item.duration || ''),
                  price: Number(item.price) || 0,
                  vvipPrice: Number(item.vvipPrice) || 0,
                  vvipIncluded: Boolean(item.vvipIncluded),
                  description: String(item.description || ''),
                  images: imgs
              };
          });

          const categoryToSave = { 
              id: String(cat.id), 
              title: String(cat.title), 
              order: Number(cIdx), 
              items: cleanItems 
          };

          // 1MB Limit ကျော်လွန်ခြင်း ရှိမရှိ စစ်ဆေးမည်
          const payloadSizeKB = Math.round(JSON.stringify(categoryToSave).length / 1024);
          if (payloadSizeKB > 900) {
              alert(`⚠️ Error: ပုံများ များလွန်းသဖြင့် Document Size ကြီးနေပါသည်။ (${payloadSizeKB} KB). \n\nကျေးဇူးပြု၍ မလိုအပ်သောပုံအချို့ကို ဖျက်ပြီးမှ ပြန် Save ပါ။`);
              setSavingCategory(null);
              return;
          }

          // Database သို့ သိမ်းဆည်းခြင်း
          await setDoc(doc(db, 'categories', cat.id), categoryToSave, { merge: true });

          const nextCategories = [...localCategories];
          nextCategories[cIdx] = categoryToSave;
          setLocalCategories(nextCategories);
          
          // အခြားနေရာများတွင် ပေါ့ပါးစေရန် images အလွတ်ဖြင့်သာ Global State ကို Update လုပ်မည်
          const leanCategoriesForGlobal = nextCategories.map(c => ({
              ...c,
              items: c.items.map(i => ({ ...i, images: [], imageUrl: '' }))
          }));
          onSettingsUpdated({ ...appData, categories: leanCategoriesForGlobal });

          alert('✅ Saved Successfully. Category and Service Images are saved!');
      } catch (e: any) {
          console.error('Service Category Save Error:', e);
          alert(`Update error.\n\n${e?.code || e?.message || 'Unknown Firebase error'}`);
      } finally {
          setSavingCategory(null);
      }
  };

  const handleSavePromotion = async () => { if (!window.confirm(`Are you sure you want to save promotion settings?`)) return; setSavingCategory('promotion'); try { await setDoc(doc(db, 'settings', 'appData'), { promotion: localPromotion }, { merge: true }); onSettingsUpdated({ ...appData, promotion: localPromotion }); alert('Promotion settings saved successfully.'); } catch (e) { alert('Update error.'); } setSavingCategory(null); };
                                                                                                                                                                                                            
  const handleSaveBranding = async () => { if (!window.confirm(`Are you sure you want to save branding settings?`)) return; setSavingCategory('branding'); try { await setDoc(doc(db, 'settings', 'appData'), { branding: localBranding }, { merge: true }); onSettingsUpdated({ ...appData, branding: localBranding }); alert('Branding saved successfully.'); } catch (e) { alert('Update error.'); } setSavingCategory(null); };
  const handleSavePayments = async () => { if (!window.confirm(`Are you sure you want to save payment methods?`)) return; setSavingCategory('payments'); try { await setDoc(doc(db, 'settings', 'appData'), { paymentMethods: localPaymentMethods }, { merge: true }); onSettingsUpdated({ ...appData, paymentMethods: localPaymentMethods }); alert('Payment methods saved successfully.'); } catch (e) { alert('Update error.'); } setSavingCategory(null); };
  const handleSaveInstallSteps = async () => { if (!window.confirm(`Are you sure you want to save Install Instructions?`)) return; setSavingCategory('install_steps'); try { await setDoc(doc(db, 'settings', 'appData'), { installSteps: localInstallSteps }, { merge: true }); onSettingsUpdated({ ...appData, installSteps: localInstallSteps }); alert('Install Instructions saved successfully.'); } catch (e) { alert('Update error.'); } setSavingCategory(null); };
  const handleSaveSignUpBonus = async () => { 
      if (!window.confirm(`Are you sure you want to save Welcome Bonus settings?`)) return; 
      setSavingCategory('signup_bonus'); 
      try { 
          await setDoc(doc(db, 'settings', 'appData'), { signUpBonus: localSignUpBonus }, { merge: true }); 
          onSettingsUpdated({ ...appData, signUpBonus: localSignUpBonus }); 
          alert('Welcome Bonus settings saved successfully.'); 
      } catch (e) { alert('Update error.'); } 
      setSavingCategory(null); 
  };
const handleSaveTherapists = async () => {
        setSavingCategory('therapists');
        try {
            const batch = writeBatch(db);
            
            deletedTherapistIds.forEach(id => {
                if(id) batch.delete(doc(db, 'therapists', id));
            });

            // "တစ္ဆေ Data (Ghosts)" များကို Auto ရှင်းထုတ်မည်
            const uniqueTherapistsMap = new Map();
            for (const t of localTherapists) {
                if (uniqueTherapistsMap.has(t.name)) {
                    if (!t.id.startsWith('t_') && !t.id.startsWith('new_')) {
                        uniqueTherapistsMap.set(t.name, t);
                    }
                } else {
                    uniqueTherapistsMap.set(t.name, t);
                }
            }
            const cleanTherapists = Array.from(uniqueTherapistsMap.values());

            const finalTherapistsToSync: any[] = [];
            
            for (let i = 0; i < cleanTherapists.length; i++) {
                const t = cleanTherapists[i];
                const isNew = t.id.startsWith('new_') || t.id.startsWith('t_'); 
                const finalId = isNew ? `therapist_${Date.now()}_${i}` : t.id;
                const tRef = doc(db, 'therapists', finalId);
                
                if (t.password && t.password.length >= 6 && isNew) {
                    try { await createUserWithEmailAndPassword(secondaryAuth, `${finalId.toLowerCase()}@shangrila.com`, t.password); } catch (authErr: any) {}
                }

                // HD ပုံ ၅ ပုံလုံးကို ဝန်ထမ်းတစ်ဦးချင်းစီ၏ ကိုယ်ပိုင်ဖိုင် (tRef) ထဲတွင်သာ လုံခြုံစွာသိမ်းမည်
                const updatedT = JSON.parse(JSON.stringify({ 
                    ...t, id: finalId, order: i, password: isNew ? "SECURED_ACCOUNT" : (t.password || "SECURED_ACCOUNT")
                }));
                
                batch.set(tRef, updatedT, { merge: true });
                finalTherapistsToSync.push(updatedT);
            }
            
            // 🌟 MASTER FIX: 1MB ပြည့်နေသော appData ဖိုင်ကြီးထဲမှ Therapist ပုံများကို ရှင်းထုတ်လိုက်မည် 🌟
            // ဤသို့လုပ်ခြင်းဖြင့် 1MB Limit ပြဿနာ အပြီးတိုင် ပျောက်ကင်းသွားပါမည်
            batch.set(doc(db, 'settings', 'appData'), { therapists: [] }, { merge: true });
            
            await batch.commit();
            
            setLocalTherapists(finalTherapistsToSync);
            setDeletedTherapistIds([]);
            alert('✅ Therapists saved successfully! Database architecture upgraded for HD Gallery.');
        } catch (error: any) { 
            console.error(error); alert('Error saving therapists: ' + error.message); 
        }
        setSavingCategory(null);
  };
   
  // 🌟 FIX: Storage ကို လုံးဝဖြုတ်ပြီး Base64 ကိုသာ ပြန်သုံးမည် 🌟
  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => { const file = e.target.files?.[0]; if (!file) return; setUploadingImage('logo'); try { const base64 = await compressImage(file, 300, 300); setLocalBranding({ ...localBranding, logoUrl: base64 }); } catch (err) { alert("Error uploading image"); } setUploadingImage(null); };
  const handlePaymentLogoUpload = async (idx: number, e: React.ChangeEvent<HTMLInputElement>) => { const file = e.target.files?.[0]; if (!file) return; setUploadingImage(`pay_${idx}`); try { const base64 = await compressImage(file, 200, 200); const updated = [...localPaymentMethods]; updated[idx].logoUrl = base64; setLocalPaymentMethods(updated); } catch (err) { alert("Error uploading image"); } setUploadingImage(null); };
  const handleInstallImageUpload = async (idx: number, e: React.ChangeEvent<HTMLInputElement>) => { const file = e.target.files?.[0]; if (!file) return; setUploadingImage(`install_${idx}`); try { const base64 = await compressImage(file, 300, 600); const updated = [...localInstallSteps]; updated[idx].imageUrl = base64; setLocalInstallSteps(updated); } catch (err) { alert("Error uploading image"); } setUploadingImage(null); };

  const handleImageUpload = async (tIdx: number, files: FileList | null) => { 
      if (!files || files.length === 0) return; const therapist = localTherapists[tIdx]; if (therapist.images.length + files.length > 5) { alert('Max 5 photos allowed.'); return; } setUploadingImage(therapist.id); const newUrls: string[] = []; 
      try { 
          for (let i = 0; i < files.length; i++) { 
              // Upload လုပ်ကတည်းက HD Quality (800px) ဖြင့် သိမ်းမည်
              const base64 = await compressImage(files[i], 800, 1000); 
              newUrls.push(base64); 
          } 
          const updated = [...localTherapists]; updated[tIdx].images = [...updated[tIdx].images, ...newUrls]; setLocalTherapists(updated); 
      } catch (err) { alert("Upload error."); } setUploadingImage(null); 
  };

  // FREE VERSION: Service images use the same local Base64 approach as the working
  // Therapist upload. Firebase Storage is intentionally NOT used here.
  // The compressed image is placed directly into item.imageUrl, and handleSaveCategory()
  // persists it to Firestore. Existing imageUrl values are preserved when editing.
   
  // 🌟 FIX 1: 1MB Limit မကျော်စေရန် HD Quality ဖြင့် Service ပုံများကို Array အဖြစ် တင်မည့်စနစ် 🌟
  const handleServiceImageUpload = async (cIdx: number, iIdx: number, files: FileList | null) => { 
      if (!files || files.length === 0) return; 
      
      const category = localCategories[cIdx];
      const item = category.items[iIdx];
      const currentImages = Array.isArray(item.images) ? item.images : (item.imageUrl ? [item.imageUrl] : []);
      
      if (currentImages.length + files.length > 5) { 
          alert('Max 5 photos allowed per service.'); 
          return; 
      } 
      
      setUploadingImage(`service_${cIdx}_${iIdx}`); 
      const newUrls: string[] = []; 
      
      try { 
          for (let i = 0; i < files.length; i++) { 
              const file = files[i];
              // 1MB Limit အတွက် ပုံအရွယ်အစားနှင့် Quality ကို အတိအကျ ထိန်းညှိခြင်း
              const base64 = await new Promise<string>((resolve, reject) => {
                  const reader = new FileReader();
                  reader.onload = (e) => {
                      const img = new Image();
                      img.onload = () => {
                          const canvas = document.createElement('canvas');
                          const MAX_DIM = 600; // 600px ဖြင့် HD Quality ရရှိစေရန်
                          let w = img.width; let h = img.height;
                          if (w > h) { if (w > MAX_DIM) { h *= MAX_DIM / w; w = MAX_DIM; } }
                          else { if (h > MAX_DIM) { w *= MAX_DIM / h; h = MAX_DIM; } }
                          
                          canvas.width = Math.round(w); 
                          canvas.height = Math.round(h);
                          const ctx = canvas.getContext('2d');
                          if (ctx) {
                              ctx.fillStyle = '#FFF'; 
                              ctx.fillRect(0, 0, canvas.width, canvas.height);
                              ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                              // 0.65 Quality သည် ကြည်လင်မှုကို မထိခိုက်စေဘဲ Size ကို သေးငယ်စေပါသည်
                              resolve(canvas.toDataURL('image/jpeg', 0.65)); 
                          } else {
                              resolve(e.target?.result as string);
                          }
                      };
                      img.onerror = reject;
                      img.src = e.target?.result as string;
                  };
                  reader.onerror = reject;
                  reader.readAsDataURL(file);
              });
              newUrls.push(base64); 
          } 
          
          const updated = [...localCategories];
          updated[cIdx].items[iIdx] = { ...item, images: [...currentImages, ...newUrls] };
          delete updated[cIdx].items[iIdx].imageUrl; 
          setLocalCategories(updated); 
          
      } catch (err) { 
          console.error(err); alert("Upload error."); 
      } 
      setUploadingImage(null); 
  };

  const addTherapist = () => setLocalTherapists([...localTherapists, { id: `new_t_${Date.now()}`, name: 'New Therapist', images: [], order: localTherapists.length, password: '' }]);
  const updateTherapist = (tIdx: number, field: keyof TherapistProfile, val: any) => { const updated = [...localTherapists]; updated[tIdx] = { ...updated[tIdx], [field]: val }; setLocalTherapists(updated); };
  const removeTherapist = (tIdx: number) => { if (!window.confirm("Are you sure you want to delete this therapist?")) return; const t = localTherapists[tIdx]; if (t.id && !t.id.startsWith('new_')) setDeletedTherapistIds([...deletedTherapistIds, t.id]); const updated = [...localTherapists]; updated.splice(tIdx, 1); setLocalTherapists(updated); };
  const moveTherapistUp = (tIdx: number) => { if (tIdx === 0) return; const updated = [...localTherapists]; const temp = updated[tIdx - 1]; updated[tIdx - 1] = updated[tIdx]; updated[tIdx] = temp; setLocalTherapists(updated); };
  const moveTherapistDown = (tIdx: number) => { if (tIdx === localTherapists.length - 1) return; const updated = [...localTherapists]; const temp = updated[tIdx + 1]; updated[tIdx + 1] = updated[tIdx]; updated[tIdx] = temp; setLocalTherapists(updated); };
  const removeImage = (tIdx: number, imgIdx: number) => { const updated = [...localTherapists]; updated[tIdx].images.splice(imgIdx, 1); setLocalTherapists(updated); };
  const updateItem = (cIdx: number, iIdx: number, field: string, val: any) => { const updated = [...localCategories]; (updated[cIdx].items[iIdx] as any)[field] = val; setLocalCategories(updated); };
  
  // 🌟 FIX: Add Item နှိပ်လျှင် images: [] အလိုလိုပါသွားရန် 🌟
  const addItem = (cIdx: number) => { 
      const updated = [...localCategories]; 
      updated[cIdx].items.push({ id: Date.now().toString(), name: 'New Service', price: 0, duration: '60 Mins', vvipIncluded: false, images: [] }); 
      setLocalCategories(updated); 
  };
  
  const deleteItem = (cIdx: number, iIdx: number) => { if (!window.confirm("Are you sure?")) return; const updated = [...localCategories]; updated[cIdx].items.splice(iIdx, 1); setLocalCategories(updated); };
  const updatePaymentMethod = (pIdx: number, field: string, val: string) => { const updated = [...localPaymentMethods]; (updated[pIdx] as any)[field] = val; setLocalPaymentMethods(updated); };
  const addPaymentMethod = () => { setLocalPaymentMethods([...localPaymentMethods, { id: `p_${Date.now()}`, name: 'New Payment', accountNumber: '', accountName: '', logoUrl: '' }]); };
  const removePaymentMethod = (pIdx: number) => { if (!window.confirm("Are you sure?")) return; const updated = [...localPaymentMethods]; updated.splice(pIdx, 1); setLocalPaymentMethods(updated); };

  return (
     
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200 mt-6 border-l-4 border-l-[#D4AF37]">
         <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
               <h3 className="text-xl font-bold text-gray-800 flex items-center"><Award className="w-5 h-5 mr-2 text-[#D4AF37]" /> VIP Program Customization</h3>
               <p className="text-xs text-gray-500 mt-1">Customer App တွင်ပြသမည့် VIP အချက်အလက်များအားလုံးကို ဤနေရာတွင် ပြင်ဆင်နိုင်ပါသည်။</p>
            </div>
            <button onClick={() => toggleSection('vip')} className="flex items-center text-sm bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2 rounded-lg font-bold transition whitespace-nowrap">
               {expandedSection === 'vip' ? <><ChevronUp className="w-4 h-4 mr-2" /> Close</> : <><Edit className="w-4 h-4 mr-2" /> Edit this Section</>}
            </button>
         </div>
         
         {expandedSection === 'vip' && (
             <div className="mt-6 pt-6 border-t border-gray-100 animate-fade-in">
                 <div className="flex justify-end mb-6">
                     <button disabled={savingCategory === 'vip_settings'} onClick={handleSaveVipSettings} className="flex items-center bg-[#123524] text-[#D4AF37] px-4 py-2 rounded-lg font-bold shadow-md hover:opacity-90 flex-shrink-0">
                        <Save className="w-4 h-4 mr-2" /> {savingCategory === 'vip_settings' ? 'Saving...' : 'Save VIP Program'}
                     </button>
                 </div>

                 <div className="flex items-center space-x-3 mb-6 bg-gray-50 p-3 rounded-lg border border-gray-200 w-fit">
                     <label className="text-sm font-bold text-gray-700 cursor-pointer flex items-center">
                         <input type="checkbox" checked={localVipSettings.isActive} onChange={(e) => setLocalVipSettings({...localVipSettings, isActive: e.target.checked})} className="w-5 h-5 accent-[#123524] mr-3" />
                         Enable VIP Program (Home Page တွင် VIP Tab ကို ဖွင့်ထားမည်)
                     </label>
                 </div>

                 <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
                     <div>
                         <h4 className="font-bold text-sm text-[#123524] mb-4 flex items-center"><Star className="w-4 h-4 mr-2"/> 1. Membership Tiers & Base Rule</h4>
                         <div className="mb-4 bg-gray-50 p-4 rounded-lg border border-gray-200">
                             <label className="block text-[10px] font-bold text-gray-500 mb-1">Base Rule Text (အခြေခံ ပွိုင့်သတ်မှတ်ချက်)</label>
                             <input type="text" value={localVipSettings.baseRuleText} onChange={(e) => setLocalVipSettings({...localVipSettings, baseRuleText: e.target.value})} className="w-full p-2 text-sm border border-gray-300 rounded focus:border-[#D4AF37] outline-none font-semibold text-gray-700" />
                         </div>
                         <div className="space-y-3">
                             {localVipSettings.tiers.map((tier: any, tIdx: number) => (
                                 <div key={tier.id} className="p-4 bg-gray-50 border border-gray-200 rounded-lg shadow-sm">
                                     <div className="grid grid-cols-2 gap-3 mb-2">
                                         <div><label className="text-[10px] font-bold text-gray-400">Tier Name</label><input type="text" value={tier.name} onChange={(e) => updateVipTier(tIdx, 'name', e.target.value)} className="w-full p-2 text-sm border rounded focus:border-[#D4AF37] outline-none font-bold" /></div>
                                         <div><label className="text-[10px] font-bold text-gray-400">Card Color Code</label><input type="text" value={tier.colorTheme} onChange={(e) => updateVipTier(tIdx, 'colorTheme', e.target.value)} className="w-full p-2 text-sm border rounded focus:border-[#D4AF37] outline-none" placeholder="#HEXCODE" /></div>
                                     </div>
                                     <div className="grid grid-cols-3 gap-3">
                                         <div><label className="text-[10px] font-bold text-gray-400">Required Points</label><input type="number" value={tier.requiredPoints} onChange={(e) => updateVipTier(tIdx, 'requiredPoints', Number(e.target.value))} className="w-full p-2 text-sm border rounded focus:border-[#D4AF37] outline-none" /></div>
                                         <div><label className="text-[10px] font-bold text-gray-400">Discount (%)</label><input type="number" value={tier.discountPercent} onChange={(e) => updateVipTier(tIdx, 'discountPercent', Number(e.target.value))} className="w-full p-2 text-sm border rounded focus:border-[#D4AF37] outline-none text-red-600 font-bold" /></div>
                                         <div><label className="text-[10px] font-bold text-gray-400">Instant Upgrade Amt</label><input type="text" value={tier.instantUpgrade || ''} onChange={(e) => updateVipTier(tIdx, 'instantUpgrade', e.target.value)} className="w-full p-2 text-sm border rounded focus:border-[#D4AF37] outline-none text-blue-600 font-bold" placeholder="ဥပမာ - ၈ သိန်းကျပ်" /></div>
                                     </div>
                                 </div>
                             ))}
                         </div>
                     </div>

                     <div>
                         <h4 className="font-bold text-sm text-[#123524] mb-4 flex items-center"><Target className="w-4 h-4 mr-2"/> 2. Target Rewards (Pre-Jade)</h4>
                         <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                             <label className="block text-[10px] font-bold text-gray-500 mb-1">Section Description (ရှင်းလင်းချက်)</label>
                             <textarea value={localVipSettings.preJadeText} onChange={(e) => setLocalVipSettings({...localVipSettings, preJadeText: e.target.value})} rows={3} className="w-full p-2 text-sm border border-gray-300 rounded focus:border-[#D4AF37] outline-none font-semibold text-gray-700" />
                             
                             <label className="block text-[10px] font-bold text-gray-500 mt-4 mb-2">Reward Steps (ဥပမာ - 10 Pts = 10% Off)</label>
                             <div className="space-y-2">
                                 {(localVipSettings.preJadeRewards || []).map((reward: string, rIdx: number) => (
                                     <div key={rIdx} className="flex space-x-2">
                                         <input type="text" value={reward} onChange={(e) => { const newR = [...localVipSettings.preJadeRewards]; newR[rIdx] = e.target.value; setLocalVipSettings({...localVipSettings, preJadeRewards: newR}); }} className="w-full p-2 text-sm border border-gray-300 rounded focus:border-[#D4AF37] outline-none font-semibold text-gray-700" />
                                         <button onClick={() => setLocalVipSettings({...localVipSettings, preJadeRewards: localVipSettings.preJadeRewards.filter((_: any, i: number) => i !== rIdx)})} className="p-2 bg-red-50 text-red-500 rounded hover:bg-red-100"><Trash2 className="w-4 h-4"/></button>
                                     </div>
                                 ))}
                                 <button onClick={() => setLocalVipSettings({...localVipSettings, preJadeRewards: [...localVipSettings.preJadeRewards, 'New Reward']})} className="text-xs font-bold bg-white border border-gray-300 px-3 py-2 rounded hover:bg-gray-100 flex items-center mt-2"><PlusCircle className="w-3 h-3 mr-1"/> Add Reward Step</button>
                             </div>
                         </div>
                     </div>
                 </div>

                 <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8 border-t border-gray-100 pt-8">
                     <div>
                         <h4 className="font-bold text-sm text-[#123524] mb-4 flex items-center"><Info className="w-4 h-4 mr-2"/> 3. Upgrade Rules (အဆင့်မြှင့်တင်ခြင်း)</h4>
                         <div className="space-y-4 bg-gray-50 p-4 rounded-lg border border-gray-200">
                             <div>
                                 <label className="block text-[10px] font-bold text-gray-500 mb-1">Cumulative Upgrade System Text</label>
                                 <textarea value={localVipSettings.cumulativeText} onChange={(e) => setLocalVipSettings({...localVipSettings, cumulativeText: e.target.value})} rows={4} className="w-full p-2 text-sm border border-gray-300 rounded focus:border-[#D4AF37] outline-none font-semibold text-gray-700" />
                             </div>
                             <div>
                                 <label className="block text-[10px] font-bold text-gray-500 mb-1">Instant Upgrade Alert Text (တစ်ကြိမ်တည်းဝယ်ယူမှု...)</label>
                                 <textarea value={localVipSettings.instantUpgradeText} onChange={(e) => setLocalVipSettings({...localVipSettings, instantUpgradeText: e.target.value})} rows={3} className="w-full p-2 text-sm border border-gray-300 rounded focus:border-[#D4AF37] outline-none font-semibold text-gray-700" />
                             </div>
                         </div>
                     </div>

                     <div>
                         <h4 className="font-bold text-sm text-[#123524] mb-4 flex items-center"><Gift className="w-4 h-4 mr-2"/> 4. Birthday Bonuses (မွေးနေ့ခံစားခွင့်)</h4>
                         <div className="space-y-4 bg-gray-50 p-4 rounded-lg border border-gray-200">
                             <div>
                                 <label className="block text-[10px] font-bold text-gray-500 mb-1">Standard Birthday Bonus Text</label>
                                 <textarea value={localVipSettings.birthdayStandardText} onChange={(e) => setLocalVipSettings({...localVipSettings, birthdayStandardText: e.target.value})} rows={3} className="w-full p-2 text-sm border border-gray-300 rounded focus:border-[#D4AF37] outline-none font-semibold text-gray-700" />
                             </div>
                             <div>
                                 <label className="block text-[10px] font-bold text-gray-500 mb-1">Imperial V-VIP Birthday Bonus Text</label>
                                 <textarea value={localVipSettings.birthdayImperialText} onChange={(e) => setLocalVipSettings({...localVipSettings, birthdayImperialText: e.target.value})} rows={3} className="w-full p-2 text-sm border border-gray-300 rounded focus:border-[#D4AF37] outline-none font-semibold text-gray-700" />
                             </div>
                         </div>
                     </div>
                 </div>

                 <div className="border-t border-gray-100 pt-8">
                     <h4 className="font-bold text-sm text-[#123524] mb-4 flex items-center"><ShieldCheck className="w-4 h-4 mr-2"/> 5. Terms & Conditions (စည်းကမ်းချက်များ)</h4>
                     <div className="space-y-3 bg-gray-50 p-4 rounded-lg border border-gray-200">
                         {localVipSettings.rules.map((rule: string, rIdx: number) => (
                             <div key={rIdx} className="flex items-start space-x-2">
                                 <div className="mt-2 text-xs font-bold text-gray-400">{rIdx + 1}.</div>
                                 <textarea value={rule} onChange={(e) => updateVipRule(rIdx, e.target.value)} rows={2} className="w-full p-2 text-sm border border-gray-300 rounded focus:border-[#D4AF37] outline-none leading-relaxed font-semibold text-gray-700" />
                                 <button onClick={() => setLocalVipSettings({...localVipSettings, rules: localVipSettings.rules.filter((_: any, i: number) => i !== rIdx)})} className="p-2 bg-red-50 text-red-500 rounded hover:bg-red-100"><Trash2 className="w-4 h-4"/></button>
                             </div>
                         ))}
                         <button onClick={() => setLocalVipSettings({...localVipSettings, rules: [...localVipSettings.rules, 'စည်းကမ်းချက်အသစ်...']})} className="text-xs font-bold bg-white border border-gray-300 px-3 py-2 rounded hover:bg-gray-100 flex items-center mt-2"><PlusCircle className="w-3 h-3 mr-1"/> Add Rule</button>
                     </div>
                 </div>
             </div>
         )}
      </div>

       <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200 mt-6 border-l-4 border-l-blue-600">
          <h3 className="text-xl font-bold text-gray-800 flex items-center mb-2"><BarChart2 className="w-5 h-5 mr-2 text-blue-600" /> Upload Matrix Database (Excel)</h3>
          <p className="text-xs text-gray-500 mb-4">Staff များ၏ Performance (Top Performers & Visual Charts) ကို ပြသရန် August_Shangri_La_Matrix_Database.xlsx ဖိုင်အား ဤနေရာတွင် တင်ပါ။</p>
          
          <label className="flex items-center justify-center w-full sm:w-auto px-6 py-4 bg-blue-50 text-blue-700 border-2 border-dashed border-blue-300 rounded-xl cursor-pointer hover:bg-blue-100 transition font-bold shadow-sm">
              {savingCategory === 'excel_upload' ? 'Uploading & Parsing Data...' : '📊 Click to Upload Excel File'}
              <input type="file" accept=".xlsx, .xls" className="hidden" onChange={handleExcelUpload} disabled={savingCategory === 'excel_upload'} />
          </label>
      </div>

      <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200 mt-6 border-l-4 border-l-[#123524]">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div>
                  <h3 className="text-xl font-bold text-gray-800 flex items-center"><Settings className="w-5 h-5 mr-2 text-[#123524]" /> App Branding & Footer</h3>
                  <p className="text-xs text-gray-500 mt-1">ဆိုင်၏ လိုဂို၊ အမည်၊ လိပ်စာ၊ ဖုန်းနံပါတ် နှင့် GPS Location များ ပြင်ဆင်ရန်</p>
              </div>
              <button onClick={() => toggleSection('branding')} className="flex items-center text-sm bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2 rounded-lg font-bold transition whitespace-nowrap">
                  {expandedSection === 'branding' ? <><ChevronUp className="w-4 h-4 mr-2" /> Close</> : <><Edit className="w-4 h-4 mr-2" /> Edit this Section</>}
              </button>
          </div>

          {expandedSection === 'branding' && (
              <div className="mt-6 pt-6 border-t border-gray-100 animate-fade-in">
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
                      <div className="flex flex-wrap gap-2">
                          <button type="button" onClick={() => { const url = window.location.origin + window.location.pathname + '?view=therapists'; navigator.clipboard.writeText(url); alert('Gallery Link Copied:\n' + url); }} className="text-xs flex items-center text-blue-600 bg-blue-50 px-3 py-1.5 rounded border border-blue-200 hover:bg-blue-100 transition whitespace-nowrap"><Copy className="w-3 h-3 mr-1"/> Gallery Link</button>
                          <button type="button" onClick={() => { const url = window.location.origin + window.location.pathname + '?view=dashboard'; navigator.clipboard.writeText(url); alert('Dashboard Link Copied:\n' + url); }} className="text-xs flex items-center text-green-600 bg-green-50 px-3 py-1.5 rounded border border-green-200 hover:bg-green-100 transition whitespace-nowrap"><Copy className="w-3 h-3 mr-1"/> Dashboard Link</button>
                          <button type="button" onClick={() => { const url = window.location.origin + window.location.pathname + '?mode=staff'; navigator.clipboard.writeText(url); alert('Staff Portal Link Copied:\n' + url); }} className="text-xs flex items-center text-purple-600 bg-purple-50 px-3 py-1.5 rounded border border-purple-200 hover:bg-purple-100 transition whitespace-nowrap mt-2 sm:mt-0 sm:ml-2"><Copy className="w-3 h-3 mr-1"/> Staff Link</button>
                          <button type="button" onClick={() => { const url = window.location.origin + window.location.pathname + '?view=vip'; navigator.clipboard.writeText(url); alert('VIP Member Link Copied:\n' + url); }} className="text-xs flex items-center text-yellow-600 bg-yellow-50 px-3 py-1.5 rounded border border-yellow-200 hover:bg-yellow-100 transition whitespace-nowrap mt-2 sm:mt-0 sm:ml-2"><Copy className="w-3 h-3 mr-1"/> VIP Member Link</button>
                          <button type="button" onClick={() => { const url = window.location.origin + window.location.pathname + '?view=profile'; navigator.clipboard.writeText(url); alert('Profile Link Copied:\n' + url); }} className="text-xs flex items-center text-indigo-600 bg-indigo-50 px-3 py-1.5 rounded border border-indigo-200 hover:bg-indigo-100 transition whitespace-nowrap mt-2 sm:mt-0 sm:ml-2"><Copy className="w-3 h-3 mr-1"/> Profile Link</button>
                      </div>
                      <button disabled={savingCategory === 'branding'} onClick={handleSaveBranding} className="flex items-center bg-[#123524] text-white px-4 py-2 rounded-lg font-bold shadow-md hover:opacity-90 flex-shrink-0">
                          <Save className="w-4 h-4 mr-2" /> {savingCategory === 'branding' ? 'Saving...' : 'Save'}
                      </button>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="border border-gray-200 rounded-xl p-4 bg-gray-50 flex flex-col items-center justify-center">
                          <label className="block text-xs font-bold text-gray-500 mb-4 text-center w-full">Header Logo Image (Circle Format)</label>
                          <div className="w-28 h-28 bg-white border-2 border-dashed border-gray-300 rounded-full flex items-center justify-center relative overflow-hidden mb-4 shadow-sm group">
                              {localBranding.logoUrl ? (
                                  <><img src={localBranding.logoUrl} alt="Logo Preview" className="w-full h-full object-cover" /><div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"><button onClick={() => setLocalBranding({ ...localBranding, logoUrl: '' })} className="bg-red-500 text-white p-2 rounded-full hover:bg-red-600"><Trash2 className="w-4 h-4" /></button></div></>
                              ) : (
                                  <div className="flex flex-col items-center text-gray-400">{uploadingImage === 'logo' ? <div className="text-xs font-bold animate-pulse">Uploading...</div> : "No Logo"}</div>
                              )}
                          </div>
                          <label className="bg-white border border-gray-300 text-gray-700 px-4 py-2 rounded-lg text-sm font-bold cursor-pointer hover:bg-gray-100 transition shadow-sm">{localBranding.logoUrl ? 'Change Logo' : 'Upload Logo'}<input type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} disabled={uploadingImage === 'logo'} /></label>
                      </div>
                      <div className="space-y-4">
                          <div><label className="block text-xs font-bold text-gray-500 mb-1">Business Name</label><input type="text" value={localBranding.name || ''} onChange={e => setLocalBranding({ ...localBranding, name: e.target.value })} className="w-full p-2 text-sm border border-gray-300 rounded focus:border-[#D4AF37] outline-none" /></div>
                          <div><label className="block text-xs font-bold text-gray-500 mb-1">Address</label><textarea value={localBranding.address} onChange={e => setLocalBranding({ ...localBranding, address: e.target.value })} className="w-full p-2 text-sm border border-gray-300 rounded focus:border-[#D4AF37] outline-none" rows={2} /></div>
                          <div className="grid grid-cols-2 gap-2">
                              <div><label className="block text-xs font-bold text-gray-500 mb-1">Phone 1</label><input type="text" value={localBranding.phone1} onChange={e => setLocalBranding({ ...localBranding, phone1: e.target.value })} className="w-full p-2 text-sm border border-gray-300 rounded focus:border-[#D4AF37] outline-none" /></div>
                              <div><label className="block text-xs font-bold text-gray-500 mb-1">Phone 2</label><input type="text" value={localBranding.phone2} onChange={e => setLocalBranding({ ...localBranding, phone2: e.target.value })} className="w-full p-2 text-sm border border-gray-300 rounded focus:border-[#D4AF37] outline-none" /></div>
                          </div>
                          
                          <div className="grid grid-cols-2 gap-2 mt-2">
                              <div><label className="block text-xs font-bold text-gray-500 mb-1">Telegram Link</label><input type="text" value={(localBranding as any).telegram || ''} onChange={e => setLocalBranding({ ...localBranding, telegram: e.target.value } as any)} placeholder="https://t.me/username" className="w-full p-2 text-sm border border-gray-300 rounded focus:border-[#D4AF37] outline-none" /></div>
                              <div><label className="block text-xs font-bold text-gray-500 mb-1">Viber Link</label><input type="text" value={(localBranding as any).viber || ''} onChange={e => setLocalBranding({ ...localBranding, viber: e.target.value } as any)} placeholder="viber://add?number=..." className="w-full p-2 text-sm border border-gray-300 rounded focus:border-[#D4AF37] outline-none" /></div>
                          </div>

                          <div className="mt-2"><label className="block text-xs font-bold text-gray-500 mb-1">Copyright Text</label><input type="text" value={localBranding.copyright} onChange={e => setLocalBranding({ ...localBranding, copyright: e.target.value })} className="w-full p-2 text-sm border border-gray-300 rounded focus:border-[#D4AF37] outline-none" /></div>
                      </div>
                  </div>
                  
                  <div className="border-t border-gray-100 pt-6 mt-6">
                      <h4 className="text-sm font-bold text-gray-800 mb-2">Shop Location (For Staff Out Pass GPS Restriction)</h4>
                      <div className="flex items-center space-x-2">
                          <div className="flex-1 bg-gray-50 p-3 rounded border border-gray-200 text-xs text-gray-600 font-mono">Lat: {localBranding.shopLat ? localBranding.shopLat.toFixed(5) : 'Not set'}, Lng: {localBranding.shopLng ? localBranding.shopLng.toFixed(5) : 'Not set'}</div>
                          <button type="button" onClick={() => { navigator.geolocation.getCurrentPosition((pos) => { setLocalBranding({...localBranding, shopLat: pos.coords.latitude, shopLng: pos.coords.longitude}); alert("Location updated! Please click 'Save' above to confirm."); }, () => alert("Please enable Location Services in your browser to get coordinates."), {enableHighAccuracy: true}); }} className="bg-green-50 text-green-700 px-4 py-3 rounded-lg text-xs font-bold border border-green-200 hover:bg-green-100 transition whitespace-nowrap">Get Current GPS</button>
                      </div>
                      <p className="text-[10px] text-gray-400 mt-2">Staff will only be able to Clock Out/In within 50 meters of this exact location. Make sure you are physically at the shop when setting this.</p>
                  </div>
              </div>
          )}
      </div>

      <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200 mt-6 border-l-4 border-l-orange-500">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
             <div>
                <h3 className="text-xl font-bold text-gray-800 flex items-center"><KeyRound className="w-5 h-5 mr-2 text-orange-500" /> Change Encryption Key</h3>
                <p className="text-xs text-gray-500 mt-1">Database ထဲရှိ Data အားလုံးကို အောက်ပါ Key အသစ်ဖြင့် အလိုအလျောက် ပြောင်းလဲပေးပါမည်။</p>
             </div>
             <button onClick={() => toggleSection('encryption')} className="flex items-center text-sm bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2 rounded-lg font-bold transition whitespace-nowrap">
                {expandedSection === 'encryption' ? <><ChevronUp className="w-4 h-4 mr-2" /> Close</> : <><Edit className="w-4 h-4 mr-2" /> Edit this Section</>}
             </button>
          </div>

          {expandedSection === 'encryption' && (
              <div className="mt-6 pt-6 border-t border-gray-100 animate-fade-in">
                  <div className="flex flex-col sm:flex-row gap-3 items-center">
                      <input type="text" placeholder="Enter New Secret Key" value={newSecretKey} onChange={(e) => setNewSecretKey(e.target.value)} className="w-full p-3 border border-gray-300 rounded-lg outline-none focus:border-orange-500 font-mono text-sm" />
                      <button disabled={migratingKey} onClick={handleChangeSecretKey} className="w-full sm:w-auto px-6 py-3 bg-orange-500 text-white rounded-lg font-bold shadow-sm hover:bg-orange-600 transition whitespace-nowrap flex items-center justify-center">
                          {migratingKey ? 'Processing...' : 'Change Key Now'}
                      </button>
                  </div>
              </div>
          )}
      </div>

      {/* 🌟 PROMOTION & DISCOUNTS SECTION 🌟 */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200 mt-6 border-l-4 border-l-green-600">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div>
                  <h3 className="text-xl font-bold text-gray-800 flex items-center"><Sparkles className="w-5 h-5 mr-2 text-green-600" /> App Promotion & Discounts</h3>
                  <p className="text-xs text-gray-500 mt-1">Web App မှ Booking တင်သူများအတွက် Discount သတ်မှတ်ရန်</p>
              </div>
              <button onClick={() => toggleSection('promotion')} className="flex items-center text-sm bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2 rounded-lg font-bold transition whitespace-nowrap">
                  {expandedSection === 'promotion' ? <><ChevronUp className="w-4 h-4 mr-2" /> Close</> : <><Edit className="w-4 h-4 mr-2" /> Edit this Section</>}
              </button>
          </div>

          {expandedSection === 'promotion' && (
              <div className="mt-6 pt-6 border-t border-gray-100 animate-fade-in">
                  <div className="flex justify-end mb-6">
                      <button disabled={savingCategory === 'promotion'} onClick={handleSavePromotion} className="flex items-center bg-[#123524] text-white px-4 py-2 rounded-lg font-bold shadow-md hover:opacity-90 flex-shrink-0">
                          <Save className="w-4 h-4 mr-2" /> {savingCategory === 'promotion' ? 'Saving...' : 'Save Settings'}
                      </button>
                  </div>
                  
                  <div className="space-y-6">
                      {/* 🌟 1. Customer App Box Promotion 🌟 */}
                      <div className="border border-emerald-100 bg-emerald-50/30 rounded-xl p-5">
                          <div className="flex items-center justify-between mb-4">
                              <label className="font-bold text-gray-800 flex items-center cursor-pointer">
                                  <span>1. Customer App Promotion Box (Booking အပေါ်တွင်ပေါ်မည်)</span>
                              </label>
                              <input 
                                  type="checkbox" 
                                  checked={localPromotion.isBoxActive || false}
                                  onChange={(e) => setLocalPromotion({...localPromotion, isBoxActive: e.target.checked})}
                                  className="w-5 h-5 accent-emerald-600 cursor-pointer"
                              />
                          </div>
                          <div className="mb-2">
                              <label className="text-xs font-bold text-gray-500 mb-1 block">Box Title (e.g. SPECIAL DISCOUNT)</label>
                              <input 
                                  type="text" 
                                  value={localPromotion.boxTitle || ''}
                                  onChange={(e) => setLocalPromotion({...localPromotion, boxTitle: e.target.value})}
                                  placeholder="SPECIAL PROMO" 
                                  className="w-full p-2 text-sm border border-gray-300 rounded focus:border-emerald-500 outline-none font-bold" 
                              />
                          </div>
                      </div>

                      {/* 🌟 2. Mini Game Campaign Popup 🌟 */}
                      <div className="border border-orange-100 bg-orange-50/30 rounded-xl p-5">
                          <div className="flex items-center justify-between mb-4">
                              <label className="font-bold text-gray-800 flex items-center cursor-pointer">
                                  <Sparkles className="w-5 h-5 mr-2 text-orange-500" />
                                  2. Mini Game Popup Campaign (App အဖွင့်တွင်ပေါ်မည်)
                              </label>
                              <input 
                                  type="checkbox" 
                                  checked={localPromotion.isPopupActive || false}
                                  onChange={(e) => setLocalPromotion({...localPromotion, isPopupActive: e.target.checked})}
                                  className="w-5 h-5 accent-orange-500 cursor-pointer"
                              />
                          </div>

                
                          <div className="mb-2">
                              <label className="text-xs font-bold text-gray-500 mb-1 block">Campaign Title (e.g. သီတင်းကျွတ် အထူးပရိုမိုးရှင်း)</label>
                              <input 
                                  type="text" 
                                  value={localPromotion.campaignTitle || ''}
                                  onChange={(e) => setLocalPromotion({...localPromotion, campaignTitle: e.target.value})}
                                  placeholder="သီတင်းကျွတ် အထူးအစီအစဉ်" 
                                  className="w-full p-2 text-sm border border-gray-300 rounded focus:border-orange-500 outline-none font-bold" 
                              />
                          </div>
                      </div>

                      {/* Discount Data Inputs */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-gray-50 p-5 rounded-xl border border-gray-200">
                          <div className="md:col-span-2">
                             <h4 className="font-bold text-sm text-gray-700 mb-3 border-b border-gray-200 pb-2">Discount Configurations</h4>
                          </div>
                          <div>
                              <label className="block text-xs font-bold text-gray-500 mb-1">Hotel & Home Services Discount (%)</label>
                              <input type="number" value={localPromotion.hotelDiscountPercent} onChange={(e) => setLocalPromotion({...localPromotion, hotelDiscountPercent: Number(e.target.value)})} className="w-full p-2 text-sm border border-gray-300 rounded focus:border-[#D4AF37] outline-none" />
                          </div>
                          <div>
                              <label className="block text-xs font-bold text-gray-500 mb-1">Other Services Discount (%)</label>
                              <input type="number" value={localPromotion.otherDiscountPercent} onChange={(e) => setLocalPromotion({...localPromotion, otherDiscountPercent: Number(e.target.value)})} className="w-full p-2 text-sm border border-gray-300 rounded focus:border-[#D4AF37] outline-none" />
                          </div>
                          <div>
                              <label className="block text-xs font-bold text-gray-500 mb-1">Start Date</label>
                              <input type="date" value={localPromotion.startDate} onChange={(e) => setLocalPromotion({...localPromotion, startDate: e.target.value})} className="w-full p-2 text-sm border border-gray-300 rounded focus:border-[#D4AF37] outline-none" />
                          </div>
                          <div>
                              <label className="block text-xs font-bold text-gray-500 mb-1">End Date</label>
                              <input type="date" value={localPromotion.endDate} onChange={(e) => setLocalPromotion({...localPromotion, endDate: e.target.value})} className="w-full p-2 text-sm border border-gray-300 rounded focus:border-[#D4AF37] outline-none" />
                          </div>
                      </div>
                  </div>
              </div>
          )}
      </div>

       <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200 mt-6 border-l-4 border-l-purple-500">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div>
                  <h3 className="text-xl font-bold text-gray-800 flex items-center"><Gift className="w-5 h-5 mr-2 text-purple-500" /> New User Welcome Bonus</h3>
                  <p className="text-xs text-gray-500 mt-1">အကောင့်သစ်ဖွင့်သူများကို Point လက်ဆောင်ပေးမည့် အစီအစဉ်</p>
              </div>
              <button onClick={() => toggleSection('signupBonus')} className="flex items-center text-sm bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2 rounded-lg font-bold transition whitespace-nowrap">
                  {expandedSection === 'signupBonus' ? <><ChevronUp className="w-4 h-4 mr-2" /> Close</> : <><Edit className="w-4 h-4 mr-2" /> Edit this Section</>}
              </button>
          </div>

          {expandedSection === 'signupBonus' && (
              <div className="mt-6 pt-6 border-t border-gray-100 animate-fade-in">
                  <div className="flex justify-end mb-6">
                      <button disabled={savingCategory === 'signup_bonus'} onClick={handleSaveSignUpBonus} className="flex items-center bg-[#123524] text-white px-4 py-2 rounded-lg font-bold shadow-md hover:opacity-90 flex-shrink-0">
                          <Save className="w-4 h-4 mr-2" /> {savingCategory === 'signup_bonus' ? 'Saving...' : 'Save'}
                      </button>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="flex items-center space-x-3 mb-2 md:col-span-2 bg-gray-50 p-3 rounded-lg border border-gray-200 w-full sm:w-auto">
                          <label className="text-sm font-bold text-gray-700 cursor-pointer flex-1 flex items-center justify-between">
                              <span>Enable Welcome Bonus (ပွိုင့်လက်ဆောင်ပေးမည်)</span>
                              <input type="checkbox" checked={localSignUpBonus.isActive} onChange={(e) => setLocalSignUpBonus({...localSignUpBonus, isActive: e.target.checked})} className="w-5 h-5 accent-[#123524]" />
                          </label>
                      </div>
                      <div className="md:col-span-2">
                          <label className="block text-xs font-bold text-gray-500 mb-1">Bonus Points Amount (ပေးမည့် ပွိုင့်အရေအတွက်)</label>
                          <input type="number" value={localSignUpBonus.points || ''} onChange={(e) => setLocalSignUpBonus({...localSignUpBonus, points: Number(e.target.value)})} placeholder="e.g. 5" className="w-full p-2 text-sm border border-gray-300 rounded focus:border-[#D4AF37] outline-none font-bold" />
                      </div>
                      <div><label className="block text-xs font-bold text-gray-500 mb-1">Start Date</label><input type="date" value={localSignUpBonus.startDate} onChange={(e) => setLocalSignUpBonus({...localSignUpBonus, startDate: e.target.value})} className="w-full p-2 text-sm border border-gray-300 rounded focus:border-[#D4AF37] outline-none" /></div>
                      <div><label className="block text-xs font-bold text-gray-500 mb-1">End Date</label><input type="date" value={localSignUpBonus.endDate} onChange={(e) => setLocalSignUpBonus({...localSignUpBonus, endDate: e.target.value})} className="w-full p-2 text-sm border border-gray-300 rounded focus:border-[#D4AF37] outline-none" /></div>
                  </div>
              </div>
          )}
      </div>

      <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200 mt-6 border-l-4 border-l-blue-500">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div>
                  <h3 className="text-xl font-bold text-gray-800 flex items-center"><Download className="w-5 h-5 mr-2 text-blue-500" /> Download App Instructions</h3>
                  <p className="text-xs text-gray-500 mt-1">Download App နှိပ်လျှင် ပေါ်လာမည့် လမ်းညွှန်ချက်များနှင့် ပုံများ (အများဆုံး ၁၀ ဆင့်)</p>
              </div>
              <button onClick={() => toggleSection('instructions')} className="flex items-center text-sm bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2 rounded-lg font-bold transition whitespace-nowrap">
                  {expandedSection === 'instructions' ? <><ChevronUp className="w-4 h-4 mr-2" /> Close</> : <><Edit className="w-4 h-4 mr-2" /> Edit this Section</>}
              </button>
          </div>

          {expandedSection === 'instructions' && (
              <div className="mt-6 pt-6 border-t border-gray-100 animate-fade-in">
                  <div className="flex justify-end space-x-2 mb-6">
                      <button onClick={() => { if(localInstallSteps.length < 10) setLocalInstallSteps([...localInstallSteps, { id: Date.now().toString(), text: '', imageUrl: '' }]) }} className="flex items-center text-sm bg-gray-100 border border-gray-300 px-4 py-2 rounded-lg hover:bg-gray-200 font-bold whitespace-nowrap"><PlusCircle className="w-4 h-4 mr-1" /> Add Step</button>
                      <button disabled={savingCategory === 'install_steps'} onClick={handleSaveInstallSteps} className="flex items-center bg-[#123524] text-white px-4 py-2 rounded-lg font-bold shadow-md hover:opacity-90 flex-shrink-0"><Save className="w-4 h-4 mr-2" /> {savingCategory === 'install_steps' ? 'Saving...' : 'Save'}</button>
                  </div>
                  <div className="space-y-4">
                      {localInstallSteps.map((step, idx) => (
                          <div key={step.id} className="p-4 bg-gray-50 border border-gray-200 rounded-xl relative">
                              <button onClick={() => setLocalInstallSteps(localInstallSteps.filter((_, i) => i !== idx))} className="absolute top-4 right-4 text-red-500 hover:text-red-700 bg-red-50 p-1.5 rounded-full"><Trash2 className="w-4 h-4" /></button>
                              <div className="font-bold text-gray-700 mb-2">Step {idx + 1}</div>
                              <textarea value={step.text} onChange={(e) => { const updated = [...localInstallSteps]; updated[idx].text = e.target.value; setLocalInstallSteps(updated); }} className="w-full p-3 bg-white border border-gray-300 rounded-lg outline-none focus:border-[#D4AF37] text-sm mb-3" placeholder="လမ်းညွှန်ချက် ရေးရန်..." rows={2} />
                              <div className="flex items-center space-x-4">
                                  <div className="w-20 h-32 bg-gray-200 rounded border border-gray-300 flex items-center justify-center overflow-hidden relative">
                                      {step.imageUrl ? (
                                          <><img src={step.imageUrl} alt={`Step ${idx+1}`} className="w-full h-full object-cover" /><button onClick={() => { const updated = [...localInstallSteps]; updated[idx].imageUrl = ''; setLocalInstallSteps(updated); }} className="absolute top-1 right-1 bg-black/50 text-white rounded-full p-1"><X className="w-3 h-3"/></button></>
                                      ) : (<ImageIcon className="w-6 h-6 text-gray-400" />)}
                                  </div>
                                  <div className="flex-1">
                                      <label className="text-xs font-bold text-[#D4AF37] bg-yellow-50 px-4 py-2 rounded-lg border border-yellow-200 cursor-pointer hover:bg-yellow-100 transition inline-block">
                                          {uploadingImage === `install_${idx}` ? 'Uploading...' : 'Upload Screenshot'}
                                          <input type="file" accept="image/*" className="hidden" onChange={(e) => handleInstallImageUpload(idx, e)} disabled={uploadingImage === `install_${idx}`} />
                                      </label>
                                      <p className="text-[10px] text-gray-500 mt-2">ဖုန်း Screen အရှည် (Portrait) ပုံစံ ထည့်သွင်းပေးပါ</p>
                                  </div>
                              </div>
                          </div>
                      ))}
                  </div>
              </div>
          )}
      </div>

      <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200 mt-6 border-l-4 border-l-blue-400">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div>
                  <h3 className="text-xl font-bold text-gray-800 flex items-center"><CreditCard className="w-5 h-5 mr-2 text-blue-500" /> Manage Payment</h3>
                  <p className="text-xs text-gray-500 mt-1">ငွေလွှဲလက်ခံမည့် ဘဏ်အကောင့်များ ထည့်သွင်းရန်</p>
              </div>
              <button onClick={() => toggleSection('payments')} className="flex items-center text-sm bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2 rounded-lg font-bold transition whitespace-nowrap">
                  {expandedSection === 'payments' ? <><ChevronUp className="w-4 h-4 mr-2" /> Close</> : <><Edit className="w-4 h-4 mr-2" /> Edit this Section</>}
              </button>
          </div>

          {expandedSection === 'payments' && (
              <div className="mt-6 pt-6 border-t border-gray-100 animate-fade-in">
                  <div className="flex justify-end space-x-2 mb-6">
                      <button onClick={addPaymentMethod} className="flex items-center text-sm bg-gray-100 border border-gray-300 px-4 py-2 rounded-lg hover:bg-gray-200 font-bold whitespace-nowrap"><PlusCircle className="w-4 h-4 mr-1" /> Add Payment</button>
                      <button disabled={savingCategory === 'payments'} onClick={handleSavePayments} className="flex items-center bg-[#123524] text-white px-4 py-2 rounded-lg font-bold shadow-md hover:opacity-90 flex-shrink-0"><Save className="w-4 h-4 mr-2" /> {savingCategory === 'payments' ? 'Saving...' : 'Save'}</button>
                  </div>
                  <div className="space-y-3">
                      {localPaymentMethods.map((pm, pIdx) => (
                          <div key={pm.id} className="grid grid-cols-1 lg:grid-cols-12 gap-3 items-center bg-gray-50 p-3 border border-gray-200 rounded-lg hover:border-gray-300 transition">
                              <div className="lg:col-span-2 flex flex-col items-center justify-center border-r border-gray-200 pr-2">
                                  <div className="w-12 h-12 bg-white border border-gray-200 rounded mb-1 flex items-center justify-center overflow-hidden relative group">
                                      {pm.logoUrl ? (
                                          <><img src={pm.logoUrl} alt="Logo" className="w-full h-full object-contain p-1" /><button onClick={() => updatePaymentMethod(pIdx, 'logoUrl', '')} className="absolute inset-0 bg-black/50 text-white flex items-center justify-center opacity-0 group-hover:opacity-100"><X className="w-4 h-4" /></button></>
                                      ) : (<div className="text-[8px] text-gray-400 text-center">{uploadingImage === `pay_${pIdx}` ? '...' : 'No Logo'}</div>)}
                                  </div>
                                  <label className="text-[10px] text-[#D4AF37] font-bold cursor-pointer hover:underline">Upload Logo<input type="file" accept="image/*" className="hidden" onChange={(e) => handlePaymentLogoUpload(pIdx, e)} disabled={uploadingImage === `pay_${pIdx}`} /></label>
                              </div>
                              <div className="lg:col-span-3"><label className="text-[10px] font-bold text-gray-400 uppercase">Bank Name</label><input type="text" value={pm.name} onChange={(e) => updatePaymentMethod(pIdx, 'name', e.target.value)} className="w-full p-2 text-sm border border-gray-200 rounded focus:border-[#D4AF37] outline-none font-bold text-gray-700" /></div>
                              <div className="lg:col-span-3"><label className="text-[10px] font-bold text-gray-400 uppercase">Account No</label><input type="text" value={pm.accountNumber} onChange={(e) => updatePaymentMethod(pIdx, 'accountNumber', e.target.value)} className="w-full p-2 text-sm border border-gray-200 rounded focus:border-[#D4AF37] outline-none font-bold text-[#123524] tracking-wider" /></div>
                              <div className="lg:col-span-3"><label className="text-[10px] font-bold text-gray-400 uppercase">Account Name</label><input type="text" value={pm.accountName} onChange={(e) => updatePaymentMethod(pIdx, 'accountName', e.target.value)} className="w-full p-2 text-sm border border-gray-200 rounded focus:border-[#D4AF37] outline-none" /></div>
                              <div className="lg:col-span-1 flex justify-end pt-4 lg:pt-0"><button onClick={() => removePaymentMethod(pIdx)} className="p-2 text-red-500 hover:bg-red-50 hover:text-red-700 rounded-lg transition"><Trash2 className="w-5 h-5" /></button></div>
                          </div>
                      ))}
                  </div>
              </div>
          )}
      </div>

      <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200 mt-6 border-l-4 border-l-red-500">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div>
                  <h3 className="text-xl font-bold text-gray-800 flex items-center"><User className="w-5 h-5 mr-2 text-red-500" /> Manage Therapists (Staff)</h3>
                  <p className="text-xs text-gray-500 mt-1">Staff များအတွက် Password သည် အနည်းဆုံး ၆ လုံး ရှိရပါမည်။</p>
              </div>
              <button onClick={() => toggleSection('therapists')} className="flex items-center text-sm bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2 rounded-lg font-bold transition whitespace-nowrap">
                  {expandedSection === 'therapists' ? <><ChevronUp className="w-4 h-4 mr-2" /> Close</> : <><Edit className="w-4 h-4 mr-2" /> Edit this Section</>}
              </button>
          </div>

          {expandedSection === 'therapists' && (
              <div className="mt-6 pt-6 border-t border-gray-100 animate-fade-in">
                  <div className="flex justify-end space-x-2 mb-6">
                      <button onClick={addTherapist} className="flex items-center text-sm bg-gray-100 border border-gray-300 px-4 py-2 rounded-lg hover:bg-gray-200 font-bold whitespace-nowrap"><PlusCircle className="w-4 h-4 mr-1" /> Add Therapist</button>
                      <button disabled={savingCategory === 'therapists'} onClick={handleSaveTherapists} className="flex items-center bg-[#123524] text-white px-4 py-2 rounded-lg font-bold shadow-md hover:opacity-90 flex-shrink-0"><Save className="w-4 h-4 mr-2" /> {savingCategory === 'therapists' ? 'Saving...' : 'Save'}</button>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {localTherapists.map((therapist, tIdx) => (
                          <div key={therapist.id} className="border border-gray-200 rounded-xl p-4 bg-gray-50 relative">
                              <div className="absolute top-2 left-2 flex space-x-1 z-10">
                                  <button type="button" onClick={() => moveTherapistUp(tIdx)} disabled={tIdx === 0} className="p-1 bg-white border border-gray-200 rounded hover:bg-gray-100 disabled:opacity-50 shadow-sm">
                                      <ChevronUp className="w-4 h-4 text-gray-600" />
                                  </button>
                                  <button type="button" onClick={() => moveTherapistDown(tIdx)} disabled={tIdx === localTherapists.length - 1} className="p-1 bg-white border border-gray-200 rounded hover:bg-gray-100 disabled:opacity-50 shadow-sm">
                                      <ChevronDown className="w-4 h-4 text-gray-600" />
                                  </button>
                              </div>
                              <button type="button" onClick={() => removeTherapist(tIdx)} className="absolute top-2 right-2 p-1 bg-red-100 text-red-500 rounded hover:bg-red-200 transition-colors z-10">
                                  <Trash2 className="w-4 h-4" />
                              </button>

                              <div className="mb-3 mt-8">
                                  <span className="bg-[#123524] text-white text-[10px] font-bold px-2 py-1 rounded">Login ID: {therapist.id}</span>
                              </div>
                              <div className="grid grid-cols-2 gap-3 mb-4">
                                  <div>
                                      <label className="block text-xs font-bold text-gray-500 mb-1">Therapist Name</label>
                                      <input type="text" value={therapist.name} onChange={(e) => updateTherapist(tIdx, 'name', e.target.value)} placeholder="Name" className="w-full p-2 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-[#123524] outline-none" />
                                  </div>
                                  <div>
                                      <label className="block text-xs font-bold text-gray-500 mb-1">Login Password</label>
                                      <input type="text" minLength={6} value={therapist.password} onChange={(e) => updateTherapist(tIdx, 'password', e.target.value)} placeholder="Password (Min 6 chars)" className="w-full p-2 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-[#123524] outline-none" />
                                  </div>
                              </div>

                              <label className="block text-xs font-bold text-gray-500 mb-2">Photos (Max 5)</label>
                              <div className="flex flex-wrap gap-2 mb-2">
                                  {therapist.images && therapist.images.map((imgUrl: string, imgIdx: number) => (
                                      <div key={imgIdx} className="w-16 aspect-[3/4] relative rounded overflow-hidden shadow-sm border border-gray-200 group">
                                          <img src={imgUrl} alt="Therapist" className="w-full h-full object-cover" />
                                          
                                          <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-1.5">
                                              <button 
                                                  type="button"
                                                  onClick={(e) => {
                                                      e.preventDefault();
                                                      const newTherapists = [...localTherapists];
                                                      newTherapists[tIdx].images.splice(imgIdx, 1);
                                                      setLocalTherapists(newTherapists);
                                                  }}
                                                  className="bg-red-500 text-white text-[8px] px-1.5 py-1 rounded hover:bg-red-600 shadow-sm"
                                              >
                                                  Delete
                                              </button>
                                              
                                              <div className="flex gap-1.5">
                                                  {imgIdx > 0 && (
                                                      <button 
                                                          type="button"
                                                          onClick={(e) => {
                                                              e.preventDefault();
                                                              const newTherapists = [...localTherapists];
                                                              const imgs = newTherapists[tIdx].images;
                                                              [imgs[imgIdx - 1], imgs[imgIdx]] = [imgs[imgIdx], imgs[imgIdx - 1]];
                                                              setLocalTherapists(newTherapists);
                                                          }}
                                                          className="bg-white text-gray-900 text-[10px] font-black w-5 h-5 flex items-center justify-center rounded-full hover:bg-gray-200"
                                                      >
                                                          &lt;
                                                      </button>
                                                  )}
                                                  {imgIdx < therapist.images.length - 1 && (
                                                      <button 
                                                          type="button"
                                                          onClick={(e) => {
                                                              e.preventDefault();
                                                              const newTherapists = [...localTherapists];
                                                              const imgs = newTherapists[tIdx].images;
                                                              [imgs[imgIdx + 1], imgs[imgIdx]] = [imgs[imgIdx], imgs[imgIdx + 1]];
                                                              setLocalTherapists(newTherapists);
                                                          }}
                                                          className="bg-white text-gray-900 text-[10px] font-black w-5 h-5 flex items-center justify-center rounded-full hover:bg-gray-200"
                                                      >
                                                          &gt;
                                                      </button>
                                                  )}
                                              </div>
                                          </div>
                                      </div>
                                  ))}

                                  {(!therapist.images || therapist.images.length < 5) && (
                                      <label className="w-16 aspect-[3/4] rounded border border-dashed border-gray-400 flex items-center justify-center cursor-pointer hover:bg-gray-100 transition-colors bg-gray-50 shadow-sm">
                                          <input 
                                              type="file" 
                                              accept="image/*" 
                                              className="hidden" 
                                              onChange={(e) => {
                                                  const file = e.target.files?.[0];
                                                  if (file) {
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
                                                              canvas.width = width;
                                                              canvas.height = height;
                                                              const ctx = canvas.getContext('2d');
                                                              
                                                              if (ctx) {
                                                                  ctx.fillStyle = '#FFFFFF';
                                                                  ctx.fillRect(0, 0, width, height);
                                                                  ctx.drawImage(img, 0, 0, width, height);
                                                              }
                                                              
                                                              const finalBase64 = canvas.toDataURL('image/jpeg', 0.8); 
                                                              
                                                              const newTherapists = [...localTherapists];
                                                              if (!newTherapists[tIdx].images) {
                                                                  newTherapists[tIdx].images = [];
                                                              }
                                                              newTherapists[tIdx].images.push(finalBase64);
                                                              setLocalTherapists(newTherapists);
                                                              
                                                              setUploadingImage(null);
                                                          };
                                                          img.src = event.target?.result as string;
                                                      };
                                                      reader.readAsDataURL(file);
                                                  }
                                              }} 
                                              disabled={uploadingImage === `therapist_${tIdx}`}
                                          />
                                          <div className="text-center">
                                              {uploadingImage === `therapist_${tIdx}` ? (
                                                  <span className="text-[9px] font-bold text-[#D4AF37]">Wait..</span>
                                              ) : (
                                                  <span className="text-[10px] font-bold text-gray-500">Upload</span>
                                              )}
                                          </div>
                                      </label>
                                  )}
                              </div>
                          </div>
                      ))}
                  </div>
              </div>
          )}
      </div>

       <div className="bg-red-50 border border-red-200 p-6 rounded-2xl shadow-sm mt-6 mb-2">
           <h3 className="font-bold text-red-700 mb-2 flex items-center text-lg"><AlertCircle className="w-5 h-5 mr-2" /> Category များ ပိုနေ/လိုနေပါသလား?</h3>
           <p className="text-sm text-red-600 mb-4 font-semibold">အောက်ပါခလုတ်ကို နှိပ်လိုက်ပါက Database ထဲရှိ အမှားများကို အကုန်ရှင်းလင်းပြီး ပုံထဲကအတိုင်း Service Category (၁၄) မျိုးလုံးကို အလိုအလျောက် ပြန်လည်ပြင်ဆင်ပေးပါမည်။</p>
           <button onClick={handleForceFixCategories} className="bg-red-600 text-white px-5 py-3 rounded-lg font-bold hover:bg-red-700 shadow-md text-sm flex items-center">
               {savingCategory === 'force_fix' ? 'Fixing Database...' : '🛠️ Fix & Reset Menu Categories'}
           </button>
       </div>
       
       {localCategories.map((cat, cIdx) => (
        <div key={cat.id} className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden mt-6 border-l-4 border-l-[#123524]">
          <div className="p-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
             <div>
                <h3 className="font-bold text-gray-800 flex items-center text-xl"><Activity className="w-5 h-5 mr-2 text-[#D4AF37]" /> {cat.title} Category</h3>
                <p className="text-xs text-gray-500 mt-1">Service များနှင့် စျေးနှုန်းများ ပြင်ဆင်ရန်</p>
             </div>
             <button onClick={() => toggleSection(`cat_${cat.id}`)} className="flex items-center text-sm bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2 rounded-lg font-bold transition whitespace-nowrap">
                {expandedSection === `cat_${cat.id}` ? <><ChevronUp className="w-4 h-4 mr-2" /> Close</> : <><Edit className="w-4 h-4 mr-2" /> Edit this Section</>}
             </button>
          </div>

          {expandedSection === `cat_${cat.id}` && (
             <div className="p-6 pt-0 animate-fade-in border-t border-gray-100 mt-2">
               <div className="flex justify-end space-x-2 my-4">
                  <button onClick={() => addItem(cIdx)} className="flex items-center text-sm bg-white border border-gray-300 px-4 py-2 rounded-lg hover:bg-gray-100 font-bold whitespace-nowrap"><PlusCircle className="w-4 h-4 mr-1" /> Add Item</button>
                  <button disabled={savingCategory === cat.id} onClick={() => handleSaveCategory(cIdx)} className="flex items-center bg-[#D4AF37] text-white px-4 py-2 rounded-lg font-bold shadow-md hover:opacity-90 flex-shrink-0"><Save className="w-4 h-4 mr-2" /> {savingCategory === cat.id ? 'Saving...' : 'Save'}</button>
               </div>
               <div className="space-y-3">
                 {cat.items.length === 0 && <p className="text-sm text-gray-400 text-center py-4">No items in this category.</p>}
                 {cat.items.map((item, iIdx) => (
                    <div key={item.id} className="grid grid-cols-1 lg:grid-cols-12 gap-3 items-center bg-gray-50 p-4 border border-gray-200 rounded-xl hover:border-[#D4AF37] transition">
                        
                        <div className="lg:col-span-3">
                            <label className="text-[10px] font-bold text-gray-400 uppercase">Service Name</label>
                            <input type="text" value={item.name} onChange={(e) => updateItem(cIdx, iIdx, 'name', e.target.value)} className="w-full p-2 text-sm border border-gray-200 rounded focus:border-[#D4AF37] outline-none font-bold text-gray-700" />
                        </div>
                        
                        <div className="lg:col-span-2">
                            <label className="text-[10px] font-bold text-gray-400 uppercase">Duration/Info</label>
                            <input type="text" value={item.duration} onChange={(e) => updateItem(cIdx, iIdx, 'duration', e.target.value)} placeholder="60 Mins" className="w-full p-2 text-sm border border-gray-200 rounded focus:border-[#D4AF37] outline-none" />
                        </div>
                        
                        <div className="lg:col-span-2">
                            <label className="text-[10px] font-bold text-gray-400 uppercase">Price (Ks)</label>
                            <input type="number" value={item.price || ''} onChange={(e) => updateItem(cIdx, iIdx, 'price', Number(e.target.value))} className="w-full p-2 text-sm border border-gray-200 rounded focus:border-[#D4AF37] outline-none font-bold text-[#123524]" />
                        </div>
                        
                        <div className="lg:col-span-2">
                            <label className="text-[10px] font-bold text-gray-400 uppercase">VVIP Price (Ks)</label>
                            <input type="number" value={item.vvipPrice || ''} onChange={(e) => updateItem(cIdx, iIdx, 'vvipPrice', e.target.value === '' ? undefined : Number(e.target.value))} placeholder="Optional" className="w-full p-2 text-sm border border-gray-200 rounded focus:border-[#D4AF37] outline-none font-bold text-yellow-600" />
                        </div>
                        
                        <div className="lg:col-span-2 flex items-center px-2 pt-4">
                            <label className="text-xs font-bold text-gray-600 flex items-center cursor-pointer bg-white px-2 py-1.5 rounded border border-gray-200 w-full shadow-sm">
                                <input type="checkbox" checked={item.vvipIncluded || false} onChange={(e) => updateItem(cIdx, iIdx, 'vvipIncluded', e.target.checked)} className="mr-2" /> VVIP Free
                            </label>
                        </div>
                        
                        <div className="lg:col-span-1 flex justify-end pt-4 lg:pt-0">
                            <button onClick={() => deleteItem(cIdx, iIdx)} className="p-2 text-red-500 hover:bg-red-50 hover:text-red-700 rounded-lg transition">
                                <Trash2 className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Description & Image Upload (Array Format) */}
                        <div className="lg:col-span-12 grid grid-cols-1 md:grid-cols-2 gap-4 mt-3 pt-3 border-t border-gray-200">
                            <div>
                                <label className="text-[10px] font-bold text-gray-500 uppercase mb-1 block">Description (အသေးစိတ်ဖော်ပြချက်)</label>
                                <textarea 
                                    value={item.description || ''} 
                                    onChange={(e) => updateItem(cIdx, iIdx, 'description', e.target.value)} 
                                    className="w-full p-2.5 border border-gray-300 rounded-lg text-xs h-24 resize-none outline-none focus:border-[#D4AF37] bg-white" 
                                    placeholder="Service အကြောင်း အသေးစိတ်ရေးရန်..." 
                                />
                            </div>

                            <div>
                                <label className="text-[10px] font-bold text-gray-500 uppercase mb-1 block">Service Photos (Max 5)</label>
                                <div className="flex flex-wrap gap-2 mb-2">
                                    {(item.images || (item.imageUrl ? [item.imageUrl] : [])).map((imgUrl: string, imgIdx: number) => {
                                        const currentImages = item.images || (item.imageUrl ? [item.imageUrl] : []);
                                        return (
                                        <div key={imgIdx} className="w-24 aspect-[4/3] relative rounded-xl overflow-hidden shadow-sm border border-gray-200 group">
                                            <img src={imgUrl} alt="Service" className="w-full h-full object-cover" />
                                            
                                            <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-1.5">
                                                <button 
                                                    type="button" 
                                                    onClick={(e) => {
                                                        e.preventDefault();
                                                        const newCategories = [...localCategories];
                                                        const cItem = newCategories[cIdx].items[iIdx];
                                                        const cImgs = cItem.images || (cItem.imageUrl ? [cItem.imageUrl] : []);
                                                        cImgs.splice(imgIdx, 1);
                                                        cItem.images = cImgs;
                                                        delete cItem.imageUrl;
                                                        setLocalCategories(newCategories);
                                                    }}
                                                    className="bg-red-500 text-white text-[9px] px-2 py-1 rounded hover:bg-red-600 shadow-sm font-bold"
                                                >
                                                    Delete
                                                </button>
                                                
                                                <div className="flex gap-1.5">
                                                    {imgIdx > 0 && (
                                                        <button 
                                                            type="button"
                                                            onClick={(e) => {
                                                                e.preventDefault();
                                                                const newCategories = [...localCategories];
                                                                const cItem = newCategories[cIdx].items[iIdx];
                                                                const cImgs = cItem.images || (cItem.imageUrl ? [cItem.imageUrl] : []);
                                                                [cImgs[imgIdx - 1], cImgs[imgIdx]] = [cImgs[imgIdx], cImgs[imgIdx - 1]];
                                                                cItem.images = cImgs;
                                                                delete cItem.imageUrl;
                                                                setLocalCategories(newCategories);
                                                            }}
                                                            className="bg-white text-gray-900 text-[10px] font-black w-5 h-5 flex items-center justify-center rounded-full hover:bg-gray-200"
                                                        >
                                                            &lt;
                                                        </button>
                                                    )}
                                                    {imgIdx < currentImages.length - 1 && (
                                                        <button 
                                                            type="button"
                                                            onClick={(e) => {
                                                                e.preventDefault();
                                                                const newCategories = [...localCategories];
                                                                const cItem = newCategories[cIdx].items[iIdx];
                                                                const cImgs = cItem.images || (cItem.imageUrl ? [cItem.imageUrl] : []);
                                                                [cImgs[imgIdx + 1], cImgs[imgIdx]] = [cImgs[imgIdx], cImgs[imgIdx + 1]];
                                                                cItem.images = cImgs;
                                                                delete cItem.imageUrl;
                                                                setLocalCategories(newCategories);
                                                            }}
                                                            className="bg-white text-gray-900 text-[10px] font-black w-5 h-5 flex items-center justify-center rounded-full hover:bg-gray-200"
                                                        >
                                                            &gt;
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    )})}

                                    {(!(item.images || (item.imageUrl ? [item.imageUrl] : [])) || (item.images || (item.imageUrl ? [item.imageUrl] : [])).length < 5) && (
                                        <label className="w-24 aspect-[4/3] rounded-xl border-2 border-dashed border-gray-300 flex flex-col items-center justify-center cursor-pointer hover:bg-gray-100 transition-colors bg-gray-50 shadow-inner relative overflow-hidden text-gray-400">
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
                                                <span className="text-[10px] font-bold text-[#D4AF37] animate-pulse">Wait..</span>
                                            ) : (
                                                <div className="flex flex-col items-center">
                                                    <ImageIcon className="w-6 h-6 opacity-40 mb-1" />
                                                    <span className="text-[9px] font-bold text-gray-500">Upload</span>
                                                </div>
                                            )}
                                        </label>
                                    )}
                                </div>
                            </div>
                        </div>
                        
                    </div>
                 ))}
               </div>
             </div>
          )}
        </div>
      ))}
    </div>
  );
}

function AdminStaffPerformanceView({ therapists, bookings = [] }: { therapists: TherapistProfile[]; bookings?: Booking[] }) {
  const todayStr = getLocalTodayStr();
  const currentYearMonth = todayStr.substring(0, 7); // e.g. "2026-10"
  const currentYear = todayStr.substring(0, 4); // e.g. "2026"

  const getPrevYearMonth = (ym: string) => {
    const [y, m] = ym.split('-').map(Number);
    if (!y || !m) return currentYearMonth;
    const d = new Date(y, m - 2, 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  };

  const getYesterdayDateStr = () => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };

  const getSameDayInMonth = (ym: string, dayNum: number) => {
    const [y, m] = ym.split('-').map(Number);
    if (!y || !m) return `${ym}-01`;
    const maxDay = new Date(y, m, 0).getDate();
    const safeDay = Math.min(Math.max(1, dayNum), maxDay);
    return `${ym}-${String(safeDay).padStart(2, '0')}`;
  };

  // 🌟 1. Primary Filter States (Leaderboard & Staff Stats ကြည့်ရန် ကာလရွေးချယ်မှု) 🌟
  const [selectedStaffId, setSelectedStaffId] = useState<string>('');
  const [periodMode, setPeriodMode] = useState<'monthly' | 'daily' | 'yearly' | 'custom_range'>('monthly');
  const [selectedMonth, setSelectedMonth] = useState<string>(currentYearMonth);
  const [selectedDate, setSelectedDate] = useState<string>(todayStr);
  const [selectedYear, setSelectedYear] = useState<string>(currentYear);
  const [rangeFrom, setRangeFrom] = useState<string>(`${currentYearMonth}-01`);
  const [rangeTo, setRangeTo] = useState<string>(todayStr);

  // 🌟 2. Interactive Comparison Engine States (ရက်အလိုက် / လအလိုက် / နှစ်အလိုက် / Custom Range နှိုင်းယှဉ်မှု) 🌟
  const [compareMode, setCompareMode] = useState<'month_vs_month' | 'day_vs_day' | 'year_vs_year' | 'range_vs_range'>('month_vs_month');
  const [compMonthA, setCompMonthA] = useState<string>(() => getPrevYearMonth(currentYearMonth));
  const [compMonthB, setCompMonthB] = useState<string>(currentYearMonth);

  const [compDayA, setCompDayA] = useState<string>(() => {
    const yest = getYesterdayDateStr();
    const prevYm = getPrevYearMonth(currentYearMonth);
    const dayNum = parseInt(yest.split('-')[2] || '1', 10);
    return getSameDayInMonth(prevYm, dayNum);
  });
  const [compDayB, setCompDayB] = useState<string>(getYesterdayDateStr());

  const [compYearA, setCompYearA] = useState<string>(String(Number(currentYear) - 1));
  const [compYearB, setCompYearB] = useState<string>(currentYear);

  const [compRangeAFrom, setCompRangeAFrom] = useState<string>(() => `${getPrevYearMonth(currentYearMonth)}-01`);
  const [compRangeATo, setCompRangeATo] = useState<string>(() => {
    const prevYm = getPrevYearMonth(currentYearMonth);
    const curDay = parseInt(todayStr.split('-')[2] || '15', 10);
    return getSameDayInMonth(prevYm, curDay);
  });
  const [compRangeBFrom, setCompRangeBFrom] = useState<string>(`${currentYearMonth}-01`);
  const [compRangeBTo, setCompRangeBTo] = useState<string>(todayStr);

  // 🌟 3. Configurable Daily Target & Commission Rate (Saved in LocalStorage) 🌟
  const [baseDailyTarget, setBaseDailyTarget] = useState<number>(() => {
    return Number(localStorage.getItem('shangrila_daily_target')) || 150000;
  });
  const [commissionPercent, setCommissionPercent] = useState<number>(() => {
    return Number(localStorage.getItem('shangrila_commission_pct')) || 20;
  });

  const handleTargetChange = (val: number) => {
    const clean = Math.max(0, val);
    setBaseDailyTarget(clean);
    localStorage.setItem('shangrila_daily_target', String(clean));
  };

  const handleCommissionChange = (val: number) => {
    const clean = Math.min(100, Math.max(0, val));
    setCommissionPercent(clean);
    localStorage.setItem('shangrila_commission_pct', String(clean));
  };

  // Unique Therapists List
  const uniqueTherapists = useMemo(() => {
    return Array.from(new Map(therapists.filter((t) => t.name && t.name.trim() !== '').map((t) => [t.name.trim(), t])).values());
  }, [therapists]);

  // Format short display label like "No-1" or "Therapist No-1"
  const getShortStaffLabel = useCallback((name: string) => {
    const numMatch = String(name || '').match(/no[-\s]*(\d+)/i) || String(name || '').match(/(\d+)/);
    if (numMatch) return `No-${numMatch[1]}`;
    return String(name || '').trim();
  }, []);

  // 🌟 4. Transform Live Bookings (Sale Summary Data) into Normalized Staff Sales Entries 🌟
  const liveSalesEntries = useMemo(() => {
    const entries: {
      bookingId: string;
      date: string;
      yearMonth: string;
      year: string;
      staffId: string;
      staffName: string;
      shortLabel: string;
      serviceName: string;
      customerName: string;
      salesAmount: number;
      commissionAmount: number;
      source: 'POS' | 'Online';
    }[] = [];

    const parseSafeNum = (v: any): number => {
      if (v === undefined || v === null || v === '') return 0;
      if (typeof v === 'number') return isNaN(v) ? 0 : v;
      const s = String(v).trim();
      const dec = decryptText(s);
      const n = Number(dec || s);
      return isNaN(n) ? 0 : n;
    };

    const parseSafeStr = (v: any): string => {
      if (!v) return '';
      if (typeof v !== 'string') return String(v);
      return decryptText(v) || v;
    };

    bookings.forEach((b: any) => {
      if (!b || b.status === 'cancelled') return;

      const rawTx = parseSafeStr(b.txId).trim().toUpperCase();
      const rawPay = String(b.paymentMethod || '').trim().toLowerCase();
      const rawDisc = parseSafeStr(b.discountLabel).trim().toLowerCase();
      const rawService = String(b.service || '').trim();
      const totalAmt = parseSafeNum(b.totalPrice);

      // Exclude non-sale Admin/Staff clock-ins or 0 Ks redemptions
      if (
        totalAmt <= 0 ||
        rawTx === 'ADMIN' ||
        rawTx === 'CASH' ||
        Boolean(b.isAdminClockIn) ||
        Boolean(b.isStaffClockIn) ||
        rawService.toLowerCase().includes('walk-in reward redemption')
      ) {
        return;
      }

      const isPos =
        rawTx.startsWith('SL-') ||
        rawPay.includes('shop pos') ||
        rawDisc.includes('[shop walk-in') ||
        Boolean(b.posLocalId);

      // For Online Bookings, include confirmed/active/completed/payment_checking sales
      const bDate = String(b.date || '').trim();
      if (!/^\d{4}-\d{2}-\d{2}$/.test(bDate)) return;

      const rawTherapistStr = String(b.therapist || '').trim();
      if (!rawTherapistStr || rawTherapistStr === '-' || rawTherapistStr.toLowerCase().includes('any available')) {
        return;
      }

      // Support single or dual therapists (e.g., "Therapist No-1 & Therapist No-3")
      const splitNames = rawTherapistStr
        .split(/&|,|\+/)
        .map((s) => s.trim())
        .filter(Boolean);

      if (splitNames.length === 0) return;

      const shareAmt = Math.round(totalAmt / splitNames.length);

   splitNames.forEach((tNameRaw) => {
     const matchedProfile = uniqueTherapists.find((tp) => isSameStaffMember(tNameRaw, tp.name, tp.id));
     const finalName = matchedProfile ? matchedProfile.name : tNameRaw;
     const finalId = matchedProfile ? matchedProfile.id : tNameRaw;

     // 🌟 Excel ဖိုင်ပါ Senior/Junior နှင့် Service တစ်ခုချင်းစီ၏ နှုန်းထားအတိအကျဖြင့် တွက်ချက်ခြင်း 🌟
     const staffSeniority = getStaffSeniority(finalName, uniqueTherapists);
     const exactCommResult = calculateBookingCommissionForStaff(b, staffSeniority, splitNames.length);

     entries.push({
       bookingId: b.id || '',
       date: bDate,
       yearMonth: bDate.substring(0, 7),
       year: bDate.substring(0, 4),
       staffId: finalId,
       staffName: finalName,
       shortLabel: getShortStaffLabel(finalName),
       serviceName: rawService,
       customerName: parseSafeStr(b.name) || 'Walk-in Guest',
       salesAmount: shareAmt,
       commissionAmount: exactCommResult.totalCommission,
       source: isPos ? 'POS' : 'Online'
     });
   });
    });

    return entries;
  }, [bookings, uniqueTherapists, commissionPercent, getShortStaffLabel]);

  // Available Years & Months for Dropdowns
  const availableYears = useMemo(() => {
    const yearsSet = new Set<string>([currentYear, String(Number(currentYear) - 1)]);
    liveSalesEntries.forEach((e) => {
      if (e.year) yearsSet.add(e.year);
    });
    return Array.from(yearsSet).sort().reverse();
  }, [liveSalesEntries, currentYear]);

  // 🌟 5. Active Period Date List & Target Calculation 🌟
  const activePeriodInfo = useMemo(() => {
    let startStr = `${selectedMonth}-01`;
    let endStr = todayStr;
    let periodLabel = '';
    let totalDaysInPeriod = 30;

    if (periodMode === 'monthly') {
      const [y, m] = selectedMonth.split('-').map(Number);
      const daysInMonth = y && m ? new Date(y, m, 0).getDate() : 30;
      startStr = `${selectedMonth}-01`;
      endStr = `${selectedMonth}-${String(daysInMonth).padStart(2, '0')}`;
      totalDaysInPeriod = daysInMonth;
      const dt = new Date(y || 2026, (m || 1) - 1, 1);
      periodLabel = dt.toLocaleString('en-US', { month: 'long', year: 'numeric' });
    } else if (periodMode === 'daily') {
      startStr = selectedDate;
      endStr = selectedDate;
      totalDaysInPeriod = 1;
      periodLabel = `Daily (${selectedDate})`;
    } else if (periodMode === 'yearly') {
      startStr = `${selectedYear}-01-01`;
      endStr = `${selectedYear}-12-31`;
      totalDaysInPeriod = 365;
      periodLabel = `Year ${selectedYear}`;
    } else {
      const s = rangeFrom <= rangeTo ? rangeFrom : rangeTo;
      const e = rangeFrom <= rangeTo ? rangeTo : rangeFrom;
      startStr = s;
      endStr = e;
      const d1 = new Date(s);
      const d2 = new Date(e);
      const diffDays = Math.max(1, Math.round((d2.getTime() - d1.getTime()) / 86400000) + 1);
      totalDaysInPeriod = diffDays;
      periodLabel = `${s} ➔ ${e} (${diffDays} Days)`;
    }

    // Generate dates list for Daily Tracker (capped to 366 days for safety)
    const datesList: string[] = [];
    const cur = new Date(startStr);
    const endD = new Date(endStr);
    let safety = 0;
    while (!isNaN(cur.getTime()) && !isNaN(endD.getTime()) && cur <= endD && safety < 366) {
      const y = cur.getFullYear();
      const m = String(cur.getMonth() + 1).padStart(2, '0');
      const d = String(cur.getDate()).padStart(2, '0');
      datesList.push(`${y}-${m}-${d}`);
      cur.setDate(cur.getDate() + 1);
      safety++;
    }

    return {
      startStr,
      endStr,
      periodLabel,
      totalDaysInPeriod,
      periodTarget: totalDaysInPeriod * baseDailyTarget,
      datesList
    };
  }, [periodMode, selectedMonth, selectedDate, selectedYear, rangeFrom, rangeTo, todayStr, baseDailyTarget]);

  // Filter Entries for Selected Active Period
  const periodEntries = useMemo(() => {
    return liveSalesEntries.filter(
      (e) => e.date >= activePeriodInfo.startStr && e.date <= activePeriodInfo.endStr
    );
  }, [liveSalesEntries, activePeriodInfo]);

  // 🌟 6. Build Leaderboard for Active Period (Includes All Therapists) 🌟
  const sortedPerformers = useMemo(() => {
    const map = new Map<
      string,
      {
        staffId: string;
        staffName: string;
        shortLabel: string;
        actualSales: number;
        commission: number;
        sectionsCount: number;
      }
    >();

    // Initialize all registered therapists so everyone appears on the chart
    uniqueTherapists.forEach((t) => {
      map.set(t.name, {
        staffId: t.id,
        staffName: t.name,
        shortLabel: getShortStaffLabel(t.name),
        actualSales: 0,
        commission: 0,
        sectionsCount: 0
      });
    });

    periodEntries.forEach((e) => {
      if (!map.has(e.staffName)) {
        map.set(e.staffName, {
          staffId: e.staffId,
          staffName: e.staffName,
          shortLabel: e.shortLabel,
          actualSales: 0,
          commission: 0,
          sectionsCount: 0
        });
      }
      const item = map.get(e.staffName)!;
      item.actualSales += e.salesAmount;
      item.commission += e.commissionAmount;
      item.sectionsCount += 1;
    });

    return Array.from(map.values()).sort((a, b) => b.actualSales - a.actualSales);
  }, [uniqueTherapists, periodEntries, getShortStaffLabel]);

  const maxActual = useMemo(() => {
    return sortedPerformers.length > 0 ? Math.max(...sortedPerformers.map((p) => p.actualSales), 1) : 1;
  }, [sortedPerformers]);

  const top5Gaps = useMemo(() => {
    const gaps = [];
    for (let i = 0; i < Math.min(4, sortedPerformers.length - 1); i++) {
      const p1 = sortedPerformers[i];
      const p2 = sortedPerformers[i + 1];
      gaps.push({
        rank1: `#${i + 1} (${p1.shortLabel})`,
        rank2: `#${i + 2} (${p2.shortLabel})`,
        diff: p1.actualSales - p2.actualSales
      });
    }
    return gaps;
  }, [sortedPerformers]);

  // 🌟 7. Multi-Mode Comparison Calculations (Month vs Month, Day vs Day, Year vs Year, Range vs Range) 🌟
  const comparisonStats = useMemo(() => {
    const sumEntries = (predicate: (e: typeof liveSalesEntries[0]) => boolean) => {
      let total = 0;
      let count = 0;
      liveSalesEntries.forEach((e) => {
        if (predicate(e)) {
          total += e.salesAmount;
          count += 1;
        }
      });
      return { total, count };
    };

    const formatMonthTitle = (ym: string) => {
      const [y, m] = ym.split('-').map(Number);
      if (!y || !m) return ym;
      return new Date(y, m - 1, 1).toLocaleString('en-US', { month: 'long', year: 'numeric' }).toUpperCase();
    };

    // Today's live stats
    const todayStats = sumEntries((e) => e.date === todayStr);
    const shopDailyTarget = Math.max(1, uniqueTherapists.length) * baseDailyTarget;

    if (compareMode === 'month_vs_month') {
      const currentDayOfMonth = parseInt(todayStr.split('-')[2] || '19', 10);
      const cutoffA = getSameDayInMonth(compMonthA, currentDayOfMonth);
      const cutoffB = getSameDayInMonth(compMonthB, currentDayOfMonth);

      const upToDayA = sumEntries((e) => e.yearMonth === compMonthA && e.date <= cutoffA);
      const upToDayB = sumEntries((e) => e.yearMonth === compMonthB && e.date <= cutoffB);

      const fullMonthA = sumEntries((e) => e.yearMonth === compMonthA);
      const fullMonthB = sumEntries((e) => e.yearMonth === compMonthB);

      const yestDateB = getYesterdayDateStr();
      const yestDayNum = parseInt(yestDateB.split('-')[2] || '1', 10);
      const sameDayMonthA = getSameDayInMonth(compMonthA, yestDayNum);
      const sameDayMonthB = getSameDayInMonth(compMonthB, yestDayNum);

      const dayStatsA = sumEntries((e) => e.date === sameDayMonthA);
      const dayStatsB = sumEntries((e) => e.date === sameDayMonthB);

      return {
        modeTitle: `${formatMonthTitle(compMonthA)}  VS  ${formatMonthTitle(compMonthB)}`,
        labelA: formatMonthTitle(compMonthA),
        labelB: formatMonthTitle(compMonthB),
        upToTodayA: upToDayA.total,
        upToTodayB: upToDayB.total,
        upToTodayDiff: upToDayB.total - upToDayA.total,
        upToDayLabel: `၁ ရက်နေ့မှ ${currentDayOfMonth} ရက်နေ့အထိ (Up to Day ${currentDayOfMonth})`,
        sameDayDateA: sameDayMonthA,
        sameDayDateB: sameDayMonthB,
        sameDayA: dayStatsA.total,
        sameDayB: dayStatsB.total,
        sameDayDiff: dayStatsB.total - dayStatsA.total,
        fullTotalA: fullMonthA.total,
        fullTotalB: fullMonthB.total,
        fullCountA: fullMonthA.count,
        fullCountB: fullMonthB.count,
        fullDiff: fullMonthB.total - fullMonthA.total,
        growthPct: fullMonthA.total > 0 ? ((fullMonthB.total - fullMonthA.total) / fullMonthA.total) * 100 : 0,
        todayActual: todayStats.total,
        shopDailyTarget
      };
    }

    if (compareMode === 'day_vs_day') {
      const dA = sumEntries((e) => e.date === compDayA);
      const dB = sumEntries((e) => e.date === compDayB);
      const diff = dB.total - dA.total;
      return {
        modeTitle: `DATE COMPARISON: ${compDayA}  VS  ${compDayB}`,
        labelA: `Date A (${compDayA})`,
        labelB: `Date B (${compDayB})`,
        upToTodayA: dA.total,
        upToTodayB: dB.total,
        upToTodayDiff: diff,
        upToDayLabel: `ရွေးချယ်ထားသော ရက် (၂) ရက် တိုက်ရိုက်နှိုင်းယှဉ်ချက်`,
        sameDayDateA: compDayA,
        sameDayDateB: compDayB,
        sameDayA: dA.total,
        sameDayB: dB.total,
        sameDayDiff: diff,
        fullTotalA: dA.total,
        fullTotalB: dB.total,
        fullCountA: dA.count,
        fullCountB: dB.count,
        fullDiff: diff,
        growthPct: dA.total > 0 ? (diff / dA.total) * 100 : 0,
        todayActual: todayStats.total,
        shopDailyTarget
      };
    }

    if (compareMode === 'year_vs_year') {
      const yA = sumEntries((e) => e.year === compYearA);
      const yB = sumEntries((e) => e.year === compYearB);
      const diff = yB.total - yA.total;
      return {
        modeTitle: `YEARLY COMPARISON: ${compYearA}  VS  ${compYearB}`,
        labelA: `YEAR ${compYearA}`,
        labelB: `YEAR ${compYearB}`,
        upToTodayA: yA.total,
        upToTodayB: yB.total,
        upToTodayDiff: diff,
        upToDayLabel: `နှစ်အလိုက် စုစုပေါင်း ရောင်းရငွေ နှိုင်းယှဉ်ချက်`,
        sameDayDateA: compYearA,
        sameDayDateB: compYearB,
        sameDayA: yA.count,
        sameDayB: yB.count,
        sameDayDiff: yB.count - yA.count,
        fullTotalA: yA.total,
        fullTotalB: yB.total,
        fullCountA: yA.count,
        fullCountB: yB.count,
        fullDiff: diff,
        growthPct: yA.total > 0 ? (diff / yA.total) * 100 : 0,
        todayActual: todayStats.total,
        shopDailyTarget
      };
    }

    // Custom Range A vs Range B
    const rAStart = compRangeAFrom <= compRangeATo ? compRangeAFrom : compRangeATo;
    const rAEnd = compRangeAFrom <= compRangeATo ? compRangeATo : compRangeAFrom;
    const rBStart = compRangeBFrom <= compRangeBTo ? compRangeBFrom : compRangeBTo;
    const rBEnd = compRangeBFrom <= compRangeBTo ? compRangeBTo : compRangeBFrom;

    const rA = sumEntries((e) => e.date >= rAStart && e.date <= rAEnd);
    const rB = sumEntries((e) => e.date >= rBStart && e.date <= rBEnd);
    const diff = rB.total - rA.total;

    return {
      modeTitle: `CUSTOM RANGE COMPARISON`,
      labelA: `${rAStart} ➔ ${rAEnd}`,
      labelB: `${rBStart} ➔ ${rBEnd}`,
      upToTodayA: rA.total,
      upToTodayB: rB.total,
      upToTodayDiff: diff,
      upToDayLabel: `ရက်အပိုင်းအခြား (၂) ခု တိုက်ရိုက်နှိုင်းယှဉ်ချက်`,
      sameDayDateA: `${rAStart}..${rAEnd}`,
      sameDayDateB: `${rBStart}..${rBEnd}`,
      sameDayA: rA.total,
      sameDayB: rB.total,
      sameDayDiff: diff,
      fullTotalA: rA.total,
      fullTotalB: rB.total,
      fullCountA: rA.count,
      fullCountB: rB.count,
      fullDiff: diff,
      growthPct: rA.total > 0 ? (diff / rA.total) * 100 : 0,
      todayActual: todayStats.total,
      shopDailyTarget
    };
  }, [
    liveSalesEntries,
    compareMode,
    compMonthA,
    compMonthB,
    compDayA,
    compDayB,
    compYearA,
    compYearB,
    compRangeAFrom,
    compRangeATo,
    compRangeBFrom,
    compRangeBTo,
    todayStr,
    uniqueTherapists.length,
    baseDailyTarget
  ]);

  // 🌟 8. Individual Selected Staff Breakdown 🌟
  const selectedStaffObj = useMemo(() => {
    if (!selectedStaffId) return null;
    return uniqueTherapists.find((t) => t.id === selectedStaffId || t.name === selectedStaffId) || null;
  }, [selectedStaffId, uniqueTherapists]);

  const individualStats = useMemo(() => {
    if (!selectedStaffObj) return null;

    const myEntries = periodEntries.filter(
      (e) => e.staffName.trim().toLowerCase() === selectedStaffObj.name.trim().toLowerCase()
    );

    const totalMySales = myEntries.reduce((s, e) => s + e.salesAmount, 0);
    const totalMyComm = myEntries.reduce((s, e) => s + e.commissionAmount, 0);
    const totalMySections = myEntries.length;

    const totalDays = activePeriodInfo.datesList.length || 1;
    const periodTarget = activePeriodInfo.periodTarget;

    let cumActualPrior = 0;
    const fullDailyBreakdown = activePeriodInfo.datesList.map((dStr, idx) => {
      const dayRecords = myEntries.filter((e) => e.date === dStr);
      const dayActual = dayRecords.reduce((s, r) => s + r.salesAmount, 0);

      const daysRemaining = totalDays - idx;
      const remainingTargetPrior = Math.max(0, periodTarget - cumActualPrior);
      const adjustedDailyTarget = daysRemaining > 0 ? Math.round(remainingTargetPrior / daysRemaining) : 0;

      const runningCumTarget = baseDailyTarget * (idx + 1);
      const cumActual = cumActualPrior + dayActual;
      const dailyVariance = dayActual - baseDailyTarget;
      const remainingMonthlyTarget = Math.max(0, periodTarget - cumActual);

      cumActualPrior = cumActual;

      return {
        dayNo: idx + 1,
        date: dStr,
        hasSales: dayRecords.length > 0,
        services: dayRecords,
        dayActual,
        dailyTarget: baseDailyTarget,
        adjustedDailyTarget,
        dailyVariance,
        cumTarget: runningCumTarget,
        cumActual,
        remainingMonthlyTarget
      };
    });

    const dailyBreakdown = fullDailyBreakdown.filter((item) => item.date <= todayStr);
    const pastDays = fullDailyBreakdown.filter((item) => item.date <= todayStr);
    const workedDaysCount = pastDays.filter((item) => item.hasSales).length;
    const missedDays = pastDays.filter((item) => !item.hasSales);

    return {
      staffName: selectedStaffObj.name,
      shortLabel: getShortStaffLabel(selectedStaffObj.name),
      totalMySales,
      totalMyComm,
      totalMySections,
      periodTarget,
      dailyBreakdown: [...dailyBreakdown].reverse(), // Show most recent days first
      pastDaysCount: pastDays.length,
      workedDaysCount,
      missedDays,
      missedDaysCount: missedDays.length
    };
  }, [selectedStaffObj, periodEntries, activePeriodInfo, baseDailyTarget, todayStr, getShortStaffLabel]);

  // CSV Export Handler
  const handleExportPerformanceCSV = () => {
    const headers = ['Rank', 'Therapist Name', 'Staff Short ID', 'Period', 'Total Sections', 'Actual Sales (Ks)', 'Target (Ks)', 'Achievement (%)', `Estimated Commission (${commissionPercent}%)`];
    const rows = sortedPerformers.map((p, i) => {
      const pct = activePeriodInfo.periodTarget > 0 ? ((p.actualSales / activePeriodInfo.periodTarget) * 100).toFixed(1) : '0';
      return [
        i + 1,
        `"${p.staffName}"`,
        `"${p.shortLabel}"`,
        `"${activePeriodInfo.periodLabel}"`,
        p.sectionsCount,
        p.actualSales,
        activePeriodInfo.periodTarget,
        `${pct}%`,
        p.commission
      ];
    });
    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `Staff_Performance_${activePeriodInfo.periodLabel.replace(/\s+/g, '_')}.csv`;
    link.click();
  };

  return (
    <div className="animate-fade-in mt-6 space-y-6">
      {/* =========================================================================
          1. TOP CONTROL BAR: LIVE DATA BADGE, PERIOD FILTER (DAY/MONTH/YEAR/RANGE) & STAFF SELECTOR
         ========================================================================= */}
      <div className="bg-gradient-to-br from-gray-50 to-white p-5 rounded-2xl shadow-sm border border-gray-200 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-200/80 pb-3.5">
          <div>
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-100 text-emerald-800 border border-emerald-300">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                Live Synced with Sale Summary
              </span>
              <span className="text-xs font-extrabold text-[#123524]">
                ({activePeriodInfo.periodLabel})
              </span>
            </div>
            <p className="text-[11px] text-gray-500 font-semibold mt-1">
              Excel ဖိုင်တင်စရာမလိုဘဲ Online Bookings နှင့် POS Walk-in Sales စာရင်းများမှ တိုက်ရိုက်တွက်ချက်ထားပါသည်
            </p>
          </div>

          <button
            type="button"
            onClick={handleExportPerformanceCSV}
            className="px-3.5 py-2 bg-green-50 hover:bg-green-100 text-green-700 border border-green-200 rounded-xl text-xs font-black flex items-center gap-1.5 shadow-2xs transition"
          >
            <Download className="w-4 h-4" /> Export Performance CSV
          </button>
        </div>

        {/* Period Filter Mode Pills + Dynamic Pickers */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-end">
          <div className="lg:col-span-5">
            <label className="block text-[10px] font-extrabold text-gray-500 uppercase tracking-wider mb-1.5">
              ၁။ ကြည့်ရှုလိုသော ကာလအမျိုးအစား (Select Period Mode)
            </label>
            <div className="grid grid-cols-4 gap-1 bg-gray-100 p-1 rounded-xl border border-gray-200">
              {[
                { id: 'monthly', label: 'လအလိုက်' },
                { id: 'daily', label: 'ရက်အလိုက်' },
                { id: 'yearly', label: 'နှစ်အလိုက်' },
                { id: 'custom_range', label: 'Date Range' }
              ].map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setPeriodMode(m.id as any)}
                  className={`py-2 px-2 rounded-lg text-[11px] font-black transition ${
                    periodMode === m.id
                      ? 'bg-[#123524] text-[#D4AF37] shadow-xs'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>
          </div>

          {/* Dynamic Date/Month/Year/Range Inputs */}
          <div className="lg:col-span-4">
            {periodMode === 'monthly' && (
              <div>
                <label className="block text-[10px] font-extrabold text-gray-500 uppercase tracking-wider mb-1.5">
                  လ နှင့် နှစ် ရွေးချယ်ရန် (Select Month)
                </label>
                <input
                  type="month"
                  value={selectedMonth}
                  onChange={(e) => e.target.value && setSelectedMonth(e.target.value)}
                  className="w-full p-2.5 bg-white border border-gray-300 rounded-xl text-xs font-black text-[#123524] outline-none focus:border-[#D4AF37]"
                />
              </div>
            )}

            {periodMode === 'daily' && (
              <div>
                <label className="block text-[10px] font-extrabold text-gray-500 uppercase tracking-wider mb-1.5">
                  ရက်စွဲ ရွေးချယ်ရန် (Select Date)
                </label>
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => e.target.value && setSelectedDate(e.target.value)}
                  className="w-full p-2.5 bg-white border border-gray-300 rounded-xl text-xs font-black text-[#123524] outline-none focus:border-[#D4AF37]"
                />
              </div>
            )}

            {periodMode === 'yearly' && (
              <div>
                <label className="block text-[10px] font-extrabold text-gray-500 uppercase tracking-wider mb-1.5">
                  နှစ် ရွေးချယ်ရန် (Select Year)
                </label>
                <select
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(e.target.value)}
                  className="w-full p-2.5 bg-white border border-gray-300 rounded-xl text-xs font-black text-[#123524] outline-none focus:border-[#D4AF37]"
                >
                  {availableYears.map((yr) => (
                    <option key={yr} value={yr}>
                      {yr} ခုနှစ်
                    </option>
                  ))}
                </select>
              </div>
            )}

            {periodMode === 'custom_range' && (
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[10px] font-extrabold text-gray-500 uppercase mb-1">From Date</label>
                  <input
                    type="date"
                    value={rangeFrom}
                    onChange={(e) => setRangeFrom(e.target.value)}
                    className="w-full p-2 bg-white border border-gray-300 rounded-xl text-xs font-bold text-[#123524]"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-extrabold text-gray-500 uppercase mb-1">To Date</label>
                  <input
                    type="date"
                    value={rangeTo}
                    onChange={(e) => setRangeTo(e.target.value)}
                    className="w-full p-2 bg-white border border-gray-300 rounded-xl text-xs font-bold text-[#123524]"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Therapist Selector */}
          <div className="lg:col-span-3">
            <label className="block text-[10px] font-extrabold text-gray-500 uppercase tracking-wider mb-1.5 flex items-center">
              <User className="w-3.5 h-3.5 mr-1 text-[#D4AF37]" /> ဝန်ထမ်း ရွေးချယ်ရန်
            </label>
            <div className="relative">
              <select
                value={selectedStaffId}
                onChange={(e) => setSelectedStaffId(e.target.value)}
                className="w-full p-2.5 bg-white border border-gray-300 rounded-xl outline-none focus:border-[#D4AF37] text-xs font-black text-[#123524] appearance-none cursor-pointer shadow-2xs pr-8"
              >
                <option value="">-- Show Global Leaderboard --</option>
                {uniqueTherapists.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
              <ChevronDown className="absolute right-3 top-3 w-4 h-4 text-gray-400 pointer-events-none" />
            </div>
          </div>
        </div>

        {/* Adjustable Daily Target & Commission Rate Bar */}
        <div className="pt-3 border-t border-gray-200/60 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-bold text-gray-500">ဝန်ထမ်း တစ်ရက်စာ Target:</span>
              <input
                type="number"
                step={10000}
                value={baseDailyTarget}
                onChange={(e) => handleTargetChange(Number(e.target.value))}
                className="w-28 px-2.5 py-1 bg-white border border-gray-300 rounded-lg font-black text-[#123524] text-xs outline-none focus:border-[#D4AF37]"
              />
              <span className="text-[10px] font-bold text-gray-400">Ks / Day</span>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-[11px] font-bold text-gray-500">ကော်မရှင်နှုန်း (Commission %):</span>
              <input
                type="number"
                min={0}
                max={100}
                value={commissionPercent}
                onChange={(e) => handleCommissionChange(Number(e.target.value))}
                className="w-16 px-2.5 py-1 bg-white border border-gray-300 rounded-lg font-black text-[#123524] text-xs outline-none focus:border-[#D4AF37]"
              />
              <span className="text-[10px] font-bold text-gray-400">%</span>
            </div>
          </div>

          <div className="text-[11px] font-bold text-gray-500">
            ရွေးချယ်ထားသောကာလ Target ({activePeriodInfo.totalDaysInPeriod} ရက်စာ):{' '}
            <strong className="text-[#123524]">{formatPrice(activePeriodInfo.periodTarget)}</strong>
          </div>
        </div>
      </div>

      {/* =========================================================================
          2. GLOBAL LEADERBOARD & MULTI-PERIOD COMPARISON STUDIO
         ========================================================================= */}
      {!selectedStaffId ? (
        <div className="space-y-6 animate-slide-up">
          {/* Bar Chart Card */}
          <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 overflow-x-auto">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-black text-[#123524] flex items-center">
                  <Trophy className="w-4 h-4 mr-2 text-[#D4AF37]" />
                  Staff Performance Leaderboard — {activePeriodInfo.periodLabel}
                </h3>
                <p className="text-[10px] text-gray-400 font-semibold mt-0.5">
                  ဝန်ထမ်းတစ်ဦးချင်းစီ၏ လက်တွေ့ရောင်းအား နှင့် Target ပြည့်မီမှု ရာခိုင်နှုန်း (ဘားတိုင်ပေါ်နှိပ်၍ အသေးစိတ်ကြည့်နိုင်သည်)
                </p>
              </div>
              <span className="text-xs font-black text-[#123524] bg-yellow-50 border border-[#D4AF37]/40 px-3 py-1 rounded-xl">
                Total Period Sales: {formatPrice(sortedPerformers.reduce((s, p) => s + p.actualSales, 0))}
              </span>
            </div>

            <div className="flex items-end space-x-4 h-56 pb-2 pt-14 min-w-max border-b border-gray-100 px-2">
              {sortedPerformers.map((p, idx) => {
                const actualSales = p.actualSales;
                const heightPercent = Math.max(6, (actualSales / maxActual) * 100);
                const metPercent =
                  activePeriodInfo.periodTarget > 0 ? (actualSales / activePeriodInfo.periodTarget) * 100 : 0;

                let barColor = 'bg-gray-200 hover:bg-gray-300';
                if (idx === 0 && actualSales > 0) barColor = 'bg-gradient-to-t from-[#123524] to-[#1a4a32] shadow-md';
                else if (idx === 1 && actualSales > 0) barColor = 'bg-gradient-to-t from-[#D4AF37] to-yellow-400 shadow-md';
                else if (idx === 2 && actualSales > 0) barColor = 'bg-gradient-to-t from-gray-400 to-gray-300 shadow-md';
                else if (idx === 3 && actualSales > 0) barColor = 'bg-gradient-to-t from-orange-400 to-orange-300 shadow-sm';
                else if (idx === 4 && actualSales > 0) barColor = 'bg-gradient-to-t from-blue-400 to-blue-300 shadow-sm';

                return (
                  <div
                    key={p.staffId}
                    onClick={() => setSelectedStaffId(p.staffId)}
                    title={`${p.staffName}: ${formatPrice(actualSales)} (${p.sectionsCount} Sections)`}
                    className="flex flex-col justify-end items-center group w-14 h-full cursor-pointer"
                  >
                    <div className="text-[9px] font-black text-[#123524] mb-2 opacity-0 group-hover:opacity-100 transition-opacity -rotate-35 whitespace-nowrap z-10 bg-yellow-50 px-1.5 py-0.5 rounded border border-[#D4AF37]">
                      {formatPrice(actualSales)}
                    </div>
                    <div
                      className={`w-9 rounded-t-lg relative transition-all duration-700 ease-out flex justify-center ${barColor}`}
                      style={{ height: `${heightPercent}%` }}
                    >
                      {idx === 0 && actualSales > 0 && <Crown className="w-6 h-6 text-[#D4AF37] absolute -top-11 animate-bounce" />}
                      <span
                        className={`absolute -top-5 text-[9px] font-black ${
                          idx === 0 ? 'text-[#123524]' : idx === 1 ? 'text-yellow-600' : 'text-gray-600'
                        }`}
                      >
                        {metPercent.toFixed(0)}%
                      </span>
                    </div>
                    <span className="text-[10px] font-black mt-2 text-gray-700 group-hover:text-[#123524] truncate max-w-[56px]">
                      {p.shortLabel}
                    </span>
                    <span className="text-[8px] font-bold text-gray-400">{p.sectionsCount} Sec</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* =====================================================================
              🌟 INTERACTIVE MULTI-PERIOD COMPARISON STUDIO (MONTH / DAY / YEAR / RANGE) 🌟
             ===================================================================== */}
          <div className="bg-white p-5 sm:p-6 rounded-2xl shadow-sm border border-gray-200 space-y-5">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 border-b border-gray-100 pb-4">
              <div>
                <h3 className="font-black text-gray-800 text-sm sm:text-base flex items-center">
                  <TrendingUp className="w-4 h-4 mr-2 text-blue-600" />
                  Custom Period Comparison Studio (စိတ်ကြိုက် ကာလနှိုင်းယှဉ်ချက်)
                </h3>
                <p className="text-[11px] text-gray-500 font-semibold mt-0.5">
                  ရက်အလိုက်၊ လအလိုက်၊ နှစ်အလိုက် သို့မဟုတ် Date Range အလိုက် မိမိနှိုင်းယှဉ်လိုသော ကာလ (၂) ခုကို စိတ်ကြိုက်ရွေးချယ် နှိုင်းယှဉ်နိုင်ပါသည်
                </p>
              </div>

              {/* Comparison Mode Selector Tabs */}
              <div className="flex flex-wrap gap-1 bg-gray-100 p-1 rounded-xl border border-gray-200">
                {[
                  { id: 'month_vs_month', label: 'လအလိုက် (Month vs Month)' },
                  { id: 'day_vs_day', label: 'ရက်အလိုက် (Day vs Day)' },
                  { id: 'year_vs_year', label: 'နှစ်အလိုက် (Year vs Year)' },
                  { id: 'range_vs_range', label: 'Date Range နှိုင်းယှဉ်ရန်' }
                ].map((cm) => (
                  <button
                    key={cm.id}
                    type="button"
                    onClick={() => setCompareMode(cm.id as any)}
                    className={`px-3 py-1.5 rounded-lg text-[11px] font-black transition ${
                      compareMode === cm.id
                        ? 'bg-blue-600 text-white shadow-xs'
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    {cm.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Dynamic Pickers for Period A vs Period B */}
            <div className="bg-gray-50 p-4 rounded-xl border border-gray-200">
              {compareMode === 'month_vs_month' && (
                <div className="grid grid-cols-1 sm:grid-cols-11 gap-3 items-center">
                  <div className="sm:col-span-5">
                    <label className="block text-[10px] font-black text-gray-500 uppercase mb-1">
                      ပထမလ ရွေးချယ်ရန် (Month A)
                    </label>
                    <input
                      type="month"
                      value={compMonthA}
                      onChange={(e) => e.target.value && setCompMonthA(e.target.value)}
                      className="w-full p-2.5 bg-white border border-gray-300 rounded-xl text-xs font-black text-gray-800 outline-none focus:border-blue-500"
                    />
                  </div>
                  <div className="sm:col-span-1 text-center font-black text-xs text-blue-600 pt-4">VS</div>
                  <div className="sm:col-span-5">
                    <label className="block text-[10px] font-black text-blue-700 uppercase mb-1">
                      ဒုတိယလ ရွေးချယ်ရန် (Month B)
                    </label>
                    <input
                      type="month"
                      value={compMonthB}
                      onChange={(e) => e.target.value && setCompMonthB(e.target.value)}
                      className="w-full p-2.5 bg-white border border-blue-300 rounded-xl text-xs font-black text-[#123524] outline-none focus:border-blue-600"
                    />
                  </div>
                </div>
              )}

              {compareMode === 'day_vs_day' && (
                <div className="grid grid-cols-1 sm:grid-cols-11 gap-3 items-center">
                  <div className="sm:col-span-5">
                    <label className="block text-[10px] font-black text-gray-500 uppercase mb-1">
                      ပထမ ရက်စွဲ (Date A)
                    </label>
                    <input
                      type="date"
                      value={compDayA}
                      onChange={(e) => e.target.value && setCompDayA(e.target.value)}
                      className="w-full p-2.5 bg-white border border-gray-300 rounded-xl text-xs font-black text-gray-800"
                    />
                  </div>
                  <div className="sm:col-span-1 text-center font-black text-xs text-purple-600 pt-4">VS</div>
                  <div className="sm:col-span-5">
                    <label className="block text-[10px] font-black text-purple-700 uppercase mb-1">
                      ဒုတိယ ရက်စွဲ (Date B)
                    </label>
                    <input
                      type="date"
                      value={compDayB}
                      onChange={(e) => e.target.value && setCompDayB(e.target.value)}
                      className="w-full p-2.5 bg-white border border-purple-300 rounded-xl text-xs font-black text-[#123524]"
                    />
                  </div>
                </div>
              )}

              {compareMode === 'year_vs_year' && (
                <div className="grid grid-cols-1 sm:grid-cols-11 gap-3 items-center">
                  <div className="sm:col-span-5">
                    <label className="block text-[10px] font-black text-gray-500 uppercase mb-1">
                      ပထမနှစ် (Year A)
                    </label>
                    <select
                      value={compYearA}
                      onChange={(e) => setCompYearA(e.target.value)}
                      className="w-full p-2.5 bg-white border border-gray-300 rounded-xl text-xs font-black text-gray-800"
                    >
                      {availableYears.map((y) => (
                        <option key={y} value={y}>
                          {y} ခုနှစ်
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="sm:col-span-1 text-center font-black text-xs text-blue-600 pt-4">VS</div>
                  <div className="sm:col-span-5">
                    <label className="block text-[10px] font-black text-blue-700 uppercase mb-1">
                      ဒုတိယနှစ် (Year B)
                    </label>
                    <select
                      value={compYearB}
                      onChange={(e) => setCompYearB(e.target.value)}
                      className="w-full p-2.5 bg-white border border-blue-300 rounded-xl text-xs font-black text-[#123524]"
                    >
                      {availableYears.map((y) => (
                        <option key={y} value={y}>
                          {y} ခုနှစ်
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              )}

              {compareMode === 'range_vs_range' && (
                <div className="grid grid-cols-1 lg:grid-cols-11 gap-3 items-center">
                  <div className="lg:col-span-5 bg-white p-3 rounded-xl border border-gray-200">
                    <div className="text-[10px] font-black text-gray-500 uppercase mb-2">ကာလ (A) — Period A Range</div>
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        type="date"
                        value={compRangeAFrom}
                        onChange={(e) => setCompRangeAFrom(e.target.value)}
                        className="p-2 border border-gray-300 rounded-lg text-xs font-bold"
                      />
                      <input
                        type="date"
                        value={compRangeATo}
                        onChange={(e) => setCompRangeATo(e.target.value)}
                        className="p-2 border border-gray-300 rounded-lg text-xs font-bold"
                      />
                    </div>
                  </div>
                  <div className="lg:col-span-1 text-center font-black text-xs text-blue-600">VS</div>
                  <div className="lg:col-span-5 bg-white p-3 rounded-xl border border-blue-200">
                    <div className="text-[10px] font-black text-blue-700 uppercase mb-2">ကာလ (B) — Period B Range</div>
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        type="date"
                        value={compRangeBFrom}
                        onChange={(e) => setCompRangeBFrom(e.target.value)}
                        className="p-2 border border-blue-300 rounded-lg text-xs font-bold text-[#123524]"
                      />
                      <input
                        type="date"
                        value={compRangeBTo}
                        onChange={(e) => setCompRangeBTo(e.target.value)}
                        className="p-2 border border-blue-300 rounded-lg text-xs font-bold text-[#123524]"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Comparison Results Cards */}
            <div className="space-y-5">
              {/* 1. Same Day-of-Month / Direct Period Comparison */}
              <div className="bg-blue-50/50 p-4 rounded-xl border border-blue-100">
                <div className="text-xs font-bold text-blue-900 mb-2.5 flex items-center justify-between">
                  <span className="flex items-center">
                    <Calendar className="w-3.5 h-3.5 mr-1.5" /> {comparisonStats.upToDayLabel}
                  </span>
                  <span className="text-[10px] font-black bg-white px-2.5 py-0.5 rounded-full border border-blue-200 text-blue-700">
                    Growth: {comparisonStats.growthPct >= 0 ? '+' : ''}
                    {comparisonStats.growthPct.toFixed(1)}%
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-center">
                  <div className="bg-white p-3 rounded-lg border border-blue-200">
                    <div className="text-[9px] text-gray-500 font-bold uppercase">{comparisonStats.labelA}</div>
                    <div className="text-sm font-bold text-gray-800 mt-1">{formatPrice(comparisonStats.upToTodayA)}</div>
                  </div>
                  <div className="bg-white p-3 rounded-lg border border-blue-200">
                    <div className="text-[9px] text-blue-700 font-bold uppercase">{comparisonStats.labelB}</div>
                    <div className="text-sm font-black text-[#123524] mt-1">{formatPrice(comparisonStats.upToTodayB)}</div>
                  </div>
                  <div
                    className={`p-3 rounded-lg border text-center ${
                      comparisonStats.upToTodayDiff >= 0
                        ? 'bg-green-50 border-green-200 text-green-700'
                        : 'bg-red-50 border-red-200 text-red-700'
                    }`}
                  >
                    <div className="text-[9px] font-bold uppercase">Difference (ကွာခြားချက်)</div>
                    <div className="text-sm font-black mt-1">
                      {comparisonStats.upToTodayDiff >= 0 ? '+' : ''}
                      {formatPrice(comparisonStats.upToTodayDiff)}
                    </div>
                  </div>
                </div>
              </div>

              {/* 2. Yesterday / Same Day Comparison (Shown in Month vs Month mode, or Quick Date Picker) */}
              {compareMode === 'month_vs_month' && (
                <div className="bg-purple-50/50 p-4 rounded-xl border border-purple-100">
                  <div className="text-xs font-bold text-purple-900 mb-2.5 flex flex-wrap items-center justify-between gap-2">
                    <span className="flex items-center">
                      <Clock className="w-3.5 h-3.5 mr-1.5" /> နေ့ချင်းအလိုက် နှိုင်းယှဉ်ချက် ({comparisonStats.sameDayDateA} vs{' '}
                      {comparisonStats.sameDayDateB})
                    </span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-center">
                    <div className="bg-white p-3 rounded-lg border border-purple-200">
                      <div className="text-[9px] text-gray-500 font-bold uppercase">{comparisonStats.sameDayDateA}</div>
                      <div className="text-sm font-bold text-gray-800 mt-1">{formatPrice(comparisonStats.sameDayA)}</div>
                    </div>
                    <div className="bg-white p-3 rounded-lg border border-purple-200">
                      <div className="text-[9px] text-purple-700 font-bold uppercase">{comparisonStats.sameDayDateB}</div>
                      <div className="text-sm font-black text-[#123524] mt-1">{formatPrice(comparisonStats.sameDayB)}</div>
                    </div>
                    <div
                      className={`p-3 rounded-lg border text-center ${
                        comparisonStats.sameDayDiff >= 0
                          ? 'bg-green-50 border-green-200 text-green-700'
                          : 'bg-red-50 border-red-200 text-red-700'
                      }`}
                    >
                      <div className="text-[9px] font-bold uppercase">Day Difference</div>
                      <div className="text-sm font-black mt-1">
                        {comparisonStats.sameDayDiff >= 0 ? '+' : ''}
                        {formatPrice(comparisonStats.sameDayDiff)}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* 3. Today's Shop Target Status */}
              <div className="bg-yellow-50/60 p-4 rounded-xl border border-yellow-200">
                <div className="text-xs font-bold text-yellow-900 mb-2 flex items-center">
                  <Target className="w-3.5 h-3.5 mr-1.5" /> Today's Live Shop Target ({todayStr})
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-center">
                  <div className="bg-white p-3 rounded-lg border border-yellow-200">
                    <div className="text-[9px] text-gray-500 font-bold uppercase">Today Actual Sales</div>
                    <div className="text-sm font-black text-[#123524] mt-1">{formatPrice(comparisonStats.todayActual)}</div>
                  </div>
                  <div className="bg-white p-3 rounded-lg border border-yellow-200">
                    <div className="text-[9px] text-yellow-700 font-bold uppercase">
                      Shop Daily Target ({uniqueTherapists.length} Staff)
                    </div>
                    <div className="text-sm font-black text-[#123524] mt-1">{formatPrice(comparisonStats.shopDailyTarget)}</div>
                  </div>
                  <div className="bg-white p-3 rounded-lg border border-yellow-200">
                    <div className="text-[9px] text-yellow-700 font-bold uppercase">Today Achievement</div>
                    <div className="text-sm font-black text-yellow-700 mt-1">
                      {comparisonStats.shopDailyTarget > 0
                        ? `${Math.round((comparisonStats.todayActual / comparisonStats.shopDailyTarget) * 100)}%`
                        : '0%'}
                    </div>
                  </div>
                </div>
              </div>

              {/* 4. Full Period Total Summary Row */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-1">
                <div className="bg-gray-50 p-3.5 rounded-xl border border-gray-200 text-center">
                  <div className="text-[9px] text-gray-500 font-bold uppercase tracking-wider mb-1">
                    {comparisonStats.labelA} TOTAL ({comparisonStats.fullCountA} Sec)
                  </div>
                  <div className="text-sm font-bold text-gray-800">{formatPrice(comparisonStats.fullTotalA)}</div>
                </div>
                <div className="bg-yellow-50 p-3.5 rounded-xl border border-yellow-200 text-center">
                  <div className="text-[9px] text-yellow-700 font-bold uppercase tracking-wider mb-1">
                    {comparisonStats.labelB} TOTAL ({comparisonStats.fullCountB} Sec)
                  </div>
                  <div className="text-sm font-black text-[#123524]">{formatPrice(comparisonStats.fullTotalB)}</div>
                </div>
                <div
                  className={`p-3.5 rounded-xl border text-center ${
                    comparisonStats.fullDiff >= 0
                      ? 'bg-green-50 border-green-200 text-green-700'
                      : 'bg-red-50 border-red-200 text-red-700'
                  }`}
                >
                  <div className="text-[9px] font-bold uppercase tracking-wider mb-1">Full Period Difference</div>
                  <div className="text-sm font-black">
                    {comparisonStats.fullDiff >= 0 ? '+' : ''}
                    {formatPrice(comparisonStats.fullDiff)}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Top-5 Rank Gap Analysis */}
          {top5Gaps.length > 0 && (
            <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100">
              <h3 className="font-bold text-[#123524] text-sm mb-4 flex items-center">
                <Award className="w-4 h-4 mr-2 text-[#D4AF37]" /> Top-5 Rank Gap Analysis ({activePeriodInfo.periodLabel})
              </h3>
              <div className="space-y-2.5">
                {top5Gaps.map((gap, gIdx) => (
                  <div
                    key={gIdx}
                    className="flex justify-between items-center p-3 bg-gray-50 rounded-xl border border-gray-200 text-xs font-semibold"
                  >
                    <span className="text-gray-700">
                      {gap.rank1} &nbsp;vs&nbsp; {gap.rank2}
                    </span>
                    <span className="font-black text-[#123524]">Gap: {formatPrice(gap.diff)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Detailed Performers List */}
          <div className="space-y-3">
            {sortedPerformers.map((p, idx) => {
              let badgeClass = 'bg-gray-100 text-gray-600';
              if (idx === 0 && p.actualSales > 0) badgeClass = 'bg-yellow-100 text-yellow-700 border border-yellow-300';
              else if (idx === 1 && p.actualSales > 0) badgeClass = 'bg-gray-200 text-gray-700 border border-gray-400';
              else if (idx === 2 && p.actualSales > 0) badgeClass = 'bg-orange-100 text-orange-700 border border-orange-300';

              const metPercent =
                activePeriodInfo.periodTarget > 0 ? (p.actualSales / activePeriodInfo.periodTarget) * 100 : 0;

              return (
                <div
                  key={p.staffId}
                  onClick={() => setSelectedStaffId(p.staffId)}
                  className="flex items-center p-4 rounded-xl border bg-white border-gray-100 shadow-sm transition-all hover:border-[#D4AF37] hover:shadow-md cursor-pointer"
                >
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs mr-4 ${badgeClass}`}>
                    {idx === 0 && p.actualSales > 0 ? <Trophy className="w-4 h-4" /> : `#${idx + 1}`}
                  </div>
                  <div className="flex-1">
                    <div className="font-bold text-gray-800 text-sm flex items-center gap-2">
                      <span>{p.staffName}</span>
                      <span className="text-[10px] font-black bg-gray-100 text-gray-600 px-2 py-0.5 rounded">
                        {p.sectionsCount} Sections
                      </span>
                    </div>
                    <div className="text-[10px] text-gray-500 font-semibold mt-0.5">
                      Target: {formatPrice(activePeriodInfo.periodTarget)} • Est. Comm ({commissionPercent}%):{' '}
                      <strong className="text-[#123524]">{formatPrice(p.commission)}</strong>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-black text-[#123524]">{formatPrice(p.actualSales)}</div>
                    <div className={`text-[9px] font-bold mt-0.5 ${metPercent >= 50 ? 'text-green-600' : 'text-orange-500'}`}>
                      Met {metPercent.toFixed(1)}%
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        /* =========================================================================
           3. INDIVIDUAL STAFF PERFORMANCE VIEW (FIXED CLEAN NAME & LIVE DAILY TRACKER)
           ========================================================================= */
        <div className="space-y-6 animate-slide-up">
          <div className="flex justify-between items-center">
            <button
              type="button"
              onClick={() => setSelectedStaffId('')}
              className="px-3.5 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-xs font-black transition flex items-center gap-1.5"
            >
              ← Back to Global Leaderboard
            </button>
            <span className="text-xs font-bold text-gray-500">
              Viewing: <strong className="text-[#123524]">{individualStats?.staffName}</strong> ({activePeriodInfo.periodLabel})
            </span>
          </div>

          {individualStats && (
            <>
              {/* Target Ring Card (Displays Clean Therapist Name instead of Raw ID!) */}
              <div className="bg-gradient-to-br from-[#123524] to-[#1a4a32] p-6 rounded-2xl shadow-lg relative overflow-hidden flex flex-col items-center">
                <div className="absolute top-0 right-0 w-32 h-32 bg-[#D4AF37] opacity-10 rounded-full -mr-10 -mt-10 blur-2xl"></div>
                <h3 className="text-[#D4AF37] font-bold text-sm tracking-widest uppercase mb-6 flex items-center">
                  <Target className="w-4 h-4 mr-2" /> PERIOD TARGET — {individualStats.staffName} ({activePeriodInfo.periodLabel})
                </h3>

                <div className="relative w-32 h-32 flex items-center justify-center bg-black/20 rounded-full border-4 border-white/5 shadow-inner">
                  <div className="text-center">
                    <div className="text-2xl font-black text-white">
                      {individualStats.totalMySales > 0 && individualStats.periodTarget > 0
                        ? Math.round((individualStats.totalMySales / individualStats.periodTarget) * 100)
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
                      strokeDashoffset={
                        364 -
                        364 *
                          Math.min(
                            1,
                            individualStats.periodTarget > 0
                              ? individualStats.totalMySales / individualStats.periodTarget
                              : 0
                          )
                      }
                      strokeLinecap="round"
                      style={{ transition: 'stroke-dashoffset 1s ease-out' }}
                    />
                  </svg>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 w-full mt-8">
                  <div className="bg-white/10 p-3 rounded-xl border border-white/10 text-center">
                    <div className="text-[9px] text-gray-300 font-bold uppercase tracking-wider mb-1">Period Target</div>
                    <div className="text-sm font-bold text-white">{formatPrice(individualStats.periodTarget)}</div>
                  </div>
                  <div className="bg-white/10 p-3 rounded-xl border border-[#D4AF37]/30 text-center">
                    <div className="text-[9px] text-[#D4AF37] font-bold uppercase tracking-wider mb-1">Actual Sales</div>
                    <div className="text-sm font-bold text-[#D4AF37]">{formatPrice(individualStats.totalMySales)}</div>
                  </div>
                  <div className="bg-white/10 p-3 rounded-xl border border-white/10 text-center">
                    <div className="text-[9px] text-emerald-300 font-bold uppercase tracking-wider mb-1">Completed Sections</div>
                    <div className="text-sm font-bold text-white">{individualStats.totalMySections} Sec</div>
                  </div>
                </div>
              </div>

              {/* Financial Summary (Exact Excel Service Rates) */}
           <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100">
             <h3 className="font-bold text-gray-800 text-sm mb-4 flex items-center justify-between">
               <span className="flex items-center">
                 <Award className="w-4 h-4 mr-2 text-yellow-600" /> Financial Summary ({individualStats.staffName})
               </span>
               <span className="text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200">
                 {getStaffSeniority(individualStats.staffName, uniqueTherapists)} Rate (Excel Standard)
               </span>
             </h3>
             <div className="space-y-3">
               <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                 <span className="text-xs font-semibold text-gray-600">
                   Total Service Commissions ({individualStats.totalMySections} Sec — Exact Service Rates)
                 </span>
                 <span className="font-bold text-[#123524]">{formatPrice(individualStats.totalMyComm)}</span>
               </div>
               <div className="flex justify-between items-center p-3 bg-yellow-50 rounded-lg border border-yellow-200">
                 <span className="text-xs font-bold text-yellow-800">Final Expected Commission Pay</span>
                 <span className="font-black text-yellow-700 text-lg">{formatPrice(individualStats.totalMyComm)}</span>
               </div>
             </div>
           </div>

              {/* Attendance Summary */}
              <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100">
                <h3 className="font-bold text-gray-800 text-sm mb-2 flex items-center">
                  <Calendar className="w-4 h-4 mr-2 text-blue-500" /> Active Sales Attendance Summary
                </h3>
                <p className="text-[10px] text-gray-500 mb-4">
                  (ရွေးချယ်ထားသောကာလအတွင်း စုစုပေါင်း {individualStats.pastDaysCount} ရက်အတွင်း ဝန်ဆောင်မှုဝင်ရောက်ခဲ့သည့် ရက်များ)
                </p>

                <div className="grid grid-cols-2 gap-3 mb-4">
                  <div className="bg-green-50 p-3 rounded-xl border border-green-100 text-center shadow-sm">
                    <div className="text-[9px] text-green-600 font-bold uppercase tracking-wider mb-1">Active Sales Days</div>
                    <div className="text-2xl font-black text-green-700">
                      {individualStats.workedDaysCount}{' '}
                      <span className="text-[10px] font-bold text-green-600/70">/ {individualStats.pastDaysCount} Days</span>
                    </div>
                  </div>
                  <div className="bg-red-50 p-3 rounded-xl border border-red-100 text-center shadow-sm">
                    <div className="text-[9px] text-red-600 font-bold uppercase tracking-wider mb-1">No-Sale Days</div>
                    <div className="text-2xl font-black text-red-700">
                      {individualStats.missedDaysCount}{' '}
                      <span className="text-[10px] font-bold text-red-600/70">/ {individualStats.pastDaysCount} Days</span>
                    </div>
                  </div>
                </div>

                {individualStats.missedDaysCount > 0 ? (
                  <div className="bg-gray-50 p-3.5 rounded-xl border border-gray-200">
                    <span className="text-[10px] font-bold text-gray-500 mb-2.5 block">Section မဝင်ထားသော ရက်များ :</span>
                    <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto">
                      {individualStats.missedDays.map((md) => (
                        <span
                          key={md.date}
                          className="bg-white border border-red-200 text-red-500 text-[9px] font-bold px-2 py-1 rounded-md shadow-2xs"
                        >
                          Day {md.dayNo} ({md.date})
                        </span>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="bg-gray-50 p-3.5 rounded-xl border border-gray-200 text-center text-[10px] font-bold text-gray-500 flex flex-col items-center">
                    <CheckCircle className="w-5 h-5 text-green-500 mb-1.5" />
                    ရက်အားလုံး Section ဝင်ထားပါသည်။ အလွန်ကောင်းမွန်ပါတယ်။
                  </div>
                )}
              </div>

              {/* Dynamic Daily Tracker */}
              <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100">
                <h3 className="font-bold text-[#123524] text-sm mb-4 flex items-center justify-between">
                  <span className="flex items-center">
                    <Calendar className="w-4 h-4 mr-2 text-[#D4AF37]" /> Dynamic Daily Tracker (Live from Sale Summary)
                  </span>
                </h3>
                <div className="space-y-3 max-h-[550px] overflow-y-auto pr-1">
                  {individualStats.dailyBreakdown.map((item, idx) => (
                    <div
                      key={idx}
                      className={`p-4 rounded-xl border transition-all ${
                        item.hasSales ? 'bg-white border-gray-200 shadow-sm' : 'bg-gray-50/70 border-dashed border-gray-200'
                      }`}
                    >
                      <div className="flex justify-between items-center mb-2">
                        <div className="flex items-center space-x-2">
                          <span className="bg-[#123524] text-[#D4AF37] text-[10px] font-bold px-2 py-0.5 rounded">
                            Day {item.dayNo}
                          </span>
                          <span className="text-xs font-mono font-bold text-gray-700">{item.date}</span>
                        </div>
                        <div>
                          {item.hasSales ? (
                            <span className="bg-green-100 text-green-700 text-[9px] font-bold px-2 py-0.5 rounded uppercase tracking-wider">
                              Active Sale ({item.services.length} Sec)
                            </span>
                          ) : (
                            <span className="bg-gray-200 text-gray-600 text-[9px] font-bold px-2 py-0.5 rounded uppercase tracking-wider">
                              No Sales
                            </span>
                          )}
                        </div>
                      </div>

                      {item.hasSales && (
                        <div className="space-y-1.5 my-2 bg-gray-50 p-2.5 rounded-lg border border-gray-100">
                          {item.services.map((s: any, sIdx: number) => (
                            <div key={sIdx} className="flex justify-between items-center text-xs font-semibold text-gray-800">
                              <span className="truncate pr-2">
                                • {s.serviceName}{' '}
                                <span className="text-[9px] font-bold text-gray-400">({s.source})</span>
                              </span>
                              <span className="font-bold text-[#123524] whitespace-nowrap">{formatPrice(s.salesAmount)}</span>
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
                          <span className="text-[#123524] font-bold text-[9px] block mt-1.5">
                            Total Cum. Actual: {formatPrice(item.cumActual)}
                          </span>
                        </div>
                        <div className="text-right">
                          <span className="text-gray-400 font-semibold text-[10px] block">Adjusted Daily Target</span>
                          <span className="font-bold text-[#123524]">{formatPrice(item.adjustedDailyTarget)}</span>
                          <span className="text-[9px] text-gray-500 block mt-1.5">
                            Remaining: <span className="font-bold text-red-500">{formatPrice(item.remainingMonthlyTarget)}</span>
                          </span>
                          <span className="text-[9px] text-gray-500 block mt-0.5">
                            Cum. Target: {formatPrice(item.cumTarget)}
                          </span>
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

// ============================================================================
// 🌟 SHARED HELPER: NORMALIZE PHONE & CHECK CAMPAIGN REWARD STATUS 🌟
// ============================================================================
export const normalizeMyanmarPhone = (p: string): string => {
  return String(p || '')
    .replace(/[^0-9]/g, '')
    .replace(/^959/, '09')
    .trim();
};

/**
 * Checks if a customer's campaign reward is still valid for booking today.
 * Rule: Valid all day on the winning date UNTIL a booking/POS bill is marked as `completed` (Service Complete).
 */
export const isCampaignRewardUsedByCompletedService = (
  winnerPhone: string,
  winDate: string,
  allBookings: Booking[]
): { isUsed: boolean; completedBooking?: Booking; activePendingBooking?: Booking } => {
  const normWinPhone = normalizeMyanmarPhone(winnerPhone);
  if (!normWinPhone || normWinPhone.length < 7) return { isUsed: false };

  let completedBooking: Booking | undefined;
  let activePendingBooking: Booking | undefined;

  for (const b of allBookings) {
    if (!b || b.status === 'cancelled') continue;
    const normBPhone = normalizeMyanmarPhone(b.phone || '');
    if (normBPhone !== normWinPhone) continue;

    // Determine if this booking was created on or for the winning date
    const submittedDateStr = b.createdAt
      ? (() => {
          const d = new Date(b.createdAt);
          return (
            d.getFullYear() +
            '-' +
            String(d.getMonth() + 1).padStart(2, '0') +
            '-' +
            String(d.getDate()).padStart(2, '0')
          );
        })()
      : '';

    const isSameDayOrAfterWin =
      b.date === winDate ||
      submittedDateStr === winDate ||
      (b.date >= winDate && submittedDateStr >= winDate);

    if (!isSameDayOrAfterWin) continue;

    // Ignore 0 Ks walk-in reward redemptions or staff clock-ins
    if ((Number(b.totalPrice) || 0) <= 0 || Boolean((b as any).isAdminClockIn) || Boolean((b as any).isStaffClockIn)) {
      continue;
    }

    if (b.status === 'completed') {
      completedBooking = b;
      break;
    } else if (!activePendingBooking) {
      activePendingBooking = b;
    }
  }

  return {
    isUsed: Boolean(completedBooking),
    completedBooking,
    activePendingBooking
  };
};

function AdminCampaignsView({ bookings = [], adminRole = 'super_admin' }: { bookings?: Booking[]; adminRole?: string }) {
  const todayStr = getLocalTodayStr();
  const [records, setRecords] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active_unused' | 'used_completed' | 'expired'>('all');
  const [dateFilterMode, setDateFilterMode] = useState<'all' | 'today' | 'yesterday' | 'this_month' | 'custom_range'>('all');
  const [fromDate, setFromDate] = useState<string>(todayStr);
  const [toDate, setToDate] = useState<string>(todayStr);
  const [applyingBookingId, setApplyingBookingId] = useState<string | null>(null);

  const getYesterdayStr = () => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return (
      d.getFullYear() +
      '-' +
      String(d.getMonth() + 1).padStart(2, '0') +
      '-' +
      String(d.getDate()).padStart(2, '0')
    );
  };

  const getThisMonthPrefix = () => {
    const d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
  };

  const formatReadableDateHeader = (dateStr: string) => {
    if (!dateStr) return 'Unknown Date';
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
    if (dateStr === todayStr) return `ယနေ့ (Today) — ${formatted}`;
    if (dateStr === yesterday) return `မနေ့က (Yesterday) — ${formatted}`;
    return formatted;
  };

  // Real-time listener on campaign_records
  useEffect(() => {
    const q = query(collection(db, 'campaign_records'));
    const unsub = onSnapshot(
      q,
      (snap) => {
        const data: any[] = [];
        snap.forEach((d) => {
          const raw = d.data();
          const rawDate = String(raw.date || '').trim();
          // Extract clean YYYY-MM-DD even if time is appended
          const cleanDate = rawDate.match(/^(\d{4}-\d{2}-\d{2})/)
            ? rawDate.match(/^(\d{4}-\d{2}-\d{2})/)![1]
            : raw.createdAt
            ? (() => {
                const dt = new Date(raw.createdAt);
                return (
                  dt.getFullYear() +
                  '-' +
                  String(dt.getMonth() + 1).padStart(2, '0') +
                  '-' +
                  String(dt.getDate()).padStart(2, '0')
                );
              })()
            : todayStr;

          data.push({
            id: d.id,
            ...raw,
            cleanDate,
            phone: String(raw.phone || '').trim(),
            discountPercent: Number(raw.discountPercent) || 0
          });
        });
        data.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
        setRecords(data);
        setLoading(false);
      },
      () => setLoading(false)
    );
    return () => unsub();
  }, [todayStr]);

  // Enrich each winner record with real-time Usage Status (Used / Active / Expired)
  const enrichedRecords = useMemo(() => {
    return records.map((r) => {
      const usage = isCampaignRewardUsedByCompletedService(r.phone, r.cleanDate, bookings);
      let rewardStatus: 'used_completed' | 'active_unused' | 'expired' = 'active_unused';

      if (usage.isUsed) {
        rewardStatus = 'used_completed';
      } else if (r.cleanDate < todayStr) {
        // Past winning date and service was never completed -> Expired
        rewardStatus = 'expired';
      } else {
        // Won today and not yet completed in POS/Service -> Still Active!
        rewardStatus = 'active_unused';
      }

      // Check if customer has an active booking that forgot to apply the discount (like Dr. Than Htwe!)
      const activeBookingNeedsDiscount =
        usage.activePendingBooking &&
        (!usage.activePendingBooking.discountPercent || usage.activePendingBooking.discountPercent === 0) &&
        r.discountPercent > 0;

      return {
        ...r,
        rewardStatus,
        completedBooking: usage.completedBooking,
        activePendingBooking: usage.activePendingBooking,
        activeBookingNeedsDiscount
      };
    });
  }, [records, bookings, todayStr]);

  // 1. Date & Search Filter
  const dateAndSearchFiltered = useMemo(() => {
    const yesterday = getYesterdayStr();
    const thisMonthPrefix = getThisMonthPrefix();
    const q = search.trim().toLowerCase();

    return enrichedRecords.filter((r) => {
      const d = r.cleanDate || todayStr;
      if (dateFilterMode === 'today' && d !== todayStr) return false;
      if (dateFilterMode === 'yesterday' && d !== yesterday) return false;
      if (dateFilterMode === 'this_month' && !d.startsWith(thisMonthPrefix)) return false;
      if (dateFilterMode === 'custom_range') {
        const start = fromDate && toDate && fromDate > toDate ? toDate : fromDate;
        const end = fromDate && toDate && fromDate > toDate ? fromDate : toDate;
        if (start && d < start) return false;
        if (end && d > end) return false;
      }

      if (q) {
        const matchPhone = String(r.phone || '').toLowerCase().includes(q);
        const matchPct = `${r.discountPercent}%`.includes(q);
        const matchCustName =
          (r.completedBooking?.name || '').toLowerCase().includes(q) ||
          (r.activePendingBooking?.name || '').toLowerCase().includes(q);
        if (!matchPhone && !matchPct && !matchCustName) return false;
      }
      return true;
    });
  }, [enrichedRecords, dateFilterMode, fromDate, toDate, search, todayStr]);

  // 2. Status Filter
  const finalFilteredRecords = useMemo(() => {
    if (statusFilter === 'all') return dateAndSearchFiltered;
    return dateAndSearchFiltered.filter((r) => r.rewardStatus === statusFilter);
  }, [dateAndSearchFiltered, statusFilter]);

  // 3. KPI Summary Counts
  const summaryStats = useMemo(() => {
    let total = dateAndSearchFiltered.length;
    let usedCount = 0;
    let activeCount = 0;
    let expiredCount = 0;

    dateAndSearchFiltered.forEach((r) => {
      if (r.rewardStatus === 'used_completed') usedCount++;
      else if (r.rewardStatus === 'active_unused') activeCount++;
      else expiredCount++;
    });

    return { total, usedCount, activeCount, expiredCount };
  }, [dateAndSearchFiltered]);

  // 4. Group by Date
  const groupedByDate = useMemo(() => {
    const map = new Map<
      string,
      {
        date: string;
        items: any[];
        usedCount: number;
        activeCount: number;
        expiredCount: number;
      }
    >();

    finalFilteredRecords.forEach((r) => {
      const d = r.cleanDate || todayStr;
      if (!map.has(d)) {
        map.set(d, { date: d, items: [], usedCount: 0, activeCount: 0, expiredCount: 0 });
      }
      const grp = map.get(d)!;
      grp.items.push(r);
      if (r.rewardStatus === 'used_completed') grp.usedCount++;
      else if (r.rewardStatus === 'active_unused') grp.activeCount++;
      else grp.expiredCount++;
    });

    return Array.from(map.values()).sort((a, b) => b.date.localeCompare(a.date));
  }, [finalFilteredRecords, todayStr]);

  // 🌟 One-Click Fix: Apply Won Campaign Discount directly to a Customer's Pending Booking 🌟
  const handleApplyCampaignDiscountToBooking = async (winnerRecord: any, targetBooking: Booking) => {
    if (!targetBooking.id) return;
    const svcStr = String(targetBooking.service || '').toLowerCase();
    const isOutcall =
      svcStr.includes('outcall') ||
      svcStr.includes('hotel') ||
      svcStr.includes('half day') ||
      svcStr.includes('whole');

    // Outcall/Hotel services max 10% cap if applicable, otherwise full won discountPercent
    const appliedPct = isOutcall ? Math.min(10, winnerRecord.discountPercent) : winnerRecord.discountPercent;
    const origPrice = Number(targetBooking.originalPrice) || Number(targetBooking.totalPrice) || 0;
    const discountedTotal = Math.round(origPrice * (1 - appliedPct / 100));
    const labelText = `Campaign Winner Bonus (${appliedPct}% OFF)`;

    if (
      !window.confirm(
        `${targetBooking.name} (${winnerRecord.phone}) ၏ Booking တွင် ကံထူးထားသော ${appliedPct}% OFF အား ထည့်သွင်းပေးမည် သေချာပါသလား?\n\n• မူရင်းကျသင့်ငွေ: ${formatPrice(origPrice)}\n• ${appliedPct}% လျှော့ပြီး ကျသင့်ငွေအသစ်: ${formatPrice(discountedTotal)}`
      )
    ) {
      return;
    }

    setApplyingBookingId(targetBooking.id);
    try {
      const isDep = (targetBooking as any).paymentStatus === 'deposit_only';
      const depPaid = Number((targetBooking as any).depositPaid) || 0;
      const newBalanceDue = isDep ? Math.max(0, discountedTotal - depPaid) : 0;

      await updateDoc(doc(db, 'bookings', targetBooking.id), {
        originalPrice: encryptText(String(origPrice)),
        discountPercent: encryptText(String(appliedPct)),
        discountLabel: encryptText(labelText),
        totalPrice: discountedTotal,
        ...(isDep ? { balanceDue: newBalanceDue } : {})
      });
      alert(`✅ ${targetBooking.name} ၏ Booking အား ${appliedPct}% OFF (${formatPrice(discountedTotal)}) သို့ အောင်မြင်စွာ ပြင်ဆင်ပေးပြီးပါပြီ။`);
    } catch (err) {
      alert('Discount ထည့်သွင်းရာတွင် အမှားအယွင်းရှိနေပါသည်။');
    } finally {
      setApplyingBookingId(null);
    }
  };

  const handleContactUser = (phone: string, discount: number) => {
    if (!phone) return;
    let formattedPhone = phone.replace(/[^0-9+]/g, '');
    if (formattedPhone.startsWith('09')) {
      formattedPhone = '+959' + formattedPhone.substring(2);
    } else if (!formattedPhone.startsWith('+')) {
      formattedPhone = '+' + formattedPhone;
    }
    const msg = encodeURIComponent(
      `မင်္ဂလာပါခင်ဗျာ။ The Shangri-La Men's Retreat မှ ဆက်သွယ်တာပါ။ \nလူကြီးမင်း ကံထူးရရှိထားသော အထူး Discount (${discount}% OFF) အား ယနေ့အတွင်း လာရောက်အသုံးပြုနိုင်ပါပြီခင်ဗျာ။`
    );
    window.open(`https://t.me/${formattedPhone}?text=${msg}`, '_blank');
  };

  const handleDeleteRecord = async (id: string, phone: string) => {
    if (adminRole !== 'super_admin') {
      alert('Super Admin သာလျှင် ဖျက်ခွင့်ရှိပါသည်။');
      return;
    }
    if (!window.confirm(`ဖုန်းနံပါတ် [${phone}] ၏ မဲပေါက်မှတ်တမ်းကို ဖျက်မည် သေချာပါသလား?`)) return;
    await deleteDoc(doc(db, 'campaign_records', id));
  };

  const handleExportCSV = () => {
    const headers = [
      'Winning Date',
      'Phone Number',
      'Customer Name',
      'Discount Won (%)',
      'Reward Status',
      'Booking / Receipt Status',
      'Invoice / TxID',
      'Contact Source'
    ];
    const rows = finalFilteredRecords.map((r) => {
      const statusText =
        r.rewardStatus === 'used_completed'
          ? 'သုံးပြီးပြီ (Used - Service Completed)'
          : r.rewardStatus === 'active_unused'
          ? 'မသုံးရသေး (Active Today)'
          : 'သက်တမ်းကုန်ဆုံး (Expired - 1 Day Passed)';
      const linkedB = r.completedBooking || r.activePendingBooking;
      return [
        `"${r.cleanDate}"`,
        `"${r.phone}"`,
        `"${linkedB?.name || '-'}"`,
        `${r.discountPercent}%`,
        `"${statusText}"`,
        `"${linkedB ? linkedB.status.toUpperCase() : 'No Booking'}"`,
        `"${linkedB?.txId || '-'}"`,
        `"${r.telegramClicked ? 'Telegram' : 'App Only'}"`
      ];
    });
    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `Campaign_Winners_Report_${todayStr}.csv`;
    link.click();
  };

  return (
    <div className="bg-white p-5 sm:p-6 rounded-2xl shadow-sm border border-gray-200 space-y-6 animate-fade-in">
      {/* 1. Header & Export */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b border-gray-100 pb-4 gap-4">
        <div>
          <h2 className="text-xl font-bold flex items-center text-[#123524]">
            <PartyPopper className="mr-2 text-[#D4AF37]" /> Game Campaign Winners & Usage Tracker
          </h2>
          <p className="text-xs text-gray-500 mt-1">
            ကံထူးရှင်များ၏ ၁ ရက်တာ Discount ခံစားခွင့်သည် Shop POS မှ ဘောင်ချာထုတ်ပြီး Service Complete ဖြစ်မှသာ သုံးပြီးကြောင်း (Used) သတ်မှတ်ပါမည်
          </p>
        </div>
        <div className="flex items-center gap-2.5 w-full sm:w-auto">
          <button
            type="button"
            onClick={handleExportCSV}
            className="flex-1 sm:flex-none justify-center items-center flex px-4 py-2 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-xl text-xs font-black hover:bg-emerald-100 transition shadow-2xs"
          >
            <Download className="w-4 h-4 mr-1.5" /> Export Excel
          </button>
        </div>
      </div>

      {/* 2. 4 KPI Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        <div className="p-4 rounded-2xl bg-gray-50 border border-gray-200">
          <div className="text-[10px] font-extrabold text-gray-500 uppercase tracking-wider">
            စုစုပေါင်း ကံထူးရှင် (Total Winners)
          </div>
          <div className="text-2xl font-black text-[#123524] mt-1">{summaryStats.total} ဦး</div>
        </div>

        <div className="p-4 rounded-2xl bg-emerald-50/70 border border-emerald-200">
          <div className="text-[10px] font-extrabold text-emerald-800 uppercase tracking-wider">
            ✓ သုံးပြီးပြီ (Used / Completed)
          </div>
          <div className="text-2xl font-black text-emerald-700 mt-1">{summaryStats.usedCount} ဦး</div>
          <div className="text-[10px] font-semibold text-emerald-700/80 mt-0.5">
            ဘောင်ချာထုတ်ပြီး / Service ပြီးဆုံး
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-blue-50/70 border border-blue-200">
          <div className="text-[10px] font-extrabold text-blue-800 uppercase tracking-wider">
            ⏳ မသုံးရသေး (Active Today)
          </div>
          <div className="text-2xl font-black text-blue-700 mt-1">{summaryStats.activeCount} ဦး</div>
          <div className="text-[10px] font-semibold text-blue-700/80 mt-0.5">
            ယနေ့ ဘိုကင်တင်/အသုံးပြုနိုင်ဆဲ
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-red-50/70 border border-red-200">
          <div className="text-[10px] font-extrabold text-red-700 uppercase tracking-wider">
            ⏰ သက်တမ်းကုန်ဆုံး (Expired)
          </div>
          <div className="text-2xl font-black text-red-600 mt-1">{summaryStats.expiredCount} ဦး</div>
          <div className="text-[10px] font-semibold text-red-600/80 mt-0.5">
            ၁ ရက်ကျော်သွား၍ မသုံးလိုက်ရသူများ
          </div>
        </div>
      </div>

      {/* 3. Date Filter + Status Filter + Search Bar */}
      <div className="flex flex-col gap-3 bg-gray-50/80 p-3.5 rounded-2xl border border-gray-200">
        <div className="flex flex-wrap items-center justify-between gap-2.5">
          {/* Date Filter Pills */}
          <div className="flex flex-wrap items-center gap-1 bg-white p-1 rounded-xl border border-gray-200 shadow-2xs">
            {[
              { id: 'all', label: 'ရက်အားလုံး (All)' },
              { id: 'today', label: 'ယနေ့ (Today)' },
              { id: 'yesterday', label: 'မနေ့က (Yesterday)' },
              { id: 'this_month', label: 'ယခုလ (This Month)' }
            ].map((dm) => (
              <button
                key={dm.id}
                type="button"
                onClick={() => setDateFilterMode(dm.id as any)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                  dateFilterMode === dm.id
                    ? 'bg-[#123524] text-[#D4AF37] shadow-xs'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                {dm.label}
              </button>
            ))}
          </div>

          {/* From -> To Date Range Picker */}
          <div
            className={`flex flex-wrap items-center gap-2 px-3 py-1.5 rounded-xl border transition shadow-2xs ${
              dateFilterMode === 'custom_range'
                ? 'bg-[#123524] text-[#D4AF37] border-[#D4AF37]'
                : 'bg-white text-gray-700 border-gray-200'
            }`}
          >
            <Calendar className="w-3.5 h-3.5 text-[#D4AF37]" />
            <span className="text-[10px] font-bold uppercase opacity-75">From:</span>
            <input
              type="date"
              value={fromDate}
              onChange={(e) => {
                const val = e.target.value;
                setFromDate(val);
                if (toDate && val > toDate) setToDate(val);
                setDateFilterMode('custom_range');
              }}
              className="text-xs font-bold bg-transparent outline-none cursor-pointer"
            />
            <span className="text-xs font-black">➔</span>
            <span className="text-[10px] font-bold uppercase opacity-75">To:</span>
            <input
              type="date"
              value={toDate}
              onChange={(e) => {
                const val = e.target.value;
                setToDate(val);
                if (fromDate && val < fromDate) setFromDate(val);
                setDateFilterMode('custom_range');
              }}
              className="text-xs font-bold bg-transparent outline-none cursor-pointer"
            />
          </div>
        </div>

        {/* Bottom Row: Reward Usage Status Pills + Search */}
        <div className="flex flex-col lg:flex-row justify-between items-stretch lg:items-center gap-2.5 pt-2 border-t border-gray-200/60">
          <div className="flex flex-wrap bg-white p-1 rounded-xl border border-gray-200 shadow-2xs gap-1">
            <button
              type="button"
              onClick={() => setStatusFilter('all')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                statusFilter === 'all' ? 'bg-[#123524] text-white' : 'text-gray-600'
              }`}
            >
              အားလုံး ({summaryStats.total})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('active_unused')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                statusFilter === 'active_unused' ? 'bg-blue-600 text-white' : 'text-blue-700 hover:bg-blue-50'
              }`}
            >
              ⏳ မသုံးရသေး / Active ({summaryStats.activeCount})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('used_completed')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                statusFilter === 'used_completed' ? 'bg-emerald-700 text-white' : 'text-emerald-700 hover:bg-emerald-50'
              }`}
            >
              ✓ သုံးပြီးပြီ / Completed ({summaryStats.usedCount})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('expired')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                statusFilter === 'expired' ? 'bg-red-600 text-white' : 'text-red-600 hover:bg-red-50'
              }`}
            >
              ⏰ သက်တမ်းကုန်ဆုံး ({summaryStats.expiredCount})
            </button>
          </div>

          <div className="relative w-full lg:w-72">
            <input
              type="text"
              placeholder="ဖုန်းနံပါတ် သို့မဟုတ် အမည် ရှာရန်..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-8 py-2 bg-white border border-gray-200 rounded-xl outline-none focus:border-[#D4AF37] text-xs font-bold shadow-2xs"
            />
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-2.5" />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="absolute right-2.5 top-2.5 text-gray-400 hover:text-gray-600"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* 4. Date-Grouped Winners Table */}
      {loading ? (
        <div className="p-12 text-center text-gray-400 font-bold">Loading Campaign Winners...</div>
      ) : groupedByDate.length === 0 ? (
        <div className="p-12 text-center text-gray-400 font-bold border border-dashed border-gray-200 rounded-2xl">
          ရွေးချယ်ထားသော ရက်စွဲနှင့် စာရင်းအတွက် ကံထူးရှင်မှတ်တမ်း မရှိပါ။
        </div>
      ) : (
        <div className="space-y-6">
          {groupedByDate.map((grp) => (
            <div key={grp.date} className="rounded-2xl border border-gray-200 shadow-xs overflow-hidden bg-white">
              {/* Daily Header Banner */}
              <div className="bg-gradient-to-r from-[#123524] via-[#1a4a32] to-[#123524] px-4 sm:px-5 py-3 text-white flex flex-wrap items-center justify-between gap-3 border-b border-[#D4AF37]/40">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-white/10 border border-[#D4AF37]/40 flex items-center justify-center text-[#D4AF37]">
                    <Calendar className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="font-extrabold text-xs sm:text-sm text-[#D4AF37]">
                      {formatReadableDateHeader(grp.date)}
                    </div>
                    <div className="flex flex-wrap items-center gap-2 text-[11px] text-gray-200 font-semibold mt-0.5">
                      <span>ကံထူးရှင် စုစုပေါင်း: <strong>{grp.items.length} ဦး</strong></span>
                      <span>•</span>
                      <span className="text-emerald-300">သုံးပြီး: <strong>{grp.usedCount} ဦး</strong></span>
                      {grp.activeCount > 0 && (
                        <>
                          <span>•</span>
                          <span className="text-blue-300">မသုံးရသေး (Active): <strong>{grp.activeCount} ဦး</strong></span>
                        </>
                      )}
                      {grp.expiredCount > 0 && (
                        <>
                          <span>•</span>
                          <span className="text-red-300">သက်တမ်းကုန်: <strong>{grp.expiredCount} ဦး</strong></span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse min-w-[880px]">
                  <thead>
                    <tr className="border-b border-gray-100 bg-gray-50/70 text-[11px] text-gray-500 uppercase tracking-wider">
                      <th className="p-3.5">Winning Date</th>
                      <th className="p-3.5">Phone & Customer</th>
                      <th className="p-3.5">Discount Won</th>
                      <th className="p-3.5">Reward Usage Status (ခံစားခွင့် အခြေအနေ)</th>
                      <th className="p-3.5">Booking / POS Receipt</th>
                      <th className="p-3.5 text-right">Contact & Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 text-sm">
                    {grp.items.map((r) => {
                      const linkedB = r.completedBooking || r.activePendingBooking;
                      return (
                        <tr key={r.id} className="hover:bg-gray-50/80 transition">
                          <td className="p-3.5 font-mono text-xs font-bold text-gray-600">
                            <div>{r.cleanDate}</div>
                            {r.createdAt && (
                              <div className="text-[10px] text-gray-400">
                                {new Date(r.createdAt).toLocaleTimeString('en-US', {
                                  hour: '2-digit',
                                  minute: '2-digit'
                                })}
                              </div>
                            )}
                          </td>

                          <td className="p-3.5">
                            <div className="font-mono font-black text-[#123524] text-sm">{r.phone}</div>
                            {linkedB?.name && (
                              <div className="text-xs font-bold text-gray-600 mt-0.5">👤 {linkedB.name}</div>
                            )}
                          </td>

                          <td className="p-3.5">
                            <span className="font-black text-orange-700 bg-orange-50 px-3 py-1.5 rounded-xl border border-orange-200 text-xs inline-flex items-center gap-1 shadow-2xs">
                              <Sparkles className="w-3.5 h-3.5 text-orange-500" />
                              {r.discountPercent}% OFF
                            </span>
                          </td>

                          {/* Reward Usage Status Column */}
                          <td className="p-3.5">
                            {r.rewardStatus === 'used_completed' ? (
                              <div className="space-y-1">
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-800 border border-emerald-300 uppercase">
                                  <CheckCircle className="w-3 h-3" /> သုံးပြီးပြီ (Used / Service Complete)
                                </span>
                                <div className="text-[10px] font-semibold text-gray-500">
                                  ဘောင်ချာထုတ်ပြီး၍ ခံစားခွင့် ပိတ်သိမ်းပြီး
                                </div>
                              </div>
                            ) : r.rewardStatus === 'active_unused' ? (
                              <div className="space-y-1">
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black bg-blue-100 text-blue-800 border border-blue-300 uppercase animate-pulse">
                                  <Clock className="w-3 h-3" /> မသုံးရသေး (Active Today)
                                </span>
                                <div className="text-[10px] font-bold text-blue-700">
                                  {r.activePendingBooking
                                    ? `Booking တင်ထားဆဲ (${r.activePendingBooking.status.toUpperCase()})`
                                    : 'ယနေ့ ဘိုကင်တင်/အသုံးပြုနိုင်ဆဲ'}
                                </div>
                              </div>
                            ) : (
                              <div className="space-y-1">
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black bg-red-100 text-red-700 border border-red-200 uppercase">
                                  <AlertCircle className="w-3 h-3" /> သက်တမ်းကုန်ဆုံး (Expired)
                                </span>
                                <div className="text-[10px] font-semibold text-gray-400">
                                  ၁ ရက်ကျော်သွား၍ မသုံးလိုက်ရပါ
                                </div>
                              </div>
                            )}
                          </td>

                          {/* Linked Booking / One-Click Discount Fix */}
                          <td className="p-3.5 text-xs">
                            {linkedB ? (
                              <div className="space-y-1.5">
                                <div className="font-bold text-gray-800">
                                  {linkedB.service} • <span className="text-[#123524]">{formatPrice(linkedB.totalPrice)}</span>
                                </div>
                                <div className="text-[10px] text-gray-500 font-mono">
                                  TxID: {linkedB.txId || '-'} | Status: <strong>{linkedB.status.toUpperCase()}</strong>
                                </div>
                                {r.activeBookingNeedsDiscount && (
                                  <button
                                    type="button"
                                    disabled={applyingBookingId === linkedB.id}
                                    onClick={() => handleApplyCampaignDiscountToBooking(r, linkedB)}
                                    className="px-2.5 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-white font-black text-[10px] shadow-xs flex items-center gap-1 transition"
                                  >
                                    <Sparkles className="w-3 h-3" />
                                    {applyingBookingId === linkedB.id
                                      ? 'Applying...'
                                      : `Booking တွင် ${r.discountPercent}% OFF ပြန်နှုတ်ပေးမည်`}
                                  </button>
                                )}
                              </div>
                            ) : (
                              <span className="text-gray-400 font-semibold text-[11px]">Booking မတင်ရသေးပါ</span>
                            )}
                          </td>

                          <td className="p-3.5 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                type="button"
                                onClick={() => handleContactUser(r.phone, r.discountPercent)}
                                className="text-[10px] bg-blue-50 text-blue-600 border border-blue-200 px-3 py-1.5 rounded-lg font-bold flex items-center hover:bg-blue-100 transition whitespace-nowrap"
                              >
                                <MessageCircle className="w-3.5 h-3.5 mr-1" /> Telegram ပို့မည်
                              </button>
                              {adminRole === 'super_admin' && (
                                <button
                                  type="button"
                                  onClick={() => handleDeleteRecord(r.id, r.phone)}
                                  className="p-1.5 rounded-lg bg-gray-100 text-gray-500 hover:bg-red-50 hover:text-red-600 transition"
                                  title="Delete Record"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function AdminPOSSalesList({ bookings, adminRole }: { bookings: Booking[], adminRole: string }) {
    const [filterStatus, setFilterStatus] = useState<'all' | 'deposit_only' | 'paid_in_full' | 'cancelled'>('all');
    const [dateFilterMode, setDateFilterMode] = useState<'all' | 'today' | 'yesterday' | 'this_month' | 'last_month' | 'custom_range'>('all');
    const [fromDate, setFromDate] = useState<string>(getLocalTodayStr());
    const [toDate, setToDate] = useState<string>(getLocalTodayStr());

    const getThisMonthPrefix = () => {
        const d = new Date();
        return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
    };
    const getLastMonthPrefix = () => {
        const d = new Date();
        d.setDate(1);
        d.setMonth(d.getMonth() - 1);
        return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
    };
    const [searchQuery, setSearchQuery] = useState('');
    const [approvingId, setApprovingId] = useState<string | null>(null);

    // 🌟 View Receipt Modal & Cancel Receipt Modal States 🌟
    const [viewingSale, setViewingSale] = useState<any | null>(null);
    const [cancellingSale, setCancellingSale] = useState<any | null>(null);
    const [cancelReasonInput, setCancelReasonInput] = useState<string>('');
    const [isSubmittingCancel, setIsSubmittingCancel] = useState(false);

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

    const safeParseNumber = (val: any): number => {
        if (val === undefined || val === null || val === '') return 0;
        if (typeof val === 'number') return isNaN(val) ? 0 : val;
        const strVal = String(val).trim();
        const dec = decryptText(strVal);
        const parsed = Number(dec || strVal);
        return isNaN(parsed) ? 0 : parsed;
    };

    const safeParseText = (val: any): string => {
        if (!val) return '';
        if (typeof val !== 'string') return String(val);
        return decryptText(val) || val;
    };

    // 🌟 STRICT FILTER: ဆိုင်တွင် တိုက်ရိုက်လာသော POS Walk-in (SL-...) ဘောင်ချာအစစ်များကိုသာ ယူမည် (Online Booking များကို လုံးဝ မယူပါ) 🌟
    const posSales = useMemo(() => {
        return bookings.filter((b: any) => {
            // ❌ Online Booking ဖြစ်ပါက POS Walk-in Sales ထဲတွင် လုံးဝ မပြပါ
            if (Boolean(b.isOnlineBooking) || Boolean(b.onlineBookingId)) return false;

            const rawTx = safeParseText(b.txId).trim().toUpperCase();
            const rawPay = String(b.paymentMethod || '').trim();
            const rawDisc = safeParseText(b.discountLabel).trim();
            const rawNote = safeParseText(b.specialRequest).trim();

            if (rawTx === 'ADMIN' || rawTx === 'CASH') return false;
            // Online Booking မှ ပြောင်းလဲထားသော မှတ်တမ်းအဟောင်းများကိုလည်း POS Sales ထဲ မပြပါ
            if (rawNote.includes('Online Booking TxID:')) return false;

            const isStrictPosBill =
                rawTx.startsWith('SL-') ||
                rawPay.includes('Shop POS') ||
                rawDisc.includes('[Shop Walk-in') ||
                Boolean(b.posLocalId);

            return isStrictPosBill;
        });
    }, [bookings]);

    // 🌟 1. ရက်စွဲ (Date Filter) နှင့် Search Query စစ်ထုတ်ခြင်း 🌟
    const dateAndSearchFilteredSales = useMemo(() => {
        const today = getLocalTodayStr();
        const yesterday = getYesterdayStr();
        const thisMonthPrefix = getThisMonthPrefix();
        const lastMonthPrefix = getLastMonthPrefix();
        const q = searchQuery.trim().toLowerCase();

        return posSales.filter((s: any) => {
            const saleDate = s.date || today;
            if (dateFilterMode === 'today' && saleDate !== today) return false;
            if (dateFilterMode === 'yesterday' && saleDate !== yesterday) return false;
            if (dateFilterMode === 'this_month' && !saleDate.startsWith(thisMonthPrefix)) return false;
            if (dateFilterMode === 'last_month' && !saleDate.startsWith(lastMonthPrefix)) return false;
            if (dateFilterMode === 'custom_range') {
                const start = fromDate && toDate && fromDate > toDate ? toDate : fromDate;
                const end = fromDate && toDate && fromDate > toDate ? fromDate : toDate;
                if (start && saleDate < start) return false;
                if (end && saleDate > end) return false;
            }

            if (q) {
                const rawTx = safeParseText(s.txId).toLowerCase();
                const custName = safeParseText(s.name).toLowerCase();
                const custPhone = safeParseText(s.phone).toLowerCase();
                const discLabel = safeParseText(s.discountLabel).toLowerCase();
                const cancelReason = safeParseText(s.cancelReason).toLowerCase();
                const matchesSearch =
                    rawTx.includes(q) ||
                    custName.includes(q) ||
                    custPhone.includes(q) ||
                    discLabel.includes(q) ||
                    cancelReason.includes(q) ||
                    (s.service || '').toLowerCase().includes(q) ||
                    (s.therapist || '').toLowerCase().includes(q);
                if (!matchesSearch) return false;
            }
            return true;
        });
    }, [posSales, dateFilterMode, fromDate, toDate, searchQuery]);

    // 🌟 2. Payment / Cancelled Status Filter ထပ်စစ်ခြင်း 🌟
    const filteredPosSales = useMemo(() => {
        return dateAndSearchFilteredSales.filter((s: any) => {
            const isCancelled = s.status === 'cancelled';
            if (filterStatus === 'cancelled') return isCancelled;

            // ကျန်ငွေရရန်ကျန် နှင့် အပြည့်ချေပြီး Filter များတွင် Cancelled ဖြစ်ပြီးသားများကို မပြပါ
            if (filterStatus === 'deposit_only') {
                return !isCancelled && s.paymentStatus === 'deposit_only' && safeParseNumber(s.balanceDue) > 0;
            }
            if (filterStatus === 'paid_in_full') {
                return !isCancelled && !(s.paymentStatus === 'deposit_only' && safeParseNumber(s.balanceDue) > 0);
            }
            return true; // 'all' တွင် Active ရော Cancelled Record ပါ အားလုံးပြပေးမည်
        });
    }, [dateAndSearchFilteredSales, filterStatus]);

    // 🌟 3. Summary Cards (4 Cards) တွက်ချက်ခြင်း (Cancelled ဘောင်ချာများကို အရောင်းစာရင်းမှ အလိုအလျောက် နှုတ်ထားပါသည်!) 🌟
    const summaryStats = useMemo(() => {
        let totalSalesAmt = 0;
        let totalDiscountGivenAmt = 0;
        let totalCollectedAmt = 0;
        let totalPendingBalanceAmt = 0;
        let pendingBalanceCount = 0;
        let activeBillsCount = 0;
        let cancelledBillsCount = 0;

        dateAndSearchFilteredSales.forEach((s: any) => {
            if (s.status === 'cancelled') {
                cancelledBillsCount++;
                return; // Cancelled ဘောင်ချာများကို ငွေစာရင်းပေါင်းချုပ်ထဲ လုံးဝမထည့်ပါ
            }
            activeBillsCount++;
            const total = safeParseNumber(s.totalPrice);
            const orig = safeParseNumber(s.originalPrice) || total;
            const discAmt = orig > total ? orig - total : 0;

            const isDepositDue = s.paymentStatus === 'deposit_only' && safeParseNumber(s.balanceDue) > 0;
            const due = isDepositDue ? safeParseNumber(s.balanceDue) : 0;
            const paid = isDepositDue ? (safeParseNumber(s.depositPaid) || Math.max(0, total - due)) : total;

            totalSalesAmt += total;
            totalDiscountGivenAmt += discAmt;
            totalCollectedAmt += paid;
            totalPendingBalanceAmt += due;
            if (isDepositDue) pendingBalanceCount++;
        });

        return {
            totalSalesAmt,
            totalDiscountGivenAmt,
            totalCollectedAmt,
            totalPendingBalanceAmt,
            pendingBalanceCount,
            activeBillsCount,
            cancelledBillsCount
        };
    }, [dateAndSearchFilteredSales]);

    // 🌟 4. ရက်စွဲတစ်ရက်ချင်းစီအလိုက် အုပ်စုဖွဲ့ပြီး Daily Total တွက်ချက်ခြင်း (Cancelled များကို နှုတ်ပြီး တွက်သည်) 🌟
    const groupedSalesByDate = useMemo(() => {
        const today = getLocalTodayStr();
        const groupsMap = new Map<
            string,
            {
                date: string;
                sales: any[];
                activeCount: number;
                cancelledCount: number;
                dailyTotalAmount: number;
                dailyDiscountAmount: number;
                dailyCashTotal: number;
                dailyOnlineTotal: number;
                dailyPendingBalance: number;
            }
        >();

        filteredPosSales.forEach((sale: any) => {
            const dKey = sale.date || today;
            if (!groupsMap.has(dKey)) {
                groupsMap.set(dKey, {
                    date: dKey,
                    sales: [],
                    activeCount: 0,
                    cancelledCount: 0,
                    dailyTotalAmount: 0,
                    dailyDiscountAmount: 0,
                    dailyCashTotal: 0,
                    dailyOnlineTotal: 0,
                    dailyPendingBalance: 0
                });
            }
            const grp = groupsMap.get(dKey)!;
            grp.sales.push(sale);

            if (sale.status === 'cancelled') {
                grp.cancelledCount += 1;
                return; // Cancelled ဘောင်ချာကို Daily Total ထဲ မပေါင်းပါ
            }

            grp.activeCount += 1;
            const total = safeParseNumber(sale.totalPrice);
            const orig = safeParseNumber(sale.originalPrice) || total;
            const discAmt = orig > total ? orig - total : 0;
            const isDepositDue = sale.paymentStatus === 'deposit_only' && safeParseNumber(sale.balanceDue) > 0;
            const due = isDepositDue ? safeParseNumber(sale.balanceDue) : 0;
            const paidNow = isDepositDue ? (safeParseNumber(sale.depositPaid) || Math.max(0, total - due)) : total;

            grp.dailyTotalAmount += total;
            grp.dailyDiscountAmount += discAmt;
            grp.dailyPendingBalance += due;

            const cleanMethod = (sale.paymentMethod || 'Cash').toLowerCase();
            if (cleanMethod.includes('cash')) {
                grp.dailyCashTotal += paidNow;
            } else {
                grp.dailyOnlineTotal += paidNow;
            }
        });

        return Array.from(groupsMap.values()).sort((a, b) => b.date.localeCompare(a.date));
    }, [filteredPosSales]);

    const handleApproveBalanceInAdmin = async (sale: any) => {
        const rawTx = safeParseText(sale.txId);
        const balanceAmt = safeParseNumber(sale.balanceDue);
        if (!window.confirm(`ဘောင်ချာ [${rawTx}] ၏ ကျန်ငွေ (${formatPrice(balanceAmt)}) အား အပြည့်အဝ လက်ခံရရှိပြီးကြောင်း Approve လုပ်မည်မှာ သေချာပါသလား?`)) {
            return;
        }

        setApprovingId(sale.id);
        try {
            const cleanMethod = (sale.paymentMethod || 'Online Pay').split('(')[0].trim();
            const prevNote = safeParseText(sale.specialRequest);
            const cleanNote = prevNote.split('| [PENDING BALANCE]')[0].trim();

            await updateDoc(doc(db, 'bookings', sale.id), {
                paymentStatus: 'paid_in_full',
                balanceDue: 0,
                depositPaid: safeParseNumber(sale.totalPrice),
                paymentMethod: `${cleanMethod} (Full Paid - Approved)`,
                specialRequest: encryptText(`${cleanNote} | [BALANCE APPROVED]: ကျန်ငွေ ${formatPrice(balanceAmt)} အပြည့်အဝ လက်ခံရရှိပြီး`)
            });

            alert(`✅ ဘောင်ချာ [${rawTx}] ၏ ကျန်ငွေ ${formatPrice(balanceAmt)} အား အောင်မြင်စွာ Approve ပြုလုပ်ပြီးပါပြီ။`);
        } catch (err) {
            console.error('Approve balance failed:', err);
            alert('ကျန်ငွေ Approve ပြုလုပ်ရာတွင် အမှားအယွင်းရှိနေပါသည်။');
        } finally {
            setApprovingId(null);
        }
    };

    // 🌟 Cancel Receipt Function (Shop POS မှ ဖျက်ပေးပြီး Admin တွင် Cancel Reason မှတ်တမ်းကျန်စေကာ အရောင်းစာရင်းမှ နှုတ်ပေးမည်) 🌟
    const handleConfirmCancelReceipt = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!cancellingSale) return;
        const reason = cancelReasonInput.trim();
        if (!reason) {
            alert('ကျေးဇူးပြု၍ ဘောင်ချာ ပယ်ဖျက်ရသည့် အကြောင်းရင်း (Cancel Reason) ရေးပေးပါ။');
            return;
        }

        setIsSubmittingCancel(true);
        try {
            const rawTx = safeParseText(cancellingSale.txId);
            await updateDoc(doc(db, 'bookings', cancellingSale.id), {
                status: 'cancelled',
                cancelReason: reason,
                cancelledAt: Date.now()
            });

            alert(`✅ ဘောင်ချာ [${rawTx}] အား ပယ်ဖျက်ပြီး မှတ်တမ်းတင်လိုက်ပါပြီ။\nShop POS မှ အလိုအလျောက် ပျက်သွားပြီး အရောင်းစာရင်းချုပ်မှ နှုတ်ပေးထားပါသည်။`);
            setCancellingSale(null);
            setCancelReasonInput('');
        } catch (err) {
            console.error('Cancel receipt error:', err);
            alert('ဘောင်ချာ ပယ်ဖျက်ရာတွင် အမှားအယွင်းရှိနေပါသည်။');
        } finally {
            setIsSubmittingCancel(false);
        }
    };

    const handleExportPOSExcel = () => {
        const headers = [
            'Invoice No',
            'Receipt Status',
            'Cancel Reason',
            'Date',
            'Time',
            'Customer Name',
            'Phone',
            'Service Items',
            'Therapist',
            'Original Price (Ks)',
            'Discount Percent (%)',
            'Discount Amount (Ks)',
            'Discount Label / Reason',
            'Net Total Price (Ks)',
            'Payment Method',
            'Payment Status',
            'Deposit Paid (Ks)',
            'Balance Due (Ks)',
            'Special Note',
            'Submitted At'
        ];

        const rows = filteredPosSales.map((s: any) => {
            const isCancelled = s.status === 'cancelled';
            const total = safeParseNumber(s.totalPrice);
            const orig = safeParseNumber(s.originalPrice) || total;
            const discAmt = orig > total ? orig - total : 0;
            const discPct = safeParseNumber(s.discountPercent) || (orig > 0 && discAmt > 0 ? Math.round((discAmt / orig) * 100) : 0);
            const discLabel = safeParseText(s.discountLabel).replace('[Shop Walk-in Sale]', '').replace('[Shop Walk-in]', '').trim();

            const isDepositDue = !isCancelled && s.paymentStatus === 'deposit_only' && safeParseNumber(s.balanceDue) > 0;
            const due = isDepositDue ? safeParseNumber(s.balanceDue) : 0;
            const paid = isCancelled ? 0 : isDepositDue ? (safeParseNumber(s.depositPaid) || Math.max(0, total - due)) : total;

            return [
                `"${safeParseText(s.txId)}"`,
                `"${isCancelled ? 'CANCELLED' : 'VALID'}"`,
                `"${isCancelled ? safeParseText(s.cancelReason) : ''}"`,
                `"${s.date || ''}"`,
                `"${s.time || ''}"`,
                `"${safeParseText(s.name)}"`,
                `"${safeParseText(s.phone)}"`,
                `"${s.service || ''}"`,
                `"${s.therapist || ''}"`,
                orig,
                discPct,
                discAmt,
                `"${discLabel || 'No Discount'}"`,
                isCancelled ? 0 : total,
                `"${s.paymentMethod || ''}"`,
                `"${isCancelled ? 'Cancelled' : isDepositDue ? 'Deposit Only (Balance Pending)' : 'Paid in Full'}"`,
                paid,
                due,
                `"${safeParseText(s.specialRequest)}"`,
                `"${s.createdAt ? new Date(s.createdAt).toLocaleString() : ''}"`
            ];
        });

        const csvContent = '\uFEFF' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', `POS_WalkIn_Sales_Report_${dateFilterMode === 'custom_range' ? `${fromDate}_to_${toDate}` : getLocalTodayStr()}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    return (
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200 animate-fade-in space-y-6">
            {/* ==========================================
                MODAL 1: VIEW RECEIPT DETAILS (ဘောင်ချာ အသေးစိတ် ကြည့်ရန်)
               ========================================== */}
            {viewingSale && (() => {
                const rawTx = safeParseText(viewingSale.txId);
                const custName = safeParseText(viewingSale.name) || 'Walk-in Guest';
                const custPhone = safeParseText(viewingSale.phone) || '-';
                const totalPrice = safeParseNumber(viewingSale.totalPrice);
                const origPrice = safeParseNumber(viewingSale.originalPrice) || totalPrice;
                const discAmt = origPrice > totalPrice ? origPrice - totalPrice : 0;
                const cleanDiscLabel = safeParseText(viewingSale.discountLabel)
                    .replace('[Shop Walk-in Sale]', '')
                    .replace('[Shop Walk-in]', '')
                    .trim();
                const isCancelled = viewingSale.status === 'cancelled';
                const isDepDue = !isCancelled && viewingSale.paymentStatus === 'deposit_only' && safeParseNumber(viewingSale.balanceDue) > 0;
                const depAmt = safeParseNumber(viewingSale.depositPaid);
                const balAmt = safeParseNumber(viewingSale.balanceDue);
                const serviceList = String(viewingSale.service || '').split(',').map(s => s.trim()).filter(Boolean);

                return (
                    <div className="fixed inset-0 z-[250] bg-black/70 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
                        <div className="bg-white rounded-3xl max-w-sm w-full p-5 shadow-2xl border border-[#D4AF37]/40 my-auto animate-fade-in space-y-4">
                            <div className="flex justify-between items-center border-b border-gray-100 pb-3">
                                <h3 className="text-sm font-black text-[#123524] flex items-center">
                                    <ClipboardList className="w-4 h-4 mr-1.5 text-[#D4AF37]" />
                                    POS Receipt Details (ဘောင်ချာအသေးစိတ်)
                                </h3>
                                <button onClick={() => setViewingSale(null)} className="p-1 rounded-full bg-gray-100 text-gray-500 hover:text-red-600">
                                    <X className="w-4 h-4" />
                                </button>
                            </div>

                            {/* Thermal Receipt Visual Card */}
                            <div className="bg-gray-50 p-4 rounded-2xl border border-gray-200 font-mono text-xs space-y-3 relative overflow-hidden">
                                {isCancelled && (
                                    <div className="bg-red-600 text-white text-center py-1.5 px-3 rounded-lg font-sans font-black text-xs uppercase tracking-widest shadow-sm">
                                        🚫 CANCELLED RECEIPT (ပယ်ဖျက်ထားသည်)
                                    </div>
                                )}

                                <div className="text-center border-b border-dashed border-gray-300 pb-2.5">
                                    <div className="font-serif font-black text-sm text-[#123524]">THE SHANGRI-LA</div>
                                    <div className="text-[9px] text-gray-500 uppercase tracking-widest">MEN'S RETREAT • POS RECEIPT</div>
                                </div>

                                <div className="space-y-1 text-[11px] border-b border-dashed border-gray-300 pb-2.5">
                                    <div className="flex justify-between">
                                        <span className="text-gray-500">Invoice No:</span>
                                        <span className="font-black text-[#123524]">{rawTx}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-gray-500">Date & Time:</span>
                                        <span className="font-bold">{viewingSale.date} {viewingSale.time}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-gray-500">Customer:</span>
                                        <span className="font-bold text-right">{custName} ({custPhone})</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-gray-500">Therapist:</span>
                                        <span className="font-bold text-[#123524] text-right">{viewingSale.therapist || '-'}</span>
                                    </div>
                                </div>

                                <div className="space-y-1.5 border-b border-dashed border-gray-300 pb-2.5">
                                    <div className="text-[10px] font-bold text-gray-400 uppercase">Services & Sale Items:</div>
                                    {serviceList.map((svc, i) => (
                                        <div key={i} className="text-[11px] font-bold text-gray-800 pl-1">
                                            {i + 1}. {svc}
                                        </div>
                                    ))}
                                </div>

                                <div className="space-y-1 text-xs">
                                    <div className="flex justify-between text-[11px]">
                                        <span className="text-gray-500">Subtotal (မူရင်းကျသင့်ငွေ):</span>
                                        <span className="font-bold">{formatPrice(origPrice)}</span>
                                    </div>
                                    {discAmt > 0 && (
                                        <div className="flex justify-between text-[11px] text-green-700 font-bold">
                                            <span>Discount ({cleanDiscLabel || 'Promo'}):</span>
                                            <span>-{formatPrice(discAmt)}</span>
                                        </div>
                                    )}
                                    <div className={`flex justify-between text-sm font-black py-1.5 border-t border-dashed border-gray-300 ${isCancelled ? 'line-through text-gray-400' : 'text-[#123524]'}`}>
                                        <span>NET TOTAL:</span>
                                        <span>{formatPrice(totalPrice)}</span>
                                    </div>
                                    <div className="flex justify-between text-[11px]">
                                        <span className="text-gray-500">Payment Method:</span>
                                        <span className="font-bold">{viewingSale.paymentMethod || 'Cash'}</span>
                                    </div>
                                    {isDepDue && (
                                        <div className="p-2 rounded-lg bg-amber-50 border border-amber-200 mt-1 space-y-0.5 font-sans">
                                            <div className="flex justify-between text-[10px] font-bold text-amber-900">
                                                <span>စရံပေးချေပြီး:</span>
                                                <span>{formatPrice(depAmt)}</span>
                                            </div>
                                            <div className="flex justify-between text-[11px] font-black text-red-600">
                                                <span>ကျန်ငွေ (Balance Due):</span>
                                                <span>{formatPrice(balAmt)}</span>
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {isCancelled && viewingSale.cancelReason && (
                                    <div className="p-2.5 rounded-xl bg-red-50 border border-red-200 font-sans text-xs space-y-1">
                                        <div className="text-[10px] font-black text-red-700 uppercase">ပယ်ဖျက်ရသည့် အကြောင်းရင်း (Cancel Reason):</div>
                                        <div className="font-bold text-red-900">{safeParseText(viewingSale.cancelReason)}</div>
                                        {(viewingSale as any).cancelledAt && (
                                            <div className="text-[9px] text-red-500 font-semibold">
                                                Cancelled At: {new Date((viewingSale as any).cancelledAt).toLocaleString()}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>

                            <div className="flex gap-2">
                                {!isCancelled && adminRole === 'super_admin' && (
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setCancellingSale(viewingSale);
                                            setViewingSale(null);
                                        }}
                                        className="flex-1 py-2.5 bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 rounded-xl font-black text-xs transition"
                                    >
                                        🚫 Cancel Receipt
                                    </button>
                                )}
                                <button
                                    type="button"
                                    onClick={() => setViewingSale(null)}
                                    className="flex-1 py-2.5 bg-[#123524] text-[#D4AF37] rounded-xl font-black text-xs transition"
                                >
                                    ပိတ်မည် (Close)
                                </button>
                            </div>
                        </div>
                    </div>
                );
            })()}

            {/* ==========================================
                MODAL 2: CANCEL RECEIPT WITH REASON (ဘောင်ချာပယ်ဖျက်ရန် နှင့် အကြောင်းပြချက်မှတ်တမ်းတင်ရန်)
               ========================================== */}
            {cancellingSale && (
                <div className="fixed inset-0 z-[260] bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
                    <form
                        onSubmit={handleConfirmCancelReceipt}
                        className="bg-white rounded-2xl max-w-md w-full p-5 shadow-2xl border border-red-200 space-y-4 animate-fade-in"
                    >
                        <div className="flex justify-between items-start border-b border-gray-100 pb-3">
                            <div>
                                <h3 className="text-base font-black text-red-600 flex items-center">
                                    <AlertCircle className="w-5 h-5 mr-1.5" />
                                    Cancel POS Receipt (ဘောင်ချာ ပယ်ဖျက်ရန်)
                                </h3>
                                <p className="text-xs text-gray-500 mt-0.5">
                                    Invoice: <strong className="font-mono text-gray-800">{safeParseText(cancellingSale.txId)}</strong> • ပမာဏ:{' '}
                                    <strong className="text-[#123524]">{formatPrice(safeParseNumber(cancellingSale.totalPrice))}</strong>
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={() => {
                                    setCancellingSale(null);
                                    setCancelReasonInput('');
                                }}
                                className="text-gray-400 hover:text-gray-700"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="bg-amber-50 p-3 rounded-xl border border-amber-200 text-[11px] text-amber-900 font-semibold leading-relaxed">
                            ⚠️ <strong>Cancel Receipt</strong> ပြုလုပ်လိုက်ပါက—
                            <ul className="list-disc pl-4 mt-1 space-y-0.5">
                                <li>ဆိုင်ရှိ <strong>Shop POS (Receipts History)</strong> ထဲမှ ဤဘောင်ချာ အလိုအလျောက် ပျက်သွားပါမည်။</li>
                                <li>အရောင်းစာရင်းချုပ် (Daily Total & Sale Summary) မှ ချက်ချင်း နှုတ်ပေးသွားပါမည်။</li>
                                <li>Admin တွင်မူ မည်သည့်အကြောင်းကြောင့် ပယ်ဖျက်ခဲ့သည်ဆိုသော <strong>Cancelled Record</strong> အဖြစ် ကျန်ရှိနေပါမည်။</li>
                            </ul>
                        </div>

                        <div>
                            <label className="block text-xs font-extrabold text-gray-700 mb-1.5">
                                ဘောင်ချာ ပယ်ဖျက်ရသည့် အကြောင်းရင်း (Cancel Reason) *
                            </label>
                            <textarea
                                required
                                rows={3}
                                value={cancelReasonInput}
                                onChange={(e) => setCancelReasonInput(e.target.value)}
                                placeholder="ဥပမာ - ဘောင်ချာ ၂ ခါ မှားရိုက်မိသောကြောင့် / ဝန်ဆောင်မှု ပြန်လည်ပယ်ဖျက်သောကြောင့်..."
                                className="w-full p-3 bg-gray-50 border border-gray-300 rounded-xl text-xs font-bold text-gray-800 outline-none focus:border-red-500"
                            />
                            {/* Quick Reason Chips */}
                            <div className="flex flex-wrap gap-1.5 mt-2">
                                {[
                                    'ဘောင်ချာ ၂ စောင် ထပ်နေသောကြောင့် (Duplicate)',
                                    'စမ်းသပ်ရိုက်ထားသော ဘောင်ချာ (Test Bill)',
                                    'ဈေးနှုန်း/Service မှားရိုက်မိ၍ အသစ်ပြန်ရိုက်',
                                    'Customer မှ ပြန်လည်ပယ်ဖျက် (Customer Cancelled)'
                                ].map((preset, i) => (
                                    <button
                                        key={i}
                                        type="button"
                                        onClick={() => setCancelReasonInput(preset)}
                                        className="text-[10px] font-bold bg-gray-100 hover:bg-gray-200 text-gray-700 px-2.5 py-1 rounded-lg transition"
                                    >
                                        + {preset}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="flex gap-2.5 pt-2">
                            <button
                                type="button"
                                onClick={() => {
                                    setCancellingSale(null);
                                    setCancelReasonInput('');
                                }}
                                className="flex-1 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl font-bold text-xs transition"
                            >
                                မလုပ်တော့ပါ
                            </button>
                            <button
                                type="submit"
                                disabled={isSubmittingCancel || !cancelReasonInput.trim()}
                                className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl font-black text-xs shadow-md transition disabled:opacity-50"
                            >
                                {isSubmittingCancel ? 'Cancelling...' : '🚫 Confirm Cancel Receipt'}
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {/* 1. Title & Export Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b border-gray-100 pb-4 gap-4">
                <div>
                    <h2 className="text-xl font-bold flex items-center" style={{ color: THEME.primary }}>
                        <ShoppingBag className="mr-2 text-[#D4AF37]" /> Shop Walk-in POS Sales & Balance Approval
                    </h2>
                    <p className="text-xs text-gray-500 mt-1">
                        ရက်စွဲအလိုက် POS ဘောင်ချာများ၊ တစ်ရက်စာ ရောင်းရငွေချုပ် (Daily Total)၊ ဘောင်ချာအသေးစိတ် နှင့် ပယ်ဖျက်မှတ်တမ်းများ စစ်ဆေးရန်
                    </p>
                </div>
                <div className="flex items-center space-x-3 w-full sm:w-auto">
                    <button onClick={handleExportPOSExcel} className="flex-1 sm:flex-none justify-center items-center flex px-4 py-2 bg-green-50 text-green-700 border border-green-200 rounded-lg text-xs font-bold hover:bg-green-100 transition shadow-sm">
                        <Download className="w-4 h-4 mr-1.5" /> Export Excel
                    </button>
                    <span className="bg-yellow-100 text-yellow-800 px-4 py-2 rounded-lg text-xs font-black border border-yellow-200">
                        Valid Bills: {summaryStats.activeBillsCount}
                    </span>
                </div>
            </div>

            {/* 2. Summary Financial Cards (4 Cards - Excludes Cancelled Receipts Automatically!) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
                <div className="p-4 rounded-xl bg-gray-50 border border-gray-200">
                    <div className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">စုစုပေါင်း ရောင်းရငွေ (Net POS Sales)</div>
                    <div className="text-lg font-black text-[#123524] mt-1">{formatPrice(summaryStats.totalSalesAmt)}</div>
                </div>
                <div className="p-4 rounded-xl bg-green-50/60 border border-green-200">
                    <div className="text-[10px] font-bold text-green-700 uppercase tracking-wider">စုစုပေါင်း လျှော့ပေးငွေ (Total Discounts)</div>
                    <div className="text-lg font-black text-green-700 mt-1">-{formatPrice(summaryStats.totalDiscountGivenAmt)}</div>
                </div>
                <div className="p-4 rounded-xl bg-emerald-50/70 border border-emerald-200">
                    <div className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider">လက်ခံရရှိပြီးငွေ (Collected / Deposit + Full)</div>
                    <div className="text-lg font-black text-emerald-800 mt-1">{formatPrice(summaryStats.totalCollectedAmt)}</div>
                </div>
                <div className={`p-4 rounded-xl border ${summaryStats.totalPendingBalanceAmt > 0 ? 'bg-amber-50 border-amber-300' : 'bg-gray-50 border-gray-200'}`}>
                    <div className="text-[10px] font-bold text-red-600 uppercase tracking-wider flex items-center justify-between">
                        <span>ရရန်ကျန်ငွေ (Pending Balance Due)</span>
                        {summaryStats.pendingBalanceCount > 0 && (
                            <span className="bg-red-600 text-white text-[9px] px-2 py-0.5 rounded-full font-black">
                                {summaryStats.pendingBalanceCount} Bills
                            </span>
                        )}
                    </div>
                    <div className="text-lg font-black text-red-600 mt-1">{formatPrice(summaryStats.totalPendingBalanceAmt)}</div>
                </div>
            </div>

            {/* 3. Date Filter Bar + Status Filter + Search */}
            <div className="flex flex-col xl:flex-row justify-between items-stretch xl:items-center gap-3 bg-gray-50/70 p-3 rounded-2xl border border-gray-200/80">
                <div className="flex flex-wrap items-center gap-2">
                    <div className="flex flex-wrap items-center gap-1 bg-white p-1 rounded-xl border border-gray-200 shadow-2xs">
                        <button
                            type="button"
                            onClick={() => setDateFilterMode('all')}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                                dateFilterMode === 'all' ? 'bg-[#123524] text-[#D4AF37] shadow-xs' : 'text-gray-600 hover:text-gray-900'
                            }`}
                        >
                            ရက်အားလုံး (All)
                        </button>
                        <button
                            type="button"
                            onClick={() => setDateFilterMode('today')}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                                dateFilterMode === 'today' ? 'bg-[#123524] text-[#D4AF37] shadow-xs' : 'text-gray-600 hover:text-gray-900'
                            }`}
                        >
                            ယနေ့ (Today)
                        </button>
                        <button
                            type="button"
                            onClick={() => setDateFilterMode('yesterday')}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                                dateFilterMode === 'yesterday' ? 'bg-[#123524] text-[#D4AF37] shadow-xs' : 'text-gray-600 hover:text-gray-900'
                            }`}
                        >
                            မနေ့က (Yesterday)
                        </button>
                        <button
                            type="button"
                            onClick={() => setDateFilterMode('this_month')}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                                dateFilterMode === 'this_month' ? 'bg-[#123524] text-[#D4AF37] shadow-xs' : 'text-gray-600 hover:text-gray-900'
                            }`}
                        >
                            ယခုလ (This Month)
                        </button>
                        <button
                            type="button"
                            onClick={() => setDateFilterMode('last_month')}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                                dateFilterMode === 'last_month' ? 'bg-[#123524] text-[#D4AF37] shadow-xs' : 'text-gray-600 hover:text-gray-900'
                            }`}
                        >
                            အရင်လ (Last Month)
                        </button>

                        {/* From Date ➔ To Date Range Picker */}
                        <div
                            className={`flex flex-wrap items-center gap-1.5 px-2.5 py-1 rounded-lg border transition ${
                                dateFilterMode === 'custom_range'
                                    ? 'bg-[#123524] text-[#D4AF37] border-[#123524]'
                                    : 'bg-gray-50 text-gray-700 border-gray-200'
                            }`}
                        >
                            <Calendar className="w-3.5 h-3.5 text-[#D4AF37] flex-shrink-0" />
                            <span className="text-[10px] font-bold opacity-75">From:</span>
                            <input
                                type="date"
                                value={fromDate}
                                onChange={(e) => {
                                    const val = e.target.value;
                                    setFromDate(val);
                                    if (toDate && val > toDate) setToDate(val);
                                    setDateFilterMode('custom_range');
                                }}
                                className={`text-xs font-bold outline-none bg-transparent cursor-pointer ${
                                    dateFilterMode === 'custom_range' ? 'text-[#D4AF37]' : 'text-[#123524]'
                                }`}
                            />
                            <span className="text-xs font-black">➔</span>
                            <span className="text-[10px] font-bold opacity-75">To:</span>
                            <input
                                type="date"
                                value={toDate}
                                onChange={(e) => {
                                    const val = e.target.value;
                                    setToDate(val);
                                    if (fromDate && val < fromDate) setFromDate(val);
                                    setDateFilterMode('custom_range');
                                }}
                                className={`text-xs font-bold outline-none bg-transparent cursor-pointer ${
                                    dateFilterMode === 'custom_range' ? 'text-[#D4AF37]' : 'text-[#123524]'
                                }`}
                            />
                        </div>
                    </div>

                    {/* Payment & Cancelled Status Filter Pills */}
                    <div className="flex flex-wrap bg-white p-1 rounded-xl border border-gray-200 shadow-2xs gap-0.5">
                        <button
                            type="button"
                            onClick={() => setFilterStatus('all')}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                                filterStatus === 'all' ? 'bg-[#123524] text-white shadow-xs' : 'text-gray-600'
                            }`}
                        >
                            အားလုံး ({dateAndSearchFilteredSales.length})
                        </button>
                        <button
                            type="button"
                            onClick={() => setFilterStatus('deposit_only')}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                                filterStatus === 'deposit_only' ? 'bg-amber-500 text-white shadow-xs' : 'text-gray-600'
                            }`}
                        >
                            ကျန်ငွေရရန်ကျန် ({summaryStats.pendingBalanceCount})
                        </button>
                        <button
                            type="button"
                            onClick={() => setFilterStatus('paid_in_full')}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                                filterStatus === 'paid_in_full' ? 'bg-emerald-700 text-white shadow-xs' : 'text-gray-600'
                            }`}
                        >
                            အပြည့်ချေပြီး ({summaryStats.activeBillsCount - summaryStats.pendingBalanceCount})
                        </button>
                        <button
                            type="button"
                            onClick={() => setFilterStatus('cancelled')}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                                filterStatus === 'cancelled' ? 'bg-red-600 text-white shadow-xs' : 'text-red-600 hover:bg-red-50'
                            }`}
                        >
                            ပယ်ဖျက်ထားသော ({summaryStats.cancelledBillsCount})
                        </button>
                    </div>
                </div>

                <div className="relative w-full xl:w-72">
                    <input
                        type="text"
                        placeholder="ဘောင်ချာနံပါတ်၊ အမည် သို့မဟုတ် ဖုန်း ရှာရန်..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-9 pr-8 py-2 bg-white border border-gray-200 rounded-xl outline-none focus:border-[#D4AF37] text-xs font-bold shadow-2xs"
                    />
                    <Search className="w-4 h-4 text-gray-400 absolute left-3 top-2.5" />
                    {searchQuery && (
                        <button
                            type="button"
                            onClick={() => setSearchQuery('')}
                            className="absolute right-2.5 top-2.5 text-gray-400 hover:text-gray-600"
                        >
                            <X className="w-3.5 h-3.5" />
                        </button>
                    )}
                </div>
            </div>

            {/* 4. Date-Grouped POS Sales Sections */}
            {groupedSalesByDate.length === 0 ? (
                <div className="p-12 text-center text-gray-400 font-bold border border-dashed border-gray-200 rounded-2xl space-y-2">
                    <div>ရွေးချယ်ထားသော ရက်စွဲနှင့် စာရင်းအတွက် POS အရောင်းမှတ်တမ်း မရှိပါ။</div>
                    {dateFilterMode !== 'all' && (
                        <button
                            type="button"
                            onClick={() => setDateFilterMode('all')}
                            className="text-xs font-black text-[#123524] underline"
                        >
                            ရက်အားလုံး ပြန်ကြည့်မည် (Show All Dates)
                        </button>
                    )}
                </div>
            ) : (
                <div className="space-y-6">
                    {groupedSalesByDate.map((group) => (
                        <div
                            key={group.date}
                            className="rounded-2xl border border-gray-200 shadow-xs overflow-hidden bg-white"
                        >
                            {/* Daily Header Banner */}
                            <div className="bg-gradient-to-r from-[#123524] via-[#1a4a32] to-[#123524] px-4 sm:px-5 py-3.5 text-white flex flex-wrap items-center justify-between gap-3 border-b border-[#D4AF37]/40">
                                <div className="flex items-center gap-3">
                                    <div className="w-9 h-9 rounded-xl bg-white/10 border border-[#D4AF37]/40 flex items-center justify-center text-[#D4AF37] shadow-inner">
                                        <Calendar className="w-4 h-4" />
                                    </div>
                                    <div>
                                        <div className="font-extrabold text-xs sm:text-sm text-[#D4AF37] tracking-wide">
                                            {formatReadableDateHeader(group.date)}
                                        </div>
                                        <div className="flex flex-wrap items-center gap-2 text-[11px] text-gray-200 font-semibold mt-0.5">
                                            <span>အတည်ပြုဘောင်ချာ: <strong>{group.activeCount} စောင်</strong></span>
                                            {group.cancelledCount > 0 && (
                                                <span className="bg-red-500/30 border border-red-400/50 text-red-200 px-2 py-0.2 rounded text-[10px] font-bold">
                                                    ပယ်ဖျက်: {group.cancelledCount} စောင်
                                                </span>
                                            )}
                                            <span>•</span>
                                            <span>Cash: <strong>{formatPrice(group.dailyCashTotal)}</strong></span>
                                            <span>•</span>
                                            <span>Online Pay: <strong>{formatPrice(group.dailyOnlineTotal)}</strong></span>
                                            {group.dailyPendingBalance > 0 && (
                                                <span className="bg-red-500 text-white px-2 py-0.5 rounded-full text-[10px] font-black animate-pulse">
                                                    ကျန်ငွေရရန်: {formatPrice(group.dailyPendingBalance)}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                <div className="bg-black/30 px-4 py-2 rounded-xl border border-[#D4AF37]/40 text-right ml-auto">
                                    <span className="text-[9px] font-bold text-gray-300 uppercase tracking-wider block">
                                        Daily Total Amount (တစ်ရက်စာ ရောင်းရငွေ)
                                    </span>
                                    <span className="text-base sm:text-lg font-black text-[#D4AF37]">
                                        {formatPrice(group.dailyTotalAmount)}
                                    </span>
                                </div>
                            </div>

                            <div className="overflow-x-auto">
                                <table className="w-full text-left border-collapse min-w-[980px]">
                                    <thead>
                                        <tr className="border-b border-gray-100 bg-gray-50/70 text-[11px] text-gray-500 uppercase tracking-wider">
                                            <th className="p-3">Customer</th>
                                            <th className="p-3">Service & Therapist</th>
                                            <th className="p-3">Date & Time</th>
                                            <th className="p-3">Invoice, Discount & Total</th>
                                            <th className="p-3">Payment / Cancel Status</th>
                                            <th className="p-3 text-right">Receipt Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {group.sales.map((sale: any, idx: number) => {
                                            const isCancelled = sale.status === 'cancelled';
                                            const rawTx = safeParseText(sale.txId) || `SL-${idx}`;
                                            const custName = safeParseText(sale.name) || 'Walk-in Guest';
                                            const custPhone = safeParseText(sale.phone) || '';
                                            const specialReq = safeParseText(sale.specialRequest);
                                            const cancelReason = safeParseText(sale.cancelReason);

                                            const totalPrice = safeParseNumber(sale.totalPrice);
                                            const origPrice = safeParseNumber(sale.originalPrice) || totalPrice;
                                            const hasDiscount = origPrice > totalPrice;
                                            const discountAmt = hasDiscount ? origPrice - totalPrice : 0;
                                            const discountPct =
                                                safeParseNumber(sale.discountPercent) ||
                                                (hasDiscount && origPrice > 0 ? Math.round((discountAmt / origPrice) * 100) : 0);

                                            const rawDiscLabel = safeParseText(sale.discountLabel);
                                            const cleanDiscLabel = rawDiscLabel
                                                .replace('[Shop Walk-in Sale]', '')
                                                .replace('[Shop Walk-in]', '')
                                                .trim();

                                            const isVipDiscount =
                                                cleanDiscLabel.toLowerCase().includes('vip') ||
                                                cleanDiscLabel.toLowerCase().includes('jade') ||
                                                cleanDiscLabel.toLowerCase().includes('gold') ||
                                                cleanDiscLabel.toLowerCase().includes('imperial') ||
                                                !!sale.vipTierName;

                                            const isDepositDue = !isCancelled && sale.paymentStatus === 'deposit_only' && safeParseNumber(sale.balanceDue) > 0;
                                            const depositAmt = safeParseNumber(sale.depositPaid);
                                            const balanceAmt = safeParseNumber(sale.balanceDue);

                                            return (
                                                <tr
                                                    key={sale.id || idx}
                                                    className={`border-b last:border-b-0 transition text-sm ${
                                                        isCancelled
                                                            ? 'bg-red-50/35 hover:bg-red-50/60'
                                                            : isDepositDue
                                                            ? 'bg-amber-50/40 border-amber-200 hover:bg-amber-50/70'
                                                            : 'border-gray-50 hover:bg-gray-50'
                                                    }`}
                                                >
                                                    {/* 1. Customer */}
                                                    <td className="p-3">
                                                        <div className={`font-bold text-sm ${isCancelled ? 'line-through text-gray-500' : 'text-gray-800'}`}>
                                                            {custName}
                                                        </div>
                                                        <div className="text-xs text-gray-500 font-mono">{custPhone && custPhone !== 'Walk-in' ? custPhone : '-'}</div>
                                                        {isCancelled ? (
                                                            <span className="mt-1.5 inline-flex items-center px-2 py-0.5 rounded text-[9px] font-black bg-red-600 text-white uppercase tracking-wider">
                                                                🚫 Cancelled Bill
                                                            </span>
                                                        ) : sale.vipTierName || (hasDiscount && isVipDiscount) ? (
                                                            <div className="mt-1.5 flex items-center w-fit px-2 py-0.5 rounded text-[9px] font-bold bg-gradient-to-r from-yellow-100 to-yellow-50 text-yellow-800 border border-yellow-300 shadow-2xs">
                                                                <Crown className="w-3 h-3 mr-1 text-yellow-600" />
                                                                {sale.vipTierName || cleanDiscLabel.replace(/ \(\d+\%.*?\)/, '') || 'VIP Member'}
                                                            </div>
                                                        ) : hasDiscount ? (
                                                            <div className="mt-1.5 flex items-center w-fit px-2 py-0.5 rounded text-[9px] font-bold bg-gradient-to-r from-green-100 to-green-50 text-green-800 border border-green-300 shadow-2xs">
                                                                <Sparkles className="w-3 h-3 mr-1 text-green-600" />
                                                                Promo / Discount Applied
                                                            </div>
                                                        ) : null}
                                                    </td>

                                                    {/* 2. Service, Therapist & Note */}
                                                    <td className="p-3 max-w-xs">
                                                        <div className={`font-bold text-sm leading-snug ${isCancelled ? 'line-through text-gray-400' : 'text-gray-800'}`}>
                                                            {sale.service || '-'}
                                                        </div>
                                                        <div className="text-xs text-gray-500 mt-1 flex items-center font-semibold">
                                                            <User className="w-3 h-3 mr-1 text-[#D4AF37]" />
                                                            {sale.therapist || '-'}
                                                        </div>
                                                        {specialReq && specialReq !== 'Shop Walk-in POS Sale' && (
                                                            <div className="text-[11px] text-gray-500 mt-1 italic leading-snug">
                                                                {specialReq}
                                                            </div>
                                                        )}
                                                    </td>

                                                    {/* 3. Date & Time */}
                                                    <td className="p-3 text-sm text-gray-700">
                                                        <div className="font-semibold text-[#123524]">{sale.date || '-'}</div>
                                                        <div className="text-gray-600 text-xs mt-0.5 mb-1.5">{sale.time || '-'}</div>
                                                        {sale.createdAt && (
                                                            <div className="text-[9px] font-bold text-gray-400 flex flex-col gap-0.5 border-t border-gray-100 pt-1.5 mt-1 w-max">
                                                                <span className="uppercase text-[8px] tracking-wider text-blue-400">POS Billed At:</span>
                                                                <span>
                                                                    {new Date(sale.createdAt).toLocaleString('en-US', {
                                                                        month: 'short',
                                                                        day: 'numeric',
                                                                        hour: '2-digit',
                                                                        minute: '2-digit'
                                                                    })}
                                                                </span>
                                                            </div>
                                                        )}
                                                    </td>

                                                    {/* 4. Invoice, Discount & Total */}
                                                    <td className="p-3">
                                                        <div className={`font-mono font-black text-sm ${isCancelled ? 'line-through text-red-700' : 'text-gray-800'}`}>
                                                            {rawTx}
                                                        </div>
                                                        <div className="text-[9px] uppercase tracking-wider font-bold text-gray-500 mt-0.5">
                                                            {sale.paymentMethod || 'Cash (Shop POS)'}
                                                        </div>
                                                        {sale.cashierName && (
                                                            <div className="text-[10px] font-bold text-[#123524] bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded mt-1 w-fit">
                                                                👤 Cashier: {safeParseText(sale.cashierName)}
                                                            </div>
                                                        )}

                                                        {hasDiscount ? (
                                                            <div className={`mt-2 p-2 rounded-lg w-max space-y-0.5 border ${isCancelled ? 'bg-gray-100 border-gray-200 opacity-60' : 'bg-green-50 border-green-200'}`}>
                                                                <div className="flex items-center space-x-2">
                                                                    <span className="text-[11px] text-gray-400 line-through font-semibold">
                                                                        {formatPrice(origPrice)}
                                                                    </span>
                                                                    <span className="text-[9px] font-black text-red-600 bg-red-100 border border-red-200 px-1.5 py-0.5 rounded">
                                                                        -{discountPct}% (-{formatPrice(discountAmt)})
                                                                    </span>
                                                                </div>
                                                                <div className={`font-black text-sm pt-0.5 ${isCancelled ? 'line-through text-gray-500' : 'text-[#123524]'}`}>
                                                                    {formatPrice(totalPrice)}
                                                                </div>
                                                            </div>
                                                        ) : (
                                                            <div className="mt-1.5">
                                                                <div className={`font-black text-base ${isCancelled ? 'line-through text-gray-400' : 'text-[#123524]'}`}>
                                                                    {formatPrice(totalPrice)}
                                                                </div>
                                                                <div className="text-[9px] text-gray-400 font-semibold">
                                                                    {isCancelled ? 'Excluded from Total (0 Ks)' : 'Regular Price'}
                                                                </div>
                                                            </div>
                                                        )}
                                                    </td>

                                                    {/* 5. Payment Status OR Cancelled Audit Reason */}
                                                    <td className="p-3">
                                                        {isCancelled ? (
                                                            <div className="p-2.5 rounded-xl bg-red-50 border border-red-200 max-w-[230px] space-y-1">
                                                                <div className="text-[10px] font-black text-red-700 uppercase flex items-center">
                                                                    <AlertCircle className="w-3 h-3 mr-1 flex-shrink-0" />
                                                                    ပယ်ဖျက်ထားသည် (Cancelled)
                                                                </div>
                                                                <div className="text-[11px] font-bold text-red-900 leading-snug">
                                                                    အကြောင်းရင်း: {cancelReason || 'No reason specified'}
                                                                </div>
                                                            </div>
                                                        ) : isDepositDue ? (
                                                            <div className="p-2.5 rounded-xl bg-white border border-amber-300 shadow-2xs space-y-1 w-max">
                                                                <div className="text-[10px] font-bold text-amber-800">
                                                                    စရံငွေ (Deposit): <span className="font-black">{formatPrice(depositAmt)}</span>
                                                                </div>
                                                                <div className="text-[11px] font-black text-red-600 flex items-center">
                                                                    <AlertCircle className="w-3.5 h-3.5 mr-1" />
                                                                    ကျန်ငွေ (Due): {formatPrice(balanceAmt)}
                                                                </div>
                                                                <button
                                                                    type="button"
                                                                    disabled={approvingId === sale.id}
                                                                    onClick={() => handleApproveBalanceInAdmin(sale)}
                                                                    className="w-full mt-1 px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-[10px] font-black flex items-center justify-center shadow-sm transition disabled:opacity-50"
                                                                >
                                                                    <CheckCircle className="w-3.5 h-3.5 mr-1" />
                                                                    {approvingId === sale.id ? 'Approving...' : 'ကျန်ငွေ Approve လုပ်မည်'}
                                                                </button>
                                                            </div>
                                                        ) : (
                                                            <div className="space-y-1">
                                                                <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 px-2.5 py-1 rounded-full text-[10px] font-black inline-flex items-center">
                                                                    <CheckCircle className="w-3 h-3 mr-1" /> Paid in Full
                                                                </span>
                                                                <div className="text-[10px] font-bold text-gray-500 pl-1">
                                                                    Received: {formatPrice(totalPrice)}
                                                                </div>
                                                            </div>
                                                        )}
                                                    </td>

                                                    {/* 6. 🌟 View Receipt & Cancel Receipt Buttons (Replaces Delete!) 🌟 */}
                                                    <td className="p-3 text-right">
                                                        <div className="flex flex-col sm:flex-row items-end sm:items-center justify-end gap-1.5">
                                                            <button
                                                                type="button"
                                                                onClick={() => setViewingSale(sale)}
                                                                className="px-3 py-1.5 rounded-lg bg-[#123524]/10 hover:bg-[#123524] text-[#123524] hover:text-[#D4AF37] font-black text-[11px] transition flex items-center whitespace-nowrap"
                                                            >
                                                                🧾 View Receipt
                                                            </button>

                                                            {!isCancelled && (
                                                                <button
                                                                    type="button"
                                                                    disabled={adminRole !== 'super_admin'}
                                                                    onClick={() => {
                                                                        setCancellingSale(sale);
                                                                        setCancelReasonInput('');
                                                                    }}
                                                                    title={adminRole !== 'super_admin' ? 'Super Admin Only' : 'Cancel Receipt with Reason'}
                                                                    className={`px-3 py-1.5 rounded-lg font-black text-[11px] transition flex items-center whitespace-nowrap ${
                                                                        adminRole === 'super_admin'
                                                                            ? 'bg-red-50 text-red-600 border border-red-200 hover:bg-red-600 hover:text-white'
                                                                            : 'bg-gray-100 text-gray-300 cursor-not-allowed'
                                                                    }`}
                                                                >
                                                                    🚫 Cancel Receipt
                                                                </button>
                                                            )}
                                                        </div>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

function AdminPOSUsersManager({ adminRole }: { adminRole: string }) {
  const [posUsers, setPosUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  const [newStaffName, setNewStaffName] = useState('');
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newRole, setNewRole] = useState<'admin' | 'manager' | 'cashier'>('cashier');
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'pos_users'), (snap) => {
      const list: any[] = [];
      snap.forEach((d) => {
        const data = d.data();
        list.push({
          id: d.id,
          username: decryptText(data.username) || data.username || d.id,
          displayName: decryptText(data.displayName) || data.displayName || 'POS Staff',
          passwordDec: decryptText(data.passwordEnc) || data.passwordEnc || '',
          role: data.role || 'cashier',
          status: data.status || 'active',
          createdAt: Number(data.createdAt) || Date.now(),
          lastLoginAt: Number(data.lastLoginAt) || undefined
        });
      });
      list.sort((a, b) => b.createdAt - a.createdAt);
      setPosUsers(list);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const handleCreatePosUser = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = newStaffName.trim();
    const cleanUser = newUsername.trim();
    const cleanPass = newPassword.trim();
    if (!cleanName || !cleanUser || !cleanPass) return;

    const exists = posUsers.some((u) => String(u.username).toLowerCase() === cleanUser.toLowerCase());
    if (exists) {
      alert('ဤဖုန်းနံပါတ် / Username ဖြင့် POS အကောင့် ရှိပြီးသားဖြစ်ပါသည်။');
      return;
    }

    setCreating(true);
    try {
      const newId = `pos_usr_${Date.now()}`;
      await setDoc(doc(db, 'pos_users', newId), {
        displayName: encryptText(cleanName),
        username: encryptText(cleanUser),
        passwordEnc: encryptText(cleanPass),
        role: newRole,
        status: 'active',
        createdAt: Date.now()
      });
      setNewStaffName('');
      setNewUsername('');
      setNewPassword('');
      setNewRole('cashier');
      alert(`✅ POS အကောင့် [${cleanName}] အား အောင်မြင်စွာ ဖွင့်ပေးပြီးပါပြီ။`);
    } catch (err) {
      alert('POS အကောင့်ဖွင့်ရာတွင် အမှားအယွင်းရှိနေပါသည်။');
    } finally {
      setCreating(false);
    }
  };

  const handleToggleStatus = async (u: any) => {
    const nextStatus = u.status === 'active' ? 'suspended' : 'active';
    const confirmMsg =
      nextStatus === 'suspended'
        ? `${u.displayName} (${u.username}) ၏ POS အကောင့်ကို ယာယီပိတ် (Suspend) မည်မှာ သေချာပါသလား?`
        : `${u.displayName} (${u.username}) ၏ POS အကောင့်ကို ပြန်ဖွင့် (Activate) ပေးမည်မှာ သေချာပါသလား?`;
    if (!window.confirm(confirmMsg)) return;
    await updateDoc(doc(db, 'pos_users', u.id), { status: nextStatus });
  };

  const handleChangeRole = async (u: any, role: 'admin' | 'manager' | 'cashier') => {
    await updateDoc(doc(db, 'pos_users', u.id), { role });
  };

  const handleResetPassword = async (u: any) => {
    const nextPass = window.prompt(`${u.displayName} (${u.username}) အတွက် Password အသစ် ရိုက်ထည့်ပါ:`, u.passwordDec);
    if (!nextPass || !nextPass.trim()) return;
    await updateDoc(doc(db, 'pos_users', u.id), {
      passwordEnc: encryptText(nextPass.trim())
    });
    alert('✅ Password အသစ် ပြောင်းလဲပြီးပါပြီ။');
  };

  const handleEditDisplayName = async (u: any) => {
    const nextName = window.prompt('ဝန်ထမ်းအမည် (Staff Name) ပြင်ဆင်ရန်:', u.displayName);
    if (!nextName || !nextName.trim()) return;
    await updateDoc(doc(db, 'pos_users', u.id), {
      displayName: encryptText(nextName.trim())
    });
  };

  const handleDeleteUser = async (u: any) => {
    if (adminRole !== 'super_admin') {
      alert('Super Admin သာလျှင် အကောင့်ဖျက်ခွင့်ရှိပါသည်။');
      return;
    }
    if (!window.confirm(`${u.displayName} (${u.username}) ၏ POS အကောင့်ကို အပြီးတိုင် ဖျက်မည်မှာ သေချာပါသလား?`)) return;
    await deleteDoc(doc(db, 'pos_users', u.id));
  };

  const filteredUsers = posUsers.filter((u) => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return true;
    return (
      String(u.displayName || '').toLowerCase().includes(q) ||
      String(u.username || '').toLowerCase().includes(q) ||
      String(u.role || '').toLowerCase().includes(q)
    );
  });

  return (
    <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200 space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b border-gray-100 pb-4 gap-4">
        <div>
          <h2 className="text-xl font-bold flex items-center text-[#123524]">
            <Users className="mr-2 text-[#D4AF37]" /> POS Staff & User Accounts Management
          </h2>
          <p className="text-xs text-gray-500 mt-1">
            ဆိုင်ရှိ POS (Tablet / Phone / PC) အသုံးပြုမည့် ဝန်ထမ်းအကောင့်များကို စီမံခန့်ခွဲရန်နှင့် အကောင့်ပိတ်/ဖွင့် ပြုလုပ်ရန်
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="bg-emerald-50 text-emerald-800 border border-emerald-200 px-3.5 py-1.5 rounded-xl text-xs font-black">
            Active: {posUsers.filter((u) => u.status === 'active').length}
          </span>
          <span className="bg-yellow-50 text-[#123524] border border-[#D4AF37]/40 px-3.5 py-1.5 rounded-xl text-xs font-black">
            Total Accounts: {posUsers.length}
          </span>
        </div>
      </div>

      {/* Create New POS User Form */}
      <form
        onSubmit={handleCreatePosUser}
        className="bg-gradient-to-r from-yellow-50/80 via-amber-50/40 to-white p-5 rounded-2xl border border-[#D4AF37]/40 grid grid-cols-1 sm:grid-cols-12 gap-3.5 items-end shadow-2xs"
      >
        <div className="sm:col-span-3">
          <label className="block text-[11px] font-extrabold text-[#123524] uppercase mb-1">
            Staff Full Name (ဝန်ထမ်းအမည်) *
          </label>
          <input
            type="text"
            required
            value={newStaffName}
            onChange={(e) => setNewStaffName(e.target.value)}
            placeholder="ဥပမာ - Mg Mg (Reception)"
            className="w-full p-2.5 bg-white border border-gray-200 rounded-xl text-xs font-bold outline-none focus:border-[#123524]"
          />
        </div>

        <div className="sm:col-span-3">
          <label className="block text-[11px] font-extrabold text-[#123524] uppercase mb-1">
            Phone / Login Username *
          </label>
          <input
            type="text"
            required
            value={newUsername}
            onChange={(e) => setNewUsername(e.target.value)}
            placeholder="09xxxxxxxxx သို့မဟုတ် staff01"
            className="w-full p-2.5 bg-white border border-gray-200 rounded-xl text-xs font-bold outline-none focus:border-[#123524]"
          />
        </div>

        <div className="sm:col-span-2">
          <label className="block text-[11px] font-extrabold text-[#123524] uppercase mb-1">
            Password / PIN *
          </label>
          <input
            type="text"
            required
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder="စကားဝှက်"
            className="w-full p-2.5 bg-white border border-gray-200 rounded-xl text-xs font-bold outline-none focus:border-[#123524]"
          />
        </div>

        <div className="sm:col-span-2">
          <label className="block text-[11px] font-extrabold text-[#123524] uppercase mb-1">
            Role (တာဝန်)
          </label>
          <select
            value={newRole}
            onChange={(e) => setNewRole(e.target.value as any)}
            className="w-full p-2.5 bg-white border border-gray-200 rounded-xl text-xs font-bold text-[#123524] outline-none"
          >
            <option value="cashier">POS Cashier</option>
            <option value="manager">Spa Manager</option>
            <option value="admin">POS Admin</option>
          </select>
        </div>

        <div className="sm:col-span-2">
          <button
            type="submit"
            disabled={creating}
            className="w-full py-2.5 px-4 bg-[#123524] hover:bg-[#1a4a32] text-[#D4AF37] rounded-xl text-xs font-black uppercase tracking-wider shadow-sm transition flex items-center justify-center gap-1.5 disabled:opacity-50"
          >
            <UserPlus className="w-4 h-4" />
            <span>{creating ? 'Adding...' : 'Add POS User'}</span>
          </button>
        </div>
      </form>

      {/* Search Bar */}
      <div className="flex justify-between items-center gap-3">
        <div className="text-xs font-extrabold text-gray-500 uppercase tracking-wider">
          Registered POS Staff Accounts ({filteredUsers.length})
        </div>
        <div className="relative w-full sm:w-72">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="ဝန်ထမ်းအမည် သို့မဟုတ် ဖုန်း/ID ရှာရန်..."
            className="w-full pl-9 pr-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold outline-none focus:border-[#D4AF37]"
          />
          <Search className="w-4 h-4 text-gray-400 absolute left-3 top-2.5" />
        </div>
      </div>

      {/* POS Users Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse min-w-[820px]">
          <thead>
            <tr className="border-b-2 border-gray-100 text-xs text-gray-500 uppercase tracking-wider bg-gray-50/60">
              <th className="p-3">Staff Name</th>
              <th className="p-3">Login ID / Phone</th>
              <th className="p-3">Password</th>
              <th className="p-3">Role</th>
              <th className="p-3">Status & Last Login</th>
              <th className="p-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={6} className="p-10 text-center text-gray-400 font-bold">
                  Loading POS Accounts...
                </td>
              </tr>
            ) : filteredUsers.length === 0 ? (
              <tr>
                <td colSpan={6} className="p-10 text-center text-gray-400 font-bold">
                  POS အကောင့် မရှိသေးပါ။ အပေါ်တွင် အသစ်ဖွင့်ပေးနိုင်ပါသည်။
                </td>
              </tr>
            ) : (
              filteredUsers.map((u) => (
                <tr
                  key={u.id}
                  className={`border-b transition text-sm ${
                    u.status === 'suspended'
                      ? 'bg-red-50/40 border-red-100 opacity-75'
                      : 'border-gray-50 hover:bg-gray-50/80'
                  }`}
                >
                  <td className="p-3">
                    <div className="font-bold text-[#123524] flex items-center gap-1.5">
                      <span>{u.displayName}</span>
                      <button
                        type="button"
                        onClick={() => handleEditDisplayName(u)}
                        className="text-gray-400 hover:text-[#123524]"
                        title="Edit Staff Name"
                      >
                        <Edit className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <div className="text-[10px] text-gray-400">
                      Created: {new Date(u.createdAt).toLocaleDateString()}
                    </div>
                  </td>

                  <td className="p-3 font-mono font-bold text-gray-800">{u.username}</td>

                  <td className="p-3">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold bg-gray-100 px-2.5 py-1 rounded border border-gray-200 text-gray-700">
                        {u.passwordDec || '••••••'}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleResetPassword(u)}
                        className="text-[10px] font-bold bg-yellow-50 hover:bg-yellow-100 text-[#123524] border border-[#D4AF37]/50 px-2 py-1 rounded-lg flex items-center transition"
                      >
                        <KeyRound className="w-3 h-3 mr-1 text-[#D4AF37]" /> ပြင်ရန်
                      </button>
                    </div>
                  </td>

                  <td className="p-3">
                    <select
                      value={u.role}
                      onChange={(e) => handleChangeRole(u, e.target.value as any)}
                      className="p-1.5 bg-white border border-gray-200 rounded-lg text-xs font-bold text-[#123524] outline-none focus:border-[#123524]"
                    >
                      <option value="cashier">Cashier</option>
                      <option value="manager">Manager</option>
                      <option value="admin">Admin</option>
                    </select>
                  </td>

                  <td className="p-3">
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase inline-flex items-center ${
                        u.status === 'active'
                          ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                          : 'bg-red-100 text-red-700 border border-red-300'
                      }`}
                    >
                      {u.status === 'active' ? '● Active' : '🚫 Suspended'}
                    </span>
                    {u.lastLoginAt && (
                      <div className="text-[10px] text-gray-500 mt-1">
                        Last Login: {new Date(u.lastLoginAt).toLocaleString()}
                      </div>
                    )}
                  </td>

                  <td className="p-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => handleToggleStatus(u)}
                        className={`px-3 py-1.5 rounded-lg text-[11px] font-bold border transition flex items-center ${
                          u.status === 'active'
                            ? 'bg-amber-50 text-amber-800 border-amber-300 hover:bg-amber-100'
                            : 'bg-emerald-50 text-emerald-800 border-emerald-300 hover:bg-emerald-100'
                        }`}
                      >
                        <Ban className="w-3 h-3 mr-1" />
                        {u.status === 'active' ? 'Suspend (ပိတ်ရန်)' : 'Activate (ဖွင့်ရန်)'}
                      </button>

                      <button
                        type="button"
                        onClick={() => handleDeleteUser(u)}
                        disabled={adminRole !== 'super_admin'}
                        title={adminRole !== 'super_admin' ? 'Super Admin Only' : 'Delete POS Account'}
                        className={`p-2 rounded-lg transition ${
                          adminRole === 'super_admin'
                            ? 'bg-red-50 text-red-600 hover:bg-red-100'
                            : 'bg-gray-100 text-gray-300 cursor-not-allowed'
                        }`}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
