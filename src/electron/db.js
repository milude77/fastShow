import fs from 'fs';
import path from 'path';

export async function initializeDatabase(db) {
  try {
    // 检查表是否存在，使用更可靠的方法
    let exists;
    try {
      exists = await db.schema.hasTable('messages');
    } catch (error) {
      console.error('Error checking if messages table exists:', error.message);
      exists = false;
    }

    if (!exists) {
      // 使用 await 确保表创建完成
      await db.schema.createTable('messages', (table) => {
        table.string('id').primary();
        table.string('sender_id').notNullable();
        table.string('receiver_id').notNullable();
        table.text('text').notNullable();
        table.timestamp('timestamp').defaultTo(db.fn.now());
        table.string('username').notNullable();
        table.string('sender').notNullable().defaultTo('user');
        table.string('messageType').defaultTo('text');
        table.string('fileName').nullable();
        table.string('fileUrl').nullable();
        table.string('fileSize').nullable();
        table.string('localFilePath').nullable();
        table.boolean('fileExt').nullable().defaultTo(false);
        table.string('status').nullable().defaultTo('fail');
      });

      console.log('Messages table created successfully');

      // 验证表是否真的创建成功
      const tablesExist = await db.schema.hasTable('messages');
      console.log('Verified messages table exists:', tablesExist);
    }
  } catch (error) {
    console.error('Failed to initialize database:', error);
    console.error('Error details:', {
      message: error.message,
      code: error.code,
      errno: error.errno,
      sql: error.sql,
      bindings: error.bindings
    });
    throw error; // 重新抛出错误
  }
}

export async function migrateUserDb(db, userId, dbPath, store) {
  try {
    // 幂等版本控制（每用户）
    const migrationKey = `dbMigrationVersion:${userId}`;
    const currentVer = store.get(migrationKey) || 0;
    // 目标版本
    const targetVer = 3;
    // 若版本已满足，直接返回
    if (currentVer >= targetVer) {
      return;
    }

    // 备份原库
    try {
      if (dbPath && fs.existsSync(dbPath)) {
        const dir = path.dirname(dbPath);
        const ts = new Date().toISOString().replace(/[-:.TZ]/g, '');
        const backupPath = path.join(dir, `chat_history.backup_${ts}.sqlite3`);
        fs.copyFileSync(dbPath, backupPath);
      }
    } catch (backupErr) {
      console.warn('Database backup failed:', backupErr?.message || backupErr);
    }

    // 确保 messages 表存在
    const hasTable = await db.schema.hasTable('messages');
    if (!hasTable) {
      await initializeDatabase(db);
    }

    // 检测列形态
    const camel_messageType = await db.schema.hasColumn('messages', 'messageType');
    const snake_message_type = await db.schema.hasColumn('messages', 'message_type');

    const camel_fileName = await db.schema.hasColumn('messages', 'fileName');
    const snake_file_name = await db.schema.hasColumn('messages', 'file_name');

    const camel_fileUrl = await db.schema.hasColumn('messages', 'fileUrl');
    const snake_file_url = await db.schema.hasColumn('messages', 'file_url');

    const camel_fileSize = await db.schema.hasColumn('messages', 'fileSize');
    const snake_file_size = await db.schema.hasColumn('messages', 'file_size');

    const camel_localFilePath = await db.schema.hasColumn('messages', 'localFilePath');
    const snake_local_file_path = await db.schema.hasColumn('messages', 'local_file_path');

    const camel_fileExt = await db.schema.hasColumn('messages', 'fileExt');
    const snake_file_ext = await db.schema.hasColumn('messages', 'file_ext');
    const camel_status = await db.schema.hasColumn('messages', 'status');

    const snakePresent = snake_message_type || snake_file_name || snake_file_url || snake_file_size || snake_local_file_path || snake_file_ext;
    const camelMissing = !camel_messageType || !camel_fileName || !camel_fileUrl || !camel_fileSize || !camel_localFilePath || !camel_fileExt || !camel_status;

    if (snakePresent && camelMissing) {
      // 重建表策略：创建新表（目标列），投影插入，替换旧表
      await db.transaction(async (trx) => {
        await trx.raw('PRAGMA foreign_keys=OFF;');
        try {
          await trx.schema.dropTableIfExists('messages_new');
          await trx.schema.createTable('messages_new', (table) => {
            table.string('id').primary();
            table.string('sender_id').notNullable();
            table.string('receiver_id').notNullable();
            table.text('text').notNullable();
            table.timestamp('timestamp').defaultTo(trx.fn.now());
            table.string('username').notNullable();
            table.string('sender').notNullable().defaultTo('user');
            table.string('messageType').defaultTo('text');
            table.string('fileName').nullable();
            table.string('fileUrl').nullable();
            table.string('fileSize').nullable();
            table.string('localFilePath').nullable();
            table.boolean('fileExt').nullable().defaultTo(false);
            table.string('status').nullable();
          });

          await trx.raw(`
            INSERT INTO messages_new (id, sender_id, receiver_id, text, timestamp, username, sender, messageType, fileName, fileUrl, fileSize, localFilePath, fileExt, status)
            SELECT
              id,
              sender_id,
              receiver_id,
              text,
              timestamp,
              username,
              COALESCE(sender, 'user') AS sender,
              COALESCE(messageType, message_type, 'text') AS messageType,
              COALESCE(fileName, file_name) AS fileName,
              COALESCE(fileUrl, file_url) AS fileUrl,
              COALESCE(fileSize, CAST(file_size AS TEXT)) AS fileSize,
              COALESCE(localFilePath, local_file_path) AS localFilePath,
              COALESCE(fileExt, CASE WHEN file_ext IS NULL THEN 0 ELSE file_ext END) AS fileExt,
            FROM messages;
          `);

          await trx.schema.dropTable('messages');
          await trx.schema.renameTable('messages_new', 'messages');
        } finally {
          await trx.raw('PRAGMA foreign_keys=ON;');
        }
      });
      console.log('Messages table rebuilt to camelCase schema.');
    } else {
      // 按需补列（幂等）
      if (!camel_messageType) {
        await db.schema.table('messages', (table) => {
          table.string('messageType').defaultTo('text');
        });
      }
      if (!camel_fileName) {
        await db.schema.table('messages', (table) => {
          table.string('fileName').nullable();
        });
      }
      if (!camel_fileUrl) {
        await db.schema.table('messages', (table) => {
          table.string('fileUrl').nullable();
        });
      }
      if (!camel_fileSize) {
        await db.schema.table('messages', (table) => {
          table.string('fileSize').nullable();
        });
      }
      if (!camel_localFilePath) {
        await db.schema.table('messages', (table) => {
          table.string('localFilePath').nullable();
        });
      }
      if (!camel_fileExt) {
        await db.schema.table('messages', (table) => {
          table.boolean('fileExt').nullable().defaultTo(false);
        });
      }
    }

    // 清理历史备份：仅保留最近 3 个 chat_history.backup_*.sqlite3 文件，避免无限增长
    try {
      if (dbPath && fs.existsSync(path.dirname(dbPath))) {
        const dir = path.dirname(dbPath);
        const files = fs.readdirSync(dir)
          .filter(name => /^chat_history\.backup_.*\.sqlite3$/i.test(name))
          .map(name => {
            const full = path.join(dir, name);
            const stat = fs.statSync(full);
            return { name, full, mtime: stat.mtimeMs };
          })
          .sort((a, b) => b.mtime - a.mtime);
        const keep = 3;
        for (let i = keep; i < files.length; i++) {
          try { fs.unlinkSync(files[i].full); } catch { /* 忽略清理失败 */ }
        }
      }
    } catch (cleanupErr) {
      console.warn('Backup cleanup warning:', cleanupErr?.message || cleanupErr);
    }

    store.set(migrationKey, targetVer);
  } catch (error) {
    console.error('Database migration failed:', error);
    console.error('Error details:', {
      message: error.message,
      code: error.code,
      errno: error.errno,
      sql: error.sql,
      bindings: error.bindings
    });
    throw error;
  }
}