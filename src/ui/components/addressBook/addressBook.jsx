import React, { useState, useEffect } from'react';
import { Collapse } from 'antd';
import { UserOutlined, TeamOutlined, CaretRightOutlined, UsergroupAddOutlined } from '@ant-design/icons';
import './css/addressBook.css';
import Avatar from '../avatar.jsx';
import { useUserAvatar } from '../../hooks/useAvatar.js';
import { useTranslation } from 'react-i18next';

const { Panel } = Collapse;

const AddressBook = ({ selectedContact, contacts = null, onSelectContact }) => {
  const { t } = useTranslation();

  const handleSelectContact = (contactId) => {
    onSelectContact(contactId);
  };

  // 服务器地址
  const [serverUrl, setServerUrl] = useState('');

  useEffect(() => {
    const fetchServerUrl = async () => {
      const url = await window.electronAPI.getServerUrl();
      setServerUrl(url);
    };
    fetchServerUrl();
  }, []);


  const { getAvatarUrl } = useUserAvatar();

  const friendsList = contacts.filter(contact => contact.type == "friend");
  const groupList = contacts.filter(contact => contact.type == "group")

  return (
    <div className="address-book-container">
      <div className="friend-request-manager" onClick={() => { onSelectContact('friendsRequest') }} >
        <UsergroupAddOutlined style={{ color: 'var(--text-color)' }} />
        <span style={{ color: 'var(--text-color)' }}>{t('contacts.friendRequests')}</span>
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
              <span style={{ color: 'var(--text-color)' }}>{t('contacts.myFriends')}</span>
            </div>
          }
          key="1"
          className="site-collapse-custom-panel"
        >
          {friendsList && friendsList.length > 0 ? (
            friendsList.map((contact) => (
              <div className={`address-book-item ${contact.id === selectedContact ? 'active' : 'inactive'}`} key={contact.id} onClick={() => { handleSelectContact(contact) }}>
                <Avatar
                  src={getAvatarUrl(contact.id)}
                  size={40}
                />
                <span className='contact-username' >{contact.username}</span>
              </div>
            ))
          ) : (
            <div className="address-book-no-data">{t('contacts.noFriends')}</div>
          )}

        </Panel>
        <Panel header={
          <div className="address-book-header">
            <TeamOutlined style={{ color: 'var(--text-color)' }} />
            <span style={{ color: 'var(--text-color)' }}>{t('contacts.myGroups')}</span>
          </div>
        } key="2" className="site-collapse-custom-panel">
          {/* 这里可以放置群聊列表 */}
          {groupList && groupList.length > 0 ? (
            groupList.map(group => (
              <div className={`address-book-item ${group.id === selectedContact ? 'active' : 'inactive'}`} key={group.id} onClick={() => { handleSelectContact(group) }} >
                <Avatar
                  icon={<TeamOutlined />}
                  src={`${serverUrl}/api/avatar/${group.id}/group?t=${new Date().getTime()}`}
                  alt='avatar'
                  size={40}
                >
                </Avatar>
                <span className='contact-username' >{group.username}</span>
              </div>
            ))
          ) : (
            <div style={{ color: 'var(--text-color)' }}>{t('contacts.noGroups')}</div>
          )}
        </Panel>
      </Collapse>
    </div>
  );
};

export default AddressBook;
