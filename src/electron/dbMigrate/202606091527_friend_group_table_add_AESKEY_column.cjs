module.exports = {
    /**
     * 执行升级逻辑
     * @param {import('better-sqlite3').Database} db 
     */
    up: (db) => {
        // 为存储群聊的表新增 AES 密钥字段
        db.prepare(`ALTER TABLE groups ADD COLUMN group_aes_key TEXT`).run();
        
        // 为存储好友的表新增 AES 密钥字段
        db.prepare(`ALTER TABLE friends ADD COLUMN session_aes_key TEXT`).run();
    }
};