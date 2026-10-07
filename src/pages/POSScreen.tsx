import React, { useState } from 'react';
import { AppData, MenuCategory } from '../shared';
import { ShoppingCart, Plus, Minus, Trash2, CreditCard } from 'lucide-react';

interface POSScreenProps {
  appData: AppData;
}

// Cart ထဲရောက်သွားမည့် Item ပုံစံ
interface CartItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
}

export default function POSScreen({ appData }: POSScreenProps) {
  const [cart, setCart] = useState<CartItem[]>([]);
  const [activeCategoryId, setActiveCategoryId] = useState<string>(
    appData.categories?.[0]?.id || ''
  );

  // Cart ထဲသို့ ပစ္စည်းထည့်ခြင်း
  const handleAddToCart = (item: any) => {
    setCart((prev) => {
      const existingItem = prev.find((c) => c.id === item.id);
      if (existingItem) {
        return prev.map((c) =>
          c.id === item.id ? { ...c, quantity: c.quantity + 1 } : c
        );
      }
      return [...prev, { id: item.id, name: item.name, price: item.price, quantity: 1 }];
    });
  };

  // Cart မှ ပစ္စည်း အတိုး/အလျှော့ လုပ်ခြင်း
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

  // Cart မှ ပစ္စည်း ဖျက်ခြင်း
  const removeFromCart = (id: string) => {
    setCart((prev) => prev.filter((c) => c.id !== id));
  };

  // စုစုပေါင်း ကျသင့်ငွေ တွက်ချက်ခြင်း
  const totalAmount = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);

  // ရွေးချယ်ထားသော Category အလိုက် Menu များကို စစ်ထုတ်ခြင်း
  const activeCategory = appData.categories.find(c => c.id === activeCategoryId);

  return (
    <div className="flex flex-col md:flex-row h-[85vh] bg-gray-50 rounded-xl overflow-hidden shadow-sm border border-gray-200">
      
      {/* 🌟 ဘယ်ဘက်ခြမ်း: Category နှင့် Menu Item များ ရွေးရန်နေရာ 🌟 */}
      <div className="flex-1 flex flex-col w-full md:w-2/3 border-b md:border-b-0 md:border-r border-gray-200 bg-white">
        
        {/* Categories Tab */}
        <div className="flex overflow-x-auto bg-gray-100 p-2 space-x-2 border-b border-gray-200 hide-scrollbar">
          {appData.categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setActiveCategoryId(cat.id)}
              className={`px-4 py-3 rounded-lg font-bold text-sm whitespace-nowrap transition-all ${
                activeCategoryId === cat.id
                  ? 'bg-[#123524] text-[#D4AF37] shadow-md'
                  : 'bg-white text-gray-600 hover:bg-gray-200'
              }`}
            >
              {cat.title}
            </button>
          ))}
        </div>

        {/* Menu Items Grid */}
        <div className="flex-1 overflow-y-auto p-4 bg-gray-50">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            {activeCategory?.items.map((item) => (
              <div
                key={item.id}
                onClick={() => handleAddToCart(item)}
                className="bg-white border border-gray-200 p-4 rounded-xl cursor-pointer hover:border-[#D4AF37] hover:shadow-md transition-all flex flex-col justify-between min-h-[120px]"
              >
                <div className="font-semibold text-gray-800 text-sm mb-2 leading-snug">{item.name}</div>
                <div className="font-bold text-[#123524]">{item.price.toLocaleString()} Ks</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 🌟 ညာဘက်ခြမ်း: ငွေရှင်းမည့် Cart (Current Order) 🌟 */}
      <div className="w-full md:w-1/3 flex flex-col bg-white h-[50vh] md:h-full">
        <div className="p-4 bg-[#123524] text-white flex items-center justify-between shadow-sm">
          <h2 className="font-bold text-lg flex items-center">
            <ShoppingCart className="w-5 h-5 mr-2 text-[#D4AF37]" /> Current Order
          </h2>
          <span className="bg-white/20 text-xs px-2 py-1 rounded-full">{cart.length} Items</span>
        </div>

        {/* Cart Items List */}
        <div className="flex-1 overflow-y-auto p-3 space-y-3 bg-gray-50">
          {cart.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-gray-400">
              <ShoppingCart className="w-12 h-12 mb-3 opacity-20" />
              <p className="text-sm">ခြင်းတောင်းထဲတွင် ဘာမှမရှိသေးပါ</p>
            </div>
          ) : (
            cart.map((item) => (
              <div key={item.id} className="bg-white p-3 rounded-lg shadow-sm border border-gray-100 flex justify-between items-center">
                <div className="flex-1">
                  <div className="font-semibold text-sm text-gray-800">{item.name}</div>
                  <div className="text-[#123524] font-bold text-sm mt-1">{(item.price * item.quantity).toLocaleString()} Ks</div>
                </div>
                <div className="flex items-center space-x-3 ml-2">
                  <div className="flex items-center bg-gray-100 rounded-lg">
                    <button onClick={() => updateQuantity(item.id, -1)} className="p-1.5 text-gray-600 hover:text-black"><Minus className="w-4 h-4" /></button>
                    <span className="w-6 text-center font-bold text-sm">{item.quantity}</span>
                    <button onClick={() => updateQuantity(item.id, 1)} className="p-1.5 text-gray-600 hover:text-black"><Plus className="w-4 h-4" /></button>
                  </div>
                  <button onClick={() => removeFromCart(item.id)} className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg"><Trash2 className="w-4 h-4" /></button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Total & Checkout Button */}
        <div className="p-4 bg-white border-t border-gray-200">
          <div className="flex justify-between items-center mb-4">
            <span className="text-gray-500 font-bold">Total Amount</span>
            <span className="text-2xl font-bold text-[#123524]">{totalAmount.toLocaleString()} Ks</span>
          </div>
          <button 
            disabled={cart.length === 0}
            className={`w-full py-4 rounded-xl font-bold text-lg flex items-center justify-center transition-all ${
              cart.length > 0 ? 'bg-[#123524] text-[#D4AF37] hover:bg-opacity-90 shadow-lg' : 'bg-gray-200 text-gray-400 cursor-not-allowed'
            }`}
          >
            <CreditCard className="w-5 h-5 mr-2" />
            Charge (ငွေရှင်းမည်)
          </button>
        </div>
      </div>

    </div>
  );
}
