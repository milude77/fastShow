import React from 'react';
import '../css/contactList.css';

const ContactList = ({ contacts, onSelectContact }) => {
  return (
    <div>
      <h3>联系人列表</h3>
      <ul className='contact-list'>
        {contacts.map(contact => (
          <li key={contact.id} className='contact-item' onClick={() => onSelectContact(contact)} >
            {contact.name}
          </li>
        ))}
      </ul>
    </div>
  );
};

export default ContactList;
