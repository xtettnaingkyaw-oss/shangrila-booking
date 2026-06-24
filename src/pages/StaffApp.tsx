import React, { useState, useEffect } from 'react';
import { collection, query, onSnapshot, doc, updateDoc, addDoc } from 'firebase/firestore';
import { db } from '../firebase';

// Vercel တွင် App Crash မဖြစ်စေရန် လိုအပ်သော Icon များအားလုံးကို အပြည့်အစုံ ထည့်သွင်းထားပါသည်
import { Calendar, Clock, CreditCard, CheckCircle, Trash2, User, Phone, ShieldCheck, Activity, Copy, ChevronRight, ChevronLeft, Check, Sparkles, Droplets, Scissors, Home, ChevronDown, ChevronUp, Crown, Save, PlusCircle, Settings, UploadCloud, X, ImageIcon, MapPin, Search, LogOut, KeyRound, AlertCircle, History, UserCircle, CalendarPlus, Edit, ShieldAlert, Lock, BarChart2, Coffee, Percent, Download, Play, StopCircle, UserCheck } from 'lucide-react';

import { THEME, AppData, Booking, OutPass, TherapistProfile } from '../shared';
import { CustomerBookingWizard } from './CustomerApp';

// ==========================================
// LOCAL HELPERS
// ==========================================
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

export function StatusBadge({ status, cancelReason }: { status: string, cancelReason?: string }) {
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

// ==========================================
// STAFF APP COMPONENTS
// ==========================================
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

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const staff = therapists.find(t => t.id === therapistId);
    if (staff && staff.password === password) {
       onLoginSuccess(staff);
    } else {
       setError('Invalid Therapist Selection or Password.');
    }
  };

  return (
    <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100 max-w-sm mx-auto text-center mt-10 animate-fade-in">
      <div className="w-16 h-16 bg-red-50 rounded-full mx-auto flex items-center justify-center mb-6 text-[#123524]"><ShieldAlert className="w-8 h-8" /></div>
      <h2 className="text-xl font-bold text-gray-800 mb-2">Staff Portal Login</h2>
      <p className="text-xs font-bold text-gray-500 mb-6">Secure Access Only</p>
      
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
        <button type="submit" className="w-full py-3 bg-[#123524] text-white rounded-lg font-bold shadow-md hover:bg-green-900 transition flex items-center justify-center"><KeyRound className="w-4 h-4 mr-2"/> Verify and Login</button>
      </form>
    </div>
  );
}

function StaffSessionManager({ appData, loggedInStaff, onLogout }: { appData: AppData, loggedInStaff: TherapistProfile, onLogout: () => void }) {
   const [myBookings, setMyBookings] = useState<Booking[]>([]);
   const [myOutpasses, setMyOutpasses] = useState<OutPass[]>([]);
   const [loading, setLoading] = useState(false);
   const [showWalkinModal, setShowWalkinModal] = useState(false);
   
   const [reason, setReason] = useState('');
   const [locating, setLocating] = useState(false);
   const [locError, setLocError] = useState('');
   
   const todayStr = getLocalTodayStr();

   useEffect(() => {
       const bq = query(collection(db, 'bookings'));
       const unsubB = onSnapshot(bq, snap => {
           const arr: Booking[] = [];
           snap.forEach(d => {
               const b = {id: d.id, ...d.data()} as Booking;
               if (b.therapist === loggedInStaff.name) arr.push(b);
           });
           arr.sort((a,b) => (b.createdAt || 0) - (a.createdAt || 0));
           setMyBookings(arr);
       });

       const oq = query(collection(db, 'outpasses'));
       const unsubO = onSnapshot(oq, snap => {
           const arr: OutPass[] = [];
           snap.forEach(d => {
               const o = {id: d.id, ...d.data()} as OutPass;
               if (o.therapist === loggedInStaff.name) arr.push(o);
           });
           arr.sort((a,b) => (b.outTimeMillis || 0) - (a.outTimeMillis || 0));
           setMyOutpasses(arr);
       });

       return () => { unsubB(); unsubO(); };
   }, [loggedInStaff.name]);

   const activeBooking = myBookings.find(b => b.status === 'in_progress');
   const activeOutpass = myOutpasses.find(o => o.status === 'out');

   const checkLocation = async () => {
       if (!appData.branding.shopLat || !appData.branding.shopLng) {
           alert("Admin မှ ဆိုင်၏ GPS Location သတ်မှတ်မထားပါ။ ဆက်လက်လုပ်ဆောင်ပါမည်။");
           return true; 
       }
       return new Promise<boolean>((resolve) => {
           navigator.geolocation.getCurrentPosition(
               (pos) => {
                   const dist = calculateDistanceInMeters(pos.coords.latitude, pos.coords.longitude, appData.branding.shopLat!, appData.branding.shopLng!);
                   // ၅၀ မီတာ အတိအကျ သတ်မှတ်ပေးထားပါသည်
                   if (dist <= 50) { resolve(true); } 
                   else {
                       alert(`သင်သည် ဆိုင်၏ ဧရိယာ (၅၀ မီတာ) အတွင်းမရှိပါ။ သင်၏အကွာအဝေး: ${Math.round(dist)} မီတာ။ ကျေးဇူးပြု၍ ဆိုင်သို့ရောက်မှ ပြန်နှိပ်ပါ။`);
                       resolve(false);
                   }
               },
               (err) => {
                   alert("Location ဖွင့်ထားရန် လိုအပ်ပါသည်။ (Please enable GPS/Location to verify you are at the shop)");
                   resolve(false);
               },
               { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
           );
       });
   };

   const handleFinishService = async () => {
       if (!activeBooking) return;
       const isAtShop = await checkLocation();
       if (!isAtShop) return;

       if (!window.confirm("ဝန်ဆောင်မှု ပြီးဆုံးကြောင်း အတည်ပြုပါသလား? (Finish Service?)")) return;
       setLoading(true);
       try {
           const actualEnd = Date.now();
           let overtime = 0;
           if (activeBooking.expectedEndTimeMillis && actualEnd > activeBooking.expectedEndTimeMillis) {
               overtime = Math.floor((actualEnd - activeBooking.expectedEndTimeMillis) / 1000); 
           }
           await updateDoc(doc(db, 'bookings', activeBooking.id!), {
               status: 'completed',
               actualEndTimeMillis: actualEnd,
               overtimeSeconds: overtime
           });
           alert("Service Completed!");
       } catch (e) { alert("Error"); }
       setLoading(false);
   };

   const handleOutPassSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
       e.preventDefault();
       
       const formData = new FormData(e.currentTarget);
       const hours = parseInt(formData.get('hours') as string) || 0;
       const mins = parseInt(formData.get('mins') as string) || 0;
       const reasonInput = formData.get('reason') as string;

       if (hours === 0 && mins === 0) { alert("အချိန်သတ်မှတ်ပေးပါ။"); return; }
       if (!window.confirm("အပြင်ထွက်ခွင့် (Out Pass) တောင်းဆိုရန် သေချာပါသလား?")) return;

       const isAtShop = await checkLocation();
       if (!isAtShop) return;

       setLoading(true);
       try {
           const outTime = Date.now();
           const expectedIn = outTime + ((hours * 60 + mins) * 60000);
           await addDoc(collection(db, 'outpasses'), {
               therapist: loggedInStaff.name,
               date: getLocalTodayStr(),
               outTimeMillis: outTime,
               expectedInTimeMillis: expectedIn,
               reason: reasonInput,
               status: 'out',
               createdAt: outTime
           });
           alert("Out Pass အောင်မြင်ပါသည်။ သတ်မှတ်ချိန်အတွင်း ဆိုင်သို့ ပြန်ရောက်ရန် ဂရုပြုပါ။");
       } catch (error) { alert("Error"); }
       setLoading(false);
   };

   const handleReturnFromOutPass = async () => {
       if (!activeOutpass) return;
       const isAtShop = await checkLocation();
       if (!isAtShop) return;

       if (!window.confirm("ဆိုင်သို့ ပြန်လည်ရောက်ရှိကြောင်း အတည်ပြုပါသလား?")) return;
       setLoading(true);
       try {
           const inTime = Date.now();
           let overtime = 0;
           if (activeOutpass.expectedInTimeMillis && inTime > activeOutpass.expectedInTimeMillis) {
               overtime = Math.floor((inTime - activeOutpass.expectedInTimeMillis) / 1000);
           }
           await updateDoc(doc(db, 'outpasses', activeOutpass.id!), {
               status: 'returned',
               inTimeMillis: inTime,
               overtimeSeconds: overtime
           });
           alert("Welcome back!");
       } catch (e) { alert("Error"); }
       setLoading(false);
   };

   if (showWalkinModal) {
      return (
         <div className="animate-fade-in pb-10">
            <div className="flex justify-between items-center mb-6 bg-white p-4 rounded-xl shadow-sm border border-gray-100">
               <h3 className="font-bold text-lg text-[#123524]">Start Walk-in Service</h3>
               <button onClick={() => setShowWalkinModal(false)} className="text-gray-500 bg-gray-100 px-4 py-2 rounded-lg font-bold text-xs hover:bg-gray-200">Cancel</button>
            </div>
            <CustomerBookingWizard 
               appData={appData} 
               isStaffMode={true} 
               staffClockIn={true} 
               preselectedStaff={loggedInStaff.name}
               staffClockInSuccess={() => { setShowWalkinModal(false); }} 
            />
         </div>
      );
   }

   const formatMillis = (millis: number | undefined) => {
       if (!millis) return '-'; const date = new Date(millis); return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
   };

   return (
       <div className="animate-fade-in pb-20">
           {/* Header */}
           <div className="flex justify-between items-center bg-white p-4 rounded-xl shadow-sm border border-gray-200 mb-6 mt-4">
               <div className="flex items-center">
                   <div className="w-12 h-12 rounded-full overflow-hidden mr-3 bg-gray-100 border border-gray-200 flex-shrink-0">
                       {loggedInStaff.images && loggedInStaff.images[0] ? <img src={loggedInStaff.images[0]} className="w-full h-full object-cover object-top" /> : <User className="w-full h-full p-2 text-gray-400" />}
                   </div>
                   <div>
                       <div className="font-bold text-gray-800">{loggedInStaff.name}</div>
                       <div className="text-[10px] text-gray-500">Staff Portal (ID: {loggedInStaff.id})</div>
                   </div>
               </div>
               <button onClick={onLogout} className="bg-red-50 text-red-600 px-3 py-1.5 rounded text-xs font-bold border border-red-100 flex items-center hover:bg-red-100"><LogOut className="w-3 h-3 mr-1" /> Exit</button>
           </div>

           {/* ORIGINAL UI ACTION CENTER */}
           <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden mb-6">
               <div className="bg-gray-50 p-4 border-b border-gray-200">
                   <h3 className="font-bold text-gray-800">Action Center</h3>
               </div>
               <div className="p-6">
                   {activeBooking ? (
                       <ActiveSessionDisplay session={activeBooking} onStop={handleFinishService} />
                   ) : activeOutpass ? (
                       <OutPassActiveDisplay pass={activeOutpass} onReturn={handleReturnFromOutPass} locating={locating} locError={locError} />
                   ) : (
                       <div className="grid md:grid-cols-2 gap-6 animate-fade-in">
                           {/* Left Card: Start Walk-in */}
                           <div className="border border-green-200 bg-green-50/50 rounded-xl p-5 flex flex-col justify-center items-center text-center hover:shadow-md transition cursor-pointer" onClick={() => setShowWalkinModal(true)}>
                               <div className="w-14 h-14 bg-green-100 text-green-600 rounded-full flex items-center justify-center mb-3 shadow-inner"><Play className="w-6 h-6 ml-1" /></div>
                               <h4 className="font-bold text-green-800 mb-1">Start Walk-in Service</h4>
                               <p className="text-[10px] text-green-600 font-semibold px-4 mb-4 leading-relaxed">ဧည့်သည် ဆိုင်သို့ရောက်ရှိလာပါက ဤနေရာမှ ဝင်ရောက်ပြီး Service ရွေးချယ်ကာ ချက်ချင်းစတင်နိုင်ပါသည်။</p>
                           </div>

                           {/* Right Card: Request Out Pass */}
                           <form onSubmit={handleOutPassSubmit} className="border border-purple-200 bg-purple-50/50 rounded-xl p-5 flex flex-col justify-between hover:shadow-md transition">
                               <div>
                                   <div className="flex items-center mb-3">
                                       <div className="w-8 h-8 bg-purple-100 text-purple-600 rounded-full flex items-center justify-center mr-2 shadow-inner"><Coffee className="w-4 h-4" /></div>
                                       <h4 className="font-bold text-purple-800">Request Out Pass</h4>
                                   </div>
                                   <div className="grid grid-cols-2 gap-2 mb-3">
                                       <div><label className="text-[10px] font-bold text-purple-600 mb-1 block">Hours</label><input type="number" name="hours" min="0" max="24" defaultValue="0" className="w-full p-2 text-sm border border-purple-200 rounded focus:outline-none focus:border-purple-400 bg-white" /></div>
                                       <div><label className="text-[10px] font-bold text-purple-600 mb-1 block">Minutes</label><input type="number" name="mins" min="0" max="59" defaultValue="30" className="w-full p-2 text-sm border border-purple-200 rounded focus:outline-none focus:border-purple-400 bg-white" /></div>
                                   </div>
                                   <input type="text" name="reason" placeholder="Reason (Optional)" className="w-full p-2 text-sm border border-purple-200 rounded focus:outline-none focus:border-purple-400 bg-white mb-4" />
                               </div>
                               <button type="submit" disabled={loading} className="w-full py-2.5 bg-purple-600 text-white font-bold rounded-lg shadow-sm hover:bg-purple-700 transition flex items-center justify-center text-sm">
                                   {loading ? 'Processing...' : 'Submit Out Pass'}
                               </button>
                           </form>
                       </div>
                   )}
               </div>
           </div>

           {/* ORIGINAL UI TODAY'S RECORDS */}
           <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
               <div className="bg-gray-50 p-4 border-b border-gray-200 flex justify-between items-center">
                   <h3 className="font-bold text-gray-800">My Today's Records</h3>
                   <span className="text-[10px] font-bold bg-[#123524] text-white px-2 py-1 rounded">{getLocalTodayStr()}</span>
               </div>
               
               <div className="p-4 space-y-4">
                  {/* Service Records */}
                  <div>
                      <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Service Log</h4>
                      {myBookings.filter(b => b.date === getLocalTodayStr() && b.status !== 'cancelled').length === 0 ? (
                          <div className="text-[10px] text-gray-400 bg-gray-50 p-3 rounded text-center border border-dashed">No services yet for today.</div>
                      ) : (
                          <div className="space-y-2">
                             {myBookings.filter(b => b.date === getLocalTodayStr() && b.status !== 'cancelled').map(b => (
                                 <div key={b.id} className="bg-white border border-gray-200 p-3 rounded-lg flex justify-between items-center hover:border-gray-300 transition">
                                     <div>
                                         <div className="font-bold text-sm text-[#123524]">{b.service.split('(')[0]}</div>
                                         <div className="text-[10px] text-gray-500 mt-1">Start: <span className="font-mono text-gray-700 font-bold">{formatMillis(b.startTimeMillis)}</span> | End: <span className="font-mono text-gray-700 font-bold">{b.status === 'in_progress' ? 'Running' : formatMillis(b.actualEndTimeMillis)}</span></div>
                                     </div>
                                     <div>
                                         {b.status === 'in_progress' ? <span className="bg-orange-100 text-orange-600 text-[9px] font-bold px-2 py-1 rounded animate-pulse">ACTIVE</span> : <span className="bg-gray-100 text-gray-600 text-[9px] font-bold px-2 py-1 rounded">DONE</span>}
                                     </div>
                                 </div>
                             ))}
                          </div>
                      )}
                  </div>

                  <hr className="border-gray-100"/>

                  {/* Outpass Records */}
                  <div>
                      <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Out Pass Log</h4>
                      {myOutpasses.filter(o => o.date === getLocalTodayStr()).length === 0 ? (
                          <div className="text-[10px] text-gray-400 bg-gray-50 p-3 rounded text-center border border-dashed">No out passes today.</div>
                      ) : (
                          <div className="space-y-2">
                             {myOutpasses.filter(o => o.date === getLocalTodayStr()).map(o => (
                                 <div key={o.id} className="bg-white border border-gray-200 p-3 rounded-lg flex justify-between items-center hover:border-gray-300 transition">
                                     <div>
                                         <div className="font-bold text-sm text-purple-800">{o.reason || 'Out Pass'}</div>
                                         <div className="text-[10px] text-gray-500 mt-1">Out: <span className="font-mono text-gray-700 font-bold">{formatMillis(o.outTimeMillis)}</span> | In: <span className="font-mono text-gray-700 font-bold">{o.status === 'out' ? 'Not yet' : formatMillis(o.inTimeMillis)}</span></div>
                                     </div>
                                     <div>
                                         {o.status === 'out' ? <span className="bg-purple-100 text-purple-600 text-[9px] font-bold px-2 py-1 rounded animate-pulse">OUT</span> : <span className="bg-gray-100 text-gray-600 text-[9px] font-bold px-2 py-1 rounded">RETURNED</span>}
                                     </div>
                                 </div>
                             ))}
                          </div>
                      )}
                  </div>
               </div>
           </div>
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

   const formatMillis = (millis: number | undefined) => {
       if (!millis) return '-'; const date = new Date(millis); return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
   };

   return (
       <div className="bg-white border border-orange-200 p-6 rounded-xl shadow-sm text-center mb-6 animate-fade-in">
          <h3 className="font-bold text-orange-600 text-lg mb-2">You are currently in a service</h3>
          <p className="text-gray-700 font-bold mb-4">{session.service}</p>
          <p className="text-xs text-gray-500 mb-6">Expected End Time: {formatMillis(session.expectedEndTimeMillis)}</p>
          
          {remainingTime !== null && remainingTime > 0 ? (
             <div className="text-3xl font-mono font-bold text-gray-800 tracking-tighter mb-6">{formatSecondsMMSS(remainingTime)}</div>
          ) : (
             <div className="text-3xl font-mono font-bold text-red-600 tracking-tighter mb-6 animate-pulse">+{formatSecondsMMSS(overtimeSecs)} (LATE)</div>
          )}

          <button onClick={onStop} className="bg-orange-600 text-white px-8 py-3 rounded-lg font-bold shadow-md hover:bg-orange-700 transition w-full">
              Finish Service (Check Out)
          </button>
          <p className="text-[10px] text-orange-500 mt-3 font-semibold">မှတ်ချက်: ဆိုင်ဧရိယာအတွင်းသို့ရောက်မှသာ Finish နှိပ်နိုင်ပါမည်။</p>
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

   const formatMillis = (millis: number | undefined) => {
       if (!millis) return '-'; const date = new Date(millis); return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
   };

   return (
       <div className="bg-white border border-purple-200 p-6 rounded-xl shadow-sm text-center mb-6 animate-fade-in">
          <h3 className="font-bold text-purple-600 text-lg mb-2">You are currently on Out Pass</h3>
          <p className="text-gray-700 font-bold mb-4">Reason: {pass.reason || '-'}</p>
          <p className="text-xs text-gray-500 mb-6">Must Return By: {formatMillis(pass.expectedInTimeMillis)}</p>

          {remainingTime !== null && remainingTime > 0 ? (
             <div className="text-3xl font-mono font-bold text-gray-800 tracking-tighter mb-6">{formatSecondsMMSS(remainingTime)}</div>
          ) : (
             <div className="text-3xl font-mono font-bold text-red-600 tracking-tighter mb-6 animate-pulse">+{formatSecondsMMSS(overtimeSecs)} (LATE)</div>
          )}

          {locError && <div className="text-xs font-bold text-red-500 mb-4">{locError}</div>}
          
          <button disabled={locating} onClick={onReturn} className="bg-purple-600 text-white px-8 py-3 rounded-lg font-bold shadow-md hover:bg-purple-700 transition w-full disabled:opacity-50 disabled:cursor-not-allowed">
              {locating ? 'Checking Location...' : 'Return to Shop (Check In)'}
          </button>
          <p className="text-[10px] text-purple-500 mt-3 font-semibold">မှတ်ချက်: ဆိုင်ဧရိယာအတွင်းသို့ရောက်မှသာ Return နှိပ်နိုင်ပါမည်။</p>
       </div>
   );
}
