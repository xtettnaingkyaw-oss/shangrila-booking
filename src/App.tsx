import React, { useState, useEffect } from 'react';
import { collection, addDoc, getDocs, updateDoc, deleteDoc, doc, query, orderBy } from 'firebase/firestore';
import { db } from './firebase'; 
import { Calendar, Clock, CreditCard, CheckCircle, Trash2, User, Phone, ShieldCheck, Activity, Copy, ChevronRight, Check, Sparkles, Droplets, Scissors, Home, ChevronDown, ChevronUp, Crown } from 'lucide-react';

// --- Types & Constants ---
interface MenuItem { id: string; name: string; price: number; duration: string; vvipPrice?: number; vvipIncluded?: boolean; }
interface Booking { id?: string; name: string; phone: string; service: string; therapist: string; date: string; time: string; paymentMethod: string; txId: string; totalPrice: number; status: 'pending' | 'approved'; createdAt: number; }

const THEME = {
  primary: '#123524',
  gold: '#D4AF37',
  textGray: '#4a5568'
};

const MENU_CATEGORIES = [
  { id: 'massage', title: 'Massage', icon: Sparkles, items: [
    { id: 'm1', name: 'Traditional Massage', price: 25000, vvipPrice: 35000, duration: '60 Mins' },
    { id: 'm2', name: 'Traditional Massage', price: 37000, vvipPrice: 52500, duration: '90 Mins' },
    { id: 'm3', name: 'Oil Massage', price: 25000, vvipPrice: 35000, duration: '60 Mins' },
    { id: 'm4', name: 'Oil Massage', price: 37000, vvipPrice: 52500, duration: '90 Mins' },
    { id: 'm5', name: 'Aromatherapy Massage', price: 30000, vvipPrice: 40000, duration: '60 Mins' },
    { id: 'm6', name: 'Aromatherapy Massage', price: 45000, vvipPrice: 60000, duration: '90 Mins' },
    { id: 'm7', name: 'Body Butter Lotion Massage', price: 35000, vvipPrice: 45000, duration: '60 Mins' },
    { id: 'm8', name: 'Body Butter Lotion Massage', price: 50000, vvipPrice: 67500, duration: '90 Mins' },
    { id: 'm9', name: 'Body to Body Massage', price: 55000, duration: '60 Mins', vvipIncluded: true },
    { id: 'm10', name: 'Body to Body Massage', price: 82000, duration: '90 Mins', vvipIncluded: true },
    { id: 'm11', name: 'Four Hands Massage', price: 70000, duration: '60 Mins', vvipIncluded: true },
    { id: 'm12', name: 'Four Hands Massage', price: 104000, duration: '90 Mins', vvipIncluded: true },
    { id: 'm13', name: 'Lotion Candle Massage', price: 55000, duration: '60 Mins', vvipIncluded: true },
    { id: 'm14', name: 'Lotion Candle Massage', price: 82000, duration: '90 Mins', vvipIncluded: true },
  ]},
  { id: 'scrub', title: 'Body Scrub', icon: Droplets, items: [
    { id: 's1', name: 'Body Scrub & Bath Only', price: 70000, duration: '60 Mins', vvipIncluded: true },
    { id: 's2', name: 'Body Scrub & Lotion Massage', price: 80000, duration: '120 Mins', vvipIncluded: true },
  ]},
  { id: 'waxing', title: 'Waxing', icon: Scissors, items: [
    { id: 'w1', name: 'Arm Wax', price: 20000, duration: '' }, { id: 'w2', name: 'Underarm Wax', price: 25000, duration: '' },
    { id: 'w3', name: 'Half Leg Wax', price: 30000, duration: '' }, { id: 'w4', name: 'Full Leg Wax', price: 45000, duration: '' },
    { id: 'w5', name: 'Bikini Wax', price: 35000, duration: '' }, { id: 'w6', name: 'Brazilian Wax', price: 50000, duration: '' },
  ]},
  { id: 'hotel', title: 'Hotel & Home Services', icon: Home, items: [
    { id: 'h1', name: 'Part Time Outcall Service', price: 70000, duration: '100 Mins' },
    { id: 'h2', name: 'Half Day Service', price: 100000, duration: '6:00 AM - 12:00 PM / 12:00 PM - 6:00 PM' },
    { id: 'h3', name: 'The Whole Night Service', price: 120000, duration: '8:00 PM - 8:00 AM' },
    { id: 'h4', name: 'The Whole Day Service', price: 180000, duration: '7:00 AM - 7:00 PM' },
  ]}
];

const TIME_SLOTS = ["9:00 AM", "9:30 AM", "10:00 AM", "10:30 AM", "11:00 AM", "11:30 AM", "12:00 PM", "12:30 PM", "1:00 PM", "1:30 PM", "2:00 PM", "2:30 PM", "3:00 PM", "3:30 PM", "4:00 PM", "4:30 PM", "5:00 PM", "5:30 PM", "6:00 PM", "6:30 PM", "7:00 PM", "7:30 PM", "8:00 PM"];
const formatPrice = (price: number) => price.toLocaleString() + ' Ks';

export default function App() {
  const [isAdminMode, setIsAdminMode] = useState(false);
  useEffect(() => { const searchParams = new URLSearchParams(window.location.search); if (searchParams.get('mode') === 'admin') setIsAdminMode(true); }, []);

  return (
    <div className="min-h-screen bg-gray-50 text-gray-800 font-sans pb-10">
      <header className="bg-white shadow-sm py-6 px-4 text-center border-b border-gray-200">
        <h1 className="text-2xl font-bold tracking-wider" style={{ color: THEME.primary }}>The Shangri-La</h1>
        <p className="text-xs mt-1 font-semibold uppercase tracking-widest" style={{ color: THEME.gold }}>Men's Retreat (Beyond Relaxation) </p>
      </header>
      <main className="max-w-3xl mx-auto p-4 py-8">{isAdminMode ? <AdminDashboard /> : <CustomerBooking />}</main>
    </div>
  );
}

function CustomerBooking() {
  const [step, setStep] = useState(1);
  // ဝင်ဝင်ချင်း ဘယ် Category မှ ဖြဲမထားအောင် null လို့ သတ်မှတ်လိုက်သည်
  const [activeCategory, setActiveCategory] = useState<string | null>(null); 
  const [formData, setFormData] = useState({ name: '', phone: '', selectedItem: null as MenuItem | null, isVvipUpgrade: false, therapist: '', date: '', time: '', paymentMethod: '', txId: '' });
  const [loading, setLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [copiedText, setCopiedText] = useState('');

  const today = new Date(); const maxD = new Date(); maxD.setDate(maxD.getDate() + 3);
  const minDateStr = today.toISOString().split('T')[0];
  const maxDateStr = maxD.toISOString().split('T')[0];

  const handleCopy = (text: string) => { navigator.clipboard.writeText(text); setCopiedText(text); setTimeout(() => setCopiedText(''), 2000); };
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setFormData({ ...formData, [e.target.name]: e.target.value });
  const calculateTotal = () => { if (!formData.selectedItem) return 0; return formData.isVvipUpgrade && formData.selectedItem.vvipPrice ? formData.selectedItem.vvipPrice : formData.selectedItem.price; };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.txId.length !== 6) { alert("Transaction ID နောက်ဆုံး ၆ လုံးကို မှန်ကန်စွာ ဖြည့်ပေးပါ။"); return; }
    setLoading(true);
    try {
      const dataToSave = { name: formData.name, phone: formData.phone, service: `${formData.selectedItem?.name} ${formData.selectedItem?.duration ? `(${formData.selectedItem.duration})` : ''} ${formData.isVvipUpgrade ? '+ VVIP Upgrade' : ''} ${formData.selectedItem?.vvipIncluded ? '(VVIP Included)' : ''}`, therapist: formData.therapist, date: formData.date, time: formData.time, paymentMethod: formData.paymentMethod, txId: formData.txId, totalPrice: calculateTotal(), status: 'pending', createdAt: Date.now() };
      await addDoc(collection(db, 'bookings'), dataToSave);
      setSuccessMsg('Booking အောင်မြင်စွာ တင်ပြီးပါပြီ။ ငွေလွှဲမှတ်တမ်းကို စစ်ဆေးပြီး Admin မှ မကြာမီ အတည်ပြုပေးပါမည်။');
      setStep(1); setFormData({ name: '', phone: '', selectedItem: null, isVvipUpgrade: false, therapist: '', date: '', time: '', paymentMethod: '', txId: '' }); setActiveCategory(null);
    } catch (error) { console.error("Error adding document: ", error); alert("Booking တင်ရာတွင် အခက်အခဲရှိနေပါသည်။"); }
    setLoading(false);
  };

  const renderStepper = () => {
    const steps = [ { num: 1, label: 'SERVICE', icon: Sparkles }, { num: 2, label: 'THERAPIST', icon: User }, { num: 3, label: 'DATE & TIME', icon: Calendar }, { num: 4, label: 'CONFIRM', icon: CreditCard } ];
    return (
      <div className="flex items-center justify-center mb-10 w-full max-w-lg mx-auto">
        {steps.map((s, idx) => {
          const isCompleted = step > s.num;
          const isActive = step === s.num;
          return (
            <React.Fragment key={s.num}>
              <div className="flex flex-col items-center relative z-10">
                <div className={`w-12 h-12 rounded-full flex items-center justify-center transition-all duration-300 border-2 ${
                  isCompleted ? 'bg-[#D4AF37] border-[#D4AF37] text-white' : isActive ? 'bg-[#123524] border-[#123524] text-white' : 'bg-white border-gray-200 text-gray-400'
                }`}>
                  {isCompleted ? <Check className="w-6 h-6" /> : <s.icon className="w-5 h-5" />}
                </div>
                <span className={`text-[10px] uppercase tracking-wider font-bold mt-2 absolute -bottom-5 w-24 text-center ${isActive ? 'text-[#123524]' : 'text-gray-400'}`}>{s.label}</span>
              </div>
              {idx < steps.length - 1 && <div className={`flex-1 h-[2px] mx-1 transition-colors duration-300 ${isCompleted ? 'bg-[#D4AF37]' : 'bg-gray-200'}`} />}
            </React.Fragment>
          );
        })}
      </div>
    );
  };

  return (
    <div className="max-w-2xl mx-auto">
      {renderStepper()}
      {step === 1 && (
        <div className="animate-fade-in">
          <div className="text-center mb-8">
            <h2 className="text-2xl font-bold" style={{ color: THEME.primary }}>Choose Your Service</h2>
            {/* မြန်မာစာကို အဝါရောင် အထူ (Bold) ဖြင့် ပြောင်းထားပါသည် */}
            <p className="text-sm font-bold mt-2" style={{ color: THEME.gold }}>(သင်ရယူလိုသော ဝန်ဆောင်မှုအမျိုးအစားကို အရင်ရွေးချယ်ပါ)</p>
          </div>
          <div className="space-y-4">{MENU_CATEGORIES.map(category => (
            <div key={category.id} className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
              <div onClick={() => setActiveCategory(activeCategory === category.id ? null : category.id)} className="p-4 flex items-center justify-between cursor-pointer hover:bg-gray-50 transition">
                <div className="flex items-center text-sm font-bold" style={{ color: THEME.primary }}><category.icon className="w-5 h-5 mr-3" style={{ color: THEME.gold }} /> {category.title}</div>
                {/* မြှားလေးများကို အစိမ်းရင့်ရောင်ဖြင့် ပိုမိုထင်ရှားအောင် ပြင်ထားပါသည် */}
                {activeCategory === category.id ? <ChevronUp className="w-6 h-6" style={{ color: THEME.primary }} /> : <ChevronDown className="w-6 h-6" style={{ color: THEME.primary }} />}
              </div>
              {activeCategory === category.id && (
                <div className="p-2 border-t border-gray-100 bg-gray-50/50">{category.items.map(s => (
                  <div key={s.id} onClick={() => setFormData({...formData, selectedItem: s, isVvipUpgrade: false})} className={`flex justify-between items-center p-4 my-2 mx-2 rounded-lg cursor-pointer border transition-all duration-200 ${formData.selectedItem?.id === s.id ? 'border-yellow-500 bg-yellow-50 shadow-sm' : 'border-gray-200 bg-white hover:border-yellow-400'}`}>
                    <div><div className="font-bold text-gray-800 text-sm">{s.name}</div>{s.duration && <div className="text-xs text-gray-500 mt-1">{s.duration}</div>}</div>
                    <div className="font-bold text-sm" style={{ color: THEME.primary }}>{formatPrice(s.price)}</div>
                  </div>
                ))}</div>
              )}
            </div>
          ))}</div>
          <div className="bg-yellow-50 rounded-xl p-4 border border-yellow-200 mt-6 flex justify-between items-center shadow-sm">
            <div className="flex items-center"><div className="w-10 h-10 bg-yellow-100 rounded-lg flex items-center justify-center mr-4"><Crown className="w-5 h-5" style={{ color: THEME.gold }} /></div><div><div className="font-bold text-yellow-800 text-sm">VVIP Master Room</div><div className="text-xs text-yellow-600 font-semibold mt-1">{formData.selectedItem?.vvipIncluded ? '✅ Included (Free)' : (!formData.selectedItem ? 'Select a service' : (formData.selectedItem.vvipPrice ? 'Upgrade for extra comfort' : 'Not available'))}</div></div></div>
            {formData.selectedItem?.vvipIncluded ? <span className="bg-green-100 text-green-700 px-3 py-1 rounded-full text-xs font-bold border border-green-200">INCLUDED</span> : <button type="button" disabled={!formData.selectedItem?.vvipPrice} onClick={() => setFormData({...formData, isVvipUpgrade: !formData.isVvipUpgrade})} className={`w-12 h-6 rounded-full p-1 transition-colors duration-300 ${formData.isVvipUpgrade ? 'bg-green-600' : 'bg-gray-300'} ${!formData.selectedItem?.vvipPrice ? 'opacity-50' : ''}`}><div className={`w-4 h-4 bg-white rounded-full shadow-md transform transition-transform ${formData.isVvipUpgrade ? 'translate-x-6' : 'translate-x-0'}`} /></button>}
          </div>
          <div className="mt-8 flex justify-end"><button disabled={!formData.selectedItem} onClick={() => setStep(2)} className="px-8 py-4 rounded-lg font-bold text-white transition disabled:opacity-50 shadow-md hover:opacity-90 flex items-center" style={{ backgroundColor: THEME.primary }}>CONTINUE <ChevronRight className="w-5 h-5 ml-2" /></button></div>
        </div>
      )}
      {step === 2 && (
        <div className="animate-fade-in">
          <div className="text-center mb-8">
            <h2 className="text-2xl font-bold" style={{ color: THEME.primary }}>Select Your Therapist</h2>
            {/* မြန်မာစာကို အဝါရောင် အထူ (Bold) ဖြင့် ပြောင်းထားပါသည် */}
            <p className="text-sm font-bold mt-2" style={{ color: THEME.gold }}>(ဘိုကင်ယူထားလိုသော ဝန်ထမ်းနံပါတ်ကို ရွေးချယ်ပါ)</p>
          </div>
          <div onClick={() => setFormData({...formData, therapist: 'Any Available Therapist'})} className={`flex items-center p-4 mb-6 rounded-xl cursor-pointer border transition-all duration-200 ${formData.therapist === 'Any Available Therapist' ? 'border-yellow-500 bg-yellow-50 shadow-sm' : 'border-gray-200 bg-white hover:border-yellow-400'}`}><div className="w-12 h-12 bg-gray-200 rounded-full flex items-center justify-center mr-4"><User className="w-6 h-6 text-gray-500" /></div><div><div className="font-bold text-gray-800">Any Available Therapist</div><div className="text-xs text-gray-500 mt-1">We'll assign the best available therapist for you</div></div></div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">{Array.from({ length: 15 }, (_, i) => { const name = `Therapist No-${i+1}`; return (<div key={i} onClick={() => setFormData({...formData, therapist: name})} className={`flex flex-col items-center p-4 rounded-xl cursor-pointer border transition-all ${formData.therapist === name ? 'border-yellow-500 bg-yellow-50 shadow-md transform scale-105' : 'border-gray-200 bg-white hover:border-yellow-400'}`}><div className="w-16 h-16 rounded-full mb-3 flex items-center justify-center text-white overflow-hidden" style={{ backgroundColor: THEME.primary }}><User className="w-8 h-8 opacity-80" /></div><div className="font-bold text-sm text-gray-800 text-center">{name}</div></div>) })}</div>
          <div className="mt-8 flex justify-between"><button onClick={() => setStep(1)} className="px-6 py-4 rounded-lg font-bold text-gray-600 bg-white border border-gray-300 hover:bg-gray-50 transition">BACK</button><button disabled={!formData.therapist} onClick={() => setStep(3)} className="px-8 py-4 rounded-lg font-bold text-white transition disabled:opacity-50 shadow-md hover:opacity-90" style={{ backgroundColor: THEME.primary }}>CONTINUE</button></div>
        </div>
      )}
      {step === 3 && (
        <div className="animate-fade-in">
          <div className="text-center mb-8">
            <h2 className="text-2xl font-bold" style={{ color: THEME.primary }}>Pick Date & Time</h2>
            {/* မြန်မာစာကို အဝါရောင် အထူ (Bold) ဖြင့် ပြောင်းထားပါသည် */}
            <p className="text-sm font-bold mt-2" style={{ color: THEME.gold }}>(ဘိုကင်ရယူလိုသော နေ့ရက် နှင့် အချိန် ကို ရွေးချယ် ပါ)</p>
          </div>
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 mb-6"><label className="block mb-2 text-sm font-bold flex items-center" style={{ color: THEME.primary }}><Calendar className="w-4 h-4 mr-2" style={{ color: THEME.primary }}/> Select Date</label><input type="date" min={minDateStr} max={maxDateStr} value={formData.date} onChange={(e) => setFormData({...formData, date: e.target.value, time: ''})} className="w-full p-4 border border-gray-200 rounded-lg focus:outline-none focus:border-yellow-500 text-gray-800 bg-gray-50 mb-6" /><label className="block mb-4 text-sm font-bold flex items-center" style={{ color: THEME.primary }}><Clock className="w-4 h-4 mr-2" style={{ color: THEME.primary }}/> Available Times</label><div className="grid grid-cols-3 sm:grid-cols-4 gap-3">{TIME_SLOTS.map(t => (<button key={t} type="button" disabled={!formData.date} onClick={() => setFormData({...formData, time: t})} className={`py-3 px-2 text-xs sm:text-sm font-bold rounded-lg border transition-all ${formData.time === t ? 'border-yellow-500 bg-yellow-50 text-yellow-700 shadow-sm' : 'border-gray-200 bg-white text-gray-600 hover:border-yellow-400 disabled:opacity-40 disabled:hover:border-gray-200 disabled:cursor-not-allowed'}`}>{t}</button>))}</div></div>
          <div className="mt-8 flex justify-between"><button onClick={() => setStep(2)} className="px-6 py-4 rounded-lg font-bold text-gray-600 bg-white border border-gray-300 hover:bg-gray-50 transition">BACK</button><button disabled={!formData.date || !formData.time} onClick={() => setStep(4)} className="px-8 py-4 rounded-lg font-bold text-white transition disabled:opacity-50 shadow-md hover:opacity-90" style={{ backgroundColor: THEME.primary }}>CONTINUE</button></div>
        </div>
      )}
      {step === 4 && (
        <form onSubmit={handleSubmit} className="animate-fade-in pb-10">
          <div className="text-center mb-8">
            <h2 className="text-2xl font-bold" style={{ color: THEME.primary }}>Confirm Booking</h2>
            {/* မြန်မာစာကို အဝါရောင် အထူ (Bold) ဖြင့် ပြောင်းထားပါသည် */}
            <p className="text-sm font-bold mt-2" style={{ color: THEME.gold }}>(သင်ရွေးချယ်ခဲ့သော ဘိုကင်မှတ်တမ်းအား ပြန်လည်စစ်ဆေးပြီး စရံငွေကြိုတင်ပေးချေကာ ဘိုကင်ကို အတည်ပြုပေးပါ)</p>
          </div>
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 mb-6"><h3 className="text-xs font-bold tracking-widest uppercase mb-5" style={{ color: THEME.gold }}>Booking Summary</h3><div className="space-y-4"><div className="flex justify-between items-start"><div><div className="font-bold text-gray-800 flex items-center"><Activity className="w-4 h-4 mr-2 text-yellow-600"/>{formData.selectedItem?.name}</div><div className="text-sm text-gray-500 ml-6">{formData.selectedItem?.duration}</div></div><div className="font-bold text-gray-800 text-sm">{formatPrice(formData.selectedItem?.price || 0)}</div></div>{formData.isVvipUpgrade && formData.selectedItem?.vvipPrice && (<div className="flex justify-between items-start pt-2 border-t border-gray-50"><div className="font-bold flex items-center text-sm" style={{ color: THEME.gold }}><Crown className="w-4 h-4 mr-2" style={{ color: THEME.gold }}/>VVIP Room Extra Fee</div><div className="font-bold text-sm" style={{ color: THEME.gold }}>+{formatPrice(formData.selectedItem.vvipPrice - formData.selectedItem.price)}</div></div>)}{formData.selectedItem?.vvipIncluded && (<div className="flex justify-between items-start pt-2 border-t border-gray-50"><div className="font-bold text-green-600 flex items-center text-sm"><Crown className="w-4 h-4 mr-2 text-green-500"/>VVIP Master Room</div><div className="font-bold text-green-600 text-sm bg-green-50 px-2 py-0.5 rounded">Included (Free)</div></div>)}<div className="flex items-center text-sm font-bold text-gray-700 pt-2 border-t border-gray-50"><User className="w-4 h-4 mr-2" style={{ color: THEME.gold }}/> {formData.therapist}</div><div className="flex items-center text-sm font-bold text-gray-700"><Calendar className="w-4 h-4 mr-2" style={{ color: THEME.gold }}/> {formData.date} at {formData.time}</div></div><div className="mt-6 pt-4 border-t-2 border-gray-100 flex justify-between items-center"><span className="font-bold text-gray-800">Total Price</span><span className="text-xl font-bold" style={{ color: THEME.gold }}>{formatPrice(calculateTotal())}</span></div></div>
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 mb-6"><h3 className="text-xs font-bold tracking-widest uppercase mb-4" style={{ color: THEME.gold }}>Your Information</h3><div className="space-y-4"><div><label className="block mb-1 text-sm font-semibold text-gray-700">Full Name</label><input required type="text" name="name" value={formData.name} onChange={handleChange} placeholder="e.g. Aung Aung" className="w-full p-3 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:border-yellow-500 text-gray-800" /></div><div><label className="block mb-1 text-sm font-semibold text-gray-700">Phone Number</label><input required type="tel" name="phone" value={formData.phone} onChange={handleChange} placeholder="e.g. 09-xxxxxxxxx" className="w-full p-3 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:border-yellow-500 text-gray-800" /></div></div></div>
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 mb-6"><h3 className="text-xs font-bold tracking-widest uppercase mb-4 flex items-center" style={{ color: THEME.primary }}><CreditCard className="w-4 h-4 mr-2" style={{ color: THEME.primary }}/> Deposit Payment</h3><div className="mb-4"><label className="block mb-2 text-sm font-semibold text-gray-700">ငွေလွှဲမည့် စနစ် ရွေးချယ်ရန်</label><select required name="paymentMethod" value={formData.paymentMethod} onChange={handleChange} className="w-full p-3 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:border-yellow-500 text-gray-800 font-bold"><option value="">-- ရွေးချယ်ပါ --</option><option value="KBZ PAY">KBZ PAY</option><option value="Wave PAY">Wave PAY</option><option value="AYA PAY">AYA PAY</option><option value="UAB PAY">UAB PAY</option></select></div>{formData.paymentMethod && (<div className="bg-yellow-50 p-5 rounded-lg mb-5 border border-yellow-200 animate-fade-in"><p className="text-sm text-gray-700 mb-4 leading-relaxed">Booking အတည်ပြုနိုင်ရန် အတွက် <strong className="text-yellow-700 font-bold">ကျသင့်ငွေ၏ တစ်ဝက်တိတိကို ({formatPrice(calculateTotal()/2)})</strong> စရံငွေ အဖြစ် အောက်ပါ {formData.paymentMethod} အကောင့်သို့ ကြိုလွှဲပေးပါရန် မေတ္တာရပ်ခံအပ်ပါသည်။</p><div className="flex flex-col space-y-3 bg-white p-4 rounded-md border border-yellow-100"><div className="flex items-center justify-between sm:justify-start"><span className="text-gray-500 text-sm w-16 inline-block">အကောင့်:</span> <strong className="tracking-widest text-gray-800 text-lg sm:mr-4">09458888510</strong><button type="button" onClick={() => handleCopy('09458888510')} className="flex items-center px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-xs font-bold text-gray-700 rounded transition"><Copy className="w-3 h-3 mr-1" /> {copiedText === '09458888510' ? 'Copied!' : 'Copy'}</button></div><div className="flex items-center justify-between sm:justify-start"><span className="text-gray-500 text-sm w-16 inline-block">အမည်:</span> <strong className="text-gray-800 text-lg sm:mr-4">Htet Naing Kyaw</strong><button type="button" onClick={() => handleCopy('Htet Naing Kyaw')} className="flex items-center px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-xs font-bold text-gray-700 rounded transition"><Copy className="w-3 h-3 mr-1" /> {copiedText === 'Htet Naing Kyaw' ? 'Copied!' : 'Copy'}</button></div></div></div>)}<div><label className="block mb-2 text-sm font-bold" style={{ color: THEME.gold }}>စရံငွေပေးချေမှု ပြုလုပ်ပြီးပါက ငွေလွှဲပြေစာတွင်ပါဝင်သော ငွေလွှဲ Transaction ID (နောက်ဆုံး ၆ လုံး) ကို အောက်မှာရိုက်ထည့်ပေးပါ</label><input required type="text" name="txId" maxLength={6} minLength={6} placeholder="e.g. 123456" value={formData.txId} onChange={handleChange} className="w-full p-4 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:border-yellow-500 text-center text-2xl tracking-[0.5em] font-bold text-gray-800" /></div></div>
          <div className="mt-8 flex justify-between"><button type="button" onClick={() => setStep(3)} className="px-6 py-4 rounded-lg font-bold text-gray-600 bg-white border border-gray-300 hover:bg-gray-50 transition">BACK</button><button disabled={loading || !formData.paymentMethod} type="submit" className="px-8 py-4 rounded-lg font-bold text-white transition disabled:opacity-50 shadow-lg flex-1 ml-4 flex justify-center items-center hover:opacity-90" style={{ backgroundColor: THEME.primary }}>{loading ? 'PROCESSING...' : 'CONFIRM BOOKING'}</button></div>
        </form>
      )}
    </div>
  );
}

// ==========================================
// 2. ADMIN DASHBOARD
// ==========================================
function AdminDashboard() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const fetchBookings = async () => { try { const q = query(collection(db, 'bookings'), orderBy('createdAt', 'desc')); const querySnapshot = await getDocs(q); const data: Booking[] = []; querySnapshot.forEach((doc) => { data.push({ id: doc.id, ...doc.data() } as Booking); }); setBookings(data); } catch (error) { console.error("Error fetching bookings: ", error); } setLoading(false); };
  useEffect(() => { fetchBookings(); }, []);
  const handleApprove = async (id: string) => { if(window.confirm('ဤ Booking ကို အတည်ပြုမည် သေချာပါသလား?')) { await updateDoc(doc(db, 'bookings', id), { status: 'approved' }); fetchBookings(); } };
  const handleDelete = async (id: string) => { if(window.confirm('ဤ Booking ကို ဖျက်မည် သေချာပါသလား?')) { await deleteDoc(doc(db, 'bookings', id)); fetchBookings(); } };
  if (loading) return <div className="text-center py-20 text-gray-500 font-bold">Loading Dashboard...</div>;
  return (
    <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200 animate-fade-in">
      <div className="flex justify-between items-center mb-8 border-b border-gray-100 pb-4"><h2 className="text-2xl font-bold flex items-center" style={{ color: THEME.primary }}><ShieldCheck className="mr-2 text-yellow-500"/> Admin Dashboard</h2><span className="bg-yellow-100 text-yellow-700 px-4 py-1 rounded-full text-sm font-bold border border-yellow-200">Total: {bookings.length}</span></div>
      <div className="overflow-x-auto"><table className="w-full text-left border-collapse"><thead><tr className="border-b-2 border-gray-100 text-xs text-gray-500 uppercase tracking-wider"><th className="p-3 pb-4">Customer</th><th className="p-3 pb-4">Service & Therapist</th><th className="p-3 pb-4">Date & Time</th><th className="p-3 pb-4">TxID & Total</th><th className="p-3 pb-4">Status</th><th className="p-3 pb-4 text-right">Actions</th></tr></thead><tbody>{bookings.length === 0 && (<tr><td colSpan={6} className="p-10 text-center text-gray-400">Booking မရှိသေးပါ။</td></tr>)}{bookings.map((b) => (<tr key={b.id} className="border-b border-gray-50 hover:bg-gray-50 transition"><td className="p-3"><div className="font-bold text-gray-800">{b.name}</div><div className="text-xs text-gray-500">{b.phone}</div></td><td className="p-3"><div className="font-bold text-sm text-gray-800">{b.service}</div><div className="text-xs text-gray-500 mt-1 flex items-center"><User className="w-3 h-3 mr-1"/>{b.therapist}</div></td><td className="p-3 text-sm text-gray-700"><div className="font-semibold">{b.date}</div><div className="text-gray-500 text-xs mt-1">{b.time}</div></td><td className="p-3"><div className="font-mono font-bold text-gray-800">{b.txId}</div><div className="text-[10px] uppercase tracking-wider font-bold text-yellow-600 mt-1">{b.paymentMethod} • {formatPrice(b.totalPrice)}</div></td><td className="p-3">{b.status === 'pending' ? <span className="bg-yellow-100 text-yellow-700 px-2 py-1 rounded text-xs font-bold border border-yellow-200">Pending</span> : <span className="bg-green-100 text-green-700 px-2 py-1 rounded text-xs font-bold border border-green-200">Approved</span>}</td><td className="p-3 text-right"><div className="flex justify-end space-x-2">{b.status === 'pending' && (<button onClick={() => handleApprove(b.id!)} className="p-2 bg-green-100 text-green-700 rounded-lg hover:bg-green-200 transition" title="Approve"><CheckCircle className="w-5 h-5" /></button>)}<button onClick={() => handleDelete(b.id!)} className="p-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition" title="Delete"><Trash2 className="w-5 h-5" /></button></div></td></tr>))}</tbody></table></div>
    </div>
  );
}
