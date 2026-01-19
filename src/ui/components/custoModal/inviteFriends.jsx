import { React, useEffect, useState } from 'react';
import { Alert, Button } from 'antd';
import './css/createGoupsApp.css';
import { Checkbox, Input, Select } from 'antd/lib/index.js';
import { useSocket } from '../../hooks/useSocket';
import { useGlobalMessage } from '../../hooks/useGlobalMessage.js';

const InviteFriendsJoinGroup = ({ groupId, groupName , member, onClose }) => {

    const [contacts, setContacts] = useState([]);
    const [checkedContacts, setCheckedContacts] = useState([]);
    const socket = useSocket();
    const { messageApi } = useGlobalMessage();
    const [serverUrl, setServerUrl] = useState('');



    useEffect(() => {
        window.electronAPI.getServerUrl().then((url) => {
            setServerUrl(url)
        });
        window.electronAPI.getFriendsList().then((friends) => {
            if (member){
                const memberIds = new Set(member.map(m => m.userId));
                friends = friends.filter(f => !memberIds.has(f.id));
            }
            setContacts(friends);
        });
    }, []);



    useEffect(() => {
        const handleInviteFriendsJoinGroup = () => {
            messageApi.success('邀请信息已发送');
            setCheckedContacts([]);
        }

        socket.on('invite-friends-join-group-success', handleInviteFriendsJoinGroup);

        return () => {
            socket.off('invite-friends-join-group-success', handleInviteFriendsJoinGroup);
        }
    }, []);


    return (
        <div className='create-groups-app-container'>
            <div className='friends-list'>
                <span className='create-group-title'>邀请好友加入群聊</span>
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
                        <img src={`${serverUrl}/api/avatar/${contact.id}/user`} alt='avatar' className='friend-avatar' />
                        {contact.userName}
                    </div>
                ))}
            </div>
            <div className='create-group-form'>
                <span className='create-group-title'>选择好友</span>
                {checkedContacts && checkedContacts.map((contact, index) => (
                    <div key={index} className='selected-contact-item'>
                        <div key={index} className='friend-item'>
                            <img src={`${serverUrl}/api/avatar/${contact.id}/user`} alt='avatar' className='friend-avatar' />
                            <span>{contact.userName}</span>
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
                        style={{ marginTop: 12 }}
                    >
                        邀请
                    </Button>
                    <Button
                        type='primary'
                        onClick={onClose}
                        style={{ marginTop: 12 }}
                    >
                        取消
                    </Button>
                </div>
            </div>
        </div>
    );
}

export default InviteFriendsJoinGroup;