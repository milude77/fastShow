import { useState, useEffect, useRef, useCallback } from 'react';
import { Alert, Button, ConfigProvider, Dropdown, Menu, message } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import { SearchOutlined, PlusOutlined, UsergroupAddOutlined, CommentOutlined } from '@ant-design/icons';
import './css/App.css';
import './css/dark-mode.css';
import AppHeaderBar from './components/appHeaderBar';
import ContactList from './components/contactList';
import MessageList from './components/messageList';
import ContactInformation from './components/contactInformation';
import FriendsRequestManagement from './components/friendsRequesetManagement';
import ToolBar from './components/toolBar';
import AuthPage from './AuthPage';
import AddressBook from './components/addressBook';
import { useAuth } from './hooks/useAuth';
import { useSocket } from './hooks/useSocket';
import titleImage from './assets/title.png';
import CustomModal from './components/CustomModal';
import CreateGoupsApp from './CreateGoupsApp'; 

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
  const [selectedContactInformation, setSelectedContactInformation] = useState(null);
  const [connectionStatus, setConnectionStatus] = useState('connected');
  const [messages, setMessages] = useState({});
  const [groupMessages, setGroupMessages] = useState({});
  const [drafts, setDrafts] = useState({});
  const [groupDrafts, setGroupDrafts] = useState({});
  const [messagePages, setMessagePages] = useState({});
  const [groupsMessagePages, setGroupsMessagePages] = useState({});
  const [contacts, setContacts] = useState([]);

  const { currentUser, setCurrentUser } = useAuth();
  const socket = useSocket();
  const pendingTimersRef = useRef(new Map());
  const pendingGroupTimersRef = useRef(new Map());
  const [messageApi, contextHolder] = message.useMessage();
  const [isCreateGroupModalOpen, setIsCreateGroupModalOpen] = useState(false);

  const handleAvatarUpdate = useCallback(() => {
    setCurrentUser(prevUser => ({
      ...prevUser,
      avatarVersion: Date.now()
    }));
  }, [setCurrentUser]);

  const toggleDarkMode = () => {
    setDarkMode(!darkMode);
  };

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

  const handleLoginSuccess = useCallback((user) => {
    window.electronAPI.loginSuccess(user.userId);
    window.electronAPI.saveCurrentUserCredentials({ userId: user.userId, userName: user.username, token: user.token ?? user.newToken });
    window.electronAPI.saveUserListCredentials({ userId: user.userId, userName: user.username, token: user.token ?? user.newToken });
    localStorage.setItem('token', user.token ?? user.newToken);
    setCurrentUser(user);
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


  // 获取好友列表并发送离线消息
  useEffect(() => {
    if (currentUser && socket) {
      socket.emit('send-disconnect-message', currentUser);
    }
  }, [currentUser, socket]);

  const handleNewMessage = useCallback((msg) => {
    // Safety check: Do not process messages if the user is not logged in.
    if (!currentUser) {
      return;
    }

    const contactId = msg.type == 'group' ? msg.receiverId : msg.senderId;
    const messageId = `temp_${Date.now()}`

    // const savedMessage = {
    //   id: sendMessageId,
    //   username: senderInfo.username,
    //   content: newMessage.content,
    //   timestamp: sendTimestamp,
    //   senderId: newMessage.sender_id,
    //   receiverId: newMessage.group_id,
    //   type: 'group'
    // };


    // When receiving a message from others, save it to local history.
    if (msg.senderId !== currentUser.userId) {
      const newMessage = {
        id: messageId,
        text: msg.content,
        sender: 'other',
        sender_id: msg.senderId,
        timestamp: new Date(msg.timestamp).toISOString(),
        username: msg.username,
        fileName: msg.fileName,
        messageType: msg.messageType,
        type: msg.type,
        fileUrl: msg.fileUrl,
        fileSize: msg.fileSize,
      }

      if (window.electronAPI) {
        try { window.electronAPI.chatMessage(contactId, currentUser.userId, newMessage); }
        catch (e) { console.error("保存消息失败:", e) };
      }
    }

    if (msg.type == 'private') {
      setMessages(prev => {
        const contactMessages = prev[contactId] || [];

        return {
          ...prev,
          [contactId]: [...contactMessages, {
            id: messageId,
            text: msg.content,
            sender: 'other',
            timestamp: msg.timestamp,
            username: msg.username,
            messageType: msg.messageType,
            fileName: msg.fileName,
            fileUrl: msg.fileUrl,
            fileSize: msg.fileSize,
          }]
        };
      })
    }
    else {
      setGroupMessages(prev => {
        const contactMessages = prev[msg.receiverId] || [];

        return {
          ...prev,
          [msg.receiverId]: [...contactMessages, {
            id: messageId,
            text: msg.content,
            sender: 'other',
            timestamp: msg.timestamp,
            username: msg.username,
            messageType: msg.messageType,
            fileName: msg.fileName,
            fileUrl: msg.fileUrl,
            fileSize: msg.fileSize,
          }]
        };
      });
    };
  }, [currentUser, setMessages, setGroupMessages]);

  const handleSendMessageStatus = useCallback(({ senderInfo, sendMessageId, receiverId, status, isGroup }) => {
    // 收到服务端成功回执，清除超时计时器
    let timer;
    if (isGroup) {
      timer = pendingGroupTimersRef.current.get(sendMessageId);
    } else {
      timer = pendingTimersRef.current.get(sendMessageId);
    }

    if (timer) {
      clearTimeout(timer);
      if (isGroup) {
        pendingGroupTimersRef.current.delete(sendMessageId);
      } else {
        pendingTimersRef.current.delete(sendMessageId);
      }
    }

    if (sendMessageId && receiverId && status == 'success') {
      if (!isGroup) {
        setMessages(prev => {
          const contactMessages = prev[receiverId] || [];
          return {
            ...prev,
            [receiverId]: contactMessages.map(msg =>
              msg.id === sendMessageId ? { ...msg, status } : msg
            )
          };
        });
      }
      else {
        setGroupMessages(prev => {
          const contactMessages = prev[receiverId] || [];
          return {
            ...prev,
            [receiverId]: contactMessages.map(msg =>
              msg.id === sendMessageId ? { ...msg, status } : msg
            )
          };
        });
      }
      window.electronAPI.sendMessageStatusChange(senderInfo, sendMessageId, receiverId, status, isGroup);
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
    };
  }, [socket, handleLoginSuccess, handleFriendsList, friendsRequestAccepted, handleConnect, handleDisconnect, handleReconnecting, handleNewGroup, handleNewMessage, handleSendMessageStatus]);


  const handleMessageListSelectContact = useCallback(async (contact) => {
    setSelectedContact(contact);
    setMessagePages({ [contact.id]: 1 });
    if (window.electronAPI && currentUser) {
      if (contact.type == 'group') {
        const localGroupHistory = await window.electronAPI.getChatHistory(contact.id, currentUser.userId, 1, 20, true);
        setGroupMessages(prev => ({ ...prev, [contact.id]: localGroupHistory }));
      }
      else {
        const localHistory = await window.electronAPI.getChatHistory(contact.id, currentUser.userId, 1, 20, false);
        setMessages(prev => ({ ...prev, [contact.id]: localHistory }));
      }
    }
  }, [currentUser]);

  const handleAddressBookSelectContact = useCallback((contact) => {
    setSelectedContactInformation(contact);
  }, []);

  //发送私聊消息
  const handleSendMessage = useCallback((message) => {
    if (selectedContact && currentUser && socket) {
      const tempId = `temp_${Date.now()}`;
      const newMessage = {
        id: tempId,
        text: message,
        sender: 'user',
        messageType: 'text',
        timestamp: new Date().toISOString(),
        username: currentUser.username,
        sender_id: currentUser.userId,
        status: 'sending',
        type: 'private'
      };

      setMessages(prev => ({
        ...prev,
        [selectedContact.id]: [...(prev[selectedContact.id] || []), newMessage]
      }));

      if (window.electronAPI) {
        window.electronAPI.chatMessage(selectedContact.id, currentUser.userId, newMessage);
      }

      socket.emit('send-private-message', { message: newMessage, receiverId: selectedContact.id });

      // 启动 10 秒超时计时器，若未收到成功回执则标记为失败
      const timer = setTimeout(() => {
        setMessages(prev => {
          const contactMessages = prev[selectedContact.id] || [];
          return {
            ...prev,
            [selectedContact.id]: contactMessages.map(msg =>
              msg.id === tempId ? { ...msg, status: 'fail' } : msg
            )
          };
        });
        pendingTimersRef.current.delete(tempId);
      }, 10000);
      pendingTimersRef.current.set(tempId, timer);

      setDrafts(prev => ({ ...prev, [selectedContact.id]: '' }));
    }
  }, [selectedContact, currentUser, socket]);

  const handleSendgroupMessage = useCallback((message) => {
    if (selectedContact && currentUser && socket) {
      const tempId = `temp_${Date.now()}`;
      const newMessage = {
        id: tempId,
        text: message,
        sender: 'user',
        messageType: 'text',
        timestamp: new Date().toISOString(),
        senderId: currentUser.userId,
        username: currentUser.username,
        status: 'sending',
        type: 'group'
      };

      setGroupMessages(prev => ({
        ...prev,
        [selectedContact.id]: [...(prev[selectedContact.id] || []), newMessage]
      }));

      if (window.electronAPI) {
        window.electronAPI.chatMessage(selectedContact.id, currentUser.userId, newMessage);
      }

      socket.emit('send-group-message', { message: newMessage, groupId: selectedContact.id });

      // 启动 10 秒超时计时器，若未收到成功回执则标记为失败
      const timer = setTimeout(() => {
        setGroupMessages(prev => {
          const contactMessages = prev[selectedContact.id] || [];
          return {
            ...prev,
            [selectedContact.id]: contactMessages.map(msg =>
              msg.id === tempId ? { ...msg, status: 'fail' } : msg
            )
          };
        });
        pendingGroupTimersRef.current.delete(tempId);
      }, 10000);
      pendingGroupTimersRef.current.set(tempId, timer);

      setGroupDrafts(prev => ({ ...prev, [selectedContact.id]: '' }));
    }
  }, [selectedContact, currentUser, socket]);

  const handleResendMessage = useCallback((contactID, msg, contactType) => {
    if (contactType == "friend") {
      const oldMessage = messages[contactID] || [];
      setMessages(prev => ({
        ...prev,
        [contactID]: oldMessage.filter(message => message.id !== msg.id)
      }));
      handleSendMessage(msg.text);
    }
    else {
      const oldMessage = groupMessages[contactID] || [];
      setGroupMessages(prev => ({
        ...prev,
        [contactID]: oldMessage.filter(message => message.id !== msg.id)
      }));
      handleSendgroupMessage(msg.text);
    }
  }, [messages, groupMessages])


  const handleDraftChange = useCallback((contactId, contactType, text) => {
    if (contactType == "friend") {
      setDrafts(prev => ({ ...prev, [contactId]: text }));
    }
    else {
      setGroupDrafts(prev => ({ ...prev, [contactId]: text }));
    }
  }, []);

  const loadMoreMessages = useCallback(async (contactId) => {
    const currentPage = messagePages[contactId] || 1;
    const nextPage = currentPage + 1;

    if (window.electronAPI && currentUser) {
      const olderMessages = await window.electronAPI.getChatHistory(contactId, currentUser.userId, nextPage, 20);
      if (olderMessages.length > 0) {
        setMessages(prev => ({
          ...prev,
          [contactId]: [...olderMessages, ...prev[contactId]]
        }));
        setMessagePages(prev => ({ ...prev, [contactId]: nextPage }));
      }
    }
  }, [currentUser, messagePages]);

  const handleUploadFile = useCallback(async ({ filePath }) => {
    if (!currentUser || !selectedContact) return;

    const fileName = filePath.split(/[\\/]/).pop();
    const tempId = `temp_file_${Date.now()}`;

    // 1. 在UI中立即显示一个“正在上传”的临时消息
    const tempMessage = {
      id: tempId,
      text: '',
      sender: 'user',
      sender_id: currentUser.userId,
      timestamp: new Date().toISOString(),
      username: currentUser.username,
      messageType: 'file',
      fileName: fileName,
      fileUrl: null,
      fileSize: '上传中...',
      localPath: filePath,
      fileExt: true,
      status: 'sending'
    };

    setMessages(prev => ({
      ...prev,
      [selectedContact.id]: [...(prev[selectedContact.id] || []), tempMessage]
    }));

    try {
      // 2. 调用主进程的上传函数
      const result = await window.electronAPI.initiateFileUpload(
        filePath,
        currentUser.userId,
        selectedContact.id
      );

      if (result.success) {
        // 3. 上传成功后，用服务器返回的真实消息替换掉临时消息
        const finalMessage = {
          ...result.messageData,
          sender_id: currentUser.userId,
          sender: 'user', // 确保UI正确显示
          localPath: filePath,
          fileExt: true,
          status: 'success'
        };

        setMessages(prev => {
          const contactMessages = prev[selectedContact.id] || [];
          return {
            ...prev,
            [selectedContact.id]: contactMessages.map(msg =>
              msg.id === tempId ? finalMessage : msg
            )
          };
        });

        // 4. 将最终消息保存到本地数据库
        if (window.electronAPI) {
          window.electronAPI.chatMessage(selectedContact.id, currentUser.userId, finalMessage);
        }

      } else {
        throw new Error(result.error);
      }
    } catch (error) {
      console.error('文件上传失败:', error);
      // 5. 上传失败，更新临时消息的状态为 'fail'
      setMessages(prev => {
        const contactMessages = prev[selectedContact.id] || [];
        return {
          ...prev,
          [selectedContact.id]: contactMessages.map(msg =>
            msg.id === tempId ? { ...msg, status: 'fail', fileSize: '上传失败' } : msg
          )
        };
      });
    }
  }, [currentUser, selectedContact]);

  const handleToSendMessage = useCallback((contact) => {
    setSelectedContact(contact)
    setSelectFeatures('message')
    setSelectedContactInformation(null)
  }, [])



  const handleDeleteContact = useCallback((contactId) => {
    socket.emit('delete-contact', contactId);
    setSelectedContactInformation(null)
    setContacts(prevContacts => {
      const newContacts = { ...prevContacts };
      delete newContacts[contactId];
      return newContacts;
    });
  }, [socket]);

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
          currentUser={currentUser}
          messages={selectedContact.type == 'friend' ? messages[selectedContact.id] : groupMessages[selectedContact.id]}
          draft={(selectedContact.type == 'friend' ? drafts[selectedContact.id] : groupDrafts[selectedContact.id]) || ''}
          onDraftChange={handleDraftChange}
          onSendMessage={handleSendMessage}
          onSendGroupMessage={handleSendgroupMessage}
          onLoadMore={() => loadMoreMessages(selectedContact.id)}
          onUploadFile={handleUploadFile}
          onResendMessage={handleResendMessage}
          deleteContact={handleDeleteContact}
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
          {contextHolder}
          <div className='app-features-bar'>
            <ToolBar
              currentUser={currentUser}
              onAvatarUpdate={handleAvatarUpdate}
              selectFeatures={selectFeatures}
              setSelectFeatures={setSelectFeatures}
              isDarkMode={darkMode}
              toggleDarkMode={toggleDarkMode}
            />
          </div>
          <div className='contact-list-container'>
            {renderConnectionStatus()}
            <SearchBar currentUser={currentUser} onCreateGroup={() => setIsCreateGroupModalOpen(true)} />
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

          {/* 创建群聊模态框 */}
          <CustomModal isOpen={isCreateGroupModalOpen} onClose={() => setIsCreateGroupModalOpen(false)}>
            <CreateGoupsApp />
          </CustomModal>
        </div>
      </div>
    </ConfigProvider>
  );
}

export default App;
