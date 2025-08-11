import React from 'react';

const ContactList = ({ contacts, onSelectContact }) => {
  return (
    <div>
      <h3>联系人列表</h3>
      <ul>
        {contacts.map(contact => (
          <li key={contact.id} onClick={() => onSelectContact(contact)} style={{ padding: '5px 0', listStyle: 'none', cursor: 'pointer' }}>
            {contact.name}
          </li>
        ))}
      </ul>
    </div>
  );
};

export default ContactList;
