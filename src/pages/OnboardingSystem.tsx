import React, { useState, useEffect } from 'react';
import { collection, addDoc, updateDoc, doc, onSnapshot, query, orderBy, deleteDoc, setDoc } from 'firebase/firestore';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { db, secondaryAuth } from '../firebase';
import { compressImage } from '../shared';
import { encryptText } from '../security';
import { UserPlus, FileText, CheckCircle, Clock, X, Save, Image as ImageIcon, ChevronLeft, ShieldCheck, Trash2, Edit, User, FileWarning } from 'lucide-react';

const JOB_POSITIONS = ['Professional Therapist', 'Receptionist', 'Manager', 'Cleaner', 'Security'];
const DOC_CHECKLIST = ['နိုင်ငံသားမှတ်ပုံတင်(မူရင်း) အပ်ပြီးပါပြီ', 'အိမ်ထောင်စုဇယား(မိတ္တူ) အပ်ပြီးပါပြီ', 'ရပ်ကွက်ရဲစခန်း ထောက်ခံစာ အပ်ပြီးပါပြီ'];
const RULES_LIST = [
    'မိမိလုပ်ရမည့် အလုပ်တာဝန်များနှင့် လုပ်ငန်းသဘောသဘာဝများကို သေချာသိရှိနားလည်ပါသည်။',
    'သိရှိနားလည်ထားသည့်အတိုင်း မိမိဆန္ဒအလျောက် အလုပ်လုပ်ရန် သဘောတူလက်ခံပါသည်။',
    'ဆိုင်မှ ချမှတ်ထားသော စည်းမျဉ်းစည်းကမ်းများအားလုံးကိုလည်း သိရှိနားလည် သဘောတူလက်ခံပါသည်။'
];

// 🌟 1. Staff Application Form Component 🌟
export function NewEmployeeOnboardingForm({ onBack, existingStaffId = null, existingData = null, isStaffSelfEdit = false }: { onBack: () => void, existingStaffId?: string | null, existingData?: any, isStaffSelfEdit?: boolean }) {
    
    const [formData, setFormData] = useState(() => {
        if (existingData) return { ...existingData, staffId: existingStaffId || existingData.staffId || '' };
        return {
            staffId: existingStaffId || `No-${Math.floor(Math.random() * 900) + 100}`,
            fullName: '', nrcNumber: '', dob: '', phone: '', address: '',
            emergencyName: '', emergencyPhone: '', emergencyRelation: '',
            jobPosition: '', startDate: '',
            nrcFrontUrl: '', nrcBackUrl: '', householdFrontUrl: '', householdBackUrl: '',
            documents: [] as string[], rules: [] as string[]
        };
    });
    
    const [loading, setLoading] = useState(false);
    const [uploadingInfo, setUploadingInfo] = useState('');

    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>, field: 'nrcFrontUrl' | 'nrcBackUrl' | 'householdFrontUrl' | 'householdBackUrl') => {
        const file = e.target.files?.[0]; if (!file) return;
        setUploadingInfo('Uploading Image...');
        try { const base64 = await compressImage(file, 800, 1000); setFormData({ ...formData, [field]: base64 }); } 
        catch (err) { alert("Image upload failed."); }
        setUploadingInfo('');
    };

    const isFormValid = () => {
        return (
            formData.fullName.trim() !== '' &&
            formData.nrcNumber.trim() !== '' &&
            formData.nrcFrontUrl !== '' && formData.nrcBackUrl !== '' &&
            formData.householdFrontUrl !== '' && formData.householdBackUrl !== '' &&
            formData.dob !== '' && formData.phone.trim() !== '' && formData.address.trim() !== '' &&
            formData.emergencyName.trim() !== '' && formData.emergencyPhone.trim() !== '' && formData.emergencyRelation.trim() !== '' &&
            formData.jobPosition !== '' && formData.startDate !== '' &&
            formData.documents.length === DOC_CHECKLIST.length &&
            formData.rules.length === RULES_LIST.length
        );
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!isFormValid()) return alert("ကျေးဇူးပြု၍ လိုအပ်သော အချက်အလက်နှင့် ပုံအားလုံးကို ပြည့်စုံစွာ ထည့်သွင်းပေးပါ။");
        
        setLoading(true);
        try {
            if (existingStaffId) {
                // Staff က ကိုယ်တိုင် Profile လာဖြည့်တာဆိုရင် therapists collection ထဲမှာ update လုပ်မယ်
                await updateDoc(doc(db, 'therapists', existingStaffId), { onboardingData: formData });
                alert("✅ ဝန်ထမ်းအချက်အလက် ဖြည့်သွင်းခြင်း အောင်မြင်ပါသည်။");
            } else {
                await addDoc(collection(db, 'onboarding_requests'), { ...formData, status: 'pending', createdAt: Date.now() });
                alert("✅ လျှောက်လွှာတင်ခြင်း အောင်မြင်ပါသည်။ Admin မှ အတည်ပြုပြီးပါက အကြောင်းကြားပေးပါမည်။");
            }
            onBack();
        } catch (error) { alert("Error submitting form."); }
        setLoading(false);
    };

    if (isStaffSelfEdit && existingData) {
        return (
            <div className="bg-gray-50 min-h-[100dvh] w-full fixed inset-0 z-[100] flex items-center justify-center p-4">
                <div className="bg-white p-8 rounded-2xl shadow-xl text-center max-w-sm w-full animate-slide-up">
                    <FileWarning className="w-16 h-16 text-yellow-500 mx-auto mb-4" />
                    <h2 className="text-lg font-bold text-gray-800 mb-2">Access Denied</h2>
                    <p className="text-xs text-gray-500 mb-6 leading-relaxed">သင်၏ အချက်အလက်များကို ဖြည့်သွင်းပြီးဖြစ်ပါသည်။ ထပ်မံပြင်ဆင်လိုပါက Admin သို့ Request လုပ်ပြီးမှသာ ပြင်ဆင်နိုင်ပါမည်။</p>
                    <button onClick={onBack} className="w-full py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-xl transition">Go Back</button>
                </div>
            </div>
        );
    }

    return (
        <div className="bg-gray-50 min-h-[100dvh] w-full fixed inset-0 z-[100] flex flex-col">
            <div className="bg-[#D4AF37] p-4 flex items-center shadow-md flex-shrink-0">
                <button type="button" onClick={onBack} className="text-white hover:bg-white/20 p-2 rounded-full transition"><ChevronLeft className="w-6 h-6"/></button>
                <h2 className="text-[#123524] font-bold text-lg ml-2 uppercase tracking-wider">{existingStaffId ? 'Add Your Profile Info' : 'New Employee Onboarding'}</h2>
            </div>
            
            <div className="flex-1 overflow-y-auto pb-36">
                <form id="onboardingForm" onSubmit={handleSubmit} className="max-w-xl mx-auto p-4 space-y-6 animate-slide-up">
                    
                    {existingStaffId && (
                        <div className="bg-blue-50 text-blue-800 p-4 rounded-xl border border-blue-200 text-xs font-bold shadow-sm">
                            <span className="block mb-1 text-blue-600 uppercase tracking-widest text-[9px]">Important Notice</span>
                            ဤအချက်အလက်များကို တစ်ကြိမ်သာ ဖြည့်သွင်းခွင့်ရှိပါသည်။ ဖြည့်သွင်းပြီးပါက Admin ထံ ခွင့်ပြုချက်တောင်းပြီးမှသာ ပြန်လည်ပြင်ဆင်နိုင်မည်ဖြစ်သဖြင့် သေချာစွာစစ်ဆေးပြီးမှ Submit လုပ်ပါ။
                        </div>
                    )}

                    <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-200 space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div><label className="block text-xs font-bold text-gray-500 mb-1">Employee ID *</label><input required type="text" value={formData.staffId} disabled className="w-full p-3 bg-gray-100 border border-gray-200 rounded-lg outline-none font-bold text-gray-500 opacity-80 cursor-not-allowed" /></div>
                            <div><label className="block text-xs font-bold text-gray-500 mb-1">Full Name (အမည်ရင်း) *</label><input required type="text" value={formData.fullName} onChange={e=>setFormData({...formData, fullName: e.target.value})} placeholder="Enter actual name" className="w-full p-3 bg-gray-50 border border-gray-200 rounded-lg outline-none focus:border-[#D4AF37] font-semibold text-gray-800" /></div>
                        </div>
                        <div><label className="block text-xs font-bold text-gray-500 mb-1">မှတ်ပုံတင်နံပါတ် *</label><input required type="text" value={formData.nrcNumber} onChange={e=>setFormData({...formData, nrcNumber: e.target.value})} placeholder="Please enter" className="w-full p-3 bg-gray-50 border border-gray-200 rounded-lg outline-none focus:border-[#D4AF37] font-semibold text-gray-800" /></div>
                        
                        <div className="grid grid-cols-2 gap-4">
                            <label className={`border-2 border-dashed rounded-xl p-4 flex flex-col items-center justify-center hover:bg-gray-50 cursor-pointer h-32 relative overflow-hidden ${!formData.nrcFrontUrl ? 'border-red-300 bg-red-50/30' : 'border-gray-300'}`}>
                                {formData.nrcFrontUrl ? <img src={formData.nrcFrontUrl} className="absolute inset-0 w-full h-full object-cover" alt="NRC Front"/> : <><ImageIcon className="w-6 h-6 mb-2 text-red-400"/><span className="text-[10px] font-bold text-center text-red-500">မှတ်ပုံတင်<br/>(ရှေ့ဘက်) *</span></>}
                                <input type="file" accept="image/*" className="hidden" onChange={(e) => handleImageUpload(e, 'nrcFrontUrl')} />
                            </label>
                            <label className={`border-2 border-dashed rounded-xl p-4 flex flex-col items-center justify-center hover:bg-gray-50 cursor-pointer h-32 relative overflow-hidden ${!formData.nrcBackUrl ? 'border-red-300 bg-red-50/30' : 'border-gray-300'}`}>
                                {formData.nrcBackUrl ? <img src={formData.nrcBackUrl} className="absolute inset-0 w-full h-full object-cover" alt="NRC Back"/> : <><ImageIcon className="w-6 h-6 mb-2 text-red-400"/><span className="text-[10px] font-bold text-center text-red-500">မှတ်ပုံတင်<br/>(နောက်ဘက်) *</span></>}
                                <input type="file" accept="image/*" className="hidden" onChange={(e) => handleImageUpload(e, 'nrcBackUrl')} />
                            </label>
                            <label className={`border-2 border-dashed rounded-xl p-4 flex flex-col items-center justify-center hover:bg-gray-50 cursor-pointer h-32 relative overflow-hidden ${!formData.householdFrontUrl ? 'border-red-300 bg-red-50/30' : 'border-gray-300'}`}>
                                {formData.householdFrontUrl ? <img src={formData.householdFrontUrl} className="absolute inset-0 w-full h-full object-cover" alt="Household Front"/> : <><ImageIcon className="w-6 h-6 mb-2 text-red-400"/><span className="text-[10px] font-bold text-center text-red-500">အိမ်ထောင်စု<br/>(ရှေ့ဘက်) *</span></>}
                                <input type="file" accept="image/*" className="hidden" onChange={(e) => handleImageUpload(e, 'householdFrontUrl')} />
                            </label>
                            <label className={`border-2 border-dashed rounded-xl p-4 flex flex-col items-center justify-center hover:bg-gray-50 cursor-pointer h-32 relative overflow-hidden ${!formData.householdBackUrl ? 'border-red-300 bg-red-50/30' : 'border-gray-300'}`}>
                                {formData.householdBackUrl ? <img src={formData.householdBackUrl} className="absolute inset-0 w-full h-full object-cover" alt="Household Back"/> : <><ImageIcon className="w-6 h-6 mb-2 text-red-400"/><span className="text-[10px] font-bold text-center text-red-500">အိမ်ထောင်စု<br/>(နောက်ဘက်) *</span></>}
                                <input type="file" accept="image/*" className="hidden" onChange={(e) => handleImageUpload(e, 'householdBackUrl')} />
                            </label>
                        </div>
                        {uploadingInfo && <div className="text-[10px] text-[#D4AF37] font-bold animate-pulse text-center">{uploadingInfo}</div>}

                        <div><label className="block text-xs font-bold text-gray-500 mb-1">မွေးသက္ကရာဇ် *</label><input required type="date" value={formData.dob} onChange={e=>setFormData({...formData, dob: e.target.value})} className="w-full p-3 bg-gray-50 border border-gray-200 rounded-lg outline-none focus:border-[#D4AF37] font-semibold text-gray-800" /></div>
                        <div><label className="block text-xs font-bold text-gray-500 mb-1">ဆက်သွယ်ရန်ဖုန်း *</label><input required type="tel" value={formData.phone} onChange={e=>setFormData({...formData, phone: e.target.value})} placeholder="Please enter" className="w-full p-3 bg-gray-50 border border-gray-200 rounded-lg outline-none focus:border-[#D4AF37] font-semibold text-gray-800" /></div>
                        <div><label className="block text-xs font-bold text-gray-500 mb-1">မွေးရပ်ဇာတိ / နေရပ်လိပ်စာ *</label><textarea required value={formData.address} onChange={e=>setFormData({...formData, address: e.target.value})} rows={2} placeholder="Please enter" className="w-full p-3 bg-gray-50 border border-gray-200 rounded-lg outline-none focus:border-[#D4AF37] font-semibold text-gray-800" /></div>
                        <div><label className="block text-xs font-bold text-gray-500 mb-1">အရေးပေါ်ဆက်သွယ်ရန်လူ *</label><input required type="text" value={formData.emergencyName} onChange={e=>setFormData({...formData, emergencyName: e.target.value})} placeholder="Please enter" className="w-full p-3 bg-gray-50 border border-gray-200 rounded-lg outline-none focus:border-[#D4AF37] font-semibold text-gray-800" /></div>
                        <div className="grid grid-cols-2 gap-4">
                            <div><label className="block text-xs font-bold text-gray-500 mb-1">ထိုလူ၏ဖုန်းနံပါတ် *</label><input required type="tel" value={formData.emergencyPhone} onChange={e=>setFormData({...formData, emergencyPhone: e.target.value})} placeholder="Please enter" className="w-full p-3 bg-gray-50 border border-gray-200 rounded-lg outline-none focus:border-[#D4AF37] font-semibold text-gray-800" /></div>
                            <div><label className="block text-xs font-bold text-gray-500 mb-1">တော်စပ်ပုံ *</label><input required type="text" value={formData.emergencyRelation} onChange={e=>setFormData({...formData, emergencyRelation: e.target.value})} placeholder="Please enter" className="w-full p-3 bg-gray-50 border border-gray-200 rounded-lg outline-none focus:border-[#D4AF37] font-semibold text-gray-800" /></div>
                        </div>
                    </div>

                    <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-200 space-y-4">
                        <div>
                            <label className="block text-xs font-bold text-gray-500 mb-1">အလုပ်ဝင်သည့်ရာထူး *</label>
                            <select required value={formData.jobPosition} onChange={e=>setFormData({...formData, jobPosition: e.target.value})} className="w-full p-3 bg-gray-50 border border-gray-200 rounded-lg outline-none focus:border-[#D4AF37] font-semibold text-gray-800">
                                <option value="" disabled>Please choose</option>
                                {JOB_POSITIONS.map(pos => <option key={pos} value={pos}>{pos}</option>)}
                            </select>
                        </div>
                        <div><label className="block text-xs font-bold text-gray-500 mb-1">အလုပ်စဝင်သည့်ရက် *</label><input required type="date" value={formData.startDate} onChange={e=>setFormData({...formData, startDate: e.target.value})} className="w-full p-3 bg-gray-50 border border-gray-200 rounded-lg outline-none focus:border-[#D4AF37] font-semibold text-gray-800" /></div>
                        
                        <div className="pt-2">
                            <label className="block text-xs font-bold text-gray-500 mb-2">Document Check List *</label>
                            {DOC_CHECKLIST.map((doc, idx) => (
                                <label key={idx} className="flex items-start space-x-3 mb-2 cursor-pointer">
                                    <input type="checkbox" checked={formData.documents.includes(doc)} onChange={(e) => {
                                        const newDocs = e.target.checked ? [...formData.documents, doc] : formData.documents.filter(d => d !== doc);
                                        setFormData({...formData, documents: newDocs});
                                    }} className="mt-1 w-4 h-4 accent-[#123524]" />
                                    <span className="text-xs font-semibold text-gray-700 leading-relaxed">{doc}</span>
                                </label>
                            ))}
                        </div>

                        <div className="pt-2 border-t border-gray-100">
                            <label className="block text-xs font-bold text-[#123524] mb-2">Rules & Regulations Acknowledgment *</label>
                            {RULES_LIST.map((rule, idx) => (
                                <label key={idx} className="flex items-start space-x-3 mb-2 cursor-pointer bg-gray-50 p-2 rounded-lg border border-gray-100">
                                    <input type="checkbox" checked={formData.rules.includes(rule)} onChange={(e) => {
                                        const newRules = e.target.checked ? [...formData.rules, rule] : formData.rules.filter(r => r !== rule);
                                        setFormData({...formData, rules: newRules});
                                    }} className="mt-1 w-4 h-4 accent-[#D4AF37]" />
                                    <span className="text-[11px] font-semibold text-gray-700 leading-relaxed">{rule}</span>
                                </label>
                            ))}
                        </div>
                    </div>
                </form>
            </div>

            {/* 🌟 Fixed Bottom Submit Button 🌟 */}
            <div className="fixed bottom-0 left-0 right-0 px-4 pb-4 pt-3 bg-white border-t border-gray-200 shadow-[0_-8px_15px_-3px_rgba(0,0,0,0.08)] z-50">
                <div className="max-w-xl mx-auto">
                    {/* 🌟 သတိပေးစာသား အနီရောင် Bold 🌟 */}
                    <p className="text-[9px] text-red-600 text-center font-black mb-2.5 leading-relaxed tracking-wide">
                        ဖြည့်သွင်းထားသောအချက်လက်များအားလုံးအား ပြည့်စုံမှန်ကန်ခြင်း ရှိ/မရှိ<br/>သေချာစွာပြန်လည်စစ်ဆေးပြီးပါက အောက်မှ တင်သွင်းသည့်ခလုတ်ကိုနှိပ်ပါ။
                    </p>
                    <button
                        type="submit" 
                        form="onboardingForm" 
                        disabled={loading || !isFormValid()} 
                        className={`w-full py-4 rounded-xl font-bold shadow-md flex items-center justify-center transition ${isFormValid() ? 'bg-[#123524] text-[#D4AF37] hover:bg-[#1a4a32] hover:shadow-lg' : 'bg-gray-200 text-gray-400 cursor-not-allowed'}`}
                    >
                        <Save className="w-5 h-5 mr-2" /> 
                        {loading ? 'Saving Data...' : (!isFormValid() ? 'Please fill all required fields' : 'Submit All Informations Now')}
                    </button>
                </div>
            </div>
        </div>
    );
}

// 🌟 2. Admin HR Management Component 🌟
export function AdminHRManagement() {
    const [requests, setRequests] = useState<any[]>([]);
    const [activeStaff, setActiveStaff] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    
    const [selectedReq, setSelectedReq] = useState<any>(null); 
    const [viewingProfile, setViewingProfile] = useState<any>(null); 
    
    const [addingInfoForId, setAddingInfoForId] = useState<string | null>(null); 
    const [addingInfoData, setAddingInfoData] = useState<any>(null); 

    const [approvalForm, setApprovalForm] = useState({ password: '', displayTherapistName: '' });
    const [processing, setProcessing] = useState(false);
    const [viewTab, setViewTab] = useState<'requests' | 'active'>('requests');

    useEffect(() => {
        const unsubReq = onSnapshot(query(collection(db, 'onboarding_requests'), orderBy('createdAt', 'desc')), snap => {
            const arr: any[] = []; snap.forEach(d => arr.push({ id: d.id, ...d.data() })); setRequests(arr); setLoading(false);
        });
        const unsubStaff = onSnapshot(query(collection(db, 'therapists'), orderBy('order', 'asc')), snap => {
            const arr: any[] = []; snap.forEach(d => arr.push({ id: d.id, ...d.data() })); setActiveStaff(arr);
        });
        return () => { unsubReq(); unsubStaff(); };
    }, []);

    const handleApprove = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedReq.staffId || !approvalForm.password || !approvalForm.displayTherapistName) return alert("ကျေးဇူးပြု၍ အချက်အလက်များ ပြည့်စုံစွာ ထည့်ပါ။");
        setProcessing(true);
        try {
            const safeEmail = `${selectedReq.staffId.replace(/\s+/g, '').toLowerCase()}@shangrila.com`;
            try { await createUserWithEmailAndPassword(secondaryAuth, safeEmail, approvalForm.password); } catch(e){}
            
            await setDoc(doc(db, 'therapists', selectedReq.staffId), {
                id: selectedReq.staffId,
                name: approvalForm.displayTherapistName, 
                password: encryptText(approvalForm.password), 
                order: activeStaff.length,
                images: [],
                onboardingData: selectedReq 
            });
            await updateDoc(doc(db, 'onboarding_requests', selectedReq.id), { status: 'approved', assignedId: selectedReq.staffId, approvedAt: Date.now() });
            alert("✅ ဝန်ထမ်းသစ် အတည်ပြုပြီးပါပြီ။");
            setSelectedReq(null);
        } catch (error) { alert("Error approving staff."); }
        setProcessing(false);
    };

    const handleReject = async (id: string) => {
        if (!window.confirm("ဤလျှောက်လွှာကို ပယ်ဖျက်မည် သေချာပါသလား?")) return;
        await updateDoc(doc(db, 'onboarding_requests', id), { status: 'rejected' });
        setSelectedReq(null);
    };

    const handleRemoveStaff = async (id: string) => {
        if (!window.confirm("ဤဝန်ထမ်းကို စာရင်းမှ ဖယ်ရှားမည် (Resigned) သေချာပါသလား?")) return;
        await deleteDoc(doc(db, 'therapists', id));
    };

    const handlePermanentDelete = async (id: string, reqId?: string) => {
        if (!window.confirm("သတိပြုရန်: ဤဝန်ထမ်း၏ အချက်အလက်များကို Database မှ အပြီးတိုင် ဖျက်ပစ်မည် သေချာပါသလား? (ပြန်ယူ၍မရနိုင်ပါ)")) return;
        try {
            await deleteDoc(doc(db, 'therapists', id));
            if (reqId) {
                try { await deleteDoc(doc(db, 'onboarding_requests', reqId)); } catch(e){}
            }
            alert("✅ ဝန်ထမ်းအချက်အလက်များ အပြီးတိုင် ဖျက်ပစ်ပြီးပါပြီ။");
        } catch(e) {
            alert("Error deleting staff data.");
        }
    };

    if (loading) return <div className="text-center py-20 text-gray-500 font-bold animate-pulse">Loading HR Data...</div>;

    const pendingReqs = requests.filter(r => r.status === 'pending');

    return (
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
            
            {selectedReq && (
                <div className="fixed inset-0 z-[99] bg-black/60 flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col animate-slide-up">
                        <div className="p-4 border-b flex justify-between items-center bg-[#123524] text-white rounded-t-2xl">
                            <h3 className="font-bold flex items-center"><FileText className="w-5 h-5 mr-2 text-[#D4AF37]"/> Application Review</h3>
                            <button onClick={() => setSelectedReq(null)} className="hover:text-red-400"><X className="w-5 h-5"/></button>
                        </div>
                        <div className="p-6 overflow-y-auto space-y-6 flex-1 bg-gray-50">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="bg-white p-3 rounded-xl shadow-sm border border-gray-100"><span className="text-[10px] text-gray-400 block uppercase">Employee ID</span><span className="font-bold text-[#123524]">{selectedReq.staffId}</span></div>
                                <div className="bg-white p-3 rounded-xl shadow-sm border border-gray-100"><span className="text-[10px] text-gray-400 block uppercase">Actual Name (အမည်ရင်း)</span><span className="font-bold text-gray-800">{selectedReq.fullName}</span></div>
                                <div className="bg-white p-3 rounded-xl shadow-sm border border-gray-100"><span className="text-[10px] text-gray-400 block uppercase">Position</span><span className="font-bold text-blue-600">{selectedReq.jobPosition}</span></div>
                                <div className="bg-white p-3 rounded-xl shadow-sm border border-gray-100"><span className="text-[10px] text-gray-400 block uppercase">Phone</span><span className="font-bold text-gray-800">{selectedReq.phone}</span></div>
                                <div className="col-span-2 bg-white p-3 rounded-xl shadow-sm border border-gray-100"><span className="text-[10px] text-gray-400 block uppercase">Address</span><span className="font-bold text-gray-800">{selectedReq.address}</span></div>
                            </div>
                            
                            <div className="grid grid-cols-2 gap-4">
                                <div><span className="text-[10px] text-gray-400 block uppercase mb-1">NRC (Front)</span>{selectedReq.nrcFrontUrl ? <img src={selectedReq.nrcFrontUrl} className="w-full h-32 object-cover rounded-xl border border-gray-200"/> : <div className="h-32 bg-gray-200 rounded-xl flex items-center justify-center text-[10px] text-gray-400">No Image</div>}</div>
                                <div><span className="text-[10px] text-gray-400 block uppercase mb-1">NRC (Back)</span>{selectedReq.nrcBackUrl ? <img src={selectedReq.nrcBackUrl} className="w-full h-32 object-cover rounded-xl border border-gray-200"/> : <div className="h-32 bg-gray-200 rounded-xl flex items-center justify-center text-[10px] text-gray-400">No Image</div>}</div>
                                <div><span className="text-[10px] text-gray-400 block uppercase mb-1">Household (Front)</span>{selectedReq.householdFrontUrl ? <img src={selectedReq.householdFrontUrl} className="w-full h-32 object-cover rounded-xl border border-gray-200"/> : <div className="h-32 bg-gray-200 rounded-xl flex items-center justify-center text-[10px] text-gray-400">No Image</div>}</div>
                                <div><span className="text-[10px] text-gray-400 block uppercase mb-1">Household (Back)</span>{selectedReq.householdBackUrl ? <img src={selectedReq.householdBackUrl} className="w-full h-32 object-cover rounded-xl border border-gray-200"/> : <div className="h-32 bg-gray-200 rounded-xl flex items-center justify-center text-[10px] text-gray-400">No Image</div>}</div>
                            </div>

                            <form onSubmit={handleApprove} className="bg-[#123524]/5 p-5 rounded-xl border border-[#123524]/20 space-y-4">
                                <h4 className="font-bold text-[#123524] text-sm mb-2 border-b border-[#123524]/10 pb-2">Assign Login Credentials & Roles</h4>
                                <div><label className="block text-xs font-bold text-gray-600 mb-1">Display Therapist Name (Customer များမြင်ရမည့်အမည်)</label><input required type="text" placeholder="e.g. Therapist No-10" value={approvalForm.displayTherapistName} onChange={e=>setApprovalForm({...approvalForm, displayTherapistName: e.target.value})} className="w-full p-2 border border-gray-300 rounded focus:border-[#D4AF37] outline-none font-bold text-blue-700" /></div>
                                <div><label className="block text-xs font-bold text-gray-600 mb-1">Set Password (Login ID is {selectedReq.staffId})</label><input required type="text" placeholder="Min 6 chars" minLength={6} value={approvalForm.password} onChange={e=>setApprovalForm({...approvalForm, password: e.target.value})} className="w-full p-2 border border-gray-300 rounded focus:border-[#D4AF37] outline-none font-bold" /></div>
                                <div className="flex gap-3 pt-2">
                                    <button type="button" onClick={() => handleReject(selectedReq.id)} className="flex-1 py-3 bg-red-50 text-red-600 font-bold rounded-lg hover:bg-red-100">Reject Request</button>
                                    <button type="submit" disabled={processing} className="flex-1 py-3 bg-[#123524] text-[#D4AF37] font-bold rounded-lg hover:bg-[#1a4a32] shadow-md">{processing ? 'Approving...' : 'Approve & Create Account'}</button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            )}

            {viewingProfile && (
                <div className="fixed inset-0 z-[99] bg-black/60 flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col animate-slide-up">
                        <div className="p-4 border-b flex justify-between items-center bg-blue-900 text-white rounded-t-2xl">
                            <h3 className="font-bold flex items-center"><User className="w-5 h-5 mr-2 text-blue-300"/> Staff Profile Viewer</h3>
                            <button onClick={() => setViewingProfile(null)} className="hover:text-red-400"><X className="w-5 h-5"/></button>
                        </div>
                        <div className="p-6 overflow-y-auto space-y-6 flex-1 bg-gray-50">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="bg-white p-3 rounded-xl shadow-sm border border-gray-100"><span className="text-[10px] text-gray-400 block uppercase">Employee ID</span><span className="font-bold text-[#123524]">{viewingProfile.staffId}</span></div>
                                <div className="bg-white p-3 rounded-xl shadow-sm border border-gray-100"><span className="text-[10px] text-gray-400 block uppercase">Actual Name (အမည်ရင်း)</span><span className="font-bold text-[#123524]">{viewingProfile.fullName}</span></div>
                                <div className="bg-white p-3 rounded-xl shadow-sm border border-gray-100"><span className="text-[10px] text-gray-400 block uppercase">Position</span><span className="font-bold text-blue-600">{viewingProfile.jobPosition}</span></div>
                                <div className="bg-white p-3 rounded-xl shadow-sm border border-gray-100"><span className="text-[10px] text-gray-400 block uppercase">Phone</span><span className="font-bold text-gray-800">{viewingProfile.phone}</span></div>
                                <div className="bg-white p-3 rounded-xl shadow-sm border border-gray-100"><span className="text-[10px] text-gray-400 block uppercase">NRC</span><span className="font-bold text-gray-800">{viewingProfile.nrcNumber}</span></div>
                                <div className="col-span-2 bg-white p-3 rounded-xl shadow-sm border border-gray-100"><span className="text-[10px] text-gray-400 block uppercase">Address</span><span className="font-bold text-gray-800">{viewingProfile.address}</span></div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div><span className="text-[10px] text-gray-400 block uppercase mb-1">NRC (Front)</span>{viewingProfile.nrcFrontUrl ? <img src={viewingProfile.nrcFrontUrl} className="w-full h-32 object-cover rounded-xl border border-gray-200"/> : <div className="h-32 bg-gray-200 rounded-xl flex items-center justify-center text-[10px] text-gray-400">No Image</div>}</div>
                                <div><span className="text-[10px] text-gray-400 block uppercase mb-1">NRC (Back)</span>{viewingProfile.nrcBackUrl ? <img src={viewingProfile.nrcBackUrl} className="w-full h-32 object-cover rounded-xl border border-gray-200"/> : <div className="h-32 bg-gray-200 rounded-xl flex items-center justify-center text-[10px] text-gray-400">No Image</div>}</div>
                                <div><span className="text-[10px] text-gray-400 block uppercase mb-1">Household (Front)</span>{viewingProfile.householdFrontUrl ? <img src={viewingProfile.householdFrontUrl} className="w-full h-32 object-cover rounded-xl border border-gray-200"/> : <div className="h-32 bg-gray-200 rounded-xl flex items-center justify-center text-[10px] text-gray-400">No Image</div>}</div>
                                <div><span className="text-[10px] text-gray-400 block uppercase mb-1">Household (Back)</span>{viewingProfile.householdBackUrl ? <img src={viewingProfile.householdBackUrl} className="w-full h-32 object-cover rounded-xl border border-gray-200"/> : <div className="h-32 bg-gray-200 rounded-xl flex items-center justify-center text-[10px] text-gray-400">No Image</div>}</div>
                            </div>
                            <div className="flex gap-3 pt-4 border-t border-gray-200 pb-2">
                                <button type="button" onClick={() => setViewingProfile(null)} className="flex-1 py-3 bg-gray-200 text-gray-700 font-bold rounded-lg hover:bg-gray-300">Close</button>
                                <button type="button" onClick={() => { 
                                    const editData = viewingProfile;
                                    setViewingProfile(null); 
                                    setTimeout(() => {
                                        setAddingInfoForId(editData.staffId); 
                                        setAddingInfoData(editData);
                                    }, 100);
                                }} className="flex-1 py-3 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 flex items-center justify-center"><Edit className="w-4 h-4 mr-2"/> Edit Profile Form</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {addingInfoForId && (
                <NewEmployeeOnboardingForm onBack={() => { setAddingInfoForId(null); setAddingInfoData(null); }} existingStaffId={addingInfoForId} existingData={addingInfoData} isStaffSelfEdit={false} />
            )}

            <div className="flex justify-between items-center mb-6 border-b border-gray-100 pb-4">
                <h2 className="text-xl font-bold flex items-center text-[#123524]"><ShieldCheck className="w-6 h-6 mr-2 text-[#D4AF37]" /> HR & Staff Management</h2>
            </div>

            <div className="flex space-x-2 mb-6 bg-gray-50 p-1.5 rounded-xl border border-gray-100 w-fit">
                <button onClick={() => setViewTab('requests')} className={`px-4 py-2 text-xs font-bold rounded-lg transition relative ${viewTab === 'requests' ? 'bg-white shadow text-[#123524]' : 'text-gray-500 hover:bg-gray-100'}`}>Pending Requests {pendingReqs.length > 0 && <span className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full animate-pulse"></span>}</button>
                <button onClick={() => setViewTab('active')} className={`px-4 py-2 text-xs font-bold rounded-lg transition ${viewTab === 'active' ? 'bg-white shadow text-[#123524]' : 'text-gray-500 hover:bg-gray-100'}`}>Active Staff List</button>
            </div>

            {viewTab === 'requests' && (
                <div className="space-y-3">
                    {pendingReqs.length === 0 ? <div className="text-center p-10 bg-gray-50 rounded-xl text-gray-400 text-xs font-bold">No pending requests.</div> : 
                        pendingReqs.map(req => (
                            <div key={req.id} className="p-4 bg-white border border-gray-200 rounded-xl shadow-sm flex justify-between items-center hover:border-[#D4AF37] transition cursor-pointer" onClick={() => setSelectedReq(req)}>
                                <div>
                                    <div className="font-bold text-[#123524] text-sm">{req.fullName} <span className="ml-2 text-blue-500 text-[10px] font-mono">({req.staffId})</span></div>
                                    <div className="text-[10px] text-gray-500 mt-1 flex items-center gap-2"><span className="bg-blue-50 text-blue-600 px-2 py-0.5 rounded font-bold">{req.jobPosition}</span> <span>{new Date(req.createdAt).toLocaleString()}</span></div>
                                </div>
                                <button className="text-xs bg-[#123524] text-[#D4AF37] px-4 py-2 rounded-lg font-bold">Review</button>
                            </div>
                        ))
                    }
                </div>
            )}

            {viewTab === 'active' && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {activeStaff.map(staff => (
                        <div key={staff.id} className="p-4 bg-white border border-gray-200 rounded-xl shadow-sm flex flex-col relative overflow-hidden">
                            <div className="absolute top-0 right-0 bg-gray-100 text-gray-500 text-[9px] px-2 py-0.5 rounded-bl-lg font-mono font-bold border-b border-l border-gray-200">{staff.id}</div>
                            <div className="flex justify-between items-start mb-3 border-b border-gray-50 pb-2 pt-2">
                                <div><div className="font-bold text-blue-700">{staff.name}</div><div className="text-[10px] text-gray-500 mt-0.5">Therapist Name</div></div>
                                <span className="text-[9px] bg-green-100 text-green-700 px-2 py-1 rounded font-bold uppercase tracking-wider">Active</span>
                            </div>
                            
                            {staff.onboardingData ? (
                                <div className="text-xs text-gray-600 space-y-1.5 mb-4 flex-1 bg-gray-50 p-3 rounded-lg border border-gray-100">
                                    <div className="flex justify-between"><span className="text-gray-400">Actual Name:</span> <span className="font-bold text-[#123524]">{staff.onboardingData.fullName}</span></div>
                                    <div className="flex justify-between"><span className="text-gray-400">Position:</span> <span className="font-bold">{staff.onboardingData.jobPosition}</span></div>
                                    <div className="flex justify-between"><span className="text-gray-400">Phone:</span> <span>{staff.onboardingData.phone}</span></div>
                                </div>
                            ) : (
                                <div className="mb-4 flex-1 flex flex-col justify-center items-center py-4 bg-gray-50 rounded-xl border border-dashed border-gray-300">
                                    <span className="text-[10px] text-gray-500 font-bold mb-2">No profile details yet</span>
                                    <button onClick={() => { setAddingInfoForId(staff.id); setAddingInfoData(null); }} className="text-[10px] bg-blue-50 text-blue-600 border border-blue-200 px-3 py-1.5 rounded-md font-bold hover:bg-blue-100"><Edit className="w-3 h-3 inline mr-1"/> Add Profile Info</button>
                                </div>
                            )}

                            <div className="mt-auto">
                                {staff.onboardingData && (
                                    <button onClick={() => setViewingProfile(staff.onboardingData)} className="w-full mb-2 py-2 bg-gray-100 text-gray-700 text-[10px] font-bold rounded-lg hover:bg-gray-200 border border-gray-200">View Form Details</button>
                                )}
                                <div className="flex gap-2">
                                    <button onClick={() => handleRemoveStaff(staff.id)} className="flex-1 py-2 bg-orange-50 text-orange-600 text-[10px] font-bold rounded-lg hover:bg-orange-100 flex items-center justify-center border border-orange-200"><X className="w-3 h-3 mr-1"/> Resign</button>
                                    <button onClick={() => handlePermanentDelete(staff.id, staff.onboardingData?.id)} className="flex-1 py-2 bg-red-50 text-red-600 text-[10px] font-bold rounded-lg hover:bg-red-100 flex items-center justify-center border border-red-200"><Trash2 className="w-3 h-3 mr-1"/> Delete</button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

// 🌟 3. Staff Profile View Component (For Staff App) 🌟
export function StaffProfileView({ staff }: { staff: any }) {
    const [isEditing, setIsEditing] = useState(false);

    if (isEditing) {
        return <NewEmployeeOnboardingForm onBack={() => setIsEditing(false)} existingStaffId={staff.id} existingData={staff.onboardingData} isStaffSelfEdit={true} />;
    }

    if (!staff.onboardingData) {
        return (
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 animate-fade-in mt-4 text-center">
                <div className="w-16 h-16 bg-yellow-50 rounded-full mx-auto flex items-center justify-center mb-4 text-yellow-600 border border-yellow-100">
                    <UserPlus className="w-8 h-8" />
                </div>
                <h3 className="font-bold text-gray-800 text-lg mb-2">Profile Incomplete</h3>
                <p className="text-xs text-gray-500 mb-6 max-w-sm mx-auto leading-relaxed">သင်၏ အချက်အလက်မှတ်တမ်း (Profile Info) ဖြည့်သွင်းထားခြင်း မရှိသေးပါ။ ကျေးဇူးပြု၍ အောက်ပါခလုတ်ကိုနှိပ်၍ ပြည့်စုံစွာ ဖြည့်သွင်းပေးပါ။</p>
                <button onClick={() => setIsEditing(true)} className="px-6 py-3 bg-[#123524] text-[#D4AF37] rounded-xl font-bold shadow-md mx-auto hover:bg-[#1a4a32] transition flex items-center justify-center text-sm">
                    <Edit className="w-4 h-4 mr-2" /> Add Profile Info
                </button>
            </div>
        );
    }

    const data = staff.onboardingData;

    return (
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 animate-fade-in mt-4">
            <h3 className="font-bold text-[#123524] text-lg mb-4 border-b border-gray-100 pb-3 flex items-center justify-between">
                My Profile Details
                <button onClick={() => alert("အချက်အလက်များကို သင်ကိုယ်တိုင် ပြင်ဆင်ခွင့်မရှိတော့ပါ။ ပြင်ဆင်လိုပါက Admin သို့ တိုက်ရိုက် ဆက်သွယ်အကြောင်းကြားပေးပါ။")} className="text-[10px] bg-red-50 text-red-600 border border-red-200 px-3 py-1.5 rounded-lg shadow-sm font-bold flex items-center">
                    <X className="w-3 h-3 mr-1"/> Request Edit
                </button>
            </h3>
            <div className="space-y-4">
                <div className="bg-gray-50 p-3 rounded-lg flex justify-between"><span className="text-xs text-gray-500 font-bold">Therapist Name</span><span className="text-xs font-bold text-blue-700">{staff.name}</span></div>
                <div className="bg-gray-50 p-3 rounded-lg flex justify-between"><span className="text-xs text-gray-500 font-bold">Actual Name (အမည်ရင်း)</span><span className="text-xs font-bold text-gray-800">{data.fullName}</span></div>
                <div className="bg-gray-50 p-3 rounded-lg flex justify-between"><span className="text-xs text-gray-500 font-bold">Employee ID</span><span className="text-xs font-mono font-bold text-[#123524]">{staff.id}</span></div>
                <div className="bg-gray-50 p-3 rounded-lg flex justify-between"><span className="text-xs text-gray-500 font-bold">Position</span><span className="text-xs font-bold text-blue-600">{data.jobPosition}</span></div>
                <div className="bg-gray-50 p-3 rounded-lg flex justify-between"><span className="text-xs text-gray-500 font-bold">Phone</span><span className="text-xs font-bold text-gray-800">{data.phone}</span></div>
                <div className="bg-gray-50 p-3 rounded-lg"><span className="text-xs text-gray-500 font-bold block mb-1">Address</span><span className="text-xs font-semibold text-gray-800 leading-relaxed">{data.address}</span></div>
                <div className="bg-red-50 p-3 rounded-lg"><span className="text-[10px] text-red-400 font-bold uppercase tracking-wider block mb-1">Emergency Contact</span><div className="text-xs font-bold text-red-700">{data.emergencyName} ({data.emergencyRelation})<br/><span className="font-mono mt-1 inline-block">{data.emergencyPhone}</span></div></div>
            </div>
        </div>
    );
}
