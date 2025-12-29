import React, { useEffect, useState, useMemo } from 'react';
import { useSocket } from '../hooks/useSocket';
import { message } from 'antd';
import '../css/friendsRequesetManagement.css';

const FriendsRequestManagement = () => {

    const socket = useSocket();
    const [messageApi, contextHolder] = message.useMessage();
    const [inviteInformationList, setInviteInformationList] = useState({});
    const [serverUrl, setServerUrl] = useState('');


    useEffect(() => {
        window.electronAPI.getServerUrl().then((url) => {
            setServerUrl(url)
        });
        window.electronAPI.getInviteInformationList().then((list) => {
            const mappedList = list.reduce((acc, item) => {
                acc[item.id] = item;
                return acc;
            }, {});
            setInviteInformationList(mappedList);
        })
    }, []);


    const handleAcceptRequest = (requesterId,isGroupInvite) => {
        if (socket) {
            if (isGroupInvite){
                socket.emit('accept-group-invite', requesterId);
                window.electronAPI.acceptGroupInvite(requesterId);
                setInviteInformationList(prev => ({
                    ...prev,
                    [requesterId]: {
                        ...prev[requesterId],
                        status: 'accept'
                    }
                }));
                messageApi.success('已接受群邀请');
                return;
            }
            socket.emit('accept-friend-request', requesterId);
            window.electronAPI.acceptFriendRequest(requesterId);
            setInviteInformationList(prev => ({
                ...prev,
                [requesterId]: {
                    ...prev[requesterId],
                    status: 'accept'
                }
            }));
            messageApi.success('已接受好友请求');
        }
    };

    const handleDeclineRequest = (requesterId,isGroupInvite) => {
        if (socket) {
            if (isGroupInvite){
                socket.emit('decline-group-invite', requesterId);
                window.electronAPI.declineGroupInvite(requesterId);
                setInviteInformationList(prev => ({
                    ...prev,
                    [requesterId]: {
                        ...prev[requesterId],
                        status: 'declined'
                    }
                }));
                messageApi.success('已拒绝群邀请');
                return;
            }
            socket.emit('decline-friend-request', requesterId);
            window.electronAPI.declineFriendRequest(requesterId);
            setInviteInformationList(prev => ({
                ...prev,
                [requesterId]: {
                    ...prev[requesterId],
                    status: 'declined'
                }
            }));
            messageApi.success('已拒绝好友请求');
        }
    }
    const renderActionButtons = (status, id, isGroupInvite = false) => {
        switch (status) {
            case 'pending':
                return (
                    <div>
                        <button onClick={() => handleAcceptRequest(id,isGroupInvite)}>接受</button>
                        <button onClick={() => handleDeclineRequest(id,isGroupInvite)}>拒绝</button>
                    </div>
                );
            case 'accept':
                return (
                    <div>
                        <span>已接受</span>
                    </div>
                );
            case 'declined':
                return (
                    <div>
                        <span>已拒绝</span>
                    </div>
                );
            default:
                return null;
        }
    };


    return (
        <div className='friends-request-management'>
            {contextHolder}
            <h4 className='title'>好友请求</h4>
            <div className='invite-list'>
                {inviteInformationList && Object.keys(inviteInformationList).length > 0 ? (
                    Object.entries(inviteInformationList).map(([id, req]) => (
                        !req.is_group_invite ? (
                            <div key={id} className='invite-item'>
                                <img
                                    src={`${serverUrl}/api/avatar/${req.inviter_id}/user`}
                                    alt="头像"
                                    className='invite-avatar'
                                />
                                <div className='invite-content'>
                                    <span className='invite-text'>
                                        <h4>{req.inviter_name}</h4> 请求添加你为好友
                                    </span>
                                    <div className='invite-actions'>
                                        {renderActionButtons(req.status, id)}
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div key={id} className='invite-item'>
                                <img
                                    src={`${serverUrl}/api/avatar/${req.inviter_id}/user`}
                                    alt="头像"
                                    className='invite-avatar'
                                />
                                <div className='invite-content'>
                                    <span className='invite-text'>
                                        <h4>{req.inviter_name}</h4> 邀请你加入群聊 <h4>{req.group_name}</h4>
                                    </span>
                                    <div className='invite-actions'>
                                        {renderActionButtons(req.status, id, true)}
                                    </div>
                                </div>
                            </div>
                        )
                    ))
                )
                    : (
                        <p>没有新的好友请求</p>
                    )}
            </div>
        </div>
    );
};

export default FriendsRequestManagement;