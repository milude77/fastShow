module.exports = {
    up: (db) => {
        db.prepare(`ALTER TABLE friends ADD COLUMN message_version INTEGER DEFAULT 0`).run();
    }
}