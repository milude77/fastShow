import os from 'os'
import { safeStorage } from 'electron'
import path from 'path'
import fs from 'fs'
import crypto from 'crypto'

function generateKeyPairSync() {
    const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
        modulusLength: 2048,
        publicKeyEncoding: {
            type: 'spki',
            format: 'pem'
        },
        privateKeyEncoding: {
            type: 'pkcs8',
            format: 'pem'
        }
    });

    return {
        publicKey,
        privateKey
    };
}


//生成设备唯一机器码
function generateDeviceId() {
    const networkInterfaces = os.networkInterfaces();
    let macs = '';
    Object.keys(networkInterfaces).forEach((ifname) => {
        networkInterfaces[ifname].forEach((iface) => {
            if (!iface.internal && iface.mac !== '00:00:00:00:00:00') {
                macs += iface.mac;
            }
        });
    });
    const rawFingerprint = crypto.createHash('sha256').update(macs + os.hostname()).digest('hex');

    return rawFingerprint;
}

export function getElectronLoginParams(userPath) {
    const configPath = path.join(userPath, 'localvoice_config.json');
    const publicKeyPath = path.join(userPath, 'localvoice_pub.key');
    const encryptedPrivateKeyPath = path.join(userPath, 'localvoice_priv.enc');

    const device_name = os.hostname();
    let device_id;
    if (fs.existsSync(configPath)) {
        try {
            const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
            const encryptedBuffer = Buffer.from(config.device_id, 'hex');
            device_id = safeStorage.decryptString(encryptedBuffer);
        }
        catch (err) {
            console.error('Error parsing config file:', err);
        }
    } else {
        device_id = generateDeviceId();
        const saved_device_id = safeStorage.encryptString(device_id).toString('hex');
        fs.writeFileSync(configPath, JSON.stringify({ device_id: saved_device_id, device_name }, null, 2), 'utf-8');
    }

    let identity_public_key;
    if (fs.existsSync(publicKeyPath)) {
        identity_public_key = fs.readFileSync(publicKeyPath, 'utf-8');
    } else {
        const { publicKey, privateKey } = generateKeyPairSync();
        identity_public_key = publicKey;

        // 写入明文公钥和系统级别保护的私钥
        fs.writeFileSync(publicKeyPath, publicKey, 'utf-8');
        const encryptedPriv = safeStorage.encryptString(privateKey);
        fs.writeFileSync(encryptedPrivateKeyPath, encryptedPriv);
    }

    return { device_id, device_name, identity_public_key };
}

export function decryptAESKey(encryptedAESKeyBase64, userPath) {
    // 读取并解密私钥
    const encryptedPrivateKeyPath = path.join(userPath, 'localvoice_priv.enc');
    const encryptedPriv = fs.readFileSync(encryptedPrivateKeyPath);
    const privateKeyPem = safeStorage.decryptString(encryptedPriv);

    // 用私钥解密 AES 密钥
    const decrypted = crypto.privateDecrypt(
        {
            key: privateKeyPem,
            padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
            oaepHash: 'sha256'
        },
        Buffer.from(encryptedAESKeyBase64, 'base64')
    );

    return decrypted.toString('hex');
}