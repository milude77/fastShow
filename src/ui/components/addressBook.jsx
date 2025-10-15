import React from 'react';
import { Collapse } from 'antd';
import { UserOutlined, TeamOutlined, CaretRightOutlined, UsergroupAddOutlined } from '@ant-design/icons';
import '../css/addressBook.css';

const { Panel } = Collapse;

const AddressBook = ({ selectedContact, contacts = null, onSelectContact }) => {

  const handleSelectContact = (contactId) => {
    onSelectContact(contactId);
  };

  const friendsList = contacts.filter(contact => contact.type == "friend");
  const groupList = contacts.filter(contact => contact.type == "group" )

  return (
    <div className="address-book-container">
      <div className="friend-request-manager"  onClick = {()=>{onSelectContact('friendsRequest')}} >
        <UsergroupAddOutlined style={{ color: 'var(--text-color)' }} />
        <span style={{ color: 'var(--text-color)' }}>好友申请</span>
      </div>
      <Collapse
        bordered={false}
        defaultActiveKey={[]}
        expandIcon={({ isActive }) => <CaretRightOutlined style={{ color: 'var(--text-color)' }} rotate={isActive ? 90 : 0} />}
        className="site-collapse-custom-collapse"
      >
        <Panel
          header={
            <div className="address-book-header">
              <UserOutlined style={{ color: 'var(--text-color)' }} />
              <span style={{ color: 'var(--text-color)' }}>我的好友</span>
            </div>
          }
          key="1"
          className="site-collapse-custom-panel"
        >
          {friendsList && friendsList.length > 0 ? (
            friendsList.map((contact) => (
              <div className={`address-book-item ${contact.id === selectedContact ? 'active' : 'inactive'}`} key={contact.id} onClick={() => { handleSelectContact(contact.id) }}>
                <span className='contact-username' >{contact.username}</span>
                {contact.isOnline ? <span className="online-indicator">● 在线</span> : <span className="offline-indicator">○ 离线</span>}
              </div>
            ))
          ) : (
            <div className="address-book-no-data">暂无好友</div>
          )}

        </Panel>
        <Panel header={
          <div className="address-book-header">
            <TeamOutlined style={{ color: 'var(--text-color)' }} />
            <span style={{ color: 'var(--text-color)' }}>我的群聊</span>
          </div>
        } key="2" className="site-collapse-custom-panel">
          {/* 这里可以放置群聊列表 */}
          {groupList && groupList.length > 0 ? (
            groupList.map(group => (
              <div key={group.id} className="address-book-item">
                <span className='contact-username' >{group.username}</span>
                <span className='contact-username'>{group.members.length} 人</span>
              </div>
            ))
          ) : (
            <div style={{ color: 'var(--text-color)' }}>暂无群聊</div>
          )}
        </Panel>
      </Collapse>
    </div>
  );
};

export default AddressBook;
