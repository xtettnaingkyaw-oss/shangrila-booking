import React, { useState, useEffect } from 'react';
import { Gift, X } from 'lucide-react';
import { AppData } from '../shared';

const getLocalTodayStr = () => {
  const d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
};

export default function ThadingyutPopup({ appData }: { appData: AppData }) {
  const [isVisible, setIsVisible] = useState(false);
  const [fallingLanterns, setFallingLanterns] = useState<{ id: number; left: number; duration: number; size: number; delay: number }[]>([]);

  useEffect(() => {
    const promo = appData?.promotion;
    if (!promo?.isActive || !promo.startDate || !promo.endDate) return;

    const todayMillis = new Date(getLocalTodayStr()).getTime();
    const sDate = new Date(promo.startDate).getTime();
    const eDate = new Date(promo.endDate).getTime();

    if (todayMillis >= sDate && todayMillis <= eDate) {
      const dismissed = sessionStorage.getItem('shangrila_popup_dismissed');
      const searchParams = new URLSearchParams(window.location.search);
      if (!dismissed && searchParams.get('campaign') !== 'true') {
        setIsVisible(true);
      }
    }
  }, [appData]);

  // 🌟 အပေါ်ပိုင်း Header ထဲတွင် မီးပုံးလေးများ အဆက်မပြတ် ကျလာစေမည့် Animation 🌟
  useEffect(() => {
    if (!isVisible) return;

    // စစချင်း မီးပုံး (၈) လုံး တန်းပေါ်နေစေရန်
    const initial = Array.from({ length: 8 }).map((_, i) => ({
      id: Date.now() + i,
      left: 8 + Math.random() * 84,
      duration: 2.2 + Math.random() * 1.8,
      size: 1.1 + Math.random() * 0.9,
      delay: Math.random() * 1.2
    }));
    setFallingLanterns(initial);

    const interval = setInterval(() => {
      setFallingLanterns(prev => {
        const next = prev.length > 14 ? prev.slice(1) : prev;
        return [
          ...next,
          {
            id: Date.now() + Math.random(),
            left: 8 + Math.random() * 84,
            duration: 2.2 + Math.random() * 1.8,
            size: 1.1 + Math.random() * 0.9,
            delay: 0
          }
        ];
      });
    }, 350);

    return () => clearInterval(interval);
  }, [isVisible]);

  const handleClose = () => {
    sessionStorage.setItem('shangrila_popup_dismissed', 'true');
    setIsVisible(false);
  };

  // 🌟 ခလုတ်နှိပ်လိုက်သည့်အခါ Ripple Click Effect ပေါ်ပြီးမှ သွားမည့် Function 🌟
  const handlePlayNowClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    const button = e.currentTarget;
    button.style.transform = 'scale(0.94)';

    const circle = document.createElement('span');
    const diameter = Math.max(button.clientWidth, button.clientHeight);
    const radius = diameter / 2;
    const rect = button.getBoundingClientRect();

    circle.style.width = circle.style.height = `${diameter}px`;
    circle.style.left = `${e.clientX - rect.left - radius}px`;
    circle.style.top = `${e.clientY - rect.top - radius}px`;
    circle.classList.add('popup-ripple-effect');

    button.appendChild(circle);

    setTimeout(() => {
      button.style.transform = 'scale(1)';
      circle.remove();
      sessionStorage.setItem('shangrila_popup_dismissed', 'true');
      setIsVisible(false);
      window.location.href = '/?mode=campaign';
    }, 320);
  };

  if (!isVisible) return null;

  const campaignTitle = appData?.promotion?.campaignTitle || 'သီတင်းကျွတ် အထူးပရိုမိုးရှင်း';

  return (
    <div className="fixed inset-0 z-[999] bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
      <style>{`
        @keyframes popupLanternFall {
          0% { transform: translateY(-35px) rotate(-10deg) scale(0.9); opacity: 0; }
          20% { opacity: 1; }
          80% { opacity: 1; }
          100% { transform: translateY(145px) rotate(12deg) scale(1.05); opacity: 0; }
        }
        .popup-falling-lantern {
          position: absolute;
          top: -10px;
          animation-name: popupLanternFall;
          animation-timing-function: linear;
          animation-iteration-count: infinite;
          pointer-events: none;
          filter: drop-shadow(0 0 8px rgba(255, 200, 0, 0.7));
          user-select: none;
        }
        .popup-ripple-effect {
          position: absolute;
          border-radius: 50%;
          background: rgba(255, 255, 255, 0.55);
          transform: scale(0);
          animation: popupRipple 0.55s ease-out;
          pointer-events: none;
        }
        @keyframes popupRipple {
          to {
            transform: scale(4);
            opacity: 0;
          }
        }
      `}</style>

      <div className="relative w-full max-w-sm rounded-[2rem] overflow-hidden shadow-[0_15px_50px_rgba(255,140,0,0.35)] border border-yellow-500/40 bg-[#140707] animate-slide-up">
        
        {/* 🌟 အပေါ်ပိုင်း မီးပုံးများ အများကြီးကျလာမည့် Header Area (ပုံ-၁ ဝိုင်းထားသည့်နေရာ) 🌟 */}
        <div className="relative h-32 bg-gradient-to-r from-amber-500 via-orange-500 to-red-600 overflow-hidden flex items-center justify-center">
          {/* နောက်ခံ အလင်းရောင် Glow */}
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(255,255,200,0.25),transparent_70%)]"></div>

          {/* အပေါ်မှ တဖွဲဖွဲကျလာသော မီးပုံးများ */}
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            {fallingLanterns.map((l) => (
              <div
                key={l.id}
                className="popup-falling-lantern"
                style={{
                  left: `${l.left}%`,
                  animationDuration: `${l.duration}s`,
                  animationDelay: `${l.delay}s`,
                  fontSize: `${l.size}rem`
                }}
              >
                🏮
              </div>
            ))}
          </div>

          {/* ညာဘက်အပေါ်ထောင့်မှ ပိတ်သည့် (X) ခလုတ် */}
          <button
            type="button"
            onClick={handleClose}
            className="absolute top-3.5 right-3.5 z-20 w-9 h-9 rounded-full bg-black/40 hover:bg-black/60 text-white flex items-center justify-center transition border border-white/20 shadow-md active:scale-90"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 🌟 အောက်ပိုင်း စာသားနှင့် ခလုတ် Area 🌟 */}
        <div className="p-6 sm:p-7 text-center relative">
          <div className="absolute -top-10 left-1/2 -translate-x-1/2 w-40 h-20 bg-orange-500/20 blur-2xl pointer-events-none"></div>

          <h2 className="text-xl sm:text-2xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-yellow-300 via-yellow-400 to-amber-500 mb-3 tracking-wide leading-snug drop-shadow-sm">
            {campaignTitle}
          </h2>

          <p className="text-xs sm:text-sm text-gray-200 font-semibold leading-relaxed mb-6 px-2">
            မီးပုံးလေးတွေကို အမိဖမ်းပြီး လူကြီးမင်းအတွက်{' '}
            <span className="text-yellow-400 font-extrabold">၅၀% အထိ Discount</span> ကံစမ်းမဲများကို ယခုပဲ ရယူလိုက်ပါ။
          </p>

          {/* 🌟 Click Effect ပါဝင်သော "ယခုပဲ ကံစမ်းမည်" ခလုတ် 🌟 */}
          <button
            type="button"
            onClick={handlePlayNowClick}
            className="relative overflow-hidden w-full py-4 bg-gradient-to-r from-yellow-400 via-amber-400 to-yellow-500 text-black rounded-2xl font-black text-sm sm:text-base shadow-[0_0_25px_rgba(250,204,21,0.5)] hover:shadow-[0_0_35px_rgba(250,204,21,0.75)] transition-all duration-200 flex items-center justify-center"
          >
            <Gift className="w-5 h-5 mr-2 relative z-10 stroke-[2.5]" />
            <span className="relative z-10">ယခုပဲ ကံစမ်းမည်</span>
          </button>

          <button
            type="button"
            onClick={handleClose}
            className="mt-4 text-xs font-bold text-gray-400 hover:text-gray-200 transition py-1 px-4 active:scale-95"
          >
            နောက်မှ ကံစမ်းတော့မည်
          </button>
        </div>
      </div>
    </div>
  );
}
