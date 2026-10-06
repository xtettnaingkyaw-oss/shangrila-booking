import React, { useEffect, useState } from 'react';
import { Crown } from 'lucide-react'; 

// 🌟 App.tsx မှ Data ရ/မရ (isDataReady) ကို လှမ်းတောင်းမည်၊ ပြီးလျှင် ပိတ်ရန် (onFinish) ကို ပြန်ပို့မည် 🌟
export default function PremiumLoadingScreen({ isDataReady = false, onFinish }: { isDataReady?: boolean, onFinish?: () => void }) {
    const [cachedLogo, setCachedLogo] = useState<string | null>(null);
    const [progress, setProgress] = useState(0);
    const [fadeAnim, setFadeAnim] = useState(false); // App ပွင့်ခါနီး ပျောက်သွားမည့် Effect

    useEffect(() => {
        const logo = localStorage.getItem('shangrila_logo_cache');
        if (logo) setCachedLogo(logo);
    }, []);

    // 🌟 Real-time Progress Bar Logic 🌟
    useEffect(() => {
        let interval: NodeJS.Timeout;
        if (!isDataReady) {
            // Data မရသေးခင် ၉၅% ထိ ဖြည်းဖြည်းချင်း တက်နေမည်
            interval = setInterval(() => {
                setProgress(old => {
                    if (old < 70) return old + (Math.random() * 10);
                    if (old < 95) return old + (Math.random() * 2);
                    return old;
                });
            }, 300);
        } else {
            // Data ရပြီဆိုပါက ၁၀၀% သို့ ချက်ချင်းပြည့်သွားမည်
            setProgress(100);
        }
        return () => clearInterval(interval);
    }, [isDataReady]);

    // 🌟 ၁၀၀% ပြည့်သွားပါက ချက်ချင်းမပိတ်ဘဲ Welcome Effect ပြပြီးမှ ပိတ်မည် 🌟
    useEffect(() => {
        if (progress >= 100) {
            setTimeout(() => setFadeAnim(true), 400); // Bar အပြည့်ဖြစ်သွားချိန် ခဏစောင့်မည်
            const t = setTimeout(() => {
                if (onFinish) onFinish(); // အားလုံးပြီးမှ App အစစ်ကို ဖွင့်ပေးမည်
            }, 1000); 
            return () => clearTimeout(t);
        }
    }, [progress, onFinish]);

    return (
        <div className={`fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-gradient-to-br from-[#0a1f15] via-[#123524] to-[#0a1f15] overflow-hidden transition-all duration-700 ease-in-out ${fadeAnim ? 'opacity-0 scale-110 pointer-events-none' : 'opacity-100 scale-100'}`}>
            
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[35rem] h-[35rem] bg-[#D4AF37] rounded-full blur-[140px] opacity-10 animate-pulse"></div>

            <div className="relative flex flex-col items-center z-10 w-full px-8">
                
                <div className="relative w-40 h-40 sm:w-48 sm:h-48 mb-10 flex items-center justify-center overflow-hidden">
                    {cachedLogo ? (
                        <img 
                            src={cachedLogo} 
                            alt="The Shangri-La Logo" 
                            // 🌟 FIX: Logo အကွက်ကြီးပျောက်သွားစေရန် CSS Mask ဖြင့် ဘေးဘောင်များကို ဝါးပစ်လိုက်ပါသည် 🌟
                            className="w-full h-full object-contain relative z-10 mix-blend-screen"
                            style={{ 
                                WebkitMaskImage: 'radial-gradient(circle at center, black 50%, transparent 75%)', 
                                maskImage: 'radial-gradient(circle at center, black 50%, transparent 75%)' 
                            }}
                        />
                    ) : (
                        <div className="relative z-10 flex items-center justify-center">
                            <Crown className="w-16 h-16 sm:w-20 sm:h-20 text-[#D4AF37] drop-shadow-[0_0_15px_rgba(212,175,55,0.4)]" />
                        </div>
                    )}
                    
                    <div className="absolute top-0 left-0 h-full w-[150%] z-20 bg-gradient-to-r from-transparent via-[#D4AF37]/30 to-transparent animate-shimmer pointer-events-none"></div>
                </div>

                {/* 🌟 100% ပြည့်ချိန်တွင် WELCOME သို့ ပြောင်းသွားမည့် စာသား 🌟 */}
                <h2 className={`text-[#D4AF37] text-[10px] sm:text-xs font-bold tracking-[0.35em] uppercase mb-6 transition-all duration-500 ${progress >= 100 ? 'scale-110 opacity-100 drop-shadow-[0_0_10px_rgba(212,175,55,0.8)]' : 'opacity-80 animate-pulse'}`}>
                    {progress >= 100 ? 'Welcome' : 'Preparing Your Retreat'}
                </h2>

                <div className="w-56 h-[3px] bg-[#1a4a32] rounded-full overflow-hidden shadow-[inset_0_1px_3px_rgba(0,0,0,0.4)] relative">
                    <div 
                        className="h-full bg-gradient-to-r from-[#b38b22] to-[#D4AF37] rounded-full shadow-[0_0_10px_rgba(212,175,55,0.8)] transition-all ease-out"
                        style={{ width: `${progress}%`, transitionDuration: progress >= 100 ? '0.5s' : '0.3s' }}
                    ></div>
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
            `}} />
        </div>
    );
}
