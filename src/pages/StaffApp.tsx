import React, { useState, useEffect } from 'react';
import { collection, query, onSnapshot, doc, updateDoc, addDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { LogOut, User, Clock, CheckCircle, Activity, Coffee, Play, Sparkles, ChevronLeft } from 'lucide-react';
import { THEME, AppData, Booking, OutPass, TherapistProfile } from '../shared';
import { CustomerBookingWizard } from './CustomerApp';

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
      <div className="w-16 h-16 bg-gray-50 rounded-full mx-auto flex items-center justify-center mb-6 text-[#123524]"><User className="w-8 h-8" /></div>
      <h2 className="text-xl font-bold text-gray-800 mb-2">Staff Portal Login</h2>
      <p className="text-xs font-bold text-gray-500 mb-6">Secure Access Only</p>
      
      <form onSubmit={handleLogin} className="space-y-4">
        <div>
           <label className="block text-left text-xs font-bold text-gray-500 mb-1">Select Therapist</label>
           <select required value={therapistId} onChange={e=>setTherapistId(e.target.value)} className="w-full p-3 bg-gray-50 border border-gray-200 rounded-lg outline-none focus:border-[#D4AF37] font-bold text-center tracking-wider text-gray-800">
               <option value="" disabled>-- Select Your Profile --</option>
               {therapists.map(t => (<option key={t.id} value={t.id}>{t.name}</option>))}
           </select>
        </div>
        <div>
           <label className="block text-left text-xs font-bold text-gray-500 mb-1">Password</label>
           <input required type="password" placeholder="Password" value={password} onChange={e=>setPassword(e.target.value)} className="w-full p-3 bg-gray-50 border border-gray-200 rounded-lg outline-none focus:border-[#D4AF37] font-bold text-center tracking-wider" />
        </div>
        {error && <div className="text-xs font-bold text-red-500">{error}</div>}
        <button type="submit" className="w-full py-3 bg-[#123524] text-white rounded-lg font-bold shadow-md hover:bg-[#1a4a32] transition flex items-center justify-center">Verify and Login</button>
      </form>
    </div>
  );
}

function StaffSessionManager({ appData, loggedInStaff, onLogout }: { appData: AppData, loggedInStaff: TherapistProfile, onLogout: () => void }) {
   const [myBookings, setMyBookings] = useState<Booking[]>([]);
   const [myOutpasses, setMyOutpasses] = useState<OutPass[]>([]);
   const [loading, setLoading] = useState(false);
   const [showWalkinModal, setShowWalkinModal] = useState(false);
   const [staffTab, setStaffTab] = useState<'service' | 'history' | 'outpass'>('service');

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
       const isAtShop = await checkLocation();
       if (!isAtShop) return;

       const formData = new FormData(e.currentTarget);
       const hours = parseInt(formData.get('hours') as string) || 0;
       const mins = parseInt(formData.get('mins') as string) || 0;
       const reason = formData.get('reason') as string;

       if (hours === 0 && mins === 0) { alert("အချိန်သတ်မှတ်ပေးပါ။"); return; }
       if (!window.confirm("အပြင်ထွက်ခွင့် (Out Pass) တောင်းဆိုရန် သေချာပါသလား?")) return;

       setLoading(true);
       try {
           const outTime = Date.now();
           const expectedIn = outTime + ((hours * 60 + mins) * 60000);
           await addDoc(collection(db, 'outpasses'), {
               therapist: loggedInStaff.name,
               date: getLocalTodayStr(),
               outTimeMillis: outTime,
               expectedInTimeMillis: expectedIn,
               reason: reason,
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

   const formatMillis = (millis: number | undefined) => {
       if (!millis) return '-'; const date = new Date(millis); return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
   };

   return (
       <div className="animate-fade-in pb-20">
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

           <div className="flex space-x-1 sm:space-x-2 mb-6 bg-gray-50 p-1.5 rounded-xl border border-gray-100">
               <button onClick={() => setStaffTab('service')} className={`flex-1 py-2 text-[10px] sm:text-xs font-bold rounded-lg transition ${staffTab === 'service' ? 'bg-white shadow text-[#123524]' : 'text-gray-500 hover:bg-gray-100'}`}>Service</button>
               <button onClick={() => setStaffTab('history')} className={`flex-1 py-2 text-[10px] sm:text-xs font-bold rounded-lg transition ${staffTab === 'history' ? 'bg-white shadow text-[#123524]' : 'text-gray-500 hover:bg-gray-100'}`}>History</button>
               <button onClick={() => setStaffTab('outpass')} className={`flex-1 py-2 text-[10px] sm:text-xs font-bold rounded-lg transition ${staffTab === 'outpass' ? 'bg-white shadow text-[#123524]' : 'text-gray-500 hover:bg-gray-100'}`}>Out Pass</button>
           </div>

           {staffTab === 'history' && (
              <div className="animate-fade-in">
                 <h3 className="font-bold text-gray-800 mb-4 text-sm">Today's Completed Services</h3>
                 {myBookings.filter(b => b.date === getLocalTodayStr() && (b.status === 'completed' || b.status === 'cancelled')).map(b => (
                     <div key={b.id} className="p-4 bg-white border border-gray-100 rounded-xl mb-3 shadow-sm">
                        <div className="flex justify-between items-start mb-2">
                           <span className="font-bold text-sm text-[#123524]">{b.service.split('(')[0]}</span>
                           <span className={`text-[9px] px-2 py-0.5 rounded font-bold uppercase ${b.status === 'completed' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>{b.status}</span>
                        </div>
                        <div className="text-xs text-gray-500">Slot: {b.time} | Cust: {b.name}</div>
                     </div>
                 ))}
              </div>
           )}

           {staffTab === 'outpass' && (
              <div className="animate-fade-in">
                 <h3 className="font-bold text-gray-800 mb-4 text-sm">Today's Out Passes</h3>
                 {myOutpasses.filter(o => o.date === getLocalTodayStr()).map(o => (
                     <div key={o.id} className="p-4 bg-white border border-gray-100 rounded-xl mb-3 shadow-sm flex justify-between items-center">
                        <div>
                           <div className="font-bold text-sm text-purple-800">{o.reason || 'Out Pass'}</div>
                           <div className="text-xs text-gray-500 mt-1">{formatMillis(o.outTimeMillis)} - {o.inTimeMillis ? formatMillis(o.inTimeMillis) : 'Now'}</div>
                        </div>
                        <span className={`text-[9px] px-2 py-0.5 rounded font-bold uppercase ${o.status === 'returned' ? 'bg-gray-100 text-gray-600' : 'bg-purple-100 text-purple-600'}`}>{o.status}</span>
                     </div>
                 ))}
              </div>
           )}

           {staffTab === 'service' && (
               <>
               {showWalkinModal ? (
                   <div className="animate-fade-in pb-10">
                      <div className="flex justify-between items-center mb-6 bg-white p-4 rounded-xl shadow-sm border border-gray-100">
                         <h3 className="font-bold text-lg text-[#123524]">Start Walk-in Service</h3>
                         <button onClick={() => setShowWalkinModal(false)} className="text-gray-500 bg-gray-100 px-4 py-2 rounded-lg font-bold text-xs hover:bg-gray-200">Cancel</button>
                      </div>
                      <CustomerBookingWizard appData={appData} isStaffMode={true} staffClockIn={true} preselectedStaff={loggedInStaff.name} staffClockInSuccess={() => setShowWalkinModal(false)} />
                   </div>
               ) : activeBooking ? (
                   <div className="bg-white border border-orange-200 p-6 rounded-xl shadow-sm text-center mb-6 animate-fade-in">
                      <h3 className="font-bold text-orange-600 text-lg mb-2">You are currently in a service</h3>
                      <p className="text-gray-700 font-bold mb-4">{activeBooking.service}</p>
                      <p className="text-xs text-gray-500 mb-6">Expected End Time: {formatMillis(activeBooking.expectedEndTimeMillis)}</p>
                      <button disabled={loading} onClick={handleFinishService} className="bg-orange-600 text-white px-8 py-3 rounded-lg font-bold shadow-md hover:bg-orange-700 transition w-full">
                          {loading ? 'Processing...' : 'Finish Service (Check Out)'}
                      </button>
                      <p className="text-[10px] text-orange-500 mt-3 font-semibold">မှတ်ချက်: ဆိုင်ဧရိယာအတွင်းသို့ရောက်မှသာ Finish နှိပ်နိုင်ပါမည်။</p>
                   </div>
               ) : activeOutpass ? (
                   <div className="bg-white border border-purple-200 p-6 rounded-xl shadow-sm text-center mb-6 animate-fade-in">
                      <h3 className="font-bold text-purple-600 text-lg mb-2">You are currently on Out Pass</h3>
                      <p className="text-gray-700 font-bold mb-4">Reason: {activeOutpass.reason || '-'}</p>
                      <p className="text-xs text-gray-500 mb-6">Must Return By: {formatMillis(activeOutpass.expectedInTimeMillis)}</p>
                      <button disabled={loading} onClick={handleReturnFromOutPass} className="bg-purple-600 text-white px-8 py-3 rounded-lg font-bold shadow-md hover:bg-purple-700 transition w-full">
                          {loading ? 'Processing...' : 'Return to Shop (Check In)'}
                      </button>
                      <p className="text-[10px] text-purple-500 mt-3 font-semibold">မှတ်ချက်: ဆိုင်ဧရိယာအတွင်းသို့ရောက်မှသာ Return နှိပ်နိုင်ပါမည်။</p>
                   </div>
               ) : (
                   <div className="grid md:grid-cols-2 gap-6 mb-6 animate-fade-in">
                       <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 flex flex-col justify-center text-center hover:shadow-md transition cursor-pointer" onClick={() => setShowWalkinModal(true)}>
                           <div className="w-14 h-14 bg-green-50 text-green-600 rounded-full flex items-center justify-center mb-3 mx-auto shadow-inner"><Play className="w-6 h-6 ml-1" /></div>
                           <h3 className="font-bold text-gray-800 mb-2">Start Walk-in Service</h3>
                           <p className="text-xs text-gray-500 mb-6 leading-relaxed">ဧည့်သည် ဆိုင်သို့ရောက်ရှိလာပါက ဤနေရာမှ ဝင်ရောက်ပြီး Service ရွေးချယ်ကာ ချက်ချင်းစတင်နိုင်ပါသည်။</p>
                           <button className="w-full bg-[#123524] text-[#D4AF37] py-3 rounded-lg font-bold shadow-sm hover:bg-[#1a4a32] transition border border-[#1a4a32]">
                               Start Walk-in Service
                           </button>
                       </div>
                       <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                           <h3 className="font-bold text-gray-800 mb-4 flex items-center"><Coffee className="w-5 h-5 mr-2 text-[#D4AF37]"/> Request Out Pass</h3>
                           <form onSubmit={handleOutPassSubmit} className="space-y-4">
                               <div className="grid grid-cols-2 gap-4">
                                   <div><label className="text-xs font-bold text-gray-500 mb-1 block">Hours</label><input type="number" name="hours" min="0" max="24" defaultValue="0" className="w-full p-2 text-sm border border-gray-200 rounded focus:border-[#D4AF37] outline-none" /></div>
                                   <div><label className="text-xs font-bold text-gray-500 mb-1 block">Minutes</label><input type="number" name="mins" min="0" max="59" defaultValue="30" className="w-full p-2 text-sm border border-gray-200 rounded focus:border-[#D4AF37] outline-none" /></div>
                               </div>
                               <div><input type="text" name="reason" placeholder="Reason (Optional)" className="w-full p-2 text-sm border border-gray-200 rounded focus:border-[#D4AF37] outline-none" /></div>
                               <button type="submit" disabled={loading} className="w-full bg-gray-100 text-gray-700 py-3 rounded-lg font-bold border border-gray-300 hover:bg-gray-200 transition">
                                   {loading ? 'Processing...' : 'Submit Out Pass'}
                               </button>
                           </form>
                       </div>
                   </div>
               )}
               </>
           )}
       </div>
   );
}
