import React from 'react';
import { Collapse } from 'antd';
import { UserOutlined, TeamOutlined, CaretRightOutlined } from '@ant-design/icons';
import '../css/addressBook.css';

const { Panel } = Collapse;

const AddressBook = ({ contacts = null, groups = null, onSelectContact }) => {

  return (
    <div className="address-book-container">
      <Collapse
        bordered={false}
        defaultActiveKey={['1']}
        expandIcon={({ isActive }) => <CaretRightOutlined style={{ color: 'var(--text-color)' }} rotate={isActive ? 90 : 0} />}
        className="site-collapse-custom-collapse"
      >
        <Panel header={
          <div className="address-book-header">
            <UserOutlined style={{ color: 'var(--text-color)' }} />
            <span style={{ color: 'var(--text-color)' }}>我的好友</span>
          </div>
        } key="1" className="site-collapse-custom-panel">
          {contacts && Object.keys(contacts).length > 0 ? (
            Object.values(contacts).map((contact) => (
              <div className="address-book-item" key={contact.id} onClick={() => { onSelectContact(contact.id) }}>
                <span style={{ color: 'var(--text-color)' }}>{contact.username}</span>
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
          {groups && groups.length > 0 ? (
            groups.map(group => (
              <div key={group.id} className="address-book-item">
                <span>{group.name}</span>
                <span>{group.memberCount} 人</span>
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
