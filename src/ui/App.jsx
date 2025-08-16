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
      setCurrentUser(user);
    };

    const handleFriendsList = (friends) => {
      setContacts(friends);
    };

    const handleNewMessage = (msg) => {
      if (!currentUser) return; // Guard against updates when logged out

      const contactId = msg.senderId === currentUser.id ? msg.receiverId : msg.senderId;
      const contactUsername = msg.senderId === currentUser.id ? msg.receiverUsername : msg.senderUsername;

      if (window.electronAPI) {
        window.electronAPI.sendMessage(contactId, {
          text: msg.content,
          sender: msg.senderId === currentUser.id ? 'user' : 'other',
          timestamp: msg.timestamp,
          username: contactUsername
        });
      }

      setMessages(prev => {
        const contactMessages = prev[contactId] || [];
        const isOwnMessage = msg.senderId === currentUser.id;

        // If it's a message sent by the current user, try to replace the temporary one
        if (isOwnMessage) {
          let messageReplaced = false;
          const updatedMessages = contactMessages.map(m => {
            // Find the temporary message by comparing content
            if (String(m.id).startsWith('temp_') && m.text === msg.content) {
              messageReplaced = true;
              // Replace with server data, ensuring sender is still 'user'
              return { ...msg, sender: 'user', username: currentUser.username };
            }
            return m;
          });

          if (messageReplaced) {
            return { ...prev, [contactId]: updatedMessages };
          }
        }

        // If it's a message from others, or no temp message was found, add it if it's not a duplicate
        if (!contactMessages.some(m => m.id === msg.id)) {
          return {
            ...prev,
            [contactId]: [...contactMessages, {
              id: msg.id,
              text: msg.content,
              sender: 'other',
              timestamp: msg.timestamp,
              username: contactUsername
            }]
          };
        }

        return prev; // No changes needed
      });
    };

    socket.on('login-success', handleLoginSuccess);
    socket.on('user-registered', handleLoginSuccess); // Also treat registration as a login
    socket.on('friends-list', handleFriendsList);
    socket.on('new-message', handleNewMessage);
    socket.on('disconnect', () => {
      setCurrentUser(null);
      setContacts([]);
    });

    return () => {
      socket.off('login-success', handleLoginSuccess);
      socket.off('user-registered', handleLoginSuccess);
      socket.off('friends-list', handleFriendsList);
      socket.off('new-message', handleNewMessage);
      socket.off('disconnect');
    };
  }, [socket, currentUser, setCurrentUser]); // Add currentUser to dependency array

  useEffect(() => {
    if (currentUser && socket) {
      socket.emit('get-friends');
    }
  }, [currentUser, socket]);

  const handleSelectContact = async (contact) => {
    setSelectedContact(contact);
    setMessagePages({ [contact.id]: 1 });
    if (window.electronAPI) {
      const localHistory = await window.electronAPI.getChatHistory(contact.id, 1, 20);
      setMessages(prev => ({ ...prev, [contact.id]: localHistory.map(msg => ({ ...msg, sender: msg.sender === 'user' ? 'user' : 'other' })) }));
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
        window.electronAPI.sendMessage(selectedContact.id, newMessage);
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
    
    if (window.electronAPI) {
      const olderMessages = await window.electronAPI.getChatHistory(contactId, nextPage, 20);
      if (olderMessages.length > 0) {
        setMessages(prev => ({
          ...prev,
          [contactId]: [...olderMessages.map(msg => ({ ...msg, sender: msg.sender === 'user' ? 'user' : 'other' })), ...prev[contactId]]
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
