import React, { useState, useEffect } from 'react';
import { Gift, X, Sparkles, Percent, Tag, Calendar, ArrowRight, Snowflake } from 'lucide-react';
import {
  AppData,
  MiniGameStyle,
  PromotionType,
  resolveMiniGameStyle,
  resolvePromotionType,
} from '../shared';
import santaHeroImg from '../assets/images/christmas_santa_hero_1795782111338.jpg';

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

interface ActivePopupOffer {
  id: string;
  promoType: PromotionType;
  gameStyle: MiniGameStyle;
  title: string;
  boxTitle: string;
  description?: string;
  badgeText?: string;
  startDate?: string;
  endDate?: string;
  hotelDiscountPercent: number;
  otherDiscountPercent: number;
  minGameDiscount: number;
  maxGameDiscount: number;
  gameRewardTiers: number[];
  categoryEntries: { id: string; title: string; percent: number }[];
}

const SNOWFLAKES = Array.from({ length: 18 }).map((_, i) => ({
  id: i,
  left: 4 + ((i * 19) % 92),
  size: 4 + (i % 4) * 2.2,
  duration: 4.5 + (i % 5) * 1.15,
  delay: (i % 6) * 0.65,
  opacity: 0.4 + (i % 4) * 0.14,
}));

export default function ThadingyutPopup({ appData }: { appData: AppData }) {
  const [isVisible, setIsVisible] = useState(false);
  const [santaImgFailed, setSantaImgFailed] = useState(false);
  const [fallingLanterns, setFallingLanterns] = useState<
    { id: number; left: number; duration: number; size: number; delay: number; opacity: number }[]
  >([]);

  // ============================================================================
  // 🌟 TYPE-AWARE POPUP RESOLVER (% Discount | Mini Game | Category Discount) 🌟
  // ============================================================================
  const getActivePopupOffer = (): ActivePopupOffer | null => {
    const promo: any = appData?.promotion;
    if (!promo) return null;

    const todayStr = getLocalTodayStr();

    if (
      promo.allOff === true ||
      promo.isActive === false ||
      promo.enabled === false ||
      promo.popupEnabled === false ||
      promo.isPopupActive === false
    ) {
      return null;
    }

    const searchParams = new URLSearchParams(window.location.search);
    const requestedPromoId = searchParams.get('promo');

    const cards: any[] =
      (appData as any)?.savedCampaignCards ||
      promo.campaigns ||
      promo.cards ||
      promo.savedCampaigns ||
      (appData as any)?.campaigns ||
      [];

    let source: any = null;

    if (Array.isArray(cards) && cards.length > 0) {
      if (requestedPromoId) {
        const directCard = cards.find((c: any) => String(c.id) === requestedPromoId);
        if (directCard && directCard.isPopupActive === true) {
          const withinDate =
            (!directCard.startDate || todayStr >= directCard.startDate) &&
            (!directCard.endDate || todayStr <= directCard.endDate);
          if (withinDate) source = directCard;
        }
      }

      if (!source) {
        source = cards.find((c: any) => {
          const cardPopupOn =
            c.isPopupActive === true ||
            ((c.isActive === true || c.active === true || c.enabled === true || c.status === 'ACTIVE') &&
              c.popupEnabled !== false &&
              c.isPopupActive !== false);
          const withinDate =
            (!c.startDate || todayStr >= c.startDate) &&
            (!c.endDate || todayStr <= c.endDate);
          return cardPopupOn && withinDate;
        });
      }

      if (!source) return null;
    } else {
      if (promo.isPopupActive !== true || !promo.startDate || !promo.endDate) return null;
      if (todayStr < promo.startDate || todayStr > promo.endDate) return null;
      source = promo;
    }

    const promoType = resolvePromotionType(source);
    const gameStyle = resolveMiniGameStyle(source);

    const tiers: number[] =
      Array.isArray(source.gameRewardTiers) && source.gameRewardTiers.length > 0
        ? [...new Set<number>(source.gameRewardTiers.map(Number).filter((n: number) => n > 0))].sort((a, b) => a - b)
        : Array.isArray(promo.gameRewardTiers) && promo.gameRewardTiers.length > 0
        ? [...new Set<number>(promo.gameRewardTiers.map(Number).filter((n: number) => n > 0))].sort((a, b) => a - b)
        : [10, 15, 20, 30, 50];
    const minGameDiscount = tiers.length > 0 ? tiers[0] : 10;
    const maxGameDiscount = tiers.length > 0 ? tiers[tiers.length - 1] : 50;

    const rawCatMap: Record<string, number> = source.categoryDiscounts || promo.categoryDiscounts || {};
    const categoryEntries: { id: string; title: string; percent: number }[] = [];
    if (promoType === 'category_discount') {
      const appCats = Array.isArray(appData?.categories) ? appData.categories : [];
      for (const cat of appCats) {
        const pct = Number(rawCatMap[cat.id]) || (cat.id === 'hotel_service' ? Number(rawCatMap['hotel']) || 0 : 0);
        if (pct > 0) {
          categoryEntries.push({ id: cat.id, title: cat.title, percent: pct });
        }
      }
      if (categoryEntries.length === 0) {
        for (const [k, v] of Object.entries(rawCatMap)) {
          if (Number(v) > 0) {
            categoryEntries.push({ id: k, title: k.replace(/_/g, ' '), percent: Number(v) });
          }
        }
      }
    }

    return {
      id: source.id || promo.activeCampaignId || '',
      promoType,
      gameStyle,
      title: source.campaignTitle || source.title || promo.campaignTitle || 'အထူးပရိုမိုးရှင်း အစီအစဉ်',
      boxTitle: source.boxTitle || promo.boxTitle || 'SPECIAL PROMO',
      description: source.description || promo.description || '',
      badgeText:
        source.badgeText ||
        (promoType === 'mini_game'
          ? gameStyle === 'christmas_santa'
            ? 'MERRY CHRISTMAS GIFT'
            : 'MINI GAME EVENT'
          : 'SPECIAL OFFER'),
      startDate: source.startDate || promo.startDate,
      endDate: source.endDate || promo.endDate,
      hotelDiscountPercent: Number(source.hotelDiscountPercent ?? promo.hotelDiscountPercent) || 0,
      otherDiscountPercent: Number(source.otherDiscountPercent ?? promo.otherDiscountPercent) || 0,
      minGameDiscount,
      maxGameDiscount,
      gameRewardTiers: tiers,
      categoryEntries,
    };
  };

  const activeOffer = getActivePopupOffer();

  useEffect(() => {
    if (!activeOffer) {
      setIsVisible(false);
      return;
    }

    const searchParams = new URLSearchParams(window.location.search);
    const isCampaignMode =
      searchParams.get('mode') === 'campaign' || Boolean(searchParams.get('campaign'));
    const hasDirectPromoLink = Boolean(searchParams.get('promo'));
    const dismissed = sessionStorage.getItem('shangrila_popup_dismissed');

    if ((!dismissed || hasDirectPromoLink) && !isCampaignMode) {
      const delay = hasDirectPromoLink ? 450 : 2500;
      const timer = setTimeout(() => {
        setIsVisible(true);
      }, delay);
      return () => clearTimeout(timer);
    }
  }, [appData, activeOffer?.id, activeOffer?.title, activeOffer?.promoType, activeOffer?.gameStyle]);

  useEffect(() => {
    if (!isVisible || !activeOffer || activeOffer.promoType !== 'mini_game' || activeOffer.gameStyle !== 'lantern_catch') {
      return;
    }

    const initial = Array.from({ length: 9 }).map((_, i) => ({
      id: i,
      left: 6 + i * 10.5 + (Math.random() * 4 - 2),
      duration: 4 + Math.random() * 3,
      size: 0.85 + Math.random() * 0.65,
      delay: Math.random() * 2.5,
      opacity: 0.45 + Math.random() * 0.45,
    }));
    setFallingLanterns(initial);
  }, [isVisible, activeOffer?.id, activeOffer?.promoType, activeOffer?.gameStyle]);

  const handleClose = () => {
    sessionStorage.setItem('shangrila_popup_dismissed', 'true');
    setIsVisible(false);
    const sp = new URLSearchParams(window.location.search);
    if (sp.has('promo')) {
      sp.delete('promo');
      const nextUrl = window.location.pathname + (sp.toString() ? `?${sp.toString()}` : '');
      window.history.replaceState({}, document.title, nextUrl);
    }
  };

  const handlePlayNowClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    const button = e.currentTarget;
    button.style.transform = 'scale(0.96)';

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

      const targetUrl = activeOffer?.id
        ? `/?mode=campaign&campaign=${encodeURIComponent(activeOffer.id)}`
        : '/?mode=campaign';
      window.location.href = targetUrl;
    }, 280);
  };

  if (!isVisible || !activeOffer) return null;

  // ============================================================================
  // VIEW A1: CHRISTMAS SANTA GIFT CAMPAIGN POPUP
  // ============================================================================
  if (activeOffer.promoType === 'mini_game' && activeOffer.gameStyle === 'christmas_santa') {
    return (
      <div
        className="fixed inset-0 z-[999] bg-black/60 backdrop-blur-[3px] flex items-center justify-center p-4 sm:p-5 animate-fade-in"
        onClick={handleClose}
      >
        <style>{`
          @keyframes santaPopupSnow {
            0% { transform: translateY(-16px) translateX(0px); opacity: 0; }
            15% { opacity: var(--snow-op, 0.7); }
            85% { opacity: var(--snow-op, 0.7); }
            100% { transform: translateY(420px) translateX(16px); opacity: 0; }
          }
          .santa-popup-flake {
            position: absolute;
            top: 0;
            border-radius: 9999px;
            background: #ffffff;
            pointer-events: none;
            animation-name: santaPopupSnow;
            animation-timing-function: linear;
            animation-iteration-count: infinite;
          }
          @keyframes santaPortraitFloat {
            0%, 100% { transform: translateY(0px) rotate(-0.8deg); }
            50% { transform: translateY(-4px) rotate(0.8deg); }
          }
          .santa-portrait-float {
            animation: santaPortraitFloat 3.6s ease-in-out infinite;
          }
          .popup-ripple-effect {
            position: absolute;
            border-radius: 50%;
            background: rgba(255, 255, 255, 0.55);
            transform: scale(0);
            animation: popupRipple 0.5s ease-out;
            pointer-events: none;
          }
          @keyframes popupRipple {
            to { transform: scale(4); opacity: 0; }
          }
          @keyframes goldShimmer {
            0% { transform: translateX(-120%) skewX(-15deg); }
            100% { transform: translateX(220%) skewX(-15deg); }
          }
          .btn-shimmer-sweep {
            animation: goldShimmer 2.8s infinite;
          }
          @media (prefers-reduced-motion: reduce) {
            .santa-popup-flake, .santa-portrait-float, .btn-shimmer-sweep { animation: none !important; }
          }
        `}</style>

        <div
          className="relative w-full max-w-[365px] rounded-[2rem] p-[1.5px] bg-gradient-to-b from-[#D4AF37] via-[#991b1b]/80 to-[#D4AF37]/80 shadow-[0_24px_65px_rgba(0,0,0,0.8)] animate-slide-up overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="relative w-full rounded-[calc(2rem-1.5px)] bg-gradient-to-b from-[#0E2E20] via-[#0B2419] to-[#1A0A0D] px-5 pt-6 pb-5 text-center overflow-hidden">
            {/* Soft Crimson & Gold Festive Ambient Glow */}
            <div className="absolute -top-20 left-1/2 -translate-x-1/2 w-72 h-48 bg-gradient-to-b from-[#991b1b]/45 via-[#D4AF37]/20 to-transparent rounded-full blur-2xl pointer-events-none" />

            {/* Gentle Falling Snowflakes */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
              {SNOWFLAKES.map((f) => (
                <span
                  key={f.id}
                  className="santa-popup-flake"
                  style={{
                    left: `${f.left}%`,
                    width: `${f.size}px`,
                    height: `${f.size}px`,
                    animationDuration: `${f.duration}s`,
                    animationDelay: `${f.delay}s`,
                    ['--snow-op' as any]: f.opacity,
                  }}
                />
              ))}
            </div>

            {/* Close Button */}
            <button
              type="button"
              onClick={handleClose}
              aria-label="Close"
              className="absolute top-3.5 right-3.5 z-30 w-9 h-9 rounded-full bg-black/35 hover:bg-black/55 text-amber-100 hover:text-white flex items-center justify-center transition border border-[#D4AF37]/35 active:scale-95"
            >
              <X className="w-4 h-4" />
            </button>

            {/* Top Kicker */}
            <div className="relative z-10 flex items-center justify-center gap-1.5 text-[10px] font-bold text-[#D4AF37] uppercase tracking-[0.22em] mb-3">
              <Snowflake className="w-3 h-3" />
              <span>{activeOffer.badgeText || 'MERRY CHRISTMAS GIFT'}</span>
              <Snowflake className="w-3 h-3" />
            </div>

            {/* Bespoke Santa Hero Portrait */}
            <div className="relative z-10 mx-auto w-36 h-36 sm:w-40 sm:h-40 rounded-3xl p-[2px] bg-gradient-to-b from-[#D4AF37] via-amber-200/70 to-[#991b1b] shadow-[0_12px_35px_rgba(0,0,0,0.65)] mb-4 santa-portrait-float">
              <div className="w-full h-full rounded-[calc(1.5rem-2px)] overflow-hidden bg-[#0B2419] flex items-center justify-center">
                {!santaImgFailed ? (
                  <img
                    src={santaHeroImg}
                    alt="Santa Claus with Christmas gift sack"
                    referrerPolicy="no-referrer"
                    onError={() => setSantaImgFailed(true)}
                    className="w-full h-full object-cover scale-[1.12]"
                  />
                ) : (
                  <div className="w-full h-full bg-gradient-to-b from-[#7f1d1d] to-[#0B2419] flex flex-col items-center justify-center text-[#D4AF37]">
                    <Gift className="w-12 h-12 mb-1" />
                    <span className="text-[11px] font-black tracking-wider">SANTA GIFT</span>
                  </div>
                )}
              </div>
            </div>

            {/* Title & Prize Details */}
            <div className="relative z-10">
              <h2
                className="text-lg sm:text-xl font-serif font-extrabold text-[#FDE68A] mb-2 tracking-wide"
                style={{ lineHeight: '1.5', textWrap: 'balance' }}
              >
                {activeOffer.title}
              </h2>

              <p
                className="text-xs text-gray-200/95 font-medium mb-3.5 px-1"
                style={{ lineHeight: '1.7' }}
              >
                {activeOffer.description || (
                  <>
                    Santa ဖိုးဖိုးကြီး၏ လက်ဆောင်အိတ်ကြီးထဲမှ{' '}
                    <span className="text-[#FDE68A] font-extrabold">
                      {activeOffer.minGameDiscount}% မှ {activeOffer.maxGameDiscount}% OFF
                    </span>{' '}
                    အထိ Christmas အထူးလက်ဆောင်များ ကံစမ်းရယူလိုက်ပါ။
                  </>
                )}
              </p>

              {/* Clean Unboxed Reward Tier Strip */}
              <div className="text-[11px] font-mono font-bold text-[#D4AF37] tabular-nums mb-3.5">
                {activeOffer.gameRewardTiers.map((t) => `${t}%`).join(' · ')} OFF
              </div>

              {activeOffer.endDate && (
                <div className="text-[10.5px] text-emerald-200/80 font-mono mb-4 flex items-center justify-center gap-1.5 tabular-nums">
                  <Calendar className="w-3 h-3 text-[#D4AF37]" />
                  <span>
                    {activeOffer.startDate || ''} — {activeOffer.endDate}
                  </span>
                </div>
              )}

              {/* Primary CTA -> Navigates straight into Santa Gift Sack Campaign */}
              <button
                type="button"
                onClick={handlePlayNowClick}
                className="relative overflow-hidden w-full min-h-[48px] px-4 py-3 bg-gradient-to-r from-[#B91C1C] via-[#991B1B] to-[#7F1D1D] hover:from-[#DC2626] hover:to-[#991B1B] text-[#FDE68A] rounded-xl font-black text-xs sm:text-sm shadow-[0_8px_24px_rgba(153,27,27,0.55)] border border-[#D4AF37]/75 transition-all duration-200 flex items-center justify-center gap-2 tracking-wide"
              >
                <span className="absolute inset-0 w-1/2 h-full bg-gradient-to-r from-transparent via-white/25 to-transparent btn-shimmer-sweep pointer-events-none" />
                <Gift className="w-4 h-4 relative z-10 text-[#D4AF37] shrink-0" />
                <span className="relative z-10">Santa ဖိုးဖိုးကြီးထံမှ လက်ဆောင်တောင်းမည်</span>
                <ArrowRight className="w-4 h-4 relative z-10 shrink-0" />
              </button>

              <button
                type="button"
                onClick={handleClose}
                className="mt-2.5 text-[11px] font-semibold text-gray-400 hover:text-[#D4AF37] transition py-1.5 px-4"
              >
                နောက်မှ လက်ဆောင်တောင်းမည်
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ============================================================================
  // VIEW A2: LANTERN FESTIVAL MINI GAME POPUP
  // ============================================================================
  if (activeOffer.promoType === 'mini_game') {
    return (
      <div className="fixed inset-0 z-[999] bg-black/50 backdrop-blur-[2px] flex items-center justify-center p-5 animate-fade-in">
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
            to { transform: scale(4); opacity: 0; }
          }
          @keyframes goldShimmer {
            0% { transform: translateX(-120%) skewX(-15deg); }
            100% { transform: translateX(220%) skewX(-15deg); }
          }
          .btn-shimmer-sweep {
            animation: goldShimmer 2.8s infinite;
          }
        `}</style>

        <div className="relative w-full max-w-[340px] rounded-[2rem] p-[1.5px] bg-gradient-to-b from-[#D4AF37]/90 via-[#D4AF37]/30 to-[#D4AF37]/70 shadow-[0_20px_50px_rgba(0,0,0,0.75),0_0_35px_rgba(212,175,55,0.25)] animate-slide-up overflow-hidden">
          <div className="relative w-full h-full rounded-[calc(2rem-1.5px)] bg-gradient-to-b from-[#2a0e08] via-[#140705] to-[#0a0403] px-6 pt-7 pb-6 text-center overflow-hidden">
            <div className="absolute inset-2.5 rounded-[1.5rem] border border-[#D4AF37]/15 pointer-events-none z-20" />
            <div className="absolute -top-20 left-1/2 -translate-x-1/2 w-72 h-52 bg-gradient-to-b from-amber-500/35 via-orange-600/15 to-transparent rounded-full blur-2xl pointer-events-none" />

            <div
              className="absolute top-0 left-0 right-0 h-44 overflow-hidden pointer-events-none z-0"
              style={{
                WebkitMaskImage: 'linear-gradient(to bottom, black 45%, transparent 100%)',
                maskImage: 'linear-gradient(to bottom, black 45%, transparent 100%)',
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
                    ['--max-op' as any]: l.opacity,
                  }}
                >
                  🏮
                </div>
              ))}
            </div>

            <button
              type="button"
              onClick={handleClose}
              aria-label="Close"
              className="absolute top-4 right-4 z-30 w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 backdrop-blur-md text-yellow-100/80 hover:text-white flex items-center justify-center transition border border-[#D4AF37]/30 shadow-sm active:scale-90"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="relative z-10 mt-1 mb-4 flex flex-col items-center">
              <div className="text-[10px] font-bold text-[#D4AF37] uppercase tracking-[0.2em] mb-3">
                {activeOffer.badgeText || 'Mini Game Campaign'}
              </div>

              <div className="relative w-16 h-16 rounded-full bg-gradient-to-b from-amber-500/25 to-orange-900/40 border border-[#D4AF37]/50 flex items-center justify-center shadow-[0_0_25px_rgba(245,158,11,0.35)] center-emblem-float">
                <div className="absolute inset-1 rounded-full border border-yellow-300/20" />
                <span className="text-3xl filter drop-shadow-[0_2px_8px_rgba(255,165,0,0.8)]">🏮</span>
              </div>
            </div>

            <div className="relative z-10">
              <h2
                className="text-lg sm:text-xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-yellow-200 via-[#D4AF37] to-yellow-200 mb-2.5 tracking-wide drop-shadow-sm"
                style={{ lineHeight: '1.65' }}
              >
                {activeOffer.title}
              </h2>

              <p
                className="text-[11.5px] sm:text-xs text-gray-300/95 font-medium mb-4 px-1"
                style={{ lineHeight: '1.7' }}
              >
                {activeOffer.description || (
                  <>
                    ဂိမ်းလေးကစားပြီး လူကြီးမင်းအတွက်{' '}
                    <span className="text-yellow-400 font-extrabold underline decoration-[#D4AF37]/50 underline-offset-4">
                      {activeOffer.maxGameDiscount}% အထိ Discount
                    </span>{' '}
                    ကံစမ်းမဲများကို ယခုပဲ ရယူလိုက်ပါ။
                  </>
                )}
              </p>

              {activeOffer.endDate && (
                <div className="text-[10px] text-amber-200/80 font-mono mb-5 flex items-center justify-center gap-1.5">
                  <Calendar className="w-3 h-3 text-[#D4AF37]" />
                  <span>
                    {activeOffer.startDate || ''} — {activeOffer.endDate}
                  </span>
                </div>
              )}

              <button
                type="button"
                onClick={handlePlayNowClick}
                className="relative overflow-hidden w-full min-h-[46px] py-3 bg-gradient-to-r from-[#D4AF37] via-yellow-400 to-[#c59b27] text-[#123524] rounded-xl font-black text-xs sm:text-sm shadow-[0_6px_20px_rgba(212,175,55,0.4)] border border-yellow-200/60 transition-all duration-200 flex items-center justify-center tracking-wide"
              >
                <span className="absolute inset-0 w-1/2 h-full bg-gradient-to-r from-transparent via-white/50 to-transparent btn-shimmer-sweep pointer-events-none" />
                <Gift className="w-4 h-4 mr-2 relative z-10 stroke-[2.5]" />
                <span className="relative z-10">ယခုပဲ ကံစမ်းမည်</span>
              </button>

              <button
                type="button"
                onClick={handleClose}
                className="mt-3 text-[11px] font-semibold text-gray-400 hover:text-[#D4AF37] transition py-1.5 px-4 active:scale-95"
              >
                နောက်မှ ကံစမ်းတော့မည်
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ============================================================================
  // VIEW B: % DISCOUNT & CATEGORY DISCOUNT LUXURY OFFER POPUP (Types 1 & 3)
  // ============================================================================
  const isCategoryType = activeOffer.promoType === 'category_discount';

  return (
    <div
      className="fixed inset-0 z-[999] bg-black/50 backdrop-blur-[2px] flex items-center justify-center p-5 animate-fade-in"
      onClick={handleClose}
    >
      <div
        className="relative w-full max-w-[360px] rounded-3xl p-[1.5px] bg-gradient-to-b from-[#D4AF37]/85 via-[#D4AF37]/30 to-[#D4AF37]/65 shadow-[0_24px_60px_rgba(0,0,0,0.6)] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="relative w-full rounded-[calc(1.5rem-1.5px)] bg-gradient-to-b from-[#123524] via-[#0B2419] to-[#06150e] px-6 pt-7 pb-6 text-center overflow-hidden">
          <div className="absolute -top-20 left-1/2 -translate-x-1/2 w-64 h-44 bg-[#D4AF37]/20 rounded-full blur-3xl pointer-events-none" />

          <button
            type="button"
            onClick={handleClose}
            aria-label="Close"
            className="absolute top-4 right-4 z-30 w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 text-gray-200 hover:text-white flex items-center justify-center transition border border-white/15"
          >
            <X className="w-4 h-4" />
          </button>

          <div className="relative z-10 flex flex-col items-center mb-4">
            <div className="text-[10px] font-bold text-[#D4AF37] uppercase tracking-[0.22em] mb-3">
              {activeOffer.badgeText || (isCategoryType ? 'Category Special' : 'Special Discount')}
            </div>

            <div className="w-14 h-14 rounded-2xl bg-[#D4AF37]/15 border border-[#D4AF37]/45 flex items-center justify-center text-[#D4AF37] shadow-inner">
              {isCategoryType ? <Tag className="w-7 h-7" /> : <Percent className="w-7 h-7" />}
            </div>
          </div>

          <div className="relative z-10">
            <h2 className="text-lg sm:text-xl font-serif font-bold text-[#D4AF37] leading-snug mb-1.5">
              {activeOffer.title}
            </h2>

            {activeOffer.description && (
              <p className="text-xs text-gray-300 leading-relaxed mb-4">{activeOffer.description}</p>
            )}

            {isCategoryType ? (
              <div className="my-4 bg-black/25 border border-white/10 rounded-2xl divide-y divide-white/10 text-left overflow-hidden">
                {activeOffer.categoryEntries.length > 0 ? (
                  activeOffer.categoryEntries.map((entry) => (
                    <div key={entry.id} className="px-4 py-2.5 flex items-center justify-between gap-2">
                      <span className="text-xs font-semibold text-gray-100 truncate">{entry.title}</span>
                      <span className="text-sm font-black text-[#D4AF37] tabular-nums shrink-0">
                        {entry.percent}% OFF
                      </span>
                    </div>
                  ))
                ) : (
                  <div className="px-4 py-3 text-xs text-gray-300 text-center">
                    သတ်မှတ်ထားသော Service များတွင် အထူးလျှော့ဈေး ရရှိပါမည်
                  </div>
                )}
              </div>
            ) : (
              <div className="my-4 grid grid-cols-2 gap-2.5">
                {activeOffer.otherDiscountPercent > 0 && (
                  <div className="bg-black/25 border border-[#D4AF37]/30 rounded-2xl p-3.5 text-center">
                    <div className="text-[10px] font-bold text-gray-300 uppercase tracking-wider">In-Spa</div>
                    <div className="text-2xl font-black text-[#D4AF37] mt-0.5 tabular-nums">
                      {activeOffer.otherDiscountPercent}%
                    </div>
                    <div className="text-[10px] text-emerald-300 font-semibold">OFF</div>
                  </div>
                )}
                {activeOffer.hotelDiscountPercent > 0 && (
                  <div className="bg-black/25 border border-[#D4AF37]/30 rounded-2xl p-3.5 text-center">
                    <div className="text-[10px] font-bold text-gray-300 uppercase tracking-wider">Hotel & Outcall</div>
                    <div className="text-2xl font-black text-[#D4AF37] mt-0.5 tabular-nums">
                      {activeOffer.hotelDiscountPercent}%
                    </div>
                    <div className="text-[10px] text-emerald-300 font-semibold">OFF</div>
                  </div>
                )}
              </div>
            )}

            {activeOffer.endDate && (
              <div className="text-[11px] text-gray-300 font-mono mb-5 flex items-center justify-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-[#D4AF37]" />
                <span>Valid until {activeOffer.endDate}</span>
              </div>
            )}

            <button
              type="button"
              onClick={handleClose}
              className="w-full min-h-[46px] px-4 py-3 bg-[#D4AF37] hover:bg-[#c59b27] text-[#0B2419] rounded-xl font-black text-xs sm:text-sm shadow-lg transition flex items-center justify-center gap-2"
            >
              <Sparkles className="w-4 h-4" />
              <span>{isCategoryType ? 'ဝန်ဆောင်မှု ရွေးချယ်မည်' : 'ယခုပဲ Booking တင်မည်'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={handleClose}
              className="mt-2.5 text-[11px] font-semibold text-gray-400 hover:text-[#D4AF37] transition py-1 px-4"
            >
              ပိတ်မည်
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
