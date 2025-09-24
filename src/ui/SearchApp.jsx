import React, { useState, useEffect } from 'react';
import SearchUser from './components/searchUser';
import { useSocket } from './hooks/useSocket';
import AppHeaderBar from './components/appHeaderBar';

function SearchApp() {
  const socket = useSocket();
  const [friendRequests, setFriendRequests] = useState([]);
  const [searchResults, setSearchResults] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    if (!socket) return;

    // When the component mounts, immediately ask for the friend requests list
    socket.emit('get-friend-requests');

    const handleFriendRequests = (requests) => setFriendRequests(requests);
    const handleSearchResults = (results) => {
      setSearchResults(results);
    };
    // When a new request comes in or is accepted, refresh the list
    const handleRefreshRequests = () => socket.emit('get-friend-requests');

    socket.on('friend-requests', handleFriendRequests);
    socket.on('search-results', handleSearchResults);
    socket.on('new-friend-request', handleRefreshRequests);
    socket.on('friend-request-accepted', handleRefreshRequests);

    return () => {
      socket.off('friend-requests', handleFriendRequests);
      socket.off('search-results', handleSearchResults);
      socket.off('new-friend-request', handleRefreshRequests);
      socket.off('friend-request-accepted', handleRefreshRequests);
    };
  }, [socket]);

  const handleSearch = (e) => {
    e.preventDefault();
    if (socket && searchTerm.trim()) {
      socket.emit('search-users', searchTerm.trim());
    }
  };

  const handleAddFriend = (friendId , userId) => {
    if (socket) {
      return socket.emit('add-friend', friendId, userId);
    }
    else{
      return { success: false, message: '连接出错' }
    } 
  };

  const handleAcceptRequest = (requesterId) => {
    if (socket) {
      socket.emit('accept-friend-request', requesterId);
    }
  };

  return (
    <div className="search-container">
      <AppHeaderBar />
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

      <hr />

      <div style={{ marginTop: '20px' }}>
        <h4>搜索新好友</h4>
        <SearchUser 
          onSearch={handleSearch}
          searchTerm={searchTerm}
          setSearchTerm={setSearchTerm}
          searchResults={searchResults}
          onAddFriend={handleAddFriend}
        />
      </div>
    </div>
  );
}

export default SearchApp;
