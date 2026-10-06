import React, { useEffect, useState } from 'react';
// 🌟 FIX: Admin မှ Logo ကိုမသုံးတော့ဘဲ src အောက်ရှိ Local ဖိုင်ကို တိုက်ရိုက် Import ခေါ်သုံးထားပါသည် 🌟
import loadingLogo from '../THE SHANGRI LA - LOGO.png'; 

export default function PremiumLoadingScreen({ isDataReady = false, onFinish }: { isDataReady?: boolean, onFinish?: () => void }) {
    const [progress, setProgress] = useState(0);
    const [fadeAnim, setFadeAnim] = useState(false); // App ပွင့်ခါနီး ပျောက်သွားမည့် Effect

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
            
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[35rem] h-[35rem] bg-[#D4AF37] rounded-full blur-[140px] opacity-10 animate-pulse pointer-events-none"></div>

            <div className="relative flex flex-col items-center z-10 w-full px-8">
                
                <div className="relative w-40 h-40 sm:w-48 sm:h-48 mb-10 flex items-center justify-center rounded-full">
                    
                    {/* 🌟 Local မှ Import ခေါ်ထားသော Transparent Logo သီးသန့်ကိုသာ အသုံးပြုမည် 🌟 */}
                    <img 
                        src={loadingLogo} 
                        alt="The Shangri-La Logo" 
                        className="w-full h-full object-contain relative z-10 drop-shadow-[0_0_15px_rgba(212,175,55,0.3)] scale-110"
                    />
                    
                    {/* 🌟 လေးထောင့်ကွက်ပုံစံမဖြစ်စေရန် Blur နှင့် Skew ထည့်သွင်းထားသော Shimmer အလင်းတန်း 🌟 */}
                    <div className="absolute top-0 -inset-x-full h-full w-[50%] bg-gradient-to-r from-transparent via-[#D4AF37]/40 to-transparent blur-xl z-20 animate-shimmer pointer-events-none" style={{ transform: 'skewX(-25deg)' }}></div>
                </div>

                {/* 🌟 100% ပြည့်ချိန်တွင် WELCOME သို့ ပြောင်းသွားမည့် စာသား 🌟 */}
                <h2 className={`text-[#D4AF37] text-[10px] sm:text-xs font-bold tracking-[0.35em] uppercase mb-6 transition-all duration-500 ${progress >= 100 ? 'scale-110 opacity-100 drop-shadow-[0_0_10px_rgba(212,175,55,0.8)]' : 'opacity-80 animate-pulse'}`}>
                    {progress >= 100 ? 'Welcome' : 'Preparing Your Retreat'}
                </h2>

                <div className="w-56 h-[3px] bg-[#1a4a32] rounded-full shadow-[inset_0_1px_3px_rgba(0,0,0,0.4)] relative overflow-visible">
                    <div 
                        className="h-full bg-gradient-to-r from-[#b38b22] to-[#D4AF37] rounded-full shadow-[0_0_10px_rgba(212,175,55,0.8)] transition-all ease-out flex justify-end items-center"
                        style={{ width: `${progress}%`, transitionDuration: progress >= 100 ? '0.5s' : '0.3s' }}
                    >
                        {/* 🌟 ရွှေမှုန် (Sparkles) Animation DOM 🌟 */}
                        {progress > 0 && progress < 100 && (
                            <div className="relative w-0 h-0 flex items-center justify-center z-30">
                                <div className="absolute w-2.5 h-2.5 bg-white rounded-full shadow-[0_0_10px_3px_#D4AF37] animate-pulse"></div>
                                <div className="sparkle-particle sp-1"></div>
                                <div className="sparkle-particle sp-2"></div>
                                <div className="sparkle-particle sp-3"></div>
                                <div className="sparkle-particle sp-4"></div>
                                <div className="sparkle-particle sp-5"></div>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* 🌟 Shimmer နှင့် Sparkle Animation အတွက် CSS 🌟 */}
            <style dangerouslySetInnerHTML={{__html: `
                @keyframes shimmer {
                    0% { left: -100%; }
                    100% { left: 200%; }
                }
                .animate-shimmer {
                    animation: shimmer 3s infinite ease-in-out;
                }

                @keyframes fly-spark {
                    0% { transform: translate(0, 0) scale(1); opacity: 1; }
                    100% { transform: translate(var(--tx), var(--ty)) scale(0); opacity: 0; }
                }
                .sparkle-particle {
                    position: absolute;
                    width: 3px; height: 3px;
                    background-color: #FFF;
                    border-radius: 50%;
                    box-shadow: 0 0 6px 2px #D4AF37;
                    opacity: 0;
                }
                .sp-1 { animation: fly-spark 0.8s cubic-bezier(0.25, 1, 0.5, 1) infinite; --tx: -15px; --ty: -25px; }
                .sp-2 { animation: fly-spark 0.6s cubic-bezier(0.25, 1, 0.5, 1) infinite 0.2s; --tx: -25px; --ty: 15px; }
                .sp-3 { animation: fly-spark 0.7s cubic-bezier(0.25, 1, 0.5, 1) infinite 0.4s; --tx: -10px; --ty: -20px; }
                .sp-4 { animation: fly-spark 0.9s cubic-bezier(0.25, 1, 0.5, 1) infinite 0.1s; --tx: -30px; --ty: -5px; }
                .sp-5 { animation: fly-spark 0.5s cubic-bezier(0.25, 1, 0.5, 1) infinite 0.3s; --tx: -20px; --ty: 25px; }
            `}} />
        </div>
    );
}
