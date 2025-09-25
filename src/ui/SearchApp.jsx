import React, { useState, useEffect } from 'react';
import { useSocket } from './hooks/useSocket';
import AppHeaderBar from './components/appHeaderBar';
import { Alert } from 'antd';

const SearchUser = ({ onSearch, searchTerm, setSearchTerm, searchResults, onAddFriend }) => {
  const socket = useSocket();
  const [showAlert, setShowAlert] = useState(false);
  const [alertMessage, setAlertMessage] = useState('');
  const [alertType, setAlertType] = useState('success');

  const handleAddFriendCall = (message) => {
    if (message.success) {
      setAlertType('success')
      setAlertMessage('发送好友请求成功')
      setShowAlert(true);
      setTimeout(() => {
        setShowAlert(false);
      }, 3000);
    }
    else {
      setAlertType('error')
      setAlertMessage(`发送好友请求失败 错误原因：${message.message}`)
      setShowAlert(true);
      setTimeout(() => {
        setShowAlert(false);
      }, 3000);
    }
  }

  useEffect(() => {
    socket.on('add-friends-msg', (message) => { handleAddFriendCall(message) })

    return () => {
      socket.off('add-friends-msg');
    }
  })
  const handleAddFriend = async (userId) => {
    await onAddFriend(userId);
  }

  return (
    <div>
      {showAlert && <Alert message={alertMessage} type={alertType} showIcon style={{ marginBottom: '10px' }} />}
      <form onSubmit={onSearch}>
        <input
          type="text"
          placeholder="按 用户名/id 搜索"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          style={{ marginRight: '5px' }}
        />
        <button type="submit">搜索</button>
      </form>
      <div style={{ marginTop: '10px' }}>
        {searchResults.map(user => (
          <div key={user.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '5px' }}>
            <span>{user.username} ({user.id})</span>
            <button onClick={() => handleAddFriend(user.id)}>添加好友</button>
          </div>
        ))}
      </div>
    </div>
  );
}


function SearchApp() {
  const socket = useSocket();

  const [searchResults, setSearchResults] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const urlParams = new URLSearchParams(window.location.search);
  const selectInformation = urlParams.get('selectInformation');

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

  useEffect(() => {
    if (selectInformation.trim()){
      setSearchTerm(selectInformation.trim());
    }
    if (socket && selectInformation.trim()) {
      socket.emit('search-users', selectInformation.trim());
    }
  },[])

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
