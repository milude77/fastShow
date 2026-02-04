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
        table.interger('version').notNullable().defaultTo(0);
      })
    }

    if (!groupTableExists) {
      await db.schema.createTable('groups', (table) => {
        table.string('id').primary();
        table.string('groupName').notNullable();
        table.timestamp('addTime').defaultTo(db.fn.now());
        table.boolean('isMember').defaultTo(true);
        table.integer('version').notNullable().defaultTo(0);
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
 * - 直接补充缺失的列（幂等）
 * - 使用 electron-store 按用户记录迁移版本，避免重复执行
 */
export async function migrateUserDb(db, userId, dbPath) {
  try {
    const currentDbVersion = dbMigrationManager.getMigrationVersion(userId);

    // 目标版本
    const targetVer = 8;
    // 若版本已满足，直接返回
    if (currentDbVersion >= targetVer) {
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

    // 为 messages 表补充缺失的列（幂等）
    const columnsToCheck = [
      { name: 'messageType', type: 'string', default: 'text' },
      { name: 'fileName', type: 'string', nullable: true },
      { name: 'fileUrl', type: 'string', nullable: true },
      { name: 'fileSize', type: 'string', nullable: true },
      { name: 'localFilePath', type: 'string', nullable: true },
      { name: 'fileExt', type: 'boolean', nullable: true, default: false },
      { name: 'status', type: 'string', nullable: true }
    ];

    for (const col of columnsToCheck) {
      const exists = await db.schema.hasColumn('messages', col.name);
      if (!exists) {
        await db.schema.table('messages', (table) => {
          let colDef;
          switch (col.type) {
            case 'string':
              colDef = table.string(col.name);
              break;
            case 'boolean':
              colDef = table.boolean(col.name);
              break;
          }

          if (col.nullable) {
            colDef = colDef.nullable();
          } else {
            colDef = colDef.notNullable();
          }

          if (col.default !== undefined) {
            colDef = colDef.defaultTo(col.default);
          }
        });
        console.log(`Added '${col.name}' column to 'messages' table.`);
      }
    }

    // 为 friends 表补充 type 列
    const hasTypeColumn = await db.schema.hasColumn('friends', 'type');
    if (!hasTypeColumn) {
      await db.schema.table('friends', (table) => {
        table.string('type').nullable().defaultTo('private');
      });
      console.log("Added 'type' column to 'friends' table.");
    }

    // 为 friendships 表补充 version 和 is_deleted 列
    const hasVersionColumn = await db.schema.hasColumn('friends', 'version');
    if (!hasVersionColumn) {
      await db.schema.table('friends', (table) => {
        table.integer('version').notNullable().defaultTo(0);
      });
      console.log("Added 'version' column to 'friends' table.");
    }

    const hasIsDeletedColumn = await db.schema.hasColumn('friends', 'is_deleted');
    if (!hasIsDeletedColumn) {
      await db.schema.table('friends', (table) => {
        table.boolean('is_deleted').notNullable().defaultTo(false);
      });
      console.log("Added 'is_deleted' column to 'friends' table.");
    }

    // 为 groups 表补充 is_exit 和 version 列
    const hasGroupsVersionColumn = await db.schema.hasColumn('groups', 'version');
    if (!hasGroupsVersionColumn) {
      await db.schema.table('groups', (table) => {
        table.integer('version').notNullable().defaultTo(0);
      });
      console.log("Added 'version' column to 'groups' table.");
    }

    const hasIsExitColumn = await db.schema.hasColumn('groups', 'is_exit');
    if (!hasIsExitColumn) {
      await db.schema.table('groups', (table) => {
        table.boolean('is_exit').notNullable().defaultTo(false);
      });
      console.log("Added 'is_exit' column to 'groups' table.");
    }

    // 为 friends 表添加索引（如果不存在）
    const indexesToAdd = [
      { tableName: 'friends', columns: ['user_id'], indexName: 'friends_user_id_idx' },
      { tableName: 'friends', columns: ['version'], indexName: 'friends_version_idx' },
      { tableName: 'groups', columns: ['version'], indexName: 'groups_version_idx' }
    ];

    for (const idx of indexesToAdd) {
      // Knex doesn't have direct methods to check if index exists in SQLite
      // We'll just try to create them and ignore errors
      try {
        await db.schema.alterTable(idx.tableName, (table) => {
          table.index(idx.columns, idx.indexName);
        });
        console.log(`Created index '${idx.indexName}' on '${idx.tableName}'.`);
      } catch (e) {
        // Index might already exist, ignore error
        console.log(`Index '${idx.indexName}' may already exist on '${idx.tableName}'.`);
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
        const keep = 0;
        for (let i = keep; i < files.length; i++) {
          try {
            fs.unlinkSync(files[i].full);
          } catch {
            /* 忽略清理失败 */
          }
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