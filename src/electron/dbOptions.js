import { dbMigrationManager } from './store.js';
import { safeStorage } from 'electron';
import fs from 'fs';
import path from 'path';
import Database from 'better-sqlite3-multiple-ciphers'
import crypto from 'crypto';

export async function initializeDatabase(db) {
  try {
    // 检查表是否存在，使用更可靠的方法
    let privateMessageExists;
    let friendTableExists;
    let groupMessageExists;
    let groupTableExists;
    let inviteInformationExists;
    let groupMemberExists;
    try {
      privateMessageExists = await db.schema.hasTable('messages');
      friendTableExists = await db.schema.hasTable('friends');
      groupTableExists = await db.schema.hasTable('groups');
      groupMessageExists = await db.schema.hasTable('group_messages');
      inviteInformationExists = await db.schema.hasTable('invite_information');
      groupMemberExists = await db.schema.hasTable('group_member');

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
        table.integer('version').notNullable().defaultTo(0);
        table.timestamp('lastMessage').nullable().defaultTo(null);
        table.string('status').notNullable().defaultTo('normal');
        table.string('type').nullable().defaultTo('private');
      });

      // 为 friends 表创建索引
      await db.schema.alterTable('friends', (table) => {
        table.index(['id'], 'friends_user_id_idx');
        table.index(['version'], 'friends_version_idx');
      });
    }

    if (!groupTableExists) {
      await db.schema.createTable('groups', (table) => {
        table.string('id').primary();
        table.string('groupName').notNullable();
        table.timestamp('addTime').defaultTo(db.fn.now());
        table.integer('version').notNullable().defaultTo(0);
        table.integer('member_version').notNullable().defaultTo(0);
        table.integer('message_version').notNullable().defaultTo(0);
        table.timestamp('lastMessage').nullable().defaultTo(null);
        table.string('status').notNullable().defaultTo('normal');
        table.string('my_role').nullable().defaultTo('member');
      });

      // 为 groups 表创建索引
      await db.schema.alterTable('groups', (table) => {
        table.index(['version'], 'groups_version_idx');
      });
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
      });
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
      });
    }

    if (!groupMemberExists) {
      await db.schema.createTable('group_member', (table) => {
        table.string('group_id').notNullable();
        table.string('member_id').notNullable();
        table.string('member_name').notNullable();
        table.timestamp('join_time').defaultTo(db.fn.now());
        table.string('role').notNullable().defaultTo('member');
        table.primary(['group_id', 'member_id']);
      });
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
 * - 使用 electron-store 按用户记录迁移版本，避免重复执行
 */
export async function migrateUserDb(db, userId) {
  try {
    const currentDbVersion = dbMigrationManager.getMigrationVersion(userId);

    // 目标版本
    const targetVer = 18;
    // 若版本已满足，直接返回
    if (currentDbVersion >= targetVer) {
      return;
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

    // 删除 friends 表中不再需要的列
    const hasIsDeletedColumn = await db.schema.hasColumn('friends', 'is_deleted');
    if (hasIsDeletedColumn) {
      await db.schema.table('friends', (table) => {
        table.dropColumn('is_deleted');
      });
    }

    const hasIsFriendColumn = await db.schema.hasColumn('friends', 'isFriend');
    if (hasIsFriendColumn) {
      await db.schema.table('friends', (table) => {
        table.dropColumn('isFriend')
      });
    }

    const hasFrinendStatusColumn = await db.schema.hasColumn('friends', 'status');
    if (!hasFrinendStatusColumn) {
      await db.schema.table('friends', (table) => {
        table.string('status').defaultTo('normal');
      });
    }

    // 删除 groups 表中不再需要的列
    const hasIsExitColumn = await db.schema.hasColumn('groups', 'is_exit');
    if (hasIsExitColumn) {
      await db.schema.table('groups', (table) => {
        table.dropColumn('is_exit');
      });
      console.log("Dropped 'is_exit' column from 'groups' table.");
    }

    const hasisMemberColumn = await db.schema.hasColumn('groups', 'isMember');
    if (hasisMemberColumn) {
      await db.schema.table('groups', (table) => {
        table.dropColumn('isMember');
      });
      console.log("Dropped 'isMember' column from 'groups' table.");
    }

    const hasGroupMemberRoleColumn = await db.schema.hasColumn('group_member', 'role');
    if (!hasGroupMemberRoleColumn) {
      await db.schema.table('group_member', (table) => {
        table.string('role').nullable().defaultTo('member');
      })
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

export function migrateOldDataIfNeeded(userDbPath, dbKey) {
  const oldDbPath = path.join(userDbPath, '*.sqlite3');
  const newDbPath = path.join(userDbPath, 'secure.db');

  if (!fs.existsSync(oldDbPath)) return;

  console.log('检测到旧版明文数据，正在启动「完美结构克隆」加密迁移...');

  if (fs.existsSync(newDbPath)) {
    fs.unlinkSync(newDbPath);
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
      // 生成一个 256 位（32 字节）的强随机数，转为十六进制字符串（共 64 个字符）
      // 这种强度的密钥，黑客暴力破解几万年也破不开
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
