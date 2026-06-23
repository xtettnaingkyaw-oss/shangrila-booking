import React, { useState, useEffect } from 'react';
import { collection, query, onSnapshot, doc, getDoc, updateDoc, addDoc, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import { LogOut, MapPin, Search, Play, StopCircle, UserCheck, KeyRound, Coffee } from 'lucide-react';
import { THEME, AppData, Booking, OutPass, TherapistProfile } from '../shared';
import { CustomerBookingWizard } from './CustomerApp'; // Allows staff to input walk-in directly

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

export default function StaffApp({ appData }: { appData: AppData }) {
  const [loggedInStaff, setLoggedInStaff] = useState<TherapistProfile | null>(null);

  useEffect(() => {
     const storedId = localStorage.getItem('shangrila_staff_id');
     if (storedId) {
         const found = appData.therapists.find(t => t.id === storedId);
         if (found) setLoggedInStaff(found);
     }
  }, [appData.therapists]);

  const handleLogin = (staff: TherapistProfile) => {
     setLoggedInStaff(staff);
     localStorage.setItem('shangrila_staff_id', staff.id!);
  };

  if (!loggedInStaff) return <StaffLogin therapists={appData.therapists} onLogin={handleLogin} />;
  return <StaffDashboard appData={appData} staff={loggedInStaff} onLogout={() => { setLoggedInStaff(null); localStorage.removeItem('shangrila_staff_id'); }} />;
}

function StaffLogin({ therapists, onLogin }: { therapists: TherapistProfile[], onLogin: (s: TherapistProfile) => void }) {
  const [selectedId, setSelectedId] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    const t = therapists.find(x => x.id === selectedId);
    if (!t) { setError("ဝန်ထမ်း ID ရွေးချယ်ပါ။"); return; }
    if (t.password && t.password !== password) { setError("စကားဝှက် မှားယွင်းနေပါသည်။"); return; }
    onLogin(t);
  };

  return (
    <div className="animate-fade-in p-4 mt-6">
      <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-200 max-w-sm mx-auto text-center">
        <div className="w-16 h-16 bg-blue-50 rounded-full mx-auto flex items-center justify-center mb-6 text-blue-600"><UserCheck className="w-8 h-8" /></div>
        <h2 className="text-xl font-bold text-gray-800 mb-2">Staff Login</h2>
        <p className="text-xs font-bold text-gray-500 mb-6">ဝန်ထမ်းအဖြစ် လော့ဂ်အင် ဝင်ပါ</p>
        
        <form onSubmit={handleLogin} className="space-y-4">
          <div className="text-left">
              <label className="block text-xs font-bold text-gray-500 mb-1">Select Profile</label>
              <select required value={selectedId} onChange={e => setSelectedId(e.target.value)} className="w-full p-3 bg-gray-50 border border-gray-200 rounded-lg outline-none focus:border-[#D4AF37] font-bold text-gray-700">
                  <option value="" disabled>-- ရွေးချယ်ပါ --</option>
                  {therapists.map(t => <option key={t.id} value={t.id}>{t.name} (ID: {t.id})</option>)}
              </select>
          </div>
          {selectedId && therapists.find(x=>x.id===selectedId)?.password && (
              <div className="text-left animate-fade-in">
                  <label className="block text-xs font-bold text-gray-500 mb-1">Password</label>
                  <input required type="password" placeholder="Enter Password" value={password} onChange={e => setPassword(e.target.value)} className="w-full p-3 bg-gray-50 border border-gray-200 rounded-lg outline-none focus:border-[#D4AF37] font-bold tracking-widest text-center" />
              </div>
          )}
          {error && <div className="text-xs font-bold text-red-500">{error}</div>}
          <button type="submit" className="w-full py-3 bg-blue-600 text-white rounded-lg font-bold shadow-md hover:bg-blue-700 transition">Enter Portal</button>
        </form>
      </div>
    </div>
  );
}

function StaffDashboard({ appData, staff, onLogout }: { appData: AppData, staff: TherapistProfile, onLogout: () => void }) {
   const [myBookings, setMyBookings] = useState<Booking[]>([]);
   const [myOutpasses, setMyOutpasses] = useState<OutPass[]>([]);
   const [loading, setLoading] = useState(false);
   const [showWalkinModal, setShowWalkinModal] = useState(false);

   useEffect(() => {
       const bq = query(collection(db, 'bookings'));
       const unsubB = onSnapshot(bq, snap => {
           const arr: Booking[] = [];
           snap.forEach(d => {
               const b = {id: d.id, ...d.data()} as Booking;
               if (b.therapist === staff.name) arr.push(b);
           });
           arr.sort((a,b) => (b.createdAt || 0) - (a.createdAt || 0));
           setMyBookings(arr);
       });

       const oq = query(collection(db, 'outpasses'));
       const unsubO = onSnapshot(oq, snap => {
           const arr: OutPass[] = [];
           snap.forEach(d => {
               const o = {id: d.id, ...d.data()} as OutPass;
               if (o.therapist === staff.name) arr.push(o);
           });
           arr.sort((a,b) => (b.outTimeMillis || 0) - (a.outTimeMillis || 0));
           setMyOutpasses(arr);
       });

       return () => { unsubB(); unsubO(); };
   }, [staff.name]);

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
                   // Distance limit updated to 50 meters
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
               therapist: staff.name,
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
               preselectedStaff={staff.name}
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
           <div className="flex justify-between items-center bg-white p-4 rounded-xl shadow-sm border border-gray-200 mb-6">
               <div className="flex items-center">
                   <div className="w-12 h-12 rounded-full overflow-hidden mr-3 bg-gray-100 border border-gray-200 flex-shrink-0">
                       {staff.images && staff.images[0] ? <img src={staff.images[0]} className="w-full h-full object-cover object-top" /> : <User className="w-full h-full p-2 text-gray-400" />}
                   </div>
                   <div>
                       <div className="font-bold text-gray-800">{staff.name}</div>
                       <div className="text-[10px] text-gray-500">Staff Portal (ID: {staff.id})</div>
                   </div>
               </div>
               <button onClick={onLogout} className="bg-red-50 text-red-600 px-3 py-1.5 rounded text-xs font-bold border border-red-100 flex items-center hover:bg-red-100"><LogOut className="w-3 h-3 mr-1" /> Exit</button>
           </div>

           {/* ========================================================= */}
           {/* ACTION CENTER */}
           {/* ========================================================= */}
           <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden mb-6">
               <div className="bg-gray-50 p-4 border-b border-gray-200">
                   <h3 className="font-bold text-gray-800">Action Center</h3>
               </div>
               <div className="p-6">
                   {activeBooking ? (
                       <div className="bg-orange-50 border border-orange-200 rounded-xl p-5 text-center relative overflow-hidden animate-fade-in">
                           <div className="absolute top-0 left-0 w-full h-1 bg-orange-500 animate-pulse"></div>
                           <h3 className="font-bold text-orange-800 text-lg mb-1 flex items-center justify-center"><Activity className="w-5 h-5 mr-2" /> You are in a Service!</h3>
                           <p className="text-xs font-semibold text-orange-600 mb-4">{activeBooking.service}</p>
                           
                           <div className="grid grid-cols-2 gap-4 bg-white p-3 rounded-lg border border-orange-100 mb-6 text-sm">
                               <div className="text-gray-600"><span className="font-bold text-gray-400 block text-[10px] uppercase">Started At</span> {formatMillis(activeBooking.startTimeMillis)}</div>
                               <div className="text-gray-600"><span className="font-bold text-gray-400 block text-[10px] uppercase">Expected End</span> {formatMillis(activeBooking.expectedEndTimeMillis)}</div>
                           </div>

                           <button disabled={loading} onClick={handleFinishService} className="w-full py-4 bg-orange-600 text-white font-bold rounded-lg shadow-md hover:bg-orange-700 flex items-center justify-center transition-all">
                               {loading ? 'Processing...' : <><StopCircle className="w-5 h-5 mr-2" /> Finish Service Now (Check Out)</>}
                           </button>
                           <p className="text-[10px] text-orange-500 mt-3 font-semibold">မှတ်ချက်: ဆိုင်သို့ရောက်မှသာ Finish နှိပ်နိုင်ပါမည်။</p>
                       </div>

                   ) : activeOutpass ? (

                       <div className="bg-purple-50 border border-purple-200 rounded-xl p-5 text-center relative overflow-hidden animate-fade-in">
                           <div className="absolute top-0 left-0 w-full h-1 bg-purple-500 animate-pulse"></div>
                           <h3 className="font-bold text-purple-800 text-lg mb-1 flex items-center justify-center"><Coffee className="w-5 h-5 mr-2" /> You are on Out Pass!</h3>
                           <p className="text-xs font-semibold text-purple-600 mb-4">{activeOutpass.reason || 'No reason specified'}</p>
                           
                           <div className="grid grid-cols-2 gap-4 bg-white p-3 rounded-lg border border-purple-100 mb-6 text-sm">
                               <div className="text-gray-600"><span className="font-bold text-gray-400 block text-[10px] uppercase">Out Time</span> {formatMillis(activeOutpass.outTimeMillis)}</div>
                               <div className="text-gray-600"><span className="font-bold text-gray-400 block text-[10px] uppercase">Must Return By</span> {formatMillis(activeOutpass.expectedInTimeMillis)}</div>
                           </div>

                           <button disabled={loading} onClick={handleReturnFromOutPass} className="w-full py-4 bg-purple-600 text-white font-bold rounded-lg shadow-md hover:bg-purple-700 flex items-center justify-center transition-all">
                               {loading ? 'Processing...' : <><MapPin className="w-5 h-5 mr-2" /> Return to Shop (Check In)</>}
                           </button>
                           <p className="text-[10px] text-purple-500 mt-3 font-semibold">မှတ်ချက်: ဆိုင်သို့ရောက်မှသာ Return နှိပ်နိုင်ပါမည်။</p>
                       </div>

                   ) : (

                       <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-fade-in">
                           
                           {/* Walk-in Service Action */}
                           <div className="border border-green-200 bg-green-50/50 rounded-xl p-5 flex flex-col justify-center items-center text-center hover:shadow-md transition cursor-pointer" onClick={() => setShowWalkinModal(true)}>
                               <div className="w-14 h-14 bg-green-100 text-green-600 rounded-full flex items-center justify-center mb-3 shadow-inner"><Play className="w-6 h-6 ml-1" /></div>
                               <h4 className="font-bold text-green-800 mb-1">Start Walk-in Service</h4>
                               <p className="text-[10px] text-green-600 font-semibold px-4 mb-4 leading-relaxed">ဧည့်သည် ဆိုင်သို့ရောက်ရှိလာပါက ဤနေရာမှ ဝင်ရောက်ပြီး Service ရွေးချယ်ကာ ချက်ချင်းစတင်နိုင်ပါသည်။</p>
                           </div>

                           {/* Request Out Pass Action */}
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

           {/* ========================================================= */}
           {/* TODAY'S RECORDS */}
           {/* ========================================================= */}
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
