// src/ui/components/custoModal/customModal.jsx
import ReactDOM from 'react-dom';
import CreateGoupsApp from './CreateGoupsApp.jsx';
import InviteFriendsJoinGroup from './inviteFriends.jsx';
import AvatarUploader from './AvatarUploader.jsx'
import UserInformation from './userInformation.jsx'
import './css/CustomModal.css';


const CustomModal = ({ isModalOpen, modalType, modalProps, closeModal }) => {
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
      case 'avatarUploader':
        return (
          <AvatarUploader
            onClose={closeModal}
            imgSrc={modalProps.imgSrc}
            isGroupAvatarUpload={modalProps.isGroupAvatarUpload}
            groupId={modalProps.groupId}
          />
        )
      case 'userInformation':
        return (
          <UserInformation
            onClose={closeModal}
          />
        )
      default:
        return null;
    }
  };

  if (!isModalOpen) {
    return null;
  }

  return (
    <div className="modal-overlay">
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        {renderModalContent()}
      </div>
    </div>
  );
};

export default CustomModal;