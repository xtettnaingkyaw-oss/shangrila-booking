import React, { useState, useEffect } from 'react';
// 🚀 Optimization: Added 'where' to limit queries
import { collection, query, onSnapshot, doc, updateDoc, addDoc, where } from 'firebase/firestore';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { db, auth } from '../firebase';
import { encryptText, decryptText } from '../security'; 
import { LogOut, User, Clock, CheckCircle, ChevronLeft, CalendarPlus, History, Coffee, Sparkles, Trash2, Calendar, ShieldAlert, KeyRound, ChevronDown, Droplets, Trophy, TrendingUp, Target, Award, Star, Crown } from 'lucide-react';
import { THEME, AppData, Booking, OutPass, TherapistProfile } from '../shared';

import { CustomerBookingWizard } from './CustomerApp';

const formatPrice = (price: any) => {
    const num = Number(price);
    if (isNaN(num)) return '0 Ks';
    return num.toLocaleString() + ' Ks';
};

const formatSecondsMMSS = (totalSeconds: number | undefined) => {
    if (totalSeconds === undefined) return '00:00';
    const isNegative = totalSeconds < 0;
    const absSecs = Math.abs(totalSeconds);
    const m = Math.floor(absSecs / 60);
    const s = Math.floor(absSecs % 60);
    return `${isNegative ? '-' : ''}${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
};

const getLocalTodayStr = () => {
    const d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
};

const calculateDistanceInMeters = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371e3;
    const p1 = lat1 * Math.PI / 180;
    const p2 = lat2 * Math.PI / 180;
    const dp = (lat2 - lat1) * Math.PI / 180;
    const dl = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dp / 2) * Math.sin(dp / 2) + Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) * Math.sin(dl / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
};

const XCircleIcon = ({className}:any) => <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>;

function StatusBadge({ status, cancelReason }: { status: string, cancelReason?: string }) {
  if (status === 'in_progress') return <span className="text-orange-600 border border-orange-200 bg-orange-50 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider flex items-center w-fit animate-pulse"><Droplets className="w-3 h-3 mr-1"/> In Progress</span>;
  if (status === 'completed') return <span className="text-gray-600 border border-gray-200 bg-gray-50 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider flex items-center w-fit"><CheckCircle className="w-3 h-3 mr-1"/> Completed</span>;
  if (status === 'payment_checking') return <span className="text-blue-600 border border-blue-200 bg-blue-50 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider flex items-center w-fit"><Clock className="w-3 h-3 mr-1"/> Confirming</span>;
  if (status === 'approved') return <span className="text-green-600 border border-green-200 bg-green-50 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider flex items-center w-fit"><CheckCircle className="w-3 h-3 mr-1"/> Confirmed</span>;
  if (status === 'cancelled') return (
    <div className="flex flex-col items-end">
      <span className="text-red-500 border border-red-200 bg-red-50 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider flex items-center w-fit"><XCircleIcon className="w-3 h-3 mr-1"/> Cancelled</span>
      {cancelReason && <span className="text-[10px] text-red-400 mt-1 max-w-[200px] text-right leading-tight text-xs">Reason: {cancelReason}</span>}
    </div>
  );
  return <span className="text-yellow-600 border border-yellow-200 bg-yellow-50 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider flex items-center w-fit"><Clock className="w-3 h-3 mr-1"/> Pending</span>;
}

export default function StaffApp({ appData }: { appData: AppData }) {
  const [loggedInStaff, setLoggedInStaff] = useState<TherapistProfile | null>(() => {
     const saved = localStorage.getItem('shangrila_staff_profile');
     return saved ? JSON.parse(saved) : null;
  });

  const handleLogout = () => {
     setLoggedInStaff(null);
     localStorage.removeItem('shangrila_staff_profile');
  };

  return (
    <div className="max-w-3xl mx-auto">
      {loggedInStaff ? (
         <StaffSessionManager appData={appData} loggedInStaff={loggedInStaff} onLogout={handleLogout} />
      ) : (
         <StaffLogin therapists={appData.therapists} onLoginSuccess={(profile) => {
             setLoggedInStaff(profile);
             localStorage.setItem('shangrila_staff_profile', JSON.stringify(profile));
         }} />
      )}
    </div>
  );
}

function StaffLogin({ therapists, onLoginSuccess }: { therapists: TherapistProfile[], onLoginSuccess: (p: TherapistProfile) => void }) {
  const [therapistId, setTherapistId] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(''); setLoading(true);
    const staff = therapists.find(t => t.id === therapistId);
    
    try {
       await signInWithEmailAndPassword(auth, `${therapistId.toLowerCase()}@shangrila.com`, password);
       const decPassword = staff ? (decryptText(staff.password) || staff.password) : '';
       onLoginSuccess({ ...staff!, password: decPassword });
    } catch(err) {
       setError('Invalid Therapist Selection or Password.');
    }
    setLoading(false);
  };

  return (
    <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100 max-w-sm mx-auto text-center mt-10 animate-fade-in">
      <div className="w-16 h-16 bg-red-50 rounded-full mx-auto flex items-center justify-center mb-6 text-[#123524]"><ShieldAlert className="w-8 h-8" /></div>
      <h2 className="text-xl font-bold text-gray-800 mb-2">Staff Portal Login</h2>
      <p className="text-xs font-bold text-gray-500 mb-6">Secured by Firebase Auth</p>
      
      <form onSubmit={handleLogin} className="space-y-4">
        <div>
           <label className="block text-left text-xs font-bold text-gray-500 mb-1">Select Therapist</label>
           <div className="relative">
               <select required value={therapistId} onChange={e=>setTherapistId(e.target.value)} className="w-full p-3 bg-gray-50 border border-gray-200 rounded-lg outline-none focus:border-[#D4AF37] font-bold text-center tracking-wider appearance-none cursor-pointer text-gray-800">
                   <option value="" disabled>-- Select Your Profile --</option>
                   {therapists.map(t => (<option key={t.id} value={t.id}>{t.name}</option>))}
               </select>
               <div className="absolute inset-y-0 right-0 flex items-center px-4 pointer-events-none text-gray-400"><ChevronDown className="w-4 h-4" /></div>
           </div>
        </div>
        <div>
           <label className="block text-left text-xs font-bold text-gray-500 mb-1">Password</label>
           <input required type="password" placeholder="Password" value={password} onChange={e=>setPassword(e.target.value)} className="w-full p-3 bg-gray-50 border border-gray-200 rounded-lg outline-none focus:border-[#D4AF37] font-bold text-center tracking-wider" />
        </div>
        {error && <div className="text-xs font-bold text-red-500">{error}</div>}
        <button type="submit" disabled={loading} className="w-full py-3 bg-[#123524] text-white rounded-lg font-bold shadow-md hover:bg-green-900 transition flex items-center justify-center"><KeyRound className="w-4 h-4 mr-2"/> {loading ? 'Logging in...' : 'Verify and Login'}</button>
      </form>
    </div>
  );
}

function StaffSessionManager({ appData, loggedInStaff, onLogout }: { appData: AppData, loggedInStaff: TherapistProfile, onLogout: () => void }) {
   const [activeSession, setActiveSession] = useState<Booking | null>(null);
   const [showClockInFlow, setShowClockInFlow] = useState(false);
   const [loading, setLoading] = useState(true);
   const [staffTab, setStaffTab] = useState<'service' | 'history' | 'outpass' | 'performance'>('service');

   useEffect(() => {
       const q = query(collection(db, 'bookings'), where('therapist', '==', loggedInStaff.name));
       const unsubscribe = onSnapshot(q, (snap) => {
           let foundActive = null;
           snap.forEach((doc) => {
               const raw = doc.data();
               const b = { 
                   id: doc.id, 
                   ...raw,
                   name: decryptText(raw.name) || raw.name,
                   phone: decryptText(raw.phone) || raw.phone,
                   txId: decryptText(raw.txId) || raw.txId,
                   specialRequest: decryptText(raw.specialRequest) || raw.specialRequest
               } as Booking;
               
               if (b.status === 'in_progress') {
                   foundActive = b;
               }
           });
           setActiveSession(foundActive);
           setLoading(false);
       });
       return () => unsubscribe();
   }, [loggedInStaff.name]);

   const handleStopSession = async () => {
       if (!activeSession || !activeSession.id) return;
       if (!window.confirm("Are you sure you want to STOP this service now?")) return;
       try {
           const now = Date.now();
           const overtimeMillis = Math.max(0, now - (activeSession.expectedEndTimeMillis || now));
           await updateDoc(doc(db, 'bookings', activeSession.id), {
               status: 'completed',
               actualEndTimeMillis: now,
               overtimeSeconds: Math.floor(overtimeMillis / 1000)
           });
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
               <button onClick={() => setStaffTab('performance')} className={`flex-1 py-2 text-[10px] sm:text-xs font-bold rounded-lg transition ${staffTab === 'performance' ? 'bg-gradient-to-r from-[#123524] to-[#1a4a32] shadow text-[#D4AF37]' : 'text-gray-500 hover:bg-gray-100'}`}><Sparkles className="w-3 h-3 inline mb-0.5 mr-1"/>Matrix</button>
           </div>

           {staffTab === 'history' && <StaffDailyHistoryTab loggedInStaff={loggedInStaff} />}
           {staffTab === 'outpass' && <StaffOutPassTab appData={appData} loggedInStaff={loggedInStaff} />}
           {staffTab === 'performance' && <StaffPerformanceTab loggedInStaff={loggedInStaff} />}
           
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

function StaffDailyHistoryTab({ loggedInStaff }: { loggedInStaff: TherapistProfile }) {
   const [history, setHistory] = useState<Booking[]>([]);
   const [loading, setLoading] = useState(true);
   const todayStr = getLocalTodayStr();

   useEffect(() => {
       const q = query(collection(db, 'bookings'), where('therapist', '==', loggedInStaff.name));
       const unsub = onSnapshot(q, (snap) => {
           const arr: Booking[] = [];
           snap.forEach(doc => {
               const raw = doc.data();
               const b = { 
                   id: doc.id, 
                   ...raw,
                   name: decryptText(raw.name) || raw.name,
                   phone: decryptText(raw.phone) || raw.phone,
                   txId: decryptText(raw.txId) || raw.txId,
                   specialRequest: decryptText(raw.specialRequest) || raw.specialRequest
               } as Booking;

               if (b.date === todayStr && (b.status === 'completed' || b.status === 'cancelled')) {
                   arr.push(b);
               }
           });
           arr.sort((a,b) => (b.actualEndTimeMillis || 0) - (a.actualEndTimeMillis || 0));
           setHistory(arr);
           setLoading(false);
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

function StaffOutPassTab({ appData, loggedInStaff }: { appData: AppData, loggedInStaff: TherapistProfile }) {
   const [allOutpasses, setAllOutpasses] = useState<OutPass[]>([]);
   const [loading, setLoading] = useState(true);
   const [reason, setReason] = useState('');
   const [locating, setLocating] = useState(false);
   const [locError, setLocError] = useState('');
   const todayStr = getLocalTodayStr();

   useEffect(() => {
       const q = query(collection(db, 'outpasses'), where('date', '==', todayStr));
       const unsub = onSnapshot(q, snap => {
           const arr: OutPass[] = [];
           snap.forEach(d => {
               arr.push({ id: d.id, ...d.data() } as OutPass);
           });
           arr.sort((a,b) => b.outTimeMillis - a.outTimeMillis);
           setAllOutpasses(arr);
           setLoading(false);
       });
       return () => unsub();
   }, [todayStr]);

   const myPasses = allOutpasses.filter(o => o.therapist === loggedInStaff.name);
   const activePasses = allOutpasses.filter(o => o.status === 'out');
   const myActivePass = myPasses.find(o => o.status === 'out');

   const handleGoOut = async () => {
       if (activePasses.length >= 2) return;
       if (myPasses.length >= 4) return;
       if (!reason.trim()) { setLocError("အကြောင်းပြချက် (Reason) ရေးပေးပါ။"); return; }
       if (!appData.branding.shopLat || !appData.branding.shopLng) {
           setLocError("Admin Panel -> Settings တွင် ဆိုင်၏ Location အရင်သတ်မှတ်ပါ။");
           return;
       }
       
       setLocating(true); setLocError('');
       if (!navigator.geolocation) {
           setLocError("ဖုန်းတွင် Location Service မရနိုင်ပါ။");
           setLocating(false); return;
       }

       navigator.geolocation.getCurrentPosition(async (pos) => {
           const dist = calculateDistanceInMeters(pos.coords.latitude, pos.coords.longitude, appData.branding.shopLat!, appData.branding.shopLng!);
           
           if (dist > 50) { 
               setLocError(`ဆိုင်နှင့် အကွာအဝေး ${Math.round(dist)} မီတာ ရှိနေပါသည်။ (၅၀ မီတာအတွင်းသာ နှိပ်ခွင့်ရှိသည်)`);
               setLocating(false); return; 
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
           setReason(''); setLocating(false);
       }, (err) => {
           setLocError("Location (GPS) ဖွင့်ပေးရန် လိုအပ်ပါသည်။"); setLocating(false);
       }, { enableHighAccuracy: true });
   };

   const handleReturn = async () => {
       if (!myActivePass || !myActivePass.id) return;
       if (!appData.branding.shopLat || !appData.branding.shopLng) {
           setLocError("Admin Panel -> Settings တွင် ဆိုင်၏ Location အရင်သတ်မှတ်ပါ။"); return;
       }

       setLocating(true); setLocError('');
       navigator.geolocation.getCurrentPosition(async (pos) => {
           const dist = calculateDistanceInMeters(pos.coords.latitude, pos.coords.longitude, appData.branding.shopLat!, appData.branding.shopLng!);
           
           if (dist > 50) { 
               setLocError(`ဆိုင်နှင့် အကွာအဝေး ${Math.round(dist)} မီတာ ရှိနေပါသည်။ (၅၀ မီတာအတွင်းသာ နှိပ်ခွင့်ရှိသည်)`);
               setLocating(false); return; 
           }

           const now = Date.now();
           const overtimeMillis = Math.max(0, now - myActivePass.expectedInTimeMillis);
           await updateDoc(doc(db, 'outpasses', myActivePass.id), {
               status: 'returned',
               inTimeMillis: now,
               overtimeSeconds: Math.floor(overtimeMillis / 1000)
           });
           setLocating(false);
       }, (err) => {
           setLocError("Location (GPS) ဖွင့်ပေးရန် လိုအပ်ပါသည်။"); setLocating(false);
       }, { enableHighAccuracy: true });
   };

   if (loading) return <div className="text-center py-10 text-xs font-bold text-gray-400">Loading...</div>;

   if (myActivePass) {
       return <OutPassActiveDisplay pass={myActivePass} onReturn={handleReturn} locating={locating} locError={locError} />;
   }

   const canGoOut = myPasses.length < 4 && activePasses.length < 2;

   return (
       <div className="bg-white py-6 sm:p-8 rounded-2xl text-center animate-fade-in mt-4">
           <div className="w-16 h-16 sm:w-20 sm:h-20 bg-purple-50 rounded-full mx-auto flex items-center justify-center mb-4 sm:mb-6 text-purple-600 border border-purple-100"><Coffee className="w-8 h-8 sm:w-10 sm:h-10" /></div>
           <h3 className="text-lg sm:text-xl font-bold text-gray-800 mb-2">Personal Out Pass</h3>
           <p className="text-xs text-gray-500 mb-6">တစ်ရက်လျှင် အများဆုံး ၄ ကြိမ် (၁ ကြိမ်လျှင် မိနစ် ၃၀) ထွက်ခွင့်ရှိပါသည်။<br/><span className="mt-2 inline-block bg-gray-100 px-3 py-1 rounded-full">ယနေ့ထွက်ပြီးသားအကြိမ်ရေ: <strong>{myPasses.length} / 4</strong></span></p>

           {!canGoOut && myPasses.length >= 4 && (<div className="bg-red-50 text-red-600 p-4 rounded-xl font-bold border border-red-100 text-[11px] sm:text-xs mb-6">ဒီနေ့အတွက် သင်၏ အပြင်ထွက်ခွင့် (၄ ကြိမ်) ပြည့်သွားပါပြီ။</div>)}
           {!canGoOut && myPasses.length < 4 && activePasses.length >= 2 && (<div className="bg-orange-50 text-orange-700 p-4 rounded-xl font-bold border border-orange-100 text-[11px] sm:text-xs mb-6 leading-relaxed">လက်ရှိတွင် ဝန်ထမ်း ၂ ယောက်<br/>({activePasses.map(p => p.therapist).join(', ')})<br/>အပြင်ထွက်နေပါသည်။ ၎င်းတို့ပြန်လာမှသာ ထွက်ခွင့်ရပါမည်။</div>)}

           {canGoOut && (
               <div className="mb-4 text-left max-w-xs mx-auto">
                   <label className="block text-xs font-bold text-gray-500 mb-1">အကြောင်းပြချက် (Reason)</label>
                   <input type="text" placeholder="ဥပမာ - စျေးဝယ်၊ မုန့်ဝယ်" value={reason} onChange={e=>setReason(e.target.value)} className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-lg outline-none focus:border-purple-400 text-xs" />
               </div>
           )}

           {locError && <div className="text-xs font-bold text-red-500 mb-4">{locError}</div>}

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

           {locError && <div className="text-xs font-bold text-red-500 mb-4">{locError}</div>}

           <button disabled={locating} onClick={onReturn} className="w-full sm:w-auto sm:px-16 py-4 bg-[#123524] text-[#D4AF37] rounded-xl font-bold shadow-lg flex items-center justify-center hover:bg-[#1a4a32] transition border border-[#1a4a32] mx-auto text-sm disabled:opacity-50"><CheckCircle className="w-4 h-4 sm:w-5 sm:h-5 mr-2"/> {locating ? 'Checking Location...' : 'Clock In (Return)'}</button>
       </div>
   );
}

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
                   <StatusBadge status={session.status} />
                   <h3 className="text-lg sm:text-xl font-bold text-gray-800 mt-3">{(session.service || '').split('(')[0]}</h3>
                   <div className="text-[10px] sm:text-xs text-gray-500 mt-1 flex items-center"><Calendar className="w-3 h-3 mr-1"/> {session.date} &nbsp; <Clock className="w-3 h-3 mx-1"/> Slot: {session.time}</div>
                   <div className="text-[10px] sm:text-xs font-bold mt-2 bg-yellow-50 px-2 py-1 rounded inline-block" style={{ color: THEME.gold }}>Customer: {session.name}</div>
               </div>
               <div className="text-left sm:text-right w-full sm:w-auto pt-4 sm:pt-0 border-t sm:border-0 border-gray-100">
                   {remainingTime !== null && remainingTime > 0 ? (
                       <>
                           <div className="text-[10px] sm:text-xs font-bold text-gray-400 uppercase">REMAINING TIME</div>
                           <div className="text-4xl sm:text-5xl font-mono font-bold text-gray-800 tracking-tighter">{formatSecondsMMSS(remainingTime)}</div>
                           <div className="text-[10px] sm:text-xs font-bold text-gray-500 mt-0.5">Total Service: {(session.service || '').split('(')[1]?.replace(')', '') || '-'}</div>
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

function StaffPefunction StaffPerformanceTab({ loggedInStaff }: { loggedInStaff: TherapistProfile }) {
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
    if (!matrixData || !matrixData.topPerformers) return <div className="text-center py-20 text-gray-400 font-bold text-xs bg-gray-50 rounded-xl border border-dashed border-gray-200 mt-4">No Matrix Data available. Admin needs to upload the Excel file.</div>;

    const extractNumber = (str: string) => {
        const match = String(str).match(/\d+/);
        return match ? parseInt(match[0], 10) : null;
    };
    
    const staffNum = extractNumber(loggedInStaff.id) || extractNumber(loggedInStaff.name);
    const staffIdExact = String(loggedInStaff.id).trim().toLowerCase(); 
    const staffNameExact = String(loggedInStaff.name).trim().toLowerCase(); 

    const mySummary = (matrixData.monthlySummary || []).find((d: any) => extractNumber(d['Staff No']) === staffNum);
    const sortedPerformers = [...matrixData.topPerformers].filter(p => p['1 to 31 Actual'] > 0).sort((a, b) => b['1 to 31 Actual'] - a['1 to 31 Actual']);
    const maxActual = sortedPerformers.length > 0 ? sortedPerformers[0]['1 to 31 Actual'] : 1;

    const parseExcelDate = (val: any) => {
        if (!val) return '';
        if (typeof val === 'number') {
            const d = new Date((val - (25567 + 2)) * 86400 * 1000);
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

    const myEntries = allEntries.filter((e: any) => {
        return e.CleanStaffId === staffIdExact || 
               e.CleanStaffName === staffNameExact ||
               extractNumber(e['Staff ID']) === staffNum;
    });

    const allDates = Array.from(new Set(allEntries.map((e: any) => e.ParsedDate))).filter(Boolean).sort();
    
    if (allDates.length === 0) {
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

    let cumActualPrior = 0;

    const dailyBreakdown = allDates.map((d: any, idx: number) => {
        const dayRecords = myEntries.filter((e: any) => e.ParsedDate === d);
        const dayActual = dayRecords.reduce((sum: number, r: any) => sum + (Number(r['Sales Amount']) || 0), 0);
        
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
            dailyVariance,
            cumTarget: runningCumTarget,
            cumActual,
            remainingMonthlyTarget
        };
    });

    return (
        <div className="animate-fade-in mt-4">
            <div className="flex space-x-2 mb-6 bg-gray-100 p-1.5 rounded-xl">
                <button onClick={() => setSubTab('leaderboard')} className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${subTab === 'leaderboard' ? 'bg-white shadow text-[#123524]' : 'text-gray-500'}`}><Trophy className="w-3.5 h-3.5 inline mr-1.5"/> Leaderboard</button>
                <button onClick={() => setSubTab('my_stats')} className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${subTab === 'my_stats' ? 'bg-white shadow text-[#123524]' : 'text-gray-500'}`}><TrendingUp className="w-3.5 h-3.5 inline mr-1.5"/> My Stats</button>
            </div>

            {subTab === 'leaderboard' && (
                <div className="space-y-6">
                    <div className="text-center mb-6">
                        <h3 className="text-lg font-bold text-[#123524] font-serif">Top Performers of the Month</h3>
                        <p className="text-[10px] text-gray-500 uppercase tracking-widest mt-1">Shangri-La Hall of Fame</p>
                    </div>

                    <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 mb-8 overflow-x-auto">
                        <div className="flex items-end space-x-3 h-48 pb-2 pt-6 min-w-max border-b border-gray-100">
                            {sortedPerformers.map((p, idx) => {
                                const heightPercent = Math.max(5, (p['1 to 31 Actual'] / maxActual) * 100);
                                const isMe = extractNumber(p['Staff ID']) === staffNum;
                                return (
                                    <div key={idx} className="flex flex-col items-center group w-12">
                                        <div className="text-[9px] font-bold text-gray-500 mb-1 opacity-0 group-hover:opacity-100 transition-opacity -rotate-45 mb-4">{formatPrice(p['1 to 31 Actual'])}</div>
                                        <div className={`w-8 rounded-t-md relative transition-all duration-1000 ease-out shadow-sm ${isMe ? 'bg-gradient-to-t from-[#D4AF37] to-yellow-300' : (idx === 0 ? 'bg-gradient-to-t from-[#123524] to-[#1a4a32]' : 'bg-gray-200 hover:bg-gray-300')}`} style={{ height: `${heightPercent}%` }}>
                                            {idx === 0 && <Crown className="w-5 h-5 text-[#D4AF37] absolute -top-6 -left-1.5" />}
                                        </div>
                                        <span className={`text-[10px] font-bold mt-2 ${isMe ? 'text-[#D4AF37]' : 'text-gray-600'}`}>{p['Staff ID']}</span>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    <div className="space-y-3">
                        {sortedPerformers.slice(0, 10).map((p, idx) => {
                            const isMe = extractNumber(p['Staff ID']) === staffNum;
                            let badgeClass = "bg-gray-100 text-gray-600";
                            if (idx === 0) badgeClass = "bg-yellow-100 text-yellow-700 border border-yellow-300";
                            else if (idx === 1) badgeClass = "bg-gray-200 text-gray-700 border border-gray-400";
                            else if (idx === 2) badgeClass = "bg-orange-100 text-orange-700 border border-orange-300";

                            return (
                                <div key={idx} className={`flex items-center p-4 rounded-xl border transition-all ${isMe ? 'bg-yellow-50/50 border-[#D4AF37] shadow-md scale-[1.02]' : 'bg-white border-gray-100 shadow-sm'}`}>
                                    <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs mr-4 ${badgeClass}`}>
                                        {idx === 0 ? <Trophy className="w-4 h-4"/> : `#${idx + 1}`}
                                    </div>
                                    <div className="flex-1">
                                        <div className="font-bold text-gray-800 text-sm flex items-center">{p['Staff ID']} {isMe && <span className="ml-2 text-[9px] bg-[#123524] text-[#D4AF37] px-2 py-0.5 rounded uppercase tracking-wider">YOU</span>}</div>
                                        <div className="text-[10px] text-gray-500 font-semibold mt-0.5">Target: {formatPrice(p['1 to 30 Target'])}</div>
                                    </div>
                                    <div className="text-right">
                                        <div className="font-black text-[#123524]">{formatPrice(p['1 to 31 Actual'])}</div>
                                        <div className={`text-[9px] font-bold mt-0.5 ${p['Meet %'] >= 0.5 ? 'text-green-500' : 'text-orange-500'}`}>
                                            Met {(p['Meet %'] * 100).toFixed(1)}%
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
                        <div className="text-center py-10 text-gray-400 text-xs font-bold border-2 border-dashed border-gray-200 rounded-xl">Your data is not found in the uploaded Matrix.</div>
                    ) : (
                        <>
                            {/* Monthly Target Donut Card */}
                            <div className="bg-gradient-to-br from-[#123524] to-[#1a4a32] p-6 rounded-2xl shadow-lg relative overflow-hidden flex flex-col items-center">
                                <div className="absolute top-0 right-0 w-32 h-32 bg-[#D4AF37] opacity-10 rounded-full -mr-10 -mt-10 blur-2xl"></div>
                                <h3 className="text-[#D4AF37] font-bold text-sm tracking-widest uppercase mb-6 flex items-center"><Target className="w-4 h-4 mr-2"/> Monthly Target</h3>
                                
                                <div className="relative w-32 h-32 flex items-center justify-center bg-black/20 rounded-full border-4 border-white/5 shadow-inner">
                                    <div className="text-center">
                                        <div className="text-2xl font-black text-white">{mySummary['Total Actual Sales'] > 0 ? Math.round((mySummary['Total Actual Sales'] / monthlyTotalTarget) * 100) : 0}%</div>
                                        <div className="text-[8px] text-[#D4AF37] font-bold uppercase tracking-wider mt-1">Achieved</div>
                                    </div>
                                    <svg className="absolute inset-0 w-full h-full transform -rotate-90">
                                        <circle cx="64" cy="64" r="58" stroke="currentColor" strokeWidth="6" fill="transparent" className="text-white/10" />
                                        <circle cx="64" cy="64" r="58" stroke="currentColor" strokeWidth="6" fill="transparent" className="text-[#D4AF37]" strokeDasharray="364" strokeDashoffset={364 - (364 * (mySummary['Total Actual Sales'] / monthlyTotalTarget))} strokeLinecap="round" style={{ transition: 'stroke-dashoffset 1s ease-out' }} />
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

                            {/* Financial Summary */}
                            <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100">
                                <h3 className="font-bold text-gray-800 text-sm mb-4 flex items-center"><Award className="w-4 h-4 mr-2 text-yellow-600"/> Financial Summary</h3>
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

                            {/* Dynamic Adjusted Daily Target Tracker */}
                            <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100">
                                <h3 className="font-bold text-[#123524] text-sm mb-4 flex items-center justify-between">
                                    <span className="flex items-center"><Calendar className="w-4 h-4 mr-2 text-[#D4AF37]"/> Dynamic Daily Target Tracker</span>
                                </h3>
                                <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1">
                                    {dailyBreakdown.map((item, idx) => (
                                        <div key={idx} className={`p-4 rounded-xl border transition-all ${item.hasSales ? 'bg-white border-gray-200 shadow-sm' : 'bg-gray-50/70 border-dashed border-gray-200'}`}>
                                            <div className="flex justify-between items-center mb-2">
                                                <div className="flex items-center space-x-2">
                                                    <span className="bg-[#123524] text-[#D4AF37] text-[10px] font-bold px-2 py-0.5 rounded">Day {item.dayNo}</span>
                                                    <span className="text-xs font-mono font-bold text-gray-700">{item.date}</span>
                                                </div>
                                                <div>
                                                    {item.hasSales ? (
                                                        <span className="bg-green-100 text-green-700 text-[9px] font-bold px-2 py-0.5 rounded uppercase tracking-wider">Active Sale</span>
                                                    ) : (
                                                        <span className="bg-gray-200 text-gray-600 text-[9px] font-bold px-2 py-0.5 rounded uppercase tracking-wider">No Sales</span>
                                                    )}
                                                </div>
                                            </div>

                                            {item.hasSales ? (
                                                <div className="space-y-1 my-2 bg-gray-50 p-2.5 rounded-lg border border-gray-100">
                                                    {item.services.map((s: any, sIdx: number) => (
                                                        <div key={sIdx} className="flex justify-between text-xs font-semibold text-gray-800">
                                                            <span>• {s['Service Name']}</span>
                                                            <span className="font-bold text-[#123524]">{formatPrice(s['Sales Amount'])}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            ) : (
                                                <div className="my-2 py-2 text-center text-xs text-gray-400 font-bold italic bg-gray-100/50 rounded-lg">
                                                    No Sales / Section ဝင်ထားခြင်း မရှိပါ
                                                </div>
                                            )}

                                            <div className="grid grid-cols-2 gap-2 mt-3 pt-3 border-t border-gray-100 text-[11px]">
                                                {/* 🌟 နံပါတ် ၁ နေရာ (ဘယ်ဘက်) 🌟 */}
                                                <div>
                                                    <span className="text-gray-400 font-semibold text-[10px] block">Daily Actual vs Daily Target</span>
                                                    <span className={`font-black ${item.dayActual >= item.dailyTarget ? 'text-green-600' : 'text-orange-600'}`}>
                                                        {formatPrice(item.dayActual)} <span className="text-[9px] font-bold text-gray-400">({item.dayActual >= item.dailyTarget ? 'Met' : `${formatPrice(item.dailyVariance)}`})</span>
                                                    </span>
                                                    <span className="text-[#123524] font-bold text-[9px] block mt-1.5">
                                                        Total Actual: {formatPrice(item.cumActual)}
                                                    </span>
                                                </div>
                                                
                                                {/* 🌟 နံပါတ် ၂ နေရာ (ညာဘက်) 🌟 */}
                                                <div className="text-right">
                                                    <span className="text-gray-400 font-semibold text-[10px] block">Remaining Monthly Target</span>
                                                    <span className="font-bold text-red-500">
                                                        {formatPrice(item.remainingMonthlyTarget)}
                                                    </span>
                                                    <span className="text-[9px] text-gray-500 block mt-1.5">
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
