import React, { useEffect } from 'react';
import { useSocket } from '../hooks/useSocket';
import { useState } from 'react';

const FriendsRequestManagement = () => {

    const socket = useSocket();
    const [friendRequests, setFriendRequests] = useState([]);

    useEffect(() => { 
        socket.emit('get-friend-requests');
    }, []);
    const handleFriendRequests = (requests) => setFriendRequests(requests);
    
    const handleRefreshRequests = () => socket.emit('get-friend-requests');

    useEffect(() => {
        socket.on('friend-requests', handleFriendRequests);
        socket.on('new-friend-request', handleRefreshRequests);
        socket.on('friend-request-accepted', handleRefreshRequests);

        return () => {
            socket.off('friend-requests', handleFriendRequests);
            socket.off('new-friend-request', handleRefreshRequests);
            socket.off('friend-request-accepted', handleRefreshRequests);
        };
    }, [])
    const handleAcceptRequest = (requesterId) => {
        if (socket) {
            socket.emit('accept-friend-request', requesterId);
        }
    };

    return (
        <div style={{ marginBottom: '20px' }}>
            <h4>好友请求</h4>
            {friendRequests.length > 0 ? (
                friendRequests.map(req => (
                    <div key={req.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '5px' }}>
                        <span>{req.username} ({req.id})</span>
                        <button onClick={() => handleAcceptRequest(req.id)}>接受</button>
                    </div>
                ))
            ) : (
                <p>没有新的好友请求</p>
            )}
        </div>
    );
};

export default FriendsRequestManagement;