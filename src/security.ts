import CryptoJS from 'crypto-js';

// မိမိစိတ်ကြိုက် လျှို့ဝှက် Key (ဒီ Key ကို ဘယ်သူ့ကိုမှ မပေးရပါ)
const SECRET_KEY = "Shangrila@2026!SecureKey_V1_tSn2171996"; 

// (၁) မူလစာသားကို Secure Code အဖြစ် ပြောင်းပေးမည့် Function
export const encryptText = (text: string | null | undefined): string => {
    if (!text) return "";
    return CryptoJS.AES.encrypt(text, SECRET_KEY).toString();
};

// (၂) Secure Code ကြီးကို မူလစာသားအစစ် ပြန်ပြောင်းပေးမည့် Function
export const decryptText = (cipherText: string | null | undefined): string => {
    if (!cipherText) return "";
    try {
        const bytes = CryptoJS.AES.decrypt(cipherText, SECRET_KEY);
        const originalText = bytes.toString(CryptoJS.enc.Utf8);
        return originalText || cipherText; // အကယ်၍ ပြောင်းလို့မရရင် မူလစာသားကိုပဲ ပြန်ထုတ်ပေးမည်
    } catch (error) {
        return cipherText; 
    }
};
