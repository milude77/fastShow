import { useEffect, useState, memo, useCallback } from 'react';
import { Virtuoso } from 'react-virtuoso';
import './css/contactList.css';
import ContactItem from './contactItem.jsx';

const ContactList = memo(({ contacts, selectedContact, onSelectContact }) => {
  const [serverUrl, setServerUrl] = useState('');

  useEffect(() => {
    const fetchServerUrl = async () => {
      const url = await window.electronAPI.getServerUrl();
      setServerUrl(url);
    };
    fetchServerUrl();
  }, []);

  const handleSelectContact = useCallback((contact) => {
    onSelectContact(contact);
  }, [onSelectContact]);

  return (
    // 容器必须有明确的高度，否则 Virtuoso 无法计算显示区域
    // '100%' 会填充父级容器的高度
    <div className='contact-list-container' style={{ height: '100%', width: '100%' }}>
      {contacts && contacts.length > 0 ? (
        <Virtuoso
          style={{ height: '100%' }} // 撑满外层容器
          data={contacts}           // 数据数组
          itemContent={(index, contact) => (
            // 这里就像 .map() 的回调函数
            // 你不需要手动传递 style 来定位
            <ContactItem
              key={`${contact.type}-${contact.id}`}
              contact={contact}
              selectedContact={selectedContact}
              handleSelectContact={handleSelectContact}
              serverUrl={serverUrl}
            />
          )}
        />
      ) : (
        <div className='no-contact'>暂无联系人</div>
      )}
    </div>
  );
});

export default ContactList;