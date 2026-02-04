import React, { useState, useEffect } from 'react';
import { useSocket } from './hooks/useSocket';
import AppHeaderBar from './components/appHeaderBar';
import { message } from 'antd';
import selectImg from './assets/select.png';
import { Button } from 'antd/es/radio';
import { useUserAvatar } from './hooks/useAvatar.js';
import Avatar from './components/avatar.jsx';

const SearchUser = ({ onSearch, searchTerm, setSearchTerm, searchResults, onAddFriend }) => {
  const socket = useSocket();
  const [messageApi, contextHolder] = message.useMessage();

  const { getAvatarUrl } = useUserAvatar();

  const handleAddFriendCall = (message) => {
    if (message.success) {
      messageApi.success('好友请求已发送');
    }
    else {
      messageApi.error(`发送好友请求失败 错误原因：${message.message}`);
    }
  }




  useEffect(() => {
    socket.on('add-friends-msg', (message) => { handleAddFriendCall(message) })

    return () => {
      socket.off('add-friends-msg');
    }
  }, [socket])
  const handleAddFriend = async (userId) => {
    await onAddFriend(userId);
  }

  return (
    <div className="search-user-container" style={{ display: 'flex', flexDirection: 'column' }}>
      {contextHolder}
      <form onSubmit={onSearch} style={{ display: 'flex', width: '100%', justifyContent: 'center', alignItems: 'center' }}>
        <input
          style={{ width: '50%', alignItems: 'center', height: '30px' }}
          type="search"
          placeholder="按 用户名/id 搜索"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
        <button
          type="submit"
          style={{
            backgroundColor: '#ecececff',
            height: '30px',
            borderRadius: '5px',
            margin: '0 10px',
            border: '1px solid #d9d9d9',
            cursor: 'pointer',
            padding: '0 15px'
          }}
        >
          搜索
        </button>
      </form>
      <div style={{
        flex: '1',
        marginTop: '10px',
        width: '100%',
        overflowY: 'auto', // 添加垂直滚动条
        maxHeight: '70vh'
      }}>
        {searchResults.length > 0 ?
          (searchResults.map(user => (
            <div key={user.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '5px' }}>
              <div style={{ display: 'flex', alignItems: 'center' }}>
                {console.log(getAvatarUrl(user.id))}
                <Avatar
                  src={getAvatarUrl(user.id)}
                  size={40}
                />
                <span>{user.username} ({user.id})</span>
              </div>
              <Button onClick={() => handleAddFriend(user.id)}>添加好友</Button>
            </div>
          )))
          :
          (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
              <div style={{
                backgroundImage: `url(${selectImg})`,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
                backgroundRepeat: 'no-repeat',
                height: '200px',
                width: '200px',
                margin: '0 auto',
                justifyContent: 'center',
                alignItems: 'center',
                color: 'white',
                fontSize: '20px',
                fontWeight: 'bold',
                opacity: 0.15,
              }}>
              </div>
              <span>
                搜索结果无用户/群聊
              </span>
            </div>
          )
        }
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
    if (selectInformation.trim()) {
      setSearchTerm(selectInformation.trim());
    }
    if (socket && selectInformation.trim()) {
      socket.emit('search-users', selectInformation.trim());
    }
  }, [])

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
