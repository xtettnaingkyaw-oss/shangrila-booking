import React, { useState, useEffect } from 'react';
import { Gift, X, Sparkles } from 'lucide-react';
import { AppData } from '../shared';

const getLocalTodayStr = () => {
  const d = new Date();
  return (
    d.getFullYear() +
    '-' +
    String(d.getMonth() + 1).padStart(2, '0') +
    '-' +
    String(d.getDate()).padStart(2, '0')
  );
};

export default function ThadingyutPopup({ appData }: { appData: AppData }) {
  const [isVisible, setIsVisible] = useState(false);
  const [fallingLanterns, setFallingLanterns] = useState<
    { id: number; left: number; duration: number; size: number; delay: number; opacity: number }[]
  >([]);

  // ============================================================================
  // 🌟 UNIVERSAL POPUP & CAMPAIGN CHECKER (လက်ရှိနှင့် အသစ်ထပ်လုပ်မည့် Campaign အားလုံးအတွက်) 🌟
  // ============================================================================
  const getActivePopupCampaign = () => {
    const promo: any = appData?.promotion;
    if (!promo) return null;

    const todayStr = getLocalTodayStr();

    // 1. Admin Dashboard မှ "All OFF" သို့မဟုတ် Popup Game ပိတ်ထားပါက လုံးဝ မပြပါ
    if (
      promo.allOff === true ||
      promo.isActive === false ||
      promo.enabled === false ||
      promo.popupEnabled === false ||
      promo.miniGamePopup === false ||
      promo.gameEnabled === false ||
      promo.isPopupActive === false
    ) {
      return null;
    }

    // 2. Saved Promotion & Campaign Cards စာရင်းရှိပါက Active ဖြစ်ပြီး Mini Game Popup ဖွင့်ထားသော ကဒ်ကို ရှာမည်
    const cards: any[] =
      promo.campaigns ||
      promo.cards ||
      promo.savedCampaigns ||
      (appData as any)?.campaigns ||
      [];

    if (Array.isArray(cards) && cards.length > 0) {
      const activeCard = cards.find((c: any) => {
        const cardEnabled =
          c.isActive === true || c.active === true || c.enabled === true || c.status === 'ACTIVE';
        const popupAllowed =
          c.miniGamePopup !== false &&
          c.popupEnabled !== false &&
          c.gameEnabled !== false &&
          c.isPopupActive !== false;
        const withinDate =
          (!c.startDate || todayStr >= c.startDate) &&
          (!c.endDate || todayStr <= c.endDate);

        return cardEnabled && popupAllowed && withinDate;
      });

      // Cards စာရင်းရှိသော်လည်း မည်သည့် Card မှ Popup ဖွင့်မထားပါက Popup လုံးဝ မတက်ရပါ
      if (!activeCard) return null;

      return {
        id: activeCard.id || activeCard.slug || '',
        title: activeCard.title || activeCard.campaignTitle || promo.campaignTitle || 'အထူးပရိုမိုးရှင်း အစီအစဉ်',
        maxDiscount: activeCard.otherDiscount || activeCard.maxDiscount || 50
      };
    }

    // 3. Card စာရင်းမသုံးဘဲ Single Promotion Object သုံးထားပါက isActive နှင့် ရက်စွဲကို တိကျစွာ စစ်ဆေးမည်
    if (promo.isActive !== true || !promo.startDate || !promo.endDate) {
      return null;
    }

    const withinPromoDate = todayStr >= promo.startDate && todayStr <= promo.endDate;
    if (!withinPromoDate) return null;

    return {
      id: promo.id || '',
      title: promo.campaignTitle || 'သီတင်းကျွတ် အထူးပရိုမိုးရှင်း',
      maxDiscount: 50
    };
  };

  const activePopupCampaign = getActivePopupCampaign();

  useEffect(() => {
    // 🌟 Admin Setting မှ ပိတ်ထားလျှင် (သို့မဟုတ် သက်တမ်းကုန်လျှင်) Popup ကို ချက်ချင်းပိတ်မည် 🌟
    if (!activePopupCampaign) {
      setIsVisible(false);
      return;
    }

    const dismissed = sessionStorage.getItem('shangrila_popup_dismissed');
    const searchParams = new URLSearchParams(window.location.search);
    const isCampaignMode =
      searchParams.get('mode') === 'campaign' || Boolean(searchParams.get('campaign'));

    if (!dismissed && !isCampaignMode) {
      // App ပွင့်ပြီး ၃ စက္ကန့် (3000ms) ကြာမှ Popup ပေါ်လာမည်
      const timer = setTimeout(() => {
        setIsVisible(true);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [appData, activePopupCampaign?.id, activePopupCampaign?.title]);

  // 🌟 နောက်ခံတွင် ညင်သာစွာ ကျဆင်းလာမည့် Ambient Lanterns 🌟
  useEffect(() => {
    if (!isVisible || !activePopupCampaign) return;

    const initial = Array.from({ length: 9 }).map((_, i) => ({
      id: i,
      left: 6 + i * 10.5 + (Math.random() * 4 - 2),
      duration: 4 + Math.random() * 3,
      size: 0.85 + Math.random() * 0.65,
      delay: Math.random() * 2.5,
      opacity: 0.45 + Math.random() * 0.45
    }));
    setFallingLanterns(initial);
  }, [isVisible, activePopupCampaign]);

  const handleClose = () => {
    sessionStorage.setItem('shangrila_popup_dismissed', 'true');
    setIsVisible(false);
  };

  // 🌟 ခလုတ်နှိပ်လိုက်သည့်အခါ Ripple Click Effect ပေါ်ပြီးမှ သက်ဆိုင်ရာ Campaign သို့ သွားမည့် Function 🌟
  const handlePlayNowClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    const button = e.currentTarget;
    button.style.transform = 'scale(0.95)';

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

      const targetUrl = activePopupCampaign?.id
        ? `/?mode=campaign&campaign=${encodeURIComponent(activePopupCampaign.id)}`
        : '/?mode=campaign';
      window.location.href = targetUrl;
    }, 320);
  };

  // Setting ပိတ်ထားပါက လုံးဝ Render မလုပ်ပါ
  if (!isVisible || !activePopupCampaign) return null;

  const campaignTitle = activePopupCampaign.title;

  return (
    <div className="fixed inset-0 z-[999] bg-black/45 backdrop-blur-[2px] flex items-center justify-center p-5 animate-fade-in">
      <style>{`
        @keyframes ambientLanternDrift {
          0% { transform: translateY(-30px) translateX(0px) rotate(-6deg) scale(0.85); opacity: 0; }
          20% { opacity: var(--max-op, 0.75); }
          65% { opacity: var(--max-op, 0.75); }
          100% { transform: translateY(190px) translateX(8px) rotate(8deg) scale(1.05); opacity: 0; }
        }
        .ambient-lantern {
          position: absolute;
          top: 0;
          animation-name: ambientLanternDrift;
          animation-timing-function: ease-in-out;
          animation-iteration-count: infinite;
          pointer-events: none;
          filter: drop-shadow(0 0 10px rgba(255, 165, 0, 0.85));
          user-select: none;
        }
        @keyframes centerFloat {
          0%, 100% { transform: translateY(0px) scale(1); }
          50% { transform: translateY(-5px) scale(1.04); }
        }
        .center-emblem-float {
          animation: centerFloat 3.5s ease-in-out infinite;
        }
        .popup-ripple-effect {
          position: absolute;
          border-radius: 50%;
          background: rgba(255, 255, 255, 0.65);
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
        @keyframes goldShimmer {
          0% { transform: translateX(-120%) skewX(-15deg); }
          100% { transform: translateX(220%) skewX(-15deg); }
        }
        .btn-shimmer-sweep {
          animation: goldShimmer 2.8s infinite;
        }
      `}</style>

      {/* 🌟 Main Luxury Modal Card 🌟 */}
      <div className="relative w-full max-w-[340px] rounded-[2rem] p-[1.5px] bg-gradient-to-b from-[#D4AF37]/90 via-[#D4AF37]/30 to-[#D4AF37]/70 shadow-[0_20px_50px_rgba(0,0,0,0.75),0_0_35px_rgba(212,175,55,0.25)] animate-slide-up overflow-hidden">
        <div className="relative w-full h-full rounded-[calc(2rem-1.5px)] bg-gradient-to-b from-[#2a0e08] via-[#140705] to-[#0a0403] px-6 pt-7 pb-6 text-center overflow-hidden">
          {/* Inner Luxury Thin Gold Frame */}
          <div className="absolute inset-2.5 rounded-[1.5rem] border border-[#D4AF37]/15 pointer-events-none z-20"></div>

          {/* Top Warm Ambient Spotlight */}
          <div className="absolute -top-20 left-1/2 -translate-x-1/2 w-72 h-52 bg-gradient-to-b from-amber-500/35 via-orange-600/15 to-transparent rounded-full blur-2xl pointer-events-none"></div>

          {/* 🌟 Softly Falling Lanterns in Upper Sky 🌟 */}
          <div
            className="absolute top-0 left-0 right-0 h-44 overflow-hidden pointer-events-none z-0"
            style={{
              WebkitMaskImage: 'linear-gradient(to bottom, black 45%, transparent 100%)',
              maskImage: 'linear-gradient(to bottom, black 45%, transparent 100%)'
            }}
          >
            {fallingLanterns.map((l) => (
              <div
                key={l.id}
                className="ambient-lantern"
                style={{
                  left: `${l.left}%`,
                  animationDuration: `${l.duration}s`,
                  animationDelay: `${l.delay}s`,
                  fontSize: `${l.size}rem`,
                  ['--max-op' as any]: l.opacity
                }}
              >
                🏮
              </div>
            ))}
          </div>

          {/* Close (X) Button */}
          <button
            type="button"
            onClick={handleClose}
            className="absolute top-4 right-4 z-30 w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 backdrop-blur-md text-yellow-100/80 hover:text-white flex items-center justify-center transition border border-[#D4AF37]/30 shadow-sm active:scale-90"
          >
            <X className="w-4 h-4" />
          </button>

          {/* 🌟 Centerpiece Floating Lantern Emblem 🌟 */}
          <div className="relative z-10 mt-1 mb-4 flex flex-col items-center">
            <div className="inline-flex items-center gap-1 px-3 py-0.5 rounded-full bg-[#D4AF37]/15 border border-[#D4AF37]/40 text-[#D4AF37] text-[9px] font-extrabold uppercase tracking-[0.2em] mb-3 shadow-sm">
              <Sparkles className="w-2.5 h-2.5" /> Exclusive Event
            </div>

            <div className="relative w-16 h-16 rounded-full bg-gradient-to-b from-amber-500/25 to-orange-900/40 border border-[#D4AF37]/50 flex items-center justify-center shadow-[0_0_25px_rgba(245,158,11,0.35)] center-emblem-float">
              <div className="absolute inset-1 rounded-full border border-yellow-300/20"></div>
              <span className="text-3xl filter drop-shadow-[0_2px_8px_rgba(255,165,0,0.8)]">🏮</span>
            </div>
          </div>

          {/* 🌟 Typography & Offer Details 🌟 */}
          <div className="relative z-10">
            <h2
              className="text-lg sm:text-xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-yellow-200 via-[#D4AF37] to-yellow-200 mb-2.5 tracking-wide drop-shadow-sm"
              style={{ lineHeight: '1.75' }}
            >
              {campaignTitle}
            </h2>

            <p
              className="text-[11.5px] sm:text-xs text-gray-300/95 font-medium mb-6 px-1"
              style={{ lineHeight: '1.75' }}
            >
              မီးပုံးလေးတွေကို အမိဖမ်းပြီး လူကြီးမင်းအတွက်{' '}
              <span className="text-yellow-400 font-extrabold underline decoration-[#D4AF37]/50 underline-offset-4">
                ၅၀% အထိ Discount
              </span>{' '}
              ကံစမ်းမဲများကို ယခုပဲ ရယူလိုက်ပါ။
            </p>

            {/* 🌟 Luxury 3D Gold CTA Button with Ripple & Shimmer 🌟 */}
            <button
              type="button"
              onClick={handlePlayNowClick}
              className="relative overflow-hidden w-full py-3.5 bg-gradient-to-r from-[#D4AF37] via-yellow-400 to-[#c59b27] text-[#123524] rounded-xl font-black text-xs sm:text-sm shadow-[0_6px_20px_rgba(212,175,55,0.4)] hover:shadow-[0_8px_25px_rgba(212,175,55,0.6)] border border-yellow-200/60 transition-all duration-200 flex items-center justify-center tracking-wide"
              style={{ lineHeight: '1.6' }}
            >
              <span className="absolute inset-0 w-1/2 h-full bg-gradient-to-r from-transparent via-white/50 to-transparent btn-shimmer-sweep pointer-events-none"></span>
              <Gift className="w-4 h-4 mr-2 relative z-10 stroke-[2.5]" />
              <span className="relative z-10">ယခုပဲ ကံစမ်းမည်</span>
            </button>

            <button
              type="button"
              onClick={handleClose}
              className="mt-3.5 text-[11px] font-semibold text-gray-400 hover:text-[#D4AF37] transition py-1 px-4 active:scale-95 tracking-wide"
              style={{ lineHeight: '1.6' }}
            >
              နောက်မှ ကံစမ်းတော့မည်
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
