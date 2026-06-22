import React, { useState, useEffect } from 'react';
import { collection, addDoc, updateDoc, doc, query, orderBy, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';

// လိုအပ်မည့် Icon အားလုံး
import { Calendar, Clock, User, ChevronLeft, CheckCircle, Sparkles, Coffee, LogOut, ShieldAlert, KeyRound, Trash2, CalendarPlus, History } from 'lucide-react';

// Shared ဖိုင်မှ လိုအပ်သည်များ
import { THEME, AppData, TherapistProfile, Booking, OutPass, formatPrice } from '../shared';

// CustomerApp ဖိုင်မှ မျှဝေသုံးစွဲထားသော Component များ (Clock In နှင့် Status တွက်ရန်)
import { CustomerBookingWizard, StatusBadge } from './CustomerApp';

// ==========================================
// LOCAL HELPERS (To avoid Reference Errors)
// ==========================================
const getLocalTodayStr = () => {
  const d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
};

const formatSecondsMMSS = (totalSeconds: number | undefined) => {
    if (totalSeconds === undefined) return '00:00';
    const isNegative = totalSeconds < 0;
    const absSecs = Math.abs(totalSeconds);
    const m = Math.floor(absSecs / 60);
    const s = Math.floor(absSecs % 60);
    return `${isNegative ? '-' : ''}${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
};

const calculateDistanceInMeters = (lat1: number, lon1: number, lat2: number, lon2: number) => {
  const R = 6371e3; // Earth's radius in metres
  const p1 = lat1 * Math.PI / 180;
  const p2 = lat2 * Math.PI / 180;
  const dp = (lat2 - lat1) * Math.PI / 180;
  const dl = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dp / 2) * Math.sin(dp / 2) + Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) * Math.sin(dl / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

// ==========================================
// MAIN STAFF APP WRAPPER
// ==========================================
export default function StaffApp({ appData }: { appData: AppData }) {
   const [loggedInStaff, setLoggedInStaff] = useState<TherapistProfile | null>(() => {
       const saved = localStorage.getItem('shangrila_staff_profile');
       return saved ? JSON.parse(saved) : null;
   });
   const handleLogout = () => { setLoggedInStaff(null); localStorage.removeItem('shangrila_staff_profile'); };

   return (
       <div className="max-w-3xl mx-auto">
           {loggedInStaff ? (
               <StaffSessionManager appData={appData} loggedInStaff={loggedInStaff} onLogout={handleLogout} />
           ) : (
               <StaffLogin therapists={appData.therapists} onLoginSuccess={(profile) => {
                   setLoggedInStaff(profile); localStorage.setItem('shangrila_staff_profile', JSON.stringify(profile));
               }} />
           )}
       </div>
   );
}

// ==========================================
// STAFF LOGIN
// ==========================================
function StaffLogin({ therapists, onLoginSuccess }: { therapists: TherapistProfile[], onLoginSuccess: (p: TherapistProfile) => void }) {
   const [therapistId, setTherapistId] = useState('');
   const [password, setPassword] = useState('');
   const [error, setError] = useState('');

   const handleLogin = (e: React.FormEvent) => {
       e.preventDefault(); setError('');
       const staff = therapists.find(t => t.id === therapistId);
       if (staff && staff.password === password) { onLoginSuccess(staff); } else { setError('Invalid Therapist Selection or Password.'); }
   };

   return (
       <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100 max-w-sm mx-auto text-center mt-10 animate-fade-in px-4 sm:px-8">
           <div className="w-16 h-16 bg-red-50 rounded-full mx-auto flex items-center justify-center mb-6 text-[#123524]"><ShieldAlert className="w-8 h-8" /></div>
           <h2 className="text-xl font-bold text-gray-800 mb-2">Staff Portal Login</h2>
           <p className="text-xs font-bold text-gray-500 mb-6">Secure Access Only</p>
           <form onSubmit={handleLogin} className="space-y-4">
               <div>
                   <label className="block text-left text-xs font-bold text-gray-500 mb-1">Select Therapist</label>
                   <select required value={therapistId} onChange={e=>setTherapistId(e.target.value)} className="w-full p-3 bg-gray-50 border border-gray-200 rounded-lg outline-none focus:border-[#D4AF37] font-bold text-center tracking-wider cursor-pointer text-gray-800">
                       <option value="" disabled>-- Select Your Profile --</option>
                       {therapists.map(t => (<option key={t.id} value={t.id}>{t.name}</option>))}
                   </select>
               </div>
               <div>
                   <label className="block text-left text-xs font-bold text-gray-500 mb-1">Password</label>
                   <input required type="password" placeholder="Password" value={password} onChange={e=>setPassword(e.target.value)} className="w-full p-3 bg-gray-50 border border-gray-200 rounded-lg outline-none focus:border-[#D4AF37] font-bold text-center tracking-wider" />
               </div>
               {error && <div className="text-xs font-bold text-red-500">{error}</div>}
               <button type="submit" className="w-full py-3 bg-[#123524] text-white rounded-lg font-bold shadow-md hover:bg-green-900 transition flex items-center justify-center"><KeyRound className="w-4 h-4 mr-2"/> Verify and Login</button>
           </form>
       </div>
   );
}

// ==========================================
// STAFF DASHBOARD / SESSION MANAGER
// ==========================================
function StaffSessionManager({ appData, loggedInStaff, onLogout }: { appData: AppData, loggedInStaff: TherapistProfile, onLogout: () => void }) {
   const [activeSession, setActiveSession] = useState<Booking | null>(null);
   const [showClockInFlow, setShowClockInFlow] = useState(false);
   const [loading, setLoading] = useState(true);
   const [staffTab, setStaffTab] = useState<'service' | 'history' | 'outpass'>('service');

   useEffect(() => {
       const q = query(collection(db, 'bookings'), orderBy('createdAt', 'desc'));
       const unsubscribe = onSnapshot(q, (snap) => {
           let foundActive = null;
           snap.forEach((doc) => {
               const b = { id: doc.id, ...doc.data() } as Booking;
               if (b.therapist === loggedInStaff.name && b.status === 'in_progress') { foundActive = b; }
           });
           setActiveSession(foundActive); setLoading(false);
       });
       return () => unsubscribe();
   }, [loggedInStaff.name]);

   const handleStopSession = async () => {
       if (!activeSession || !activeSession.id) return;
       if (!window.confirm("Are you sure you want to STOP this service now?")) return;
       try {
           const now = Date.now();
           const overtimeMillis = Math.max(0, now - (activeSession.expectedEndTimeMillis || now));
           await updateDoc(doc(db, 'bookings', activeSession.id), { status: 'completed', actualEndTimeMillis: now, overtimeSeconds: Math.floor(overtimeMillis / 1000) });
           setActiveSession(null);
       } catch (error) { console.error(error); alert("Error stopping session."); }
   };

   if (loading) return <div className="text-center py-20 font-bold text-gray-500">Loading Dashboard...</div>;

   return (
       <div className="bg-white p-4 sm:p-8 rounded-2xl shadow-sm border border-gray-100 animate-fade-in relative">
           <div className="flex justify-between items-center mb-6 pb-6 border-b border-gray-100">
               <div className="flex items-center">
                   <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-full overflow-hidden mr-3 sm:mr-4 border-2 border-[#123524] shadow-sm flex-shrink-0">
                       {loggedInStaff.images && loggedInStaff.images[0] ? <img src={loggedInStaff.images[0]} className="w-full h-full object-cover" /> : <User className="w-full h-full p-2 sm:p-3 text-gray-400 bg-gray-100" />}
                   </div>
                   <div>
                       <h2 className="text-xl sm:text-2xl font-bold text-[#123524]">{loggedInStaff.name}</h2>
                       <p className="text-[10px] sm:text-xs font-bold text-gray-500 mt-0.5">Professional Therapist</p>
                   </div>
               </div>
               <button onClick={onLogout} className="text-[10px] sm:text-xs font-bold text-red-500 flex items-center bg-red-50 px-2 sm:px-3 py-1.5 rounded-full hover:bg-red-100 transition border border-red-100 whitespace-nowrap"><LogOut className="w-3.5 h-3.5 sm:mr-1" /> <span className="hidden sm:inline">Log Out</span></button>
           </div>

           <div className="flex space-x-1 sm:space-x-2 mb-6 bg-gray-50 p-1.5 rounded-xl border border-gray-100">
              <button onClick={() => setStaffTab('service')} className={`flex-1 py-2 text-[10px] sm:text-xs font-bold rounded-lg transition ${staffTab === 'service' ? 'bg-white shadow text-[#123524]' : 'text-gray-500 hover:bg-gray-100'}`}>Service</button>
              <button onClick={() => setStaffTab('history')} className={`flex-1 py-2 text-[10px] sm:text-xs font-bold rounded-lg transition ${staffTab === 'history' ? 'bg-white shadow text-[#123524]' : 'text-gray-500 hover:bg-gray-100'}`}>History</button>
              <button onClick={() => setStaffTab('outpass')} className={`flex-1 py-2 text-[10px] sm:text-xs font-bold rounded-lg transition ${staffTab === 'outpass' ? 'bg-white shadow text-[#123524]' : 'text-gray-500 hover:bg-gray-100'}`}>Out Pass</button>
           </div>

           {staffTab === 'history' && <StaffDailyHistoryTab loggedInStaff={loggedInStaff} />}
           {staffTab === 'outpass' && <StaffOutPassTab appData={appData} loggedInStaff={loggedInStaff} />}
           {staffTab === 'service' && (
               activeSession ? (
                   <ActiveSessionDisplay session={activeSession} onStop={handleStopSession} />
               ) : showClockInFlow ? (
                   <div className="animate-fade-in mt-4">
                       <div className="flex items-center justify-between mb-6">
                           <button onClick={() => setShowClockInFlow(false)} className="text-xs font-bold text-gray-500 flex items-center bg-gray-100 px-3 py-1.5 rounded-lg hover:bg-gray-200"><ChevronLeft className="w-3 h-3 mr-1"/> BACK</button>
                       </div>
                       <div className="text-center mb-8 border-b border-gray-100 pb-6">
                          <h2 className="text-2xl font-bold text-[#123524] flex items-center justify-center"><CalendarPlus className="w-6 h-6 mr-2 text-[#D4AF37]"/> Staff Clock In</h2>
                          <p className="text-sm font-bold mt-2 text-[#D4AF37]">(ဆိုင်တွင်း / Outcall ဘိုကင်များ စာရင်းသွင်းရန်)</p>
                       </div>
                       {/* Import လုပ်ထားသော CustomerBookingWizard ကို Staff Mode ဖြင့် အသုံးပြုခြင်း */}
                       <CustomerBookingWizard appData={appData} userPhone="" onBooked={() => {}} forceTherapistFirst={true} isStaffMode={true} staffClockIn={true} staffClockInSuccess={() => setShowClockInFlow(false)} preselectedStaff={loggedInStaff.name}/>
                   </div>
               ) : (
                   <div className="text-center py-16 sm:py-20 border-2 border-dashed border-gray-100 rounded-2xl bg-gray-50 mt-4">
                       <div className="w-20 h-20 sm:w-24 sm:h-24 bg-white rounded-full mx-auto flex items-center justify-center mb-6 sm:mb-8 text-[#D4AF37] shadow-inner border border-gray-100"><CheckCircle className="w-10 h-10 sm:w-12 sm:h-12" /></div>
                       <h3 className="text-xl sm:text-2xl font-bold text-gray-800 mb-2">Ready For Service</h3>
                       <p className="text-[10px] sm:text-xs font-bold text-gray-500 mb-8 sm:mb-10 max-w-sm mx-auto leading-relaxed px-4">No active session. Please click the button below to Clock In and start tracking your service time.</p>
                       <button onClick={() => setShowClockInFlow(true)} className="px-6 sm:px-10 py-3 sm:py-4 bg-[#123524] text-white rounded-xl font-bold shadow-lg flex items-center mx-auto hover:bg-green-900 transition text-sm"><Sparkles className="w-4 h-4 sm:w-5 sm:h-5 mr-2 text-[#D4AF37]"/> Clock In / Start New Service</button>
                   </div>
               )
           )}
       </div>
   );
}

// ==========================================
// STAFF DAILY HISTORY TAB
// ==========================================
function StaffDailyHistoryTab({ loggedInStaff }: { loggedInStaff: TherapistProfile }) {
    const [history, setHistory] = useState<Booking[]>([]);
    const [loading, setLoading] = useState(true);
    const todayStr = getLocalTodayStr();

    useEffect(() => {
        const q = query(collection(db, 'bookings'));
        const unsub = onSnapshot(q, (snap) => {
            const arr: Booking[] = [];
            snap.forEach(doc => {
                const b = { id: doc.id, ...doc.data() } as Booking;
                if (b.therapist === loggedInStaff.name && b.date === todayStr && (b.status === 'completed' || b.status === 'cancelled')) { arr.push(b); }
            });
            arr.sort((a,b) => (b.actualEndTimeMillis || 0) - (a.actualEndTimeMillis || 0));
            setHistory(arr); setLoading(false);
        });
        return () => unsub();
    }, [loggedInStaff.name, todayStr]);

    if (loading) return <div className="text-center py-10 text-xs font-bold text-gray-400">Loading...</div>;

    return (
        <div className="animate-fade-in mt-4">
            <h3 className="font-bold text-gray-800 mb-4 text-sm flex items-center"><History className="w-4 h-4 mr-2 text-[#D4AF37]"/> Today's Completed Services</h3>
            {history.length === 0 ? (
                <div className="text-center py-10 bg-gray-50 rounded-xl border border-gray-100 text-xs font-bold text-gray-400">No completed services today.</div>
            ) : (
                <div className="space-y-3">
                    {history.map(b => (
                        <div key={b.id} className="p-4 bg-gray-50 border border-gray-100 rounded-xl">
                            <div className="flex justify-between items-start mb-2">
                                <span className="font-bold text-sm text-[#123524]">{b.service.split('(')[0]}</span>
                                <span className={`text-[9px] px-2 py-0.5 rounded font-bold uppercase ${b.status === 'completed' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>{b.status}</span>
                            </div>
                            <div className="flex justify-between items-center text-xs text-gray-500">
                                <span>Cust: {b.name}</span>
                                <span>Slot: {b.time}</span>
                            </div>
                            {b.status === 'completed' && b.overtimeSeconds !== undefined && b.overtimeSeconds > 0 && (
                                <div className="mt-2 text-[10px] text-red-500 font-bold bg-red-50 p-1.5 rounded text-right">
                                    Overtime: +{Math.floor(b.overtimeSeconds / 60)} mins
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

// ==========================================
// STAFF OUT PASS TAB (WITH FULL INSTRUCTIONS)
// ==========================================
function StaffOutPassTab({ appData, loggedInStaff }: { appData: AppData, loggedInStaff: TherapistProfile }) {
    const [outpasses, setOutpasses] = useState<OutPass[]>([]);
    const [loading, setLoading] = useState(true);
    const [reason, setReason] = useState('');
    const [locating, setLocating] = useState(false);
    const [locError, setLocError] = useState('');
    const todayStr = getLocalTodayStr();

    useEffect(() => {
        const q = query(collection(db, 'outpasses'));
        const unsub = onSnapshot(q, snap => {
            const arr: OutPass[] = [];
            snap.forEach(d => { const data = d.data() as OutPass; if (data.date === todayStr) arr.push({ id: d.id, ...data }); });
            arr.sort((a,b) => b.outTimeMillis - a.outTimeMillis);
            setOutpasses(arr); setLoading(false);
        });
        return () => unsub();
    }, [todayStr]);

    const myPasses = outpasses.filter(o => o.therapist === loggedInStaff.name);
    const activePasses = outpasses.filter(o => o.status === 'out');
    const myActivePass = myPasses.find(o => o.status === 'out');

    const handleGoOut = async () => {
        if (activePasses.length >= 2) return;
        if (myPasses.length >= 4) return;
        if (!reason.trim()) { setLocError("အကြောင်းပြချက် (Reason) ရေးပေးပါ။"); return; }
        if (!appData.branding.shopLat || !appData.branding.shopLng) { setLocError("Admin Panel -> Settings တွင် ဆိုင်၏ Location အရင်သတ်မှတ်ပါ။"); return; }

        setLocating(true); setLocError('');

        if (!navigator.geolocation) { setLocError("ဖုန်းတွင် Location Service မရနိုင်ပါ။"); setLocating(false); return; }

        navigator.geolocation.getCurrentPosition(async (pos) => {
            const dist = calculateDistanceInMeters(pos.coords.latitude, pos.coords.longitude, appData.branding.shopLat!, appData.branding.shopLng!);
            if (dist > 15) { setLocError(`ဆိုင်နှင့် အကွာအဝေး ${Math.round(dist)} မီတာ ရှိနေပါသည်။ (၁၀ မီတာအတွင်းသာ နှိပ်ခွင့်ရှိသည်)`); setLocating(false); return; }

            const now = Date.now();
            await addDoc(collection(db, 'outpasses'), { therapist: loggedInStaff.name, date: todayStr, outTimeMillis: now, expectedInTimeMillis: now + 30 * 60 * 1000, status: 'out', reason: reason.trim() });
            setReason(''); setLocating(false);
        }, (err) => { setLocError("Location (GPS) ဖွင့်ပေးရန် လိုအပ်ပါသည်။"); setLocating(false); }, { enableHighAccuracy: true });
    };

    const handleReturn = async () => {
        if (!myActivePass || !myActivePass.id) return;
        if (!appData.branding.shopLat || !appData.branding.shopLng) { setLocError("Admin Panel -> Settings တွင် ဆိုင်၏ Location အရင်သတ်မှတ်ပါ။"); return; }

        setLocating(true); setLocError('');

        navigator.geolocation.getCurrentPosition(async (pos) => {
            const dist = calculateDistanceInMeters(pos.coords.latitude, pos.coords.longitude, appData.branding.shopLat!, appData.branding.shopLng!);
            if (dist > 15) { setLocError(`ဆိုင်နှင့် အကွာအဝေး ${Math.round(dist)} မီတာ ရှိနေပါသည်။ (၁၀ မီတာအတွင်းသာ နှိပ်ခွင့်ရှိသည်)`); setLocating(false); return; }

            const now = Date.now();
            const overtimeMillis = Math.max(0, now - myActivePass.expectedInTimeMillis);
            await updateDoc(doc(db, 'outpasses', myActivePass.id), { status: 'returned', inTimeMillis: now, overtimeSeconds: Math.floor(overtimeMillis / 1000) });
            setLocating(false);
        }, (err) => { setLocError("Location (GPS) ဖွင့်ပေးရန် လိုအပ်ပါသည်။"); setLocating(false); }, { enableHighAccuracy: true });
    };

    if (loading) return <div className="text-center py-10 text-xs font-bold text-gray-400">Loading...</div>;

    if (myActivePass) { return <OutPassActiveDisplay pass={myActivePass} onReturn={handleReturn} locating={locating} locError={locError} />; }

    const canGoOut = myPasses.length < 4 && activePasses.length < 2;

    return (
        <div className="bg-white py-6 sm:p-8 rounded-2xl text-center animate-fade-in mt-4 shadow-sm border border-gray-100">
            <div className="w-16 h-16 sm:w-20 sm:h-20 bg-purple-50 rounded-full mx-auto flex items-center justify-center mb-4 sm:mb-6 text-purple-600 border border-purple-100"><Coffee className="w-8 h-8 sm:w-10 sm:h-10" /></div>
            <h3 className="text-lg sm:text-xl font-bold text-gray-800 mb-2">Personal Out Pass</h3>
            
            {/* မူလ Main Code မှ အတိအကျ ပြန်ယူထားသော Instruction စာသားများ */}
            <p className="text-xs text-gray-500 mb-6 leading-relaxed">
               တစ်ရက်လျှင် အများဆုံး ၄ ကြိမ် (၁ ကြိမ်လျှင် မိနစ် ၃၀) ထွက်ခွင့်ရှိပါသည်။<br/>
               <span className="mt-2 inline-block bg-gray-100 px-3 py-1.5 rounded-full shadow-sm text-gray-600">ယနေ့ထွက်ပြီးသားအကြိမ်ရေ: <strong className="text-gray-800">{myPasses.length} / 4</strong></span>
            </p>
            
            {!canGoOut && myPasses.length >= 4 && (
               <div className="bg-red-50 text-red-600 p-4 rounded-xl font-bold border border-red-100 text-[11px] sm:text-xs mb-6">
                  ဒီနေ့အတွက် သင်၏ အပြင်ထွက်ခွင့် (၄ ကြိမ်) ပြည့်သွားပါပြီ။
               </div>
            )}
            {!canGoOut && myPasses.length < 4 && activePasses.length >= 2 && (
               <div className="bg-orange-50 text-orange-700 p-4 rounded-xl font-bold border border-orange-100 text-[11px] sm:text-xs mb-6 leading-relaxed">
                  လက်ရှိတွင် ဝန်ထမ်း ၂ ယောက်<br/>({activePasses.map(p => p.therapist).join(', ')})<br/>အပြင်ထွက်နေပါသည်။ ၎င်းတို့ပြန်လာမှသာ ထွက်ခွင့်ရပါမည်။
               </div>
            )}

            {canGoOut && (
                <div className="mb-4 text-left max-w-xs mx-auto">
                   <label className="block text-xs font-bold text-gray-500 mb-1">အကြောင်းပြချက် (Reason)</label>
                   <input type="text" placeholder="ဥပမာ - စျေးဝယ်၊ မုန့်ဝယ်" value={reason} onChange={e=>setReason(e.target.value)} className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-lg outline-none focus:border-purple-400 text-xs text-gray-800" />
                </div>
            )}
            
            {locError && <div className="text-xs font-bold text-red-500 mb-4 bg-red-50 p-2 rounded">{locError}</div>}
            
            <button disabled={!canGoOut || locating} onClick={handleGoOut} className="px-6 sm:px-8 py-3 sm:py-4 bg-purple-600 text-white rounded-xl font-bold shadow-md w-full sm:w-auto disabled:opacity-50 disabled:cursor-not-allowed hover:bg-purple-700 transition text-sm">
                {locating ? 'Checking Location...' : 'Clock Out (Take 30 Mins Pass)'}
            </button>

            {myPasses.filter(p => p.status === 'returned').length > 0 && (
                <div className="mt-10 text-left">
                    <h4 className="font-bold text-gray-800 text-xs sm:text-sm mb-3 px-1">Today's Out Pass History</h4>
                    <div className="space-y-2">
                        {myPasses.filter(p => p.status === 'returned').map(p => (
                            <div key={p.id} className="p-3 bg-gray-50 rounded-lg border border-gray-200 flex justify-between items-center text-xs">
                                <span className="text-gray-600 font-mono font-semibold">{new Date(p.outTimeMillis).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})} - {p.inTimeMillis ? new Date(p.inTimeMillis).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : ''}</span>
                                {p.overtimeSeconds && p.overtimeSeconds > 0 ? (
                                    <span className="text-red-500 font-bold bg-red-50 px-2 py-1 rounded">Late +{Math.floor(p.overtimeSeconds/60)} mins</span>
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

// ==========================================
// OUT PASS ACTIVE DISPLAY
// ==========================================
function OutPassActiveDisplay({ pass, onReturn, locating, locError }: { pass: OutPass, onReturn: () => void, locating: boolean, locError: string }) {
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
            <div className="inline-flex items-center px-3 py-1 bg-purple-100 text-purple-700 text-[10px] font-bold uppercase tracking-wider rounded-full mb-6 border border-purple-200 animate-pulse"><Coffee className="w-3 h-3 mr-1.5"/> Personal Out Pass Active</div>
            
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
            
            {locError && <div className="text-xs font-bold text-red-500 mb-4 bg-red-50 p-2 rounded">{locError}</div>}
            <button disabled={locating} onClick={onReturn} className="w-full sm:w-auto sm:px-16 py-4 bg-[#123524] text-[#D4AF37] rounded-xl font-bold shadow-lg flex items-center justify-center hover:bg-[#1a4a32] transition border border-[#1a4a32] mx-auto text-sm disabled:opacity-50"><CheckCircle className="w-4 h-4 sm:w-5 sm:h-5 mr-2"/> {locating ? 'Checking Location...' : 'Clock In (Return)'}</button>
        </div>
    );
}

// ==========================================
// ACTIVE SESSION DISPLAY
// ==========================================
function ActiveSessionDisplay({ session, onStop }: { session: Booking, onStop: () => void }) {
   const [remainingTime, setRemainingTime] = useState<number | null>(null);
   const [overtimeSecs, setOvertimeSecs] = useState<number>(0);

   useEffect(() => {
       if (!session.expectedEndTimeMillis) return;
       const updateTimer = () => {
           const now = Date.now();
           if (now < session.expectedEndTimeMillis!) {
               setRemainingTime(Math.ceil((session.expectedEndTimeMillis! - now) / 1000));
               setOvertimeSecs(0);
           } else {
               setRemainingTime(0);
               setOvertimeSecs(Math.floor((now - session.expectedEndTimeMillis!) / 1000));
           }
       };
       updateTimer();
       const intervalId = setInterval(updateTimer, 1000);
       return () => clearInterval(intervalId);
   }, [session.expectedEndTimeMillis]);

   return (
       <div className="animate-fade-in space-y-6 mt-4">
           <div className="bg-white p-5 sm:p-6 rounded-xl border border-gray-100 flex flex-col sm:flex-row sm:flex-nowrap justify-between items-start sm:items-center">
               <div className="w-full sm:w-auto mb-6 sm:mb-0">
                   {/* Shared မှ မဟုတ်ဘဲ CustomerApp မှ လှမ်းယူထားသော StatusBadge */}
                   <StatusBadge status={session.status} />
                   <h3 className="text-lg sm:text-xl font-bold text-gray-800 mt-3">{session.service.split('(')[0]}</h3>
                   <div className="text-[10px] sm:text-xs text-gray-500 mt-1 flex items-center"><Calendar className="w-3 h-3 mr-1"/> {session.date} &nbsp; <Clock className="w-3 h-3 mx-1"/> Slot: {session.time}</div>
                   <div className="text-[10px] sm:text-xs font-bold mt-2 bg-yellow-50 px-2 py-1 rounded inline-block text-yellow-700">Customer: {session.name}</div>
               </div>
               <div className="text-left sm:text-right w-full sm:w-auto pt-4 sm:pt-0 border-t sm:border-0 border-gray-100">
                   {remainingTime !== null && remainingTime > 0 ? (
                       <>
                           <div className="text-[10px] sm:text-xs font-bold text-gray-400 uppercase">REMAINING TIME</div>
                           <div className="text-4xl sm:text-5xl font-mono font-bold text-gray-800 tracking-tighter">{formatSecondsMMSS(remainingTime)}</div>
                           <div className="text-[10px] sm:text-xs font-bold text-gray-500 mt-0.5">Total Service: {session.service.split('(')[1]?.replace(')', '') || '-'}</div>
                       </>
                   ) : (
                       <div className="animate-pulse">
                           <div className="text-[10px] sm:text-xs font-bold text-red-500 uppercase">OVERTIME (အချိန်ပို)</div>
                           <div className="text-4xl sm:text-5xl font-mono font-bold text-red-600 tracking-tighter">+{formatSecondsMMSS(overtimeSecs)}</div>
                           <div className="text-[10px] sm:text-xs font-bold text-red-400 mt-0.5">Duration passed expected time.</div>
                       </div>
                   )}
               </div>
           </div>
           
           <div className="flex justify-between items-center p-3 rounded-lg bg-gray-50 border border-gray-100 text-[10px] sm:text-xs text-gray-500">
               <span>Price: <strong className="text-gray-800 text-xs sm:text-sm">{formatPrice(session.totalPrice)}</strong></span>
               <span className="hidden sm:inline">TxID: <strong className="text-gray-800 text-sm tracking-wider">{session.txId}</strong></span>
               <span>Live: <strong className="text-gray-800 text-xs sm:text-sm">{formatSecondsMMSS(Math.floor((Date.now() - (session.startTimeMillis || Date.now())) / 1000))}</strong></span>
           </div>

           <button onClick={onStop} className="w-full py-4 bg-red-500 text-white rounded-xl font-bold shadow-lg flex items-center justify-center mx-auto hover:bg-red-600 transition text-sm"><Trash2 className="w-4 h-4 sm:w-5 sm:h-5 mr-2"/> Stop Service / End Now</button>
       </div>
   );
}
