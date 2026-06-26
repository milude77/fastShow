module.exports = {
    up: (db) => {
        // 创建 group_aes_history 表
        db.prepare(`
            CREATE TABLE group_aes_history (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                group_id TEXT NOT NULL,
                aes_key TEXT NOT NULL,
                aes_version INTEGER NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (group_id) REFERENCES groups(id)
            )
        `).run();
    }
}