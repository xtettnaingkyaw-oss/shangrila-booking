import React from 'react';
// 🌟 သင့်ရဲ့ src folder ထဲမှာရှိနေတဲ့ logo.svg ကို လှမ်းခေါ်ထားပါသည် 🌟
import logoImg from '../logo.svg';

export default function PremiumLoadingScreen() {
    return (
        // 🌟 နောက်ခံအရောင်ကို အလယ်တွင်လင်းပြီး ဘေးတွင်မှောင်သွားသော Gradient ဖြင့် Premium Look ပေးထားသည်
        <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-gradient-to-br from-[#0a1f15] via-[#123524] to-[#0a1f15] overflow-hidden">
            
            {/* 🌟 အလယ်ဗဟိုတွင် ရွှေရောင်အလင်းမှိန်မှိန်လေး (Glowing Effect) ပြုလုပ်ပေးထားသည် */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-[#D4AF37] rounded-full blur-[100px] opacity-10 animate-pulse"></div>

            <div className="relative flex flex-col items-center z-10">
                
                {/* 🌟 Logo Animation (Breathing Effect) - ဖြည်းဖြည်းချင်း ကြီးလာ/သေးသွား/လင်းလာ/မှိန်သွားမည် 🌟 */}
                <div className="w-24 h-24 sm:w-32 sm:h-32 mb-8 relative animate-[pulse_3s_ease-in-out_infinite]">
                    <img 
                        src={logoImg} // 🌟 Import လုပ်ထားသော Logo ကို အသုံးပြုထားသည်
                        alt="The Shangri-La Logo" 
                        className="w-full h-full object-contain drop-shadow-[0_0_15px_rgba(212,175,55,0.4)]"
                    />
                </div>

                {/* 🌟 Premium Typography - စာလုံးအကွာအဝေးကျယ်ကျယ်နှင့် မှိတ်တုတ်မှိတ်တုတ် 🌟 */}
                <h2 className="text-[#D4AF37] text-[10px] sm:text-xs font-semibold tracking-[0.3em] uppercase mb-6 opacity-90 animate-[pulse_2s_ease-in-out_infinite]">
                    Preparing Retreat
                </h2>

                {/* 🌟 Thin Gold Loading Bar - ရွှေရောင်လိုင်းပါးပါးလေး ပြေးနေမည့် Animation 🌟 */}
                <div className="w-48 h-[2px] bg-[#1a4a32] rounded-full overflow-hidden relative shadow-sm">
                    <div className="absolute top-0 left-0 h-full w-1/3 bg-gradient-to-r from-transparent via-[#D4AF37] to-transparent animate-gold-slide"></div>
                </div>
                
            </div>

            {/* 🌟 ရွှေရောင်လိုင်းပြေးသည့် Animation ကို Tailwind အပြင်ဘက် Config သွားစရာမလိုဘဲ Inline ထည့်သွင်းထားသည် 🌟 */}
            <style dangerouslySetInnerHTML={{__html: `
                @keyframes slide-right {
                    0% { transform: translateX(-100%); }
                    100% { transform: translateX(300%); }
                }
                .animate-gold-slide {
                    animation: slide-right 1.5s cubic-bezier(0.4, 0, 0.2, 1) infinite;
                }
            `}} />
        </div>
    );
}
