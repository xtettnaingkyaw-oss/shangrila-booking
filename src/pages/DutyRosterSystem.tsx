import React, { useState, useEffect } from 'react';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { ClipboardList, Users, RotateCw, Save, Coffee, Droplets, Bed, ChefHat, Bath, CheckCircle, Info, Edit, Trash2, PlusCircle, X, LayoutGrid, Settings, User } from 'lucide-react';
import { TherapistProfile } from '../shared';

const DEFAULT_TASKS = [
    { id: 'reception', title: '၁။ ဧည့်ကြိုနှင့် ဧည့်ခန်းစောင့်တာဝန်', shortName: 'ဧည့်ကြို/ဧည့်ခန်း', iconName: 'Coffee', color: 'text-orange-600', bg: 'bg-orange-50', border: 'border-orange-200', desc: ['ဆိုင်၏ ပထမဆုံး မျက်နှာစာဖြစ်သောကြောင့် အမြဲတမ်း ဖော်ရွေပျူငှာပြီး သန့်ရှင်းသပ်ရပ်နေရန်။', 'ကြိုဆိုခြင်း - ဧည့်သည်များကို အပြုံးဖြင့် နွေးထွေးစွာ ကြိုဆိုရန်။', 'ဧည့်ခန်းတာဝန်ကျသူ တစ်ယောက်သည် အမြဲတမ်း Stand By ရှိရမည်။', 'ဧည့်ခန်းသန့်ရှင်းရေး - ဖုန်ကင်းစင်အောင် နေ့စဉ် သန့်ရှင်းရေးလုပ်ရန်။', 'ဆိုင်ရှေ့မျက်နှာစာ - တံမြက်စည်းလှည်း၊ ရေဆေးချရန်။'] },
    { id: 'water_garbage', title: '၂။ ရေစောင့်တင်ရန်နှင့် အမှိုက်ပစ်တာဝန်', shortName: 'ရေမော်တာ/အမှိုက်', iconName: 'Droplets', color: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-200', desc: ['ရေရရှိမှု စီမံခြင်း - ရေတိုင်ကီများ ပုံမှန်စစ်ဆေးပြီး ရေမော်တာကို အချိန်မှန် ဖွင့်/ပိတ် လုပ်ရန်။', 'အမှိုက်စွန့်ပစ်ခြင်း - အမှိုက်ပုံးကြီးအား နေ့စဉ် စွန့်ပစ်ရန်။'] },
    { id: 'laundry_rooms', title: '၃။ တဘက်/အခင်းလျှော်နှင့် အခန်းသန့်ရှင်းရေး', shortName: 'လျှော်ဖွပ်/သန့်ရှင်းရေး', iconName: 'Bed', color: 'text-purple-600', bg: 'bg-purple-50', border: 'border-purple-200', desc: ['လျှော်ဖွပ်ခြင်း - တဘက်နှင့် အခင်းများကို သန့်စင်အောင် လျှော်ဖွပ်ရန်။', 'အခန်းပြင်ဆင်ခြင်း - မနက်ဆိုင်မဖွင့်မီ အခန်းများကို ရှင်းလင်းရန်။'] },
    { id: 'kitchen_cooking', title: '၄။ မီးဖိုချောင်နှင့် ထမင်းချက်တာဝန်', shortName: 'မီးဖိုချောင်/ထမင်းချက်', iconName: 'ChefHat', color: 'text-red-600', bg: 'bg-red-50', border: 'border-red-200', desc: ['ချက်ပြုတ်ခြင်း - ကျန်းမာရေးနှင့် ညီညွတ်သော အစားအသောက်များကို အချိန်မီ ပြင်ဆင်ချက်ပြုတ်ရန်။', 'မီးဖိုချောင်သန့်ရှင်းရေး - ချက်ပြုတ်ပြီးတိုင်း ဆေးကြောရန်။'] },
    { id: 'bathroom_toilet', title: '၅။ ရေချိုးခန်းနှင့် အိမ်သာ သန့်ရှင်းရေး', shortName: 'ရေချိုးခန်း/အိမ်သာ', iconName: 'Bath', color: 'text-teal-600', bg: 'bg-teal-50', border: 'border-teal-200', desc: ['အမြဲတမ်း ခြောက်သွေ့စေရန် - မနက်တိုင်း ရေချိုးခန်းနှင့် အိမ်သာကြမ်းပြင်များကို ခြောက်သွေ့စေရန်။', 'တိုက်ချွတ်သန့်စင်ခြင်း - နေ့စဉ် စနစ်တကျ တိုက်ချွတ်ဆေးကြောရန်။'] }
];

const ICON_MAP: any = { Coffee, Droplets, Bed, ChefHat, Bath };

export function DutyRosterSystem({ therapists }: { therapists: TherapistProfile[] }) {
    const [assignments, setAssignments] = useState<Record<string, string[]>>({});
    const [lastRotated, setLastRotated] = useState<string>('');
    const [tasks, setTasks] = useState<any[]>(DEFAULT_TASKS);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    
    const [expandedTask, setExpandedTask] = useState<string | null>(null);
    const [editingTask, setEditingTask] = useState<any>(null);
    const [rosterView, setRosterView] = useState<'dashboard' | 'manage'>('dashboard');

    useEffect(() => {
        const fetchRosterData = async () => {
            try {
                const snap = await getDoc(doc(db, 'settings', 'dutyRoster'));
                if (snap.exists()) {
                    setAssignments(snap.data().assignments || {});
                    setLastRotated(snap.data().lastRotated || '');
                    if (snap.data().tasks && snap.data().tasks.length > 0) setTasks(snap.data().tasks);
                }
            } catch (e) { console.error(e); }
            setLoading(false);
        };
        fetchRosterData();
    }, []);

    const handleAutoRotate = () => {
        if (!window.confirm("ဝန်ထမ်းများကို တာဝန်များသို့ အချိုးကျ ကျပန်းခွဲဝေမည် သေချာပါသလား?")) return;
        const prevAssigned: Record<string, string[]> = {};
        Object.keys(assignments).forEach(taskId => {
            assignments[taskId].forEach(staffId => {
                if (!prevAssigned[staffId]) prevAssigned[staffId] = [];
                prevAssigned[staffId].push(taskId);
            });
        });

        let availableStaff = therapists.map(t => t.id);
        for (let i = availableStaff.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [availableStaff[i], availableStaff[j]] = [availableStaff[j], availableStaff[i]];
        }

        const newAssignments: Record<string, string[]> = {};
        tasks.forEach(t => newAssignments[t.id] = []);
        const taskKeys = Object.keys(newAssignments);

        availableStaff.forEach((staffId) => {
            const prevTasksForStaff = prevAssigned[staffId] || [];
            let eligibleTasks = taskKeys.filter(key => !prevTasksForStaff.includes(key));
            if (eligibleTasks.length === 0) eligibleTasks = taskKeys; 
            let minSize = Infinity;
            eligibleTasks.forEach(key => { if (newAssignments[key].length < minSize) minSize = newAssignments[key].length; });
            const candidateTasks = eligibleTasks.filter(key => newAssignments[key].length === minSize);
            const selectedTask = candidateTasks[Math.floor(Math.random() * candidateTasks.length)];
            newAssignments[selectedTask].push(staffId);
        });

        setAssignments(newAssignments);
        setLastRotated(new Date().toISOString().split('T')[0]);
        setRosterView('manage'); // အသစ်ခွဲပြီးလျှင် ပြင်ဆင်ရန် Manage သို့ပြောင်းပေးမည်
    };

    const handleSaveRoster = async () => {
        setSaving(true);
        try {
            await setDoc(doc(db, 'settings', 'dutyRoster'), { 
                assignments, tasks, lastRotated: lastRotated || new Date().toISOString().split('T')[0], updatedAt: Date.now() 
            }, { merge: true });
            alert("✅ တာဝန်များနှင့် ခွဲဝေမှုများ အောင်မြင်စွာ သိမ်းဆည်းပြီးပါပြီ။");
        } catch (error) { alert("Error saving roster."); }
        setSaving(false);
    };

    const handleAssignStaff = (taskId: string, staffId: string) => {
        if (!staffId) return;
        const newAssignments = { ...assignments };
        if (!newAssignments[taskId]) newAssignments[taskId] = [];
        if (!newAssignments[taskId].includes(staffId)) {
            newAssignments[taskId].push(staffId);
            setAssignments(newAssignments);
        }
    };

    const handleRemoveStaff = (taskId: string, staffId: string) => {
        const newAssignments = { ...assignments };
        newAssignments[taskId] = newAssignments[taskId].filter(id => id !== staffId);
        setAssignments(newAssignments);
    };

    const saveEditedTask = () => {
        const updatedTasks = tasks.map(t => t.id === editingTask.id ? editingTask : t);
        setTasks(updatedTasks);
        setEditingTask(null);
    };

    let daysPassed = 0;
    if (lastRotated) {
        const lastD = new Date(lastRotated); const today = new Date();
        daysPassed = Math.floor(Math.abs(today.getTime() - lastD.getTime()) / (1000 * 60 * 60 * 24));
    }

    const allAssignedIds = Object.values(assignments).flat();
    const unassignedTherapists = therapists.filter(t => !allAssignedIds.includes(t.id));

    if (loading) return <div className="p-10 text-center font-bold animate-pulse text-gray-500">Loading Duty Roster...</div>;

    return (
        <div className="bg-white p-4 sm:p-6 rounded-2xl shadow-sm border border-gray-200 relative">
            
            {/* 🌟 Task Edit Modal (Admin ဝင်ပြင်ရန်) 🌟 */}
            {editingTask && (
                <div className="fixed inset-0 z-[99] bg-black/60 flex items-center justify-center p-4">
                    <div className="bg-white p-6 rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] flex flex-col animate-slide-up">
                        <div className="flex justify-between items-center mb-4 border-b pb-3">
                            <h3 className="text-lg font-bold text-[#123524] flex items-center"><Edit className="w-5 h-5 mr-2 text-[#D4AF37]"/> Edit Duty Info</h3>
                            <button onClick={() => setEditingTask(null)} className="text-gray-400 hover:text-red-500"><X className="w-5 h-5"/></button>
                        </div>
                        <div className="flex-1 overflow-y-auto pr-2 space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-gray-500 mb-1 uppercase">Duty Full Title</label>
                                <input type="text" value={editingTask.title} onChange={e => setEditingTask({...editingTask, title: e.target.value})} className="w-full p-2.5 border border-gray-300 rounded-lg outline-none font-bold text-[#123524]" />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-500 mb-1 uppercase">Short Name (For Dashboard Tag)</label>
                                <input type="text" value={editingTask.shortName || editingTask.title} onChange={e => setEditingTask({...editingTask, shortName: e.target.value})} className="w-full p-2.5 border border-gray-300 rounded-lg outline-none font-bold text-gray-600" />
                            </div>
                            <div>
                                <label className="flex justify-between items-center text-xs font-bold text-gray-500 mb-2 uppercase">
                                    <span>Detailed Tasks</span>
                                    <button onClick={() => setEditingTask({...editingTask, desc: [...editingTask.desc, 'တာဝန်အသစ်...']})} className="text-[#D4AF37] flex items-center"><PlusCircle className="w-3.5 h-3.5 mr-1"/> Add Point</button>
                                </label>
                                <div className="space-y-2">
                                    {editingTask.desc.map((d: string, idx: number) => (
                                        <div key={idx} className="flex gap-2 items-start">
                                            <span className="text-xs font-bold text-gray-400 mt-2">{idx+1}.</span>
                                            <textarea value={d} onChange={e => { const newDesc = [...editingTask.desc]; newDesc[idx] = e.target.value; setEditingTask({...editingTask, desc: newDesc}); }} rows={2} className="flex-1 p-2 border border-gray-200 rounded-lg outline-none text-xs font-semibold" />
                                            <button onClick={() => setEditingTask({...editingTask, desc: editingTask.desc.filter((_:any, i:number) => i !== idx)})} className="mt-1 p-1.5 bg-red-50 text-red-500 rounded"><Trash2 className="w-4 h-4"/></button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                        <div className="pt-4 border-t mt-4 flex gap-3">
                            <button onClick={() => setEditingTask(null)} className="flex-1 py-3 bg-gray-100 font-bold rounded-xl text-gray-600 hover:bg-gray-200 transition">Cancel</button>
                            <button onClick={saveEditedTask} className="flex-1 py-3 bg-[#123524] text-[#D4AF37] font-bold rounded-xl hover:bg-[#1a4a32] shadow-md transition">Save Done</button>
                        </div>
                    </div>
                </div>
            )}

            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center mb-6 border-b border-gray-100 pb-4 gap-4">
                <div>
                    <h2 className="text-xl font-bold flex items-center text-[#123524]"><ClipboardList className="w-6 h-6 mr-2 text-[#D4AF37]" /> Staff Duty Roster</h2>
                    {lastRotated && (
                        <div className="mt-2 text-xs font-bold text-gray-500 flex items-center">
                            Last Updated: <span className={`ml-1.5 px-2 py-0.5 rounded border ${daysPassed >= 10 ? 'bg-red-50 text-red-600 border-red-200 animate-pulse' : 'bg-green-50 text-green-700 border-green-200'}`}>{lastRotated} {daysPassed >= 10 && `(Late by ${daysPassed - 10} days)`}</span>
                        </div>
                    )}
                </div>
                
                <div className="flex bg-gray-50 p-1.5 rounded-xl border border-gray-200 w-full sm:w-auto">
                     <button onClick={() => setRosterView('dashboard')} className={`flex-1 sm:flex-none px-4 py-2.5 text-xs font-bold rounded-lg transition-all flex items-center justify-center ${rosterView === 'dashboard' ? 'bg-white shadow text-[#123524] border border-gray-100' : 'text-gray-500 hover:bg-gray-100'}`}><LayoutGrid className="w-4 h-4 mr-1.5"/> Overview Dashboard</button>
                     <button onClick={() => setRosterView('manage')} className={`flex-1 sm:flex-none px-4 py-2.5 text-xs font-bold rounded-lg transition-all flex items-center justify-center ${rosterView === 'manage' ? 'bg-white shadow text-[#123524] border border-gray-100' : 'text-gray-500 hover:bg-gray-100'}`}><Settings className="w-4 h-4 mr-1.5"/> Manage Assignments</button>
                </div>

                {rosterView === 'manage' && (
                    <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto">
                        <button onClick={handleAutoRotate} className="flex-1 lg:flex-none px-3 py-2.5 bg-blue-50 text-blue-700 border border-blue-200 rounded-lg text-xs font-bold flex items-center justify-center shadow-sm hover:bg-blue-100 transition">
                            <RotateCw className="w-4 h-4 mr-1.5" /> Auto Rotate
                        </button>
                        <button onClick={handleSaveRoster} disabled={saving} className="flex-1 lg:flex-none px-4 py-2.5 bg-[#123524] text-[#D4AF37] border border-[#1a4a32] rounded-lg text-xs font-bold flex items-center justify-center shadow-md disabled:opacity-50 hover:bg-[#1a4a32] transition">
                            <Save className="w-4 h-4 mr-1.5" /> Save Roster
                        </button>
                    </div>
                )}
            </div>

           {rosterView === 'dashboard' ? (
                /* 🌟 OVERVIEW DASHBOARD VIEW (Task-Centric) 🌟 */
                <div className="animate-fade-in space-y-6">
                    <div className="flex justify-between items-center mb-2">
                        <h3 className="text-sm font-bold text-gray-700 flex items-center"><ClipboardList className="w-4 h-4 mr-1.5 text-[#D4AF37]"/> Duty Assignments Overview</h3>
                        <div className="text-[10px] font-bold flex gap-2">
                            <span className="text-green-600 bg-green-50 px-2 py-1 rounded border border-green-100">Assigned Staff: {therapists.length - unassignedTherapists.length}</span>
                            {unassignedTherapists.length > 0 && <span className="text-red-600 bg-red-50 px-2 py-1 rounded border border-red-100">Unassigned: {unassignedTherapists.length}</span>}
                        </div>
                    </div>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                        {tasks.map(task => {
                            const assignedStaffIds = assignments[task.id] || [];
                            const IconComp = ICON_MAP[task.iconName] || Coffee;

                            return (
                                <div key={task.id} className={`p-5 rounded-2xl border flex flex-col ${task.bg} ${task.border} shadow-sm transition-all hover:shadow-md`}>
                                    <div className="flex items-start mb-4">
                                        <div className={`w-10 h-10 rounded-full flex items-center justify-center mr-3 bg-white shadow-sm border ${task.border} flex-shrink-0`}>
                                            <IconComp className={`w-5 h-5 ${task.color}`} />
                                        </div>
                                        <div className="flex-1 pt-0.5">
                                            <h4 className={`font-bold text-sm leading-snug ${task.color}`}>{task.title}</h4>
                                        </div>
                                    </div>
                                    
                                    <div className="w-full h-px bg-black/5 mb-4"></div>
                                    
                                    <div className="flex flex-col gap-2.5 flex-1">
                                        {assignedStaffIds.length === 0 ? (
                                            <div className="flex-1 flex items-center justify-center border-2 border-dashed border-gray-300/50 rounded-xl bg-white/50 p-4">
                                                <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">No Staff Assigned</span>
                                            </div>
                                        ) : (
                                            assignedStaffIds.map(staffId => {
                                                const t = therapists.find(th => th.id === staffId);
                                                return (
                                                    <div key={staffId} className="flex items-center bg-white px-3.5 py-2.5 rounded-xl shadow-sm border border-white/60">
                                                        <div className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center mr-3 border border-gray-200 flex-shrink-0">
                                                            <User className="w-4 h-4 text-gray-500" />
                                                        </div>
                                                        <span className="text-xs font-bold text-gray-800">{t ? t.name : staffId}</span>
                                                    </div>
                                                );
                                            })
                                        )}
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                </div>
            ) : (
                /* 🌟 MANAGE ROSTER VIEW 🌟 */
                <div className="animate-fade-in space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {tasks.map(task => {
                            const assignedStaffIds = assignments[task.id] || [];
                            const IconComp = ICON_MAP[task.iconName] || Coffee;

                            return (
                                <div key={task.id} className={`rounded-xl border ${task.border} shadow-sm flex flex-col bg-white hover:shadow-md transition-shadow`}>
                                    <div className={`${task.bg} p-4 border-b ${task.border} flex justify-between items-start`}>
                                        <div className="flex items-start flex-1 cursor-pointer" onClick={() => setExpandedTask(expandedTask === task.id ? null : task.id)}>
                                            <IconComp className={`w-5 h-5 mr-2 mt-0.5 ${task.color}`} />
                                            <h3 className={`font-bold text-sm ${task.color}`}>{task.title}</h3>
                                        </div>
                                        <div className="flex gap-1 ml-2">
                                            <button onClick={() => setEditingTask(JSON.parse(JSON.stringify(task)))} className="p-1.5 bg-white/60 hover:bg-white rounded-md text-gray-500 shadow-sm transition" title="Edit Texts"><Edit className="w-3.5 h-3.5"/></button>
                                        </div>
                                    </div>

                                    {expandedTask === task.id && (
                                        <div className="p-4 bg-gray-50 border-b border-gray-100 text-[11px] leading-relaxed text-gray-600 font-semibold animate-fade-in shadow-inner">
                                            <ul className="space-y-1.5">{task.desc.map((d:string, i:number) => <li key={i} className="flex items-start"><span className="mr-1.5 mt-0.5">•</span><span>{d}</span></li>)}</ul>
                                        </div>
                                    )}

                                    <div className="p-4 flex-1 flex flex-col">
                                        <div className="flex-1 mb-4 flex flex-wrap gap-2">
                                            {assignedStaffIds.length === 0 ? (
                                                <div className="w-full text-[10px] text-gray-400 font-bold uppercase tracking-wider text-center py-6 border-2 border-dashed border-gray-100 rounded-lg">No Staff Assigned</div>
                                            ) : (
                                                assignedStaffIds.map(staffId => {
                                                    const t = therapists.find(th => th.id === staffId);
                                                    return (
                                                        <div key={staffId} className="bg-gray-100 px-3 py-1.5 rounded-lg text-xs font-bold flex items-center shadow-sm border border-gray-200">
                                                            <Users className="w-3 h-3 mr-1.5 text-gray-500"/> {t ? t.name : staffId}
                                                            <button onClick={() => handleRemoveStaff(task.id, staffId)} className="ml-2 text-red-400 hover:text-red-600 bg-white rounded-full p-0.5 shadow-sm transition-colors"><X className="w-3 h-3"/></button>
                                                        </div>
                                                    );
                                                })
                                            )}
                                        </div>
                                        <select className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-lg text-xs font-bold outline-none focus:border-[#D4AF37] text-gray-700 shadow-sm" onChange={(e) => { handleAssignStaff(task.id, e.target.value); e.target.value = ''; }} defaultValue="">
                                            <option value="" disabled>+ Add Staff to this Duty</option>
                                            {therapists.map(t => (<option key={t.id} value={t.id}>{t.name}</option>))}
                                        </select>
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    {unassignedTherapists.length > 0 && (
                        <div className="mt-8 pt-6 border-t border-red-100 animate-fade-in bg-red-50/30 p-4 rounded-xl">
                            <h4 className="text-xs font-bold text-red-500 uppercase tracking-wider mb-3 flex items-center"><Info className="w-4 h-4 mr-1.5"/> Unassigned Staff (တာဝန်မချရသေးသူများ)</h4>
                            <div className="flex flex-wrap gap-2">
                                {unassignedTherapists.map(t => (<span key={t.id} className="bg-white text-red-600 px-3 py-1.5 rounded-lg text-xs font-bold border border-red-200 shadow-sm flex items-center"><User className="w-3 h-3 mr-1.5 text-red-400"/>{t.name}</span>))}
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
