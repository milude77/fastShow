import { useState, useEffect } from 'react';
import { Alert, Button } from 'antd';
import './css/App.css';
import './css/dark-mode.css';
import AppHeaderBar from './components/appHeaderBar';
import ContactList from './components/contactList';
import MessageList from './components/messageList';
import ContactInformation from './components/contactInformation';
import ToolBar from './components/toolBar';
import AuthPage from './AuthPage';
import AddressBook from './components/addressBook';
import { useAuth } from './hooks/useAuth';
import { useSocket } from './hooks/useSocket';
import titleImage from './assets/title.png';

function App() {
  const [darkMode, setDarkMode] = useState(false);
  const [selectFeatures, setSelectFeatures] = useState('message');
  const [selectedContact, setSelectedContact] = useState(null);
  const [selectedContactInformation, setSelectedContactInformation] = useState(null);
  const [connectionStatus, setConnectionStatus] = useState('connected');
  const [messages, setMessages] = useState({});
  const [drafts, setDrafts] = useState({});
  const [messagePages, setMessagePages] = useState({});
  const [contacts, setContacts] = useState({});

  const { currentUser, setCurrentUser } = useAuth();
  const socket = useSocket();

  const toggleDarkMode = () => {
    setDarkMode(!darkMode);
  };

  useEffect(() => {
    if (darkMode) {
      document.body.classList.add('dark-mode');
    } else {
      document.body.classList.remove('dark-mode');
    }
  }, [darkMode]);
  useEffect(() => {
    if (!socket) return;

    const handleLoginSuccess = (user) => {
      window.electronAPI.saveCurrentUserCredentials({ userId: user.userId, userName: user.username, token: user.token ?? user.newToken });
      window.electronAPI.saveUserListCredentials({ userId: user.userId, userName: user.username, token: user.token ?? user.newToken });
      window.electronAPI.loginSuccess(user.userId)
      setCurrentUser(user);
    };

    const handleFriendsList = (friends) => {
      setContacts(friends);
    };

    const friendsRequestAccepted = () => {
      socket.emit('get-friends');
    };

    const handleConnect = () => {
      setConnectionStatus('connected');
      // Re-authenticate and fetch data on successful reconnection
      if (currentUser) {
        socket.emit('login-with-token', currentUser.token);
        socket.emit('get-friends');
      }
    };
    const handleDisconnect = () => setConnectionStatus('disconnected');
    const handleReconnecting = () => setConnectionStatus('reconnecting');

    socket.on('login-success', handleLoginSuccess);
    socket.on('new-message', handleNewMessage);
    socket.on('friends-list', handleFriendsList);
    socket.on('friend-request-accepted', friendsRequestAccepted);

    // Add the status listeners using the socket context
    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);
    socket.on('reconnecting', handleReconnecting);

    return () => {
      socket.off('login-success', handleLoginSuccess);
      socket.off('user-registered', handleLoginSuccess);
      socket.off('friends-list', handleFriendsList);
      socket.off('new-message', handleNewMessage);
      socket.off('friend-request-accepted', friendsRequestAccepted);

      // Clean up the status listeners
      socket.off('connect', handleConnect);
      socket.off('disconnect', handleDisconnect);
      socket.off('reconnecting', handleReconnecting);
    };
  }, [socket, currentUser]);

  // 获取好友列表并发送离线消息
  useEffect(() => {
    if (currentUser && socket) {
      socket.emit('get-friends');
      socket.emit('send-disconnect-message', currentUser);
    }
  }, [currentUser, socket]);

  const handleNewMessage = (msg) => {
    // Safety check: Do not process messages if the user is not logged in.
    if (!currentUser) {
      return;
    }

    const contactId = msg.senderId;


    // When receiving a message from others, save it to local history.
    if (msg.senderId !== currentUser.userId) {
      const newMessage = {
        id: msg.id,
        text: msg.content,
        sender: 'other',
        timestamp: new Date(msg.timestamp).toISOString(),
        username: msg.username,
        fileName: msg.fileName,
        messageType: msg.messageType,
        fileUrl: msg.fileUrl,
        fileSize: msg.fileSize,
      }
      if (window.electronAPI) {
        window.electronAPI.chatMessage(contactId, currentUser.userId, newMessage);
      }
    }

    setMessages(prev => {
      const contactMessages = prev[contactId] || [];

      return {
        ...prev,
        [contactId]: [...contactMessages, {
          id: msg.id,
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
  const handleMessageListSelectContact = async (contact) => {
    setSelectedContact(contact);
    setMessagePages({ [contact.id]: 1 });
    if (window.electronAPI && currentUser) {
      const localHistory = await window.electronAPI.getChatHistory(contact.id, currentUser.userId, 1, 20);
      setMessages(prev => ({ ...prev, [contact.id]: localHistory }));
    }
  };

  const handleAddressBookSelectContact = (contact) => {
    setSelectedContactInformation(contact);
  };

  const handleSendMessage = (message) => {
    if (selectedContact && currentUser && socket) {
      const tempId = `temp_${Date.now()}`;
      const newMessage = {
        id: tempId, 
        text: message,
        sender: 'user',
        messageType: 'text',
        timestamp: new Date().toISOString(),
        username: currentUser.username
      };

      setMessages(prev => ({
        ...prev,
        [selectedContact.id]: [...(prev[selectedContact.id] || []), newMessage]
      }));

      if (window.electronAPI) {
        window.electronAPI.chatMessage(selectedContact.id, currentUser.userId, newMessage);
      }

      socket.emit('send-private-message', { message, receiverId: selectedContact.id });

      setDrafts(prev => ({ ...prev, [selectedContact.id]: '' }));
    }
  };

  const handleDraftChange = (contactId, text) => {
    console.log(drafts)
    setDrafts(prev => ({ ...prev, [contactId]: text }));
  };

  const loadMoreMessages = async (contactId) => {
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
  };

  const handleUploadFile = async ({ fileName, fileContent }) => {
    if (currentUser && selectedContact) {
      try {
        const result = await window.electronAPI.uploadFile(
          selectedContact.id,
          currentUser.userId,
          fileName,
          fileContent,
        );

        if (!result.success) {
          throw new Error('文件上传失败');
        }

        const newMessage = {
          id: `file_${Date.now()}`,
          text: '',
          sender: 'user',
          timestamp: new Date().toISOString(),
          username: currentUser.username,
          messageType: 'file',
          fileName: fileName,
          fileUrl: result.filePath,
          fileSize: fileContent.length
        };

        setMessages(prev => ({
          ...prev,
          [selectedContact.id]: [...(prev[selectedContact.id] || []), newMessage]
        }));

        // 保存到本地历史
        if (window.electronAPI) {
          window.electronAPI.chatMessage(selectedContact.id, currentUser.userId, newMessage);
        }
      } catch (error) {
        console.error('文件上传失败:', error);
      }
    }
  };

  // 监听文件上传成功事件
  useEffect(() => {
    if (!socket) return;

    const handleFileUploaded = (data) => {
      const { messageData } = data;
      if (messageData && selectedContact) {
        // 将文件消息添加到消息列表
        const newFileMessage = {
          id: messageData.id,
          text: messageData.content,
          sender: 'user',
          timestamp: new Date(messageData.timestamp).toISOString(),
          username: currentUser.username,
          messageType: 'file',
          fileName: messageData.fileName,
          fileUrl: messageData.fileUrl,
          fileSize: messageData.fileSize,
        };

        setMessages(prev => ({
          ...prev,
          [selectedContact.id]: [...(prev[selectedContact.id] || []), newFileMessage]
        }));

        // 保存到本地历史
        if (window.electronAPI) {
          window.electronAPI.chatMessage(selectedContact.id, currentUser.userId, newFileMessage);
        }
      }
    };

    socket.on('file-uploaded', handleFileUploaded);

    return () => {
      socket.off('file-uploaded', handleFileUploaded);
    };
  }, [socket, currentUser, selectedContact]);

  const handleToSendMessage = (contact) => {
    setSelectFeatures('message')
    setSelectedContact(contact)
  }

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
          messages={messages[selectedContact.id]}
          draft={drafts[selectedContact.id] || ''}
          onDraftChange={handleDraftChange}
          onSendMessage={handleSendMessage}
          onLoadMore={() => loadMoreMessages(selectedContact.id)}
          onUploadFile={handleUploadFile}
        />
      );
    }
    if (selectFeatures === 'contact' && selectedContactInformation) {
      return (
        <ContactInformation
          contactInformation={contacts[selectedContactInformation]}
          toSendMessage={handleToSendMessage}
        />);
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
    <div className="app-wrapper">
      <div className="app">
        <div className='app-features-bar'>
          <ToolBar
            setSelectFeatures={setSelectFeatures}
            isDarkMode={darkMode}
            toggleDarkMode={toggleDarkMode}
          />
        </div>
        <div className='contact-list'>
          {renderConnectionStatus()}
          {renderFeature()}
        </div>
        <div className='message-box'>
          <div className='message-box-header' style={{ boxShadow: '0 1px 1px rgba(0, 0, 0, 0.15)' }}>
            <AppHeaderBar />
            {selectedContact && selectFeatures == "message" &&
              <div className='contact-info'>
                <strong>
                  {selectedContact.username}
                </strong>
              </div>}
          </div>
          {renderInformationFunctionBar()}
        </div>
      </div>
    </div>
  );
}

export default App;
