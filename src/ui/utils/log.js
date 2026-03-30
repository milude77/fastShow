

/**
 * 向主进程发送日志消息，由主进程写入日志文件
 * @param {string} message - 日志内容
 * @param {string} level - 日志级别，如 'info', 'error', 'warn'
 */
export const logToFile = (message, level = 'info') => {
    const timestamp = new Date().toISOString();
    const logEntry = `[${timestamp}] [${level.toUpperCase()}] ${message}\n`;
    window.electronAPI.writeLog(logEntry);
};