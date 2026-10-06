import React, { useEffect, useState } from 'react';

export default function PremiumLoadingScreen() {
    // Database က logo ကို မှတ်ထားပြီး ပြန်ခေါ်သုံးမည်
    const [cachedLogo, setCachedLogo] = useState<string | null>(null);

    useEffect(() => {
        const logo = localStorage.getItem('shangrila_logo_cache');
        if (logo) setCachedLogo(logo);
    }, []);

    return (
        <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-gradient-to-br from-[#0a1f15] via-[#123524] to-[#0a1f15] overflow-hidden">
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-[#D4AF37] rounded-full blur-[100px] opacity-10 animate-pulse"></div>

            <div className="relative flex flex-col items-center z-10">
                
                <div className="w-24 h-24 sm:w-32 sm:h-32 mb-8 relative animate-[pulse_3s_ease-in-out_infinite]">
                    {cachedLogo ? (
                        <img 
                            src={cachedLogo} 
                            alt="The Shangri-La Logo" 
                            className="w-full h-full object-contain rounded-full shadow-[0_0_15px_rgba(212,175,55,0.2)] bg-white p-1"
                        />
                    ) : (
                        // Logo Cache မရသေးခင် (ပထမဆုံးအကြိမ် ဝင်ချိန်) ယာယီပြမည့် ပုံစံ
                        <div className="w-full h-full border-[3px] border-[#D4AF37] rounded-full flex items-center justify-center bg-white shadow-[0_0_15px_rgba(212,175,55,0.2)]">
                            <span className="text-[#123524] font-black text-xs sm:text-sm text-center px-2 tracking-wider">SHANGRI-LA</span>
                        </div>
                    )}
                </div>

                <h2 className="text-[#D4AF37] text-[10px] sm:text-xs font-semibold tracking-[0.3em] uppercase mb-6 opacity-90 animate-[pulse_2s_ease-in-out_infinite]">
                    Preparing Your Retreat
                </h2>

                <div className="w-48 h-[2px] bg-[#1a4a32] rounded-full overflow-hidden relative shadow-sm">
                    <div className="absolute top-0 left-0 h-full w-1/3 bg-gradient-to-r from-transparent via-[#D4AF37] to-transparent animate-gold-slide"></div>
                </div>
            </div>

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
