import { useUserAvatar } from '../../hooks/useAvatar.js';
import { useSocket } from '../../hooks/useSocket.js';
import { useTranslation } from 'react-i18next';
import { useGlobalMessage } from '../../hooks/useGlobalMessage.js'
import { useGlobalModal } from '../../hooks/useModalManager.js'
import Avatar from '../avatar.jsx'
import { Input, Button } from 'antd';



export default function UserInformation( { onClose } ) {

    const currentUser = JSON.parse(localStorage.getItem('currentUser'))
    const { avatarSrc } = useUserAvatar();
    const socket = useSocket();
    const { t } = useTranslation();
    const { messageApi } = useGlobalMessage();
    const { openModal } = useGlobalModal();

    const handleSubmitInfo = async (e) => {
        e.preventDefault();
        const userName = e.target.elements.userName.value;
        socket.emit('update-user-info', { username: userName });

        let curUserCredentials = await window.electronAPI.getCurrentUserCredentials()
        curUserCredentials = Object.assign(curUserCredentials, { userName });
        await window.electronAPI.saveCurrentUserCredentials(curUserCredentials);
        await window.electronAPI.saveUserListCredentials(curUserCredentials)
        messageApi.success(t('avatarUploader.updateSuccess'))
    };

    const onSelectFile = (e) => {
        if (e.target.files && e.target.files.length > 0) {
            const reader = new FileReader();
            reader.addEventListener('load', () =>
                openModal('avatarUploader', { imgSrc: reader.result.toString() })
            );
            reader.readAsDataURL(e.target.files[0]);
        }
    };

    return (
        <div className="avatar-modal-content">
            <label htmlFor="file-upload">
                <Avatar className='file-upload' size={120} src={avatarSrc} alt="头像" />
            </label>
            <input
                type="file"
                id="file-upload"
                accept="image/*"
                onChange={onSelectFile}
                style={{ display: 'none' }}
            />
            <form onSubmit={handleSubmitInfo}>
                <div className='id-info'>
                    <label className='info-lable'>{t('avatarUploader.idLabel')}</label>
                    <div className="id-content">
                        <label>{currentUser.userId}</label>
                    </div>
                </div>
                <div className='name-info'>
                    <label className='info-lable' htmlFor="user-name">{t('avatarUploader.nicknameLabel')}</label>
                    <Input
                        type="text"
                        id="user-name"
                        name="userName"
                        defaultValue={currentUser?.username || ''}
                    />
                </div>
                <div className='email-info'>
                    <label className='info-lable' htmlFor="user-email">{t('avatarUploader.emailLabel')}</label>
                    <label style={{ color: `${currentUser?.email ? '' : 'red'}` }} >{currentUser?.email ? currentUser.email : t('avatarUploader.notBound')}</label>
                    <Button>{t('avatarUploader.bindEmail')}</Button>
                </div>
                <div className="modal-actions">
                    <button type='submit'>{t('avatarUploader.save')}</button>
                    <button onClick={onClose}>{t('avatarUploader.cancel')}</button>
                </div>
            </form>
        </div>
    );

}