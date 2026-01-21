// contexts/ModalContext.js
import React, { useState, useCallback } from 'react';
import { ModalContext } from '../hooks/useModalManager';
import CreateGoupsApp from '../components/custoModal/CreateGoupsApp';
import InviteFriendsJoinGroup from '../components/custoModal/inviteFriends';
import CustomModal from '../components/custoModal/customModal';
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

  const renderModalContent = () => {
    switch (modalType) {
      case 'createGroup':
        return <CreateGoupsApp onClose={closeModal} />;
      case 'inviteFriends':
        return (
          <InviteFriendsJoinGroup
            groupId={modalProps.groupId}
            groupName={modalProps.groupName}
            onClose={closeModal}
          />
        );
      default:
        return null;
    }
  };

  return (
    <ModalContext.Provider value={{ openModal, closeModal }}>
      {children}
      <CustomModal isOpen={isModalOpen}>
        {renderModalContent()}
      </CustomModal>
    </ModalContext.Provider>
  );
};

