import React, { useState, useEffect } from 'react';
import { PartyPopper, ArrowLeft, Sparkles, Timer, UserCircle, LogIn } from 'lucide-react';
import { AppData } from '../shared';
import { db } from '../firebase';
import { collection, addDoc, getDocs, query } from 'firebase/firestore';

interface ThadingyutCampaignProps {
  appData: AppData;
}

interface Lantern {
  id: number;
  left: number;
  duration: number;
  size: number;
}

export default function ThadingyutCampaign({ appData }: ThadingyutCampaignProps) {
  const [gameState, setGameState] = useState<'start' | 'playing' | 'opening' | 'result'>('start');
  const [timeLeft, setTimeLeft] = useState(15);
  const [lanterns, setLanterns] = useState<Lantern[]>([]);
  const [prize, setPrize] = useState<number>(0);
  
  const [userPhone, setUserPhone] = useState<string>('');
  const [checkingUser, setCheckingUser] = useState(false);
  const [caughtLantern, setCaughtLantern] = useState<{ id: number, left: number, top: number } | null>(null);

  const campaignTitle = appData?.promotion?.campaignTitle || "အထူး ပရိုမိုးရှင်း အစီအစဉ်";

  useEffect(() => {
      const savedPhone = localStorage.getItem('shangrila_user_phone');
      if (savedPhone) {
          setUserPhone(savedPhone);
      }
  }, []);

  const calculatePrize = () => {
    const rand = Math.random() * 100;
    if (rand < 40) return 15;
    if (rand < 70) return 10;
    if (rand < 85) return 20;
    if (rand < 95) return 30;
    return 50;
  };

  const getTodayStr = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };

  const startGame = async () => {
    if (!userPhone) return;

    setCheckingUser(true);
    try {
      const q = query(collection(db, 'campaign_records'));
      const querySnapshot = await getDocs(q);

      let alreadyPlayed = false;
      const today = getTodayStr();

      querySnapshot.forEach((doc) => {
        const data = doc.data();
        if (data.phone === userPhone && data.date === today) {
          alreadyPlayed = true;
        }
      });

      if (alreadyPlayed) {
        alert("လူကြီးမင်းသည် ယနေ့အတွက် ကံစမ်းပြီးဖြစ်ပါသည်။ မနက်ဖြန်တွင် ထပ်မံကံစမ်းနိုင်ပါသည်။");
      } else {
        setGameState('playing');
        setTimeLeft(15);
        setLanterns([]);
      }
    } catch (error: any) {
      console.error("Error checking user:", error);
      if (error.message?.includes("Missing or insufficient permissions")) {
          alert("Database ချိတ်ဆက်မှု အခက်အခဲဖြစ်နေပါသည်။ (Firebase Security Rules အား 'campaign_records' အတွက် ဖွင့်ပေးရန် လိုအပ်ပါသည်)");
      } else {
          alert("အင်တာနက်ချိတ်ဆက်မှု အခက်အခဲဖြစ်နေပါသည်။ ပြန်လည်ကြိုးစားကြည့်ပါ။");
      }
    }
    setCheckingUser(false);
  };

  useEffect(() => {
    let lanternInterval: any;
    let timerInterval: any;

    if (gameState === 'playing') {
      lanternInterval = setInterval(() => {
        setLanterns(prev => [...prev, {
          id: Date.now() + Math.random(),
          left: Math.random() * 90,
          duration: 1.5 + Math.random() * 2.5,
          size: 2.5 + Math.random() * 2
        }]);
      }, 150);

      timerInterval = setInterval(() => {
        setTimeLeft(prev => {
          if (prev <= 1) {
            setGameState('start');
            alert("အချိန်ကုန်သွားပါပြီ။ နောက်တစ်ကြိမ် ထပ်မံကံစမ်းကြည့်ပါ!");
            return 15;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => { clearInterval(lanternInterval); clearInterval(timerInterval); };
  }, [gameState]);

  const saveRecordToDB = async (finalPrize: number) => {
    try {
      await addDoc(collection(db, 'campaign_records'), {
        phone: userPhone,
        discountPercent: finalPrize,
        title: campaignTitle,
        date: getTodayStr(),
        createdAt: Date.now()
      });
      console.log("✅ Successfully saved to Database");
    } catch (err: any) {
      console.error("Save error", err);
      alert(`မှတ်တမ်းသိမ်းဆည်းရာတွင် အမှားရှိနေပါသည်။ Firebase Rules ကို စစ်ဆေးပါ။ (${err.message})`);
    }
  };

  const catchLantern = (e: React.MouseEvent | React.TouchEvent, id: number) => {
    e.stopPropagation();
    if (gameState !== 'playing') return;

    let clientX = 0, clientY = 0;
    if ('touches' in e) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = (e as React.MouseEvent).clientX;
      clientY = (e as React.MouseEvent).clientY;
    }

    const wonPrize = calculatePrize();
    setPrize(wonPrize);
    setCaughtLantern({ id, left: clientX, top: clientY });
    setGameState('opening');

    saveRecordToDB(wonPrize);
  };

  const openCaughtLantern = () => {
    setGameState('result');
  };

  const goToLogin = () => {
      window.location.href = '/?view=profile';
  };

  return (
    <div className="min-h-screen bg-[#1a0f14] text-white flex flex-col relative overflow-hidden font-sans">
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
          filter: drop-shadow(0 0 12px rgba(255, 165, 0, 0.8));
          transition: transform 0.1s;
        }
        .lantern-anim:active { transform: scale(1.5); }
        
        @keyframes flyToCenter {
          0% { transform: scale(1) translate(0, 0); opacity: 1; }
          100% { 
            transform: scale(2.5) translate(calc(50vw - var(--start-x)), calc(50vh - var(--start-y))); 
            opacity: 1; 
          }
        }
        .lantern-caught {
          position: fixed;
          z-index: 100;
          animation: flyToCenter 1.5s ease-out forwards;
        }

        @keyframes explodeSparkles {
          0% { transform: scale(0); opacity: 1; }
          50% { transform: scale(1.5); opacity: 0.8; }
          100% { transform: scale(2); opacity: 0; }
        }
        .sparkle-burst {
          position: absolute;
          top: 50%; left: 50%;
          width: 200px; height: 200px;
          margin-top: -100px; margin-left: -100px;
          background: radial-gradient(circle, rgba(255,215,0,0.8) 0%, rgba(255,140,0,0) 70%);
          animation: explodeSparkles 1s ease-out forwards;
          pointer-events: none;
        }
      `}</style>

      {/* Header Bar */}
      <div className="p-4 z-50 flex items-center justify-between bg-black/40 backdrop-blur-sm border-b border-yellow-900/50">
        <button onClick={() => window.location.href = '/'} className="flex items-center text-yellow-500 hover:text-yellow-400 font-bold">
          <ArrowLeft className="w-5 h-5 mr-1" /> နောက်သို့
        </button>
        <h1 className="font-bold text-yellow-500 tracking-wider truncate px-2 text-sm">{campaignTitle}</h1>
        <div className="w-20"></div>
      </div>

      <div className="flex-1 relative flex items-center justify-center bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-red-950 via-black to-black">
        
        {/* START SCREEN */}
        {gameState === 'start' && (
          <div className="text-center z-10 p-6 bg-black/60 border border-yellow-600/50 rounded-2xl backdrop-blur-md max-w-sm w-full mx-4 shadow-[0_0_30px_rgba(255,215,0,0.1)]">
            <div className="flex justify-center mb-4"><span className="text-6xl animate-bounce">🏮</span></div>
            <h2 className="text-2xl font-bold text-yellow-400 mb-2">{campaignTitle}</h2>
            <p className="text-gray-300 text-xs mb-6 leading-relaxed">မီးပုံးလေးတွေကို ဖမ်းပြီး ၅၀% အထိ Discount ရယူပါ။ (တစ်ရက်လျှင် ၁ ကြိမ်သာ ကံစမ်းခွင့်ရှိသည်)</p>
            
            {userPhone ? (
               <div className="space-y-4">
                  <div className="bg-black/40 border border-yellow-600/30 rounded-xl p-3 flex items-center justify-center">
                     <UserCircle className="w-5 h-5 text-yellow-500 mr-2" />
                     <span className="text-sm font-bold text-yellow-500 tracking-widest">{userPhone}</span>
                  </div>
                  <button 
                    onClick={startGame}
                    disabled={checkingUser}
                    className="w-full py-4 bg-gradient-to-r from-yellow-600 to-orange-500 rounded-xl font-bold text-base shadow-[0_0_15px_rgba(255,165,0,0.5)] hover:scale-105 transition-transform text-white flex items-center justify-center disabled:opacity-50"
                  >
                    {checkingUser ? 'စစ်ဆေးနေပါသည်...' : <><Sparkles className="w-5 h-5 mr-2" /> ကစားမည် (Play Now)</>}
                  </button>
               </div>
            ) : (
               <div className="space-y-4">
                  <div className="bg-red-950/50 border border-red-900/50 rounded-xl p-4 text-xs text-red-200">
                     ကံစမ်းမဲ ကစားရန်အတွက် အရင်ဆုံး အကောင့် ဝင်ရန် (Login) လိုအပ်ပါသည်။
                  </div>
                  <button 
                    onClick={goToLogin}
                    className="w-full py-4 bg-white text-black rounded-xl font-bold text-sm shadow-md hover:bg-gray-200 transition flex items-center justify-center"
                  >
                    <LogIn className="w-4 h-4 mr-2" /> Login အရင်ဝင်မည်
                  </button>
               </div>
            )}
          </div>
        )}

        {/* PLAYING SCREEN */}
        {gameState === 'playing' && (
          <>
            <div className="absolute top-6 z-50 bg-black/70 border border-yellow-500 px-6 py-2 rounded-full flex items-center text-yellow-400 font-bold text-xl shadow-[0_0_15px_rgba(255,215,0,0.3)]">
              <Timer className="w-6 h-6 mr-2 animate-pulse" /> {timeLeft} စက္ကန့်
            </div>
            {lanterns.map((lantern) => (
              <div 
                key={lantern.id} 
                onMouseDown={(e) => catchLantern(e, lantern.id)} 
                onTouchStart={(e) => catchLantern(e, lantern.id)} 
                className="lantern-anim hover:brightness-125" 
                style={{ left: `${lantern.left}%`, animationDuration: `${lantern.duration}s`, fontSize: `${lantern.size}rem`, top: '-10vh' }}
              >
                🏮
              </div>
            ))}
          </>
        )}

        {/* OPENING CAUGHT LANTERN SCREEN */}
        {gameState === 'opening' && caughtLantern && (
          <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center">
            <div 
              className="lantern-caught cursor-pointer"
              style={{ 
                '--start-x': `${caughtLantern.left}px`, 
                '--start-y': `${caughtLantern.top}px`,
                left: caughtLantern.left,
                top: caughtLantern.top,
                fontSize: '3rem'
              } as React.CSSProperties}
              onClick={openCaughtLantern}
            >
              🏮
            </div>
            <div className="absolute bottom-20 text-yellow-400 font-bold animate-pulse text-lg">
              ဖွင့်ရန် မီးပုံးကို နှိပ်ပါ (Tap to Open)
            </div>
          </div>
        )}

        {/* RESULT SCREEN */}
        {gameState === 'result' && (
          <div className="text-center z-50 p-6 bg-gradient-to-b from-yellow-900 to-black border-2 border-yellow-500 rounded-3xl max-w-sm w-full mx-4 shadow-[0_0_50px_rgba(255,215,0,0.4)] animate-in zoom-in duration-300 relative">
            
            <div className="sparkle-burst"></div>

            <PartyPopper className="w-16 h-16 mx-auto text-yellow-400 mb-4 animate-bounce relative z-10" />
            <h2 className="text-xl font-bold text-white mb-2 relative z-10">ဂုဏ်ယူပါတယ် ခင်ဗျာ! 🎉</h2>
            
            <div className="bg-black/50 border border-yellow-500/50 rounded-xl p-4 mb-6 relative z-10">
               <div className="text-5xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-yellow-300 to-yellow-600 drop-shadow-lg mb-2">{prize}% OFF</div>
               <p className="text-yellow-500 text-sm font-bold">Discount ရရှိသွားပါပြီ</p>
            </div>

            <div className="text-left bg-white/10 p-4 rounded-lg mb-6 border border-white/10 relative z-10">
              <p className="text-xs text-gray-400 mb-1">Promo Code (For {userPhone}):</p>
              <div className="flex items-center justify-between">
                <span className="font-mono font-bold text-lg tracking-widest text-white">PROMO-{prize}</span>
                <span className="text-[10px] bg-yellow-500 text-black px-2 py-1 rounded font-bold uppercase">Applied</span>
              </div>
            </div>

            <button onClick={() => window.location.href = '/'} className="w-full py-4 bg-yellow-500 text-black rounded-xl font-bold text-base shadow-[0_0_15px_rgba(255,215,0,0.5)] hover:bg-yellow-400 transition relative z-10">Booking ပြန်တင်မည်</button>
          </div>
        )}
      </div>
    </div>
  );
}
