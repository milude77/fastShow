import React from 'react';
import { Collapse } from 'antd';
import { UserOutlined, TeamOutlined, CaretRightOutlined } from '@ant-design/icons';

const { Panel } = Collapse;

const AddressBook = ({ contacts = null, groups = null, onSelectContact }) => {

  return (
    <div style={{ paddingTop: '20px' }}>
      <Collapse
        bordered={false}
        defaultActiveKey={['1']}
        expandIcon={({ isActive }) => <CaretRightOutlined rotate={isActive ? 90 : 0} />}
        className="site-collapse-custom-collapse"
      >
        <Panel header={
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <UserOutlined style={{ marginRight: '8px' }} />
            <span>我的好友</span>
          </div>
        } key="1" className="site-collapse-custom-panel">
          {/* 这里可以放置好友列表 */}
          {contacts && Object.keys(contacts).length > 0 ? (
            Object.values(contacts).map((contact) => (
              <div key={contact.id} onClick={() => { onSelectContact(contact.id)}} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>{contact.username}</span>
                {contact.isOnline ? <span className="online-indicator">● 在线</span> : <span className="offline-indicator">○ 离线</span>}
              </div>
            ))
          ) : (
            <div style={{ paddingLeft: '24px', color: '#888' }}>暂无好友</div>
          )}

        </Panel>
        <Panel header={
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <TeamOutlined style={{ marginRight: '8px' }} />
            <span>我的群聊</span>
          </div>
        } key="2" className="site-collapse-custom-panel">
          {/* 这里可以放置群聊列表 */}
          { groups && groups.length > 0 ? (
            groups.map(group => (
              <div key={group.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>{group.name}</span>
                <span>{group.memberCount} 人</span>
              </div>
            ))
          ) : (
            <div style={{ paddingLeft: '24px', color: '#888' }}>暂无群聊</div>
          )}
        </Panel>
      </Collapse>
    </div>
  );
};

export default AddressBook;
