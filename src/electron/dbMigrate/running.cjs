const path = require('path');
const fs = require('fs');


/**
 * 自动扫描并执行数据库迁移脚本
 * @param {import('better-sqlite3').Database} db 已经解锁的加密数据库实例
 */
function runDatabaseMigrations(db) {
    // 1. 确保版本控制表存在
    db.prepare(`
        CREATE TABLE IF NOT EXISTS schema_migrations (
            version TEXT PRIMARY KEY,
            migrated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `).run();

    // 2. 获取已经执行过的迁移版本列表
    const executedRows = db.prepare('SELECT version FROM schema_migrations').all();
    const executedVersions = new Set(executedRows.map(row => row.version));

    // 3. 读取 dbMigrate 文件夹下的所有 .js 文件
    const migrateDir = path.join(__dirname);
    if (!fs.existsSync(migrateDir)) {
        fs.mkdirSync(migrateDir, { recursive: true });
        return;
    }

    const files = fs.readdirSync(migrateDir)
                .filter(file => file.endsWith('.cjs') || file.endsWith('.js'))
                .filter(file => file !== 'running.cjs') 
                .sort();

    console.log(`[Migration] 发现本地共有 ${files.length} 个迁移脚本...`);

    // 4. 循环对比并执行
    for (const file of files) {
        const version = path.basename(file, '.cjs'); // 获取不带后缀的文件名

        // 如果这个脚本已经执行过了，直接跳过
        if (executedVersions.has(version)) {
            continue;
        }

        console.log(`[Migration] 正在执行新迁移: ${version}...`);

        // 引入该迁移文件
        const migration = require(path.join(migrateDir, file));

        // 开启 SQLite 事务，确保单个文件执行的原子性
        const tx = db.transaction(() => {
            migration.up(db); // 执行脚本里的 SQL 改动
            
            // 记录到版本控制表，防止下次重复执行
            db.prepare('INSERT INTO schema_migrations (version) VALUES (?)').run(version);
        });

        try {
            tx();
            console.log(`[Migration] 迁移成功: ${version}`);
        } catch (error) {
            console.error(`[Migration] 迁移失败: ${version}. 事务已回滚！`, error);
            throw error; 
        }
    }

    console.log('[Migration] 所有数据库迁移检查完毕。');
}

module.exports = { runDatabaseMigrations };