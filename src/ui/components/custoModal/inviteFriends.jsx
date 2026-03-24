import { useEffect, useState } from 'react';
import { Button } from 'antd';
import './css/createGoupsApp.css';
import { Checkbox } from 'antd/lib/index.js';
import { useSocket } from '../../hooks/useSocket';
import { useTranslation } from 'react-i18next';
import { useUserAvatar } from '../../hooks/useAvatar.js';
import Avatar from '../avatar.jsx';


const InviteFriendsJoinGroup = ({ groupId, groupName, onClose }) => {
    const { t } = useTranslation();

    const [contacts, setContacts] = useState([]);
    const [checkedContacts, setCheckedContacts] = useState([]);
    const socket = useSocket();
    const { getAvatarUrl } = useUserAvatar();



    useEffect(() => {
        window.electronAPI.getContactList().then((contacts) => {
            const friendsList = contacts.filter(contact => contact.type === 'friend').sort((a, b) => b.lastMessage - a.lastMessage);
            setContacts(friendsList);
        });
    }, []);



    useEffect(() => {
        const handleInviteFriendsJoinGroup = () => {
            onClose()
        }

        socket.on('invite-friends-join-group-success', handleInviteFriendsJoinGroup);

        return () => {
            socket.off('invite-friends-join-group-success', handleInviteFriendsJoinGroup);
        }
    }, [ socket, onClose ]);


    return (
        <div className='create-groups-app-container'>
            <div className='friends-list'>
                <span className='create-group-title'>{t('group.inviteFriendsTitle')}</span>
                {contacts && contacts.map((contact, index) => (
                    <div key={index} className='friend-item'
                        onClick={() => {
                            if (checkedContacts.some(c => c.id === contact.id)) {
                                setCheckedContacts(checkedContacts.filter(c => c.id !== contact.id));
                            } else {
                                setCheckedContacts([...checkedContacts, contact]);
                            }
                        }}
                    >
                        <Checkbox
                            className='friend-checkbox'
                            checked={checkedContacts.some(c => c.id === contact.id)}
                        />
                        <Avatar src={getAvatarUrl(contact.id)} alt='avatar' className='friend-avatar' />
                        {contact.username}
                    </div>
                ))}
            </div>
            <div className='create-group-form'>
                <span className='create-group-title'>{t('group.selectFriends')}</span>
                {checkedContacts && checkedContacts.map((contact, index) => (
                    <div key={index} className='selected-contact-item'>
                        <div key={index} className='friend-item'>
                            <Avatar src={getAvatarUrl(contact.id)} alt='avatar' className='friend-avatar' />
                            <span>{contact.username}</span>
                        </div>
                    </div>
                ))}
                <div className='create-group-button'>
                    <Button
                        type='primary'
                        disabled={checkedContacts.length === 0}
                        onClick={() => {
                            socket.emit('invite-friends-join-group', { groupId, groupName, checkedContacts });
                        }}
                        style={{ marginTop: 12, color: 'var(--text-color)' }}
                    >
                        {t('group.invite')}
                    </Button>
                    <Button
                        type='primary'
                        onClick={onClose}
                        style={{ marginTop: 12 }}
                    >
                        {t('common.cancel')}
                    </Button>
                </div>
            </div>
        </div>
    );
}

export default InviteFriendsJoinGroup;