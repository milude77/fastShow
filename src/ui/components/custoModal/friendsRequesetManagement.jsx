import React, { useEffect, useState } from 'react';
import { useSocket } from '../../hooks/useSocket';
import './css/friendsRequesetManagement.css';
import { useGlobalMessage } from '../../hooks/useGlobalMessage.js';
import { useTranslation } from 'react-i18next';



const FriendsRequestManagement = () => {
    const { t } = useTranslation();


    const socket = useSocket();
    const { messageApi } = useGlobalMessage();
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


    const handleAcceptRequest = (requesterId, isGroupInvite) => {
        if (socket) {
            if (isGroupInvite) {
                socket.emit('accept-group-invite', requesterId);
                window.electronAPI.acceptGroupInvite(requesterId);
                setInviteInformationList(prev => ({
                    ...prev,
                    [requesterId]: {
                        ...prev[requesterId],
                        status: 'accept'
                    }
                }));
                messageApi.success(t('friendsRequest.acceptedGroupInvite'));
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
            messageApi.success(t('friendsRequest.acceptedFriendRequest'));
        }
    };

    const handleDeclineRequest = (requesterId, isGroupInvite) => {
        if (socket) {
            if (isGroupInvite) {
                socket.emit('decline-group-invite', requesterId);
                window.electronAPI.declineGroupInvite(requesterId);
                setInviteInformationList(prev => ({
                    ...prev,
                    [requesterId]: {
                        ...prev[requesterId],
                        status: 'declined'
                    }
                }));
                messageApi.success(t('friendsRequest.declinedGroupInvite'));
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
            messageApi.success(t('friendsRequest.declinedFriendRequest'));
        }
    }
    const renderActionButtons = (status, id, isGroupInvite = false) => {
        switch (status) {
            case 'pending':
                return (
                    <div>
                        <button onClick={() => handleAcceptRequest(id, isGroupInvite)}>{t('friendsRequest.accept')}</button>
                        <button onClick={() => handleDeclineRequest(id, isGroupInvite)}>{t('friendsRequest.decline')}</button>
                    </div>
                );
            case 'accept':
                return (
                    <div>
                        <span>{`${isGroupInvite ? t('friendsRequest.acceptedGroupInvite') : t('friendsRequest.acceptedFriendRequest')}`}</span>
                    </div>
                );
            case 'declined':
                return (
                    <div>
                        <span> {`${isGroupInvite ? t('friendsRequest.declinedGroupInvite') : t('friendsRequest.declinedFriendRequest')}`}</span>
                    </div>
                );
            default:
                return null;
        }
    };

    return (
        <div className='friends-request-management'>
            <h4 className='title'>{t('friendsRequest.title')}</h4>
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
                                        <h4>{req.inviter_name}</h4> {t('friendsRequest.requestAddFriend')}
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
                                        <h4>{req.inviter_name}</h4> {t('friendsRequest.inviteJoinGroup')} <h4>{req.group_name}</h4>
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
                        <p>{t('friendsRequest.noNewRequests')}</p>
                    )}
            </div>
        </div>
    );
};

export default FriendsRequestManagement;