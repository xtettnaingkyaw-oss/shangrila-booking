import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, addDoc, deleteDoc, updateDoc, doc, query, orderBy } from 'firebase/firestore';
import { db } from '../firebase';
import { Calendar, Wallet, Banknote, Trash2, X, CheckCircle, Search } from 'lucide-react';
import { THEME, formatPrice } from '../shared';

const CATEGORIES = [
  "ဆိုင်သန့်ရှင်းရေးတာဝန် ပျက်ကွက်ခြင်း", 
  "Out Pass စည်းကမ်းများ", 
  "Jibble Clock In/ Clock Out စည်းကမ်းများ", 
  "ဆူညံခြင်း၊ ဂိမ်းကစားခြင်း၊ စလော့ဆော့ခြင်း", 
  "ဧည့်သည်အား ဝန်ဆောင်မှုအားနည်းခြင်း", 
  "စည်းကမ်းမဲ့ ဆေးလိပ်၊ အရက်၊ မူးယစ်ဆေးသုံးခြင်း၊ ဝန်ထမ်းအချင်းချင်း ရန်ဖြစ်ခြင်း", 
  "မီးဖိုချောင်စည်းကမ်း ဖောက်ဖျက်ခြင်း", 
  "အိပ်ချိန်စည်းကမ်း ဖောက်ဖျက်ခြင်း", 
  "အခြား ဖောက်ဖျက်မှုများ"
];

// Helper functions
const getDaysOverdue = (dateStr: string) => {
  const dToday = new Date();
  dToday.setHours(0, 0, 0, 0);
  const pDate = new Date(dateStr);
  pDate.setHours(0, 0, 0, 0);
  const diffTime = dToday.getTime() - pDate.getTime();
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
  return diffDays > 0 ? diffDays : 0;
};

const calculateAmount = (p: any) => {
  if (p.isPaid) return Number(p.finalAmount || p.amount); 
  const days = getDaysOverdue(p.date);
  return Number(p.amount) * Math.pow(2, days); 
};

// ==========================================
// 1. ADMIN PENALTY & LOAN MANAGEMENT VIEW
// ==========================================
export function AdminPenaltyManager({ therapists }: { therapists: any[] }) {
  const uniqueTherapists = Array.from(new Map(therapists.map(t => [t.name, t])).values());

  const [subTab, setSubTab] = useState<'dashboard' | 'add' | 'history' | 'deposits' | 'loans'>('dashboard');
  const [penalties, setPenalties] = useState<any[]>([]);
  const [deposits, setDeposits] = useState<any[]>([]); 
  const [loans, setLoans] = useState<any[]>([]); 
  const [selectedTherapist, setSelectedTherapist] = useState<any>(null);
  
  const [formData, setFormData] = useState({ therapistId: uniqueTherapists[0]?.id || '1', category: CATEGORIES[0], amount: '', remark: '', date: new Date().toISOString().split('T')[0] });
  const [depositForm, setDepositForm] = useState({ therapistId: uniqueTherapists[0]?.id || '1', amount: '', note: '' });
  const [loanForm, setLoanForm] = useState({ therapistId: uniqueTherapists[0]?.id || '1', amount: '', note: '', date: new Date().toISOString().split('T')[0], type: 'borrow', repayMethod: 'cash' });

  const today = new Date();
  const currentYear = today.getFullYear();
  const currentMonth = String(today.getMonth() + 1).padStart(2, '0');
  const lastDayOfMonth = new Date(currentYear, today.getMonth() + 1, 0).getDate();
  
  const [startDate, setStartDate] = useState(`${currentYear}-${currentMonth}-01`);
  const [endDate, setEndDate] = useState(`${currentYear}-${currentMonth}-${lastDayOfMonth}`);

  const [historyFilter, setHistoryFilter] = useState('');
  const [depositFilter, setDepositFilter] = useState('');
  const [loanFilter, setLoanFilter] = useState('');

  useEffect(() => {
    const unsubP = onSnapshot(query(collection(db, 'penalties'), orderBy('createdAt', 'desc')), snap => setPenalties(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
    const unsubD = onSnapshot(query(collection(db, 'deposits'), orderBy('createdAt', 'desc')), snap => setDeposits(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
    const unsubL = onSnapshot(query(collection(db, 'loans'), orderBy('createdAt', 'desc')), snap => setLoans(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
    return () => { unsubP(); unsubD(); unsubL(); };
  }, []);

  const filteredPenalties = penalties.filter(p => (!startDate || p.date >= startDate) && (!endDate || p.date <= endDate) && (historyFilter === '' || String(p.therapistId) === historyFilter));
  const filteredLoans = loans.filter(l => (!startDate || l.date >= startDate) && (!endDate || l.date <= endDate) && (loanFilter === '' || String(l.therapistId) === loanFilter));
  const filteredDeposits = deposits.filter(d => (!startDate || d.date >= startDate) && (!endDate || d.date <= endDate) && (depositFilter === '' || String(d.therapistId) === depositFilter));

  const getStats = (id: string, name: string) => {
    const p = penalties.filter(item => String(item.therapistId) === String(id) || item.therapistName === name);
    const unpaid = p.filter(item => !item.isPaid);
    const paid = p.filter(item => item.isPaid);
    
    const totalUnpaid = unpaid.reduce((sum, item) => sum + calculateAmount(item), 0);
    const totalPaid = paid.reduce((sum, item) => sum + calculateAmount(item), 0);
    
    const d_all = deposits.filter(item => String(item.therapistId) === String(id) || item.therapistName === name);
    const depositBalance = d_all.reduce((sum, item) => sum + Number(item.amount), 0);

    const l_all = loans.filter(item => String(item.therapistId) === String(id) || item.therapistName === name);
    const totalLoan = l_all.reduce((sum, item) => sum + Number(item.amount), 0);
    
    const l_filtered = filteredLoans.filter(item => String(item.therapistId) === String(id) || item.therapistName === name);

    return { count: p.length, unpaidCount: unpaid.length, totalUnpaid, totalPaid, depositBalance, totalLoan, list: p, loanList: l_filtered };
  };

  const handleSubmitPenalty = async (e: React.FormEvent) => {
    e.preventDefault();
    if(!formData.amount) return alert("ပမာဏဖြည့်ပါ");
    const tObj = uniqueTherapists.find(t => String(t.id) === String(formData.therapistId));
    await addDoc(collection(db, 'penalties'), { 
      ...formData, 
      amount: Number(formData.amount), 
      therapistName: tObj?.name || 'Unknown', 
      isPaid: false, 
      createdAt: Date.now() 
    });
    setFormData({...formData, amount: '', remark: ''});
    alert("ဒဏ်ကြေး မှတ်တမ်းတင်ပြီးပါပြီ");
    setSubTab('dashboard');
  };

  const handleSubmitDeposit = async (e: React.FormEvent) => {
    e.preventDefault();
    if(!depositForm.amount) return alert("ပမာဏဖြည့်ပါ");
    const tObj = uniqueTherapists.find(t => String(t.id) === String(depositForm.therapistId));
    await addDoc(collection(db, 'deposits'), {
      therapistId: depositForm.therapistId,
      therapistName: tObj?.name || 'Unknown',
      amount: Number(depositForm.amount), 
      date: new Date().toISOString().split('T')[0],
      type: 'deposit',
      note: depositForm.note || 'အပ်ငွေသွင်းခြင်း',
      createdAt: Date.now()
    });
    setDepositForm({...depositForm, amount: '', note: ''});
    alert("အပ်ငွေ မှတ်တမ်းတင်ပြီးပါပြီ");
  };

  const handleSubmitLoan = async (e: React.FormEvent) => {
    e.preventDefault();
    if(!loanForm.amount) return alert("ပမာဏဖြည့်ပါ");
    const tObj = uniqueTherapists.find(t => String(t.id) === String(loanForm.therapistId));
    const amountNum = Number(loanForm.amount);
    let finalAmount = amountNum;
    let finalNote = loanForm.note;

    if (loanForm.type === 'repay') {
      const currentBalance = getStats(loanForm.therapistId, tObj?.name || '').totalLoan;
      if (amountNum > currentBalance) return alert(`လက်ကျန် ကြိုထုတ်ငွေ (${currentBalance.toLocaleString()} Ks) ထက် ကျော်လွန်၍ ဆပ်၍မရပါ။`);
      finalAmount = -amountNum;
      finalNote = !finalNote ? (loanForm.repayMethod === 'cash' ? 'လက်ငင်းငွေဖြင့် ပြန်ဆပ်သည်' : 'လစာထဲမှ နှုတ်၍ ပြန်ဆပ်သည်') : (loanForm.repayMethod === 'cash' ? '[လက်ငင်း] ' : '[လစာဖြတ်] ') + finalNote;
    } else {
      if (!finalNote) finalNote = 'ကြိုထုတ်ငွေ';
    }

    await addDoc(collection(db, 'loans'), {
      therapistId: loanForm.therapistId,
      therapistName: tObj?.name || 'Unknown',
      amount: finalAmount, 
      date: loanForm.date,
      type: loanForm.type,
      repayMethod: loanForm.type === 'repay' ? loanForm.repayMethod : null,
      note: finalNote,
      createdAt: Date.now()
    });
    setLoanForm({...loanForm, amount: '', note: ''});
    alert("မှတ်တမ်းတင်ပြီးပါပြီ");
  };

  const handleMarkAsPaid = async (p: any, method: 'cash' | 'deposit') => {
    const currentAmt = calculateAmount(p);
    if (method === 'deposit') {
      const d = deposits.filter(item => String(item.therapistId) === String(p.therapistId) || item.therapistName === p.therapistName);
      const depositBalance = d.reduce((sum, item) => sum + Number(item.amount), 0);
      if (depositBalance < currentAmt) return alert(`အပ်ငွေလက်ကျန် (${depositBalance.toLocaleString()} Ks) မလုံလောက်ပါ။`);
      
      if(window.confirm(`အပ်ငွေထဲမှ ${currentAmt.toLocaleString()} Ks နှုတ်မည်မှာ သေချာပါသလား?`)) {
        await addDoc(collection(db, 'deposits'), {
          therapistId: p.therapistId, 
          therapistName: p.therapistName,
          amount: -currentAmt, 
          date: new Date().toISOString().split('T')[0], 
          type: 'deduction', 
          note: `${p.date} ရက်စွဲပါ ဒဏ်ကြေး ဖြတ်တောက်ခြင်း`, 
          createdAt: Date.now()
        });
        await updateDoc(doc(db, 'penalties', p.id), { isPaid: true, paidMethod: 'deposit', finalAmount: currentAmt, paidDate: new Date().toISOString().split('T')[0] });
      }
    } else {
      if(window.confirm(`လက်ငင်းငွေ ${currentAmt.toLocaleString()} Ks ပေးဆောင်မည်မှာ သေချာပါသလား?`)) {
        await updateDoc(doc(db, 'penalties', p.id), { isPaid: true, paidMethod: 'cash', finalAmount: currentAmt, paidDate: new Date().toISOString().split('T')[0] });
      }
    }
  };

  return (
    <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200 mt-6">
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center mb-6 border-b border-gray-100 pb-4">
        <h2 className="text-xl font-bold flex items-center" style={{ color: THEME.primary }}><Banknote className="mr-2 text-[#D4AF37]" /> ဝန်ထမ်း ဒဏ်ကြေး၊ အပ်ငွေနှင့် ကြိုထုတ်ငွေ စီမံခန့်ခွဲမှု</h2>
        <div className="flex space-x-2 bg-gray-50 p-1 rounded-lg border border-gray-200 w-full lg:w-auto overflow-x-auto mt-3 lg:mt-0">
          <button onClick={() => setSubTab('dashboard')} className={`px-3 py-1.5 text-xs font-bold rounded transition ${subTab === 'dashboard' ? 'bg-white shadow text-[#123524]' : 'text-gray-500'}`}>Overview</button>
          <button onClick={() => setSubTab('add')} className={`px-3 py-1.5 text-xs font-bold rounded transition ${subTab === 'add' ? 'bg-white shadow text-[#123524]' : 'text-gray-500'}`}>Issue Penalty</button>
          <button onClick={() => setSubTab('history')} className={`px-3 py-1.5 text-xs font-bold rounded transition ${subTab === 'history' ? 'bg-white shadow text-[#123524]' : 'text-gray-500'}`}>Penalties History</button>
          <button onClick={() => setSubTab('deposits')} className={`px-3 py-1.5 text-xs font-bold rounded transition ${subTab === 'deposits' ? 'bg-white shadow text-[#123524]' : 'text-gray-500'}`}>Deposits</button>
          <button onClick={() => setSubTab('loans')} className={`px-3 py-1.5 text-xs font-bold rounded transition ${subTab === 'loans' ? 'bg-white shadow text-[#123524]' : 'text-gray-500'}`}>Loans / Advance</button>
        </div>
      </div>

      {(subTab === 'dashboard' || subTab === 'history' || subTab === 'loans' || subTab === 'deposits') && (
        <div className="bg-gray-50 p-3 rounded-xl border border-gray-200 mb-6 flex flex-col sm:flex-row gap-3 items-center justify-between">
          <span className="text-xs font-bold text-gray-700 flex items-center"><Calendar size={16} className="mr-1.5 text-[#D4AF37]" /> ရက်စွဲအလိုက် စစ်ထုတ်ရန်:</span>
          <div className="flex gap-2 items-center w-full sm:w-auto">
            <input type="date" className="border border-gray-300 p-2 rounded-lg text-xs outline-none focus:ring-1 focus:ring-[#D4AF37]" value={startDate} onChange={e => setStartDate(e.target.value)} />
            <span className="text-gray-400 font-bold">-</span>
            <input type="date" className="border border-gray-300 p-2 rounded-lg text-xs outline-none focus:ring-1 focus:ring-[#D4AF37]" value={endDate} onChange={e => setEndDate(e.target.value)} />
          </div>
        </div>
      )}

      {subTab === 'dashboard' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {uniqueTherapists.map(t => {
            const stats = getStats(t.id, t.name);
            const hasUnpaid = stats.unpaidCount > 0;
            const cardClass = hasUnpaid ? 'border-red-300 bg-red-50/40' : 'border-gray-200 bg-gray-50/40';

            return (
              <div key={t.id} onClick={() => setSelectedTherapist({...t, ...stats})} className={`p-4 rounded-xl border cursor-pointer hover:shadow-md transition-all relative overflow-hidden ${cardClass}`}>
                {stats.depositBalance > 0 && <span className="absolute top-0 left-0 bg-blue-600 text-white text-[9px] px-2 py-0.5 rounded-br font-bold">အပ်ငွေ: {formatPrice(stats.depositBalance)}</span>}
                {hasUnpaid && <span className="absolute top-0 right-0 bg-red-500 text-white text-[9px] px-2 py-0.5 rounded-bl font-bold">ဒဏ်ကြေးရှိ</span>}
                
                <h3 className="font-bold text-[#123524] text-base mt-2">{t.name}</h3>
                <div className="mt-2 space-y-1 text-xs">
                  {stats.totalUnpaid > 0 && <p className="font-bold text-red-600">မဆောင်ရသေး: {formatPrice(stats.totalUnpaid)} ({stats.unpaidCount} ခု)</p>}
                  {stats.totalPaid > 0 && <p className="font-bold text-green-700">ပေးဆောင်ပြီး: {formatPrice(stats.totalPaid)}</p>}
                  {stats.totalLoan > 0 && <p className="font-bold text-purple-700">ကြိုထုတ်ငွေ: {formatPrice(stats.totalLoan)}</p>}
                  {stats.count === 0 && stats.totalLoan === 0 && stats.depositBalance === 0 && <p className="text-gray-400 font-semibold">မှတ်တမ်းမရှိပါ</p>}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {subTab === 'add' && (
        <form onSubmit={handleSubmitPenalty} className="max-w-lg mx-auto bg-gray-50 p-6 rounded-2xl border border-gray-200 space-y-4">
          <h3 className="font-bold text-base text-[#123524]">ဝန်ထမ်း ဒဏ်ကြေးအသစ် တပ်ဆင်ရန်</h3>
          <div>
            <label className="block text-xs font-bold text-gray-600 mb-1">ဝန်ထမ်းရွေးချယ်ရန်</label>
            <select className="w-full p-3 border rounded-xl text-xs bg-white font-bold" value={formData.therapistId} onChange={e => setFormData({...formData, therapistId: e.target.value})}>
              {uniqueTherapists.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-600 mb-1">ရက်စွဲ</label>
            <input type="date" className="w-full p-3 border rounded-xl text-xs bg-white font-bold" value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})} required/>
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-600 mb-1">ဖောက်ဖျက်မှု အကြောင်းအရာ</label>
            <select className="w-full p-3 border rounded-xl text-xs bg-white font-bold" value={formData.category} onChange={e => setFormData({...formData, category: e.target.value})}>
              {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-600 mb-1">အခြေခံ ဒဏ်ကြေးပမာဏ (ကျပ်)</label>
            <input type="number" placeholder="ဥပမာ - 5000" className="w-full p-3 border rounded-xl text-xs bg-white font-bold" value={formData.amount} onChange={e => setFormData({...formData, amount: e.target.value})} required min="0"/>
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-600 mb-1">မှတ်ချက် (Optional)</label>
            <textarea placeholder="အသေးစိတ်ဖော်ပြရန်..." className="w-full p-3 border rounded-xl text-xs bg-white" value={formData.remark} onChange={e => setFormData({...formData, remark: e.target.value})} rows={2} />
          </div>
          <button className="w-full py-3.5 bg-[#123524] text-[#D4AF37] rounded-xl font-bold text-xs shadow hover:bg-[#1a4a32] transition uppercase tracking-wider">ဒဏ်ကြေး မှတ်တမ်းတင်မည်</button>
        </form>
      )}

      {subTab === 'history' && (
        <div className="bg-white rounded-xl shadow overflow-hidden border border-gray-200">
          <h3 className="p-4 bg-gray-50 font-bold text-gray-700 border-b flex justify-between items-center">
            <span>ဒဏ်ကြေး မှတ်တမ်းများ</span>
            <select value={historyFilter} onChange={e => setHistoryFilter(e.target.value)} className="p-2 border border-gray-300 rounded-lg text-xs outline-none bg-white focus:border-[#D4AF37] font-bold shadow-sm">
              <option value="">All Therapists</option>
              {uniqueTherapists.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[700px]">
              <thead>
                <tr className="bg-white border-b-2 border-gray-100 text-xs text-gray-500 uppercase">
                  <th className="p-3">Name / Date</th>
                  <th className="p-3">Category & Status</th>
                  <th className="p-3 text-right">Amount</th>
                  <th className="p-3 text-center">Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredPenalties.map(p => {
                  const days = getDaysOverdue(p.date);
                  const amount = calculateAmount(p);
                  const isOverdue = !p.isPaid && days > 0;
                  return (
                    <tr key={p.id} className="border-b border-gray-50 hover:bg-gray-50 text-xs">
                      <td className="p-3">
                        <div className="font-bold text-[#123524] text-sm">{p.therapistName}</div>
                        <div className="text-gray-500 font-bold text-[10px] mt-0.5">{p.date}</div>
                      </td>
                      <td className="p-3">
                        <div className="font-semibold text-gray-800">{p.category}</div>
                        {p.remark && <div className="text-red-500 text-[11px] mt-0.5">- {p.remark}</div>}
                        <div className="mt-1.5">
                          {p.isPaid ? (
                            <span className={`px-2 py-0.5 rounded text-[9px] font-bold ${p.paidMethod === 'deposit' ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'}`}>
                              {p.paidMethod === 'deposit' ? 'အပ်ငွေမှ နှုတ်ပြီး' : 'ပေးဆောင်ပြီး'}
                            </span>
                          ) : (
                            <span className={`px-2 py-0.5 rounded text-[9px] font-bold ${isOverdue ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'}`}>
                              {isOverdue ? `ရက်လွန် (${days} ရက်)` : 'ယနေ့ဆောင်ရန်'}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className={`p-3 text-right font-black text-sm ${p.isPaid ? 'text-green-600' : 'text-red-600'}`}>{formatPrice(amount)}</td>
                      <td className="p-3 text-center">
                        <div className="flex justify-center gap-1.5">
                          {!p.isPaid && (
                            <>
                              <button onClick={() => handleMarkAsPaid(p, 'cash')} className="bg-green-50 text-green-700 p-1.5 rounded-lg border border-green-200 hover:bg-green-100 font-bold text-[10px]" title="လက်ငင်းပေးမည်">Cash</button>
                              <button onClick={() => handleMarkAsPaid(p, 'deposit')} className="bg-blue-50 text-blue-700 p-1.5 rounded-lg border border-blue-200 hover:bg-blue-100 font-bold text-[10px]" title="အပ်ငွေမှနှုတ်မည်">Deposit</button>
                            </>
                          )}
                          <button onClick={() => {if(window.confirm('ဖျက်ရန်သေချာပါသလား?')) deleteDoc(doc(db, 'penalties', p.id));}} className="text-red-400 hover:text-red-600 p-1.5"><Trash2 size={14}/></button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {filteredPenalties.length === 0 && <tr><td colSpan={4} className="p-8 text-center text-gray-400">မှတ်တမ်းမရှိသေးပါ။</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {subTab === 'deposits' && (
        <div className="space-y-6">
          <form onSubmit={handleSubmitDeposit} className="max-w-lg mx-auto bg-gray-50 p-6 rounded-2xl border border-gray-200 space-y-4">
            <h3 className="font-bold text-base text-[#123524] flex items-center"><Wallet className="w-4 h-4 mr-2"/> အပ်ငွေသွင်းရန်</h3>
            <select className="w-full p-3 border rounded-xl text-xs bg-white font-bold" value={depositForm.therapistId} onChange={e => setDepositForm({...depositForm, therapistId: e.target.value})}>
              {uniqueTherapists.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
            <input type="number" placeholder="အပ်ငွေပမာဏ (ကျပ်)" className="w-full p-3 border rounded-xl text-xs bg-white font-bold" value={depositForm.amount} onChange={e => setDepositForm({...depositForm, amount: e.target.value})} required min="0"/>
            <input type="text" placeholder="မှတ်ချက် (ဥပမာ- ကြိုတင်အပ်ငွေ)" className="w-full p-3 border rounded-xl text-xs bg-white" value={depositForm.note} onChange={e => setDepositForm({...depositForm, note: e.target.value})} />
            <button className="w-full py-3.5 bg-blue-600 text-white rounded-xl font-bold text-xs shadow hover:bg-blue-700 transition">အပ်ငွေ စာရင်းသွင်းမည်</button>
          </form>

          <div className="bg-white rounded-xl shadow overflow-hidden border border-gray-200">
             <h3 className="p-4 bg-gray-50 font-bold text-gray-700 border-b flex justify-between items-center">
               <span>အပ်ငွေ / အနှုတ် မှတ်တမ်းများ</span>
               <select value={depositFilter} onChange={e => setDepositFilter(e.target.value)} className="p-2 border border-gray-300 rounded-lg text-xs outline-none bg-white focus:border-[#D4AF37] font-bold shadow-sm">
                 <option value="">All Therapists</option>
                 {uniqueTherapists.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
               </select>
             </h3>
             <div className="overflow-x-auto">
               <table className="w-full text-sm text-left">
                 <thead>
                   <tr className="bg-white border-b-2 border-gray-100 text-xs text-gray-500 uppercase">
                     <th className="p-3">Name / Date</th>
                     <th className="p-3">Note</th>
                     <th className="p-3 text-right">Amount</th>
                     <th className="p-3 text-center">Action</th>
                   </tr>
                 </thead>
                 <tbody>
                   {filteredDeposits.map(d => (
                     <tr key={d.id} className="border-b hover:bg-gray-50">
                       <td className="p-3">
                         <div className="font-bold text-[#123524] text-sm">{d.therapistName}</div>
                         <div className="text-gray-500 font-bold text-[10px] mt-0.5">{d.date}</div>
                       </td>
                       <td className="p-3 text-gray-600 text-xs">{d.note}</td>
                       <td className={`p-3 text-right font-bold ${d.amount > 0 ? 'text-blue-600' : 'text-red-600'}`}>
                         {d.amount > 0 ? '+' : ''}{Number(d.amount).toLocaleString()} Ks
                       </td>
                       <td className="p-3 text-center">
                         <button onClick={() => {if(window.confirm('ဖျက်ရန်သေချာပါသလား?')) deleteDoc(doc(db, 'deposits', d.id));}} className="text-gray-400 hover:text-red-600 p-1">
                           <Trash2 size={16}/>
                         </button>
                       </td>
                     </tr>
                   ))}
                   {filteredDeposits.length === 0 && <tr><td colSpan={4} className="p-6 text-center text-gray-400">မှတ်တမ်းမရှိသေးပါ</td></tr>}
                 </tbody>
               </table>
             </div>
          </div>
        </div>
      )}

      {subTab === 'loans' && (
        <div className="space-y-6">
          <form onSubmit={handleSubmitLoan} className="max-w-lg mx-auto bg-gray-50 p-6 rounded-2xl border border-gray-200 space-y-4">
            <h3 className="font-bold text-base text-purple-900 flex items-center"><Banknote className="w-4 h-4 mr-2"/> ကြိုထုတ်ငွေ / ပြန်ဆပ်ငွေ</h3>
            <div className="flex gap-4 border-b pb-3">
              <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-purple-900"><input type="radio" name="loanType" checked={loanForm.type === 'borrow'} onChange={() => setLoanForm({...loanForm, type: 'borrow'})}/> ငွေကြိုထုတ်မည်</label>
              <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-green-700"><input type="radio" name="loanType" checked={loanForm.type === 'repay'} onChange={() => setLoanForm({...loanForm, type: 'repay'})}/> ပြန်ဆပ်မည်</label>
            </div>
            <select className="w-full p-3 border rounded-xl text-xs bg-white font-bold" value={loanForm.therapistId} onChange={e => setLoanForm({...loanForm, therapistId: e.target.value})}>
              {uniqueTherapists.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
            <input type="date" className="w-full p-3 border rounded-xl text-xs bg-white font-bold" value={loanForm.date} onChange={e => setLoanForm({...loanForm, date: e.target.value})} required/>
            {loanForm.type === 'repay' && (
              <select className="w-full p-3 border rounded-xl text-xs bg-white font-bold" value={loanForm.repayMethod} onChange={e => setLoanForm({...loanForm, repayMethod: e.target.value})}>
                <option value="cash">လက်ငင်းငွေဖြင့် ပြန်ဆပ်မည်</option>
                <option value="salary">လစာထဲမှ နှုတ်၍ ပြန်ဆပ်မည်</option>
              </select>
            )}
            <input type="number" placeholder="ပမာဏ (ကျပ်)" className="w-full p-3 border rounded-xl text-xs bg-white font-bold" value={loanForm.amount} onChange={e => setLoanForm({...loanForm, amount: e.target.value})} required min="0"/>
            <input type="text" placeholder="မှတ်ချက်" className="w-full p-3 border rounded-xl text-xs bg-white" value={loanForm.note} onChange={e => setLoanForm({...loanForm, note: e.target.value})} />
            <button className={`w-full py-3.5 text-white rounded-xl font-bold text-xs shadow transition ${loanForm.type === 'borrow' ? 'bg-purple-700 hover:bg-purple-800' : 'bg-green-600 hover:bg-green-700'}`}>
              {loanForm.type === 'borrow' ? 'ကြိုထုတ်ငွေ စာရင်းသွင်းမည်' : 'ပြန်ဆပ်ငွေ စာရင်းသွင်းမည်'}
            </button>
          </form>

          <div className="bg-white rounded-xl shadow overflow-hidden border border-gray-200">
             <h3 className="p-4 bg-purple-50 font-bold text-purple-900 border-b flex justify-between items-center">
               <span>ကြိုထုတ်ငွေ / ပြန်ဆပ်ငွေ မှတ်တမ်းများ</span>
               <select value={loanFilter} onChange={e => setLoanFilter(e.target.value)} className="p-2 border border-purple-200 rounded-lg text-xs outline-none bg-white focus:border-purple-400 font-bold shadow-sm">
                 <option value="">All Therapists</option>
                 {uniqueTherapists.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
               </select>
             </h3>
             <div className="overflow-x-auto">
               <table className="w-full text-sm text-left">
                 <thead>
                   <tr className="bg-white border-b-2 border-gray-100 text-xs text-gray-500 uppercase">
                     <th className="p-3">Name / Date</th>
                     <th className="p-3">Type & Note</th>
                     <th className="p-3 text-right">Amount</th>
                     <th className="p-3 text-center">Action</th>
                   </tr>
                 </thead>
                 <tbody>
                   {filteredLoans.map(l => (
                     <tr key={l.id} className="border-b hover:bg-purple-50">
                       <td className="p-3">
                         <div className="font-bold text-[#123524] text-sm">{l.therapistName}</div>
                         <div className="text-gray-500 font-bold text-[10px] mt-0.5">{l.date}</div>
                       </td>
                       <td className="p-3 text-gray-600 text-xs">
                         {l.amount < 0 ? (
                           <span className="bg-green-100 text-green-700 px-2 py-0.5 rounded text-[9px] font-bold mr-2">ပြန်ဆပ်</span>
                         ) : (
                           <span className="bg-purple-100 text-purple-700 px-2 py-0.5 rounded text-[9px] font-bold mr-2">ကြိုထုတ်</span>
                         )}
                         {l.note}
                       </td>
                       <td className={`p-3 text-right font-bold ${l.amount > 0 ? 'text-purple-700' : 'text-green-600'}`}>
                         {l.amount > 0 ? '+' : ''}{Number(l.amount).toLocaleString()} Ks
                       </td>
                       <td className="p-3 text-center">
                         <button onClick={() => {if(window.confirm('ဖျက်ရန်သေချာပါသလား?')) deleteDoc(doc(db, 'loans', l.id));}} className="text-gray-400 hover:text-red-600 p-1">
                           <Trash2 size={16}/>
                         </button>
                       </td>
                     </tr>
                   ))}
                   {filteredLoans.length === 0 && <tr><td colSpan={4} className="p-6 text-center text-gray-400">မှတ်တမ်းမရှိသေးပါ</td></tr>}
                 </tbody>
               </table>
             </div>
          </div>
        </div>
      )}

      {selectedTherapist && (
        <div className="fixed inset-0 z-[9999] bg-black/60 flex items-center justify-center p-4 animate-fade-in" onClick={() => setSelectedTherapist(null)}>
          <div className="bg-white w-full max-w-md rounded-2xl p-6 shadow-2xl relative max-h-[85vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <button onClick={() => setSelectedTherapist(null)} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 bg-gray-100 p-1.5 rounded-full"><X size={18}/></button>
            <h3 className="font-bold text-[#123524] text-lg border-b pb-3 mb-4">{selectedTherapist.name} - အသေးစိတ်မှတ်တမ်း</h3>
            
            <div className="overflow-y-auto space-y-4 pr-1">
              <div>
                <h4 className="text-xs font-bold text-gray-500 uppercase mb-2">ဒဏ်ကြေးများ</h4>
                {selectedTherapist.list.length === 0 ? <p className="text-xs text-gray-400">ဒဏ်ကြေး မှတ်တမ်းမရှိပါ။</p> : (
                  selectedTherapist.list.map((p: any) => (
                    <div key={p.id} className={`p-3 rounded-xl border text-xs mb-2 ${p.isPaid ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
                      <div className="flex justify-between font-bold mb-1">
                        <span>{p.date}</span>
                        <span className={p.isPaid ? 'text-green-700' : 'text-red-600'}>{formatPrice(calculateAmount(p))}</span>
                      </div>
                      <p className="text-gray-700">{p.category} {p.remark ? `- ${p.remark}` : ''}</p>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ==========================================
// 2. STAFF PENALTY & LOAN VIEW (For Staff App)
// ==========================================
export function StaffPenaltyView({ therapistName }: { therapistName: string }) {
  const [penalties, setPenalties] = useState<any[]>([]);
  const [loans, setLoans] = useState<any[]>([]);
  const [deposits, setDeposits] = useState<any[]>([]);
  
  // 🌟 Active Sub-Tab (default: penalties) 🌟
  const [activeView, setActiveView] = useState<'penalties' | 'loans' | 'deposits'>('penalties');

  useEffect(() => {
    const unsubP = onSnapshot(collection(db, 'penalties'), snap => setPenalties(snap.docs.map(d => ({ id: d.id, ...d.data() })).filter((p: any) => p.therapistName === therapistName).sort((a:any, b:any) => b.createdAt - a.createdAt)));
    const unsubL = onSnapshot(collection(db, 'loans'), snap => setLoans(snap.docs.map(d => ({ id: d.id, ...d.data() })).filter((l: any) => l.therapistName === therapistName).sort((a:any, b:any) => b.createdAt - a.createdAt)));
    const unsubD = onSnapshot(collection(db, 'deposits'), snap => setDeposits(snap.docs.map(d => ({ id: d.id, ...d.data() })).filter((d: any) => d.therapistName === therapistName).sort((a:any, b:any) => b.createdAt - a.createdAt)));
    return () => { unsubP(); unsubL(); unsubD(); };
  }, [therapistName]);

  const totalUnpaidPenalties = penalties.filter(p => !p.isPaid).reduce((sum, p) => sum + calculateAmount(p), 0);
  const totalLoanBalance = loans.reduce((sum, l) => sum + Number(l.amount), 0);
  const totalDeposit = deposits.reduce((sum, d) => sum + Number(d.amount), 0);

  return (
    <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 mt-6 animate-fade-in">
      <h3 className="text-base font-bold text-[#123524] mb-4 flex items-center"><Banknote className="w-5 h-5 mr-2 text-[#D4AF37]"/> ကျွန်ုပ်၏ ဒဏ်ကြေးနှင့် ချေးငွေစာရင်း</h3>
      
      {/* Clickable Summary Tabs */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        <div 
          onClick={() => setActiveView('penalties')}
          className={`p-3 rounded-xl border text-center cursor-pointer transition-all ${activeView === 'penalties' ? 'bg-red-50 border-red-400 shadow-md scale-[1.02]' : 'bg-red-50/40 border-red-100 hover:border-red-300'}`}
        >
          <span className="text-[10px] font-bold text-red-600 uppercase block">မဆောင်ရသေး ဒဏ်ကြေး</span>
          <span className="text-sm sm:text-base font-black text-red-700">{formatPrice(totalUnpaidPenalties)}</span>
        </div>
        <div 
          onClick={() => setActiveView('loans')}
          className={`p-3 rounded-xl border text-center cursor-pointer transition-all ${activeView === 'loans' ? 'bg-purple-50 border-purple-400 shadow-md scale-[1.02]' : 'bg-purple-50/40 border-purple-100 hover:border-purple-300'}`}
        >
          <span className="text-[10px] font-bold text-purple-700 uppercase block">ကြိုထုတ်ငွေ လက်ကျန်</span>
          <span className="text-sm sm:text-base font-black text-purple-800">{formatPrice(totalLoanBalance)}</span>
        </div>
        <div 
          onClick={() => setActiveView('deposits')}
          className={`p-3 rounded-xl border text-center cursor-pointer transition-all ${activeView === 'deposits' ? 'bg-blue-50 border-blue-400 shadow-md scale-[1.02]' : 'bg-blue-50/40 border-blue-100 hover:border-blue-300'}`}
        >
          <span className="text-[10px] font-bold text-blue-700 uppercase block">အပ်ငွေ လက်ကျန်</span>
          <span className="text-sm sm:text-base font-black text-blue-800">{formatPrice(totalDeposit)}</span>
        </div>
      </div>

      <div className="space-y-6">
        
        {/* Penalties View */}
        {activeView === 'penalties' && (
          <div className="animate-fade-in">
            <h4 className="text-xs font-bold text-gray-700 mb-3 uppercase tracking-wider border-b pb-2">ဒဏ်ကြေး မှတ်တမ်းများ</h4>
            <div className="space-y-2.5">
              {penalties.length === 0 ? <p className="text-xs text-gray-400 text-center py-4 bg-gray-50 rounded-xl">ဒဏ်ကြေး မှတ်တမ်း မရှိပါ</p> : (
                penalties.map(p => {
                  const days = getDaysOverdue(p.date);
                  const amount = calculateAmount(p);
                  const isOverdue = !p.isPaid && days > 0;
                  
                  return (
                    <div key={p.id} className={`p-3.5 rounded-xl border text-xs flex flex-col ${p.isPaid ? 'bg-green-50/60 border-green-200' : 'bg-red-50 border-red-200'}`}>
                      <div className="flex justify-between items-start mb-1.5">
                        <span className="font-bold text-gray-800 text-sm">{p.date}</span>
                        <div className="text-right">
                          <span className={`font-black text-sm ${p.isPaid ? 'text-green-700' : 'text-red-600'}`}>{formatPrice(amount)}</span>
                        </div>
                      </div>
                      
                      <p className="font-semibold text-gray-700">{p.category}</p>
                      {p.remark && <p className="text-red-500 font-semibold text-[11px] mt-1">- {p.remark}</p>}
                      
                      <div className="mt-2 pt-2 border-t border-gray-200/60 flex justify-between items-center">
                        {p.isPaid ? (
                          <span className="text-[10px] font-bold text-green-700 bg-green-100 px-2 py-0.5 rounded">✓ ပေးဆောင်ပြီး ({p.paidMethod === 'deposit' ? 'အပ်ငွေမှနှုတ်သည်' : 'လက်ငင်း'})</span>
                        ) : (
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${isOverdue ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'}`}>
                            {isOverdue ? `! ရက်လွန်နေသည် (${days} ရက်)` : '• ယနေ့ဆောင်ရန်'}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}

        {/* Deposits View */}
        {activeView === 'deposits' && (
          <div className="animate-fade-in">
            <h4 className="text-xs font-bold text-gray-700 mb-3 uppercase tracking-wider border-b pb-2">အပ်ငွေ / ဖြတ်တောက်မှု မှတ်တမ်းများ</h4>
            <div className="space-y-2.5">
              {deposits.length === 0 ? <p className="text-xs text-gray-400 text-center py-4 bg-gray-50 rounded-xl">အပ်ငွေ မှတ်တမ်း မရှိပါ</p> : (
                deposits.map(d => (
                  <div key={d.id} className={`p-3.5 rounded-xl border text-xs flex flex-col ${d.amount > 0 ? 'bg-blue-50 border-blue-200' : 'bg-red-50 border-red-200'}`}>
                    <div className="flex justify-between items-start mb-1.5">
                      <span className="font-bold text-gray-800 text-sm">{d.date}</span>
                      <span className={`font-black text-sm ${d.amount > 0 ? 'text-blue-600' : 'text-red-600'}`}>
                        {d.amount > 0 ? '+' : ''}{formatPrice(Number(d.amount))}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      {d.amount < 0 ? (
                        <span className="bg-red-100 text-red-700 px-2 py-0.5 rounded text-[10px] font-bold">နှုတ်ယူမှု</span>
                      ) : (
                        <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded text-[10px] font-bold">အပ်ငွေသွင်း</span>
                      )}
                      <span className="text-gray-600 font-semibold">{d.note}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* Loans View */}
        {activeView === 'loans' && (
          <div className="animate-fade-in">
            <h4 className="text-xs font-bold text-gray-700 mb-3 uppercase tracking-wider border-b pb-2">ကြိုထုတ်ငွေ / ပြန်ဆပ်ငွေ မှတ်တမ်းများ</h4>
            <div className="space-y-2.5">
              {loans.length === 0 ? <p className="text-xs text-gray-400 text-center py-4 bg-gray-50 rounded-xl">ချေးငွေ မှတ်တမ်း မရှိပါ</p> : (
                loans.map(l => (
                  <div key={l.id} className={`p-3.5 rounded-xl border text-xs flex flex-col ${l.amount > 0 ? 'bg-purple-50 border-purple-200' : 'bg-green-50 border-green-200'}`}>
                    <div className="flex justify-between items-start mb-1.5">
                      <span className="font-bold text-gray-800 text-sm">{l.date}</span>
                      <span className={`font-black text-sm ${l.amount > 0 ? 'text-purple-700' : 'text-green-700'}`}>
                        {l.amount > 0 ? '' : '-'}{formatPrice(Math.abs(Number(l.amount)))}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      {l.amount < 0 ? (
                        <span className="bg-green-100 text-green-700 px-2 py-0.5 rounded text-[10px] font-bold">ပြန်ဆပ်</span>
                      ) : (
                        <span className="bg-purple-100 text-purple-700 px-2 py-0.5 rounded text-[10px] font-bold">ကြိုထုတ်</span>
                      )}
                      <span className="text-gray-600 font-semibold">{l.note}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
