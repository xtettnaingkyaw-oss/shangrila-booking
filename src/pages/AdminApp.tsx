import React, { useState, useEffect, useCallback, useMemo, useRef, memo } from 'react';
import { collection, getDocs, updateDoc, deleteDoc, doc, query, orderBy, getDoc, setDoc, onSnapshot, addDoc } from 'firebase/firestore';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';
import { db, auth, secondaryAuth } from '../firebase';
import { encryptText, decryptText } from '../security'; 
import CryptoJS from 'crypto-js'; 

import { CalendarPlus, BarChart2, User, ShieldCheck, Settings, Trash2, Edit, ShieldAlert, Lock, UserCircle, KeyRound, AlertCircle, Save, PlusCircle, X, Copy, Crown, ChevronUp, ChevronDown, Activity, Coffee, Download, ImageIcon, Sparkles, CreditCard, MapPin, Phone, LogOut, Star, Award, Gift, Target, Info, Search, History, UserPlus, CheckCircle, MessageCircle } from 'lucide-react';
import { THEME, AppData, TherapistProfile, Booking, OutPass, MenuCategory, PaymentMethod, UserProfile, AdminProfile, AppBranding, PromotionSettings, formatPrice, compressImage, VipSettings, VipTier, DEFAULT_VIP_SETTINGS, uploadBase64ToStorage } from '../shared';

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

  const [realtimeVip, setRealtimeVip] = useState<VipSettings | undefined>(appData.vipSettings);
  useEffect(() => {
      const unsub = onSnapshot(doc(db, 'settings', 'appData'), (snap) => {
          if (snap.exists() && snap.data().vipSettings) setRealtimeVip(snap.data().vipSettings);
      });
      return () => unsub();
  }, []);
  const mergedAppData = { ...appData, vipSettings: realtimeVip || appData.vipSettings || DEFAULT_VIP_SETTINGS };

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
  const [tab, setTab] = useState<'bookings' | 'reports' | 'users' | 'points' | 'admins' | 'settings'>('bookings');
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [pendingCount, setPendingCount] = useState(0);
  const [resetRequestCount, setResetRequestCount] = useState(0);
  const [adminRole, setAdminRole] = useState<'super_admin' | 'custom'>('super_admin');
  const [adminPermissions, setAdminPermissions] = useState<string[]>([]);
  const [roleLoaded, setRoleLoaded] = useState(false);
  const isFirstLoad = useRef(true);

  useEffect(() => {
      const fetchRole = async () => {
          try {
              const allAdmins = await getDocs(collection(db, 'admins'));
              let matchedAdmin: LocalAdminProfile | null = null;
              allAdmins.forEach(d => {
                 const raw = d.data(); const decUser = decryptText(raw.username) || d.id;
                 if (decUser.toLowerCase() === loggedInAdmin.toLowerCase()) matchedAdmin = raw as LocalAdminProfile;
              });
              if (matchedAdmin) {
                  const r = matchedAdmin.role || 'super_admin'; 
                  const p = matchedAdmin.permissions || ['bookings', 'reports', 'users', 'points', 'admins', 'settings'];
                  setAdminRole(r); setAdminPermissions(p);
                  if (r !== 'super_admin' && !p.includes(tab) && p.length > 0) setTab(p[0] as any);
              }
          } catch (e) { console.error("Error fetching admin role", e); }
          setRoleLoaded(true);
      };
      fetchRole();
  }, [loggedInAdmin, tab]);

  useEffect(() => {
    const unsubUsers = onSnapshot(collection(db, 'users'), (snap) => {
        let rCount = 0;
        snap.forEach(d => { if (d.data().resetRequested) rCount++; });
        setResetRequestCount(rCount);
    });
    return () => unsubUsers();
  }, []);

  useEffect(() => {
    const q = query(collection(db, 'bookings'));
    const unsubscribe = onSnapshot(q, (snap) => {
      const data: Booking[] = []; let currentPendingCount = 0;
      snap.forEach((doc) => { 
          const raw = doc.data();
          const b = { 
             id: doc.id, ...raw, name: decryptText(raw.name) || raw.name, phone: decryptText(raw.phone) || raw.phone, txId: decryptText(raw.txId) || raw.txId, 
             specialRequest: decryptText(raw.specialRequest) || raw.specialRequest, originalPrice: raw.originalPrice ? Number(decryptText(raw.originalPrice)) : undefined,
             discountPercent: raw.discountPercent ? Number(decryptText(raw.discountPercent)) : undefined, discountLabel: raw.discountLabel ? decryptText(raw.discountLabel) : undefined,
             vipTierName: raw.vipTierName ? decryptText(raw.vipTierName) : undefined
          } as Booking; 
          data.push(b); if (b.status === 'pending') currentPendingCount++; 
      });
      data.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
      setBookings(data); setPendingCount(currentPendingCount);
      if (!isFirstLoad.current && snap.docChanges().some(change => change.type === 'added' && change.doc.data().status === 'pending')) {
        const audioEl = document.getElementById('admin-alert-sound') as HTMLAudioElement;
        if (audioEl) { audioEl.currentTime = 0; audioEl.play().catch(e => console.log("Audio blocked", e)); setTimeout(() => { audioEl.pause(); audioEl.currentTime = 0; }, 5000); }
      }
      isFirstLoad.current = false;
    });
    return () => unsubscribe();
  }, []);

  const handleInteraction = useCallback(() => { const audioEl = document.getElementById('admin-alert-sound') as HTMLAudioElement; if (audioEl && audioEl.paused) { audioEl.play().then(() => { audioEl.pause(); audioEl.currentTime = 0; }).catch(() => {}); } }, []);
  const hasAccess = useCallback((tabId: string) => { if (adminRole === 'super_admin') return true; return adminPermissions.includes(tabId); }, [adminRole, adminPermissions]);
  const pendingBookings = useMemo(() => bookings.filter(b => b.status !== 'in_progress' && b.status !== 'completed'), [bookings]);
  const historyBookings = useMemo(() => bookings.filter(b => b.status === 'in_progress' || b.status === 'completed'), [bookings]);

  if (!roleLoaded) return <div className="p-10 text-center text-gray-500 font-bold mt-10">Loading Admin Privileges...</div>;

  return (
    <div className="animate-fade-in" onClick={handleInteraction}>
      <audio id="admin-alert-sound" src="https://actions.google.com/sounds/v1/alarms/alarm_clock.ogg" preload="auto" loop />
      <div className="flex flex-wrap justify-center items-center gap-2 mb-6 scrollbar-hide overflow-x-auto p-1 mt-6 sm:mt-0 px-4 sm:px-0">
        {hasAccess('bookings') && (<button onClick={() => setTab('bookings')} className={`relative px-4 sm:px-5 py-3 rounded-lg font-bold text-xs transition-all flex items-center whitespace-nowrap ${tab === 'bookings' ? 'bg-[#123524] text-white shadow-md' : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'}`}><CalendarPlus className="w-4 h-4 mr-2" /> Bookings {pendingCount > 0 && <span className="absolute -top-2 -right-2 bg-red-500 text-white text-[10px] w-5 h-5 flex items-center justify-center rounded-full shadow-md font-bold animate-pulse">{pendingCount}</span>}</button>)}
        {hasAccess('reports') && (<button onClick={() => setTab('reports')} className={`px-4 sm:px-5 py-3 rounded-lg font-bold text-xs transition-all flex items-center whitespace-nowrap ${tab === 'reports' ? 'bg-[#123524] text-white shadow-md' : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'}`}><BarChart2 className="w-4 h-4 mr-2" /> Staff History</button>)}
        {hasAccess('users') && (<button onClick={() => setTab('users')} className={`relative px-4 sm:px-5 py-3 rounded-lg font-bold text-xs transition-all flex items-center whitespace-nowrap ${tab === 'users' ? 'bg-[#123524] text-white shadow-md' : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'}`}><User className="w-4 h-4 mr-2" /> Users {resetRequestCount > 0 && <span className="absolute -top-2 -right-2 bg-red-500 text-white text-[10px] w-5 h-5 flex items-center justify-center rounded-full shadow-md font-bold animate-pulse">{resetRequestCount}</span>}</button>)}
        {hasAccess('points') && (<button onClick={() => setTab('points')} className={`px-4 sm:px-5 py-3 rounded-lg font-bold text-xs transition-all flex items-center whitespace-nowrap ${tab === 'points' ? 'bg-yellow-500 text-white shadow-md' : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'}`}><Star className="w-4 h-4 mr-2" /> Point Mgmt</button>)}
        {hasAccess('admins') && (<button onClick={() => setTab('admins')} className={`px-4 sm:px-5 py-3 rounded-lg font-bold text-xs transition-all flex items-center whitespace-nowrap ${tab === 'admins' ? 'bg-[#123524] text-white shadow-md' : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'}`}><ShieldCheck className="w-4 h-4 mr-2" /> Admins</button>)}
        {hasAccess('settings') && (<button onClick={() => setTab('settings')} className={`px-4 sm:px-5 py-3 rounded-lg font-bold text-xs transition-all flex items-center whitespace-nowrap ${tab === 'settings' ? 'bg-[#D4AF37] text-white shadow-md' : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'}`}><Settings className="w-4 h-4 mr-2" /> Settings</button>)}
        <button onClick={onLogout} className="px-4 sm:px-5 py-3 rounded-lg font-bold text-xs transition-all flex items-center whitespace-nowrap bg-red-50 text-red-500 border border-red-200 hover:bg-red-100 hover:text-red-700 shadow-sm sm:ml-2"><LogOut className="w-4 h-4 mr-2" /> Logout</button>
      </div>

      {tab === 'bookings' && hasAccess('bookings') && <AdminBookingsList bookings={pendingBookings} adminRole={adminRole} />}
      {tab === 'reports' && hasAccess('reports') && <AdminStaffHistoryList bookings={historyBookings} adminRole={adminRole} therapists={appData.therapists} />}
      {tab === 'users' && hasAccess('users') && <AdminUsersList adminRole={adminRole} appData={appData} />}
      {tab === 'points' && hasAccess('points') && <AdminPointManagement adminRole={adminRole} appData={appData} />}
      {tab === 'admins' && hasAccess('admins') && <AdminManagementList />}
      {tab === 'settings' && hasAccess('settings') && <AdminSettings appData={appData} onSettingsUpdated={onSettingsUpdated} />}
    </div>
  );
});

function AdminBookingsList({ bookings, adminRole }: { bookings: Booking[], adminRole: string }) {
  const handleStatusChange = async (b: Booking, newStatus: string) => {
    let reason = '';
    if (newStatus === 'cancelled') {
      const input = window.prompt("Reason for cancellation:");
      if (input === null) return; reason = input;
    } else { if (!window.confirm('Are you sure you want to change this status?')) return; }
    
    let updateData: any = { status: newStatus, cancelReason: reason };

    if (newStatus === 'approved' && !(b as any).pointsAdded && b.totalPrice >= 35000) {
        const earnedPts = Math.floor(b.totalPrice / 35000);
        try {
            const usersSnap = await getDocs(collection(db, 'users'));
            let targetDocId = null; let currentPts = 0;
            usersSnap.forEach(d => {
                const uData = d.data(); const decPhone = decryptText(uData.phone) || d.id;
                if (decPhone === b.phone) { targetDocId = d.id; currentPts = parseInt(decryptText(uData.points as string) || (uData.points as string) || '0', 10); }
            });
            if (targetDocId) {
                await updateDoc(doc(db, 'users', targetDocId), { points: encryptText((currentPts + earnedPts).toString()) });
                await addDoc(collection(db, 'point_history'), { phone: encryptText(b.phone), amount: encryptText(b.totalPrice.toString()), pointsEarned: encryptText(earnedPts.toString()), invoiceNo: encryptText(b.txId || 'Online'), type: encryptText('Online Booking'), date: getLocalTodayStr(), createdAt: Date.now() });
                updateData.pointsAdded = true;
                alert(`✅ Booking Confirmed! Customer ထံသို့ Point (${earnedPts} Pts) အလိုအလျောက် ပေါင်းထည့်ပေးလိုက်ပါပြီ။`);
            }
        } catch (e) { console.error("Error adding points:", e); }
    }
    try { await updateDoc(doc(db, 'bookings', b.id!), updateData); } catch (e) { alert("Error Update"); }
  };

  const handleDelete = async (id: string) => { 
      if (adminRole !== 'super_admin') { alert('Super Admin သာလျှင် ဖျက်ခွင့်ရှိပါသည်။'); return; }
      if (window.confirm('Are you sure you want to delete this booking?')) { await deleteDoc(doc(db, 'bookings', id)); } 
  };

  const handleExportExcel = () => {
      const headers = ['Booking ID', 'Customer Name', 'Phone', 'Service', 'Therapist', 'Date', 'Time', 'Total Price (Ks)', 'Original Price (Ks)', 'Discount Percent (%)', 'Discount Label', 'Payment Method', 'Transaction ID', 'Status', 'Special Request', 'Booking Date'];
      const rows = bookings.map(b => [ b.id || '', `"${b.name || ''}"`, `"${b.phone || ''}"`, `"${b.service || ''}"`, `"${b.therapist || ''}"`, b.date || '', b.time || '', b.totalPrice || 0, b.originalPrice || '', b.discountPercent || '', b.discountLabel ? `"${b.discountLabel}"` : '', b.paymentMethod || '', b.txId || '', b.status || '', `"${b.specialRequest || ''}"`, new Date(b.createdAt).toLocaleString() ]);
      const csvContent = '\uFEFF' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' }); const link = document.createElement('a'); const url = URL.createObjectURL(blob);
      link.setAttribute('href', url); link.setAttribute('download', `Bookings_Report_${getLocalTodayStr()}.csv`); link.style.visibility = 'hidden';
      document.body.appendChild(link); link.click(); document.body.removeChild(link);
  };

  return (
    <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 border-b border-gray-100 pb-4 gap-4">
          <h2 className="text-xl font-bold flex items-center" style={{ color: THEME.primary }}><CalendarPlus className="mr-2 text-yellow-500" /> Booking Requests</h2>
          <div className="flex items-center space-x-3 w-full sm:w-auto">
              <button onClick={handleExportExcel} className="flex-1 sm:flex-none justify-center items-center flex px-4 py-2 bg-green-50 text-green-700 border border-green-200 rounded-lg text-xs font-bold hover:bg-green-100 transition shadow-sm"><Download className="w-4 h-4 mr-1.5" /> Export Excel</button>
              <span className="bg-yellow-100 text-yellow-700 px-4 py-2 rounded-lg text-sm font-bold border border-yellow-200">Total: {bookings.length}</span>
          </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse min-w-[800px]">
          <thead><tr className="border-b-2 border-gray-100 text-xs text-gray-500 uppercase tracking-wider"><th className="p-3 pb-4">Customer</th><th className="p-3 pb-4">Service & Therapist</th><th className="p-3 pb-4">Date & Time</th><th className="p-3 pb-4">TxID & Total</th><th className="p-3 pb-4">Status & Action</th><th className="p-3 pb-4 text-right">Delete</th></tr></thead>
          <tbody>
            {bookings.length === 0 && (<tr><td colSpan={6} className="p-10 text-center text-gray-400">No pending bookings.</td></tr>)}
            {bookings.map((b) => (
              <tr key={b.id} className="border-b border-gray-50 hover:bg-gray-50 transition">
                <td className="p-3">
                    <div className="font-bold text-gray-800 text-sm">{b.name || 'No Name'}</div><div className="text-xs text-gray-500">{b.phone || '-'}</div>
                    {b.vipTierName ? (<div className="mt-1.5 flex items-center w-fit px-2 py-0.5 rounded text-[9px] font-bold bg-gradient-to-r from-yellow-100 to-yellow-50 text-yellow-800 border border-yellow-300 shadow-sm"><Crown className="w-3 h-3 mr-1 text-yellow-600" /> {b.vipTierName}</div>) : (b.discountPercent && b.discountPercent > 0) ? (<div className="mt-1.5 flex items-center w-fit px-2 py-0.5 rounded text-[9px] font-bold bg-gradient-to-r from-green-100 to-green-50 text-green-800 border border-green-300 shadow-sm"><Sparkles className="w-3 h-3 mr-1 text-green-600" /> Promo Active</div>) : null}
                </td>
                <td className="p-3"><div className="font-bold text-sm text-gray-800">{b.service || '-'}</div><div className="text-xs text-gray-500 mt-1 flex items-center"><User className="w-3 h-3 mr-1" />{b.therapist || '-'}</div>{b.specialRequest && <div className="text-xs text-red-500 mt-1 italic">Note: {b.specialRequest}</div>}</td>
                <td className="p-3 text-sm text-gray-700"><div className="font-semibold text-[#123524]">{b.date || '-'}</div><div className="text-gray-600 text-xs mt-1">{b.time || '-'}</div></td>
                <td className="p-3">
                    <div className="font-mono font-bold text-gray-800 text-sm">{b.txId || '-'}</div><div className="text-[9px] uppercase tracking-wider font-bold text-gray-500 mt-1">{b.paymentMethod || 'Unknown'}</div>
                    {b.originalPrice && b.originalPrice > b.totalPrice ? (
                        <div className="mt-2 p-1.5 bg-green-50 border border-green-100 rounded-md w-max">
                           <div className="flex items-center space-x-2 mb-0.5"><span className="text-[10px] text-gray-400 line-through">{formatPrice(b.originalPrice)}</span><span className="text-[9px] font-bold text-red-500 bg-red-100 px-1 py-0.5 rounded">-{b.discountPercent}%</span></div>
                           <div className="font-bold text-[#123524] text-sm">{formatPrice(b.totalPrice)}</div>
                           {b.discountLabel && <div className="text-[8.5px] text-green-700 font-semibold mt-1 uppercase tracking-wider">{b.discountLabel.replace(/ \(\d+%\)/, '')}</div>}
                        </div>
                    ) : (<div className="mt-1.5 font-bold text-[#123524] text-sm">{formatPrice(b.totalPrice)}</div>)}
                </td>
                <td className="p-3">
                  <select value={b.status} onChange={(e) => handleStatusChange(b, e.target.value)} className={`text-[10px] font-bold p-1.5 rounded outline-none border cursor-pointer ${b.status === 'approved' ? 'bg-green-50 text-green-700 border-green-200' : b.status === 'payment_checking' ? 'bg-blue-50 text-blue-700 border-blue-200' : b.status === 'cancelled' ? 'bg-red-50 text-red-700 border-red-200' : 'bg-yellow-50 text-yellow-700 border-yellow-200'}`}>
                    <option value="pending">Pending</option><option value="payment_checking">Confirming</option><option value="approved">Approve</option><option value="cancelled">Cancel</option>
                  </select>
                  {b.status === 'cancelled' && b.cancelReason && <div className="text-[9px] text-red-500 mt-1 max-w-[120px] truncate" title={b.cancelReason}>Reason: {b.cancelReason}</div>}
                  {(b as any).pointsAdded && <div className="text-[8px] text-green-600 font-bold mt-1 uppercase"><Award className="w-2.5 h-2.5 inline mr-0.5"/>Pts Added</div>}
                </td>
                <td className="p-3 text-right"><button onClick={() => handleDelete(b.id!)} disabled={adminRole !== 'super_admin'} title={adminRole !== 'super_admin' ? 'Super Admin Only' : 'Delete Booking'} className={`p-2 rounded-lg transition ${adminRole === 'super_admin' ? 'bg-red-50 text-red-600 hover:bg-red-100' : 'bg-gray-50 text-gray-300 cursor-not-allowed'}`}><Trash2 className="w-4 h-4" /></button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
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
      const unsub = onSnapshot(query(collection(db, 'point_history'), orderBy('createdAt', 'desc')), (snap) => {
          const data: any[] = [];
          snap.forEach(doc => { const raw = doc.data(); data.push({ id: doc.id, phone: decryptText(raw.phone) || raw.phone, amount: Number(decryptText(raw.amount) || raw.amount), pointsEarned: Number(decryptText(raw.pointsEarned) || raw.pointsEarned), invoiceNo: raw.invoiceNo ? decryptText(raw.invoiceNo) : '-', type: decryptText(raw.type) || raw.type, date: raw.date, createdAt: raw.createdAt }); });
          setHistory(data);
      });
      const unsubB = onSnapshot(query(collection(db, 'bookings')), (snap) => {
          const data: any[] = [];
          snap.forEach(d => { const raw = d.data(); data.push({ phone: decryptText(raw.phone) || raw.phone, status: raw.status, date: raw.date, discountLabel: raw.discountLabel ? decryptText(raw.discountLabel) : undefined }); });
          setUserBookings(data);
      });
      return () => { unsub(); unsubB(); };
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
         await updateDoc(doc(db, 'users', selectedUser.docId), { points: encryptText(newTotal.toString()) });
         await addDoc(collection(db, 'point_history'), { phone: encryptText(selectedUser.phone), amount: encryptText(amount.toString()), pointsEarned: encryptText(earnedPoints.toString()), invoiceNo: encryptText(invoiceNo), type: encryptText('Walk-in / Direct'), date: getLocalTodayStr(), createdAt: Date.now() });
         alert(`✅ ${earnedPoints} Points အောင်မြင်စွာ ထည့်သွင်းပြီးပါပြီ။ (စုစုပေါင်း - ${newTotal} Pts)`);
         await fetchUsers(); const updatedUser = users.find(u => u.docId === selectedUser.docId); if (updatedUser) setSelectedUser({ ...updatedUser, points: newTotal });
         setAmount(''); setInvoiceNo('');
     } catch(e) { alert('Error adding points.'); } setProcessing(false);
  };

  const handleDeleteHistory = async (hId: string, phone: string, pointsEarned: string | number) => {
      if (adminRole !== 'super_admin') { alert('Super Admin သာလျှင် ဖျက်ခွင့်ရှိပါသည်။'); return; }
      if (!window.confirm(`ဤမှတ်တမ်းကိုဖျက်၍ Customer ထံမှ ${pointsEarned} Points ကို ပြန်နှုတ်မည် သေချာပါသလား?`)) return;
      try {
          const targetUser = users.find(u => u.phone === phone); let newTotal = 0;
          if (targetUser) {
              newTotal = Math.max(0, (targetUser.points || 0) - (Number(pointsEarned) || 0));
              await updateDoc(doc(db, 'users', targetUser.docId), { points: encryptText(newTotal.toString()) });
          } else {
              const snap = await getDocs(collection(db, 'users'));
              snap.forEach(d => { const uData = d.data(); const decPhone = decryptText(uData.phone) || d.id; if (decPhone === phone) { newTotal = Math.max(0, parseInt(decryptText(uData.points as string) || (uData.points as string) || '0', 10) - (Number(pointsEarned) || 0)); updateDoc(doc(db, 'users', d.id), { points: encryptText(newTotal.toString()) }); } });
          }
          await deleteDoc(doc(db, 'point_history', hId)); alert(`✅ မှတ်တမ်းကို ဖျက်ပြီး Customer ထံမှ ${pointsEarned} Points ပြန်နှုတ်လိုက်ပါပြီ။`);
          await fetchUsers(); if (selectedUser && selectedUser.phone === phone) { setSelectedUser({ ...selectedUser, points: newTotal }); }
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

function AdminStaffHistoryList({ bookings, adminRole, therapists }: { bookings: Booking[], adminRole: string, therapists: TherapistProfile[] }) {
   const [view, setView] = useState<'dashboard' | 'service' | 'outpass'>('dashboard');
   const [outpasses, setOutpasses] = useState<OutPass[]>([]);
   const todayStr = getLocalTodayStr(); const [now, setNow] = useState(Date.now());
   useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 15000); return () => clearInterval(timer); }, []);
   useEffect(() => { const unsub = onSnapshot(query(collection(db, 'outpasses'), orderBy('outTimeMillis', 'desc')), snap => { const arr: OutPass[] = []; snap.forEach(d => arr.push({id: d.id, ...d.data()} as OutPass)); setOutpasses(arr); }); return () => unsub(); }, []);
   const formatMillis = (millis: number | undefined) => { if (!millis) return '-'; const date = new Date(millis); return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }); };
   const formatSecondsAdmin = (totalSeconds: number | undefined) => { if (totalSeconds === undefined) return '00:00'; const isNegative = totalSeconds < 0; const absSecs = Math.abs(totalSeconds); const h = Math.floor(absSecs / 3600); const m = Math.floor((absSecs % 3600) / 60); const s = Math.floor(absSecs % 60); return `${isNegative ? '-' : ''}${h > 0 ? h.toString().padStart(2, '0') + ':' : ''}${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`; };
   const handleDeleteBooking = async (id: string) => { if (adminRole !== 'super_admin') { alert('Super Admin သာလျှင် ဖျက်ခွင့်ရှိပါသည်။'); return; } if(window.confirm('Are you sure you want to delete this record?')) await deleteDoc(doc(db, 'bookings', id)); };
   const handleDeleteOutpass = async (id: string) => { if (adminRole !== 'super_admin') { alert('Super Admin သာလျှင် ဖျက်ခွင့်ရှိပါသည်။'); return; } if(window.confirm('Are you sure you want to delete this out pass?')) await deleteDoc(doc(db, 'outpasses', id)); };

   const activeBookings = bookings.filter(b => b.status === 'in_progress'); const activeOutpasses = outpasses.filter(o => o.status === 'out');

   return (
       <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
           <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center mb-6 border-b border-gray-100 pb-4">
              <h2 className="text-xl font-bold flex items-center mb-4 lg:mb-0" style={{ color: THEME.primary }}><BarChart2 className="mr-2 text-[#D4AF37]" /> Staff Reports</h2>
              <div className="flex space-x-2 bg-gray-50 p-1 rounded-lg border border-gray-200 w-full lg:w-auto overflow-x-auto scrollbar-hide">
                 <button onClick={() => setView('dashboard')} className={`whitespace-nowrap flex-1 lg:flex-none px-4 py-2 text-xs font-bold rounded transition ${view === 'dashboard' ? 'bg-white shadow-md text-[#123524]' : 'text-gray-500 hover:bg-gray-100'}`}>Dashboard</button>
                 <button onClick={() => setView('service')} className={`whitespace-nowrap flex-1 lg:flex-none px-4 py-2 text-xs font-bold rounded transition ${view === 'service' ? 'bg-white shadow-md text-[#123524]' : 'text-gray-500 hover:bg-gray-100'}`}>Services List</button>
                 <button onClick={() => setView('outpass')} className={`whitespace-nowrap flex-1 lg:flex-none px-4 py-2 text-xs font-bold rounded transition ${view === 'outpass' ? 'bg-white shadow-md text-[#123524]' : 'text-gray-500 hover:bg-gray-100'}`}>Out Passes List</button>
              </div>
           </div>

           {view === 'dashboard' && (
              <div className="space-y-8 animate-fade-in">
                 <div>
                     <h3 className="text-sm font-bold text-gray-700 mb-3 flex items-center border-b border-gray-100 pb-2"><Activity className="w-4 h-4 mr-2 text-orange-500" /> Currently In Service (Active: {activeBookings.length})</h3>
                     {activeBookings.length === 0 ? (<p className="text-xs text-gray-400 bg-gray-50 p-6 rounded-xl text-center border border-dashed border-gray-200">No staff currently in service.</p>) : (
                         <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                             {activeBookings.map(b => {
                                 const isOutcall = b.service.toLowerCase().includes('outcall') || b.service.toLowerCase().includes('hotel') || b.service.toLowerCase().includes('home');
                                 const isLate = b.expectedEndTimeMillis ? now > b.expectedEndTimeMillis : false;
                                 let lateText = 'OVERTIME (LATE)'; if (isLate && b.expectedEndTimeMillis) lateText = `LATE: +${formatSecondsAdmin(Math.floor((now - b.expectedEndTimeMillis) / 1000))}`;
                                 return (
                                     <div key={b.id} className={`p-4 rounded-xl border ${isLate ? 'bg-red-50/60 border-red-300' : (isOutcall ? 'bg-blue-50/40 border-blue-200' : 'bg-orange-50/40 border-orange-200')} shadow-sm relative overflow-hidden transition-all hover:shadow-md`}><div className={`absolute top-0 left-0 w-1 h-full ${isLate ? 'bg-red-500' : (isOutcall ? 'bg-blue-500' : 'bg-orange-500')} animate-pulse`}></div><div className="flex justify-between items-start mb-2"><div className={`font-bold text-base ${isLate ? 'text-red-900' : 'text-[#123524]'}`}>{b.therapist}</div><span className={`text-[9px] font-bold px-2 py-1 rounded uppercase tracking-wider ${isLate ? 'bg-red-100 text-red-700 animate-pulse' : (isOutcall ? 'bg-blue-100 text-blue-700' : 'bg-orange-100 text-orange-700')}`}>{isLate ? lateText : (isOutcall ? 'Outcall' : 'In Room')}</span></div><div className="text-sm font-semibold text-gray-800 truncate mb-1" title={b.service}>{b.service.split('(')[0]}</div><div className="text-xs text-gray-500 mb-4 flex items-center"><User className="w-3 h-3 mr-1 text-gray-400" />Cust: {b.name}</div><div className={`flex justify-between items-center text-xs border-t pt-3 ${isLate ? 'border-red-200' : (isOutcall ? 'border-blue-200/50' : 'border-orange-200/50')}`}><div className="text-gray-500"><span className="font-bold text-gray-600">Start:</span> {formatMillis(b.startTimeMillis)}</div><div className="text-gray-500"><span className="font-bold text-gray-600">End:</span> <span className={`${isLate ? 'text-red-700 bg-red-100 border-red-300' : (isOutcall ? 'text-blue-600 bg-white border-blue-100' : 'text-orange-600 bg-white border-orange-100')} font-mono px-1.5 py-0.5 rounded shadow-sm border ml-1`}>{formatMillis(b.expectedEndTimeMillis)}</span></div></div></div>
                                 );
                             })}
                         </div>
                     )}
                 </div>
                 <div>
                     <h3 className="text-sm font-bold text-gray-700 mb-3 flex items-center border-b border-gray-100 pb-2"><Coffee className="w-4 h-4 mr-2 text-purple-500" /> Currently on Out Pass (Active: {activeOutpasses.length})</h3>
                     {activeOutpasses.length === 0 ? (<p className="text-xs text-gray-400 bg-gray-50 p-6 rounded-xl text-center border border-dashed border-gray-200">No staff currently on out pass.</p>) : (
                         <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                             {activeOutpasses.map(o => {
                                 const isLate = o.expectedInTimeMillis ? now > o.expectedInTimeMillis : false;
                                 let lateText = 'OVERTIME (LATE)'; if (isLate && o.expectedInTimeMillis) lateText = `LATE: +${formatSecondsAdmin(Math.floor((now - o.expectedInTimeMillis) / 1000))}`;
                                 return (
                                     <div key={o.id} className={`p-4 rounded-xl border ${isLate ? 'bg-red-50/60 border-red-300' : 'bg-purple-50/40 border-purple-200'} shadow-sm relative overflow-hidden transition-all hover:shadow-md`}><div className={`absolute top-0 left-0 w-1 h-full ${isLate ? 'bg-red-500' : 'bg-purple-500'} animate-pulse`}></div><div className="flex justify-between items-start mb-2"><div className={`font-bold text-base ${isLate ? 'text-red-900' : 'text-[#123524]'}`}>{o.therapist}</div><span className={`text-[9px] font-bold px-2 py-1 rounded uppercase tracking-wider ${isLate ? 'bg-red-100 text-red-700 animate-pulse' : 'bg-purple-100 text-purple-700'}`}>{isLate ? lateText : 'Out Pass'}</span></div><div className="text-xs text-gray-600 mb-4 line-clamp-2 h-8" title={o.reason}><span className="font-bold text-gray-500">Reason:</span> {o.reason || 'No reason provided'}</div><div className={`flex justify-between items-center text-xs border-t ${isLate ? 'border-red-200' : 'border-purple-200/50'} pt-3`}><div className="text-gray-500"><span className="font-bold text-gray-600">Out:</span> {formatMillis(o.outTimeMillis)}</div><div className="text-gray-500"><span className="font-bold text-gray-600">Return:</span> <span className={`font-mono px-1.5 py-0.5 rounded shadow-sm border ml-1 ${isLate ? 'bg-red-100 text-red-700 border-red-300' : 'bg-white text-purple-600 border-purple-100'}`}>{formatMillis(o.expectedInTimeMillis)}</span></div></div></div>
                                 );
                             })}
                         </div>
                     )}
                 </div>
              </div>
           )}

           {view === 'service' && (
              <div className="overflow-x-auto animate-fade-in"><table className="w-full text-left border-collapse min-w-[900px]"><thead><tr className="border-b-2 border-gray-100 text-xs text-gray-500 uppercase tracking-wider"><th className="p-3 pb-4">Staff (Therapist)</th><th className="p-3 pb-4">Service & Customer</th><th className="p-3 pb-4">Date</th><th className="p-3 pb-4">Start Time</th><th className="p-3 pb-4">Expected End</th><th className="p-3 pb-4">Actual End</th><th className="p-3 pb-4 text-right">Overtime / Action</th></tr></thead><tbody>{bookings.length === 0 && (<tr><td colSpan={7} className="p-10 text-center text-gray-400">No service records found.</td></tr>)}{bookings.map((b) => { let currentOvertime = b.overtimeSeconds || 0; let isLate = currentOvertime > 0; if (b.status === 'in_progress' && b.expectedEndTimeMillis && now > b.expectedEndTimeMillis) { currentOvertime = Math.floor((now - b.expectedEndTimeMillis) / 1000); isLate = true; } return (<tr key={b.id} className="border-b border-gray-50 hover:bg-gray-50 transition text-sm"><td className="p-3 font-bold text-[#123524]">{b.therapist}</td><td className="p-3"><div className="font-semibold text-gray-800">{b.service.split('(')[0]}</div><div className="text-xs text-gray-500 mt-0.5">Cust: {b.name}</div></td><td className="p-3 text-gray-700 font-semibold">{b.date}</td><td className="p-3 font-mono text-gray-600">{formatMillis(b.startTimeMillis)}</td><td className="p-3 font-mono text-gray-600">{formatMillis(b.expectedEndTimeMillis)}</td><td className="p-3 font-mono text-gray-600">{b.status === 'in_progress' ? <span className="text-orange-500 animate-pulse font-bold">ACTIVE</span> : formatMillis(b.actualEndTimeMillis)}</td><td className="p-3 text-right"><div className={`font-mono font-bold text-base mb-1 ${isLate ? 'text-red-600 animate-pulse' : 'text-gray-400'}`}>{isLate && b.status === 'in_progress' ? '+' : ''}{formatSecondsAdmin(currentOvertime)}</div><button onClick={() => handleDeleteBooking(b.id!)} disabled={adminRole !== 'super_admin'} className={`text-xs font-bold px-2 py-1 rounded transition ${adminRole === 'super_admin' ? 'text-red-500 hover:text-red-700 bg-red-50' : 'text-gray-300 bg-gray-100 cursor-not-allowed'}`} title="Delete">Delete</button></td></tr>); })}</tbody></table></div>
           )}

           {view === 'outpass' && (
              <div className="overflow-x-auto animate-fade-in"><table className="w-full text-left border-collapse min-w-[900px]"><thead><tr className="border-b-2 border-gray-100 text-xs text-gray-500 uppercase tracking-wider"><th className="p-3 pb-4">Staff (Therapist)</th><th className="p-3 pb-4">Date</th><th className="p-3 pb-4">Out Time</th><th className="p-3 pb-4">Expected Return</th><th className="p-3 pb-4">Actual Return</th><th className="p-3 pb-4 text-right">Overtime / Action</th></tr></thead><tbody>{outpasses.length === 0 && (<tr><td colSpan={6} className="p-10 text-center text-gray-400">No out pass records found.</td></tr>)}{outpasses.map((o) => { let currentOvertime = o.overtimeSeconds || 0; let isLate = currentOvertime > 0; if (o.status === 'out' && o.expectedInTimeMillis && now > o.expectedInTimeMillis) { currentOvertime = Math.floor((now - o.expectedInTimeMillis) / 1000); isLate = true; } return (<tr key={o.id} className="border-b border-gray-50 hover:bg-gray-50 transition text-sm"><td className="p-3"><div className="font-bold text-purple-700"><Coffee className="w-3 h-3 inline mr-1"/>{o.therapist}</div><div className="text-[10px] text-gray-500 mt-0.5">Reason: {o.reason || '-'}</div></td><td className="p-3 text-gray-700 font-semibold">{o.date}</td><td className="p-3 font-mono text-gray-600">{formatMillis(o.outTimeMillis)}</td><td className="p-3 font-mono text-gray-600">{formatMillis(o.expectedInTimeMillis)}</td><td className="p-3 font-mono text-gray-600">{o.status === 'out' ? <span className="text-orange-500 animate-pulse font-bold">OUT NOW</span> : formatMillis(o.inTimeMillis)}</td><td className="p-3 text-right"><div className={`font-mono font-bold text-base mb-1 ${isLate ? 'text-red-600 animate-pulse' : 'text-gray-400'}`}>{isLate && o.status === 'out' ? '+' : ''}{formatSecondsAdmin(currentOvertime)}</div><button onClick={() => handleDeleteOutpass(o.id!)} disabled={adminRole !== 'super_admin'} className={`text-xs font-bold px-2 py-1 rounded transition ${adminRole === 'super_admin' ? 'text-red-500 hover:text-red-700 bg-red-50' : 'text-gray-300 bg-gray-100 cursor-not-allowed'}`} title="Delete">Delete</button></td></tr>); })}</tbody></table></div>
           )}
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
  
  // 🌟 Search အသစ်အတွက်
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
      // 🌟 Sort Logic အသစ်: Request လုပ်ထားသူများကို ထိပ်ဆုံးပို့မည်။ ကျန်တာကို အသစ်ဖွင့်တဲ့အကောင့်စဉ်အတိုင်းပြမည်
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
      await updateDoc(doc(db, 'users', editingUser.docId), { name: encryptText(editForm.name), password: encryptText(editForm.password), dob: encryptText(editForm.dob), points: encryptText(editForm.points.toString()) });
      alert('User အချက်အလက်များ ပြင်ဆင်ပြီးပါပြီ။'); setEditingUser(null); fetchUsers();
    } catch (e) { alert('Error updating user'); }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault(); const exists = users.some(u => u.phone === createForm.phone.trim());
    if (exists) { alert("ဤဖုန်းနံပါတ်ဖြင့် အကောင့်ရှိပြီးသားဖြစ်ပါသည်။"); return; }
    try {
        await addDoc(collection(db, 'users'), { phone: encryptText(createForm.phone.trim()), name: encryptText(createForm.name), password: encryptText(createForm.password), dob: encryptText(createForm.dob), points: encryptText('0'), createdAt: Date.now() });
        alert('User အသစ် ဖန်တီးပြီးပါပြီ။'); setCreatingUser(false); setCreateForm({ name: '', phone: '', password: '', dob: '' }); fetchUsers();
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

  // 🌟 Filter Users by Search
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

      {/* 🌟 Top Bar With Search */}
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
      
      {/* 🌟 Users Table */}
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
  const [newAdmin, setNewAdmin] = useState<{username: string, password: string, role: 'super_admin'|'custom', permissions: string[]}>({ username: '', password: '', role: 'super_admin', permissions: ['bookings', 'reports', 'users', 'settings'] });
  const [editingAdmin, setEditingAdmin] = useState<LocalAdminProfile | null>(null);

  const fetchAdmins = async () => {
    try { const snap = await getDocs(collection(db, 'admins')); const data: LocalAdminProfile[] = []; snap.forEach(doc => { const raw = doc.data(); data.push({ docId: doc.id, ...raw, username: decryptText(raw.username) || doc.id, password: decryptText(raw.password) || raw.password }); }); setAdmins(data); } catch (e) { console.error(e); } setLoading(false);
  };
  useEffect(() => { fetchAdmins(); }, []);

  const handleAddAdmin = async (e: React.FormEvent) => {
    e.preventDefault(); if(!newAdmin.username || !newAdmin.password) return;
    try { await createUserWithEmailAndPassword(secondaryAuth, `${newAdmin.username.toLowerCase()}@shangrila.com`, newAdmin.password); await addDoc(collection(db, 'admins'), { username: encryptText(newAdmin.username), password: encryptText(newAdmin.password), role: newAdmin.role, permissions: newAdmin.role === 'super_admin' ? ['bookings', 'reports', 'users', 'points', 'admins', 'settings'] : newAdmin.permissions }); setNewAdmin({ username: '', password: '', role: 'super_admin', permissions: ['bookings', 'reports', 'users', 'points', 'settings'] }); fetchAdmins(); } catch (e) { alert('Error adding admin. It may already exist in Auth.'); }
  };

  const handleUpdateAdmin = async (e: React.FormEvent) => {
      e.preventDefault(); if (!editingAdmin || !editingAdmin.docId) return;
      try { await updateDoc(doc(db, 'admins', editingAdmin.docId), { username: encryptText(editingAdmin.username || ''), password: encryptText(editingAdmin.password || ''), role: editingAdmin.role, permissions: editingAdmin.role === 'super_admin' ? ['bookings', 'reports', 'users', 'points', 'admins', 'settings'] : editingAdmin.permissions }); alert('Admin updated successfully.'); setEditingAdmin(null); fetchAdmins(); } catch (e) { alert('Error updating admin.'); }
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
                      <div className="w-full mt-4 border-t border-gray-200 pt-4"><label className="block text-xs font-bold text-gray-500 mb-2">Admin Role Permissions</label><div className="flex flex-col sm:flex-row gap-4 sm:space-x-4 mb-3"><label className="flex items-center space-x-2 text-sm font-bold cursor-pointer"><input type="radio" checked={editingAdmin.role === 'super_admin'} onChange={() => setEditingAdmin({...editingAdmin, role: 'super_admin'})} className="w-4 h-4 accent-[#123524]" /><span className="text-[#123524]">Super Admin</span></label><label className="flex items-center space-x-2 text-sm font-bold cursor-pointer"><input type="radio" checked={editingAdmin.role === 'custom'} onChange={() => setEditingAdmin({...editingAdmin, role: 'custom'})} className="w-4 h-4 accent-[#123524]" /><span className="text-[#123524]">Custom Role</span></label></div>{editingAdmin.role === 'custom' && (<div className="bg-gray-50 p-4 rounded-lg border border-gray-200 shadow-sm animate-fade-in"><div className="flex flex-wrap gap-4">{['bookings', 'reports', 'users', 'points', 'settings'].map(tab => (<label key={tab} className="flex items-center space-x-2 text-xs font-bold cursor-pointer bg-white px-3 py-2 rounded border border-gray-100 hover:bg-gray-50 transition"><input type="checkbox" checked={(editingAdmin.permissions||[]).includes(tab)} onChange={() => handleEditCheckboxChange(tab)} className="w-4 h-4 accent-[#123524]" /><span className="capitalize">{tab === 'reports' ? 'Staff History' : tab === 'points' ? 'Point Mgmt' : tab}</span></label>))}</div></div>)}</div>
                      <div className="flex space-x-2 pt-2"><button type="button" onClick={() => setEditingAdmin(null)} className="flex-1 py-2 bg-gray-100 text-gray-600 rounded font-bold hover:bg-gray-200">Cancel</button><button type="submit" className="flex-1 py-2 bg-[#123524] text-white rounded font-bold hover:bg-green-900">Save</button></div>
                  </form>
              </div>
          </div>
      )}

      <div className="flex justify-between items-center mb-6 border-b border-gray-100 pb-4"><h2 className="text-xl font-bold flex items-center" style={{ color: THEME.primary }}><ShieldCheck className="mr-2 text-[#D4AF37]" /> Manage Admins</h2><span className="bg-gray-100 text-gray-700 px-4 py-1 rounded-full text-sm font-bold border border-gray-200">Total: {admins.length}</span></div>
      <form onSubmit={handleAddAdmin} className="mb-6 p-5 bg-gray-50 border border-gray-200 rounded-xl flex flex-col items-end">
        <div className="flex flex-col sm:flex-row gap-4 w-full"><div className="w-full sm:flex-1"><label className="block text-xs font-bold text-gray-500 mb-1">New Username</label><input type="text" value={newAdmin.username} onChange={e=>setNewAdmin({...newAdmin, username: e.target.value})} className="w-full p-3 border border-gray-300 rounded outline-none focus:border-[#D4AF37]" required /></div><div className="w-full sm:flex-1"><label className="block text-xs font-bold text-gray-500 mb-1">New Password (Min 6 Chars)</label><input type="text" value={newAdmin.password} onChange={e=>setNewAdmin({...newAdmin, password: e.target.value})} className="w-full p-3 border border-gray-300 rounded outline-none focus:border-[#D4AF37]" minLength={6} required /></div></div>
        <div className="w-full mt-4 border-t border-gray-200 pt-4"><label className="block text-xs font-bold text-gray-500 mb-2">Admin Role Permissions</label><div className="flex flex-col sm:flex-row gap-4 sm:space-x-4 mb-3"><label className="flex items-center space-x-2 text-sm font-bold cursor-pointer"><input type="radio" checked={newAdmin.role === 'super_admin'} onChange={() => setNewAdmin({...newAdmin, role: 'super_admin'})} className="w-4 h-4 accent-[#123524]" /><span className="text-[#123524]">Super Admin <span className="text-xs text-gray-500 font-semibold">(All Access)</span></span></label><label className="flex items-center space-x-2 text-sm font-bold cursor-pointer"><input type="radio" checked={newAdmin.role === 'custom'} onChange={() => setNewAdmin({...newAdmin, role: 'custom'})} className="w-4 h-4 accent-[#123524]" /><span className="text-[#123524]">Custom Role</span></label></div>{newAdmin.role === 'custom' && (<div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm animate-fade-in"><p className="text-[10px] text-gray-400 font-bold mb-3 uppercase tracking-wider">Select Allowed Tabs (ဝင်ကြည့်ခွင့်ပြုမည့် Tab ကိုရွေးပါ)</p><div className="flex flex-wrap gap-4">{['bookings', 'reports', 'users', 'points', 'settings'].map(tab => (<label key={tab} className="flex items-center space-x-2 text-xs font-bold cursor-pointer bg-gray-50 px-3 py-2 rounded border border-gray-100 hover:bg-gray-100 transition"><input type="checkbox" checked={newAdmin.permissions.includes(tab)} onChange={() => handleCheckboxChange(tab)} className="w-4 h-4 accent-[#123524]" /><span className="capitalize">{tab === 'reports' ? 'Staff History' : tab === 'points' ? 'Point Mgmt' : tab}</span></label>))}</div><p className="text-[10px] text-red-500 mt-3 font-semibold flex items-center"><AlertCircle className="w-3 h-3 mr-1"/> Note: Custom admins are restricted from accessing the 'Admins' management tab.</p></div>)}</div>
        <button type="submit" className="w-full sm:w-auto px-6 py-3 bg-[#123524] text-white rounded font-bold flex items-center justify-center mt-4 shadow-md hover:bg-green-900 transition"><PlusCircle className="w-5 h-5 mr-2"/> Add New Admin</button>
      </form>
      <div className="overflow-x-auto"><table className="w-full text-left border-collapse min-w-[600px]"><thead><tr className="border-b-2 border-gray-100 text-xs text-gray-500 uppercase tracking-wider"><th className="p-3 pb-4">Username & Role</th><th className="p-3 pb-4">Password</th><th className="p-3 pb-4 text-right">Action</th></tr></thead><tbody>{admins.map((a, idx) => (<tr key={idx} className="border-b border-gray-50 hover:bg-gray-50 transition"><td className="p-3"><div className="font-bold text-gray-800 flex items-center text-sm"><User className="w-4 h-4 mr-2 text-gray-400"/> {a.username}</div><div className="mt-1.5">{a.role === 'super_admin' || !a.role ? (<span className="text-[9px] bg-purple-100 text-purple-700 px-2 py-0.5 rounded font-bold uppercase tracking-wider border border-purple-200">Super Admin</span>) : (<div className="flex flex-wrap gap-1 mt-1">{a.permissions?.map(p => <span key={p} className="text-[9px] font-bold bg-blue-50 text-blue-700 px-2 py-0.5 border border-blue-200 rounded uppercase tracking-wider">{p === 'reports' ? 'Staff History' : p === 'points' ? 'Point Mgmt' : p}</span>)}</div>)}</div></td><td className="p-3 font-mono text-sm text-gray-500 flex items-center"><Lock className="w-3 h-3 mr-1"/> {a.password}</td><td className="p-3 text-right">
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
  const [localCategories, setLocalCategories] = useState<MenuCategory[]>(JSON.parse(JSON.stringify(appData.categories || [])));
  const [localBranding, setLocalBranding] = useState<AppBranding>(JSON.parse(JSON.stringify(appData.branding || { logoUrl: '', address: '', phone1: '', phone2: '', copyright: '', name: '' })));
  const [localPaymentMethods, setLocalPaymentMethods] = useState<PaymentMethod[]>(JSON.parse(JSON.stringify(appData.paymentMethods || [])));
  const [localPromotion, setLocalPromotion] = useState<PromotionSettings>(JSON.parse(JSON.stringify(appData.promotion || { isActive: false, title: 'SPECIAL PROMO', hotelDiscountPercent: 10, otherDiscountPercent: 20, startDate: '', endDate: '' })));
  const [localSignUpBonus, setLocalSignUpBonus] = useState<any>(JSON.parse(JSON.stringify(appData.signUpBonus || { isActive: false, points: 5, startDate: '', endDate: '' })));
  const [localInstallSteps, setLocalInstallSteps] = useState<InstallStep[]>(DEFAULT_INSTALL_STEPS);
  const [localVipSettings, setLocalVipSettings] = useState<any>(defaultVipConfig);

  const [deletedTherapistIds, setDeletedTherapistIds] = useState<string[]>([]);
  const [savingCategory, setSavingCategory] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState<string | null>(null);
  
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

  const handleSaveCategory = async (cIdx: number) => { const cat = localCategories[cIdx]; if (!window.confirm(`Are you sure you want to save ${cat.title}?`)) return; setSavingCategory(cat.id); try { await setDoc(doc(db, 'settings', 'appData'), { categories: localCategories }, { merge: true }); onSettingsUpdated({ ...appData, categories: localCategories }); alert('Saved Successfully.'); } catch (e) { alert('Update error.'); } setSavingCategory(null); };
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
    if (!window.confirm(`Are you sure you want to save therapists list and ranking?`)) return; setSavingCategory('therapists');
    try {
      const finalizedTherapists = localTherapists.map((t, idx) => ({ ...t, order: idx }));
      const tPromises = finalizedTherapists.map((t) => { const decPass = decryptText(t.password) || t.password; if (decPass && decPass.length >= 6) createUserWithEmailAndPassword(secondaryAuth, `${t.id.toLowerCase()}@shangrila.com`, decPass).catch(() => {}); return setDoc(doc(db, 'therapists', t.id), { name: t.name, images: t.images, order: t.order, password: encryptText(t.password || '') }); });
      const delPromises = deletedTherapistIds.map(id => deleteDoc(doc(db, 'therapists', id))); await Promise.all([...tPromises, ...delPromises]);
      setDeletedTherapistIds([]); setLocalTherapists(finalizedTherapists); alert('Therapists saved successfully.');
    } catch (e) { alert('Update error.'); } setSavingCategory(null);
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => { const file = e.target.files?.[0]; if (!file) return; setUploadingImage('logo'); try { const base64 = await compressImage(file, 400, 400); const fileName = `logo_${Date.now()}.jpg`; const imageUrl = await uploadBase64ToStorage(base64, 'branding', fileName); setLocalBranding({ ...localBranding, logoUrl: imageUrl }); } catch (err) { alert("Error uploading image"); } setUploadingImage(null); };
  const handlePaymentLogoUpload = async (idx: number, e: React.ChangeEvent<HTMLInputElement>) => { const file = e.target.files?.[0]; if (!file) return; setUploadingImage(`pay_${idx}`); try { const base64 = await compressImage(file, 200, 200); const fileName = `pay_${Date.now()}.jpg`; const imageUrl = await uploadBase64ToStorage(base64, 'payments', fileName); const updated = [...localPaymentMethods]; updated[idx].logoUrl = imageUrl; setLocalPaymentMethods(updated); } catch (err) { alert("Error uploading image"); } setUploadingImage(null); };
  const handleInstallImageUpload = async (idx: number, e: React.ChangeEvent<HTMLInputElement>) => { const file = e.target.files?.[0]; if (!file) return; setUploadingImage(`install_${idx}`); try { const base64 = await compressImage(file, 300, 600); const fileName = `install_${Date.now()}.jpg`; const imageUrl = await uploadBase64ToStorage(base64, 'install_steps', fileName); const updated = [...localInstallSteps]; updated[idx].imageUrl = imageUrl; setLocalInstallSteps(updated); } catch (err) { alert("Error uploading image"); } setUploadingImage(null); };
  
  const handleImageUpload = async (tIdx: number, files: FileList | null) => { 
      if (!files || files.length === 0) return; const therapist = localTherapists[tIdx]; if (therapist.images.length + files.length > 5) { alert('Max 5 photos allowed.'); return; } setUploadingImage(therapist.id); const newUrls: string[] = []; 
      try { 
          for (let i = 0; i < files.length; i++) { const base64 = await compressImage(files[i], 900, 1200); const fileName = `${therapist.id}_${Date.now()}_${i}.jpg`; const imageUrl = await uploadBase64ToStorage(base64, 'therapists', fileName); newUrls.push(imageUrl); } 
          const updated = [...localTherapists]; updated[tIdx].images = [...updated[tIdx].images, ...newUrls]; setLocalTherapists(updated); 
      } catch (err) { alert("Upload error."); } setUploadingImage(null); 
  };

  const addTherapist = () => setLocalTherapists([...localTherapists, { id: `t_${Date.now()}`, name: 'New Therapist', images: [], order: localTherapists.length, password: '' }]);
  const updateTherapistField = (tIdx: number, field: keyof TherapistProfile, val: any) => { const updated = [...localTherapists]; updated[tIdx] = { ...updated[tIdx], [field]: val }; setLocalTherapists(updated); };
  const removeTherapist = (tIdx: number) => { if (!window.confirm("Are you sure you want to delete this therapist?")) return; const t = localTherapists[tIdx]; if (t.id && !t.id.startsWith('new_')) setDeletedTherapistIds([...deletedTherapistIds, t.id]); const updated = [...localTherapists]; updated.splice(tIdx, 1); setLocalTherapists(updated); };
  const moveTherapistUp = (tIdx: number) => { if (tIdx === 0) return; const updated = [...localTherapists]; const temp = updated[tIdx - 1]; updated[tIdx - 1] = updated[tIdx]; updated[tIdx] = temp; setLocalTherapists(updated); };
  const moveTherapistDown = (tIdx: number) => { if (tIdx === localTherapists.length - 1) return; const updated = [...localTherapists]; const temp = updated[tIdx + 1]; updated[tIdx + 1] = updated[tIdx]; updated[tIdx] = temp; setLocalTherapists(updated); };
  const removeImage = (tIdx: number, imgIdx: number) => { const updated = [...localTherapists]; updated[tIdx].images.splice(imgIdx, 1); setLocalTherapists(updated); };
  const updateItem = (cIdx: number, iIdx: number, field: string, val: any) => { const updated = [...localCategories]; (updated[cIdx].items[iIdx] as any)[field] = val; setLocalCategories(updated); };
  const addItem = (cIdx: number) => { const updated = [...localCategories]; updated[cIdx].items.push({ id: Date.now().toString(), name: 'New Service', price: 0, duration: '60 Mins', vvipIncluded: false }); setLocalCategories(updated); };
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
                          <Save className="w-4 h-4 mr-2" /> {savingCategory === 'promotion' ? 'Saving...' : 'Save'}
                      </button>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="flex items-center space-x-3 mb-2 md:col-span-2 bg-gray-50 p-3 rounded-lg border border-gray-200 w-full sm:w-auto">
                          <label className="text-sm font-bold text-gray-700 cursor-pointer flex-1 flex items-center justify-between">
                              <span>Enable Promotion (Promotion ဖွင့်ရန်)</span>
                              <input type="checkbox" checked={localPromotion.isActive} onChange={(e) => setLocalPromotion({...localPromotion, isActive: e.target.checked})} className="w-5 h-5 accent-[#123524]" />
                          </label>
                      </div>
                      <div className="md:col-span-2">
                          <label className="block text-xs font-bold text-gray-500 mb-1">Promotion Title (e.g. THADINGYUT PROMO)</label>
                          <input type="text" value={localPromotion.title || ''} onChange={(e) => setLocalPromotion({...localPromotion, title: e.target.value})} placeholder="SPECIAL PROMO" className="w-full p-2 text-sm border border-gray-300 rounded focus:border-[#D4AF37] outline-none font-bold" />
                      </div>
                      <div>
                          <label className="block text-xs font-bold text-gray-500 mb-1">Hotel & Home Services Discount (%)</label>
                          <input type="number" value={localPromotion.hotelDiscountPercent} onChange={(e) => setLocalPromotion({...localPromotion, hotelDiscountPercent: Number(e.target.value)})} className="w-full p-2 text-sm border border-gray-300 rounded focus:border-[#D4AF37] outline-none" />
                      </div>
                      <div>
                          <label className="block text-xs font-bold text-gray-500 mb-1">Other Services Discount (%)</label>
                          <input type="number" value={localPromotion.otherDiscountPercent} onChange={(e) => setLocalPromotion({...localPromotion, otherDiscountPercent: Number(e.target.value)})} className="w-full p-2 text-sm border border-gray-300 rounded focus:border-[#D4AF37] outline-none" />
                      </div>
                      <div><label className="block text-xs font-bold text-gray-500 mb-1">Start Date</label><input type="date" value={localPromotion.startDate} onChange={(e) => setLocalPromotion({...localPromotion, startDate: e.target.value})} className="w-full p-2 text-sm border border-gray-300 rounded focus:border-[#D4AF37] outline-none" /></div>
                      <div><label className="block text-xs font-bold text-gray-500 mb-1">End Date</label><input type="date" value={localPromotion.endDate} onChange={(e) => setLocalPromotion({...localPromotion, endDate: e.target.value})} className="w-full p-2 text-sm border border-gray-300 rounded focus:border-[#D4AF37] outline-none" /></div>
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
                         <div className="grid grid-cols-2 gap-2">
      <div><label className="block text-xs font-bold text-gray-500 mb-1">Phone 1</label><input type="text" value={localBranding.phone1} onChange={e => setLocalBranding({ ...localBranding, phone1: e.target.value })} className="w-full p-2 text-sm border border-gray-300 rounded focus:border-[#D4AF37] outline-none" /></div>
      <div><label className="block text-xs font-bold text-gray-500 mb-1">Phone 2</label><input type="text" value={localBranding.phone2} onChange={e => setLocalBranding({ ...localBranding, phone2: e.target.value })} className="w-full p-2 text-sm border border-gray-300 rounded focus:border-[#D4AF37] outline-none" /></div>
  </div>
  
  {/* 🌟 Telegram / Viber ထည့်ရန် အကွက်အသစ် */}
  <div className="grid grid-cols-2 gap-2 mt-2">
      <div><label className="block text-xs font-bold text-gray-500 mb-1">Telegram Link</label><input type="text" value={(localBranding as any).telegram || ''} onChange={e => setLocalBranding({ ...localBranding, telegram: e.target.value } as any)} placeholder="https://t.me/username" className="w-full p-2 text-sm border border-gray-300 rounded focus:border-[#D4AF37] outline-none" /></div>
      <div><label className="block text-xs font-bold text-gray-500 mb-1">Viber Link</label><input type="text" value={(localBranding as any).viber || ''} onChange={e => setLocalBranding({ ...localBranding, viber: e.target.value } as any)} placeholder="viber://add?number=..." className="w-full p-2 text-sm border border-gray-300 rounded focus:border-[#D4AF37] outline-none" /></div>
  </div>

  <div className="mt-2"><label className="block text-xs font-bold text-gray-500 mb-1">Copyright Text</label><input type="text" value={localBranding.copyright} onChange={e => setLocalBranding({ ...localBranding, copyright: e.target.value })} className="w-full p-2 text-sm border border-gray-300 rounded focus:border-[#D4AF37] outline-none" /></div>
                          <div><label className="block text-xs font-bold text-gray-500 mb-1">Copyright Text</label><input type="text" value={localBranding.copyright} onChange={e => setLocalBranding({ ...localBranding, copyright: e.target.value })} className="w-full p-2 text-sm border border-gray-300 rounded focus:border-[#D4AF37] outline-none" /></div>
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

                                  {/* 🌟 Upload Button (Balanced Quality) 🌟 */}
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
                                                                    // 🌟 ပုံမဝါးစေရန် 600px သို့ ပြန်တိုးထားပြီး၊ File Size မကြီးစေရန် Quality ဖြင့် ထိန်းညှိထားပါသည် 🌟
                                                                    const MAX_SIZE = 600; 
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
                                                                    ctx?.drawImage(img, 0, 0, width, height);
                                                                    
                                                                    // 🌟 Quality ကို 0.6 သို့ ထားခြင်းဖြင့် ပုံထွက်ကြည်လင်ပြီး 1MB Limit လည်း မပြည့်အောင် ကာကွယ်ပေးပါမည် 🌟
                                                                    const webpBase64 = canvas.toDataURL('image/webp', 0.6); 
                                                                    
                                                                    const newTherapists = [...localTherapists];
                                                                    if (!newTherapists[tIdx].images) {
                                                                        newTherapists[tIdx].images = [];
                                                                    }
                                                                    newTherapists[tIdx].images.push(webpBase64);
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

                        {/* Description & Image Upload */}
                        <div className="lg:col-span-12 grid grid-cols-1 md:grid-cols-2 gap-4 mt-3 pt-3 border-t border-gray-200">
                            <div>
                                <label className="text-[10px] font-bold text-gray-500 uppercase mb-1 block">Description (အသေးစိတ်ဖော်ပြချက်)</label>
                                <textarea 
                                    value={item.description || ''} 
                                    onChange={(e) => updateItem(cIdx, iIdx, 'description', e.target.value)} 
                                    className="w-full p-2.5 border border-gray-300 rounded-lg text-xs h-20 resize-none outline-none focus:border-[#D4AF37] bg-white" 
                                    placeholder="Service အကြောင်း အသေးစိတ်ရေးရန်..." 
                                />
                            </div>

                            <div>
                                <label className="text-[10px] font-bold text-gray-500 uppercase mb-1 block">Service Image (ပုံ)</label>
                                <div className="flex items-center gap-3">
                                    {item.imageUrl ? (
                                        <div className="relative w-20 h-20 rounded-xl border border-gray-200 shadow-sm overflow-hidden group">
                                            <img src={item.imageUrl} alt="Service" className="w-full h-full object-cover" />
                                            <button 
                                                type="button"
                                                onClick={() => updateItem(cIdx, iIdx, 'imageUrl', '')} 
                                                className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                                            >
                                                <X className="w-5 h-5 text-white" />
                                            </button>
                                        </div>
                                    ) : (
                                        <div className="w-20 h-20 rounded-xl border-2 border-dashed border-gray-300 flex items-center justify-center bg-white text-gray-400 shadow-inner">
                                            <ImageIcon className="w-6 h-6 opacity-40" />
                                        </div>
                                    )}
                                    
                                  <label className="cursor-pointer bg-white hover:bg-gray-50 text-[#123524] px-4 py-2.5 rounded-xl text-[10px] font-bold border border-gray-300 shadow-sm transition-all uppercase tracking-wider flex items-center justify-center">
                                        <input 
                                            type="file" 
                                            accept="image/*" 
                                            className="hidden" 
                                            onChange={(e) => {
                                                const file = e.target.files?.[0];
                                                if (file) {
                                                    setUploadingImage(`service_${cIdx}_${iIdx}`);
                                                    const reader = new FileReader();
                                                    reader.onload = (event) => {
                                                        const img = new Image();
                                                        img.onload = () => {
                                                            const canvas = document.createElement('canvas');
                                                            const MAX_SIZE = 500; 
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
                                                            ctx?.drawImage(img, 0, 0, width, height);
                                                            
                                                            // 🌟 WebP Format ကို သုံးထားသဖြင့် JPEG ထက် File Size သိသိသာသာ သေးငယ်ပြီး ပုံပိုကြည်လင်ပါမည် 🌟
                                                            const webpBase64 = canvas.toDataURL('image/webp', 0.65); 
                                                            
                                                            updateItem(cIdx, iIdx, 'imageUrl', webpBase64);
                                                            setUploadingImage(null);
                                                        };
                                                        img.src = event.target?.result as string;
                                                    };
                                                    reader.readAsDataURL(file);
                                                }
                                            }} 
                                            disabled={uploadingImage === `service_${cIdx}_${iIdx}`}
                                        />
                                        {uploadingImage === `service_${cIdx}_${iIdx}` ? 'UPLOADING...' : 'UPLOAD PHOTO'}
                                    </label>
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
