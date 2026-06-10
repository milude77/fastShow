import { safeStorage } from 'electron';
import fs from 'fs';
import path from 'path';
import Database from 'better-sqlite3-multiple-ciphers'
import crypto from 'crypto';

function ensureSecureDatabaseFormat(dbPath, dbKey) {
    // 如果文件不存在，better-sqlite3 创建出来的 0 字节文件需要强制写入一次加密头
    console.log(dbKey)
    const db = new Database(dbPath);
    try {
        db.pragma(`key='${dbKey}'`);
        // 执行一次极轻量的写操作，迫使 SQLCipher 向磁盘写入 1024 字节的加密 Salt 头部
        db.exec(`CREATE TABLE IF NOT EXISTS _crypto_init (id INTEGER PRIMARY KEY);`);
    } finally {
        db.close();
    }
}

export function migrateOldDataIfNeeded(userDbPath, dbKey) {
    const oldDbPath = path.join(userDbPath, 'chat_history.sqlite3');
    const newDbPath = path.join(userDbPath, 'secure.db');

    if (!fs.existsSync(oldDbPath)) return;

    console.log('检测到旧版明文数据，正在启动「完美结构克隆」加密迁移...');

    if (!fs.existsSync(oldDbPath)) {
        if (!fs.existsSync(newDbPath)) {
            ensureSecureDatabaseFormat(newDbPath, dbKey);
        }
        return;
    }

    const newDb = new Database(newDbPath);
    newDb.pragma(`key='${dbKey}'`);

    try {
        // 关键步骤 1：暂时关闭新数据库的外键约束检查，防止导入数据时因顺序问题报错
        newDb.pragma('foreign_keys = OFF');

        // 挂载旧数据库
        newDb.prepare(`ATTACH DATABASE '${oldDbPath}' AS old_db`).run();

        // 关键步骤 2：开启事务，保证结构和数据迁移的原子性
        const migrationTx = newDb.transaction(() => {

            // === A. 克隆所有表结构（包含主键、外键、默认值约束） ===
            const tables = newDb.prepare(
                "SELECT name, sql FROM old_db.sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'"
            ).all();

            for (const table of tables) {
                // table.sql 包含了该表完整的 DDL 语句，例如 "CREATE TABLE users (id INTEGER PRIMARY KEY...)"
                if (table.sql) {
                    // 在新数据库（main）中执行相同的建表语句
                    newDb.prepare(table.sql).run();

                    // 导入数据
                    newDb.prepare(`INSERT INTO main.${table.name} SELECT * FROM old_db.${table.name}`).run();
                }
            }

            // === B. 克隆所有索引（Index） ===
            const indices = newDb.prepare(
                "SELECT sql FROM old_db.sqlite_master WHERE type='index' AND name NOT LIKE 'sqlite_%' AND sql IS NOT NULL"
            ).all();

            for (const index of indices) {
                newDb.prepare(index.sql).run();
            }

            // === C. 克隆所有触发器（Trigger） ===
            const triggers = newDb.prepare(
                "SELECT sql FROM old_db.sqlite_master WHERE type='trigger' AND sql IS NOT NULL"
            ).all();

            for (const trigger of triggers) {
                newDb.prepare(trigger.sql).run();
            }

            // === D. 克隆所有视图（View，如有） ===
            const views = newDb.prepare(
                "SELECT sql FROM old_db.sqlite_master WHERE type='view' AND sql IS NOT NULL"
            ).all();

            for (const view of views) {
                newDb.prepare(view.sql).run();
            }
        });

        migrationTx(); // 执行迁移事务

        // 关键步骤 3：数据恢复完毕，重新启用外键约束，并强制进行一次外键完整性检查
        newDb.pragma('foreign_keys = ON');
        const fkCheck = newDb.prepare('PRAGMA foreign_key_check').all();
        if (fkCheck.length > 0) {
            throw new Error('外键完整性检查失败，新数据库存在损坏的外键关联！');
        }

        // 拆卸旧数据库并清理
        newDb.prepare("DETACH DATABASE old_db").run();
        newDb.close();

        fs.unlinkSync(oldDbPath);
        console.log('包含索引、外键的历史数据已完美迁移并加密！');

    } catch (error) {
        console.error('数据迁移失败:', error);
        try { newDb.close(); } catch (e) { }
        if (fs.existsSync(newDbPath)) fs.unlinkSync(newDbPath);
        throw error;
    }
}

/**
 * 获取或生成用于解密 SQLite 的安全密钥
 * @returns {string} 明文密钥（32位十六进制字符串）
 */
export function getOrCreateDatabaseKey(userDbPath) {
    // 将加密后的密钥文件存在 Electron 的 userData 目录中，命名为 machine_key.enc
    const keyPath = path.join(userDbPath, 'machine_key.enc');

    // 1. 如果密钥文件已经存在，说明不是第一次启动，直接读取并解密
    if (fs.existsSync(keyPath)) {
        try {
            const encryptedBuffer = fs.readFileSync(keyPath);

            // 使用操作系统的底层安全 API 解密
            const decryptedKey = safeStorage.decryptString(encryptedBuffer);
            return decryptedKey;
        } catch (error) {
            console.error('解密数据库密钥失败，可能系统凭据已被更改:', error);
            throw error;
        }
    }

    // 2. 如果文件不存在，说明是软件第一次安装/启动，或者被用户误删了
    else {
        try {

            const randomKey = crypto.randomBytes(32).toString('hex');

            // 使用 Electron 的 safeStorage 加密这个字符串，得到一个 Buffer
            const encryptedBuffer = safeStorage.encryptString(randomKey);

            // 将加密后的二进制数据写入文件
            fs.writeFileSync(keyPath, encryptedBuffer);

            // 返回生成的明文密钥，供本次启动使用
            return randomKey;
        } catch (error) {
            console.error('生成并加密数据库密钥失败:', error);
            throw error;
        }
    }
}
