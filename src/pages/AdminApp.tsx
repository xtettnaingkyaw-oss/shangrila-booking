import React, { useState, useEffect, useCallback, useMemo, useRef, memo } from 'react';
import { collection, getDocs, updateDoc, deleteDoc, doc, query, orderBy, getDoc, setDoc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';

// Vercel တွင် Error မတက်စေရန် လိုအပ်သော Icon များအားလုံးကို အပြည့်အစုံ Import လုပ်ထားပါသည်
import { CalendarPlus, BarChart2, User, ShieldCheck, Settings, Trash2, Edit, ShieldAlert, Lock, UserCircle, KeyRound, AlertCircle, Save, PlusCircle, X, Copy, Crown, ChevronUp, ChevronDown, Activity, Coffee, Download, ImageIcon, Sparkles, CreditCard, MapPin } from 'lucide-react';

// Shared ဖိုင်မှ လိုအပ်သည်များကို လှမ်းယူခြင်း
import { THEME, AppData, TherapistProfile, Booking, OutPass, MenuCategory, PaymentMethod, UserProfile, AdminProfile, AppBranding, PromotionSettings, formatPrice, compressImage } from '../shared';

export interface InstallStep { id: string; text: string; imageUrl: string; }

const DEFAULT_INSTALL_STEPS: InstallStep[] = [
   { id: '1', text: 'Browser ၏ Menu (⋮) သို့မဟုတ် Share icon ကိုနှိပ်ပါ။', imageUrl: '' },
   { id: '2', text: '"Add to Home Screen" ကို ရွေးချယ်ပါ။', imageUrl: '' },
   { id: '3', text: '"Add" ကို နှိပ်ပါ။ ဖုန်း Screen တွင် App အဖြစ် ရောက်ရှိသွားပါမည်။', imageUrl: '' }
];

// ==========================================
// ADMIN APP WRAPPER
// ==========================================
export default function AdminApp({ appData, onSettingsUpdated }: { appData: AppData, onSettingsUpdated: (data: AppData) => void }) {
  const [loggedInAdmin, setLoggedInAdmin] = useState<string | null>(sessionStorage.getItem('shangrila_admin'));

  useEffect(() => {
    const interval = setInterval(() => {
       const sessionAdmin = sessionStorage.getItem('shangrila_admin');
       if (sessionAdmin !== loggedInAdmin) setLoggedInAdmin(sessionAdmin);
    }, 1000);
    return () => clearInterval(interval);
  }, [loggedInAdmin]);

  if (!loggedInAdmin) {
    return <AdminLogin onLogin={(user) => { 
        sessionStorage.setItem('shangrila_admin', user); 
        setLoggedInAdmin(user); 
    }} />;
  }
  return <AdminDashboard appData={appData} onSettingsUpdated={onSettingsUpdated} />;
}

// ==========================================
// ADMIN LOGIN
// ==========================================
function AdminLogin({ onLogin }: { onLogin: (u: string) => void }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault(); setLoading(true); setError('');
    try {
      const snap = await getDoc(doc(db, 'admins', username));
      if (snap.exists()) {
        if (snap.data().password === password) onLogin(username);
        else setError('Invalid password');
      } else {
        const allAdmins = await getDocs(collection(db, 'admins'));
        if (allAdmins.empty && username === 'admin' && password === 'admin123') {
          await setDoc(doc(db, 'admins', 'admin'), { username: 'admin', password: 'admin123' });
          onLogin('admin');
        } else { setError('Admin user not found'); }
      }
    } catch (e) { setError('Network error'); }
    setLoading(false);
  };

  return (
    <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-200 max-w-sm mx-auto text-center mt-10 animate-fade-in">
      <div className="w-16 h-16 bg-red-50 rounded-full mx-auto flex items-center justify-center mb-6 text-red-600"><ShieldAlert className="w-8 h-8" /></div>
      <h2 className="text-xl font-bold text-gray-800 mb-2">Admin Portal</h2>
      <p className="text-xs font-bold text-gray-500 mb-6">Restricted Access</p>
      <form onSubmit={handleLogin} className="space-y-4">
        <input required type="text" placeholder="Username" value={username} onChange={e=>setUsername(e.target.value)} className="w-full p-3 bg-gray-50 border border-gray-200 rounded-lg outline-none focus:border-[#D4AF37] font-bold text-center tracking-wider" />
        <input required type="password" placeholder="Password" value={password} onChange={e=>setPassword(e.target.value)} className="w-full p-3 bg-gray-50 border border-gray-200 rounded-lg outline-none focus:border-[#D4AF37] font-bold text-center tracking-wider" />
        {error && <div className="text-xs font-bold text-red-500">{error}</div>}
        <button type="submit" disabled={loading} className="w-full py-3 bg-[#123524] text-white rounded-lg font-bold shadow-md hover:bg-green-900">{loading ? 'Verifying...' : 'Login'}</button>
      </form>
    </div>
  );
}

// ==========================================
// ADMIN DASHBOARD
// ==========================================
const AdminDashboard = memo(({ appData, onSettingsUpdated }: { appData: AppData, onSettingsUpdated: (data: AppData) => void }) => {
  const [tab, setTab] = useState<'bookings' | 'reports' | 'users' | 'admins' | 'settings'>('bookings');
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [pendingCount, setPendingCount] = useState(0);
  const isFirstLoad = useRef(true);

  useEffect(() => {
    const q = query(collection(db, 'bookings'));
    const unsubscribe = onSnapshot(q, (snap) => {
      const data: Booking[] = []; let currentPendingCount = 0;
      snap.forEach((doc) => { const b = { id: doc.id, ...doc.data() } as Booking; data.push(b); if (b.status === 'pending') currentPendingCount++; });
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

  const pendingBookings = useMemo(() => bookings.filter(b => b.status !== 'in_progress' && b.status !== 'completed'), [bookings]);
  const historyBookings = useMemo(() => bookings.filter(b => b.status === 'in_progress' || b.status === 'completed'), [bookings]);

  return (
    <div className="animate-fade-in" onClick={handleInteraction}>
      <audio id="admin-alert-sound" src="https://actions.google.com/sounds/v1/alarms/alarm_clock.ogg" preload="auto" loop />
      <div className="flex flex-wrap justify-center gap-2 mb-6 scrollbar-hide overflow-x-auto p-1">
        <button onClick={() => setTab('bookings')} className={`relative px-4 sm:px-5 py-3 rounded-lg font-bold text-xs transition-all flex items-center whitespace-nowrap ${tab === 'bookings' ? 'bg-[#123524] text-white shadow-md' : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'}`}>
          <CalendarPlus className="w-4 h-4 mr-2" /> Bookings
          {pendingCount > 0 && <span className="absolute -top-2 -right-2 bg-red-500 text-white text-[10px] w-5 h-5 flex items-center justify-center rounded-full shadow-md font-bold animate-pulse">{pendingCount}</span>}
        </button>
        <button onClick={() => setTab('reports')} className={`px-4 sm:px-5 py-3 rounded-lg font-bold text-xs transition-all flex items-center whitespace-nowrap ${tab === 'reports' ? 'bg-[#123524] text-white shadow-md' : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'}`}><BarChart2 className="w-4 h-4 mr-2" /> Staff History</button>
        <button onClick={() => setTab('users')} className={`px-4 sm:px-5 py-3 rounded-lg font-bold text-xs transition-all flex items-center whitespace-nowrap ${tab === 'users' ? 'bg-[#123524] text-white shadow-md' : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'}`}><User className="w-4 h-4 mr-2" /> Users</button>
        <button onClick={() => setTab('admins')} className={`px-4 sm:px-5 py-3 rounded-lg font-bold text-xs transition-all flex items-center whitespace-nowrap ${tab === 'admins' ? 'bg-[#123524] text-white shadow-md' : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'}`}><ShieldCheck className="w-4 h-4 mr-2" /> Admins</button>
        <button onClick={() => setTab('settings')} className={`px-4 sm:px-5 py-3 rounded-lg font-bold text-xs transition-all flex items-center whitespace-nowrap ${tab === 'settings' ? 'bg-[#D4AF37] text-white shadow-md' : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'}`}><Settings className="w-4 h-4 mr-2" /> Settings</button>
      </div>
      {tab === 'bookings' && <AdminBookingsList bookings={pendingBookings} />}
      {tab === 'reports' && <AdminStaffHistoryList bookings={historyBookings} />}
      {tab === 'users' && <AdminUsersList />}
      {tab === 'admins' && <AdminManagementList />}
      {tab === 'settings' && <AdminSettings appData={appData} onSettingsUpdated={onSettingsUpdated} />}
    </div>
  );
});

function AdminBookingsList({ bookings }: { bookings: Booking[] }) {
  const handleStatusChange = async (id: string, newStatus: string) => {
    let reason = '';
    if (newStatus === 'cancelled') {
      const input = window.prompt("Reason for cancellation:");
      if (input === null) return;
      reason = input;
    } else {
      if (!window.confirm('Are you sure you want to change this status?')) return;
    }
    try { await updateDoc(doc(db, 'bookings', id), { status: newStatus, cancelReason: reason }); } catch (e) { alert("Error Update"); }
  };
  const handleDelete = async (id: string) => { if (window.confirm('Are you sure you want to delete this booking?')) { await deleteDoc(doc(db, 'bookings', id)); } };

  return (
    <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
      <div className="flex justify-between items-center mb-6 border-b border-gray-100 pb-4"><h2 className="text-xl font-bold flex items-center" style={{ color: THEME.primary }}><CalendarPlus className="mr-2 text-yellow-500" /> Booking Requests</h2><span className="bg-yellow-100 text-yellow-700 px-4 py-1 rounded-full text-sm font-bold border border-yellow-200">Total: {bookings.length}</span></div>
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse min-w-[800px]">
          <thead><tr className="border-b-2 border-gray-100 text-xs text-gray-500 uppercase tracking-wider"><th className="p-3 pb-4">Customer</th><th className="p-3 pb-4">Service & Therapist</th><th className="p-3 pb-4">Date & Time</th><th className="p-3 pb-4">TxID & Total</th><th className="p-3 pb-4">Status & Action</th><th className="p-3 pb-4 text-right">Delete</th></tr></thead>
          <tbody>
            {bookings.length === 0 && (<tr><td colSpan={6} className="p-10 text-center text-gray-400">No pending bookings.</td></tr>)}
            {bookings.map((b) => (
              <tr key={b.id} className="border-b border-gray-50 hover:bg-gray-50 transition">
                <td className="p-3"><div className="font-bold text-gray-800 text-sm">{b.name || 'No Name'}</div><div className="text-xs text-gray-500">{b.phone || '-'}</div></td>
                <td className="p-3"><div className="font-bold text-sm text-gray-800">{b.service || '-'}</div><div className="text-xs text-gray-500 mt-1 flex items-center"><User className="w-3 h-3 mr-1" />{b.therapist || '-'}</div>{b.specialRequest && <div className="text-xs text-red-500 mt-1 italic">Note: {b.specialRequest}</div>}</td>
                <td className="p-3 text-sm text-gray-700"><div className="font-semibold">{b.date || '-'}</div><div className="text-gray-500 text-xs mt-1">{b.time || '-'}</div></td>
                <td className="p-3"><div className="font-mono font-bold text-gray-800 text-sm">{b.txId || '-'}</div><div className="text-[10px] uppercase tracking-wider font-bold text-yellow-600 mt-1">{b.paymentMethod || 'Unknown'} • {formatPrice(b.totalPrice)}</div></td>
                <td className="p-3">
                  <select value={b.status} onChange={(e) => handleStatusChange(b.id!, e.target.value)} className={`text-[10px] font-bold p-1.5 rounded outline-none border cursor-pointer ${b.status === 'approved' ? 'bg-green-50 text-green-700 border-green-200' : b.status === 'payment_checking' ? 'bg-blue-50 text-blue-700 border-blue-200' : b.status === 'cancelled' ? 'bg-red-50 text-red-700 border-red-200' : 'bg-yellow-50 text-yellow-700 border-yellow-200'}`}>
                    <option value="pending">Pending</option><option value="payment_checking">Confirming</option><option value="approved">Approve</option><option value="cancelled">Cancel</option>
                  </select>
                  {b.status === 'cancelled' && b.cancelReason && <div className="text-[9px] text-red-500 mt-1 max-w-[120px] truncate" title={b.cancelReason}>Reason: {b.cancelReason}</div>}
                </td>
                <td className="p-3 text-right"><button onClick={() => handleDelete(b.id!)} className="p-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition"><Trash2 className="w-4 h-4" /></button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function AdminStaffHistoryList({ bookings }: { bookings: Booking[] }) {
   const [view, setView] = useState<'dashboard' | 'service' | 'outpass'>('dashboard');
   const [outpasses, setOutpasses] = useState<OutPass[]>([]);
   
   // Dashboard ကို ၁၅ စက္ကန့်တိုင်း Auto-refresh လုပ်ပေးမည့် Real-time Tick
   const [now, setNow] = useState(Date.now());
   useEffect(() => {
       const timer = setInterval(() => setNow(Date.now()), 15000); 
       return () => clearInterval(timer);
   }, []);

   useEffect(() => {
       const unsub = onSnapshot(query(collection(db, 'outpasses'), orderBy('outTimeMillis', 'desc')), snap => {
           const arr: OutPass[] = [];
           snap.forEach(d => arr.push({id: d.id, ...d.data()} as OutPass));
           setOutpasses(arr);
       });
       return () => unsub();
   }, []);

   const formatMillis = (millis: number | undefined) => {
       if (!millis) return '-';
       const date = new Date(millis);
       return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
   };

   const formatSecondsAdmin = (totalSeconds: number | undefined) => {
       if (totalSeconds === undefined) return '00:00';
       const isNegative = totalSeconds < 0;
       const absSecs = Math.abs(totalSeconds);
       const h = Math.floor(absSecs / 3600);
       const m = Math.floor((absSecs % 3600) / 60);
       const s = Math.floor(absSecs % 60);
       return `${isNegative ? '-' : ''}${h > 0 ? h.toString().padStart(2, '0') + ':' : ''}${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
   };

   const handleDeleteBooking = async (id: string) => { if(window.confirm('Are you sure you want to delete this record?')) await deleteDoc(doc(db, 'bookings', id)); };
   const handleDeleteOutpass = async (id: string) => { if(window.confirm('Are you sure you want to delete this out pass?')) await deleteDoc(doc(db, 'outpasses', id)); };

   const activeBookings = bookings.filter(b => b.status === 'in_progress');
   const activeOutpasses = outpasses.filter(o => o.status === 'out');

   return (
       <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
           <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center mb-6 border-b border-gray-100 pb-4">
              <h2 className="text-xl font-bold flex items-center mb-4 lg:mb-0" style={{ color: THEME.primary }}><BarChart2 className="mr-2 text-[#D4AF37]" /> Staff Reports</h2>
              
              <div className="flex space-x-2 bg-gray-50 p-1 rounded-lg border border-gray-200 w-full lg:w-auto overflow-x-auto scrollbar-hide">
                 <button onClick={() => setView('dashboard')} className={`whitespace-nowrap flex-1 lg:flex-none px-4 py-2 text-xs font-bold rounded transition ${view === 'dashboard' ? 'bg-white shadow-md text-[#123524]' : 'text-gray-500 hover:bg-gray-100'}`}>Dashboard View</button>
                 <button onClick={() => setView('service')} className={`whitespace-nowrap flex-1 lg:flex-none px-4 py-2 text-xs font-bold rounded transition ${view === 'service' ? 'bg-white shadow-md text-[#123524]' : 'text-gray-500 hover:bg-gray-100'}`}>Services List</button>
                 <button onClick={() => setView('outpass')} className={`whitespace-nowrap flex-1 lg:flex-none px-4 py-2 text-xs font-bold rounded transition ${view === 'outpass' ? 'bg-white shadow-md text-[#123524]' : 'text-gray-500 hover:bg-gray-100'}`}>Out Passes List</button>
              </div>
           </div>

           {/* DASHBOARD VIEW WITH REAL-TIME ALERTS */}
           {view === 'dashboard' && (
              <div className="space-y-8 animate-fade-in">
                  
                  {/* Currently In Service */}
                  <div>
                      <h3 className="text-sm font-bold text-gray-700 mb-3 flex items-center border-b border-gray-100 pb-2"><Activity className="w-4 h-4 mr-2 text-orange-500" /> Currently In Service (Active: {activeBookings.length})</h3>
                      {activeBookings.length === 0 ? (
                          <p className="text-xs text-gray-400 bg-gray-50 p-6 rounded-xl text-center border border-dashed border-gray-200">No staff currently in service.</p>
                      ) : (
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                              {activeBookings.map(b => {
                                  const isOutcall = b.service.toLowerCase().includes('outcall') || b.service.toLowerCase().includes('hotel') || b.service.toLowerCase().includes('home');
                                  const isLate = b.expectedEndTimeMillis ? now > b.expectedEndTimeMillis : false;

                                  return (
                                      <div key={b.id} className={`p-4 rounded-xl border ${isLate ? 'bg-red-50/60 border-red-300' : (isOutcall ? 'bg-blue-50/40 border-blue-200' : 'bg-orange-50/40 border-orange-200')} shadow-sm relative overflow-hidden transition-all hover:shadow-md`}>
                                          <div className={`absolute top-0 left-0 w-1 h-full ${isLate ? 'bg-red-500' : (isOutcall ? 'bg-blue-500' : 'bg-orange-500')} animate-pulse`}></div>
                                          <div className="flex justify-between items-start mb-2">
                                              <div className={`font-bold text-base ${isLate ? 'text-red-900' : 'text-[#123524]'}`}>{b.therapist}</div>
                                              <span className={`text-[9px] font-bold px-2 py-1 rounded uppercase tracking-wider ${isLate ? 'bg-red-100 text-red-700 animate-pulse' : (isOutcall ? 'bg-blue-100 text-blue-700' : 'bg-orange-100 text-orange-700')}`}>
                                                 {isLate ? 'OVERTIME (LATE)' : (isOutcall ? 'Outcall' : 'In Room')}
                                              </span>
                                          </div>
                                          <div className="text-sm font-semibold text-gray-800 truncate mb-1" title={b.service}>{b.service.split('(')[0]}</div>
                                          <div className="text-xs text-gray-500 mb-4 flex items-center"><User className="w-3 h-3 mr-1 text-gray-400" />Cust: {b.name}</div>
                                          <div className={`flex justify-between items-center text-xs border-t pt-3 ${isLate ? 'border-red-200' : (isOutcall ? 'border-blue-200/50' : 'border-orange-200/50')}`}>
                                              <div className="text-gray-500"><span className="font-bold text-gray-600">Start:</span> {formatMillis(b.startTimeMillis)}</div>
                                              <div className="text-gray-500">
                                                  <span className="font-bold text-gray-600">End:</span> 
                                                  <span className={`${isLate ? 'text-red-700 bg-red-100 border-red-300' : (isOutcall ? 'text-blue-600 bg-white border-blue-100' : 'text-orange-600 bg-white border-orange-100')} font-mono px-1.5 py-0.5 rounded shadow-sm border ml-1`}>
                                                      {formatMillis(b.expectedEndTimeMillis)}
                                                  </span>
                                              </div>
                                          </div>
                                      </div>
                                  );
                              })}
                          </div>
                      )}
                  </div>

                  {/* Currently on Out Pass */}
                  <div>
                      <h3 className="text-sm font-bold text-gray-700 mb-3 flex items-center border-b border-gray-100 pb-2"><Coffee className="w-4 h-4 mr-2 text-purple-500" /> Currently on Out Pass (Active: {activeOutpasses.length})</h3>
                      {activeOutpasses.length === 0 ? (
                          <p className="text-xs text-gray-400 bg-gray-50 p-6 rounded-xl text-center border border-dashed border-gray-200">No staff currently on out pass.</p>
                      ) : (
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                              {activeOutpasses.map(o => {
                                  const isLate = o.expectedInTimeMillis ? now > o.expectedInTimeMillis : false;

                                  return (
                                      <div key={o.id} className={`p-4 rounded-xl border ${isLate ? 'bg-red-50/60 border-red-300' : 'bg-purple-50/40 border-purple-200'} shadow-sm relative overflow-hidden transition-all hover:shadow-md`}>
                                          <div className={`absolute top-0 left-0 w-1 h-full ${isLate ? 'bg-red-500' : 'bg-purple-500'} animate-pulse`}></div>
                                          <div className="flex justify-between items-start mb-2">
                                              <div className={`font-bold text-base ${isLate ? 'text-red-900' : 'text-[#123524]'}`}>{o.therapist}</div>
                                              <span className={`text-[9px] font-bold px-2 py-1 rounded uppercase tracking-wider ${isLate ? 'bg-red-100 text-red-700 animate-pulse' : 'bg-purple-100 text-purple-700'}`}>
                                                  {isLate ? 'OVERTIME (LATE)' : 'Out Pass'}
                                              </span>
                                          </div>
                                          <div className="text-xs text-gray-600 mb-4 line-clamp-2 h-8" title={o.reason}><span className="font-bold text-gray-500">Reason:</span> {o.reason || 'No reason provided'}</div>
                                          <div className={`flex justify-between items-center text-xs border-t ${isLate ? 'border-red-200' : 'border-purple-200/50'} pt-3`}>
                                              <div className="text-gray-500"><span className="font-bold text-gray-600">Out:</span> {formatMillis(o.outTimeMillis)}</div>
                                              <div className="text-gray-500">
                                                  <span className="font-bold text-gray-600">Return:</span> 
                                                  <span className={`font-mono px-1.5 py-0.5 rounded shadow-sm border ml-1 ${isLate ? 'bg-red-100 text-red-700 border-red-300' : 'bg-white text-purple-600 border-purple-100'}`}>
                                                      {formatMillis(o.expectedInTimeMillis)}
                                                  </span>
                                              </div>
                                          </div>
                                      </div>
                                  );
                              })}
                          </div>
                      )}
                  </div>

              </div>
           )}

           {view === 'service' && (
              <div className="overflow-x-auto animate-fade-in">
                  <table className="w-full text-left border-collapse min-w-[900px]">
                      <thead><tr className="border-b-2 border-gray-100 text-xs text-gray-500 uppercase tracking-wider"><th className="p-3 pb-4">Staff (Therapist)</th><th className="p-3 pb-4">Service & Customer</th><th className="p-3 pb-4">Date</th><th className="p-3 pb-4">Start Time</th><th className="p-3 pb-4">Expected End</th><th className="p-3 pb-4">Actual End</th><th className="p-3 pb-4 text-right">Overtime / Action</th></tr></thead>
                      <tbody>
                          {bookings.length === 0 && (<tr><td colSpan={7} className="p-10 text-center text-gray-400">No service records found.</td></tr>)}
                          {bookings.map((b) => (
                              <tr key={b.id} className="border-b border-gray-50 hover:bg-gray-50 transition text-sm">
                                  <td className="p-3 font-bold text-[#123524]">{b.therapist}</td>
                                  <td className="p-3">
                                      <div className="font-semibold text-gray-800">{b.service.split('(')[0]}</div>
                                      <div className="text-xs text-gray-500 mt-0.5">Cust: {b.name}</div>
                                  </td>
                                  <td className="p-3 text-gray-700 font-semibold">{b.date}</td>
                                  <td className="p-3 font-mono text-gray-600">{formatMillis(b.startTimeMillis)}</td>
                                  <td className="p-3 font-mono text-gray-600">{formatMillis(b.expectedEndTimeMillis)}</td>
                                  <td className="p-3 font-mono text-gray-600">{b.status === 'in_progress' ? <span className="text-orange-500 animate-pulse font-bold">ACTIVE</span> : formatMillis(b.actualEndTimeMillis)}</td>
                                  <td className="p-3 text-right">
                                     <div className={`font-mono font-bold text-base mb-1 ${(b.overtimeSeconds || 0) > 0 ? 'text-red-600' : 'text-gray-400'}`}>{formatSecondsAdmin(b.overtimeSeconds)}</div>
                                     <button onClick={() => handleDeleteBooking(b.id!)} className="text-red-500 hover:text-red-700 text-xs font-bold bg-red-50 px-2 py-1 rounded">Delete</button>
                                  </td>
                              </tr>
                          ))}
                      </tbody>
                  </table>
              </div>
           )}

           {view === 'outpass' && (
              <div className="overflow-x-auto animate-fade-in">
                  <table className="w-full text-left border-collapse min-w-[900px]">
                      <thead><tr className="border-b-2 border-gray-100 text-xs text-gray-500 uppercase tracking-wider"><th className="p-3 pb-4">Staff (Therapist)</th><th className="p-3 pb-4">Date</th><th className="p-3 pb-4">Out Time</th><th className="p-3 pb-4">Expected Return</th><th className="p-3 pb-4">Actual Return</th><th className="p-3 pb-4 text-right">Overtime / Action</th></tr></thead>
                      <tbody>
                          {outpasses.length === 0 && (<tr><td colSpan={6} className="p-10 text-center text-gray-400">No out pass records found.</td></tr>)}
                          {outpasses.map((o) => (
                              <tr key={o.id} className="border-b border-gray-50 hover:bg-gray-50 transition text-sm">
                                  <td className="p-3">
                                      <div className="font-bold text-purple-700"><Coffee className="w-3 h-3 inline mr-1"/>{o.therapist}</div>
                                      <div className="text-[10px] text-gray-500 mt-0.5">Reason: {o.reason || '-'}</div>
                                  </td>
                                  <td className="p-3 text-gray-700 font-semibold">{o.date}</td>
                                  <td className="p-3 font-mono text-gray-600">{formatMillis(o.outTimeMillis)}</td>
                                  <td className="p-3 font-mono text-gray-600">{formatMillis(o.expectedInTimeMillis)}</td>
                                  <td className="p-3 font-mono text-gray-600">{o.status === 'out' ? <span className="text-orange-500 animate-pulse font-bold">OUT NOW</span> : formatMillis(o.inTimeMillis)}</td>
                                  <td className="p-3 text-right">
                                     <div className={`font-mono font-bold text-base mb-1 ${(o.overtimeSeconds || 0) > 0 ? 'text-red-600' : 'text-gray-400'}`}>{formatSecondsAdmin(o.overtimeSeconds)}</div>
                                     <button onClick={() => handleDeleteOutpass(o.id!)} className="text-red-500 hover:text-red-700 text-xs font-bold bg-red-50 px-2 py-1 rounded">Delete</button>
                                  </td>
                              </tr>
                          ))}
                      </tbody>
                  </table>
              </div>
           )}
       </div>
   );
}

function AdminUsersList() {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingUser, setEditingUser] = useState<UserProfile | null>(null);
  const [editForm, setEditForm] = useState({ name: '', password: '' });

  const fetchUsers = async () => {
    try {
      const snap = await getDocs(collection(db, 'users'));
      const data: UserProfile[] = [];
      snap.forEach(doc => data.push(doc.data() as UserProfile));
      data.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
      setUsers(data);
    } catch (e) { console.error(e); }
    setLoading(false);
  };
  useEffect(() => { fetchUsers(); }, []);

  const handleUpdateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;
    try {
      await updateDoc(doc(db, 'users', editingUser.phone), { name: editForm.name, password: editForm.password });
      alert('User အချက်အလက်များ ပြင်ဆင်ပြီးပါပြီ။');
      setEditingUser(null);
      fetchUsers();
    } catch (e) { alert('Error updating user'); }
  };

  if (loading) return <div className="text-center py-20 text-gray-500 font-bold">Loading Users...</div>;

  return (
    <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200 relative">
      {editingUser && (
         <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
            <div className="bg-white p-6 rounded-xl shadow-lg max-w-sm w-full">
               <h3 className="text-lg font-bold mb-4 text-[#123524]">Edit User ({editingUser.phone})</h3>
               <form onSubmit={handleUpdateUser} className="space-y-4">
                 <div><label className="block text-xs font-bold text-gray-500 mb-1">Name</label><input type="text" value={editForm.name} onChange={e=>setEditForm({...editForm, name: e.target.value})} className="w-full p-2 border rounded" required /></div>
                 <div><label className="block text-xs font-bold text-gray-500 mb-1">Password</label><input type="text" value={editForm.password} onChange={e=>setEditForm({...editForm, password: e.target.value})} placeholder="Leave blank for no password" className="w-full p-2 border rounded" /></div>
                 <div className="flex space-x-2 pt-2">
                   <button type="button" onClick={() => setEditingUser(null)} className="flex-1 py-2 bg-gray-100 text-gray-600 rounded font-bold">Cancel</button>
                   <button type="submit" className="flex-1 py-2 bg-[#123524] text-white rounded font-bold">Save</button>
                 </div>
               </form>
            </div>
         </div>
      )}

      <div className="flex justify-between items-center mb-6 border-b border-gray-100 pb-4"><h2 className="text-xl font-bold flex items-center" style={{ color: THEME.primary }}><UserCircle className="mr-2 text-[#D4AF37]" /> Auto-Created Profiles</h2><span className="bg-gray-100 text-gray-700 px-4 py-1 rounded-full text-sm font-bold border border-gray-200">Total: {users.length}</span></div>
      <div className="overflow-x-auto"><table className="w-full text-left border-collapse min-w-[700px]"><thead><tr className="border-b-2 border-gray-100 text-xs text-gray-500 uppercase tracking-wider"><th className="p-3 pb-4">Phone (Login ID)</th><th className="p-3 pb-4">Name</th><th className="p-3 pb-4">Security</th><th className="p-3 pb-4">Created Date</th><th className="p-3 pb-4 text-right">Action</th></tr></thead><tbody>{users.length === 0 && (<tr><td colSpan={5} className="p-10 text-center text-gray-400">User မရှိသေးပါ။</td></tr>)}{users.map((u, idx) => (<tr key={idx} className="border-b border-gray-50 hover:bg-gray-50 transition"><td className="p-3 font-mono font-bold tracking-wider text-[#123524]">{u.phone}</td><td className="p-3 font-bold text-gray-800">{u.name || '-'}</td><td className="p-3">{u.password ? <span className="text-[10px] bg-green-100 text-green-700 font-bold px-2 py-1 rounded flex w-fit items-center"><KeyRound className="w-3 h-3 mr-1" /> Password Set</span> : <span className="text-[10px] bg-gray-100 text-gray-500 font-bold px-2 py-1 rounded flex w-fit items-center"><AlertCircle className="w-3 h-3 mr-1" /> None</span>}</td><td className="p-3 text-xs font-bold text-gray-500">{u.createdAt ? new Date(u.createdAt).toLocaleDateString() : '-'}</td><td className="p-3 text-right"><button onClick={() => { setEditingUser(u); setEditForm({ name: u.name || '', password: u.password || '' }); }} className="p-1.5 bg-blue-50 text-blue-600 rounded hover:bg-blue-100 font-bold text-[10px] flex items-center ml-auto"><Edit className="w-3 h-3 mr-1"/> Edit</button></td></tr>))}</tbody></table></div>
    </div>
  );
}

function AdminManagementList() {
  const [admins, setAdmins] = useState<AdminProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [newAdmin, setNewAdmin] = useState({ username: '', password: '' });

  const fetchAdmins = async () => {
    try {
      const snap = await getDocs(collection(db, 'admins'));
      const data: AdminProfile[] = [];
      snap.forEach(doc => data.push(doc.data() as AdminProfile));
      setAdmins(data);
    } catch (e) { console.error(e); }
    setLoading(false);
  };
  useEffect(() => { fetchAdmins(); }, []);

  const handleAddAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    if(!newAdmin.username || !newAdmin.password) return;
    try {
      await setDoc(doc(db, 'admins', newAdmin.username), { username: newAdmin.username, password: newAdmin.password });
      setNewAdmin({ username: '', password: '' });
      fetchAdmins();
    } catch (e) { alert('Error adding admin'); }
  };

  const handleDeleteAdmin = async (username: string) => {
    if (admins.length <= 1) { alert("အနည်းဆုံး Admin တစ်ယောက် ကျန်ရှိရပါမည်။"); return; }
    if (!window.confirm(`Admin [${username}] ကို ဖျက်မည် သေချာပါသလား?`)) return;
    try {
      await deleteDoc(doc(db, 'admins', username));
      fetchAdmins();
    } catch (e) { alert('Error deleting admin'); }
  };

  if (loading) return <div className="text-center py-20 text-gray-500 font-bold">Loading Admins...</div>;

  return (
    <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
      <div className="flex justify-between items-center mb-6 border-b border-gray-100 pb-4"><h2 className="text-xl font-bold flex items-center" style={{ color: THEME.primary }}><ShieldCheck className="mr-2 text-[#D4AF37]" /> Manage Admins</h2><span className="bg-gray-100 text-gray-700 px-4 py-1 rounded-full text-sm font-bold border border-gray-200">Total: {admins.length}</span></div>
      
      <form onSubmit={handleAddAdmin} className="mb-6 p-4 bg-gray-50 border border-gray-200 rounded-lg flex flex-col sm:flex-row gap-3 items-end">
        <div className="w-full sm:flex-1"><label className="block text-xs font-bold text-gray-500 mb-1">New Username</label><input type="text" value={newAdmin.username} onChange={e=>setNewAdmin({...newAdmin, username: e.target.value})} className="w-full p-2 border rounded" required /></div>
        <div className="w-full sm:flex-1"><label className="block text-xs font-bold text-gray-500 mb-1">New Password</label><input type="text" value={newAdmin.password} onChange={e=>setNewAdmin({...newAdmin, password: e.target.value})} className="w-full p-2 border rounded" required /></div>
        <button type="submit" className="w-full sm:w-auto px-4 py-2 bg-[#123524] text-white rounded font-bold flex items-center justify-center"><PlusCircle className="w-4 h-4 mr-1"/> Add Admin</button>
      </form>

      <div className="overflow-x-auto"><table className="w-full text-left border-collapse min-w-[600px]"><thead><tr className="border-b-2 border-gray-100 text-xs text-gray-500 uppercase tracking-wider"><th className="p-3 pb-4">Username</th><th className="p-3 pb-4">Password</th><th className="p-3 pb-4 text-right">Action</th></tr></thead><tbody>{admins.map((a, idx) => (<tr key={idx} className="border-b border-gray-50 hover:bg-gray-50 transition"><td className="p-3 font-bold text-gray-800 flex items-center"><User className="w-4 h-4 mr-2 text-gray-400"/> {a.username}</td><td className="p-3 font-mono text-sm text-gray-500 flex items-center"><Lock className="w-3 h-3 mr-1"/> {a.password}</td><td className="p-3 text-right"><button onClick={() => handleDeleteAdmin(a.username)} className="p-1.5 bg-red-50 text-red-600 rounded hover:bg-red-100 font-bold text-[10px] flex items-center ml-auto"><Trash2 className="w-3 h-3 mr-1"/> Delete</button></td></tr>))}</tbody></table></div>
    </div>
  );
}

function AdminSettings({ appData, onSettingsUpdated }: { appData: AppData, onSettingsUpdated: (data: AppData) => void }) {
  const [localTherapists, setLocalTherapists] = useState<TherapistProfile[]>(JSON.parse(JSON.stringify(appData.therapists || [])));
  const [localCategories, setLocalCategories] = useState<MenuCategory[]>(JSON.parse(JSON.stringify(appData.categories || [])));
  const [localBranding, setLocalBranding] = useState<AppBranding>(JSON.parse(JSON.stringify(appData.branding || { logoUrl: '', address: '', phone1: '', phone2: '', copyright: '', name: '' })));
  const [localPaymentMethods, setLocalPaymentMethods] = useState<PaymentMethod[]>(JSON.parse(JSON.stringify(appData.paymentMethods || [])));
  const [localPromotion, setLocalPromotion] = useState<PromotionSettings>(JSON.parse(JSON.stringify(appData.promotion || {})));
  
  // DOWNLOAD APP INSTRUCTIONS STATE (Direct from Firebase to avoid undefined state issues)
  const [localInstallSteps, setLocalInstallSteps] = useState<InstallStep[]>(DEFAULT_INSTALL_STEPS);

  const [deletedTherapistIds, setDeletedTherapistIds] = useState<string[]>([]);
  const [savingCategory, setSavingCategory] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState<string | null>(null);

  useEffect(() => {
    const fetchInstallSteps = async () => {
      try {
        const snap = await getDoc(doc(db, 'settings', 'appData'));
        if (snap.exists() && snap.data().installSteps) {
          setLocalInstallSteps(snap.data().installSteps);
        }
      } catch (e) { console.error(e); }
    };
    fetchInstallSteps();
  }, []);

  const handleSaveCategory = async (cIdx: number) => {
    const cat = localCategories[cIdx];
    if (!window.confirm(`Are you sure you want to save ${cat.title}?`)) return;
    setSavingCategory(cat.id);
    try {
      await setDoc(doc(db, 'settings', 'appData'), { categories: localCategories }, { merge: true });
      onSettingsUpdated({ ...appData, categories: localCategories });
      alert('Saved Successfully.');
    } catch (e) { alert('Update error.'); }
    setSavingCategory(null);
  };

  const handleSavePromotion = async () => {
    if (!window.confirm(`Are you sure you want to save promotion settings?`)) return;
    setSavingCategory('promotion');
    try {
      await setDoc(doc(db, 'settings', 'appData'), { promotion: localPromotion }, { merge: true });
      onSettingsUpdated({ ...appData, promotion: localPromotion });
      alert('Promotion settings saved successfully.');
    } catch (e) { alert('Update error.'); }
    setSavingCategory(null);
  };

  const handleSaveTherapists = async () => {
    if (!window.confirm(`Are you sure you want to save therapists list and ranking?`)) return;
    setSavingCategory('therapists');
    try {
      const finalizedTherapists = localTherapists.map((t, idx) => ({ ...t, order: idx }));
      const tPromises = finalizedTherapists.map((t) => setDoc(doc(db, 'therapists', t.id), { name: t.name, images: t.images, order: t.order, password: t.password || '' }));
      const delPromises = deletedTherapistIds.map(id => deleteDoc(doc(db, 'therapists', id)));
      await Promise.all([...tPromises, ...delPromises]);
      setDeletedTherapistIds([]);
      setLocalTherapists(finalizedTherapists);
      onSettingsUpdated({ ...appData, therapists: finalizedTherapists });
      alert('Therapists saved successfully.');
    } catch (e) { alert('Update error.'); }
    setSavingCategory(null);
  };

  const handleSaveBranding = async () => {
    if (!window.confirm(`Are you sure you want to save branding settings?`)) return;
    setSavingCategory('branding');
    try {
      await setDoc(doc(db, 'settings', 'appData'), { branding: localBranding }, { merge: true });
      onSettingsUpdated({ ...appData, branding: localBranding });
      alert('Branding saved successfully.');
    } catch (e) { alert('Update error.'); }
    setSavingCategory(null);
  };

  const handleSavePayments = async () => {
    if (!window.confirm(`Are you sure you want to save payment methods?`)) return;
    setSavingCategory('payments');
    try {
      await setDoc(doc(db, 'settings', 'appData'), { paymentMethods: localPaymentMethods }, { merge: true });
      onSettingsUpdated({ ...appData, paymentMethods: localPaymentMethods });
      alert('Payment methods saved successfully.');
    } catch (e) { alert('Update error.'); }
    setSavingCategory(null);
  };

  // SAVE INSTALL STEPS FUNCTION
  const handleSaveInstallSteps = async () => {
    if (!window.confirm(`Are you sure you want to save Install Instructions?`)) return;
    setSavingCategory('install_steps');
    try {
      await setDoc(doc(db, 'settings', 'appData'), { installSteps: localInstallSteps }, { merge: true });
      onSettingsUpdated({ ...appData, installSteps: localInstallSteps });
      alert('Install Instructions saved successfully.');
    } catch (e) { alert('Update error.'); }
    setSavingCategory(null);
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return; setUploadingImage('logo');
    try { const base64 = await compressImage(file, 400, 400); setLocalBranding({ ...localBranding, logoUrl: base64 }); } catch (err) { alert("Error"); }
    setUploadingImage(null);
  };

  const handlePaymentLogoUpload = async (idx: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return; setUploadingImage(`pay_${idx}`);
    try { const base64 = await compressImage(file, 200, 200); const updated = [...localPaymentMethods]; updated[idx].logoUrl = base64; setLocalPaymentMethods(updated); } catch (err) { alert("Error"); }
    setUploadingImage(null);
  };

  // UPLOAD SCREENSHOT FOR INSTALL STEP (600x1200 Resolution for clarity, optimized for size)
  const handleInstallImageUpload = async (idx: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return; setUploadingImage(`install_${idx}`);
    try { 
       const base64 = await compressImage(file, 600, 1200); 
       const updated = [...localInstallSteps]; 
       updated[idx].imageUrl = base64; 
       setLocalInstallSteps(updated); 
    } catch (err) { alert("Error uploading image"); }
    setUploadingImage(null);
  };

  const addTherapist = () => setLocalTherapists([...localTherapists, { id: `t_${Date.now()}`, name: 'New Therapist', images: [], order: localTherapists.length, password: '' }]);
  const updateTherapistField = (tIdx: number, field: keyof TherapistProfile, val: any) => { const updated = [...localTherapists]; updated[tIdx] = { ...updated[tIdx], [field]: val }; setLocalTherapists(updated); };
  const removeTherapist = (tIdx: number) => { if (!window.confirm("Are you sure?")) return; const t = localTherapists[tIdx]; if (t.id && !t.id.startsWith('new_')) setDeletedTherapistIds([...deletedTherapistIds, t.id]); const updated = [...localTherapists]; updated.splice(tIdx, 1); setLocalTherapists(updated); };
  const moveTherapistUp = (tIdx: number) => { if (tIdx === 0) return; const updated = [...localTherapists]; const temp = updated[tIdx - 1]; updated[tIdx - 1] = updated[tIdx]; updated[tIdx] = temp; setLocalTherapists(updated); };
  const moveTherapistDown = (tIdx: number) => { if (tIdx === localTherapists.length - 1) return; const updated = [...localTherapists]; const temp = updated[tIdx + 1]; updated[tIdx + 1] = updated[tIdx]; updated[tIdx] = temp; setLocalTherapists(updated); };
  const handleImageUpload = async (tIdx: number, files: FileList | null) => { if (!files || files.length === 0) return; const therapist = localTherapists[tIdx]; if (therapist.images.length + files.length > 5) { alert('Max 5 photos allowed.'); return; } setUploadingImage(therapist.id); const newUrls: string[] = []; try { for (let i = 0; i < files.length; i++) { const base64 = await compressImage(files[i], 900, 1200); newUrls.push(base64); } const updated = [...localTherapists]; updated[tIdx].images = [...updated[tIdx].images, ...newUrls]; setLocalTherapists(updated); } catch (err) { alert("Upload error."); } setUploadingImage(null); };
  const removeImage = (tIdx: number, imgIdx: number) => { const updated = [...localTherapists]; updated[tIdx].images.splice(imgIdx, 1); setLocalTherapists(updated); };

  const updateItem = (cIdx: number, iIdx: number, field: string, val: any) => { const updated = [...localCategories]; (updated[cIdx].items[iIdx] as any)[field] = val; setLocalCategories(updated); };
  const addItem = (cIdx: number) => { const updated = [...localCategories]; updated[cIdx].items.push({ id: Date.now().toString(), name: 'New Service', price: 0, duration: '60 Mins', vvipIncluded: false }); setLocalCategories(updated); };
  const deleteItem = (cIdx: number, iIdx: number) => { if (!window.confirm("Are you sure?")) return; const updated = [...localCategories]; updated[cIdx].items.splice(iIdx, 1); setLocalCategories(updated); };

  const updatePaymentMethod = (pIdx: number, field: string, val: string) => { const updated = [...localPaymentMethods]; (updated[pIdx] as any)[field] = val; setLocalPaymentMethods(updated); };
  const addPaymentMethod = () => { setLocalPaymentMethods([...localPaymentMethods, { id: `p_${Date.now()}`, name: 'New Payment', accountNumber: '', accountName: '', logoUrl: '' }]); };
  const removePaymentMethod = (pIdx: number) => { if (!window.confirm("Are you sure?")) return; const updated = [...localPaymentMethods]; updated.splice(pIdx, 1); setLocalPaymentMethods(updated); };

  return (
    <div className="space-y-6">

      {/* App Promotion & Discounts Section */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200 mt-6">
         <div className="flex justify-between items-center mb-6 pb-4 border-b border-gray-100">
            <div>
               <h3 className="text-xl font-bold text-gray-800 flex items-center"><Sparkles className="w-5 h-5 mr-2 text-green-600" /> App Promotion & Discounts</h3>
               <p className="text-xs text-gray-500 mt-1">Web App မှ Booking တင်သူများအတွက် Discount သတ်မှတ်ရန်</p>
            </div>
            <button disabled={savingCategory === 'promotion'} onClick={handleSavePromotion} className="flex items-center bg-[#123524] text-white px-4 py-2 rounded-lg font-bold shadow-md hover:opacity-90 flex-shrink-0 ml-3">
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

      {/* ================= NEW: Install Instructions UI ================= */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200 mt-6">
         <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 pb-4 border-b border-gray-100">
            <div className="mb-4 sm:mb-0">
               <h3 className="text-xl font-bold text-gray-800 flex items-center"><Download className="w-5 h-5 mr-2 text-[#D4AF37]" /> Download App Instructions</h3>
               <p className="text-xs text-gray-500 mt-1">Download App နှိပ်လျှင် ပေါ်လာမည့် လမ်းညွှန်ချက်များနှင့် ပုံများ (အများဆုံး ၁၀ ဆင့်)</p>
            </div>
            <div className="flex space-x-2">
               <button onClick={() => { if(localInstallSteps.length < 10) setLocalInstallSteps([...localInstallSteps, { id: Date.now().toString(), text: '', imageUrl: '' }]) }} className="flex items-center text-sm bg-gray-100 border border-gray-300 px-4 py-2 rounded-lg hover:bg-gray-200 font-bold whitespace-nowrap"><PlusCircle className="w-4 h-4 mr-1" /> Add Step</button>
               <button disabled={savingCategory === 'install_steps'} onClick={handleSaveInstallSteps} className="flex items-center bg-[#123524] text-white px-4 py-2 rounded-lg font-bold shadow-md hover:opacity-90 flex-shrink-0"><Save className="w-4 h-4 mr-2" /> {savingCategory === 'install_steps' ? 'Saving...' : 'Save'}</button>
            </div>
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
                        ) : (
                           <ImageIcon className="w-6 h-6 text-gray-400" />
                        )}
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

      <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
        <div className="flex justify-between items-center mb-6 pb-4 border-b border-gray-100">
          <div>
             <h3 className="text-xl font-bold text-gray-800 flex items-center">App Branding & Footer</h3>
             <div className="flex flex-wrap gap-2 mt-2">
                 <button type="button" onClick={() => {
                    const url = window.location.origin + window.location.pathname + '?view=therapists';
                    navigator.clipboard.writeText(url);
                    alert('Gallery Link Copied:\n' + url);
                 }} className="text-xs flex items-center text-blue-600 bg-blue-50 px-3 py-1.5 rounded border border-blue-200 hover:bg-blue-100 transition whitespace-nowrap">
                    <Copy className="w-3 h-3 mr-1"/> Copy Gallery Link
                 </button>
                 <button type="button" onClick={() => {
                    const url = window.location.origin + window.location.pathname + '?view=dashboard';
                    navigator.clipboard.writeText(url);
                    alert('Dashboard Link Copied:\n' + url);
                 }} className="text-xs flex items-center text-green-600 bg-green-50 px-3 py-1.5 rounded border border-green-200 hover:bg-green-100 transition whitespace-nowrap">
                    <Copy className="w-3 h-3 mr-1"/> Copy Dashboard Link
                 </button>
                 <button type="button" onClick={() => {
                    const url = window.location.origin + window.location.pathname + '?mode=staff';
                    navigator.clipboard.writeText(url);
                    alert('Staff Portal Link Copied:\n' + url);
                 }} className="text-xs flex items-center text-purple-600 bg-purple-50 px-3 py-1.5 rounded border border-purple-200 hover:bg-purple-100 transition whitespace-nowrap mt-2 sm:mt-0 sm:ml-2">
                    <Copy className="w-3 h-3 mr-1"/> Copy Staff Portal Link
                 </button>
             </div>
          </div>
          <button disabled={savingCategory === 'branding'} onClick={handleSaveBranding} className="flex items-center bg-[#123524] text-white px-4 py-2 rounded-lg font-bold shadow-md hover:opacity-90 flex-shrink-0 ml-3">
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
            <label className="bg-white border border-gray-300 text-gray-700 px-4 py-2 rounded-lg text-sm font-bold cursor-pointer hover:bg-gray-100 transition shadow-sm">
              {localBranding.logoUrl ? 'Change Logo' : 'Upload Logo'}
              <input type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} disabled={uploadingImage === 'logo'} />
            </label>
          </div>
          <div className="space-y-4">
            <div><label className="block text-xs font-bold text-gray-500 mb-1">Business Name</label><input type="text" value={localBranding.name || ''} onChange={e => setLocalBranding({ ...localBranding, name: e.target.value })} className="w-full p-2 text-sm border border-gray-300 rounded focus:border-[#D4AF37] outline-none" /></div>
            <div><label className="block text-xs font-bold text-gray-500 mb-1">Address</label><textarea value={localBranding.address} onChange={e => setLocalBranding({ ...localBranding, address: e.target.value })} className="w-full p-2 text-sm border border-gray-300 rounded focus:border-[#D4AF37] outline-none" rows={2} /></div>
            <div className="grid grid-cols-2 gap-2">
              <div><label className="block text-xs font-bold text-gray-500 mb-1">Phone 1</label><input type="text" value={localBranding.phone1} onChange={e => setLocalBranding({ ...localBranding, phone1: e.target.value })} className="w-full p-2 text-sm border border-gray-300 rounded focus:border-[#D4AF37] outline-none" /></div>
              <div><label className="block text-xs font-bold text-gray-500 mb-1">Phone 2</label><input type="text" value={localBranding.phone2} onChange={e => setLocalBranding({ ...localBranding, phone2: e.target.value })} className="w-full p-2 text-sm border border-gray-300 rounded focus:border-[#D4AF37] outline-none" /></div>
            </div>
            <div><label className="block text-xs font-bold text-gray-500 mb-1">Copyright Text</label><input type="text" value={localBranding.copyright} onChange={e => setLocalBranding({ ...localBranding, copyright: e.target.value })} className="w-full p-2 text-sm border border-gray-300 rounded focus:border-[#D4AF37] outline-none" /></div>
          </div>
        </div>

        <div className="border-t border-gray-100 pt-6 mt-6">
          <h4 className="text-sm font-bold text-gray-800 mb-2">Shop Location (For Staff Out Pass GPS Restriction)</h4>
          <div className="flex items-center space-x-2">
             <div className="flex-1 bg-gray-50 p-3 rounded border border-gray-200 text-xs text-gray-600 font-mono">
               Lat: {localBranding.shopLat ? localBranding.shopLat.toFixed(5) : 'Not set'}, Lng: {localBranding.shopLng ? localBranding.shopLng.toFixed(5) : 'Not set'}
             </div>
             <button type="button" onClick={() => {
                navigator.geolocation.getCurrentPosition((pos) => {
                   setLocalBranding({...localBranding, shopLat: pos.coords.latitude, shopLng: pos.coords.longitude});
                   alert("Location updated! Please click 'Save' above to confirm.");
                }, () => alert("Please enable Location Services in your browser to get coordinates."), {enableHighAccuracy: true});
             }} className="bg-green-50 text-green-700 px-4 py-3 rounded-lg text-xs font-bold border border-green-200 hover:bg-green-100 transition whitespace-nowrap">
                Get Current GPS
             </button>
          </div>
          <p className="text-[10px] text-gray-400 mt-2">Staff will only be able to Clock Out/In within 15 meters of this exact location. Make sure you are physically at the shop when setting this.</p>
        </div>
      </div>

      <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
        <div className="flex justify-between items-center mb-6 pb-4 border-b border-gray-100"><div><h3 className="text-xl font-bold text-gray-800 flex items-center"><CreditCard className="w-5 h-5 mr-2 text-[#D4AF37]" /> Manage Payment</h3></div><div className="flex space-x-2"><button onClick={addPaymentMethod} className="flex items-center text-sm bg-gray-100 border border-gray-300 px-4 py-2 rounded-lg hover:bg-gray-200 font-bold whitespace-nowrap"><PlusCircle className="w-4 h-4 mr-1" /> Add Payment</button><button disabled={savingCategory === 'payments'} onClick={handleSavePayments} className="flex items-center bg-[#123524] text-white px-4 py-2 rounded-lg font-bold shadow-md hover:opacity-90 flex-shrink-0"><Save className="w-4 h-4 mr-2" /> {savingCategory === 'payments' ? 'Saving...' : 'Save'}</button></div></div>
        <div className="space-y-3">{localPaymentMethods.map((pm, pIdx) => (<div key={pm.id} className="grid grid-cols-1 lg:grid-cols-12 gap-3 items-center bg-gray-50 p-3 border border-gray-200 rounded-lg hover:border-gray-300 transition"><div className="lg:col-span-2 flex flex-col items-center justify-center border-r border-gray-200 pr-2"><div className="w-12 h-12 bg-white border border-gray-200 rounded mb-1 flex items-center justify-center overflow-hidden relative group">{pm.logoUrl ? (<><img src={pm.logoUrl} alt="Logo" className="w-full h-full object-contain p-1" /><button onClick={() => updatePaymentMethod(pIdx, 'logoUrl', '')} className="absolute inset-0 bg-black/50 text-white flex items-center justify-center opacity-0 group-hover:opacity-100"><X className="w-4 h-4" /></button></>) : (<div className="text-[8px] text-gray-400 text-center">{uploadingImage === `pay_${pIdx}` ? '...' : 'No Logo'}</div>)}</div><label className="text-[10px] text-[#D4AF37] font-bold cursor-pointer hover:underline">Upload Logo<input type="file" accept="image/*" className="hidden" onChange={(e) => handlePaymentLogoUpload(pIdx, e)} disabled={uploadingImage === `pay_${pIdx}`} /></label></div><div className="lg:col-span-3"><label className="text-[10px] font-bold text-gray-400 uppercase">Bank Name</label><input type="text" value={pm.name} onChange={(e) => updatePaymentMethod(pIdx, 'name', e.target.value)} className="w-full p-2 text-sm border border-gray-200 rounded focus:border-[#D4AF37] outline-none font-bold text-gray-700" /></div><div className="lg:col-span-3"><label className="text-[10px] font-bold text-gray-400 uppercase">Account No</label><input type="text" value={pm.accountNumber} onChange={(e) => updatePaymentMethod(pIdx, 'accountNumber', e.target.value)} className="w-full p-2 text-sm border border-gray-200 rounded focus:border-[#D4AF37] outline-none font-bold text-[#123524] tracking-wider" /></div><div className="lg:col-span-3"><label className="text-[10px] font-bold text-gray-400 uppercase">Account Name</label><input type="text" value={pm.accountName} onChange={(e) => updatePaymentMethod(pIdx, 'accountName', e.target.value)} className="w-full p-2 text-sm border border-gray-200 rounded focus:border-[#D4AF37] outline-none" /></div><div className="lg:col-span-1 flex justify-end pt-4 lg:pt-0"><button onClick={() => removePaymentMethod(pIdx)} className="p-2 text-red-500 hover:bg-red-50 hover:text-red-700 rounded-lg transition"><Trash2 className="w-5 h-5" /></button></div></div>))}</div>
      </div>

      <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
        <div className="flex justify-between items-center mb-6 pb-4 border-b border-gray-100"><div><h3 className="text-xl font-bold text-gray-800 flex items-center"><User className="w-5 h-5 mr-2 text-[#D4AF37]" /> Manage Therapists (Staff)</h3></div><div className="flex space-x-2"><button onClick={addTherapist} className="flex items-center text-sm bg-gray-100 border border-gray-300 px-4 py-2 rounded-lg hover:bg-gray-200 font-bold whitespace-nowrap"><PlusCircle className="w-4 h-4 mr-1" /> Add Therapist</button><button disabled={savingCategory === 'therapists'} onClick={handleSaveTherapists} className="flex items-center bg-[#123524] text-white px-4 py-2 rounded-lg font-bold shadow-md hover:opacity-90 flex-shrink-0"><Save className="w-4 h-4 mr-2" /> {savingCategory === 'therapists' ? 'Saving...' : 'Save'}</button></div></div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {localTherapists.map((therapist, tIdx) => (
            <div key={therapist.id} className="border border-gray-200 rounded-xl p-4 bg-gray-50 relative">
              <button onClick={() => removeTherapist(tIdx)} className="absolute top-2 right-2 p-1 bg-red-100 text-red-500 rounded hover:bg-red-200"><Trash2 className="w-4 h-4" /></button>
              
              <div className="mb-3 mt-2">
                 <span className="bg-[#123524] text-white text-[10px] font-bold px-2 py-1 rounded">Login ID: {therapist.id}</span>
              </div>

              <div className="grid grid-cols-2 gap-3 mb-4">
                 <div>
                    <label className="block text-xs font-bold text-gray-500 mb-1">Therapist Name</label>
                    <input type="text" value={therapist.name} onChange={(e) => updateTherapistField(tIdx, 'name', e.target.value)} className="w-full p-2 text-sm font-bold border border-gray-300 rounded focus:outline-none focus:border-[#D4AF37]" />
                 </div>
                 <div>
                    <label className="block text-xs font-bold text-gray-500 mb-1">Login Password</label>
                    <input type="text" value={therapist.password || ''} onChange={(e) => updateTherapistField(tIdx, 'password', e.target.value)} placeholder="Password" className="w-full p-2 text-sm font-bold border border-gray-300 rounded focus:outline-none focus:border-[#D4AF37]" />
                 </div>
              </div>
              
              <label className="block text-xs font-bold text-gray-500 mb-2">Photos (Max 5)</label>
              <div className="flex flex-wrap gap-2 mb-2">
                {therapist.images.map((imgUrl, imgIdx) => (
                  <div key={imgIdx} className="w-16 aspect-[3/4] relative rounded overflow-hidden shadow-sm border border-gray-200">
                    <img src={imgUrl} alt="upload" className="w-full h-full object-cover" />
                    <button onClick={() => removeImage(tIdx, imgIdx)} className="absolute top-1 right-1 bg-black/50 text-white rounded-full p-0.5 hover:bg-red-500"><X className="w-3 h-3" /></button>
                  </div>
                ))}
                {therapist.images.length < 5 && (
                    <>
                    <label className="w-16 aspect-[3/4] border-2 border-dashed border-gray-300 rounded flex flex-col items-center justify-center cursor-pointer hover:bg-gray-100 hover:border-gray-400 transition text-gray-400 relative">
                        {uploadingImage === therapist.id ? <div className="text-[10px] font-bold animate-pulse text-center">Wait...</div> : (<span className="text-[10px] font-bold">Upload</span>)}
                        <input type="file" accept="image/*" multiple className="absolute inset-0 opacity-0 cursor-pointer" onChange={(e) => handleImageUpload(tIdx, e.target.files)} disabled={uploadingImage === therapist.id} />
                    </label>
                    </>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200 mt-6">
         <div className="flex justify-between items-center mb-6 pb-4 border-b border-gray-100">
            <div>
               <h3 className="text-xl font-bold text-gray-800 flex items-center"><Crown className="w-5 h-5 mr-2 text-[#D4AF37]" /> Top 5 Therapists Ranking</h3>
               <p className="text-xs text-gray-500 mt-1">ဘိုကင်အရေအတွက် တူညီနေပါက အောက်ပါအစီအစဉ်အတိုင်း Top 5 တွင် ပေါ်မည်ဖြစ်ပါသည်။</p>
            </div>
            <button disabled={savingCategory === 'therapists'} onClick={handleSaveTherapists} className="flex items-center bg-[#123524] text-white px-4 py-2 rounded-lg font-bold shadow-md hover:opacity-90 flex-shrink-0 ml-3">
               <Save className="w-4 h-4 mr-2" /> {savingCategory === 'therapists' ? 'Saving...' : 'Save'}
            </button>
         </div>
         <div className="flex flex-col space-y-2">
            {localTherapists.map((therapist, tIdx) => (
                <div key={therapist.id} className="flex items-center justify-between p-3 bg-gray-50 border border-gray-200 rounded-lg hover:border-[#D4AF37] transition">
                    <div className="flex items-center">
                        <span className="w-6 h-6 rounded bg-[#123524] text-white flex items-center justify-center text-xs font-bold mr-3">{tIdx + 1}</span>
                        <span className="font-bold text-gray-800 text-sm">{therapist.name}</span>
                    </div>
                    <div className="flex space-x-1">
                        <button type="button" onClick={() => moveTherapistUp(tIdx)} disabled={tIdx === 0} className="p-1.5 bg-white border border-gray-300 text-gray-600 rounded hover:bg-gray-100 disabled:opacity-30"><ChevronUp className="w-4 h-4" /></button>
                        <button type="button" onClick={() => moveTherapistDown(tIdx)} disabled={tIdx === localTherapists.length - 1} className="p-1.5 bg-white border border-gray-300 text-gray-600 rounded hover:bg-gray-100 disabled:opacity-30"><ChevronDown className="w-4 h-4" /></button>
                    </div>
                </div>
            ))}
         </div>
      </div>

      {localCategories.map((cat, cIdx) => (
        <div key={cat.id} className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden mt-6">
          <div className="bg-gray-50 p-4 border-b border-gray-200 flex justify-between items-center"><h3 className="font-bold text-gray-800 flex items-center text-lg"><Activity className="w-5 h-5 mr-2 text-[#D4AF37]" /> {cat.title} Category</h3><div className="flex space-x-2"><button onClick={() => addItem(cIdx)} className="flex items-center text-sm bg-white border border-gray-300 px-4 py-2 rounded-lg hover:bg-gray-100 font-bold whitespace-nowrap"><PlusCircle className="w-4 h-4 mr-1" /> Add Item</button><button disabled={savingCategory === cat.id} onClick={() => handleSaveCategory(cIdx)} className="flex items-center bg-[#D4AF37] text-white px-4 py-2 rounded-lg font-bold shadow-md hover:opacity-90 flex-shrink-0"><Save className="w-4 h-4 mr-2" /> {savingCategory === cat.id ? 'Saving...' : 'Save'}</button></div></div>
          <div className="p-4 space-y-3">{cat.items.length === 0 && <p className="text-sm text-gray-400 text-center py-4">No items in this category.</p>}
            {cat.items.map((item, iIdx) => (<div key={item.id} className="grid grid-cols-1 lg:grid-cols-12 gap-2 items-center bg-white p-3 border border-gray-200 rounded-lg hover:border-gray-300 transition"><div className="lg:col-span-3"><label className="text-[10px] font-bold text-gray-400 uppercase">Service Name</label><input type="text" value={item.name} onChange={(e) => updateItem(cIdx, iIdx, 'name', e.target.value)} className="w-full p-2 text-sm border border-gray-200 rounded focus:border-[#D4AF37] outline-none font-bold text-gray-700" /></div><div className="lg:col-span-2"><label className="text-[10px] font-bold text-gray-400 uppercase">Duration/Info</label><input type="text" value={item.duration} onChange={(e) => updateItem(cIdx, iIdx, 'duration', e.target.value)} placeholder="60 Mins" className="w-full p-2 text-sm border border-gray-200 rounded focus:border-[#D4AF37] outline-none" /></div><div className="lg:col-span-2"><label className="text-[10px] font-bold text-gray-400 uppercase">Price (Ks)</label><input type="number" value={item.price || ''} onChange={(e) => updateItem(cIdx, iIdx, 'price', Number(e.target.value))} className="w-full p-2 text-sm border border-gray-200 rounded focus:border-[#D4AF37] outline-none font-bold text-[#123524]" /></div><div className="lg:col-span-2"><label className="text-[10px] font-bold text-gray-400 uppercase">VVIP Price (Ks)</label><input type="number" value={item.vvipPrice || ''} onChange={(e) => updateItem(cIdx, iIdx, 'vvipPrice', e.target.value === '' ? undefined : Number(e.target.value))} placeholder="Optional" className="w-full p-2 text-sm border border-gray-200 rounded focus:border-[#D4AF37] outline-none font-bold text-yellow-600" /></div><div className="lg:col-span-2 flex items-center px-2 pt-4"><label className="text-xs font-bold text-gray-600 flex items-center cursor-pointer bg-gray-50 px-2 py-1.5 rounded border border-gray-200 w-full"><input type="checkbox" checked={item.vvipIncluded || false} onChange={(e) => updateItem(cIdx, iIdx, 'vvipIncluded', e.target.checked)} className="mr-2" /> VVIP Free</label></div><div className="lg:col-span-1 flex justify-end pt-4 lg:pt-0"><button onClick={() => deleteItem(cIdx, iIdx)} className="p-2 text-red-500 hover:bg-red-50 hover:text-red-700 rounded-lg transition"><Trash2 className="w-5 h-5" /></button></div></div>))}
          </div>
        </div>
      ))}
    </div>
  );
}
