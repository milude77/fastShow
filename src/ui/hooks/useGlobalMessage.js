// src/hooks/useGlobalMessage.js
import { createContext, useContext } from 'react';

export const AntdMessageContext = createContext(null);

export const useGlobalMessage = () => {
    const antdMessage = useContext(AntdMessageContext);
    if (!antdMessage) {
        throw new Error('antd message context not found');
    }
    return antdMessage;
};