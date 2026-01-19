// src/utils/timeFormatter.js
export const formatTime = (timestamp) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    // 获取今天的日期（不包含时间）
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    // 获取昨天的日期
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    // 获取目标日期（不包含时间）
    const targetDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());

    // 如果是今天
    if (targetDate.getTime() === today.getTime()) {
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    
    // 如果是昨天
    if (targetDate.getTime() === yesterday.getTime()) {
        return '昨天 ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    
    // 如果是一周内的其他天
    if (diffDays <= 7) {
        const daysOfWeek = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
        const dayName = daysOfWeek[date.getDay()];
        return dayName + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    
    // 如果超过一周但不足一年
    if (diffDays <= 365) {
        const month = date.getMonth() + 1;
        const day = date.getDate();
        const hours = date.getHours().toString().padStart(2, '0');
        const minutes = date.getMinutes().toString().padStart(2, '0');
        return `${month}-${day} ${hours}:${minutes}`;
    }
    
    // 超过一年
    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    const day = date.getDate();
    return `${year}-${month}-${day}`;
};