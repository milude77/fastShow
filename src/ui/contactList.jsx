import React from 'react';

const ContactList = () => {
  const contacts = [
    { id: 1, name: 'Alice' },
    { id: 2, name: 'Bob' },
    { id: 3, name: 'Charlie' },
  ];

  return (
    <div>
      <h3>联系人列表</h3>
      <ul>
        {contacts.map(contact => (
          <li key={contact.id} style={{ padding: '5px 0', listStyle: 'none' }}>
            {contact.name}
          </li>
        ))}
      </ul>
    </div>
  );
};

export default ContactList;
