import React, { useState, useEffect } from 'react';
import { PartyPopper, ArrowLeft, Sparkles, Timer, UserCircle, LogIn, MessageCircle, AlertCircle, Info, CalendarCheck } from 'lucide-react';
import { AppData } from '../shared';
import { db } from '../firebase';
import { collection, addDoc, getDocs, query, updateDoc, doc } from 'firebase/firestore';

interface ThadingyutCampaignProps {
  appData: AppData;
}

interface Lantern {
  id: number;
  left: number;
  duration: number;
  size: number;
  delay?: number;
  opacity?: number;
}

// 🌟 မီးပန်းဖွာထွက်မည့် Particle ဒေတာများ (၁၆ ခု - အရပ်မျက်နှာပေါင်းစုံ) 🌟
const FIREWORK_PARTICLES = Array.from({ length: 18 }).map((_, i) => {
  const angle = (i * 20 * Math.PI) / 180;
  const distance = 90 + (i % 3) * 45;
  return {
    id: i,
    tx: `${Math.cos(angle) * distance}px`,
    ty: `${Math.sin(angle) * distance}px`,
    color: i % 3 === 0 ? '#FFD700' : i % 3 === 1 ? '#FF6B00' : '#FFF3B0',
    size: i % 2 === 0 ? '8px' : '5px',
    emoji: i % 4 === 0 ? '✨' : i % 5 === 0 ? '🎆' : ''
  };
});

export default function ThadingyutCampaign({ appData }: ThadingyutCampaignProps) {
  const [gameState, setGameState] = useState<'start' | 'playing' | 'opening' | 'result'>('start');
  const [timeLeft, setTimeLeft] = useState(15);
  const [lanterns, setLanterns] = useState<Lantern[]>([]);
  const [miniLanterns, setMiniLanterns] = useState<Lantern[]>([]);

  const [prize, setPrize] = useState<number>(0);
  const [userPhone, setUserPhone] = useState<string>('');
  const [checkingUser, setCheckingUser] = useState(false);
  const [caughtLantern, setCaughtLantern] = useState<{ id: number; left: number; top: number } | null>(null);
  const [isBursting, setIsBursting] = useState(false);

  const [recordId, setRecordId] = useState<string | null>(null);
  const [alreadyPlayedToday, setAlreadyPlayedToday] = useState(false);

  const campaignTitle = appData?.promotion?.campaignTitle || 'သီတင်းကျွတ် အထူးပရိုမိုးရှင်း';

  useEffect(() => {
    const savedPhone = localStorage.getItem('shangrila_user_phone');
    if (savedPhone) {
      setUserPhone(savedPhone);
      checkInitialStatus(savedPhone);
    }
  }, []);

  const getTodayStr = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };

  const checkInitialStatus = async (phone: string) => {
    try {
      const q = query(collection(db, 'campaign_records'));
      const querySnapshot = await getDocs(q);
      const today = getTodayStr();

      querySnapshot.forEach((docSnap) => {
        const data = docSnap.data();
        if (data.phone === phone && data.date === today) {
          setAlreadyPlayedToday(true);
          setPrize(data.discountPercent || 0);
          setRecordId(docSnap.id);
        }
      });
    } catch (e) {}
  };

  const calculatePrize = () => {
    const rand = Math.random() * 100;
    if (rand < 40) return 15;
    if (rand < 70) return 10;
    if (rand < 85) return 20;
    if (rand < 95) return 30;
    return 50;
  };

  const startGame = async () => {
    if (!userPhone) return;
    setCheckingUser(true);

    try {
      const q = query(collection(db, 'campaign_records'));
      const querySnapshot = await getDocs(q);
      let alreadyPlayed = false;
      const today = getTodayStr();

      querySnapshot.forEach((docSnap) => {
        const data = docSnap.data();
        if (data.phone === userPhone && data.date === today) {
          alreadyPlayed = true;
          setPrize(data.discountPercent || 0);
          setRecordId(docSnap.id);
        }
      });

      if (alreadyPlayed) {
        setAlreadyPlayedToday(true);
      } else {
        setGameState('playing');
        setTimeLeft(15);
        setLanterns([]);
      }
    } catch (error: any) {
      alert(`ချိတ်ဆက်မှု အခက်အခဲဖြစ်နေပါသည်။ (Error: ${error.message})`);
    }
    setCheckingUser(false);
  };

  useEffect(() => {
    let lanternInterval: any;
    let timerInterval: any;

    if (gameState === 'start') {
      // Start Card အပေါ်ပိုင်းတွင် ညင်သာစွာ ကျလာမည့် Ambient Lanterns
      const initial = Array.from({ length: 9 }).map((_, i) => ({
        id: i,
        left: 6 + i * 10.5 + (Math.random() * 4 - 2),
        duration: 4 + Math.random() * 3,
        size: 0.9 + Math.random() * 0.65,
        delay: Math.random() * 2.5,
        opacity: 0.45 + Math.random() * 0.45
      }));
      setMiniLanterns(initial);
    } else if (gameState === 'playing') {
      lanternInterval = setInterval(() => {
        setLanterns((prev) => [
          ...prev,
          {
            id: Date.now() + Math.random(),
            left: 5 + Math.random() * 85,
            duration: 1.6 + Math.random() * 2.2,
            size: 2.5 + Math.random() * 1.8
          }
        ]);
      }, 160);
      timerInterval = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            setGameState('start');
            alert('အချိန်ကုန်သွားပါပြီ။ နောက်တစ်ကြိမ် ထပ်မံကံစမ်းကြည့်ပါ!');
            return 15;
          }
          return prev - 1;
        });
      }, 1000);
    }

    return () => {
      clearInterval(lanternInterval);
      clearInterval(timerInterval);
    };
  }, [gameState]);

  const saveRecordToDB = async (finalPrize: number) => {
    try {
      const docRef = await addDoc(collection(db, 'campaign_records'), {
        phone: userPhone,
        discountPercent: finalPrize,
        title: campaignTitle,
        date: getTodayStr(),
        telegramClicked: false,
        createdAt: Date.now()
      });
      setRecordId(docRef.id);
      localStorage.setItem('shangrila_campaign_discount', finalPrize.toString());
      localStorage.setItem('shangrila_campaign_label', campaignTitle);
    } catch (err: any) {
      console.error('Save error', err);
    }
  };

  const catchLantern = (e: React.MouseEvent | React.TouchEvent, id: number) => {
    e.stopPropagation();
    if (gameState !== 'playing') return;
    let clientX = window.innerWidth / 2;
    let clientY = window.innerHeight / 2;
    if ('touches' in e && e.touches.length > 0) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else if ('clientX' in e) {
      clientX = (e as React.MouseEvent).clientX;
      clientY = (e as React.MouseEvent).clientY;
    }

    const wonPrize = calculatePrize();
    setPrize(wonPrize);
    setIsBursting(false);
    setCaughtLantern({ id, left: clientX, top: clientY });
    setGameState('opening');
    saveRecordToDB(wonPrize);
  };

  // 🌟 မီးပုံးကို နှိပ်လိုက်သည့်အခါ မီးပန်းများ ဖွာထွက်ပြီးမှ Result ပြမည် 🌟
  const openCaughtLantern = () => {
    if (isBursting) return;
    setIsBursting(true);
    setTimeout(() => {
      setGameState('result');
      setIsBursting(false);
    }, 750);
  };

  const goToLogin = () => {
    window.location.href = '/?view=profile&return=campaign';
  };

  const viewPreviousResult = () => {
    setGameState('result');
    localStorage.setItem('shangrila_campaign_discount', prize.toString());
    localStorage.setItem('shangrila_campaign_label', campaignTitle);
  };

  const getTelegramLink = () => {
    const tgLink = appData.branding?.telegram || 'https://t.me/admin';
    const msg = encodeURIComponent(
      `မင်္ဂလာပါ။ ${campaignTitle} ကနေ ${prize}% Discount ပေါက်ထားပါတယ်။\nဖုန်းနံပါတ်: ${userPhone}\nPromo Code: PROMO-${prize}`
    );

    let finalLink = tgLink;
    if (!finalLink.startsWith('http')) finalLink = `https://t.me/${finalLink.replace('@', '')}`;
    return `${finalLink}?text=${msg}`;
  };

  const markTelegramClicked = async () => {
    if (recordId) {
      try {
        await updateDoc(doc(db, 'campaign_records', recordId), { telegramClicked: true });
      } catch (e) {}
    }
  };

  // 🌟 ခလုတ်နှိပ်လိုက်သည့်အခါ Ripple Click Effect ပေါ်စေရန် Function 🌟
  const handleButtonClickWithEffect = (e: React.MouseEvent<HTMLButtonElement>, callback: () => void) => {
    const button = e.currentTarget;
    button.style.transform = 'scale(0.95)';

    const circle = document.createElement('span');
    const diameter = Math.max(button.clientWidth, button.clientHeight);
    const radius = diameter / 2;

    const rect = button.getBoundingClientRect();
    circle.style.width = circle.style.height = `${diameter}px`;
    circle.style.left = `${e.clientX - rect.left - radius}px`;
    circle.style.top = `${e.clientY - rect.top - radius}px`;
    circle.classList.add('campaign-ripple-effect');

    button.appendChild(circle);

    setTimeout(() => {
      button.style.transform = 'scale(1)';
      circle.remove();
      callback();
    }, 280);
  };

  return (
    <div className="min-h-screen bg-[#0c0504] text-white flex flex-col relative overflow-hidden font-sans">
      <style>{`
        @keyframes fall {
          0% { transform: translateY(-10vh) rotate(-10deg); opacity: 0; }
          10% { opacity: 1; }
          100% { transform: translateY(110vh) rotate(20deg); opacity: 0; }
        }
        .lantern-anim {
          position: absolute;
          animation-name: fall;
          animation-timing-function: linear;
          cursor: pointer;
          filter: drop-shadow(0 0 14px rgba(255, 165, 0, 0.85));
          transition: transform 0.1s;
          user-select: none;
        }
        .lantern-anim:active { transform: scale(1.45); }

        @keyframes ambientDrift {
          0% { transform: translateY(-30px) translateX(0px) rotate(-6deg) scale(0.85); opacity: 0; }
          20% { opacity: var(--max-op, 0.75); }
          65% { opacity: var(--max-op, 0.75); }
          100% { transform: translateY(200px) translateX(8px) rotate(8deg) scale(1.05); opacity: 0; }
        }
        .ambient-lantern {
          position: absolute;
          top: 0;
          animation-name: ambientDrift;
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

        @keyframes goldShimmer {
          0% { transform: translateX(-120%) skewX(-15deg); }
          100% { transform: translateX(220%) skewX(-15deg); }
        }
        .btn-shimmer-sweep {
          animation: goldShimmer 2.8s infinite;
        }

        .campaign-ripple-effect {
          position: absolute;
          border-radius: 50%;
          background: rgba(255, 255, 255, 0.6);
          transform: scale(0);
          animation: campaignRipple 0.55s ease-out;
          pointer-events: none;
        }
        @keyframes campaignRipple {
          to { transform: scale(4); opacity: 0; }
        }

        /* 🌟 ဖမ်းမိသော မီးပုံး အလယ်သို့ပျံလာပြီး တဆတ်ဆတ် လှုပ်ခါနေမည့် Animation 🌟 */
        @keyframes flyToCenter {
          0% { left: var(--start-x); top: var(--start-y); transform: translate(-50%, -50%) scale(0.8); }
          100% { left: 50%; top: 46%; transform: translate(-50%, -50%) scale(1); }
        }
        @keyframes lanternWobble {
          0%, 100% { transform: rotate(0deg) scale(1); }
          15% { transform: rotate(-14deg) scale(1.08); }
          30% { transform: rotate(12deg) scale(1.1); }
          45% { transform: rotate(-10deg) scale(1.08); }
          60% { transform: rotate(8deg) scale(1.05); }
          75% { transform: rotate(-5deg) scale(1.02); }
        }
        .caught-lantern-wrapper {
          position: fixed;
          z-index: 100;
          animation: flyToCenter 0.65s cubic-bezier(0.2, 0.8, 0.2, 1) forwards;
        }
        .lantern-shake-continuous {
          display: inline-block;
          font-size: 5.5rem;
          animation: lanternWobble 1.1s ease-in-out infinite;
          filter: drop-shadow(0 0 35px rgba(255, 180, 0, 0.95));
          user-select: none;
        }
        @keyframes lanternPopOut {
          0% { transform: scale(1); opacity: 1; }
          40% { transform: scale(1.55); opacity: 0.9; filter: brightness(2); }
          100% { transform: scale(0); opacity: 0; }
        }
        .lantern-bursting {
          display: inline-block;
          font-size: 5.5rem;
          animation: lanternPopOut 0.45s ease-out forwards;
        }

        /* 🌟 မီးပန်းဖွာထွက်သည့် Firework Particle Animation 🌟 */
        @keyframes fireworkShoot {
          0% { transform: translate(-50%, -50%) scale(0.3); opacity: 1; }
          70% { opacity: 1; }
          100% { transform: translate(calc(-50% + var(--tx)), calc(-50% + var(--ty))) scale(1.3); opacity: 0; }
        }
        .firework-particle {
          position: absolute;
          top: 50%;
          left: 50%;
          border-radius: 50%;
          pointer-events: none;
          animation: fireworkShoot 0.75s cubic-bezier(0.1, 0.8, 0.3, 1) forwards;
        }
        @keyframes shockwaveRing {
          0% { transform: translate(-50%, -50%) scale(0.2); opacity: 0.95; border-width: 6px; }
          100% { transform: translate(-50%, -50%) scale(3.2); opacity: 0; border-width: 1px; }
        }
        .firework-ring {
          position: absolute;
          top: 50%;
          left: 50%;
          width: 90px;
          height: 90px;
          border-radius: 50%;
          border: 4px solid #FFD700;
          box-shadow: 0 0 25px #FFD700;
          pointer-events: none;
          animation: shockwaveRing 0.7s ease-out forwards;
        }
      `}</style>

      {/* 🌟 Luxury Header Bar 🌟 */}
      <div className="px-4 py-3.5 z-50 flex items-center justify-between bg-[#140705]/90 backdrop-blur-md border-b border-[#D4AF37]/25 shadow-md">
        <button
          onClick={() => (window.location.href = '/')}
          className="flex items-center text-[#D4AF37] hover:text-yellow-300 font-bold text-xs sm:text-sm bg-white/5 px-3 py-1.5 rounded-full border border-[#D4AF37]/30 active:scale-95 transition"
        >
          <ArrowLeft className="w-4 h-4 mr-1" /> နောက်သို့
        </button>
        <h1 className="font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-yellow-200 via-[#D4AF37] to-yellow-200 tracking-wider truncate px-2 text-xs sm:text-sm">
          {campaignTitle}
        </h1>
        <div className="w-16"></div>
      </div>

      <div className="flex-1 relative flex items-center justify-center p-4 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-[#2b0f08] via-[#0f0504] to-[#070302]">
        
        {/* ==========================================
            1. START SCREEN (Unified Luxury Popup Style)
           ========================================== */}
        {gameState === 'start' && (
          <div className="relative z-10 w-full max-w-[355px] rounded-[2rem] p-[1.5px] bg-gradient-to-b from-[#D4AF37]/85 via-[#D4AF37]/25 to-[#D4AF37]/65 shadow-[0_20px_60px_rgba(0,0,0,0.9),0_0_45px_rgba(212,175,55,0.18)] animate-fade-in overflow-hidden">
            <div className="relative w-full h-full rounded-[calc(2rem-1.5px)] bg-gradient-to-b from-[#2a0e08] via-[#140705] to-[#0a0403] px-6 pt-7 pb-7 text-center overflow-hidden">
              
              {/* Inner Luxury Thin Gold Frame */}
              <div className="absolute inset-2.5 rounded-[1.5rem] border border-[#D4AF37]/15 pointer-events-none z-20"></div>

              {/* Top Warm Ambient Spotlight */}
              <div className="absolute -top-20 left-1/2 -translate-x-1/2 w-72 h-52 bg-gradient-to-b from-amber-500/35 via-orange-600/15 to-transparent rounded-full blur-2xl pointer-events-none"></div>

              {/* 🌟 Softly Falling Ambient Lanterns (No harsh box border!) 🌟 */}
              <div
                className="absolute top-0 left-0 right-0 h-48 overflow-hidden pointer-events-none z-0"
                style={{
                  WebkitMaskImage: 'linear-gradient(to bottom, black 45%, transparent 100%)',
                  maskImage: 'linear-gradient(to bottom, black 45%, transparent 100%)'
                }}
              >
                {miniLanterns.map((lantern) => (
                  <div
                    key={lantern.id}
                    className="ambient-lantern"
                    style={{
                      left: `${lantern.left}%`,
                      animationDuration: `${lantern.duration}s`,
                      animationDelay: `${lantern.delay || 0}s`,
                      fontSize: `${lantern.size}rem`,
                      ['--max-op' as any]: lantern.opacity || 0.75
                    }}
                  >
                    🏮
                  </div>
                ))}
              </div>

              {/* 🌟 Centerpiece Floating Lantern Emblem 🌟 */}
              <div className="relative z-10 mt-1 mb-4 flex flex-col items-center">
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#D4AF37]/15 border border-[#D4AF37]/40 text-[#D4AF37] text-[9px] font-extrabold uppercase tracking-[0.2em] mb-3.5 shadow-sm">
                  <Sparkles className="w-3 h-3" /> Lucky Draw Game
                </div>

                <div className="relative w-16 h-16 rounded-full bg-gradient-to-b from-amber-500/25 to-orange-900/40 border border-[#D4AF37]/50 flex items-center justify-center shadow-[0_0_25px_rgba(245,158,11,0.35)] center-emblem-float">
                  <div className="absolute inset-1 rounded-full border border-yellow-300/20"></div>
                  <span className="text-3xl filter drop-shadow-[0_2px_8px_rgba(255,165,0,0.8)]">🏮</span>
                </div>
              </div>

              {/* Title & Description */}
              <h2 className="relative z-10 text-xl sm:text-2xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-yellow-200 via-[#D4AF37] to-yellow-200 mb-2.5 tracking-wide leading-snug drop-shadow-sm">
                {campaignTitle}
              </h2>
              <p className="relative z-10 text-gray-300/95 text-xs mb-6 leading-relaxed px-1 font-medium">
                မီးပုံးလေးတွေကို ဖမ်းပြီး{' '}
                <span className="text-yellow-400 font-extrabold underline decoration-[#D4AF37]/50 underline-offset-4">
                  ၅၀% အထိ Discount
                </span>{' '}
                ရယူပါ။ <span className="block text-[10.5px] text-gray-400 mt-1">(တစ်ရက်လျှင် ၁ ကြိမ်သာ ကံစမ်းခွင့်ရှိသည်)</span>
              </p>

              {/* User Status & Action Buttons */}
              <div className="relative z-10">
                {userPhone ? (
                  <div className="space-y-3.5">
                    {/* Luxury User Phone Pill */}
                    <div className="bg-black/50 border border-[#D4AF37]/35 rounded-xl py-3 px-4 flex items-center justify-center shadow-inner">
                      <UserCircle className="w-4 h-4 text-[#D4AF37] mr-2" />
                      <span className="text-xs sm:text-sm font-black text-yellow-400 tracking-[0.18em]">{userPhone}</span>
                    </div>

                    {alreadyPlayedToday ? (
                      <div className="animate-fade-in space-y-3">
                        <div className="bg-amber-950/40 border border-[#D4AF37]/30 rounded-xl p-3.5 text-center shadow-sm">
                          <p className="text-[11px] text-yellow-200/90 font-semibold leading-relaxed">
                            လူကြီးမင်းသည် ယနေ့အတွက် ကံစမ်းခွင့် ပြည့်သွားပါပြီ။ မနက်ဖြန်တွင် ထပ်မံကံစမ်းနိုင်ပါသည်။
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={(e) => handleButtonClickWithEffect(e, viewPreviousResult)}
                          className="relative overflow-hidden w-full py-3.5 bg-gradient-to-r from-[#D4AF37] via-yellow-400 to-[#c59b27] text-[#123524] rounded-xl font-black text-xs sm:text-sm shadow-[0_6px_20px_rgba(212,175,55,0.4)] hover:shadow-[0_8px_25px_rgba(212,175,55,0.6)] border border-yellow-200/60 transition-all duration-200 flex items-center justify-center tracking-wide"
                        >
                          <span className="absolute inset-0 w-1/2 h-full bg-gradient-to-r from-transparent via-white/50 to-transparent btn-shimmer-sweep pointer-events-none"></span>
                          <AlertCircle className="w-4 h-4 mr-2 relative z-10 stroke-[2.5]" />
                          <span className="relative z-10">ရရှိထားသော Discount အား ကြည့်မည်</span>
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={(e) => handleButtonClickWithEffect(e, startGame)}
                        disabled={checkingUser}
                        className="relative overflow-hidden w-full py-4 bg-gradient-to-r from-[#D4AF37] via-yellow-400 to-[#c59b27] text-[#123524] rounded-xl font-black text-sm sm:text-base shadow-[0_6px_25px_rgba(212,175,55,0.45)] hover:shadow-[0_8px_30px_rgba(212,175,55,0.65)] border border-yellow-200/60 transition-all duration-200 flex items-center justify-center disabled:opacity-50 tracking-wide"
                      >
                        <span className="absolute inset-0 w-1/2 h-full bg-gradient-to-r from-transparent via-white/50 to-transparent btn-shimmer-sweep pointer-events-none"></span>
                        {checkingUser ? (
                          <span className="relative z-10">စစ်ဆေးနေပါသည်...</span>
                        ) : (
                          <>
                            <Sparkles className="w-5 h-5 mr-2 relative z-10 stroke-[2.5]" />
                            <span className="relative z-10">ကစားမည် (Play Now)</span>
                          </>
                        )}
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="space-y-3.5">
                    <div className="bg-red-950/50 border border-red-500/30 rounded-xl p-3.5 text-xs text-red-200 font-medium leading-relaxed">
                      ကံစမ်းမဲ ကစားရန်အတွက် အရင်ဆုံး အကောင့် ဝင်ရန် (Login) လိုအပ်ပါသည်။
                    </div>
                    <button
                      type="button"
                      onClick={(e) => handleButtonClickWithEffect(e, goToLogin)}
                      className="relative overflow-hidden w-full py-3.5 bg-gradient-to-r from-[#D4AF37] via-yellow-400 to-[#c59b27] text-[#123524] rounded-xl font-black text-xs sm:text-sm shadow-[0_6px_20px_rgba(212,175,55,0.4)] border border-yellow-200/60 transition-all duration-200 flex items-center justify-center"
                    >
                      <span className="absolute inset-0 w-1/2 h-full bg-gradient-to-r from-transparent via-white/50 to-transparent btn-shimmer-sweep pointer-events-none"></span>
                      <LogIn className="w-4 h-4 mr-2 relative z-10 stroke-[2.5]" />
                      <span className="relative z-10">Login အရင်ဝင်မည်</span>
                    </button>
                  </div>
                )}
              </div>

            </div>
          </div>
        )}

        {/* ==========================================
            2. PLAYING SCREEN (Catching Lanterns)
           ========================================== */}
        {gameState === 'playing' && (
          <>
            <div className="absolute top-5 z-50 bg-[#140705]/90 border border-[#D4AF37]/60 px-6 py-2.5 rounded-full flex items-center text-[#D4AF37] font-black text-lg shadow-[0_0_25px_rgba(212,175,55,0.35)] backdrop-blur-md">
              <Timer className="w-5 h-5 mr-2 animate-pulse text-yellow-400" /> {timeLeft} စက္ကန့်
            </div>
            <div className="absolute bottom-8 z-40 text-center pointer-events-none">
              <span className="text-xs font-bold text-yellow-200/70 bg-black/50 px-4 py-1.5 rounded-full border border-white/10">
                ကျလာသော မီးပုံးလေးတစ်လုံးကို အမိဖမ်းနှိပ်ပါ 🏮
              </span>
            </div>
            {lanterns.map((lantern) => (
              <div
                key={lantern.id}
                onMouseDown={(e) => catchLantern(e, lantern.id)}
                onTouchStart={(e) => catchLantern(e, lantern.id)}
                className="lantern-anim hover:brightness-125"
                style={{
                  left: `${lantern.left}%`,
                  animationDuration: `${lantern.duration}s`,
                  fontSize: `${lantern.size}rem`,
                  top: '-10vh'
                }}
              >
                🏮
              </div>
            ))}
          </>
        )}

        {/* ==========================================
            3. OPENING CAUGHT LANTERN (Shaking + Firework Burst!)
           ========================================== */}
        {gameState === 'opening' && caughtLantern && (
          <div
            className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex flex-col items-center justify-center cursor-pointer"
            onClick={openCaughtLantern}
          >
            <div
              className="caught-lantern-wrapper flex items-center justify-center"
              style={{ '--start-x': `${caughtLantern.left}px`, '--start-y': `${caughtLantern.top}px` } as React.CSSProperties}
            >
              {/* Ambient Pulsing Rings behind Shaking Lantern */}
              {!isBursting && (
                <>
                  <div className="absolute w-36 h-36 rounded-full bg-amber-500/25 blur-2xl animate-pulse pointer-events-none"></div>
                  <div className="absolute w-28 h-28 rounded-full border border-[#D4AF37]/40 animate-ping pointer-events-none" style={{ animationDuration: '1.8s' }}></div>
                </>
              )}

              {/* 🌟 နှိပ်လိုက်သည့်အခါ မီးပန်းများ ဖွာထွက်လာမည့် Fireworks Effect 🌟 */}
              {isBursting && (
                <>
                  <div className="firework-ring"></div>
                  {FIREWORK_PARTICLES.map((p) => (
                    <div
                      key={p.id}
                      className="firework-particle flex items-center justify-center"
                      style={
                        {
                          '--tx': p.tx,
                          '--ty': p.ty,
                          width: p.size,
                          height: p.size,
                          backgroundColor: p.emoji ? 'transparent' : p.color,
                          boxShadow: p.emoji ? 'none' : `0 0 12px ${p.color}`
                        } as React.CSSProperties
                      }
                    >
                      {p.emoji && <span className="text-lg">{p.emoji}</span>}
                    </div>
                  ))}
                </>
              )}

              {/* 🌟 လှုပ်ခါနေသော မီးပုံး 🌟 */}
              <div className={isBursting ? 'lantern-bursting' : 'lantern-shake-continuous'}>
                🏮
              </div>
            </div>

            {!isBursting && (
              <div className="absolute bottom-24 text-center px-6 animate-fade-in">
                <div className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-gradient-to-r from-[#D4AF37]/20 via-amber-500/30 to-[#D4AF37]/20 border border-[#D4AF37]/60 text-yellow-300 font-extrabold text-sm sm:text-base shadow-[0_0_25px_rgba(212,175,55,0.3)] animate-bounce">
                  <Sparkles className="w-4 h-4 text-yellow-400" /> ဆုမဲဖွင့်ရန် မီးပုံးလေးကို နှိပ်ပါ
                </div>
              </div>
            )}
          </div>
        )}

        {/* ==========================================
            4. RESULT SCREEN (Luxury VIP Reward Card)
           ========================================== */}
        {gameState === 'result' && (
          <div className="w-full max-w-[365px] mx-auto max-h-[85vh] overflow-y-auto scrollbar-hide z-50 rounded-[2rem] p-[1.5px] bg-gradient-to-b from-[#D4AF37] via-[#D4AF37]/30 to-[#D4AF37]/70 shadow-[0_20px_60px_rgba(0,0,0,0.9),0_0_50px_rgba(212,175,55,0.25)] animate-fade-in">
            <div className="relative text-center p-6 bg-gradient-to-b from-[#2a0e08] via-[#140705] to-[#0a0403] rounded-[calc(2rem-1.5px)] overflow-hidden">
              
              {/* Top Golden Spotlight & Celebration Sparkles */}
              <div className="absolute -top-20 left-1/2 -translate-x-1/2 w-72 h-52 bg-gradient-to-b from-amber-500/35 via-orange-600/15 to-transparent rounded-full blur-2xl pointer-events-none"></div>

              {/* Celebration Emblem */}
              <div className="relative z-10 w-16 h-16 rounded-full bg-gradient-to-b from-[#D4AF37]/30 to-amber-900/40 border border-[#D4AF37]/60 flex items-center justify-center mx-auto mb-3 shadow-[0_0_25px_rgba(212,175,55,0.4)] center-emblem-float">
                <PartyPopper className="w-8 h-8 text-yellow-300" />
              </div>

              <h2 className="text-lg sm:text-xl font-extrabold text-white mb-4 relative z-10 tracking-wide">
                ဂုဏ်ယူပါတယ် ခင်ဗျာ! 🎉
              </h2>

              {/* 🌟 Luxury Discount Prize Box 🌟 */}
              <div className="relative z-10 bg-gradient-to-b from-black/70 to-black/50 border border-[#D4AF37]/50 rounded-2xl p-5 mb-4 shadow-[inset_0_0_25px_rgba(212,175,55,0.12)]">
                <div className="text-[10px] font-extrabold uppercase tracking-[0.25em] text-[#D4AF37]/80 mb-1">
                  Special Reward
                </div>
                <div className="text-4xl sm:text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-yellow-200 via-[#D4AF37] to-amber-400 drop-shadow-md my-1">
                  {prize}% OFF
                </div>
                <p className="text-yellow-400/90 text-xs font-bold tracking-wide mt-1">
                  အထူး Discount ရရှိသွားပါပြီ
                </p>
              </div>

              {/* 🌟 Promo Code Ticket Bar 🌟 */}
              <div className="text-left bg-white/[0.06] px-4 py-3 rounded-xl mb-4 border border-[#D4AF37]/25 relative z-10 flex items-center justify-between">
                <div>
                  <p className="text-[10px] text-gray-400 font-semibold mb-0.5">Promo Code ({userPhone}):</p>
                  <span className="font-mono font-black text-base tracking-widest text-yellow-300">
                    PROMO-{prize}
                  </span>
                </div>
                <span className="text-[9px] bg-[#D4AF37] text-[#123524] px-2.5 py-1 rounded-full font-black uppercase tracking-wider shadow-sm">
                  Applied
                </span>
              </div>

              {/* 🌟 Telegram Walk-in Section 🌟 */}
              <div className="bg-[#0088cc]/10 border border-[#0088cc]/35 rounded-2xl p-4 mb-4 relative z-10">
                <p className="text-[11px] leading-relaxed text-blue-100/90 mb-3 font-medium">
                  ယခု Discount ခံစားခွင့်အား ဆိုင်တွင် Walk-in လာရောက်သည့်အခါ အသုံးပြုနိုင်ရန် အောက်ပါခလုတ်ကိုနှိပ်၍ Telegram မှတဆင့် Admin ထံသို့ အကြောင်းကြားပေးပါ။
                </p>
                <a
                  href={getTelegramLink()}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={markTelegramClicked}
                  className="w-full py-3 bg-gradient-to-r from-[#0088cc] to-[#0077b5] text-white rounded-xl font-bold text-xs shadow-md hover:opacity-95 transition flex items-center justify-center relative z-20 cursor-pointer active:scale-95"
                >
                  <MessageCircle className="w-4 h-4 mr-2" /> Telegram Admin သို့ ပို့မည်
                </a>
              </div>

              {/* 🌟 Primary Booking CTA Button 🌟 */}
              <button
                type="button"
                onClick={(e) =>
                  handleButtonClickWithEffect(e, () => {
                    window.location.href = '/';
                  })
                }
                className="relative overflow-hidden w-full py-4 bg-gradient-to-r from-[#D4AF37] via-yellow-400 to-[#c59b27] text-[#123524] rounded-xl font-black text-sm sm:text-base shadow-[0_6px_25px_rgba(212,175,55,0.45)] border border-yellow-200/60 transition-all duration-200 flex items-center justify-center z-10"
              >
                <span className="absolute inset-0 w-1/2 h-full bg-gradient-to-r from-transparent via-white/50 to-transparent btn-shimmer-sweep pointer-events-none"></span>
                <CalendarCheck className="w-4 h-4 mr-2 relative z-10 stroke-[2.5]" />
                <span className="relative z-10">App မှ Booking ပြန်တင်မည်</span>
              </button>

              {/* 🌟 Terms & Conditions 🌟 */}
              <div className="mt-6 text-left border-t border-[#D4AF37]/20 pt-5 relative z-10">
                <h4 className="text-[10px] font-extrabold text-[#D4AF37] uppercase tracking-widest mb-2.5 flex items-center">
                  <Info className="w-3.5 h-3.5 mr-1.5" /> Terms & Conditions
                </h4>
                <ul className="space-y-2">
                  <li className="text-[10px] text-gray-300/90 font-medium leading-relaxed flex items-start">
                    <span className="text-[#D4AF37] mr-2 font-bold">•</span>
                    <span>တစ်ရက်လျှင် တစ်ကြိမ်သာ ကံစမ်းခွင့်ရှိပါသည်။</span>
                  </li>
                  <li className="text-[10px] text-gray-300/90 font-medium leading-relaxed flex items-start">
                    <span className="text-[#D4AF37] mr-2 font-bold">•</span>
                    <span>ရရှိထားသော Discount ခံစားခွင့်အား ဆိုင်၏ ဝန်ဆောင်မှုအားလုံးအပေါ်တွင် အသုံးပြုနိုင်ပါသည်။</span>
                  </li>
                  <li className="text-[10px] text-gray-300/90 font-medium leading-relaxed flex items-start">
                    <span className="text-[#D4AF37] mr-2 font-bold">•</span>
                    <span>ရရှိထားသော Discount ခံစားခွင့်သည် သင်ရရှိလိုက်သော နေ့ရက် တစ်ရက်တည်းအတွက်သာ (24 Hours) အကျုံးဝင်ပါသည်။</span>
                  </li>
                  <li className="text-[10px] text-gray-300/90 font-medium leading-relaxed flex items-start">
                    <span className="text-[#D4AF37] mr-2 font-bold">•</span>
                    <span>
                      VIP Member Card ရှိသူများ အနေဖြင့် ပုံမှန် VIP Discount နှင့် ဤ Campaign Discount အား နှစ်ထပ်ကွမ်း (Double Promotion) အသုံးပြုခွင့် မရှိပါ။ မိမိအတွက် ပိုမိုသက်သာသော Discount တစ်ခုကိုသာ အသုံးပြုနိုင်ပါသည်။
                    </span>
                  </li>
                </ul>
              </div>

            </div>
          </div>
        )}

      </div>
    </div>
  );
}
