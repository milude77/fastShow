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
import CustomModal from './components/custoModal/customModal.jsx';
import ToolBar from './components/toolBar/toolBar.jsx';
import AuthPage from './AuthPage';
import AddressBook from './components/addressBook/addressBook.jsx';
import { useAuth } from './hooks/useAuth';
import { useSocket } from './hooks/useSocket';
import { useGlobalMessage } from './hooks/useGlobalMessage';
import { useGlobalModal } from './hooks/useModalManager';
import { useMessageList } from './hooks/useMessageList';
import { useUserAvatar } from './hooks/useAvatar';
import i18n from '../i18n/index.js';
import { useTranslation } from 'react-i18next';
import titleImage from './assets/title.png';

const SearchBar = ({ currentUser, onCreateGroup }) => {
  const { t } = useTranslation();

  const [searchTerm, setSearchTerm] = useState('');

  const handleKeyDown = (event) => {
    if (event.key === 'Enter' && searchTerm.trim()) {
      window.electronAPI.openSearchWindow(currentUser.id, searchTerm);
    }
  };

  const MenuItem = (
    <Menu>
      <Menu.Item className='menu-item' key="1">
        <Button type="link" onClick={onCreateGroup}><CommentOutlined />{t('app.createGroup')}</Button>
      </Menu.Item>
      <Menu.Item className='menu-item' key="2">
        <Button type="link" onClick={() => { window.electronAPI.openSearchWindow(currentUser.id, searchTerm) }}><UsergroupAddOutlined />{t('app.addFriend')}</Button>
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
          placeholder={t('app.search')}
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
  const { t } = useTranslation();
  const [theme, setTheme] = useState('dark');
  const [selectFeatures, setSelectFeatures] = useState('message');
  const [selectedContact, setSelectedContact] = useState(null);
  const selectedContactRef = useRef(selectedContact);
  const [selectedContactInformation, setSelectedContactInformation] = useState(null);
  const [connectionStatus, setConnectionStatus] = useState('connected');
  const [contacts, setContacts] = useState([]);
  // 新增：LRU 缓存，存储联系人 ID 的访问顺序
  const contactLruOrderRef = useRef([]);
  // 新增：联系人 Map，用于快速查找
  const contactMapRef = useRef(new Map());
  const { messageApi } = useGlobalMessage();
  const { setUserId } = useUserAvatar();
  const { currentUser, setCurrentUser } = useAuth();
  const socket = useSocket();

  const { isModalOpen, modalType, modalProps, openModal, closeModal } = useGlobalModal();
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
    window.electronAPI.saveCurrentUserCredentials({ userId, userName: username, token, refreshToken });
    window.electronAPI.saveUserListCredentials({ userId, userName: username, token, refreshToken });
    localStorage.setItem('token', token);
    localStorage.setItem('refreshToken', refreshToken);
    localStorage.setItem('currentUser', JSON.stringify({
      userId: userId,
      username: username
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
    setSelectedContact(null)
  }, [messageApi]);

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

  const sortContactList = useCallback((event, { contactId, isGroup }) => {
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
  }, []);

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
    window.electronAPI.ipcRenderer.on('received-new-chat-message', sortContactList);
    window.electronAPI.ipcRenderer.on('contacts-list-updated', getContactList);
    window.electronAPI.ipcRenderer.on('db-initialized-success', handleDbInitializedSuccess);
    window.electronAPI.ipcRenderer.on('language-updated', handleLanguageUpdated);
    window.electronAPI.ipcRenderer.on('theme-updated', handleThemeUpdated);
    window.electronAPI.ipcRenderer.on('disconnect-message-send-comple', handleReceivedMessageComple);
    window.electronAPI.ipcRenderer.on('start-revice-message', handleStartReviceMessage);

    return () => {
      window.electronAPI.ipcRenderer.removeListener('contact-deleted', handleDeleteContact);
      window.electronAPI.ipcRenderer.removeListener('message-history-deleted', handleChatHistoryDeleted);
      window.electronAPI.ipcRenderer.removeListener('sent-new-message', sortContactList);
      window.electronAPI.ipcRenderer.removeListener('received-new-chat-message', sortContactList);
      window.electronAPI.ipcRenderer.removeListener('contacts-list-updated', getContactList);
      window.electronAPI.ipcRenderer.removeListener('db-initialized-success', handleDbInitializedSuccess);
      window.electronAPI.ipcRenderer.removeListener('language-updated', handleLanguageUpdated);
      window.electronAPI.ipcRenderer.removeListener('theme-updated', handleThemeUpdated);
      window.electronAPI.ipcRenderer.removeListener('disconnect-message-send-comple', handleReceivedMessageComple);
      window.electronAPI.ipcRenderer.removeListener('start-revice-message', handleStartReviceMessage);
    }
  }, [])

  const handleCallRequest = useCallback(async ({ callerUserId, callerId, roomId, offer, callMode }) => {
    await window.electronAPI.receivedCallRequest({ callerUserId, callerId, roomId, offer, callMode })
  }, [])

  useEffect(() => {
    if (!socket) return;
    socket.on('login-success', handleLoginSuccess);
    socket.on('new-message', handleNewMessage);
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
      socket.off('new-message', handleNewMessage);
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


  const handleAddressBookSelectContact = useCallback((contact) => {
    setSelectedContactInformation(contact);
  }, []);


  const handleToSendMessage = useCallback((contact) => {
    setSelectedContact(contact)
    setSelectFeatures('message')
    setSelectedContactInformation(null)
  }, [])



  const handleDeleteContact = useCallback((event, { contactId }) => {
    setSelectedContactInformation(null)
    setSelectedContact(null)
    setContacts(prevContacts => {
      const newContacts = prevContacts.filter(contact => { return (contact.id !== contactId || contact.type !== 'friend') });
      return newContacts;
    });
    // 从 LRU 缓存中移除
    const key = `${contactId}-friend`;
    contactLruOrderRef.current = contactLruOrderRef.current.filter(k => k !== key);
    contactMapRef.current.delete(key);
    messageApi.success(t('app.deleteFriendSuccess'));
  }, [setSelectedContactInformation, setSelectedContact, setContacts, messageApi]);

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

  const renderInformationFunctionBar = () => {
    if (selectFeatures === 'message' && selectedContact) {
      return (
        <MessageList
          contact={selectedContact}
          messageListHook={messageListHook}
        />
      );
    }
    if (selectFeatures === 'contact' && selectedContactInformation) {
      if (selectedContactInformation !== 'friendsRequest') {
        return (
          <ContactInformation
            contactInformation={selectedContactInformation}
            toSendMessage={handleToSendMessage}
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
              selectFeatures={selectFeatures}
              setSelectFeatures={setSelectFeatures}
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
              {renderInformationFunctionBar()}
            </div>
          </div>
        </div>
      </div>
    </ConfigProvider>
  );
}

export default App;
