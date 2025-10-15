import '../css/contactList.css';

const ContactList = ({ contacts, selectedContact, onSelectContact }) => {


  const handleSelectContact = (contact) => {
    onSelectContact(contact);
  }
/* 测试数据
  const contactArray = {
    '2': { id: '2', username: 'Bob', isOnline: false },
    '3': { id: '3', username: 'Charlie', isOnline: true },
    '4': { id: '4', username: 'David', isOnline: false },
    '5': { id: '5', username: 'Eve', isOnline: true },
    '6': { id: '6', username: 'Frank', isOnline: false },
    '7': { id: '7', username: 'Grace', isOnline: true },
    '8': { id: '8', username: 'Henry', isOnline: false },
    '9': { id: '9', username: 'Isaac', isOnline: true },
    '10': { id: '10', username: 'Jack', isOnline: false },  
    '11': { id: '11', username: 'Kevin', isOnline: true },
    '12': { id: '12', username: 'Lily', isOnline: false },
  }
*/


  return (
    <div>
      <ul className='contact-list'>
        {
          contacts.length === 0 && (
            <li>
              <span>暂无联系人</span>
            </li>
          )
        }
        {contacts && contacts.length > 0 && contacts.map(( contact ) => (
          <li key={contact.id} className={`contact-item ${contact.id === selectedContact?.id ? 'selected' : ''}`}  onClick={() => handleSelectContact(contact)} >
            <span className="contact-username">{contact.username}</span>
            {contact.isOnline && contact.isOnline ? <span className="online-indicator">● 在线</span> : <span className="offline-indicator">○ 离线</span>}
          </li>
        ))}
      </ul>
    </div>
  );
};

export default ContactList;
