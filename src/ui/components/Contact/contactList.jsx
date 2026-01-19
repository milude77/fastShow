import { useEffect, useState, memo } from 'react';
import './css/contactList.css';
import ContactItem from './contactItem.jsx';

const ContactList = memo(({ contacts, selectedContact, onSelectContact }) => {
  const handleSelectContact = (contact) => {
    onSelectContact(contact);
  }

  // 服务器地址
  const [serverUrl, setServerUrl] = useState('');

  useEffect(() => {
    const fetchServerUrl = async () => {
      const url = await window.electronAPI.getServerUrl();
      setServerUrl(url);
    };
    fetchServerUrl();
  }, []);

  return (
    <div>
      <div className='contact-list'>
        {contacts && contacts.length > 0 ? (
          contacts.map((contact) => (
            <ContactItem
              key={`${contact.type}-${contact.id}`}
              contact={contact}
              selectedContact={selectedContact}
              handleSelectContact={handleSelectContact}
              serverUrl={serverUrl} 
            />
          ))
        ) : (
          <div>暂无联系人</div>
        )}
      </div>
    </div>
  );
});

export default ContactList;