import React, { useEffect, useState } from 'react';
import { Crown } from 'lucide-react'; 

export default function PremiumLoadingScreen() {
    const [cachedLogo, setCachedLogo] = useState<string | null>(null);

    useEffect(() => {
        const logo = localStorage.getItem('shangrila_logo_cache');
        if (logo) setCachedLogo(logo);
    }, []);

    return (
        <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-gradient-to-br from-[#0a1f15] via-[#123524] to-[#0a1f15] overflow-hidden">
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[30rem] h-[30rem] bg-[#D4AF37] rounded-full blur-[120px] opacity-10 animate-pulse"></div>

            <div className="relative flex flex-col items-center z-10 w-full px-8">
                
                <div className="relative w-40 h-40 sm:w-48 sm:h-48 mb-10 flex items-center justify-center overflow-hidden">
                    {cachedLogo ? (
                        <img 
                            src={cachedLogo} 
                            alt="The Shangri-La Logo" 
                            // 🌟 FIX: Logo နောက်ခံကို ဖျောက်ရန် mix-blend-screen ကို အသုံးပြုထားသည် (သို့မဟုတ်) bg-transparent 🌟
                            className="w-full h-full object-contain mix-blend-screen drop-shadow-[0_0_20px_rgba(212,175,55,0.3)] relative z-10"
                        />
                    ) : (
                        <div className="relative z-10 flex items-center justify-center">
                            <Crown className="w-16 h-16 sm:w-20 sm:h-20 text-[#D4AF37] drop-shadow-[0_0_15px_rgba(212,175,55,0.4)]" />
                        </div>
                    )}
                    
                    <div className="absolute top-0 left-0 h-full w-[150%] z-20 bg-gradient-to-r from-transparent via-[#D4AF37]/30 to-transparent animate-shimmer pointer-events-none"></div>
                </div>

                <h2 className="text-[#D4AF37] text-[10px] sm:text-xs font-semibold tracking-[0.3em] uppercase mb-6 opacity-90 animate-[pulse_2s_ease-in-out_infinite]">
                    Preparing Retreat
                </h2>

                <div className="w-56 h-[3px] bg-[#1a4a32] rounded-full overflow-hidden shadow-inner relative">
                    <div className="h-full bg-gradient-to-r from-[#b38b22] to-[#D4AF37] rounded-full shadow-[0_0_10px_rgba(212,175,55,0.5)] animate-fill-bar"></div>
                </div>
            </div>

            <style dangerouslySetInnerHTML={{__html: `
                @keyframes shimmer {
                    0% { transform: translateX(-150%) skewX(-15deg); }
                    50%, 100% { transform: translateX(150%) skewX(-15deg); }
                }
                .animate-shimmer {
                    animation: shimmer 2.5s infinite;
                }
                
                @keyframes fill-bar {
                    0% { width: 0%; }
                    20% { width: 30%; }
                    50% { width: 70%; }
                    80% { width: 90%; }
                    100% { width: 100%; }
                }
                .animate-fill-bar {
                    animation: fill-bar 2s ease-out forwards;
                }
            `}} />
        </div>
    );
}
