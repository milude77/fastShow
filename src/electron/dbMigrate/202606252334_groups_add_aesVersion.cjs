module.exports = {
    /**
     * 执行升级逻辑
     * @param {import('better-sqlite3').Database} db 
     */
    up: (db) => {
        // 为存储群聊的表新增 AES 版本字段
        db.prepare(`ALTER TABLE groups ADD COLUMN aes_version INTEGER DEFAULT 0`).run();
    }
};