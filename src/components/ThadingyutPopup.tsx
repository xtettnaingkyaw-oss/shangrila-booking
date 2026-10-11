import React, { useState, useEffect } from 'react';
import { X, Gift } from 'lucide-react';
import { AppData } from '../shared'; // AppData ကို import လုပ်ပါ

interface ThadingyutPopupProps {
  appData: AppData;
}

export default function ThadingyutPopup({ appData }: ThadingyutPopupProps) {
  const [show, setShow] = useState(false);

  // 🌟 Admin က Promotion ပိတ်ထားလျှင် (isActive === false) ဘာမှမပြပါ
  const isPromotionActive = appData?.promotion?.isActive;
  // 🌟 Admin ပေးသော ခေါင်းစဉ် (မရှိပါက Default စာသားပြမည်)
  const campaignTitle = appData?.promotion?.campaignTitle || "သီတင်းကျွတ် အထူးအစီအစဉ်";

  useEffect(() => {
    if (!isPromotionActive) return;

    const hasSeenPopup = sessionStorage.getItem('thadingyut_popup_seen');
    if (!hasSeenPopup) {
      const timer = setTimeout(() => {
        setShow(true);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [isPromotionActive]);

  const handleClose = () => {
    setShow(false);
    sessionStorage.setItem('thadingyut_popup_seen', 'true');
  };

  const goToCampaign = () => {
    sessionStorage.setItem('thadingyut_popup_seen', 'true');
    window.location.href = '/?mode=campaign';
  };

  if (!show || !isPromotionActive) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-500">
      <div className="bg-gradient-to-br from-red-950 via-[#1a0f14] to-black w-full max-w-sm rounded-3xl overflow-hidden shadow-[0_0_40px_rgba(255,165,0,0.3)] border border-yellow-600/40 relative animate-in zoom-in-95 duration-500">
        
        <button 
          onClick={handleClose}
          className="absolute top-3 right-3 p-2 bg-black/40 hover:bg-white/20 rounded-full text-white/70 hover:text-white transition z-10"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="h-24 bg-gradient-to-r from-yellow-600 via-orange-500 to-red-600 relative overflow-hidden flex items-center justify-center">
          <span className="text-4xl absolute animate-bounce drop-shadow-md">🏮</span>
          <div className="absolute inset-0 opacity-20 bg-[url('https://www.transparenttextures.com/patterns/stardust.png')]"></div>
        </div>

        <div className="p-6 text-center">
          {/* 🌟 Dynamic Promotion Title 🌟 */}
          <h2 className="text-2xl font-bold text-yellow-400 mb-2">{campaignTitle}</h2>
          <p className="text-gray-300 text-sm mb-6 leading-relaxed">
            မီးပုံးလေးတွေကို အမိဖမ်းပြီး လူကြီးမင်းအတွက် <strong className="text-yellow-500">၅၀% အထိ Discount</strong> ကံစမ်းမဲများကို ယခုပဲ ရယူလိုက်ပါ။
          </p>
          
          <button 
            onClick={goToCampaign}
            className="w-full py-3.5 bg-yellow-500 hover:bg-yellow-400 text-black rounded-xl font-bold text-lg shadow-[0_0_15px_rgba(255,215,0,0.4)] transition flex items-center justify-center"
          >
            <Gift className="w-5 h-5 mr-2" /> ယခုပဲ ကံစမ်းမည်
          </button>
          
          <button onClick={handleClose} className="mt-4 text-xs text-gray-500 hover:text-gray-300 transition">
            နောက်မှ ကံစမ်းတော့မည်
          </button>
        </div>
      </div>
    </div>
  );
}
