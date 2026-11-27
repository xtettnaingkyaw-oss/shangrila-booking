import React, { useState, useEffect, useRef } from 'react';
import {
  PartyPopper,
  ArrowLeft,
  Sparkles,
  Timer,
  UserCircle,
  LogIn,
  MessageCircle,
  AlertCircle,
  Info,
  CalendarCheck,
  BellRing,
  CheckCircle2,
  Gift,
  Snowflake,
  Volume2,
  VolumeX,
  Crown,
  Send,
} from 'lucide-react';
import {
  AppData,
  MiniGameStyle,
  pickWeightedMiniGamePrize,
  resolveMiniGameStyle,
  resolvePromotionType,
} from '../shared';
import { db } from '../firebase';
import { collection, addDoc, getDocs, query, updateDoc, doc, setDoc } from 'firebase/firestore';
import {
  getDetectedTelegramWebAppUser,
  notifyCampaignWinnerToTelegram,
} from '../telegramService';
import santaHeroImg from '../assets/images/christmas_santa_hero_1795782111338.jpg';
import santaRummagingImg from '../assets/images/christmas_santa_rummaging_1795782118192.jpg';
import luxuryGiftBoxImg from '../assets/images/christmas_luxury_giftbox_1795782114391.jpg';

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

const OPENING_FIREWORKS = Array.from({ length: 24 }).map((_, i) => {
  const angle = (i * 15 * Math.PI) / 180;
  const distance = 110 + (i % 4) * 45;
  return {
    id: i,
    tx: `${Math.cos(angle) * distance}px`,
    ty: `${Math.sin(angle) * distance}px`,
    color: i % 3 === 0 ? '#FFD700' : i % 3 === 1 ? '#EF4444' : '#34D399',
    size: i % 2 === 0 ? '10px' : '7px',
    delay: `${(i % 3) * 0.1}s`,
    emoji: i % 4 === 0 ? '✨' : i % 6 === 0 ? '🎁' : i % 5 === 0 ? '⭐' : '',
  };
});

const HEADER_SPARK_RAYS = Array.from({ length: 12 }).map((_, i) => {
  const angle = (i * 30 * Math.PI) / 180;
  const dist = 48 + (i % 2) * 18;
  return {
    id: i,
    tx: `${Math.cos(angle) * dist}px`,
    ty: `${Math.sin(angle) * dist}px`,
    color: i % 2 === 0 ? '#FFD700' : '#FF8C00',
  };
});

const SNOW_PARTICLES = Array.from({ length: 26 }).map((_, i) => ({
  id: i,
  left: (i * 17 + 3) % 96,
  size: 3 + (i % 4) * 2,
  duration: 5.5 + (i % 6) * 1.25,
  delay: (i % 7) * 0.7,
  opacity: 0.35 + (i % 4) * 0.15,
}));

const RUMMAGE_GIFTS = [
  { id: 0, icon: '🎁', left: '18%', delay: '0s', drift: '-22px' },
  { id: 1, icon: '⭐', left: '34%', delay: '0.35s', drift: '-10px' },
  { id: 2, icon: '🎄', left: '50%', delay: '0.18s', drift: '0px' },
  { id: 3, icon: '🎀', left: '66%', delay: '0.52s', drift: '14px' },
  { id: 4, icon: '🔔', left: '80%', delay: '0.28s', drift: '22px' },
  { id: 5, icon: '✨', left: '42%', delay: '0.72s', drift: '-14px' },
  { id: 6, icon: '🎁', left: '58%', delay: '0.88s', drift: '16px' },
];

const RUMMAGE_CAPTIONS = [
  'ဖိုးဖိုးကြီးက လက်ဆောင်အိတ်ကြီးထဲ မွှေနှောက်ရှာဖွေနေပါပြီ...',
  'ဘယ်အထူးလက်ဆောင်ဘူးလေး ထွက်လာမလဲ ခဏစောင့်ပါ...',
  'လူကြီးမင်းအတွက် အထူး Christmas လက်ဆောင် တွေ့ပါပြီ!',
];

// Gentle Web Audio API festive chime synthesizer (zero external audio files needed)
const playFestiveSound = (kind: 'click' | 'rummage' | 'unwrap' | 'jackpot', muted: boolean) => {
  if (muted || typeof window === 'undefined') return;
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const now = ctx.currentTime;

    const playTone = (freq: number, start: number, dur: number, vol = 0.08, type: OscillatorType = 'triangle') => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, start);
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(vol, start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + dur);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(start);
      osc.stop(start + dur + 0.03);
    };

    if (kind === 'click') {
      playTone(659.25, now, 0.14, 0.07);
      playTone(880, now + 0.08, 0.18, 0.07);
    } else if (kind === 'rummage') {
      [523.25, 659.25, 783.99, 659.25, 783.99, 1046.5].forEach((f, idx) => {
        playTone(f, now + idx * 0.16, 0.15, 0.055, 'sine');
      });
    } else if (kind === 'unwrap') {
      [523.25, 659.25, 783.99, 1046.5].forEach((f, idx) => {
        playTone(f, now + idx * 0.09, 0.35, 0.08, 'triangle');
      });
    } else if (kind === 'jackpot') {
      [523.25, 659.25, 783.99, 1046.5, 1318.5, 1567.98].forEach((f, idx) => {
        playTone(f, now + idx * 0.085, 0.45, 0.09, 'triangle');
      });
    }

    setTimeout(() => {
      ctx.close().catch(() => {});
    }, 1800);
  } catch {}
};

const generateUniquePromoCode = (prizePct: number, isChristmas: boolean) => {
  const prefix = isChristmas ? 'XMAS' : 'PROMO';
  const suffix = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `${prefix}-${prizePct}-${suffix}`;
};

export default function ThadingyutCampaign({ appData }: ThadingyutCampaignProps) {
  // Unified state machine supporting both Christmas Santa Sack & Lantern Catch games
  const [gameState, setGameState] = useState<
    'start' | 'playing' | 'rummaging' | 'gift_ready' | 'opening' | 'result'
  >('start');

  const [soundMuted, setSoundMuted] = useState(false);
  const [rummageStep, setRummageStep] = useState(0);
  const [rummageProgress, setRummageProgress] = useState(0);
  const [inlineNotice, setInlineNotice] = useState<string>('');
  const [imgFallback, setImgFallback] = useState<{ hero?: boolean; rummage?: boolean; gift?: boolean }>({});

  // Lantern game states
  const [timeLeft, setTimeLeft] = useState(15);
  const [lanterns, setLanterns] = useState<Lantern[]>([]);
  const [miniLanterns, setMiniLanterns] = useState<Lantern[]>([]);
  const [caughtLantern, setCaughtLantern] = useState<{ id: number; left: number; top: number } | null>(null);
  const [isBursting, setIsBursting] = useState(false);

  // Reward & User states
  const [prize, setPrize] = useState<number>(0);
  const [promoCode, setPromoCode] = useState<string>('');
  const [userPhone, setUserPhone] = useState<string>('');
  const [userName, setUserName] = useState<string>('');
  const [checkingUser, setCheckingUser] = useState(false);
  const [recordId, setRecordId] = useState<string | null>(null);
  const [alreadyPlayedToday, setAlreadyPlayedToday] = useState(false);

  // Real-time Telegram Bot delivery status
  const [botNotiState, setBotNotiState] = useState<{
    sending: boolean;
    adminSent: boolean;
    customerSent: boolean;
  }>({ sending: false, adminSent: false, customerSent: false });

  // Promotion ended notification subscription state
  const [subscribingNoti, setSubscribingNoti] = useState(false);
  const [isPromoSubscribed, setIsPromoSubscribed] = useState<boolean>(
    () => localStorage.getItem('shangrila_promo_noti_subscribed') === 'true'
  );
  const [notiFeedbackMsg, setNotiFeedbackMsg] = useState<string>('');

  const rummageTimersRef = useRef<number[]>([]);

  const clearRummageTimers = () => {
    rummageTimersRef.current.forEach((id) => window.clearTimeout(id));
    rummageTimersRef.current = [];
  };

  useEffect(() => {
    return () => clearRummageTimers();
  }, []);

  const getTodayStr = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };

  // ============================================================================
  // 🌟 UNIVERSAL CAMPAIGN STATUS RESOLVER (Christmas Santa & Lantern Games) 🌟
  // ============================================================================
  const evaluateCampaignStatus = () => {
    const promo: any = appData?.promotion || {};
    const urlParams = new URLSearchParams(window.location.search);
    const requestedCampaignId = urlParams.get('campaign');
    const today = getTodayStr();

    const cards: any[] =
      (appData as any)?.savedCampaignCards ||
      promo.campaigns ||
      promo.cards ||
      promo.savedCampaigns ||
      (appData as any)?.campaigns ||
      [];

    let matchedCard: any = null;
    if (Array.isArray(cards) && cards.length > 0) {
      if (requestedCampaignId && requestedCampaignId !== 'active' && requestedCampaignId !== 'true') {
        matchedCard = cards.find(
          (c) =>
            String(c.id) === requestedCampaignId ||
            String(c.slug) === requestedCampaignId ||
            String(c.code) === requestedCampaignId
        );
      } else {
        matchedCard = cards.find(
          (c) =>
            resolvePromotionType(c) === 'mini_game' &&
            (c.isPopupActive === true || c.isBoxActive === true)
        );
      }
    }

    const isGlobalMiniGame = resolvePromotionType(promo) === 'mini_game';
    const isGlobalEnabled =
      isGlobalMiniGame &&
      (promo.isPopupActive === true ||
        promo.isBoxActive === true ||
        promo.popupEnabled === true ||
        promo.miniGamePopup === true ||
        promo.gameEnabled === true);

    const isExplicitlyAllOff =
      promo.allOff === true ||
      promo.isActive === false ||
      promo.enabled === false;

    const fallbackTiers: number[] =
      Array.isArray(promo.gameRewardTiers) && promo.gameRewardTiers.length > 0
        ? [...new Set<number>(promo.gameRewardTiers.map(Number).filter((n: number) => n > 0))].sort((a, b) => a - b)
        : [10, 15, 20, 30, 50];

    if (matchedCard) {
      const isCardMiniGame = resolvePromotionType(matchedCard) === 'mini_game';
      const cardActive =
        isCardMiniGame &&
        (matchedCard.isPopupActive === true || matchedCard.isBoxActive === true);

      const withinCardDate =
        (!matchedCard.startDate || today >= matchedCard.startDate) &&
        (!matchedCard.endDate || today <= matchedCard.endDate);

      const cardTiers =
        Array.isArray(matchedCard.gameRewardTiers) && matchedCard.gameRewardTiers.length > 0
          ? [...new Set<number>(matchedCard.gameRewardTiers.map(Number).filter((n: number) => n > 0))].sort((a, b) => a - b)
          : fallbackTiers;

      return {
        isActive: cardActive && withinCardDate && !isExplicitlyAllOff,
        title: matchedCard.campaignTitle || matchedCard.title || promo.campaignTitle || 'အထူးပရိုမိုးရှင်း အစီအစဉ်',
        description: matchedCard.description || promo.description || '',
        badgeText: matchedCard.badgeText || '',
        campaignId: matchedCard.id || requestedCampaignId || 'campaign',
        gameStyle: resolveMiniGameStyle(matchedCard) as MiniGameStyle,
        rewardTiers: cardTiers,
        rewardProbabilities: matchedCard.rewardProbabilities || promo.rewardProbabilities || undefined,
        rewardValidityDays: Math.max(1, Number(matchedCard.rewardValidityDays || promo.rewardValidityDays) || 1),
        outcallRewardCap: Number(matchedCard.outcallRewardCap ?? promo.outcallRewardCap ?? 10),
        telegramAutoNotify: matchedCard.telegramAutoNotify !== false,
        startDate: matchedCard.startDate || promo.startDate || '',
        endDate: matchedCard.endDate || promo.endDate || '',
      };
    }

    if (
      requestedCampaignId &&
      requestedCampaignId !== 'active' &&
      requestedCampaignId !== 'true' &&
      Array.isArray(cards) &&
      cards.length > 0 &&
      !matchedCard
    ) {
      return {
        isActive: false,
        title: promo.campaignTitle || 'အထူးပရိုမိုးရှင်း အစီအစဉ်',
        description: promo.description || '',
        badgeText: '',
        campaignId: requestedCampaignId,
        gameStyle: resolveMiniGameStyle(promo) as MiniGameStyle,
        rewardTiers: fallbackTiers,
        rewardProbabilities: promo.rewardProbabilities || undefined,
        rewardValidityDays: Math.max(1, Number(promo.rewardValidityDays) || 1),
        outcallRewardCap: Number(promo.outcallRewardCap ?? 10),
        telegramAutoNotify: promo.telegramAutoNotify !== false,
        startDate: promo.startDate || '',
        endDate: promo.endDate || '',
      };
    }

    const withinGlobalDate =
      (!promo.startDate || today >= promo.startDate) &&
      (!promo.endDate || today <= promo.endDate);

    return {
      isActive: Boolean(isGlobalEnabled && !isExplicitlyAllOff && withinGlobalDate),
      title: promo.campaignTitle || 'Christmas Santa လက်ဆောင်အိတ် Campaign',
      description: promo.description || '',
      badgeText: '',
      campaignId: requestedCampaignId || promo.activeCampaignId || promo.id || 'main_campaign',
      gameStyle: resolveMiniGameStyle(promo) as MiniGameStyle,
      rewardTiers: fallbackTiers,
      rewardProbabilities: promo.rewardProbabilities || undefined,
      rewardValidityDays: Math.max(1, Number(promo.rewardValidityDays) || 1),
      outcallRewardCap: Number(promo.outcallRewardCap ?? 10),
      telegramAutoNotify: promo.telegramAutoNotify !== false,
      startDate: promo.startDate || '',
      endDate: promo.endDate || '',
    };
  };

  const campaignStatus = evaluateCampaignStatus();
  const {
    isActive: isCampaignActive,
    title: campaignTitle,
    campaignId: activeCampaignId,
    gameStyle,
    rewardTiers,
    rewardProbabilities,
    rewardValidityDays,
    outcallRewardCap,
    telegramAutoNotify,
  } = campaignStatus;
  const isChristmas = gameStyle === 'christmas_santa';

  useEffect(() => {
    const savedPhone = localStorage.getItem('shangrila_user_phone') || '';
    const savedName = localStorage.getItem('shangrila_user_name') || '';
    if (savedPhone) {
      setUserPhone(savedPhone);
      setUserName(savedName);
      if (isCampaignActive) {
        checkInitialStatus(savedPhone);
      }
    }
  }, [isCampaignActive, activeCampaignId]);

  const checkInitialStatus = async (phone: string) => {
    try {
      const q = query(collection(db, 'campaign_records'));
      const querySnapshot = await getDocs(q);
      const today = getTodayStr();

      querySnapshot.forEach((docSnap) => {
        const data = docSnap.data();
        const sameCampaign = !data.campaignId || data.campaignId === activeCampaignId;
        if (data.phone === phone && data.date === today && sameCampaign) {
          setAlreadyPlayedToday(true);
          setPrize(data.discountPercent || 0);
          setPromoCode(data.promoCode || `${isChristmas ? 'XMAS' : 'PROMO'}-${data.discountPercent || 10}`);
          setRecordId(docSnap.id);
          setBotNotiState({
            sending: false,
            adminSent: Boolean(data.telegramNotiAdminSent),
            customerSent: Boolean(data.telegramNotiCustomerSent),
          });
        }
      });
    } catch {}
  };

  // ============================================================================
  // 🌟 AUTO SAVE TELEGRAM CHAT ID FOR REAL-TIME PROMO NOTIFICATIONS 🌟
  // ============================================================================
  const handleSubscribePromoNoti = async () => {
    if (subscribingNoti) return;
    setSubscribingNoti(true);
    setNotiFeedbackMsg('');

    try {
      const tgWebAppUser = (window as any)?.Telegram?.WebApp?.initDataUnsafe?.user;
      let detectedChatId: string | null =
        tgWebAppUser?.id?.toString() ||
        localStorage.getItem('shangrila_telegram_chat_id') ||
        localStorage.getItem('shangrila_customer_chat_id') ||
        localStorage.getItem('shangrila_tg_chat_id') ||
        localStorage.getItem('telegram_chat_id') ||
        null;

      const savedPhone = userPhone || localStorage.getItem('shangrila_user_phone') || '';
      let customerName =
        tgWebAppUser?.first_name ||
        localStorage.getItem('shangrila_user_name') ||
        'VIP Customer';

      if (!detectedChatId && savedPhone) {
        try {
          const usersSnap = await getDocs(query(collection(db, 'users')));
          usersSnap.forEach((uDoc) => {
            const uData = uDoc.data();
            if (uData.phone === savedPhone && (uData.telegramChatId || uData.chatId || uData.telegram_chat_id)) {
              detectedChatId = String(uData.telegramChatId || uData.chatId || uData.telegram_chat_id);
              if (uData.name) customerName = uData.name;
            }
          });
        } catch {}
      }

      const subscriberDocId = detectedChatId || (savedPhone ? `phone_${savedPhone}` : `guest_${Date.now()}`);
      await setDoc(
        doc(db, 'promo_subscribers', subscriberDocId),
        {
          chatId: detectedChatId || '',
          telegramChatId: detectedChatId || '',
          phone: savedPhone,
          name: customerName,
          campaignId: activeCampaignId,
          campaignTitle,
          subscribed: true,
          updatedAt: new Date().toISOString(),
          createdAt: Date.now(),
        },
        { merge: true }
      );

      if (detectedChatId) {
        localStorage.setItem('shangrila_telegram_chat_id', detectedChatId);
      }
      localStorage.setItem('shangrila_promo_noti_subscribed', 'true');
      setIsPromoSubscribed(true);

      if (detectedChatId) {
        setNotiFeedbackMsg(
          'လူကြီးမင်း၏ Telegram Chat ID ကို သိမ်းဆည်းပြီးပါပြီ။ Promotion ပြန်လည်စတင်သည်နှင့် Real-time အကြောင်းကြားပေးပါမည်။'
        );
      } else {
        setNotiFeedbackMsg(
          'Promotion အကြောင်းကြားစာ ရယူမှုကို သိမ်းဆည်းပြီးပါပြီ။ Promotion ပြန်လည်စတင်သည်နှင့် အကြောင်းကြားပေးပါမည်။'
        );
      }
    } catch {
      localStorage.setItem('shangrila_promo_noti_subscribed', 'true');
      setIsPromoSubscribed(true);
      setNotiFeedbackMsg('Promotion အကြောင်းကြားစာ ရယူမှုကို သိမ်းဆည်းပြီးပါပြီ။');
    } finally {
      setSubscribingNoti(false);
    }
  };

  const handleBackToMainBooking = () => {
    window.history.replaceState({}, document.title, '/');
    window.location.href = '/';
  };

  // Weighted prize selection (default: 10% = 55%, 15% = 23%, 20% = 14%, 30% = 7%, 50% = 1% / 1-in-100!)
  const calculatePrize = () => pickWeightedMiniGamePrize(rewardTiers, rewardProbabilities);

  // Save Winner to Firestore + LocalStorage + Fire Automatic Telegram Bot Notification
  const saveRecordAndNotifyTelegram = async (finalPrize: number, generatedCode: string) => {
    const today = getTodayStr();
    const tgUser = getDetectedTelegramWebAppUser();
    const resolvedName =
      userName ||
      localStorage.getItem('shangrila_user_name') ||
      [tgUser?.firstName, tgUser?.lastName].filter(Boolean).join(' ') ||
      'VIP Guest';

    let createdDocId: string | null = null;
    try {
      const docRef = await addDoc(collection(db, 'campaign_records'), {
        phone: userPhone,
        customerName: resolvedName,
        customerChatId: tgUser?.chatId || localStorage.getItem('shangrila_customer_chat_id') || '',
        discountPercent: finalPrize,
        promoCode: generatedCode,
        title: campaignTitle,
        campaignId: activeCampaignId,
        gameStyle,
        date: today,
        rewardValidityDays,
        outcallRewardCap,
        manualRedeemed: false,
        telegramClicked: false,
        telegramNotiAdminSent: false,
        telegramNotiCustomerSent: false,
        createdAt: Date.now(),
      });
      createdDocId = docRef.id;
      setRecordId(docRef.id);
    } catch (err) {
      console.error('Save winner record error:', err);
    }

    localStorage.setItem('shangrila_campaign_discount', finalPrize.toString());
    localStorage.setItem('shangrila_campaign_label', campaignTitle);
    localStorage.setItem('shangrila_campaign_date', today);
    localStorage.setItem('shangrila_campaign_code', generatedCode);
    setAlreadyPlayedToday(true);

    // Fire Real-Time Telegram Bot Notification (Admin Group + Linked Customer Bot DM)
    if (telegramAutoNotify) {
      setBotNotiState({ sending: true, adminSent: false, customerSent: false });
      try {
        const res = await notifyCampaignWinnerToTelegram({
          campaignId: activeCampaignId,
          campaignTitle,
          gameStyle,
          customerName: resolvedName,
          customerPhone: userPhone,
          customerChatId: tgUser?.chatId || localStorage.getItem('shangrila_customer_chat_id') || undefined,
          discountPercent: finalPrize,
          promoCode: generatedCode,
          rewardValidityDays,
          outcallRewardCap,
          winDate: today,
        });
        setBotNotiState({
          sending: false,
          adminSent: res.adminSent,
          customerSent: res.customerSent,
        });
        if (createdDocId) {
          await updateDoc(doc(db, 'campaign_records', createdDocId), {
            telegramNotiAdminSent: res.adminSent,
            telegramNotiCustomerSent: res.customerSent,
            ...(res.customerChatId ? { customerChatId: res.customerChatId } : {}),
            telegramNotiAt: Date.now(),
          }).catch(() => {});
        }
      } catch {
        setBotNotiState({ sending: false, adminSent: false, customerSent: false });
      }
    }
  };

  // ============================================================================
  // 🎅 CHRISTMAS SANTA SACK FLOW: START -> RUMMAGING -> GIFT READY -> UNWRAP -> RESULT
  // ============================================================================
  const startGame = async () => {
    if (!userPhone || !isCampaignActive) return;
    setInlineNotice('');
    setCheckingUser(true);
    playFestiveSound('click', soundMuted);

    try {
      const q = query(collection(db, 'campaign_records'));
      const querySnapshot = await getDocs(q);
      let alreadyPlayed = false;
      const today = getTodayStr();

      querySnapshot.forEach((docSnap) => {
        const data = docSnap.data();
        const sameCampaign = !data.campaignId || data.campaignId === activeCampaignId;
        if (data.phone === userPhone && data.date === today && sameCampaign) {
          alreadyPlayed = true;
          setPrize(data.discountPercent || 0);
          setPromoCode(data.promoCode || `${isChristmas ? 'XMAS' : 'PROMO'}-${data.discountPercent || 10}`);
          setRecordId(docSnap.id);
          setBotNotiState({
            sending: false,
            adminSent: Boolean(data.telegramNotiAdminSent),
            customerSent: Boolean(data.telegramNotiCustomerSent),
          });
        }
      });

      if (alreadyPlayed) {
        setAlreadyPlayedToday(true);
      } else if (isChristmas) {
        // Pre-draw prize with cryptographically fair configured probabilities
        const wonPrize = calculatePrize();
        const code = generateUniquePromoCode(wonPrize, true);
        setPrize(wonPrize);
        setPromoCode(code);

        // Enter Santa Rummaging Through Gift Sack Animation!
        clearRummageTimers();
        setRummageStep(0);
        setRummageProgress(12);
        setGameState('rummaging');
        playFestiveSound('rummage', soundMuted);

        // Save immediately so refresh during animation cannot re-roll infinitely
        saveRecordAndNotifyTelegram(wonPrize, code);

        const t1 = window.setTimeout(() => {
          setRummageStep(1);
          setRummageProgress(56);
        }, 1150);
        const t2 = window.setTimeout(() => {
          setRummageStep(2);
          setRummageProgress(92);
          playFestiveSound('click', soundMuted);
        }, 2300);
        const t3 = window.setTimeout(() => {
          setRummageProgress(100);
          setIsBursting(false);
          setGameState('gift_ready');
        }, 3200);
        rummageTimersRef.current = [t1, t2, t3];
      } else {
        // Legacy Lantern Catch Game
        setGameState('playing');
        setTimeLeft(15);
        setLanterns([]);
      }
    } catch (error: any) {
      setInlineNotice(`ချိတ်ဆက်မှု အခက်အခဲဖြစ်နေပါသည်။ (${error?.message || 'Network Error'})`);
    }
    setCheckingUser(false);
  };

  const handleUnwrapChristmasGift = () => {
    if (isBursting) return;
    setIsBursting(true);
    playFestiveSound(prize >= 50 ? 'jackpot' : 'unwrap', soundMuted);
    const t = window.setTimeout(() => {
      setGameState('result');
      setIsBursting(false);
    }, 1350);
    rummageTimersRef.current.push(t);
  };

  // Lantern game loop
  useEffect(() => {
    if (isChristmas) return;
    let lanternInterval: any;
    let timerInterval: any;

    if (gameState === 'start') {
      const initial = Array.from({ length: 9 }).map((_, i) => ({
        id: i,
        left: 6 + i * 10.5 + (Math.random() * 4 - 2),
        duration: 4 + Math.random() * 3,
        size: 0.9 + Math.random() * 0.65,
        delay: Math.random() * 2.5,
        opacity: 0.45 + Math.random() * 0.45,
      }));
      setMiniLanterns(initial);
    } else if (gameState === 'playing' && isCampaignActive) {
      lanternInterval = setInterval(() => {
        setLanterns((prev) => [
          ...prev,
          {
            id: Date.now() + Math.random(),
            left: 5 + Math.random() * 85,
            duration: 1.8 + Math.random() * 2.2,
            size: 2.5 + Math.random() * 1.8,
          },
        ]);
      }, 170);
      timerInterval = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            setGameState('start');
            setInlineNotice('အချိန်ကုန်သွားပါပြီ။ နောက်တစ်ကြိမ် ထပ်မံကံစမ်းကြည့်ပါ!');
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
  }, [gameState, isCampaignActive, isChristmas]);

  const catchLantern = (e: React.MouseEvent | React.TouchEvent, id: number) => {
    e.stopPropagation();
    if (gameState !== 'playing' || !isCampaignActive) return;
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
    const code = generateUniquePromoCode(wonPrize, false);
    setPrize(wonPrize);
    setPromoCode(code);
    setIsBursting(false);
    setCaughtLantern({ id, left: clientX, top: clientY });
    setGameState('opening');
    saveRecordAndNotifyTelegram(wonPrize, code);
  };

  const openCaughtLantern = () => {
    if (isBursting) return;
    setIsBursting(true);
    playFestiveSound(prize >= 50 ? 'jackpot' : 'unwrap', soundMuted);
    setTimeout(() => {
      setGameState('result');
      setIsBursting(false);
    }, 1600);
  };

  const goToLogin = () => {
    const returnParam = activeCampaignId
      ? `campaign&campaign=${encodeURIComponent(activeCampaignId)}`
      : 'campaign';
    window.location.href = `/?view=profile&return=${returnParam}`;
  };

  const viewPreviousResult = () => {
    setGameState('result');
    localStorage.setItem('shangrila_campaign_discount', prize.toString());
    localStorage.setItem('shangrila_campaign_label', campaignTitle);
    localStorage.setItem('shangrila_campaign_date', getTodayStr());
    if (promoCode) localStorage.setItem('shangrila_campaign_code', promoCode);
  };

  const getTelegramLink = () => {
    const tgLink = appData.branding?.telegram || 'https://t.me/admin';
    const finalCode = promoCode || `${isChristmas ? 'XMAS' : 'PROMO'}-${prize}`;
    const msg = encodeURIComponent(
      `မင်္ဂလာပါ။ ${campaignTitle} ကနေ ${prize}% Discount လက်ဆောင် ပေါက်ထားပါတယ်။\nဖုန်းနံပါတ်: ${userPhone}\nPromo Code: ${finalCode}`
    );

    let finalLink = tgLink;
    if (!finalLink.startsWith('http')) finalLink = `https://t.me/${finalLink.replace('@', '')}`;
    return `${finalLink}?text=${msg}`;
  };

  const markTelegramClicked = async () => {
    if (recordId) {
      try {
        await updateDoc(doc(db, 'campaign_records', recordId), { telegramClicked: true });
      } catch {}
    }
  };

  const handleButtonClickWithEffect = (e: React.MouseEvent<HTMLButtonElement>, callback: () => void) => {
    const button = e.currentTarget;
    button.style.transform = 'scale(0.96)';

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
    }, 240);
  };

  const maxTierPct = rewardTiers.length > 0 ? Math.max(...rewardTiers) : 50;
  const minTierPct = rewardTiers.length > 0 ? Math.min(...rewardTiers) : 10;
  const isJackpotWin = prize >= 50;

  return (
    <div
      className={`min-h-screen text-white flex flex-col relative overflow-hidden font-sans ${
        isChristmas ? 'bg-[#071A12]' : 'bg-[#0c0504]'
      }`}
    >
      <style>{`
        @keyframes christmasSnowFall {
          0% { transform: translateY(-10vh) translateX(0px); opacity: 0; }
          12% { opacity: var(--snow-op, 0.65); }
          88% { opacity: var(--snow-op, 0.65); }
          100% { transform: translateY(105vh) translateX(22px); opacity: 0; }
        }
        .xmas-snow-dot {
          position: fixed;
          top: 0;
          border-radius: 9999px;
          background: #ffffff;
          pointer-events: none;
          animation-name: christmasSnowFall;
          animation-timing-function: linear;
          animation-iteration-count: infinite;
          z-index: 1;
        }
        @keyframes santaRummageMotion {
          0%, 100% { transform: translateY(0px) rotate(-2.5deg) scale(1); }
          20% { transform: translateY(-8px) rotate(3deg) scale(1.03); }
          40% { transform: translateY(2px) rotate(-4deg) scale(0.985); }
          60% { transform: translateY(-7px) rotate(3.5deg) scale(1.035); }
          80% { transform: translateY(1px) rotate(-2deg) scale(0.99); }
        }
        .santa-rummage-shake {
          animation: santaRummageMotion 0.78s ease-in-out infinite;
        }
        @keyframes giftPeekBounce {
          0% { transform: translateY(24px) translateX(0px) scale(0.4) rotate(-18deg); opacity: 0; }
          40% { transform: translateY(-28px) translateX(var(--drift, 0px)) scale(1.15) rotate(12deg); opacity: 1; }
          75% { transform: translateY(-48px) translateX(calc(var(--drift, 0px) * 1.3)) scale(0.95) rotate(-8deg); opacity: 0.9; }
          100% { transform: translateY(-70px) translateX(calc(var(--drift, 0px) * 1.5)) scale(0.6) rotate(15deg); opacity: 0; }
        }
        .gift-peek-particle {
          position: absolute;
          bottom: 24%;
          animation: giftPeekBounce 1.35s ease-out infinite;
          pointer-events: none;
          user-select: none;
        }
        @keyframes giftBoxWobble {
          0%, 100% { transform: translateY(0px) rotate(0deg) scale(1); }
          20% { transform: translateY(-7px) rotate(-5deg) scale(1.04); }
          45% { transform: translateY(-2px) rotate(5deg) scale(1.05); }
          70% { transform: translateY(-6px) rotate(-3deg) scale(1.03); }
        }
        .gift-box-wobble {
          animation: giftBoxWobble 1.7s ease-in-out infinite;
        }
        @keyframes giftBoxUnwrapBurst {
          0% { transform: scale(1) rotate(0deg); opacity: 1; }
          30% { transform: scale(1.22) rotate(-8deg); filter: brightness(1.45); opacity: 1; }
          60% { transform: scale(1.38) rotate(8deg); filter: brightness(2); opacity: 0.9; }
          100% { transform: scale(0.2); opacity: 0; }
        }
        .gift-box-bursting {
          animation: giftBoxUnwrapBurst 1.1s cubic-bezier(0.22, 1, 0.36, 1) forwards;
        }
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
          50% { transform: translateY(-5px) scale(1.03); }
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
          background: rgba(255, 255, 255, 0.55);
          transform: scale(0);
          animation: campaignRipple 0.5s ease-out;
          pointer-events: none;
        }
        @keyframes campaignRipple {
          to { transform: scale(4); opacity: 0; }
        }
        @keyframes flyToCenterSlow {
          0% { left: var(--start-x); top: var(--start-y); transform: translate(-50%, -50%) scale(0.6); }
          100% { left: 50%; top: 45%; transform: translate(-50%, -50%) scale(1); }
        }
        @keyframes lanternWobbleSlow {
          0%, 100% { transform: rotate(0deg) scale(1); }
          20% { transform: rotate(-15deg) scale(1.08); }
          40% { transform: rotate(15deg) scale(1.12); }
          60% { transform: rotate(-12deg) scale(1.08); }
          80% { transform: rotate(10deg) scale(1.04); }
        }
        .caught-lantern-wrapper {
          position: fixed;
          z-index: 100;
          animation: flyToCenterSlow 0.95s cubic-bezier(0.22, 1, 0.36, 1) forwards;
        }
        .lantern-shake-continuous {
          display: inline-block;
          font-size: 6rem;
          animation: lanternWobbleSlow 1.4s ease-in-out infinite;
          filter: drop-shadow(0 0 40px rgba(255, 180, 0, 0.95));
          user-select: none;
        }
        @keyframes lanternGrandBurst {
          0% { transform: scale(1) rotate(0deg); opacity: 1; }
          25% { transform: scale(1.35) rotate(-10deg); filter: brightness(1.8) drop-shadow(0 0 50px #FFD700); opacity: 1; }
          50% { transform: scale(1.75) rotate(10deg); filter: brightness(2.5) drop-shadow(0 0 80px #FFF); opacity: 0.9; }
          100% { transform: scale(0.1); opacity: 0; }
        }
        .lantern-bursting {
          display: inline-block;
          font-size: 6rem;
          animation: lanternGrandBurst 1.1s cubic-bezier(0.22, 1, 0.36, 1) forwards;
        }
        @keyframes fireworkShootSlow {
          0% { transform: translate(-50%, -50%) scale(0.2); opacity: 0; }
          15% { opacity: 1; transform: translate(-50%, -50%) scale(1.2); }
          75% { opacity: 1; }
          100% { transform: translate(calc(-50% + var(--tx)), calc(-50% + var(--ty))) scale(1.35); opacity: 0; }
        }
        .firework-particle {
          position: absolute;
          top: 50%;
          left: 50%;
          border-radius: 50%;
          pointer-events: none;
          animation: fireworkShootSlow 1.45s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
        @keyframes shockwaveRingSlow {
          0% { transform: translate(-50%, -50%) scale(0.2); opacity: 1; border-width: 8px; }
          70% { opacity: 0.8; }
          100% { transform: translate(-50%, -50%) scale(3.6); opacity: 0; border-width: 1px; }
        }
        .firework-ring {
          position: absolute;
          top: 50%;
          left: 50%;
          width: 110px;
          height: 110px;
          border-radius: 50%;
          border: 5px solid #FFD700;
          box-shadow: 0 0 35px #FFD700, inset 0 0 20px #B91C1C;
          pointer-events: none;
          animation: shockwaveRingSlow 1.3s ease-out forwards;
        }
        @keyframes continuousSparkRay {
          0% { transform: translate(-50%, -50%) scale(0); opacity: 0; }
          20% { opacity: 1; }
          70% { opacity: 0.9; }
          100% { transform: translate(calc(-50% + var(--tx)), calc(-50% + var(--ty))) scale(1.2); opacity: 0; }
        }
        .continuous-firework-ray {
          position: absolute;
          top: 50%;
          left: 50%;
          width: 6px;
          height: 6px;
          border-radius: 50%;
          pointer-events: none;
          animation: continuousSparkRay 2.4s ease-out infinite;
        }
        @keyframes resultCardEntrance {
          0% { transform: scale(0.86) translateY(18px); opacity: 0; }
          100% { transform: scale(1) translateY(0px); opacity: 1; }
        }
        .result-card-slow-enter {
          animation: resultCardEntrance 0.65s cubic-bezier(0.22, 1, 0.36, 1) forwards;
        }
        @media (prefers-reduced-motion: reduce) {
          .xmas-snow-dot, .santa-rummage-shake, .gift-peek-particle, .gift-box-wobble, .center-emblem-float, .btn-shimmer-sweep {
            animation: none !important;
          }
        }
      `}</style>

      {/* Ambient Winter Snowfall (Christmas Theme Only) */}
      {isChristmas &&
        SNOW_PARTICLES.map((s) => (
          <span
            key={s.id}
            className="xmas-snow-dot"
            style={{
              left: `${s.left}%`,
              width: `${s.size}px`,
              height: `${s.size}px`,
              animationDuration: `${s.duration}s`,
              animationDelay: `${s.delay}s`,
              ['--snow-op' as any]: s.opacity,
            }}
          />
        ))}

      {/* 🌟 Safe-Area Luxury Header Bar 🌟 */}
      <div
        className={`px-4 py-3 z-50 flex items-center justify-between gap-2 backdrop-blur-md border-b border-[#D4AF37]/25 shadow-md ${
          isChristmas ? 'bg-[#0B2419]/92' : 'bg-[#140705]/90'
        }`}
        style={{ paddingTop: 'max(0.75rem, env(safe-area-inset-top))' }}
      >
        <button
          type="button"
          onClick={handleBackToMainBooking}
          className="min-h-[40px] flex items-center text-[#D4AF37] hover:text-yellow-300 font-bold text-xs sm:text-sm bg-white/5 px-3 py-1.5 rounded-xl border border-[#D4AF37]/30 active:scale-95 transition whitespace-nowrap shrink-0"
        >
          <ArrowLeft className="w-4 h-4 mr-1" /> နောက်သို့
        </button>

        <h1 className="font-extrabold text-[#FDE68A] tracking-wide truncate px-1 text-xs sm:text-sm text-center">
          {campaignTitle}
        </h1>

        <button
          type="button"
          onClick={() => setSoundMuted((m) => !m)}
          aria-label={soundMuted ? 'Unmute sound' : 'Mute sound'}
          className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-xl bg-white/5 hover:bg-white/10 text-[#D4AF37] border border-[#D4AF37]/30 transition shrink-0"
        >
          {soundMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
        </button>
      </div>

      {/* Main Arena Surface */}
      <div
        className={`flex-1 relative flex items-center justify-center p-4 ${
          isChristmas
            ? 'bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-[#173d2c] via-[#0B2419] to-[#06130d]'
            : 'bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-[#2b0f08] via-[#0f0504] to-[#070302]'
        }`}
      >
        {/* =========================================================================
            0. CAMPAIGN ENDED / OFF SCREEN
           ========================================================================= */}
        {!isCampaignActive ? (
          <div className="relative z-10 w-full max-w-[365px] rounded-[2rem] p-[1.5px] bg-gradient-to-b from-[#D4AF37]/85 via-[#D4AF37]/25 to-[#D4AF37]/65 shadow-[0_20px_60px_rgba(0,0,0,0.85)] result-card-slow-enter overflow-hidden">
            <div className="relative w-full h-full rounded-[calc(2rem-1.5px)] bg-gradient-to-b from-[#123524] via-[#0B2419] to-[#06150e] px-6 pt-7 pb-7 text-center overflow-hidden">
              <div className="relative z-10 mt-1 mb-5 flex flex-col items-center">
                <div className="text-[10px] font-bold text-[#D4AF37] uppercase tracking-[0.2em] mb-3">
                  Promotion Ended
                </div>
                <div className="w-16 h-16 rounded-2xl bg-[#D4AF37]/15 border border-[#D4AF37]/50 flex items-center justify-center center-emblem-float">
                  <BellRing className="w-7 h-7 text-[#D4AF37]" />
                </div>
              </div>

              <h2
                className="relative z-10 text-base sm:text-lg font-extrabold text-[#FDE68A] mb-3 px-1"
                style={{ lineHeight: '1.7' }}
              >
                Promotion ပြီးဆုံးသွားပါပြီ၊ ပြန်လည်စတင်တဲ့အခါ အကြောင်းကြားပေးပါမည်။
              </h2>

              <p
                className="relative z-10 text-gray-300/90 text-xs mb-6 px-1 font-medium"
                style={{ lineHeight: '1.75' }}
              >
                နောက်ထပ် အထူး Promotion နှင့် ကံစမ်းမဲအစီအစဉ်များ ပြန်လည်စတင်ချိန်တွင် Real-time သိရှိနိုင်ရန် အောက်ပါခလုတ်ကို နှိပ်ထားနိုင်ပါသည်။
              </p>

              {notiFeedbackMsg && (
                <div className="relative z-10 mb-4 p-3 rounded-xl bg-emerald-950/70 border border-emerald-500/40 text-[11px] text-emerald-200 font-medium leading-relaxed">
                  {notiFeedbackMsg}
                </div>
              )}

              <div className="relative z-10 space-y-3">
                <button
                  type="button"
                  disabled={subscribingNoti || isPromoSubscribed}
                  onClick={(e) => handleButtonClickWithEffect(e, handleSubscribePromoNoti)}
                  className="relative overflow-hidden w-full min-h-[46px] py-3 px-4 bg-[#D4AF37] hover:bg-[#c59b27] text-[#0B2419] rounded-xl font-black text-xs sm:text-sm shadow-lg transition flex items-center justify-center disabled:opacity-80"
                >
                  {subscribingNoti ? (
                    <span>သိမ်းဆည်းနေပါသည်...</span>
                  ) : isPromoSubscribed ? (
                    <>
                      <CheckCircle2 className="w-4 h-4 mr-2 stroke-[2.5]" />
                      <span>အကြောင်းကြားစာ ရယူပြီးပါပြီ</span>
                    </>
                  ) : (
                    <>
                      <BellRing className="w-4 h-4 mr-2 stroke-[2.5]" />
                      <span>Promotion အကြောင်းကြားစာများယူရန်</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={(e) => handleButtonClickWithEffect(e, handleBackToMainBooking)}
                  className="w-full min-h-[44px] py-3 px-4 bg-white/[0.08] hover:bg-white/[0.14] text-gray-200 rounded-xl font-bold text-xs sm:text-sm border border-[#D4AF37]/30 transition"
                >
                  နားလည်ပါပြီ
                </button>
              </div>
            </div>
          </div>
        ) : (
          <>
            {/* =====================================================================
                1A. CHRISTMAS SANTA — START SCREEN
               ===================================================================== */}
            {isChristmas && gameState === 'start' && (
              <div className="relative z-10 w-full max-w-[385px] rounded-[2rem] p-[1.5px] bg-gradient-to-b from-[#D4AF37] via-[#991b1b]/80 to-[#D4AF37]/80 shadow-[0_24px_65px_rgba(0,0,0,0.8)] animate-fade-in overflow-hidden">
                <div className="relative w-full rounded-[calc(2rem-1.5px)] bg-gradient-to-b from-[#123524] via-[#0B2419] to-[#1A090C] px-5 sm:px-6 pt-6 pb-6 text-center overflow-hidden">
                  <div className="absolute -top-20 left-1/2 -translate-x-1/2 w-72 h-52 bg-gradient-to-b from-[#991b1b]/45 via-[#D4AF37]/20 to-transparent rounded-full blur-2xl pointer-events-none" />

                  <div className="relative z-10 flex items-center justify-center gap-1.5 text-[10px] font-bold text-[#D4AF37] uppercase tracking-[0.22em] mb-3">
                    <Snowflake className="w-3 h-3" />
                    <span>{campaignStatus.badgeText || 'CHRISTMAS SANTA GIFT SACK'}</span>
                    <Snowflake className="w-3 h-3" />
                  </div>

                  {/* Hero Santa Portrait */}
                  <div className="relative z-10 mx-auto w-44 h-44 sm:w-48 sm:h-48 rounded-3xl p-[2px] bg-gradient-to-b from-[#D4AF37] via-amber-200/70 to-[#991b1b] shadow-[0_14px_40px_rgba(0,0,0,0.6)] mb-4 center-emblem-float">
                    <div className="w-full h-full rounded-[calc(1.5rem-2px)] overflow-hidden bg-[#0B2419] flex items-center justify-center">
                      {!imgFallback.hero ? (
                        <img
                          src={santaHeroImg}
                          alt="Santa Claus holding a velvet gift sack"
                          referrerPolicy="no-referrer"
                          onError={() => setImgFallback((p) => ({ ...p, hero: true }))}
                          className="w-full h-full object-cover scale-[1.12]"
                        />
                      ) : (
                        <div className="w-full h-full bg-gradient-to-b from-[#7f1d1d] to-[#0B2419] flex flex-col items-center justify-center text-[#D4AF37]">
                          <Gift className="w-14 h-14 mb-1" />
                          <span className="text-xs font-black">SANTA GIFT SACK</span>
                        </div>
                      )}
                    </div>
                  </div>

                  <h2
                    className="relative z-10 text-xl sm:text-2xl font-serif font-extrabold text-[#FDE68A] mb-2 tracking-wide leading-snug"
                    style={{ textWrap: 'balance' }}
                  >
                    {campaignTitle}
                  </h2>

                  <p className="relative z-10 text-gray-200/95 text-xs mb-3.5 leading-relaxed px-1 font-medium">
                    Santa ဖိုးဖိုးကြီး၏ လက်ဆောင်အိတ်ကြီးထဲမှ{' '}
                    <span className="text-[#FDE68A] font-extrabold">
                      {minTierPct}% မှ {maxTierPct}% OFF
                    </span>{' '}
                    အထိ Christmas အထူးလက်ဆောင်များ ရယူလိုက်ပါ။
                  </p>

                  {/* Clean Unboxed Reward Tiers & Validity Metadata */}
                  <div className="relative z-10 text-[11px] font-mono font-bold text-[#D4AF37] tabular-nums mb-1">
                    {rewardTiers.map((t) => `${t}%`).join(' · ')} OFF
                  </div>
                  <div className="relative z-10 text-[10.5px] text-emerald-200/80 mb-5">
                    တစ်ရက်လျှင် ၁ ကြိမ် · ဆုသက်တမ်း {rewardValidityDays === 1 ? '1 Day' : `${rewardValidityDays} Days`}
                  </div>

                  {inlineNotice && (
                    <div className="relative z-10 mb-3.5 p-3 rounded-xl bg-red-950/60 border border-red-500/40 text-xs text-red-200 font-medium">
                      {inlineNotice}
                    </div>
                  )}

                  <div className="relative z-10">
                    {userPhone ? (
                      <div className="space-y-3">
                        <div className="bg-black/40 border border-[#D4AF37]/30 rounded-xl py-2.5 px-4 flex items-center justify-center">
                          <UserCircle className="w-4 h-4 text-[#D4AF37] mr-2 shrink-0" />
                          <span className="text-xs sm:text-sm font-black text-[#FDE68A] tracking-[0.16em] tabular-nums">
                            {userPhone}
                          </span>
                        </div>

                        {alreadyPlayedToday ? (
                          <div className="space-y-3">
                            <div className="bg-emerald-950/60 border border-[#D4AF37]/30 rounded-xl p-3 text-center">
                              <p className="text-[11px] text-amber-100 font-semibold leading-relaxed">
                                ယနေ့အတွက် Santa ဖိုးဖိုးကြီးထံမှ လက်ဆောင် ({prize}% OFF) ရယူပြီးပါပြီ။ မနက်ဖြန်တွင် ထပ်မံကံစမ်းနိုင်ပါသည်။
                              </p>
                            </div>
                            <button
                              type="button"
                              onClick={(e) => handleButtonClickWithEffect(e, viewPreviousResult)}
                              className="relative overflow-hidden w-full min-h-[48px] py-3.5 px-4 bg-[#D4AF37] hover:bg-[#c59b27] text-[#0B2419] rounded-xl font-black text-xs sm:text-sm shadow-lg transition flex items-center justify-center gap-2"
                            >
                              <Gift className="w-4 h-4 stroke-[2.5]" />
                              <span>ရရှိထားသော Christmas လက်ဆောင် ကြည့်မည်</span>
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={(e) => handleButtonClickWithEffect(e, startGame)}
                            disabled={checkingUser}
                            className="relative overflow-hidden w-full min-h-[52px] py-3.5 px-4 bg-gradient-to-r from-[#B91C1C] via-[#991B1B] to-[#7F1D1D] hover:from-[#DC2626] hover:to-[#991B1B] text-[#FDE68A] rounded-xl font-black text-xs sm:text-sm shadow-[0_10px_28px_rgba(153,27,27,0.55)] border border-[#D4AF37]/80 transition-all duration-200 flex items-center justify-center gap-2 disabled:opacity-50 tracking-wide"
                          >
                            <span className="absolute inset-0 w-1/2 h-full bg-gradient-to-r from-transparent via-white/25 to-transparent btn-shimmer-sweep pointer-events-none" />
                            {checkingUser ? (
                              <span className="relative z-10">စစ်ဆေးနေပါသည်...</span>
                            ) : (
                              <>
                                <Gift className="w-5 h-5 relative z-10 text-[#D4AF37] shrink-0" />
                                <span className="relative z-10">Santa ဖိုးဖိုးကြီးထံမှ လက်ဆောင်တောင်းမယ်</span>
                              </>
                            )}
                          </button>
                        )}
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <div className="bg-black/40 border border-[#D4AF37]/30 rounded-xl p-3.5 text-xs text-amber-100 font-medium leading-relaxed">
                          Santa ဖိုးဖိုးကြီးထံမှ လက်ဆောင်တောင်းရန် အရင်ဆုံး အကောင့် ဝင်ရန် (Login) လိုအပ်ပါသည်။
                        </div>
                        <button
                          type="button"
                          onClick={(e) => handleButtonClickWithEffect(e, goToLogin)}
                          className="relative overflow-hidden w-full min-h-[48px] py-3.5 bg-[#D4AF37] hover:bg-[#c59b27] text-[#0B2419] rounded-xl font-black text-xs sm:text-sm shadow-lg transition flex items-center justify-center gap-2"
                        >
                          <LogIn className="w-4 h-4 stroke-[2.5]" />
                          <span>Login အရင်ဝင်မည်</span>
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* =====================================================================
                1B. CHRISTMAS SANTA — RUMMAGING IN GIFT SACK ANIMATION
               ===================================================================== */}
            {isChristmas && gameState === 'rummaging' && (
              <div className="relative z-10 w-full max-w-[385px] rounded-[2rem] p-[1.5px] bg-gradient-to-b from-[#D4AF37] via-[#991b1b]/80 to-[#D4AF37]/75 shadow-[0_24px_65px_rgba(0,0,0,0.85)] overflow-hidden">
                <div className="relative w-full rounded-[calc(2rem-1.5px)] bg-gradient-to-b from-[#133826] via-[#0B2419] to-[#1A090C] px-6 py-7 text-center overflow-hidden">
                  <div className="text-[10px] font-bold text-[#D4AF37] uppercase tracking-[0.22em] mb-4">
                    Searching Santa&apos;s Gift Sack
                  </div>

                  {/* Animated Santa Rummaging Stage with Peeking Gifts */}
                  <div className="relative mx-auto w-56 h-56 sm:w-60 sm:h-60 flex items-center justify-center mb-5">
                    {/* Radiant Golden Glow behind the sack */}
                    <div className="absolute inset-4 rounded-full bg-gradient-to-b from-[#D4AF37]/30 via-[#B91C1C]/25 to-transparent blur-2xl pointer-events-none" />

                    {/* Animated Santa Rummaging Image */}
                    <div className="relative w-52 h-52 sm:w-56 sm:h-56 rounded-3xl p-[2px] bg-gradient-to-b from-[#D4AF37] to-[#991b1b] shadow-[0_16px_45px_rgba(0,0,0,0.65)] santa-rummage-shake overflow-hidden">
                      <div className="w-full h-full rounded-[calc(1.5rem-2px)] overflow-hidden bg-[#0B2419] flex items-center justify-center">
                        {!imgFallback.rummage ? (
                          <img
                            src={santaRummagingImg}
                            alt="Santa rummaging inside his velvet gift sack"
                            referrerPolicy="no-referrer"
                            onError={() => setImgFallback((p) => ({ ...p, rummage: true }))}
                            className="w-full h-full object-cover scale-[1.06]"
                          />
                        ) : (
                          <div className="w-full h-full bg-gradient-to-b from-[#7f1d1d] to-[#0B2419] flex flex-col items-center justify-center text-[#D4AF37]">
                            <Gift className="w-16 h-16 animate-bounce" />
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Peeking Gifts, Stars & Bells rustling up from the open sack */}
                    <div className="absolute inset-0 pointer-events-none overflow-visible">
                      {RUMMAGE_GIFTS.map((g) => (
                        <span
                          key={g.id}
                          className="gift-peek-particle text-2xl sm:text-3xl drop-shadow-[0_4px_10px_rgba(0,0,0,0.6)]"
                          style={{
                            left: g.left,
                            animationDelay: g.delay,
                            ['--drift' as any]: g.drift,
                          }}
                        >
                          {g.icon}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Dynamic Storytelling Caption */}
                  <h3
                    className="text-sm sm:text-base font-extrabold text-[#FDE68A] mb-3 min-h-[44px] flex items-center justify-center px-2 transition-all"
                    style={{ lineHeight: '1.6' }}
                  >
                    {RUMMAGE_CAPTIONS[rummageStep] || RUMMAGE_CAPTIONS[0]}
                  </h3>

                  {/* Smooth Progress Bar */}
                  <div className="w-full h-2.5 bg-black/45 rounded-full overflow-hidden border border-[#D4AF37]/30 p-0.5">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-[#B91C1C] via-[#D4AF37] to-[#FDE68A] transition-all duration-700 ease-out"
                      style={{ width: `${rummageProgress}%` }}
                    />
                  </div>
                  <div className="mt-2.5 text-[11px] text-emerald-200/80 font-mono tabular-nums">
                    {rummageStep === 2 ? 'Ready to unwrap...' : '10% · 15% · 20% · 30% · 50% OFF'}
                  </div>
                </div>
              </div>
            )}

            {/* =====================================================================
                1C. CHRISTMAS SANTA — MYSTERY GIFT BOX READY (TAP TO UNWRAP!)
               ===================================================================== */}
            {isChristmas && gameState === 'gift_ready' && (
              <div
                className="relative z-20 w-full max-w-[385px] rounded-[2rem] p-[1.5px] bg-gradient-to-b from-[#D4AF37] via-[#FDE68A]/70 to-[#991b1b] shadow-[0_24px_70px_rgba(0,0,0,0.85)] overflow-hidden cursor-pointer"
                onClick={handleUnwrapChristmasGift}
              >
                <div className="relative w-full rounded-[calc(2rem-1.5px)] bg-gradient-to-b from-[#133826] via-[#0B2419] to-[#1A090C] px-6 py-7 text-center overflow-hidden">
                  <div className="text-[10px] font-bold text-[#D4AF37] uppercase tracking-[0.22em] mb-2">
                    Santa Found Your Gift
                  </div>
                  <h3 className="text-lg font-serif font-extrabold text-[#FDE68A] mb-4">
                    ဖိုးဖိုးကြီး ထုတ်ပေးလိုက်တဲ့ လက်ဆောင်ဘူး!
                  </h3>

                  {/* Interactive Glowing Gift Box + Unwrap Fireworks */}
                  <div className="relative mx-auto w-56 h-56 flex items-center justify-center mb-5">
                    {!isBursting && (
                      <div className="absolute inset-4 rounded-full bg-[#D4AF37]/25 blur-2xl pointer-events-none" />
                    )}

                    {isBursting && (
                      <>
                        <div className="firework-ring" />
                        <div className="firework-ring" style={{ animationDelay: '0.2s' }} />
                        {OPENING_FIREWORKS.map((p) => (
                          <div
                            key={p.id}
                            className="firework-particle flex items-center justify-center"
                            style={
                              {
                                '--tx': p.tx,
                                '--ty': p.ty,
                                animationDelay: p.delay,
                                width: p.size,
                                height: p.size,
                                backgroundColor: p.emoji ? 'transparent' : p.color,
                                boxShadow: p.emoji ? 'none' : `0 0 14px ${p.color}`,
                              } as React.CSSProperties
                            }
                          >
                            {p.emoji && <span className="text-xl">{p.emoji}</span>}
                          </div>
                        ))}
                      </>
                    )}

                    <div
                      className={`relative w-48 h-48 rounded-3xl p-[2px] bg-gradient-to-b from-[#D4AF37] via-amber-200 to-[#991b1b] shadow-[0_14px_40px_rgba(212,175,55,0.35)] overflow-hidden ${
                        isBursting ? 'gift-box-bursting' : 'gift-box-wobble'
                      }`}
                    >
                      <div className="w-full h-full rounded-[calc(1.5rem-2px)] overflow-hidden bg-[#0B2419] flex items-center justify-center">
                        {!imgFallback.gift ? (
                          <img
                            src={luxuryGiftBoxImg}
                            alt="Wrapped Christmas mystery gift box"
                            referrerPolicy="no-referrer"
                            onError={() => setImgFallback((p) => ({ ...p, gift: true }))}
                            className="w-full h-full object-cover scale-[1.04]"
                          />
                        ) : (
                          <Gift className="w-20 h-20 text-[#D4AF37]" />
                        )}
                      </div>
                    </div>
                  </div>

                  {!isBursting ? (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleUnwrapChristmasGift();
                      }}
                      className="relative overflow-hidden w-full min-h-[50px] py-3.5 px-4 bg-[#D4AF37] hover:bg-[#c59b27] text-[#0B2419] rounded-xl font-black text-sm shadow-[0_8px_25px_rgba(212,175,55,0.45)] transition flex items-center justify-center gap-2"
                    >
                      <span className="absolute inset-0 w-1/2 h-full bg-gradient-to-r from-transparent via-white/45 to-transparent btn-shimmer-sweep pointer-events-none" />
                      <Sparkles className="w-4 h-4 relative z-10 stroke-[2.5]" />
                      <span className="relative z-10">လက်ဆောင်ဘူး ဖွင့်ကြည့်မည်</span>
                    </button>
                  ) : (
                    <div className="py-3 text-[#FDE68A] font-black text-sm tracking-wide">
                      လက်ဆောင်ဘူး ဖွင့်နေပါပြီ...
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* =====================================================================
                2A. LEGACY LANTERN GAME — START SCREEN
               ===================================================================== */}
            {!isChristmas && gameState === 'start' && (
              <div className="relative z-10 w-full max-w-[355px] rounded-[2rem] p-[1.5px] bg-gradient-to-b from-[#D4AF37]/85 via-[#D4AF37]/25 to-[#D4AF37]/65 shadow-[0_20px_60px_rgba(0,0,0,0.9),0_0_45px_rgba(212,175,55,0.18)] animate-fade-in overflow-hidden">
                <div className="relative w-full h-full rounded-[calc(2rem-1.5px)] bg-gradient-to-b from-[#2a0e08] via-[#140705] to-[#0a0403] px-6 pt-7 pb-7 text-center overflow-hidden">
                  <div className="absolute inset-2.5 rounded-[1.5rem] border border-[#D4AF37]/15 pointer-events-none z-20" />
                  <div className="absolute -top-20 left-1/2 -translate-x-1/2 w-72 h-52 bg-gradient-to-b from-amber-500/35 via-orange-600/15 to-transparent rounded-full blur-2xl pointer-events-none" />

                  <div
                    className="absolute top-0 left-0 right-0 h-48 overflow-hidden pointer-events-none z-0"
                    style={{
                      WebkitMaskImage: 'linear-gradient(to bottom, black 45%, transparent 100%)',
                      maskImage: 'linear-gradient(to bottom, black 45%, transparent 100%)',
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
                          ['--max-op' as any]: lantern.opacity || 0.75,
                        }}
                      >
                        🏮
                      </div>
                    ))}
                  </div>

                  <div className="relative z-10 mt-1 mb-4 flex flex-col items-center">
                    <div className="text-[10px] font-bold text-[#D4AF37] uppercase tracking-[0.2em] mb-3">
                      Lucky Draw Game
                    </div>
                    <div className="relative w-16 h-16 rounded-full bg-gradient-to-b from-amber-500/25 to-orange-900/40 border border-[#D4AF37]/50 flex items-center justify-center shadow-[0_0_25px_rgba(245,158,11,0.35)] center-emblem-float">
                      <span className="text-3xl filter drop-shadow-[0_2px_8px_rgba(255,165,0,0.8)]">🏮</span>
                    </div>
                  </div>

                  <h2 className="relative z-10 text-xl sm:text-2xl font-extrabold text-[#FDE68A] mb-2.5 tracking-wide leading-snug">
                    {campaignTitle}
                  </h2>
                  <p className="relative z-10 text-gray-300/95 text-xs mb-5 leading-relaxed px-1 font-medium">
                    မီးပုံးလေးတွေကို ဖမ်းပြီး{' '}
                    <span className="text-yellow-400 font-extrabold">
                      {maxTierPct}% အထိ Discount
                    </span>{' '}
                    ရယူပါ။ <span className="block text-[10.5px] text-gray-400 mt-1">(တစ်ရက်လျှင် ၁ ကြိမ်သာ ကံစမ်းခွင့်ရှိသည်)</span>
                  </p>

                  {inlineNotice && (
                    <div className="relative z-10 mb-3 p-3 rounded-xl bg-amber-950/60 border border-amber-500/40 text-xs text-amber-200 font-medium">
                      {inlineNotice}
                    </div>
                  )}

                  <div className="relative z-10">
                    {userPhone ? (
                      <div className="space-y-3.5">
                        <div className="bg-black/50 border border-[#D4AF37]/35 rounded-xl py-3 px-4 flex items-center justify-center">
                          <UserCircle className="w-4 h-4 text-[#D4AF37] mr-2" />
                          <span className="text-xs sm:text-sm font-black text-yellow-400 tracking-[0.18em]">{userPhone}</span>
                        </div>

                        {alreadyPlayedToday ? (
                          <div className="space-y-3">
                            <div className="bg-amber-950/40 border border-[#D4AF37]/30 rounded-xl p-3.5 text-center">
                              <p className="text-[11px] text-yellow-200/90 font-semibold leading-relaxed">
                                လူကြီးမင်းသည် ယနေ့အတွက် ကံစမ်းခွင့် ပြည့်သွားပါပြီ။ မနက်ဖြန်တွင် ထပ်မံကံစမ်းနိုင်ပါသည်။
                              </p>
                            </div>
                            <button
                              type="button"
                              onClick={(e) => handleButtonClickWithEffect(e, viewPreviousResult)}
                              className="w-full min-h-[46px] py-3 bg-[#D4AF37] text-[#123524] rounded-xl font-black text-xs sm:text-sm flex items-center justify-center gap-2"
                            >
                              <AlertCircle className="w-4 h-4 stroke-[2.5]" />
                              <span>ရရှိထားသော Discount အား ကြည့်မည်</span>
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={(e) => handleButtonClickWithEffect(e, startGame)}
                            disabled={checkingUser}
                            className="relative overflow-hidden w-full min-h-[50px] py-3.5 bg-gradient-to-r from-[#D4AF37] via-yellow-400 to-[#c59b27] text-[#123524] rounded-xl font-black text-sm sm:text-base shadow-lg transition flex items-center justify-center disabled:opacity-50"
                          >
                            {checkingUser ? (
                              <span>စစ်ဆေးနေပါသည်...</span>
                            ) : (
                              <>
                                <Sparkles className="w-5 h-5 mr-2 stroke-[2.5]" />
                                <span>ကစားမည် (Play Now)</span>
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
                          className="w-full min-h-[46px] py-3.5 bg-[#D4AF37] text-[#123524] rounded-xl font-black text-xs sm:text-sm flex items-center justify-center gap-2"
                        >
                          <LogIn className="w-4 h-4 stroke-[2.5]" />
                          <span>Login အရင်ဝင်မည်</span>
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* =====================================================================
                2B. LEGACY LANTERN GAME — PLAYING & OPENING SCREENS
               ===================================================================== */}
            {!isChristmas && gameState === 'playing' && (
              <>
                <div className="absolute top-5 z-50 bg-[#140705]/90 border border-[#D4AF37]/60 px-6 py-2.5 rounded-full flex items-center text-[#D4AF37] font-black text-lg shadow-lg backdrop-blur-md tabular-nums">
                  <Timer className="w-5 h-5 mr-2 text-yellow-400" /> {timeLeft} စက္ကန့်
                </div>
                <div className="absolute bottom-8 z-40 text-center pointer-events-none">
                  <span className="text-xs font-bold text-yellow-200/80 bg-black/50 px-4 py-1.5 rounded-full border border-white/10">
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
                      top: '-10vh',
                    }}
                  >
                    🏮
                  </div>
                ))}
              </>
            )}

            {!isChristmas && gameState === 'opening' && caughtLantern && (
              <div
                className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex flex-col items-center justify-center cursor-pointer"
                onClick={openCaughtLantern}
              >
                <div
                  className="caught-lantern-wrapper flex items-center justify-center"
                  style={{ '--start-x': `${caughtLantern.left}px`, '--start-y': `${caughtLantern.top}px` } as React.CSSProperties}
                >
                  {isBursting && (
                    <>
                      <div className="firework-ring" />
                      {OPENING_FIREWORKS.map((p) => (
                        <div
                          key={p.id}
                          className="firework-particle flex items-center justify-center"
                          style={
                            {
                              '--tx': p.tx,
                              '--ty': p.ty,
                              animationDelay: p.delay,
                              width: p.size,
                              height: p.size,
                              backgroundColor: p.emoji ? 'transparent' : p.color,
                            } as React.CSSProperties
                          }
                        >
                          {p.emoji && <span className="text-xl">{p.emoji}</span>}
                        </div>
                      ))}
                    </>
                  )}
                  <div className={isBursting ? 'lantern-bursting' : 'lantern-shake-continuous'}>🏮</div>
                </div>
                <div className="absolute bottom-24 text-center px-6">
                  <div className="text-yellow-200 font-extrabold text-sm sm:text-base">
                    {isBursting ? 'ကံထူးဆုမဲ ပွင့်နေပါပြီ...' : 'ဆုမဲဖွင့်ရန် မီးပုံးလေးကို နှိပ်ပါ'}
                  </div>
                </div>
              </div>
            )}

            {/* =====================================================================
                3. UNIFIED WINNER RESULT SCREEN (CHRISTMAS SANTA & LANTERN)
               ===================================================================== */}
            {gameState === 'result' && (
              <div
                className={`w-full max-w-[385px] mx-auto max-h-[86vh] overflow-y-auto scrollbar-hide z-40 rounded-[2rem] p-[1.5px] shadow-[0_24px_65px_rgba(0,0,0,0.9)] result-card-slow-enter ${
                  isJackpotWin
                    ? 'bg-gradient-to-b from-[#FDE68A] via-[#D4AF37] to-[#B91C1C]'
                    : isChristmas
                    ? 'bg-gradient-to-b from-[#D4AF37] via-[#991b1b]/80 to-[#D4AF37]/75'
                    : 'bg-gradient-to-b from-[#D4AF37] via-[#D4AF37]/30 to-[#D4AF37]/70'
                }`}
              >
                <div
                  className={`relative text-center p-5 sm:p-6 rounded-[calc(2rem-1.5px)] overflow-hidden ${
                    isChristmas
                      ? 'bg-gradient-to-b from-[#133826] via-[#0B2419] to-[#1A090C]'
                      : 'bg-gradient-to-b from-[#2a0e08] via-[#140705] to-[#0a0403]'
                  }`}
                >
                  {/* Subtle Top Celebration Sparks */}
                  <div className="absolute top-0 left-0 right-0 h-40 overflow-hidden pointer-events-none z-0">
                    <div className="absolute top-12 left-1/2 -translate-x-1/2">
                      {HEADER_SPARK_RAYS.map((r) => (
                        <div
                          key={`center-${r.id}`}
                          className="continuous-firework-ray"
                          style={
                            {
                              '--tx': r.tx,
                              '--ty': r.ty,
                              backgroundColor: r.color,
                              boxShadow: `0 0 10px ${r.color}`,
                              animationDelay: '0s',
                            } as React.CSSProperties
                          }
                        />
                      ))}
                    </div>
                  </div>

                  {/* Top Icon / Emblem */}
                  <div className="relative z-10 w-16 h-16 rounded-2xl bg-[#D4AF37]/15 border border-[#D4AF37]/60 flex items-center justify-center mx-auto mb-3 shadow-md center-emblem-float">
                    {isJackpotWin ? (
                      <Crown className="w-8 h-8 text-[#FDE68A]" />
                    ) : isChristmas ? (
                      <Gift className="w-8 h-8 text-[#FDE68A]" />
                    ) : (
                      <PartyPopper className="w-8 h-8 text-yellow-300" />
                    )}
                  </div>

                  <div className="relative z-10 text-[10px] font-bold uppercase tracking-[0.22em] text-[#D4AF37] mb-1">
                    {isJackpotWin
                      ? 'RARE GRAND JACKPOT WINNER'
                      : isChristmas
                      ? 'MERRY CHRISTMAS GIFT'
                      : 'CAMPAIGN REWARD'}
                  </div>

                  <h2 className="text-lg sm:text-xl font-serif font-extrabold text-white mb-4 relative z-10 tracking-wide">
                    {isJackpotWin
                      ? 'အထူးကံထူးရှင် ဖြစ်သွားပါပြီ!'
                      : isChristmas
                      ? 'Santa ဖိုးဖိုးကြီးရဲ့ လက်ဆောင် ရရှိပါပြီ!'
                      : 'ဂုဏ်ယူပါတယ် ခင်ဗျာ!'}
                  </h2>

                  {/* Prize Reveal Panel */}
                  <div className="relative z-10 bg-black/45 border border-[#D4AF37]/55 rounded-2xl p-5 mb-4">
                    <div className="text-[10px] font-bold uppercase tracking-[0.22em] text-[#D4AF37]/85 mb-1">
                      {isJackpotWin ? '1-in-100 Grand Prize' : 'Your Special Discount'}
                    </div>
                    <div className="text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-[#FEF08A] via-[#D4AF37] to-[#F59E0B] my-1 tabular-nums">
                      {prize}% OFF
                    </div>
                    <p className="text-emerald-300 text-xs font-bold mt-1">
                      အထူး Discount ခံစားခွင့် ရရှိသွားပါပြီ
                    </p>
                  </div>

                  {/* Promo Code Row */}
                  <div className="text-left bg-white/[0.06] px-4 py-3 rounded-xl mb-3.5 border border-[#D4AF37]/25 relative z-10 flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-[10px] text-gray-300 font-semibold mb-0.5 truncate">
                        Promo Code · {userPhone}
                      </p>
                      <span className="font-mono font-black text-sm sm:text-base tracking-widest text-[#FDE68A] tabular-nums">
                        {promoCode || `${isChristmas ? 'XMAS' : 'PROMO'}-${prize}`}
                      </span>
                    </div>
                    <span className="text-[10px] text-emerald-300 font-extrabold uppercase tracking-wider shrink-0">
                      Auto Applied
                    </span>
                  </div>

                  {/* Real-Time Telegram Bot Notification Status Strip */}
                  {telegramAutoNotify && (
                    <div className="relative z-10 mb-3.5 px-3.5 py-2.5 rounded-xl bg-sky-950/45 border border-sky-400/30 text-left flex items-start gap-2.5 text-[11px]">
                      <Send className="w-4 h-4 text-sky-300 shrink-0 mt-0.5" />
                      <div className="text-sky-100 leading-relaxed">
                        {botNotiState.sending ? (
                          <span>Telegram Bot မှတဆင့် အကြောင်းကြားစာ ပေးပို့နေပါသည်...</span>
                        ) : botNotiState.customerSent ? (
                          <span>
                            Telegram Bot မှတဆင့် လူကြီးမင်း၏ Voucher နှင့် Admin ထံသို့ အလိုအလျောက် ပေးပို့ပြီးပါပြီ။
                          </span>
                        ) : botNotiState.adminSent ? (
                          <span>
                            Admin Telegram Group ထံသို့ လူကြီးမင်း၏ ဆုမဲမှတ်တမ်းကို အလိုအလျောက် အကြောင်းကြားပြီးပါပြီ။
                          </span>
                        ) : (
                          <span>
                            Admin Campaign Tab တွင် လူကြီးမင်း၏ ဆုမဲမှတ်တမ်းကို သိမ်းဆည်းပြီးပါပြီ။
                          </span>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Primary Action: Back to Booking (Auto-Applied!) */}
                  <button
                    type="button"
                    onClick={(e) => handleButtonClickWithEffect(e, handleBackToMainBooking)}
                    className="relative overflow-hidden w-full min-h-[50px] py-3.5 px-4 bg-[#D4AF37] hover:bg-[#c59b27] text-[#0B2419] rounded-xl font-black text-sm shadow-lg transition flex items-center justify-center gap-2 z-10 mb-3"
                  >
                    <span className="absolute inset-0 w-1/2 h-full bg-gradient-to-r from-transparent via-white/45 to-transparent btn-shimmer-sweep pointer-events-none" />
                    <CalendarCheck className="w-4 h-4 relative z-10 stroke-[2.5]" />
                    <span className="relative z-10">App မှ Booking တင်မည် ({prize}% OFF)</span>
                  </button>

                  {/* Secondary Action: Direct Telegram Admin Message */}
                  <a
                    href={getTelegramLink()}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={markTelegramClicked}
                    className="w-full min-h-[44px] py-3 px-4 bg-white/[0.08] hover:bg-white/[0.14] text-sky-200 border border-sky-400/35 rounded-xl font-bold text-xs transition flex items-center justify-center gap-2 relative z-10"
                  >
                    <MessageCircle className="w-4 h-4" />
                    <span>Walk-in အတွက် Telegram Admin သို့ ပို့မည်</span>
                  </a>

                  {/* Dynamic Terms & Conditions */}
                  <div className="mt-5 text-left border-t border-white/10 pt-4 relative z-10">
                    <h4 className="text-[10px] font-bold text-[#D4AF37] uppercase tracking-widest mb-2 flex items-center">
                      <Info className="w-3.5 h-3.5 mr-1.5" /> Terms & Conditions
                    </h4>
                    <ul className="space-y-1.5 text-[10.5px] text-gray-300/90 leading-relaxed">
                      <li>• တစ်ရက်လျှင် တစ်ကြိမ်သာ ကံစမ်းခွင့်ရှိပါသည်။</li>
                      <li>
                        • ရရှိထားသော လက်ဆောင်သည်{' '}
                        {rewardValidityDays === 1
                          ? 'ရရှိသည့်နေ့ရက် တစ်ရက်တည်း (24 Hours)'
                          : `ရရှိသည့်နေ့မှစ၍ (${rewardValidityDays}) ရက်အတွင်း`}{' '}
                        အကျုံးဝင်ပါသည်။
                      </li>
                      <li>
                        • Hotel &amp; Outcall ဝန်ဆောင်မှုများတွင် အများဆုံး {outcallRewardCap}% OFF အထိ ခံစားခွင့်ရှိပါသည်။
                      </li>
                      <li>
                        • VIP Member Discount နှင့် နှစ်ထပ်ကွမ်း အသုံးပြုခွင့် မရှိပါ (ပိုမိုသက်သာသော Discount တစ်ခုကိုသာ ရွေးချယ်အသုံးပြုနိုင်ပါသည်)။
                      </li>
                    </ul>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
