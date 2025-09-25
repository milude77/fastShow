import '../css/contactList.css';

const ContactList = ({ contacts, selectedContact, onSelectContact }) => {


  const handleSelectContact = (contact) => {
    onSelectContact(contact);
  }


  return (
    <div>
      <ul className='contact-list'>
        {contacts && Object.keys(contacts).length > 0 && Object.values(contacts).map(( contact ) => (
          <li key={contact.id} className={`contact-item ${contact.id === selectedContact?.id ? 'selected' : ''}`}  onClick={() => handleSelectContact(contact)} >
            <span>{contact.username}</span>
            {contact.isOnline ? <span className="online-indicator">● 在线</span> : <span className="offline-indicator">○ 离线</span>}
          </li>
        ))}
      </ul>
    </div>
  );
};

export default ContactList;
