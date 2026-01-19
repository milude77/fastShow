// src/hooks/useGlobalMessage.js
import { message } from 'antd';
import { useMemo } from 'react';

export const useGlobalMessage = () => {
    const [messageApi, contextHolder] = message.useMessage();
    
    // 使用 useMemo 缓存 API 对象，避免每次渲染都创建新对象
    const wrappedMessageApi = useMemo(() => ({
        success: (content, duration) => messageApi.success(content, duration),
        error: (content, duration) => messageApi.error(content, duration),
        info: (content, duration) => messageApi.info(content, duration),
        warning: (content, duration) => messageApi.warning(content, duration),
        loading: (content, duration) => messageApi.loading(content, duration)
    }), [messageApi]);

    return { messageApi: wrappedMessageApi, contextHolder };
};