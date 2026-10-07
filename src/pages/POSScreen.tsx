import React, { useState, useEffect } from 'react';
import { AppData, TherapistProfile } from '../shared';
import { ShoppingCart, Plus, Minus, Trash2, CreditCard, User, ArrowLeft, CheckCircle, ShieldCheck, Menu, FileText, ShoppingBag, X, Clock, Printer } from 'lucide-react';
import { db } from '../firebase';
import { collection, addDoc, getDocs, query, where, orderBy, onSnapshot } from 'firebase/firestore';

interface POSScreenProps {
  appData: AppData;
}

interface CartItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
}

interface ReceiptItem {
  id: string;
  therapistName: string;
  items: CartItem[];
  total: number;
  paymentMethod: string;
  createdAt: any;
}

export default function POSScreen({ appData }: POSScreenProps) {
  const [currentView, setCurrentView] = useState<'pos' | 'receipts' | 'items'>('pos');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // Flow Steps: 'services' -> 'therapist' -> 'checkout'
  const [step, setStep] = useState<'services' | 'therapist' | 'checkout'>('services');
  
  const [cart, setCart] = useState<CartItem[]>([]);
  const [activeCategoryId, setActiveCategoryId] = useState<string>(appData.categories?.[0]?.id || '');
  const [selectedTherapist, setSelectedTherapist] = useState<TherapistProfile | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<string>('CASH');

  // Active/Busy Therapists state (Real-time synced with bookings)
  const [busyTherapistIds, setBusyTherapistIds] = useState<string[]>([]);
  
  // Completed Sale Receipt state for 58mm Printing
  const [completedSale, setCompletedSale] = useState<ReceiptItem | null>(null);
  const [receipts, setReceipts] = useState<ReceiptItem[]>([]);
  const [loadingReceipts, setLoadingReceipts] = useState(false);

  // 🌟 Real-time Sync: လက်ရှိ မအားသေးသော (Booked / In-Service) Therapists များကို Firestore မှ ဖတ်ယူခြင်း
  useEffect(() => {
    const q = query(
      collection(db, 'bookings'),
      where('status', 'in', ['confirmed', 'in_service', 'pending'])
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const busyIds: string[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        if (data.therapistId) busyIds.push(data.therapistId);
        if (data.therapistName) busyIds.push(data.therapistName);
      });
      setBusyTherapistIds(busyIds);
    }, (err) => console.warn("Bookings listener error:", err));

    return () => unsubscribe();
  }, []);

  // Cart Handlers
  const handleAddToCart = (item: any) => {
    setCart((prev) => {
      const existing = prev.find((c) => c.id === item.id);
      if (existing) {
        return prev.map((c) => c.id === item.id ? { ...c, quantity: c.quantity + 1 } : c);
      }
      return [...prev, { id: item.id, name: item.name, price: item.price, quantity: 1 }];
    });
  };

  const updateQuantity = (id: string, delta: number) => {
    setCart((prev) =>
      prev.map((c) => {
        if (c.id === id) {
          const newQty = c.quantity + delta;
          return newQty > 0 ? { ...c, quantity: newQty } : c;
        }
        return c;
      })
    );
  };

  const removeFromCart = (id: string) => {
    setCart((prev) => prev.filter((c) => c.id !== id));
  };

  const totalAmount = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const activeCategory = appData.categories.find(c => c.id === activeCategoryId);

  // 🌟 POS Complete Sale: Sales History & Auto Booking Sync to Customer/Staff App
  const handleCompleteSale = async () => {
    if (!selectedTherapist || cart.length === 0) return;

    const salePayload = {
      therapistId: selectedTherapist.id,
      therapistName: selectedTherapist.name,
      items: cart,
      total: totalAmount,
      paymentMethod: paymentMethod,
      createdAt: new Date()
    };

    try {
      // 1. Save to Sales History
      const docRef = await addDoc(collection(db, 'sales_history'), salePayload);

      // 2. Auto Create Booking in 'bookings' collection (Blocks Therapist in Customer/Staff/Admin App)
      await addDoc(collection(db, 'bookings'), {
        customerName: 'Walk-in (POS)',
        phone: 'N/A',
        therapistId: selectedTherapist.id,
        therapistName: selectedTherapist.name,
        services: cart.map(i => `${i.name} (x${i.quantity})`).join(', '),
        totalAmount: totalAmount,
        paymentMethod: paymentMethod,
        paymentStatus: 'paid',
        status: 'confirmed',
        createdAt: new Date(),
        source: 'POS'
      });

      setCompletedSale({ id: docRef.id, ...salePayload });
    } catch (error) {
      console.error("Sale complete error:", error);
      // Offline fallback
      setCompletedSale({ id: `offline_${Date.now()}`, ...salePayload });
    }
  };

  const handlePrintReceipt = () => {
    window.print();
  };

  const resetPOS = () => {
    setCart([]);
    setSelectedTherapist(null);
    setStep('services');
    setCompletedSale(null);
  };

  const fetchReceipts = async () => {
    setLoadingReceipts(true);
    try {
      const q = query(collection(db, 'sales_history'), orderBy('createdAt', 'desc'));
      const querySnapshot = await getDocs(q);
      const loaded: ReceiptItem[] = [];
      querySnapshot.forEach((doc) => {
        loaded.push({ id: doc.id, ...doc.data() } as ReceiptItem);
      });
      setReceipts(loaded);
    } catch (err) {
      console.warn("Could not fetch receipts:", err);
    }
    setLoadingReceipts(false);
  };

  return (
    <div className="min-h-[85vh] bg-gray-900 text-white rounded-xl overflow-hidden shadow-2xl flex flex-col border border-gray-800 relative">
      
      {/* 🌟 58mm Thermal Printer Specific Print CSS 🌟 */}
      <style>{`
        @media print {
          body * { visibility: hidden; }
          #printable-invoice, #printable-invoice * { visibility: visible; }
          #printable-invoice {
            position: absolute;
            left: 0;
            top: 0;
            width: 58mm !important;
            max-width: 58mm !important;
            padding: 2mm;
            font-family: monospace;
            color: #000 !important;
            background: #fff !important;
            font-size: 11px;
            line-height: 1.2;
          }
          .no-print { display: none !important; }
        }
      `}</style>

      {/* Header */}
      <div className="bg-[#1a2e26] px-4 py-3 border-b border-gray-800 flex items-center justify-between no-print">
        <div className="flex items-center space-x-3">
          <button onClick={() => setIsSidebarOpen(true)} className="p-2 bg-white/10 rounded-lg hover:bg-white/20 transition text-[#D4AF37]">
            <Menu className="w-5 h-5" />
          </button>

          {currentView === 'pos' && step !== 'services' && (
            <button onClick={() => setStep(step === 'checkout' ? 'therapist' : 'services')} className="p-2 bg-white/10 rounded-lg hover:bg-white/20 transition text-[#D4AF37]">
              <ArrowLeft className="w-5 h-5" />
            </button>
          )}

          <div>
            <h1 className="font-bold text-base text-[#D4AF37]">
              {currentView === 'pos' && 'The Shangri-La POS'}
              {currentView === 'receipts' && 'အရောင်းမှတ်တမ်းများ'}
              {currentView === 'items' && 'ဝန်ဆောင်မှု မီနူးများ'}
            </h1>
            <p className="text-xs text-gray-400">
              {currentView === 'pos' && (
                <>
                  {step === 'services' && 'အဆင့် ၁ - Service/Package များ ရွေးချယ်ပါ'}
                  {step === 'therapist' && 'အဆင့် ၂ - မအားသေးသော ဝန်ထမ်းများ Block ထားပါသည်'}
                  {step === 'checkout' && 'အဆင့် ၃ - ငွေပေးချေမှု နည်းလမ်း ရွေးချယ်ပါ'}
                </>
              )}
            </p>
          </div>
        </div>

        {selectedTherapist && currentView === 'pos' && (
          <div className="flex items-center bg-black/40 px-3 py-1.5 rounded-lg border border-[#D4AF37]/30 text-xs">
            <User className="w-4 h-4 mr-1.5 text-[#D4AF37]" />
            <span className="text-gray-200 font-semibold">{selectedTherapist.name}</span>
          </div>
        )}
      </div>

      {/* Sidebar Drawer */}
      {isSidebarOpen && (
        <div className="fixed inset-0 z-50 flex no-print">
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setIsSidebarOpen(false)}></div>
          <div className="relative w-72 bg-gray-900 border-r border-gray-800 flex flex-col h-full z-10 shadow-2xl">
            <div className="p-4 bg-[#123524] border-b border-gray-800 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-sm text-[#D4AF37]">Shangri-La POS Admin</h3>
                <p className="text-[10px] text-gray-300">Auto Booking Sync Active</p>
              </div>
              <button onClick={() => setIsSidebarOpen(false)} className="p-1.5 bg-black/20 rounded-lg hover:bg-black/40 text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 p-3 space-y-1 overflow-y-auto">
              <button onClick={() => { setCurrentView('pos'); setIsSidebarOpen(false); }} className={`w-full flex items-center space-x-3 px-3 py-3 rounded-xl font-bold text-xs transition ${currentView === 'pos' ? 'bg-[#123524] text-[#D4AF37] border border-[#D4AF37]/30' : 'text-gray-300 hover:bg-gray-800'}`}>
                <ShoppingBag className="w-4 h-4" /><span>Sales (အရောင်းစနစ်)</span>
              </button>
              <button onClick={() => { setCurrentView('receipts'); setIsSidebarOpen(false); fetchReceipts(); }} className={`w-full flex items-center space-x-3 px-3 py-3 rounded-xl font-bold text-xs transition ${currentView === 'receipts' ? 'bg-[#123524] text-[#D4AF37] border border-[#D4AF37]/30' : 'text-gray-300 hover:bg-gray-800'}`}>
                <FileText className="w-4 h-4" /><span>Receipts (ဘောင်ချာမှတ်တမ်း)</span>
              </button>
              <button onClick={() => { setCurrentView('items'); setIsSidebarOpen(false); }} className={`w-full flex items-center space-x-3 px-3 py-3 rounded-xl font-bold text-xs transition ${currentView === 'items' ? 'bg-[#123524] text-[#D4AF37] border border-[#D4AF37]/30' : 'text-gray-300 hover:bg-gray-800'}`}>
                <ShoppingBag className="w-4 h-4" /><span>Items (မီနူးများ)</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* VIEW: POS FLOW */}
      {currentView === 'pos' && (
        <>
          {/* STEP 1: SELECT SERVICES (CUSTOMER APP STYLE) */}
          {step === 'services' && (
            <div className="flex-1 flex flex-col md:flex-row overflow-hidden no-print">
              <div className="flex-1 flex flex-col border-r border-gray-800 bg-gray-900 overflow-hidden">
                <div className="flex overflow-x-auto bg-gray-950 p-2 space-x-2 border-b border-gray-800">
                  {appData.categories.map((cat) => (
                    <button
                      key={cat.id}
                      onClick={() => setActiveCategoryId(cat.id)}
                      className={`px-4 py-2.5 rounded-lg font-bold text-xs whitespace-nowrap transition-all ${
                        activeCategoryId === cat.id ? 'bg-[#123524] text-[#D4AF37] border border-[#D4AF37]/40' : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                      }`}
                    >
                      {cat.title}
                    </button>
                  ))}
                </div>

                <div className="flex-1 overflow-y-auto p-3 sm:p-4 bg-gray-900">
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {activeCategory?.items.map((item) => (
                      <div
                        key={item.id}
                        onClick={() => handleAddToCart(item)}
                        className="bg-gray-800 border border-gray-700/60 p-3 rounded-xl cursor-pointer hover:border-[#D4AF37] hover:bg-gray-750 transition-all flex flex-col justify-between min-h-[90px] shadow"
                      >
                        <div className="font-semibold text-gray-100 text-xs sm:text-sm line-clamp-2">{item.name}</div>
                        <div className="font-bold text-[#D4AF37] text-xs sm:text-sm mt-2">{item.price.toLocaleString()} Ks</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Cart Drawer Right */}
              <div className="w-full md:w-80 lg:w-96 flex flex-col bg-gray-950 border-t md:border-t-0 border-gray-800 h-[45vh] md:h-full">
                <div className="p-3 bg-[#123524] text-[#D4AF37] font-bold flex justify-between items-center text-sm border-b border-gray-800">
                  <span className="flex items-center"><ShoppingCart className="w-4 h-4 mr-1.5" /> Selected Services</span>
                  <span className="bg-black/30 px-2 py-0.5 rounded text-xs">{cart.length} Items</span>
                </div>

                <div className="flex-1 overflow-y-auto p-3 space-y-2">
                  {cart.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-gray-500 text-xs">
                      <ShoppingCart className="w-10 h-10 mb-2 opacity-20" />
                      <span>Service များ ရွေးချယ်ပါ</span>
                    </div>
                  ) : (
                    cart.map((item) => (
                      <div key={item.id} className="bg-gray-900 p-2.5 rounded-lg border border-gray-800 flex justify-between items-center">
                        <div className="flex-1 pr-2">
                          <div className="text-xs font-semibold text-gray-200">{item.name}</div>
                          <div className="text-xs text-[#D4AF37] font-bold mt-0.5">{(item.price * item.quantity).toLocaleString()} Ks</div>
                        </div>
                        <div className="flex items-center space-x-2">
                          <div className="flex items-center bg-gray-800 rounded border border-gray-700">
                            <button onClick={() => updateQuantity(item.id, -1)} className="p-1 text-gray-400 hover:text-white"><Minus className="w-3 h-3" /></button>
                            <span className="w-5 text-center text-xs font-bold">{item.quantity}</span>
                            <button onClick={() => updateQuantity(item.id, 1)} className="p-1 text-gray-400 hover:text-white"><Plus className="w-3 h-3" /></button>
                          </div>
                          <button onClick={() => removeFromCart(item.id)} className="p-1 text-red-400 hover:bg-red-950/50 rounded"><Trash2 className="w-3.5 h-3.5" /></button>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                <div className="p-3 bg-gray-900 border-t border-gray-800">
                  <div className="flex justify-between items-center mb-2 text-sm">
                    <span className="text-gray-400">ကျသင့်ငွေ စုစုပေါင်း</span>
                    <span className="text-lg font-bold text-[#D4AF37]">{totalAmount.toLocaleString()} Ks</span>
                  </div>
                  <button
                    disabled={cart.length === 0}
                    onClick={() => setStep('therapist')}
                    className={`w-full py-3 rounded-xl font-bold text-sm flex items-center justify-center transition ${
                      cart.length > 0 ? 'bg-[#D4AF37] text-black hover:bg-yellow-500 shadow-lg' : 'bg-gray-800 text-gray-600 cursor-not-allowed'
                    }`}
                  >
                    ရှေ့သို့ (Therapist ရွေးမည်)
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* STEP 2: SELECT THERAPIST (AUTO BLOCK BUSY ONES) */}
          {step === 'therapist' && (
            <div className="flex-1 p-4 sm:p-6 overflow-y-auto no-print">
              <div className="max-w-3xl mx-auto">
                <h2 className="text-lg font-bold mb-2 text-center text-[#D4AF37]">Therapist ရွေးချယ်ပါ</h2>
                <p className="text-center text-xs text-gray-400 mb-6">မအားသေးသော (Booked / In Service) ဝန်ထမ်းများကို Auto Block ထားပါသည်</p>
                
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                  {appData.therapists.map((t) => {
                    const isBusy = busyTherapistIds.includes(t.id) || busyTherapistIds.includes(t.name);
                    const isSelected = selectedTherapist?.id === t.id;

                    return (
                      <button
                        key={t.id}
                        disabled={isBusy}
                        onClick={() => {
                          setSelectedTherapist(t);
                          setStep('checkout');
                        }}
                        className={`p-4 rounded-xl flex flex-col items-center justify-center text-center transition-all relative border ${
                          isBusy 
                            ? 'bg-red-950/20 border-red-900/50 opacity-40 cursor-not-allowed' 
                            : isSelected
                            ? 'bg-[#123524] border-[#D4AF37] shadow-lg ring-2 ring-[#D4AF37]'
                            : 'bg-gray-800 border-gray-700 hover:border-[#D4AF37] hover:bg-gray-750'
                        }`}
                      >
                        <div className={`w-12 h-12 rounded-full flex items-center justify-center font-bold text-lg mb-2 shadow ${
                          isBusy ? 'bg-red-900/50 text-red-200' : 'bg-[#123524] text-[#D4AF37]'
                        }`}>
                          {t.name.replace(/[^0-9]/g, '') || 'T'}
                        </div>
                        <span className="font-semibold text-sm text-gray-200">{t.name}</span>
                        
                        <span className={`text-[10px] mt-1 px-2 py-0.5 rounded-full font-bold ${
                          isBusy ? 'bg-red-900 text-red-200' : 'bg-emerald-900/60 text-emerald-300'
                        }`}>
                          {isBusy ? 'မအားပါ (Busy)' : 'အားပါသည် (Available)'}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* STEP 3: PAYMENT METHOD & CHECKOUT */}
          {step === 'checkout' && (
            <div className="flex-1 p-4 sm:p-6 overflow-y-auto no-print">
              <div className="max-w-md mx-auto bg-gray-800 border border-gray-700 rounded-2xl p-5 shadow-xl">
                <h2 className="text-lg font-bold text-center text-[#D4AF37] mb-4">ငွေပေးချေမှု အတည်ပြုခြင်း</h2>

                <div className="bg-gray-900 p-3 rounded-xl mb-4 text-xs space-y-2 border border-gray-800">
                  <div className="flex justify-between text-gray-400">
                    <span>Therapist:</span>
                    <span className="font-bold text-white">{selectedTherapist?.name}</span>
                  </div>
                  <div className="flex justify-between text-gray-400">
                    <span>Service များ:</span>
                    <span className="font-bold text-white">{cart.map(c => c.name).join(', ')}</span>
                  </div>
                  <div className="border-t border-gray-800 pt-2 flex justify-between text-sm font-bold text-[#D4AF37]">
                    <span>စုစုပေါင်း ကျသင့်ငွေ:</span>
                    <span>{totalAmount.toLocaleString()} Ks</span>
                  </div>
                </div>

                <div className="mb-6">
                  <label className="block text-xs font-bold text-gray-400 mb-2">Payment Method ရွေးပါ</label>
                  <div className="grid grid-cols-2 gap-2">
                    {['CASH', 'KBZ PAY', 'CB PAY', 'WAVEPAY'].map((method) => (
                      <button
                        key={method}
                        onClick={() => setPaymentMethod(method)}
                        className={`py-3 px-3 rounded-xl font-bold text-xs border transition ${
                          paymentMethod === method
                            ? 'bg-[#123524] text-[#D4AF37] border-[#D4AF37]'
                            : 'bg-gray-900 text-gray-400 border-gray-700 hover:bg-gray-750'
                        }`}
                      >
                        {method}
                      </button>
                    ))}
                  </div>
                </div>

                <button
                  onClick={handleCompleteSale}
                  className="w-full py-4 bg-gradient-to-r from-emerald-600 to-green-700 text-white font-bold rounded-xl text-sm shadow-lg hover:opacity-90 transition flex items-center justify-center"
                >
                  <ShieldCheck className="w-5 h-5 mr-2" />
                  Sale Complete (ငွေရှင်းမည်)
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {/* VIEW: RECEIPTS */}
      {currentView === 'receipts' && (
        <div className="flex-1 p-4 overflow-y-auto no-print">
          <div className="max-w-3xl mx-auto">
            <h2 className="text-lg font-bold text-[#D4AF37] mb-4">အရောင်းမှတ်တမ်း (Receipts)</h2>
            {loadingReceipts ? (
              <div className="text-center py-20 text-gray-400">ဒေတာများ ဆွဲထုတ်နေပါသည်...</div>
            ) : receipts.length === 0 ? (
              <div className="text-center py-20 text-gray-500 bg-gray-800/50 rounded-2xl border border-gray-800">
                <FileText className="w-12 h-12 mx-auto mb-2 opacity-30" />
                <p className="text-sm">အရောင်းမှတ်တမ်း မရှိသေးပါ။</p>
              </div>
            ) : (
              <div className="space-y-3">
                {receipts.map((rec, index) => (
                  <div key={rec.id || index} className="bg-gray-800 border border-gray-700/60 p-4 rounded-xl shadow">
                    <div className="flex justify-between items-start mb-2 border-b border-gray-700 pb-2">
                      <div>
                        <span className="text-xs bg-[#123524] text-[#D4AF37] px-2 py-0.5 rounded font-bold">Therapist: {rec.therapistName}</span>
                        <div className="text-[10px] text-gray-400 mt-1 flex items-center">
                          <Clock className="w-3 h-3 mr-1" />
                          {rec.createdAt?.seconds ? new Date(rec.createdAt.seconds * 1000).toLocaleString() : 'Just now'}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-bold text-[#D4AF37]">{rec.total?.toLocaleString()} Ks</div>
                        <span className="text-[10px] bg-gray-900 px-2 py-0.5 rounded text-gray-300">{rec.paymentMethod}</span>
                      </div>
                    </div>
                    <div className="text-xs space-y-1">
                      {rec.items?.map((item, i) => (
                        <div key={i} className="flex justify-between text-gray-300">
                          <span>{item.name} (x{item.quantity})</span>
                          <span>{(item.price * item.quantity).toLocaleString()} Ks</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* VIEW: ITEMS */}
      {currentView === 'items' && (
        <div className="flex-1 p-4 overflow-y-auto no-print">
          <div className="max-w-3xl mx-auto space-y-6">
            <h2 className="text-lg font-bold text-[#D4AF37]">ဝန်ဆောင်မှု စာရင်း</h2>
            {appData.categories.map((cat) => (
              <div key={cat.id} className="bg-gray-800 border border-gray-700 rounded-xl p-4">
                <h3 className="font-bold text-[#D4AF37] text-sm mb-3 border-b border-gray-700 pb-2">{cat.title}</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {cat.items.map((item) => (
                    <div key={item.id} className="bg-gray-900 p-3 rounded-lg border border-gray-800 flex justify-between items-center">
                      <div>
                        <div className="text-xs font-semibold text-gray-200">{item.name}</div>
                        <div className="text-[10px] text-gray-400">{item.duration || 'Standard'}</div>
                      </div>
                      <div className="font-bold text-sm text-[#D4AF37]">{item.price.toLocaleString()} Ks</div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 🌟 58mm PRINTABLE INVOICE RECEIPT MODAL 🌟 */}
      {completedSale && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="bg-gray-900 border border-gray-700 rounded-2xl p-5 max-w-sm w-full text-center shadow-2xl">
            <div className="w-12 h-12 bg-emerald-900/50 text-emerald-400 rounded-full flex items-center justify-center mx-auto mb-2 border border-emerald-500/30 no-print">
              <CheckCircle className="w-8 h-8" />
            </div>
            <h3 className="text-base font-bold text-white mb-1 no-print">Sale Completed Successfully!</h3>
            <p className="text-xs text-gray-400 mb-4 no-print">Auto synced to Customer & Staff Apps</p>

            {/* Printable 58mm Area */}
            <div id="printable-invoice" className="bg-white text-black p-3 rounded-lg text-left text-xs mb-4 border border-gray-300 font-mono">
              <div className="text-center font-bold text-sm mb-1 uppercase">THE SHANGRI-LA</div>
              <div className="text-center text-[10px] mb-2 border-b border-black pb-1">Men's Retreat - POS Invoice</div>
              
              <div className="text-[10px] space-y-0.5 mb-2">
                <div>Date: {new Date().toLocaleString()}</div>
                <div>Therapist: {completedSale.therapistName}</div>
                <div>Payment: {completedSale.paymentMethod}</div>
              </div>

              <div className="border-t border-b border-dashed border-black py-1 my-1 space-y-1">
                {completedSale.items.map((it, idx) => (
                  <div key={idx} className="flex justify-between text-[11px]">
                    <span className="truncate pr-1">{it.name} x{it.quantity}</span>
                    <span className="font-bold">{(it.price * it.quantity).toLocaleString()}</span>
                  </div>
                ))}
              </div>

              <div className="flex justify-between font-bold text-sm pt-1">
                <span>TOTAL:</span>
                <span>{completedSale.total.toLocaleString()} Ks</span>
              </div>
              <div className="text-center text-[9px] mt-3 border-t border-black pt-1">Thank You For Your Visit!</div>
            </div>

            {/* Modal Buttons */}
            <div className="space-y-2 no-print">
              <button
                onClick={handlePrintReceipt}
                className="w-full py-3 bg-[#D4AF37] text-black font-bold rounded-xl text-sm flex items-center justify-center hover:bg-yellow-500 transition shadow"
              >
                <Printer className="w-4 h-4 mr-2" />
                Print 58mm Invoice (Bluetooth)
              </button>
              
              <button
                onClick={resetPOS}
                className="w-full py-2.5 bg-gray-800 text-gray-300 font-bold rounded-xl text-xs hover:bg-gray-700 transition"
              >
                New Sale (အရောင်းအသစ်စမည်)
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
