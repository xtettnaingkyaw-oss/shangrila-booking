import React, { useState, useEffect } from 'react';
import { collection, addDoc, getDocs, updateDoc, deleteDoc, doc, query, orderBy } from 'firebase/firestore';
import { db } from './firebase'; // Make sure to configure this file
import { Calendar, Clock, CreditCard, CheckCircle, Trash2, User, Phone, ShieldCheck, Activity, Copy } from 'lucide-react';

// --- Types ---
interface Booking {
  id?: string;
  name: string;
  phone: string;
  service: string;
  therapist: string;
  date: string;
  time: string;
  paymentMethod: string;
  txId: string;
  status: 'pending' | 'approved';
  createdAt: number;
}

// --- Constants ---
const SERVICES = [
  { id: 'massage', name: 'Massage', price: '30,000 Ks', duration: '60 mins' },
  { id: 'scrub', name: 'Body Scrub', price: '25,000 Ks', duration: '45 mins' },
  { id: 'waxing', name: 'Waxing', price: '15,000 Ks', duration: '30 mins' },
  { id: 'home', name: 'Hotel & Home Services', price: '50,000 Ks', duration: '90 mins' },
];

// --- 12-hour Format Time Slots ---
const TIME_SLOTS = [
  "9:00 AM", "9:30 AM", "10:00 AM", "10:30 AM", "11:00 AM", "11:30 AM", 
  "12:00 PM", "12:30 PM", "1:00 PM", "1:30 PM", "2:00 PM", "2:30 PM", 
  "3:00 PM", "3:30 PM", "4:00 PM", "4:30 PM", "5:00 PM", "5:30 PM", 
  "6:00 PM", "6:30 PM", "7:00 PM", "7:30 PM", "8:00 PM"
];

export default function App() {
  const [isAdminMode, setIsAdminMode] = useState(false);

  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search);
    if (searchParams.get('mode') === 'admin') {
      setIsAdminMode(true);
    }
  }, []);

  return (
    <div className="min-h-screen bg-[#064E3B] text-[#D4AF37] font-sans">
      <header className="bg-[#022c22] shadow-lg py-6 px-4 text-center border-b border-[#D4AF37]/30">
        <h1 className="text-3xl font-bold tracking-wider">The Shangri-La Men's Retreat</h1>
        <p className="text-sm mt-2 opacity-80 uppercase tracking-widest">Premium Care & Wellness</p>
      </header>

      <main className="max-w-4xl mx-auto p-4 py-8">
        {isAdminMode ? <AdminDashboard /> : <CustomerBooking />}
      </main>
    </div>
  );
}

// ==========================================
// 1. CUSTOMER BOOKING SYSTEM
// ==========================================
function CustomerBooking() {
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    service: '',
    therapist: '',
    date: '',
    time: '',
    paymentMethod: '',
    txId: ''
  });
  const [loading, setLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [copiedText, setCopiedText] = useState('');

  // Calculate Max 3 Days Date Range
  const today = new Date();
  const maxD = new Date();
  maxD.setDate(maxD.getDate() + 3);
  
  const minDateStr = today.toISOString().split('T')[0];
  const maxDateStr = maxD.toISOString().split('T')[0];

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedText(text);
    setTimeout(() => setCopiedText(''), 2000);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.txId.length !== 6) {
      alert("Transaction ID နောက်ဆုံး ၆ လုံးကို မှန်ကန်စွာ ဖြည့်ပေးပါ။");
      return;
    }
    // အချိန် (Time Slot) မရွေးထားလျှင် သတိပေးရန်
    if (!formData.time) {
      alert("ကျေးဇူးပြု၍ Appointment ရယူမည့် အချိန်ကို ရွေးချယ်ပါ။");
      return;
    }

    setLoading(true);
    try {
      await addDoc(collection(db, 'bookings'), {
        ...formData,
        status: 'pending',
        createdAt: Date.now()
      });
      setSuccessMsg('Booking အောင်မြင်စွာ တင်ပြီးပါပြီ။ ငွေလွှဲမှတ်တမ်းကို စစ်ဆေးပြီး Admin မှ မကြာမီ အတည်ပြုပေးပါမည်။');
      setFormData({ name: '', phone: '', service: '', therapist: '', date: '', time: '', paymentMethod: '', txId: '' });
    } catch (error) {
      console.error("Error adding document: ", error);
      alert("Booking တင်ရာတွင် အခက်အခဲရှိနေပါသည်။");
    }
    setLoading(false);
  };

  if (successMsg) {
    return (
      <div className="bg-[#022c22] p-8 rounded-lg border border-[#D4AF37] text-center shadow-xl">
        <CheckCircle className="w-16 h-16 mx-auto mb-4 text-green-500" />
        <h2 className="text-2xl font-bold mb-2">ကျေးဇူးတင်ပါသည်</h2>
        <p>{successMsg}</p>
        <button 
          onClick={() => setSuccessMsg('')} 
          className="mt-6 px-6 py-2 bg-[#D4AF37] text-[#064E3B] font-bold rounded hover:bg-yellow-500 transition"
        >
          နောက်ထပ် Booking တင်ရန်
        </button>
      </div>
    );
  }

  return (
    <div className="bg-[#022c22] p-6 rounded-lg border border-[#D4AF37]/50 shadow-2xl">
      <h2 className="text-2xl font-bold mb-6 text-center border-b border-[#D4AF37]/30 pb-4">Online Booking Appointment ရယူရန်</h2>
      
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Personal Info */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block mb-2 text-sm flex items-center"><User className="w-4 h-4 mr-2"/> အမည်</label>
            <input required type="text" name="name" value={formData.name} onChange={handleChange} 
              className="w-full p-3 bg-[#064E3B] border border-[#D4AF37]/50 rounded focus:outline-none focus:border-[#D4AF37] text-white" />
          </div>
          <div>
            <label className="block mb-2 text-sm flex items-center"><Phone className="w-4 h-4 mr-2"/> ဖုန်းနံပါတ်</label>
            <input required type="tel" name="phone" value={formData.phone} onChange={handleChange} 
              className="w-full p-3 bg-[#064E3B] border border-[#D4AF37]/50 rounded focus:outline-none focus:border-[#D4AF37] text-white" />
          </div>
        </div>

        {/* Services & Therapist */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block mb-2 text-sm flex items-center"><Activity className="w-4 h-4 mr-2"/> ဝန်ဆောင်မှု ရွေးချယ်ရန်</label>
            <select required name="service" value={formData.service} onChange={handleChange}
              className="w-full p-3 bg-[#064E3B] border border-[#D4AF37]/50 rounded focus:outline-none focus:border-[#D4AF37] text-white">
              <option value="">-- ဝန်ဆောင်မှု ရွေးပါ --</option>
              {SERVICES.map(s => (
                <option key={s.id} value={s.name}>{s.name} ({s.duration}) - {s.price}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block mb-2 text-sm flex items-center"><User className="w-4 h-4 mr-2"/> ဝန်ထမ်း ရွေးချယ်ရန်</label>
            <select required name="therapist" value={formData.therapist} onChange={handleChange}
              className="w-full p-3 bg-[#064E3B] border border-[#D4AF37]/50 rounded focus:outline-none focus:border-[#D4AF37] text-white">
              <option value="">-- ဝန်ထမ်း ရွေးပါ --</option>
              {Array.from({ length: 15 }, (_, i) => (
                <option key={i} value={`Therapist No-${i + 1}`}>
                  Therapist No-{i + 1}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Date Section (သီးသန့်ခွဲထုတ်ထားသည်) */}
        <div>
          <label className="block mb-2 text-sm flex items-center"><Calendar className="w-4 h-4 mr-2"/> ရက်စွဲ (အများဆုံး ၃ ရက် ကြိုတင်နိုင်သည်)</label>
          <input required type="date" name="date" min={minDateStr} max={maxDateStr} value={formData.date} onChange={handleChange} 
            className="w-full p-3 bg-[#064E3B] border border-[#D4AF37]/50 rounded focus:outline-none focus:border-[#D4AF37] text-white" />
        </div>

        {/* Time Slots Section (ခလုတ်အကွက်လေးများဖြင့်) */}
        <div className="bg-[#064E3B]/30 p-4 rounded border border-[#D4AF37]/30">
          <label className="block mb-3 text-sm flex items-center"><Clock className="w-4 h-4 mr-2"/> အချိန် ရွေးချယ်ရန်</label>
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3">
            {TIME_SLOTS.map(t => (
              <button
                key={t}
                type="button"
                onClick={() => setFormData({ ...formData, time: t })}
                className={`py-2 px-1 text-sm rounded transition-all duration-200 border ${
                  formData.time === t 
                    ? 'bg-[#D4AF37] text-[#022c22] border-[#D4AF37] font-bold shadow-md transform scale-105' 
                    : 'bg-[#022c22] text-gray-300 border-[#D4AF37]/30 hover:border-[#D4AF37] hover:text-white'
                }`}
              >
                {t}
              </button>
            ))}
          </div>
          {/* HTML Validation အတွက် ဖျောက်ထားသော Input */}
          <input type="text" name="time" value={formData.time} required className="absolute opacity-0 w-0 h-0 pointer-events-none" tabIndex={-1} />
        </div>

        {/* Payment Section */}
        <div className="bg-[#064E3B]/50 p-5 rounded border border-yellow-600/50 mt-6">
          <h3 className="font-bold flex items-center mb-4 text-yellow-500"><CreditCard className="w-5 h-5 mr-2"/> စရန်ငွေ လွှဲရန်</h3>
          
          <div className="mb-4">
            <label className="block mb-2 text-sm">ငွေလွှဲမည့် စနစ် ရွေးချယ်ရန် (Payment Method)</label>
            <select required name="paymentMethod" value={formData.paymentMethod} onChange={handleChange}
              className="w-full p-3 bg-[#022c22] border border-[#D4AF37]/50 rounded focus:outline-none focus:border-[#D4AF37] text-white">
              <option value="">-- ငွေလွှဲမည့် စနစ် ရွေးပါ --</option>
              <option value="KBZ PAY">KBZ PAY</option>
              <option value="Wave PAY">Wave PAY</option>
              <option value="AYA PAY">AYA PAY</option>
              <option value="UAB PAY">UAB PAY</option>
            </select>
          </div>

          {/* ရွေးချယ်လိုက်မှ ပေါ်လာမည့် အကောင့်အချက်အလက် */}
          {formData.paymentMethod && (
            <div className="bg-[#022c22] p-4 rounded mb-5 border border-green-700/50">
              <p className="text-sm text-gray-300 mb-4 leading-relaxed">
                Booking အတည်ပြုနိုင်ရန် အတွက် <strong className="text-yellow-400 font-bold">ကျသင့်ငွေ၏ တစ်ဝက်တိတိကို</strong> စရံငွေ အဖြစ် အောက်ပါ {formData.paymentMethod} အကောင့်သို့ ကြိုလွှဲပေးပါရန် မေတ္တာရပ်ခံအပ်ပါသည်။
              </p>
              
              <div className="flex flex-col space-y-3">
                <div className="flex items-center">
                  <span className="text-gray-400 text-sm w-16 inline-block">အကောင့်:</span> 
                  <strong className="tracking-widest text-yellow-400 text-lg mr-3">09458888510</strong>
                  <button 
                    type="button" 
                    onClick={() => handleCopy('09458888510')} 
                    className="flex items-center px-2 py-1 bg-green-800 hover:bg-green-700 text-xs rounded transition text-gray-200"
                    title="အကောင့်နံပါတ် Copy ကူးရန်"
                  >
                    <Copy className="w-3 h-3 mr-1" /> {copiedText === '09458888510' ? 'Copied!' : 'Copy'}
                  </button>
                </div>
                
                <div className="flex items-center">
                  <span className="text-gray-400 text-sm w-16 inline-block">အမည်:</span> 
                  <strong className="text-white text-lg mr-3">Htet Naing Kyaw</strong>
                  <button 
                    type="button" 
                    onClick={() => handleCopy('Htet Naing Kyaw')} 
                    className="flex items-center px-2 py-1 bg-green-800 hover:bg-green-700 text-xs rounded transition text-gray-200"
                    title="အမည် Copy ကူးရန်"
                  >
                    <Copy className="w-3 h-3 mr-1" /> {copiedText === 'Htet Naing Kyaw' ? 'Copied!' : 'Copy'}
                  </button>
                </div>
              </div>
            </div>
          )}

          <div>
            <label className="block mb-2 text-sm font-bold text-yellow-400">စရံငွေပေးချေမှု ပြုလုပ်ပြီးပါက ငွေလွှဲပြေစာတွင်ပါဝင်သော ငွေလွှဲ Transaction ID (နောက်ဆုံး ၆ လုံး) ကို အောက်မှာရိုက်ထည့်ပေးပါ</label>
            <input required type="text" name="txId" maxLength={6} minLength={6} placeholder="e.g. 123456" 
              value={formData.txId} onChange={handleChange} 
              className="w-full p-3 bg-[#022c22] border border-[#D4AF37]/50 rounded focus:outline-none focus:border-[#D4AF37] text-center text-xl tracking-widest text-white" />
          </div>
        </div>

        <button disabled={loading} type="submit" 
          className="w-full p-4 bg-[#D4AF37] text-[#064E3B] font-bold text-lg rounded hover:bg-yellow-500 transition shadow-lg flex justify-center items-center">
          {loading ? 'Booking တင်နေပါသည်...' : 'Booking အတည်ပြုမည်'}
        </button>
      </form>
    </div>
  );
}

// ==========================================
// 2. ADMIN DASHBOARD
// ==========================================
function AdminDashboard() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchBookings = async () => {
    try {
      const q = query(collection(db, 'bookings'), orderBy('createdAt', 'desc'));
      const querySnapshot = await getDocs(q);
      const data: Booking[] = [];
      querySnapshot.forEach((doc) => {
        data.push({ id: doc.id, ...doc.data() } as Booking);
      });
      setBookings(data);
    } catch (error) {
      console.error("Error fetching bookings: ", error);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchBookings();
  }, []);

  const handleApprove = async (id: string) => {
    if(window.confirm('ဤ Booking ကို အတည်ပြုမည် သေချာပါသလား?')) {
      await updateDoc(doc(db, 'bookings', id), { status: 'approved' });
      fetchBookings();
    }
  };

  const handleDelete = async (id: string) => {
    if(window.confirm('ဤ Booking ကို ဖျက်မည် သေချာပါသလား?')) {
      await deleteDoc(doc(db, 'bookings', id));
      fetchBookings();
    }
  };

  if (loading) return <div className="text-center py-10">Loading Dashboard...</div>;

  return (
    <div className="bg-[#022c22] p-6 rounded-lg border border-[#D4AF37]/50 shadow-2xl">
      <div className="flex justify-between items-center mb-6 border-b border-[#D4AF37]/30 pb-4">
        <h2 className="text-2xl font-bold flex items-center"><ShieldCheck className="mr-2"/> Admin Dashboard</h2>
        <span className="bg-[#D4AF37] text-[#064E3B] px-3 py-1 rounded text-sm font-bold">Total: {bookings.length}</span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-[#D4AF37]/50 text-sm">
              <th className="p-3">Customer</th>
              <th className="p-3">Service & Therapist</th>
              <th className="p-3">Date & Time</th>
              <th className="p-3">TxID & Payment</th>
              <th className="p-3">Status</th>
              <th className="p-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {bookings.length === 0 && (
              <tr><td colSpan={6} className="p-6 text-center text-gray-400">Booking မရှိသေးပါ။</td></tr>
            )}
            {bookings.map((b) => (
              <tr key={b.id} className="border-b border-[#064E3B] hover:bg-[#064E3B]/50 transition">
                <td className="p-3">
                  <div className="font-bold">{b.name}</div>
                  <div className="text-xs text-gray-400">{b.phone}</div>
                </td>
                <td className="p-3">
                  <div className="font-bold text-sm">{b.service}</div>
                  <div className="text-xs text-yellow-400">{b.therapist}</div>
                </td>
                <td className="p-3 text-sm">
                  <div>{b.date}</div>
                  <div className="text-gray-400">{b.time}</div>
                </td>
                <td className="p-3">
                  <div className="font-mono text-yellow-400">{b.txId}</div>
                  <div className="text-xs text-green-400 font-sans mt-1">{b.paymentMethod}</div>
                </td>
                <td className="p-3">
                  {b.status === 'pending' 
                    ? <span className="bg-yellow-600/20 text-yellow-500 px-2 py-1 rounded text-xs border border-yellow-600/50">Pending</span>
                    : <span className="bg-green-600/20 text-green-400 px-2 py-1 rounded text-xs border border-green-600/50">Approved</span>
                  }
                </td>
                <td className="p-3">
                  <div className="flex space-x-2">
                    {b.status === 'pending' && (
                      <button onClick={() => handleApprove(b.id!)} className="p-2 bg-green-700 rounded hover:bg-green-600 transition" title="Approve">
                        <CheckCircle className="w-4 h-4 text-white" />
                      </button>
                    )}
                    <button onClick={() => handleDelete(b.id!)} className="p-2 bg-red-800 rounded hover:bg-red-700 transition" title="Delete">
                      <Trash2 className="w-4 h-4 text-white" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
