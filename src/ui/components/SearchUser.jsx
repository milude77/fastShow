import React, { useState } from 'react';
import { Alert } from 'antd';

function SearchUser({ onSearch, searchTerm, setSearchTerm, searchResults, onAddFriend }) {
  const [showAlert, setShowAlert] = useState(false);
  const [alertMessage, setAlertMessage] = useState('');
  const [alertType, setAlertType] = useState('success');

  const handleAddFriend = async (userId) => {
    try {
      await onAddFriend(userId);
      setAlertMessage('发送好友请求成功');
      setAlertType('success');
      setShowAlert(true);
      setTimeout(() => setShowAlert(false), 3000); // 3秒后自动关闭
    } catch (error) {
      setAlertMessage('发送好友请求失败');
      setAlertType('error');
      setShowAlert(true);
      setTimeout(() => setShowAlert(false), 3000); // 3秒后自动关闭
      console.error('添加好友失败:', error);
    }
  };

  return (
    <div>
      {showAlert && <Alert message={alertMessage} type={alertType} showIcon style={{ marginBottom: '10px' }} />}
      <form onSubmit={onSearch}>
        <input
          type="text"
          placeholder="按用户名搜索"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          style={{ marginRight: '5px' }}
        />
        <button type="submit">搜索</button>
      </form>
      <div style={{ marginTop: '10px' }}>
        {searchResults.map(user => (
          <div key={user.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '5px' }}>
            <span>{user.username} ({user.id})</span>
            <button onClick={() => handleAddFriend(user.id)}>添加好友</button>
          </div>
        ))}
      </div>
    </div>
  );
}

export default SearchUser;
