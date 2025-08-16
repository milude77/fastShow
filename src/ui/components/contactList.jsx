import React from 'react';
import '../css/contactList.css';

const ContactList = ({ contacts, onSelectContact }) => {
  return (
    <div>
      <h3>联系人列表</h3>
      <ul className='contact-list'>
        {contacts.map(contact => (
          <li key={contact.id} className='contact-item' onClick={() => onSelectContact(contact)} >
            {contact.username} {/* 使用 contact.username 而不是 contact.name */}
            {contact.isOnline ? <span className="online-indicator">● 在线</span> : <span className="offline-indicator">○ 离线</span>}
          </li>
        ))}
      </ul>
    </div>
  );
};

export default ContactList;
