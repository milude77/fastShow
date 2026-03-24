import { useEffect, useRef, useState } from 'react';
import { Modal } from 'antd';
import './css/contactOption.css'
import Avatar from '../avatar.jsx';
import { useGlobalModal } from '../../hooks/useModalManager.js';
import { useTranslation } from 'react-i18next';
import { useUserAvatar } from '../../hooks/useAvatar.js';

const ContactOption = ({ contact, currentUser, openContactOptions, onClose, groupMemberList, messageApi }) => {
    const { t } = useTranslation();
    const optionRef = useRef(null);
    const [modal, modalContextHolder] = Modal.useModal();
    const [serverUrl, setServerUrl] = useState('');
    const { openModal } = useGlobalModal();
    const { getAvatarUrl } = useUserAvatar();


    useEffect(() => {
        window.electronAPI.getServerUrl().then((url) => {
            setServerUrl(url);
        });
        const handleClickOutside = (event) => {
            if (event.target.closest('.ant-modal-root') || event.target.closest('#contact-options-btn')) {
                return;
            }
            if (optionRef.current && !optionRef.current.contains(event.target)) {
                onClose();
            }
        };

        if (openContactOptions) {
            setTimeout(() => document.addEventListener('mousedown', handleClickOutside), 0);
        }

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [openContactOptions, onClose]);

    const leaveGroup = async (contact) => {
        await window.electronAPI.leaveGroup(contact.id, currentUser.userId)
    }

    const deleteContactFun = async (contactId) => {
        await window.electronAPI.deleteContact(contactId);
    }

    const deleteContactMessageHistoryFun = async (contact) => {
        await window.electronAPI.deleteContactMessageHistory(contact)
        messageApi.success(t('contact.historyCleared'));
    }

    const handleDeleteContact = () => {
        modal.confirm({
            zIndex: 2000,
            centered: true,
            maskClosable: false,
            title: (
                <>
                    {t('contact.confirmDelete')} {contact.username}？
                    <span style={{ color: 'red' }}>{t('contact.clearHistoryWarning')}</span>
                </>
            ),
            onOk() {
                deleteContactFun(contact.id);
            }
        });
    };

    const handleDeleteContactMessageHistory = () => {
        modal.confirm({
            zIndex: 2000,
            centered: true,
            maskClosable: false,
            title: `${t('contact.confirmClearHistory')} "${contact.username}" ${t('contact.historyChat')}`,
            onOk() {
                deleteContactMessageHistoryFun(contact);
            }
        });
    };

    const handleLeaveGroup = () => {
        modal.confirm({
            zIndex: 2000,
            centered: true,
            maskClosable: false,
            title: (
                <>
                    {t('group.confirmLeave')} {contact.username}?
                    <span style={{ color: 'red' }}>{t('group.clearHistoryWarning')}</span>
                </>
            ),
            onOk() {
                leaveGroup(contact);
            }
        });
    };

    const handleInviteFriendsClick = () => {
        openModal('inviteFriends', {
            groupId: contact.id,
            groupName: contact.username,
        });
    };

    const onSelectFile = (e) => {
        if (e.target.files && e.target.files.length > 0) {
            const reader = new FileReader();
            reader.addEventListener('load', () =>
                openModal('avatarUploader', { imgSrc: reader.result.toString(), isGroupAvatarUpload: true, groupId: contact.id })
            );
            reader.readAsDataURL(e.target.files[0]);
        }
    };

    return (
        <div ref={optionRef} className={`contact-option ${openContactOptions ? 'visible' : ''}`} >
            {modalContextHolder}
            {contact.type === 'group' &&
                <div className="contact-option-header" >
                    {contact.myRole !== 'member' ? (
                        <label htmlFor="file-upload">
                            <Avatar
                                style={{ cursor: 'pointer' }}
                                size={50}
                                src={`${serverUrl}/api/avatar/${contact.id}/group`}
                                alt="群聊头像" />
                        </label>
                    ) : (
                        <div>
                            <Avatar
                                size={50}
                                src={`${serverUrl}/api/avatar/${contact.id}/group`}
                                alt="群聊头像" />
                        </div>
                    )}
                    {contact.myRole !== 'member' && (
                        <input
                            type="file"
                            id="file-upload"
                            accept="image/*"
                            onChange={onSelectFile}
                            style={{ display: 'none' }}
                        />
                    )}
                    <div style={{ display: 'flex', flexDirection: 'column' }} >
                        <strong>{contact.username}</strong>
                        <h4>id:{contact.id}</h4>
                    </div>

                </div>
            }
            {contact.type === 'group' &&
                <div className="group-member-list" >
                    {groupMemberList.slice(0, Math.min(groupMemberList.length, 14)).map((member, index) => {
                        return (
                            <div className="group-member" key={index}>
                                <Avatar
                                    size={40}
                                    src={getAvatarUrl(member.member_id)}
                                    alt={member.member_name} />
                                <span className="group-member-name">{member.member_name}</span>
                            </div>
                        )
                    })}
                    <div className="group-member" >
                        <button
                            onClick={handleInviteFriendsClick}
                            style={{
                                width: '40px',
                                height: '40px',
                                borderRadius: '50%',
                                color: 'var(--text-color)',
                                backgroundColor: 'var(--contact-option-bg-color)',
                                border: 'none',
                                cursor: 'pointer'
                            }}>
                            +
                        </button>
                        <span>{t('group.invite')}</span>
                    </div>
                </div>
            }
            <button className="delete-message-history" onClick={() => handleDeleteContactMessageHistory(contact)} >{t('contact.clearHistory')}</button>
            {contact.type === 'group' ?
                <button className="delete-message-history" onClick={() => handleLeaveGroup(contact)} >{t('group.leave')}</button>
                :
                <button className="delete-message-history" onClick={() => handleDeleteContact(contact.id)}>{t('contact.delete')}</button>
            }
        </div>
    )
}


export default ContactOption;