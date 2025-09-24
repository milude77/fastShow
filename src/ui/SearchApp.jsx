import React, { useState, useEffect } from 'react';
import SearchUser from './components/searchUser';
import { useSocket } from './hooks/useSocket';
import AppHeaderBar from './components/appHeaderBar';

function SearchApp() {
  const socket = useSocket();

  const [searchResults, setSearchResults] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    if (!socket) return;


    const handleSearchResults = (results) => {
      setSearchResults(results);
    };

    

    socket.on('search-results', handleSearchResults);


    return () => {
      socket.off('search-results', handleSearchResults);
    };
  }, [socket]);

  const handleSearch = (e) => {
    e.preventDefault();
    if (socket && searchTerm.trim()) {
      socket.emit('search-users', searchTerm.trim());
    }
  };

  const handleAddFriend = (friendId, userId) => {
    if (socket) {
      return socket.emit('add-friend', friendId, userId);
    }
    else {
      return { success: false, message: '连接出错' }
    }
  };



  return (
    <div className="search-container">
      <AppHeaderBar />
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
