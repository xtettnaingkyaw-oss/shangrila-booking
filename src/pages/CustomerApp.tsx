import React, { useState, useEffect, useMemo, memo } from 'react';
import { collection, addDoc, getDocs, query, onSnapshot, orderBy } from 'firebase/firestore';
import { db } from '../firebase';
import { Calendar, Clock, CreditCard, CheckCircle, User, Phone, ChevronRight, ChevronLeft, Check, Sparkles, Droplets, Scissors, Home, ChevronDown, ChevronUp, History, UserCircle, CalendarPlus, ImageIcon } from 'lucide-react';
import { THEME, AppData, Booking, MenuItem, formatPrice, getLocalTodayStr, ALL_TIME_SLOTS } from '../shared';

const ICON_MAP: Record<string, any> = { massage: Sparkles, scrub: Droplets, waxing: Scissors, hotel: Home, facial: Droplets, manicure: Scissors, pedicure: Scissors };

export default function CustomerApp({ appData }: { appData: AppData }) {
  const [activeTab, setActiveTab] = useState<'book' | 'therapists' | 'dashboard' | 'history' | 'profile'>(() => {
     const view = new URLSearchParams(window.location.search).get('view');
     if (view === 'therapists') return 'therapists'; 
     if (view === 'dashboard') return 'dashboard'; 
     return 'book';
  });

  return (
    <div className="animate-fade-in pb-20">
      {/* Navigation Tabs */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-2 mb-6 flex overflow-x-auto scrollbar-hide max-w-2xl mx-auto">
        <button onClick={() => setActiveTab('book')} className={`flex-1 min-w-[100px] flex flex-col items-center justify-center p-3 rounded-xl transition text-xs font-bold ${activeTab === 'book' ? 'bg-gray-50 text-[#123524] shadow-sm border border-gray-200' : 'text-gray-400 hover:bg-gray-50 hover:text-gray-600'}`}>
          <CalendarPlus className={`w-5 h-5 mb-1 ${activeTab === 'book' ? 'text-[#D4AF37]' : ''}`} /> Book Now
        </button>
        <button onClick={() => setActiveTab('therapists')} className={`flex-1 min-w-[100px] flex flex-col items-center justify-center p-3 rounded-xl transition text-xs font-bold ${activeTab === 'therapists' ? 'bg-gray-50 text-[#123524] shadow-sm border border-gray-200' : 'text-gray-400 hover:bg-gray-50 hover:text-gray-600'}`}>
          <User className={`w-5 h-5 mb-1 ${activeTab === 'therapists' ? 'text-[#D4AF37]' : ''}`} /> View Therapists
        </button>
        <button onClick={() => setActiveTab('dashboard')} className={`flex-1 min-w-[100px] flex flex-col items-center justify-center p-3 rounded-xl transition text-xs font-bold ${activeTab === 'dashboard' ? 'bg-gray-50 text-[#123524] shadow-sm border border-gray-200' : 'text-gray-400 hover:bg-gray-50 hover:text-gray-600'}`}>
          <Activity className={`w-5 h-5 mb-1 ${activeTab === 'dashboard' ? 'text-[#D4AF37]' : ''}`} /> Dashboard
        </button>
        <button onClick={() => setActiveTab('history')} className={`flex-1 min-w-[100px] flex flex-col items-center justify-center p-3 rounded-xl transition text-xs font-bold ${activeTab === 'history' ? 'bg-gray-50 text-[#123524] shadow-sm border border-gray-200' : 'text-gray-400 hover:bg-gray-50 hover:text-gray-600'}`}>
          <History className={`w-5 h-5 mb-1 ${activeTab === 'history' ? 'text-[#D4AF37]' : ''}`} /> My Bookings
        </button>
        <button onClick={() => setActiveTab('profile')} className={`flex-1 min-w-[100px] flex flex-col items-center justify-center p-3 rounded-xl transition text-xs font-bold ${activeTab === 'profile' ? 'bg-gray-50 text-[#123524] shadow-sm border border-gray-200' : 'text-gray-400 hover:bg-gray-50 hover:text-gray-600'}`}>
          <UserCircle className={`w-5 h-5 mb-1 ${activeTab === 'profile' ? 'text-[#D4AF37]' : ''}`} /> Profile
        </button>
      </div>

      {activeTab === 'book' && <CustomerBookingWizard appData={appData} onBookingSuccess={() => setActiveTab('dashboard')} />}
      {activeTab === 'therapists' && <TherapistsGallery appData={appData} />}
      {activeTab === 'dashboard' && <CustomerDashboard />}
      {activeTab === 'history' && <CustomerHistory />}
      {activeTab === 'profile' && <CustomerProfile />}
    </div>
  );
}

// ---------------------------------------------------------
// COMPONENT: CustomerBookingWizard
// ---------------------------------------------------------
function CustomerBookingWizard({ appData, onBookingSuccess }: { appData: AppData, onBookingSuccess: () => void }) {
  const [step, setStep] = useState(1);
  const [expandedCategory, setExpandedCategory] = useState<string | null>(appData.categories[0]?.id || null);
  
  // Form State
  const [selectedService, setSelectedService] = useState<MenuItem | null>(null);
  const [selectedTherapist, setSelectedTherapist] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<string>(getLocalTodayStr());
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<string | null>(null);
  const [txId, setTxId] = useState('');
  const [specialRequest, setSpecialRequest] = useState('');
  const [customerName, setCustomerName] = useState(localStorage.getItem('shangrila_user_name') || '');
  const [customerPhone, setCustomerPhone] = useState(localStorage.getItem('shangrila_user_phone') || '');
  
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Available times logic
  const availableTimes = useMemo(() => {
      if (selectedDate !== getLocalTodayStr()) return ALL_TIME_SLOTS;
      const now = new Date();
      return ALL_TIME_SLOTS.filter(slot => {
          if (slot.includes("to")) return true;
          const [time, ampm] = slot.split(' ');
          let [h, m] = time.split(':').map(Number);
          if (ampm === 'PM' && h < 12) h += 12;
          if (ampm === 'AM' && h === 12) h = 0;
          const slotTime = new Date(); slotTime.setHours(h, m, 0, 0);
          return slotTime > now;
      });
  }, [selectedDate]);

  const calculateTotal = () => {
    let price = selectedService?.price || 0;
    if (appData.promotion?.isActive) {
       const isHotel = selectedService?.name.toLowerCase().includes('outcall') || selectedService?.name.toLowerCase().includes('hotel');
       const discount = isHotel ? appData.promotion.hotelDiscountPercent : appData.promotion.otherDiscountPercent;
       price = price - (price * (discount / 100));
    }
    return price;
  };

  const handleBookingSubmit = async () => {
    if (!selectedService || !selectedTherapist || !selectedDate || !selectedTime || !paymentMethod || !customerName || !customerPhone || !txId) {
      alert("Please complete all required fields."); return;
    }
    setIsSubmitting(true);
    try {
      localStorage.setItem('shangrila_user_name', customerName);
      localStorage.setItem('shangrila_user_phone', customerPhone);
      
      const b: Booking = {
        name: customerName,
        phone: customerPhone,
        service: `${selectedService.name} (${selectedService.duration})`,
        therapist: selectedTherapist,
        date: selectedDate,
        time: selectedTime,
        paymentMethod,
        txId,
        totalPrice: calculateTotal(),
        status: 'pending',
        specialRequest,
        createdAt: Date.now()
      };
      await addDoc(collection(db, 'bookings'), b);
      alert('Booking submitted successfully! Please wait for admin approval.');
      onBookingSuccess();
    } catch (e) {
      alert('Failed to submit booking. Please check your connection.');
    }
    setIsSubmitting(false);
  };

  return (
    <div className="max-w-2xl mx-auto">
      {/* STEPS INDICATOR */}
      <div className="flex justify-between items-center mb-10 px-4 sm:px-12 relative">
        <div className="absolute top-1/2 left-10 right-10 h-0.5 bg-gray-200 -z-10 -translate-y-1/2"></div>
        {[ { num: 1, label: 'SERVICE' }, { num: 2, label: 'THERAPIST' }, { num: 3, label: 'DATE & TIME' }, { num: 4, label: 'CONFIRM' } ].map((s) => (
          <div key={s.num} className="flex flex-col items-center relative z-10 bg-gray-50 px-2 cursor-pointer" onClick={() => { if(s.num < step) setStep(s.num); }}>
            <div className={`w-10 h-10 sm:w-12 sm:h-12 rounded-full flex items-center justify-center font-bold text-sm sm:text-base shadow-sm transition-all duration-300 ${step === s.num ? 'bg-[#123524] text-white ring-4 ring-green-900/20 scale-110' : step > s.num ? 'bg-[#D4AF37] text-white' : 'bg-white text-gray-400 border-2 border-gray-200'}`}>
              {step > s.num ? <Check className="w-5 h-5" /> : s.num === 1 ? <Sparkles className="w-4 h-4"/> : s.num === 2 ? <User className="w-4 h-4"/> : s.num === 3 ? <Calendar className="w-4 h-4"/> : <CreditCard className="w-4 h-4"/>}
            </div>
            <span className={`text-[9px] sm:text-[10px] mt-2 font-bold uppercase tracking-wider ${step === s.num ? 'text-[#123524]' : 'text-gray-400'}`}>{s.label}</span>
          </div>
        ))}
      </div>

      {/* STEP 1: SERVICE */}
      {step === 1 && (
        <div className="animate-fade-in">
          <div className="text-center mb-8">
             <h2 className="text-xl font-bold text-[#123524]">Choose Your Service</h2>
             <p className="text-[11px] font-bold text-[#D4AF37] mt-1">(သင်​ရယူလိုသော ဝန်ဆောင်မှုကို ရွေးချယ်ပါ)</p>
          </div>
          
          <div className="space-y-4">
            {appData.categories.map((cat) => {
              const Icon = ICON_MAP[cat.id] || Sparkles;
              const isExpanded = expandedCategory === cat.id;
              return (
                <div key={cat.id} className={`bg-white rounded-2xl border transition-all duration-300 ${isExpanded ? 'border-[#D4AF37] shadow-md' : 'border-gray-200 shadow-sm hover:border-[#D4AF37]/50'}`}>
                  <button onClick={() => setExpandedCategory(isExpanded ? null : cat.id)} className="w-full p-4 flex items-center justify-between font-bold text-gray-800 outline-none">
                    <div className="flex items-center"><Icon className={`w-5 h-5 mr-3 ${isExpanded ? 'text-[#D4AF37]' : 'text-gray-400'}`} /> {cat.title}</div>
                    {isExpanded ? <ChevronUp className="w-5 h-5 text-gray-400" /> : <ChevronDown className="w-5 h-5 text-gray-400" />}
                  </button>
                  {isExpanded && (
                    <div className="px-4 pb-4 space-y-3">
                      {cat.items.map((item) => (
                        <div key={item.id} onClick={() => setSelectedService(item)} className={`p-4 rounded-xl cursor-pointer border-2 transition-all flex justify-between items-center ${selectedService?.id === item.id ? 'border-[#123524] bg-green-50/50' : 'border-gray-100 hover:border-gray-200'}`}>
                          <div>
                            <div className="font-bold text-gray-800 text-sm sm:text-base">{item.name}</div>
                            <div className="text-xs text-gray-500 mt-1 flex items-center"><Clock className="w-3 h-3 mr-1" /> {item.duration}</div>
                          </div>
                          <div className="text-right">
                            <div className="font-bold text-[#123524] text-sm sm:text-base">{formatPrice(item.price)}</div>
                            {item.vvipIncluded && <div className="text-[10px] text-[#D4AF37] font-bold mt-1 tracking-wider uppercase">VVIP Free</div>}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          <button disabled={!selectedService} onClick={() => setStep(2)} className="w-full mt-8 py-4 bg-[#123524] text-white rounded-xl font-bold shadow-lg hover:bg-green-900 transition flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed">
            CONTINUE TO THERAPIST <ChevronRight className="w-5 h-5 ml-2" />
          </button>
        </div>
      )}

      {/* STEP 2: THERAPIST */}
      {step === 2 && (
        <div className="animate-fade-in">
          <div className="text-center mb-8">
             <h2 className="text-xl font-bold text-[#123524]">Select Your Therapist</h2>
             <p className="text-[11px] font-bold text-[#D4AF37] mt-1">(ဘိုကင်ရယူလိုသော သင်နှစ်သက်ရာ ဝန်ထမ်းကို ရွေးချယ်ပါ)</p>
          </div>

          <div onClick={() => setSelectedTherapist('Any Available Therapist')} className={`mb-6 p-4 rounded-xl cursor-pointer border-2 transition-all flex items-center justify-center gap-3 ${selectedTherapist === 'Any Available Therapist' ? 'border-[#D4AF37] bg-yellow-50/30 shadow-md' : 'border-gray-200 hover:border-gray-300'}`}>
            <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center text-gray-400"><User className="w-5 h-5" /></div>
            <div className="text-left"><div className="font-bold text-gray-800">Any Available Therapist</div><div className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">We'll assign the best available</div></div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            {appData.therapists.map((t) => (
              <div key={t.id} onClick={() => setSelectedTherapist(t.name)} className={`relative rounded-2xl overflow-hidden cursor-pointer border-4 transition-all duration-300 group ${selectedTherapist === t.name ? 'border-[#D4AF37] shadow-xl scale-105 z-10' : 'border-transparent shadow-sm hover:shadow-md'}`}>
                <div className="aspect-[3/4] bg-gray-100 relative">
                  {t.images[0] ? <img src={t.images[0]} alt={t.name} className="w-full h-full object-cover transition duration-700 group-hover:scale-110" /> : <div className="w-full h-full flex flex-col items-center justify-center text-gray-300"><ImageIcon className="w-8 h-8 mb-2 opacity-50"/> <span className="text-[10px] font-bold uppercase tracking-widest">No Photo</span></div>}
                  <div className="absolute inset-0 bg-gradient-to-t from-[#123524]/90 via-[#123524]/20 to-transparent"></div>
                </div>
                <div className="absolute bottom-0 left-0 right-0 p-3 sm:p-4 text-center">
                  <div className="font-bold text-white text-sm sm:text-base tracking-wide drop-shadow-md">{t.name}</div>
                  {t.images.length > 1 && <div className="text-[9px] text-[#D4AF37] mt-1 font-bold tracking-widest uppercase flex justify-center items-center"><ImageIcon className="w-2.5 h-2.5 mr-1"/> See {t.images.length} photos</div>}
                </div>
                {selectedTherapist === t.name && <div className="absolute top-3 right-3 bg-[#D4AF37] text-white p-1 rounded-full shadow-lg"><Check className="w-4 h-4" /></div>}
              </div>
            ))}
          </div>
          <div className="flex gap-3 mt-8">
            <button onClick={() => setStep(1)} className="py-4 px-6 bg-white border border-gray-200 text-gray-600 rounded-xl font-bold shadow-sm hover:bg-gray-50 transition"><ChevronLeft className="w-5 h-5" /></button>
            <button disabled={!selectedTherapist} onClick={() => setStep(3)} className="flex-1 py-4 bg-[#123524] text-white rounded-xl font-bold shadow-lg hover:bg-green-900 transition flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed">
              CONTINUE TO DATE <ChevronRight className="w-5 h-5 ml-2" />
            </button>
          </div>
        </div>
      )}

      {/* STEP 3: DATE & TIME */}
      {step === 3 && (
        <div className="animate-fade-in">
          <div className="text-center mb-8">
             <h2 className="text-xl font-bold text-[#123524]">Pick Date & Time</h2>
             <p className="text-[11px] font-bold text-[#D4AF37] mt-1">(ဘိုကင်ရယူလိုသော နေ့ရက် နှင့် အချိန် ကို ရွေးချယ် ပါ)</p>
          </div>

          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200 space-y-6">
            <div>
              <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3 flex items-center"><Calendar className="w-4 h-4 mr-2 text-[#D4AF37]" /> Select Date</label>
              <input type="date" min={getLocalTodayStr()} value={selectedDate} onChange={(e) => { setSelectedDate(e.target.value); setSelectedTime(null); }} className="w-full p-4 bg-gray-50 border border-gray-200 rounded-xl font-bold text-gray-800 outline-none focus:border-[#D4AF37] transition" />
            </div>
            <div>
              <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3 flex items-center"><Clock className="w-4 h-4 mr-2 text-[#D4AF37]" /> Available Times</label>
              {availableTimes.length === 0 ? (
                <div className="text-sm text-red-500 p-4 bg-red-50 rounded-lg border border-red-100 text-center font-bold">No slots available for today. Please select tomorrow.</div>
              ) : (
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                  {availableTimes.map((time) => (
                    <button key={time} onClick={() => setSelectedTime(time)} className={`p-3 text-xs sm:text-sm font-bold rounded-xl border transition-all ${selectedTime === time ? 'bg-[#123524] text-white border-[#123524] shadow-md scale-105' : 'bg-white text-gray-600 border-gray-200 hover:border-[#D4AF37] hover:text-[#D4AF37]'}`}>
                      {time}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
          <div className="flex gap-3 mt-8">
            <button onClick={() => setStep(2)} className="py-4 px-6 bg-white border border-gray-200 text-gray-600 rounded-xl font-bold shadow-sm hover:bg-gray-50 transition"><ChevronLeft className="w-5 h-5" /></button>
            <button disabled={!selectedDate || !selectedTime} onClick={() => setStep(4)} className="flex-1 py-4 bg-[#123524] text-white rounded-xl font-bold shadow-lg hover:bg-green-900 transition flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed">
              CONTINUE TO CONFIRM <ChevronRight className="w-5 h-5 ml-2" />
            </button>
          </div>
        </div>
      )}

      {/* STEP 4: CONFIRM */}
      {step === 4 && (
        <div className="animate-fade-in">
          <div className="text-center mb-8">
             <h2 className="text-xl font-bold text-[#123524]">Confirm Booking</h2>
             <p className="text-[11px] font-bold text-[#D4AF37] mt-1">(သင်ရွေးချယ််ခဲ့သော ဘိုကင် အချက်အလက်များကို စစ်ဆေး၍ အတည်ပြုပါ)</p>
          </div>

          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200 mb-6 relative overflow-hidden">
            <div className="absolute top-0 left-0 w-1 h-full bg-[#D4AF37]"></div>
            <h3 className="font-bold text-gray-800 border-b border-gray-100 pb-3 mb-4 flex items-center"><CheckCircle className="w-5 h-5 mr-2 text-[#D4AF37]" /> Summary</h3>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between"><span className="text-gray-500">Service:</span> <span className="font-bold text-gray-800 text-right">{selectedService?.name} <br/><span className="text-xs text-[#D4AF37]">({selectedService?.duration})</span></span></div>
              <div className="flex justify-between"><span className="text-gray-500">Therapist:</span> <span className="font-bold text-gray-800">{selectedTherapist}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Date:</span> <span className="font-bold text-gray-800">{selectedDate}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Time:</span> <span className="font-bold text-[#123524] bg-green-50 px-2 py-0.5 rounded">{selectedTime}</span></div>
            </div>
            <div className="mt-4 pt-4 border-t border-dashed border-gray-200">
               <div className="flex justify-between items-end">
                  <span className="font-bold text-gray-600">Total Price:</span>
                  <div className="text-right">
                     {appData.promotion?.isActive && (
                         <div className="text-[10px] text-green-600 font-bold uppercase tracking-wider mb-1 line-through opacity-60">{formatPrice(selectedService?.price)}</div>
                     )}
                     <span className="text-xl font-bold text-[#123524]">{formatPrice(calculateTotal())}</span>
                  </div>
               </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200 space-y-6">
            <h3 className="font-bold text-gray-800 border-b border-gray-100 pb-3 flex items-center"><User className="w-5 h-5 mr-2 text-[#D4AF37]" /> Your Details</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div><label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 block">Name (အမည်)</label><input type="text" value={customerName} onChange={(e) => setCustomerName(e.target.value)} className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:border-[#D4AF37]" placeholder="Your Name" /></div>
              <div><label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 block">Phone (ဖုန်းနံပါတ်)</label><input type="tel" value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:border-[#D4AF37]" placeholder="09xxxxxxxxx" /></div>
            </div>

            <h3 className="font-bold text-gray-800 border-b border-gray-100 pb-3 pt-4 flex items-center"><CreditCard className="w-5 h-5 mr-2 text-[#D4AF37]" /> Payment Method</h3>
            <div className="grid grid-cols-2 gap-3">
              {appData.paymentMethods.map(pm => (
                <div key={pm.id} onClick={() => setPaymentMethod(pm.name)} className={`p-4 rounded-xl border-2 cursor-pointer transition flex flex-col items-center justify-center text-center ${paymentMethod === pm.name ? 'border-[#123524] bg-green-50/50' : 'border-gray-100 hover:border-gray-200'}`}>
                   {pm.logoUrl ? <img src={pm.logoUrl} alt={pm.name} className="h-8 mb-2 object-contain" /> : <div className="font-bold text-gray-800 text-sm mb-1">{pm.name}</div>}
                   <div className="text-[10px] text-gray-500 font-mono mt-1">{pm.accountNumber}</div>
                </div>
              ))}
            </div>
            
            {paymentMethod && (
               <div className="bg-yellow-50 p-4 rounded-xl border border-yellow-200 mt-4">
                  <label className="text-xs font-bold text-yellow-800 uppercase tracking-wider mb-2 block">Transaction ID (နောက်ဆုံး ဂဏန်း ၆ လုံး)</label>
                  <input type="text" value={txId} onChange={(e) => setTxId(e.target.value)} placeholder="e.g. 123456" className="w-full p-3 bg-white border border-yellow-300 rounded-xl outline-none focus:border-[#D4AF37] font-mono text-center font-bold tracking-widest text-gray-800" />
                  <p className="text-[10px] text-yellow-600 mt-2 text-center font-bold leading-relaxed">ငွေလွှဲပြီးမှသာ Transaction ID ဖြည့်၍ Booking တင်ပါ။</p>
               </div>
            )}

            <div><label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 block">Special Request (Optional)</label><textarea value={specialRequest} onChange={(e) => setSpecialRequest(e.target.value)} rows={2} className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:border-[#D4AF37] text-sm" placeholder="Any special requests or instructions..." /></div>
          </div>

          <div className="flex gap-3 mt-8">
            <button disabled={isSubmitting} onClick={() => setStep(3)} className="py-4 px-6 bg-white border border-gray-200 text-gray-600 rounded-xl font-bold shadow-sm hover:bg-gray-50 transition disabled:opacity-50"><ChevronLeft className="w-5 h-5" /></button>
            <button disabled={isSubmitting || !paymentMethod || !txId || !customerName || !customerPhone} onClick={handleBookingSubmit} className="flex-1 py-4 bg-[#D4AF37] text-white rounded-xl font-bold shadow-lg hover:bg-yellow-600 transition flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed">
              {isSubmitting ? 'PROCESSING...' : 'CONFIRM BOOKING'} <CheckCircle className="w-5 h-5 ml-2" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------
// COMPONENT: TherapistsGallery
// ---------------------------------------------------------
function TherapistsGallery({ appData }: { appData: AppData }) {
  return (
    <div className="max-w-4xl mx-auto px-4 pb-20 animate-fade-in">
      <div className="text-center mb-10">
        <h2 className="text-2xl font-bold text-[#123524] mb-2 font-serif">Our Professionals</h2>
        <div className="w-16 h-1 bg-[#D4AF37] mx-auto rounded-full mb-4"></div>
        <p className="text-sm text-gray-500 max-w-md mx-auto leading-relaxed">Experience ultimate relaxation with our certified and highly skilled therapists.</p>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6">
        {appData.therapists.map((t) => (
          <div key={t.id} className="bg-white rounded-2xl overflow-hidden shadow-sm hover:shadow-xl transition-all duration-300 border border-gray-100 group">
            <div className="aspect-[3/4] relative overflow-hidden bg-gray-50">
              {t.images.length > 0 ? (
                <>
                  <img src={t.images[0]} alt={t.name} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" />
                  <div className="absolute inset-0 bg-gradient-to-t from-[#123524]/90 via-transparent to-transparent opacity-80"></div>
                </>
              ) : (
                <div className="w-full h-full flex items-center justify-center text-gray-300"><ImageIcon className="w-10 h-10 opacity-20"/></div>
              )}
              <div className="absolute bottom-0 left-0 right-0 p-4 text-center">
                 <h3 className="font-bold text-white text-lg drop-shadow-md">{t.name}</h3>
                 {t.images.length > 1 && <span className="text-[9px] text-[#D4AF37] font-bold tracking-widest uppercase mt-1 block drop-shadow-sm flex items-center justify-center"><ImageIcon className="w-2.5 h-2.5 mr-1"/>{t.images.length} Photos</span>}
              </div>
            </div>
            {t.images.length > 1 && (
              <div className="p-3 bg-white grid grid-cols-4 gap-2">
                {t.images.slice(1, 5).map((img, idx) => (
                  <div key={idx} className="aspect-square rounded-lg overflow-hidden border border-gray-100 cursor-pointer hover:border-[#D4AF37] transition">
                    <img src={img} alt={`${t.name} ${idx+2}`} className="w-full h-full object-cover" />
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------
// COMPONENT: CustomerDashboard & CustomerHistory (Shared logic)
// ---------------------------------------------------------
function BookingCard({ b }: { b: Booking }) {
   const statusColor = { pending: 'bg-yellow-100 text-yellow-700 border-yellow-200', payment_checking: 'bg-blue-100 text-blue-700 border-blue-200', approved: 'bg-green-100 text-green-700 border-green-200', in_progress: 'bg-orange-100 text-orange-700 border-orange-200', completed: 'bg-gray-100 text-gray-600 border-gray-200', cancelled: 'bg-red-100 text-red-700 border-red-200' }[b.status];
   return (
     <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 hover:border-[#D4AF37]/50 transition-all duration-300 relative overflow-hidden group">
       <div className={`absolute top-0 left-0 w-1.5 h-full ${b.status === 'in_progress' ? 'bg-orange-500 animate-pulse' : b.status === 'approved' ? 'bg-green-500' : 'bg-gray-200'}`}></div>
       <div className="flex justify-between items-start mb-3">
         <div>
           <div className="font-bold text-gray-800 text-base">{b.service.split('(')[0]}</div>
           <div className="text-xs text-gray-500 mt-1 flex items-center"><User className="w-3 h-3 mr-1 text-[#D4AF37]"/> {b.therapist}</div>
         </div>
         <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full border uppercase tracking-wider ${statusColor}`}>{b.status.replace('_', ' ')}</span>
       </div>
       <div className="grid grid-cols-2 gap-3 mb-3 bg-gray-50 p-3 rounded-xl border border-gray-100">
         <div><div className="text-[10px] text-gray-400 font-bold uppercase mb-0.5">Date</div><div className="font-semibold text-sm text-gray-700 flex items-center"><Calendar className="w-3 h-3 mr-1 text-[#123524]"/>{b.date}</div></div>
         <div><div className="text-[10px] text-gray-400 font-bold uppercase mb-0.5">Time</div><div className="font-semibold text-sm text-[#123524] flex items-center"><Clock className="w-3 h-3 mr-1 text-[#D4AF37]"/>{b.time}</div></div>
       </div>
       <div className="flex justify-between items-end pt-3 border-t border-gray-100">
         <div className="text-[10px] text-gray-400 font-mono">ID: {b.id?.slice(-6).toUpperCase()}</div>
         <div className="font-bold text-[#123524] text-lg">{formatPrice(b.totalPrice)}</div>
       </div>
     </div>
   );
}

function CustomerDashboard() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const phone = localStorage.getItem('shangrila_user_phone');

  useEffect(() => {
    if (!phone) return;
    const unsub = onSnapshot(query(collection(db, 'bookings')), snap => {
      const arr: Booking[] = [];
      snap.forEach(d => { const b = {id: d.id, ...d.data()} as Booking; if(b.phone === phone && b.status !== 'completed' && b.status !== 'cancelled') arr.push(b); });
      setBookings(arr.sort((a,b) => (b.createdAt||0) - (a.createdAt||0)));
    });
    return () => unsub();
  }, [phone]);

  if (!phone) return <div className="text-center py-20 text-gray-500 font-bold animate-fade-in"><UserCircle className="w-12 h-12 mx-auto mb-3 text-gray-300"/>No active session. Please make a booking first.</div>;
  
  return (
    <div className="max-w-2xl mx-auto animate-fade-in">
      <div className="flex items-center justify-between mb-6 px-2"><h2 className="text-xl font-bold text-[#123524] flex items-center"><Activity className="w-5 h-5 mr-2 text-[#D4AF37]" /> Active Bookings</h2><span className="bg-[#123524] text-white px-3 py-1 rounded-full text-xs font-bold">{bookings.length}</span></div>
      {bookings.length === 0 ? (
         <div className="bg-white p-10 rounded-3xl shadow-sm border border-gray-100 text-center"><CalendarPlus className="w-12 h-12 text-gray-200 mx-auto mb-4"/><h3 className="font-bold text-gray-600 mb-1">No Active Bookings</h3><p className="text-xs text-gray-400">You don't have any upcoming appointments.</p></div>
      ) : (
         <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">{bookings.map(b => <BookingCard key={b.id} b={b} />)}</div>
      )}
    </div>
  );
}

function CustomerHistory() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const phone = localStorage.getItem('shangrila_user_phone');

  useEffect(() => {
    if (!phone) return;
    const unsub = onSnapshot(query(collection(db, 'bookings')), snap => {
      const arr: Booking[] = [];
      snap.forEach(d => { const b = {id: d.id, ...d.data()} as Booking; if(b.phone === phone && (b.status === 'completed' || b.status === 'cancelled')) arr.push(b); });
      setBookings(arr.sort((a,b) => (b.createdAt||0) - (a.createdAt||0)));
    });
    return () => unsub();
  }, [phone]);

  if (!phone) return <div className="text-center py-20 text-gray-500 font-bold animate-fade-in"><History className="w-12 h-12 mx-auto mb-3 text-gray-300"/>No history available.</div>;
  
  return (
    <div className="max-w-2xl mx-auto animate-fade-in">
      <div className="flex items-center justify-between mb-6 px-2"><h2 className="text-xl font-bold text-[#123524] flex items-center"><History className="w-5 h-5 mr-2 text-gray-400" /> Booking History</h2><span className="bg-gray-200 text-gray-600 px-3 py-1 rounded-full text-xs font-bold">{bookings.length}</span></div>
      {bookings.length === 0 ? (
         <div className="bg-white p-10 rounded-3xl shadow-sm border border-gray-100 text-center"><History className="w-12 h-12 text-gray-200 mx-auto mb-4"/><h3 className="font-bold text-gray-600 mb-1">No History Yet</h3><p className="text-xs text-gray-400">Your past bookings will appear here.</p></div>
      ) : (
         <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">{bookings.map(b => <BookingCard key={b.id} b={b} />)}</div>
      )}
    </div>
  );
}

function CustomerProfile() {
  const name = localStorage.getItem('shangrila_user_name') || 'Guest User';
  const phone = localStorage.getItem('shangrila_user_phone') || 'No Phone Registered';
  
  return (
    <div className="max-w-md mx-auto bg-white p-8 rounded-3xl shadow-sm border border-gray-100 text-center animate-fade-in mt-10">
      <div className="w-20 h-20 bg-gray-50 rounded-full mx-auto flex items-center justify-center border-4 border-white shadow-md mb-4 -mt-16"><UserCircle className="w-10 h-10 text-[#D4AF37]"/></div>
      <h2 className="text-xl font-bold text-[#123524] mb-1">{name}</h2>
      <p className="text-sm font-mono text-gray-500 bg-gray-50 inline-block px-4 py-1.5 rounded-full border border-gray-200">{phone}</p>
      
      <div className="mt-8 pt-6 border-t border-gray-100 text-left space-y-4">
         <div className="bg-green-50 p-4 rounded-xl border border-green-100">
             <div className="text-[10px] font-bold text-green-700 uppercase tracking-wider mb-1 flex items-center"><CheckCircle className="w-3 h-3 mr-1"/> Session Status</div>
             <div className="text-sm text-green-800 font-semibold">Active & Logged In</div>
         </div>
         <p className="text-[10px] text-gray-400 leading-relaxed text-center">Your profile information is saved locally on this device for a seamless booking experience. Clear your browser data to reset.</p>
      </div>
    </div>
  );
}
