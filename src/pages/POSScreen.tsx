import React, { useState, useEffect } from 'react';
import { AppData, TherapistProfile } from '../shared';
import { 
  ShoppingCart, Plus, Minus, Trash2, CreditCard, User, ArrowLeft, 
  CheckCircle, ShieldCheck, Menu, FileText, ShoppingBag, X, Clock, 
  Printer as PrinterIcon, Settings, Percent, ChevronLeft, Search, Save
} from 'lucide-react';
import { db } from '../firebase';
import { collection, addDoc, getDocs, query, where, orderBy, onSnapshot } from 'firebase/firestore';

interface POSScreenProps {
  appData: AppData;
}

interface CartItem { id: string; name: string; price: number; quantity: number; }
interface ReceiptItem { id: string; therapistName: string; items: CartItem[]; total: number; paymentMethod: string; createdAt: any; }

// Printer Settings Interface
interface PrinterConfig {
  name: string;
  model: string;
  interfaceType: string;
  deviceName: string;
  paperWidth: '58mm' | '80mm';
  printReceipts: boolean;
  autoPrint: boolean;
}

export default function POSScreen({ appData }: POSScreenProps) {
  // Views: pos, receipts, items, settings, printers, edit_printer
  const [currentView, setCurrentView] = useState<'pos' | 'receipts' | 'items' | 'settings' | 'printers' | 'edit_printer'>('pos');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [step, setStep] = useState<'services' | 'therapist' | 'checkout'>('services');
  
  const [cart, setCart] = useState<CartItem[]>([]);
  const [activeCategoryId, setActiveCategoryId] = useState<string>(appData.categories?.[0]?.id || '');
  const [selectedTherapist, setSelectedTherapist] = useState<TherapistProfile | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<string>('CASH');
  const [busyTherapistIds, setBusyTherapistIds] = useState<string[]>([]);
  const [completedSale, setCompletedSale] = useState<ReceiptItem | null>(null);
  const [receipts, setReceipts] = useState<ReceiptItem[]>([]);
  const [loadingReceipts, setLoadingReceipts] = useState(false);

  // --- Printer Settings State ---
  const [printerConfig, setPrinterConfig] = useState<PrinterConfig>(() => {
    const saved = localStorage.getItem('pos_printer_settings');
    return saved ? JSON.parse(saved) : {
      name: 'Shop Printer',
      model: 'Other model',
      interfaceType: 'Bluetooth',
      deviceName: '',
      paperWidth: '58mm',
      printReceipts: true,
      autoPrint: false
    };
  });

  useEffect(() => {
    localStorage.setItem('pos_printer_settings', JSON.stringify(printerConfig));
  }, [printerConfig]);

  // Sync Bookings
  useEffect(() => {
    const q = query(collection(db, 'bookings'), where('status', 'in', ['confirmed', 'in_service', 'pending']));
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

  // Cart Functions
  const handleAddToCart = (item: any) => {
    setCart((prev) => {
      const existing = prev.find((c) => c.id === item.id);
      if (existing) return prev.map((c) => c.id === item.id ? { ...c, quantity: c.quantity + 1 } : c);
      return [...prev, { id: item.id, name: item.name, price: item.price, quantity: 1 }];
    });
  };
  const updateQuantity = (id: string, delta: number) => {
    setCart((prev) => prev.map((c) => {
      if (c.id === id) {
        const newQty = c.quantity + delta;
        return newQty > 0 ? { ...c, quantity: newQty } : c;
      }
      return c;
    }));
  };
  const removeFromCart = (id: string) => setCart((prev) => prev.filter((c) => c.id !== id));

  const totalAmount = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const activeCategory = appData.categories.find(c => c.id === activeCategoryId);

  // Complete Sale
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
      const docRef = await addDoc(collection(db, 'sales_history'), salePayload);
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
      
      const saleData = { id: docRef.id, ...salePayload };
      setCompletedSale(saleData);

      // Auto Print Logic
      if (printerConfig.printReceipts && printerConfig.autoPrint) {
        setTimeout(() => handlePrintReceipt(), 500);
      }
    } catch (error) {
      console.error("Sale complete error:", error);
      setCompletedSale({ id: `offline_${Date.now()}`, ...salePayload });
    }
  };

  const handlePrintReceipt = () => window.print();

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
      querySnapshot.forEach((doc) => loaded.push({ id: doc.id, ...doc.data() } as ReceiptItem));
      setReceipts(loaded);
    } catch (err) {}
    setLoadingReceipts(false);
  };

  // --- Web Bluetooth Search ---
  const searchBluetoothDevice = async () => {
    try {
      const device = await (navigator as any).bluetooth.requestDevice({
        acceptAllDevices: true,
        optionalServices: ['000018f0-0000-1000-8000-00805f9b34fb'] // Generic ESC/POS
      });
      setPrinterConfig(prev => ({ ...prev, deviceName: device.name || 'Unknown BT Device' }));
      alert(`${device.name} သို့ ချိတ်ဆက်မှု အောင်မြင်ပါသည်။`);
    } catch (error) {
      console.log("Bluetooth Error:", error);
      alert("Bluetooth ရှာဖွေမှု ပယ်ဖျက်လိုက်ပါသည် သို့မဟုတ် မအောင်မြင်ပါ။");
    }
  };

  return (
    <div className="min-h-[85vh] bg-[#1a1a1c] text-white rounded-xl overflow-hidden shadow-2xl flex flex-col border border-gray-800 relative font-sans">
      
      {/* Dynamic Print CSS based on Paper Width */}
      <style>{`
        @media print {
          body * { visibility: hidden; }
          #printable-invoice, #printable-invoice * { visibility: visible; }
          #printable-invoice {
            position: absolute;
            left: 0;
            top: 0;
            width: ${printerConfig.paperWidth} !important;
            max-width: ${printerConfig.paperWidth} !important;
            padding: 2mm;
            font-family: monospace;
            color: #000 !important;
            background: #fff !important;
            font-size: ${printerConfig.paperWidth === '80mm' ? '14px' : '11px'};
            line-height: 1.2;
          }
          .no-print { display: none !important; }
        }
      `}</style>

      {/* Main Header (Hidden in Settings Views) */}
      {!['settings', 'printers', 'edit_printer'].includes(currentView) && (
        <div className="bg-[#123524] px-4 py-3 border-b border-gray-800 flex items-center justify-between no-print">
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
                {currentView === 'receipts' && 'Receipts'}
                {currentView === 'items' && 'Items'}
              </h1>
            </div>
          </div>
        </div>
      )}

      {/* Sidebar Drawer */}
      {isSidebarOpen && (
        <div className="fixed inset-0 z-50 flex no-print">
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setIsSidebarOpen(false)}></div>
          <div className="relative w-72 bg-[#1a1a1c] border-r border-gray-800 flex flex-col h-full z-10 shadow-2xl">
            <div className="p-4 bg-[#123524] border-b border-gray-800 flex justify-between">
              <div>
                <h3 className="font-bold text-sm text-[#D4AF37]">Shangri-La POS Admin</h3>
              </div>
              <button onClick={() => setIsSidebarOpen(false)} className="text-white"><X className="w-5 h-5" /></button>
            </div>
            <div className="flex-1 p-3 space-y-1 overflow-y-auto">
              <button onClick={() => { setCurrentView('pos'); setIsSidebarOpen(false); }} className={`w-full flex items-center space-x-3 px-3 py-3 rounded-xl font-bold text-sm ${currentView === 'pos' ? 'bg-[#123524] text-[#D4AF37]' : 'text-gray-300 hover:bg-gray-800'}`}>
                <ShoppingBag className="w-4 h-4" /><span>Sales</span>
              </button>
              <button onClick={() => { setCurrentView('receipts'); setIsSidebarOpen(false); fetchReceipts(); }} className={`w-full flex items-center space-x-3 px-3 py-3 rounded-xl font-bold text-sm ${currentView === 'receipts' ? 'bg-[#123524] text-[#D4AF37]' : 'text-gray-300 hover:bg-gray-800'}`}>
                <FileText className="w-4 h-4" /><span>Receipts</span>
              </button>
              <button onClick={() => { setCurrentView('items'); setIsSidebarOpen(false); }} className={`w-full flex items-center space-x-3 px-3 py-3 rounded-xl font-bold text-sm ${currentView === 'items' ? 'bg-[#123524] text-[#D4AF37]' : 'text-gray-300 hover:bg-gray-800'}`}>
                <ShoppingBag className="w-4 h-4" /><span>Items</span>
              </button>
              <div className="my-2 border-t border-gray-800"></div>
              <button onClick={() => { setCurrentView('settings'); setIsSidebarOpen(false); }} className={`w-full flex items-center space-x-3 px-3 py-3 rounded-xl font-bold text-sm ${['settings','printers','edit_printer'].includes(currentView) ? 'bg-gray-800 text-white' : 'text-gray-300 hover:bg-gray-800'}`}>
                <Settings className="w-4 h-4" /><span>Settings</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ---------------- SETTINGS VIEWS (Loyverse Style) ---------------- */}
      
      {/* 1. Main Settings List */}
      {currentView === 'settings' && (
        <div className="flex-1 flex flex-col bg-[#212124] no-print">
          <div className="flex items-center px-4 py-4 bg-[#212124] border-b border-gray-700">
            <button onClick={() => setIsSidebarOpen(true)} className="mr-4 text-white"><Menu className="w-6 h-6" /></button>
            <h1 className="text-xl font-normal text-white">Settings</h1>
          </div>
          <div className="flex-1 overflow-y-auto">
            <button onClick={() => setCurrentView('printers')} className="w-full flex items-center px-6 py-4 hover:bg-gray-800 border-b border-gray-700/50 transition">
              <PrinterIcon className="w-6 h-6 text-gray-400 mr-6" />
              <span className="text-base text-gray-200">Printers</span>
            </button>
            <button className="w-full flex items-center px-6 py-4 hover:bg-gray-800 border-b border-gray-700/50 transition">
              <Percent className="w-6 h-6 text-gray-400 mr-6" />
              <span className="text-base text-gray-200">Taxes</span>
            </button>
            <button className="w-full flex items-center px-6 py-4 hover:bg-gray-800 border-b border-gray-700/50 transition">
              <Settings className="w-6 h-6 text-gray-400 mr-6" />
              <span className="text-base text-gray-200">General</span>
            </button>
          </div>
        </div>
      )}

      {/* 2. Printers List */}
      {currentView === 'printers' && (
        <div className="flex-1 flex flex-col bg-[#212124] no-print relative">
          <div className="flex items-center px-4 py-4 bg-[#212124] border-b border-gray-700 shadow-sm">
            <button onClick={() => setCurrentView('settings')} className="mr-4 text-white"><ArrowLeft className="w-6 h-6" /></button>
            <h1 className="text-xl font-normal text-white">Printers</h1>
          </div>
          <div className="flex-1 overflow-y-auto">
            <button onClick={() => setCurrentView('edit_printer')} className="w-full flex items-center justify-between px-6 py-4 hover:bg-gray-800 border-b border-gray-700/50 transition">
              <div className="flex items-center">
                <div className="w-10 h-10 rounded-full bg-gray-600 flex items-center justify-center mr-4">
                  <PrinterIcon className="w-5 h-5 text-white" />
                </div>
                <div className="text-left">
                  <div className="text-base text-white">{printerConfig.name}</div>
                  <div className="text-sm text-gray-400">{printerConfig.model}</div>
                </div>
              </div>
              <span className="text-sm text-gray-400">Receipts and bills</span>
            </button>
          </div>
          {/* FAB Add Button */}
          <button onClick={() => setCurrentView('edit_printer')} className="absolute bottom-6 right-6 w-14 h-14 bg-emerald-500 rounded-full flex items-center justify-center shadow-lg hover:bg-emerald-600 transition">
            <Plus className="w-8 h-8 text-white" />
          </button>
        </div>
      )}

      {/* 3. Edit Printer */}
      {currentView === 'edit_printer' && (
        <div className="flex-1 flex flex-col bg-[#212124] no-print overflow-y-auto">
          <div className="flex items-center justify-between px-4 py-4 bg-[#212124] border-b border-gray-700 shadow-sm sticky top-0 z-10">
            <div className="flex items-center">
              <button onClick={() => setCurrentView('printers')} className="mr-4 text-white"><ArrowLeft className="w-6 h-6" /></button>
              <h1 className="text-xl font-normal text-white">Edit printer</h1>
            </div>
            <button onClick={() => setCurrentView('printers')} className="text-sm font-bold text-white tracking-wider">SAVE</button>
          </div>
          
          <div className="p-6 space-y-6 max-w-2xl mx-auto w-full">
            {/* Name */}
            <div>
              <label className="text-xs text-gray-400 mb-1 block">Name</label>
              <input 
                type="text" 
                value={printerConfig.name}
                onChange={e => setPrinterConfig({...printerConfig, name: e.target.value})}
                className="w-full bg-transparent border-b border-gray-600 text-lg text-white py-2 focus:outline-none focus:border-emerald-500"
              />
            </div>

            {/* Model */}
            <div>
              <label className="text-xs text-gray-400 mb-1 block">Printer model</label>
              <select className="w-full bg-transparent border-b border-gray-600 text-lg text-white py-2 focus:outline-none focus:border-emerald-500 appearance-none">
                <option className="bg-gray-800">Other model</option>
                <option className="bg-gray-800">Epson TM-T88VI</option>
                <option className="bg-gray-800">Star Micronics</option>
              </select>
            </div>

            {/* Interface */}
            <div>
              <label className="text-xs text-gray-400 mb-1 block">Interface</label>
              <select className="w-full bg-transparent border-b border-gray-600 text-lg text-white py-2 focus:outline-none focus:border-emerald-500 appearance-none">
                <option className="bg-gray-800">Bluetooth</option>
                <option className="bg-gray-800">Wi-Fi</option>
                <option className="bg-gray-800">USB</option>
              </select>
            </div>

            {/* Bluetooth Search */}
            <div className="flex items-end space-x-4">
              <div className="flex-1">
                <label className="text-xs text-gray-400 mb-1 block">Bluetooth printer</label>
                <input 
                  type="text" 
                  readOnly 
                  value={printerConfig.deviceName || 'No device selected'}
                  className="w-full bg-transparent border-b border-gray-600 text-lg text-gray-300 py-2 focus:outline-none"
                />
              </div>
              <button onClick={searchBluetoothDevice} className="bg-gray-700 text-white px-4 py-2 rounded text-sm font-bold tracking-wider hover:bg-gray-600">
                SEARCH
              </button>
            </div>

            {/* Paper Width */}
            <div>
              <label className="text-xs text-gray-400 mb-1 block">Paper width</label>
              <select 
                value={printerConfig.paperWidth}
                onChange={e => setPrinterConfig({...printerConfig, paperWidth: e.target.value as any})}
                className="w-full bg-transparent border-b border-gray-600 text-lg text-white py-2 focus:outline-none focus:border-emerald-500 appearance-none"
              >
                <option value="58mm" className="bg-gray-800">58 mm</option>
                <option value="80mm" className="bg-gray-800">80 mm</option>
              </select>
            </div>

            <div className="pt-4 border-t border-gray-700">
              <h3 className="text-gray-400 mb-4">Advanced settings</h3>
              
              {/* Toggles */}
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <span className="text-lg text-white">Print receipts and bills</span>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" className="sr-only peer" checked={printerConfig.printReceipts} onChange={e => setPrinterConfig({...printerConfig, printReceipts: e.target.checked})} />
                    <div className="w-11 h-6 bg-gray-600 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500"></div>
                  </label>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-lg text-white">Automatically print receipt</span>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" className="sr-only peer" checked={printerConfig.autoPrint} onChange={e => setPrinterConfig({...printerConfig, autoPrint: e.target.checked})} />
                    <div className="w-11 h-6 bg-gray-600 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500"></div>
                  </label>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="pt-6 space-y-4">
              <button onClick={() => {
                const testSale = { 
                  id: 'TEST', therapistName: 'Admin', total: 15000, paymentMethod: 'CASH', createdAt: new Date(),
                  items: [{ id: '1', name: 'Test Service', price: 15000, quantity: 1 }]
                };
                setCompletedSale(testSale);
                setTimeout(() => handlePrintReceipt(), 300);
              }} className="w-full flex items-center justify-center py-4 bg-transparent hover:bg-gray-800 transition rounded text-white font-bold text-sm tracking-widest">
                <PrinterIcon className="w-5 h-5 mr-3" /> PRINT TEST
              </button>
              
              <button className="w-full flex items-center justify-center py-4 bg-transparent hover:bg-red-900/30 transition rounded text-red-500 font-bold text-sm tracking-widest">
                <Trash2 className="w-5 h-5 mr-3" /> DELETE PRINTER
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ---------------- POS SYSTEM VIEWS ---------------- */}
      {currentView === 'pos' && (
        <>
          {step === 'services' && (
            <div className="flex-1 flex flex-col md:flex-row overflow-hidden no-print">
              <div className="flex-1 flex flex-col bg-[#1a1a1c] overflow-hidden">
                <div className="flex overflow-x-auto bg-[#212124] p-2 space-x-2 border-b border-gray-800">
                  {appData.categories.map((cat) => (
                    <button key={cat.id} onClick={() => setActiveCategoryId(cat.id)} className={`px-4 py-2.5 rounded-lg font-bold text-xs whitespace-nowrap transition-all ${activeCategoryId === cat.id ? 'bg-[#123524] text-[#D4AF37]' : 'bg-gray-800 text-gray-300'}`}>
                      {cat.title}
                    </button>
                  ))}
                </div>
                <div className="flex-1 overflow-y-auto p-4">
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {activeCategory?.items.map((item) => (
                      <div key={item.id} onClick={() => handleAddToCart(item)} className="bg-gray-800 border border-gray-700/60 p-3 rounded-xl cursor-pointer hover:border-[#D4AF37] transition-all flex flex-col justify-between min-h-[90px]">
                        <div className="font-semibold text-gray-100 text-sm">{item.name}</div>
                        <div className="font-bold text-[#D4AF37] text-sm mt-2">{item.price.toLocaleString()} Ks</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              {/* Cart Area */}
              <div className="w-full md:w-96 flex flex-col bg-[#212124] border-l border-gray-800 h-[45vh] md:h-full">
                <div className="p-4 bg-[#123524] text-[#D4AF37] font-bold flex justify-between items-center">
                  <span>Ticket</span>
                  <span className="bg-black/30 px-2 py-1 rounded text-xs">{cart.length}</span>
                </div>
                <div className="flex-1 overflow-y-auto p-3 space-y-2">
                  {cart.map((item) => (
                    <div key={item.id} className="bg-[#1a1a1c] p-3 rounded-lg flex justify-between items-center border border-gray-700">
                      <div className="flex-1">
                        <div className="text-sm font-semibold">{item.name}</div>
                        <div className="text-xs text-[#D4AF37] font-bold">{(item.price * item.quantity).toLocaleString()} Ks</div>
                      </div>
                      <div className="flex items-center space-x-3">
                        <div className="flex items-center bg-gray-800 rounded">
                          <button onClick={() => updateQuantity(item.id, -1)} className="p-1.5"><Minus className="w-4 h-4" /></button>
                          <span className="w-6 text-center text-sm">{item.quantity}</span>
                          <button onClick={() => updateQuantity(item.id, 1)} className="p-1.5"><Plus className="w-4 h-4" /></button>
                        </div>
                        <button onClick={() => removeFromCart(item.id)} className="text-red-400 p-1"><Trash2 className="w-4 h-4" /></button>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="p-4 bg-[#1a1a1c] border-t border-gray-800">
                  <div className="flex justify-between items-center mb-4">
                    <span className="text-gray-400">Total</span>
                    <span className="text-2xl font-bold text-[#D4AF37]">{totalAmount.toLocaleString()} Ks</span>
                  </div>
                  <button disabled={cart.length === 0} onClick={() => setStep('therapist')} className={`w-full py-4 rounded-lg font-bold text-lg ${cart.length > 0 ? 'bg-emerald-600 text-white hover:bg-emerald-500' : 'bg-gray-800 text-gray-600'}`}>
                    CHARGE
                  </button>
                </div>
              </div>
            </div>
          )}

          {step === 'therapist' && (
            <div className="flex-1 p-6 overflow-y-auto no-print">
              <h2 className="text-lg font-bold mb-4 text-center text-[#D4AF37]">Select Therapist</h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-4xl mx-auto">
                {appData.therapists.map((t) => {
                  const isBusy = busyTherapistIds.includes(t.id) || busyTherapistIds.includes(t.name);
                  return (
                    <button key={t.id} disabled={isBusy} onClick={() => { setSelectedTherapist(t); setStep('checkout'); }} className={`p-4 rounded-xl flex flex-col items-center justify-center text-center border ${isBusy ? 'bg-red-900/20 border-red-900/50 opacity-50' : 'bg-gray-800 hover:border-[#D4AF37] border-gray-700'}`}>
                      <div className="w-14 h-14 rounded-full bg-[#123524] text-[#D4AF37] flex items-center justify-center font-bold text-xl mb-3">{t.name.replace(/[^0-9]/g, '') || 'T'}</div>
                      <span className="font-semibold text-gray-200">{t.name}</span>
                      {isBusy && <span className="text-[10px] text-red-400 mt-1">Busy</span>}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {step === 'checkout' && (
            <div className="flex-1 p-6 overflow-y-auto no-print">
              <div className="max-w-md mx-auto bg-gray-800 rounded-2xl p-6">
                <h2 className="text-xl font-bold text-center text-white mb-6">Payment</h2>
                <div className="text-4xl font-bold text-center text-[#D4AF37] mb-8">{totalAmount.toLocaleString()} Ks</div>
                <div className="grid grid-cols-2 gap-3 mb-8">
                  {['CASH', 'KBZ PAY', 'CB PAY', 'WAVEPAY'].map((m) => (
                    <button key={m} onClick={() => setPaymentMethod(m)} className={`py-4 rounded-lg font-bold text-sm border ${paymentMethod === m ? 'bg-emerald-600 border-emerald-500 text-white' : 'bg-gray-900 border-gray-700 text-gray-400'}`}>
                      {m}
                    </button>
                  ))}
                </div>
                <button onClick={handleCompleteSale} className="w-full py-4 bg-emerald-600 text-white font-bold rounded-lg text-lg flex items-center justify-center">
                  <ShieldCheck className="w-6 h-6 mr-2" /> COMPLETE SALE
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {/* 🌟 PRINTABLE RECEIPT MODAL 🌟 */}
      {completedSale && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="bg-gray-900 border border-gray-700 rounded-2xl p-6 max-w-sm w-full text-center">
            <div className="w-16 h-16 bg-emerald-900/50 text-emerald-400 rounded-full flex items-center justify-center mx-auto mb-4 no-print">
              <CheckCircle className="w-10 h-10" />
            </div>
            <h3 className="text-lg font-bold text-white mb-4 no-print">Sale Completed!</h3>

            {/* Print Area - Only this will be visible on paper */}
            <div id="printable-invoice" className="bg-white text-black p-4 rounded text-left mb-6 font-mono mx-auto">
              <div className="text-center font-bold text-lg mb-1">THE SHANGRI-LA</div>
              <div className="text-center text-xs mb-3 border-b border-black pb-2">Men's Retreat</div>
              
              <div className="text-xs space-y-1 mb-3">
                <div>Date: {new Date().toLocaleDateString()} {new Date().toLocaleTimeString()}</div>
                <div>Staff: {completedSale.therapistName}</div>
                <div>Method: {completedSale.paymentMethod}</div>
              </div>

              <div className="border-t border-b border-dashed border-black py-2 my-2 space-y-1">
                {completedSale.items.map((it, idx) => (
                  <div key={idx} className="flex justify-between text-xs">
                    <span className="truncate pr-2">{it.name} x{it.quantity}</span>
                    <span className="font-bold">{(it.price * it.quantity).toLocaleString()}</span>
                  </div>
                ))}
              </div>

              <div className="flex justify-between font-bold text-sm pt-2">
                <span>TOTAL:</span>
                <span>{completedSale.total.toLocaleString()} Ks</span>
              </div>
              <div className="text-center text-[10px] mt-6 border-t border-black pt-2">Thank you! Please come again.</div>
            </div>

            <div className="space-y-3 no-print">
              {printerConfig.printReceipts && (
                <button onClick={handlePrintReceipt} className="w-full py-3 bg-blue-600 text-white font-bold rounded-lg text-sm flex items-center justify-center">
                  <PrinterIcon className="w-5 h-5 mr-2" /> PRINT RECEIPT ({printerConfig.paperWidth})
                </button>
              )}
              <button onClick={resetPOS} className="w-full py-3 bg-gray-700 text-white font-bold rounded-lg text-sm">
                NEW SALE
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
