import crypto from 'crypto';

/**
 * AES-256-CBC 消息解密
 * @param {string} encryptedMessage - hex 编码的加密消息
 * @param {string} aesKey - hex 编码的 AES 密钥
 * @param {Buffer|string} iv - 初始化向量（Buffer 或 hex 字符串）
 * @returns {string} 解密后的明文消息
 */
export function decryptAESMessage(encryptedMessage, aesKey, iv) {
    const key = Buffer.from(aesKey, 'hex');
    const ivBuffer = Buffer.isBuffer(iv) ? iv : Buffer.from(iv, 'hex');
    const decipher = crypto.createDecipheriv('aes-256-cbc', key, ivBuffer);
    let decrypted = decipher.update(encryptedMessage, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
}
