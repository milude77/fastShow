import { useState, useEffect } from 'react';
import './css/App.css';
import ContactList from './components/contactList';
import MessageList from './components/messageList';
import ToolBar from './components/toolBar';
import AuthPage from './AuthPage';
import { useAuth } from './hooks/useAuth';
import { useSocket } from './hooks/useSocket';

function App() {
  const [selectFeatures, setSelectFeatures] = useState('message');
  const [selectedContact, setSelectedContact] = useState(null);
  const [messages, setMessages] = useState({});
  const [drafts, setDrafts] = useState({});
  const [messagePages, setMessagePages] = useState({});
  const [contacts, setContacts] = useState([]);

  const { currentUser, setCurrentUser } = useAuth();
  const socket = useSocket();


  useEffect(() => {
    if (!socket) return;

    const handleLoginSuccess = (user) => {
      window.electronAPI.saveCurrentUserCredentials({ userId: user.userId, userName: user.username, token: user.token??user.newToken });
      window.electronAPI.saveUserListCredentials({ userId: user.userId, userName: user.username, token: user.token??user.newToken });
      setCurrentUser(user);
    };

    const handleFriendsList = (friends) => {
      setContacts(friends);
    };

    const friendsRequestAccepted = () => {
      socket.emit('get-friends');
    };

    socket.on('login-success', handleLoginSuccess);
    socket.on('user-registered', handleLoginSuccess);
    socket.on('new-message', handleNewMessage);
    socket.on('friends-list', handleFriendsList);
    socket.on('disconnect', () => {
      setCurrentUser(null);
      setContacts([]);
    });
    socket.on('friend-request-accepted', friendsRequestAccepted)

    return () => {
      socket.off('login-success', handleLoginSuccess);
      socket.off('user-registered', handleLoginSuccess);
      socket.off('friends-list', handleFriendsList);
      socket.off('new-message', handleNewMessage);
      socket.off('friend-request-accepted', friendsRequestAccepted);
      socket.off('disconnect');
    };
  }, [socket, currentUser, setCurrentUser]); // Add currentUser to dependency array

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
    const tempId = `temp_${Date.now()}`;

    // When receiving a message from others, save it to local history.
    if (msg.senderId !== currentUser.userId) {
      const newMessage = {
        id: tempId,
        text: msg.content,
        sender: 'other',
        timestamp: msg.timestamp,
        username: msg.username
      };
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
          username: contacts
        }]
      };
    });
  };
  const handleSelectContact = async (contact) => {
    setSelectedContact(contact);
    setMessagePages({ [contact.id]: 1 });
    if (window.electronAPI && currentUser) {
      const localHistory = await window.electronAPI.getChatHistory(contact.id, currentUser.userId, 1, 20);
      setMessages(prev => ({ ...prev, [contact.id]: localHistory }));
    }
  };

  const handleSendMessage = (message) => {
    if (selectedContact && currentUser && socket) {
      // Create a temporary message with a unique temporary ID
      const tempId = `temp_${Date.now()}`;
      const newMessage = {
        id: tempId, // Assign temporary ID
        text: message,
        sender: 'user',
        timestamp: new Date().toISOString(),
        username: currentUser.username // Use current user's name for sent messages
      };

      // Add the temporary message to the UI immediately
      setMessages(prev => ({
        ...prev,
        [selectedContact.id]: [...(prev[selectedContact.id] || []), newMessage]
      }));

      if (window.electronAPI) {
        console.log(currentUser)
        window.electronAPI.chatMessage(selectedContact.id, currentUser.userId, newMessage);
      }

      // Send the message to the server
      socket.emit('send-private-message', { message, receiverId: selectedContact.id });

      // Clear the draft
      setDrafts(prev => ({ ...prev, [selectedContact.id]: '' }));
    }
  };

  const handleDraftChange = (contactId, text) => {
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

  const renderFeature = () => {
    switch (selectFeatures) {
      case 'contact':
      case 'message':
        return <ContactList contacts={contacts} onSelectContact={handleSelectContact} />;
      default:
        return <div>默认列表</div>;
    }
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
        />
      );
    }
    return <div>请选择一个联系人以开始聊天</div>;
  };

  if (!currentUser) {
    return <AuthPage />;
  }

  return (
    <div className="app">
      <div className='app-features-bar'>
        <ToolBar setSelectFeatures={setSelectFeatures} />
      </div>
      <div className='contact-list'>
        {renderFeature()}
      </div>
      <div className='message-box'>
        {renderInformationFunctionBar()}
      </div>
    </div>
  );
}

export default App;
