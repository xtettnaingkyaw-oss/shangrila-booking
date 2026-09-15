import React, { useState, useEffect } from 'react';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { ClipboardList, Users, RotateCw, Save, Coffee, Droplets, Bed, ChefHat, Bath, CheckCircle, Info } from 'lucide-react';
import { TherapistProfile } from '../shared';

// တာဝန်အသေးစိတ်များ
const DUTY_TASKS = [
    { 
        id: 'reception', title: '၁။ ဧည့်ကြိုနှင့် ဧည့်ခန်းစောင့်တာဝန်', icon: Coffee, color: 'text-orange-600', bg: 'bg-orange-50', border: 'border-orange-200',
        desc: [
            'ဆိုင်၏ ပထမဆုံး မျက်နှာစာဖြစ်သောကြောင့် အမြဲတမ်း ဖော်ရွေပျူငှာပြီး သန့်ရှင်းသပ်ရပ်နေရန်။',
            'ကြိုဆိုခြင်း - ဧည့်သည်များကို အပြုံးဖြင့် နွေးထွေးစွာ ကြိုဆိုရန်၊ Welcome Drink တိုက်ရန်နှင့် ဝန်ဆောင်မှုများကို စိတ်ရှည်စွာ ရှင်းပြရန်။',
            'ဧည့်ခန်းတာဝန်ကျသူများထဲမှ တစ်ယောက်သည် ဧည့်ခန်းထဲတွင် အမြဲတမ်း Stand By မဖြစ်မနေ ရှိရပါမည်။',
            'ဧည့်ခန်းသန့်ရှင်းရေး - ဆိုဖာ၊ စားပွဲ၊ Spa စင်နှင့် ကြမ်းပြင်များကို ဖုန်ကင်းစင်အောင် နေ့စဉ် သန့်ရှင်းရေးလုပ်ရန်။ ကောင်တာပန်းအိုး နေ့စဉ် ရေလဲလှယ်ရန်။',
            'ဆိုင်ရှေ့မျက်နှာစာ - ဆိုင်ရှေ့မျက်နှာစာကို တံမြက်စည်းလှည်း၊ ရေဆေးချပြီး အမှိုက်သရိုက်ကင်းစင်အောင် ထားရှိရန်။',
            'လေထုသန့်စင်မှု - ဧည့်ခန်းအတွင်း Spa အမွှေးနံ့သာများ အမြဲမွှေးပျံ့နေစေရန် ဂရုစိုက်ရန်။'
        ]
    },
    { 
        id: 'water_garbage', title: '၂။ ရေစောင့်တင်ရန်နှင့် အမှိုက်ပစ်တာဝန်', icon: Droplets, color: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-200',
        desc: [
            'ရေရရှိမှု စီမံခြင်း - ဆိုင်အတွင်း ရေပြတ်လပ်မှု လုံးဝမရှိစေရန် ရေတိုင်ကီများ ရေပြည့်/မပြည့် ပုံမှန်စစ်ဆေးပြီး ရေမော်တာကို အချိန်မှန် ဖွင့်/ပိတ် လုပ်ရန်။',
            'အမှိုက်စွန့်ပစ်ခြင်း - ဆိုင်မှာစွန့်ပစ်ပစ္စည်းများစုပုံထားသော အမှိုက်ပုံးကြီးအား နေ့စဉ် စွန့်ပစ်ရန်။',
            'သန့်ရှင်းမှုထိန်းသိမ်းခြင်း - အမှိုက်ပုံးများကို ရေဆေးကျင်းပြီး အနံ့အသက်မရှိစေရန် အမြဲဂရုစိုက်ရမည်။'
        ]
    },
    { 
        id: 'laundry_rooms', title: '၃။ တဘက်/အခင်းလျှော်နှင့် အခန်းသန့်ရှင်းရေး', icon: Bed, color: 'text-purple-600', bg: 'bg-purple-50', border: 'border-purple-200',
        desc: [
            'လျှော်ဖွပ်/သိမ်းဆည်းခြင်း - တဘက်နှင့် အခင်းများကို ဆီချေးစင်အောင် လျှော်ဖွပ်ရန်၊ နေလှန်း/မီးပူတိုက်ကာ သပ်ရပ်စွာ ခေါက်သိမ်းရန်။',
            'အခန်းပြင်ဆင်ခြင်း - မနက်ဆိုင်မဖွင့်မီ အခန်းများကို ရှင်းလင်းပြီး အခင်းသစ်များ လဲလှယ်ရန်။ ဧည့်သည်မလာမီ ကြိုတင်ပြင်ဆင်ထားရန်။',
            'ပစ္စည်းများ စီစဉ်ခြင်း - Carebeau ဆီဘူးများ၊ တဘက်များနှင့် အသုံးအဆောင်များကို အလွယ်တကူ ယူသုံးနိုင်ရန် သပ်ရပ်စွာ စီစဉ်ထားရှိရန်။',
            'အခန်းတွင်းသန့်ရှင်းရေး - လေဝင်လေထွက်ကောင်းစေရန်နှင့် အနံ့ဆိုးများမရှိစေရန် သန့်စင်ပြီး Spa အမွှေးနံ့သာ ဖြန်းထားရန်။'
        ]
    },
    { 
        id: 'kitchen_cooking', title: '၄။ မီးဖိုချောင်နှင့် ထမင်းချက်တာဝန်', icon: ChefHat, color: 'text-red-600', bg: 'bg-red-50', border: 'border-red-200',
        desc: [
            'ချက်ပြုတ်ခြင်း - ဝန်ထမ်းများအတွက် ကျန်းမာရေးနှင့် ညီညွတ်သော အစားအသောက်များကို အချိန်မီ ပြင်ဆင်ချက်ပြုတ်ပေးရန်။',
            'မီးဖိုချောင်သန့်ရှင်းရေး - ချက်ပြုတ်ပြီးတိုင်း ကြမ်းပြင်၊ ပန်းကန်များနှင့် မီးဖိုခုံများကို ဆီချေးကင်းစင်အောင် ချက်ချင်း ဆေးကြောရန်။ မီးဖိုချောင်အနံ့ ဧည့်ခန်းသို့ မရောက်စေရန်။',
            'ရေမြောင်းသန့်ရှင်းရေး - နောက်ဖေးရေမြောင်းများ ပိတ်ဆို့မှုမရှိစေရန်နှင့် အနံ့ဆိုးမထွက်ရန် နေ့စဉ် အမှိုက်ဆယ်ပြီး ဆေးကြောသန့်စင်ရန်။'
        ]
    },
    { 
        id: 'bathroom_toilet', title: '၅။ ရေချိုးခန်းနှင့် အိမ်သာ သန့်ရှင်းရေး', icon: Bath, color: 'text-teal-600', bg: 'bg-teal-50', border: 'border-teal-200',
        desc: [
            'အမြဲတမ်း ခြောက်သွေ့စေရန် - မနက်တိုင်း ရေချိုးခန်းနှင့် အိမ်သာကြမ်းပြင်များကို ရေမဝပ်စေဘဲ ချက်ချင်း ရေသုတ်/ကြမ်းတိုက်ရမည် (ချော်လဲခြင်းမှ ကင်းဝေးစေရန်)။',
            'တိုက်ချွတ်သန့်စင်ခြင်း - ဘိုထိုင်၊ ဘေစင်၊ Shower နှင့် မှန်များကို ရေဂျိုး/ဆပ်ပြာကွက် လုံးဝမကျန်စေရန် သီးသန့် ဆေးရည်ဖြင့် နေ့စဉ် တိုက်ချွတ်ရန်။',
            'ပစ္စည်းများ ဖြည့်တင်းခြင်း - တစ်ရှူး၊ လက်ဆေးဆပ်ပြာရည်၊ ရေချိုးဆပ်ပြာနှင့် ခေါင်းလျှော်ရည်များ မပြတ်လပ်စေရန် အမြဲစစ်ဆေးပြီး ဖြည့်တင်းရန်။',
            'အနံ့အသက် ထိန်းချုပ်ခြင်း - လေထွက်ပန်ကာ (Exhaust Fan) ပုံမှန်ဖွင့်ထားရန်နှင့် လေသန့်စင်ဆေး/အမွှေးနံ့သာများ အမြဲမွှေးပျံ့နေစေရန်။'
        ]
    }
];

export function DutyRosterSystem({ therapists }: { therapists: TherapistProfile[] }) {
    const [assignments, setAssignments] = useState<Record<string, string[]>>({});
    const [lastRotated, setLastRotated] = useState<string>('');
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [expandedTask, setExpandedTask] = useState<string | null>(null);

    useEffect(() => {
        const fetchRoster = async () => {
            try {
                const snap = await getDoc(doc(db, 'settings', 'dutyRoster'));
                if (snap.exists()) {
                    setAssignments(snap.data().assignments || {});
                    setLastRotated(snap.data().lastRotated || '');
                }
            } catch (e) { console.error(e); }
            setLoading(false);
        };
        fetchRoster();
    }, []);

    // 🌟 Advanced Auto-Rotate Algorithm 🌟
    const handleAutoRotate = () => {
        if (!window.confirm("ဝန်ထမ်းအားလုံးကို တာဝန် ၅ ခုသို့ အချိုးကျ ခွဲဝေမည် သေချာပါသလား? \n\n(ယခင်တာဝန်ကျပြီးသူများ ထပ်မကျစေရန် စနစ်မှ အလိုအလျောက် ရှောင်ရှားပေးပါမည်။)")) return;
        
        // ယခင်အပတ်က တာဝန်များကို မှတ်သားထားမည်
        const prevAssigned: Record<string, string> = {};
        Object.keys(assignments).forEach(taskId => {
            assignments[taskId].forEach(staffId => { prevAssigned[staffId] = taskId; });
        });

        // ဝန်ထမ်းစာရင်းကို ကျပန်း (Shuffle) မွှေမည် (ဝန်ထမ်းသစ်များပါ အလိုအလျောက် ပါလာမည်)
        let availableStaff = therapists.map(t => t.id);
        for (let i = availableStaff.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [availableStaff[i], availableStaff[j]] = [availableStaff[j], availableStaff[i]];
        }

        const newAssignments: Record<string, string[]> = { reception: [], water_garbage: [], laundry_rooms: [], kitchen_cooking: [], bathroom_toilet: [] };
        const taskKeys = Object.keys(newAssignments);

        // ဝန်ထမ်းများကို အချိုးကျ ခွဲဝေမည်
        availableStaff.forEach((staffId) => {
            const prevTask = prevAssigned[staffId];
            let eligibleTasks = taskKeys.filter(key => key !== prevTask);
            if (eligibleTasks.length === 0) eligibleTasks = taskKeys; // တာဝန်အသစ်မရှိတော့ရင် အကုန်ပြန်ဖွင့်ပေးမည်

            let minSize = Infinity;
            eligibleTasks.forEach(key => { if (newAssignments[key].length < minSize) minSize = newAssignments[key].length; });

            const candidateTasks = eligibleTasks.filter(key => newAssignments[key].length === minSize);
            const selectedTask = candidateTasks[Math.floor(Math.random() * candidateTasks.length)];
            
            newAssignments[selectedTask].push(staffId);
        });

        const today = new Date();
        const todayStr = today.getFullYear() + '-' + String(today.getMonth() + 1).padStart(2, '0') + '-' + String(today.getDate()).padStart(2, '0');

        setAssignments(newAssignments);
        setLastRotated(todayStr);
    };

    const handleSaveRoster = async () => {
        setSaving(true);
        try {
            await setDoc(doc(db, 'settings', 'dutyRoster'), { assignments, lastRotated: lastRotated || new Date().toISOString().split('T')[0], updatedAt: Date.now() });
            alert("✅ တာဝန်ခွဲဝေမှု အောင်မြင်စွာ မှတ်တမ်းတင်ပြီးပါပြီ။ (Staff များထံသို့ Noti ရောက်ရှိသွားပါမည်)");
        } catch (error) { alert("Error saving roster."); }
        setSaving(false);
    };

    const handleAssignStaff = (taskId: string, staffId: string) => {
        if (!staffId) return;
        const newAssignments = { ...assignments };
        Object.keys(newAssignments).forEach(key => { newAssignments[key] = (newAssignments[key] || []).filter(id => id !== staffId); });
        if (!newAssignments[taskId]) newAssignments[taskId] = [];
        newAssignments[taskId].push(staffId);
        setAssignments(newAssignments);
    };

    const handleRemoveStaff = (taskId: string, staffId: string) => {
        const newAssignments = { ...assignments };
        newAssignments[taskId] = newAssignments[taskId].filter(id => id !== staffId);
        setAssignments(newAssignments);
    };

    const getAssignedStaffNames = (staffIds: string[]) => {
        if (!staffIds || staffIds.length === 0) return [];
        return staffIds.map(id => { const t = therapists.find(th => th.id === id); return { id, name: t ? t.name : 'Unknown' }; });
    };

    let daysPassed = 0;
    if (lastRotated) {
        const lastD = new Date(lastRotated); const today = new Date();
        daysPassed = Math.floor(Math.abs(today.getTime() - lastD.getTime()) / (1000 * 60 * 60 * 24));
    }
    const isDueForRotation = daysPassed >= 10;

    if (loading) return <div className="p-10 text-center text-gray-500 font-bold animate-pulse">Loading Duty Roster...</div>;

    return (
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center mb-6 border-b border-gray-100 pb-4 gap-4">
                <div>
                    <h2 className="text-xl font-bold flex items-center text-[#123524]"><ClipboardList className="w-6 h-6 mr-2 text-[#D4AF37]" /> Staff Duty Roster</h2>
                    <p className="text-xs text-gray-500 mt-1">နေ့စဉ် သန့်ရှင်းရေးနှင့် လုပ်ငန်းဆောင်တာ တာဝန်ခွဲဝေမှုစနစ်</p>
                </div>
                <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
                    {lastRotated && (
                        <div className={`px-3 py-1.5 rounded-lg border text-[10px] font-bold shadow-sm ${isDueForRotation ? 'bg-red-50 text-red-600 border-red-200 animate-pulse' : 'bg-green-50 text-green-700 border-green-200'}`}>
                            {isDueForRotation ? `⚠️ တာဝန်ချိန်းရန် ${daysPassed} ရက် ကြာသွားပါပြီ` : `Last Rotated: ${lastRotated}`}
                        </div>
                    )}
                    <button onClick={handleAutoRotate} className="flex-1 lg:flex-none justify-center items-center flex px-4 py-2 bg-blue-50 text-blue-700 border border-blue-200 rounded-lg text-xs font-bold hover:bg-blue-100 transition shadow-sm whitespace-nowrap">
                        <RotateCw className="w-4 h-4 mr-1.5" /> Auto Rotate (10 Days)
                    </button>
                    <button onClick={handleSaveRoster} disabled={saving} className="flex-1 lg:flex-none justify-center items-center flex px-4 py-2 bg-[#123524] text-[#D4AF37] border border-[#1a4a32] rounded-lg text-xs font-bold hover:bg-[#1a4a32] transition shadow-md whitespace-nowrap disabled:opacity-50">
                        <Save className="w-4 h-4 mr-1.5" /> {saving ? 'Saving...' : 'Save Roster'}
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {DUTY_TASKS.map(task => {
                    const assignedStaff = getAssignedStaffNames(assignments[task.id] || []);
                    const isExpanded = expandedTask === task.id;

                    return (
                        <div key={task.id} className={`rounded-xl border ${task.border} shadow-sm overflow-hidden flex flex-col bg-white transition-all`}>
                            <div className={`${task.bg} p-4 border-b ${task.border} flex justify-between items-start cursor-pointer hover:opacity-90`} onClick={() => setExpandedTask(isExpanded ? null : task.id)}>
                                <div className="flex items-start">
                                    <task.icon className={`w-5 h-5 mr-2 mt-0.5 ${task.color}`} />
                                    <h3 className={`font-bold text-sm ${task.color}`}>{task.title}</h3>
                                </div>
                                <Info className="w-4 h-4 text-gray-400 flex-shrink-0 ml-2" />
                            </div>

                            {isExpanded && (
                                <div className="p-4 bg-gray-50 border-b border-gray-100 animate-fade-in text-xs text-gray-600 leading-relaxed font-semibold">
                                    <ul className="space-y-1.5">{task.desc.map((d, i) => (<li key={i} className="flex items-start"><span className="mr-1.5 mt-0.5">•</span> <span>{d}</span></li>))}</ul>
                                </div>
                            )}

                            <div className="p-4 flex-1 flex flex-col">
                                <div className="flex-1 mb-4">
                                    {assignedStaff.length === 0 ? (
                                        <div className="text-[10px] text-gray-400 font-bold uppercase tracking-wider text-center py-6 border-2 border-dashed border-gray-100 rounded-lg">No Staff Assigned</div>
                                    ) : (
                                        <div className="flex flex-wrap gap-2">
                                            {assignedStaff.map(staff => (
                                                <div key={staff.id} className="bg-gray-100 text-[#123524] px-3 py-1.5 rounded-lg text-xs font-bold flex items-center shadow-sm border border-gray-200">
                                                    <Users className="w-3 h-3 mr-1.5 text-gray-500"/> {staff.name}
                                                    <button onClick={() => handleRemoveStaff(task.id, staff.id)} className="ml-2 text-red-400 hover:text-red-600 bg-white rounded-full p-0.5 shadow-sm"><RotateCw className="w-2.5 h-2.5 rotate-45"/></button>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                                <div className="mt-auto pt-3 border-t border-gray-100">
                                    <select className="w-full p-2 bg-gray-50 border border-gray-200 rounded text-xs font-bold text-gray-600 outline-none focus:border-[#D4AF37]" onChange={(e) => { handleAssignStaff(task.id, e.target.value); e.target.value = ''; }} defaultValue="">
                                        <option value="" disabled>+ Add Staff to this Duty</option>
                                        {therapists.map(t => (<option key={t.id} value={t.id}>{t.name}</option>))}
                                    </select>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>

            <div className="mt-8 pt-6 border-t border-gray-200">
                <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Unassigned Staff (တာဝန်မချရသေးသူများ)</h4>
                <div className="flex flex-wrap gap-2">
                    {(() => {
                        const allAssignedIds = Object.values(assignments).flat();
                        const unassigned = therapists.filter(t => !allAssignedIds.includes(t.id));
                        if (unassigned.length === 0) return <span className="text-xs font-bold text-green-600 flex items-center bg-green-50 px-3 py-1.5 rounded-lg border border-green-100"><CheckCircle className="w-3.5 h-3.5 mr-1.5"/> အားလုံးကို တာဝန်ချထားပြီးပါပြီ။</span>;
                        return unassigned.map(t => (<span key={t.id} className="bg-red-50 text-red-600 px-3 py-1.5 rounded-lg text-xs font-bold border border-red-100 shadow-sm">{t.name}</span>));
                    })()}
                </div>
            </div>
        </div>
    );
}
