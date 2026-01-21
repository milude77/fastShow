// hooks/useModalManager.js
import { createContext, useContext } from 'react';

export const ModalContext = createContext();

export const useGlobalModal = () => {
  const context = useContext(ModalContext);
  if (!context) {
    throw new Error('useGlobalModal must be used within a ModalProvider');
  }
  return context;
};