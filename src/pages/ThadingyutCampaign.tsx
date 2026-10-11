import React, { useState, useEffect, useCallback } from 'react';
import { PartyPopper, Gift, ArrowLeft, Sparkles, Timer } from 'lucide-react';

interface Lantern {
  id: number;
  left: number;
  duration: number;
  size: number;
}

export default function ThadingyutCampaign() {
  const [gameState, setGameState] = useState<'start' | 'playing' | 'result'>('start');
  const [timeLeft, setTimeLeft] = useState(15); // ၁၅ စက္ကန့် အချိန်ပေးမည်
  const [lanterns, setLanterns] = useState<Lantern[]>([]);
  const [prize, setPrize] = useState<number>(0);

  // 🌟 Weighted Randomizer (၁၅% အများဆုံး၊ ၅၀% အနည်းဆုံး ကျစေရန်) 🌟
  const calculatePrize = () => {
    const rand = Math.random() * 100;
    if (rand < 40) return 15;      // 40% Chance for 15% Discount
    if (rand < 70) return 10;      // 30% Chance for 10% Discount
    if (rand < 85) return 20;      // 15% Chance for 20% Discount
    if (rand < 95) return 30;      // 10% Chance for 30% Discount
    return 50;                     // 5% Chance for 50% Discount (အနည်းဆုံး)
  };

  const startGame = () => {
    setGameState('playing');
    setTimeLeft(15);
    setLanterns([]);
  };

  // ဂိမ်းကစားနေချိန် မီးပုံးများ အမြန်ကျလာစေရန် (Interval ဖြင့် ပွားခြင်း)
  useEffect(() => {
    let lanternInterval: any;
    let timerInterval: any;

    if (gameState === 'playing') {
      // မီးပုံး တစ်လုံးကို 150ms ခြားတစ်ခါ အများကြီး ကျလာစေမည်
      lanternInterval = setInterval(() => {
        setLanterns(prev => [...prev, {
          id: Date.now() + Math.random(),
          left: Math.random() * 90, // Screen ၏ 0 မှ 90% နေရာတွင် Random ကျမည်
          duration: 1.5 + Math.random() * 2.5, // 1.5s မှ 4s အတွင်း အမြန်ကျမည်
          size: 2.5 + Math.random() * 2 // အရွယ်အစား အသေးအကြီး Random
        }]);
      }, 150);

      // Countdown Timer
      timerInterval = setInterval(() => {
        setTimeLeft(prev => {
          if (prev <= 1) {
            setGameState('start'); // အချိန်ကုန်သွားလျှင် အစကပြန်စခိုင်းမည်
            alert("အချိန်ကုန်သွားပါပြီ။ နောက်တစ်ကြိမ် ထပ်မံကံစမ်းကြည့်ပါ!");
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

  // မီးပုံးကို ဖမ်းမိသွားသောအခါ
  const catchLantern = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (gameState !== 'playing') return;
    
    const wonPrize = calculatePrize();
    setPrize(wonPrize);
    setGameState('result'); // ဆုရသည့် မျက်နှာပြင်သို့ ပြောင်းမည်
  };

  return (
    <div className="min-h-screen bg-[#1a0f14] text-white flex flex-col relative overflow-hidden font-sans">
      
      {/* CSS Animation for Falling Lanterns */}
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
      `}</style>

      {/* Header Bar */}
      <div className="p-4 z-50 flex items-center justify-between bg-black/40 backdrop-blur-sm border-b border-yellow-900/50">
        <button onClick={() => window.location.href = '/'} className="flex items-center text-yellow-500 hover:text-yellow-400 font-bold">
          <ArrowLeft className="w-5 h-5 mr-1" /> နောက်သို့
        </button>
        <h1 className="font-bold text-yellow-500 tracking-wider">သီတင်းကျွတ် အထူးပရိုမိုးရှင်း</h1>
        <div className="w-20"></div> {/* Spacer */}
      </div>

      {/* Game Area */}
      <div className="flex-1 relative flex items-center justify-center bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-red-950 via-black to-black">
        
        {/* START SCREEN */}
        {gameState === 'start' && (
          <div className="text-center z-10 p-6 bg-black/60 border border-yellow-600/50 rounded-2xl backdrop-blur-md max-w-sm w-full mx-4 shadow-[0_0_30px_rgba(255,215,0,0.1)]">
            <div className="flex justify-center mb-4">
              <span className="text-6xl animate-bounce">🏮</span>
            </div>
            <h2 className="text-2xl font-bold text-yellow-400 mb-2">မီးပုံးလေးတွေကို ဖမ်းရအောင်</h2>
            <p className="text-gray-300 text-sm mb-6 leading-relaxed">
              အပေါ်ကနေ ကျလာမယ့် သီတင်းကျွတ် မီးပုံးလေးတွေထဲက တစ်လုံးကို အမိဖမ်းပြီး <strong>၅၀% အထိ Discount</strong> များကို ရယူလိုက်ပါ။ (အချိန် ၁၅ စက္ကန့် ရပါမည်)
            </p>
            <button 
              onClick={startGame}
              className="w-full py-4 bg-gradient-to-r from-yellow-600 to-orange-500 rounded-xl font-bold text-lg shadow-[0_0_15px_rgba(255,165,0,0.5)] hover:scale-105 transition-transform text-white flex items-center justify-center"
            >
              <Sparkles className="w-5 h-5 mr-2" /> ယခုပဲ ကံစမ်းမည်
            </button>
          </div>
        )}

        {/* PLAYING SCREEN */}
        {gameState === 'playing' && (
          <>
            {/* Timer Banner */}
            <div className="absolute top-6 z-50 bg-black/70 border border-yellow-500 px-6 py-2 rounded-full flex items-center text-yellow-400 font-bold text-xl shadow-[0_0_15px_rgba(255,215,0,0.3)]">
              <Timer className="w-6 h-6 mr-2 animate-pulse" /> {timeLeft} စက္ကန့်
            </div>

            {/* Falling Lanterns */}
            {lanterns.map((lantern) => (
              <div
                key={lantern.id}
                onMouseDown={catchLantern}
                onTouchStart={catchLantern}
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

        {/* RESULT SCREEN */}
        {gameState === 'result' && (
          <div className="text-center z-50 p-6 bg-gradient-to-b from-yellow-900 to-black border-2 border-yellow-500 rounded-3xl max-w-sm w-full mx-4 shadow-[0_0_50px_rgba(255,215,0,0.4)] animate-in zoom-in duration-300">
            <PartyPopper className="w-16 h-16 mx-auto text-yellow-400 mb-4 animate-bounce" />
            <h2 className="text-xl font-bold text-white mb-2">ဂုဏ်ယူပါတယ် ခင်ဗျာ! 🎉</h2>
            <p className="text-gray-300 text-sm mb-4">လူကြီးမင်းအတွက် သီတင်းကျွတ် လက်ဆောင်အဖြစ်</p>
            
            <div className="bg-black/50 border border-yellow-500/50 rounded-xl p-4 mb-6">
               <div className="text-5xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-yellow-300 to-yellow-600 drop-shadow-lg mb-2">
                 {prize}% OFF
               </div>
               <p className="text-yellow-500 text-sm font-bold">Discount ရရှိသွားပါပြီ</p>
            </div>

            <div className="text-left bg-white/10 p-4 rounded-lg mb-6 border border-white/10">
              <p className="text-xs text-gray-400 mb-1">Promo Code:</p>
              <div className="flex items-center justify-between">
                <span className="font-mono font-bold text-lg tracking-widest text-white">THADINGYUT-{prize}</span>
                <span className="text-[10px] bg-yellow-500 text-black px-2 py-1 rounded font-bold uppercase">Applied</span>
              </div>
            </div>

            <button 
              onClick={() => window.location.href = '/'}
              className="w-full py-4 bg-yellow-500 text-black rounded-xl font-bold text-base shadow-[0_0_15px_rgba(255,215,0,0.5)] hover:bg-yellow-400 transition"
            >
              Booking ပြန်တင်မည်
            </button>
          </div>
        )}

      </div>
    </div>
  );
}
