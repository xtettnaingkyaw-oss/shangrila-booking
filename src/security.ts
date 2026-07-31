import CryptoJS from 'crypto-js';

// Key ကို ကုဒ်ထဲတွင် အသေမရေးဘဲ Vercel Environment မှ လှမ်းယူမည် (VITE_ ဖြင့်စရမည်)
const SECRET_KEY = import.meta.env.VITE_SECRET_KEY || "fallback_default_key_do_not_use";

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
        return originalText || cipherText;
    } catch (error) {
        return cipherText; 
    }
};
