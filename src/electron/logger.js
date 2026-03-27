import fs from 'fs';
import path from 'path';
import { app } from 'electron';

// 创建日志目录
const logDir = path.join(app.getPath('userData'), 'logs');
if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
}

// 简单的日志类
class Logger {
    constructor() {
        this.logFile = path.join(logDir, `main-${new Date().toISOString().split('T')[0]}.log`);
    }

    // 写入日志的通用方法
    writeLog(level, message, meta = {}) {
        const timestamp = new Date().toISOString();
        const logEntry = {
            timestamp,
            level,
            message,
            ...meta
        };

        const logString = JSON.stringify(logEntry) + '\n';
        
        // 控制台输出
        console.log(`[${timestamp}] ${level.toUpperCase()}: ${message}`);
        
        // 写入文件
        try {
            fs.appendFileSync(this.logFile, logString);
        } catch (error) {
            console.error(`Failed to write to log file: ${error.message}`);
        }
    }

    info(message, meta = {}) {
        this.writeLog('info', message, meta);
    }

    error(message, meta = {}) {
        this.write('error', message, meta);
    }

    warn(message, meta = {}) {
        this.writeLog('warn', message, meta);
    }

    debug(message, meta = {}) {
        this.writeLog('debug', message, meta);
    }
    
}

// 创建全局日志实例
const logger = new Logger();

export default logger;