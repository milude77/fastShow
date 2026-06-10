module.exports = {
  /**
   * @param {import('better-sqlite3').Database} db 原生数据库连接实例
   */
  up: (db) => {
    // 1. 创建 friends 表及索引
    db.prepare(`
      CREATE TABLE IF NOT EXISTS friends (
        id TEXT PRIMARY KEY,
        userName TEXT NOT NULL,
        nickName TEXT DEFAULT NULL,
        addTime DATETIME DEFAULT CURRENT_TIMESTAMP,
        version INTEGER NOT NULL DEFAULT 0,
        lastMessage DATETIME DEFAULT NULL,
        status TEXT NOT NULL DEFAULT 'normal',
        type TEXT DEFAULT 'private'
      )
    `).run();
    db.prepare(`CREATE INDEX IF NOT EXISTS friends_user_id_idx ON friends(id)`).run();
    db.prepare(`CREATE INDEX IF NOT EXISTS friends_version_idx ON friends(version)`).run();

    // 2. 创建 groups 表及索引
    db.prepare(`
      CREATE TABLE IF NOT EXISTS groups (
        id TEXT PRIMARY KEY,
        groupName TEXT NOT NULL,
        addTime DATETIME DEFAULT CURRENT_TIMESTAMP,
        version INTEGER NOT NULL DEFAULT 0,
        member_version INTEGER NOT NULL DEFAULT 0,
        message_version INTEGER NOT NULL DEFAULT 0,
        lastMessage DATETIME DEFAULT NULL,
        status TEXT NOT NULL DEFAULT 'normal',
        my_role TEXT DEFAULT 'member'
      )
    `).run();
    db.prepare(`CREATE INDEX IF NOT EXISTS groups_version_idx ON groups(version)`).run();

    // 3. 创建 messages 表
    db.prepare(`
      CREATE TABLE IF NOT EXISTS messages (
        id TEXT PRIMARY KEY,
        sender_id TEXT NOT NULL,
        receiver_id TEXT NOT NULL,
        text TEXT NOT NULL,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        username TEXT NOT NULL,
        sender TEXT NOT NULL DEFAULT 'user',
        messageType TEXT DEFAULT 'text',
        fileName TEXT,
        fileUrl TEXT,
        fileSize TEXT,
        localFilePath TEXT,
        fileExt BOOLEAN DEFAULT 0,
        status TEXT DEFAULT 'fail'
      )
    `).run();

    // 4. 创建 group_messages 表
    db.prepare(`
      CREATE TABLE IF NOT EXISTS group_messages (
        id TEXT PRIMARY KEY,
        sender_id TEXT NOT NULL,
        receiver_id TEXT NOT NULL,
        text TEXT NOT NULL,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        username TEXT NOT NULL,
        sender TEXT NOT NULL DEFAULT 'user',
        messageType TEXT DEFAULT 'text',
        fileName TEXT,
        fileUrl TEXT,
        fileSize TEXT,
        localFilePath TEXT,
        fileExt BOOLEAN DEFAULT 0,
        status TEXT DEFAULT 'fail'
      )
    `).run();

    // 5. 创建 invite_information 表
    db.prepare(`
      CREATE TABLE IF NOT EXISTS invite_information (
        id TEXT PRIMARY KEY,
        inviter_id TEXT NOT NULL,
        inviter_name TEXT NOT NULL,
        group_id TEXT,
        group_name TEXT,
        is_group_invite BOOLEAN NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending',
        create_time DATETIME DEFAULT CURRENT_TIMESTAMP,
        update_time DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `).run();

    // 6. 创建 group_member 表
    db.prepare(`
      CREATE TABLE IF NOT EXISTS group_member (
        group_id TEXT NOT NULL,
        member_id TEXT NOT NULL,
        member_name TEXT NOT NULL,
        join_time DATETIME DEFAULT CURRENT_TIMESTAMP,
        role TEXT NOT NULL DEFAULT 'member',
        PRIMARY KEY (group_id, member_id)
      )
    `).run();
  }
};