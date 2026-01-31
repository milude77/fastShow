import CryptoJS from 'crypto-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';


const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({
    path: path.join(__dirname, 'config.env')
});


// --- AES加密相关 ---
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'your-32-character-secret-key-here'; // 至少32位密钥
const ENCRYPTION_IV = process.env.ENCRYPTION_IV || 'your-16-char-iv-here12'; // 16位IV

function aesEncrypt(text) {
    // 确保密钥和IV长度正确
    const key = CryptoJS.enc.Utf8.parse(ENCRYPTION_KEY.padEnd(32, ' '));
    const iv = CryptoJS.enc.Utf8.parse(ENCRYPTION_IV.padEnd(16, ' '));
    const encrypted = CryptoJS.AES.encrypt(text, key, {
        iv: iv,
        mode: CryptoJS.mode.CBC,
        padding: CryptoJS.pad.Pkcs7
    });
    return encrypted.toString();
}

// AES解密函数
function aesDecrypt(encryptedText) {
    // 确保密钥和IV长度正确
    const key = CryptoJS.enc.Utf8.parse(ENCRYPTION_KEY.padEnd(32, ' '));
    const iv = CryptoJS.enc.Utf8.parse(ENCRYPTION_IV.padEnd(16, ' '));
    const decrypted = CryptoJS.AES.decrypt(encryptedText, key, {
        iv: iv,
        mode: CryptoJS.mode.CBC,
        padding: CryptoJS.pad.Pkcs7
    });
    return decrypted.toString(CryptoJS.enc.Utf8);
}

// 检查是否为加密消息
function isEncryptedMessage(message) {
    return typeof message === 'string' && message.startsWith('ENC$');
}

// 解密消息
export function decryptMessage(message) {
    if (isEncryptedMessage(message)) {
        const encryptedContent = message.substring(4); // 移除 'ENC$' 前缀
        try {
            return JSON.parse(aesDecrypt(encryptedContent));
        } catch (e) {
            console.error('解密失败:', e);
            return null;
        }
    }
    return message;
}

// 加密消息
export function encryptMessage(message) {
    const jsonString = JSON.stringify(message);
    const encrypted = aesEncrypt(jsonString);
    return `ENC$${encrypted}`;
}