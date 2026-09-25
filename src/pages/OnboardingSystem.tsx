import React, { useState, useEffect } from 'react';
import { collection, addDoc, updateDoc, doc, onSnapshot, query, orderBy, deleteDoc, setDoc } from 'firebase/firestore';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { db, secondaryAuth } from '../firebase';
import { encryptText } from '../security';
import { UserPlus, FileText, X, Save, Image as ImageIcon, ChevronLeft, ShieldCheck, Trash2, Edit, User, FileWarning, Download as DownloadIcon, Bell } from 'lucide-react';

const JOB_POSITIONS = ['Professional Therapist', 'Receptionist', 'Manager', 'Cleaner', 'Security'];
const DOC_CHECKLIST = ['နိုင်ငံသားမှတ်ပုံတင်(မူရင်း) အပ်ပြီးပါပြီ', 'အိမ်ထောင်စုဇယား(မိတ္တူ) အပ်ပြီးပါပြီ', 'ရပ်ကွက်ရဲစခန်း ထောက်ခံစာ အပ်ပြီးပါပြီ'];
const RULES_LIST = [
    'မိမိလုပ်ရမည့် အလုပ်တာဝန်များနှင့် လုပ်ငန်းသဘောသဘာဝများကို သေချာသိရှိနားလည်ပါသည်။',
    'သိရှိနားလည်ထားသည့်အတိုင်း မိမိဆန္ဒအလျောက် အလုပ်လုပ်ရန် သဘောတူလက်ခံပါသည်။',
    'ဆိုင်မှ ချမှတ်ထားသော စည်းမျဉ်းစည်းကမ်းများအားလုံးကိုလည်း သိရှိနားလည် သဘောတူလက်ခံပါသည်။'
];

// 🌟 Canvas ကို အသုံးပြု၍ ပုံအရွယ်အစားနှင့် Quality ထိန်းညှိပေးမည့် Helper 🌟
const compressImageToSmallBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (event) => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const MAX_SIZE = 800; 
                let width = img.width;
                let height = img.height;

                if (width > height) {
                    if (width > MAX_SIZE) {
                        height *= MAX_SIZE / width;
                        width = MAX_SIZE;
                    }
                } else {
                    if (height > MAX_SIZE) {
                        width *= MAX_SIZE / height;
                        height = MAX_SIZE;
                    }
                }

                canvas.width = Math.max(1, Math.round(width));
                canvas.height = Math.max(1, Math.round(height));
                const ctx = canvas.getContext('2d');

                if (ctx) {
                    ctx.fillStyle = '#FFFFFF';
                    ctx.fillRect(0, 0, canvas.width, canvas.height);
                    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                }

                // 🌟 Dynamic Compression 🌟
                let quality = 0.8;
                let finalBase64 = canvas.toDataURL('image/jpeg', quality);

                while (finalBase64.length > 120000 && quality > 0.3) {
                    quality -= 0.1;
                    finalBase64 = canvas.toDataURL('image/jpeg', quality);
                }

                resolve(finalBase64);
            };
            img.onerror = reject;
            img.src = event.target?.result as string;
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
};

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
    const [uploadingInfo, setUploadingInfo] = useState<string>('');

    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>, field: 'nrcFrontUrl' | 'nrcBackUrl' | 'householdFrontUrl' | 'householdBackUrl') => {
        const file = e.target.files?.[0]; 
        if (!file) return;
        setUploadingInfo(field);

        try {
            const smallBase64 = await compressImageToSmallBase64(file);
            setFormData(prev => ({ ...prev, [field]: smallBase64 }));
        } catch (err: any) { 
            console.error("Image Upload Error:", err);
            alert("Image upload failed. Error: " + err.message); 
        } finally {
            setUploadingInfo('');
            e.target.value = ''; 
        }
    };

    const renderDocumentUpload = (field: 'nrcFrontUrl' | 'nrcBackUrl' | 'householdFrontUrl' | 'householdBackUrl', label: string) => {
        const url = formData[field];
        const isUploading = uploadingInfo === field;

        if (url) {
            return (
                <div>
                    <label className="block text-[10px] font-bold text-gray-500 mb-1">{label} <span className="text-red-500">*</span></label>
                    <div className="aspect-[4/3] relative rounded-xl overflow-hidden shadow-sm border border-gray-200 group">
                        <img src={url} alt={label} className="w-full h-full object-cover" />
                        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-1.5">
                            <button
                                type="button"
                                onClick={(e) => {
                                    e.preventDefault();
                                    setFormData({ ...formData, [field]: '' });
                                }}
                                className="bg-red-500 text-white text-[10px] px-3 py-1.5 rounded hover:bg-red-600 shadow-sm font-bold"
                            >
                                Delete
                            </button>
                        </div>
                    </div>
                </div>
            );
        }

        return (
            <div>
                <label className="block text-[10px] font-bold text-gray-500 mb-1">{label} <span className="text-red-500">*</span></label>
                <label className="aspect-[4/3] rounded-xl border border-dashed border-gray-400 flex items-center justify-center cursor-pointer hover:bg-gray-100 transition-colors bg-gray-50 shadow-sm relative overflow-hidden">
                    <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => handleImageUpload(e, field)}
                        disabled={isUploading}
                    />
                    <div className="text-center">
                        {isUploading ? (
                            <span className="text-[10px] font-bold text-[#D4AF37]">Wait..</span>
                        ) : (
                            <div className="flex flex-col items-center">
                                <ImageIcon className="w-6 h-6 mb-1 text-gray-400"/>
                                <span className="text-[10px] font-bold text-gray-500">Upload</span>
                            </div>
                        )}
                    </div>
                </label>
            </div>
        );
    };

    const isFormValid = () => {
        return (
            formData.fullName.trim() !== '' &&
            formData.nrcNumber.trim() !== '' &&
            formData.nrcFrontUrl !== '' && formData.nrcBackUrl !== '' &&
            formData.householdFrontUrl !== '' && formData.householdBackUrl !== '' &&
            formData.dob !== '' && formData.phone.trim() !== '' && formData.address.trim() !== '' &&
            formData.emergencyName.trim() !== '' && formData.emergencyPhone.trim() !== '' && formData.emergencyRelation.trim() !== '' &&
            formData.jobPosition !== '' && formData.startDate !== ''
        );
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        
        if (!isFormValid()) {
            alert("ကျေးဇူးပြု၍ လိုအပ်သော အချက်အလက်နှင့် ပုံအားလုံးကို ပြည့်စုံစွာ ထည့်သွင်းပေးပါ။");
            return;
        }
        
        setLoading(true);
        try {
            if (existingStaffId) {
                if (isStaffSelfEdit) {
                    await updateDoc(doc(db, 'therapists', existingStaffId), { 
                        pendingOnboardingData: formData, 
                        updateRequested: true 
                    });
                    alert("✅ အချက်အလက်ပြင်ဆင်ခြင်းအား Admin ထံ ပေးပို့လိုက်ပါပြီ။ Admin မှ အတည်ပြုပြီးပါက ပြောင်းလဲသွားပါမည်။");
                } else {
                    await updateDoc(doc(db, 'therapists', existingStaffId), { onboardingData: formData });
                    alert("✅ ဝန်ထမ်းအချက်အလက် ဖြည့်သွင်းခြင်း အောင်မြင်ပါသည်။");
                }
                setTimeout(() => onBack(), 100); 
            } else {
                await addDoc(collection(db, 'onboarding_requests'), { ...formData, status: 'pending', createdAt: Date.now() });
                alert("✅ လျှောက်လွှာတင်ခြင်း အောင်မြင်ပါသည်။ Admin မှ အတည်ပြုပြီးပါက အကြောင်းကြားပေးပါမည်။");
                setTimeout(() => onBack(), 100);
            }
        } catch (error: any) { 
            console.error("Submit Error:", error); 
            alert(`Error submitting form.\n${error.message}`); 
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="bg-gray-50 min-h-[100dvh] w-full fixed inset-0 z-[100] flex flex-col">
            <div className="bg-[#D4AF37] p-4 flex items-center shadow-md flex-shrink-0">
                <button type="button" onClick={onBack} className="text-white hover:bg-white/20 p-2 rounded-full transition"><ChevronLeft className="w-6 h-6"/></button>
                <h2 className="text-[#123524] font-bold text-lg ml-2 uppercase tracking-wider">{isStaffSelfEdit ? 'Update Your Profile Info' : (existingStaffId ? 'Add Your Profile Info' : 'New Employee Onboarding')}</h2>
            </div>
            
            <div className="flex-1 overflow-y-auto pb-36">
                <form id="onboardingForm" onSubmit={handleSubmit} className="max-w-xl mx-auto p-4 space-y-6 animate-slide-up">
                    
                    {existingStaffId && !isStaffSelfEdit && (
                        <div className="bg-blue-50 text-blue-800 p-4 rounded-xl border border-blue-200 text-xs font-bold shadow-sm">
                            <span className="block mb-1 text-blue-600 uppercase tracking-widest text-[9px]">Important Notice</span>
                            ဤအချက်အလက်များကို တစ်ကြိမ်သာ ဖြည့်သွင်းခွင့်ရှိပါသည်။ ဖြည့်သွင်းပြီးပါက Admin ထံ ခွင့်ပြုချက်တောင်းပြီးမှသာ ပြန်လည်ပြင်ဆင်နိုင်မည်ဖြစ်သဖြင့် သေချာစွာစစ်ဆေးပြီးမှ Submit လုပ်ပါ။
                        </div>
                    )}
                    
                    {isStaffSelfEdit && (
                         <div className="bg-yellow-50 text-yellow-800 p-4 rounded-xl border border-yellow-200 text-xs font-bold shadow-sm">
                             <span className="block mb-1 text-yellow-600 uppercase tracking-widest text-[9px]">Edit Mode</span>
                             သင်ပြောင်းလဲလိုက်သော အချက်အလက်များကို Admin မှ အတည်ပြုပြီးမှသာ Profile တွင် Update ဖြစ်သွားပါမည်။
                         </div>
                    )}

                    <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-200 space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div><label className="block text-xs font-bold text-gray-500 mb-1">Employee ID *</label><input required type="text" value={formData.staffId} disabled className="w-full p-3 bg-gray-100 border border-gray-200 rounded-lg outline-none font-bold text-gray-500 opacity-80 cursor-not-allowed" /></div>
                            <div><label className="block text-xs font-bold text-gray-500 mb-1">Full Name (အမည်ရင်း) *</label><input required type="text" value={formData.fullName} onChange={e=>setFormData({...formData, fullName: e.target.value})} placeholder="Enter actual name" className="w-full p-3 bg-gray-50 border border-gray-200 rounded-lg outline-none focus:border-[#D4AF37] font-semibold text-gray-800" /></div>
                        </div>
                        <div><label className="block text-xs font-bold text-gray-500 mb-1">မှတ်ပုံတင်နံပါတ် *</label><input required type="text" value={formData.nrcNumber} onChange={e=>setFormData({...formData, nrcNumber: e.target.value})} placeholder="Please enter" className="w-full p-3 bg-gray-50 border border-gray-200 rounded-lg outline-none focus:border-[#D4AF37] font-semibold text-gray-800" /></div>
                        
                        <div className="grid grid-cols-2 gap-4">
                            {renderDocumentUpload('nrcFrontUrl', 'မှတ်ပုံတင် (ရှေ့ဘက်)')}
                            {renderDocumentUpload('nrcBackUrl', 'မှတ်ပုံတင် (နောက်ဘက်)')}
                            {renderDocumentUpload('householdFrontUrl', 'အိမ်ထောင်စု (ရှေ့ဘက်)')}
                            {renderDocumentUpload('householdBackUrl', 'အိမ်ထောင်စု (နောက်ဘက်)')}
                        </div>

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

            <div className="fixed bottom-0 left-0 right-0 px-4 pb-4 pt-3 bg-white border-t border-gray-200 shadow-[0_-8px_15px_-3px_rgba(0,0,0,0.08)] z-50">
                <div className="max-w-xl mx-auto">
                    <p className="text-[9px] text-red-600 text-center font-black mb-2.5 leading-relaxed tracking-wide">
                        ဖြည့်သွင်းထားသောအချက်လက်များအားလုံး ပြည့်စုံမှန်ကန်ခြင်း ရှိ/မရှိ<br/>သေချာစွာပြန်လည်စစ်ဆေးပြီးပါက အောက်မှ တင်သွင်းသည့်ခလုတ်ကိုနှိပ်ပါ။
                    </p>
                    <button 
                        type="submit" 
                        form="onboardingForm" 
                        disabled={loading || !isFormValid()} 
                        className={`w-full py-4 rounded-xl font-bold shadow-md flex items-center justify-center transition ${isFormValid() ? 'bg-[#123524] text-[#D4AF37] hover:bg-[#1a4a32] hover:shadow-lg' : 'bg-gray-200 text-gray-400 cursor-not-allowed'}`}
                    >
                        <Save className="w-5 h-5 mr-2" /> 
                        {loading ? 'Saving Data...' : (!isFormValid() ? 'Please fill all required fields' : (isStaffSelfEdit ? 'Update All Information Now' : 'Submit All Information Now'))}
                    </button>
                </div>
            </div>
        </div>
    );
}

// 🌟 Photo Viewer Modal Component 🌟
function PhotoViewerModal({ src, onClose }: { src: string, onClose: () => void }) {
    
    const handleDownload = async () => {
        try {
            let blobUrl = src;
            
            if (src.startsWith('data:image')) {
                const response = await fetch(src);
                const blob = await response.blob();
                blobUrl = URL.createObjectURL(blob);
            }

            const link = document.createElement('a');
            link.href = blobUrl;
            link.download = `Staff_Document_${Date.now()}.jpg`; 
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);

            if (src.startsWith('data:image')) {
                URL.revokeObjectURL(blobUrl);
            }
        } catch (error) {
            console.error("Download failed:", error);
            alert("ပုံ Download ဆွဲရာတွင် အခက်အခဲဖြစ်ပေါ်နေပါသည်။");
        }
    };

    return (
        <div className="fixed inset-0 z-[1000] bg-black/90 flex flex-col items-center justify-center p-4 animate-fade-in">
            <div className="absolute top-4 right-4 flex gap-4">
                <button onClick={handleDownload} className="bg-white/20 p-3 rounded-full hover:bg-white/40 transition">
                    <DownloadIcon className="w-6 h-6 text-white" />
                </button>
                <button onClick={onClose} className="bg-white/20 p-3 rounded-full hover:bg-white/40 transition">
                    <X className="w-6 h-6 text-white" />
                </button>
            </div>
            <img src={src} alt="Document" className="max-w-full max-h-[85vh] object-contain rounded-lg shadow-2xl" />
        </div>
    );
}

// 🌟 Reusable Profile Details Component (Used by both Admin & Staff App) 🌟
function ProfileDetailsViewer({ data, staffId, therapistName, onClose, isStaffView = false, onEditRequest }: { data: any, staffId: string, therapistName?: string, onClose?: () => void, isStaffView?: boolean, onEditRequest?: () => void }) {
    const [viewingPhoto, setViewingPhoto] = useState<string | null>(null);

    const calculateAge = (dobString: string) => {
        if (!dobString) return '-';
        const birthDate = new Date(dobString);
        if (isNaN(birthDate.getTime())) return '-';

        const today = new Date();
        let age = today.getFullYear() - birthDate.getFullYear();
        const m = today.getMonth() - birthDate.getMonth();
        if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
            age--;
        }
        return `${age} Yrs`;
    };

    const calculateDuration = (startDateString: string) => {
        if (!startDateString) return '-';
        const startDate = new Date(startDateString);
        if (isNaN(startDate.getTime())) return '-';

        const today = new Date();
        const diffTime = Math.abs(today.getTime() - startDate.getTime());
        const diffDaysTotal = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        if (diffDaysTotal < 30) {
            return `${diffDaysTotal} Days`;
        } else if (diffDaysTotal < 365) {
            const months = Math.floor(diffDaysTotal / 30);
            const remainingDays = diffDaysTotal % 30;
            return remainingDays > 0 ? `${months} Mos & ${remainingDays} Days` : `${months} Mos`;
        } else {
            const years = Math.floor(diffDaysTotal / 365);
            const remainingDaysAfterYear = diffDaysTotal % 365;
            
            if (remainingDaysAfterYear === 0) return `${years} Yr`;
            
            if (remainingDaysAfterYear < 30) {
                 return `${years} Yr & ${remainingDaysAfterYear} Days`;
            } else {
                 const extraMonths = Math.floor(remainingDaysAfterYear / 30);
                 const extraDays = remainingDaysAfterYear % 30;
                 return extraDays > 0 ? `${years} Yr, ${extraMonths} Mo & ${extraDays} D` : `${years} Yr & ${extraMonths} Mo`;
            }
        }
    };

    return (
        <div className="flex flex-col h-full relative pb-20">
            {viewingPhoto && <PhotoViewerModal src={viewingPhoto} onClose={() => setViewingPhoto(null)} />}

            <div className="grid grid-cols-2 gap-4 mb-4">
                {/* 🌟 Admin View မှာသာ Employee ID ကို ပြမည် 🌟 */}
                {!isStaffView && (
                    <div className="col-span-2 bg-white p-3 rounded-xl shadow-sm border border-gray-100">
                        <span className="text-[10px] text-gray-400 block uppercase">Employee ID</span>
                        <span className="font-bold text-[#123524] truncate block text-base" title={staffId}>{staffId}</span>
                    </div>
                )}
                
                <div className="col-span-2 bg-white p-3 rounded-xl shadow-sm border border-gray-100">
                    <span className="text-[10px] text-gray-400 block uppercase">Actual Name (အမည်ရင်း)</span>
                    <span className="font-bold text-gray-800 truncate block text-base">{data.fullName}</span>
                </div>
                
                {therapistName && (
                    <div className="col-span-2 bg-white p-3 rounded-xl shadow-sm border border-gray-100">
                        <span className="text-[10px] text-gray-400 block uppercase">Therapist Name</span>
                        <span className="font-bold text-blue-700 text-base">{therapistName}</span>
                    </div>
                )}

                <div className="col-span-2 bg-white p-3 rounded-xl shadow-sm border border-gray-100">
                    <span className="text-[10px] text-gray-400 block uppercase">Position</span>
                    <span className="font-bold text-blue-600 truncate block text-base">{data.jobPosition}</span>
                </div>
                <div className="col-span-2 bg-white p-3 rounded-xl shadow-sm border border-gray-100">
                    <span className="text-[10px] text-gray-400 block uppercase">Phone</span>
                    <span className="font-bold text-gray-800 text-base">{data.phone}</span>
                </div>

                <div className="col-span-2 bg-white p-3 rounded-xl shadow-sm border border-gray-100">
                    <span className="text-[10px] text-gray-400 block uppercase">NRC</span>
                    <span className="font-bold text-gray-800 text-base">{data.nrcNumber}</span>
                </div>

                <div className="col-span-2 flex gap-3">
                    <div className="flex-1 bg-white p-3 rounded-xl shadow-sm border border-gray-100 flex flex-col justify-center">
                        <span className="text-[10px] text-gray-400 block uppercase mb-1">Date of Birth</span>
                        <span className="font-bold text-gray-800 text-sm">{data.dob}</span>
                    </div>
                    <div className="w-24 bg-gradient-to-br from-[#123524] to-[#1a4a32] p-2 rounded-xl shadow-md border border-[#123524]/20 flex flex-col justify-center items-center">
                        <span className="text-[9px] text-[#D4AF37]/80 uppercase font-bold mb-0.5">Age</span>
                        <span className="text-[#D4AF37] font-black text-sm">{calculateAge(data.dob)}</span>
                    </div>
                </div>

                <div className="col-span-2 flex gap-3">
                    <div className="flex-1 bg-white p-3 rounded-xl shadow-sm border border-gray-100 flex flex-col justify-center">
                        <span className="text-[10px] text-gray-400 block uppercase mb-1">Join Date</span>
                        <span className="font-bold text-gray-800 text-sm">{data.startDate}</span>
                    </div>
                    {/* 🌟 SERVICE DURATION (လုပ်သက်) လှလှလေး ပြောင်းထားသည် 🌟 */}
                    <div className="w-[140px] bg-gradient-to-br from-yellow-50 to-yellow-100 p-2 rounded-xl shadow-sm border border-yellow-200 flex flex-col justify-center items-center">
                        <span className="text-[9px] text-yellow-600 uppercase font-bold mb-0.5 text-center leading-tight">SERVICE DURATION (လုပ်သက်)</span>
                        <span className="text-[#123524] font-black text-xs mt-0.5 text-center">{calculateDuration(data.startDate)}</span>
                    </div>
                </div>

                <div className="col-span-2 bg-white p-3 rounded-xl shadow-sm border border-gray-100">
                    <span className="text-[10px] text-gray-400 block uppercase">Address</span>
                    <span className="font-bold text-gray-800 leading-relaxed block mt-1">{data.address}</span>
                </div>

                <div className="col-span-2 bg-red-50 p-4 rounded-xl shadow-sm border border-red-100">
                    <span className="text-[10px] text-red-500 block uppercase font-bold tracking-wider mb-2">Emergency Contact</span>
                    <div className="flex justify-between items-center gap-3">
                        <div className="flex-1 bg-white/70 p-3 rounded-lg border border-red-100/50">
                            <span className="text-[9px] text-gray-500 block mb-0.5">Name & Relation</span>
                            <span className="text-sm font-bold text-red-700 leading-tight block">{data.emergencyName} <br/><span className="text-xs text-red-500/80">({data.emergencyRelation})</span></span>
                        </div>
                        <div className="flex-1 bg-white/70 p-3 rounded-lg border border-red-100/50">
                            <span className="text-[9px] text-gray-500 block mb-0.5">Phone Number</span>
                            <span className="text-sm font-bold text-red-700 font-mono block mt-1">{data.emergencyPhone}</span>
                        </div>
                    </div>
                </div>
            </div>

            <h4 className="font-bold text-xs text-gray-500 mb-2 uppercase tracking-wider">Document Photos</h4>
            <div className="grid grid-cols-2 gap-4">
                <div>
                    <span className="text-[10px] text-gray-400 block uppercase mb-1">NRC (Front)</span>
                    {data.nrcFrontUrl ? <img src={data.nrcFrontUrl} onClick={() => setViewingPhoto(data.nrcFrontUrl)} className="w-full h-32 object-cover rounded-xl border border-gray-200 cursor-pointer hover:opacity-80 transition"/> : <div className="h-32 bg-gray-200 rounded-xl flex items-center justify-center text-[10px] text-gray-400">No Image</div>}
                </div>
                <div>
                    <span className="text-[10px] text-gray-400 block uppercase mb-1">NRC (Back)</span>
                    {data.nrcBackUrl ? <img src={data.nrcBackUrl} onClick={() => setViewingPhoto(data.nrcBackUrl)} className="w-full h-32 object-cover rounded-xl border border-gray-200 cursor-pointer hover:opacity-80 transition"/> : <div className="h-32 bg-gray-200 rounded-xl flex items-center justify-center text-[10px] text-gray-400">No Image</div>}
                </div>
                <div>
                    <span className="text-[10px] text-gray-400 block uppercase mb-1">Household (Front)</span>
                    {data.householdFrontUrl ? <img src={data.householdFrontUrl} onClick={() => setViewingPhoto(data.householdFrontUrl)} className="w-full h-32 object-cover rounded-xl border border-gray-200 cursor-pointer hover:opacity-80 transition"/> : <div className="h-32 bg-gray-200 rounded-xl flex items-center justify-center text-[10px] text-gray-400">No Image</div>}
                </div>
                <div>
                    <span className="text-[10px] text-gray-400 block uppercase mb-1">Household (Back)</span>
                    {data.householdBackUrl ? <img src={data.householdBackUrl} onClick={() => setViewingPhoto(data.householdBackUrl)} className="w-full h-32 object-cover rounded-xl border border-gray-200 cursor-pointer hover:opacity-80 transition"/> : <div className="h-32 bg-gray-200 rounded-xl flex items-center justify-center text-[10px] text-gray-400">No Image</div>}
                </div>
            </div>

            {onClose && (
                <div className="flex gap-3 pt-6 pb-2">
                    <button type="button" onClick={onClose} className="w-full py-3 bg-gray-200 text-gray-700 font-bold rounded-lg hover:bg-gray-300 transition shadow-sm">Close</button>
                </div>
            )}

            {/* 🌟 Update Informations Button ကို အောက်ဆုံးသို့ ရွှေ့ထားသည် 🌟 */}
            {isStaffView && onEditRequest && (
                <div className="absolute bottom-0 left-0 right-0 pt-4 bg-white/80 backdrop-blur-sm border-t border-gray-100 flex justify-center">
                    <button 
                        onClick={onEditRequest} 
                        className="w-full text-sm py-3 rounded-xl shadow-md font-bold flex items-center justify-center transition-all bg-gradient-to-r from-blue-50 to-blue-100 text-blue-700 border border-blue-200 hover:shadow-lg hover:from-blue-100 hover:to-blue-200"
                    >
                        <Edit className="w-4 h-4 mr-2"/> Update Informations
                    </button>
                </div>
            )}
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

    const handleApproveUpdate = async (staffId: string, pendingData: any) => {
        if (!window.confirm("ဝန်ထမ်းပြင်ဆင်ထားသော အချက်အလက်များကို အတည်ပြုမည် သေချာပါသလား?")) return;
        try {
             await updateDoc(doc(db, 'therapists', staffId), { 
                 onboardingData: pendingData,
                 pendingOnboardingData: null,
                 updateRequested: false
             });
             alert("✅ Update လုပ်ထားသော အချက်အလက်များကို အတည်ပြုပြီးပါပြီ။");
             setViewingProfile(null);
        } catch(e) {
             alert("Error approving update.");
        }
    };

    if (loading) return <div className="text-center py-20 text-gray-500 font-bold animate-pulse">Loading HR Data...</div>;

    const pendingReqs = requests.filter(r => r.status === 'pending');
    const updateRequestedCount = activeStaff.filter(s => s.updateRequested).length;

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
                            <ProfileDetailsViewer data={selectedReq} staffId={selectedReq.staffId} isStaffView={false} />

                            <form onSubmit={handleApprove} className="bg-[#123524]/5 p-5 rounded-xl border border-[#123524]/20 space-y-4 mt-6">
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
                            <h3 className="font-bold flex items-center">
                                <User className="w-5 h-5 mr-2 text-blue-300"/> 
                                {viewingProfile.isPendingUpdate ? 'Review Staff Update Request' : 'Staff Profile Viewer'}
                            </h3>
                            <button onClick={() => setViewingProfile(null)} className="hover:text-red-400"><X className="w-5 h-5"/></button>
                        </div>
                        <div className="p-6 overflow-y-auto space-y-6 flex-1 bg-gray-50">
                            {viewingProfile.isPendingUpdate && (
                                <div className="bg-yellow-50 border border-yellow-200 p-3 rounded-lg text-yellow-800 text-xs font-bold mb-4 flex items-center">
                                    <Bell className="w-4 h-4 mr-2 animate-bounce"/> ဝန်ထမ်းမှ အချက်အလက်များ ပြင်ဆင်ရန် တောင်းဆိုထားပါသည်။ အောက်တွင် စစ်ဆေးပြီး အတည်ပြုပေးပါ။
                                </div>
                            )}
                            
                            <ProfileDetailsViewer 
                                data={viewingProfile.data} 
                                staffId={viewingProfile.staffId} 
                                onClose={() => setViewingProfile(null)}
                                isStaffView={false}
                            />
                            
                            {viewingProfile.isPendingUpdate && (
                                <div className="flex gap-3 pt-4 border-t border-gray-200">
                                    <button 
                                        onClick={() => handleApproveUpdate(viewingProfile.staffId, viewingProfile.data)} 
                                        className="w-full py-3 bg-green-600 text-white font-bold rounded-lg hover:bg-green-700 shadow-md"
                                    >
                                        Approve Updates
                                    </button>
                                </div>
                            )}
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
                <button onClick={() => setViewTab('active')} className={`px-4 py-2 text-xs font-bold rounded-lg transition relative ${viewTab === 'active' ? 'bg-white shadow text-[#123524]' : 'text-gray-500 hover:bg-gray-100'}`}>
                    Active Staff List
                    {updateRequestedCount > 0 && <span className="absolute -top-1 -right-1 w-3 h-3 bg-orange-500 rounded-full animate-pulse"></span>}
                </button>
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
                        <div key={staff.id} className={`p-4 bg-white border rounded-xl shadow-sm flex flex-col relative overflow-hidden transition-all ${staff.updateRequested ? 'border-orange-300 bg-orange-50/30' : 'border-gray-200'}`}>
                            
                            {staff.updateRequested && (
                                <div className="absolute top-0 left-0 bg-orange-500 text-white text-[9px] px-2 py-0.5 rounded-br-lg font-bold flex items-center shadow-sm z-10 animate-pulse">
                                    <Bell className="w-3 h-3 mr-1"/> Update Requested
                                </div>
                            )}

                            <div className="absolute top-0 right-0 bg-gray-100 text-gray-500 text-[9px] px-2 py-0.5 rounded-bl-lg font-mono font-bold border-b border-l border-gray-200">{staff.id}</div>
                            <div className="flex justify-between items-start mb-3 border-b border-gray-50 pb-2 pt-4">
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
                                    <button 
                                        onClick={() => setViewingProfile({
                                            data: staff.updateRequested ? staff.pendingOnboardingData : staff.onboardingData, 
                                            staffId: staff.id,
                                            isPendingUpdate: staff.updateRequested
                                        })} 
                                        className={`w-full mb-2 py-2 text-[10px] font-bold rounded-lg border transition ${staff.updateRequested ? 'bg-orange-100 text-orange-800 border-orange-300 hover:bg-orange-200' : 'bg-gray-100 text-gray-700 border-gray-200 hover:bg-gray-200'}`}
                                    >
                                        {staff.updateRequested ? 'Review Update Request' : 'View Form Details'}
                                    </button>
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
    
    const [liveStaffData, setLiveStaffData] = useState<any>(staff);
    const [isEditing, setIsEditing] = useState(false);

    useEffect(() => {
        if (!staff || !staff.id) return;
        const unsub = onSnapshot(doc(db, 'therapists', staff.id), (docSnap) => {
            if (docSnap.exists()) {
                setLiveStaffData({ id: docSnap.id, ...docSnap.data() });
            }
        });
        return () => unsub();
    }, [staff?.id]);

    if (isEditing) {
        return <NewEmployeeOnboardingForm onBack={() => setIsEditing(false)} existingStaffId={liveStaffData.id} existingData={liveStaffData.onboardingData} isStaffSelfEdit={true} />;
    }

    if (!liveStaffData?.onboardingData) {
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

    const data = liveStaffData.onboardingData;

    return (
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 animate-fade-in mt-4">
            
            {liveStaffData.updateRequested && (
                <div className="mb-4 bg-orange-50 border border-orange-200 p-3 rounded-xl flex items-start shadow-sm">
                    <FileText className="w-5 h-5 text-orange-500 mr-2 flex-shrink-0 mt-0.5" />
                    <div>
                        <h4 className="text-xs font-bold text-orange-800">Update Requested</h4>
                        <p className="text-[10px] text-orange-600 mt-0.5">သင်ပြင်ဆင်ထားသော အချက်အလက်များကို Admin မှ စစ်ဆေးနေပါသည်။ အတည်ပြုပြီးမှသာ Profile တွင် ပြောင်းလဲသွားပါမည်။</p>
                    </div>
                </div>
            )}

            <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-gray-100 pb-4 mb-4 gap-4">
                <h3 className="font-bold text-[#123524] text-lg">
                    My Profile Details
                </h3>
            </div>
            
            <ProfileDetailsViewer 
                data={data} 
                staffId={liveStaffData.id} 
                therapistName={liveStaffData.name} 
                isStaffView={true} 
                onEditRequest={!liveStaffData.updateRequested ? () => setIsEditing(true) : undefined}
            />
        </div>
    );
}
