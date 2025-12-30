import { useEffect, useRef, useState } from 'react';
import { message, Modal } from 'antd';
import './css/contactOption.css'


const ContactOption = ({ contact, currentUser, openContactOptions, deleteContactMessageHistory, deleteContact, onClose, inviteFriendsJoinGroup }) => {
    const optionRef = useRef(null);
    const [modal, modalContextHolder] = Modal.useModal();
    const [serverUrl, setServerUrl] = useState('');


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

    const leaveGroup = (contact) => {
        window.electronAPI.leaveGroup(contact.id, currentUser.userId).then(() => {
            message.success('退出群聊成功！');
            onClose();
        }).catch((error) => {
            message.error('退出群聊失败！');
            console.error(error);
        });
    }

    const handleDeleteContact = () => {
        modal.confirm({
            zIndex: 2000,
            centered: true,
            maskClosable: false,
            title: (
            <>
                确认删除好友 {contact.username}？
                <span style={{ color: 'red' }}>(将清空所有历史消息！)</span>
            </>
            ),
            onOk() {
                deleteContact(contact.id);
            }
        });
    };

    const handleDeleteContactMessageHistory = () => {
        modal.confirm({
            zIndex: 2000,
            centered: true,
            maskClosable: false,
            title: `确认清空 "${contact.username}" 的历史聊天记录？`,
            onOk() {
                deleteContactMessageHistory(contact);
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
                    确认退出群聊 {contact.username}？
                    <span style={{ color: 'red' }}>(将清空所有历史消息！)</span>
                </>
            ),
            onOk() {
                leaveGroup(contact);
            }
        });
    };

    const inviteFriends = () => {

    }

    return (
        <div ref={optionRef} className={`contact-option ${openContactOptions ? 'visible' : ''}`} >
            {modalContextHolder}
            {contact.type === 'group' &&
                <div className="contact-option-header" >
                    <img style={{ width: '50px', height: '50px', borderRadius: '50%' }} src={`${serverUrl}/api/avatar/${contact.id}/group`} alt="群聊头像" />
                    <div style={{ display: 'flex', flexDirection: 'column' }} >
                        <strong>{contact.username}</strong>
                        <h4>id:{contact.id}</h4>
                    </div>

                </div>
            }
            {contact.type === 'group' &&
                <div className="group-member-list" >
                    {contact.members.slice(0, Math.min(contact.members.length, 14)).map((member, index) => {
                        return (
                            <div className="group-member" key={index}>
                                <img src={`${serverUrl}/api/avatar/${member.userId}/user?t=${member.userId === currentUser.userId ? currentUser.avatarVersion : ''}`} alt={member.userName} />
                                <span className="group-member-name">{member.userName}</span>
                            </div>
                        )
                    })}
                    <div className="group-member" onClick={() => inviteFriends()} >
                        <button onClick={inviteFriendsJoinGroup} style={{ width: '40px', height: '40px', borderRadius: '50%', color: 'var(--text-color)', backgroundColor: 'var(--contact-option-bg-color)', border: 'none', cursor: 'pointer' }}   >+</button>
                        <span>邀请</span>
                    </div>
                </div>
            }
            <button className="delete-message-history" onClick={() => handleDeleteContactMessageHistory(contact)} >清空历史聊天记录</button>
            {contact.type === 'group' ?
                <button className="delete-message-history" onClick={() => handleLeaveGroup(contact)} >退出群聊</button>
                :
                <button className="delete-message-history" onClick={() => handleDeleteContact(contact.id)}>删除好友</button>
            }
        </div>
    )
}


export default ContactOption;