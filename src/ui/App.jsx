import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Routes, Route, useNavigate, useParams, useLocation } from 'react-router-dom';
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
import CustomModal from './components/custoModal/customModal.jsx';
import ToolBar from './components/toolBar/toolBar.jsx';
import AuthPage from './AuthPage';
import AddressBook from './components/addressBook/addressBook.jsx';
import SearchList from './components/searchList.jsx';
import { useAuth } from './hooks/useAuth';
import { useSocket } from './hooks/useSocket';
import { useGlobalMessage } from './hooks/useGlobalMessage';
import { useGlobalModal } from './hooks/useModalManager';
import { useMessageList } from './hooks/useMessageList';
import { useUserAvatar } from './hooks/useAvatar';
import i18n from '../i18n/index.js';
import { useTranslation } from 'react-i18next';
import titleImage from './assets/title.png';
import { debounce } from './utils/universalFunction.js'

const SearchBar = ({ onCreateGroup }) => {
  const { t } = useTranslation();

  const [searchTerm, setSearchTerm] = useState('');
  const [openSearchList, setOpenSearchList] = useState(false);
  const [searchMessage, setSearchMessage] = useState('');
  const latestSearchTerm = useRef('');
  const searchListRef = useRef(null);
  const searchFuction = () => {
    if (latestSearchTerm.current && latestSearchTerm.current.trim() !== '') {
      setOpenSearchList(true);
      setSearchMessage(latestSearchTerm.current);
    }
  };

  const dedouncedSearch = debounce(searchFuction, 1000);


  const handleSearch = (e) => {
    const currentValue = e.target.value;
    setSearchTerm(currentValue);
    latestSearchTerm.current = currentValue; // 同步到 ref

    if (!currentValue || currentValue.trim() === '') {
      setOpenSearchList(false);
      return;
    }

    dedouncedSearch();
  };

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (searchListRef.current && !searchListRef.current.contains(event.target)) {
        setOpenSearchList(false);
      }
    };

    if (searchListRef) {
      setTimeout(() => document.addEventListener('mousedown', handleClickOutside), 0);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [searchListRef]);

  const MenuItem = (
    <Menu className="custom-dropdown-menu">
      <Menu.Item key="1">
        <Button type="link" onClick={onCreateGroup}><CommentOutlined />{t('app.createGroup')}</Button>
      </Menu.Item>
      <Menu.Item key="2">
        <Button type="link" onClick={() => { window.electronAPI.openSearchWindow() }}><UsergroupAddOutlined />{t('app.addFriend')}</Button>
      </Menu.Item>
    </Menu>
  );

  return (
    <div className="search-bar-container" style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
      <div className='search-input-bar'>
        <SearchOutlined />
        <input
          style={{ color: 'var(--text-color)' }}
          className='search-input'
          type="search"
          placeholder={t('app.search')}
          onChange={handleSearch}
          value={searchTerm}
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
      {openSearchList && <SearchList ref={searchListRef} searchMessage={searchMessage} />}
    </div>
  );
};

// 右侧信息面板路由包装器
function MessageInfoPanel({ contacts, messageListHook }) {
  const { contactType, contactId } = useParams();
  const type = contactType === 'group' ? 'group' : 'friend';
  const contact = contacts.find(c => String(c.id) === contactId && c.type === type);
  if (!contact) return <div className="background-image-container" style={{ backgroundImage: `url(${titleImage})` }}></div>;
  return <MessageList contact={contact} messageListHook={messageListHook} />;
}

function ContactInfoPanel({ contacts, handleToSendMessage }) {
  const { contactType, contactId } = useParams();

  // 好友请求
  if (contactType === 'friendsRequest') {
    return <FriendsRequestManagement />;
  }

  // 联系人详情：用 contactType + contactId 精确查找，避免 id 冲突
  const contact = contacts.find(c => String(c.id) === contactId && c.type === (contactType === 'group' ? 'group' : 'friend'));
  if (contact) {
    return <ContactInformation contactInformation={contact} toSendMessage={handleToSendMessage} />;
  }

  return <div className="background-image-container" style={{ backgroundImage: `url(${titleImage})` }}></div>;
}

function App() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const [theme, setTheme] = useState('dark');
  const [connectionStatus, setConnectionStatus] = useState('connected');
  const [contacts, setContacts] = useState([]);
  const contactLruOrderRef = useRef([]);
  // 新增：联系人 Map，用于快速查找
  const contactMapRef = useRef(new Map());
  const { messageApi } = useGlobalMessage();
  const { setUserId } = useUserAvatar();
  const { currentUser, setCurrentUser } = useAuth();
  const socket = useSocket();

  const { isModalOpen, modalType, modalProps, openModal, closeModal } = useGlobalModal();

  // 从 URL 派生当前选中的联系人 ID 和类型
  // message/:contactType/:contactId  或  contact/:contactType/:contactId
  const { contactId, contactType } = useMemo(() => {
    const segments = location.pathname.split('/').filter(Boolean);
    if ((segments[0] === 'message' || segments[0] === 'contact') && segments.length >= 3) {
      return { contactId: segments[2], contactType: segments[1] };
    }
    return { contactId: null, contactType: null };
  }, [location.pathname]);

  const selectedContact = useMemo(() => {
    if (!contactId || !contactType || contacts.length === 0) return null;
    const type = contactType === 'group' ? 'group' : 'friend';
    return contacts.find(c => String(c.id) === contactId && c.type === type) || null;
  }, [contactId, contactType, contacts]);

  const messageListHook = useMessageList(selectedContact);
  const {
    handleChatHistoryDeleted,
    handleSendMessageStatus,
    handleNewMessage,
    MessageListSelectContact
  } = messageListHook;

  const toggleDarkMode = async () => {
    const curTheme = await window.electronAPI.getSettingsValue('theme');
    const newTheme = curTheme === 'dark' ? 'light' : 'dark';
    await window.electronAPI.updateTheme(newTheme);
  };


  useEffect(() => {
    if (currentUser) {
      window.electronAPI.resizeWindow(1100, 750);
    }
  }, [currentUser]);

  useEffect(() => {
    window.electronAPI.getSettingsValue('theme').then((savedTheme) => {
      setTheme(savedTheme);
    })
    if (theme === 'dark') {
      document.body.classList.add('dark-mode');
    } else {
      document.body.classList.remove('dark-mode');
    }
  }, [theme]);

  const getContactList = useCallback(async () => {
    const contactList = await window.electronAPI.getContactList();
    setContacts(contactList);
  }, [setContacts]);

  const handleLoginSuccess = useCallback((data) => {
    const { userId, username, refreshToken, token, email } = data;
    window.electronAPI.loginSuccess({ userId, username, token, email });
    window.electronAPI.saveCurrentUserCredentials({ userId, userName: username, token, refreshToken, email });
    window.electronAPI.saveUserListCredentials({ userId, userName: username, token, refreshToken, email });
    localStorage.setItem('token', token);
    localStorage.setItem('refreshToken', refreshToken);
    localStorage.setItem('currentUser', JSON.stringify({
      userId: userId,
      username: username,
      email: email
    }));
  }, []);

  const handleDbInitializedSuccess = useCallback((event, { userId, username, token, email }) => {
    setTimeout(() => {
      setUserId(userId);
      setCurrentUser({ userId, username, email, token });
      getContactList()
      window.electronAPI.startReviceMessage(userId)
    }, 1000)
  }, [setCurrentUser, setUserId, getContactList]);

  const handleLeaveGroupSuccess = useCallback((groupId) => {
    messageApi.success(t('app.leaveGroupSuccess'));
    setContacts(prevContacts => prevContacts.filter(contact => contact.type !== 'group' || contact.id !== groupId));
    // 从 LRU 缓存中移除
    const key = `${groupId}-group`;
    contactLruOrderRef.current = contactLruOrderRef.current.filter(k => k !== key);
    contactMapRef.current.delete(key);
    navigate('/message', { replace: true });
  }, [messageApi, navigate]);

  const handleConnect = useCallback(() => {
    setConnectionStatus('connected');
    if (currentUser) {
      socket.emit('login-with-token', currentUser.token);
    }
  }, [socket, currentUser]);

  const handleDisconnect = useCallback(() => setConnectionStatus('disconnected'), []);
  const handleReconnecting = useCallback(() => setConnectionStatus('reconnecting'), []);

  const handleMessageListSelectContact = useCallback(async (contact) => {
    const type = contact.type === 'group' ? 'group' : 'friend';
    navigate(`/message/${type}/${contact.id}`);
    await MessageListSelectContact(contact)
  }, [MessageListSelectContact, navigate]);

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

  const sortContactList = ({ contactId, isGroup }) => {
    // 优化 1: 使用 LRU 缓存记录访问顺序
    const lruOrder = contactLruOrderRef.current;
    const contactMap = contactMapRef.current;

    // 优化 2: 构造查找键
    const lookupKey = `${contactId}-${isGroup ? 'group' : 'friend'}`;

    // 优化 3: 从 LRU 中移除该联系人（如果已存在）
    const existingIndex = lruOrder.indexOf(lookupKey);
    if (existingIndex > -1) {
      lruOrder.splice(existingIndex, 1);
    }

    // 优化 4: 将联系人添加到 LRU 顶部
    lruOrder.unshift(lookupKey);

    // 优化 5: 更新 contacts 状态，根据 LRU 顺序重新排列
    setContacts(prev => {
      // 更新 Map
      const newMap = new Map();
      prev.forEach(c => {
        const key = `${c.id}-${c.type === 'group' ? 'group' : 'friend'}`;
        newMap.set(key, c);
        contactMap.set(key, c);
      });

      // 根据 LRU 顺序重新排列
      const sortedContacts = lruOrder
        .map(key => contactMap.get(key))
        .filter(Boolean);

      // 添加不在 LRU 中的联系人（新联系人）
      prev.forEach(c => {
        const key = `${c.id}-${c.type === 'group' ? 'group' : 'friend'}`;
        if (!lruOrder.includes(key)) {
          sortedContacts.push(c);
        }
      });

      return sortedContacts;
    });

    // 更新 ref
    contactLruOrderRef.current = lruOrder;
  };

  const receivedNewMessge = useCallback((event, { contactId, isGroup, renderNewMessage }) => {
    handleNewMessage(renderNewMessage)
    sortContactList({ contactId, isGroup })
  }, [handleNewMessage])

  const handleLanguageUpdated = useCallback((event, language) => {
    i18n.changeLanguage(language);
  }, []);

  const handleThemeUpdated = useCallback((event, theme) => {
    setTheme(theme);
  }, []);

  const handleReceivedMessageComple = useCallback(() => {
    setConnectionStatus('');
  }, [])

  const handleStartReviceMessage = useCallback(() => {
    setConnectionStatus('start-revice-message');
  }, [])

  useEffect(() => {
    window.electronAPI.ipcRenderer.on('contact-deleted', handleDeleteContact);
    window.electronAPI.ipcRenderer.on('message-history-deleted', handleChatHistoryDeleted);
    window.electronAPI.ipcRenderer.on('sent-new-message', sortContactList);
    window.electronAPI.ipcRenderer.on('received-new-chat-message', receivedNewMessge);
    window.electronAPI.ipcRenderer.on('contacts-list-updated', getContactList);
    window.electronAPI.ipcRenderer.on('db-initialized-success', handleDbInitializedSuccess);
    window.electronAPI.ipcRenderer.on('language-updated', handleLanguageUpdated);
    window.electronAPI.ipcRenderer.on('theme-updated', handleThemeUpdated);
    window.electronAPI.ipcRenderer.on('disconnect-message-send-comple', handleReceivedMessageComple);
    window.electronAPI.ipcRenderer.on('start-revice-message', handleStartReviceMessage);
    window.electronAPI.ipcRenderer.on('group-info-update', handleGroupNameUpdate);

    return () => {
      window.electronAPI.ipcRenderer.removeListener('contact-deleted', handleDeleteContact);
      window.electronAPI.ipcRenderer.removeListener('message-history-deleted', handleChatHistoryDeleted);
      window.electronAPI.ipcRenderer.removeListener('sent-new-message', sortContactList);
      window.electronAPI.ipcRenderer.removeListener('received-new-chat-message', receivedNewMessge);
      window.electronAPI.ipcRenderer.removeListener('contacts-list-updated', getContactList);
      window.electronAPI.ipcRenderer.removeListener('db-initialized-success', handleDbInitializedSuccess);
      window.electronAPI.ipcRenderer.removeListener('language-updated', handleLanguageUpdated);
      window.electronAPI.ipcRenderer.removeListener('theme-updated', handleThemeUpdated);
      window.electronAPI.ipcRenderer.removeListener('disconnect-message-send-comple', handleReceivedMessageComple);
      window.electronAPI.ipcRenderer.removeListener('start-revice-message', handleStartReviceMessage);
      window.electronAPI.ipcRenderer.removeListener('group-info-update', handleGroupNameUpdate);
    }
  }, [])

  const handleCallRequest = useCallback(async ({ callerUserId, callerId, roomId, offer, callMode }) => {
    await window.electronAPI.receivedCallRequest({ callerUserId, callerId, roomId, offer, callMode })
  }, [])

  useEffect(() => {
    if (!socket) return;
    socket.on('login-success', handleLoginSuccess);
    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);
    socket.on('reconnecting', handleReconnecting);
    socket.on('message-sent-success', handleSendMessageStatus)
    socket.on('leave-group-success', handleLeaveGroupSuccess);
    socket.on('notification', handleNotificationMessage);
    socket.on('strong-logout-warning', handleStrongLogoutWarning);
    socket.on('call-request', handleCallRequest)

    return () => {
      socket.off('login-success', handleLoginSuccess);
      socket.off('connect', handleConnect);
      socket.off('disconnect', handleDisconnect);
      socket.off('reconnecting', handleReconnecting);
      socket.off('message-sent-success', handleSendMessageStatus)
      socket.off('leave-group-success', handleLeaveGroupSuccess)
      socket.off('notification', handleNotificationMessage);
      socket.off('strong-logout-warning', handleStrongLogoutWarning);
      socket.off('call-request', handleCallRequest)
    };
  }, [socket]);


  const handleAddressBookSelectContact = useCallback((contactId, contactType) => {
    navigate(`/contact/${contactType}/${contactId}`);
  }, [navigate]);


  const handleToSendMessage = useCallback((contact) => {
    const type = contact.type === 'group' ? 'group' : 'friend';
    navigate(`/message/${type}/${contact.id}`);
  }, [navigate])



  const handleDeleteContact = useCallback((event, { contactId }) => {
    navigate('/contact', { replace: true });
    setContacts(prevContacts => {
      const newContacts = prevContacts.filter(contact => { return (contact.id !== contactId || contact.type !== 'friend') });
      return newContacts;
    });
    // 从 LRU 缓存中移除
    const key = `${contactId}-friend`;
    contactLruOrderRef.current = contactLruOrderRef.current.filter(k => k !== key);
    contactMapRef.current.delete(key);
    messageApi.success(t('app.deleteFriendSuccess'));
  }, [setContacts, messageApi, navigate]);

  const handleGroupNameUpdate = useCallback((event, { groupId, newGroupName }) => {
    console.log('handleGroupNameUpdate', groupId, newGroupName);
    setContacts(prevContacts => {
      prevContacts.forEach(contact => {
        if (contact.id === groupId && contact.type === 'group') {
          contact.username = newGroupName;
        }
      });
      return prevContacts;
    });
  }, []);


  const handleCreateGroup = () => {
    openModal('createGroup')
  }



  const renderConnectionStatus = () => {
    if (connectionStatus === 'disconnected') {
      return <Alert message={t('app.disconnected')} type="error" showIcon />;
    }
    if (connectionStatus === 'reconnecting') {
      return <Alert message={t('app.reconnecting')} type="warning" showIcon />;
    }
    if (connectionStatus === 'start-revice-message') {
      return <Alert message={t('app.startReviceMessage')} type="info" showIcon />;
    }
    return null;
  };

  // 中间面板：根据路由渲染联系人列表或通讯录
  const renderFeature = () => {
    const isMessageRoute = location.pathname.startsWith('/message');
    if (isMessageRoute) {
      return <ContactList
        selectedContact={selectedContact}
        contacts={contacts}
        onSelectContact={handleMessageListSelectContact}
      />;
    }
    return <AddressBook
      selectedContact={contactId}
      contacts={contacts}
      onSelectContact={handleAddressBookSelectContact}
    />;
  };

  if (!currentUser) {
    return (
      <div>
        <AppHeaderBar />
        <AuthPage />
      </div>
    );
  }

  return (
    <ConfigProvider locale={zhCN}>
      <div className="app-wrapper">
        <div id="app">
          <CustomModal isModalOpen={isModalOpen} modalType={modalType} modalProps={modalProps} closeModal={closeModal} />
          <div className='app-features-bar'>
            <ToolBar
              theme={theme}
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
              <Routes>
                <Route path="/message/:contactType/:contactId" element={
                  <MessageInfoPanel contacts={contacts} messageListHook={messageListHook} />
                } />
                <Route path="/contact/:contactType/:contactId" element={
                  <ContactInfoPanel contacts={contacts} handleToSendMessage={handleToSendMessage} />
                } />
                <Route path="*" element={
                  <div className="background-image-container" style={{ backgroundImage: `url(${titleImage})` }}></div>
                } />
              </Routes>
            </div>
          </div>
        </div>
      </div>
    </ConfigProvider>
  );
}

export default App;
