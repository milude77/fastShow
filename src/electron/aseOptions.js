import CryptoJS from 'crypto-js';
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const configPath = path.join(__dirname, '..', '..', 'config.json');
const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));

const ENCRYPTION_KEY = config.ENCRYPTION_KEY;
const ENCRYPTION_IV = config.ENCRYPTION_IV;

function aesEncrypt(text) {
    const key = CryptoJS.enc.Utf8.parse(ENCRYPTION_KEY.padEnd(32, ' '));
    const iv = CryptoJS.enc.Utf8.parse(ENCRYPTION_IV.padEnd(16, ' '));
    const encrypted = CryptoJS.AES.encrypt(text, key, {
        iv: iv,
        mode: CryptoJS.mode.CBC,
        padding: CryptoJS.pad.Pkcs7
    });
    return encrypted.toString();
}

function aesDecrypt(encryptedText) {
    const key = CryptoJS.enc.Utf8.parse(ENCRYPTION_KEY.padEnd(32, ' '));
    const iv = CryptoJS.enc.Utf8.parse(ENCRYPTION_IV.padEnd(16, ' '));
    const decrypted = CryptoJS.AES.decrypt(encryptedText, key, {
        iv: iv,
        mode: CryptoJS.mode.CBC,
        padding: CryptoJS.pad.Pkcs7
    });
    return decrypted.toString(CryptoJS.enc.Utf8);
}

function isEncryptedMessage(message) {
    return typeof message === 'string' && message.startsWith('ENC$');
}

export function decryptMessage(message) {
    if (isEncryptedMessage(message)) {
        const encryptedContent = message.substring(4);
        try {
            return JSON.parse(aesDecrypt(encryptedContent));
        } catch (e) {
            console.error('解密失败:', e);
            return null;
        }
    }
    return message;
}

function encryptMessage(message) {
    const jsonString = JSON.stringify(message);
    const encrypted = aesEncrypt(jsonString);
    return `ENC$${encrypted}`;
}

export function wrapSocket(socket) {
    const originalEmit = socket.emit;
    socket.emit = function (event, data) {
        // 客户端只对敏感事件进行加密
        const sensitiveEvents = ['register-user', 'login-user', 'send-private-message', 'send-group-message'];

        if (sensitiveEvents.includes(event) && data && typeof data === 'object') {
            const encryptedData = encryptMessage(data);
            return originalEmit.call(this, event, encryptedData);
        }

        return originalEmit.apply(this, arguments);
    };

    const originalOn = socket.on;
    socket.on = function (event, handler) {
        // 对接收的事件数据进行解密
        const sensitiveEvents = ['user-registered', 'login-success', 'new-message'];
        if (sensitiveEvents.includes(event)) {

            return originalOn.call(this, event, (data) => {
                let decryptedData = data;

                // 如果数据是加密格式，进行解密
                if (typeof data === 'string' && data.startsWith('ENC$')) {
                    try {
                        decryptedData = decryptMessage(data);

                        if (decryptedData === null) {
                            console.error('解密失败，数据为null');
                            return;
                        }
                    } catch (e) {
                        console.error('解密事件数据失败:', e);
                        console.error('原始数据:', data);
                        return;
                    }
                }

                handler(decryptedData);
            });
        }

        return originalOn.apply(this, arguments);
    };

    return socket;
}