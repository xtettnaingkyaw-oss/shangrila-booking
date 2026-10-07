import React, { useState } from 'react';
import { AppData, TherapistProfile } from '../shared';
import { ShoppingCart, Plus, Minus, Trash2, CreditCard, User, ArrowLeft, CheckCircle, ShieldCheck, Menu, FileText, ShoppingBag, X, Clock } from 'lucide-react';
import { db } from '../firebase';
import { collection, addDoc, getDocs, query, orderBy } from 'firebase/firestore';

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

  const [step, setStep] = useState<'therapist' | 'services' | 'checkout'>('therapist');
  const [selectedTherapist, setSelectedTherapist] = useState<TherapistProfile | null>(null);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [activeCategoryId, setActiveCategoryId] = useState<string>(
    appData.categories?.[0]?.id || ''
  );
  const [paymentMethod, setPaymentMethod] = useState<string>('KBZ PAY');
  const [isSuccessModal, setIsSuccessModal] = useState(false);

  const [receipts, setReceipts] = useState<ReceiptItem[]>([]);
  const [loadingReceipts, setLoadingReceipts] = useState(false);

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

  const handleCompleteSale = async () => {
    try {
      const saleData = {
        therapistName: selectedTherapist?.name || 'General',
        items: cart,
        total: totalAmount,
        paymentMethod: paymentMethod,
        createdAt: new Date()
      };

      await addDoc(collection(db, 'sales_history'), saleData);
      setIsSuccessModal(true);
    } catch (error) {
      console.error("Error saving sale:", error);
      setIsSuccessModal(true);
    }
  };

  const fetchReceipts = async () => {
    setLoadingReceipts(true);
    try {
      const q = query(collection(db, 'sales_history'), orderBy('createdAt', 'desc'));
      const querySnapshot = await getDocs(q);
      const loadedReceipts: ReceiptItem[] = [];
      querySnapshot.forEach((doc) => {
        loadedReceipts.push({ id: doc.id, ...doc.data() } as ReceiptItem);
      });
      setReceipts(loadedReceipts);
    } catch (err) {
      console.warn("Could not fetch receipts:", err);
    }
    setLoadingReceipts(false);
  };

  const resetPOS = () => {
    setCart([]);
    setSelectedTherapist(null);
    setStep('therapist');
    setIsSuccessModal(false);
  };

  return (
    <div className="min-h-[85vh] bg-gray-900 text-white rounded-xl overflow-hidden shadow-2xl flex flex-col border border-gray-800 relative">
      
      <div className="bg-[#1a2e26] px-4 py-3 border-b border-gray-800 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <button 
            onClick={() => setIsSidebarOpen(true)}
            className="p-2 bg-white/10 rounded-lg hover:bg-white/20 transition text-[#D4AF37]"
          >
            <Menu className="w-5 h-5" />
          </button>

          {currentView === 'pos' && step !== 'therapist' && (
            <button 
              onClick={() => setStep(step === 'checkout' ? 'services' : 'therapist')}
              className="p-2 bg-white/10 rounded-lg hover:bg-white/20 transition"
            >
              <ArrowLeft className="w-5 h-5 text-[#D4AF37]" />
            </button>
          )}

          <div>
            <h1 className="font-bold text-base text-[#D4AF37]">
              {currentView === 'pos' && 'The Shangri-La POS'}
              {currentView === 'receipts' && 'အရောင်းမှတ်တမ်းများ (Receipts)'}
              {currentView === 'items' && 'ဝန်ဆောင်မှု မီနူးများ (Items)'}
            </h1>
            <p className="text-xs text-gray-400">
              {currentView === 'pos' && (
                <>
                  {step === 'therapist' && 'အဆင့် ၁ - Therapist ရွေးချယ်ပါ'}
                  {step === 'services' && `အဆင့် ၂ - Service (${selectedTherapist?.name})`}
                  {step === 'checkout' && 'အဆင့် ၃ - ငွေရှင်းမည်'}
                </>
              )}
              {currentView === 'receipts' && 'ပြုလုပ်ပြီးသမျှ အရောင်းဘောင်ချာများ'}
              {currentView === 'items' && 'လက်ရှိရရှိနိုင်သော Service များနှင့် ဈေးနှုန်းများ'}
            </p>
          </div>
        </div>

        {selectedTherapist && currentView === 'pos' && (
          <div className="hidden sm:flex items-center bg-black/30 px-3 py-1.5 rounded-lg border border-[#D4AF37]/30 text-xs">
            <User className="w-4 h-4 mr-1.5 text-[#D4AF37]" />
            <span className="text-gray-300 font-semibold">{selectedTherapist.name}</span>
          </div>
        )}
      </div>

      {isSidebarOpen && (
        <div className="fixed inset-0 z-50 flex">
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setIsSidebarOpen(false)}></div>
          <div className="relative w-72 bg-gray-900 border-r border-gray-800 flex flex-col h-full z-10 shadow-2xl">
            <div className="p-4 bg-[#123524] border-b border-gray-800 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-sm text-[#D4AF37]">Shop Admin</h3>
                <p className="text-[10px] text-gray-300">The Shangri-La Men's Retreat</p>
              </div>
              <button onClick={() => setIsSidebarOpen(false)} className="p-1.5 bg-black/20 rounded-lg hover:bg-black/40 text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 p-3 space-y-1 overflow-y-auto">
              <button
                onClick={() => { setCurrentView('pos'); setIsSidebarOpen(false); }}
                className={`w-full flex items-center space-x-3 px-3 py-3 rounded-xl font-bold text-xs transition ${
                  currentView === 'pos' ? 'bg-[#123524] text-[#D4AF37] border border-[#D4AF37]/30' : 'text-gray-300 hover:bg-gray-800'
                }`}
              >
                <ShoppingBag className="w-4 h-4" />
                <span>Sales (အရောင်းစနစ်)</span>
              </button>

              <button
                onClick={() => { 
                  setCurrentView('receipts'); 
                  setIsSidebarOpen(false); 
                  fetchReceipts();
                }}
                className={`w-full flex items-center space-x-3 px-3 py-3 rounded-xl font-bold text-xs transition ${
                  currentView === 'receipts' ? 'bg-[#123524] text-[#D4AF37] border border-[#D4AF37]/30' : 'text-gray-300 hover:bg-gray-800'
                }`}
              >
                <FileText className="w-4 h-4" />
                <span>Receipts (ဘောင်ချာမှတ်တမ်း)</span>
              </button>

              <button
                onClick={() => { setCurrentView('items'); setIsSidebarOpen(false); }}
                className={`w-full flex items-center space-x-3 px-3 py-3 rounded-xl font-bold text-xs transition ${
                  currentView === 'items' ? 'bg-[#123524] text-[#D4AF37] border border-[#D4AF37]/30' : 'text-gray-300 hover:bg-gray-800'
                }`}
              >
                <ShoppingBag className="w-4 h-4" />
                <span>Items (မီနူးပစ္စည်းများ)</span>
              </button>
            </div>

            <div className="p-4 border-t border-gray-800 text-center text-[10px] text-gray-500">
              v2.75 - Offline POS Enabled
            </div>
          </div>
        </div>
      )}

      {currentView === 'receipts' && (
        <div className="flex-1 p-4 overflow-y-auto">
          <div className="max-w-3xl mx-auto">
            <h2 className="text-lg font-bold text-[#D4AF37] mb-4">အရောင်းမှတ်တမ်း (Receipts History)</h2>
            {loadingReceipts ? (
              <div className="text-center py-20 text-gray-400">ဒေတာများကို ဆွဲထုတ်နေပါသည်...</div>
            ) : receipts.length === 0 ? (
              <div className="text-center py-20 text-gray-500 bg-gray-800/50 rounded-2xl border border-gray-800">
                <FileText className="w-12 h-12 mx-auto mb-2 opacity-30" />
                <p className="text-sm">ယခုထိ အရောင်းမှတ်တမ်း မရှိသေးပါ။</p>
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

      {currentView === 'items' && (
        <div className="flex-1 p-4 overflow-y-auto">
          <div className="max-w-3xl mx-auto space-y-6">
            <h2 className="text-lg font-bold text-[#D4AF37]">ဝန်ဆောင်မှု မီနူးပစ္စည်းများ (Items List)</h2>
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

      {currentView === 'pos' && (
        <>
          {step === 'therapist' && (
            <div className="flex-1 p-4 sm:p-6 overflow-y-auto">
              <div className="max-w-3xl mx-auto">
                <h2 className="text-lg font-bold mb-4 text-center text-[#D4AF37]">ဝန်ထမ်း (Therapist) ရွေးချယ်ပါ</h2>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                  {appData.therapists.map((t) => (
                    <button
                      key={t.id}
                      onClick={() => {
                        setSelectedTherapist(t);
                        setStep('services');
                      }}
                      className="bg-gray-800 border border-gray-700 hover:border-[#D4AF37] p-4 rounded-xl flex flex-col items-center justify-center text-center transition-all hover:bg-gray-750 group shadow-md"
                    >
                      <div className="w-12 h-12 bg-[#123524] text-[#D4AF37] rounded-full flex items-center justify-center font-bold text-lg mb-2 group-hover:scale-105 transition shadow">
                        {t.name.replace(/[^0-9]/g, '') || 'T'}
                      </div>
                      <span className="font-semibold text-sm text-gray-200 group-hover:text-[#D4AF37]">{t.name}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {step === 'services' && (
            <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
              <div className="flex-1 flex flex-col border-r border-gray-800 bg-gray-900 overflow-hidden">
                <div className="flex overflow-x-auto bg-gray-950 p-2 space-x-2 border-b border-gray-800">
                  {appData.categories.map((cat) => (
                    <button
                      key={cat.id}
                      onClick={() => setActiveCategoryId(cat.id)}
                      className={`px-4 py-2.5 rounded-lg font-bold text-xs whitespace-nowrap transition-all ${
                        activeCategoryId === cat.id
                          ? 'bg-[#123524] text-[#D4AF37] border border-[#D4AF37]/40 shadow'
                          : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
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

              <div className="w-full md:w-80 lg:w-96 flex flex-col bg-gray-950 border-t md:border-t-0 border-gray-800 h-[45vh] md:h-full">
                <div className="p-3 bg-[#123524] text-[#D4AF37] font-bold flex justify-between items-center text-sm border-b border-gray-800">
                  <span className="flex items-center"><ShoppingCart className="w-4 h-4 mr-1.5" /> လက်ရှိမှာယူမှု (Cart)</span>
                  <span className="bg-black/30 px-2 py-0.5 rounded text-xs">{cart.length} Items</span>
                </div>

                <div className="flex-1 overflow-y-auto p-3 space-y-2">
                  {cart.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-gray-500 text-xs">
                      <ShoppingCart className="w-10 h-10 mb-2 opacity-20" />
                      <span>ဝန်ဆောင်မှုများ ရွေးချယ်ပါ</span>
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
                    onClick={() => setStep('checkout')}
                    className={`w-full py-3 rounded-xl font-bold text-sm flex items-center justify-center transition ${
                      cart.length > 0 ? 'bg-[#D4AF37] text-black hover:bg-yellow-500 shadow-lg' : 'bg-gray-800 text-gray-600 cursor-not-allowed'
                    }`}
                  >
                    <CreditCard className="w-4 h-4 mr-2" />
                    ငွေရှင်းရန် (Checkout)
                  </button>
                </div>
              </div>
            </div>
          )}

          {step === 'checkout' && (
            <div className="flex-1 p-4 sm:p-6 overflow-y-auto">
              <div className="max-w-md mx-auto bg-gray-800 border border-gray-700 rounded-2xl p-5 shadow-xl">
                <h2 className="text-lg font-bold text-center text-[#D4AF37] mb-4">ငွေပေးချေမှု အတည်ပြုခြင်း</h2>

                <div className="bg-gray-900 p-3 rounded-xl mb-4 text-xs space-y-2 border border-gray-800">
                  <div className="flex justify-between text-gray-400">
                    <span>Therapist:</span>
                    <span className="font-bold text-white">{selectedTherapist?.name}</span>
                  </div>
                  <div className="flex justify-between text-gray-400">
                    <span>Item အရေအတွက်:</span>
                    <span className="font-bold text-white">{cart.reduce((a, b) => a + b.quantity, 0)} ခု</span>
                  </div>
                  <div className="border-t border-gray-800 pt-2 flex justify-between text-sm font-bold text-[#D4AF37]">
                    <span>စုစုပေါင်း ကျသင့်ငွေ:</span>
                    <span>{totalAmount.toLocaleString()} Ks</span>
                  </div>
                </div>

                <div className="mb-4">
                  <label className="block text-xs font-bold text-gray-400 mb-2">ငွေပေးချေမည့် နည်းလမ်း (Payment Method)</label>
                  <div className="grid grid-cols-2 gap-2">
                    {['KBZ PAY', 'CASH', 'CB PAY', 'WAVEPAY'].map((method) => (
                      <button
                        key={method}
                        onClick={() => setPaymentMethod(method)}
                        className={`py-2.5 px-3 rounded-lg font-bold text-xs border transition ${
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
                  className="w-full py-3.5 bg-gradient-to-r from-emerald-600 to-green-700 text-white font-bold rounded-xl text-sm shadow-lg hover:opacity-90 transition flex items-center justify-center"
                >
                  <ShieldCheck className="w-5 h-5 mr-2" />
                  အရောင်းအတည်ပြုမည် (Complete Sale)
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {isSuccessModal && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="bg-gray-800 border border-gray-700 rounded-2xl p-6 max-w-sm w-full text-center shadow-2xl animate-fade-in">
            <div className="w-16 h-16 bg-emerald-900/50 text-emerald-400 rounded-full flex items-center justify-center mx-auto mb-4 border border-emerald-500/30">
              <CheckCircle className="w-10 h-10" />
            </div>
            <h3 className="text-xl font-bold text-white mb-1">ငွေရှင်းခြင်း အောင်မြင်သည်!</h3>
            <p className="text-xs text-gray-400 mb-6">အရောင်းစာရင်းကို Database တွင် သိမ်းဆည်းပြီးပါပြီ။</p>
            <button
              onClick={resetPOS}
              className="w-full py-3 bg-[#123524] text-[#D4AF37] font-bold rounded-xl text-sm border border-[#D4AF37]/30 hover:bg-opacity-90 transition shadow"
            >
              အရောင်းအသစ် စတင်ရန် (New Sale)
            </button>
          </div>
        </div>
      )}

    </div>
  );
}
