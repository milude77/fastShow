import { useState, useEffect, useRef, useCallback } from 'react';
import { Alert, Button, ConfigProvider, Dropdown, Menu } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import { SearchOutlined, PlusOutlined, UsergroupAddOutlined, CommentOutlined } from '@ant-design/icons';
import './css/App.css';
import './css/dark-mode.css';
import AppHeaderBar from './components/appHeaderBar';
import ContactList from './components/Contact/contactList';
import MessageList from './components/Message/messageList';
import ContactInformation from './components/addressBook/contactInformation';
import FriendsRequestManagement from './components/custoModal/friendsRequesetManagement';
import ToolBar from './components/toolBar/toolBar.jsx';
import AuthPage from './AuthPage';
import AddressBook from './components/addressBook/addressBook.jsx';
import { useAuth } from './hooks/useAuth';
import { useSocket } from './hooks/useSocket';
import { useGlobalMessage } from './hooks/useGlobalMessage';
import { useGlobalModal } from './hooks/useModalManager';
import { useMessageList } from './hooks/useMessageList';

import titleImage from './assets/title.png';



const SearchBar = ({ currentUser, onCreateGroup }) => {

  const [searchTerm, setSearchTerm] = useState('');

  const handleKeyDown = (event) => {
    if (event.key === 'Enter' && searchTerm.trim()) {
      window.electronAPI.openSearchWindow(currentUser.id, searchTerm);
    }
  };

  const MenuItem = (
    <Menu>
      <Menu.Item className='menu-item' key="1">
        <Button type="link" onClick={onCreateGroup}><CommentOutlined />创建群聊</Button>
      </Menu.Item>
      <Menu.Item className='menu-item' key="2">
        <Button type="link" onClick={() => { window.electronAPI.openSearchWindow(currentUser.id, searchTerm) }}><UsergroupAddOutlined />添加好友</Button>
      </Menu.Item>
    </Menu>
  );

  return (

    <div className="search-bar-container" style={{ display: 'flex', alignItems: 'center' }}>
      <div className='search-input-bar'>
        <SearchOutlined />
        <input
          style={{ color: 'var(--text-color)' }}
          className='search-input'
          type="search"
          placeholder="搜索"
          onChange={(e) => setSearchTerm(e.target.value)}
          value={searchTerm}
          onKeyDown={handleKeyDown}
        />
      </div>
      <div className='search-tool-btn'>
        <Dropdown
          overlay={MenuItem}
          trigger={['click']}
        >
          <Button style={{ color: 'var(--text-color)' }} type="text" icon={<PlusOutlined />} />
        </Dropdown>
      </div>
    </div>
  );
};

function App() {
  const [darkMode, setDarkMode] = useState(false);
  const [selectFeatures, setSelectFeatures] = useState('message');
  const [selectedContact, setSelectedContact] = useState(null);
  const selectedContactRef = useRef(selectedContact);
  const [selectedContactInformation, setSelectedContactInformation] = useState(null);
  const [connectionStatus, setConnectionStatus] = useState('connected');
  const [contacts, setContacts] = useState([]);
  const { messageApi } = useGlobalMessage();

  const { currentUser, setCurrentUser } = useAuth();
  const socket = useSocket();

  const { openModal } = useGlobalModal();
  const messageListHook = useMessageList(selectedContact);
  const {
    handleChatHistoryDeleted,
    handleSendMessageStatus,
    handleNewMessage,
    MessageListSelectContact
  } = messageListHook;

  useEffect(() => {
    selectedContactRef.current = selectedContact;
  }, [selectedContact]);

  const toggleDarkMode = () => {
    window.electronAPI.toggleTheme(darkMode === true ? 'light' : 'dark');
    setDarkMode(!darkMode);
  };

  useEffect(() => {
    const fetchTheme = async () => {
      const theme = await window.electronAPI.getCurTheme();
      if (theme === 'dark' && currentUser) {
        setDarkMode(true);
        document.body.classList.add('dark-mode');
      } else {
        setDarkMode(false);
        document.body.classList.remove('dark-mode');
      }
    };

    fetchTheme();
  }, [currentUser]);

  useEffect(() => {
    if (currentUser) {
      window.electronAPI.resizeWindow(1100, 750);
    }
  }, [currentUser]);

  useEffect(() => {
    if (darkMode) {
      document.body.classList.add('dark-mode');
    } else {
      document.body.classList.remove('dark-mode');
    }
  }, [darkMode]);

  const handleLoginSuccess = useCallback((data) => {
    const { userId, username, token, email } = data;
    window.electronAPI.loginSuccess({ userId, token });
    window.electronAPI.saveCurrentUserCredentials({ userId, userName: username, token });
    window.electronAPI.saveUserListCredentials({ userId, userName: username, token });
    localStorage.setItem('token', token);
    localStorage.setItem('currentUser', JSON.stringify({
      userId: userId,
      username: username
    }));
    setCurrentUser({ userId, username, email, token });
  }, [setCurrentUser]);

  const handleFriendsList = useCallback((friendsWithGroups) => {
    setContacts(friendsWithGroups);
  }, [setContacts]);

  const friendsRequestAccepted = useCallback((data) => {
    setContacts(prevContacts => [...prevContacts, data]);
  }, []);

  const handleNewGroup = useCallback((data) => {
    setContacts(prevContacts => [...prevContacts, data]);
  }, []);

  const handleLeaveGroupSuccess = useCallback((groupId) => {
    messageApi.success('退出群聊成功');
    setContacts(prevContacts => prevContacts.filter(contact => contact.type !== 'group' || contact.id !== groupId));
    setSelectedContact(null)
  }, []);

  const handleConnect = useCallback(() => {
    setConnectionStatus('connected');
    if (currentUser) {
      socket.emit('login-with-token', currentUser.token);
    }
  }, [socket, currentUser]);

  const handleDisconnect = useCallback(() => setConnectionStatus('disconnected'), []);
  const handleReconnecting = useCallback(() => setConnectionStatus('reconnecting'), []);

  const handleMessageListSelectContact = useCallback(async (contact) => {
    setSelectedContact(contact);
    await MessageListSelectContact(contact)
  }, [MessageListSelectContact]);

  const handleNewFriendRequests = useCallback((data) => {
    data.isGroup = false
    window.electronAPI.saveInviteinformationList(data)
  }, []);

  const handleNewGroupInvite = useCallback((data) => {
    data.isGroup = true
    window.electronAPI.saveInviteinformationList(data)
  }, []);


  const handleStrongLogoutWarning = useCallback(async (data) => {
    const message = data.message;
    setCurrentUser(null);
    await window.electronAPI.strongLogoutWaring(message);
  }, [setCurrentUser]);


  const handleNotificationMessage = useCallback((data) => {
    switch (data.status) {
      case 'success':
        messageApi.success(data.message);
        break;
      case 'error':
        messageApi.error(data.message);
        break;
      case 'info':
        messageApi.info(data.message);
        break;
    }
  }, [messageApi]);

  useEffect(() => {
    window.electronAPI.ipcRenderer.on('contact-deleted', handleDeleteContact);
    window.electronAPI.ipcRenderer.on('message-history-deleted', handleChatHistoryDeleted);

    return () => {
      window.electronAPI.ipcRenderer.removeListener('contact-deleted', handleDeleteContact);
      window.electronAPI.ipcRenderer.removeListener('message-history-deleted', handleChatHistoryDeleted);
    }

  }, [])

  useEffect(() => {
    if (!socket) return;
    socket.on('login-success', handleLoginSuccess);
    socket.on('new-message', handleNewMessage);
    socket.on('contacts-list', handleFriendsList);
    socket.on('friend-request-accepted', friendsRequestAccepted);
    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);
    socket.on('reconnecting', handleReconnecting);
    socket.on('message-sent-success', handleSendMessageStatus)
    socket.on('new-group', handleNewGroup)
    socket.on('leave-group-success', handleLeaveGroupSuccess)
    socket.on('new-friend-request', handleNewFriendRequests);
    socket.on('group-invite', handleNewGroupInvite);
    socket.on('notification', handleNotificationMessage);
    socket.on('strong-logout-warning', handleStrongLogoutWarning);

    return () => {
      socket.off('login-success', handleLoginSuccess);
      socket.off('user-registered', handleLoginSuccess);
      socket.off('contacts-list', handleFriendsList);
      socket.off('new-message', handleNewMessage);
      socket.off('friend-request-accepted', friendsRequestAccepted);
      socket.off('connect', handleConnect);
      socket.off('disconnect', handleDisconnect);
      socket.off('reconnecting', handleReconnecting);
      socket.off('message-sent-success', handleSendMessageStatus)
      socket.off('new-group', handleNewGroup)
      socket.off('leave-group-success', handleLeaveGroupSuccess)
      socket.off('new-friend-request', handleNewFriendRequests);
      socket.off('group-invite', handleNewGroupInvite);
      socket.off('notification', handleNotificationMessage);
      socket.off('strong-logout-warning', handleStrongLogoutWarning);
    };
  }, [socket, messageApi]);


  const handleAddressBookSelectContact = useCallback((contact) => {
    setSelectedContactInformation(contact);
  }, []);


  const handleToSendMessage = useCallback((contact) => {
    setSelectedContact(contact)
    setSelectFeatures('message')
    setSelectedContactInformation(null)
  }, [])



  const handleDeleteContact = useCallback((event, { contactId }) => {
    messageApi.success('删除好友成功');
    setSelectedContactInformation(null)
    setSelectedContact(null)
    setContacts(prevContacts => {
      const newContacts = prevContacts.filter(contact => { return (contact.id !== contactId || contact.type !== 'friend') });
      return newContacts;
    });
  }, []);

  const renderFeature = () => {
    switch (selectFeatures) {
      case 'message':
        return <ContactList
          selectedContact={selectedContact}
          contacts={contacts}
          onSelectContact={handleMessageListSelectContact}
        />;
      case 'contact':
        return <AddressBook
          selectedContact={selectedContactInformation}
          contacts={contacts}
          onSelectContact={handleAddressBookSelectContact}
        />;
      default:
        return <div>默认列表</div>;
    }
  };

  const handleCreateGroup = () => {
    openModal('createGroup')
  }



  const renderConnectionStatus = () => {
    if (connectionStatus === 'disconnected') {
      return <Alert message="已断开连接" type="error" showIcon />;
    }
    if (connectionStatus === 'reconnecting') {
      return <Alert message="正在重新连接..." type="warning" showIcon />;
    }
    return null;
  };

  const renderInformationFunctionBar = () => {
    if (selectFeatures === 'message' && selectedContact) {
      return (
        <MessageList
          contact={selectedContact}
          messageListHook = {messageListHook}
        />
      );
    }
    if (selectFeatures === 'contact' && selectedContactInformation) {
      if (selectedContactInformation !== 'friendsRequest') {
        return (
          <ContactInformation
            contactInformation={contacts.filter(contact => { return contact.id === selectedContactInformation && contact.type === 'friend' })[0]}
            toSendMessage={handleToSendMessage}
            deleteContact={handleDeleteContact}
          />);
      }
      else {
        return (
          <FriendsRequestManagement />
        );
      }
    }

    return <div className="background-image-container" style={{ backgroundImage: `url(${titleImage})` }}></div>;
  };



  if (!currentUser) {
    return (
      <div>
        <AppHeaderBar />
        <AuthPage />
      </div>);
  }

  return (
    <ConfigProvider locale={zhCN}>
      <div className="app-wrapper">
        <div className="app">
          <div className='app-features-bar'>
            <ToolBar
              currentUser={currentUser}
              selectFeatures={selectFeatures}
              setSelectFeatures={setSelectFeatures}
              isDarkMode={darkMode}
              toggleDarkMode={toggleDarkMode}
            />
          </div>
          <div className='contact-list-container'>
            {renderConnectionStatus()}
            <SearchBar currentUser={currentUser} onCreateGroup={handleCreateGroup} />
            <div className='contact-list'>
              {renderFeature()}
            </div>
          </div>
          <div className='message-box'>
            <div className='message-box-header'>
              <AppHeaderBar />
            </div>
            <div className='message-box-body'>
              {renderInformationFunctionBar()}
            </div>
          </div>
        </div>
      </div>
    </ConfigProvider>
  );
}

export default App;
