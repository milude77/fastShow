// contexts/ModalContext.js
import React, { useState, useCallback } from 'react';
import { ModalContext } from '../hooks/useModalManager';

export const ModalProvider = ({ children }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalType, setModalType] = useState('');
  const [modalProps, setModalProps] = useState({});

  const openModal = useCallback((type, props = {}) => {
    setModalType(type);
    setModalProps(props);
    setIsModalOpen(true);
  }, []);

  const closeModal = useCallback(() => {
    setIsModalOpen(false);
    setModalType('');
    setModalProps({});
  }, []);

  

  return (
    <ModalContext.Provider value={{ isModalOpen, modalType, modalProps, openModal, closeModal }}>
      {children}
    </ModalContext.Provider>
  );
};

