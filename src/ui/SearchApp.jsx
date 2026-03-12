import React, { useState, useEffect, useCallback } from 'react';
import { useSocket } from './hooks/useSocket';
import AppHeaderBar from './components/appHeaderBar';
import { message } from 'antd';
import selectImg from './assets/select.png';
import { Button } from 'antd/es/radio';
import { useUserAvatar } from './hooks/useAvatar.js';
import Avatar from './components/avatar.jsx';
import { useTranslation } from 'react-i18next';
import './css/dark-mode.css';

const SearchUser = ({ onSearch, searchTerm, setSearchTerm, searchResults, onAddFriend }) => {
  const { t } = useTranslation();
  const socket = useSocket();
  const [messageApi, contextHolder] = message.useMessage();
  const [theme, setTheme] = useState('light');

  const { getAvatarUrl } = useUserAvatar();

  const handleAddFriendCall = useCallback((message) => {
    if (message.success) {
      messageApi.success(t('friendsRequest.sent'));
    }
    else {
      messageApi.error(`${t('friendsRequest.sendFailed')}${message.message}`);
    }
  }, [messageApi, t])

  const handleThemeUpdated = useCallback((event, theme) => {
    setTheme(theme);
  }, []);

  useEffect(() => {
    window.electronAPI.getSettingsValue('theme').then(setTheme);
  }, []);

  useEffect(() => {
    window.electronAPI.ipcRenderer.on('theme-updated', handleThemeUpdated);

    return () => {
      window.electronAPI.ipcRenderer.removeListener('theme-updated', handleThemeUpdated);
    };
  }, []);


  useEffect(() => {
    if (theme === 'dark') {
      document.body.classList.add('dark-mode');
    } else {
      document.body.classList.remove('dark-mode');
    }
  }, [theme]);




  useEffect(() => {
    socket.on('add-friends-msg', (message) => { handleAddFriendCall(message) })

    return () => {
      socket.off('add-friends-msg');
    }
  }, [socket, handleAddFriendCall])
  const handleAddFriend = async (userId) => {
    await onAddFriend(userId);
  }

  return (
    <div className="search-user-container" style={{ display: 'flex', flexDirection: 'column' }}>
      {contextHolder}
      <form onSubmit={onSearch} style={{ display: 'flex', width: '100%', justifyContent: 'center', alignItems: 'center' }}>
        <input
          style={{ width: '50%', alignItems: 'center', height: '30px', backgroundColor: 'var(--tool-bar-bg-color)', color:'var(--text-color)' }}
          type="search"
          placeholder={t('search.placeholder')}
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
        <button
          type="submit"
          style={{
            backgroundColor: 'var(--tool-bar-bg-color)',
            color:'var(--text-color)',
            height: '30px',
            borderRadius: '5px',
            margin: '0 10px',
            border: '1px solid #d9d9d9',
            cursor: 'pointer',
            padding: '0 15px'
          }}
        >
          {t('common.search')}
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
                <Avatar
                  src={getAvatarUrl(user.id)}
                  size={40}
                />
                <span>{user.username} ({user.id})</span>
              </div>
              <Button onClick={() => handleAddFriend(user.id)}>{t('app.addFriend')}</Button>
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
                {t('search.noResults')}
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
