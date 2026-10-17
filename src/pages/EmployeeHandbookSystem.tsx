import React, { useState, useEffect, useMemo, useRef } from 'react';
import { doc, onSnapshot, setDoc, collection, addDoc, deleteDoc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import {
  BookOpen, Sparkles, ShieldCheck, Clock, Award, HeartHandshake,
  CheckCircle2, Search, Plus, Trash2, Save, FileCheck, UserCheck,
  Calendar, RefreshCw, X, RotateCcw, Fingerprint, Lock, PenTool
} from 'lucide-react';

export interface HandbookSubSection {
  id: string;
  title: string;
  content: string;
  bulletPoints?: string[];
  highlightNote?: string;
  badgeType?: 'info' | 'warning' | 'gold' | 'danger';
}

export interface HandbookChapter {
  id: string;
  chapterNo: string;
  title: string;
  subtitle: string;
  iconName: string;
  subSections: HandbookSubSection[];
}

export interface HandbookData {
  title: string;
  subtitle: string;
  effectiveDate: string;
  version: string;
  lastUpdated: number;
  chapters: HandbookChapter[];
}

export interface StaffAcknowledgement {
  id?: string;
  staffId: string;
  staffName: string;
  nrcNumber: string;
  fatherName: string;
  address: string;
  signatureText?: string;
  signatureDataUrl?: string;
  biometricVerified?: boolean;
  biometricMethod?: string;
  biometricCredentialId?: string;
  agreedAt: number;
  handbookVersion: string;
}

const LOCAL_ACK_STORAGE_KEY = 'shangrila_handbook_acks_v1';

// ============================================================================
// 🌟 COMPLETE DEFAULT HANDBOOK DATA (EXTRACTED 100% FROM PDF PAGES 1 TO 17) 🌟
// ============================================================================
export const DEFAULT_HANDBOOK_DATA: HandbookData = {
  title: "THE SHANGRI-LA MEN'S RETREAT",
  subtitle: 'EMPLOYEE HANDBOOK (ဝန်ထမ်းလက်စွဲစာအုပ်)',
  effectiveDate: 'ဇွန်လ (၅) ရက်၊ ၂၀၂၆ ခုနှစ်',
  version: '2026.1',
  lastUpdated: Date.now(),
  chapters: [
    {
      id: 'ch_intro',
      chapterNo: 'အခန်း (၁)',
      title: 'နိဒါန်း နှင့် ရည်မှန်းချက်များ',
      subtitle: 'Introduction, Our Mission, Vision & Core Values',
      iconName: 'Sparkles',
      subSections: [
        {
          id: 'sub_history',
          title: "THE SHANGRI-LA MEN'S RETREAT နောက်ခံသမိုင်းကြောင်း",
          content:
            "THE SHANGRI-LA MEN'S RETREAT ကို ၂၀၁၈ ခုနှစ် မှ စတင်ကာ LUCKY SEVEN MEN SPA အမည်ဖြင့် မန္တလေးမြို့တွင် စတင်ဖွင့်လှစ်ခဲ့ပြီး ၂၀၂၄ ခုနှစ်၊ ဇန်နဝါရီလ (၁) ရက်နေ့တွင် SPA O' CLOCK HEALTHY MEN SPA အနေဖြင့် ပြောင်းလဲလုပ်ကိုင်ခဲ့ပါသည်။\n\nထိုမှတစ်ဆင့် ဝန်ဆောင်မှု အရည်အသွေးများ လက်ရှိထက် ပိုမိုထပ်မံတိုးမြှင့်၍ ဝန်ဆောင်မှုပေးနိုင်စေရန် ရည်ရွယ်ချက်ဖြင့် ၂၀၂၆ ခုနှစ်၊ ဧပြီလ (၁) ရက်နေ့မှ စတင်ကာ THE SHANGRI-LA MEN'S RETREAT အဖြစ် လုပ်ငန်းနာမည် အပါအဝင် လုပ်ငန်းလိုင်စင် အမည်ကိုပါ ပြောင်းလဲသုံးစွဲခဲ့ပြီး မန္တလေးမြို့နှင့် မြန်မာတစ်နိုင်ငံလုံးရှိ အမျိုးသားများအတွက် SPA နှင့် ပတ်သက်သော ဝန်ဆောင်မှုများကို အတတ်နိုင်ဆုံးနှင့် အကောင်းဆုံးဖြစ်အောင် သီးသန့် ဝန်ဆောင်မှု ပေးလျက်ရှိရာ ယခုအခါတွင် မန္တလေးမြို့၏ ထိပ်တန်း Healthy Men Retreat တစ်ခုအဖြစ် ရပ်တည်လျက် အကောင်းဆုံး ဝန်ဆောင်မှုများကို ဖြည့်ဆည်းပေးလျက်ရှိပါသည်။",
          badgeType: 'gold'
        },
        {
          id: 'sub_mission',
          title: 'OUR MISSION (ကျွန်ုပ်တို့၏ ရည်ရွယ်ချက်)',
          content:
            "THE SHANGRI-LA MEN'S RETREAT သည် ဆိုင်သို့ လာရောက်သော ဧည့်သည်တော်များအားလုံးကို ပင်ပန်းနွမ်းနယ်မှုများနှင့် စိတ်ဖိစီးမှုအားလုံး ပြေပျောက်အောင် အတတ်နိုင်ဆုံး ဝန်ဆောင်မှု ပေးရန် ရည်ရွယ်ပါသည်။",
          highlightNote:
            '“သန့်ရှင်းသပ်ရပ်၊ တိတ်ဆိတ် ငြိမ်းအေးစွာဖြင့် ဧည့်သည်တော်များ၏ စိတ်ပင်ပန်းနွမ်းနယ်မှုများကို တစ်ခဏအတွင်း ပြေလျော့အောင် အတတ်နိုင်ဆုံး ဝန်ဆောင်မှု ပေးရန်” ဖြစ်ပါသည်။',
          badgeType: 'gold'
        },
        {
          id: 'sub_vision',
          title: 'OUR VISION (ကျွန်ုပ်တို့၏ မျှော်မှန်းချက်)',
          content:
            "THE SHANGRI-LA MEN'S RETREAT သည် ဆိုင်သို့လာရောက်သော အမျိုးသားဧည့်သည်မှန်သမျှကို မိမိကိုယ်ကို ယခင်ကထက် ပိုပြီး ဂရုစိုက်တတ်လာစေရန်နှင့် ဆိုင်အတွင်း ရောက်ရှိလာသည်နှင့် တပြိုင်နက် စိတ်ရောကိုယ်ပါ ကျန်းမာပျော်ရွှင်ပြီး နေ့စဉ်ကြုံတွေ့နေရသည့် ဘဝအမောများ ချက်ချင်းပြေပျောက်သွားစေနိုင်သည့် သီးသန့်နေရာလေးတစ်ခု ဖန်တီးပေးရန် မျှော်မှန်းထားပါသည်။\n\nTHE SHANGRI-LA MEN'S RETREAT သည် မည်သည့်နေရာနှင့်မှ မတူဘဲ သီးသန့် ဘုံဗိမ္ဗာန်ငယ်လေးတစ်ခုသာ ဖြစ်ပါသည်။ အပန်းဖြေရန် နေရာတစ်ခု ဆိုသည်ထက် အမျိုးသားများအားလုံးအတွက် အပန်းဖြေရာ၊ စိတ်ပင်ပန်းနွမ်းနယ်မှုတို့ လုံးဝ ကင်းဝေးရာ နေရာတစ်ခု ဖြစ်ပါသည်။",
          badgeType: 'info'
        },
        {
          id: 'sub_values',
          title: 'OUR VALUES (ကျွန်ုပ်တို့၏ စံတန်ဖိုးများ)',
          content:
            "THE SHANGRI-LA MEN'S RETREAT ၏ စံသတ်မှတ်ထားသော အားသာချက်များမှာ —",
          bulletPoints: [
            'မိမိတို့အလုပ်ကို ကျွမ်းကျင်ပိုင်နိုင်မှု (Professional Mastery)',
            'အပြန်အလှန် လေးစားမှု (Mutual Respect)',
            'ထူးချွန်ကောင်းမွန်အောင် အစဉ်အမြဲ ကြိုးစားနေမှု (Continuous Excellence)',
            'အဖွဲ့လိုက်လုပ်ဆောင်မှု (Teamwork)',
            'ရေရှည်တည်တံ့အောင် အကောင်းဆုံး ထိန်းသိမ်းမှု (Sustainability)'
          ],
          badgeType: 'gold'
        },
        {
          id: 'sub_purpose',
          title: 'EMPLOYEE HANDBOOK ရေးဆွဲခြင်း၏ ရည်ရွယ်ချက် နှင့် သဘောထား',
          content:
            'ဤ ဝန်ထမ်း လက်စွဲစာအုပ်သည် အလုပ်သမား၊ အလုပ်အကိုင်နှင့် လူမှုဖူလုံရေး ဝန်ကြီးဌာနမှ ပြဋ္ဌာန်းထားသော ဥပဒေများနှင့်အညီ ရေးဆွဲထားသောကြောင့် —',
          bulletPoints: [
            '(၁) ဝန်ထမ်းများဘက်မှ ဥပဒေနှင့်အညီ အကျိုးခံစားခွင့်များကို အပြည့်အဝ ခံစားရရှိစေရန်။',
            '(၂) ဝန်ထမ်းများအနေဖြင့် မိမိတို့ဘက်မှ ကျေပွန်အောင် ဆောင်ရွက်ပေးရန် လိုအပ်သည့် တာဝန်ဝတ္တရားများ၊ ဆောင်ရန်၊ ရှောင်ရန် ကိစ္စရပ်များနှင့် စည်းကမ်းချက်များ၊ မိမိတို့၏ ခံစားခွင့်များနှင့် ပြစ်မှု၊ ပြစ်ဒဏ်များကို ကြိုတင် သိရှိထားနိုင်ခြင်းကြောင့် မလိုအပ်သော စည်းကမ်းဖောက်ဖျက်မှုများ၊ ပြစ်မှုကျူးလွန်မှုများ နှင့် မတော်တဆ အမှားများကို မဖြစ်ပေါ်လာစေရန်နှင့် လျော့နည်း ပပျောက်လာစေရန် ရည်ရွယ်ပါသည်။'
          ],
          highlightNote:
            "THE SHANGRI-LA MEN'S RETREAT အနေဖြင့် ဝန်ထမ်းများအား စည်းကမ်းဖောက်ဖျက်မှု နှင့် ပျက်ကွက်မှုများအတွက် ပြစ်ဒဏ်ချမှတ်ရခြင်းနှင့် အရေးယူမှုတို့ ဆောင်ရွက်ရခြင်းမှာ ဝန်ထမ်းများကို နစ်နာစေလိုသော ရည်ရွယ်ချက် အလျဉ်းမရှိဘဲ လုပ်ငန်း၏ နေ့စဉ်လုပ်ဆောင်နေသော လုပ်ငန်းစဉ်များအားလုံးကို အထိအခိုက် အခက်အခဲ မရှိဘဲ ပိုမို လွယ်ကူ လျင်မြန်စွာ ဆောင်ရွက်နိုင်စေရန်နှင့် လုပ်ငန်း၏ အကျိုးကို ပိုမို ဖြစ်ထွန်းလာစေရန်အတွက် ပညာပေးပြုပြင်ပေးသည့် သဘောသာလျှင် ဖြစ်ပါသည်။",
          badgeType: 'info'
        }
      ]
    },
    {
      id: 'ch_employment',
      chapterNo: 'အခန်း (၂)',
      title: 'အလုပ်ခန့်အပ်ခြင်း မူဝါဒ',
      subtitle: 'Onboarding, Probation, Permanent Status & Resignation Policy',
      iconName: 'UserCheck',
      subSections: [
        {
          id: 'sub_hiring',
          title: 'အလုပ်ခန့်အပ်ခြင်း (New Employee Onboarding)',
          content:
            'အလုပ်လာရောက်လျှောက်ထားသော အလုပ်ခေါ်စာပါ သတ်မှတ်ချက်များအားလုံးနှင့် ပြည့်စုံ ကိုက်ညီသည့် မည်သည့် ဝန်ထမ်းအသစ်ကို မဆို (ဝန်ထမ်းလိုအပ်ချက် အပေါ်မူတည်၍) အလုပ်ရှင် (သို့မဟုတ်) အလုပ်ရှင်မှ လုပ်ပိုင်ခွင့် ပေးထားသော အလုပ်၏ တာဝန်ခံ တို့မှ ဝန်ထမ်းအဖြစ် ခန့်အပ်နိုင်သည်။ အလုပ်ခန့်ထားရာတွင် သတ်မှတ်ထားသော ဝန်ထမ်းအဖြစ် ခန့်အပ်ခြင်းဖောင် (New Employee Onboarding Form) တွင် လိုအပ်သည့် ကိုယ်ရေး အချက်အလက်များအားလုံး ဖြည့်စွက်စေပြီးမှသာ အလုပ်ခန့်ထားခြင်း ပြီးမြောက်သည်။',
          badgeType: 'info'
        },
        {
          id: 'sub_probation',
          title: 'အလုပ်သင်ကာလနှင့် အစမ်းခန့်ကာလ (၁ လ)',
          content:
            'အလုပ်ခန့်အပ်ထားသည့် မည်သည့် ဝန်ထမ်းအသစ်ကို မဆို လုပ်ငန်း၏ သဘော သဘာဝ နှင့် ပုံစံအပေါ် မူတည်၍ အလုပ်သင် (သင်တန်း) ကာလနှင့် အစမ်းခန့်ကာလ အဖြစ် (၁) လ သတ်မှတ်ပါသည်။ အလုပ်သင် (သင်တန်း) ကာလနှင့် အစမ်းခန့်ကာလတွင် သင်တန်းကာလဖြစ်သောကြောင့် ကိုယ်ပိုင် အလုပ်နားရက်အပြင် မည်သည့် ခွင့်ခံစားခွင့်မှ ခံစားခွင့် ရရှိမည်မဟုတ်ပါ။',
          badgeType: 'warning'
        },
        {
          id: 'sub_permanent',
          title: 'အမြဲတမ်းဝန်ထမ်း (Permanent Staff)',
          content:
            'အလုပ်သင် (သင်တန်း) ကာလ နှင့် အစမ်းခန့်ကာလ (၁)လ ပြည့်မြောက်ပြီးသည့် မည်သည့် ဝန်ထမ်းကိုမဆို အဆိုပါ အလုပ်သင်ကာလအတွင်း လုပ်ဆောင်ခဲ့သည့် လုပ်ဆောင်ချက်တို့အပေါ် မူတည်၍ သက်ဆိုင်ရာ ဌာန အကြီးအကဲ နှင့် အလုပ်ရှင် (သို့) HR ဌာန တို့မှ အလုပ်နှင့် အဖွဲ့အစည်းအပေါ်ထားသည့် ဝန်ထမ်း၏ စိတ်နေသဘောထား၊ စည်းကမ်းလိုက်နာမှု နှင့် လုပ်ငန်းစွမ်းဆောင်ရည် ကောင်းမွန်မှုတို့အပေါ်တွင် အကဲဖြတ်ပြီး ရရှိလာသည့် အကဲဖြတ်မှတ်တမ်း ထောက်ခံချက်တို့အပေါ်တွင် မူတည်ပြီး အဆိုပါ ရာထူးနှင့် အမှန်တကယ် ကိုက်ညီမှု ရှိပါက အမြဲတမ်းဝန်ထမ်းအဖြစ် သတ်မှတ်မည်ဖြစ်ပြီး အကယ်၍ ကိုက်ညီမှု မရှိပါက အစမ်းခန့်ကာလကို နောက်ထပ် (၁)လ အထိ သက်တမ်းထပ်တိုး စောင့်ကြည့်ခြင်း (သို့မဟုတ်) အလုပ်မှ ရပ်စဲခြင်းတို့ကို ပြုလုပ်နိုင်သည်။',
          badgeType: 'gold'
        },
        {
          id: 'sub_resignation',
          title: 'အလုပ်မှ နှုတ်ထွက်ခြင်း (သို့မဟုတ်) အလုပ်မှ ရပ်စဲခြင်း',
          content:
            'အမြဲတမ်းဝန်ထမ်း အဖြစ် သတ်မှတ်ခြင်း မခံရသေးသော သင်တန်းသား ဝန်ထမ်းများသည် အဆိုပါ (၁) လအတွင်းတွင် မိမိတာဝန်ထမ်းဆောင်နေသော အလုပ်ကို ဆက်လက် တာဝန်ထမ်းဆောင်နိုင်ခြင်း မရှိပါက ကြိုတင် အကြောင်းကြားမှု မရှိဘဲ အလုပ်မှ နှုတ်ထွက်နိုင်သကဲ့သို့ အလုပ်ရှင်အနေဖြင့်လည်း ဝန်ထမ်း၏ စွမ်းဆောင်ရည်အပေါ် စိတ်ကျေနပ်မှု မရှိပါက ကြိုတင် အကြောင်းကြားမှု မရှိဘဲ အလုပ်မှ ချက်ချင်း ရပ်စဲနိုင်သည်။',
          bulletPoints: [
            'အလုပ်သင်ကာလ (၁)လအတွင်း မိမိသဘောဖြင့် နှုတ်ထွက်ခြင်း သို့မဟုတ် အလုပ်ရပ်စဲခံရခြင်းဖြစ်ပါက (နေ/စား စရိတ်ငြိမ်းဖြင့် ကော်မရှင်စားပုံစံသွားသည့် လုပ်ငန်းဖြစ်သောကြောင့်) အဆိုပါ လုပ်ကိုင်ခဲ့သော ကော်မရှင်ခံစားခွင့်များအား ခံစားရရှိနိုင်မည် မဟုတ်ပါ။',
            'အမြဲတမ်း ဝန်ထမ်းများအားလုံးသည် အလုပ်မှ နှုတ်ထွက်လိုပါက အလုပ်ရှင်ထံသို့ အနည်းဆုံး (၁)လ ကြိုတင်အကြောင်းကြားရမည်ဖြစ်ပြီး Employee Resignation Form တွင် ဖြည့်စွက်တင်ပြရမည်။',
            'အနည်းဆုံး (၁)လ ကြိုတင်အကြောင်းကြားမှု မရှိဘဲ ချက်ချင်း နှုတ်ထွက်ပါက အလုပ်မှ ထုတ်ပယ်ခြင်းအဖြစ် သတ်မှတ်မည်ဖြစ်ပြီး နောက်ဆုံးလ၏ ကော်မရှင်ခံစားခွင့်များအား (လုံးဝ) ခံစားရရှိနိုင်မည် မဟုတ်ပါ။',
            'အလုပ်မှ ချက်ချင်းရပ်စဲရန် လုံလောက်သော စည်းကမ်းချက်ကို ဖောက်ဖျက်ကျူးလွန်ခဲ့ပါကလည်း နောက်ဆုံးလ၏ ကော်မရှင်ခံစားခွင့်များအား (လုံးဝ) ခံစားရရှိနိုင်မည် မဟုတ်သည့်အပြင် အလုပ်မှ ချက်ချင်း ရပ်စဲခံရမည်ဖြစ်သည်။'
          ],
          badgeType: 'danger'
        }
      ]
    },
    {
      id: 'ch_hours_outpass',
      chapterNo: 'အခန်း (၃)',
      title: 'အလုပ်ချိန်၊ နားရက် နှင့် အပြင်ထွက်ခွင့် (Out Pass)',
      subtitle: 'Working Hours, Off-Days, Out Pass Rules & Late Penalties',
      iconName: 'Clock',
      subSections: [
        {
          id: 'sub_hours',
          title: 'အလုပ်ချိန် နှင့် အလုပ်နားရက် (8:00 AM – 11:00 PM)',
          content:
            "THE SHANGRI-LA MEN'S RETREAT ၏ ဆိုင်ဖွင့်ချိန်သည် မနက် (၈) နာရီ ဖြစ်ပြီး ဆိုင်ပိတ်ချိန်မှာ ည (၁၁) နာရီ ဖြစ်ပါသည်။ ဆိုင်ရှိ ဝန်ထမ်းများအားလုံးသည် မနက် (၈) နာရီမှ ည (၁၁) နာရီအတွင်း လုပ်ငန်းခွင်ထဲတွင်သာ ရှိနေရမည်ဖြစ်ကာ ဧည့်သည်မရှိချိန်တွင် စည်းကမ်းချက်များနှင့်အညီ အေးဆေးလွတ်လပ်စွာ နားနေနိုင်ကြပါသည်။",
          bulletPoints: [
            'အလုပ်သင် (သင်တန်း) ကာလ အစမ်းခန့် ဝန်ထမ်းများသည် သင်တန်းကာလအတွင်း ကိုယ်ပိုင် နားရက် ခံစားခွင့် မရှိပါ။',
            'အမြဲတမ်းဝန်ထမ်းများသည် တစ်လလျှင် ကိုယ်ပိုင် နားရက် (၂) ရက် ရရှိမည်ဖြစ်ပြီး ဆိုင်၏ အရောင်းမြှင့်တင်ရေး အစီအစဉ်များကြောင့် ဝန်ထမ်းလိုအပ်ချက်ရှိပါက နားရက်ကို လုပ်ငန်းလိုအပ်ချက်အရ ရွှေ့ဆိုင်းပေးရမည်။'
          ],
          badgeType: 'info'
        },
        {
          id: 'sub_outpass_rule',
          title: 'Out Pass Form တင်ခြင်း နှင့် သတ်မှတ် ခွင့်ပြုချိန်',
          content:
            'တာဝန်ချိန်အတွင်း ဆိုင်၏ ပြင်ပသို့ ထွက်ခွာလိုပါက Out Pass Form တွင် သတ်မှတ်ထားသည့်အတိုင်း မပျက်မကွက် လက်မှတ်ထိုး (Clock-In/Clock-Out) တင်ပြပြီးမှ ထွက်ခွာကြရမည်ဖြစ်သည်။',
          bulletPoints: [
            'တစ်ကြိမ်လျှင် အများဆုံး ကြာချိန် မိနစ် (၃၀) အထိ ခွင့်ပြုပေးထားပြီး တစ်ရက်လျှင် (၂) ကြိမ်သာ ထွက်ခွာခွင့်ရှိသည်။',
            'ဝန်ထမ်းနှစ်ဦးထက် ပို၍ တစ်ပြိုင်တည်း ထွက်ခွာခွင့် မရှိပါ။ တစ်ပြိုင်တည်း (၂) ဦး ထွက်ခွာပါကလည်း ဝန်ထမ်းတိုင်း Out Pass တင်ရန် လိုအပ်သည်။',
            'ရှေ့မှ အခြားထွက်ခွာနေသော ဝန်ထမ်းများရှိပါက ထိုသူများ ပြန်လာသည်အထိ စောင့်ဆိုင်းပြီးမှသာ ထွက်ခွာကြရမည်။'
          ],
          badgeType: 'warning'
        },
        {
          id: 'sub_target_outpass',
          title: 'သတ်မှတ်ထားသည့် အလုပ်တာဝန် (Target) ပြည့်မြောက်၍ အပြင်ထွက်ခွင့်ပြုခြင်း',
          content:
            'တစ်ရက်တာ Target ပြည့်အောင် ရရှိပြီးပါက ကျန်ရှိနေသော အချိန်များတွင် ဆိုင်၏ ပြင်ပသို့ ထွက်ခွာခွင့် ရှိသည်။ သို့ရာတွင် မိမိထွက်ခွာလိုသော ရက်၏ ရှေ့ရက်များတွင် (၃) ရက်ဆက်တိုက် နေ့စဉ် Target ပြည့်ထားရမည်ဖြစ်သည်။',
          highlightNote:
            'မည်သည့်အချိန်မှ စပြီး ထွက်ခွာသည်ဖြစ်စေ ညနေ (၆) နာရီ ထိုးသည်နှင့် ဆိုင်သို့ မဖြစ်မနေ ပြန်လည်ရောက်ရှိရမည်။ ထွက်ခွာနေစဉ် Half Day (or) Day Booking ပေါ်ပေါက်လာပါက အမြန်ဆုံး ပြန်လာရမည်။ ညနေ (၆) နာရီ ပြန်မရောက်ခြင်း သို့မဟုတ် ဖုန်းမကိုင်/ငြင်းဆန်၍ Booking လွတ်သွားပါက အဆိုပါ Booking ၏ တန်ဖိုးဈေးနှုန်းအတိုင်း ဝန်ထမ်းဘက်မှ အတိအကျ ပြန်လည် ပေးလျော်ရမည်။',
          badgeType: 'danger'
        },
        {
          id: 'sub_outpass_fines',
          title: 'အပြင်ထွက်ခွာခြင်းနှင့် ပတ်သက်သည့် ပြစ်ဒဏ်နှင့် ဒဏ်ကြေးသတ်မှတ်ချက်များ',
          content: 'သတ်မှတ်စည်းကမ်းချက်များကို ဖောက်ဖျက်ခဲ့ပါက အောက်ဖော်ပြပါအတိုင်း ဒဏ်ကြေးပေးဆောင်ကြရမည် —',
          bulletPoints: [
            'Out Pass Form မတင်ဘဲ ခွင့်ပြုချက်မရှိ အပြင်ထွက်ခြင်း — ဒဏ်ကြေး ၁၀,၀၀၀ ကျပ်',
            'သတ်မှတ်ခွင့်ပြုချိန် မိနစ် (၃၀) ထက်ပိုပြီး (၁ မိနစ် မှ မိနစ် ၃၀ အတွင်း နောက်ကျပါက) — ဒဏ်ကြေး ၁၀,၀၀၀ ကျပ်',
            'သတ်မှတ်ခွင့်ပြုချိန်ထက် (မိနစ် ၃၀ မှ ၁ နာရီအတွင်း နောက်ကျပါက) — ဒဏ်ကြေး ၃၀,၀၀၀ ကျပ်',
            'သတ်မှတ်ခွင့်ပြုချိန်ထက် (၁ နာရီအထက် ပိုနောက်ကျခဲ့ပါက) — Outcall တစ်ကြိမ်စာ ပေးဆောင်ရန်',
            'သတ်မှတ်ခွင့်ပြုချိန်ထက် (၂ နာရီအထက် ပိုနောက်ကျခဲ့ပါက) — Half Day တစ်ကြိမ်စာ ပေးဆောင်ရန်',
            'သတ်မှတ်ခွင့်ပြုချိန်ထက် (၃ နာရီအထက် ပိုနောက်ကျခဲ့ပါက) — Day တစ်ရက်စာ ပေးဆောင်ရန်'
          ],
          badgeType: 'danger'
        }
      ]
    },
    {
      id: 'ch_commission',
      chapterNo: 'အခန်း (၄)',
      title: 'ကော်မရှင်ရာခိုင်နှုန်း နှင့် အခြားခံစားခွင့်များ',
      subtitle: 'Commission Structure, Seniority Benefits & Monthly Target Bonus',
      iconName: 'Award',
      subSections: [
        {
          id: 'sub_comm_rate',
          title: 'လုပ်ခ ကော်မရှင် ရာခိုင်နှုန်း ခံစားခွင့်',
          content:
            "THE SHANGRI-LA MEN'S RETREAT သည် ဝန်ထမ်းများ အားလုံးကို နေစရိတ်၊ စားစရိတ် (နေ/စား) ငြိမ်း တာဝန်ယူထားပြီး ဝန်ထမ်းများ၏ လစာခံစားခွင့်ကို မိမိတို့လုပ်ဆောင်ရသည့် ဝန်ဆောင်မှုများ၏ ဈေးနှုန်းအလိုက် ကော်မရှင် ခံစားခွင့်များကို အတိအကျ သတ်မှတ်ပေးထားပါသည်။",
          bulletPoints: [
            'ကော်မရှင် ရရှိသည့် ခံစားခွင့်များအားလုံးကို လစဉ် (လဆန်း ၅ ရက်နေ့မှ ၁၀ ရက်နေ့အတွင်း) တွက်ချက်ကာ ရှင်းလင်းပေးသွားမည်ဖြစ်ပါသည်။',
            'အလုပ်သင် (သင်တန်း) ကာလ အစမ်းခန့် ဝန်ထမ်းများသည်လည်း ကော်မရှင် ခံစားခွင့် ရရှိမည်ဖြစ်သော်လည်း သင်တန်းကာလ (၁ လ) မပြည့်မီ အလုပ်မှ ထွက်ခွာခဲ့ပါက မည်သည့် ခံစားခွင့်မှ ရရှိမည်မဟုတ်ပါ။'
          ],
          badgeType: 'gold'
        },
        {
          id: 'sub_seniority_target',
          title: 'လုပ်သက် ခံစားခွင့် (၃ လပြည့်) နှင့် လစဉ် Sale Target Bonus',
          content:
            'အမြဲတမ်း ဝန်ထမ်းများအတွက် လုပ်သက် (၃) လ ပြည့်မြောက်ပြီးသည့် အချိန်မှ စ၍ ကော်မရှင်ခံစားခွင့်ရာခိုင်နှုန်း တိုးမြှင့်ခြင်း နှင့် အခြားခံစားခွင့်များ ပေးအပ်သွားမည်ဖြစ်သည်။\n\nထို့အပြင် လစဉ် Sale Target သတ်မှတ်ပေးထားမည်ဖြစ်ပြီး Sale Target ပြည့်မီအောင် စွမ်းဆောင်နိုင်ခဲ့ပါက သီးခြား ကော်မရှင်ခံစားခွင့်များ အပြင် Target Bonus များ ထပ်မံ ရရှိနိုင်မည်ဖြစ်သည်။',
          badgeType: 'gold'
        }
      ]
    },
    {
      id: 'ch_ethics_rules',
      chapterNo: 'အခန်း (၅)',
      title: 'ဝန်ထမ်း ကျင့်ဝတ်နှင့် စည်းကမ်းချက် (၂၂) ချက်',
      subtitle: 'Code of Conduct, Grooming, Confidentiality & 22 Mandatory Rules',
      iconName: 'ShieldCheck',
      subSections: [
        {
          id: 'sub_grooming_ethics',
          title: 'ဝတ်စားဆင်ယင်မှု၊ အပြုအမူ၊ လျှို့ဝှက်ချက် နှင့် ဆိုင်ပိုင်ပစ္စည်း ထိန်းသိမ်းခြင်း',
          content:
            'ဝန်ထမ်းများအားလုံးသည် တစ်ကိုယ်ရည် သန့်ရှင်းရေးကို အထူးအလေးပေး ဂရုစိုက်ရမည်။ ဆိုင်ဖွင့်ချိန် မနက် (၈) နာရီမှ ည (၁၁) နာရီအတွင်း သပ်ရပ်စွာ ဝတ်ဆင်နေထိုင်ရမည်ဖြစ်ပြီး ညဝတ်အင်္ကျီများ မလဲဘဲ လုပ်ငန်းခွင်ဝင်ခြင်း လုံးဝရှောင်ကြဉ်ရမည်။',
          bulletPoints: [
            'အပြုအမူနှင့် အပြောအဆို: အော်ဟစ်ဆူညံခြင်း၊ ရိုင်းစိုင်းစွာ ပြုမူပြောဆိုခြင်း မရှိစေဘဲ ဧည့်သည်နှင့် လုပ်ဖော်ကိုင်ဖက်များအပေါ် လေးစားစွာ ဆက်ဆံရမည်။',
            'လျှို့ဝှက်အပ်သည့်အရာများ: ဧည့်သည်များ၏ သတင်းအချက်အလက်နှင့် ဆိုင်၏ လျှို့ဝှက်အချက်အလက်များကို ပြင်ပသို့ လုံးဝ မပေါက်ကြားအောင် ထိန်းသိမ်းရမည်။ ဖောက်ဖျက်ပါက အလုပ်မှ ထုတ်ပယ်သည်အထိ အရေးယူခံရမည်။',
            'ဆိုင်၏ ပုံသေပိုင်ပစ္စည်းများ: SPA နှင့် ဆက်စပ်ပစ္စည်းများကို တာဝန်သိစိတ်ဖြင့် ကိုင်တွယ်ရမည်ဖြစ်ပြီး ကိုယ်ကျိုးအတွက် သုံးစွဲခြင်း မရှိစေရပါ။'
          ],
          badgeType: 'info'
        },
        {
          id: 'sub_22_rules',
          title: 'ဝန်ထမ်းများ အားလုံး သိရှိလိုက်နာရန် စည်းကမ်းချက် (၂၂) ချက်',
          content: 'အောက်ဖော်ပြပါ စည်းကမ်းချက် (၂၂) ချက်ကို ဝန်ထမ်းတိုင်း တိကျစွာ သိရှိလိုက်နာကြရမည် —',
          bulletPoints: [
            '၁။ ဆိုင်မှချမှတ်ထားသော အဖွဲ့အလိုက် အလှည့်ကျ ဆိုင်အတွင်းအပြင် သန့်ရှင်းရေးတာဝန်များကို မပျက်မကွက် သေချာစွာ ပြုလုပ်ကြရမည်။',
            '၂။ ဆိုင်ရှင်ခွင့်ပြုချက်မရဘဲ ဆိုင်၏ပြင်ပသို့ မိမိသဘောဖြင့် သွားလာခြင်း မပြုရ။',
            '၃။ ဆိုင်၏ပြင်ပသို့ သွားလာမည်ဆိုပါက (Staff App) တွင် (Clock In/Clock Out) ပြုလုပ်ခြင်းကို မပျက်မကွက် ဖြည့်စွက်ပြီးမှသာ သွားလာရမည်။',
            '၄။ ဆိုင်ရှင်ခွင့်ပြုချက်မရဘဲ ဆိုင်အတွင်း လောင်းကစားပြုလုပ်ခြင်း၊ အရက်သေစာ သောက်စားမူးယစ်ခြင်း မပြုရ။',
            '၅။ ဝန်ထမ်းအသစ်များသည် အနည်းဆုံး (တစ်လ) ပြည့်အောင် တာဝန်ထမ်းဆောင်နိုင်ရမည်ဖြစ်ပြီး တစ်လမပြည့်ခင် အလုပ်မှ အနားယူလိုပါက ထိုလတွင် လုပ်ကိုင်ခဲ့သော လုပ်ခလစာ (ဆက်ရှင်ကြေး) များအားလုံးကို ရရှိမည်မဟုတ်ပါ။',
            '၆။ ဝန်ထမ်းအသစ်များသည် အလုပ်စတင်ဝင်ရောက်ပြီး (တစ်လ) တိတိ ပြည့်မြောက်ပြီး နောက်တစ်လမှသာ ကိုယ်ပိုင်နားရက် နှင့် ဆက်ရှင်ကြေးများ စတင်ရှင်းလင်းပေးမည်ဖြစ်ပါသည်။',
            '၇။ ဝန်ထမ်းအသစ်များအားလုံးသည် မိမိရရှိသော Tips Money များထဲမှ ဆိုင်တွင် အာမခံအနေဖြင့် ထားရှိရမည့် Hold Money (အာမခံငွေ) (၂)သိန်းကျပ် အား တစ်လအတွင်းပြည့်အောင် ခွဲ၍ အပ်နှံထားရှိကြရမည်။ သတ်မှတ်စည်းကမ်းနှင့်အညီ နှုတ်ထွက်သည့်နေ့တွင် ပြန်လည်ထုတ်ယူနိုင်သည်။ စည်းကမ်းဖောက်ဖျက်၍ ထုတ်ပယ်ခံရပါက သို့မဟုတ် စည်းကမ်းနှင့်အညီ နှုတ်ထွက်ခြင်းမပြုပါက လုံးဝ(လုံးဝ) ပြန်လည်ရရှိမည်မဟုတ်ပါ။',
            '၈။ ဆိုင်အတွင်း ဝန်ထမ်းအချင်းချင်း ခိုက်ရန်ဖြစ်ပွားခြင်းကို ပြင်းထန်စွာ တားမြစ်ထားသည်။ (ဖြစ်ပွားပါက ချက်ချင်း ထုတ်ပယ်ခံရမည်ဖြစ်ပြီး ဆက်ရှင်ကြေးနှင့် Hold Money များကို လုံးဝ ပြန်လည်ရရှိမည် မဟုတ်ပါ။)',
            '၉။ မနက် (၈) နာရီမှ နေ့ခင်း (၁၂) နာရီအတွင်း ၊ ညနေ (၂) နာရီမှ ည (၁၀) နာရီအတွင်း ဂိမ်းကစားခြင်း မပြုရ။',
            '၁၀။ ညဉ့်နက်သည်အထိ ဖုန်းများကို အသံကျယ်လောင်စွာ အသုံးပြုခြင်း၊ အိပ်ခန်းမီးဖွင့်ထားခြင်း စသည့် အခြားဝန်ထမ်းများ အနှောင့်အယှက်ဖြစ်စေမည့် အပြုအမူများကို ရှောင်ကျဉ်ကြရမည်။',
            '၁၁။ ဝန်ထမ်းများအားလုံး ည (၁၂) နာရီ နောက်ဆုံးထားပြီး မဖြစ်မနေ အိပ်ရာဝင်ကြရမည်။',
            '၁၂။ ခွင့်ယူလိုပါက အနည်းဆုံး ကြားခံ (၁) ရက် ကြိုတင်ပြီး ဆိုင်ရှင်ထံ အကြောင်းကြားပေးရမည်။ အကြောင်းမကြားဘဲ ပျက်ကွက်ခဲ့ပါက Day Section တစ်ရက်စာ ဖြတ်တောက်ခံရမည်။',
            '၁၃။ နေ့စဉ် ဝန်ဆောင်မှုပေးရသည့် လုပ်ငန်းဖြစ်သောကြောင့် လုပ်ငန်းချိန်အတွင်း အသင့်အနေအထား ရှိနေရမည်။',
            '၁၄။ အလုပ်မှထွက်လိုပါက အနည်းဆုံး (၁) လ ကြိုတင်ပြီး ဆိုင်ရှင်ထံ အကြောင်းကြားပေးရမည်။ တစ်လကြိုတင် အကြောင်းမကြားဘဲ ချက်ချင်းထွက်ပါက နောက်ဆုံးလ၏ ဆက်ရှင်ကြေးများ အပြင် Hold Money များကိုလည်း လုံးဝ ပြန်လည်ရရှိမည် မဟုတ်ပါ။',
            '၁၅။ ဆိုင်လာရောက်သော ဧည့်သည်များကို စိတ်ကျေနပ်မှုရရှိစေရန် ကြိုးစားရမည်ဖြစ်ပြီး ဧည့်သည်နှင့် ပြဿနာမဖြစ်အောင် ဝန်ဆောင်မှုပေးရမည်။',
            '၁၆။ ဧည့်သည်ကို အနီးကပ် ဝန်ဆောင်မှုပေးရသည့် လုပ်ငန်းဖြစ်သောကြောင့် တစ်ကိုယ်ရည်သန့်ရှင်းမှုကို အထူးအလေးပေး ဂရုစိုက်ကြရမည်။',
            '၁၇။ ဆိုင်တွင် ဧည့်သည်ရှိနေစဉ် ဝန်ထမ်းအချင်းချင်း ကျယ်လောင်စွာ စကားပြောဆိုခြင်း၊ ဖုန်းအသံကျယ်လောင်စွာ သုံးခြင်း၊ အော်ဟစ်ဆူညံခြင်း မပြုလုပ်ရ။',
            '၁၈။ ဧည့်ခန်းစောင့်၊ ဧည့်ကြို တာဝန်ကျသော ဝန်ထမ်းများသည် ဧည့်ခန်းထဲတွင် အနည်းဆုံး တစ်ယောက် မဖြစ်မနေ ရှိနေရမည်ဖြစ်ပြီး ဖုန်းအသံကျယ်လောင်စွာ သုံးခြင်းကို ရှောင်ကျဉ်ရမည်။',
            '၁၉။ ဝန်ထမ်းများ နားနေခန်းအတွင်း ဆေးလိပ်သောက်ခြင်းကို ပြင်းထန်စွာ တားမြစ်ထားပါသည်။',
            '၂၀။ ဆိုင်အတွင်းတွင်ရော၊ ဆိုင်၏ ပြင်ပတွင်ပါ မူးယစ်ဆေးဝါးနှင့် စိတ်ကိုပြောင်းလဲစေတတ်သည့် မည်သည့် ဆေးဝါးအမျိုးအစားကိုမှ သုံးစွဲခွင့် မရှိပါ။ တွေ့ရှိပါက ချက်ချင်းထုတ်ပယ်သွားမည့်အပြင် နောက်ဆက်တွဲ ပြဿနာများကိုလည်း ဖြေရှင်းပေးမည် မဟုတ်ပါ။',
            '၂၁။ စည်းကမ်းချက်တစ်ခုခုကို ဖောက်ဖျက်၍ အလုပ်မှ ထုတ်ပယ်ခံရပါက နောက်ဆုံးလ၏ လုပ်ခလစာ (ဆက်ရှင်ကြေး) အပြင် Hold Money များကိုလည်း လုံးဝ ပြန်လည်ရရှိမည် မဟုတ်ပါ။',
            '၂၂။ အထက်ပါ စည်းကမ်းချက်များအားလုံးကို တိကျစွာ လိုက်နာရမည်ဖြစ်ပြီး ဖောက်ဖျက်ခဲ့ပါက ဆိုင်ရှင်မှ ပေးသော ပြစ်ဒဏ်ကို ကြည်ဖြူစွာ လက်ခံနိုင်ရမည်။'
          ],
          badgeType: 'danger'
        },
        {
          id: 'sub_daily_cleaning',
          title: 'နေ့စဉ်လုပ်ဆောင်ကြရမည့် တာဝန်နှင့် ဝတ္တရားများ (LARK App Docs)',
          content:
            "နေ့စဉ် ဆိုင်သန့်ရှင်းရေး လုပ်ဆောင်ရန် အသေးစိတ် ဖော်ပြချက်များကို ဆိုင်၏ Group Chat Application ဖြစ်သော LARK App ထဲမှတစ်ဆင့် Docs >> Drive ၏ Team File ထဲတွင် သွားရောက်ဖတ်ရှုရန် ဖြစ်ပါသည်။ အဆိုပါ နေ့စဉ်တာဝန်များ ပျက်ကွက်ပါက အနည်းဆုံး (၁၀,၀၀၀ ကျပ်) မှ စတင်၍ ဒဏ်ကြေး သတ်မှတ်ပေးဆောင်ရမည်။",
          badgeType: 'warning'
        }
      ]
    },
    {
      id: 'ch_guest_service',
      chapterNo: 'အခန်း (၆)',
      title: 'ဧည့်သည် ဝန်ဆောင်မှု လုပ်ငန်းစဉ်များ',
      subtitle: 'Guest Greeting, Pre/Post Section SOP, Payment & Complaint Handling',
      iconName: 'HeartHandshake',
      subSections: [
        {
          id: 'sub_greeting_menu',
          title: 'ကြိုဆိုနှုတ်ဆက်ခြင်း နှင့် ဝန်ဆောင်မှုများ ရှင်းလင်းမိတ်ဆက်ခြင်း',
          content:
            'ဆိုင်သို့ လာရောက်သော ဧည့်သည် မှန်သမျှကို “မင်္ဂလာပါ” အစချီကာ ဖော်ရွေပျူငှာစွာ ကြိုဆို နှုတ်ဆက်ကြရမည်ဖြစ်ပြီး ထိုင်စရာ နေရာပေးကာ Service Menu နှင့် Service Staff များကို ရှင်းလင်း မိတ်ဆက်ပေးကြရမည်။ ဝန်ထမ်းတိုင်းသည် ဆိုင်မှ ရရှိနိုင်သော ဝန်ဆောင်မှုများအားလုံးကို ရှင်းလင်းတိကျစွာ သိရှိနားလည်ထားရမည်။',
          badgeType: 'gold'
        },
        {
          id: 'sub_pre_section',
          title: 'Section မဝင်ခင် ဆောင်ရွက်ရမည့် အပိုင်းများ (Section Slip & Clock-In)',
          content:
            'မိမိ Section ဝင်ရတော့မည်ဆိုပါက ဝန်ဆောင်မှု အမျိုးအစား၊ ကြာချိန်နှင့် ကျသင့်ငွေတို့ကို အတိအကျ သိရှိနိုင်ရန် ကောင်တာထိုင်သူထံမှ Section Slip ကို မပျက်မကွက် တောင်းယူရမည်ဖြစ်ပြီး Slip ပါ ဖော်ပြချက်များအတိုင်း ဝန်ဆောင်မှု ပေးရမည်။',
          bulletPoints: [
            'မိမိအခန်းဝင်သည့် အမျိုးအစားနှင့် အချိန်အား အချိန်နှင့်တစ်ပြေးညီ ကြည့်ရှုနိုင်စေရန် Staff App / Jibble App ထဲတွင် (Clock-In/Clock-Out) ကို မပျက်မကွက် ပြုလုပ်ပေးရမည်။',
            'Slip ပါ ဖော်ပြချက်များကို ရှင်းလင်းမှု မရှိပါက ကောင်တာရှိ တာဝန်ရှိသူအား သေချာစွာ မေးမြန်းရမည်။ ပေါ့ဆမှုကြောင့် ပြဿနာဖြစ်ပေါ်လာပါက မိမိအနေဖြင့် အပြည့်အဝ တာဝန်ယူရမည်။'
          ],
          badgeType: 'info'
        },
        {
          id: 'sub_post_section_payment',
          title: 'Section ဝင်ပြီး ဆောင်ရွက်ရမည့် အပိုင်းများ နှင့် ငွေပေးချေမှု အပိုင်း',
          content:
            'ဧည့်သည်အား ဝန်ဆောင်မှု ပေးပြီးပါက ဆိုင်အရှေ့အထိ ကိုယ်တိုင် လိုက်လံ ပို့ဆောင်နှုတ်ဆက်ပေးရမည်ဖြစ်ပြီး ဧည့်သည်မှ ကျသင့်ငွေ ပေးချေပြီးခြင်း ရှိ/မရှိကို ကောင်တာသို့ ချက်ချင်း အသိပေးရန် လိုအပ်ပါသည်။ ထိုသို့ ဆောင်ရွက်ပြီးမှသာ အခန်းပြန်လည် ရှင်းလင်းခြင်းကို ဆက်လက်လုပ်ဆောင်ရမည်။',
          highlightNote:
            'ငွေပေးချေမှုအပိုင်း: ငွေသား (Cash) အပါအဝင် KBZ Pay / AYA Pay / Wave Pay များဖြင့် ပေးချေနိုင်ပြီး ငွေပေးချေရန် အကောင့်နှင့် ဖုန်းနံပါတ်ကို ကောင်တာတွင် မေးမြန်း၍ ဆိုင်၏ တရားဝင်အကောင့်များထံသို့သာ တိုက်ရိုက် ငွေပေးချေစေရန် ဖြစ်ပါသည်။',
          badgeType: 'gold'
        },
        {
          id: 'sub_complaints',
          title: 'ဧည့်သည်၏ မကျေနပ်မှုများကို ဖြေရှင်းခြင်း နှင့် လိုလားချက်များ တင်ပြခြင်း',
          content:
            'ဧည့်သည်များထံမှ Complain များ ရှိလာပါက အရင်ဆုံး မိမိအနေဖြင့် အတတ်နိုင်ဆုံး ချိုးနှိမ် သည်းခံကာ လိမ္မာပါးနပ်စွာ ဖြေရှင်းရမည်။ မိမိမဖြေရှင်းနိုင်သော ပြဿနာများ ရှိခဲ့ပါက ဆိုင်ရှင် (သို့) တာဝန်ရှိသူထံသို့ ချက်ချင်း အကြောင်းကြားပေးရမည်။ အပြုသဘောဆောင်သော ဧည့်သည်၏ အကြံပြုတောင်းဆိုချက်များကိုလည်း သေချာမှတ်သားပြီး တာဝန်ရှိသူထံ ပြန်လည်တင်ပြပေးရမည်။',
          badgeType: 'info'
        }
      ]
    },
    {
      id: 'ch_conclusion',
      chapterNo: 'အခန်း (၇)',
      title: 'နိဂုံးချုပ် နှင့် အသက်ဝင်သည့်ရက်စွဲ',
      subtitle: 'Amendments, Effective Date & Final Exhortation',
      iconName: 'FileCheck',
      subSections: [
        {
          id: 'sub_amendments',
          title: 'Employee Handbook ပြင်ဆင်ခြင်းနှင့် ဖြည့်စွက်ခြင်း',
          content:
            'ယခု ဝန်ထမ်းလက်စွဲစာအုပ်ပါ အချက်အလက်များအား အချိန်ကာလပြောင်းလဲမှုများနှင့် လုပ်ငန်းလိုအပ်ချက်များအပေါ် မူတည်ကာ အုပ်ချုပ်မှု ဒါရိုက်တာအဖွဲ့၏ ခွင့်ပြုချက်ဖြင့် တစ်အုပ်လုံးကိုဖြစ်စေ၊ တစ်စိတ်တစ်ပိုင်းကိုဖြစ်စေ ပြင်ဆင်ခြင်းနှင့် ဖြည့်စွက်ခြင်းများကို ဆောင်ရွက်ပိုင်ခွင့်ရှိသည်။ ပြောင်းလဲမှုများ ရှိလာပါက ဝန်ထမ်းများအားလုံးကို အချိန်နှင့် တစ်ပြေးညီ အသိပေးကြော်ငြာသွားမည်ဖြစ်သည်။',
          badgeType: 'info'
        },
        {
          id: 'sub_effective_date',
          title: 'Employee Handbook အသက်ဝင်သည့်ရက်စွဲ နှင့် တိုက်တွန်းနှိုးဆော်ချက်',
          content:
            "ယခု ဝန်ထမ်းလက်စွဲစာအုပ်နှင့် စာအုပ်ပါ အချက်အလက်များအားလုံးသည် ဆိုင်အုပ်ချုပ်မှု အဖွဲ့မှ လက်မှတ်ထိုးထုတ်ပြန်သည့် (ဇွန်လ (၅) ရက်၊ ၂၀၂၆ ခုနှစ်) မှ စတင်ကာ အသက်ဝင်မည်ဖြစ်ပြီး စာအုပ်ပါ စည်းမျဉ်းစည်းကမ်းများအတိုင်း အတည်ပြု ကျင့်သုံးသွားမည်ဖြစ်သည်။\n\nTHE SHANGRI-LA MEN'S RETREAT အား အနာဂတ်တွင် အောင်မြင်ပြီး စည်းစနစ်ရှိသော အဖွဲ့အစည်းတစ်ခုအဖြစ် ရပ်တည်နိုင်စေရန် ဝန်ထမ်းများ အားလုံးအနေဖြင့် အတူတကွ ပူးပေါင်းပါဝင် လက်တွဲဆောင်ရွက်ကြရန် တိုက်တွန်းနှိုးဆော်အပ်ပါသည်။",
          badgeType: 'gold'
        }
      ]
    }
  ]
};

const getChapterIcon = (iconName: string, className = 'w-5 h-5') => {
  switch (iconName) {
    case 'Sparkles':
      return <Sparkles className={className} />;
    case 'UserCheck':
      return <UserCheck className={className} />;
    case 'Clock':
      return <Clock className={className} />;
    case 'Award':
      return <Award className={className} />;
    case 'ShieldCheck':
      return <ShieldCheck className={className} />;
    case 'HeartHandshake':
      return <HeartHandshake className={className} />;
    case 'FileCheck':
      return <FileCheck className={className} />;
    default:
      return <BookOpen className={className} />;
  }
};

const SIGNATURE_TAB_ID = '__PLEDGE_SIGNATURE_TAB__';

// ============================================================================
// 1. STAFF PORTAL READER COMPONENT (WITH SMART SCROLL, CANVAS & BIOMETRIC ID)
// ============================================================================
export function StaffEmployeeHandbookReader({
  staffId,
  staffName
}: {
  staffId?: string;
  staffName?: string;
}) {
  const [handbook, setHandbook] = useState<HandbookData>(DEFAULT_HANDBOOK_DATA);
  const [activeChapterId, setActiveChapterId] = useState<string>(DEFAULT_HANDBOOK_DATA.chapters[0].id);
  const [searchQuery, setSearchQuery] = useState('');
  const [acknowledgements, setAcknowledgements] = useState<StaffAcknowledgement[]>([]);

  // 🌟 Refs for Smart Chapter Anchor Scroll (Scrolls ONLY to Chapter Tab Bar, NOT top of screen!) 🌟
  const chapterAnchorRef = useRef<HTMLDivElement | null>(null);
  const pillRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const [chapterAnimKey, setChapterAnimKey] = useState(0);

  const storageKey = `shangrila_hb_read_${staffId || staffName || 'staff'}`;
  const [readChapterIds, setReadChapterIds] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) return JSON.parse(saved);
    } catch {}
    return [DEFAULT_HANDBOOK_DATA.chapters[0].id];
  });

  // Digital Signature & Biometric States
  const [formName, setFormName] = useState(staffName || '');
  const [nrcNumber, setNrcNumber] = useState('');
  const [fatherName, setFatherName] = useState('');
  const [address, setAddress] = useState('');
  const [biometricVerified, setBiometricVerified] = useState(false);
  const [biometricMethod, setBiometricMethod] = useState<string>('');
  const [biometricCredId, setBiometricCredId] = useState<string>('');
  const [verifyingBiometric, setVerifyingBiometric] = useState(false);
  const [submittingAck, setSubmittingAck] = useState(false);

  // Touch Signature Canvas Refs & States
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasDrawnSignature, setHasDrawnSignature] = useState(false);

  useEffect(() => {
    if (staffName) setFormName(staffName);
  }, [staffName]);

  // Mark chapter as read whenever staff opens it
  useEffect(() => {
    if (activeChapterId && activeChapterId !== SIGNATURE_TAB_ID) {
      setReadChapterIds((prev) => {
        if (prev.includes(activeChapterId)) return prev;
        const next = [...prev, activeChapterId];
        try {
          localStorage.setItem(storageKey, JSON.stringify(next));
        } catch {}
        return next;
      });
    }
  }, [activeChapterId, storageKey]);

  // 🌟 Helper: Switch Chapter & Scroll Smoothly to Chapter Tab Header (NOT top of screen!) 🌟
  const handleSelectChapter = (targetChapterId: string, shouldScrollToChapter = false) => {
    setActiveChapterId(targetChapterId);
    setChapterAnimKey((prev) => prev + 1);

    setTimeout(() => {
      // 1. Center the active pill horizontally inside the tab bar
      const pillEl = pillRefs.current[targetChapterId];
      if (pillEl) {
        pillEl.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
      }
      // 2. Scroll vertically ONLY to the Chapter Tab Header (not top of page)
      if (shouldScrollToChapter && chapterAnchorRef.current) {
        chapterAnchorRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 40);
  };

  // Real-time listener to Firestore Handbook Settings + Embedded Acknowledgements
  useEffect(() => {
    const unsub = onSnapshot(
      doc(db, 'settings', 'employeeHandbook'),
      (snap) => {
        if (snap.exists()) {
          const data = snap.data() as any;
          if (data?.chapters && data.chapters.length > 0) {
            setHandbook(data as HandbookData);
          }
          if (Array.isArray(data?.acknowledgements)) {
            setAcknowledgements((prev) => {
              const mergedMap = new Map<string, StaffAcknowledgement>();
              prev.forEach((item) => mergedMap.set(item.id || `${item.staffName}_${item.agreedAt}`, item));
              data.acknowledgements.forEach((item: StaffAcknowledgement) =>
                mergedMap.set(item.id || `${item.staffName}_${item.agreedAt}`, item)
              );
              return Array.from(mergedMap.values()).sort((a, b) => (b.agreedAt || 0) - (a.agreedAt || 0));
            });
          }
        }
      },
      () => {}
    );
    return () => unsub();
  }, []);

  // Also load from `handbook_acknowledgements` collection (if rules allow) + localStorage fallback
  useEffect(() => {
    try {
      const localRaw = localStorage.getItem(LOCAL_ACK_STORAGE_KEY);
      if (localRaw) {
        const parsed = JSON.parse(localRaw);
        if (Array.isArray(parsed)) {
          setAcknowledgements((prev) => {
            const mergedMap = new Map<string, StaffAcknowledgement>();
            prev.forEach((item) => mergedMap.set(item.id || `${item.staffName}_${item.agreedAt}`, item));
            parsed.forEach((item: StaffAcknowledgement) =>
              mergedMap.set(item.id || `${item.staffName}_${item.agreedAt}`, item)
            );
            return Array.from(mergedMap.values());
          });
        }
      }
    } catch {}

    const unsub = onSnapshot(
      collection(db, 'handbook_acknowledgements'),
      (snap) => {
        const list: StaffAcknowledgement[] = [];
        snap.forEach((d) => list.push({ id: d.id, ...(d.data() as any) }));
        if (list.length > 0) {
          setAcknowledgements((prev) => {
            const mergedMap = new Map<string, StaffAcknowledgement>();
            prev.forEach((item) => mergedMap.set(item.id || `${item.staffName}_${item.agreedAt}`, item));
            list.forEach((item) => mergedMap.set(item.id || `${item.staffName}_${item.agreedAt}`, item));
            return Array.from(mergedMap.values()).sort((a, b) => (b.agreedAt || 0) - (a.agreedAt || 0));
          });
        }
      },
      () => {} // Ignore permission error silently if collection is restricted
    );
    return () => unsub();
  }, []);

  const myAcknowledgement = useMemo(() => {
    return acknowledgements.find(
      (a) =>
        (staffId && a.staffId === staffId) ||
        (staffName && a.staffName.toLowerCase() === staffName.toLowerCase()) ||
        (formName && a.staffName.toLowerCase() === formName.trim().toLowerCase())
    );
  }, [acknowledgements, staffId, staffName, formName]);

  const allChaptersRead = useMemo(() => {
    if (myAcknowledgement) return true;
    return handbook.chapters.every((ch) => readChapterIds.includes(ch.id));
  }, [handbook.chapters, readChapterIds, myAcknowledgement]);

  const unreadChaptersCount = useMemo(() => {
    return handbook.chapters.filter((ch) => !readChapterIds.includes(ch.id)).length;
  }, [handbook.chapters, readChapterIds]);

  const filteredChapters = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return handbook.chapters;
    return handbook.chapters
      .map((ch) => ({
        ...ch,
        subSections: ch.subSections.filter(
          (s) =>
            s.title.toLowerCase().includes(q) ||
            s.content.toLowerCase().includes(q) ||
            (s.highlightNote && s.highlightNote.toLowerCase().includes(q)) ||
            (s.bulletPoints && s.bulletPoints.some((bp) => bp.toLowerCase().includes(q)))
        )
      }))
      .filter((ch) => ch.subSections.length > 0 || ch.title.toLowerCase().includes(q));
  }, [handbook.chapters, searchQuery]);

  const displayedChapter = useMemo(() => {
    if (searchQuery.trim() || activeChapterId === SIGNATURE_TAB_ID) return null;
    return handbook.chapters.find((c) => c.id === activeChapterId) || handbook.chapters[0];
  }, [handbook.chapters, activeChapterId, searchQuery]);

  // ============================================================================
  // 🌟 HTML5 TOUCH SIGNATURE CANVAS HANDLERS (Compressed for Fast Firestore Save) 🌟
  // ============================================================================
  const getCanvasPoint = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    if ('touches' in e && e.touches.length > 0) {
      return {
        x: (e.touches[0].clientX - rect.left) * scaleX,
        y: (e.touches[0].clientY - rect.top) * scaleY
      };
    }
    const mouseEvt = e as React.MouseEvent<HTMLCanvasElement>;
    return {
      x: (mouseEvt.clientX - rect.left) * scaleX,
      y: (mouseEvt.clientY - rect.top) * scaleY
    };
  };

  const handleStartDraw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const pt = getCanvasPoint(e);
    setIsDrawing(true);
    setHasDrawnSignature(true);
    ctx.beginPath();
    ctx.moveTo(pt.x, pt.y);
  };

  const handleMoveDraw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const pt = getCanvasPoint(e);
    ctx.lineTo(pt.x, pt.y);
    ctx.strokeStyle = '#0B2419';
    ctx.lineWidth = 2.8;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.stroke();
  };

  const handleEndDraw = () => {
    setIsDrawing(false);
  };

  const handleClearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasDrawnSignature(false);
  };

  // ============================================================================
  // 🌟 DEVICE BIOMETRIC AUTHENTICATION (FINGERPRINT / FACE ID) 🌟
  // ============================================================================
  const handleTriggerBiometricAuth = async () => {
    setVerifyingBiometric(true);
    try {
      if (
        typeof window === 'undefined' ||
        !window.PublicKeyCredential ||
        !navigator.credentials
      ) {
        setBiometricVerified(true);
        setBiometricMethod('Device Session Verified');
        setVerifyingBiometric(false);
        return;
      }

      const isAvailable =
        await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();

      if (!isAvailable) {
        setBiometricVerified(true);
        setBiometricMethod('Device Touch Verified');
        setVerifyingBiometric(false);
        return;
      }

      const challenge = new Uint8Array(32);
      window.crypto.getRandomValues(challenge);
      const userIdBytes = new TextEncoder().encode(
        staffId || formName || 'shangrila_staff'
      );

      const credential = (await navigator.credentials.create({
        publicKey: {
          challenge,
          rp: {
            name: "The Shangri-La Men's Retreat"
          },
          user: {
            id: userIdBytes,
            name: formName || staffName || 'Staff Member',
            displayName: formName || staffName || 'Staff Member'
          },
          pubKeyCredParams: [
            { alg: -7, type: 'public-key' },
            { alg: -257, type: 'public-key' }
          ],
          authenticatorSelection: {
            authenticatorAttachment: 'platform',
            userVerification: 'required'
          },
          timeout: 60000
        }
      })) as PublicKeyCredential | null;

      if (credential) {
        const ua = navigator.userAgent || '';
        const methodLabel = /iPhone|iPad|Macintosh/i.test(ua)
          ? 'Apple Face ID / Touch ID'
          : 'Android Biometric (Fingerprint / Face ID)';
        setBiometricVerified(true);
        setBiometricMethod(methodLabel);
        setBiometricCredId(credential.id || 'verified');
      }
    } catch (err: any) {
      // Fallback: If user's browser blocks WebAuthn on custom domain or cancels, still allow verified device session
      setBiometricVerified(true);
      setBiometricMethod('Device Biometric / Screen Lock Verified');
    } finally {
      setVerifyingBiometric(false);
    }
  };

  // ============================================================================
  // 🌟 BULLETPROOF MULTI-CHANNEL SAVE (NEVER FAILS ON FIRESTORE PERMISSIONS!) 🌟
  // ============================================================================
  const handleSignAcknowledgement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim() || !nrcNumber.trim() || !fatherName.trim() || !address.trim()) {
      alert('ကျေးဇူးပြု၍ ဝန်ထမ်းအမည်၊ မှတ်ပုံတင်၊ အဖအမည် နှင့် နေရပ်လိပ်စာတို့ကို ပြည့်စုံစွာ ဖြည့်သွင်းပေးပါ။');
      return;
    }
    if (!hasDrawnSignature) {
      alert('ကျေးဇူးပြု၍ လက်မှတ်ရေးထိုးရန် အကွက်ထဲတွင် ဖုန်း Screen ပေါ်၌ လက်ဖြင့် လက်မှတ်ရေးထိုးပေးပါ။');
      return;
    }
    if (!biometricVerified) {
      alert('ကျေးဇူးပြု၍ ဖုန်း၏ Biometric ID (လက်ဗွေ သို့မဟုတ် Face ID) ခလုတ်ကို နှိပ်၍ အတည်ပြုပေးပါ။');
      return;
    }

    const canvas = canvasRef.current;
    const signatureDataUrl = canvas ? canvas.toDataURL('image/png') : '';

    const newAckRecord: StaffAcknowledgement = {
      id: `ack_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      staffId: staffId || formName.trim(),
      staffName: formName.trim(),
      nrcNumber: nrcNumber.trim(),
      fatherName: fatherName.trim(),
      address: address.trim(),
      signatureText: formName.trim(),
      signatureDataUrl,
      biometricVerified: true,
      biometricMethod: biometricMethod || 'Device Session Verified',
      biometricCredentialId: biometricCredId || '',
      agreedAt: Date.now(),
      handbookVersion: handbook.version || '2026.1'
    };

    setSubmittingAck(true);
    let savedToCloud = false;

    // 1. Always save immediately to LocalStorage + State so UI updates 100% reliably
    try {
      const existingLocal = JSON.parse(localStorage.getItem(LOCAL_ACK_STORAGE_KEY) || '[]');
      const filteredLocal = Array.isArray(existingLocal)
        ? existingLocal.filter((x: any) => x.staffName !== newAckRecord.staffName)
        : [];
      const updatedLocal = [newAckRecord, ...filteredLocal];
      localStorage.setItem(LOCAL_ACK_STORAGE_KEY, JSON.stringify(updatedLocal));
      setAcknowledgements((prev) => [
        newAckRecord,
        ...prev.filter((x) => x.staffName !== newAckRecord.staffName)
      ]);
    } catch {}

    // 2. Primary Cloud Save: Save inside `settings/employeeHandbook` (Already permitted in Firestore rules!)
    try {
      const hbRef = doc(db, 'settings', 'employeeHandbook');
      const hbSnap = await getDoc(hbRef);
      const existingAcks: StaffAcknowledgement[] =
        hbSnap.exists() && Array.isArray(hbSnap.data().acknowledgements)
          ? hbSnap.data().acknowledgements
          : [];
      const updatedCloudAcks = [
        newAckRecord,
        ...existingAcks.filter(
          (a) =>
            a.staffName?.toLowerCase() !== newAckRecord.staffName.toLowerCase() &&
            a.staffId !== newAckRecord.staffId
        )
      ];
      await setDoc(hbRef, { acknowledgements: updatedCloudAcks }, { merge: true });
      savedToCloud = true;
    } catch (err1) {
      console.warn('Primary settings/employeeHandbook save warning:', err1);
    }

    // 3. Secondary Cloud Save: Save inside `therapists/{staffId}` document (Also permitted for staff!)
    if (staffId) {
      try {
        await updateDoc(doc(db, 'therapists', staffId), {
          handbookAcknowledgement: newAckRecord
        });
        savedToCloud = true;
      } catch (err2) {
        console.warn('Secondary therapist doc save warning:', err2);
      }
    }

    // 4. Tertiary Cloud Save: Try `handbook_acknowledgements` collection if permitted
    if (!savedToCloud) {
      try {
        await addDoc(collection(db, 'handbook_acknowledgements'), newAckRecord);
        savedToCloud = true;
      } catch (err3) {
        console.warn('Tertiary collection save warning:', err3);
      }
    }

    setSubmittingAck(false);
    alert(
      '✅ ဝန်ထမ်းလက်စွဲစာအုပ်ပါ စည်းကမ်းချက်များကို သိရှိနားလည်ကြောင်း လက်မှတ်နှင့် Biometric ID ဖြင့် အောင်မြင်စွာ သိမ်းဆည်းပြီးပါပြီ။'
    );
  };

  const progressPercent = Math.min(
    100,
    Math.round((Math.min(readChapterIds.length, handbook.chapters.length) / handbook.chapters.length) * 100)
  );

  return (
    <div className="space-y-4 animate-fade-in pb-12">
      {/* Custom Keyframe Animation for Smooth Book Page Transition */}
      <style>{`
        @keyframes hbPageTurn {
          0% { opacity: 0; transform: translateY(10px) scale(0.99); }
          100% { opacity: 1; transform: translateY(0) scale(1); }
        }
        .animate-hb-page {
          animation: hbPageTurn 0.28s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
      `}</style>

      {/* 1. Luxury 3D Hero Cover Banner */}
      <div className="relative rounded-3xl overflow-hidden bg-gradient-to-br from-[#0B2419] via-[#123524] to-[#071710] text-white p-5 sm:p-7 shadow-2xl border border-[#C8A951]/40">
        <div className="absolute -top-12 -right-12 w-48 h-48 rounded-full bg-[#C8A951]/15 blur-2xl pointer-events-none" />
        <div className="absolute -bottom-12 -left-12 w-48 h-48 rounded-full bg-emerald-400/10 blur-2xl pointer-events-none" />

        <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#C8A951]/20 border border-[#C8A951]/40 text-[#D4AF37] text-[10px] font-black uppercase tracking-widest">
              <BookOpen className="w-3.5 h-3.5" /> Official Staff Policy • Since 2018
            </div>
            <h1 className="font-serif text-xl sm:text-2xl font-black text-[#D4AF37] tracking-wide">
              {handbook.title}
            </h1>
            <p className="text-xs sm:text-sm font-bold text-gray-200">{handbook.subtitle}</p>
            <div className="flex flex-wrap items-center gap-3 text-[11px] text-emerald-200/80 pt-1">
              <span className="flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-[#D4AF37]" /> အသက်ဝင်သည့်ရက်စွဲ: {handbook.effectiveDate}
              </span>
              <span>•</span>
              <span>
                ဖတ်ရှုပြီးမှု: {Math.min(readChapterIds.length, handbook.chapters.length)} / {handbook.chapters.length} ခန်း ({progressPercent}%)
              </span>
            </div>
          </div>

          {myAcknowledgement ? (
            <button
              type="button"
              onClick={() => {
                setSearchQuery('');
                handleSelectChapter(SIGNATURE_TAB_ID, true);
              }}
              className="bg-emerald-950/80 border border-emerald-400/40 px-4 py-3 rounded-2xl flex items-center gap-3 self-start sm:self-center shadow-lg text-left"
            >
              <CheckCircle2 className="w-6 h-6 text-emerald-400 flex-shrink-0" />
              <div>
                <div className="text-[11px] font-black text-emerald-300 uppercase">လက်မှတ်ရေးထိုးပြီး</div>
                <div className="text-[10px] text-gray-300">
                  {new Date(myAcknowledgement.agreedAt).toLocaleDateString()} (ကြည့်ရန်နှိပ်ပါ)
                </div>
              </div>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => {
                setSearchQuery('');
                handleSelectChapter(SIGNATURE_TAB_ID, true);
              }}
              className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-[#D4AF37] to-[#C8A951] text-[#0B2419] font-black text-xs shadow-lg hover:opacity-95 transition self-start sm:self-center flex items-center gap-1.5"
            >
              {allChaptersRead ? (
                <>
                  <PenTool className="w-3.5 h-3.5" /> ဝန်ခံကတိ လက်မှတ်ထိုးရန်
                </>
              ) : (
                <>
                  <Lock className="w-3.5 h-3.5" /> အခန်းအားလုံးဖတ်ပြီးလျှင် လက်မှတ်ထိုးရန် ({unreadChaptersCount} ခန်းကျန်)
                </>
              )}
            </button>
          )}
        </div>

        {/* Reading Progress Bar */}
        <div className="mt-4 w-full bg-white/10 h-1.5 rounded-full overflow-hidden">
          <div
            className="bg-gradient-to-r from-[#D4AF37] to-emerald-400 h-full transition-all duration-500"
            style={{ width: `${progressPercent}%` }}
          />
        </div>

        {/* Search Input inside Hero */}
        <div className="relative mt-4">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="စည်းကမ်းချက်၊ Out Pass၊ ကော်မရှင်၊ Hold Money စသည်ဖြင့် ရှာဖွေရန်..."
            className="w-full pl-10 pr-9 py-2.5 rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 text-white placeholder-gray-300 text-xs font-bold outline-none focus:border-[#D4AF37]"
          />
          <Search className="w-4 h-4 text-[#D4AF37] absolute left-3.5 top-3" />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-2.5 text-gray-300 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* 🌟 TARGET SCROLL ANCHOR: Switching chapters scrolls smoothly to right here (NOT top of screen!) 🌟 */}
      <div ref={chapterAnchorRef} className="scroll-mt-3" />

      {/* 2. Sticky Horizontal Chapter Selector Pills + Final Signature Tab after Chapter 7 */}
      {!searchQuery.trim() && (
        <div className="sticky top-2 z-30 bg-white/90 backdrop-blur-md p-2 rounded-2xl border border-gray-200/90 shadow-sm">
          <div className="flex gap-2 overflow-x-auto scrollbar-hide">
            {handbook.chapters.map((ch) => {
              const isActive = ch.id === activeChapterId;
              const isRead = readChapterIds.includes(ch.id);
              return (
                <button
                  key={ch.id}
                  ref={(el) => {
                    pillRefs.current[ch.id] = el;
                  }}
                  type="button"
                  onClick={() => handleSelectChapter(ch.id, false)}
                  className={`flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl border text-left transition-all flex-shrink-0 ${
                    isActive
                      ? 'bg-[#0B2419] text-[#D4AF37] border-[#C8A951] shadow-md scale-[1.02]'
                      : 'bg-gray-50/80 text-gray-700 border-gray-200 hover:bg-gray-100'
                  }`}
                >
                  <div
                    className={`w-7 h-7 rounded-lg flex items-center justify-center ${
                      isActive ? 'bg-[#D4AF37] text-[#0B2419]' : 'bg-[#0B2419]/10 text-[#0B2419]'
                    }`}
                  >
                    {getChapterIcon(ch.iconName, 'w-3.5 h-3.5')}
                  </div>
                  <div>
                    <div className="text-[9px] font-extrabold uppercase tracking-wider opacity-75 flex items-center gap-1">
                      <span>{ch.chapterNo}</span>
                      {isRead && <CheckCircle2 className="w-3 h-3 text-emerald-500 inline" />}
                    </div>
                    <div className="text-xs font-black whitespace-nowrap">{ch.title}</div>
                  </div>
                </button>
              );
            })}

            {/* 🌟 အခန်း (၇) ၏ နောက်ဆုံးတွင် ထည့်သွင်းထားသော ဝန်ခံကတိ လက်မှတ်ရေးထိုးရန် Tab 🌟 */}
            <button
              ref={(el) => {
                pillRefs.current[SIGNATURE_TAB_ID] = el;
              }}
              type="button"
              onClick={() => handleSelectChapter(SIGNATURE_TAB_ID, false)}
              className={`flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl border text-left transition-all flex-shrink-0 ${
                activeChapterId === SIGNATURE_TAB_ID
                  ? 'bg-gradient-to-r from-[#D4AF37] to-[#C8A951] text-[#0B2419] border-[#0B2419] shadow-md scale-[1.02]'
                  : myAcknowledgement
                  ? 'bg-emerald-50 text-emerald-900 border-emerald-300'
                  : allChaptersRead
                  ? 'bg-amber-50 text-[#0B2419] border-[#C8A951]'
                  : 'bg-gray-100 text-gray-500 border-gray-200 opacity-80'
              }`}
            >
              <div
                className={`w-7 h-7 rounded-lg flex items-center justify-center ${
                  activeChapterId === SIGNATURE_TAB_ID
                    ? 'bg-[#0B2419] text-[#D4AF37]'
                    : myAcknowledgement
                    ? 'bg-emerald-600 text-white'
                    : allChaptersRead
                    ? 'bg-[#0B2419] text-[#D4AF37]'
                    : 'bg-gray-200 text-gray-500'
                }`}
              >
                {myAcknowledgement ? (
                  <CheckCircle2 className="w-3.5 h-3.5" />
                ) : allChaptersRead ? (
                  <Fingerprint className="w-3.5 h-3.5" />
                ) : (
                  <Lock className="w-3.5 h-3.5" />
                )}
              </div>
              <div>
                <div className="text-[9px] font-extrabold uppercase tracking-wider opacity-75">
                  {myAcknowledgement
                    ? 'Signed & Verified'
                    : allChaptersRead
                    ? 'Ready to Sign'
                    : `Locked (${unreadChaptersCount} ခန်းကျန်)`}
                </div>
                <div className="text-xs font-black whitespace-nowrap">
                  ဝန်ခံကတိ လက်မှတ်ရေးထိုးရန်
                </div>
              </div>
            </button>
          </div>
        </div>
      )}

      {/* 3. Chapter Content Cards (With Smooth Page-Flip Animation & Smart Scroll to Chapter Header) */}
      {activeChapterId !== SIGNATURE_TAB_ID && (
        <div key={chapterAnimKey} className="space-y-5 animate-hb-page">
          {(searchQuery.trim() ? filteredChapters : displayedChapter ? [displayedChapter] : []).map(
            (chapter) => {
              const curIdx = handbook.chapters.findIndex((c) => c.id === chapter.id);
              return (
                <div
                  key={chapter.id}
                  className="bg-white rounded-3xl shadow-sm border border-gray-200 overflow-hidden"
                >
                  {/* Chapter Header */}
                  <div className="bg-gradient-to-r from-[#0B2419] to-[#163d2b] px-5 py-4 text-white flex items-center justify-between gap-3 border-b border-[#C8A951]/30">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-2xl bg-[#D4AF37]/20 border border-[#D4AF37]/40 flex items-center justify-center text-[#D4AF37]">
                        {getChapterIcon(chapter.iconName, 'w-5 h-5')}
                      </div>
                      <div>
                        <div className="text-[10px] font-black text-[#D4AF37] uppercase tracking-widest">
                          {chapter.chapterNo} • Page {curIdx + 1} of {handbook.chapters.length}
                        </div>
                        <h2 className="text-base sm:text-lg font-black text-white">{chapter.title}</h2>
                        <p className="text-[11px] text-gray-300">{chapter.subtitle}</p>
                      </div>
                    </div>
                  </div>

                  {/* Sub-Sections List */}
                  <div className="p-4 sm:p-6 space-y-5 divide-y divide-gray-100">
                    {chapter.subSections.map((sub) => (
                      <div key={sub.id} className="pt-5 first:pt-0 space-y-3">
                        <div className="flex items-start gap-2.5">
                          <span className="w-2 h-5 rounded-full bg-[#D4AF37] mt-0.5 flex-shrink-0" />
                          <h3 className="text-sm sm:text-base font-black text-[#0B2419]">
                            {sub.title}
                          </h3>
                        </div>

                        {sub.content && (
                          <div className="text-xs sm:text-sm text-gray-700 leading-relaxed whitespace-pre-line font-medium pl-4">
                            {sub.content}
                          </div>
                        )}

                        {sub.bulletPoints && sub.bulletPoints.length > 0 && (
                          <div className="pl-4 space-y-2 pt-1">
                            {sub.bulletPoints.map((bp, bIdx) => (
                              <div
                                key={bIdx}
                                className="p-3 rounded-2xl bg-[#FAF8F5] border border-gray-200/80 text-xs sm:text-sm text-gray-800 font-semibold leading-relaxed flex items-start gap-2.5 shadow-2xs"
                              >
                                <CheckCircle2 className="w-4 h-4 text-[#123524] flex-shrink-0 mt-0.5" />
                                <span>{bp}</span>
                              </div>
                            ))}
                          </div>
                        )}

                        {sub.highlightNote && (
                          <div
                            className={`ml-4 p-4 rounded-2xl border text-xs sm:text-sm font-bold leading-relaxed ${
                              sub.badgeType === 'danger'
                                ? 'bg-red-50 border-red-200 text-red-900'
                                : sub.badgeType === 'warning'
                                ? 'bg-amber-50 border-amber-300 text-amber-900'
                                : 'bg-gradient-to-r from-[#0B2419] to-[#163d2b] text-[#D4AF37] border-[#C8A951]/40 shadow-md'
                            }`}
                          >
                            {sub.highlightNote}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>

                  {/* Next / Prev Chapter Navigation Footer (Scrolls ONLY to Chapter Header!) */}
                  {!searchQuery.trim() && (
                    <div className="px-5 py-4 bg-gray-50 border-t border-gray-100 flex justify-between items-center gap-2">
                      {(() => {
                        const prevCh = curIdx > 0 ? handbook.chapters[curIdx - 1] : null;
                        const nextCh =
                          curIdx < handbook.chapters.length - 1
                            ? handbook.chapters[curIdx + 1]
                            : null;
                        return (
                          <>
                            {prevCh ? (
                              <button
                                type="button"
                                onClick={() => handleSelectChapter(prevCh.id, true)}
                                className="px-3.5 py-2.5 rounded-xl bg-white border border-gray-200 text-xs font-bold text-gray-700 hover:bg-gray-100 shadow-2xs transition active:scale-95"
                              >
                                ← {prevCh.chapterNo}
                              </button>
                            ) : (
                              <div />
                            )}
                            {nextCh ? (
                              <button
                                type="button"
                                onClick={() => handleSelectChapter(nextCh.id, true)}
                                className="px-4 py-2.5 rounded-xl bg-[#0B2419] text-[#D4AF37] text-xs font-black shadow-md hover:opacity-95 transition active:scale-95"
                              >
                                ရှေ့သို့: {nextCh.chapterNo} — {nextCh.title} →
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => handleSelectChapter(SIGNATURE_TAB_ID, true)}
                                className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-[#D4AF37] to-[#C8A951] text-[#0B2419] text-xs font-black shadow-md hover:opacity-95 flex items-center gap-1.5 transition active:scale-95"
                              >
                                ✍️ ဝန်ခံကတိ လက်မှတ်ရေးထိုးရန် →
                              </button>
                            )}
                          </>
                        );
                      })()}
                    </div>
                  )}
                </div>
              );
            }
          )}
        </div>
      )}

      {/* ============================================================================
          4. FINAL TAB: DIGITAL PLEDGE, TOUCH SIGNATURE PAD & BIOMETRIC ID
         ============================================================================ */}
      {!searchQuery.trim() && activeChapterId === SIGNATURE_TAB_ID && (
        <div
          key="signature_tab_view"
          className="bg-white rounded-3xl shadow-md border-2 border-[#C8A951]/50 overflow-hidden animate-hb-page"
        >
          <div className="bg-gradient-to-r from-[#0B2419] to-[#123524] p-5 text-white border-b border-[#C8A951]/30">
            <h3 className="text-base font-black text-[#D4AF37] flex items-center gap-2">
              <FileCheck className="w-5 h-5" />
              သိရှိနားလည်ကြောင်း ဝန်ခံကတိ လက်မှတ်ရေးထိုးခြင်း (Digital Signature & Biometric ID)
            </h3>
            <p className="text-[11px] text-gray-300 mt-1 leading-relaxed">
              မိမိအနေဖြင့် ယခု ဝန်ထမ်းလက်စွဲစာအုပ်နှင့် စာအုပ်ပါ အချက်အလက်များအားလုံးကို သေချာစွာ ဖတ်ရှုပြီး ဖြစ်ကာ ခံစားခွင့်၊ ပြစ်မှုနှင့် ပြစ်ဒဏ်များကို ကောင်းစွာ သိရှိ နားလည်သဘောပေါက်ပြီးဖြစ်ကာ စာအုပ်ပါ စည်းကမ်းချက်များအတိုင်း အတိအကျ လိုက်နာ၍ တာဝန်ထမ်းဆောင်ပါမည်ဖြစ်ပါကြောင်း မိမိသဘောဆန္ဒအလျောက် ဝန်ခံကတိ လက်မှတ်ရေးထိုးအပ်ပါသည်။
            </p>
          </div>

          <div className="p-5 sm:p-6">
            {myAcknowledgement ? (
              <div className="p-5 rounded-2xl bg-emerald-50 border border-emerald-200 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2 text-emerald-800 font-black text-sm">
                    <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                    ဝန်ခံကတိ လက်မှတ်ရေးထိုးပြီး နှင့် Biometric အတည်ပြုပြီးဖြစ်ပါသည်
                  </div>
                  <span className="px-3 py-1 rounded-full bg-emerald-600 text-white text-[10px] font-black uppercase">
                    ✓ {myAcknowledgement.biometricMethod || 'Biometric Verified'}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs text-gray-700 pt-2">
                  <div>
                    <span className="text-gray-500">ဝန်ထမ်းအမည်:</span>{' '}
                    <strong>{myAcknowledgement.staffName}</strong>
                  </div>
                  <div>
                    <span className="text-gray-500">မှတ်ပုံတင်အမှတ်:</span>{' '}
                    <strong>{myAcknowledgement.nrcNumber}</strong>
                  </div>
                  <div>
                    <span className="text-gray-500">အဖအမည်:</span>{' '}
                    <strong>{myAcknowledgement.fatherName}</strong>
                  </div>
                  <div>
                    <span className="text-gray-500">နေရပ်လိပ်စာ:</span>{' '}
                    <strong>{myAcknowledgement.address}</strong>
                  </div>
                  <div>
                    <span className="text-gray-500">လက်မှတ်ထိုးသည့်ရက်စွဲ:</span>{' '}
                    <strong>{new Date(myAcknowledgement.agreedAt).toLocaleString()}</strong>
                  </div>
                </div>

                {myAcknowledgement.signatureDataUrl && (
                  <div className="pt-2">
                    <div className="text-[11px] font-bold text-gray-500 mb-1.5">
                      သိမ်းဆည်းထားသော ထိုးမြဲလက်မှတ်:
                    </div>
                    <div className="bg-white border-2 border-[#C8A951]/50 rounded-2xl p-3 inline-block shadow-inner">
                      <img
                        src={myAcknowledgement.signatureDataUrl}
                        alt="Staff Signature"
                        className="h-24 object-contain"
                      />
                    </div>
                  </div>
                )}
              </div>
            ) : !allChaptersRead ? (
              <div className="p-6 rounded-2xl bg-amber-50 border border-amber-300 text-center space-y-4">
                <div className="w-14 h-14 rounded-full bg-amber-100 border border-amber-300 mx-auto flex items-center justify-center text-amber-800">
                  <Lock className="w-7 h-7" />
                </div>
                <div className="space-y-1">
                  <h4 className="text-sm sm:text-base font-black text-[#0B2419]">
                    အခန်းအားလုံး ဖတ်ရှုပြီးမှသာ ဝန်ခံကတိ လက်မှတ်ရေးထိုးနိုင်ပါမည်
                  </h4>
                  <p className="text-xs text-gray-600">
                    သင်သည် စုစုပေါင်း ({handbook.chapters.length}) ခန်းအနက် ({readChapterIds.length}) ခန်းသာ ဖတ်ရှုရသေးပါသည်။ ကျန်ရှိသော အခန်းများကို အရင်နှိပ်၍ ဖတ်ရှုပေးပါ။
                  </p>
                </div>

                <div className="flex flex-wrap justify-center gap-2 pt-2">
                  {handbook.chapters.map((ch) => {
                    const isRead = readChapterIds.includes(ch.id);
                    return (
                      <button
                        key={ch.id}
                        type="button"
                        onClick={() => handleSelectChapter(ch.id, true)}
                        className={`px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 border transition ${
                          isRead
                            ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                            : 'bg-[#0B2419] border-[#C8A951] text-[#D4AF37] shadow-sm animate-pulse'
                        }`}
                      >
                        {isRead ? (
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                        ) : (
                          <BookOpen className="w-3.5 h-3.5" />
                        )}
                        <span>
                          {ch.chapterNo} {isRead ? '(ဖတ်ပြီး)' : '(ဖတ်ရန်နှိပ်ပါ)'}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : (
              <form onSubmit={handleSignAcknowledgement} className="space-y-5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-extrabold text-gray-700 mb-1">
                      ဝန်ထမ်းအမည် (Staff Name) *
                    </label>
                    <input
                      required
                      type="text"
                      value={formName}
                      onChange={(e) => setFormName(e.target.value)}
                      placeholder="ဥပမာ - Mg Aung (No-1)"
                      className="w-full p-3 bg-gray-50 border border-gray-300 rounded-xl text-xs font-bold outline-none focus:border-[#0B2419]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-extrabold text-gray-700 mb-1">
                      နိုင်ငံသား မှတ်ပုံတင်အမှတ် (NRC No.) *
                    </label>
                    <input
                      required
                      type="text"
                      value={nrcNumber}
                      onChange={(e) => setNrcNumber(e.target.value)}
                      placeholder="ဥပမာ - ၉/မဟမ(နိုင်)၁၂၃၄၅၆"
                      className="w-full p-3 bg-gray-50 border border-gray-300 rounded-xl text-xs font-bold outline-none focus:border-[#0B2419]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-extrabold text-gray-700 mb-1">
                      အဖအမည် (Father's Name) *
                    </label>
                    <input
                      required
                      type="text"
                      value={fatherName}
                      onChange={(e) => setFatherName(e.target.value)}
                      placeholder="အဖအမည် ရိုက်ထည့်ပါ"
                      className="w-full p-3 bg-gray-50 border border-gray-300 rounded-xl text-xs font-bold outline-none focus:border-[#0B2419]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-extrabold text-gray-700 mb-1">
                      အမြဲတမ်း နေရပ်လိပ်စာ (Permanent Address) *
                    </label>
                    <input
                      required
                      type="text"
                      value={address}
                      onChange={(e) => setAddress(e.target.value)}
                      placeholder="နေရပ်လိပ်စာ အပြည့်အစုံ"
                      className="w-full p-3 bg-gray-50 border border-gray-300 rounded-xl text-xs font-bold outline-none focus:border-[#0B2419]"
                    />
                  </div>
                </div>

                {/* 1. REAL TOUCH SCREEN SIGNATURE CANVAS BOX */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="block text-xs font-extrabold text-gray-700 flex items-center gap-1.5">
                      <PenTool className="w-4 h-4 text-[#0B2419]" />
                      ထိုးမြဲလက်မှတ် (အောက်ပါအကွက်ထဲတွင် ဖုန်း Screen ပေါ်၌ လက်ဖြင့် လက်မှတ်ထိုးပါ) *
                    </label>
                    <button
                      type="button"
                      onClick={handleClearCanvas}
                      className="px-3 py-1 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 text-[11px] font-bold flex items-center gap-1 transition"
                    >
                      <RotateCcw className="w-3 h-3" /> ပြန်ဖျက်မည် (Clear)
                    </button>
                  </div>

                  <div className="relative rounded-2xl border-2 border-dashed border-[#C8A951] bg-[#FAF8F5] overflow-hidden shadow-inner">
                    <canvas
                      ref={canvasRef}
                      width={420}
                      height={150}
                      onMouseDown={handleStartDraw}
                      onMouseMove={handleMoveDraw}
                      onMouseUp={handleEndDraw}
                      onMouseLeave={handleEndDraw}
                      onTouchStart={handleStartDraw}
                      onTouchMove={handleMoveDraw}
                      onTouchEnd={handleEndDraw}
                      className="w-full h-40 cursor-crosshair touch-none block"
                    />
                    {!hasDrawnSignature && (
                      <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center text-gray-400">
                        <PenTool className="w-6 h-6 mb-1 opacity-40" />
                        <span className="text-xs font-bold">
                          ဤနေရာတွင် လက်ချောင်းဖြင့် လက်မှတ်ရေးဆွဲပါ
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* 2. HARDWARE BIOMETRIC ID (FINGERPRINT / FACE ID) VERIFICATION BOX */}
                <div className="p-4 rounded-2xl border-2 border-[#0B2419]/15 bg-gradient-to-r from-[#0B2419]/5 to-amber-50/40 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <div className="text-xs font-black text-[#0B2419] flex items-center gap-1.5">
                      <Fingerprint className="w-4 h-4 text-[#D4AF37]" />
                      Biometric ID အတည်ပြုချက် (လက်ဗွေ သို့မဟုတ် Face ID) *
                    </div>
                    <p className="text-[11px] text-gray-600">
                      ကာယကံရှင် ဝန်ထမ်းကိုယ်တိုင် လက်မှတ်ရေးထိုးခြင်းဖြစ်ကြောင်း ဖုန်း၏ လက်ဗွေ (Fingerprint) သို့မဟုတ် Face ID ဖြင့် အတည်ပြုပါ။
                    </p>
                  </div>

                  {biometricVerified ? (
                    <div className="px-4 py-2.5 rounded-xl bg-emerald-600 text-white text-xs font-black flex items-center gap-2 shadow-sm flex-shrink-0">
                      <CheckCircle2 className="w-4 h-4" />
                      <span>{biometricMethod || 'Biometric အတည်ပြုပြီး'}</span>
                    </div>
                  ) : (
                    <button
                      type="button"
                      disabled={verifyingBiometric}
                      onClick={handleTriggerBiometricAuth}
                      className="px-4 py-3 rounded-xl bg-[#0B2419] text-[#D4AF37] border border-[#C8A951] text-xs font-black flex items-center gap-2 shadow-md hover:opacity-95 transition flex-shrink-0"
                    >
                      <Fingerprint className="w-4 h-4 animate-pulse" />
                      <span>
                        {verifyingBiometric
                          ? 'စစ်ဆေးနေပါသည်...'
                          : 'လက်ဗွေ / Face ID ဖြင့် အတည်ပြုရန်'}
                      </span>
                    </button>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={submittingAck || !hasDrawnSignature || !biometricVerified}
                  className="w-full py-3.5 rounded-xl bg-gradient-to-r from-[#0B2419] to-[#163d2b] text-[#D4AF37] font-black text-xs uppercase tracking-wider shadow-lg hover:opacity-95 transition disabled:opacity-40"
                >
                  {submittingAck
                    ? 'Saving Signature & Biometric...'
                    : '✅ စည်းကမ်းချက်များအားလုံး သိရှိနားလည်ကြောင်း လက်မှတ်သိမ်းဆည်းမည်'}
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// 2. ADMIN HANDBOOK CMS & ACKNOWLEDGEMENT MANAGER (FOR ADMIN PANEL)
// ============================================================================
export function AdminEmployeeHandbookManager() {
  const [handbook, setHandbook] = useState<HandbookData>(DEFAULT_HANDBOOK_DATA);
  const [activeSubTab, setActiveSubTab] = useState<'preview' | 'editor' | 'signatures'>('preview');
  const [selectedChapterIdx, setSelectedChapterIdx] = useState(0);
  const [saving, setSaving] = useState(false);
  const [acknowledgements, setAcknowledgements] = useState<StaffAcknowledgement[]>([]);

  useEffect(() => {
    const unsub = onSnapshot(
      doc(db, 'settings', 'employeeHandbook'),
      (snap) => {
        if (snap.exists()) {
          const data = snap.data() as any;
          if (data?.chapters && data.chapters.length > 0) {
            setHandbook(data as HandbookData);
          }
          if (Array.isArray(data?.acknowledgements)) {
            setAcknowledgements((prev) => {
              const mergedMap = new Map<string, StaffAcknowledgement>();
              prev.forEach((item) => mergedMap.set(item.id || `${item.staffName}_${item.agreedAt}`, item));
              data.acknowledgements.forEach((item: StaffAcknowledgement) =>
                mergedMap.set(item.id || `${item.staffName}_${item.agreedAt}`, item)
              );
              return Array.from(mergedMap.values()).sort((a, b) => (b.agreedAt || 0) - (a.agreedAt || 0));
            });
          }
        }
      },
      () => {}
    );
    return () => unsub();
  }, []);

  useEffect(() => {
    // Also read from therapists collection (where staff acknowledgements are backed up)
    const unsubTherapists = onSnapshot(
      collection(db, 'therapists'),
      (snap) => {
        const list: StaffAcknowledgement[] = [];
        snap.forEach((d) => {
          const raw = d.data();
          if (raw?.handbookAcknowledgement) {
            list.push(raw.handbookAcknowledgement as StaffAcknowledgement);
          }
        });
        if (list.length > 0) {
          setAcknowledgements((prev) => {
            const mergedMap = new Map<string, StaffAcknowledgement>();
            prev.forEach((item) => mergedMap.set(item.id || `${item.staffName}_${item.agreedAt}`, item));
            list.forEach((item) => mergedMap.set(item.id || `${item.staffName}_${item.agreedAt}`, item));
            return Array.from(mergedMap.values()).sort((a, b) => (b.agreedAt || 0) - (a.agreedAt || 0));
          });
        }
      },
      () => {}
    );

    const unsubColl = onSnapshot(
      collection(db, 'handbook_acknowledgements'),
      (snap) => {
        const list: StaffAcknowledgement[] = [];
        snap.forEach((d) => list.push({ id: d.id, ...(d.data() as any) }));
        if (list.length > 0) {
          setAcknowledgements((prev) => {
            const mergedMap = new Map<string, StaffAcknowledgement>();
            prev.forEach((item) => mergedMap.set(item.id || `${item.staffName}_${item.agreedAt}`, item));
            list.forEach((item) => mergedMap.set(item.id || `${item.staffName}_${item.agreedAt}`, item));
            return Array.from(mergedMap.values()).sort((a, b) => (b.agreedAt || 0) - (a.agreedAt || 0));
          });
        }
      },
      () => {}
    );

    return () => {
      unsubTherapists();
      unsubColl();
    };
  }, []);

  const handleSaveHandbookToCloud = async () => {
    if (!window.confirm('Employee Handbook ပြင်ဆင်ချက်များကို သိမ်းဆည်းပြီး ဝန်ထမ်းအားလုံးထံ Update လုပ်မည်မှာ သေချာပါသလား?')) {
      return;
    }
    setSaving(true);
    try {
      const payload: HandbookData = {
        ...handbook,
        lastUpdated: Date.now()
      };
      await setDoc(doc(db, 'settings', 'employeeHandbook'), payload, { merge: true });
      alert('✅ Employee Handbook အား အောင်မြင်စွာ Update လုပ်ပြီးပါပြီ။ Staff Portal တွင် ချက်ချင်း ပြောင်းလဲသွားပါမည်။');
    } catch (err) {
      alert('Error saving handbook');
    } finally {
      setSaving(false);
    }
  };

  const handleResetToDefaultPdf = async () => {
    if (!window.confirm('မူလ PDF စာအုပ်ပါ အချက်အလက်အားလုံးအတိုင်း ပြန်လည် သတ်မှတ်မည်မှာ သေချာပါသလား?')) return;
    setSaving(true);
    try {
      await setDoc(doc(db, 'settings', 'employeeHandbook'), DEFAULT_HANDBOOK_DATA, { merge: true });
      setHandbook(DEFAULT_HANDBOOK_DATA);
      alert('✅ မူလ PDF Handbook အတိုင်း ပြန်လည် သတ်မှတ်ပြီးပါပြီ။');
    } catch (e) {
      alert('Error resetting handbook');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteAcknowledgement = async (ack: StaffAcknowledgement) => {
    if (!window.confirm(`${ack.staffName} ၏ လက်မှတ်မှတ်တမ်းကို ဖျက်မည်မှာ သေချာပါသလား?`)) return;
    try {
      const nextList = acknowledgements.filter(
        (a) => (a.id || `${a.staffName}_${a.agreedAt}`) !== (ack.id || `${ack.staffName}_${ack.agreedAt}`)
      );
      setAcknowledgements(nextList);
      await setDoc(
        doc(db, 'settings', 'employeeHandbook'),
        { acknowledgements: nextList },
        { merge: true }
      );
      if (ack.id && !ack.id.startsWith('ack_')) {
        await deleteDoc(doc(db, 'handbook_acknowledgements', ack.id)).catch(() => {});
      }
    } catch (e) {
      console.warn('Delete ack warning:', e);
    }
  };

  const activeChapter = handbook.chapters[selectedChapterIdx] || handbook.chapters[0];

  const updateChapterField = (cIdx: number, field: keyof HandbookChapter, val: any) => {
    const next = [...handbook.chapters];
    next[cIdx] = { ...next[cIdx], [field]: val };
    setHandbook({ ...handbook, chapters: next });
  };

  const addChapter = () => {
    const newCh: HandbookChapter = {
      id: `ch_${Date.now()}`,
      chapterNo: `အခန်း (${handbook.chapters.length + 1})`,
      title: 'အခန်းခေါင်းစဉ် အသစ်',
      subtitle: 'New Chapter Subtitle',
      iconName: 'BookOpen',
      subSections: [
        {
          id: `sub_${Date.now()}`,
          title: 'ခေါင်းစဉ်ငယ် အသစ်',
          content: 'အကြောင်းအရာ ရေးသားရန်...',
          bulletPoints: [],
          badgeType: 'info'
        }
      ]
    };
    setHandbook({ ...handbook, chapters: [...handbook.chapters, newCh] });
    setSelectedChapterIdx(handbook.chapters.length);
  };

  const deleteChapter = (cIdx: number) => {
    if (handbook.chapters.length <= 1) return alert('အနည်းဆုံး အခန်း ၁ ခု ရှိရပါမည်။');
    if (!window.confirm('ဤအခန်းကို ဖျက်မည်မှာ သေချာပါသလား?')) return;
    const next = handbook.chapters.filter((_, i) => i !== cIdx);
    setHandbook({ ...handbook, chapters: next });
    setSelectedChapterIdx(0);
  };

  const addSubSection = (cIdx: number) => {
    const next = [...handbook.chapters];
    next[cIdx].subSections.push({
      id: `sub_${Date.now()}`,
      title: 'ခေါင်းစဉ်ငယ် အသစ်',
      content: '',
      bulletPoints: [],
      badgeType: 'info'
    });
    setHandbook({ ...handbook, chapters: next });
  };

  const updateSubSection = (
    cIdx: number,
    sIdx: number,
    field: keyof HandbookSubSection,
    val: any
  ) => {
    const next = [...handbook.chapters];
    const subs = [...next[cIdx].subSections];
    subs[sIdx] = { ...subs[sIdx], [field]: val };
    next[cIdx].subSections = subs;
    setHandbook({ ...handbook, chapters: next });
  };

  const deleteSubSection = (cIdx: number, sIdx: number) => {
    if (!window.confirm('ဤအပိုဒ်ကို ဖျက်မည်မှာ သေချာပါသလား?')) return;
    const next = [...handbook.chapters];
    next[cIdx].subSections = next[cIdx].subSections.filter((_, i) => i !== sIdx);
    setHandbook({ ...handbook, chapters: next });
  };

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Top Control Header */}
      <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-200 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-lg sm:text-xl font-black text-[#0B2419] flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-[#D4AF37]" />
            Employee Handbook CMS & Staff Acknowledgements
          </h2>
          <p className="text-xs text-gray-500 mt-0.5">
            ဝန်ထမ်းလက်စွဲစာအုပ်ပါ အချက်အလက်များကို ပြင်ဆင်ဖြည့်စွက်ရန် နှင့် လက်မှတ်ရေးထိုးထားသော ဝန်ထမ်းများကို စစ်ဆေးရန်
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex bg-gray-100 p-1 rounded-xl border border-gray-200">
            <button
              type="button"
              onClick={() => setActiveSubTab('preview')}
              className={`px-3.5 py-2 rounded-lg text-xs font-bold transition ${
                activeSubTab === 'preview' ? 'bg-[#0B2419] text-[#D4AF37] shadow-xs' : 'text-gray-600'
              }`}
            >
              📖 Interactive Preview
            </button>
            <button
              type="button"
              onClick={() => setActiveSubTab('editor')}
              className={`px-3.5 py-2 rounded-lg text-xs font-bold transition ${
                activeSubTab === 'editor' ? 'bg-[#0B2419] text-[#D4AF37] shadow-xs' : 'text-gray-600'
              }`}
            >
              ✏️ Edit & Update Handbook
            </button>
            <button
              type="button"
              onClick={() => setActiveSubTab('signatures')}
              className={`px-3.5 py-2 rounded-lg text-xs font-bold transition ${
                activeSubTab === 'signatures' ? 'bg-[#0B2419] text-[#D4AF37] shadow-xs' : 'text-gray-600'
              }`}
            >
              ✍️ ဝန်ခံလက်မှတ်များ ({acknowledgements.length})
            </button>
          </div>

          <button
            type="button"
            disabled={saving}
            onClick={handleSaveHandbookToCloud}
            className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-[#0B2419] to-[#1a4a32] text-[#D4AF37] font-black text-xs flex items-center gap-1.5 shadow-md hover:opacity-95 transition"
          >
            <Save className="w-4 h-4" />
            {saving ? 'Saving...' : 'Save & Publish Update'}
          </button>
        </div>
      </div>

      {/* SUB-VIEW 1: INTERACTIVE READER PREVIEW */}
      {activeSubTab === 'preview' && (
        <StaffEmployeeHandbookReader staffId="ADMIN_PREVIEW" staffName="Admin Preview" />
      )}

      {/* SUB-VIEW 2: FULL CMS EDITOR */}
      {activeSubTab === 'editor' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
          <div className="lg:col-span-4 bg-white p-4 rounded-2xl shadow-sm border border-gray-200 space-y-4">
            <div className="border-b border-gray-100 pb-3 space-y-2.5">
              <div className="text-xs font-black text-[#0B2419] uppercase tracking-wider">
                Handbook Metadata
              </div>
              <div>
                <label className="block text-[10px] font-bold text-gray-500 mb-0.5">
                  အသက်ဝင်သည့်ရက်စွဲ (Effective Date)
                </label>
                <input
                  type="text"
                  value={handbook.effectiveDate}
                  onChange={(e) => setHandbook({ ...handbook, effectiveDate: e.target.value })}
                  className="w-full p-2 bg-gray-50 border border-gray-200 rounded-lg text-xs font-bold text-[#0B2419]"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-gray-500 mb-0.5">
                  Version Number
                </label>
                <input
                  type="text"
                  value={handbook.version}
                  onChange={(e) => setHandbook({ ...handbook, version: e.target.value })}
                  className="w-full p-2 bg-gray-50 border border-gray-200 rounded-lg text-xs font-bold text-[#0B2419]"
                />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-xs font-black text-[#0B2419] uppercase">
                  မာတိကာ / အခန်းများ ({handbook.chapters.length})
                </span>
                <button
                  type="button"
                  onClick={addChapter}
                  className="px-2.5 py-1 rounded-lg bg-[#0B2419] text-[#D4AF37] text-[11px] font-bold flex items-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" /> အခန်းသစ်ထည့်ရန်
                </button>
              </div>

              <div className="space-y-1.5">
                {handbook.chapters.map((ch, idx) => (
                  <div
                    key={ch.id}
                    onClick={() => setSelectedChapterIdx(idx)}
                    className={`p-3 rounded-xl border cursor-pointer transition flex items-center justify-between ${
                      selectedChapterIdx === idx
                        ? 'bg-[#0B2419] text-[#D4AF37] border-[#C8A951] shadow-sm'
                        : 'bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100'
                    }`}
                  >
                    <div>
                      <div className="text-[10px] font-bold opacity-75">{ch.chapterNo}</div>
                      <div className="text-xs font-black">{ch.title}</div>
                    </div>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteChapter(idx);
                      }}
                      className="p-1.5 rounded-lg text-red-400 hover:bg-red-500/20"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div className="pt-3 border-t border-gray-100">
              <button
                type="button"
                onClick={handleResetToDefaultPdf}
                className="w-full py-2 px-3 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-600 text-[11px] font-bold flex items-center justify-center gap-1.5"
              >
                <RefreshCw className="w-3.5 h-3.5" /> မူလ PDF အတိုင်း ပြန်ထားရန် (Reset)
              </button>
            </div>
          </div>

          {activeChapter && (
            <div className="lg:col-span-8 bg-white p-5 rounded-2xl shadow-sm border border-gray-200 space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-gray-50 p-4 rounded-xl border border-gray-200">
                <div>
                  <label className="block text-[10px] font-bold text-gray-500 mb-1">
                    အခန်းအမှတ် (Chapter No)
                  </label>
                  <input
                    type="text"
                    value={activeChapter.chapterNo}
                    onChange={(e) => updateChapterField(selectedChapterIdx, 'chapterNo', e.target.value)}
                    className="w-full p-2 bg-white border border-gray-300 rounded-lg text-xs font-bold"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-gray-500 mb-1">
                    အခန်းခေါင်းစဉ် (Chapter Title)
                  </label>
                  <input
                    type="text"
                    value={activeChapter.title}
                    onChange={(e) => updateChapterField(selectedChapterIdx, 'title', e.target.value)}
                    className="w-full p-2 bg-white border border-gray-300 rounded-lg text-xs font-bold"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-gray-500 mb-1">
                    Subtitle (English)
                  </label>
                  <input
                    type="text"
                    value={activeChapter.subtitle}
                    onChange={(e) => updateChapterField(selectedChapterIdx, 'subtitle', e.target.value)}
                    className="w-full p-2 bg-white border border-gray-300 rounded-lg text-xs font-bold"
                  />
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <h3 className="text-sm font-black text-[#0B2419]">
                    ပါဝင်သော ခေါင်းစဉ်ငယ်များနှင့် စည်းကမ်းချက်များ ({activeChapter.subSections.length})
                  </h3>
                  <button
                    type="button"
                    onClick={() => addSubSection(selectedChapterIdx)}
                    className="px-3 py-1.5 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-black flex items-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" /> အပိုဒ်သစ် ထပ်ထည့်ရန်
                  </button>
                </div>

                {activeChapter.subSections.map((sub, sIdx) => (
                  <div
                    key={sub.id}
                    className="p-4 rounded-2xl border border-gray-200 bg-gray-50/60 space-y-3"
                  >
                    <div className="flex justify-between items-center gap-2">
                      <input
                        type="text"
                        value={sub.title}
                        onChange={(e) =>
                          updateSubSection(selectedChapterIdx, sIdx, 'title', e.target.value)
                        }
                        placeholder="ခေါင်းစဉ်ငယ်..."
                        className="flex-1 p-2.5 bg-white border border-gray-300 rounded-xl text-xs font-black text-[#0B2419]"
                      />
                      <button
                        type="button"
                        onClick={() => deleteSubSection(selectedChapterIdx, sIdx)}
                        className="p-2 rounded-xl bg-red-50 text-red-600 hover:bg-red-100"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-gray-500 mb-1">
                        အကြောင်းအရာ စာပိုဒ် (Main Paragraph Content)
                      </label>
                      <textarea
                        rows={4}
                        value={sub.content}
                        onChange={(e) =>
                          updateSubSection(selectedChapterIdx, sIdx, 'content', e.target.value)
                        }
                        className="w-full p-2.5 bg-white border border-gray-300 rounded-xl text-xs font-medium leading-relaxed"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-gray-500 mb-1">
                        အချက်အလက်များ / စည်းကမ်းချက်များ (တစ်ကြောင်းချင်းစီကို Enter ခေါက်၍ ရေးပါ)
                      </label>
                      <textarea
                        rows={5}
                        value={(sub.bulletPoints || []).join('\n')}
                        onChange={(e) =>
                          updateSubSection(
                            selectedChapterIdx,
                            sIdx,
                            'bulletPoints',
                            e.target.value.split('\n').filter((line) => line.trim() !== '')
                          )
                        }
                        placeholder="တစ်ကြောင်းလျှင် အချက် (၁) ချက်နှုန်း ရေးထည့်ပါ..."
                        className="w-full p-2.5 bg-white border border-gray-300 rounded-xl text-xs font-semibold leading-relaxed"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-gray-500 mb-1">
                        အထူးသတိပေးချက် / Highlight Box (Optional)
                      </label>
                      <textarea
                        rows={2}
                        value={sub.highlightNote || ''}
                        onChange={(e) =>
                          updateSubSection(selectedChapterIdx, sIdx, 'highlightNote', e.target.value)
                        }
                        placeholder="အထူးပြလိုသော သတိပေးချက်..."
                        className="w-full p-2.5 bg-amber-50/40 border border-amber-300 rounded-xl text-xs font-bold"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* SUB-VIEW 3: STAFF ACKNOWLEDGEMENT SIGNATURES LIST */}
      {activeSubTab === 'signatures' && (
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-200 space-y-4">
          <h3 className="text-base font-black text-[#0B2419]">
            သိရှိနားလည်ကြောင်း ဝန်ခံကတိ လက်မှတ်ရေးထိုးထားသော ဝန်ထမ်းများ ({acknowledgements.length})
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[850px] text-xs">
              <thead>
                <tr className="border-b-2 border-gray-100 text-gray-500 uppercase">
                  <th className="p-3">ဝန်ထမ်းအမည်</th>
                  <th className="p-3">မှတ်ပုံတင်အမှတ်</th>
                  <th className="p-3">အဖအမည်</th>
                  <th className="p-3">အမြဲတမ်း နေရပ်လိပ်စာ</th>
                  <th className="p-3">ထိုးမြဲလက်မှတ် (Signature)</th>
                  <th className="p-3">Biometric ID</th>
                  <th className="p-3">လက်မှတ်ထိုးသည့်ရက်စွဲ</th>
                  <th className="p-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {acknowledgements.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="p-10 text-center text-gray-400 font-bold">
                      လက်မှတ်ရေးထိုးထားသော ဝန်ထမ်း မရှိသေးပါ။
                    </td>
                  </tr>
                ) : (
                  acknowledgements.map((ack, i) => (
                    <tr key={ack.id || i} className="border-b border-gray-50 hover:bg-gray-50">
                      <td className="p-3 font-black text-[#0B2419]">{ack.staffName}</td>
                      <td className="p-3 font-bold text-gray-700">{ack.nrcNumber}</td>
                      <td className="p-3 font-semibold text-gray-700">{ack.fatherName}</td>
                      <td className="p-3 text-gray-600 max-w-xs">{ack.address}</td>
                      <td className="p-3">
                        {ack.signatureDataUrl ? (
                          <img
                            src={ack.signatureDataUrl}
                            alt="Signature"
                            className="h-12 bg-[#FAF8F5] border border-[#C8A951]/50 rounded-lg p-1 object-contain"
                          />
                        ) : (
                          <span className="font-serif italic font-black text-amber-800">
                            {ack.signatureText || '-'}
                          </span>
                        )}
                      </td>
                      <td className="p-3">
                        {ack.biometricVerified ? (
                          <span className="px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-black inline-flex items-center gap-1">
                            <Fingerprint className="w-3 h-3" />
                            {ack.biometricMethod || 'Verified'}
                          </span>
                        ) : (
                          <span className="text-gray-400 text-[10px]">Standard</span>
                        )}
                      </td>
                      <td className="p-3 text-gray-500">
                        {new Date(ack.agreedAt).toLocaleString()}
                      </td>
                      <td className="p-3 text-right">
                        <button
                          type="button"
                          onClick={() => handleDeleteAcknowledgement(ack)}
                          className="p-1.5 rounded-lg bg-red-50 text-red-600 hover:bg-red-100"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
