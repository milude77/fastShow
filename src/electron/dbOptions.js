import fs from 'fs';
import path from 'path';
import { dbMigrationManager } from './store.js';

export async function initializeDatabase(db) {
  try {
    // 检查表是否存在，使用更可靠的方法
    let privateMessageExists;
    let friendTableExists;
    let groupMessageExists;
    let groupTableExists;
    let inviteInformationExists;
    try {
      privateMessageExists = await db.schema.hasTable('messages');
      friendTableExists = await db.schema.hasTable('friends');
      groupTableExists = await db.schema.hasTable('groups');
      groupMessageExists = await db.schema.hasTable('group_messages');
      inviteInformationExists = await db.schema.hasTable('invite_information');
    } catch (error) {
      console.error('Error checking if messages table exists:', error.message);
      privateMessageExists = false;
    }

    if (!friendTableExists) {
      await db.schema.createTable('friends', (table) => {
        table.string('id').primary();
        table.string('userName').notNullable();
        table.string('nickName').nullable().defaultTo(null);
        table.timestamp('addTime').defaultTo(db.fn.now());
        table.boolean('isFriend').defaultTo(true);
      })
    }

    if (!groupTableExists) {
      await db.schema.createTable('groups', (table) => {
        table.string('id').primary();
        table.string('groupName').notNullable();
        table.timestamp('addTime').defaultTo(db.fn.now());
        table.boolean('isMember').defaultTo(true);
      })
    }

    if (!privateMessageExists) {
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
    }

    if (!groupMessageExists) {
      await db.schema.createTable('group_messages', (table) => {
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
      })
    }
    if (!inviteInformationExists) {
      await db.schema.createTable('invite_information', (table) => {
        table.string('id').primary();
        table.string('inviter_id').notNullable();
        table.string('inviter_name').notNullable();
        table.string('group_id').nullable();
        table.string('group_name').nullable();
        table.boolean('is_group_invite').notNullable();
        table.string('status').notNullable().defaultTo('pending');
        table.timestamp('create_time').defaultTo(db.fn.now());
        table.timestamp('update_time').defaultTo(db.fn.now());
      })
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

/**
 * 数据库迁移：确保 messages 表符合当前 Electron 架构（camelCase）并备份
 * - 备份当前用户数据库文件
 * - 检测 snake_case（旧版）与 camelCase（现版）列形态
 * - 如存在旧版列且缺少现版列：采用“新表复制”策略重建
 * - 否则对缺失列进行补列（幂等）
 * - 使用 electron-store 按用户记录迁移版本，避免重复执行
 */
/** moved to ./db.js: migrateUserDb() */
export async function migrateUserDb(db, userId, dbPath) {
  try {

    const curuentDbVersion = dbMigrationManager.getMigrationVersion(userId);

    // 目标版本
    const targetVer = 6;
    // 若版本已满足，直接返回
    if (curuentDbVersion >= targetVer) {
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
    const hasTypeColumn = await db.schema.hasColumn('friends', 'type');

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
      if (!hasTypeColumn) {
        await db.schema.table('friends', (table) => {
          table.string('type').nullable().defaultTo('private');
        });
        console.log("Added 'type' column to 'friends' table.");
      }
    }



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

    dbMigrationManager.setMigrationVersion(userId, targetVer);
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
