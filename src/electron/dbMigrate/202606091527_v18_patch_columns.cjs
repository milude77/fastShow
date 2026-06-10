module.exports = {
  up: (db) => {
    const pragma = db.prepare("PRAGMA table_info(friends)").all();
    const hasIsDeleted = pragma.some(col => col.name === 'is_deleted');
    
    // 如果存在旧列则移除 (注意：SQLite 3.35+ 才原生支持 DROP COLUMN)
    if (hasIsDeleted) {
      db.prepare(`ALTER TABLE friends DROP COLUMN is_deleted`).run();
    }
  }
};