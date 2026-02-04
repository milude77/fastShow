import { createContext, useContext } from 'react';

export const AvatarContext = createContext(null);

export const useUserAvatar = () => {
    const context = useContext(AvatarContext);
    if (!context) {
        console.error('useAvatar must be used within an AvatarProvider');
    }
    return context;
};