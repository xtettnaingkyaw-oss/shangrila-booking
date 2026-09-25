import React, { useState, useEffect } from 'react';
import { collection, addDoc, updateDoc, doc, onSnapshot, query, orderBy, deleteDoc, setDoc } from 'firebase/firestore';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { db, secondaryAuth } from '../firebase';
import { compressImage } from '../shared';
import { encryptText } from '../security';
import { UserPlus, FileText, CheckCircle, Clock, X, Save, Image as ImageIcon, ChevronLeft, ShieldCheck, Trash2, Edit } from 'lucide-react';

const JOB_POSITIONS = ['Professional Therapist', 'Receptionist', 'Manager', 'Cleaner', 'Security'];
const DOC_CHECKLIST = ['နိုင်ငံသားမှတ်ပုံတင်(မူရင်း) အပ်ပြီးပါပြီ', 'အိမ်ထောင်စုဇယား(မိတ္တူ) အပ်ပြီးပါပြီ', 'ရပ်ကွက်ရဲစခန်း ထောက်ခံစာ အပ်ပြီးပါပြီ'];
const RULES_LIST = [
    'မိမိလုပ်ရမည့် အလုပ်တာဝန်များနှင့် လုပ်ငန်းသဘောသဘာဝများကို သေချာသိရှိနားလည်ပါသည်။',
    'သိရှိနားလည်ထားသည့်အတိုင်း မိမိဆန္ဒအလျောက် အလုပ်လုပ်ရန် သဘောတူလက်ခံပါသည်။',
    'ဆိုင်မှ ချမှတ်ထားသော စည်းမျဉ်းစည်းကမ်းများအားလုံးကိုလည်း သိရှိနားလည် သဘောတူလက်ခံပါသည်။'
];

// 🌟 1. Staff Application Form Component 🌟
export function NewEmployeeOnboardingForm({ onBack }: { onBack: () => void }) {
    const [formData, setFormData] = useState({
        fullName: '', nrcNumber: '', dob: '', phone: '', address: '',
        emergencyName: '', emergencyPhone: '', emergencyRelation: '',
        jobPosition: '', startDate: '',
        nrcPhotoUrl: '', householdPhotoUrl: '',
        documents: [] as string[], rules: [] as string[]
    });
    const [loading, setLoading] = useState(false);
    const [uploadingInfo, setUploadingInfo] = useState('');

    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>, field: 'nrcPhotoUrl' | 'householdPhotoUrl') => {
        const file = e.target.files?.[0]; if (!file) return;
        setUploadingInfo('Uploading Image...');
        try { const base64 = await compressImage(file, 800, 1000); setFormData({ ...formData, [field]: base64 }); } 
        catch (err) { alert("Image upload failed."); }
        setUploadingInfo('');
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (formData.rules.length !== RULES_LIST.length) return alert("ကျေးဇူးပြု၍ စည်းမျဉ်းစည်းကမ်း အားလုံးကို သဘောတူကြောင်း အမှန်ခြစ်ပေးပါ။");
        setLoading(true);
        try {
            await addDoc(collection(db, 'onboarding_requests'), { ...formData, status: 'pending', createdAt: Date.now() });
            alert("✅ လျှောက်လွှာတင်ခြင်း အောင်မြင်ပါသည်။ Admin မှ အတည်ပြုပြီးပါက အကြောင်းကြားပေးပါမည်။");
            onBack();
        } catch (error) { alert("Error submitting form."); }
        setLoading(false);
    };

    return (
        <div className="bg-gray-50 min-h-screen pb-10">
            <div className="bg-[#D4AF37] p-4 flex items-center shadow-md sticky top-0 z-10">
                <button onClick={onBack} className="text-white hover:bg-white/20 p-2 rounded-full transition"><ChevronLeft className="w-6 h-6"/></button>
                <h2 className="text-[#123524] font-bold text-lg ml-2 uppercase tracking-wider">New Employee Onboarding</h2>
            </div>
            
            <form onSubmit={handleSubmit} className="max-w-xl mx-auto p-4 space-y-6 mt-4">
                <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-200 space-y-4">
                    <div><label className="block text-xs font-bold text-gray-500 mb-1">Full Name (အမည်အပြည့်အစုံ) *</label><input required type="text" value={formData.fullName} onChange={e=>setFormData({...formData, fullName: e.target.value})} placeholder="Please enter" className="w-full p-3 bg-gray-50 border border-gray-200 rounded-lg outline-none focus:border-[#D4AF37] font-semibold text-gray-800" /></div>
                    <div><label className="block text-xs font-bold text-gray-500 mb-1">မှတ်ပုံတင်နံပါတ် *</label><input required type="text" value={formData.nrcNumber} onChange={e=>setFormData({...formData, nrcNumber: e.target.value})} placeholder="Please enter" className="w-full p-3 bg-gray-50 border border-gray-200 rounded-lg outline-none focus:border-[#D4AF37] font-semibold text-gray-800" /></div>
                    
                    <div className="grid grid-cols-2 gap-4">
                        <label className="border-2 border-dashed border-gray-300 rounded-xl p-4 flex flex-col items-center justify-center text-gray-400 hover:bg-gray-50 cursor-pointer h-32 relative overflow-hidden">
                            {formData.nrcPhotoUrl ? <img src={formData.nrcPhotoUrl} className="absolute inset-0 w-full h-full object-cover" alt="NRC"/> : <><ImageIcon className="w-6 h-6 mb-2"/><span className="text-[10px] font-bold">မှတ်ပုံတင်ပုံတင်ရန်</span></>}
                            <input type="file" accept="image/*" className="hidden" onChange={(e) => handleImageUpload(e, 'nrcPhotoUrl')} />
                        </label>
                        <label className="border-2 border-dashed border-gray-300 rounded-xl p-4 flex flex-col items-center justify-center text-gray-400 hover:bg-gray-50 cursor-pointer h-32 relative overflow-hidden">
                            {formData.householdPhotoUrl ? <img src={formData.householdPhotoUrl} className="absolute inset-0 w-full h-full object-cover" alt="Household"/> : <><ImageIcon className="w-6 h-6 mb-2"/><span className="text-[10px] font-bold">အိမ်ထောင်စုစာရင်းပုံ</span></>}
                            <input type="file" accept="image/*" className="hidden" onChange={(e) => handleImageUpload(e, 'householdPhotoUrl')} />
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
                        <label className="block text-xs font-bold text-gray-500 mb-2">Document Check List</label>
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

                <button type="submit" disabled={loading} className="w-full py-4 bg-[#123524] text-[#D4AF37] rounded-xl font-bold shadow-lg flex items-center justify-center hover:bg-[#1a4a32] transition disabled:opacity-50">
                    <UserPlus className="w-5 h-5 mr-2" /> {loading ? 'Submitting...' : 'Submit Application'}
                </button>
            </form>
        </div>
    );
}


// 🌟 2. Admin HR Management Component 🌟
export function AdminHRManagement() {
    const [requests, setRequests] = useState<any[]>([]);
    const [activeStaff, setActiveStaff] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedReq, setSelectedReq] = useState<any>(null);
    const [approvalForm, setApprovalForm] = useState({ staffId: '', password: '' });
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
        if (!approvalForm.staffId || !approvalForm.password) return;
        setProcessing(true);
        try {
            // 1. Create Auth User
            try { await createUserWithEmailAndPassword(secondaryAuth, `${approvalForm.staffId.toLowerCase()}@shangrila.com`, approvalForm.password); } catch(e){}
            // 2. Add to Therapists Collection with Form Data attached
            await setDoc(doc(db, 'therapists', approvalForm.staffId), {
                id: approvalForm.staffId,
                name: selectedReq.fullName,
                password: encryptText("SECURED_ACCOUNT"), // Do not store raw password
                order: activeStaff.length,
                images: [],
                onboardingData: selectedReq // Store all form data for profile viewing
            });
            // 3. Update Request Status
            await updateDoc(doc(db, 'onboarding_requests', selectedReq.id), { status: 'approved', assignedId: approvalForm.staffId, approvedAt: Date.now() });
            alert("✅ ဝန်ထမ်းသစ် အတည်ပြုပြီးပါပြီ။ Staff App မှ စတင် ဝင်ရောက်နိုင်ပါပြီ။");
            setSelectedReq(null);
        } catch (error) { alert("Error approving staff."); }
        setProcessing(false);
    };

    const handleReject = async (id: string) => {
        if (!window.confirm("ဤလျှောက်လွှာကို ပယ်ဖျက်မည် သေချာပါသလား?")) return;
        await updateDoc(doc(db, 'onboarding_requests', id), { status: 'rejected' });
    };

    const handleRemoveStaff = async (id: string) => {
        if (!window.confirm("ဤဝန်ထမ်းကို စာရင်းမှ ဖယ်ရှားမည် (Resigned) သေချာပါသလား?")) return;
        await deleteDoc(doc(db, 'therapists', id));
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
                                <div className="bg-white p-3 rounded-xl shadow-sm border border-gray-100"><span className="text-[10px] text-gray-400 block uppercase">Name</span><span className="font-bold text-[#123524]">{selectedReq.fullName}</span></div>
                                <div className="bg-white p-3 rounded-xl shadow-sm border border-gray-100"><span className="text-[10px] text-gray-400 block uppercase">Position</span><span className="font-bold text-blue-600">{selectedReq.jobPosition}</span></div>
                                <div className="bg-white p-3 rounded-xl shadow-sm border border-gray-100"><span className="text-[10px] text-gray-400 block uppercase">Phone</span><span className="font-bold text-gray-800">{selectedReq.phone}</span></div>
                                <div className="bg-white p-3 rounded-xl shadow-sm border border-gray-100"><span className="text-[10px] text-gray-400 block uppercase">NRC</span><span className="font-bold text-gray-800">{selectedReq.nrcNumber}</span></div>
                                <div className="col-span-2 bg-white p-3 rounded-xl shadow-sm border border-gray-100"><span className="text-[10px] text-gray-400 block uppercase">Address</span><span className="font-bold text-gray-800">{selectedReq.address}</span></div>
                            </div>
                            
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <span className="text-[10px] text-gray-400 block uppercase mb-1">NRC Photo</span>
                                    {selectedReq.nrcPhotoUrl ? <img src={selectedReq.nrcPhotoUrl} className="w-full h-32 object-cover rounded-xl border border-gray-200"/> : <div className="h-32 bg-gray-200 rounded-xl flex items-center justify-center text-xs text-gray-400">No Image</div>}
                                </div>
                                <div>
                                    <span className="text-[10px] text-gray-400 block uppercase mb-1">Household Photo</span>
                                    {selectedReq.householdPhotoUrl ? <img src={selectedReq.householdPhotoUrl} className="w-full h-32 object-cover rounded-xl border border-gray-200"/> : <div className="h-32 bg-gray-200 rounded-xl flex items-center justify-center text-xs text-gray-400">No Image</div>}
                                </div>
                            </div>

                            {selectedReq.status === 'pending' && (
                                <form onSubmit={handleApprove} className="bg-[#123524]/5 p-5 rounded-xl border border-[#123524]/20 space-y-4">
                                    <h4 className="font-bold text-[#123524] text-sm mb-2 border-b border-[#123524]/10 pb-2">Assign Login Credentials</h4>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div><label className="block text-xs font-bold text-gray-600 mb-1">Assign Staff ID (Login ID)</label><input required type="text" placeholder="e.g. No-14" value={approvalForm.staffId} onChange={e=>setApprovalForm({...approvalForm, staffId: e.target.value})} className="w-full p-2 border border-gray-300 rounded focus:border-[#D4AF37] outline-none font-bold" /></div>
                                        <div><label className="block text-xs font-bold text-gray-600 mb-1">Set Password</label><input required type="text" placeholder="Min 6 chars" minLength={6} value={approvalForm.password} onChange={e=>setApprovalForm({...approvalForm, password: e.target.value})} className="w-full p-2 border border-gray-300 rounded focus:border-[#D4AF37] outline-none font-bold" /></div>
                                    </div>
                                    <div className="flex gap-3 pt-2">
                                        <button type="button" onClick={() => handleReject(selectedReq.id)} className="flex-1 py-3 bg-red-50 text-red-600 font-bold rounded-lg hover:bg-red-100">Reject Request</button>
                                        <button type="submit" disabled={processing} className="flex-1 py-3 bg-[#123524] text-[#D4AF37] font-bold rounded-lg hover:bg-[#1a4a32] shadow-md">{processing ? 'Approving...' : 'Approve & Create Account'}</button>
                                    </div>
                                </form>
                            )}
                        </div>
                    </div>
                </div>
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
                                    <div className="font-bold text-[#123524] text-sm">{req.fullName}</div>
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
                        <div key={staff.id} className="p-4 bg-white border border-gray-200 rounded-xl shadow-sm flex flex-col">
                            <div className="flex justify-between items-start mb-3 border-b border-gray-50 pb-2">
                                <div><div className="font-bold text-[#123524]">{staff.name}</div><div className="text-[10px] font-mono text-gray-500 mt-0.5">ID: {staff.id}</div></div>
                                <span className="text-[9px] bg-green-100 text-green-700 px-2 py-1 rounded font-bold uppercase tracking-wider">Active</span>
                            </div>
                            {staff.onboardingData && (
                                <div className="text-xs text-gray-600 space-y-1.5 mb-4 flex-1">
                                    <div className="flex justify-between"><span className="text-gray-400">Position:</span> <span className="font-bold">{staff.onboardingData.jobPosition}</span></div>
                                    <div className="flex justify-between"><span className="text-gray-400">Phone:</span> <span>{staff.onboardingData.phone}</span></div>
                                    <div className="flex justify-between"><span className="text-gray-400">Start Date:</span> <span>{staff.onboardingData.startDate}</span></div>
                                </div>
                            )}
                            <div className="flex gap-2 mt-auto">
                                {staff.onboardingData && <button onClick={() => setSelectedReq(staff.onboardingData)} className="flex-1 py-2 bg-gray-100 text-gray-700 text-[10px] font-bold rounded-lg hover:bg-gray-200">View Profile</button>}
                                <button onClick={() => handleRemoveStaff(staff.id)} className="flex-1 py-2 bg-red-50 text-red-600 text-[10px] font-bold rounded-lg hover:bg-red-100 flex items-center justify-center"><Trash2 className="w-3 h-3 mr-1"/> Resign</button>
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
    if (!staff.onboardingData) return <div className="text-center p-10 text-gray-400 text-xs bg-gray-50 rounded-xl border border-dashed">Profile data not fully set up. Please contact Admin.</div>;
    const data = staff.onboardingData;

    return (
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 animate-fade-in mt-4">
            <h3 className="font-bold text-[#123524] text-lg mb-4 border-b border-gray-100 pb-3 flex items-center justify-between">
                My Profile Details
                <button onClick={() => alert("အချက်အလက် ပြင်ဆင်လိုပါက Admin သို့ ဆက်သွယ်ပါ။")} className="text-[10px] bg-[#D4AF37] text-white px-3 py-1.5 rounded-lg shadow-sm">Request Edit</button>
            </h3>
            <div className="space-y-4">
                <div className="bg-gray-50 p-3 rounded-lg flex justify-between"><span className="text-xs text-gray-500 font-bold">Full Name</span><span className="text-xs font-bold text-gray-800">{data.fullName}</span></div>
                <div className="bg-gray-50 p-3 rounded-lg flex justify-between"><span className="text-xs text-gray-500 font-bold">Login ID</span><span className="text-xs font-mono font-bold text-[#123524]">{staff.id}</span></div>
                <div className="bg-gray-50 p-3 rounded-lg flex justify-between"><span className="text-xs text-gray-500 font-bold">Position</span><span className="text-xs font-bold text-blue-600">{data.jobPosition}</span></div>
                <div className="bg-gray-50 p-3 rounded-lg flex justify-between"><span className="text-xs text-gray-500 font-bold">Phone</span><span className="text-xs font-bold text-gray-800">{data.phone}</span></div>
                <div className="bg-gray-50 p-3 rounded-lg"><span className="text-xs text-gray-500 font-bold block mb-1">Address</span><span className="text-xs font-semibold text-gray-800 leading-relaxed">{data.address}</span></div>
                <div className="bg-red-50 p-3 rounded-lg"><span className="text-[10px] text-red-400 font-bold uppercase tracking-wider block mb-1">Emergency Contact</span><div className="text-xs font-bold text-red-700">{data.emergencyName} ({data.emergencyRelation})<br/><span className="font-mono mt-1 inline-block">{data.emergencyPhone}</span></div></div>
            </div>
        </div>
    );
}
