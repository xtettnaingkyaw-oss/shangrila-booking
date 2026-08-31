import { ref, uploadString, getDownloadURL } from 'firebase/storage';
import { storage } from './firebase'; // လမ်းကြောင်း မှန်/မမှန် ပြန်စစ်ပေးပါ

// Base64 ကို Firebase Storage ပေါ်တင်ပြီး URL ပြန်ပေးမယ့် Function အသစ်
export const uploadBase64ToStorage = async (base64String: string, folderName: string, fileName: string): Promise<string> => {
  try {
    const storageRef = ref(storage, `${folderName}/${fileName}`); 
    await uploadString(storageRef, base64String, 'data_url');
    const downloadURL = await getDownloadURL(storageRef);
    return downloadURL;
  } catch (error) {
    console.error("Storage upload error:", error);
    throw new Error("Image upload failed");
  }
};
