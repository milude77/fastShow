const Database = require('better-sqlite3-multiple-ciphers');
const { safeStorage } = require('electron'); // 注意：此脚本需要在具有 Electron 环境或通过 electron 运行
const fs = require('fs');
const path = require('path');

function testScript () {// ==================== 配置区域 ====================
    const USER_ID = '000001'; // 👈 替换为你要查看的用户的唯一 ID
    // ==================================================

    // 1. 拼接用户数据库和密钥文件的路径
    // 对应你代码中的：path.join(app.getPath('userData'), `${userId}`)
    const appDataPath = process.env.APPDATA || (process.platform === 'darwin' ? process.env.HOME + '/Library/Application Support' : process.env.HOME + '/.config');
    // 请将下方 '你的应用名' 替换为 package.json 中的 name 值
    const userDbPath = path.join(appDataPath, 'fastShow', USER_ID);

    const dbPath = path.join(userDbPath, 'secure.db');
    const keyPath = path.join(userDbPath, 'machine_key.enc');

    console.log('📂 正在检查路径...');
    console.log('数据库路径:', dbPath);
    console.log('密钥路径:', keyPath);

    if (!fs.existsSync(dbPath) || !fs.existsSync(keyPath)) {
        console.error('❌ 错误：未找到数据库文件或密钥文件，请检查 USER_ID 或应用名是否正确！');
        process.exit(1);
    }

    try {
        // 2. 读取并解密 machine_key.enc 拿到明文 dbKey
        console.log('🔑 正在请求系统凭据解密 Master Key...');
        const encryptedBuffer = fs.readFileSync(keyPath);
        // 注意：safeStorage 必须在对应的操作系统和用户登录状态下才能解密
        const dbKey = safeStorage.decryptString(encryptedBuffer);
        console.log('✅ 成功获取明文密钥:', dbKey.substring(0, 6) + '...' + dbKey.substring(dbKey.length - 6));

        // 3. 建立原生连接并注入密钥解锁
        const db = new Database(dbPath);
        db.pragma(`key='${dbKey}'`);

        // 4. 查询 friends 表
        console.log('📊 正在读取 friends 表数据...');
        const friends = db.prepare("SELECT * FROM friends LIMIT 10").all();

        console.log('\n--- 👥 你的好友列表 (前10条) ---');
        console.table(friends); // 以表格形式漂亮地打印在控制台
        console.log(`总计查出 ${friends.length} 条记录。\n`);

        db.close();
    } catch (error) {
        console.error('❌ 读取失败，错误信息:', error.message);
    }
}

module.exports = { testScript };